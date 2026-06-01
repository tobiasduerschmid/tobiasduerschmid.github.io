// @ts-check
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { expect } = require('@playwright/test');

/**
 * Load and parse a tutorial YAML config file.
 * @param {string} tutorialId — e.g. 'nodejs', 'python', 'react', 'shell-scripting'
 * @returns {object} parsed YAML config with steps array
 */
function loadTutorialConfig(tutorialId) {
  const yamlPath = path.resolve(__dirname, '..', '_data', 'tutorials', `${tutorialId}.yml`);
  const raw = fs.readFileSync(yamlPath, 'utf8');
  return yaml.load(raw);
}

/**
 * Apply the solution for the current step via the tutorial's applySolution()
 * method, which handles files, commands, and backend-specific concerns.
 */
async function applySolution(page) {
  await page.evaluate(() => window._tutorial.applySolution());
}

/**
 * Wait until Monaco has created at least one editor model.
 */
async function waitForEditorReady(page, timeout = 15_000) {
  await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0, { timeout });
}

/**
 * Wait for the tutorial shell to finish booting.
 */
async function waitForTutorialReady(page, options = {}) {
  const {
    readySelector = '.tvm-output-panel',
    bootTimeout = 60_000,
    stepTimeout = 10_000,
  } = options;

  await page.waitForSelector(readySelector, { timeout: bootTimeout });
  await page.waitForSelector('.tvm-step-btn', { timeout: stepTimeout });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: bootTimeout });
}

function stepButton(page, stepIndex) {
  return page.getByRole('button', {
    name: new RegExp(`^Step ${stepIndex + 1}:`),
  });
}

async function expectActiveStep(page, stepIndex, options = {}) {
  await expect(stepButton(page, stepIndex)).toHaveAttribute('aria-current', 'step', options);
}

async function clickStep(page, stepIndex) {
  await stepButton(page, stepIndex).click();
  await expectActiveStep(page, stepIndex);
}

async function currentStepIndex(page) {
  const label = await page.locator('.tvm-step-btn[aria-current="step"]').getAttribute('aria-label');
  const match = /^Step\s+(\d+):/.exec(label || '');
  if (!match) throw new Error(`Could not read active tutorial step from aria-label: ${label || '<missing>'}`);
  return Number(match[1]) - 1;
}

async function expectStepCount(page, expected) {
  await expect(page.getByRole('button', { name: /^Step \d+:/ })).toHaveCount(expected);
}

async function runCurrentStepTests(page, timeout = 30_000) {
  await page.getByRole('button', { name: /test my work/i }).click();
  await expect(page.locator('.tvm-test-summary')).toContainText(/All \d+ tests passed!/, { timeout });
}

async function expectRenderedStepTests(page, step) {
  const descriptions = (step.tests || []).map((item) => item.description);
  await expect(page.locator('.tvm-test-item .tvm-test-desc')).toHaveText(descriptions);
}

/**
 * Apply the solution and pass all tests on the current step.
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout — max wait for all-pass summary
 */
async function passCurrentStepTests(page, timeout = 30_000) {
  await waitForEditorReady(page);
  await applySolution(page);
  await runCurrentStepTests(page, timeout);
}

async function pressOptionShortcut(page, option) {
  await expect(option).toBeVisible({ timeout: 5_000 });
  const shortcuts = (await option.getAttribute('aria-keyshortcuts') || '').trim().split(/\s+/).filter(Boolean);
  if (!shortcuts.length) {
    throw new Error('Quiz option is missing aria-keyshortcuts');
  }
  await option.evaluate((el) => {
    try { el.focus({ preventScroll: true }); }
    catch (e) { el.focus(); }
  });
  await page.keyboard.press(shortcuts[0]);
}

/**
 * Answer every question in the currently visible quiz correctly.
 * Reads data-correct / data-correct-indices attributes — robust to shuffling.
 */
async function answerQuizCorrectly(page) {
  while (true) {
    const results = page.locator('.tvm-quiz-panel .quiz-results:not(.hidden)');
    if (await results.count() > 0) break;

    const card = page.locator('.tvm-quiz-panel .quiz-question-card.active');
    await expect(card).toBeVisible({ timeout: 5_000 });

    const type = await card.getAttribute('data-type');
    if (type === 'multiple') {
      const firstOption = card.locator('.quiz-option').first();
      const correctStr = await firstOption.getAttribute('data-correct-indices') || '';
      const correctSet = new Set(correctStr.split(',').map(Number));
      const options = card.locator('.quiz-option');
      const count = await options.count();
      for (let i = 0; i < count; i++) {
        const option = options.nth(i);
        if (correctSet.has(Number(await option.getAttribute('data-index')))) {
          await pressOptionShortcut(page, option);
        }
      }
      await page.keyboard.press('Enter');
    } else if (type === 'parsons') {
      // Move lines from bank to target in the correct order, then click Check
      await page.evaluate(() => {
        const card = document.querySelector('.tvm-quiz-panel .quiz-question-card.active');
        const correctData = card.querySelector('.parsons-correct-data');
        const correct = JSON.parse(correctData.dataset.correct);
        const target = card.querySelector('.parsons-target');
        const bank = card.querySelector('.parsons-bank');
        correct.forEach(lineText => {
          const lines = Array.from(bank.querySelectorAll('.parsons-line'));
          const el = lines.find(l => l.dataset.line === lineText);
          if (el) target.appendChild(el);
        });
        card.querySelector('.parsons-check-btn').click();
      });
    } else {
      const firstOption = card.locator('.quiz-option').first();
      const correctIdx = await firstOption.getAttribute('data-correct');
      const options = card.locator('.quiz-option');
      const count = await options.count();
      for (let i = 0; i < count; i++) {
        const option = options.nth(i);
        if (await option.getAttribute('data-index') === correctIdx) {
          await pressOptionShortcut(page, option);
          break;
        }
      }
    }

    const nextBtn = card.locator('.next-btn');
    await expect(nextBtn).toBeVisible({ timeout: 3_000 });
    await nextBtn.click();
  }
}

/**
 * Unlock the next step: apply solution, pass tests, answer quiz, click continue.
 */
async function unlockNextStep(page, testTimeout = 30_000) {
  const beforeStep = await currentStepIndex(page);
  await passCurrentStepTests(page, testTimeout);
  await page.getByRole('button', { name: /next/i }).click();
  await page.waitForSelector('.tvm-quiz-panel .quiz-question-card.active', { timeout: 5_000 });
  await answerQuizCorrectly(page);
  await page.getByRole('button', { name: /continue/i }).click();
  await expectActiveStep(page, beforeStep + 1);
}

/**
 * Set the Monaco editor content for the active file.
 */
async function setEditorContent(page, content) {
  return page.evaluate(async (text) => {
    const tutorial = window._tutorial;
    const activeFile = tutorial?.activeFileName || tutorial?._rightActiveFile || tutorial?._leftActiveFile;
    const activeModel = activeFile && tutorial?.editorModels?.[activeFile]?.model;
    const fallbackModel = tutorial?.editor?.getModel?.()
      || window.monaco?.editor?.getEditors?.()?.[0]?.getModel?.();
    const model = activeModel || fallbackModel;
    if (!model) return false;
    model.setValue(text);
    if (tutorial && activeFile && typeof tutorial._syncFileToBackend === 'function') {
      await tutorial._syncFileToBackend(activeFile);
    }
    return true;
  }, content);
}

/**
 * Set a named tutorial file and sync it to the backing runtime.
 * Useful for split-editor tutorials where the run file is not always the
 * currently focused Monaco model.
 */
async function setTutorialFileContent(page, filename, content) {
  return page.evaluate(async ({ filename: target, content: text }) => {
    const tutorial = window._tutorial;
    const entry = tutorial?.editorModels?.[target];
    if (!tutorial || !entry?.model) return false;
    entry.model.setValue(text);
    if (typeof tutorial._setActiveFile === 'function') {
      tutorial._setActiveFile(target);
    }
    if (typeof tutorial._syncFileToBackend === 'function') {
      await tutorial._syncFileToBackend(target);
    }
    return true;
  }, { filename, content });
}

module.exports = {
  loadTutorialConfig,
  applySolution,
  waitForEditorReady,
  waitForTutorialReady,
  stepButton,
  expectActiveStep,
  clickStep,
  currentStepIndex,
  expectStepCount,
  runCurrentStepTests,
  expectRenderedStepTests,
  passCurrentStepTests,
  answerQuizCorrectly,
  unlockNextStep,
  setEditorContent,
  setTutorialFileContent,
};
