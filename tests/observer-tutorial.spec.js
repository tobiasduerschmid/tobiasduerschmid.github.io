const { test, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const config = loadTutorialConfig('observer-pattern');
const url = '/SEBook/designpatterns/observer-tutorial';
const judgment = config.steps[4];
const questions = judgment.quiz.questions;
const normalized = text => text.replace(/`/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const textPattern = text => new RegExp(normalized(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]").replace(/"/g, '["“”]').replace(/ /g, '\\s+'));

function measureDiagram(element) {
  const paragraph = element.closest('main').querySelector('p');
  const svg = element.querySelector('svg');
  const labels = [...svg.querySelectorAll('text')].filter(label => label.textContent.trim());
  return {
    paragraph: parseFloat(getComputedStyle(paragraph).fontSize),
    labelCount: labels.length,
    smallestLabel: Math.min(...labels.map(label => {
      const transform = label.getScreenCTM();
      return parseFloat(getComputedStyle(label).fontSize) * Math.hypot(transform.c, transform.d);
    })),
    width: svg.getBoundingClientRect().width,
    available: element.clientWidth,
    filter: getComputedStyle(svg).filter,
    overflows: element.scrollWidth > element.clientWidth + 1,
  };
}

test('design judgment uses native questions, corrective feedback, and a required passing retry', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Resume at this lesson using the documented saved-progress format, without
  // awarding any test or quiz credit. Everything after setup uses the public UI.
  await page.addInitScript(() => {
    localStorage.setItem('tutorial-progress-observer-pattern', JSON.stringify({
      step: 4, stepsUnlocked: [0, 1, 2, 3, 4], stepsVisited: [],
      stepsPassed: [], quizPassed: [], files: {},
    }));
  });
  await page.goto(url + '?autosave=true', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: judgment.title, exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: /Test My Work/ })).toBeHidden();
  const assessment = page.getByRole('button', { name: /^Step 6:/ });
  await expect(assessment).toBeDisabled();
  await page.getByRole('button', { name: /^Next →$/ }).click();
  await expect(page.getByRole('heading', { name: judgment.quiz.title, exact: true })).toBeVisible();
  await a11yCheckpoint(page, 'Observer scenario question', { feature: 'observer-tutorial' });

  async function completeAttempt(correct) {
    const seen = new Set();
    for (let index = 0; index < questions.length; index++) {
      const choices = page.getByRole('radio');
      await expect(choices).not.toHaveCount(0);
      const visible = (await choices.allTextContents()).map(normalized);
      const question = questions.find(item => visible.some(text => text.includes(normalized(item.options[0]))));
      expect(question, 'the visible answers identify an authored scenario').toBeTruthy();
      await expect(choices).toHaveCount(question.options.length);
      expect(seen.has(question.id), 'each scenario appears once in an attempt').toBe(false);
      seen.add(question.id);
      const answerIndex = correct ? question.correct_index : question.options.findIndex((_, i) => i !== question.correct_index);
      const answer = page.getByRole('radio', { name: textPattern(question.options[answerIndex]) });
      await answer.focus();
      await answer.press('Enter');
      if (!correct) {
        await expect(page.getByText(textPattern(question.option_feedback[answerIndex]))).toBeVisible();
      }
      const next = page.getByRole('button', { name: index + 1 < questions.length ? 'Next Question' : 'See Results', exact: true });
      await expect(next).toBeFocused();
      await next.press('Enter');
    }
  }

  await completeAttempt(false);
  await expect(page.getByText(new RegExp(`You scored 0/${questions.length}`))).toBeVisible();
  await expect(assessment).toBeDisabled();
  await expect(page.getByRole('button', { name: /Continue to Step 6/ })).toBeHidden();
  await a11yCheckpoint(page, 'Observer failed scenario check', { feature: 'observer-tutorial' });
  await page.getByRole('button', { name: 'Try Again', exact: true }).press('Enter');
  await completeAttempt(true);
  await expect(page.getByText(new RegExp(`Your Score: ${questions.length} / ${questions.length}`))).toBeVisible();
  await page.getByRole('button', { name: /Continue to Step 6/ }).press('Enter');
  await expect(page.getByRole('heading', { name: config.steps[5].title, exact: true })).toBeVisible();
  await expect(assessment).toHaveAttribute('aria-current', 'step');
  expect(errors, 'the scenario journey has no uncaught page errors').toEqual([]);
});

test('the print view includes all five scenario questions without the Boolean-answer script', async ({ page }) => {
  await page.goto(url + '/print', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: judgment.quiz.title, exact: true })).toBeVisible();
  for (const id of ['stock-dashboard', 'fixed-calculator', 'collision-handlers', 'startup-config', 'chat-delivery']) {
    const question = questions.find(item => item.id === id);
    await expect(page.getByText(textPattern(question.question))).toBeVisible();
    await expect(page.getByText(textPattern(question.option_feedback[Object.keys(question.option_feedback)[0]]))).toBeVisible();
  }
  await expect(page.getByText(/design_judgment\.py/)).toHaveCount(0);
  await expect(page.getByText(/scenario_1\s*=\s*None/)).toHaveCount(0);
});

test('the print view preserves the instructional context of every authored diagram', async ({ page }) => {
  await page.goto(url + '/print');
  const captions = config.steps.flatMap(step => [...step.instructions.matchAll(/data-uml-caption="([^"]+)"/g)].map(match => match[1]));
  expect(captions.length).toBeGreaterThan(0);
  for (const caption of captions) {
    await expect(page.getByRole('figure').getByText(caption, { exact: true })).toBeVisible();
  }
});

for (const dark of [false, true]) {
  test(`print diagrams remain readable and keyboard-scrollable at 320px with ${dark ? 'dark' : 'light'} preference`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'dark-mode', value: String(dark), url: baseURL }]);
    await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(url + '/print');
    await page.evaluate(() => document.fonts.ready);
    const diagrams = page.getByRole('img', { name: /^UML (class|sequence) diagram/ });
    const diagramCount = config.steps.reduce((count, step) =>
      count + (step.instructions.match(/data-uml-type="(?:class|sequence)"/g) || []).length, 0);
    await expect(diagrams).toHaveCount(diagramCount);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    for (const diagram of await diagrams.all()) {
      await expect(diagram.locator('svg')).toBeVisible();
      const sizes = await diagram.evaluate(measureDiagram);
      expect(sizes.labelCount, 'each diagram contains rendered labels').toBeGreaterThan(0);
      expect(sizes.smallestLabel, 'screen-space label size').toBeGreaterThanOrEqual(sizes.paragraph - 0.1);
      if (sizes.overflows) {
        await diagram.focus();
        await expect(diagram).toBeFocused();
        await diagram.press('ArrowRight');
        await expect.poll(() => diagram.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
        await diagram.press('Tab');
        await expect(diagram).not.toBeFocused();
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

    await page.setViewportSize({ width: 1000, height: 900 });
    await page.emulateMedia({ media: 'print' });
    for (const diagram of await diagrams.all()) {
      const printed = await diagram.evaluate(measureDiagram);
      expect(printed.width, 'paper output fits each complete diagram').toBeLessThanOrEqual(printed.available + 1);
      expect(printed.filter, 'paper output has no dark filter').toBe('none');
    }
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });
}

// These integration checks use the shipped worker and its real CPython/Wasm
// interpreter. Protocol calls set up files; authored grader results are the oracle.
for (const stepIndex of [0, 2, 3]) {
  const step = config.steps[stepIndex];
  test(`${step.title}: Pyodide rejects unfinished work and accepts the model`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/robots.txt');
    const results = await page.evaluate(async ({ setup, step }) => {
      const worker = new Worker('/js/pyodide-worker.js');
      let requestId = 0;
      const request = message => new Promise((resolve, reject) => {
        const id = ++requestId;
        const output = [];
        worker.onmessage = ({ data }) => {
          if (data.text) output.push(data.text);
          if (data.id === id) resolve({ ...data, output: output.join('') });
        };
        worker.onerror = event => reject(new Error(event.message));
        worker.postMessage({ ...message, id });
      });
      try {
        await new Promise((resolve, reject) => {
          worker.onmessage = ({ data }) => {
            if (data.type === 'ready') resolve();
            if (data.type === 'error') reject(new Error(data.message));
          };
          worker.onerror = event => reject(new Error(event.message));
        });
        for (const code of setup) {
          const result = await request({ type: 'runCode', code });
          if (result.exitCode !== 0) throw new Error(result.output);
        }
        const variants = { starter: step.files, model: [...step.files, ...step.solution.files] };
        const results = {};
        for (const [variant, files] of Object.entries(variants)) {
          for (const file of files) {
            const path = '/tutorial/' + file.path.replace(/^\/tutorial\//, '');
            const result = await request({ type: 'write', path, content: file.content });
            if (result.type !== 'write_ok') throw new Error(`Could not write ${path}`);
          }
          results[variant] = [];
          for (const check of step.tests) {
            const result = await request({ type: 'runCode', code: check.command });
            results[variant].push({ description: check.description, exitCode: result.exitCode, output: result.output });
          }
        }
        return results;
      } finally {
        worker.terminate();
      }
    }, { setup: config.setup_commands, step });
    expect(results.starter.some(result => result.exitCode !== 0), 'unfinished source must not earn completion').toBe(true);
    expect(results.model.filter(result => result.exitCode !== 0), 'every authored criterion passes for the model').toEqual([]);
  });
}
