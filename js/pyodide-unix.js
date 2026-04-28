/**
 * Pyodide Unix Helpers — POSIX-flavoured shell commands on the Pyodide FS
 *
 * Lazy-loaded by `pyodide-git.js` on the first non-git command typed in the
 * terminal. This file MUST only be imported after `pyodide-git.js` is already
 * in scope — it relies on the helpers that the git module defines as globals:
 *   _gitReply, _normalizePath, _toRel, _resolveAbs, _formatHunks,
 *   _isDir (added below), _gitDir, pyodide.
 *
 * Commands: ls, pwd, cat, echo, mkdir, rmdir, touch, rm, cp, mv, head, tail,
 *           wc, grep, find, which, diff, sort, uniq, basename, dirname,
 *           realpath, printf, date, env, true, false, :
 */
'use strict';

// ---- Unix-flavored helper commands ----------------------------------------
//
// A small toolbox so a Python+git tutorial doesn't grind to "command not
// found" the moment a student types `cat hello.py` or `mkdir src`. These
// run on the Pyodide FS (worker side) using `pyodide.FS.*` directly. They
// are intentionally minimal — no pipes, redirects, globs, or substitutions
// — but cover the shapes a learner is most likely to type alongside `git`.
//
// Path resolution: every helper resolves args relative to `cwd` (the typed
// terminal's notion of the current directory) using `_normalizePath`, the
// same routine the git dispatcher uses. So `cat ../README.md` and
// `head -n 5 src/main.py` both behave like real Unix.

function _isDir(abs) {
  try { var st = pyodide.FS.stat(abs); return (st.mode & 0o170000) === 0o040000; }
  catch (e) { return false; }
}
function _exists(abs) {
  try { pyodide.FS.stat(abs); return true; } catch (e) { return false; }
}
function _readText(abs) {
  return pyodide.FS.readFile(abs, { encoding: 'utf8' });
}
function _writeText(abs, content) {
  // Make sure parent directories exist before writing.
  var lastSlash = abs.lastIndexOf('/');
  if (lastSlash > 0) {
    var parent = abs.substring(0, lastSlash);
    var parts = parent.split('/').filter(Boolean);
    var cur = '';
    parts.forEach(function (p) {
      cur += '/' + p;
      try { pyodide.FS.mkdir(cur); } catch (e) { /* exists */ }
    });
  }
  pyodide.FS.writeFile(abs, content, { encoding: 'utf8' });
}

// Walk the FS recursively, yielding {abs, rel, isDir} entries. Skips .git/
// to keep `find`/`grep` output focused on user files. Caller chooses whether
// to include directories.
function _walkFs(rootAbs, includeDirs) {
  var out = [];
  function walk(abs, depth) {
    var st;
    try { st = pyodide.FS.stat(abs); } catch (e) { return; }
    var isDir = (st.mode & 0o170000) === 0o040000;
    if (isDir) {
      if (depth > 0 && includeDirs) out.push({ abs: abs, isDir: true });
      var entries; try { entries = pyodide.FS.readdir(abs); } catch (e) { return; }
      entries.forEach(function (n) {
        if (n === '.' || n === '..') return;
        if (n === '.git' && depth === 0) return;  // skip top-level .git
        walk((abs === '/' ? '' : abs) + '/' + n, depth + 1);
      });
    } else {
      out.push({ abs: abs, isDir: false });
    }
  }
  walk(rootAbs, 0);
  return out;
}

// Glob a single token against the FS. Supports * and ? in the final segment
// and (limited) middle segments. Returns the original token if nothing
// matches — callers then surface a "no such file" error like real shells do.
function _glob(token, cwd, dir) {
  if (!/[*?[]/.test(token)) return [token];
  var abs = _normalizePath(cwd, dir, token);
  var lastSlash = abs.lastIndexOf('/');
  var parent = abs.substring(0, lastSlash) || '/';
  var pattern = abs.substring(lastSlash + 1);
  var rx = new RegExp('^' + pattern
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]') + '$');
  var matches = [];
  var entries = [];
  try { entries = pyodide.FS.readdir(parent); } catch (e) { return [token]; }
  entries.forEach(function (n) {
    if (n === '.' || n === '..') return;
    if (rx.test(n)) {
      var full = (parent === '/' ? '/' : parent + '/') + n;
      // Re-relativise to keep callers happy. We always return absolute
      // paths from glob; callers feed them straight into pyodide.FS.
      matches.push(full);
    }
  });
  return matches.length ? matches : [token];
}

// ---- pwd / ls / cd ---------------------------------------------------------

function _unixPwd(id, args, cwd) {
  _gitReply(id, cwd + '\n', '', 0, []);
}

function _unixLs(id, args, cwd, dir) {
  var showAll = false, longFormat = false, oneCol = false, classify = false;
  var paths = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-a' || a === '--all')      { showAll = true; continue; }
    if (a === '-A' || a === '--almost-all') { showAll = true; continue; }
    if (a === '-l')                       { longFormat = true; continue; }
    if (a === '-1')                       { oneCol = true; continue; }
    if (a === '-F' || a === '--classify') { classify = true; continue; }
    if (a === '-la' || a === '-al')       { showAll = true; longFormat = true; continue; }
    if (a === '-h' || a === '--human-readable' || a === '-r' || a === '-t' ||
        a === '-S' || a === '-R' || a === '--color' || a === '--no-color' ||
        a.indexOf('--color=') === 0) {
      continue;  // accepted, no-op
    }
    if (a.charAt(0) === '-' && a.length > 1) { continue; }
    paths.push(a);
  }
  if (paths.length === 0) paths.push('.');

  var out = '';
  var multi = paths.length > 1;
  paths.forEach(function (p, idx) {
    var abs = _normalizePath(cwd, dir, p);
    var st;
    try { st = pyodide.FS.stat(abs); }
    catch (e) {
      out += "ls: cannot access '" + p + "': No such file or directory\n";
      return;
    }
    if (multi && idx > 0) out += '\n';
    if (multi) out += abs + ':\n';
    var isDir = (st.mode & 0o170000) === 0o040000;
    if (!isDir) {
      out += _formatLsEntry(p, st, longFormat, classify) + '\n';
      return;
    }
    var entries;
    try { entries = pyodide.FS.readdir(abs); } catch (e) { return; }
    entries = entries.filter(function (n) {
      if (n === '.' || n === '..') return false;
      if (!showAll && n.charAt(0) === '.') return false;
      return true;
    });
    entries.sort();
    if (longFormat) {
      entries.forEach(function (n) {
        var sub;
        try { sub = pyodide.FS.stat(abs + '/' + n); } catch (e) { return; }
        out += _formatLsEntry(n, sub, true, classify) + '\n';
      });
    } else if (oneCol) {
      entries.forEach(function (n) { out += n + (classify && _isDir(abs + '/' + n) ? '/' : '') + '\n'; });
    } else {
      // Simple multi-column tab layout.
      var line = entries.map(function (n) {
        return n + (classify && _isDir(abs + '/' + n) ? '/' : '');
      }).join('  ');
      out += line + (line ? '\n' : '');
    }
  });
  _gitReply(id, out, '', 0, []);
}

function _formatLsEntry(name, st, longFormat, classify) {
  var IFMT = 0o170000;
  var isDir = (st.mode & IFMT) === 0o040000;
  var isLink = (st.mode & IFMT) === 0o120000;
  var suffix = classify ? (isDir ? '/' : isLink ? '@' : '') : '';
  if (!longFormat) return name + suffix;
  var typeCh = isDir ? 'd' : isLink ? 'l' : '-';
  // Permission bits (best-effort).
  function rwx(bits) {
    return (bits & 4 ? 'r' : '-') + (bits & 2 ? 'w' : '-') + (bits & 1 ? 'x' : '-');
  }
  var perm = rwx((st.mode >> 6) & 7) + rwx((st.mode >> 3) & 7) + rwx(st.mode & 7);
  var size = String(st.size || 0);
  while (size.length < 6) size = ' ' + size;
  var mtime = st.mtime ? new Date(typeof st.mtime.getTime === 'function' ? st.mtime.getTime() : st.mtime) : new Date(0);
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var mtStr = monthNames[mtime.getMonth()] + ' ' +
              String(mtime.getDate()).padStart(2, ' ') + ' ' +
              String(mtime.getHours()).padStart(2, '0') + ':' +
              String(mtime.getMinutes()).padStart(2, '0');
  return typeCh + perm + ' 1 student student ' + size + ' ' + mtStr + ' ' + name + suffix;
}

// ---- cat / head / tail -----------------------------------------------------

function _unixCat(id, args, cwd, dir) {
  var numbered = false, showEnds = false;
  var files = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-n' || a === '--number')        { numbered = true; continue; }
    if (a === '-E' || a === '--show-ends')     { showEnds = true; continue; }
    if (a === '-A' || a === '--show-all')      { showEnds = true; numbered = false; continue; }
    if (a === '-b' || a === '--number-nonblank') { numbered = true; continue; }
    if (a === '-s' || a === '--squeeze-blank') { continue; }
    if (a === '-T' || a === '-v')              { continue; }
    if (a === '--')                            { continue; }
    if (a.charAt(0) === '-' && a !== '-')      { continue; }
    files.push(a);
  }
  if (files.length === 0) {
    return _gitReply(id, '', "cat: no input (this terminal doesn't read stdin)\n", 1, []);
  }
  var out = '', errOut = '', exit = 0;
  files.forEach(function (f) {
    var abs = _normalizePath(cwd, dir, f);
    var content;
    try { content = _readText(abs); }
    catch (e) {
      errOut += "cat: " + f + ": No such file or directory\n";
      exit = 1; return;
    }
    if (numbered || showEnds) {
      var lines = content.split('\n');
      var trailing = (lines.length && lines[lines.length - 1] === '');
      if (trailing) lines.pop();
      lines.forEach(function (l, idx) {
        var prefix = numbered ? String(idx + 1).padStart(6, ' ') + '\t' : '';
        var suffix = showEnds ? '$' : '';
        out += prefix + l + suffix + '\n';
      });
      if (trailing && content.endsWith('\n')) {
        // Honor the trailing newline but don't number an empty extra line.
      }
    } else {
      out += content;
      if (!content.endsWith('\n')) out += '\n';
    }
  });
  _gitReply(id, out, errOut, exit, []);
}

function _unixHead(id, args, cwd, dir) { return _headOrTail(id, args, cwd, dir, 'head'); }
function _unixTail(id, args, cwd, dir) { return _headOrTail(id, args, cwd, dir, 'tail'); }

function _headOrTail(id, args, cwd, dir, kind) {
  var n = 10, byBytes = false;
  var quiet = false, verbose = false;
  var files = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-n' || a === '--lines')   { n = parseInt(args[++i], 10) || 10; continue; }
    if (a.indexOf('--lines=') === 0)     { n = parseInt(a.substring('--lines='.length), 10) || 10; continue; }
    if (a === '-c' || a === '--bytes')   { byBytes = true; n = parseInt(args[++i], 10) || 10; continue; }
    if (a.indexOf('--bytes=') === 0)     { byBytes = true; n = parseInt(a.substring('--bytes='.length), 10) || 10; continue; }
    if (/^-\d+$/.test(a))                { n = parseInt(a.substring(1), 10); continue; }
    if (/^-n\d+$/.test(a))               { n = parseInt(a.substring(2), 10); continue; }
    if (a === '-q' || a === '--quiet' || a === '--silent') { quiet = true; continue; }
    if (a === '-v' || a === '--verbose') { verbose = true; continue; }
    if (a === '-f' || a === '--follow')  { continue; /* no streaming */ }
    if (a.charAt(0) === '-' && a !== '-') { continue; }
    files.push(a);
  }
  if (files.length === 0) {
    return _gitReply(id, '', kind + ": no input\n", 1, []);
  }
  var out = '', errOut = '', exit = 0;
  var multi = files.length > 1;
  files.forEach(function (f, idx) {
    var abs = _normalizePath(cwd, dir, f);
    var content;
    try { content = _readText(abs); }
    catch (e) {
      errOut += kind + ": cannot open '" + f + "' for reading\n"; exit = 1; return;
    }
    if ((multi && !quiet) || verbose) {
      if (idx > 0) out += '\n';
      out += '==> ' + f + ' <==\n';
    }
    if (byBytes) {
      out += kind === 'head' ? content.substring(0, n) : content.substring(Math.max(0, content.length - n));
    } else {
      var lines = content.split('\n');
      var hadTrailing = lines.length && lines[lines.length - 1] === '';
      if (hadTrailing) lines.pop();
      var slice = kind === 'head' ? lines.slice(0, n) : lines.slice(Math.max(0, lines.length - n));
      out += slice.join('\n') + (slice.length ? '\n' : '');
    }
  });
  _gitReply(id, out, errOut, exit, []);
}

// ---- echo ------------------------------------------------------------------

function _unixEcho(id, args) {
  var noNewline = false, interpret = false;
  var rest = args.slice();
  while (rest.length && rest[0].charAt(0) === '-') {
    var f = rest[0];
    if (f === '-n')      { noNewline = true; rest.shift(); continue; }
    if (f === '-e')      { interpret = true; rest.shift(); continue; }
    if (f === '-E')      { interpret = false; rest.shift(); continue; }
    if (/^-[neE]+$/.test(f)) {
      if (f.indexOf('n') !== -1) noNewline = true;
      if (f.indexOf('e') !== -1) interpret = true;
      if (f.indexOf('E') !== -1) interpret = false;
      rest.shift(); continue;
    }
    break;  // unrecognised — treat as text
  }
  var s = rest.join(' ');
  if (interpret) {
    s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');
  }
  _gitReply(id, s + (noNewline ? '' : '\n'), '', 0, []);
}

// ---- mkdir / rmdir / touch -------------------------------------------------

function _unixMkdir(id, args, cwd, dir) {
  var parents = false, verbose = false;
  var paths = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-p' || a === '--parents')  { parents = true; continue; }
    if (a === '-v' || a === '--verbose')  { verbose = true; continue; }
    if (a.indexOf('--mode=') === 0 || a === '-m' || a === '--mode') {
      if (a === '-m' || a === '--mode') i++;
      continue;
    }
    if (a.charAt(0) === '-' && a !== '-') continue;
    paths.push(a);
  }
  if (paths.length === 0) return _gitReply(id, '', "mkdir: missing operand\n", 1, []);

  var out = '', err = '', exit = 0, mutated = [];
  paths.forEach(function (p) {
    var abs = _normalizePath(cwd, dir, p);
    if (parents) {
      var parts = abs.split('/').filter(Boolean);
      var cur = '';
      parts.forEach(function (s) {
        cur += '/' + s;
        try { pyodide.FS.mkdir(cur); if (verbose) out += "mkdir: created '" + cur + "'\n"; }
        catch (e) { /* exists or parent missing */ }
      });
      mutated.push(_toRel(dir, abs) || abs);
    } else {
      try {
        pyodide.FS.mkdir(abs);
        if (verbose) out += "mkdir: created '" + abs + "'\n";
        mutated.push(_toRel(dir, abs) || abs);
      } catch (e) {
        if (e.errno === 20) err += "mkdir: cannot create directory '" + p + "': File exists\n";
        else err += "mkdir: cannot create directory '" + p + "': " + (e.message || 'errno=' + e.errno) + "\n";
        exit = 1;
      }
    }
  });
  _gitReply(id, out, err, exit, mutated);
}

function _unixRmdir(id, args, cwd, dir) {
  var parents = false;
  var paths = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-p' || a === '--parents') { parents = true; continue; }
    if (a === '--ignore-fail-on-non-empty' || a === '-v' || a === '--verbose') continue;
    if (a.charAt(0) === '-' && a !== '-') continue;
    paths.push(a);
  }
  if (paths.length === 0) return _gitReply(id, '', "rmdir: missing operand\n", 1, []);
  var err = '', exit = 0, mutated = [];
  paths.forEach(function (p) {
    var abs = _normalizePath(cwd, dir, p);
    try { pyodide.FS.rmdir(abs); mutated.push(_toRel(dir, abs) || abs); }
    catch (e) {
      err += "rmdir: failed to remove '" + p + "': " +
        (e.errno === 55 ? 'Directory not empty' :
         e.errno === 44 ? 'No such file or directory' :
         (e.message || 'errno=' + e.errno)) + "\n";
      exit = 1;
    }
    if (parents) {
      // Walk up and remove empty parents.
      var parent = abs.substring(0, abs.lastIndexOf('/'));
      while (parent && parent !== dir && parent !== '/') {
        try { pyodide.FS.rmdir(parent); mutated.push(_toRel(dir, parent) || parent); }
        catch (e) { break; }
        parent = parent.substring(0, parent.lastIndexOf('/'));
      }
    }
  });
  _gitReply(id, '', err, exit, mutated);
}

function _unixTouch(id, args, cwd, dir) {
  var noCreate = false;
  var paths = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-c' || a === '--no-create') { noCreate = true; continue; }
    if (a === '-a' || a === '-m' || a === '-r' ||
        a === '--time' || a.indexOf('--time=') === 0 ||
        a === '-d' || a.indexOf('--date=') === 0 ||
        a === '-t' || a === '--reference' || a.indexOf('--reference=') === 0) {
      if (a === '-r' || a === '-d' || a === '-t' || a === '--reference' || a === '--time' || a === '--date') i++;
      continue;
    }
    if (a.charAt(0) === '-' && a !== '-') continue;
    paths.push(a);
  }
  if (paths.length === 0) return _gitReply(id, '', "touch: missing file operand\n", 1, []);
  var err = '', exit = 0, mutated = [];
  paths.forEach(function (p) {
    var abs = _normalizePath(cwd, dir, p);
    if (_exists(abs)) {
      // No mtime API on Pyodide.FS — touch is a no-op for existing files.
      return;
    }
    if (noCreate) return;
    try { _writeText(abs, ''); mutated.push(_toRel(dir, abs) || abs); }
    catch (e) {
      err += "touch: cannot touch '" + p + "': " + (e.message || 'errno=' + e.errno) + "\n";
      exit = 1;
    }
  });
  _gitReply(id, '', err, exit, mutated);
}

// ---- rm / cp / mv ----------------------------------------------------------

function _unixRm(id, args, cwd, dir) {
  var recursive = false, force = false, verbose = false;
  var paths = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-r' || a === '-R' || a === '--recursive') { recursive = true; continue; }
    if (a === '-rf' || a === '-fr' || a === '-Rf' || a === '-fR') { recursive = true; force = true; continue; }
    if (a === '-f' || a === '--force')                   { force = true; continue; }
    if (a === '-v' || a === '--verbose')                 { verbose = true; continue; }
    if (a === '-i' || a === '-I' || a === '--interactive' || a.indexOf('--interactive=') === 0) {
      // Tutorial sandbox: never prompt; treat as non-interactive.
      continue;
    }
    if (a === '-d' || a === '--dir' || a === '--preserve-root' || a === '--no-preserve-root' || a === '--one-file-system') continue;
    if (a === '--')                                      { continue; }
    if (a.charAt(0) === '-' && a !== '-')                { continue; }
    paths.push(a);
  }
  if (paths.length === 0 && !force) return _gitReply(id, '', "rm: missing operand\n", 1, []);

  var out = '', err = '', exit = 0, mutated = [];
  paths.forEach(function (p) {
    var abs = _normalizePath(cwd, dir, p);
    if (!_exists(abs)) {
      if (!force) { err += "rm: cannot remove '" + p + "': No such file or directory\n"; exit = 1; }
      return;
    }
    if (_isDir(abs)) {
      if (!recursive) {
        err += "rm: cannot remove '" + p + "': Is a directory\n"; exit = 1; return;
      }
      // Walk depth-first, unlink files, then rmdir directories.
      var entries = _walkFs(abs, true);
      entries.sort(function (a, b) { return b.abs.length - a.abs.length; });
      entries.forEach(function (e) {
        try {
          if (e.isDir) pyodide.FS.rmdir(e.abs);
          else pyodide.FS.unlink(e.abs);
          if (verbose) out += "removed '" + e.abs + "'\n";
          var rel = _toRel(dir, e.abs); if (rel) mutated.push(rel);
        } catch (er) { /* tolerate */ }
      });
      try { pyodide.FS.rmdir(abs); if (verbose) out += "removed directory '" + abs + "'\n"; } catch (er) {}
      var topRel = _toRel(dir, abs); if (topRel) mutated.push(topRel);
    } else {
      try {
        pyodide.FS.unlink(abs);
        if (verbose) out += "removed '" + p + "'\n";
        var rel = _toRel(dir, abs); if (rel) mutated.push(rel);
      } catch (e) {
        err += "rm: cannot remove '" + p + "': " + (e.message || 'errno=' + e.errno) + "\n";
        exit = 1;
      }
    }
  });
  _gitReply(id, out, err, exit, mutated);
}

function _unixCp(id, args, cwd, dir) {
  var recursive = false, force = false, verbose = false;
  var paths = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-r' || a === '-R' || a === '--recursive') { recursive = true; continue; }
    if (a === '-f' || a === '--force')                   { force = true; continue; }
    if (a === '-v' || a === '--verbose')                 { verbose = true; continue; }
    if (a === '-a' || a === '--archive')                 { recursive = true; continue; }
    if (a === '-i' || a === '-n' || a === '--no-clobber' || a === '-l' || a === '-s' ||
        a === '-p' || a === '--preserve' || a.indexOf('--preserve=') === 0 ||
        a === '-u' || a === '--update' || a === '-T' || a === '-t' || a === '--target-directory' ||
        a === '--no-target-directory') {
      if (a === '-t' || a === '--target-directory') i++;
      continue;
    }
    if (a === '--')                                      { continue; }
    if (a.charAt(0) === '-' && a !== '-')                { continue; }
    paths.push(a);
  }
  if (paths.length < 2) return _gitReply(id, '', "cp: missing destination\n", 1, []);

  var dst = paths.pop();
  var srcs = paths;
  var dstAbs = _normalizePath(cwd, dir, dst);
  var dstIsDir = _isDir(dstAbs);
  var out = '', err = '', exit = 0, mutated = [];

  srcs.forEach(function (src) {
    var srcAbs = _normalizePath(cwd, dir, src);
    if (!_exists(srcAbs)) {
      err += "cp: cannot stat '" + src + "': No such file or directory\n"; exit = 1; return;
    }
    var target = dstIsDir ? dstAbs + '/' + srcAbs.substring(srcAbs.lastIndexOf('/') + 1) : dstAbs;
    if (_isDir(srcAbs)) {
      if (!recursive) { err += "cp: -r not specified; omitting directory '" + src + "'\n"; exit = 1; return; }
      // Recursive copy.
      try { pyodide.FS.mkdir(target); } catch (e) { /* exists */ }
      var entries = _walkFs(srcAbs, true);
      entries.forEach(function (e) {
        var rel = e.abs.substring(srcAbs.length);
        var to = target + rel;
        try {
          if (e.isDir) {
            try { pyodide.FS.mkdir(to); } catch (er) {}
          } else {
            var bytes = pyodide.FS.readFile(e.abs);
            _writeText(to, '');  // ensure parents
            pyodide.FS.writeFile(to, bytes);
          }
          if (verbose) out += "'" + e.abs + "' -> '" + to + "'\n";
          var r = _toRel(dir, to); if (r) mutated.push(r);
        } catch (er) {
          err += "cp: cannot copy '" + e.abs + "': " + (er.message || 'errno=' + er.errno) + "\n";
          exit = 1;
        }
      });
    } else {
      try {
        var data = pyodide.FS.readFile(srcAbs);
        _writeText(target, '');
        pyodide.FS.writeFile(target, data);
        if (verbose) out += "'" + src + "' -> '" + target + "'\n";
        var r = _toRel(dir, target); if (r) mutated.push(r);
      } catch (e) {
        err += "cp: cannot copy '" + src + "': " + (e.message || 'errno=' + e.errno) + "\n";
        exit = 1;
      }
    }
  });
  _gitReply(id, out, err, exit, mutated);
}

function _unixMv(id, args, cwd, dir) {
  var force = false, verbose = false;
  var paths = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-f' || a === '--force')   { force = true; continue; }
    if (a === '-v' || a === '--verbose') { verbose = true; continue; }
    if (a === '-i' || a === '-n' || a === '--no-clobber' || a === '-T' ||
        a === '-t' || a === '--target-directory' || a === '--strip-trailing-slashes' ||
        a === '-u' || a === '--update' || a === '--no-target-directory') {
      if (a === '-t' || a === '--target-directory') i++;
      continue;
    }
    if (a === '--') continue;
    if (a.charAt(0) === '-' && a !== '-') continue;
    paths.push(a);
  }
  if (paths.length < 2) return _gitReply(id, '', "mv: missing destination\n", 1, []);

  var dst = paths.pop();
  var srcs = paths;
  var dstAbs = _normalizePath(cwd, dir, dst);
  var dstIsDir = _isDir(dstAbs);
  var out = '', err = '', exit = 0, mutated = [];

  srcs.forEach(function (src) {
    var srcAbs = _normalizePath(cwd, dir, src);
    if (!_exists(srcAbs)) {
      err += "mv: cannot stat '" + src + "': No such file or directory\n"; exit = 1; return;
    }
    var target = dstIsDir ? dstAbs + '/' + srcAbs.substring(srcAbs.lastIndexOf('/') + 1) : dstAbs;
    try {
      if (_isDir(srcAbs)) {
        // Recursive copy + remove (Pyodide.FS lacks atomic rename across dirs).
        try { pyodide.FS.mkdir(target); } catch (e) {}
        var entries = _walkFs(srcAbs, true);
        entries.forEach(function (e) {
          var rel = e.abs.substring(srcAbs.length);
          var to = target + rel;
          if (e.isDir) { try { pyodide.FS.mkdir(to); } catch (er) {} }
          else {
            var bytes = pyodide.FS.readFile(e.abs);
            _writeText(to, ''); pyodide.FS.writeFile(to, bytes);
          }
        });
        // Remove source tree.
        entries.sort(function (a, b) { return b.abs.length - a.abs.length; });
        entries.forEach(function (e) {
          try { e.isDir ? pyodide.FS.rmdir(e.abs) : pyodide.FS.unlink(e.abs); } catch (er) {}
        });
        try { pyodide.FS.rmdir(srcAbs); } catch (er) {}
      } else {
        var data = pyodide.FS.readFile(srcAbs);
        _writeText(target, ''); pyodide.FS.writeFile(target, data);
        pyodide.FS.unlink(srcAbs);
      }
      if (verbose) out += "renamed '" + src + "' -> '" + target + "'\n";
      var rs = _toRel(dir, srcAbs); if (rs) mutated.push(rs);
      var rt = _toRel(dir, target); if (rt) mutated.push(rt);
    } catch (e) {
      err += "mv: cannot move '" + src + "': " + (e.message || 'errno=' + e.errno) + "\n";
      exit = 1;
    }
  });
  _gitReply(id, out, err, exit, mutated);
}

// ---- wc / grep / find / which ---------------------------------------------

function _unixWc(id, args, cwd, dir) {
  var lines = false, words = false, chars = false, bytes = false, longest = false;
  var files = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-l' || a === '--lines') { lines = true; continue; }
    if (a === '-w' || a === '--words') { words = true; continue; }
    if (a === '-m' || a === '--chars') { chars = true; continue; }
    if (a === '-c' || a === '--bytes') { bytes = true; continue; }
    if (a === '-L' || a === '--max-line-length') { longest = true; continue; }
    if (a.charAt(0) === '-' && a !== '-') continue;
    files.push(a);
  }
  if (!lines && !words && !chars && !bytes && !longest) {
    lines = words = bytes = true;  // default: all three
  }
  if (files.length === 0) return _gitReply(id, '', "wc: missing input\n", 1, []);

  var out = '', err = '', exit = 0;
  var totals = { l: 0, w: 0, c: 0, b: 0, L: 0 };
  files.forEach(function (f) {
    var abs = _normalizePath(cwd, dir, f);
    var content;
    try { content = _readText(abs); }
    catch (e) { err += "wc: " + f + ": No such file or directory\n"; exit = 1; return; }
    var counts = {
      l: (content.match(/\n/g) || []).length + (content.length > 0 && !content.endsWith('\n') ? 1 : 0),
      w: (content.match(/\S+/g) || []).length,
      c: content.length,
      b: content.length,  // tutorial-only: assume 1 byte per char
      L: content.split('\n').reduce(function (mx, l) { return Math.max(mx, l.length); }, 0),
    };
    totals.l += counts.l; totals.w += counts.w; totals.c += counts.c;
    totals.b += counts.b; totals.L = Math.max(totals.L, counts.L);
    out += _wcLine(counts, lines, words, chars, bytes, longest, f);
  });
  if (files.length > 1) out += _wcLine(totals, lines, words, chars, bytes, longest, 'total');
  _gitReply(id, out, err, exit, []);
}

function _wcLine(c, l, w, ch, b, L, name) {
  var parts = [];
  if (l)  parts.push(String(c.l).padStart(7, ' '));
  if (w)  parts.push(String(c.w).padStart(7, ' '));
  if (ch) parts.push(String(c.c).padStart(7, ' '));
  if (b && !ch) parts.push(String(c.b).padStart(7, ' '));
  if (L)  parts.push(String(c.L).padStart(7, ' '));
  return parts.join(' ') + ' ' + name + '\n';
}

function _unixGrep(id, args, cwd, dir) {
  var ignoreCase = false, invert = false, lineNumbers = false;
  var recursive = false, listOnly = false, countOnly = false, quiet = false;
  var fixed = false, wholeWord = false, wholeLine = false;
  var pattern = null;
  var paths = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-i' || a === '--ignore-case')    { ignoreCase = true; continue; }
    if (a === '-v' || a === '--invert-match')   { invert = true; continue; }
    if (a === '-n' || a === '--line-number')    { lineNumbers = true; continue; }
    if (a === '-r' || a === '-R' || a === '--recursive') { recursive = true; continue; }
    if (a === '-l' || a === '--files-with-matches') { listOnly = true; continue; }
    if (a === '-c' || a === '--count')          { countOnly = true; continue; }
    if (a === '-q' || a === '--quiet' || a === '--silent') { quiet = true; continue; }
    if (a === '-F' || a === '--fixed-strings')  { fixed = true; continue; }
    if (a === '-w' || a === '--word-regexp')    { wholeWord = true; continue; }
    if (a === '-x' || a === '--line-regexp')    { wholeLine = true; continue; }
    if (a === '-E' || a === '--extended-regexp') { continue; }
    if (a === '-G' || a === '--basic-regexp')   { continue; }
    if (a === '-P' || a === '--perl-regexp')    { continue; }
    if (a === '-H' || a === '--with-filename' || a === '-h' || a === '--no-filename' ||
        a === '-s' || a === '--no-messages' ||
        a === '--color' || a === '--no-color' || a.indexOf('--color=') === 0 ||
        a === '-o' || a === '--only-matching' || a === '-a' || a === '--text') {
      continue;
    }
    if (a === '-A' || a === '-B' || a === '-C') { i++; continue; }
    if (/^-[A-CB]\d+$/.test(a)) { continue; }
    if (a === '-e' || a === '--regexp')         { pattern = args[++i]; continue; }
    if (a === '-f' || a === '--file')           { i++; continue; }
    if (a === '--')                             { continue; }
    if (a.charAt(0) === '-' && a !== '-')       { continue; }
    if (pattern === null) { pattern = a; continue; }
    paths.push(a);
  }
  if (pattern === null) return _gitReply(id, '', "grep: missing pattern\n", 1, []);

  // Build the regex from the pattern + flags.
  var rxBody = fixed ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : pattern;
  if (wholeWord) rxBody = '\\b(?:' + rxBody + ')\\b';
  if (wholeLine) rxBody = '^(?:' + rxBody + ')$';
  var rx;
  try { rx = new RegExp(rxBody, ignoreCase ? 'i' : ''); }
  catch (e) { return _gitReply(id, '', "grep: invalid pattern: " + e.message + "\n", 1, []); }

  // Resolve the file list.
  var files = [];
  paths.forEach(function (p) {
    var abs = _normalizePath(cwd, dir, p);
    if (_isDir(abs)) {
      if (!recursive) {
        // Real grep errors with "Is a directory"; we mirror that.
        files.push({ abs: abs, isDir: true });
      } else {
        _walkFs(abs, false).forEach(function (e) { files.push({ abs: e.abs, isDir: false }); });
      }
    } else {
      files.push({ abs: abs, isDir: false });
    }
  });
  if (files.length === 0) return _gitReply(id, '', "grep: no files\n", 1, []);

  var out = '', err = '', exit = 1;  // grep uses 1 = no match
  var multiFile = files.length > 1 || recursive;

  files.forEach(function (e) {
    if (e.isDir) {
      err += "grep: " + e.abs + ": Is a directory\n"; exit = 2; return;
    }
    var content;
    try { content = _readText(e.abs); }
    catch (er) { err += "grep: " + e.abs + ": " + (er.message || 'unreadable') + "\n"; exit = 2; return; }
    var lines = content.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    var matchCount = 0;
    var fileLines = [];
    lines.forEach(function (ln, idx) {
      var hit = rx.test(ln);
      if (invert) hit = !hit;
      if (!hit) return;
      matchCount++;
      if (listOnly || countOnly || quiet) return;
      var prefix = '';
      if (multiFile) prefix = e.abs + ':';
      if (lineNumbers) prefix += (idx + 1) + ':';
      fileLines.push(prefix + ln + '\n');
    });
    if (matchCount > 0) exit = 0;
    if (quiet) return;
    if (listOnly && matchCount > 0) { out += e.abs + '\n'; return; }
    if (countOnly) {
      out += (multiFile ? e.abs + ':' : '') + matchCount + '\n';
      return;
    }
    out += fileLines.join('');
  });
  _gitReply(id, out, err, exit, []);
}

function _unixFind(id, args, cwd, dir) {
  var roots = [];
  var nameRx = null, typeFilter = null, maxDepth = Infinity, minDepth = 0;
  var printAction = true;
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-name')                  { nameRx = _globToRegex(args[++i] || '', false); continue; }
    if (a === '-iname')                 { nameRx = _globToRegex(args[++i] || '', true); continue; }
    if (a === '-type')                  { typeFilter = args[++i]; continue; }
    if (a === '-maxdepth')              { maxDepth = parseInt(args[++i], 10); continue; }
    if (a === '-mindepth')              { minDepth = parseInt(args[++i], 10); continue; }
    if (a === '-print')                 { printAction = true; continue; }
    if (a === '-print0')                { printAction = true; continue; }
    if (a === '-not' || a === '!')      { i++; continue; }   // skip negated predicate
    if (a === '-a' || a === '-and' || a === '-o' || a === '-or') continue;
    if (a === '-empty' || a === '-readable' || a === '-writable' || a === '-executable') continue;
    if (a === '-newer' || a === '-mtime' || a === '-ctime' || a === '-size' ||
        a === '-user' || a === '-group' || a === '-perm' || a === '-prune' ||
        a === '-regex' || a === '-iregex' || a === '-path' || a === '-ipath' ||
        a === '-exec' || a === '-execdir' || a === '-delete' || a === '-printf' || a === '-fprint') {
      // Skip the predicate and (when applicable) its argument.
      if (a !== '-prune' && a !== '-empty' && a !== '-delete') i++;
      continue;
    }
    if (a.charAt(0) === '-')            { continue; }
    roots.push(a);
  }
  if (roots.length === 0) roots.push('.');

  var out = '';
  roots.forEach(function (root) {
    var rootAbs = _normalizePath(cwd, dir, root);
    if (!_exists(rootAbs)) {
      out += "find: '" + root + "': No such file or directory\n"; return;
    }
    function walk(abs, depth, displayPath) {
      var st;
      try { st = pyodide.FS.stat(abs); } catch (e) { return; }
      var isDir = (st.mode & 0o170000) === 0o040000;
      var name = abs.substring(abs.lastIndexOf('/') + 1);
      var matches = (depth >= minDepth) &&
        (!nameRx || nameRx.test(name)) &&
        (!typeFilter || (typeFilter === 'f' && !isDir) || (typeFilter === 'd' && isDir));
      if (matches && printAction) out += displayPath + '\n';
      if (isDir && depth < maxDepth) {
        var entries; try { entries = pyodide.FS.readdir(abs); } catch (e) { return; }
        entries.forEach(function (n) {
          if (n === '.' || n === '..') return;
          if (n === '.git' && depth === 0) return;
          walk((abs === '/' ? '' : abs) + '/' + n, depth + 1,
               displayPath === '.' ? './' + n : displayPath + '/' + n);
        });
      }
    }
    walk(rootAbs, 0, root);
  });
  _gitReply(id, out, '', 0, []);
}

function _globToRegex(glob, ignoreCase) {
  var rxStr = '^' + glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.') + '$';
  return new RegExp(rxStr, ignoreCase ? 'i' : '');
}

function _unixWhich(id, args) {
  var paths = args.filter(function (a) { return a.charAt(0) !== '-'; });
  if (paths.length === 0) return _gitReply(id, '', "which: missing argument\n", 1, []);
  var out = '', exit = 0;
  paths.forEach(function (cmd) {
    if (cmd === 'git' || _UNIX_HANDLERS[cmd]) {
      out += '/usr/bin/' + cmd + '\n';
    } else {
      exit = 1;
    }
  });
  _gitReply(id, out, '', exit, []);
}

// ---- env / true / false / : / sleep / printf ------------------------------

function _unixTrue(id) { _gitReply(id, '', '', 0, []); }
function _unixFalse(id) { _gitReply(id, '', '', 1, []); }
function _unixNoop(id) { _gitReply(id, '', '', 0, []); }

function _unixEnv(id, args) {
  // Without args: list the (very small) tutorial environment.
  if (args.length === 0) {
    var out = 'HOME=/tutorial\nPWD=' + (_gitDir || '/tutorial') + '\nSHELL=/bin/sh\nUSER=student\n';
    return _gitReply(id, out, '', 0, []);
  }
  // With args: ignore env-var assignments, run nothing — we don't have a
  // sub-process model. Output a clear note instead of silently dropping.
  _gitReply(id, '', "env: subprocess invocation isn't supported in this terminal.\n", 1, []);
}

function _unixPrintf(id, args) {
  if (args.length === 0) return _gitReply(id, '', "printf: missing format\n", 1, []);
  var fmt = args[0];
  var values = args.slice(1);
  // Tiny printf: handles %s, %d, %x, %%, and the common escapes \n \t \\.
  fmt = fmt.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
  var idx = 0;
  var out = fmt.replace(/%[sdxX%]/g, function (spec) {
    if (spec === '%%') return '%';
    var v = values[idx++];
    if (v === undefined) v = '';
    if (spec === '%d') return String(parseInt(v, 10) || 0);
    if (spec === '%x') return (parseInt(v, 10) || 0).toString(16);
    if (spec === '%X') return (parseInt(v, 10) || 0).toString(16).toUpperCase();
    return String(v);
  });
  _gitReply(id, out, '', 0, []);
}

function _unixDate(id, args) {
  var now = new Date();
  // Real date supports +<format>; we honor the most common bits.
  var fmtArg = args.find(function (a) { return a.charAt(0) === '+'; });
  if (!fmtArg) {
    return _gitReply(id, now.toString() + '\n', '', 0, []);
  }
  var fmt = fmtArg.substring(1);
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var out = fmt
    .replace(/%Y/g, String(now.getFullYear()))
    .replace(/%m/g, pad(now.getMonth() + 1))
    .replace(/%d/g, pad(now.getDate()))
    .replace(/%H/g, pad(now.getHours()))
    .replace(/%M/g, pad(now.getMinutes()))
    .replace(/%S/g, pad(now.getSeconds()))
    .replace(/%s/g, String(Math.floor(now.getTime() / 1000)))
    .replace(/%n/g, '\n')
    .replace(/%t/g, '\t')
    .replace(/%%/g, '%');
  _gitReply(id, out + '\n', '', 0, []);
}

function _unixBasename(id, args) {
  var p = args.find(function (a) { return a.charAt(0) !== '-'; });
  if (!p) return _gitReply(id, '', "basename: missing operand\n", 1, []);
  var suffix = args[args.indexOf(p) + 1] || '';
  var base = p.replace(/\/+$/, '');
  base = base.substring(base.lastIndexOf('/') + 1);
  if (suffix && base.endsWith(suffix) && base !== suffix) base = base.substring(0, base.length - suffix.length);
  _gitReply(id, base + '\n', '', 0, []);
}

function _unixDirname(id, args) {
  var p = args.find(function (a) { return a.charAt(0) !== '-'; });
  if (!p) return _gitReply(id, '', "dirname: missing operand\n", 1, []);
  var stripped = p.replace(/\/+$/, '');
  var idx = stripped.lastIndexOf('/');
  _gitReply(id, (idx <= 0 ? (idx === 0 ? '/' : '.') : stripped.substring(0, idx)) + '\n', '', 0, []);
}

function _unixRealpath(id, args, cwd, dir) {
  var p = args.find(function (a) { return a.charAt(0) !== '-'; });
  if (!p) return _gitReply(id, '', "realpath: missing operand\n", 1, []);
  var abs = _normalizePath(cwd, dir, p);
  _gitReply(id, abs + '\n', '', 0, []);
}

function _unixSort(id, args, cwd, dir) {
  var reverse = false, unique = false, numeric = false;
  var files = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-r' || a === '--reverse') { reverse = true; continue; }
    if (a === '-u' || a === '--unique')  { unique = true; continue; }
    if (a === '-n' || a === '--numeric-sort') { numeric = true; continue; }
    if (a === '-f' || a === '--ignore-case' || a === '-b' || a === '--ignore-leading-blanks' ||
        a === '-h' || a === '--human-numeric-sort' || a === '-V' || a === '--version-sort' ||
        a === '-c' || a === '--check' || a === '-s' || a === '--stable' ||
        a === '-d' || a === '--dictionary-order') continue;
    if (a === '-k' || a === '--key' || a === '-t' || a === '--field-separator' ||
        a === '-o' || a === '--output') { i++; continue; }
    if (a.charAt(0) === '-' && a !== '-') continue;
    files.push(a);
  }
  if (files.length === 0) return _gitReply(id, '', "sort: missing input\n", 1, []);
  var lines = [], err = '', exit = 0;
  files.forEach(function (f) {
    var abs = _normalizePath(cwd, dir, f);
    try {
      var content = _readText(abs);
      var ls = content.split('\n');
      if (ls.length && ls[ls.length - 1] === '') ls.pop();
      lines = lines.concat(ls);
    } catch (e) { err += "sort: " + f + ": No such file or directory\n"; exit = 1; }
  });
  lines.sort(numeric
    ? function (a, b) { return parseFloat(a) - parseFloat(b); }
    : undefined);
  if (reverse) lines.reverse();
  if (unique) {
    var seen = {}, dedup = [];
    lines.forEach(function (l) { if (!seen[l]) { seen[l] = true; dedup.push(l); } });
    lines = dedup;
  }
  _gitReply(id, lines.join('\n') + (lines.length ? '\n' : ''), err, exit, []);
}

function _unixUniq(id, args, cwd, dir) {
  var count = false, repeated = false, unique = false;
  var files = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-c' || a === '--count')       { count = true; continue; }
    if (a === '-d' || a === '--repeated')    { repeated = true; continue; }
    if (a === '-u' || a === '--unique')      { unique = true; continue; }
    if (a === '-i' || a === '--ignore-case' || a === '-s' || a === '-w' || a === '-f') {
      if (a === '-s' || a === '-w' || a === '-f') i++;
      continue;
    }
    if (a.charAt(0) === '-' && a !== '-') continue;
    files.push(a);
  }
  if (files.length === 0) return _gitReply(id, '', "uniq: missing input\n", 1, []);
  var content = '';
  try { content = _readText(_normalizePath(cwd, dir, files[0])); }
  catch (e) { return _gitReply(id, '', "uniq: " + files[0] + ": No such file or directory\n", 1, []); }
  var lines = content.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  var grouped = [];
  lines.forEach(function (l) {
    if (grouped.length && grouped[grouped.length - 1].line === l) {
      grouped[grouped.length - 1].count++;
    } else {
      grouped.push({ line: l, count: 1 });
    }
  });
  var out = grouped.filter(function (g) {
    if (repeated && g.count < 2) return false;
    if (unique && g.count > 1) return false;
    return true;
  }).map(function (g) {
    return (count ? String(g.count).padStart(7, ' ') + ' ' : '') + g.line;
  }).join('\n');
  _gitReply(id, out + (out ? '\n' : ''), '', 0, []);
}

function _unixDiff(id, args, cwd, dir) {
  // Simple two-file diff. Mostly used by students checking expected vs actual.
  var brief = false, ignoreAll = false;
  var files = [];
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '-q' || a === '--brief')          { brief = true; continue; }
    if (a === '-w' || a === '--ignore-all-space') { ignoreAll = true; continue; }
    if (a === '-u' || a === '-U' || a.indexOf('-U') === 0 ||
        a === '--unified' || a === '-c' || a === '-N' || a === '-r' || a === '--recursive' ||
        a === '-i' || a === '--ignore-case' || a === '-b' ||
        a === '--ignore-blank-lines' || a === '--color' || a === '--no-color' ||
        a.indexOf('--color=') === 0) {
      continue;
    }
    if (a.charAt(0) === '-' && a !== '-') continue;
    files.push(a);
  }
  if (files.length < 2) return _gitReply(id, '', "diff: needs two files\n", 1, []);
  var ca, cb;
  try { ca = _readText(_normalizePath(cwd, dir, files[0])); }
  catch (e) { return _gitReply(id, '', "diff: " + files[0] + ": No such file or directory\n", 2, []); }
  try { cb = _readText(_normalizePath(cwd, dir, files[1])); }
  catch (e) { return _gitReply(id, '', "diff: " + files[1] + ": No such file or directory\n", 2, []); }
  if (ignoreAll) { ca = ca.replace(/\s+/g, ' '); cb = cb.replace(/\s+/g, ' '); }
  if (ca === cb) return _gitReply(id, '', '', 0, []);
  if (brief) return _gitReply(id, "Files " + files[0] + " and " + files[1] + " differ\n", '', 1, []);
  // Reuse the git unified-diff formatter.
  var GREEN = '\x1b[32m', RED = '\x1b[31m', CYAN = '\x1b[36m', RESET = '\x1b[m';
  var out = '--- ' + files[0] + '\n+++ ' + files[1] + '\n' +
            _formatHunks(ca, cb, GREEN, RED, CYAN, RESET);
  _gitReply(id, out, '', 1, []);
}

// ---- dispatch table --------------------------------------------------------

var _UNIX_HANDLERS = {
  'pwd':       _unixPwd,
  'ls':        _unixLs,
  'cat':       _unixCat,
  'echo':      _unixEcho,
  'mkdir':     _unixMkdir,
  'rmdir':     _unixRmdir,
  'touch':     _unixTouch,
  'rm':        _unixRm,
  'cp':        _unixCp,
  'mv':        _unixMv,
  'head':      _unixHead,
  'tail':      _unixTail,
  'wc':        _unixWc,
  'grep':      _unixGrep,
  'find':      _unixFind,
  'which':     _unixWhich,
  'true':      _unixTrue,
  'false':     _unixFalse,
  ':':         _unixNoop,
  'env':       _unixEnv,
  'printf':    _unixPrintf,
  'date':      _unixDate,
  'basename':  _unixBasename,
  'dirname':   _unixDirname,
  'realpath':  _unixRealpath,
  'sort':      _unixSort,
  'uniq':      _unixUniq,
  'diff':      _unixDiff,
};
