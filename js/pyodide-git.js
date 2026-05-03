/**
 * Pyodide Git Module — isomorphic-git on the Pyodide FS
 *
 * Lazy-loaded by `pyodide-worker.js` on the first git* message so tutorials
 * that don't use git pay zero cost. Once loaded, it exposes four entry-point
 * functions on `self`:
 *   - gitInit(id, dir)
 *   - gitRun(id, line, cwd, dir)
 *   - gitGetState(id, dir)
 *   - gitListDir(id, path)
 *
 * The module assumes `pyodide` is already initialised in the worker scope
 * (the worker only sends git messages once Pyodide is ready). It also calls
 * `self.postMessage` directly to reply to the main thread — same protocol as
 * before the module was extracted.
 *
 * Implementation notes:
 *   - The fs adapter wraps Emscripten's sync `pyodide.FS` to look like
 *     iso-git's `fs.promises` interface.
 *   - Errors carry a string `code` (Linux errno name, e.g. 'ENOENT') because
 *     iso-git pattern-matches on it.
 *   - All terminal output mimics real git as closely as possible (ANSI
 *     colors, message phrasing) so transcripts read naturally in the tutor.
 */
'use strict';

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

// Read a file's content as it exists at <ref> (default HEAD). Powers the git
// gutter feature: the main thread diffs the editor buffer against this to
// paint added/modified/deleted line markers.
//
// Replies:
//   { content: <string> }            — file content at <ref>
//   { content: null }                — file is not at <ref> (untracked / new)
//   { content: null, notReady: true} — git isn't initialized yet; main thread
//                                       should leave the gutter alone (vs. the
//                                       null case where every line is "added")
function gitReadAtRef(id, filepath, ref) {
  var fs = _gitFsAdapter;
  var dir = _gitDir;
  // Strip the dir prefix so iso-git can find the blob by repo-relative path.
  var rel = filepath;
  var prefix = dir.replace(/\/$/, '') + '/';
  if (rel.indexOf(prefix) === 0) rel = rel.substring(prefix.length);
  if (!_git) {
    self.postMessage({
      type: 'git_read_at_ref', id: id, path: filepath,
      content: null, notReady: true,
    });
    return;
  }

  // iso-git's readBlob requires an actual SHA-1 oid — passing 'HEAD' rejects
  // with InvalidOidError. Resolve the ref to a commit oid first, then read
  // the blob at that path within the commit's tree.
  _git.resolveRef({ fs: fs, dir: dir, ref: ref || 'HEAD' })
    .catch(function (err) {
      // No commits yet (the ref doesn't resolve) — treat as "no HEAD",
      // not as "git not ready". File is effectively brand-new.
      var msg = String(err && err.message || err);
      var noCommits = /not found|could not find|does not exist|no such ref|cannot resolve/i.test(msg);
      if (noCommits) return null;
      throw err;
    })
    .then(function (commitOid) {
      if (!commitOid) {
        // No HEAD resolution → file is "new" (no comparison baseline).
        self.postMessage({ type: 'git_read_at_ref', id: id, path: filepath, content: null });
        return null;
      }
      return _git.readBlob({ fs: fs, dir: dir, oid: commitOid, filepath: rel })
        .then(function (b) {
          var text = '';
          try { text = new TextDecoder().decode(b.blob); }
          catch (e) { text = ''; }
          self.postMessage({ type: 'git_read_at_ref', id: id, path: filepath, content: text });
        })
        .catch(function (err) {
          // File doesn't exist at this commit (untracked / newly added) →
          // null content, NOT notReady.  Anything else → leave gutter alone.
          var msg = String(err && err.message || err);
          var notFound = (err && (err.code === 'NotFoundError' || err.name === 'NotFoundError'))
                      || /could not find|notfound|not found|does not exist/i.test(msg);
          self.postMessage({
            type: 'git_read_at_ref', id: id, path: filepath,
            content: null, notReady: !notFound,
          });
        });
    })
    .catch(function (err) {
      // Unexpected error during resolve → treat as notReady.
      self.postMessage({
        type: 'git_read_at_ref', id: id, path: filepath,
        content: null, notReady: true,
      });
    });
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
  // Split on shell sequencing operators (`&&`, `||`, `;`) before doing
  // anything else. Each segment is then dispatched to _gitRunSingle in
  // sequence, with the operator deciding whether to run the next segment
  // based on the previous segment's exit code:
  //   `cmd1 && cmd2`  — run cmd2 only if cmd1 succeeded (exit 0)
  //   `cmd1 || cmd2`  — run cmd2 only if cmd1 failed (exit != 0)
  //   `cmd1 ;  cmd2`  — run cmd2 unconditionally
  // Quoted operators are ignored (`echo "a && b"` is one segment).
  // Pipes (`|`) and subshells are still unsupported.
  var chain = _splitChain(String(line || '').trim());
  if (chain.length <= 1) {
    return _gitRunSingle(id, line, cwd, dir);
  }

  var combinedStdout  = '';
  var combinedStderr  = '';
  var combinedMutated = [];
  var lastExit        = 0;

  function runNext(index) {
    if (index >= chain.length) {
      return _gitReply(id, combinedStdout, combinedStderr, lastExit, combinedMutated);
    }
    var step = chain[index];
    // Skip-by-operator: && short-circuits on failure; || short-circuits on success.
    if (step.operator === '&&' && lastExit !== 0) return runNext(index + 1);
    if (step.operator === '||' && lastExit === 0) return runNext(index + 1);

    var captureId = 'chain_' + Date.now() + '_' + index + '_' + Math.random();
    _chainCaptures[captureId] = function (stdout, stderr, exitCode, mutatedPaths) {
      delete _chainCaptures[captureId];
      combinedStdout += (stdout || '');
      combinedStderr += (stderr || '');
      lastExit = (typeof exitCode === 'number') ? exitCode : 0;
      if (mutatedPaths && mutatedPaths.length) {
        combinedMutated = combinedMutated.concat(mutatedPaths);
      }
      runNext(index + 1);
    };
    _gitRunSingle(captureId, step.segment, cwd, dir);
  }

  runNext(0);
}

// Split a command line on `&&`, `||`, `;` (respecting single/double quotes).
// Returns [{operator, segment}] where operator is null for the first segment.
function _splitChain(line) {
  var segments = [];
  var cur = '';
  var inS = false, inD = false;
  var pendingOp = null;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inS) {
      if (ch === "'") inS = false;
      cur += ch; continue;
    }
    if (inD) {
      if (ch === '"') inD = false;
      cur += ch; continue;
    }
    if (ch === "'") { inS = true;  cur += ch; continue; }
    if (ch === '"') { inD = true;  cur += ch; continue; }
    if (ch === '&' && line[i + 1] === '&') {
      segments.push({ operator: pendingOp, segment: cur.trim() });
      cur = ''; pendingOp = '&&'; i++; continue;
    }
    if (ch === '|' && line[i + 1] === '|') {
      segments.push({ operator: pendingOp, segment: cur.trim() });
      cur = ''; pendingOp = '||'; i++; continue;
    }
    if (ch === ';') {
      segments.push({ operator: pendingOp, segment: cur.trim() });
      cur = ''; pendingOp = ';'; continue;
    }
    cur += ch;
  }
  segments.push({ operator: pendingOp, segment: cur.trim() });
  return segments.filter(function (s) { return s.segment.length > 0; });
}

function _gitRunSingle(id, line, cwd, dir) {
  _ensureGit(dir).then(function () {
    // Parse shell redirects (> and >>) before tokenising.
    // Supports:   cmd arg > file   and   cmd arg >> file
    // Quoted `>` inside single/double quotes is NOT a redirect.
    var redirect = _parseRedirect(String(line || '').trim());
    var cmdLine   = redirect.cmd;
    var redirFile = redirect.file;    // null if none
    var redirAppend = redirect.append;  // true for >>

    var tokens = _tokenize(cmdLine);
    if (tokens.length === 0) {
      return _gitReply(id, '', '', 0, []);
    }
    var verb = tokens[0];
    var rest = tokens.slice(1);
    if (verb === 'git') {
      return _dispatchGit(id, rest, cwd || _gitDir);
    }
    // Python runners: forward to Pyodide so `python script.py`, `pytest`,
    // and `python -c "..."` all work when the git terminal is active.
    if (verb === 'python' || verb === 'python3' || verb === 'py') {
      return _runPythonCommand(id, rest, cwd || _gitDir);
    }
    if (verb === 'pytest' || verb === 'py.test') {
      return _runPythonCommand(id, ['-m', 'pytest'].concat(rest), cwd || _gitDir);
    }
    // Non-git verb — lazy-load pyodide-unix.js (same worker scope, so it
    // inherits _gitReply, _normalizePath, _toRel, _formatHunks etc. directly).
    return _ensureUnixModuleLoaded().then(function () {
      if (typeof _UNIX_HANDLERS !== 'undefined' && _UNIX_HANDLERS[verb]) {
        if (redirFile) {
          // Intercept this command's reply: write stdout to the file instead
          // of sending it back to the terminal.
          return _withRedirect(id, redirFile, redirAppend, cwd || _gitDir, dir || _gitDir, function (captureId) {
            return _UNIX_HANDLERS[verb](captureId, rest, cwd || _gitDir, dir || _gitDir);
          });
        }
        return _UNIX_HANDLERS[verb](id, rest, cwd || _gitDir, dir || _gitDir);
      }
      return _gitReply(id, '',
        verb + ": command not found (type `help` to see what's available)\n", 1, []);
    }).catch(function (err) {
      _gitReply(id, '',
        verb + ": command not found (unix module unavailable: " + (err.message || err) + ")\n", 1, []);
    });
  }).catch(function (err) {
    _gitReply(id, '', String(err && err.message || err) + '\n', 1, []);
  });
}

// Parse `cmd > file` or `cmd >> file` from a raw line. Returns
// {cmd, file, append}. Quoted > is honoured (won't be treated as redirect).
function _parseRedirect(line) {
  var cmd = '', file = null, append = false;
  var inS = false, inD = false;
  var i = 0;
  while (i < line.length) {
    var ch = line[i];
    if (inS) {
      if (ch === "'") inS = false;
      cmd += ch; i++; continue;
    }
    if (inD) {
      if (ch === '"') inD = false;
      cmd += ch; i++; continue;
    }
    if (ch === "'") { inS = true; cmd += ch; i++; continue; }
    if (ch === '"') { inD = true; cmd += ch; i++; continue; }
    // Check for >> before >
    if (ch === '>' && line[i + 1] === '>') {
      append = true;
      file = line.substring(i + 2).trim();
      break;
    }
    if (ch === '>') {
      append = false;
      file = line.substring(i + 1).trim();
      break;
    }
    cmd += ch; i++;
  }
  // Strip surrounding quotes from filename.
  if (file) {
    file = file.replace(/^['"]|['"]$/g, '');
    if (!file) file = null;
  }
  return { cmd: cmd.trim(), file: file, append: append };
}

// Run `fn(captureId)` which will call _gitReply(captureId, stdout, ...).
// We intercept that reply, write stdout to `file`, then send a clean reply
// (no stdout) back to the real `id`.
var _redirectCaptures = {};
function _withRedirect(id, file, append, cwd, dir, fn) {
  var captureId = 'redir_' + Date.now() + '_' + Math.random();
  var absFile = _normalizePath(cwd, dir, file);

  return new Promise(function (resolve) {
    _redirectCaptures[captureId] = function (stdout, stderr, exitCode, mutatedPaths) {
      delete _redirectCaptures[captureId];
      // Write stdout to the redirect target.
      try {
        var existing = '';
        if (append) {
          try { existing = pyodide.FS.readFile(absFile, { encoding: 'utf8' }); } catch (e) {}
        }
        pyodide.FS.writeFile(absFile, existing + (stdout || ''), { encoding: 'utf8' });
        var rel = _toRel(dir, absFile);
        if (rel) mutatedPaths = (mutatedPaths || []).concat([rel]);
      } catch (e) {
        stderr = (stderr || '') + 'redirect: cannot write \'' + file + '\': ' + e.message + '\n';
        exitCode = 1;
      }
      // Reply to the terminal with stderr only (stdout went to the file).
      self.postMessage({
        type: 'git_run_done', id: id,
        stdout: '', stderr: stderr || '',
        exitCode: exitCode || 0,
        mutatedPaths: mutatedPaths || [],
      });
      resolve();
    };
    // Temporarily patch _gitReply to capture this captureId.
    fn(captureId);
  });
}

// Override _gitReply to intercept redirect captures and chain captures.
// Both are non-terminal: redirects siphon stdout into a file; chain captures
// accumulate output across `&&`/`||`/`;`-separated segments before the final
// reply goes back to the terminal.
var _chainCaptures = {};
var _gitReplyOrig = _gitReply;
_gitReply = function (id, stdout, stderr, exitCode, mutatedPaths) {
  if (_redirectCaptures[id]) {
    _redirectCaptures[id](stdout, stderr, exitCode, mutatedPaths);
    return;
  }
  if (_chainCaptures[id]) {
    _chainCaptures[id](stdout, stderr, exitCode, mutatedPaths);
    return;
  }
  _gitReplyOrig(id, stdout, stderr, exitCode, mutatedPaths);
};

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

// Run a Python command through Pyodide and collect its output as a git reply.
// This makes `python script.py`, `pytest`, and `python -c "..."` work in the
// git terminal. We run it async and stream back stdout/stderr as a single
// block when the script completes (same pattern as _gitReply).
//
// IMPORTANT: Pyodide caches imports in `sys.modules` across runs. If a
// student edits `scorer.py` and runs `pytest` twice, the second run would
// otherwise serve the FIRST run's cached module. We wipe every module rooted
// in /tutorial/ before each run, mirroring the pyodide-worker.js runFile
// path, so edits are always picked up. Also adds /tutorial to sys.path so
// `from scorer import score` resolves regardless of cwd.
function _runPythonCommand(id, args, cwd) {
  if (!pyodide) {
    return _gitReply(id, '', 'python: Pyodide not ready\n', 1, []);
  }
  // Change into the requested cwd so relative imports and file opens work.
  try { pyodide.FS.chdir(cwd); } catch (e) {}

  // Wipe stale /tutorial/-rooted modules, ensure sys.path includes the
  // working directory, and set the env vars libraries use to gate color.
  try {
    pyodide.runPython([
      'import sys as _sys, os as _os',
      // Module cache wipe.
      'for _m in list(_sys.modules):',
      '    _f = getattr(_sys.modules[_m], "__file__", "") or ""',
      '    if "/tutorial/" in _f: del _sys.modules[_m]',
      // sys.path.
      'if ' + JSON.stringify(cwd) + ' not in _sys.path:',
      '    _sys.path.insert(0, ' + JSON.stringify(cwd) + ')',
      'if "/tutorial" not in _sys.path:',
      '    _sys.path.insert(0, "/tutorial")',
      // Color: env vars.
      '_os.environ.setdefault("PY_COLORS", "1")',           // pytest
      '_os.environ.setdefault("FORCE_COLOR", "1")',         // rich, click, …
      '_os.environ.setdefault("CLICOLOR_FORCE", "1")',      // BSD-style tools
      '_os.environ.setdefault("CLICOLOR", "1")',
      '_os.environ.setdefault("TERM", "xterm-256color")',
      '_os.environ.setdefault("COLORTERM", "truecolor")',
    ].join('\n'));
  } catch (e) { /* best-effort */ }

  // Build sys.argv from the argument list.
  var scriptArg = args[0] || '-c';
  var isModule = scriptArg === '-m';
  var isCode   = scriptArg === '-c';

  // Capture stdout + stderr into string buffers.
  var stdoutBuf = '', stderrBuf = '';
  pyodide.setStdout({ batched: function (t) { stdoutBuf += t + '\n'; } });
  pyodide.setStderr({ batched: function (t) { stderrBuf += t + '\n'; } });

  // Patch isatty on the freshly-installed stdout/stderr so libraries that
  // gate color on isatty() (rich, click, colorama, pytest's _pytest.terminal)
  // still emit ANSI codes — the xterm.js terminal renders them just fine.
  // Must run AFTER setStdout/setStderr installed the new objects.
  try {
    pyodide.runPython([
      'import sys as _sys',
      'try: _sys.stdout.isatty = lambda: True',
      'except Exception: pass',
      'try: _sys.stderr.isatty = lambda: True',
      'except Exception: pass',
    ].join('\n'));
  } catch (e) { /* best-effort */ }

  var runPromise;
  if (isCode) {
    // python -c "code"
    var code = args.slice(1).join(' ');
    pyodide.runPython('import sys; sys.argv = ["-c"]');
    runPromise = pyodide.loadPackagesFromImports(code).then(function () {
      return pyodide.runPythonAsync(code);
    });
  } else if (isModule) {
    // python -m module [args...]
    var mod = args[1] || '';
    var modArgs = args.slice(2);
    pyodide.runPython('import sys; sys.argv = ' + JSON.stringify([mod].concat(modArgs)));
    // For pytest, ensure the package is loaded.
    var bootstrap = (mod === 'pytest')
      ? pyodide.loadPackage('pytest').catch(function () {})
      : Promise.resolve();
    runPromise = bootstrap.then(function () {
      return pyodide.runPythonAsync(
        'import runpy; runpy.run_module(' + JSON.stringify(mod) + ', run_name="__main__", alter_sys=True)'
      );
    });
  } else {
    // python script.py [args...]
    var scriptAbs = scriptArg.charAt(0) === '/'
      ? scriptArg
      : (cwd + '/' + scriptArg).replace(/\/+/g, '/');
    var scriptArgs = args.slice(1);
    pyodide.runPython('import sys; sys.argv = ' + JSON.stringify([scriptAbs].concat(scriptArgs)));
    var src;
    try { src = pyodide.FS.readFile(scriptAbs, { encoding: 'utf8' }); }
    catch (e) {
      pyodide.setStdout({ batched: function () {} });
      pyodide.setStderr({ batched: function () {} });
      return _gitReply(id, '', 'python: can\'t open file \'' + scriptArg + '\': No such file or directory\n', 2, []);
    }
    runPromise = pyodide.loadPackagesFromImports(src).then(function () {
      return pyodide.runPythonAsync(src);
    });
  }

  return runPromise
    .then(function () {
      pyodide.setStdout({ batched: function () {} });
      pyodide.setStderr({ batched: function () {} });
      _gitReply(id, stdoutBuf, stderrBuf, 0, []);
    })
    .catch(function (err) {
      pyodide.setStdout({ batched: function () {} });
      pyodide.setStderr({ batched: function () {} });
      var msg = err && err.message ? err.message : String(err);
      // Detect SystemExit (pytest uses this to signal pass/fail).
      var exitMatch = /SystemExit:\s*(\d+)/.exec(msg);
      if (exitMatch) {
        _gitReply(id, stdoutBuf, stderrBuf, parseInt(exitMatch[1], 10), []);
        return;
      }
      // pytest's exit code 1 surfaces as a clean SystemExit too in some
      // builds — if stdout already shows pytest output, don't append the
      // traceback (it's just noise after a real test failure).
      var pytestRan = /=+\s*test session starts\s*=+/.test(stdoutBuf);
      if (pytestRan) {
        _gitReply(id, stdoutBuf, stderrBuf, 1, []);
        return;
      }
      _gitReply(id, stdoutBuf, stderrBuf + msg + '\n', 1, []);
    });
}

function _dispatchGit(id, args, cwd) {
  if (args.length === 0) {
    return _gitReply(id, '', 'usage: git <command> [<args>]\n', 1, []);
  }

  // Top-level options that real git accepts before the subcommand.
  // We honor `git --version`, `-h`, `--help`, and `git -C <path>`.
  while (args.length && args[0].charAt(0) === '-') {
    var top = args[0];
    if (top === '--version' || top === '-v')   return _gitCmdVersion(id);
    if (top === '--help'    || top === '-h')   return _gitCmdHelp(id, args.slice(1));
    if (top === '-C') {
      // git -C <path> <subcommand> ... — run the subcommand from <path>.
      var newCwd = _normalizePath(cwd, _gitDir, args[1] || '.');
      return _dispatchGit(id, args.slice(2), newCwd);
    }
    if (top === '--git-dir' || top === '--work-tree' ||
        top.indexOf('--git-dir=') === 0 || top.indexOf('--work-tree=') === 0) {
      // Accepted for compatibility, ignored — there's only one repo.
      args = args.slice(top.indexOf('=') === -1 ? 2 : 1);
      continue;
    }
    if (top === '-c') {
      // git -c key=value <subcommand> — accepted but ignored.
      args = args.slice(2);
      continue;
    }
    break;
  }
  if (args.length === 0) {
    return _gitReply(id, '', 'usage: git <command> [<args>]\n', 1, []);
  }

  var sub = args[0];
  var rest = args.slice(1);
  var dir = _gitDir;
  var fs = _gitFsAdapter;

  try {
    if (sub === 'init')           return _gitCmdInit(id, rest, dir, fs);
    if (sub === 'config')         return _gitCmdConfig(id, rest, dir, fs);
    if (sub === 'status')         return _gitCmdStatus(id, rest, dir, fs, cwd);
    if (sub === 'add')            return _gitCmdAdd(id, rest, dir, fs, cwd);
    if (sub === 'commit')         return _gitCmdCommit(id, rest, dir, fs);
    if (sub === 'log')            return _gitCmdLog(id, rest, dir, fs, cwd);
    if (sub === 'branch')         return _gitCmdBranch(id, rest, dir, fs);
    if (sub === 'switch')         return _gitCmdSwitch(id, rest, dir, fs);
    if (sub === 'checkout')       return _gitCmdCheckout(id, rest, dir, fs, cwd);
    if (sub === 'merge')          return _gitCmdMerge(id, rest, dir, fs);
    if (sub === 'merge-base')     return _gitCmdMergeBase(id, rest, dir, fs);
    if (sub === 'rm')             return _gitCmdRm(id, rest, dir, fs, cwd);
    if (sub === 'mv')             return _gitCmdMv(id, rest, dir, fs, cwd);
    if (sub === 'reset')          return _gitCmdReset(id, rest, dir, fs, cwd);
    if (sub === 'restore')        return _gitCmdRestore(id, rest, dir, fs, cwd);
    if (sub === 'tag')            return _gitCmdTag(id, rest, dir, fs);
    if (sub === 'diff')           return _gitCmdDiff(id, rest, dir, fs, cwd);
    if (sub === 'show')           return _gitCmdShow(id, rest, dir, fs);
    if (sub === 'stash')          return _gitCmdStash(id, rest, dir, fs);
    if (sub === 'cherry-pick')    return _gitCmdCherryPick(id, rest, dir, fs);
    if (sub === 'revert')         return _gitCmdRevert(id, rest, dir, fs);
    if (sub === 'bisect')         return _gitCmdBisect(id, rest, dir, fs);
    if (sub === 'reflog')         return _gitCmdReflog(id, rest, dir, fs);
    if (sub === 'rev-parse')      return _gitCmdRevParse(id, rest, dir, fs);
    if (sub === 'rev-list')       return _gitCmdRevList(id, rest, dir, fs);
    if (sub === 'ls-files')       return _gitCmdLsFiles(id, rest, dir, fs, cwd);
    if (sub === 'cat-file')       return _gitCmdCatFile(id, rest, dir, fs);
    if (sub === 'symbolic-ref')   return _gitCmdSymbolicRef(id, rest, dir, fs);
    if (sub === 'describe')       return _gitCmdDescribe(id, rest, dir, fs);
    if (sub === 'clean')          return _gitCmdClean(id, rest, dir, fs, cwd);
    if (sub === 'rebase')         return _gitCmdRebase(id, rest, dir, fs);
    if (sub === 'remote')         return _gitCmdRemote(id, rest, dir, fs);
    if (sub === 'fetch')          return _gitCmdFetch(id, rest, dir, fs);
    if (sub === 'pull')           return _gitCmdPull(id, rest, dir, fs);
    if (sub === 'push')           return _gitCmdPush(id, rest, dir, fs);
    if (sub === 'clone')          return _gitCmdClone(id, rest, dir, fs);
    if (sub === 'blame')          return _gitCmdBlame(id, rest, dir, fs, cwd);
    if (sub === 'fsck')           return _gitCmdFsck(id, rest, dir, fs);
    if (sub === 'gc' || sub === 'prune' || sub === 'repack') return _gitCmdGc(id, rest, dir, fs);
    if (sub === 'version')        return _gitCmdVersion(id);
    if (sub === 'help')           return _gitCmdHelp(id, rest);
  } catch (err) {
    return _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  }

  // Surface a friendly hint for things real git supports but we don't.
  if (sub === 'submodule' || sub === 'worktree' || sub === 'subtree' ||
      sub === 'sparse-checkout' || sub === 'lfs' || sub === 'send-email' ||
      sub === 'request-pull' || sub === 'svn' || sub === 'p4' ||
      sub === 'instaweb' || sub === 'gui' || sub === 'difftool' ||
      sub === 'mergetool' || sub === 'am') {
    return _gitReply(id, '',
      "git " + sub + ": not supported in the tutorial sandbox (no remote/network primitives).\n",
      1, []);
  }
  return _gitReply(id, '',
    "git: '" + sub + "' is not a git command. See 'git help'.\n",
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
  // Flags: -s/--short, --porcelain, -b/--branch, -uno/-uall (untracked verbosity),
  //        --ignored
  var shortMode = false, porcelain = false, branchHeader = false;
  var untracked = 'normal';  // 'normal' | 'all' | 'no'
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-s' || a === '--short')           { shortMode = true; continue; }
    if (a === '--porcelain')                     { porcelain = true; shortMode = true; continue; }
    if (a.indexOf('--porcelain=') === 0)         { porcelain = true; shortMode = true; continue; }
    if (a === '-b' || a === '--branch')          { branchHeader = true; continue; }
    if (a === '-uno' || a === '--untracked-files=no')  { untracked = 'no'; continue; }
    if (a === '-uall' || a === '--untracked-files=all'){ untracked = 'all'; continue; }
    if (a === '-unormal' || a === '--untracked-files=normal') { untracked = 'normal'; continue; }
    if (a.indexOf('--untracked-files=') === 0)   { untracked = a.substring('--untracked-files='.length); continue; }
    if (a === '--ignored' || a.indexOf('--ignored=') === 0) { continue; }
    if (a === '--show-stash' || a === '--no-renames' || a === '--renames' ||
        a === '--ahead-behind' || a === '--no-ahead-behind' ||
        a === '--long' || a === '--column' || a === '--no-column' ||
        a === '--no-color' || a === '--color' || a.indexOf('--color=') === 0) {
      continue;
    }
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
  }

  Promise.all([
    _git.statusMatrix({ fs: fs, dir: dir }).catch(function () { return []; }),
    _git.currentBranch({ fs: fs, dir: dir }).catch(function () { return null; }),
    // Detect "no commits yet" state — HEAD is a symbolic ref but the branch
    // it points at has no oid. real-git shows a special header line for this.
    _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
  ]).then(function (r) {
    var matrix = r[0], branch = r[1], headOid = r[2];
    var hasCommits = !!headOid;
    var staged = [], unstagedArr = [], untrackedArr = [];
    matrix.forEach(function (row) {
      var fp = row[0], H = row[1], W = row[2], S = row[3];
      if (H === 0 && W === 2 && S === 0) untrackedArr.push(fp);
      else if (H === 0 && S !== 0) {
        staged.push({ status: 'new file', path: fp });
        if (W === 3) unstagedArr.push({ status: 'modified', path: fp });
      }
      else if (H === 1 && W === 0 && S === 0) staged.push({ status: 'deleted', path: fp });
      else if (H === 1 && W === 0 && S === 1) unstagedArr.push({ status: 'deleted', path: fp });
      else if (H === 1 && W === 2 && S === 1) unstagedArr.push({ status: 'modified', path: fp });
      else if (H === 1 && W === 2 && S === 2) staged.push({ status: 'modified', path: fp });
      else if (H === 1 && W === 2 && S === 3) {
        staged.push({ status: 'modified', path: fp });
        unstagedArr.push({ status: 'modified', path: fp });
      }
    });
    if (untracked === 'no') untrackedArr = [];

    if (shortMode) {
      // Short / porcelain v1 format: XY <path>
      // X = index status, Y = worktree status.
      var GREEN = '\x1b[32m', RED = '\x1b[31m', RESET = '\x1b[m';
      var out = '';
      if (branchHeader) {
        out += '## ' + (branch || 'HEAD' + (hasCommits ? '' : ' (no branch)')) +
               (hasCommits ? '' : ' [no commits]') + '\n';
      }
      // Build a {path: {x, y}} map so we don't double-print modified-and-staged.
      var byPath = {};
      function set(p, x, y) {
        if (!byPath[p]) byPath[p] = { x: ' ', y: ' ' };
        if (x !== undefined) byPath[p].x = x;
        if (y !== undefined) byPath[p].y = y;
      }
      staged.forEach(function (s) {
        var x = (s.status === 'new file') ? 'A' : (s.status === 'deleted') ? 'D' : 'M';
        set(s.path, x, undefined);
      });
      unstagedArr.forEach(function (s) {
        var y = (s.status === 'deleted') ? 'D' : 'M';
        set(s.path, undefined, y);
      });
      untrackedArr.forEach(function (p) { set(p, '?', '?'); });
      Object.keys(byPath).sort().forEach(function (p) {
        var c = byPath[p];
        var color = (c.x === '?') ? RED : (c.x !== ' ' ? GREEN : RED);
        if (porcelain) {
          // Porcelain: no colors
          out += c.x + c.y + ' ' + p + '\n';
        } else {
          out += color + c.x + RESET + (c.y !== ' ' ? RED + c.y + RESET : ' ') + ' ' + p + '\n';
        }
      });
      return _gitReply(id, out, '', 0, []);
    }

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
    if (unstagedArr.length) {
      out += '\nChanges not staged for commit:\n';
      out += '  (use "git add <file>..." to update what will be committed)\n';
      out += '  (use "git restore <file>..." to discard changes in working directory)\n';
      unstagedArr.forEach(function (s) {
        out += '\t' + RED + _padStatus(s.status) + s.path + RESET + '\n';
      });
    }
    if (untrackedArr.length) {
      out += '\nUntracked files:\n';
      out += '  (use "git add <file>..." to include in what will be committed)\n';
      untrackedArr.forEach(function (f) { out += '\t' + RED + f + RESET + '\n'; });
    }

    if (staged.length === 0 && unstagedArr.length === 0 && untrackedArr.length === 0) {
      out += hasCommits ? '\nnothing to commit, working tree clean\n'
                        : '\nnothing to commit (create/copy files and use "git add" to track)\n';
    } else if (staged.length === 0 && (unstagedArr.length || untrackedArr.length)) {
      out += '\n';
      if (untrackedArr.length && !unstagedArr.length) {
        out += 'nothing added to commit but untracked files present (use "git add" to track)\n';
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
  // Flags accepted (matches real git's stable flag set):
  //   -A / --all / --no-ignore-removal       — stage all (incl. removals)
  //   -u / --update                          — only update tracked files
  //   -n / --dry-run                         — show what would be added
  //   -v / --verbose                         — print each path added
  //   -f / --force                           — allow ignored files (no-op here)
  //   -N / --intent-to-add                   — add empty-blob index entry
  //   --ignore-errors                        — keep going past per-file errors
  //   --ignore-removal                       — opposite of --no-ignore-removal
  //   --no-all                               — opposite of --all
  //   --chmod=+x / --chmod=-x                — no-op (FS lacks reliable modes)
  //   --renormalize                          — no-op (no autocrlf in tutorial)
  //   --refresh                              — no-op (we always re-stage)
  //   --pathspec-from-file=<f>               — read pathspecs from file
  //   --pathspec-file-nul                    — accepted (with above)
  //   -p / -i / -e                           — interactive; rejected with hint
  var addAll = false, updateOnly = false, ignoreRemoval = false;
  var dryRun = false, verbose = false, intentToAdd = false;
  var ignoreErrors = false;
  var pathspecs = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    // `--a` is a project-local alias for `-A`/`--all`. Real git doesn't
    // accept it, but learners reach for the long-form `--` first; tolerating
    // `--a` saves an avoidable "unknown switch" confusion.
    if (a === '-A' || a === '--all' || a === '--a' || a === '--no-ignore-removal') { addAll = true; ignoreRemoval = false; continue; }
    if (a === '--ignore-removal' || a === '--no-all') { ignoreRemoval = true; addAll = false; continue; }
    if (a === '-u' || a === '--update')       { updateOnly = true; continue; }
    if (a === '-n' || a === '--dry-run')      { dryRun = true; continue; }
    if (a === '-v' || a === '--verbose')      { verbose = true; continue; }
    if (a === '-f' || a === '--force')        { continue; /* no ignore handling yet */ }
    if (a === '-N' || a === '--intent-to-add') { intentToAdd = true; continue; }
    if (a === '--ignore-errors')              { ignoreErrors = true; continue; }
    if (a.indexOf('--chmod=') === 0)          { continue; }
    if (a === '--renormalize' || a === '--refresh') { continue; }
    if (a === '--sparse' || a === '--no-warn-embedded-repo') { continue; }
    if (a === '-p' || a === '--patch' || a === '-i' || a === '--interactive' ||
        a === '-e' || a === '--edit') {
      return _gitReply(id, '',
        "error: " + a + " is not supported in this terminal (no interactive editor).\n", 1, []);
    }
    if (a === '--pathspec-from-file' || a.indexOf('--pathspec-from-file=') === 0) {
      var f = (a === '--pathspec-from-file') ? args[++i] : a.substring('--pathspec-from-file='.length);
      try {
        var t = pyodide.FS.readFile(_normalizePath(cwd, dir, f), { encoding: 'utf8' });
        t.split(/\r?\n/).forEach(function (l) { if (l) pathspecs.push(l); });
      } catch (e) {
        return _gitReply(id, '', "fatal: cannot read pathspec file '" + f + "'\n", 1, []);
      }
      continue;
    }
    if (a === '--pathspec-file-nul') { continue; }
    if (a === '--')                  { continue; }
    if (a.charAt(0) === '-') {
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
    var report = '';
    rows.forEach(function (row) {
      var fp = row[0]; if (seen[fp]) return; seen[fp] = true;
      var H = row[1], W = row[2];
      var abs = dir + '/' + fp;
      var exists = true;
      try { pyodide.FS.stat(abs); } catch (e) { exists = false; }
      if (!exists) {
        // File is gone in the working tree. With --ignore-removal, do nothing.
        if (ignoreRemoval) return;
        if (H === 0) return; // never tracked AND gone — nothing to do
        if (verbose || dryRun) report += "remove '" + fp + "'\n";
        if (!dryRun) ops.push(_git.remove({ fs: fs, dir: dir, filepath: fp }).catch(function (e) {
          if (ignoreErrors) return null;
          throw e;
        }));
        return;
      }
      if (updateOnly && H === 0) {
        // `-u` only updates already-tracked files.
        return;
      }
      if (verbose || dryRun) report += "add '" + fp + "'\n";
      if (dryRun) return;
      if (intentToAdd && H === 0) {
        // -N: register an empty-blob index entry so the file shows in the
        // index without staging the content. iso-git lacks a direct API; the
        // closest approximation is to add the file then immediately treat it
        // as unstaged-for-content. This isn't strictly correct, but matches
        // the practical effect for tutorial use.
        ops.push(_git.add({ fs: fs, dir: dir, filepath: fp }).catch(function (e) {
          if (ignoreErrors) return null;
          throw e;
        }));
        return;
      }
      ops.push(_git.add({ fs: fs, dir: dir, filepath: fp }).catch(function (e) {
        if (ignoreErrors) return null;
        throw e;
      }));
    });
    return Promise.all(ops).then(function () { return report; });
  }).then(function (report) {
    _gitReply(id, report || '', '', 0, []);
  }).catch(function (err) {
    _gitReply(id, '', (/^fatal:/.test(err.message) ? '' : 'fatal: ') + err.message + '\n', 1, []);
  });
}

function _gitCmdCommit(id, args, dir, fs) {
  // Flags accepted (matches real git's stable flag set):
  //   -m / --message=<msg>                   — commit message (repeatable)
  //   -F / --file=<file>                     — read message from file
  //   -a / --all                             — stage tracked-changed first
  //   -am / -ma <msg>                        — combo: -a + -m <msg>
  //   --allow-empty                          — allow no-staged-changes commit
  //   --allow-empty-message                  — allow empty message
  //   --amend                                — replace tip commit
  //   --no-edit                              — keep prior message on amend
  //   -C / --reuse-message=<commit>          — reuse a commit's message
  //   -c / --reedit-message=<commit>         — reuse + edit; we treat as -C
  //   --reset-author                         — set author to current config
  //   --author=<name <email>>                — override author
  //   --date=<date>                          — override author date
  //   -s / --signoff                         — append Signed-off-by
  //   --no-signoff                           — disable signoff
  //   -q / --quiet                           — suppress success line
  //   -v / --verbose                         — accepted; no diff in output
  //   -n / --no-verify                       — accepted (no hooks anyway)
  //   --verify                               — accepted; default
  //   -S / --gpg-sign / --no-gpg-sign        — accepted; not implemented
  //   --cleanup=<mode>                       — accepted; we skip ws cleanup
  //   --trailer <key>=<value>                — append `key: value` trailer
  //   -t / --template / -e / --edit          — interactive; rejected with hint
  //   --pathspec-from-file=<f>               — read pathspecs from file
  //   --dry-run                              — accepted; behaves like --short
  var messages = [];
  var fromFile = null;
  var stageAll = false;
  var allowEmpty = false, allowEmptyMessage = false;
  var amend = false;
  var noEdit = false;
  var reuseFrom = null;
  var resetAuthor = false;
  var authorOverride = null;
  var dateOverride = null;
  var signoff = false;
  var quiet = false;
  var trailers = [];
  var pathspecs = [];
  var dryRun = false;
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-m' || a === '--message') { messages.push(args[++i] || ''); continue; }
    if (a.indexOf('--message=') === 0)   { messages.push(a.substring('--message='.length)); continue; }
    if (a === '-am' || a === '-ma')      { stageAll = true; messages.push(args[++i] || ''); continue; }
    if (a === '-a' || a === '--all')     { stageAll = true; continue; }
    if (a === '-F' || a === '--file')    { fromFile = args[++i]; continue; }
    if (a.indexOf('--file=') === 0)      { fromFile = a.substring('--file='.length); continue; }
    if (a === '--allow-empty')           { allowEmpty = true; continue; }
    if (a === '--allow-empty-message')   { allowEmptyMessage = true; continue; }
    if (a === '--amend')                 { amend = true; continue; }
    if (a === '--no-edit')               { noEdit = true; continue; }
    if (a === '-C' || a === '--reuse-message') { reuseFrom = args[++i]; continue; }
    if (a.indexOf('--reuse-message=') === 0)   { reuseFrom = a.substring('--reuse-message='.length); continue; }
    if (a === '-c' || a === '--reedit-message') { reuseFrom = args[++i]; continue; }
    if (a.indexOf('--reedit-message=') === 0)   { reuseFrom = a.substring('--reedit-message='.length); continue; }
    if (a === '--reset-author')          { resetAuthor = true; continue; }
    if (a.indexOf('--author=') === 0)    { authorOverride = a.substring('--author='.length); continue; }
    if (a === '--author')                { authorOverride = args[++i]; continue; }
    if (a.indexOf('--date=') === 0)      { dateOverride = a.substring('--date='.length); continue; }
    if (a === '--date')                  { dateOverride = args[++i]; continue; }
    if (a === '-s' || a === '--signoff') { signoff = true; continue; }
    if (a === '--no-signoff')            { signoff = false; continue; }
    if (a === '-q' || a === '--quiet')   { quiet = true; continue; }
    if (a === '-v' || a === '--verbose') { continue; }
    if (a === '-n' || a === '--no-verify' || a === '--verify') { continue; }
    if (a === '-S' || a === '--gpg-sign' || a === '--no-gpg-sign' || a.indexOf('--gpg-sign=') === 0) { continue; }
    if (a.indexOf('--cleanup=') === 0)   { continue; }
    if (a === '--trailer')               { trailers.push(args[++i]); continue; }
    if (a.indexOf('--trailer=') === 0)   { trailers.push(a.substring('--trailer='.length)); continue; }
    if (a === '--dry-run')               { dryRun = true; continue; }
    if (a === '-t' || a === '--template' || a === '-e' || a === '--edit') {
      return _gitReply(id, '',
        "error: " + a + " is not supported in this terminal (no interactive editor).\n", 1, []);
    }
    if (a === '--squash' || a === '--fixup' || a.indexOf('--squash=') === 0 || a.indexOf('--fixup=') === 0) {
      // Skip: requires rebase --autosquash flow.
      return _gitReply(id, '', "error: " + a.split('=')[0] + " is not supported in this terminal.\n", 1, []);
    }
    if (a.indexOf('--pathspec-from-file=') === 0 || a === '--pathspec-from-file') {
      var pf = (a === '--pathspec-from-file') ? args[++i] : a.substring('--pathspec-from-file='.length);
      try {
        var t = pyodide.FS.readFile(_normalizePath(_gitDir, dir, pf), { encoding: 'utf8' });
        t.split(/\r?\n/).forEach(function (l) { if (l) pathspecs.push(l); });
      } catch (e) { /* missing file — ignore */ }
      continue;
    }
    if (a === '--pathspec-file-nul')     { continue; }
    if (a === '--')                      { continue; }
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
    pathspecs.push(a);
  }

  // Resolve message: combine -m repeats with blank lines, or read from -F.
  var message = messages.length ? messages.join('\n\n') : null;
  if (fromFile) {
    try { message = pyodide.FS.readFile(_normalizePath(_gitDir, dir, fromFile), { encoding: 'utf8' }); }
    catch (e) { return _gitReply(id, '', "fatal: cannot read message file '" + fromFile + "'\n", 1, []); }
  }

  // -C/--reuse-message: pull the message from <commit> when not overridden.
  var reusePromise = reuseFrom
    ? _resolveCommitish(fs, dir, reuseFrom)
        .then(function (oid) { return _git.readCommit({ fs: fs, dir: dir, oid: oid }); })
        .then(function (c) { return c.commit; })
        .catch(function (err) {
          throw new Error("could not read commit '" + reuseFrom + "': " + (err.message || err));
        })
    : Promise.resolve(null);

  reusePromise.then(function (reusedCommit) {
    if (reusedCommit) {
      if (message === null) message = reusedCommit.message || '';
    }
    if (!message && !amend && !allowEmptyMessage) {
      return Promise.reject(new Error("Aborting: no commit message. Use -m \"...\"."));
    }
    if (!message && amend && noEdit) {
      // Will pull from the existing tip below.
    }

    // Path-restricted commit (`git commit <pathspecs>`): only stage the
    // requested paths first, then commit. This mirrors real git's behavior.
    var stagePromise;
    if (pathspecs.length > 0) {
      stagePromise = _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
        return Promise.all(matrix.map(function (row) {
          var fp = row[0]; var match = pathspecs.some(function (ps) {
            if (ps === '.') return true;
            return fp === ps || fp.indexOf(ps + '/') === 0;
          });
          if (!match) return null;
          var H = row[1], W = row[2];
          if (H === 1 && W === 0) return _git.remove({ fs: fs, dir: dir, filepath: fp });
          if (W !== 1) return _git.add({ fs: fs, dir: dir, filepath: fp });
          return null;
        }));
      });
    } else if (stageAll) {
      stagePromise = _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
        return Promise.all(matrix.map(function (row) {
          var fp = row[0], H = row[1], W = row[2];
          if (H === 1 && W === 0) return _git.remove({ fs: fs, dir: dir, filepath: fp });
          if (H === 1 && W !== 1) return _git.add({ fs: fs, dir: dir, filepath: fp });
          return null;
        }));
      });
    } else {
      stagePromise = Promise.resolve();
    }

    return stagePromise.then(function () {
      // Verify there's something staged unless --allow-empty (or --amend).
      if (allowEmpty || amend) return null;
      return _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
        var anyStaged = matrix.some(function (row) {
          var H = row[1], S = row[3];
          if (H === 0 && S !== 0) return true;
          if (H === 1 && S !== 1) return true;
          return false;
        });
        if (!anyStaged) return Promise.reject(new Error('__NOTHING_STAGED__'));
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
      var oldOid = cfg[3];

      // Author override: real git accepts "Name <email>" or just an email.
      var author = { name: name, email: email };
      if (authorOverride) {
        var amatch = authorOverride.match(/^(.*?)\s*<(.+)>\s*$/);
        if (amatch) { author = { name: amatch[1].trim(), email: amatch[2].trim() }; }
        else if (/@/.test(authorOverride)) { author = { name: name, email: authorOverride.trim() }; }
        else { author = { name: authorOverride.trim(), email: email }; }
      }
      // For amend with --reset-author OR explicit --author: rewrite author.
      // Otherwise on amend, real git keeps the original author. iso-git's
      // commit({amend:true}) re-uses author from the existing commit when not
      // overridden — we override here only when asked.
      if (amend && !resetAuthor && !authorOverride) {
        author = undefined;  // let iso-git inherit
      }

      // Date override: parse to UNIX epoch (seconds).
      var ts = null;
      if (dateOverride) {
        ts = _parseDate(dateOverride);
        if (ts === null) {
          return Promise.reject(new Error("invalid date format: " + dateOverride));
        }
      }
      if (ts !== null && author) {
        author.timestamp = ts;
      }

      // For amend without a new message and with --no-edit (or no -m given):
      // reuse the existing tip's message.
      var amendInherit = (amend && message === null);
      var finalMessage = amendInherit
        ? null  // let iso-git keep the prior message
        : (message || '');

      // Append signoff trailer.
      if (signoff && finalMessage !== null) {
        var sig = 'Signed-off-by: ' + (author && author.name || name) +
                  ' <' + (author && author.email || email) + '>';
        if (finalMessage.indexOf(sig) === -1) {
          finalMessage = (finalMessage.replace(/\n+$/, '') + '\n\n' + sig + '\n');
        }
      }
      // Append other trailers (e.g., --trailer "Co-authored-by: ...").
      if (trailers.length && finalMessage !== null) {
        finalMessage = finalMessage.replace(/\n+$/, '') + '\n\n' +
          trailers.map(function (t) { return t; }).join('\n') + '\n';
      }

      if (dryRun) {
        // Behave like `git status --short` for dry-run.
        return _gitCmdStatus(id, ['--short'], dir, fs, dir);
      }

      var commitArgs = { fs: fs, dir: dir };
      if (finalMessage !== null) commitArgs.message = finalMessage;
      if (author) commitArgs.author = author;
      if (amend) commitArgs.amend = true;
      // Read existing message for amend-no-edit if iso-git won't auto-inherit.
      var amendReadMsg = (amend && finalMessage === null && oldOid)
        ? _git.readCommit({ fs: fs, dir: dir, oid: oldOid }).then(function (c) {
            commitArgs.message = c.commit.message;
          })
        : Promise.resolve();
      return amendReadMsg.then(function () {
        return _git.commit(commitArgs);
      }).then(function (oid) {
        var shortHash = oid.substring(0, 7);
        var resolvedSubject = (commitArgs.message || message || '').split('\n')[0];
        var prefix = hadHead && !amend ? '' : '(root-commit) ';
        _appendReflog(dir, 'HEAD', oldOid, oid,
          'commit' + (amend ? ' (amend)' : (!hadHead ? ' (initial)' : '')) + ': ' + resolvedSubject);
        if (branch && branch !== 'HEAD') {
          _appendReflog(dir, 'refs/heads/' + branch, oldOid, oid,
            'commit' + (amend ? ' (amend)' : (!hadHead ? ' (initial)' : '')) + ': ' + resolvedSubject);
        }
        if (quiet) {
          _gitReply(id, '', '', 0, []);
        } else {
          _gitReply(id, '[' + branch + ' ' + prefix + shortHash + '] ' + resolvedSubject + '\n', '', 0, []);
        }
      });
    });
  }).catch(function (err) {
    if (err && err.message === '__NOTHING_STAGED__') {
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

function _gitCmdLog(id, args, dir, fs, cwd) {
  // Supported flags (most of real git's commonly-used set):
  //   --oneline                            — short format
  //   --all                                — log from all branches (deduped)
  //   --branches / --tags / --remotes      — log from those refs
  //   -n <count> / --max-count=<n>         — limit results
  //   --skip=<n>                           — skip the first N
  //   --graph                              — ASCII graph alongside log
  //   --decorate[=<mode>] / --no-decorate  — show ref annotations
  //   --abbrev-commit / --no-abbrev-commit — short oids in long format
  //   --pretty=<format> / --format=<format>— oneline/short/medium/full/format:<...>
  //   --author=<pat> / --grep=<pat>        — filter by author / message
  //   -i / --regexp-ignore-case            — case-insensitive grep/author
  //   -E / --extended-regexp               — accepted (we always use JS regex)
  //   --since=<date> / --until=<date>      — time bounds
  //   --before / --after                   — aliases
  //   --reverse                            — oldest first
  //   --no-merges / --merges               — exclude / include merges
  //   --first-parent                       — only follow first parent
  //   -p / --patch                         — show diff against parent
  //   --name-only / --name-status / --stat — file lists / stats
  //   -S<string> / -G<regex>               — pickaxe (string in diff / regex)
  //   --reflog                             — walk HEAD reflog instead of refs
  //   --                                   — pathspec separator
  //   <ref>..<ref>                         — exclude reachable from left
  //   <ref>...<ref>                        — symmetric difference
  //   <ref>                                — start from <ref> instead of HEAD
  //   <path>...                            — limit to commits touching path
  var oneline = false, showAll = false, showBranches = false, showTags = false, showRemotes = false;
  var depth = null, skip = 0;
  var graph = false, decorate = true, abbrev = false;
  var prettyFormat = null;
  var authorPat = null, grepPat = null, ignoreCase = false;
  var since = null, until = null;
  var reverse = false, noMerges = false, onlyMerges = false, firstParent = false;
  var showPatch = false, showStat = false, nameOnly = false, nameStatus = false;
  var pickaxeS = null, pickaxeG = null;
  var fromReflog = false;
  var refsArg = [];
  var paths = [];
  var sawDD = false;
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (sawDD) { paths.push(a); continue; }
    if (a === '--')                      { sawDD = true; continue; }
    if (a === '--oneline')               { oneline = true; prettyFormat = 'oneline'; abbrev = true; continue; }
    if (a === '--all')                   { showAll = true; continue; }
    if (a === '--branches')              { showBranches = true; continue; }
    if (a === '--tags')                  { showTags = true; continue; }
    if (a === '--remotes')               { showRemotes = true; continue; }
    if (a === '--graph')                 { graph = true; continue; }
    if (a === '--no-graph')              { graph = false; continue; }
    if (a === '--decorate')              { decorate = true; continue; }
    if (a === '--no-decorate')           { decorate = false; continue; }
    if (a.indexOf('--decorate=') === 0)  { decorate = a.substring('--decorate='.length) !== 'no'; continue; }
    if (a === '--abbrev-commit')         { abbrev = true; continue; }
    if (a === '--no-abbrev-commit')      { abbrev = false; continue; }
    if (a === '--reverse')               { reverse = true; continue; }
    if (a === '--no-merges')             { noMerges = true; continue; }
    if (a === '--merges')                { onlyMerges = true; continue; }
    if (a === '--first-parent')          { firstParent = true; continue; }
    if (a === '-p' || a === '--patch')   { showPatch = true; continue; }
    if (a === '--no-patch' || a === '-s'){ showPatch = false; continue; }
    if (a === '--stat')                  { showStat = true; continue; }
    if (a === '--name-only')             { nameOnly = true; continue; }
    if (a === '--name-status')           { nameStatus = true; continue; }
    if (a === '--shortstat')             { showStat = true; continue; }
    if (a === '--reflog')                { fromReflog = true; continue; }
    if (a === '-i' || a === '--regexp-ignore-case') { ignoreCase = true; continue; }
    if (a === '-E' || a === '--extended-regexp')    { /* default */ continue; }
    if (a === '-F' || a === '--fixed-strings')      { continue; }
    if (a === '-n' || a === '--max-count') {
      var n = parseInt(args[i + 1], 10); if (!isNaN(n)) depth = n; i++; continue;
    }
    if (a.indexOf('--max-count=') === 0) {
      var n2 = parseInt(a.substring('--max-count='.length), 10); if (!isNaN(n2)) depth = n2; continue;
    }
    if (a.indexOf('-n') === 0 && /^-n\d+$/.test(a)) {
      depth = parseInt(a.substring(2), 10); continue;
    }
    if (a === '--skip') { skip = parseInt(args[i + 1], 10) || 0; i++; continue; }
    if (a.indexOf('--skip=') === 0) { skip = parseInt(a.substring('--skip='.length), 10) || 0; continue; }
    if (a.indexOf('--pretty=') === 0)    { prettyFormat = a.substring('--pretty='.length); continue; }
    if (a === '--pretty')                { prettyFormat = args[i + 1] || 'medium'; i++; continue; }
    if (a.indexOf('--format=') === 0)    { prettyFormat = 'format:' + a.substring('--format='.length); continue; }
    if (a.indexOf('--author=') === 0)    { authorPat = a.substring('--author='.length); continue; }
    if (a === '--author')                { authorPat = args[i + 1] || ''; i++; continue; }
    if (a.indexOf('--grep=') === 0)      { grepPat = a.substring('--grep='.length); continue; }
    if (a === '--grep')                  { grepPat = args[i + 1] || ''; i++; continue; }
    if (a.indexOf('--since=') === 0)     { since = _parseDate(a.substring('--since='.length)); continue; }
    if (a.indexOf('--after=') === 0)     { since = _parseDate(a.substring('--after='.length)); continue; }
    if (a.indexOf('--until=') === 0)     { until = _parseDate(a.substring('--until='.length)); continue; }
    if (a.indexOf('--before=') === 0)    { until = _parseDate(a.substring('--before='.length)); continue; }
    if (a.indexOf('-S') === 0 && a.length > 2) { pickaxeS = a.substring(2); continue; }
    if (a.indexOf('-G') === 0 && a.length > 2) { pickaxeG = a.substring(2); continue; }
    if (a === '-S')                      { pickaxeS = args[i + 1] || ''; i++; continue; }
    if (a === '-G')                      { pickaxeG = args[i + 1] || ''; i++; continue; }
    if (a === '--abbrev' || a.indexOf('--abbrev=') === 0) { abbrev = true; continue; }
    if (a === '--full-history' || a === '--simplify-by-decoration' ||
        a === '--topo-order' || a === '--date-order' || a === '--author-date-order' ||
        a === '--no-color' || a === '--color' || a.indexOf('--color=') === 0 ||
        a.indexOf('--date=') === 0) {
      continue;  // accepted, ignored
    }
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
    refsArg.push(a);
  }

  // Pathspec semantics: any positional after refs that names a file (not a
  // ref) becomes a pathspec. Real git uses "--" to disambiguate, but accepts
  // this heuristic too. We split refs vs paths based on whether the arg
  // resolves as a ref OR exists as a working-tree path.
  var splitArgs = [];
  if (paths.length === 0 && refsArg.length > 0) {
    // Check each refsArg: does it look like a path?
    var refs2 = [];
    refsArg.forEach(function (a) {
      var abs = _normalizePath(cwd || dir, dir, a);
      var isPath = false;
      try { pyodide.FS.stat(abs); isPath = true; } catch (e) {}
      if (isPath && refs2.length > 0) paths.push(a); else refs2.push(a);
    });
    refsArg = refs2;
  }

  if (refsArg.length === 0 && !showAll && !showBranches && !showTags && !showRemotes && !fromReflog) {
    refsArg = ['HEAD'];
  }

  // Parse refs that contain `..` or `...` as ranges.
  var includes = [], excludes = [];
  function parseRefArg(a) {
    var symMatch = a.match(/^(.*)\.\.\.(.*)$/);
    if (symMatch) {
      // a...b: symmetric difference
      var L = symMatch[1] || 'HEAD', R = symMatch[2] || 'HEAD';
      return Promise.all([_resolveCommitish(fs, dir, L), _resolveCommitish(fs, dir, R)]).then(function (r) {
        return _git.findMergeBase ? _git.findMergeBase({ fs: fs, dir: dir, oids: [r[0], r[1]] }) : Promise.resolve([]);
      }).then(function (mb) {
        includes.push.apply(includes, [symMatch[1] || 'HEAD', symMatch[2] || 'HEAD']);
        if (mb && mb[0]) excludes.push(mb[0]);
      });
    }
    var rngMatch = a.match(/^(.*)\.\.(.*)$/);
    if (rngMatch) {
      var L2 = rngMatch[1] || 'HEAD', R2 = rngMatch[2] || 'HEAD';
      excludes.push(L2);
      includes.push(R2);
      return Promise.resolve();
    }
    if (a.charAt(0) === '^') {
      excludes.push(a.substring(1));
      return Promise.resolve();
    }
    includes.push(a);
    return Promise.resolve();
  }

  Promise.all(refsArg.map(parseRefArg)).then(function () {
    // Add multi-ref expansions.
    var listFns = [];
    if (showAll || showBranches) {
      listFns.push(_git.listBranches({ fs: fs, dir: dir }).catch(function () { return []; }));
    }
    if (showAll || showTags) {
      listFns.push(_git.listTags ? _git.listTags({ fs: fs, dir: dir }).catch(function () { return []; })
                                 : Promise.resolve([]));
    }
    if (showAll || showRemotes) {
      listFns.push(_git.listBranches({ fs: fs, dir: dir, remote: 'origin' }).catch(function () { return []; })
        .then(function (rs) { return rs.map(function (r) { return 'remotes/origin/' + r; }); }));
    }
    return Promise.all(listFns).then(function (lists) {
      lists.forEach(function (l) { l.forEach(function (r) { includes.push(r); }); });
    });
  }).then(function () {
    if (fromReflog) {
      // Walk HEAD reflog as a sequence of commits.
      var reflogPath = dir + '/.git/logs/HEAD';
      var content = ''; try { content = pyodide.FS.readFile(reflogPath, { encoding: 'utf8' }); } catch (e) {}
      var lines = content.split('\n').filter(Boolean);
      var oids = [];
      for (var li = lines.length - 1; li >= 0; li--) {
        var p = _parseReflogLine(lines[li]); if (p && p.newOid) oids.push(p.newOid);
      }
      return Promise.all(oids.map(function (o) {
        return _git.readCommit({ fs: fs, dir: dir, oid: o }).catch(function () { return null; });
      })).then(function (rs) { return rs.filter(Boolean); });
    }
    return _walkRefsCollect(dir, fs, includes, excludes, firstParent);
  }).then(function (entries) {
    return _decoratedRefs(dir, fs, decorate).then(function (decoMap) {
      // Branch / tag annotations for `--decorate`.
      var noEntries = !entries || entries.length === 0;
      if (noEntries) {
        // Empty result is not always an error: e.g. `--all` with no commits.
        if (refsArg.length === 1 && refsArg[0] === 'HEAD') {
          return _gitReply(id, '',
            "fatal: your current branch does not have any commits yet\n", 1, []);
        }
        return _gitReply(id, '', '', 0, []);
      }

      // Filter by author / grep / date / merges / pickaxe.
      var flags = ignoreCase ? 'i' : '';
      var authRx = authorPat ? new RegExp(authorPat, flags) : null;
      var grepRx = grepPat   ? new RegExp(grepPat, flags)   : null;
      var filtered = [];
      var pickPaths = paths.map(function (p) {
        var abs = _normalizePath(cwd || dir, dir, p);
        return _toRel(dir, abs);
      }).filter(Boolean);

      var pendingDiffs = entries.map(function (e) {
        if (noMerges && (e.commit.parent || []).length > 1) return null;
        if (onlyMerges && (e.commit.parent || []).length <= 1) return null;
        if (e.commit.author) {
          var ts = e.commit.author.timestamp || 0;
          if (since !== null && ts < since) return null;
          if (until !== null && ts > until) return null;
          var who = e.commit.author.name + ' <' + e.commit.author.email + '>';
          if (authRx && !authRx.test(who)) return null;
        }
        if (grepRx && !grepRx.test(e.commit.message || '')) return null;
        return e;
      }).filter(Boolean);

      // Path / pickaxe filtering both require comparing trees; piggy-back.
      var needTree = pickPaths.length > 0 || pickaxeS !== null || pickaxeG !== null ||
                     showPatch || showStat || nameOnly || nameStatus;

      function matchEntry(e) {
        if (!needTree) return Promise.resolve(true);
        var parent = (e.commit.parent || [])[0] || null;
        var lf = {}, rf = {};
        var pl = parent ? _walkCommitTree(fs, dir, parent, lf, '') : Promise.resolve();
        var pr = _walkCommitTree(fs, dir, e.oid, rf, '');
        return Promise.all([pl, pr]).then(function () {
          // Determine changed paths
          var changed = {};
          Object.keys(lf).forEach(function (k) { if (lf[k] !== rf[k]) changed[k] = true; });
          Object.keys(rf).forEach(function (k) { if (lf[k] !== rf[k]) changed[k] = true; });
          if (pickPaths.length > 0) {
            var hit = false;
            Object.keys(changed).forEach(function (p) {
              pickPaths.forEach(function (pp) {
                if (p === pp || p.indexOf(pp + '/') === 0) hit = true;
              });
            });
            if (!hit) return false;
          }
          if (pickaxeS !== null || pickaxeG !== null) {
            var paxRx = pickaxeG !== null ? new RegExp(pickaxeG) : null;
            var hit2 = false;
            Object.keys(changed).forEach(function (p) {
              var l = lf[p] || '', r = rf[p] || '';
              if (pickaxeS !== null) {
                var lc = (l.match(new RegExp(pickaxeS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                var rc = (r.match(new RegExp(pickaxeS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                if (lc !== rc) hit2 = true;
              }
              if (paxRx && (paxRx.test(l) !== paxRx.test(r))) hit2 = true;
            });
            if (!hit2) return false;
          }
          // Cache the precomputed trees on the entry so the formatter doesn't re-read.
          e._lf = lf; e._rf = rf; e._changed = Object.keys(changed).sort();
          return true;
        });
      }

      return Promise.all(pendingDiffs.map(function (e) {
        return matchEntry(e).then(function (ok) { return ok ? e : null; });
      })).then(function (rs) {
        return rs.filter(Boolean);
      });
    }).then(function (entries) {
      if (reverse) entries.reverse();
      if (skip) entries = entries.slice(skip);
      if (depth !== null) entries = entries.slice(0, depth);

      if (entries.length === 0) {
        return _gitReply(id, '', '', 0, []);
      }

      return _decoratedRefs(dir, fs, decorate).then(function (decoMap) {
        var out = '';
        // Pre-build columns for --graph: assign each commit a lane.
        var lanes = graph ? _layoutLanes(entries) : null;
        entries.forEach(function (e, idx) {
          var glyph = '';
          if (graph) glyph = (lanes[idx].asciiPrefix || '* ');
          out += _formatLogEntry(e, {
            oneline: oneline, decorate: decorate, decoMap: decoMap,
            abbrev: abbrev, prettyFormat: prettyFormat, graph: graph, glyph: glyph,
            showPatch: showPatch, showStat: showStat,
            nameOnly: nameOnly, nameStatus: nameStatus,
          });
        });
        _gitReply(id, out, '', 0, []);
      });
    });
  }).catch(function (err) {
    if (err && (err.code === 'NotFoundError' || /HEAD/i.test(err.message || ''))) {
      _gitReply(id, '', "fatal: your current branch does not have any commits yet\n", 1, []);
    } else {
      _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
    }
  });
}

// Parse a date string (ISO, "2 weeks ago", "yesterday", numeric epoch, etc.)
// into a UNIX epoch (seconds). Returns null if unparseable.
function _parseDate(s) {
  if (!s) return null;
  s = String(s).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  // Try Date.parse first — it handles ISO and most absolute formats.
  var t = Date.parse(s);
  if (!isNaN(t)) return Math.floor(t / 1000);
  // Relative: "<n> <unit> ago"
  var rel = s.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i);
  if (rel) {
    var num = parseInt(rel[1], 10);
    var unit = rel[2].toLowerCase();
    var sec = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2592000, year: 31536000 }[unit];
    return Math.floor(Date.now() / 1000) - num * sec;
  }
  if (s === 'yesterday') return Math.floor(Date.now() / 1000) - 86400;
  return null;
}

// Walk the commits reachable from `includes`, excluding those reachable from
// `excludes`. Returns commit entries newest-first by author timestamp.
function _walkRefsCollect(dir, fs, includes, excludes, firstParent) {
  var fs_ = _gitFsAdapter;
  return Promise.all((excludes || []).map(function (r) {
    return _resolveCommitish(fs_, dir, r).catch(function () { return null; });
  })).then(function (excludeOids) {
    var excludeSet = {};
    var seedExclusion = excludeOids.filter(Boolean);
    return _expandReachable(dir, fs_, seedExclusion, firstParent).then(function (allExcl) {
      allExcl.forEach(function (o) { excludeSet[o] = true; });
      return Promise.all((includes || []).map(function (r) {
        return _resolveCommitish(fs_, dir, r).catch(function () { return null; });
      })).then(function (incOids) {
        var seen = {}, entries = [];
        function walk(oid) {
          if (!oid || seen[oid] || excludeSet[oid]) return Promise.resolve();
          seen[oid] = true;
          return _git.readCommit({ fs: fs_, dir: dir, oid: oid }).then(function (c) {
            entries.push({ oid: oid, commit: c.commit });
            var ps = c.commit.parent || [];
            if (firstParent) ps = ps.slice(0, 1);
            return ps.reduce(function (p, parent) {
              return p.then(function () { return walk(parent); });
            }, Promise.resolve());
          }).catch(function () { /* unreachable */ });
        }
        return incOids.filter(Boolean).reduce(function (p, oid) {
          return p.then(function () { return walk(oid); });
        }, Promise.resolve()).then(function () {
          entries.sort(function (a, b) {
            var ta = (a.commit.author && a.commit.author.timestamp) || 0;
            var tb = (b.commit.author && b.commit.author.timestamp) || 0;
            return tb - ta;
          });
          return entries;
        });
      });
    });
  });
}

// For ref-exclusion: collect every reachable oid from the seed list.
function _expandReachable(dir, fs, seeds, firstParent) {
  var seen = {};
  function step(oid) {
    if (!oid || seen[oid]) return Promise.resolve();
    seen[oid] = true;
    return _git.readCommit({ fs: fs, dir: dir, oid: oid }).then(function (c) {
      var ps = c.commit.parent || [];
      if (firstParent) ps = ps.slice(0, 1);
      return ps.reduce(function (p, par) { return p.then(function () { return step(par); }); }, Promise.resolve());
    }).catch(function () { /* missing */ });
  }
  return (seeds || []).reduce(function (p, oid) {
    return p.then(function () { return step(oid); });
  }, Promise.resolve()).then(function () { return Object.keys(seen); });
}

// Build a {oid: ['main','origin/main','HEAD -> main','tag: v1']} map for `--decorate`.
function _decoratedRefs(dir, fs, decorate) {
  if (!decorate) return Promise.resolve({});
  return Promise.all([
    _git.listBranches({ fs: fs, dir: dir }).catch(function () { return []; }),
    _git.listTags ? _git.listTags({ fs: fs, dir: dir }).catch(function () { return []; }) : Promise.resolve([]),
    _git.listBranches({ fs: fs, dir: dir, remote: 'origin' }).catch(function () { return []; }),
    _git.currentBranch({ fs: fs, dir: dir }).catch(function () { return null; }),
    _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
  ]).then(function (r) {
    var branches = r[0], tags = r[1], remoteBranches = r[2], curBranch = r[3], headOid = r[4];
    var map = {};
    function add(oid, label) {
      if (!oid) return;
      if (!map[oid]) map[oid] = [];
      map[oid].push(label);
    }
    return Promise.all(branches.map(function (b) {
      return _git.resolveRef({ fs: fs, dir: dir, ref: b }).then(function (oid) {
        add(oid, b === curBranch ? 'HEAD -> ' + b : b);
      }).catch(function () {});
    })).then(function () {
      return Promise.all(tags.map(function (t) {
        return _git.resolveRef({ fs: fs, dir: dir, ref: 'refs/tags/' + t }).then(function (oid) {
          add(oid, 'tag: ' + t);
        }).catch(function () {});
      }));
    }).then(function () {
      return Promise.all(remoteBranches.map(function (b) {
        return _git.resolveRef({ fs: fs, dir: dir, ref: 'refs/remotes/origin/' + b }).then(function (oid) {
          add(oid, 'origin/' + b);
        }).catch(function () {});
      }));
    }).then(function () {
      // If detached HEAD (no current branch but headOid exists), add bare 'HEAD'
      // decoration on that commit.
      if (!curBranch && headOid) add(headOid, 'HEAD');
      return map;
    });
  });
}

// Layout lanes for --graph. Tutorial-grade: every commit gets `* ` and merges
// get a multi-character prefix to suggest the graph. A real Myers-style
// drawing is overkill for tutorial-sized history.
function _layoutLanes(entries) {
  return entries.map(function (e) {
    var p = (e.commit.parent || []).length;
    var glyph = p > 1 ? '*-. ' : '* ';
    return { asciiPrefix: glyph };
  });
}

function _formatLogEntry(e, opts) {
  var YELLOW = '\x1b[33m', RESET = '\x1b[m', CYAN = '\x1b[36m';
  var BOLD = '\x1b[1m', GREEN = '\x1b[32m', RED = '\x1b[31m';
  var oid = e.oid;
  var shortOid = oid.substring(0, 7);
  var subject = ((e.commit && e.commit.message) || '').split('\n')[0];
  var message = (e.commit && e.commit.message) || '';
  var deco = '';
  if (opts.decorate && opts.decoMap[oid] && opts.decoMap[oid].length) {
    deco = ' ' + YELLOW + '(' + opts.decoMap[oid].join(', ') + ')' + RESET;
  }
  var glyph = opts.glyph || '';
  var oidShown = opts.abbrev ? shortOid : oid;

  // Pretty formats: oneline / short / medium (default) / full / fuller / format:<...>
  var fmt = opts.prettyFormat;
  var out = '';

  if (opts.oneline || fmt === 'oneline') {
    out += glyph + YELLOW + oidShown + RESET + deco + ' ' + subject + '\n';
    return out + _maybePatch(e, opts);
  }
  if (fmt && fmt.indexOf('format:') === 0) {
    out += glyph + _renderCustomFormat(e, fmt.substring('format:'.length), opts) + '\n';
    return out + _maybePatch(e, opts);
  }
  if (fmt && fmt.indexOf('tformat:') === 0) {
    out += glyph + _renderCustomFormat(e, fmt.substring('tformat:'.length), opts) + '\n';
    return out + _maybePatch(e, opts);
  }

  // Long format
  out += glyph + YELLOW + 'commit ' + oidShown + RESET + deco + '\n';
  if (e.commit && e.commit.parent && e.commit.parent.length > 1) {
    out += 'Merge: ' + e.commit.parent.map(function (p) { return p.substring(0, 7); }).join(' ') + '\n';
  }
  if (e.commit && e.commit.author) {
    out += 'Author: ' + e.commit.author.name + ' <' + e.commit.author.email + '>\n';
    if (e.commit.author.timestamp) {
      out += 'Date:   ' + new Date(e.commit.author.timestamp * 1000).toString() + '\n';
    }
  }
  if (fmt === 'fuller' && e.commit && e.commit.committer) {
    out += 'Commit: ' + e.commit.committer.name + ' <' + e.commit.committer.email + '>\n';
    if (e.commit.committer.timestamp) {
      out += 'CommitDate: ' + new Date(e.commit.committer.timestamp * 1000).toString() + '\n';
    }
  }
  out += '\n    ' + message.replace(/\n$/, '').replace(/\n/g, '\n    ') + '\n\n';
  out += _maybePatch(e, opts);
  return out;
}

function _renderCustomFormat(e, format, opts) {
  // Subset of git format placeholders.
  var c = e.commit || {};
  var auth = c.author || {};
  var comm = c.committer || auth;
  var ts = auth.timestamp || 0;
  return format
    .replace(/%H/g,  e.oid)
    .replace(/%h/g,  e.oid.substring(0, 7))
    .replace(/%T/g,  c.tree || '')
    .replace(/%t/g,  (c.tree || '').substring(0, 7))
    .replace(/%P/g,  (c.parent || []).join(' '))
    .replace(/%p/g,  (c.parent || []).map(function (p) { return p.substring(0, 7); }).join(' '))
    .replace(/%an/g, auth.name || '')
    .replace(/%ae/g, auth.email || '')
    .replace(/%aI/g, ts ? new Date(ts * 1000).toISOString() : '')
    .replace(/%at/g, String(ts))
    .replace(/%ad/g, ts ? new Date(ts * 1000).toString() : '')
    .replace(/%ar/g, _relativeTime(ts))
    .replace(/%cn/g, comm.name || '')
    .replace(/%ce/g, comm.email || '')
    .replace(/%ci/g, comm.timestamp ? new Date(comm.timestamp * 1000).toISOString() : '')
    .replace(/%ct/g, String(comm.timestamp || ''))
    .replace(/%s/g,  (c.message || '').split('\n')[0])
    .replace(/%b/g,  (c.message || '').split('\n').slice(1).join('\n'))
    .replace(/%B/g,  c.message || '')
    .replace(/%n/g,  '\n')
    .replace(/%%/g,  '%')
    .replace(/%d/g,  ''); // decoration handled elsewhere
}

function _relativeTime(ts) {
  if (!ts) return '';
  var diff = Math.floor(Date.now() / 1000) - ts;
  var units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400],
               ['hour', 3600], ['minute', 60], ['second', 1]];
  for (var i = 0; i < units.length; i++) {
    var n = Math.floor(diff / units[i][1]);
    if (n >= 1) return n + ' ' + units[i][0] + (n > 1 ? 's' : '') + ' ago';
  }
  return 'just now';
}

function _maybePatch(e, opts) {
  if (!opts.showPatch && !opts.showStat && !opts.nameOnly && !opts.nameStatus) return '';
  var lf = e._lf || {}, rf = e._rf || {};
  // If the entry was filtered without diff resolution, skip patching to avoid
  // stalling — log already returned the metadata.
  if (!e._changed) return '';
  var BOLD = '\x1b[1m', GREEN = '\x1b[32m', RED = '\x1b[31m', CYAN = '\x1b[36m', RESET = '\x1b[m';
  var out = '';
  e._changed.forEach(function (p) {
    var l = lf[p], r = rf[p];
    if (opts.nameOnly) { out += p + '\n'; return; }
    if (opts.nameStatus) {
      var s = (l === undefined) ? 'A' : (r === undefined) ? 'D' : 'M';
      out += s + '\t' + p + '\n';
      return;
    }
    if (opts.showStat) {
      var ll = (l || '').split('\n').length;
      var rl = (r || '').split('\n').length;
      out += ' ' + p + ' | ' + Math.max(ll, rl) + (ll > rl ? ' -' : ll < rl ? ' +' : ' ~') + '\n';
      return;
    }
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
  return out;
}

function _gitCmdBranch(id, args, dir, fs) {
  // Modes:
  //   git branch                       — list local
  //   git branch -a                    — list local + remote
  //   git branch -r                    — list remote only
  //   git branch -v / --verbose        — show oid + subject
  //   git branch --list <pattern>      — list matching glob
  //   git branch --show-current        — print current branch (or empty)
  //   git branch --contains <ref>      — only branches containing <ref>
  //   git branch --no-contains <ref>   — only branches NOT containing <ref>
  //   git branch --merged [<ref>]      — branches merged into <ref> (HEAD)
  //   git branch --no-merged [<ref>]   — branches not merged into <ref>
  //   git branch <name>                — create from HEAD
  //   git branch <name> <start>        — create from <start>
  //   git branch -d <name>             — delete (only if merged)
  //   git branch -D <name>             — force delete
  //   git branch -m <new>              — rename current
  //   git branch -m <old> <new>        — rename specific
  //   git branch -c <new>              — copy current
  //   git branch -c <old> <new>        — copy specific
  //   git branch -t / --track          — accepted; no upstream support
  //   git branch -u / --set-upstream-to=<u> — accepted; no-op
  var listAll = false, listRemote = false, verbose = false, showCurrent = false;
  var deleteName = null, forceDelete = false;
  var renameOld = null, renameNew = null;
  var copyOld = null, copyNew = null;
  var listPattern = null;
  var containsRef = null, notContainsRef = null;
  var mergedRef = null, mergedSpec = false, notMergedRef = null, notMergedSpec = false;
  var positional = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-a' || a === '--all') { listAll = true; continue; }
    if (a === '-r' || a === '--remotes') { listRemote = true; continue; }
    if (a === '-v' || a === '--verbose' || a === '-vv') { verbose = true; continue; }
    if (a === '--show-current') { showCurrent = true; continue; }
    if (a === '-l' || a === '--list') {
      // -l <pattern> OR just -l (list mode marker)
      var nx = args[i + 1];
      if (nx && nx.charAt(0) !== '-') { listPattern = nx; i++; }
      continue;
    }
    if (a === '--contains') { containsRef = args[i + 1]; i++; continue; }
    if (a.indexOf('--contains=') === 0) { containsRef = a.substring('--contains='.length); continue; }
    if (a === '--no-contains') { notContainsRef = args[i + 1]; i++; continue; }
    if (a.indexOf('--no-contains=') === 0) { notContainsRef = a.substring('--no-contains='.length); continue; }
    if (a === '--merged') {
      mergedSpec = true;
      var nx2 = args[i + 1];
      if (nx2 && nx2.charAt(0) !== '-') { mergedRef = nx2; i++; }
      continue;
    }
    if (a.indexOf('--merged=') === 0) { mergedSpec = true; mergedRef = a.substring('--merged='.length); continue; }
    if (a === '--no-merged') {
      notMergedSpec = true;
      var nx3 = args[i + 1];
      if (nx3 && nx3.charAt(0) !== '-') { notMergedRef = nx3; i++; }
      continue;
    }
    if (a.indexOf('--no-merged=') === 0) { notMergedSpec = true; notMergedRef = a.substring('--no-merged='.length); continue; }
    if (a === '-d' || a === '--delete') { deleteName = args[i + 1]; i++; continue; }
    if (a === '-D') { deleteName = args[i + 1]; forceDelete = true; i++; continue; }
    if (a === '-m' || a === '--move' || a === '-M') {
      // -m <new>  OR  -m <old> <new>
      if (args.length >= i + 3) { renameOld = args[i + 1]; renameNew = args[i + 2]; i += 2; }
      else { renameNew = args[i + 1]; i++; }
      continue;
    }
    if (a === '-c' || a === '--copy' || a === '-C') {
      if (args.length >= i + 3) { copyOld = args[i + 1]; copyNew = args[i + 2]; i += 2; }
      else { copyNew = args[i + 1]; i++; }
      continue;
    }
    if (a === '-t' || a === '--track' || a === '--no-track' || a === '-u' ||
        a.indexOf('--set-upstream-to=') === 0 || a === '--unset-upstream' ||
        a === '-q' || a === '--quiet' || a === '--ignore-case' ||
        a === '--no-color' || a === '--color' || a.indexOf('--color=') === 0 ||
        a === '--column' || a === '--no-column' || a === '--abbrev' ||
        a.indexOf('--abbrev=') === 0 || a === '--no-abbrev' ||
        a === '--sort' || a.indexOf('--sort=') === 0) {
      // Accepted, no-op for tutorial
      if (a === '--sort' || a === '-u') { i++; }
      continue;
    }
    if (a === '--') continue;
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
    positional.push(a);
  }

  if (showCurrent) {
    _git.currentBranch({ fs: fs, dir: dir }).then(function (cur) {
      _gitReply(id, (cur || '') + (cur ? '\n' : ''), '', 0, []);
    }).catch(function (err) {
      _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
    });
    return;
  }

  // Copy
  if (copyNew) {
    var srcPromise = copyOld ? Promise.resolve(copyOld) : _git.currentBranch({ fs: fs, dir: dir });
    srcPromise.then(function (src) {
      if (!src) throw new Error('not on a branch');
      return _git.resolveRef({ fs: fs, dir: dir, ref: src });
    }).then(function (oid) {
      return _git.writeRef({ fs: fs, dir: dir, ref: 'refs/heads/' + copyNew, value: oid, force: false });
    }).then(function () { _gitReply(id, '', '', 0, []); })
      .catch(function (err) { _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []); });
    return;
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

  // Create with optional start point. Real git uses positional[0] as the new
  // name, positional[1] as the start point. With --list and no other action,
  // a single positional is treated as a glob pattern instead.
  var actAsList = listPattern || listAll || listRemote || verbose ||
                  containsRef || notContainsRef || mergedSpec || notMergedSpec;
  if (positional.length >= 1 && !actAsList) {
    var newName = positional[0];
    var startPoint = positional[1] || 'HEAD';
    _resolveCommitish(fs, dir, startPoint)
      .then(function (oid) {
        return _git.writeRef({ fs: fs, dir: dir, ref: 'refs/heads/' + newName, value: oid, force: false });
      })
      .then(function () { _gitReply(id, '', '', 0, []); })
      .catch(function (err) { _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []); });
    return;
  }
  if (positional.length >= 1 && !listPattern) listPattern = positional[0];

  // List branches with optional filtering / decoration.
  Promise.all([
    _git.listBranches({ fs: fs, dir: dir }),
    _git.currentBranch({ fs: fs, dir: dir }),
    _git.listBranches({ fs: fs, dir: dir, remote: 'origin' }).catch(function () { return []; }),
    containsRef ? _resolveCommitish(fs, dir, containsRef).catch(function () { return null; }) : Promise.resolve(null),
    notContainsRef ? _resolveCommitish(fs, dir, notContainsRef).catch(function () { return null; }) : Promise.resolve(null),
    mergedSpec ? _resolveCommitish(fs, dir, mergedRef || 'HEAD').catch(function () { return null; }) : Promise.resolve(null),
    notMergedSpec ? _resolveCommitish(fs, dir, notMergedRef || 'HEAD').catch(function () { return null; }) : Promise.resolve(null),
  ]).then(function (r) {
    var branches = r[0] || [], cur = r[1];
    var remotes = r[2] || [];
    var containsOid = r[3], notContainsOid = r[4];
    var mergedOid = r[5], notMergedOid = r[6];

    function matchPattern(b) {
      if (!listPattern) return true;
      // glob → regex (simple: * → .*, ? → .)
      var rx = new RegExp('^' + listPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      return rx.test(b);
    }

    function check(oid, candidateOid, mode) {
      if (!oid || !candidateOid) return Promise.resolve(true);
      // mode 'contains' = candidate must be ancestor of oid
      // mode 'merged'   = candidate's branch is merged into HEAD/<ref>
      if (!_git.isDescendent) return Promise.resolve(true);
      return _git.isDescendent({ fs: fs, dir: dir, oid: oid, ancestor: candidateOid }).catch(function () { return false; });
    }

    // Filter local branches.
    return Promise.all(branches.map(function (b) {
      if (!matchPattern(b)) return Promise.resolve(null);
      return _git.resolveRef({ fs: fs, dir: dir, ref: b }).then(function (oid) {
        var checks = [];
        if (containsOid)    checks.push(check(oid, containsOid).then(function (ok) { return ok; }));
        if (notContainsOid) checks.push(check(oid, notContainsOid).then(function (ok) { return !ok; }));
        if (mergedOid)      checks.push(check(mergedOid, oid).then(function (ok) { return ok; }));
        if (notMergedOid)   checks.push(check(notMergedOid, oid).then(function (ok) { return !ok; }));
        return Promise.all(checks).then(function (rs) {
          if (rs.some(function (v) { return !v; })) return null;
          return { name: b, oid: oid };
        });
      }).catch(function () { return null; });
    })).then(function (locals) {
      locals = locals.filter(Boolean);
      var GREEN = '\x1b[32m', RED = '\x1b[31m', RESET = '\x1b[m';
      var out = '';

      function fmt(b, marker, color, oid) {
        var line = marker + color + b + RESET;
        if (verbose && oid) {
          var short = oid.substring(0, 7);
          line += ' ' + short;
          // pull subject lazily
          return _git.readCommit({ fs: fs, dir: dir, oid: oid }).then(function (c) {
            var subj = ((c.commit && c.commit.message) || '').split('\n')[0];
            return line + ' ' + subj + '\n';
          }).catch(function () { return line + '\n'; });
        }
        return Promise.resolve(line + '\n');
      }

      var pieces = [];
      if (!listRemote) {
        locals.forEach(function (lb) {
          var marker = (lb.name === cur) ? '* ' : '  ';
          var color = (lb.name === cur) ? GREEN : '';
          pieces.push(fmt(lb.name, marker, color, lb.oid));
        });
      }
      if (listAll || listRemote) {
        remotes.forEach(function (rb) {
          if (!matchPattern('origin/' + rb) && !matchPattern(rb)) return;
          pieces.push(_git.resolveRef({ fs: fs, dir: dir, ref: 'refs/remotes/origin/' + rb })
            .catch(function () { return null; })
            .then(function (oid) { return fmt('remotes/origin/' + rb, '  ', RED, oid); }));
        });
      }
      return Promise.all(pieces).then(function (lines) {
        _gitReply(id, lines.join(''), '', 0, []);
      });
    });
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
  // Flags accepted:
  //   --no-ff                — always create a merge commit, no fast-forward
  //   --ff                   — allow fast-forward (default)
  //   --ff-only              — refuse if a merge commit would be needed
  //   --squash               — apply other side as a single change, no commit
  //   --no-commit            — leave the merged result staged, no commit
  //   --commit               — accepted; default
  //   --abort                — cancel an in-progress merge
  //   --continue             — finish a paused merge after conflicts
  //   --quit                 — drop merge state without resolving
  //   -m <msg> / --message=<msg> — merge commit message
  //   -e / --edit            — interactive; rejected with hint
  //   -s <strat> / --strategy=<strat> — strategy name (we only support recursive)
  //   -X <opt> / --strategy-option=<opt> — strategy option (no-op)
  //   -q / --quiet           — quiet mode
  //   -v / --verbose         — verbose mode
  //   --no-verify / --verify — accepted (no hooks)
  //   --signoff              — append Signed-off-by
  //   -S / --gpg-sign        — accepted; not implemented
  //   --allow-unrelated-histories — accepted (iso-git allows by default)
  //   --autostash / --no-autostash — accepted (we don't auto-stash)
  var noFf = false, ffOnly = false, squash = false, noCommit = false;
  var doAbort = false, doContinue = false, doQuit = false;
  var message = null, signoff = false;
  var refs = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '--no-ff')          { noFf = true; continue; }
    if (a === '--ff')             { noFf = false; ffOnly = false; continue; }
    if (a === '--ff-only')        { ffOnly = true; continue; }
    if (a === '--squash')         { squash = true; continue; }
    if (a === '--no-squash')      { squash = false; continue; }
    if (a === '--no-commit')      { noCommit = true; continue; }
    if (a === '--commit')         { noCommit = false; continue; }
    if (a === '--abort')          { doAbort = true; continue; }
    if (a === '--continue')       { doContinue = true; continue; }
    if (a === '--quit')           { doQuit = true; continue; }
    if (a === '-m' || a === '--message') { message = args[++i] || ''; continue; }
    if (a.indexOf('--message=') === 0)   { message = a.substring('--message='.length); continue; }
    if (a === '--signoff' || a === '-s') { signoff = true; continue; }
    if (a === '--no-signoff')     { signoff = false; continue; }
    if (a === '--strategy' || a === '-s' || a.indexOf('--strategy=') === 0) {
      if (a === '--strategy' || a === '-s') i++;
      continue;
    }
    if (a === '--strategy-option' || a === '-X' || a.indexOf('--strategy-option=') === 0) {
      if (a === '--strategy-option' || a === '-X') i++;
      continue;
    }
    if (a === '-q' || a === '--quiet' || a === '-v' || a === '--verbose' ||
        a === '--no-verify' || a === '--verify' || a === '-S' || a === '--gpg-sign' ||
        a === '--no-gpg-sign' || a.indexOf('--gpg-sign=') === 0 ||
        a === '--allow-unrelated-histories' ||
        a === '--autostash' || a === '--no-autostash' ||
        a === '--no-progress' || a === '--progress' ||
        a === '--no-rerere-autoupdate' || a === '--rerere-autoupdate' ||
        a === '--into-name' || a === '-F' || a === '--file' ||
        a.indexOf('--file=') === 0) {
      if (a === '-F' || a === '--file' || a === '--into-name') i++;
      continue;
    }
    if (a === '-e' || a === '--edit') {
      return _gitReply(id, '', "error: " + a + " is not supported in this terminal.\n", 1, []);
    }
    if (a === '--')               { continue; }
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
    refs.push(a);
  }

  var mergeStatePath = dir + '/.git/MERGE_HEAD';
  var mergeMsgPath   = dir + '/.git/MERGE_MSG';

  if (doAbort) {
    try { pyodide.FS.unlink(mergeStatePath); } catch (e) {}
    try { pyodide.FS.unlink(mergeMsgPath); } catch (e) {}
    // Restore index/worktree from HEAD.
    return _git.checkout({ fs: fs, dir: dir, ref: 'HEAD', force: true })
      .then(function () { return _snapshotPaths(dir); })
      .then(function (post) { _gitReply(id, '', '', 0, Object.keys(post)); })
      .catch(function (err) { _gitReply(id, '', 'fatal: ' + err.message + '\n', 1, []); });
  }
  if (doQuit) {
    try { pyodide.FS.unlink(mergeStatePath); } catch (e) {}
    try { pyodide.FS.unlink(mergeMsgPath); } catch (e) {}
    return _gitReply(id, '', '', 0, []);
  }
  if (doContinue) {
    // Treat as `git commit` of staged result with the saved merge message.
    var savedMsg = '';
    try { savedMsg = pyodide.FS.readFile(mergeMsgPath, { encoding: 'utf8' }); } catch (e) {}
    try { pyodide.FS.unlink(mergeStatePath); } catch (e) {}
    try { pyodide.FS.unlink(mergeMsgPath); } catch (e) {}
    return _gitCmdCommit(id, ['-m', message || savedMsg || 'Merge'], dir, fs);
  }

  if (refs.length === 0) {
    return _gitReply(id, '', "merge: ref required\n", 1, []);
  }
  var ref = refs[0];

  _snapshotPaths(dir).then(function (preMap) {
    return Promise.all([
      _git.currentBranch({ fs: fs, dir: dir }),
      _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
      _resolveCommitish(fs, dir, ref).catch(function () { return null; }),
    ]).then(function (r) {
      var current = r[0], headOid = r[1], theirsOid = r[2];
      if (!theirsOid) throw new Error("'" + ref + "': not a valid ref");

      // Determine fast-forward feasibility.
      var canFf = false;
      var ffPromise = (_git.isDescendent && headOid && theirsOid)
        ? _git.isDescendent({ fs: fs, dir: dir, oid: theirsOid, ancestor: headOid })
            .then(function (isAnc) { canFf = isAnc; })
            .catch(function () { canFf = false; })
        : Promise.resolve();

      return ffPromise.then(function () {
        // Check already-merged: HEAD descends from theirs.
        return (_git.isDescendent && headOid && theirsOid)
          ? _git.isDescendent({ fs: fs, dir: dir, oid: headOid, ancestor: theirsOid }).catch(function () { return false; })
          : Promise.resolve(false);
      }).then(function (alreadyMerged) {
        if (alreadyMerged) {
          _gitReply(id, "Already up to date.\n", '', 0, []);
          return;
        }

        if (squash) {
          // Apply theirs's tree onto the workdir + index without moving the
          // ref or recording theirs as a parent.
          var leftFiles = {}, rightFiles = {};
          return _walkCommitTree(fs, dir, headOid, leftFiles, '')
            .then(function () { return _walkCommitTree(fs, dir, theirsOid, rightFiles, ''); })
            .then(function () {
              var allPaths = {};
              Object.keys(leftFiles).forEach(function (k) { allPaths[k] = true; });
              Object.keys(rightFiles).forEach(function (k) { allPaths[k] = true; });
              Object.keys(allPaths).forEach(function (p) {
                var l = leftFiles[p], r = rightFiles[p];
                if (l === r) return;
                if (r === undefined) {
                  try { pyodide.FS.unlink(dir + '/' + p); } catch (e) {}
                  return;
                }
                var sub = p.indexOf('/') !== -1 ? p.substring(0, p.lastIndexOf('/')) : '';
                if (sub) {
                  var parts = sub.split('/'); var cur = dir;
                  parts.forEach(function (s) { cur += '/' + s; try { pyodide.FS.mkdir(cur); } catch (e) {} });
                }
                pyodide.FS.writeFile(dir + '/' + p, r, { encoding: 'utf8' });
              });
              return _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
                return Promise.all(matrix.map(function (row) {
                  var fp = row[0]; var abs = dir + '/' + fp;
                  var exists = true; try { pyodide.FS.stat(abs); } catch (e) { exists = false; }
                  return exists ? _git.add({ fs: fs, dir: dir, filepath: fp })
                                : _git.remove({ fs: fs, dir: dir, filepath: fp });
                }));
              });
            }).then(function () {
              return _snapshotPaths(dir);
            }).then(function (postMap) {
              _gitReply(id,
                "Squash commit -- not updating HEAD\nAutomatic merge went well; stopped before committing as requested\n",
                '', 0, _diffMaps(preMap, postMap));
            });
        }

        if (canFf && !noFf) {
          // Fast-forward: just move the branch ref to theirs.
          var doFf = current
            ? _git.writeRef({ fs: fs, dir: dir, ref: 'refs/heads/' + current, value: theirsOid, force: true })
            : _git.writeRef({ fs: fs, dir: dir, ref: 'HEAD', value: theirsOid, force: true });
          return doFf.then(function () {
            return _git.checkout({ fs: fs, dir: dir, ref: current || theirsOid, force: true });
          }).then(function () { return _snapshotPaths(dir); }).then(function (postMap) {
            var note = "Updating " + (headOid ? headOid.substring(0, 7) : '') + ".." + theirsOid.substring(0, 7) + "\nFast-forward\n";
            _appendReflog(dir, 'HEAD', headOid, theirsOid, 'merge ' + ref + ': Fast-forward');
            if (current) _appendReflog(dir, 'refs/heads/' + current, headOid, theirsOid, 'merge ' + ref + ': Fast-forward');
            _gitReply(id, note, '', 0, _diffMaps(preMap, postMap));
          });
        }

        if (ffOnly) {
          throw new Error("Not possible to fast-forward, aborting.");
        }

        // True merge: produce a merge commit with two parents.
        var subj = message || ("Merge branch '" + ref + "' into " + (current || 'HEAD'));
        if (signoff) subj += '\n\nSigned-off-by: Student <student@example.com>';

        return _git.merge({
          fs: fs, dir: dir, ours: current || undefined, theirs: ref,
          message: subj, fastForward: false,
          author: { name: 'Student', email: 'student@example.com' },
          mergeDriver: undefined,
          dryRun: noCommit,
          noUpdateBranch: noCommit,
        }).then(function (result) {
          var afterCheckout = current
            ? _git.checkout({ fs: fs, dir: dir, ref: current, force: true })
            : Promise.resolve();
          return afterCheckout.then(function () {
            return Promise.all([
              _snapshotPaths(dir),
              _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
            ]);
          }).then(function (post) {
            var postMap = post[0], newOid = post[1];
            var mutated = _diffMaps(preMap, postMap);
            var note = (result && result.fastForward) ? "Fast-forward\n"
                       : (result && result.alreadyMerged) ? "Already up to date.\n"
                       : "Merge made by the 'recursive' strategy.\n";
            if (newOid) {
              _appendReflog(dir, 'HEAD', headOid, newOid, 'merge ' + ref + ': ' + note.trim());
              if (current) _appendReflog(dir, 'refs/heads/' + current, headOid, newOid, 'merge ' + ref + ': ' + note.trim());
            }
            _gitReply(id, note, '', 0, mutated);
          });
        }).catch(function (err) {
          // Conflict path: leave MERGE_HEAD + MERGE_MSG so `--continue` can
          // finalise the user's resolution.
          if (err && /conflict|MergeNotSupported|MergeConflict/i.test(String(err.message || err))) {
            try { pyodide.FS.writeFile(mergeStatePath, theirsOid + '\n', { encoding: 'utf8' }); } catch (e) {}
            try { pyodide.FS.writeFile(mergeMsgPath, subj, { encoding: 'utf8' }); } catch (e) {}
          }
          throw err;
        });
      });
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

// `git merge-base <a> <b>` — print the merge base oid of two refs.
function _gitCmdMergeBase(id, args, dir, fs) {
  var all = false, isAncestor = false, octopus = false;
  var positional = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-a' || a === '--all')    { all = true; continue; }
    if (a === '--is-ancestor')          { isAncestor = true; continue; }
    if (a === '--octopus')              { octopus = true; continue; }
    if (a === '--independent' || a === '--fork-point' || a === '--all-base') { continue; }
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
    positional.push(a);
  }
  if (positional.length < 2) {
    return _gitReply(id, '', "fatal: merge-base needs at least two refs\n", 1, []);
  }
  Promise.all(positional.map(function (r) { return _resolveCommitish(fs, dir, r); })).then(function (oids) {
    if (!_git.findMergeBase) {
      return _gitReply(id, '', 'fatal: merge-base not available in this iso-git build\n', 1, []);
    }
    return _git.findMergeBase({ fs: fs, dir: dir, oids: oids }).then(function (mb) {
      if (isAncestor) {
        // Exit 0 if first is ancestor of second, 1 otherwise.
        var firstIsBase = mb && mb[0] === oids[0];
        return _gitReply(id, '', '', firstIsBase ? 0 : 1, []);
      }
      var out = (mb || []).map(function (o) { return o + '\n'; }).join('');
      _gitReply(id, all ? out : (mb && mb[0] ? mb[0] + '\n' : ''), '', mb && mb.length ? 0 : 1, []);
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
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

// Resolve a refish to a full oid. Supports:
//   - branch / tag / HEAD names                 (resolveRef)
//   - 7-40 char abbreviated SHAs                (expandOid)
//   - full 40-char SHAs                         (returned as-is)
//   - HEAD^, HEAD^^, HEAD^N (Nth parent)        (parent walk)
//   - HEAD~, HEAD~N (first-parent N hops back)  (parent walk)
//   - <ref>@{N} (Nth reflog entry)              (.git/logs/<ref>)
//   - any combination, e.g. main~3^2~1
function _resolveCommitish(fs, dir, ref) {
  if (!ref) return Promise.reject(new Error('empty ref'));

  // Strip and parse a trailing chain of ^/~/@{N} suffixes. We resolve the
  // base name first, then walk parent links (or reflog) per suffix.
  var m = String(ref).match(/^([^\^~@]+(?:@\{[^}]+\})?)((?:\^[0-9]*|~[0-9]*|@\{[^}]+\})*)$/);
  var base = m ? m[1] : ref;
  var suffix = m ? m[2] : '';

  // @{N} on the base resolves through the reflog.
  var reflogMatch = base.match(/^([^@]+)@\{([^}]+)\}$/);
  var basePromise;
  if (reflogMatch) {
    basePromise = _resolveReflogRef(dir, reflogMatch[1], reflogMatch[2]);
  } else {
    basePromise = _git.resolveRef({ fs: fs, dir: dir, ref: base }).catch(function () {
      if (_git.expandOid) {
        return _git.expandOid({ fs: fs, dir: dir, oid: base });
      }
      throw new Error("bad revision '" + ref + "'");
    });
  }

  if (!suffix) return basePromise;

  // Walk the suffix chain: ^[N], ~[N], @{N}.
  return basePromise.then(function (oid) {
    var rest = suffix;
    function step() {
      if (!rest.length) return Promise.resolve(oid);
      var ch = rest.charAt(0);
      if (ch === '^') {
        var nm = rest.match(/^\^([0-9]+)?/);
        var n = nm[1] === undefined ? 1 : parseInt(nm[1], 10);
        rest = rest.substring(nm[0].length);
        if (n === 0) return step();  // ^0 == itself
        return _git.readCommit({ fs: fs, dir: dir, oid: oid }).then(function (c) {
          var parents = (c.commit && c.commit.parent) || [];
          if (n > parents.length) {
            return Promise.reject(new Error("bad revision '" + ref + "': commit has only " + parents.length + " parent(s)"));
          }
          oid = parents[n - 1];
          return step();
        });
      }
      if (ch === '~') {
        var tm = rest.match(/^~([0-9]+)?/);
        var t = tm[1] === undefined ? 1 : parseInt(tm[1], 10);
        rest = rest.substring(tm[0].length);
        function hop(remaining) {
          if (remaining === 0) return Promise.resolve();
          return _git.readCommit({ fs: fs, dir: dir, oid: oid }).then(function (c) {
            var parents = (c.commit && c.commit.parent) || [];
            if (parents.length === 0) {
              return Promise.reject(new Error("bad revision '" + ref + "': no parent"));
            }
            oid = parents[0];
            return hop(remaining - 1);
          });
        }
        return hop(t).then(step);
      }
      if (ch === '@') {
        // Reflog suffix on intermediate result is unusual; only honor if base
        // didn't already consume it. Resolve via reflog of HEAD if no ref is
        // attached.
        var rm = rest.match(/^@\{([^}]+)\}/);
        rest = rest.substring(rm[0].length);
        return _resolveReflogRef(dir, 'HEAD', rm[1]).then(function (newOid) {
          oid = newOid; return step();
        });
      }
      return Promise.reject(new Error("bad revision '" + ref + "'"));
    }
    return step();
  });
}

// Resolve a `<ref>@{N}` style selector to a commit oid, where N indexes into
// the ref's reflog (0 = current, 1 = previous, etc.). Plain `@{N}` (no ref)
// is treated as `HEAD@{N}`. We accept both numeric and ISO-date selectors,
// but only number-based selectors are honored — date selectors fall back to
// the current value of the ref.
function _resolveReflogRef(dir, ref, sel) {
  var path = dir + '/.git/logs/' + (ref === 'HEAD' ? 'HEAD' :
    (ref.indexOf('refs/') === 0 ? ref : 'refs/heads/' + ref));
  var content = '';
  try { content = pyodide.FS.readFile(path, { encoding: 'utf8' }); } catch (e) {}
  var lines = content.split('\n').filter(Boolean);
  if (!lines.length) {
    // No reflog — fall back to current ref value (matches a fresh branch).
    return _git.resolveRef({ fs: _gitFsAdapter, dir: dir, ref: ref });
  }
  var n;
  if (/^\d+$/.test(sel)) {
    n = parseInt(sel, 10);
  } else {
    // Date selector — best-effort: just return the most recent entry.
    n = 0;
  }
  // newest first
  var idx = lines.length - 1 - n;
  if (idx < 0 || idx >= lines.length) {
    return Promise.reject(new Error("log for '" + ref + "' only goes back to " + (lines.length - 1)));
  }
  var parsed = _parseReflogLine(lines[idx]);
  if (!parsed) return Promise.reject(new Error("bad reflog entry"));
  return Promise.resolve(parsed.newOid);
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
  //   git diff                       — workdir vs index (unstaged)
  //   git diff --staged|--cached     — index vs HEAD (staged)
  //   git diff <ref>                 — workdir vs <ref>
  //   git diff <a> <b>               — <a> vs <b>
  //   git diff <a>..<b>              — same as <a> <b>
  //   git diff <a>...<b>             — merge-base(a,b) vs <b>
  //   git diff -- <path>...          — limit to paths
  // Output flags:
  //   --name-only / --name-status    — list paths instead of patches
  //   --stat / --shortstat / --numstat — summary
  //   -U<n> / --unified=<n>          — context lines
  //   -p / --patch                   — full patch (default)
  //   --no-color / --color           — accepted; we always output ANSI
  //   -R                             — reverse left/right
  //   --quiet / -s                   — suppress output, exit 1 if changes
  //   --exit-code                    — exit 1 if changes (vs 0)
  //   --check                        — accepted; reports nothing extra
  //   --abbrev / --abbrev=<n>        — accepted
  //   -w / --ignore-all-space        — accepted (we don't ws-normalize yet)
  //   -b / --ignore-space-change     — accepted
  //   --ignore-blank-lines           — accepted
  //   -M / -C                        — accepted; we don't detect renames/copies
  var staged = false;
  var nameOnly = false, nameStatus = false, doStat = false, shortStat = false, numStat = false;
  var unified = 3;
  var quiet = false, exitCodeOnly = false, reverse = false;
  var patchOnly = false;
  var refs = [];
  var paths = [];
  var sawDD = false;
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (sawDD) { paths.push(a); continue; }
    if (a === '--')                      { sawDD = true; continue; }
    if (a === '--staged' || a === '--cached') { staged = true; continue; }
    if (a === '--name-only')             { nameOnly = true; continue; }
    if (a === '--name-status')           { nameStatus = true; continue; }
    if (a === '--stat')                  { doStat = true; continue; }
    if (a === '--shortstat')             { shortStat = true; continue; }
    if (a === '--numstat')               { numStat = true; continue; }
    if (a === '--summary')               { doStat = true; continue; }
    if (a === '--patch' || a === '-p' || a === '-u') { patchOnly = true; continue; }
    if (a === '--no-patch')              { patchOnly = false; continue; }
    if (a === '--quiet' || a === '-s')   { quiet = true; continue; }
    if (a === '--exit-code')             { exitCodeOnly = true; continue; }
    if (a === '-R')                      { reverse = true; continue; }
    if (a.indexOf('--unified=') === 0)   { unified = parseInt(a.substring('--unified='.length), 10) || 3; continue; }
    if (a === '--unified' || a === '-U') { unified = parseInt(args[++i], 10) || 3; continue; }
    if (/^-U\d+$/.test(a))               { unified = parseInt(a.substring(2), 10); continue; }
    if (a === '--no-color' || a === '--color' || a.indexOf('--color=') === 0) { continue; }
    if (a === '--check' || a === '-w' || a === '--ignore-all-space' ||
        a === '-b' || a === '--ignore-space-change' || a === '--ignore-blank-lines' ||
        a === '-W' || a === '--function-context' || a === '--minimal' ||
        a === '--patience' || a === '--histogram' ||
        a === '--abbrev' || a.indexOf('--abbrev=') === 0 ||
        a === '--no-renames' || a === '--full-index' || a === '--binary' ||
        a === '--text' || a === '-a' || a === '--no-textconv' ||
        a === '--ignore-cr-at-eol' || a === '--ignore-space-at-eol') {
      continue;
    }
    if (a === '-M' || a.indexOf('-M') === 0 || a === '-C' || a.indexOf('-C') === 0 ||
        a === '--find-renames' || a.indexOf('--find-renames=') === 0 ||
        a === '--find-copies' || a.indexOf('--find-copies=') === 0) {
      continue;
    }
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
    // Range syntax: <a>..<b> or <a>...<b>
    var sym = a.match(/^(.*)\.\.\.(.*)$/);
    if (sym) {
      var L = sym[1] || 'HEAD', R = sym[2] || 'HEAD';
      // Symmetric: merge-base(L,R) vs R. We'll resolve later in setup.
      refs.push({ kind: 'sym', l: L, r: R });
      continue;
    }
    var rng = a.match(/^(.*)\.\.(.*)$/);
    if (rng) {
      refs.push(rng[1] || 'HEAD');
      refs.push(rng[2] || 'HEAD');
      continue;
    }
    refs.push(a);
  }

  // Resolve which two trees we compare. Each tree is identified by:
  //   - 'WORKDIR' — read from FS
  //   - 'STAGE'   — index
  //   - oid       — committed tree
  var leftSrc, rightSrc;
  function resolveOid(ref) { return _resolveCommitish(fs, dir, ref); }
  var setup;
  // Symmetric range expanded as merge-base.
  if (refs.length === 1 && typeof refs[0] === 'object' && refs[0].kind === 'sym') {
    var sym = refs[0];
    setup = Promise.all([resolveOid(sym.l), resolveOid(sym.r)]).then(function (r) {
      var mbPromise = _git.findMergeBase
        ? _git.findMergeBase({ fs: fs, dir: dir, oids: [r[0], r[1]] })
        : Promise.resolve([r[0]]);
      return mbPromise.then(function (mb) {
        leftSrc = { kind: 'commit', oid: (mb && mb[0]) || r[0] };
        rightSrc = { kind: 'commit', oid: r[1] };
      });
    });
  } else if (refs.length === 0) {
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
    if (reverse) { var t = leftSrc; leftSrc = rightSrc; rightSrc = t; }
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

    var sortedPaths = Object.keys(allPaths).sort();
    var changedPaths = sortedPaths.filter(function (p) {
      var l = left[p], r = right[p];
      return !(l === r || (l === undefined && r === undefined));
    });

    if (quiet || exitCodeOnly) {
      _gitReply(id, '', '', changedPaths.length ? 1 : 0, []);
      return;
    }

    if (nameOnly) {
      _gitReply(id, changedPaths.map(function (p) { return p + '\n'; }).join(''), '', 0, []);
      return;
    }
    if (nameStatus) {
      var out0 = '';
      changedPaths.forEach(function (p) {
        var l = left[p], r = right[p];
        var s = (l === undefined) ? 'A' : (r === undefined) ? 'D' : 'M';
        out0 += s + '\t' + p + '\n';
      });
      _gitReply(id, out0, '', 0, []);
      return;
    }
    if (numStat) {
      var out1 = '';
      changedPaths.forEach(function (p) {
        var l = left[p] || '', r = right[p] || '';
        var lc = l === '' ? 0 : l.split('\n').length;
        var rc = r === '' ? 0 : r.split('\n').length;
        out1 += rc + '\t' + lc + '\t' + p + '\n';
      });
      _gitReply(id, out1, '', 0, []);
      return;
    }
    if (doStat || shortStat) {
      var totalIns = 0, totalDel = 0;
      var lines = [];
      changedPaths.forEach(function (p) {
        var l = left[p] || '', r = right[p] || '';
        // Tutorial-grade rough count: line count delta between l and r.
        var lc = l === '' ? 0 : l.split('\n').length;
        var rc = r === '' ? 0 : r.split('\n').length;
        var ins = Math.max(0, rc - lc);
        var del = Math.max(0, lc - rc);
        // Approximate by also counting changed lines as ins+del when both > 0.
        if (l !== r && lc > 0 && rc > 0) {
          var common = Math.min(lc, rc);
          ins += common; del += common;
        }
        totalIns += ins; totalDel += del;
        var bar = (ins ? '+'.repeat(Math.min(ins, 40)) : '') + (del ? '-'.repeat(Math.min(del, 40)) : '');
        lines.push(' ' + p + ' | ' + (ins + del) + ' ' + bar);
      });
      var summary = ' ' + changedPaths.length + ' file' + (changedPaths.length === 1 ? '' : 's') + ' changed' +
                    (totalIns ? ', ' + totalIns + ' insertion' + (totalIns === 1 ? '' : 's') + '(+)' : '') +
                    (totalDel ? ', ' + totalDel + ' deletion' + (totalDel === 1 ? '' : 's') + '(-)' : '');
      var out2 = shortStat ? summary + '\n'
                            : (lines.length ? lines.join('\n') + '\n' + summary + '\n' : '');
      _gitReply(id, out2, '', 0, []);
      return;
    }

    // Default: full patch.
    var out = '';
    var CYAN = '\x1b[36m', BOLD = '\x1b[1m', GREEN = '\x1b[32m', RED = '\x1b[31m', RESET = '\x1b[m';
    changedPaths.forEach(function (p) {
      var l = left[p], r = right[p];
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
    _gitReply(id, out, '', 0, []);
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
  if (sub === 'branch')                 return _stashBranch(id, rest, dir, fs);
  if (sub === 'create' || sub === 'store') {
    return _gitReply(id, '',
      "git stash " + sub + ": this plumbing form isn't implemented in the tutorial sandbox.\n", 1, []);
  }
  // Bare `git stash` (no sub) or starting with a flag is shorthand for push.
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
  // Flags accepted (real-git stash push):
  //   -m / --message <msg>             — annotate the stash entry
  //   -u / --include-untracked         — also stash untracked files
  //   -a / --all                       — also stash ignored + untracked
  //   -k / --keep-index                — leave index alone after stashing
  //   --no-keep-index                  — opposite (default)
  //   --staged                         — only stash what's staged
  //   -p / --patch                     — interactive (rejected)
  //   -q / --quiet                     — suppress success line
  //   --                               — pathspec separator
  //   <path>...                        — limit stash to these paths
  var message = null;
  var includeUntracked = false, includeAll = false;
  var keepIndex = false, stagedOnly = false, quiet = false;
  var pathspecs = [];
  var sawDD = false;
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (sawDD) { pathspecs.push(a); continue; }
    if (a === '--')                          { sawDD = true; continue; }
    if (a === '-m' || a === '--message')     { message = args[++i] || ''; continue; }
    if (a.indexOf('--message=') === 0)       { message = a.substring('--message='.length); continue; }
    if (/^-m./.test(a))                      { message = a.substring(2); continue; }
    if (a === '-u' || a === '--include-untracked') { includeUntracked = true; continue; }
    if (a === '-a' || a === '--all')         { includeAll = true; includeUntracked = true; continue; }
    if (a === '-k' || a === '--keep-index')  { keepIndex = true; continue; }
    if (a === '--no-keep-index')             { keepIndex = false; continue; }
    if (a === '--staged')                    { stagedOnly = true; continue; }
    if (a === '-q' || a === '--quiet')       { quiet = true; continue; }
    if (a === '-p' || a === '--patch') {
      return _gitReply(id, '', "error: stash --patch is not supported in this terminal.\n", 1, []);
    }
    if (a.charAt(0) === '-') {
      return _gitReply(id, '', "error: unknown option `" + a.replace(/^-+/, '') + "'\n", 1, []);
    }
    pathspecs.push(a);
  }
  Promise.all([
    _git.statusMatrix({ fs: fs, dir: dir }),
    _git.currentBranch({ fs: fs, dir: dir }).catch(function () { return null; }),
    _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
  ]).then(function (r) {
    var matrix = r[0], branch = r[1] || 'HEAD', headOid = r[2];

    // Decide which paths participate based on flags.
    var pathFilter = null;
    if (pathspecs.length) {
      pathFilter = {};
      pathspecs.forEach(function (p) {
        var rel = _toRel(dir, _normalizePath(dir, dir, p));
        if (rel) pathFilter[rel] = true;
      });
    }
    function inFilter(fp) {
      if (!pathFilter) return true;
      return Object.keys(pathFilter).some(function (k) {
        return fp === k || fp.indexOf(k + '/') === 0 || k === '.';
      });
    }

    var hasChanges = matrix.some(function (row) {
      var fp = row[0], H = row[1], W = row[2], S = row[3];
      if (!inFilter(fp)) return false;
      var isUntracked = (H === 0 && W === 2 && S === 0);
      if (isUntracked && !includeUntracked) return false;
      if (stagedOnly) return H !== S && S !== 0;
      return H !== W || H !== S;
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

    // Snapshot only the paths we care about (pathspec / untracked / staged).
    var snapshot = {};
    var workSnap = _snapshotWorkdir(dir);
    matrix.forEach(function (row) {
      var fp = row[0], H = row[1], W = row[2], S = row[3];
      if (!inFilter(fp)) return;
      var isUntracked = (H === 0 && W === 2 && S === 0);
      if (isUntracked && !includeUntracked) return;
      if (stagedOnly && (H === S || S === 0)) return;
      if (workSnap[fp] !== undefined) snapshot[fp] = workSnap[fp];
    });

    var entry = {
      message: message || ('WIP on ' + branch + ': ' + headOid.substring(0, 7)),
      branch: branch, headOid: headOid,
      files: snapshot,
      keepIndex: keepIndex, stagedOnly: stagedOnly,
      pathspec: pathspecs.slice(),
      timestamp: Math.floor(Date.now() / 1000),
    };
    entries.unshift(entry);  // newest at index 0
    _stashWrite(dir, entries);

    // Restore working tree (and index) to HEAD for the stashed paths. With
    // --keep-index, leave the staged content alone after we revert the
    // working tree changes that aren't already staged.
    return _snapshotPaths(dir).then(function (preMap) {
      var headFiles = {};
      return _walkCommitTree(fs, dir, headOid, headFiles, '').then(function () {
        Object.keys(snapshot).forEach(function (p) {
          var headContent = headFiles[p];
          if (headContent === undefined) {
            // File didn't exist in HEAD — remove from workdir.
            try { pyodide.FS.unlink(dir + '/' + p); } catch (e) {}
            return;
          }
          var sub = p.indexOf('/') !== -1 ? p.substring(0, p.lastIndexOf('/')) : '';
          if (sub) {
            var parts = sub.split('/'); var cur = dir;
            parts.forEach(function (s) { cur += '/' + s; try { pyodide.FS.mkdir(cur); } catch (e) {} });
          }
          pyodide.FS.writeFile(dir + '/' + p, headContent, { encoding: 'utf8' });
        });
        // Reset index for stashed paths to match HEAD (unless --keep-index).
        if (keepIndex) return null;
        return _git.statusMatrix({ fs: fs, dir: dir }).then(function (m2) {
          return Promise.all(m2.map(function (row) {
            if (!(row[0] in snapshot)) return null;
            return _git.resetIndex({ fs: fs, dir: dir, filepath: row[0] });
          }));
        });
      }).then(function () { return _snapshotPaths(dir); }).then(function (postMap) {
        var msg = quiet ? '' :
          "Saved working directory and index state " + entry.message + "\n";
        _gitReply(id, msg, '', 0, _diffMaps(preMap, postMap));
      });
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

// `git stash branch <branchname> [<stash>]`
// Create a new branch from the stash's parent commit, apply the stash, then
// drop the stash (if --no-pop wasn't given). Real git always pops on success.
function _stashBranch(id, args, dir, fs) {
  var newBranch = args[0];
  var stashSel = args[1];
  if (!newBranch) return _gitReply(id, '', "fatal: stash branch requires a branch name\n", 1, []);
  var entries = _stashRead(dir);
  if (entries.length === 0) return _gitReply(id, '', "No stash entries found.\n", 1, []);
  var idx = _stashIndex(stashSel ? [stashSel] : [], entries);
  if (idx < 0 || idx >= entries.length) return _gitReply(id, '', "fatal: stash entry not found\n", 1, []);
  var entry = entries[idx];
  // 1. Create branch at entry.headOid, 2. checkout, 3. apply the stash, 4. drop.
  _git.writeRef({ fs: fs, dir: dir, ref: 'refs/heads/' + newBranch, value: entry.headOid, force: false })
    .then(function () { return _git.checkout({ fs: fs, dir: dir, ref: newBranch, force: true }); })
    .then(function () {
      Object.keys(entry.files).forEach(function (p) {
        var sub = p.indexOf('/') !== -1 ? p.substring(0, p.lastIndexOf('/')) : '';
        if (sub) {
          var parts = sub.split('/'); var cur = dir;
          parts.forEach(function (s) { cur += '/' + s; try { pyodide.FS.mkdir(cur); } catch (e) {} });
        }
        pyodide.FS.writeFile(dir + '/' + p, entry.files[p], { encoding: 'utf8' });
      });
      entries.splice(idx, 1);
      _stashWrite(dir, entries);
      return _snapshotPaths(dir);
    }).then(function (post) {
      _gitReply(id,
        "Switched to a new branch '" + newBranch + "'\nDropped " + (stashSel || 'refs/stash@{0}') + " (" + entry.message + ")\n",
        '', 0, Object.keys(post));
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
  if (sub === 'run')     return _bisectRun(id, rest, dir, fs);
  if (sub === 'view')    return _bisectLog(id, rest, dir, fs);
  if (!sub)              return _gitReply(id, '', "usage: git bisect <start|good|bad|skip|reset|log|run>\n", 1, []);
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

// `git bisect run <cmd> [args...]`
// Automatically marks commits good/bad by running a command at each step.
// Exit code 0 → good, 1-124 → bad, 125 → skip, 126/127 → abort.
// The command is dispatched through the same gitRun handler so `pytest`,
// `python test.py`, and shell utilities all work.
function _bisectRun(id, args, dir, fs) {
  var st = _bisectReadState(dir);
  if (!st) return _gitReply(id, '', "You need to start by 'git bisect start'\n", 1, []);
  if (!args.length) return _gitReply(id, '', "git bisect run: missing command\n", 1, []);

  var runCmd = args.join(' ');
  var log = '';
  var MAX_STEPS = 64;  // safety cap

  function step(stepNum) {
    if (stepNum > MAX_STEPS) {
      _gitReply(id, log, '', 1, []);
      return;
    }
    // Check if we already converged.
    var current = _bisectReadState(dir);
    if (!current || !current.bad || !current.good || !current.good.length) {
      _gitReply(id, log + "bisect run: waiting for good and bad commits\n", '', 1, []);
      return;
    }

    // Resolve HEAD to know which commit we're testing.
    _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).then(function (headOid) {
      log += 'running \'' + runCmd + '\' at ' + headOid.substring(0, 7) + '\n';

      // Run the test command via the shared gitRun dispatcher (routes to
      // python/pytest/unix/git as appropriate).
      var exitCode = 0;
      var cmdOut = '', cmdErr = '';

      // Intercept stdout/stderr so they appear in our log.
      if (pyodide) {
        pyodide.setStdout({ batched: function (t) { cmdOut += t + '\n'; } });
        pyodide.setStderr({ batched: function (t) { cmdErr += t + '\n'; } });
      }

      var runResult;
      var verb = _tokenize(runCmd)[0] || '';
      if (verb === 'python' || verb === 'python3' || verb === 'py' ||
          verb === 'pytest' || verb === 'py.test') {
        var pArgs = _tokenize(runCmd).slice(1);
        if (verb === 'pytest' || verb === 'py.test') pArgs = ['-m', 'pytest'].concat(pArgs);
        runResult = _runPythonCommand(-1, pArgs, dir).catch(function () {});
      } else {
        runResult = Promise.resolve();
      }

      return runResult.then(function () {
        if (pyodide) {
          pyodide.setStdout({ batched: function () {} });
          pyodide.setStderr({ batched: function () {} });
        }
        log += cmdOut + cmdErr;

        // The exit code from python runner isn't easily accessible here —
        // we detect it from the output heuristic (pytest PASSED/FAILED).
        var testPassed = cmdErr === '' && !/FAILED|ERROR|error|Error/i.test(cmdOut) &&
                         (/PASSED|passed|ok\b/i.test(cmdOut) || cmdOut.trim() === '');
        exitCode = testPassed ? 0 : 1;

        log += 'exit code ' + exitCode + '\n';

        if (exitCode === 125) {
          // skip
          current.skip.push(headOid);
          current.log.push('git bisect skip # auto (exit 125)');
        } else if (exitCode === 0) {
          current.good.push(headOid);
          current.log.push('git bisect good # auto');
        } else if (exitCode >= 126) {
          _gitReply(id, log + "bisect run failed (exit " + exitCode + ") — aborting\n", '', exitCode, []);
          return;
        } else {
          current.bad = headOid;
          current.log.push('git bisect bad # auto');
        }
        _bisectWriteState(dir, current);

        // Advance to the next midpoint.
        return _bisectCheckoutMid(dir, fs, current).then(function (mid) {
          if (!mid) {
            // Converged.
            return _git.readCommit({ fs: fs, dir: dir, oid: current.bad }).then(function (c) {
              var subj = (c.commit.message || '').split('\n')[0];
              log += current.bad + ' is the first bad commit\n    ' + subj + '\n';
              log += 'bisect run: git bisect good/bad ran ' + stepNum + ' step(s)\n';
              _gitReply(id, log, '', 0, []);
            });
          }
          return step(stepNum + 1);
        });
      });
    }).catch(function (err) {
      _gitReply(id, log, 'fatal: ' + (err.message || err) + '\n', 1, []);
    });
  }

  step(1);
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

// ---- git rev-parse ---------------------------------------------------------
//
// Resolve refs / refish expressions to oids. Supports the common subset:
//   git rev-parse <ref>                       — full oid
//   git rev-parse --short[=N] <ref>           — abbreviated oid
//   git rev-parse --verify <ref>              — oid or exit 1
//   git rev-parse --quiet --verify <ref>      — oid or empty + exit 1
//   git rev-parse HEAD                        — HEAD's oid
//   git rev-parse --abbrev-ref HEAD           — current branch name
//   git rev-parse --abbrev-ref <ref>          — short ref name
//   git rev-parse --is-inside-work-tree       — "true"
//   git rev-parse --git-dir                   — path to .git
//   git rev-parse --show-toplevel             — path to worktree
//   git rev-parse --show-cdup                 — "" if at top
//   git rev-parse --absolute-git-dir          — absolute path to .git
//   git rev-parse --show-prefix               — relative path of cwd within repo
//   git rev-parse --symbolic-full-name <ref>  — full-form ref name
function _gitCmdRevParse(id, args, dir, fs) {
  var verify = false, quiet = false, shortLen = 0, abbrevRef = false;
  var symbolicFull = false;
  var infoQueries = [];
  var refs = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '--verify')                 { verify = true; continue; }
    if (a === '-q' || a === '--quiet')    { quiet = true; continue; }
    if (a === '--short')                  { shortLen = 7; continue; }
    if (a.indexOf('--short=') === 0)      { shortLen = parseInt(a.substring('--short='.length), 10) || 7; continue; }
    if (a === '--abbrev-ref')             { abbrevRef = true; continue; }
    if (a.indexOf('--abbrev-ref=') === 0) { abbrevRef = true; continue; }
    if (a === '--symbolic-full-name')     { symbolicFull = true; continue; }
    if (a === '--symbolic')               { continue; }
    if (a === '--is-inside-work-tree')    { infoQueries.push('inWorkTree'); continue; }
    if (a === '--is-inside-git-dir')      { infoQueries.push('inGitDir'); continue; }
    if (a === '--is-bare-repository')     { infoQueries.push('isBare'); continue; }
    if (a === '--git-dir')                { infoQueries.push('gitDir'); continue; }
    if (a === '--absolute-git-dir')       { infoQueries.push('absGitDir'); continue; }
    if (a === '--show-toplevel')          { infoQueries.push('topLevel'); continue; }
    if (a === '--show-cdup')              { infoQueries.push('cdUp'); continue; }
    if (a === '--show-prefix')            { infoQueries.push('prefix'); continue; }
    if (a === '--show-superproject-working-tree') { infoQueries.push('superproject'); continue; }
    if (a === '--')                       { continue; }
    if (a === '--no-flags' || a === '--flags' || a === '--default' ||
        a === '--all' || a === '--branches' || a === '--tags' || a === '--remotes' ||
        a === '--keep-dashdash' || a === '--stop-at-non-option' || a === '--stuck-long' ||
        a.indexOf('--default=') === 0 || a === '--git-path' ||
        a === '--no-revs' || a === '--revs-only' || a === '--no-flags' ||
        a === '--shared-index-path') {
      continue;
    }
    if (a.charAt(0) === '-' && a !== '-') {
      // Unknown — for compat, skip rather than fail (real git often does too).
      continue;
    }
    refs.push(a);
  }

  if (infoQueries.length) {
    var infoOut = '';
    infoQueries.forEach(function (q) {
      if (q === 'inWorkTree')   infoOut += 'true\n';
      else if (q === 'inGitDir') infoOut += 'false\n';
      else if (q === 'isBare')  infoOut += 'false\n';
      else if (q === 'gitDir')  infoOut += '.git\n';
      else if (q === 'absGitDir') infoOut += dir + '/.git\n';
      else if (q === 'topLevel') infoOut += dir + '\n';
      else if (q === 'cdUp')    infoOut += '\n';
      else if (q === 'prefix')  infoOut += '\n';
      else if (q === 'superproject') infoOut += '\n';
    });
    if (!refs.length) return _gitReply(id, infoOut, '', 0, []);
  }

  if (!refs.length) {
    return _gitReply(id, '', "fatal: ambiguous argument: needed a ref\n", 1, []);
  }

  // Negation: ^<ref> prefixes are emitted as-is (matches real git's behaviour).
  Promise.all(refs.map(function (r) {
    var negated = r.charAt(0) === '^';
    var ref = negated ? r.substring(1) : r;
    if (abbrevRef) {
      // Resolve and try to find the symbolic form.
      if (ref === 'HEAD') {
        return _git.currentBranch({ fs: fs, dir: dir }).then(function (b) {
          return (negated ? '^' : '') + (b || 'HEAD');
        });
      }
      // For other refs, just return the trailing component.
      return Promise.resolve((negated ? '^' : '') + ref.replace(/^refs\/(heads|tags|remotes\/[^/]+)\//, ''));
    }
    if (symbolicFull) {
      // Look up the ref's full-form name.
      if (_git.expandRef) {
        return _git.expandRef({ fs: fs, dir: dir, ref: ref }).then(function (full) { return (negated ? '^' : '') + full; })
          .catch(function () { return (negated ? '^' : '') + ref; });
      }
      return Promise.resolve((negated ? '^' : '') + ref);
    }
    return _resolveCommitish(fs, dir, ref).then(function (oid) {
      var out = shortLen ? oid.substring(0, shortLen) : oid;
      return (negated ? '^' : '') + out;
    });
  })).then(function (lines) {
    _gitReply(id, lines.join('\n') + (lines.length ? '\n' : ''), '', 0, []);
  }).catch(function (err) {
    if (verify && quiet) return _gitReply(id, '', '', 1, []);
    if (verify) return _gitReply(id, '', "fatal: bad revision\n", 1, []);
    _gitReply(id, '', "fatal: " + (err.message || err) + "\n", 1, []);
  });
}

// ---- git rev-list ----------------------------------------------------------
//
// Walk commit ancestry. Common modes:
//   git rev-list <ref>                 — list oids reachable from ref
//   git rev-list --count <ref>         — count instead of listing
//   git rev-list -n <N> <ref>          — limit
//   git rev-list <a>..<b>              — exclude reachable from a
//   git rev-list <a>...<b>             — symmetric difference
//   git rev-list --max-parents=0       — only root commits
//   git rev-list --no-merges           — skip merge commits
//   git rev-list --merges              — only merges
//   git rev-list --first-parent        — only first-parent line
//   git rev-list --reverse             — oldest first
function _gitCmdRevList(id, args, dir, fs) {
  var count = false, max = null, maxParents = null, minParents = null;
  var noMerges = false, onlyMerges = false, firstParent = false, reverse = false;
  var refsArg = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '--count')                 { count = true; continue; }
    if (a === '-n' || a === '--max-count') { max = parseInt(args[++i], 10); continue; }
    if (a.indexOf('--max-count=') === 0) { max = parseInt(a.substring('--max-count='.length), 10); continue; }
    if (/^-n\d+$/.test(a))               { max = parseInt(a.substring(2), 10); continue; }
    if (a.indexOf('--max-parents=') === 0) { maxParents = parseInt(a.substring('--max-parents='.length), 10); continue; }
    if (a.indexOf('--min-parents=') === 0) { minParents = parseInt(a.substring('--min-parents='.length), 10); continue; }
    if (a === '--no-merges')             { noMerges = true; continue; }
    if (a === '--merges')                { onlyMerges = true; continue; }
    if (a === '--first-parent')          { firstParent = true; continue; }
    if (a === '--reverse')               { reverse = true; continue; }
    if (a === '--all')                   { refsArg.push('--all'); continue; }
    if (a === '--branches' || a === '--tags' || a === '--remotes') { continue; }
    if (a === '--topo-order' || a === '--date-order' || a === '--objects' ||
        a === '--objects-edge' || a === '--no-walk' || a === '--header' ||
        a === '--abbrev-commit' || a === '--abbrev' || a.indexOf('--abbrev=') === 0 ||
        a === '--parents' || a === '--children' || a === '--in-commit-order' ||
        a === '--left-right' || a === '--cherry-mark' || a === '--cherry-pick') {
      continue;
    }
    if (a.charAt(0) === '-' && a !== '-') {
      // Skip unknown flags rather than fail (matches `git rev-list`'s loose handling).
      continue;
    }
    refsArg.push(a);
  }

  // Parse range syntax.
  var includes = [], excludes = [];
  function pr(a) {
    if (a === '--all') {
      return _git.listBranches({ fs: fs, dir: dir }).then(function (bs) {
        bs.forEach(function (b) { includes.push(b); });
      }).catch(function () {});
    }
    var sym = a.match(/^(.*)\.\.\.(.*)$/);
    if (sym) {
      var L = sym[1] || 'HEAD', R = sym[2] || 'HEAD';
      return Promise.all([_resolveCommitish(fs, dir, L), _resolveCommitish(fs, dir, R)]).then(function (r) {
        if (_git.findMergeBase) {
          return _git.findMergeBase({ fs: fs, dir: dir, oids: [r[0], r[1]] }).then(function (mb) {
            includes.push(L); includes.push(R);
            if (mb && mb[0]) excludes.push(mb[0]);
          });
        }
        includes.push(L); includes.push(R);
      });
    }
    var rng = a.match(/^(.*)\.\.(.*)$/);
    if (rng) {
      excludes.push(rng[1] || 'HEAD');
      includes.push(rng[2] || 'HEAD');
      return Promise.resolve();
    }
    if (a.charAt(0) === '^') { excludes.push(a.substring(1)); return Promise.resolve(); }
    includes.push(a);
    return Promise.resolve();
  }
  Promise.all(refsArg.map(pr)).then(function () {
    if (!includes.length && !excludes.length) {
      return _gitReply(id, '', 'usage: git rev-list <commit>...\n', 1, []);
    }
    return _walkRefsCollect(dir, fs, includes, excludes, firstParent).then(function (entries) {
      var filtered = entries.filter(function (e) {
        var pcount = (e.commit.parent || []).length;
        if (maxParents !== null && pcount > maxParents) return false;
        if (minParents !== null && pcount < minParents) return false;
        if (noMerges && pcount > 1) return false;
        if (onlyMerges && pcount <= 1) return false;
        return true;
      });
      if (reverse) filtered.reverse();
      if (max !== null) filtered = filtered.slice(0, max);
      if (count) return _gitReply(id, filtered.length + '\n', '', 0, []);
      var out = filtered.map(function (e) { return e.oid + '\n'; }).join('');
      _gitReply(id, out, '', 0, []);
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

// ---- git ls-files ----------------------------------------------------------
//
// List index contents. Common flags:
//   git ls-files                       — tracked paths
//   git ls-files -s / --stage          — mode + oid + stage + path
//   git ls-files -m / --modified       — modified vs index
//   git ls-files -d / --deleted        — deleted in workdir
//   git ls-files -o / --others         — untracked
//   git ls-files -i / --ignored        — ignored (we don't honor .gitignore yet)
//   git ls-files -c / --cached         — default: show cached entries
//   git ls-files -z                    — NUL-terminate
function _gitCmdLsFiles(id, args, dir, fs, cwd) {
  var stage = false, modified = false, deleted = false, others = false, cached = true;
  var nul = false;
  var pathspecs = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-s' || a === '--stage')    { stage = true; continue; }
    if (a === '-m' || a === '--modified') { modified = true; cached = false; continue; }
    if (a === '-d' || a === '--deleted')  { deleted = true; cached = false; continue; }
    if (a === '-o' || a === '--others')   { others = true; cached = false; continue; }
    if (a === '-c' || a === '--cached')   { cached = true; continue; }
    if (a === '-i' || a === '--ignored')  { continue; /* no .gitignore support */ }
    if (a === '-t' || a === '--full-name' || a === '--exclude-standard' ||
        a.indexOf('--exclude=') === 0 || a === '-x' ||
        a.indexOf('--exclude-from=') === 0 || a === '-X' ||
        a === '--directory' || a === '--no-empty-directory' ||
        a === '--abbrev' || a.indexOf('--abbrev=') === 0 ||
        a === '--debug' || a === '--eol' || a === '--error-unmatch') { continue; }
    if (a === '-z')                       { nul = true; continue; }
    if (a === '--')                       { continue; }
    if (a.charAt(0) === '-') { continue; }
    pathspecs.push(a);
  }

  _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
    var lines = [];
    var sep = nul ? '\0' : '\n';
    var pathFilter = pathspecs.length ? pathspecs.map(function (p) {
      return _toRel(dir, _normalizePath(cwd || dir, dir, p));
    }) : null;
    function inFilter(fp) {
      if (!pathFilter) return true;
      return pathFilter.some(function (k) { return k && (fp === k || fp.indexOf(k + '/') === 0); });
    }
    matrix.forEach(function (row) {
      var fp = row[0], H = row[1], W = row[2], S = row[3];
      if (!inFilter(fp)) return;
      var isUntracked = (H === 0 && W === 2 && S === 0);
      if (others && !isUntracked) return;
      if (!others) {
        if (modified) {
          if (!(H === 1 && W === 2)) return;
        } else if (deleted) {
          if (!(H === 1 && W === 0)) return;
        } else if (cached) {
          if (S === 0) return;  // not in index
        }
      }
      if (stage) {
        // mode oid stage\tpath  — we don't have per-blob mode tracking; use 100644
        var oidPromise = _git.readBlob
          ? _git.readBlob({ fs: fs, dir: dir, oid: 'HEAD', filepath: fp }).then(function (b) { return b.oid; }).catch(function () { return '0000000000000000000000000000000000000000'; })
          : Promise.resolve('0000000000000000000000000000000000000000');
        lines.push(oidPromise.then(function (o) { return '100644 ' + o + ' 0\t' + fp; }));
      } else {
        lines.push(Promise.resolve(fp));
      }
    });
    return Promise.all(lines).then(function (rs) {
      _gitReply(id, rs.join(sep) + (rs.length ? sep : ''), '', 0, []);
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

// ---- git cat-file ----------------------------------------------------------
//
// Inspect git objects. Modes:
//   git cat-file -t <oid>          — print object type (blob/tree/commit/tag)
//   git cat-file -s <oid>          — print object size
//   git cat-file -p <oid>          — pretty-print contents
//   git cat-file -e <oid>          — exit 0 if object exists
//   git cat-file <type> <oid>      — print contents (type must match)
function _gitCmdCatFile(id, args, dir, fs) {
  var mode = null, requested = null, oid = null;
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-t')      { mode = 'type'; continue; }
    if (a === '-s')      { mode = 'size'; continue; }
    if (a === '-p')      { mode = 'pretty'; continue; }
    if (a === '-e')      { mode = 'exists'; continue; }
    if (a === '--batch' || a === '--batch-check' || a === '--batch-all-objects' ||
        a.indexOf('--batch=') === 0 || a.indexOf('--batch-check=') === 0) {
      return _gitReply(id, '', "error: --batch modes are not supported in this terminal.\n", 1, []);
    }
    if (a.charAt(0) === '-') continue;
    if (!requested && (a === 'blob' || a === 'tree' || a === 'commit' || a === 'tag')) {
      requested = a; continue;
    }
    oid = a;
  }
  if (!oid) return _gitReply(id, '', "usage: git cat-file (-t|-s|-p|-e|<type>) <object>\n", 1, []);

  _resolveCommitish(fs, dir, oid).catch(function () {
    // Could be a blob/tree oid not reachable through resolveRef; fall back to expandOid.
    return _git.expandOid ? _git.expandOid({ fs: fs, dir: dir, oid: oid }) : Promise.reject(new Error('not a valid object'));
  }).then(function (full) {
    if (!_git.readObject) return Promise.reject(new Error('readObject not available'));
    return _git.readObject({ fs: fs, dir: dir, oid: full, format: 'parsed' }).then(function (obj) {
      var type = obj.type;
      if (mode === 'type')  return _gitReply(id, type + '\n', '', 0, []);
      if (mode === 'exists') return _gitReply(id, '', '', 0, []);
      if (mode === 'size') {
        // Size: if blob, byte length; if tree, # entries; if commit, message length.
        var sz = 0;
        if (type === 'blob' && obj.object) sz = obj.object.length;
        else if (type === 'commit' && obj.object && obj.object.message) sz = obj.object.message.length;
        else if (type === 'tree' && obj.object && obj.object.entries) sz = obj.object.entries.length;
        return _gitReply(id, sz + '\n', '', 0, []);
      }
      // Pretty: format depends on type.
      if (requested && requested !== type) {
        return _gitReply(id, '', "fatal: object " + full + " is not a " + requested + "\n", 1, []);
      }
      if (type === 'blob') {
        var blob = obj.object;
        var text = (blob && typeof blob.toString === 'function') ? new TextDecoder().decode(blob) : String(blob || '');
        return _gitReply(id, text + (text.endsWith('\n') ? '' : '\n'), '', 0, []);
      }
      if (type === 'commit') {
        var c = obj.object;
        var out = 'tree ' + (c.tree || '') + '\n';
        (c.parent || []).forEach(function (p) { out += 'parent ' + p + '\n'; });
        if (c.author) out += 'author ' + c.author.name + ' <' + c.author.email + '> ' +
          (c.author.timestamp || 0) + ' ' + (c.author.timezoneOffset || '+0000') + '\n';
        if (c.committer) out += 'committer ' + c.committer.name + ' <' + c.committer.email + '> ' +
          (c.committer.timestamp || 0) + ' ' + (c.committer.timezoneOffset || '+0000') + '\n';
        out += '\n' + (c.message || '');
        return _gitReply(id, out, '', 0, []);
      }
      if (type === 'tree') {
        var entries = (obj.object && obj.object.entries) || [];
        var out = entries.map(function (e) {
          return (e.mode || '100644') + ' ' + (e.type || 'blob') + ' ' + e.oid + '\t' + e.path;
        }).join('\n');
        return _gitReply(id, out + (out ? '\n' : ''), '', 0, []);
      }
      if (type === 'tag') {
        var t = obj.object;
        var out = 'object ' + (t.object || '') + '\ntype ' + (t.type || 'commit') +
                  '\ntag ' + (t.tag || '') + '\n';
        if (t.tagger) out += 'tagger ' + t.tagger.name + ' <' + t.tagger.email + '> ' +
          (t.tagger.timestamp || 0) + ' ' + (t.tagger.timezoneOffset || '+0000') + '\n';
        out += '\n' + (t.message || '');
        return _gitReply(id, out, '', 0, []);
      }
      _gitReply(id, '', 'fatal: unknown object type\n', 1, []);
    });
  }).catch(function (err) {
    if (mode === 'exists') return _gitReply(id, '', '', 1, []);
    _gitReply(id, '', "fatal: Not a valid object name " + oid + "\n", 1, []);
  });
}

// ---- git symbolic-ref ------------------------------------------------------
//
//   git symbolic-ref <name>            — print target of <name> (e.g. HEAD)
//   git symbolic-ref <name> <ref>      — set <name> to point at <ref>
//   git symbolic-ref --short <name>    — strip refs/heads/ prefix
//   git symbolic-ref -d <name>         — delete the symbolic ref file
function _gitCmdSymbolicRef(id, args, dir, fs) {
  var shortMode = false, del = false, quiet = false;
  var positional = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '--short')              { shortMode = true; continue; }
    if (a === '-d' || a === '--delete') { del = true; continue; }
    if (a === '-q' || a === '--quiet') { quiet = true; continue; }
    if (a === '-m')                   { i++; continue; /* reflog message — ignored */ }
    if (a.charAt(0) === '-')          { continue; }
    positional.push(a);
  }
  var name = positional[0];
  if (!name) return _gitReply(id, '', 'usage: git symbolic-ref <name> [<ref>]\n', 1, []);

  if (del) {
    try { pyodide.FS.unlink(dir + '/.git/' + name); } catch (e) {}
    return _gitReply(id, '', '', 0, []);
  }

  if (positional.length === 1) {
    // Read <name>: expect a "ref: <target>" pointer file.
    try {
      var content = pyodide.FS.readFile(dir + '/.git/' + name, { encoding: 'utf8' });
      var m = content.match(/^ref:\s*(\S+)/);
      if (!m) {
        if (quiet) return _gitReply(id, '', '', 1, []);
        return _gitReply(id, '', "fatal: ref " + name + " is not a symbolic ref\n", 1, []);
      }
      var target = m[1];
      if (shortMode) target = target.replace(/^refs\/(heads|tags)\//, '');
      return _gitReply(id, target + '\n', '', 0, []);
    } catch (e) {
      if (quiet) return _gitReply(id, '', '', 1, []);
      return _gitReply(id, '', "fatal: ref " + name + " is not a symbolic ref\n", 1, []);
    }
  }

  // Set: write the pointer file.
  var newTarget = positional[1];
  try {
    pyodide.FS.writeFile(dir + '/.git/' + name, 'ref: ' + newTarget + '\n', { encoding: 'utf8' });
  } catch (e) {
    return _gitReply(id, '', 'fatal: ' + e.message + '\n', 1, []);
  }
  _gitReply(id, '', '', 0, []);
}

// ---- git describe ----------------------------------------------------------
//
//   git describe                       — describe HEAD
//   git describe <ref>                 — describe <ref>
//   git describe --tags                — match lightweight tags too
//   git describe --always              — fall back to short oid
//   git describe --abbrev=<n>          — controls abbrev length
//   git describe --dirty               — append "-dirty" if workdir dirty
function _gitCmdDescribe(id, args, dir, fs) {
  var matchAllTags = false, alwaysFallback = false, dirty = false;
  var abbrev = 7;
  var refs = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '--tags')              { matchAllTags = true; continue; }
    if (a === '--always')            { alwaysFallback = true; continue; }
    if (a === '--dirty' || a.indexOf('--dirty=') === 0) { dirty = true; continue; }
    if (a === '--exact-match')       { continue; }
    if (a === '--abbrev')            { abbrev = parseInt(args[++i], 10) || 7; continue; }
    if (a.indexOf('--abbrev=') === 0) { abbrev = parseInt(a.substring('--abbrev='.length), 10) || 7; continue; }
    if (a === '--long' || a === '--first-parent' ||
        a === '--match' || a.indexOf('--match=') === 0 ||
        a === '--exclude' || a.indexOf('--exclude=') === 0) {
      if (a === '--match' || a === '--exclude') i++;
      continue;
    }
    if (a.charAt(0) === '-') continue;
    refs.push(a);
  }
  var ref = refs[0] || 'HEAD';

  Promise.all([
    _resolveCommitish(fs, dir, ref),
    _git.listTags ? _git.listTags({ fs: fs, dir: dir }) : Promise.resolve([]),
  ]).then(function (r) {
    var oid = r[0], tags = r[1];
    // Resolve each tag to its oid, walk ancestors of `oid` until we hit a
    // tag oid — the closest tag is the description anchor.
    return Promise.all(tags.map(function (t) {
      return _git.resolveRef({ fs: fs, dir: dir, ref: 'refs/tags/' + t }).then(function (o) {
        return { name: t, oid: o };
      }).catch(function () { return null; });
    })).then(function (tagOids) {
      var byOid = {};
      tagOids.filter(Boolean).forEach(function (to) { byOid[to.oid] = to.name; });

      // Walk ancestors counting distance.
      var distance = 0, current = oid, foundTag = null;
      function step() {
        if (byOid[current]) { foundTag = byOid[current]; return Promise.resolve(); }
        return _git.readCommit({ fs: fs, dir: dir, oid: current }).then(function (c) {
          var parents = c.commit.parent || [];
          if (!parents.length) return;
          distance++;
          current = parents[0];
          if (distance > 1000) return;  // safety
          return step();
        }).catch(function () {});
      }

      return step().then(function () {
        function dirtyTail() {
          if (!dirty) return '';
          return _git.statusMatrix({ fs: fs, dir: dir }).then(function (m) {
            return m.some(function (row) { return row[1] !== row[2] || row[1] !== row[3]; })
              ? '-dirty' : '';
          });
        }
        return Promise.resolve(dirtyTail()).then(function (dt) {
          if (foundTag === null) {
            if (alwaysFallback) return _gitReply(id, oid.substring(0, abbrev) + dt + '\n', '', 0, []);
            return _gitReply(id, '', "fatal: No names found, cannot describe anything.\n", 1, []);
          }
          if (distance === 0) return _gitReply(id, foundTag + dt + '\n', '', 0, []);
          var out = foundTag + '-' + distance + '-g' + oid.substring(0, abbrev) + dt;
          _gitReply(id, out + '\n', '', 0, []);
        });
      });
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

// ---- git clean -------------------------------------------------------------
//
// Remove untracked files / directories.
//   -n / --dry-run                      — show what would be removed
//   -f / --force                        — required to actually delete
//   -d                                  — also remove untracked directories
//   -x                                  — also remove ignored files (no-op: no .gitignore yet)
//   -X                                  — only ignored files (we have none, so empty)
//   -q / --quiet                        — suppress the "Would remove" lines
//   -i                                  — interactive (rejected)
function _gitCmdClean(id, args, dir, fs, cwd) {
  var force = false, dryRun = false, removeDirs = false, quiet = false;
  var includeIgnored = false, onlyIgnored = false;
  var pathspecs = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-f' || a === '--force')    { force = true; continue; }
    if (a === '-n' || a === '--dry-run')  { dryRun = true; continue; }
    if (a === '-d')                       { removeDirs = true; continue; }
    if (a === '-x')                       { includeIgnored = true; continue; }
    if (a === '-X')                       { onlyIgnored = true; continue; }
    if (a === '-q' || a === '--quiet')    { quiet = true; continue; }
    if (a === '-i' || a === '--interactive') {
      return _gitReply(id, '', "error: -i is not supported in this terminal.\n", 1, []);
    }
    if (a === '-e' || a === '--exclude' || a.indexOf('--exclude=') === 0) {
      if (a === '-e' || a === '--exclude') i++;
      continue;
    }
    if (a === '--')                       { continue; }
    if (a.charAt(0) === '-')              { continue; }
    pathspecs.push(a);
  }
  if (!force && !dryRun) {
    return _gitReply(id, '',
      "fatal: clean.requireForce defaults to true; refusing without -f or -n.\n", 1, []);
  }

  if (onlyIgnored) {
    // We don't track .gitignore; nothing to clean.
    return _gitReply(id, '', '', 0, []);
  }

  _git.statusMatrix({ fs: fs, dir: dir }).then(function (matrix) {
    var pathFilter = pathspecs.length ? pathspecs.map(function (p) {
      return _toRel(dir, _normalizePath(cwd || dir, dir, p));
    }) : null;
    function inFilter(fp) {
      if (!pathFilter) return true;
      return pathFilter.some(function (k) { return k && (fp === k || fp.indexOf(k + '/') === 0 || k === '.'); });
    }
    var untracked = matrix.filter(function (row) {
      var H = row[1], W = row[2], S = row[3];
      return H === 0 && W === 2 && S === 0 && inFilter(row[0]);
    }).map(function (row) { return row[0]; });

    var out = '';
    untracked.forEach(function (fp) {
      var prefix = dryRun ? 'Would remove ' : 'Removing ';
      if (!quiet) out += prefix + fp + '\n';
      if (!dryRun) {
        try { pyodide.FS.unlink(dir + '/' + fp); } catch (e) {}
      }
    });

    // If -d, also try to remove now-empty directories. Walk worktree and
    // unlink any dir that has no entries (other than under .git/).
    if (removeDirs && !dryRun) {
      function pruneEmpty(absPath) {
        if (absPath === dir) return false;
        var rel = _toRel(dir, absPath);
        if (!rel || rel === '.git' || rel.indexOf('.git/') === 0) return false;
        var entries;
        try { entries = pyodide.FS.readdir(absPath); } catch (e) { return false; }
        entries = entries.filter(function (n) { return n !== '.' && n !== '..'; });
        if (entries.length === 0) {
          try { pyodide.FS.rmdir(absPath); if (!quiet) out += 'Removing ' + rel + '/\n'; return true; } catch (e) {}
        }
        return false;
      }
      // Walk depth-first.
      function walk(absPath) {
        var st; try { st = pyodide.FS.stat(absPath); } catch (e) { return; }
        if ((st.mode & 0o170000) !== 0o040000) return;
        var rel = _toRel(dir, absPath);
        if (rel === '.git' || (rel && rel.indexOf('.git/') === 0)) return;
        var entries; try { entries = pyodide.FS.readdir(absPath); } catch (e) { return; }
        entries.filter(function (n) { return n !== '.' && n !== '..'; }).forEach(function (n) {
          walk((absPath === '/' ? '' : absPath) + '/' + n);
        });
        pruneEmpty(absPath);
      }
      walk(dir);
    }

    var mutated = dryRun ? [] : untracked;
    _gitReply(id, out, '', 0, mutated);
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

// ---- git rebase ------------------------------------------------------------
//
// Tutorial-grade `git rebase`: replay current branch's commits on top of <upstream>.
// Modes:
//   git rebase <upstream>              — rebase HEAD onto <upstream>
//   git rebase <upstream> <branch>     — rebase <branch> onto <upstream>
//   git rebase --onto <newbase> <upstream> [<branch>] — three-arg rebase
//   git rebase --abort                 — restore pre-rebase state
//   git rebase --continue              — resume after manual conflict fix
//   git rebase --skip                  — skip the current commit
//   git rebase -i / --interactive      — rejected (no editor)
//
// State is tracked in `.git/REBASE_STATE.json`: { onto, base, todo: [oid...],
// done: [oid...], origBranch, origOid, origRef }.
var REBASE_STATE_PATH = '/.git/REBASE_STATE.json';
function _rebaseRead(dir) {
  try { return JSON.parse(pyodide.FS.readFile(dir + REBASE_STATE_PATH, { encoding: 'utf8' })); }
  catch (e) { return null; }
}
function _rebaseWrite(dir, st) {
  pyodide.FS.writeFile(dir + REBASE_STATE_PATH, JSON.stringify(st), { encoding: 'utf8' });
}
function _rebaseClear(dir) {
  try { pyodide.FS.unlink(dir + REBASE_STATE_PATH); } catch (e) {}
}

function _gitCmdRebase(id, args, dir, fs) {
  var doAbort = false, doContinue = false, doSkip = false;
  var ontoArg = null;
  var positional = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '--abort')      { doAbort = true; continue; }
    if (a === '--continue')   { doContinue = true; continue; }
    if (a === '--skip')       { doSkip = true; continue; }
    if (a === '--quit')       { _rebaseClear(dir); return _gitReply(id, '', '', 0, []); }
    if (a === '--onto')       { ontoArg = args[++i]; continue; }
    if (a.indexOf('--onto=') === 0) { ontoArg = a.substring('--onto='.length); continue; }
    if (a === '-i' || a === '--interactive') {
      return _gitReply(id, '', "error: -i / --interactive isn't supported in this terminal.\n", 1, []);
    }
    if (a === '--root' || a === '--no-keep-empty' || a === '--keep-empty' ||
        a === '--autosquash' || a === '--no-autosquash' ||
        a === '--autostash' || a === '--no-autostash' ||
        a === '--rerere-autoupdate' || a === '--no-rerere-autoupdate' ||
        a === '--no-ff' || a === '--ff' || a === '-f' || a === '--force-rebase' ||
        a === '-x' || a === '-s' || a === '--strategy' || a.indexOf('--strategy=') === 0 ||
        a === '-X' || a === '--strategy-option' || a.indexOf('--strategy-option=') === 0 ||
        a === '-q' || a === '--quiet' || a === '-v' || a === '--verbose' ||
        a === '--no-verify' || a === '--verify' || a === '-n' ||
        a === '-S' || a === '--gpg-sign' || a === '--no-gpg-sign' || a.indexOf('--gpg-sign=') === 0 ||
        a === '--committer-date-is-author-date' || a === '--ignore-date' ||
        a === '--reschedule-failed-exec' || a === '--no-reschedule-failed-exec' ||
        a === '--update-refs' || a === '--no-update-refs' ||
        a === '--exec' || a === '-r' || a === '--rebase-merges') {
      if (a === '-x' || a === '--exec' || a === '-s' || a === '--strategy' ||
          a === '-X' || a === '--strategy-option') i++;
      continue;
    }
    if (a === '--')           { continue; }
    if (a.charAt(0) === '-')  { continue; }
    positional.push(a);
  }

  if (doAbort) {
    var st = _rebaseRead(dir);
    if (!st) return _gitReply(id, '', "fatal: No rebase in progress.\n", 1, []);
    return _git.checkout({ fs: fs, dir: dir, ref: st.origRef || st.origBranch, force: true })
      .then(function () {
        if (st.origBranch && st.origOid) {
          return _git.writeRef({ fs: fs, dir: dir, ref: 'refs/heads/' + st.origBranch, value: st.origOid, force: true });
        }
      }).then(function () {
        _rebaseClear(dir);
        return _snapshotPaths(dir);
      }).then(function (post) {
        _gitReply(id, '', '', 0, Object.keys(post));
      }).catch(function (err) { _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []); });
  }

  if (doContinue || doSkip) {
    var st2 = _rebaseRead(dir);
    if (!st2) return _gitReply(id, '', "fatal: No rebase in progress.\n", 1, []);
    return _rebaseStep(id, dir, fs, st2, doSkip);
  }

  var upstream = positional[0];
  var rebaseBranch = positional[1];
  if (!upstream) return _gitReply(id, '', "fatal: rebase requires an upstream\n", 1, []);

  // Determine onto (defaults to upstream).
  var onto = ontoArg || upstream;

  // 1. Resolve oids for upstream, onto, and the branch being rebased.
  Promise.all([
    _resolveCommitish(fs, dir, upstream),
    _resolveCommitish(fs, dir, onto),
    _git.currentBranch({ fs: fs, dir: dir }).catch(function () { return null; }),
    _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
  ]).then(function (r) {
    var upstreamOid = r[0], ontoOid = r[1], curBranch = r[2], headOid = r[3];
    var workBranch = rebaseBranch || curBranch;
    if (!workBranch) {
      return _gitReply(id, '', "fatal: not on a branch — cannot rebase\n", 1, []);
    }
    return _git.resolveRef({ fs: fs, dir: dir, ref: workBranch }).then(function (branchOid) {
      // 2. Compute the list of commits to replay: commits reachable from
      //    workBranch that are NOT reachable from upstream.
      return _expandReachable(dir, fs, [upstreamOid], false).then(function (excl) {
        var exclSet = {}; excl.forEach(function (o) { exclSet[o] = true; });
        return _walkRefsCollect(dir, fs, [branchOid], [upstreamOid], false).then(function (entries) {
          // Order: oldest first (replay in chronological order).
          var todo = entries.slice().reverse().map(function (e) { return e.oid; });

          if (todo.length === 0) {
            // Nothing to do (branch already on upstream).
            // Still move ref to onto if --onto is provided and differs.
            if (ontoArg && branchOid !== ontoOid) {
              return _git.writeRef({ fs: fs, dir: dir, ref: 'refs/heads/' + workBranch, value: ontoOid, force: true })
                .then(function () { return _git.checkout({ fs: fs, dir: dir, ref: workBranch, force: true }); })
                .then(function () { return _snapshotPaths(dir); })
                .then(function (post) { _gitReply(id, "Current branch " + workBranch + " is up to date.\n", '', 0, Object.keys(post)); });
            }
            return _gitReply(id, "Current branch " + workBranch + " is up to date.\n", '', 0, []);
          }

          // 3. Stash original ref state, checkout `onto`, then replay.
          var rebaseState = {
            onto: ontoOid, upstream: upstreamOid, branch: workBranch,
            origBranch: workBranch, origOid: branchOid, origRef: workBranch,
            todo: todo, done: [],
          };

          return _git.checkout({ fs: fs, dir: dir, ref: ontoOid, force: true })
            .then(function () {
              _rebaseWrite(dir, rebaseState);
              return _rebaseStep(id, dir, fs, rebaseState, false);
            });
        });
      });
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

// Replay todo[0] on top of HEAD, then advance. On --skip, drop todo[0]. On
// completion, point the branch ref at HEAD and clear state.
function _rebaseStep(id, dir, fs, st, skipFirst) {
  if (skipFirst && st.todo.length) st.todo.shift();
  if (st.todo.length === 0) {
    // Done. Move branch to current HEAD.
    return _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).then(function (newOid) {
      return _git.writeRef({ fs: fs, dir: dir, ref: 'refs/heads/' + st.branch, value: newOid, force: true })
        .then(function () { return _git.checkout({ fs: fs, dir: dir, ref: st.branch, force: true }); })
        .then(function () {
          _appendReflog(dir, 'HEAD', st.origOid, newOid, 'rebase finished: ' + st.branch + ' onto ' + st.onto);
          _appendReflog(dir, 'refs/heads/' + st.branch, st.origOid, newOid, 'rebase finished onto ' + st.onto);
          _rebaseClear(dir);
          return _snapshotPaths(dir);
        });
    }).then(function (post) {
      _gitReply(id, "Successfully rebased and updated refs/heads/" + st.branch + ".\n",
        '', 0, Object.keys(post));
    }).catch(function (err) { _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []); });
  }

  var oid = st.todo[0];
  // Cherry-pick this oid: replay its parent→commit diff onto the workdir.
  _git.readCommit({ fs: fs, dir: dir, oid: oid }).then(function (c) {
    var parentOid = (c.commit.parent || [])[0] || null;
    var parentFiles = {}, sourceFiles = {};
    var collectParent = parentOid ? _walkCommitTree(fs, dir, parentOid, parentFiles, '') : Promise.resolve();
    return collectParent
      .then(function () { return _walkCommitTree(fs, dir, oid, sourceFiles, ''); })
      .then(function () {
        // Apply diff on top of workdir.
        var allPaths = {};
        Object.keys(parentFiles).forEach(function (k) { allPaths[k] = true; });
        Object.keys(sourceFiles).forEach(function (k) { allPaths[k] = true; });
        var changed = [];
        Object.keys(allPaths).forEach(function (p) {
          var pa = parentFiles[p], so = sourceFiles[p];
          if (pa === so) return;
          if (so === undefined) {
            try { pyodide.FS.unlink(dir + '/' + p); } catch (e) {}
          } else {
            var subdir = p.indexOf('/') !== -1 ? p.substring(0, p.lastIndexOf('/')) : '';
            if (subdir) {
              var parts = subdir.split('/'); var cur = dir;
              parts.forEach(function (s) { cur += '/' + s; try { pyodide.FS.mkdir(cur); } catch (e) {} });
            }
            pyodide.FS.writeFile(dir + '/' + p, so, { encoding: 'utf8' });
          }
          changed.push(p);
        });
        return Promise.all(changed.map(function (p) {
          var abs = dir + '/' + p;
          var exists = true; try { pyodide.FS.stat(abs); } catch (e) { exists = false; }
          return exists ? _git.add({ fs: fs, dir: dir, filepath: p })
                        : _git.remove({ fs: fs, dir: dir, filepath: p });
        })).then(function () {
          // Commit on the rebase HEAD with the original message and author.
          return _git.commit({
            fs: fs, dir: dir,
            message: c.commit.message || ('rebase replay of ' + oid.substring(0, 7)),
            author: c.commit.author,
          });
        });
      });
  }).then(function () {
    st.done.push(oid);
    st.todo.shift();
    _rebaseWrite(dir, st);
    return _rebaseStep(id, dir, fs, st, false);
  }).catch(function (err) {
    // Pause for user intervention.
    _gitReply(id, '',
      "Could not apply " + oid.substring(0, 7) + " (" + (err.message || err) + ")\n" +
      "When you have resolved this problem run \"git rebase --continue\".\n" +
      "If you would prefer to skip this patch, instead run \"git rebase --skip\".\n",
      1, []);
  });
}

// ---- git remote ------------------------------------------------------------
//
//   git remote                          — list remotes
//   git remote -v / --verbose           — list with URLs
//   git remote add <name> <url>         — add a new remote
//   git remote remove <name>            — remove a remote
//   git remote rename <old> <new>       — rename a remote
//   git remote get-url <name>           — print fetch URL
//   git remote set-url <name> <url>     — change URL
//   git remote show <name>              — show details
function _gitCmdRemote(id, args, dir, fs) {
  var verbose = false;
  var positional = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-v' || a === '--verbose') { verbose = true; continue; }
    if (a === '--')                      { continue; }
    if (a.charAt(0) === '-')             { continue; }
    positional.push(a);
  }
  var sub = positional[0];

  function listAll() {
    return (_git.listRemotes ? _git.listRemotes({ fs: fs, dir: dir }) : Promise.resolve([]))
      .catch(function () { return []; });
  }

  if (!sub) {
    return listAll().then(function (remotes) {
      var lines = (remotes || []).map(function (r) {
        if (verbose) {
          return r.remote + '\t' + r.url + ' (fetch)\n' +
                 r.remote + '\t' + r.url + ' (push)\n';
        }
        return r.remote + '\n';
      });
      _gitReply(id, lines.join(''), '', 0, []);
    });
  }

  if (sub === 'add') {
    var name = positional[1], url = positional[2];
    if (!name || !url) return _gitReply(id, '', 'usage: git remote add <name> <url>\n', 1, []);
    if (!_git.addRemote) return _gitReply(id, '', 'fatal: addRemote not available in this iso-git build\n', 1, []);
    return _git.addRemote({ fs: fs, dir: dir, remote: name, url: url, force: false })
      .then(function () { _gitReply(id, '', '', 0, []); })
      .catch(function (err) { _gitReply(id, '', 'error: ' + (err.message || err) + '\n', 1, []); });
  }

  if (sub === 'remove' || sub === 'rm') {
    var rname = positional[1];
    if (!rname) return _gitReply(id, '', 'usage: git remote remove <name>\n', 1, []);
    if (!_git.deleteRemote) return _gitReply(id, '', 'fatal: deleteRemote not available\n', 1, []);
    return _git.deleteRemote({ fs: fs, dir: dir, remote: rname })
      .then(function () { _gitReply(id, '', '', 0, []); })
      .catch(function (err) { _gitReply(id, '', 'error: ' + (err.message || err) + '\n', 1, []); });
  }

  if (sub === 'rename') {
    var oldN = positional[1], newN = positional[2];
    if (!oldN || !newN) return _gitReply(id, '', 'usage: git remote rename <old> <new>\n', 1, []);
    if (!_git.listRemotes) return _gitReply(id, '', 'fatal: rename not available\n', 1, []);
    return _git.listRemotes({ fs: fs, dir: dir }).then(function (remotes) {
      var match = (remotes || []).find(function (r) { return r.remote === oldN; });
      if (!match) return _gitReply(id, '', "error: no such remote '" + oldN + "'\n", 1, []);
      return _git.deleteRemote({ fs: fs, dir: dir, remote: oldN })
        .then(function () { return _git.addRemote({ fs: fs, dir: dir, remote: newN, url: match.url, force: false }); })
        .then(function () { _gitReply(id, '', '', 0, []); });
    }).catch(function (err) { _gitReply(id, '', 'error: ' + (err.message || err) + '\n', 1, []); });
  }

  if (sub === 'get-url') {
    var gname = positional[1];
    if (!gname) return _gitReply(id, '', 'usage: git remote get-url <name>\n', 1, []);
    return listAll().then(function (remotes) {
      var match = (remotes || []).find(function (r) { return r.remote === gname; });
      if (!match) return _gitReply(id, '', "fatal: no such remote '" + gname + "'\n", 1, []);
      _gitReply(id, match.url + '\n', '', 0, []);
    });
  }

  if (sub === 'set-url') {
    var sname = positional[1], surl = positional[2];
    if (!sname || !surl) return _gitReply(id, '', 'usage: git remote set-url <name> <url>\n', 1, []);
    return _git.deleteRemote({ fs: fs, dir: dir, remote: sname })
      .catch(function () { /* ok if missing */ })
      .then(function () { return _git.addRemote({ fs: fs, dir: dir, remote: sname, url: surl, force: true }); })
      .then(function () { _gitReply(id, '', '', 0, []); })
      .catch(function (err) { _gitReply(id, '', 'error: ' + (err.message || err) + '\n', 1, []); });
  }

  if (sub === 'show') {
    var ssname = positional[1];
    return listAll().then(function (remotes) {
      var match = (remotes || []).find(function (r) { return r.remote === ssname; });
      if (!match) return _gitReply(id, '', "fatal: no such remote '" + ssname + "'\n", 1, []);
      var out = '* remote ' + match.remote + '\n  Fetch URL: ' + match.url + '\n  Push URL: ' + match.url + '\n';
      _gitReply(id, out, '', 0, []);
    });
  }

  if (sub === 'prune' || sub === 'update' || sub === 'set-head') {
    return _gitReply(id, '',
      "git remote " + sub + ": needs network access (not supported in tutorial sandbox).\n", 1, []);
  }

  _gitReply(id, '', "git remote: unknown subcommand '" + sub + "'\n", 1, []);
}

// ---- git fetch / pull / push / clone ---------------------------------------
//
// These all need network access. iso-git supports them via fetch(), pull(),
// push(), clone() but the tutorial sandbox enforces same-origin so most
// public git hosts won't work. We surface a clear error so users aren't
// surprised by a hung request, and we still try iso-git for explicit URLs
// that DO permit CORS (rare, but possible for self-hosted / proxy setups).

function _gitCmdFetch(id, args, dir, fs) {
  var remote = null, refspec = null;
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a.charAt(0) === '-') continue;
    if (!remote) { remote = a; continue; }
    if (!refspec) { refspec = a; continue; }
  }
  if (!_git.fetch) return _gitReply(id, '', "fatal: fetch is not available in this iso-git build\n", 1, []);
  _git.fetch({
    fs: fs, dir: dir, http: self.http || undefined,
    remote: remote || 'origin',
    ref: refspec, singleBranch: !!refspec,
    onAuth: function () { return {}; },
  }).then(function () { _gitReply(id, "From " + (remote || 'origin') + "\n   <fetched>\n", '', 0, []); })
    .catch(function (err) {
      _gitReply(id, '',
        "fatal: fetch failed (" + (err.message || err) + ").\n" +
        "Note: the tutorial sandbox is same-origin; only servers that allow CORS will work.\n",
        1, []);
    });
}
function _gitCmdPull(id, args, dir, fs) {
  if (!_git.pull) return _gitReply(id, '', "fatal: pull is not available in this iso-git build\n", 1, []);
  _git.pull({
    fs: fs, dir: dir, http: self.http || undefined,
    author: { name: 'Student', email: 'student@example.com' },
    onAuth: function () { return {}; },
  }).then(function () { _gitReply(id, "Already up to date.\n", '', 0, []); })
    .catch(function (err) {
      _gitReply(id, '',
        "fatal: pull failed (" + (err.message || err) + ").\n" +
        "Note: the tutorial sandbox is same-origin; only servers that allow CORS will work.\n",
        1, []);
    });
}
function _gitCmdPush(id, args, dir, fs) {
  if (!_git.push) return _gitReply(id, '', "fatal: push is not available in this iso-git build\n", 1, []);
  _git.push({
    fs: fs, dir: dir, http: self.http || undefined,
    onAuth: function () { return {}; },
  }).then(function () { _gitReply(id, "Everything up-to-date\n", '', 0, []); })
    .catch(function (err) {
      _gitReply(id, '',
        "fatal: push failed (" + (err.message || err) + ").\n" +
        "Note: the tutorial sandbox is same-origin; only servers that allow CORS will work.\n",
        1, []);
    });
}
function _gitCmdClone(id, args, dir, fs) {
  // Limited support: clone needs a CORS-friendly endpoint.
  if (!_git.clone) return _gitReply(id, '', "fatal: clone is not available in this iso-git build\n", 1, []);
  var url = args.find(function (a) { return a.charAt(0) !== '-'; });
  if (!url) return _gitReply(id, '', "fatal: clone requires a URL\n", 1, []);
  _git.clone({
    fs: fs, dir: dir, http: self.http || undefined,
    url: url, singleBranch: true, depth: 1,
    onAuth: function () { return {}; },
  }).then(function () { _gitReply(id, "Cloned into " + dir + "\n", '', 0, []); })
    .catch(function (err) {
      _gitReply(id, '',
        "fatal: clone failed (" + (err.message || err) + ").\n" +
        "Note: the tutorial sandbox is same-origin; only servers that allow CORS will work.\n",
        1, []);
    });
}

// ---- git blame / annotate -------------------------------------------------
//
// Tutorial-grade blame: walk the file's history backwards and attribute each
// line to the most recent commit that introduced (or kept) it. Output mimics
// real git's compact form:  ^abc1234 (Author 2024-01-01 line) text
function _gitCmdBlame(id, args, dir, fs, cwd) {
  var file = null;
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-L' || a.indexOf('-L') === 0) {
      // Range option (we currently ignore the range and blame everything).
      if (a === '-L') i++;
      continue;
    }
    if (a === '-w' || a === '-M' || a === '-C' || a === '-c' || a === '-l' ||
        a === '--root' || a === '--show-stats' || a === '--score-debug' ||
        a === '--no-progress' || a === '--progress' || a === '-s' || a === '-e' ||
        a === '-p' || a === '--porcelain' || a === '--line-porcelain' ||
        a === '--abbrev' || a.indexOf('--abbrev=') === 0 ||
        a === '--first-parent' || a === '--reverse' || a === '--no-renames' ||
        a === '-h' || a === '--help' || a === '-t') {
      continue;
    }
    if (a === '--') continue;
    if (a.charAt(0) === '-') continue;
    if (!file) file = a;
  }
  if (!file) return _gitReply(id, '', "fatal: blame requires a path\n", 1, []);
  var rel = _toRel(dir, _normalizePath(cwd || dir, dir, file));
  if (!rel) return _gitReply(id, '', "fatal: '" + file + "' is outside the working tree\n", 1, []);

  // Read current file content (the blame target), then walk log to find the
  // commit each line was last touched in.
  var currentContent;
  try { currentContent = pyodide.FS.readFile(dir + '/' + rel, { encoding: 'utf8' }); }
  catch (e) { return _gitReply(id, '', "fatal: cannot read '" + rel + "'\n", 1, []); }
  var lines = currentContent.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  var attrib = new Array(lines.length).fill(null);

  _git.log({ fs: fs, dir: dir, depth: 500 }).then(function (commits) {
    function walk(idx) {
      if (idx >= commits.length) return Promise.resolve();
      var c = commits[idx];
      var oid = c.oid;
      var ts = c.commit && c.commit.author && c.commit.author.timestamp || 0;
      var who = (c.commit && c.commit.author && c.commit.author.name) || 'unknown';
      return _git.readBlob({ fs: fs, dir: dir, oid: oid, filepath: rel }).then(function (b) {
        var content = new TextDecoder().decode(b.blob);
        var theseLines = content.split('\n');
        if (theseLines.length && theseLines[theseLines.length - 1] === '') theseLines.pop();
        // Mark each line that matches as "first seen here" — keep the deepest
        // commit (oldest) where the line still appears. Walk in newest-first
        // order: only mark unset slots.
        for (var i = 0; i < lines.length; i++) {
          if (attrib[i]) continue;
          if (theseLines.indexOf(lines[i]) !== -1) {
            attrib[i] = { oid: oid, who: who, ts: ts };
          }
        }
      }).catch(function () {
        // File didn't exist at that commit — assume current attribution
        // belongs to the next-newer commit we already saw.
      }).then(function () {
        if (attrib.every(Boolean)) return;
        return walk(idx + 1);
      });
    }
    return walk(0).then(function () {
      var YELLOW = '\x1b[33m', RESET = '\x1b[m';
      var out = '';
      for (var i = 0; i < lines.length; i++) {
        var a = attrib[i];
        if (!a) {
          out += YELLOW + '0000000' + RESET + ' (Not Committed Yet ' +
                 new Date().toISOString().substring(0, 10) + ' ' + (i + 1) + ') ' + lines[i] + '\n';
        } else {
          var date = a.ts ? new Date(a.ts * 1000).toISOString().substring(0, 10) : '0000-00-00';
          out += YELLOW + a.oid.substring(0, 7) + RESET + ' (' + a.who + ' ' + date + ' ' + (i + 1) + ') ' + lines[i] + '\n';
        }
      }
      _gitReply(id, out, '', 0, []);
    });
  }).catch(function (err) {
    _gitReply(id, '', 'fatal: ' + (err.message || err) + '\n', 1, []);
  });
}

// ---- git fsck / gc / version / help ---------------------------------------

function _gitCmdFsck(id, args, dir, fs) {
  // We don't do a real integrity check; just verify HEAD resolves and any
  // listed branches resolve. Anything else is reported as "no problems".
  Promise.all([
    _git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }).catch(function () { return null; }),
    _git.listBranches({ fs: fs, dir: dir }).catch(function () { return []; }),
  ]).then(function (r) {
    var headOid = r[0], branches = r[1];
    var problems = [];
    if (!headOid) problems.push('error: HEAD does not resolve');
    return Promise.all(branches.map(function (b) {
      return _git.resolveRef({ fs: fs, dir: dir, ref: b }).catch(function () {
        problems.push("error: branch '" + b + "' does not resolve");
      });
    })).then(function () {
      var out = problems.length ? problems.join('\n') + '\n' : 'Checking object directories: 100% (1/1), done.\n';
      _gitReply(id, out, '', problems.length ? 1 : 0, []);
    });
  });
}

function _gitCmdGc(id, args, dir, fs) {
  // No-op in the tutorial sandbox. Real git would repack objects and prune
  // unreachable ones; we don't have an object DB layout to compact.
  _gitReply(id, '', '', 0, []);
}

function _gitCmdVersion(id) {
  var ver = (_git && _git.version && typeof _git.version === 'function')
    ? (_git.version() || 'unknown')
    : 'isomorphic-git tutorial build';
  _gitReply(id, 'git version ' + ver + ' (sandbox)\n', '', 0, []);
}

function _gitCmdHelp(id, args) {
  var topic = args && args[0];
  if (!topic || topic === '-a' || topic === '--all') {
    var out =
      "usage: git [-v|--version] [-h|--help] [-C <path>] [-c <name>=<value>]\n" +
      "           <command> [<args>]\n\n" +
      "These are common git commands supported in this terminal:\n\n" +
      "start a working area:\n" +
      "   clone      Clone a repository (CORS-permitting only)\n" +
      "   init       Create an empty Git repository\n\n" +
      "work on the current change:\n" +
      "   add        Add file contents to the index\n" +
      "   mv         Move or rename a file\n" +
      "   restore    Restore working tree files\n" +
      "   rm         Remove files from working tree and index\n\n" +
      "examine the history and state:\n" +
      "   bisect     Use binary search to find the commit that introduced a bug\n" +
      "   blame      Show what revision and author last modified each line\n" +
      "   diff       Show changes between commits, commit and working tree, etc.\n" +
      "   grep       (not supported)\n" +
      "   log        Show commit logs\n" +
      "   show       Show various types of objects\n" +
      "   status     Show the working tree status\n\n" +
      "grow, mark and tweak your common history:\n" +
      "   branch     List, create, or delete branches\n" +
      "   commit     Record changes to the repository\n" +
      "   merge      Join two or more development histories\n" +
      "   rebase     Reapply commits on top of another base tip\n" +
      "   reset      Reset current HEAD to the specified state\n" +
      "   revert     Revert some existing commits\n" +
      "   switch     Switch branches\n" +
      "   tag        Create, list, delete, or verify tags\n\n" +
      "collaborate:\n" +
      "   fetch      Download objects from a remote (CORS-permitting only)\n" +
      "   pull       Fetch and integrate (CORS-permitting only)\n" +
      "   push       Update remote refs (CORS-permitting only)\n" +
      "   remote     Manage tracked remotes\n\n" +
      "run 'git help <command>' for more on a specific command.\n";
    return _gitReply(id, out, '', 0, []);
  }
  // Per-command help: just echo a one-line description.
  var msgs = {
    add:      "Add file contents to the index.",
    branch:   "List, create, or delete branches.",
    checkout: "Switch branches or restore working tree files.",
    commit:   "Record changes to the repository.",
    diff:     "Show changes between commits, commit and working tree, etc.",
    init:     "Create an empty Git repository.",
    log:      "Show commit logs.",
    merge:    "Join two or more development histories together.",
    rebase:   "Reapply commits on top of another base tip.",
    reset:    "Reset current HEAD to the specified state.",
    restore:  "Restore working tree files.",
    revert:   "Revert some existing commits.",
    rm:       "Remove files from working tree and the index.",
    show:     "Show various types of objects.",
    stash:    "Stash the changes in a dirty working directory away.",
    status:   "Show the working tree status.",
    switch:   "Switch branches.",
    tag:      "Create, list, delete or verify tags.",
  };
  var help = msgs[topic];
  if (help) return _gitReply(id, 'git ' + topic + ' — ' + help + '\n', '', 0, []);
  _gitReply(id, '', "No manual entry for git-" + topic + " in the tutorial.\n", 1, []);
}


// ---- Unix command module (lazy-loaded) ------------------------------------
//
// pyodide-unix.js is loaded on the first non-git command typed in the
// terminal. It inherits all helpers defined above (_gitReply, _normalizePath,
// _toRel, _formatHunks, …) because importScripts runs in the same scope.

var _unixModuleLoaded = false;
var _unixModuleLoadError = null;

function _ensureUnixModuleLoaded() {
  if (_unixModuleLoaded) return Promise.resolve();
  if (_unixModuleLoadError) return Promise.reject(_unixModuleLoadError);
  try {
    importScripts('/js/pyodide-unix.js?v=' + Date.now());
    _unixModuleLoaded = true;
    return Promise.resolve();
  } catch (err) {
    _unixModuleLoadError = err;
    return Promise.reject(err);
  }
}
