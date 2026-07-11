const { test, expect } = require('@playwright/test');
const path = require('path');

async function loadTutorialRuntime(page) {
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
});
