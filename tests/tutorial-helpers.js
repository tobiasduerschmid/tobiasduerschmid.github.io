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
 * Apply the solution and pass all tests on the current step.
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout — max wait for all-pass summary
 */
async function passCurrentStepTests(page, timeout = 30_000) {
  await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
    { timeout: 15_000 });
  await applySolution(page);
  await page.locator('.tvm-btn-test').click();
  await expect(page.locator('.tvm-test-summary.all-pass')).toBeVisible({ timeout });
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
      const correctStr = await firstOption.getAttribute('data-correct-indices');
      const correctSet = new Set(correctStr.split(',').map(Number));
      const options = card.locator('.quiz-option');
      const count = await options.count();
      for (let i = 0; i < count; i++) {
        if (correctSet.has(Number(await options.nth(i).getAttribute('data-index'))))
          await options.nth(i).click();
      }
      await card.locator('.submit-answer-btn').click();
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
        if (await options.nth(i).getAttribute('data-index') === correctIdx) {
          await options.nth(i).click();
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
  await passCurrentStepTests(page, testTimeout);
  await page.locator('.tvm-btn-next').click();
  await page.waitForSelector('.tvm-quiz-panel .quiz-question-card.active', { timeout: 5_000 });
  await answerQuizCorrectly(page);
  await page.locator('.tvm-quiz-continue-btn').click();
  await page.waitForTimeout(500);
}

/**
 * Set the Monaco editor content for the active file.
 */
async function setEditorContent(page, content) {
  return page.evaluate((text) => {
    const editors = window.monaco?.editor?.getEditors?.();
    if (!editors || editors.length === 0) return false;
    editors[0].getModel().setValue(text);
    return true;
  }, content);
}

module.exports = {
  loadTutorialConfig,
  applySolution,
  passCurrentStepTests,
  answerQuizCorrectly,
  unlockNextStep,
  setEditorContent,
};
