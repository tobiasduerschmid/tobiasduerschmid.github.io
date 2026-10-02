const { test, expect } = require('@playwright/test');
const { loadTutorialConfig, waitForTutorialReady, expectActiveStep, stepButton } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

test('Haskell version 2 saves preserve drafts and matching credit but require the new price lesson', async ({ page }) => {
  test.setTimeout(150_000);
  const config = loadTutorialConfig('haskell');
  const key = 'tutorial-progress-haskell';
  const replacementIndex = config.steps.findIndex(step => step.key === 'numeric-price-contract');
  const oldStepKeys = config.steps.map(step => step.key);
  oldStepKeys[replacementIndex] = 'function-type-contracts';
  const allIndices = config.steps.map((_, index) => index);
  const matchingIndices = allIndices.filter(index => index !== replacementIndex);
  const files = {
    'Main.hs': { content: 'module Main where\nmain = print (37 :: Int)\n', language: 'haskell' },
    'Notes.hs': { content: '-- retained independent learner notes\n', language: 'haskell' },
  };
  await page.goto('/');
  await page.evaluate(({ key, files, stepKeys, allIndices, replacementIndex }) => {
    localStorage.setItem(key, JSON.stringify({
      progressVersion: 2, stepKeys, files, step: replacementIndex, activeFile: 'Main.hs',
      stepsPassed: allIndices, quizPassed: allIndices,
      stepsVisited: allIndices, stepsUnlocked: [...allIndices, allIndices.length],
    }));
  }, { key, files, stepKeys: oldStepKeys, allIndices, replacementIndex });
  await page.goto('/SEBook/tools/haskell-tutorial?autosave=true');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });

  const savedProgress = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  await expect.poll(async () => (await savedProgress()).stepKeys).toEqual(config.steps.map(step => step.key));
  const progress = await savedProgress();
  expect(progress.progressVersion).toBe(2);
  expect(progress.stepsPassed).toEqual(matchingIndices);
  expect(progress.quizPassed).toEqual(matchingIndices);
  expect(progress.files).toMatchObject(files);
  await expect(page.getByRole('status', { name: 'Saved progress update' })).toContainText('preserved');

  await page.reload();
  await waitForTutorialReady(page, { bootTimeout: 90_000 });
  await expectActiveStep(page, 0);
  await expect(page.getByRole('status', { name: 'Saved progress update' })).toHaveCount(0);
  expect((await savedProgress()).stepsPassed).toEqual(matchingIndices);
  expect((await savedProgress()).quizPassed).toEqual(matchingIndices);
  expect((await savedProgress()).files).toMatchObject(files);

  // Matching credit permits normal progression into the replacement, but the
  // removed lesson's numeric unlock must not bypass its new checks.
  await page.getByRole('button', { name: /^Next/ }).click();
  await expectActiveStep(page, replacementIndex);
  await expect(page.getByRole('button', { name: /^Next/ })).toBeDisabled();
  await a11yCheckpoint(page, 'Haskell — version 2 replaced price lesson', { feature: 'haskell-tutorial' });
});

// Published numeric saves must not credit replacement exercises, including
// changed contracts and lessons that previously taught unsupported topics.
for (const [slug, replacedIndices, resumeReplacement] of [
  ['haskell', [0, 1, 2, 6, 8], 6],
  ['haskell-functions', [1, 3, 5], 1],
  ['haskell-data', [2, 6], 6],
]) {
  test(`${slug} preserves drafts and matching progress without crediting replacement lessons`, async ({ page }) => {
    test.setTimeout(150_000);
    const config = loadTutorialConfig(slug);
    const key = `tutorial-progress-${slug}`;
    const allIndices = config.steps.map((_, index) => index);
    const matchingIndices = allIndices.filter(index => !replacedIndices.includes(index));
    const files = {
      'Main.hs': { content: 'module Main where\nmain = print (37 :: Int)\n', language: 'haskell' },
      'Notes.hs': { content: '-- retained independent learner notes\n', language: 'haskell' },
    };
    await page.goto('/');
    await page.evaluate(({ key, files, allIndices, replacedIndex }) => {
      localStorage.setItem(key, JSON.stringify({
        step: replacedIndex, activeFile: 'Main.hs', files,
        stepsPassed: allIndices, quizPassed: allIndices,
        stepsVisited: allIndices, stepsUnlocked: [...allIndices, allIndices.length],
      }));
    }, { key, files, allIndices, replacedIndex: resumeReplacement });
    await page.goto(`/SEBook/tools/${slug}-tutorial?autosave=true`);
    await waitForTutorialReady(page, { bootTimeout: 90_000 });

    const savedProgress = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    await expect.poll(async () => (await savedProgress()).progressVersion).toBe(config.progress_version);
    const progress = await savedProgress();
    await expectActiveStep(page, 0);
    expect(progress.stepsPassed).toEqual(matchingIndices);
    expect(progress.quizPassed).toEqual(matchingIndices);
    expect(progress.files).toMatchObject(files);
    expect(progress.stepKeys).toEqual(config.steps.map(step => step.key));
    const notice = page.getByRole('status', { name: 'Saved progress update' });
    await expect(notice).toContainText('preserved');
    await expect(notice).toContainText('rechecking');
    await expect(notice).not.toContainText('skip optional checks');
    await a11yCheckpoint(page, `${slug} — replaced lesson progress`, { feature: 'haskell-tutorial' });

    // A normal reload keeps the matching credit and does not migrate again.
    await page.reload();
    await waitForTutorialReady(page, { bootTimeout: 90_000 });
    await expect(page.getByRole('status', { name: 'Saved progress update' })).toHaveCount(0);
    expect((await savedProgress()).stepsPassed).toEqual(matchingIndices);
    expect((await savedProgress()).files).toMatchObject(files);

    // Matching completed lessons still lead into a replacement through the
    // normal Next action, even though its old numeric unlock was discarded.
    await stepButton(page, resumeReplacement - 1).click();
    await page.getByRole('button', { name: /^Next/ }).click();
    await expectActiveStep(page, resumeReplacement);
    await expect(page.getByRole('button', { name: /^Next/ })).toBeDisabled();
  });
}
