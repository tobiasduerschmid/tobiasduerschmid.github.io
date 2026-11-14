/*
 * The outlaw of "Design It In Before They Break In": the masked attacker who sneaks through the
 * scenes (in the song, the authorized tester hired to break in first), and
 * the tiny AI-agent robot bandits that follow it in single file. Drawn
 * side-on, facing right (mirrored to face left), lit from the upper left,
 * in the sheriff's line weights (sheriff.js): a flat-crowned black hat, a
 * teal bandana mask over the nose and mouth with one sly eye above it, a
 * charcoal duster coat with the collar up and a short shoulder cape, tan
 * leather gloves (the glove cursor's), dark trousers, and boots with spurs.
 * A unisex figure that never sings: the mask covers its mouth.
 *
 * The figure is rigged: arms and legs are two bones each (inverse
 * kinematics to stage points), the hands are FrontierHand's hands
 * (frontier-hand.js) in glove leather, and the coat's skirt follows the
 * knees. It sneaks between route points in the cartoon tiptoe (knees high,
 * toes pointed, leaning forward, hands up like paws), each step's planted
 * foot locked to the ground: the step cycle is a function of the distance
 * travelled. Every pose is a pure function of song time; under reduced
 * motion the moves snap and the idle motion holds still.
 *
 *   Outlaw.outlaw(parent, { at, until, route, moves, holds, scale })
 *     route  [[t, x, y, facing?], …] the stage point between the feet at
 *            song time t; between keys it sneaks (a key with the same point
 *            is a pause), standing still before the first and after the
 *            last. facing 1 faces right, −1 left: the way it faces at that
 *            key. A move faces the way it travels when either end does
 *            (turning first, or on arrival); only a move whose ends both
 *            face against its travel tiptoes backwards. Every change of
 *            facing is a quick eased turn (0.2 s), not a jump.
 *     moves  [[t, name, options]] from MOVES: reach, both, type, lift, peek,
 *            look, freeze, crouch, shake, shrug, badge, wave.
 *     holds  [[t, 'near' | 'far', prop | null]] from PROPS: sack, cookieJar,
 *            key, lockpick, magnifier, scroll, honeyJar (over the hand),
 *            laptop. Each prop fades in over the one it replaces
 *            (PROP_FADE), so nothing pops in or out of a hand.
 *   Outlaw.bot(parent, { at, until, route, freezes, scale, delay })
 *     a robot bandit that waddles along `route` read at t − delay;
 *     freezes [[t, hold]] are comic statue holds.
 *
 * The figure's box is 160 × 300 at scale 1 (CSS px on the 960 × 540
 * stage), the ground line at 292. Styles: css/song-video-outlaw.css
 * (`.ol-*`); the hands also use western-kit.css's `.sh-hand-*`.
 */
(function () {
  'use strict';

  const { fx, onFrame } = window.Timeline;
  const { el, svg } = window.SongKit;
  const { clamp, smoothThrough } = window.SongFigure;
  const { hand, SHAPES } = window.FrontierHand;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let uid = 0;

  // ------------------------------------------------------------------
  // Proportions (figure frame: 160 × 300, facing right, y down)
  // ------------------------------------------------------------------

  const BOX = { w: 160, h: 300 };
  const MID = 80;            // the feet's midpoint, and the hips' when standing
  const GROUND = 292;        // the soles
  const HIP_Y = 195;         // the hip joint, standing straight
  const THIGH = 44, SHIN = 43;
  const BALL = [11, 10.4];   // the ball of the foot from the ankle, the foot flat
  const UPPER = 40, FORE = 36;
  const HAND_SCALE = 1.2;
  const GRIP = 13;           // wrist to the grip, along the hand
  const STEP = 28;           // body travel per step
  const LIFT = 38;           // how high a sneaking foot rises
  const TORSO = { neck: [3, -102], near: [3, -86], far: [-4, -88] };
  const PROP_FADE = 0.22;    // a prop fades in (and the one it replaces out) over this long

  // ------------------------------------------------------------------
  // Geometry
  // ------------------------------------------------------------------

  const rad = (d) => d * Math.PI / 180;
  const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const minus = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const times = (a, k) => [a[0] * k, a[1] * k];
  const length = (a) => Math.hypot(a[0], a[1]) || 0.0001;
  const unit = (a) => times(a, 1 / length(a));
  const turn = ([x, y], degrees) => {
    const c = Math.cos(rad(degrees)), s = Math.sin(rad(degrees));
    return [x * c - y * s, x * s + y * c];
  };
  const angleOf = ([x, y]) => Math.atan2(y, x) * 180 / Math.PI;
  const lerp = (a, b, u) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * u) : a + (b - a) * u);
  const f2 = (v) => v.toFixed(2);
  const pt = (p) => `${f2(p[0])} ${f2(p[1])}`;
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  /** Starts and stops at rest: the speed rises and falls as 1 − cos. */
  const cycloid = (u) => u - Math.sin(2 * Math.PI * u) / (2 * Math.PI);

  /**
   * Two-bone inverse kinematics: [joint, end] for bones l1, l2 from
   * `origin` towards `target`, the joint on side `side` of the line (for a
   * figure facing right: +1 bends an elbow down and back, −1 a knee
   * forward). Out of reach, the limb points straight at the target.
   */
  function bend(origin, target, l1, l2, side) {
    const d0 = minus(target, origin);
    const full = length(d0);
    const d = clamp(full, Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.2);
    const a = Math.atan2(d0[1], d0[0]);
    const b = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const joint = [origin[0] + l1 * Math.cos(a + side * b), origin[1] + l1 * Math.sin(a + side * b)];
    return [joint, plus(origin, times(d0, d / full))];
  }

  /** A limb segment from a (radius ra) to b (radius rb) with round ends. */
  function capsule(a, b, ra, rb) {
    const u = unit(minus(b, a)), n = [-u[1], u[0]];
    const side = (p, r, s) => pt(plus(p, times(n, r * s)));
    return `M${side(a, ra, 1)} L${side(b, rb, 1)} A${f2(rb)} ${f2(rb)} 0 0 0 ${side(b, rb, -1)} L${side(a, ra, -1)} A${f2(ra)} ${f2(ra)} 0 0 0 ${side(a, ra, 1)} Z`;
  }

  /** A closed smooth outline through `points`. */
  const outline = (points) => `M${pt(points[0])} ${smoothThrough(points)} Z`;

  /** A five-point rowel (the spur's wheel) at (cx, cy). */
  function rowel(cx, cy, r) {
    return `M${Array.from({ length: 10 }, (_, k) => {
      const rr = k % 2 ? r * 0.42 : r, a = (k * 36 - 90) * Math.PI / 180;
      return `${f2(cx + rr * Math.cos(a))} ${f2(cy + rr * Math.sin(a))}`;
    }).join(' L')} Z`;
  }

  // ------------------------------------------------------------------
  // Route: where the feet are, which way it faces, how far it has walked
  // ------------------------------------------------------------------

  /**
   * The route as a function of time: { x, y, facing, s, gait }, where s is
   * the signed distance walked along its facing (stage px; backwards when
   * it tiptoes back) and gait how far into the step cycle it is (0 standing,
   * 1 walking): it rises over the first 0.3 s of a move and falls over 0.35 s
   * of unfrozen standing after it.
   */
  function routeTrack(route, freezes, scale = 1) {
    const keys = route.map(([t, x, y, facing]) => ({ t, x, y, facing }));
    if (!keys.length) keys.push({ t: 0, x: 480, y: 460 });
    const segments = [];
    const turns = [];
    let facing = keys[0].facing ?? 1, walked = 0, phase = 0;
    keys[0].after = facing;
    for (let i = 0; i + 1 < keys.length; i += 1) {
      const a = keys[i], b = keys[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const travel = Math.sign(Math.round(b.x - a.x));
      const moving = len >= 0.5;
      // A key's facing is the way it faces there. A move faces the way it
      // travels when either end does (turning first, or on arrival); only a
      // move whose ends both face against its travel tiptoes backwards.
      let face = a.after;
      if (moving && travel) face = b.facing === travel || (a.facing ?? a.after) === travel ? travel : (a.facing ?? b.facing ?? travel);
      else if (moving) face = a.facing ?? a.after;
      if (face !== a.after) turns.push({ t: a.t, from: a.after, to: face });
      const dir = travel && travel !== face ? -1 : 1;
      // A fast scurry takes longer strides rather than a blur of short ones;
      // each segment keeps one stride, so its planted feet stay put.
      const speed = moving ? len / scale / Math.max(0.05, b.t - a.t) : 0;
      const step = clamp(STEP * Math.sqrt(speed / 70), STEP, 48);
      segments.push({ a, b, len: moving ? len : 0, face, dir, walked, phase, step });
      walked += (moving ? len : 0) * dir;
      phase += (moving ? len : 0) * dir / scale / (2 * step);
      facing = b.facing ?? face;
      b.after = facing;
      if (b.after !== face) turns.push({ t: b.t, from: face, to: b.after });
    }
    /** The facing as a horizontal scale: ±1, easing through a quick turn (0.2 s) about each change. */
    const TURN = 0.1;
    const turnAt = (t) => {
      let f = keys[0].after;
      for (const turn of turns) {
        if (t < turn.t - TURN) break;
        if (t >= turn.t + TURN) { f = turn.to; continue; }
        const u = ease((t - turn.t + TURN) / (2 * TURN));
        const v = lerp(turn.from, turn.to, u);
        return Math.sign(v || turn.to) * Math.max(0.22, Math.abs(v));
      }
      return f;
    };
    const frozen = (from, to) => freezes.reduce((sum, [ft, hold]) => sum + Math.max(0, Math.min(to, ft + hold) - Math.max(from, ft)), 0);
    return (t) => {
      const first = keys[0];
      if (!segments.length || t <= first.t) return { x: first.x, y: first.y, facing: first.after, turn: turnAt(t), s: 0, phase: 0, step: STEP, gait: 0 };
      const gaitOf = (seg, now) => {
        if (!seg || !seg.len || now < seg.a.t) return 0;
        if (now < seg.b.t) return clamp((now - seg.a.t) / 0.3, 0, 1);
        return clamp(1 - (now - seg.b.t - frozen(seg.b.t, now)) / 0.35, 0, 1);
      };
      const i = segments.findIndex((seg) => t < seg.b.t);
      if (i >= 0) {
        const seg = segments[i];
        const u = clamp((t - seg.a.t) / Math.max(0.001, seg.b.t - seg.a.t), 0, 1);
        const e = cycloid(u);
        const previous = segments.slice(0, i).reverse().find((s) => s.len);
        return {
          x: seg.a.x + (seg.b.x - seg.a.x) * e,
          y: seg.a.y + (seg.b.y - seg.a.y) * e,
          facing: seg.face,
          turn: turnAt(t),
          s: seg.walked + seg.len * seg.dir * e,
          phase: seg.phase + seg.len * seg.dir * e / scale / (2 * seg.step),
          step: seg.len ? seg.step : (previous?.step ?? STEP),
          gait: Math.max(gaitOf(seg, t), gaitOf(previous, t)),
        };
      }
      const last = segments[segments.length - 1];
      const lastMove = segments.slice().reverse().find((s) => s.len);
      const end = segments.length ? last.phase + last.len * last.dir / scale / (2 * last.step) : 0;
      return { x: last.b.x, y: last.b.y, facing: last.b.after, turn: turnAt(t), s: last.walked + last.len * last.dir, phase: end, step: lastMove?.step ?? STEP, gait: gaitOf(lastMove, t) };
    };
  }

  // ------------------------------------------------------------------
  // Feet: the tiptoe step cycle
  // ------------------------------------------------------------------

  /**
   * A foot at step phase φ (0 to 1; it stands for the first half, swings
   * for the second): its offset from the hips, how high it is, and its
   * pitch (toe down). Standing on tiptoe, the planted ball moves back
   * exactly as fast as the body moves forward, so it never slides; the
   * swinging foot rises high, toe pointed, and lands a step ahead.
   */
  function footAt(phase, step = STEP) {
    const φ = ((phase % 1) + 1) % 1;
    if (φ < 0.5) return { rel: step * (0.5 - φ / 0.5), lift: 0, pitch: 26 };
    const w = (φ - 0.5) / 0.5, arc = Math.sin(Math.PI * w);
    // Lifted and set down gently: the foot rises and lands with no speed.
    const up = Math.sin(Math.PI * w) ** 1.2;
    return { rel: step * (0.5 - Math.cos(Math.PI * w) / 2 - 0.5) + 12 * arc, lift: LIFT * Math.sqrt(step / STEP) * up, pitch: 26 + 34 * arc };
  }
  const STAND = [{ rel: 6, lift: 0, pitch: 7 }, { rel: -6, lift: 0, pitch: 7 }];

  // ------------------------------------------------------------------
  // Props, drawn in the hand's frame (the wrist at (0, 0), the fingers
  // down, the grip at about (−2.5, 13)); `behind` is under the fingers,
  // `front` over them.
  // ------------------------------------------------------------------

  const HANG = [-2.5, 12];   // where a hanging prop hangs from
  const FIST = [-1, 6.4];    // the middle of a closed fist, where a held handle runs through
  const PROPS = {
    key({ front }) {
      const k = svg('g', { transform: 'translate(-2 9) rotate(-80)' }, front);
      svg('circle', { class: 'ol-brass', cx: 0, cy: 0, r: 4.4 }, k);
      svg('circle', { class: 'ol-hole', cx: 0, cy: 0, r: 1.5 }, k);
      svg('path', { class: 'ol-brass', d: 'M-1.1 4 H1.1 V19 H4 V21.2 H1.1 V23.2 H3.4 V25.4 H-1.1 Z' }, k);
    },
    lockpick({ front }) {
      svg('path', { class: 'ol-pick', d: 'M-3 9 L-3 33 L-0.4 35.6' }, front);
      svg('path', { class: 'ol-pick', d: 'M-5.6 10 L-5.6 25 L-9.4 26.8' }, front);
    },
    // Held as a magnifying glass is: upright whatever the hand's turn (in the
    // plumb layer), the handle down through the fist and the lens above it,
    // tipped a little forward, so a raised hand holds it before the eye.
    magnifier({ upright }) {
      // The handle runs down through the middle of the fist, its butt just
      // below the little finger, and the lens stands above the thumb.
      const [fx, fy] = FIST;
      const g = svg('g', { transform: `rotate(10 ${fx} ${fy})` }, upright);
      svg('rect', { class: 'ol-wood', x: fx - 2.4, y: fy - 16, width: 4.8, height: 26, rx: 2.2 }, g);
      svg('circle', { class: 'ol-lens', cx: fx, cy: fy - 27, r: 10.6 }, g);
      svg('path', { class: 'ol-lens-shine', d: `M${fx - 6.4} ${fy - 30} A7 7 0 0 1 ${fx - 1.4} ${fy - 34}` }, g);
    },
    scroll({ behind }, label) {
      svg('rect', { class: 'ol-paper', x: -22, y: 7, width: 88, height: 14, rx: 7 }, behind);
      svg('path', { class: 'ol-paper-roll', d: 'M-16 8 C-19 11 -19 17 -16 20 M60 8 C63 11 63 17 60 20' }, behind);
      svg('rect', { class: 'ol-ribbon', x: 3, y: 6.4, width: 4.4, height: 15.2, rx: 1 }, behind);
      label(behind, 'Findings', 36, 18.2, 12.5, 'ol-label ol-label--ink');
    },
    sack({ hang: behind }, label) {
      svg('path', { class: 'ol-sack', d: 'M-6.4 6 C-8 9 -7 13 -4.6 15 L-0.6 15 C1.8 13 2.6 9 1 6 Z' }, behind);
      svg('path', { class: 'ol-sack', d: 'M-7.4 17.6 C-25 23 -30 44 -22 56 C-14 65 10 65 18 56 C26 44 21 23 3.6 17.6 Z' }, behind);
      svg('path', { class: 'ol-sack-weave', d: 'M-18 30 L10 28 M-22 44 L16 42 M-12 22 C-16 34 -16 48 -12 58 M8 22 C12 34 12 48 8 58' }, behind);
      svg('path', { class: 'ol-rope', d: 'M-8.6 16.4 C-4 18.6 1 18.6 4.8 16.4' }, behind);
      label(behind, 'DATA', -2, 45, 12.5, 'ol-label ol-label--ink');
    },
    cookieJar({ hang: behind }, label) {
      svg('rect', { class: 'ol-lid', x: -15, y: 8.6, width: 25, height: 8, rx: 2 }, behind);
      svg('path', { class: 'ol-glass', d: 'M-26 17 C-31 21 -31 52 -27 57 C-22 61 18 61 23 57 C27 52 27 21 22 17 Z' }, behind);
      [[-16, 50], [-3, 52], [10, 49], [-10, 41], [5, 41]].forEach(([cx, cy]) => {
        svg('circle', { class: 'ol-cookie', cx, cy, r: 6.4 }, behind);
        [[-2, -2], [2, 1], [-1, 2.6]].forEach(([dx, dy]) => svg('circle', { class: 'ol-chip', cx: cx + dx, cy: cy + dy, r: 1 }, behind));
      });
      svg('rect', { class: 'ol-paper', x: -24.6, y: 20, width: 46, height: 14.6, rx: 2 }, behind);
      label(behind, 'cookies', -1.6, 31.2, 12, 'ol-label ol-label--ink');
      svg('path', { class: 'ol-glass-shine', d: 'M-24 38 C-25.4 44 -25 50 -23 54' }, behind);
    },
    honeyJar({ hangFront: front }, label) {
      svg('path', { class: 'ol-honey-jar', d: 'M-31 -3 C-43 3 -45 38 -35 47 C-23 55 17 55 29 47 C39 38 37 3 25 -3 Z' }, front);
      svg('path', { class: 'ol-honey', d: 'M-38 10 C-41 26 -39 40 -33 45 C-22 52 16 52 27 45 C33 40 34 26 32 10 Z' }, front);
      svg('rect', { class: 'ol-glass-rim', x: -33, y: -8, width: 60, height: 7, rx: 2.4 }, front);
      svg('path', { class: 'ol-honey-drip', d: 'M-26 -2 C-26.6 4 -26.4 9 -25 12 A2.6 2.6 0 1 0 -21.6 10.6 C-22.6 7 -22.4 2 -21 -2 Z M12 -2 C11.4 6 11.8 13 13.4 17 A2.8 2.8 0 1 0 17 15.2 C15.8 10 15.8 4 16.6 -2 Z' }, front);
      // Two lines, so the words stay readable at the figure's scale.
      svg('rect', { class: 'ol-paper', x: -35, y: 11, width: 66, height: 33, rx: 3 }, front);
      label(front, 'HONEY', -2, 25.6, 14, 'ol-label ol-label--ink ol-label--heavy');
      label(front, 'POT', -2, 39.6, 14, 'ol-label ol-label--ink ol-label--heavy');
      svg('path', { class: 'ol-glass-shine', d: 'M-36 14 C-37.4 24 -36.6 34 -33 40' }, front);
    },
    laptop({ hangFront: front }) {
      svg('path', { class: 'ol-laptop', d: 'M-30 10 L30 10 L25 19 L-25 19 Z' }, front);
      svg('rect', { class: 'ol-laptop', x: -25, y: -22, width: 50, height: 32, rx: 2.4 }, front);
      svg('rect', { class: 'ol-screen', x: -21.4, y: -18.6, width: 42.8, height: 25.2, rx: 1 }, front);
      svg('path', { class: 'ol-code', d: 'M-18 -13 H0 M-15 -8 H8 M-15 -3 H2 M-18 2 H-6' }, front);
    },
  };

  // ------------------------------------------------------------------
  // The figure
  // ------------------------------------------------------------------

  /**
   * Draws the outlaw into `root` (inside `fig`, which holds the defs) and
   * returns { draw(state), holdIn(side, prop), setFacing(f) }.
   */
  function build(fig, root) {
    const defs = svg('defs', {}, fig);
    const gradients = [];
    const gradient = (kind, name, attrs, offsets) => {
      const id = `ol-${name}-${++uid}`;
      const g = svg(kind, { id, ...attrs }, defs);
      offsets.forEach((offset, i) => svg('stop', { offset, class: `ol-${name}-stop-${i}` }, g));
      if (attrs.gradientUnits === 'userSpaceOnUse' && kind === 'linearGradient') gradients.push({ g, x1: attrs.x1, x2: attrs.x2 });
      return `url(#${id})`;
    };
    const coat = gradient('linearGradient', 'coat', { gradientUnits: 'userSpaceOnUse', x1: 40, y1: 80, x2: 128, y2: 260 }, ['0', '0.5', '1']);
    const sleeve = gradient('linearGradient', 'sleeve', { gradientUnits: 'userSpaceOnUse', x1: 60, y1: 100, x2: 130, y2: 200 }, ['0', '1']);
    const felt = gradient('linearGradient', 'felt', { x1: 0, y1: 0, x2: 0.3, y2: 1 }, ['0', '1']);
    const pants = gradient('linearGradient', 'pants', { gradientUnits: 'userSpaceOnUse', x1: 50, y1: 190, x2: 120, y2: 290 }, ['0', '1']);
    const boot = gradient('linearGradient', 'boot', { x1: 0, y1: 0, x2: 0.4, y2: 1 }, ['0', '1']);
    const mask = gradient('linearGradient', 'mask', { x1: 0, y1: 0, x2: 0.5, y2: 1 }, ['0', '1']);
    const skin = gradient('linearGradient', 'skin', { x1: 0, y1: 0, x2: 0.6, y2: 1 }, ['0', '1']);
    const glove = gradient('linearGradient', 'glove', { gradientUnits: 'userSpaceOnUse', x1: -5, y1: -2, x2: 7, y2: 24 }, ['0', '0.55', '1']);
    const lining = gradient('linearGradient', 'lining', { x1: 0, y1: 0, x2: 0.7, y2: 1 }, ['0', '1']);
    const brass = gradient('radialGradient', 'brass', { cx: 0.35, cy: 0.3, r: 0.85 }, ['0', '0.55', '1']);
    const labels = [];
    /**
     * An SVG label centred at (x, y). It is kept readable: mirrored back
     * when the figure faces left, and turned half round when the hand that
     * holds it is turned more than a quarter (orientLabels).
     */
    const label = (parent, text, x, y, size, cls) => {
      const node = svg('text', { class: cls, x, y, 'font-size': size, 'text-anchor': 'middle' }, parent);
      node.textContent = text;
      labels.push({ node, x, cy: y - 0.36 * size, side: null, hang: false });
      return node;
    };

    const sway = svg('g', {}, root);
    const layer = (cls) => svg('g', cls ? { class: cls } : {}, sway);
    // Back to front: the far arm and leg, the coat (open in front), the
    // near leg, the coat's near front panel over the top of that leg, the
    // head, collar, mask and hat, the lining, and the near arm.
    const farArmG = layer('ol-far');
    const farLegG = layer('ol-far');
    const coatG = layer();
    const nearLegG = layer();
    const panelG = layer();
    const headG = layer();
    const collarG = layer();
    const faceG = layer();
    const flapG = layer();
    const nearArmG = layer();

    // Arms: a coat sleeve to the elbow and the forearm, a flared glove
    // gauntlet over the sleeve's end, and the gloved hand with its props.
    const arm = (g) => {
      const ink = svg('g', { class: 'ol-ink' }, g);
      const inks = [0, 1, 2].map(() => svg('path', {}, ink));
      const upper = svg('path', { class: 'ol-sleeve', fill: sleeve }, g);
      const fore = svg('path', { class: 'ol-sleeve', fill: sleeve }, g);
      const fold = svg('path', { class: 'ol-fold' }, g);
      const cuff = svg('path', { class: 'ol-gauntlet', fill: glove }, g);
      const stitch = svg('path', { class: 'ol-gauntlet-stitch' }, g);
      const handG = svg('g', { class: 'ol-glove' }, g);
      const behind = svg('g', {}, handG);
      const fingers = svg('g', {}, handG);
      const drawn = hand(fingers, glove);
      const front = svg('g', {}, handG);
      // Two prop slots, so one prop can fade in as another fades out.
      const slots = [0, 1].map(() => ({ behind: svg('g', {}, behind), front: svg('g', {}, front), prop: null, hang: null, hangFront: null, upright: null }));
      return { inks, upper, fore, fold, cuff, stitch, handG, behind, fingers, front, drawn, slots, rot: 0 };
    };
    const arms = { near: arm(nearArmG), far: arm(farArmG) };

    // Legs: trousers into boots with a stitched shaft, a heel, and a spur.
    const FOOT = 'M-6.6 -2.4 C-8 2 -8.2 8 -7.2 10.4 L15.4 10.4 C19.8 10.2 20.8 7.2 17.8 5.6 C13 3.6 8.4 2.2 5.4 -1.8 Z';
    const leg = (g) => {
      const ink = svg('g', { class: 'ol-ink' }, g);
      const inks = [0, 1, 2].map(() => svg('path', {}, ink));
      const footInk = svg('path', { class: 'ol-ink', d: FOOT }, svg('g', {}, ink));
      const thigh = svg('path', { class: 'ol-pants', fill: pants }, g);
      const shin = svg('path', { class: 'ol-pants', fill: pants }, g);
      const knee = svg('path', { class: 'ol-fold' }, g);
      const shaft = svg('path', { class: 'ol-boot', fill: boot }, g);
      const shaftStitch = svg('path', { class: 'ol-boot-stitch' }, g);
      const foot = svg('g', {}, g);
      svg('path', { class: 'ol-spur-strap', d: 'M-7.6 3.4 C-4 2.2 0 2.4 3 3.8' }, foot);
      svg('path', { class: 'ol-spur', d: 'M-7.6 3.8 L-11 4.6' }, foot);
      svg('path', { class: 'ol-spur ol-rowel', d: rowel(-12.6, 4.8, 3.6) }, foot);
      svg('path', { class: 'ol-boot', fill: boot, d: FOOT }, foot);
      svg('path', { class: 'ol-heel', d: 'M-7.2 7.4 L-1.6 7.4 L-1.2 12 L-6.6 12 Z' }, foot);
      svg('path', { class: 'ol-sole', d: 'M-1.4 10.6 L15.4 10.6' }, foot);
      svg('path', { class: 'ol-boot-shine', d: 'M6 3.6 C9 5.2 12.4 6 15.6 6.6' }, foot);
      return { inks, footInk: footInk.parentNode, thigh, shin, knee, shaft, shaftStitch, foot };
    };
    const legs = { far: leg(farLegG), near: leg(nearLegG) };

    // The coat: one outline from the collar down the back, around the
    // skirt's hem (which follows the knees), and up the front; a shoulder
    // cape, buttons, a pocket flap, and the back vent.
    const coatInk = svg('path', { class: 'ol-coat-ink' }, coatG);
    const coatFill = svg('path', { class: 'ol-coat', fill: coat }, coatG);
    const vent = svg('path', { class: 'ol-seam' }, coatG);
    const backSeam = svg('path', { class: 'ol-seam' }, coatG);
    const pocket = svg('path', { class: 'ol-pocket' }, coatG);
    const buttons = [0, 1, 2].map(() => svg('circle', { class: 'ol-button', r: 1.8 }, coatG));
    const cape = svg('path', { class: 'ol-cape', fill: coat }, coatG);
    const capeHem = svg('path', { class: 'ol-seam' }, coatG);
    const panel = svg('path', { class: 'ol-coat', fill: coat }, panelG);
    const panelEdge = svg('path', { class: 'ol-panel-edge' }, panelG);

    // The head, side-on: skin, ear, hair at the nape, the sly eye and brow.
    const head = svg('g', {}, headG);
    svg('path', { class: 'ol-skin', fill: skin, d: 'M-2 12 L-1 -10 L8 -9 L8 12 Z' }, head);
    svg('path', { class: 'ol-skin ol-outline', fill: skin, d: outline([[-9, -7], [-15, -18], [-14, -32], [-5, -42], [8, -41], [16, -34], [18.4, -28.4], [16.4, -25], [18.6, -20.6], [23.6, -15], [19.6, -12.6], [19.8, -9.4], [18.6, -7.8], [19, -5.8], [17, -1.6], [8, 1], [2, 0]]) }, head);
    svg('path', { class: 'ol-hair', d: 'M-15.4 -31 C-16.6 -25 -15 -19.6 -11.4 -18.4 C-9.6 -22 -9.4 -27.6 -10.6 -32.6 Z' }, head);
    svg('ellipse', { class: 'ol-ear', cx: -3.6, cy: -21.6, rx: 3.6, ry: 5.2 }, head);
    svg('path', { class: 'ol-ear-line', d: 'M-2.4 -24.6 C-4.6 -23.4 -4.6 -19.8 -2.6 -18.6' }, head);
    const eyeWhite = svg('path', { class: 'ol-eye-white' }, head);
    const pupil = svg('ellipse', { class: 'ol-pupil', rx: 1.5, ry: 1.8 }, head);
    const lid = svg('path', { class: 'ol-lid' }, head);
    const lash = svg('path', { class: 'ol-lash' }, head);
    const brow = svg('path', { class: 'ol-brow' }, head);

    // The collar, turned up behind the neck and in front of the throat.
    svg('path', { class: 'ol-collar', fill: coat, d: 'M-9.4 -96.6 C-14.6 -101 -16.6 -110 -15 -119.6 C-10.6 -118.6 -5.6 -113.6 -1.6 -107.4 L2 -99.4 Z' }, collarG);
    svg('path', { class: 'ol-collar', fill: coat, d: 'M5.6 -97.4 C9.6 -101.4 12.8 -106.6 12.6 -113.4 C9 -111.6 5.2 -107.4 2.2 -101 Z' }, collarG);
    svg('path', { class: 'ol-seam', d: 'M-12.6 -102 C-12.6 -108 -11.6 -112.6 -10.4 -116' }, collarG);

    // The mask and the hat, in front of the collar.
    const face = svg('g', {}, faceG);
    const tails = svg('path', { class: 'ol-mask', fill: mask }, face);
    svg('path', { class: 'ol-mask', fill: mask, d: 'M-15 -16.6 L2 -19.6 C9 -21.4 14 -21.6 19 -21 C22.6 -19 24.8 -16.6 24.8 -14.8 C24 -10 21 -2 17 8.6 C10 5.4 3 2.6 -2 -1.2 C-7 -4.6 -11 -8.4 -14.6 -12.6 Z' }, face);
    svg('path', { class: 'ol-mask-stitch', d: 'M-11.6 -14.8 L2.4 -17.4 C9 -19 14 -19.2 18.4 -18.6 M22.2 -12 C20.8 -6 18.6 0 16 5.4' }, face);
    [[6, -12], [12, -6], [3, -5], [13, -14], [8, 0]].forEach(([cx, cy]) => svg('circle', { class: 'ol-mask-dot', cx, cy, r: 0.75 }, face));
    svg('circle', { class: 'ol-mask', fill: mask, cx: -15.2, cy: -14.8, r: 3 }, face);
    const hat = svg('g', {}, face);
    svg('path', { class: 'ol-hat', fill: felt, d: 'M-14.2 -35.6 C-14.6 -44 -14 -52 -12.8 -57.4 C-4 -59 6 -59 14.6 -57.4 C15.8 -52 16.4 -44 16.2 -35.6 Z' }, hat);
    svg('path', { class: 'ol-band', d: 'M-14.4 -41.6 C-4 -40.4 6 -40.4 16.2 -41.6 L16.2 -36.4 C6 -35.4 -4 -35.4 -14.4 -36.4 Z' }, hat);
    svg('circle', { class: 'ol-concho', cx: 9.6, cy: -38.8, r: 1.9 }, hat);
    svg('path', { class: 'ol-hat', fill: felt, d: 'M-30.4 -35.6 C-20 -38.2 10 -38.6 31.6 -35.8 C34 -35.4 34.4 -32.6 31.8 -32.4 C10 -34 -20 -33.6 -28.8 -31.6 C-31.6 -31 -32.6 -34.8 -30.4 -35.6 Z' }, hat);
    svg('path', { class: 'ol-hat-shine', d: 'M-11.4 -44 C-11.6 -49 -11 -53 -10 -55.6 M-26 -35.2 C-16 -36.6 -6 -37 4 -37' }, hat);

    // The coat's lining, swung open by the near hand to show the badge.
    const flap = svg('g', { class: 'ol-flap' }, flapG);
    const liningPath = svg('path', { class: 'ol-lining', fill: lining }, flap);
    const liningEdge = svg('path', { class: 'ol-coat-edge', fill: coat }, flap);
    const badge = svg('g', { class: 'ol-badge' }, flap);
    svg('path', { class: 'ol-badge-plate', fill: brass, d: 'M-43 -16 L43 -16 C45 -16 46 -15 46 -13 L46 9 C46 14 30 19 0 22 C-30 19 -46 14 -46 9 L-46 -13 C-46 -15 -45 -16 -43 -16 Z' }, badge);
    svg('path', { class: 'ol-badge-rim', d: 'M-40 -12.6 L40 -12.6 L42 -11 L42 8 C42 11.6 28 15.6 0 18.4 C-28 15.6 -42 11.6 -42 8 L-42 -11 Z' }, badge);
    label(badge, 'AUTHORIZED', 0, -0.6, 12.5, 'ol-label ol-label--badge');
    label(badge, 'TESTER', 0, 13.2, 14, 'ol-label ol-label--badge');

    let facing = 1;
    function setFacing(f) {
      if (f === facing) return;
      facing = f;
      for (const { g, x1, x2 } of gradients) {
        g.setAttribute('x1', f < 0 ? BOX.w - x1 : x1);
        g.setAttribute('x2', f < 0 ? BOX.w - x2 : x2);
      }
    }
    function orientLabels() {
      for (const { node, x, cy, side, hang } of labels) {
        const r = side && !hang ? ((arms[side].rot + 540) % 360) - 180 : 0;
        const mirror = facing < 0 ? `translate(${f2(2 * x)} 0) scale(-1 1)` : '';
        const upright = Math.abs(r) > 90 ? ` rotate(180 ${f2(x)} ${f2(cy)})` : '';
        node.setAttribute('transform', `${mirror}${upright}`);
      }
    }

    /** Draws `prop` (a PROPS key, or null) into one of a hand's two prop slots. */
    function fill(side, slot, prop) {
      for (const g of [slot.behind, slot.front]) g.replaceChildren();
      slot.prop = prop;
      // Props that hang from the hand (a sack, a jar) turn back against the
      // hand's turn about the grip, so they always hang straight down.
      slot.hang = svg('g', { class: 'ol-hang' }, slot.behind);
      slot.hangFront = svg('g', { class: 'ol-hang' }, slot.front);
      // Props held upright in the fist (a magnifying glass) turn back about
      // the middle of the fist, so the handle always runs through the hand.
      slot.upright = svg('g', { class: 'ol-upright' }, slot.behind);
      const before = labels.length;
      if (prop && PROPS[prop]) PROPS[prop]({ behind: slot.behind, front: slot.front, hang: slot.hang, hangFront: slot.hangFront, upright: slot.upright }, label);
      for (const entry of labels.slice(before)) {
        entry.side = side;
        entry.hang = slot.hang.contains(entry.node) || slot.hangFront.contains(entry.node);
      }
      // Forget the labels of props that were put away.
      for (let i = labels.length - 1; i >= 0; i -= 1) if (!root.contains(labels[i].node)) labels.splice(i, 1);
    }

    /**
     * Shows `prop` in the near or far hand, faded in by `u` (0 to 1) over the
     * prop it replaces, `old`, which fades out: nothing pops in or out.
     */
    function holdIn(side, prop, old = null, u = 1) {
      const a = arms[side];
      let [now, was] = a.slots;
      if (prop && was.prop === prop) [now, was] = [was, now];
      if (now.prop !== prop) fill(side, now, prop);
      if (was.prop !== old) fill(side, was, old);
      a.slots = [now, was];
      const e = ease(clamp(u, 0, 1));
      for (const [slot, o] of [[now, prop ? e : 0], [was, old ? 1 - e : 0]]) {
        for (const g of [slot.behind, slot.front]) g.setAttribute('opacity', f2(o));
      }
      // A jar over the hand hides the hand as it comes on.
      const jar = (now.prop === 'honeyJar' ? e : 0) + (was.prop === 'honeyJar' ? 1 - e : 0);
      a.fingers.setAttribute('opacity', f2(1 - jar));
    }

    function drawArm(a, shoulder, wristTarget, flex, curls, swing = 0) {
      const [elbow, wrist] = bend(shoulder, wristTarget, UPPER, FORE, 1);
      const u = unit(minus(wrist, elbow));
      const sleeveEnd = minus(wrist, times(u, 7));
      const cuffBack = minus(wrist, times(u, 11));
      const d = [capsule(shoulder, elbow, 8.6, 7.2), capsule(elbow, sleeveEnd, 7.2, 6.4), capsule(cuffBack, wrist, 7.6, 5.6)];
      a.inks.forEach((ink, i) => ink.setAttribute('d', d[i]));
      a.upper.setAttribute('d', d[0]);
      a.fore.setAttribute('d', d[1]);
      a.cuff.setAttribute('d', d[2]);
      const n = [-u[1], u[0]];
      const s0 = plus(cuffBack, times(u, 2.4)), s1 = plus(wrist, times(u, -1.4));
      a.stitch.setAttribute('d', `M${pt(plus(s0, times(n, 5.6)))} L${pt(plus(s1, times(n, 4)))} M${pt(plus(s0, times(n, -5.6)))} L${pt(plus(s1, times(n, -4)))}`);
      const inner = plus(elbow, times(n, -4.6));
      a.fold.setAttribute('d', `M${pt(plus(inner, times(u, -4)))} Q${pt(plus(elbow, times(n, -1.6)))} ${pt(plus(inner, times(u, 4)))}`);
      a.rot = angleOf(u) - 90 + clamp(flex, -70, 80);
      a.handG.setAttribute('transform', `translate(${pt(wrist)}) rotate(${f2(a.rot)}) scale(${HAND_SCALE})`);
      // Hanging props stay plumb, swinging a little when the hand shakes.
      const plumb = `rotate(${f2(-a.rot + swing)} ${pt(HANG)})`;
      for (const slot of a.slots) {
        slot.hang?.setAttribute('transform', plumb);
        slot.hangFront?.setAttribute('transform', plumb);
        slot.upright?.setAttribute('transform', `rotate(${f2(-a.rot)} ${pt(FIST)})`);
      }
      a.drawn.shape(curls);
      return { elbow, wrist };
    }

    function drawLeg(l, hip, foot) {
      const ankle = minus(foot.ball, turn(BALL, foot.pitch));
      const [knee, end] = bend(hip, ankle, THIGH, SHIN, -1);
      const u = unit(minus(end, knee));
      const shaftTop = minus(end, times(u, 19));
      const d = [capsule(hip, knee, 10.2, 8), capsule(knee, end, 8, 6.2), capsule(shaftTop, end, 7.6, 6.8)];
      l.inks.forEach((ink, i) => ink.setAttribute('d', d[i]));
      l.thigh.setAttribute('d', d[0]);
      l.shin.setAttribute('d', d[1]);
      l.shaft.setAttribute('d', d[2]);
      const n = [-u[1], u[0]];
      l.shaftStitch.setAttribute('d', `M${pt(plus(shaftTop, plus(times(n, 4.6), times(u, 3))))} Q${pt(plus(shaftTop, times(u, 7)))} ${pt(plus(shaftTop, plus(times(n, -4.6), times(u, 3))))}`);
      const kn = unit(minus(knee, hip));
      l.knee.setAttribute('d', `M${pt(plus(knee, plus(times(kn, -5), times([-kn[1], kn[0]], 3))))} Q${pt(plus(knee, times([-kn[1], kn[0]], 5)))} ${pt(plus(knee, plus(times(kn, 4), times([-kn[1], kn[0]], 4))))}`);
      const footT = `translate(${pt(end)}) rotate(${f2(foot.pitch)})`;
      l.foot.setAttribute('transform', footT);
      l.footInk.setAttribute('transform', footT);
      return knee;
    }

    /** Draws the pose `p` (see compose). */
    function draw(p) {
      sway.setAttribute('transform', p.wobble ? `rotate(${f2(p.wobble)} ${pt(p.pivot)})` : '');
      const T = p.T;
      const kneeFar = drawLeg(legs.far, p.hip, p.feet[1]);
      const kneeNear = drawLeg(legs.near, p.hip, p.feet[0]);

      // The coat's outline: open in front, it hangs behind the near leg and
      // around the far knee, and its back covers whichever knee is behind.
      const waistBack = T([-17.6, -6]), waistFront = T([15.6, -4]);
      const back = kneeNear[0] > kneeFar[0] ? kneeFar : kneeNear;
      const hemY = p.hip[1] + 33;
      const flutter = p.flutter;
      const frontHem = [Math.max(waistFront[0] + 4, kneeFar[0] + 4), Math.min(hemY, kneeFar[1] - 3)];
      const backHem = [Math.min(waistBack[0] - 4, back[0] - 9) - 3 * flutter, hemY + 3];
      const mid = [(frontHem[0] + backHem[0]) / 2, Math.max(frontHem[1], backHem[1]) + 3];
      const points = [
        T([8, -97]), T([0, -101]), T([-8, -99]), T([-16, -94]), T([-19, -80]), T([-19, -56]), T([-18, -30]), waistBack,
        plus(lerp(waistBack, backHem, 0.55), [-1.5 - flutter, 0]), backHem, mid, frontHem,
        lerp(waistFront, frontHem, 0.5), waistFront, T([14.6, -24]), T([16.4, -48]), T([16.6, -70]), T([14, -88]),
      ];
      const coatD = outline(points);
      coatInk.setAttribute('d', coatD);
      coatFill.setAttribute('d', coatD);
      const ventTop = [backHem[0] + 12, backHem[1] - 22];
      vent.setAttribute('d', `M${pt([backHem[0] + 10, backHem[1] + 1.5])} L${pt(ventTop)}`);
      backSeam.setAttribute('d', `M${pt(T([-11, -92]))} Q${pt(T([-14, -50]))} ${pt(T([-13, -8]))}`);
      pocket.setAttribute('d', `M${pt(T([-4, -14]))} L${pt(T([10, -13]))}`);
      [[15.2, -72], [16, -54], [15.2, -36]].forEach((b, i) => {
        const c = T(b);
        buttons[i].setAttribute('cx', f2(c[0]));
        buttons[i].setAttribute('cy', f2(c[1]));
      });
      const capeD = outline([T([-12, -98]), T([-19, -92]), T([-21.6, -78]), T([-20, -68]), T([-6, -66]), T([8, -67]), T([19.6, -71]), T([19, -84]), T([12, -96]), T([0, -101])]);
      cape.setAttribute('d', capeD);
      capeHem.setAttribute('d', `M${pt(T([-19, -71]))} Q${pt(T([0, -68]))} ${pt(T([18, -74]))}`);
      // The near front panel, from the chest to just below the hip, over the
      // top of the near thigh.
      panel.setAttribute('d', outline([T([2, -30]), T([14.6, -24]), waistFront, T([17.6, 8]), T([12, 13.6]), T([0, 13]), T([-11, 10]), T([-12, -4]), T([-8, -20])]));
      panelEdge.setAttribute('d', `M${pt(T([14.6, -24]))} Q${pt(T([15.4, -12]))} ${pt(waistFront)} L${pt(T([17.6, 8]))} Q${pt(T([14, 14.4]))} ${pt(T([6, 13.8]))} Q${pt(T([-4, 13]))} ${pt(T([-11, 10]))}`);

      // The head, the collar, the mask and hat.
      const torsoT = `translate(${pt(p.hip)}) rotate(${f2(p.lean)})`;
      collarG.setAttribute('transform', torsoT);
      const neck = T(TORSO.neck);
      const headT = `translate(${pt(neck)}) rotate(${f2(p.headTilt)})${p.headFlip !== 1 ? ` translate(4 0) scale(${f2(p.headFlip)} 1) translate(-4 0)` : ''}`;
      head.setAttribute('transform', headT);
      face.setAttribute('transform', headT);
      hat.setAttribute('transform', `translate(0 ${f2(3.6 * p.dip)}) rotate(${f2(4 + 9 * p.dip)} 2 -36)`);
      const wag = p.flutter * 2.4;
      tails.setAttribute('d', `M-15 -16.8 C-19 -16 -23 ${f2(-14 - wag)} -27.4 ${f2(-11.2 - wag)} C-24.6 -10.6 -21.6 -11.6 -17.6 -13 C-20.6 ${f2(-8 + wag)} -23.4 ${f2(-4 + wag)} -25 ${f2(-1.2 + wag)} C-21 -2.6 -17.6 -7 -14.4 -12.8 Z`);
      // The eye: narrowed and sly; turned to the viewer it opens and its
      // pupil comes round to the front.
      const open = 1 + 0.6 * p.side + 0.5 * p.alarm;
      const ex = 11.8, ey = -25.8;
      eyeWhite.setAttribute('d', `M${f2(ex - 4)} ${f2(ey + 0.2)} Q${f2(ex)} ${f2(ey - 2.2 * open)} ${f2(ex + 3.8)} ${f2(ey - 0.4)} Q${f2(ex)} ${f2(ey + 1.8 * open)} ${f2(ex - 4)} ${f2(ey + 0.2)} Z`);
      const px = ex + 1.4 + 1.1 * clamp(p.look, -1, 1) - 1.4 * p.side;
      pupil.setAttribute('cx', f2(px));
      pupil.setAttribute('cy', f2(ey + 0.1 + 0.3 * p.side));
      pupil.setAttribute('ry', f2(1.5 + 0.4 * open - 0.4));
      lid.setAttribute('d', `M${f2(ex - 4.4)} ${f2(ey - 0.2)} Q${f2(ex)} ${f2(ey - 2.6 * open)} ${f2(ex + 4.2)} ${f2(ey - 0.8)}`);
      lash.setAttribute('d', `M${f2(ex + 4.2)} ${f2(ey - 0.8)} L${f2(ex + 5.6)} ${f2(ey - 1.8)}`);
      const by = ey - 5.2 - 1.8 * p.brow - 1.2 * p.alarm;
      const slant = 2.4 * (1 - 0.6 * p.brow - p.alarm);
      brow.setAttribute('d', `M${f2(ex - 5)} ${f2(by - slant * 0.5)} Q${f2(ex - 0.6)} ${f2(by - 1.6)} ${f2(ex + 4.6)} ${f2(by + slant)}`);

      // The lining, open by p.coat, with the badge pinned in the middle.
      flapG.setAttribute('transform', torsoT);
      const c = p.coat;
      flap.setAttribute('display', c > 0.01 ? 'inline' : 'none');
      if (c > 0.01) {
        const ox = 15 + 96 * c;
        liningPath.setAttribute('d', `M14 -90 C${f2(14 + 40 * c)} ${f2(-92 + 2 * c)} ${f2(ox - 6)} ${f2(-86 + 4 * c)} ${f2(ox)} ${f2(-80 + 6 * c)} C${f2(ox + 2)} -56 ${f2(ox)} -30 ${f2(ox - 4)} ${f2(-6 - 2 * c)} C${f2(14 + 50 * c)} -2 30 -2 15.6 -4 Z`);
        liningEdge.setAttribute('d', `M${f2(ox - 1)} ${f2(-81 + 6 * c)} C${f2(ox + 1)} -56 ${f2(ox - 1)} -30 ${f2(ox - 5)} ${f2(-6 - 2 * c)} L${f2(ox + 2)} ${f2(-6 - 2 * c)} C${f2(ox + 6)} -30 ${f2(ox + 8)} -56 ${f2(ox + 6)} ${f2(-81 + 6 * c)} Z`);
        const shown = clamp((c - 0.55) / 0.35, 0, 1);
        badge.setAttribute('transform', `translate(${f2(15 + 49 * c)} -46) scale(${f2(0.6 + 0.4 * shown)})`);
        badge.setAttribute('opacity', f2(shown));
      }

      // The arms, far behind and near in front.
      drawArm(arms.far, p.shoulders[1], p.wrists[1], p.flex[1], p.curls[1]);
      drawArm(arms.near, p.shoulders[0], p.wrists[0], p.flex[0], p.curls[0], p.swing);
      orientLabels();
    }

    return { draw, holdIn, setFacing };
  }

  // ------------------------------------------------------------------
  // Moves
  // ------------------------------------------------------------------

  /** At rest: no move holds the hands, the body, or the face. */
  const IDLE = {
    nearW: 0, nearTo: [MID, 160], nearShape: SHAPES.rest, nearWrist: 0, nearTip: 0,
    farW: 0, farTo: [MID, 160], farShape: SHAPES.rest, farWrist: 0, farTip: 0,
    crouch: 0, lean: 0, tilt: 0, look: 0, brow: 0, side: 0, dip: 0, alarm: 0,
    tap: 0, shake: 0, coat: 0, shrug: 0, wave: 0, rise: 0,
  };
  const SIDES = { near: 'near', far: 'far' };
  /** Lets go with `sides` at `at`: the hands go back to the sneak. */
  const release = (at, sides) => [at, 0.4, Object.fromEntries(sides.flatMap((s) => [[`${s}W`, 0], [`${s}Shape`, SHAPES.rest], [`${s}Wrist`, 0]]))];
  /** Sets `fields` at once (targets), so the hand eases only in its weight. */
  const now = (delay, fields) => [delay, 0.001, fields];
  // Two typing hands: a finger raised, alternately.
  const TAP = [-8, 2, 2, 30, 40, 24, 34, 42, 26, 38, 44, 26, 12, 18];

  /**
   * The outlaw's moves for outlaw({ moves }): each a list of pose keys
   * [delay, duration, fields] from its moment. `frame` turns a stage point
   * into the figure's own frame at that moment (frame.scale is the scale).
   * Hand targets are where the grip (or the fingertips, for a point)
   * should be.
   */
  const MOVES = {
    reach: ({ to, hand: side = 'near', shape = 'grip', hold = 1.2 }, frame) => {
      const s = SIDES[side] ?? 'near';
      return [
        now(-0.4, { [`${s}To`]: frame(to), [`${s}Tip`]: shape === 'point' ? 1 : 0 }),
        [-0.4, 0.42, { [`${s}W`]: 1, [`${s}Shape`]: SHAPES[shape] ?? SHAPES.grip, [`${s}Wrist`]: shape === 'point' ? 0 : 14 }],
        release(hold, [s]),
      ];
    },
    both: ({ to, shape = 'grip', hold = 1.2 }, frame) => {
      const [x, y] = frame(to), gap = 7;
      return [
        now(-0.4, { nearTo: [x + gap, y], farTo: [x - gap, y - 1] }),
        [-0.4, 0.42, { nearW: 1, farW: 1, nearShape: SHAPES[shape] ?? SHAPES.grip, farShape: SHAPES[shape] ?? SHAPES.grip, nearWrist: 16, farWrist: 16 }],
        release(hold, ['near', 'far']),
      ];
    },
    type: ({ to, hold = 1.6 }, frame) => {
      const [x, y] = frame(to);
      return [
        now(-0.4, { nearTo: [x + 6, y], farTo: [x - 6, y - 1] }),
        [-0.4, 0.42, { nearW: 1, farW: 1, nearShape: SHAPES.rest, farShape: SHAPES.rest, nearWrist: 38, farWrist: 38, lean: 6, look: 0.6 }],
        [-0.1, 0.25, { tap: 1 }],
        [hold, 0.2, { tap: 0, lean: 0, look: 0 }],
        release(hold, ['near', 'far']),
      ];
    },
    lift: ({ to, height = 36, hold = 1.4 }, frame) => {
      const [x, y] = frame(to), up = height / frame.scale, gap = 8;
      const at = (dy) => ({ nearTo: [x + gap, y - dy], farTo: [x - gap, y - dy - 1] });
      return [
        now(-0.4, at(0)),
        [-0.4, 0.4, { nearW: 1, farW: 1, nearShape: SHAPES.grip, farShape: SHAPES.grip, nearWrist: 22, farWrist: 22, crouch: 5 }],
        [0.35, 0.5, { ...at(up), crouch: -2, lean: -5, brow: 0.5 }],
        [0.85 + hold, 0.5, { ...at(0), crouch: 0, lean: 0, brow: 0 }],
        release(1.35 + hold, ['near', 'far']),
      ];
    },
    peek: ({ dir = 1, hold = 1.2 }) => [[-0.2, 0.4, { lean: 12, rise: 1, look: dir, brow: 0.6 }], [hold, 0.4, { lean: 0, rise: 0, look: 0, brow: 0 }]],
    look: ({ dir = 1, hold = 1 }) => [
      [0, 0.18, dir === 'viewer' ? { side: 1, brow: 0.5 } : { look: dir }],
      [hold, 0.22, { side: 0, brow: 0, look: 0 }],
    ],
    // Freezes are poses held from their moment (outlaw() reads them).
    freeze: () => [],
    crouch: ({ hold = 1.2 }) => [[-0.2, 0.35, { crouch: 22, lean: 14, dip: 0.8 }], [hold, 0.4, { crouch: 0, lean: 0, dip: 0 }]],
    shake: ({ hand: side = 'near', hold = 1.4 }) => {
      const s = SIDES[side] ?? 'near';
      return [
        now(-0.15, { [`${s}To`]: [MID + 50, 152] }),
        // The hand hangs from the wrist, so a jar stuck on it hangs label up.
        [-0.15, 0.25, { [`${s}W`]: 1, [`${s}Shape`]: SHAPES.fist, [`${s}Wrist`]: 66, shake: 1, lean: -9, alarm: 1 }],
        [hold, 0.3, { shake: 0, lean: 0, alarm: 0 }],
        release(hold, [s]),
      ];
    },
    // Shoulders up, elbows at the sides, forearms out with open hands, head tipped.
    shrug: ({ hold = 1 }) => [
      now(-0.2, { nearTo: [MID + 50, 172], farTo: [MID + 38, 170] }),
      [-0.2, 0.35, { shrug: 1, nearW: 1, farW: 1, nearShape: SHAPES.open, farShape: SHAPES.open, nearWrist: -18, farWrist: -18, tilt: 7, brow: 0.9 }],
      [hold, 0.4, { shrug: 0, tilt: 0, brow: 0 }],
      release(hold, ['near', 'far']),
    ],
    badge: ({ hold = 2 }) => [[-0.3, 0.6, { coat: 1, side: 1, brow: 0.5 }], [hold, 0.5, { coat: 0, side: 0, brow: 0 }]],
    wave: ({ hold = 1.2 }) => [[-0.2, 0.35, { wave: 1, side: 1, tilt: -5 }], [hold, 0.35, { wave: 0, side: 0, tilt: 0 }]],
  };

  /** A pose at song time t from timed keys: each field eases to its key's value. */
  function poseTrack(keys) {
    const sorted = keys.slice().sort((a, b) => a[0] - b[0]);
    return (t, reduced) => {
      const state = { ...IDLE };
      for (const [start, duration, fields] of sorted) {
        if (t < start) break;
        const u = reduced ? 1 : ease(clamp((t - start) / duration, 0, 1));
        for (const [name, value] of Object.entries(fields)) state[name] = lerp(state[name], value, u);
      }
      return state;
    };
  }

  // ------------------------------------------------------------------
  // The outlaw on stage
  // ------------------------------------------------------------------

  /**
   * The full pose at song time t: the walk (from the route) under the
   * keyed moves. Returns what build().draw needs, in the figure's frame.
   */
  function compose(t, walk, k, freeze, reduced) {
    const gait = walk.gait;
    const phase = walk.phase;
    const calm = reduced ? 0 : 1;
    const crouch = lerp(8, 20, gait) + k.crouch - 5 * k.rise;
    const lean = lerp(10, 22, gait) + k.lean;
    const bob = calm * gait * 2.2 * Math.cos(4 * Math.PI * phase);
    const breath = calm * (1 - gait) * 0.8 * Math.sin(t * 1.7);
    const hip = [MID + 2 * gait, HIP_Y + crouch + bob];
    const T = (p) => plus(hip, turn(p, lean));
    const lift = 6 * k.shrug + breath;
    const shoulders = [T([TORSO.near[0], TORSO.near[1] - lift]), T([TORSO.far[0], TORSO.far[1] - lift])];

    // Feet: the step cycle blended with standing, on tiptoe when peeking.
    const feet = [0, 0.5].map((offset, i) => {
      const step = footAt(phase + offset, walk.step), stand = STAND[i];
      const f = {
        rel: lerp(stand.rel, step.rel, gait),
        lift: lerp(stand.lift, step.lift, gait),
        pitch: lerp(stand.pitch, step.pitch, gait) + 20 * k.rise,
      };
      return f;
    });
    // A freeze is a statue on one leg: the near knee snaps up high, toe
    // pointed, the far foot on tiptoe under the body.
    if (freeze) {
      const w = freeze.lift, [n, f] = feet;
      feet[0] = { rel: lerp(n.rel, 10, w), lift: lerp(n.lift, LIFT, w), pitch: lerp(n.pitch, 58, w) };
      feet[1] = { rel: lerp(f.rel, -2, w), lift: lerp(f.lift, 0, w), pitch: lerp(f.pitch, 30, w) };
    }
    const placed = feet.map((f) => ({ ball: [MID + f.rel + BALL[0], GROUND - f.lift], pitch: f.pitch }));
    const planted = feet[0].lift <= feet[1].lift ? placed[0].ball : placed[1].ball;

    // Hands: up like paws while sneaking; then a wave, the coat's edge, or a move's target.
    const swing = calm * gait * 2.6 * Math.sin(2 * Math.PI * phase);
    const paws = [plus(T([25, -66]), [0, swing]), plus(T([18, -63]), [0, -swing])];
    // The wrist stops short of a target by the grip, or by the pointing finger.
    const reachFor = (shoulder, target, tip) => minus(target, times(unit(minus(target, shoulder)), (GRIP + 11 * tip) * HAND_SCALE));
    const wrists = [0, 1].map((i) => {
      const s = i ? 'far' : 'near';
      let w = paws[i];
      if (!i && k.wave) w = lerp(w, T([42, -122]), k.wave);
      if (!i && k.coat) w = lerp(w, T([15 + 96 * k.coat, -62]), clamp(k.coat * 1.6, 0, 1));
      if (k[`${s}W`]) w = lerp(w, reachFor(shoulders[i], k[`${s}To`], k[`${s}Tip`]), k[`${s}W`]);
      if (!i && k.shake) w = plus(w, [0, 9 * k.shake * Math.sin(2 * Math.PI * 6.5 * t)]);
      return w;
    });
    const waveFlex = k.wave * (10 + 24 * calm * Math.sin(2 * Math.PI * 2.6 * t));
    const flex = [
      lerp(78, k.nearWrist, clamp(k.nearW + k.coat + k.wave, 0, 1)) + waveFlex + 26 * k.shake * calm * Math.sin(2 * Math.PI * 6.5 * t + 0.6),
      lerp(72, k.farWrist, k.farW),
    ];
    const tapAt = (shift) => (calm ? (Math.sin(2 * Math.PI * 6 * t + shift) + 1) / 2 : 0.5) * k.tap;
    const curls = [
      lerp(lerp(SHAPES.rest, k.nearShape, k.nearW), SHAPES.open, k.wave),
      lerp(SHAPES.rest, k.farShape, k.farW),
    ];
    curls[0] = lerp(curls[0], SHAPES.grip, clamp(k.coat * 1.6, 0, 1) * (1 - k.nearW));
    curls[0] = lerp(curls[0], TAP, tapAt(0));
    curls[1] = lerp(curls[1], TAP, tapAt(Math.PI));

    // The head stays nearly upright while the body leans; idle, it glances back now and then.
    const glanceCycle = ((t / 4.6) % 1 + 1) % 1;
    const glance = calm * (1 - gait) * (glanceCycle > 0.56 && glanceCycle < 0.72 ? -0.8 : 0.35);
    let look = k.look + glance * (1 - Math.min(1, Math.abs(k.look) + k.side));
    if (freeze) look = lerp(look, calm * 0.9 * Math.sin(2 * Math.PI * 1.3 * freeze.age), freeze.lift);
    const headFlip = k.look < -0.5 ? lerp(1, -1, clamp((-k.look - 0.5) / 0.4, 0, 1)) : 1;

    return {
      hip, lean, T, shoulders, feet: placed, wrists, flex, curls,
      headTilt: 0.25 * lean - 6 + k.tilt + 5 * k.dip,
      headFlip: Math.abs(headFlip) < 0.08 ? 0.08 * Math.sign(headFlip || 1) : headFlip,
      look, brow: k.brow, side: k.side, alarm: Math.max(k.alarm, freeze ? 0.6 * freeze.lift : 0), dip: k.dip, coat: k.coat,
      flutter: calm * (gait * Math.sin(2 * Math.PI * phase + 1) + 0.3 * Math.sin(t * 1.3)),
      wobble: freeze ? calm * 1.6 * Math.sin(2 * Math.PI * 2.4 * freeze.age) * freeze.lift : 0, pivot: planted,
      swing: 22 * k.shake * calm * Math.sin(2 * Math.PI * 6.5 * t + 1.2),
    };
  }

  /**
   * The outlaw on stage from `at` to `until` (see the header for route,
   * moves, and holds).
   */
  function outlaw(parent, { at, until, route = [], moves = [], holds = [], scale = 1 }) {
    const wrap = el('div', 'ol-outlaw is-staged', parent);
    wrap.dataset.testid = 'outlaw';
    wrap.style.width = `${BOX.w * scale}px`;
    wrap.style.height = `${BOX.h * scale}px`;
    const fig = svg('svg', { class: 'ol-art', viewBox: `0 0 ${BOX.w} ${BOX.h}`, width: BOX.w * scale, height: BOX.h * scale, 'aria-hidden': 'true' }, wrap);
    const root = svg('g', {}, fig);
    svg('ellipse', { class: 'ol-shadow', cx: MID, cy: GROUND, rx: 34, ry: 4.6 }, root);
    const body = build(fig, root);

    const freezes = moves.filter(([, name]) => name === 'freeze').map(([when, , options = {}]) => [when, options.hold ?? 1.2]);
    const walkAt = routeTrack(route, freezes, scale);
    /** A stage point in the figure's frame, where the figure stands at `when`. */
    const frameAt = (when) => {
      const w = walkAt(when);
      const frame = ([sx, sy]) => [MID + (sx - w.x) / scale * w.facing, GROUND + (sy - w.y) / scale];
      frame.scale = scale;
      return frame;
    };
    const track = poseTrack(moves.filter(([, name]) => MOVES[name]).flatMap(([when, name, options = {}]) => MOVES[name](options, frameAt(when)).map(([delay, duration, fields]) => [when + delay, duration, fields])));
    const heldAt = holds.slice().sort((a, b) => a[0] - b[0]);

    onFrame((t) => {
      const reduced = reducedMotion.matches;
      // Each prop fades in over the last one held in that hand (PROP_FADE).
      for (const s of ['near', 'far']) {
        const list = heldAt.filter(([, which]) => which === s);
        let i = -1;
        list.forEach(([when], k) => { if (when <= t) i = k; });
        const prop = i >= 0 ? list[i][2] : null, old = i > 0 ? list[i - 1][2] : null;
        const u = i >= 0 ? (t - list[i][0]) / PROP_FADE : 1;
        body.holdIn(s, prop, u < 1 ? old : null, u);
      }
      // In a freeze, everything holds where it was when the freeze began.
      const active = freezes.find(([when, hold]) => t >= when && t <= when + hold);
      // Just after a freeze, the statue melts back into the pose over 0.3 s.
      const after = active ? null : freezes.find(([when, hold]) => t > when + hold && t < when + hold + 0.3);
      const time = active ? active[0] : t;
      // Under reduced motion it glides along its route standing, without the step cycle.
      const walk = { ...walkAt(time), scale };
      if (reduced) walk.gait = 0;
      const freeze = active ? { age: t - active[0], lift: reduced ? 1 : clamp((t - active[0]) / 0.14, 0, 1) }
        : after && !reduced ? { age: t - after[0], lift: ease(1 - (t - after[0] - after[1]) / 0.3), melting: true } : null;
      const pose = compose(time, walk, track(time, reduced), freeze, reduced);
      const turn = reduced ? walk.facing : walk.turn;
      body.setFacing(Math.sign(turn));
      root.setAttribute('transform', turn === 1 ? '' : `translate(${f2(MID * (1 - turn))} 0) scale(${f2(turn)} 1)`);
      wrap.style.transform = `translate(${f2(walk.x - MID * scale)}px, ${f2(walk.y - GROUND * scale)}px)`;
      body.draw(pose);
    });
    fx.fadeIn(wrap, at, 0.3);
    if (until !== undefined) fx.fadeOut(wrap, until, 0.3);
    return wrap;
  }

  // ------------------------------------------------------------------
  // The robot bandits
  // ------------------------------------------------------------------

  const BOT = { w: 60, h: 70, ground: 66, mid: 30, step: 8 };

  /**
   * A tiny AI-agent robot bandit (about 46 × 56 px at scale 1): a boxy head
   * with an antenna, two LED eyes over a bandana mask, mitten hands, and
   * stubby legs. It waddles along `route` (read at t − delay); during a
   * freeze it stands on one leg with its arms up and its eyes wide.
   */
  function bot(parent, { at, until, route = [], freezes = [], scale = 1, delay = 0 }) {
    const wrap = el('div', 'ol-bot is-staged', parent);
    wrap.dataset.testid = 'outlaw-bot';
    wrap.style.width = `${BOT.w * scale}px`;
    wrap.style.height = `${BOT.h * scale}px`;
    const fig = svg('svg', { class: 'ol-art', viewBox: `0 0 ${BOT.w} ${BOT.h}`, width: BOT.w * scale, height: BOT.h * scale, 'aria-hidden': 'true' }, wrap);
    const root = svg('g', {}, fig);
    svg('ellipse', { class: 'ol-shadow', cx: BOT.mid, cy: BOT.ground + 0.6, rx: 13, ry: 2.4 }, root);
    const body = svg('g', {}, root);
    const legs = [0, 1].map(() => svg('path', { class: 'ol-bot-leg' }, body));
    const feet = [0, 1].map(() => svg('ellipse', { class: 'ol-bot-foot', rx: 4.4, ry: 2.4 }, body));
    const arms = [0, 1].map(() => svg('path', { class: 'ol-bot-arm' }, body));
    svg('rect', { class: 'ol-bot-metal', x: 18, y: 33, width: 24, height: 21, rx: 4 }, body);
    svg('rect', { class: 'ol-bot-panel', x: 23, y: 38, width: 14, height: 10, rx: 2 }, body);
    [26, 30, 34].forEach((cx, i) => svg('circle', { class: `ol-bot-light ol-bot-light--${i}`, cx, cy: 43, r: 1.4 }, body));
    const mittens = [0, 1].map(() => svg('circle', { class: 'ol-bot-mitten', r: 3.6 }, body));
    const headG = svg('g', {}, body);
    svg('path', { class: 'ol-bot-antenna', d: 'M28 8 L27 1' }, headG);
    svg('circle', { class: 'ol-bot-bulb', cx: 27, cy: 0.4, r: 2.6 }, headG);
    svg('rect', { class: 'ol-bot-metal', x: 13, y: 7, width: 34, height: 25, rx: 6 }, headG);
    svg('rect', { class: 'ol-bot-visor', x: 26, y: 11, width: 19, height: 9.6, rx: 3.6 }, headG);
    const eyes = [31, 39].map((cx) => svg('ellipse', { class: 'ol-bot-eye', cx, cy: 15.8, rx: 1.9, ry: 1.9 }, headG));
    svg('path', { class: 'ol-bot-mask', d: 'M14.6 21 L46.4 20.2 L46.6 25 C44 29 41.6 33 40 36.4 C34 31.6 24 28.6 14.4 27.6 Z' }, headG);
    svg('path', { class: 'ol-bot-mask', d: 'M14.6 21.6 C11 21 8 22.6 6 24.6 C8.4 25 10.6 25.2 13.6 24.6 C10.6 26.4 9 28.6 8 30.6 C11 30 13 28.6 14.6 27 Z' }, headG);
    svg('path', { class: 'ol-bot-bolt', d: 'M17 12 h0.01 M17 27 h0.01' }, headG);

    const freezeHolds = freezes.map(([when, hold]) => [when, hold]);
    // The route is read `delay` seconds late, so a freeze falls at when − delay on it.
    const walkAt = routeTrack(route, freezeHolds.map(([when, hold]) => [when - delay, hold]));
    onFrame((t) => {
      const reduced = reducedMotion.matches;
      const active = freezeHolds.find(([when, hold]) => t >= when && t <= when + hold);
      const time = active ? active[0] : t;
      const w = walkAt(time - delay);
      const calm = reduced ? 0 : 1;
      const phase = w.s / scale / (2 * BOT.step);
      const step = Math.sin(2 * Math.PI * phase) * w.gait * calm;
      const up = active ? 1 : 0;
      const age = active ? t - active[0] : 0;
      const tilt = active ? 2 * calm * Math.sin(2 * Math.PI * 2.6 * age) : 5 * step;
      body.setAttribute('transform', `translate(0 ${f2(-1.6 * Math.abs(step))}) rotate(${f2(tilt)} 30 64)`);
      [0, 1].forEach((i) => {
        const sign = i ? -1 : 1;
        const raise = active ? (i ? 7 : 0) : Math.max(0, 3.6 * step * sign);
        const x = (i ? 34 : 25) + (active ? 0 : 2 * step * sign);
        legs[i].setAttribute('d', `M${f2(i ? 34 : 25)} 53 L${f2(x)} ${f2(62 - raise)}`);
        feet[i].setAttribute('cx', f2(x + 1.6));
        feet[i].setAttribute('cy', f2(64 - raise));
        const shoulder = [i ? 41 : 19, 37];
        const hand = active ? [i ? 58 : 2, 4] : [shoulder[0] + (i ? 4 : -4) + 3 * step * -sign, 50];
        arms[i].setAttribute('d', `M${pt(shoulder)} Q${pt([(shoulder[0] + hand[0]) / 2 + (i ? 3 : -3), (shoulder[1] + hand[1]) / 2])} ${pt(hand)}`);
        mittens[i].setAttribute('cx', f2(hand[0]));
        mittens[i].setAttribute('cy', f2(hand[1]));
      });
      eyes.forEach((eye) => {
        eye.setAttribute('rx', f2(1.9 + 1 * up));
        eye.setAttribute('ry', f2(1.9 + 1 * up));
      });
      const turn = reduced ? w.facing : w.turn;
      root.setAttribute('transform', turn === 1 ? '' : `translate(${f2(BOT.mid * (1 - turn))} 0) scale(${f2(turn)} 1)`);
      wrap.style.transform = `translate(${f2(w.x - BOT.mid * scale)}px, ${f2(w.y - BOT.ground * scale)}px)`;
    });
    fx.fadeIn(wrap, at, 0.3);
    if (until !== undefined) fx.fadeOut(wrap, until, 0.3);
    return wrap;
  }

  window.Outlaw = { outlaw, bot, MOVES, PROPS };
})();
