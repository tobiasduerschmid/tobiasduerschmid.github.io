'use strict';

// Browser tests for the C4 editor's DOM utilities (js/ArchUML/c4/editor/c4-editor-dom.js), and for the host
// callbacks the mounted editor calls from its own controls and keys (spec §3.4, §9.2; docs/c4-editor.md).
// Each test gets a fresh page with the scripts loaded from disk, so no state leaks between tests.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const ARCHUML = path.join(__dirname, '../../js/ArchUML');
const MODULE_PATH = path.join(ARCHUML, 'c4/editor/c4-editor-dom.js');
const PAGE = '<!doctype html><html lang="en"><title>C4 editor DOM test</title><body>'
  + '<button id="outside">Outside</button>'
  + '<div id="editor-a" class="c4-editor"><button id="opener">Open</button><button id="term">Container</button>'
  + '<div id="region" tabindex="0"><div id="spacer"></div><button id="far">Far</button></div></div>'
  + '<div id="editor-b" class="c4-editor"></div>'
  + '</body></html>';

let browser;
before(async () => { browser = await chromium.launch(chromiumLaunchOptions()); });
after(async () => { if (browser) await browser.close(); });

async function withDom(run) {
  const page = await browser.newPage();
  try {
    await page.setContent(PAGE);
    await page.addScriptTag({ path: MODULE_PATH });
    await run(page);
  } finally {
    await page.close();
  }
}

test('the module loads in Node without touching the DOM', () => {
  const dom = require(MODULE_PATH);
  for (const name of ['el', 'idFactory', 'createAnnouncer', 'createEscapeStack', 'openDialog', 'createPopover', 'revealInScrollRegion',
    'revealInPage', 'createMenus', 'placeNear']) {
    assert.equal(typeof dom[name], 'function', name);
  }
});

test('text is always inserted as text', async () => {
  await withDom(async (page) => {
    const result = await page.evaluate(() => {
      const { el } = window.ArchUMLC4EditorParts.dom;
      const hostile = '<img src=x onerror="window.pwned=1"><b>bold</b>';
      const node = el('p', { class: 'note', 'data-kind': 'x', text: hostile }, [
        hostile,
        el('span', { 'aria-hidden': 'true' }, ['inner']),
        null,
        false,
      ]);
      document.body.append(node);
      const rejected = [];
      for (const attrs of [{ onclick: 'alert(1)' }, { style: 'color: red' }, { innerHTML: '<b>x</b>' }]) {
        try { el('div', attrs); } catch (error) { rejected.push(error instanceof TypeError); }
      }
      let clicks = 0;
      const button = el('button', { type: 'button', on: { click: () => { clicks += 1; } } }, ['Go']);
      button.click();
      return {
        text: node.textContent,
        elementChildren: [...node.querySelectorAll('*')].map((child) => child.tagName),
        className: node.className,
        dataKind: node.getAttribute('data-kind'),
        rejected,
        clicks,
        pwned: window.pwned,
      };
    });
    assert.equal(result.text, '<img src=x onerror="window.pwned=1"><b>bold</b>'.repeat(2) + 'inner');
    assert.deepEqual(result.elementChildren, ['SPAN']);
    assert.equal(result.className, 'note');
    assert.equal(result.dataKind, 'x');
    assert.deepEqual(result.rejected, [true, true, true]);
    assert.equal(result.clicks, 1);
    assert.equal(result.pwned, undefined);
  });
});

test('ids differ between two editor instances', async () => {
  await withDom(async (page) => {
    const result = await page.evaluate(() => {
      const { idFactory } = window.ArchUMLC4EditorParts.dom;
      const a = idFactory('c4e-1');
      const b = idFactory('c4e-2');
      const invalid = [];
      for (const bad of ['', '1abc', 'has space', undefined]) {
        try { idFactory(bad); } catch (error) { invalid.push(error instanceof TypeError); }
      }
      return { a1: a('inspector'), a2: a('inspector'), b1: b('inspector'), other: a('outline'), invalid };
    });
    assert.equal(result.a1, result.a2, 'one instance gives a stable id per name');
    assert.notEqual(result.a1, result.b1);
    assert.notEqual(result.a1, result.other);
    assert.match(result.a1, /^c4e-1/);
    assert.deepEqual(result.invalid, [true, true, true, true]);
  });
});

test('the announcer speaks politely and re-announces a repeated message', async () => {
  await withDom(async (page) => {
    // The region's text is read in the same evaluate that announces: the message arrives on a timer, so a read in a
    // later round trip could already see it.
    const first = await page.evaluate(() => {
      const root = document.getElementById('editor-a');
      window.announce = window.ArchUMLC4EditorParts.dom.createAnnouncer(root);
      window.announce('Moved Registration API; position pinned');
      const live = root.querySelector('[role="status"]');
      return { politeness: live.getAttribute('aria-live'), text: live.textContent };
    });
    assert.equal(first.politeness, 'polite');
    assert.equal(first.text, '', 'the region is cleared before the message arrives');
    await page.waitForFunction(() => document.querySelector('#editor-a [role="status"]').textContent === 'Moved Registration API; position pinned');
    const repeated = await page.evaluate(() => {
      window.announce('Moved Registration API; position pinned');
      return document.querySelector('#editor-a [role="status"]').textContent;
    });
    assert.equal(repeated, '', 'a repeat clears the region first so it is spoken again');
    await page.waitForFunction(() => document.querySelector('#editor-a [role="status"]').textContent === 'Moved Registration API; position pinned');
    assert.equal(await page.locator('#editor-a [role="status"]').count(), 1);
  });
});

test('Escape closes only the innermost layer', async () => {
  await withDom(async (page) => {
    await page.evaluate(() => {
      const root = document.getElementById('editor-a');
      const stack = window.ArchUMLC4EditorParts.dom.createEscapeStack(root);
      window.closedLayers = [];
      window.outerSawPrevented = [];
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape') window.outerSawPrevented.push(event.defaultPrevented); });
      stack.push({ close: () => window.closedLayers.push('selection') });
      stack.push({ close: () => window.closedLayers.push('full screen') });
      const move = stack.push({ close: () => window.closedLayers.push('move') });
      const menu = stack.push({ close: () => window.closedLayers.push('menu') });
      menu.remove();
      window.move = move;
      // A widget inside the root that handles Escape itself (e.g. a code editor) wins.
      document.getElementById('term').addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && window.termOwnsEscape) event.preventDefault();
      });
    });
    await page.focus('#opener');
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.closedLayers), ['move'], 'a removed layer is skipped; one layer per press');
    await page.evaluate(() => { window.termOwnsEscape = true; });
    await page.focus('#term');
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.closedLayers), ['move'], 'an event already prevented is ignored');
    await page.focus('#outside');
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.closedLayers), ['move'], 'Escape outside the root is ignored');
    await page.focus('#opener');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.closedLayers), ['move', 'full screen', 'selection']);
    assert.deepEqual(await page.evaluate(() => window.outerSawPrevented), [true, true, false, true, true, false],
      'each press that closes a layer calls preventDefault; a press with no layer left does not');
  });
});

test('dialogs are modal, labelled, inside the root, and return focus', async () => {
  await withDom(async (page) => {
    await page.evaluate(() => {
      const dom = window.ArchUMLC4EditorParts.dom;
      const root = document.getElementById('editor-a');
      const ids = dom.idFactory('c4e-1');
      document.getElementById('opener').addEventListener('click', () => {
        const field = dom.el('input', { type: 'text', 'aria-label': 'New id', value: 'seat-gateway' });
        window.result = dom.openDialog(root, {
          ids,
          title: 'Change id',
          body: [dom.el('p', { text: 'Ids start with a letter <b>.' }), field],
          actions: [{ label: 'Cancel', value: null }, { label: 'Change id', value: 'change', isDefault: true }],
        });
      });
    });
    await page.click('#opener');
    const dialog = page.getByRole('dialog', { name: 'Change id' });
    await dialog.waitFor();
    const facts = await page.evaluate(() => {
      const element = document.querySelector('dialog');
      const label = document.getElementById(element.getAttribute('aria-labelledby'));
      return {
        insideRoot: document.getElementById('editor-a').contains(element),
        modal: element.matches(':modal'),
        labelText: label && label.textContent,
        labelInsideDialog: element.contains(label),
        labelIdPrefixed: label && label.id.startsWith('c4e-1'),
        focused: document.activeElement.getAttribute('aria-label'),
        bodyHasHtml: element.querySelector('b') !== null,
      };
    });
    assert.deepEqual(facts, {
      insideRoot: true, modal: true, labelText: 'Change id', labelInsideDialog: true,
      labelIdPrefixed: true, focused: 'New id', bodyHasHtml: false,
    });
    await page.getByRole('button', { name: 'Change id' }).click();
    assert.equal(await page.evaluate(() => window.result), 'change');
    assert.equal(await page.locator('dialog').count(), 0, 'a closed dialog leaves the DOM');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'opener');

    await page.click('#opener');
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.result), null, 'Escape cancels with null');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'opener');
  });
});

test('Escape closes a dialog before any layer on the editor stack', async () => {
  await withDom(async (page) => {
    await page.focus('#opener');
    await page.evaluate(() => {
      const dom = window.ArchUMLC4EditorParts.dom;
      const root = document.getElementById('editor-a');
      window.closedLayers = [];
      dom.createEscapeStack(root).push({ close: () => window.closedLayers.push('move') });
      window.result = dom.openDialog(root, {
        ids: dom.idFactory('c4e-1'),
        title: 'Add relationship',
        body: 'Pick a target.',
        actions: [{ label: 'Add', value: 'add', isDefault: true }],
      }).then((value) => { window.closedLayers.push('dialog'); return value; });
    });
    await page.getByRole('dialog', { name: 'Add relationship' }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Add', 'without fields the default action has focus');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.closedLayers.length === 1);
    assert.deepEqual(await page.evaluate(() => window.closedLayers), ['dialog']);
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.closedLayers), ['dialog', 'move']);
  });
});

test('popover dismissal keeps focus on its anchor', async () => {
  await withDom(async (page) => {
    await page.evaluate(() => {
      const dom = window.ArchUMLC4EditorParts.dom;
      const root = document.getElementById('editor-a');
      window.closedLayers = [];
      dom.createEscapeStack(root).push({ close: () => window.closedLayers.push('selection') });
      window.popover = dom.createPopover(document.getElementById('term'),
        'Container: an application or data store — not a Docker container');
    });
    const tip = page.locator('#term-popover');
    assert.equal(await page.evaluate(() => {
      const element = document.getElementById('term-popover');
      return document.getElementById('editor-a').contains(element);
    }), true, 'the popover mounts inside the root');
    assert.equal(await tip.isVisible(), false);
    assert.equal(await page.getAttribute('#term', 'aria-describedby'), 'term-popover');

    await page.focus('#term');
    assert.equal(await tip.isVisible(), true, 'focus shows the popover');
    await page.keyboard.press('Escape');
    assert.equal(await tip.isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'term');
    assert.deepEqual(await page.evaluate(() => window.closedLayers), [], 'the popover is the innermost layer');

    await page.focus('#outside');
    await page.hover('#term');
    assert.equal(await tip.isVisible(), true, 'hover shows the popover');
    await page.hover('#term-popover');
    assert.equal(await tip.isVisible(), true, 'moving the pointer onto the popover keeps it open');
    await page.keyboard.press('Escape');
    assert.equal(await tip.isVisible(), false, 'Escape dismisses a hovered popover without moving pointer or focus');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'outside');

    await page.hover('#outside');
    await page.hover('#term');
    assert.equal(await tip.isVisible(), true);
    await page.hover('#outside');
    await assert.doesNotReject(tip.waitFor({ state: 'hidden' }));
  });
});

test('revealing an element scrolls only its region, and only as far as needed', async () => {
  await withDom(async (page) => {
    await page.addStyleTag({ content: '#region { height: 100px; overflow: auto; } #spacer { height: 400px; } body { min-height: 3000px; }' });
    const result = await page.evaluate(() => {
      const { revealInScrollRegion } = window.ArchUMLC4EditorParts.dom;
      const region = document.getElementById('region');
      const far = document.getElementById('far');
      revealInScrollRegion(far, region);
      const regionBox = region.getBoundingClientRect();
      const farBox = far.getBoundingClientRect();
      const afterFirst = region.scrollTop;
      revealInScrollRegion(far, region);
      return {
        visible: farBox.top >= regionBox.top && farBox.bottom <= regionBox.top + region.clientTop + region.clientHeight + 0.5,
        bottomAligned: Math.abs(farBox.bottom - (regionBox.top + region.clientTop + region.clientHeight)) < 1,
        stable: region.scrollTop === afterFirst,
        pageScroll: window.scrollY,
      };
    });
    assert.deepEqual(result, { visible: true, bottomAligned: true, stable: true, pageScroll: 0 });
  });
});

// ---- Host callbacks of the mounted editor (spec §3.4, §9.2) -------------------------------------------------------

const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const EDITOR_SCRIPTS = ['uml-bundle.js', ...MANIFEST.core, ...MANIFEST.render, ...MANIFEST.editor].map((file) => path.join(ARCHUML, file));
const REFERENCE = fs.readFileSync(path.join(ARCHUML, 'tests/c4/fixtures/course-registration.yml'), 'utf8');

/**
 * A page with one editor mounted on the reference model. `hostMembers` names the optional host callbacks to give the
 * host; each one records its calls in `window.calls`. Every keydown that reaches the document records whether
 * something prevented its default (`window.prevented`), which is how a page sees that a key was taken.
 */
async function withEditor({ hostMembers = [], display = 'live' } = {}, run) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  try {
    await page.setContent('<!doctype html><html lang="en"><title>C4 editor host test</title><body><main><div id="editor"></div></main></body></html>');
    await page.addStyleTag({ path: path.join(ARCHUML, 'css/c4-editor.css') });
    for (const script of EDITOR_SCRIPTS) await page.addScriptTag({ path: script });
    await page.evaluate(({ text, members, checksDisplay }) => {
      window.calls = Object.fromEntries(members.map((name) => [name, []]));
      window.prevented = [];
      document.addEventListener('keydown', (event) => window.prevented.push(`${event.key}:${event.defaultPrevented}`));
      const host = { onTextChange() {} };
      members.forEach((name) => { host[name] = (...args) => { window.calls[name].push(args); }; });
      window.editor = window.ArchUMLC4Editor.mount(document.getElementById('editor'), {
        text, view: 'containers of registration', profile: 'expert', checks: { display: checksDisplay }, host,
      });
    }, { text: REFERENCE, members: hostMembers, checksDisplay: display });
    await run(page);
  } finally {
    await page.close();
  }
}

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
const calls = (page, name) => page.evaluate((member) => window.calls[member].length, name);

test('Ctrl/Cmd+Enter anywhere in the editor asks the host for a check, and Ctrl/Cmd+S asks it to save', async () => {
  await withEditor({ hostMembers: ['onRequestCheck', 'onRequestSave'] }, async (page) => {
    await page.getByRole('region', { name: /^Canvas/ }).focus();
    await page.keyboard.press(`${MOD}+Enter`);
    await page.keyboard.press(`${MOD}+s`);
    // In a form field too: the chords are not typing, so they work wherever focus is in the editor.
    await page.getByRole('searchbox', { name: 'Filter the outline' }).focus();
    await page.keyboard.press(`${MOD}+Enter`);
    assert.equal(await calls(page, 'onRequestCheck'), 2);
    assert.equal(await calls(page, 'onRequestSave'), 1);
    assert.deepEqual(await page.evaluate(() => window.prevented.filter((entry) => /^(Enter|s):/.test(entry))),
      ['Enter:true', 's:true', 'Enter:true'], 'each chord the host took is not also the browser\'s');
  });
});

test('without the host callbacks, Ctrl/Cmd+Enter and Ctrl/Cmd+S stay the page\'s keys', async () => {
  await withEditor({}, async (page) => {
    await page.getByRole('region', { name: /^Canvas/ }).focus();
    await page.keyboard.press(`${MOD}+Enter`);
    await page.keyboard.press(`${MOD}+s`);
    assert.deepEqual(await page.evaluate(() => window.prevented.filter((entry) => /^(Enter|s):/.test(entry))),
      ['Enter:false', 's:false']);
  });
});

test('Submit for review in the Problems panel tells the host, with the diagnostics it released', async () => {
  await withEditor({ hostMembers: ['onSubmitForReview', 'onCheckNow'], display: 'after-submit' }, async (page) => {
    await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
    const notices = await page.evaluate(() => window.calls.onSubmitForReview);
    assert.equal(notices.length, 1);
    assert.deepEqual(notices[0][0], await page.evaluate(() => window.editor.getDiagnostics()),
      'the host receives what the learner now sees');
    assert.equal(await calls(page, 'onCheckNow'), 0);
    // The host's own call needs no notice: it already knows (as setText never calls onTextChange).
    await page.evaluate(() => window.editor.submitForReview());
    assert.equal(await calls(page, 'onSubmitForReview'), 1);
  });
});

test('Check now in the Problems panel tells the host', async () => {
  await withEditor({ hostMembers: ['onSubmitForReview', 'onCheckNow'], display: 'on-request' }, async (page) => {
    await page.getByRole('button', { name: 'Check now', exact: true }).click();
    assert.equal(await calls(page, 'onCheckNow'), 1);
    assert.equal(await calls(page, 'onSubmitForReview'), 0);
  });
});

test('a host callback that is not a function is outside the contract', async () => {
  await withEditor({}, async (page) => {
    const error = await page.evaluate(() => {
      try {
        window.ArchUMLC4Editor.mount(document.createElement('div'), { text: '', host: { onTextChange() {}, onRequestCheck: 'run' } });
        return null;
      } catch (thrown) {
        return { type: thrown.constructor.name, message: thrown.message };
      }
    });
    assert.equal(error && error.type, 'TypeError');
    assert.match(error.message, /onRequestCheck/);
  });
});
