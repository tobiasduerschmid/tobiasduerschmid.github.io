/**
 * Tau Prolog resolution debugger in an isolated, terminable Worker.
 *
 * Input: start {filename, code, query, breakpoints, watches, options}, command
 * {command: 1..6}, breakpoints {changes}, watches {watches}.
 * Output uses the shared debugger's paused/snapshots and debugComplete protocol.
 * Source locations identify clause starts: Tau's parser does not retain goal
 * spans. The interpreter itself performs every inference, cut and backtrack.
 */
'use strict';

var window = self;
var document = { location: { href: '' }, getElementById: () => null,
  getElementsByTagName: () => [], createElement: () => ({}) };
let output = '';
console.log = (...parts) => { output += parts.join(''); };
importScripts('/js/vendor/tau-prolog/0.3.4/core.js', '/js/vendor/tau-prolog/0.3.4/lists.js');

const ruleSources = new WeakMap();
const termScopes = new WeakMap();
const pointIds = new WeakMap();
const renamedHeads = new WeakSet();
const clauseEntries = new WeakMap();
const clauseBindings = new WeakMap();
const answerPoints = new WeakMap();
const originalRename = pl.type.Rule.prototype.rename;
const originalApply = pl.type.Term.prototype.apply;
const originalStep = pl.type.Thread.prototype.step;
const originalUnify = pl.unify;
let active = null;
let nextCallId = 0;
let resolution = null;

function send(message) { self.postMessage(message); }
function flushOutput() {
  if (output) send({ type: 'stdout', text: output });
  output = '';
}
function termText(term) { return term.toString({ quoted: true }); }
function value(term) {
  return { kind: 'primitive', type: pl.type.is_variable(term) ? 'unbound' : 'Prolog term', repr: termText(term) };
}
function pointId(point) {
  if (!pointIds.has(point)) pointIds.set(point, ++nextCallId);
  return pointIds.get(point);
}
function selectedGoal(point) {
  let goal = point && point.goal;
  if (pl.type.is_term(goal)) goal = goal.select();
  while (pl.type.is_term(goal) && goal.indicator === ':/2') goal = goal.args[1];
  return goal;
}

// Preserve source identity and source variable names through the interpreter's
// fresh-variable renaming. Metadata stays outside the pinned vendor snapshot.
function scopeTree(term, scope) {
  if (!pl.type.is_term(term)) return term;
  const copy = new pl.type.Term(term.id, term.args.map(arg => scopeTree(arg, scope)), term.ref);
  termScopes.set(copy, scope);
  return copy;
}
pl.type.Rule.prototype.rename = function (thread) {
  const renamed = originalRename.call(this, thread);
  const source = ruleSources.get(this);
  if (!source) return renamed;
  const variables = {};
  for (const name of this.variables()) {
    if (name !== '_') variables[name] = new pl.type.Var(thread.session.renamed_variables[name] || name);
  }
  const scope = { source, variables, callId: ++nextCallId };
  renamed.head = scopeTree(renamed.head, scope);
  renamedHeads.add(renamed.head);
  if (renamed.body) renamed.body = scopeTree(renamed.body, scope);
  return renamed;
};
pl.type.Term.prototype.apply = function (substitution) {
  let result = originalApply.call(this, substitution);
  const scope = termScopes.get(this);
  if (!scope) return result;
  // Tau returns ground terms unchanged. Their enclosing clause can still have
  // variables, so their debugger scopes must follow the same substitution.
  if (result === this) {
    result = new pl.type.Term(this.id, this.args.map(arg => arg.apply(substitution)), this.ref);
  }
  const variables = {};
  for (const name of Object.keys(scope.variables)) variables[name] = scope.variables[name].apply(substitution);
  termScopes.set(result, { source: scope.source, variables, callId: scope.callId });
  return result;
};
pl.unify = function (left, right, occursCheck) {
  const substitution = originalUnify(left, right, occursCheck);
  if (substitution && resolution && renamedHeads.has(right)) {
    resolution.matches.push({ head: right.apply(substitution), substitution });
  }
  return substitution;
};

// Associate each successful clause unification with its actual child choice
// point. This exposes facts and the chosen alternative's source line without
// inserting goals or changing Prolog's cut/backtracking behavior.
function executeStep(thread) {
  const prior = resolution;
  const point = thread.head_point();
  const current = { matches: [] };
  resolution = current;
  try {
    const asynchronous = originalStep.call(thread);
    if (current.matches.length) {
      const children = thread.points.filter(child => child.parent === point).reverse();
      for (let i = 0; i < current.matches.length; i++) {
        if (children[i]) {
          clauseEntries.set(children[i], current.matches[i].head);
          clauseBindings.set(children[i], current.matches[i].substitution);
        }
      }
    }
    return asynchronous;
  } finally { resolution = prior; }
}

function indexClauses(session, source, filename) {
  const tokenizer = new pl.parser.tokenizer(session.thread);
  tokenizer.new_text(source);
  const tokens = tokenizer.get_tokens(0) || [];
  const used = new Set();
  for (let start = 0; start < tokens.length;) {
    const expression = pl.parser.expression(session.thread, tokens, start, session.thread.__get_max_priority(), false);
    if (!expression.value || expression.len <= start || !tokens[expression.len] || tokens[expression.len].raw !== '.') break;
    const term = expression.value;
    const head = term.indicator === ':-/2' ? term.args[0] : term;
    const body = term.indicator === ':-/2' ? term.args[1] : null;
    for (const module of Object.values(session.modules)) {
      const rules = module.rules[head.indicator];
      if (!Array.isArray(rules)) continue;
      const rule = rules.find(candidate => !used.has(candidate) && candidate.head.equals(head) &&
        ((!candidate.body && !body) || (candidate.body && body && candidate.body.equals(body))));
      if (!rule) continue;
      used.add(rule);
      ruleSources.set(rule, { file: filename, line: tokens[start].line + 1, function: head.indicator });
    }
    start = expression.len + 1;
  }
}

function serializeVariables(variables) {
  const locals = {};
  for (const name of Object.keys(variables)) locals[name] = value(variables[name]);
  return locals;
}
function queryVariables(point) {
  const variables = {};
  for (const name of Object.keys(point.substitution.links)) {
    if (name !== '_') variables[name] = point.substitution.links[name];
  }
  return variables;
}
function scopeVariables(point) {
  const goal = clauseEntries.get(point) || selectedGoal(point);
  const scope = goal && termScopes.get(goal);
  return Object.assign({}, queryVariables(point), scope ? scope.variables : {});
}
function frameFor(point, bindings) {
  const goal = clauseEntries.get(point) || selectedGoal(point);
  const scope = goal && termScopes.get(goal);
  const source = scope ? scope.source : { file: active.filename, line: active.firstLine, function: '<query>' };
  const variables = scope ? scope.variables : queryVariables(point);
  const currentVariables = {};
  for (const name of Object.keys(variables)) {
    currentVariables[name] = (bindings || []).reduce((term, substitution) => term.apply(substitution), variables[name]);
  }
  const frame = { function: source.function, file: source.file, line: source.line,
    first_line: source.line, call_id: scope ? scope.callId : pointId(point),
    locals: serializeVariables(currentVariables), globals: {}, closure: {} };
  if (goal) frame.locals['Current goal'] = value(goal);
  return frame;
}
function callStack(point) {
  const stack = [];
  const bindings = [];
  for (let ancestor = point; ancestor; ancestor = ancestor.parent) {
    if (clauseBindings.has(ancestor)) bindings.push(clauseBindings.get(ancestor));
  }
  bindings.reverse();
  let current = point;
  while (current && stack.length < 100) {
    const goal = selectedGoal(current);
    const frame = frameFor(current, bindings);
    if (!stack.length || frame.call_id !== stack[stack.length - 1].call_id) stack.push(frame);
    if (clauseEntries.has(current)) {
      current = current.parent;
      continue;
    }
    let entry = current;
    while (entry.parent && entry.parent.goal && goal && entry.parent.goal.search(goal)) entry = entry.parent;
    current = entry.parent;
  }
  return stack.reverse();
}

function expressionTerm(expression, variables, preserveUnboundNames) {
  const parsed = active.session.parse(String(expression).trim().replace(/\.$/, ''));
  if (!parsed || !parsed.value || parsed.expr.type !== 1) throw new Error('Enter a Prolog variable or term.');
  const unknown = parsed.value.variables().filter(name => !Object.prototype.hasOwnProperty.call(variables, name));
  if (unknown.length) throw new Error('Variable is not in this scope: ' + unknown[0]);
  const substitutions = Object.assign({}, variables);
  if (preserveUnboundNames) {
    // Fresh clause variables are alpha-renamed by Tau. That internal rename
    // is not a value change and must not trigger a learner's data watchpoint.
    for (const name of parsed.value.variables()) {
      if (pl.type.is_variable(substitutions[name])) substitutions[name] = new pl.type.Var(name);
    }
  }
  return parsed.value.apply(new pl.type.Substitution(substitutions));
}
function watchValues(variables, point) {
  const watches = {};
  const conditions = new Set(Array.from(active.breakpoints.values(), breakpoint => breakpoint.condition));
  for (const expression of active.watches) {
    try {
      watches[expression] = conditions.has(expression)
        ? { kind: 'primitive', type: 'bool', repr: conditionPasses(expression, point) ? 'true' : 'false' }
        : value(expressionTerm(expression, variables, true));
    }
    catch (error) { watches[expression] = { error: error.message }; }
  }
  return watches;
}
function snapshot(point, event) {
  const stack = callStack(point);
  const frame = stack[stack.length - 1];
  const variables = scopeVariables(point);
  return { file: frame.file, line: frame.line, event: event || 'line', depth: stack.length,
    call_id: frame.call_id, source_mapped: frame.function !== '<query>', stack, watches: watchValues(variables, point) };
}

function conditionPasses(condition, point) {
  if (!condition) return true;
  const term = expressionTerm(condition, scopeVariables(point));
  if (term.indicator === 'true/0') return true;
  if (term.indicator === 'false/0') return false;
  const args = term.args || [];
  if (args.length !== 2) throw new Error('Use a pure equality or numeric comparison for a Prolog breakpoint.');
  if (term.id === '==') return args[0].equals(args[1]);
  if (term.id === '\\==') return !args[0].equals(args[1]);
  if (term.id === '=') return pl.unify(args[0], args[1]) !== null;
  if (term.id === '\\=') return pl.unify(args[0], args[1]) === null;
  const left = args[0].interpret(active.session.thread);
  const right = args[1].interpret(active.session.thread);
  if (!pl.type.is_number(left) || !pl.type.is_number(right)) throw new Error('The comparison needs bound numeric operands.');
  const compare = { '>': (a, b) => a > b, '<': (a, b) => a < b, '>=': (a, b) => a >= b,
    '=<': (a, b) => a <= b, '=:=': (a, b) => a === b, '=\\=': (a, b) => a !== b }[term.id];
  if (!compare) throw new Error('Use a pure equality or numeric comparison for a Prolog breakpoint.');
  return compare(left.value, right.value);
}
function hitsBreakpoint(snap, point) {
  if (!snap.source_mapped) return false;
  const breakpoint = active.breakpoints.get(snap.file + ':' + snap.line);
  if (!breakpoint) return false;
  try { if (!conditionPasses(breakpoint.condition, point)) return false; }
  catch (error) { send({ type: 'breakpointError', file: snap.file, line: snap.line, error: error.message }); }
  breakpoint.hits = (breakpoint.hits || 0) + 1;
  return !breakpoint.hitCount || breakpoint.hits >= breakpoint.hitCount;
}
function shouldPause(snap, point) {
  const breakpoint = hitsBreakpoint(snap, point);
  return active.count === 1 || breakpoint || active.command === 2 ||
    (active.command === 3 && snap.depth <= active.baseDepth) ||
    (active.command === 4 && snap.depth < active.baseDepth);
}

function record(point, event, resume) {
  if (!active || active.completed) return true;
  if (active.count >= active.limit) {
    send({ type: 'capReached', limit: active.limit });
    complete(1, 'Prolog trace limit reached. Narrow the query or check its termination.');
    return true;
  }
  const snap = snapshot(point, event);
  active.count++;
  active.snapshots.push(snap);
  active.last = { point, event, snap };
  if (!shouldPause(snap, point)) return false;
  flushOutput();
  active.resume = resume;
  active.baseDepth = snap.depth;
  send({ type: 'paused', snapshots: active.snapshots });
  active.snapshots = [];
  return true;
}

pl.type.Thread.prototype.step = function () {
  if (!active || active.completed || this.session !== active.session) return originalStep.call(this);
  const thread = this;
  const point = thread.head_point();
  if (record(point, 'line', () => {
    try { if (executeStep(thread) !== true) thread.again(false); }
    catch (error) { complete(1, error.message); }
  })) return true;
  return executeStep(this);
};

function complete(exitCode, error) {
  if (!active || active.completed) return;
  active.completed = true;
  active.resume = null;
  flushOutput();
  if (error) send({ type: 'stderr', text: error + '\n' });
  send({ type: 'debugComplete', exitCode, error, errorReported: !!error, snapshots: active.snapshots });
  active.snapshots = [];
}
function nextAnswer() {
  if (!active || active.completed) return;
  active.session.answer({
    success(answer) {
      if (!active || active.completed) return;
      if (++active.answers > 100) { complete(1, 'Answer limit reached. Narrow the query.'); return; }
      const point = answerPoints.get(answer);
      if (point && clauseEntries.has(point) && record(point, 'line', () => deliverAnswer(answer))) return;
      deliverAnswer(answer);
    },
    fail() {
      if (!active.answers) send({ type: 'stdout', text: 'false.\n' });
      complete(active.answers ? 0 : 1);
    },
    error(error) { complete(1, pl.format_answer(error)); },
    limit() { complete(1, 'Inference limit reached. Check the base case and goal order.'); },
  });
}
function deliverAnswer(answer) {
  flushOutput();
  send({ type: 'stdout', text: pl.format_answer(answer) + '\n' });
  const point = new pl.type.State(null, answer, null);
  if (!record(point, 'return', nextAnswer)) nextAnswer();
}

function updateBreakpoints(changes) {
  for (const change of changes || []) {
    const key = change.file + ':' + change.line;
    if (change.op === 'remove' || change.remove || change.enabled === false) active.breakpoints.delete(key);
    else active.breakpoints.set(key, { condition: change.condition || '', hitCount: change.hitCount || 0 });
  }
}
function start(config) {
  const source = config.code || '';
  const query = String(config.query || '').trim().replace(/^\?-\s*/, '');
  active = { session: pl.create(100000), filename: config.filename, firstLine: 1,
    breakpoints: new Map(), watches: config.watches || [], command: 2, baseDepth: 1,
    count: 0, answers: 0, snapshots: [], resume: null, completed: false,
    limit: Math.max(1, Math.min(50000, Number(config.options && (config.options.max_history || config.options.max_snapshots)) || 5000)) };
  active.session.format_success = point => {
    answerPoints.set(point.substitution, point);
    return point.substitution;
  };
  active.session.thread.format_success = active.session.format_success;
  updateBreakpoints(config.breakpoints);
  if (!query) { complete(1, 'Enter a Prolog query before starting the debugger.'); return; }
  const consultOptions = { url: false, script: false, file: false };
  active.session.consult('not(Goal) :- \\+ Goal.', { ...consultOptions,
    success() {
      active.session.consult(source, { ...consultOptions,
        success() {
          try {
            indexClauses(active.session, source, active.filename);
            const first = Object.values(active.session.modules.user.rules).flat().find(rule => ruleSources.has(rule));
            if (first) active.firstLine = ruleSources.get(first).line;
            active.session.query(query.endsWith('.') ? query : query + '.', {
              success: nextAnswer, error: error => complete(1, 'Query error: ' + pl.format_answer(error)),
            });
          } catch (error) { complete(1, error.message); }
        }, error: error => complete(1, 'Consult error: ' + pl.format_answer(error)),
      });
    }, error: error => complete(1, pl.format_answer(error)),
  });
}
function command(code) {
  if (!active || active.completed) return;
  if (code === 5) { complete(0); return; }
  if (code === 6) {
    if (active.resume && active.last) {
      const snap = snapshot(active.last.point, active.last.event);
      active.last.snap = snap;
      send({ type: 'paused', snapshots: [snap], replace_last: true });
    }
    return;
  }
  if (![1, 2, 3, 4].includes(code) || !active.resume) return;
  active.command = code;
  const resume = active.resume;
  active.resume = null;
  resume();
}
self.onmessage = event => {
  const message = event.data;
  try {
    if (message.type === 'start') start(message);
    else if (message.type === 'command') command(message.command);
    else if (active && message.type === 'breakpoints') updateBreakpoints(message.changes);
    else if (active && message.type === 'watches') active.watches = message.watches || [];
  } catch (error) { complete(1, error.message); }
};
send({ type: 'ready' });
