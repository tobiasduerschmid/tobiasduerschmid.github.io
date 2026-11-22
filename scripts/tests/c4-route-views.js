'use strict';

// The views the C4 router tests share: the 17 views of the §9.3 table, the pinned booking component view, and the
// generated landscapes of §9.3 "Generated views" (docs/superpowers/specs/2026-11-09-c4-routing-redesign.md). The
// route-quality gates (c4-route-quality.test.js) and the serial timing lane (timing/c4-route-timing.test.js) read
// the same rows, so a budget or generator change reaches both.

const fs = require('node:fs');
const path = require('node:path');

const ARCHUML = path.join(__dirname, '../../js/ArchUML');
const FIXTURES = path.join(ARCHUML, 'tests/c4/fixtures');
const MODELS = path.join(__dirname, '../../_includes/c4-models');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));

const readModel = (file) => fs.readFileSync(file, 'utf8');
const REFERENCE = readModel(path.join(FIXTURES, 'course-registration.yml'));
const BOOKING = readModel(path.join(MODELS, 'campus-booking-suggested.yml'));
const STARTER = readModel(path.join(MODELS, 'campus-booking-starter.yml'));
const RIGHT_VIEW = '\nviews:\n  wide:\n    view: containers of registration\n    direction: right\n';

/**
 * The §9.3 budgets: `[name, model, selector, {crossings, bends, detour, size}]`. `crossings` is exact except for
 * the pinned view (`crossingsAtMost`), whose geometry the learner's pins decide. `sidesUsed` names the boxes whose
 * heads must arrive on at least two sides. `size` is the `[width, height]` cap (routing redesign §9.3), with the widths
 * recomputed in Task 8b-1 Step 0 for P = 1003, the widest drawing that prints its labels at 9 pt in the A4 print
 * column. A view wider than that prints on a landscape page (Task R), whose Letter column gives P = 1598.
 */
const VIEWS = [
  ['context', REFERENCE, 'context of registration', { crossings: 0, bends: 0, detour: 0, size: [1003, 998] }],
  ['containers', REFERENCE, 'containers of registration', { crossings: 0, bends: 0, detour: 0, size: [1003, 1759] }],
  ['components', REFERENCE, 'components of api', { crossings: 0, bends: 2, detour: 0, size: [1140, 1498] }],
  ['landscape', REFERENCE, 'landscape', { crossings: 0, bends: 0, detour: 0, size: [1003, 998] }],
  ['campus landscape', readModel(path.join(FIXTURES, 'campus-landscape.yml')), 'landscape',
    { crossings: 0, bends: 10, detour: 150, sidesUsed: ['Campus Identity', 'Course Registration'], size: [1417, 2240] }],
  ['shop', readModel(path.join(FIXTURES, 'shop.yml')), 'containers of shop', { crossings: 0, bends: 6, detour: 0, size: [1760, 1547] }],
  ['two groups', readModel(path.join(FIXTURES, 'two-groups.yml')), 'containers of store', { crossings: 0, bends: 4, detour: 0, size: [1380, 1473] }],
  ['boundary landing', readModel(path.join(FIXTURES, 'boundary-landing.yml')), 'containers of registration',
    { crossings: 0, bends: 0, detour: 0, size: [1003, 978] }],
  ['booking containers', BOOKING, 'containers of booking', { crossings: 0, bends: 4, detour: 150, size: [1003, 2008] }],
  // One crossing is the minimum under any placement (routing redesign §9.3 note ³): member–member edges stay inside
  // the boundary, so a crossing-free drawing admits a virtual edge app–db outside it, and the graph then holds a
  // subdivision of K3,3 ({app, ledger, catalog} × {coordinator, finder, db}, catalog–coordinator via permissions).
  ['booking components', BOOKING, 'components of api',
    // Printed on a landscape page, so its width cap is min(W₀ + 652, 1598) = 1598 for W₀ = 1420 (§9.3).
    { crossings: 1, bends: 10, detour: 200, sidesUsed: ['Room Catalog'], size: [1598, 2098] }],
  ['booking landscape', BOOKING, 'landscape', { crossings: 0, bends: 2, detour: 0, size: [1003, 1073] }],
  ['database-as-system context', readModel(path.join(MODELS, 'flaws/database-as-system.yml')), 'context of registration',
    { crossings: 0, bends: 0, detour: 0, size: [1003, 1052] }],
  // A test-only view. Flowing right, each of its five elements takes a rank of its own, so its structural width is
  // 5 × 300 + 4 corridors × 424 = 3196 (the first estimate counted 4 ranks); the cap pins the measured 2770 (§9.3).
  ['containers laid out to the right', REFERENCE + RIGHT_VIEW, 'wide',
    { crossings: 0, bends: 0, detour: 0, size: [2770, 1133] }],
  ['flaw: unlabeled uses', readModel(path.join(MODELS, 'flaws/unlabeled-uses.yml')), 'containers of registration',
    { crossings: 0, bends: 0, detour: 0, size: [1003, 1717] }],
  ['flaw: backend box', readModel(path.join(MODELS, 'flaws/backend-box.yml')), 'containers of registration',
    { crossings: 0, bends: 0, detour: 0, size: [1003, 1727] }],
  ['starter context', STARTER, 'context of booking', { crossings: 0, bends: 2, detour: 0, size: [1003, 1073] }],
  ['starter landscape', STARTER, 'landscape', { crossings: 0, bends: 2, detour: 0, size: [1003, 1073] }],
];
// The learner placed the boxes of a pinned view, so its width has no cap (routing redesign §9.3); its height has one.
const PINNED = ['booking components, pinned', BOOKING, 'components of api',
  { crossingsAtMost: 3, bends: 34, detour: 300, size: [Infinity, 2098] }, { pins: [['finder', [1000, 373]], ['catalog', [30, 1129]]] }];

/** A fresh page of `browser` that holds the ArchUML bundle and the C4 scripts, and nothing else. */
async function openC4Page(browser) {
  const c4Page = await browser.newPage();
  await c4Page.setContent('<!doctype html><html lang="en"><title>C4 route test</title><body></body></html>');
  await c4Page.addScriptTag({ path: path.join(ARCHUML, 'uml-bundle.js') });
  for (const file of MANIFEST.core.concat(MANIFEST.render)) await c4Page.addScriptTag({ path: path.join(ARCHUML, file) });
  return c4Page;
}

// ---- Generated landscapes (routing redesign §9.3 "Generated views") ---------------------------------------------

/** A linear congruential generator in [0, 1): the same seed always gives the same sequence. */
function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const RELATIONSHIP_VERBS = ['uses', 'reads records from', 'sends events to', 'signs users in through', 'stores files in', 'requests reports from'];
const MAX_RELATIONSHIPS_PER_ELEMENT = 6;

/**
 * The parts of a generated landscape of `size` elements, counting the enterprise and group boundaries: people
 * outside the enterprise, internal systems (the first `ungrouped` directly in the enterprise, the rest spread over
 * the groups), external systems, and about five relationships for every three boxes.
 */
function landscapeShape(size) {
  const groups = size >= 30 ? 3 : size >= 13 ? 2 : 1;
  const people = Math.max(1, Math.round(size / 10));
  const externals = Math.max(1, Math.round(size * 0.15));
  const internals = size - people - externals - (1 + groups);
  const relationships = Math.round((people + internals + externals) * 5 / 3);
  return { people, internals, ungrouped: Math.max(1, Math.round(internals / 10)), externals, groups, relationships };
}

/**
 * A learner-sized system landscape from `seed` (§9.3): every internal system is reached from a person or an
 * earlier system, preferably of its own group, every person and external system takes part, and further
 * relationships join people to systems, systems to systems (mostly within a group) and systems to externals, with
 * at most `MAX_RELATIONSHIPS_PER_ELEMENT` per element. Returns `{text, relationships: [{source, target}]}`.
 */
function generatedLandscape(seed, size) {
  const random = lcg(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const shape = landscapeShape(size);
  const ids = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
  const people = ids('p', shape.people);
  const internals = ids('s', shape.internals);
  const externals = ids('x', shape.externals);
  const grouped = internals.slice(shape.ungrouped);
  const groupOf = new Map(grouped.map((id, index) => [id, `g${Math.floor(index * shape.groups / grouped.length) + 1}`]));
  const relationships = [];
  const degree = new Map();
  const linked = new Set();
  const relate = (source, target) => {
    const pair = [source, target].sort().join('|');
    const full = (id) => (degree.get(id) || 0) >= MAX_RELATIONSHIPS_PER_ELEMENT;
    if (source === target || linked.has(pair) || full(source) || full(target)) return;
    linked.add(pair);
    [source, target].forEach((id) => degree.set(id, (degree.get(id) || 0) + 1));
    relationships.push({ source, target, description: pick(RELATIONSHIP_VERBS) });
  };
  const sameGroup = (a, b) => groupOf.get(a) === groupOf.get(b);
  internals.forEach((id, index) => {
    const earlier = internals.slice(0, index);
    const peers = earlier.filter((other) => sameGroup(other, id));
    relate(index === 0 || random() < 0.3 ? pick(people) : pick(peers.length ? peers : earlier), id);
  });
  people.filter((id) => !degree.has(id)).forEach((id) => relate(id, pick(internals)));
  externals.forEach((id) => relate(pick(internals), id));
  for (let attempt = 0; relationships.length < shape.relationships && attempt < 10000; attempt++) {
    const roll = random();
    if (roll < 0.15) relate(pick(people), pick(internals));
    else if (roll < 0.75) {
      const first = Math.floor(random() * internals.length);
      const pool = random() < 0.7 ? internals.filter((id) => sameGroup(id, internals[first])) : internals;
      const second = internals.indexOf(pick(pool));
      relate(internals[Math.min(first, second)], internals[Math.max(first, second)]);
    } else relate(pick(internals), pick(externals));
  }
  return { text: landscapeYaml(seed, { people, internals, externals, groupOf, groups: shape.groups, relationships }), relationships };
}

function collaboratorLines(id, relationships) {
  const own = relationships.filter((relationship) => relationship.source === id);
  if (!own.length) return [];
  return ['    collaborators:'].concat(own.map((relationship) => `      ${relationship.target}: ${relationship.description}`));
}

function landscapeYaml(seed, parts) {
  const lines = ['schema: c4-design/1', `name: Generated Landscape ${seed}`, 'enterprise: Generated Enterprise', 'groups:'];
  for (let index = 1; index <= parts.groups; index++) lines.push(`  g${index}: {name: Group ${index}}`);
  lines.push('people:');
  parts.people.forEach((id, index) => lines.push(`  ${id}:`, `    name: Person ${index + 1}`, '    in_enterprise: false',
    ...collaboratorLines(id, parts.relationships)));
  lines.push('systems:');
  parts.internals.forEach((id, index) => lines.push(`  ${id}:`, `    name: System ${index + 1}`, '    description: A generated system.',
    ...(parts.groupOf.has(id) ? [`    group: ${parts.groupOf.get(id)}`] : []), ...collaboratorLines(id, parts.relationships)));
  parts.externals.forEach((id, index) => lines.push(`  ${id}:`, `    name: External ${index + 1}`,
    '    description: A generated external system.', '    external: true', '    in_enterprise: false'));
  return lines.join('\n') + '\n';
}

/** `[seed, size, shape, checksum]`: ten learner-sized landscapes of 10 to 15 elements. */
const GENERATED_VIEWS = [
  [1, 10, { people: 1, internalSystems: 5, externalSystems: 2, groups: 1, enterprise: 1, relationships: 13 }, 'f55edac8986e3f123a2cc11a5cea93a3334166bba6cdf5aeab90a047087632f2'],
  [2, 11, { people: 1, internalSystems: 6, externalSystems: 2, groups: 1, enterprise: 1, relationships: 15 }, 'b3b6a485055b7bdc60c018fbb3d494c979cb16fe8f311dd84c5cf8776be92b0b'],
  [3, 12, { people: 1, internalSystems: 7, externalSystems: 2, groups: 1, enterprise: 1, relationships: 17 }, '770ab353d274f9e5cd0c11da3b6ff8ee384e654d54d80dc7c1e43422ea812b08'],
  [4, 13, { people: 1, internalSystems: 7, externalSystems: 2, groups: 2, enterprise: 1, relationships: 17 }, '13bcc9d00e0be2f5278ba73ac487ae078ce898d9f6b321fe2d4058b5dbfb4a78'],
  [5, 14, { people: 1, internalSystems: 8, externalSystems: 2, groups: 2, enterprise: 1, relationships: 18 }, '1e1c2301aed764d03e7524b60ba3adc9bf4ba60cb53ac3983f2f4b4cf566ea79'],
  [6, 15, { people: 2, internalSystems: 8, externalSystems: 2, groups: 2, enterprise: 1, relationships: 20 }, '4af98e6b0620e169ef1633297521f683525988a704cc0d5d7443e645af0fb848'],
  [7, 10, { people: 1, internalSystems: 5, externalSystems: 2, groups: 1, enterprise: 1, relationships: 13 }, '6199f924898aa31782b5ec124d42683fbcf3359f7691a1ea55297fa12b141df0'],
  [8, 11, { people: 1, internalSystems: 6, externalSystems: 2, groups: 1, enterprise: 1, relationships: 15 }, '9c950b100a93b3e8ec9db9242137b1e72fb928662c395c662731b8933f7f8123'],
  [9, 12, { people: 1, internalSystems: 7, externalSystems: 2, groups: 1, enterprise: 1, relationships: 17 }, '31d91592c1a81a9b263a7442abe5d8264d5aea51a2bfaf528db3172bca36c1ec'],
  [10, 13, { people: 1, internalSystems: 7, externalSystems: 2, groups: 2, enterprise: 1, relationships: 17 }, '5f6ee58d62adecc1790026b81d6e098e95b991d2517c17c60a2067b064374a49'],
];

/** The 40-element view of §9.3: 4 people, 26 internal systems (23 of them in 3 groups), 6 externals, 60 edges. */
const LARGE_VIEW = {
  seed: 7, size: 40,
  shape: { people: 4, internalSystems: 26, externalSystems: 6, groups: 3, enterprise: 1, relationships: 60 },
  checksum: 'bb270b03b548860648abffb37f55f90d8b44e4e0fef84e17c64d75bb647c7d8f',
};

module.exports = { VIEWS, PINNED, LARGE_VIEW, GENERATED_VIEWS, generatedLandscape, openC4Page };
