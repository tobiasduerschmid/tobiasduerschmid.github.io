const { test, expect } = require('@playwright/test');
const path = require('path');

async function loadTutorialRuntime(page) {
  await page.goto('/');
  await page.setContent('<main><div id="tutorial-root"></div></main>');
  await page.addScriptTag({
    path: path.join(__dirname, '..', 'js', 'tutorial-code.js'),
  });
  await page.addScriptTag({
    content: `window.__installTutorialHarness = ${installTutorialHarness.toString()};`,
  });
}

function installTutorialHarness(steps, options = {}) {
  const root = document.getElementById('tutorial-root');
  root.innerHTML = [
    '<nav class="step-nav"></nav>',
    '<section class="step-wrap"><div class="step-content"></div></section>',
    '<div class="step-controls"></div>',
    '<section class="quiz-panel"></section>',
  ].join('');

  const tutorial = new window.TutorialCode(root, {
    backend: options.backend || 'browser',
    steps,
    tutorialId: options.tutorialId || 'async-lifecycle-test',
    autosaveType: options.autosaveType || 'none',
    requireTests: options.requireTests !== false,
  });

  tutorial.stepNavEl = root.querySelector('.step-nav');
  tutorial.stepContentWrapEl = root.querySelector('.step-wrap');
  tutorial.stepContentEl = root.querySelector('.step-content');
  tutorial.stepControlsEl = root.querySelector('.step-controls');
  tutorial.quizPanelEl = root.querySelector('.quiz-panel');
  tutorial.booted = true;

  tutorial._renderInlineMarkdown = (text) => text;
  tutorial._stepInstructionsHTML = () => '';
  tutorial._initTooltips = () => {};
  tutorial._renderInlineMermaid = () => {};
  tutorial._broadcastStepState = () => {};
  tutorial._updateUserCmdListener = () => Promise.resolve();
  tutorial._refreshStepVisibleFiles = () => Promise.resolve();
  tutorial._startFileWatch = () => {};
  tutorial._startGuestClockSync = () => {};
  tutorial._updateStepHash = () => {};
  tutorial._startTimedPractice = () => {};
  tutorial._prewarmNextBackend = () => {};
  tutorial._scheduleUMLRefresh = () => {};
  tutorial._showTerminalLoading = () => {};
  tutorial._hideTerminalLoading = () => {};
  tutorial._canCacheLiveStepEntrySnapshot = () => false;
  tutorial._renderTabs = () => {};
  tutorial._setActiveFile = (filename) => { tutorial.activeFileName = filename; };
  tutorial._clearOutput = () => {};
  tutorial._closeNonStepFiles = (step) => {
    const visible = new Set((step.files || []).map((file) => file.path));
    Object.keys(tutorial.editorModels).forEach((filename) => {
      if (!visible.has(filename)) delete tutorial.editorModels[filename];
    });
  };
  tutorial.openFile = (filename, content, language) => {
    let value = content || '';
    tutorial.editorModels[filename] = {
      model: {
        getValue: () => value,
        setValue: (next) => { value = next; },
        getLanguageId: () => language || 'javascript',
        isDisposed: () => false,
        dispose: () => {},
      },
    };
    tutorial.activeFileName = filename;
  };

  return tutorial;
}

test.describe('tutorial asynchronous lifecycle', () => {
  test('step readiness waits for file sync and setup before applying a solution', async ({ page }) => {
    await loadTutorialRuntime(page);

    await page.evaluate(() => {
      const events = [];
      let resolveStarterSync;
      let resolveSetup;
      const starterSynced = new Promise((resolve) => { resolveStarterSync = resolve; });
      const setupFinished = new Promise((resolve) => { resolveSetup = resolve; });
      const tutorial = window.__installTutorialHarness([{
        title: 'Prepared Step',
        instructionsHTML: '',
        setup_commands: ['prepare-step'],
        files: [{ path: 'main.js', content: 'starter', language: 'javascript' }],
        open_file: 'main.js',
        solution: {
          files: [{ path: 'main.js', content: 'solution', language: 'javascript' }],
        },
      }], {
        backend: 'v86',
        autosaveType: 'files',
        requireTests: false,
      });
      tutorial.autoSaveEnabled = true;

      const baseOpenFile = tutorial.openFile;
      tutorial.openFile = (filename, content, language) => {
        events.push(`open:${content}`);
        baseOpenFile(filename, content, language);
      };
      tutorial._syncFileToBackend = (filename) => {
        const content = tutorial.editorModels[filename].model.getValue();
        events.push(`sync-start:${content}`);
        if (content === 'starter') {
          return starterSynced.then(() => { events.push('sync-finished:starter'); });
        }
        events.push(`sync-finished:${content}`);
        return Promise.resolve();
      };
      tutorial._runSilent = (command) => {
        if (command.includes('prepare-step')) {
          events.push('setup-start');
          return setupFinished.then(() => { events.push('setup-finished'); });
        }
        events.push(`silent:${command}`);
        return Promise.resolve();
      };

      const loadPromise = tutorial.loadStep(0).then(() => { events.push('load-resolved'); });
      window.__asyncLifecycle = {
        tutorial,
        events,
        loadPromise,
        solutionPromise: null,
        resolveStarterSync,
        resolveSetup,
      };
    });

    await expect.poll(async () => page.evaluate(() => window.__asyncLifecycle.events.slice()), {
      message: 'setup must not start before the starter file reaches the backend',
    }).toEqual(['open:starter', 'sync-start:starter']);

    await page.evaluate(() => {
      const lifecycle = window.__asyncLifecycle;
      lifecycle.solutionPromise = lifecycle.tutorial.applySolution()
        .then(() => { lifecycle.events.push('solution-resolved'); });
    });
    await page.evaluate(() => window.__asyncLifecycle.resolveStarterSync());
    await expect.poll(async () => page.evaluate(() => window.__asyncLifecycle.events.slice()), {
      message: 'setup should start after file sync while load and solution remain pending',
    }).toEqual([
      'open:starter',
      'sync-start:starter',
      'sync-finished:starter',
      'setup-start',
    ]);

    await page.evaluate(() => window.__asyncLifecycle.resolveSetup());
    await page.evaluate(() => Promise.all([
      window.__asyncLifecycle.loadPromise,
      window.__asyncLifecycle.solutionPromise,
    ]));

    const events = await page.evaluate(() => window.__asyncLifecycle.events);
    expect(events.indexOf('setup-finished')).toBeLessThan(events.indexOf('open:solution'));
    expect(events).toContain('load-resolved');
    expect(events).toContain('sync-finished:solution');
    expect(events).toContain('solution-resolved');
  });

  test('failed first-visit setup is neither persisted nor treated as visited before retry', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      localStorage.clear();
      const tutorial = window.__installTutorialHarness([{
        title: 'Retryable Step',
        instructionsHTML: '',
        setup_commands: ['prepare-step'],
        files: [{ path: 'main.py', content: 'print("ready")', language: 'python' }],
        open_file: 'main.py',
      }], {
        backend: 'pyodide',
        autosaveType: 'files',
        requireTests: false,
      });
      tutorial.autoSaveEnabled = true;
      tutorial._showError = () => {};
      tutorial._syncFileToBackend = () => Promise.resolve();

      let setupAttempts = 0;
      tutorial._runStepWorkerSetupCommands = () => {
        setupAttempts += 1;
        return setupAttempts === 1
          ? Promise.reject(new Error('temporary setup failure'))
          : Promise.resolve();
      };

      let firstError = '';
      try {
        await tutorial.loadStep(0);
      } catch (error) {
        firstError = error.message;
      }
      const afterFailure = {
        firstError,
        setupAttempts,
        visited: Array.from(tutorial._stepsVisited),
        persisted: localStorage.getItem(tutorial._storageKey()),
        autosaveSuppressed: tutorial._suppressAutoSave,
      };

      await tutorial.loadStep(0);
      const saved = JSON.parse(localStorage.getItem(tutorial._storageKey()));
      return {
        afterFailure,
        setupAttempts,
        visited: Array.from(tutorial._stepsVisited),
        savedStep: saved.step,
      };
    });

    expect(state).toEqual({
      afterFailure: {
        firstError: 'temporary setup failure',
        setupAttempts: 1,
        visited: [],
        persisted: null,
        autosaveSuppressed: false,
      },
      setupAttempts: 2,
      visited: [0],
      savedStep: 0,
    });
  });

  test('restore does not promote an explicitly unvisited saved step to visited', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      localStorage.clear();
      localStorage.setItem('tutorial-autosave', 'true');
      const tutorial = window.__installTutorialHarness([{
        title: 'Incomplete Step',
        instructionsHTML: '',
        setup_commands: ['must-run-on-restore'],
      }], {
        backend: 'browser',
        autosaveType: 'files',
        requireTests: false,
      });
      tutorial.booted = false;

      let visitedWhenLoadStarted = null;
      let finishRestore;
      const restoreFinished = new Promise((resolve) => { finishRestore = resolve; });
      tutorial._buildUI = () => {};
      tutorial._showLoading = () => {};
      tutorial._hideLoading = () => { finishRestore(); };
      tutorial._loadDependencies = () => Promise.resolve();
      tutorial._initEditor = () => Promise.resolve();
      tutorial._initBackend = () => {
        tutorial.booted = true;
        return Promise.resolve();
      };
      tutorial._resolveStepFromHash = () => -1;
      tutorial._loadSavedProgress = () => ({
        step: 0,
        files: {},
        activeFile: null,
        stepsUnlocked: [0],
        stepsVisited: [],
        stepsPassed: [],
        quizPassed: [],
      });
      tutorial.loadStep = (index) => {
        visitedWhenLoadStarted = tutorial._stepsVisited.has(index);
        tutorial.currentStep = index;
        return Promise.resolve();
      };
      tutorial._applySavedFiles = () => Promise.resolve();
      tutorial._runStepDir = () => Promise.resolve();
      tutorial._ensureGitGraphPromptHook = () => Promise.resolve();
      tutorial._refreshPrompt = () => Promise.resolve();
      tutorial._pauseBackgroundSync = () => {};
      tutorial._resumeBackgroundSync = () => {};
      tutorial._refreshGitGraph = () => {};

      await tutorial.start();
      await restoreFinished;
      return {
        visitedWhenLoadStarted,
        visitedAfterRestore: Array.from(tutorial._stepsVisited),
      };
    });

    expect(state).toEqual({
      visitedWhenLoadStarted: false,
      visitedAfterRestore: [],
    });
  });

  test('a test completion from a previous step cannot pass or unlock the current step', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([
        {
          title: 'Slow Test',
          instructionsHTML: '',
          files: [{ path: 'slow.js', content: 'console.log("slow")', language: 'javascript' }],
          open_file: 'slow.js',
          tests: [{ description: 'slow assertion', command: 'assert(true)' }],
        },
        {
          title: 'Current Step',
          instructionsHTML: '',
          files: [{ path: 'current.js', content: 'console.log("current")', language: 'javascript' }],
          open_file: 'current.js',
          tests: [{ description: 'current assertion', command: 'assert(true)' }],
        },
      ]);
      tutorial._stepsUnlocked.add(1);
      tutorial._syncFileToBackend = () => Promise.resolve();
      tutorial._runBrowserCode = (source, onOutput, onDone) => {
        window.__finishSlowTest = onDone;
      };

      await tutorial.loadStep(0);
      tutorial._runTests();
      await tutorial.loadStep(1);
      window.__finishSlowTest();

      return {
        currentStep: tutorial.currentStep,
        passed: Array.from(tutorial._stepsPassed),
        unlocked: Array.from(tutorial._stepsUnlocked),
        hasResults: !!tutorial.stepContentEl.querySelector('.tvm-test-results'),
        testRunInFlight: tutorial._testRunInFlight,
      };
    });

    expect(state).toEqual({
      currentStep: 1,
      passed: [],
      unlocked: [0, 1],
      hasResults: false,
      testRunInFlight: false,
    });
    await expect(page.getByRole('button', { name: '✓ Test My Work' })).toBeEnabled();
  });

  test('duplicate completion paths render one pass celebration', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([{
        title: 'Single Test',
        instructionsHTML: '',
        files: [{ path: 'main.js', content: 'console.log("ok")', language: 'javascript' }],
        open_file: 'main.js',
        tests: [{ description: 'one assertion', command: 'assert(true)' }],
      }]);
      tutorial._syncFileToBackend = () => Promise.resolve();
      tutorial._runBrowserCode = (source, onOutput, onDone) => {
        window.__finishTest = onDone;
      };
      let celebrations = 0;
      window.SEGymHeroCelebration = {
        show() { celebrations += 1; },
      };

      await tutorial.loadStep(0);
      tutorial._runTests();
      window.__finishTest();
      window.__finishTest();

      return {
        celebrations,
        passed: Array.from(tutorial._stepsPassed),
        summaries: tutorial.stepContentEl.querySelectorAll('.tvm-test-summary').length,
      };
    });

    expect(state).toEqual({ celebrations: 1, passed: [0], summaries: 1 });
  });

  test('learner-controlled runtime errors render as text instead of host-page markup', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(() => {
      const tutorial = window.__installTutorialHarness([], {
        backend: 'pyodide',
        requireTests: false,
      });
      window.__tutorialErrorPayloadExecuted = false;
      const hostileMessage = [
        'setup failed: ',
        '<img src=x onerror="window.__tutorialErrorPayloadExecuted=true">',
        '<script>window.__tutorialErrorPayloadExecuted=true<\/script>',
      ].join('');
      tutorial._showError(hostileMessage);
      const errorState = tutorial.root.querySelector('.tvm-error');
      tutorial._umlContentEl = document.createElement('div');
      tutorial._showUMLError(hostileMessage);
      return {
        payloadExecuted: window.__tutorialErrorPayloadExecuted,
        injectedElements: tutorial.root.querySelectorAll('img, script').length,
        detail: errorState.querySelector('p').textContent,
        role: errorState.getAttribute('role'),
        inlineHandler: errorState.querySelector('button').getAttribute('onclick'),
        umlInjectedElements: tutorial._umlContentEl.querySelectorAll('img, script').length,
        umlDetail: tutorial._umlContentEl.textContent,
      };
    });

    expect(state).toEqual({
      payloadExecuted: false,
      injectedElements: 0,
      detail: 'setup failed: <img src=x onerror="window.__tutorialErrorPayloadExecuted=true"><script>window.__tutorialErrorPayloadExecuted=true<\/script>',
      role: 'alert',
      inlineHandler: null,
      umlInjectedElements: 0,
      umlDetail: 'setup failed: <img src=x onerror="window.__tutorialErrorPayloadExecuted=true"><script>window.__tutorialErrorPayloadExecuted=true<\/script>',
    });
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('worker global setup failure rejects initialization with the backend error', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const OriginalWorker = window.Worker;
      let workerTerminated = false;

      class FailingSetupWorker {
        constructor() {
          queueMicrotask(() => this.onmessage({ data: { type: 'ready' } }));
        }

        postMessage(message) {
          queueMicrotask(() => this.onmessage({
            data: {
              type: 'run_done',
              id: message.id,
              exitCode: 1,
              error: 'setup exploded',
            },
          }));
        }

        terminate() {
          workerTerminated = true;
        }
      }

      window.Worker = FailingSetupWorker;
      const tutorial = window.__installTutorialHarness([], {
        backend: 'pyodide',
        requireTests: false,
      });
      tutorial.booted = false;
      tutorial._showLoading = () => {};

      let errorMessage = '';
      try {
        await tutorial._initPyodide(['raise RuntimeError("boom")']);
      } catch (error) {
        errorMessage = error.message;
      } finally {
        window.Worker = OriginalWorker;
      }

      return {
        errorMessage,
        workerTerminated,
        booted: tutorial.booted,
        pendingRequests: Object.keys(tutorial._workerCallbacks).length,
      };
    });

    expect(state).toEqual({
      errorMessage: 'Python global setup failed: setup exploded',
      workerTerminated: true,
      booted: false,
      pendingRequests: 0,
    });
  });

  test('worker file sync records success only after acknowledgement and preserves dirty state on error', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([], {
        backend: 'pyodide',
        requireTests: false,
      });
      tutorial.openFile('main.py', 'starter', 'python');
      const entry = tutorial.editorModels['main.py'];
      entry.lastSyncContent = 'starter';
      entry.model.setValue('edited');

      let postedMessage = null;
      tutorial._worker = {
        postMessage(message) { postedMessage = message; },
        terminate() {},
      };

      let successSettled = false;
      const success = tutorial._syncFileToBackend('main.py').then(() => {
        successSettled = true;
      });
      await Promise.resolve();
      const beforeAcknowledgement = {
        successSettled,
        lastSyncContent: entry.lastSyncContent,
      };
      tutorial._routeWorkerResponse({ type: 'write_ok', id: postedMessage.id });
      await success;
      const afterAcknowledgement = entry.lastSyncContent;

      entry.model.setValue('newer edit');
      const failedSync = tutorial._syncFileToBackend('main.py');
      await Promise.resolve();
      tutorial._routeWorkerResponse({
        type: 'write_error',
        id: postedMessage.id,
        message: 'disk full',
      });
      let errorMessage = '';
      try {
        await failedSync;
      } catch (error) {
        errorMessage = error.message;
      }

      return {
        beforeAcknowledgement,
        afterAcknowledgement,
        afterFailure: entry.lastSyncContent,
        errorMessage,
        pendingRequests: Object.keys(tutorial._workerCallbacks).length,
      };
    });

    expect(state.beforeAcknowledgement).toEqual({
      successSettled: false,
      lastSyncContent: 'starter',
    });
    expect(state.afterAcknowledgement).toBe('edited');
    expect(state.afterFailure).toBe('edited');
    expect(state.errorMessage).toContain('disk full');
    expect(state.pendingRequests).toBe(0);
  });

  test('worker requests time out once and release their callback', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([], {
        backend: 'pyodide',
        requireTests: false,
      });
      tutorial._worker = { postMessage() {}, terminate() {} };
      let callbackCount = 0;

      const response = await new Promise((resolve) => {
        tutorial._postWorker(
          { type: 'read', path: '/tutorial/missing.py' },
          (message) => {
            callbackCount += 1;
            resolve(message);
          },
          { timeoutMs: 5 },
        );
      });

      return {
        callbackCount,
        reason: response.reason,
        exitCode: response.exitCode,
        pendingRequests: Object.keys(tutorial._workerCallbacks).length,
      };
    });

    expect(state).toEqual({
      callbackCount: 1,
      reason: 'timeout',
      exitCode: 1,
      pendingRequests: 0,
    });
  });

  test('destroy settles pending worker requests before terminating the runtime', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([], {
        backend: 'pyodide',
        requireTests: false,
      });
      let terminated = false;
      tutorial._worker = {
        postMessage() {},
        terminate() { terminated = true; },
      };

      const pendingRequest = tutorial._requestWorker({
        type: 'read',
        path: '/tutorial/main.py',
      }).then(
        () => ({ resolved: true }),
        (error) => ({ resolved: false, message: error.message }),
      );

      tutorial.destroy();
      const result = await pendingRequest;
      return {
        result,
        terminated,
        pendingRequests: Object.keys(tutorial._workerCallbacks).length,
      };
    });

    expect(state).toEqual({
      result: { resolved: false, message: 'Tutorial runtime was destroyed' },
      terminated: true,
      pendingRequests: 0,
    });
  });

  test('Stop replaces a wedged worker, restores files and setup, and returns focus to Run', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([{
        title: 'Recoverable Step',
        instructionsHTML: '',
        setup_commands: ['restore-step-state'],
        files: [{ path: 'main.py', content: 'print("ready")', language: 'python' }],
        open_file: 'main.py',
      }], {
        backend: 'pyodide',
        requireTests: false,
      });
      tutorial.currentStep = 0;
      tutorial.openFile('dependency.py', 'VALUE = 42', 'python');
      tutorial.openFile('main.py', 'print("ready")', 'python');
      tutorial.root.insertAdjacentHTML('beforeend', [
        '<button type="button" class="tvm-run-btn">Run</button>',
        '<button type="button" class="tvm-stop-btn">Stop execution</button>',
        '<div class="tvm-output"><pre class="tvm-output-pre"></pre></div>',
      ].join(''));
      tutorial.outputPre = tutorial.root.querySelector('.tvm-output-pre');
      tutorial._showLoading = () => {};
      tutorial._hideLoading = () => {};
      tutorial._showError = () => {};

      let oldWorkerTerminated = false;
      tutorial._worker = {
        postMessage(message) {
          if (message.type !== 'write') return;
          queueMicrotask(() => tutorial._routeWorkerResponse({
            type: 'write_ok',
            id: message.id,
          }));
        },
        terminate() { oldWorkerTerminated = true; },
      };
      await tutorial._syncFileToBackend('dependency.py');
      await tutorial._syncFileToBackend('main.py');
      // Closing a tab intentionally leaves its file in the worker workspace.
      // A restart must restore that hidden dependency as well as open models.
      delete tutorial.editorModels['dependency.py'];

      const interruptedRequest = tutorial._requestWorker(
        { type: 'run', path: '/tutorial/main.py' },
        { timeoutMs: 1000 },
      ).then(
        () => 'resolved',
        (error) => error.reason,
      );

      let setupRuns = 0;
      const restoredFiles = {};
      tutorial._initBackend = () => {
        tutorial._worker = {
          postMessage(message) {
            if (message.type === 'write') restoredFiles[message.path] = message.content;
            queueMicrotask(() => tutorial._routeWorkerResponse({
              type: 'write_ok',
              id: message.id,
            }));
          },
          terminate() {},
        };
        tutorial.booted = true;
        return Promise.resolve();
      };
      tutorial._runStepWorkerSetupCommands = () => {
        setupRuns += 1;
        return Promise.resolve();
      };

      const stopButton = tutorial.root.querySelector('.tvm-stop-btn');
      stopButton.focus();
      tutorial._stopExecution();
      await tutorial._workerRestartPromise;

      return {
        interruptedReason: await interruptedRequest,
        oldWorkerTerminated,
        setupRuns,
        booted: tutorial.booted,
        syncedContent: tutorial.editorModels['main.py'].lastSyncContent,
        restoredDependency: restoredFiles['/tutorial/dependency.py'],
      };
    });

    expect(state).toEqual({
      interruptedReason: 'terminated',
      oldWorkerTerminated: true,
      setupRuns: 1,
      booted: true,
      syncedContent: 'print("ready")',
      restoredDependency: 'VALUE = 42',
    });
    await expect(page.getByRole('button', { name: /Run/ })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Stop execution' })).toBeHidden();
  });

  test('a worker crash after startup restarts the runtime and restores execution controls', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const OriginalWorker = window.Worker;
      const instances = [];

      class RecoverableWorker {
        constructor() {
          this.terminated = false;
          this.writes = {};
          instances.push(this);
          queueMicrotask(() => this.onmessage({ data: { type: 'ready' } }));
        }

        postMessage(message) {
          if (message.type !== 'write') return;
          this.writes[message.path] = message.content;
          queueMicrotask(() => this.onmessage({
            data: { type: 'write_ok', id: message.id },
          }));
        }

        terminate() {
          this.terminated = true;
        }
      }

      window.Worker = RecoverableWorker;
      try {
        const tutorial = window.__installTutorialHarness([{
          title: 'Crash Recovery',
          instructionsHTML: '',
          files: [{ path: 'main.py', content: 'print("ready")', language: 'python' }],
          open_file: 'main.py',
        }], {
          backend: 'pyodide',
          requireTests: false,
        });
        tutorial.currentStep = 0;
        tutorial.booted = false;
        tutorial.openFile('main.py', 'print("learner edit")', 'python');
        tutorial.root.insertAdjacentHTML('beforeend', [
          '<button type="button" class="tvm-run-btn">Run</button>',
          '<button type="button" class="tvm-stop-btn">Stop execution</button>',
        ].join(''));
        tutorial._showLoading = () => {};
        tutorial._hideLoading = () => {};
        let restartError = '';
        tutorial._showError = (message) => { restartError = message; };

        await tutorial._initPyodide([]);
        await tutorial._syncFileToBackend('main.py');
        const crashedWorker = tutorial._worker;
        const interruptedRequest = tutorial._runWorkerExecution({
          type: 'run',
          path: '/tutorial/main.py',
        }).then(
          () => 'resolved',
          (error) => error.reason,
        );

        crashedWorker.onerror({ message: 'simulated crash' });
        await tutorial._workerRestartPromise;

        const replacementWorker = tutorial._worker;
        return {
          interruptedReason: await interruptedRequest,
          workerCount: instances.length,
          crashedWorkerTerminated: crashedWorker.terminated,
          workerReplaced: replacementWorker !== crashedWorker,
          replayedContent: replacementWorker.writes['/tutorial/main.py'],
          booted: tutorial.booted,
          restartError,
        };
      } finally {
        window.Worker = OriginalWorker;
      }
    });

    expect(state).toEqual({
      interruptedReason: 'terminated',
      workerCount: 2,
      crashedWorkerTerminated: true,
      workerReplaced: true,
      replayedContent: 'print("learner edit")',
      booted: true,
      restartError: '',
    });
    await expect(page.getByRole('button', { name: /Run/ })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Stop execution' })).toBeHidden();
  });

  test('a failed worker restart leaves execution unavailable and shows an accessible error', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([{
        title: 'Failed Recovery',
        instructionsHTML: '',
        files: [{ path: 'main.py', content: 'print("ready")', language: 'python' }],
        open_file: 'main.py',
      }], {
        backend: 'pyodide',
        requireTests: false,
      });
      tutorial.currentStep = 0;
      tutorial.root.insertAdjacentHTML('beforeend', [
        '<button type="button" class="tvm-run-btn">Run</button>',
        '<button type="button" class="tvm-stop-btn">Stop execution</button>',
      ].join(''));
      tutorial.root.querySelector('.tvm-stop-btn').style.display = 'inline-block';
      tutorial._showLoading = () => {};
      tutorial._initBackend = () => Promise.reject(new Error('replacement failed to boot'));

      const renderError = tutorial._showError.bind(tutorial);
      let controlsAtError = null;
      tutorial._showError = (message) => {
        const runButton = tutorial.root.querySelector('.tvm-run-btn');
        const stopButton = tutorial.root.querySelector('.tvm-stop-btn');
        controlsAtError = {
          runDisabled: runButton.disabled,
          runLabel: runButton.textContent,
          stopDisplay: stopButton.style.display,
        };
        renderError(message);
      };

      let rejection = '';
      try {
        await tutorial._restartWorkerBackend('simulated crash');
      } catch (error) {
        rejection = error.message;
      }

      return { controlsAtError, rejection };
    });

    expect(state).toEqual({
      controlsAtError: {
        runDisabled: true,
        runLabel: 'Runtime unavailable',
        stopDisplay: 'none',
      },
      rejection: 'replacement failed to boot',
    });
    await expect(page.getByRole('alert')).toContainText(
      'Failed to restart Python runtime: replacement failed to boot',
    );
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
