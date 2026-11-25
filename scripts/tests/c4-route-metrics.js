'use strict';

// Route-quality metrics of a laid-out C4 view (routing redesign §5.0 and §9.2,
// docs/superpowers/specs/2026-11-09-c4-routing-redesign.md). They read only the view model (nodes, boundaries,
// edges, direction) and the final layout (`nodes`, `boundaries`, `boundaryLabels`, `edges[].points`,
// `edges[].labelBox`, `width`, `height`), never the placement or routing modules, so they judge those modules
// independently. Every threshold is written here as a literal; none is read from the engines' CFG objects.

const CORNER_MARGIN = 24;
const STRAIGHT_OVERLAP = 88; // 2 · cornerMargin + slotPitch
const BOX_CLEARANCE = 20;
const BOUNDARY_BAND = 30;
const TRACK_PITCH = 24;
const LABEL_BESIDE_GAP = 6; // also the farthest a label may sit from its own route
const LABEL_FOREIGN_CLEAR = 12;
const LABEL_BOX_CLEAR = 8;
const LABEL_OUTLINE_CLEAR = 4;
const MIN_END_GAP = 60;
const END_SPREAD_TOLERANCE = 10;
const OVER_END_DISTANCE = 8;
const APPROACH_GAP = 48;
const PARALLEL_OVERLAP = 40;
const HEAD_STUB = 30;
const BOUNDARY_RUN_OVERLAP = 2;
const MAX_BENDS = 2;
const MAX_BENDS_EXEMPT = 4;
const LABEL_STEP = 8;

// ---- Polylines ------------------------------------------------------------------------------------------

/** The route's corner points: repeated points and points inside a straight run dropped. */
function simplify(points) {
  const out = [];
  points.forEach((point) => {
    const last = out[out.length - 1];
    if (!last || last.x !== point.x || last.y !== point.y) out.push({ x: point.x, y: point.y });
  });
  for (let index = 1; index < out.length - 1;) {
    const [a, b, c] = [out[index - 1], out[index], out[index + 1]];
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) out.splice(index, 1);
    else index++;
  }
  return out;
}

/** Axis-aligned segments: `at` is the fixed coordinate, `[lo, hi]` the extent along the segment. */
function segmentsOf(points) {
  return points.slice(1).map((to, index) => {
    const from = points[index];
    const horizontal = from.y === to.y;
    return {
      from, to, horizontal,
      at: horizontal ? from.y : from.x,
      lo: horizontal ? Math.min(from.x, to.x) : Math.min(from.y, to.y),
      hi: horizontal ? Math.max(from.x, to.x) : Math.max(from.y, to.y),
    };
  });
}

function bendsOf(points) {
  return Math.max(0, simplify(points).length - 2);
}

function lengthOf(points) {
  return segmentsOf(points).reduce((sum, segment) => sum + segment.hi - segment.lo, 0);
}

/** Route length minus the Manhattan distance of its two ends. */
function detourOf(points) {
  const first = points[0];
  const last = points[points.length - 1];
  return lengthOf(points) - Math.abs(last.x - first.x) - Math.abs(last.y - first.y);
}

function rectOfSegment(segment) {
  return segment.horizontal
    ? { x: segment.lo, y: segment.at, width: segment.hi - segment.lo, height: 0 }
    : { x: segment.at, y: segment.lo, width: 0, height: segment.hi - segment.lo };
}

/** Distance between two axis-aligned rectangles (0 when they touch or overlap). */
function rectDistance(a, b) {
  const dx = Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width));
  const dy = Math.max(0, b.y - (a.y + a.height), a.y - (b.y + b.height));
  return Math.hypot(dx, dy);
}

function routeDistance(rect, points) {
  return Math.min(...segmentsOf(simplify(points)).map((segment) => rectDistance(rect, rectOfSegment(segment))));
}

/** Whether two rectangles share interior area once `a` is inflated by `pad`. */
function overlapsWithPad(a, b, pad) {
  return a.x - pad < b.x + b.width && b.x < a.x + a.width + pad && a.y - pad < b.y + b.height && b.y < a.y + a.height + pad;
}

// ---- Crossings and touches (§9.2) -----------------------------------------------------------------------

const DIRECTIONS = ['N', 'E', 'S', 'W'];

/** The pieces where two segments meet: a point `{x, y}` or a collinear run `{from, to}`; null when apart. */
function meeting(a, b) {
  if (a.horizontal !== b.horizontal) {
    const [h, v] = a.horizontal ? [a, b] : [b, a];
    if (v.at < h.lo || v.at > h.hi || h.at < v.lo || h.at > v.hi) return null;
    return { x: v.at, y: h.at, length: 0 };
  }
  if (a.at !== b.at) return null;
  const lo = Math.max(a.lo, b.lo);
  const hi = Math.min(a.hi, b.hi);
  if (lo > hi) return null;
  return a.horizontal ? { x: lo, y: a.at, toX: hi, toY: a.at, length: hi - lo } : { x: a.at, y: lo, toX: a.at, toY: hi, length: hi - lo };
}

function pieceEnds(piece) {
  return [{ x: piece.x, y: piece.y }, { x: piece.toX === undefined ? piece.x : piece.toX, y: piece.toY === undefined ? piece.y : piece.toY }];
}

function piecesConnect(a, b) {
  const [a0, a1] = pieceEnds(a);
  const [b0, b1] = pieceEnds(b);
  return a0.x <= b1.x && b0.x <= a1.x && a0.y <= b1.y && b0.y <= a1.y;
}

function onOutline(point, box) {
  const inX = point.x >= box.x && point.x <= box.x + box.width;
  const inY = point.y >= box.y && point.y <= box.y + box.height;
  return (inX && (point.y === box.y || point.y === box.y + box.height)) || (inY && (point.x === box.x || point.x === box.x + box.width));
}

/** The compass directions a route leaves `point` in (one at a route end, two elsewhere). */
function directionsAt(segments, point) {
  const found = new Set();
  segments.filter((segment) => (segment.horizontal
    ? point.y === segment.at && point.x >= segment.lo && point.x <= segment.hi
    : point.x === segment.at && point.y >= segment.lo && point.y <= segment.hi))
    .forEach((segment) => [segment.from, segment.to].forEach((end) => {
      if (end.x > point.x) found.add('E');
      else if (end.x < point.x) found.add('W');
      else if (end.y > point.y) found.add('S');
      else if (end.y < point.y) found.add('N');
    }));
  return Array.from(found);
}

/** Whether two routes, each passing through a point in two directions, cross there instead of touching. */
function interleaved(first, second) {
  const [a, b] = first.map((direction) => DIRECTIONS.indexOf(direction)).sort((x, y) => x - y);
  const inside = second.filter((direction) => {
    const index = DIRECTIONS.indexOf(direction);
    return index > a && index < b;
  });
  return inside.length === 1;
}

/**
 * The places where two routes meet (§9.2, zero tolerance), sorted into `crossings` and `touches`, each a list of
 * connected places (every place a list of meeting pieces): a collinear run of any length, or a point where they pass
 * through each other, is a crossing; a point where one ends or where both only turn away from each other is a touch.
 * Points on the outline of a box in `sharedBoxes` (an endpoint of both routes) do not count.
 */
function meetingPlaces(first, second, sharedBoxes = []) {
  const a = segmentsOf(simplify(first));
  const b = segmentsOf(simplify(second));
  const pieces = [];
  a.forEach((sa) => b.forEach((sb) => {
    const piece = meeting(sa, sb);
    if (piece && !pieceEnds(piece).every((end) => sharedBoxes.some((box) => onOutline(end, box)))) pieces.push(piece);
  }));
  const components = [];
  pieces.forEach((piece) => {
    const joined = components.filter((component) => component.some((other) => piecesConnect(piece, other)));
    const merged = [piece].concat(...joined);
    joined.forEach((component) => components.splice(components.indexOf(component), 1));
    components.push(merged);
  });
  const result = { crossings: [], touches: [] };
  components.forEach((component) => {
    if (component.some((piece) => piece.length > 0)) {
      result.crossings.push(component);
      return;
    }
    const point = { x: component[0].x, y: component[0].y };
    const ofFirst = directionsAt(a, point);
    const ofSecond = directionsAt(b, point);
    if (ofFirst.length === 2 && ofSecond.length === 2 && interleaved(ofFirst, ofSecond)) result.crossings.push(component);
    else result.touches.push(component);
  });
  return result;
}

/** How many crossings and touches two routes have (`meetingPlaces`): each connected place counts once. */
function routeIntersections(first, second, sharedBoxes = []) {
  const places = meetingPlaces(first, second, sharedBoxes);
  return { crossings: places.crossings.length, touches: places.touches.length };
}

// ---- Labels (§6.1, §9.2) ----------------------------------------------------------------------------------

/** A label farther than 6 units from its own route. */
function labelDetached(label, ownPoints) {
  return routeDistance(label, ownPoints) > LABEL_BESIDE_GAP;
}

/** A label nearer than 12 units to some other route. */
function labelAmbiguous(label, otherRoutes) {
  return otherRoutes.some((points) => routeDistance(label, points) < LABEL_FOREIGN_CLEAR);
}

function outlineSides(box) {
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  return [
    { x: box.x, y: box.y, width: box.width, height: 0 }, { x: box.x, y: bottom, width: box.width, height: 0 },
    { x: box.x, y: box.y, width: 0, height: box.height }, { x: right, y: box.y, width: 0, height: box.height },
  ];
}

/** Overlaps of one label with boxes, other labels and boundary labels (pad 8), and boundary outlines (pad 4). */
function labelOverlaps(label, obstacles) {
  const solid = obstacles.boxes.concat(obstacles.labels, obstacles.boundaryLabels)
    .filter((other) => overlapsWithPad(label, other, LABEL_BOX_CLEAR)).length;
  const outlines = obstacles.boundaries.flatMap(outlineSides).filter((side) => overlapsWithPad(label, side, LABEL_OUTLINE_CLEAR)).length;
  return solid + outlines;
}

// ---- Ends (§5.2, §9.2) ------------------------------------------------------------------------------------

/** Two ends on one side closer than max(60, side / (n + 1) − 10), counted per neighbouring pair. */
function stackedEnds(coordinates, sideLength) {
  const sorted = coordinates.slice().sort((a, b) => a - b);
  const minimum = Math.max(MIN_END_GAP, sideLength / (sorted.length + 1) - END_SPREAD_TOLERANCE);
  return sorted.slice(1).filter((coordinate, index) => coordinate - sorted[index] < minimum).length;
}

/** The side of `box` a route end lies on, judged by the segment that leaves it; null when it is off the box. */
function endSide(point, next, box) {
  if (point.x === next.x) {
    if (point.x < box.x || point.x > box.x + box.width) return null;
    if (point.y === box.y) return 'top';
    return point.y === box.y + box.height ? 'bottom' : null;
  }
  if (point.y < box.y || point.y > box.y + box.height) return null;
  if (point.x === box.x) return 'left';
  return point.x === box.x + box.width ? 'right' : null;
}

function sideLength(box, side) {
  return side === 'top' || side === 'bottom' ? box.width : box.height;
}

function alongSide(point, side) {
  return side === 'top' || side === 'bottom' ? point.x : point.y;
}

/** The box an edge end attaches to: an element box, or the boundary box an edge lands on. */
function endBox(scene, id) {
  return scene.boxes[id] || scene.boundaries[id];
}

/** Every route end: `{edge, kind: 'tail' | 'head', box, side, point}`. */
function routeEnds(scene, routes) {
  return scene.edges.flatMap((edge, index) => {
    const points = simplify(routes[index]);
    const tail = points[0];
    const head = points[points.length - 1];
    return [
      { edge: index, kind: 'tail', box: edge.source, side: endSide(tail, points[1], endBox(scene, edge.source)), point: tail },
      { edge: index, kind: 'head', box: edge.target, side: endSide(head, points[points.length - 2], endBox(scene, edge.target)), point: head },
    ];
  });
}

function groupBySide(ends) {
  const groups = new Map();
  ends.filter((end) => end.side).forEach((end) => {
    const key = `${end.box}\u0000${end.side}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(end);
  });
  return groups;
}

function endStatistics(scene, routes) {
  const groups = groupBySide(routeEnds(scene, routes));
  let stacked = 0;
  let maxEnds = 0;
  let maxHeads = 0;
  const headSides = {};
  groups.forEach((ends) => {
    const { box, side } = ends[0];
    stacked += stackedEnds(ends.map((end) => alongSide(end.point, side)), sideLength(endBox(scene, box), side));
    maxEnds = Math.max(maxEnds, ends.length);
    const heads = ends.filter((end) => end.kind === 'head').length;
    maxHeads = Math.max(maxHeads, heads);
    if (heads) (headSides[box] = headSides[box] || {})[side] = heads;
  });
  return { stacked, maxEnds, maxHeads, headSides };
}

// ---- Boundaries (§5.1, §9.2) ------------------------------------------------------------------------------

/** A segment parallel to a line of `boundary`, nearer than 30 units, overlapping it by more than 2 units. */
function hugsBoundary(points, boundary) {
  const lines = [
    { horizontal: true, at: boundary.y, lo: boundary.x, hi: boundary.x + boundary.width },
    { horizontal: true, at: boundary.y + boundary.height, lo: boundary.x, hi: boundary.x + boundary.width },
    { horizontal: false, at: boundary.x, lo: boundary.y, hi: boundary.y + boundary.height },
    { horizontal: false, at: boundary.x + boundary.width, lo: boundary.y, hi: boundary.y + boundary.height },
  ];
  return segmentsOf(simplify(points)).some((segment) => lines.some((line) => line.horizontal === segment.horizontal &&
    Math.abs(segment.at - line.at) < BOUNDARY_BAND && Math.min(segment.hi, line.hi) - Math.max(segment.lo, line.lo) > BOUNDARY_RUN_OVERLAP));
}

/** How often a route passes through the outline of `box`. */
function outlineCrossings(points, box) {
  const lines = [
    { horizontal: true, at: box.y, lo: box.x, hi: box.x + box.width },
    { horizontal: true, at: box.y + box.height, lo: box.x, hi: box.x + box.width },
    { horizontal: false, at: box.x, lo: box.y, hi: box.y + box.height },
    { horizontal: false, at: box.x + box.width, lo: box.y, hi: box.y + box.height },
  ];
  return segmentsOf(simplify(points)).reduce((count, segment) => count + lines.filter((line) => line.horizontal !== segment.horizontal &&
    segment.at > line.lo && segment.at < line.hi && line.at > segment.lo && line.at < segment.hi).length, 0);
}

function ancestorsOf(scene, id) {
  const chain = [];
  for (let current = scene.parentOf[id]; current; current = scene.parentOf[current]) chain.push(current);
  return chain;
}

/** Boundaries holding exactly one end of an edge: the ones it must cross, once each. */
function boundariesHoldingOneEnd(scene, edge) {
  const source = new Set(ancestorsOf(scene, edge.source));
  const target = new Set(ancestorsOf(scene, edge.target));
  return Object.keys(scene.boundaries).filter((id) => source.has(id) !== target.has(id));
}

// ---- Flow frame and geometric edge classes (§5.0) ---------------------------------------------------------

/** A box's extents on the flow axis (`main`) and across it (`cross`). */
function inFrame(box, direction) {
  const horizontal = [box.x, box.x + box.width];
  const vertical = [box.y, box.y + box.height];
  return direction === 'right' ? { main: horizontal, cross: vertical } : { main: vertical, cross: horizontal };
}

function rangesOverlap(a, b) {
  return a[0] < b[1] && b[0] < a[1];
}

/**
 * The region between two boxes in the frame: `across` is the axis the boxes face each other on (main, or cross
 * for boxes in one rank), `between` the open range between their facing sides, `along` the union of their ranges
 * on the other axis.
 */
function regionBetween(s, t) {
  const sameRank = rangesOverlap(s.main, t.main);
  const across = sameRank ? 'cross' : 'main';
  const along = sameRank ? 'main' : 'cross';
  const [first, second] = s[across][0] <= t[across][0] ? [s, t] : [t, s];
  return {
    sameRank, across, along,
    between: [first[across][1], second[across][0]],
    union: [Math.min(s[along][0], t[along][0]), Math.max(s[along][1], t[along][1])],
  };
}

function otherBoxes(scene, edge) {
  return Object.keys(scene.boxes).filter((id) => id !== edge.source && id !== edge.target).map((id) => ({ id, box: scene.boxes[id] }));
}

function edgeById(scene, edgeId) {
  const edge = scene.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) throw new Error(`no edge ${edgeId} in the scene`);
  return edge;
}

/** Boundaries holding neither end of an edge (and not landed on by it): obstacles it must go around (§5.1). */
function boundariesHoldingNeitherEnd(scene, edge) {
  const holders = new Set([edge.source, edge.target].concat(ancestorsOf(scene, edge.source), ancestorsOf(scene, edge.target)));
  return Object.keys(scene.boundaries).filter((id) => !holders.has(id)).map((id) => ({ id, box: scene.boundaries[id] }));
}

/**
 * The §5.0 classes of an edge on its final boxes: `upward`, `sameRank`, `span`, `blocked` (with the `blocker`, the
 * blocking box of largest half-extent along the region), `boundaryEntry`, `exempt`, `maxBends`, `detourCap`. The cap
 * is sized by the widest blocker, where a boundary holding neither end, inflated by its 30-unit band, also blocks
 * (Ruling 21); only element boxes make an edge `blocked`.
 */
function classify(scene, edgeId) {
  const edge = edgeById(scene, edgeId);
  const s = inFrame(endBox(scene, edge.source), scene.direction);
  const t = inFrame(endBox(scene, edge.target), scene.direction);
  const region = regionBetween(s, t);
  const upward = t.main[1] <= s.main[0];
  const inRegion = (pad) => ({ frame }) => rangesOverlap([frame[region.across][0] - pad, frame[region.across][1] + pad], region.between) &&
    rangesOverlap([frame[region.along][0] - pad, frame[region.along][1] + pad], region.union);
  const framed = ({ id, box }) => ({ id, frame: inFrame(box, scene.direction) });
  const blockers = otherBoxes(scene, edge).map(framed).filter(inRegion(BOX_CLEARANCE));
  const boundaryBlockers = boundariesHoldingNeitherEnd(scene, edge).map(framed).filter(inRegion(BOUNDARY_BAND));
  const halfExtent = ({ frame }) => (frame[region.along][1] - frame[region.along][0]) / 2;
  const widest = (list) => list.reduce((found, candidate) => (!found || halfExtent(candidate) > halfExtent(found) ? candidate : found), null);
  const blocker = widest(blockers);
  const capBlocker = widest(blockers.concat(boundaryBlockers));
  const blocked = blocker !== null;
  const boundaryEntry = blocked && boundariesHoldingOneEnd(scene, edge).length > 0;
  const exempt = upward || boundaryEntry || (region.sameRank && blocked);
  return {
    upward,
    sameRank: region.sameRank,
    span: region.sameRank ? 0 : Math.max(0, region.between[1] - region.between[0]),
    blocked,
    blocker: blocked ? blocker.id : null,
    boundaryEntry,
    exempt,
    maxBends: exempt ? MAX_BENDS_EXEMPT : MAX_BENDS,
    detourCap: exempt ? 2 * (BOUNDARY_BAND + TRACK_PITCH + BOX_CLEARANCE) + (capBlocker ? halfExtent(capBlocker) : 0) : 0,
  };
}

/** Open intervals on the band axis that a straight line between the facing sides may not use. */
function blockedIntervals(scene, edge, region) {
  const frame = (box) => inFrame(box, scene.direction);
  const intervals = [];
  const blockIf = (ranges, pad) => {
    if (rangesOverlap(ranges[region.across], region.between)) intervals.push([ranges[region.along][0] - pad, ranges[region.along][1] + pad]);
  };
  otherBoxes(scene, edge).forEach(({ box }) => blockIf(frame(box), BOX_CLEARANCE));
  (scene.boundaryLabels || []).forEach((label) => blockIf(frame(label), 0));
  const holders = new Set([edge.source, edge.target].concat(ancestorsOf(scene, edge.source), ancestorsOf(scene, edge.target)));
  Object.keys(scene.boundaries).forEach((id) => {
    const ranges = frame(scene.boundaries[id]);
    if (!holders.has(id)) {
      blockIf(ranges, BOUNDARY_BAND);
      return;
    }
    const run = Math.min(ranges[region.across][1], region.between[1]) - Math.max(ranges[region.across][0], region.between[0]);
    if (run > BOUNDARY_RUN_OVERLAP) ranges[region.along].forEach((line) => intervals.push([line - BOUNDARY_BAND, line + BOUNDARY_BAND]));
  });
  return intervals;
}

/** `[lo, hi]` minus a set of open intervals, as closed intervals. */
function subtractOpen(range, intervals) {
  let free = [range];
  intervals.forEach(([cutLo, cutHi]) => {
    free = free.flatMap(([lo, hi]) => {
      if (cutHi <= lo || cutLo >= hi) return [[lo, hi]];
      const pieces = [];
      if (cutLo >= lo) pieces.push([lo, cutLo]);
      if (cutHi <= hi) pieces.push([cutHi, hi]);
      return pieces;
    });
  });
  return free;
}

/**
 * The straight band of an edge (§5.0): `overlap`, the two boxes' common range on the axis they face each other
 * across; `band`, that range shrunk by the corner margin at each end (null when empty); `clear`, the parts of the
 * band where a straight line between the facing sides stays clear of other element boxes (inflated by 20),
 * boundary labels, boundaries holding neither end (inflated by 30), and the 30-unit bands along the lines of the
 * boundaries it passes; `straightCapable` when the overlap is at least 88 and some part is clear.
 */
function straightBand(scene, edgeId) {
  const edge = edgeById(scene, edgeId);
  const s = inFrame(endBox(scene, edge.source), scene.direction);
  const t = inFrame(endBox(scene, edge.target), scene.direction);
  const region = regionBetween(s, t);
  const lo = Math.max(s[region.along][0], t[region.along][0]);
  const hi = Math.min(s[region.along][1], t[region.along][1]);
  const band = lo + CORNER_MARGIN <= hi - CORNER_MARGIN ? [lo + CORNER_MARGIN, hi - CORNER_MARGIN] : null;
  const clear = band ? subtractOpen(band, blockedIntervals(scene, edge, region)) : [];
  return { overlap: hi - lo, band, clear, straightCapable: hi - lo >= STRAIGHT_OVERLAP && clear.length > 0, region };
}

// ---- One view -----------------------------------------------------------------------------------------------

/** The scene of a laid-out view, in the shape the routing engine reads (§3.2). */
function sceneOf(view, layout) {
  const parentOf = {};
  view.nodes.forEach((node) => { parentOf[node.id] = node.boundaryId || null; });
  view.boundaries.forEach((boundary) => { parentOf[boundary.id] = boundary.parentBoundaryId || null; });
  return {
    boxes: layout.nodes,
    boundaries: layout.boundaries,
    boundaryLabels: layout.boundaryLabels || [],
    parentOf,
    edges: view.edges.map((edge) => ({ id: edge.id, source: edge.sourceId, target: edge.targetId })),
    direction: view.direction || 'down',
  };
}

function sharedEndBoxes(scene, first, second) {
  const ends = [first.source, first.target].filter((id) => id === second.source || id === second.target);
  return ends.map((id) => endBox(scene, id));
}

/** Pairs of parallel segments closer than `gap` overlapping by at least 40 units. */
function closeRuns(firstSegments, secondSegments, gap) {
  let count = 0;
  firstSegments.forEach((a) => secondSegments.forEach((b) => {
    if (a.horizontal === b.horizontal && Math.abs(a.at - b.at) < gap && Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) >= PARALLEL_OVERLAP) count++;
  }));
  return count;
}

function passesNear(points, point) {
  return routeDistance({ x: point.x, y: point.y, width: 0, height: 0 }, points) <= OVER_END_DISTANCE;
}

/** What one route costs against all the others: crossings, touches, over-ends, close parallels. */
function routeCosts(scene, routes, index) {
  const edge = scene.edges[index];
  const costs = { crossings: 0, touches: 0, overEnds: 0, closeParallels: 0 };
  const own = segmentsOf(simplify(routes[index]));
  routes.forEach((points, other) => {
    if (other === index) return;
    const found = routeIntersections(routes[index], points, sharedEndBoxes(scene, edge, scene.edges[other]));
    costs.crossings += found.crossings;
    costs.touches += found.touches;
    const ends = [points[0], points[points.length - 1]];
    costs.overEnds += ends.filter((end) => passesNear(routes[index], end)).length;
    costs.overEnds += [routes[index][0], routes[index][routes[index].length - 1]].filter((end) => passesNear(points, end)).length;
    costs.closeParallels += closeRuns(own, segmentsOf(simplify(points)), TRACK_PITCH);
  });
  return costs;
}

/** Label boxes on or beside a segment (§6.1), at its middle first, then in 8-unit steps outward. */
function labelPositions(segment, size) {
  const extent = segment.hi - segment.lo;
  const along = segment.horizontal ? size.width : size.height;
  const offsets = [];
  for (let step = 0; LABEL_STEP * step <= extent / 2; step++) offsets.push(LABEL_STEP * step, -LABEL_STEP * step);
  return offsets.flatMap((offset) => {
    const centre = (segment.lo + segment.hi) / 2 + offset;
    const start = centre - along / 2;
    if (segment.horizontal) {
      return [segment.at - size.height / 2, segment.at - LABEL_BESIDE_GAP - size.height, segment.at + LABEL_BESIDE_GAP]
        .map((y) => ({ x: start, y, width: size.width, height: size.height }));
    }
    return [segment.at - size.width / 2, segment.at - LABEL_BESIDE_GAP - size.width, segment.at + LABEL_BESIDE_GAP]
      .map((x) => ({ x, y: start, width: size.width, height: size.height }));
  });
}

/** Whether a label of `size` has a legal position on or beside the straight route `points` (§6.1). */
function hasLegalLabel(scene, routes, index, labels, size) {
  const segment = segmentsOf(simplify(routes[index]))[0];
  const others = routes.filter((_, other) => other !== index);
  const obstacles = {
    boxes: Object.values(scene.boxes), labels: labels.filter((label, other) => label && other !== index),
    boundaryLabels: scene.boundaryLabels || [], boundaries: Object.values(scene.boundaries),
  };
  const tip = segment.horizontal ? segment.to.x : segment.to.y;
  return labelPositions(segment, size).some((label) => {
    const [from, to] = segment.horizontal ? [label.x, label.x + label.width] : [label.y, label.y + label.height];
    const onTheLine = routeDistance(label, routes[index]) === 0;
    if (onTheLine && (from - LABEL_BOX_CLEAR < segment.lo || to + LABEL_BOX_CLEAR > segment.hi || Math.min(Math.abs(tip - from), Math.abs(tip - to)) < HEAD_STUB)) return false;
    return labelOverlaps(label, obstacles) === 0 && !labelAmbiguous(label, others);
  });
}

/** A point given in the flow frame, in real coordinates. */
function fromFrame(main, cross, direction) {
  return direction === 'right' ? { x: main, y: cross } : { x: cross, y: main };
}

/** The straight replacement of an edge at band coordinate `at`, from one facing side to the other. */
function straightReplacement(scene, region, at) {
  return region.between.map((value) => (region.across === 'main'
    ? fromFrame(value, at, scene.direction)
    : fromFrame(at, value, scene.direction)));
}

/** Candidate coordinates for a straight replacement: each clear part's middle and ends, and every 8 units. */
function bandCoordinates(clear) {
  return clear.flatMap(([lo, hi]) => {
    const coordinates = [Math.round((lo + hi) / 2), lo, hi];
    for (let at = Math.ceil(lo / LABEL_STEP) * LABEL_STEP; at <= hi; at += LABEL_STEP) coordinates.push(at);
    return coordinates;
  });
}

function sumCosts(costs) {
  return [costs.crossings + costs.touches, costs.overEnds, costs.closeParallels];
}

/** How many labels of edges other than `index` lie nearer than 12 to `points`: labels the route makes ambiguous. */
function foreignLabelsNear(labels, index, points) {
  return labels.filter((label, other) => label && other !== index && labelAmbiguous(label, [points])).length;
}

/**
 * Whether a bent edge could be straight (§9.2 avoidable bends): its straight band is straight-capable, and at some
 * clear coordinate the straight replacement, judged against every other final route and label, adds no crossing,
 * touch, end conflict, over-end or close parallel, makes no other edge's label ambiguous, and its label (if any) has
 * a legal position.
 */
function bendAvoidable(scene, routes, labels, index) {
  const edge = scene.edges[index];
  const band = straightBand(scene, edge.id);
  if (!band.straightCapable) return false;
  const now = sumCosts(routeCosts(scene, routes, index));
  const stackedNow = endStatistics(scene, routes);
  const label = labels[index];
  // The direction of the edge decides which facing side the replacement starts on.
  const forward = inFrame(endBox(scene, edge.source), scene.direction)[band.region.across][0] <= inFrame(endBox(scene, edge.target), scene.direction)[band.region.across][0];
  return bandCoordinates(band.clear).some((at) => {
    const replacement = straightReplacement(scene, band.region, at);
    const trial = routes.slice();
    trial[index] = forward ? replacement : replacement.slice().reverse();
    const costs = sumCosts(routeCosts(scene, trial, index));
    const ends = endStatistics(scene, trial);
    if (costs.some((cost, which) => cost > now[which]) || ends.stacked > stackedNow.stacked || ends.maxEnds > Math.max(4, stackedNow.maxEnds)) return false;
    if (foreignLabelsNear(labels, index, trial[index]) > foreignLabelsNear(labels, index, routes[index])) return false;
    return !label || hasLegalLabel(scene, trial, index, labels, { width: label.width, height: label.height });
  });
}

/** The box sides along the flow, where a route end is a side port: left and right flowing down, top and bottom flowing right. */
function sidePortSides(direction) {
  return direction === 'right' ? ['top', 'bottom'] : ['left', 'right'];
}

/**
 * Crossings on a side port's end segment (routing redesign §9.3, Ruling 21): crossings that lie on the first or last
 * segment of a route whose end attaches to a side along the flow (`sidePortSides`). The bilayer layer crossings
 * model every edge as entering and leaving its boxes on the flow sides, so they never see these.
 */
function portInducedCrossings(scene, routes) {
  const sidePorts = sidePortSides(scene.direction);
  const ends = routeEnds(scene, routes);
  const portSegments = routes.map((points, index) => {
    const segments = segmentsOf(simplify(points));
    return ends.filter((end) => end.edge === index && sidePorts.includes(end.side))
      .map((end) => (end.kind === 'tail' ? segments[0] : segments[segments.length - 1]));
  });
  const onPortSegment = (component, index) => component.some((piece) => pieceEnds(piece)
    .some((point) => portSegments[index].some((segment) => rectDistance({ x: point.x, y: point.y, width: 0, height: 0 }, rectOfSegment(segment)) === 0)));
  return countPairs(routes.length, (first, second) => meetingPlaces(routes[first], routes[second], sharedEndBoxes(scene, scene.edges[first], scene.edges[second]))
    .crossings.filter((component) => onPortSegment(component, first) || onPortSegment(component, second)).length);
}

/** Whether every person's bottom lies before every other element's top on the flow axis. */
function peopleOnTop(view, layout) {
  const direction = view.direction || 'down';
  const people = view.nodes.filter((node) => node.type === 'person').map((node) => inFrame(layout.nodes[node.id], direction));
  const others = view.nodes.filter((node) => node.type !== 'person').map((node) => inFrame(layout.nodes[node.id], direction));
  return people.every((person) => others.every((other) => person.main[1] < other.main[0]));
}

function countPairs(count, measure) {
  let total = 0;
  for (let first = 0; first < count; first++) {
    for (let second = first + 1; second < count; second++) total += measure(first, second);
  }
  return total;
}

/** Two routes ending on one box side whose last two segments run closer than 48 over at least 40 units. */
function crowdedApproaches(scene, routes) {
  const heads = routeEnds(scene, routes).filter((end) => end.kind === 'head' && end.side);
  const approach = (index) => segmentsOf(simplify(routes[index])).slice(-2);
  return countPairs(heads.length, (first, second) => {
    const [a, b] = [heads[first], heads[second]];
    if (a.box !== b.box || a.side !== b.side) return 0;
    return closeRuns(approach(a.edge), approach(b.edge), APPROACH_GAP) > 0 ? 1 : 0;
  });
}

/**
 * Every §9.2 metric of a laid-out view. `view` holds `nodes [{id, type, boundaryId}]`, `boundaries [{id,
 * parentBoundaryId}]`, `edges [{id, sourceId, targetId}]` and `direction`; `layout` is `layoutView`'s result.
 * Returns `{summary, edges}`, where `edges` holds each edge's own numbers and §5.0 classes.
 */
function analyse(view, layout) {
  const scene = sceneOf(view, layout);
  const routes = layout.edges.map((route) => simplify(route.points));
  const labels = layout.edges.map((route) => route.labelBox || null);
  const edges = scene.edges.map((edge, index) => {
    const label = labels[index];
    const others = routes.filter((_, other) => other !== index);
    const obstacles = {
      boxes: Object.values(scene.boxes), labels: labels.filter((other, at) => other && at < index),
      boundaryLabels: scene.boundaryLabels, boundaries: Object.values(scene.boundaries),
    };
    const required = new Set(boundariesHoldingOneEnd(scene, edge));
    const outline = Object.keys(scene.boundaries).reduce((sum, id) => {
      const crossings = outlineCrossings(routes[index], scene.boundaries[id]);
      return sum + Math.max(0, crossings - (required.has(id) ? 1 : 0));
    }, 0);
    const segments = segmentsOf(routes[index]);
    return {
      id: edge.id,
      bends: bendsOf(routes[index]),
      length: lengthOf(routes[index]),
      detour: detourOf(routes[index]),
      classes: classify(scene, edge.id),
      labelDistance: label ? routeDistance(label, routes[index]) : null,
      detachedLabel: Boolean(label) && labelDetached(label, routes[index]),
      ambiguousLabel: Boolean(label) && labelAmbiguous(label, others),
      labelOverlaps: label ? labelOverlaps(label, obstacles) : 0,
      boundaryHugging: Object.values(scene.boundaries).filter((boundary) => hugsBoundary(routes[index], boundary)).length,
      excessBoundaryCrossings: outline,
      shortApproach: segments.length > 0 && segments[segments.length - 1].hi - segments[segments.length - 1].lo < HEAD_STUB,
      avoidableBend: bendsOf(routes[index]) > 0 && bendAvoidable(scene, routes, labels, index),
    };
  });
  const pairwise = { crossings: 0, touches: 0, overEnds: 0, closeParallels: 0 };
  countPairs(routes.length, (first, second) => {
    const found = routeIntersections(routes[first], routes[second], sharedEndBoxes(scene, scene.edges[first], scene.edges[second]));
    pairwise.crossings += found.crossings;
    pairwise.touches += found.touches;
    pairwise.closeParallels += closeRuns(segmentsOf(routes[first]), segmentsOf(routes[second]), TRACK_PITCH);
    return 0;
  });
  routes.forEach((points, index) => routes.forEach((other, at) => {
    if (at !== index) pairwise.overEnds += [other[0], other[other.length - 1]].filter((end) => passesNear(points, end)).length;
  }));
  const ends = endStatistics(scene, routes);
  const sum = (key) => edges.reduce((total, edge) => total + Number(edge[key]), 0);
  return {
    summary: {
      edges: edges.length,
      crossings: pairwise.crossings,
      touches: pairwise.touches,
      bends: sum('bends'),
      avoidableBends: sum('avoidableBend'),
      detachedLabels: sum('detachedLabel'),
      ambiguousLabels: sum('ambiguousLabel'),
      labelOverlaps: sum('labelOverlaps'),
      endSpacingViolations: ends.stacked,
      maxEndsPerSide: ends.maxEnds,
      maxHeadsPerSide: ends.maxHeads,
      headSides: ends.headSides,
      crowdedApproaches: crowdedApproaches(scene, routes),
      overEnds: pairwise.overEnds,
      shortApproaches: sum('shortApproach'),
      boundaryHugging: sum('boundaryHugging'),
      excessBoundaryCrossings: sum('excessBoundaryCrossings'),
      closeParallels: pairwise.closeParallels,
      portInducedCrossings: portInducedCrossings(scene, routes),
      totalDetour: sum('detour'),
      width: layout.width,
      height: layout.height,
      peopleOnTop: peopleOnTop(view, layout),
    },
    edges,
  };
}

module.exports = {
  analyse,
  sceneOf,
  classify,
  straightBand,
  routeIntersections,
  meetingPlaces,
  portInducedCrossings,
  labelDetached,
  labelAmbiguous,
  labelOverlaps,
  stackedEnds,
  hugsBoundary,
  outlineCrossings,
  simplify,
  segmentsOf,
  bendsOf,
  lengthOf,
  detourOf,
  peopleOnTop,
};
