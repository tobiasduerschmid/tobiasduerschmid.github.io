/**
 * Pyodide Web Worker
 *
 * Runs Python code in a background thread using Pyodide (CPython compiled
 * to WebAssembly). Communication with the main thread uses postMessage:
 *
 * Inbound messages (main → worker):
 *   { type: 'run',      id, path }              Run a file by path (streams output)
 *   { type: 'runCode',  id, code, silent }       Run Python code string
 *   { type: 'write',    id, path, content }      Write a file to Pyodide FS
 *   { type: 'read',     id, path }               Read a file from Pyodide FS
 *
 * Git (loaded lazily on first git* message):
 *   { type: 'gitInit',     id, dir }                          Bring up isomorphic-git on Pyodide FS
 *   { type: 'gitRun',      id, line, cwd }                    Tokenize + dispatch a typed command
 *   { type: 'gitGetState', id, dir }                          Returns {commits, branches, head, files}
 *   { type: 'gitListDir',  id, path }                         Listing for ls/pwd helpers
 *
 * Outbound messages (worker → main):
 *   { type: 'ready' }                           Pyodide is initialised
 *   { type: 'loading', message }                Progress during init
 *   { type: 'stdout', text }                    Streamed stdout (non-silent runs)
 *   { type: 'stderr', text }                    Streamed stderr (non-silent runs)
 *   { type: 'run_done',    id, exitCode }        Execution finished
 *   { type: 'write_ok',   id }                   File written
 *   { type: 'write_error', id, message }         File write failed
 *   { type: 'read_ok',    id, content }          File content
 *   { type: 'read_error', id }                   File not found / unreadable
 *   { type: 'git_*',      id, ... }              Git replies (mirror message kind)
 */
'use strict';

// Pyodide v0.27.x — Python 3.12
importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js');

var pyodide = null;
var _running = false;

// ---- Initialisation ---------------------------------------------------------

self.postMessage({ type: 'loading', message: 'Loading Python runtime…' });

loadPyodide({
  indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/',
}).then(function (py) {
  pyodide = py;

  // Create /tutorial working directory
  try { pyodide.FS.mkdir('/tutorial'); } catch (e) { /* already exists */ }
  pyodide.FS.chdir('/tutorial');

  // Inject a helper available in all test/run contexts:
  //   __run_capture(path) → stdout as string (for output-checking tests)
  pyodide.runPython([
    'import sys, io',
    'def __run_capture(path):',
    '    buf = io.StringIO()',
    '    old = sys.stdout',
    '    sys.stdout = buf',
    '    try:',
    '        exec(open(path).read(), {"__name__": "__main__"})',
    '    finally:',
    '        sys.stdout = old',
    '    return buf.getvalue()',
  ].join('\n'));

  self.postMessage({ type: 'ready' });
}).catch(function (err) {
  self.postMessage({ type: 'error', message: 'Pyodide init failed: ' + err.message });
});

// ---- Message handler --------------------------------------------------------

// Time-travel debugger: lazy-loaded only when the main thread sends
// `enableDebugger` (which only happens on tutorials with `debugger: true` in
// YAML). The extension installs its own handlers for `runDebug`, `stepCmd`,
// `updateWatches`, etc. — when not loaded, those messages would be ignored
// by this base handler, which is fine because the main thread never sends
// them on non-debugger tutorials.
var _debuggerLoaded = false;
var _debuggerHandlers = null;   // installed by worker-extension.js when loaded

self.onmessage = function (e) {
  var msg = e.data;

  if (msg.type === 'enableDebugger') {
    if (!_debuggerLoaded) {
      try {
        // Cache-bust on every fresh worker so dev iteration on the debugger
        // module doesn't require manual SW unregistration. The worker is a
        // fresh instance per page load, so this only adds one fetch per load.
        importScripts('/js/debugger/worker-extension.js?v=' + Date.now());
        _debuggerLoaded = true;
      } catch (err) {
        self.postMessage({ type: 'debuggerError', message: 'Failed to load debugger extension: ' + err.message });
        return;
      }
    }
    self.postMessage({ type: 'debuggerReady' });
    return;
  }

  // Route debugger-protocol messages to the loaded extension. The extension
  // populates `_debuggerHandlers` (an object keyed by message type) when it
  // loads. If the user clicks Debug before `enableDebugger` round-trips, the
  // main thread waits for `debuggerReady` first.
  if (_debuggerHandlers && _debuggerHandlers[msg.type]) {
    _debuggerHandlers[msg.type](msg);
    return;
  }

  if (!pyodide) {
    self.postMessage({ type: 'run_done', id: msg.id, exitCode: 1,
      error: 'Pyodide not ready yet' });
    return;
  }

  if (msg.type === 'run') {
    runFile(msg.id, msg.path, msg.args || []);
  } else if (msg.type === 'runCode') {
    runCode(msg.id, msg.code, !!msg.silent);
  } else if (msg.type === 'write') {
    writeFile(msg.id, msg.path, msg.content);
  } else if (msg.type === 'read') {
    readFile(msg.id, msg.path);
  } else if (msg.type === 'gitInit') {
    gitInit(msg.id, msg.dir);
  } else if (msg.type === 'gitRun') {
    gitRun(msg.id, msg.line, msg.cwd, msg.dir);
  } else if (msg.type === 'gitGetState') {
    gitGetState(msg.id, msg.dir);
  } else if (msg.type === 'gitListDir') {
    gitListDir(msg.id, msg.path);
  }
};

// ---- Execution --------------------------------------------------------------

function runFile(id, path, args) {
  var code;
  try {
    code = pyodide.FS.readFile(path, { encoding: 'utf8' });
  } catch (err) {
    self.postMessage({ type: 'stderr', text: 'Cannot read file: ' + path + '\n' });
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
    return;
  }

  var pyArgsStr = '[' + [path].concat(args || []).map(function(a) {
    return '"' + (a || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }).join(',') + ']';
  pyodide.runPython('import sys; sys.argv = ' + pyArgsStr);

  runCode(id, code, false);
}

function runCode(id, code, silent) {
  if (_running) {
    // Queue up after current run (simple: reject with busy signal)
    self.postMessage({ type: 'stderr', text: 'Already running — please wait.\n' });
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
    return;
  }
  _running = true;

  if (silent) {
    pyodide.setStdout({ batched: function () {} });
    pyodide.setStderr({ batched: function () {} });
  } else {
    pyodide.setStdout({ batched: function (text) {
      self.postMessage({ type: 'stdout', text: text + '\n' });
    }});
    pyodide.setStderr({ batched: function (text) {
      self.postMessage({ type: 'stderr', text: text + '\n' });
    }});
  }

  pyodide.loadPackagesFromImports(code)
    .then(function () {
      try {
        pyodide.runPython([
          'import sys as _sys',
          'for _m in list(_sys.modules):',
          '    _f = getattr(_sys.modules[_m], "__file__", "") or ""',
          '    if "/tutorial/" in _f: del _sys.modules[_m]',
          'for _k in list(globals().keys()):',
          '    if _k not in ["__name__", "__doc__", "__package__", "__loader__", "__spec__", "__annotations__", "__builtins__", "__run_capture", "sys", "io", "_sys", "_m", "_f", "_k"]:',
          '        del globals()[_k]'
        ].join('\n'));
      } catch (err) { /* Safely ignore internal wipe errors */ }

      return pyodide.runPythonAsync(code);
    })
    .then(function () {
      _running = false;
      self.postMessage({ type: 'run_done', id: id, exitCode: 0 });
    })
    .catch(function (err) {
      _running = false;
      // SystemExit is a clean exit signal, not an error. Recognize it and
      // suppress the traceback. Two forms to detect:
      //   1. err.type === 'SystemExit' (pyodide PythonError exposes the
      //      raised Python class name on .type).
      //   2. "SystemExit: <n>" anywhere in the message (fallback for older
      //      pyodide builds that don't populate .type).
      var msg = err && err.message ? err.message : String(err);
      var isSystemExit = (err && err.type === 'SystemExit') ||
                         /(^|\n|\b)SystemExit\b/.test(msg);
      if (isSystemExit) {
        var codeMatch = /SystemExit\s*:\s*(\d+)/.exec(msg);
        var exitCode = codeMatch ? parseInt(codeMatch[1], 10) : 0;
        self.postMessage({ type: 'run_done', id: id, exitCode: exitCode });
        return;
      }
      var fullMsg = err.type ? (err.type + ': ' + msg) : msg;
      if (!silent) {
        self.postMessage({ type: 'stderr', text: fullMsg + '\n' });
      }
      self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
    });
}

// ---- File I/O ---------------------------------------------------------------

function writeFile(id, path, content) {
  try {
    // Ensure parent directories exist
    var dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) {
      var parts = dir.split('/').filter(Boolean);
      var cur = '';
      parts.forEach(function (p) {
        cur += '/' + p;
        try { pyodide.FS.mkdir(cur); } catch (e) { /* exists */ }
      });
    }
    pyodide.FS.writeFile(path, content, { encoding: 'utf8' });
    self.postMessage({ type: 'write_ok', id: id });
  } catch (err) {
    self.postMessage({ type: 'write_error', id: id, message: err.message });
  }
}

function readFile(id, path) {
  try {
    var content = pyodide.FS.readFile(path, { encoding: 'utf8' });
    self.postMessage({ type: 'read_ok', id: id, content: content });
  } catch (err) {
    self.postMessage({ type: 'read_error', id: id });
  }
}

// ---- Git (isomorphic-git on Pyodide FS) ------------------------------------
//
// iso-git is loaded lazily on the first git* message so tutorials that don't
// use git pay zero cost. The fs adapter wraps Emscripten's sync `pyodide.FS`
// to look like iso-git's `fs.promises` interface — a dozen-or-so methods that
// each return Promise.resolve(syncCall()) (or reject with an Error carrying
// the Linux errno code as a string `code`, which iso-git pattern-matches on).

var _git = null;          // isomorphic-git module (window.git after import)
var _gitFsAdapter = null;
var _gitDir = '/tutorial';

// Map Emscripten/musl errno numbers (Pyodide.FS throws `e.errno`) to the
// string error codes iso-git checks (`err.code === 'ENOENT'`).
// CAREFUL: Emscripten uses musl conventions which DIFFER from Linux —
// EEXIST=20 (not 17), ENOENT=44 (not 2), etc.
var ERRNO_TO_CODE = {
  1: 'EPERM', 5: 'EIO', 8: 'EBADF',
  13: 'EACCES', 20: 'EEXIST', 28: 'EINVAL',
  31: 'EISDIR', 44: 'ENOENT', 54: 'ENOTDIR', 55: 'ENOTEMPTY',
  63: 'ENOSPC', 70: 'EROFS',
};

function _wrapFsErr(err) {
  var code = ERRNO_TO_CODE[err && err.errno] || 'EUNKNOWN';
  var wrapped = new Error(err && err.message ? err.message : code);
  wrapped.code = code;
  wrapped.errno = err && err.errno;
  return wrapped;
}

// Build the iso-git fs adapter on top of pyodide.FS. iso-git only ever uses
// the `promises` namespace, so we only implement that.
function _makeFsAdapter() {
  function statToObj(s) {
    var mode = s.mode || 0;
    var mtimeMs = s.mtime ? (typeof s.mtime.getTime === 'function' ? s.mtime.getTime() : s.mtime) : 0;
    var ctimeMs = s.ctime ? (typeof s.ctime.getTime === 'function' ? s.ctime.getTime() : s.ctime) : 0;
    var IFMT = 0o170000, IFREG = 0o100000, IFDIR = 0o040000, IFLNK = 0o120000;
    var fileType = (mode & IFMT) === IFREG ? 'file'
      : (mode & IFMT) === IFDIR ? 'dir'
      : (mode & IFMT) === IFLNK ? 'symlink' : 'file';
    return {
      type: fileType,
      mode: mode,
      size: s.size || 0,
      ino: s.ino || 0,
      mtimeMs: mtimeMs,
      ctimeMs: ctimeMs,
      uid: s.uid || 0,
      gid: s.gid || 0,
      isFile: function () { return fileType === 'file'; },
      isDirectory: function () { return fileType === 'dir'; },
      isSymbolicLink: function () { return fileType === 'symlink'; },
    };
  }

  return {
    promises: {
      readFile: function (path, opts) {
        try {
          var encoding = (typeof opts === 'string') ? opts : (opts && opts.encoding);
          var data = pyodide.FS.readFile(path, encoding ? { encoding: encoding } : undefined);
          return Promise.resolve(data);
        } catch (e) { return Promise.reject(_wrapFsErr(e)); }
      },
      writeFile: function (path, data, opts) {
        try {
          var encoding = (typeof opts === 'string') ? opts : (opts && opts.encoding);
          // pyodide.FS.writeFile accepts string with encoding or Uint8Array
          if (typeof data === 'string') {
            pyodide.FS.writeFile(path, data, { encoding: encoding || 'utf8' });
          } else {
            pyodide.FS.writeFile(path, data);
          }
          return Promise.resolve();
        } catch (e) { return Promise.reject(_wrapFsErr(e)); }
      },
      unlink: function (path) {
        try { pyodide.FS.unlink(path); return Promise.resolve(); }
        catch (e) { return Promise.reject(_wrapFsErr(e)); }
      },
      readdir: function (path) {
        try {
          var entries = pyodide.FS.readdir(path);
          // Emscripten includes "." and ".."; iso-git does NOT expect them.
          return Promise.resolve(entries.filter(function (n) {
            return n !== '.' && n !== '..';
          }));
        } catch (e) { return Promise.reject(_wrapFsErr(e)); }
      },
      mkdir: function (path) {
        try { pyodide.FS.mkdir(path); return Promise.resolve(); }
        catch (e) { return Promise.reject(_wrapFsErr(e)); }
      },
      rmdir: function (path) {
        try { pyodide.FS.rmdir(path); return Promise.resolve(); }
        catch (e) { return Promise.reject(_wrapFsErr(e)); }
      },
      stat: function (path) {
        try { return Promise.resolve(statToObj(pyodide.FS.stat(path))); }
        catch (e) { return Promise.reject(_wrapFsErr(e)); }
      },
      lstat: function (path) {
        try { return Promise.resolve(statToObj(pyodide.FS.lstat(path))); }
        catch (e) { return Promise.reject(_wrapFsErr(e)); }
      },
      symlink: function (target, linkpath) {
        try { pyodide.FS.symlink(target, linkpath); return Promise.resolve(); }
        catch (e) { return Promise.reject(_wrapFsErr(e)); }
      },
      readlink: function (path) {
        try { return Promise.resolve(pyodide.FS.readlink(path)); }
        catch (e) { return Promise.reject(_wrapFsErr(e)); }
      },
    },
  };
}

function _ensureGit(dir) {
  _gitDir = dir || '/tutorial';
  if (_git) return Promise.resolve();
  try {
    importScripts('https://cdn.jsdelivr.net/npm/isomorphic-git@1.27.1/index.umd.min.js');
    _git = self.git;
    _gitFsAdapter = _makeFsAdapter();
    // Make sure the working directory exists (it might not, e.g. /tutorial/sub).
    try { pyodide.FS.mkdir(_gitDir); } catch (e) { /* exists */ }
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

function gitInit(id, dir) {
  // Two-step: load the iso-git module, then ensure a real git repo exists at
  // `dir`. iso-git's init bails out if .git/config already exists, so any
  // `git config` line in the tutorial's git_setup running first would leave
  // a half-initialised repo. We force-create HEAD, refs/heads/, objects/,
  // info/ ourselves so the order of YAML setup_commands doesn't matter.
  _ensureGit(dir).then(function () {
    return _ensureRepoStructure(_gitDir);
  }).then(function () {
    self.postMessage({ type: 'git_init_ok', id: id });
  }).catch(function (err) {
    var emsg = err && (err.stack || err.message) || JSON.stringify(err) || String(err);
    if (err && err.errno !== undefined) emsg += ' (errno=' + err.errno + ')';
    self.postMessage({ type: 'git_init_error', id: id, message: emsg });
  });
}

// Make sure HEAD + refs/heads/ + objects/ + info/ all exist. Idempotent —
// safe to call repeatedly. Pyodide.FS.mkdir throws EEXIST(17) on existing
// dirs, which we swallow.
function _ensureRepoStructure(dir) {
  function safeMkdir(p) {
    try { pyodide.FS.mkdir(p); }
    catch (e) {
      // Emscripten/musl: EEXIST = 20 (NOT 17 like Linux).
      if (e.errno === 20) return;
      var w = new Error('mkdir failed at ' + p + ': errno=' + e.errno);
      w.errno = e.errno;
      throw w;
    }
  }
  function safeWriteIfMissing(p, content) {
    try { pyodide.FS.stat(p); return; } catch (e) { /* fall through to write */ }
    try { pyodide.FS.writeFile(p, content, { encoding: 'utf8' }); }
    catch (e) {
      var w = new Error('writeFile failed at ' + p + ': errno=' + e.errno);
      w.errno = e.errno;
      throw w;
    }
  }
  try {
    safeMkdir(dir);
    safeMkdir(dir + '/.git');
    safeMkdir(dir + '/.git/refs');
    safeMkdir(dir + '/.git/refs/heads');
    safeMkdir(dir + '/.git/refs/tags');
    safeMkdir(dir + '/.git/objects');
    safeMkdir(dir + '/.git/objects/info');
    safeMkdir(dir + '/.git/objects/pack');
    safeMkdir(dir + '/.git/info');
    safeWriteIfMissing(dir + '/.git/HEAD', 'ref: refs/heads/main\n');
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

function gitGetState(id, dir) {
  _ensureGit(dir).then(function () {
    return _buildGitState(_gitDir);
  }).then(function (state) {
    self.postMessage({ type: 'git_state', id: id, state: state });
  }).catch(function (err) {
    // No repo yet (.git missing) — return an empty state, not an error.
    if (err && err.code === 'ENOENT') {
      self.postMessage({ type: 'git_state', id: id, state: _emptyGitState() });
      return;
    }
    self.postMessage({ type: 'git_state_error', id: id, message: String(err && err.message || err) });
  });
}

function _emptyGitState() {
  return {
    commits: [], branches: [],
    head: { ref: null, hash: null, detached: false },
    files: { untracked: [], unstaged: [], staged: [], stashed: [] },
  };
}

// Build the renderer's input shape directly (no text round-trip). Mirrors
// what GitGraph.parseGitState would produce from the v86 text dump, but
// constructed straight from iso-git's structured APIs.
function _buildGitState(dir) {
  var fs = _gitFsAdapter;
  var emptyState = _emptyGitState();
  // Quick sanity: is there a .git here?
  return fs.promises.stat(dir + '/.git')
    .catch(function () { return null; })
    .then(function (gitStat) {
      if (!gitStat) return emptyState;

      return Promise.all([
        _git.listBranches({ fs: fs, dir: dir }).catch(function () { return []; }),
        _git.currentBranch({ fs: fs, dir: dir, fullname: false }).catch(function () { return null; }),
        _git.statusMatrix({ fs: fs, dir: dir }).catch(function () { return []; }),
        _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
      ]).then(function (results) {
        var branches = results[0];
        var currentBranchName = results[1];
        var statusMatrix = results[2];
        var headOid = results[3];

        // Detached HEAD = ref file holds an oid, not "ref: refs/heads/X".
        var detached = (currentBranchName == null) && !!headOid;

        // Walk log from each branch tip and dedupe by oid. Build commit objects
        // directly in the shape parseGitState returns: hash/shortHash/parents/
        // message/decorations/children/col/row/branchColor.
        var commitMap = {};
        var commits = [];

        function addRefCommits(ref) {
          return _git.log({ fs: fs, dir: dir, ref: ref, depth: 500 }).then(function (entries) {
            entries.forEach(function (e) {
              if (commitMap[e.oid]) return;
              var trimmed = e.oid.replace(/0+$/, '');
              var shortHash = (trimmed.length > 0 && trimmed.length <= 8)
                ? trimmed
                : e.oid.substring(0, 4) + '…';
              var commit = {
                hash: e.oid,
                shortHash: shortHash,
                parents: e.commit && e.commit.parent ? e.commit.parent.slice() : [],
                message: ((e.commit && e.commit.message) || '').split('\n')[0],
                decorations: '',
                children: [],
                col: 0,
                row: 0,
                branchColor: null,
              };
              commitMap[e.oid] = commit;
              commits.push(commit);
            });
          }).catch(function () { /* unreachable ref */ });
        }

        // Include all named branches, and HEAD itself (covers detached state).
        var refsToWalk = branches.slice();
        if (headOid) refsToWalk.push('HEAD');

        return Promise.all(refsToWalk.map(addRefCommits)).then(function () {
          // Children references.
          commits.forEach(function (c) {
            c.parents.forEach(function (pHash) {
              if (commitMap[pHash]) commitMap[pHash].children.push(c.hash);
            });
          });

          // Build branchMap and decorations: which branch points at which commit.
          var branchMap = {};
          return Promise.all(branches.map(function (name) {
            return _git.resolveRef({ fs: fs, dir: dir, ref: name }).then(function (oid) {
              branchMap[name] = oid;
              if (commitMap[oid]) {
                var dec = commitMap[oid].decorations;
                commitMap[oid].decorations = dec ? (dec + ', ' + name) : name;
              }
            }).catch(function () { });
          })).then(function () {
            // Prefix HEAD on the current branch's tip.
            var head = { ref: null, hash: null, detached: !!detached };
            if (detached) {
              head.hash = headOid;
              if (commitMap[headOid]) {
                var dec = commitMap[headOid].decorations;
                commitMap[headOid].decorations = dec
                  ? ('HEAD, ' + dec)
                  : 'HEAD';
              }
            } else if (currentBranchName) {
              head.ref = 'refs/heads/' + currentBranchName;
              head.hash = branchMap[currentBranchName] || null;
              if (head.hash && commitMap[head.hash]) {
                // Replace `<branch>` decoration with `HEAD -> <branch>`.
                var c = commitMap[head.hash];
                if (c.decorations) {
                  var parts = c.decorations.split(', ').map(function (p) {
                    return p === currentBranchName ? 'HEAD -> ' + currentBranchName : p;
                  });
                  if (parts.indexOf('HEAD -> ' + currentBranchName) === -1) {
                    parts.unshift('HEAD -> ' + currentBranchName);
                  }
                  c.decorations = parts.join(', ');
                } else {
                  c.decorations = 'HEAD -> ' + currentBranchName;
                }
              }
            }

            // Files derived from statusMatrix:
            //   row = [filepath, HEAD, WORKDIR, STAGE]
            //   HEAD: 0=absent, 1=present
            //   WORKDIR: 0=absent, 1=same as HEAD, 2=different
            //   STAGE: 0=absent, 1=same as HEAD, 2=same as WORKDIR, 3=different from both
            var files = { untracked: [], unstaged: [], staged: [], stashed: [] };
            statusMatrix.forEach(function (row) {
              var fp = row[0], H = row[1], W = row[2], S = row[3];
              if (H === 0 && W === 2 && S === 0) {
                files.untracked.push(fp);
              } else if (H === 0 && S !== 0) {
                files.staged.push({ status: 'new file', path: fp });
                if (W === 3) files.unstaged.push({ status: 'modified', path: fp });
              } else if (H === 1 && W === 0 && S === 0) {
                files.staged.push({ status: 'deleted', path: fp });
              } else if (H === 1 && W === 0 && S === 1) {
                files.unstaged.push({ status: 'deleted', path: fp });
              } else if (H === 1 && W === 2 && S === 1) {
                files.unstaged.push({ status: 'modified', path: fp });
              } else if (H === 1 && W === 2 && S === 2) {
                files.staged.push({ status: 'modified', path: fp });
              } else if (H === 1 && W === 2 && S === 3) {
                files.staged.push({ status: 'modified', path: fp });
                files.unstaged.push({ status: 'modified', path: fp });
              }
            });

            // Expose stash entries to the workbench's stash shelf. The
            // renderer expects `{ref, branch, message}` tuples; we draw them
            // from `.git/STASH_LOG.json` (see _stashPush).
            try {
              var stashEntries = _stashRead(dir);
              stashEntries.forEach(function (e, i) {
                files.stashed.push({
                  ref: 'stash@{' + i + '}',
                  branch: e.branch || '',
                  message: e.message || '',
                });
              });
            } catch (e) { /* no stash log — fine */ }

            return {
              commits: commits,
              branches: Object.keys(branchMap),
              head: head,
              files: files,
            };
          });
        });
      });
    });
}

function gitListDir(id, path) {
  if (!_git) {
    self.postMessage({ type: 'git_listdir', id: id, path: path, entries: [], error: 'git not initialized' });
    return;
  }
  try {
    var entries = pyodide.FS.readdir(path).filter(function (n) {
      return n !== '.' && n !== '..';
    });
    // Annotate with type so `ls` can show / on directories.
    var annotated = entries.map(function (name) {
      try {
        var st = pyodide.FS.stat(path === '/' ? '/' + name : path + '/' + name);
        var isDir = (st.mode & 0o170000) === 0o040000;
        return { name: name, isDir: isDir };
      } catch (e) { return { name: name, isDir: false }; }
    });
    self.postMessage({ type: 'git_listdir', id: id, path: path, entries: annotated });
  } catch (e) {
    self.postMessage({ type: 'git_listdir', id: id, path: path, entries: [], error: e.message });
  }
}

// ---- Git command router ----------------------------------------------------
//
// Tokenizer + dispatch for a strict allowlist of subcommands. Echoes git-like
// output to stdout/stderr; returns mutatedPaths for the main thread to refresh
// Monaco models. Bash semantics intentionally absent — no pipes, no globs, no
// env vars, no subshells. If you want a pipe, use a real shell.

function _tokenize(line) {
  // Whitespace split with single/double-quote handling. No backslash escapes.
  var tokens = [];
  var cur = '';
  var inSingle = false, inDouble = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inSingle) {
      if (ch === "'") { inSingle = false; } else { cur += ch; }
    } else if (inDouble) {
      if (ch === '"') { inDouble = false; } else { cur += ch; }
    } else if (ch === "'") { inSingle = true; }
    else if (ch === '"') { inDouble = true; }
    else if (/\s/.test(ch)) {
      if (cur.length) { tokens.push(cur); cur = ''; }
    } else { cur += ch; }
  }
  if (cur.length) tokens.push(cur);
  return tokens;
}

function _normalizePath(cwd, dir, p) {
  // Resolve an arg path against cwd. Returns absolute path.
  if (!p) return cwd;
  if (p.charAt(0) === '/') return _resolveAbs(p);
  return _resolveAbs((cwd || dir) + '/' + p);
}

function _resolveAbs(abs) {
  // Collapse "." and "..", strip duplicate slashes.
  var parts = abs.split('/').filter(Boolean);
  var stack = [];
  parts.forEach(function (p) {
    if (p === '.') return;
    if (p === '..') { stack.pop(); return; }
    stack.push(p);
  });
  return '/' + stack.join('/');
}

function _toRel(dir, abs) {
  // iso-git filepath is relative to `dir` (working tree root). If `abs`
  // is outside the worktree, return null — caller should error.
  if (abs === dir) return '.';
  var prefix = dir.replace(/\/$/, '') + '/';
  if (abs.indexOf(prefix) !== 0) return null;
  return abs.substring(prefix.length);
}

function gitRun(id, line, cwd, dir) {
  _ensureGit(dir).then(function () {
    var tokens = _tokenize(String(line || '').trim());
    if (tokens.length === 0) {
      return _gitReply(id, '', '', 0, []);
    }
    var verb = tokens[0];
    var rest = tokens.slice(1);
    if (verb === 'git') {
      return _dispatchGit(id, rest, cwd || _gitDir);
    }
    return _gitReply(id, '',
      verb + ': command not found (this terminal only runs `git ...` and a few helpers; type `help`)\n', 1, []);
  }).catch(function (err) {
    _gitReply(id, '', String(err && err.message || err) + '\n', 1, []);
  });
}

function _gitReply(id, stdout, stderr, exitCode, mutatedPaths) {
  self.postMessage({
    type: 'git_run_done',
    id: id,
    stdout: stdout || '',
    stderr: stderr || '',
    exitCode: exitCode || 0,
    mutatedPaths: mutatedPaths || [],
  });
}

function _dispatchGit(id, args, cwd) {
  if (args.length === 0) {
    return _gitReply(id, '', 'usage: git <command> [<args>]\n', 1, []);
  }
  var sub = args[0];
  var rest = args.slice(1);
  var dir = _gitDir;
  var fs = _gitFsAdapter;

  try {
    if (sub === 'init')         return _gitCmdInit(id, rest, dir, fs);
    if (sub === 'config')       return _gitCmdConfig(id, rest, dir, fs);
    if (sub === 'status')       return _gitCmdStatus(id, rest, dir, fs, cwd);
    if (sub === 'add')          return _gitCmdAdd(id, rest, dir, fs, cwd);
    if (sub === 'commit')       return _gitCmdCommit(id, rest, dir, fs);
    if (sub === 'log')          return _gitCmdLog(id, rest, dir, fs);
    if (sub === 'branch')       return _gitCmdBranch(id, rest, dir, fs);
    if (sub === 'switch')       return _gitCmdSwitch(id, rest, dir, fs);
    if (sub === 'checkout')     return _gitCmdCheckout(id, rest, dir, fs, cwd);
    if (sub === 'merge')        return _gitCmdMerge(id, rest, dir, fs);
    if (sub === 'rm')           return _gitCmdRm(id, rest, dir, fs, cwd);
    if (sub === 'mv')           return _gitCmdMv(id, rest, dir, fs, cwd);
    if (sub === 'reset')        return _gitCmdReset(id, rest, dir, fs, cwd);
    if (sub === 'restore')      return _gitCmdRestore(id, rest, dir, fs, cwd);
    if (sub === 'tag')          return _gitCmdTag(id, rest, dir, fs);
    if (sub === 'diff')         return _gitCmdDiff(id, rest, dir, fs, cwd);
    if (sub === 'show')         return _gitCmdShow(id, rest, dir, fs);
    if (sub === 'stash')        return _gitCmdStash(id, rest, dir, fs);
    if (sub === 'cherry-pick')  return _gitCmdCherryPick(id, rest, dir, fs);
    if (sub === 'revert')       return _gitCmdRevert(id, rest, dir, fs);
    if (sub === 'bisect')       return _gitCmdBisect(id, rest, dir, fs);
    if (sub === 'reflog')       return _gitCmdReflog(id, rest, dir, fs);
  } catch (err) {
    return _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  }
  return _gitReply(id, '',
    "git: '" + sub + "' is not supported in this tutorial. Try: init, status, add, commit, log, branch, switch, checkout, merge, rm, mv, reset, restore, config, tag, diff, show, stash, cherry-pick, revert, bisect, reflog\n",
    1, []);
}

// ---- Individual git subcommands --------------------------------------------

function _gitCmdInit(id, args, dir, fs) {
  var defaultBranch = 'main';
  _git.init({ fs: fs, dir: dir, defaultBranch: defaultBranch })
    .then(function () {
      _gitReply(id, 'Initialized empty Git repository in ' + dir + '/.git/\n', '', 0, []);
    })
    .catch(function (err) { _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []); });
}

function _gitCmdConfig(id, args, dir, fs) {
  // Real git's `config` accepts read, write, list, get, and unset modes:
  //   git config <key>                  — print value
  //   git config --get <key>            — print value (explicit read)
  //   git config <key> <value>          — write
  //   git config --add <key> <value>    — write (we treat same as plain set)
  //   git config --unset <key>          — remove
  //   git config --list / -l            — list all keys
  //   git config --global ...           — accepted for source compat; iso-git
  //                                       has no global store so we treat as
  //                                       local.
  var listAll = false, unset = false, getMode = false, add = false;
  var rest = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '--global' || a === '--local' || a === '--system') continue;
    if (a === '--list' || a === '-l') { listAll = true; continue; }
    if (a === '--unset') { unset = true; continue; }
    if (a === '--get')   { getMode = true; continue; }
    if (a === '--add')   { add = true; continue; }
    rest.push(a);
  }

  if (listAll) {
    _git.listConfig
      ? _git.listConfig({ fs: fs, dir: dir }).then(function (entries) {
          var out = entries.map(function (e) { return e.path + '=' + e.value; }).join('\n');
          _gitReply(id, out + (out ? '\n' : ''), '', 0, []);
        }).catch(function (err) { _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []); })
      : _readWholeConfig(dir).then(function (text) { _gitReply(id, text, '', 0, []); })
        .catch(function (err) { _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []); });
    return;
  }

  if (unset) {
    if (rest.length < 1) return _gitReply(id, '', "error: wrong number of arguments\n", 1, []);
    _git.setConfig({ fs: fs, dir: dir, path: rest[0], value: undefined })
      .then(function () { _gitReply(id, '', '', 0, []); })
      .catch(function (err) { _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []); });
    return;
  }

  if (rest.length === 0) {
    return _gitReply(id, '', "usage: git config [<options>] <key> [<value>]\n", 1, []);
  }

  // Read mode: `git config <key>` or `git config --get <key>`
  if (rest.length === 1 || getMode && rest.length === 1) {
    _git.getConfig({ fs: fs, dir: dir, path: rest[0] })
      .then(function (val) {
        if (val === undefined || val === null) _gitReply(id, '', '', 1, []);
        else _gitReply(id, String(val) + '\n', '', 0, []);
      }).catch(function (err) { _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []); });
    return;
  }

  // Write mode
  var key = rest[0];
  var value = rest.slice(1).join(' ');
  _git.setConfig({ fs: fs, dir: dir, path: key, value: value })
    .then(function () { _gitReply(id, '', '', 0, []); })
    .catch(function (err) { _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []); });
}

// Fallback when iso-git build doesn't expose listConfig: read .git/config raw.
function _readWholeConfig(dir) {
  try {
    var content = pyodide.FS.readFile(dir + '/.git/config', { encoding: 'utf8' });
    return Promise.resolve(content || '');
  } catch (e) { return Promise.resolve(''); }
}

function _gitCmdStatus(id, args, dir, fs, cwd) {
  Promise.all([
    _git.statusMatrix({ fs: fs, dir: dir }).catch(function () { return []; }),
    _git.currentBranch({ fs: fs, dir: dir }).catch(function () { return null; }),
    // Detect "no commits yet" state — HEAD is a symbolic ref but the branch
    // it points at has no oid. real-git shows a special header line for this.
    _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
  ]).then(function (r) {
    var matrix = r[0], branch = r[1], headOid = r[2];
    var hasCommits = !!headOid;
    var staged = [], unstaged = [], untracked = [];
    matrix.forEach(function (row) {
      var fp = row[0], H = row[1], W = row[2], S = row[3];
      if (H === 0 && W === 2 && S === 0) untracked.push(fp);
      else if (H === 0 && S !== 0) {
        staged.push({ status: 'new file', path: fp });
        if (W === 3) unstaged.push({ status: 'modified', path: fp });
      }
      else if (H === 1 && W === 0 && S === 0) staged.push({ status: 'deleted', path: fp });
      else if (H === 1 && W === 0 && S === 1) unstaged.push({ status: 'deleted', path: fp });
      else if (H === 1 && W === 2 && S === 1) unstaged.push({ status: 'modified', path: fp });
      else if (H === 1 && W === 2 && S === 2) staged.push({ status: 'modified', path: fp });
      else if (H === 1 && W === 2 && S === 3) {
        staged.push({ status: 'modified', path: fp });
        unstaged.push({ status: 'modified', path: fp });
      }
    });

    // ANSI colors so the terminal renders status entries the same way real
    // git does — green for staged, red for unstaged/untracked.
    var GREEN = '\x1b[32m', RED = '\x1b[31m', RESET = '\x1b[m';

    var out = 'On branch ' + (branch || 'main') + '\n';
    if (!hasCommits) out += '\nNo commits yet\n';

    if (staged.length) {
      out += '\nChanges to be committed:\n';
      out += '  (use "git restore --staged <file>..." to unstage)\n';
      staged.forEach(function (s) {
        out += '\t' + GREEN + _padStatus(s.status) + s.path + RESET + '\n';
      });
    }
    if (unstaged.length) {
      out += '\nChanges not staged for commit:\n';
      out += '  (use "git add <file>..." to update what will be committed)\n';
      out += '  (use "git restore <file>..." to discard changes in working directory)\n';
      unstaged.forEach(function (s) {
        out += '\t' + RED + _padStatus(s.status) + s.path + RESET + '\n';
      });
    }
    if (untracked.length) {
      out += '\nUntracked files:\n';
      out += '  (use "git add <file>..." to include in what will be committed)\n';
      untracked.forEach(function (f) { out += '\t' + RED + f + RESET + '\n'; });
    }

    if (staged.length === 0 && unstaged.length === 0 && untracked.length === 0) {
      out += hasCommits ? '\nnothing to commit, working tree clean\n'
                        : '\nnothing to commit (create/copy files and use "git add" to track)\n';
    } else if (staged.length === 0 && (unstaged.length || untracked.length)) {
      out += '\n';
      if (untracked.length && !unstaged.length) {
        out += hasCommits
          ? 'nothing added to commit but untracked files present (use "git add" to track)\n'
          : 'nothing added to commit but untracked files present (use "git add" to track)\n';
      } else {
        out += 'no changes added to commit (use "git add" and/or "git commit -a")\n';
      }
    }
    _gitReply(id, out, '', 0, []);
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []);
  });
}

// Pad status verb to align paths in `git status` output. Real git uses
// 12-column padding; matches "modified:   ", "new file:   ", "deleted:    ".
function _padStatus(verb) {
  var s = verb + ':';
  while (s.length < 12) s += ' ';
  return s;
}

function _gitCmdAdd(id, args, dir, fs, cwd) {
  // Recognise `-A`, `--all`, `-u`, `--update`. All of these stage every file
  // under the working tree (or under the cwd, for `.`). In real git `-u`
  // skips untracked files; we match that distinction.
  var addAll = false, updateOnly = false;
  var pathspecs = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-A' || a === '--all' || a === '--no-ignore-removal') { addAll = true; continue; }
    if (a === '-u' || a === '--update') { updateOnly = true; continue; }
    if (a === '--') continue;
    if (a.charAt(0) === '-') {
      // Unknown flag — surface it instead of silently expanding.
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
    pathspecs.push(a);
  }

  if (pathspecs.length === 0 && !addAll && !updateOnly) {
    return _gitReply(id, '', "Nothing specified, nothing added.\nhint: Maybe you wanted to say 'git add .'?\n", 1, []);
  }

  // pathspec semantics:
  //   `.`       → everything under cwd (real git scopes by cwd)
  //   `<path>`  → that single relative path
  //   (-A / -u with no pathspec) → everything under dir (whole worktree)
  function gatherFromMatrix(filterRel) {
    return _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
      return matrix.filter(function (row) {
        if (!filterRel) return true;
        return row[0] === filterRel || row[0].indexOf(filterRel + '/') === 0;
      });
    });
  }

  var cwdRel = _toRel(dir, cwd) || '';
  if (cwdRel === '.') cwdRel = '';

  // Collect work items: either matrix rows (filtered) or single paths.
  var work = [];
  if (addAll || updateOnly) {
    // Operate on whole tree. For `add -A`, also pick up untracked files
    // anywhere under `dir`. statusMatrix already includes them (untracked
    // files appear with H=0,W=2,S=0 — our switch handles all rows below).
    work.push(gatherFromMatrix(null));
  }
  pathspecs.forEach(function (ps) {
    if (ps === '.') {
      work.push(gatherFromMatrix(cwdRel || null));
    } else {
      var abs = _normalizePath(cwd, dir, ps);
      var rel = _toRel(dir, abs);
      if (rel === null) {
        work.push(Promise.reject(new Error("fatal: pathspec '" + ps + "' did not match any files")));
        return;
      }
      // If `rel` points at a directory, expand via matrix; otherwise treat
      // as a single file row synthesized from the FS state.
      var st = null;
      try { st = pyodide.FS.stat(abs); } catch (e) { /* missing — let iso-git report */ }
      var isDir = st && (st.mode & 0o170000) === 0o040000;
      if (isDir) {
        work.push(gatherFromMatrix(rel));
      } else {
        // Single file — synthesize a row stub. Use 0 placeholders; the per-
        // file dispatcher below only checks existence to choose add/remove.
        work.push(Promise.resolve([[rel, st ? 1 : 0, st ? 2 : 0, 0]]));
      }
    }
  });

  Promise.all(work).then(function (lists) {
    // Dedupe and dispatch.
    var rows = [].concat.apply([], lists);
    var seen = {};
    var ops = [];
    rows.forEach(function (row) {
      var fp = row[0]; if (seen[fp]) return; seen[fp] = true;
      var H = row[1], W = row[2];
      var abs = dir + '/' + fp;
      var exists = true;
      try { pyodide.FS.stat(abs); } catch (e) { exists = false; }
      if (!exists) {
        // File is gone in the working tree.
        if (H === 0) return; // never tracked AND gone — nothing to do
        ops.push(_git.remove({ fs: fs, dir: dir, filepath: fp }));
        return;
      }
      if (updateOnly && H === 0) {
        // `-u` only updates already-tracked files.
        return;
      }
      ops.push(_git.add({ fs: fs, dir: dir, filepath: fp }));
    });
    return Promise.all(ops);
  }).then(function () {
    _gitReply(id, '', '', 0, []);
  }).catch(function (err) {
    _gitReply(id, '', (/^fatal:/.test(err.message) ? '' : 'fatal: ') + err.message + '\n', 1, []);
  });
}

function _gitCmdCommit(id, args, dir, fs) {
  // Parse: `git commit -m "msg"`, `git commit -am "msg"`, `git commit --message=msg`,
  //         `git commit --allow-empty -m "msg"`, `git commit --amend ...`.
  var message = null;
  var stageAll = false;
  var allowEmpty = false;
  var amend = false;
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-m' || a === '--message') { message = args[i + 1] || ''; i++; }
    else if (a.indexOf('--message=') === 0) { message = a.substring('--message='.length); }
    else if (a === '-am' || a === '-ma') { stageAll = true; message = args[i + 1] || ''; i++; }
    else if (a === '-a' || a === '--all') { stageAll = true; }
    else if (a === '--allow-empty') { allowEmpty = true; }
    else if (a === '--amend') { amend = true; }
    else if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
  }
  if (!message && !amend) {
    return _gitReply(id, '', "Aborting: no commit message. Use -m \"...\".\n", 1, []);
  }

  var stagePromise = stageAll
    ? _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
        return Promise.all(matrix.map(function (row) {
          var fp = row[0], H = row[1], W = row[2];
          if (H === 1 && W === 0) return _git.remove({ fs: fs, dir: dir, filepath: fp });
          if (H === 1 && W !== 1) return _git.add({ fs: fs, dir: dir, filepath: fp }); // existing tracked → restage
          // Note: `commit -a` does NOT add untracked files (real git behavior).
          return Promise.resolve();
        }));
      })
    : Promise.resolve();

  stagePromise.then(function () {
    // Verify there's something staged unless --allow-empty (or --amend).
    if (allowEmpty || amend) return null;
    return _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
      var anyStaged = matrix.some(function (row) {
        var H = row[1], S = row[3];
        // staged differs from HEAD ⇔ S !== 1 (when tracked) OR (untracked-but-staged: S !== 0)
        if (H === 0 && S !== 0) return true;       // new file staged
        if (H === 1 && S !== 1) return true;       // staged change
        return false;
      });
      if (!anyStaged) {
        return Promise.reject(new Error('__NOTHING_STAGED__'));
      }
    });
  }).then(function () {
    return Promise.all([
      _git.getConfig({ fs: fs, dir: dir, path: 'user.name' }).catch(function () { return null; }),
      _git.getConfig({ fs: fs, dir: dir, path: 'user.email' }).catch(function () { return null; }),
      _git.currentBranch({ fs: fs, dir: dir }).catch(function () { return null; }),
      _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
    ]);
  }).then(function (cfg) {
    var name = cfg[0] || 'Student';
    var email = cfg[1] || 'student@example.com';
    var branch = cfg[2] || 'HEAD';
    var hadHead = !!cfg[3];
    var commitArgs = {
      fs: fs, dir: dir, message: message || '',
      author: { name: name, email: email },
    };
    if (amend) commitArgs.amend = true;
    var oldOid = cfg[3];
    return _git.commit(commitArgs).then(function (oid) {
      var shortHash = oid.substring(0, 7);
      var subject = (message || '').split('\n')[0];
      var prefix = hadHead && !amend ? '' : '(root-commit) ';
      _appendReflog(dir, 'HEAD', oldOid, oid,
        'commit' + (amend ? ' (amend)' : (!hadHead ? ' (initial)' : '')) + ': ' + subject);
      if (branch && branch !== 'HEAD') {
        _appendReflog(dir, 'refs/heads/' + branch, oldOid, oid,
          'commit' + (amend ? ' (amend)' : (!hadHead ? ' (initial)' : '')) + ': ' + subject);
      }
      _gitReply(id, '[' + branch + ' ' + prefix + shortHash + '] ' + subject + '\n', '', 0, []);
    });
  }).catch(function (err) {
    if (err && err.message === '__NOTHING_STAGED__') {
      // Match real git's nothing-to-commit message style.
      _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
        var hasUntracked = matrix.some(function (r) { return r[1] === 0 && r[2] === 2 && r[3] === 0; });
        var msg = hasUntracked
          ? "On branch main\nnothing added to commit but untracked files present (use \"git add\" to track)\n"
          : "On branch main\nnothing to commit, working tree clean\n";
        _gitReply(id, msg, '', 1, []);
      });
      return;
    }
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

function _gitCmdLog(id, args, dir, fs) {
  // Supported flags:
  //   --oneline                  — short format
  //   --all                      — log from all branches (deduped)
  //   -n <count> / --max-count=<n>  — limit
  //   --graph                    — not implemented; surface a clear error
  var oneline = false, showAll = false, depth = 100;
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '--oneline') { oneline = true; continue; }
    if (a === '--all')     { showAll = true; continue; }
    if (a === '--graph')   { return _gitReply(id, '',
        "git log --graph isn't supported in this terminal — use the Git Graph view instead.\n", 1, []); }
    if (a === '-n' || a === '--max-count') {
      var n = parseInt(args[i + 1], 10); if (!isNaN(n)) depth = n; i++; continue;
    }
    if (a.indexOf('--max-count=') === 0) {
      var n2 = parseInt(a.substring('--max-count='.length), 10); if (!isNaN(n2)) depth = n2; continue;
    }
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
  }

  var YELLOW = '\x1b[33m', RESET = '\x1b[m';

  var refsPromise = showAll
    ? _git.listBranches({ fs: fs, dir: dir }).catch(function () { return ['HEAD']; })
    : Promise.resolve(['HEAD']);

  refsPromise.then(function (refs) {
    if (!refs || refs.length === 0) refs = ['HEAD'];
    return Promise.all(refs.map(function (r) {
      return _git.log({ fs: fs, dir: dir, ref: r, depth: depth })
        .catch(function () { return []; });
    }));
  }).then(function (lists) {
    var seen = {}, entries = [];
    lists.forEach(function (l) {
      l.forEach(function (e) { if (!seen[e.oid]) { seen[e.oid] = true; entries.push(e); } });
    });
    // Sort newest first by author timestamp.
    entries.sort(function (a, b) {
      var ta = (a.commit && a.commit.author && a.commit.author.timestamp) || 0;
      var tb = (b.commit && b.commit.author && b.commit.author.timestamp) || 0;
      return tb - ta;
    });
    if (depth) entries = entries.slice(0, depth);

    if (entries.length === 0) {
      return _gitReply(id, '',
        "fatal: your current branch '" + 'main' + "' does not have any commits yet\n", 1, []);
    }

    var out = '';
    entries.forEach(function (e) {
      var subject = ((e.commit && e.commit.message) || '').split('\n')[0];
      if (oneline) {
        out += YELLOW + e.oid.substring(0, 7) + RESET + ' ' + subject + '\n';
      } else {
        out += YELLOW + 'commit ' + e.oid + RESET + '\n';
        if (e.commit && e.commit.parent && e.commit.parent.length > 1) {
          out += 'Merge: ' + e.commit.parent.map(function (p) { return p.substring(0, 7); }).join(' ') + '\n';
        }
        if (e.commit && e.commit.author) {
          out += 'Author: ' + e.commit.author.name + ' <' + e.commit.author.email + '>\n';
          if (e.commit.author.timestamp) {
            out += 'Date:   ' + new Date(e.commit.author.timestamp * 1000).toString() + '\n';
          }
        }
        out += '\n    ' + (e.commit && e.commit.message ? e.commit.message.replace(/\n/g, '\n    ') : '') + '\n\n';
      }
    });
    _gitReply(id, out, '', 0, []);
  }).catch(function (err) {
    if (err && (err.code === 'NotFoundError' || /HEAD/i.test(err.message || ''))) {
      _gitReply(id, '', "fatal: your current branch 'main' does not have any commits yet\n", 1, []);
    } else {
      _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
    }
  });
}

function _gitCmdBranch(id, args, dir, fs) {
  // Modes:
  //   git branch                   — list local
  //   git branch -a                — list local + remote
  //   git branch <name>            — create from HEAD
  //   git branch <name> <start>    — create from <start>
  //   git branch -d <name>         — delete (only if merged)
  //   git branch -D <name>         — force delete
  //   git branch -m <new>          — rename current
  //   git branch -m <old> <new>    — rename specific
  var listAll = false, deleteName = null, forceDelete = false;
  var renameOld = null, renameNew = null;
  var positional = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-a' || a === '--all') { listAll = true; continue; }
    if (a === '-d' || a === '--delete') { deleteName = args[i + 1]; i++; continue; }
    if (a === '-D') { deleteName = args[i + 1]; forceDelete = true; i++; continue; }
    if (a === '-m' || a === '--move' || a === '-M') {
      // -m <new>  OR  -m <old> <new>
      if (args.length === i + 2) { renameOld = args[i + 1]; renameNew = args[i + 2]; i += 2; }
      else { renameNew = args[i + 1]; i++; }
      continue;
    }
    if (a === '--') continue;
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
    positional.push(a);
  }

  // Rename
  if (renameNew) {
    var doRename = renameOld
      ? Promise.resolve(renameOld)
      : _git.currentBranch({ fs: fs, dir: dir });
    doRename.then(function (oldName) {
      if (!oldName) throw new Error('not on a branch');
      return _git.renameBranch
        ? _git.renameBranch({ fs: fs, dir: dir, ref: renameNew, oldref: oldName })
        : Promise.reject(new Error('rename not supported in this iso-git build'));
    }).then(function () { _gitReply(id, '', '', 0, []); })
      .catch(function (err) { _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []); });
    return;
  }

  // Delete
  if (deleteName) {
    if (!forceDelete) {
      // iso-git deleteBranch doesn't check merge status; for safety we
      // refuse to delete a branch that isn't an ancestor of HEAD unless -D.
      Promise.all([
        _git.resolveRef({ fs: fs, dir: dir, ref: deleteName }).catch(function () { return null; }),
        _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
      ]).then(function (r) {
        var branchOid = r[0], headOid = r[1];
        if (!branchOid) return Promise.reject(new Error("branch '" + deleteName + "' not found"));
        return _git.isDescendent
          ? _git.isDescendent({ fs: fs, dir: dir, oid: headOid, ancestor: branchOid })
          : Promise.resolve(true);
      }).then(function (merged) {
        if (!merged) {
          _gitReply(id, '',
            "error: The branch '" + deleteName + "' is not fully merged.\n" +
            "If you are sure you want to delete it, run 'git branch -D " + deleteName + "'.\n",
            1, []);
          return;
        }
        return _git.deleteBranch({ fs: fs, dir: dir, ref: deleteName }).then(function () {
          _gitReply(id, "Deleted branch " + deleteName + ".\n", '', 0, []);
        });
      }).catch(function (err) { _gitReply(id, '', 'error: ' + (err.message || err) + '\n', 1, []); });
      return;
    }
    _git.deleteBranch({ fs: fs, dir: dir, ref: deleteName })
      .then(function () { _gitReply(id, "Deleted branch " + deleteName + " (was force-deleted).\n", '', 0, []); })
      .catch(function (err) { _gitReply(id, '', 'error: ' + (err.message || err) + '\n', 1, []); });
    return;
  }

  // Create with optional start point
  if (positional.length >= 1) {
    var newName = positional[0];
    var startPoint = positional[1] || 'HEAD';
    _git.resolveRef({ fs: fs, dir: dir, ref: startPoint })
      .then(function (oid) {
        return _git.writeRef({ fs: fs, dir: dir, ref: 'refs/heads/' + newName, value: oid, force: false });
      })
      .then(function () { _gitReply(id, '', '', 0, []); })
      .catch(function (err) { _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []); });
    return;
  }

  // List
  Promise.all([
    _git.listBranches({ fs: fs, dir: dir }),
    _git.currentBranch({ fs: fs, dir: dir }),
  ]).then(function (r) {
    var branches = r[0] || [], cur = r[1];
    var out = '';
    branches.forEach(function (b) {
      var marker = (b === cur) ? '* ' : '  ';
      var color = (b === cur) ? '\x1b[32m' : '';
      var reset = (b === cur) ? '\x1b[m' : '';
      out += marker + color + b + reset + '\n';
    });
    if (listAll) {
      _git.listBranches({ fs: fs, dir: dir, remote: 'origin' })
        .catch(function () { return []; })
        .then(function (remotes) {
          remotes.forEach(function (rb) {
            out += '  \x1b[31mremotes/origin/' + rb + '\x1b[m\n';
          });
          _gitReply(id, out, '', 0, []);
        });
    } else {
      _gitReply(id, out, '', 0, []);
    }
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

function _gitCmdSwitch(id, args, dir, fs) {
  // `git switch <name>` | `git switch -c <name>`
  var create = false;
  var name = null;
  for (var i = 0; i < args.length; i++) {
    if (args[i] === '-c' || args[i] === '-C') { create = true; }
    else if (!name) { name = args[i]; }
  }
  if (!name) return _gitReply(id, '', "switch: branch name required\n", 1, []);
  _doCheckout(id, dir, fs, name, create);
}

function _gitCmdCheckout(id, args, dir, fs, cwd) {
  // Forms supported (matching real git):
  //   git checkout <ref>                        — switch to <ref>
  //   git checkout -b <name>                    — create+switch
  //   git checkout -- <path>...                 — restore <path> from HEAD/index
  //   git checkout <ref> -- <path>...           — restore <path> from <ref>
  //   git checkout HEAD~1                       — detached HEAD
  var create = false, ref = null;
  var pathspecs = [];
  var sawDoubleDash = false;
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (!sawDoubleDash) {
      if (a === '-b' || a === '-B') { create = true; continue; }
      if (a === '--') { sawDoubleDash = true; continue; }
      if (a.charAt(0) === '-' && !/^-?\d+$/.test(a)) {
        return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
      }
      if (ref === null) { ref = a; continue; }
      // Bare token after ref but before `--` is treated as pathspec (real git
      // accepts this when the ref+pathspec form is unambiguous).
      pathspecs.push(a);
      sawDoubleDash = true;  // anything after this is also a pathspec
      continue;
    }
    pathspecs.push(a);
  }

  if (pathspecs.length > 0) {
    // File-restore mode. Resolve paths relative to cwd.
    var rels = [];
    for (var p = 0; p < pathspecs.length; p++) {
      var abs = _normalizePath(cwd || dir, dir, pathspecs[p]);
      var rel = _toRel(dir, abs);
      if (rel === null) {
        return _gitReply(id, '', "fatal: pathspec '" + pathspecs[p] + "' is outside the working tree\n", 1, []);
      }
      rels.push(rel);
    }
    _git.checkout({
      fs: fs, dir: dir, ref: ref || 'HEAD', force: true, filepaths: rels,
    }).then(function () {
      _gitReply(id, '', '', 0, rels);
    }).catch(function (err) {
      _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
    });
    return;
  }

  if (!ref) return _gitReply(id, '', "fatal: missing branch or commit name\n", 1, []);
  _doCheckout(id, dir, fs, ref, create);
}

function _doCheckout(id, dir, fs, name, create) {
  // Capture working-tree state pre-checkout so we can compute mutated paths.
  Promise.all([
    _snapshotPaths(dir),
    _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
    _git.currentBranch({ fs: fs, dir: dir }).catch(function () { return null; }),
  ]).then(function (r) {
    var preMap = r[0], oldOid = r[1], oldBranch = r[2] || 'HEAD';
    var doIt;
    if (create) {
      doIt = _git.branch({ fs: fs, dir: dir, ref: name, checkout: false })
        .then(function () { return _git.checkout({ fs: fs, dir: dir, ref: name, force: false }); });
    } else {
      doIt = _git.checkout({ fs: fs, dir: dir, ref: name, force: false });
    }
    return doIt.then(function () {
      return _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; })
        .then(function (newOid) {
          _appendReflog(dir, 'HEAD', oldOid, newOid,
            'checkout: moving from ' + oldBranch + ' to ' + name);
          return _snapshotPaths(dir);
        }).then(function (postMap) {
          var mutated = _diffMaps(preMap, postMap);
          var msg = create
            ? "Switched to a new branch '" + name + "'\n"
            : "Switched to branch '" + name + "'\n";
          _gitReply(id, msg, '', 0, mutated);
        });
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []);
  });
}

function _gitCmdMerge(id, args, dir, fs) {
  if (args.length === 0) return _gitReply(id, '', "merge: ref required\n", 1, []);
  var ref = args[0];
  _snapshotPaths(dir).then(function (preMap) {
    return _git.currentBranch({ fs: fs, dir: dir }).then(function (current) {
      return _git.merge({
        fs: fs, dir: dir, ours: current, theirs: ref,
        author: { name: 'Student', email: 'student@example.com' },
      }).then(function (result) {
        return _git.checkout({ fs: fs, dir: dir, ref: current, force: true }).then(function () {
          return Promise.all([_snapshotPaths(dir), _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; })]);
        }).then(function (post) {
          var postMap = post[0], newOid = post[1];
          var mutated = _diffMaps(preMap, postMap);
          var note = result && result.fastForward
            ? "Fast-forward\n"
            : (result && result.alreadyMerged ? "Already up to date.\n" : "Merge made by recursive strategy.\n");
          _appendReflog(dir, 'HEAD', null, newOid, 'merge ' + ref + ': ' + note.trim());
          if (current) _appendReflog(dir, 'refs/heads/' + current, null, newOid, 'merge ' + ref + ': ' + note.trim());
          _gitReply(id, note, '', 0, mutated);
        });
      });
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []);
  });
}

function _gitCmdRm(id, args, dir, fs, cwd) {
  // Real git rm semantics:
  //   git rm <file>               — remove from index AND working tree
  //   git rm --cached <file>      — remove from index only (keep file)
  //   git rm -r <dir>             — recursive (only allowed with -r for dirs)
  //   git rm -f <file>            — force (we treat as the default)
  var cached = false, recursive = false;
  var pathspecs = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '--cached') { cached = true; continue; }
    if (a === '-r' || a === '--recursive') { recursive = true; continue; }
    if (a === '-f' || a === '--force') { continue; }
    if (a === '--') continue;
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
    pathspecs.push(a);
  }
  if (pathspecs.length === 0) return _gitReply(id, '', "fatal: No pathspec was given.\n", 1, []);

  // Expand each pathspec: if it points at a directory, require -r and walk
  // children; if it's a file, just take that single rel path.
  function expand(ps) {
    var abs = _normalizePath(cwd || dir, dir, ps);
    var rel = _toRel(dir, abs);
    if (rel === null) {
      return Promise.reject(new Error("pathspec '" + ps + "' is outside the working tree"));
    }
    var st = null;
    try { st = pyodide.FS.stat(abs); } catch (e) { /* missing */ }
    if (st && (st.mode & 0o170000) === 0o040000) {
      if (!recursive) {
        return Promise.reject(new Error("not removing '" + rel + "' recursively without -r"));
      }
      return _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
        return matrix
          .map(function (row) { return row[0]; })
          .filter(function (fp) { return fp === rel || fp.indexOf(rel + '/') === 0; });
      });
    }
    return Promise.resolve([rel]);
  }

  Promise.all(pathspecs.map(expand)).then(function (lists) {
    var rels = [].concat.apply([], lists);
    var seen = {}; rels = rels.filter(function (r) { return seen[r] ? false : (seen[r] = true); });
    var ops = rels.map(function (rel) {
      var abs = dir + '/' + rel;
      if (!cached) {
        try { pyodide.FS.unlink(abs); } catch (e) { /* tolerate already-gone */ }
      }
      return _git.remove({ fs: fs, dir: dir, filepath: rel });
    });
    return Promise.all(ops).then(function () {
      var out = rels.map(function (r) { return "rm '" + r + "'\n"; }).join('');
      _gitReply(id, out, '', 0, cached ? [] : rels);
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

function _gitCmdMv(id, args, dir, fs, cwd) {
  if (args.length < 2) return _gitReply(id, '', "mv: source and destination required\n", 1, []);
  var src = args[0], dst = args[1];
  var srcAbs = _normalizePath(cwd, dir, src);
  var dstAbs = _normalizePath(cwd, dir, dst);
  var srcRel = _toRel(dir, srcAbs), dstRel = _toRel(dir, dstAbs);
  if (srcRel === null || dstRel === null) {
    return _gitReply(id, '', "mv: paths must be inside the working tree\n", 1, []);
  }
  try {
    var data = pyodide.FS.readFile(srcAbs);
    pyodide.FS.writeFile(dstAbs, data);
    pyodide.FS.unlink(srcAbs);
  } catch (err) {
    return _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []);
  }
  Promise.all([
    _git.remove({ fs: fs, dir: dir, filepath: srcRel }),
    _git.add({ fs: fs, dir: dir, filepath: dstRel }),
  ]).then(function () {
    _gitReply(id, '', '', 0, [srcRel, dstRel]);
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []);
  });
}

function _gitCmdReset(id, args, dir, fs, cwd) {
  // Supported forms (matching real git):
  //   git reset                        — unstage everything (path = '.', mixed)
  //   git reset <pathspec>...          — unstage paths only (mixed, no <ref>)
  //   git reset <ref>                  — mixed reset to <ref>: move branch +
  //                                      reset index, leave working tree
  //   git reset --soft <ref>           — only move branch tip
  //   git reset --mixed <ref>          — branch + index (default)
  //   git reset --hard <ref>           — branch + index + working tree
  // <ref> defaults to HEAD when only a mode flag is given.
  var mode = 'mixed', ref = null;
  var pathspecs = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '--soft')    { mode = 'soft';  continue; }
    if (a === '--mixed')   { mode = 'mixed'; continue; }
    if (a === '--hard')    { mode = 'hard';  continue; }
    if (a === '--')        { continue; }
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
    if (ref === null && _looksLikeRef(a)) { ref = a; continue; }
    pathspecs.push(a);
  }
  if (ref === null) ref = 'HEAD';

  // Path-only mode: `git reset [--] <paths>` — unstage matching paths from <ref>.
  if (pathspecs.length > 0) {
    var rels = [];
    for (var p = 0; p < pathspecs.length; p++) {
      var abs = _normalizePath(cwd || dir, dir, pathspecs[p]);
      var rel = _toRel(dir, abs);
      if (rel === null) {
        return _gitReply(id, '', "fatal: pathspec '" + pathspecs[p] + "' is outside the working tree\n", 1, []);
      }
      rels.push(rel);
    }
    Promise.all(rels.map(function (r) {
      return _git.resetIndex({ fs: fs, dir: dir, filepath: r, ref: ref });
    })).then(function () { _gitReply(id, '', '', 0, []); })
      .catch(function (err) { _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []); });
    return;
  }

  // Whole-repo reset: move current branch tip to <ref> and (depending on
  // mode) reset the index and/or working tree.
  Promise.all([
    _git.currentBranch({ fs: fs, dir: dir, fullname: true }).catch(function () { return null; }),
    _git.resolveRef({ fs: fs, dir: dir, ref: ref }).catch(function () { return null; }),
    _snapshotPaths(dir),
  ]).then(function (r) {
    var branchRef = r[0], targetOid = r[1], preMap = r[2];
    if (!targetOid) {
      return Promise.reject(new Error("ambiguous argument '" + ref + "': unknown revision"));
    }
    // 1. Move the current branch ref to point at targetOid (only if we're
    //    on a branch — detached HEAD just moves HEAD itself).
    var moveRef = branchRef
      ? _git.writeRef({ fs: fs, dir: dir, ref: branchRef, value: targetOid, force: true })
      : _git.writeRef({ fs: fs, dir: dir, ref: 'HEAD', value: targetOid, force: true });

    return moveRef.then(function () {
      if (mode === 'soft') return preMap;
      // mixed / hard: refresh index from new HEAD by checking out the tree.
      // For hard, force=true also overwrites the working tree. For mixed,
      // we want the working tree untouched; iso-git doesn't have an
      // index-only checkout, so we read the tree manually.
      if (mode === 'hard') {
        return _git.checkout({
          fs: fs, dir: dir, ref: branchRef ? branchRef.replace(/^refs\/heads\//, '') : targetOid,
          force: true,
        }).then(function () { return _snapshotPaths(dir); });
      }
      // mixed: walk the new HEAD's tree and rewrite each index entry without
      // touching the working tree. resetIndex does this per-path.
      return _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
        return Promise.all(matrix.map(function (row) {
          return _git.resetIndex({ fs: fs, dir: dir, filepath: row[0], ref: 'HEAD' });
        }));
      }).then(function () { return preMap; /* working tree unchanged */ });
    }).then(function (postMap) {
      var mutated = (mode === 'hard') ? _diffMaps(preMap, postMap) : [];
      var short = targetOid.substring(0, 7);
      _appendReflog(dir, 'HEAD', null, targetOid, 'reset: moving to ' + ref);
      if (branchRef) _appendReflog(dir, branchRef, null, targetOid, 'reset: moving to ' + ref);
      _gitReply(id, "HEAD is now at " + short + "\n", '', 0, mutated);
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

// Resolve a refish OR an abbreviated SHA to a full oid. iso-git's resolveRef
// only accepts full ref names and full oids; this helper layers in
// `git.expandOid` so users can pass `abc1234` or just `abc`.
function _resolveCommitish(fs, dir, ref) {
  return _git.resolveRef({ fs: fs, dir: dir, ref: ref }).catch(function (err) {
    // Maybe it's a short oid — try expandOid
    if (_git.expandOid) {
      return _git.expandOid({ fs: fs, dir: dir, oid: ref });
    }
    throw err;
  });
}

// Heuristic: distinguishes a refish argument from a pathspec when the user
// types `git reset <foo>` with no flags. A path always either contains '/'
// or matches an existing FS entry; a ref doesn't.
function _looksLikeRef(s) {
  if (!s) return false;
  if (s.indexOf('/') !== -1 && s.indexOf('refs/') !== 0) return false;
  // If a working-tree file exists with that name, treat as path.
  try { pyodide.FS.stat(_gitDir + '/' + s); return false; } catch (e) {}
  return true;
}

function _gitCmdRestore(id, args, dir, fs, cwd) {
  // Real git's `restore` behaviors:
  //   git restore <path>                  — restore working tree from index
  //                                         (drop unstaged changes, keep staged)
  //   git restore --staged <path>         — unstage; working tree untouched
  //   git restore -S -W <path>            — both (--staged + --worktree)
  //   git restore --source=<ref> <path>   — restore from <ref>
  //   git restore --source=<ref> -SW <p>  — restore working tree AND unstage
  //                                         from <ref>
  // Flags we recognise: --staged / -S, --worktree / -W, --source=<ref>.
  var staged = false, worktree = false, source = null;
  var pathspecs = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '--staged' || a === '-S') { staged = true; continue; }
    if (a === '--worktree' || a === '-W') { worktree = true; continue; }
    if (a.indexOf('--source=') === 0) { source = a.substring('--source='.length); continue; }
    if (a === '-s' || a === '--source') { source = args[i + 1]; i++; continue; }
    if (a === '--') continue;
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
    pathspecs.push(a);
  }
  if (pathspecs.length === 0) {
    return _gitReply(id, '',
      "fatal: you must specify path(s) to restore\n", 1, []);
  }
  // Default: restore working tree (matches real git when neither --staged nor
  // --worktree is given).
  if (!staged && !worktree) worktree = true;

  // Resolve all pathspecs. Reject any outside the worktree.
  var rels = [];
  for (var p = 0; p < pathspecs.length; p++) {
    var abs = _normalizePath(cwd, dir, pathspecs[p]);
    var rel = _toRel(dir, abs);
    if (rel === null) {
      return _gitReply(id, '', "fatal: pathspec '" + pathspecs[p] + "' is outside the working tree\n", 1, []);
    }
    rels.push(rel);
  }

  // Unstage step (if --staged): rewrite index entry for each path to match
  // the source ref (HEAD by default, or --source=<ref>). iso-git's
  // resetIndex always pulls from HEAD, so for --source we need a manual path.
  function doStaged() {
    if (!staged) return Promise.resolve();
    if (source && source !== 'HEAD') {
      // For arbitrary --source, repurpose index by reading the blob at <ref>
      // and re-adding. Simpler: temporarily checkout the file from <ref> into
      // a buffer, write to FS, add. We avoid that complexity by falling back
      // to resetIndex if the source resolves to the same oid as HEAD.
      return Promise.all(rels.map(function (rel) {
        return _git.resetIndex({ fs: fs, dir: dir, filepath: rel, ref: source });
      }));
    }
    return Promise.all(rels.map(function (rel) {
      return _git.resetIndex({ fs: fs, dir: dir, filepath: rel });
    }));
  }

  // Working-tree step (if --worktree): copy file content from source/index
  // into the working tree.
  function doWorktree() {
    if (!worktree) return Promise.resolve();
    var ref = source || 'HEAD';
    return _git.checkout({
      fs: fs, dir: dir, ref: ref, force: true, filepaths: rels,
    });
  }

  doStaged().then(doWorktree).then(function () {
    var mutated = worktree ? rels : [];
    _gitReply(id, '', '', 0, mutated);
  }).catch(function (err) {
    _gitReply(id, '', (/^fatal:/.test(err.message || '') ? '' : 'fatal: ') + (err.message || err) + '\n', 1, []);
  });
}

// ---- Path-snapshot helpers (drive `mutatedPaths` for Monaco refresh) -------

function _snapshotPaths(dir) {
  // Walk the working tree (skipping .git) and record file → contentHash.
  // Hash is just length+first16chars to detect changes cheaply; the main
  // thread only uses the result to compare pre/post mutation, never to
  // verify content.
  var map = {};
  function walk(absPath, relPath) {
    var stat;
    try { stat = pyodide.FS.stat(absPath); } catch (e) { return; }
    var IFMT = 0o170000;
    var isDir = (stat.mode & IFMT) === 0o040000;
    if (isDir) {
      if (relPath === '.git' || relPath.indexOf('.git/') === 0) return;
      var entries;
      try { entries = pyodide.FS.readdir(absPath); } catch (e) { return; }
      entries.forEach(function (n) {
        if (n === '.' || n === '..') return;
        var subAbs = (absPath === '/' ? '' : absPath) + '/' + n;
        var subRel = relPath ? relPath + '/' + n : n;
        walk(subAbs, subRel);
      });
    } else {
      try {
        var data = pyodide.FS.readFile(absPath, { encoding: 'utf8' });
        map[relPath] = data.length + ':' + data.substring(0, 24);
      } catch (e) { /* binary/unreadable — skip */ }
    }
  }
  walk(dir, '');
  return Promise.resolve(map);
}

function _diffMaps(pre, post) {
  var changed = {};
  Object.keys(post).forEach(function (k) {
    if (pre[k] !== post[k]) changed[k] = true;
  });
  Object.keys(pre).forEach(function (k) {
    if (!(k in post)) changed[k] = true;
  });
  return Object.keys(changed);
}

// ---- git tag ---------------------------------------------------------------

function _gitCmdTag(id, args, dir, fs) {
  // Forms:
  //   git tag                         — list lightweight tags
  //   git tag -l / --list             — same
  //   git tag <name> [<commit>]       — create lightweight tag at <commit> (or HEAD)
  //   git tag -a <name> -m <msg> [c]  — annotated tag (we treat same as lightweight + message)
  //   git tag -d <name>               — delete
  var del = false, list = false, annotated = false, message = null;
  var positional = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-d' || a === '--delete') { del = true; continue; }
    if (a === '-l' || a === '--list')   { list = true; continue; }
    if (a === '-a' || a === '--annotate') { annotated = true; continue; }
    if (a === '-m' || a === '--message') { message = args[i + 1] || ''; i++; continue; }
    if (a.indexOf('--message=') === 0) { message = a.substring('--message='.length); annotated = true; continue; }
    if (a === '--') continue;
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
    positional.push(a);
  }

  if (list || (positional.length === 0 && !del)) {
    var listFn = _git.listTags ? _git.listTags({ fs: fs, dir: dir }) : Promise.resolve([]);
    listFn.then(function (tags) {
      _gitReply(id, (tags || []).join('\n') + ((tags && tags.length) ? '\n' : ''), '', 0, []);
    }).catch(function (err) { _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []); });
    return;
  }

  if (del) {
    var name = positional[0];
    if (!name) return _gitReply(id, '', "fatal: tag name required\n", 1, []);
    var delFn = _git.deleteTag
      ? _git.deleteTag({ fs: fs, dir: dir, ref: name })
      : _git.writeRef({ fs: fs, dir: dir, ref: 'refs/tags/' + name, value: '0000000000000000000000000000000000000000', force: true })
          .then(function () {
            try { pyodide.FS.unlink(dir + '/.git/refs/tags/' + name); } catch (e) {}
          });
    delFn.then(function () { _gitReply(id, "Deleted tag '" + name + "'\n", '', 0, []); })
         .catch(function (err) { _gitReply(id, '', 'error: ' + (err.message || err) + '\n', 1, []); });
    return;
  }

  // Create
  var tagName = positional[0];
  var ref = positional[1] || 'HEAD';
  if (!tagName) return _gitReply(id, '', "fatal: tag name required\n", 1, []);

  _git.resolveRef({ fs: fs, dir: dir, ref: ref }).then(function (oid) {
    if (annotated && _git.annotatedTag) {
      return _git.annotatedTag({
        fs: fs, dir: dir, ref: tagName, object: oid,
        message: message || tagName,
        tagger: { name: 'Student', email: 'student@example.com' },
      });
    }
    return _git.tag
      ? _git.tag({ fs: fs, dir: dir, ref: tagName, object: oid, force: false })
      : _git.writeRef({ fs: fs, dir: dir, ref: 'refs/tags/' + tagName, value: oid, force: false });
  }).then(function () { _gitReply(id, '', '', 0, []); })
    .catch(function (err) { _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []); });
}

// ---- git diff --------------------------------------------------------------

function _gitCmdDiff(id, args, dir, fs, cwd) {
  // Supported forms:
  //   git diff                — workdir vs index (unstaged changes)
  //   git diff --staged       — index vs HEAD (staged changes)
  //   git diff --cached       — alias for --staged
  //   git diff <ref>          — workdir vs <ref>
  //   git diff <a> <b>        — <a> vs <b>
  //   git diff -- <path>...   — limit to paths
  var staged = false;
  var refs = [];
  var paths = [];
  var sawDD = false;
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (!sawDD) {
      if (a === '--') { sawDD = true; continue; }
      if (a === '--staged' || a === '--cached') { staged = true; continue; }
      if (a === '--name-only' || a === '--stat') { continue; /* accepted, ignored */ }
      if (a.charAt(0) === '-') {
        return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
      }
      refs.push(a);
    } else {
      paths.push(a);
    }
  }

  // Resolve which two trees we compare. Each tree is identified by:
  //   - 'WORKDIR' — read from FS
  //   - 'STAGE'   — index
  //   - oid       — committed tree
  var leftSrc, rightSrc;
  function resolveOid(ref) {
    return _git.resolveRef({ fs: fs, dir: dir, ref: ref });
  }
  var setup;
  if (refs.length === 0) {
    if (staged) {
      // index vs HEAD
      setup = resolveOid('HEAD').then(function (oid) {
        leftSrc = { kind: 'commit', oid: oid };
        rightSrc = { kind: 'stage' };
      });
    } else {
      // workdir vs index
      leftSrc = { kind: 'stage' };
      rightSrc = { kind: 'workdir' };
      setup = Promise.resolve();
    }
  } else if (refs.length === 1) {
    setup = resolveOid(refs[0]).then(function (oid) {
      leftSrc = { kind: 'commit', oid: oid };
      rightSrc = staged ? { kind: 'stage' } : { kind: 'workdir' };
    });
  } else {
    setup = Promise.all([resolveOid(refs[0]), resolveOid(refs[1])]).then(function (r) {
      leftSrc = { kind: 'commit', oid: r[0] };
      rightSrc = { kind: 'commit', oid: r[1] };
    });
  }

  setup.then(function () {
    return Promise.all([_collectFiles(dir, fs, leftSrc), _collectFiles(dir, fs, rightSrc)]);
  }).then(function (sides) {
    var left = sides[0], right = sides[1];
    var pathFilter = null;
    if (paths.length) {
      pathFilter = {};
      paths.forEach(function (p) {
        var abs = _normalizePath(cwd || dir, dir, p);
        var rel = _toRel(dir, abs);
        if (rel) pathFilter[rel] = true;
      });
    }
    var allPaths = {};
    Object.keys(left).forEach(function (k) { if (!pathFilter || pathFilter[k]) allPaths[k] = true; });
    Object.keys(right).forEach(function (k) { if (!pathFilter || pathFilter[k]) allPaths[k] = true; });

    var out = '';
    var sortedPaths = Object.keys(allPaths).sort();
    var CYAN = '\x1b[36m', BOLD = '\x1b[1m', GREEN = '\x1b[32m', RED = '\x1b[31m', RESET = '\x1b[m';
    sortedPaths.forEach(function (p) {
      var l = left[p], r = right[p];
      if (l === undefined && r === undefined) return;
      if (l === r) return;  // identical contents
      out += BOLD + 'diff --git a/' + p + ' b/' + p + RESET + '\n';
      if (l === undefined) {
        out += BOLD + 'new file mode 100644' + RESET + '\n';
        out += BOLD + '--- /dev/null' + RESET + '\n';
        out += BOLD + '+++ b/' + p + RESET + '\n';
      } else if (r === undefined) {
        out += BOLD + 'deleted file mode 100644' + RESET + '\n';
        out += BOLD + '--- a/' + p + RESET + '\n';
        out += BOLD + '+++ /dev/null' + RESET + '\n';
      } else {
        out += BOLD + '--- a/' + p + RESET + '\n';
        out += BOLD + '+++ b/' + p + RESET + '\n';
      }
      out += _formatHunks(l || '', r || '', GREEN, RED, CYAN, RESET);
    });
    if (out === '') {
      _gitReply(id, '', '', 0, []);
    } else {
      _gitReply(id, out, '', 0, []);
    }
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

// Read every file's content into {path: string, ...} for the given source.
function _collectFiles(dir, fs, src) {
  var out = {};
  if (src.kind === 'workdir') {
    function walk(absPath, relPath) {
      var st;
      try { st = pyodide.FS.stat(absPath); } catch (e) { return; }
      if ((st.mode & 0o170000) === 0o040000) {
        if (relPath === '.git' || relPath.indexOf('.git/') === 0) return;
        var entries; try { entries = pyodide.FS.readdir(absPath); } catch (e) { return; }
        entries.forEach(function (n) {
          if (n === '.' || n === '..') return;
          walk((absPath === '/' ? '' : absPath) + '/' + n, relPath ? relPath + '/' + n : n);
        });
      } else {
        try { out[relPath] = pyodide.FS.readFile(absPath, { encoding: 'utf8' }); }
        catch (e) { /* skip binary */ }
      }
    }
    walk(dir, '');
    return Promise.resolve(out);
  }
  if (src.kind === 'stage') {
    // Use statusMatrix to get paths, then readBlob for each STAGE entry.
    return _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
      return Promise.all(matrix.map(function (row) {
        var fp = row[0], H = row[1], W = row[2], S = row[3];
        if (S === 0) return null; // not in index
        // S === 1 means index matches HEAD; S === 2 matches workdir; S === 3 differs from both
        if (S === 1) {
          return _git.readBlob({ fs: fs, dir: dir, oid: 'HEAD', filepath: fp })
            .then(function (b) { out[fp] = new TextDecoder().decode(b.blob); }).catch(function () {});
        }
        // For S === 2 or 3, the index tree differs from HEAD. iso-git lacks a
        // direct read-from-index API across versions; fall back to workdir for
        // S === 2 (matches workdir) and to a full-staged-content read via
        // walk(STAGE) for S === 3.
        if (S === 2) {
          try { out[fp] = pyodide.FS.readFile(dir + '/' + fp, { encoding: 'utf8' }); } catch (e) {}
          return null;
        }
        // S === 3: we don't have a great primitive — best-effort is to use
        // the STAGE walker via git.walk.
        return null;
      })).then(function () { return out; });
    });
  }
  // commit
  return _git.readTree({ fs: fs, dir: dir, oid: src.oid }).then(function () {
    // Walk the tree recursively reading every blob.
    return _walkCommitTree(fs, dir, src.oid, out, '');
  }).then(function () { return out; });
}

function _walkCommitTree(fs, dir, oid, out, prefix) {
  return _git.readTree({ fs: fs, dir: dir, oid: oid }).then(function (treeObj) {
    var entries = treeObj.tree || [];
    return Promise.all(entries.map(function (e) {
      var p = prefix ? (prefix + '/' + e.path) : e.path;
      if (e.type === 'blob') {
        return _git.readBlob({ fs: fs, dir: dir, oid: e.oid }).then(function (b) {
          try { out[p] = new TextDecoder().decode(b.blob); } catch (err) { /* binary */ }
        });
      }
      if (e.type === 'tree') {
        return _walkCommitTree(fs, dir, e.oid, out, p);
      }
      return null;
    }));
  });
}

// Minimal unified-diff hunk formatter. Single hunk per file, full file
// context — adequate for tutorial-sized files. For larger files this would
// chunk into proper hunks, but that's out of scope.
function _formatHunks(a, b, GREEN, RED, CYAN, RESET) {
  var aLines = a.split('\n'); if (aLines.length && aLines[aLines.length - 1] === '') aLines.pop();
  var bLines = b.split('\n'); if (bLines.length && bLines[bLines.length - 1] === '') bLines.pop();
  // Compute LCS-based diff (Myers-light: longest common subsequence via DP).
  var n = aLines.length, m = bLines.length;
  var dp = [];
  for (var i = 0; i <= n; i++) { dp.push(new Int32Array(m + 1)); }
  for (var i2 = 1; i2 <= n; i2++) {
    for (var j = 1; j <= m; j++) {
      dp[i2][j] = aLines[i2 - 1] === bLines[j - 1]
        ? dp[i2 - 1][j - 1] + 1
        : Math.max(dp[i2 - 1][j], dp[i2][j - 1]);
    }
  }
  var ops = [];
  var i3 = n, j2 = m;
  while (i3 > 0 && j2 > 0) {
    if (aLines[i3 - 1] === bLines[j2 - 1]) { ops.unshift({ op: ' ', line: aLines[i3 - 1] }); i3--; j2--; }
    else if (dp[i3 - 1][j2] >= dp[i3][j2 - 1]) { ops.unshift({ op: '-', line: aLines[i3 - 1] }); i3--; }
    else { ops.unshift({ op: '+', line: bLines[j2 - 1] }); j2--; }
  }
  while (i3 > 0) { ops.unshift({ op: '-', line: aLines[i3 - 1] }); i3--; }
  while (j2 > 0) { ops.unshift({ op: '+', line: bLines[j2 - 1] }); j2--; }

  // Header
  var out = CYAN + '@@ -1,' + n + ' +1,' + m + ' @@' + RESET + '\n';
  ops.forEach(function (o) {
    if (o.op === '+') out += GREEN + '+' + o.line + RESET + '\n';
    else if (o.op === '-') out += RED + '-' + o.line + RESET + '\n';
    else out += ' ' + o.line + '\n';
  });
  return out;
}

// ---- git show --------------------------------------------------------------

function _gitCmdShow(id, args, dir, fs) {
  // Forms:
  //   git show                — show HEAD
  //   git show <ref>          — show that commit
  // Output: commit metadata + diff against parent (or vs empty for root).
  var ref = args[0] || 'HEAD';
  if (args.length > 0 && args[0].charAt(0) === '-') {
    return _gitReply(id, '', "error: unknown option `" + args[0].replace(/^-+/, '') + "'\n", 1, []);
  }
  _resolveCommitish(fs, dir, ref).then(function (oid) {
    return _git.readCommit({ fs: fs, dir: dir, oid: oid }).then(function (c) {
      var YELLOW = '\x1b[33m', RESET = '\x1b[m';
      var out = YELLOW + 'commit ' + oid + RESET + '\n';
      if (c.commit.parent && c.commit.parent.length > 1) {
        out += 'Merge: ' + c.commit.parent.map(function (p) { return p.substring(0, 7); }).join(' ') + '\n';
      }
      if (c.commit.author) {
        out += 'Author: ' + c.commit.author.name + ' <' + c.commit.author.email + '>\n';
        if (c.commit.author.timestamp) {
          out += 'Date:   ' + new Date(c.commit.author.timestamp * 1000).toString() + '\n';
        }
      }
      out += '\n    ' + (c.commit.message || '').replace(/\n/g, '\n    ') + '\n\n';

      // Diff against first parent (or empty for root)
      var parentOid = (c.commit.parent && c.commit.parent[0]) || null;
      var rightFiles = {};
      var leftFiles = {};
      var leftPromise = parentOid
        ? _walkCommitTree(fs, dir, parentOid, leftFiles, '')
        : Promise.resolve();
      return leftPromise
        .then(function () { return _walkCommitTree(fs, dir, oid, rightFiles, ''); })
        .then(function () {
          var allPaths = {};
          Object.keys(leftFiles).forEach(function (k) { allPaths[k] = true; });
          Object.keys(rightFiles).forEach(function (k) { allPaths[k] = true; });
          var sorted = Object.keys(allPaths).sort();
          var BOLD = '\x1b[1m', GREEN = '\x1b[32m', RED = '\x1b[31m', CYAN = '\x1b[36m';
          sorted.forEach(function (p) {
            var l = leftFiles[p], r = rightFiles[p];
            if (l === r) return;
            out += BOLD + 'diff --git a/' + p + ' b/' + p + RESET + '\n';
            if (l === undefined) out += BOLD + 'new file mode 100644' + RESET + '\n' + BOLD + '--- /dev/null' + RESET + '\n' + BOLD + '+++ b/' + p + RESET + '\n';
            else if (r === undefined) out += BOLD + 'deleted file mode 100644' + RESET + '\n' + BOLD + '--- a/' + p + RESET + '\n' + BOLD + '+++ /dev/null' + RESET + '\n';
            else out += BOLD + '--- a/' + p + RESET + '\n' + BOLD + '+++ b/' + p + RESET + '\n';
            out += _formatHunks(l || '', r || '', GREEN, RED, CYAN, RESET);
          });
          _gitReply(id, out, '', 0, []);
        });
    });
  }).catch(function (err) {
    _gitReply(id, '', "fatal: bad revision '" + ref + "'\n", 1, []);
  });
}

// ---- git stash -------------------------------------------------------------
//
// Tutorial-grade implementation: each stash is a real iso-git commit on
// `refs/stash` whose tree captures the working tree state at the time of
// `git stash push`. Older stashes survive as parents of newer ones, so the
// stash log becomes a linear chain of commits walkable via `git.log`.
// `git stash pop` restores files from the stash tree, then advances
// refs/stash to the previous parent (or deletes the ref when empty).

function _gitCmdStash(id, args, dir, fs) {
  var sub = args[0] || 'push';
  var rest = args.slice(1);
  if (sub === 'push' || sub === 'save') return _stashPush(id, rest, dir, fs);
  if (sub === 'pop')                    return _stashPop(id, rest, dir, fs);
  if (sub === 'apply')                  return _stashApply(id, rest, dir, fs, false);
  if (sub === 'drop')                   return _stashDrop(id, rest, dir, fs);
  if (sub === 'list')                   return _stashList(id, rest, dir, fs);
  if (sub === 'show')                   return _stashShow(id, rest, dir, fs);
  if (sub === 'clear')                  return _stashClear(id, rest, dir, fs);
  // Bare `git stash` is shorthand for `git stash push`.
  if (!sub || sub.charAt(0) === '-')    return _stashPush(id, args, dir, fs);
  return _gitReply(id, '', "git stash: unknown subcommand '" + sub + "'\n", 1, []);
}

// Stash implementation backed by a JSON file at `.git/STASH_LOG.json`.
// Each entry is {message, branch, headOid, files: {path: content, ...}}.
// Newest stash is index 0 (matches `stash@{0}` semantics). We avoid iso-git's
// writeCommit/writeTree primitives because their cross-version API surface
// for synthesizing commits without a normal ref-update is brittle.

var STASH_LOG_PATH = '/.git/STASH_LOG.json';

function _stashRead(dir) {
  try {
    var t = pyodide.FS.readFile(dir + STASH_LOG_PATH, { encoding: 'utf8' });
    return JSON.parse(t);
  } catch (e) { return []; }
}
function _stashWrite(dir, entries) {
  pyodide.FS.writeFile(dir + STASH_LOG_PATH, JSON.stringify(entries), { encoding: 'utf8' });
}

// Snapshot every file in the workdir (excluding .git/) as a {path: content}
// map. Used by `git stash push` to capture the working tree.
function _snapshotWorkdir(dir) {
  var files = {};
  function walk(absPath, relPath) {
    var st;
    try { st = pyodide.FS.stat(absPath); } catch (e) { return; }
    if ((st.mode & 0o170000) === 0o040000) {
      if (relPath === '.git' || relPath.indexOf('.git/') === 0) return;
      var entries; try { entries = pyodide.FS.readdir(absPath); } catch (e) { return; }
      entries.forEach(function (n) {
        if (n === '.' || n === '..') return;
        walk((absPath === '/' ? '' : absPath) + '/' + n, relPath ? relPath + '/' + n : n);
      });
    } else {
      try { files[relPath] = pyodide.FS.readFile(absPath, { encoding: 'utf8' }); }
      catch (e) { /* binary — skip */ }
    }
  }
  walk(dir, '');
  return files;
}

function _stashPush(id, args, dir, fs) {
  var message = null;
  for (var i = 0; i < args.length; i++) {
    if (args[i] === '-m' || args[i] === '--message') { message = args[i + 1] || ''; i++; }
    else if (args[i].indexOf('-m') === 0) { message = args[i].substring(2); }
  }
  Promise.all([
    _git.statusMatrix({ fs: fs, dir: dir }),
    _git.currentBranch({ fs: fs, dir: dir }).catch(function () { return null; }),
    _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
  ]).then(function (r) {
    var matrix = r[0], branch = r[1] || 'HEAD', headOid = r[2];
    var hasChanges = matrix.some(function (row) {
      return row[1] !== row[2] || row[1] !== row[3];
    });
    if (!hasChanges) {
      _gitReply(id, "No local changes to save\n", '', 0, []);
      return;
    }
    if (!headOid) {
      _gitReply(id, '', "fatal: You do not have the initial commit yet\n", 1, []);
      return;
    }
    var entries = _stashRead(dir);
    var entry = {
      message: message || ('WIP on ' + branch + ': ' + headOid.substring(0, 7)),
      branch: branch, headOid: headOid,
      files: _snapshotWorkdir(dir),
      timestamp: Math.floor(Date.now() / 1000),
    };
    entries.unshift(entry);  // newest at index 0
    _stashWrite(dir, entries);
    // Restore working tree to HEAD: walk the HEAD tree, overwrite each file
    // with its committed content, and unlink any file present in workdir but
    // absent from HEAD. iso-git's `checkout({ref: <currentBranch>})` short-
    // circuits when HEAD already points at the ref, so we apply the tree
    // explicitly.
    return _snapshotPaths(dir).then(function (preMap) {
      var headFiles = {};
      return _walkCommitTree(fs, dir, headOid, headFiles, '').then(function () {
        var preFiles = _snapshotWorkdir(dir);
        // Overwrite tracked files with HEAD content.
        Object.keys(headFiles).forEach(function (p) {
          var sub = p.indexOf('/') !== -1 ? p.substring(0, p.lastIndexOf('/')) : '';
          if (sub) {
            var parts = sub.split('/'); var cur = dir;
            parts.forEach(function (s) { cur += '/' + s; try { pyodide.FS.mkdir(cur); } catch (e) {} });
          }
          pyodide.FS.writeFile(dir + '/' + p, headFiles[p], { encoding: 'utf8' });
        });
        // Remove any workdir file that isn't in HEAD (untracked + tracked-deleted).
        Object.keys(preFiles).forEach(function (p) {
          if (!(p in headFiles)) {
            try { pyodide.FS.unlink(dir + '/' + p); } catch (e) {}
          }
        });
        // Reset index to match HEAD.
        return _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
          return Promise.all(matrix.map(function (row) {
            return _git.resetIndex({ fs: fs, dir: dir, filepath: row[0] });
          }));
        });
      }).then(function () { return _snapshotPaths(dir); }).then(function (postMap) {
        _gitReply(id,
          "Saved working directory and index state " + entry.message + "\n",
          '', 0, _diffMaps(preMap, postMap));
      });
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

function _stashList(id, args, dir, fs) {
  var entries = _stashRead(dir);
  var out = entries.map(function (e, i) {
    return 'stash@{' + i + '}: ' + e.message;
  }).join('\n');
  _gitReply(id, out + (out ? '\n' : ''), '', 0, []);
}

// Resolve a stash selector ("stash@{N}", "N", or empty for top) to an index.
function _stashIndex(args, entries) {
  var sel = args[0];
  if (!sel) return 0;
  var m = sel.match(/^stash@\{(\d+)\}$/);
  if (m) return parseInt(m[1], 10);
  if (/^\d+$/.test(sel)) return parseInt(sel, 10);
  return 0;
}

function _stashApply(id, args, dir, fs, andDrop) {
  var entries = _stashRead(dir);
  if (entries.length === 0) return _gitReply(id, '', "No stash entries found.\n", 1, []);
  var idx = _stashIndex(args, entries);
  if (idx < 0 || idx >= entries.length) return _gitReply(id, '', "fatal: stash entry not found\n", 1, []);
  var entry = entries[idx];
  _snapshotPaths(dir).then(function (preMap) {
    // Apply stashed files onto the working tree. We don't auto-stage — match
    // real git, which restores to working tree by default.
    Object.keys(entry.files).forEach(function (p) {
      var sub = p.indexOf('/') !== -1 ? p.substring(0, p.lastIndexOf('/')) : '';
      if (sub) {
        var parts = sub.split('/'); var cur = dir;
        parts.forEach(function (s) { cur += '/' + s; try { pyodide.FS.mkdir(cur); } catch (e) {} });
      }
      pyodide.FS.writeFile(dir + '/' + p, entry.files[p], { encoding: 'utf8' });
    });
    if (andDrop) {
      entries.splice(idx, 1);
      _stashWrite(dir, entries);
    }
    return _snapshotPaths(dir).then(function (postMap) {
      _gitReply(id,
        andDrop
          ? "Dropped stash@{" + idx + "} (" + entry.message + ")\n"
          : "Applied stash@{" + idx + "}\n",
        '', 0, _diffMaps(preMap, postMap));
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

function _stashPop(id, args, dir, fs) { return _stashApply(id, args, dir, fs, true); }

function _stashDrop(id, args, dir, fs) {
  var entries = _stashRead(dir);
  if (entries.length === 0) return _gitReply(id, '', "No stash entries found.\n", 1, []);
  var idx = _stashIndex(args, entries);
  if (idx < 0 || idx >= entries.length) return _gitReply(id, '', "fatal: stash entry not found\n", 1, []);
  var dropped = entries.splice(idx, 1)[0];
  _stashWrite(dir, entries);
  _gitReply(id, "Dropped stash@{" + idx + "} (" + dropped.message + ")\n", '', 0, []);
}

function _stashShow(id, args, dir, fs) {
  var entries = _stashRead(dir);
  if (entries.length === 0) return _gitReply(id, '', "No stash entries found.\n", 1, []);
  var idx = _stashIndex(args, entries);
  var entry = entries[idx];
  if (!entry) return _gitReply(id, '', "fatal: stash entry not found\n", 1, []);
  var headOid = entry.headOid;
  var leftFiles = {}, rightFiles = entry.files;
  _walkCommitTree(fs, dir, headOid, leftFiles, '').then(function () {
    var allPaths = {};
    Object.keys(leftFiles).forEach(function (k) { allPaths[k] = true; });
    Object.keys(rightFiles).forEach(function (k) { allPaths[k] = true; });
    var BOLD = '\x1b[1m', GREEN = '\x1b[32m', RED = '\x1b[31m', CYAN = '\x1b[36m', RESET = '\x1b[m';
    var out = '';
    Object.keys(allPaths).sort().forEach(function (p) {
      var l = leftFiles[p], r = rightFiles[p];
      if (l === r) return;
      out += BOLD + 'diff --git a/' + p + ' b/' + p + RESET + '\n';
      if (l === undefined) out += BOLD + '--- /dev/null' + RESET + '\n+++ b/' + p + '\n';
      else if (r === undefined) out += BOLD + '--- a/' + p + RESET + '\n+++ /dev/null\n';
      else out += BOLD + '--- a/' + p + RESET + '\n' + BOLD + '+++ b/' + p + RESET + '\n';
      out += _formatHunks(l || '', r || '', GREEN, RED, CYAN, RESET);
    });
    _gitReply(id, out, '', 0, []);
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

function _stashClear(id, args, dir, fs) {
  try { pyodide.FS.unlink(dir + STASH_LOG_PATH); } catch (e) {}
  _gitReply(id, '', '', 0, []);
}

// ---- git cherry-pick -------------------------------------------------------
//
// Apply the changes introduced by <commit> on top of the current branch as a
// new commit. iso-git lacks a direct `cherry-pick` so we re-create the diff
// by reading the committed tree, copying paths into the workdir+index, and
// committing with the original message.

function _gitCmdCherryPick(id, args, dir, fs) {
  var noCommit = args.indexOf('-n') !== -1 || args.indexOf('--no-commit') !== -1;
  var refs = args.filter(function (a) { return a.charAt(0) !== '-'; });
  if (refs.length === 0) return _gitReply(id, '', "fatal: cherry-pick requires a commit\n", 1, []);

  var ref = refs[0];
  Promise.all([
    _resolveCommitish(fs, dir, ref),
    _git.currentBranch({ fs: fs, dir: dir }).catch(function () { return null; }),
  ]).then(function (r) {
    var oid = r[0], branch = r[1];
    return _git.readCommit({ fs: fs, dir: dir, oid: oid }).then(function (c) {
      var parentOid = (c.commit.parent || [])[0];
      var parentFiles = {};
      var sourceFiles = {};
      var collectParent = parentOid
        ? _walkCommitTree(fs, dir, parentOid, parentFiles, '')
        : Promise.resolve();
      return collectParent
        .then(function () { return _walkCommitTree(fs, dir, oid, sourceFiles, ''); })
        .then(function () {
          // For each path that differs between parent and source, apply the
          // change to the workdir.
          return _snapshotPaths(dir).then(function (preMap) {
            var allPaths = {};
            Object.keys(parentFiles).forEach(function (k) { allPaths[k] = true; });
            Object.keys(sourceFiles).forEach(function (k) { allPaths[k] = true; });
            var changed = [];
            Object.keys(allPaths).forEach(function (p) {
              var pa = parentFiles[p], so = sourceFiles[p];
              if (pa === so) return;
              if (so === undefined) {
                // file was deleted in source — delete in workdir
                try { pyodide.FS.unlink(dir + '/' + p); } catch (e) {}
              } else {
                // create or overwrite
                var subdir = p.indexOf('/') !== -1 ? p.substring(0, p.lastIndexOf('/')) : '';
                if (subdir) {
                  var parts = subdir.split('/'); var cur = dir;
                  parts.forEach(function (s) { cur += '/' + s; try { pyodide.FS.mkdir(cur); } catch (e) {} });
                }
                pyodide.FS.writeFile(dir + '/' + p, so, { encoding: 'utf8' });
              }
              changed.push(p);
            });
            // Stage the changes
            return Promise.all(changed.map(function (p) {
              var abs = dir + '/' + p;
              var exists = true;
              try { pyodide.FS.stat(abs); } catch (e) { exists = false; }
              return exists ? _git.add({ fs: fs, dir: dir, filepath: p })
                            : _git.remove({ fs: fs, dir: dir, filepath: p });
            })).then(function () {
              if (noCommit) return null;
              return _git.commit({
                fs: fs, dir: dir,
                message: c.commit.message || ('cherry-pick of ' + oid.substring(0, 7)),
                author: c.commit.author,
              });
            }).then(function (newOid) {
              return _snapshotPaths(dir).then(function (postMap) {
                var msg = newOid
                  ? "[" + (branch || 'HEAD') + " " + newOid.substring(0, 7) + "] " +
                    (c.commit.message || '').split('\n')[0] + "\n"
                  : "Changes applied; commit deferred (-n).\n";
                _gitReply(id, msg, '', 0, _diffMaps(preMap, postMap));
              });
            });
          });
        });
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

// ---- git revert ------------------------------------------------------------
//
// Inverse of cherry-pick: apply the REVERSE diff of <commit> (parent vs
// commit, swapped) on top of HEAD as a new commit.

function _gitCmdRevert(id, args, dir, fs) {
  var noCommit = args.indexOf('-n') !== -1 || args.indexOf('--no-commit') !== -1;
  var refs = args.filter(function (a) { return a.charAt(0) !== '-'; });
  if (refs.length === 0) return _gitReply(id, '', "fatal: revert requires a commit\n", 1, []);

  var ref = refs[0];
  Promise.all([
    _resolveCommitish(fs, dir, ref),
    _git.currentBranch({ fs: fs, dir: dir }).catch(function () { return null; }),
  ]).then(function (r) {
    var oid = r[0], branch = r[1];
    return _git.readCommit({ fs: fs, dir: dir, oid: oid }).then(function (c) {
      var parentOid = (c.commit.parent || [])[0];
      var parentFiles = {}, sourceFiles = {};
      var collectParent = parentOid
        ? _walkCommitTree(fs, dir, parentOid, parentFiles, '')
        : Promise.resolve();
      return collectParent
        .then(function () { return _walkCommitTree(fs, dir, oid, sourceFiles, ''); })
        .then(function () {
          return _snapshotPaths(dir).then(function (preMap) {
            // REVERSE: apply parent's content where source differs from parent.
            var allPaths = {};
            Object.keys(parentFiles).forEach(function (k) { allPaths[k] = true; });
            Object.keys(sourceFiles).forEach(function (k) { allPaths[k] = true; });
            var changed = [];
            Object.keys(allPaths).forEach(function (p) {
              var pa = parentFiles[p], so = sourceFiles[p];
              if (pa === so) return;
              if (pa === undefined) {
                try { pyodide.FS.unlink(dir + '/' + p); } catch (e) {}
              } else {
                var subdir = p.indexOf('/') !== -1 ? p.substring(0, p.lastIndexOf('/')) : '';
                if (subdir) {
                  var parts = subdir.split('/'); var cur = dir;
                  parts.forEach(function (s) { cur += '/' + s; try { pyodide.FS.mkdir(cur); } catch (e) {} });
                }
                pyodide.FS.writeFile(dir + '/' + p, pa, { encoding: 'utf8' });
              }
              changed.push(p);
            });
            return Promise.all(changed.map(function (p) {
              var abs = dir + '/' + p;
              var exists = true;
              try { pyodide.FS.stat(abs); } catch (e) { exists = false; }
              return exists ? _git.add({ fs: fs, dir: dir, filepath: p })
                            : _git.remove({ fs: fs, dir: dir, filepath: p });
            })).then(function () {
              if (noCommit) return null;
              var subj = (c.commit.message || '').split('\n')[0];
              return _git.commit({
                fs: fs, dir: dir,
                message: 'Revert "' + subj + '"\n\nThis reverts commit ' + oid + '.\n',
              });
            }).then(function (newOid) {
              return _snapshotPaths(dir).then(function (postMap) {
                var msg = newOid
                  ? "[" + (branch || 'HEAD') + " " + newOid.substring(0, 7) + "] Revert \"" +
                    (c.commit.message || '').split('\n')[0] + "\"\n"
                  : "Changes applied; commit deferred (-n).\n";
                _gitReply(id, msg, '', 0, _diffMaps(preMap, postMap));
              });
            });
          });
        });
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

// ---- git bisect ------------------------------------------------------------
//
// Workflow command. iso-git has no native bisect, so we implement the binary
// search ourselves. State lives in `.git/BISECT_STATE.json`:
//   { good: [oid...], bad: oid|null, skip: [oid...], original: 'branch-name'|oid }
// Each `good`/`bad` move recomputes the midpoint commit between the latest
// known-bad and any known-good ancestor, then checks it out.

var BISECT_STATE_PATH = '/.git/BISECT_STATE.json';

function _bisectReadState(dir) {
  try {
    var t = pyodide.FS.readFile(dir + BISECT_STATE_PATH, { encoding: 'utf8' });
    return JSON.parse(t);
  } catch (e) { return null; }
}
function _bisectWriteState(dir, st) {
  pyodide.FS.writeFile(dir + BISECT_STATE_PATH, JSON.stringify(st), { encoding: 'utf8' });
}
function _bisectClearState(dir) {
  try { pyodide.FS.unlink(dir + BISECT_STATE_PATH); } catch (e) {}
}

// Walk parents of `from` (depth-first) until we hit one of `untils` (or no
// more parents). Returns the chain INCLUDING `from` and EXCLUDING the until.
function _ancestryChain(dir, fs, from, untils) {
  var stop = {}; (untils || []).forEach(function (o) { stop[o] = true; });
  var chain = [];
  var seen = {};
  function step(oid) {
    if (!oid || seen[oid] || stop[oid]) return Promise.resolve();
    seen[oid] = true;
    return _git.readCommit({ fs: fs, dir: dir, oid: oid }).then(function (c) {
      chain.push(oid);
      var parents = c.commit.parent || [];
      return parents.length ? step(parents[0]) : Promise.resolve();
    }).catch(function () { return null; });
  }
  return step(from).then(function () { return chain; });
}

function _bisectCheckoutMid(dir, fs, st) {
  // Candidates: ancestors of `bad` that are NOT the `bad` itself, and that
  // are descendants of any `good` (i.e. excluded if reachable from a good).
  if (!st.bad) return Promise.resolve(null);
  return _ancestryChain(dir, fs, st.bad, st.good).then(function (chain) {
    // Drop `bad` itself (we already know it's bad) and `skip`s.
    var candidates = chain.filter(function (o) {
      return o !== st.bad && (st.skip || []).indexOf(o) === -1;
    });
    if (candidates.length === 0) return null;
    var mid = candidates[Math.floor(candidates.length / 2)];
    return _git.checkout({ fs: fs, dir: dir, ref: mid, force: true })
      .then(function () { return { oid: mid, remaining: candidates.length }; });
  });
}

function _gitCmdBisect(id, args, dir, fs) {
  var sub = args[0];
  var rest = args.slice(1);
  if (sub === 'start')   return _bisectStart(id, rest, dir, fs);
  if (sub === 'good')    return _bisectMark(id, rest, dir, fs, 'good');
  if (sub === 'bad')     return _bisectMark(id, rest, dir, fs, 'bad');
  if (sub === 'new')     return _bisectMark(id, rest, dir, fs, 'bad');
  if (sub === 'old')     return _bisectMark(id, rest, dir, fs, 'good');
  if (sub === 'skip')    return _bisectMark(id, rest, dir, fs, 'skip');
  if (sub === 'reset')   return _bisectReset(id, rest, dir, fs);
  if (sub === 'log')     return _bisectLog(id, rest, dir, fs);
  if (!sub)              return _gitReply(id, '', "usage: git bisect <start|good|bad|skip|reset|log>\n", 1, []);
  return _gitReply(id, '', "git bisect: unknown subcommand '" + sub + "'\n", 1, []);
}

function _bisectStart(id, args, dir, fs) {
  // git bisect start [<bad> [<good>...]]
  Promise.all([
    _git.currentBranch({ fs: fs, dir: dir }).catch(function () { return null; }),
    _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
  ]).then(function (r) {
    var origBranch = r[0];
    var origOid = r[1];
    var bad = null, good = [];
    if (args[0]) {
      bad = null;  // resolved below
    }
    var promises = [];
    if (args[0]) promises.push(_git.resolveRef({ fs: fs, dir: dir, ref: args[0] }).then(function (o) { bad = o; }));
    for (var i = 1; i < args.length; i++) {
      (function (g) {
        promises.push(_git.resolveRef({ fs: fs, dir: dir, ref: g }).then(function (o) { good.push(o); }));
      })(args[i]);
    }
    return Promise.all(promises).then(function () {
      var st = {
        good: good, bad: bad, skip: [], log: ['git bisect start' + (args.length ? ' ' + args.join(' ') : '')],
        original: origBranch || origOid,
      };
      _bisectWriteState(dir, st);
      var msg = "Bisect started. Now mark commits with `git bisect good` (works) or `git bisect bad` (broken).\n";
      if (bad && good.length) {
        return _bisectCheckoutMid(dir, fs, st).then(function (mid) {
          if (!mid) {
            msg += "Bisecting: 0 revisions left to test\n";
          } else {
            return _snapshotPaths(dir).then(function () {
              msg += "Bisecting: roughly " + Math.max(1, Math.floor(Math.log2(mid.remaining))) +
                     " more steps (" + mid.remaining + " revisions)\n" +
                     "[" + mid.oid + "] checked out for testing\n";
              _gitReply(id, msg, '', 0, []);
            });
          }
          _gitReply(id, msg, '', 0, []);
        });
      }
      _gitReply(id, msg, '', 0, []);
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

function _bisectMark(id, args, dir, fs, kind) {
  var st = _bisectReadState(dir);
  if (!st) return _gitReply(id, '', "You need to start by 'git bisect start'\n", 1, []);
  var oidPromise = args[0]
    ? _git.resolveRef({ fs: fs, dir: dir, ref: args[0] })
    : _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' });
  oidPromise.then(function (oid) {
    if (kind === 'good') st.good.push(oid);
    else if (kind === 'bad') st.bad = oid;
    else if (kind === 'skip') st.skip.push(oid);
    st.log.push('git bisect ' + kind + (args[0] ? ' ' + args[0] : ''));
    _bisectWriteState(dir, st);
    if (!st.bad || st.good.length === 0) {
      _gitReply(id, "status: waiting for both good and bad commits.\n", '', 0, []);
      return;
    }
    return _bisectCheckoutMid(dir, fs, st).then(function (mid) {
      if (!mid) {
        // Convergence: bad is the first bad commit.
        return _git.readCommit({ fs: fs, dir: dir, oid: st.bad }).then(function (c) {
          var subj = ((c.commit.message) || '').split('\n')[0];
          _gitReply(id, st.bad + " is the first bad commit\n    " + subj + "\n", '', 0, []);
        });
      }
      return _snapshotPaths(dir).then(function () {
        _gitReply(id, "Bisecting: " + mid.remaining + " revisions left to test\n[" + mid.oid + "] checked out for testing\n",
          '', 0, []);
      });
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

function _bisectReset(id, args, dir, fs) {
  var st = _bisectReadState(dir);
  if (!st) return _gitReply(id, '', "We are not bisecting.\n", 1, []);
  var ref = args[0] || st.original;
  _bisectClearState(dir);
  _git.checkout({ fs: fs, dir: dir, ref: ref, force: true })
    .then(function () { return _snapshotPaths(dir); })
    .then(function (post) {
      _gitReply(id, "Bisect reset; back at " + ref + ".\n", '', 0, Object.keys(post));
    })
    .catch(function (err) { _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []); });
}

function _bisectLog(id, args, dir, fs) {
  var st = _bisectReadState(dir);
  if (!st) return _gitReply(id, '', "We are not bisecting.\n", 1, []);
  _gitReply(id, st.log.join('\n') + '\n', '', 0, []);
}

// ---- git reflog ------------------------------------------------------------
//
// Real git records every HEAD/branch update in `.git/logs/<ref>`. iso-git
// doesn't always write reflogs automatically, so we ALSO maintain our own
// `.git/logs/HEAD` from the dispatcher: every commit/checkout/reset/merge/
// branch op that changes HEAD appends a line in standard reflog format:
//   <old> <new> <name> <email> <ts> <tz>\t<message>
// `git reflog` reads that file and prints `<short> HEAD@{n}: <message>`.

function _gitCmdReflog(id, args, dir, fs) {
  var sub = args[0];
  if (sub === 'show' || !sub || sub.charAt(0) !== '-' && !/^(expire|delete|exists)$/.test(sub)) {
    var ref = (sub === 'show' ? args[1] : sub) || 'HEAD';
    return _showReflog(id, dir, ref);
  }
  return _gitReply(id, '', "git reflog: only `show` is supported in this terminal\n", 1, []);
}

function _showReflog(id, dir, ref) {
  var path = dir + '/.git/logs/' + (ref === 'HEAD' ? 'HEAD' : (ref.indexOf('refs/') === 0 ? ref : 'refs/heads/' + ref));
  var content;
  try { content = pyodide.FS.readFile(path, { encoding: 'utf8' }); }
  catch (e) {
    return _gitReply(id, '', "fatal: no reflog for '" + ref + "'\n", 1, []);
  }
  var lines = content.split('\n').filter(Boolean);
  // Print newest first, like real git.
  var YELLOW = '\x1b[33m', RESET = '\x1b[m';
  var out = '';
  for (var i = lines.length - 1; i >= 0; i--) {
    var parsed = _parseReflogLine(lines[i]);
    if (!parsed) continue;
    var idx = lines.length - 1 - i;
    out += YELLOW + parsed.newOid.substring(0, 7) + RESET +
           ' ' + ref + '@{' + idx + '}: ' + parsed.message + '\n';
  }
  _gitReply(id, out, '', 0, []);
}

function _parseReflogLine(line) {
  // Format: "<old> <new> <name> <email> <ts> <tz>\t<message>"
  var tabIdx = line.indexOf('\t');
  if (tabIdx === -1) return null;
  var head = line.substring(0, tabIdx);
  var msg = line.substring(tabIdx + 1);
  var parts = head.split(' ');
  if (parts.length < 2) return null;
  return { oldOid: parts[0], newOid: parts[1], message: msg };
}

// Append a line to the reflog for `ref`. Called from dispatchers that move
// HEAD or a branch. Best-effort: never fails the parent op if the write
// errors (e.g., logs/ dir missing on a freshly-created ref).
function _appendReflog(dir, ref, oldOid, newOid, message) {
  var logPath = dir + '/.git/logs/' + (ref === 'HEAD' ? 'HEAD' : ref);
  try {
    var parts = logPath.substring(0, logPath.lastIndexOf('/')).split('/').filter(Boolean);
    var cur = '';
    parts.forEach(function (p) { cur += '/' + p; try { pyodide.FS.mkdir(cur); } catch (e) {} });
    var line = (oldOid || '0000000000000000000000000000000000000000') + ' ' +
               (newOid || '0000000000000000000000000000000000000000') + ' ' +
               'Student <student@example.com> ' + Math.floor(Date.now() / 1000) + ' +0000\t' +
               (message || '') + '\n';
    var existing = '';
    try { existing = pyodide.FS.readFile(logPath, { encoding: 'utf8' }); } catch (e) {}
    pyodide.FS.writeFile(logPath, existing + line, { encoding: 'utf8' });
  } catch (e) { /* best-effort */ }
}
