// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, '_includes/se-gym-hero.svg'), 'utf8')
  .replace(/^\{% assign[^\n]+\n/, '')
  .replace(/\{% if include.ready %\}.*?\{% endif %\}/g, '')
  .replace(/\{\{\s*hero_variant\s*\}\}/g, 'optical-clarity');
const clearEyewear = [
  'glasses', 'rectangular-glasses', 'thin-rectangular-glasses', 'semi-rimless-glasses',
  'wireframe-glasses', 'round-rim-glasses', 'safety-goggles', 'spectacles', 'monocle',
];
const faces = [
  { skin: '#f4d7b5', eyeShape: 'round', headStyle: 'default' },
  { skin: '#9b6042', eyeShape: 'single-eyelid', headStyle: 'broad' },
  { skin: '#35241f', eyeShape: 'almond', headStyle: 'long-tapered-jaw' },
];

test.use({ deviceScaleFactor: 1, reducedMotion: 'no-preference' });

async function openPortrait(page, background) {
  await page.setContent(`<html lang="en"><head><title>Small hero readability</title></head><body>${template}</body></html>`);
  await page.addScriptTag({ path: path.join(root, 'js/se-gym-hero-avatar.js') });
  await page.evaluate(background => {
    document.body.style.cssText = `margin:0;background:${background}`;
    const svg = document.querySelector('[data-gym-hero-svg]');
    svg.querySelectorAll('animate, animateTransform, animateMotion, set').forEach(node => node.remove());
    svg.setAttribute('data-testid', 'optical-portrait');
    svg.setAttribute('viewBox', '330 100 140 160');
    svg.style.cssText = 'display:block;opacity:1;visibility:visible';
  }, background);
  return page.getByTestId('optical-portrait');
}

async function posePortrait(portrait, face, width, turn, eyewear) {
  return portrait.evaluate((svg, { face, width, turn, eyewear }) => {
    const state = structuredClone(window.HeroAvatar.DEFAULTS);
    Object.assign(state.appearance, face, { hairStyle: 'short', facialHair: 'none', eyeColor: '#4b3025' });
    state.outfit.accessories = eyewear ? [eyewear] : [];
    window.HeroAvatar.applyToSvg(svg, state);
    window.HeroAvatar.setHeadTurn(svg, turn);
    svg.style.width = `${width}px`;
    svg.style.height = `${width * 160 / 140}px`;
    // Semantic eye apertures give the same anatomical sampling region after
    // head fitting and turns. No assumption about a pupil's SVG construction.
    const bounds = svg.getBoundingClientRect();
    return Array.from(svg.querySelectorAll('[data-hero-slot="eye-shape"][display="inline"] [data-hero-eye-surface]'), eye => {
      const box = eye.getBoundingClientRect(), inverse = eye.getScreenCTM().inverse();
      const pixels = [];
      for (let y = Math.ceil(box.top); y < Math.floor(box.bottom); y++) {
        for (let x = Math.ceil(box.left); x < Math.floor(box.right); x++) {
          // Keep whole pixels inside the aperture, excluding antialiased skin
          // edges. The remaining pixels contain sclera, iris and pupil.
          if ([[-.45, -.45], [.45, -.45], [-.45, .45], [.45, .45]].every(([dx, dy]) =>
            eye.isPointInFill(new DOMPoint(x + .5 + dx, y + .5 + dy).matrixTransform(inverse)))) {
            pixels.push([x - Math.floor(bounds.x), y - Math.floor(bounds.y)]);
          }
        }
      }
      return pixels;
    });
  }, { face, width, turn, eyewear });
}

async function eyeContrast(page, portrait, pixels) {
  const png = await portrait.screenshot({ scale: 'css' });
  return page.evaluate(async ({ png, pixels }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const linear = channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    return pixels.map(eye => {
      const luminances = eye.map(([x, y]) => {
        const index = (y * canvas.width + x) * 4;
        return .2126 * linear(rgba[index] / 255) + .7152 * linear(rgba[index + 1] / 255) + .0722 * linear(rgba[index + 2] / 255);
      }).sort((a, b) => a - b);
      // Quantiles tolerate the small catchlight and changes in iris texture;
      // this tests the eye's visible dark/light separation, not exact pixels.
      const dark = luminances[Math.floor(luminances.length * .15)];
      const light = luminances[Math.floor(luminances.length * .8)];
      return { pixels: eye.length, contrast: (light + .05) / (dark + .05) };
    });
  }, { png: png.toString('base64'), pixels });
}

for (const background of ['#ffffff', '#1c3a4e']) {
  for (const face of faces) {
    test(`clear lenses preserve small-eye definition on ${face.skin} against ${background}`, async ({ page }) => {
      const portrait = await openPortrait(page, background);
      // Approximately 60/160 CSS-pixel faces: small cast and enlarged portrait.
      for (const width of [84, 224]) {
        for (const turn of [-1, 1]) {
          const pixels = await posePortrait(portrait, face, width, turn, null);
          const bare = await eyeContrast(page, portrait, pixels);
          expect(bare).toHaveLength(2);
          for (const eye of bare) {
            expect(eye.pixels).toBeGreaterThan(12);
            expect(eye.contrast, 'the bare eye must itself have readable dark/light separation').toBeGreaterThan(3);
          }
          for (const eyewear of clearEyewear) {
            const coveredPixels = await posePortrait(portrait, face, width, turn, eyewear);
            await expect(portrait.locator(`[data-hero-slot="accessory"][data-hero-option="${eyewear}"]`)).toBeVisible();
            const covered = await eyeContrast(page, portrait, coveredPixels);
            for (let index = 0; index < 2; index++) {
              expect(covered[index].contrast / bare[index].contrast,
                `${eyewear}, width=${width}, turn=${turn}, eye=${index}: clear lenses must preserve at least 80% of eye contrast`)
                .toBeGreaterThanOrEqual(.8);
            }
          }
        }
      }
    });
  }
}

test('tinted visors keep their filtering effect instead of becoming clear lenses', async ({ page }) => {
  const portrait = await openPortrait(page, '#1c3a4e');
  for (const face of faces) {
    const pixels = await posePortrait(portrait, face, 84, 0, null);
    const bare = await eyeContrast(page, portrait, pixels);
    for (const visor of ['visor', 'tech-visor']) {
      const coveredPixels = await posePortrait(portrait, face, 84, 0, visor);
      const covered = await eyeContrast(page, portrait, coveredPixels);
      for (let index = 0; index < 2; index++) {
        expect(covered[index].contrast / bare[index].contrast,
          `${visor} on ${face.skin}, eye=${index}: tinted shields must visibly filter the eyes`)
          .toBeLessThan(.7);
      }
    }
  }
});
