// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const SIMULATOR_URL = '/SEBook/tools/regex-simulator.html';
// The real Python worker loads lazily; its startup has a separate bound
// from the much shorter execution limit enforced by the simulator.
const PYTHON_READY_TIMEOUT = 45_000;
const A11Y_SCOPE = { feature: 'regex-simulator', include: '#regex-simulator' };

test.setTimeout(90_000);

/** @param {import('@playwright/test').Page} page */
async function openSimulator(page) {
  await page.goto(SIMULATOR_URL);
  await expect(page.getByLabel('Regular expression', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run pattern', exact: true })).toBeEnabled();
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ pattern: string, text: string, operation?: string }} input
 */
async function runPattern(page, { pattern, text, operation = 'finditer' }) {
  await page.getByLabel('Regular expression', { exact: true }).fill(pattern);
  await page.getByLabel('Test text', { exact: true }).fill(text);
  await page.getByLabel('Operation', { exact: true }).selectOption(operation);
  await page.getByRole('button', { name: 'Run pattern', exact: true }).click();
}

/** @param {import('@playwright/test').Page} page @param {number} count */
async function expectMatchCount(page, count) {
  // These output IDs are the simulator's documented DOM contract. Interactive
  // controls and individual matches are located through their accessible names.
  await expect(page.locator('#regex-results')).toBeVisible({ timeout: PYTHON_READY_TIMEOUT });
  await expect(page.locator('#regex-summary')).toContainText(
    new RegExp(`^${count} match(?:es)?\\.`),
    { timeout: PYTHON_READY_TIMEOUT },
  );
  await expect(page.locator('#regex-results').getByRole('heading', { name: /^Match \d+$/ }))
    .toHaveCount(count);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} number
 * @param {string} text
 * @param {'match' | 'no-match'} expectation
 */
async function editTestCase(page, number, text, expectation) {
  await page.getByLabel(`Test case ${number} text`, { exact: true }).fill(text);
  await page.getByLabel(`Test case ${number} expectation`, { exact: true }).selectOption(expectation);
}

/** @param {import('@playwright/test').Page} page @param {number} passed @param {number} total */
async function runTestCases(page, passed, total) {
  await page.getByRole('button', { name: 'Run test cases', exact: true }).click();
  await expect(page.locator('#regex-cases-status')).toHaveText(
    `${passed} of ${total} test cases passed.`,
    { timeout: PYTHON_READY_TIMEOUT },
  );
}

test('Python named captures and highlights use Unicode character positions', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await openSimulator(page);

  await runPattern(page, { pattern: '(?P<plant>\\w+)', text: '🌿 fern café' });

  await expectMatchCount(page, 2);
  await expect(page.getByLabel('Match 1 at [2, 6)', { exact: true })).toHaveText('fern');
  await expect(page.getByLabel('Match 2 at [7, 11)', { exact: true })).toHaveText('café');
  await expect(page.locator('#regex-results')).toContainText('Group 1 · plant');
  await expect(page.locator('#regex-results')).toContainText('"café"');
  await a11yCheckpoint(page, 'Python match results and captures', A11Y_SCOPE);
  expect(pageErrors, 'matching must not cause an uncaught browser error').toEqual([]);
});

test('search, match at start, and full match keep their distinct Python meanings', async ({ page }) => {
  await openSimulator(page);

  await runPattern(page, { pattern: 'fern', text: 'a fern', operation: 'search' });
  await expectMatchCount(page, 1);
  await expect(page.getByLabel('Match 1 at [2, 6)', { exact: true })).toHaveText('fern');

  await runPattern(page, { pattern: 'fern', text: 'a fern', operation: 'match' });
  await expectMatchCount(page, 0);

  await runPattern(page, { pattern: 'fern', text: 'fern moss', operation: 'match' });
  await expectMatchCount(page, 1);

  await runPattern(page, { pattern: 'fern', text: 'fern moss', operation: 'fullmatch' });
  await expectMatchCount(page, 0);

  await runPattern(page, { pattern: 'fern', text: 'fern', operation: 'fullmatch' });
  await expectMatchCount(page, 1);
});

test('empty captures, unmatched captures, and an empty input remain distinguishable', async ({ page }) => {
  await openSimulator(page);

  await runPattern(page, { pattern: '(?P<optional>moss)?(?P<empty>)fern', text: 'fern' });
  await expectMatchCount(page, 1);
  const results = page.locator('#regex-results');
  await expect(results.getByRole('term')).toHaveText(['Group 1 · optional', 'Group 2 · empty']);
  await expect(results.getByRole('definition')).toContainText([
    'Did not participate (None)',
    'Empty string "" · [0, 0)',
  ]);

  await runPattern(page, { pattern: '^$', text: '' });
  await expectMatchCount(page, 1);
  await expect(page.getByLabel('Empty match 1 at position 0', { exact: true })).toBeVisible();
  await a11yCheckpoint(page, 'Zero-width match on empty input', A11Y_SCOPE);
});

test('a Python syntax error can be corrected before a named-group substitution', async ({ page }) => {
  await openSimulator(page);

  await runPattern(page, { pattern: '(?P<plant>', text: 'fern moss' });
  await expect(page.locator('#regex-error')).toBeVisible({ timeout: PYTHON_READY_TIMEOUT });
  await expect(page.locator('#regex-error')).toContainText(/unterminated|missing/i);
  await expect(page.getByRole('button', { name: 'Run pattern', exact: true })).toBeEnabled();
  await a11yCheckpoint(page, 'Python syntax error', A11Y_SCOPE);

  await page.getByLabel('Operation', { exact: true }).selectOption('sub');
  await page.getByLabel('Replacement', { exact: true }).fill('<\\g<plant>>');
  await runPattern(page, { pattern: '(?P<plant>\\w+)', text: 'fern moss', operation: 'sub' });

  await expect(page.locator('#regex-output')).toHaveText('<fern> <moss>', {
    timeout: PYTHON_READY_TIMEOUT,
  });
  await expect(page.locator('#regex-error')).toBeHidden();
  await a11yCheckpoint(page, 'Named-group substitution output', A11Y_SCOPE);
});

test('candidate-start stepping preserves lookbehind context and shows failed starts', async ({ page }) => {
  await openSimulator(page);
  await runPattern(page, { pattern: '(?<=x)fern', text: 'xfern' });
  await expectMatchCount(page, 1);

  await expect(page.locator('#regex-probe-status')).toContainText(/(?:position|start) 0/i);
  await expect(page.locator('#regex-probe-status')).toContainText(/no match|fail/i);
  await expect(page.getByRole('button', { name: 'First position', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Previous position', exact: true })).toBeDisabled();

  await page.getByRole('button', { name: 'Next position', exact: true }).click();
  await expect(page.locator('#regex-probe-status')).toContainText(/(?:position|start) 1/i);
  await expect(page.locator('#regex-probe-status')).toContainText('[1, 5)');
  await a11yCheckpoint(page, 'Successful candidate start after a failure', A11Y_SCOPE);

  await page.getByRole('button', { name: 'Previous position', exact: true }).click();
  await expect(page.locator('#regex-probe-status')).toContainText(/(?:position|start) 0/i);
  await expect(page.locator('#regex-probe-status')).toContainText(/no match|fail/i);

  await runPattern(page, { pattern: 'ivy', text: 'x' });
  await expectMatchCount(page, 0);
  await page.getByRole('button', { name: 'Next position', exact: true }).click();
  await expect(page.locator('#regex-probe-status')).toContainText(/(?:position|start) 1/i);
  await expect(page.locator('#regex-probe-status')).toContainText(/no match|fail/i);
  await expect(page.getByRole('button', { name: 'Next position', exact: true })).toBeDisabled();
});

test('editing the input invalidates previous results and debugger positions', async ({ page }) => {
  await openSimulator(page);
  await runPattern(page, { pattern: 'fern', text: 'fern' });
  await expectMatchCount(page, 1);

  await page.getByLabel('Test text', { exact: true }).fill('moss');

  await expect(page.locator('#regex-results').getByRole('heading', { name: /^Match \d+$/ }))
    .toHaveCount(0);
  await expect(page.locator('#regex-results')).toBeHidden();
  await expect(page.getByLabel('Match 1 at [0, 4)', { exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Next position', exact: true })).toBeHidden();
  await expect(page.locator('#regex-status')).toContainText(/run|changed|updated/i);

  await page.getByRole('button', { name: 'Run pattern', exact: true }).click();
  await expectMatchCount(page, 0);
});

test('an expensive pattern is bounded and the learner can run again afterward', async ({ page }) => {
  await openSimulator(page);
  await runPattern(page, { pattern: 'fern', text: 'fern' });
  await expectMatchCount(page, 1);

  await runPattern(page, { pattern: '(a+)+$', text: `${'a'.repeat(32)}!` });
  await expect(page.locator('#regex-status')).toContainText(/stopped after 2 seconds/i, {
    timeout: 10_000,
  });
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Run pattern', exact: true })).toBeEnabled();
  await a11yCheckpoint(page, 'Execution limit and recovery controls', A11Y_SCOPE);

  await runPattern(page, { pattern: 'moss', text: 'moss' });
  await expectMatchCount(page, 1);
  await expect(page.getByLabel('Match 1 at [0, 4)', { exact: true })).toHaveText('moss');
});

test('positive and negative test cases report both passing and failing expectations', async ({ page }) => {
  await openSimulator(page);
  await page.getByLabel('Regular expression', { exact: true }).fill('fern');
  await editTestCase(page, 1, 'fern', 'match');
  await editTestCase(page, 2, 'moss', 'no-match');
  await page.getByRole('button', { name: 'Add test case', exact: true }).click();
  await editTestCase(page, 3, 'moss', 'match');
  await page.getByRole('button', { name: 'Add test case', exact: true }).click();
  await editTestCase(page, 4, 'fern', 'no-match');

  await runTestCases(page, 2, 4);

  await expect(page.locator('#regex-case-1-result')).toHaveText('Pass — expected a match; actual: match.');
  await expect(page.locator('#regex-case-2-result')).toHaveText('Pass — expected no match; actual: no match.');
  await expect(page.locator('#regex-case-3-result')).toHaveText('Fail — expected a match; actual: no match.');
  await expect(page.locator('#regex-case-4-result')).toHaveText('Fail — expected no match; actual: match.');
  await a11yCheckpoint(page, 'Passing and failing learner test cases', A11Y_SCOPE);
});

test('test cases accept empty text and can be edited or removed without losing other examples', async ({ page }) => {
  await openSimulator(page);
  await page.getByLabel('Regular expression', { exact: true }).fill('(?:fern)?');
  await editTestCase(page, 1, 'fern', 'match');
  await editTestCase(page, 2, 'moss', 'no-match');
  await page.getByRole('button', { name: 'Add test case', exact: true }).click();
  await expect(page.getByLabel('Test case 3 text', { exact: true })).toHaveValue('');

  await runTestCases(page, 3, 3);
  await expect(page.locator('#regex-case-3-result')).toHaveText('Pass — expected a match; actual: match.');

  await page.getByLabel('Test case 3 text', { exact: true }).fill('stone');
  await expect(page.locator('#regex-case-3-result')).toHaveText('Not run with the current inputs.');
  await runTestCases(page, 2, 3);
  await expect(page.locator('#regex-case-3-result')).toHaveText('Fail — expected a match; actual: no match.');

  await page.getByLabel('Test case 3 expectation', { exact: true }).selectOption('no-match');
  await expect(page.locator('#regex-case-3-result')).toHaveText('Not run with the current inputs.');
  await runTestCases(page, 3, 3);

  await page.getByRole('button', { name: 'Remove test case 2', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Test case 2', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Test case 1 text', { exact: true })).toHaveValue('fern');
  await expect(page.getByLabel('Test case 3 text', { exact: true })).toHaveValue('stone');
  await runTestCases(page, 2, 2);

  await page.getByRole('button', { name: 'Remove test case 1', exact: true }).click();
  await page.getByRole('button', { name: 'Remove test case 3', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run test cases', exact: true })).toBeDisabled();
  await expect(page.locator('#regex-cases-status')).toHaveText('Add a test case to begin.');
});

test('test-case results are invalidated when the pattern or flags change', async ({ page }) => {
  await openSimulator(page);
  await page.getByLabel('Regular expression', { exact: true }).fill('fern');
  await editTestCase(page, 1, 'FERN', 'match');
  await editTestCase(page, 2, 'moss', 'no-match');
  await runTestCases(page, 1, 2);

  await page.getByText('Flags (none selected by default)', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Ignore case (IGNORECASE)', exact: true }).check();
  await expect(page.locator('#regex-case-1-result')).toHaveText('Not run with the current inputs.');
  await expect(page.locator('#regex-case-2-result')).toHaveText('Not run with the current inputs.');
  await runTestCases(page, 2, 2);

  await page.getByLabel('Regular expression', { exact: true }).fill('moss');
  await expect(page.locator('#regex-case-1-result')).toHaveText('Not run with the current inputs.');
  await expect(page.locator('#regex-case-2-result')).toHaveText('Not run with the current inputs.');
  await expect(page.getByLabel('Test case 1 text', { exact: true })).toHaveValue('FERN');
  await expect(page.getByLabel('Test case 2 expectation', { exact: true })).toHaveValue('no-match');
  await runTestCases(page, 0, 2);
});

test('test-case match mode distinguishes a whole input from a matching substring', async ({ page }) => {
  await openSimulator(page);
  await page.getByLabel('Regular expression', { exact: true }).fill('fern');
  await editTestCase(page, 1, 'a fern', 'match');
  await editTestCase(page, 2, 'moss', 'no-match');
  await expect(page.getByLabel('Test-case match mode', { exact: true })).toHaveValue('fullmatch');
  await runTestCases(page, 1, 2);
  await expect(page.locator('#regex-case-1-result')).toHaveText('Fail — expected a match; actual: no match.');

  await page.getByLabel('Test-case match mode', { exact: true }).selectOption('search');
  await expect(page.locator('#regex-case-1-result')).toHaveText('Not run with the current inputs.');
  await runTestCases(page, 2, 2);
  await expect(page.locator('#regex-case-1-result')).toHaveText('Pass — expected a match; actual: match.');

  await page.getByLabel('Test-case match mode', { exact: true }).selectOption('fullmatch');
  await runTestCases(page, 1, 2);
});

test('the matching workspace remains usable at a 320-pixel viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await openSimulator(page);
  await runPattern(page, { pattern: '(?P<plant>fern)', text: 'fern' });
  await expectMatchCount(page, 1);

  await expect(page.getByLabel('Regular expression', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Test text', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run pattern', exact: true })).toBeVisible();
  await expect(page.getByLabel('Test case 1 text', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Test case 1 expectation', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run test cases', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
    message: 'the narrow viewport must not require horizontal page scrolling',
  }).toBeLessThanOrEqual(320);
  await a11yCheckpoint(page, 'Narrow matching workspace', A11Y_SCOPE);
});
