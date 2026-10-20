'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function avatarApi() {
  const context = {
    document: { readyState: 'loading', addEventListener() {} },
    window: { addEventListener() {} },
  };
  vm.runInNewContext(readFileSync(path.join(__dirname, '../../js/se-gym-hero-avatar.js'), 'utf8'), context);
  return context.window.HeroAvatar;
}

const rewards = [
  'chrome-star-earrings', 'pocket-library', 'debugger-duck',
  'cat-ear-headphones', 'book-stack-backpack', 'annotation-headphones',
  'holographic-shades', 'scholar-satchel', 'holographic-notebook',
  'crystal-horns', 'knowledge-crown', 'origami-owl',
  'cosmic-orbit-halo', 'orbiting-library', 'library-portal-backpack',
  'varsity-cap', 'technical-crossbody', 'metal-watch', 'signet-ring',
];

for (const reward of rewards) {
  test(`${reward} can be selected and survives avatar serialization`, () => {
    const api = avatarApi();
    const avatar = JSON.parse(JSON.stringify(api.DEFAULTS));
    avatar.outfit.accessories = [reward];
    avatar.outfit.accessory = reward;
    assert.equal(api.validateAvatar(avatar).ok, true);
    const restored = api.normalizeAvatar(JSON.parse(JSON.stringify(avatar)));
    assert.deepEqual(Array.from(restored.outfit.accessories), [reward]);
  });
}

test('earned accessories combine across different wearable families', () => {
  const api = avatarApi();
  const avatar = JSON.parse(JSON.stringify(api.DEFAULTS));
  const selected = ['holographic-shades', 'varsity-cap', 'technical-crossbody', 'metal-watch', 'signet-ring'];
  avatar.outfit.accessories = selected;
  assert.deepEqual(Array.from(api.normalizeAvatar(avatar).outfit.accessories).sort(), selected.sort());
});
