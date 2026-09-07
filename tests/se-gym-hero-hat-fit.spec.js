// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const portraitTemplate = fs.readFileSync(path.join(projectRoot, '_includes/se-gym-hero.svg'), 'utf8')
  .replace(/^\{% assign[^\n]+\n/, '')
  .replace(/\{% if include.ready %\}.*?\{% endif %\}/g, '')
  .replace(/\{\{\s*hero_variant\s*\}\}/g, 'hat-fit-fixture');

test.use({ reducedMotion: 'reduce' });

async function openPortrait(page) {
  // Renderer integration uses real source without requiring a site rebuild.
  // The customizer suite separately exercises the public controls.
  await page.setContent(`<html lang="en"><head><title>Hat fit fixture</title></head><body>${portraitTemplate}</body></html>`);
  await page.addScriptTag({ path: path.join(projectRoot, 'js/se-gym-hero-avatar.js') });
  await page.evaluate(() => {
    const svg = document.querySelector('[data-gym-hero-svg]');
    svg.querySelectorAll('animate, animateTransform, animateMotion, set').forEach(node => node.remove());
    svg.setAttribute('data-testid', 'hat-fit-fixture');
    svg.style.cssText = 'display:block;width:800px;height:820px;opacity:1;visibility:visible';
    svg.pauseAnimations();
  });
  return page.getByTestId('hat-fit-fixture');
}

// The avatar skill documents these material/option hooks. The oracle compares
// rendered paint, not fitting matrices or authored path strings: applying the
// hat's cut region in the common portrait frame must produce the same hair as
// the renderer, while preserving the available hair below the rim.
async function inspectHatPaint(svg, { hat, hairStyle, headStyle, hairTuning }) {
  const tuning = value => ({ vertical: value, width: value, height: value, spread: value });
  const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
  Object.assign(avatar.appearance, { hairStyle, headStyle });
  avatar.outfit.accessories = [hat];
  avatar.outfit.accessory = hat;
  avatar.fineTune.hair = tuning(hairTuning);
  avatar.fineTune.accessories = tuning(-hairTuning);
  window.HeroAvatar.applyToSvg(svg, avatar);

  const namespace = 'http://www.w3.org/2000/svg';
  const size = 520;
  const properties = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity',
    'stroke-linecap', 'stroke-linejoin', 'opacity', 'clip-path', 'mask', 'display', 'visibility',
    'transform', 'transform-origin', 'transform-box'];
  const hairLayers = [...svg.querySelectorAll('[data-hero-slot="hair"][display="inline"], [data-hero-slot="hairline"][display="inline"], [data-hero-slot="hair-root"][display="inline"]')];
  const hatLayer = svg.querySelector(`[data-hero-slot="accessory"][data-hero-option="${hat}"]`);
  const envelope = svg.querySelector(`[data-hero-hat-envelope="${hat}"]`);

  function imageRoot() {
    const image = document.createElementNS(namespace, 'svg');
    image.setAttribute('xmlns', namespace);
    image.setAttribute('viewBox', '270 40 260 260');
    image.setAttribute('width', String(size));
    image.setAttribute('height', String(size));
    image.setAttribute('style', svg.getAttribute('style') || '');
    image.style.width = `${size}px`;
    image.style.height = `${size}px`;
    svg.querySelectorAll(':scope > defs').forEach(defs => image.appendChild(defs.cloneNode(true)));
    return image;
  }

  function matrixTransform(matrix) {
    return `matrix(${[matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].join(',')})`;
  }

  function hairImage(retainHatCut) {
    const image = imageRoot();
    for (const layer of hairLayers) {
      const wrapper = document.createElementNS(namespace, 'g');
      wrapper.setAttribute('transform', matrixTransform(svg.getScreenCTM().inverse().multiply(layer.parentElement.getScreenCTM())));
      const copy = layer.cloneNode(true);
      const originals = [layer, ...layer.querySelectorAll('*')];
      const copies = [copy, ...copy.querySelectorAll('*')];
      originals.forEach((node, index) => {
        const computed = getComputedStyle(node);
        properties.forEach(property => copies[index].style.setProperty(property, computed.getPropertyValue(property)));
      });
      if (!retainHatCut) {
        // Remove only the hat's cut. Forehead/shoulder safety remains in the
        // hair frame, so the expected image preserves the same face clearance.
        const safetyName = layer.getAttribute('data-hero-slot') === 'hairline'
          ? 'hair-foreground-safe-clip-' : 'hair-shoulder-clip-';
        const safety = svg.querySelector(`[id^="${safetyName}"]`);
        copy.style.setProperty('clip-path', `url(#${safety.id})`);
      }
      wrapper.appendChild(copy);
      image.appendChild(wrapper);
    }
    return image;
  }

  function hatCutImage() {
    const image = imageRoot();
    const copy = envelope.cloneNode(true);
    copy.removeAttribute('id');
    copy.setAttribute('transform', matrixTransform(svg.getScreenCTM().inverse().multiply(hatLayer.getScreenCTM())));
    image.appendChild(copy);
    return image;
  }

  async function pixels(imageSvg) {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(imageSvg))}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const rgba = context.getImageData(0, 0, size, size).data;
    return Uint8Array.from({ length: size * size }, (_, index) => rgba[index * 4 + 3]);
  }

  const [actual, uncutHair, hatCut] = await Promise.all([
    pixels(hairImage(true)), pixels(hairImage(false)), pixels(hatCutImage()),
  ]);
  const expected = uncutHair.map((alpha, index) => Math.round(alpha * hatCut[index] / 255));
  let remainingHair = 0;
  let missingHair = 0;
  let protrudingHair = 0;
  function nearby(mask, x, y) {
    // Compare visible paint against the other image's antialiased fringe.
    // One pixel is half a portrait unit: allow raster edge antialiasing,
    // while detecting the several-unit gaps/ledges from detached hat cuts.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (mask[(y + dy) * size + x + dx] >= 8) return true;
      }
    }
    return false;
  }
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const index = y * size + x;
      if (expected[index] >= 64) {
        remainingHair++;
        if (!nearby(actual, x, y)) missingHair++;
      }
      if (actual[index] >= 64 && !nearby(expected, x, y)) protrudingHair++;
    }
  }
  return { remainingHair, missingHair, protrudingHair };
}

for (const hat of ['beanie', 'baseball-cap', 'bucket-hat', 'embroidered-prayer-cap']) {
  test(`${hat} keeps hair joined to its rim under opposing fit adjustments`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const svg = await openPortrait(page);
    for (const hairStyle of ['short', 'long', 'coils']) {
      for (const headStyle of ['narrow', 'default', 'broad']) {
        for (const hairTuning of [-20, 20]) {
          const result = await svg.evaluate(inspectHatPaint, { hat, hairStyle, headStyle, hairTuning });
          const context = `${hat}, ${hairStyle}, ${headStyle}, hair ${hairTuning}, hat ${-hairTuning}`;
          expect(result.remainingHair, `${context}: side hair must remain available below the rim`).toBeGreaterThan(0);
          expect(result.missingHair, `${context}: the hat cut must not leave a gap in available hair`).toBe(0);
          expect(result.protrudingHair, `${context}: hair must not protrude beyond the fitted rim cut`).toBe(0);
        }
      }
    }
    expect(errors, 'SVG paint fixtures must render without script or markup errors').toEqual([]);
  });
}
