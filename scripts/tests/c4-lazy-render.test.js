'use strict';

// The lazy completion contract (spec §3.3): a page that loads only the ArchUML bundle and the describer still
// renders, describes, sizes, and makes scrollable a C4 figure once the stub has fetched the manifest scripts
// relative to the bundle's own URL. A failed load leaves an accessible error state.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');
const core = require('../../js/ArchUML/c4/c4-core.js');

const REPO_ROOT = path.join(__dirname, '../..');
const ORIGIN = 'http://archuml.test';
const MANIFEST = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'js/ArchUML/c4/manifest.json'), 'utf8'));
const SCRIPT_URLS = MANIFEST.core.concat(MANIFEST.render).map((file) => `${ORIGIN}/js/ArchUML/${file}`);
const CORE_URL = `${ORIGIN}/js/ArchUML/c4/c4-core.js`;
const SELECTOR = 'containers of registration';
const EMBED = `# caption: Containers of Course Registration\nview: ${SELECTOR}\n` +
  fs.readFileSync(path.join(REPO_ROOT, 'js/ArchUML/tests/c4/fixtures/course-registration.yml'), 'utf8');
const PARAGRAPH_PX = 24;

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The site's readable-sizing rule for diagram SVGs (css/uml-diagram.css) and a paragraph size above the renderer's
// 20-unit labels, so the figure must scale up to stay readable.
const PAGE = `<!doctype html><html lang="en"><head><title>C4 lazy render test</title><style>
  body { font-size: ${PARAGRAPH_PX}px; margin: 0 16px; }
  .uml-c4-diagram-container { overflow: auto; }
  .uml-c4-diagram-container svg { display: block; width: var(--uml-readable-width, auto); max-width: none; height: auto; }
</style></head><body><main>
  <p>Paragraph text sets the readable size.</p>
  <pre><code class="language-c4">${escapeHtml(EMBED)}</code></pre>
</main>
<script src="${ORIGIN}/js/ArchUML/uml-bundle.js"></script>
<script src="${ORIGIN}/js/uml-auto-describe.js"></script>
</body></html>`;

let browser;
before(async () => { browser = await chromium.launch(chromiumLaunchOptions()); });
after(async () => { if (browser) await browser.close(); });

/** Serves repository files under ORIGIN; `override(url)` may answer a URL first (return true when it did). */
async function servePage(page, override) {
  const requested = [];
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = route.request().url();
    requested.push(url);
    if (override && await override(route, url)) return;
    const file = path.join(REPO_ROOT, decodeURIComponent(new URL(url).pathname));
    if (!file.startsWith(REPO_ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'Not found' });
    return route.fulfill({ path: file, contentType: 'text/javascript' });
  });
  return requested;
}

async function withLazyPage(viewport, run, override) {
  const page = await browser.newPage({ viewport });
  try {
    const requested = await servePage(page, override);
    // The injected C4 scripts delay the load event, which the placeholder test holds back on purpose.
    await page.setContent(PAGE, { waitUntil: 'domcontentloaded' });
    await run(page, requested);
  } finally {
    await page.close();
  }
}

const figureContainer = (page) => page.locator('figure.sebook-figure--archuml-c4 > [role="img"]');

async function waitForDiagram(page) {
  await figureContainer(page).locator('svg [data-c4-type]').first().waitFor();
}

test('a C4 fence shows an accessible loading placeholder until the scripts arrive', async () => {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await withLazyPage({ width: 1440, height: 1000 }, async (page) => {
    const container = figureContainer(page);
    await container.getByText('Loading diagram').waitFor();
    assert.equal(await container.getAttribute('aria-label'), 'Loading diagram');
    release();
    await waitForDiagram(page);
  }, async (route, url) => {
    if (url !== CORE_URL) return false;
    await held;
    return false;
  });
});

test('a C4 fence renders after the scripts load lazily, in manifest order, relative to the bundle', async () => {
  await withLazyPage({ width: 1440, height: 1000 }, async (page, requested) => {
    await waitForDiagram(page);
    assert.deepEqual(requested.filter((url) => SCRIPT_URLS.includes(url)), SCRIPT_URLS);
    const ids = await figureContainer(page).locator('svg [data-c4-type]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-layout-id')));
    assert.deepEqual(ids.sort(), ['api', 'billing', 'db', 'student', 'web']);
  });
});

test('the container gets the described aria-label and the verbose block', async () => {
  const description = core.describe(core.project(core.load(EMBED), SELECTOR));
  await withLazyPage({ width: 1440, height: 1000 }, async (page) => {
    await waitForDiagram(page);
    const container = figureContainer(page);
    assert.equal(await container.getAttribute('aria-label'), description.brief);
    assert.equal(await container.locator('svg').getAttribute('aria-hidden'), 'true', 'the image role belongs to the container only');
    const verbose = page.locator('figure.sebook-figure--archuml-c4 [data-uml-verbose="true"]');
    const headings = await verbose.locator('.sebook-figure__verbose-heading').allTextContents();
    assert.deepEqual(headings, description.sections.map((section) => section.heading));
    const items = await verbose.locator('li').allTextContents();
    assert.deepEqual(items, description.sections.flatMap((section) => section.items));
  });
});

test('labels reach paragraph size', async () => {
  await withLazyPage({ width: 1440, height: 1000 }, async (page) => {
    await waitForDiagram(page);
    const sizes = await figureContainer(page).locator('svg text').evaluateAll((labels) => labels
      .filter((label) => label.textContent.trim())
      .map((label) => {
        const matrix = label.getScreenCTM();
        return parseFloat(getComputedStyle(label).fontSize) * Math.hypot(matrix.c, matrix.d);
      }));
    assert.ok(sizes.length > 0);
    assert.ok(Math.min(...sizes) >= PARAGRAPH_PX - 0.1, `smallest label ${Math.min(...sizes)}px < ${PARAGRAPH_PX}px`);
  });
});

test('an overflowing figure becomes keyboard-scrollable (tabindex 0)', async () => {
  await withLazyPage({ width: 320, height: 800 }, async (page) => {
    await waitForDiagram(page);
    const container = figureContainer(page);
    await page.locator('figure.sebook-figure--archuml-c4 > [role="img"][tabindex="0"]').waitFor();
    await container.focus();
    await container.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('figure.sebook-figure--archuml-c4 > [role="img"]').scrollLeft > 0);
  });
});

test('a failed script load shows an accessible error state', async () => {
  await withLazyPage({ width: 1440, height: 1000 }, async (page, requested) => {
    const container = figureContainer(page);
    const message = container.locator('.uml-error-msg');
    await message.waitFor();
    const text = (await message.innerText()).trim();
    assert.match(text, /could not be loaded/i);
    assert.equal(await container.getAttribute('aria-label'), text);
    assert.equal(await container.locator('svg').count(), 0);
    assert.equal(requested.filter((url) => url === CORE_URL).length, 1, 'the stub does not retry the failed script');
  }, async (route, url) => {
    if (url !== CORE_URL) return false;
    await route.fulfill({ status: 404, body: 'Not found' });
    return true;
  });
});

test('a renderer that throws after a lazy load shows an accessible error state', async () => {
  const RENDER_URL = `${ORIGIN}/js/ArchUML/c4/c4-render.js`;
  // A stand-in for a renderer that rejects the view, as c4-render.js does for a notation it cannot draw yet.
  const THROWING_RENDERER = "window.ArchUMLC4Render = { render: function () { throw new Error('cannot draw'); } };";
  const uncaught = [];
  await withLazyPage({ width: 1440, height: 1000 }, async (page) => {
    page.on('pageerror', (error) => uncaught.push(error.message));
    const container = figureContainer(page);
    const message = container.locator('.uml-error-msg');
    await message.waitFor();
    const text = (await message.innerText()).trim();
    assert.match(text, /could not be drawn/i);
    assert.equal(await container.getAttribute('aria-label'), text);
    assert.equal(await container.getByText('Loading diagram').count(), 0, 'the loading placeholder is gone');
    assert.deepEqual(uncaught, [], 'the failure is handled, not left as an unhandled rejection');
  }, async (route, url) => {
    if (url !== RENDER_URL) return false;
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: THROWING_RENDERER });
    return true;
  });
});
