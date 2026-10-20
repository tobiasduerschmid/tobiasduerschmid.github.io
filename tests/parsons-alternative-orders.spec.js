// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

// Mirrors the C tutorial question: the two struct fields are independent.
const RECTANGLE = {
  question: 'Arrange the lines to define a `Rectangle` struct.',
  type: 'parsons',
  lines: ['typedef struct {', '    double width;', '    double height;', '} Rectangle;'],
  interchangeable: [[[1], [2]]],
  distractors: ['class Rectangle {'],
  explanation: 'The struct members may be declared in either order.',
};

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsonsLine(page, text) {
  return page.getByRole('button', { name: new RegExp('^Line \\d+:\\s*' + escapeRegex(text.trim()) + '$') });
}

async function mountKnowledgeCheck(page) {
  await page.setContent('<main><h1>Knowledge check</h1><div id="quiz"></div><div id="controls"></div><output aria-label="Progression result">Waiting</output></main>');
  await page.addStyleTag({ content: '.hidden,.is-hidden{display:none}.quiz-question-card:not(.active){display:none}' });
  await page.addScriptTag({ path: path.join(__dirname, '..', 'js/parsons-grading.js') });
  await page.addScriptTag({ path: path.join(__dirname, '..', 'js/tutorial-quiz.js') });
  await page.evaluate((question) => {
    window.SebookQuiz.mount({
      hostEl: document.getElementById('quiz'), controlsEl: document.getElementById('controls'),
      stepIndex: 0, quiz: { questions: [question] },
      onPass: () => { document.querySelector('output').textContent = 'Passed'; },
    });
  }, RECTANGLE);
}

async function answerWith(page, lines) {
  for (const text of lines) await parsonsLine(page, text).press('Space');
  await page.getByRole('button', { name: 'Check Order', exact: true }).click();
  await page.getByRole('button', { name: 'See Results', exact: true }).click();
}

test('a Parsons answer that swaps interchangeable lines passes the knowledge check', async ({ page }) => {
  await mountKnowledgeCheck(page);
  await answerWith(page, ['typedef struct {', '    double height;', '    double width;', '} Rectangle;']);
  await page.getByRole('button', { name: /Continue to Step 2/ }).click();
  await expect(page.getByLabel('Progression result')).toHaveText('Passed');
});

test('a Parsons answer that moves a fixed line still fails the knowledge check', async ({ page }) => {
  await mountKnowledgeCheck(page);
  await answerWith(page, ['    double width;', 'typedef struct {', '    double height;', '} Rectangle;']);
  await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
  await expect(page.getByLabel('Progression result')).toHaveText('Waiting');
});
