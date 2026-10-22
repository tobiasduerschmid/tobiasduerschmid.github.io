// @ts-check
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig, waitForTutorialReady, setTutorialFileContent,
  stepButton, expectActiveStep,
} = require('./tutorial-helpers');

const playwright = loadTutorialConfig('playwright');
const doubles = loadTutorialConfig('test-doubles');
const draft = (content, language = 'javascript') => ({ content, language });
const starter = (config, index, filename) => config.steps[index].files.find(file => file.path === filename).content;
const readFile = (page, filename) => page.evaluate(name => window._tutorial.editorModels[name]?.model.getValue(), filename);
const savedProgress = (page, id) => page.evaluate(key => JSON.parse(localStorage.getItem(key)), `tutorial-progress-${id}`);

const waitForDraftTutorialReady = (page, id) => waitForTutorialReady(page, {
  bootTimeout: 90_000,
  readySelector: id === 'playwright' ? '.tvm-preview-frame' : '.tvm-output-panel',
});

async function openSavedTutorial(page, id, config, progress) {
  await page.goto('/');
  await page.evaluate(({ id, count, progress }) => {
    localStorage.setItem('tutorial-autosave', 'true');
    localStorage.setItem(`tutorial-progress-${id}`, JSON.stringify({
      stepsUnlocked: Array.from({ length: count }, (_, index) => index),
      stepsVisited: [progress.step], stepsPassed: [], quizPassed: [], ...progress,
    }));
  }, { id, count: config.steps.length, progress });
  const section = id === 'playwright' ? 'tools' : 'testing';
  await page.goto(`/SEBook/${section}/${id}-tutorial?autosave=true`);
  await waitForDraftTutorialReady(page, id);
  await expectActiveStep(page, progress.step);
}

async function revisit(page, index) {
  await stepButton(page, index).click();
  await expectActiveStep(page, index);
  await expect(page.locator('.tvm-loading')).toBeHidden();
}

test.describe('testing tutorial saved-draft upgrades', () => {
  test.setTimeout(150_000);

  test('Playwright restores a shared save with empty scopes only to its recorded lesson', async ({ page }) => {
    const index = 2;
    const appPath = 'src/App.jsx';
    const specPath = 'tests/locator-ladder.spec.js';
    const app = starter(playwright, index, appPath).replace('<h1>Todo Lab</h1>', '<h1>Saved draft</h1>');
    const spec = '// learner locator work\n' + starter(playwright, index, specPath);
    const orphanPath = 'tests/all-done.spec.js';
    const orphan = draft('// earlier source whose lesson cannot be established\n');
    await openSavedTutorial(page, 'playwright', playwright, {
      step: index, activeFile: specPath, stepFiles: {},
      files: { [appPath]: draft(app, 'javascript'), [specPath]: draft(spec), [orphanPath]: orphan },
    });
    await expect.poll(() => readFile(page, appPath)).toBe(app);
    await expect.poll(() => readFile(page, specPath)).toBe(spec);
    await expect(page.frameLocator('iframe[title="Live preview"]').getByRole('heading', { name: 'Saved draft' })).toBeVisible();

    const edited = '// edited after upgrade\n' + spec;
    expect(await setTutorialFileContent(page, specPath, edited)).toBe(true);
    await revisit(page, 3);
    await expect.poll(() => readFile(page, appPath)).toBe(starter(playwright, 3, appPath));
    await revisit(page, index);
    await expect.poll(() => readFile(page, specPath)).toBe(edited);
    // Clear the navigation hash: this exercises persisted resume, not a deep link.
    await page.evaluate(() => history.replaceState(null, '', location.pathname + location.search));
    await page.reload();
    await waitForDraftTutorialReady(page, 'playwright');
    await expectActiveStep(page, index);
    await expect.poll(() => readFile(page, appPath)).toBe(app);
    await expect.poll(() => readFile(page, specPath)).toBe(edited);

    await revisit(page, 7);
    await expect.poll(() => readFile(page, orphanPath)).toBe(starter(playwright, 7, orphanPath));
    expect((await savedProgress(page, 'playwright')).files[orphanPath]).toEqual(orphan);
    await revisit(page, index);
    await page.evaluate(() => window._tutorial.resetStep());
    await expect.poll(() => readFile(page, appPath)).toBe(starter(playwright, index, appPath));
    await page.evaluate(() => history.replaceState(null, '', location.pathname + location.search));
    await page.reload();
    await waitForDraftTutorialReady(page, 'playwright');
    await expect.poll(() => readFile(page, appPath)).toBe(starter(playwright, index, appPath));
    await expect.poll(() => readFile(page, specPath)).toBe(starter(playwright, index, specPath));
  });

  test('Test Doubles preserves existing index scopes while upgrading the active shared test', async ({ page }) => {
    const index = 2;
    const servicePath = 'quest_service.py';
    const testPath = 'test_quest_service.py';
    const service = '# saved spy exercise\n' + starter(doubles, index, servicePath);
    const suite = '# saved learner assertions\n' + starter(doubles, index, testPath);
    const earlier = '# saved stub exercise\n' + starter(doubles, 1, servicePath);
    await openSavedTutorial(page, 'test-doubles', doubles, {
      step: index, activeFile: testPath,
      files: { [testPath]: draft(suite, 'python') },
      stepFiles: {
        'index:1': { [servicePath]: draft(earlier, 'python') },
        'index:2': { [servicePath]: draft(service, 'python') },
      },
    });
    await expect.poll(() => readFile(page, servicePath)).toBe(service);
    await expect.poll(() => readFile(page, testPath)).toBe(suite);
    await revisit(page, 1);
    await expect.poll(() => readFile(page, servicePath)).toBe(earlier);
    await expect.poll(() => readFile(page, testPath)).toBe(starter(doubles, 1, testPath));
    await revisit(page, 3);
    await expect.poll(() => readFile(page, servicePath)).toBe(starter(doubles, 3, servicePath));
    await revisit(page, index);
    await page.evaluate(() => history.replaceState(null, '', location.pathname + location.search));
    await page.reload();
    await waitForDraftTutorialReady(page, 'test-doubles');
    await expect.poll(() => readFile(page, servicePath)).toBe(service);
    await expect.poll(() => readFile(page, testPath)).toBe(suite);
    expect((await savedProgress(page, 'test-doubles')).stepFiles['index:1'][servicePath].content).toBe(earlier);
  });

  for (const localReset of [false, true]) {
    test(`a local ${localReset ? 'reset' : 'draft'} wins over conflicting shared source and reset stays reset`, async ({ page }) => {
      const filename = 'src/App.jsx';
      const original = starter(playwright, 0, filename);
      const globalSource = draft('// old shared source\n' + original);
      const localSource = '// newer lesson source\n' + original;
      await openSavedTutorial(page, 'playwright', playwright, {
        step: 0, activeFile: filename, files: { [filename]: globalSource },
        stepFiles: { 'index:0': { [filename]: localReset ? null : draft(localSource) } },
      });
      await expect.poll(() => readFile(page, filename)).toBe(localReset ? original : localSource);
      expect((await savedProgress(page, 'playwright')).files[filename]).toEqual(globalSource);
      await page.evaluate(() => window._tutorial.resetStep());
      await revisit(page, 1);
      await revisit(page, 0);
      await page.evaluate(() => history.replaceState(null, '', location.pathname + location.search));
      await page.reload();
      await waitForDraftTutorialReady(page, 'playwright');
      await expect.poll(() => readFile(page, filename)).toBe(original);
      // Conflicting source remains recoverable, but never becomes the active draft again.
      expect((await savedProgress(page, 'playwright')).files[filename]).toEqual(globalSource);
    });
  }
});

// Small storage-contract cases use the actual browser runtime without booting
// unrelated language engines. The full tutorial cases above cover UI lifecycle.
async function loadStorageRuntime(page) {
  await page.goto('/');
  await page.setContent('<main id="tutorial-root"></main>');
  await page.addScriptTag({ path: path.join(__dirname, '..', 'js', 'tutorial-code.js') });
}

test('shared owners and unmatched source are not reattributed after the resume step changes', async ({ page }) => {
  await loadStorageRuntime(page);
  const result = await page.evaluate(() => {
    const steps = [
      { files: [{ path: 'shared.js', content: 'shared starter' }] },
      { files: [{ path: 'shared.js', content: 'local starter', reseed: true }] },
      { files: [{ path: 'later.js', content: 'later starter', reseed: true }] },
    ];
    const t = new window.TutorialCode('#tutorial-root', { steps, tutorialId: 'draft-upgrade-test', autosaveType: 'files' });
    const files = { 'shared.js': { content: 'shared work' }, 'later.js': { content: 'unmatched work' } };
    localStorage.setItem(t._storageKey(), JSON.stringify({ step: 1, files, stepFiles: {} }));
    const initial = t._draftProgress(true);
    const local = t._draftsForStep(initial, 1)['shared.js'];
    t.currentStep = 2;
    t.saveProgress();
    const restored = t._draftProgress(true);
    return {
      shared: t._draftsForStep(initial, 0)['shared.js'],
      local: local === undefined ? null : local,
      later: t._draftsForStep(restored, 2)['later.js'] || null,
      files: restored.files,
    };
  });
  expect(result).toEqual({
    shared: { content: 'shared work' }, local: null, later: null,
    files: { 'shared.js': { content: 'shared work' }, 'later.js': { content: 'unmatched work' } },
  });
});

for (const versioned of [false, true]) {
  test(`${versioned ? 'versioned removed' : 'ambiguous legacy'} Haskell source never attaches to the resume fallback`, async ({ page }) => {
    await loadStorageRuntime(page);
    const result = await page.evaluate(versioned => {
      const steps = ['replacement', 'continuing'].map(key => ({
        key, open_file: 'Main.hs', files: [{ path: 'Main.hs', content: `-- ${key}`, reseed: true }],
      }));
      const t = new window.TutorialCode('#tutorial-root', {
        steps, tutorialId: 'haskell-draft-upgrade-test', autosaveType: 'files',
        progressVersion: 2, legacyStepKeys: ['removed', 'continuing'],
      });
      const source = { 'Main.hs': { content: '-- learner work in the removed lesson', language: 'haskell' } };
      localStorage.setItem(t._storageKey(), JSON.stringify({
        step: 0, activeFile: 'Main.hs', files: source,
        ...(versioned ? { progressVersion: 1, stepKeys: ['removed', 'continuing'] } : {}),
      }));
      const first = t._draftProgress(true);
      const beforeSave = t._draftsForStep(first, 0)['Main.hs'] || null;
      t.currentStep = first.step;
      t.saveProgress();
      const restored = t._draftProgress(true);
      return { beforeSave, afterSave: t._draftsForStep(restored, 0)['Main.hs'] || null, files: restored.files };
    }, versioned);
    expect(result).toEqual({
      beforeSave: null, afterSave: null,
      files: { 'Main.hs': { content: '-- learner work in the removed lesson', language: 'haskell' } },
    });
  });
}
