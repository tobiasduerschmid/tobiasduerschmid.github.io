// @ts-check
const { test, expect } = require('@playwright/test');

// The art hooks are documented in .agents/skills/avatar-svg-design/SKILL.md.
// This is a renderer integration test: its oracle is visible paint containment,
// independent of the number, control points, or structure of the authored paths.
test.use({ reducedMotion: 'reduce' });

const PROPORTION_CASES = [
  { label: 'default', value: {} },
  { label: 'small and raised', value: { width: -20, height: -20, spread: -20, vertical: -20 } },
  { label: 'large and lowered', value: { width: 20, height: 20, spread: 20, vertical: 20 } },
  { label: 'narrow and tall', value: { width: -20, height: 20, spread: -20, vertical: 20 } },
  { label: 'wide and short', value: { width: 20, height: -20, spread: 20, vertical: -20 } },
];

async function openArtFixture(page) {
  await page.goto('/se-gym/');
  await page.waitForFunction(() => window.HeroAvatar && document.querySelector('[data-gym-hero-svg]'));
  await page.evaluate(() => {
    const svg = document.querySelector('[data-gym-hero-svg]').cloneNode(true);
    svg.querySelectorAll('animate, animateTransform, animateMotion, set').forEach(node => node.remove());
    svg.setAttribute('data-testid', 'art-fixture');
    svg.setAttribute('data-hero-avatar-ready', 'true');
    svg.style.cssText = 'display:block;width:800px;height:820px;opacity:1;visibility:visible';
    document.body.replaceChildren(svg);
    window.HeroAvatar.applyToSvg(svg, structuredClone(window.HeroAvatar.DEFAULTS));
    svg.pauseAnimations();
  });
  return page.getByTestId('art-fixture');
}

// Serializes the actual rendered layer, retaining its clip/mask definitions and
// its complete composed transform. Only presentation is inlined for the image
// renderer, which cannot inherit the page's external CSS.
async function measurePaintContainment(svg, { appearance, fineTune, surfaceSelector, paintSelector, applySelection = true }) {
  if (applySelection) {
    const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
    Object.assign(avatar.appearance, appearance);
    Object.assign(avatar.fineTune, fineTune);
    window.HeroAvatar.applyToSvg(svg, avatar);
  }

  const surface = svg.querySelector(surfaceSelector);
  const paint = svg.querySelector(paintSelector);
  const namespace = 'http://www.w3.org/2000/svg';
  const size = 520;
  const properties = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity',
    'stroke-linecap', 'stroke-linejoin', 'opacity', 'clip-path', 'mask', 'display', 'visibility',
    'transform', 'transform-origin', 'transform-box'];

  function layerImage(layer) {
    const image = document.createElementNS(namespace, 'svg');
    image.setAttribute('xmlns', namespace);
    image.setAttribute('width', String(size));
    image.setAttribute('height', String(size));
    image.setAttribute('viewBox', '270 40 260 260');
    image.setAttribute('style', svg.getAttribute('style') || '');
    image.style.width = `${size}px`;
    image.style.height = `${size}px`;
    svg.querySelectorAll(':scope > defs').forEach(definition => image.appendChild(definition.cloneNode(true)));

    const wrapper = document.createElementNS(namespace, 'g');
    const parentTransform = svg.getScreenCTM().inverse().multiply(layer.parentNode.getScreenCTM());
    wrapper.setAttribute('transform', parentTransform.toString());
    const copy = layer.cloneNode(true);
    const originalNodes = [layer, ...layer.querySelectorAll('*')];
    const copiedNodes = [copy, ...copy.querySelectorAll('*')];
    originalNodes.forEach((node, index) => {
      const computed = getComputedStyle(node);
      properties.forEach(property => copiedNodes[index].style.setProperty(property, computed.getPropertyValue(property)));
    });
    wrapper.appendChild(copy);
    image.appendChild(wrapper);
    return new XMLSerializer().serializeToString(image);
  }

  async function pixels(markup) {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, size, size).data;
  }

  const [surfacePixels, paintPixels] = await Promise.all([pixels(layerImage(surface)), pixels(layerImage(paint))]);
  let visiblePaintPixels = 0;
  let spillPixels = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const alpha = paintPixels[(y * size + x) * 4 + 3];
      if (alpha < 8) continue;
      visiblePaintPixels++;
      // A one-pixel neighborhood permits edge antialiasing, not an exterior
      // glow. At this resolution one pixel is half a viewBox unit.
      let touchesSurface = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          touchesSurface ||= surfacePixels[((y + dy) * size + x + dx) * 4 + 3] > 0;
        }
      }
      if (!touchesSurface) spillPixels++;
    }
  }
  return { visiblePaintPixels, spillPixels };
}

test('Face lighting stays on every selected head when its proportions change', async ({ page }) => {
  test.setTimeout(120_000);
  const svg = await openArtFixture(page);
  const headStyles = await page.evaluate(() => window.HeroAvatar.ENUMS.headStyle);
  expect(headStyles).toEqual(expect.arrayContaining(['default', 'narrow', 'broad']));
  for (const headStyle of headStyles) {
    for (const tuning of PROPORTION_CASES) {
      const result = await svg.evaluate(measurePaintContainment, {
        appearance: { headStyle },
        fineTune: { head: tuning.value },
        surfaceSelector: `[data-hero-slot="head-shape"][data-hero-option="${headStyle}"]`,
        paintSelector: '[data-hero-polish="face"]',
      });
      expect(result.visiblePaintPixels, `${headStyle}, ${tuning.label}: portrait lighting must render`).toBeGreaterThan(100);
      expect(result.spillPixels, `${headStyle}, ${tuning.label}: lighting must not paint outside the jaw`).toBe(0);
    }
  }
});

test('Eye reflections stay inside every eye shape when its proportions change', async ({ page }) => {
  test.setTimeout(120_000);
  const svg = await openArtFixture(page);
  const eyeShapes = await page.evaluate(() => window.HeroAvatar.ENUMS.eyeShape);
  expect(eyeShapes).toContain('round');
  for (const eyeShape of eyeShapes) {
    for (const tuning of PROPORTION_CASES) {
      const result = await svg.evaluate(measurePaintContainment, {
        appearance: { eyeShape },
        fineTune: { eyes: tuning.value },
        surfaceSelector: `[data-hero-slot="eye-shape"][data-hero-option="${eyeShape}"]`,
        paintSelector: '[data-hero-eye-catchlights]',
      });
      expect(result.visiblePaintPixels, `${eyeShape}, ${tuning.label}: reflections must render`).toBeGreaterThan(0);
      expect(result.spillPixels, `${eyeShape}, ${tuning.label}: reflections must not float outside the eyes`).toBe(0);
    }
  }
});

for (const faceFeature of ['birthmark', 'vitiligo']) {
  test(`${faceFeature} stays on the face across head shapes and independent detail tuning`, async ({ page }) => {
    test.setTimeout(180_000);
    const svg = await openArtFixture(page);
    const headStyles = await page.evaluate(() => window.HeroAvatar.ENUMS.headStyle);
    expect(headStyles).toContain('narrow');
    for (const headStyle of headStyles) {
      for (const head of PROPORTION_CASES) {
        for (const detail of PROPORTION_CASES) {
          const result = await svg.evaluate(measurePaintContainment, {
            appearance: { headStyle, faceFeature },
            fineTune: { head: head.value, faceFeature: detail.value },
            surfaceSelector: `[data-hero-slot="head-shape"][data-hero-option="${headStyle}"]`,
            paintSelector: '[data-hero-skin-details]',
          });
          const context = `${headStyle}, head ${head.label}, detail ${detail.label}`;
          expect(result.visiblePaintPixels, `${context}: the selected ${faceFeature} must render`).toBeGreaterThan(0);
          expect(result.spillPixels, `${context}: ${faceFeature} must not paint beyond the face`).toBe(0);
        }
      }
    }
  });
}

for (const layer of [
  { label: 'Head contour shading', selector: '[data-hero-head-feature-layer]' },
  { label: 'Cheek shading', selector: '[data-hero-cheek-surface]' },
]) {
  test(`${layer.label} stays inside every head at tuning extremes`, async ({ page }) => {
    test.setTimeout(120_000);
    const svg = await openArtFixture(page);
    const headStyles = await page.evaluate(() => window.HeroAvatar.ENUMS.headStyle);
    let renderedPaint = 0;
    for (const headStyle of headStyles) {
      for (const tuning of PROPORTION_CASES) {
        const oppositeTuning = Object.fromEntries(Object.entries(tuning.value).map(([axis, value]) => [axis, -value]));
        const result = await svg.evaluate(measurePaintContainment, {
          appearance: { headStyle },
          fineTune: { head: tuning.value, cheeks: oppositeTuning },
          surfaceSelector: `[data-hero-slot="head-shape"][data-hero-option="${headStyle}"]`,
          paintSelector: layer.selector,
        });
        renderedPaint += result.visiblePaintPixels;
        expect(result.spillPixels, `${headStyle}, ${tuning.label}: ${layer.label} must stay on the face`).toBe(0);
      }
    }
    // Some head shapes intentionally omit contour shading; the matrix must
    // still exercise visible art instead of passing for a missing layer.
    expect(renderedPaint, `${layer.label} must render within the tested choices`).toBeGreaterThan(0);
  });
}

for (const traits of [
  { aid: 'Left hearing aid', detail: 'birthmark', detailLabel: 'Cheek birthmark' },
  { aid: 'Hearing aids', detail: 'vitiligo', detailLabel: 'Vitiligo patches' },
]) {
  test(`${traits.aid} and ${traits.detailLabel} can be chosen and kept after reload`, async ({ page, context }) => {
    await context.addCookies([{ name: 'se-gym-active', value: 'true', domain: '127.0.0.1', path: '/' }]);
    await page.goto('/se-gym/');
    await page.waitForFunction(() => window.HeroAvatar);
    // A known starting avatar avoids random headwear concealing the chosen aid.
    await page.evaluate(() => window.HeroAvatar.saveAvatar(structuredClone(window.HeroAvatar.DEFAULTS)));
    await page.reload();
    await page.getByRole('button', { name: 'Customize Hero', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Customize your hero' });
    await dialog.getByLabel(traits.aid, { exact: true }).check();
    await dialog.getByLabel('Facial details', { exact: true }).selectOption({ label: traits.detailLabel });

    const detail = dialog.locator(`[data-gym-hero-svg] [data-hero-slot="face-feature"][data-hero-option="${traits.detail}"]`);
    const aidValue = traits.aid === 'Left hearing aid' ? 'hearing-aid-left' : 'hearing-aids';
    const aid = dialog.locator(`[data-gym-hero-svg] [data-hero-slot="accessory"][data-hero-option="${aidValue}"]`);
    await expect(detail).toBeVisible();
    await expect(aid).toBeVisible();
    await dialog.getByRole('group', { name: 'Top hero customizer actions' }).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await page.getByRole('button', { name: 'Customize Hero', exact: true }).click();
    await expect(dialog.getByLabel(traits.aid, { exact: true })).toBeChecked();
    await expect(dialog.getByLabel('Facial details', { exact: true })).toHaveValue(traits.detail);
    await expect(detail).toBeVisible();
    await expect(aid).toBeVisible();
  });
}

test('Separately mounted heroes resolve their own gradients, masks, and clips', async ({ page }) => {
  await page.goto('/se-gym/');
  await page.waitForFunction(() => window.HeroAvatar);
  const result = await page.evaluate(async () => {
    window.HeroAvatar.saveAvatar(structuredClone(window.HeroAvatar.DEFAULTS));
    const hosts = [document.createElement('div'), document.createElement('div')];
    document.body.append(...hosts);
    const mounted = await Promise.all(hosts.map(host => window.HeroAvatar.mountSavedAvatar(host, { variant: 'same-seed' })));
    const unresolved = [];
    const duplicateIds = [];
    hosts.forEach((host, index) => {
      const svg = host.querySelector('svg');
      if (!svg) return;
      svg.querySelectorAll('[id]').forEach(node => {
        if (document.getElementById(node.id) !== node) duplicateIds.push(node.id);
      });
      svg.querySelectorAll('*').forEach(node => {
        for (const attribute of node.attributes) {
          const fragments = [...attribute.value.matchAll(/url\(["']?#([^\s"')]+)["']?\)/g)].map(match => match[1]);
          if ((attribute.name === 'href' || attribute.name === 'xlink:href') && attribute.value.startsWith('#')) {
            fragments.push(attribute.value.slice(1));
          }
          for (const fragment of fragments) {
            const target = document.getElementById(fragment);
            if (!target || !svg.contains(target)) unresolved.push({ instance: index, attribute: attribute.name, fragment });
          }
        }
      });
    });
    return { mounted, unresolved, duplicateIds };
  });
  expect(result.mounted, 'both independently mounted heroes must render').toEqual([true, true]);
  expect(result.duplicateIds, 'hero instances must not reuse document IDs').toEqual([]);
  expect(result.unresolved, 'each local paint or geometry reference must resolve inside its own hero').toEqual([]);
});

test('Bruin choice paints the mascot when the static thumbnail manifest is unavailable', async ({ page, context }) => {
  await context.addCookies([{ name: 'se-gym-active', value: 'true', domain: '127.0.0.1', path: '/' }]);
  // The optional external manifest is absent in this scenario; exercise the
  // real live-preview renderer even if a deployment supplies static images.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SEGymHeroChoicePreviews', {
      configurable: true,
      get: () => undefined,
      set: () => {},
    });
  });
  await page.goto('/se-gym/');
  await page.getByRole('button', { name: 'Customize Hero', exact: true }).click();
  const choice = page.getByRole('button', { name: 'Choose Hero type: Bruin mascot', exact: true });
  const svg = choice.locator('[data-hero-choice-svg]');
  const mascot = '[data-hero-slot="mascot"]';
  await expect(svg.locator(mascot)).toBeVisible();
  const result = await svg.evaluate(measurePaintContainment, {
    surfaceSelector: mascot,
    paintSelector: mascot,
    applySelection: false,
  });
  expect(result.visiblePaintPixels, 'the Bruin choice must paint mascot artwork, independently of its barbell and background').toBeGreaterThan(100);
});
