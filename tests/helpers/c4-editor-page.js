// @ts-check
// A page for C4 editor specs that need no site build (spec §3.4: the editor is framework-free and talks only to its
// host). `loadC4Editor` writes a minimal page with the site's 62.5% root font size, then injects the merged editor
// stylesheet and every script the ArchUML C4 manifest lists, in manifest order; with `siteThemes` it also injects the
// site's diagram and editor theme stylesheets, as the built pages load them; with `diagramEditor` it also loads the
// diagram editor's `core` group and stylesheet before the C4 editor, as the pages of the UML-notation views do. Hosts are built inside the page by the
// specs themselves, so each spec shows which host methods it relies on.
const fs = require('node:fs');
const path = require('node:path');

const ARCHUML = path.join(__dirname, '../../js/ArchUML');
const C4 = require(path.join(ARCHUML, 'c4/c4-core.js'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const SCRIPTS = ['uml-bundle.js', ...MANIFEST.core, ...MANIFEST.render, ...MANIFEST.editor].map((file) => path.join(ARCHUML, file));
const STYLESHEET = path.join(ARCHUML, 'css/c4-editor.css');
// The diagram editor's `core` group (UML-view editing spec §2.2: the C4 host loads only `core`) and its stylesheet.
const DIAGRAM_EDITOR_MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'diagram-editor/manifest.json'), 'utf8'));
const DIAGRAM_EDITOR_SCRIPTS = DIAGRAM_EDITOR_MANIFEST.core.map((file) => path.join(ARCHUML, file));
const DIAGRAM_EDITOR_STYLESHEET = path.join(ARCHUML, 'css/diagram-editor.css');
const FIRST_C4_EDITOR_SCRIPT = path.join(ARCHUML, MANIFEST.editor[0]);
// The site's stylesheets that theme a C4 editor on a built page (UML-view editing spec §7.8): the diagrams' dark-mode
// invert filter (css/uml-diagram.css) and the editor's tokens for the site's themes (css/c4-editor-theme.css).
const SITE_THEMES = ['css/uml-diagram.css', 'css/c4-editor-theme.css'].map((file) => path.join(__dirname, '../..', file));
const CSS_IMPORT = /@import\s+url\(\s*["']?([^"')]+)["']?\s*\)\s*;/g;
const REFERENCE = fs.readFileSync(path.join(ARCHUML, 'tests/c4/fixtures/course-registration.yml'), 'utf8');
// The model a learner starts from on the editor page's "Blank model" (_includes/c4-editor.html).
const BLANK = 'schema: c4-design/1\nname: My design\n';
const PARAGRAPH_PX = 20;

/**
 * The page's HTML: an optional `<meta>` Content-Security-Policy, a 96 px sticky site header when `header` is set,
 * and one empty mount point per id in `roots`.
 */
function pageHtml({ title, roots = ['editor'], csp = null, header = false }) {
  const policy = csp ? `<meta http-equiv="Content-Security-Policy" content="${csp}">` : '';
  const siteHeader = header ? '<header class="site-header"><p>Site navigation</p></header>' : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">${policy}<title>${title}</title>
<style>
  html { font-size: 62.5%; }
  body { margin: 0; font-size: ${PARAGRAPH_PX}px; background: #ffffff; color: #1a1a1a; }
  html.dark-mode body { background: #121212; color: #e6edf3; }
  .site-header { position: sticky; top: 0; z-index: 10; height: 96px; margin: 0; background: #ffffff; border-bottom: 1px solid #555555; }
  html.dark-mode .site-header { background: #121212; }
  main { padding: 16px; }
</style>
</head><body>${siteHeader}<main><h1>${title}</h1>${roots.map((id) => `<div id="${id}"></div>`).join('')}</main></body></html>`;
}

// A page set with setContent is about:blank, which is not a secure context, so browser APIs limited to secure contexts
// (the Keyboard Lock API among them) are absent there. A `secure` page is served from this HTTPS origin instead,
// answered by the test itself, so nothing leaves the machine.
const SECURE_ORIGIN = 'https://c4-editor.test/';

/**
 * Injects the stylesheet at `file`, preceded by the stylesheets it imports. A page written with `setContent` has no
 * base URL against which an `@import url(...)` could resolve, so each import is read from disk, relative to `file`.
 */
async function addStylesheet(page, file) {
  const css = fs.readFileSync(file, 'utf8');
  for (const [, href] of css.matchAll(CSS_IMPORT)) await addStylesheet(page, path.resolve(path.dirname(file), href));
  await page.addStyleTag({ content: css.replace(CSS_IMPORT, '') });
}

/**
 * Writes the page, then injects the stylesheet and the manifest's scripts. `beforeScripts`, when given, runs in the
 * page first (traps and recorders that must see everything the scripts do). With `secure`, the page is a secure
 * context (see SECURE_ORIGIN). With `siteThemes`, the site's theme stylesheets (SITE_THEMES) follow the editor's, so
 * dark-mode checks see the invert filter on the drawing and the theme's tokens on the controls. With `diagramEditor`,
 * the diagram editor's `core` scripts load after the core and render groups and before the C4 editor's scripts, and its
 * stylesheet (`js/ArchUML/css/diagram-editor.css`, once Lane R's module ships it) after the editor's.
 */
async function loadC4Editor(page, { title = 'C4 editor', roots, csp, header, beforeScripts, secure = false, siteThemes = false,
  diagramEditor = false } = {}) {
  const html = pageHtml({ title, roots, csp, header });
  if (secure) {
    await page.route(SECURE_ORIGIN, (route) => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(SECURE_ORIGIN);
  } else {
    await page.setContent(html);
  }
  if (beforeScripts) await page.evaluate(beforeScripts);
  await page.addStyleTag({ path: STYLESHEET });
  if (diagramEditor && fs.existsSync(DIAGRAM_EDITOR_STYLESHEET)) await addStylesheet(page, DIAGRAM_EDITOR_STYLESHEET);
  if (siteThemes) for (const file of SITE_THEMES) await addStylesheet(page, file);
  for (const script of SCRIPTS) {
    if (diagramEditor && script === FIRST_C4_EDITOR_SCRIPT) for (const part of DIAGRAM_EDITOR_SCRIPTS) await page.addScriptTag({ path: part });
    await page.addScriptTag({ path: script });
  }
}

// ---- Pointer gestures ----------------------------------------------------------------------------------------------

/** The centre of `locator` in client pixels, after scrolling it into view. */
async function centreOf(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`no box for ${locator}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses at `from`, moves to `to` in steps (so the drag passes its threshold), and releases. */
async function dragBetween(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

/**
 * An empty client point of the visible canvas region `canvasRegion`, at least `margin` px from every element box,
 * boundary label, and control in it, scanning from the top left; null when there is none.
 */
function emptySpotInCanvas(canvasRegion, margin = 60) {
  return canvasRegion.evaluate((region, gap) => {
    const visible = region.getBoundingClientRect();
    const occupied = [...region.querySelectorAll('[data-layout-id], [data-c4-boundary] text, button, p, input')]
      .map((node) => node.getBoundingClientRect()).filter((box) => box.width > 0);
    const left = visible.left + gap;
    const right = Math.min(visible.right, window.innerWidth) - gap;
    const top = Math.max(visible.top, 0) + gap;
    const bottom = Math.min(visible.bottom, window.innerHeight) - gap;
    for (let y = top; y < bottom; y += 10) {
      for (let x = left; x < right; x += 20) {
        const free = occupied.every((box) => x < box.left - gap || x > box.right + gap || y < box.top - gap || y > box.bottom + gap);
        if (free) return { x, y };
      }
    }
    return null;
  }, margin);
}

module.exports = { C4, REFERENCE, BLANK, PARAGRAPH_PX, loadC4Editor, centreOf, dragBetween, emptySpotInCanvas };
