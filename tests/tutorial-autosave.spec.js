// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { a11yCheckpoint } = require('./a11y-helpers');

const PROGRESS_KEY = 'tutorial-progress-autosave-contract-test';

async function installAutosaveHarness(page) {
  await page.goto('/');
  await page.setContent(`
    <main>
      <label id="autoSaveLabel">
        Auto-save
        <span id="tutorialAutosaveVisibleStatus" class="is-hidden" aria-hidden="true"></span>
        <span id="tutorialAutosaveStatus" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></span>
        <input type="checkbox" aria-label="Auto-save" checked>
      </label>
      <div class="tvm-editor-tabs"><div class="tvm-tab active"></div></div>
      <div id="tutorial-root"></div>
    </main>
  `);
  await page.addScriptTag({
    path: path.join(__dirname, '..', 'js', 'tutorial-code.js'),
  });
  await page.evaluate(() => {
    const tutorial = new window.TutorialCode(
      document.getElementById('tutorial-root'),
      {
        backend: 'browser',
        tutorialId: 'autosave-contract-test',
        autosaveType: 'files',
        steps: [{ title: 'Autosave Contract' }],
      },
    );
    tutorial.currentStep = 0;
    tutorial.activeFileName = 'main.js';
    tutorial._originalContent['main.js'] = 'starter';
    window.__autosaveModelValue = 'learner edit';
    tutorial.editorModels['main.js'] = {
      model: {
        getValue: () => window.__autosaveModelValue,
        getLanguageId: () => 'javascript',
      },
    };
    tutorial.editorTabsEl = document.querySelector('.tvm-editor-tabs');
    tutorial.editorTabsElRight = null;
    tutorial._syncFileToBackend = () => Promise.resolve();
    window.__autosaveTutorial = tutorial;
  });
}

async function rejectProgressWrites(page) {
  await page.evaluate((progressKey) => {
    window.__realStorageSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === progressKey) {
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      }
      return window.__realStorageSetItem.call(this, key, value);
    };
  }, PROGRESS_KEY);
}

test.describe('tutorial autosave persistence contract', () => {
  test('saveProgress returns true only after persisting the learner state', async ({ page }) => {
    await installAutosaveHarness(page);

    const result = await page.evaluate(() => window.__autosaveTutorial.saveProgress());
    const stored = await page.evaluate((progressKey) => {
      return JSON.parse(localStorage.getItem(progressKey) || 'null');
    }, PROGRESS_KEY);

    expect(result).toBe(true);
    expect(stored.step).toBe(0);
    expect(stored.files['main.js'].content).toBe('learner edit');
    expect(stored.files['main.js'].language).toBe('javascript');
  });

  test('a rejected write returns false and announces that changes are not saved', async ({ page }) => {
    await installAutosaveHarness(page);
    await rejectProgressWrites(page);

    const result = await page.evaluate(() => window.__autosaveTutorial._autoSaveProgress());

    expect(result).toBe(false);
    await expect(page.getByRole('status')).toHaveText(
      'Auto-save failed. Your latest changes are not saved. Copy them before reloading, then try again.',
    );
    await expect(page.getByText('Save failed', { exact: true })).toBeVisible();
    await expect(page.getByRole('status')).not.toHaveText('Saved');
    expect(await page.evaluate((progressKey) => localStorage.getItem(progressKey), PROGRESS_KEY))
      .toBeNull();
    await a11yCheckpoint(page, 'tutorial autosave write failure', {
      feature: 'tutorial-autosave',
      include: 'main',
    });
  });

  test('an explicit save does not report success when persistence fails', async ({ page }) => {
    await installAutosaveHarness(page);
    await rejectProgressWrites(page);

    const result = await page.evaluate(() => window.__autosaveTutorial._saveCurrentFile());

    expect(result).toBe(false);
    await expect(page.getByRole('status')).toContainText('Auto-save failed');
    await expect(page.getByRole('status')).not.toHaveText('Saved');
  });

  test('an explicit save removes a stale override after restoring starter content', async ({ page }) => {
    await installAutosaveHarness(page);
    await page.evaluate(() => window.__autosaveTutorial.saveProgress());

    const state = await page.evaluate(() => {
      window.__autosaveModelValue = 'starter';
      const saved = window.__autosaveTutorial._saveFile('main.js');
      return {
        saved,
        progress: window.__autosaveTutorial._loadSavedProgress(),
      };
    });

    expect(state.saved).toBe(true);
    expect(state.progress.files).not.toHaveProperty('main.js');
  });

  test('a later successful write clears the failure and reports recovery', async ({ page }) => {
    await installAutosaveHarness(page);
    await rejectProgressWrites(page);
    await page.evaluate(() => window.__autosaveTutorial._autoSaveProgress());

    const result = await page.evaluate(() => {
      Storage.prototype.setItem = window.__realStorageSetItem;
      return window.__autosaveTutorial._autoSaveProgress();
    });

    expect(result).toBe(true);
    await expect(page.getByRole('status')).toHaveText('Saved');
    await expect(page.getByText('Save failed', { exact: true })).toHaveCount(0);
    expect(await page.evaluate((progressKey) => localStorage.getItem(progressKey), PROGRESS_KEY))
      .not.toBeNull();
  });

  test('reset completion cannot recreate progress after autosave is disabled and deleted', async ({ page }) => {
    await installAutosaveHarness(page);
    await page.evaluate(() => window.__autosaveTutorial.saveProgress());

    const state = await page.evaluate((progressKey) => {
      const tutorial = window.__autosaveTutorial;
      tutorial.autoSaveEnabled = false;
      localStorage.setItem('tutorial-autosave', 'false');
      localStorage.removeItem(progressKey);

      // Both command-reset completion paths call this helper unconditionally.
      const resetCompletionResult = tutorial._autoSaveProgress();
      return {
        resetCompletionResult,
        progress: localStorage.getItem(progressKey),
        status: document.getElementById('tutorialAutosaveStatus').textContent,
        visibleStatus: document.getElementById('tutorialAutosaveVisibleStatus').textContent,
      };
    }, PROGRESS_KEY);

    expect(state).toEqual({
      resetCompletionResult: false,
      progress: null,
      status: '',
      visibleStatus: '',
    });
  });
});
