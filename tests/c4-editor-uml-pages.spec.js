// @ts-check
// The C4 editor's UML-view editing on built site pages (UML-view editing spec §7.2, §9.3; plan Task 41): the standalone
// editor page keeps a class's kept position in its browser draft across a reload, and the combined course page, which
// holds the UML editor and three C4 editors and so loads the diagram editor's core group twice, mounts each editor once,
// with ids that stay unique and no console error.
//
// The combined page has defects of its own that these editors do not cause, and the test leaves them out by name
// (reported to the wave gate, plan Task 41): its chapters repeat heading ids ("overview", "practice", …), every UML
// figure repeats the renderer's <defs> ids (uml-node-shadow, uml-tx-*), and the write-in quiz questions fail to mount
// because the page does not load window.WriteInQuiz (mountWriteInQuestions in _includes/quiz.html). So the ids checked
// are those of the editors' own elements, against the whole page.
//
// These tests load built pages (PLAYWRIGHT_SERVE_BUILT_SITE=1 after a build). The standalone page's draft
// ({version: 1, text, savedAt, view} under c4-editor-draft) is the contract published on /cookies/, so the test seeds
// and reads it in localStorage. Monaco is blocked so the YAML surface is the labelled textarea every reader also gets
// when Monaco cannot load.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const C4 = require('../js/ArchUML/c4/c4-core.js');

const EDITOR_PATH = '/SEBook/tools/c4-editor';
const COMBINED_PATH = '/SEBook/all.html';
const DRAFT_KEY = 'c4-editor-draft';
const CODE_VIEW = 'code of policy';
const COURSE_REGISTRATION = fs.readFileSync(path.join(__dirname, '../_includes/c4-models/course-registration.yml'), 'utf8');

/** Where code of policy keeps EnrollmentPolicy in `text`, or undefined. */
function keptPolicy(text) {
  const view = C4.project(C4.load(text), CODE_VIEW);
  return view.layout ? view.layout.positions.get('EnrollmentPolicy') : undefined;
}

/** The text of the page's stored draft, or null. */
function draftText(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw).text;
  }, DRAFT_KEY);
}

/** EnrollmentPolicy's drawn box (top-left corner and size, drawing units) on the page's one C4 editor canvas. */
function drawnPolicy(page) {
  return page.getByRole('region', { name: /^Canvas/ }).evaluate((region) => {
    const box = window.UMLShared.renderedLayoutBox(region.querySelector('.c4-editor__diagram svg'), 'EnrollmentPolicy');
    return box && [Math.round(box.x), Math.round(box.y)];
  });
}

test.describe('the standalone C4 editor page', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('**/vendor/monaco-editor/**', (route) => route.abort());
  });

  test('on the standalone C4 editor page a class moved in code of policy keeps its pin after reload', async ({ page }) => {
    // The worked example, opened in code of policy, as a draft from an earlier visit (seeded on the first load only).
    await page.addInitScript(([key, value]) => {
      if (sessionStorage.getItem('c4-test-seeded')) return;
      sessionStorage.setItem('c4-test-seeded', '1');
      localStorage.setItem(key, value);
    }, [DRAFT_KEY, JSON.stringify({ version: 1, text: COURSE_REGISTRATION, savedAt: '2026-11-20T09:00:00.000Z', view: CODE_VIEW })]);
    await page.goto(EDITOR_PATH);
    const policy = page.getByRole('listbox', { name: 'Elements in this view' }).getByRole('option', { name: 'EnrollmentPolicy', exact: true });
    await expect(policy).not.toHaveAccessibleDescription(/position kept/);

    await policy.focus();
    await page.keyboard.press('m');
    for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    await expect(policy).toHaveAccessibleDescription(/position kept/);
    await expect.poll(async () => keptPolicy(await draftText(page) || ''), { message: 'the draft keeps the class\'s position' }).toBeTruthy();
    const kept = keptPolicy(await draftText(page) || '');
    const drawn = await drawnPolicy(page);

    await page.reload();

    await expect(policy).toHaveAccessibleDescription(/position kept/);
    expect(keptPolicy(await draftText(page) || ''), 'the reloaded draft keeps the same position').toEqual(kept);
    expect(await drawnPolicy(page), 'the class is drawn where it was before the reload').toEqual(drawn);
  });
});

test.describe('the combined course page', () => {
  test('on the built /SEBook/all.html, which holds the UML editor and three C4 editors and so loads the diagram-editor core twice, the UML editor\'s session and each C4 editor\'s canvas mount, no two elements of the page share an id, and the page logs no console error', async ({ page }) => {
    // The page holds the whole book: it is large, so it gets the time a page of its size needs to load.
    test.slow();
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => { if (!/mountWriteInQuestions/.test(error.stack || '')) errors.push(error.message); });

    await page.goto(COMBINED_PATH);

    // The UML editor opens empty; its first class is drawn, and the session lays its hit layer over the drawing (the
    // uml-pg-* ids and the hit layer's class are contracts of the UML editor and the module, spec §3.7).
    await page.locator('#uml-pg-output').getByRole('button', { name: '+ Class', exact: true }).click();
    await expect(page.locator('#uml-pg-output svg .uml-pg-edit-layer')).toHaveCount(1);
    await expect(page.getByRole('region', { name: /^Canvas/ })).toHaveCount(3);
    const shared = await page.evaluate(() => {
      const editors = [...document.querySelectorAll('.c4-editor, #uml-playground-wrap')];
      const own = new Set(editors.flatMap((root) => [...root.querySelectorAll('[id]')]
        .filter((element) => !element.closest('defs')).map((element) => element.id)));
      const counts = new Map();
      document.querySelectorAll('[id]').forEach((element) => {
        if (own.has(element.id)) counts.set(element.id, (counts.get(element.id) || 0) + 1);
      });
      return [...counts].filter(([, count]) => count > 1).map(([id, count]) => `${id} ×${count}`);
    });
    expect(shared, 'ids of the editors\' elements that another element of the page carries too').toEqual([]);
    expect(errors, 'console errors').toEqual([]);
  });
});
