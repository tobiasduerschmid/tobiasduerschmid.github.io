const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { a11yCheckpoint } = require('./a11y-helpers');
const { loadTutorialConfig } = require('./tutorial-helpers');
const pageErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page), 'hint interactions must not produce browser errors').toEqual([]);
});

// Component fixture: serve owned assets directly from disk, without a Jekyll
// build or a cached backend. Conditions react to source passed through the
// public TutorChat failure event, just as they do after a learner retests.
async function openHintsFixture(page, { backend = 'browser', tests, results,
  records = [], source = 'phase_a', attempts = ['phase_a', 'phase_b', 'phase_c'] } = {}) {
  const authoredTests = tests || Array.from({ length: 5 }, (_, index) => ({
    description: `Criterion ${index + 1}`,
    hints: ['phase_a', 'phase_b', 'phase_c'].map((phase, level) => ({
      condition: `code_contains: ${phase}`,
      text: `Guidance ${index + 1}, level ${level + 1}`,
    })),
  }));
  await page.route('http://tutor-hints.test/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (['/js/tutor-chat.js', '/css/tutor-chat.css', '/js/haskell/syntax.js'].includes(pathname)) {
      await route.fulfill({ path: path.join(__dirname, '..', pathname),
        contentType: pathname.endsWith('.js') ? 'application/javascript' : 'text/css' });
      return;
    }
    await route.fulfill({ contentType: 'text/html', body: `<!doctype html>
      <html lang="en"><head><title>Tutorial hint fixture</title>
      <link rel="stylesheet" href="/css/tutor-chat.css"></head><body><main>
      <h1>Tutorial hint fixture</h1><p>Learning instructions.</p>
      <button type="button" id="retest">Retest</button>
      <button type="button" id="advance">Advance code attempt</button>
      <button type="button" id="reset">Reset code attempt</button>
      <button type="button" id="pass">Pass all checks</button>
      <button type="button" id="leave">Leave step</button>
      <div id="step"><div class="tvm-test-panel"></div></div>
      </main><script src="/js/haskell/syntax.js"></script>
      <script src="/js/tutor-chat.js"></script><script>
      let source = ${JSON.stringify(source)};
      const attempts = ${JSON.stringify(attempts)};
      let phase = 0;
      const step = { tests: ${JSON.stringify(authoredTests)},
        solution: { files: [{ content: 'print(f"{answer}")' }] } };
      const tutorial = { steps: [step], currentStep: 0,
        config: { backend: ${JSON.stringify(backend)} },
        stepContentEl: document.getElementById('step'),
        currentSource: () => source,
        _testResults: ${JSON.stringify(results || [false, false, false, false, true])},
        _testHintRecords: ${JSON.stringify(records)} };
      document.getElementById('retest').onclick = () => TutorChat.onTestFailure(tutorial);
      document.getElementById('advance').onclick = () => { source = attempts[++phase]; };
      document.getElementById('reset').onclick = () => { phase = 0; source = attempts[0]; };
      document.getElementById('pass').onclick = () => TutorChat.onTestPass(tutorial);
      document.getElementById('leave').onclick = () => TutorChat.onStepChange(tutorial);
      TutorChat.onTestFailure(tutorial);
      </script></body></html>` });
  });
  await page.goto('http://tutor-hints.test/');
}

async function openHints(page) {
  const toggle = page.getByRole('button', { name: 'Hints', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toBeFocused();
}

test('every failed criterion exposes matching guidance with no manual reveal controls', async ({ page }) => {
  await openHintsFixture(page);
  await expect(page.locator('.tvm-tutor-hints')).toBeHidden();
  await openHints(page);
  const cards = page.locator('.tvm-tutor-hint');
  await expect(cards).toHaveCount(4);
  for (const index of [1, 2, 3, 4]) {
    await expect(page.getByText(`Guidance ${index}, level 1`, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Guidance 5, level 1', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /show next hint|all hints shown/i })).toHaveCount(0);
  await expect(page.locator('.tvm-tutor-hints').getByRole('heading')).toHaveCount(0);
  await expect(page.getByText('Guidance 1, level 2', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Guidance 1, level 3', { exact: true })).toHaveCount(0);
  await a11yCheckpoint(page, 'condition-matched tutorial hints', { feature: 'tutor-hints' });
});

test('retesting selects guidance from the current code and does not accumulate earlier levels', async ({ page }) => {
  await openHintsFixture(page);
  await openHints(page);
  const first = page.locator('.tvm-tutor-hint').first();
  for (const level of [2, 3]) {
    await page.getByRole('button', { name: 'Advance code attempt', exact: true }).click();
    await page.getByRole('button', { name: 'Retest', exact: true }).click();
    await openHints(page);
    await expect(page.locator('.tvm-tutor-hint')).toHaveCount(4);
    await expect(first.getByText(`Guidance 1, level ${level}`, { exact: true })).toBeVisible();
    await expect(first.getByText(`Guidance 1, level ${level - 1}`, { exact: true })).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Reset code attempt', exact: true }).click();
  await page.getByRole('button', { name: 'Retest', exact: true }).click();
  await openHints(page);
  await expect(first.getByText('Guidance 1, level 1', { exact: true })).toBeVisible();
  await expect(first.getByText('Guidance 1, level 3', { exact: true })).toHaveCount(0);
});

test('Playwright capstone hints follow declarations and assertions, including deletion back to starter', async ({ page }) => {
  const step = loadTutorialConfig('playwright').steps[7];
  const starter = step.files.find(file => file.path === 'tests/all-done.spec.js').content +
    "\n// test('a comment is not a definition', () => expect('not an assertion'));\n";
  const partial = `import { test, expect } from '@playwright/test';
    test('complete the tasks', async ({ page }) => { await page.goto('/'); });`;
  const developed = `import { test, expect } from '@playwright/test';
    test('complete the tasks', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Todo Lab' })).toBeVisible();
    });`;
  await openHintsFixture(page, {
    backend: 'react', tests: step.tests, results: step.tests.map(() => false),
    source: starter, attempts: [starter, partial, developed],
  });
  const titles = [
    ['Begin with two user paths', 'Distinguish an empty list from a completed list', 'Keep track of item identity'],
    ['Give each path an observation', 'Observe the list after the actions', 'Compare names before and after'],
    ['Inspect the first failure', 'Consider hidden and removed items', 'Check what a retained locator promises'],
  ];
  for (const phase of [0, 1, 2, 0]) {
    if (phase !== 0) {
      await page.getByRole('button', { name: 'Advance code attempt', exact: true }).click();
    } else {
      await page.getByRole('button', { name: 'Reset code attempt', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Retest', exact: true }).click();
    await openHints(page);
    const guidance = step.tests.map(criterion => criterion.hints[phase].text);
    expect(new Set(guidance).size, 'each failed criterion needs its own advice').toBe(step.tests.length);
    const cards = page.locator('.tvm-tutor-hint');
    await expect(cards).toHaveCount(step.tests.length);
    await expect(cards.locator('.tvm-tutor-hint-body')).toHaveText(guidance);
    for (const title of titles[phase]) {
      await expect(page.getByText(new RegExp(`${title}$`))).toBeVisible();
    }
  }
});

test('single-item toggle hints ignore the worked example and follow the scoped round-trip attempt', async ({ page }) => {
  const step = loadTutorialConfig('playwright').steps[6];
  const criterion = step.tests.find(item => item.description === 'The suite catches a single todo whose toggle has no effect');
  const starter = step.files.find(file => file.path === 'tests/mark-done.spec.js').content;
  const title = 'marking and unmarking a todo restores the count';
  const start = starter.indexOf(`test('${title}'`);
  const end = starter.indexOf('\ntest(', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const before = starter.slice(0, start);
  const after = starter.slice(end);
  const attempt = (checkpoint) => before + `test('${title}', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Todo item').fill('Milk');
    await page.getByRole('button', { name: 'Add todo' }).click();
    const milk = page.getByRole('button', { name: 'Milk' });
    await milk.click();
    ${checkpoint}
    await milk.click();
    await expect(milk).toHaveAttribute('aria-pressed', 'false');
  });` + after;
  const partial = attempt('');
  const developed = attempt("await expect(milk).toHaveAttribute('aria-pressed', 'true');");
  const renamed = developed.replace(title, 'my single-item round trip');
  const removed = before + after;
  await openHintsFixture(page, {
    backend: 'react', tests: [criterion], results: [false], source: starter,
    attempts: [starter, partial, developed, renamed, removed],
  });
  for (const [phase, hintIndex] of [[0, 0], [1, 1], [2, 2], [3, 0], [4, 0], [0, 0]]) {
    await page.getByRole('button', {
      name: phase === 0 ? 'Reset code attempt' : 'Advance code attempt', exact: true,
    }).click();
    await page.getByRole('button', { name: 'Retest', exact: true }).click();
    await openHints(page);
    const cards = page.locator('.tvm-tutor-hint');
    await expect(cards).toHaveCount(1);
    await expect(cards.locator('.tvm-tutor-hint-body')).toHaveText(criterion.hints[hintIndex].text);
    await expect(cards.getByText(new RegExp(`${criterion.hints[hintIndex].title}$`))).toBeVisible();
  }
});

for (const event of ['Pass all checks', 'Leave step']) {
  test(`${event.toLowerCase()} removes the hint panel`, async ({ page }) => {
    await openHintsFixture(page);
    await openHints(page);
    await page.getByRole('button', { name: event, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Hints', exact: true })).toHaveCount(0);
  });
}

test('all matching authored hints retain their order without a shared cap', async ({ page }) => {
  const hints = Array.from({ length: 5 }, (_, index) => ({ text: `Ordered guidance ${index + 1}` }));
  await openHintsFixture(page, { tests: [{ description: 'Several applicable observations', hints }], results: [false] });
  await openHints(page);
  const cards = page.locator('.tvm-tutor-hint');
  await expect(cards.locator('.tvm-tutor-hint-body')).toHaveText(hints.map(hint => hint.text));
  await expect(page.locator('.tvm-tutor-hints').getByRole('button')).toHaveCount(0);
});

test('small failing checks share identical advice without repeating it', async ({ page }) => {
  const sharedHints = [
    { condition: 'code_contains: phase_a', text: 'Trace the proposed value before applying either limit.' },
    { condition: 'code_contains: phase_b', text: 'Compare the proposed value with the applicable limit.' },
  ];
  await openHintsFixture(page, { tests: [
    { description: 'Upper capacity', hints: sharedHints },
    { description: 'Zero capacity', hints: sharedHints },
    { description: 'Unchanged input', hints: [{ text: 'This completed criterion needs no advice.' }] },
    { description: 'Another unfinished rule', hints: [{ text: 'Trace this separate rule too.' }] },
  ], results: [false, false, true, false] });
  await openHints(page);
  await expect(page.getByText(sharedHints[0].text, { exact: true })).toHaveCount(1);
  await expect(page.getByText('Trace this separate rule too.', { exact: true })).toBeVisible();
  await expect(page.getByText('This completed criterion needs no advice.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Advance code attempt', exact: true }).click();
  await page.getByRole('button', { name: 'Retest', exact: true }).click();
  await openHints(page);
  await expect(page.getByText(sharedHints[0].text, { exact: true })).toHaveCount(0);
  await expect(page.getByText(sharedHints[1].text, { exact: true })).toHaveCount(1);
  await a11yCheckpoint(page, 'shared advice for individual checks', { feature: 'tutor-hints' });
});

test('explicit hint titles preserve distinct context for identical advice text', async ({ page }) => {
  const text = 'Trace both boundary inputs.';
  await openHintsFixture(page, { tests: [
    { description: 'Capacity', hints: [{ title: 'Stock capacity', text }] },
    { description: 'Eligibility', hints: [{ title: 'Reward eligibility', text }] },
  ], results: [false, false] });
  await openHints(page);
  await expect(page.getByText(/Stock capacity$/)).toBeVisible();
  await expect(page.getByText(/Reward eligibility$/)).toBeVisible();
  await expect(page.getByText(text, { exact: true })).toHaveCount(2);
});

test('matching authored hints replace solution and description generated guidance', async ({ page }) => {
  await openHintsFixture(page, { tests: [{ description: 'Script runs without errors using a variable',
    hints: [{ condition: 'code_contains: phase_a', text: 'Inspect the failing boundary case.' },
      { condition: 'code_contains: phase_b', text: 'Trace one input through your code.' }] }], results: [false] });
  await openHints(page);
  await expect(page.locator('.tvm-tutor-hint')).toHaveCount(1);
  await expect(page.getByText('Inspect the failing boundary case.', { exact: true })).toBeVisible();
  await expect(page.getByText('Your code has an error', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Use variables instead of hardcoded values', { exact: true })).toHaveCount(0);
});

test('a failed criterion without matching authored hints retains generated guidance', async ({ page }) => {
  await openHintsFixture(page, { tests: [{ description: 'Script runs without errors',
    hints: [{ condition: 'code_contains: absent', text: 'Unavailable authored hint.' }] }], results: [false] });
  await openHints(page);
  await expect(page.locator('.tvm-tutor-hint')).toHaveCount(1);
  await expect(page.getByText('Unavailable authored hint.', { exact: true })).toHaveCount(0);
});

test('Haskell code conditions ignore nested and line comments while preserving strings and line anchors', async ({ page }) => {
  const source = '-- answer :: Int\n{- answer :: Bool\n {- nested comment -}\n -}\nlabel = "-- not a comment"\nanswer = 1\n';
  await openHintsFixture(page, { backend: 'haskell', source, results: [false], tests: [{ description: 'Declaration progress', hints: [
    { condition: 'code_matches: /^answer\\s*::/m', text: 'Declaration observed.' },
    { condition: 'code_not_matches: /^answer\\s*::/m', text: 'A declaration is still absent.' },
    { condition: 'code_contains: "-- not a comment"', text: 'The string literal is preserved.' },
    { condition: 'source_contains: -- answer :: Int', text: 'Full-source conditions still see comments.' },
  ] }] });
  await openHints(page);
  await expect(page.getByText('Declaration observed.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('A declaration is still absent.', { exact: true })).toBeVisible();
  await expect(page.getByText('The string literal is preserved.', { exact: true })).toBeVisible();
  await expect(page.getByText('Full-source conditions still see comments.', { exact: true })).toBeVisible();
});

test('UML diagnostic guidance remains alongside applicable authored guidance', async ({ page }) => {
  await openHintsFixture(page, { backend: 'uml-editor', tests: [{ description: 'Diagram naming',
    hints: [{ text: 'Compare the diagram labels.' }] }], results: [false],
    records: [[{ title: 'Naming nudge', message: 'Inspect the closest label.' }]] });
  await openHints(page);
  await expect(page.locator('.tvm-tutor-hint')).toHaveCount(2);
  await expect(page.getByText('Inspect the closest label.', { exact: true })).toBeVisible();
  await expect(page.getByText('Compare the diagram labels.', { exact: true })).toBeVisible();
});

test('UML checks without applicable guidance leave the hint panel absent', async ({ page }) => {
  await openHintsFixture(page, { backend: 'uml-editor', tests: [{ description: 'Diagram structure' }],
    results: [false], records: [] });
  await expect(page.getByRole('button', { name: 'Hints', exact: true })).toHaveCount(0);
});
