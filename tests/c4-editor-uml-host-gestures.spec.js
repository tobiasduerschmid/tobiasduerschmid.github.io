// @ts-check
// What the other three UML-notation views need from the C4 host (UML-view editing plan Task 42; spec §7.4, §7.6):
// one gesture per notation, each run through the C4 surface over the real drawing of the reference model, and each
// reaching a fake view module that records what it is asked. The fakes stand in for the view modules the V lanes write
// (Tasks 43–46): they offer the drawn boxes, lines, and fragments as options, accept every operation with one marker
// change (the Billing System's description names the operation applied), and answer `targets`, `places`, and `menu`
// with fixed advice. So each test checks only the host's part:
// which press starts which module gesture, which operation the module builds from it, and how the host's keys and
// menus turn module advice into operations.
//
// Also here: the anchored-form helper every V-lane form is built from (`actions.openAnchoredForm`), and the step
// selection `{ scenarioId, step: { containerPath, index } }` (spec §7.6), which the outline reveals and the inspector
// hands to the scenario form's `revealStep`.
//
// Pages come from tests/helpers/c4-uml-editing.js. Drawing coordinates are read from the session's hit layer and the
// bundle's `UMLShared.renderedLayoutBox` (test plumbing); the target marks (`uml-pg-target-mark`) are found by the class
// spec §3.7 keeps as a contract of the module.
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');
const { dragBetween } = require('./helpers/c4-editor-page.js');
const { C4, INTERFACES_REFERENCE, openUmlEditor, hostLog, canvas, elements, option, messageRegion } = require('./helpers/c4-uml-editing.js');

const DYNAMIC = 'dynamic enroll';
const DEPLOYMENT = 'deployment production';
const INTERFACES = 'interfaces of api';
const HIT_LAYER = '.uml-pg-edit-layer';
// The editor's popups sit this close to what they were opened from (c4-editor-dom.js placeNear), with a pixel to spare.
const ANCHOR_GAP_PX = 5;

/** The drawn text of `view` in the reference model, split into lines as the adapter indexes them (no layout block). */
function drawnLines(view) {
  const uml = C4.toUml(C4.project(C4.load(INTERFACES_REFERENCE), view));
  return uml.text.split('\n');
}

/** The index of the drawn line of `view` that reads `text` (trimmed). */
function lineOf(view, text) {
  const index = drawnLines(view).findIndex((line) => line.trim() === text);
  if (index < 0) throw new Error(`no line "${text}" in ${view}`);
  return index;
}

/**
 * Runs in the page before the editor mounts: replaces the view modules of the sequence, deployment, and component
 * notations by recording fakes, and registers the form factory `probe`, which keeps the kit it is made with in
 * `window.probeKit`. Every question a fake is asked is pushed to `window.fakeViews.asked` as `{ notation, method,
 * request }`. `advice` (from the test) fixes what the fakes answer: `targets` (by notation), `places` (by ref), `menu`
 * (by ref), `elements` (the element tools, by notation; none by default), and `refuse` (by operation: the refusal plan
 * the fake gives instead of accepting).
 */
function installFakeViews(advice) {
  const asked = [];
  window.fakeViews = { asked };
  const parts = window.ArchUMLC4EditorParts;
  const record = (notation, method, request) => asked.push({ notation, method, request: JSON.parse(JSON.stringify(request)) });
  const linesOf = (context) => {
    const lines = context.uml.text.split('\n');
    const start = lines.indexOf('@layout');
    const end = lines.indexOf('@endlayout');
    return start >= 0 && end > start ? lines.slice(0, start).concat(lines.slice(end + 1)) : lines;
  };
  /** The ref of the line drawn on line `index` for source-map entry `entry`: a message by its drawn route, as the dynamic view's module names it. */
  const lineRef = (entry, index) => (entry.kind === 'message' ? `seqmsg:${index}` : `rel:${index}`);
  /** The options of the drawn boxes (by alias), lines (`rel:<line>`, `seqmsg:<line>`), and fragments (`frag:<line>`). */
  function optionSets(context) {
    const boxes = Object.keys(context.uml.ids).map((alias) => ({ ref: alias, name: alias, description: 'box' }));
    const lines = [];
    const fragments = [];
    context.uml.source.lines.forEach((entry, index) => {
      if (entry === null) return;
      if (['relation', 'message', 'link', 'assembly'].includes(entry.kind)) lines.push({ ref: lineRef(entry, index), name: `line ${index}`, description: 'line' });
      if (entry.kind === 'fragment') fragments.push({ ref: `frag:${index}`, name: `fragment ${index}`, description: 'fragment' });
    });
    return [{ id: 'boxes', label: 'Boxes', options: boxes }, { id: 'lines', label: 'Lines', options: lines }]
      .concat(fragments.length > 0 ? [{ id: 'fragments', label: 'Fragments', options: fragments }] : []);
  }
  /** The step a message line stands for, from the drawing's source map, or null. */
  function stepOf(ref, context) {
    const match = /^(?:rel|seqmsg):(\d+)$/.exec(String(ref));
    const entry = match ? context.uml.source.lines[Number(match[1])] : null;
    return entry && entry.kind === 'message' ? { containerPath: entry.containerPath, index: entry.index } : null;
  }
  function fakeModule(notation, relationTool) {
    return {
      notation,
      editable: true,
      optionSets,
      tools: () => ({ elements: (advice.elements || {})[notation] || [], relations: [relationTool], unavailable: [] }),
      // Every operation is accepted, and its change marks the design: the Billing System's description names the
      // operation, so the host's texts show which operation was applied (the adapter also plans an operation when it
      // only asks whether it would be accepted).
      plan(operation) {
        record(notation, 'plan', operation);
        if ((advice.refuse || {})[operation.op]) return advice.refuse[operation.op];
        const mark = { op: 'setElementField', elementId: 'billing', field: 'description', value: `Applied ${operation.op}` };
        return { kind: 'commands', commands: [mark], label: 'Recorded', select: null, message: null };
      },
      fromForm: () => ({ kind: 'commands', commands: [], label: 'Recorded' }),
      targets(request) {
        record(notation, 'targets', request);
        return (advice.targets || {})[notation] || null;
      },
      menu(ref) {
        return (advice.menu || {})[ref] || null;
      },
      places(ref) {
        record(notation, 'places', { ref });
        return (advice.places || {})[ref] || null;
      },
      holders: (context) => new Set(Object.keys(context.uml.ids)),
      layoutRefusal: () => null,
      selectionOf(ref, context) {
        const step = stepOf(ref, context);
        if (step) return { scenarioId: context.viewModel.scopeId, step };
        const id = context.uml.ids[ref];
        return id && !String(id).includes('@') ? { elementId: id } : null;
      },
      refOf(selection, context) {
        if (selection.step) {
          const found = optionSets(context)[1].options.find((each) => JSON.stringify(stepOf(each.ref, context)) === JSON.stringify(selection.step));
          return found ? found.ref : null;
        }
        // A deployment node is drawn by its node id (`{ environmentId, nodeId }`, spec §7.6).
        const id = selection.nodeId || selection.elementId;
        return Object.keys(context.uml.ids).find((alias) => context.uml.ids[alias] === id) || null;
      },
    };
  }
  parts.umlViews = Object.assign({}, parts.umlViews, {
    'uml-sequence': fakeModule('uml-sequence', { id: 'message', label: 'Message' }),
    'uml-deployment': fakeModule('uml-deployment', { id: 'link', label: 'Link' }),
    'uml-component': fakeModule('uml-component', { id: 'use', label: 'Use an interface' }),
  });
  parts.umlFormFactories = Object.assign({}, parts.umlFormFactories, {
    probe(kit) {
      window.probeKit = kit;
      return () => Promise.resolve(null);
    },
  });
}

/** What the fake of `notation` was asked by `method`, in order. */
const asked = (page, notation, method) => page.evaluate(({ n, m }) => window.fakeViews.asked
  .filter((each) => each.notation === n && each.method === m).map((each) => each.request), { n: notation, m: method });

/**
 * The operations `op` the fake of `notation` was asked to plan. The adapter asks a module both for advice before a
 * change (`can`) and for the change (`apply`), with the same operation, so one gesture may plan it more than once.
 */
const planned = async (page, notation, op) => (await asked(page, notation, 'plan')).filter((each) => each.op === op);

/** The operation `op` the fake of `notation` planned last, once the change it planned is in the host's texts. */
async function lastPlanned(page, notation, op) {
  await expect.poll(async () => (await hostLog(page)).texts.some((text) => text.includes(`description: Applied ${op}\n`)),
    { message: `the ${notation} module's change for ${op} is applied` }).toBe(true);
  return (await planned(page, notation, op)).at(-1);
}

/** Opens an editor on `view` with the recording fakes answering `advice`. */
function openWithFakes(page, view, advice = {}) {
  return openUmlEditor(page, { view, beforeMount: `(${installFakeViews.toString()})(${JSON.stringify(advice)})` });
}

/** The client centre and box of the hit target of `alias` in the session's hit layer. */
function hitBox(editor, alias) {
  return canvas(editor).evaluate((region, { layer, id }) => {
    const rect = region.querySelector(`${layer} .uml-pg-edit-hitbox[data-layout-id="${id}"]`);
    if (!rect) return null;
    const box = rect.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  }, { layer: HIT_LAYER, id: alias });
}

/** The client y of the drawn message whose route is `seqmsg:<line>`. */
function messageY(editor, line) {
  return canvas(editor).evaluate((region, { layer, id }) => {
    const segment = region.querySelector(`${layer} .uml-pg-edge-hitbox[data-route-id="${id}"]`);
    return segment ? segment.getBoundingClientRect().top + segment.getBoundingClientRect().height / 2 : null;
  }, { layer: HIT_LAYER, id: `seqmsg:${line}` });
}

/** The menu named `name` of `editor`, and an item of it. */
const menu = (editor, name) => editor.getByRole('menu', { name });
const menuItem = (within, name) => within.getByRole('menuitem', { name, exact: true });

// The dynamic and deployment drawings of the reference model are wide: on a wide screen every lifeline and node is in
// view at the editor's first magnification, so a drag can reach it.
const WIDE_SCREEN = { width: 1920, height: 1080 };

test.describe('the sequence notation (dynamic views)', () => {
  test.use({ viewport: WIDE_SCREEN });
  test('a message drawn from one lifeline to another at a height reaches the sequence module as relation.add with the anchor of that height', async ({ page }) => {
    const editor = await openWithFakes(page, DYNAMIC);
    const first = lineOf(DYNAMIC, 'web -> coordinator: submits the plan to [JSON/HTTPS]');
    const second = lineOf(DYNAMIC, 'coordinator -> policy: asks for an eligibility decision from');
    const web = await hitBox(editor, 'web');
    const policy = await hitBox(editor, 'policy');
    // Halfway between the first two messages, on the lifelines' bodies below their heads.
    const height = ((await messageY(editor, first)) + (await messageY(editor, second))) / 2;

    await dragBetween(page, { x: web.x, y: height }, { x: policy.x, y: height });

    const added = await lastPlanned(page, 'uml-sequence', 'relation.add');
    expect({ tool: added.tool, from: added.from, to: added.to }).toEqual({ tool: 'message', from: 'web', to: 'policy' });
    expect(added.facts.at, 'the anchor of that height: before the second message').toEqual({ beforeLine: second });
  });

  test('a lifeline head dragged sideways gives lifeline.reorder', async ({ page }) => {
    const editor = await openWithFakes(page, DYNAMIC);
    const policy = await hitBox(editor, 'policy');
    const seats = await hitBox(editor, 'seats');

    await dragBetween(page, { x: policy.x, y: policy.y }, { x: seats.right + 20, y: policy.y });

    const reorder = await lastPlanned(page, 'uml-sequence', 'lifeline.reorder');
    expect(reorder.order).toEqual(['web', 'coordinator', 'seats', 'policy', 'billing_gateway']);
  });

  test('M with Down moves a step through the places the module lists and announces each', async ({ page }) => {
    const step = lineOf(DYNAMIC, 'coordinator -> policy: asks for an eligibility decision from');
    const ref = `seqmsg:${step}`;
    const places = [
      { at: { beforeLine: step - 1 }, label: 'Before step 1' },
      { at: { beforeLine: step }, label: 'After step 1', current: true },
      { at: { beforeLine: step + 2 }, label: 'In alt, branch 1: eligible, at the start' },
      { at: { beforeLine: step + 3 }, label: 'In alt, branch 1: eligible, after step 3' },
    ];
    const editor = await openWithFakes(page, DYNAMIC, { places: { [ref]: places } });
    await option(editor, `line ${step}`).focus();

    await page.keyboard.press('m');
    await expect(messageRegion(editor)).toContainText('Moving line');
    await page.keyboard.press('ArrowDown');
    await expect(messageRegion(editor), 'the first press goes to the place after the current one').toContainText(places[2].label);
    await page.keyboard.press('ArrowDown');
    await expect(messageRegion(editor)).toContainText(places[3].label);
    expect((await hostLog(page)).texts, 'the keys only choose a place').toEqual([]);
    await page.keyboard.press('Enter');

    const moved = await lastPlanned(page, 'uml-sequence', 'message.move');
    expect({ ref: moved.ref, at: moved.at }).toEqual({ ref, at: places[3].at });
    await expect(option(editor, `line ${step}`), 'focus stays on the moved step').toBeFocused();
  });

  test('a fragment\'s menu "Remove branch 2" gives fragment.removeBranch', async ({ page }) => {
    const fragment = `frag:${lineOf(DYNAMIC, 'alt [eligible]')}`;
    const editor = await openWithFakes(page, DYNAMIC, {
      menu: { [fragment]: [{ label: 'Remove branch 2', operation: { op: 'fragment.removeBranch', ref: fragment, branch: 1 } }] },
    });
    await option(editor, `fragment ${lineOf(DYNAMIC, 'alt [eligible]')}`).focus();

    await page.keyboard.press('Shift+F10');
    await menuItem(menu(editor, `Actions for fragment ${lineOf(DYNAMIC, 'alt [eligible]')}`), 'Remove branch 2').click();

    const removal = await lastPlanned(page, 'uml-sequence', 'fragment.removeBranch');
    expect({ ref: removal.ref, branch: removal.branch }).toEqual({ ref: fragment, branch: 1 });
  });
});

test.describe('the deployment notation', () => {
  test.use({ viewport: WIDE_SCREEN });
  test('a node dragged onto a node marked possible gives element.reparent, and onto an unmarked node changes nothing', async ({ page }) => {
    const advice = { targets: { 'uml-deployment': [{ ref: 'data_centre', ok: true }, { ref: 'laptop', ok: false, code: 'fake/refused' }] } };
    const editor = await openWithFakes(page, DEPLOYMENT, advice);
    const apiPod = await hitBox(editor, 'api_pod');
    const browser = await hitBox(editor, 'browser');

    // Pressed and dropped in a node's top-left corner: the middle of its top edge is where a link line arrives.
    const corner = (box) => ({ x: box.left + 16, y: box.top + 8 });
    // Onto browser, which the advice does not name: the preview goes back and nothing is asked to change.
    await dragBetween(page, corner(apiPod), corner(browser));
    await expect.poll(async () => (await asked(page, 'uml-deployment', 'targets')).length, { message: 'the drag asks for its targets once' }).toBe(1);
    expect((await hostLog(page)).texts, 'nothing changes').toEqual([]);

    const dataCentre = await hitBox(editor, 'data_centre');
    const again = await hitBox(editor, 'api_pod');
    await dragBetween(page, corner(again), corner(dataCentre));

    const reparent = await lastPlanned(page, 'uml-deployment', 'element.reparent');
    expect({ ref: reparent.ref, parent: reparent.parent }).toEqual({ ref: 'api_pod', parent: 'data_centre' });
  });
});

test.describe('the component notation (interfaces views)', () => {
  test('a line drawn from a consumer to a ball marks the possible balls and gives relation.add', async ({ page }) => {
    const advice = { targets: { 'uml-component': [{ ref: 'p1', ok: true }, { ref: 'p2', ok: true }, { ref: 'e3', ok: false, code: 'fake/refused' }] } };
    const editor = await openWithFakes(page, INTERFACES, advice);
    await option(editor, 'e1').focus();

    await page.keyboard.press('c');

    const marks = await canvas(editor).evaluate((region, layer) => [...region.querySelectorAll(`${layer} .uml-pg-target-mark`)]
      .map((mark) => ({ id: mark.getAttribute('data-target-ref'), possible: mark.classList.contains('is-possible') })), HIT_LAYER);
    expect(marks.filter((mark) => mark.possible).map((mark) => mark.id).sort(), 'both balls are marked possible').toEqual(['p1', 'p2']);
    expect(marks.filter((mark) => !mark.possible).map((mark) => mark.id)).toEqual(['e3']);
    const ball = await hitBox(editor, 'p1');
    await page.mouse.click(ball.x, ball.y);

    const added = await lastPlanned(page, 'uml-component', 'relation.add');
    expect({ tool: added.tool, from: added.from, to: added.to }).toEqual({ tool: 'use', from: 'e1', to: 'p1' });
  });
});

test.describe('what every V-lane form and the step selection use', () => {
  test('openAnchoredForm anchors at its place, returns focus on Escape, and resolves null', async ({ page }) => {
    const editor = await openWithFakes(page, DYNAMIC);
    // The leftmost lifeline: a form below or above it fits without being pushed back inside the viewport.
    const anchor = option(editor, 'web');
    await anchor.focus();

    await page.evaluate(() => {
      const kit = window.probeKit;
      const field = kit.dom.el('input', { type: 'text', 'aria-label': 'Probe field' });
      const opener = document.activeElement;
      window.probeResult = kit.actions.openAnchoredForm({
        body: field, title: 'Probe form', placement: { anchor: opener }, returnFocus: opener, onSubmit: () => ({ ok: true }),
      }).then((values) => ({ settled: true, values }));
    });
    const dialog = page.getByRole('dialog', { name: 'Probe form' });
    await expect(dialog).toBeVisible();
    const [placed, at] = [await dialog.boundingBox(), await anchor.boundingBox()];
    if (!placed || !at) throw new Error('the form and its anchor are drawn');
    // Beside its anchor: just below it, or just above it when the viewport has no room below (the editor's popups).
    const gapBelow = placed.y - (at.y + at.height);
    const gapAbove = at.y - (placed.y + placed.height);
    expect([gapBelow, gapAbove].some((gap) => gap >= 0 && gap <= ANCHOR_GAP_PX), `the form touches its anchor (gaps ${gapBelow}, ${gapAbove})`).toBe(true);
    expect(Math.abs(placed.x - at.x), 'the form starts where its anchor starts').toBeLessThanOrEqual(1);

    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(anchor, 'focus returns to the option that opened the form').toBeFocused();
    expect(await page.evaluate(() => window.probeResult)).toEqual({ settled: true, values: null });
  });

  test('selecting a step option selects { scenarioId, step } in the state, and the outline reveals it', async ({ page }) => {
    const editor = await openWithFakes(page, DYNAMIC);
    const step = lineOf(DYNAMIC, 'coordinator -> policy: asks for an eligibility decision from');

    await option(editor, `line ${step}`).focus();

    const expected = { scenarioId: 'enroll', step: { containerPath: [], index: 1 } };
    await expect.poll(async () => (await hostLog(page)).selections.at(-1)).toEqual(expected);
    const scenario = C4.load(INTERFACES_REFERENCE).model.scenarios.get('enroll');
    const outline = editor.getByRole('tree');
    await expect(outline.getByRole('treeitem', { name: new RegExp(`^${scenario.title}`) }), 'the outline marks the step\'s scenario')
      .toHaveAttribute('aria-selected', 'true');
    const revealed = editor.getByRole('region', { name: 'Inspector' }).locator('[aria-current="true"]');
    await expect(revealed, 'the inspector hands the step to the scenario form, which marks its row').toHaveCount(1);
    await expect(revealed.getByRole('combobox', { name: 'Receiver of step 2', exact: true })).toBeVisible();
  });
});

// ---- What the host does with every drawing and every verdict (Task 42b, Ruling U12) ---------------------------------

const callEditor = (page, method, ...args) => page.evaluate(({ name, values }) => window.c4Editors.editor[name](...values), { name: method, values: args });

test.describe('lines, offers, and Enter on every UML notation', () => {
  test.use({ viewport: WIDE_SCREEN });

  test('messages a sequence module names by their drawn routes (seqmsg:<line>) are options, and focusing one selects its step', async ({ page }) => {
    const editor = await openWithFakes(page, DYNAMIC);
    const messages = C4.toUml(C4.project(C4.load(INTERFACES_REFERENCE), DYNAMIC)).source.lines
      .map((entry, index) => (entry && entry.kind === 'message' ? index : null)).filter((index) => index !== null);

    for (const line of messages) await expect(option(editor, `line ${line}`), `the message on line ${line} has its option`).toHaveCount(1);
    await option(editor, `line ${messages[1]}`).focus();

    await expect.poll(async () => (await hostLog(page)).selections.at(-1)).toEqual({ scenarioId: 'enroll', step: { containerPath: [], index: 1 } });
  });

  /**
   * An editor on the dynamic view whose fake refuses deleting the alt (Delete on its option, `selection.remove`) with an
   * offer to unwrap it instead, and the unwrap operation the offer carries.
   */
  async function refusedWithOffer(page) {
    const fragment = `frag:${lineOf(DYNAMIC, 'alt [eligible]')}`;
    const unwrap = { op: 'fragment.unwrap', ref: fragment };
    const editor = await openWithFakes(page, DYNAMIC, {
      refuse: { 'selection.remove': { kind: 'refuse', code: 'fake/refused', summary: 'Refused by the fake', message: 'The fake refused it.',
        offer: { label: 'Unwrap instead', operation: unwrap } } },
    });
    await option(editor, `fragment ${lineOf(DYNAMIC, 'alt [eligible]')}`).focus();
    await page.keyboard.press('Delete');
    await expect(messageRegion(editor)).toContainText('The fake refused it.');
    return { editor, unwrap, offer: messageRegion(editor).getByRole('button', { name: 'Unwrap instead', exact: true }) };
  }

  test('a refusal\'s offer that carries an operation is a button that applies the operation, as of the drawing it was refused on', async ({ page }) => {
    const { unwrap, offer } = await refusedWithOffer(page);
    const refused = (await planned(page, 'uml-sequence', 'selection.remove')).at(-1);

    await offer.click();

    const applied = await lastPlanned(page, 'uml-sequence', 'fragment.unwrap');
    expect(applied).toEqual(Object.assign({}, unwrap, { revision: refused.revision }));
    expect((await hostLog(page)).texts, 'one change').toHaveLength(1);
  });

  test('an offer made on a drawing that has changed since is gone with its message, so the module is not asked to apply it', async ({ page }) => {
    // The offer's operation names things by the lines of the drawing it was refused on (frag:<line>), so it applies
    // only to that drawing; the adapter would refuse it as stale on another (uml-adapter.test.js).
    const { offer } = await refusedWithOffer(page);
    const changed = INTERFACES_REFERENCE.replace('submits the plan to', 'sends the plan to');

    await callEditor(page, 'setText', changed);

    await expect(offer).toHaveCount(0);
    expect(await planned(page, 'uml-sequence', 'fragment.unwrap'), 'the module is not asked to unwrap').toEqual([]);
    expect(await callEditor(page, 'getText')).toBe(changed);
  });

  const inspector = (editor) => editor.getByRole('region', { name: 'Inspector' });
  const inspectorToggle = (editor) => inspector(editor).getByRole('button', { name: 'Inspector', exact: true });

  /**
   * An editor on the deployment view, its inspector collapsed, whose fake refuses deleting the ingress node (Delete on
   * its option) with an offer that shows `selection` (a host action, as the deployment refusals' show-link and
   * show-relationship offers are), and the offer's button.
   */
  async function refusedWithSelectOffer(page, selection) {
    const editor = await openWithFakes(page, DEPLOYMENT, {
      refuse: { 'element.remove': { kind: 'refuse', code: 'fake/refused', summary: 'Refused by the fake', message: 'The fake refused it.',
        offer: { label: 'Show it', select: selection } } },
    });
    await inspectorToggle(editor).click();
    await expect(inspectorToggle(editor)).toHaveAttribute('aria-expanded', 'false');
    await option(editor, 'ingress').focus();
    await page.keyboard.press('Delete');
    await expect(messageRegion(editor)).toContainText('The fake refused it.');
    return { editor, offer: messageRegion(editor).getByRole('button', { name: 'Show it', exact: true }) };
  }

  test('a refusal\'s offer that shows a drawn selection selects it, shows it in the inspector, and focuses its option', async ({ page }) => {
    const node = { environmentId: 'production', nodeId: 'data-centre' };
    const { editor, offer } = await refusedWithSelectOffer(page, node);

    await offer.click();

    await expect.poll(async () => (await hostLog(page)).selections.at(-1), { message: 'the offer selects the node' }).toEqual(node);
    await expect(option(editor, 'data_centre'), 'focus goes to the shown node\'s option (spec §7.7)').toBeFocused();
    await expect(inspectorToggle(editor), 'the inspector is revealed').toHaveAttribute('aria-expanded', 'true');
    await expect(inspector(editor).getByRole('textbox', { name: 'Name', exact: true }).first(), 'the inspector shows the node')
      .toHaveValue('University data center');
    expect((await hostLog(page)).texts, 'showing changes nothing').toHaveLength(0);
  });

  test.describe('in the stacked layout of a narrow screen', () => {
    test.use({ viewport: { width: 320, height: 640 } });

    test('the option a shown selection focuses stays in view after the inspector below the canvas is revealed', async ({ page }) => {
      // Spec §7.7: every focus move reveals its target; the inspector's reveal must not scroll the focused option away.
      const node = { environmentId: 'production', nodeId: 'data-centre' };
      const { editor, offer } = await refusedWithSelectOffer(page, node);

      await offer.click();

      await expect(option(editor, 'data_centre')).toBeFocused();
      await expect(option(editor, 'data_centre'), 'the focused option is in view').toBeInViewport();
    });
  });

  test('a refusal\'s offer that shows a selection this view does not draw shows it in the inspector, and focus goes back where it was', async ({ page }) => {
    const { editor, offer } = await refusedWithSelectOffer(page, { elementId: 'student' });

    await offer.click();

    await expect.poll(async () => (await hostLog(page)).selections.at(-1), { message: 'the offer selects the person' }).toEqual({ elementId: 'student' });
    await expect(inspectorToggle(editor), 'the inspector is revealed').toHaveAttribute('aria-expanded', 'true');
    await expect(inspector(editor).getByRole('textbox', { name: 'Name', exact: true }).first(), 'the inspector shows the person')
      .toHaveValue('Student');
    await expect(option(editor, 'ingress'), 'focus goes back to the option the refused Delete was pressed on').toBeFocused();
  });

  test('in an interfaces view only an option whose Enter opens nothing says so: a neighbour\'s keeps its module\'s words, the subject\'s says nothing to open', async ({ page }) => {
    // Enter on a neighbour opens its interfaces view, which the view module's description names ("Enter shows its
    // interfaces"; the fake says only "box"); Enter on the subject opens nothing, as this is its view.
    const ids = C4.toUml(C4.project(C4.load(INTERFACES_REFERENCE), INTERFACES)).ids;
    const aliasOf = (id) => Object.keys(ids).find((alias) => ids[alias] === id);
    const editor = await openWithFakes(page, INTERFACES);

    await expect(option(editor, aliasOf('web'))).toHaveAccessibleDescription('box');
    await expect(option(editor, aliasOf('api'))).toHaveAccessibleDescription('box; Enter: nothing to open');
  });

  test('in a code view Enter on a class still opens nothing, and its option says so', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: 'code of policy' });

    await expect(option(editor, 'EnrollmentPolicy')).toHaveAccessibleDescription(/; Enter: nothing to open$/);
  });
});

// ---- The host's ways in without a drag (Task 42c, Ruling U12; spec §3.11, §7.4, WCAG 2.5.7) -------------------------

const paletteTool = (editor, name) => editor.getByRole('group', { name: 'Add to the diagram', exact: true }).getByRole('button', { name, exact: true });

/** The client point on the dashed line of lifeline `alias`, at client height `y` (below its head). */
async function onLifeline(editor, alias, y) {
  const head = await hitBox(editor, alias);
  return { x: head.x, y };
}

/** The client height halfway between the first two drawn messages of the dynamic view. */
async function betweenFirstTwoSteps(editor) {
  const first = lineOf(DYNAMIC, 'web -> coordinator: submits the plan to [JSON/HTTPS]');
  const second = lineOf(DYNAMIC, 'coordinator -> policy: asks for an eligibility decision from');
  return { height: ((await messageY(editor, first)) + (await messageY(editor, second))) / 2, second };
}

test.describe('palette tools, the place of an addition, and the keys of a step or lifeline', () => {
  test.use({ viewport: WIDE_SCREEN });

  test('a line tool of the palette, then a press on one lifeline and one on another at a height, gives relation.add with the anchor of that height', async ({ page }) => {
    const editor = await openWithFakes(page, DYNAMIC, { targets: { 'uml-sequence': [{ ref: 'policy', ok: true }] } });
    const { height, second } = await betweenFirstTwoSteps(editor);

    await paletteTool(editor, 'Message').click();
    await expect(messageRegion(editor)).toContainText('Message: click the sender\'s lifeline, then the receiver\'s at the height of the step.');
    const web = await onLifeline(editor, 'web', height);
    await page.mouse.click(web.x, web.y);
    const policy = await onLifeline(editor, 'policy', height);
    await page.mouse.click(policy.x, policy.y);

    const added = await lastPlanned(page, 'uml-sequence', 'relation.add');
    expect({ tool: added.tool, from: added.from, to: added.to, at: added.at })
      .toEqual({ tool: 'message', from: 'web', to: 'policy', at: { beforeLine: second } });
  });

  test('a line tool of the palette, then a click on a node and a click on another, gives relation.add between them', async ({ page }) => {
    const editor = await openWithFakes(page, DEPLOYMENT, { targets: { 'uml-deployment': [{ ref: 'browser', ok: true }] } });

    await paletteTool(editor, 'Link').click();
    const corner = (box) => ({ x: box.left + 16, y: box.top + 8 });
    const apiPod = corner(await hitBox(editor, 'api_pod'));
    await page.mouse.click(apiPod.x, apiPod.y);
    const browser = corner(await hitBox(editor, 'browser'));
    await page.mouse.click(browser.x, browser.y);

    const added = await lastPlanned(page, 'uml-deployment', 'relation.add');
    expect({ tool: added.tool, from: added.from, to: added.to }).toEqual({ tool: 'link', from: 'api_pod', to: 'browser' });
  });

  test('the Fragment tool opens its operators; one chosen, a click at a height adds that fragment there', async ({ page }) => {
    const editor = await openWithFakes(page, DYNAMIC, { elements: { 'uml-sequence': [{ id: 'fragment', label: 'Fragment', operators: ['opt', 'loop'] }] } });
    const { height, second } = await betweenFirstTwoSteps(editor);

    await paletteTool(editor, 'Fragment').click();
    await expect(menu(editor, 'Fragment').getByRole('menuitem')).toHaveText(['opt', 'loop']);
    await menuItem(menu(editor, 'Fragment'), 'opt').click();
    const coordinator = await onLifeline(editor, 'coordinator', height);
    await page.mouse.click(coordinator.x, coordinator.y);

    const added = await lastPlanned(page, 'uml-sequence', 'element.add');
    expect({ tool: added.tool, anchor: added.anchor }).toEqual({ tool: 'opt', anchor: { beforeLine: second } });
  });

  test('a tile chosen with a node selected asks whether the new node goes inside it or at the top level', async ({ page }) => {
    // The deployment view's own module: it asks this when the addition names the node it goes into (spec §7.4).
    const editor = await openUmlEditor(page, { view: DEPLOYMENT });
    await option(editor, 'University data center').focus();

    await paletteTool(editor, 'Node').click();

    await expect(editor.getByRole('button', { name: 'Inside University data center' }).or(editor.getByRole('menuitem', { name: 'Inside University data center' }))).toBeVisible();
    expect((await hostLog(page)).texts, 'nothing is added before the answer').toEqual([]);
  });

  test('A, then a tool, with a step focused adds after that step, in its list', async ({ page }) => {
    const step = lineOf(DYNAMIC, 'coordinator -> policy: asks for an eligibility decision from');
    const editor = await openWithFakes(page, DYNAMIC, { elements: { 'uml-sequence': [{ id: 'note', label: 'Note' }] } });
    await option(editor, `line ${step}`).focus();

    await page.keyboard.press('a');
    await menuItem(menu(editor, 'Add'), 'Note').click();

    const added = await lastPlanned(page, 'uml-sequence', 'element.add');
    expect({ tool: added.tool, at: added.at }).toEqual({ tool: 'note', at: { containerPath: [], index: 2 } });
  });

  test('C on a step asks the module for a message with open ends at the place after that step', async ({ page }) => {
    const step = lineOf(DYNAMIC, 'coordinator -> policy: asks for an eligibility decision from');
    const editor = await openWithFakes(page, DYNAMIC);
    await option(editor, `line ${step}`).focus();

    await page.keyboard.press('c');

    const added = await lastPlanned(page, 'uml-sequence', 'relation.add');
    expect({ tool: added.tool, from: added.from, to: added.to, at: added.at })
      .toEqual({ tool: 'message', from: null, to: null, at: { containerPath: [], index: 2 } });
  });

  test('M on a lifeline, then Left, chooses the module\'s "Move left", and Enter applies it', async ({ page }) => {
    const left = { op: 'lifeline.reorder', order: ['coordinator', 'policy', 'seats', 'billing_gateway', 'web'], moved: 'coordinator' };
    const right = { op: 'lifeline.reorder', order: ['web', 'policy', 'coordinator', 'seats', 'billing_gateway'], moved: 'coordinator' };
    const editor = await openWithFakes(page, DYNAMIC, { menu: { coordinator: [
      { label: 'Move left', operation: left }, { label: 'Move right', operation: right },
    ] } });
    await option(editor, 'coordinator').focus();

    await page.keyboard.press('m');
    await page.keyboard.press('ArrowLeft');
    await expect(messageRegion(editor)).toContainText('Move left');
    expect((await hostLog(page)).texts, 'the keys only choose').toEqual([]);
    await page.keyboard.press('Enter');

    const reorder = await lastPlanned(page, 'uml-sequence', 'lifeline.reorder');
    expect({ order: reorder.order, moved: reorder.moved }).toEqual({ order: left.order, moved: 'coordinator' });
    await expect(option(editor, 'coordinator'), 'focus stays on the moved lifeline').toBeFocused();
  });

  test('a message\'s menu has no bend items', async ({ page }) => {
    const step = lineOf(DYNAMIC, 'coordinator -> policy: asks for an eligibility decision from');
    const editor = await openWithFakes(page, DYNAMIC);
    await option(editor, `line ${step}`).focus();

    await page.keyboard.press('Shift+F10');

    const items = menu(editor, `Actions for line ${step}`).getByRole('menuitem');
    await expect(items.first()).toBeVisible();
    expect((await items.allTextContents()).filter((label) => /bend|Straighten/.test(label))).toEqual([]);
  });
});

test.describe('the "⋯" button, the right-click menu, and Add relationship on a UML view', () => {
  // Wide enough that the fitted code view leaves room on the canvas right of the drawing.
  test.use({ viewport: WIDE_SCREEN });
  const CODE = 'code of policy';
  const moreButton = (editor, name) => canvas(editor).getByRole('button', { name: `Actions for ${name}`, exact: true });

  test('the one selected box shows a "⋯" button of at least 24 by 24 px, named for it, out of the tab order and clear of every hit target', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE });
    await option(editor, 'EnrollmentPolicy').focus();

    const more = moreButton(editor, 'EnrollmentPolicy');
    await expect(more).toBeVisible();
    await expect(more).toHaveAttribute('tabindex', '-1');
    const box = await more.boundingBox();
    if (!box) throw new Error('the button is drawn');
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);
    const overlapped = await canvas(editor).evaluate((region, { layer, button }) => [...region.querySelectorAll(`${layer} .uml-pg-edit-hitbox`)]
      .map((hit) => hit.getBoundingClientRect())
      .filter((hit) => hit.left < button.x + button.width && button.x < hit.right && hit.top < button.y + button.height && button.y < hit.bottom).length,
    { layer: HIT_LAYER, button: box });
    expect(overlapped, 'the button lies on no box\'s hit target').toBe(0);

    await more.click();
    await expect(menu(editor, 'Actions for EnrollmentPolicy')).toBeVisible();
  });

  test('"Draw a line" from the "⋯" menu, then one click on the target, offers the kinds that fit and draws the chosen one', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE });
    const lines = (within) => elements(within).getByRole('group', { name: 'Lines', exact: true }).getByRole('option');
    const linesBefore = await lines(editor).count();
    await option(editor, 'EnrollmentPolicy').focus();

    await moreButton(editor, 'EnrollmentPolicy').click();
    await menuItem(menu(editor, 'Actions for EnrollmentPolicy'), 'Draw a line').click();
    const target = await hitBox(editor, 'EnrollmentRule');
    await page.mouse.click(target.x, target.y);
    await menuItem(menu(editor, 'Draw a line from EnrollmentPolicy to EnrollmentRule'), 'Realization').click();

    await expect.poll(async () => (await hostLog(page)).texts.length, { message: 'the line is one change' }).toBe(1);
    await expect(lines(editor), 'the drawing has the new line').toHaveCount(linesBefore + 1);
  });

  test('a right-click on a box opens the same menu as its "⋯" button', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE });
    const box = await hitBox(editor, 'EnrollmentPolicy');

    await page.mouse.click(box.x, box.y, { button: 'right' });

    await expect(menu(editor, 'Actions for EnrollmentPolicy')).toBeVisible();
    await expect(menuItem(menu(editor, 'Actions for EnrollmentPolicy'), 'Draw a line')).toBeVisible();
  });

  test('Add relationship on a UML view starts drawing a line from the selected box', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE });
    await option(editor, 'EnrollmentPolicy').focus();

    await editor.getByRole('button', { name: 'Add relationship', exact: true }).click();

    await expect(messageRegion(editor)).toContainText('Drawing a line from EnrollmentPolicy');
  });

  test('"Move…", then a click on the canvas outside the drawing, moves the box there', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE });
    await editor.getByRole('button', { name: 'Fit', exact: true }).click();
    await option(editor, 'EnrollmentPolicy').focus();
    await page.keyboard.press('Shift+F10');
    await menuItem(menu(editor, 'Actions for EnrollmentPolicy'), 'Move…').click();

    const outside = await canvas(editor).evaluate((region) => {
      const drawing = region.querySelector('svg').getBoundingClientRect();
      const frame = region.getBoundingClientRect();
      return { x: Math.min(drawing.right + 40, frame.right - 20), y: (drawing.top + drawing.bottom) / 2, beyond: drawing.right + 40 < frame.right - 20 };
    });
    expect(outside.beyond, 'the canvas has room right of the drawing').toBe(true);
    await page.mouse.click(outside.x, outside.y);

    await expect.poll(async () => (await hostLog(page)).texts.length, { message: 'the move is one change' }).toBe(1);
    await expect(messageRegion(editor)).toContainText(/^Moved EnrollmentPolicy/);
  });

  test('a plain click on a ball selects its interface and refuses nothing', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: INTERFACES });
    const ball = await hitBox(editor, 'p1');

    await page.mouse.click(ball.x, ball.y);

    await expect.poll(async () => (await hostLog(page)).selections.at(-1), { message: 'the click selects the interface' }).toEqual({ interfaceId: 'enrollment-api' });
    await expect(messageRegion(editor)).not.toContainText('Not done');
  });
});

test.describe('accessibility of the "⋯" button, its menu, and Move mode', () => {
  for (const width of [320, 1440]) {
    test(`auditInteractiveState with the "⋯" button shown, its menu open, and a move running, in light and dark mode, at ${width} CSS px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const editor = await openUmlEditor(page, { view: 'code of policy', siteThemes: true });
      const audit = (state) => auditInteractiveState(page, `C4 editor code view ${state} at ${width} px`, { include: '#editor' });
      await option(editor, 'EnrollmentPolicy').focus();

      const more = canvas(editor).getByRole('button', { name: 'Actions for EnrollmentPolicy', exact: true });
      await expect(more).toBeAttached();
      await audit('with the "⋯" button shown');
      await more.click();
      await expect(menu(editor, 'Actions for EnrollmentPolicy')).toBeVisible();
      await audit('with the box menu open');
      await menuItem(menu(editor, 'Actions for EnrollmentPolicy'), 'Move…').click();
      await expect(messageRegion(editor)).toContainText('Moving EnrollmentPolicy');
      await audit('during a move');
    });
  }
});
