// @ts-check
// C4 figures as readers meet them: the reference page, which preloads the C4 scripts (`c4: true`) and also shows
// views delegated to the UML renderers; the C4 chapter, whose figures the static build prerenders
// (`static_uml: true`); and test-uml.html, which does not preload them, so its figure renders through the lazy path.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const REFERENCE_URL = '/SEBook/tools/uml-reference.html#c4-model-diagrams';
const CHAPTER_URL = '/SEBook/architecture/c4.html';
const LAZY_URL = '/test-uml.html';
const DARK_FILTER = 'invert(1) hue-rotate(180deg)';

/**
 * Every `<pre><code class="language-c4">` example in the reference becomes one figure on the reference page; the
 * drawing gates count the drawings, which leaves out the examples of an interface description (a card of text).
 */
function referenceDrawingCount() {
  const reference = fs.readFileSync(path.join(REPO_ROOT, 'js/ArchUML/REFERENCE.md'), 'utf8');
  const examples = reference.split(/^<pre><code class="language-c4">/m).slice(1);
  return examples.filter((example) => !/^view: interface /m.test(example.split('</code></pre>')[0])).length;
}

/**
 * The chapter's C4 drawings: 13 `c4-view` includes and 7 fenced `c4` blocks in the text, and 5 in its quiz, less its
 * 3 interface descriptions, which are cards of text (spec §6.6).
 */
const CHAPTER_FIGURES = { url: CHAPTER_URL, figures: 22, prerendered: true };
/**
 * test-uml.html's C4 drawings: the container view and the interfaces views of the Registration API and the
 * Registration Coordinator (Ruling 19). Its two interface cards are text, so the drawing gates leave them out.
 */
const LAZY_FIGURES = { url: LAZY_URL, figures: 3 };

const PAGES = [{ url: REFERENCE_URL, figures: referenceDrawingCount() }, CHAPTER_FIGURES, LAZY_FIGURES];

/**
 * The C4 drawing containers of the page (the class the bundle registers for `c4`), without interface cards, which
 * are text (spec §6.6), and without the canvases of editor embeds (the chapter's two "Try it" editors), which are
 * editable workspaces with their own tests, not figures.
 */
function c4Containers(page) {
  return page.locator('.uml-c4-diagram-container:not([data-c4-notation="interface-card"]):not(.c4-editor-embed *)');
}

/** The rendered C4 figures of the page: images drawn into a C4 container. */
function c4Figures(page) {
  return page.getByRole('img').and(c4Containers(page));
}

/**
 * Opens the page of `pageFigures` (`{url, figures}`), opens every collapsed section that holds a C4 figure (as a
 * reader does to see a suggested solution), and waits until each of its C4 figures shows a drawing. Returns the
 * figures a reader is shown: a quiz shows one question card at a time (all of them in print).
 */
async function openWithFigures(page, { url, figures: count }) {
  await page.goto(url);
  const containers = c4Containers(page);
  await expect(containers).toHaveCount(count);
  const sections = page.locator('details').filter({ has: page.locator('.uml-c4-diagram-container') });
  for (const details of await sections.all()) {
    if (!(await details.evaluate((element) => element.open))) await details.locator(':scope > summary').click();
  }
  // A figure draws when a reader scrolls to it, as the chapter's figures do; bring each shown one into view once.
  for (const container of await containers.all()) {
    if (await container.isVisible()) await container.scrollIntoViewIfNeeded();
  }
  // A figure still loading its scripts shows a message ("Loading diagram"); wait until every one shows a drawing.
  await expect(containers.filter({ has: page.locator('svg') })).toHaveCount(count);
  const figures = c4Figures(page);
  await expect(figures.first()).toBeVisible();
  return figures;
}

/**
 * Turns on the site's dark theme and waits until every figure shows the drawing that the theme change re-rendered.
 * test-uml.html re-renders its hundred-odd figures on every theme change, which takes several seconds. A page whose
 * figures the static build drew (`prerendered`) keeps those drawings: their baked fills and the invert filter
 * already serve both themes.
 */
async function switchToDarkMode(page, figures, { prerendered }) {
  await page.evaluate(() => {
    window.lightDrawings = [...document.querySelectorAll('.uml-c4-diagram-container svg')];
    document.documentElement.classList.add('dark-mode');
  });
  if (prerendered) return;
  await expect.poll(() => figures.evaluateAll((containers) => containers.every((container) => {
    const svg = container.querySelector('svg');
    return Boolean(svg) && !window.lightDrawings.includes(svg);
  })), { timeout: 45_000 }).toBe(true);
}

// ---- Page-side readers. Playwright serializes each one on its own, so none of them calls another; the colour
// maths they share is installed in every page once, as `window.c4ColourMaths`, before the page's own scripts. ----

/**
 * Runs in the page. Defines the colour maths the contrast readers share: CSS colour parsing, alpha compositing, WCAG
 * relative luminance and contrast ratio, the background painted behind an element, and the CSS filters from an
 * element up to the root.
 */
function installColourMaths() {
  const parse = (colour) => {
    const [r, g, b, a = 1] = colour.match(/[\d.]+/g).map(Number);
    return { rgb: [r, g, b], a };
  };
  const over = (top, bottom) => top.rgb.map((channel, index) => channel * top.a + bottom[index] * (1 - top.a));
  const luminance = (rgb) => {
    const [r, g, b] = rgb.map((channel) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrastRatio = (a, b) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  };
  const backgroundOf = (element) => {
    const layers = [];
    for (let current = element; current; current = current.parentElement) {
      const layer = parse(getComputedStyle(current).backgroundColor);
      if (layer.a > 0) layers.push(layer);
      if (layer.a === 1) break;
    }
    return layers.reverse().reduce((below, layer) => over(layer, below), [255, 255, 255]);
  };
  /** The contrast of the element's text colour, composited on its background, against that background. */
  const textContrast = (element) => {
    const background = backgroundOf(element);
    return contrastRatio(over(parse(getComputedStyle(element).color), background), background);
  };
  const filtersUpToRoot = (element) => {
    const filters = [];
    for (let current = element; current; current = current.parentElement) {
      const filter = getComputedStyle(current).filter;
      if (filter !== 'none') filters.push(filter);
    }
    return filters;
  };
  window.c4ColourMaths = { parse, luminance, contrastRatio, backgroundOf, textContrast, filtersUpToRoot };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installColourMaths);
});

/** The embed text each figure was drawn from, decoded from its `data-c4-source` element (null when missing). */
function embedSources(containers) {
  return containers.map((container) => {
    const element = container.querySelector('script[type="application/json"][data-c4-source]');
    return element ? JSON.parse(element.textContent) : null;
  });
}

/** What the C4 core says about the view each figure's embed selects. */
function coreViews(containers) {
  const core = window.ArchUMLC4;
  return containers.map((container) => {
    const text = JSON.parse(container.querySelector('script[data-c4-source]').textContent);
    const selector = core.extractEmbed(text).selector;
    const view = core.project(core.load(text), selector);
    return { selector, resolves: view.type !== null, brief: view.type === null ? null : core.describe(view).brief };
  });
}

/** Every SVG text whose on-screen size is below the surrounding paragraph text. */
function labelsBelowParagraphSize(containers) {
  const paragraph = document.querySelector('main p') || document.body;
  const paragraphSize = parseFloat(getComputedStyle(paragraph).fontSize);
  return containers.flatMap((container) => [...container.querySelectorAll('svg text')]
    .filter((label) => label.textContent.trim())
    .map((label) => {
      const matrix = label.getScreenCTM();
      return { label: label.textContent, size: parseFloat(getComputedStyle(label).fontSize) * Math.hypot(matrix.c, matrix.d) };
    })
    .filter(({ size }) => size < paragraphSize - 0.1)
    .map((failure) => ({ ...failure, paragraphSize })));
}

/** The `fill` attributes baked into each figure's drawing, in document order. */
function bakedFills(containers) {
  return containers.map((container) => [...container.querySelectorAll('svg [fill]')]
    .map((element) => `${element.tagName}:${element.getAttribute('fill')}`));
}

/**
 * For every relationship label of the figures' drawings, the contrast between its backdrop as the reader sees it and
 * the page colour `pageHex` around the figure: the computed fill, passed through the site's dark-mode filter
 * (invert(1) hue-rotate(180deg), the Filter Effects 1 matrix) when the drawing has it. A backdrop that matches the
 * page is about 1:1; a white backdrop under the dark filter shows as a black patch, 1.2:1 on the navy page.
 */
function labelBackdropContrasts(containers, pageHex) {
  const { parse, contrastRatio, filtersUpToRoot } = window.c4ColourMaths;
  const hueRotate180 = [[-0.574, 1.430, 0.144], [0.426, 0.430, 0.144], [0.426, 1.430, -0.856]];
  const throughDarkFilter = (rgb) => hueRotate180.map((row) => Math.min(255, Math.max(0, row.reduce((sum, weight, index) => sum + weight * (255 - rgb[index]), 0))));
  const pageRgb = [1, 3, 5].map((start) => parseInt(pageHex.slice(start, start + 2), 16));
  return containers.flatMap((container) => [...container.querySelectorAll('svg [data-layout-route-id] rect')].map((rect) => {
    const fill = parse(getComputedStyle(rect).fill).rgb;
    const seen = filtersUpToRoot(rect).length > 0 ? throughDarkFilter(fill) : fill;
    return Math.round(contrastRatio(seen, pageRgb) * 100) / 100;
  }));
}

/** For every text of every figure, the CSS filters applied on the way from it up to the document root. */
function filtersOverText(containers) {
  return containers.flatMap((container) => [...container.querySelectorAll('svg text')].map(window.c4ColourMaths.filtersUpToRoot));
}

/** How far each drawing is wider than its figure, for drawings that do not fit. */
function drawingOverflow(containers) {
  return containers.flatMap((container) => [...container.querySelectorAll('svg')]
    .map((svg) => svg.getBoundingClientRect().width - container.clientWidth)
    .filter((excess) => excess > 1));
}

/** For each figure: whether it is wider than its box, whether it is a tab stop, and its focusable descendants. */
function keyboardStops(containers) {
  const focusable = 'a[href], button, input, select, textarea, [tabindex]';
  return containers.map((container) => ({
    overflowing: container.scrollWidth > container.clientWidth + 1,
    tabStop: container.getAttribute('tabindex') === '0',
    focusableInside: [...container.querySelectorAll(focusable)].map((element) => element.outerHTML.slice(0, 120)),
  }));
}

/** The position of every element box of an SVG drawing (given as markup), keyed by element id. */
function nodePositions(svgText) {
  const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  return Object.fromEntries([...svg.querySelectorAll('[data-layout-id]')]
    .map((node) => [node.getAttribute('data-layout-id'), node.getAttribute('transform')]));
}

/** Draws `text` through the static prerender driver (js/ArchUML/uml_to_svg.js), as the Jekyll build does. */
function staticSvg(text) {
  const stdout = execFileSync('node', ['js/ArchUML/uml_to_svg.js'], {
    cwd: REPO_ROOT,
    input: JSON.stringify({ figure: { type: 'c4', text } }),
    encoding: 'utf8',
  });
  return JSON.parse(stdout).figure;
}

// ---- Print: every label at 9 pt or larger (instructor decision; routing redesign §9.3 "Print") -------------------

/**
 * The C4 pages a reader prints: the reference, the chapter with its quiz, and the two tutorials' print views. The
 * interfaces tutorial shows its one C4 view as an interface card, which is text at paragraph size, not a drawing.
 */
const PRINT_PAGES = [
  { url: REFERENCE_URL, drawings: true },
  { url: CHAPTER_URL, drawings: true },
  { url: '/SEBook/architecture/c4-tutorial/print.html', drawings: true },
  { url: '/SEBook/architecture/c4-interfaces-tutorial/print.html', drawings: false },
];

/**
 * The printed column (CSS px, 96 per inch) of each paper and orientation: the paper less the site's 2 cm `@page`
 * margins on each side in portrait (_sass/_print.scss) and less the 0.75 cm margins of the `c4-landscape` page on
 * each side in landscape (css/uml-diagram.css).
 */
const MM = 96 / 25.4;
const PAPERS = {
  A4: { portrait: Math.floor((210 - 2 * 20) * MM), landscape: Math.floor((297 - 2 * 7.5) * MM) },
  Letter: { portrait: Math.floor((215.9 - 2 * 20) * MM), landscape: Math.floor((279.4 - 2 * 7.5) * MM) },
};

/** The instructor's floor for every printed label of a C4 figure (routing redesign §9.3 "Print"). */
const PRINT_FLOOR_PT = 9;

/**
 * Runs in the page. For every C4 drawing printed in `orientation` (its drawing marked `data-c4-print="landscape"`
 * or not): its caption (or, in the quiz, which has none, its model and view) and its smallest text in pt. Interface
 * cards are text at paragraph size, and the chapter's "Try it" editors are workspaces, not figures.
 */
function printedTextSizes(containers, orientation) {
  return containers.flatMap((container) => {
    const svg = container.querySelector('svg');
    if (!svg || (svg.getAttribute('data-c4-print') === 'landscape') !== (orientation === 'landscape')) return [];
    const texts = [...svg.querySelectorAll('text')].filter((text) => text.textContent.trim());
    const caption = container.closest('figure')?.querySelector('figcaption')?.textContent.trim();
    const source = JSON.parse(container.querySelector('script[data-c4-source]').textContent);
    const name = caption || `${window.ArchUMLC4.load(source).model.meta.name}: ${window.ArchUMLC4.extractEmbed(source).selector}`;
    const sizes = texts.map((text) => {
      const matrix = text.getScreenCTM();
      return parseFloat(text.closest('[font-size]').getAttribute('font-size')) * Math.hypot(matrix.a, matrix.b) * 0.75;
    });
    return [{ name, smallest: Math.round(Math.min(...sizes) * 100) / 100 }];
  });
}

/**
 * Opens `url` in print emulation in a column `width` px wide, opens every collapsed section, and brings each C4
 * container into view once (figures draw when a reader reaches them), then waits until every one shows a drawing
 * or a card. Returns the C4 containers that hold drawings.
 */
async function openForPrint(page, url, width) {
  await page.setViewportSize({ width, height: 1100 });
  await page.emulateMedia({ media: 'print' });
  await page.goto(url);
  const containers = page.locator('.uml-c4-diagram-container:not(.c4-editor-embed *)');
  await expect(containers.first()).toBeAttached();
  for (const details of await page.locator('details').filter({ has: containers }).all()) {
    await details.evaluate((element) => { element.open = true; });
  }
  for (const container of await containers.all()) await container.scrollIntoViewIfNeeded();
  await expect(containers.filter({ hasNot: page.locator('svg, article') })).toHaveCount(0);
  return containers.filter({ has: page.locator('svg') });
}

/**
 * Every figure's embed source, the notation of its view, and a live drawing of that source: the page's C4 renderer
 * draws it into a fresh container in the figure (a prerendered page shows the static drawing itself), which is then
 * removed again with any diagnostics list it added.
 */
function liveDrawingsWithSources(containers) {
  const core = window.ArchUMLC4;
  return containers.map((container) => {
    const source = JSON.parse(container.querySelector('script[type="application/json"][data-c4-source]').textContent);
    const fresh = document.createElement('div');
    container.parentElement.append(fresh);
    window.ArchUMLC4Render.render(fresh, source);
    const svg = fresh.querySelector('svg').outerHTML;
    while (fresh.nextElementSibling) fresh.nextElementSibling.remove();
    fresh.remove();
    return { source, notation: core.project(core.load(source), core.extractEmbed(source).selector).notation, svg };
  });
}

/**
 * The layout of a drawing (given as markup) that a delegated UML renderer drew: the placement attributes of every
 * element box (its layout or bounds hook) and the geometry of every route line, in document order. Fills and the
 * viewBox margin are left out, because the bundle's renderers bake them differently in the static driver and on a
 * page (Ruling 20).
 */
function layoutGeometry(svgText) {
  const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  const attributes = (element, names) => names.map((name) => element.getAttribute(name)).filter((value) => value !== null).join(' ');
  return {
    nodes: [...svg.querySelectorAll('[data-layout-id], [data-layout-bounds-id]')].map((node) => {
      const id = node.getAttribute('data-layout-id') || node.getAttribute('data-layout-bounds-id');
      return `${id}: ${attributes(node, ['transform', 'x', 'y', 'width', 'height'])}`;
    }),
    routes: [...svg.querySelectorAll('path[data-layout-route-id], polyline[data-layout-route-id], line[data-layout-route-id]')]
      .map((route) => `${route.getAttribute('data-layout-route-id')}: ${attributes(route, ['d', 'points', 'x1', 'y1', 'x2', 'y2'])}`),
  };
}

/**
 * An interfaces view's figure body (given as markup, as the static driver returns it): the texts around the drawing
 * in document order, and the drawing's markup.
 */
function figureBodyParts(html) {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  return {
    texts: [...body.querySelectorAll('p')].filter((element) => !element.closest('svg')).map((element) => element.textContent),
    svg: body.querySelector('svg').outerHTML,
  };
}

/**
 * The SVG markup without the root's accessibility attributes. A page names the figure on its container and hides
 * the drawing (`aria-hidden`, `focusable`); the static driver names the drawing itself (`role`, `aria-label`).
 */
function withoutRootAccessibility(svgText) {
  const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  ['role', 'aria-label', 'aria-hidden', 'focusable'].forEach((name) => svg.removeAttribute(name));
  return new XMLSerializer().serializeToString(svg);
}

for (const pageFigures of PAGES) {
  const { url } = pageFigures;
  test.describe(url, () => {
    test('every C4 figure is drawn from a source with exactly one top-level view that resolves', async ({ page }) => {
      const figures = await openWithFigures(page, pageFigures);
      for (const source of await figures.evaluateAll(embedSources)) {
        expect(source, 'figure carries its embed source').not.toBeNull();
        expect(source.match(/^view\s*:/gm), `top-level view keys in:\n${source}`).toHaveLength(1);
      }
      for (const view of await figures.evaluateAll(coreViews)) {
        expect(view, `view "${view.selector}" resolves`).toMatchObject({ resolves: true });
      }
    });

    test('C4 figures expose an image role with the described label', async ({ page }) => {
      const figures = await openWithFigures(page, pageFigures);
      const views = await figures.evaluateAll(coreViews);
      for (const [index, { brief }] of views.entries()) {
        await expect(figures.nth(index)).toHaveAccessibleName(brief);
      }
    });

    for (const width of [320, 1440]) {
      test(`labels are at least paragraph size at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        const figures = await openWithFigures(page, pageFigures);
        await page.evaluate(() => document.fonts.ready);
        expect(await figures.evaluateAll(labelsBelowParagraphSize)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page reflows').toBe(true);
      });
    }

    test('a C4 figure at 320 px is one keyboard stop with no focusable parts inside the image', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      const figures = await openWithFigures(page, pageFigures);
      // An image role cannot contain controls (WCAG 4.1.2): the figure itself is the scroll target when it overflows.
      await expect.poll(() => figures.evaluateAll(keyboardStops).then((stops) => stops.filter((stop) => stop.overflowing && !stop.tabStop)))
        .toEqual([]);
      const stops = await figures.evaluateAll(keyboardStops);
      expect(stops.some((stop) => stop.overflowing), 'some figure overflows at 320 px').toBe(true);
      expect(stops.flatMap((stop) => stop.focusableInside)).toEqual([]);
    });

    test('dark mode inverts the C4 SVG once and keeps baked fills identical', async ({ page }) => {
      test.slow();
      const figures = await openWithFigures(page, pageFigures);
      const lightFills = await figures.evaluateAll(bakedFills);
      await switchToDarkMode(page, figures, pageFigures);
      expect(await figures.evaluateAll(bakedFills)).toEqual(lightFills);
      const filters = await figures.evaluateAll(filtersOverText);
      expect(filters.length).toBeGreaterThan(0);
      expect(filters.filter((chain) => chain.length !== 1 || chain[0] !== DARK_FILTER)).toEqual([]);
    });

    // The light page is #fdfdfd and the dark page #111827 (css/sebook-theme.css, css/diagnostic-pages.css).
    test('a relationship label sits on the page colour in light and dark mode', async ({ page }) => {
      test.slow();
      const figures = await openWithFigures(page, pageFigures);
      const light = await figures.evaluateAll(labelBackdropContrasts, '#fdfdfd');
      expect(light.length, 'the figures have relationship labels').toBeGreaterThan(0);
      expect(light.filter((ratio) => ratio > 1.05), 'light backdrops differ from the page').toEqual([]);
      await switchToDarkMode(page, figures, pageFigures);
      expect((await figures.evaluateAll(labelBackdropContrasts, '#111827')).filter((ratio) => ratio > 1.05),
        'dark backdrops differ from the page').toEqual([]);
    });

    test('print uses the light palette and fits a paper-width page', async ({ page }) => {
      test.slow();
      // Letter or A4 paper at the browser's default margins leaves about 720 CSS px for the content.
      await page.setViewportSize({ width: 720, height: 1000 });
      const figures = await openWithFigures(page, pageFigures);
      // Print shows figures the screen hides (every card of a quiz), so the checks read every drawn figure.
      const drawings = c4Containers(page);
      const lightFills = await drawings.evaluateAll(bakedFills);
      await switchToDarkMode(page, figures, pageFigures);
      // Printing fires beforeprint, which the print-light controller answers by leaving dark mode (figures redraw).
      await page.emulateMedia({ media: 'print' });
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      await expect.poll(() => drawings.evaluateAll(filtersOverText).then((chains) => chains.flat())).toEqual([]);
      await expect.poll(() => drawings.evaluateAll(bakedFills)).toEqual(lightFills);
      await expect.poll(() => drawings.evaluateAll(drawingOverflow)).toEqual([]);
    });

    // C4-notation views match byte for byte apart from the root's accessibility attributes; views delegated to a
    // UML renderer (class, sequence, deployment, and the component diagram of an interfaces view, which the static
    // driver returns inside its figure body) match in node coordinates and route points (Ruling 20).
    test('the static build and live render produce the same node coordinates and SVG', async ({ page }) => {
      const figures = await openWithFigures(page, pageFigures);
      for (const { source, notation, svg } of await figures.evaluateAll(liveDrawingsWithSources)) {
        const prerenderedFigure = staticSvg(source);
        const prerendered = notation === 'uml-component'
          ? (await page.evaluate(figureBodyParts, prerenderedFigure)).svg
          : prerenderedFigure;
        if (notation === 'c4') {
          expect(await page.evaluate(nodePositions, prerendered), `node coordinates of:\n${source}`)
            .toEqual(await page.evaluate(nodePositions, svg));
          expect(await page.evaluate(withoutRootAccessibility, prerendered), `SVG of:\n${source}`)
            .toBe(await page.evaluate(withoutRootAccessibility, svg));
        } else {
          const live = await page.evaluate(layoutGeometry, svg);
          expect(live.nodes.length + live.routes.length, `the ${notation} view of:\n${source}\nhas layout hooks`).toBeGreaterThan(0);
          expect(await page.evaluate(layoutGeometry, prerendered), `layout of the ${notation} view of:\n${source}`).toEqual(live);
        }
      }
    });
  });
}

/** For each fit button, the tooltip id it is described by and how many elements on the page carry that id. */
function fitTooltipTargets(buttons) {
  return buttons.map((button) => {
    const id = button.getAttribute('aria-describedby');
    return { id, elements: document.querySelectorAll(`[id="${id}"]`).length };
  });
}

test('every fit button on the reference page is described by a tooltip of its own', async ({ page }) => {
  // The page renders its UML examples itself once the layout's bundle has run; a second copy of the bundle gave
  // every figure a second set of fit buttons whose tooltip ids repeated the first set's (WCAG 4.1.2, 2.4.11).
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(REFERENCE_URL);
  await expect(page.locator('.uml-lazy-placeholder')).toHaveCount(0);
  const fitButtons = page.locator('main button[aria-describedby^="uml-fit-tooltip-"]');
  await expect.poll(() => fitButtons.count(), 'some figure is too wide at 320 px and offers a fit button').toBeGreaterThan(0);
  const targets = await fitButtons.evaluateAll(fitTooltipTargets);
  expect(targets.filter(({ elements }) => elements !== 1)).toEqual([]);
});

const CONTAINER_VIEW_BRIEF = 'Container view of Course Registration: 3 containers, 1 person, 1 external system, 4 relationships.';

for (const { url, drawings } of PRINT_PAGES) {
  test.describe(`printing ${url}`, () => {
    for (const [paper, columns] of Object.entries(PAPERS)) {
      test(`every label of every C4 figure prints at 9 pt or larger on ${paper} paper`, async ({ page }) => {
        test.slow();
        const printed = [];
        for (const orientation of ['portrait', 'landscape']) {
          const figures = await openForPrint(page, url, columns[orientation]);
          printed.push(...(await figures.evaluateAll(printedTextSizes, orientation)).map((entry) => ({ ...entry, orientation })));
        }
        if (drawings) expect(printed.length, 'the page prints C4 drawings').toBeGreaterThan(0);
        else expect(printed, 'the page prints its C4 views as text, not as drawings').toEqual([]);
        expect(printed.filter(({ smallest }) => smallest < PRINT_FLOOR_PT)).toEqual([]);
      });
    }
  });
}

/**
 * Runs in the page. For the drawing on each editor canvas printed in `orientation` (marked
 * `data-c4-print="landscape"` or not): the canvas's name and the smallest text of its drawing in pt.
 */
function editorPrintedTextSizes(drawings, orientation) {
  return drawings.flatMap((drawing) => {
    const svg = drawing.querySelector('svg');
    if (!svg || (svg.getAttribute('data-c4-print') === 'landscape') !== (orientation === 'landscape')) return [];
    const sizes = [...svg.querySelectorAll('text')].filter((text) => text.textContent.trim()).map((text) => {
      const matrix = text.getScreenCTM();
      return parseFloat(text.closest('[font-size]').getAttribute('font-size')) * Math.hypot(matrix.a, matrix.b) * 0.75;
    });
    const canvas = drawing.closest('[role="region"]');
    return [{ name: canvas ? canvas.getAttribute('aria-label') : 'editor canvas', smallest: Math.round(Math.min(...sizes) * 100) / 100 }];
  });
}

// The chapter's two "Try it" editors print their drawing like a figure: on a landscape page when a portrait column
// would print its labels below 9 pt (the editor's canvas marks its drawing as `render` marks a figure's).
test.describe(`printing the "Try it" editors of ${CHAPTER_URL}`, () => {
  for (const [paper, columns] of Object.entries(PAPERS)) {
    test(`every editor drawing prints its labels at 9 pt or larger on ${paper} paper`, async ({ page }) => {
      test.slow();
      const printed = [];
      for (const orientation of ['portrait', 'landscape']) {
        await page.setViewportSize({ width: columns[orientation], height: 1100 });
        await page.emulateMedia({ media: 'print' });
        await page.goto(CHAPTER_URL);
        const drawings = page.locator('.c4-editor-embed .uml-c4-diagram-container');
        await expect(drawings).toHaveCount(2);
        for (const drawing of await drawings.all()) await drawing.scrollIntoViewIfNeeded();
        await expect(drawings.filter({ has: page.locator('svg') })).toHaveCount(2);
        printed.push(...(await drawings.evaluateAll(editorPrintedTextSizes, orientation)).map((entry) => ({ ...entry, orientation })));
      }
      expect(printed.length, 'each editor prints its drawing once').toBe(2);
      expect(printed.filter(({ smallest }) => smallest < PRINT_FLOOR_PT)).toEqual([]);
    });
  }
});

/** Each page of the PDF at `pdfPath`: whether it is landscape, and its text without white space. */
function printedPages(pdfPath) {
  const info = execFileSyncNamingPoppler('pdfinfo', ['-f', '1', '-l', '9999', pdfPath]);
  return [...info.matchAll(/^Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+)/gm)].map(([, number, width, height]) => ({
    landscape: Number(width) > Number(height),
    text: execFileSyncNamingPoppler('pdftotext', ['-f', number, '-l', number, '-raw', '-enc', 'UTF-8', pdfPath, '-']).replace(/\s+/g, ''),
  }));
}

/**
 * Runs in the page. For every drawing marked `data-c4-print="landscape"`, text that finds its page in the PDF: its
 * caption, or, for a figure without one (the reference's examples, a tutorial's print view), its longest line of
 * drawn text; white space removed, at most 60 characters.
 */
function landscapeFigureMarks(containers) {
  const squeezed = (text) => text.replace(/\s+/g, '').slice(0, 60);
  return containers.filter((container) => container.querySelector('svg').getAttribute('data-c4-print') === 'landscape').map((container) => {
    const caption = container.closest('figure')?.querySelector('figcaption')?.textContent;
    if (caption && caption.trim()) return squeezed(caption);
    const lines = [...container.querySelectorAll('svg text')].map((text) => text.textContent.trim());
    return squeezed(lines.reduce((longest, line) => (line.length > longest.length ? line : longest), ''));
  });
}

for (const { url } of PRINT_PAGES.filter((printPage) => printPage.drawings)) {
  test.describe(`printing ${url} to PDF`, () => {
    for (const format of ['Letter', 'A4']) {
      test(`a C4 figure too wide for a portrait page prints on a landscape page, and the text around it does not (${format})`, async ({ page }, testInfo) => {
        test.slow();
        const figures = await openForPrint(page, url, PAPERS[format].portrait);
        const wide = await figures.evaluateAll(landscapeFigureMarks);
        expect(wide.length, 'the page has figures too wide for a portrait page').toBeGreaterThan(0);
        const pdfPath = testInfo.outputPath(`${url.replace(/\W+/g, '-')}-${format}.pdf`);
        await page.pdf({ path: pdfPath, format, printBackground: true });
        const pages = printedPages(pdfPath);
        for (const mark of wide) {
          const at = pages.findIndex((printedPage) => printedPage.text.includes(mark));
          expect(at, `the figure marked by ${mark} is printed`).toBeGreaterThan(-1);
          expect(pages[at].landscape, `the page of ${mark}`).toBe(true);
        }
        expect(pages[0].landscape, 'the page opens on a portrait page').toBe(false);
        expect(pages.filter((printedPage) => printedPage.landscape && !printedPage.text), 'empty landscape pages').toEqual([]);
      });
    }
  });
}

test.describe(`the lazily loaded C4 figure on ${LAZY_URL}`, () => {
  async function openLazyFigure(page) {
    await openWithFigures(page, LAZY_FIGURES);
    return page.getByRole('img', { name: CONTAINER_VIEW_BRIEF, exact: true });
  }

  test('the figure is labelled with the counts of its container view', async ({ page }) => {
    const figure = await openLazyFigure(page);
    // The figure is found by its role and accessible name, so being there is the check.
    await expect(figure, 'an image named by the counts of the container view').toBeVisible();
  });

  test('the verbose description lists elements and relationship sentences', async ({ page }) => {
    const figure = await openLazyFigure(page);
    const verbose = page.locator('figure').filter({ has: figure }).locator('.sebook-figure__verbose');
    await expect(verbose).toHaveCount(1);
    for (const element of [
      'Planner Web App (Container: TypeScript, React)',
      'Registration API (Container: Python, FastAPI)',
      'Registration Database (Container: PostgreSQL 16)',
      'Student (Person)',
    ]) {
      await expect(verbose).toContainText(element);
    }
    for (const sentence of [
      'Student plans a schedule and enrolls using Planner Web App.',
      'Planner Web App submits plans to Registration API using JSON/HTTPS (derived from Planner Web App → Registration Coordinator).',
      'Registration API writes seat holds to Registration Database using SQL/TCP (derived from Seat Gateway → Registration Database).',
    ]) {
      await expect(verbose).toContainText(sentence);
    }
  });

  test('an overflowing C4 figure is keyboard scrollable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const figure = await openLazyFigure(page);
    await expect(figure).toHaveAttribute('tabindex', '0');
    await figure.focus();
    await expect(figure).toBeFocused();
    await figure.press('ArrowRight');
    await expect.poll(() => figure.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await figure.press('Tab');
    await expect(figure).not.toBeFocused();
  });
});

// ---- Interface description cards (spec §6.6, J11) ------------------------------------------------------------
// test-uml.html draws the Enrollment API card twice, live (Ruling 19): whole, and with `panels="syntax"`. The chapter
// shows three cards prerendered by the static build, under the SEBook theme's table and caption rules. A card is
// semantic HTML that reflows like the page's text; only its data tables may scroll (WCAG 1.4.10 exception).

const CARD_PAGES = [
  { url: LAZY_URL, cards: 2, prerendered: false },
  { url: CHAPTER_URL, cards: 3, prerendered: true },
];
const [LIVE_CARDS] = CARD_PAGES;

/** The interface cards (articles) of the page. */
function interfaceCards(page) {
  return page.locator('[data-c4-notation="interface-card"]').getByRole('article');
}

/** Opens the page of `cardPage` and waits until all its interface cards are drawn; returns the cards. */
async function openCards(page, { url, cards: count }) {
  await page.goto(url);
  const cards = interfaceCards(page);
  await expect(cards).toHaveCount(count);
  return cards;
}

/** For each card: whether its content is wider than the card, and each table region's overflow and name. */
function cardOverflow(cards) {
  return cards.map((card) => ({
    cardOverflows: card.scrollWidth > card.clientWidth + 1,
    regions: [...card.querySelectorAll('[role="region"]')].map((region) => ({
      overflowing: region.scrollWidth > region.clientWidth + 1,
      tabStop: region.tabIndex === 0,
      named: Boolean(region.getAttribute('aria-labelledby') && document.getElementById(region.getAttribute('aria-labelledby')).textContent.trim()),
    })),
  }));
}

/** Text elements of each card whose size differs from the paragraph size, and labels below their minimum. */
function cardTextSizes(cards) {
  const paragraphSize = parseFloat(getComputedStyle(document.querySelector('main p') || document.body).fontSize);
  const sizeOf = (element) => parseFloat(getComputedStyle(element).fontSize);
  return cards.map((card) => {
    const texts = [...card.querySelectorAll('*')].filter((element) => [...element.childNodes]
      .some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()));
    const labels = [...card.querySelectorAll('[role="group"]')].map((group) => document.getElementById(group.getAttribute('aria-labelledby')));
    const name = document.getElementById(card.getAttribute('aria-labelledby'));
    return {
      paragraphSize,
      belowParagraph: texts.filter((element) => sizeOf(element) < paragraphSize - 0.1).map((element) => element.textContent.trim()),
      labelsBelow: labels.filter((label) => sizeOf(label) < 1.2 * paragraphSize - 0.1).map((label) => label.textContent),
      labelCount: labels.length,
      nameRatio: sizeOf(name) / paragraphSize,
    };
  });
}

/**
 * Contrast failures of each card's text (on the background painted behind it) and of its rules (the borders of the
 * card, its groups, and its table cells, on the card's surface), and the CSS filters from the card up to the root (spec §6.6 item 6: no invert filter).
 */
function cardContrast(cards) {
  const { parse, luminance, contrastRatio, backgroundOf, textContrast, filtersUpToRoot } = window.c4ColourMaths;
  return cards.map((card) => {
    const surface = backgroundOf(card);
    const texts = [...card.querySelectorAll('*')].filter((element) => [...element.childNodes]
      .some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()));
    const textFailures = texts.map((element) => ({
      text: element.textContent.trim().slice(0, 40),
      ratio: textContrast(element),
    })).filter(({ ratio: value }) => value < 4.5); // WCAG 1.4.3
    // The card's rules: its outline, the panel and block rules, and the table grid (not the site's code chips).
    const rules = [card, ...card.querySelectorAll('[role="group"], th, td')];
    const ruled = rules.flatMap((element) => {
      const style = getComputedStyle(element);
      return ['Top', 'Right', 'Bottom', 'Left']
        .filter((side) => parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none')
        .map((side) => ({ element: element.tagName, ratio: contrastRatio(parse(style[`border${side}Color`]).rgb, surface) }));
    });
    return {
      surfaceLuminance: luminance(surface),
      textFailures,
      ruleCount: ruled.length,
      ruleFailures: ruled.filter(({ ratio: value }) => value < 3), // WCAG 1.4.11
      filters: filtersUpToRoot(card),
    };
  });
}

/**
 * Turns on the dark theme. test-uml.html re-renders its hundred-odd figures on every theme change, in several
 * seconds (as `switchToDarkMode` allows for), so a live page is ready once its cards, its last figures, are redrawn.
 */
async function switchCardsToDarkMode(page, cards, { prerendered }) {
  await page.evaluate(() => {
    window.lightCards = [...document.querySelectorAll('article.c4-interface')];
    document.documentElement.classList.add('dark-mode');
  });
  if (prerendered) return;
  await expect.poll(() => cards.evaluateAll((articles) => articles.every((article) => !window.lightCards.includes(article))),
    { message: 'the cards are redrawn', timeout: 45_000 }).toBe(true);
}

for (const cardPage of CARD_PAGES) {
  test.describe(`the interface cards on ${cardPage.url}`, () => {
    test('the card reflows at 320 CSS px', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      const cards = await openCards(page, cardPage);
      const overflow = await cards.evaluateAll(cardOverflow);
      expect(overflow.map(({ cardOverflows }) => cardOverflows)).toEqual(Array(cardPage.cards).fill(false));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page reflows').toBe(true);
      const regions = overflow.flatMap((card) => card.regions);
      expect(regions.filter(({ tabStop, named }) => !tabStop || !named), 'every table region is a named tab stop').toEqual([]);
      expect(regions.some(({ overflowing }) => overflowing), 'some data table is wider than 320 px').toBe(true);

      const region = cards.first().getByRole('region').first();
      await region.evaluate((element) => element.scrollIntoView());
      await region.focus();
      await expect(region).toBeFocused();
      await region.press('ArrowRight');
      await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    });

    test("its text has the surrounding paragraph's size and group labels are at least 1.2em", async ({ page }) => {
      const cards = await openCards(page, cardPage);
      for (const sizes of await cards.evaluateAll(cardTextSizes)) {
        expect(sizes.belowParagraph, `text below ${sizes.paragraphSize}px`).toEqual([]);
        expect(sizes.labelCount).toBeGreaterThan(0);
        expect(sizes.labelsBelow).toEqual([]);
        expect(sizes.nameRatio).toBeGreaterThanOrEqual(1.3 - 0.01);
      }
    });

    test('light and dark mode reach 4.5:1 for text and 3:1 for rules with site tokens and no invert filter on the card', async ({ page }) => {
      const cards = await openCards(page, cardPage);
      const check = async (theme) => {
        for (const result of await cards.evaluateAll(cardContrast)) {
          expect(result.textFailures, `${theme} text`).toEqual([]);
          expect(result.ruleCount, `${theme} rules drawn`).toBeGreaterThan(0);
          expect(result.ruleFailures, `${theme} rules`).toEqual([]);
          expect(result.filters, `${theme} filters over the card`).toEqual([]);
        }
        return (await cards.evaluateAll(cardContrast)).map(({ surfaceLuminance }) => surfaceLuminance);
      };
      const light = await check('light');
      await switchCardsToDarkMode(page, cards, cardPage);
      const dark = await check('dark');
      expect(light.every((value) => value > 0.9)).toBe(true);
      expect(dark.every((value) => value < 0.1)).toBe(true);
    });
  });
}

/**
 * Runs a Poppler tool (`pdftotext`, `pdfinfo`), which the test machine must provide outside npm. Without it the test
 * fails with a message that names the tool and how to install it instead of a bare ENOENT.
 */
function execFileSyncNamingPoppler(tool, args) {
  try {
    return execFileSync(tool, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new Error(`The print tests read the printed PDF with ${tool} from Poppler, which is not on the PATH. `
      + 'Install it (macOS: brew install poppler; Debian or Ubuntu: apt-get install poppler-utils) and run the test again.');
  }
}

/** The PDF's text in content order (`pdftotext -raw`). */
function printedPdfText(pdfPath) {
  return execFileSyncNamingPoppler('pdftotext', ['-raw', '-enc', 'UTF-8', pdfPath, '-']);
}

test.describe(`the live interface cards on ${LAZY_URL}`, () => {
  test('print shows every card line once in the light palette', async ({ page }, testInfo) => {
    test.slow();
    const cards = await openCards(page, LIVE_CARDS);
    await switchCardsToDarkMode(page, cards, LIVE_CARDS);
    await page.emulateMedia({ media: 'print' });
    await expect.poll(() => cards.evaluateAll(cardContrast).then((results) => results.map(({ surfaceLuminance }) => surfaceLuminance > 0.9)))
      .toEqual(Array(LIVE_CARDS.cards).fill(true));
    for (const result of await cards.evaluateAll(cardContrast)) {
      expect(result.textFailures).toEqual([]);
      expect(result.ruleFailures).toEqual([]);
    }
    // The PDF's text in content order (pdftotext -raw) holds each card's text once, in order; wrapping is ignored.
    const cardTexts = await cards.evaluateAll((articles) => articles.map((article) => article.innerText));
    const pdfPath = testInfo.outputPath('cards.pdf');
    await page.pdf({ path: pdfPath, printBackground: true });
    const pdfText = printedPdfText(pdfPath);
    const squeezed = (text) => text.replace(/\s+/g, '');
    for (const cardText of cardTexts) {
      expect(squeezed(cardText).length).toBeGreaterThan(0);
      expect(squeezed(pdfText).split(squeezed(cardText)).length - 1, `printed once:\n${cardText.slice(0, 200)}`).toBe(1);
    }
  });

  test('the uml-auto-describe script adds no label or verbose block to a card', async ({ page }) => {
    await openCards(page, LIVE_CARDS);
    // The describer is active on this page: each C4 drawing has its detailed description.
    const drawings = page.locator('figure').filter({ has: c4Figures(page) });
    await expect(drawings.locator('[data-uml-verbose="true"]')).toHaveCount(LAZY_FIGURES.figures);
    const cardFigures = page.locator('figure').filter({ has: interfaceCards(page) });
    await expect(cardFigures).toHaveCount(LIVE_CARDS.cards);
    await expect(cardFigures.locator('[data-uml-verbose="true"]')).toHaveCount(0);
    await expect(cardFigures.getByRole('img')).toHaveCount(0);
    for (const container of await cardFigures.locator('[data-c4-notation="interface-card"]').all()) {
      await expect(container).not.toHaveAttribute('aria-label');
      await expect(container).not.toHaveAttribute('role');
    }
  });
});

// ---- Interfaces views (spec §5.3, §6.6) -------------------------------------------------------------------------
// test-uml.html draws the interfaces views of the Registration API and of the Registration Coordinator live (Ruling
// 19). The component diagram is delegated to the bundle inside the C4 figure; the title above it and the legend line
// and notes below it are text in the figure, at paragraph size in the page's own colours.

const API_INTERFACES_BRIEF = 'Interface view of Registration API: provides 1 interface, requires 1 interface, 2 connected elements.';
const COORDINATOR_INTERFACES_BRIEF =
  'Interface view of Registration Coordinator: provides 1 interface, requires 0 interfaces, 1 connected element.';
const INTERFACES_LEGEND = 'Ball: an interface the element provides. Socket: an interface it requires. Ball in socket: '
  + 'the consumer uses that interface. The subject of this view is Registration API.';
const DELEGATION_NOTE = 'Enrollment API belongs to Registration API; Registration Coordinator handles its calls.';

/** Opens test-uml.html with every C4 drawing drawn and returns the interfaces view of the Registration API. */
async function openApiInterfacesView(page) {
  await openWithFigures(page, LAZY_FIGURES);
  return page.getByRole('img', { name: API_INTERFACES_BRIEF, exact: true });
}

/**
 * For each figure, every text paragraph around its drawing: its text, its size against the page's paragraph size,
 * the contrast of its colour on the background painted behind it, and the CSS filters from it up to the root.
 */
function textsAroundDrawings(containers) {
  const { luminance, backgroundOf, textContrast, filtersUpToRoot } = window.c4ColourMaths;
  const paragraphSize = parseFloat(getComputedStyle(document.querySelector('main p') || document.body).fontSize);
  return containers.flatMap((container) => [...container.querySelectorAll('p')].filter((element) => !element.closest('svg'))
    .map((element) => ({
      text: element.textContent,
      sizeRatio: parseFloat(getComputedStyle(element).fontSize) / paragraphSize,
      contrast: textContrast(element),
      backgroundLuminance: luminance(backgroundOf(element)),
      filters: filtersUpToRoot(element),
    })));
}

test.describe(`the interfaces views on ${LAZY_URL}`, () => {
  test('C4 interface views are described', async ({ page }) => {
    const api = await openApiInterfacesView(page);
    await expect(api, 'the figure is named by the brief of interfaces of api').toHaveAccessibleName(API_INTERFACES_BRIEF);
    const apiVerbose = page.locator('figure').filter({ has: api }).locator('.sebook-figure__verbose');
    await expect(apiVerbose).toContainText(INTERFACES_LEGEND);
    await expect(apiVerbose).toContainText('Registration API requires Tuition Charges from Billing System');

    const coordinator = page.getByRole('img', { name: COORDINATOR_INTERFACES_BRIEF, exact: true });
    const coordinatorVerbose = page.locator('figure').filter({ has: coordinator }).locator('.sebook-figure__verbose');
    await expect(coordinatorVerbose).toContainText(DELEGATION_NOTE);
  });

  for (const width of [320, 1440]) {
    test(`the interfaces view reaches paragraph-size text at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const api = await openApiInterfacesView(page);
      await page.evaluate(() => document.fonts.ready);
      expect(await api.evaluateAll(labelsBelowParagraphSize), 'drawing labels').toEqual([]);
      const texts = await api.evaluateAll(textsAroundDrawings);
      expect(texts.map(({ text }) => text)).toEqual(['Interface view: Registration API', INTERFACES_LEGEND]);
      expect(texts.filter(({ sizeRatio }) => sizeRatio < 0.99), 'text below paragraph size').toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page reflows').toBe(true);
    });
  }

  test('the interfaces view scrolls by keyboard when it overflows at 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const api = await openApiInterfacesView(page);
    await expect.poll(() => api.evaluate((element) => element.scrollWidth > element.clientWidth + 1), 'the drawing overflows').toBe(true);
    await expect(api).toHaveAttribute('tabindex', '0');
    await api.focus();
    await api.press('ArrowRight');
    await expect.poll(() => api.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  });

  test('dark mode inverts the delegated component SVG once and leaves its text in the page colours', async ({ page }) => {
    const api = await openApiInterfacesView(page);
    await switchToDarkMode(page, api, LAZY_FIGURES);
    const filters = await api.evaluateAll(filtersOverText);
    expect(filters.length, 'the drawing has text').toBeGreaterThan(0);
    expect(filters.filter((chain) => chain.length !== 1 || chain[0] !== DARK_FILTER)).toEqual([]);
    const texts = await api.evaluateAll(textsAroundDrawings);
    expect(texts.length).toBe(2);
    for (const text of texts) {
      expect(text.filters, `${text.text}: no filter`).toEqual([]);
      expect(text.backgroundLuminance, `${text.text}: on the dark page`).toBeLessThan(0.1);
      expect(text.contrast, `${text.text}: contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('print uses the light palette for the interfaces view', async ({ page }) => {
    test.slow();
    const api = await openApiInterfacesView(page);
    const lightFills = await api.evaluateAll(bakedFills);
    await switchToDarkMode(page, api, LAZY_FIGURES);
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await expect.poll(() => api.evaluateAll(filtersOverText).then((chains) => chains.flat()), 'no filter on paper').toEqual([]);
    await expect.poll(() => api.evaluateAll(bakedFills), 'the light fills').toEqual(lightFills);
    await expect.poll(() => api.evaluateAll(textsAroundDrawings)
      .then((texts) => texts.filter(({ backgroundLuminance, contrast, filters }) => backgroundLuminance < 0.9 || contrast < 4.5 || filters.length)
        .map(({ text }) => text)), 'text dark on light paper').toEqual([]);
  });

  test('static prerender and live render agree for the interfaces view', async ({ page }) => {
    const api = await openApiInterfacesView(page);
    const source = await api.evaluate((container) => JSON.parse(container.querySelector('script[data-c4-source]').textContent));
    const prerendered = await page.evaluate(figureBodyParts, staticSvg(source));
    const live = await api.evaluate((container) => container.querySelector('.c4-figure-body').outerHTML).then((html) => page.evaluate(figureBodyParts, html));
    expect(prerendered.texts, 'text content').toEqual(live.texts);
    const liveLayout = await page.evaluate(layoutGeometry, live.svg);
    expect(liveLayout.nodes.length, 'the drawing has layout hooks').toBeGreaterThan(0);
    expect(await page.evaluate(layoutGeometry, prerendered.svg), 'node coordinates and routes').toEqual(liveLayout);
  });
});
