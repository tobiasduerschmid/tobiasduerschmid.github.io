const { test, expect } = require('@playwright/test');
const { PDFDocument, PDFName, PDFDict } = require('pdf-lib');
const { loadLesson } = require('../scripts/narration/source');
const { a11yCheckpoint } = require('./a11y-helpers');

const { lesson, story } = loadLesson('observer');
const storageKey = 'sebook-narration-notes-observer';
const entryKey = `cue:${story.scenes[0].id}/${story.scenes[0].cues[0].id}`;
const firstNote = page => page.getByRole('textbox', { name: 'Your notes', exact: true }).first();
const ready = page => expect(page.locator('[data-notes-status]')).toHaveText('The pictures are ready.', { timeout: 60000 });

// Inspect the actual appearance of the selected phrase, independent of whether
// the browser represents formatting with b/strong, i/em, or other markup.
async function phraseStyle(field, phrase = '') {
  return field.evaluate((element, sought) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode()) && (!text.textContent.trim() || !text.textContent.includes(sought))) { /* find the visible phrase */ }
    if (!text) return null;
    const style = getComputedStyle(text.parentElement);
    let underlined = false;
    for (let node = text.parentElement; node && node !== element.parentElement; node = node.parentElement) {
      underlined ||= getComputedStyle(node).textDecorationLine.includes('underline');
    }
    return { bold: Number(style.fontWeight) >= 600, italic: style.fontStyle === 'italic', underlined };
  }, phrase);
}

async function selectNote(field) {
  await field.focus();
  await field.press('ControlOrMeta+A');
}

async function pasteHtml(field, html) {
  await field.focus();
  // Clipboard data is an external input boundary; dispatch a real paste event
  // without replacing the editor's paste handler or sanitizer.
  await field.evaluate((element, markup) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/html', markup);
    clipboardData.setData('text/plain', 'Safe pasted note');
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    // Firefox does not accept clipboardData in the ClipboardEvent constructor.
    Object.defineProperty(event, 'clipboardData', { value: clipboardData });
    element.dispatchEvent(event);
  }, html);
}

for (const modifier of ['Control', 'Meta']) {
  test(`${modifier} formatting shortcuts toggle emphasis and preserve it after reload`, async ({ page }) => {
    await page.goto(lesson.notes_url);
    await ready(page);
    const field = firstNote(page);
    await field.fill('Important observation');
    await selectNote(field);
    await field.press(`${modifier}+b`);
    await field.press(`${modifier}+i`);
    await field.press(`${modifier}+u`);
    await expect.poll(() => phraseStyle(field)).toEqual({ bold: true, italic: true, underlined: true });
    await field.press(`${modifier}+b`);
    await expect.poll(() => phraseStyle(field)).toEqual({ bold: false, italic: true, underlined: true });
    await expect(page.getByRole('toolbar')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(Bold|Italic|Underline)$/ })).toHaveCount(0);
    await page.reload();
    await ready(page);
    await expect(field).toHaveText('Important observation');
    await expect.poll(() => phraseStyle(field)).toEqual({ bold: false, italic: true, underlined: true });
    await selectNote(field);
    await field.press(`${modifier}+i`);
    await field.press(`${modifier}+u`);
    await expect.poll(() => phraseStyle(field)).toEqual({ bold: false, italic: false, underlined: false });
    await field.press('Tab');
    await expect(field).not.toBeFocused();
    await a11yCheckpoint(page, `${modifier} formatted narration note`, { feature: 'narration-notes' });
  });
}

test('formatting can start before typing and be removed from restored text', async ({ page }) => {
  await page.goto(lesson.notes_url);
  await ready(page);
  const field = firstNote(page);
  await field.focus();
  await field.press('ControlOrMeta+b');
  await field.pressSequentially('Bold observation');
  await expect.poll(() => phraseStyle(field)).toMatchObject({ bold: true });
  await field.press('ControlOrMeta+b');
  await field.pressSequentially(' then plain');
  await expect.poll(() => phraseStyle(field, 'then plain')).toMatchObject({ bold: false });
  await page.reload();
  await ready(page);
  await expect.poll(() => phraseStyle(field, 'Bold observation')).toMatchObject({ bold: true });
  await expect.poll(() => phraseStyle(field, 'then plain')).toMatchObject({ bold: false });
  // Select the initial words using keyboard selection after placing the caret
  // at the start of this one-line note.
  await field.focus();
  await field.press('ControlOrMeta+A');
  await field.press('ArrowLeft');
  for (let index = 0; index < 'Bold observation'.length; index += 1) await field.press('Shift+ArrowRight');
  await field.press('ControlOrMeta+b');
  await expect.poll(() => phraseStyle(field, 'Bold observation')).toMatchObject({ bold: false });
});

for (const [key, listStyle] of [['7', 'decimal'], ['8', 'disc']]) {
  test(`the list shortcut ${key} creates a two-item list that survives reload`, async ({ page }) => {
    await page.goto(lesson.notes_url);
    await ready(page);
    const field = firstNote(page);
    await field.pressSequentially('First observation');
    await field.press('Enter');
    await field.pressSequentially('Second observation');
    await selectNote(field);
    await field.press(`ControlOrMeta+Shift+${key}`);
    await expect(field.getByRole('listitem')).toHaveText(['First observation', 'Second observation']);
    await expect(field.getByRole('list')).toHaveCSS('list-style-type', listStyle);
    await page.reload();
    await ready(page);
    await expect(field.getByRole('listitem')).toHaveText(['First observation', 'Second observation']);
    await expect(field.getByRole('list')).toHaveCSS('list-style-type', listStyle);
  });
}

test('native undo and redo restore formatting on a saved note', async ({ page }) => {
  await page.goto(lesson.notes_url);
  await ready(page);
  const field = firstNote(page);
  await field.fill('An observation worth keeping');
  // Begin a fresh editing session so native undo groups cannot combine the
  // original typing with this separate formatting action.
  await page.reload();
  await ready(page);
  await selectNote(field);
  await field.press('ControlOrMeta+b');
  await expect.poll(() => phraseStyle(field)).toMatchObject({ bold: true });
  await field.press('ControlOrMeta+z');
  await expect(field).toHaveText('An observation worth keeping');
  await expect.poll(() => phraseStyle(field)).toMatchObject({ bold: false });
  await field.press('ControlOrMeta+Shift+z');
  await expect(field).toHaveText('An observation worth keeping');
  await expect.poll(() => phraseStyle(field)).toMatchObject({ bold: true });
  await page.reload();
  await ready(page);
  await expect.poll(() => phraseStyle(field)).toMatchObject({ bold: true });
});

test('legacy plain notes retain literal markup and line breaks when another field upgrades the saved lesson', async ({ page }) => {
  const legacy = 'Literal <strong>markup</strong> stays text.\nSecond line & more.';
  await page.goto(lesson.notes_url);
  await ready(page);
  await page.evaluate(({ key, id, text }) => localStorage.setItem(key, JSON.stringify({ version: 1, entries: { [id]: text } })), {
    key: storageKey, id: entryKey, text: legacy,
  });
  await page.reload();
  await ready(page);
  await expect(firstNote(page)).toHaveText(legacy);
  await expect(firstNote(page).locator('strong, b')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Your notes', exact: true }).nth(1).fill('A new note');
  await page.reload();
  await ready(page);
  expect(await firstNote(page).innerText()).toBe(legacy);
  await expect(firstNote(page).locator('strong, b')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Your notes', exact: true }).nth(1)).toHaveText('A new note');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).version, storageKey)).toBe(2);
});

const unsafeHtml = '<strong>Safe pasted note</strong><img src="/note-attack" onerror="window.noteAttack=true">'
  + '<script>window.noteAttack=true</script><a href="javascript:window.noteAttack=true">kept words</a>'
  + '<span style="color:white;background:white;font-size:1px" onclick="window.noteAttack=true">visible words</span>';

for (const source of ['paste', 'saved storage']) {
  test(`rich text from ${source} keeps formatting and removes active markup`, async ({ page }) => {
    const unsafeRequests = [];
    page.on('request', request => { if (request.url().includes('/note-attack')) unsafeRequests.push(request.url()); });
    await page.goto(lesson.notes_url);
    await ready(page);
    if (source === 'paste') {
      await pasteHtml(firstNote(page), unsafeHtml);
    } else {
      await page.evaluate(({ key, id, html }) => localStorage.setItem(key, JSON.stringify({ version: 2, entries: { [id]: { html } } })), {
        key: storageKey, id: entryKey, html: unsafeHtml,
      });
      await page.reload();
      await ready(page);
    }
    const field = firstNote(page);
    await expect(field).toContainText('Safe pasted note');
    await expect(field).toContainText('kept words');
    await expect(field).toContainText('visible words');
    await expect.poll(() => phraseStyle(field)).toMatchObject({ bold: true });
    await expect(field.locator('script, img, a, [style], [onclick], [onerror]')).toHaveCount(0);
    expect(await page.evaluate(() => window.noteAttack)).toBeUndefined();
    expect(unsafeRequests).toEqual([]);
    await page.emulateMedia({ media: 'print' });
    const written = page.locator('[data-notes-written]').first();
    await expect(written).toContainText('Safe pasted note');
    await expect(written.locator('script, img, a, [style], [onclick], [onerror]')).toHaveCount(0);
  });
}

test('formatted student writing remains styled and semantically listed in exported PDF notes', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.goto(lesson.notes_url);
  await ready(page);
  const pdfOptions = { format: 'Letter', printBackground: true, preferCSSPageSize: true, tagged: true };
  const countListItems = async bytes => {
    const pdf = await PDFDocument.load(bytes);
    return pdf.context.enumerateIndirectObjects().filter(([, object]) =>
      object instanceof PDFDict && object.get(PDFName.of('S'))?.toString() === '/LI').length;
  };
  const baselineListItems = await countListItems(await page.pdf(pdfOptions));
  const field = firstNote(page);
  await field.pressSequentially('My first subscriber observation');
  await field.press('Enter');
  await field.pressSequentially('My second subscriber observation');
  await selectNote(field);
  await field.press('ControlOrMeta+b');
  await field.press('ControlOrMeta+i');
  await field.press('ControlOrMeta+u');
  await field.press('ControlOrMeta+Shift+8');
  await page.emulateMedia({ media: 'print' });
  const content = page.locator('[data-notes-written] [data-notes-content]').first();
  await expect(content).toBeVisible();
  await expect(content.getByRole('listitem')).toHaveText(['My first subscriber observation', 'My second subscriber observation']);
  await expect.poll(() => phraseStyle(content)).toEqual({ bold: true, italic: true, underlined: true });
  const pdfPath = testInfo.outputPath('formatted-student-notes.pdf');
  const pdf = await page.pdf({ ...pdfOptions, path: pdfPath });
  expect(await countListItems(pdf), 'student list items remain semantic PDF list items').toBe(baselineListItems + 2);
  await testInfo.attach('formatted-student-notes.pdf', { path: pdfPath, contentType: 'application/pdf' });
});
