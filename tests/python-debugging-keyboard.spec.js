// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const tutorial = loadTutorialConfig('python-debugging');
const URL = '/SEBook/tools/python-debugging?autosave=false';
const TIMEOUT = 60_000;
const editor = page => page.getByRole('textbox', { name: /^Code pane, Python code editor\./ });
const watchValue = (page, expression, value) => page.getByText(`${expression}→${value}`, { exact: true });
const historySlider = page => page.getByRole('slider', { name: 'Execution history position' });

function lineContaining(index, filename, text) {
  const file = tutorial.steps[index].files.find(entry => entry.path === filename);
  const line = file.content.split('\n').findIndex(value => value.includes(text)) + 1;
  if (!line) throw new Error(`Missing lesson statement ${filename}: ${text}`);
  return line;
}

// This helper intentionally navigates by Tab. Locator.focus(), locator.press(),
// and locator.click() would bypass exactly the keyboard barriers under test.
async function tabTo(page, target) {
  await expect(target).toBeVisible({ timeout: TIMEOUT });
  const focusTrail = [];
  for (let count = 0; count < 400; count++) {
    if (await target.evaluate(element => element === document.activeElement)) {
      await expect(target).toBeFocused();
      return;
    }
    // Read transient focus in one snapshot: a panel refresh can remove a
    // previously matched :focus element between separate locator reads.
    const { name, description } = await page.evaluate(() => {
      const element = document.activeElement;
      const name = element?.getAttribute('aria-label') || '';
      return { name, description: element ? `${element.tagName}: ${name || element.textContent?.trim().slice(0, 70)}` : '(document)' };
    });
    if (focusTrail.at(-1) !== description) focusTrail.push(description);
    // Monaco documents Escape as its keyboard exit; Tab inserts indentation.
    await page.keyboard.press(name && name.includes('code editor.') ? 'Escape' : 'Tab');
  }
  await expect(target, `the control is reachable through normal keyboard navigation; focus trail: ${focusTrail.slice(-12).join(' → ')}`).toBeFocused();
}

async function activate(page, target) {
  await tabTo(page, target);
  await page.keyboard.press('Enter');
}

async function enterText(page, target, text) {
  await tabTo(page, target);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(text);
  await expect(target, 'keyboard input replaces the field contents').toHaveValue(text);
}

async function openTutorial(page) {
  await page.goto(URL);
  await expect(page.getByRole('button', { name: 'Start debugger', exact: true }))
    .toBeEnabled({ timeout: TIMEOUT });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: TIMEOUT });
  await expect(page.getByRole('button', { name: /^Step 1:/ })).toHaveAttribute('aria-current', 'step');
}

// Minimal repairs keep the journey focused on student editing rather than
// retyping model files. Each substitution is checked against the full source.
const repairs = {
  0: ['greet.py', 'range(1, len(names))', 'range(0, len(names))'],
  2: ['pathfinder.py', 'if steps_used >= max_steps:', 'if steps_used > max_steps or (steps_used == max_steps and current != goal):'],
  3: ['ledger.py', 'row["type"].upper()', 'row["type"].strip().upper()'],
  5: ['waitlist.py', 'course.waitlist.pop()', 'course.waitlist.pop(0)'],
  7: ['tagger.py', 'counts[tag.upper()]', 'counts[tag.strip().upper()]'],
};

async function editFile(page, filename, search, replacement) {
  await activate(page, page.getByRole('button', { name: filename, exact: true }));
  await tabTo(page, editor(page));
  // Read the model only as an oracle; navigation and changes below use keys.
  const before = await page.evaluate(() => window.monaco.editor.getEditors()
    .find(instance => instance.hasTextFocus()).getValue());
  expect(before.split(search), 'the repair targets one existing expression').toHaveLength(2);
  // Monaco chooses its keymap from the browser UA, whereas its Find input is
  // native and uses the host's select-all shortcut.
  const modifier = await page.evaluate(() => /Macintosh/.test(navigator.userAgent) ? 'Meta' : 'Control');
  await page.keyboard.press(`${modifier}+f`);
  const find = page.getByRole('textbox', { name: 'Find', exact: true });
  await expect(find).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(search);
  await expect(find).toHaveValue(search);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(editor(page)).toBeFocused();
  await expect.poll(() => page.evaluate(() => {
    const focused = window.monaco.editor.getEditors().find(instance => instance.hasTextFocus());
    return focused.getModel().getValueInRange(focused.getSelection());
  }), { message: 'Find selects the intended expression before it is replaced' }).toBe(search);
  await page.keyboard.insertText(replacement);
  await expect.poll(() => page.evaluate(() => window.monaco.editor.getEditors()
    .find(instance => instance.hasTextFocus())?.getValue()), {
    message: 'keyboard editing changes exactly the intended expression',
  }).toBe(before.replace(search, replacement));
  await page.keyboard.press('Escape');
  await expect(editor(page), 'Escape releases keyboard focus from Monaco').not.toBeFocused();
}

async function repairAndCheck(page, index) {
  const step = tutorial.steps[index];
  await editFile(page, ...repairs[index]);
  // Follow the lesson's verification order: visible pytest, then independent
  // checks. Running pytest also saves the current editor contents to Python.
  await activate(page, page.getByRole('button', { name: /^▶\s+Test$/ }));
  await expect(page.getByRole('region', { name: 'Program output', exact: true }))
    .toContainText('✓ All tests passed', { timeout: TIMEOUT });
  await activate(page, page.getByRole('button', { name: /Test My Work/ }));
  await expect(page.getByText(`✅ All ${step.tests.length} tests passed!`, { exact: true }))
    .toBeVisible({ timeout: TIMEOUT });
}

async function addBreakpoint(page, filename, line) {
  const file = page.getByRole('combobox', { name: 'Breakpoint file', exact: true });
  await tabTo(page, file);
  // Native select type-ahead works across host platforms; macOS arrow keys
  // navigate an open menu without updating its value until it is committed.
  await page.keyboard.type(filename);
  await page.keyboard.press('Tab');
  await expect(file).toHaveValue(filename);
  await enterText(page, page.getByRole('spinbutton', { name: 'Breakpoint line', exact: true }), String(line));
  await activate(page, page.getByRole('button', { name: 'Add breakpoint', exact: true }));
  await expect(page.getByRole('button', { name: 'Edit condition', exact: true })).toBeVisible();
}

async function addWatch(page, expression) {
  await enterText(page, page.getByRole('textbox', { name: 'Watch expression', exact: true }), expression);
  await page.keyboard.press('Enter');
}

async function startAtBreakpoint(page, filename, line) {
  await activate(page, page.getByRole('button', { name: 'Start debugger', exact: true }));
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled({ timeout: TIMEOUT });
  await activate(page, page.getByRole('button', { name: 'Continue', exact: true }));
  await expect(page.getByText(`paused at breakpoint at ${filename}:${line}`, { exact: true }))
    .toBeVisible({ timeout: TIMEOUT });
}

async function stopAndRemoveBreakpoint(page) {
  await activate(page, page.getByRole('button', { name: 'Stop', exact: true }));
  await activate(page, page.getByRole('button', { name: 'Remove breakpoint', exact: true }));
  await expect(page.getByText('No code breakpoints.', { exact: true })).toBeVisible();
}

async function seekFirstWatchValue(page, expression, value) {
  const slider = historySlider(page);
  await tabTo(page, slider);
  const maximum = Number(await slider.getAttribute('max'));
  await page.keyboard.press('Home');
  await expect(slider, 'history seeking retains keyboard focus').toBeFocused();
  for (let position = 0; position <= maximum; position++) {
    if (await watchValue(page, expression, value).count()) return;
    await page.keyboard.press('ArrowRight');
    await expect(slider, 'consecutive arrow keys continue moving through history').toBeFocused();
  }
  await expect(watchValue(page, expression, value)).toBeVisible();
}

async function rehearseDebugger(page) {
  await activate(page, page.getByRole('button', { name: /\bDebug$/ }));
  const section = page.getByRole('button', { name: 'Call Stack', exact: true });
  await activate(page, section);
  await expect(section).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Space');
  await expect(section).toHaveAttribute('aria-expanded', 'true');
  const callLine = lineContaining(1, 'tour.py', 'total = process_scores(scores)');
  await addBreakpoint(page, 'tour.py', callLine);
  await startAtBreakpoint(page, 'tour.py', callLine);
  await activate(page, page.getByRole('button', { name: 'Step Into', exact: true }));
  await activate(page, page.getByRole('button', { name: 'Step Over', exact: true }));

  const caller = page.getByRole('button', { name: /^main\s*tour\.py:/ });
  await activate(page, caller);
  await expect(caller, 'selecting a frame retains keyboard focus').toBeFocused();
  await activate(page, page.getByRole('button', { name: 'Expand scores', exact: true }));
  const collapse = page.getByRole('button', { name: 'Collapse scores', exact: true });
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('[2]', { exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('[2]', { exact: true })).toBeHidden();
  await activate(page, page.getByRole('button', { name: /^process_scores\s*tour\.py:/ }));
  await addWatch(page, 'total');
  await addWatch(page, 'score');
  await expect(watchValue(page, 'total', '0')).toBeVisible();
  await activate(page, page.getByRole('button', { name: 'Step Over', exact: true }));
  await expect(watchValue(page, 'score', '8')).toBeVisible();
  await activate(page, page.getByRole('button', { name: 'Step Over', exact: true }));
  await expect(watchValue(page, 'total', '8')).toBeVisible();
  await activate(page, page.getByRole('button', { name: 'Step Out', exact: true }));
  await expect(page.getByText(`paused at line ${lineContaining(1, 'tour.py', 'print(')}`, { exact: true })).toBeVisible();
  await stopAndRemoveBreakpoint(page);

  const additionLine = lineContaining(1, 'tour.py', 'total += score');
  await addBreakpoint(page, 'tour.py', additionLine);
  const editCondition = page.getByRole('button', { name: 'Edit condition', exact: true });
  await activate(page, editCondition);
  const dialog = page.getByRole('dialog', { name: 'Breakpoint Condition', exact: true });
  await expect(dialog).toBeVisible();
  await enterText(page, dialog.getByRole('textbox', { name: 'Python expression', exact: true }), 'score < 0');
  await activate(page, dialog.getByRole('button', { name: 'Save', exact: true }));
  await expect(dialog).toBeHidden();
  await expect(editCondition, 'saving a condition restores a usable keyboard focus target').toBeFocused();
  await startAtBreakpoint(page, 'tour.py', additionLine);
  await expect(watchValue(page, 'score', '-5')).toBeVisible();
  await expect(watchValue(page, 'total', '11')).toBeVisible();
  await activate(page, page.getByRole('button', { name: 'Step Over', exact: true }));
  await expect(watchValue(page, 'total', '6')).toBeVisible();
  await activate(page, page.getByRole('button', { name: 'Step Back', exact: true }));
  await expect(watchValue(page, 'total', '11')).toBeVisible();
  const slider = historySlider(page);
  await tabTo(page, slider);
  await page.keyboard.press('Home');
  await expect(slider).toHaveValue('0');
  await expect(slider).toBeFocused();
  await page.keyboard.press('End');
  await expect(slider).toBeFocused();
  await expect(watchValue(page, 'total', '6')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(slider).toBeFocused();
  await expect(watchValue(page, 'total', '11')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(watchValue(page, 'total', '6')).toBeVisible();
  await a11yCheckpoint(page, 'Keyboard-only Python debugger history', {
    feature: 'python-debugging-keyboard', include: '.tvm-debug-view-dbg-combined',
  });
  await stopAndRemoveBreakpoint(page);
  await editFile(page, 'tour.py', 'total score:', 'total score after keyboard edit:');
  await activate(page, page.getByRole('button', { name: /^▶\s+Run$/ }));
  await expect(page.getByRole('region', { name: 'Program output', exact: true })).toContainText('total score after keyboard edit: 8');
  await activate(page, page.getByRole('button', { name: /\bSteps$/ }));
}

async function inspectRecordedHistory(page, index) {
  await activate(page, page.getByRole('button', { name: /\bDebug$/ }));
  if (index === 4) {
    const line = lineContaining(4, 'counter.py', 'return state');
    await addBreakpoint(page, 'counter.py', line);
    await addWatch(page, 'state["count"]');
    await addWatch(page, 'len(state["history"])');
    await startAtBreakpoint(page, 'counter.py', line);
    await expect(watchValue(page, 'state["count"]', '2')).toBeVisible();
    await seekFirstWatchValue(page, 'len(state["history"])', '3');
    await expect(watchValue(page, 'state["count"]', '-4')).toBeVisible();
    await page.keyboard.press('End');
    await expect(watchValue(page, 'len(state["history"])', '8')).toBeVisible();
  } else {
    const line = lineContaining(5, 'test_waitlist.py', 'cs201 = state["CS201"]');
    await addBreakpoint(page, 'test_waitlist.py', line);
    await addWatch(page, 'state["CS201"].enrolled');
    await addWatch(page, 'event.step');
    await startAtBreakpoint(page, 'test_waitlist.py', line);
    await expect(watchValue(page, 'state["CS201"].enrolled', "['Jules Kim', 'Kai Morgan']")).toBeVisible();
    await seekFirstWatchValue(page, 'state["CS201"].enrolled', "['Ava Chen', 'Jules Kim']");
    await expect(watchValue(page, 'event.step', '4')).toBeVisible();
    await page.keyboard.press('End');
    await expect(watchValue(page, 'state["CS201"].enrolled', "['Jules Kim', 'Kai Morgan']")).toBeVisible();
  }
  await expect(historySlider(page)).toBeFocused();
  await stopAndRemoveBreakpoint(page);
  await activate(page, page.getByRole('button', { name: /\bSteps$/ }));
}

async function finishKnowledgeCheck(page, index) {
  const questions = tutorial.steps[index].quiz.questions;
  await activate(page, page.getByRole('button', { name: 'Next →', exact: true }));
  const answers = questions.map(question => question.options[question.correct_index]);
  for (let questionIndex = 0; questionIndex < questions.length; questionIndex++) {
    await expect(page.getByRole('radiogroup', { name: 'Answer options', exact: true })).toBeVisible();
    // Questions and options are shuffled. Use the visible answer wording;
    // never read the renderer's hidden answer keys or disable shuffling.
    const matching = [];
    for (const answer of answers) {
      if (await page.getByRole('radio').filter({ hasText: answer }).count()) matching.push(answer);
    }
    expect(matching, 'one authored answer corresponds to the currently displayed question').toHaveLength(1);
    const answer = matching[0];
    await activate(page, page.getByRole('radio').filter({ hasText: answer }));
    await activate(page, page.getByRole('button', {
      name: questionIndex === questions.length - 1 ? 'See Results' : 'Next Question', exact: true,
    }));
  }
  await expect(page.getByText(new RegExp(`^Your Score:\\s*${questions.length}\\s*/\\s*${questions.length}$`)))
    .toBeVisible();
  if (index < tutorial.steps.length - 1) {
    await activate(page, page.getByRole('button', { name: `Continue to Step ${index + 2} →`, exact: true }));
    await expect(page.getByRole('button', { name: new RegExp(`^Step ${index + 2}:`) }))
      .toHaveAttribute('aria-current', 'step');
    await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: TIMEOUT });
  } else {
    await expect(page.getByText('Tutorial complete — great job!', { exact: true })).toBeVisible();
  }
}

test('a student can repair code and complete every Python debugging lesson using only the keyboard', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = [];
  page.on('pageerror', error => {
    // The Pyodide web loop also reports pytest's successful SystemExit(0)
    // through pageerror. The backend handles that as the command exit status;
    // retain every other error, including nonzero Python exits.
    if (error.message.includes('/pyodide/webloop.py') && /\nSystemExit: 0\s*$/.test(error.message)) return;
    errors.push(error.message);
  });
  await openTutorial(page);
  for (const [index, step] of tutorial.steps.entries()) {
    await test.step(step.title, async () => {
      if (index === 1) await rehearseDebugger(page);
      if (index === 4 || index === 5) await inspectRecordedHistory(page, index);
      if (step.tests?.length) await repairAndCheck(page, index);
      await finishKnowledgeCheck(page, index);
    });
  }
  expect(errors).toEqual([]);
});
