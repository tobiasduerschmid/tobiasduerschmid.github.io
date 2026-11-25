// @ts-check
// The diagram editor module's contract with every host (UML-view editing spec §2.1, §2.4, §3.7, §9.3; plan Task 25,
// stage R6): two sessions mounted on one page share nothing, the module touches nothing of the page beyond its two
// global names and its own roots, every change reaches the document as an operation of its adapter, a gesture whose
// adapter gives no target advice marks no target, and destroy takes back everything the session added.
//
// The page is built by the test (page.setContent): two editors, each a root with the elements the classic surface
// works with, the ArchUML bundle, and the diagram editor's scripts in manifest order. The classic surface reads the
// ArchUML grammar of the `text` group, so the page loads `core` and `text`, as the UML editor's pages do. Each session
// has a recording fake adapter and a fake host, built inside the page by the harness below:
// - the adapter keeps its document in memory, reads it and rewrites it with the text group's pure functions, and logs
//   every operation it is asked to apply; its `targets` answers null ("no advice") and logs the request;
// - the host draws the document with the bundle into the editor's canvas and syncs the session, and records what it is
//   told; its `env.schedule` queues timers that run only when the test runs them, so a timer still pending at destroy
//   is seen.
// Listeners are read through the Chrome DevTools Protocol (DOMDebugger.getEventListeners), which is Chromium's.
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const ARCHUML = path.join(__dirname, '../js/ArchUML');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'diagram-editor/manifest.json'), 'utf8'));
const MODULE_SCRIPTS = [...MANIFEST.core, ...MANIFEST.text].map((file) => path.join(ARCHUML, file));
const BUNDLE = path.join(ARCHUML, 'uml-bundle.js');
const MODULE_STYLESHEET = path.join(ARCHUML, 'css/diagram-editor.css');
// The module's two global names (spec §2.2).
const MODULE_GLOBALS = ['ArchUMLDiagramEditor', 'ArchUMLDiagramEditorParts'];
// The harness's one global name, made before the page's globals are first counted.
const HARNESS = '__diagramEditorContract';

const ORDERS = ['@startuml', 'class Order', 'class Customer', 'Order --> Customer', '@enduml'].join('\n');

test.skip(({ browserName }) => browserName !== 'chromium', 'listener counts are read through DOMDebugger.getEventListeners, which is Chromium\'s');

/** One editor's markup: a labelled root holding the page elements the classic surface works with. */
function editorHtml(name) {
  return `<section class="editor" id="editor-${name}" aria-label="Editor ${name}">
  <div class="palette" role="region" aria-label="Editor ${name} palette">
    <div class="palette-elements"></div>
    <div class="palette-relations"></div>
    <button type="button" class="tool-cancel" hidden>Cancel tool</button>
  </div>
  <label><input type="checkbox" class="edit-toggle" checked> Edit on the canvas</label>
  <label><input type="checkbox" class="snap-toggle"> Snap to grid</label>
  <p class="status" role="status"></p>
  <div class="preview"><div class="canvas"></div></div>
</section>`;
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Two diagram editors</title>
<style>
  body { margin: 0; font-size: 20px; }
  .editor { display: inline-block; vertical-align: top; width: 600px; margin: 8px; }
  .preview { position: relative; width: 580px; height: 380px; overflow: auto; }
</style></head><body><main><h1>Two diagram editors</h1>${editorHtml('A')}${editorHtml('B')}</main>
<p id="outside">Text outside both editors.</p></body></html>`;

/**
 * Made in the page before anything else: the traps that log every read or write of storage, cookies, the network,
 * and the clipboard, and the harness that mounts and drives the sessions. It is the page's one global of its own.
 */
function installHarness(harnessName) {
  const accesses = [];
  const note = (what) => accesses.push(what);
  const storage = (name) => ({ getItem() { note(name + '.getItem'); return null; }, setItem() { note(name + '.setItem'); }, removeItem() { note(name + '.removeItem'); }, clear() { note(name + '.clear'); }, key() { note(name + '.key'); return null; }, length: 0 });
  for (const name of ['localStorage', 'sessionStorage']) {
    const stub = storage(name);
    Object.defineProperty(window, name, { configurable: true, get() { note(name); return stub; } });
  }
  Object.defineProperty(document, 'cookie', { configurable: true, get() { note('document.cookie read'); return ''; }, set() { note('document.cookie write'); } });
  window.fetch = function () { note('fetch'); return Promise.reject(new Error('no network in this test')); };
  window.XMLHttpRequest = /** @type {any} */ (function () { note('XMLHttpRequest'); });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, get() { note('navigator.clipboard'); return undefined; } });

  // The bundle's renderers and parsers, read when a reader or a rewrite runs, as the UML editor's host passes them.
  const bundle = {};
  for (const name of ['UMLShared', 'UMLClassDiagram']) {
    Object.defineProperty(bundle, name, { enumerable: true, get: () => window[name] });
  }
  const editors = {};

  /** The editor `name`: its root, its elements, and the record of what its adapter, host, and env were asked. */
  function editor(name) {
    if (editors[name]) return editors[name];
    const root = document.getElementById('editor-' + name);
    const record = { operations: [], writes: [], targets: [], announcements: [], timers: [] };
    const state = { text: '', session: null };
    const canvas = root.querySelector('.canvas');
    function draw() {
      canvas.textContent = '';
      window.UMLClassDiagram.render(canvas, state.text);
    }
    function sync(restore) {
      state.session.sync({ svg: canvas.querySelector('svg'), revision: adapter.contents().revision }, { restore: restore || null });
    }
    const inner = window.ArchUMLDiagramEditor.createTextAdapter({
      read: () => state.text,
      type: () => 'class',
      bundle,
      write(text, info) {
        record.writes.push(info.operation);
        state.text = text;
        if (info.select === null) state.session.select(null);
        draw();
        sync(info.select && !info.select.ids ? info.select : null);
      },
    });
    // The recording fake adapter: the document's reading and rewrites are the text group's, the log is the test's.
    const adapter = {
      contents: () => inner.contents(),
      tools: () => inner.tools(),
      schemas: inner.schemas,
      serializers: inner.serializers,
      can: (operation) => inner.can(operation),
      targets(request) { record.targets.push(request); return null; },
      apply(operation) { record.operations.push(operation); return inner.apply(operation); },
    };
    const host = {
      announce(message) { record.announcements.push(message); },
      status(text) { root.querySelector('.status').textContent = text; },
      confirm: () => Promise.resolve(true),
      undo() {}, redo() {}, canUndo: () => false, canRedo: () => false,
      onSelectionChange() {}, openProperties() {},
      registerEscape(layer) {
        document.addEventListener('keydown', layer.onKey, true);
        return () => document.removeEventListener('keydown', layer.onKey, true);
      },
      autoLayout: () => ({ positions: {} }),
      redraw() { draw(); sync(null); },
      startUndoStep() {},
      offersForm: () => false,
      openForm() {},
    };
    const env = {
      document,
      now: () => 0,
      schedule(fn, ms) {
        const timer = { ms, state: 'pending', fn };
        record.timers.push(timer);
        return function cancel() { if (timer.state === 'pending') timer.state = 'cancelled'; };
      },
      bundle,
    };
    editors[name] = { root, canvas, record, state, adapter, host, env, draw, sync };
    return editors[name];
  }

  window[harnessName] = {
    accesses,
    /** Draws `text` in editor `name`, as its host does before it mounts a session. */
    show(name, text) {
      const e = editor(name);
      e.state.text = text;
      e.draw();
    },
    /**
     * Mounts a classic session on editor `name` with `idPrefix` (and the further mount options `extra`), builds its
     * palette, and syncs the drawing.
     */
    mount(name, idPrefix, extra) {
      const e = editor(name);
      const el = (cls) => e.root.querySelector('.' + cls);
      e.state.session = window.ArchUMLDiagramEditor.mount({
        ...(extra || {}),
        root: e.root,
        canvas: e.canvas,
        adapter: e.adapter,
        host: e.host,
        surface: 'classic',
        idPrefix,
        env: e.env,
        elements: {
          previewPane: el('preview'),
          status: el('status'),
          editToggle: el('edit-toggle'),
          snapToggle: el('snap-toggle'),
          palette: el('palette'),
          paletteElements: el('palette-elements'),
          paletteRelations: el('palette-relations'),
          toolCancel: el('tool-cancel'),
        },
      });
      e.state.session.commands.rebuildPalette();
      e.sync(null);
    },
    session: (name) => editor(name).state.session,
    /** Starts a move without a press in editor `name` and keeps its placing, which `placing(name)` reads. */
    startPlacing(name, target) {
      const e = editor(name);
      e.state.placing = e.state.session.startPlacing(target);
      return !!e.state.placing;
    },
    placing: (name) => editor(name).state.placing,
    record: (name) => editor(name).record,
    text: (name) => editor(name).state.text,
    /** The timers editor `name`'s session scheduled, with their state. */
    timers: (name) => editor(name).record.timers.map((timer) => ({ ms: timer.ms, state: timer.state })),
    /** Runs the session's pending timers, as time passing would. */
    runTimers(name) {
      for (const timer of editor(name).record.timers) {
        if (timer.state !== 'pending') continue;
        timer.state = 'ran';
        timer.fn();
      }
    },
    ownGlobals: () => Object.getOwnPropertyNames(window).sort(),
  };
}

/** The page with both editors, the bundle, the harness, and the module stylesheet, before the module's scripts. */
async function openPageWithoutModule(page) {
  await page.setContent(PAGE);
  await page.addScriptTag({ content: `(${installHarness.toString()})(${JSON.stringify(HARNESS)});` });
  await page.addScriptTag({ path: BUNDLE });
  await page.addStyleTag({ path: MODULE_STYLESHEET });
}

async function loadModule(page) {
  for (const script of MODULE_SCRIPTS) await page.addScriptTag({ path: script });
}

/** The page with ORDERS drawn in both editors and a session mounted on each (idPrefix `a-` and `b-`). */
async function openTwoEditors(page) {
  await openPageWithoutModule(page);
  await loadModule(page);
  await harness(page, (h) => {
    h.show('A', h.orders);
    h.show('B', h.orders);
    h.mount('A', 'a-');
    h.mount('B', 'b-');
  });
  return { a: page.getByRole('region', { name: 'Editor A', exact: true }), b: page.getByRole('region', { name: 'Editor B', exact: true }) };
}

/** Runs `fn(harness)` in the page, with the test's ORDERS text at `harness.orders`. */
function harness(page, fn, arg) {
  return page.evaluate(({ name, source, orders, value }) => {
    const h = Object.assign({ orders }, window[name]);
    // eslint-disable-next-line no-new-func
    return new Function('h', 'value', `return (${source})(h, value);`)(h, value);
  }, { name: HARNESS, source: fn.toString(), orders: ORDERS, value: arg });
}

/** The diagram item of class `name` in `editor`. */
function item(editor, name) {
  return editor.getByRole('button', { name: new RegExp(`^Element ${name} — `) });
}

async function centreOf(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('the locator has no box on the page');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Clicks the centre of `locator` with the mouse: the hit layer's visual box lies over each item's target. */
async function clickCentre(page, locator) {
  const at = await centreOf(locator);
  await page.mouse.click(at.x, at.y);
}

/** The operations editor `name`'s adapter was asked to apply, by name, with the boxes each layout.set moved. */
function operationsOf(page, name) {
  return harness(page, (h, editorName) => h.record(editorName).operations.map((op) => ({
    op: op.op,
    moved: op.op === 'layout.set' ? Object.keys(op.positions || {}) : undefined,
  })), name);
}

/** Every event listener on the page: on the window, and on the document and each node in it (CDP). */
async function pageListeners(page) {
  const devTools = await page.context().newCDPSession(page);
  try {
    const listenersOf = async (expression) => {
      const { result } = await devTools.send('Runtime.evaluate', { expression });
      const { listeners } = await devTools.send('DOMDebugger.getEventListeners', { objectId: result.objectId, depth: -1, pierce: true });
      return listeners.map((listener) => `${expression} ${listener.type}${listener.useCapture ? ' (capture)' : ''} at ${listener.scriptId}:${listener.lineNumber}:${listener.columnNumber}`);
    };
    return [...await listenersOf('window'), ...await listenersOf('document')].sort();
  } finally {
    await devTools.detach();
  }
}

test.describe('the diagram editor module contract (spec §9.3)', () => {
  test('two sessions on one page keep separate selections, tools, and keys', async ({ page }) => {
    const { a, b } = await openTwoEditors(page);

    await clickCentre(page, item(a, 'Order'));
    expect(await harness(page, (h) => [h.session('A').selection().id, h.session('B').selection().id]),
      'selecting Order in A selects nothing in B').toEqual(['Order', null]);

    await item(a, 'Order').focus();
    await page.keyboard.press('ArrowRight');
    expect(await operationsOf(page, 'A'), 'an arrow key in A moves A\'s Order').toEqual([{ op: 'layout.set', moved: ['Order'] }]);
    expect(await operationsOf(page, 'B'), 'and changes nothing in B').toEqual([]);
    expect(await harness(page, (h) => h.text('B'))).toBe(ORDERS);

    await b.getByRole('button', { name: 'Add element: Class', exact: true }).click();
    await expect(b.getByRole('button', { name: 'Add element: Class', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(a.getByRole('button', { name: 'Add element: Class', exact: true }), 'arming a tool in B leaves A\'s palette as it was').toHaveAttribute('aria-pressed', 'false');
    expect(await harness(page, (h) => [h.session('A').tool(), h.session('B').tool() && h.session('B').tool().kind]),
      'A has no tool while B\'s is armed').toEqual([null, 'element']);

    await item(a, 'Customer').focus();
    await page.keyboard.press('Escape');
    expect(await harness(page, (h) => h.session('B').tool() && h.session('B').tool().spec.label),
      'Escape in A leaves B\'s tool armed').toBe('Class');
  });

  test('ids the sessions generate carry their idPrefix and never repeat', async ({ page }) => {
    const { a, b } = await openTwoEditors(page);
    // The drawings' own ids (the bundle's filters and patterns) are the host's: they are on the page before any
    // gesture, and only ids that appear after it are the sessions'.
    const idsBefore = await page.evaluate(() => Array.from(document.querySelectorAll('[id]'), (node) => node.id));
    const seen = [];
    const noteNewIds = async () => {
      seen.push(...await page.evaluate((before) => Array.from(document.querySelectorAll('[id]'), (node) => ({
        id: node.id,
        editor: node.closest('.editor') ? node.closest('.editor').id : null,
      })).filter((node) => !before.includes(node.id)), idsBefore));
    };

    // The nodes a classic session adds besides its palette and hit layer: a context menu and an in-place editor,
    // each read while it is open.
    for (const [name, editor] of [['A', a], ['B', b]]) {
      await item(editor, 'Order').click({ button: 'right', force: true });
      await expect(editor.getByRole('menu')).toBeVisible();
      await noteNewIds();
      await harness(page, (h, editorName) => h.runTimers(editorName), name);
      await page.keyboard.press('Escape');
      await expect(editor.getByRole('menu')).toHaveCount(0);
      await page.mouse.dblclick(...Object.values(await centreOf(item(editor, 'Customer'))));
      await expect(editor.getByRole('textbox'), 'the in-place editor is open').toBeVisible();
      await noteNewIds();
    }

    for (const node of seen) {
      expect(node.editor, `the id "${node.id}" lies in an editor`).not.toBeNull();
      expect(node.id, `an id of ${node.editor} carries its prefix`).toMatch(node.editor === 'editor-A' ? /^a-/ : /^b-/);
    }
    const editorsOfId = new Map();
    for (const node of seen) editorsOfId.set(node.id, new Set([...(editorsOfId.get(node.id) || []), node.editor]));
    expect([...editorsOfId].filter(([, editors]) => editors.size > 1).map(([id]) => id), 'no id is made by both sessions').toEqual([]);
  });

  test('the module reads and writes no storage, cookie, network, clipboard, or global beyond its two names', async ({ page }) => {
    await openPageWithoutModule(page);
    const beforeModule = await harness(page, (h) => h.ownGlobals());

    await loadModule(page);
    const afterLoad = await harness(page, (h) => h.ownGlobals());
    expect(afterLoad.filter((key) => !beforeModule.includes(key)), 'loading the module adds its two names').toEqual(MODULE_GLOBALS);
    expect(beforeModule.filter((key) => !afterLoad.includes(key))).toEqual([]);

    await harness(page, (h) => {
      h.show('A', h.orders);
      h.show('B', h.orders);
      h.mount('A', 'a-');
      h.mount('B', 'b-');
    });
    const a = page.getByRole('region', { name: 'Editor A', exact: true });
    await clickCentre(page, item(a, 'Order'));
    await item(a, 'Order').focus();
    await page.keyboard.press('ArrowDown');
    await item(a, 'Customer').click({ button: 'right', force: true });
    await harness(page, (h) => h.runTimers('A'));
    await page.keyboard.press('Escape');
    await expect(a.getByRole('menu')).toHaveCount(0);
    await page.mouse.dblclick(...Object.values(await centreOf(item(a, 'Customer'))));
    await page.keyboard.type('Client');
    await page.keyboard.press('Enter');
    await harness(page, (h) => h.session('A').destroy());

    expect(await harness(page, (h) => h.ownGlobals()), 'mounting, editing, and destroying add no global').toEqual(afterLoad);
    expect(await harness(page, (h) => h.accesses), 'no storage, cookie, network, or clipboard was touched').toEqual([]);
  });

  test('every change arrives as an operation, and nothing else changes the page\'s document', async ({ page }) => {
    const { a } = await openTwoEditors(page);
    await page.evaluate(() => {
      const editors = Array.from(document.querySelectorAll('.editor'));
      const outside = [];
      // A record whose node has left the page by the time it is read was made inside a drawing that an editor
      // replaced since; a node removed from outside the editors leaves a record on its parent, which stays.
      new MutationObserver((records) => {
        for (const record of records) {
          if (record.target.isConnected && !editors.some((editor) => editor.contains(record.target))) {
            outside.push(`${record.type} on ${record.target.nodeName}${record.attributeName ? ' ' + record.attributeName : ''}`);
          }
        }
      }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      Object.assign(window, { __outsideMutations: outside });
    });

    await clickCentre(page, item(a, 'Order'));
    await item(a, 'Order').focus();
    await page.keyboard.press('ArrowLeft');
    await page.mouse.dblclick(...Object.values(await centreOf(item(a, 'Customer'))));
    await page.keyboard.type('Client');
    await page.keyboard.press('Enter');
    await item(a, 'Order').click({ button: 'right', force: true });
    await harness(page, (h) => h.runTimers('A'));
    await a.getByRole('menuitem', { name: /^Delete/ }).click();

    expect((await operationsOf(page, 'A')).map((op) => op.op), 'the nudge, the rename, and the delete are operations').toEqual(['layout.set', 'element.rename', 'selection.remove']);
    expect(await harness(page, (h) => h.record('A').writes.length === h.record('A').operations.length && h.record('A').writes.every((op, i) => op === h.record('A').operations[i])),
      'the document changed once per operation, by that operation').toBe(true);
    expect(await harness(page, (h) => h.text('A'))).not.toBe(ORDERS);
    expect(await page.evaluate(() => /** @type {any} */ (window).__outsideMutations), 'nothing outside the two editors changed').toEqual([]);
  });

  test('with targets returning null a connect gesture marks no target', async ({ page }) => {
    const { a } = await openTwoEditors(page);
    const marks = () => page.evaluate(() => Array.from(document.querySelectorAll('#editor-A .uml-pg-edit-layer [data-layout-id]'), (node) => ({
      id: node.getAttribute('data-layout-id'),
      class: node.getAttribute('class'),
      attributes: node.getAttributeNames().sort().join(' '),
    })));
    await item(a, 'Order').focus();
    const before = await marks();

    const handle = a.getByRole('button', { name: 'Extend a relation from Order', exact: true });
    const from = await centreOf(handle);
    const to = await centreOf(item(a, 'Customer'));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });

    await expect(a.locator('.uml-pg-extend-line'), 'the line is being drawn').toHaveCount(1);
    expect(await marks(), 'no item of the drawing is marked while the line is drawn over Customer').toEqual(before);
    await page.keyboard.press('Escape');
    await page.mouse.up();
  });

  test('destroy removes every listener, timer, and node the session added', async ({ page }) => {
    await openPageWithoutModule(page);
    await loadModule(page);
    await harness(page, (h) => h.show('A', h.orders));
    const listenersBefore = await pageListeners(page);
    const rootBefore = await page.evaluate(() => document.getElementById('editor-A').outerHTML);

    await harness(page, (h) => h.mount('A', 'a-'));
    const a = page.getByRole('region', { name: 'Editor A', exact: true });
    // A selection, an open menu whose outside-press listener is still scheduled, and a drag under way.
    await clickCentre(page, item(a, 'Order'));
    await item(a, 'Customer').click({ button: 'right', force: true });
    await expect(a.getByRole('menu')).toBeVisible();
    const from = await centreOf(item(a, 'Order'));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 30, { steps: 4 });
    expect(await harness(page, (h) => h.timers('A').filter((timer) => timer.state === 'pending').length), 'a timer is pending').toBeGreaterThan(0);

    await harness(page, (h) => h.session('A').destroy());
    await page.mouse.up();

    expect(await harness(page, (h) => h.timers('A').filter((timer) => timer.state === 'pending')), 'every timer ran or was cancelled').toEqual([]);
    expect(await pageListeners(page), 'the page holds the listeners it held before the mount').toEqual(listenersBefore);
    expect(await page.evaluate(() => document.getElementById('editor-A').outerHTML), 'the editor holds what it held before the mount').toBe(rootBefore);
  });

  // ---------- moves without a drag (spec §3.11; plan Task 25b) ----------

  test('a move without a press in one session draws no preview in the other and leaves its selection alone', async ({ page }) => {
    const { a, b } = await openTwoEditors(page);
    await clickCentre(page, item(b, 'Customer'));
    const drawingB = () => page.evaluate(() => document.querySelector('#editor-B .canvas').innerHTML);
    const bBefore = await drawingB();
    const orderInA = await item(a, 'Order').boundingBox();
    if (!orderInA) throw new Error('Order is not drawn in A');

    expect(await harness(page, (h) => h.startPlacing('A', { ref: { id: 'Order', kind: 'node' } })), 'the move starts in A').toBe(true);
    const to = { clientX: orderInA.x + orderInA.width / 2 + 60, clientY: orderInA.y + orderInA.height / 2 + 40 };
    await harness(page, (h, event) => h.placing('A').follow(event), to);

    // The hit box the preview moves (a uml-pg-* class of the hit layer, spec §3.7); the item's focus target stays.
    const shownOrderInA = a.locator('.uml-pg-edit-hitbox[data-layout-id="Order"]');
    await expect.poll(async () => (await shownOrderInA.boundingBox() || { x: 0 }).x, 'A shows Order\'s preview where the pointer is').toBeGreaterThan(orderInA.x + 50);
    expect(await drawingB(), 'B\'s drawing is as it was').toBe(bBefore);
    expect(await harness(page, (h) => h.session('B').selection().id), 'B\'s selection is as it was').toBe('Customer');
    expect(await operationsOf(page, 'B')).toEqual([]);
  });

  test('destroy during a move removes its preview and its listeners', async ({ page }) => {
    await openPageWithoutModule(page);
    await loadModule(page);
    await harness(page, (h) => h.show('A', h.orders));
    const listenersBefore = await pageListeners(page);
    const rootBefore = await page.evaluate(() => document.getElementById('editor-A').outerHTML);
    await harness(page, (h) => h.mount('A', 'a-'));
    const a = page.getByRole('region', { name: 'Editor A', exact: true });
    const order = await centreOf(item(a, 'Order'));
    await harness(page, (h) => h.startPlacing('A', { ref: { id: 'Order', kind: 'node' } }));
    await harness(page, (h, event) => h.placing('A').follow(event), { clientX: order.x + 70, clientY: order.y + 50 });
    expect(await page.evaluate(() => document.querySelectorAll('#editor-A .canvas [transform*="translate"]').length),
      'the preview moves Order\'s drawing').toBeGreaterThan(0);

    await harness(page, (h) => h.session('A').destroy());

    expect(await pageListeners(page), 'the page holds the listeners it held before the mount').toEqual(listenersBefore);
    expect(await page.evaluate(() => document.getElementById('editor-A').outerHTML), 'the editor holds what it held before the mount').toBe(rootBefore);
    expect(await operationsOf(page, 'A'), 'the move applied nothing').toEqual([]);
  });

  /** Gives the line from Order to Customer in editor `name` two bends, through the module's own bend commands, and selects it. */
  async function lineWithTwoBendsSelected(page, name) {
    return harness(page, async (h, editorName) => {
      const session = h.session(editorName);
      const svg = document.querySelector(`#editor-${editorName} .canvas svg`);
      const line = { id: session.scene().routes(svg)[0].id, kind: 'route' };
      await session.commands.addBend(line).commit();
      await session.commands.addBend(line).commit();
      session.select(line);
      return { line, bends: session.commands.bends(line) };
    }, name);
  }

  /** The bend numbers drawn in editor A: each one's text, place, and what a press at its centre reaches. */
  function bendNumbersOfA(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('#editor-A .uml-pg-bend-number'), (mark) => {
      const box = mark.getBoundingClientRect();
      const reached = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      const transform = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(mark.getAttribute('transform') || '');
      return {
        text: mark.textContent,
        at: transform ? { x: Number(transform[1]), y: Number(transform[2]) } : null,
        hidden: mark.getAttribute('aria-hidden'),
        tabStops: [mark, ...mark.querySelectorAll('*')].filter((node) => node.hasAttribute('tabindex')).length,
        pressReachesIt: !!reached && mark.contains(reached),
      };
    }));
  }

  test('with bendNumbers on, one selected line shows a number at each bend, and no number is a tab stop or a pointer target', async ({ page }) => {
    await openPageWithoutModule(page);
    await loadModule(page);
    await harness(page, (h) => {
      h.show('A', h.orders);
      h.mount('A', 'a-', { bendNumbers: true });
    });

    const { bends } = await lineWithTwoBendsSelected(page, 'A');

    expect(bends.map((bend) => bend.n)).toEqual([1, 2]);
    expect(await bendNumbersOfA(page)).toEqual(bends.map((bend) => ({
      text: String(bend.n), at: { x: bend.x, y: bend.y }, hidden: 'true', tabStops: 0, pressReachesIt: false,
    })));

    await harness(page, (h) => h.session('A').select({ id: 'Order', kind: 'node' }));
    expect(await bendNumbersOfA(page), 'a selected box shows no bend number').toEqual([]);
  });

  test('with bendNumbers off no number is drawn', async ({ page }) => {
    await openPageWithoutModule(page);
    await loadModule(page);
    await harness(page, (h) => {
      h.show('A', h.orders);
      h.mount('A', 'a-');
    });

    const { bends } = await lineWithTwoBendsSelected(page, 'A');

    expect(bends.length, 'the line has two bends').toBe(2);
    expect(await bendNumbersOfA(page)).toEqual([]);
  });
});
