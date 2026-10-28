const { test, expect } = require('@playwright/test');
const { readFile } = require('node:fs/promises');
const { createDecipheriv, pbkdf2Sync } = require('node:crypto');
const diagrams = require('./fixtures/monopoly-uml');
const { a11yCheckpoint } = require('./a11y-helpers');

const HOMEWORK = '/SEBook/designpatterns/monopoly-state-pattern-uml-homework';
const TUTORIAL_ID = 'monopoly-state-pattern-uml';
const TYPES = ['class', 'state', 'sequence'];
const editedDiagrams = Object.fromEntries(TYPES.map(type => [
  type, diagrams[type].replace('@startuml', `@startuml\n' Latest ${type} draft — €50`),
]));

async function openHomework(page, saved = diagrams) {
  // Prior learner work enters through the documented persistence boundary.
  await page.addInitScript(({ saved, tutorialId }) => {
    for (const [type, source] of Object.entries(saved)) {
      localStorage.setItem(`uml-pg-autosave-${tutorialId}-${type}`, source);
    }
  }, { saved, tutorialId: TUTORIAL_ID });
  await page.goto(HOMEWORK);
  await expect(page.getByRole('button', { name: 'Export All UML', exact: true })).toBeVisible();
}

async function setCurrentSource(page, source) {
  // The homework intentionally hides its text pane. Supply a draft at the
  // labelled input boundary, leaving export, navigation, and storage real.
  await page.getByLabel('ArchUML diagram source', { exact: true }).evaluate((input, source) => {
    input.value = source;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, source);
}

async function preventDebouncedSave(page) {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
}

async function downloadUml(page, label = 'Export All UML') {
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).press('Enter');
  const download = await downloaded;
  const file = test.info().outputPath(download.suggestedFilename());
  await download.saveAs(file);
  const envelope = JSON.parse(await readFile(file, 'utf8'));
  expect(envelope.format).toBe('sebook.archuml.encrypted');
  expect(envelope.crypto).toMatchObject({
    algorithm: 'AES-GCM', keyLength: 128, kdf: 'PBKDF2', hash: 'SHA-256', iterations: 200000,
  });

  // Decrypt independently of the browser exporter, as the autograder does.
  const key = pbkdf2Sync('4-amigos', Buffer.from(envelope.crypto.salt, 'base64'),
    envelope.crypto.iterations, 16, 'sha256');
  const encrypted = Buffer.from(envelope.ciphertext, 'base64');
  const decipher = createDecipheriv('aes-128-gcm', key, Buffer.from(envelope.crypto.iv, 'base64'));
  decipher.setAuthTag(encrypted.subarray(-16));
  const plaintext = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]);
  return { download, envelope, payload: JSON.parse(plaintext.toString('utf8')) };
}

function expectHomeworkBundle(result, expected) {
  expect(result.download.suggestedFilename()).toBe(`${TUTORIAL_ID}.uml`);
  expect(result.envelope.version).toBe(2);
  expect(result.envelope.tutorialId).toBe(TUTORIAL_ID);
  expect(result.payload.tutorialId).toBe(TUTORIAL_ID);
  expect(result.payload.diagrams).toEqual(expected);
}

for (const [stepIndex, type] of TYPES.entries()) {
  test(`export from the ${type} step includes all three diagrams and the latest unsaved edit`, async ({ page }) => {
    await openHomework(page);
    for (let step = 0; step < stepIndex; step++) {
      await page.getByRole('button', { name: 'Next →', exact: true }).click();
    }
    await expect(page.getByLabel('ArchUML diagram source', { exact: true })).toHaveValue(diagrams[type]);
    // A paused browser clock makes the pre-autosave boundary deterministic.
    await preventDebouncedSave(page);
    await setCurrentSource(page, editedDiagrams[type]);

    expectHomeworkBundle(await downloadUml(page), { ...diagrams, [type]: editedDiagrams[type] });
  });
}

test('export preserves edits made immediately before moving between homework steps', async ({ page }) => {
  await openHomework(page);
  await preventDebouncedSave(page);
  await setCurrentSource(page, editedDiagrams.class);
  await page.getByRole('button', { name: 'Next →', exact: true }).press('Enter');
  await expect(page.getByLabel('ArchUML diagram source', { exact: true })).toHaveValue(diagrams.state);
  await setCurrentSource(page, editedDiagrams.state);
  await page.getByRole('button', { name: 'Next →', exact: true }).press('Enter');
  await expect(page.getByLabel('ArchUML diagram source', { exact: true })).toHaveValue(diagrams.sequence);
  await setCurrentSource(page, editedDiagrams.sequence);

  expectHomeworkBundle(await downloadUml(page), editedDiagrams);
});

test('blank and unvisited diagrams export without importing unrelated playground drafts', async ({ page }) => {
  await page.addInitScript(saved => {
    for (const [type, source] of Object.entries(saved)) {
      localStorage.setItem(`uml-pg-autosave-${type}`, source);
      localStorage.setItem(`uml-pg-autosave-other-homework-${type}`, source);
    }
  }, diagrams);
  await openHomework(page, {});
  await preventDebouncedSave(page);
  const blankClass = '@startuml\n@enduml';
  await setCurrentSource(page, blankClass);

  expectHomeworkBundle(await downloadUml(page), { class: blankClass, state: '', sequence: '' });
});

for (const theme of ['light', 'dark']) {
  test(`keyboard export announces the combined download in ${theme} mode`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await openHomework(page);
    await page.evaluate(theme => document.documentElement.classList.toggle('dark-mode', theme === 'dark'), theme);
    const button = page.getByRole('button', { name: 'Export All UML', exact: true });
    await button.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    await expect(button).toBeInViewport({ ratio: 1 });
    await button.click({ trial: true });

    expectHomeworkBundle(await downloadUml(page), diagrams);
    await expect(page.getByRole('status').filter({ hasText: /All 3 diagrams downloaded in one UML file/ })).toBeVisible();
    await expect(button).toBeEnabled();
    await a11yCheckpoint(page, `combined UML export ${theme}`, { include: '[role="group"][aria-label="Export"]', darkMode: false });
    expect(errors, 'export must not cause browser JavaScript errors').toEqual([]);
  });
}

test('the standalone UML playground still downloads the current diagram as a version 1 file', async ({ page }) => {
  await page.goto('/SEBook/tools/uml-playground');
  await page.getByLabel('ArchUML diagram source', { exact: true }).fill(diagrams.class);

  const result = await downloadUml(page, 'Export UML');
  expect(result.envelope.version).toBe(1);
  expect(result.envelope.diagramType).toBe('class');
  expect(result.payload.diagramType).toBe('class');
  expect(result.payload.archuml).toBe(diagrams.class);
});
