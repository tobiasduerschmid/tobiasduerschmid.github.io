const { test, expect } = require('@playwright/test');
const { loadTutorialConfig, expectActiveStep, waitForTutorialReady } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const URL = '/SEBook/tools/python-tutorial?autosave=true';
const STORAGE_KEY = 'tutorial-progress-python';
const config = loadTutorialConfig('python');
const LEGACY_KEYS = ['hello', 'variables', 'indentation', 'functions', 'type-hints', 'loops',
  'comprehensions', 'files', 'regex', 'argv', 'capstone', 'dataclasses'];
const lessonIndex = key => config.steps.findIndex(step => step.key === key);
const lessonFile = key => config.steps[lessonIndex(key)].open_file;
const draft = content => ({ content, language: 'python' });

// Storage is the public format exported/imported by SE Gym. Seed it before
// loading the real tutorial; do not replace the runtime or its backend.
async function restore(page, progress, hash = '') {
  await page.goto('/');
  await page.evaluate(({ key, progress }) => {
    localStorage.setItem(key, JSON.stringify(progress));
  }, { key: STORAGE_KEY, progress });
  await page.goto(URL + hash, { waitUntil: 'domcontentloaded' });
  await waitForTutorialReady(page, { bootTimeout: 120_000 });
  await expect.poll(async () => (await savedProgress(page)).progressVersion).toBe(config.progress_version);
}

function savedProgress(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

function passedKeys(progress, field) {
  return progress[field].map(index => progress.stepKeys[index]);
}

test.describe('tutorial progress follows lessons across the Python expansion', () => {
  test.setTimeout(180_000);

  test('a completed twelve-step save resumes dataclasses and preserves drafts without crediting new lessons', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const files = {
      'geometry.py': draft('print("retained geometry draft")\n'),
      'my-notes.py': draft('# independently saved learner file\n'),
      'functions.py': draft('def mean(values):\n    return sum(values) / len(values)\n'),
    };
    await restore(page, {
      step: 11, activeFile: 'geometry.py', files,
      stepsVisited: Array.from({ length: 12 }, (_, i) => i),
      stepsPassed: Array.from({ length: 12 }, (_, i) => i),
      quizPassed: Array.from({ length: 12 }, (_, i) => i),
      // This legacy sentinel must not be mistaken for a 20-step save.
      stepsUnlocked: Array.from({ length: 13 }, (_, i) => i),
    });

    await expectActiveStep(page, lessonIndex('dataclasses'));
    const notice = page.getByRole('status', { name: 'Saved progress update' });
    await expect(notice).toContainText('preserved');
    await a11yCheckpoint(page, 'matched tutorial progress migration', { feature: 'tutorial-progress-migration' });
    const progress = await savedProgress(page);
    expect(passedKeys(progress, 'stepsPassed')).toEqual(LEGACY_KEYS);
    expect(passedKeys(progress, 'quizPassed')).toEqual(LEGACY_KEYS);
    expect(passedKeys(progress, 'stepsVisited')).toEqual(LEGACY_KEYS);
    expect(progress.files).toMatchObject(files);
    await page.getByRole('button', { name: /^▶ Run$/ }).click();
    await expect(page.getByRole('region', { name: 'Program output' })).toContainText('retained geometry draft');

    // Revisiting an inserted lesson must still offer its optional quiz.
    await page.getByRole('button', { name: new RegExp(`^Step ${lessonIndex('inheritance') + 1}:`) }).click();
    await expectActiveStep(page, lessonIndex('inheritance'));
    await page.getByRole('button', { name: /^Next →$/ }).click();
    await expect(page.getByRole('button', { name: 'Skip Knowledge Check' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a twenty-step preview with fully unlocked navigation retains its current class lesson', async ({ page }) => {
    const classes = lessonIndex('classes');
    await restore(page, {
      step: classes, activeFile: lessonFile('classes'), files: {},
      stepsPassed: [classes], quizPassed: [classes], stepsVisited: [classes],
      stepsUnlocked: Array.from({ length: 20 }, (_, i) => i),
    });
    await expectActiveStep(page, classes);
    const progress = await savedProgress(page);
    expect(passedKeys(progress, 'stepsPassed')).toEqual(['classes']);
    expect(passedKeys(progress, 'quizPassed')).toEqual(['classes']);
    expect(progress.progressVersion).toBe(config.progress_version);
  });

  test('a new object exercise draft identifies a preview even without later numeric indices', async ({ page }) => {
    const members = lessonIndex('members');
    const filename = lessonFile('members');
    const files = { [filename]: draft('# retain the new member-object exercise\n') };
    await restore(page, {
      step: members, activeFile: filename, files,
      stepsPassed: [members], quizPassed: [members], stepsVisited: [members],
      stepsUnlocked: [0, members],
    });
    await expectActiveStep(page, members);
    const progress = await savedProgress(page);
    expect(passedKeys(progress, 'stepsPassed')).toEqual(['members']);
    expect(progress.files).toMatchObject(files);
  });

  test('ambiguous numeric records preserve drafts and only retain completions shared by both orderings', async ({ page }) => {
    const files = { 'scratch.py': draft('# my work must survive uncertainty\n') };
    await restore(page, {
      step: 5, activeFile: 'scratch.py', files,
      stepsPassed: [0, 1, 2, 5], quizPassed: [0, 1, 2, 5],
      stepsVisited: [0, 1, 2, 5], stepsUnlocked: [0, 1, 2, 3, 4, 5, 6],
    });
    await expectActiveStep(page, 0);
    const notice = page.getByRole('status', { name: 'Saved progress update' });
    await expect(notice).toContainText('could not be matched confidently');
    await expect(notice).toContainText('skip optional checks');
    await a11yCheckpoint(page, 'ambiguous tutorial progress migration', { feature: 'tutorial-progress-migration' });
    const progress = await savedProgress(page);
    expect(passedKeys(progress, 'stepsPassed')).toEqual(['hello', 'variables']);
    expect(passedKeys(progress, 'quizPassed')).toEqual(['hello', 'variables']);
    expect(progress.files).toMatchObject(files);
  });

  test('an ambiguous save can resume a uniquely identified file without assigning its uncertain passes', async ({ page }) => {
    const filename = lessonFile('regex');
    const files = { [filename]: draft('# saved regular-expression work\n') };
    await restore(page, {
      step: 5, activeFile: filename, files,
      stepsPassed: [5], quizPassed: [5], stepsVisited: [5], stepsUnlocked: [0, 5],
    });
    await expectActiveStep(page, lessonIndex('regex'));
    const progress = await savedProgress(page);
    expect(progress.stepsPassed).toEqual([]);
    expect(progress.quizPassed).toEqual([]);
    expect(progress.files).toMatchObject(files);
  });

  test('stable keys preserve passes through reordering while a deep link selects the resume lesson', async ({ page }) => {
    const stepKeys = config.steps.map(step => step.key).reverse();
    const files = { 'scratch.py': draft('# retained across reordering and reload\n') };
    await restore(page, {
      progressVersion: 1, stepKeys, files,
      step: stepKeys.indexOf('classes'), activeFile: lessonFile('classes'),
      stepsPassed: [stepKeys.indexOf('classes'), stepKeys.indexOf('references')],
      quizPassed: [stepKeys.indexOf('classes')],
      stepsVisited: [stepKeys.indexOf('classes')], stepsUnlocked: [0],
    }, '#files');
    await expectActiveStep(page, lessonIndex('files'));
    const migrated = await savedProgress(page);
    expect(passedKeys(migrated, 'stepsPassed')).toEqual(['classes', 'references']);
    expect(passedKeys(migrated, 'quizPassed')).toEqual(['classes']);
    expect(migrated.files).toMatchObject(files);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForTutorialReady(page, { bootTimeout: 120_000 });
    await expectActiveStep(page, lessonIndex('files'));
    await expect(page.getByRole('status', { name: 'Saved progress update' })).toHaveCount(0);
    const reloaded = await savedProgress(page);
    expect(reloaded.stepsPassed).toEqual(migrated.stepsPassed);
    expect(reloaded.quizPassed).toEqual(migrated.quizPassed);
    expect(reloaded.stepKeys).toEqual(migrated.stepKeys);
    expect(reloaded.files).toMatchObject(files);
  });

  test('unusable version metadata never guesses completion identities from numeric positions', async ({ page }) => {
    const files = { 'scratch.py': draft('# preserve even an unsupported export\n') };
    await restore(page, {
      progressVersion: 99, stepKeys: ['duplicate', 'duplicate'],
      step: 1, activeFile: 'scratch.py', files,
      stepsPassed: [0, 1], quizPassed: [0, 1], stepsVisited: [0, 1], stepsUnlocked: [0, 1],
    });
    await expectActiveStep(page, 0);
    await expect(page.getByRole('status', { name: 'Saved progress update' }))
      .toContainText('could not be matched confidently');
    const progress = await savedProgress(page);
    expect(progress.stepsPassed).toEqual([]);
    expect(progress.quizPassed).toEqual([]);
    expect(progress.files).toMatchObject(files);
  });

  test('fresh learners receive stable progress without a migration warning or required checks', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await waitForTutorialReady(page, { bootTimeout: 120_000 });
    await expect(page.getByRole('status', { name: 'Saved progress update' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Next →$/ })).toBeEnabled();
    await page.getByRole('button', { name: new RegExp(`^Step ${lessonIndex('dataclasses') + 1}:`) }).click();
    await expectActiveStep(page, lessonIndex('dataclasses'));
    await expect.poll(async () => (await savedProgress(page)).step).toBe(lessonIndex('dataclasses'));
    const progress = await savedProgress(page);
    expect(progress.stepKeys).toEqual(config.steps.map(step => step.key));
    expect(progress.stepsPassed).toEqual([]);
    expect(progress.quizPassed).toEqual([]);
  });
});
