/*
 * Shared geometry for the hand-drawn figures in the song videos: the
 * architect of "Draw It Out" (architect.js) and the cast of "It Works on My
 * Machine" (opera-cast.js). Outlines are smooth curves through points, and
 * fingers are built from their joints, so every figure's hands keep a real
 * hand's construction: knuckles where a hand's are, bones that run straight
 * between them, and a rounded tip.
 */
(function () {
  'use strict';

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  /**
   * A part of a hand in the hand's own frame (the wrist at (0, 0), the
   * fingers down): its fill, its ink (left open where it runs on into the
   * wrist or the hand, so they join without a line), and its details.
   */
  const handPart = (fill, ink, details = []) => ({ fill, ink, details });

  /** Smooth curves through `points` (a Catmull-Rom spline as cubic Béziers), from the first. */
  function smoothThrough(points) {
    const at = (i) => points[clamp(i, 0, points.length - 1)];
    const xy = ([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`;
    return points.slice(1).map((p, i) => {
      const [a, b, c] = [at(i - 1), at(i), at(i + 2)];
      return `C${xy([b[0] + (p[0] - a[0]) / 6, b[1] + (p[1] - a[1]) / 6])} ${xy([p[0] - (c[0] - b[0]) / 6, p[1] - (c[1] - b[1]) / 6])} ${xy(p)}`;
    }).join(' ');
  }

  /**
   * A finger or thumb in its hand's frame, built from its joints: the
   * centres of its root (inside the hand), of each knuckle, and of its
   * tip, with its half-width at each. Its back is on the side `back` of the
   * way it runs (1: to the screen's left of that way, −1: to its right),
   * where each knuckle rises a little; each joint creases a little in
   * front. A hand part (handPart) whose ink leaves out the root's bone, so
   * the finger runs on into the hand without a line, or as many outline
   * points from the root on each side as `open` ([back, front]) says.
   */
  function finger(joints, widths, back, details, open = [1, 1]) {
    const unit = ([x, y]) => [x / (Math.hypot(x, y) || 1), y / (Math.hypot(x, y) || 1)];
    const along = joints.slice(1).map(([x, y], i) => unit([x - joints[i][0], y - joints[i][1]]));
    const across = ([x, y]) => [y * back, -x * back];
    const out = ([x, y], [nx, ny], w) => [x + nx * w, y + ny * w];
    const backs = [], fronts = [];
    joints.forEach((joint, i) => {
      const [d0, d1] = [along[Math.max(i - 1, 0)], along[Math.min(i, along.length - 1)]];
      const n = across(unit([d0[0] + d1[0], d0[1] + d1[1]]));
      const knuckle = i > 0 && i < joints.length - 1;
      backs.push(out(joint, n, widths[i] + (knuckle ? 0.25 : 0)));
      fronts.push(out(joint, n, -(widths[i] - (knuckle ? 0.12 : 0))));
      if (i === joints.length - 1) return;
      // Halfway along each bone, so it runs straight between its joints.
      const middle = [(joint[0] + joints[i + 1][0]) / 2, (joint[1] + joints[i + 1][1]) / 2];
      const w = (widths[i] + widths[i + 1]) / 2;
      backs.push(out(middle, across(d1), w));
      fronts.push(out(middle, across(d1), -w));
    });
    // Round the tip, from its back to its pad.
    const [tip, w, d] = [joints[joints.length - 1], widths[widths.length - 1], along[along.length - 1]];
    const n = across(d);
    const round = [1, 2, 3, 4].map((k) => {
      const a = Math.PI * k / 5;
      return out(tip, [n[0] * Math.cos(a) + d[0] * Math.sin(a), n[1] * Math.cos(a) + d[1] * Math.sin(a)], w);
    });
    const points = [...backs, ...round, ...fronts.reverse()];
    const from = ([x, y]) => `M${x.toFixed(2)} ${y.toFixed(2)}`;
    const inked = points.slice(open[0], points.length - open[1]);
    return handPart(`${from(points[0])} ${smoothThrough(points)} Z`, `${from(inked[0])} ${smoothThrough(inked)}`, details);
  }

  window.SongFigure = { clamp, handPart, smoothThrough, finger };
})();
