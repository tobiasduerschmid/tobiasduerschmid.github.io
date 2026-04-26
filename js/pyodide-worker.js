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
      var msg = err.type ? (err.type + ': ' + err.message) : String(err);
      if (!silent) {
        self.postMessage({ type: 'stderr', text: msg + '\n' });
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
    if (sub === 'checkout')     return _gitCmdCheckout(id, rest, dir, fs);
    if (sub === 'merge')        return _gitCmdMerge(id, rest, dir, fs);
    if (sub === 'rm')           return _gitCmdRm(id, rest, dir, fs, cwd);
    if (sub === 'mv')           return _gitCmdMv(id, rest, dir, fs, cwd);
    if (sub === 'reset')        return _gitCmdReset(id, rest, dir, fs);
    if (sub === 'restore')      return _gitCmdRestore(id, rest, dir, fs, cwd);
  } catch (err) {
    return _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  }
  return _gitReply(id, '',
    "git: '" + sub + "' is not supported in this tutorial. Try: init, status, add, commit, log, branch, switch, checkout, merge, rm, mv, reset, restore, config\n",
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
  // `git config <key> <value>` — only the form we support. `--global` is silently
  // accepted and treated as repo-local since iso-git has no global store.
  var filtered = args.filter(function (a) { return a !== '--global'; });
  if (filtered.length < 2) {
    return _gitReply(id, '', "usage: git config [--global] <key> <value>\n", 1, []);
  }
  var key = filtered[0];
  var value = filtered.slice(1).join(' ');
  _git.setConfig({ fs: fs, dir: dir, path: key, value: value })
    .then(function () { _gitReply(id, '', '', 0, []); })
    .catch(function (err) { _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []); });
}

function _gitCmdStatus(id, args, dir, fs, cwd) {
  Promise.all([
    _git.statusMatrix({ fs: fs, dir: dir }).catch(function () { return []; }),
    _git.currentBranch({ fs: fs, dir: dir }).catch(function () { return null; }),
  ]).then(function (r) {
    var matrix = r[0], branch = r[1] || '(none)';
    var staged = [], unstaged = [], untracked = [];
    matrix.forEach(function (row) {
      var fp = row[0], H = row[1], W = row[2], S = row[3];
      if (H === 0 && W === 2 && S === 0) untracked.push(fp);
      else if (H === 0 && S !== 0) staged.push({ status: 'new file', path: fp });
      else if (H === 1 && W === 0 && S === 0) staged.push({ status: 'deleted', path: fp });
      else if (H === 1 && W === 0 && S === 1) unstaged.push({ status: 'deleted', path: fp });
      else if (H === 1 && W === 2 && S === 1) unstaged.push({ status: 'modified', path: fp });
      else if (H === 1 && W === 2 && S === 2) staged.push({ status: 'modified', path: fp });
      else if (H === 1 && W === 2 && S === 3) {
        staged.push({ status: 'modified', path: fp });
        unstaged.push({ status: 'modified', path: fp });
      }
    });
    var out = 'On branch ' + branch + '\n';
    if (staged.length === 0 && unstaged.length === 0 && untracked.length === 0) {
      out += 'nothing to commit, working tree clean\n';
    } else {
      if (staged.length) {
        out += '\nChanges to be committed:\n';
        staged.forEach(function (s) { out += '\t' + s.status + ':\t' + s.path + '\n'; });
      }
      if (unstaged.length) {
        out += '\nChanges not staged for commit:\n';
        unstaged.forEach(function (s) { out += '\t' + s.status + ':\t' + s.path + '\n'; });
      }
      if (untracked.length) {
        out += '\nUntracked files:\n';
        untracked.forEach(function (f) { out += '\t' + f + '\n'; });
      }
    }
    _gitReply(id, out, '', 0, []);
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []);
  });
}

function _gitCmdAdd(id, args, dir, fs, cwd) {
  if (args.length === 0) {
    return _gitReply(id, '', "Nothing specified, nothing added.\nhint: Maybe you wanted to say 'git add .'?\n", 1, []);
  }
  // Build a list of relative filepaths.
  function expand(arg) {
    if (arg === '.') {
      // Add everything iso-git sees in statusMatrix that is present in workdir.
      return _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
        return matrix.map(function (row) { return row[0]; });
      });
    }
    var abs = _normalizePath(cwd, dir, arg);
    var rel = _toRel(dir, abs);
    if (rel === null) {
      return Promise.reject(new Error("path '" + arg + "' is outside the working tree"));
    }
    return Promise.resolve([rel]);
  }
  var p = Promise.all(args.map(expand));
  p.then(function (lists) {
    var paths = [].concat.apply([], lists);
    var ops = paths.map(function (filepath) {
      // Detect deleted-in-workdir vs present, choose remove vs add.
      var abs = dir + '/' + filepath;
      var exists = true;
      try { pyodide.FS.stat(abs); } catch (e) { exists = false; }
      if (!exists) {
        return _git.remove({ fs: fs, dir: dir, filepath: filepath });
      }
      return _git.add({ fs: fs, dir: dir, filepath: filepath });
    });
    return Promise.all(ops);
  }).then(function () {
    _gitReply(id, '', '', 0, []);
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []);
  });
}

function _gitCmdCommit(id, args, dir, fs) {
  // Parse: `git commit -m "msg"` or `git commit -am "msg"`.
  var message = null;
  var stageAll = false;
  for (var i = 0; i < args.length; i++) {
    if (args[i] === '-m' || args[i] === '--message') {
      message = args[i + 1] || ''; i++;
    } else if (args[i] === '-am' || args[i] === '-ma') {
      stageAll = true;
      message = args[i + 1] || ''; i++;
    } else if (args[i] === '-a' || args[i] === '--all') {
      stageAll = true;
    }
  }
  if (!message) {
    return _gitReply(id, '', "Aborting: no commit message. Use -m \"...\".\n", 1, []);
  }

  var prep = stageAll
    ? _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
        return Promise.all(matrix.map(function (row) {
          var fp = row[0], H = row[1], W = row[2];
          if (H === 1 && W === 0) return _git.remove({ fs: fs, dir: dir, filepath: fp });
          if (W !== 1) return _git.add({ fs: fs, dir: dir, filepath: fp });
          return Promise.resolve();
        }));
      })
    : Promise.resolve();

  prep.then(function () {
    return Promise.all([
      _git.getConfig({ fs: fs, dir: dir, path: 'user.name' }).catch(function () { return null; }),
      _git.getConfig({ fs: fs, dir: dir, path: 'user.email' }).catch(function () { return null; }),
    ]);
  }).then(function (cfg) {
    var name = cfg[0] || 'Student';
    var email = cfg[1] || 'student@example.com';
    return _git.commit({
      fs: fs, dir: dir, message: message,
      author: { name: name, email: email },
    });
  }).then(function (oid) {
    _gitReply(id,
      '[' + (oid.substring(0, 7)) + '] ' + message.split('\n')[0] + '\n',
      '', 0, []);
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []);
  });
}

function _gitCmdLog(id, args, dir, fs) {
  var oneline = args.indexOf('--oneline') !== -1;
  _git.log({ fs: fs, dir: dir, depth: 100 }).then(function (entries) {
    var out = '';
    entries.forEach(function (e) {
      var subject = ((e.commit && e.commit.message) || '').split('\n')[0];
      if (oneline) {
        out += e.oid.substring(0, 7) + ' ' + subject + '\n';
      } else {
        out += 'commit ' + e.oid + '\n';
        if (e.commit && e.commit.author) {
          out += 'Author: ' + e.commit.author.name + ' <' + e.commit.author.email + '>\n';
          if (e.commit.author.timestamp) {
            out += 'Date:   ' + new Date(e.commit.author.timestamp * 1000).toString() + '\n';
          }
        }
        out += '\n    ' + (e.commit && e.commit.message ? e.commit.message.replace(/\n/g, '\n    ') : '') + '\n\n';
      }
    });
    _gitReply(id, out || '(no commits yet)\n', '', 0, []);
  }).catch(function (err) {
    if (err && err.code === 'NotFoundError') {
      _gitReply(id, '', "fatal: your current branch does not have any commits yet\n", 1, []);
    } else {
      _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []);
    }
  });
}

function _gitCmdBranch(id, args, dir, fs) {
  // `git branch` (list) | `git branch <name>` (create) | `git branch -d <name>` (delete)
  if (args.length === 0) {
    return Promise.all([
      _git.listBranches({ fs: fs, dir: dir }),
      _git.currentBranch({ fs: fs, dir: dir }),
    ]).then(function (r) {
      var branches = r[0], cur = r[1];
      var out = '';
      branches.forEach(function (b) { out += (b === cur ? '* ' : '  ') + b + '\n'; });
      _gitReply(id, out || '', '', 0, []);
    }).catch(function (err) {
      _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []);
    });
  }
  if (args[0] === '-d' || args[0] === '-D') {
    var name = args[1];
    if (!name) return _gitReply(id, '', "branch name required\n", 1, []);
    _git.deleteBranch({ fs: fs, dir: dir, ref: name })
      .then(function () { _gitReply(id, "Deleted branch " + name + "\n", '', 0, []); })
      .catch(function (err) { _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []); });
    return;
  }
  // Create
  var newName = args[0];
  _git.branch({ fs: fs, dir: dir, ref: newName, checkout: false })
    .then(function () { _gitReply(id, '', '', 0, []); })
    .catch(function (err) { _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []); });
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

function _gitCmdCheckout(id, args, dir, fs) {
  // `git checkout <ref>` | `git checkout -b <name>` | `git checkout <ref> -- <path>` (limited)
  var create = false, name = null;
  for (var i = 0; i < args.length; i++) {
    if (args[i] === '-b' || args[i] === '-B') { create = true; }
    else if (args[i] === '--') { break; }
    else if (!name) { name = args[i]; }
  }
  if (!name) return _gitReply(id, '', "checkout: ref required\n", 1, []);
  _doCheckout(id, dir, fs, name, create);
}

function _doCheckout(id, dir, fs, name, create) {
  // Capture working-tree state pre-checkout so we can compute mutated paths.
  _snapshotPaths(dir).then(function (preMap) {
    var doIt;
    if (create) {
      doIt = _git.branch({ fs: fs, dir: dir, ref: name, checkout: false })
        .then(function () { return _git.checkout({ fs: fs, dir: dir, ref: name, force: false }); });
    } else {
      doIt = _git.checkout({ fs: fs, dir: dir, ref: name, force: false });
    }
    return doIt.then(function () {
      return _snapshotPaths(dir).then(function (postMap) {
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
          return _snapshotPaths(dir).then(function (postMap) {
            var mutated = _diffMaps(preMap, postMap);
            var note = result && result.fastForward
              ? "Fast-forward\n"
              : (result && result.alreadyMerged ? "Already up to date.\n" : "Merge made by recursive strategy.\n");
            _gitReply(id, note, '', 0, mutated);
          });
        });
      });
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []);
  });
}

function _gitCmdRm(id, args, dir, fs, cwd) {
  if (args.length === 0) return _gitReply(id, '', "rm: file required\n", 1, []);
  var paths = args.filter(function (a) { return a.charAt(0) !== '-'; });
  var ops = paths.map(function (p) {
    var abs = _normalizePath(cwd, dir, p);
    var rel = _toRel(dir, abs);
    if (rel === null) return Promise.reject(new Error("'" + p + "' is outside the working tree"));
    try { pyodide.FS.unlink(abs); } catch (e) { /* tolerate already-gone */ }
    return _git.remove({ fs: fs, dir: dir, filepath: rel }).then(function () { return rel; });
  });
  Promise.all(ops).then(function (rels) {
    var out = rels.map(function (r) { return "rm '" + r + "'\n"; }).join('');
    _gitReply(id, out, '', 0, rels);
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []);
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

function _gitCmdReset(id, args, dir, fs) {
  // Supported forms: `git reset --hard <ref>` and `git reset <ref>` (mixed-ish: just resetIndex).
  var hard = false, ref = 'HEAD';
  args.forEach(function (a) {
    if (a === '--hard') hard = true;
    else if (a === '--soft' || a === '--mixed') { /* not strictly modeled — same as default */ }
    else if (a !== '--') ref = a;
  });
  _snapshotPaths(dir).then(function (preMap) {
    if (hard) {
      return _git.checkout({ fs: fs, dir: dir, ref: ref, force: true }).then(function () {
        // Update HEAD to point at <ref> if it's a branch ref. checkout already handles this.
        return _snapshotPaths(dir);
      }).then(function (postMap) {
        var mutated = _diffMaps(preMap, postMap);
        _gitReply(id, "HEAD is now at " + ref + "\n", '', 0, mutated);
      });
    }
    // Soft/mixed: rewrite the index from <ref> without touching working tree.
    return _git.resolveRef({ fs: fs, dir: dir, ref: ref }).then(function (oid) {
      return _git.readCommit({ fs: fs, dir: dir, oid: oid }).then(function () {
        // iso-git lacks a direct `reset` — approximate by rewriting HEAD.
        return _git.writeRef({ fs: fs, dir: dir, ref: 'HEAD', value: oid, force: true });
      });
    }).then(function () {
      _gitReply(id, '', '', 0, []);
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []);
  });
}

function _gitCmdRestore(id, args, dir, fs, cwd) {
  // Minimal: `git restore <path>` — discard working tree changes for <path>.
  if (args.length === 0) return _gitReply(id, '', "restore: file required\n", 1, []);
  var staged = args.indexOf('--staged') !== -1;
  var paths = args.filter(function (a) { return a.charAt(0) !== '-'; });
  if (staged) {
    Promise.all(paths.map(function (p) {
      var abs = _normalizePath(cwd, dir, p);
      var rel = _toRel(dir, abs);
      if (rel === null) return Promise.reject(new Error("'" + p + "' is outside the working tree"));
      return _git.resetIndex({ fs: fs, dir: dir, filepath: rel });
    })).then(function () { _gitReply(id, '', '', 0, []); })
      .catch(function (err) { _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []); });
    return;
  }
  // working-tree restore
  var rels = paths.map(function (p) {
    var abs = _normalizePath(cwd, dir, p);
    var rel = _toRel(dir, abs);
    if (rel === null) return null;
    return rel;
  });
  if (rels.indexOf(null) !== -1) {
    return _gitReply(id, '', "restore: paths must be inside the working tree\n", 1, []);
  }
  _git.checkout({ fs: fs, dir: dir, force: true, filepaths: rels })
    .then(function () { _gitReply(id, '', '', 0, rels); })
    .catch(function (err) { _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []); });
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
