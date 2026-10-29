const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../js/tutorial-code.js'), 'utf8');
const flush = () => new Promise(setImmediate);

// The real tutorial owns lifecycle/RPC behavior. Only the browser Worker and
// clock boundaries are controlled so delayed messages and deadlines are exact.
function createRuntime(backend, options = {}) {
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const workers = [];
  class Worker {
    constructor() {
      if (options.constructorError) throw new Error(options.constructorError);
      this.messages = [];
      this.terminated = false;
      workers.push(this);
    }
    postMessage(message) { this.messages.push(message); }
    terminate() { this.terminated = true; }
    emit(message) { this.onmessage({ data: message }); }
    fail(message) { this.onerror({ message }); }
  }
  const sandbox = {
    document: { cookie: '' }, AbortController, TextEncoder, TextDecoder, btoa, Worker,
    console,
    requestAnimationFrame(callback) { callback(); },
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    clearInterval() {},
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'tutorial-code.js' });
  const tutorial = new sandbox.TutorialCode({ querySelector: () => null }, { backend });
  tutorial.setupCommands = options.setup || [];
  if (backend === 'haskell') tutorial._createHaskellExecutor = () => new Worker();
  const output = [];
  tutorial._appendOutput = text => output.push(text);
  return {
    tutorial, workers, output,
    timerCount: () => timers.size,
    async tick(duration) {
      const end = now + duration;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next;
        timers.delete(id);
        now = timer.at;
        timer.callback();
        await flush();
      }
      now = end;
      await flush();
    },
  };
}

function observe(promise) {
  const outcome = { status: 'pending' };
  promise.then(
    () => { outcome.status = 'fulfilled'; },
    error => { outcome.status = 'rejected'; outcome.error = error; },
  );
  return outcome;
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

for (const phase of ['API loading', 'runtime boot']) {
  test(`disposing WebContainer during ${phase} settles immediately and prevents browser fallback`, async () => {
    const runtime = createRuntime('webcontainer');
    const { tutorial } = runtime;
    const pending = deferred();
    let boots = 0;
    let teardowns = 0;
    const instance = { teardown() { teardowns++; } };
    const api = { WebContainer: { boot() { boots++; return phase === 'runtime boot' ? pending.promise : instance; } } };
    tutorial._loadWebContainerAPI = () => phase === 'API loading' ? pending.promise : Promise.resolve(api);
    const initialization = observe(tutorial._initBackend());
    await flush();
    tutorial._destroyed = true;
    await tutorial._disposeWebContainerRuntime();
    await flush();
    assert.equal(initialization.status, 'rejected', 'disposal must not wait for the network or boot deadline');
    assert.equal(initialization.error.reason, 'terminated');
    assert.equal(runtime.timerCount(), 0, 'cancelled boot must release its deadline');
    pending.resolve(phase === 'API loading' ? api : instance);
    await flush();
    await runtime.tick(120_000);
    assert.equal(boots, phase === 'API loading' ? 0 : 1, 'cancelled API loading must not start the runtime');
    assert.equal(teardowns, phase === 'API loading' ? 0 : 1, 'a late runtime must be torn down');
    assert.equal(tutorial.config.backend, 'webcontainer', 'intentional cancellation must not switch to browser fallback');
    assert.equal(tutorial.booted, false);
  });
}

for (const phase of ['workspace creation', 'terminal spawn', 'setup spawn']) {
  test(`cancelled WebContainer ${phase} cannot affect a ready replacement`, async () => {
    const runtime = createRuntime('webcontainer', { setup: phase === 'setup spawn' ? ['echo ready'] : [] });
    const { tutorial } = runtime;
    tutorial.config.useTerminal = phase === 'terminal spawn';
    const pending = deferred();
    let oldTeardowns = 0;
    let oldProcessKills = 0;
    let replacementTeardowns = 0;
    const process = { kill() { oldProcessKills++; } };
    const oldRuntime = {
      teardown() { oldTeardowns++; },
      fs: { mkdir: () => phase === 'workspace creation' ? pending.promise : Promise.resolve() },
      spawn: () => pending.promise,
    };
    tutorial._loadWebContainerAPI = () => Promise.resolve({ WebContainer: { boot: () => Promise.resolve(oldRuntime) } });
    const cancelled = observe(tutorial._initBackend());
    await flush();
    await tutorial._disposeWebContainerRuntime();
    await flush();
    assert.equal(cancelled.status, 'rejected');
    assert.equal(cancelled.error.reason, 'terminated');
    assert.equal(runtime.timerCount(), 0, 'disposal must release setup-command deadlines too');

    const replacement = {
      teardown() { replacementTeardowns++; },
      fs: { mkdir: () => Promise.resolve() },
    };
    tutorial.config.useTerminal = false;
    tutorial.setupCommands = [];
    tutorial._loadWebContainerAPI = () => Promise.resolve({ WebContainer: { boot: () => Promise.resolve(replacement) } });
    await tutorial._initBackend();
    pending.resolve(phase === 'workspace creation' ? undefined : process);
    await flush();
    await runtime.tick(120_000);
    assert.equal(tutorial._webcontainer, replacement);
    assert.equal(tutorial.booted, true);
    assert.equal(tutorial.config.backend, 'webcontainer');
    assert.equal(oldTeardowns, 1);
    assert.equal(replacementTeardowns, 0, 'an obsolete cancellation must not dispose the replacement');
    assert.equal(oldProcessKills, phase === 'workspace creation' ? 0 : 1, 'late processes belong to the cancelled runtime');
    await tutorial._disposeWebContainerRuntime();
  });
}

test('an obsolete WebContainer failure cannot switch a replacement to browser fallback', async () => {
  const { tutorial } = createRuntime('webcontainer');
  const teardown = deferred();
  const failedRuntime = {
    teardown: () => teardown.promise,
    fs: { mkdir: () => Promise.reject(new Error('Workspace unavailable')) },
  };
  tutorial._loadWebContainerAPI = () => Promise.resolve({ WebContainer: { boot: () => Promise.resolve(failedRuntime) } });
  const obsolete = observe(tutorial._initBackend());
  await flush();
  const replacement = { fs: { mkdir: () => Promise.resolve() }, teardown() {} };
  tutorial._loadWebContainerAPI = () => Promise.resolve({ WebContainer: { boot: () => Promise.resolve(replacement) } });
  await tutorial._initBackend();
  teardown.resolve();
  await flush();
  assert.equal(obsolete.status, 'rejected');
  assert.equal(obsolete.error.reason, 'terminated');
  assert.equal(tutorial.config.backend, 'webcontainer');
  assert.equal(tutorial._webcontainer, replacement);
  assert.equal(tutorial.booted, true);
  await tutorial._disposeWebContainerRuntime();
});

for (const backend of ['sql', 'prolog', 'java']) {
  test(`${backend}: cancelling boot rejects immediately and cannot expire a replacement`, async () => {
    const runtime = createRuntime(backend);
    const { tutorial, workers } = runtime;
    const cancelled = observe(tutorial._initBackend());
    tutorial._terminateWorker('Lesson changed');
    await flush();
    assert.equal(cancelled.status, 'rejected', 'navigation must not leave boot awaiting its deadline');
    assert.equal(cancelled.error.reason, 'terminated');
    assert.equal(runtime.timerCount(), 0, 'cancelled boot must release its timer');
    const replacement = tutorial._initBackend();
    workers[1].emit({ type: 'ready' });
    await replacement;
    await runtime.tick(120_000);
    assert.equal(workers[1].terminated, false, 'an old boot deadline must not stop a ready replacement');
    assert.equal(tutorial.booted, true);
  });

  test(`${backend}: obsolete worker messages cannot settle requests or crash a replacement`, async () => {
    const runtime = createRuntime(backend);
    const { tutorial, workers, output } = runtime;
    const oldBoot = observe(tutorial._initBackend());
    tutorial._terminateWorker('Replace worker');
    const replacement = tutorial._initBackend();
    workers[1].emit({ type: 'ready' });
    await replacement;
    const replies = [];
    tutorial._postWorker({ type: 'read', path: 'answer' }, response => replies.push(response));
    const request = workers[1].messages[0];
    workers[0].emit({ type: 'read_result', id: request.id, content: 'obsolete' });
    workers[0].emit({ type: 'stdout', text: 'obsolete output' });
    workers[0].emit({ type: 'ready' });
    workers[0].emit({ type: 'error', message: 'obsolete failure' });
    workers[0].fail('obsolete browser error');
    await flush();
    assert.equal(replies.length, 0, 'only the owning worker may answer its RPC');
    assert.deepEqual(output, []);
    assert.equal(workers[1].terminated, false);
    workers[1].emit({ type: 'read_result', id: request.id, content: 'current' });
    assert.equal(replies.length, 1);
    assert.equal(replies[0].content, 'current');
    assert.equal(oldBoot.status, 'rejected');
    tutorial._terminateWorker();
  });

  test(`${backend}: construction failure leaves no boot timer to affect a later runtime`, async () => {
    const runtime = createRuntime(backend, { constructorError: 'Worker unavailable' });
    await assert.rejects(runtime.tutorial._initBackend(), /Worker unavailable/);
    assert.equal(runtime.timerCount(), 0);
  });

  test(`${backend}: boot deadline rejects and releases the failed worker`, async () => {
    const runtime = createRuntime(backend);
    const pending = observe(runtime.tutorial._initBackend());
    await runtime.tick(120_000);
    assert.equal(pending.status, 'rejected');
    assert.match(pending.error.message, /initialization timed out/);
    assert.equal(runtime.workers[0].terminated, true);
    assert.equal(runtime.timerCount(), 0);
    assert.equal(runtime.tutorial.booted, false);
  });
}

for (const backend of ['sql', 'prolog']) {
  test(`${backend}: cancellation while global setup settles cannot publish stale readiness`, async () => {
    const runtime = createRuntime(backend, { setup: ['prepare'] });
    const { tutorial, workers } = runtime;
    const oldBoot = observe(tutorial._initBackend());
    workers[0].emit({ type: 'ready' });
    const setup = workers[0].messages[0];
    workers[0].emit({ type: 'done', id: setup.id, exitCode: 0 });
    // The setup RPC is complete, but its Promise continuation has not run.
    tutorial._terminateWorker('Changed backend during setup');
    tutorial.setupCommands = [];
    const replacement = tutorial._initBackend();
    await flush();
    assert.equal(oldBoot.status, 'rejected');
    assert.equal(tutorial.booted, false, 'the replacement has not sent ready yet');
    workers[1].emit({ type: 'ready' });
    await replacement;
    assert.equal(workers[1].terminated, false);
    tutorial._terminateWorker();
  });

  test(`${backend}: failed global setup releases pending work and its boot deadline`, async () => {
    const runtime = createRuntime(backend, { setup: ['prepare'] });
    const { tutorial, workers } = runtime;
    const boot = tutorial._initBackend();
    const failure = assert.rejects(boot, /global setup failed: invalid setup/);
    workers[0].emit({ type: 'ready' });
    workers[0].emit({ type: 'done', id: workers[0].messages[0].id, exitCode: 1, error: 'invalid setup' });
    await failure;
    assert.equal(workers[0].terminated, true);
    assert.equal(tutorial.booted, false);
    assert.equal(runtime.timerCount(), 0);
  });
}

test('a request timeout cannot restart a replacement created by its callback', async () => {
  const runtime = createRuntime('java');
  const { tutorial, workers } = runtime;
  const boot = tutorial._initBackend();
  workers[0].emit({ type: 'ready' });
  await boot;
  let replacement;
  const results = [];
  tutorial._postWorker({ type: 'runCode', code: 'loop' }, response => {
    results.push(response.reason);
    tutorial._terminateWorker('User selected another runtime');
    replacement = tutorial._initBackend();
  }, { timeoutMs: 10, restartOnTimeout: true });
  await runtime.tick(10);
  assert.deepEqual(results, ['timeout']);
  assert.equal(workers.length, 2, 'timeout recovery must not create a third worker');
  assert.equal(workers[1].terminated, false);
  workers[1].emit({ type: 'ready' });
  await replacement;
  tutorial._terminateWorker();
});

for (const backend of ['sql', 'prolog', 'java']) {
  for (const failure of ['crash', 'timeout']) {
    test(`${backend}: ${failure} settles pending commands and permits requests after recovery`, async () => {
      const runtime = createRuntime(backend);
      const { tutorial, workers } = runtime;
      const boot = tutorial._initBackend();
      workers[0].emit({ type: 'ready' });
      await boot;
      const execution = observe(tutorial._requestWorker({ type: 'runCode' }, {
        timeoutMs: 10, restartOnTimeout: true,
      }));
      const read = observe(tutorial._requestWorker({ type: 'read', path: 'draft' }));
      if (failure === 'crash') workers[0].fail('runtime crashed');
      else await runtime.tick(10);
      await flush();
      assert.equal(execution.status, 'rejected');
      assert.equal(execution.error.reason, failure === 'crash' ? 'terminated' : 'timeout');
      assert.equal(read.status, 'rejected');
      assert.equal(read.error.reason, 'terminated');
      assert.equal(workers[0].terminated, true);
      assert.equal(workers.length, 2);
      const recovery = tutorial._workerRestartPromise;
      workers[1].emit({ type: 'ready' });
      await recovery;
      const next = tutorial._requestWorker({ type: 'read', path: 'draft' });
      workers[1].emit({ type: 'read_result', id: workers[1].messages[0].id, content: 'after recovery' });
      assert.equal((await next).content, 'after recovery');
      assert.equal(runtime.timerCount(), 0);
      tutorial._terminateWorker();
    });
  }
}

for (const backend of ['sql', 'prolog']) {
  test(`${backend}: repeated ready notifications cannot duplicate global setup`, async () => {
    const runtime = createRuntime(backend, { setup: ['prepare'] });
    const { tutorial, workers } = runtime;
    const boot = tutorial._initBackend();
    workers[0].emit({ type: 'ready' });
    workers[0].emit({ type: 'ready' });
    assert.equal(workers[0].messages.length, 1, 'setup must execute once per worker');
    workers[0].emit({ type: 'done', id: workers[0].messages[0].id, exitCode: 0 });
    await boot;
    workers[0].emit({ type: 'ready' });
    await flush();
    assert.equal(workers[0].messages.length, 1);
    tutorial._terminateWorker();
  });
}

test('Python setup cannot send Git initialization to a replacement backend', async () => {
  const runtime = createRuntime('pyodide', { setup: ['prepare'] });
  const { tutorial, workers } = runtime;
  tutorial.gitGraphPath = '/tutorial';
  const oldBoot = observe(tutorial._initBackend());
  workers[0].emit({ type: 'ready' });
  workers[0].emit({ type: 'done', id: workers[0].messages[0].id, exitCode: 0 });
  tutorial._terminateWorker('Switched to Java');
  tutorial.config.backend = 'java';
  const replacement = tutorial._initBackend();
  await flush();
  assert.equal(oldBoot.status, 'rejected');
  assert.deepEqual(workers[1].messages, [], 'an obsolete Python boot must not configure a Java worker');
  workers[1].emit({ type: 'ready' });
  await replacement;
  tutorial._terminateWorker();
});

for (const failure of ['error message', 'browser error']) {
  test(`Haskell: a ${failure} during boot terminates the executor`, async () => {
    const runtime = createRuntime('haskell');
    const { tutorial, workers } = runtime;
    const boot = observe(tutorial._initBackend());
    if (failure === 'error message') workers[0].emit({ type: 'error', message: 'boot failed' });
    else workers[0].fail('boot failed');
    await flush();
    assert.equal(boot.status, 'rejected');
    assert.match(boot.error.message, /boot failed/);
    assert.equal(workers[0].terminated, true);
    assert.equal(runtime.timerCount(), 0);
  });
}

test('Haskell: browser failure after readiness rejects pending requests and recovers', async () => {
  const runtime = createRuntime('haskell');
  const { tutorial, workers } = runtime;
  const boot = tutorial._initBackend();
  workers[0].emit({ type: 'ready' });
  await boot;
  const request = observe(tutorial._requestWorker({ type: 'runCode' }));
  workers[0].fail('executor crashed');
  await flush();
  assert.equal(request.status, 'rejected', 'a crashed executor must not wait for the RPC deadline');
  assert.equal(request.error.reason, 'terminated');
  assert.equal(workers[0].terminated, true);
  assert.equal(workers.length, 2);
  const recovery = tutorial._haskellRestartPromise;
  workers[1].emit({ type: 'ready' });
  await recovery;
  const next = tutorial._requestWorker({ type: 'runCode' });
  workers[1].emit({ type: 'done', id: workers[1].messages[0].id, exitCode: 0 });
  assert.equal((await next).exitCode, 0);
  tutorial._terminateWorker();
});

for (const completedPhase of ['gitInit', 'gitRun']) {
  test(`Python cancellation after ${completedPhase} prevents the next Git setup command`, async () => {
    const runtime = createRuntime('pyodide');
    const { tutorial, workers } = runtime;
    tutorial.gitGraphPath = '/tutorial';
    tutorial.gitSetupCommands = ['first command', 'second command'];
    const oldBoot = observe(tutorial._initBackend());
    workers[0].emit({ type: 'ready' });
    await flush();
    const gitInit = workers[0].messages[0];
    assert.equal(gitInit.type, 'gitInit');
    workers[0].emit({ type: 'git_init_ok', id: gitInit.id });
    if (completedPhase === 'gitRun') {
      await flush();
      const firstCommand = workers[0].messages[1];
      assert.equal(firstCommand.type, 'gitRun');
      workers[0].emit({ type: 'git_run_done', id: firstCommand.id, exitCode: 0 });
    }
    tutorial._terminateWorker('Switched to Java');
    tutorial.config.backend = 'java';
    const replacement = tutorial._initBackend();
    await flush();
    assert.equal(oldBoot.status, 'rejected');
    assert.deepEqual(workers[1].messages, [], 'cancelled setup must not continue in the replacement');
    workers[1].emit({ type: 'ready' });
    await replacement;
    tutorial._terminateWorker();
  });
}
