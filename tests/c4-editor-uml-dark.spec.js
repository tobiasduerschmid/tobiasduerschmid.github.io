// @ts-check
// The marks drawn over an edited UML view in dark mode, on the built standalone C4 editor page (UML-view editing spec
// §7.8, Global Constraints of plan Task 41): the selected class's outline, the focus ring, and both target marks of C
// mode reach 3:1 against the canvas as the reader sees them, and the focus ring is at least 2 px wide.
//
// The marks are drawn inside the SVG, which the site's dark theme shows through a CSS filter (css/uml-diagram.css:
// invert(1) hue-rotate(180deg)). So a mark's computed colour is not the colour on screen: the helper reads the computed
// `filter` of the drawing and applies each of its invert() and hue-rotate() functions as the Filter Effects 1 matrices,
// in order, to the computed colour (sRGB, as the browser applies the shorthand functions). The canvas behind a mark is
// the canvas region's background (HTML, outside the filter) unless the drawing paints one of its own, which the filter
// reaches too.
//
// The page loads with the site's saved dark theme (the `dark-mode` cookie), so the drawing is made once, in dark mode.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const EDITOR_PATH = '/SEBook/tools/c4-editor';
const DRAFT_KEY = 'c4-editor-draft';
const CODE_VIEW = 'code of policy';
const COURSE_REGISTRATION = fs.readFileSync(path.join(__dirname, '../_includes/c4-models/course-registration.yml'), 'utf8');
const NON_TEXT_CONTRAST = 3;
const FOCUS_RING_PX = 2;

/**
 * Runs in the page: `window.c4SeenColours`, the colour maths of this spec. `seenStroke(element)` is the element's
 * computed stroke as seen through the filters above it; `canvasBehind(element)` the canvas colour behind it, seen the
 * same way; `contrast(a, b)` the WCAG contrast ratio of two [r, g, b].
 */
function installSeenColours() {
  const parse = (colour) => {
    const [r, g, b, a = 1] = colour.match(/[\d.]+/g).map(Number);
    return { rgb: [r, g, b], a };
  };
  const clamp = (value) => Math.min(255, Math.max(0, value));
  // Filter Effects 1: invert(amount) and hue-rotate(angle) as their matrices, on 0–255 channels.
  const invert = (amount) => (rgb) => rgb.map((channel) => clamp(channel * (1 - amount) + (255 - channel) * amount));
  const hueRotate = (degrees) => {
    const angle = (degrees * Math.PI) / 180;
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    const matrix = [
      [0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928],
      [0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283],
      [0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072],
    ];
    return (rgb) => matrix.map((row) => clamp(row.reduce((sum, weight, index) => sum + weight * rgb[index], 0)));
  };
  /** The functions of a computed `filter` value, as colour maps; a function other than these two fails loudly. */
  const filterSteps = (value) => [...value.matchAll(/([a-z-]+)\(([^)]*)\)/g)].map(([, name, argument]) => {
    if (name === 'invert') return invert(argument.endsWith('%') ? parseFloat(argument) / 100 : Number(argument));
    if (name === 'hue-rotate') return hueRotate(parseFloat(argument) * (argument.endsWith('rad') ? 180 / Math.PI : 1));
    throw new Error(`the drawing's filter has ${name}(), which this check does not model`);
  });
  /** The filters from `element` up to the root, nearest first (the order the browser applies them in). */
  const filtersAbove = (element) => {
    const steps = [];
    for (let current = element; current; current = current.parentElement) {
      const filter = getComputedStyle(current).filter;
      if (filter && filter !== 'none') steps.push(...filterSteps(filter));
    }
    return steps;
  };
  const seen = (rgb, element) => filtersAbove(element).reduce((colour, step) => step(colour), rgb);
  const luminance = (rgb) => {
    const [r, g, b] = rgb.map((channel) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  };
  const seenStroke = (element) => seen(parse(getComputedStyle(element).stroke).rgb, element);
  /** The first opaque background from the drawing up: the drawing's own (filtered) or the canvas region's. */
  const canvasBehind = (element) => {
    for (let current = element.ownerSVGElement || element; current; current = current.parentElement) {
      const background = parse(getComputedStyle(current).backgroundColor);
      if (background.a === 1) return seen(background.rgb, current);
    }
    return [255, 255, 255];
  };
  window.c4SeenColours = { seenStroke, canvasBehind, contrast };
}

/** For the elements `selector` finds in the canvas: the contrast of each one's seen stroke against the canvas. */
function strokeContrasts(page, selector) {
  return page.getByRole('region', { name: /^Canvas/ }).evaluate((region, found) => [...region.querySelectorAll(found)].map((element) => {
    const { seenStroke, canvasBehind, contrast } = window.c4SeenColours;
    return Math.round(contrast(seenStroke(element), canvasBehind(element)) * 100) / 100;
  }), selector);
}

test.describe('marks over an edited code view in dark mode', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await context.route('**/vendor/monaco-editor/**', (route) => route.abort());
    await context.addCookies([{ name: 'dark-mode', value: 'true', url: baseURL }]);
    await page.addInitScript(installSeenColours);
    await page.addInitScript(([key, value]) => {
      if (sessionStorage.getItem('c4-test-seeded')) return;
      sessionStorage.setItem('c4-test-seeded', '1');
      localStorage.setItem(key, value);
    }, [DRAFT_KEY, JSON.stringify({ version: 1, text: COURSE_REGISTRATION, savedAt: '2026-11-20T09:00:00.000Z', view: CODE_VIEW })]);
  });

  test('the selected class\'s outline, the focus ring, and both target marks during C reach 3:1 against the canvas after the canvas\'s computed filter, and the focus ring is at least 2 px', async ({ page }) => {
    await page.goto(EDITOR_PATH);
    await expect(page.locator('html')).toHaveClass(/dark-mode/);
    const elements = page.getByRole('listbox', { name: 'Elements in this view' });
    const policy = elements.getByRole('option', { name: 'EnrollmentPolicy', exact: true });
    const drawingFilter = await page.getByRole('region', { name: /^Canvas/ }).evaluate((region) => getComputedStyle(region.querySelector('.c4-editor__diagram svg')).filter);
    expect(drawingFilter, 'the dark theme shows the drawing through a filter').not.toBe('none');

    // The focus ring: the focused option, which the keyboard reached.
    await policy.focus();
    await expect(policy).toBeFocused();
    const ring = await policy.evaluate((option) => {
      const style = getComputedStyle(option);
      return { width: parseFloat(style.strokeWidth), effect: style.vectorEffect, dashed: style.strokeDasharray !== 'none' };
    });
    expect(ring.width, 'the focus ring is at least 2 px').toBeGreaterThanOrEqual(FOCUS_RING_PX);
    expect(ring.effect, 'and stays so at every magnification').toBe('non-scaling-stroke');
    expect(ring.dashed, 'focus is dashed, not only coloured').toBe(true);
    const focusContrast = await policy.evaluate((option) => {
      const { seenStroke, canvasBehind, contrast } = window.c4SeenColours;
      return contrast(seenStroke(option), canvasBehind(option));
    });
    expect(focusContrast, 'the focus ring against the canvas').toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);

    // The selected class's outline: the selection stays when focus leaves the canvas.
    await page.getByRole('button', { name: 'Undo', exact: true }).focus();
    await expect(policy).not.toBeFocused();
    const selected = await strokeContrasts(page, '.c4-editor__option.is-selected');
    expect(selected, 'one selected class').toHaveLength(1);
    expect(selected[0], 'the selected class\'s outline against the canvas').toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);

    // Both target marks during C: the possible targets' dashed outline and the others' outline and struck circle.
    await policy.focus();
    await page.keyboard.press('c');
    await expect(page.locator('.uml-pg-target-mark.is-possible').first()).toBeVisible();
    const possible = await strokeContrasts(page, '.uml-pg-target-mark.is-possible .uml-pg-target-mark-outline');
    const others = await strokeContrasts(page, '.uml-pg-target-mark:not(.is-possible) .uml-pg-target-mark-outline, .uml-pg-target-mark-sign');
    expect(possible.length, 'possible targets are marked').toBeGreaterThan(0);
    expect(others.length, 'a target that is not possible is marked').toBeGreaterThan(0);
    for (const value of possible) expect(value, 'a possible target\'s mark against the canvas').toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
    for (const value of others) expect(value, 'the other targets\' mark against the canvas').toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
  });
});
