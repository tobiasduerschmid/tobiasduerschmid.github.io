const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const compilerURL = '/SEBook/tools/compilers-tutorial?autosave=true';
const umlURL = '/SEBook/designpatterns/monopoly-state-pattern-uml-homework';
const draft = '@startuml\nclass KeepMyWork\n@enduml';

test.beforeEach(async ({ page }) => {
  // Browser confirmations may be suppressed in fullscreen; none of these
  // actions may depend on one. Dismiss so a regression fails without hanging.
  page.on('dialog', async dialog => {
    await dialog.dismiss();
    throw new Error('Unexpected browser dialog: ' + dialog.message());
  });
});

async function fullscreen(page, selector = 'html') {
  await page.locator(selector).evaluate(element => element.requestFullscreen());
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
}

async function openUML(page, url = umlURL) {
  if (url === '/SEBook/tools/uml-editor') {
    // The standalone editor intentionally starts empty without persistence.
    await page.goto(url);
    await expect(page.locator('#uml-pg-input')).toHaveValue('@startuml\n@enduml');
    return;
  }
  const key = url === umlURL ? 'uml-pg-autosave-monopoly-state-pattern-uml-class' : 'uml-pg-autosave-class';
  await page.addInitScript(({ source, key }) => localStorage.setItem(key, source), { source: draft, key });
  await page.goto(url);
  await expect(page.locator('#uml-pg-input')).toHaveValue(draft);
}

test('reset current step confirms in fullscreen, traps focus, and supports cancel and retry', async ({ page }, testInfo) => {
  await page.goto(compilerURL);
  const source = page.getByLabel('Source program', { exact: true });
  await expect(source).toBeVisible();
  const starter = await source.inputValue();
  await source.fill('keep my edited program');
  await fullscreen(page);
  const reset = page.getByRole('link', { name: 'Reset Current Step', exact: true });
  await reset.click();
  const dialog = page.getByRole('dialog', { name: 'Reset the current step?', exact: true });
  await expect(dialog).toBeVisible();
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
  const confirm = dialog.getByRole('button', { name: 'Reset step', exact: true });
  await expect(cancel).toBeFocused();
  await expect(source).toHaveValue('keep my edited program');
  await page.keyboard.press('Shift+Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(reset).toBeFocused();
  await expect(source).toHaveValue('keep my edited program');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await reset.click();
  await a11yCheckpoint(page, 'fullscreen tutorial confirmation', { include: '[role="dialog"], dialog' });
  await page.screenshot({ path: testInfo.outputPath('fullscreen-reset-dialog.png') });
  await confirm.click();
  await expect(dialog).toBeHidden();
  await expect(source).toHaveValue(starter);
  await expect(reset).toBeFocused();
});

test('UML tutorial reset uses one custom confirmation in fullscreen', async ({ page }) => {
  await openUML(page);
  await fullscreen(page);
  const reset = page.getByRole('link', { name: 'Reset Current Step', exact: true });
  await reset.click();
  const dialog = page.getByRole('dialog', { name: 'Reset the current diagram?', exact: true });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#uml-pg-input')).toHaveValue(draft);
  await reset.click();
  await dialog.getByRole('button', { name: 'Reset diagram', exact: true }).click();
  await expect(page.locator('#uml-pg-input')).toHaveValue('@startuml\n@enduml');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(reset).toBeFocused();
});

test('Empty remains clickable above the fullscreen UML editor and can be undone', async ({ page }) => {
  await openUML(page, '/SEBook/tools/uml-editor');
  await page.getByRole('button', { name: 'Add element: Class', exact: true }).press('Enter');
  const editedDraft = await page.locator('#uml-pg-input').inputValue();
  const fullScreen = page.getByRole('button', { name: /Full screen/ });
  await fullScreen.click();
  const empty = page.getByRole('button', { name: /Empty/, exact: false });
  await empty.click();
  const dialog = page.getByRole('dialog', { name: 'Empty the current diagram?', exact: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('#uml-pg-input')).toHaveValue(editedDraft);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('uml-playground-wrap');
  await expect(empty).toBeFocused();
  await expect(page.locator('#uml-pg-input')).toHaveValue(editedDraft);
  await empty.click();
  await dialog.getByRole('button', { name: 'Empty diagram', exact: true }).click();
  await expect(page.locator('#uml-pg-input')).toHaveValue('@startuml\n@enduml');
  await page.getByRole('button', { name: /Undo/ }).click();
  await expect(page.locator('#uml-pg-input')).toHaveValue(editedDraft);
});

test('Remove All Elements is visible when the tutorial container itself is fullscreen', async ({ page }) => {
  await openUML(page);
  await fullscreen(page, '#tutorial-container');
  const clear = page.getByRole('button', { name: 'Remove All Elements', exact: true });
  await clear.click();
  const dialog = page.getByRole('dialog', { name: 'Remove all UML elements from this step?', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Remove Elements', exact: true }).click();
  await expect(page.locator('#uml-pg-input')).toHaveValue('@startuml\n@enduml');
  await expect(clear).toBeFocused();
});

test('auto-save deletion confirmation works in fullscreen and No preserves the draft', async ({ page }) => {
  await page.goto(compilerURL);
  const source = page.getByLabel('Source program', { exact: true });
  await expect(source).toBeVisible();
  await source.fill('keep this saved program');
  const savedDraft = await page.evaluate(() => localStorage.getItem('tutorial-progress-compilers'));
  expect(savedDraft).toContain('keep this saved program');
  await fullscreen(page);
  const toggle = page.getByRole('checkbox', { name: 'Auto-save', exact: true });
  await toggle.press('Space');
  const dialog = page.getByRole('dialog', { name: 'Delete saved progress?', exact: true });
  await expect(dialog.getByRole('button', { name: 'No', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: 'No', exact: true }).click();
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeFocused();
  await expect(source).toHaveValue('keep this saved program');
  expect(await page.evaluate(() => localStorage.getItem('tutorial-progress-compilers'))).toBe(savedDraft);
});

test('Example confirms before replacing a standalone draft', async ({ page }) => {
  await openUML(page, '/SEBook/tools/uml-playground');
  const example = page.getByRole('button', { name: /Example/, exact: false });
  await example.click();
  const dialog = page.getByRole('dialog', { name: 'Load the example diagram?', exact: true });
  await expect(page.locator('#uml-pg-input')).toHaveValue(draft);
  await dialog.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(page.locator('#uml-pg-input')).toHaveValue(/class Animal/);
  await expect(example).toBeFocused();
});

test('confirmation fits a narrow screen in both themes and is omitted from print', async ({ page }, testInfo) => {
  await openUML(page, '/SEBook/tools/uml-editor');
  await page.getByRole('button', { name: /Empty/, exact: false }).click();
  const dialog = page.getByRole('dialog', { name: 'Empty the current diagram?', exact: true });
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expect(dialog.getByRole('button', { name: 'Empty diagram', exact: true })).toBeInViewport({ ratio: 1 });
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await a11yCheckpoint(page, 'narrow confirmation', { include: 'dialog' });
  for (const dark of [false, true]) {
    await page.locator('html').evaluate((html, dark) => html.classList.toggle('dark-mode', dark), dark);
    expect(await dialog.locator('p').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(17);
    await page.screenshot({ path: testInfo.outputPath('confirmation-' + (dark ? 'dark' : 'light') + '.png') });
  }
  await page.emulateMedia({ media: 'print' });
  await expect(dialog).toBeHidden();
});


test('SE Gym confirms and cancels in fullscreen without changing saved statistics', async ({ page, context, baseURL }, testInfo) => {
  await context.addCookies(['se-gym-active', 'analyze-performance'].map(name => ({ name, value: 'true', url: baseURL })));
  await page.goto('/se-gym/');
  const savedStats = await page.evaluate(() => {
    PersonalGym.saveStats({ test: { seen: 5, correct: 1 } });
    return PersonalGym.getStats();
  });
  await fullscreen(page);
  const toggle = page.locator('#analyzePerformanceToggle');
  await toggle.press('Space');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'No', exact: true })).toBeFocused();
  await a11yCheckpoint(page, 'SE Gym fullscreen confirmation', { include: '#confirm-modal' });
  await page.screenshot({ path: testInfo.outputPath('gym-fullscreen-confirmation.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(toggle).toBeChecked();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  expect(await page.evaluate(() => PersonalGym.getStats())).toEqual(savedStats);
  await toggle.press('Space');
  await dialog.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(toggle).not.toBeChecked();
  expect(await page.evaluate(() => PersonalGym.getStats())).toEqual({});
});

test('SE Gym export Escape closes the dialog and restores focus in fullscreen', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'se-gym-active', value: 'true', url: baseURL }]);
  await page.goto('/se-gym/');
  await fullscreen(page);
  const trigger = page.locator('#download-tutorial-progress-btn');
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Select tutorials to export' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
});

test('Spec Card reset preserves work on cancel in fullscreen', async ({ page }) => {
  await page.goto('/SEBook/tools/spec-card');
  const widget = page.getByRole('region', { name: /spec card/i }).first();
  const behavior = widget.getByLabel(/behavior/i);
  await behavior.fill('Keep this specification');
  await fullscreen(page);
  await widget.getByRole('button', { name: /reset/i }).click();
  const dialog = page.getByRole('dialog', { name: 'Reset Spec Card?' });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(behavior).toHaveValue('Keep this specification');
  await widget.getByRole('button', { name: /reset/i }).click();
  await dialog.getByRole('button', { name: 'Reset card' }).click();
  await expect(behavior).toHaveValue('');
});


test('clipboard failure shows an accessible notice in fullscreen', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Clipboard unavailable')) } });
  });
  await page.goto('/SEBook/tools/spec-card');
  await fullscreen(page);
  const copy = page.getByRole('button', { name: /Copy to clipboard/i }).first();
  await copy.click();
  const dialog = page.getByRole('dialog', { name: 'Could not copy' });
  await expect(dialog).toContainText('Use Export to download instead.');
  const ok = dialog.getByRole('button', { name: 'OK', exact: true });
  await expect(ok).toBeFocused();
  await ok.press('Tab');
  await expect(ok).toBeFocused();
  await ok.click();
  await expect(dialog).toBeHidden();
  await expect(copy).toBeFocused();
});

test('hero customizer remains readable and dismissible in fullscreen', async ({ page, context, baseURL }, testInfo) => {
  await context.addCookies([{ name: 'se-gym-active', value: 'true', url: baseURL }]);
  await page.goto('/se-gym/');
  await fullscreen(page);
  const trigger = page.getByRole('button', { name: 'Customize Hero', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Customize your hero' });
  await expect(dialog).toBeVisible();
  for (const dark of [false, true]) {
    await page.locator('html').evaluate((html, dark) => html.classList.toggle('dark-mode', dark), dark);
    await expect(dialog.getByRole('button', { name: 'Close hero customizer' })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('hero-dialog-' + (dark ? 'dark' : 'light') + '.png') });
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
});
