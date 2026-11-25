const { test, expect } = require('@playwright/test');
const path = require('node:path');

const single = {
  question: 'Which value is even?', type: 'single',
  options: ['Two', 'Three'], correct_index: 0,
  explanation: 'Two is divisible by two.',
};
const multiple = {
  question: 'Select the required colors; green is optional.', type: 'multiple',
  options: ['Red', 'Blue', 'Green', 'Black'], correct_indices: [0, 1], optional_indices: [2],
  explanation: 'Red and blue are required; green is accepted too.',
};
const parsons = {
  question: 'Put preparation before serving.', type: 'parsons',
  lines: ['Prepare', 'Serve'], distractors: ['Discard'],
  explanation: 'Prepare before serving, without discarding.',
};

for (const { name, question, choices, correct } of [
  { name: 'correct single answer', question: single, choices: ['Two'], correct: true },
  { name: 'wrong single answer', question: single, choices: ['Three'], correct: false },
  { name: 'missing required selection', question: multiple, choices: ['Red'], correct: false },
  { name: 'extra incorrect selection', question: multiple, choices: ['Red', 'Blue', 'Black'], correct: false },
  { name: 'required selections only', question: multiple, choices: ['Red', 'Blue'], correct: true },
  { name: 'accepted optional selection', question: multiple, choices: ['Red', 'Blue', 'Green'], correct: true },
  { name: 'correct Parsons order', question: parsons, choices: ['Prepare', 'Serve'], correct: true },
  { name: 'wrong Parsons order', question: parsons, choices: ['Serve', 'Prepare'], correct: false },
]) {
  test(`answer callback reports ${name} after feedback appears`, async ({ page }) => {
    await page.setContent('<main><h1>Knowledge check</h1><div id="quiz"></div><div id="controls"></div><output aria-label="Answer result">Unanswered</output></main>');
    await page.addStyleTag({ content: '.hidden,.is-hidden{display:none}.quiz-question-card:not(.active){display:none}' });
    await page.addScriptTag({ path: path.join(__dirname, '..', 'js/parsons-grading.js') });
    await page.addScriptTag({ path: path.join(__dirname, '..', 'js/tutorial-quiz.js') });
    await page.evaluate(question => {
      let answers = 0;
      window.SebookQuiz.mount({
        hostEl: document.getElementById('quiz'), controlsEl: document.getElementById('controls'),
        stepIndex: 0, quiz: { shuffle: false, questions: [question] }, onPass: () => {},
        onAnswer: ({ card, isCorrect }) => {
          const feedbackVisible = card.querySelector('.quiz-explanation').checkVisibility();
          document.querySelector('output').textContent = JSON.stringify({
            answers: ++answers, correct: isCorrect, feedbackVisible,
            question: card.querySelector('.question-text').textContent,
          });
        },
      });
    }, question);
    await expect(page.getByLabel('Answer result')).toHaveText('Unanswered');
    for (const choice of choices) {
      if (question.type === 'parsons') {
        await page.getByRole('button', { name: new RegExp(`^Line \\d+: ${choice}$`) }).press('Space');
      } else {
        await page.getByRole(question.type === 'multiple' ? 'checkbox' : 'radio').filter({ hasText: choice }).click();
      }
    }
    if (question.type !== 'single') {
      await expect(page.getByLabel('Answer result')).toHaveText('Unanswered');
      await page.getByRole('button', { name: question.type === 'parsons' ? 'Check Order' : 'Submit Answer', exact: true }).click();
    }
    await expect(page.getByLabel('Answer result')).toHaveText(JSON.stringify({
      answers: 1, correct, feedbackVisible: true, question: question.question,
    }));
    await expect(page.getByText(question.explanation, { exact: true })).toBeVisible();
  });
}
