// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const portraitTemplate = fs.readFileSync(path.join(projectRoot, '_includes/se-gym-hero.svg'), 'utf8')
  .replace(/^\{% assign[^\n]+\n/, '')
  .replace(/\{% if include.ready %\}.*?\{% endif %\}/g, '')
  .replace(/\{\{\s*hero_variant\s*\}\}/g, 'clothing-paint-fixture');

test.use({ reducedMotion: 'reduce' });

async function openPortrait(page) {
  // Renderer integration uses the actual artwork and runtime. Public controls
  // are covered by the separate customizer suite; no site build is needed here.
  await page.setContent(`<html lang="en"><head><title>Clothing paint fixture</title></head><body>${portraitTemplate}</body></html>`);
  await page.addScriptTag({ path: path.join(projectRoot, 'js/se-gym-hero-avatar.js') });
  await page.evaluate(() => {
    const svg = document.querySelector('[data-gym-hero-svg]');
    svg.querySelectorAll('animate, animateTransform, animateMotion, set').forEach(node => node.remove());
    svg.setAttribute('data-testid', 'clothing-paint-fixture');
    svg.style.cssText = 'display:block;width:800px;height:820px;opacity:1;visibility:visible';
    svg.pauseAnimations();
  });
  return page.getByTestId('clothing-paint-fixture');
}

async function neckPaint(page, svg, configuration) {
  const clip = await svg.evaluate((element, { outfit, body, skin, suit, cape }) => {
    const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
    avatar.appearance.skin = skin;
    avatar.body.type = body;
    Object.assign(avatar.outfit, { style: outfit, suit, capeOuter: cape, accessory: 'none', accessories: [] });
    window.HeroAvatar.applyToSvg(element, avatar);

    // The documented neck artwork hook supplies only the measurement frame.
    // Compare browser paint inside its lower center, safely away from the jaw,
    // silhouette antialiasing and collar edges. No path or layer order is pinned.
    const neck = element.querySelector('[data-hero-neck-base]');
    const bounds = neck.getBBox();
    const matrix = neck.getScreenCTM();
    const start = new DOMPoint(bounds.x + bounds.width * .35, bounds.y + bounds.height * .72).matrixTransform(matrix);
    const end = new DOMPoint(bounds.x + bounds.width * .65, bounds.y + bounds.height * .82).matrixTransform(matrix);
    const x = Math.ceil(start.x);
    const y = Math.ceil(start.y);
    return { x, y, width: Math.floor(end.x) - x, height: Math.floor(end.y) - y };
  }, configuration);
  const screenshot = await page.screenshot({ clip });
  return page.evaluate(async encoded => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 6;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data)
      .filter((_, index) => index % 4 !== 3);
  }, screenshot.toString('base64'));
}

function channelDifferences(first, second) {
  return first.map((channel, index) => Math.abs(channel - second[index]));
}

// Round, V, blouse and hood openings exercise different garment paint shapes.
for (const outfit of ['crewneck-sweatshirt', 'polo-shirt', 'campus-blouse', 'hoodie']) {
  test(`${outfit} preserves exposed neck skin when clothing colors change`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const svg = await openPortrait(page);

    for (const body of ['petite', 'average', 'plus-size']) {
      const skinSamples = [];
      for (const skin of ['#422c22', '#f4d0c4']) {
        const configuration = { outfit, body, skin };
        const navy = await neckPaint(page, svg, { ...configuration, suit: '#18354d', cape: '#15538f' });
        const cream = await neckPaint(page, svg, { ...configuration, suit: '#e6d7b5', cape: '#9dbe87' });
        const difference = Math.max(...channelDifferences(navy, cream));
        // A two-channel-level allowance ignores raster rounding while catching
        // the visible shirt-colored band formerly painted across the neck.
        expect(difference, `${outfit}, ${body}, ${skin}: clothing must not tint exposed neck skin`).toBeLessThanOrEqual(2);
        skinSamples.push(navy);
      }
      const skinDifference = channelDifferences(skinSamples[0], skinSamples[1]);
      const meanSkinDifference = skinDifference.reduce((sum, difference) => sum + difference, 0) / skinDifference.length;
      // Positive control: the measured paint must actually respond to skin
      // selection, so an empty or background-only sample cannot pass.
      expect(meanSkinDifference, `${outfit}, ${body}: the sample must contain visible selected skin`).toBeGreaterThan(30);
    }
    expect(errors, 'clothing paint fixtures must render without browser errors').toEqual([]);
  });
}
