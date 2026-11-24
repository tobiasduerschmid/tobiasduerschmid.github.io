'use strict';

// Known answers for the C4 route metrics (routing redesign §5.0, §9.1, §9.2): each test sits on one side of a
// threshold, written here as a literal, so a metric that drifts by one unit fails.

const assert = require('node:assert/strict');
const { test } = require('node:test');
const metrics = require('./c4-route-metrics.js');

const p = (x, y) => ({ x, y });
const box = (x, y, width = 300, height = 120) => ({ x, y, width, height });

/** A scene of 300 × 120 element boxes (top-left corners given), with optional boundaries, laid out down. */
function scene(boxes, edges, extra = {}) {
  return Object.assign({
    boxes, boundaries: {}, boundaryLabels: [], parentOf: {}, direction: 'down',
    edges: edges.map(([source, target]) => ({ id: `${source}→${target}`, source, target })),
  }, extra);
}

test('a proper crossing of two routes counts once', () => {
  const result = metrics.routeIntersections([p(0, 50), p(100, 50)], [p(50, 0), p(50, 100)]);
  assert.deepEqual(result, { crossings: 1, touches: 0 });
});

test('a route passing through the bend of another counts as one crossing', () => {
  const straight = [p(50, 0), p(50, 200)];
  const bent = [p(0, 100), p(50, 100), p(50, 150), p(100, 150)];
  assert.deepEqual(metrics.routeIntersections(straight, bent), { crossings: 1, touches: 0 });
});

test('a route ending on another (a T-junction) is a touch, not a crossing', () => {
  const result = metrics.routeIntersections([p(0, 50), p(100, 50)], [p(50, 0), p(50, 50)]);
  assert.deepEqual(result, { crossings: 0, touches: 1 });
});

test('a collinear overlap of length 10 counts as a crossing', () => {
  const along = [p(0, 50), p(100, 50)];
  const joining = [p(40, 0), p(40, 50), p(50, 50), p(50, 100)];
  assert.deepEqual(metrics.routeIntersections(along, joining), { crossings: 1, touches: 0 });
});

test('a crossing on the end segment of a side port is port-induced, one on a middle jog is not', () => {
  // s→t enters t (x 400..700, y 300..420) by its left side at y 360; w→z runs down at x 300 across it.
  const boxes = { s: box(0, 0), t: box(400, 300), w: box(250, -150, 100, 60), z: box(250, 500, 100, 60) };
  const sideEntry = [p(150, 120), p(150, 360), p(400, 360)];
  const topEntry = [p(150, 120), p(150, 200), p(550, 200), p(550, 300)];
  const down = [p(300, -90), p(300, 500)];
  const acrossLastRun = [p(450, 250), p(650, 250)];
  const flowingDown = scene(boxes, [['s', 't'], ['w', 'z']]);
  assert.equal(metrics.portInducedCrossings(flowingDown, [sideEntry, down]), 1);
  assert.equal(metrics.portInducedCrossings(flowingDown, [topEntry, down]), 0, 'the jog runs between flow sides');
  assert.equal(metrics.portInducedCrossings(flowingDown, [topEntry, acrossLastRun]), 0, 'the top side is a flow side');
  const flowingRight = scene(boxes, [['s', 't'], ['w', 'z']], { direction: 'right' });
  assert.equal(metrics.portInducedCrossings(flowingRight, [topEntry, acrossLastRun]), 1, 'flowing right, the top side is a side port');
});

test('two routes meeting only on the outline of a box both connect to do not intersect', () => {
  const target = box(0, 200);
  const down = [p(150, 0), p(150, 200)];
  const along = [p(-100, 200), p(150, 200)];
  assert.deepEqual(metrics.routeIntersections(down, along, [target]), { crossings: 0, touches: 0 });
  assert.deepEqual(metrics.routeIntersections(down, along), { crossings: 0, touches: 1 }, 'away from a shared box it is a touch');
});

test('a label 6 units from its own route is attached, at 7 it is detached', () => {
  const route = [p(100, 0), p(100, 300)];
  assert.equal(metrics.labelDetached(box(106, 100, 80, 40), route), false);
  assert.equal(metrics.labelDetached(box(107, 100, 80, 40), route), true);
});

test('a foreign route 11 units from a label makes it ambiguous, at 12 it does not', () => {
  const label = box(106, 100, 80, 40);
  assert.equal(metrics.labelAmbiguous(label, [[p(197, 0), p(197, 300)]]), true);
  assert.equal(metrics.labelAmbiguous(label, [[p(198, 0), p(198, 300)]]), false);
});

test('two ends on a 300-unit side stack below 90 units apart', () => {
  // n = 2: the minimum is max(60, 300 / 3 − 10) = 90.
  assert.equal(metrics.stackedEnds([100, 189], 300), 1);
  assert.equal(metrics.stackedEnds([100, 190], 300), 0);
});

test('four ends on a 300-unit side stack below 60 units apart', () => {
  // n = 4: the minimum is max(60, 300 / 5 − 10) = 60.
  assert.equal(metrics.stackedEnds([30, 89, 150, 210], 300), 1);
  assert.equal(metrics.stackedEnds([30, 90, 150, 210], 300), 0);
});

test('a segment along a boundary line hugs it within 29 units over more than 2 units', () => {
  const boundary = box(0, 0, 600, 400);
  const along = (offset, length) => metrics.hugsBoundary([p(100, 400 + offset), p(100 + length, 400 + offset)], boundary);
  assert.equal(along(29, 3), true);
  assert.equal(along(30, 3), false);
  assert.equal(along(29, 2), false);
  assert.equal(along(-29, 3), true, 'inside the boundary counts too');
});

test('an edge whose target lies wholly before its source on the flow axis is upward and exempt', () => {
  const classes = metrics.classify(scene({ s: box(0, 400), t: box(0, 0) }, [['s', 't']]), 's→t');
  assert.equal(classes.upward, true);
  assert.equal(classes.exempt, true);
  assert.equal(classes.maxBends, 4);
  assert.equal(classes.detourCap, 2 * (30 + 24 + 20));
});

test('a downward edge with a clear monotone region is neither blocked nor exempt', () => {
  const classes = metrics.classify(scene({ s: box(0, 0), t: box(500, 300) }, [['s', 't']]), 's→t');
  assert.deepEqual([classes.upward, classes.sameRank, classes.blocked, classes.boundaryEntry, classes.exempt],
    [false, false, false, false, false]);
  assert.equal(classes.maxBends, 2);
  assert.equal(classes.detourCap, 0);
});

test('two boxes side by side with a box between them are same-rank, blocked, and exempt', () => {
  const classes = metrics.classify(scene({ s: box(0, 0), k: box(400, 0, 200, 120), t: box(800, 0) }, [['s', 't']]), 's→t');
  assert.equal(classes.sameRank, true);
  assert.equal(classes.blocked, true);
  assert.equal(classes.blocker, 'k');
  assert.equal(classes.exempt, true);
  // Around a same-rank blocker the detour runs along the flow axis: its half-extent there is 120 / 2.
  assert.equal(classes.detourCap, 2 * (30 + 24 + 20) + 60);
});

test('the widest of several blockers sets the detour cap', () => {
  const boxes = { s: box(0, 0), narrow: box(0, 240, 200, 120), wide: box(250, 240, 360, 120), t: box(300, 500) };
  const classes = metrics.classify(scene(boxes, [['s', 't']], {
    boundaries: { b: box(250, 470, 360, 200) }, parentOf: { t: 'b' },
  }), 's→t');
  assert.equal(classes.blocker, 'wide');
  assert.equal(classes.boundaryEntry, true, 'the boundary holds only the target');
  assert.equal(classes.exempt, true);
  assert.equal(classes.detourCap, 2 * (30 + 24 + 20) + 180);
});

test('a boundary holding neither end that reaches within 30 of the region sizes the detour cap', () => {
  // An upward edge from s to t past a group g that holds neither end: the route must go around the whole group, so
  // the group's half-extent across the flow (700 / 2) sets the cap. The region spans x 0..300; g's band is 30 wide.
  const classify = (groupX) => metrics.classify(scene({ s: box(0, 600), t: box(0, 0) }, [['s', 't']], {
    boundaries: { g: box(groupX, 250, 700, 200) },
  }), 's→t');
  assert.equal(classify(329).detourCap, 2 * (30 + 24 + 20) + 350, 'g 29 units beside the region blocks');
  assert.equal(classify(330).detourCap, 2 * (30 + 24 + 20), 'g 30 units beside the region does not');
  assert.equal(classify(329).blocked, false, 'only element boxes make an edge blocked');
});

test('a boundary holding one end never sizes the detour cap', () => {
  const classes = metrics.classify(scene({ s: box(0, 600), t: box(0, 0) }, [['s', 't']], {
    boundaries: { b: box(-30, -30, 900, 200) }, parentOf: { t: 'b' },
  }), 's→t');
  assert.equal(classes.detourCap, 2 * (30 + 24 + 20));
});

test('a blocked edge inside one boundary is not a boundary entry', () => {
  const boxes = { s: box(0, 0), k: box(0, 240), t: box(0, 480) };
  const classes = metrics.classify(scene(boxes, [['s', 't']], {
    boundaries: { b: box(-30, -30, 360, 660) }, parentOf: { s: 'b', k: 'b', t: 'b' },
  }), 's→t');
  assert.equal(classes.blocked, true);
  assert.equal(classes.boundaryEntry, false);
  assert.equal(classes.exempt, false);
  assert.equal(classes.maxBends, 2);
});

test('two boxes overlapping by 88 with a clear band are straight-capable', () => {
  const band = metrics.straightBand(scene({ s: box(0, 0), t: box(212, 300) }, [['s', 't']]), 's→t');
  assert.equal(band.overlap, 88);
  assert.deepEqual(band.band, [236, 276]);
  assert.equal(band.straightCapable, true);
});

test('the same two boxes with a box across their band are not straight-capable', () => {
  const band = metrics.straightBand(scene({ s: box(0, 0), k: box(150, 180, 200, 60), t: box(212, 300) }, [['s', 't']]), 's→t');
  assert.equal(band.overlap, 88);
  assert.deepEqual(band.clear, []);
  assert.equal(band.straightCapable, false);
});

test('an edge that lands on a boundary is measured against the boundary box', () => {
  const landing = scene({ s: box(0, 0) }, [['s', 'b']], { boundaries: { b: box(-30, 300, 600, 300) } });
  const band = metrics.straightBand(landing, 's→b');
  assert.equal(band.overlap, 300);
  assert.equal(band.straightCapable, true, 'the boundary the edge lands on does not block it');
  assert.equal(metrics.classify(landing, 's→b').upward, false);
});

test('a bend between two boxes that could be joined straight is avoidable', () => {
  const view = {
    direction: 'down',
    nodes: [{ id: 's', type: 'container', boundaryId: null }, { id: 't', type: 'container', boundaryId: null }],
    boundaries: [],
    edges: [{ id: 'e', sourceId: 's', targetId: 't' }],
  };
  const layout = (points) => ({
    nodes: { s: box(0, 0), t: box(100, 300) }, boundaries: {}, boundaryLabels: [],
    edges: [{ id: 'e', points, labelBox: null }], width: 400, height: 420,
  });
  const bent = metrics.analyse(view, layout([p(100, 120), p(100, 210), p(200, 210), p(200, 300)]));
  const straight = metrics.analyse(view, layout([p(200, 120), p(200, 300)]));
  assert.equal(bent.summary.bends, 2);
  assert.equal(bent.summary.avoidableBends, 1);
  assert.equal(straight.summary.avoidableBends, 0);
});

test('a bend is not avoidable when every straight replacement would pass nearer than 12 to another edge\'s label', () => {
  const view = {
    direction: 'down',
    nodes: ['s', 't', 'u', 'v'].map((id) => ({ id, type: 'container', boundaryId: null })),
    boundaries: [],
    edges: [{ id: 'e', sourceId: 's', targetId: 't' }, { id: 'f', sourceId: 'u', targetId: 'v' }],
  };
  // The band where s and t could be joined straight is x 124..276; f's label spans x 110..290 inside it.
  const layout = (labelX) => ({
    nodes: { s: box(0, 0), t: box(100, 300), u: box(700, 0), v: box(700, 300) }, boundaries: {}, boundaryLabels: [],
    edges: [
      { id: 'e', points: [p(60, 120), p(60, 260), p(350, 260), p(350, 300)], labelBox: null },
      { id: 'f', points: [p(850, 120), p(850, 300)], labelBox: { x: labelX, y: 180, width: 180, height: 34 } },
    ],
    width: 1000, height: 420,
  });
  assert.equal(metrics.analyse(view, layout(110)).edges[0].avoidableBend, false, 'the label covers the whole band');
  assert.equal(metrics.analyse(view, layout(288)).edges[0].avoidableBend, true, 'x 124..275 stays 12 from a label at 288');
});
