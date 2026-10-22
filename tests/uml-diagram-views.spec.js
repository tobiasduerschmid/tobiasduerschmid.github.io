// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { waitForTutorialReady, setEditorContent } = require('./tutorial-helpers');
const { selectAllInMonaco } = require('./helpers/monaco-keyboard');

const chapter = '/SEBook/uml_class_diagram.html';
const visibilityLab = page => page.getByRole('region', { name: 'UML code lab: Member visibility', exact: true });
const viewButton = (scope, name) => scope.getByRole('button', { name, exact: true });

async function replaceChapterCode(lab, language, source) {
  const editor = lab.locator('[data-uml-editor]').getByRole('textbox', { name: `${language} code` });
  await editor.focus();
  await selectAllInMonaco(editor);
  // Monaco's public paste action preserves source spelling and indentation.
  await editor.evaluate((element, text) => {
    const instance = window.monaco.editor.getEditors().find(candidate => candidate.getDomNode().contains(element));
    instance.trigger('keyboard', 'paste', { text });
  }, source);
}

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
  test.setTimeout(60_000);
  await page.goto('/SEBook/uml_sequence_diagram.html');
  const lab = page.getByRole('region', { name: 'UML code lab: The loop boundary matters', exact: true });
  const diagram = lab.getByRole('img');
  const source = lab.locator('[data-uml-source]');
  for (const language of ['Python', 'Java', 'C++', 'TypeScript']) {
    await lab.getByRole('tab', { name: language, exact: true }).click();
    if (language === 'Python') {
      const singleQuoted = (await source.inputValue()).replace('["book", "pen"]', "['book', 'pen']");
      await replaceChapterCode(lab, language, singleQuoted);
      await expect(diagram).toContainText("for item in ['book', 'pen']", { timeout: 15_000 });
    } else if (language === 'C++') {
      await expect(diagram).toContainText(/for\s*\(const std::string\s*&\s*item\s*:\s*items\)/);
    } else {
      await expect(diagram).toContainText(language === 'Java' ? 'for (String item' : 'for item of');
    }
    const originalDiagram = await diagram.textContent();
    const originalSource = await source.inputValue();

    await viewButton(lab, 'Design focus').click();
    await expect(diagram).toContainText('for each item in ["book", "pen"]');
    await expect(diagram).toHaveAccessibleName(/Main calls receipt with "add_?[Ii]tem\(item\)".*Main calls receipt with "finish\(\)"/);
    await expect(source).toHaveValue(originalSource);

    await viewButton(lab, 'Implementation details').click();
    await expect(diagram).toHaveText(originalDiagram);
    await expect(source).toHaveValue(originalSource);
  }
});

test('known local sequences fold in all four languages while switching views preserves code', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/SEBook/uml_sequence_diagram.html');
  const lab = page.getByRole('region', { name: 'UML code lab: The loop boundary matters', exact: true });
  const diagram = lab.getByRole('img');
  const examples = [
    ['Python', `class Sink:
    def consume(self, value: int) -> None:
        pass
sink = Sink()
first = 3 - 2
items = [first, first + 1]
for item in items:
    sink.consume(item)
`],
    ['Java', `class Sink { void consume(int value) {} }
class Main { public static void main(String[] args) {
    Sink sink = new Sink();
    int first = 3 - 2;
    int[] items = {first, first + 1};
    for (int item : items) { sink.consume(item); }
} }`],
    ['C++', `#include <vector>
class Sink { public: void consume(int value) {} };
int main() {
    Sink sink;
    int first = 3 - 2;
    std::vector<int> items = {first, first + 1};
    for (int item : items) { sink.consume(item); }
}`],
    ['TypeScript', `class Sink { consume(value: number): void {} }
const sink = new Sink();
const first = 3 - 2;
const items = [first, first + 1];
for (const item of items) { sink.consume(item); }`]
  ];
  const timings = [];
  for (const [language, template] of examples) {
    const method = 'consume' + language.replace(/\W/g, '');
    const code = template.replaceAll('consume', method);
    await lab.getByRole('tab', { name: language, exact: true }).click();
    const editStart = performance.now();
    await replaceChapterCode(lab, language, code);
    await expect(diagram).toHaveAccessibleName(new RegExp(method + '\\(item\\)'), { timeout: 15_000 });
    const analyzedAfterMs = Math.round(performance.now() - editStart);
    const implementation = await diagram.textContent();
    const viewStart = performance.now();
    await viewButton(lab, 'Design focus').click();
    await expect(diagram).toContainText('for each item in [1, 2]');
    const designAfterMs = Math.round(performance.now() - viewStart);
    await expect(lab.locator('[data-uml-source]')).toHaveValue(code);
    await viewButton(lab, 'Implementation details').click();
    await expect(diagram).toHaveText(implementation);
    timings.push({ language, analyzedAfterMs, designAfterMs });
  }
  // Timing evidence is recorded, not compared to a flaky machine-speed oracle.
  await test.info().attach('uml-live-latency.json', { body: JSON.stringify(timings, null, 2), contentType: 'application/json' });
});

test('tutorial, fullscreen, and detached diagrams share the selected view', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/SEBook/tools/uml-class-diagram-python.html');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });
  expect(await setEditorContent(page, 'class Sensor:\n    def __init__(self, value: int) -> None:\n        self.value: int = value\n    def read(self) -> int:\n        return self.value\nsensor = Sensor(25)\nreading = sensor.read()\nprint(reading)')).toBe(true);
  const viewer = page.getByRole('region', { name: /Interactive UML diagram viewer/ });
  await expect(viewButton(page, 'Implementation details')).toHaveAttribute('aria-pressed', 'true');
  await expect(viewer.getByRole('img')).toContainText('value: int');
  await expect(page.getByText(/Design focus uses UML types and SEBook pseudocode/)).toHaveCount(0);
  await expect(page.getByText('Which diagram view should I use?', { exact: true })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Fit diagram to screen', exact: true })).toHaveCount(0);
  await viewButton(page, 'Design focus').click();
  await expect(viewer.getByRole('img')).toContainText('value: Integer');
  await viewButton(page, 'Implementation details').click();

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
  await expect(popup.getByText(/Design focus uses UML types and SEBook pseudocode/)).toHaveCount(0);
  await expect(popup.getByRole('button', { name: 'Fit diagram to screen', exact: true })).toHaveCount(0);
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
