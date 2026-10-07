'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { temporalModel, projectTimeline, compactTimelineScene } = require('../../js/object-reference-graph.js');

function node(id, { width = 100, height = 100, names = 0, slots = [] } = {}) {
  return { id, width, height: height + names, ports: [
    { id: id + ':in', x: 0, y: names + 18 },
    ...slots.map((label, i) => ({ id: id + ':' + label, x: width, y: names + 50 + i * 32 }))
  ] };
}
const edge = (source, label, target) => ({ id: source + ':' + label,
  sources: [source + ':' + label], targets: [target + ':in'] });
const frame = (children, edges = []) => ({ id: 'references', children, edges, layoutOptions: {} });

test('future growth reserves both names and card space without exposing future objects', () => {
  const early = frame([node('list', { names: 30, slots: ['[0]'] }), node('a')], [edge('list', '[0]', 'a')]);
  const later = frame([node('list', { height: 150, names: 60, slots: ['[0]', '[1]'] }),
    node('a'), node('b')], [edge('list', '[0]', 'a'), edge('list', '[1]', 'b')]);
  const plan = temporalModel([early, later]);
  // A hand-positioned result of the external layout engine: projection is our
  // contract, not ELK's choice of coordinates or its internal layout strategy.
  const layout = { ...plan.model, width: 400, height: 300, children: plan.model.children.map((n, i) => ({ ...n, x: i * 120, y: 10 })),
    edges: plan.model.edges.map(e => ({ ...e, sections: [{ startPoint: { x: 100, y: 120 }, endPoint: { x: 120, y: 28 } }] })) };
  const a = projectTimeline(early, plan, layout), b = projectTimeline(later, plan, layout);
  assert.deepEqual(a.children.map(n => n.id), ['list', 'a']);
  assert.deepEqual(a.edges.map(e => e.id), ['list:[0]']);
  const reserved = plan.model.children.find(n => n.id === 'list');
  assert.ok(reserved.height >= 210, 'reserve the largest future aliases plus card');
  assert.equal(a.children[0].y + 30, b.children[0].y + 60, 'the object stays fixed when names are added above it');
  assert.equal(a.children[1].x, b.children[1].x);
  assert.equal(a.children[1].y, b.children[1].y);
});

test('compaction keeps room for future names above an unchanged object', () => {
  const early = frame([node('value')]);
  const later = frame([node('value', { names: 60 })]);
  const plan = temporalModel([early, later]);
  const layout = { ...plan.model, width: 128, height: 188,
    children: plan.model.children.map(child => ({ ...child, x: 14, y: 14 })) };
  const first = compactTimelineScene(projectTimeline(early, plan, layout));
  const next = compactTimelineScene(projectTimeline(later, plan, layout));
  assert.equal(first.children[0].y, next.children[0].y + 60,
    'adding a name must not nudge its unchanged object');
});

test('compact mobile scenes reclaim future alias space while preserving cards and reference geometry', () => {
  const scene = { width: 250, height: 650, kind: 'stacked',
    children: [{ ...node('a'), reservedTop: 100, x: 30, y: 114 },
      { ...node('b'), reservedTop: 120, x: 30, y: 500 }],
    edges: [{ ...edge('a', '[0]', 'b'), sections: [{ startPoint: { x: 130, y: 164 },
      bendPoints: [{ x: 180, y: 164 }, { x: 180, y: 518 }], endPoint: { x: 130, y: 518 } }] }],
    bridges: [{ x: 180, y: 164 }] };
  const result = compactTimelineScene(scene, { preserveAliasSpace: false, padding: 8 });
  const [a, b] = result.children;
  assert.equal(a.y, 8, 'the first current object starts below a small safety inset');
  assert.ok(result.height < 260, 'future aliases must not reserve empty rows on mobile');
  assert.equal(a.height, 100);
  assert.equal(b.height, 100);
  const section = result.edges[0].sections[0];
  assert.deepEqual(section.startPoint, { x: a.x + a.width, y: a.y + 50 });
  assert.deepEqual(section.endPoint, { x: b.x + b.width, y: b.y + 18 });
  assert.deepEqual(result.bridges[0], section.bendPoints[0], 'crossing decorations move with their routes');
  assert.equal(scene.children[0].y, 114, 'the reusable scene is not mutated');
});

test('rebinding and reordered slots retain their actual target and departure height', () => {
  const early = frame([node('list', { slots: ['[0]', '[1]'] }), node('a'), node('b')],
    [edge('list', '[0]', 'a'), edge('list', '[1]', 'b')]);
  const later = frame([node('list', { slots: ['[1]', '[0]'] }), node('a'), node('b')],
    [edge('list', '[0]', 'b'), edge('list', '[1]', 'a')]);
  const before = JSON.stringify([early, later]);
  const plan = temporalModel([early, later]);
  const ports = new Map(plan.model.children.flatMap(n => n.ports.map(p => [p.id, p])));
  const layout = { ...plan.model, width: 500, height: 300,
    children: plan.model.children.map((n, i) => ({ ...n, x: i * 150, y: 0 })),
    edges: plan.model.edges.map(e => ({ ...e, sections: [{ startPoint: { x: 100, y: ports.get(e.sources[0]).y }, endPoint: { x: 150, y: 18 } }] })) };
  for (const model of [early, later]) {
    const result = projectTimeline(model, plan, layout);
    for (const original of model.edges) {
      const actual = result.edges.find(e => e.id === original.id);
      assert.equal(actual.targets[0], original.targets[0]);
      assert.equal(actual.sections[0].startPoint.y, model.children[0].ports.find(p => p.id === original.id).y);
    }
  }
  assert.equal(JSON.stringify([early, later]), before, 'planning never mutates recorded models');
});

test('an empty playback state projects to an empty, compact diagram', () => {
  const empty = frame([]), later = frame([node('future')]);
  const plan = temporalModel([empty, later]);
  const result = projectTimeline(empty, plan, { ...plan.model, width: 200, height: 200,
    children: [{ ...plan.model.children[0], x: 100, y: 100 }] });
  assert.equal(result.children.length, 0);
  assert.equal(result.edges.length, 0);
  assert.ok(result.width <= 28 && result.height <= 28, 'future empty outer space is not rendered');
});

test('vacant future space is reclaimed without resizing cards or detaching orthogonal routes', () => {
  const scene = { width: 230, height: 660, kind: 'stacked',
    children: [ { ...node('a'), x: 30, y: 100 }, { ...node('b'), x: 30, y: 500 } ],
    edges: [{ ...edge('a', '[0]', 'b'), sections: [{ startPoint: { x: 130, y: 150 },
      bendPoints: [{ x: 180, y: 150 }, { x: 180, y: 518 }], endPoint: { x: 130, y: 518 } }] }] };
  const result = compactTimelineScene(scene);
  assert.ok(result.height < 320, 'absent future cards must not leave a tall blank column');
  for (const child of result.children) {
    assert.equal(child.width, 100);
    assert.equal(child.height, 100);
  }
  const [a, b] = result.children, section = result.edges[0].sections[0];
  assert.ok(a.y + a.height + 20 <= b.y, 'readable separation remains');
  assert.deepEqual(section.startPoint, { x: a.x + a.width, y: a.y + 50 });
  assert.deepEqual(section.endPoint, { x: b.x + b.width, y: b.y + 18 });
  const points = [section.startPoint, ...section.bendPoints, section.endPoint];
  points.slice(1).forEach((p, i) => assert.ok(p.x === points[i].x || p.y === points[i].y));
  assert.equal(scene.children[1].y, 500, 'the reusable future plan is immutable');
});
