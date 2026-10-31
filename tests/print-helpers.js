// Shared helpers for the print specs: WCAG contrast arithmetic and the palette
// an element is actually painted with.

const channel = (value) => {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of an [r, g, b] colour. */
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG contrast ratio between two [r, g, b] colours. */
const contrast = (first, second) => {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Text colour of an element and the opaque background actually behind it, as [r, g, b],
 * and whether that background is forced to print (`print-color-adjust: exact`).
 */
async function paletteOf(locator) {
  return locator.evaluate((element) => {
    const channels = (value) => (value.match(/[\d.]+/g) || []).map(Number);
    let background = [255, 255, 255];
    for (let node = element; node; node = node.parentElement) {
      const [r, g, b, alpha = 1] = channels(getComputedStyle(node).backgroundColor);
      if (alpha > 0.5) {
        background = [r, g, b];
        break;
      }
    }
    const { color, printColorAdjust } = getComputedStyle(element);
    return { text: channels(color).slice(0, 3), background, fillPrints: printColorAdjust === 'exact' };
  });
}

/** Contrast of an element's text against the background behind it. */
async function textContrast(locator) {
  const { text, background } = await paletteOf(locator);
  return contrast(text, background);
}

/**
 * Contrast of an element's text on the paper it prints on. Browsers drop background
 * colours unless `print-color-adjust: exact` applies, so a fill counts only when it is
 * forced to print; otherwise the text lands on bare white paper.
 */
async function contrastOnPaper(locator) {
  const { text, background, fillPrints } = await paletteOf(locator);
  return contrast(text, fillPrints ? background : [255, 255, 255]);
}

module.exports = { luminance, contrast, paletteOf, textContrast, contrastOnPaper };
