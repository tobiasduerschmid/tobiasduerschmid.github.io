// @ts-check
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('@playwright/test');

const repoRoot = path.resolve(__dirname, '..');
const CHANNEL_LAYOUT = {
  SAB_HEADER_BYTES: 64,
  WATCH_REGION_BYTES: 32 * 1024,
  BPS_REGION_BYTES: 32 * 1024,
  EDITS_REGION_BYTES: 32 * 1024,
  EXCBPS_REGION_BYTES: 32 * 1024,
  SLOT_EDITS_LEN: 6,
  SLOT_EXCBPS_DIRTY: 7,
  SLOT_EXCBPS_LEN: 8,
};
CHANNEL_LAYOUT.WATCH_OFF = CHANNEL_LAYOUT.SAB_HEADER_BYTES;
CHANNEL_LAYOUT.BPS_OFF = CHANNEL_LAYOUT.WATCH_OFF + CHANNEL_LAYOUT.WATCH_REGION_BYTES;
CHANNEL_LAYOUT.EDITS_OFF = CHANNEL_LAYOUT.BPS_OFF + CHANNEL_LAYOUT.BPS_REGION_BYTES;
CHANNEL_LAYOUT.EXCBPS_OFF = CHANNEL_LAYOUT.EDITS_OFF + CHANNEL_LAYOUT.EDITS_REGION_BYTES;
CHANNEL_LAYOUT.SAB_TOTAL_BYTES = CHANNEL_LAYOUT.EXCBPS_OFF + CHANNEL_LAYOUT.EXCBPS_REGION_BYTES;

function loadScriptInVm(relativePath, extra = {}) {
  const messages = [];
  const sandbox = {
    console,
    TextDecoder,
    TextEncoder,
    SharedArrayBuffer,
    ArrayBuffer,
    Int32Array,
    Uint8Array,
    Atomics,
    setTimeout,
    clearTimeout,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    WeakMap,
    Set,
    Error,
    Function,
    isFinite,
    parseInt,
    self: {
      postMessage: msg => messages.push(msg),
      addEventListener: () => {},
    },
    window: {},
    ...extra,
  };
  sandbox.self.self = sandbox.self;
  sandbox.self.window = sandbox.window;
  sandbox.messages = messages;
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  vm.runInNewContext(source, sandbox, { filename: relativePath });
  return sandbox;
}

function writeSharedJson(u8, i32, offset, lenSlot, dirtySlot, value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  u8.set(bytes, offset);
  Atomics.store(i32, lenSlot, bytes.length);
  Atomics.store(i32, dirtySlot, 1);
}

function readSharedJson(u8, i32, offset, lenSlot) {
  const len = Atomics.load(i32, lenSlot);
  const bytes = u8.slice(offset, offset + len);
  return JSON.parse(new TextDecoder().decode(bytes));
}

test.describe('debugger runtime robustness', () => {
  test('browser runtime evaluates watches and conditions inside captured scope', () => {
    const sandbox = loadScriptInVm('js/debugger/browser/runtime.js');

    const result = sandbox.evalInScope('x + y', () => ({ x: 2, y: 3 }));
    expect(result).toBe(5);
  });

  test('browser runtime consumes dynamic exception breakpoint updates from shared memory', () => {
    const sandbox = loadScriptInVm('js/debugger/browser/runtime.js');
    const sab = new SharedArrayBuffer(sandbox.EXCBPS_OFF + sandbox.EXCBPS_REGION_BYTES);
    sandbox.i32 = new Int32Array(sab);
    sandbox.u8 = new Uint8Array(sab);
    const next = [{ id: 7, enabled: true, type: 'TypeError', mode: 'all' }];

    writeSharedJson(
      sandbox.u8,
      sandbox.i32,
      sandbox.EXCBPS_OFF,
      sandbox.SLOT_EXCBPS_LEN,
      sandbox.SLOT_EXCBPS_DIRTY,
      next
    );

    sandbox.drainPendingUpdates(() => ({}));

    expect(sandbox.exceptionBreakpoints).toEqual(next);
    expect(Atomics.load(sandbox.i32, sandbox.SLOT_EXCBPS_DIRTY)).toBe(0);
  });

  test('browser channel preserves queued live edits and writes exception breakpoint updates', () => {
    const sandbox = loadScriptInVm('js/debugger/browser-channel.js');
    const Channel = sandbox.window.SEBookBrowserChannel;
    const channel = new Channel({}, {});
    const sab = new SharedArrayBuffer(CHANNEL_LAYOUT.SAB_TOTAL_BYTES);
    channel.i32 = new Int32Array(sab);
    channel.u8 = new Uint8Array(sab);

    expect(channel.sendLiveEdits([{ var: 'a', expr: '1' }])).toBe(true);
    expect(channel.sendLiveEdits([{ var: 'b', expr: '2' }])).toBe(true);
    expect(readSharedJson(channel.u8, channel.i32, CHANNEL_LAYOUT.EDITS_OFF, CHANNEL_LAYOUT.SLOT_EDITS_LEN))
      .toEqual([{ var: 'a', expr: '1' }, { var: 'b', expr: '2' }]);

    const exceptionBreakpoints = [{ id: 3, enabled: false, type: '', mode: 'uncaught' }];
    expect(channel.sendExceptionBreakpoints(exceptionBreakpoints)).toBe(true);
    expect(Atomics.load(channel.i32, CHANNEL_LAYOUT.SLOT_EXCBPS_DIRTY)).toBe(1);
    expect(readSharedJson(channel.u8, channel.i32, CHANNEL_LAYOUT.EXCBPS_OFF, CHANNEL_LAYOUT.SLOT_EXCBPS_LEN))
      .toEqual(exceptionBreakpoints);
  });
});
