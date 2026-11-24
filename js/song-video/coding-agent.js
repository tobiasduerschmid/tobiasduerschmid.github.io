/*
 * The singer of "Meet Me One Level Up": an AI coding agent drawn as a small,
 * friendly robot after the lecture's mascot, in a UCLA Blue hoodie with gold
 * aglets. It is chibi: a glossy pearl helmet about 45 % of its height, with
 * round ear discs ringed in light and a short antenna with a gold bulb; a
 * navy glass visor on which its face glows in cyan; a hoodie torso with the
 * hood down behind the neck, a kangaroo pocket, drawstrings, and a small chest
 * light; and no legs: it hovers on a pearl pod over a pool of cyan light, so
 * it glides from place to place. It is a misplaced genius: fresh out of
 * training (a mortarboard askew on its dome, a rolled diploma and a pen in
 * its pocket) and brand new on site (a lanyard badge that says NEW).
 *
 * Coordinates are figure units, CSS pixels at scale 1, with the origin at the
 * centre of the hover glow on the floor (about 230 units tall). Light comes
 * from the upper left everywhere; the figure is never mirrored as a whole, so
 * `facing` turns the head and leans the body instead.
 *
 * Arms are two bones each, in sleeves built from one shoulder, elbow, and
 * wrist frame (a round outer elbow, an inner crease). Each picture side's arm
 * is solved in its own frame (outward is +x) and mirrored point by point onto
 * the figure, so the lighting stays put. Hands are small 3D models (a palm
 * plate, three fingers, and a thumb, each finger built joint by joint) that
 * turn at the wrist within a wrist's limits, roll about their own axis, and
 * tilt towards the camera; they are projected orthographically and drawn back
 * to front, so a palm, a point, and a grip each read from the right side.
 * Props sit between the palm and the curled fingers.
 *
 * Between gestures its eyes glance aside; the antenna and the tassel follow
 * through after quick moves; hops and cheers squash and stretch. Brief gags
 * ride on its expressions and moves (GAGS): a "ting" on the visor and a
 * tassel flick when it is smug or lectures (with a light bulb), a double take,
 * a "?", and an antenna curled like one when it is confused or lost, a sweat
 * drop when it worries, gears while it thinks, hearts when it is smitten,
 * and a mortarboard that hops off a surprised head.
 *
 * Every frame is a pure function of song time (Timeline.onFrame): blinks,
 * glances, hover, and idle sway come from the song clock and hash01, never
 * from timers or Math.random. Under prefers-reduced-motion the figure holds
 * still, gestures snap to their held poses, the mouth stays closed, and the
 * gags show at most a still version (a "?", a curled antenna, gears, a drop).
 * Styles: css/song-video-coding-agent.css (`.ca-*`).
 *
 *   CodingAgent.wordsOf(storyboard) -> [[start, end], …] every sung word
 *   CodingAgent.agent(parent, options) -> { node, handPoint(side, t) }
 *
 * 'left' and 'right' always mean the picture's (viewer's) left and right.
 */
(function () {
  'use strict';

  const { fx, onFrame, hash01, beats } = window.Timeline;
  const { el, svg } = window.SongKit;
  const { smoothThrough } = window.SongFigure;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let uid = 0;

  // ------------------------------------------------------------------
  // Small geometry helpers (2D vectors are [x, y]; angles in degrees)
  // ------------------------------------------------------------------

  const RAD = Math.PI / 180;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mix = (a, b, u) => a + (b - a) * u;
  const ramp = (t, from, to) => clamp((t - from) / (to - from), 0, 1);
  const smooth = (u) => u * u * (3 - 2 * u);
  /** Minimum-jerk easing: zero velocity and acceleration at both ends. */
  const minimumJerk = (u) => u ** 3 * (10 - 15 * u + 6 * u * u);
  const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const scale = (a, k) => [a[0] * k, a[1] * k];
  const length = (a) => Math.hypot(a[0], a[1]);
  const unit = (a) => { const l = length(a) || 1; return [a[0] / l, a[1] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const lerp2 = (a, b, u) => [mix(a[0], b[0], u), mix(a[1], b[1], u)];
  /** The unit vector `a` degrees from straight down, turning towards +x. */
  const dirOf = (a) => [Math.sin(a * RAD), Math.cos(a * RAD)];
  const angleOf = ([x, y]) => Math.atan2(x, y) / RAD;
  const num = (v) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2));
  const pt = ([x, y]) => `${num(x)} ${num(y)}`;
  const polyline = (points) => `M${points.map(pt).join(' L')}`;

  /** A closed Catmull-Rom loop through `points`, as cubic Béziers. */
  function closedSmooth(points) {
    const n = points.length;
    const at = (i) => points[(i + n) % n];
    let d = `M${pt(points[0])}`;
    for (let i = 0; i < n; i += 1) {
      const [a, b, c, e] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      d += ` C${pt([b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6])} ${pt([c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6])} ${pt(c)}`;
    }
    return `${d} Z`;
  }

  /** A polygon with its corners rounded by quadratic curves of about radius `r`. */
  function roundedPolygon(points, r) {
    const n = points.length;
    let d = '';
    for (let i = 0; i < n; i += 1) {
      const [prev, p, next] = [points[(i - 1 + n) % n], points[i], points[(i + 1) % n]];
      const a = add(p, scale(unit(sub(prev, p)), Math.min(r, length(sub(prev, p)) / 2)));
      const b = add(p, scale(unit(sub(next, p)), Math.min(r, length(sub(next, p)) / 2)));
      d += `${i ? ' L' : 'M'}${pt(a)} Q${pt(p)} ${pt(b)}`;
    }
    return `${d} Z`;
  }

  /** The convex hull of 2D points (monotone chain), counter-clockwise. */
  function convexHull(points) {
    const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const half = (list) => {
      const out = [];
      for (const p of list) {
        while (out.length >= 2 && cross(sub(out[out.length - 1], out[out.length - 2]), sub(p, out[out.length - 2])) <= 0) out.pop();
        out.push(p);
      }
      out.pop();
      return out;
    };
    return [...half(sorted), ...half(sorted.slice().reverse())];
  }

  /** A superellipse loop: `top` and `bottom` set how square each half is. */
  function squircle(cx, cy, rx, ry, top, bottom, count = 48) {
    const points = [];
    for (let k = 0; k < count; k += 1) {
      const a = (k / count) * 2 * Math.PI;
      const c = Math.cos(a), s = Math.sin(a);
      const n = s > 0 ? bottom : top;
      points.push([cx + rx * Math.sign(c) * Math.abs(c) ** (2 / n), cy + ry * Math.sign(s) * Math.abs(s) ** (2 / n)]);
    }
    return closedSmooth(points);
  }

  // 2D affine matrices [a, b, c, d, e, f] as in SVG's matrix().
  const multiply = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  const translation = (x, y) => [1, 0, 0, 1, x, y];
  /** SVG's rotate(deg cx cy): clockwise on screen for a positive angle. */
  const rotation = (deg, cx = 0, cy = 0) => {
    const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD);
    return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
  };
  const scaling = (sx, sy, cx = 0, cy = 0) => [sx, 0, 0, sy, cx - sx * cx, cy - sy * cy];
  const transform = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const matrixAttr = (m) => `matrix(${m.map((v) => v.toFixed(4)).join(' ')})`;

  // 3D vectors for the hands: x right, y down, z towards the camera.
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit3 = (a) => { const l = Math.hypot(...a) || 1; return scale3(a, 1 / l); };

  // ------------------------------------------------------------------
  // Proportions (figure units; picture-right arm frame for the arms)
  // ------------------------------------------------------------------

  const VIEW = { x: -150, y: -262, width: 300, height: 300 };
  /** The helmet; it is drawn `scale` times larger about the neck pivot (chibi). */
  const HEAD = { cx: 0, cy: -160, rx: 56, ry: 47, pivot: [0, -112], scale: 1.07 };
  /** The antenna's stem points and bulb, straight and curled into a "?" (head frame). */
  const ANTENNA = {
    straight: [[0, -204], [0, -208], [0, -212], [0, -215.6], [0, -219]],
    curl: [[0, -204], [0.6, -209.6], [4.6, -214.6], [5.4, -221.4], [1.4, -225.6]],
    bulb: [0, -223.4],
    curlBulb: [-3.6, -224.6],
  };
  /** The head's artwork is drawn this much higher than where it sits on the neck. */
  const HEAD_SEAT = 4;
  const VISOR = { cx: 0, cy: -158, rx: 41, ry: 30.5 };
  const EYES = { y: -163, x: 16, rx: 7.6, ry: 9.6 };
  const MOUTH = { y: -141.5 };
  const ARM = { sx: 30, sy: -93, upper: 25, fore: 23, wShoulder: 8.2, wElbow: 7, wWrist: 5.9 };
  const REACH = ARM.upper + ARM.fore;
  const HEM_Y = -38;
  /** Light comes from the upper left of the picture. */
  const LIGHT = unit([-0.55, -0.83]);

  // ------------------------------------------------------------------
  // Hands: a palm plate, three fingers, and a thumb in 3D
  // ------------------------------------------------------------------

  /*
   * A hand's own frame: the wrist at the origin, +y along the hand to the
   * fingertips, +x across the knuckles towards the thumb, +z out of the palm.
   * In the picture-right arm's frame with no turn, the palm faces the camera
   * and the fingers hang down, so the thumb points outward (+x), as in the
   * anatomical position; the left arm mirrors it, so it is the other hand.
   */
  const HAND = {
    size: 1.15,
    palm: { wrist: 4.5, knuckle: 5.9, y0: 0.6, y1: 10.6, thick: 2.5 },
    fingers: [
      { root: [3.7, 10], spread: 7, bones: [4.3, 3.3, 2.7], half: 2.05 },
      { root: [0, 10.5], spread: 0, bones: [4.6, 3.5, 2.8], half: 2.1 },
      { root: [-3.7, 10], spread: -8, bones: [4.0, 3.1, 2.5], half: 1.95 },
    ],
    thumb: { root: [4.6, 3.6, 1.3], bones: [3.8, 3.3], half: 2.15 },
    fistGrip: [0.4, 8.6, 3.6],
  };

  /*
   * Hand shapes: each finger's [knuckle, middle, tip] curl towards the palm
   * (index, middle, ring), then the thumb's [spread from the index, lift out
   * of the palm's plane, bend across the palm], then how far the fingers fan.
   */
  const GRIPS = {
    rest: [14, 20, 10, 18, 26, 12, 22, 30, 14, 26, 30, 18, 0.8],
    open: [2, 3, 1, 1, 2, 1, 2, 3, 1, 56, 8, 4, 1.2],
    spread: [0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 4, 0, 2],
    cupped: [26, 34, 18, 30, 38, 20, 34, 40, 22, 38, 26, 16, 0.9],
    beckon: [46, 60, 34, 50, 64, 36, 54, 66, 38, 40, 18, 10, 0.8],
    point: [0, 2, 0, 84, 96, 52, 88, 96, 52, 12, 54, 44, 0.4],
    chin: [26, 34, 16, 76, 90, 48, 82, 92, 50, 18, 46, 30, 0.5],
    fist: [82, 96, 56, 86, 98, 56, 88, 98, 56, 14, 58, 46, 0.4],
    grip: [60, 74, 42, 64, 76, 44, 68, 78, 46, 16, 52, 34, 0.4],
    pinch: [40, 46, 24, 60, 68, 38, 70, 76, 42, 26, 46, 26, 0.6],
    heart: [16, 22, 10, 18, 24, 12, 20, 26, 14, 30, 20, 10, 0.6],
  };

  /** Joint centres of a finger, root to tip, in the hand's frame. */
  function fingerJoints(finger, curls, fan) {
    const s = finger.spread * fan * RAD;
    const joints = [[finger.root[0], finger.root[1], 0]];
    let bend = 0;
    finger.bones.forEach((bone, i) => {
      bend += curls[i] * RAD;
      joints.push(add3(joints[i], [bone * Math.sin(s) * Math.cos(bend), bone * Math.cos(s) * Math.cos(bend), bone * Math.sin(bend)]));
    });
    return joints;
  }

  /** Joint centres of the thumb: it spreads, lifts out of the palm, then bends across it. */
  function thumbJoints(spread, lift, bend) {
    const { root, bones } = HAND.thumb;
    const s = spread * RAD, l = lift * RAD, b = bend * RAD;
    const d0 = [Math.sin(s) * Math.cos(l), Math.cos(s) * Math.cos(l), Math.sin(l)];
    const across = [-1, 0.4, 1.1];
    const q = unit3(add3(across, scale3(d0, -dot3(across, d0))));
    const d1 = unit3(add3(scale3(d0, Math.cos(b)), scale3(q, Math.sin(b))));
    const knuckle = add3(root, scale3(d0, bones[0]));
    return [root, knuckle, add3(knuckle, scale3(d1, bones[1]))];
  }

  /**
   * The hand's axes on screen for a hand pointing `angle` degrees from
   * straight down, rolled `roll` degrees about its own axis (90: the thumb's
   * edge faces the camera; 180: the back of the hand does), and tilted
   * `pitch` degrees with its fingers towards the camera.
   */
  function handAxes(angle, roll, pitch) {
    const [cr, sr] = [Math.cos(roll * RAD), Math.sin(roll * RAD)];
    const [cp, sp] = [Math.cos(pitch * RAD), Math.sin(pitch * RAD)];
    const [ca, sa] = [Math.cos(angle * RAD), Math.sin(angle * RAD)];
    const tilt = ([x, y, z]) => [x, y * cp - z * sp, y * sp + z * cp];
    const turn = ([x, y, z]) => [x * ca + y * sa, -x * sa + y * ca, z];
    return { X: turn(tilt([cr, 0, sr])), Y: turn(tilt([0, 1, 0])), Z: turn(tilt([-sr, 0, cr])) };
  }

  /** Projects hand-frame points through `axes` from the wrist `w` (arm frame). */
  function projector(axes, w) {
    const k = HAND.size;
    const { X, Y, Z } = axes;
    return {
      at: ([x, y, z]) => [w[0] + k * (x * X[0] + y * Y[0] + z * Z[0]), w[1] + k * (x * X[1] + y * Y[1] + z * Z[1])],
      depth: ([x, y, z]) => k * (x * X[2] + y * Y[2] + z * Z[2]),
      /** The affine map of the hand's plane z = `z` (for flat details on the palm or its back). */
      plane: (z) => [k * X[0], k * X[1], k * Y[0], k * Y[1], w[0] + k * z * Z[0], w[1] + k * z * Z[1]],
    };
  }

  const PALM_OUTLINE = (() => {
    const { wrist, knuckle, y0, y1 } = HAND.palm;
    return [[-wrist, y0], [wrist, y0], [knuckle, y1 - 3], [knuckle - 1.6, y1], [-knuckle + 1.6, y1], [-knuckle, y1 - 3]];
  })();

  /** The pinch point between the thumb's and the index finger's tips. */
  function pinchPoint(grip) {
    const index = fingerJoints(HAND.fingers[0], grip.slice(0, 3), grip[12]);
    const thumb = thumbJoints(grip[9], grip[10], grip[11]);
    const [a, b] = [index[3], thumb[2]];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  }

  /**
   * Draws one robot hand into `parent` (its steel wrist joint into
   * `wristLayer`, under the cuff); returns { render(state), held } where
   * `held` is the layer for a prop, drawn between the palm and the fingers.
   * render() takes the arm-frame wrist, axes, grip, the side (1 picture
   * right, −1 left: points are mirrored onto the figure), and the picture's
   * light in the arm's frame.
   */
  function buildHand(parent, wristLayer) {
    const g = svg('g', { class: 'ca-hand' }, parent);
    const wrist = svg('path', { class: 'ca-wrist-joint' }, wristLayer);
    const wristShine = svg('path', { class: 'ca-wrist-shine' }, wristLayer);
    const tube = (half, cls) => {
      const part = svg('g', { class: cls }, g);
      const ink = svg('path', { class: 'ca-digit-ink', 'stroke-width': ((2 * half + 1.5) * HAND.size).toFixed(2) }, part);
      const shade = svg('path', { class: 'ca-digit-shade', 'stroke-width': (2 * half * HAND.size).toFixed(2) }, part);
      const body = svg('path', { class: 'ca-digit', 'stroke-width': (1.5 * half * HAND.size).toFixed(2) }, part);
      const shine = svg('path', { class: 'ca-digit-shine', 'stroke-width': (0.55 * half * HAND.size).toFixed(2) }, part);
      const seams = svg('path', { class: 'ca-digit-seam' }, part);
      const joints = svg('path', { class: 'ca-digit-joint' }, part);
      return { node: part, ink, shade, body, shine, seams, joints, half };
    };
    const palmG = svg('g', { class: 'ca-palm' }, g);
    const palm = svg('path', { class: 'ca-palm-plate' }, palmG);
    const pad = svg('path', { class: 'ca-palm-pad', d: roundedPolygon([[-3.8, 3], [3.8, 3], [4.2, 8.8], [-4.2, 8.8]], 2.2) }, palmG);
    const back = svg('g', { class: 'ca-hand-back' }, palmG);
    svg('path', { class: 'ca-hand-back-panel', d: roundedPolygon([[-3.6, 2.6], [3.6, 2.6], [4.4, 8.6], [-4.4, 8.6]], 2) }, back);
    svg('circle', { class: 'ca-hand-back-light', cx: 0, cy: 5.6, r: 1.15 }, back);
    svg('path', { class: 'ca-knuckles', d: 'M-5 9.8 Q-3.7 8.4 -2.2 9.8 M-1.4 10.2 Q0 8.8 1.4 10.2 M2.2 9.8 Q3.7 8.4 5 9.8' }, back);
    const held = svg('g', { class: 'ca-held' }, g);
    const fingers = HAND.fingers.map((f) => tube(f.half, 'ca-finger'));
    const thumb = tube(HAND.thumb.half, 'ca-finger ca-thumb');
    let order = '';

    function drawTube(part, joints, view, light, mirror) {
      const points = joints.map((j) => mirror(view.at(j)));
      const d = polyline(points);
      part.ink.setAttribute('d', d);
      part.shade.setAttribute('d', d);
      const k = part.half * HAND.size;
      part.body.setAttribute('d', polyline(points.map((p) => add(p, scale(light, 0.22 * k)))));
      part.shine.setAttribute('d', polyline(points.map((p) => add(p, scale(light, 0.55 * k)))));
      // Each knuckle the camera can see along its length: a seam across
      // the glove and a small round joint cap on it.
      let seams = '', caps = '';
      for (let i = 1; i < points.length - 1; i += 1) {
        const [a, b] = [sub(points[i], points[i - 1]), sub(points[i + 1], points[i])];
        if (length(a) < 1.2 || length(b) < 1.2) continue;
        const across = scale(unit([-(a[1] + b[1]), a[0] + b[0]]), k * 0.8);
        seams += ` M${pt(add(points[i], across))} L${pt(sub(points[i], across))}`;
        const r = k * 0.42, [cx, cy] = add(points[i], scale(light, 0.2 * k));
        caps += ` M${num(cx - r)} ${num(cy)} a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0 a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0`;
      }
      part.seams.setAttribute('d', seams.trim());
      part.joints.setAttribute('d', caps.trim());
    }

    function render({ w, axes, grip, side, light, propDepth }) {
      const view = projector(axes, w);
      const mirror = ([x, y]) => [side * x, y];
      const mirrorMatrix = (m) => multiply([side, 0, 0, 1, 0, 0], m);
      // The steel wrist joint inside the cuff.
      const wristLine = [mirror(view.at([0, -2.2, 0])), mirror(view.at([0, 1.6, 0]))];
      wrist.setAttribute('d', polyline(wristLine));
      wristShine.setAttribute('d', polyline(wristLine.map((p) => add(p, scale([light[0] * side, light[1]], 1.4)))));
      // The palm plate: the hull of its front and back faces, corners rounded.
      const { thick } = HAND.palm;
      const corners = PALM_OUTLINE.flatMap(([x, y]) => [[x, y, thick], [x, y, -thick]]).map((p) => mirror(view.at(p)));
      palm.setAttribute('d', roundedPolygon(convexHull(corners), 1.8));
      const facing = axes.Z[2];
      pad.setAttribute('transform', matrixAttr(mirrorMatrix(view.plane(thick))));
      pad.setAttribute('opacity', smooth(clamp(facing * 2.5, 0, 1)).toFixed(3));
      back.setAttribute('transform', matrixAttr(mirrorMatrix(view.plane(-thick))));
      back.setAttribute('opacity', smooth(clamp(-facing * 2.5, 0, 1)).toFixed(3));
      // Digits, joint by joint; then sort every part back to front.
      const parts = [{ node: palmG, depth: 0.6 }, { node: held, depth: propDepth ?? view.depth(HAND.fistGrip) }];
      const lit = [light[0] * side, light[1]];
      HAND.fingers.forEach((f, i) => {
        const joints = fingerJoints(f, grip.slice(i * 3, i * 3 + 3), grip[12]);
        drawTube(fingers[i], joints, view, lit, mirror);
        parts.push({ node: fingers[i].node, depth: (view.depth(joints[1]) + view.depth(joints[2]) + view.depth(joints[3])) / 3 + i * 0.01 });
      });
      const tj = thumbJoints(grip[9], grip[10], grip[11]);
      drawTube(thumb, tj, view, lit, mirror);
      parts.push({ node: thumb.node, depth: (view.depth(tj[1]) + view.depth(tj[2])) / 2 + 0.3 });
      parts.sort((a, b) => a.depth - b.depth);
      const key = parts.map((p) => [palmG, held, ...fingers.map((f) => f.node), thumb.node].indexOf(p.node)).join();
      if (key !== order) {
        order = key;
        for (const p of parts) g.append(p.node);
      }
      return view;
    }
    return { render, held };
  }

  // ------------------------------------------------------------------
  // Arms: two bones in a hoodie sleeve
  // ------------------------------------------------------------------

  const limitArm = ([a, b]) => [clamp(a < -60 ? a + 360 : a, -40, 200), clamp(b, -140, 140)];

  /**
   * The [shoulder, elbow] angles that put the wrist on arm-frame point
   * `target` (two-bone inverse kinematics). The shoulder angle runs from
   * hanging (0) outward and up (90 level, 180 overhead); the elbow angle is
   * the forearm's turn from the upper arm's line. `prefer` chooses the elbow
   * ('down', 'up', 'out', 'in'); out of reach, the arm points along the line
   * with a soft elbow.
   */
  function reach(target, prefer = 'down', lift = 0) {
    const s = [ARM.sx, ARM.sy - 4 * lift];
    const D = sub(target, s);
    const full = length(D) || 1;
    const d = clamp(full, Math.abs(ARM.upper - ARM.fore) + 1, REACH - 1.2);
    const toward = angleOf(D);
    const spread = Math.acos(clamp((ARM.upper ** 2 + d ** 2 - ARM.fore ** 2) / (2 * ARM.upper * d), -1, 1)) / RAD;
    const options = [toward + spread, toward - spread].map((a) => ({ a, e: add(s, scale(dirOf(a), ARM.upper)) }));
    const rank = { down: (o) => o.e[1], up: (o) => -o.e[1], out: (o) => o.e[0], in: (o) => -o.e[0] }[prefer];
    options.sort((p, q) => rank(q) - rank(p));
    const { a, e } = options[0];
    const wrist = add(s, scale(D, d / full));
    return limitArm([a, wrap180(angleOf(sub(wrist, e)) - a)]);
  }

  /** Shoulder, elbow, and wrist (arm frame) for [shoulder, elbow] angles. */
  function armJoints([a, b], lift = 0) {
    const s = [ARM.sx, ARM.sy - 4 * lift];
    const e = add(s, scale(dirOf(a), ARM.upper));
    const w = add(e, scale(dirOf(a + b), ARM.fore));
    return { s, e, w, fore: a + b };
  }

  /**
   * The sleeve around shoulder `s`, elbow `e`, and wrist `w`: its outer side
   * rounds the elbow, its inner side creases where the two segments' inner
   * contours meet. Returns its fill outline (with a round cap inside the
   * torso at the shoulder), the two contours, and the crease.
   */
  function sleeveShape(s, e, w) {
    const { wShoulder: wS, wElbow: wE, wWrist: wW } = ARM;
    const d1 = unit(sub(e, s)), d2 = unit(sub(w, e));
    const bendSide = cross(d1, d2) >= 0 ? 1 : -1;
    const n1 = scale([-d1[1], d1[0]], bendSide), n2 = scale([-d2[1], d2[0]], bendSide);
    const halfBend = Math.acos(clamp(dot(d1, d2), -1, 1)) / 2;
    // Where the inner contours meet, measured back from the elbow along each bone.
    const back = wE * Math.tan(halfBend);
    const mid1 = lerp2(s, e, 0.5), mid2 = lerp2(e, w, 0.5);
    const inner = [add(s, scale(n1, wS))];
    if (ARM.upper / 2 > back + 1) inner.push(add(mid1, scale(n1, (wS + wE) / 2)));
    const crease = back < Math.min(ARM.upper, ARM.fore) - 2
      ? add(add(e, scale(n1, wE)), scale(d1, -back))
      : add(e, scale(unit(add(n1, n2)), wE * 1.6));
    inner.push(crease);
    if (ARM.fore / 2 > back + 1) inner.push(add(mid2, scale(n2, (wE + wW) / 2)));
    inner.push(add(w, scale(n2, wW)));
    const outer = [add(s, scale(n1, -wS)), add(mid1, scale(n1, -(wS + wE) / 2))];
    const a1 = Math.atan2(-n1[1], -n1[0]);
    let turn = Math.atan2(-n2[1], -n2[0]) - a1;
    if (turn > Math.PI) turn -= 2 * Math.PI;
    if (turn < -Math.PI) turn += 2 * Math.PI;
    for (let k = 0; k <= 4; k += 1) {
      const a = a1 + (turn * k) / 4;
      outer.push([e[0] + wE * 1.04 * Math.cos(a), e[1] + wE * 1.04 * Math.sin(a)]);
    }
    outer.push(add(mid2, scale(n2, -(wE + wW) / 2)), add(w, scale(n2, -wW)));
    return { d1, d2, n1, n2, inner, outer, crease, back, bendSide };
  }

  /** The sleeve's fill outline: outer contour, cuff end, inner contour, shoulder cap. */
  function sleeveFill(shape) {
    const { inner, outer, d1 } = shape;
    const cap = ARM.wShoulder * 1.33;
    const [i0, o0] = [inner[0], outer[0]];
    return `M${pt(o0)} ${smoothThrough(outer)} L${inner.slice().reverse().map(pt).join(' L')}`
      + ` C${pt(add(i0, scale(d1, -cap)))} ${pt(add(o0, scale(d1, -cap)))} ${pt(o0)} Z`;
  }

  /** A contour trimmed to start `from` units down the upper arm. */
  function trimmed(contour, s, d1, from) {
    const along = (p) => dot(sub(p, s), d1);
    const rest = contour.filter((p, i) => i > 0 && along(p) > from);
    const w = mix(ARM.wShoulder, ARM.wElbow, from / ARM.upper);
    const side = Math.sign(cross(d1, sub(contour[0], s))) || 1;
    const start = add(add(s, scale(d1, from)), scale([-d1[1], d1[0]], w * side));
    return [start, ...rest];
  }

  /**
   * Draws one sleeved arm and its hand; returns { render(pose, extras) } and
   * the hand's prop layer. `under` holds the ink of the shoulder join, drawn
   * beneath the torso's fill so the sleeve and the torso share one outline
   * there. Points are computed in the arm's frame and mirrored onto the
   * figure for the picture's left arm (side −1).
   */
  function buildArm(parent, under, side, paint) {
    const g = svg('g', { class: `ca-arm ca-arm--${side > 0 ? 'right' : 'left'}` }, parent);
    const joinInk = svg('path', { class: 'ca-ink-under' }, under);
    const fill = svg('path', { class: 'ca-sleeve', fill: paint }, g);
    const shade = svg('path', { class: 'ca-sleeve-shade' }, g);
    const light = svg('path', { class: 'ca-sleeve-light' }, g);
    const folds = svg('path', { class: 'ca-sleeve-fold' }, g);
    const ink = svg('path', { class: 'ca-sleeve-ink' }, g);
    const wristLayer = svg('g', {}, g);
    const cuff = svg('path', { class: 'ca-cuff' }, g);
    const cuffRib = svg('path', { class: 'ca-cuff-rib' }, g);
    const hand = buildHand(g, wristLayer);
    const lightArm = [LIGHT[0] * side, LIGHT[1]];
    const mirror = ([x, y]) => [side * x, y];
    const path = (points) => polyline(points.map(mirror));

    function render(pose, lift, handAngle, roll, pitch, grip, propDepth) {
      const { s, e, w } = armJoints(pose, lift);
      const shape = sleeveShape(s, e, w);
      const { d1, d2, n1, n2, inner, outer, crease, bendSide } = shape;
      fill.setAttribute('d', sleeveFill({ ...shape, inner: inner.map(mirror), outer: outer.map(mirror), d1: [d1[0] * side, d1[1]] }));
      // The shoulder join's ink: the cap and the first stretch of both sides.
      const cap = ARM.wShoulder * 1.33;
      const iStart = trimmed(inner, s, d1, 11)[0], oStart = trimmed(outer, s, d1, 11)[0];
      joinInk.setAttribute('d', `M${pt(mirror(iStart))} L${pt(mirror(inner[0]))} C${pt(mirror(add(inner[0], scale(d1, -cap))))} ${pt(mirror(add(outer[0], scale(d1, -cap))))} ${pt(mirror(outer[0]))} L${pt(mirror(oStart))}`);
      // Contours in front of the torso, from below the shoulder join.
      const innerInk = trimmed(inner, s, d1, 9), outerInk = trimmed(outer, s, d1, 9);
      ink.setAttribute('d', `${path(innerInk)} M${pt(mirror(outerInk[0]))} ${smoothThrough(outerInk.map(mirror))}`);
      // Modelling: a light band on each bone's lit side, a shade band on the other.
      const band = (lit) => {
        let d = '';
        [[s, e, n1, ARM.wShoulder, ARM.wElbow, 12], [e, w, n2, ARM.wElbow, ARM.wWrist, 2.5]].forEach(([a, b, n, wa, wb, start]) => {
          const toward = Math.sign(dot(n, lightArm)) || 1;
          const sideSign = lit ? toward : -toward;
          const dir = unit(sub(b, a));
          const from = add(add(a, scale(dir, start)), scale(n, sideSign * (wa - 2.4)));
          const to = add(add(b, scale(dir, -2.5)), scale(n, sideSign * (wb - 2.4)));
          if (dot(sub(to, from), dir) > 1) d += ` M${pt(mirror(from))} L${pt(mirror(to))}`;
        });
        return d.trim();
      };
      light.setAttribute('d', band(true));
      shade.setAttribute('d', band(false));
      // Folds radiate from the inner crease as the elbow bends.
      const bend = Math.acos(clamp(dot(d1, d2), -1, 1)) / RAD;
      const into = unit(scale(add(n1, n2), -1));
      const fold = (deg, len) => {
        const r = rotation(deg * bendSide);
        const dir = transform([r[0], r[1], r[2], r[3], 0, 0], into);
        return `M${pt(mirror(crease))} L${pt(mirror(add(crease, scale(dir, len))))}`;
      };
      folds.setAttribute('d', `${fold(-26, 4.6)} ${fold(18, 3.4)}`);
      folds.setAttribute('opacity', clamp((bend - 30) / 50, 0, 1).toFixed(2));
      // The ribbed cuff around the wrist.
      const across = [-d2[1], d2[0]], cw = ARM.wWrist + 0.8;
      const c0 = add(w, scale(d2, -4.4)), c1 = add(w, scale(d2, 0.4));
      cuff.setAttribute('d', roundedPolygon([add(c0, scale(across, cw)), add(c1, scale(across, cw)), add(c1, scale(across, -cw)), add(c0, scale(across, -cw))].map(mirror), 1.6));
      cuffRib.setAttribute('d', [-0.55, 0, 0.55].map((k) => path([add(add(c0, scale(d2, 0.9)), scale(across, k * cw)), add(add(c1, scale(d2, -0.9)), scale(across, k * cw))])).join(' '));
      const axes = handAxes(handAngle, roll, pitch);
      const view = hand.render({ w: add(w, scale(d2, -0.6)), axes, grip, side, light: lightArm, propDepth });
      return { view, w, axes };
    }
    return { render, held: hand.held, node: g };
  }

  // ------------------------------------------------------------------
  // The face on the visor
  // ------------------------------------------------------------------

  /** Facial parameters, all eased numbers; L and R are the picture's left and right eyes. */
  const FACE = {
    sizeL: 1, sizeR: 1, openL: 1, openR: 1, happyL: 0, happyR: 0, lidL: 0, lidR: 0, slant: 0, heart: 0,
    lookX: 0, lookY: 0, brow: 0, browY: 0, browInL: 0, browInR: 0,
    mouthW: 12, smile: 0.7, open: 0, lift: 0.25, wobble: 0, skew: 0, mouthX: 0, blush: 0, sweat: 0, question: 0, busy: 0, tilt: 0,
  };

  /** Expressions as changes from FACE, drawn for an agent facing 1 (the picture's left). */
  const EXPRESSIONS = {
    neutral: {},
    happy: { happyL: 0.88, happyR: 0.88, mouthW: 16, smile: 1.15, blush: 0.6 },
    joy: { happyL: 1, happyR: 1, mouthW: 18, smile: 1.25, open: 0.78, lift: 0.06, blush: 0.85, tilt: -3 },
    curious: { sizeR: 1.16, sizeL: 0.88, openL: 0.92, brow: 1, browY: -3, browInL: -6, browInR: -14, mouthW: 7, smile: 0.1, open: 0.22, lift: 0.5, tilt: 6, lookX: 0.25 },
    thinking: { lookX: 0.55, lookY: -0.75, lidL: 0.16, lidR: 0.16, brow: 1, browY: -1, browInL: 4, browInR: -12, mouthW: 8, smile: -0.15, mouthX: 4, tilt: 4, busy: 1 },
    worried: { sizeL: 0.95, sizeR: 0.95, brow: 1, browY: -1.5, browInL: 18, browInR: 18, mouthW: 12, smile: -0.55, wobble: 1, open: 0.08, lift: 0.5, sweat: 0.8 },
    sheepish: { lidL: 0.42, lidR: 0.42, happyL: 0.25, happyR: 0.25, lookX: -0.3, lookY: 0.35, mouthW: 10, smile: 0.65, mouthX: -2, blush: 0.75, sweat: 1, tilt: -4, brow: 0.8, browInL: 10, browInR: 10 },
    surprised: { sizeL: 1.16, sizeR: 1.16, openL: 1.1, openR: 1.1, brow: 1, browY: -6, mouthW: 7, smile: 0, open: 0.9, lift: 0.5 },
    wink: { happyR: 1, mouthW: 14, smile: 1.1, open: 0.16, lift: 0.1, blush: 0.4, tilt: -3 },
    love: { heart: 1, mouthW: 14, smile: 1.15, open: 0.32, lift: 0.1, blush: 0.9 },
    focused: { lidL: 0.34, lidR: 0.34, slant: 0.3, brow: 1, browY: 2, browInL: -12, browInR: -12, mouthW: 10, smile: 0.1, busy: 1 },
    /** The misplaced genius, sure of itself: lids half down, one brow up, a lopsided knowing smile. */
    smug: { lidL: 0.5, lidR: 0.46, sizeR: 1.04, lookX: 0.12, brow: 1, browY: -0.5, browInL: 6, browInR: -14, mouthW: 11, smile: 0.95, skew: -0.9, mouthX: 2, tilt: -3 },
    /** New on site and lost: one eye squints, the brows disagree, the mouth wobbles, a "?" pops up. */
    confused: { sizeL: 1.1, lidR: 0.5, sizeR: 0.88, brow: 1, browY: -1.5, browInL: 10, browInR: -16, mouthW: 11, smile: -0.25, wobble: 1, mouthX: -2, question: 1, tilt: 7, lookX: -0.15, lookY: -0.25 },
  };

  /** An expression's full parameters, mirrored for an agent facing −1. */
  function expression(name, facing) {
    const face = { ...FACE, ...(EXPRESSIONS[name] || {}) };
    if (facing > 0) return face;
    const swapped = { ...face };
    for (const [l, r] of [['sizeL', 'sizeR'], ['openL', 'openR'], ['happyL', 'happyR'], ['lidL', 'lidR'], ['browInL', 'browInR']]) {
      swapped[l] = face[r];
      swapped[r] = face[l];
    }
    for (const key of ['lookX', 'mouthX', 'skew', 'tilt']) swapped[key] = -face[key];
    return swapped;
  }

  /**
   * One glowing eye: an oval whose lower lid rises as it smiles (at `happy`
   * 1 only its upper arc is left: ^), whose upper lid can lower and slant
   * (narrowed or sleepy), and which closes as `open` falls to 0.
   */
  function eyePath(cx, cy, rx, ry, open, happy, lid, slant) {
    const top = [], bottom = [];
    const h = ry * open;
    for (let k = 0; k <= 12; k += 1) {
      const a = Math.PI * (1 - k / 12);
      const u = Math.cos(a), v = Math.sin(a);
      const x = cx + rx * u;
      const lidLine = cy - h + lid * 1.5 * h + slant * u * h * 0.5;
      const yt = Math.max(cy - h * v, Math.min(lidLine, cy + h * 0.2));
      const yb = Math.max(yt, cy + h * v * (1 - 2 * happy));
      top.push([x, yt]);
      bottom.push([x, yb]);
    }
    const ring = [...top, ...bottom.slice(1, -1).reverse()];
    return closedSmooth(ring);
  }

  /**
   * The mouth: a smiling (or frowning, or wobbly) line that opens into a D
   * or an O; `skew` raises one corner (a smirk).
   */
  function mouthPath(cx, cy, width, smile, open, lift, wobble, skew = 0) {
    const top = [], bottom = [];
    const height = open * 9;
    for (let k = 0; k <= 10; k += 1) {
      const u = -1 + k / 5;
      const env = Math.sqrt(Math.max(0, 1 - u * u));
      const base = cy + smile * 3.4 * (1 - u * u) + wobble * 1.3 * Math.sin(u * Math.PI * 2) + skew * 2.4 * u;
      top.push([cx + (u * width) / 2, base - height * lift * env]);
      bottom.push([cx + (u * width) / 2, base + height * (1 - lift) * env]);
    }
    return closedSmooth([...top, ...bottom.slice(1, -1).reverse()]);
  }

  /** A gear of radius `r` with `teeth` square-ish teeth and an axle hole. */
  function gearPath(r, teeth) {
    const points = [];
    for (let k = 0; k < teeth * 4; k += 1) {
      const a = (k / (teeth * 4)) * 2 * Math.PI;
      const rr = k % 4 < 2 ? r : r * 0.74;
      points.push([rr * Math.cos(a), rr * Math.sin(a)]);
    }
    const hole = r * 0.34;
    return `${roundedPolygon(points, 0.5)} M${num(hole)} 0 a${num(hole)} ${num(hole)} 0 1 0 ${num(-2 * hole)} 0 a${num(hole)} ${num(hole)} 0 1 0 ${num(2 * hole)} 0 Z`;
  }

  const HEART = 'M0 4.2 C-1.4 3 -7.4 -0.6 -7.4 -5 C-7.4 -8.6 -4.2 -10.2 -1.8 -8.6 C-0.9 -8 -0.3 -7.2 0 -6.6 C0.3 -7.2 0.9 -8 1.8 -8.6 C4.2 -10.2 7.4 -8.6 7.4 -5 C7.4 -0.6 1.4 3 0 4.2 Z';

  // ------------------------------------------------------------------
  // Props (prop frame: the grip at the origin, the prop's up along −y, its
  // side along +x, drawn `size` times larger; placed by the hand's
  // projected axes)
  // ------------------------------------------------------------------

  const PROPS = {
    /** A white mug with a UCLA Blue band, held by its handle, the cup to the side. */
    mug: {
      grip: 'fist', up: [1, 0, 0], side: [0, 1, 0], size: 1.12,
      draw(g) {
        svg('path', { class: 'ca-prop-ink ca-mug-handle', d: 'M3 -6.5 C-2.6 -7.2 -3.6 -1 -3 0.6 C-2.4 3.6 0.4 6.2 3.4 5.8' }, g);
        svg('path', { class: 'ca-mug-handle-fill', d: 'M3 -6.5 C-2.6 -7.2 -3.6 -1 -3 0.6 C-2.4 3.6 0.4 6.2 3.4 5.8' }, g);
        svg('path', { class: 'ca-mug ca-prop-ink-fill', d: 'M3 -11 L21 -11 L20.2 7.6 C20 9.6 18.8 10.4 17 10.4 L7 10.4 C5.2 10.4 4 9.6 3.8 7.6 Z' }, g);
        svg('path', { class: 'ca-mug-band', d: 'M3.3 -3.6 L20.7 -3.6 L20.5 1.4 L3.5 1.4 Z' }, g);
        svg('ellipse', { class: 'ca-mug-coffee', cx: 12, cy: -11, rx: 8.4, ry: 1.9 }, g);
        svg('path', { class: 'ca-mug-shine', d: 'M6.2 -8 L6.6 6.4' }, g);
        const steam = svg('g', { class: 'ca-steam' }, g);
        const wisps = [9, 15].map((x) => svg('path', { class: 'ca-steam-wisp', d: `M${x} -14 C${x - 2.4} -17 ${x + 2.4} -20 ${x} -23 C${x - 2.2} -26 ${x + 1.6} -28 ${x} -30` }, steam));
        return (time, reduced) => wisps.forEach((wisp, i) => {
          const phase = reduced ? 0.4 : ((time / 2.4 + i * 0.5) % 1);
          wisp.setAttribute('transform', `translate(0 ${(-5 * phase).toFixed(2)})`);
          wisp.setAttribute('opacity', (Math.sin(Math.PI * phase) * 0.8).toFixed(2));
        });
      },
    },
    /** A navy hardcover with a gold band, held by its spine; it opens to read. */
    book: {
      grip: 'fist', up: [1, 0, 0], side: [0, 1, 0], size: 1.2,
      draw(g) {
        const closed = svg('g', { class: 'ca-book-closed' }, g);
        svg('path', { class: 'ca-book-pages', d: 'M-2 -24 L15 -24 L15 3 L-2 3 Z' }, closed);
        svg('path', { class: 'ca-book-cover ca-prop-ink-fill', d: 'M-3.6 -25 L14 -25 C15 -25 15.6 -24.4 15.6 -23.4 L15.6 2.4 C15.6 3.4 15 4 14 4 L-3.6 4 Z' }, closed);
        svg('path', { class: 'ca-book-band', d: 'M-3.6 -18 L15.6 -18 L15.6 -14.6 L-3.6 -14.6 Z' }, closed);
        svg('path', { class: 'ca-book-spine', d: 'M-0.6 -25 L-0.6 4' }, closed);
        const open = svg('g', { class: 'ca-book-open' }, g);
        svg('path', { class: 'ca-book-pages', d: 'M0 -24 L-15 -21.6 L-15 3.4 L0 2 L15 3.4 L15 -21.6 Z' }, open);
        svg('path', { class: 'ca-book-cover ca-prop-ink-fill', d: 'M0 -25.6 L-16.6 -22.8 L-16.6 4.6 L0 3 L16.6 4.6 L16.6 -22.8 Z' }, open);
        svg('path', { class: 'ca-book-band', d: 'M-16.6 -15.6 L0 -18.2 L16.6 -15.6 L16.6 -12.4 L0 -15 L-16.6 -12.4 Z' }, open);
        svg('path', { class: 'ca-book-spine', d: 'M0 -25.6 L0 3' }, open);
        return { closed, open };
      },
    },
    /** A white index card with a blue rule and a few grey lines, pinched at a corner. */
    card: {
      grip: 'pinch', up: [1, 0, 0], side: [0, 1, 0], size: 1.1,
      draw(g) {
        const c = svg('g', { transform: 'rotate(-6)' }, g);
        svg('path', { class: 'ca-card ca-prop-ink-fill', d: 'M-2.4 -17 L21 -17 L21 2 L-2.4 2 Z' }, c);
        svg('path', { class: 'ca-card-rule', d: 'M0 -12.6 L18.6 -12.6' }, c);
        svg('path', { class: 'ca-card-line', d: 'M0 -8.2 L16 -8.2 M0 -4.6 L18 -4.6 M0 -1 L12 -1' }, c);
      },
    },
    /** A navy pen with a gold clip, held in a writing grip, its tip forward. */
    pen: {
      grip: 'pinch', up: [0.4, -0.85, -0.3], side: [1, 0, 0], size: 1.2,
      draw(g) {
        svg('path', { class: 'ca-pen ca-prop-ink-fill', d: 'M-2 -21 C-2 -23 2 -23 2 -21 L2 8 L0 13.4 L-2 8 Z' }, g);
        svg('path', { class: 'ca-pen-tip', d: 'M-2 8 L2 8 L0 13.4 Z' }, g);
        svg('path', { class: 'ca-pen-clip', d: 'M1.9 -20 L3.6 -20 L3.6 -8 L1.9 -7.2' }, g);
        svg('path', { class: 'ca-pen-shine', d: 'M-0.8 -19.6 L-0.8 6' }, g);
      },
    },
    /** A magnifying glass: a navy handle with a gold ferrule, a pale lens ringed in steel. */
    magnifier: {
      grip: 'fist', up: [1, 0, 0], side: [0, 1, 0], size: 1.1,
      draw(g) {
        svg('path', { class: 'ca-magnifier-handle ca-prop-ink-fill', d: 'M-2.2 8 L-2.2 -9 L2.2 -9 L2.2 8 C2.2 9.6 -2.2 9.6 -2.2 8 Z' }, g);
        svg('path', { class: 'ca-gold-part ca-prop-ink-fill', d: 'M-2.8 -12.4 L2.8 -12.4 L2.8 -8.6 L-2.8 -8.6 Z' }, g);
        svg('circle', { class: 'ca-lens-ring ca-prop-ink-fill', cx: 0, cy: -23, r: 11 }, g);
        svg('circle', { class: 'ca-lens', cx: 0, cy: -23, r: 8.2 }, g);
        svg('path', { class: 'ca-lens-shine', d: 'M-5 -26.4 C-4 -29 -1.6 -30.4 1 -30.6' }, g);
      },
    },
    /** A glowing stylus: a pearl rod with a cyan tip that twinkles. */
    wand: {
      grip: 'fist', up: [1, 0, 0], side: [0, 1, 0], size: 1.1,
      draw(g) {
        svg('path', { class: 'ca-wand ca-prop-ink-fill', d: 'M-1.8 8 L-1.5 -27 C-1.5 -28.4 1.5 -28.4 1.5 -27 L1.8 8 C1.8 9.6 -1.8 9.6 -1.8 8 Z' }, g);
        svg('path', { class: 'ca-gold-part', d: 'M-1.6 -22 L1.6 -22 L1.6 -19.6 L-1.6 -19.6 Z' }, g);
        svg('circle', { class: 'ca-wand-halo', cx: 0, cy: -30, r: 7.5 }, g);
        svg('circle', { class: 'ca-wand-tip', cx: 0, cy: -30, r: 3.1 }, g);
        const sparkle = svg('path', { class: 'ca-wand-sparkle', d: 'M0 -5 L1.1 -1.1 L5 0 L1.1 1.1 L0 5 L-1.1 1.1 L-5 0 L-1.1 -1.1 Z' }, g);
        return (time, reduced) => {
          const twinkle = reduced ? 0.8 : 0.65 + 0.35 * Math.sin(time * 5.2);
          sparkle.setAttribute('transform', `translate(0 -30) rotate(${reduced ? 0 : ((time * 60) % 90).toFixed(1)}) scale(${twinkle.toFixed(3)})`);
        };
      },
    },
  };

  /**
   * The prop frame's matrix in the arm frame: its up along the projected
   * `up` axis, its side along the projected `side` axis (kept square, not
   * skewed), the grip at `origin`.
   */
  function propMatrix(view, spec, origin) {
    const o = view.at([0, 0, 0]);
    const project = (v) => sub(view.at(v), o);
    let up = project(spec.up);
    let side = project(spec.side);
    if (length(up) < 0.25) up = [-side[1], side[0]];
    up = unit(up);
    const across = [-up[1], up[0]];
    const sign = dot(across, side) >= 0 ? 1 : -1;
    const sx = scale(across, sign);
    const g = view.at(origin);
    const k = spec.size ?? 1;
    return [k * sx[0], k * sx[1], -k * up[0], -k * up[1], g[0], g[1]];
  }

  // ------------------------------------------------------------------
  // Poses and moves
  // ------------------------------------------------------------------

  const REST_ARM = [12, -10];
  const REST_HAND = [0, 118, 4];
  /** The pose at rest; every pose field eases from key to key. */
  const REST = {
    right: REST_ARM, left: REST_ARM, rightHand: REST_HAND, leftHand: REST_HAND,
    rightGrip: GRIPS.rest, leftGrip: GRIPS.rest, rightBack: 0, leftBack: 0, rightOpen: 0, leftOpen: 0,
    look: [0, 0], turn: 0, tilt: 0, nod: 0, lift: 0, bow: 0, hop: 0, squash: 0, stretch: 0,
    // Gags a move switches on: a curled antenna, a sweat drop, thinking gears.
    curl: 0, sweat: 0, gears: 0,
  };

  /** How a free hand holds each prop when no gesture uses it: in front of the belly, thumb up. */
  const CARRY = {
    mug: { wrist: [23, -60], angle: -86, roll: 180, pitch: 16, grip: 'grip' },
    book: { wrist: [26, -62], angle: -92, roll: 180, pitch: 10, grip: 'grip' },
    card: { wrist: [26, -68], angle: -112, roll: 180, pitch: 10, grip: 'pinch' },
    pen: { wrist: [26, -66], angle: -100, roll: 180, pitch: 14, grip: 'pinch' },
    magnifier: { wrist: [30, -64], angle: -92, roll: 180, pitch: 10, grip: 'grip' },
    wand: { wrist: [30, -64], angle: -92, roll: 180, pitch: 10, grip: 'grip' },
  };

  /** Arm, hand, and grip fields for one side: the wrist on `wrist`, the hand `angle` on screen. */
  function armPose(side, wrist, angle, roll, pitch, grip, prefer = 'down', lift = 0) {
    const arm = reach(wrist, prefer, lift);
    const { fore } = armJoints(arm, lift);
    return {
      [side]: arm,
      [`${side}Hand`]: [clamp(wrap180(angle - fore), -75, 75), roll, pitch],
      [`${side}Grip`]: typeof grip === 'string' ? GRIPS[grip] : grip,
    };
  }

  /** The resting fields for a side holding `prop` (or nothing). */
  function restFor(side, prop) {
    const carry = prop && CARRY[prop];
    if (!carry) return { [side]: REST_ARM, [`${side}Hand`]: REST_HAND, [`${side}Grip`]: GRIPS.rest, [`${side}Back`]: 0, [`${side}Open`]: 0 };
    return { ...armPose(side, carry.wrist, carry.angle, carry.roll, carry.pitch, carry.grip), [`${side}Back`]: 0, [`${side}Open`]: 0 };
  }

  const other = (side) => (side === 'right' ? 'left' : 'right');

  /** A hand behind the head, its curled fingers over the helmet's edge above the ear. */
  const SCRATCH = (side) => ({ ...armPose(side, [49, -133], -150, 180, 0, 'cupped', 'out'), [`${side}Back`]: 1 });

  /**
   * The aim of a pointing arm at arm-frame target T: the fingertip on it in
   * reach, else the arm along the line to it; the wrist turns the rest of
   * the way, within its limits.
   */
  function aim(T, extend) {
    const s = [ARM.sx, ARM.sy];
    const D = sub(T, s);
    const wristAt = length(D) <= REACH + extend - 2 ? sub(T, scale(unit(D), extend)) : add(s, scale(unit(D), REACH));
    const arm = reach(wristAt, 'down');
    const { w, fore } = armJoints(arm);
    return { arm, wrist: clamp(wrap180(angleOf(sub(T, w)) - fore), -55, 55), angle: angleOf(sub(T, w)) };
  }

  /**
   * Gestures for agent({ moves }): each returns { keys, waves } for a move
   * landing at song time 0 (the caller shifts it): keys are [start, duration,
   * fields, release?] and waves are additive oscillations
   * { start, end, fields, value(time, envelope) }. `ctx` knows the agent:
   * pick(side, to) chooses an arm, target(side, to) converts a stage point
   * into that arm's frame, look(to) a gaze at it, rest(side, time) the
   * resting fields, and facing.
   */
  const MOVES = {
    wave({ hold = 1.4, side }, ctx) {
      const s = side ?? (ctx.facing > 0 ? 'right' : 'left');
      const sign = s === 'right' ? 1 : -1;
      const arm = [116, 46];
      const pose = { [s]: arm, [`${s}Hand`]: [14, 0, 0], [`${s}Grip`]: GRIPS.spread, tilt: 4 * sign };
      return {
        keys: [[-0.5, 0.5, pose], ...ctx.release(hold, [s]), [hold, 0.4, { tilt: 0 }, true]],
        waves: [wave(0, hold, [`${s}Hand`, s], 2.4, (u) => ({ [`${s}Hand`]: [18 * Math.sin(u), 0, 0], [s]: [0, 5 * Math.sin(u)] }))],
      };
    },
    point({ to, hold = 1.2, side }, ctx) {
      const s = ctx.pick(side, to);
      const { arm, wrist } = aim(ctx.target(s, to), 17);
      return {
        keys: [[-0.45, 0.45, { [s]: arm, [`${s}Hand`]: [wrist, 74, 0], [`${s}Grip`]: GRIPS.point }], [-0.3, 0.3, ctx.look(to)], ...ctx.release(hold, [s]), [hold, 0.4, { look: [0, 0], turn: 0 }, true]],
        waves: [],
      };
    },
    tap(options, ctx) {
      const move = MOVES.point({ ...options, hold: options.hold ?? 1 }, ctx);
      const s = ctx.pick(options.side, options.to);
      move.waves.push(wave(0, options.hold ?? 1, [`${s}Hand`, s], 2.6, (u) => {
        const press = Math.max(0, Math.sin(u));
        return { [`${s}Hand`]: [-10 * press, 0, 0], [s]: [0, -6 * press] };
      }));
      return move;
    },
    present({ to, hold = 1.4, side }, ctx) {
      const s = ctx.pick(side, to);
      const T = ctx.target(s, to);
      const origin = [ARM.sx, ARM.sy];
      const D = sub(T, origin);
      const out = add(origin, scale(unit([D[0], D[1] - 10]), Math.min(length(D) * 0.6, REACH * 0.86)));
      const angle = angleOf(D) + 14;
      const roll = -48 * clamp((180 - angle) / 90, 0, 1);
      return {
        keys: [[-0.5, 0.5, armPose(s, out, angle, roll, 0, 'open')], [-0.3, 0.3, ctx.look(to)], ...ctx.release(hold, [s]), [hold, 0.4, { look: [0, 0], turn: 0 }, true]],
        waves: [],
      };
    },
    beckon({ to, hold = 1.4, side }, ctx) {
      const s = ctx.pick(side, to);
      const T = ctx.target(s, to);
      const origin = [ARM.sx, ARM.sy];
      const D = sub(T, origin);
      // The hand out at chest height on the target's side, palm up, seen
      // from the side so its fingers curl in again and again in profile.
      const out = add(origin, scale(unit([Math.max(D[0], 10), clamp(D[1], -8, 18)]), REACH * 0.74));
      return {
        keys: [[-0.5, 0.5, armPose(s, out, 96, -86, 0, 'open')], [-0.3, 0.3, ctx.look(to)], ...ctx.release(hold, [s]), [hold, 0.4, { look: [0, 0], turn: 0 }, true]],
        waves: [wave(0, hold, [`${s}Grip`], 2, (u) => ({ [`${s}Grip`]: blendGrip(GRIPS.open, GRIPS.beckon, 0.5 - 0.5 * Math.cos(u)) }))],
      };
    },
    /**
     * Both hands held out towards the target, palms up: the near one out at
     * its side at chest height, the far one across the waist, never over
     * the face.
     */
    offer({ to, hold = 1.4 }, ctx) {
      const near = ctx.pick(undefined, to, true);
      const fields = { ...ctx.look(to) };
      Object.assign(fields, armPose(near, [44, -84], 100, -70, 10, 'open'));
      Object.assign(fields, armPose(other(near), [-6, -60], -95, 70, 10, 'open'));
      return { keys: [[-0.5, 0.5, fields], ...ctx.release(hold, ['right', 'left']), [hold, 0.4, { look: [0, 0], turn: 0 }, true]], waves: [] };
    },
    think({ hold = 1.6, side }, ctx) {
      const s = side ?? 'right';
      const sign = s === 'right' ? 1 : -1;
      const pose = { ...armPose(s, [12, -101], -162, 140, 8, 'chin'), tilt: 7 * sign, look: [0.5 * sign, -0.8], gears: 1 };
      return { keys: [[-0.55, 0.55, pose], ...ctx.release(hold, [s]), [hold, 0.45, { tilt: 0, look: [0, 0], gears: 0 }, true]], waves: [] };
    },
    type({ hold = 1.6 }, ctx) {
      const pose = { look: [0, 0.85], nod: 0.3 };
      // Palms down over a keyboard in front, the fingers towards the camera.
      for (const s of ['right', 'left']) Object.assign(pose, armPose(s, [15, -62], -6, 180, 58, 'rest', 'out'));
      return {
        keys: [[-0.45, 0.45, pose], ...ctx.release(hold, ['right', 'left']), [hold, 0.4, { look: [0, 0], nod: 0 }, true]],
        waves: [wave(0, hold, ['right', 'left'], 4.2, (u) => ({ right: [4 * Math.sin(u), 0], left: [4 * Math.sin(u + Math.PI), 0] }))],
      };
    },
    cheer({ hold = 1.2 }, ctx) {
      const pose = {};
      for (const s of ['right', 'left']) Object.assign(pose, { [s]: [118, 34], [`${s}Hand`]: [14, 0, 0], [`${s}Grip`]: GRIPS.spread });
      return {
        keys: [[-0.5, 0.5, pose], ...ctx.release(hold, ['right', 'left'])],
        waves: [wave(0, hold, ['right', 'left'], 2.2, (u) => ({ right: [5 * Math.sin(u), 0], left: [5 * Math.sin(u), 0] })), squashStretch(-0.62)],
      };
    },
    heart({ hold = 1.4 }, ctx) {
      const pose = { tilt: 0, nod: 0.15 };
      for (const s of ['right', 'left']) Object.assign(pose, armPose(s, [15, -76], -146, 180, 0, 'heart', 'down'));
      return { keys: [[-0.5, 0.5, pose], ...ctx.release(hold, ['right', 'left']), [hold, 0.4, { nod: 0 }, true]], waves: [] };
    },
    shrug({ hold = 1 }, ctx) {
      const pose = { lift: 1, tilt: 6 * ctx.facing, look: [0, -0.2] };
      for (const s of ['right', 'left']) Object.assign(pose, armPose(s, [52, -86], 102, -72, 0, 'open', 'down', 1));
      return { keys: [[-0.4, 0.4, pose], ...ctx.release(hold, ['right', 'left']), [hold, 0.45, { lift: 0, tilt: 0, look: [0, 0] }, true]], waves: [] };
    },
    scratch({ hold = 1.4, side }, ctx) {
      const s = side ?? (ctx.facing > 0 ? 'right' : 'left');
      const sign = s === 'right' ? 1 : -1;
      const pose = { ...SCRATCH(s), tilt: -5 * sign, sweat: 1 };
      return {
        keys: [[-0.5, 0.5, pose], ...ctx.release(hold, [s]), [hold, 0.4, { tilt: 0, sweat: 0 }, true]],
        waves: [wave(0.1, hold, [`${s}Hand`], 3.4, (u) => ({ [`${s}Hand`]: [10 * Math.sin(u), 0, 0] }))],
      };
    },
    bow({ hold = 0.9 }, ctx) {
      const pose = { bow: 1, nod: 0.5 };
      for (const s of ['right', 'left']) Object.assign(pose, armPose(s, [10, -58], -70, 170, 0, 'rest'));
      return { keys: [[-0.5, 0.5, pose], ...ctx.release(hold, ['right', 'left']), [hold, 0.5, { bow: 0, nod: 0 }, true]], waves: [] };
    },
    hop({ hold = 0.42 }, ctx) {
      const hops = Math.max(1, Math.round(hold / 0.42));
      const pose = {};
      for (const s of ['right', 'left']) Object.assign(pose, { [s]: [58, 26], [`${s}Hand`]: [0, 0, 0], [`${s}Grip`]: GRIPS.spread });
      return {
        keys: [[-0.35, 0.3, pose], ...ctx.release(hops * 0.42 - 0.1, ['right', 'left'])],
        // A crouch before take-off, a stretch on the way up, a squash on landing.
        waves: [{
          start: -0.42, end: -0.21 + hops * 0.42, fields: ['hop', 'squash', 'stretch'], raw: true,
          value: (time) => {
            const air = time - 0.21;
            if (air < 0) return { squash: bump(time, 0.105, 0.21) };
            const phase = (air / 0.42) % 1;
            return {
              hop: 14 * Math.sin(Math.PI * phase),
              squash: Math.max(0, 1 - Math.min(phase, 1 - phase) / 0.12) * (phase > 0.5 ? 1 : 0.5),
              stretch: Math.sin(Math.PI * Math.min(1, phase * 2)) * (phase < 0.5 ? 1 : 0),
            };
          },
        }],
      };
    },
    read({ hold = 2, side }, ctx) {
      const s = side ?? ctx.holding(['book', 'card']) ?? 'right';
      const pinch = ctx.propAt(s) === 'card';
      const pose = { ...armPose(s, [15, -79], -100, 180, 18, pinch ? 'pinch' : 'grip'), [`${s}Open`]: 1, look: [0, 0.9], nod: 0.35 };
      return { keys: [[-0.5, 0.5, pose], ...ctx.release(hold, [s]), [hold, 0.4, { look: [0, 0], nod: 0 }, true]], waves: [] };
    },
    write({ to, hold = 1.6, side }, ctx) {
      const s = side ?? ctx.holding(['pen']) ?? 'right';
      const T = to ? ctx.target(s, to) : [16, -58];
      const origin = [ARM.sx, ARM.sy];
      const D = sub(T, origin);
      const spot = add(origin, scale(unit(D), Math.min(length(D) - 14, REACH * 0.8)));
      const pose = { ...armPose(s, spot, angleOf(sub(T, spot)) - 10, 100, 0, 'pinch'), look: to ? ctx.look(to).look : [0, 0.8], nod: 0.25 };
      return {
        keys: [[-0.45, 0.45, pose], ...ctx.release(hold, [s]), [hold, 0.4, { look: [0, 0], nod: 0 }, true]],
        waves: [wave(0, hold, [s], 2.6, (u) => ({ [s]: [2.4 * Math.sin(u), 2.4 * Math.cos(u) - 2.4] }))],
      };
    },
    /** "Well, actually": one hand up beside the head, the index finger raised, wagging once or twice. */
    lecture({ hold = 1.4, side }, ctx) {
      const s = side ?? (ctx.facing > 0 ? 'right' : 'left');
      const sign = SIGN[s];
      const pose = { [s]: [52, 108], [`${s}Hand`]: [8, 28, 0], [`${s}Grip`]: GRIPS.point, tilt: -4 * sign, look: [0.2 * sign, -0.35] };
      return {
        keys: [[-0.45, 0.45, pose], ...ctx.release(hold, [s]), [hold, 0.4, { tilt: 0, look: [0, 0] }, true]],
        waves: [wave(0.1, hold, [`${s}Hand`], 2.2, (u) => ({ [`${s}Hand`]: [7 * Math.sin(u), 0, 0] }))],
      };
    },
    /** New on site: looks one way, then the other, then scratches its head. */
    lost({ hold = 2.4, side }, ctx) {
      const s = side ?? (ctx.facing > 0 ? 'right' : 'left');
      const sign = SIGN[s];
      const scratch = SCRATCH(s);
      const after = Math.max(1.4, hold);
      return {
        keys: [
          [-0.3, 0.3, { look: [-1, 0.1], turn: -0.45, curl: 1 }],
          [0.5, 0.35, { look: [1, 0.1], turn: 0.45 }],
          [1.05, 0.35, { look: [0, -0.2], turn: 0, tilt: -6 * sign }],
          [0.95, 0.5, scratch],
          ...ctx.release(after, [s]),
          [after, 0.4, { look: [0, 0], tilt: 0, curl: 0 }, true],
        ],
        waves: [wave(1.45, after, [`${s}Hand`], 3.4, (u) => ({ [`${s}Hand`]: [10 * Math.sin(u), 0, 0] }))],
      };
    },
    look({ dir = -1, hold = 1 }) {
      const fields = dir === 'up' ? { look: [0, -1], nod: -0.3 } : dir === 'down' ? { look: [0, 1], nod: 0.35 } : { look: [dir, 0], turn: 0.4 * dir };
      return { keys: [[-0.25, 0.25, fields], [hold, 0.35, { look: [0, 0], nod: 0, turn: 0 }, true]], waves: [] };
    },
    nod({ hold = 0.7 }) {
      return { keys: [], waves: [{ start: -0.15, end: hold - 0.15, fields: ['nod'], cycles: 2, value: (u, env) => ({ nod: 0.9 * env * Math.sin(u / 2) ** 2 }) }] };
    },
    shake({ hold = 0.8 }) {
      return { keys: [], waves: [wave(-0.1, hold, ['turn'], 2.4, (u, env) => ({ turn: 0.45 * env * Math.sin(u) }))] };
    },
    tilt({ hold = 1.2, dir }, ctx) {
      const angle = 9 * (dir ?? -ctx.facing);
      return { keys: [[-0.3, 0.3, { tilt: angle }], [hold, 0.4, { tilt: 0 }, true]], waves: [] };
    },
    /** A playful turn reads badly in a frontal rig, so it is a hop with the arms out. */
    spin(options, ctx) {
      return MOVES.hop({ hold: options.hold ?? 0.84 }, ctx);
    },
  };

  const blendGrip = (a, b, u) => a.map((v, i) => mix(v, b[i], u));

  /** A bump of height 1 centred on `c`, `w` wide (a raised cosine). */
  const bump = (u, c, w) => (Math.abs(u - c) < w / 2 ? 0.5 + 0.5 * Math.cos((2 * Math.PI * (u - c)) / w) : 0);

  /** Anticipation and release: the body squashes down, then stretches up, over 0.8 s from `start`. */
  function squashStretch(start) {
    return { start, end: start + 0.8, fields: ['squash', 'stretch'], raw: true, value: (time) => ({ squash: bump(time, 0.18, 0.36), stretch: bump(time, 0.48, 0.4) }) };
  }

  /**
   * An additive oscillation over [start, end] at about `hz`, fitted to whole
   * cycles so it ends where it began; `value(phase, envelope)` returns
   * deltas for its fields (phase in radians).
   */
  function wave(start, end, fields, hz, value) {
    return { start, end, fields, hz, value };
  }

  // ------------------------------------------------------------------
  // Tracks: eased keys, oscillations, routes, blinks, mouths
  // ------------------------------------------------------------------

  /**
   * A sampler of pose fields from timed keys [start, duration, fields]:
   * each field eases from its value at the key's start to the key's value,
   * on a minimum-jerk profile, the shoulder leading the elbow and the hand
   * and fingers trailing a little; a key that interrupts another starts from
   * the interrupted pose. Fields without keys hold `base`.
   */
  function keyTrack(keys, base, lagOf = () => 0) {
    const tracks = new Map();
    const sample = (name, t, reduced) => {
      const track = tracks.get(name);
      if (!track) return base[name];
      for (let i = track.length - 1; i >= 0; i -= 1) {
        const key = track[i];
        if (t < key.start) continue;
        const mixOne = (from, to, index = 0) => {
          if (reduced) return to;
          const delay = Math.min(lagOf(name, index), key.duration * 0.25);
          return mix(from, to, minimumJerk(clamp((t - key.start - delay) / Math.max(0.01, key.duration - delay), 0, 1)));
        };
        return Array.isArray(key.to) ? key.from.map((v, j) => mixOne(v, key.to[j], j)) : mixOne(key.from, key.to);
      }
      return base[name];
    };
    for (const [start, duration, fields] of keys.slice().sort((a, b) => a[0] - b[0])) {
      for (const [name, to] of Object.entries(fields)) {
        const from = sample(name, start, false);
        if (!tracks.has(name)) tracks.set(name, []);
        tracks.get(name).push({ start, duration, from, to });
      }
    }
    const all = Object.keys(base);
    return (t, reduced, names = all) => Object.fromEntries(names.map((name) => [name, sample(name, t, reduced)]));
  }

  const ARM_LAG = (name, index) => {
    if (name === 'right' || name === 'left') return index * 0.05;
    if (name.endsWith('Hand')) return 0.05;
    if (name.endsWith('Grip')) return 0.06 + (index % 3) * 0.012;
    return 0;
  };

  /** Adds oscillation `w` (already shifted to song time) into `pose` at t. */
  function applyWave(pose, w, t) {
    if (t < w.start || t > w.end) return;
    const local = t - w.start, span = w.end - w.start;
    let deltas;
    if (w.raw) {
      deltas = w.value(local);
    } else {
      const cycles = w.cycles ?? Math.max(1, Math.round(span * w.hz));
      const envelope = smooth(ramp(t, w.start, w.start + 0.14)) * (1 - smooth(ramp(t, w.end - 0.16, w.end)));
      deltas = w.value((2 * Math.PI * cycles * local) / span, envelope);
      if (w.cycles === undefined) {
        for (const [name, delta] of Object.entries(deltas)) {
          if (!name.endsWith('Grip') && name !== 'turn') deltas[name] = Array.isArray(delta) ? delta.map((v) => v * envelope) : delta * envelope;
        }
      }
    }
    for (const [name, delta] of Object.entries(deltas)) {
      if (!(name in pose)) continue;
      if (name.endsWith('Grip')) pose[name] = blendGrip(pose[name], delta, w.raw ? 1 : smooth(ramp(t, w.start, w.start + 0.14)) * (1 - smooth(ramp(t, w.end - 0.16, w.end))));
      else if (Array.isArray(delta)) pose[name] = pose[name].map((v, i) => v + delta[i]);
      else pose[name] = (pose[name] ?? 0) + delta;
    }
  }

  /** The hover base's stage point at t, and its horizontal speed, along `route`. */
  function routeTrack(x, y, at, route) {
    const legs = [];
    let from = [x, y], previous = at;
    for (const [when, rx, ry, duration] of route.slice().sort((a, b) => a[0] - b[0])) {
      const start = Math.max(when - (duration ?? 0.8), previous);
      legs.push({ start, end: when, from, to: [rx, ry] });
      from = [rx, ry];
      previous = when;
    }
    return (t, reduced) => {
      let place = [x, y], vx = 0;
      for (const leg of legs) {
        if (t >= leg.end) { place = leg.to; continue; }
        if (t <= leg.start || reduced) break;
        const span = Math.max(0.05, leg.end - leg.start);
        const u = (t - leg.start) / span;
        place = lerp2(leg.from, leg.to, minimumJerk(u));
        vx = ((leg.to[0] - leg.from[0]) * 30 * u * u * (1 - u) ** 2) / span;
        break;
      }
      return { place, vx };
    };
  }

  /** Blink times on song time, every 4–7 s, now and then a double blink. */
  function blinkTimes(seed, from, to) {
    const times = [];
    let t = from + 1.1 + 2 * hash01(seed);
    for (let k = 0; t < to && k < 2000; k += 1) {
      times.push(t);
      if (hash01(seed + 7919 + k) < 0.18) times.push(t + 0.3);
      t += 4 + 3 * hash01(seed + 104729 + k);
    }
    return times;
  }

  /** How open the eyes are at t (1 open, 0 shut) given sorted blink times. */
  function blinkAt(times, t) {
    let lo = 0, hi = times.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (found < 0) return 1;
    const age = t - times[found];
    if (age > 0.2) return 1;
    return age < 0.07 ? 1 - smooth(age / 0.07) * 0.94 : 0.06 + 0.94 * smooth((age - 0.07) / 0.13);
  }

  /** Idle glances: every 3–6 s the eyes dart aside for a moment (and the head tips with them). */
  function glanceTimes(seed, from, to) {
    const glances = [];
    let t = from + 2.2 + 2 * hash01(seed);
    for (let k = 0; t < to && k < 2000; k += 1) {
      const h = (n) => hash01(seed + 31 * k + n);
      glances.push({ at: t, hold: 0.6 + 0.5 * h(1), dx: (h(2) - 0.5) * 1.5, dy: (h(3) - 0.5) * 0.7 });
      t += 3.2 + 3 * h(4);
    }
    return glances;
  }

  /** The glance's [x, y] gaze offset at t: a quick dart out, a hold, a quick return. */
  function glanceAt(glances, t) {
    let lo = 0, hi = glances.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (glances[mid].at <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (found < 0) return [0, 0];
    const { at: start, hold, dx, dy } = glances[found];
    const age = t - start;
    const k = smooth(clamp(age / 0.08, 0, 1)) * (1 - smooth(clamp((age - hold) / 0.14, 0, 1)));
    return [dx * k, dy * k];
  }

  /**
   * Brief gags, each a shape over its own span from its cue: the smug
   * "ting" on the visor, the tassel's flick, a confused double take, the
   * mortarboard hopping off a surprised head, a lecture's light bulb.
   */
  const GAGS = {
    ting: { span: 0.6, value: (u) => bump(u, 0.24, 0.48) },
    flick: { span: 1.5, value: (u) => Math.exp(-u / 0.32) * Math.sin((2 * Math.PI * u) / 0.44) },
    doubleTake: { span: 0.8, value: (u) => Math.sin((2 * Math.PI * u) / 0.36) * (1 - smooth(u / 0.8)) },
    capHop: { span: 0.85, value: (u) => (u < 0.45 ? Math.sin((Math.PI * u) / 0.45) : 0.18 * Math.max(0, Math.sin((Math.PI * (u - 0.45)) / 0.24))) },
    idea: { span: 0.8, value: (u) => (u < 0.16 ? 1 + 1.7 * (u / 0.16 - 1) ** 3 + 0.7 * (u / 0.16 - 1) ** 2 : 1) * (1 - smooth(clamp((u - 0.58) / 0.22, 0, 1))) },
  };
  /** Which gags an expression or a move cues, and how long after its cue. */
  const FACE_GAGS = { smug: [['ting', 0], ['flick', 0]], confused: [['doubleTake', 0]], surprised: [['capHop', 0]] };
  const MOVE_GAGS = { lecture: [['ting', 0], ['flick', 0.05], ['idea', -0.15]], lost: [['doubleTake', 0.5]] };

  /** The cued gags of an agent's faces and moves, sorted by kind: { kind: [times] }. */
  function gagCues(faces, moves) {
    const cues = Object.fromEntries(Object.keys(GAGS).map((kind) => [kind, []]));
    for (const [when, name] of faces) for (const [kind, delay] of FACE_GAGS[name] || []) cues[kind].push(when + delay);
    for (const [when, name] of moves) for (const [kind, delay] of MOVE_GAGS[name] || []) cues[kind].push(when + delay);
    return cues;
  }

  /** A gag's value at t: the sum over its cues still within its span. */
  function gagAt(cues, kind, t) {
    const { span, value } = GAGS[kind];
    let total = 0;
    for (const when of cues[kind]) if (t >= when && t < when + span) total += value(t - when);
    return total;
  }

  /**
   * Every sung word's [start, end] in a storyboard: each line's marks, a
   * word lasting until the next starts, the last until its line ends.
   */
  function wordsOf(storyboard) {
    const words = [];
    for (const section of storyboard.sections) {
      for (const line of section.lines) {
        const times = Object.values(line.marks || {}).sort((a, b) => a - b);
        times.forEach((at, i) => words.push([at, i + 1 < times.length ? times[i + 1] : line.end]));
      }
    }
    return words.sort((a, b) => a[0] - b[0]);
  }

  /** How open the mouth is at t (0 to 1): each word opens it quickly and closes it before the next. */
  function mouthAt(words, t) {
    let lo = 0, hi = words.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (words[mid][0] <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (found < 0) return 0;
    const [start, end] = words[found];
    if (t >= end) return 0;
    const span = Math.max(0.08, end - start), age = t - start;
    const peak = span > 0.8 ? 0.85 : span > 0.35 ? 0.7 : 0.5;
    const closeFrom = span > 0.8 ? span - 0.14 : span * 0.62;
    const fall = age < closeFrom ? 1 : Math.max(0, 1 - (age - closeFrom) / Math.max(0.05, span - closeFrom));
    const wobble = span > 0.8 ? 0.06 * Math.sin(age * 2 * Math.PI * 5.4) : 0;
    return clamp(peak * Math.min(1, age / 0.06) * fall + wobble, 0, 1);
  }

  // ------------------------------------------------------------------
  // The figure's static artwork
  // ------------------------------------------------------------------

  const TORSO = 'M-15 -101.5 C-21 -101 -25.5 -100.2 -29 -98.6 C-34.2 -96.4 -36.8 -92 -37.4 -86 C-38.4 -76 -38.6 -62 -39 -52 C-39.2 -46 -39.4 -42 -38.4 -38.6 C-26 -36.4 26 -36.4 38.4 -38.6 C39.4 -42 39.2 -46 39 -52 C38.6 -62 38.4 -76 37.4 -86 C36.8 -92 34.2 -96.4 29 -98.6 C25.5 -100.2 21 -101 15 -101.5 C9 -95.6 -9 -95.6 -15 -101.5 Z';
  const HEM = 'M-39.1 -46.4 C-26 -44.2 26 -44.2 39.1 -46.4 L38.4 -38.6 C26 -36.4 -26 -36.4 -38.4 -38.6 Z';
  const POCKET = 'M-20.6 -69.4 C-10 -71 10 -71 20.6 -69.4 C23.2 -62 24.6 -55 25 -47.6 C10 -46.2 -10 -46.2 -25 -47.6 C-24.6 -55 -23.2 -62 -20.6 -69.4 Z';
  const HOOD = 'M-31 -99 C-36.6 -103 -38.6 -110 -35.6 -116.6 C-31.6 -124 -20 -127 0 -127 C20 -127 31.6 -124 35.6 -116.6 C38.6 -110 36.6 -103 31 -99 Z';
  const COLLAR = 'M-25 -102.4 C-19.4 -95.6 -9.4 -91.6 0 -91.4 C9.4 -91.6 19.4 -95.6 25 -102.4 C21.4 -103.8 17.8 -104 15.2 -103.4 C10.6 -98.4 5 -96.4 0 -96.4 C-5 -96.4 -10.6 -98.4 -15.2 -103.4 C-17.8 -104 -21.4 -103.8 -25 -102.4 Z';
  const POD = 'M-25 -45 C-25.6 -36 -22 -27 -14.4 -20.6 C-9 -16.4 9 -16.4 14.4 -20.6 C22 -27 25.6 -36 25 -45 Z';

  /** Builds the agent's SVG; returns the nodes its frames pose. */
  function buildFigure(fig, id) {
    const defs = svg('defs', {}, fig);
    const gradient = (kind, name, attrs, offsets) => {
      const gid = `ca-${name}-${id}`;
      const g = svg(kind, { id: gid, ...attrs }, defs);
      offsets.forEach((offset, i) => svg('stop', { offset, class: `ca-${name}-stop-${i}` }, g));
      return `url(#${gid})`;
    };
    const paint = {
      hoodie: gradient('linearGradient', 'hoodie', { gradientUnits: 'userSpaceOnUse', x1: -38, y1: -104, x2: 30, y2: -36 }, ['0', '0.55', '1']),
      hood: gradient('linearGradient', 'hood', { x1: 0, y1: 0, x2: 0, y2: 1 }, ['0', '1']),
      pearl: gradient('radialGradient', 'pearl', { cx: 0.36, cy: 0.28, r: 0.8 }, ['0', '0.5', '0.85', '1']),
      shine: gradient('radialGradient', 'shine', { cx: 0.5, cy: 0.5, r: 0.5 }, ['0', '1']),
      screen: gradient('linearGradient', 'screen', { x1: 0, y1: 0, x2: 0, y2: 1 }, ['0', '0.55', '1']),
      screenGlow: gradient('radialGradient', 'screen-glow', { cx: 0.5, cy: 0.56, r: 0.62 }, ['0', '1']),
      steel: gradient('linearGradient', 'steel', { x1: 0, y1: 0, x2: 1, y2: 0 }, ['0', '0.4', '1']),
      gold: gradient('radialGradient', 'gold', { cx: 0.35, cy: 0.3, r: 0.75 }, ['0', '0.5', '1']),
      floor: gradient('radialGradient', 'floor', { cx: 0.5, cy: 0.5, r: 0.5 }, ['0', '0.5', '1']),
      beam: gradient('linearGradient', 'beam', { x1: 0, y1: 0, x2: 0, y2: 1 }, ['0', '1']),
      halo: gradient('radialGradient', 'halo', { cx: 0.5, cy: 0.5, r: 0.5 }, ['0', '0.45', '1']),
      iris: gradient('radialGradient', 'iris', { cx: 0.4, cy: 0.34, r: 0.78 }, ['0', '0.5', '1']),
    };
    const screenClip = `ca-screen-clip-${id}`;
    const mouthClip = `ca-mouth-clip-${id}`;
    // The visor's lower corners are rounder: soft cheeks.
    const VISOR_PATH = squircle(VISOR.cx, VISOR.cy, VISOR.rx, VISOR.ry, 3.4, 2.6);
    svg('path', { d: VISOR_PATH }, svg('clipPath', { id: screenClip }, defs));
    const mouthClipPath = svg('path', {}, svg('clipPath', { id: mouthClip }, defs));

    // The floor glow stays on the floor; the rest hovers above it.
    const floor = svg('g', { class: 'ca-floor' }, fig);
    svg('path', { class: 'ca-beam', fill: paint.beam, d: 'M-10 -18 L10 -18 L30 0 L-30 0 Z' }, floor);
    svg('ellipse', { class: 'ca-glow', fill: paint.floor, cx: 0, cy: 0, rx: 46, ry: 10 }, floor);
    const body = svg('g', { class: 'ca-body' }, fig);

    // The hover pod under the hoodie.
    const pod = svg('g', { class: 'ca-pod' }, body);
    const sparks = [0, 1, 2, 3].map(() => svg('circle', { class: 'ca-spark', r: 1.1 }, pod));
    const thrusterHalo = svg('ellipse', { class: 'ca-thruster-halo', cx: 0, cy: -18, rx: 13, ry: 4.2 }, pod);
    svg('path', { class: 'ca-pod-shell ca-ink-fill', fill: paint.pearl, d: POD }, pod);
    // A segmented ring round the pod with five glowing vents.
    svg('path', { class: 'ca-pod-ring ca-ink-fill', d: 'M-24.2 -36.6 C-12 -33.4 12 -33.4 24.2 -36.6 L23.2 -31.2 C12 -28.4 -12 -28.4 -23.2 -31.2 Z' }, pod);
    svg('path', { class: 'ca-pod-ring-seam', d: 'M-12.2 -34.6 L-12 -29.4 M12.2 -34.6 L12 -29.4' }, pod);
    const vents = [-17, -8.5, 0, 8.5, 17].map((vx) => {
      const vy = -31.8 - 2.3 * (vx / 24) ** 2;
      return svg('rect', { class: 'ca-vent', x: (vx - 1.9).toFixed(2), y: (vy - 1.1).toFixed(2), width: 3.8, height: 2.2, rx: 1.1 }, pod);
    });
    svg('path', { class: 'ca-pod-shine', d: 'M-19.6 -40 C-19.6 -38.6 -19.4 -37.6 -19.2 -37 M-18.6 -28.6 C-17 -25.6 -15.4 -23.6 -13 -21.8' }, pod);
    svg('ellipse', { class: 'ca-thruster', cx: 0, cy: -18.4, rx: 8.4, ry: 2.3 }, pod);

    // Hood (behind the head), then the torso: its ink under its fill so the
    // sleeves join it without a seam.
    const torso = svg('g', { class: 'ca-torso' }, body);
    svg('path', { class: 'ca-hood ca-ink-fill', fill: paint.hood, d: HOOD }, torso);
    svg('path', { class: 'ca-hood-lining', d: 'M-22 -104 C-18 -113 -10 -117 0 -117 C10 -117 18 -113 22 -104 C14 -100 -14 -100 -22 -104 Z' }, torso);
    const neck = svg('g', { class: 'ca-neck' }, torso);
    svg('rect', { class: 'ca-neck-steel', fill: paint.steel, x: -9.6, y: -113, width: 19.2, height: 15, rx: 3.6 }, neck);
    svg('path', { class: 'ca-neck-ring', d: 'M-9.6 -105.6 L9.6 -105.6' }, neck);
    svg('path', { class: 'ca-ink-under', d: TORSO }, torso);
    const under = svg('g', { class: 'ca-under' }, torso);
    svg('path', { class: 'ca-hoodie', fill: paint.hoodie, d: TORSO }, torso);
    svg('path', { class: 'ca-hoodie-shade', d: 'M33.6 -88 C35.4 -74 35.6 -60 35.6 -48.6' }, torso);
    svg('path', { class: 'ca-hoodie-light', d: 'M-33.6 -88 C-34.6 -78 -35 -66 -35.4 -54' }, torso);
    svg('path', { class: 'ca-collar-shadow', d: 'M-25 -102.4 C-19.4 -95.6 -9.4 -91.6 0 -91.4 C9.4 -91.6 19.4 -95.6 25 -102.4 L26.8 -99.4 C20 -91 10 -87.2 0 -87 C-10 -87.2 -20 -91 -26.8 -99.4 Z' }, torso);
    svg('path', { class: 'ca-stitch', d: 'M-17 -101.4 C-21 -96 -24.4 -92 -28.8 -87.4 M17 -101.4 C21 -96 24.4 -92 28.8 -87.4' }, torso);
    svg('path', { class: 'ca-fold', d: 'M-37.4 -54.4 C-33.4 -52.4 -29.6 -52.2 -26.4 -53.4 M37.4 -54.4 C33.4 -52.4 29.6 -52.2 26.4 -53.4 M-36 -58.6 C-33.6 -57.6 -31.6 -57.4 -29.6 -57.8' }, torso);
    svg('path', { class: 'ca-hem ca-ink-fill', d: HEM }, torso);
    // The waistband's ribbing follows its curve.
    let ribs = '';
    for (let rx = -33; rx <= 33; rx += 5.5) {
      ribs += ` M${num(rx)} ${num(-43.9 - 1.65 * (rx / 39) ** 2)} L${num(rx)} ${num(-38 - 1.65 * (rx / 38.4) ** 2)}`;
    }
    svg('path', { class: 'ca-rib', d: ribs.trim() }, torso);
    // A pen and a rolled diploma, tied with a gold ribbon, peek out of the pocket.
    const pen = svg('g', { class: 'ca-pocket-pen', transform: 'translate(-20.6 -69) rotate(-14)' }, torso);
    svg('rect', { class: 'ca-pen ca-prop-ink-fill', x: -1.8, y: -13, width: 3.6, height: 17, rx: 1.6 }, pen);
    svg('path', { class: 'ca-pen-clip', d: 'M1.8 -11.4 L3 -11.4 L3 -4.6' }, pen);
    svg('rect', { class: 'ca-gold-part', x: -1.8, y: -8.4, width: 3.6, height: 1.4 }, pen);
    const scroll = svg('g', { class: 'ca-diploma', transform: 'translate(19.4 -69) rotate(13)' }, torso);
    svg('rect', { class: 'ca-diploma-roll ca-prop-ink-fill', x: -2.9, y: -13, width: 5.8, height: 17, rx: 1.2 }, scroll);
    svg('ellipse', { class: 'ca-diploma-end ca-prop-ink-fill', cx: 0, cy: -13, rx: 2.9, ry: 1.3 }, scroll);
    svg('path', { class: 'ca-diploma-curl', d: 'M-0.9 -13 C-0.9 -13.8 1 -13.8 1 -13 C1 -12.4 0 -12.3 -0.2 -12.8' }, scroll);
    svg('rect', { class: 'ca-gold-part ca-ribbon', x: -3.1, y: -7.4, width: 6.2, height: 2.2 }, scroll);
    svg('path', { class: 'ca-gold-part ca-ribbon', d: 'M2.4 -5.6 L4.8 -1.8 L3.4 -1.4 L1.8 -4.8 Z' }, scroll);
    svg('path', { class: 'ca-pocket ca-ink-fill', d: POCKET }, torso);
    svg('path', { class: 'ca-pocket-slit', d: 'M-20.6 -69.4 C-23.2 -62 -24.6 -55 -25 -47.6 M20.6 -69.4 C23.2 -62 24.6 -55 25 -47.6' }, torso);
    svg('path', { class: 'ca-stitch', d: 'M-17.6 -66.6 C-8 -68 8 -68 17.6 -66.6' }, torso);
    const chest = svg('g', { class: 'ca-chest' }, torso);
    const chestHalo = svg('circle', { class: 'ca-chest-halo', cx: 0, cy: -84.6, r: 6.8 }, chest);
    svg('circle', { class: 'ca-chest-light ca-ink-fill', cx: 0, cy: -84.6, r: 3.8 }, chest);
    svg('circle', { class: 'ca-chest-core', cx: 0, cy: -84.6, r: 1.7 }, chest);
    // The new hire's lanyard comes out from under the hood's rim on both
    // sides of the neck and meets at the badge's clip.
    for (const side of [-1, 1]) {
      const strap = `M${15 * side} -98.4 L${2.6 * side} -77`;
      svg('path', { class: 'ca-strap-ink', d: strap }, torso);
      svg('path', { class: 'ca-strap', d: strap }, torso);
    }
    svg('path', { class: 'ca-hood-rim ca-ink-fill', fill: paint.hood, d: COLLAR }, torso);
    const strings = [-1, 1].map((side) => {
      const g = svg('g', { class: 'ca-drawstring' }, torso);
      svg('circle', { class: 'ca-eyelet', cx: 8 * side, cy: -95.4, r: 1.5 }, g);
      const cordInk = svg('path', { class: 'ca-cord-ink' }, g);
      const cord = svg('path', { class: 'ca-cord' }, g);
      const aglet = svg('rect', { class: 'ca-aglet', fill: paint.gold, x: -1.7, y: 0, width: 3.4, height: 6.6, rx: 1.4 }, g);
      return { side, cordInk, cord, aglet };
    });
    // The badge swings from its clip: a white card with a UCLA Blue band, "NEW".
    const badge = svg('g', { class: 'ca-badge' }, torso);
    svg('rect', { class: 'ca-badge-card ca-ink-fill', x: -15.5, y: -75.2, width: 31, height: 19.4, rx: 2.6 }, badge);
    svg('path', { class: 'ca-badge-band', d: 'M-14.5 -70.6 L-14.5 -72.2 Q-14.5 -74.2 -12.5 -74.2 L12.5 -74.2 Q14.5 -74.2 14.5 -72.2 L14.5 -70.6 Z' }, badge);
    svg('rect', { class: 'ca-badge-slot', x: -3.4, y: -73.4, width: 6.8, height: 1.6, rx: 0.8 }, badge);
    svg('text', { class: 'ca-badge-text', x: 0, y: -59.6 }, badge).textContent = 'NEW';
    svg('rect', { class: 'ca-badge-clip ca-ink-fill', fill: paint.gold, x: -3.4, y: -79, width: 6.8, height: 4.6, rx: 1.2 }, badge);

    // Arms: the shoulder joins' ink goes under the torso's fill; behind-the-head
    // layers precede the head, the usual layers follow it.
    const backArms = svg('g', { class: 'ca-arms-back' }, body);
    const head = svg('g', { class: 'ca-head' }, body);
    const frontArms = svg('g', { class: 'ca-arms-front' }, body);
    const arms = { right: buildArm(frontArms, under, 1, paint.hoodie), left: buildArm(frontArms, under, -1, paint.hoodie) };

    // The head: ears, antenna, helmet, visor, face.
    const ears = [-1, 1].map((side) => {
      const g = svg('g', { class: 'ca-ear' }, head);
      svg('circle', { class: 'ca-ear-disc ca-ink-fill', fill: paint.pearl, cx: 0, cy: 0, r: 12.6 }, g);
      svg('circle', { class: 'ca-ear-halo', cx: 0, cy: 0, r: 8.4 }, g);
      svg('circle', { class: 'ca-ear-ring', cx: 0, cy: 0, r: 8.4 }, g);
      svg('circle', { class: 'ca-ear-cap', fill: paint.steel, cx: 0, cy: 0, r: 5.4 }, g);
      return { side, g };
    });
    const antenna = svg('g', { class: 'ca-antenna' }, head);
    const stemInk = svg('path', { class: 'ca-antenna-stem-ink' }, antenna);
    const stem = svg('path', { class: 'ca-antenna-stem' }, antenna);
    const bulb = svg('g', {}, antenna);
    const bulbHalo = svg('circle', { class: 'ca-bulb-halo', fill: paint.halo, cx: 0, cy: 0, r: 12 }, bulb);
    svg('circle', { class: 'ca-bulb ca-ink-fill', fill: paint.gold, cx: 0, cy: 0, r: 5.6 }, bulb);
    svg('circle', { class: 'ca-bulb-shine', cx: -1.8, cy: -2, r: 1.5 }, bulb);
    svg('rect', { class: 'ca-antenna-base ca-ink-fill', fill: paint.steel, x: -6.2, y: -208.6, width: 12.4, height: 5.4, rx: 2.2 }, head);
    svg('path', { class: 'ca-helmet ca-ink-fill', fill: paint.pearl, d: squircle(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, 2.5, 3.1) }, head);
    // Rim light on the shadow side, bounced from the visor's glow.
    svg('path', { class: 'ca-helmet-bounce', d: 'M53.4 -176 C55.6 -160 54.4 -140 46.6 -126 C40 -118.4 28 -115 14 -114.4' }, head);
    // Panel seams: across the brow, down each side, and under the chin.
    svg('path', { class: 'ca-seam', d: 'M-52.8 -178 C-30 -201 30 -201 52.8 -178 M-52.8 -178 C-54.2 -174 -55 -172 -55.4 -170 M52.8 -178 C54.2 -174 55 -172 55.4 -170 M-38 -117.6 C-14 -112.6 14 -112.6 38 -117.6' }, head);
    svg('path', { class: 'ca-seam-light', d: 'M-52 -175.6 C-30 -198.4 30 -198.4 52 -175.6' }, head);
    for (const side of [-1, 1]) {
      svg('circle', { class: 'ca-rivet ca-ink-fill', fill: paint.steel, cx: 41.4 * side, cy: -126.4, r: 1.9 }, head);
      svg('circle', { class: 'ca-rivet-shine', cx: 41.4 * side - 0.6, cy: -127, r: 0.6 }, head);
    }
    svg('ellipse', { class: 'ca-helmet-gloss', fill: paint.shine, cx: -29, cy: -189, rx: 17, ry: 8, transform: 'rotate(-24 -29 -189)' }, head);
    svg('path', { class: 'ca-helmet-spark', d: 'M-46 -176 C-41 -189 -30 -197.6 -17 -201' }, head);
    svg('circle', { class: 'ca-helmet-glint', cx: -11.6, cy: -201.8, r: 1.4 }, head);
    // Three status lights on the brow; the gold one blinks slowly while it thinks.
    const leds = [9.6, 15, 20.4].map((lx, i) => {
      const ly = -199.6 + 0.012 * lx * lx;
      svg('circle', { class: 'ca-led-halo', cx: lx, cy: ly, r: 2.9 }, head);
      return svg('circle', { class: `ca-led ca-led--${i}`, cx: lx, cy: ly, r: 1.5 }, head);
    });
    // A graduation mortarboard, fresh out of training, askew on the dome
    // away from the antenna; its gold tassel hangs off the left corner.
    const cap = svg('g', { class: 'ca-cap' }, head);
    const capTilt = svg('g', { transform: 'translate(-28 -201.2) rotate(-16) scale(0.9 1)' }, cap);
    svg('path', { class: 'ca-cap-skull ca-ink-fill', d: 'M-15 1 C-15.6 -3 -15 -7 -14 -9 L14 -9 C15 -7 15.6 -3 15 1 C6 3.6 -6 3.6 -15 1 Z' }, capTilt);
    svg('path', { class: 'ca-cap-skull-light', d: 'M-12.4 -0.6 C-12.8 -3.4 -12.4 -6 -11.6 -7.4' }, capTilt);
    svg('path', { class: 'ca-cap-edge ca-ink-fill', d: 'M-23 -10 L0 -4.5 L23 -10 L23 -7.4 L0 -1.9 L-23 -7.4 Z' }, capTilt);
    svg('path', { class: 'ca-cap-board ca-ink-fill', d: 'M-23 -10 L0 -15.6 L23 -10 L0 -4.5 Z' }, capTilt);
    svg('path', { class: 'ca-cap-shine', d: 'M-17.6 -10.4 L-2 -14.2' }, capTilt);
    svg('path', { class: 'ca-tassel-cord', d: 'M0 -10 L-21.4 -10' }, capTilt);
    svg('circle', { class: 'ca-cap-button ca-ink-fill', fill: paint.gold, cx: 0, cy: -10, r: 1.8 }, capTilt);
    const tassel = svg('g', {}, capTilt);
    svg('path', { class: 'ca-tassel-cord-ink', d: 'M0 0 L0 8.4' }, tassel);
    svg('path', { class: 'ca-tassel-cord', d: 'M0 0 L0 8.4' }, tassel);
    svg('path', { class: 'ca-tassel ca-ink-fill', fill: paint.gold, d: 'M-1.5 8 L1.5 8 L2.6 16.8 C1 17.6 -1 17.6 -2.6 16.8 Z' }, tassel);
    svg('path', { class: 'ca-tassel-fringe', d: 'M-0.9 11 L-1.2 16.4 M0.9 11 L1.2 16.4' }, tassel);
    svg('ellipse', { class: 'ca-tassel-knot ca-ink-fill', fill: paint.gold, cx: 0, cy: 8.2, rx: 2, ry: 1.3 }, tassel);
    // A puzzled "?" that pops up beside the antenna.
    const question = svg('g', { class: 'ca-question' }, head);
    const QUESTION = 'M-4.4 -6.4 C-4.4 -11.6 4.6 -11.8 4.6 -6.2 C4.6 -2.4 0 -1.8 0 2.4';
    svg('path', { class: 'ca-question-halo', d: QUESTION }, question);
    svg('path', { class: 'ca-question-ink', d: QUESTION }, question);
    svg('path', { class: 'ca-question-mark', d: QUESTION }, question);
    svg('circle', { class: 'ca-question-dot', cx: 0, cy: 7.6, r: 2.1 }, question);
    // A light bulb of an idea, for a lecture.
    const idea = svg('g', { class: 'ca-idea' }, head);
    svg('path', { class: 'ca-idea-rays', d: 'M0 -15.4 L0 -12 M-10.4 -10 L-8 -7.8 M10.4 -10 L8 -7.8 M-13 -1 L-9.8 -1 M13 -1 L9.8 -1' }, idea);
    svg('path', { class: 'ca-idea-glass ca-ink-fill', d: 'M-3.6 7 C-3.6 4 -7.4 2.4 -7.4 -2 C-7.4 -6.6 -4 -9.6 0 -9.6 C4 -9.6 7.4 -6.6 7.4 -2 C7.4 2.4 3.6 4 3.6 7 Z' }, idea);
    svg('path', { class: 'ca-idea-filament', d: 'M-2 4 L-2 0.6 L0 -1.6 L2 0.6 L2 4' }, idea);
    svg('rect', { class: 'ca-idea-base ca-ink-fill', fill: paint.steel, x: -3.8, y: 6.6, width: 7.6, height: 4.4, rx: 1.4 }, idea);
    svg('path', { class: 'ca-idea-shine', d: 'M-4.4 -3.4 C-4.2 -5.8 -2.6 -7.2 -0.6 -7.6' }, idea);
    // Two little gears turn above its head while it thinks.
    const gears = svg('g', { class: 'ca-gears' }, head);
    const gearBig = svg('path', { class: 'ca-gear ca-ink-fill', fill: paint.pearl, d: gearPath(8, 8) }, gears);
    const gearSmall = svg('path', { class: 'ca-gear ca-gear--small ca-ink-fill', fill: paint.gold, d: gearPath(5.4, 6) }, gears);
    // Hearts float up when it is smitten.
    const hearts = [0, 1, 2].map(() => {
      const g = svg('g', { class: 'ca-love' }, head);
      svg('path', { class: 'ca-love-heart', d: HEART }, g);
      return g;
    });
    const sweat = svg('g', { class: 'ca-sweat' }, head);
    svg('path', { class: 'ca-sweat-drop', d: 'M0 -6 C2.6 -2.4 4.2 0 4.2 2.2 C4.2 4.6 2.2 6.2 0 6.2 C-2.2 6.2 -4.2 4.6 -4.2 2.2 C-4.2 0 -2.6 -2.4 0 -6 Z' }, sweat);
    svg('path', { class: 'ca-sweat-shine', d: 'M-1.8 1 C-1.8 2.4 -1 3.4 0 3.8' }, sweat);

    const visor = svg('g', { class: 'ca-visor' }, head);
    svg('path', { class: 'ca-bezel ca-ink-fill', fill: paint.steel, d: squircle(VISOR.cx, VISOR.cy, VISOR.rx + 3.6, VISOR.ry + 3.4, 3.4, 2.6) }, visor);
    svg('path', { class: 'ca-screen', fill: paint.screen, d: VISOR_PATH }, visor);
    svg('path', { class: 'ca-screen-glow', fill: paint.screenGlow, d: VISOR_PATH }, visor);
    const face = svg('g', { class: 'ca-face', 'clip-path': `url(#${screenClip})` }, visor);
    const features = svg('g', {}, face);
    const blush = [-1, 1].map((side) => svg('ellipse', { class: 'ca-blush', cx: 26.5 * side, cy: -149.6, rx: 5.6, ry: 2.8 }, features));
    const eyes = [-1, 1].map((side) => {
      const g = svg('g', { class: 'ca-eye' }, features);
      const halo = svg('path', { class: 'ca-glow-halo' }, g);
      const shape = svg('path', { class: 'ca-eye-shape', fill: paint.iris }, g);
      const heartG = svg('g', {}, g);
      svg('path', { class: 'ca-glow-halo', d: HEART }, heartG);
      svg('path', { class: 'ca-eye-shape', fill: paint.iris, d: HEART }, heartG);
      svg('circle', { class: 'ca-eye-spark', cx: -3.4, cy: -6, r: 1.5 }, heartG);
      const sparkBig = svg('circle', { class: 'ca-eye-spark', r: 2.3 }, g);
      const sparkSmall = svg('circle', { class: 'ca-eye-spark', r: 1.1 }, g);
      const brow = svg('path', { class: 'ca-brow' }, features);
      return { side, halo, shape, heartG, sparkBig, sparkSmall, brow };
    });
    const mouthHalo = svg('path', { class: 'ca-glow-halo' }, features);
    const mouth = svg('path', { class: 'ca-mouth' }, features);
    const tongue = svg('ellipse', { class: 'ca-tongue', 'clip-path': `url(#${mouthClip})` }, features);
    const scanline = svg('rect', { class: 'ca-scanline', x: -46, y: -3, width: 92, height: 6 }, face);
    const sweep = svg('g', { class: 'ca-sweep' }, face);
    svg('path', { d: 'M-10 -200 L8 -200 L-12 -116 L-30 -116 Z' }, sweep);
    svg('path', { d: 'M14 -200 L19 -200 L-1 -116 L-6 -116 Z' }, sweep);
    svg('path', { class: 'ca-screen-sheen', d: 'M-36.4 -170 C-36 -181 -28 -186.4 -16 -187.6 C-24 -184 -30 -178 -32 -168 Z' }, visor);
    svg('path', { class: 'ca-screen-glint', d: 'M-33.4 -176.6 C-30.6 -182.4 -25 -185.4 -19 -186.2' }, visor);
    // The smug "ting": a star glint on the glass.
    const ting = svg('g', { class: 'ca-ting' }, visor);
    svg('circle', { class: 'ca-ting-halo', cx: 0, cy: 0, r: 6.4 }, ting);
    svg('path', { class: 'ca-ting-star', d: 'M0 -8 L1.4 -1.4 L8 0 L1.4 1.4 L0 8 L-1.4 1.4 L-8 0 L-1.4 -1.4 Z' }, ting);

    return {
      body, pod, sparks, thrusterHalo, vents, torso, chestHalo, strings, badge, backArms, frontArms, head, arms, ears,
      antenna, stem, stemInk, bulb, bulbHalo, leds, cap, tassel, question, idea, gears, gearBig, gearSmall, hearts, sweat, visor,
      features, blush, eyes, mouthHalo, mouth, tongue, mouthClipPath, sweep, scanline, ting, floor,
    };
  }

  // ------------------------------------------------------------------
  // The agent on stage
  // ------------------------------------------------------------------

  const SIDES = ['right', 'left'];
  const SIGN = { right: 1, left: -1 };

  /**
   * The agent from `at` to `until`, its hover glow on stage point (x, y)
   * (moved by `route`), about 230 px tall at scale 1. See the file header
   * for the options; returns { node, handPoint(side, t) }, where handPoint
   * gives the stage point of that hand's grip (between the thumb and the
   * fingers; a pen or card hand's pinch) at song time t.
   */
  function agent(parent, {
    x, y, scale: size = 1, at, until, route = [], moves = [], faces = [], words = [], mute = [], holds = [], facing = 1,
  }) {
    const id = `${++uid}`;
    const sign = facing < 0 ? -1 : 1;
    const end = until ?? Infinity;
    const wrap = el('div', 'ca-agent is-staged', parent);
    wrap.dataset.testid = 'coding-agent';
    const fig = svg('svg', {
      class: 'ca-art', viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`,
      width: VIEW.width * size, height: VIEW.height * size, 'aria-hidden': 'true', focusable: 'false',
    }, wrap);
    fig.style.left = `${VIEW.x * size}px`;
    fig.style.top = `${VIEW.y * size}px`;
    const art = buildFigure(fig, id);

    const routeAt = routeTrack(x, y, at, route);
    const heldBySide = Object.fromEntries(SIDES.map((s) => [s, holds.filter(([, side]) => side === s).sort((a, b) => a[0] - b[0])]));
    const propAt = (side, t) => {
      let prop = null;
      for (const [when, , item] of heldBySide[side]) if (when <= t) prop = item ?? null;
      return prop;
    };

    // Compile the moves into keys and waves on song time.
    const keys = [], waves = [];
    for (const s of SIDES) {
      for (const [when, , item] of heldBySide[s]) keys.push([when - 0.45, 0.45, restFor(s, item), 'hold', -1]);
    }
    moves.slice().sort((a, b) => a[0] - b[0]).forEach(([when, name, options = {}], index) => {
      const move = MOVES[name];
      if (!move) return;
      const ctx = {
        facing: sign,
        propAt: (s) => propAt(s, when),
        holding: (items) => SIDES.find((s) => items.includes(propAt(s, when))),
        target: (s, to) => {
          const { place } = routeAt(when, false);
          const fx = (to[0] - place[0]) / size, fy = (to[1] - place[1]) / size;
          return [fx * SIGN[s], fy];
        },
        pick: (forced, to, anyHand = false) => {
          if (forced) return forced;
          const { place } = routeAt(when, false);
          const dx = to ? to[0] - place[0] : 0;
          let s = Math.abs(dx) < 12 * size ? (sign > 0 ? 'left' : 'right') : dx > 0 ? 'right' : 'left';
          if (!anyHand && propAt(s, when) && !propAt(other(s), when)) s = other(s);
          return s;
        },
        look: (to) => {
          const { place } = routeAt(when, false);
          const dx = (to[0] - place[0]) / size, dy = (to[1] - place[1]) / size - HEAD.cy;
          const lx = clamp(dx / 110, -1, 1), ly = clamp(dy / 120, -1, 1);
          return { look: [lx, ly], turn: 0.3 * lx };
        },
        release: (after, sides) => sides.map((s) => [after, 0.55, restFor(s, propAt(s, when + after + 0.55)), true]),
      };
      const built = move(options, ctx);
      for (const [start, duration, fields, release] of built.keys) keys.push([when + start, duration, fields, release ? 'release' : 'key', index]);
      for (const w of built.waves) waves.push({ ...w, start: when + w.start, end: when + w.end, index });
    });
    // A move's return to rest gives way to a later move on the same field
    // that starts before the return would settle, so the arm goes straight on.
    const starts = keys.filter((k) => k[3] !== 'release');
    const compiled = keys.map(([start, duration, fields, kind, index]) => {
      if (kind !== 'release') return [start, duration, fields];
      const kept = Object.fromEntries(Object.entries(fields).filter(([name]) => !starts.some((k) => k[4] > index && name in k[2] && k[0] < start + duration + 0.3 && k[0] >= start - 2)));
      return [start, duration, kept];
    });
    for (const w of waves) {
      const next = starts.filter((k) => k[4] > w.index && w.fields.some((f) => f in k[2]) && k[0] > w.start).map((k) => k[0]);
      if (next.length) w.end = Math.min(w.end, Math.min(...next) + 0.1);
    }
    const poseAt = keyTrack(compiled, REST, ARM_LAG);

    // Faces: each expression eases in, holds, and eases back to neutral.
    const faceKeys = [];
    const sortedFaces = faces.slice().sort((a, b) => a[0] - b[0]);
    sortedFaces.forEach(([when, name, hold = 1.6], i) => {
      faceKeys.push([when - 0.12, 0.24, expression(name, sign)]);
      const next = sortedFaces[i + 1];
      if (!next || next[0] > when + hold + 0.3) faceKeys.push([when + hold, 0.4, expression('neutral', sign)]);
    });
    const faceAt = keyTrack(faceKeys, expression('neutral', sign));
    const seed = Math.round(at * 97) + Math.round(x) * 13 + Math.round(y) * 7 + Number(id) * 31;
    const lastTime = Number.isFinite(end) ? end + 1 : at + 900;
    const blinks = blinkTimes(seed, at, lastTime);
    const glances = glanceTimes(seed + 4099, at, lastTime);
    const cues = gagCues(faces, moves);
    const phase = hash01(Number(id) * 131 + Math.round(at * 10)) * 10;

    // Follow-through: the antenna and the tassel answer the head's recent
    // motion like damped springs (its turns and tilts, the body's hops and
    // glides), so they wobble and settle after a quick move.
    const SIGNALS = ['tilt', 'turn', 'hop', 'nod', 'bow'];
    const signalWaves = waves.filter((w) => w.fields.some((f) => SIGNALS.includes(f)));
    function headSignals(t) {
      const p = poseAt(t, false, SIGNALS);
      for (const w of signalWaves) applyWave(p, w, t);
      const glide = routeAt(t, false).place[0] / size;
      return {
        sway: p.tilt + 14 * (p.turn + 0.6 * gagAt(cues, 'doubleTake', t)) + 0.03 * glide,
        lift: p.hop + 5 * p.nod + 6 * p.bow + 15 * gagAt(cues, 'capHop', t),
      };
    }
    function followThrough(t) {
      let sway = 0, lift = 0, newer = headSignals(t);
      for (let k = 1; k <= 10; k += 1) {
        const ago = k * 0.05;
        const older = headSignals(t - ago);
        const spring = Math.exp(-ago / 0.28) * Math.sin((2 * Math.PI * ago) / 0.5);
        sway += (newer.sway - older.sway) * spring;
        lift += (newer.lift - older.lift) * spring;
        newer = older;
      }
      return { sway, lift };
    }
    const props = { right: { name: undefined, update: null, parts: null }, left: { name: undefined, update: null, parts: null } };

    /** Everything about the pose at t that is not drawing: a pure function of t. */
    function frameAt(t) {
      const reduced = reducedMotion.matches;
      const local = t - at;
      const idle = reduced ? 0 : 1;
      const { place, vx } = routeAt(t, reduced);
      const pose = poseAt(t, reduced);
      if (!reduced) for (const w of waves) applyWave(pose, w, t);
      // Hover, breathing, the entrance pop, a lean into a glide, a hop.
      const bob = idle * -2.6 * Math.sin((2 * Math.PI * (local + phase)) / 2.4);
      const pop = reduced ? 1 : clamp(local / 0.42, 0, 1);
      const popScale = reduced ? 1 : 0.8 + 0.2 * (1 + 2.2 * (pop - 1) ** 3 + 1.2 * (pop - 1) ** 2);
      const rise = reduced ? 0 : 18 * (1 - smooth(pop));
      const lean = -1.4 * sign + clamp(vx * 0.012, -7, 7) * idle + pose.bow * 4 * sign;
      // Squash and stretch: wider and shorter in a crouch, taller and narrower on the way up.
      const { squash, stretch } = pose;
      let body = translation(0, bob - pose.hop + rise);
      body = multiply(body, rotation(lean, 0, -30));
      body = multiply(body, scaling(
        popScale * (1 + 0.05 * squash - 0.035 * stretch),
        popScale * (1 - 0.08 * squash + 0.06 * stretch + 0.02 * Math.min(1, pose.hop / 14)), 0, -16,
      ));
      const breath = 1 + idle * 0.008 * Math.sin((2 * Math.PI * (local + phase)) / 3.6);
      const singing = !reduced && t >= at && t <= end && !mute.some(([from, to]) => t >= from && t < to) ? mouthAt(words, t) : 0;
      const face = faceAt(t, reduced);
      const gag = Object.fromEntries(Object.keys(GAGS).map((kind) => [kind, reduced ? 0 : gagAt(cues, kind, t)]));
      return {
        t, local, reduced, idle, place, vx, pose, body, breath, singing, face, gag,
        blink: reduced ? 1 : blinkAt(blinks, t),
        glance: reduced ? [0, 0] : glanceAt(glances, t),
        follow: reduced ? { sway: 0, lift: 0 } : followThrough(t),
        props: { right: propAt('right', t), left: propAt('left', t) },
      };
    }

    /** The shoulder-relative pose of one side's arm, posed (for drawing or measuring). */
    function armState(frame, side) {
      const p = frame.pose;
      const [wristBend, roll, pitch] = p[`${side}Hand`];
      const arm = p[side];
      const fore = arm[0] + arm[1];
      const prop = frame.props[side];
      return { arm, angle: fore + clamp(wristBend, -80, 80), roll, pitch, grip: p[`${side}Grip`], prop };
    }

    /** A hand-frame grip point for the prop in that hand. */
    const gripPoint = (state) => (state.prop && PROPS[state.prop]?.grip === 'pinch' ? pinchPoint(state.grip) : HAND.fistGrip);

    /** Body-space → stage: the torso's breath only moves the shoulders a little. */
    function toStage(frame, point) {
      const [bx, by] = transform(frame.body, point);
      return [frame.place[0] + bx * size, frame.place[1] + by * size];
    }

    function handPoint(side, t) {
      const frame = frameAt(t);
      const state = armState(frame, side);
      const lift = frame.pose.lift;
      const { w, fore } = armJoints(state.arm, lift);
      const d2 = dirOf(fore);
      const view = projector(handAxes(state.angle, state.roll, state.pitch), add(w, scale(d2, -0.6)));
      const local = view.at(gripPoint(state));
      return toStage(frame, [local[0] * SIGN[side], local[1] + breathShift(frame, ARM.sy)]);
    }

    /** How far the breath raises a point at height y on the torso. */
    const breathShift = (frame, yAt) => (yAt - HEM_Y) * (frame.breath - 1);

    function render(frame) {
      const { t, local, reduced, idle, pose, face, place } = frame;
      wrap.style.transform = `translate(${place[0].toFixed(2)}px, ${place[1].toFixed(2)}px)`;
      const bodyLean = Math.atan2(frame.body[1], frame.body[0]) / RAD;
      art.body.setAttribute('transform', matrixAttr(frame.body));
      art.torso.setAttribute('transform', `translate(0 ${HEM_Y}) scale(1 ${frame.breath.toFixed(4)}) translate(0 ${-HEM_Y})`);
      // The floor glow brightens as the pod dips toward it.
      const height = -frame.body[5];
      art.floor.setAttribute('transform', `scale(${(1 - height * 0.006).toFixed(4)} 1)`);
      art.floor.setAttribute('opacity', clamp(1 - height * 0.012, 0.4, 1).toFixed(3));
      // The thruster's glow pulses softly, the vents glow in a slow ripple,
      // and a few motes of light drift down from the pod.
      art.thrusterHalo.setAttribute('opacity', (0.75 + idle * 0.25 * Math.sin((2 * Math.PI * local) / 1.6)).toFixed(3));
      art.vents.forEach((vent, i) => vent.setAttribute('opacity', (0.7 + idle * 0.3 * Math.sin((2 * Math.PI * local) / 2.2 - i * 0.9)).toFixed(3)));
      art.sparks.forEach((spark, i) => {
        const fall = (local / 1.4 + i / 4) % 1;
        const sx = (hash01(seed + i * 7) - 0.5) * 14 + 3 * Math.sin(fall * 4 + i);
        spark.setAttribute('cx', num(sx * (1 + fall)));
        spark.setAttribute('cy', num(-17 + 15 * fall));
        spark.setAttribute('opacity', reduced ? '0' : (0.8 * Math.sin(Math.PI * fall)).toFixed(3));
      });

      // Drawstrings swing a little behind the body's motion.
      for (const string of art.strings) {
        const swing = idle * (0.7 * Math.sin(local * 1.7 + string.side) - frame.vx * 0.004);
        const top = [8 * string.side, -95.4], tip = [10.4 * string.side + swing, -85];
        const mid = [9.5 * string.side + swing * 0.4, -90.4];
        const d = `M${pt(top)} Q${pt(mid)} ${pt(tip)}`;
        string.cordInk.setAttribute('d', d);
        string.cord.setAttribute('d', d);
        const angle = angleOf(sub(tip, mid));
        string.aglet.setAttribute('transform', `translate(${pt(tip)}) rotate(${(-angle).toFixed(2)})`);
      }
      art.chestHalo.setAttribute('opacity', (0.5 + idle * 0.25 * Math.sin(local * 2.1)).toFixed(3));
      // The badge hangs plumb against the body's lean and swings a little.
      const badgeSwing = idle * (2.4 * Math.sin((2 * Math.PI * (local + phase)) / 2.6) - frame.vx * 0.02 - pose.hop * 0.25) - 0.7 * bodyLean;
      art.badge.setAttribute('transform', `rotate(${badgeSwing.toFixed(2)} 0 -76.8)`);

      // Arms and props.
      for (const side of SIDES) {
        const state = armState(frame, side);
        const prop = props[side];
        if (state.prop !== prop.name) {
          prop.name = state.prop;
          const held = art.arms[side].held;
          held.replaceChildren();
          prop.parts = null;
          prop.update = null;
          prop.node = null;
          if (state.prop && PROPS[state.prop]) {
            prop.node = svg('g', { class: `ca-prop ca-prop--${state.prop}` }, held);
            const result = PROPS[state.prop].draw(prop.node);
            if (typeof result === 'function') prop.update = result;
            else prop.parts = result;
          }
        }
        const grip = gripPoint(state);
        const { view } = art.arms[side].render(state.arm, pose.lift, state.angle, state.roll, state.pitch, state.grip, undefined);
        if (prop.node) {
          const spec = PROPS[state.prop];
          const m = multiply([SIGN[side], 0, 0, 1, 0, 0], propMatrix(view, spec, grip));
          prop.node.setAttribute('transform', matrixAttr(m));
          prop.update?.(local, reduced);
          if (prop.parts) {
            const open = clamp(pose[`${side}Open`], 0, 1);
            prop.parts.closed.setAttribute('opacity', (1 - smooth(clamp(open * 2, 0, 1))).toFixed(3));
            prop.parts.open.setAttribute('opacity', smooth(clamp(open * 2 - 1, 0, 1)).toFixed(3));
            prop.parts.open.setAttribute('transform', `scale(${(0.45 + 0.55 * open).toFixed(3)} 1)`);
          }
        }
        const layer = pose[`${side}Back`] > 0.5 ? art.backArms : art.frontArms;
        const node = art.arms[side].node;
        if (node.parentNode !== layer) layer.append(node);
        node.setAttribute('transform', `translate(0 ${breathShift(frame, ARM.sy).toFixed(3)})`);
      }

      // The head turns towards its facing, tilts on its neck, nods, and bows;
      // between gestures its eyes glance aside and the head tips with them.
      const { gag, follow, glance } = frame;
      const turn = clamp(-0.42 * sign + pose.turn + 0.3 * (pose.look[0] + face.lookX) + 0.6 * gag.doubleTake, -1, 1);
      const tilt = pose.tilt + face.tilt + 2 * glance[0];
      const headDrop = 2 * pose.lift + 8 * pose.bow + 1.5 * pose.nod + breathShift(frame, HEAD.pivot[1]);
      const [px, py] = HEAD.pivot;
      art.head.setAttribute('transform', `translate(0 ${(HEAD_SEAT + headDrop).toFixed(2)}) rotate(${tilt.toFixed(2)} ${px} ${py}) translate(${px} ${py}) scale(${HEAD.scale}) translate(${-px} ${-py})`);
      art.visor.setAttribute('transform', `translate(${(7 * turn).toFixed(2)} ${(2.4 * pose.nod + 2 * pose.bow).toFixed(2)}) scale(${(1 - 0.05 * Math.abs(turn)).toFixed(4)} 1)`);
      for (const ear of art.ears) {
        const near = ear.side * turn > 0 ? 1 : -1;
        const amount = Math.abs(turn);
        const cx = ear.side * (56 - 3 * amount);
        ear.g.setAttribute('transform', `translate(${(cx + 2 * turn).toFixed(2)} ${HEAD.cy}) scale(${(1 + near * 0.07 * amount).toFixed(3)} ${(1 + near * 0.03 * amount).toFixed(3)})`);
      }
      // The antenna sways, springs after quick moves, and curls into a "?" when it is lost.
      const sway = idle * (3.2 * Math.sin((2 * Math.PI * (local + phase)) / 2.9) - frame.vx * 0.02 - pose.hop * 0.4) - 0.5 * tilt - clamp(0.9 * follow.sway, -12, 12);
      const curl = smooth(clamp(Math.max(face.question, pose.curl), 0, 1));
      const stemPoints = ANTENNA.straight.map((p, i) => lerp2(p, ANTENNA.curl[i], curl));
      const stemPath = `M${pt(stemPoints[0])} ${smoothThrough(stemPoints)}`;
      art.stem.setAttribute('d', stemPath);
      art.stemInk.setAttribute('d', stemPath);
      art.bulb.setAttribute('transform', `translate(${pt(lerp2(ANTENNA.bulb, ANTENNA.curlBulb, curl))})`);
      art.antenna.setAttribute('transform', `translate(${(4 * turn).toFixed(2)} 0) rotate(${sway.toFixed(2)} 0 -205)`);
      art.bulbHalo.setAttribute('opacity', (0.35 + (reduced ? 0 : 0.3 * beats.pulse(t, 0.18))).toFixed(3));
      // Status lights; the gold one blinks slowly while it thinks.
      const busy = Math.max(face.busy, pose.gears) > 0.5;
      art.leds.forEach((led, i) => {
        const glow = i === 2 && busy ? (reduced ? 1 : 0.3 + 0.7 * (0.5 + 0.5 * Math.sin((2 * Math.PI * local) / 1.5))) : 0.85 + idle * 0.15 * Math.sin(local * 1.3 + i * 2);
        led.setAttribute('opacity', glow.toFixed(3));
      });
      // The mortarboard rides on the dome, floats up as the head drops, and
      // hops off a surprised head; its tassel hangs plumb, swings, and flicks.
      const capLift = 15 * gag.capHop + clamp(-0.35 * follow.lift, -1.5, 4);
      art.cap.setAttribute('transform', `translate(${(3 * turn).toFixed(2)} ${(-capLift).toFixed(2)}) rotate(${(-7 * gag.capHop).toFixed(2)} -27 -205)`);
      // It never swings in over the visor (negative turns it towards the face).
      const tasselSwing = clamp(idle * (6 * Math.sin((2 * Math.PI * (local + phase)) / 1.9) - frame.vx * 0.03 - pose.hop * 0.6)
        - 0.85 * (tilt + bodyLean) - 1.2 * follow.sway + 1.2 * follow.lift + 34 * gag.flick, -24, 42);
      art.tassel.setAttribute('transform', `translate(-22 -9.8) rotate(${(16 + tasselSwing).toFixed(2)})`);
      // Above its head: a "?" when confused, a light bulb for a lecture, gears while it thinks.
      const puzzled = smooth(clamp(face.question, 0, 1));
      const float = idle * 1.2 * Math.sin(local * 3.1);
      art.question.setAttribute('transform', `translate(${(40 + 3 * turn).toFixed(2)} ${(-213 + float + 5 * (1 - puzzled)).toFixed(2)}) rotate(12) scale(${(0.55 + 0.45 * puzzled).toFixed(3)})`);
      art.question.setAttribute('opacity', puzzled.toFixed(3));
      const idea = clamp(gag.idea, 0, 1.3);
      art.idea.setAttribute('transform', `translate(${(40 + 3 * turn).toFixed(2)} ${(-216 + float).toFixed(2)}) scale(${(0.9 * idea).toFixed(3)})`);
      art.idea.setAttribute('opacity', clamp(idea * 3, 0, 1).toFixed(3));
      const gearsOn = smooth(clamp(pose.gears, 0, 1));
      const spin = reduced ? 0 : local * 100;
      art.gears.setAttribute('transform', `translate(${(36 + 3 * turn).toFixed(2)} ${(-213 + float).toFixed(2)}) scale(${(0.7 + 0.3 * gearsOn).toFixed(3)})`);
      art.gears.setAttribute('opacity', gearsOn.toFixed(3));
      art.gearBig.setAttribute('transform', `rotate(${(spin % 360).toFixed(1)})`);
      art.gearSmall.setAttribute('transform', `translate(9 -8.2) rotate(${((-spin * 1.48 + 15) % 360).toFixed(1)})`);
      // Love: three hearts rise from the visor and fade, one after another.
      const smitten = reduced ? 0 : smooth(clamp((face.heart - 0.3) / 0.5, 0, 1));
      art.hearts.forEach((heart, i) => {
        const rise = ((local / 1.5) + i / 3) % 1;
        const hx = 22 + 8 * i - 4 + 3 * Math.sin(rise * 2 * Math.PI + i);
        heart.setAttribute('transform', `translate(${(hx + 3 * turn).toFixed(2)} ${(-190 - 40 * rise).toFixed(2)}) scale(${(0.42 + 0.3 * rise).toFixed(3)})`);
        heart.setAttribute('opacity', (smitten * Math.sin(Math.PI * rise)).toFixed(3));
      });
      // A sweat drop slides down the helmet when it is worried or embarrassed.
      const sweatOn = smooth(clamp(Math.max(face.sweat, pose.sweat), 0, 1));
      const slide = reduced ? 0.3 : (local / 1.8) % 1;
      const drip = Math.min(1, slide / 0.12) * (slide > 0.75 ? (1 - slide) / 0.25 : 1);
      art.sweat.setAttribute('transform', `translate(${(45 + 5 * slide + 2 * turn).toFixed(2)} ${(-186 + 22 * smooth(slide)).toFixed(2)})`);
      art.sweat.setAttribute('opacity', (sweatOn * drip).toFixed(3));
      // The visor's reflection sweeps across now and then, a faint scanline rolls down it.
      const sweepAge = (local + phase * 3) % 8.5;
      const sweepOn = !reduced && sweepAge < 1.1;
      art.sweep.setAttribute('opacity', sweepOn ? (0.16 * Math.sin((Math.PI * sweepAge) / 1.1)).toFixed(3) : '0');
      art.sweep.setAttribute('transform', `translate(${sweepOn ? (-60 + 140 * smooth(sweepAge / 1.1)).toFixed(1) : -60} 0)`);
      const scanAge = (local + phase * 5) % 11;
      const scanOn = !reduced && scanAge < 1.8;
      art.scanline.setAttribute('opacity', scanOn ? (0.08 * Math.sin((Math.PI * scanAge) / 1.8)).toFixed(3) : '0');
      art.scanline.setAttribute('transform', `translate(0 ${(-192 + 70 * (scanAge / 1.8)).toFixed(1)})`);
      // The smug "ting".
      art.ting.setAttribute('transform', `translate(29 -178) rotate(${(45 * gag.ting).toFixed(1)}) scale(${(gag.ting * 1.1).toFixed(3)})`);
      art.ting.setAttribute('opacity', clamp(gag.ting * 2, 0, 1).toFixed(3));
      drawFace(frame, turn);
    }

    function drawFace(frame, turn) {
      const { face, pose } = frame;
      // An idle glance only when nothing else holds its gaze.
      const busyGaze = Math.abs(face.lookX) + Math.abs(face.lookY) + Math.abs(pose.look[0]) + Math.abs(pose.look[1]);
      const free = clamp(1 - busyGaze * 2.5, 0, 1);
      const lookX = clamp(face.lookX + pose.look[0] + free * frame.glance[0], -1, 1);
      const lookY = clamp(face.lookY + pose.look[1] + free * frame.glance[1], -1, 1);
      art.features.setAttribute('transform', `translate(${(3 * turn + 4.2 * lookX).toFixed(2)} ${(3.2 * lookY + 1.6 * pose.nod).toFixed(2)})`);
      const heart = clamp(face.heart, 0, 1);
      for (const eye of art.eyes) {
        const L = eye.side < 0;
        const sizeK = L ? face.sizeL : face.sizeR;
        const open = Math.max(0, (L ? face.openL : face.openR)) * frame.blink;
        const happy = clamp(L ? face.happyL : face.happyR, 0, 1);
        const lid = clamp(L ? face.lidL : face.lidR, 0, 1);
        const cx = EYES.x * eye.side, cy = EYES.y;
        const rx = EYES.rx * sizeK, ry = EYES.ry * sizeK;
        const d = eyePath(cx, cy, rx, ry, open, happy, lid, -face.slant * eye.side);
        eye.shape.setAttribute('d', d);
        eye.halo.setAttribute('d', d);
        eye.shape.parentNode.setAttribute('opacity', '1');
        eye.shape.setAttribute('opacity', (1 - heart).toFixed(3));
        eye.halo.setAttribute('opacity', (1 - heart).toFixed(3));
        const beat = frame.reduced ? 1 : 1 + 0.08 * beats.pulse(frame.t, 0.2);
        eye.heartG.setAttribute('transform', `translate(${cx} ${cy + 1}) scale(${(0.95 * sizeK * beat * (0.6 + 0.4 * heart)).toFixed(3)})`);
        eye.heartG.setAttribute('opacity', heart.toFixed(3));
        const spark = clamp(open * (1 - happy * 1.6) * (1 - lid * 0.8), 0, 1) * (1 - heart);
        eye.sparkBig.setAttribute('cx', (cx - rx * 0.32).toFixed(2));
        eye.sparkBig.setAttribute('cy', (cy - ry * open * 0.36).toFixed(2));
        eye.sparkSmall.setAttribute('cx', (cx + rx * 0.34).toFixed(2));
        eye.sparkSmall.setAttribute('cy', (cy + ry * open * 0.28).toFixed(2));
        eye.sparkBig.setAttribute('opacity', spark.toFixed(3));
        eye.sparkSmall.setAttribute('opacity', (spark * 0.85).toFixed(3));
        // Brows: inner ends rise for worry, fall for focus.
        const inner = L ? face.browInL : face.browInR;
        const by = cy - ry - 6 + face.browY;
        const bw = 5.6 * sizeK;
        const tip = [cx + eye.side * bw, by], mid = [cx, by - 1.4], root = [cx - eye.side * bw, by];
        // SVG turns clockwise for a positive angle: raising the picture-left
        // brow's inner (right) end turns it anticlockwise, the right one's clockwise.
        const r = rotation(inner * eye.side, cx, by);
        eye.brow.setAttribute('d', `M${pt(transform(r, root))} Q${pt(transform(r, mid))} ${pt(transform(r, tip))}`);
        eye.brow.setAttribute('opacity', clamp(face.brow, 0, 1).toFixed(3));
      }
      for (const b of art.blush) b.setAttribute('opacity', (0.7 * clamp(face.blush, 0, 1)).toFixed(3));
      // The mouth sings over its expression without losing it.
      const sing = frame.singing;
      const open = clamp(face.open + sing * (1 - face.open * 0.55), 0, 1.15);
      const width = face.mouthW * (1 - 0.14 * sing);
      const lift = mix(face.lift, 0.32, sing * 0.6);
      const mx = face.mouthX, my = MOUTH.y;
      const d = mouthPath(mx, my, width, face.smile * (1 - 0.3 * sing), open, lift, face.wobble * (1 - 0.5 * open), face.skew * (1 - 0.6 * sing));
      art.mouth.setAttribute('d', d);
      art.mouthHalo.setAttribute('d', d);
      art.mouthClipPath.setAttribute('d', d);
      const depth = open * 9;
      art.tongue.setAttribute('cx', num(mx));
      art.tongue.setAttribute('cy', num(my + face.smile * 3.4 + depth * (1 - lift) - depth * 0.12));
      art.tongue.setAttribute('rx', num(width * 0.3));
      art.tongue.setAttribute('ry', num(Math.max(0.01, depth * 0.32)));
      art.tongue.setAttribute('opacity', clamp((open - 0.2) * 3, 0, 1).toFixed(3));
    }

    onFrame((t) => {
      if (t < at - 0.05 || t > end + 0.45) return;
      render(frameAt(t));
    });
    fx.fadeIn(wrap, at, 0.25);
    if (Number.isFinite(end)) fx.fadeOut(wrap, end, 0.3);
    wrap.style.transform = `translate(${x}px, ${y}px)`;
    return { node: wrap, handPoint };
  }

  window.CodingAgent = { agent, wordsOf, mouthAt, MOVES: Object.keys(MOVES), EXPRESSIONS: Object.keys(EXPRESSIONS), PROPS: Object.keys(PROPS) };
})();
