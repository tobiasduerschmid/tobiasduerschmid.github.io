const assert = require('assert/strict');
const fs = require('fs');
const test = require('node:test');
const vm = require('vm');

function loadUmlShared() {
  const bundle = fs.readFileSync('js/ArchUML/uml-bundle.js', 'utf8');
  const document = {
    createElement() {
      return {
        style: {},
        appendChild() {},
        setAttribute() {},
        getAttribute() { return null; },
        querySelectorAll() { return []; },
        getContext() {
          return { measureText(text) { return { width: String(text || '').length * 8 }; } };
        },
      };
    },
    querySelectorAll() { return []; },
    addEventListener() {},
    documentElement: {},
    readyState: 'complete',
  };
  const sandbox = {
    document,
    MutationObserver: class { observe() {} },
    console,
    setTimeout,
    clearTimeout,
    setInterval() { return 1; },
    clearInterval() {},
    requestAnimationFrame(callback) { return setTimeout(callback, 0); },
    addEventListener() {},
    removeEventListener() {},
  };
  sandbox.window = sandbox;
  vm.runInNewContext(bundle, sandbox, { filename: 'uml-bundle.js' });
  return sandbox.window.UMLShared;
}

const UMLShared = loadUmlShared();

function pt(x, y) {
  return { x, y };
}

function copy(points) {
  return points.map((point) => ({ ...point }));
}

function plain(points) {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function assertPoint(actual, expected, message) {
  assert.equal(actual.x, expected.x, `${message} x`);
  assert.equal(actual.y, expected.y, `${message} y`);
}

function shifted(point, delta) {
  return delta ? pt(point.x + delta.x, point.y + delta.y) : point;
}

test('shiftRoutePoints keeps source endpoint moves orthogonal', () => {
  const route = [pt(0, 0), pt(40, 0), pt(40, 80), pt(100, 80)];
  const original = copy(route);
  const next = UMLShared.shiftRoutePoints(route, pt(7, 4), null);

  assert.deepEqual(route, original, 'source route points should not be mutated');
  assertPoint(next[0], pt(7, 4), 'source endpoint');
  assertPoint(next[next.length - 1], pt(100, 80), 'target endpoint');
  assert.equal(UMLShared.routePointsAreOrthogonal(next, 0.001), true);
});

test('shiftRoutePoints keeps target endpoint moves orthogonal', () => {
  const route = [pt(0, 0), pt(40, 0), pt(40, 80), pt(100, 80)];
  const next = UMLShared.shiftRoutePoints(route, null, pt(13, -5));

  assertPoint(next[0], pt(0, 0), 'source endpoint');
  assertPoint(next[next.length - 1], pt(113, 75), 'target endpoint');
  assert.equal(UMLShared.routePointsAreOrthogonal(next, 0.001), true);
});

test('shiftRoutePoints moves the whole route when both endpoints have the same delta', () => {
  const route = [pt(0, 0), pt(0, 50), pt(90, 50), pt(90, 120)];
  const next = UMLShared.shiftRoutePoints(route, pt(-11, 6), pt(-11, 6));

  assert.deepEqual(plain(next), [pt(-11, 6), pt(-11, 56), pt(79, 56), pt(79, 126)]);
  assert.equal(UMLShared.routePointsAreOrthogonal(next, 0.001), true);
});

test('shiftRoutePoints turns two-point diagonal routes into orthogonal routes when an endpoint moves', () => {
  const route = [pt(0, 0), pt(80, 50)];
  const next = UMLShared.shiftRoutePoints(route, pt(5, 9), null);

  assertPoint(next[0], pt(5, 9), 'source endpoint');
  assertPoint(next[next.length - 1], pt(80, 50), 'target endpoint');
  assert.equal(next.length, 3);
  assert.equal(UMLShared.routePointsAreOrthogonal(next, 0.001), true);
});

test('shiftRoutePoints preserves a shared bend when both endpoints move differently', () => {
  const route = [pt(0, 0), pt(50, 0), pt(50, 50)];
  const next = UMLShared.shiftRoutePoints(route, pt(10, 20), pt(-5, 5));

  assert.deepEqual(plain(next), [pt(10, 20), pt(45, 20), pt(45, 55)]);
  assert.equal(UMLShared.routePointsAreOrthogonal(next, 0.001), true);
});

test('shiftRoutePoints stays stable across many tiny state-drag deltas', () => {
  const routes = [
    [pt(12, 10), pt(12, 70)],
    [pt(20, 30), pt(80, 30), pt(80, 120)],
    [pt(20, 30), pt(80, 30), pt(80, 120), pt(140, 120)],
    [pt(200, 30), pt(260, 30), pt(260, 100), pt(160, 100)],
    [pt(0, 0), pt(90, 60)],
  ];
  const deltas = [
    null,
    pt(1, 1),
    pt(2, -1),
    pt(-3, 4),
    pt(7, 4),
    pt(-9, -6),
    pt(13, -11),
  ];

  for (const route of routes) {
    for (const sourceDelta of deltas) {
      for (const targetDelta of deltas) {
        if (!sourceDelta && !targetDelta) continue;
        const original = copy(route);
        const next = UMLShared.shiftRoutePoints(route, sourceDelta, targetDelta);
        assert.deepEqual(route, original, 'shiftRoutePoints must be pure');
        assertPoint(next[0], shifted(original[0], sourceDelta), 'source endpoint');
        assertPoint(next[next.length - 1], shifted(original[original.length - 1], targetDelta), 'target endpoint');
        const deltasMatch = sourceDelta && targetDelta &&
          sourceDelta.x === targetDelta.x &&
          sourceDelta.y === targetDelta.y;
        const shouldBeOrthogonal = UMLShared.routePointsAreOrthogonal(original, 0.001) || !deltasMatch;
        if (shouldBeOrthogonal) {
          assert.equal(
            UMLShared.routePointsAreOrthogonal(next, 0.001),
            true,
            `route stayed orthogonal for ${JSON.stringify({ route, sourceDelta, targetDelta })}`,
          );
        }
        next.forEach((point) => {
          assert.equal(Number.isFinite(point.x), true, 'x stays finite');
          assert.equal(Number.isFinite(point.y), true, 'y stays finite');
        });
      }
    }
  }
});
