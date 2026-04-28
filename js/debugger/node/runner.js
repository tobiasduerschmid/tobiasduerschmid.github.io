/**
 * Time-travel debugger — Node.js runner.
 *
 * Runs INSIDE the WebContainer Node process. Mirrors what
 * `pyodide-debugger.py` does for Python, but uses V8's in-process
 * Inspector module (Chrome DevTools Protocol over an in-process channel) to
 * obtain pause / step / scope semantics.
 *
 * Architecture:
 *   - Reads an initial JSON config line from stdin (entry file, breakpoints,
 *     watches, options, overrides, args).
 *   - Sets V8 breakpoints via `Debugger.setBreakpointByUrl`.
 *   - Uses `Debugger.stepInto` mode from the start so EVERY user line pauses,
 *     letting us record a snapshot. We decide whether to surface the pause to
 *     the UI (breakpoint hit, or user-driven stepping) or silently continue.
 *   - Snapshots are sent over stdout with a marker prefix so user `console.log`
 *     output and our protocol traffic can share the same stream cleanly.
 *
 * Stdio multiplexing:
 *   - User stdout/stderr → flows naturally to the parent (the WebContainer
 *     adapter) and is shown in the Output panel.
 *   - Protocol messages → prefixed with \x01TTD\x02 ... \x03\n.
 *   - Commands from the parent → newline-delimited JSON on stdin.
 *
 * Pause / step protocol — same as the Python one:
 *   1=continue, 2=stepInto, 3=stepOver, 4=stepOut, 5=stop, 6=sync
 *
 * Variable mutation (live + override-on-replay): Debugger.setVariableValue
 * over CDP. CDP doesn't have a great primitive for arbitrary expressions, so
 * we evaluate the user's expression with `Debugger.evaluateOnCallFrame`, then
 * pass the resulting `RemoteObject` back to setVariableValue.
 */

'use strict';

const inspector = require('inspector');
const fs = require('fs');
const path = require('path');
const url = require('url');

// ---- Stdio framing ---------------------------------------------------------

const PROTO_PREFIX = '\x01TTD\x02';
const PROTO_SUFFIX = '\x03\n';

function send(msg) {
  process.stdout.write(PROTO_PREFIX + JSON.stringify(msg) + PROTO_SUFFIX);
}

// Async command queue: parent's commands arrive as JSON lines on stdin.
// `awaitCommand()` returns a Promise resolved when the next command arrives.
const commandQueue = [];
const commandWaiters = [];
let stdinBuffer = '';
let runtimeUpdateChain = Promise.resolve();

function processCommandBuffer() {
  let nl;
  while ((nl = stdinBuffer.indexOf('\n')) !== -1) {
    const line = stdinBuffer.slice(0, nl);
    stdinBuffer = stdinBuffer.slice(nl + 1);
    if (!line.trim()) continue;
    let msg;
    try { msg = JSON.parse(line); } catch (e) { continue; }
    if (msg.code === 5) {
      stopFlag = true;
      send({ type: 'debugComplete', exitCode: 0 });
      setImmediate(() => process.exit(0));
      continue;
    }
    if (msg.update_only) {
      queueRuntimeUpdate(msg);
      continue;
    }
    if (commandWaiters.length) {
      const waiter = commandWaiters.shift();
      waiter(msg);
    } else {
      commandQueue.push(msg);
    }
  }
}

function queueRuntimeUpdate(msg) {
  runtimeUpdateChain = runtimeUpdateChain
    .then(() => applyRuntimeUpdates(msg))
    .catch((e) => {
      send({ type: 'debuggerError', message: 'runtime update error: ' + String(e && e.stack || e) });
    });
  return runtimeUpdateChain;
}

function handleCommandChunk(chunk) {
  stdinBuffer += chunk.toString('utf8');
  processCommandBuffer();
}

function startCommandReader() {
  process.stdin.on('data', handleCommandChunk);
  processCommandBuffer();
}

function readInitialLine() {
  return new Promise((resolve) => {
    function onData(chunk) {
      stdinBuffer += chunk.toString('utf8');
      const nl = stdinBuffer.indexOf('\n');
      if (nl === -1) return;
      const line = stdinBuffer.slice(0, nl);
      stdinBuffer = stdinBuffer.slice(nl + 1);
      process.stdin.removeListener('data', onData);
      resolve(line);
    }
    process.stdin.on('data', onData);
    if (typeof process.stdin.resume === 'function') process.stdin.resume();
  });
}

function awaitCommand() {
  return new Promise((resolve) => {
    if (commandQueue.length) resolve(commandQueue.shift());
    else commandWaiters.push(resolve);
  });
}

// ---- Inspector session -----------------------------------------------------

const session = new inspector.Session();
session.connect();

function post(method, params) {
  return new Promise((resolve, reject) => {
    session.post(method, params || {}, (err, res) => {
      err ? reject(err) : resolve(res);
    });
  });
}

// ---- State -----------------------------------------------------------------

let cfg = null;
let watches = [];
let breakpointMap = new Map();   // bpId (CDP) -> {file, line, condition}
let exceptionBreakpoints = [];   // [{id, enabled, type, mode}]
let opts = {};
let snapshotDepth = 3;
let maxHistory = 50000;
let filterGlobals = true;

let totalSnapshots = 0;
let snapshotBuffer = [];
let capWarned = false;

let stopFlag = false;

// "What does the user want next?" State machine driven by their last command.
//   userMode: 'continue' | 'stepInto' | 'stepOver' | 'stepOut' | null
//   stepBaseDepth: call frame depth when the step was issued
let userMode = null;
let stepBaseFrame = null;     // call-frame identity at step issue (function name + scriptId + start line)

// Per-frame call_id for the UI to link "same call" across snapshots.
let callIdCounter = 0;
let previousStackIdentity = [];

// oid for object aliasing
let oidCounter = 0;
const oidByCdpId = new Map();   // CDP objectId -> our integer oid

// Pre-recorded overrides (rewound-edit replay) to apply at specific snapshot indices.
let pendingOverrides = [];
const appliedOverrideIndices = new Set();

// User → file URLs. We resolve user file paths to CDP url so breakpoints land.
function fileUrl(filename) {
  if (filename.startsWith('/')) return url.pathToFileURL(filename).href;
  return url.pathToFileURL(path.resolve(filename)).href;
}

function unfileUrl(u) {
  if (!u) return u;
  if (u.startsWith('file://')) {
    try { return url.fileURLToPath(u); } catch (e) { return u; }
  }
  return u;
}

function log(msg) { send({ type: 'log', msg: '[ttd-node] ' + msg }); }

// ---- Snapshotting ----------------------------------------------------------

// Capture a snapshot at a Debugger.paused event. We walk callFrames,
// resolve their scope chain via Runtime.getProperties, and serialize values
// into the same JSON-tree shape the Python side emits so the UI can be reused
// verbatim.
async function captureSnapshot(params, eventReason) {
  const callFrames = params.callFrames || [];
  // OUTERMOST first (Python's serialize_stack does this) — CDP gives innermost first
  const reversed = callFrames.slice().reverse();
  const callIds = assignCallIds(reversed);
  const stack = [];
  for (let i = 0; i < reversed.length; i++) {
    const cf = reversed[i];
    const frameEntry = {
      function: cf.functionName || '<anonymous>',
      file: scriptUrlToUserPath(cf.url),
      line: (cf.location && cf.location.lineNumber + 1) || 0,
      call_id: callIds[i],
      locals: await serializeScope(cf, ['local', 'closure', 'block', 'catch', 'with', 'eval']),
    };
    if (i === reversed.length - 1) {
      // Top frame also gets globals
      frameEntry.globals = await serializeScope(cf, ['global'], { filter: true });
    }
    stack.push(frameEntry);
  }
  const top = callFrames[0];
  const snap = {
    file: scriptUrlToUserPath(top && top.url),
    line: (top && top.location && top.location.lineNumber + 1) || 0,
    event: eventReason || 'line',
    call_id: stack.length ? stack[stack.length - 1].call_id : 0,
    stack: stack,
    watches: await evalWatches(top),
  };
  if (eventReason === 'exception' && params.data) {
    // V8/CDP supplies `data.uncaught: boolean` and an exception RemoteObject.
    // Best-effort extract the exception's type name (className) and message
    // (description). Fall back to generic strings if unavailable.
    const obj = params.data;
    const className = obj.className || (obj.exception && obj.exception.className) || 'Error';
    let description = obj.description || (obj.exception && obj.exception.description) || '';
    // CDP description may include a stack trace after the first line; trim.
    const firstLine = description.split('\n')[0];
    let message = '';
    const colonIdx = firstLine.indexOf(': ');
    if (colonIdx >= 0) message = firstLine.substring(colonIdx + 2);
    else message = firstLine;
    snap.exception = {
      type: className,
      message: message,
      caught: !obj.uncaught,
    };
  }
  return snap;
}

function exceptionBreakpointMatches(snap) {
  if (!snap || snap.event !== 'exception' || !snap.exception) return false;
  const enabled = exceptionBreakpoints.filter((eb) => eb.enabled !== false);
  if (!enabled.length) return false;
  const t = String(snap.exception.type || '');
  const caught = !!snap.exception.caught;
  for (const eb of enabled) {
    const wantedType = (eb.type || '').trim();
    if (wantedType && wantedType !== t) continue;
    if ((eb.mode || 'uncaught') === 'uncaught' && caught) continue;
    return true;
  }
  return false;
}

function scriptUrlToUserPath(u) {
  if (!u) return '';
  return unfileUrl(u);
}

function assignCallIds(framesOuterToInner) {
  const next = framesOuterToInner.map((cf) => ({ sig: frameSignature(cf), call_id: 0 }));
  let shared = 0;
  while (shared < next.length && shared < previousStackIdentity.length &&
         next[shared].sig === previousStackIdentity[shared].sig) {
    next[shared].call_id = previousStackIdentity[shared].call_id;
    shared++;
  }
  for (let i = shared; i < next.length; i++) {
    callIdCounter++;
    next[i].call_id = callIdCounter;
  }
  previousStackIdentity = next;
  return next.map((f) => f.call_id);
}

function frameSignature(cf) {
  return (cf.functionName || '<anonymous>') + '|' +
         (cf.url || '') + '|' +
         (cf.functionLocation ? cf.functionLocation.lineNumber : '?') + '|' +
         (cf.functionLocation ? cf.functionLocation.columnNumber : '?');
}

async function serializeScope(cf, kinds, extra) {
  const out = {};
  const scopes = (cf.scopeChain || []).filter(s => kinds.indexOf(s.type) !== -1);
  for (const scope of scopes) {
    if (!scope.object || !scope.object.objectId) continue;
    let res;
    try {
      res = await post('Runtime.getProperties', {
        objectId: scope.object.objectId,
        ownProperties: true,
        accessorPropertiesOnly: false,
        generatePreview: false,
      });
    } catch (e) { continue; }
    for (const p of res.result || []) {
      const name = p.name;
      if (extra && extra.filter && !isUserGlobal(name, p.value)) continue;
      if (Object.prototype.hasOwnProperty.call(out, name)) continue;
      try {
        out[name] = await serializeRemote(p.value, snapshotDepth);
      } catch (e) {
        out[name] = { kind: 'primitive', type: 'error', repr: '<unrepresentable>' };
      }
    }
  }
  return out;
}

const NODE_GLOBAL_NOISE = new Set([
  'global', 'globalThis', 'process', 'Buffer', 'queueMicrotask', 'clearImmediate',
  'setImmediate', 'structuredClone', '__filename', '__dirname',
  'exports', 'module', 'require', 'AbortController', 'AbortSignal',
  'EventTarget', 'Event', 'MessageEvent', 'MessageChannel', 'MessagePort',
  'fetch', 'crypto', 'performance', 'TextEncoder', 'TextDecoder',
  'URL', 'URLSearchParams', 'WebAssembly', 'console', 'navigator',
]);

function isUserGlobal(name, remote) {
  if (NODE_GLOBAL_NOISE.has(name)) return false;
  if (name.startsWith('__')) return false;
  // Filter built-in functions (Node provides many at the top level)
  if (remote && remote.type === 'function' && remote.className === 'Function' &&
      remote.description && /\[native code\]/.test(remote.description)) return false;
  return true;
}

async function serializeRemote(remote, depth) {
  if (!remote) return { kind: 'primitive', type: 'undefined', repr: 'undefined' };
  const t = remote.type;
  if (t === 'undefined') return { kind: 'primitive', type: 'undefined', repr: 'undefined' };
  if (t === 'string') {
    return { kind: 'primitive', type: 'string', repr: JSON.stringify(remote.value) };
  }
  if (t === 'number' || t === 'boolean' || t === 'bigint') {
    return { kind: 'primitive', type: t, repr: String(remote.unserializableValue !== undefined ? remote.unserializableValue : remote.value) };
  }
  if (t === 'symbol') {
    return { kind: 'primitive', type: 'symbol', repr: remote.description || 'Symbol()' };
  }
  if (t === 'function') {
    return {
      kind: 'object',
      type: 'function',
      oid: oidFor(remote),
      repr: '[Function: ' + (remote.description || 'anonymous').split('\n')[0].slice(0, 80) + ']',
      attrs: {},
    };
  }
  if (t === 'object') {
    if (remote.subtype === 'null') return { kind: 'primitive', type: 'null', repr: 'null' };
    if (remote.subtype === 'array' || remote.subtype === 'set' || remote.subtype === 'map') {
      return await serializeCollection(remote, remote.subtype, depth);
    }
    return await serializeGenericObject(remote, depth);
  }
  return { kind: 'primitive', type: t, repr: String(remote.description || remote.value) };
}

function oidFor(remote) {
  if (!remote || !remote.objectId) return ++oidCounter;
  if (oidByCdpId.has(remote.objectId)) return oidByCdpId.get(remote.objectId);
  oidCounter++;
  oidByCdpId.set(remote.objectId, oidCounter);
  return oidCounter;
}

async function serializeCollection(remote, kind, depth) {
  const oid = oidFor(remote);
  if (depth <= 0) {
    return { kind: 'truncated', type: kind, oid: oid, repr: remote.description || ('[' + kind + ']') };
  }
  const children = [];
  let len = 0;
  try {
    const res = await post('Runtime.getProperties', {
      objectId: remote.objectId,
      ownProperties: true,
      generatePreview: false,
    });
    const props = res.result || [];
    if (kind === 'array') {
      const indexed = props.filter(p => /^\d+$/.test(p.name));
      len = indexed.length;
      const max = Math.min(indexed.length, 100);
      for (let i = 0; i < max; i++) {
        const p = indexed[i];
        children.push(await serializeRemote(p.value, depth - 1));
      }
      return {
        kind: 'collection', type: 'list', oid: oid, len: len,
        preview: remote.description || ('Array(' + len + ')'),
        children: children, truncated: len > children.length,
      };
    }
    // sets/maps require a different traversal — we approximate via description
    return {
      kind: 'object', type: kind, oid: oid,
      repr: remote.description || ('[' + kind + ']'),
      attrs: {},
    };
  } catch (e) {
    return { kind: 'object', type: kind, oid: oid, repr: '<unreadable>', attrs: {} };
  }
}

async function serializeGenericObject(remote, depth) {
  const oid = oidFor(remote);
  if (depth <= 0) {
    return { kind: 'truncated', type: remote.className || 'object', oid: oid, repr: remote.description || '[Object]' };
  }
  let attrs = {};
  try {
    const res = await post('Runtime.getProperties', {
      objectId: remote.objectId,
      ownProperties: true,
      generatePreview: false,
    });
    const props = (res.result || []).filter(p => !p.symbol && !p.isOwn === false ? true : true);
    let count = 0;
    for (const p of props) {
      if (count >= 50) break;
      if (p.name.startsWith('__')) continue;
      try {
        attrs[p.name] = await serializeRemote(p.value, depth - 1);
        count++;
      } catch (e) { /* skip */ }
    }
  } catch (e) { /* leave attrs empty */ }
  return {
    kind: 'object',
    type: remote.className || 'object',
    oid: oid,
    repr: remote.description || ('[' + (remote.className || 'object') + ']'),
    attrs: attrs,
  };
}

async function evalWatches(topFrame) {
  const out = {};
  if (!topFrame) return out;
  for (const expr of watches) {
    try {
      const res = await post('Debugger.evaluateOnCallFrame', {
        callFrameId: topFrame.callFrameId,
        expression: expr,
        returnByValue: false,
        generatePreview: false,
        throwOnSideEffect: false,
      });
      if (res.exceptionDetails) {
        out[expr] = { error: (res.exceptionDetails.exception && res.exceptionDetails.exception.description) || 'eval error' };
      } else {
        out[expr] = await serializeRemote(res.result, snapshotDepth);
      }
    } catch (e) {
      out[expr] = { error: String(e && e.message || e) };
    }
  }
  return out;
}

// ---- User intent: should we surface this pause to the UI? -----------------

function shouldSurfacePause(params) {
  // Always surface user-set breakpoints, subject to hit-count threshold.
  // CDP already gates on the breakpoint's `condition` server-side, so any
  // hitBreakpoints entry here represents a condition-passing hit.
  if (params.hitBreakpoints && params.hitBreakpoints.length) {
    let allBelowThreshold = true;
    for (const bpId of params.hitBreakpoints) {
      const info = breakpointMap.get(bpId);
      if (!info) { allBelowThreshold = false; continue; }
      info._hits = (info._hits || 0) + 1;
      if (!info.hitCount || info._hits >= info.hitCount) allBelowThreshold = false;
    }
    if (allBelowThreshold) return false;
    return true;
  }
  if (params.reason === 'debugCommand' || looksLikeDebuggerStatement(params)) return true;
  // Exception event: surface only if at least one Exception Breakpoint
  // matches. We cannot use `params.data` directly here without a snapshot,
  // so we attach the captureSnapshot result later. The actual filter happens
  // in handlePaused after the snapshot is built.
  if (params.reason === 'exception') return 'exception';
  // Surface stepping pauses based on user mode + frame depth
  if (userMode === 'stepInto') return true;
  if (userMode === 'stepOver') {
    // Same depth or shallower than where step was issued
    const depth = (params.callFrames || []).length;
    return depth <= (stepBaseFrame ? stepBaseFrame.depth : depth);
  }
  if (userMode === 'stepOut') {
    const depth = (params.callFrames || []).length;
    return depth < (stepBaseFrame ? stepBaseFrame.depth : depth);
  }
  if (userMode === 'sync') return true;
  return false;
}

function looksLikeDebuggerStatement(params) {
  if (!params || params.reason !== 'other') return false;
  const top = params.callFrames && params.callFrames[0];
  if (!top || !top.url || !top.location) return false;
  const file = scriptUrlToUserPath(top.url);
  if (!file || file.indexOf('/tutorial/') !== 0) return false;
  try {
    const line = fs.readFileSync(file, 'utf8').split(/\r?\n/)[top.location.lineNumber] || '';
    return /\bdebugger\s*;?/.test(line);
  } catch (e) {
    return false;
  }
}

// ---- Apply UI commands -----------------------------------------------------

async function applyRuntimeUpdates(cmd) {
  if (!cmd) return;
  if (cmd.watches) watches = cmd.watches.slice();
  if (cmd.breakpoint_changes) {
    for (const ch of cmd.breakpoint_changes) await applyBpChange(ch);
  }
  if (cmd.live_edits) {
    for (const e of cmd.live_edits) await applyLiveEdit(e);
  }
  if (cmd.exception_breakpoints) {
    exceptionBreakpoints = cmd.exception_breakpoints.slice();
  }
}

async function applyCommand(cmd) {
  // cmd shape: { code: 1..6, watches?, breakpoint_changes?, live_edits? }
  await runtimeUpdateChain;
  await applyRuntimeUpdates(cmd);
  switch (cmd.code) {
    case 1: userMode = 'continue'; stepBaseFrame = null; await post('Debugger.resume'); return true;
    case 2: userMode = 'stepInto'; stepBaseFrame = null; await post('Debugger.stepInto'); break;
    case 3:
      userMode = 'stepOver';
      stepBaseFrame = { depth: cmd._currentDepth || 1 };
      await post('Debugger.stepOver');
      return true;
    case 4:
      userMode = 'stepOut';
      stepBaseFrame = { depth: cmd._currentDepth || 1 };
      await post('Debugger.stepOut');
      return true;
    case 5: stopFlag = true; await post('Debugger.resume'); return true;
    case 6: {
      const snap = await captureSnapshot({ callFrames: lastCallFrames }, 'sync');
      send({ type: 'paused', snapshots: [snap], replace_last: true });
      return false;
    }
    default: await post('Debugger.resume'); return true;
  }
  return true;
}

async function applyBpChange(ch) {
  if (ch.op === 'add') {
    const u = fileUrl(ch.file);
    try {
      // Preserve any existing hit counter at this location across edits, so
      // changing the condition mid-run doesn't reset progress through a loop.
      let priorHits = 0;
      for (const info of breakpointMap.values()) {
        if (info.file === ch.file && info.line === ch.line) {
          priorHits = info._hits || 0;
          break;
        }
      }
      const hitCount = ch.hitCount || ch.hit_count || null;
      const res = await post('Debugger.setBreakpointByUrl', {
        url: u,
        lineNumber: ch.line - 1,
        condition: ch.condition || undefined,
      });
      breakpointMap.set(res.breakpointId, {
        file: ch.file,
        line: ch.line,
        condition: ch.condition,
        hitCount: hitCount && hitCount >= 1 ? hitCount : null,
        _hits: priorHits,
      });
    } catch (e) {
      send({ type: 'breakpointError', file: ch.file, line: ch.line, error: String(e && e.message || e) });
    }
  } else if (ch.op === 'remove') {
    for (const [id, info] of breakpointMap) {
      if (info.file === ch.file && info.line === ch.line) {
        await post('Debugger.removeBreakpoint', { breakpointId: id });
        breakpointMap.delete(id);
      }
    }
  } else if (ch.op === 'edit') {
    await applyBpChange({ op: 'remove', file: ch.file, line: ch.line });
    await applyBpChange({ op: 'add', file: ch.file, line: ch.line, condition: ch.condition, hitCount: ch.hitCount || ch.hit_count });
  }
}

async function applyLiveEdit(edit) {
  // edit: { var, expr, frame_depth, scope }
  const cfs = lastCallFrames;
  if (!cfs || !cfs.length) return;
  // frame_depth = 0 means top (innermost) — CDP cfs[0] is innermost
  const cf = cfs[Math.min(edit.frame_depth || 0, cfs.length - 1)];
  if (!cf) return;
  let valueRemote;
  try {
    const res = await post('Debugger.evaluateOnCallFrame', {
      callFrameId: cf.callFrameId,
      expression: edit.expr,
      returnByValue: false,
      generatePreview: false,
      throwOnSideEffect: false,
    });
    if (res.exceptionDetails) {
      send({ type: 'editError', var: edit.var, expr: edit.expr,
             error: (res.exceptionDetails.exception && res.exceptionDetails.exception.description) || 'eval error' });
      return;
    }
    valueRemote = res.result;
  } catch (e) {
    send({ type: 'editError', var: edit.var, expr: edit.expr, error: String(e && e.message || e) });
    return;
  }
  // Find which scope the variable lives in
  const scopes = cf.scopeChain || [];
  let targetScopeNumber = -1;
  for (let i = 0; i < scopes.length; i++) {
    const s = scopes[i];
    if (s.type === 'global' && edit.scope === 'globals') { targetScopeNumber = i; break; }
    if (s.type !== 'global') {
      // Check if the var is in this scope
      try {
        const res = await post('Runtime.getProperties', { objectId: s.object.objectId, ownProperties: true });
        if ((res.result || []).some(p => p.name === edit.var)) { targetScopeNumber = i; break; }
      } catch (e) { /* skip */ }
    }
  }
  if (targetScopeNumber === -1) {
    send({ type: 'editError', var: edit.var, expr: edit.expr, error: 'variable not found in any scope' });
    return;
  }
  try {
    const newValue = valueRemote.objectId
      ? { objectId: valueRemote.objectId }
      : (valueRemote.unserializableValue !== undefined
          ? { unserializableValue: valueRemote.unserializableValue }
          : { value: valueRemote.value });
    await post('Debugger.setVariableValue', {
      scopeNumber: targetScopeNumber,
      variableName: edit.var,
      newValue: newValue,
      callFrameId: cf.callFrameId,
    });
    log('edit ' + edit.scope + '[' + edit.var + '] = ' + edit.expr);
  } catch (e) {
    send({ type: 'editError', var: edit.var, expr: edit.expr, error: String(e && e.message || e) });
  }
}

// ---- Main pause loop -------------------------------------------------------

let lastCallFrames = null;

async function handlePaused(params) {
  if (stopFlag) {
    await post('Debugger.resume');
    return;
  }
  lastCallFrames = params.callFrames || [];
  await runtimeUpdateChain;
  // Don't snapshot in our own internal frames (e.g. the runner's bootstrap)
  const topUrl = lastCallFrames[0] && lastCallFrames[0].url;
  if (!topUrl || topUrl.indexOf('node:') === 0 || topUrl.indexOf('runner.js') !== -1) {
    await post('Debugger.stepInto');
    return;
  }

  if (totalSnapshots >= maxHistory) {
    if (!capWarned) {
      capWarned = true;
      send({ type: 'capReached', limit: maxHistory });
    }
    // Continue without recording further
    await post('Debugger.resume');
    return;
  }

  // Apply pre-recorded overrides keyed on snapshot index
  for (let i = 0; i < pendingOverrides.length; i++) {
    if (appliedOverrideIndices.has(i)) continue;
    const ov = pendingOverrides[i];
    if ((ov.snapshot_idx | 0) !== totalSnapshots) continue;
    await applyLiveEdit(ov);
    appliedOverrideIndices.add(i);
  }

  const reasonMap = { other: 'line', step: 'line', exception: 'exception' };
  const eventReason = reasonMap[params.reason] || 'line';
  const snap = await captureSnapshot(params, eventReason);
  snapshotBuffer.push(snap);
  totalSnapshots++;

  let surface = shouldSurfacePause(params);
  if (surface === 'exception') {
    surface = exceptionBreakpointMatches(snap);
  }
  if (!surface) {
    // Resume in a way that doesn't accidentally surface follow-on `step`
    // pauses for unrelated frames.
    if (params.reason === 'exception') {
      await post('Debugger.resume');
    } else {
      await post('Debugger.stepInto');
    }
    return;
  }

  // Pause for user
  send({ type: 'paused', snapshots: snapshotBuffer });
  snapshotBuffer = [];
  // Block until next command
  while (true) {
    const cmd = await awaitCommand();
    cmd._currentDepth = lastCallFrames.length;
    const didResume = await applyCommand(cmd);
    if (didResume) break;
  }
}

// ---- Boot ------------------------------------------------------------------

async function boot() {
  // Initial config. WebContainer stdin can behave like terminal input, so the
  // channel normally passes a JSON file path as argv[2]. The stdin line remains
  // as a fallback for older/manual launchers.
  const initLine = process.argv[2]
    ? fs.readFileSync(process.argv[2], 'utf8')
    : await readInitialLine();
  if (!initLine) {
    send({ type: 'debugComplete', exitCode: 1, error: 'no init config received' });
    process.exit(1);
  }
  cfg = JSON.parse(initLine);
  startCommandReader();
  watches = cfg.watches || [];
  opts = cfg.options || {};
  snapshotDepth = opts.snapshot_depth || 3;
  maxHistory = opts.max_history || 50000;
  filterGlobals = opts.filter_globals !== false;
  pendingOverrides = cfg.overrides || [];
  exceptionBreakpoints = cfg.exceptionBreakpoints || [];

  log('booted, entry=' + cfg.entry + ' watches=' + JSON.stringify(watches));

  // Inspector setup
  await post('Debugger.enable');
  await post('Runtime.enable');
  // 'all' so every raised exception (caught or not) becomes an exception
  // snapshot — that's the "every throw is a breakpoint" semantics the
  // Exception Breakpoint toolbar buttons navigate through.
  await post('Debugger.setPauseOnExceptions', { state: 'all' });

  // Set initial breakpoints
  for (const bp of (cfg.breakpoints || [])) {
    await applyBpChange({ op: 'add', file: bp.file, line: bp.line, condition: bp.condition, hitCount: bp.hitCount || bp.hit_count });
  }

  // Wire the paused handler. CDP delivers paused events while we run user code.
  session.on('Debugger.paused', (params) => {
    handlePaused(params).catch((e) => {
      send({ type: 'debuggerError', message: 'handlePaused error: ' + String(e && e.stack || e) });
    });
  });

  // Begin in stepInto mode so we record from the very first user line.
  userMode = 'stepInto';

  // Set sys.argv equivalent
  process.argv = [process.argv[0], cfg.entry].concat(cfg.args || []);

  // Run the user entry. require() resolves relative to runner.js's dir, so we
  // resolve to absolute path first.
  let exitCode = 0;
  try {
    const abs = path.resolve(cfg.entry);
    // Pause before requiring so we hit the first user line, then proceed.
    await post('Debugger.pause');
    require(abs);
  } catch (e) {
    // Surface as a final exception snapshot, then complete with non-zero exit.
    send({ type: 'log', msg: '[ttd-node] uncaught: ' + String(e && e.stack || e) });
    exitCode = 1;
  }
  if (cfg.serverMode && exitCode === 0) {
    send({ type: 'log', msg: '[ttd-node] server mode active; waiting for HTTP requests' });
    return;
  }
  send({ type: 'debugComplete', exitCode: exitCode });
  // Drain final stdout/stderr by giving the event loop a tick
  setImmediate(() => process.exit(exitCode));
}

boot().catch((e) => {
  send({ type: 'debugComplete', exitCode: 1, error: String(e && e.stack || e) });
  process.exit(1);
});
