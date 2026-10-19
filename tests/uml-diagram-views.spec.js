// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { waitForTutorialReady, setEditorContent } = require('./tutorial-helpers');

const chapter = '/SEBook/uml_class_diagram.html';
const visibilityLab = page => page.getByRole('region', { name: 'UML code lab: Member visibility', exact: true });
const viewButton = (scope, name) => scope.getByRole('button', { name, exact: true });

test('chapter views abstract the same code and restore its implementation details', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(chapter);
  const lab = visibilityLab(page);
  const diagram = lab.getByRole('img');
  const implementation = viewButton(lab, 'Implementation details');
  const design = viewButton(lab, 'Design focus');
  await expect(implementation).toHaveAttribute('aria-pressed', 'true');
  await expect(diagram).toContainText('_name: str');
  await expect(diagram).toContainText('__init__');
  // The fallback textarea is also the chapter editor's source contract.
  const source = lab.locator('[data-uml-source]');
  const originalSource = await source.inputValue();
  const originalDiagram = await diagram.textContent();
  await expect(design).toHaveAttribute('title', /Design focus uses UML types/);
  await expect(design).toHaveAccessibleDescription(/Implementation details keeps source notation/);
  await expect(page.getByText(/Design focus uses UML types and SEBook pseudocode/)).toBeVisible();

  await design.focus();
  await design.press('Space');
  await expect(design).toBeFocused();
  await expect(design).toHaveAttribute('aria-pressed', 'true');
  await expect(implementation).toHaveAttribute('aria-pressed', 'false');
  await expect(diagram).toContainText('name: String');
  await expect(diagram).toContainText('Student(name: String)');
  await expect(diagram).not.toContainText('#_name:');
  await expect(diagram).toContainText('display_name(): String');
  await expect(diagram).not.toContainText('__init__');
  await expect(source).toHaveValue(originalSource);
  await a11yCheckpoint(page, 'UML design view', { include: '.uml-code-lab' });

  await implementation.click();
  await expect(diagram).toHaveText(originalDiagram);
  await expect(source).toHaveValue(originalSource);
  expect(errors).toEqual([]);
});

test('view controls remain readable in light, dark, narrow, and print layouts', async ({ page }) => {
  await page.goto(chapter);
  const lab = visibilityLab(page);
  const design = viewButton(lab, 'Design focus');
  await design.click();
  await expect(lab.getByRole('img')).toContainText('name: String');
  await a11yCheckpoint(page, 'UML view controls light', { include: '.uml-code-lab' });
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await design.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(design).toBeFocused();
  await expect(design).toHaveCSS('outline-style', 'solid');
  await a11yCheckpoint(page, 'UML view controls dark', { include: '.uml-code-lab' });

  await page.setViewportSize({ width: 320, height: 650 });
  await expect(design).toBeVisible();
  await expect(viewButton(lab, 'Implementation details')).toBeVisible();
  await expect.poll(() => design.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const paragraphSize = parseFloat(getComputedStyle(element.closest('[data-uml-code-lab]').querySelector('p')).fontSize);
    return rect.left >= 0 && rect.right <= innerWidth && rect.height >= 24
      && parseFloat(getComputedStyle(element).fontSize) >= paragraphSize;
  })).toBe(true);

  await page.emulateMedia({ media: 'print' });
  await expect(design).toBeVisible();
  await expect(design).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(viewButton(lab, 'Implementation details')).toBeHidden();
  await expect(lab.getByRole('img')).toContainText('name: String');
});

test('sequence views abstract a loop without changing its source or calls', async ({ page }) => {
  await page.goto('/SEBook/uml_sequence_diagram.html');
  const lab = page.getByRole('region', { name: 'UML code lab: The loop boundary matters', exact: true });
  await lab.getByRole('tab', { name: 'Java', exact: true }).click();
  const diagram = lab.getByRole('img');
  await expect(diagram).toContainText('for (String item');
  const originalDiagram = await diagram.textContent();
  const source = lab.locator('[data-uml-source]');
  const originalSource = await source.inputValue();

  await viewButton(lab, 'Design focus').click();
  await expect(diagram).toContainText('for each item in ["book", "pen"]');
  await expect(diagram).toHaveAccessibleName(/Main calls receipt with "addItem\(item\)".*Main calls receipt with "finish\(\)"/);
  await expect(source).toHaveValue(originalSource);

  await viewButton(lab, 'Implementation details').click();
  await expect(diagram).toHaveText(originalDiagram);
});

test('tutorial, fullscreen, and detached diagrams share the selected view', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/SEBook/tools/uml-class-diagram-python.html');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });
  expect(await setEditorContent(page, 'class Sensor:\n    def __init__(self, value: int) -> None:\n        self.value: int = value\n    def read(self) -> int:\n        return self.value\nsensor = Sensor(25)\nreading = sensor.read()\nprint(reading)')).toBe(true);
  const viewer = page.getByRole('region', { name: /Interactive UML diagram viewer/ });
  await expect(viewButton(page, 'Design focus')).toHaveAttribute('aria-pressed', 'true');
  await expect(viewer.getByRole('img')).toContainText('value: Integer');
  await viewButton(page, 'Implementation details').click();
  await expect(viewer.getByRole('img')).toContainText('value: int');

  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  const fullscreen = page.getByRole('dialog', { name: 'Fullscreen UML diagram' });
  await expect(viewButton(fullscreen, 'Implementation details')).toHaveAttribute('aria-pressed', 'true');
  await viewButton(fullscreen, 'Design focus').click();
  await expect(fullscreen.getByRole('img')).toContainText('value: Integer');
  const firstControl = fullscreen.getByRole('button', { name: 'Class Diagram', exact: true });
  await firstControl.focus();
  await firstControl.press('Shift+Tab');
  await expect.poll(() => fullscreen.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(fullscreen).toBeHidden();
  await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toBeFocused();
  await expect(viewButton(page, 'Design focus')).toHaveAttribute('aria-pressed', 'true');

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open in separate window', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup.getByRole('img')).toContainText('value: Integer');
  await expect(viewButton(popup, 'Design focus')).toHaveAccessibleDescription(/Neither view verifies the design/);
  await viewButton(popup, 'Implementation details').click();
  await expect(popup.getByRole('img')).toContainText('value: int');
  await expect(viewer.getByRole('img')).toContainText('value: int');
  await expect(viewButton(page, 'Implementation details')).toHaveAttribute('aria-pressed', 'true');
  await popup.getByRole('button', { name: 'Sequence Diagram', exact: true }).click();
  await expect(popup.getByRole('img')).toHaveAccessibleName(/sensor replies to Main with "reading: int"/);
  await viewButton(popup, 'Design focus').click();
  await expect(popup.getByRole('img')).toHaveAccessibleName(/sensor replies to Main with "reading: Integer"/);
  await a11yCheckpoint(popup, 'Detached UML design view');
  await popup.close();
  expect(errors).toEqual([]);
});

test('standalone inference examples switch source details without changing source', async ({ page }) => {
  await page.goto('/test-uml-js.html');
  // The first example is the page's explicitly numbered TypeScript class case.
  const syntax = page.getByRole('region', { name: 'Class Diagram Syntax', exact: true }).first();
  const source = page.getByRole('textbox', { name: 'TypeScript Source', exact: true }).first();
  const originalSource = await source.inputValue();
  await expect(syntax).toContainText('radius: Real');
  await expect(viewButton(page, 'Design focus')).toHaveAttribute('aria-pressed', 'true');
  await viewButton(page, 'Implementation details').click();
  await expect(syntax).toContainText('radius: number');
  await expect(syntax).toContainText('constructor(radius: number)');
  await viewButton(page, 'Design focus').click();
  await expect(syntax).toContainText('radius: Real');
  await expect(syntax).toContainText('Circle(radius: Real)');
  await expect(source).toHaveValue(originalSource);
});
