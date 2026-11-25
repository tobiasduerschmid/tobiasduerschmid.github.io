// @ts-check
// What the diagram editor module adds for a host surface (UML-view editing spec §2.4, §7.2–§7.4, §7.8; plan Task 38):
// a host that brings its own surface mounts the module with `surface: { attach(session) }` and `viewport: 'host'`.
// The host then sizes, pans, and zooms the drawing; the module applies no view transform of its own and maps a pointer
// through the drawing's screen CTM. Target marks show which candidates of a gesture with an open end are possible:
// the module's own gestures mark them when they start, as the host's markTargets does; the two marks differ by shape,
// not only by colour, and print hides them.
//
// The page is built by the test (page.setContent): the ArchUML bundle and only the `core` group of the diagram editor,
// as the C4 editor loads it, and the module's stylesheet. The host is a fake built inside the page by the harness
// below: it draws a class diagram with the bundle, scales the drawing's frame by its own zoom, and gives the module a
// recording fake adapter (its document is three classes, read as contents() the way an adapter reads a drawing) and a
// fake surface that only records being attached and detached.
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const ARCHUML = path.join(__dirname, '../js/ArchUML');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'diagram-editor/manifest.json'), 'utf8'));
const CORE_SCRIPTS = MANIFEST.core.map((file) => path.join(ARCHUML, file));
const BUNDLE = path.join(ARCHUML, 'uml-bundle.js');
const MODULE_STYLESHEET = path.join(ARCHUML, 'css/diagram-editor.css');
const HARNESS = '__hostSurfaceHarness';

const CLASSES = ['Order', 'Customer', 'Invoice'];
const SOURCE = ['@startuml', ...CLASSES.map((name) => `class ${name}`), 'Order --> Customer', '@enduml'].join('\n');

// The host's frame is wider than the drawing's aspect, so the drawing is letterboxed inside it (preserveAspectRatio
// meet): only the screen CTM maps a pointer into the drawing there.
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>A host surface</title>
<style>
  body { margin: 0; font-size: 20px; }
  .host-frame { position: absolute; left: 40px; top: 30px; transform-origin: 0 0; }
  .host-canvas svg { display: block; width: 900px; height: 300px; }
</style></head><body><main><h1>A host surface</h1>
<section class="host" aria-label="Host editor"><div class="host-frame"><div class="host-canvas"></div></div></section>
</main></body></html>`;

/** Made in the page: the fake host, its adapter and surface, and what they record. Its one global is `harnessName`. */
function installHarness({ harnessName, source, classes }) {
  const record = { operations: [], targets: [], announcements: [], attached: 0, detached: 0 };
  const root = document.querySelector('.host');
  const frame = root.querySelector('.host-frame');
  const canvas = root.querySelector('.host-canvas');
  const bundle = {};
  for (const name of ['UMLShared', 'UMLClassDiagram']) {
    Object.defineProperty(bundle, name, { enumerable: true, get: () => window[name] });
  }
  const state = { session: null, revision: 1, advice: null };
  function draw() {
    canvas.textContent = '';
    window.UMLClassDiagram.render(canvas, source);
    const svg = canvas.querySelector('svg');
    // The host sizes the drawing: its frame, not the renderer's width.
    svg.removeAttribute('style');
  }
  const adapter = {
    contents: () => ({
      type: 'class',
      revision: 'r' + state.revision,
      elements: classes.map((name) => ({ id: name, kind: 'class', label: name, name, axis: 'xy', parentId: null, members: [] })),
      relations: [],
      fragments: [],
      activations: [],
      layoutPositions: {},
      layoutRoutes: {},
      lines: [],
      ownedElementIds: () => [],
    }),
    tools: () => ({ elements: [], relations: [], unavailable: [] }),
    can: () => ({ ok: true, select: null, message: null }),
    targets(request) { record.targets.push(request); return state.advice; },
    apply(operation) { record.operations.push(operation); return { ok: true, select: null, message: null }; },
  };
  const host = {
    announce(message) { record.announcements.push(message); },
    status() {},
    redraw() { draw(); state.session.sync({ svg: canvas.querySelector('svg'), revision: adapter.contents().revision }); },
  };
  const surface = {
    attach(session) {
      record.attached += 1;
      record.attachedWithSession = typeof session.sync === 'function';
      return { detach() { record.detached += 1; } };
    },
  };
  window[harnessName] = {
    record,
    mount() {
      draw();
      state.session = window.ArchUMLDiagramEditor.mount({
        root, canvas, adapter, host, surface, viewport: 'host', idPrefix: 'h-',
        env: { document, now: () => 0, schedule: (fn, ms) => { const id = setTimeout(fn, ms); return () => clearTimeout(id); }, bundle },
      });
      state.session.sync({ svg: canvas.querySelector('svg'), revision: adapter.contents().revision });
    },
    /** The host's zoom: the frame scales the drawing; the module is not told. */
    zoom(level) { frame.style.transform = `scale(${level})`; },
    advise(advice) { state.advice = advice; },
    session: () => state.session,
    svg: () => canvas.querySelector('svg'),
  };
}

async function openHost(page) {
  await page.setContent(PAGE);
  await page.addScriptTag({ path: BUNDLE });
  for (const script of CORE_SCRIPTS) await page.addScriptTag({ path: script });
  await page.addStyleTag({ path: MODULE_STYLESHEET });
  await page.addScriptTag({ content: `(${installHarness.toString()})(${JSON.stringify({ harnessName: HARNESS, source: SOURCE, classes: CLASSES })});` });
  await page.evaluate((name) => window[name].mount(), HARNESS);
}

/** Runs `fn(harness, value)` in the page. */
function harness(page, fn, value) {
  return page.evaluate(({ name, source, arg }) => new Function('h', 'value', `return (${source})(h, value);`)(window[name], arg),
    { name: HARNESS, source: fn.toString(), arg: value });
}

test.describe('a host surface', () => {
  test('mount attaches the host surface once with core scripts alone, and destroy detaches it and removes the module\'s layer', async ({ page }) => {
    await openHost(page);
    expect(await harness(page, (h) => ({ attached: h.record.attached, detached: h.record.detached, globalsHaveText: !!window.ArchUMLDiagramEditorParts.textRead })))
      .toEqual({ attached: 1, detached: 0, globalsHaveText: false });

    const layer = page.locator('.host-canvas .uml-pg-edit-layer');
    await expect(layer, 'the module adds its hit layer to the host\'s drawing').toHaveCount(1);
    await expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(await layer.locator('[tabindex]').count(), 'the host owns the tab stops').toBe(0);
    expect(await layer.locator('.uml-pg-edit-hitbox').evaluateAll((boxes) => boxes.map((box) => box.getAttribute('data-layout-id')).sort()))
      .toEqual([...CLASSES].sort());

    await harness(page, (h) => h.session().destroy());

    expect(await harness(page, (h) => h.record.detached)).toBe(1);
    await expect(layer).toHaveCount(0);
  });

  for (const level of [0.5, 2]) {
    test(`under viewport host the module applies no transform and a click maps through the screen CTM at ${level * 100}% host zoom`, async ({ page }) => {
      await openHost(page);
      const drawnBefore = await harness(page, (h) => ['viewBox', 'width', 'height', 'style', 'transform'].map((name) => h.svg().getAttribute(name)));
      await harness(page, (h, zoom) => h.zoom(zoom), level);

      // The point of the drawing's coordinates (420, 150), where the host shows it on the screen now.
      const result = await harness(page, (h) => {
        const svg = h.svg();
        const target = { x: 420, y: 150 };
        const onScreen = new DOMPoint(target.x, target.y).matrixTransform(svg.getScreenCTM());
        const box = h.session().scene().editables(svg).find((item) => item.id === 'Customer').box;
        const placing = h.session().startPlacing({ ref: { id: 'Customer', kind: 'node' } });
        return placing.commit({ clientX: onScreen.x, clientY: onScreen.y }).then(() => ({
          box,
          positions: h.record.operations.map((operation) => ({ op: operation.op, positions: operation.positions })),
          transform: svg.style.transform,
        }));
      });

      expect(result.transform, 'the module sets no view transform on the drawing').toBe('');
      expect(await harness(page, (h) => ['viewBox', 'width', 'height', 'style', 'transform'].map((name) => h.svg().getAttribute(name))),
        'the module leaves the drawing\'s size and view box to the host').toEqual(drawnBefore);
      expect(result.positions.length).toBe(1);
      expect(result.positions[0].op).toBe('layout.set');
      // The box's centre goes to the clicked point: its corner is half its size up and left of it.
      const placed = result.positions[0].positions.Customer;
      expect(placed.x).toBeCloseTo(420 - result.box.width / 2, 1);
      expect(placed.y).toBeCloseTo(150 - result.box.height / 2, 1);
    });
  }

  test('the two marks differ by shape, not only by colour', async ({ page }) => {
    await openHost(page);
    await harness(page, (h) => h.advise([
      { ref: 'Invoice', ok: false, code: 'not-in-model/association', summary: 'This design model records no association' },
      { ref: 'Customer', ok: true, code: null, summary: null },
    ]));

    const order = await harness(page, (h) => h.session().markTargets({ op: 'relation.add', tool: 'association', from: 'Order', label: null, open: 'to' })
      .map((candidate) => candidate.ref));

    expect(order, 'keyboard order lists the possible targets first').toEqual(['Customer', 'Invoice']);
    expect(await harness(page, (h) => h.record.targets.length), 'the advice is asked once').toBe(1);
    const possible = page.locator('.uml-pg-target-mark.is-possible[data-target-ref="Customer"]');
    const notPossible = page.locator('.uml-pg-target-mark.is-not-possible[data-target-ref="Invoice"]');
    await expect(possible).toHaveCount(1);
    await expect(notPossible).toHaveCount(1);

    const shapeOf = (mark) => mark.evaluate((node) => {
      const outline = getComputedStyle(node.querySelector('.uml-pg-target-mark-outline'));
      return {
        dashed: outline.strokeDasharray !== 'none' && outline.strokeDasharray !== '',
        width: parseFloat(outline.strokeWidth),
        signs: Array.from(node.querySelectorAll('.uml-pg-target-mark-sign'), (sign) => sign.tagName).sort(),
        hidden: node.getAttribute('aria-hidden'),
        pointerEvents: getComputedStyle(node).pointerEvents,
      };
    });
    const possibleShape = await shapeOf(possible);
    const notPossibleShape = await shapeOf(notPossible);
    expect(possibleShape.dashed, 'a possible target has a dashed outline').toBe(true);
    expect(notPossibleShape.dashed, 'a target that is not possible has a solid one').toBe(false);
    expect(possibleShape.width, 'the possible outline is the thick one').toBeGreaterThanOrEqual(2 * notPossibleShape.width);
    expect(possibleShape.signs, 'a possible target has no sign').toEqual([]);
    expect(notPossibleShape.signs, 'a target that is not possible has a struck-through circle').toEqual(['circle', 'line']);
    for (const shape of [possibleShape, notPossibleShape]) {
      expect(shape.hidden, 'marks are drawing, not content').toBe('true');
      expect(shape.pointerEvents, 'a press passes through a mark').toBe('none');
    }

    await harness(page, (h) => h.session().clearTargets());
    await expect(page.locator('.uml-pg-target-mark')).toHaveCount(0);
  });

  test('a gesture with an open end marks its candidates itself: a new line from a handle, released on one marked not possible', async ({ page }) => {
    await openHost(page);
    await harness(page, (h) => h.advise([
      { ref: 'Invoice', ok: false, code: 'not-in-model/association', summary: 'This design model records no association' },
      { ref: 'Customer', ok: true, code: null, summary: null },
    ]));

    // The host's press on Order's connect handle, at the box's right edge, as the module's extend-handle gesture takes it.
    await harness(page, (h) => {
      const svg = h.svg();
      const session = h.session();
      const order = session.scene().editables(svg).find((item) => item.id === 'Order');
      const handle = { x: order.box.x + order.box.width, y: order.box.y + order.box.height / 2 };
      const onScreen = new DOMPoint(handle.x, handle.y).matrixTransform(svg.getScreenCTM());
      const at = { clientX: onScreen.x, clientY: onScreen.y, pointerId: 1, preventDefault() {}, stopPropagation() {} };
      const factory = session.gestures.find((gesture) => gesture.id === 'extend-handle');
      window.__lineDrag = factory.start(at, {
        site: 'extend-handle', svg, layer: svg.querySelector('.uml-pg-edit-layer'), x: handle.x, y: handle.y,
        handle: { setPointerCapture() {} }, item: order, hitbox: null,
      });
    });

    expect(await harness(page, (h) => h.record.targets.map((request) => ({ op: request.op, from: request.from, open: request.open, hasTo: 'to' in request }))),
      'the gesture asks the advice once, for its open end').toEqual([{ op: 'relation.add', from: 'Order', open: 'to', hasTo: false }]);
    await expect(page.locator('.uml-pg-target-mark.is-possible[data-target-ref="Customer"]')).toHaveCount(1);
    await expect(page.locator('.uml-pg-target-mark.is-not-possible[data-target-ref="Invoice"]')).toHaveCount(1);
    expect(await harness(page, (h) => h.session().targets().map((candidate) => candidate.ref))).toEqual(['Customer', 'Invoice']);

    // Released over Invoice, where the host shows it on the screen now.
    await harness(page, (h) => {
      const svg = h.svg();
      const invoice = h.session().scene().editables(svg).find((item) => item.id === 'Invoice').box;
      const onScreen = new DOMPoint(invoice.x + invoice.width / 2, invoice.y + invoice.height / 2).matrixTransform(svg.getScreenCTM());
      const at = { clientX: onScreen.x, clientY: onScreen.y, pointerId: 1, preventDefault() {}, stopPropagation() {} };
      window.__lineDrag.move(at);
      window.__lineDrag.end(at);
    });

    expect(await harness(page, (h) => h.record.operations.length), 'a release on a target marked not possible adds nothing').toBe(0);
    expect(await harness(page, (h) => h.record.announcements)).toContain('This design model records no association');
    await expect(page.locator('.uml-pg-target-mark'), 'the marks go with the gesture').toHaveCount(0);
  });

  test('print hides the marks', async ({ page }) => {
    await openHost(page);
    await harness(page, (h) => {
      h.advise([{ ref: 'Customer', ok: true, code: null, summary: null }, { ref: 'Invoice', ok: false, code: 'x', summary: 'No' }]);
      h.session().markTargets({ op: 'relation.add', tool: 'association', from: 'Order', label: null, open: 'to' });
    });
    const marks = page.locator('.uml-pg-target-mark');
    await expect(marks).toHaveCount(2);
    await expect(marks.first()).toBeVisible();

    await page.emulateMedia({ media: 'print' });

    await expect(marks.nth(0)).toBeHidden();
    await expect(marks.nth(1)).toBeHidden();
  });
});
