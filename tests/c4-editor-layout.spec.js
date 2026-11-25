// @ts-check
// The C4 editor shell (spec §3.4, §9.1, §9.2, §9.4): its regions, the toolbar's view switcher, breadcrumbs, palette,
// history, magnification and file actions, the narrow-column layout, and clean-up on destroy.
// The page is built with setContent and loads the ArchUML scripts from disk, so the test needs no site build. Its root
// font size is 62.5%, as on this site, so a size written in rem would show up as text below paragraph size.
// The outline, inspector, panels, and actions parts belong to other lanes; a test that needs them registers small
// stand-ins on ArchUMLC4EditorParts that follow the documented factory contract `create<Name>(region, context)`.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { a11yCheckpoint } = require('./a11y-helpers');

const ARCHUML = path.join(__dirname, '../js/ArchUML');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const EDITOR_SCRIPTS = [
  'c4/editor/c4-editor-dom.js',
  'c4/editor/c4-editor-state.js',
  'c4/editor/c4-editor-toolbar.js',
  'c4/editor/c4-editor-overlay.js',
  'c4/editor/c4-editor-pointer.js',
  'c4/editor/c4-editor-canvas.js',
  'c4/editor/c4-editor-mount.js',
];
const REFERENCE_MODEL = fs.readFileSync(path.join(ARCHUML, 'tests/c4/fixtures/course-registration.yml'), 'utf8');
const PINNED_MODEL = `${REFERENCE_MODEL}layout:\n  containers of registration:\n    api: [40, 60]\n`;
// Two systems, so every level has two scopes to choose from: one in each branch.
const TWO_SYSTEMS_MODEL = `schema: c4-design/1
name: Two systems
systems:
  shop:
    name: Shop
    containers:
      storefront:
        name: Storefront
        components:
          cart: {name: Cart}
  warehouse:
    name: Warehouse
    containers:
      stock:
        name: Stock service
        components:
          picker: {name: Picker}
`;
const PARAGRAPH_PX = 20;
// From 45em to 60em (900 to 1200 px at the paragraph size) the outline keeps a column beside the canvas; below 45em
// every region stacks, so a 13em outline never leaves the drawing narrower than one element box (spec §9.1).
const NARROW_PX = 1000;
const STACKED_PX = 700;
const PHONE_PX = 320;

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>C4 editor layout</title>
<style>html { font-size: 62.5%; } body { margin: 0; font-size: ${PARAGRAPH_PX}px; } main { padding: 16px; }</style>
</head><body><main><div id="editor-host"><div id="editor"></div></div></main></body></html>`;

/** Loads the ArchUML bundle, the C4 core and renderer, and the editor modules this lane needs, in manifest order. */
async function loadEditorScripts(page) {
  await page.setContent(PAGE);
  await page.addStyleTag({ path: path.join(ARCHUML, 'css/c4-editor.css') });
  for (const file of ['uml-bundle.js', ...MANIFEST.core, ...MANIFEST.render, ...EDITOR_SCRIPTS]) {
    await page.addScriptTag({ path: path.join(ARCHUML, file) });
  }
  // Test plumbing: the host records what the editor asks of it, and `standIns` registers parts other lanes build.
  await page.evaluate(() => {
    window.hostCalls = [];
    window.partContexts = {};
    window.paletteUses = [];
    const record = (kind, result) => (...args) => { window.hostCalls.push({ kind, args }); return result; };
    window.referenceHost = () => ({
      onTextChange: (text, info) => window.hostCalls.push({ kind: 'text', text, label: info.label, reason: info.reason }),
      onViewChange: (selector) => window.hostCalls.push({ kind: 'view', selector }),
      openFile: record('openFile', Promise.resolve(null)),
      saveFile: record('saveFile', Promise.resolve()),
      exportSvg: record('exportSvg', Promise.resolve()),
      copyText: record('copyText', Promise.resolve()),
    });
    const regionStandIn = (name, factory) => ({
      [factory](region, context) {
        window.partContexts[name] = context;
        const note = document.createElement('p');
        note.textContent = `${name} stand-in showing ${context.state.getView()}`;
        region.append(note);
        return { destroy() { note.remove(); } };
      },
    });
    window.standIns = {
      outline: () => regionStandIn('outline', 'createOutline'),
      inspector: () => regionStandIn('inspector', 'createInspector'),
      panels: () => regionStandIn('panels', 'createPanels'),
      actions: () => ({
        createActions(root, context) {
          window.partContexts.actions = context;
          return {
            activatePaletteTile(tile, use) {
              window.paletteUses.push({ kind: tile.kind, elementType: tile.elementType || null, scopeId: tile.scopeId, source: use.source });
            },
            startPaletteDrag(tile) {
              window.paletteUses.push({ kind: tile.kind, elementType: tile.elementType || null, scopeId: tile.scopeId, source: 'drag' });
            },
            startAddRelationship() {},
            destroy() {},
          };
        },
      }),
    };
  });
}

/**
 * Opens the reference model in an editor mounted on #editor. `parts` names the stand-ins to register; `width` sets the
 * width of the element the editor sits in, in CSS px.
 */
async function openEditor(page, { text = REFERENCE_MODEL, view = 'containers of registration', profile = 'novice', parts = [], width = null, height = null, mountOptions = {} } = {}) {
  await loadEditorScripts(page);
  await page.evaluate(({ text: modelText, view: selector, profile: chosenProfile, parts: names, width: hostWidth, height: hostHeight, extra }) => {
    if (hostWidth) document.getElementById('editor-host').style.width = `${hostWidth}px`;
    // A host that gives the editor its height, as a tutorial's workspace pane does (size 'fill').
    if (hostHeight) Object.assign(document.getElementById('editor').style, { height: `${hostHeight}px`, overflow: 'auto' });
    for (const name of names) window.ArchUMLC4EditorParts[name] = window.standIns[name]();
    window.editor = window.ArchUMLC4Editor.mount(document.getElementById('editor'), Object.assign({
      text: modelText, view: selector, profile: chosenProfile, host: window.referenceHost(),
    }, extra));
  }, { text, view, profile, parts, width, height, extra: mountOptions });
}

function hostCalls(page, kind) {
  return page.evaluate((wanted) => window.hostCalls.filter((call) => call.kind === wanted), kind);
}

const toolbar = (page) => page.getByRole('group', { name: 'Toolbar', exact: true });
const canvas = (page) => page.getByRole('region', { name: /^Canvas/ });
const region = (page, name) => page.getByRole('region', { name, exact: true });
const viewButtons = (page) => page.getByRole('group', { name: 'View', exact: true });
const breadcrumbs = (page) => page.getByRole('navigation', { name: 'Breadcrumbs' });
const palette = (page) => page.getByRole('group', { name: 'Add to the diagram' });
const magnification = (page) => page.getByRole('group', { name: 'Magnification' });
const button = (page, name) => page.getByRole('button', { name, exact: true });

/** The rendered width of the drawing in the canvas, in CSS px. */
function drawingWidth(page) {
  return canvas(page).locator('svg').first().evaluate((svg) => svg.getBoundingClientRect().width);
}

/** The magnification the canvas region applies to its drawing (spec §9.4: the --c4-zoom custom property). */
function zoomProperty(page) {
  return canvas(page).evaluate((region) => getComputedStyle(region).getPropertyValue('--c4-zoom').trim());
}

/** True when `first` comes before `second` in document order. */
function precedes(page, first, second) {
  return page.evaluate(([a, b]) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING), [first, second]);
}

test.describe('C4 editor layout', () => {
  test('mount builds the regions in DOM order', async ({ page }) => {
    await openEditor(page, { parts: ['outline', 'inspector', 'panels'] });

    const regions = [toolbar(page), region(page, 'Outline'), canvas(page), region(page, 'Inspector'), region(page, 'Panels')];
    for (const located of regions) await expect(located).toBeVisible();
    const handles = await Promise.all(regions.map((located) => located.elementHandle()));
    for (let index = 1; index < handles.length; index += 1) {
      expect(await precedes(page, handles[index - 1], handles[index]), `region ${index} follows region ${index - 1}`).toBe(true);
    }
    await expect(canvas(page)).toHaveAttribute('tabindex', '0');
    await expect(canvas(page)).toHaveAccessibleName('Canvas: Container view: Course Registration');
    await a11yCheckpoint(page, 'C4 editor shell', { feature: 'c4-editor', include: '#editor' });
  });

  test('a region appears only when its part is loaded, and the part receives the editor state', async ({ page }) => {
    await openEditor(page, { parts: ['inspector'] });

    await expect(region(page, 'Outline')).toHaveCount(0);
    await expect(region(page, 'Panels')).toHaveCount(0);
    await expect(region(page, 'Inspector')).toContainText('inspector stand-in showing containers of registration');
  });

  test('the outline collapses from its button, and revealRegion expands a collapsed region', async ({ page }) => {
    await openEditor(page, { parts: ['outline', 'inspector', 'actions'] });
    const outlineToggle = region(page, 'Outline').getByRole('button', { name: 'Outline' });

    await outlineToggle.click();
    await expect(outlineToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(region(page, 'Outline').getByText('outline stand-in')).toBeHidden();

    const inspectorToggle = region(page, 'Inspector').getByRole('button', { name: 'Inspector' });
    await inspectorToggle.click();
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false');
    await page.evaluate(() => window.partContexts.actions.layout.revealRegion('inspector'));
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(region(page, 'Inspector').getByText('inspector stand-in')).toBeInViewport();
  });

  test('the level switcher marks the current level with aria-pressed and changes the view', async ({ page }) => {
    await openEditor(page, { view: 'containers of registration' });
    const levels = viewButtons(page);

    await expect(levels.getByRole('button', { name: 'Containers' })).toHaveAttribute('aria-pressed', 'true');
    await expect(levels.getByRole('button', { pressed: true })).toHaveCount(1);

    await levels.getByRole('button', { name: 'Components' }).click();

    await expect(levels.getByRole('button', { name: 'Components' })).toHaveAttribute('aria-pressed', 'true');
    await expect(levels.getByRole('button', { name: 'Containers' })).toHaveAttribute('aria-pressed', 'false');
    await expect(levels.getByRole('button', { pressed: true })).toHaveCount(1);
    await expect(canvas(page)).toHaveAccessibleName('Canvas: Component view: Registration API');
    await expect(page.getByLabel('Scope').locator('option:checked')).toHaveText('Registration API');
    expect(await hostCalls(page, 'view')).toEqual([{ kind: 'view', selector: 'components of api' }]);
  });

  test('the scope list opens another view of the same level', async ({ page }) => {
    await openEditor(page, { text: TWO_SYSTEMS_MODEL, view: 'containers of shop' });
    const scope = page.getByLabel('Scope');
    await expect(scope.locator('option')).toHaveText(['Shop', 'Warehouse']);
    await expect(scope.locator('option:checked')).toHaveText('Shop');

    await scope.focus();
    await scope.selectOption({ label: 'Warehouse' });

    await expect(canvas(page)).toHaveAccessibleName('Canvas: Container view: Warehouse');
    await expect(viewButtons(page).getByRole('button', { name: 'Containers' })).toHaveAttribute('aria-pressed', 'true');
    await expect(scope).toBeFocused();
    expect(await hostCalls(page, 'view')).toEqual([{ kind: 'view', selector: 'containers of warehouse' }]);
  });

  test('a level button stays in the branch of the open view, going down and up', async ({ page }) => {
    await openEditor(page, { text: TWO_SYSTEMS_MODEL, view: 'containers of warehouse' });
    const levels = viewButtons(page);

    await levels.getByRole('button', { name: 'Components' }).click();
    await expect(canvas(page)).toHaveAccessibleName('Canvas: Component view: Stock service');
    await levels.getByRole('button', { name: 'Context' }).click();
    await expect(canvas(page)).toHaveAccessibleName('Canvas: System context view: Warehouse');
  });

  test('the levels start at Context: there is no Landscape level, and a landscape request opens the context view', async ({ page }) => {
    await openEditor(page, { text: TWO_SYSTEMS_MODEL, view: 'landscape' });

    await expect(viewButtons(page).getByRole('button')).toHaveText(['Context', 'Containers', 'Components']);
    await expect(canvas(page)).toHaveAccessibleName('Canvas: System context view: Shop');
    await expect(viewButtons(page).getByRole('button', { name: 'Context' })).toHaveAttribute('aria-pressed', 'true');
    await expect(breadcrumbs(page).getByRole('link')).toHaveText(['Context: Shop']);
  });

  test('a level button opens the selected element’s own view of that level', async ({ page }) => {
    await openEditor(page, { text: TWO_SYSTEMS_MODEL, view: 'context of shop' });
    await page.evaluate(() => window.editor.select('stock'));

    await viewButtons(page).getByRole('button', { name: 'Components' }).click();

    await expect(canvas(page)).toHaveAccessibleName('Canvas: Component view: Stock service');
  });

  test('breadcrumbs navigate up', async ({ page }) => {
    await openEditor(page, { view: 'components of api' });
    const crumbs = breadcrumbs(page);
    await expect(crumbs.getByRole('link')).toHaveText([
      'Context: Course Registration', 'Containers: Course Registration', 'Components: Registration API',
    ]);
    await expect(crumbs.getByRole('link', { name: 'Components: Registration API' })).toHaveAttribute('aria-current', 'page');
    const up = crumbs.getByRole('link', { name: 'Containers: Course Registration' });
    // Links carry a non-colour cue (WCAG 1.4.1); the current crumb is the one without it.
    await expect(up).toHaveCSS('text-decoration-line', 'underline');

    await up.click();

    await expect(canvas(page)).toHaveAccessibleName('Canvas: Container view: Course Registration');
    await expect(crumbs.getByRole('link')).toHaveText(['Context: Course Registration', 'Containers: Course Registration']);
    const current = crumbs.getByRole('link', { name: 'Containers: Course Registration' });
    await expect(current).toHaveAttribute('aria-current', 'page');
    await expect(current).toBeFocused();

    await crumbs.getByRole('link', { name: 'Context: Course Registration' }).press('Enter');
    await expect(canvas(page)).toHaveAccessibleName('Canvas: System context view: Course Registration');
    await expect(crumbs.getByRole('link')).toHaveText(['Context: Course Registration']);
    expect((await hostCalls(page, 'view')).map((call) => call.selector)).toEqual(['containers of registration', 'context of registration']);
  });

  test('magnification changes --c4-zoom and Reset zoom returns to 100%', async ({ page }) => {
    await openEditor(page);
    const readout = magnification(page).getByRole('status');
    await expect(readout).toHaveText('100%');
    expect(await zoomProperty(page)).toBe('1');
    const openingWidth = await drawingWidth(page);

    await button(page, 'Zoom in').click();

    await expect(readout).toHaveText('110%');
    expect(await zoomProperty(page)).toBe('1.1');
    expect((await drawingWidth(page)) / openingWidth).toBeCloseTo(1.1, 2);

    await button(page, 'Zoom out').click();
    await button(page, 'Zoom out').click();
    await expect(readout).toHaveText('90%');

    await button(page, 'Reset zoom').click();

    await expect(readout).toHaveText('100%');
    expect(await zoomProperty(page)).toBe('1');
    expect(await drawingWidth(page)).toBeCloseTo(openingWidth, 1);
  });

  test('Ctrl/Cmd with =, -, and 0 magnifies only while the canvas has focus', async ({ page }) => {
    await openEditor(page);
    const readout = magnification(page).getByRole('status');

    await button(page, 'Zoom in').focus();
    await page.keyboard.press('ControlOrMeta+Equal');
    await expect(readout).toHaveText('100%');

    await canvas(page).focus();
    await page.keyboard.press('ControlOrMeta+Equal');
    await expect(readout).toHaveText('110%');
    await page.keyboard.press('ControlOrMeta+Minus');
    await page.keyboard.press('ControlOrMeta+Minus');
    await expect(readout).toHaveText('90%');
    await page.keyboard.press('ControlOrMeta+Digit0');
    await expect(readout).toHaveText('100%');
  });

  test('the editor opens at 100%, and Fit shows the whole drawing inside the canvas', async ({ page }) => {
    await openEditor(page, { view: 'components of api' });
    const overflow = () => canvas(page).evaluate((element) => ({
      horizontally: element.scrollWidth > element.clientWidth,
      vertically: element.scrollHeight > element.clientHeight,
    }));
    await expect(magnification(page).getByRole('status')).toHaveText('100%');
    expect(Object.values(await overflow()), 'the component view is larger than the canvas at 100%').toContain(true);

    await button(page, 'Fit').click();

    await expect(magnification(page).getByRole('status')).not.toHaveText('100%');
    expect(await overflow()).toEqual({ horizontally: false, vertically: false });
  });

  /** The boxes of the toolbar, outline, canvas, inspector, and panels, in DOM order, and the editor's box. */
  async function regionBoxes(page) {
    const boxes = await Promise.all([toolbar(page), region(page, 'Outline'), canvas(page), region(page, 'Inspector'), region(page, 'Panels')]
      .map((located) => located.boundingBox()));
    return { editorBox: await page.locator('#editor').boundingBox(), boxes };
  }

  function expectSpansAndStacks(editorBox, boxes) {
    for (const [index, box] of boxes.entries()) {
      expect(box.x, `region ${index} starts at the editor's left edge`).toBeCloseTo(editorBox.x, 0);
      expect(box.width, `region ${index} spans the editor`).toBeCloseTo(editorBox.width, 0);
    }
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index].y, `region ${index} sits below region ${index - 1}`).toBeGreaterThanOrEqual(boxes[index - 1].y + boxes[index - 1].height);
    }
  }

  test(`at ${NARROW_PX} px the outline sits beside the canvas, no taller than it, and the inspector and panels stack below`, async ({ page }) => {
    await openEditor(page, { parts: ['outline', 'inspector', 'panels', 'actions'], width: NARROW_PX });
    const { editorBox, boxes: [bar, outline, drawing, inspector, panels] } = await regionBoxes(page);
    expect(outline.x, 'the outline starts the row').toBeCloseTo(editorBox.x, 0);
    expect(drawing.x, 'the canvas follows it on the same row').toBeGreaterThanOrEqual(outline.x + outline.width);
    expect(drawing.x + drawing.width, 'and ends at the editor\'s right edge').toBeCloseTo(editorBox.x + editorBox.width, 0);
    expect(outline.y, 'the row starts below the toolbar').toBeGreaterThanOrEqual(bar.y + bar.height);
    expect(drawing.y).toBeLessThan(outline.y + outline.height);
    expect(outline.height, 'a long outline scrolls instead of pushing the canvas down').toBeLessThanOrEqual(drawing.height + 0.5);
    expectSpansAndStacks(editorBox, [inspector, panels]);
    expect(inspector.y).toBeGreaterThanOrEqual(Math.max(outline.y + outline.height, drawing.y + drawing.height));
  });

  for (const width of [STACKED_PX, PHONE_PX]) {
    test(`at ${width} px every region stacks, the outline in a short scroll box above the canvas`, async ({ page }) => {
      await openEditor(page, { parts: ['outline', 'inspector', 'panels', 'actions'], width });
      const { editorBox, boxes } = await regionBoxes(page);
      expectSpansAndStacks(editorBox, boxes);
      expect(boxes[1].height, 'the outline does not push the canvas a screen down').toBeLessThanOrEqual(16 * PARAGRAPH_PX + 0.5);
    });
  }

  test(`with outline: 'collapsed' the outline starts collapsed, and at ${NARROW_PX} px the drawing takes the rest of its row`, async ({ page }) => {
    await openEditor(page, { parts: ['outline', 'inspector', 'panels', 'actions'], width: NARROW_PX, mountOptions: { outline: 'collapsed' } });
    const outlineToggle = region(page, 'Outline').getByRole('button', { name: 'Outline' });
    await expect(outlineToggle).toHaveAttribute('aria-expanded', 'false');
    const { editorBox, boxes: [, outline, drawing] } = await regionBoxes(page);
    expect(drawing.x, 'the canvas follows the outline button on its row').toBeGreaterThanOrEqual(outline.x + outline.width);
    expect(drawing.y).toBeLessThan(outline.y + outline.height);
    expect(drawing.width, 'the collapsed outline keeps only its button\'s width').toBeGreaterThan(editorBox.width - 8 * PARAGRAPH_PX);

    await outlineToggle.click();
    await expect(region(page, 'Outline').getByText('outline stand-in')).toBeVisible();
  });

  test('size fill makes the canvas as tall as the editor\'s height leaves below the toolbar, and keeps that when the toolbar wraps', async ({ page }) => {
    const height = 900;
    await openEditor(page, { parts: ['outline', 'inspector', 'panels', 'actions'], width: STACKED_PX, height, mountOptions: { size: 'fill', outline: 'collapsed' } });
    const fillsToBottom = async () => {
      const [editorBox, drawing] = await Promise.all([page.locator('#editor').boundingBox(), canvas(page).boundingBox()]);
      return Math.round(editorBox.y + editorBox.height - (drawing.y + drawing.height));
    };
    // One gap (0.5em) between the canvas's bottom and the editor's, give or take a pixel of rounding.
    await expect.poll(fillsToBottom, 'the canvas reaches the bottom of the editor').toBeLessThanOrEqual(0.5 * PARAGRAPH_PX + 1);
    expect(await fillsToBottom()).toBeGreaterThanOrEqual(0);
    await expect(region(page, 'Inspector'), 'the inspector follows below, in the editor\'s own scroll').not.toBeInViewport();

    await page.evaluate(() => { document.getElementById('editor-host').style.width = '420px'; });
    await expect.poll(fillsToBottom, 'after the toolbar wraps, the canvas still ends at the editor\'s bottom').toBeLessThanOrEqual(0.5 * PARAGRAPH_PX + 1);
  });

  for (const { magnified, zoomInClicks } of [{ magnified: '100%', zoomInClicks: 0 }, { magnified: '200%', zoomInClicks: 10 }]) {
    test(`at ${PHONE_PX} px only the canvas region scrolls horizontally (drawing at ${magnified})`, async ({ page }) => {
      await openEditor(page, { parts: ['outline', 'inspector', 'panels', 'actions'], width: PHONE_PX });
      for (let click = 0; click < zoomInClicks; click += 1) await button(page, 'Zoom in').click();
      await expect(magnification(page).getByRole('status')).toHaveText(magnified);

      const outsideTheCanvas = await page.locator('#editor').evaluate((root) => {
        const canvasRegion = root.querySelector('[role="region"][aria-label^="Canvas"]');
        const right = root.getBoundingClientRect().right;
        const describe = (element) => `${element.tagName.toLowerCase()}.${element.className}`;
        const elements = [...root.querySelectorAll('*')].filter((element) => !canvasRegion.contains(element) && element.getClientRects().length > 0);
        return {
          stickingOut: elements.filter((element) => element.getBoundingClientRect().right > right + 0.5).map(describe),
          scrolling: elements.filter((element) => /auto|scroll/.test(getComputedStyle(element).overflowX)
            && element.scrollWidth > element.clientWidth + 1).map(describe),
        };
      });
      expect(outsideTheCanvas).toEqual({ stickingOut: [], scrolling: [] });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await canvas(page).evaluate((element) => ({
        overflowX: getComputedStyle(element).overflowX,
        scrolls: element.scrollWidth > element.clientWidth,
      }))).toEqual({ overflowX: 'auto', scrolls: true });
    });
  }

  test('at narrow widths the palette becomes an Add menu and file actions move into More', async ({ page }) => {
    await openEditor(page, { parts: ['actions'], width: STACKED_PX });
    await expect(palette(page)).toBeHidden();
    await expect(button(page, 'Download YAML')).toBeHidden();

    const more = button(page, 'More');
    await more.click();
    const moreMenu = page.getByRole('menu', { name: 'More' });
    await expect(moreMenu.getByRole('menuitem')).toHaveText(['Reset layout', 'Open…', 'Download YAML', 'Download SVG']);
    await expect(moreMenu.getByRole('menuitem', { name: 'Reset layout' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(moreMenu).toBeHidden();
    await expect(more).toBeFocused();
    expect((await hostCalls(page, 'saveFile')).map((call) => call.args[0])).toEqual([REFERENCE_MODEL]);

    await more.click();
    await page.keyboard.press('Escape');
    await expect(moreMenu).toBeHidden();
    await expect(more).toBeFocused();

    await button(page, 'Add').click();
    await page.getByRole('menu', { name: 'Add' }).getByRole('menuitem', { name: 'Container' }).click();
    expect(await page.evaluate(() => window.paletteUses)).toEqual([
      { kind: 'element', elementType: 'container', scopeId: 'registration', source: 'menu' },
    ]);
  });

  test('the palette offers the types of the current level and passes the chosen tile to the actions hook', async ({ page }) => {
    await openEditor(page, { view: 'containers of registration', parts: ['actions'] });
    await expect(palette(page).getByRole('button')).toHaveText(['Container']);

    // A mouse click reaches both hooks: the press may start a drag to the canvas, and only the click itself adds.
    await palette(page).getByRole('button', { name: 'Container' }).click();
    expect(await page.evaluate(() => window.paletteUses)).toEqual([
      { kind: 'element', elementType: 'container', scopeId: 'registration', source: 'drag' },
      { kind: 'element', elementType: 'container', scopeId: 'registration', source: 'tile' },
    ]);

    await viewButtons(page).getByRole('button', { name: 'Context' }).click();
    await expect(palette(page).getByRole('button')).toHaveText(['Person', 'Software system']);
    await viewButtons(page).getByRole('button', { name: 'Dynamic' }).click();
    await expect(palette(page).getByRole('button')).toHaveText(['Step', 'Fragment']);
    await viewButtons(page).getByRole('button', { name: 'Deployment' }).click();
    await expect(palette(page).getByRole('button')).toHaveText(['Node', 'Infrastructure node', 'Host a container or system']);
  });

  test('the expert profile can add any element type from the palette', async ({ page }) => {
    await openEditor(page, { view: 'components of api', profile: 'expert', parts: ['actions'] });
    const allTypes = button(page, 'All types');
    await expect(allTypes).toHaveAttribute('aria-pressed', 'false');

    await allTypes.click();

    await expect(allTypes).toHaveAttribute('aria-pressed', 'true');
    await expect(palette(page).getByRole('button')).toHaveText(['Component', 'Person', 'Software system', 'Container', 'Code element']);
  });

  test('a YAML error pauses the palette with a visible reason', async ({ page }) => {
    await openEditor(page, { parts: ['actions'] });
    const tile = palette(page).getByRole('button', { name: 'Container' });

    await page.evaluate(() => window.editor.setText('systems: [unclosed'));

    await expect(tile).toHaveAttribute('aria-disabled', 'true');
    await expect(tile).toHaveAccessibleDescription(/YAML errors/);
    await expect(toolbar(page).getByText(/YAML errors/)).toBeVisible();
    // Playwright will not click an aria-disabled control on its own; a user can, and nothing may happen.
    await tile.click({ force: true });
    expect(await page.evaluate(() => window.paletteUses)).toEqual([]);
  });

  // WCAG 4.1.3: the reason appears without moving focus, so the live region says it; and says when editing returns.
  test('the live region says when visual editing pauses for a YAML error and when it is back on', async ({ page }) => {
    await openEditor(page, { parts: ['actions'] });
    const editor = page.locator('#editor');
    const announced = (text) => editor.getByRole('status').filter({ hasText: text });

    await page.evaluate(() => window.editor.setText('systems: [unclosed'));
    await expect(announced('Visual editing is paused until the YAML errors are fixed.')).toHaveCount(1);

    await page.evaluate((text) => window.editor.setText(text), REFERENCE_MODEL);
    await expect(announced('Visual editing is back on.')).toHaveCount(1);
    await expect(toolbar(page).getByText(/YAML errors/)).toBeHidden();
  });

  test('Reset layout unpins the view in one undoable step', async ({ page }) => {
    await openEditor(page, { text: PINNED_MODEL });
    const undo = button(page, 'Undo');
    const resetLayout = button(page, 'Reset layout');
    await expect(undo).toHaveAttribute('aria-disabled', 'true');

    await resetLayout.click();

    const [change] = await hostCalls(page, 'text');
    expect(change.label).toBe('Reset layout');
    expect(change.text).toBe(REFERENCE_MODEL);
    await expect(resetLayout).toHaveAttribute('aria-disabled', 'true');
    await expect(undo).toHaveAttribute('aria-disabled', 'false');

    await undo.click();

    expect((await hostCalls(page, 'text')).at(-1).text).toBe(PINNED_MODEL);
    await expect(button(page, 'Redo')).toHaveAttribute('aria-disabled', 'false');
    await expect(resetLayout).toHaveAttribute('aria-disabled', 'false');
  });

  test('file actions hand the YAML, the drawing, and UML source to the host', async ({ page }) => {
    await openEditor(page, { view: 'containers of registration' });
    await expect(button(page, 'Copy ArchUML source')).toBeHidden();

    await button(page, 'Download YAML').click();
    await button(page, 'Download SVG').click();

    expect((await hostCalls(page, 'saveFile')).map((call) => call.args[0])).toEqual([REFERENCE_MODEL]);
    const [exported] = await hostCalls(page, 'exportSvg');
    expect(exported.args[0]).toMatch(/^<svg[\s\S]*Registration API[\s\S]*<\/svg>$/);

    await viewButtons(page).getByRole('button', { name: 'Dynamic' }).click();
    await button(page, 'Copy ArchUML source').click();
    const [copied] = await hostCalls(page, 'copyText');
    expect(copied.args[0]).toMatch(/^@startuml[\s\S]*Registration Coordinator/);
  });

  test('only Add relationship, Undo, Redo, Full screen, and Help announce keyboard shortcuts', async ({ page }) => {
    await openEditor(page, { parts: ['actions'] });

    await expect(page.locator('#editor [aria-keyshortcuts]')).toHaveCount(5);
    await expect(button(page, 'Undo')).toHaveAttribute('aria-keyshortcuts', 'Control+Z Meta+Z');
    await expect(button(page, 'Redo')).toHaveAttribute('aria-keyshortcuts', 'Control+Y Control+Shift+Z Meta+Shift+Z Meta+Y');
    await expect(button(page, 'Add relationship')).toHaveAttribute('aria-keyshortcuts', 'C');
    await expect(button(page, 'Full screen')).toHaveAttribute('aria-keyshortcuts', 'F');
    await expect(button(page, 'Help')).toHaveAttribute('aria-keyshortcuts', 'Shift+?');
  });

  test('F toggles full screen while the canvas has focus and nowhere else', async ({ page }) => {
    await openEditor(page);
    const fullScreen = button(page, 'Full screen');

    await button(page, 'Zoom in').focus();
    await page.keyboard.press('f');
    await expect(fullScreen).toHaveAttribute('aria-pressed', 'false');

    await canvas(page).focus();
    await page.keyboard.press('f');
    await expect(fullScreen).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('f');
    await expect(fullScreen).toHaveAttribute('aria-pressed', 'false');
  });

  test('without the Fullscreen API, the full-screen overlay keeps Tab out of the page it covers, and Escape leaves it', async ({ page }) => {
    // The overlay fallback runs where the browser has no Fullscreen API (iPhone Safari) or refuses it (an iframe).
    await loadEditorScripts(page);
    await page.evaluate((modelText) => {
      Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined, configurable: true });
      const pageButton = (label) => Object.assign(document.createElement('button'), { textContent: label });
      document.querySelector('main').prepend(pageButton('Page control before'));
      document.querySelector('main').append(pageButton('Page control after'));
      window.ArchUMLC4Editor.mount(document.getElementById('editor'), {
        text: modelText, view: 'containers of registration', host: window.referenceHost(),
      });
    }, REFERENCE_MODEL);
    const pageControls = page.getByRole('button', { name: /^Page control/ });
    const fullScreen = button(page, 'Full screen');

    await canvas(page).focus();
    await page.keyboard.press('f');
    await expect(fullScreen).toHaveAttribute('aria-pressed', 'true');

    const tabbable = await page.locator('#editor').locator('button, [tabindex="0"], select, input').count();
    for (const key of ['Tab', 'Shift+Tab']) {
      for (let step = 0; step <= tabbable + 1; step += 1) {
        await page.keyboard.press(key);
        await expect(pageControls.first()).not.toBeFocused();
        await expect(pageControls.last()).not.toBeFocused();
      }
    }

    await page.keyboard.press('Escape');
    await expect(fullScreen).toHaveAttribute('aria-pressed', 'false');
    await pageControls.last().focus();
    await expect(pageControls.last()).toBeFocused();
  });

  test('Shift+? in the canvas opens Help, and Escape returns focus to the canvas', async ({ page }) => {
    await openEditor(page);

    await canvas(page).focus();
    await page.keyboard.press('Shift+?');

    const help = page.getByRole('dialog', { name: 'C4 editor help' });
    await expect(help).toBeVisible();
    await expect(help).toContainText('Shift+?');
    await a11yCheckpoint(page, 'C4 editor help dialog', { feature: 'c4-editor', include: '#editor' });
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
    await expect(canvas(page)).toBeFocused();
  });

  test('toolbar text and controls are paragraph-sized', async ({ page }) => {
    await openEditor(page, { parts: ['actions'] });
    const sizes = await toolbar(page).evaluate((element) => [...element.querySelectorAll('button, select, a, label, output, span')]
      .filter((node) => node.getClientRects().length > 0 && node.textContent.trim())
      .map((node) => getComputedStyle(node).fontSize));

    expect(sizes.length).toBeGreaterThan(10);
    expect(new Set(sizes)).toEqual(new Set([`${PARAGRAPH_PX}px`]));
  });

  test('destroy removes listeners', async ({ page }) => {
    await loadEditorScripts(page);
    const client = await page.context().newCDPSession(page);
    async function listenerCount() {
      let total = 0;
      for (const expression of ['window', 'document', 'document.getElementById("editor")']) {
        const { result } = await client.send('Runtime.evaluate', { expression });
        const { listeners } = await client.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
        total += listeners.length;
      }
      return total;
    }
    const mountReference = (width) => page.evaluate(({ text, hostWidth }) => {
      document.getElementById('editor-host').style.width = `${hostWidth}px`;
      window.editor = window.ArchUMLC4Editor.mount(document.getElementById('editor'), { text, host: window.referenceHost() });
    }, { text: REFERENCE_MODEL, hostWidth: width });
    // A first mount lets the shared ArchUML scripts install their one-time page listeners before the count.
    await mountReference(1200);
    await page.evaluate(() => window.editor.destroy());
    const before = await listenerCount();

    await mountReference(STACKED_PX);
    await button(page, 'Zoom in').click();
    await canvas(page).focus();
    await page.keyboard.press('Shift+?');
    await page.keyboard.press('Escape');
    await button(page, 'More').click();
    await expect(page.getByRole('menu', { name: 'More' })).toBeVisible();
    expect(await listenerCount()).toBeGreaterThan(before);
    await page.evaluate(() => window.editor.destroy());

    expect(await listenerCount()).toBe(before);
    // The host's element is left as the editor found it.
    await expect(page.locator('#editor > *')).toHaveCount(0);
    expect(await page.locator('#editor').evaluate((element) => element.getAttributeNames())).toEqual(['id']);
  });
});
