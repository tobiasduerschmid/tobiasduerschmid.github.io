// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, '_includes/se-gym-hero.svg'), 'utf8')
  .replace(/^\{% assign[^\n]+\n/, '')
  .replace(/\{% if include.ready %\}.*?\{% endif %\}/g, '')
  .replace(/\{\{\s*hero_variant\s*\}\}/g, 'bruin-strength-fixture');

test.use({ reducedMotion: 'reduce' });

test('Bruin arms grow with earned strength, interpolate between levels, and return to their original size', async ({ page }) => {
  await page.setContent(`<html lang="en"><head><title>Bruin strength</title></head><body>${template}</body></html>`);
  await page.addScriptTag({ path: path.join(root, 'js/se-gym-hero-avatar.js') });
  const result = await page.locator('[data-gym-hero-svg]').evaluate((svg) => {
    svg.style.cssText = 'display:block;width:640px;height:665px;opacity:1;visibility:visible';
    const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
    avatar.kind = 'bruin';
    avatar.appearance.skin = window.HeroAvatar.BRUIN_DEFAULTS.skin;
    window.HeroAvatar.applyToSvg(svg, avatar);
    svg.pauseAnimations();
    svg.setCurrentTime(1.21);
    function sample(tier, strength) {
      window.HeroAvatar.applyMilestoneToSvg(svg, tier, strength);
      // Measure each painted limb in its own coordinates: screen bounds also
      // include the lift angle, and an upper-arm group contains its forearm.
      const widths = ['left', 'right'].flatMap(side => [
        svg.querySelector(`[data-hero-bruin-arm="${side}"] > use`).getBBox().width,
        svg.querySelector(`[data-hero-bruin-forearm="${side}"] > use`).getBBox().width,
      ]);
      const bounds = selector => {
        const box = svg.querySelector(selector).getBoundingClientRect();
        return [box.x, box.y, box.width, box.height];
      };
      return { widths, paws: bounds('[data-hero-slot="mascot-paws"]'), feet: bounds('[data-hero-bruin-anatomy="feet"]') };
    }
    const tiers = ['none', 'bronze', 'silver', 'gold', 'diamond', 'infinity'].map(tier => sample(tier));
    const intermediate = [41, 50, 59].map(strength => sample('silver', strength));
    const equivalent = sample('none', 50);
    const restored = sample('none');
    return { tiers, intermediate, equivalent, restored };
  });
  const first = result.tiers[0];
  for (let tier = 1; tier < result.tiers.length; tier++) {
    for (let region = 0; region < first.widths.length; region++) {
      expect(result.tiers[tier].widths[region], 'each level visibly strengthens both arms and forearms')
        .toBeGreaterThan(result.tiers[tier - 1].widths[region]);
    }
    expect(result.tiers[tier].paws, 'growth must not move the grip').toEqual(first.paws);
    expect(result.tiers[tier].feet, 'growth must not move the planted feet').toEqual(first.feet);
  }
  for (let region = 0; region < first.widths.length; region++) {
    expect(result.tiers[5].widths[region], 'maximum strength must have noticeable volume').toBeGreaterThan(first.widths[region] * 1.2);
    const between = [result.tiers[2], ...result.intermediate, result.tiers[3]];
    for (let i = 1; i < between.length; i++) expect(between[i].widths[region]).toBeGreaterThan(between[i - 1].widths[region]);
  }
  expect(result.equivalent.widths, 'earned strength controls muscles independently of rank decorations').toEqual(result.intermediate[1].widths);
  expect(result.restored, 'rerendering must not accumulate muscle deformation').toEqual(first);
});
