'use strict';

// The C4 editor's interactive overlay (js/ArchUML/c4/editor/c4-editor-overlay.js; spec §9.1 Canvas, Ruling 12):
// `attach(svg, viewModel, {instanceId, design, problems})` turns a drawing that the normal renderer produced into the
// editor's accessible listbox of elements and gives it back unchanged on `destroy()`. The tests render the reference
// model in Chromium with the scripts the manifest lists and read the result through the accessibility tree (names,
// descriptions, and the groups that hold each option), hit testing, and the SVG markup.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const ARCHUML = path.join(__dirname, '../../js/ArchUML');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const FIXTURES = path.join(ARCHUML, 'tests/c4/fixtures');
const REFERENCE = fs.readFileSync(path.join(FIXTURES, 'course-registration.yml'), 'utf8');
const TWO_GROUPS = fs.readFileSync(path.join(FIXTURES, 'two-groups.yml'), 'utf8');
// The reference model with the Registration API pinned in the container view.
const API_PINNED = `${REFERENCE}\nlayout:\n  containers of registration:\n    api: [400, 120]\n`;
const MINIMUM_TARGET_PX = 24;
const STYLESHEET = path.join(ARCHUML, 'css/c4-editor.css');

let browser;
before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
});
after(async () => { if (browser) await browser.close(); });

/**
 * A page with the editor stylesheet, the ArchUML bundle, and the manifest's core, render, and editor scripts, in
 * order. The drawings sit inside a `.c4-editor` root, as the canvas's do.
 */
async function withEditorScripts(run) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.setContent('<!doctype html><html lang="en"><title>C4 overlay test</title><body>'
      + '<div class="c4-editor"><div id="first"></div><div id="second"></div></div></body></html>');
    await page.addStyleTag({ path: STYLESHEET });
    await page.addScriptTag({ path: path.join(ARCHUML, 'uml-bundle.js') });
    for (const file of MANIFEST.core.concat(MANIFEST.render, MANIFEST.editor)) {
      await page.addScriptTag({ path: path.join(ARCHUML, file) });
    }
    await run(page);
  } finally {
    await context.close();
  }
}

/**
 * Draws `view` of `text` into `#<containerId>` the way the editor's canvas does (renderView with the view's pins,
 * then the figure's name), and keeps the design and view model for attaching the overlay later.
 */
function draw(page, { text, view, containerId = 'first' }) {
  return page.evaluate(({ source, selector, id }) => {
    const design = window.ArchUMLC4.load(source);
    const viewModel = window.ArchUMLC4.project(design, selector);
    const container = document.getElementById(id);
    window.ArchUMLC4Render.renderView(container, viewModel, { pins: design.model.layout.get(viewModel.key) });
    window.UMLShared.applySvgAccessibility(container, 'c4', null, window.ArchUMLC4.describe(viewModel).brief);
    window.drawn = window.drawn || {};
    window.drawn[id] = { design, viewModel };
  }, { source: text, selector: view, id: containerId });
}

/** Attaches the overlay to the drawing in `#<containerId>`; the handle is kept as `window.overlays[containerId]`. */
function attach(page, { containerId = 'first', instanceId = 'editor-1', problems } = {}) {
  return page.evaluate(({ id, instance, counts }) => {
    const { design, viewModel } = window.drawn[id];
    const svg = document.querySelector(`#${id} svg`);
    window.overlays = window.overlays || {};
    window.overlays[id] = window.ArchUMLC4EditorParts.overlay.attach(svg, viewModel, { instanceId: instance, design, problems: counts });
  }, { id: containerId, instance: instanceId, counts: problems });
}

/** Renders and attaches in one step. */
async function drawAndAttach(page, settings) {
  await draw(page, settings);
  await attach(page, settings);
}

/**
 * The listbox as assistive technology sees it, from Chromium's accessibility tree: each option's name, description,
 * and the name of the group set that holds it ('' when it sits directly in the listbox).
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

/** Option names per group set, in reading order. */
function namesBySet(options) {
  const sets = {};
  options.forEach((option) => { (sets[option.set] = sets[option.set] || []).push(option.name); });
  return sets;
}

function optionNamed(options, name) {
  const found = options.find((option) => option.name === name);
  assert.ok(found, `no option is named "${name}"; options: ${options.map((option) => option.name).join(', ')}`);
  return found;
}

test('interactive mode exposes a listbox of options grouped inside and outside the scope', async () => {
  await withEditorScripts(async (page) => {
    await drawAndAttach(page, { text: REFERENCE, view: 'containers of registration' });

    const drawing = page.locator('#first svg');
    assert.equal(await drawing.getAttribute('role'), 'group');
    assert.equal(await drawing.getAttribute('aria-label'), 'Container view: Course Registration');
    assert.notEqual(await drawing.getAttribute('aria-hidden'), 'true', 'the drawing must stay in the accessibility tree');
    const options = await listboxOptions(page);
    assert.ok(options.every((option) => option.listbox === 'Elements in this view'));
    assert.deepEqual(namesBySet(options), {
      'Inside Course Registration': ['Course Registration', 'Planner Web App', 'Registration API', 'Registration Database'],
      'Outside the system': ['Student', 'Billing System'],
    });
  });
});

test('the group sets follow the scope of each kind of view, with one set per C4 group', async () => {
  const cases = [
    {
      // The scope drawn as a box rather than a boundary.
      text: REFERENCE, view: 'context of registration',
      sets: { 'Inside Course Registration': ['Course Registration'], 'Outside the system': ['Student', 'Billing System'] },
    },
    {
      // Outside a container scope are elements of the same system, so the set names the container.
      text: REFERENCE, view: 'components of api',
      sets: {
        'Inside Registration API': ['Registration API', 'Registration Coordinator', 'Enrollment Policy', 'Seat Gateway', 'Billing Gateway'],
        'Outside Registration API': ['Planner Web App', 'Registration Database', 'Billing System'],
      },
    },
    {
      // A view without a scope puts its options directly in the listbox.
      text: REFERENCE, view: 'landscape',
      sets: { '': ['Student', 'Course Registration', 'Billing System'] },
    },
    {
      text: TWO_GROUPS, view: 'containers of store',
      sets: {
        'Inside Store': ['Store', 'Notifier'],
        'Group: Front office': ['Sales Desk', 'Kiosk'],
        'Group: Back office': ['Ledger', 'Archive'],
        'Outside the system': ['Clerk', 'Bank'],
      },
    },
  ];
  for (const { text, view, sets } of cases) {
    await withEditorScripts(async (page) => {
      await drawAndAttach(page, { text, view });
      assert.deepEqual(namesBySet(await listboxOptions(page)), sets, `group sets of "${view}"`);
    });
  }
});

test('options are named by element and described by type and technology', async () => {
  await withEditorScripts(async (page) => {
    await drawAndAttach(page, { text: API_PINNED, view: 'containers of registration', problems: { api: 2, web: 1 } });
    const options = await listboxOptions(page);

    assert.equal(optionNamed(options, 'Registration API').description,
      'Container: Python, FastAPI; contains 4 components — Enter shows inside; position pinned; 2 problems');
    assert.equal(optionNamed(options, 'Planner Web App').description, 'Container: TypeScript, React; 1 problem');
    assert.equal(optionNamed(options, 'Billing System').description, 'Software System, external');
    assert.equal(optionNamed(options, 'Student').description, 'Person');
    // The scope is its own option: it is described by its type and never contains other options.
    assert.equal(optionNamed(options, 'Course Registration').description, 'Software System');
  });
});

test('each option is a hit target of at least 24 by 24 pixels over its element in the drawing', async () => {
  await withEditorScripts(async (page) => {
    await drawAndAttach(page, { text: REFERENCE, view: 'containers of registration' });
    const targets = await page.evaluate(() => {
      const svg = document.querySelector('#first svg');
      return [...svg.querySelectorAll('[role="option"]')].map((option) => {
        const id = option.getAttribute('data-c4-option');
        const drawn = svg.querySelector(`[data-layout-id="${id}"]`);
        if (drawn) drawn.scrollIntoView({ block: 'center', inline: 'center' });
        const centre = drawn && drawn.getBoundingClientRect();
        const hit = centre && document.elementFromPoint(centre.x + centre.width / 2, centre.y + centre.height / 2);
        const box = option.getBoundingClientRect();
        return { id, width: box.width, height: box.height, hitId: hit ? hit.getAttribute('data-c4-option') : null, isBox: Boolean(drawn) };
      });
    });
    assert.equal(targets.length, 6);
    targets.forEach((target) => {
      assert.ok(target.width >= MINIMUM_TARGET_PX && target.height >= MINIMUM_TARGET_PX,
        `${target.id}: ${target.width} × ${target.height} px is smaller than ${MINIMUM_TARGET_PX} × ${MINIMUM_TARGET_PX}`);
    });
    targets.filter((target) => target.isBox).forEach((target) => {
      assert.equal(target.hitId, target.id, `a pointer at the centre of ${target.id} reaches its option`);
    });
  });
});

test('focus, selection, and the focused selection are 2 px strokes that differ without colour', async () => {
  await withEditorScripts(async (page) => {
    await drawAndAttach(page, { text: REFERENCE, view: 'containers of registration' });
    const marks = await page.evaluate(() => {
      const [focusedSelection, focused, selected] = window.overlays.first.targets;
      focusedSelection.classList.add('is-selected', 'is-focused');
      focused.classList.add('is-focused');
      selected.classList.add('is-selected');
      const read = (option) => {
        const style = getComputedStyle(option);
        return { width: style.strokeWidth, scaling: style.vectorEffect, dash: style.strokeDasharray, fill: style.fill };
      };
      return { focusedSelection: read(focusedSelection), focused: read(focused), selected: read(selected) };
    });
    for (const mark of Object.values(marks)) {
      assert.deepEqual([mark.width, mark.scaling], ['2px', 'non-scaling-stroke']);
    }
    assert.notEqual(marks.focusedSelection.dash, marks.selected.dash,
      'a selection keeps a visible focus mark that a selection without focus lacks');
    assert.equal(marks.focusedSelection.dash, marks.focused.dash, 'focus has one stroke pattern, selected or not');
    assert.equal(marks.focusedSelection.fill, marks.selected.fill, 'selection has one tint, focused or not');
    assert.notEqual(marks.focusedSelection.fill, marks.focused.fill, 'the tint tells a focused selection from focus alone');
  });
});

test('keyboard focus on a selected option shows the focus pattern, and print shows neither mark', async () => {
  await withEditorScripts(async (page) => {
    await drawAndAttach(page, { text: REFERENCE, view: 'containers of registration' });
    const dashOf = () => page.evaluate(() => {
      const [first, second] = window.overlays.first.targets;
      return { first: getComputedStyle(first).strokeDasharray, second: getComputedStyle(second).strokeDasharray };
    });
    await page.evaluate(() => {
      const [first, second] = window.overlays.first.targets;
      first.tabIndex = 0;
      first.classList.add('is-selected');
      second.classList.add('is-selected');
    });
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => window.overlays.first.targets[0].matches(':focus-visible')));
    const focusedDash = await dashOf();
    assert.notEqual(focusedDash.first, focusedDash.second, 'the keyboard-focused selection differs from a selection without focus');

    await page.emulateMedia({ media: 'print' });
    const printed = await page.evaluate(() => window.overlays.first.targets.slice(0, 2)
      .map((option) => getComputedStyle(option).stroke));
    assert.deepEqual(printed, ['none', 'none'], 'print draws neither focus nor selection');
  });
});

test('no focusable element sits inside aria-hidden', async () => {
  await withEditorScripts(async (page) => {
    await drawAndAttach(page, { text: REFERENCE, view: 'containers of registration' });
    const report = await page.evaluate(() => {
      const svg = document.querySelector('#first svg');
      const hiddenFocusables = [...svg.querySelectorAll('[tabindex]')].filter((node) => node.closest('[aria-hidden="true"]'));
      const handles = [...svg.querySelectorAll('[data-c4-handle]')];
      return {
        hiddenFocusables: hiddenFocusables.length,
        hiddenAncestor: Boolean(svg.parentElement.closest('[aria-hidden="true"], [role="img"]')),
        optionTabindex: [...new Set([...svg.querySelectorAll('[role="option"]')].map((option) => option.getAttribute('tabindex')))],
        handles: handles.length,
        handlesHidden: handles.every((handle) => handle.closest('[aria-hidden="true"]') && !handle.hasAttribute('tabindex')),
      };
    });
    assert.equal(report.hiddenFocusables, 0);
    assert.equal(report.hiddenAncestor, false);
    assert.deepEqual(report.optionTabindex, ['-1'], 'options wait for the canvas to give one of them the roving tab stop');
    assert.equal(report.handles, 5, 'one connect handle per element box');
    assert.ok(report.handlesHidden, 'connect handles are hidden from assistive technology and unfocusable');
  });
});

test('the drawing with its overlay passes the WCAG 2.2 AA rules axe checks', async () => {
  await withEditorScripts(async (page) => {
    await drawAndAttach(page, { text: REFERENCE, view: 'containers of registration', problems: { api: 1 } });
    await page.evaluate(() => {
      const [first] = window.overlays.first.targets;
      first.tabIndex = 0;
      first.classList.add('is-selected', 'is-focused');
      first.setAttribute('aria-selected', 'true');
    });
    const results = await new AxeBuilder({ page }).include('#first')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    assert.deepEqual(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(' ')}`), []);
  });
});

test('two overlays on one page share no ids', async () => {
  await withEditorScripts(async (page) => {
    await drawAndAttach(page, { text: REFERENCE, view: 'containers of registration', containerId: 'first', instanceId: 'editor-1' });
    await drawAndAttach(page, { text: REFERENCE, view: 'containers of registration', containerId: 'second', instanceId: 'editor-2' });
    const ids = await page.evaluate(() => [...document.querySelectorAll('[id]')].map((node) => node.id));
    assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), []);
    const descriptions = (await listboxOptions(page)).filter((option) => option.name === 'Registration API');
    assert.deepEqual(descriptions.map((option) => option.description),
      ['Container: Python, FastAPI; contains 4 components — Enter shows inside', 'Container: Python, FastAPI; contains 4 components — Enter shows inside']);
  });
});

test('attaching and destroying the overlay leaves the static SVG byte-identical', async () => {
  await withEditorScripts(async (page) => {
    await draw(page, { text: REFERENCE, view: 'containers of registration' });
    const markup = () => page.evaluate(() => document.querySelector('#first').innerHTML);
    const before = await markup();
    await attach(page);
    assert.notEqual(await markup(), before, 'attaching changes the drawing');
    await page.evaluate(() => window.overlays.first.destroy());
    assert.equal(await markup(), before);
  });
});
