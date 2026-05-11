// Unit tests for js/debugger/react-channel.js — pure Node, no Playwright.
//
// Run from the repo root with: `node --test tests/unit/react-channel.test.js`.
//
// What we're pinning: the channel's contract with the existing controller
// protocol when fed iframe trace events. The tracer / iframe / React are
// faked — we push messages through the channel's internal handler.
//
// Partitions covered:
//   - line events buffer until a commit boundary, then ship together
//   - line events ship immediately when show_all_renders is true
//   - a render that posts events but never commits: events are dropped
//     (we still expect zero `paused` calls from those buffered events)
//   - `done` events trigger `onDebugComplete` and tear down the listener
//   - CMD_QUIT tears down without requiring a done message
//   - the channel rejects construction without a controller

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// ---- minimal DOM-event-target shim --------------------------------------
//
// The channel listens on `window.addEventListener('message', ...)`. We give
// it a tiny shim that captures handlers and provides a `_post(event)`
// helper to drive them.
function installWindow() {
  const handlers = [];
  global.window = {
    addEventListener(type, cb) { if (type === 'message') handlers.push(cb); },
    removeEventListener(type, cb) {
      const i = handlers.indexOf(cb);
      if (i >= 0) handlers.splice(i, 1);
    },
    _post(event) {
      // Snapshot the list so a handler that removes itself doesn't skip the rest.
      const live = handlers.slice();
      for (const h of live) h({ data: event });
    },
    _handlerCount() { return handlers.length; },
  };
}

// Import after window is set up so the UMD wrapper picks it up cleanly.
function loadChannelModule() {
  delete require.cache[require.resolve('../../js/debugger/react-channel.js')];
  return require('../../js/debugger/react-channel.js');
}

function makeController() {
  const calls = { paused: [], debugComplete: [], status: [] };
  return {
    _calls: calls,
    onPaused(msg)        { calls.paused.push(msg); },
    onDebugComplete(msg) { calls.debugComplete.push(msg); },
    setStatus(s)         { calls.status.push(s); },
  };
}

function attach(opts) {
  installWindow();
  const { ReactChannel } = loadChannelModule();
  const ctl = makeController();
  const tut = { _reactFrame: null, debuggerOptions: (opts && opts.debuggerOptions) || {} };
  const ch = new ReactChannel(ctl, tut);
  ch.install();
  ch.startSession({ options: { debuggerOptions: tut.debuggerOptions } });
  return { ctl, ch };
}

function lineEvent(file, line) {
  return { tag: 'sebook-react-debugger', event: { type: 'line', file, line, scope: null } };
}

function phaseEvent(phase) {
  return { tag: 'sebook-react-debugger', event: { type: 'phase', phase } };
}

function doneEvent(exitCode = 0) {
  return { tag: 'sebook-react-debugger', event: { type: 'done', exitCode } };
}

// ---- behavioural tests ---------------------------------------------------

test('line events buffer until commit, then ship in one onPaused call', () => {
  const { ctl } = attach();
  window._post(lineEvent('App.jsx', 3));
  window._post(lineEvent('App.jsx', 4));
  // Pre-commit: nothing should have been delivered to the controller yet.
  assert.equal(ctl._calls.paused.length, 0);

  window._post(phaseEvent('commit'));
  // Post-commit: a single onPaused with both snapshots.
  assert.equal(ctl._calls.paused.length, 1);
  const snaps = ctl._calls.paused[0].snapshots;
  assert.equal(snaps.length, 2);
  assert.equal(snaps[0].line, 3);
  assert.equal(snaps[1].line, 4);
  assert.equal(snaps[0].file, 'App.jsx');
});

test('show_all_renders=true ships each line event immediately (no commit needed)', () => {
  const { ctl } = attach({ debuggerOptions: { show_all_renders: true } });
  // With show_all_renders, the iframe-side filter is disabled — events are
  // pushed up immediately. The channel still buffers parent-side per
  // commit; what we're verifying is that line events accumulate without
  // requiring a commit before any onPaused fires (commit is a flush point,
  // not a gate).
  window._post(lineEvent('App.jsx', 5));
  window._post(lineEvent('App.jsx', 6));
  window._post(phaseEvent('commit'));
  assert.equal(ctl._calls.paused.length, 1);
  assert.deepEqual(
    ctl._calls.paused[0].snapshots.map(s => s.line),
    [5, 6],
  );
});

test('a render that posts events but is aborted never produces onPaused', () => {
  // The iframe-side tracer is responsible for filtering aborted-render
  // events — by the time the channel sees a message, the abort already
  // discarded the buffered events. So the channel observes: line events,
  // line events, [no commit, no events because they were dropped iframe-
  // side], then another render that DOES commit.
  const { ctl } = attach();
  // First render (aborted, no events from iframe).
  // Second render (committed):
  window._post(lineEvent('App.jsx', 9));
  window._post(phaseEvent('commit'));
  assert.equal(ctl._calls.paused.length, 1);
  assert.equal(ctl._calls.paused[0].snapshots.length, 1);
  assert.equal(ctl._calls.paused[0].snapshots[0].line, 9);
});

test('a done event flushes the buffer, fires onDebugComplete, removes the listener', () => {
  const { ctl } = attach();
  window._post(lineEvent('App.jsx', 12));
  window._post(doneEvent(0));
  // Buffer flushed → one onPaused with the line event…
  assert.equal(ctl._calls.paused.length, 1);
  assert.equal(ctl._calls.paused[0].snapshots[0].line, 12);
  // …and the session completes.
  assert.deepEqual(ctl._calls.debugComplete, [{ exitCode: 0 }]);
  // Listener torn down.
  assert.equal(window._handlerCount(), 0);
});

test('done propagates non-zero exit codes', () => {
  const { ctl } = attach();
  window._post(doneEvent(2));
  assert.deepEqual(ctl._calls.debugComplete, [{ exitCode: 2 }]);
});

test('CMD_QUIT tears down the listener even without a done message', () => {
  const { ch } = attach();
  ch.sendCommand(4 /* CMD_QUIT */);
  assert.equal(window._handlerCount(), 0);
});

test('the channel rejects construction without a controller', () => {
  installWindow();
  const { ReactChannel } = loadChannelModule();
  assert.throws(() => new ReactChannel(null, {}), /controller is required/);
});

test('messages without the SEBook iframe tag are ignored', () => {
  const { ctl } = attach();
  window._post({ tag: 'other', event: { type: 'line', file: 'x', line: 1 } });
  window._post({ data: 'whatever' });
  // Random messages must not produce snapshots.
  assert.equal(ctl._calls.paused.length, 0);
});
