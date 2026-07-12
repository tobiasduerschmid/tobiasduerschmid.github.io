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

  test('rapid navigation keeps the immediate first UI switch and prepares only the latest queued step', async ({ page }) => {
    await loadTutorialRuntime(page);

    await page.evaluate(() => {
      const events = [];
      const setupResolvers = {};
      const tutorial = window.__installTutorialHarness([
        { title: 'Zero', setup_commands: ['prepare-zero'], files: [{ path: 'zero.js', content: '0' }] },
        { title: 'One', setup_commands: ['prepare-one'], files: [{ path: 'one.js', content: '1' }] },
        { title: 'Two', setup_commands: ['prepare-two'], files: [{ path: 'two.js', content: '2' }] },
      ], { backend: 'v86', requireTests: false });
      tutorial._stepsUnlocked = new Set([0, 1, 2]);
      tutorial._syncFileToBackend = (filename) => {
        events.push(`sync:${filename}`);
        return Promise.resolve();
      };
      tutorial._runSilent = (command) => {
        const match = command.match(/prepare-(zero|one|two)/);
        if (!match) return Promise.resolve();
        events.push(`setup:${match[1]}`);
        return new Promise((resolve) => { setupResolvers[match[1]] = resolve; });
      };

      const first = tutorial.loadStep(0);
      const immediate = {
        currentStep: tutorial.currentStep,
        heading: tutorial.stepContentEl.querySelector('h2').textContent,
      };
      const intermediate = tutorial.loadStep(1);
      const latest = tutorial.loadStep(2);
      window.__rapidNavigation = {
        tutorial,
        events,
        setupResolvers,
        immediate,
        promises: [first, intermediate, latest],
      };
    });

    expect(await page.evaluate(() => window.__rapidNavigation.immediate)).toEqual({
      currentStep: 0,
      heading: 'Zero',
    });
    await expect.poll(() => page.evaluate(() => window.__rapidNavigation.events.slice())).toEqual([
      'sync:zero.js',
      'setup:zero',
    ]);

    await page.evaluate(() => window.__rapidNavigation.setupResolvers.zero());
    await expect.poll(() => page.evaluate(() => window.__rapidNavigation.events.slice())).toEqual([
      'sync:zero.js',
      'setup:zero',
      'sync:two.js',
      'setup:two',
    ]);
    await page.evaluate(() => window.__rapidNavigation.setupResolvers.two());

    const state = await page.evaluate(async () => ({
      results: await Promise.all(window.__rapidNavigation.promises),
      currentStep: window.__rapidNavigation.tutorial.currentStep,
      visited: Array.from(window.__rapidNavigation.tutorial._stepsVisited),
      events: window.__rapidNavigation.events.slice(),
    }));
    expect(state).toEqual({
      results: [false, false, true],
      currentStep: 2,
      visited: [2],
      events: ['sync:zero.js', 'setup:zero', 'sync:two.js', 'setup:two'],
    });
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

  test('start resolves only after the initial step is ready', async ({ page }) => {
    await loadTutorialRuntime(page);

    await page.evaluate(() => {
      localStorage.clear();
      const events = [];
      const tutorial = window.__installTutorialHarness([{
        title: 'Initial Step',
        instructionsHTML: '',
      }], {
        backend: 'browser',
        autosaveType: 'none',
        requireTests: false,
      });
      tutorial.booted = false;

      tutorial._buildUI = () => {};
      tutorial._showLoading = () => {};
      tutorial._hideLoading = () => { events.push('loading-hidden'); };
      tutorial._loadDependencies = () => Promise.resolve();
      tutorial._initEditor = () => Promise.resolve();
      tutorial._initBackend = () => Promise.resolve();
      tutorial._resolveStepFromHash = () => -1;
      tutorial._loadSavedProgress = () => null;
      tutorial._refreshPrompt = () => {
        events.push('prompt-refreshed');
        return Promise.resolve();
      };

      let releaseStep;
      tutorial.loadStep = (index) => {
        events.push(`step-requested:${index}`);
        return new Promise((resolve) => {
          releaseStep = () => {
            events.push('step-ready');
            resolve();
          };
        });
      };

      let startResolved = false;
      const startPromise = tutorial.start().then(() => {
        startResolved = true;
        events.push('start-resolved');
      });
      window.__initialStart = {
        events,
        get startResolved() { return startResolved; },
        releaseStep: () => releaseStep(),
        startPromise,
      };
    });

    await expect.poll(() => page.evaluate(() => ({
      events: window.__initialStart.events.slice(),
      startResolved: window.__initialStart.startResolved,
    }))).toEqual({
      events: ['step-requested:0'],
      startResolved: false,
    });

    const state = await page.evaluate(async () => {
      window.__initialStart.releaseStep();
      await window.__initialStart.startPromise;
      return {
        events: window.__initialStart.events.slice(),
        startResolved: window.__initialStart.startResolved,
      };
    });
    expect(state).toEqual({
      events: [
        'step-requested:0',
        'step-ready',
        'prompt-refreshed',
        'loading-hidden',
        'start-resolved',
      ],
      startResolved: true,
    });
  });

  for (const autosaveType of ['files', 'commands-and-files']) {
    test(`start waits for ${autosaveType} progress restoration`, async ({ page }) => {
      await loadTutorialRuntime(page);

      await page.evaluate((restoreType) => {
        localStorage.clear();
        localStorage.setItem('tutorial-autosave', 'true');
        const events = [];
        const tutorial = window.__installTutorialHarness([{
          title: 'Saved Step',
          instructionsHTML: '',
        }], {
          backend: 'browser',
          autosaveType: restoreType,
          requireTests: false,
        });
        tutorial.booted = false;

        tutorial._buildUI = () => {};
        tutorial._showLoading = () => {};
        tutorial._hideLoading = () => { events.push('loading-hidden'); };
        tutorial._loadDependencies = () => Promise.resolve();
        tutorial._initEditor = () => Promise.resolve();
        tutorial._initBackend = () => Promise.resolve();
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
        tutorial.loadStep = () => {
          events.push('step-loaded');
          return Promise.resolve();
        };
        tutorial._runStepDir = () => Promise.resolve();
        tutorial._ensureGitGraphPromptHook = () => Promise.resolve();
        tutorial._refreshPrompt = () => {
          events.push('prompt-refreshed');
          return Promise.resolve();
        };
        tutorial._autoSaveProgress = () => {};
        tutorial._pauseBackgroundSync = () => {};
        tutorial._resumeBackgroundSync = () => {};
        tutorial._refreshGitGraph = () => {};

        let releaseRestore;
        const waitForRestore = () => {
          events.push('restore-requested');
          return new Promise((resolve) => {
            releaseRestore = () => {
              events.push('restore-ready');
              resolve();
            };
          });
        };
        tutorial._applySavedFiles = restoreType === 'files'
          ? waitForRestore
          : () => Promise.reject(new Error('unexpected files-only restore'));
        tutorial._restoreCommandsAndFiles = restoreType === 'commands-and-files'
          ? waitForRestore
          : () => Promise.reject(new Error('unexpected command restore'));

        let startResolved = false;
        const startPromise = tutorial.start().then(() => {
          startResolved = true;
          events.push('start-resolved');
        });
        window.__savedStart = {
          events,
          get startResolved() { return startResolved; },
          get releaseRestore() { return releaseRestore; },
          startPromise,
        };
      }, autosaveType);

      await expect.poll(() => page.evaluate(() => ({
        events: window.__savedStart.events.slice(),
        startResolved: window.__savedStart.startResolved,
        canRelease: typeof window.__savedStart.releaseRestore === 'function',
      }))).toEqual({
        events: ['step-loaded', 'restore-requested'],
        startResolved: false,
        canRelease: true,
      });

      const state = await page.evaluate(async () => {
        window.__savedStart.releaseRestore();
        await window.__savedStart.startPromise;
        return {
          events: window.__savedStart.events.slice(),
          startResolved: window.__savedStart.startResolved,
        };
      });
      expect(state).toEqual({
        events: [
          'step-loaded',
          'restore-requested',
          'restore-ready',
          'prompt-refreshed',
          'loading-hidden',
          'start-resolved',
        ],
        startResolved: true,
      });
    });
  }

  test('cached commands-and-files restoration reenables autosave after saved files are ready', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([{
        title: 'Cached Step',
        files: [{ path: 'main.js', content: 'console.log("starter")' }],
      }], {
        backend: 'v86',
        autosaveType: 'commands-and-files',
        requireTests: false,
      });
      tutorial._suppressAutoSave = true;
      tutorial.emulator = { restore_state() {} };
      tutorial._restoreStepEntrySnapshot = () => Promise.resolve(true);
      tutorial._syncStepFiles = () => Promise.resolve();
      tutorial._applySavedFiles = () => Promise.resolve();
      tutorial._runPostFileloadSetup = () => Promise.resolve();
      tutorial._refreshStepVisibleFiles = () => Promise.resolve();
      tutorial._updateUserCmdListener = () => Promise.resolve();

      let suppressedWhenAutosaved = null;
      tutorial._autoSaveProgress = () => {
        suppressedWhenAutosaved = tutorial._suppressAutoSave;
        return true;
      };

      await tutorial._restoreCommandsAndFiles({
        step: 0,
        files: { 'main.js': 'console.log("saved")' },
        activeFile: 'main.js',
      });
      return {
        autosaveSuppressed: tutorial._suppressAutoSave,
        suppressedWhenAutosaved,
      };
    });

    expect(state).toEqual({
      autosaveSuppressed: false,
      suppressedWhenAutosaved: false,
    });
  });

  test('start rejects instead of running readiness callbacks after an initial load failure', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      localStorage.clear();
      const tutorial = window.__installTutorialHarness([{
        title: 'Broken Step',
        instructionsHTML: '',
      }], {
        backend: 'browser',
        autosaveType: 'none',
        requireTests: false,
      });
      tutorial.booted = false;

      let shownError = '';
      tutorial._buildUI = () => {};
      tutorial._showLoading = () => {};
      tutorial._showError = (message) => { shownError = message; };
      tutorial._loadDependencies = () => Promise.resolve();
      tutorial._initEditor = () => Promise.resolve();
      tutorial._initBackend = () => Promise.resolve();
      tutorial._resolveStepFromHash = () => -1;
      tutorial._loadSavedProgress = () => null;
      tutorial.loadStep = () => Promise.reject(new Error('initial setup failed'));

      let readinessCallbackRan = false;
      let rejection = '';
      await tutorial.start().then(() => {
        readinessCallbackRan = true;
      }).catch((error) => {
        rejection = error.message;
      });
      return { readinessCallbackRan, rejection, shownError };
    });

    expect(state).toEqual({
      readinessCallbackRan: false,
      rejection: 'initial setup failed',
      shownError: 'Failed to start tutorial: initial setup failed',
    });
  });

  test('failed saved-progress restoration resumes background work and rejects start', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      localStorage.clear();
      localStorage.setItem('tutorial-autosave', 'true');
      const tutorial = window.__installTutorialHarness([{
        title: 'Saved Step',
        instructionsHTML: '',
      }], {
        backend: 'browser',
        autosaveType: 'files',
        requireTests: false,
      });
      tutorial.booted = false;

      let shownError = '';
      let resumeCalls = 0;
      tutorial._buildUI = () => {};
      tutorial._showLoading = () => {};
      tutorial._showError = (message) => { shownError = message; };
      tutorial._loadDependencies = () => Promise.resolve();
      tutorial._initEditor = () => Promise.resolve();
      tutorial._initBackend = () => Promise.resolve();
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
      tutorial.loadStep = () => Promise.resolve();
      tutorial._applySavedFiles = () => Promise.reject(new Error('saved files unavailable'));
      tutorial._pauseBackgroundSync = () => {};
      tutorial._resumeBackgroundSync = () => { resumeCalls += 1; };

      let rejection = '';
      await tutorial.start().catch((error) => { rejection = error.message; });
      return {
        rejection,
        shownError,
        resumeCalls,
        autosaveSuppressed: tutorial._suppressAutoSave,
      };
    });

    expect(state).toEqual({
      rejection: 'saved files unavailable',
      shownError: 'Failed to restore progress: saved files unavailable',
      resumeCalls: 1,
      autosaveSuppressed: false,
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

  test('Run acquires one transaction before file sync and releases it after success or failure', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([{
        title: 'Atomic Run',
        files: [{ path: 'main.py', content: 'print("ready")', language: 'python' }],
        open_file: 'main.py',
      }], { backend: 'pyodide', requireTests: false });
      tutorial._syncFileToBackend = () => Promise.resolve();
      await tutorial.loadStep(0);
      tutorial.root.insertAdjacentHTML('beforeend', [
        '<button type="button" class="tvm-run-btn">Run</button>',
        '<button type="button" class="tvm-stop-btn">Stop execution</button>',
      ].join(''));

      let syncCalls = 0;
      let executeCalls = 0;
      let finishSync;
      tutorial._syncFileToBackend = () => {
        syncCalls += 1;
        return new Promise((resolve) => { finishSync = resolve; });
      };
      tutorial._runWorkerExecution = () => {
        executeCalls += 1;
        return Promise.resolve({ exitCode: 0 });
      };

      const first = tutorial._runCurrentFile();
      const second = tutorial._runCurrentFile();
      const third = tutorial._runCurrentFile();
      const guardedSynchronously = first === second && second === third &&
        tutorial._activeRunTransaction !== null;
      finishSync();
      const successful = await Promise.all([first, second, third]);

      tutorial._syncFileToBackend = () => Promise.reject(new Error('sync failed'));
      const failed = await tutorial._runCurrentFile();
      const runButton = tutorial.root.querySelector('.tvm-run-btn');
      const stopButton = tutorial.root.querySelector('.tvm-stop-btn');
      return {
        guardedSynchronously,
        successful,
        failed,
        syncCalls,
        executeCalls,
        activeTransaction: tutorial._activeRunTransaction,
        runDisabled: runButton.disabled,
        stopDisplay: stopButton.style.display,
      };
    });

    expect(state).toEqual({
      guardedSynchronously: true,
      successful: [true, true, true],
      failed: false,
      syncCalls: 1,
      executeCalls: 1,
      activeTransaction: null,
      runDisabled: false,
      stopDisplay: 'none',
    });
  });

  test('inline Test and Run share one WebContainer execution transaction in either order', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([{
        title: 'Shared execution',
        run_file: 'main.js',
        test_file: 'test.js',
        files: [
          { path: 'main.js', content: 'console.log("run")', language: 'javascript' },
          { path: 'test.js', content: 'console.log("test")', language: 'javascript' },
        ],
        open_file: 'main.js',
      }], { backend: 'webcontainer', requireTests: false });
      tutorial._syncFileToBackend = () => Promise.resolve();
      await tutorial.loadStep(0);
      tutorial.root.insertAdjacentHTML('beforeend', [
        '<button type="button" class="tvm-run-btn">Run</button>',
        '<button type="button" class="tvm-test-run-btn">Test</button>',
        '<button type="button" class="tvm-stop-btn">Stop execution</button>',
      ].join(''));

      const calls = [];
      let finishOperation;
      tutorial._runWebContainerNodeFile = (filename) => {
        calls.push(filename);
        return new Promise((resolve) => { finishOperation = resolve; });
      };

      const testFirst = tutorial._runTestFile();
      const runDuringTest = tutorial._runCurrentFile();
      const testControls = {
        samePromise: testFirst === runDuringTest,
        runDisabled: tutorial.root.querySelector('.tvm-run-btn').disabled,
        testDisabled: tutorial.root.querySelector('.tvm-test-run-btn').disabled,
        testLabel: tutorial.root.querySelector('.tvm-test-run-btn').textContent,
      };
      finishOperation({ exitCode: 0, output: '' });
      await Promise.all([testFirst, runDuringTest]);

      const runFirst = tutorial._runCurrentFile();
      const testDuringRun = tutorial._runTestFile();
      const runControls = {
        samePromise: runFirst === testDuringRun,
        runDisabled: tutorial.root.querySelector('.tvm-run-btn').disabled,
        testDisabled: tutorial.root.querySelector('.tvm-test-run-btn').disabled,
      };
      finishOperation({ exitCode: 0, output: '' });
      await Promise.all([runFirst, testDuringRun]);

      return {
        calls,
        testControls,
        runControls,
        activeTransaction: tutorial._activeRunTransaction,
        finalRunDisabled: tutorial.root.querySelector('.tvm-run-btn').disabled,
        finalTestDisabled: tutorial.root.querySelector('.tvm-test-run-btn').disabled,
        finalTestLabel: tutorial.root.querySelector('.tvm-test-run-btn').textContent,
        finalStopDisplay: tutorial.root.querySelector('.tvm-stop-btn').style.display,
      };
    });

    expect(state).toEqual({
      calls: ['test.js', 'main.js'],
      testControls: {
        samePromise: true,
        runDisabled: true,
        testDisabled: true,
        testLabel: '⏳ Testing…',
      },
      runControls: {
        samePromise: true,
        runDisabled: true,
        testDisabled: true,
      },
      activeTransaction: null,
      finalRunDisabled: false,
      finalTestDisabled: false,
      finalTestLabel: '✓ Test',
      finalStopDisplay: 'none',
    });
  });

  test('WebContainer Node execution uses a safe workspace-relative entry path', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([{
        title: 'Node paths',
        files: [{
          path: 'project/src/main.js',
          content: 'console.log("ready")',
          language: 'javascript',
        }],
        open_file: 'project/src/main.js',
      }], { backend: 'webcontainer', requireTests: false });
      tutorial._syncFileToBackend = () => Promise.resolve();
      await tutorial.loadStep(0);

      const syncedFiles = [];
      const spawnCalls = [];
      tutorial._syncFileToBackend = (filename) => {
        syncedFiles.push(filename);
        return Promise.resolve();
      };
      tutorial._ensureWebContainerNodeRuntime = () => Promise.resolve();
      tutorial._webcontainerCwd = '/tutorial/project';
      tutorial._webcontainer = {
        spawn(command, args, options) {
          spawnCalls.push({ command, args, options });
          return Promise.resolve({
            output: {
              getReader() {
                return {
                  read: () => Promise.resolve({ done: true }),
                  cancel: () => Promise.resolve(),
                };
              },
            },
            exit: Promise.resolve(0),
            kill() {},
          });
        },
      };

      const run = await tutorial._runWebContainerNodeFile('/tutorial/project/src/main.js', {
        skipArgsInput: true,
        extraArgs: ['--verbose'],
      });

      const mainEntry = tutorial.editorModels['project/src/main.js'];
      tutorial.editorModels = { '-entry.js': mainEntry };
      tutorial._webcontainerCwd = '/tutorial';
      const optionSafeRun = await tutorial._runWebContainerNodeFile('-entry.js', {
        skipArgsInput: true,
      });

      const unsafeErrors = [];
      for (const unsafePath of ['../../outside.js', '/outside.js', '/tutoriality/main.js']) {
        try {
          await tutorial._runWebContainerNodeFile(unsafePath, { skipArgsInput: true });
        } catch (error) {
          unsafeErrors.push(error.message);
        }
      }

      return { syncedFiles, spawnCalls, run, optionSafeRun, unsafeErrors };
    });

    expect(state).toEqual({
      syncedFiles: ['project/src/main.js', '-entry.js'],
      spawnCalls: [
        {
          command: 'node',
          args: ['src/main.js', '--verbose'],
          options: { cwd: '/tutorial/project' },
        },
        {
          command: 'node',
          args: ['./-entry.js'],
          options: { cwd: '/tutorial' },
        },
      ],
      run: { exitCode: 0, output: '' },
      optionSafeRun: { exitCode: 0, output: '' },
      unsafeErrors: [
        'Node entry file must stay inside the tutorial workspace',
        'Node entry file must stay inside the tutorial workspace',
        'Node entry file must stay inside the tutorial workspace',
      ],
    });
  });

  test('a timed-out Haskell Run restarts and settles the shared Run transaction', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([{
        title: 'Haskell Run',
        files: [{ path: 'Main.hs', content: 'main = putStrLn "ready"', language: 'haskell' }],
        open_file: 'Main.hs',
      }], { backend: 'haskell', requireTests: false });
      tutorial._syncFileToBackend = () => Promise.resolve();
      await tutorial.loadStep(0);
      tutorial.root.insertAdjacentHTML('beforeend', [
        '<button type="button" class="tvm-run-btn">Run</button>',
        '<button type="button" class="tvm-stop-btn">Stop execution</button>',
      ].join(''));
      tutorial._haskellExecutionTimeoutMs = 5;
      tutorial._worker = { postMessage() {}, terminate() {} };
      let restartCalls = 0;
      tutorial._restartHaskellExecutor = () => {
        restartCalls += 1;
        tutorial.booted = true;
        return Promise.resolve();
      };

      const result = await tutorial._runCurrentFile();
      const runButton = tutorial.root.querySelector('.tvm-run-btn');
      const stopButton = tutorial.root.querySelector('.tvm-stop-btn');
      return {
        result,
        restartCalls,
        pendingRequests: Object.keys(tutorial._workerCallbacks).length,
        activeTransaction: tutorial._activeRunTransaction,
        runDisabled: runButton.disabled,
        stopDisplay: stopButton.style.display,
      };
    });

    expect(state).toEqual({
      result: false,
      restartCalls: 1,
      pendingRequests: 0,
      activeTransaction: null,
      runDisabled: false,
      stopDisplay: 'none',
    });
  });

  test('a Haskell test workspace sync failure settles the active test transaction', async ({ page }) => {
    await loadTutorialRuntime(page);

    await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([{
        title: 'Haskell Tests',
        files: [{ path: 'Main.hs', content: 'double x = x * 2', language: 'haskell' }],
        open_file: 'Main.hs',
        tests: [{ description: 'doubles a value', command: 'double 2 == 4' }],
      }], { backend: 'haskell' });
      tutorial._syncFileToBackend = () => Promise.resolve();
      await tutorial.loadStep(0);
      tutorial._syncFileToBackend = () => Promise.reject(new Error('workspace sync failed'));
      tutorial._runTests();
      window.__haskellSyncFailureTutorial = tutorial;
    });

    await expect.poll(() => page.evaluate(() => {
      const tutorial = window.__haskellSyncFailureTutorial;
      const testButton = tutorial.stepControlsEl.querySelector('.tvm-btn-test');
      return {
        activeRun: tutorial._activeTestRun,
        inFlight: tutorial._testRunInFlight,
        testDisabled: testButton && testButton.disabled,
      };
    })).toEqual({
      activeRun: null,
      inFlight: false,
      testDisabled: false,
    });
  });

  test('WebContainer test results complete the active test transaction', async ({ page }) => {
    await loadTutorialRuntime(page);

    await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([
        {
          title: 'Node Test',
          instructionsHTML: '',
          files: [{ path: 'main.js', content: 'console.log("ready")', language: 'javascript' }],
          open_file: 'main.js',
          tests: [{ description: 'program ran', command: 'assert(output.includes("ready"))' }],
        },
        {
          title: 'Unlocked Step',
          instructionsHTML: '',
          files: [{ path: 'next.js', content: '', language: 'javascript' }],
          open_file: 'next.js',
        },
      ], { backend: 'webcontainer' });
      tutorial._syncFileToBackend = () => Promise.resolve();
      tutorial._runWebContainerNodeFile = () => Promise.resolve({
        exitCode: 0,
        output: 'ready\n',
      });

      await tutorial.loadStep(0);
      tutorial._runTests();
      window.__webContainerTestTutorial = tutorial;
    });

    await expect(page.locator('.tvm-test-summary')).toHaveText('✅ All 1 tests passed!');
    await expect(page.getByRole('button', { name: '✓ Test My Work' })).toBeEnabled();
    const state = await page.evaluate(() => {
      const tutorial = window.__webContainerTestTutorial;
      return {
        inFlight: tutorial._testRunInFlight,
        activeRun: tutorial._activeTestRun,
        passed: Array.from(tutorial._stepsPassed),
        unlocked: Array.from(tutorial._stepsUnlocked),
      };
    });
    expect(state).toEqual({
      inFlight: false,
      activeRun: null,
      passed: [0],
      unlocked: [0, 1],
    });
  });

  test('a WebContainer boot timeout falls back and tears down a late instance', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([], {
        backend: 'webcontainer',
        requireTests: false,
      });
      tutorial.booted = false;
      tutorial._webcontainerBootTimeoutMs = 5;
      tutorial._showLoading = () => {};

      let resolveBoot;
      const bootResult = new Promise((resolve) => { resolveBoot = resolve; });
      tutorial._loadWebContainerAPI = () => Promise.resolve({
        WebContainer: { boot: () => bootResult },
      });

      await tutorial._initBackend();
      const afterFallback = {
        backend: tutorial.config.backend,
        booted: tutorial.booted,
        hasWebContainer: tutorial._webcontainer !== null,
        reason: tutorial._webcontainerUnavailableReason,
      };

      let teardownCalls = 0;
      let finishTeardown;
      const teardownCalled = new Promise((resolve) => { finishTeardown = resolve; });
      resolveBoot({
        teardown() {
          teardownCalls += 1;
          finishTeardown();
        },
      });
      await teardownCalled;

      return { afterFallback, teardownCalls };
    });

    expect(state.afterFallback).toEqual({
      backend: 'browser',
      booted: true,
      hasWebContainer: false,
      reason: 'WebContainer boot timed out after 5 ms',
    });
    expect(state.teardownCalls).toBe(1);
  });

  test('a partial WebContainer initialization is cleaned up before browser fallback', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([], {
        backend: 'webcontainer',
        requireTests: false,
      });
      tutorial.booted = false;
      tutorial._showLoading = () => {};

      let unsubscribeCalls = 0;
      let teardownCalls = 0;
      const partialRuntime = {
        fs: {
          mkdir: () => Promise.reject(new Error('workspace unavailable')),
        },
        on() {
          return () => { unsubscribeCalls += 1; };
        },
        teardown() {
          teardownCalls += 1;
        },
      };
      tutorial._loadWebContainerAPI = () => Promise.resolve({
        WebContainer: { boot: () => Promise.resolve(partialRuntime) },
      });

      await tutorial._initBackend();
      return {
        backend: tutorial.config.backend,
        booted: tutorial.booted,
        hasWebContainer: tutorial._webcontainer !== null,
        unsubscribeCalls,
        teardownCalls,
      };
    });

    expect(state).toEqual({
      backend: 'browser',
      booted: true,
      hasWebContainer: false,
      unsubscribeCalls: 1,
      teardownCalls: 1,
    });
  });

  test('WebContainer global setup is awaited as one state-preserving shell batch', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([], {
        backend: 'webcontainer',
        requireTests: false,
      });
      tutorial.booted = false;
      tutorial._showLoading = () => {};

      const commands = [];
      let finishExit;
      let finishSpawn;
      const commandSpawned = new Promise((resolve) => { finishSpawn = resolve; });
      const runtime = {
        fs: { mkdir: () => Promise.resolve() },
        on: () => () => {},
        teardown: () => {},
        spawn(command, args, options) {
          commands.push({ command, args, cwd: options.cwd });
          const exit = new Promise((resolve) => { finishExit = resolve; });
          finishSpawn();
          return Promise.resolve({
            exit,
            output: {
              getReader: () => ({
                read: () => Promise.resolve({ done: true }),
                cancel: () => Promise.resolve(),
              }),
            },
            kill() {},
          });
        },
      };
      tutorial._loadWebContainerAPI = () => Promise.resolve({
        WebContainer: { boot: () => Promise.resolve(runtime) },
      });

      let initialized = false;
      const initialization = tutorial._initWebContainer(['prepare-one', 'prepare-two'])
        .then(() => { initialized = true; });
      await commandSpawned;
      const beforeExit = { commandCount: commands.length, initialized, booted: tutorial.booted };
      finishExit(0);
      await initialization;

      return {
        beforeExit,
        initialized,
        booted: tutorial.booted,
        commands,
      };
    });

    expect(state.beforeExit).toEqual({ commandCount: 1, initialized: false, booted: false });
    expect(state.initialized).toBe(true);
    expect(state.booted).toBe(true);
    expect(state.commands).toHaveLength(1);
    expect(state.commands[0].cwd).toBe('/tutorial');
    const setupSource = state.commands[0].args.join('\n');
    expect(setupSource.indexOf('prepare-one')).toBeLessThan(setupSource.indexOf('prepare-two'));
  });

  test('failed WebContainer global setup rejects readiness instead of falling back', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([], {
        backend: 'webcontainer',
        requireTests: false,
      });
      tutorial.booted = false;
      tutorial._showLoading = () => {};

      let outputRead = false;
      let teardownCalls = 0;
      const runtime = {
        fs: { mkdir: () => Promise.resolve() },
        on: () => () => {},
        teardown() { teardownCalls += 1; },
        spawn() {
          return Promise.resolve({
            exit: Promise.resolve(9),
            output: {
              getReader: () => ({
                read() {
                  if (outputRead) return Promise.resolve({ done: true });
                  outputRead = true;
                  return Promise.resolve({ done: false, value: 'dependency install failed' });
                },
                cancel: () => Promise.resolve(),
              }),
            },
            kill() {},
          });
        },
      };
      tutorial._loadWebContainerAPI = () => Promise.resolve({
        WebContainer: { boot: () => Promise.resolve(runtime) },
      });

      let setupError;
      try {
        await tutorial._initBackend(undefined, ['install-dependencies']);
      } catch (error) {
        setupError = {
          message: error.message,
          code: error.code,
          exitCode: error.exitCode,
        };
      }

      return {
        setupError,
        backend: tutorial.config.backend,
        booted: tutorial.booted,
        hasWebContainer: tutorial._webcontainer !== null,
        unavailableReason: tutorial._webcontainerUnavailableReason,
        teardownCalls,
      };
    });

    expect(state).toEqual({
      setupError: {
        message: 'WebContainer global setup failed with exit code 9: dependency install failed',
        code: 'WEBCONTAINER_COMMAND_FAILED',
        exitCode: 9,
      },
      backend: 'webcontainer',
      booted: false,
      hasWebContainer: false,
      unavailableReason: null,
      teardownCalls: 1,
    });
  });

  test('WebContainer commands reject nonzero exits and recover after timeouts', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([], {
        backend: 'webcontainer',
        requireTests: false,
      });
      let spawnCount = 0;
      let timedOutProcessKilled = false;
      let spawnCountAtTimeout = null;
      tutorial._webcontainer = {
        spawn() {
          const index = spawnCount++;
          let outputRead = false;
          const exit = index === 0
            ? new Promise(() => {})
            : Promise.resolve(index === 1 ? 0 : 7);
          return Promise.resolve({
            exit,
            output: {
              getReader: () => ({
                read: () => {
                  if (index !== 2 || outputRead) return Promise.resolve({ done: true });
                  outputRead = true;
                  return Promise.resolve({ done: false, value: 'setup broke' });
                },
                cancel: () => Promise.resolve(),
              }),
            },
            kill() {
              if (index === 0) {
                timedOutProcessKilled = true;
                spawnCountAtTimeout = spawnCount;
              }
            },
          });
        },
      };

      let timeoutError;
      const timedCommand = tutorial._runWebContainerCommand('hang', {
        timeoutMs: 5,
        label: 'Timed command',
      }).catch((error) => {
        timeoutError = { message: error.message, code: error.code };
      });

      const recoveryCommand = tutorial._runWebContainerCommand('recover', {
        timeoutMs: 50,
        label: 'Recovery command',
      });
      await timedCommand;
      const recovered = await recoveryCommand;

      let nonzeroError;
      try {
        await tutorial._runWebContainerCommand('fail', {
          timeoutMs: 50,
          label: 'Failing setup',
        });
      } catch (error) {
        nonzeroError = {
          message: error.message,
          code: error.code,
          exitCode: error.exitCode,
          output: error.output,
        };
      }

      return {
        timeoutError,
        timedOutProcessKilled,
        spawnCountAtTimeout,
        recovered,
        nonzeroError,
        spawnCount,
      };
    });

    expect(state.timeoutError).toEqual({
      message: 'Timed command timed out after 5 ms',
      code: 'WEBCONTAINER_COMMAND_TIMEOUT',
    });
    expect(state.timedOutProcessKilled).toBe(true);
    expect(state.spawnCountAtTimeout).toBe(1);
    expect(state.recovered).toEqual({ exitCode: 0, output: '' });
    expect(state.nonzeroError).toEqual({
      message: 'Failing setup failed with exit code 7: setup broke',
      code: 'WEBCONTAINER_COMMAND_FAILED',
      exitCode: 7,
      output: 'setup broke',
    });
    expect(state.spawnCount).toBe(3);
  });

  test('WebContainer step directories change only after an awaited validation succeeds', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([], {
        backend: 'webcontainer',
        requireTests: false,
      });
      const requestedCwds = [];
      let exitCode = 4;
      tutorial._webcontainer = {
        spawn(command, args, options) {
          requestedCwds.push(options.cwd);
          return Promise.resolve({
            exit: Promise.resolve(exitCode),
            output: {
              getReader: () => ({
                read: () => Promise.resolve({ done: true }),
                cancel: () => Promise.resolve(),
              }),
            },
            kill() {},
          });
        },
      };

      let outsideFailure = '';
      try {
        await tutorial._runStepDir({ step_dir: '/tutorial/../../outside' });
      } catch (error) {
        outsideFailure = error.message;
      }

      let failure = '';
      try {
        await tutorial._runStepDir({ step_dir: '/tutorial/work/../project/' });
      } catch (error) {
        failure = error.message;
      }
      const cwdAfterFailure = tutorial._webcontainerCwd;

      exitCode = 0;
      await tutorial._runStepDir({ step_dir: '/tutorial/work/../project/' });
      await tutorial._runSilent('pwd');

      return {
        outsideFailure,
        failure,
        cwdAfterFailure,
        cwdAfterSuccess: tutorial._webcontainerCwd,
        requestedCwds,
      };
    });

    expect(state).toEqual({
      outsideFailure: 'WebContainer step_dir must stay inside /tutorial: /tutorial/../../outside',
      failure: 'WebContainer step directory failed with exit code 4',
      cwdAfterFailure: '/tutorial',
      cwdAfterSuccess: '/tutorial/project',
      requestedCwds: ['/tutorial/project', '/tutorial/project', '/tutorial/project'],
    });
  });

  test('browser Worker preserves Node modules, files, argv, output, and completion cleanup', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([], {
        backend: 'browser',
        requireTests: false,
      });
      tutorial.openFile('dependency.js', 'module.exports = { value: 42 };', 'javascript');
      tutorial.openFile('message.txt', 'hello', 'text');
      const output = [];
      let completionCalls = 0;
      const outcome = await tutorial._runBrowserCode([
        'const dependency = require("./dependency");',
        'const fs = require("fs");',
        'console.log(process.argv.slice(2).join("|"), dependency.value, fs.readFileSync("message.txt", "utf8"));',
      ].join('\n'), (text, kind) => output.push({ text, kind }), () => {
        completionCalls += 1;
      }, 1000, { argv: ['Ada', 'Lovelace'], scriptPath: 'main.js' });
      return {
        outcome,
        output,
        completionCalls,
        runnerWorker: tutorial._jsRunnerWorker,
        finishCallback: tutorial._jsFinish,
        safetyTimer: tutorial._jsSafetyTimer,
      };
    });

    expect(state).toEqual({
      outcome: { ok: true, reason: 'complete' },
      output: [{ text: 'Ada|Lovelace 42 hello\n', kind: 'stdout' }],
      completionCalls: 1,
      runnerWorker: null,
      finishCallback: null,
      safetyTimer: null,
    });
  });

  test('a synchronous browser infinite loop is terminated without freezing the host page', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([], {
        backend: 'browser',
        requireTests: false,
      });
      const output = [];
      const started = performance.now();
      const outcome = await tutorial._runBrowserCode(
        'while (true) {}',
        (text, kind) => output.push({ text, kind }),
        null,
        20,
      );
      const hostStillResponsive = await Promise.resolve(true);
      return {
        outcome,
        output,
        hostStillResponsive,
        elapsed: performance.now() - started,
        runnerWorker: tutorial._jsRunnerWorker,
      };
    });

    expect(state.outcome).toEqual({ ok: false, reason: 'timeout' });
    expect(state.output).toContainEqual({
      text: '\nExecution timed out and was stopped.\n',
      kind: 'stderr',
    });
    expect(state.hostStillResponsive).toBe(true);
    expect(state.elapsed).toBeLessThan(1000);
    expect(state.runnerWorker).toBeNull();
  });

  test('browser Worker servers receive host HTTP requests and return responses', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([{
        title: 'Server',
        http_client: true,
      }], { backend: 'browser', requireTests: false });
      tutorial.currentStep = 0;
      tutorial._httpMethodEl = { value: 'GET' };
      tutorial._httpUrlEl = { value: 'http://localhost:3000/hello/Ada' };
      tutorial._httpBodyEditor = null;
      tutorial._httpResponseBodyEl = document.createElement('pre');
      tutorial._httpResponseMetaEl = document.createElement('div');
      tutorial._httpEmptyEl = document.createElement('div');

      let markReady;
      const ready = new Promise((resolve) => { markReady = resolve; });
      let receiveResponse;
      const response = new Promise((resolve) => { receiveResponse = resolve; });
      tutorial._handleHttpResponse = (message) => receiveResponse(message);
      const run = tutorial._runBrowserCode([
        'const express = require("express");',
        'const app = express();',
        'app.get("/hello/:name", (req, res) => res.json({ hello: req.params.name }));',
        'app.listen(3000);',
      ].join('\n'), (text) => {
        if (text.includes('listening on port 3000')) markReady();
      }, null, 1000, { scriptPath: 'server.js' });

      await ready;
      tutorial._sendHttpRequest();
      const httpResponse = await response;
      tutorial._stopExecution();
      const outcome = await run;
      return {
        status: httpResponse.status,
        body: JSON.parse(httpResponse.body),
        outcome,
        runnerWorker: tutorial._jsRunnerWorker,
      };
    });

    expect(state).toEqual({
      status: 200,
      body: { hello: 'Ada' },
      outcome: { ok: false, reason: 'stopped' },
      runnerWorker: null,
    });
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

  test('background backend prewarming cannot suppress foreground or later loading states', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([
        { title: 'Python', backend: 'pyodide', files: [] },
        { title: 'Node', backend: 'webcontainer', files: [] },
      ], {
        backend: 'multiple',
        requireTests: false,
      });
      tutorial.root.insertAdjacentHTML('beforeend', [
        '<div class="tvm-loading"><span class="tvm-loading-text"></span></div>',
        '<div class="tvm-container"></div>',
      ].join(''));
      tutorial.loadingEl = tutorial.root.querySelector('.tvm-loading');
      tutorial.containerEl = tutorial.root.querySelector('.tvm-container');

      const resolvers = {};
      tutorial._initBackend = (backend, _setupCommands, loadingOptions) => {
        tutorial._showLoading(`Initializing ${backend}`, loadingOptions);
        return new Promise((resolve) => { resolvers[backend] = resolve; });
      };

      const prewarm = tutorial._ensureBackendReady('pyodide', { prewarm: true });
      await Promise.resolve();
      const foreground = tutorial._ensureBackendReady('webcontainer');
      await Promise.resolve();

      const foregroundMessage = tutorial.loadingEl
        .querySelector('.tvm-loading-text').textContent;
      resolvers.pyodide();
      await prewarm;
      resolvers.webcontainer();
      await foreground;

      tutorial._showLoading('Later foreground load');
      return {
        foregroundMessage,
        laterMessage: tutorial.loadingEl.querySelector('.tvm-loading-text').textContent,
        display: tutorial.loadingEl.style.display,
      };
    });

    expect(state).toEqual({
      foregroundMessage: 'Initializing webcontainer',
      laterMessage: 'Later foreground load',
      display: 'flex',
    });
  });

  test('an inactive crashed worker is invalidated and lazily rebuilt when its backend returns', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const OriginalWorker = window.Worker;
      const instances = [];

      class RecoverableWorker {
        constructor() {
          this.terminated = false;
          instances.push(this);
          queueMicrotask(() => this.onmessage({ data: { type: 'ready' } }));
        }

        postMessage() {}

        terminate() {
          this.terminated = true;
        }
      }

      window.Worker = RecoverableWorker;
      try {
        const tutorial = window.__installTutorialHarness([
          { title: 'Python', backend: 'pyodide', files: [] },
          { title: 'React', backend: 'react', files: [] },
        ], {
          backend: 'multiple',
          requireTests: false,
        });
        tutorial._showLoading = () => {};
        tutorial._hideLoading = () => {};

        await tutorial._ensureBackendReady('pyodide');
        const crashedWorker = tutorial._worker;
        tutorial._backendReady.react = true;
        tutorial._setActiveBackend('react');

        crashedWorker.onerror({ message: 'inactive Python crash' });
        await Promise.resolve();
        const stateAfterCrash = {
          workerCleared: tutorial._worker === null,
          pythonReady: !!tutorial._backendReady.pyodide,
          reactStillBooted: tutorial.booted,
        };

        await tutorial._ensureBackendReady('pyodide');
        return {
          stateAfterCrash,
          workerCount: instances.length,
          crashedWorkerTerminated: crashedWorker.terminated,
          workerReplaced: tutorial._worker !== null && tutorial._worker !== crashedWorker,
          pythonReady: !!tutorial._backendReady.pyodide,
          booted: tutorial.booted,
        };
      } finally {
        window.Worker = OriginalWorker;
      }
    });

    expect(state).toEqual({
      stateAfterCrash: {
        workerCleared: true,
        pythonReady: false,
        reactStillBooted: true,
      },
      workerCount: 2,
      crashedWorkerTerminated: true,
      workerReplaced: true,
      pythonReady: true,
      booted: true,
    });
  });

  test('a failed worker restart clears stale readiness so the next use retries initialization', async ({ page }) => {
    await loadTutorialRuntime(page);

    const state = await page.evaluate(async () => {
      const tutorial = window.__installTutorialHarness([], {
        backend: 'pyodide',
        requireTests: false,
      });
      tutorial._showLoading = () => {};
      tutorial._hideLoading = () => {};
      tutorial._showError = () => {};
      tutorial._replayWorkerWorkspace = () => Promise.resolve();
      tutorial._syncFilesToBackend = () => Promise.resolve();
      tutorial._runStepWorkerSetupCommands = () => Promise.resolve();

      let initializationCount = 0;
      tutorial._initBackend = () => {
        initializationCount += 1;
        if (initializationCount === 2) {
          return Promise.reject(new Error('replacement failed'));
        }
        tutorial.booted = true;
        return Promise.resolve();
      };

      await tutorial._ensureBackendReady('pyodide');
      let restartError = '';
      try {
        await tutorial._restartWorkerBackend('simulated crash', 'pyodide');
      } catch (error) {
        restartError = error.message;
      }
      const readyAfterFailedRestart = !!tutorial._backendReady.pyodide;

      await tutorial._ensureBackendReady('pyodide');
      return {
        initializationCount,
        restartError,
        readyAfterFailedRestart,
        readyAfterRetry: !!tutorial._backendReady.pyodide,
      };
    });

    expect(state).toEqual({
      initializationCount: 3,
      restartError: 'replacement failed',
      readyAfterFailedRestart: false,
      readyAfterRetry: true,
    });
  });
});
