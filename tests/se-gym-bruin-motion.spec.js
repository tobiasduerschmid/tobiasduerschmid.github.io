// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, '_includes/se-gym-hero.svg'), 'utf8')
  .replace(/^\{% assign[^\n]+\n/, '')
  .replace(/\{% if include.ready %\}.*?\{% endif %\}/g, '')
  .replace(/\{\{\s*hero_variant\s*\}\}/g, 'bruin-motion-fixture');

test.use({ reducedMotion: 'no-preference' });

test('Bruin keeps both hind paws planted throughout its overhead lift', async ({ page }) => {
  // The illustration's anatomy hooks identify visible regions without pinning
  // paths, wrappers, easing curves, joint angles, or animation implementation.
  await page.setContent(`<html lang="en"><head><title>Bruin motion</title></head><body>${template}</body></html>`);
  await page.addScriptTag({ path: path.join(root, 'js/se-gym-hero-avatar.js') });
  const movement = await page.locator('[data-gym-hero-svg]').evaluate((svg) => {
    svg.style.cssText = 'display:block;width:640px;height:665px;opacity:1;visibility:visible';
    const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
    avatar.kind = 'bruin';
    avatar.appearance.skin = window.HeroAvatar.BRUIN_DEFAULTS.skin;
    window.HeroAvatar.applyToSvg(svg, avatar);
    svg.pauseAnimations();
    const samples = [];
    for (let frame = 0; frame <= 48; frame++) {
      svg.setCurrentTime(frame * 13.2 / 48);
      const feet = svg.querySelector('[data-hero-bruin-anatomy="feet"]').getBoundingClientRect();
      const bar = svg.querySelector('[data-hero-barbell]').getBoundingClientRect();
      samples.push({ feetX: feet.x, feetY: feet.bottom, barY: bar.y });
    }
    const range = key => Math.max(...samples.map(frame => frame[key])) - Math.min(...samples.map(frame => frame[key]));
    return { feetX: range('feetX'), feetY: range('feetY'), barY: range('barY') };
  });
  expect(movement.barY, 'the barbell must actually lift during the sampled interval').toBeGreaterThan(20);
  expect(movement.feetX, 'hind paws must not slide sideways').toBeLessThan(.25);
  expect(movement.feetY, 'hind paws must not float above the floor').toBeLessThan(.25);
});
