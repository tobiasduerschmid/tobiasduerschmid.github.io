'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const avatarSource = readFileSync(path.join(__dirname, '../../js/se-gym-hero-avatar.js'), 'utf8');

function loadAvatarApi(seed = 246813579) {
  const storage = new Map();
  const math = Object.create(Math);
  math.random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const context = {
    Math: math,
    // Delay page initialization: these tests exercise the public state API.
    document: { readyState: 'loading', addEventListener() {} },
    window: { addEventListener() {} },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  };
  vm.runInNewContext(avatarSource, context, { filename: 'se-gym-hero-avatar.js' });
  return context.window.HeroAvatar;
}

function hasFacialHair(avatar) {
  return !['none', 'clean-shaven'].includes(avatar.appearance.facialHair);
}

function sampleAvatars(api) {
  return Array.from({ length: 16000 }, () => api.randomAvatar());
}

test('random avatars keep the designated hairstyles and glam lashes free of facial hair', () => {
  const api = loadAvatarApi();
  const avatars = sampleAvatars(api);
  // Independent examples pin the requested behavior even if a policy entry
  // accidentally disappears from the production compatibility catalog.
  const hairExamples = ['pixie', 'bob', 'long-straight', 'pigtails', 'claw-clip-updo', 'coily-puff', 'braided-bob', 'cheek-length-sidelocks'];
  const lashExamples = ['full-upper', 'long-glam', 'winged', 'dense'];
  for (const [key, examples] of [['hairStyle', hairExamples], ['eyelashStyle', lashExamples]]) {
    for (const value of examples) {
      const matches = avatars.filter((avatar) => avatar.appearance[key] === value);
      assert.ok(matches.length > 0, `seeded generation must exercise ${key} ${value}`);
      assert.equal(matches.some(hasFacialHair), false, `${value} must not randomly receive facial hair`);
    }
  }

  const policy = api.RANDOM_TRAIT_POLICY.facialHairCompatibility;
  for (const [key, values] of [
    ['hairStyle', policy.hairStylesWithoutFacialHair],
    ['eyelashStyle', policy.eyelashStylesWithoutFacialHair],
  ]) {
    const catalog = new Set(api.CHOICE_SETS[key].groups.flatMap((group) => group.options.map((option) => option.value)));
    for (const value of values) {
      assert.ok(catalog.has(value), `${key} policy must name an available option: ${value}`);
      const matches = avatars.filter((avatar) => avatar.appearance[key] === value);
      assert.ok(matches.length > 0, `seeded generation must exercise the ${value} policy`);
      assert.equal(matches.some(hasFacialHair), false, `${value} must follow the random facial-hair policy`);
    }
  }
});

test('random compatibility rules preserve hair, facial-hair, skin-tone, and body variety', () => {
  const api = loadAvatarApi();
  const avatars = sampleAvatars(api);
  for (const key of ['hairStyle', 'facialHair']) {
    const expected = api.CHOICE_SETS[key].groups.flatMap((group) => group.options.map((option) => option.value));
    const seen = new Set(avatars.map((avatar) => avatar.appearance[key]));
    assert.deepEqual([...seen].sort(), [...expected].sort(), `every ${key} option must remain reachable`);
  }
  for (const hairStyle of ['short', 'bald', 'locs', 'cornrows', 'box-braids', 'knotless-braids', 'afro', 'ponytail', 'top-knot', 'long-center-part', 'shag']) {
    assert.ok(avatars.some((avatar) => avatar.appearance.hairStyle === hairStyle && hasFacialHair(avatar)),
      `${hairStyle} must still support randomly selected facial hair`);
  }
  for (const skin of api.PALETTES.skin) {
    assert.ok(avatars.some((avatar) => avatar.appearance.skin === skin && hasFacialHair(avatar)),
      `${skin} must still support randomly selected facial hair`);
  }
  for (const bodyType of api.RANDOM_TRAIT_POLICY.bodyTypes) {
    assert.ok(avatars.some((avatar) => avatar.body.type === bodyType && hasFacialHair(avatar)),
      `${bodyType} must still support randomly selected facial hair`);
  }
  assert.ok(avatars.some((avatar) => avatar.appearance.eyelashStyle === 'outer-corner' && hasFacialHair(avatar)),
    'subtle outer-corner lashes must remain compatible with random facial hair');
});

test('manual combinations retain facial hair through validation, normalization, saving, and loading', () => {
  const api = loadAvatarApi();
  for (const hairStyle of ['bob', 'pigtails', 'coily-puff', 'braided-bob', 'cheek-length-sidelocks']) {
    const avatar = structuredClone(api.DEFAULTS);
    Object.assign(avatar.appearance, { hairStyle, eyelashStyle: 'long-glam', facialHair: 'full-beard' });
    assert.equal(api.validateAvatar(avatar).ok, true, `${hairStyle} plus a beard is a valid manual choice`);
    const normalized = api.normalizeAvatar(avatar);
    assert.equal(normalized.appearance.facialHair, 'full-beard');
    api.saveAvatar(normalized);
    const restored = api.loadAvatar();
    assert.equal(restored.appearance.hairStyle, hairStyle);
    assert.equal(restored.appearance.eyelashStyle, 'long-glam');
    assert.equal(restored.appearance.facialHair, 'full-beard');
  }
});

test('random generation reaches every selectable facial structure without tying it to one complexion', () => {
  const api = loadAvatarApi();
  const avatars = sampleAvatars(api);
  for (const key of ['headStyle', 'eyeShape', 'noseShape', 'mouthStyle', 'earShape']) {
    const expected = api.CHOICE_SETS[key].groups.flatMap(group => group.options.map(option => option.value));
    const seen = new Set(avatars.map(avatar => avatar.appearance[key]));
    assert.deepEqual([...seen].sort(), [...expected].sort(), `every ${key} choice must be reachable`);
    for (const value of expected) {
      const complexions = new Set(avatars.filter(avatar => avatar.appearance[key] === value)
        .map(avatar => avatar.appearance.skin));
      assert.ok(complexions.size > 1, `${key} ${value} must be available across complexions`);
    }
  }
});

test('random Bruin mascots retain their established appearance', () => {
  const api = loadAvatarApi();
  for (let index = 0; index < 32; index++) {
    const avatar = api.randomAvatar(null, 'bruin');
    assert.equal(api.validateAvatar(avatar).ok, true);
    assert.equal(avatar.kind, 'bruin');
    assert.equal(avatar.appearance.hairStyle, 'bald');
    assert.equal(avatar.appearance.eyelashStyle, 'none');
    assert.equal(avatar.appearance.facialHair, 'none');
    assert.equal(avatar.outfit.accessories.length, 0);
  }
});
