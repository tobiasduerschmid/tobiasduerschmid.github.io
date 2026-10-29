const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../js/tutorial-code.js'), 'utf8');

// Only browser transport/DOM and the clock are controlled. The actual preview
// builder, generation checks, broker handshake and lifecycle run unchanged.
function createPreview() {
  let now = 0;
  let timerId = 0;
  const timers = new Map();
  const sandbox = {
    document: { cookie: '', documentElement: { classList: { contains: () => false } } },
    console, AbortController, TextEncoder, btoa,
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    clearInterval() {},
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'tutorial-code.js' });
  const tutorial = new sandbox.TutorialCode({ querySelector: () => null }, {
    backend: 'react', steps: [{ files: [] }],
  });
  const container = {
    replaceChild(replacement) { replacement.parentNode = this; },
  };
  function frame() {
    return {
      parentNode: container,
      contentWindow: { messages: [], postMessage(message) { this.messages.push(message); } },
      cloneNode: frame,
      removeAttribute() {},
      addEventListener() {},
      removeEventListener() {},
    };
  }
  tutorial._previewFrame = frame();

  function begin(options) {
    const outcomes = [];
    tutorial._rebuildReactPreview(error => outcomes.push(error || null), undefined, undefined, options);
    const generation = tutorial._reactPreviewGeneration;
    const sourceWindow = tutorial._previewFrame.contentWindow;
    return {
      outcomes,
      ready() { tutorial._markReactPreviewReady(generation); },
      broker() {
        const listeners = new Set();
        const port = {
          closed: false,
          messages: [],
          start() {},
          close() { this.closed = true; },
          addEventListener(_type, listener) { listeners.add(listener); },
          removeEventListener(_type, listener) { listeners.delete(listener); },
          postMessage(message) { this.messages.push(message); },
          listenerCount: () => listeners.size,
          reply(message) { for (const listener of listeners) listener({ data: message }); },
        };
        tutorial._acceptReactAssertionBroker({ source: sourceWindow, ports: [port] }, { generation });
        return port;
      },
    };
  }

  return {
    tutorial, begin,
    timerCount: () => timers.size,
    advance(milliseconds) {
      const until = now + milliseconds;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= until)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next;
        timers.delete(id);
        now = timer.at;
        timer.callback();
      }
      now = until;
    },
  };
}

for (const first of ['ready', 'broker']) {
  test(`preview waits for both render and broker when ${first} arrives first`, () => {
    const runtime = createPreview();
    const preview = runtime.begin();
    preview[first]();
    runtime.advance(3000);
    assert.deepEqual(preview.outcomes, [], 'a slow bootstrap must never be treated as successful');

    preview[first === 'ready' ? 'broker' : 'ready']();
    assert.deepEqual(preview.outcomes, [null], 'ready previews must not pay an extra fixed delay');
    assert.equal(runtime.timerCount(), 0);
    runtime.advance(20_000);
    assert.deepEqual(preview.outcomes, [null], 'completion must happen exactly once');
  });
}

test('preview deadline fails explicitly and late readiness cannot turn it into success', () => {
  const runtime = createPreview();
  const preview = runtime.begin({ timeoutMs: 100 });
  preview.broker();
  runtime.advance(99);
  assert.deepEqual(preview.outcomes, []);
  runtime.advance(1);
  assert.equal(preview.outcomes.length, 1);
  assert.match(preview.outcomes[0].message, /timed out/);
  preview.ready();
  assert.equal(preview.outcomes.length, 1);
  assert.equal(runtime.timerCount(), 0);
});

test('replacing a preview cancels its wait and rejects obsolete broker traffic', () => {
  const runtime = createPreview();
  const previous = runtime.begin();
  const current = runtime.begin();
  assert.equal(previous.outcomes.length, 1);
  assert.match(previous.outcomes[0].message, /replaced/);
  assert.equal(previous.broker().closed, true);
  previous.ready();
  assert.deepEqual(current.outcomes, []);
  current.broker();
  current.ready();
  assert.deepEqual(current.outcomes, [null]);
  assert.equal(runtime.timerCount(), 0);
});

test('aborting a pending preview settles once and permits a later successful preview', () => {
  const runtime = createPreview();
  const controller = new AbortController();
  const cancelled = runtime.begin({ signal: controller.signal });
  controller.abort();
  assert.equal(cancelled.outcomes.length, 1);
  assert.match(cancelled.outcomes[0].message, /cancelled/);
  assert.equal(runtime.timerCount(), 0);
  cancelled.ready();
  cancelled.broker();
  const current = runtime.begin();
  current.broker();
  current.ready();
  assert.deepEqual(current.outcomes, [null]);
  assert.equal(cancelled.outcomes.length, 1);
});

test('an already aborted request preserves the active preview and settles immediately', () => {
  const runtime = createPreview();
  const current = runtime.begin();
  const controller = new AbortController();
  controller.abort();
  const cancelled = runtime.begin({ signal: controller.signal });
  assert.equal(cancelled.outcomes.length, 1);
  assert.match(cancelled.outcomes[0].message, /cancelled/);
  current.broker();
  current.ready();
  assert.deepEqual(current.outcomes, [null]);
  assert.equal(runtime.timerCount(), 0);
});

test('destroying the tutorial rejects a pending preview instead of leaving its caller hanging', () => {
  const runtime = createPreview();
  const preview = runtime.begin();
  runtime.tutorial.destroy();
  assert.equal(preview.outcomes.length, 1);
  assert.match(preview.outcomes[0].message, /destroyed/);
  assert.equal(runtime.timerCount(), 0);
  const unavailable = runtime.begin();
  assert.equal(unavailable.outcomes.length, 1);
  assert.match(unavailable.outcomes[0].message, /unavailable/);
});

test('replacing a broker rejects all pending assertions immediately and a later broker recovers', async () => {
  const runtime = createPreview();
  const previous = runtime.begin();
  const port = previous.broker();
  previous.ready();
  const context = { code: '', files: {} };
  const pending = [0, 1].map(() => assert.rejects(
    runtime.tutorial._runReactAssertionInPreview({ command: 'await new Promise(() => {});' }, context),
    /preview was closed/,
  ));
  const current = runtime.begin();
  await Promise.all(pending);
  assert.equal(port.closed, true);
  assert.equal(port.listenerCount(), 0, 'cancelled requests must release their port listeners');
  const replacement = current.broker();
  current.ready();
  assert.equal(runtime.timerCount(), 0, 'closed requests must release their deadlines');

  const completed = runtime.tutorial._runReactAssertionInPreview({ command: 'assert(true);' }, context);
  // A result queued by the previous document must not settle a new request.
  port.reply({ type: 'result', id: port.messages[0].id, passed: false, error: 'obsolete result' });
  replacement.reply({ type: 'result', id: replacement.messages[0].id, passed: true });
  await completed;
  assert.equal(replacement.listenerCount(), 0);
  assert.equal(runtime.timerCount(), 0);
});

test('assertion timeout rejects and releases its message listener before broker closure', async () => {
  const runtime = createPreview();
  const preview = runtime.begin();
  const port = preview.broker();
  preview.ready();
  const timedOut = assert.rejects(runtime.tutorial._runReactAssertionInPreview(
    { command: 'await new Promise(() => {});' }, { code: '', files: {} },
  ), /timed out/);
  runtime.advance(60_000);
  await timedOut;
  assert.equal(port.listenerCount(), 0);
  assert.equal(runtime.timerCount(), 0);
  runtime.tutorial._closeReactAssertionBroker();
});

test('assertion transport failure rejects and releases the request deadline and listener', async () => {
  const runtime = createPreview();
  const preview = runtime.begin();
  const port = preview.broker();
  preview.ready();
  port.postMessage = () => { throw new Error('port send failed'); };
  await assert.rejects(runtime.tutorial._runReactAssertionInPreview(
    { command: 'assert(true);' }, { code: '', files: {} },
  ), /port send failed/);
  assert.equal(port.listenerCount(), 0);
  assert.equal(runtime.timerCount(), 0);
  runtime.tutorial._closeReactAssertionBroker();
});

for (const [owner, label] of [
  ['_studentPlaywrightRun', 'learner Playwright tests'],
  ['_activeTestRun', 'a React assessment'],
  ['_playwrightRunController', 'standalone Playwright execution'],
]) {
  test(`saving during ${label} leaves the tested app intact and later patches the latest source`, () => {
    const runtime = createPreview();
    const preview = runtime.begin();
    preview.broker();
    preview.ready();
    let source = 'function App() { return "original source"; }';
    runtime.tutorial.steps[0].files = [{ path: 'App.jsx' }];
    runtime.tutorial.editorModels['App.jsx'] = { model: { getValue: () => source } };
    const transport = runtime.tutorial._previewFrame.contentWindow;
    runtime.tutorial[owner] = {};
    runtime.tutorial._patchReactPreview();
    source = 'function App() { return "latest source"; }';
    runtime.tutorial._patchReactPreview();
    assert.equal(transport.messages.length, 0, 'saving must not replace or reset an app under test');

    runtime.tutorial[owner] = null;
    runtime.tutorial._patchReactPreview();
    assert.equal(transport.messages.length, 1);
    assert.match(transport.messages[0].files.join('\n'), /latest source/);
    assert.doesNotMatch(transport.messages[0].files.join('\n'), /original source/);
  });
}

test('an external preview refresh cancels the owning test before replacing its frame', () => {
  const runtime = createPreview();
  const controller = new AbortController();
  const run = { cancelled: false };
  runtime.tutorial._playwrightRunController = controller;
  runtime.tutorial._studentPlaywrightRun = run;
  const previous = runtime.begin({ testRun: true, signal: controller.signal });
  const replacement = runtime.begin();
  assert.equal(controller.signal.aborted, true);
  assert.equal(run.cancelled, true);
  assert.equal(previous.outcomes.length, 1);
  assert.match(previous.outcomes[0].message, /cancelled/);
  replacement.broker();
  replacement.ready();
  assert.deepEqual(replacement.outcomes, [null]);
});

test('an internal test reset preserves its owning run', () => {
  const runtime = createPreview();
  const controller = new AbortController();
  const run = { cancelled: false };
  runtime.tutorial._playwrightRunController = controller;
  runtime.tutorial._studentPlaywrightRun = run;
  const preview = runtime.begin({ testRun: true, signal: controller.signal });
  preview.broker();
  preview.ready();
  assert.equal(controller.signal.aborted, false);
  assert.equal(run.cancelled, false);
  assert.deepEqual(preview.outcomes, [null]);
});

test('restoring current source consumes old saves but preserves a new save during bootstrap', () => {
  const runtime = createPreview();
  let source = 'function App() { return "saved before restore"; }';
  runtime.tutorial.steps[0].files = [{ path: 'App.jsx' }];
  runtime.tutorial.editorModels['App.jsx'] = { model: { getValue: () => source } };
  runtime.tutorial._activeTestRun = {};
  runtime.tutorial._patchReactPreview();
  const restored = runtime.begin({ testRun: true });
  assert.match(runtime.tutorial._previewFrame.srcdoc, /saved before restore/);
  assert.equal(runtime.tutorial._reactPatchDeferred, false, 'the restore already includes the earlier save');

  source = 'function App() { return "saved during bootstrap"; }';
  runtime.tutorial._patchReactPreview();
  restored.broker();
  restored.ready();
  runtime.tutorial._activeTestRun = null;
  // The host flushes only when a save is still pending after releasing a run.
  if (runtime.tutorial._reactPatchDeferred) runtime.tutorial._patchReactPreview();
  const messages = runtime.tutorial._previewFrame.contentWindow.messages;
  assert.equal(messages.length, 1);
  assert.match(messages[0].files.join('\n'), /saved during bootstrap/);
});
