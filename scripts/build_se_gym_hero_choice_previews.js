// @ts-check
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const HERO_INCLUDE = path.join(ROOT, '_includes', 'se-gym-hero.svg');
const HERO_RUNTIME = path.join(ROOT, 'js', 'se-gym-hero-avatar.js');
const OUT_DIR = path.join(ROOT, 'assets', 'se-gym-hero-choice-previews');
const VARIANT = 'choice-preview';

function renderedHeroInclude() {
  return fs.readFileSync(HERO_INCLUDE, 'utf8')
    .replace(/^\{% assign hero_variant = include\.variant \| default: "main" %\}\s*/, '')
    .replace(/\{\{\s*hero_variant\s*\}\}/g, VARIANT);
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function slug(value) {
  return String(value).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

async function main() {
  cleanDir(OUT_DIR);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>SE Gym Hero Choice Preview Build</title></head>
      <body><div id="source">${renderedHeroInclude()}</div></body>
    </html>`);
  await page.addScriptTag({ path: HERO_RUNTIME });
  await page.waitForFunction(() => window.HeroAvatar && window.HeroAvatar.CHOICE_SETS);

  const previews = await page.evaluate(() => {
    const source = document.querySelector('#source [data-gym-hero-svg]');
    if (!source) throw new Error('Missing source hero SVG');

    const PREVIEW_VIEWBOXES = {
      full: '238 34 324 596',
      hair: '292 54 216 278',
      eyebrows: '352 138 96 78',
      eyes: '352 154 96 78',
      nose: '370 178 60 50',
      mouth: '360 202 80 66',
      cheeks: '342 178 116 94',
      'head-shape': '326 92 148 184',
      'facial-hair': '344 184 112 92',
      'face-detail': '350 178 100 82',
      body: '270 228 260 340',
      outfit: '286 226 228 294',
      face: '346 138 108 118',
      head: '318 78 164 208',
      upper: '246 86 308 374',
    };
    const SOURCE_BOX = '50 -20 700 665';

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function setPathValue(obj, path, value) {
      let cursor = obj;
      for (let i = 0; i < path.length - 1; i++) {
        if (!cursor[path[i]]) cursor[path[i]] = {};
        cursor = cursor[path[i]];
      }
      cursor[path[path.length - 1]] = value;
    }

    function representativeState(definition, optionValue) {
      const state = clone(window.HeroAvatar.DEFAULTS);
      if (definition.key === 'bodyType' || definition.key === 'outfitStyle') {
        state.appearance.hairStyle = 'short';
      }
      setPathValue(state, definition.path, optionValue);
      if (definition.key === 'heroKind' && optionValue === 'bruin') {
        const bruin = window.HeroAvatar.BRUIN_DEFAULTS;
        state.appearance.skin = bruin.skin;
        state.appearance.hairColor = bruin.hairColor;
        state.appearance.hairStyle = 'bald';
        state.appearance.eyeColor = bruin.eyeColor;
        state.appearance.facialHair = 'none';
        state.appearance.faceFeature = 'none';
        state.body.type = bruin.bodyType;
        state.outfit.style = bruin.outfitStyle;
        state.outfit.accessory = 'none';
        state.outfit.accessories = [];
      }
      return window.HeroAvatar.normalizeAvatar(state);
    }

    function parseBox(value) {
      const parts = String(value || '').trim().split(/\s+/).map(Number);
      if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return null;
      return {
        x: parts[0],
        y: parts[1],
        width: parts[2],
        height: parts[3],
        right: parts[0] + parts[2],
        bottom: parts[1] + parts[3],
      };
    }

    function formatBox(box) {
      const clean = (value) => {
        const rounded = Math.round(value * 10) / 10;
        return String(Math.abs(rounded) < 0.05 ? 0 : rounded);
      };
      return [clean(box.x), clean(box.y), clean(box.width), clean(box.height)].join(' ');
    }

    function unionBox(a, b) {
      if (!a) return b;
      if (!b) return a;
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const right = Math.max(a.right, b.right);
      const bottom = Math.max(a.bottom, b.bottom);
      return { x, y, width: right - x, height: bottom - y, right, bottom };
    }

    function isVisible(node) {
      let cursor = node;
      while (cursor && cursor.nodeType === 1) {
        if (cursor.getAttribute('display') === 'none' || cursor.style.display === 'none') return false;
        cursor = cursor.parentElement;
      }
      return true;
    }

    function selectorBox(svg, selector) {
      let box = null;
      for (const node of Array.from(svg.querySelectorAll(selector))) {
        if (!isVisible(node)) continue;
        try {
          const bbox = node.getBBox();
          if (!bbox || bbox.width <= 0 || bbox.height <= 0) continue;
          box = unionBox(box, {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height,
            right: bbox.x + bbox.width,
            bottom: bbox.y + bbox.height,
          });
        } catch (e) {
          // Some hidden SVG nodes do not expose bounding boxes.
        }
      }
      return box;
    }

    function clampBox(box, bounds) {
      if (!box || !bounds) return box;
      const x = Math.max(bounds.x, box.x);
      const y = Math.max(bounds.y, box.y);
      const right = Math.min(bounds.right, box.right);
      const bottom = Math.min(bounds.bottom, box.bottom);
      return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y, right, bottom } : box;
    }

    function previewViewBox(svg, definition, optionValue) {
      const base = parseBox(PREVIEW_VIEWBOXES[definition.preview] || PREVIEW_VIEWBOXES.full);
      const selectors = [];
      if (definition.key === 'heroKind') {
        selectors.push(`[data-hero-kind-layer="${optionValue}"]`);
      } else if (definition.key === 'hairStyle') {
        selectors.push(`[data-hero-slot="hair"][data-hero-option="${optionValue}"]`);
        selectors.push(`[data-hero-slot="hairline"][data-hero-option="${optionValue}"]`);
        selectors.push(`[data-hero-slot="hair-root"][data-hero-option="${optionValue}"]`);
      } else if (definition.key === 'eyebrowStyle') {
        selectors.push(`[data-hero-slot="eyebrow"][data-hero-option="${optionValue}"]`);
      } else if (definition.key === 'eyeShape') {
        selectors.push(`[data-hero-slot="eye-shape"][data-hero-option="${optionValue}"]`);
      } else if (definition.key === 'noseShape') {
        selectors.push(`[data-hero-slot="nose-shape"][data-hero-option="${optionValue}"]`);
      } else if (definition.key === 'mouthStyle') {
        selectors.push(`[data-hero-slot="mouth-style"][data-hero-option="${optionValue}"]`);
      } else if (definition.key === 'headStyle') {
        selectors.push(`[data-hero-slot="head-shape"][data-hero-option="${optionValue}"]`);
        selectors.push(`[data-hero-slot="head-features"][data-hero-option="${optionValue}"]`);
      } else if (definition.key === 'facialHair') {
        selectors.push(`[data-hero-slot="facial-hair"][data-hero-option="${optionValue}"]`);
      } else if (definition.key === 'faceFeature') {
        selectors.push(`[data-hero-slot="face-feature"][data-hero-option="${optionValue}"]`);
      } else if (definition.key === 'bodyType') {
        selectors.push('[data-hero-slot="body-shape"][display="inline"]');
        selectors.push('[data-hero-slot="silhouette"][display="inline"]');
        selectors.push('[data-hero-default-torso]');
      } else if (definition.key === 'outfitStyle') {
        selectors.push(`[data-hero-slot="outfit-style"][data-hero-option="${optionValue}"]`);
      }

      let feature = null;
      for (const selector of selectors) feature = unionBox(feature, selectorBox(svg, selector));
      if (!feature) return formatBox(base);
      const padding = definition.key === 'hairStyle' ? 24 : 14;
      const expanded = unionBox(base, {
        x: feature.x - padding,
        y: feature.y - padding,
        width: feature.width + padding * 2,
        height: feature.height + padding * 2,
        right: feature.right + padding,
        bottom: feature.bottom + padding,
      });
      return formatBox(clampBox(expanded, parseBox(SOURCE_BOX)) || base);
    }

    function stripHidden(svg) {
      for (const node of Array.from(svg.querySelectorAll('[display="none"]'))) node.remove();
      for (const node of Array.from(svg.querySelectorAll('*'))) {
        if (node.style && node.style.display === 'none') node.remove();
      }
    }

    const previews = [];
    for (const [key, definition] of Object.entries(window.HeroAvatar.CHOICE_SETS)) {
      if (!definition.preview || definition.multiple) continue;
      definition.key = key;
      for (const group of definition.groups) {
        for (const option of group.options) {
          const svg = source.cloneNode(true);
          svg.querySelectorAll('animate, animateTransform').forEach((node) => node.remove());
          const state = representativeState(definition, option.value);
          window.HeroAvatar.applyToSvg(svg, state);
          svg.setAttribute('viewBox', previewViewBox(svg, definition, option.value));
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          svg.setAttribute('aria-hidden', 'true');
          svg.setAttribute('focusable', 'false');
          svg.removeAttribute('data-gym-hero-svg');
          svg.removeAttribute('id');
          stripHidden(svg);
          previews.push({
            key,
            value: option.value,
            label: option.label,
            viewBox: svg.getAttribute('viewBox'),
            svg: svg.outerHTML,
          });
        }
      }
    }
    return previews;
  });

  /** @type {Record<string, Record<string, string>>} */
  const assets = {};
  for (const preview of previews) {
    const file = `${slug(preview.key)}-${slug(preview.value)}.svg`;
    fs.writeFileSync(path.join(OUT_DIR, file), `${preview.svg}\n`);
    if (!assets[preview.key]) assets[preview.key] = {};
    assets[preview.key][preview.value] = file;
  }

  const manifest = [
    'window.SEGymHeroChoicePreviews = ',
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      count: previews.length,
      assets,
    }, null, 2),
    ';\n',
  ].join('');
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.js'), manifest);

  await browser.close();
  console.log(`Generated ${previews.length} SE Gym hero choice preview SVGs in ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
