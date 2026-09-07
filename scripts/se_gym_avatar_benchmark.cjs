#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * Reproducible renderer benchmark, not an exhaustive visual-quality assertion.
 * Run: node scripts/se_gym_avatar_benchmark.cjs --limit 2000 --seed se-gym-art-2026
 * The only dependencies are Node built-ins and the repository's Playwright.
 * Sampling, browser measurements, and report generation have separate functions
 * so a new visual oracle does not change the corpus or its stable case IDs.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const FORMAT_VERSION = 1;
const OWNER = 'se-gym-avatar-benchmark';
const SOURCES = ['_includes/se-gym-hero.svg', 'js/se-gym-hero-avatar.js', 'css/se-gym.css', 'scripts/se_gym_avatar_benchmark.cjs', 'css/se-gym-avatar-benchmark.css'];
const TIERS = ['none', 'bronze', 'silver', 'gold', 'diamond', 'infinity'];
const TIMES = [0, 1.21, 2.2];
const THEMES = ['light', 'dark'];
const PALETTE_PATHS = {
  skin: ['appearance', 'skin'], hair: ['appearance', 'hairColor'], eye: ['appearance', 'eyeColor'],
  suit: ['outfit', 'suit'], cape: ['outfit', 'capeOuter'], capeInner: ['outfit', 'capeInner'],
};
const PAIRS = [
  ['headStyle', 'hairStyle'], ['headStyle', 'eyeShape'], ['headStyle', 'noseShape'],
  ['headStyle', 'mouthStyle'], ['headStyle', 'earShape'], ['headStyle', 'facialHair'],
  ['headStyle', 'faceFeature'], ['eyeShape', 'eyelashStyle'], ['eyebrowStyle', 'eyeShape'],
  ['mouthStyle', 'facialHair'], ['bodyType', 'outfitStyle'], ['hairStyle', 'accessory'],
  ['earShape', 'accessory'], ['outfitStyle', 'accessory'], ['faceFeature', 'skin'],
  ['hairStyle', 'skin'], ['facialHair', 'skin'],
];

function parseArguments(args) {
  const options = { limit: 2000, seed: 'se-gym-art-2026', out: path.join(ROOT, 'tmp', OWNER) };
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (name === '--help') return null;
    if (!['--limit', '--seed', '--out'].includes(name) || !args[index + 1]) {
      throw new Error(`Expected --limit NUMBER, --seed TEXT, or --out DIRECTORY; received ${name}`);
    }
    const value = args[++index];
    options[name.slice(2)] = name === '--limit' ? Number(value) : value;
  }
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 10000) {
    throw new Error('--limit must be an integer between 1 and 10000 unique avatar configurations.');
  }
  options.out = path.resolve(options.out);
  if (!options.seed.trim()) throw new Error('--seed must not be empty.');
  return options;
}

function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function getValue(object, keys) { return keys.reduce((value, key) => value[key], object); }
function setValue(object, keys, value) { getValue(object, keys.slice(0, -1))[keys.at(-1)] = value; }

function seededRandom(seed) {
  let state = parseInt(hash(seed).slice(0, 8), 16);
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function prepareOutput(out) {
  if (out === ROOT || ROOT.startsWith(`${out}${path.sep}`)) throw new Error('Output cannot be the project or its ancestor.');
  const marker = path.join(out, '.benchmark-owner.json');
  if (fs.existsSync(out)) {
    if (fs.lstatSync(out).isSymbolicLink()) throw new Error('Output directory must not be a symbolic link.');
    const contents = fs.readdirSync(out);
    if (contents.length && (!fs.existsSync(marker) || JSON.parse(fs.readFileSync(marker, 'utf8')).owner !== OWNER)) {
      throw new Error(`Refusing to overwrite an unowned output directory: ${out}`);
    }
  }
  fs.mkdirSync(out, { recursive: true });
  writeJson(marker, { owner: OWNER, formatVersion: FORMAT_VERSION });
  // Only these generated subdirectories are ours; unrelated output-root files stay intact.
  for (const name of ['images', 'sheets', 'states', 'sources']) {
    const directory = path.join(out, name);
    if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw new Error(`Refusing generated symlink: ${directory}`);
    fs.rmSync(directory, { recursive: true, force: true });
    fs.mkdirSync(directory);
  }
}

function captureSources(out) {
  return SOURCES.map(relative => {
    const contents = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    const snapshot = `sources/${path.basename(relative)}`;
    fs.writeFileSync(path.join(out, snapshot), contents);
    return { path: relative, sha256: hash(contents), snapshot, contents };
  });
}

function resolveSvgInclude(source) {
  const svg = source.replace(/^\s*\{% assign[^\n]+\n/, '')
    .replace(/\{% if include\.ready %\}.*?\{% endif %\}/g, '')
    .replace(/\{\{\s*hero_variant\s*\}\}/g, 'benchmark');
  if (/\{%|\{\{/.test(svg)) throw new Error('Source SVG contains unresolved Liquid; update the explicit include adapter.');
  return svg;
}

function randomAvatar(metadata, random) {
  const avatar = structuredClone(metadata.defaults);
  const pick = values => values[Math.floor(random() * values.length)];
  for (const [key, definition] of Object.entries(metadata.choices)) {
    if (key === 'heroKind' || key === 'accessory') continue;
    setValue(avatar, definition.path, pick(metadata.enums[key]));
  }
  for (const [key, keys] of Object.entries(PALETTE_PATHS)) setValue(avatar, keys, pick(metadata.palettes[key]));
  const accessories = random() < 0.4 ? [] : [pick(metadata.enums.accessory.filter(value => value !== 'none'))];
  if (accessories.length && random() < 0.25) accessories.push(pick(metadata.enums.accessory.filter(value => value !== 'none')));
  avatar.outfit.accessories = [...new Set(accessories)];
  avatar.outfit.accessory = avatar.outfit.accessories[0] || 'none';
  return avatar;
}

function choiceValue(avatar, key, metadata) {
  if (key === 'accessory') return avatar.outfit.accessory;
  return key === 'skin' ? avatar.appearance.skin.toLowerCase() : getValue(avatar, metadata.choices[key].path);
}

function pairKeys(avatar, metadata) {
  return PAIRS.map(([left, right]) => `${left}:${choiceValue(avatar, left, metadata)}|${right}:${choiceValue(avatar, right, metadata)}`);
}

function buildCorpus(metadata, options) {
  const random = seededRandom(options.seed);
  const cases = [];
  const seen = new Set();
  const coveredPairs = new Set();
  function add(avatar, stratum, focus, note) {
    const signature = JSON.stringify(avatar);
    if (seen.has(signature) || cases.length >= options.limit) return;
    seen.add(signature);
    pairKeys(avatar, metadata).forEach(pair => coveredPairs.add(pair));
    cases.push({ avatar, stratum, focus, note });
  }
  const replay = structuredClone(metadata.defaults);
  Object.assign(replay.appearance, { skin: '#35241f', hairStyle: 'locs', faceFeature: 'vitiligo' });
  add(replay, 'reported-example', 'faceFeature', 'Replay of supplied skin/hair/detail fields; unspecified fields use current defaults.');
  const clean = structuredClone(replay);
  clean.appearance.faceFeature = 'none';
  add(clean, 'reported-example', 'headStyle', 'Same complete avatar with optional skin detail removed for comparison.');

  for (const [key, values] of Object.entries(metadata.enums)) {
    for (const value of values) {
      const avatar = randomAvatar(metadata, random);
      avatar.outfit.accessories = []; avatar.outfit.accessory = 'none';
      if (key === 'accessory') {
        avatar.outfit.accessory = value;
        avatar.outfit.accessories = value === 'none' ? [] : [value];
      } else setValue(avatar, metadata.choices[key].path, value);
      add(avatar, `option-${key}`, key, `Registered ${metadata.choices[key].label}: ${value}`);
    }
  }
  for (const [key, colors] of Object.entries(metadata.palettes)) {
    for (const color of [...new Set(colors)]) {
      const avatar = randomAvatar(metadata, random);
      setValue(avatar, PALETTE_PATHS[key], color);
      add(avatar, `palette-${key}`, key === 'hair' ? 'hairStyle' : 'headStyle', `Registered ${key} swatch ${color}`);
    }
  }
  for (const target of metadata.fineTuneTargets) {
    for (const axis of ['vertical', 'spread', 'width', 'height']) {
      for (const value of [-20, 20]) {
        const avatar = randomAvatar(metadata, random);
        if (target.key === 'mascot') avatar.kind = 'bruin';
        avatar.fineTune[target.key][axis] = value;
        add(avatar, 'control-boundaries', 'headStyle', `${target.key}.${axis} = ${value}`);
      }
    }
  }
  for (const direction of [-1, 1]) {
    for (let index = 0; index < 16; index++) {
      const avatar = randomAvatar(metadata, random);
      for (const target of metadata.fineTuneTargets) {
        avatar.fineTune[target.key] = { vertical: direction * 20, spread: direction * 20, width: direction * 20, height: direction * 20 };
      }
      add(avatar, 'combined-boundaries', index % 2 ? 'hairStyle' : 'headStyle', `All controls at ${direction * 20}; supported stress case, not a demographic preset.`);
    }
  }
  for (const fur of ['#7a4e2f', '#8b5a35', '#6a4830', '#5c3a22', '#a06840', '#000000', '#ffffff']) {
    for (let index = 0; index < 3; index++) {
      const avatar = randomAvatar(metadata, random);
      avatar.kind = 'bruin'; avatar.appearance.skin = fur;
      add(avatar, 'mascot-palettes', 'heroKind', `Bruin fur ${fur}; human-only choices are retained in state and intentionally hidden.`);
    }
  }
  while (cases.length < options.limit) {
    let best, bestScore = -1;
    // Greedy best-of-24 sampling increases interaction coverage without claiming
    // a covering array: the largest pairs have more values than this budget.
    for (let candidate = 0; candidate < 24; candidate++) {
      const avatar = randomAvatar(metadata, random);
      if (random() < 0.3) {
        const target = metadata.fineTuneTargets[Math.floor(random() * metadata.fineTuneTargets.length)];
        avatar.fineTune[target.key] = { vertical: random() < 0.5 ? -20 : 20, spread: 0, width: random() < 0.5 ? -20 : 20, height: random() < 0.5 ? -20 : 20 };
      }
      const score = pairKeys(avatar, metadata).filter(pair => !coveredPairs.has(pair)).length;
      if (score > bestScore) { best = avatar; bestScore = score; }
    }
    const focus = ['hairStyle', 'headStyle', 'eyeShape', 'noseShape', 'mouthStyle', 'facialHair', 'faceFeature', 'accessory'][cases.length % 8];
    add(best, 'interaction-sample', focus, `Seeded candidate selected for ${bestScore} previously unobserved targeted trait pairs.`);
  }
  return cases;
}

function describeCoverage(cases, metadata) {
  const options = {};
  for (const [key, registered] of Object.entries(metadata.enums)) {
    const observed = new Set(cases.flatMap(entry => key === 'accessory'
      ? (entry.avatar.outfit.accessories.length ? entry.avatar.outfit.accessories : ['none'])
      : [choiceValue(entry.avatar, key, metadata)]));
    options[key] = { registered: registered.length, observed: registered.filter(value => observed.has(value)).length,
      missing: registered.filter(value => !observed.has(value)) };
  }
  const palettes = Object.fromEntries(Object.entries(metadata.palettes).map(([key, colors]) => {
    const registered = [...new Set(colors.map(color => color.toLowerCase()))];
    const observed = new Set(cases.map(entry => getValue(entry.avatar, PALETTE_PATHS[key]).toLowerCase()));
    return [key, { registered: registered.length, observed: registered.filter(color => observed.has(color)).length,
      missing: registered.filter(color => !observed.has(color)) }];
  }));
  const fineTuneBoundaries = Object.fromEntries(metadata.fineTuneTargets.map(target => [target.key,
    Object.fromEntries(['vertical', 'spread', 'width', 'height'].map(axis => [axis,
      [-20, 20].filter(value => cases.some(entry => entry.avatar.kind === (target.key === 'mascot' ? 'bruin' : 'human') && entry.avatar.fineTune[target.key][axis] === value)),
    ])),
  ]));
  const pairs = PAIRS.map(([left, right]) => {
    const domain = key => key === 'skin' ? metadata.palettes.skin : metadata.enums[key];
    const observed = new Set(cases.filter(entry => entry.avatar.kind === 'human').map(entry =>
      `${choiceValue(entry.avatar, left, metadata)}|${choiceValue(entry.avatar, right, metadata)}`));
    const possible = new Set(domain(left)).size * new Set(domain(right)).size;
    return { traits: [left, right], observed: observed.size, possible, fraction: observed.size / possible };
  });
  return { options, palettes, fineTuneBoundaries, targetedPairs: pairs, note: 'Requested canonical state coverage. Occluded/incompatible traits are reported separately by each renderer observation. Pair counts use human cases and the primary accessory.' };
}

function makeObservations(cases) {
  return cases.flatMap((entry, index) => {
    const contexts = index < 32 ? THEMES.flatMap(theme => TIMES.map(time => ({ theme, time })))
      : [{ theme: THEMES[index % 2], time: TIMES[index % 3] }];
    return contexts.map(({ theme, time }) => ({
      id: `${entry.id}-${theme}-t${String(time).replace('.', '_')}`,
      caseId: entry.id, theme, time, milestone: index < 2 ? 'none' : TIERS[index % TIERS.length],
      images: { thumbnail: `images/${entry.id}-${theme}-t${String(time).replace('.', '_')}-180.png`,
        full: `images/${entry.id}-${theme}-t${String(time).replace('.', '_')}-600.png` },
    }));
  });
}

async function createRenderer(browser, sources) {
  const page = await browser.newPage({ viewport: { width: 640, height: 690 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const messages = [];
  page.on('pageerror', error => messages.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => { if (message.type() === 'error') messages.push({ type: 'console', message: message.text() }); });
  await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Avatar benchmark renderer</title></head><body></body></html>');
  await page.addStyleTag({ content: sources[2].contents });
  await page.addScriptTag({ content: sources[1].contents });
  const template = resolveSvgInclude(sources[0].contents);
  await page.evaluate(svg => { document.body.innerHTML = svg; }, template);
  const metadata = await page.evaluate(() => ({
    defaults: window.HeroAvatar.DEFAULTS, enums: window.HeroAvatar.ENUMS, choices: window.HeroAvatar.CHOICE_SETS,
    palettes: window.HeroAvatar.PALETTES, fineTuneTargets: window.HeroAvatar.FINE_TUNE_TARGETS,
  }));
  await page.evaluate(installBrowserAudit);
  return { page, messages, metadata };
}

/** Browser-side adapter: use public renderer state plus documented art hooks. */
function installBrowserAudit() {
  const svg = document.querySelector('[data-gym-hero-svg]');
  const geometrySelector = 'path,ellipse,circle,rect,polygon,polyline,line,use,text';
  const slotByKey = {
    hairStyle: 'hair', headStyle: 'head-shape', eyeShape: 'eye-shape', earShape: 'ear-shape',
    eyebrowStyle: 'eyebrow', eyelashStyle: 'eyelash-style', noseShape: 'nose-shape', mouthStyle: 'mouth-style',
    facialHair: 'facial-hair', faceFeature: 'face-feature', outfitStyle: 'outfit-style', accessory: 'accessory',
  };
  function shown(node) {
    for (let cursor = node; cursor && cursor !== svg; cursor = cursor.parentElement) {
      const style = getComputedStyle(cursor);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  }
  function paintGeometry(group) {
    return [...group.querySelectorAll(geometrySelector)].filter(node => {
      const style = getComputedStyle(node), box = node.getBBox();
      return shown(node) && box.width + box.height > 0 &&
        ((style.fill !== 'none' && Number(style.fillOpacity) > 0) || (style.stroke !== 'none' && Number(style.strokeOpacity) > 0));
    });
  }
  function selectedFocus(avatar, key) {
    if (avatar.kind === 'bruin') return svg.querySelector('[data-hero-slot="mascot"]');
    if (key === 'bodyType') return svg.querySelector('[data-hero-slot="body-shape"][display="inline"]') || svg.querySelector('[data-hero-default-torso]');
    if (key === 'blushStyle') return svg.querySelector('[data-hero-cheek-blush]');
    const slot = slotByKey[key] || 'head-shape';
    return [...svg.querySelectorAll(`[data-hero-slot="${slot}"]`)].find(group => group.getAttribute('display') !== 'none');
  }
  function auditReferences() {
    const nodes = [svg, ...svg.querySelectorAll('*')];
    const ids = new Set(), duplicates = [], missing = [], invalid = [];
    for (const node of nodes) {
      if (node.id) { if (ids.has(node.id)) duplicates.push(node.id); ids.add(node.id); }
      for (const attribute of node.attributes) if (/NaN|Infinity|\[object SVGMatrix\]/.test(attribute.value)) invalid.push({ attribute: attribute.name, value: attribute.value });
    }
    for (const node of nodes) {
      for (const attribute of node.attributes) {
        const references = [...attribute.value.matchAll(/url\(["']?#([^)'"\s]+)["']?\)/g)].map(match => match[1]);
        if ((attribute.name === 'href' || attribute.name === 'xlink:href') && attribute.value.startsWith('#')) references.push(attribute.value.slice(1));
        for (const reference of references) if (!ids.has(reference)) missing.push(reference);
      }
      if (node.tagName.toLowerCase() === 'style') {
        for (const match of node.textContent.matchAll(/url\(["']?#([^)'"\s]+)["']?\)/g)) if (!ids.has(match[1])) missing.push(match[1]);
      }
    }
    const nonVectorElements = [...svg.querySelectorAll('image,feImage,foreignObject')].map(node => node.tagName);
    return { duplicateIds: [...new Set(duplicates)], unresolvedReferences: [...new Set(missing)], invalidAttributes: invalid, nonVectorElements };
  }
  function surfacesOverlap(first, second) {
    const bounds = first.getBBox(), toSecond = second.getScreenCTM().inverse().multiply(first.getScreenCTM());
    for (let row = 0; row <= 12; row++) for (let column = 0; column <= 8; column++) {
      const point = new DOMPoint(bounds.x + bounds.width * column / 8, bounds.y + bounds.height * row / 12);
      if (first.isPointInFill(point) && second.isPointInFill(point.matrixTransform(toSecond))) return true;
    }
    return false;
  }
  function auditGeometry(avatar) {
    if (avatar.kind === 'bruin') return { applicable: false };
    const head = svg.querySelector('[data-hero-slot="head-shape"][display="inline"] > path');
    const neck = svg.querySelector('[data-hero-neck-base] > path');
    const mouth = svg.querySelector('[data-hero-slot="mouth-style"][display="inline"]');
    const result = { applicable: true, neckHeadOverlap: surfacesOverlap(neck, head), mouthOutsideSamples: 0, mouthSamples: 0 };
    // The direct lip paths are geometry, not internal teeth clipped to a mouth.
    for (const shape of mouth.querySelectorAll(':scope > path')) {
      if (!shown(shape) || shape.hasAttribute('clip-path')) continue;
      const length = shape.getTotalLength(), toHead = head.getScreenCTM().inverse().multiply(shape.getScreenCTM());
      for (let index = 0; index <= 32; index++) {
        const point = shape.getPointAtLength(length * index / 32).matrixTransform(toHead);
        result.mouthSamples++;
        const touches = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].some(([x, y]) => head.isPointInFill({ x: point.x + x, y: point.y + y }));
        if (!touches) result.mouthOutsideSamples++;
      }
    }
    return result;
  }
  async function focusPixels(layer) {
    const ns = 'http://www.w3.org/2000/svg';
    const copy = document.createElementNS(ns, 'svg');
    copy.setAttribute('xmlns', ns); copy.setAttribute('viewBox', '80 -20 640 665');
    copy.setAttribute('width', '640'); copy.setAttribute('height', '665');
    copy.setAttribute('style', svg.getAttribute('style') || '');
    copy.style.width = '640px'; copy.style.height = '665px';
    svg.querySelectorAll(':scope > defs').forEach(defs => copy.append(defs.cloneNode(true)));
    let painted = layer.cloneNode(true);
    const originals = [layer, ...layer.querySelectorAll('*')], copies = [painted, ...painted.querySelectorAll('*')];
    const properties = ['fill', 'stroke', 'fill-opacity', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'display', 'visibility', 'clip-path', 'mask', 'transform', 'transform-origin', 'transform-box'];
    function present(original, target) {
      const style = getComputedStyle(original);
      properties.forEach(property => target.style.setProperty(property, style.getPropertyValue(property)));
    }
    originals.forEach((node, index) => present(node, copies[index]));
    for (let parent = layer.parentElement; parent && parent !== svg; parent = parent.parentElement) {
      const wrapper = parent.cloneNode(false); present(parent, wrapper); wrapper.append(painted); painted = wrapper;
    }
    copy.append(painted);
    copy.querySelectorAll('animate,animateTransform,animateMotion,set').forEach(node => node.remove());
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 665;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const rgba = context.getImageData(0, 0, 640, 665).data;
    let count = 0;
    for (let index = 3; index < rgba.length; index += 4) if (rgba[index] >= 8) count++;
    return count;
  }
  window.__avatarBenchmark = {
    async render({ avatar, focus, observation }) {
      document.documentElement.classList.toggle('dark-mode', observation.theme === 'dark');
      document.body.style.margin = '0';
      document.body.style.backgroundColor = observation.theme === 'dark' ? '#162333' : '#eef2f5';
      svg.style.cssText = 'display:block;width:600px;height:623px;opacity:1;visibility:visible';
      const schema = window.HeroAvatar.validateAvatar(avatar);
      if (!schema.ok) throw new Error(`Invalid benchmark avatar: ${schema.error}`);
      window.HeroAvatar.applyToSvg(svg, avatar);
      window.HeroAvatar.applyMilestoneToSvg(svg, observation.milestone);
      svg.pauseAnimations(); svg.setCurrentTime(observation.time);
      await new Promise(requestAnimationFrame);
      const references = auditReferences();
      const materials = [...svg.querySelectorAll('[data-hero-slot][display="inline"]')].filter(shown).map(group => ({
        slot: group.getAttribute('data-hero-slot'), option: group.getAttribute('data-hero-option'), geometryCount: paintGeometry(group).length,
      }));
      const layer = selectedFocus(avatar, focus);
      const geometry = layer ? paintGeometry(layer).length : 0;
      const pixels = geometry ? await focusPixels(layer) : 0;
      const option = layer && layer.getAttribute('data-hero-option');
      const emptyChoice = ['none', 'clean-shaven', 'bald'].includes(option) || (focus === 'accessory' && avatar.outfit.accessories.length === 0) || (focus === 'blushStyle' && avatar.appearance.blushStyle === 'none');
      const concealed = Boolean(layer && !shown(layer));
      return { schema, references, materials, geometry: auditGeometry(avatar), focus: {
        key: focus, option, geometryCount: geometry, pixels, expectedEmpty: emptyChoice, concealed, missing: !layer,
      }, effectiveAccessories: window.HeroAvatar.getCompositedAccessories(avatar.outfit.accessories, avatar.appearance.hairStyle) };
    },
  };
}

function findingsFor(result, messages) {
  const failures = [], review = [];
  if (result.references.duplicateIds.length) failures.push('Duplicate SVG IDs');
  if (result.references.unresolvedReferences.length) failures.push('Unresolved SVG references');
  if (result.references.invalidAttributes.length) failures.push('Non-finite or unserializable SVG geometry');
  if (result.references.nonVectorElements.length) failures.push('Avatar contains non-vector embedded content');
  if (messages.length) failures.push('Browser console/runtime error');
  if (result.focus.missing && !result.focus.expectedEmpty) failures.push('Selected focus material is missing');
  if (!result.focus.expectedEmpty && !result.focus.concealed && result.focus.pixels === 0) failures.push('Selected focus material has no visible paint');
  if (result.geometry.applicable && !result.geometry.neckHeadOverlap) review.push('Sampled neck/head surfaces do not overlap');
  if (result.geometry.mouthOutsideSamples > 0) review.push('Direct mouth geometry extends beyond sampled head fill');
  return { failures, review };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function htmlPage(title, body, dark, prefix = '') {
  return `<!doctype html><html lang="en"${dark ? ' class="dark-mode"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="${prefix}review.css"></head><body><a class="skip" href="#main">Skip to review</a>${body}</body></html>`;
}

function observationCard(observation, entry, audit) {
  const status = audit ? (audit.failures.length ? 'Rendering failure' : audit.review.length ? 'Needs visual review' : 'Machine checks passed') : 'Rendering pending';
  const classification = audit && (audit.failures.length ? 'fail' : audit.review.length ? 'review' : '');
  return `<article id="${observation.id}" class="${classification || ''}"><h2>${entry.id}</h2><p>${escapeHtml(entry.stratum)} · ${observation.theme} · t=${observation.time}s · ${observation.milestone}</p><a href="../${observation.images.full}"><img class="preview render-${observation.theme}" src="../${observation.images.thumbnail}" width="180" height="187" loading="lazy" alt="${escapeHtml(`${entry.id}: ${entry.avatar.kind}, ${entry.avatar.appearance.hairStyle}, ${entry.avatar.appearance.headStyle}; inspect the 600 pixel render`)}"></a><p class="status">${status}</p><p>${escapeHtml(entry.note)}</p><p class="case-links"><a href="../${observation.images.full}">600px render</a><a href="../${observation.images.thumbnail}">Native 180px render</a><a href="../states/${entry.id}.json">Complete state JSON</a></p><details><summary>Exact state and audit for ${entry.id}</summary><pre>${escapeHtml(JSON.stringify({ avatar: entry.avatar, observation, audit }, null, 2))}</pre></details></article>`;
}

function groupSheets(observations, cases) {
  const byId = new Map(cases.map(entry => [entry.id, entry]));
  const buckets = new Map();
  for (const observation of observations) {
    const stratum = byId.get(observation.caseId).stratum;
    if (!buckets.has(stratum)) buckets.set(stratum, []);
    buckets.get(stratum).push(observation);
  }
  const sheets = [];
  for (const [stratum, entries] of buckets) {
    for (let start = 0; start < entries.length; start += 12) {
      sheets.push({ id: `sheet-${String(sheets.length + 1).padStart(3, '0')}`, stratum, observations: entries.slice(start, start + 12) });
    }
  }
  return sheets;
}

function writeReview(out, manifest, audits, sheets, completedSheet = null) {
  const byCase = new Map(manifest.cases.map(entry => [entry.id, entry]));
  const byObservation = new Map(audits.map(audit => [audit.observationId, audit]));
  for (const dark of [false, true]) {
    const suffix = dark ? '-dark' : '';
    const links = sheets.map(sheet => `<li><a href="sheets/${sheet.id}${suffix}.html">${sheet.id}: ${escapeHtml(sheet.stratum)} (${sheet.observations.length} observations)</a></li>`).join('');
    const failed = audits.filter(audit => audit.failures.length).length;
    const review = audits.filter(audit => audit.review.length).length;
    const body = `<header><h1>SE Gym avatar benchmark</h1><nav aria-label="Review navigation"><a href="index${dark ? '' : '-dark'}.html">${dark ? 'Light' : 'Dark'} review theme</a><a href="manifest.json">Manifest and source hashes</a><a href="summary.json">Machine audit summary</a><a href="coverage.json">Coverage details</a></nav></header><main id="main"><p><strong>${manifest.cases.length} unique complete avatar configurations</strong>; ${manifest.observations.length} planned rendered observations, ${audits.length} finished. Seed: <code>${escapeHtml(manifest.seed)}</code>.</p><p>${failed} rendering failures; ${review} observations flagged for visual review. A machine pass does not establish professional visual quality. This stratified, seeded interaction sample is not exhaustive.</p><p>Every sheet has native 180px and 600px images, full state JSON, exact theme/time/milestone, and per-observation findings. The first two cases replay the supplied skin/hair/detail fields and a clean comparator. Other unspecified screenshot fields use the current defaults.</p><h2>Review sheets</h2><ol class="sheets">${links}</ol><h2>Audit limits</h2><p>Positive paint is raster-checked for each observation’s selected focus material. Other selected groups are checked for visible paint geometry; intentional empty/concealed choices are recorded. Neck overlap and mouth containment use conservative geometric samples and require visual review. IDs and local references are checked per SVG; the benchmark does not replace multi-instance, customizer, keyboard, persistence, or accessibility suites. PNG output freezes the real SVG timeline and does not certify motion between sampled times.</p></main><footer><p>Captured source hashes and browser version are in the manifest. Re-run this script after source changes to compare the same seed.</p></footer>`;
    fs.writeFileSync(path.join(out, `index${suffix}.html`), htmlPage('SE Gym avatar benchmark', body, dark));
    for (const sheet of completedSheet ? [completedSheet] : sheets) {
      const cards = sheet.observations.map(observation => observationCard(observation, byCase.get(observation.caseId), byObservation.get(observation.id))).join('');
      const body = `<header><h1>${sheet.id}: ${escapeHtml(sheet.stratum)}</h1><nav aria-label="Sheet navigation"><a href="../index${suffix}.html">All review sheets</a><a href="${sheet.id}${dark ? '' : '-dark'}.html">${dark ? 'Light' : 'Dark'} review theme</a><a href="${sheet.id}-180.png">Native 180px contact sheet</a><a href="${sheet.id}-600.png">Native 600px contact sheet</a></nav></header><main id="main" class="grid">${cards}</main>`;
      fs.writeFileSync(path.join(out, `sheets/${sheet.id}${suffix}.html`), htmlPage(`${sheet.id} · SE Gym avatar benchmark`, body, dark, '../'));
    }
  }
}

async function createContactSheet(page, out, sheet, width) {
  const entries = sheet.observations.map(observation => ({ id: observation.caseId, theme: observation.theme,
    caption: `${observation.theme} · ${observation.milestone} · t=${observation.time}s`,
    png: fs.readFileSync(path.join(out, width === 180 ? observation.images.thumbnail : observation.images.full)).toString('base64') }));
  const data = await page.evaluate(async ({ entries, width }) => {
    const height = width === 180 ? 187 : 623, tileWidth = width + 32, tileHeight = height + 86;
    const canvas = document.createElement('canvas'); canvas.width = tileWidth * 3; canvas.height = tileHeight * Math.ceil(entries.length / 3);
    const context = canvas.getContext('2d'); context.font = '16px system-ui';
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index], image = new Image(); image.src = `data:image/png;base64,${entry.png}`; await image.decode();
      const x = index % 3 * tileWidth, y = Math.floor(index / 3) * tileHeight;
      context.fillStyle = entry.theme === 'dark' ? '#162333' : '#eef2f5'; context.fillRect(x, y, tileWidth, tileHeight);
      context.drawImage(image, x + 16, y + 72, width, height);
      context.fillStyle = entry.theme === 'dark' ? '#edf3f8' : '#182b3c';
      context.fillText(entry.id, x + 12, y + 24);
      // The 180px sheet uses a second line; the same full text is real HTML on its review page.
      const parts = entry.caption.split(' · ');
      context.fillText(parts.slice(0, 2).join(' · '), x + 12, y + 45);
      context.fillText(parts[2], x + 12, y + 65);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, { entries, width });
  fs.writeFileSync(path.join(out, `sheets/${sheet.id}-${width}.png`), Buffer.from(data, 'base64'));
}

function summarize(manifest, audits, sources) {
  const counts = property => Object.fromEntries([...new Set(audits.flatMap(audit => audit[property]))].map(message => [message, audits.filter(audit => audit[property].includes(message)).length]));
  const renderedIds = new Set(audits.map(audit => audit.observationId));
  const contexts = manifest.observations.filter(observation => renderedIds.has(observation.id));
  const contextCounts = property => Object.fromEntries([...new Set(contexts.map(context => context[property]))]
    .map(value => [value, contexts.filter(context => context[property] === value).length]));
  return { formatVersion: FORMAT_VERSION, seed: manifest.seed, uniqueConfigurations: manifest.cases.length,
    plannedObservations: manifest.observations.length, renderedObservations: audits.length,
    failedObservations: audits.filter(audit => audit.failures.length).length,
    reviewObservations: audits.filter(audit => audit.review.length).length,
    failures: counts('failures'), review: counts('review'),
    renderedContexts: { themes: contextCounts('theme'), times: contextCounts('time'), milestones: contextCounts('milestone') },
    flaggedObservations: audits.filter(audit => audit.failures.length || audit.review.length).map(audit => ({
      observationId: audit.observationId, caseId: audit.caseId, failures: audit.failures, review: audit.review,
    })),
    sourceChangedDuringRun: sources.some(source => hash(fs.readFileSync(path.join(ROOT, source.path), 'utf8')) !== source.sha256),
    note: 'Rendering failures and review findings are separate. Visual review remains necessary; this is not exhaustive coverage or an accessibility certification.' };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options) {
    console.log('Usage: node scripts/se_gym_avatar_benchmark.cjs [--limit 2000] [--seed se-gym-art-2026] [--out tmp/se-gym-avatar-benchmark]');
    return;
  }
  prepareOutput(options.out);
  fs.writeFileSync(path.join(options.out, 'audit.ndjson'), '');
  const sources = captureSources(options.out);
  fs.writeFileSync(path.join(options.out, 'review.css'), sources[4].contents);
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE || undefined });
  try {
    const { page, metadata, messages } = await createRenderer(browser, sources);
    const corpus = buildCorpus(metadata, options);
    const normalized = await page.evaluate(avatars => avatars.map(avatar => window.HeroAvatar.normalizeAvatar(avatar)), corpus.map(entry => entry.avatar));
    const seen = new Set();
    const cases = corpus.map((entry, index) => ({ ...entry, avatar: normalized[index] })).filter(entry => {
      const signature = JSON.stringify(entry.avatar); if (seen.has(signature)) return false; seen.add(signature); return true;
    }).map((entry, index) => ({ ...entry, id: `c${String(index + 1).padStart(4, '0')}-${hash(JSON.stringify(entry.avatar)).slice(0, 7)}` }));
    const manifest = { formatVersion: FORMAT_VERSION, seed: options.seed, requestedLimit: options.limit,
      browser: browser.version(), createdAt: new Date().toISOString(),
      sources: sources.map(({ contents, ...source }) => source),
      sampling: 'Registered-option strata, every registered palette swatch, individual and combined fine-tuning boundaries, then greedy seeded targeted-pair sampling. No demographic recipes.',
      cases, observations: makeObservations(cases) };
    const sheets = groupSheets(manifest.observations, cases), audits = [];
    const sheetEnd = new Map(sheets.map(sheet => [sheet.observations.at(-1).id, sheet]));
    writeJson(path.join(options.out, 'manifest.json'), manifest);
    writeJson(path.join(options.out, 'coverage.json'), describeCoverage(cases, metadata));
    for (const entry of cases) writeJson(path.join(options.out, `states/${entry.id}.json`), entry);
    writeReview(options.out, manifest, audits, sheets);
    console.log(`Manifest ready: ${path.join(options.out, 'manifest.json')} (${cases.length} unique configurations, ${manifest.observations.length} observations)`);
    const byCase = new Map(cases.map(entry => [entry.id, entry]));
    const svg = page.locator('[data-gym-hero-svg]');
    for (const observation of manifest.observations) {
      const entry = byCase.get(observation.caseId), messageStart = messages.length;
      let audit;
      try {
        const result = await page.evaluate(input => window.__avatarBenchmark.render(input), { avatar: entry.avatar, focus: entry.focus, observation });
        audit = { observationId: observation.id, caseId: entry.id, ...result, messages: messages.slice(messageStart), ...findingsFor(result, messages.slice(messageStart)) };
      } catch (error) {
        audit = { observationId: observation.id, caseId: entry.id, failures: [`Renderer exception: ${error.message}`], review: [], messages: messages.slice(messageStart) };
      }
      // Keep failed images too: they are the most useful evidence in the report.
      await svg.screenshot({ path: path.join(options.out, observation.images.full) });
      await svg.evaluate(node => { node.style.width = '180px'; node.style.height = '187px'; });
      await svg.screenshot({ path: path.join(options.out, observation.images.thumbnail) });
      audits.push(audit);
      fs.appendFileSync(path.join(options.out, 'audit.ndjson'), `${JSON.stringify(audit)}\n`);
      const completedSheet = sheetEnd.get(observation.id);
      if (completedSheet) {
        for (const width of [180, 600]) await createContactSheet(page, options.out, completedSheet, width);
        writeReview(options.out, manifest, audits, sheets, completedSheet);
        writeJson(path.join(options.out, 'summary.json'), summarize(manifest, audits, sources));
      }
      if (audits.length % 50 === 0) console.log(`Rendered ${audits.length}/${manifest.observations.length}; failures ${audits.filter(result => result.failures.length).length}`);
    }
    writeJson(path.join(options.out, 'audit.json'), audits);
    const summary = summarize(manifest, audits, sources);
    writeJson(path.join(options.out, 'summary.json'), summary);
    writeReview(options.out, manifest, audits, sheets);
    console.log(JSON.stringify(summary, null, 2));
    console.log(`Review: ${path.join(options.out, 'index.html')}`);
    if (summary.failedObservations) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

if (require.main === module) main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
module.exports = { parseArguments, seededRandom, buildCorpus, describeCoverage, makeObservations };
