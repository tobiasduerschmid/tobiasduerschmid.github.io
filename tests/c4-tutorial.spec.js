// @ts-check
// The C4 tutorial runtime (spec §11; js/tutorial-c4.js) on the built tutorial page: the C4 editor bound to the
// design file's Monaco model, the Visual and YAML surfaces, locked parts, display modes, the Submit for review gate,
// and the instruction figures in the detached instructions popout and the print view.
// Steps are opened by their stable keys in instructor mode, which unlocks every step. The design text is read from
// the tutorial's Monaco model (window._tutorial) as test plumbing: it is the file autosave and grading read, and
// Monaco renders only the visible lines of it.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

/** A C4 tutorial on the built site: its page, its authored YAML (the oracle's source), and its stable step keys. */
function c4Tutorial(slug, url) {
  const data = yaml.load(fs.readFileSync(path.join(__dirname, `../_data/tutorials/${slug}.yml`), 'utf8'));
  return { slug, url, data, keys: data.steps.map((step) => step.key), step: (key) => data.steps.find((step) => step.key === key) };
}

const C4_TUTORIAL = c4Tutorial('c4', '/SEBook/architecture/c4-tutorial');
const TUTORIAL = C4_TUTORIAL.url;
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

async function openStep(page, key, tutorial = C4_TUTORIAL) {
  await page.goto(`${tutorial.url}?instructor-mode=true#${key}`);
  await expect(canvas(page)).toBeVisible();
}

const editor = (page) => page.locator('.c4-tutorial-editor');
const canvas = (page) => editor(page).getByRole('region', { name: /^Canvas/ });
const surfaces = (page) => page.getByRole('group', { name: 'Editing surface' });
const treeItem = (page, name) => editor(page).getByRole('tree', { name: 'Model outline' }).getByRole('treeitem', { name, exact: true });
const basicsField = (page, label) => editor(page).getByRole('region', { name: 'Inspector', exact: true })
  .getByRole('region', { name: 'Basics' }).getByRole('textbox', { name: label, exact: true });
const testPanel = (page) => page.locator('.tvm-step-content .tvm-test-panel');
const testButton = (page) => page.locator('.tvm-step-controls').getByRole('button', { name: /Test My Work/ });

const designText = (page) => page.evaluate(() => window._tutorial.editorModels['design.yml'].model.getValue());
const stepStarter = (page) => page.evaluate(() => window._tutorial.steps[window._tutorial.currentStep].files
  .find((file) => file.path === 'design.yml').content);

/** Opens the outline, which starts collapsed in a workspace column narrower than 60em, as at the default viewport. */
async function openOutline(page) {
  const toggle = editor(page).getByRole('button', { name: 'Outline', exact: true });
  await expect(toggle, 'the outline starts collapsed, so the drawing has the column').toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function chooseInOutline(page, name) {
  await treeItem(page, name).focus();
  await treeItem(page, name).press('Enter');
}

/** Renames the element `from` through the inspector: a visual edit. */
async function renameInInspector(page, from, to) {
  await chooseInOutline(page, from);
  const name = basicsField(page, 'Name');
  await name.fill(to);
  await name.press('Enter');
}

test.describe('C4 tutorial runtime', () => {
  test('the surface switch shows Visual and YAML above the editor', async ({ page }) => {
    await openStep(page, 'context-repair');
    const visual = surfaces(page).getByRole('button', { name: 'Visual', exact: true });
    const yaml = surfaces(page).getByRole('button', { name: 'YAML', exact: true });
    await expect(visual).toHaveAttribute('aria-pressed', 'true');
    await expect(yaml).toHaveAttribute('aria-pressed', 'false');
    expect(await surfaces(page).evaluate((group, region) => Boolean(group.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING),
      await canvas(page).elementHandle()), 'the switch comes before the editor').toBe(true);

    await yaml.click();
    await expect(yaml).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas(page)).toBeHidden();
    await expect(page.locator('.tvm-editor-container .view-lines')).toContainText('schema: c4-design/1');

    await visual.click();
    await expect(canvas(page)).toBeVisible();
  });

  // Final review I7: in the workspace column the drawing gets the column's width (the outline starts collapsed) and
  // the pane's height below the toolbar (size 'fill'); the inspector follows in the editor's own scroll.
  for (const [width, height] of [[1024, 768], [1440, 900]]) {
    test(`at ${width} × ${height} the drawing gets the workspace column's width and the pane's height`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openStep(page, 'context-repair');
      const [pane, drawing] = await Promise.all([editor(page).boundingBox(), canvas(page).boundingBox()]);
      const em = await editor(page).evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      expect(drawing.width, 'the canvas spans the editor, less its border').toBeGreaterThan(pane.width - 2 * em);
      // The canvas reaches one gap above the pane's bottom; a pane too short for that keeps the compact height (18em).
      const wanted = Math.max(18 * em, pane.y + pane.height - 0.5 * em - drawing.y);
      expect(Math.abs(drawing.height - wanted), `canvas ${drawing.height} high from y ${drawing.y}; pane ends at ${pane.y + pane.height}`)
        .toBeLessThanOrEqual(1);
    });
  }

  test('the editor binds to design.yml and writes undoable edits to its Monaco model', async ({ page }) => {
    await openStep(page, 'context-repair');
    await openOutline(page);
    await renameInInspector(page, 'Backend', 'Registration API');
    await expect.poll(() => designText(page)).toContain('name: Registration API');
    await expect(treeItem(page, 'Registration API')).toBeVisible();

    await canvas(page).focus();
    await page.keyboard.press(`${MOD}+z`);
    await expect.poll(() => designText(page)).toBe(await stepStarter(page));
    await expect(treeItem(page, 'Backend')).toBeVisible();
  });

  test('the toolbar Undo and Redo work on the Monaco history and say their keys', async ({ page }) => {
    await openStep(page, 'context-repair');
    const undo = editor(page).getByRole('button', { name: 'Undo', exact: true });
    const redo = editor(page).getByRole('button', { name: 'Redo', exact: true });
    await expect(undo).toHaveText('↶Undo');
    await expect(undo).toHaveAttribute('aria-keyshortcuts', 'Control+Z Meta+Z');
    await expect(undo).toHaveAttribute('aria-disabled', 'true');
    await openOutline(page);
    await renameInInspector(page, 'Backend', 'Registration API');
    await expect.poll(() => designText(page)).toContain('name: Registration API');

    // The tutorial's history is Monaco's, whose steps have no labels: the description names the keys only.
    await expect(undo).toHaveAccessibleDescription('Undo the last change. Ctrl+Z (Cmd+Z on a Mac)');
    await undo.click();
    await expect.poll(() => designText(page)).toBe(await stepStarter(page));
    await expect(redo).toHaveAttribute('aria-disabled', 'false');
    await expect(redo).toHaveAccessibleDescription('Redo the last undone change. Ctrl+Y or Ctrl+Shift+Z (Cmd+Shift+Z on a Mac)');
    await redo.click();
    await expect.poll(() => designText(page)).toContain('name: Registration API');
  });

  test('Reset and Show Solution replace the text and re-render without an echo', async ({ page }) => {
    await openStep(page, 'context-repair');
    const starter = await stepStarter(page);
    const solution = await page.evaluate(() => window._tutorial.steps[window._tutorial.currentStep].solution.files
      .find((file) => file.path === 'design.yml').content);
    await openOutline(page);
    await renameInInspector(page, 'Backend', 'Registration API');
    await expect.poll(() => designText(page)).not.toBe(starter);

    await basicsField(page, 'Name').focus();
    await page.getByRole('link', { name: /Reset Current Step/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset step' }).click();
    await expect.poll(() => designText(page)).toBe(starter);
    await expect(treeItem(page, 'Backend')).toBeVisible();
    // An echo would push the editor's copy back into the model as a new edit: nothing to undo means none happened.
    expect(await page.evaluate(() => window._tutorial.editorModels['design.yml'].model.canUndo())).toBe(false);

    await page.getByRole('link', { name: /Solution/ }).click();
    await expect.poll(() => designText(page)).toBe(solution);
    await expect(treeItem(page, 'Backend')).toHaveCount(0);
    expect(await page.evaluate(() => window._tutorial.editorModels['design.yml'].model.canUndo())).toBe(false);
  });

  test("Ctrl/Cmd+Enter in the canvas runs the step's tests", async ({ page }) => {
    await openStep(page, 'context-repair');
    await canvas(page).focus();
    await page.keyboard.press(`${MOD}+Enter`);
    await expect(testPanel(page)).toContainText(/tests passed/);
  });

  test('under on-request, Ctrl/Cmd+Enter runs Test My Work, not Check now', async ({ page }) => {
    await openStep(page, 'inside-the-api');
    const problems = editor(page).getByRole('tabpanel', { name: /^Problems/ });
    await expect(problems).toContainText('Problems are hidden until you choose Check now.');
    await canvas(page).focus();
    await page.keyboard.press(`${MOD}+Enter`);
    await expect(testPanel(page)).toContainText(/tests passed/);
    await expect(problems).toContainText('Problems are hidden until you choose Check now.');
  });

  // Step 6 switches the inline form lint off (scaffolds.inlineLint: false), so this checks the Problems panel only.
  test('under on-request, the Problems panel shows no findings until Check now', async ({ page }) => {
    // The step's stubbed components leave findings in the seed; under on-request none shows before Check now.
    await openStep(page, 'inside-the-api');
    const problems = editor(page).getByRole('tabpanel', { name: /^Problems/ });
    await expect(problems).toContainText('Problems are hidden until you choose Check now.');
    await expect(problems).not.toContainText(/Error:|Warning:|Suggestion:/);

    await editor(page).getByRole('button', { name: 'Check now' }).click();
    await expect(problems).toContainText(/Error: There is no responsibility/);
  });

  test('read_only opens the editor read-only', async ({ page }) => {
    await openStep(page, 'owner-of-a-decision');
    await expect(editor(page).getByText('This model is read-only.').first()).toBeVisible();
    await expect(editor(page).getByRole('button', { name: 'Add relationship' })).toBeDisabled();
  });

  test('an edit on the YAML surface that changes a locked path is reverted with a visible message', async ({ page }) => {
    await openStep(page, 'system-responsibilities');
    const starter = await stepStarter(page);
    await surfaces(page).getByRole('button', { name: 'YAML', exact: true }).click();
    await page.locator('.tvm-editor-container .view-line').filter({ hasText: 'FR-22:' }).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Or not.');

    await expect(page.getByRole('status').filter({ hasText: 'Locked:' }))
      .toHaveText('Locked: requirements.FR-22 or a part of it is given by the task, so your change was undone here.');
    await expect.poll(() => designText(page)).toBe(starter);

    // The message belongs to that edit: switching surfaces clears it.
    await surfaces(page).getByRole('button', { name: 'Visual', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Locked:' })).toHaveCount(0);
  });

  test('under after-submit, Test My Work and Ctrl/Cmd+Enter are disabled with a visible reason until Submit for review runs', async ({ page }) => {
    await openStep(page, 'makerspace-transfer');
    const controls = page.locator('.tvm-step-controls');
    await expect(testButton(page)).toBeDisabled();
    await expect(controls.getByText('Submit for review first; Test My Work opens after that.')).toBeVisible();
    await expect(testButton(page)).toHaveAccessibleDescription('Submit for review first; Test My Work opens after that.');

    await canvas(page).focus();
    await page.keyboard.press(`${MOD}+Enter`);
    await expect(page.getByRole('status').filter({ hasText: 'Submit for review first' })).toBeVisible();
    await expect(page.locator('.tvm-step-content .tvm-test-results')).toHaveCount(0);

    await controls.getByRole('button', { name: 'Submit for review' }).click();
    await expect(testButton(page)).toBeEnabled();
    await expect(editor(page).getByRole('tabpanel', { name: /^Problems/ })).not.toContainText('Problems are hidden');
    await canvas(page).focus();
    await page.keyboard.press(`${MOD}+Enter`);
    await expect(testPanel(page)).toContainText(/tests passed/);
  });

  test('under after-submit, the detached instructions popout shows the gate and its reason, and opens it with Submit for review', async ({ page }) => {
    await openStep(page, 'makerspace-transfer');
    const [popout] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'Open instructions in separate window' }).click(),
    ]);
    const popoutControls = popout.locator('#stepControlsEl');
    const popoutTest = popoutControls.getByRole('button', { name: /Test My Work/ });
    const reason = 'Submit for review first; Test My Work opens after that.';
    await expect(popoutTest).toBeDisabled();
    await expect(popoutControls.getByText(reason)).toBeVisible();
    await expect(popoutTest).toHaveAccessibleDescription(reason);

    await popoutControls.getByRole('button', { name: 'Submit for review' }).click();
    await expect(popoutTest).toBeEnabled();
    await expect(popoutControls.getByText(reason)).toHaveCount(0);
    await expect(editor(page).getByRole('tabpanel', { name: /^Problems/ })).not.toContainText('Problems are hidden');
  });

  for (const { key, number, figures } of [{ key: 'owner-of-a-decision', number: 1, figures: 1 }, { key: 'change-impact', number: 7, figures: 2 }]) {
    test(`the detached instructions popout renders the c4 figures of step ${number}`, async ({ page }) => {
      await openStep(page, key);
      const [popout] = await Promise.all([
        page.waitForEvent('popup'),
        page.getByRole('button', { name: 'Open instructions in separate window' }).click(),
      ]);
      await expectDescribedFigures(popout.locator('#stepContentEl'), figures);
    });

    test(`the print view renders the c4 figures of step ${number} before printing`, async ({ page }) => {
      await page.addInitScript(() => {
        window.__drawnWhenPrinting = [];
        window.print = () => window.__drawnWhenPrinting.push(document.querySelectorAll('.uml-c4-diagram-container svg').length);
      });
      await page.goto(`${TUTORIAL}/print?autoprint=1`);
      await expect.poll(() => page.evaluate(() => window.__drawnWhenPrinting)).toHaveLength(1);
      await expectDescribedFigures(page.locator('main .step').nth(number - 1), figures);
      expect(await page.evaluate(() => window.__drawnWhenPrinting[0]), 'every C4 figure was drawn when the print dialog opened')
        .toBe(await page.locator('.uml-c4-diagram-container svg').count());
    });
  }
});

test.describe('Instruction figures in the detached popout of other tutorials', () => {
  /** Opens the popout of `url` on the step the nav button `stepName` opens, recording the scripts the popout requests. */
  async function openPopout(page, url, stepName) {
    await page.goto(`${url}?instructor-mode=true`);
    if (stepName) await page.locator('.tvm-step-nav').getByRole('button', { name: stepName }).click();
    const requested = [];
    page.context().on('request', (request) => { if (request.resourceType() === 'script') requested.push(new URL(request.url()).pathname); });
    const [popout] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'Open instructions in separate window' }).click(),
    ]);
    return { popout, requested };
  }

  test('a non-C4 tutorial\'s popout draws its ArchUML class figures with their description, without the C4 toolkit', async ({ page }) => {
    const { popout, requested } = await openPopout(page, '/SEBook/tools/solid-tutorial', /^Step 3:/);
    const figures = popout.locator('#stepContentEl figure').filter({ has: popout.locator('[data-uml-type="class"]') });
    await expect(figures).toHaveCount(2);
    await expect(figures.first().getByRole('img').first()).toHaveAccessibleName(/class diagram/i);
    await expect(figures.first().locator('[data-uml-verbose="true"]')).toContainText(/\S/);
    expect(requested.filter((pathname) => /\/js\/ArchUML\/c4\//.test(pathname)), 'C4 scripts the popout loaded').toEqual([]);
  });

  test('a popout whose instructions have no ArchUML figure loads none of the ArchUML scripts', async ({ page }) => {
    const { popout, requested } = await openPopout(page, '/SEBook/tools/solid-tutorial', null);
    await expect(popout.locator('#stepContentEl h2')).toBeVisible();
    await popout.waitForLoadState('networkidle');
    expect(requested.filter((pathname) => /\/js\/ArchUML\/|uml-auto-describe/.test(pathname)), 'ArchUML scripts the popout loaded').toEqual([]);
  });
});

/**
 * Replaces `from` with `to` in the design file as one edit on its Monaco model, as a learner's typing on the YAML
 * surface lands (test plumbing: Monaco auto-indents typed YAML, so whole blocks are spliced in directly).
 */
async function editDesign(page, from, to) {
  await page.evaluate(([before, after]) => {
    const model = window._tutorial.editorModels['design.yml'].model;
    const offset = model.getValue().indexOf(before);
    if (offset < 0) throw new Error(`editDesign: ${before} is not in the design`);
    const start = model.getPositionAt(offset);
    const end = model.getPositionAt(offset + before.length);
    model.pushEditOperations([], [{ range: new window.monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column), text: after }], () => null);
  }, [from, to]);
}

const testResult = (page, description) => testPanel(page).getByRole('listitem').filter({ hasText: description });
const authorErrors = (page) => {
  const found = [];
  page.on('console', (message) => { if (message.type() === 'error' && /author error/.test(message.text())) found.push(message.text()); });
  return found;
};

const TUTORIAL_DATA = C4_TUTORIAL.data;
const STEP_KEYS = C4_TUTORIAL.keys;
const stepData = C4_TUTORIAL.step;
const hintCards = (page) => testPanel(page).locator('.tvm-tutor-hint');

/**
 * Opens the collapsed Hints disclosure under the test results. It is activated from the keyboard: the tooltip of the
 * Test My Work button, still hovered after a click on it, can lie over the toggle.
 */
async function openHintPanel(page) {
  const toggle = testPanel(page).getByRole('button', { name: 'Hints', exact: true });
  await toggle.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

/** Opens step `key` as a learner who has passed every earlier step: Next is gated by this step's tests. */
async function openStepAsLearner(page, key, tutorial = C4_TUTORIAL) {
  const index = tutorial.keys.indexOf(key);
  const earlier = tutorial.keys.slice(0, index).map((_, step) => step);
  await page.addInitScript(([storageKey, progress]) => {
    if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, progress);
  }, [`tutorial-progress-${tutorial.slug}`, JSON.stringify({
    step: index, files: {}, stepFiles: {}, stepsUnlocked: earlier.concat(index), stepsVisited: earlier.concat(index),
    stepsPassed: earlier, quizPassed: earlier, progressVersion: 1, stepKeys: tutorial.keys,
  })]);
  await page.goto(tutorial.url);
  await expect(canvas(page)).toBeVisible();
}

test.describe('C4 tutorial grading', () => {
  test('a passing predicate marks the test passed and unlocks Next when all pass', async ({ page }) => {
    await openStepAsLearner(page, 'zooming-in');
    const next = page.locator('.tvm-step-controls').getByRole('button', { name: /Next/ });
    await expect(next).toBeDisabled();

    await testButton(page).click();
    await expect(testResult(page, 'The saved view who-decides shows')).toContainText('✗');
    await expect(next).toBeDisabled();

    await editDesign(page, '    view: context of registration', '    view: components of api');
    await testButton(page).click();
    await expect(testResult(page, 'The saved view who-decides shows')).toContainText('✓');
    await expect(testPanel(page)).toContainText('All 1 tests passed');
    await expect(next).toBeEnabled();
  });

  test('YAML errors yield ? with Fix the YAML errors first and idle controls', async ({ page }) => {
    await openStep(page, 'context-repair');
    await editDesign(page, 'name: Course Registration\n', 'name: [Course Registration\n');
    await testButton(page).click();

    const items = testPanel(page).getByRole('listitem');
    const count = await page.evaluate(() => window._tutorial.steps[window._tutorial.currentStep].tests.length);
    await expect(items).toHaveCount(count);
    for (let index = 0; index < count; index += 1) {
      await expect(items.nth(index)).toContainText('?');
      await expect(items.nth(index)).toContainText('Fix the YAML errors first');
    }
    await expect(testPanel(page)).toContainText(`0 / ${count} tests passed`);
    // Idle: the button is back to its ordinary state, and a repaired design is graded on the next press.
    await expect(testButton(page)).toBeEnabled();
    await editDesign(page, 'name: [Course Registration\n', 'name: Course Registration\n');
    await testButton(page).click();
    await expect(testPanel(page)).not.toContainText('Fix the YAML errors first');
  });

  test('edits during evaluation discard the stale results', async ({ page }) => {
    await openStep(page, 'context-repair');
    await page.getByRole('link', { name: /Solution/ }).click();
    // Grading is synchronous, so a learner edit cannot interleave on its own: the first evaluation lands one, as a
    // keystroke arriving mid-run would (an asynchronous evaluator, or a re-entrant edit, opens that window).
    await page.evaluate(() => {
      const query = window.ArchUMLC4.query;
      const evaluate = query.evaluate;
      let edited = false;
      query.evaluate = function (...args) {
        if (!edited) {
          edited = true;
          const model = window._tutorial.editorModels['design.yml'].model;
          model.pushEditOperations([], [{ range: new window.monaco.Range(1, 1, 1, 1), text: '# a late edit\n' }], () => null);
        }
        return evaluate.apply(this, args);
      };
    });
    await testButton(page).click();

    await expect(testPanel(page)).toHaveText('The design changed while it was being checked. Results discarded; run Test My Work again.');
    await expect(testPanel(page).getByRole('listitem')).toHaveCount(0);
    await expect(testButton(page)).toBeEnabled();
    await testButton(page).click();
    await expect(testPanel(page)).toContainText(/All \d+ tests passed/);
  });

  test("same_as_seed compares against the step's authored starter file", async ({ page }) => {
    const coordinatorKept = 'The coordinator is unchanged since the step began';
    await openStep(page, 'change-impact');
    await openOutline(page);
    await renameInInspector(page, 'Registration Coordinator', 'Attempt Coordinator');
    await expect.poll(() => designText(page)).toContain('name: Attempt Coordinator');

    // The saved draft is restored on reload; the baseline is still the step's authored starter.
    await page.reload();
    await expect(canvas(page)).toBeVisible();
    await expect.poll(() => designText(page)).toContain('name: Attempt Coordinator');
    await testButton(page).click();
    await expect(testResult(page, coordinatorKept)).toContainText('✗');

    await page.getByRole('link', { name: /Reset Current Step/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset step' }).click();
    await expect.poll(() => designText(page)).not.toContain('Attempt Coordinator');
    await testButton(page).click();
    await expect(testResult(page, coordinatorKept)).toContainText('✓');

    await page.getByRole('link', { name: /Solution/ }).click();
    await testButton(page).click();
    await expect(testResult(page, coordinatorKept)).toContainText('✓');
    await expect(testPanel(page)).toContainText(/All \d+ tests passed/);
  });

  test('a selector naming a missing view fails as a learner failure', async ({ page }) => {
    const errors = authorErrors(page);
    const decides = 'The saved view who-decides shows';
    await openStep(page, 'zooming-in');
    const views = await page.evaluate(() => {
      const text = window._tutorial.editorModels['design.yml'].model.getValue();
      return text.slice(text.indexOf('\nviews:'));
    });
    await editDesign(page, views, '\n');
    await testButton(page).click();
    await expect(testResult(page, decides)).toContainText('✗');
    await expect(testResult(page, decides)).toContainText('No view named who-decides yet');

    await editDesign(page, '\n', views.replace('view: context of registration', 'view: components of API'));
    await testButton(page).click();
    await expect(testResult(page, decides)).toContainText('✗');
    await expect(testResult(page, decides)).toContainText('There is no element named API');
    expect(errors, 'a missing view or element is the learner\'s, not an author error').toEqual([]);
  });

  test('a selector naming a missing view in a hint condition hides only that hint', async ({ page }) => {
    const errors = authorErrors(page);
    const check = stepData('zooming-in').tests.find((item) => item.description.startsWith('The saved view who-decides shows'));
    const unconditional = check.hints.filter((item) => !item.condition).map((item) => item.title);
    await openStep(page, 'zooming-in');
    await editDesign(page, 'view: context of registration', 'view: components of API');
    await testButton(page).click();
    await openHintPanel(page);
    for (const title of unconditional) await expect(hintCards(page).filter({ hasText: title })).toHaveCount(1);
    expect(errors, 'a missing view in a hint condition is not an author error').toEqual([]);
  });

  test('YAML errors show one Fix the YAML errors first card and no authored or fallback hints', async ({ page }) => {
    await openStep(page, 'context-repair');
    await editDesign(page, 'name: Course Registration\n', 'name: [Course Registration\n');
    await testButton(page).click();
    await openHintPanel(page);
    await expect(hintCards(page)).toHaveCount(1);
    await expect(hintCards(page)).toContainText('Fix the YAML errors first');
    await expect(hintCards(page)).toContainText('Test My Work');
  });

  test('a throwing hint evaluation cannot leave the test controls busy', async ({ page }) => {
    const uncaught = [];
    page.on('pageerror', (error) => uncaught.push(error.message));
    await openStep(page, 'zooming-in');
    const [popout] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'Open instructions in separate window' }).click(),
    ]);
    // A defect in hint evaluation (test plumbing: the adapter's evaluator is replaced on this tutorial instance).
    await page.evaluate(() => { window._tutorial._evaluateC4Hint = () => { throw new Error('hint evaluation failed'); }; });
    // The instructions, with Test My Work, now live in the popout.
    const popoutTest = popout.locator('#stepControlsEl').getByRole('button', { name: /Test My Work/ });
    await popoutTest.click();

    // The popout shows "Running tests…" from the start of the run until the results reach it.
    await expect(popout.locator('#stepContentEl')).toContainText('0 / 1 tests passed');
    await expect(popout.getByText(/Running tests/)).toHaveCount(0);
    await expect(popoutTest).toBeEnabled();
    expect(uncaught, 'the hint failure is contained').toEqual([]);
  });
});

/** `scope` holds `count` C4 figures, each a drawn image with an accessible name and the detailed text description. */
async function expectDescribedFigures(scope, count) {
  const figures = scope.locator('figure').filter({ has: scope.page().locator('.uml-c4-diagram-container') });
  await expect(figures).toHaveCount(count);
  for (let index = 0; index < count; index += 1) {
    const figure = figures.nth(index);
    const image = figure.getByRole('img').first();
    await expect(image).toHaveAccessibleName(/view of/);
    await expect(figure.locator('.uml-c4-diagram-container svg')).toHaveCount(1);
    await expect(figure.locator('[data-uml-verbose="true"]')).toContainText(/\S/);
  }
}

// ---- Content, steps 1–5 (plan 5, Task 4) --------------------------------------------------------------------------
// The learner path of the first five steps on the built page: each knowledge check and each step's solution, entered
// as a learner enters it, and on each starter the check results and the hints the real core says should show. The
// expected results come from the C4 core itself (js/ArchUML/c4/c4-core.js) on the authored starter, with the step's
// merged checks configuration (spec §11), so editing the content does not need these tests edited.

const c4Core = require('../js/ArchUML/c4/c4-core.js');
const { a11yCheckpoint, auditInteractiveState } = require('./a11y-helpers');

const GRADED_STEPS_1_TO_5 = STEP_KEYS.slice(1, 5);
const designFile = (files) => files.find((file) => file.path === 'design.yml').content;
const checksConfigOf = (step, tutorial = C4_TUTORIAL) => ({ ...(tutorial.data.c4.checks || {}), ...((step.c4 || {}).checks || {}) });

/** Grades `text` against the step's tests and hint conditions the way the tutorial does (spec §8, §11). */
function gradeWithCore(step, text, tutorial = C4_TUTORIAL) {
  const seedModel = c4Core.load(designFile(step.files)).model;
  const design = c4Core.load(text);
  const checksConfig = checksConfigOf(step, tutorial);
  const holds = (predicate) => c4Core.query.evaluate(design, predicate, { seedModel, checksConfig }).passed === true;
  return step.tests.map((check) => ({
    description: check.description,
    passed: holds(check.c4),
    hints: (check.hints || []).map((hint) => ({ title: hint.title, conditional: Boolean(hint.condition), shows: !hint.condition || holds(hint.condition.c4) })),
  }));
}

/** Replaces the whole design file, as a learner's paste on the YAML surface lands (test plumbing, see editDesign). */
async function replaceDesign(page, text) {
  await page.evaluate((after) => {
    const model = window._tutorial.editorModels['design.yml'].model;
    model.pushEditOperations([], [{ range: model.getFullModelRange(), text: after }], () => null);
  }, text);
}

const plainText = (markdown) => markdown.replace(/`/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const quizOption = (page, question, index) => page.getByRole(question.type === 'multiple' ? 'checkbox' : 'radio',
  { name: new RegExp(`^[A-Z]\\s*${escapeRegex(plainText(question.options[index]))}$`) });

/** The authored question whose options are all on screen (the quiz may present its questions in any order). */
async function visibleQuestion(page, questions) {
  for (const question of questions) {
    const shown = await Promise.all(question.options.map((_, index) => quizOption(page, question, index).isVisible()));
    if (shown.every(Boolean)) return question;
  }
  return null;
}

/** Answers the step's knowledge check with its authored key, through the controls a learner uses. */
async function passKnowledgeCheck(page, quiz) {
  const unanswered = new Set(quiz.questions);
  while (unanswered.size) {
    await expect.poll(() => visibleQuestion(page, unanswered).then(Boolean),
      { message: 'the visible knowledge-check question is an authored one' }).toBe(true);
    const question = await visibleQuestion(page, unanswered);
    if (question.type === 'multiple') {
      for (const index of question.correct_indices) await quizOption(page, question, index).click();
      await page.getByRole('button', { name: 'Submit Answer', exact: true }).click();
    } else {
      await quizOption(page, question, question.correct_index).click();
    }
    unanswered.delete(question);
    await page.getByRole('button', { name: unanswered.size ? 'Next Question' : 'See Results', exact: true }).click();
  }
  const total = quiz.questions.length;
  await expect(page.getByText(new RegExp(`^Your Score:\\s*${total}\\s*/\\s*${total}$`))).toBeVisible();
}

const nextButton = (page) => page.locator('.tvm-step-controls').getByRole('button', { name: /Next/ });
const stepHeading = (page, step) => page.locator('.tvm-step-content').getByRole('heading', { name: step.title, exact: true });

test.describe('C4 tutorial content, steps 1–5', () => {
  test('a learner passes steps 1–5 with each knowledge check and each solution, and reaches step 6', async ({ page }) => {
    test.setTimeout(240_000);
    const uncaught = [];
    page.on('pageerror', (error) => uncaught.push(error.message));
    const errors = authorErrors(page);
    await page.goto(TUTORIAL);

    for (const [index, step] of TUTORIAL_DATA.steps.slice(0, 5).entries()) {
      await expect(stepHeading(page, step)).toBeVisible();
      await expect(canvas(page)).toBeVisible();
      if (step.tests) {
        await replaceDesign(page, designFile(step.solution.files));
        await testButton(page).click();
        await expect(testPanel(page)).toContainText(`All ${step.tests.length} tests passed`);
        await a11yCheckpoint(page, `c4 tutorial: step ${index + 1} passing`, { feature: 'c4-tutorial' });
      }
      await expect(nextButton(page)).toBeEnabled();
      await nextButton(page).click();
      if (step.quiz) {
        await expect(page.getByRole('heading', { name: step.quiz.title, exact: true })).toBeVisible();
        await a11yCheckpoint(page, `c4 tutorial: step ${index + 1} knowledge check`, { feature: 'c4-tutorial' });
        await passKnowledgeCheck(page, step.quiz);
        await page.getByRole('button', { name: /continue/i }).click();
      }
    }
    await expect(stepHeading(page, TUTORIAL_DATA.steps[5])).toBeVisible();
    expect(errors, 'no author errors on steps 1–5').toEqual([]);
    expect(uncaught, 'no uncaught page errors').toEqual([]);
  });

  for (const key of GRADED_STEPS_1_TO_5) {
    const number = STEP_KEYS.indexOf(key) + 1;
    test(`on the starter of step ${number}, each check reports the core's verdict and the hints shown are the ones whose conditions hold`, async ({ page }) => {
      await expectVerdictsAndHints(page, key);
    });
  }
});

/** Runs Test My Work as a learner does: under `after-submit` the step's tests wait for Submit for review (spec §11). */
async function runStepTests(page, step, tutorial = C4_TUTORIAL) {
  if (checksConfigOf(step, tutorial).display === 'after-submit') await submitForReviewButton(page).click();
  await testButton(page).click();
}

const submitForReviewButton = (page) => page.locator('.tvm-step-controls').getByRole('button', { name: 'Submit for review', exact: true });

/**
 * On step `key` with the design `attempt` (default: the authored starter), Test My Work shows the core's verdict for
 * each check, and the hints panel shows exactly the hints of failing checks whose conditions hold (unconditional
 * hints always hold). Returns the core's expectations.
 */
async function expectVerdictsAndHints(page, key, { attempt, tutorial = C4_TUTORIAL } = {}) {
  const step = tutorial.step(key);
  const number = tutorial.keys.indexOf(key) + 1;
  const label = attempt === undefined ? 'starter' : 'attempt';
  const expected = gradeWithCore(step, attempt === undefined ? designFile(step.files) : attempt, tutorial);
  expect(expected.some((check) => !check.passed), `the ${label} of step ${number} fails a check`).toBe(true);
  await openStep(page, key, tutorial);
  if (attempt !== undefined) await replaceDesign(page, attempt);
  await runStepTests(page, step, tutorial);
  for (const check of expected) {
    await expect(testResult(page, check.description), check.description).toContainText(check.passed ? '✓' : '✗');
  }

  const failing = expected.filter((check) => !check.passed);
  const shown = new Set(failing.flatMap((check) => check.hints.filter((hint) => hint.shows).map((hint) => hint.title)));
  const hidden = [...new Set(expected.flatMap((check) => check.hints.filter((hint) => !hint.shows || check.passed)
    .map((hint) => hint.title)))].filter((title) => !shown.has(title));
  await openHintPanel(page);
  await expect(hintCards(page)).not.toHaveCount(0);
  const titles = (await hintCards(page).locator('.tvm-tutor-hint-title').allInnerTexts())
    .map((title) => title.replace(/^\S+\s/, '').trim());
  for (const title of shown) expect(titles, `the hint "${title}" shows`).toContain(title);
  for (const title of hidden) expect(titles, `the hint "${title}" stays hidden`).not.toContain(title);
  await a11yCheckpoint(page, `${tutorial.slug} tutorial: step ${number} ${label} with hints`, { feature: 'c4-tutorial' });
  return expected;
}

// ---- Content, steps 6–9 (plan 5, Task 5) --------------------------------------------------------------------------
// The learner path of the last four steps: each step's solution and knowledge check, the transfer step's Submit for
// review gate, and on each starter and one partial attempt per step the check results and the hints the real core
// says should show.

const GRADED_STEPS_6_TO_9 = STEP_KEYS.slice(5, 9);
const ATTEMPTS = path.join(__dirname, '../scripts/tests/fixtures/c4-tutorial/c4/alternatives');
const problemsPanel = (page) => editor(page).getByRole('tabpanel', { name: /^Problems/ });

test.describe('C4 tutorial content, steps 6–9', () => {
  test('a learner passes steps 6–9 with each knowledge check and each solution', async ({ page }) => {
    test.setTimeout(240_000);
    const uncaught = [];
    page.on('pageerror', (error) => uncaught.push(error.message));
    const errors = authorErrors(page);
    await openStepAsLearner(page, 'inside-the-api');

    const lastStep = TUTORIAL_DATA.steps.length;
    for (const [offset, step] of TUTORIAL_DATA.steps.slice(5).entries()) {
      const number = offset + 6;
      await expect(stepHeading(page, step)).toBeVisible();
      await expect(canvas(page)).toBeVisible();
      await replaceDesign(page, designFile(step.solution.files));
      await runStepTests(page, step);
      await expect(testPanel(page)).toContainText(`All ${step.tests.length} tests passed`);
      await a11yCheckpoint(page, `c4 tutorial: step ${number} passing`, { feature: 'c4-tutorial' });
      if (number === lastStep) break;
      await expect(nextButton(page)).toBeEnabled();
      await nextButton(page).click();
      if (step.quiz) {
        await expect(page.getByRole('heading', { name: step.quiz.title, exact: true })).toBeVisible();
        await a11yCheckpoint(page, `c4 tutorial: step ${number} knowledge check`, { feature: 'c4-tutorial' });
        await passKnowledgeCheck(page, step.quiz);
        await page.getByRole('button', { name: /continue/i }).click();
      }
    }
    expect(errors, 'no author errors on steps 6–9').toEqual([]);
    expect(uncaught, 'no uncaught page errors').toEqual([]);
  });

  test('step 9 disables Test My Work until Submit for review', async ({ page }) => {
    const step = stepData('makerspace-transfer');
    const starter = designFile(step.files);
    const reason = 'Submit for review first; Test My Work opens after that.';
    const controls = page.locator('.tvm-step-controls');
    await openStepAsLearner(page, 'makerspace-transfer');
    await expect(stepHeading(page, step)).toBeVisible();
    expect(plainText(step.instructions), 'the instructions name the button the learner must choose').toContain('Submit for review');

    await expect(testButton(page)).toBeDisabled();
    await expect(controls.getByText(reason)).toBeVisible();
    await expect(testButton(page)).toHaveAccessibleDescription(reason);
    await expect(problemsPanel(page)).toContainText('Problems are hidden until you submit for review.');
    await canvas(page).focus();
    await page.keyboard.press(`${MOD}+Enter`);
    await expect(page.getByRole('status').filter({ hasText: reason })).toBeVisible();
    await expect(page.locator('.tvm-step-content .tvm-test-results')).toHaveCount(0);

    await submitForReviewButton(page).click();
    const diagnostics = c4Core.check(c4Core.load(starter), checksConfigOf(step));
    expect(diagnostics.length, 'the starter has diagnostics to release').toBeGreaterThan(0);
    for (const diagnostic of diagnostics) await expect(problemsPanel(page)).toContainText(diagnostic.message);
    await expect(controls.getByText(reason)).toHaveCount(0);
    await expect(testButton(page)).toBeEnabled();
    await testButton(page).click();
    for (const check of gradeWithCore(step, starter)) {
      await expect(testResult(page, check.description), check.description).toContainText(check.passed ? '✓' : '✗');
    }
    await a11yCheckpoint(page, 'c4 tutorial: step 9 after Submit for review', { feature: 'c4-tutorial' });
  });

  for (const width of [320, 1440]) {
    test(`at ${width} px the reason Test My Work waits reflows inside the step controls (WCAG 1.4.10)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openStep(page, 'makerspace-transfer');
      const bar = page.locator('.tvm-step-controls-bar');
      const reason = bar.getByText('Submit for review first; Test My Work opens after that.');
      await expect(reason).toBeVisible();
      const [barBox, reasonBox] = [await bar.boundingBox(), await reason.boundingBox()];
      expect(reasonBox.x, 'the reason starts inside the bar').toBeGreaterThanOrEqual(barBox.x);
      expect(reasonBox.x + reasonBox.width, 'the reason ends inside the bar').toBeLessThanOrEqual(barBox.x + barBox.width);
      const overflow = await bar.evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(overflow, 'the bar needs no sideways scrolling').toBeLessThanOrEqual(0);
    });
  }

  for (const key of GRADED_STEPS_6_TO_9) {
    const number = STEP_KEYS.indexOf(key) + 1;
    test(`on the starter of step ${number}, each check reports the core's verdict and the hints shown are the ones whose conditions hold`, async ({ page }) => {
      await expectVerdictsAndHints(page, key);
    });
  }

  // The starters of steps 6–9 reach only unconditional hints, so one partial attempt per step (a named wrong model of
  // the content test) exercises the conditional ones: the step-7 attempt changes the Enrollment API, the step-8
  // attempt is the teammate's draft the step asks the learner to run.
  for (const [key, attemptFile] of [
    ['inside-the-api', 'step-6/wrong-5-two-writers.yml'],
    ['change-impact', 'step-7/wrong-7-outcome-field-added.yml'],
    ['failed-seat-hold', 'step-8/wrong-1-teammate-draft.yml'],
    ['makerspace-transfer', 'step-9/wrong-3-ms3-untraced.yml'],
  ]) {
    const number = STEP_KEYS.indexOf(key) + 1;
    test(`on a partial attempt at step ${number} (${attemptFile}), the hints shown are the ones whose conditions hold`, async ({ page }) => {
      const attempt = fs.readFileSync(path.join(ATTEMPTS, attemptFile), 'utf8');
      const expected = await expectVerdictsAndHints(page, key, { attempt });
      expect(expected.some((check) => !check.passed && check.hints.some((hint) => hint.conditional && hint.shows)),
        'the attempt reaches a conditional hint').toBe(true);
    });
  }
});

// ---- Interface tutorial "Describe an interface" (plan 5, Task 5b) -------------------------------------------------
// The follow-up tutorial on the same runtime: the learner path through its four steps, step 1's syntax-only card of the
// Enrollment API in the step pane and in the print view, the locked syntax of step 2, and on steps 2 and 3 the check
// results and hints the real core says should show, on each starter and on one partial attempt. The expected results
// come from the core on the authored YAML, as for the C4 tutorial above.

const { execFileSync } = require('node:child_process');
const { contrast, luminance, paletteOf } = require('./print-helpers');

const INTERFACES_TUTORIAL = c4Tutorial('c4-interfaces', '/SEBook/architecture/c4-interfaces-tutorial');
const INTERFACE_ATTEMPTS = path.join(__dirname, '../scripts/tests/fixtures/c4-tutorial/c4-interfaces/alternatives');
const GRADED_INTERFACE_STEPS = INTERFACES_TUTORIAL.data.steps.filter((step) => step.tests).map((step) => step.key);
const enrollmentCard = (scope) => scope.getByRole('article', { name: 'Enrollment API', exact: true });
const cardGroup = (card, name) => card.getByRole('group', { name, exact: true });

/** The titles of the hint cards on screen, with the Hints disclosure opened if it is collapsed. */
async function shownHintTitles(page) {
  const toggle = testPanel(page).getByRole('button', { name: 'Hints', exact: true });
  if (await toggle.getAttribute('aria-expanded') !== 'true') await openHintPanel(page);
  return (await hintCards(page).locator('.tvm-tutor-hint-title').allInnerTexts()).map((title) => title.replace(/^\S+\s/, '').trim());
}

/** Titles of the hints that should show for `expected`: the hints of failing checks whose conditions hold. */
const expectedHintTitles = (expected) => [...new Set(expected.filter((check) => !check.passed)
  .flatMap((check) => check.hints.filter((hint) => hint.shows).map((hint) => hint.title)))];

test.describe('Interface tutorial content', () => {
  test('a learner passes all four steps with each knowledge check and each solution', async ({ page }) => {
    test.setTimeout(240_000);
    const uncaught = [];
    page.on('pageerror', (error) => uncaught.push(error.message));
    const errors = authorErrors(page);
    await page.goto(INTERFACES_TUTORIAL.url);

    const { steps } = INTERFACES_TUTORIAL.data;
    for (const [index, step] of steps.entries()) {
      const number = index + 1;
      await expect(stepHeading(page, step)).toBeVisible();
      await expect(canvas(page)).toBeVisible();
      if (step.tests) {
        await replaceDesign(page, designFile(step.solution.files));
        await runStepTests(page, step, INTERFACES_TUTORIAL);
        await expect(testPanel(page)).toContainText(`All ${step.tests.length} tests passed`);
        await a11yCheckpoint(page, `c4-interfaces tutorial: step ${number} passing`, { feature: 'c4-tutorial' });
      }
      if (!step.quiz && number === steps.length) break;
      await expect(nextButton(page)).toBeEnabled();
      await nextButton(page).click();
      if (step.quiz) {
        await expect(page.getByRole('heading', { name: step.quiz.title, exact: true })).toBeVisible();
        await a11yCheckpoint(page, `c4-interfaces tutorial: step ${number} knowledge check`, { feature: 'c4-tutorial' });
        await passKnowledgeCheck(page, step.quiz);
        if (number < steps.length) await page.getByRole('button', { name: /continue/i }).click();
      }
    }
    expect(errors, 'no author errors in the interface tutorial').toEqual([]);
    expect(uncaught, 'no uncaught page errors').toEqual([]);
  });

  test('step 1 shows the Enrollment API card with its syntactic view only', async ({ page }) => {
    await openStep(page, 'predict-from-syntax', INTERFACES_TUTORIAL);
    const card = enrollmentCard(page.locator('.tvm-step-content'));
    await expect(card).toHaveCount(1);
    await expect(cardGroup(card, 'Syntactic view')).toContainText('POST /v1/enrollments');
    await expect(cardGroup(card, 'Data types')).toContainText('units_enrolled');
    await expect(cardGroup(card, 'Semantic view'), 'the semantics stay hidden until the learner has predicted').toHaveCount(0);
    await expect(card, 'a syntax-only card prints no absence lines').not.toContainText('not stated');
    await a11yCheckpoint(page, 'c4-interfaces tutorial: step 1 syntax-only card', { feature: 'c4-tutorial' });
  });

  test('the print view prints the step 1 card once, syntax only, in the light palette from a saved dark theme', async ({ page, context, baseURL }, testInfo) => {
    test.slow();
    await context.addCookies([{ name: 'dark-mode', value: 'true', url: baseURL }]);
    await page.emulateMedia({ media: 'print' });
    await page.goto(`${INTERFACES_TUTORIAL.url}/print`);
    const card = enrollmentCard(page);
    await expect(card).toHaveCount(1);
    await expect(enrollmentCard(page.locator('main .step').first())).toHaveCount(1);
    await expect(cardGroup(card, 'Semantic view')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveClass(/\bdark-mode\b/);

    const { text, background } = await paletteOf(cardGroup(card, 'Syntactic view'));
    expect(luminance(background), 'the card prints on a light surface').toBeGreaterThan(0.9);
    expect(contrast(text, background), 'the card text reaches 4.5:1').toBeGreaterThanOrEqual(4.5);

    // The PDF's text holds the operation and each data row of the card exactly once (no second copy from a description
    // block). Header rows are left out: a table that crosses a page break repeats its header on the next page.
    const squeezed = (value) => value.replace(/\s+/g, '');
    const cardLines = (await card.locator('dl, tbody tr').allInnerTexts()).map(squeezed);
    const pdfPath = testInfo.outputPath('c4-interfaces-print.pdf');
    await page.pdf({ path: pdfPath, printBackground: true });
    const pdfText = squeezed(execFileSync('pdftotext', ['-raw', '-enc', 'UTF-8', pdfPath, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    expect(cardLines.length, 'the operation and the seven fields').toBe(8);
    for (const line of cardLines) expect(pdfText.split(line).length - 1, `printed once: ${line}`).toBe(1);
  });

  test("step 2 keeps the given syntax: an edit to an operation's syntax line on the YAML surface is undone with a visible message", async ({ page }) => {
    await openStep(page, 'complete-semantic-view', INTERFACES_TUTORIAL);
    const starter = await stepStarter(page);
    await surfaces(page).getByRole('button', { name: 'YAML', exact: true }).click();
    // The line lies below Monaco's rendered lines, so the typed change lands as one model edit (see editDesign).
    await editDesign(page, 'syntax: POST /v1/enrollments', 'syntax: POST /v1/enrollments/now');

    await expect(page.getByRole('status').filter({ hasText: 'Locked:' }))
      .toHaveText(/^Locked: \S*operations\.submit-plan\.syntax or a part of it is given by the task, so your change was undone here\.$/);
    await expect.poll(() => designText(page)).toBe(starter);
  });

  for (const key of GRADED_INTERFACE_STEPS) {
    const number = INTERFACES_TUTORIAL.keys.indexOf(key) + 1;
    test(`on the starter of interface step ${number}, each check reports the core's verdict and the hints shown are the ones whose conditions hold`, async ({ page }) => {
      await expectVerdictsAndHints(page, key, { tutorial: INTERFACES_TUTORIAL });
    });
  }

  for (const [key, attemptFile] of [
    ['complete-semantic-view', 'step-2/wrong-03-unit-units.yml'],
    ['describe-billing', 'step-3/wrong-02-quantities-as-text.yml'],
  ]) {
    const number = INTERFACES_TUTORIAL.keys.indexOf(key) + 1;
    test(`on a partial attempt at interface step ${number} (${attemptFile}), the hints shown are the ones whose conditions hold`, async ({ page }) => {
      const attempt = fs.readFileSync(path.join(INTERFACE_ATTEMPTS, attemptFile), 'utf8');
      const expected = await expectVerdictsAndHints(page, key, { attempt, tutorial: INTERFACES_TUTORIAL });
      expect(expected.some((check) => !check.passed && check.hints.some((hint) => hint.conditional && hint.shows)),
        'the attempt reaches a conditional hint').toBe(true);
    });
  }

  test('on step 2, the hints of the starter go away as their checks pass', async ({ page }) => {
    const step = INTERFACES_TUTORIAL.step('complete-semantic-view');
    const partial = fs.readFileSync(path.join(INTERFACE_ATTEMPTS, 'step-2/wrong-03-unit-units.yml'), 'utf8');
    const onStarter = expectedHintTitles(gradeWithCore(step, designFile(step.files), INTERFACES_TUTORIAL));
    const onPartial = expectedHintTitles(gradeWithCore(step, partial, INTERFACES_TUTORIAL));
    const settled = onStarter.filter((title) => !onPartial.includes(title));
    expect(settled.length, 'the partial attempt settles some of the starter\'s hints').toBeGreaterThan(0);

    await openStep(page, 'complete-semantic-view', INTERFACES_TUTORIAL);
    await testButton(page).click();
    expect(await shownHintTitles(page)).toEqual(expect.arrayContaining(onStarter));

    await replaceDesign(page, partial);
    await testButton(page).click();
    await expect(testPanel(page)).toContainText(`${step.tests.length - 1} / ${step.tests.length} tests passed`);
    const afterPartial = await shownHintTitles(page);
    for (const title of settled) expect(afterPartial, `the hint "${title}" is gone once its check passes`).not.toContain(title);

    await replaceDesign(page, designFile(step.solution.files));
    await testButton(page).click();
    await expect(testPanel(page)).toContainText(`All ${step.tests.length} tests passed`);
    await expect(hintCards(page)).toHaveCount(0);
  });

  test('the tutorials index lists the interface tutorial right after the C4 tutorial', async ({ page }) => {
    await page.goto('/SEBook/tutorials');
    await expect(page.getByRole('link', { name: INTERFACES_TUTORIAL.data.title, exact: true }))
      .toHaveAttribute('href', INTERFACES_TUTORIAL.url);
    const titles = (await page.getByRole('heading', { level: 2 }).allTextContents()).map((title) => title.trim());
    const parent = titles.indexOf(C4_TUTORIAL.data.title);
    expect(parent).toBeGreaterThanOrEqual(0);
    expect(titles[parent + 1]).toBe(INTERFACES_TUTORIAL.data.title);
  });

  test('the SEBook navigation lists both C4 tutorials under the C4 Model chapter, the interface tutorial second', async ({ page }) => {
    // Tutorial pages have no SEBook sidebar; the chapter's page opens its own entry.
    await page.goto('/SEBook/architecture/c4');
    const contents = page.getByRole('navigation', { name: 'SE Book table of contents' });
    const chapter = contents.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'C4 Model', exact: true }) });
    const links = chapter.getByRole('link', { name: /\(Tutorial\)$/ });
    await expect(links).toHaveText(['The C4 Model in Practice (Tutorial)', 'Describe an Interface (Tutorial)']);
    await expect(links.nth(1)).toHaveAttribute('href', INTERFACES_TUTORIAL.url);
  });
});

// ---- Both tutorials across widths and themes (plan 5, Task 6) -----------------------------------------------------
// Every step of both tutorials passes axe in the light and the dark theme at 320 and 1440 px, with its checks run on
// the starter and the hints they raise on screen (the states a learner reads most), and the page never needs sideways
// scrolling (WCAG 1.4.10). The print views print in the light palette from a saved dark theme and pass axe too.

for (const tutorial of [C4_TUTORIAL, INTERFACES_TUTORIAL]) {
  for (const width of [320, 1440]) {
    test(`${tutorial.slug} tutorial at ${width} px: every step, with its checks and hints, passes axe in light and dark and reflows`, async ({ page }) => {
      test.setTimeout(360_000);
      await page.setViewportSize({ width, height: 900 });
      for (const [index, step] of tutorial.data.steps.entries()) {
        const label = `${tutorial.slug} tutorial, step ${index + 1} at ${width} px`;
        await openStep(page, step.key, tutorial);
        if (step.tests) {
          await runStepTests(page, step, tutorial);
          await expect(testPanel(page).getByRole('listitem')).toHaveCount(step.tests.length);
          await openHintPanel(page);
          await expect(hintCards(page), `${label}: the starter raises hints`).not.toHaveCount(0);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${label}: the page needs no sideways scrolling`).toBeLessThanOrEqual(0);
        await auditInteractiveState(page, label);
      }
    });
  }

  test(`the ${tutorial.slug} tutorial's print view prints in the light palette from a saved dark theme and passes axe`, async ({ page, context, baseURL }) => {
    test.slow();
    await context.addCookies([{ name: 'dark-mode', value: 'true', url: baseURL }]);
    await page.emulateMedia({ media: 'print' });
    await page.goto(`${tutorial.url}/print`);
    const steps = page.locator('main .step');
    await expect(steps).toHaveCount(tutorial.data.steps.length);
    await expect(page.locator('html')).not.toHaveClass(/\bdark-mode\b/);
    for (const index of [0, tutorial.data.steps.length - 1]) {
      const heading = steps.nth(index).getByRole('heading', { name: tutorial.data.steps[index].title });
      const { text, background } = await paletteOf(heading);
      expect(luminance(background), `step ${index + 1} prints on a light surface`).toBeGreaterThan(0.9);
      expect(contrast(text, background), `step ${index + 1}'s heading reaches 4.5:1`).toBeGreaterThanOrEqual(4.5);
    }
    await auditInteractiveState(page, `${tutorial.slug} tutorial print view`, { darkMode: false });
  });
}
