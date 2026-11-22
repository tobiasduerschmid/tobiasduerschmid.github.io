// @ts-check
// Interface views in the C4 editor (spec §5.1, §9.1 Toolbar and Outline, §9.4 print, §9.5 "Interface views on the
// canvas"): the toolbar's Interfaces button and Show interfaces toggle sit outside the level toggle group; the outline
// lists every interface under one top-level Interfaces branch; `interfaces of <element>` gets a read-only listbox over
// the delegated component diagram, where Enter on a consumer or provider opens that element's interfaces view; and
// `interface <id>` shows the description card, with one "Edit <operation>" button per operation, a Selected badge on
// the selected operation's blocks, Copy description in place of Download SVG, and a print that shows the card once.
//
// The page mounts the whole editor from the manifest, with a 96 px sticky header like the site's navbar and the site's
// 62.5% root font size. The host records texts, views, announcements, and copied text. Facts about the model (names,
// views, the card's description) come from the C4 core, the oracle for what the editor must show.
//
// The drawings of the two interface views come from the renderer: `interfaces of` is the delegated UML component
// diagram and `interface <id>` the card. A test that needs the drawing fails when the renderer cannot draw it.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const AxeBuilder = require('@axe-core/playwright').default;
const { openUmlEditor, hostLog: umlHostLog, messageRegion: umlMessageRegion } = require('./helpers/c4-uml-editing.js');
const umlRefusals = require('../js/ArchUML/c4/editor/c4-editor-uml-refusals.js');

const ARCHUML = path.join(__dirname, '../js/ArchUML');
const C4 = require(path.join(ARCHUML, 'c4/c4-core.js'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const SCRIPTS = ['uml-bundle.js', ...MANIFEST.core, ...MANIFEST.render, ...MANIFEST.editor].map((file) => path.join(ARCHUML, file));
const STYLESHEET = path.join(ARCHUML, 'css/c4-editor.css');
const FIXTURES = path.join(ARCHUML, 'tests/c4/fixtures');
// The reference model with interface descriptions: Registration API provides Enrollment API (used by Planner Web App)
// and requires Tuition Charges from Billing System.
const INTERFACES = fs.readFileSync(path.join(FIXTURES, 'course-registration-interfaces.yml'), 'utf8');
const INTERFACES_DESIGN = C4.load(INTERFACES);
// A model without any interface description.
const SHOP = fs.readFileSync(path.join(FIXTURES, 'shop.yml'), 'utf8');
const NAVBAR_PX = 96;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>C4 editor interface views</title>
<style>
  html { font-size: 62.5%; }
  body { margin: 0; font-size: 20px; background: #ffffff; color: #1f2328; }
  html.dark-mode body { background: #0d1117; color: #e6edf3; }
  header { position: sticky; top: 0; z-index: 10; height: ${NAVBAR_PX}px; background: #ffffff; border-bottom: 1px solid #555555; }
  html.dark-mode header { background: #0d1117; }
  main { padding: 16px; }
</style>
</head><body><header><p>Site navigation</p></header><main><h1>C4 editor interface views</h1><div id="editor"></div></main></body></html>`;

/** Loads every part and mounts an editor on #editor; the host records texts, views, announcements, and copies. */
async function openEditor(page, { text = INTERFACES, view = 'containers of registration', profile = 'expert' } = {}) {
  await page.setContent(PAGE);
  await page.addStyleTag({ path: STYLESHEET });
  for (const script of SCRIPTS) await page.addScriptTag({ path: script });
  await page.evaluate(({ modelText, selector, chosenProfile }) => {
    const log = { texts: [], views: [], announced: [], copied: [] };
    window.hostLog = log;
    window.editor = window.ArchUMLC4Editor.mount(document.getElementById('editor'), {
      text: modelText, view: selector, profile: chosenProfile,
      host: {
        onTextChange: (changed) => log.texts.push(changed),
        onViewChange: (changed) => log.views.push(changed),
        announce: (message) => log.announced.push(message),
        copyText: (copied, info) => {
          log.copied.push({ text: copied, info });
          return Promise.resolve();
        },
        exportSvg: () => Promise.resolve(),
        saveFile: () => Promise.resolve(),
      },
    });
  }, { modelText: text, selector: view, chosenProfile: profile });
  return page.locator('#editor');
}

const toolbar = (editor) => editor.getByRole('group', { name: 'Toolbar' });
const levels = (editor) => toolbar(editor).getByRole('group', { name: 'View', exact: true });
const interfacesButton = (editor) => toolbar(editor).getByRole('button', { name: 'Interfaces', exact: true });
const showInterfaces = (editor) => toolbar(editor).getByRole('button', { name: 'Show interfaces', exact: true });
const canvas = (editor) => editor.getByRole('region', { name: /^Canvas/ });
const outline = (editor) => editor.getByRole('tree', { name: 'Model outline' });
const treeitem = (editor, name) => outline(editor).getByRole('treeitem', { name, exact: true });
const inspector = (editor) => editor.getByRole('region', { name: 'Inspector', exact: true });
const breadcrumbs = (editor) => editor.getByRole('navigation', { name: 'Breadcrumbs' });
const elements = (editor) => canvas(editor).getByRole('listbox', { name: 'Elements in this view' });
const option = (editor, name) => elements(editor).getByRole('option', { name, exact: true });
const card = (editor) => canvas(editor).getByRole('article', { name: 'Enrollment API' });

/** The canvas region's name for the view `selector` of the interfaces model: "Canvas: <view title>". */
function canvasNameOf(selector) {
  return `Canvas: ${C4.project(INTERFACES_DESIGN, selector).title}`;
}

const hostLog = (page) => page.evaluate(() => window.hostLog);

test.describe('C4 editor interface views: toolbar', () => {
  test('the level toggle group has no Interfaces button; the Interfaces button opens interfaces of the selected element and its breadcrumbs lead back', async ({ page }) => {
    const editor = await openEditor(page);
    await expect(levels(editor).getByRole('button')).not.toHaveCount(0);
    await expect(levels(editor).getByRole('button', { name: /interfaces/i }), 'the level group holds zoom levels only').toHaveCount(0);

    await page.evaluate(() => window.editor.select('api'));
    await interfacesButton(editor).click();
    await expect(canvas(editor)).toHaveAccessibleName(canvasNameOf('interfaces of api'));
    expect((await hostLog(page)).views.at(-1), 'the host is told the view').toBe('interfaces of api');
    await expect(breadcrumbs(editor).getByRole('link', { name: 'Interfaces of Registration API' })).toHaveAttribute('aria-current', 'page');
    await expect(levels(editor).locator('[aria-pressed="true"]'), 'an interface view is not a level').toHaveCount(0);

    await breadcrumbs(editor).getByRole('link', { name: 'Containers: Course Registration' }).click();
    await expect(canvas(editor)).toHaveAccessibleName(canvasNameOf('containers of registration'));
    await expect(levels(editor).getByRole('button', { name: 'Containers' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the Interfaces button explains itself when no system, container, or component is selected', async ({ page }) => {
    const editor = await openEditor(page, { view: 'landscape' });
    await page.evaluate(() => window.editor.select('student'));
    await expect(interfacesButton(editor)).toHaveAttribute('aria-disabled', 'true');
    await expect(interfacesButton(editor)).toHaveAccessibleDescription(/Select a software system, container, or component/);
    // aria-disabled keeps the button focusable and pressable; pressing it opens nothing and says why.
    await interfacesButton(editor).click({ force: true });
    await expect.poll(async () => (await hostLog(page)).announced.at(-1)).toMatch(/^Select a software system, container, or component/);
    await expect(canvas(editor), 'a disabled button opens nothing').toHaveAccessibleName(canvasNameOf('landscape'));

    // Inside a scope, the view's own element is the fallback: the container view's system.
    await page.evaluate(() => {
      window.editor.openView('containers of registration');
      window.editor.select(null);
    });
    await expect(interfacesButton(editor)).toHaveAttribute('aria-disabled', 'false');
    await interfacesButton(editor).click();
    await expect(canvas(editor)).toHaveAccessibleName(canvasNameOf('interfaces of registration'));
  });

  test('the interface controls appear in the expert profile and in models with interfaces', async ({ page }) => {
    let editor = await openEditor(page, { text: SHOP, view: C4.defaultView(C4.load(SHOP)), profile: 'novice' });
    await expect(toolbar(editor).getByRole('button', { name: /interfaces/i }), 'a novice model without interfaces hides them').toHaveCount(0);

    editor = await openEditor(page, { text: SHOP, view: C4.defaultView(C4.load(SHOP)), profile: 'expert' });
    await expect(interfacesButton(editor)).toBeVisible();
    await expect(showInterfaces(editor)).toBeVisible();

    editor = await openEditor(page, { profile: 'novice' });
    await expect(interfacesButton(editor), 'a model with interfaces shows them to novices too').toBeVisible();
    await expect(showInterfaces(editor)).toBeVisible();
  });

  test('Show interfaces toggles the annotation, keeps pins, and announces Showing interfaces', async ({ page }) => {
    const pinned = `${INTERFACES}layout:\n  containers of registration:\n    api: [40, 60]\n`;
    const editor = await openEditor(page, { text: pinned });
    await expect(showInterfaces(editor)).toHaveAttribute('aria-pressed', 'false');
    await expect(levels(editor).getByRole('button', { name: 'Show interfaces' }), 'the toggle is outside the level group').toHaveCount(0);

    await showInterfaces(editor).click();
    await expect(showInterfaces(editor)).toHaveAttribute('aria-pressed', 'true');
    await expect(showInterfaces(editor), 'focus stays on the toggle').toBeFocused();
    let log = await hostLog(page);
    expect(log.views.at(-1)).toBe('containers of registration with interfaces');
    await expect.poll(async () => (await hostLog(page)).announced.at(-1)).toMatch(/^Showing interfaces\b/);
    await expect(option(editor, 'Registration API'), 'the annotated view keeps the pin of the plain view')
      .toHaveAccessibleDescription(/position pinned/);
    await expect(levels(editor).getByRole('button', { name: 'Containers' }), 'the level stays the same').toHaveAttribute('aria-pressed', 'true');

    await showInterfaces(editor).click();
    await expect(showInterfaces(editor)).toHaveAttribute('aria-pressed', 'false');
    log = await hostLog(page);
    expect(log.views.at(-1)).toBe('containers of registration');
    await expect.poll(async () => (await hostLog(page)).announced.at(-1)).toMatch(/^Hiding interfaces\b/);
    expect(log.texts, 'toggling the annotation never edits the model').toEqual([]);
  });

  test('Show interfaces is offered on C4-notation and dynamic views only', async ({ page }) => {
    const editor = await openEditor(page, { view: 'dynamic enroll' });
    await expect(showInterfaces(editor)).toBeVisible();
    await showInterfaces(editor).click();
    expect((await hostLog(page)).views.at(-1)).toBe('dynamic enroll with interfaces');

    for (const selector of ['code of policy', 'deployment production', 'interfaces of api', 'interface enrollment-api']) {
      await page.evaluate((wanted) => window.editor.openView(wanted), selector);
      await expect(canvas(editor)).toHaveAccessibleName(canvasNameOf(selector));
      await expect(showInterfaces(editor), `${selector} has no interface annotation`).toBeHidden();
    }
  });

  test('Copy description passes the card\'s Markdown to host.copyText', async ({ page }) => {
    const editor = await openEditor(page, { view: 'interface enrollment-api' });
    const view = C4.project(INTERFACES_DESIGN, 'interface enrollment-api');
    const description = C4.describe(view);
    await expect(toolbar(editor).getByRole('button', { name: 'Download SVG' }), 'a card has no drawing to download').toBeHidden();
    await expect(toolbar(editor).getByRole('button', { name: 'Copy ArchUML source' })).toBeHidden();

    await toolbar(editor).getByRole('button', { name: 'Copy description' }).click();
    await expect.poll(async () => (await hostLog(page)).copied.length).toBe(1);
    const [copied] = (await hostLog(page)).copied;
    const lines = copied.text.split('\n');
    expect(lines[0], 'the title heads the Markdown').toBe(`# ${view.title}`);
    expect(lines).toContain(description.brief);
    // The copy says what the card's description says: each section as a heading, each item as a list entry.
    description.sections.forEach((section) => {
      const at = lines.indexOf(`## ${section.heading}`);
      expect(at, `section ${section.heading}`).toBeGreaterThan(0);
      section.items.forEach((item, index) => expect(lines[at + 2 + index]).toBe(`- ${item}`));
    });
    expect(copied.info).toEqual(expect.objectContaining({ format: 'markdown', view: 'interface enrollment-api' }));
    await expect.poll(async () => (await hostLog(page)).announced.at(-1)).toBe('Copied the description of Enrollment API.');
  });
});

test.describe('C4 editor interface views: outline', () => {
  test('the outline lists Enrollment API under the Interfaces branch, not under Registration API, and Enter opens its card', async ({ page }) => {
    const editor = await openEditor(page);
    const branch = treeitem(editor, 'Interfaces');
    await expect(branch).toHaveAttribute('aria-expanded', 'true');
    const names = [...INTERFACES_DESIGN.model.interfaces.values()]
      .map((declared) => `${declared.name} (${INTERFACES_DESIGN.model.elements.get(declared.providerId).name})`);
    await expect(branch.getByRole('group').getByRole('treeitem')).toHaveCount(names.length);
    for (const name of names) await expect(branch.getByRole('treeitem', { name, exact: true })).toHaveCount(1);

    // Selecting a component inside Registration API opens the provider's subtree in the outline.
    await page.evaluate(() => window.editor.select('coordinator'));
    await expect(treeitem(editor, 'Registration API')).toHaveAttribute('aria-expanded', 'true');
    await expect(treeitem(editor, 'Registration API').getByRole('treeitem', { name: /Enrollment API/ }),
      'interfaces are not children of their provider').toHaveCount(0);

    await treeitem(editor, 'Enrollment API (Registration API)').focus();
    await page.keyboard.press('Enter');
    await expect(canvas(editor)).toHaveAccessibleName(canvasNameOf('interface enrollment-api'));
    await expect(inspector(editor).getByRole('heading', { level: 3 }), 'the inspector shows the interface').toHaveText('Enrollment API');
    await expect(treeitem(editor, 'Enrollment API (Registration API)')).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('C4 editor interface views: canvas', () => {
  test('a view the renderer cannot draw yet shows an accessible message instead of failing', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const editor = await openEditor(page, { view: 'interface enrollment-api' });
    await expect(canvas(editor)).toHaveAccessibleName(canvasNameOf('interface enrollment-api'));
    await page.evaluate(() => window.editor.openView('interfaces of api'));
    await expect(canvas(editor)).toHaveAccessibleName(canvasNameOf('interfaces of api'));
    // Either the drawing or the renderer's message: never an empty canvas.
    await expect(canvas(editor).locator('svg, .c4-editor__canvas-message').first()).toBeVisible();
    expect(errors, 'no uncaught error').toEqual([]);
  });

  test('Enter on a consumer in the interfaces view opens that element\'s interfaces view', async ({ page }) => {
    // The interfaces view is edited on the canvas (UML-view editing spec §5.5), so this page loads the diagram editor.
    const editor = await openUmlEditor(page, { view: 'interfaces of api', header: true });
    const view = C4.project(INTERFACES_DESIGN, 'interfaces of api');
    const drawn = view.uml;
    // One option per box, then the Interfaces set (one per drawn ball, `p<n>` in the drawing) and the Uses set (one per
    // line between a ball and its socket).
    const balls = Object.keys(C4.toUml(view).ids).filter((alias) => /^p\d+$/.test(alias)).length;
    await expect(elements(editor).getByRole('option')).toHaveCount(drawn.components.length + balls + drawn.assemblies.length);
    const consumer = drawn.components.find((component) => component.role === 'consumer');

    await option(editor, consumer.name).focus();
    await expect(option(editor, consumer.name), 'selection follows focus').toHaveAttribute('aria-selected', 'true');
    // A consumer is drawn because of an interface: Delete is refused and changes nothing; F2 opens its name in place.
    await page.keyboard.press('Delete');
    await expect(umlMessageRegion(editor)).toContainText(umlRefusals.verdict('interfaces/neighbour',
      { Name: consumer.name, 'uses | provides': 'uses', Interface: 'Enrollment API' }).message);
    expect((await umlHostLog(page)).texts).toEqual([]);
    await page.keyboard.press('F2');
    await expect(editor.getByRole('textbox', { name: new RegExp(`${consumer.name}$`) })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(option(editor, consumer.name)).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(canvas(editor)).toHaveAccessibleName(canvasNameOf(`interfaces of ${consumer.id}`));
    await expect(option(editor, consumer.name), 'focus moves to the element whose view opened').toBeFocused();
  });

  test('Edit submit-plan on the card opens it in the interface form with focus on its syntax field, and Back returns focus to the button', async ({ page }) => {
    const editor = await openEditor(page, { view: 'interface enrollment-api' });
    const edit = card(editor).getByRole('button', { name: 'Edit submit-plan' });
    await edit.click();
    const syntax = inspector(editor).getByRole('textbox', { name: /^Syntax/ });
    await expect(syntax).toBeFocused();
    await expect(syntax).toHaveValue('POST /v1/enrollments');

    await inspector(editor).getByRole('button', { name: 'Back to Registration API' }).click();
    await expect(edit).toBeFocused();
  });

  test('the selected operation\'s semantic block shows the Selected badge and scrolls into view on a card taller than the canvas', async ({ page }) => {
    const editor = await openEditor(page, { view: 'interface enrollment-api' });
    const semantic = card(editor).getByRole('group', { name: 'Semantic view' }).getByRole('group', { name: /^submit-plan: / });
    await expect(semantic.getByText('Selected', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => {
      const region = document.querySelector('.c4-editor__canvas');
      return region.scrollHeight > region.clientHeight;
    }), 'the card is taller than the canvas').toBe(true);

    await page.evaluate(() => window.editor.select({ interfaceId: 'enrollment-api', operationId: 'submit-plan' }));
    await expect(semantic.getByText('Selected', { exact: true })).toBeVisible();
    await expect(card(editor).locator('[data-c4-operation="submit-plan"]').getByText('Selected', { exact: true })).toBeVisible();
    // The canvas scrolls inside its own region; the page stays where the reader left it.
    const inside = await semantic.evaluate((block) => {
      const region = block.closest('.c4-editor__canvas');
      const frame = region.getBoundingClientRect();
      const box = block.getBoundingClientRect();
      return { scrolled: region.scrollTop > 0, top: box.top >= frame.top && box.top < frame.bottom };
    });
    expect(inside, 'the block is scrolled into the canvas region').toEqual({ scrolled: true, top: true });

    await page.evaluate(() => window.editor.select('api'));
    await expect(card(editor).getByText('Selected', { exact: true })).toHaveCount(0);
  });

  test('print of a card view leaves out the Explain panel', async ({ page }) => {
    const editor = await openEditor(page, { view: 'interface enrollment-api' });
    const explain = editor.getByRole('tabpanel', { name: 'Explain', includeHidden: true });
    await page.emulateMedia({ media: 'print' });
    await expect(explain).toBeHidden();
    await page.evaluate(() => window.editor.openView('containers of registration'));
    await expect(explain, 'other views still print their Explain text').toBeVisible();
  });

  test('print of a card view shows the card once and no Explain panel', async ({ page }) => {
    const editor = await openEditor(page, { view: 'interface enrollment-api' });
    await page.emulateMedia({ media: 'print' });
    await expect(card(editor)).toBeVisible();
    await expect(card(editor).getByRole('button'), 'no editing controls print').toHaveCount(0);
    const brief = C4.describe(C4.project(INTERFACES_DESIGN, 'interface enrollment-api')).brief;
    await expect(editor.getByRole('tabpanel', { name: 'Explain', includeHidden: true })).toBeHidden();
    await expect(editor.getByText(brief), 'the description is not printed beside the card').toBeHidden();
  });
});

test.describe('C4 editor interface views: accessibility', () => {
  for (const selector of ['interfaces of api', 'interface enrollment-api']) {
    test(`axe finds no WCAG 2.2 AA violation on ${selector} in light and dark at 320 and 1440 px`, async ({ page }) => {
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await openEditor(page, { view: selector });
        for (const dark of [false, true]) {
          await page.evaluate((on) => document.documentElement.classList.toggle('dark-mode', on), dark);
          await page.evaluate(() => window.editor.select({ interfaceId: 'enrollment-api' }));
          const results = await new AxeBuilder({ page }).include('#editor').withTags(AXE_TAGS).analyze();
          const summary = results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
          expect(summary, `${selector} at ${width} px, ${dark ? 'dark' : 'light'}`).toEqual([]);
        }
      }
    });
  }
});
