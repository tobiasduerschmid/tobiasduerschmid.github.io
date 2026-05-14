/**
 * Forward-only debugger channel for v86 Makefile tutorials.
 *
 * The v86 backend cannot rewind filesystem state cheaply, so this channel does
 * not implement time travel. It builds a deterministic dry-run trace with
 * `make --debug=b -n`, maps planned recipe commands back to Makefile source
 * lines, and feeds those source-line pauses through the existing debugger UI.
 */
(function () {
  'use strict';

  var CMD_CONTINUE = 1, CMD_STEP = 2, CMD_NEXT = 3, CMD_RETURN = 4, CMD_STOP = 5;
  var CMD_SYNC = 6;

  function normalizeTutorialPath(path) {
    path = String(path || '').trim();
    if (!path) return '';
    path = path.replace(/\\/g, '/');
    if (path.indexOf('/tutorial/') === 0) return path.replace(/\/+/g, '/');
    if (path.indexOf('tutorial/') === 0) return ('/' + path).replace(/\/+/g, '/');
    if (path.charAt(0) === '/') return ('/tutorial' + path).replace(/\/+/g, '/');
    return ('/tutorial/' + path).replace(/\/+/g, '/');
  }

  function stripTutorialPrefix(path) {
    return String(path || '').replace(/^\/tutorial\//, '');
  }

  function dirname(path) {
    path = String(path || '');
    var idx = path.lastIndexOf('/');
    return idx > 0 ? path.slice(0, idx) : '/';
  }

  function shellQuote(value) {
    return "'" + String(value == null ? '' : value).replace(/'/g, "'\"'\"'") + "'";
  }

  function splitWords(value) {
    value = String(value || '').trim();
    return value ? value.split(/\s+/).filter(Boolean) : [];
  }

  function stripInlineComment(line) {
    var out = '';
    var escaped = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (ch === '#' && !escaped) break;
      out += ch;
      escaped = ch === '\\' && !escaped;
      if (ch !== '\\') escaped = false;
    }
    return out;
  }

  function assignmentMatch(line) {
    return String(line || '').match(/^\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*(?::=|\?=|\+=|=)\s*(.*)$/);
  }

  function expandVariables(value, vars) {
    value = String(value || '');
    vars = vars || {};
    for (var pass = 0; pass < 8; pass++) {
      var changed = false;
      value = value.replace(/\$\(([^)]+)\)|\$\{([^}]+)\}/g, function (m, a, b) {
        var name = String(a || b || '').trim();
        if (!Object.prototype.hasOwnProperty.call(vars, name)) return m;
        changed = true;
        return vars[name];
      });
      if (!changed) break;
    }
    return value;
  }

  function parseMakefile(source) {
    var lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
    var vars = Object.create(null);
    var rules = [];
    var currentRule = null;
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var lineNo = i + 1;
      if (/^\t/.test(raw)) {
        if (currentRule) {
          currentRule.recipeLines.push({
            line: lineNo,
            text: raw.replace(/^\t/, ''),
          });
        }
        continue;
      }
      var clean = stripInlineComment(raw);
      if (!clean.trim()) {
        currentRule = null;
        continue;
      }
      var assign = assignmentMatch(clean);
      if (assign) {
        var name = assign[1];
        var op = clean.match(/^\s*[A-Za-z_][A-Za-z0-9_.-]*\s*(:=|\?=|\+=|=)/);
        var rhs = expandVariables(assign[2].trim(), vars);
        if (op && op[1] === '+=') vars[name] = (vars[name] ? vars[name] + ' ' : '') + rhs;
        else if (op && op[1] === '?=' && Object.prototype.hasOwnProperty.call(vars, name)) {}
        else vars[name] = rhs;
        currentRule = null;
        continue;
      }
      if (/^\s/.test(raw)) {
        currentRule = null;
        continue;
      }
      var colon = clean.indexOf(':');
      if (colon < 0) {
        currentRule = null;
        continue;
      }
      var left = expandVariables(clean.slice(0, colon).trim(), vars);
      var right = expandVariables(clean.slice(colon + 1).trim(), vars);
      if (!left) {
        currentRule = null;
        continue;
      }
      var pipe = right.indexOf('|');
      var prereqText = pipe >= 0 ? right.slice(0, pipe).trim() : right;
      var rule = {
        id: rules.length + 1,
        line: lineNo,
        targets: splitWords(left),
        prereqs: splitWords(prereqText),
        recipeLines: [],
        raw: raw,
      };
      rules.push(rule);
      currentRule = rule;
    }
    return { variables: vars, rules: rules };
  }

  function isMakeDebugNoise(line) {
    var text = String(line || '').trim();
    if (!text) return true;
    return /^GNU Make\b/.test(text) ||
      /^Built for /.test(text) ||
      /^Copyright /.test(text) ||
      /^License /.test(text) ||
      /^This is free software/.test(text) ||
      /^Reading makefiles/.test(text) ||
      /^Updating makefiles/.test(text) ||
      /^Updating goal targets/.test(text) ||
      /^Considering target file /.test(text) ||
      /^Finished prerequisites of target file /.test(text) ||
      /^Prerequisite /.test(text) ||
      /^No need to remake target /.test(text) ||
      /^Successfully remade target file /.test(text) ||
      /^File .+ does not exist\./.test(text) ||
      /^Must remake target /.test(text) ||
      /^make(?:\[\d+\])?:/.test(text);
  }

  function parseMakeDebugOutput(output) {
    var lines = String(output || '').replace(/\r\n/g, '\n').split('\n');
    var events = [];
    var target = '';
    var reason = '';
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var trimmed = raw.trim();
      var remake = trimmed.match(/^Must remake target [`'](.+)[`']\.?$/);
      if (remake) {
        target = remake[1];
        reason = trimmed;
        continue;
      }
      if (isMakeDebugNoise(raw)) continue;
      if (!target) continue;
      events.push({
        target: target,
        command: trimmed,
        reason: reason,
        outputLine: i + 1,
      });
    }
    return events;
  }

  function targetMatchesPattern(pattern, target) {
    pattern = String(pattern || '');
    target = String(target || '');
    var percent = pattern.indexOf('%');
    if (percent < 0) return pattern === target;
    var before = pattern.slice(0, percent);
    var after = pattern.slice(percent + 1);
    return target.length >= before.length + after.length &&
      target.indexOf(before) === 0 &&
      target.slice(target.length - after.length) === after;
  }

  function findRuleForTarget(parsed, target) {
    var rules = parsed && parsed.rules || [];
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].targets.indexOf(target) >= 0) return rules[i];
    }
    for (var j = 0; j < rules.length; j++) {
      for (var k = 0; k < rules[j].targets.length; k++) {
        if (targetMatchesPattern(rules[j].targets[k], target)) return rules[j];
      }
    }
    return null;
  }

  function buildPlan(opts) {
    opts = opts || {};
    var makefilePath = normalizeTutorialPath(opts.makefilePath || '/tutorial/Makefile');
    var parsed = opts.parsed || parseMakefile(opts.source || '');
    var events = opts.events || parseMakeDebugOutput(opts.output || '');
    var cursors = Object.create(null);
    var items = [];
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var rule = findRuleForTarget(parsed, ev.target);
      var ruleKey = rule ? String(rule.id) : ev.target;
      var cursor = cursors[ruleKey] || 0;
      var recipeLines = rule && rule.recipeLines || [];
      var recipe = recipeLines.length ? recipeLines[Math.min(cursor, recipeLines.length - 1)] : null;
      cursors[ruleKey] = cursor + 1;
      items.push({
        index: items.length,
        file: makefilePath,
        target: ev.target,
        command: ev.command,
        reason: ev.reason || '',
        ruleLine: rule ? rule.line : 1,
        ruleTargets: rule ? rule.targets.slice() : [],
        recipeLine: recipe ? recipe.line : (rule ? rule.line : 1),
        line: recipe ? recipe.line : (rule ? rule.line : 1),
        prereqs: rule ? rule.prereqs.slice() : [],
        recipeText: recipe ? recipe.text : '',
      });
    }
    return { makefilePath: makefilePath, parsed: parsed, items: items };
  }

  function breakpointLineForItem(item, breakpoints, makefilePath) {
    if (!item) return null;
    makefilePath = normalizeTutorialPath(makefilePath || item.file);
    var candidates = [item.ruleLine, item.recipeLine, item.line];
    for (var i = 0; i < (breakpoints || []).length; i++) {
      var bp = breakpoints[i] || {};
      if (normalizeTutorialPath(bp.file || bp.path || bp.filename) !== makefilePath) continue;
      var line = Number(bp.line);
      if (candidates.indexOf(line) >= 0) return line;
    }
    return null;
  }

  function itemMatchesBreakpoint(item, breakpoints, makefilePath) {
    return breakpointLineForItem(item, breakpoints, makefilePath) != null;
  }

  function uniqueWords(values) {
    var seen = Object.create(null);
    var out = [];
    (values || []).forEach(function (value) {
      value = String(value || '');
      if (!value || seen[value]) return;
      seen[value] = true;
      out.push(value);
    });
    return out;
  }

  function stemForPattern(pattern, target) {
    pattern = String(pattern || '');
    target = String(target || '');
    var percent = pattern.indexOf('%');
    if (percent < 0 || !targetMatchesPattern(pattern, target)) return '';
    var before = pattern.slice(0, percent);
    var after = pattern.slice(percent + 1);
    return after ? target.slice(before.length, -after.length) : target.slice(before.length);
  }

  function stemForItem(item) {
    var targets = item && item.ruleTargets || [];
    for (var i = 0; i < targets.length; i++) {
      var stem = stemForPattern(targets[i], item.target);
      if (stem) return stem;
    }
    return '';
  }

  function scalar(type, repr) {
    return { kind: 'scalar', type: type, repr: String(repr == null ? '' : repr) };
  }

  function MakeChannel(controller, tutorial) {
    this.kind = 'make';
    this.controller = controller;
    this.tutorial = tutorial;
    this.plan = [];
    this.breakpoints = [];
    this.index = -1;
    this.makefilePath = '';
    this.cwd = '';
    this.goal = '';
    this.makeVariables = {};
  }

  MakeChannel.prototype.install = function () {};

  MakeChannel.prototype.dispose = function () {
    this.plan = [];
    this.index = -1;
    this.makeVariables = {};
  };

  MakeChannel.prototype.startSession = function (cfg) {
    var self = this;
    cfg = cfg || {};
    this.plan = [];
    this.index = -1;
    this.breakpoints = cfg.breakpoints || [];
    this.makeVariables = {};
    Promise.resolve()
      .then(function () { return self._syncEditorFiles(); })
      .then(function () { return self._buildTrace(cfg); })
      .then(function (trace) {
        self.plan = trace.items || [];
        self.makefilePath = trace.makefilePath;
        self.cwd = trace.cwd || dirname(trace.makefilePath);
        self.goal = trace.goal || '';
        self.makeVariables = trace.parsed && trace.parsed.variables || {};
        if (!self.plan.length) {
          self._complete('make has nothing to rebuild');
          return;
        }
        var first = self._nextBreakpointIndex(0);
        if (first < 0) first = 0;
        self._pauseAt(first);
      })
      .catch(function (err) {
        self._fail(err && err.message ? err.message : String(err || 'Make debugger failed'));
      });
  };

  MakeChannel.prototype._syncEditorFiles = function () {
    if (!this.tutorial || typeof this.tutorial._syncFilesToBackend !== 'function') return null;
    var models = this.tutorial.editorModels || {};
    return this.tutorial._syncFilesToBackend(Object.keys(models));
  };

  MakeChannel.prototype._buildTrace = function (cfg) {
    var self = this;
    var target = this._resolveMakefile(cfg);
    if (!target || !target.path || !target.source) {
      throw new Error('Open a Makefile before starting the Make debugger.');
    }
    if (!this.tutorial || typeof this.tutorial._runRPC !== 'function') {
      throw new Error('Make debugger needs the v86 RPC channel.');
    }
    var cwd = dirname(target.path);
    var relCwd = cwd;
    var args = (cfg.args || []).map(shellQuote).join(' ');
    var cmd = 'cd ' + shellQuote(relCwd) +
      ' && LC_ALL=C make --debug=b --dry-run --no-print-directory --no-builtin-rules' +
      (args ? ' ' + args : '');
    var ready = typeof this.tutorial._probeRPCDaemon === 'function'
      ? this.tutorial._probeRPCDaemon()
      : Promise.resolve(true);
    return Promise.resolve(ready).then(function (ok) {
      if (!ok) throw new Error('Make debugger needs the v86 RPC channel. Wait for the terminal to finish starting, then try again.');
      return self.tutorial._runRPC(cmd, { timeout: 15000 });
    }).then(function (output) {
      var trace = buildPlan({
        makefilePath: target.path,
        source: target.source,
        output: output || '',
      });
      trace.cwd = cwd;
      trace.goal = args || 'default';
      return trace;
    });
  };

  MakeChannel.prototype._resolveMakefile = function (cfg) {
    var files = cfg.files || {};
    var candidates = [];
    var dagPath = this.tutorial && typeof this.tutorial._activeMakeDagPath === 'function'
      ? this.tutorial._activeMakeDagPath()
      : '';
    if (dagPath) candidates.push(normalizeTutorialPath(dagPath + '/Makefile'));
    if (cfg.filename && /(^|\/)Makefile$/i.test(cfg.filename)) candidates.push(normalizeTutorialPath(cfg.filename));
    Object.keys(files).forEach(function (path) {
      if (/(^|\/)Makefile$/i.test(path)) candidates.push(normalizeTutorialPath(path));
    });
    var seen = Object.create(null);
    for (var i = 0; i < candidates.length; i++) {
      var path = candidates[i];
      if (!path || seen[path]) continue;
      seen[path] = true;
      if (Object.prototype.hasOwnProperty.call(files, path)) {
        return { path: path, source: files[path] };
      }
      var rel = stripTutorialPrefix(path);
      if (this.tutorial && this.tutorial.editorModels &&
          this.tutorial.editorModels[rel] && this.tutorial.editorModels[rel].model) {
        return { path: path, source: this.tutorial.editorModels[rel].model.getValue() };
      }
    }
    return null;
  };

  MakeChannel.prototype._nextBreakpointIndex = function (start) {
    for (var i = Math.max(0, start); i < this.plan.length; i++) {
      if (itemMatchesBreakpoint(this.plan[i], this.breakpoints, this.makefilePath)) return i;
    }
    return -1;
  };

  MakeChannel.prototype._pauseAt = function (idx) {
    if (idx < 0 || idx >= this.plan.length) {
      this._complete('make trace complete');
      return;
    }
    this.index = idx;
    var item = this.plan[idx];
    var line = breakpointLineForItem(item, this.breakpoints, this.makefilePath) || item.line || 1;
    var snap = this._snapshotForItem(item, line);
    if (this.controller && typeof this.controller.onPaused === 'function') {
      this.controller.onPaused({ type: 'paused', snapshots: [snap] });
    }
  };

  MakeChannel.prototype._snapshotForItem = function (item, line) {
    var fn = item.target ? 'target ' + item.target : 'make';
    var prereqs = item.prereqs || [];
    var locals = {
      target: scalar('target', item.target || ''),
      prerequisites: scalar('make', prereqs.join(' ')),
      command: scalar('shell', item.command || ''),
      dry_run: scalar('bool', 'true'),
      '$@': scalar('automatic', item.target || ''),
      '$<': scalar('automatic', prereqs[0] || ''),
      '$^': scalar('automatic', uniqueWords(prereqs).join(' ')),
      '$?': scalar('automatic', prereqs.join(' ')),
      '$*': scalar('automatic', stemForItem(item)),
    };
    var globals = {
      makefile: scalar('path', this.makefilePath),
      cwd: scalar('path', this.cwd),
      goal: scalar('target', this.goal || 'default'),
    };
    var vars = this.makeVariables || {};
    Object.keys(vars).sort().forEach(function (name) {
      if (!Object.prototype.hasOwnProperty.call(globals, name)) {
        globals[name] = scalar('make', vars[name]);
      }
    });
    return {
      event: 'line',
      file: this.makefilePath,
      line: line,
      function: fn,
      call_id: 'make:' + (item.target || item.index),
      location_hit: item.index + 1,
      make: {
        target: item.target || '',
        command: item.command || '',
        cwd: this.cwd,
        reason: item.reason || '',
        dryRun: true,
      },
      stack: [{
        file: this.makefilePath,
        line: line,
        function: fn,
        first_line: item.ruleLine || line,
        call_id: 'make:' + (item.target || item.index),
        locals: locals,
        globals: globals,
      }],
      watches: {},
    };
  };

  MakeChannel.prototype.sendCommand = function (cmdCode) {
    if (cmdCode === CMD_SYNC) {
      if (this.controller && this.controller.session) {
        this.controller.session.runtimeSyncInFlight = false;
        this.controller.session.runtimeUpdatePending = false;
      }
      if (this.controller && typeof this.controller.disableStepButtons === 'function') {
        this.controller.disableStepButtons(false);
      }
      if (this.controller && typeof this.controller.setStatus === 'function') {
        this.controller.setStatus('breakpoints updated');
      }
      return;
    }
    if (cmdCode === CMD_STOP) {
      this._complete('stopped');
      return;
    }
    if (!this.plan.length) {
      this._complete('make trace complete');
      return;
    }
    if (cmdCode === CMD_CONTINUE) {
      var nextBreakpoint = this._nextBreakpointIndex(this.index + 1);
      if (nextBreakpoint >= 0) this._pauseAt(nextBreakpoint);
      else this._complete('make trace complete');
      return;
    }
    if (cmdCode === CMD_STEP || cmdCode === CMD_NEXT || cmdCode === CMD_RETURN) {
      this._pauseAt(this.index + 1);
    }
  };

  MakeChannel.prototype.sendBreakpointChanges = function () {
    if (this.controller && typeof this.controller.collectBreakpointsForRun === 'function') {
      this.breakpoints = this.controller.collectBreakpointsForRun();
    }
    return true;
  };

  MakeChannel.prototype.sendWatches = function () { return true; };
  MakeChannel.prototype.sendExceptionBreakpoints = function () { return true; };
  MakeChannel.prototype.sendLiveEdits = function () { return false; };

  MakeChannel.prototype._complete = function () {
    if (this.controller && typeof this.controller.onDebugComplete === 'function') {
      this.controller.onDebugComplete({ exitCode: 0 });
    }
  };

  MakeChannel.prototype._fail = function (message) {
    if (this.controller && typeof this.controller.setStatus === 'function') {
      this.controller.setStatus(message);
    }
    if (this.controller && typeof this.controller.onDebugComplete === 'function') {
      this.controller.onDebugComplete({ exitCode: 1, error: message });
    }
  };

  window.SEBookMakeChannel = MakeChannel;
  window.SEBookMakeChannelTest = {
    parseMakefile: parseMakefile,
    parseMakeDebugOutput: parseMakeDebugOutput,
    buildPlan: buildPlan,
    breakpointLineForItem: breakpointLineForItem,
    targetMatchesPattern: targetMatchesPattern,
    normalizeTutorialPath: normalizeTutorialPath,
  };
})();
