// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { waitForTutorialReady, setEditorContent } = require('./tutorial-helpers');
const { selectAllInMonaco } = require('./helpers/monaco-keyboard');

const classChapter = '/SEBook/uml_class_diagram.html';
const sequenceChapter = '/SEBook/uml_sequence_diagram.html';
const labByTitle = (page, title) => page.getByRole('region', { name: `UML code lab: ${title}`, exact: true });
const languageNames = { python: 'Python', java: 'Java', cpp: 'C++', typescript: 'TypeScript' };
const languageTab = (lab, language) => lab.getByRole('tab', { name: languageNames[language], exact: true });

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

const labEdits = require('./helpers/uml-lab-edits');

const syntaxSamples = {
  python: 'class Marker:\n    # class in comment\n    text = "class in string"\n    doc = """first line\nclass in multiline string\n"""\n    value = 42',
  java: 'class Marker {\n    /* class in comment\nclass on second comment line */\n    String text = "class in string";\n    int value = 42;\n}',
  cpp: 'class Marker {\n    /* class in comment\nclass on second comment line */\n    const char* text = "class in string";\n    int value = 42;\n};',
  typescript: 'class Marker {\n    /* class in comment\nclass on second comment line */\n    text: string = "class in string";\n    value: number = 42;\n}'
};

for (const chapter of [classChapter, sequenceChapter]) {
  test(`TypeScript editors use isolated lab scopes and retain type checking: ${chapter}`, async ({ page }) => {
    await page.goto(chapter);
    const labs = page.getByRole('region', { name: /^UML code lab:/ });
    await languageTab(labs.first(), 'typescript').click();
    await expect(page.locator('[data-uml-editor] .monaco-editor')).toHaveCount(await labs.count());
    const diagnostics = () => page.evaluate(async () => {
      const models = window.monaco.editor.getModels().filter(model => model.getLanguageId() === 'typescript');
      const getWorker = await window.monaco.languages.typescript.getTypeScriptWorker();
      const worker = await getWorker(...models.map(model => model.uri));
      const results = await Promise.all(models.map(model => worker.getSemanticDiagnostics(model.uri.toString())));
      return results.flat().map(diagnostic => ({ code: diagnostic.code, message: diagnostic.messageText }));
    });
    expect(await diagnostics()).toEqual([]);
    await replaceCode(editorFor(labs.first()), 'class Example { value: number = "wrong type"; }');
    await expect.poll(diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 2322 })]));
    await expect(editorFor(labs.first())).toBeFocused();
  });
}

for (const width of [1440, 390]) {
  test(`lab editors fit all code after edits, wrapping, and reset at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(classChapter);
    const lab = labByTitle(page, 'Member visibility');
    await languageTab(lab, 'typescript').click();
    const editor = editorFor(lab);
    const host = lab.locator('[data-uml-editor]');
    const longSource = [
      'class FullExample {',
      '    // ' + 'This explanation stays readable when the editor wraps onto another line. '.repeat(3),
      ...Array.from({ length: 30 }, (_, index) => `    value${index}: number = ${index};`),
      '    lastLine(): void {}',
      '}'
    ].join('\n');
    await replaceCode(editor, longSource);
    const overflow = () => host.evaluate(element => {
      const instance = window.monaco.editor.getEditors().find(candidate => candidate.getDomNode().parentElement === element);
      const layout = instance.getLayoutInfo();
      return { vertical: instance.getScrollHeight() > layout.height + 1,
        horizontal: instance.getScrollWidth() > layout.contentWidth + 1 };
    });
    await expect.poll(overflow).toEqual({ vertical: false, horizontal: false });
    await expect(host.locator('.view-line').filter({ hasText: 'lastLine' })).toBeVisible();
    const expanded = await host.boundingBox();
    await expect(editor).toBeFocused();
    await lab.getByRole('button', { name: 'Reset code' }).click();
    await expect.poll(async () => (await host.boundingBox()).height).toBeLessThan(expanded.height - 200);
    await expect.poll(overflow).toEqual({ vertical: false, horizontal: false });
    await languageTab(lab, 'python').click();
    await expect(editor).toHaveAccessibleName(/Python code/);
    await expect.poll(overflow).toEqual({ vertical: false, horizontal: false });
  });
}

for (const language of ['java', 'cpp']) {
  test(`${language}: incomplete code does not block the next diagram update`, async ({ page }) => {
    await page.goto(classChapter);
    const lab = labByTitle(page, 'Member visibility');
    await languageTab(lab, language).click();
    await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);
    const editor = editorFor(lab);
    const unfinished = language === 'java'
      ? 'class Example { void read(int value = ) {} }'
      : 'class Example { public: void read(int value) {';
    await replaceCode(editor, unfinished);
    await expect(lab).not.toHaveAttribute('data-state', 'pending');

    const repaired = language === 'java'
      ? 'class Recovered { public void read(int values[]) {} }'
      : 'class Recovered { public: void read(int values[]) {} };';
    await replaceCode(editor, repaired);
    await expect(lab.getByRole('img')).toHaveAccessibleName(/Recovered/);
    await expect(lab.getByRole('img')).toContainText('read(values: int[])');
    await expect(lab).toHaveAttribute('data-state', 'ready');
    await expect(editor).toBeFocused();
  });
}

for (const dark of [false, true]) {
  test(`Python is the default and all languages highlight edited syntax (${dark ? 'dark' : 'light'})`, async ({ page }) => {
    await page.goto(classChapter);
    await page.evaluate(enabled => document.documentElement.classList.toggle('dark-mode', enabled), dark);
    const lab = labByTitle(page, 'Member visibility');
    await expect(languageTab(lab, 'python')).toHaveAttribute('aria-selected', 'true');
    await expect(editorFor(lab)).toHaveAccessibleName(/Python code/);
    const referenceTabs = page.getByRole('tablist', { name: 'Simple class code language' });
    const tabColors = tab => tab.evaluate(element => {
      const style = getComputedStyle(element);
      return [style.color, style.backgroundColor, style.borderColor];
    });
    expect(await tabColors(languageTab(lab, 'python'))).toEqual(await tabColors(referenceTabs.getByRole('tab', { name: 'Python', exact: true })));
    expect(await tabColors(languageTab(lab, 'cpp'))).toEqual(await tabColors(referenceTabs.getByRole('tab', { name: 'C++', exact: true })));
    await expect.poll(() => lab.locator('.monaco-editor-background').evaluateAll(elements =>
      [...new Set(elements.map(element => getComputedStyle(element).backgroundColor))]
    )).toEqual([dark ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)']);
    for (const [language, source] of Object.entries(syntaxSamples)) {
      await languageTab(lab, language).click();
      await replaceCode(editorFor(lab), source);
      const lines = lab.locator('.view-lines');
      const keyword = lines.getByText('class', { exact: true });
      const comment = lines.getByText(/class\s+in\s+comment/);
      const string = lines.getByText(/class\s+in\s+string/);
      await expect(keyword).toBeVisible();
      await expect(comment).toBeVisible();
      await expect(string).toBeVisible();
      const color = locator => locator.evaluate(element => getComputedStyle(element).color);
      // Read one rendered frame: Monaco can replace token spans between
      // separate locator reads while retokenizing a switched language.
      await expect.poll(() => lines.locator('span').evaluateAll(elements => {
        const tokens = elements.filter(element => !element.children.length);
        const patterns = [/^class$/, /class\s+in\s+comment/, /class\s+in\s+string/];
        const colors = patterns.map(pattern => {
          const token = tokens.find(element => pattern.test(element.textContent.trim()));
          return token ? getComputedStyle(token).color : null;
        });
        return colors.every(Boolean) ? new Set(colors).size : 0;
      })).toBe(3);
      const continuation = lines.getByText(language === 'python' ? /class\s+in\s+multiline\s+string/ : /class\s+on\s+second\s+comment\s+line/);
      await expect(continuation).toBeVisible();
      await expect.poll(() => color(continuation)).toBe(await color(language === 'python' ? string : comment));
    }
  });
}

for (const [language, edits] of Object.entries(labEdits)) {
  test(`${language}: hiding the reading method preserves the field visibility`, async ({ page }) => {
    await page.goto(classChapter);
    const lab = labByTitle(page, 'Member visibility');
    await languageTab(lab, language).click();
    const editor = editorFor(lab);
    await expect(lab.getByRole('img')).toContainText(language === 'python' ? '#_name' : '-name');
    const original = await sourceText(lab);
    await replaceCode(editor, edits.visibility(original));
    await expect(lab.getByRole('img')).toContainText(language === 'python' ? '#_display_name()' : '-displayName()');
    await expect(lab.getByRole('img')).toContainText(language === 'python' ? '#_name' : '-name');
    await expect(editor).toBeFocused();
  });

  test(`${language}: removing storage and the parameter eliminates the dependency in two steps`, async ({ page }) => {
    await page.goto(classChapter);
    const lab = labByTitle(page, 'Keeping a reference');
    await languageTab(lab, language).click();
    await expect(lab.getByRole('img')).toHaveAccessibleName(/Student references Roster/);
    await expect(lab.getByRole('img')).not.toHaveAccessibleName(/Student references Roster with multiplicity one to/);
    const editor = editorFor(lab);
    const original = await sourceText(lab);
    await replaceCode(editor, edits.dependency(original));
    await expect(lab.getByRole('img')).toHaveAccessibleName(/Student depends on Roster/);
    await expect(lab.getByRole('img')).not.toHaveAccessibleName(/references/);
    await replaceCode(editor, edits.removeParameter(edits.dependency(original)));
    await expect(lab.getByRole('img')).not.toHaveAccessibleName(/Student (depends on|references) Roster/);
    await expect(lab.getByRole('img')).toHaveAccessibleName(/Student.*Roster|Roster.*Student/);
  });

  test(`${language}: inheritance and collection labs change the intended relationships`, async ({ page }) => {
    await page.goto(classChapter);
    const inheritance = labByTitle(page, 'Inheritance through a parent');
    await languageTab(inheritance, language).click();
    await expect(inheritance.getByRole('img')).toHaveAccessibleName(/Dog extends Animal/);
    await expect(inheritance.getByRole('img')).toHaveAccessibleName(/Puppy extends Animal/);
    const subclasses = await sourceText(inheritance);
    await replaceCode(editorFor(inheritance), edits.inheritance(subclasses));
    await expect(inheritance.getByRole('img')).toHaveAccessibleName(/Puppy extends Dog/);
    await expect(inheritance.getByRole('img')).toHaveAccessibleName(/Dog extends Animal/);

    await expect(inheritance.getByRole('img')).not.toHaveAccessibleName(/Puppy extends Animal/);

    const collection = labByTitle(page, 'One reference or a collection');
    await languageTab(collection, language).click();
    await expect(collection.getByRole('img')).toHaveAccessibleName(/Team.*Member with multiplicity .* to one/);
    const single = await sourceText(collection);
    await replaceCode(editorFor(collection), edits.collection_multiplicity(single));
    await expect(collection.getByRole('img')).toHaveAccessibleName(/Team.*Member with multiplicity .* to zero or more/);
    await expect(collection.getByRole('img')).not.toHaveAccessibleName(/multiplicity .* to one(?:[.;]|$)/);
  });

  test(`${language}: self-calls stay on the current object's lifeline`, async ({ page }) => {
    await page.goto(sequenceChapter);
    const selfCalls = labByTitle(page, 'Calling another method');
    await languageTab(selfCalls, language).click();
    await expect(selfCalls.getByRole('img')).toHaveAccessibleName(/2 participants.*Main creates checkout/);
    await expect(selfCalls.getByRole('img')).toHaveAccessibleName(/checkout calls checkout with "validate\(\)"/);
    await expect(selfCalls.getByRole('img')).not.toHaveAccessibleName(/save\(\)/);
    const calls = await sourceText(selfCalls);
    await replaceCode(editorFor(selfCalls), edits.self_calls(calls));
    await expect(selfCalls.getByRole('img')).toHaveAccessibleName(/checkout calls checkout with "save\(\)".*checkout calls checkout with "validate\(\)"/);
  });

  test(`${language}: changing a reference moves the reply without adding a lifeline`, async ({ page }) => {
    await page.goto(sequenceChapter);
    const lab = labByTitle(page, 'Following a reference');
    await languageTab(lab, language).click();
    const diagram = lab.getByRole('img');
    await expect(diagram).toHaveAccessibleName(/3 participants.*Main creates indoor.*Main creates outdoor/);
    await expect(diagram).toHaveAccessibleName(/Main calls indoor with "read\(\)".*indoor replies to Main/);
    await expect(diagram).not.toHaveAccessibleName(/Main calls outdoor/);
    const original = await sourceText(lab);
    await replaceCode(editorFor(lab), edits.message_receivers(original));
    await expect(diagram).toHaveAccessibleName(/Main calls outdoor with "read\(\)".*outdoor replies to Main/);
    await expect(diagram).not.toHaveAccessibleName(/Main calls indoor|indoor replies to Main/);
    await expect(diagram).toHaveAccessibleName(/3 participants.*Main creates indoor.*Main creates outdoor/);
  });

  test(`${language}: edits change message order and branch and loop boundaries`, async ({ page }) => {
    await page.goto(sequenceChapter);
    const order = labByTitle(page, 'Calls determine message order');
    await languageTab(order, language).click();
    await expect(order.getByRole('img')).toHaveAccessibleName(/Main calls payment with "authorize\(\)".*payment calls payment with "capture\(\)".*Main calls payment with "refund\(\)"/);
    const editor = editorFor(order);
    const original = await sourceText(order);
    await replaceCode(editor, edits.message_order(original));
    await expect(order.getByRole('img')).toHaveAccessibleName(/Main calls payment with "refund\(\)".*Main calls payment with "authorize\(\)".*payment calls payment with "capture\(\)"/);

    const alternatives = labByTitle(page, 'Alternatives are possible paths');
    await languageTab(alternatives, language).click();
    await expect(alternatives.getByRole('img')).toHaveAccessibleName(/alt branch.*approve\(\).*decline\(\)/);
    const branchEditor = editorFor(alternatives);
    const branches = await sourceText(alternatives);
    await replaceCode(branchEditor, edits.alternatives(branches));
    await expect(alternatives.getByRole('img')).toHaveAccessibleName(/optional fragment.*approve\(\).*optional fragment.*decline\(\)/);
    await expect(alternatives.getByRole('img')).not.toHaveAccessibleName(/alt branch/);

    const loop = labByTitle(page, 'The loop boundary matters');
    await languageTab(loop, language).click();
    await expect(loop.getByRole('img')).toHaveAccessibleName(/outside combined fragments.*finish\(\)/);
    const loopEditor = editorFor(loop);
    const loopSource = await sourceText(loop);
    await replaceCode(loopEditor, edits.loop_boundary(loopSource));
    await expect(loop.getByRole('img')).toHaveAccessibleName(/in loop.*(?:addItem|add_item)\(item\).*finish\(\)/);
    await expect(loop.getByRole('img')).not.toHaveAccessibleName(/outside combined fragments/);
    await expect(order.getByRole('img')).toHaveAccessibleName(/Main calls payment with "refund\(\)".*Main calls payment with "authorize\(\)".*payment calls payment with "capture\(\)"/);
  });
}

test('synced language changes preserve each lab draft; reset affects only the selected draft', async ({ page }) => {
  await page.goto(classChapter);
  const lab = labByTitle(page, 'Member visibility');
  const selector = lab.getByRole('tablist', { name: 'Code language' });
  await expect(selector.getByRole('tab')).toHaveText(['Python', 'Java', 'C++', 'TypeScript']);
  const editor = editorFor(lab);
  await expect(languageTab(lab, 'python')).toHaveAttribute('aria-selected', 'true');
  await languageTab(lab, 'java').click();
  await replaceCode(editor, 'class JavaDraft {}');
  const otherLab = labByTitle(page, 'Keeping a reference');
  await languageTab(otherLab, 'cpp').click();
  await expect(editor).toHaveAccessibleName(/C\+\+ code/);
  await replaceCode(editor, 'class CppDraft {};');
  await languageTab(lab, 'python').click();
  await replaceCode(editor, 'class PythonDraft:\n    pass');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/PythonDraft/);
  await languageTab(lab, 'cpp').click();
  await expect(lab.locator('[data-uml-source]')).toHaveValue('class CppDraft {};');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/CppDraft/);
  await languageTab(lab, 'java').click();
  await expect(lab.locator('[data-uml-source]')).toHaveValue('class JavaDraft {}');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/JavaDraft/);
  await expect(labByTitle(page, 'Keeping a reference').getByRole('img')).toHaveAccessibleName(/Student.*Roster|Roster.*Student/);
  await lab.getByRole('button', { name: 'Reset code' }).click();
  await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);
  await languageTab(lab, 'python').click();
  await expect(lab.locator('[data-uml-source]')).toHaveValue('class PythonDraft:\n    pass');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/PythonDraft/);
});

test('code examples and labs share keyboard language tabs with labeled panels', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(classChapter);
  const lab = labByTitle(page, 'Member visibility');
  const sample = page.locator('[data-language-switcher]').filter({
    has: page.getByRole('tablist', { name: 'Simple class code language' })
  });

  for (const [widget, first, last] of [[lab, 'Python', 'TypeScript'], [sample, 'Java', 'TypeScript']]) {
    const firstTab = widget.getByRole('tab', { name: first, exact: true });
    const lastTab = widget.getByRole('tab', { name: last, exact: true });
    await firstTab.focus();
    await firstTab.press('ArrowLeft');
    await expect(lastTab).toBeFocused();
    await expect(lastTab).toHaveAttribute('aria-selected', 'true');
    await expect(widget.getByRole('tabpanel', { name: last, exact: true })).toBeVisible();
    await lastTab.press('ArrowRight');
    await expect(firstTab).toBeFocused();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');
    await firstTab.press('End');
    await expect(lastTab).toBeFocused();
    await lastTab.press('Home');
    await expect(firstTab).toBeFocused();
    await expect(widget.getByRole('tabpanel', { name: first, exact: true })).toBeVisible();
    await expect(widget.getByRole('tab', { selected: true })).toHaveCount(1);
  }
  await languageTab(lab, 'cpp').click();
  await expect(editorFor(lab)).toHaveAccessibleName(/C\+\+ code/);
  await expect(sample.getByRole('tab', { name: 'C++', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(labByTitle(page, 'Keeping a reference').getByRole('tab', { name: 'C++' })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
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
  await languageTab(lab, 'java').click();
  await replaceCode(editor, 'class RecoveredJava {}');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/RecoveredJava/);
  await languageTab(lab, 'cpp').click();
  await replaceCode(editor, 'class RecoveredCpp {};');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/RecoveredCpp/);
  await replaceCode(editor, 'class Broken {');
  await expect(lab.getByRole('status')).toContainText('Could not update the diagram.');
  await expect(lab.getByRole('img')).toHaveCount(0);
  await replaceCode(editor, 'class CorrectedCpp {};');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/CorrectedCpp/);
  await languageTab(lab, 'typescript').click();
  await replaceCode(editor, 'class CorrectedTypeScript { value: number = 1; }');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/CorrectedTypeScript/);
});

test('TypeScript inference uses local dependencies and recovers after syntax errors', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto(classChapter);
  const lab = labByTitle(page, 'Keeping a reference');
  await languageTab(lab, 'typescript').click();
  await expect(lab.getByRole('img')).toHaveAccessibleName(/Student references Roster with multiplicity unspecified to zero or one/);
  await replaceCode(editorFor(lab), 'class Broken { read(value: ) {}');
  await expect(lab.getByRole('status')).toContainText('example.ts');
  await replaceCode(editorFor(lab), 'class Fixed { read(value: number): void {} }');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/Fixed/);
  await expect(lab.getByRole('img')).toContainText('read(value: number)');
  await expect(lab).toHaveAttribute('data-state', 'ready');
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

test('a stalled renderer times out and the next edit recovers without freezing the editor', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const BrowserWorker = window.Worker;
    window.Worker = class extends BrowserWorker {
      postMessage(message, transfer) {
        if (message.type === 'renderDiagram' && message.syntax.includes('StalledRender')) {
          window.umlRenderStalled = true;
          return;
        }
        super.postMessage(message, transfer);
      }
    };
  });
  await page.goto(classChapter);
  const lab = labByTitle(page, 'Member visibility');
  const editor = editorFor(lab);
  await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);
  await replaceCode(editor, 'class StalledRender:\n    pass');
  await expect.poll(() => page.evaluate(() => window.umlRenderStalled)).toBe(true);
  await expect(lab).toHaveAttribute('data-state', 'pending');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/Student/);
  await page.clock.fastForward(10_000);
  await expect(lab.getByRole('status')).toContainText('timed out');
  await replaceCode(editor, 'class RecoveredRender:\n    pass');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/RecoveredRender/);
  await expect(editor).toBeFocused();
  await expect(lab).toHaveAttribute('data-state', 'ready');
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
  await languageTab(lab, 'cpp').click();
  await lab.getByRole('textbox', { name: 'C++ code', exact: true }).fill('class CppFallback {};');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/CppFallback/);
  await languageTab(lab, 'typescript').click();
  await lab.getByRole('textbox', { name: 'TypeScript code', exact: true }).fill('class TypeScriptFallback { value: number = 1; }');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/TypeScriptFallback/);
});

for (const dark of [false, true]) {
  test(`controls and diagrams are readable and keyboard accessible at 320px (${dark ? 'dark' : 'light'})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(classChapter);
    await page.evaluate(enabled => document.documentElement.classList.toggle('dark-mode', enabled), dark);
    const lab = labByTitle(page, 'Member visibility');
    await languageTab(lab, 'cpp').click();
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
    for (const control of [editor, ...Object.keys(languageNames).map(language => languageTab(lab, language)), lab.getByRole('button', { name: 'Reset code' })]) {
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
  await languageTab(lab, 'cpp').click();
  await replaceCode(editorFor(lab), 'class PrintedDraft {};');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/PrintedDraft/);
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await page.emulateMedia({ media: 'print' });
  await expect(editorFor(lab)).toBeHidden();
  await expect(lab.getByRole('button', { name: 'Reset code' })).toBeHidden();
  await expect(lab.getByRole('tablist')).toBeHidden();
  await expect(lab.getByRole('code')).toBeVisible();
  await expect(lab.getByRole('code')).toHaveText('class PrintedDraft {};');
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
    await expect(lab.getByText(/std::string displayName/)).toBeVisible();
    await expect(lab.getByText(/private name: string/)).toBeVisible();
    await lab.getByText('Check your prediction', { exact: true }).click();
    await expect(lab.getByText(/Only read access is lost from the public API/)).toBeVisible();
  } finally {
    await context.close();
  }
});

test('combined course chapters initialize their embedded code labs', async ({ page }) => {
  await page.goto('/SEBook/CS130.html');
  const lab = labByTitle(page, 'Member visibility');
  await languageTab(lab, 'cpp').click();
  await replaceCode(editorFor(lab), 'class CombinedChapter {};');
  await expect(lab.getByRole('img')).toHaveAccessibleName(/CombinedChapter/);
});

test('the UML worker accepts C++ sources and class display options', async ({ page }) => {
  await page.goto(classChapter);
  const response = await page.evaluate(() => new Promise((resolve, reject) => {
    const worker = new Worker('/js/uml-worker.js');
    worker.onmessage = event => { worker.terminate(); resolve(event.data); };
    worker.onerror = event => { worker.terminate(); reject(new Error(event.message)); };
    worker.postMessage({
      type: 'analyze', id: 1, lang: 'cpp', options: { hideVisibility: true, hideMultiplicity: true },
      sources: {
        'worker.hpp': 'struct Item {}; struct Worker { Item* item; int count; void run(); };',
        'main.cpp': 'void Worker::run() {} int main() { Worker worker; worker.run(); }'
      }
    });
  }));
  expect(response.ok).toBe(true);
  expect(response.result.errors).toEqual([]);
  expect(response.result.classDiagram).toContain('Worker --> Item');
  expect(response.result.classDiagram).toContain('count: int');
  expect(response.result.classDiagram).not.toContain('+count');
  expect(response.result.sequenceDiagram).toContain('Main -> worker: run()');
});

test('the UML tutorial shares inference for Python, C++ and TypeScript source files', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/tools/uml-class-diagram-python.html');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });
  expect(await setEditorContent(page, 'class TutorialDraft:\n    def greet(self):\n        pass\n')).toBe(true);
  const viewer = page.getByRole('region', { name: /Interactive UML diagram viewer/ });
  await expect(viewer.getByRole('img')).toHaveAccessibleName(/TutorialDraft/);
  await expect(viewer.getByRole('img')).toContainText('greet()');
  // Supply the same configuration and real editor models that uml_files uses.
  // The tutorial's own detection, worker, analysis and rendering remain intact.
  const languages = await page.evaluate(() => {
    const tutorial = window._tutorial;
    tutorial._umlWatchedFiles = ['sensor.hpp', 'main.cpp'];
    tutorial.openFile('sensor.hpp', 'class Sensor { public: int read() const; };');
    tutorial.openFile('main.cpp', '#include "sensor.hpp"\nint Sensor::read() const { return 25; }\nint main() { Sensor sensor; sensor.read(); }');
    tutorial._refreshUMLDiagram();
    return tutorial._umlWatchedFiles.map(filename => tutorial.editorModels[filename].model.getLanguageId());
  });
  expect(languages).toEqual(['cpp', 'cpp']);
  await expect(viewer.getByRole('img')).toHaveAccessibleName(/Sensor/);
  await expect(viewer.getByRole('img')).toContainText('read(): int');
  await page.getByRole('button', { name: 'Sequence Diagram', exact: true }).click();
  await expect(viewer.getByRole('img')).toHaveAccessibleName(/Main calls sensor with "read\(\)".*sensor replies to Main with "int"/);
  expect(await setEditorContent(page, 'int Sensor::read() const { return 25; }\nint main() { Sensor second; second.read(); }')).toBe(true);
  await expect(viewer.getByRole('img')).toHaveAccessibleName(/Main calls second with "read\(\)"/);
  await expect(viewer.getByRole('img')).not.toHaveAccessibleName(/Main calls sensor/);
  const typeScriptLanguages = await page.evaluate(() => {
    const tutorial = window._tutorial;
    tutorial._umlWatchedFiles = ['sensor.ts', 'main.ts'];
    tutorial.openFile('sensor.ts', 'export class Sensor { read(): number { return 25; } }');
    tutorial.openFile('main.ts', "import { Sensor } from './sensor'; const device = new Sensor(); const selected = device; selected.read();");
    tutorial._refreshUMLDiagram();
    return tutorial._umlWatchedFiles.map(filename => tutorial.editorModels[filename].model.getLanguageId());
  });
  expect(typeScriptLanguages).toEqual(['typescript', 'typescript']);
  await expect(viewer.getByRole('img')).toHaveAccessibleName(/Main calls device with "read\(\)".*device replies to Main with "number"/);
  await page.getByRole('button', { name: 'Class Diagram', exact: true }).click();
  await expect(viewer.getByRole('img')).toContainText('read(): number');
});
