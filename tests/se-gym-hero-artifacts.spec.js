// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const portraitTemplate = fs.readFileSync(path.join(projectRoot, '_includes/se-gym-hero.svg'), 'utf8')
  .replace(/^\{% assign[^\n]+\n/, '')
  .replace(/\{% if include.ready %\}.*?\{% endif %\}/g, '')
  .replace(/\{\{\s*hero_variant\s*\}\}/g, 'artifact-renderer-fixture');

test.use({ reducedMotion: 'reduce' });

const HEAD_BOUNDARIES = ['narrow', 'broad', 'compact-round', 'long-tapered-jaw', 'soft-v-jaw'];
const AXIS_BOUNDARIES = [{ label: 'default', value: {} }];
for (const axis of ['vertical', 'width', 'height', 'spread']) {
  for (const value of [-20, 20]) AXIS_BOUNDARIES.push({ label: `${axis} ${value}`, value: { [axis]: value } });
}

async function openPortrait(page) {
  // Renderer integration uses the real template and runtime directly; the
  // customizer end-to-end suite separately covers the built page and controls.
  await page.setContent(`<html lang="en"><head><title>Portrait renderer fixture</title></head><body>${portraitTemplate}</body></html>`);
  await page.addScriptTag({ path: path.join(projectRoot, 'js/se-gym-hero-avatar.js') });
  await page.evaluate(() => {
    const svg = document.querySelector('[data-gym-hero-svg]').cloneNode(true);
    svg.querySelectorAll('animate, animateTransform, animateMotion, set').forEach(node => node.remove());
    svg.setAttribute('data-testid', 'portrait-artifact-fixture');
    svg.style.cssText = 'display:block;width:800px;height:820px;opacity:1;visibility:visible';
    document.body.replaceChildren(svg);
    svg.pauseAnimations();
  });
  return page.getByTestId('portrait-artifact-fixture');
}

// The documented art slots identify materials to inspect, never their authored
// path structure. Rasterize real paint with its complete ancestry, so a future
// wrapper, path rewrite, or fitting algorithm preserves these behavioral checks.
async function inspectPortrait(svg, { appearance, fineTune, surfaceSelector, targetSelectors, checkClipping = false, alphaThreshold = 8, crownCoverage = false }) {
  const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
  Object.assign(avatar.appearance, { hairStyle: 'bald' }, appearance);
  Object.assign(avatar.fineTune, fineTune);
  window.HeroAvatar.applyToSvg(svg, avatar);
  const namespace = 'http://www.w3.org/2000/svg';
  const width = 460;
  const height = 480;
  const properties = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity',
    'stroke-linecap', 'stroke-linejoin', 'opacity', 'clip-path', 'mask', 'display', 'visibility',
    'transform', 'transform-origin', 'transform-box'];

  function copyPresentation(original, copy) {
    const computed = getComputedStyle(original);
    properties.forEach(property => copy.style.setProperty(property, computed.getPropertyValue(property)));
  }

  async function raster(selector, unclipAncestors = false) {
    const layers = [...svg.querySelectorAll(selector)];
    if (!layers.length) throw new Error(`Missing rendered art layer: ${selector}`);
    const imageSvg = document.createElementNS(namespace, 'svg');
    imageSvg.setAttribute('xmlns', namespace);
    imageSvg.setAttribute('viewBox', '285 50 230 240');
    imageSvg.setAttribute('width', String(width));
    imageSvg.setAttribute('height', String(height));
    imageSvg.setAttribute('style', svg.getAttribute('style') || '');
    imageSvg.style.width = `${width}px`;
    imageSvg.style.height = `${height}px`;
    svg.querySelectorAll(':scope > defs').forEach(defs => imageSvg.appendChild(defs.cloneNode(true)));
    for (const layer of layers) {
      let copy = layer.cloneNode(true);
      const originals = [layer, ...layer.querySelectorAll('*')];
      const copies = [copy, ...copy.querySelectorAll('*')];
      originals.forEach((node, index) => copyPresentation(node, copies[index]));
      if (crownCoverage && selector === surfaceSelector) {
        // Hair must cover scalp fill. The head's outer ink contour is not skin
        // and may remain visible beyond the cap at the antialiased boundary.
        copies.forEach(node => node.style.setProperty('stroke', 'none'));
      }
      for (let parent = layer.parentElement; parent && parent !== svg; parent = parent.parentElement) {
        const wrapper = parent.cloneNode(false);
        copyPresentation(parent, wrapper);
        if (unclipAncestors) {
          wrapper.style.setProperty('clip-path', 'none');
          wrapper.style.setProperty('mask', 'none');
        }
        wrapper.appendChild(copy);
        copy = wrapper;
      }
      imageSvg.appendChild(copy);
    }
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(imageSvg))}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const rgba = context.getImageData(0, 0, width, height).data;
    return Uint8Array.from({ length: width * height }, (_, index) => rgba[index * 4 + 3] >= alphaThreshold ? 1 : 0);
  }

  const surface = await raster(surfaceSelector);
  const results = [];
  for (const selector of targetSelectors) {
    const paint = await raster(selector);
    let painted = 0;
    let overlap = 0;
    let exterior = 0;
    for (let index = 0; index < paint.length; index++) {
      if (!paint[index]) continue;
      painted++;
      if (surface[index]) overlap++;
      const x = index % width;
      const y = Math.floor(index / width);
      let touches = false;
      // One physical pixel (half a viewBox unit) allows raster antialiasing.
      for (let dy = -1; dy <= 1 && !touches; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height && surface[index + dy * width + dx]) touches = true;
        }
      }
      if (!touches) exterior++;
    }

    // A lash consists of separate tapered strokes. Each substantial component
    // must be rooted at an eye, allowing two SVG units for soft lid contouring.
    const seen = new Uint8Array(paint.length);
    let detachedComponents = 0;
    let components = 0;
    for (let start = 0; start < paint.length; start++) {
      if (!paint[start] || seen[start]) continue;
      const queue = [start];
      seen[start] = 1;
      let attached = false;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const index = queue[cursor];
        const x = index % width;
        const y = Math.floor(index / width);
        for (let dy = -4; dy <= 4 && !attached; dy++) {
          for (let dx = -4; dx <= 4; dx++) {
            if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height && surface[index + dy * width + dx]) attached = true;
          }
        }
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const next = index + dy * width + dx;
            if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height || seen[next] || !paint[next]) continue;
            seen[next] = 1;
            queue.push(next);
          }
        }
      }
      if (queue.length >= 3) {
        components++;
        if (!attached) detachedComponents++;
      }
    }
    let clippedAwayPixels = 0;
    if (checkClipping) {
      const complete = await raster(selector, true);
      for (let index = 0; index < complete.length; index++) {
        if (!complete[index] || paint[index]) continue;
        const x = index % width;
        const y = Math.floor(index / width);
        let touches = false;
        for (let dy = -1; dy <= 1 && !touches; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height && paint[index + dy * width + dx]) touches = true;
          }
        }
        if (!touches) clippedAwayPixels++;
      }
    }
    let uncoveredCrownPixels = 0;
    let crownPixels = 0;
    if (crownCoverage) {
      const first = surface.findIndex(Boolean);
      const last = surface.findLastIndex(Boolean);
      const top = Math.floor(first / width);
      const bottom = Math.floor(last / width);
      const crownBottom = top + (bottom - top) / 5;
      for (let y = top; y < crownBottom; y++) {
        for (let x = 1; x < width - 1; x++) {
          const index = y * width + x;
          if (!surface[index]) continue;
          crownPixels++;
          let covered = false;
          for (let dy = -1; dy <= 1 && !covered; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (y + dy >= 0 && y + dy < height && paint[index + dy * width + dx]) covered = true;
            }
          }
          if (!covered) uncoveredCrownPixels++;
        }
      }
    }
    results.push({ painted, overlap, exterior, components, detachedComponents, clippedAwayPixels, crownPixels, uncoveredCrownPixels });
  }
  return results;
}

function headSelector(headStyle) {
  return `[data-hero-slot="head-shape"][data-hero-option="${headStyle}"]`;
}

function expectAttached(result, context) {
  expect(result.painted, `${context}: the selected material must render`).toBeGreaterThan(0);
  expect(result.overlap, `${context}: physical surfaces must overlap, without a background gap`).toBeGreaterThan(0);
}

test('Every head remains joined to the neck at each head control boundary', async ({ page }) => {
  test.setTimeout(180_000);
  const svg = await openPortrait(page);
  const heads = await page.evaluate(() => window.HeroAvatar.ENUMS.headStyle);
  for (const headStyle of heads) {
    for (const tuning of AXIS_BOUNDARIES) {
      const [neck] = await svg.evaluate(inspectPortrait, {
        appearance: { headStyle }, fineTune: { head: tuning.value },
        surfaceSelector: headSelector(headStyle), targetSelectors: ['[data-hero-neck-base]'],
      });
      expectAttached(neck, `${headStyle}, ${tuning.label}`);
    }
  }
});

test('Every ear shape stays attached to both sides of every head', async ({ page }) => {
  test.setTimeout(240_000);
  const svg = await openPortrait(page);
  const { headStyle: heads, earShape: ears } = await page.evaluate(() => window.HeroAvatar.ENUMS);
  for (const headStyle of heads) {
    for (const earShape of ears) {
      const selector = `[data-hero-slot="ear-shape"][data-hero-option="${earShape}"]`;
      const results = await svg.evaluate(inspectPortrait, {
        appearance: { headStyle, earShape }, surfaceSelector: headSelector(headStyle),
        targetSelectors: [`${selector} [data-hero-face-detail="ear-left"]`, `${selector} [data-hero-face-detail="ear-right"]`],
      });
      results.forEach((ear, index) => expectAttached(ear, `${headStyle}, ${earShape}, ${index ? 'right' : 'left'}`));
    }
  }
});

test('Ear control boundaries preserve their physical attachment on narrow and broad heads', async ({ page }) => {
  test.setTimeout(180_000);
  const svg = await openPortrait(page);
  for (const headStyle of ['narrow', 'broad', 'compact-round']) {
    for (const tuning of AXIS_BOUNDARIES) {
      const results = await svg.evaluate(inspectPortrait, {
        appearance: { headStyle }, fineTune: { ears: tuning.value }, surfaceSelector: headSelector(headStyle),
        targetSelectors: ['[data-hero-slot="ear-shape"][data-hero-option="oval"] [data-hero-face-detail="ear-left"]',
          '[data-hero-slot="ear-shape"][data-hero-option="oval"] [data-hero-face-detail="ear-right"]'],
      });
      results.forEach((ear, index) => expectAttached(ear, `${headStyle}, ${tuning.label}, ${index ? 'right' : 'left'}`));
    }
  }
});

for (const feature of [{ key: 'mouthStyle', slot: 'mouth-style' }, { key: 'noseShape', slot: 'nose-shape' }]) {
  test(`Head tuning carries every ${feature.key} on the selected facial surface`, async ({ page }) => {
    test.setTimeout(240_000);
    const svg = await openPortrait(page);
    const values = await page.evaluate(key => window.HeroAvatar.ENUMS[key], feature.key);
    for (const headStyle of HEAD_BOUNDARIES) {
      for (const value of values) {
        for (const vertical of [-20, 0, 20]) {
          const [paint] = await svg.evaluate(inspectPortrait, {
            appearance: { headStyle, [feature.key]: value }, fineTune: { head: { vertical, height: -20 } },
            surfaceSelector: headSelector(headStyle),
            targetSelectors: [`[data-hero-slot="${feature.slot}"][data-hero-option="${value}"]`],
          });
          const context = `${headStyle}, ${value}, head vertical ${vertical}`;
          expect(paint.painted, `${context}: the selected feature remains visible`).toBeGreaterThan(0);
          expect(paint.exterior, `${context}: facial features must not float outside the head`).toBe(0);
        }
      }
    }
  });
}

test('Eyelashes remain rooted at the eyes when the eyes move', async ({ page }) => {
  test.setTimeout(240_000);
  const svg = await openPortrait(page);
  const { eyeShape: eyes, eyelashStyle: lashes } = await page.evaluate(() => window.HeroAvatar.ENUMS);
  for (const eyeShape of eyes) {
    for (const eyelashStyle of lashes.filter(style => style !== 'none')) {
      for (const vertical of [-20, 20]) {
        const [paint] = await svg.evaluate(inspectPortrait, {
          appearance: { eyeShape, eyelashStyle }, fineTune: { eyes: { vertical } },
          surfaceSelector: `[data-hero-slot="eye-shape"][data-hero-option="${eyeShape}"]`,
          targetSelectors: [`[data-hero-slot="eyelash-style"][data-hero-option="${eyelashStyle}"]`],
        });
        const context = `${eyeShape}, ${eyelashStyle}, eyes vertical ${vertical}`;
        expect(paint.components, `${context}: selected lashes must render`).toBeGreaterThan(0);
        expect(paint.detachedComponents, `${context}: no floating lash strokes`).toBe(0);
      }
    }
  }
});


test('Every mouth adjustment keeps the complete smile on the face', async ({ page }) => {
  test.setTimeout(240_000);
  const svg = await openPortrait(page);
  const mouths = await page.evaluate(() => window.HeroAvatar.ENUMS.mouthStyle);
  for (const headStyle of ['default', 'narrow', 'broad', 'compact-round']) {
    for (const mouthStyle of mouths) {
      for (const tuning of AXIS_BOUNDARIES.slice(1)) {
        const [paint] = await svg.evaluate(inspectPortrait, {
          appearance: { headStyle, mouthStyle }, fineTune: { mouth: tuning.value },
          surfaceSelector: headSelector(headStyle),
          targetSelectors: [`[data-hero-slot="mouth-style"][data-hero-option="${mouthStyle}"]`],
          checkClipping: true,
        });
        const context = `${headStyle}, ${mouthStyle}, mouth ${tuning.label}`;
        expect(paint.painted, `${context}: selected mouth remains visible`).toBeGreaterThan(0);
        expect(paint.exterior, `${context}: the mouth cannot escape the jaw`).toBe(0);
        expect(paint.clippedAwayPixels, `${context}: containment must preserve the complete mouth`).toBe(0);
      }
    }
  }
});

test('Full-coverage hair caps cover the upper scalp when hair proportions are minimized', async ({ page }) => {
  test.setTimeout(180_000);
  const svg = await openPortrait(page);
  for (const headStyle of ['default', 'narrow', 'broad', 'oblong']) {
    for (const hairStyle of ['clean-taper', 'buzz', 'crew-cut', 'fade', 'bun', 'ponytail', 'coily-puff', 'double-puffs']) {
      const [hair] = await svg.evaluate(inspectPortrait, {
        appearance: { headStyle, hairStyle },
        fineTune: { hair: { vertical: 20, width: -20, height: -20, spread: -20 } },
        surfaceSelector: headSelector(headStyle),
        targetSelectors: ['[data-hero-slot="hair"][display="inline"], [data-hero-slot="hairline"][display="inline"], [data-hero-slot="hair-root"][display="inline"]'],
        alphaThreshold: 230, crownCoverage: true,
      });
      const context = `${headStyle}, ${hairStyle}`;
      expect(hair.crownPixels, `${context}: the upper scalp is in view`).toBeGreaterThan(0);
      expect(hair.uncoveredCrownPixels, `${context}: opaque hair covers the scalp; a translucent shadow does not suffice`).toBe(0);
    }
  }
});

test('Small chin-hair styles stay visible below the lips and on the chin at adjustment limits', async ({ page }) => {
  test.setTimeout(240_000);
  const svg = await openPortrait(page);
  const mouths = await page.evaluate(() => window.HeroAvatar.ENUMS.mouthStyle);
  const adjustments = [
    {},
    { head: { vertical: -20, height: -20, width: -20 }, mouth: { vertical: 20, height: 20 }, facialHair: { vertical: 20, height: 20, width: 20 } },
    { head: { vertical: 20, height: 20, width: 20 }, mouth: { vertical: -20, height: -20 }, facialHair: { vertical: -20, height: -20, width: -20 } },
  ];
  for (const headStyle of HEAD_BOUNDARIES) {
    for (const facialHair of ['soul-patch', 'goatee', 'rounded-goatee', 'light-goatee']) {
      for (const mouthStyle of mouths) {
        for (const [boundary, fineTune] of adjustments.entries()) {
          const selector = `[data-hero-slot="facial-hair"][data-hero-option="${facialHair}"] [data-hero-chin-hair]`;
          const [paint] = await svg.evaluate(inspectPortrait, {
            appearance: { headStyle, facialHair, mouthStyle }, fineTune,
            surfaceSelector: headSelector(headStyle), targetSelectors: [selector], checkClipping: true,
          });
          const context = `${headStyle}, ${facialHair}, ${mouthStyle}, boundary ${boundary}`;
          expect(paint.painted, `${context}: the selected chin hair must remain visible`).toBeGreaterThan(4);
          expect(paint.exterior, `${context}: chin hair must sit on the facial surface`).toBe(0);
          expect(paint.clippedAwayPixels, `${context}: fitting must preserve the complete patch`).toBe(0);
          const spacing = await svg.evaluate((root, selector) => {
            const patch = root.querySelector(selector).getBoundingClientRect();
            const mouth = root.querySelector('[data-hero-slot="mouth-style"][display="inline"]').getBoundingClientRect();
            return { gap: patch.top - mouth.bottom, height: patch.height };
          }, selector);
          expect(spacing.gap, `${context}: lips must not cover the chin patch`).toBeGreaterThan(0);
          expect(spacing.height, `${context}: fitting must not flatten the hair to a line`).toBeGreaterThan(2);
        }
      }
    }
  }
});

test('Mustaches stay attached to the upper lip when mouth and facial-hair controls disagree', async ({ page }) => {
  test.setTimeout(180_000);
  const svg = await openPortrait(page);
  const mouths = await page.evaluate(() => window.HeroAvatar.ENUMS.mouthStyle);
  const styles = ['soft-mustache', 'neat-mustache', 'fine-mustache-stubble', 'mustache', 'goatee', 'rounded-goatee', 'light-goatee', 'full-beard'];
  for (const headStyle of HEAD_BOUNDARIES) {
    for (const facialHair of styles) {
      for (const mouthStyle of mouths) {
        for (const direction of [-1, 0, 1]) {
          const result = await svg.evaluate((root, { headStyle, facialHair, mouthStyle, direction }) => {
            const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
            Object.assign(avatar.appearance, { headStyle, facialHair, mouthStyle });
            avatar.fineTune.mouth = { vertical: direction * 20, height: direction * 20 };
            avatar.fineTune.facialHair = { vertical: -direction * 20, height: -direction * 20, width: direction * 20 };
            window.HeroAvatar.applyToSvg(root, avatar);
            const hair = root.querySelector('[data-hero-slot="facial-hair"][display="inline"] [data-hero-mustache]');
            const lip = root.querySelector('[data-hero-slot="mouth-style"][display="inline"]');
            const hairBox = hair.getBoundingClientRect();
            const lipBox = lip.getBoundingClientRect();
            const scale = lip.getScreenCTM().d;
            return { gap: (lipBox.top - hairBox.bottom) / scale, height: hairBox.height / scale,
              visible: [...hair.querySelectorAll('path')].every(path => getComputedStyle(path).fill !== 'none' && Number(getComputedStyle(path).opacity) > 0) };
          }, { headStyle, facialHair, mouthStyle, direction });
          const context = `${headStyle}, ${facialHair}, ${mouthStyle}, boundary ${direction}`;
          expect(result.visible, `${context}: mustache paint remains present`).toBe(true);
          expect(result.height, `${context}: the complete mustache retains its shape`).toBeGreaterThan(2);
          expect(result.gap, `${context}: mustache cannot hang below the upper lip`).toBeGreaterThan(-0.5);
          expect(result.gap, `${context}: mustache cannot float above the upper lip`).toBeLessThan(2.5);
        }
      }
    }
  }
});

test('Detached and hidden avatar templates preserve their owner and render like mounted avatars', async ({ page }) => {
  const svg = await openPortrait(page);
  const results = await svg.evaluate(async root => {
    async function pixels(svg) {
      const copy = svg.cloneNode(true);
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', '320');
      copy.setAttribute('height', '332');
      copy.style.display = 'block';
      copy.style.width = '320px';
      copy.style.height = '332px';
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 332;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, 320, 332).data;
    }
    const results = [];
    for (const facialHair of ['soul-patch', 'goatee', 'full-beard']) {
      for (const mode of ['unowned', 'fragment', 'hidden-ancestor', 'hidden-root']) {
        const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
        Object.assign(avatar.appearance, { facialHair, headStyle: 'compact-round', mouthStyle: 'full-lips' });
        avatar.outfit.accessory = 'wired-earbuds';
        avatar.outfit.accessories = ['wired-earbuds'];
        avatar.fineTune.mouth = { vertical: 20, height: 20 };
        avatar.fineTune.facialHair = { vertical: -20, height: -20 };
        const mounted = root.cloneNode(true);
        const detached = root.cloneNode(true);
        const owned = mode !== 'unowned';
        const owner = mode === 'fragment' ? document.createDocumentFragment() : document.createElement('div');
        if (mode === 'hidden-ancestor') owner.style.display = 'none';
        if (mode === 'hidden-root') detached.style.setProperty('display', 'none', 'important');
        if (mode.startsWith('hidden')) document.body.appendChild(owner);
        const sibling = document.createComment('next template');
        if (owned) owner.append(detached, sibling);
        const children = document.body.childElementCount;
        window.HeroAvatar.applyToSvg(detached, avatar);
        const restored = detached.parentNode === (owned ? owner : null)
          && (!owned || detached.nextSibling === sibling)
          && (mode !== 'hidden-root' || (detached.style.display === 'none' && detached.style.getPropertyPriority('display') === 'important'))
          && (mode !== 'hidden-ancestor' || owner.style.display === 'none');
        const noLeakedHost = document.body.childElementCount === children;
        document.body.appendChild(mounted);
        window.HeroAvatar.applyToSvg(mounted, avatar);
        const first = await pixels(detached), second = await pixels(mounted);
        let differences = 0, paint = 0;
        for (let index = 0; index < first.length; index++) differences += Math.abs(first[index] - second[index]);
        for (let index = 3; index < first.length; index += 4) if (first[index] > 0) paint++;
        results.push({ facialHair, mode, restored, noLeakedHost, paint, difference: differences / first.length });
        mounted.remove();
        if (owner.isConnected) owner.remove();
      }
    }
    return results;
  });
  for (const result of results) {
    const context = `${result.facialHair}, ${result.mode}`;
    expect(result.restored, `${context}: rendering must preserve template ownership and position`).toBe(true);
    expect(result.noLeakedHost, `${context}: temporary measuring elements must be removed`).toBe(true);
    expect(result.paint, `${context}: the image must contain visible artwork`).toBeGreaterThan(1000);
    expect(result.difference, `${context}: detached and mounted paint must agree`).toBeLessThan(0.1);
  }
});

test('Head adjustments leave body accessories in place', async ({ page }) => {
  const svg = await openPortrait(page);
  // These represent neck jewelry, a shoulder strap, a chest badge and a belt.
  for (const accessory of ['chain-necklace', 'campus-lanyard', 'backpack-straps', 'student-id-badge', 'utility-belt']) {
    const geometry = await svg.evaluate((root, accessory) => {
      const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
      avatar.outfit.accessories = [accessory];
      avatar.outfit.accessory = accessory;
      function bounds() {
        window.HeroAvatar.applyToSvg(root, avatar);
        const group = root.querySelector(`[data-hero-slot="accessory"][data-hero-option="${accessory}"]`);
        const rectangle = group.getBoundingClientRect();
        return { x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height };
      }
      const baseline = bounds();
      const changes = [];
      for (const axis of ['vertical', 'width', 'height', 'spread']) {
        for (const value of [-20, 20]) {
          avatar.fineTune.head = { [axis]: value };
          changes.push({ label: `${axis} ${value}`, bounds: bounds() });
        }
      }
      return { baseline, changes };
    }, accessory);
    expect(geometry.baseline.width, `${accessory} must render`).toBeGreaterThan(0);
    expect(geometry.baseline.height, `${accessory} must render`).toBeGreaterThan(0);
    for (const change of geometry.changes) {
      for (const dimension of ['x', 'y', 'width', 'height']) {
        expect(Math.abs(change.bounds[dimension] - geometry.baseline[dimension]), `${accessory}, head ${change.label}, ${dimension}`).toBeLessThan(0.1);
      }
    }
  }
});
// Attachment is a visible geometric property, independent of cable control points.
async function inspectWiredAttachment(svg, config) {
  const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
  for (const key of ['appearance', 'body', 'outfit', 'fineTune']) Object.assign(avatar[key], config[key]);
  avatar.outfit.accessory = 'wired-earbuds';
  avatar.outfit.accessories = ['wired-earbuds'];
  window.HeroAvatar.applyToSvg(svg, avatar);
  function paints(node, property) {
    for (let current = node; current && current !== svg; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    const style = getComputedStyle(node);
    return style[property] !== 'none' && Number(style[`${property}Opacity`]) > 0;
  }
  const accessory = svg.querySelector('[data-hero-slot="accessory"][data-hero-option="wired-earbuds"]');
  const wires = [...accessory.querySelectorAll('[data-hero-earbud-cable]')];
  const geometry = 'path,ellipse,circle,rect,polygon,polyline,line';
  const bodyPaint = [...svg.querySelectorAll('[data-hero-slot="body-shape"] path,[data-hero-default-torso] path,[data-hero-slot="outfit-style"] path,[data-hero-neck-base] path')]
    .filter(node => paints(node, 'fill'));
  return wires.map(wire => {
    const side = wire.getAttribute('data-hero-earbud-cable');
    const cable = [...wire.querySelectorAll('path,polyline,line')].find(node => paints(node, 'stroke'));
    const buds = [...accessory.querySelector(`[data-hero-ear-attachment="${side}"]`).querySelectorAll(geometry)]
      .filter(node => paints(node, 'fill'));
    if (!cable) return { side, painted: false, attached: false, collarContact: false };
    const length = cable.getTotalLength();
    const start = cable.getPointAtLength(0).matrixTransform(cable.getScreenCTM());
    const end = cable.getPointAtLength(length).matrixTransform(cable.getScreenCTM());
    return {
      side, painted: Number.isFinite(length) && length > 0,
      attached: buds.some(bud => bud.isPointInFill(start.matrixTransform(bud.getScreenCTM().inverse()))),
      collarContact: bodyPaint.some(surface => surface.isPointInFill(end.matrixTransform(surface.getScreenCTM().inverse()))),
    };
  });
}

test('Wired earbuds paint two cables attached to the fitted buds and clothing at proportion boundaries', async ({ page }) => {
  const svg = await openPortrait(page);
  const minimum = { vertical: -20, spread: -20, width: -20, height: -20 };
  const maximum = { vertical: 20, spread: 20, width: 20, height: 20 };
  const cases = [
    {},
    { appearance: { headStyle: 'narrow' }, fineTune: { head: minimum } },
    { appearance: { headStyle: 'broad' }, fineTune: { head: maximum } },
    { appearance: { headStyle: 'narrow', earShape: 'small-round' }, fineTune: { ears: minimum } },
    { appearance: { earShape: 'prominent' }, fineTune: { ears: maximum } },
    { body: { type: 'petite' }, fineTune: { body: minimum } },
    { body: { type: 'plus-size' }, fineTune: { body: maximum } },
    { outfit: { style: 'hoodie' }, fineTune: { outfit: minimum } },
    { outfit: { style: 'collared-shirt' }, fineTune: { outfit: maximum } },
    { fineTune: { accessories: minimum } },
    { fineTune: { accessories: maximum } },
  ];
  for (const config of cases) {
    const results = await svg.evaluate(inspectWiredAttachment, config);
    const context = JSON.stringify(config);
    expect(results.map(result => result.side).sort(), context).toEqual(['left', 'right']);
    for (const result of results) {
      expect(result.painted, `${context}: ${result.side} cable paints`).toBe(true);
      expect(result.attached, `${context}: ${result.side} cable touches its bud`).toBe(true);
      expect(result.collarContact, `${context}: ${result.side} cable enters clothing`).toBe(true);
    }
  }
});

// Compare the rendered ink with the actual muzzle under it, excluding partially
// covered antialias pixels. No particular token, hex color, or path is required.
async function inspectMuzzleContrast(svg, fur) {
  const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
  avatar.kind = 'bruin';
  avatar.appearance.skin = fur;
  window.HeroAvatar.applyToSvg(svg, avatar);
  window.HeroAvatar.applyMilestoneToSvg(svg, 'none');
  const inkSelector = '[data-hero-mascot-face="nose"],[data-hero-mascot-face="mouth"]';
  const width = 320, height = 280;
  async function raster(kind) {
    const copy = svg.cloneNode(true);
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copy.setAttribute('viewBox', '320 130 160 140');
    copy.setAttribute('width', String(width));
    copy.setAttribute('height', String(height));
    copy.style.width = `${width}px`;
    copy.style.height = `${height}px`;
    if (kind === 'background') copy.querySelectorAll(inkSelector).forEach(node => node.remove());
    else copy.querySelectorAll('path,ellipse,circle,rect,polygon,polyline,line,text,use,image').forEach(node => {
      if (!node.closest('defs') && !node.closest(`[data-hero-mascot-face="${kind}"]`)) node.remove();
    });
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, width, height).data;
  }
  function luminance(rgba, index) {
    return [0.2126, 0.7152, 0.0722].reduce((sum, weight, channel) => {
      const value = rgba[index + channel] / 255;
      return sum + weight * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    }, 0);
  }
  const background = await raster('background');
  const results = [];
  for (const feature of ['nose', 'mouth']) {
    const paint = await raster(feature);
    let samples = 0, minimumContrast = Infinity;
    for (let index = 0; index < paint.length; index += 4) {
      if (paint[index + 3] < 250 || background[index + 3] < 250) continue;
      samples++;
      const ink = luminance(paint, index), under = luminance(background, index);
      minimumContrast = Math.min(minimumContrast, (Math.max(ink, under) + 0.05) / (Math.min(ink, under) + 0.05));
    }
    results.push({ feature, samples, minimumContrast });
  }
  return results;
}

test('Bruin nose and smile remain distinct from their actual muzzle across fur palettes', async ({ page }) => {
  const svg = await openPortrait(page);
  // The five randomizer-supported fur presets plus darkest/lightest custom colors.
  const furColors = ['#7a4e2f', '#8b5a35', '#6a4830', '#5c3a22', '#a06840', '#000000', '#ffffff'];
  for (const fur of furColors) {
    const results = await svg.evaluate(inspectMuzzleContrast, fur);
    for (const result of results) {
      expect(result.samples, `${fur}: ${result.feature} must render visibly`).toBeGreaterThan(0);
      expect(result.minimumContrast, `${fur}: ${result.feature} against its painted muzzle`).toBeGreaterThanOrEqual(3);
    }
  }
});

test('Cheek tints stay beneath opaque facial hair', async ({ page }) => {
  const svg = await openPortrait(page);
  const result = await svg.evaluate(async (svg) => {
    const state = structuredClone(window.HeroAvatar.DEFAULTS);
    Object.assign(state.appearance, {
      hairStyle: 'short', headStyle: 'compact-round', facialHair: 'full-beard',
      skin: '#f1cfb5', hairColor: '#1e1711', faceFeature: 'none', mouthStyle: 'full-lips'
    });
    state.outfit.accessory = 'none';
    state.outfit.accessories = [];
    state.fineTune.mouth = { vertical: 20, width: 20, height: 20, spread: 20 };
    state.fineTune.facialHair = { vertical: -20, width: -20, height: -20, spread: -20 };
    state.fineTune.head = { vertical: -20, width: 20, height: 20, spread: 20 };
    window.HeroAvatar.applyToSvg(svg, state);
    svg.pauseAnimations();
    svg.setCurrentTime(0);

    const frame = svg.querySelector('[data-hero-head-proportions]');
    const beard = svg.querySelector('[data-hero-slot="facial-hair"][data-hero-option="full-beard"]');
    // Locate painted surfaces by their material, allowing the artwork to use any SVG geometry.
    const cheeks = [...svg.querySelectorAll('[fill*="--hero-cheek"]')].filter(shape =>
      typeof shape.isPointInFill === 'function' && !shape.closest('[display="none"]'));
    const opaqueBeard = [...beard.querySelectorAll('path,ellipse,circle,rect,polygon')].filter(shape => {
      const style = getComputedStyle(shape);
      return style.fill !== 'none' && Number(style.opacity) >= 0.99 && Number(style.fillOpacity) >= 0.99;
    });
    const toLocal = shape => shape.getScreenCTM().inverse().multiply(frame.getScreenCTM());
    const inside = (shape, x, y) => shape.isPointInFill(new DOMPoint(x, y).matrixTransform(toLocal(shape)));
    const safelyInsideBeard = (x, y) => [[0, 0], [-2, 0], [2, 0], [0, -2], [0, 2]].every(([dx, dy]) =>
      opaqueBeard.some(shape => inside(shape, x + dx, y + dy)));
    const covered = [];
    const toRoot = svg.getScreenCTM().inverse().multiply(frame.getScreenCTM());
    // Anatomical cheek area; the actual filled surfaces decide which samples qualify.
    for (let y = 205; y <= 220; y += 1) for (let x = 350; x <= 450; x += 1) {
      if (!cheeks.some(shape => [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => inside(shape, x + dx, y + dy)))) continue;
      const point = new DOMPoint(x, y).matrixTransform(toRoot);
      if (safelyInsideBeard(x, y)) covered.push(point);
    }
    const vb = svg.viewBox.baseVal;
    const render = async () => {
      const clone = svg.cloneNode(true);
      clone.querySelectorAll('[display="none"],animate,animateTransform,animateMotion,set').forEach(el => el.remove());
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', vb.width);
      clone.setAttribute('height', vb.height);
      clone.style.width = vb.width + 'px';
      clone.style.height = vb.height + 'px';
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = vb.width;
        canvas.height = vb.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      } finally { URL.revokeObjectURL(url); }
    };
    const initialCheek = svg.style.getPropertyValue('--hero-cheek');
    const before = await render();
    svg.style.setProperty('--hero-cheek', '#00ffff');
    const after = await render();
    // The same cheek pixels become visible without facial hair, proving that the tint mutation is effective.
    beard.setAttribute('display', 'none');
    const exposedAfter = await render();
    svg.style.setProperty('--hero-cheek', initialCheek);
    const exposedBefore = await render();
    beard.setAttribute('display', 'inline');
    const differences = (first, second) => covered.map(point => {
      const offset = (Math.round(point.y - vb.y) * Math.round(vb.width) + Math.round(point.x - vb.x)) * 4;
      return Math.max(...[0, 1, 2].map(channel => Math.abs(first[offset + channel] - second[offset + channel])));
    });
    const coveredDifferences = differences(before, after);
    const uncoveredDifferences = differences(exposedBefore, exposedAfter);
    return {
      coveredSamples: covered.length,
      maximumBeardChange: Math.max(0, ...coveredDifferences),
      changedBeardSamples: coveredDifferences.filter(value => value > 1).length,
      visibleCheekChange: Math.max(0, ...uncoveredDifferences),
      changedVisibleCheekSamples: uncoveredDifferences.filter(value => value > 20).length
    };
  });
  expect(result.coveredSamples, 'The configuration must exercise cheek/beard overlap').toBeGreaterThan(0);
  expect(result.maximumBeardChange, 'Cheek paint must not tint opaque beard interiors').toBeLessThanOrEqual(1);
  expect(result.changedVisibleCheekSamples, 'The tint must change the same pixels when uncovered').toBeGreaterThan(0);
});

test('Nose tips remain visible above mouths at opposing adjustment limits', async ({ page }) => {
  test.setTimeout(240_000);
  const svg = await openPortrait(page);
  const choices = await page.evaluate(() => ({ noses: window.HeroAvatar.ENUMS.noseShape, mouths: window.HeroAvatar.ENUMS.mouthStyle }));
  for (const headStyle of ['narrow', 'compact-round', 'broad']) {
    for (const noseShape of choices.noses) {
      for (const mouthStyle of choices.mouths) {
        for (const direction of [-1, 1]) {
          const result = await svg.evaluate((root, { headStyle, noseShape, mouthStyle, direction }) => {
            const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
            Object.assign(avatar.appearance, { headStyle, noseShape, mouthStyle });
            avatar.fineTune.nose = { vertical: direction * 20, height: direction * 20 };
            avatar.fineTune.mouth = { vertical: -direction * 20, height: direction * 20 };
            window.HeroAvatar.applyToSvg(root, avatar);
            const tip = root.querySelector('[data-hero-slot="nose-shape"][display="inline"] [data-hero-face-detail="nose"]');
            const box = tip.getBBox();
            const mouth = root.querySelector('[data-hero-slot="mouth-style"][display="inline"]');
            const paint = [...mouth.querySelectorAll('path')].filter(path => getComputedStyle(path).fill !== 'none');
            const points = [[.5, .5], [.25, .5], [.75, .5], [.5, .25], [.5, .75]].map(([x, y]) =>
              new DOMPoint(box.x + box.width * x, box.y + box.height * y).matrixTransform(tip.getScreenCTM()));
            return { visible: box.width > 0 && box.height > 0 && Number(getComputedStyle(tip).opacity) > 0,
              occluded: points.some(point => paint.some(path => path.isPointInFill(point.matrixTransform(path.getScreenCTM().inverse())))) };
          }, { headStyle, noseShape, mouthStyle, direction });
          const context = `${headStyle}, ${noseShape}, ${mouthStyle}, ${direction}`;
          expect(result.visible, `${context}: the selected nose tip must paint`).toBe(true);
          expect(result.occluded, `${context}: mouth paint must not cover the nose tip`).toBe(false);
        }
      }
    }
  }
});

test('Chin dimples remain complete and seated on the face at detail-control limits', async ({ page }) => {
  test.setTimeout(180_000);
  const svg = await openPortrait(page);
  for (const headStyle of HEAD_BOUNDARIES) {
    for (const mouthStyle of ['smile', 'full-lips', 'excited-smile']) {
      for (const direction of [-1, 0, 1]) {
        const tuning = { vertical: direction * 20, height: direction * 20, width: direction * 20, spread: direction * 20 };
        const [paint] = await svg.evaluate(inspectPortrait, {
          appearance: { headStyle, mouthStyle, faceFeature: 'chin-dimple' },
          fineTune: { head: { vertical: -direction * 20, height: -direction * 20 }, mouth: tuning, faceFeature: tuning },
          surfaceSelector: headSelector(headStyle),
          targetSelectors: ['[data-hero-slot="face-feature"][data-hero-option="chin-dimple"]'], checkClipping: true,
        });
        const context = `${headStyle}, ${mouthStyle}, boundary ${direction}`;
        expect(paint.painted, `${context}: selected dimple must remain visible`).toBeGreaterThan(0);
        expect(paint.exterior, `${context}: the dimple must not become a neck mark`).toBe(0);
        expect(paint.clippedAwayPixels, `${context}: the complete dimple remains on the chin`).toBe(0);
      }
    }
  }
});

test('Skin freckles stay beneath opaque eyes', async ({ page }) => {
  const portrait = await openPortrait(page);
  const result = await portrait.evaluate(async (svg) => {
    const state = structuredClone(HeroAvatar.DEFAULTS);
    Object.assign(state.appearance, {
      skin: '#f8dfcf', hairColor: '#19130f', hairStyle: 'locs', headStyle: 'default',
      faceFeature: 'forehead-freckles', facialHair: 'none', eyeShape: 'round', mouthStyle: 'smile'
    });
    state.outfit.accessory = 'none';
    state.outfit.accessories = [];
    state.fineTune.faceFeature = { vertical: 20, width: 20, height: 20, spread: 20 };
    state.fineTune.head = { vertical: -20, width: -20, height: -20, spread: -20 };
    HeroAvatar.applyToSvg(svg, state);
    svg.pauseAnimations();
    svg.setCurrentTime(0);
    const marks = svg.querySelector('[data-hero-slot="face-feature"][data-hero-option="forehead-freckles"]');
    const eyes = svg.querySelector('[data-hero-slot="eye-shape"][data-hero-option="round"]');
    const paintedShapes = root => [...root.querySelectorAll('*')].filter(shape => {
      if (typeof shape.isPointInFill !== 'function' || shape.closest('[display="none"]')) return false;
      const style = getComputedStyle(shape);
      return style.fill !== 'none' && Number(style.opacity) > 0 && Number(style.fillOpacity) > 0;
    });
    const markShapes = paintedShapes(marks);
    const opaqueEyes = paintedShapes(eyes).filter(shape => {
      const style = getComputedStyle(shape);
      return Number(style.opacity) >= .99 && Number(style.fillOpacity) >= .99;
    });
    const inShape = (shape, x, y) => shape.isPointInFill(new DOMPoint(x, y).matrixTransform(
      shape.getScreenCTM().inverse().multiply(marks.getScreenCTM())
    ));
    const offsets = [[0, 0], [-.6, 0], [.6, 0], [0, -.6], [0, .6]];
    const covered = [], exposed = [];
    const box = marks.getBBox();
    const toRoot = svg.getScreenCTM().inverse().multiply(marks.getScreenCTM());
    // Sample actual painted detail shapes; no path count, point coordinates, or painter order is prescribed.
    for (let y = box.y; y <= box.y + box.height; y += .25) for (let x = box.x; x <= box.x + box.width; x += .25) {
      if (!markShapes.some(shape => inShape(shape, x, y))) continue;
      const hit = offsets.map(([dx, dy]) => opaqueEyes.some(shape => inShape(shape, x + dx, y + dy)));
      const point = new DOMPoint(x, y).matrixTransform(toRoot);
      if (hit.every(Boolean)) covered.push(point);
      else if (hit.every(value => !value)) exposed.push(point);
    }
    const vb = svg.viewBox.baseVal;
    const width = Math.round(vb.width * 2), height = Math.round(vb.height * 2);
    async function render() {
      const clone = svg.cloneNode(true);
      clone.querySelectorAll('[display="none"],animate,animateTransform,animateMotion,set').forEach(node => node.remove());
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', width);
      clone.setAttribute('height', height);
      clone.style.width = width + 'px';
      clone.style.height = height + 'px';
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, width, height).data;
      } finally { URL.revokeObjectURL(url); }
    }
    const originalColor = svg.style.getPropertyValue('--hero-face-mark');
    const before = await render();
    svg.style.setProperty('--hero-face-mark', '#00ffff');
    const after = await render();
    svg.style.setProperty('--hero-face-mark', originalColor);
    const maximumDifference = points => Math.max(0, ...points.map(point => {
      const x = Math.round((point.x - vb.x) * width / vb.width);
      const y = Math.round((point.y - vb.y) * height / vb.height);
      const offset = (y * width + x) * 4;
      return Math.max(...[0, 1, 2].map(channel => Math.abs(before[offset + channel] - after[offset + channel])));
    }));
    return {
      coveredSamples: covered.length,
      exposedSamples: exposed.length,
      maximumEyeChange: maximumDifference(covered),
      maximumVisibleFreckleChange: maximumDifference(exposed)
    };
  });
  expect(result.coveredSamples, 'The configuration must exercise freckle/eye overlap').toBeGreaterThan(0);
  expect(result.exposedSamples, 'Freckles must also remain visible on skin').toBeGreaterThan(0);
  expect(result.maximumEyeChange, 'Skin paint must not tint opaque eye interiors').toBeLessThanOrEqual(1);
  expect(result.maximumVisibleFreckleChange, 'The visible skin freckles must respond to the color change').toBeGreaterThan(20);
});
