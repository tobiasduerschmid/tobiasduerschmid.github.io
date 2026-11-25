'use strict';

// The listbox over the C4 editor's UML-notation views (UML-view editing spec §7.2, §7.3). A view module, registered
// at `ArchUMLC4EditorParts.umlViews[notation]`, gives the option sets of its view; the generalized overlay
// `ArchUMLC4EditorParts.overlay.attachUml(svg, viewModel, sets, options)` lays them over the delegated drawing as the
// listbox "Elements in this view" and finds each option's box with the bundle's lookup, so class boxes, which carry
// `data-layout-bounds-id` and no `data-layout-id`, are found like the others. The listbox group carries
// `data-layout-ignore`, so the bundle's route and obstacle collectors read the drawing as if it were not there. The
// canvas lays the listbox only when the view's module gives option sets: a UML view without a module, or whose module
// gives none, is drawn with no listbox.
//
// The pages load the editor stylesheet, the ArchUML bundle, and the scripts the C4 manifest lists, in order. A figure
// is drawn as the canvas draws it (`renderDelegatedView`, then named by its brief description); an editor is mounted
// with `ArchUMLC4Editor.mount`. Facts about the model (names, types, roles) come from the C4 core; the listbox is read
// through Chromium's accessibility tree.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const ARCHUML = path.join(__dirname, '../../js/ArchUML');
const core = require('../../js/ArchUML/c4/c4-core.js');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const STYLESHEET = path.join(ARCHUML, 'css/c4-editor.css');
// The reference model with its interfaces: the Planner Web App uses the Registration API's Enrollment API, and the
// Registration API uses the Billing System's Tuition Charges.
const MODEL = fs.readFileSync(path.join(ARCHUML, 'tests/c4/fixtures/course-registration-interfaces.yml'), 'utf8');
const DESIGN = core.load(MODEL);
// The same model where Tuition Charges takes its provider's id, as an interface may (C4 spec §4.11): the Billing System
// and the ball and socket of Tuition Charges then stand for the one id `billing`.
const SHARED_ID_MODEL = MODEL.replace(/tuition-charges/g, 'billing');
// The UML-notation view of each notation in the model.
const UML_VIEWS = { 'uml-class': 'code of policy', 'uml-deployment': 'deployment production', 'uml-sequence': 'dynamic enroll', 'uml-component': 'interfaces of api' };
// The view modules of the four UML notations; a page can be loaded without them.
const VIEW_MODULE = /^c4\/editor\/c4-editor-uml-(code|deployment|dynamic|interfaces)\.js$/;
const LISTBOX_NAME = 'Elements in this view';
const MINIMUM_TARGET_PX = 24;

// Option sets the tests lay over a drawing, built in the page from `window.drawn` (see drawFigure).
const SET_BUILDERS = `window.optionSetsFor = {
  // Every class of a code view by its drawn alias, as the code view's module will give them.
  classes({ viewModel, uml }) {
    const aliasOf = Object.fromEntries(Object.entries(uml.ids).map(([alias, id]) => [id, alias]));
    return [{
      id: 'code-elements', label: 'Code elements of Enrollment Policy',
      options: viewModel.uml.classes.map((entry) => ({ ref: aliasOf[entry.id], name: entry.name, description: entry.kind })),
    }];
  },
  // The classes, one option whose box is not drawn among them, and a set whose only option is not drawn.
  classesAndUndrawn(drawn) {
    const [classes] = window.optionSetsFor.classes(drawn);
    return [
      Object.assign({}, classes, { options: classes.options.concat({ ref: 'NotDrawn', name: 'Not drawn', description: 'class' }) }),
      { id: 'elsewhere', label: 'Not drawn either', options: [{ ref: 'AlsoNotDrawn', name: 'Also not drawn', description: 'class' }] },
    ];
  },
  // What the interfaces view's module gives for the drawn view.
  interfaces({ context }) {
    return window.ArchUMLC4EditorParts.umlViews['uml-component'].optionSets(context);
  },
};`;

let browser;
before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
});
after(async () => { if (browser) await browser.close(); });

/**
 * A page with the editor stylesheet, the bundle, and the manifest's core, render, and editor scripts (without the view
 * modules when `withoutViewModules`), and the test's option sets. `run(page, errors)` gets every uncaught error of the
 * page in `errors`.
 */
async function withPage({ withoutViewModules = false } = {}, run) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.setContent('<!doctype html><html lang="en"><title>C4 UML overlay test</title><body>'
      + '<main class="c4-editor"><div id="figure"></div></main><div id="editor"></div></body></html>');
    await page.addStyleTag({ path: STYLESHEET });
    const editorScripts = MANIFEST.editor.filter((file) => !(withoutViewModules && VIEW_MODULE.test(file)));
    for (const file of ['uml-bundle.js', ...MANIFEST.core, ...MANIFEST.render, ...editorScripts]) {
      await page.addScriptTag({ path: path.join(ARCHUML, file) });
    }
    await page.addScriptTag({ content: SET_BUILDERS });
    await run(page, errors);
  } finally {
    await context.close();
  }
}

// ---- A figure with the overlay ---------------------------------------------------------------------------------

/**
 * Draws view `selector` of `text` (default: the model) into `#figure` as the canvas does: through
 * `renderDelegatedView`, then named by its brief description. Keeps `{ viewModel, uml, svg, context }` as
 * `window.drawn`, where `context` is what a view module reads.
 */
function drawFigure(page, selector, text = MODEL) {
  return page.evaluate(({ source, viewSelector }) => {
    const design = window.ArchUMLC4.load(source);
    const viewModel = window.ArchUMLC4.project(design, viewSelector);
    const container = document.getElementById('figure');
    const { uml } = window.ArchUMLC4Render.renderDelegatedView(container, viewModel, {});
    window.UMLShared.applySvgAccessibility(container, 'c4', null, window.ArchUMLC4.describe(viewModel).brief);
    window.drawn = {
      viewModel, uml, svg: container.querySelector('svg'),
      context: { design, viewModel, uml, profile: 'expert', layout: viewModel.layout },
    };
  }, { source: text, viewSelector: selector });
}

/** Lays the sets `window.optionSetsFor[sets]` over the figure with `attachUml`; keeps the result as `window.overlay`. */
function attachUml(page, sets, options = {}) {
  return page.evaluate(({ builder, settings }) => {
    const { svg, viewModel } = window.drawn;
    window.overlay = window.ArchUMLC4EditorParts.overlay.attachUml(svg, viewModel, window.optionSetsFor[builder](window.drawn),
      Object.assign({ instanceId: 'uml-1', within: document.getElementById('figure') }, settings));
  }, { builder: sets, settings: options });
}

/**
 * The listbox as assistive technology sees it, from Chromium's accessibility tree: each option's name, description,
 * the name of the group set that holds it, and the name of its listbox.
 */
async function listboxOptions(page) {
  const session = await page.context().newCDPSession(page);
  try {
    const { nodes } = await session.send('Accessibility.getFullAXTree');
    const byId = new Map(nodes.map((node) => [node.nodeId, node]));
    const role = (node) => node.role && node.role.value;
    const text = (property) => (property && property.value) || '';
    const containerOf = (node, wanted) => {
      for (let parent = byId.get(node.parentId); parent; parent = byId.get(parent.parentId)) {
        if (wanted.includes(role(parent))) return parent;
      }
      return null;
    };
    return nodes.filter((node) => role(node) === 'option' && !node.ignored).map((node) => {
      const holder = containerOf(node, ['group', 'listbox']);
      return {
        name: text(node.name),
        description: text(node.description),
        set: holder && role(holder) === 'group' ? text(holder.name) : '',
        listbox: text((containerOf(node, ['listbox']) || {}).name),
      };
    });
  } finally {
    await session.detach();
  }
}

/** `{ set name: [option names, sorted] }`. */
function namesBySet(options) {
  const sets = {};
  options.forEach((option) => { (sets[option.set] = sets[option.set] || []).push(option.name); });
  Object.values(sets).forEach((names) => names.sort());
  return sets;
}

/** What a press at the centre of the drawn box of class `alias` reaches: its option, or which part of the drawing. */
function pressedAtClassCentre(page, alias) {
  return page.evaluate((ref) => {
    const box = window.drawn.svg.querySelector(`[data-layout-bounds-id="${ref}"]`).getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return { option: hit && hit.getAttribute('role') === 'option' ? hit.getAttribute('data-c4-option') : null, inDrawing: window.drawn.svg.contains(hit) };
  }, alias);
}

const CLASSES = core.project(DESIGN, 'code of policy').uml.classes;
const CLASS_IDS = CLASSES.map((entry) => entry.id);
const CLASS_NAMES = CLASSES.map((entry) => entry.name).sort();
const CLASS_SET = 'Code elements of Enrollment Policy';

test('attachUml finds class boxes by data-layout-bounds-id', async () => {
  await withPage({}, async (page) => {
    await drawFigure(page, 'code of policy');
    const hooks = await page.evaluate(() => ({
      layoutIds: [...window.drawn.svg.querySelectorAll('[data-layout-id]')].map((node) => node.getAttribute('data-layout-id')),
      boundsIds: [...window.drawn.svg.querySelectorAll('[data-layout-bounds-id]')].map((node) => node.getAttribute('data-layout-bounds-id')),
    }));
    assert.deepEqual(hooks.layoutIds, [], 'the class boxes carry no data-layout-id');
    assert.deepEqual(hooks.boundsIds.sort(), [...CLASS_IDS].sort(), 'each class box carries data-layout-bounds-id');

    await attachUml(page, 'classes');

    const options = await page.evaluate(() => [...window.drawn.svg.querySelectorAll('[role="option"]')].map((option) => {
      const ref = option.getAttribute('data-c4-option');
      const box = window.drawn.svg.querySelector(`[data-layout-bounds-id="${ref}"]`).getBoundingClientRect();
      const target = option.getBoundingClientRect();
      const covers = target.left <= box.left && target.top <= box.top && target.right >= box.right && target.bottom >= box.bottom;
      const centred = Math.abs(target.left + target.right - box.left - box.right) < 1 && Math.abs(target.top + target.bottom - box.top - box.bottom) < 1;
      return { ref, centredOver: covers && centred };
    }));
    assert.deepEqual(options.map(({ ref }) => ref).sort(), [...CLASS_IDS].sort(), 'every class has its option');
    options.forEach(({ ref, centredOver }) => assert.ok(centredOver, `the option of ${ref} lies centred over its class box`));
    assert.deepEqual(namesBySet(await listboxOptions(page)), { [CLASS_SET]: CLASS_NAMES });
  });
});

test('the listbox group carries data-layout-ignore and collectEditableRoutes finds the same routes before and after it is attached', async () => {
  await withPage({}, async (page) => {
    await drawFigure(page, 'code of policy');
    const routes = () => page.evaluate(() => window.UMLShared.collectEditableRoutes(window.drawn.svg)
      .map((route) => ({ id: route.id, points: route.points.map((point) => [point.x, point.y]) })));
    const before = await routes();
    // Targets twice as large as the drawing, as at a very small magnification: every line lies inside an option, where
    // the bundle would no longer count an unnamed line if it read the options as boxes of the drawing.
    const minimumTarget = await page.evaluate(() => 2 * Math.max(window.drawn.svg.viewBox.baseVal.width, window.drawn.svg.viewBox.baseVal.height));

    await attachUml(page, 'classes', { minimumTarget });

    const listbox = await page.evaluate(() => {
      const group = window.drawn.svg.querySelector('[role="listbox"]');
      const targets = [...group.querySelectorAll('[role="option"]')].map((option) => ['x', 'y', 'width', 'height'].map((name) => Number(option.getAttribute(name))));
      // The bundle numbers a line the renderer drew without a route id in order, edge-0, edge-1, … (spec §3.4).
      const unnamed = window.UMLShared.collectEditableRoutes(window.drawn.svg).filter((route) => route.id.startsWith('edge-'));
      const inside = unnamed.filter(({ box }) => targets.some(([x, y, width, height]) => box.x >= x && box.y >= y
        && box.x + box.width <= x + width && box.y + box.height <= y + height));
      return { ignored: group.hasAttribute('data-layout-ignore'), unnamedLinesInsideAnOption: inside.length };
    });
    assert.ok(listbox.unnamedLinesInsideAnOption > 0, 'the case is exercised: an unnamed line lies inside an option');
    assert.equal(listbox.ignored, true, 'the listbox group carries data-layout-ignore');
    assert.deepEqual(await routes(), before);
  });
});

test('in read-only mode interfaces of api offers today\'s three sets', async () => {
  await withPage({}, async (page) => {
    await drawFigure(page, 'interfaces of api');
    const view = core.project(DESIGN, 'interfaces of api');
    const component = (role) => view.uml.components.find((each) => each.role === role);

    await attachUml(page, 'interfaces', { readOnly: true });

    const drawing = await page.evaluate(() => ({ role: window.drawn.svg.getAttribute('role'), name: window.drawn.svg.getAttribute('aria-label') }));
    assert.deepEqual(drawing, { role: 'group', name: view.title }, 'the drawing is a group named by the view title');
    const options = await listboxOptions(page);
    assert.ok(options.every((option) => option.listbox === LISTBOX_NAME), `every option is in the listbox "${LISTBOX_NAME}"`);
    // Today's three sets come first: the editable interfaces view (spec §7.3) adds its Interfaces and Uses sets after them.
    assert.deepEqual(options.slice(0, 3).map(({ set, name, description }) => ({ set, name, description })), [
      {
        set: 'Using what Registration API provides', name: component('consumer').name,
        description: `${component('consumer').typeLabel}; Enter shows its interfaces`,
      },
      { set: 'Subject of this view', name: component('scope').name, description: `${component('scope').typeLabel}; subject of this view` },
      {
        set: 'Providing what Registration API requires', name: component('provider').name,
        description: `${component('provider').typeLabel}; Enter shows its interfaces`,
      },
    ]);
    const sizes = await page.evaluate(() => [...window.drawn.svg.querySelectorAll('[role="option"]')].map((option) => {
      const box = option.getBoundingClientRect();
      return [box.width, box.height];
    }));
    sizes.forEach(([width, height]) => assert.ok(width >= MINIMUM_TARGET_PX && height >= MINIMUM_TARGET_PX,
      `an option of ${width} × ${height} px is a pointer target of at least ${MINIMUM_TARGET_PX} × ${MINIMUM_TARGET_PX} px`));
  });
});

test('an option of interfaces of api selects its element, and the element\'s selection finds that option again', async () => {
  await withPage({}, async (page) => {
    await drawFigure(page, 'interfaces of api');
    await attachUml(page, 'interfaces', { readOnly: true });

    const roundTrips = await page.evaluate(() => {
      const module = window.ArchUMLC4EditorParts.umlViews['uml-component'];
      const { context, svg } = window.drawn;
      return [...svg.querySelectorAll('[role="option"]')].map((option) => {
        const ref = option.getAttribute('data-c4-option');
        const selection = module.selectionOf(ref, context);
        return { name: option.querySelector('title').textContent, selection, findsItsOption: module.refOf(selection, context) === ref };
      });
    });
    const idOf = Object.fromEntries(core.project(DESIGN, 'interfaces of api').uml.components.map((each) => [each.name, each.id]));
    assert.equal(roundTrips.length, 3);
    assert.deepEqual(roundTrips, roundTrips.map(({ name }) => ({ name, selection: { elementId: idOf[name] }, findsItsOption: true })));
  });
});

test('an option whose box is not drawn is left out, and a set left without options is not offered', async () => {
  await withPage({}, async (page) => {
    await drawFigure(page, 'code of policy');

    await attachUml(page, 'classesAndUndrawn');

    assert.deepEqual(namesBySet(await listboxOptions(page)), { [CLASS_SET]: CLASS_NAMES });
    const sets = await page.evaluate(() => [...window.drawn.svg.querySelectorAll('[role="listbox"] [role="group"]')]
      .map((group) => group.getAttribute('aria-label')));
    assert.deepEqual(sets, [CLASS_SET], 'the set whose only option is not drawn is not offered');
  });
});

test('where an interface has its provider\'s id, the provider is offered once, and only an option\'s ref selects an element', async () => {
  await withPage({}, async (page) => {
    await drawFigure(page, 'interfaces of api', SHARED_ID_MODEL);
    await attachUml(page, 'interfaces', { readOnly: true });

    const { offered, selecting } = await page.evaluate(() => {
      const module = window.ArchUMLC4EditorParts.umlViews['uml-component'];
      const { context, svg } = window.drawn;
      const refs = [...svg.querySelectorAll('[role="option"]')].map((option) => option.getAttribute('data-c4-option'));
      return {
        offered: [...svg.querySelectorAll('[role="option"] title')].map((title) => title.textContent),
        selecting: Object.keys(context.uml.ids).filter((alias) => module.selectionOf(alias, context) !== null).sort()
          .map((alias) => ({ alias, isOption: refs.includes(alias), selectsElement: Boolean(module.selectionOf(alias, context).elementId) })),
      };
    });
    assert.deepEqual(offered.filter((name) => name === 'Billing System'), ['Billing System']);
    // The balls are options too (they select their interface), so only the boxes' aliases are counted here.
    assert.equal(selecting.filter(({ alias }) => /^e\d+$/.test(alias)).length, 3, 'each of the three boxes selects its element');
    // A ball selects its interface; this read-only listbox has no option for it (its drawing has no layout id).
    assert.ok(selecting.filter(({ selectsElement }) => selectsElement).every(({ isOption }) => isOption),
      `only options select an element: ${JSON.stringify(selecting)}`);
  });
});

test('in read-only mode a press on a box reaches its option', async () => {
  await withPage({}, async (page) => {
    await drawFigure(page, 'code of policy');

    await attachUml(page, 'classes', { readOnly: true });

    assert.deepEqual(await pressedAtClassCentre(page, 'EnrollmentPolicy'), { option: 'EnrollmentPolicy', inDrawing: true });
  });
});

test('outside read-only mode a press on a box passes its option and reaches the drawing, where an editing session\'s hit targets lie', async () => {
  await withPage({}, async (page) => {
    await drawFigure(page, 'code of policy');

    await attachUml(page, 'classes', { readOnly: false });

    assert.deepEqual(await pressedAtClassCentre(page, 'EnrollmentPolicy'), { option: null, inDrawing: true });
    assert.deepEqual(namesBySet(await listboxOptions(page)), { [CLASS_SET]: CLASS_NAMES },
      'the listbox is still offered to the keyboard and to assistive technology');
  });
});

test('while the listbox is attached no ancestor up to the drawing container hides the drawing as an image, and destroy names it again', async () => {
  await withPage({}, async (page) => {
    await drawFigure(page, 'interfaces of api');
    // The drawing's own container named as one image, as a renderer may name it; a listbox inside an image is flattened.
    const IMAGE_NAMING = { role: 'img', 'aria-label': 'Component diagram', 'aria-hidden': 'true' };
    await page.evaluate((naming) => {
      Object.entries(naming).forEach(([name, value]) => window.drawn.svg.parentElement.setAttribute(name, value));
    }, IMAGE_NAMING);
    const naming = () => page.evaluate((names) => Object.fromEntries(names.map((name) => [name, window.drawn.svg.parentElement.getAttribute(name)])),
      Object.keys(IMAGE_NAMING));

    await attachUml(page, 'interfaces', { readOnly: true });

    assert.deepEqual(await naming(), { role: null, 'aria-label': null, 'aria-hidden': null }, 'the container is no image while the listbox is attached');
    assert.equal((await listboxOptions(page)).length, 3, 'the options reach assistive technology');
    await page.evaluate(() => window.overlay.destroy());
    assert.deepEqual(await naming(), IMAGE_NAMING, 'destroy gives the container its naming back');
  });
});

test('destroying the listbox gives the drawing and its container back byte for byte', async () => {
  await withPage({}, async (page) => {
    await drawFigure(page, 'interfaces of api');
    const markup = () => page.evaluate(() => document.getElementById('figure').outerHTML);
    const before = await markup();
    await attachUml(page, 'interfaces', { readOnly: true });
    assert.notEqual(await markup(), before, 'attaching changes the drawing');

    await page.evaluate(() => window.overlay.destroy());

    assert.equal(await markup(), before);
  });
});

// ---- The canvas of a mounted editor ------------------------------------------------------------------------------

/** Mounts an editor on `#editor` with the model and `view` open, after registering `viewModules` (notation → module). */
function mountEditor(page, view, viewModules = {}) {
  return page.evaluate(({ source, selector, modules }) => {
    const parts = window.ArchUMLC4EditorParts;
    if (Object.keys(modules).length > 0) parts.umlViews = Object.assign(parts.umlViews || {}, modules);
    window.editor = window.ArchUMLC4Editor.mount(document.getElementById('editor'), {
      text: source, view: selector, profile: 'expert', host: { onTextChange() {} },
    });
  }, { source: MODEL, selector: view, modules: viewModules });
}

/** What the canvas shows: whether it holds a UML drawing, its message instead, and how many listboxes and options. */
function canvasContent(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#editor [role="region"][aria-label^="Canvas"]');
    const message = canvas.querySelector('.c4-editor__canvas-message');
    return {
      drawing: canvas.querySelector('.c4-uml-view svg') !== null,
      message: message ? message.textContent : null,
      listboxes: canvas.querySelectorAll('[role="listbox"]').length,
      options: canvas.querySelectorAll('[role="option"]').length,
    };
  });
}

const DRAWN_WITHOUT_LISTBOX = { drawing: true, message: null, listboxes: 0, options: 0 };

test('each UML notation has its view module, registered at umlViews under its notation', async () => {
  await withPage({}, async (page) => {
    const registered = await page.evaluate((notations) => notations.map((notation) => {
      const module = window.ArchUMLC4EditorParts.umlViews[notation];
      return { notation, declares: module && module.notation, editable: module && typeof module.editable };
    }), Object.keys(UML_VIEWS));

    assert.deepEqual(registered, Object.keys(UML_VIEWS).map((notation) => ({ notation, declares: notation, editable: 'boolean' })));
  });
});

test('a view module with editable false and no option sets adds no overlay', async () => {
  // Each notation's module replaced by such a module, as the code, deployment, and dynamic modules are until their
  // views become editable.
  const declarations = Object.fromEntries(Object.keys(UML_VIEWS).map((notation) => [notation, { notation, editable: false }]));
  await withPage({}, async (page, errors) => {
    await mountEditor(page, 'containers of registration', declarations);

    for (const view of Object.values(UML_VIEWS)) {
      await page.evaluate((selector) => window.editor.openView(selector), view);
      assert.deepEqual(await canvasContent(page), DRAWN_WITHOUT_LISTBOX, `${view} is drawn with no listbox`);
    }
    assert.deepEqual(errors, []);
  });
});

test('with no view module loaded every UML view is drawn and nothing throws', async () => {
  await withPage({ withoutViewModules: true }, async (page, errors) => {
    assert.equal(await page.evaluate(() => window.ArchUMLC4EditorParts.umlViews), undefined, 'no view module is registered');
    await mountEditor(page, 'containers of registration');

    for (const view of Object.values(UML_VIEWS)) {
      await page.evaluate((selector) => window.editor.openView(selector), view);
      assert.deepEqual(await canvasContent(page), DRAWN_WITHOUT_LISTBOX, `${view} is drawn with no listbox`);
    }
    assert.deepEqual(errors, []);
  });
});
