'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { plan } = require('../../js/object-reference-graph.js');

function stackedCards(ids, height = 180) {
  return ids.map((id, index) => ({ id, x: 160, y: index * (height + 32), width: 240, height }));
}

function reference(nodes, id, source, target, slot = 0) {
  const card = nodes.find(node => node.id === source);
  return { id, source, target, start: { x: card.x + card.width + 2, y: card.y + 58 + slot * 28 } };
}

function segments(route) {
  return route.points.slice(1).map((end, index) => ({ start: route.points[index], end }));
}

function segmentEntersCard({ start, end }, card) {
  if (start.x === end.x) {
    return start.x > card.x && start.x < card.x + card.width
      && Math.max(start.y, end.y) > card.y && Math.min(start.y, end.y) < card.y + card.height;
  }
  return start.y > card.y && start.y < card.y + card.height
    && Math.max(start.x, end.x) > card.x && Math.min(start.x, end.x) < card.x + card.width;
}

function interiorCrossing(first, second) {
  const firstHorizontal = first.start.y === first.end.y;
  const secondHorizontal = second.start.y === second.end.y;
  if (firstHorizontal === secondHorizontal) return null;
  const horizontal = firstHorizontal ? first : second;
  const vertical = firstHorizontal ? second : first;
  const x = vertical.start.x;
  const y = horizontal.start.y;
  return x > Math.min(horizontal.start.x, horizontal.end.x)
    && x < Math.max(horizontal.start.x, horizontal.end.x)
    && y > Math.min(vertical.start.y, vertical.end.y)
    && y < Math.max(vertical.start.y, vertical.end.y) ? { x, y } : null;
}

function independentCrossings(routes) {
  const crossings = [];
  routes.forEach((first, index) => {
    routes.slice(index + 1).forEach(second => {
      if (first.target === second.target) return;
      segments(first).forEach(a => segments(second).forEach(b => {
        const point = interiorCrossing(a, b);
        if (point) crossings.push(point);
      }));
    });
  });
  return crossings;
}

function assertCompleteReadableRouting(nodes, references, result) {
  assert.deepEqual(result.routes.map(route => route.id).sort(), references.map(edge => edge.id).sort(),
    'Every original reference must retain its own route');
  const right = Math.max(0, ...nodes.map(node => node.x + node.width));
  result.routes.forEach(route => {
    const original = references.find(edge => edge.id === route.id);
    const target = nodes.find(node => node.id === original.target);
    const last = route.points.at(-1);
    assert.equal(route.source, original.source, route.id + ' preserves its source');
    assert.equal(route.target, original.target, route.id + ' preserves its target');
    assert.deepEqual(route.points[0], original.start, route.id + ' starts at its source port');
    assert.ok(Math.abs(last.x - target.x - target.width) <= 3, route.id + ' lands beside the target card');
    assert.ok(last.y >= target.y && last.y <= target.y + target.height, route.id + ' lands within target height');
    route.points.forEach(point => {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), route.id + ' has finite geometry');
      assert.ok(point.x <= right + result.gutter, route.id + ' fits the reserved gutter');
    });
    segments(route).forEach(segment => {
      assert.ok(segment.start.x === segment.end.x || segment.start.y === segment.end.y,
        route.id + ' uses only horizontal or vertical segments');
      nodes.forEach(card => assert.equal(segmentEntersCard(segment, card), false,
        route.id + ' must not cross card ' + card.id));
    });
  });
  independentCrossings(result.routes).forEach(point => {
    assert.ok(result.bridges.some(bridge => Math.abs(bridge.x - point.x) < 0.01
      && Math.abs(bridge.y - point.y) < 0.01), 'Independent crossing needs a bridge at ' + JSON.stringify(point));
  });
}

test('a nested list slot has an actual arrow ending at object o5', () => {
  const nodes = stackedCards(['o1', 'o5']);
  const references = [reference(nodes, 'o1:[0]', 'o1', 'o5')];
  const result = plan(nodes, references);

  assertCompleteReadableRouting(nodes, references, result);
  assert.ok(result.routes[0].points.some(point => point.y !== references[0].start.y),
    'The arrow must travel to the separate nested-list card');
});

test('distinct references to one shared target converge without losing source arrows', () => {
  const nodes = stackedCards(['first', 'second', 'shared']);
  const references = [reference(nodes, 'first:0', 'first', 'shared'),
    reference(nodes, 'first:1', 'first', 'shared', 1), reference(nodes, 'second:0', 'second', 'shared')];
  const result = plan(nodes, references);

  assertCompleteReadableRouting(nodes, references, result);
  assert.equal(new Set(result.routes.map(route => route.points[1].x)).size, 1,
    'References to one object share a bus');
  assert.equal(new Set(result.routes.map(route => JSON.stringify(route.points.at(-1)))).size, 1,
    'Shared references converge on the same target port');
  assert.equal(result.bridges.length, 0, 'A shared-target join is not marked as an independent crossing');
});

test('a list containing itself gets a visible exterior loop', () => {
  const nodes = stackedCards(['cycle']);
  const references = [reference(nodes, 'cycle:0', 'cycle', 'cycle')];
  const result = plan(nodes, references);

  assertCompleteReadableRouting(nodes, references, result);
  assert.ok(result.routes[0].points.some(point => point.x > nodes[0].x + nodes[0].width + 3),
    'The loop must visibly leave the object before returning');
  assert.notEqual(result.routes[0].points[0].y, result.routes[0].points.at(-1).y,
    'A self-reference must not collapse into a zero-length arrow');
});

test('mutually referencing objects retain both directions outside the cards', () => {
  const nodes = stackedCards(['left', 'right']);
  const references = [reference(nodes, 'left:0', 'left', 'right'), reference(nodes, 'right:0', 'right', 'left')];

  const result = plan(nodes, references);
  assertCompleteReadableRouting(nodes, references, result);
  assert.equal(result.bridges.length, 0, 'A two-object cycle fits without crossings');
});

test('all nine K3,3 references remain visible and independent crossings have bridges', () => {
  const nodes = stackedCards(['a', 'b', 'c', 'x', 'y', 'z']);
  const references = ['a', 'b', 'c'].flatMap(source => ['x', 'y', 'z'].map((target, index) =>
    reference(nodes, source + ':' + index, source, target, index)));
  const result = plan(nodes, references);

  assertCompleteReadableRouting(nodes, references, result);
  assert.ok(independentCrossings(result.routes).length > 0,
    'This nonplanar fixture must exercise the independent-crossing behavior');
});

test('an independent crossing two pixels from a bus endpoint still gets a bridge', () => {
  const nodes = stackedCards(['first-target', 'second-target', 'source']);
  const references = [reference(nodes, 'source:0', 'source', 'first-target'),
    reference(nodes, 'source:1', 'source', 'second-target')];
  references[0].start.y = nodes[2].y + 100;
  references[1].start.y = nodes[2].y + 102;
  const result = plan(nodes, references);

  assertCompleteReadableRouting(nodes, references, result);
  assert.ok(independentCrossings(result.routes).length > 0,
    'Near-endpoint spacing must exercise a real independent crossing');
});

test('an independent bus endpoint touching another shaft is marked as a crossing', () => {
  const nodes = stackedCards(['first-target', 'second-target', 'source']);
  const references = [reference(nodes, 'source:0', 'source', 'first-target'),
    reference(nodes, 'source:1', 'source', 'second-target')];
  references[1].start.y = references[0].start.y;
  const result = plan(nodes, references);
  const inner = result.routes.reduce((a, b) => a.points[1].x < b.points[1].x ? a : b);

  assertCompleteReadableRouting(nodes, references, result);
  assert.ok(result.bridges.some(bridge => bridge.x === inner.points[1].x && bridge.y === references[0].start.y),
    'Different-target buses must not silently appear joined at an endpoint');
});

test('disjoint reference groups reuse space without occupying needless outer lanes', () => {
  const nodes = stackedCards(['a', 'b', 'c', 'd']);
  const references = [reference(nodes, 'a:0', 'a', 'b'), reference(nodes, 'c:0', 'c', 'd')];
  const result = plan(nodes, references);

  assertCompleteReadableRouting(nodes, references, result);
  assert.equal(result.routes[0].points[1].x, result.routes[1].points[1].x,
    'Vertically disjoint buses share a lane to keep the diagram compact');
});

test('bounded randomized sharing, cycles, and varied card sizes preserve all graph edges', () => {
  let seed = 731;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const nodes = stackedCards(Array.from({ length: 24 }, (_, index) => 'o' + index), 300);
  nodes.forEach(node => { node.width = 150 + Math.floor(random() * 140); node.x = 400 - node.width; });
  const references = nodes.flatMap(node => Array.from({ length: 7 }, (_, index) =>
    reference(nodes, node.id + ':' + index, node.id, nodes[Math.floor(random() * nodes.length)].id, index)));
  const result = plan(nodes, references, { clearance: 16, laneGap: 20 });

  assertCompleteReadableRouting(nodes, references, result);
  assert.ok(result.bridges.length > 0, 'The fixture exercises shared routes and crossing bridges');
});

test('an empty graph needs no edges, bridges, or routing gutter', () => {
  const result = plan([], []);

  assert.equal(result.routes.length, 0);
  assert.equal(result.bridges.length, 0);
  assert.equal(result.gutter, 0);
});

test('missing targets produce a diagnostic instead of silently dropping a reference', () => {
  const nodes = stackedCards(['present']);
  const missingTarget = reference(nodes, 'missing-target-edge', 'present', 'absent');

  assert.throws(() => plan(nodes, [missingTarget]), /endpoint is missing.*missing-target-edge/);
});

test('missing sources produce a diagnostic instead of drawing a disconnected arrow', () => {
  const nodes = stackedCards(['present']);
  const missingSource = { id: 'missing-source-edge', source: 'absent', target: 'present', start: { x: 402, y: 60 } };

  assert.throws(() => plan(nodes, [missingSource]), /endpoint is missing.*missing-source-edge/);
});
