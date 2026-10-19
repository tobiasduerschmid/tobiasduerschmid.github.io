// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig, expectActiveStep, waitForTutorialReady,
  stepButton, setTutorialFileContent, applySolution,
} = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const tutorials = [
  { kind: 'class', designKey: 'store-design', capstoneKey: 'store-capstone', legacyCapstone: 8 },
  { kind: 'sequence', designKey: 'digest-design', capstoneKey: 'moderated-broadcast', legacyCapstone: 5 },
].map(tutorial => ({
  ...tutorial,
  id: `uml-${tutorial.kind}-diagram-python`,
  config: loadTutorialConfig(`uml-${tutorial.kind}-diagram-python`),
}));
const indexOf = (tutorial, key) => tutorial.config.steps.findIndex(step => step.key === key);
const storageKey = tutorial => `tutorial-progress-${tutorial.id}`;
const savedProgress = (page, tutorial) => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey(tutorial));
const passedKeys = progress => progress.stepsPassed.map(index => progress.stepKeys[index]);

// Seed the public progress format used by the site's import/export feature.
// The actual tutorial runtime, editor, and Python backend handle the restore.
async function restore(page, tutorial, progress) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await page.evaluate(({ key, progress }) => localStorage.setItem(key, JSON.stringify(progress)), {
    key: storageKey(tutorial), progress,
  });
  await page.goto(`/SEBook/tools/${tutorial.id}.html?autosave=true`, { waitUntil: 'domcontentloaded' });
  await waitForTutorialReady(page, { bootTimeout: 120_000 });
  await expect.poll(async () => (await savedProgress(page, tutorial)).progressVersion)
    .toBe(tutorial.config.progress_version);
  return pageErrors;
}

for (const tutorial of tutorials) {
  test(`${tutorial.kind}: an old capstone keeps its draft and completion without crediting the new design lesson`, async ({ page }) => {
    test.setTimeout(180_000);
    const capstone = indexOf(tutorial, tutorial.capstoneKey);
    const sourceFile = tutorial.config.steps[capstone].open_file;
    const draft = 'print("My retained capstone draft")\n';
    const pageErrors = await restore(page, tutorial, {
      step: tutorial.legacyCapstone, activeFile: sourceFile,
      files: { [sourceFile]: { content: draft, language: 'python' } },
      stepsPassed: [tutorial.legacyCapstone], quizPassed: [tutorial.legacyCapstone],
      stepsVisited: [tutorial.legacyCapstone],
      stepsUnlocked: Array.from({ length: tutorial.config.legacy_step_keys.length + 1 }, (_, index) => index),
    });

    await expectActiveStep(page, capstone);
    const progress = await savedProgress(page, tutorial);
    expect(passedKeys(progress)).toEqual([tutorial.capstoneKey]);
    expect(progress.quizPassed.map(index => progress.stepKeys[index])).toEqual([tutorial.capstoneKey]);
    await page.getByRole('button', { name: /^▶ Run$/ }).click();
    await expect(page.getByRole('region', { name: 'Program output' })).toContainText('My retained capstone draft');
    expect(pageErrors).toEqual([]);
  });

  test(`${tutorial.kind}: design notes survive moving to the suggested model, applying its solution, resetting the code, and reloading`, async ({ page }) => {
    test.setTimeout(180_000);
    const design = indexOf(tutorial, tutorial.designKey);
    const capstone = indexOf(tutorial, tutorial.capstoneKey);
    const notesFile = tutorial.config.steps[design].open_file;
    const note = 'My independent design: validate the complete request before making changes.';
    const pageErrors = await restore(page, tutorial, {
      progressVersion: tutorial.config.progress_version,
      stepKeys: tutorial.config.steps.map(step => step.key),
      step: design, activeFile: notesFile, files: {},
      stepsPassed: [], quizPassed: [], stepsVisited: [design],
      stepsUnlocked: Array.from({ length: design + 1 }, (_, index) => index),
    });
    await expectActiveStep(page, design);
    await a11yCheckpoint(page, `${tutorial.kind} design proposal`, { feature: 'uml-design-capstones' });
    expect(await setTutorialFileContent(page, notesFile, note + '\n')).toBe(true);
    await expect(page.getByRole('button', { name: /^Next →$/ })).toBeEnabled();
    await page.getByRole('button', { name: /^Next →$/ }).click();
    await expectActiveStep(page, capstone);
    await a11yCheckpoint(page, `${tutorial.kind} suggested design`, { feature: 'uml-design-capstones' });
    await expect.poll(async () => (await savedProgress(page, tutorial)).files[notesFile]?.content).toBe(note + '\n');

    await applySolution(page);
    await page.evaluate(() => window._tutorial.resetStep());
    await expect.poll(async () => (await savedProgress(page, tutorial)).files[notesFile]?.content).toBe(note + '\n');
    await stepButton(page, design).click();
    await expectActiveStep(page, design);
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForTutorialReady(page, { bootTimeout: 120_000 });
    await expectActiveStep(page, design);
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    expect((await savedProgress(page, tutorial)).files[notesFile].content).toBe(note + '\n');
    expect(pageErrors).toEqual([]);
  });
}

test('class: an old reference placeholder cannot replace capstone code or complete the new design lesson', async ({ page }) => {
  test.setTimeout(180_000);
  const tutorial = tutorials.find(item => item.kind === 'class');
  const capstone = indexOf(tutorial, tutorial.capstoneKey);
  const placeholder = '# Reference notes from the old final lesson\n';
  const pageErrors = await restore(page, tutorial, {
    step: 9, activeFile: 'store.py',
    files: { 'store.py': { content: placeholder, language: 'python' } },
    stepsPassed: [9], quizPassed: [9], stepsVisited: [9],
    stepsUnlocked: Array.from({ length: 11 }, (_, index) => index),
  });

  await expectActiveStep(page, capstone);
  const progress = await savedProgress(page, tutorial);
  expect(passedKeys(progress)).toEqual([]);
  expect(progress.quizPassed).toEqual([]);
  expect(progress.files['store.py'].content).toBe(placeholder);
  // The old source remains exportable, while this lesson opens its real starter.
  await page.getByRole('button', { name: /^▶ Run$/ }).click();
  await expect(page.getByRole('region', { name: 'Program output' })).toContainText('Order total: $1029.98');
  expect(pageErrors).toEqual([]);
});
