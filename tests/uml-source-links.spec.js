// @ts-check
const { test, expect: baseExpect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');

// Inferred class and sequence diagrams link back to their code: clicking an
// element marks the lines it came from in the editor showing that file, and
// the "Code locations" list offers the same links to keyboard users.

const expect = baseExpect.configure({ timeout: 20_000 });

const classChapter = '/SEBook/uml_class_diagram.html';
const sequenceChapter = '/SEBook/uml_sequence_diagram.html';
const labByTitle = (page, title) => page.getByRole('region', { name: `UML code lab: ${title}`, exact: true });

/** The lines marked in the Monaco editor inside root, as [start, end] pairs. */
async function markedLines(root) {
  return root.evaluate(element => {
    const editor = window.monaco.editor.getEditors().find(candidate => element.contains(candidate.getDomNode()));
    if (!editor) return null;
    return editor.getModel().getAllDecorations()
      .filter(decoration => decoration.options.className === 'uml-source-highlight-line')
      .map(decoration => [decoration.range.startLineNumber, decoration.range.endLineNumber]);
  });
}

/** A drawn diagram text, by its exact visible content. */
function diagramText(root, text) {
  return root.locator('svg text').filter({ hasText: new RegExp('^' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') });
}

/** Opens the "Code locations" list with the keyboard and activates the named link. */
async function activateLocation(page, scope, name) {
  const summary = scope.locator('summary', { hasText: /^Code locations \(\d+\)$/ });
  await summary.focus();
  if (!(await summary.evaluate(element => element.parentElement.open))) await page.keyboard.press('Enter');
  const link = scope.getByRole('button', { name });
  await link.focus();
  await page.keyboard.press('Enter');
}

test.describe('UML code labs', () => {
  test('a class lab marks a class, a member and a relationship in the editor', async ({ page }) => {
    await page.goto(classChapter);
    const lab = labByTitle(page, 'Member visibility');
    const preview = lab.locator('[data-uml-preview]');
    await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);

    await diagramText(preview, '+display_name(): str').click();
    await expect.poll(() => markedLines(lab)).toEqual([[5, 6]]);

    await diagramText(preview, 'Student').click();
    await expect.poll(() => markedLines(lab)).toEqual([[1, 6]]);

    // Generalizations drawn as one merged tree are reached from the list.
    const inheritance = labByTitle(page, 'Inheritance through a parent');
    await expect(inheritance.getByRole('img')).toHaveAccessibleName(/extends/);
    await activateLocation(page, inheritance, 'Dog inherits from Animal — example.py, line 5');
    await expect.poll(() => markedLines(inheritance)).toEqual([[5, 5]]);
  });

  test('the keyboard list marks the same lines and announces them', async ({ page }) => {
    await page.goto(classChapter);
    const lab = labByTitle(page, 'Member visibility');
    await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);
    await activateLocation(page, lab, 'Class Student — example.py, lines 1–6');
    await expect.poll(() => markedLines(lab)).toEqual([[1, 6]]);
    await expect(page.getByRole('status').filter({ hasText: /^Highlighted / })).toHaveText('Highlighted example.py, lines 1–6: Class Student.');
    // Focus stays on the list; the learner moves to the code when ready.
    await expect(lab.getByRole('button', { name: 'Class Student — example.py, lines 1–6' })).toBeFocused();
    await auditInteractiveState(page, 'UML code lab with code locations open and code marked', { include: '.uml-code-lab' });
  });

  test('editing the code clears the mark', async ({ page }) => {
    await page.goto(classChapter);
    const lab = labByTitle(page, 'Member visibility');
    const preview = lab.locator('[data-uml-preview]');
    await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);
    await diagramText(preview, 'Student').click();
    await expect.poll(() => markedLines(lab)).toEqual([[1, 6]]);
    const editor = lab.locator('[data-uml-editor]').getByRole('textbox', { name: /code/ });
    await editor.focus();
    await page.keyboard.press('End');
    await page.keyboard.type(' ');
    await expect.poll(() => markedLines(lab)).toEqual([]);
  });

  test('a Java class lab marks the member in Example.java', async ({ page }) => {
    await page.goto(classChapter);
    const lab = labByTitle(page, 'Member visibility');
    await lab.getByRole('tab', { name: 'Java', exact: true }).click();
    const preview = lab.locator('[data-uml-preview]');
    await expect(diagramText(preview, '+displayName(): String')).toBeVisible();
    await diagramText(preview, '+displayName(): String').click();
    await expect.poll(() => markedLines(lab)).toEqual([[8, 10]]);
  });

  test('a sequence lab marks the call of a message and the class of a lifeline', async ({ page }) => {
    await page.goto(sequenceChapter);
    const lab = labByTitle(page, 'Calls determine message order');
    const preview = lab.locator('[data-uml-preview]');
    await expect(lab.getByRole('img')).toHaveAccessibleName(/authorize/);

    await diagramText(preview, 'authorize()').click();
    await expect.poll(() => markedLines(lab)).toEqual([[12, 12]]);
    await diagramText(preview, 'capture()').click();
    await expect.poll(() => markedLines(lab)).toEqual([[6, 6]]);
    await diagramText(preview, 'payment: Payment').click();
    await expect.poll(() => markedLines(lab)).toEqual([[1, 9]]);

    await activateLocation(page, lab, 'Call Main to payment: refund() — example.py, line 13');
    await expect.poll(() => markedLines(lab)).toEqual([[13, 13]]);
  });

  test('on a narrow screen a click scrolls the marked code into view', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 500 });
    await page.goto(classChapter);
    const lab = labByTitle(page, 'Member visibility');
    const preview = lab.locator('[data-uml-preview]');
    await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);
    const member = diagramText(preview, '+display_name(): str');
    await member.scrollIntoViewIfNeeded();
    const code = lab.locator('[data-uml-editor]').getByText('display_name', { exact: true });
    await expect(code).not.toBeInViewport();
    await member.click();
    await expect(code).toBeInViewport();
    await expect.poll(() => markedLines(lab)).toEqual([[5, 6]]);
  });

  test('without known source lines a diagram shows no link affordance and no list', async ({ page }) => {
    // C++ inference does not yet report source lines.
    await page.goto(classChapter);
    const lab = labByTitle(page, 'Member visibility');
    await lab.getByRole('tab', { name: 'C++', exact: true }).click();
    const preview = lab.locator('[data-uml-preview]');
    const name = diagramText(preview, 'Student');
    await expect(name).toBeVisible();
    await expect(name).not.toHaveCSS('cursor', 'pointer');
    await name.hover();
    await expect(preview.locator('.uml-source-link-outline')).toHaveCount(0);
    await name.click();
    await expect.poll(() => markedLines(lab)).toEqual([]);
    await expect(lab.getByText(/^Code locations/)).toBeHidden();
  });

  test('linked elements show a pointer and an outline under the pointer', async ({ page }) => {
    await page.goto(classChapter);
    const lab = labByTitle(page, 'Member visibility');
    const preview = lab.locator('[data-uml-preview]');
    await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);
    const member = diagramText(preview, '+display_name(): str');
    await expect(member).toHaveCSS('cursor', 'pointer');
    await member.hover();
    await expect(preview.locator('.uml-source-link-outline')).toHaveCount(1);
    await page.mouse.move(0, 0);
    await expect(preview.locator('.uml-source-link-outline')).toHaveCount(0);
  });
});

test.describe('tutorial live UML pane', () => {
  test.setTimeout(180_000);
  const url = '/SEBook/tools/uml-demo.html';

  async function openStep(page, index) {
    await page.goto(url);
    await page.evaluate(() => localStorage.clear());
    await page.goto(url);
    // This demo opens on its UML tab, so the step list is not visible.
    await page.waitForFunction(() => window._tutorial && window._tutorial.editor, null, { timeout: 90_000 });
    await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: 90_000 });
    await page.evaluate(step => { window._tutorial._stepsUnlocked.add(step); return window._tutorial.loadStep(step); }, index);
    const viewer = page.getByRole('region', { name: /Interactive UML diagram viewer/ });
    await expect(viewer.getByRole('img')).toHaveAccessibleName(/Zoo/, { timeout: 30_000 });
    return viewer;
  }

  const activeTab = page => page.locator('.tvm-tab-label[aria-current="true"]');
  const workspace = page => page.locator('.tvm-workspace');

  test('clicking a class opens its file and marks its definition', async ({ page }) => {
    const viewer = await openStep(page, 1);
    await diagramText(viewer, 'Dog').click();
    await expect(activeTab(page)).toHaveText(/animals\.py/);
    await expect.poll(() => markedLines(workspace(page))).toEqual([[8, 17]]);

    await diagramText(viewer, '+roll_call(): None').click();
    await expect(activeTab(page)).toHaveText(/zoo\.py/);
    await expect.poll(() => markedLines(workspace(page))).toEqual([[11, 13]]);
  });

  test('a message marks its call; the keyboard list does the same', async ({ page }) => {
    const viewer = await openStep(page, 1);
    await page.getByRole('button', { name: 'Sequence Diagram' }).first().click();
    await expect(viewer.getByRole('img')).toHaveAccessibleName(/roll_call/, { timeout: 30_000 });
    await diagramText(viewer, 'roll_call()').click();
    await expect(activeTab(page)).toHaveText(/zoo\.py/);
    await expect.poll(() => markedLines(workspace(page))).toEqual([[19, 19]]);

    const pane = viewer.locator('..');
    await activateLocation(page, pane, 'Call Dog to Animal: __init__(name) — animals.py, line 10');
    await expect(activeTab(page)).toHaveText(/animals\.py/);
    await expect.poll(() => markedLines(workspace(page))).toEqual([[10, 10]]);
    await auditInteractiveState(page, 'tutorial UML pane with code locations open', { include: '.uml-source-links' });
  });
  test('the fullscreen viewer closes and marks the clicked class', async ({ page }) => {
    const viewer = await openStep(page, 1);
    await viewer.locator('..').getByRole('button', { name: 'Fullscreen' }).click();
    const overlay = page.locator('.tvm-diagram-fullscreen-overlay');
    await expect(overlay).toBeVisible();
    await diagramText(overlay, 'Zoo').click();
    await expect(overlay).toBeHidden();
    await expect(activeTab(page)).toHaveText(/zoo\.py/);
    await expect.poll(() => markedLines(workspace(page))).toEqual([[3, 13]]);
  });

  test('a click in the popout window marks the code in the tutorial window', async ({ page, context }) => {
    const viewer = await openStep(page, 1);
    const [popout] = await Promise.all([
      context.waitForEvent('page'),
      viewer.locator('..').getByRole('button', { name: 'Open in separate window' }).click()
    ]);
    const content = popout.locator('#diagramContent');
    await expect(diagramText(content, 'Cat')).toBeVisible();
    await diagramText(content, 'Cat').click();
    await expect(activeTab(page)).toHaveText(/animals\.py/);
    await expect.poll(() => markedLines(workspace(page))).toEqual([[19, 25]]);
  });
});
