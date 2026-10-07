// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, '_includes/se-gym-hero.svg'), 'utf8')
  .replace(/^\{% assign[^\n]+\n/, '')
  .replace(/\{% if include.ready %\}.*?\{% endif %\}/g, '')
  .replace(/\{\{\s*hero_variant\s*\}\}/g, 'eyewear-fit-fixture');

test.use({ reducedMotion: 'reduce' });

for (const accessory of ['glasses', 'rectangular-glasses', 'thin-rectangular-glasses',
  'semi-rimless-glasses', 'wireframe-glasses', 'round-rim-glasses', 'spectacles', 'safety-goggles', 'monocle',
  'visor', 'tech-visor', 'mask']) {
  test(`${accessory} keeps the eyes inside its optical surfaces under independent proportion changes`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<html lang="en"><head><title>Eyewear fit fixture</title></head><body>${template}</body></html>`);
    await page.addScriptTag({ path: path.join(root, 'js/se-gym-hero-avatar.js') });
    const result = await page.evaluate(accessory => {
      const svg = document.querySelector('[data-gym-hero-svg]');
      svg.querySelectorAll('animate, animateTransform, animateMotion, set').forEach(node => node.remove());
      svg.style.cssText = 'display:block;width:800px;height:820px;opacity:1;visibility:visible';
      const tune = value => ({ vertical: value, width: value, height: value, spread: value });
      const failures = [];
      let checked = 0;
      for (const headStyle of ['narrow', 'broad', 'compact-round', 'long-tapered-jaw']) {
        for (const eyeShape of window.HeroAvatar.ENUMS.eyeShape) {
          for (const boundary of [-20, 0, 20]) {
            const state = structuredClone(window.HeroAvatar.DEFAULTS);
            Object.assign(state.appearance, { headStyle, eyeShape });
            state.outfit.accessory = accessory;
            state.outfit.accessories = [accessory];
            state.fineTune.head = { ...tune(boundary), height: -boundary };
            state.fineTune.eyes = tune(-boundary);
            state.fineTune.accessories = tune(boundary);
            window.HeroAvatar.applyToSvg(svg, state);
            const eyewear = svg.querySelector(`[data-hero-slot="accessory"][data-hero-option="${accessory}"]`);
            const eyes = svg.querySelector('[data-hero-slot="eye-shape"][display="inline"]');
            const lenses = [...eyewear.querySelectorAll('[data-hero-lens], [data-hero-eye-opening]')];
            if (!lenses.length) throw new Error(`${accessory} has no optical surface`);
            for (const eye of eyes.querySelectorAll('[data-hero-eye-surface]')) {
              const side = eye.getAttribute('data-hero-eye-surface');
              if (accessory === 'monocle' && side === 'left') continue;
              const box = eye.getBBox();
              const center = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2)
                .matrixTransform(eye.getScreenCTM());
              // Optical surfaces are the measured artwork contract. Test
              // visible eye placement, without pinning a fitting transform.
              const contained = lenses.some(lens => {
                const target = lens.getAttribute('data-hero-lens') || lens.getAttribute('data-hero-eye-opening');
                return (target === side || target === 'both')
                  && lens.isPointInFill(center.matrixTransform(lens.getScreenCTM().inverse()));
              });
              if (!contained) failures.push({ headStyle, eyeShape, boundary, side });
              const maskShell = eyewear.querySelector('[data-hero-mask-shell]');
              if (maskShell && maskShell.isPointInFill(center.matrixTransform(maskShell.getScreenCTM().inverse()))) {
                failures.push({ headStyle, eyeShape, boundary, side, opaqueMaskCoversEye: true });
              }
              checked++;
            }
          }
        }
      }
      return { checked, failures };
    }, accessory);
    expect(result.checked, 'the rendered eye/lens relationship must be measured').toBeGreaterThan(100);
    expect(result.failures, 'eyes must stay visible through the selected optical surfaces').toEqual([]);
    expect(errors).toEqual([]);
  });
}
