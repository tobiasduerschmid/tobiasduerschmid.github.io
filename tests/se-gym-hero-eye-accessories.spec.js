// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const portraitTemplate = fs.readFileSync(path.join(projectRoot, '_includes/se-gym-hero.svg'), 'utf8')
  .replace(/^\{% assign[^\n]+\n/, '')
  .replace(/\{% if include.ready %\}.*?\{% endif %\}/g, '')
  .replace(/\{\{\s*hero_variant\s*\}\}/g, 'eye-accessory-fixture');
const hats = ['beanie', 'baseball-cap', 'bucket-hat', 'embroidered-prayer-cap'];

test.use({ reducedMotion: 'reduce' });

async function openPortrait(page) {
  await page.setContent(`<html lang="en"><head><title>Eye accessory fit fixture</title></head><body>${portraitTemplate}</body></html>`);
  await page.addScriptTag({ path: path.join(projectRoot, 'js/se-gym-hero-avatar.js') });
  await page.evaluate(() => {
    const svg = document.querySelector('[data-gym-hero-svg]');
    svg.querySelectorAll('animate, animateTransform, animateMotion, set').forEach(node => node.remove());
    svg.setAttribute('data-testid', 'eye-accessory-fixture');
    svg.style.cssText = 'display:block;width:800px;height:820px;opacity:1;visibility:visible';
  });
  return page.getByTestId('eye-accessory-fixture');
}

// Clone actual painted geometry into one portrait frame. This oracle does not
// depend on the fitting algorithm, correction matrices, or authored contours.
async function inspectEyeAccessoryPaint(svg, { accessory, eyeShape, headStyle, tuning }) {
  const tune = value => ({ vertical: value, spread: value, width: value, height: value });
  const avatar = structuredClone(window.HeroAvatar.DEFAULTS);
  Object.assign(avatar.appearance, { eyeShape, headStyle, hairStyle: 'long-center-part',
    skin: tuning > 0 ? '#291713' : '#f4d0c4', hairColor: tuning > 0 ? '#eee7dd' : '#25190f' });
  avatar.outfit.accessories = [accessory];
  avatar.outfit.accessory = accessory;
  avatar.fineTune.eyes = tune(tuning);
  avatar.fineTune.hair = tune(tuning);
  avatar.fineTune.accessories = tune(-tuning);
  avatar.fineTune.head = tune(headStyle === 'narrow' ? -20 : headStyle === 'broad' ? 20 : 0);
  document.documentElement.classList.toggle('dark-mode', tuning > 0);
  window.HeroAvatar.applyToSvg(svg, avatar);

  const namespace = 'http://www.w3.org/2000/svg';
  const eyes = [...svg.querySelectorAll('[data-hero-slot="eye-shape"][display="inline"] [data-hero-eye-surface]')];
  const wearable = svg.querySelector(`[data-hero-slot="accessory"][data-hero-option="${accessory}"]`);
  const cover = wearable.querySelector('[data-hero-eye-cover]');
  const matrixText = matrix => `matrix(${[matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].join(',')})`;
  const size = 600;

  async function paintMask(nodes) {
    const imageSvg = document.createElementNS(namespace, 'svg');
    imageSvg.setAttribute('xmlns', namespace);
    imageSvg.setAttribute('viewBox', '250 20 300 300');
    imageSvg.setAttribute('width', String(size));
    imageSvg.setAttribute('height', String(size));
    for (const original of nodes) {
      const wrapper = document.createElementNS(namespace, 'g');
      wrapper.setAttribute('transform', matrixText(svg.getScreenCTM().inverse().multiply(original.parentElement.getScreenCTM())));
      const copy = original.cloneNode(true);
      const originals = [original, ...original.querySelectorAll('*')];
      const copies = [copy, ...copy.querySelectorAll('*')];
      originals.forEach((node, index) => {
        const style = getComputedStyle(node);
        copies[index].style.setProperty('fill', style.fill === 'none' ? 'none' : 'white');
        copies[index].style.setProperty('stroke', style.stroke === 'none' ? 'none' : 'white');
        for (const property of ['opacity', 'fill-opacity', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'display', 'visibility']) {
          copies[index].style.setProperty(property, style.getPropertyValue(property));
        }
      });
      wrapper.appendChild(copy);
      imageSvg.appendChild(wrapper);
    }
    const image = new Image();
    image.src = 'data:image/svg+xml;base64,' + btoa(new XMLSerializer().serializeToString(imageSvg));
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, size, size).data;
  }

  const accessoryPaint = await paintMask([wearable]);
  const coverPaint = cover ? await paintMask([cover]) : accessoryPaint;
  const eyeResults = [];
  for (const eye of eyes) {
    const eyePaint = await paintMask([eye]);
    let area = 0;
    let covered = 0;
    let accessoryOverlap = 0;
    for (let pixel = 3; pixel < eyePaint.length; pixel += 4) {
      if (eyePaint[pixel] < 192) continue;
      area++;
      if (coverPaint[pixel] >= 192) covered++;
      if (accessoryPaint[pixel] >= 192) accessoryOverlap++;
    }
    eyeResults.push({ side: eye.getAttribute('data-hero-eye-surface'), area, covered, accessoryOverlap });
  }
  let accessoryArea = 0;
  let strapArea = 0;
  let coverStart = -1;
  for (let pixel = 3; pixel < accessoryPaint.length; pixel += 4) {
    if (accessoryPaint[pixel] < 192) continue;
    accessoryArea++;
    if (coverPaint[pixel] < 128) strapArea++;
    else coverStart = (pixel - 3) / 4;
  }
  let connectedArea = 0;
  if (cover && coverStart >= 0) {
    const visited = new Set([coverStart]);
    const connected = [coverStart];
    for (let index = 0; index < connected.length; index++) {
      const pixel = connected[index];
      for (const neighbor of [pixel - 1, pixel + 1, pixel - size, pixel + size]) {
        if (neighbor < 0 || neighbor >= size * size || visited.has(neighbor) || accessoryPaint[neighbor * 4 + 3] < 192) continue;
        visited.add(neighbor);
        connected.push(neighbor);
      }
    }
    connectedArea = connected.length;
  }
  return { accessoryArea, strapArea, connectedArea, eyes: eyeResults };
}

for (const accessory of [...hats, 'eyepatch']) {
  for (const tuning of [-20, 0, 20]) {
    test(`${accessory} preserves its eye relationship at eye tuning ${tuning}`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      const portrait = await openPortrait(page);
      const eyeShapes = await page.evaluate(() => window.HeroAvatar.ENUMS.eyeShape);
      for (const headStyle of ['narrow', 'default', 'broad']) {
        for (const eyeShape of eyeShapes) {
          const label = `${accessory}/${eyeShape}/${headStyle}/eyes=${tuning}/accessory=${-tuning}`;
          const paint = await portrait.evaluate(inspectEyeAccessoryPaint, { accessory, eyeShape, headStyle, tuning });
          expect(paint.accessoryArea, `${label}: the selected accessory remains painted`).toBeGreaterThan(100);
          expect(paint.eyes, `${label}: both eyes remain available to render`).toHaveLength(2);
          if (accessory === 'eyepatch') {
            expect(paint.strapArea, `${label}: the strap remains painted beyond the cover`).toBeGreaterThan(20);
            expect(paint.connectedArea / paint.accessoryArea, `${label}: the strap stays connected to the cover`).toBeGreaterThanOrEqual(0.995);
          }
          for (const eye of paint.eyes) {
            expect(eye.area, `${label}/${eye.side}: the eye has positive paint`).toBeGreaterThan(30);
            if (accessory === 'eyepatch') {
              if (eye.side === 'left') expect(eye.covered / eye.area, `${label}: the patch covers its entire intended eye`).toBeGreaterThanOrEqual(0.997);
              else expect(eye.accessoryOverlap / eye.area, `${label}: the complete eyepatch leaves the other eye visible`).toBeLessThanOrEqual(0.003);
            } else {
              expect(eye.covered / eye.area, `${label}/${eye.side}: opaque hats leave the eyes visible`).toBeLessThanOrEqual(0.003);
            }
          }
        }
      }
      expect(errors).toEqual([]);
    });
  }
}
