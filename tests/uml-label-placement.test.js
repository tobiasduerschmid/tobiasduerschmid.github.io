const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadUmlShared() {
  const document = {
    createElement() {
      return {
        style: {}, appendChild() {}, setAttribute() {},
        getAttribute() { return null; },
        querySelectorAll() { return []; },
        getContext() {
          return { measureText(text) { return { width: String(text).length * 8 }; } };
        },
      };
    },
    querySelectorAll() { return []; },
    addEventListener() {}, documentElement: {}, readyState: 'complete',
  };
  const sandbox = {
    document, console, setTimeout, clearTimeout,
    MutationObserver: class { observe() {} },
    setInterval() { return 1; }, clearInterval() {},
    requestAnimationFrame(callback) { return setTimeout(callback, 0); },
    addEventListener() {}, removeEventListener() {},
  };
  sandbox.window = sandbox;
  const bundlePath = path.join(__dirname, '../js/ArchUML/uml-bundle.js');
  vm.runInNewContext(fs.readFileSync(bundlePath, 'utf8'), sandbox, { filename: bundlePath });
  return sandbox.UMLShared;
}

const UMLShared = loadUmlShared();

function assertClear(rect, occupied, padding) {
  assert.ok(Object.values(rect).every(Number.isFinite), 'label bounds must be finite');
  for (const obstacle of occupied) {
    const separated = rect.right + padding <= obstacle.left ||
      rect.left - padding >= obstacle.right ||
      rect.bottom + padding <= obstacle.top ||
      rect.top - padding >= obstacle.bottom;
    assert.ok(separated, `label ${JSON.stringify(rect)} obscures ${JSON.stringify(obstacle)}`);
  }
}

const horizontalCorridor = [
  { left: -300, right: 300, top: -500, bottom: -2 },
  { left: -300, right: 300, top: 2, bottom: 500 },
];
const horizontalRoute = [{ x: 0, y: 0 }, { x: 100, y: 0 }];

test('crowded horizontal routes place labels outside obstacles beyond the local search radius', () => {
  const placement = UMLShared.placeOrthogonalLabel('guard', horizontalRoute, horizontalCorridor, []);

  assertClear(placement.rect, horizontalCorridor, 6);
  assert.ok(placement.rect.left >= 300 && placement.rect.left <= 350,
    'use the nearby right opening instead of moving beyond the tall obstacles');
});

test('crowded vertical routes keep labels clear of tall obstacles', () => {
  const route = [{ x: 0, y: 0 }, { x: 0, y: 100 }];
  const obstacles = [
    { left: -500, right: -2, top: -300, bottom: 300 },
    { left: 2, right: 500, top: -300, bottom: 300 },
  ];

  const placement = UMLShared.placeOrthogonalLabel('guard', route, obstacles, []);

  assertClear(placement.rect, obstacles, 6);
  assert.ok(placement.rect.top >= 300 && placement.rect.top <= 350,
    'use the nearby bottom opening instead of moving beyond the wide obstacles');
});

test('crowded route labels remain distinct from labels already occupying the available space', () => {
  const placement = UMLShared.placeOrthogonalLabel('guard', horizontalRoute, [], horizontalCorridor);

  assertClear(placement.rect, horizontalCorridor, 8);
});

test('the crowded fallback does not obscure unrelated relationship shafts', () => {
  const routes = Array.from({ length: 151 }, (_, index) => [
    { x: -300 + index * 4, y: -500 },
    { x: -300 + index * 4, y: 500 },
  ]);
  const otherSegments = routes.flatMap((points) => UMLShared.buildOrthogonalSegments(points));
  const placement = UMLShared.placeOrthogonalLabel('guard', horizontalRoute, [], [], { otherSegments });

  assertClear(placement.rect, routes.map(([start, end]) => ({
    left: start.x, right: end.x, top: start.y, bottom: end.y,
  })), 3);
});

test('clear label placement uses the nearest available gap without moving its exclusions', () => {
  const rect = { left: 0, right: 40, top: 0, bottom: 24 };
  const exclusions = [
    { rect: { left: -300, right: 300, top: -500, bottom: 4 }, pad: 6 },
    { rect: { left: -300, right: 300, top: 44, bottom: 500 }, pad: 6 },
  ];
  const original = structuredClone({ rect, exclusions });

  const placement = UMLShared.findClearLabelPlacement(rect, exclusions);

  assertClear(placement.rect, exclusions.map((item) => item.rect), 6);
  assert.equal(placement.dx, 0, 'the clear gap is directly below the label');
  assert.ok(placement.dy > 10 && placement.dy < 11, 'move only far enough to clear the upper obstacle');
  assert.deepEqual({ rect, exclusions }, original, 'placement must not change caller geometry');
});
