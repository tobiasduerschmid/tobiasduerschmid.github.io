// Unit tests for js/debugger/gdb-channel.js — pure Node, no Playwright.
//
// Run from the repo root with: `node --test tests/unit/gdb-channel.test.js`.
//
// What we're pinning: the channel's contract with the existing controller
// protocol (onPaused / onDebugComplete / sendCommand) when an entire gdb
// session is fed in synthetically. Real gdb is not involved here — the
// vmIO is a mock that captures outbound text and lets the test push
// inbound bytes.
//
// Partitions covered:
//   - session bootstrap            → first prompt triggers breakpoint
//                                    install + `-exec-run`.
//   - breakpoint hit               → `*stopped,reason="breakpoint-hit"`
//                                    becomes `onPaused` with a frame-shaped
//                                    snapshot.
//   - normal program exit          → `*stopped,reason="exited-normally"`
//                                    becomes `onDebugComplete` (exitCode 0).
//   - non-zero exit                → exit-code is propagated.
//   - step / next / continue / quit→ each CMD is translated to the right
//                                    `-exec-*` / `-gdb-exit`.
//   - gdb-side error               → `^error,msg=...` reaches the controller
//                                    via `onDebuggerError`.
//   - inferior stdout              → `raw` (non-MI) lines are forwarded to
//                                    `onLog` so the learner still sees their
//                                    program's output.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { GdbChannel } = require('../../js/debugger/gdb-channel.js');

// ---------- fixtures -----------------------------------------------------

function makeController() {
  const calls = {
    paused: [], debugComplete: [], debuggerError: [], log: [], status: [],
  };
  return {
    _calls: calls,
    onPaused(msg)         { calls.paused.push(msg); },
    onDebugComplete(msg)  { calls.debugComplete.push(msg); },
    onDebuggerError(msg)  { calls.debuggerError.push(msg); },
    onLog(msg)            { calls.log.push(msg); },
    setStatus(s)          { calls.status.push(s); },
  };
}

function makeVmIO() {
  const writes = [];
  let listener = null;
  return {
    _writes: writes,
    _push(text)               { if (listener) listener(text); },
    write(text)               { writes.push(text); },
    onBytes(cb)               { listener = cb; },
    removeListener(cb)        { if (listener === cb) listener = null; },
  };
}

function attach(cfg) {
  const ctl = makeController();
  const io = makeVmIO();
  const ch = new GdbChannel(ctl, io);
  ch.install();
  ch.startSession(cfg || { executable: './hello' });
  return { ctl, io, ch };
}

// ---------- session bootstrap -------------------------------------------

test('startSession launches tutorial-gdb with the configured executable', () => {
  const { io } = attach({ executable: './my_prog' });
  assert.match(io._writes[0], /^tutorial-gdb '\.\/my_prog'\n$/);
});

test('the first (gdb) prompt installs configured breakpoints then runs -exec-run', () => {
  const { io } = attach({
    executable: './hello',
    breakpoints: [{ file: 'hello.c', line: 5 }, { file: 'hello.c', line: 8 }],
  });
  // Simulate gdb's startup: console banner, then the ready prompt.
  io._push('=thread-group-added,id="i1"\n');
  io._push('(gdb)\n');

  // First write was the tutorial-gdb launch; subsequent writes are the
  // MI commands the channel queued in response to the prompt.
  const mi = io._writes.slice(1);
  assert.equal(mi.length, 3);
  assert.match(mi[0], /^1-break-insert 'hello\.c':5\n$/);
  assert.match(mi[1], /^2-break-insert 'hello\.c':8\n$/);
  assert.match(mi[2], /^3-exec-run\n$/);
});

test('a *stopped breakpoint-hit becomes onPaused with the frame snapshot', () => {
  const { ctl, io } = attach({ executable: './hello', breakpoints: [{ file: 'hello.c', line: 3 }] });
  io._push('(gdb)\n');
  // gdb echoes the run, then the inferior pauses on the breakpoint.
  io._push('^running\n*running,thread-id="all"\n');
  io._push('*stopped,reason="breakpoint-hit",disp="keep",bkptno="1",frame={addr="0x80483f0",func="main",args=[{name="argc",value="1"}],file="hello.c",fullname="/tutorial/hello.c",line="3"},thread-id="1"\n');

  assert.equal(ctl._calls.paused.length, 1);
  const snap = ctl._calls.paused[0].snapshots[0];
  assert.equal(snap.line, 3);
  assert.equal(snap.file, '/tutorial/hello.c');
  assert.equal(snap.reason, 'breakpoint-hit');
  assert.equal(snap.stack.length, 1);
  assert.equal(snap.stack[0].function, 'main');
  assert.deepEqual(snap.stack[0].locals, {
    argc: { repr: '1', preview: '1' },
  });
});

test('a *stopped exited-normally becomes onDebugComplete with exitCode 0', () => {
  const { ctl, io } = attach();
  io._push('(gdb)\n');
  io._push('*stopped,reason="exited-normally"\n');
  assert.deepEqual(ctl._calls.debugComplete, [{ exitCode: 0 }]);
});

test('a *stopped exited carries the inferior\'s non-zero exit code', () => {
  const { ctl, io } = attach();
  io._push('(gdb)\n');
  io._push('*stopped,reason="exited",exit-code="2"\n');
  assert.deepEqual(ctl._calls.debugComplete, [{ exitCode: 2 }]);
});

// ---------- command translation -----------------------------------------

test.describe('sendCommand maps CMD codes to MI commands', () => {
  const cases = [
    [GdbChannel.CMD_CONTINUE, /-exec-continue/],
    [GdbChannel.CMD_STEP,     /-exec-step/],
    [GdbChannel.CMD_NEXT,     /-exec-next/],
    [GdbChannel.CMD_RETURN,   /-exec-finish/],
    [GdbChannel.CMD_QUIT,     /-gdb-exit/],
  ];
  for (const [code, pattern] of cases) {
    test('CMD code ' + code + ' → ' + pattern, () => {
      const { io, ch } = attach();
      io._push('(gdb)\n');                    // bootstrap so _exec-run goes out
      const before = io._writes.length;
      ch.sendCommand(code);
      const newWrites = io._writes.slice(before);
      assert.equal(newWrites.length, 1);
      assert.match(newWrites[0], pattern);
    });
  }
});

test('CMD_QUIT also tears down the session listener', () => {
  const { io, ch } = attach();
  io._push('(gdb)\n');
  ch.sendCommand(GdbChannel.CMD_QUIT);
  // Subsequent inbound bytes should not trigger any controller callback —
  // we end the session synchronously.
  const wasActive = ch._sessionActive;
  assert.equal(wasActive, false);
});

test('CMD_SYNC asks gdb to re-emit the current frame without advancing', () => {
  const { io, ch } = attach();
  io._push('(gdb)\n');
  const before = io._writes.length;
  ch.sendCommand(GdbChannel.CMD_SYNC);
  const newWrite = io._writes.slice(before).join('');
  assert.match(newWrite, /-stack-info-frame/);
});

// ---------- errors + IO ------------------------------------------------

test('a gdb ^error reaches the controller via onDebuggerError with the message', () => {
  const { ctl, io } = attach();
  io._push('(gdb)\n');
  io._push('1^error,msg="No symbol \\"foo\\" in current context."\n');
  assert.equal(ctl._calls.debuggerError.length, 1);
  assert.match(ctl._calls.debuggerError[0].message, /No symbol "foo"/);
});

test('inferior stdout (non-MI lines) is forwarded to onLog', () => {
  const { ctl, io } = attach();
  io._push('(gdb)\n');
  io._push('Hello from main()\n');
  // The line isn't an MI record and is surfaced as `raw`; the channel
  // routes raw to `onLog` so the learner sees their program's output.
  assert.equal(ctl._calls.log.length, 1);
  assert.equal(ctl._calls.log[0].text, 'Hello from main()');
  assert.equal(ctl._calls.log[0].stream, 'raw');
});

test('subsequent (gdb) prompts after the first do NOT re-trigger -exec-run', () => {
  const { io } = attach({ breakpoints: [{ file: 'hello.c', line: 3 }] });
  io._push('(gdb)\n');                        // first prompt → run
  io._push('*stopped,reason="end-stepping-range",frame={file="hello.c",fullname="/tutorial/hello.c",line="3",func="main"}\n');
  io._push('(gdb)\n');                        // gdb is ready for next cmd
  // No new MI commands should have been sent in response to the second prompt.
  const runs = io._writes.filter(w => /-exec-run/.test(w));
  assert.equal(runs.length, 1);
});

test('the channel rejects setup without a controller or vmIO', () => {
  assert.throws(() => new GdbChannel(null, makeVmIO()), /controller is required/);
  assert.throws(() => new GdbChannel(makeController(), {}), /must provide write/);
});
