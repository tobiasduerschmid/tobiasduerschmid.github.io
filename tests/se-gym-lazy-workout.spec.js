const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, contextOptions: { reducedMotion: 'reduce' } });

const deckRequests = /\/assets\/se-gym-decks\/.*\.json$/;
const optionalEngines = /\/js\/(?:ArchUML\/uml-bundle|uml-auto-describe|object-reference-(?:graph|code|print|lab)|unix-command-lab|program-output-lab|quiz-write-in)\.js|\/mathjax@/;
const progressKey = 'se-gym-workout-progress';

async function activateGym(context, baseURL) {
  await context.addCookies([
    { name: 'se-gym-active', value: 'true', url: baseURL },
    { name: 'se-gym', value: encodeURIComponent(JSON.stringify([{ type: 'quiz', id: 'user_stories' }])), url: baseURL },
  ]);
}

function assertNoPageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return () => expect(errors).toEqual([]);
}

test('the mobile entrance fetches no answers or optional engines, and a text workout loads only its deck', async ({ page, context, baseURL }) => {
  const checkErrors = assertNoPageErrors(page);
  const decks = [];
  const engines = [];
  page.on('request', request => {
    if (deckRequests.test(request.url())) decks.push(request.url());
    if (optionalEngines.test(request.url())) engines.push(request.url());
  });
  await activateGym(context, baseURL);
  await page.goto('/se-gym/');
  await expect(page.getByRole('button', { name: 'Start Workout', exact: true })).toBeEnabled();
  expect(decks).toEqual([]);
  expect(engines).toEqual([]);

  await page.getByRole('button', { name: 'Start Workout', exact: true }).tap();
  await expect(page.getByRole('group', { name: 'Answer options' }).getByRole('checkbox')).toHaveCount(6);
  expect(decks).toHaveLength(1);
  expect(decks[0]).toMatch(/\/quizzes\/user_stories-[a-f\d]+\.json$/);
  expect(engines).toEqual([]);
  checkErrors();
});

test('waiting for a deck does not consume timed-practice time', async ({ page, context, baseURL }) => {
  const checkErrors = assertNoPageErrors(page);
  await activateGym(context, baseURL);
  await context.addCookies([
    { name: 'se-gym-timed-practice', value: 'true', url: baseURL },
    { name: 'se-gym-timer-mode', value: 'total', url: baseURL },
    { name: 'se-gym-timer-total-minutes', value: '1', url: baseURL },
  ]);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(deckRequests, async route => { await gate; await route.continue(); });
  await page.goto('/se-gym/');
  await page.clock.install();
  const downloading = page.waitForRequest(deckRequests);
  await page.getByRole('button', { name: 'Start Workout', exact: true }).tap();
  await downloading;
  await page.clock.fastForward(120000);
  await expect(page.getByRole('status').filter({ hasText: 'Loading your workout' })).toBeVisible();
  await expect(page.getByRole('timer')).toBeHidden();
  release();
  await expect(page.getByRole('button', { name: 'Submit Answer', exact: true })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveAccessibleName('Timed practice remaining time 1:00');
  await expect(page.getByRole('heading', { name: 'Workout Complete!', exact: true })).toBeHidden();
  checkErrors();
});

for (const action of ['Resume Saved Workout', 'Start Workout']) {
  test(`a failed ${action} keeps the saved checkpoint and can retry`, async ({ page, context, baseURL }) => {
    const checkErrors = assertNoPageErrors(page);
    await activateGym(context, baseURL);
    await page.goto('/se-gym/');
    await page.getByRole('spinbutton', { name: 'Max cards:' }).fill('2');
    await page.getByRole('button', { name: 'Start Workout', exact: true }).tap();
    await page.getByRole('checkbox', { name: /Independent$/ }).tap();
    await page.getByRole('button', { name: 'Submit Answer', exact: true }).tap();
    await page.getByRole('button', { name: 'Next', exact: true }).tap();
    await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).tap();
    await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText('Saved workout: 1 of 2 completed.');
    const checkpoint = await page.evaluate(key => localStorage.getItem(key), progressKey);

    // Reload removes in-memory payloads. Fail the actual network boundary, then
    // retry against the real generated deck and production question renderer.
    await page.route(deckRequests, route => route.abort('failed'));
    await page.reload();
    await page.getByRole('button', { name: action, exact: true }).tap();
    await expect(page.getByRole('status').filter({ hasText: 'Could not load this workout.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Answer', exact: true })).toHaveCount(0);
    expect(await page.evaluate(key => localStorage.getItem(key), progressKey)).toBe(checkpoint);
    await a11yCheckpoint(page, `mobile ${action} network failure`, { feature: 'se-gym', darkMode: true });

    await page.unroute(deckRequests);
    await page.getByRole('button', { name: 'Retry loading workout', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Submit Answer', exact: true })).toBeVisible();
    const resumed = JSON.parse(await page.evaluate(key => localStorage.getItem(key), progressKey));
    expect(resumed.currentStep).toBe(action === 'Resume Saved Workout' ? 1 : 0);
    checkErrors();
  });
}

test('cancelling a pending mobile workout prevents a late response from replacing a later selection', async ({ page, context, baseURL }) => {
  const checkErrors = assertNoPageErrors(page);
  await activateGym(context, baseURL);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(/\/quizzes\/user_stories-[a-f\d]+\.json$/, async route => {
    await gate;
    await route.continue();
  });
  await page.goto('/se-gym/');
  const firstRequest = page.waitForRequest(deckRequests);
  await page.getByRole('button', { name: 'Start Workout', exact: true }).tap();
  const request = await firstRequest;
  await expect(page.getByRole('status').filter({ hasText: 'Loading your workout' })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), progressKey)).toBeNull();
  await page.getByRole('button', { name: 'Cancel loading', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Start Workout', exact: true })).toBeFocused();

  await page.getByRole('button', { name: 'Start targeted practice for Singleton Pattern Quiz', exact: true }).tap();
  const selectedTitle = page.getByText('Singleton Pattern Quiz', { exact: true }).filter({ visible: true });
  await expect(selectedTitle).toBeVisible();
  const responseFinished = page.waitForResponse(response => response.request() === request);
  release();
  await (await responseFinished).finished();
  await expect(selectedTitle).toBeVisible();
  const checkpoint = JSON.parse(await page.evaluate(key => localStorage.getItem(key), progressKey));
  expect(checkpoint.decks.every(deck => deck.deckId === 'design_pattern_singleton')).toBe(true);
  checkErrors();
});

test('a plain quiz remains retryable after a failed request and cancellation', async ({ page }) => {
  const checkErrors = assertNoPageErrors(page);
  await page.route(deckRequests, route => route.abort('failed'));
  await page.goto('/se-gym/?plain=true&quiz=user_stories');
  await expect(page.getByRole('button', { name: 'Retry loading workout', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel loading', exact: true }).tap();
  await expect(page.getByRole('status').filter({ hasText: 'Workout loading cancelled.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry loading workout', exact: true })).toBeFocused();
  await page.unroute(deckRequests);
  await page.getByRole('button', { name: 'Retry loading workout', exact: true }).tap();
  await expect(page.getByRole('group', { name: 'Answer options' }).getByRole('checkbox')).toHaveCount(6);
  checkErrors();
});

test('discarding a saved workout cancels a pending resume before its response arrives', async ({ page, context, baseURL }) => {
  const checkErrors = assertNoPageErrors(page);
  await activateGym(context, baseURL);
  await page.goto('/se-gym/');
  await page.getByRole('button', { name: 'Start Workout', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Submit Answer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).tap();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(deckRequests, async route => { await gate; await route.continue(); });
  await page.reload();
  const loading = page.waitForRequest(deckRequests);
  await page.getByRole('button', { name: 'Resume Saved Workout', exact: true }).tap();
  const request = await loading;
  await page.getByRole('button', { name: 'Discard Saved Workout', exact: true }).tap();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout discarded.' })).toBeVisible();
  const completed = page.waitForResponse(response => response.request() === request);
  release();
  await (await completed).finished();
  await expect(page.getByRole('button', { name: 'Start Workout', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Answer', exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), progressKey)).toBeNull();
  checkErrors();
});

test('a directly linked mobile write-in question loads its engine and grades the answer', async ({ page }) => {
  const checkErrors = assertNoPageErrors(page);
  const engines = [];
  page.on('request', request => { if (optionalEngines.test(request.url())) engines.push(request.url()); });
  await page.goto('/se-gym/?plain=true&questions=quiz:python_output:python-output-alias');
  await expect(page.getByText('A second name remembers the original task list. What lengths are printed?', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Output (use spaces):', exact: true }).fill('2 1');
  await page.getByRole('button', { name: 'Submit Answer', exact: true }).tap();
  await expect(page.getByRole('status').filter({ hasText: 'Correct.' })).toBeVisible();
  expect(engines.some(url => url.includes('/js/quiz-write-in.js'))).toBe(true);
  expect(engines.some(url => url.includes('uml-bundle') || url.includes('/mathjax@'))).toBe(false);
  checkErrors();
});
