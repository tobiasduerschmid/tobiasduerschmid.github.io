// @ts-check
// The C4 editor's host contract (spec §3.4) and its content-security promise, seen from the host's side: the editor
// reaches nothing outside itself except through the host object, never echoes the host's own text back, hands undo to
// the host when asked, leaves no listener behind on destroy, runs under a strict Content Security Policy, and keeps
// two editors on one page apart (Review Focus 1: ids, undo, and Escape).
// The page is built with setContent (tests/helpers/c4-editor-page.js); the C4 core, run in Node on the text the host
// received, is the oracle for what the model says.
const { test, expect } = require('@playwright/test');
const { C4, REFERENCE, loadC4Editor } = require('./helpers/c4-editor-page');

const CONTAINERS = 'containers of registration';

const canvas = (editor) => editor.getByRole('region', { name: /^Canvas/ });
const option = (editor, name) => canvas(editor).getByRole('listbox', { name: 'Elements in this view' }).getByRole('option', { name, exact: true });
const palette = (editor) => editor.getByRole('group', { name: 'Add to the diagram' });
const button = (editor, name) => editor.getByRole('button', { name, exact: true });
const renameField = (editor, name) => canvas(editor).getByRole('textbox', { name: `Name of ${name}` });
const tab = (editor, name) => editor.getByRole('tab', { name: new RegExp(`^${name}`) });

/** Element names in `text`, in model order (the oracle for "the model has these elements"). */
function elementNames(text) {
  return [...C4.load(text).model.elements.values()].map((element) => element.name);
}

/** Mounts an editor on `#rootId` whose host has nothing but `onTextChange`, recording each text in `window.texts[rootId]`. */
function mountMinimal(page, rootId, { text = REFERENCE, view = CONTAINERS } = {}) {
  return page.evaluate(({ id, modelText, selector }) => {
    window.texts = window.texts || {};
    window.editors = window.editors || {};
    window.texts[id] = [];
    window.editors[id] = window.ArchUMLC4Editor.mount(document.getElementById(id), {
      text: modelText, view: selector, profile: 'expert',
      host: { onTextChange: (changed) => window.texts[id].push(changed) },
    });
  }, { id: rootId, modelText: text, selector: view });
}

function textsOf(page, rootId = 'editor') {
  return page.evaluate((id) => window.texts[id], rootId);
}

/** Adds a container from the palette and names it in place (two changes: the new element, then its name). */
async function addContainer(editor, name) {
  await palette(editor).getByRole('button', { name: 'Container', exact: true }).click();
  const field = canvas(editor).getByRole('textbox', { name: /^Name of / });
  await field.fill(name);
  await field.press('Enter');
  await expect(option(editor, new RegExp(`^${name}`))).toBeVisible();
}

/** Renames an element in place on the canvas (F2, type, Enter): exactly one change the host hears. */
async function renameElement(page, editor, from, to) {
  await option(editor, new RegExp(`^${from}`)).focus();
  await page.keyboard.press('F2');
  await renameField(editor, from).fill(to);
  await renameField(editor, from).press('Enter');
  await expect(option(editor, new RegExp(`^${to}`))).toBeVisible();
}

/**
 * Uses the editor the way a learner does across its parts: adds and names an element, undoes and redoes, opens the
 * views inside it and back, selects in the outline, opens the YAML tab, Help, an element menu, and full screen.
 */
async function exerciseEditor(page, editor) {
  await addContainer(editor, 'Audit Log');
  await button(editor, 'Undo').click();
  await button(editor, 'Redo').click();
  await option(editor, /^Registration API/).focus();
  await page.keyboard.press('Enter');
  await expect(canvas(editor)).toHaveAccessibleName(/Component view/);
  await page.keyboard.press('Alt+ArrowUp');
  await expect(canvas(editor)).toHaveAccessibleName(/Container view/);
  await editor.getByRole('tree', { name: 'Model outline' }).getByRole('treeitem', { name: 'Planner Web App', exact: true }).click();
  await tab(editor, 'YAML').click();
  await tab(editor, 'Explain').click();
  await option(editor, /^Registration API/).focus();
  await page.keyboard.press('Shift+F10');
  await expect(editor.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+?');
  await expect(editor.getByRole('dialog', { name: 'C4 editor help' })).toBeVisible();
  await page.keyboard.press('Escape');
  await button(editor, 'Full screen').click();
  await expect(button(editor, 'Full screen')).toHaveAttribute('aria-pressed', 'true');
  await button(editor, 'Full screen').click();
  await expect(button(editor, 'Full screen')).toHaveAttribute('aria-pressed', 'false');
}

test.use({ viewport: { width: 1400, height: 1200 } });

test.describe('C4 editor host contract (spec §3.4)', () => {
  test('mount with only onTextChange never touches storage, cookies, network, or window.open', async ({ page }) => {
    await loadC4Editor(page, {
      beforeScripts: () => {
        window.touched = [];
        const trap = (target, name) => {
          const original = Object.getOwnPropertyDescriptor(target, name)
            || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), name);
          Object.defineProperty(target, name, {
            configurable: true,
            get() { window.touched.push(name); return original.get ? original.get.call(target) : original.value; },
            set(value) { window.touched.push(name); if (original.set) original.set.call(target, value); },
          });
        };
        ['localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'WebSocket', 'open'].forEach((name) => trap(window, name));
        trap(document, 'cookie');
        trap(navigator, 'sendBeacon');
      },
    });
    await mountMinimal(page, 'editor');
    const editor = page.locator('#editor');

    await exerciseEditor(page, editor);

    expect(elementNames((await textsOf(page)).at(-1)), 'the edits reached the host').toContain('Audit Log');
    expect(await page.evaluate(() => window.touched), 'APIs outside the host the editor touched').toEqual([]);
  });

  test('no echo after setText: the host\'s own text and its echo of the editor\'s change never come back', async ({ page }) => {
    await loadC4Editor(page);
    await page.evaluate((modelText) => {
      window.heard = [];
      // A host that writes every change it hears straight back, as a Monaco or VS Code model does.
      window.editor = window.ArchUMLC4Editor.mount(document.getElementById('editor'), {
        text: modelText, view: 'containers of registration',
        host: {
          onTextChange(changed, info) {
            window.heard.push({ reason: info.reason, version: info.version });
            window.editor.setText(changed, { reason: 'external' });
          },
        },
      });
    }, REFERENCE);
    const editor = page.locator('#editor');
    const renamed = REFERENCE.replace('name: Planner Web App', 'name: Course Planner');

    await page.evaluate((text) => window.editor.setText(text, { reason: 'external' }), renamed);
    await expect(option(editor, /^Course Planner/)).toBeVisible();
    expect(await page.evaluate(() => window.heard), 'setText reaches the host').toEqual([]);

    await renameElement(page, editor, 'Registration API', 'Enrollment Service');
    expect(await page.evaluate(() => window.heard), 'one change, heard once').toEqual([{ reason: 'edit', version: 1 }]);
    await button(editor, 'Undo').click();
    await expect(option(editor, /^Registration API/)).toBeVisible();
    expect(await page.evaluate(() => window.editor.getText()), 'the echo was no undo step of its own').toBe(renamed);
  });

  test('host undo routes toolbar Undo and Redo, and Ctrl+Z in the canvas, to the host\'s one undo stack', async ({ page }) => {
    await loadC4Editor(page);
    await page.evaluate((modelText) => {
      // The host owns the document and its undo stack, as VS Code does (spec §3.5); it sends every text it restores
      // back with setText.
      const past = [];
      const future = [];
      let current = modelText;
      window.hostUndoCalls = [];
      const restore = (from, to) => {
        to.push(current);
        current = from.pop();
        window.editor.setText(current, { reason: 'undo' });
      };
      window.editor = window.ArchUMLC4Editor.mount(document.getElementById('editor'), {
        text: modelText, view: 'containers of registration',
        host: {
          undo: 'host',
          onTextChange(changed) { past.push(current); future.length = 0; current = changed; },
          performUndo() { window.hostUndoCalls.push('undo'); restore(past, future); },
          performRedo() { window.hostUndoCalls.push('redo'); restore(future, past); },
          canUndo: () => past.length > 0,
          canRedo: () => future.length > 0,
        },
      });
    }, REFERENCE);
    const editor = page.locator('#editor');
    const hostCalls = () => page.evaluate(() => window.hostUndoCalls);

    await expect(button(editor, 'Undo'), 'nothing to undo yet').toBeDisabled();
    await renameElement(page, editor, 'Registration API', 'Enrollment Service');
    await expect(button(editor, 'Undo')).toBeEnabled();

    await button(editor, 'Undo').click();
    await expect(option(editor, /^Registration API/)).toBeVisible();
    expect(await hostCalls()).toEqual(['undo']);
    await button(editor, 'Redo').click();
    await expect(option(editor, /^Enrollment Service/)).toBeVisible();
    expect(await hostCalls()).toEqual(['undo', 'redo']);

    await option(editor, /^Enrollment Service/).focus();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(option(editor, /^Registration API/)).toBeVisible();
    expect(await hostCalls()).toEqual(['undo', 'redo', 'undo']);
    expect(await page.evaluate(() => window.editor.getText())).toBe(REFERENCE);
  });

  test('destroy removes every listener and timer it added to the page and leaves the host element as it found it', async ({ page }) => {
    await loadC4Editor(page, {
      // Records the timers the editor's own modules (c4/editor/) start and that are still waiting to run (test plumbing:
      // a pending timer has no rendered trace). The shared UML bundle's page-wide settle loop is not the editor's.
      beforeScripts: () => {
        window.pendingTimers = new Map();
        const wrap = (set, clear, repeats) => {
          const original = window[set].bind(window);
          const cancel = window[clear].bind(window);
          window[set] = (callback, delay, ...rest) => {
            const id = original((...args) => {
              if (!repeats) window.pendingTimers.delete(id);
              return typeof callback === 'function' ? callback(...args) : undefined;
            }, delay, ...rest);
            const caller = (new Error().stack || '').split('\n').find((line) => line.includes('/c4/editor/'));
            if (caller) window.pendingTimers.set(id, `${set} ${delay} ${caller.trim()}`);
            return id;
          };
          window[clear] = (id) => { window.pendingTimers.delete(id); return cancel(id); };
        };
        wrap('setTimeout', 'clearTimeout', false);
        wrap('setInterval', 'clearInterval', true);
      },
    });
    const client = await page.context().newCDPSession(page);
    async function listenersOnPage() {
      const found = [];
      for (const expression of ['window', 'document', 'document.body', 'document.getElementById("editor")']) {
        const { result } = await client.send('Runtime.evaluate', { expression });
        const { listeners } = await client.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
        found.push(...listeners.map((listener) => `${expression} ${listener.type}`));
      }
      return found.sort();
    }
    // A first mount and destroy lets the shared ArchUML scripts install their one-time page listeners.
    await mountMinimal(page, 'editor');
    await page.evaluate(() => window.editors.editor.destroy());
    const before = await listenersOnPage();

    await mountMinimal(page, 'editor');
    const editor = page.locator('#editor');
    await exerciseEditor(page, editor);
    // Typing in the YAML tab leaves its debounce waiting when the editor goes.
    await tab(editor, 'YAML').click();
    await editor.getByRole('textbox', { name: 'YAML source' }).press('End');
    await editor.getByRole('textbox', { name: 'YAML source' }).type(' ');
    await page.evaluate(() => window.editors.editor.destroy());

    expect(await listenersOnPage()).toEqual(before);
    expect(await page.evaluate(() => [...window.pendingTimers.values()]), 'timers still waiting after destroy').toEqual([]);
    await expect(page.locator('#editor > *')).toHaveCount(0);
    expect(await page.locator('#editor').evaluate((element) => element.getAttributeNames())).toEqual(['id']);
  });
});

test.describe('C4 editor content security (spec §3.4)', () => {
  test('under default-src none with script-src and style-src \'unsafe-inline\' the editor records zero securitypolicyviolation events', async ({ page }) => {
    // The strictest policy the injected test scripts allow: no eval, no new Function, no images, fonts, or requests.
    await loadC4Editor(page, {
      csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
      beforeScripts: () => {
        window.violations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
          window.violations.push(`${event.effectiveDirective}: ${event.blockedURI}`);
        });
      },
    });
    await mountMinimal(page, 'editor');
    const editor = page.locator('#editor');

    await exerciseEditor(page, editor);
    await button(editor, 'Fit').click();

    expect(await page.evaluate(() => window.violations)).toEqual([]);
  });
});

test.describe('C4 editor: two editors on one page (Review Focus 1)', () => {
  test.beforeEach(async ({ page }) => {
    await loadC4Editor(page, { roots: ['first', 'second'] });
    await mountMinimal(page, 'first');
    await mountMinimal(page, 'second');
  });

  test('every id is unique on the page and every ARIA reference stays inside its own editor', async ({ page }) => {
    for (const id of ['first', 'second']) {
      const editor = page.locator(`#${id}`);
      await option(editor, /^Registration API/).click();
    }

    const report = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      const references = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-activedescendant', 'aria-owns', 'for'];
      const strays = [];
      for (const root of ['first', 'second'].map((id) => document.getElementById(id))) {
        for (const attribute of references) {
          for (const element of root.querySelectorAll(`[${attribute}]`)) {
            for (const ref of element.getAttribute(attribute).split(/\s+/).filter(Boolean)) {
              const target = document.getElementById(ref);
              if (!target || !root.contains(target)) strays.push(`${root.id}: ${attribute}="${ref}"`);
            }
          }
        }
      }
      return { count: ids.length, duplicates, strays };
    });
    expect(report.count).toBeGreaterThan(20);
    expect(report.duplicates).toEqual([]);
    expect(report.strays).toEqual([]);
  });

  test('undo in one editor leaves the other editor\'s model and history alone', async ({ page }) => {
    const first = page.locator('#first');
    const second = page.locator('#second');

    await renameElement(page, first, 'Registration API', 'Enrollment Service');
    await expect(button(second, 'Undo'), 'the second editor has nothing to undo').toBeDisabled();
    await renameElement(page, second, 'Planner Web App', 'Course Planner');

    await button(first, 'Undo').click();
    await expect(option(first, /^Registration API/)).toBeVisible();
    await expect(option(second, /^Course Planner/)).toBeVisible();
    expect(elementNames(await page.evaluate(() => window.editors.second.getText()))).toContain('Course Planner');
    await expect(button(second, 'Undo')).toBeEnabled();
  });

  test('Escape closes only the layer of the editor it is pressed in', async ({ page }) => {
    const first = page.locator('#first');
    const second = page.locator('#second');
    await option(second, /^Registration API/).click();
    await option(first, /^Registration API/).click();

    await page.keyboard.press('Shift+?');
    await expect(first.getByRole('dialog', { name: 'C4 editor help' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(first.getByRole('dialog', { name: 'C4 editor help' })).toBeHidden();
    await expect(option(first, /^Registration API/), 'the dialog was the only layer closed').toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Escape');
    await expect(option(first, /^Registration API/)).toHaveAttribute('aria-selected', 'false');
    await expect(option(second, /^Registration API/), 'the other editor keeps its selection').toHaveAttribute('aria-selected', 'true');
  });
});
