// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { waitForTutorialReady, setEditorContent } = require('./tutorial-helpers');
const { selectAllInMonaco } = require('./helpers/monaco-keyboard');

const classChapter = '/SEBook/uml_class_diagram.html';
const sequenceChapter = '/SEBook/uml_sequence_diagram.html';
const labByTitle = (page, title) => page.getByRole('region', { name: `UML code lab: ${title}`, exact: true });

async function replaceCode(editor, value) {
  await editor.focus();
  await selectAllInMonaco(editor);
  if (!value) return editor.press('Backspace');
  // Monaco's typing command auto-indents each newline. Whole-source changes
  // represent a paste, which preserves the supplied Python indentation.
  await editor.evaluate((element, text) => {
    const instance = window.monaco.editor.getEditors().find(candidate => candidate.getDomNode().contains(element));
    instance.trigger('keyboard', 'paste', { text });
  }, value);
}

const sourceText = lab => lab.locator('[data-uml-source]').inputValue();

function editorFor(lab) {
  return lab.locator('[data-uml-editor]').getByRole('textbox', { name: /code/ });
}

for (const dark of [false, true]) {
  test(`Python is the default and both languages highlight edited syntax (${dark ? 'dark' : 'light'})`, async ({ page }) => {
    await page.goto(classChapter);
    await page.evaluate(enabled => document.documentElement.classList.toggle('dark-mode', enabled), dark);
    const lab = labByTitle(page, 'Member visibility');
    await expect(lab.getByRole('combobox')).toHaveValue('python');
    await expect(editorFor(lab)).toHaveAccessibleName(/Python code/);
    await expect.poll(() => lab.locator('.monaco-editor-background').evaluateAll(elements =>
      [...new Set(elements.map(element => getComputedStyle(element).backgroundColor))]
    )).toEqual([dark ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)']);
    for (const language of ['python', 'java']) {
      await lab.getByRole('combobox').selectOption(language);
      await replaceCode(editorFor(lab), language === 'python'
        ? 'class Marker:\n    # class in comment\n    text = "class in string"\n    doc = """first line\nclass in multiline string\n"""\n    value = 42'
        : 'class Marker {\n    /* class in comment\nclass on second comment line */\n    String text = "class in string";\n    int value = 42;\n}');
      const lines = lab.locator('.view-lines');
      const keyword = lines.getByText('class', { exact: true });
      const comment = lines.getByText(/class\s+in\s+comment/);
      const string = lines.getByText(/class\s+in\s+string/);
      await expect(keyword).toBeVisible();
      await expect(comment).toBeVisible();
      await expect(string).toBeVisible();
      const color = locator => locator.evaluate(element => getComputedStyle(element).color);
      await expect.poll(async () => new Set(await Promise.all([color(keyword), color(comment), color(string)])).size).toBe(3);
      const continuation = lines.getByText(language === 'python' ? /class\s+in\s+multiline\s+string/ : /class\s+on\s+second\s+comment\s+line/);
      await expect(continuation).toBeVisible();
      await expect.poll(() => color(continuation)).toBe(await color(language === 'python' ? string : comment));
    }
  });
}

for (const language of ['java', 'python']) {
  test(`${language}: editing visibility updates the field without changing the operation`, async ({ page }) => {
    await page.goto(classChapter);
    const lab = labByTitle(page, 'Member visibility');
    await lab.getByRole('combobox', { name: 'Code language' }).selectOption(language);
    const editor = editorFor(lab);
    await expect(lab.getByRole('img')).toContainText(language === 'java' ? '-name' : '#_name');
    const original = await sourceText(lab);
    await replaceCode(editor, language === 'java'
      ? original.replace('private String name', 'public String name')
      : original.replaceAll('self._name', 'self.name'));
    await expect(lab.getByRole('img')).toContainText('+name');
    await expect(lab.getByRole('img')).toContainText(language === 'java' ? '+displayName()' : '+display_name()');
    await expect(editor).toBeFocused();
  });

  test(`${language}: removing a stored reference leaves a parameter dependency`, async ({ page }) => {
    await page.goto(classChapter);
    const lab = labByTitle(page, 'Keeping a reference');
    await lab.getByRole('combobox').selectOption(language);
    await expect(lab.getByRole('img')).toHaveAccessibleName(/Student references Roster/);
    const editor = editorFor(lab);
    const original = await sourceText(lab);
    await replaceCode(editor, language === 'java'
      ? original.replace('private Roster roster;', '').replace('this.roster = roster;', '')
      : original.replace('self.roster = roster', 'pass'));
    await expect(lab.getByRole('img')).toHaveAccessibleName(/Student depends on Roster/);
    await expect(lab.getByRole('img')).not.toHaveAccessibleName(/references/);
  });

  test(`${language}: inheritance and collection labs change the intended relationships`, async ({ page }) => {
    await page.goto(classChapter);
    const inheritance = labByTitle(page, 'Adding a subclass');
    await inheritance.getByRole('combobox').selectOption(language);
    await expect(inheritance.getByRole('img')).toHaveAccessibleName(/Dog extends Animal/);
    await expect(inheritance.getByRole('img')).not.toHaveAccessibleName(/Cat extends Animal/);
    const subclasses = await sourceText(inheritance);
    await replaceCode(editorFor(inheritance), language === 'java'
      ? subclasses.replace('class Cat {', 'class Cat extends Animal {')
      : subclasses.replace('class Cat:', 'class Cat(Animal):'));
    await expect(inheritance.getByRole('img')).toHaveAccessibleName(/Cat extends Animal/);
    await expect(inheritance.getByRole('img')).toHaveAccessibleName(/Dog extends Animal/);

    const collection = labByTitle(page, 'One reference or a collection');
    await collection.getByRole('combobox').selectOption(language);
    await expect(collection.getByRole('img')).toHaveAccessibleName(/Team.*Member with multiplicity one to one/);
    const single = await sourceText(collection);
    await replaceCode(editorFor(collection), language === 'java'
      ? single.replaceAll('Member members', 'List<Member> members')
      : single.replaceAll('members: Member', 'members: list[Member]'));
    await expect(collection.getByRole('img')).toHaveAccessibleName(/Team.*Member with multiplicity one to many/);
    await expect(collection.getByRole('img')).not.toHaveAccessibleName(/multiplicity one to one/);
  });

  test(`${language}: self-call and reply labs preserve the receiver and call direction`, async ({ page }) => {
    await page.goto(sequenceChapter);
    const selfCalls = labByTitle(page, 'Calling another method');
    await selfCalls.getByRole('combobox').selectOption(language);
    await expect(selfCalls.getByRole('img')).toHaveAccessibleName(/2 participants.*Main creates checkout/);
    await expect(selfCalls.getByRole('img')).toHaveAccessibleName(/checkout calls checkout with "validate\(\)"/);
    await expect(selfCalls.getByRole('img')).not.toHaveAccessibleName(/save\(\)/);
    const calls = await sourceText(selfCalls);
    await replaceCode(editorFor(selfCalls), language === 'java'
      ? calls.replace('this.validate();', 'this.validate();\n        this.save();')
      : calls.replace('self.validate()', 'self.validate()\n        self.save()'));
    await expect(selfCalls.getByRole('img')).toHaveAccessibleName(/checkout calls checkout with "validate\(\)".*checkout calls checkout with "save\(\)"/);

    const replies = labByTitle(page, 'Calls and replies');
    await replies.getByRole('combobox').selectOption(language);
    await expect(replies.getByRole('img')).toHaveAccessibleName(/2 participants.*Main creates sensor/);
    await expect(replies.getByRole('img')).toHaveAccessibleName(/sensor replies to Main with "int"/);
    const numeric = await sourceText(replies);
    await replaceCode(editorFor(replies), language === 'java'
      ? numeric.replace('int read()', 'String read()').replace('return 25;', 'return "warm";')
      : numeric.replace('-> int:', '-> str:').replace('return 25', 'return "warm"'));
    await expect(replies.getByRole('img')).toHaveAccessibleName(/Main calls sensor with "read\(\)"/);
    await expect(replies.getByRole('img')).toHaveAccessibleName(language === 'java'
      ? /sensor replies to Main with "String"/ : /sensor replies to Main with "str"/);
    await expect(replies.getByRole('img')).not.toHaveAccessibleName(/replies to Main with "int"/);
  });

  test(`${language}: edits change message order and branch and loop boundaries`, async ({ page }) => {
    await page.goto(sequenceChapter);
    const order = labByTitle(page, 'Calls determine message order');
    await order.getByRole('combobox').selectOption(language);
    await expect(order.getByRole('img')).toHaveAccessibleName(/authorize\(\).*capture\(\)/);
    const editor = editorFor(order);
    const original = await sourceText(order);
    await replaceCode(editor, original.replace('payment.authorize()', 'payment.TEMP()')
      .replace('payment.capture()', 'payment.authorize()').replace('payment.TEMP()', 'payment.capture()'));
    await expect(order.getByRole('img')).toHaveAccessibleName(/capture\(\).*authorize\(\)/);

    const alternatives = labByTitle(page, 'Alternatives are possible paths');
    await alternatives.getByRole('combobox').selectOption(language);
    await expect(alternatives.getByRole('img')).toHaveAccessibleName(/alt branch.*approve\(\).*decline\(\)/);
    const branchEditor = editorFor(alternatives);
    const branches = await sourceText(alternatives);
    await replaceCode(branchEditor, language === 'java'
      ? branches.replace(/ else \{\s*payment\.decline\(\);\s*\}/, '')
      : branches.replace(/\s*else:\n\s*payment\.decline\(\)/, ''));
    await expect(alternatives.getByRole('img')).toHaveAccessibleName(/optional fragment.*approve\(\)/);
    await expect(alternatives.getByRole('img')).not.toHaveAccessibleName(/decline\(\)/);

    const loop = labByTitle(page, 'The loop boundary matters');
    await loop.getByRole('combobox').selectOption(language);
    await expect(loop.getByRole('img')).toHaveAccessibleName(/outside combined fragments.*finish\(\)/);
    const loopEditor = editorFor(loop);
    const loopSource = await sourceText(loop);
    await replaceCode(loopEditor, language === 'java'
      ? loopSource.replace('            receipt.addItem(item);\n        }\n        receipt.finish();',
        '            receipt.addItem(item);\n            receipt.finish();\n        }')
      : loopSource.replace('\nreceipt.finish()', '\n    receipt.finish()'));
    await expect(loop.getByRole('img')).toHaveAccessibleName(/in loop.*(?:addItem|add_item)\(item\).*finish\(\)/);
    await expect(loop.getByRole('img')).not.toHaveAccessibleName(/outside combined fragments/);
    await expect(order.getByRole('img')).toHaveAccessibleName(/capture\(\).*authorize\(\)/);
  });
}

test('language drafts and widgets are independent; reset affects only the selected draft', async ({ page }) => {
  await page.goto(classChapter);
  const lab = labByTitle(page, 'Member visibility');
  const selector = lab.getByRole('combobox');
  await expect(selector.getByRole('option')).toHaveText(['Python', 'Java']);
  const editor = editorFor(lab);
  await expect(selector).toHaveValue('python');
  await selector.selectOption('java');
  await replaceCode(editor, 'class JavaDraft {}');
  await selector.selectOption('python');
  await replaceCode(editor, 'class PythonDraft:\n    pass');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/PythonDraft/);
  await selector.selectOption('java');
  await expect(lab.locator('[data-uml-source]')).toHaveValue('class JavaDraft {}');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/JavaDraft/);
  await expect(labByTitle(page, 'Keeping a reference').getByRole('img')).toHaveAccessibleName(/Student.*Roster|Roster.*Student/);
  await lab.getByRole('button', { name: 'Reset code' }).click();
  await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);
  await selector.selectOption('python');
  await expect(lab.locator('[data-uml-source]')).toHaveValue('class PythonDraft:\n    pass');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/PythonDraft/);
});

test('empty source clears the old answer and corrected code recovers, including without Workers', async ({ page }) => {
  await page.addInitScript(() => { window.Worker = undefined; });
  await page.goto(classChapter);
  const lab = labByTitle(page, 'Member visibility');
  const editor = editorFor(lab);
  await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);
  await replaceCode(editor, '');
  await expect(lab.getByRole('status')).toHaveText('No classes found.');
  await expect(lab.getByRole('img')).toHaveCount(0);
  await replaceCode(editor, 'class Recovered:\n    pass');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/Recovered/);
  await lab.getByRole('combobox').selectOption('java');
  await replaceCode(editor, 'class RecoveredJava {}');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/RecoveredJava/);
});

test('rapid edits display only the latest source and reset cancels pending changes', async ({ page }) => {
  const inFlight = page.waitForEvent('worker');
  await page.goto(classChapter);
  const lab = labByTitle(page, 'Member visibility');
  const editor = editorFor(lab);
  await inFlight;
  await replaceCode(editor, 'class FirstDraft:\n    pass');
  await replaceCode(editor, 'class FinalDraft:\n    pass');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/FinalDraft/);
  await expect(lab.getByRole('img')).not.toHaveAccessibleName(/FirstDraft/);
  await replaceCode(editor, 'class DiscardedDraft:\n    pass');
  await lab.getByRole('button', { name: 'Reset code' }).click();
  await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);
  await expect(lab.locator('[data-uml-source]')).not.toHaveValue(/DiscardedDraft/);
});

test('a spinner preserves the current diagram and its position until the replacement is ready', async ({ page }) => {
  // A fixed start and later pause avoid a race between the host and browser clocks.
  await page.clock.install({ time: new Date('2026-01-01T09:00:00Z') });
  await page.goto(classChapter);
  const lab = labByTitle(page, 'Member visibility');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);
  await expect(editorFor(lab)).toBeVisible();
  await lab.scrollIntoViewIfNeeded();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.pauseAt(new Date('2026-01-01T10:00:00Z'));
  await lab.evaluate(root => {
    const image = root.querySelector('[role="img"]');
    const originalSVG = image.querySelector('svg');
    const initial = image.getBoundingClientRect();
    window.umlPreviewChanges = [];
    window.umlPreviewObserver = new MutationObserver(() => {
      if (!image.querySelector('svg')) window.umlPreviewChanges.push('diagram cleared');
      if (originalSVG.isConnected) {
        const current = image.getBoundingClientRect();
        if (current.x !== initial.x || current.y !== initial.y) window.umlPreviewChanges.push('diagram moved');
      }
    });
    window.umlPreviewObserver.observe(root, { subtree: true, childList: true, attributes: true });
  });
  await replaceCode(editorFor(lab), 'class Replacement:\n    pass');
  // The spinner is decorative; the status still announces progress to AT.
  const spinner = lab.locator('.uml-code-lab-spinner');
  await expect(spinner).toBeVisible();
  await expect(spinner).toHaveCSS('animation-name', 'none');
  await expect(lab.getByRole('status')).toHaveText('Updating diagram…');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);
  await page.clock.resume();
  await expect(lab.getByRole('img')).toHaveAccessibleName(/Replacement/);
  await expect(spinner).toBeHidden();
  expect(await page.evaluate(() => {
    window.umlPreviewObserver.disconnect();
    return window.umlPreviewChanges;
  })).toEqual([]);
});

test('source editing and live diagrams survive an unavailable Monaco dependency', async ({ page }) => {
  await page.route('**/vendor/monaco-editor/**', route => route.abort());
  await page.goto(classChapter);
  const lab = labByTitle(page, 'Member visibility');
  await lab.getByRole('textbox', { name: 'Python code', exact: true }).fill('class FallbackDraft:\n    pass');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/FallbackDraft/);
});

for (const dark of [false, true]) {
  test(`controls and diagrams are readable and keyboard accessible at 320px (${dark ? 'dark' : 'light'})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(classChapter);
    await page.evaluate(enabled => document.documentElement.classList.toggle('dark-mode', enabled), dark);
    const lab = labByTitle(page, 'Member visibility');
    const editor = editorFor(lab);
    await expect(lab.getByRole('img')).toBeVisible();
    await editor.focus();
    await editor.press('Escape');
    await expect(editor).not.toBeFocused();
    const wideDiagram = labByTitle(page, 'Keeping a reference').getByRole('img');
    await wideDiagram.focus();
    await expect(wideDiagram).toBeFocused();
    await wideDiagram.press('ArrowRight');
    await expect.poll(() => wideDiagram.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    for (const control of [editor, lab.getByRole('combobox'), lab.getByRole('button', { name: 'Reset code' })]) {
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport();
      expect(await control.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    }
    const diagramTypeSize = await lab.getByRole('img').evaluate(element => {
      const paragraphSize = parseFloat(getComputedStyle(element.closest('.uml-code-lab').querySelector('p')).fontSize);
      const labels = [...element.querySelectorAll('svg text')].filter(label => label.textContent.trim());
      return Math.min(...labels.map(label => {
        const matrix = label.getScreenCTM();
        return parseFloat(getComputedStyle(label).fontSize) * Math.hypot(matrix.c, matrix.d);
      })) - paragraphSize;
    });
    expect(diagramTypeSize).toBeGreaterThanOrEqual(-0.1);
    expect(await lab.evaluate(element => element.getBoundingClientRect().right <= innerWidth + 1)).toBe(true);
    await lab.getByText('Check your prediction', { exact: true }).click();
    await a11yCheckpoint(page, 'UML chapter exercise with explanation', { include: '.uml-code-lab' });
  });
}

test('print shows the current source and matching diagram in light colors', async ({ page }) => {
  await page.goto(classChapter);
  const lab = labByTitle(page, 'Member visibility');
  await replaceCode(editorFor(lab), 'class PrintedDraft:\n    pass');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/PrintedDraft/);
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await page.emulateMedia({ media: 'print' });
  await expect(editorFor(lab)).toBeHidden();
  await expect(lab.getByRole('button', { name: 'Reset code' })).toBeHidden();
  await expect(lab.getByText('class PrintedDraft:\n    pass', { exact: true })).toBeVisible();
  await expect(lab.getByRole('img')).toBeVisible();
  await expect(lab.locator('svg')).toHaveCSS('filter', 'none');
  // Transparent print backgrounds inherit the paper color. Check the visible
  // foreground/background, without pinning the theme's exact shade of white.
  const colors = await lab.evaluate(element => {
    const channels = color => color.match(/[\d.]+/g).map(Number);
    let surface = element;
    while (getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)' && surface.parentElement) {
      surface = surface.parentElement;
    }
    return { text: channels(getComputedStyle(element).color), paper: channels(getComputedStyle(surface).backgroundColor) };
  });
  expect(Math.max(...colors.text.slice(0, 3))).toBeLessThan(80);
  expect(Math.min(...colors.paper.slice(0, 3))).toBeGreaterThan(240);
});

test('the chapter remains usable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(baseURL + classChapter);
    const lab = labByTitle(page, 'Member visibility');
    await expect(lab.getByRole('textbox')).toHaveCount(0);
    await expect(lab.getByText(/private String name/)).toBeVisible();
    await expect(lab.getByText(/self\._name = name/)).toBeVisible();
    await lab.getByText('Check your prediction', { exact: true }).click();
    await expect(lab.getByText(/The field becomes public/)).toBeVisible();
  } finally {
    await context.close();
  }
});

test('combined course chapters initialize their embedded code labs', async ({ page }) => {
  await page.goto('/SEBook/CS130.html');
  const lab = labByTitle(page, 'Member visibility');
  await replaceCode(editorFor(lab), 'class CombinedChapter:\n    pass');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/CombinedChapter/);
});

test('the UML tutorial still updates its diagram from editable source', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/tools/uml-class-diagram-python.html');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });
  expect(await setEditorContent(page, 'class TutorialDraft:\n    def greet(self):\n        pass\n')).toBe(true);
  const viewer = page.getByRole('region', { name: /Interactive UML diagram viewer/ });
  await expect(viewer.getByRole('img')).toHaveAccessibleName(/TutorialDraft/);
  await expect(viewer.getByRole('img')).toContainText('greet()');
});
