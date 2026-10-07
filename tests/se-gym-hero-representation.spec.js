// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { a11yCheckpoint, interactiveA11yEnabled } = require('./a11y-helpers');

const root = path.resolve(__dirname, '..');
const portrait = fs.readFileSync(path.join(root, '_includes/se-gym-hero.svg'), 'utf8')
  .replace(/\{%[\s\S]*?%\}/g, '')
  .replace(/\{\{\s*hero_variant\s*\}\}/g, 'representation-fixture');

test.use({ reducedMotion: 'reduce' });

async function openRenderer(page) {
  await page.setContent(`<html lang="en"><head><title>Avatar representation fixture</title></head><body>${portrait}</body></html>`);
  await page.addScriptTag({ path: path.join(root, 'js/se-gym-hero-avatar.js') });
  await page.evaluate(() => {
    document.querySelectorAll('animate, animateTransform, animateMotion, set').forEach(node => node.remove());
    document.querySelector('[data-gym-hero-svg]').setAttribute('viewBox', '285 65 230 220');
  });
}

test('Eyebrow and facial-hair paint can differ from scalp hair, then return to matching it', async ({ page }) => {
  await openRenderer(page);
  const results = await page.evaluate(() => {
    const api = window.HeroAvatar;
    const svg = document.querySelector('[data-gym-hero-svg]');
    const shapeSelector = 'path,circle,ellipse,rect,polygon,polyline,line,use';
    // Inspect resolved paint, including the gradient/pattern actually referenced
    // by a feature. This catches a defs paint server still using scalp color.
    function paint(slot) {
      const group = svg.querySelector(`[data-hero-slot="${slot}"][display="inline"]`);
      if (!group) return [];
      return [...group.querySelectorAll(shapeSelector)].map(node => {
        return ['fill', 'stroke'].map(property => {
          const value = getComputedStyle(node).getPropertyValue(property);
          const reference = value.match(/url\(["']?[^#]*#([^"')]+)/);
          if (!reference) return value;
          const server = document.getElementById(reference[1]);
          return [...server.querySelectorAll('stop,' + shapeSelector)].map(part => {
            const style = getComputedStyle(part);
            return [style.fill, style.stroke, style.stopColor];
          });
        });
      });
    }
    const samples = [];
    for (const skin of ['#f8dfcf', '#35241f']) {
      for (const facialHair of ['short-beard', 'full-beard', 'goatee', 'mustache', 'stubble']) {
        const state = structuredClone(api.DEFAULTS);
        Object.assign(state.appearance, { skin, facialHair, hairStyle: 'short', hairColor: '#66418c', eyebrowColor: '#3d2818', facialHairColor: '#b7bdc8' });
        api.applyToSvg(svg, state);
        const custom = { hair: paint('hair'), brows: paint('eyebrow'), beard: paint('facial-hair') };
        state.appearance.hairColor = '#b85a3a';
        api.applyToSvg(svg, state);
        const changedScalp = { hair: paint('hair'), brows: paint('eyebrow'), beard: paint('facial-hair') };
        state.appearance.eyebrowColor = null;
        state.appearance.facialHairColor = null;
        api.applyToSvg(svg, state);
        const matching = { brows: paint('eyebrow'), beard: paint('facial-hair') };
        state.appearance.hairColor = '#1f140c';
        api.applyToSvg(svg, state);
        samples.push({ skin, facialHair, custom, changedScalp, matching, changedMatch: { brows: paint('eyebrow'), beard: paint('facial-hair') } });
      }
    }
    return samples;
  });
  for (const sample of results) {
    const label = `${sample.skin}, ${sample.facialHair}`;
    expect(sample.custom.hair, label).not.toEqual(sample.changedScalp.hair);
    expect(sample.custom.brows, label).toEqual(sample.changedScalp.brows);
    expect(sample.custom.beard, label).toEqual(sample.changedScalp.beard);
    expect(sample.matching.brows, label).not.toEqual(sample.changedMatch.brows);
    expect(sample.matching.beard, label).not.toEqual(sample.changedMatch.beard);
  }
});

test('No eyebrows removes brow paint and unilateral hearing aids appear on the chosen anatomical side', async ({ page }) => {
  await openRenderer(page);
  const samples = await page.evaluate(() => {
    const api = window.HeroAvatar, svg = document.querySelector('[data-gym-hero-svg]');
    const samples = [];
    for (const headStyle of ['narrow', 'broad', 'long-tapered-jaw']) {
      for (const aid of ['hearing-aid-left', 'hearing-aid-right', 'hearing-aids']) {
        const state = structuredClone(api.DEFAULTS);
        Object.assign(state.appearance, { eyebrowStyle: 'none', hairStyle: 'bald', headStyle, earShape: 'prominent' });
        state.outfit.accessories = [aid, 'round-rim-glasses'];
        api.applyToSvg(svg, state);
        const head = svg.querySelector(`[data-hero-slot="head-shape"][data-hero-option="${headStyle}"]`).getBoundingClientRect();
        const group = svg.querySelector(`[data-hero-slot="accessory"][data-hero-option="${aid}"]`);
        const attachments = [...group.querySelectorAll('[data-hero-ear-attachment]')].map(part => {
          const box = part.getBoundingClientRect();
          return { painted: box.width > 0 && box.height > 0, side: box.x + box.width / 2 < head.x + head.width / 2 ? 'right' : 'left' };
        });
        const brow = svg.querySelector('[data-hero-slot="eyebrow"][display="inline"]').getBBox();
        samples.push({ aid, headStyle, attachments, browsVisible: brow.width > 0 && brow.height > 0, display: group.getAttribute('display') });
      }
    }
    return samples;
  });
  for (const sample of samples) {
    expect(sample.browsVisible).toBe(false);
    expect(sample.display).toBe('inline');
    expect(sample.attachments.every(part => part.painted)).toBe(true);
    expect(sample.attachments.map(part => part.side).sort()).toEqual(
      sample.aid === 'hearing-aids' ? ['left', 'right'] : [sample.aid.replace('hearing-aid-', '')]
    );
  }
});

test('Natural and dyed eyebrow colors remain visible as the chosen color on light and deep skin', async ({ page }) => {
  await openRenderer(page);
  const samples = await page.evaluate(() => {
    const api = window.HeroAvatar;
    const svg = document.querySelector('[data-gym-hero-svg]');
    const styles = [...svg.querySelectorAll('[data-hero-slot="eyebrow"]')]
      .map(group => group.getAttribute('data-hero-option')).filter(style => style !== 'none');
    const samples = [];
    for (const skin of ['#f8dfcf', '#35241f']) {
      for (const color of ['#1f140c', '#b7bdc8', '#66418c']) {
        for (const eyebrowStyle of styles) {
          const state = structuredClone(api.DEFAULTS);
          Object.assign(state.appearance, { skin, eyebrowStyle, eyebrowColor: color, hairColor: '#b85a3a' });
          api.applyToSvg(svg, state);
          const group = svg.querySelector(`[data-hero-slot="eyebrow"][data-hero-option="${eyebrowStyle}"]`);
          const paint = [...group.querySelectorAll('path')].flatMap(path => {
            const style = getComputedStyle(path);
            return [style.fill, style.stroke];
          });
          samples.push({ skin, color, eyebrowStyle, paint });
        }
      }
    }
    return samples;
  });
  for (const sample of samples) {
    const rgb = `rgb(${sample.color.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ')})`;
    expect(sample.paint, `${sample.skin}, ${sample.color}, ${sample.eyebrowStyle}`).toContain(rgb);
  }
});

test('Selecting a beard paints the lower face with a bun, long lashes and a nondefault jaw', async ({ page, context }) => {
  await context.addCookies([{ name: 'se-gym-active', value: 'true', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/se-gym/');
  await page.waitForFunction(() => Boolean(window.HeroAvatar));
  await page.evaluate(() => {
    const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
    Object.assign(avatar.appearance, {
      skin: '#f8dfcf', hairColor: '#1f140c', hairStyle: 'messy-bun',
      eyelashStyle: 'long-glam', headStyle: 'soft-square', facialHair: 'none'
    });
    window.HeroAvatar.saveAvatar(avatar);
  });
  await page.reload();
  await page.getByRole('button', { name: 'Customize Hero', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Customize your hero' });
  // The decorative preview has no accessible role. Its include's preview hook
  // identifies the actual artwork, separate from choice-button thumbnails.
  const preview = dialog.locator('.hero-cust-preview svg');
  async function lowerFacePaint() {
    return preview.evaluate(async svg => {
      const copy = svg.cloneNode(true);
      copy.querySelectorAll('animate, animateTransform, animateMotion, set').forEach(node => node.remove());
      copy.setAttribute('viewBox', '345 195 110 90');
      copy.setAttribute('width', '220');
      copy.setAttribute('height', '180');
      copy.style.cssText = svg.style.cssText + ';width:220px;height:180px;display:block;visibility:visible;opacity:1';
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 220;
      canvas.height = 180;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, 220, 180).data;
      return Array.from({ length: 220 * 180 }, (_, index) => pixels[index * 4] + pixels[index * 4 + 1] + pixels[index * 4 + 2]);
    });
  }
  const cleanFace = await lowerFacePaint();
  for (const label of ['Trimmed beard', 'Full beard']) {
    const choice = dialog.getByRole('button', { name: `Choose Facial hair: ${label}`, exact: true });
    await choice.click();
    await expect(choice).toHaveAttribute('aria-pressed', 'true');
    const beard = await lowerFacePaint();
    const darkerPixels = beard.filter((value, index) => cleanFace[index] - value > 90).length;
    // A selected tile alone cannot prove a beard is on the face. In Firefox,
    // a hidden reference-head box once inverted the beard into the hairline.
    expect(darkerPixels, `${label} must visibly cover part of the lower face`).toBeGreaterThan(400);
  }
});

test('Customizer saves, exports and imports separate hair colors and representation choices', async ({ page, context }) => {
  // This round trip mounts the complete choice catalog across saving, reload,
  // export and import; keep its budget separate from one-interaction tests.
  test.setTimeout(60_000);
  // Two axe passes traverse the complete customizer as well as this save/import flow.
  if (interactiveA11yEnabled('se-gym-hero-avatar')) test.slow();
  await context.addCookies([{ name: 'se-gym-active', value: 'true', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/se-gym/');
  await page.waitForFunction(() => Boolean(window.HeroAvatar));
  await page.evaluate(() => window.HeroAvatar.saveAvatar(structuredClone(window.HeroAvatar.DEFAULTS)));
  await page.reload();
  await page.getByRole('button', { name: 'Customize Hero', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Customize your hero' });
  await expect(modal).toBeVisible();
  const eyebrowMatch = modal.getByRole('checkbox', { name: 'Match hair color for eyebrows', exact: true });
  const beardMatch = modal.getByRole('checkbox', { name: 'Match hair color for facial hair', exact: true });
  await expect(eyebrowMatch).toBeChecked();
  await expect(beardMatch).toBeChecked();
  await eyebrowMatch.uncheck();
  await beardMatch.uncheck();
  await modal.getByRole('textbox', { name: 'Hex color for hair', exact: true }).fill('#66418C');
  await modal.getByRole('textbox', { name: 'Hex color for eyebrows', exact: true }).fill('#3D2818');
  await modal.getByRole('textbox', { name: 'Hex color for facial hair', exact: true }).fill('#B7BDC8');
  await a11yCheckpoint(page, 'Independent eyebrow and facial-hair color controls', { feature: 'se-gym-hero-avatar', darkMode: true });
  await modal.getByRole('button', { name: 'Choose Eyebrows: No eyebrows', exact: true }).click();
  await modal.getByRole('button', { name: 'Choose Facial hair: Full beard', exact: true }).click();
  await modal.getByRole('checkbox', { name: 'Right hearing aid', exact: true }).check();
  const downloadPromise = page.waitForEvent('download');
  await modal.getByRole('button', { name: 'Download', exact: true }).first().click();
  const download = await downloadPromise;
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(exported.appearance).toMatchObject({ hairColor: '#66418c', eyebrowColor: '#3d2818', facialHairColor: '#b7bdc8', eyebrowStyle: 'none', facialHair: 'full-beard' });
  expect(exported.outfit.accessories).toContain('hearing-aid-right');
  await modal.getByRole('button', { name: 'Save', exact: true }).first().click();
  await page.reload();
  await page.getByRole('button', { name: 'Customize Hero', exact: true }).click();
  await expect(modal.getByRole('textbox', { name: 'Hex color for eyebrows', exact: true })).toHaveValue('#3D2818');
  await expect(modal.getByRole('textbox', { name: 'Hex color for facial hair', exact: true })).toHaveValue('#B7BDC8');
  await expect(modal.getByRole('checkbox', { name: 'Right hearing aid', exact: true })).toBeChecked();
  await beardMatch.check();
  await expect(modal.getByRole('textbox', { name: 'Hex color for facial hair', exact: true })).toBeHidden();
  await modal.getByLabel('Upload hero avatar JSON', { exact: true }).setInputFiles({ name: 'avatar.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(beardMatch).not.toBeChecked();
  await expect(modal.getByRole('textbox', { name: 'Hex color for facial hair', exact: true })).toHaveValue('#B7BDC8');
});
