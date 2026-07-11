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
    URL,
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

  test('Stop terminates a wedged browser runtime and the next debug run starts cleanly', async () => {
    const workers = [];
    class WedgableWorker {
      constructor() {
        this.terminated = false;
        workers.push(this);
      }

      addEventListener(type, listener) {
        this[type] = listener;
      }

      postMessage() {
        // The first learner runtime represents synchronous infinite code: it
        // accepts messages but never returns to its event loop to process them.
      }

      terminate() {
        this.terminated = true;
      }

      complete() {
        this.message({
          data: {
            __ttd: true,
            payload: { type: 'debugComplete', exitCode: 0 },
          },
        });
      }
    }

    const sandbox = loadScriptInVm('js/debugger/browser-channel.js', {
      Worker: WedgableWorker,
    });
    sandbox.window.SharedArrayBuffer = SharedArrayBuffer;
    sandbox.window.crossOriginIsolated = true;

    let channel;
    const completions = [];
    const controller = {
      state: 'idle',
      onDebugComplete(message) {
        this.state = 'idle';
        completions.push(message);
        channel.dispose();
      },
    };
    const Channel = sandbox.window.SEBookBrowserChannel;
    channel = new Channel(controller, {});
    const start = () => {
      controller.state = 'running';
      channel.startSession({
        filename: '/tutorial/app.js',
        code: 'while (true) {}',
        files: {},
      });
    };

    start();
    const wedgedWorker = workers[0];
    channel.sendCommand(5);

    expect(wedgedWorker.terminated).toBe(true);
    start();
    const nextWorker = workers[1];
    expect(nextWorker).toBeDefined();
    expect(nextWorker.terminated).toBe(false);
    await new Promise(resolve => setImmediate(resolve));
    expect(controller.state).toBe('running');
    expect(completions).toHaveLength(0);

    wedgedWorker.complete();
    await Promise.resolve();
    expect(controller.state).toBe('running');
    expect(completions).toHaveLength(0);

    channel.sendCommand(5);
    expect(nextWorker.terminated).toBe(true);
    await new Promise(resolve => setImmediate(resolve));
    expect(controller.state).toBe('idle');
    expect(completions).toEqual([{ exitCode: 0, stopped: true }]);

    start();
    const freshWorker = workers[2];
    freshWorker.complete();
    expect(controller.state).toBe('idle');
    expect(completions).toHaveLength(2);
    expect(freshWorker.terminated).toBe(true);
  });

  test('browser channel forwards HTTP requests to the debug worker and dispatches responses', () => {
    const handled = [];
    const workerMessages = [];
    const sandbox = loadScriptInVm('js/debugger/browser-channel.js');
    const Channel = sandbox.window.SEBookBrowserChannel;
    const channel = new Channel({}, {
      _handleHttpResponse: msg => handled.push(msg),
    });
    channel.worker = { postMessage: msg => workerMessages.push(msg) };

    expect(channel.sendHttpRequest({
      method: 'POST',
      url: 'http://localhost:3000/students',
      body: '{"name":"Ada"}',
    })).toBe(true);

    expect(workerMessages).toEqual([{
      __ttd_http_request: true,
      request: {
        method: 'POST',
        url: 'http://localhost:3000/students',
        body: '{"name":"Ada"}',
      },
    }]);

    channel._dispatchMessage({ type: 'http_response', status: 201, body: '{"ok":true}' });
    expect(handled).toEqual([{ type: 'http_response', status: 201, body: '{"ok":true}' }]);
  });

  test('browser runtime serves Express routes over debugger HTTP messages', () => {
    const sandbox = loadScriptInVm('js/debugger/browser/runtime.js');
    sandbox.setupNodeMocks({});
    const express = sandbox.self.require('express');
    const app = express();
    app.use(express.json());
    app.get('/students/:id', (req, res) => {
      res.json({ id: req.params.id, passing: req.query.passing });
    });
    app.post('/students', (req, res) => {
      res.status(201).json({ received: req.body });
    });
    app.listen(3000);

    sandbox.handleHttpRequest({
      method: 'GET',
      url: 'http://localhost:3000/students/42?passing=true',
    });
    sandbox.handleHttpRequest({
      method: 'POST',
      url: 'http://localhost:3000/students',
      body: '{"name":"Ada","grade":99}',
    });

    const responses = sandbox.messages
      .map(msg => msg && msg.payload)
      .filter(msg => msg && msg.type === 'http_response');
    expect(responses).toHaveLength(2);
    expect(responses[0]).toMatchObject({
      status: 200,
      body: JSON.stringify({ id: '42', passing: 'true' }, null, 2),
    });
    expect(responses[1]).toMatchObject({
      status: 201,
      body: JSON.stringify({ received: { name: 'Ada', grade: 99 } }, null, 2),
    });
  });

  test('browser runtime instruments required JavaScript modules with tutorial paths', () => {
    const sandbox = loadScriptInVm('js/debugger/browser/runtime.js');
    const instrumented = [];
    sandbox.self.__ttdInstrument = (source, file) => {
      instrumented.push({ source, file });
      return `exports.__instrumentedFile = ${JSON.stringify(file)};\n${source}`;
    };

    sandbox.setupNodeMocks({
      '/tutorial/studentRoutes.js': 'exports.answer = 42;',
    });

    const mod = sandbox.self.require('./studentRoutes');
    const cached = sandbox.self.require('./studentRoutes.js');

    expect(mod).toEqual({ __instrumentedFile: '/tutorial/studentRoutes.js', answer: 42 });
    expect(cached).toBe(mod);
    expect(instrumented).toEqual([{
      source: 'exports.answer = 42;',
      file: '/tutorial/studentRoutes.js',
    }]);
  });

  test('browser instrumenter turns debugger statements into forced debugger pauses', () => {
    const sandbox = loadScriptInVm('js/debugger/browser/instrument.js', {
      self: {
        postMessage: () => {},
        addEventListener: () => {},
        acorn: {
          parse: () => ({
            body: [{
              type: 'DebuggerStatement',
              start: 0,
              end: 'debugger;'.length,
              loc: { start: { line: 1, column: 0 } },
            }],
          }),
        },
      },
    });

    const out = sandbox.self.__ttdInstrument('debugger;', '/tutorial/app.js');

    expect(out).toContain('__ttd.onLine("/tutorial/app.js", 1, function () { return {}; }, true);');
    expect(out).toContain('debugger;');
  });

  test('browser instrumenter instruments callback bodies inside route registrations', () => {
    const source = "router.get('/', (req, res) => {\n  res.json(students);\n});";
    const arrowStart = source.indexOf('(req, res)');
    const bodyStart = source.indexOf('{');
    const bodyEnd = source.lastIndexOf('}') + 1;
    const handlerStart = source.indexOf('res.json');
    const sandbox = loadScriptInVm('js/debugger/browser/instrument.js', {
      self: {
        postMessage: () => {},
        addEventListener: () => {},
        acorn: {
          parse: () => ({
            body: [{
              type: 'ExpressionStatement',
              start: 0,
              end: source.length,
              loc: { start: { line: 1, column: 0 } },
              expression: {
                type: 'CallExpression',
                arguments: [{
                  type: 'ArrowFunctionExpression',
                  start: arrowStart,
                  end: bodyEnd,
                  id: null,
                  params: [{ type: 'Identifier', name: 'req' }, { type: 'Identifier', name: 'res' }],
                  loc: { start: { line: 1, column: arrowStart } },
                  body: {
                    type: 'BlockStatement',
                    start: bodyStart,
                    end: bodyEnd,
                    loc: { start: { line: 1, column: bodyStart } },
                    body: [{
                      type: 'ExpressionStatement',
                      start: handlerStart,
                      end: source.indexOf(';', handlerStart) + 1,
                      loc: { start: { line: 2, column: 2 } },
                      expression: { type: 'CallExpression', arguments: [] },
                    }],
                  },
                }],
              },
            }],
          }),
        },
      },
    });

    const out = sandbox.self.__ttdInstrument(source, '/tutorial/studentRoutes.js');

    expect(out).toContain('__ttd.onCall("<anonymous>", "/tutorial/studentRoutes.js", 1);');
    expect(out).toContain('__ttd.onLine("/tutorial/studentRoutes.js", 2,');
  });

  test('browser runtime surfaces forced line pauses without a breakpoint', () => {
    const sandbox = loadScriptInVm('js/debugger/browser/runtime.js');
    const sab = new SharedArrayBuffer(sandbox.EXCBPS_OFF + sandbox.EXCBPS_REGION_BYTES);
    sandbox.i32 = new Int32Array(sab);
    sandbox.u8 = new Uint8Array(sab);
    Atomics.store(sandbox.i32, 0, 1);

    sandbox.onLine('/tutorial/studentRoutes.js', 13, () => ({ students: [1, 2, 3] }), true);

    const paused = sandbox.messages
      .map(msg => msg && msg.payload)
      .filter(msg => msg && msg.type === 'paused');
    expect(paused).toHaveLength(1);
    expect(paused[0].snapshots[0]).toMatchObject({
      file: '/tutorial/studentRoutes.js',
      line: 13,
    });
  });

  test('debugger chrome stays discoverable without cross-origin isolation', async ({ page }) => {
    await page.setContent(`
      <div class="tvm-root">
        <div class="tvm-instructions-panel">
          <div class="tvm-steps-view"><div class="tvm-step-nav-bar"></div></div>
        </div>
        <div class="tvm-output-actions">
          <button class="tvm-run-btn" type="button">Run</button>
        </div>
      </div>
    `);
    await page.addScriptTag({ path: path.join(repoRoot, 'js/debugger/main.js') });

    await page.evaluate(() => {
      window.SEBookDebugger.attach({
        root: document.querySelector('.tvm-root'),
      });
    });

    await expect(page.locator('.tvm-left-tab[data-panel="dbg-unavailable"]')).toBeVisible();
    await expect(page.locator('.tvm-debug-btn-unavailable')).toBeVisible();

    await page.locator('.tvm-debug-btn-unavailable').click();
    const unavailableView = page.getByLabel('Debugger availability');
    await expect(unavailableView).toBeVisible();
    await expect(unavailableView.getByRole('button', { name: /reload to activate debugger/i })).toBeVisible();
    await expect(unavailableView).toContainText('full browser preview');
  });
});
