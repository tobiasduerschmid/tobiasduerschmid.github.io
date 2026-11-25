// @ts-check
// The editable dynamic view on step 8 of the C4 tutorial, "A Failed Seat Hold" (UML-view editing spec §8; plan
// Task 45), on the built tutorial page: novice profile, no locks, checks on request, and a lesson against declaring a
// relationship from the Seat Gateway to the Planner Web App. The canvas refuses that message before and after Check now,
// with the general sentence while the checks are withheld and never with an offer; a step drawn on the canvas is one
// undo step in the tutorial's Monaco history; the solution drawn on the canvas, two replies inside the alt branch, is
// the content test's graded model correct-3-canvas-two-replies.yml; and the teammate's draft pasted on the YAML surface
// is the content test's wrong-1-teammate-draft.yml as the canvas draws it.
//
// The step is opened by its stable key in instructor mode. The design text is read from the tutorial's Monaco model
// (window._tutorial) as test plumbing: it is the file autosave and grading read. Sentences are compared with the
// functions that own their words: the refusal table and the dynamic view module.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const C4 = require('../js/ArchUML/c4/c4-core.js');
const refusalTable = require('../js/ArchUML/c4/editor/c4-editor-uml-refusals.js');
const dynamicView = require('../js/ArchUML/c4/editor/c4-editor-uml-dynamic.js');

const TUTORIAL = '/SEBook/architecture/c4-tutorial';
const STEP_KEY = 'failed-seat-hold';
const VIEW = 'dynamic enroll';
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
const STEP = yaml.load(fs.readFileSync(path.join(__dirname, '../_data/tutorials/c4.yml'), 'utf8')).steps.find((step) => step.key === STEP_KEY);
const SEED = STEP.files.find((file) => file.path === 'design.yml').content;
const ALTERNATIVES = path.join(__dirname, '../scripts/tests/fixtures/c4-tutorial/c4/alternatives/step-8');
/** A graded model of the content test without its first line, which states its expected results. */
const gradedModel = (file) => fs.readFileSync(path.join(ALTERNATIVES, file), 'utf8').replace(/^#[^\n]*\n/, '');

const editor = (page) => page.locator('.c4-tutorial-editor');
const canvas = (page) => editor(page).getByRole('region', { name: /^Canvas/ });
const elements = (page) => canvas(page).getByRole('listbox', { name: 'Elements in this view' });
const option = (page, name) => elements(page).getByRole('option', { name, exact: true });
const messageRegion = (page) => editor(page).getByRole('region', { name: 'Messages', exact: true });
const inspector = (page) => editor(page).getByRole('region', { name: 'Inspector', exact: true });
const stepForm = (page) => editor(page).getByRole('dialog', { name: 'Add a step', exact: true });
const designText = (page) => page.evaluate(() => window._tutorial.editorModels['design.yml'].model.getValue());

async function openStep(page) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${TUTORIAL}?instructor-mode=true#${STEP_KEY}`);
  await expect(elements(page)).toBeVisible();
}

/** What the dynamic view module reads of the step's view drawn from `text` (plan Task 34's context). */
function contextOf(text, checksReleased) {
  const design = C4.load(text);
  const viewModel = C4.project(design, VIEW);
  return { design, viewModel, uml: C4.toUml(viewModel), profile: 'novice', checksReleased, layout: viewModel.layout };
}

/** The sentence the canvas shows for a message from `from` to `to` at the end of the scenario, as the table words it. */
function messageRefusal(text, from, to, checksReleased) {
  const planned = dynamicView.plan({ op: 'relation.add', tool: 'message', from, to, label: null }, contextOf(text, checksReleased));
  return refusalTable.verdict(planned.code, planned.values, { checksReleased, profile: 'novice' });
}

/** C on lifeline `fromName`, then the arrow keys to `toName` and Enter: a message drawn with the keyboard alone. */
async function drawMessage(page, fromName, toName) {
  await option(page, fromName).focus();
  await page.keyboard.press('c');
  for (let press = 0; press < 6 && !(await option(page, toName).evaluate((node) => node === document.activeElement)); press += 1) {
    await page.keyboard.press('ArrowRight');
  }
  await expect(option(page, toName)).toBeFocused();
  await page.keyboard.press('Enter');
}

/** Fills the open step form and confirms it, at the place labelled `place` when one is given. */
async function confirmStep(page, description, place = null) {
  const form = stepForm(page);
  if (place) await form.getByRole('combobox', { name: 'Position' }).selectOption({ label: place });
  await form.getByRole('textbox', { name: 'Description' }).fill(description);
  await form.getByRole('button', { name: 'Add the step' }).click();
  await expect(form).toHaveCount(0);
}

test.describe('step 8 of the C4 tutorial on its editable dynamic view', () => {
  test('before Check now a message from Seat Gateway to Planner Web App is refused with step/not-available and no offer, and the design is unchanged', async ({ page }) => {
    await openStep(page);
    const shown = messageRefusal(SEED, 'seats', 'web', false);
    expect(shown.code).toBe('step/not-available');

    await drawMessage(page, 'Seat Gateway', 'Planner Web App');

    await expect(messageRegion(page)).toContainText(shown.message);
    await expect(messageRegion(page).getByRole('button'), 'no offer: Dismiss is the only button').toHaveText(['Dismiss']);
    await expect(stepForm(page)).toHaveCount(0);
    expect(await designText(page)).toBe(SEED);
  });

  test('after Check now it is step/no-relationship with no offer', async ({ page }) => {
    await openStep(page);
    await editor(page).getByRole('button', { name: 'Check now' }).click();
    const shown = messageRefusal(SEED, 'seats', 'web', true);
    expect(shown.code).toBe('step/no-relationship');
    expect(shown.offer, 'the novice profile gets no offer to declare the relationship').toBeNull();

    await drawMessage(page, 'Seat Gateway', 'Planner Web App');

    await expect(messageRegion(page)).toContainText(shown.message);
    await expect(messageRegion(page).getByRole('button')).toHaveText(['Dismiss']);
    expect(await designText(page)).toBe(SEED);
  });

  test('a step added on the canvas is one undo step in the YAML surface\'s Monaco history', async ({ page }) => {
    await openStep(page);
    // A reply from the coordinator to the Planner Web App, which asked it at step 1: a step the canvas accepts.
    await drawMessage(page, 'Registration Coordinator', 'Planner Web App');
    await confirmStep(page, 'reports the outcome to');
    await expect.poll(() => designText(page)).toContain('- coordinator -> web: reports the outcome to');

    await canvas(page).focus();
    await page.keyboard.press(`${MOD}+z`);
    await expect.poll(() => designText(page), { message: 'one Undo takes the whole step back' }).toBe(SEED);
  });

  test('the solution drawn on the canvas as two replies inside the alt branch equals correct-3-canvas-two-replies.yml', async ({ page }) => {
    await openStep(page);
    const billing = 'Step 4: Registration Coordinator to Billing Gateway';

    // The billing step wrapped in an alt whose first branch is the case in which every seat is held.
    await option(page, billing).focus();
    await page.keyboard.press('Shift+F10');
    await editor(page).getByRole('menu', { name: `Actions for ${billing}` }).getByRole('menuitem', { name: 'Wrap in a fragment…' }).click();
    const wrap = editor(page).getByRole('dialog', { name: 'Wrap in a fragment', exact: true });
    await wrap.getByRole('combobox', { name: 'Operator' }).selectOption('alt');
    await wrap.getByRole('textbox', { name: 'Guard' }).fill('every seat is held');
    await wrap.getByRole('button', { name: 'Wrap the steps' }).click();
    await expect(wrap).toHaveCount(0);

    // Its second branch, for a full section, through the scenario form (the canvas selects the alt, so the inspector
    // shows the scenario).
    await option(page, 'alt: every seat is held').focus();
    await inspector(page).getByRole('textbox', { name: 'Guard of a new branch of step 4' }).fill('a section is full');
    await inspector(page).getByRole('button', { name: 'Add a branch to step 4' }).click();
    await expect(option(page, 'alt: every seat is held / a section is full')).toBeVisible();

    // The two replies at the end of that branch, each drawn on the canvas.
    const branchEnd = 'In alt, branch 2: a section is full, at the end';
    await drawMessage(page, 'Seat Gateway', 'Registration Coordinator');
    await confirmStep(page, 'reports which section was full to', branchEnd);
    await drawMessage(page, 'Registration Coordinator', 'Planner Web App');
    await confirmStep(page, 'reports which section was full to', branchEnd);

    await expect.poll(() => designText(page)).toBe(gradedModel('correct-3-canvas-two-replies.yml'));
  });

  test('pasting the teammate\'s draft on the YAML surface gives the model of wrong-1-teammate-draft.yml', async ({ page }) => {
    await openStep(page);
    const draft = gradedModel('wrong-1-teammate-draft.yml');
    await page.getByRole('group', { name: 'Editing surface' }).getByRole('button', { name: 'YAML', exact: true }).click();
    // The learner replaces the last step of enroll with the draft (test plumbing: one edit of the Monaco model, as a paste lands).
    await page.evaluate(([before, after]) => {
      const model = window._tutorial.editorModels['design.yml'].model;
      const offset = model.getValue().indexOf(before);
      const start = model.getPositionAt(offset);
      const end = model.getPositionAt(offset + before.length);
      model.pushEditOperations([], [{ range: new window.monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column), text: after }], () => null);
    }, [SEED.slice(SEED.indexOf('      - coordinator -> billing-gateway:')), draft.slice(draft.indexOf('      - alt:'))]);
    await expect.poll(() => designText(page)).toBe(draft);
    await page.getByRole('group', { name: 'Editing surface' }).getByRole('button', { name: 'Visual', exact: true }).click();

    // The canvas draws the draft's model: its steps, the invalid one among them, as the module names them.
    const expected = dynamicView.optionSets(contextOf(draft, false)).flatMap((set) => set.options.map((each) => each.name));
    await expect(elements(page).getByRole('option')).toHaveCount(expected.length);
    for (const name of expected) await expect(option(page, name)).toBeVisible();
    expect(expected).toContain('Step 5: Seat Gateway to Planner Web App');
  });
});
