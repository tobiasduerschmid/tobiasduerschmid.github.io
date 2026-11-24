'use strict';

// The describer's C4 branch (spec §6.5, §10): C4 figures are described by the C4 core's own `describe`, in Node
// (the static build's describer CLI) and in the browser (the bundle's `renderAll` path), and an embed's
// `# description:` comment is the author's verbose text alternative, used in place of the generated one.

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');
const core = require('../../js/ArchUML/c4/c4-core.js');

const REPO_ROOT = path.join(__dirname, '../..');
const ORIGIN = 'http://archuml.test';
const MANIFEST = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'js/ArchUML/c4/manifest.json'), 'utf8'));
const C4_SCRIPT_URLS = MANIFEST.core.concat(MANIFEST.render).map((file) => `${ORIGIN}/js/ArchUML/${file}`);
// The frozen Milestone 1 reference model (J13), not a chapter's shared model, whose text may change.
const MODEL = fs.readFileSync(path.join(REPO_ROOT, 'js/ArchUML/tests/c4/fixtures/course-registration.yml'), 'utf8');
const CONTAINERS = `view: containers of registration\n${MODEL}`;

// A find-the-flaw figure: the web application's relationship to the API no longer says what it is for, and the
// author's description asks the reader to find it without naming the generated "no description" sentence.
const FLAWED_MODEL = MODEL.replace('{description: submits plans to, technology: JSON/HTTPS}', '{technology: JSON/HTTPS}');
const AUTHORED = "Four relationships connect the student, the web app, the API, the database, and billing; one of them isn't labelled with its purpose.";
const FIND_THE_FLAW = `# caption: Find the flaw\n# description: ${AUTHORED}\nview: containers of registration\n${FLAWED_MODEL}`;
assert.notEqual(FLAWED_MODEL, MODEL, 'the find-the-flaw figure really removes a relationship description');

// Callout and note lines are ArchUML notation for UML types; in a C4 embed they are only YAML text.
const CALLOUT_LOOKALIKE = CONTAINERS.replace(
  'description: Plans and confirms one term schedule.',
  'description: |\n      callout left of element web : looks like ArchUML notation\n      Plans and confirms one term schedule.'
);

/** The core's description of the view an embed names: the oracle every surface must match. */
function coreDescription(embed) {
  const design = core.load(embed);
  return core.describe(core.project(design, core.extractEmbed(embed).selector));
}

let described;
before(() => {
  const stdout = execFileSync('node', [path.join(REPO_ROOT, 'js/uml-describe-cli.js')], {
    encoding: 'utf8',
    input: JSON.stringify({
      containers: { type: 'c4', spec: CONTAINERS },
      flaw: { type: 'c4', spec: FIND_THE_FLAW },
      callout: { type: 'c4', spec: CALLOUT_LOOKALIKE },
    }),
  });
  described = JSON.parse(stdout);
});

test('the describer CLI describes a C4 container view with the brief label from the core', () => {
  assert.equal(coreDescription(CONTAINERS).brief,
    'Container view of Course Registration: 3 containers, 1 person, 1 external system, 4 relationships.');
  assert.equal(described.containers.brief, coreDescription(CONTAINERS).brief);
});

test('the describer CLI gives the core sections as the verbose C4 description', () => {
  const expected = coreDescription(CONTAINERS);
  assert.deepEqual(described.containers.verbose, { summary: expected.brief, sections: expected.sections });
});

test('C4 text reaches the core without ArchUML callout extraction', () => {
  assert.equal(described.callout.brief, coreDescription(CALLOUT_LOOKALIKE).brief);
  assert.deepEqual(described.callout.verbose.sections, coreDescription(CALLOUT_LOOKALIKE).sections);
});

test('an authored description replaces the generated verbose text of a find-the-flaw figure', () => {
  assert.deepEqual(described.flaw.verbose, {
    summary: coreDescription(FIND_THE_FLAW).brief,
    sections: [{ heading: 'Description', items: [AUTHORED] }],
  });
});

test('an authored description leaves the brief label generated', () => {
  assert.equal(described.flaw.brief, coreDescription(FIND_THE_FLAW).brief);
});

// --- The browser's renderAll path -----------------------------------------------------------------------

let browser;
before(async () => { browser = await chromium.launch(chromiumLaunchOptions()); });
after(async () => { if (browser) await browser.close(); });

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function pageHtml({ preloadC4 }) {
  const c4Scripts = preloadC4 ? C4_SCRIPT_URLS.map((url) => `<script src="${url}"></script>`).join('\n') : '';
  return `<!doctype html><html lang="en"><head><title>C4 describer test</title></head><body><main id="main"></main>
${c4Scripts}
<script src="${ORIGIN}/js/ArchUML/uml-bundle.js"></script>
<script src="${ORIGIN}/js/uml-auto-describe.js"></script>
</body></html>`;
}

/** Serves repository files under ORIGIN; `hold(url)` may return a promise that delays that response. */
async function openPage({ preloadC4, hold }) {
  const page = await browser.newPage();
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = route.request().url();
    if (hold && hold(url)) await hold(url);
    const file = path.join(REPO_ROOT, decodeURIComponent(new URL(url).pathname));
    if (!file.startsWith(REPO_ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'Not found' });
    return route.fulfill({ path: file, contentType: 'text/javascript' });
  });
  await page.setContent(pageHtml({ preloadC4 }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.UMLShared && window.UMLShared.__umlAutoDescribeRenderAllPatched);
  return page;
}

/** Adds a C4 fence after the bundle's own start-up pass, so only `UMLShared.renderAll` draws it. */
async function renderFence(page, embed) {
  await page.evaluate((html) => {
    document.getElementById('main').innerHTML = html;
    window.UMLShared.renderAll();
  }, `<pre><code class="language-c4">${escapeHtml(embed)}</code></pre>`);
}

const figure = (page) => page.locator('figure.sebook-figure--archuml-c4');
const container = (page) => figure(page).locator('> [role="img"]');

test('renderAll describes an uncaptioned C4 fence like every ArchUML type', async (t) => {
  const page = await openPage({ preloadC4: true });
  t.after(() => page.close());
  await renderFence(page, CONTAINERS);

  const expected = coreDescription(CONTAINERS);
  assert.equal(await container(page).getAttribute('aria-label'), expected.brief);
  assert.equal(await figure(page).locator('[data-uml-verbose="true"]').count(), 1);
  assert.equal(await figure(page).locator('.sebook-figure__caption--auto').count(), 0,
    'the bare type caption is dropped, as for every described type');
});

test('a live find-the-flaw C4 figure shows the authored description as its detailed description', async (t) => {
  const page = await openPage({ preloadC4: true });
  t.after(() => page.close());
  await renderFence(page, FIND_THE_FLAW);

  const verbose = figure(page).locator('[data-uml-verbose="true"]');
  assert.deepEqual(await verbose.locator('li').allTextContents(), [AUTHORED]);
  assert.equal(await container(page).getAttribute('aria-label'), coreDescription(FIND_THE_FLAW).brief);
});

test('renderAll keeps the loading label of a C4 figure until its scripts arrive', async (t) => {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const page = await openPage({ preloadC4: false, hold: (url) => C4_SCRIPT_URLS.includes(url) && held });
  t.after(() => page.close());
  await renderFence(page, CONTAINERS);

  assert.equal(await container(page).getAttribute('aria-label'), 'Loading diagram');
  release();
  await container(page).locator('svg [data-c4-type]').first().waitFor();
  assert.equal(await container(page).getAttribute('aria-label'), coreDescription(CONTAINERS).brief);
});

// --- Direct renders through ArchUMLC4Render, the path a live editor takes ----------------------------------

/** Renders `embed` through `ArchUMLC4Render.render` into `#diagram`, inside `html` placed in the page's main. */
function renderDirectly(page, html, embed) {
  return page.evaluate(([markup, source]) => {
    document.getElementById('main').innerHTML = markup;
    window.ArchUMLC4Render.render(document.getElementById('diagram'), source);
  }, [html, embed]);
}

test('a direct render of a C4 view is named by its brief while the describer is loaded', async (t) => {
  const page = await openPage({ preloadC4: true });
  t.after(() => page.close());
  await renderDirectly(page, '<div id="diagram"></div>', CONTAINERS);

  const brief = coreDescription(CONTAINERS).brief;
  assert.equal(await page.getByRole('img', { name: brief, exact: true }).count(), 1);
  assert.equal(await page.locator('#diagram svg > title').textContent(), brief);
});

test('a direct render of a delegated view keeps the C4 name and detailed description while the describer is loaded', async (t) => {
  const page = await openPage({ preloadC4: true });
  t.after(() => page.close());
  const codeView = `view: code of policy\n${MODEL}`;
  await renderDirectly(page, '<figure><div id="diagram" role="img"></div></figure>', codeView);

  const expected = coreDescription(codeView);
  assert.equal(await page.locator('#diagram').getAttribute('aria-label'), expected.brief);
  const verbose = page.locator('figure [data-uml-verbose="true"]');
  assert.equal(await verbose.count(), 1);
  assert.deepEqual(await verbose.locator('li').allTextContents(), expected.sections.flatMap((section) => section.items),
    'the class diagram the view delegates to does not replace the C4 description');
});
