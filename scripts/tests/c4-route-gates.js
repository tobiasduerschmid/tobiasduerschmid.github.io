'use strict';

// The zero-threshold gates of the routing redesign (§9.2, docs/superpowers/specs/2026-11-09-c4-routing-redesign.md)
// as one list of violations, shared by the generated views (c4-route-quality.test.js) and the learner figures
// (c4-route-pages.test.js). Every number comes from the metrics module (c4-route-metrics.js); the thresholds are
// literals here, never read from the router or the placement.

/** Every box with at least three arrows arriving. */
function fanInBoxes(view) {
  return view.nodes.filter((node) => view.edges.filter((edge) => edge.targetId === node.id).length >= 3);
}

/**
 * The violations of every zero-threshold gate of §9.2 on a view `m` (the metrics of `view` and `layout`), with
 * `headsPerSide` arrow tips allowed on one box side (3 on generated views, 2 elsewhere, §9.2).
 */
function zeroGateViolations(m, view, layout, { headsPerSide = 3 } = {}) {
  const s = m.summary;
  const counts = ['touches', 'avoidableBends', 'detachedLabels', 'ambiguousLabels', 'labelOverlaps', 'endSpacingViolations',
    'crowdedApproaches', 'overEnds', 'shortApproaches', 'boundaryHugging', 'excessBoundaryCrossings', 'closeParallels']
    .filter((metric) => s[metric] !== 0).map((metric) => `${metric}: ${s[metric]}`);
  const perSide = [
    s.maxEndsPerSide > 4 ? `${s.maxEndsPerSide} ends on one side` : null,
    s.maxHeadsPerSide > headsPerSide ? `${s.maxHeadsPerSide} heads on one side` : null,
  ].filter(Boolean);
  const oneSided = fanInBoxes(view).filter((node) => Object.keys(s.headSides[node.id] || {}).length < 2)
    .map((node) => `${node.id} receives every head on one side`);
  const perEdge = m.edges.flatMap((edge) => [
    edge.bends > edge.classes.maxBends ? `${edge.id}: ${edge.bends} bends, limit ${edge.classes.maxBends}` : null,
    edge.detour > edge.classes.detourCap ? `${edge.id}: detour ${edge.detour}, cap ${edge.classes.detourCap}` : null,
  ].filter(Boolean));
  const fallbacks = layout.edges.filter((edge) => edge.fallbackRoute !== false || edge.labelFallback !== false)
    .map((edge) => `${edge.id}: fallback route or label`);
  return counts.concat(perSide, oneSided, perEdge, fallbacks);
}

/** A violation's comparable part: its text with the first count or detour replaced by `#`, and that number (0 when none). */
function measuredViolation(violation) {
  const match = /^(.*?: (?:detour )?)(\d+(?:\.\d+)?)(.*)$/.exec(violation);
  return match ? { key: `${match[1]}#${match[3]}`, value: Number(match[2]) } : { key: violation, value: 0 };
}

/**
 * How the `actual` violations (as `zeroGateViolations` writes them) differ from a ratchet's `allowed` ones (routing
 * redesign §9.3, Ruling F1). `beyond`: the violations the ratchet does not cover, a new finding or a count or detour
 * above its pin. `improved`: the pins the view no longer needs in full, each as "<pin> is now <value>" or "<pin> is
 * gone", so a ratchet is lowered as soon as the view gets better and never allows more than the view misses.
 */
function ratchetDrift(actual, allowed) {
  const measured = new Map(actual.map(measuredViolation).map(({ key, value }) => [key, value]));
  const limits = new Map(allowed.map(measuredViolation).map(({ key, value }) => [key, value]));
  const beyond = actual.filter((violation) => {
    const { key, value } = measuredViolation(violation);
    return !limits.has(key) || value > limits.get(key);
  });
  const improved = allowed.flatMap((pin) => {
    const { key, value } = measuredViolation(pin);
    if (!measured.has(key)) return [`${pin} is gone`];
    return measured.get(key) < value ? [`${pin} is now ${measured.get(key)}`] : [];
  });
  return { beyond, improved };
}

module.exports = { fanInBoxes, zeroGateViolations, ratchetDrift };
