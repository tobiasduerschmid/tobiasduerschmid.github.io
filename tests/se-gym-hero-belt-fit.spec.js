// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, '_includes/se-gym-hero.svg'), 'utf8')
  .replace(/^\{% assign[^\n]+\n/, '')
  .replace(/\{% if include.ready %\}.*?\{% endif %\}/g, '')
  .replace(/\{\{\s*hero_variant\s*\}\}/g, 'belt-fit-fixture');

test('The utility belt replaces the original belt and stays at the fitted waist', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent(`<html lang="en"><head><title>Belt fit fixture</title></head><body>${template}</body></html>`);
  await page.addScriptTag({ path: path.join(root, 'js/se-gym-hero-avatar.js') });
  const result = await page.evaluate(() => {
    const svg = document.querySelector('[data-gym-hero-svg]');
    svg.querySelectorAll('animate, animateTransform, animateMotion, set').forEach(node => node.remove());
    svg.style.cssText = 'display:block;width:800px;height:820px;opacity:1;visibility:visible';
    const tune = value => ({ vertical: value, width: value, height: value, spread: value });
    const failures = [];
    let checked = 0;
    for (const body of window.HeroAvatar.ENUMS.bodyType) {
      for (const boundary of [-20, 0, 20]) {
        const state = structuredClone(window.HeroAvatar.DEFAULTS);
        state.body.type = body;
        state.fineTune.body = tune(-boundary);
        state.fineTune.head = tune(boundary);
        state.fineTune.accessories = tune(boundary);
        state.outfit.accessories = [];
        state.outfit.accessory = 'none';
        window.HeroAvatar.applyToSvg(svg, state);
        const base = svg.querySelector('[data-hero-default-belt]');
        const waist = svg.querySelector('[data-hero-belt-band="default"]').getBoundingClientRect();
        if (!base.getClientRects().length) failures.push({ body, boundary, reason: 'original belt did not return' });
        const torso = svg.querySelector('[data-hero-slot="body-shape"][display="inline"]')
          || svg.querySelector('[data-hero-default-torso]');
        const surfaces = [...torso.querySelectorAll('path')].filter(path => path.getAttribute('fill') !== 'none');
        const torsoBounds = torso.getBoundingClientRect();
        const waistCenter = waist.y + waist.height / 2;
        const filled = [];
        for (let x = Math.floor(torsoBounds.left); x <= Math.ceil(torsoBounds.right); x++) {
          if (surfaces.some(path => path.isPointInFill(new DOMPoint(x, waistCenter)
            .matrixTransform(path.getScreenCTM().inverse())))) filled.push(x);
        }
        if (!filled.length) throw new Error(`${body}: belt does not cross the torso`);
        const torsoLeft = filled[0];
        const torsoRight = filled[filled.length - 1];
        if (Math.abs(waist.left - torsoLeft) > 5 || Math.abs(waist.right - torsoRight) > 5) {
          failures.push({ body, boundary, reason: 'primary belt overhangs or leaves the torso edges' });
        }
        state.outfit.accessories = ['utility-belt'];
        state.outfit.accessory = 'utility-belt';
        window.HeroAvatar.applyToSvg(svg, state);
        const belt = svg.querySelector('[data-hero-belt-band="utility"]').getBoundingClientRect();
        if (base.getClientRects().length) failures.push({ body, boundary, reason: 'two belts are painted' });
        if (belt.width < waist.width * .85 || belt.width > waist.width * 1.15
          || waistCenter < belt.top || waistCenter > belt.bottom) {
          failures.push({ body, boundary, reason: 'utility belt left the waist' });
        }
        checked++;
      }
    }
    return { checked, failures };
  });
  expect(result.checked, 'all supported body frames are exercised at the control boundaries').toBeGreaterThan(50);
  expect(result.failures).toEqual([]);
  expect(errors).toEqual([]);
});
