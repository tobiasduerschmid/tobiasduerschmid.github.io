/*
 * The two dancers of "Red, Green, Refactor": Test, who leads, and Code, who
 * follows. Both are personified, not human, so every viewer can see
 * themselves in either part:
 *
 *   Test wears a midnight tailcoat and its head is a glass status lamp: it
 *     glows warm while idle, red with a ✗ on its chest badge while a test
 *     fails, and green with a ✓ once the tests pass (shape plus colour, so
 *     the state never depends on colour alone);
 *   Code is a document with curly-brace hair clips, and its gown is a page
 *     of syntax-coloured code lines. The lines sit jagged and out of
 *     alignment while the code is messy and line up in clean indentation
 *     when it is refactored: the structure changes, the dancer does not.
 *
 * A troupe (one or both dancers) is one SVG rig. Every pose is a pure
 * function of song time: keyed joint angles blend with an ease, the waltz
 * rise-and-fall follows the storyboard's beat grid, and joined hands are
 * solved with two-bone inverse kinematics each frame, so seeking to any
 * moment reproduces the same picture. Styles: css/song-video-tdd-dancers.css.
 *
 * Rig angles are SVG rotations in degrees: an arm at 0 hangs straight down,
 * +90 points screen-left, -90 screen-right, 180 straight up; the elbow angle
 * is relative to the upper arm. Coordinates are rig-local pixels with the
 * origin between the dancers' feet.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, clamp, beats, hash01 } = window.Timeline;
  const { el, svg, place } = window.SongKit;
  const DEG = Math.PI / 180;
  let uid = 0;

  // ------------------------------------------------------------------
  // Anatomy: where each dancer's joints are (rig-local, feet at y = 0)
  // ------------------------------------------------------------------

  const BODY = {
    test: {
      hipY: -100, shoulder: [23, -168], upper: 36, fore: 33, hip: 9.5, thigh: 48, shin: 46, foot: 12.5,
    },
    code: {
      hipY: -118, shoulder: [17, -165], upper: 33, fore: 31,
    },
  };

  /** Arm poses by name; L and R are screen sides. */
  const POSES = {
    stand: { armL: { sh: 12, el: -8 }, armR: { sh: -12, el: 8 } },
    open: { armL: { sh: 62, el: -14 }, armR: { sh: -62, el: 14 } },
    flourish: { armL: { sh: 128, el: -24 }, armR: { sh: -128, el: 24 } },
    cheer: { armL: { sh: 160, el: -12 }, armR: { sh: -160, el: 12 }, face: 'joy' },
    hips: { armL: { sh: 42, el: 118 }, armR: { sh: -42, el: -118 } },
    offerR: { armL: { sh: 12, el: -8 }, armR: { sh: -76, el: -16 } },
    offerL: { armL: { sh: 76, el: 16 }, armR: { sh: -12, el: 8 } },
    pointR: { armL: { sh: 14, el: -6 }, armR: { sh: -104, el: -4 } },
    pointL: { armL: { sh: 104, el: 4 }, armR: { sh: -14, el: 6 } },
    stopR: { armL: { sh: 14, el: -6 }, armR: { sh: -118, el: -48 }, face: 'focus' },
    stopL: { armL: { sh: 118, el: 48 }, armR: { sh: -14, el: 6 }, face: 'focus' },
    thinkR: { armL: { sh: 30, el: 112 }, armR: { sh: -24, el: -150 }, face: 'focus' },
    shrug: { armL: { sh: 48, el: -96 }, armR: { sh: -48, el: 96 }, face: 'o' },
    bow: { lean: 0, armL: { sh: 8, el: -4 }, armR: { sh: -52, el: -92 } },
    wave: { armL: { sh: 12, el: -8 }, armR: { sh: -140, el: -26 }, face: 'joy' },
  };

  const MOUTHS = {
    happy: 'M-6 0 Q0 5.5 6 0',
    smile: 'M-4.5 0.5 Q0 3.5 4.5 0.5',
    joy: 'M-7 -1 Q0 10 7 -1 Z',
    focus: 'M-4.5 1.5 L4.5 1.5',
    worried: 'M-5 2.5 Q-2.5 0 0 2 Q2.5 4 5 1.5',
    o: 'M0 -2.4 A2.6 3 0 1 1 -0.01 -2.4 Z',
  };

  const BROWS = { happy: 0, smile: 0, joy: -1.5, focus: 2, worried: -3, o: -2.5 };

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------

  const ease = {
    /** Smootherstep: zero velocity and acceleration at both ends. */
    inOut: (p) => p * p * p * (p * (p * 6 - 15) + 10),
    out: (p) => 1 - Math.pow(1 - p, 3),
    back: (p) => 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2),
  };

  const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

  // ------------------------------------------------------------------
  // Rhythm: dance accents land on the take's beats (Timeline.beats follows
  // the storyboard's tempo map). Instant setup keys (dur < 0.1 s) never move.
  // ------------------------------------------------------------------

  /** The beat nearest t. */
  function nearestBeat(t) {
    const { index, phase } = beats.at(t);
    return beats.time(phase < 0.5 ? index : index + 1);
  }

  /** The triplet subdivision (a third of a beat) nearest t. */
  function nearestTriplet(t) {
    const { index, phase, period } = beats.at(t);
    return beats.time(index) + (Math.round(phase * 3) / 3) * period;
  }

  /** The length of the whole number of beats closest to dur, from the beat at t. */
  function wholeBeats(t, dur) {
    const first = beats.index(t + 1e-6);
    const count = Math.max(1, Math.round(dur / beats.at(t).period));
    return beats.time(first + count) - beats.time(first);
  }

  /** Deep merge of a partial state onto a full one (numbers, strings, nested). */
  function merge(base, partial) {
    const out = { ...base };
    for (const [key, value] of Object.entries(partial)) {
      out[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : value;
    }
    return out;
  }

  /** Blends two states: numbers interpolate; anything else switches at once. */
  function mix(a, b, p) {
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * p;
    if (isObject(a) && isObject(b)) {
      const out = {};
      for (const key of Object.keys(b)) out[key] = key in a ? mix(a[key], b[key], p) : b[key];
      return out;
    }
    return b;
  }

  const f = (n) => n.toFixed(2);

  /**
   * A keyed track: add(at, partial, dur, curve) blends each property in
   * `partial` from whatever the track showed at `at` toward its new value.
   * Each property keeps its own keys, so a later key interrupts only the
   * properties it sets: a pose change never freezes a step or a hold that
   * is still under way. The start states are compiled once, so value(t) is
   * a pure function of t.
   */
  function track(initial) {
    const channels = new Map();
    let compiled = null;
    function compile() {
      compiled = new Map();
      for (const [name, keys] of channels) {
        keys.sort((a, b) => a.at - b.at);
        let state = initial[name];
        compiled.set(name, keys.map((key, i) => {
          const start = state;
          const target = isObject(key.value) && isObject(start) ? merge(start, key.value) : key.value;
          const next = keys[i + 1];
          const p = next ? clamp((next.at - key.at) / key.dur, 0, 1) : 1;
          state = mix(start, target, key.curve(p));
          return { ...key, start, target };
        }));
      }
    }
    return {
      add(at, partial, dur = 0.6, curve = ease.inOut) {
        for (const [name, value] of Object.entries(partial)) {
          if (!channels.has(name)) channels.set(name, []);
          channels.get(name).push({ at, value, dur: Math.max(0.01, dur), curve });
        }
        compiled = null;
      },
      value(t) {
        if (!compiled) compile();
        const out = { ...initial };
        for (const [name, keys] of compiled) {
          let current = null;
          for (const key of keys) {
            if (key.at > t) break;
            current = key;
          }
          if (current) out[name] = mix(current.start, current.target, current.curve(clamp((t - current.at) / current.dur, 0, 1)));
        }
        return out;
      },
    };
  }

  /** Two-bone IK: rotations that bring a hand from the shoulder to target. */
  function reach(shoulder, target, upper, fore, bendSign) {
    const dx = target[0] - shoulder[0];
    const dy = target[1] - shoulder[1];
    const d = clamp(Math.hypot(dx, dy), Math.abs(upper - fore) + 1, upper + fore - 0.5);
    const toTarget = Math.atan2(dy, dx);
    const atShoulder = Math.acos(clamp((upper * upper + d * d - fore * fore) / (2 * upper * d), -1, 1));
    const atElbow = Math.acos(clamp((upper * upper + fore * fore - d * d) / (2 * upper * fore), -1, 1));
    const dir = toTarget + bendSign * atShoulder;
    return { sh: dir / DEG - 90, el: -bendSign * (180 - atElbow / DEG) };
  }

  function rotateAbout([x, y], [cx, cy], deg) {
    const a = deg * DEG;
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
  }

  // ------------------------------------------------------------------
  // Shared parts: arms, gloves, faces
  // ------------------------------------------------------------------

  /**
   * A limb segment along +y: width w0 at the joint (y = 0), tapering to w1
   * at `len`, with rounded ends so segments overlap cleanly at the joints.
   */
  function segmentPath(len, w0, w1) {
    const a = w0 / 2;
    const b = w1 / 2;
    return `M${f(-a)} 0 C${f(-a)} ${f(len * 0.4)} ${f(-b * 1.08)} ${f(len * 0.72)} ${f(-b)} ${f(len)}`
      + ` A${f(b)} ${f(b)} 0 0 0 ${f(b)} ${f(len)} C${f(b * 1.08)} ${f(len * 0.72)} ${f(a)} ${f(len * 0.4)} ${f(a)} 0`
      + ` A${f(a)} ${f(a)} 0 0 0 ${f(-a)} 0 Z`;
  }

  /** A cartoon glove pointing along +y from the wrist, thumb toward the body. */
  function glove(parent, side, size) {
    const mirror = side === 'R' ? -1 : 1;
    const g = svg('g', { class: 'tdd-glove-hand', transform: `scale(${mirror * size} ${size})` }, parent);
    svg('path', { class: 'tdd-glove', d: 'M4.2 2.4 C7.9 1.4 10 4 9 6.5 C8.2 8.3 6.2 8 5.2 6.8 Z' }, g);
    svg('path', { class: 'tdd-glove', d: 'M-4.8 0.4 C-7.2 4.6 -6.9 10.8 -2.5 13 C0.6 14.4 4.8 12.8 6 8.8 C6.8 5.8 5.8 2.4 4.6 0.4 Z' }, g);
    svg('path', { class: 'tdd-glove-line', d: 'M-1.8 8.4 L-1.4 11.8 M1.4 8.6 L1.8 12' }, g);
    svg('rect', { class: 'tdd-glove-cuff', x: -5.6, y: -2.4, width: 11.2, height: 3.8, rx: 1.9 }, g);
    return g;
  }

  /** Limb widths: [shoulder, elbow] for the upper arm, [elbow, wrist] below. */
  const ARM_WIDTHS = { test: [[13.5, 10.5], [10.5, 8.5]], code: [[9, 7.2], [7.2, 5.6]] };

  function arm(parent, kind, side, body, id) {
    const [sx, sy] = body.shoulder;
    const [upperW, foreW] = ARM_WIDTHS[kind];
    const upperArm = svg('g', { class: `tdd-arm tdd-arm--${kind}` }, parent);
    upperArm.dataset.side = side;
    const outer = side === 'L' ? -1 : 1;
    svg('path', { class: 'tdd-arm-sleeve', d: segmentPath(body.upper, ...upperW) }, upperArm);
    svg('path', { class: 'tdd-arm-shine', d: `M${f(outer * (upperW[0] / 2 - 2))} 4 Q${f(outer * (upperW[1] / 2 - 1))} ${f(body.upper * 0.55)} ${f(outer * (upperW[1] / 2 - 2))} ${f(body.upper - 4)}` }, upperArm);
    const foreArm = svg('g', {}, upperArm);
    svg('path', { class: 'tdd-arm-fore', d: segmentPath(body.fore, ...foreW) }, foreArm);
    if (kind === 'test') svg('rect', { class: 'tdd-cuff', x: -5.6, y: body.fore - 6, width: 11.2, height: 5, rx: 2 }, foreArm);
    const hand = svg('g', { transform: `translate(0 ${body.fore + 1})` }, foreArm);
    glove(hand, side, kind === 'test' ? 0.92 : 0.8);
    // Code's puffed cap sleeve sits on top of the shoulder and turns with it.
    if (kind === 'code') svg('path', { class: 'tdd-sleeve-puff', fill: `url(#${id}-gown)`, d: 'M-7.5 3 C-8.5 -5.5 8.5 -5.5 7.5 3 C6.4 9.5 -6.4 9.5 -7.5 3 Z' }, upperArm);
    return {
      apply(angles) {
        const x = side === 'L' ? -sx : sx;
        upperArm.setAttribute('transform', `translate(${x} ${sy}) rotate(${f(angles.sh)})`);
        foreArm.setAttribute('transform', `translate(0 ${body.upper}) rotate(${f(angles.el)})`);
      },
    };
  }

  /** Eyes (with a blink), brows, and an expression mouth around (0, 0). */
  function face(parent, { eyeY, eyeX, mouthY, browY, lashes = false, seed }) {
    const node = svg('g', { class: 'tdd-face' }, parent);
    const eyes = [-eyeX, eyeX].map((x) => {
      const eye = svg('g', { transform: `translate(${x} ${eyeY})` }, node);
      const ball = svg('g', {}, eye);
      svg('ellipse', { class: 'tdd-eye', rx: 3.4, ry: 4.4 }, ball);
      svg('circle', { class: 'tdd-eye-glint', cx: 1.1, cy: -1.5, r: 1.15 }, ball);
      if (lashes) svg('path', { class: 'tdd-lash', d: x < 0 ? 'M-3.4 -3 L-6 -5.4' : 'M3.4 -3 L6 -5.4' }, eye);
      return ball;
    });
    const brows = [-eyeX, eyeX].map((x) => svg('path', { class: 'tdd-brow', d: `M${x - 4} ${browY} Q${x} ${browY - 2.5} ${x + 4} ${browY}` }, node));
    const mouth = svg('path', { class: 'tdd-mouth', transform: `translate(0 ${mouthY})` }, node);
    const blinkAt = 1.3 + hash01(seed) * 2.4;
    return {
      apply(t, expression, look) {
        const lookX = look * 2.4;
        const phase = (t + blinkAt) % 4.3;
        const open = phase < 0.13 ? 0.12 : 1;
        eyes.forEach((ball) => ball.setAttribute('transform', `translate(${f(lookX)} 0) scale(1 ${open})`));
        const lift = BROWS[expression] ?? 0;
        brows.forEach((brow, i) => brow.setAttribute('transform', `translate(${f(lookX)} ${lift}) rotate(${(i ? -1 : 1) * (expression === 'worried' ? -8 : expression === 'focus' ? 8 : 0)} ${i ? eyeX : -eyeX} ${browY})`));
        mouth.setAttribute('d', MOUTHS[expression] || MOUTHS.happy);
        mouth.setAttribute('transform', `translate(${f(lookX * 0.8)} ${mouthY})`);
        mouth.classList.toggle('is-open', expression === 'joy' || expression === 'o');
      },
    };
  }

  // ------------------------------------------------------------------
  // Test: tailcoat, trousers, and a glass status lamp for a head
  // ------------------------------------------------------------------

  function buildTest(parent, id) {
    const body = BODY.test;
    const root = svg('g', { class: 'tdd-dancer tdd-dancer--test' }, parent);
    const shadow = svg('ellipse', { class: 'tdd-shadow', cx: 0, cy: 0, rx: 34, ry: 6 }, root);
    const halo = svg('circle', { class: 'tdd-lamp-halo', cx: 0, cy: -214, r: 46 }, root);
    const spin = svg('g', {}, root);
    // Back to front: the coat tails (behind the legs), the legs on the
    // floor, then everything above the hips on `upper`, so a waltz's rise
    // and fall bends the knees instead of lifting the feet.
    const back = svg('g', {}, spin);
    svg('path', { class: 'tdd-coat-tail', d: 'M-18 -114 C-21 -92 -26 -72 -24 -48 C-20 -50 -15 -54 -12 -58 C-10 -78 -8 -96 -6 -108 Z M18 -114 C21 -92 26 -72 24 -48 C20 -50 15 -54 12 -58 C10 -78 8 -96 6 -108 Z' }, back);
    const legs = ['L', 'R'].map((side) => {
      const leg = svg('g', { class: 'tdd-leg' }, spin);
      const thigh = svg('path', { class: 'tdd-trouser' }, leg);
      const stripe = svg('path', { class: 'tdd-trouser-stripe' }, leg);
      // A patent oxford: heel under the ankle, toe turned a little outward.
      const shoe = svg('g', {}, leg);
      const shape = svg('g', { transform: `scale(${side === 'L' ? -1 : 1} 1)` }, shoe);
      svg('path', { class: 'tdd-shoe', d: 'M-6.5 -2 C-7.5 -8 -2 -10.5 3 -9.5 C8 -9 12.5 -7 13 -3.2 C13.4 0 10.5 1.2 6.5 1.2 L-4.2 1.2 C-6.4 1.2 -6.9 0 -6.5 -2 Z' }, shape);
      svg('path', { class: 'tdd-shoe-sole', d: 'M-6.2 0.2 L12.6 -0.6' }, shape);
      svg('path', { class: 'tdd-shoe-shine', d: 'M2 -7.6 Q6 -7.8 9.5 -5.6' }, shape);
      return { side, thigh, stripe, shoe };
    });
    const upper = svg('g', {}, spin);
    const lean = svg('g', {}, upper);
    // Torso: tailcoat front over a white shirt, gold lapels, bow tie.
    const torso = svg('g', {}, lean);
    svg('path', { class: 'tdd-coat', d: 'M-27 -168 C-29 -175 -22 -178.5 -12 -178.5 L12 -178.5 C22 -178.5 29 -175 27 -168 C29.5 -152 25 -134 20.5 -122 C19.5 -114 20.5 -106 20 -100 Q0 -95 -20 -100 C-20.5 -106 -19.5 -114 -20.5 -122 C-25 -134 -29.5 -152 -27 -168 Z' }, torso);
    svg('path', { class: 'tdd-coat-shade', d: 'M6 -178.5 L12 -178.5 C22 -178.5 29 -175 27 -168 C29.5 -152 25 -134 20.5 -122 C19.5 -114 20.5 -106 20 -100 Q13 -97.5 6 -97 Z' }, torso);
    svg('path', { class: 'tdd-coat-seam', d: 'M-20.5 -122 Q0 -117 20.5 -122' }, torso);
    svg('path', { class: 'tdd-shirt', d: 'M-11 -177 L0 -128 L11 -177 Q0 -180 -11 -177 Z' }, torso);
    svg('path', { class: 'tdd-lapel', d: 'M-11 -177 L-2 -132 L-16 -156 L-12 -162 L-19 -170 Z' }, torso);
    svg('path', { class: 'tdd-lapel tdd-lapel--shade', d: 'M11 -177 L2 -132 L16 -156 L12 -162 L19 -170 Z' }, torso);
    for (const y of [-124, -114]) svg('circle', { class: 'tdd-button', cx: 0, cy: y, r: 1.9 }, torso);
    svg('path', { class: 'tdd-bowtie', d: 'M0 -175 L-10 -181 L-10 -168 Z M0 -175 L10 -181 L10 -168 Z' }, torso);
    svg('rect', { class: 'tdd-bowtie-knot', x: -3, y: -178, width: 6, height: 6, rx: 1.5 }, torso);
    const badge = svg('g', { class: 'tdd-badge', transform: 'translate(14 -146)' }, torso);
    svg('circle', { class: 'tdd-badge-disc', r: 7.5 }, badge);
    const badgeGlyph = svg('path', { class: 'tdd-badge-glyph' }, badge);
    // The lamp head: a brass socket and a glass dome with a face on it.
    const head = svg('g', {}, lean);
    svg('rect', { class: 'tdd-socket', x: -11, y: -193, width: 22, height: 14, rx: 3 }, head);
    for (const y of [-190, -186, -182]) svg('line', { class: 'tdd-socket-ridge', x1: -10, y1: y, x2: 10, y2: y }, head);
    const dome = svg('g', { class: 'tdd-lamp' }, head);
    const glass = svg('circle', { class: 'tdd-lamp-glass', cx: 0, cy: -214, r: 26 }, dome);
    svg('path', { class: 'tdd-lamp-rim', d: 'M-20 -197 Q0 -188 20 -197' }, dome);
    svg('path', { class: 'tdd-lamp-shine', d: 'M-15 -229 Q-9 -236 0 -237' }, dome);
    const faceGroup = svg('g', { transform: 'translate(0 -210)' }, dome);
    const faceRig = face(faceGroup, { eyeX: 8, eyeY: -5, mouthY: 7, browY: -12, seed: uid * 7 + 11 });
    const arms = { L: arm(lean, 'test', 'L', body, id), R: arm(lean, 'test', 'R', body, id) };

    /**
     * A tapered trouser leg from hip to ankle, and its side stripe. Seen from
     * the front, a bent knee comes toward the viewer, so the leg mostly
     * shortens: the knee leaves the hip–ankle line by only a third of what a
     * side view would show.
     */
    function legShape(hip, foot, bend) {
      const ankle = [foot[0], foot[1] - 3];
      const dx = ankle[0] - hip[0];
      const dy = ankle[1] - hip[1];
      const len = Math.hypot(dx, dy);
      const d = clamp(len, 20, body.thigh + body.shin - 0.5);
      const along = body.thigh / (body.thigh + body.shin);
      const a = Math.acos(clamp((body.thigh ** 2 + d * d - body.shin ** 2) / (2 * body.thigh * d), -1, 1));
      const out = body.thigh * Math.sin(a) * 0.32;
      const knee = [hip[0] + dx * along - (dy / len) * out * bend, hip[1] + dy * along + (dx / len) * out * bend];
      const normal = (p, q) => {
        const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
        return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l];
      };
      const n0 = normal(hip, knee);
      const n2 = normal(knee, ankle);
      const nk = [(n0[0] + n2[0]) / 2, (n0[1] + n2[1]) / 2];
      const side = (p, n, w, k) => [p[0] + n[0] * w * k, p[1] + n[1] * w * k];
      const [wHip, wKnee, wAnkle] = [17, 13.5, 11.5];
      const l0 = side(hip, n0, wHip / 2, 1);
      const l1 = side(knee, nk, wKnee / 2, 1);
      const l2 = side(ankle, n2, wAnkle / 2, 1);
      const r0 = side(hip, n0, wHip / 2, -1);
      const r1 = side(knee, nk, wKnee / 2, -1);
      const r2 = side(ankle, n2, wAnkle / 2, -1);
      const pt = (p) => `${f(p[0])} ${f(p[1])}`;
      const outline = `M${pt(l0)} Q${pt(l1)} ${pt(l2)} L${pt(r2)} Q${pt(r1)} ${pt(r0)} Z`;
      const k = -bend * 0.62;
      const stripe = `M${pt(side(hip, n0, wHip / 2, k))} Q${pt(side(knee, nk, wKnee / 2, k))} ${pt(side(ankle, n2, wAnkle / 2, k))}`;
      return { outline, stripe };
    }

    return {
      body,
      root,
      apply(t, s) {
        root.setAttribute('transform', `translate(${f(s.x)} ${f(s.y)})`);
        shadow.setAttribute('rx', f(34 + s.bob * 0.4));
        spin.setAttribute('transform', `scale(${f(s.spin)} 1)`);
        upper.setAttribute('transform', `translate(0 ${f(s.bob)})`);
        lean.setAttribute('transform', `rotate(${f(s.lean)} 0 ${body.hipY})`);
        back.setAttribute('transform', `translate(0 ${f(s.bob)}) rotate(${f(s.lean)} 0 ${body.hipY})`);
        for (const leg of legs) {
          const sign = leg.side === 'L' ? -1 : 1;
          const foot = s[`foot${leg.side}`];
          const hip = rotateAbout([sign * body.hip, body.hipY + s.bob], [0, body.hipY + s.bob], s.lean * 0.35);
          const tip = [sign * body.foot + foot.dx, -8 - foot.lift];
          const { outline, stripe } = legShape(hip, tip, sign);
          leg.thigh.setAttribute('d', outline);
          leg.stripe.setAttribute('d', stripe);
          leg.shoe.setAttribute('transform', `translate(${f(sign * body.foot + foot.dx)} ${f(-foot.lift)}) rotate(${f(-sign * foot.lift * 1.6)})`);
        }
        head.setAttribute('transform', `rotate(${f(s.head)} 0 -188)`);
        arms.L.apply(s.armL);
        arms.R.apply(s.armR);
        faceRig.apply(t, s.face, s.look);
        root.dataset.lamp = s.lamp;
        badgeGlyph.setAttribute('d', s.lamp === 'red' ? 'M-3.4 -3.4 L3.4 3.4 M3.4 -3.4 L-3.4 3.4' : s.lamp === 'green' ? 'M-3.8 0.2 L-1.1 3 L4 -3.2' : '');
        glass.setAttribute('fill', `url(#${id}-glass-${s.lamp})`);
        halo.setAttribute('fill', `url(#${id}-halo-${s.lamp})`);
        const pulse = beats.pulse(t, 0.3);
        halo.setAttribute('opacity', f(s.lamp === 'idle' ? 0.35 + 0.1 * pulse : 0.7 + 0.15 * pulse));
        halo.setAttribute('transform', `translate(${f(s.head * 0.9)} ${f(s.bob)})`);
      },
    };
  }

  // ------------------------------------------------------------------
  // Code: a document head with brace clips, and a gown of code lines
  // ------------------------------------------------------------------

  /** Rows of the gown's code: indent level and bar widths (a tiny program). */
  const CODE_ROWS = [
    { indent: 0, bars: [[14, 'kw'], [26, 'fn']] },
    { indent: 1, bars: [[12, 'kw'], [22, 'fn'], [10, 'id']] },
    { indent: 2, bars: [[18, 'id'], [8, 'op'], [14, 'lit']] },
    { indent: 2, bars: [[12, 'kw'], [24, 'id']] },
    { indent: 1, bars: [[12, 'kw'], [20, 'fn']] },
    { indent: 2, bars: [[16, 'id'], [18, 'fn']] },
    { indent: 2, bars: [[14, 'kw'], [8, 'lit']] },
    { indent: 1, bars: [[22, 'cm']] },
  ];

  function buildCode(parent, id) {
    const body = BODY.code;
    const root = svg('g', { class: 'tdd-dancer tdd-dancer--code' }, parent);
    const shadow = svg('ellipse', { class: 'tdd-shadow', cx: 0, cy: 0, rx: 46, ry: 6.5 }, root);
    const spin = svg('g', {}, root);
    const shoes = svg('g', {}, spin);
    svg('ellipse', { class: 'tdd-slipper', cx: -11, cy: -3, rx: 8, ry: 4 }, shoes);
    svg('ellipse', { class: 'tdd-slipper', cx: 11, cy: -3, rx: 8, ry: 4 }, shoes);
    const skirtClip = svg('clipPath', { id: `${id}-skirt` }, svg('defs', {}, spin));
    const clipShape = svg('path', {}, skirtClip);
    const skirt = svg('path', { class: 'tdd-gown', fill: `url(#${id}-gown)` }, spin);
    const skirtShade = svg('path', { class: 'tdd-gown-fold' }, spin);
    const page = svg('g', { 'clip-path': `url(#${id}-skirt)` }, spin);
    const rows = CODE_ROWS.map((row, i) => {
      const y = -106 + i * 11.5;
      const group = svg('g', {}, page);
      let x = 0;
      const bars = row.bars.map(([w, tone]) => {
        const bar = svg('rect', { class: `tdd-code-bar tdd-code-bar--${tone}`, x, y: -2.6, width: w, height: 5.2, rx: 2.6 }, group);
        x += w + 4;
        return bar;
      });
      // Messy: each row drifts by its own seeded offset and tilt.
      const jitter = (hash01(i * 17 + 3) - 0.5) * 22;
      const tilt = (hash01(i * 29 + 5) - 0.5) * 10;
      return { group, y, indent: row.indent, bars, jitter, tilt };
    });
    const hem = svg('path', { class: 'tdd-gown-hem' }, spin);
    // The hem stays on the floor; the waist and everything above it ride on
    // `upper`, so the gown stretches and gathers with the rise and fall.
    const upper = svg('g', {}, spin);
    const lean = svg('g', {}, upper);
    // Bodice, sash, and the paper-white neck.
    svg('path', { class: 'tdd-bodice', fill: `url(#${id}-gown)`, d: 'M-18.5 -166 C-19.5 -171 -12 -172 -8 -170 Q0 -166 8 -170 C12 -172 19.5 -171 18.5 -166 C20 -150 15 -134 11.5 -118 L-11.5 -118 C-15 -134 -20 -150 -18.5 -166 Z' }, lean);
    svg('path', { class: 'tdd-bodice-seam', d: 'M-6 -160 Q-4 -138 -3 -120 M6 -160 Q4 -138 3 -120' }, lean);
    svg('path', { class: 'tdd-neckline', d: 'M-13 -169 Q-6 -158 0 -165 Q6 -158 13 -169' }, lean);
    svg('rect', { class: 'tdd-sash', x: -14, y: -123, width: 28, height: 8, rx: 3 }, lean);
    svg('path', { class: 'tdd-sash-bow', d: 'M9 -119 L19 -126 L18 -112 Z' }, lean);
    svg('path', { class: 'tdd-paper', d: 'M-3 -181 L3 -181 L4.2 -168.5 Q0 -166.5 -4.2 -168.5 Z' }, lean);
    // The head: a page with a folded corner, a face, and brace clips.
    const head = svg('g', {}, lean);
    svg('path', { class: 'tdd-page', fill: `url(#${id}-page)`, d: 'M-21 -231 H10 L22 -219 V-184 Q22 -178 16 -178 H-15 Q-21 -178 -21 -184 Z' }, head);
    svg('path', { class: 'tdd-page-fold', d: 'M10 -231 V-222 Q10 -219 13 -219 H22 Z' }, head);
    svg('line', { class: 'tdd-page-rule', x1: -15, y1: -224, x2: 2, y2: -224 }, head);
    for (const side of [-1, 1]) {
      svg('circle', { class: 'tdd-blush', cx: side * 12, cy: -195, r: 3.4 }, head);
      svg('path', {
        class: 'tdd-brace',
        d: side < 0
          ? 'M-26 -222 Q-31 -222 -31 -216 V-210 Q-31 -205 -35 -205 Q-31 -205 -31 -200 V-194 Q-31 -188 -26 -188'
          : 'M26 -222 Q31 -222 31 -216 V-210 Q31 -205 35 -205 Q31 -205 31 -200 V-194 Q31 -188 26 -188',
      }, head);
    }
    const faceGroup = svg('g', { transform: 'translate(0 -202)' }, head);
    const faceRig = face(faceGroup, { eyeX: 8, eyeY: -2, mouthY: 9, browY: -9, lashes: true, seed: uid * 7 + 23 });
    const arms = { L: arm(lean, 'code', 'L', body, id), R: arm(lean, 'code', 'R', body, id) };

    /** The gown from the waist (which rises and falls at waistY) to a scalloped hem on the floor. */
    function skirtPath(sway, flare, waistY) {
      const hw = 54 + flare;
      const sx = sway * 9;
      const waves = 5;
      let d = `M-11.5 ${f(waistY)} C-22 -82 ${f(-hw * 0.82 + sx * 0.5)} -40 ${f(-hw + sx)} -8`;
      for (let i = 0; i < waves; i++) {
        const x0 = -hw + sx + ((2 * hw) / waves) * i;
        const x1 = x0 + (2 * hw) / waves;
        d += ` Q${f((x0 + x1) / 2)} ${f(i % 2 ? -14 : -2)} ${f(x1)} -8`;
      }
      d += ` C${f(hw * 0.82 + sx * 0.5)} -40 22 -82 11.5 ${f(waistY)} Z`;
      return d;
    }

    return {
      body,
      root,
      apply(t, s) {
        root.setAttribute('transform', `translate(${f(s.x)} ${f(s.y)})`);
        shadow.setAttribute('rx', f(46 + s.flare * 0.5 + s.bob * 0.4));
        spin.setAttribute('transform', `scale(${f(s.spin)} 1)`);
        upper.setAttribute('transform', `translate(0 ${f(s.bob)})`);
        lean.setAttribute('transform', `rotate(${f(s.lean)} 0 ${body.hipY})`);
        const waistY = body.hipY + 2 + s.bob;
        const d = skirtPath(s.sway, s.flare, waistY);
        skirt.setAttribute('d', d);
        clipShape.setAttribute('d', d);
        hem.setAttribute('d', d);
        skirtShade.setAttribute('d', `M2 ${f(waistY)} C10 -80 ${f(30 + s.sway * 6)} -40 ${f(44 + s.sway * 9 + s.flare)} -10 L${f(20 + s.sway * 6)} -8 C16 -40 8 -80 2 ${f(waistY)} Z`);
        const clean = clamp(s.clean, 0, 1);
        for (const row of rows) {
          const halfWidth = 12 + ((row.y - body.hipY) / (-8 - body.hipY)) * (40 + s.flare * 0.8);
          const tidyX = -halfWidth + 7 + row.indent * 8 + s.sway * 9 * ((row.y - body.hipY) / 110);
          const x = tidyX + (1 - clean) * row.jitter;
          const tilt = (1 - clean) * row.tilt;
          const down = (row.y - body.hipY) / (-8 - body.hipY);
          row.group.setAttribute('transform', `translate(${f(x)} ${f(row.y + s.bob * (1 - down))}) rotate(${f(tilt)})`);
        }
        page.classList.toggle('is-messy', clean < 0.5);
        head.setAttribute('transform', `rotate(${f(s.head)} 0 -176)`);
        arms.L.apply(s.armL);
        arms.R.apply(s.armR);
        faceRig.apply(t, s.face, s.look);
      },
    };
  }

  /**
   * Gradients for one troupe's SVG, namespaced so troupes never share ids.
   * Stop colours live in css/song-video-tdd-dancers.css, keyed by class.
   */
  function defs(art, id) {
    const node = svg('defs', {}, art);
    const stops = (gradient, names) => names.forEach((name, i) => svg('stop', { class: `tdd-stop--${name}`, offset: i / (names.length - 1) }, gradient));
    for (const status of ['idle', 'red', 'green']) {
      stops(svg('radialGradient', { id: `${id}-glass-${status}`, class: `tdd-glass tdd-glass--${status}`, cx: 0.4, cy: 0.35, r: 0.75 }, node), ['core', 'mid', 'edge']);
      stops(svg('radialGradient', { id: `${id}-halo-${status}`, class: `tdd-halo tdd-halo--${status}` }, node), ['core', 'edge']);
    }
    stops(svg('linearGradient', { id: `${id}-gown`, class: 'tdd-gown-grad', x1: 0, y1: 0, x2: 0.35, y2: 1 }, node), ['top', 'bottom']);
    stops(svg('linearGradient', { id: `${id}-page`, class: 'tdd-page-grad', x1: 0, y1: 0, x2: 0.4, y2: 1 }, node), ['top', 'bottom']);
  }

  // ------------------------------------------------------------------
  // Troupe: one or both dancers in one rig, with joined hands
  // ------------------------------------------------------------------

  const NEUTRAL = {
    x: 0, y: 0, bob: 0, lean: 0, head: 0, spin: 1, look: 0, face: 'happy', lamp: 'idle',
    armL: { ...POSES.stand.armL }, armR: { ...POSES.stand.armR },
    footL: { dx: 0, lift: 0 }, footR: { dx: 0, lift: 0 },
    sway: 0, flare: 0, clean: 1, hold: 0,
  };

  /**
   * troupe(parent, { x, y, scale, at, until, members }) draws the dancers
   * in `members` (['test', 'code'] by default; test stands left). Returns
   * { node, test, code, move, waltz, hold, twirl, … }: every method keys
   * motion at song times; none of them starts a clock.
   */
  function troupe(parent, { x, y, scale = 1, at, until, members = ['test', 'code'], gap = 56 }) {
    const id = `tdd-troupe-${++uid}`;
    const W = 420;
    const H = 300;
    const wrap = place(el('div', 'tdd-troupe is-staged', parent), x - (W / 2) * scale, y - (H - 20) * scale);
    wrap.style.width = `${W * scale}px`;
    wrap.style.height = `${H * scale}px`;
    const art = svg('svg', { class: 'tdd-troupe-art', viewBox: `${-W / 2} ${-(H - 20)} ${W} ${H}`, width: W * scale, height: H * scale, 'aria-hidden': 'true' }, wrap);
    defs(art, id);
    // The floor group moves and scales the troupe (scaling about the feet
    // reads as a step toward or away from the viewer).
    const floor = svg('g', {}, art);
    const stagePos = track({ x: 0, y: 0 });
    const dancers = {};
    members.forEach((kind) => {
      const offset = members.length === 2 ? (kind === 'test' ? -gap : gap) : 0;
      const rig = (kind === 'test' ? buildTest : buildCode)(floor, id);
      const state = track(merge(NEUTRAL, { x: offset, look: members.length === 2 ? (kind === 'test' ? 1 : -1) : 0 }));
      dancers[kind] = { kind, rig, state, home: offset };
    });
    const waltzes = [];
    const twirls = [];

    function poseOf(name) {
      const pose = POSES[name];
      if (!pose) throw new Error(`tdd-dancers.js has no pose "${name}".`);
      return pose;
    }

    const smooth = (p) => ease.inOut(clamp(p, 0, 1));
    /** Rise and fall within a measure: lowest on the downbeat, highest near "3". */
    const RISE_PEAK = 0.62;
    function riseOf(phase) {
      const g = phase < RISE_PEAK ? 0.5 * (phase / RISE_PEAK) : 0.5 + 0.5 * ((phase - RISE_PEAK) / (1 - RISE_PEAK));
      return (1 - Math.cos(2 * Math.PI * g)) / 2;
    }

    /**
     * The couple's shared waltz at time t, or null. Each dotted-quarter beat
     * of the take is one measure (Viennese-waltz tempo): weight glides onto
     * the new foot on "1–2" and the other foot closes on "3"; the body sinks
     * on the downbeat and rises through the measure; the frame sways over
     * two measures; and the box step travels side to side and, every two
     * measures, slightly toward and away from the viewer.
     */
    function waltzAt(t) {
      const active = waltzes.find((w) => t >= w.from && t < w.to);
      if (!active) return null;
      const fade = smooth((t - active.from) / 0.6) * smooth((active.to - t) / 0.6);
      const { index, phase } = beats.at(t);
      const dir = index % 2 === 0 ? 1 : -1;
      const travel = active.travel;
      const glide = smooth(phase / 0.7);
      const swing = Math.PI * (index + phase);
      return {
        fade, index, phase, dir, travel,
        rise: riseOf(phase),
        x: travel * dir * (2 * glide - 1),
        lead: { from: -travel * dir, to: travel * dir, at: smooth(phase / 0.42), lift: Math.sin(Math.PI * clamp(phase / 0.42, 0, 1)) },
        trail: { from: -travel * dir, to: travel * dir, at: smooth((phase - 0.55) / 0.35), lift: Math.sin(Math.PI * clamp((phase - 0.55) / 0.35, 0, 1)) },
        sway: Math.sin(swing),
        lag: (delay) => Math.sin(swing - delay),
        depth: 1 + 0.022 * Math.sin((Math.PI / 2) * (index + phase)),
      };
    }

    /** Footwork while a dancer travels outside a waltz: one step per stride. */
    const STRIDE = 26;
    function walkOf(dancer, t) {
      const xAt = (time) => dancer.state.value(time).x + stagePos.value(time).x;
      const x = xAt(t);
      const speed = Math.abs(x - xAt(t - 0.1)) / 0.1;
      const amount = smooth((speed - 6) / 50);
      if (amount <= 0) return null;
      const cycle = Math.sin((Math.PI * x) / STRIDE);
      return {
        amount,
        liftL: Math.max(0, cycle) * 7 * amount,
        liftR: Math.max(0, -cycle) * 7 * amount,
        dip: Math.abs(cycle) * 2.5 * amount,
        velocity: (x - xAt(t - 0.2)) / 0.2,
      };
    }

    function stateOf(dancer, t, couple, w) {
      const isTest = dancer.kind === 'test';
      let s = dancer.state.value(t);
      // Follow-through: forearms and the head trail the body's keyed motion.
      const lagged = dancer.state.value(t - 0.08);
      s = {
        ...s,
        armL: { ...s.armL, el: lagged.armL.el },
        armR: { ...s.armR, el: lagged.armR.el },
        head: dancer.state.value(t - 0.05).head,
      };
      // Alive at rest, in time: a soft settle on every beat and a weight
      // shift that sways the couple together over two beats.
      const pulse = beats.at(t);
      s.bob += 0.9 * Math.cos(2 * Math.PI * pulse.phase);
      s.lean += 0.8 * Math.sin(Math.PI * (pulse.index + pulse.phase));
      const outer = isTest ? 'armL' : 'armR';
      const outerSign = isTest ? 1 : -1;
      if (w) {
        const e = w.fade;
        s.bob += (4 - 7 * w.rise) * e;
        s.lean += 3.2 * w.sway * e;
        s.x += w.x * e;
        s.head += (isTest ? 2.5 * w.lag(0.3) : -2 + 3 * w.lag(0.45)) * e;
        // The free arms float on the beat, the forearm a little behind.
        s[outer] = { sh: s[outer].sh + outerSign * 7 * w.lag(0.5) * e, el: s[outer].el + outerSign * 9 * w.lag(1.1) * e };
        if (isTest) {
          // Planted feet: the leading foot glides to the new spot on "1–2";
          // the other closes on "3". Feet stay put while the body travels.
          const leadSide = w.dir > 0 ? 'R' : 'L';
          const trailSide = w.dir > 0 ? 'L' : 'R';
          const leadX = w.lead.from + (w.lead.to - w.lead.from) * w.lead.at;
          const trailX = w.trail.from + (w.trail.to - w.trail.from) * w.trail.at;
          const heel = 2.5 * w.rise;
          const lead = s[`foot${leadSide}`];
          const trail = s[`foot${trailSide}`];
          s[`foot${leadSide}`] = { dx: lead.dx + (leadX - w.x) * e, lift: lead.lift + (5 * w.lead.lift + heel) * e };
          s[`foot${trailSide}`] = { dx: trail.dx + (trailX - w.x) * e, lift: trail.lift + (3 * w.trail.lift + heel) * e };
        } else {
          // The gown trails the travel and sways with the frame.
          s.sway += (0.55 * w.lag(0.9) - 0.04 * w.travel * w.dir * Math.sin(Math.PI * w.phase)) * e;
          s.flare += 3 * w.rise * e;
        }
      } else {
        const walk = walkOf(dancer, t);
        if (walk) {
          s.bob += walk.dip;
          if (isTest) {
            s.footL = { ...s.footL, lift: s.footL.lift + walk.liftL };
            s.footR = { ...s.footR, lift: s.footR.lift + walk.liftR };
          } else {
            s.sway += clamp(-walk.velocity / 140, -0.9, 0.9) * walk.amount;
          }
        }
      }
      for (const twirl of twirls) {
        if (dancer.kind !== twirl.who || t < twirl.at || t > twirl.at + twirl.dur) continue;
        const p = (t - twirl.at) / twirl.dur;
        const lift = Math.sin(Math.PI * p);
        // Turning: the figure narrows to a profile (never a paper-thin line)
        // and widens again, while the gown flares and the body rises.
        const c = Math.cos(2 * Math.PI * twirl.turns * ease.inOut(p));
        s.spin = Math.sign(c || 1) * Math.max(0.24, Math.abs(c));
        s.flare += 20 * lift;
        s.bob -= 4 * lift;
        s.head -= 6 * lift;
        s.hold = 0;
        if (twirl.who === 'code') s.armL = mix(s.armL, { sh: 162, el: -12 }, smooth(p / 0.2) * smooth((1 - p) / 0.2));
      }
      if (couple && s.hold > 0) {
        const target = couple.handAt;
        const body = dancer.rig.body;
        const side = isTest ? 'R' : 'L';
        const sign = side === 'L' ? -1 : 1;
        // Target in this dancer's un-leaned body coordinates.
        const local = rotateAbout([target[0] - s.x, target[1] - s.y - s.bob], [0, body.hipY], -s.lean);
        const shoulder = [sign * body.shoulder[0], body.shoulder[1]];
        const solved = reach(shoulder, local, body.upper, body.fore, side === 'R' ? 1 : -1);
        const key = `arm${side}`;
        s[key] = mix(s[key], solved, s.hold);
      }
      return s;
    }

    onFrame((t) => {
      if (t < at - 0.5 || (until !== undefined && t > until + 0.5)) return;
      const pos = stagePos.value(t);
      const w = waltzAt(t);
      const depth = w ? 1 + (w.depth - 1) * w.fade : 1;
      floor.setAttribute('transform', `translate(${f(pos.x)} ${f(pos.y)}) scale(${depth.toFixed(4)})`);
      const raw = {};
      for (const dancer of Object.values(dancers)) raw[dancer.kind] = stateOf(dancer, t, null, w);
      let couple = null;
      if (dancers.test && dancers.code) {
        // Inner hands meet a little below and between the inner shoulders.
        const shoulderOf = (kind, s) => {
          const body = dancers[kind].rig.body;
          const sign = kind === 'test' ? 1 : -1;
          const p = rotateAbout([sign * body.shoulder[0], body.shoulder[1]], [0, body.hipY], s.lean);
          return [s.x + p[0] * s.spin, s.y + s.bob + p[1]];
        };
        const a = shoulderOf('test', raw.test);
        const b = shoulderOf('code', raw.code);
        couple = { handAt: [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 30] };
      }
      for (const dancer of Object.values(dancers)) dancer.rig.apply(t, stateOf(dancer, t, couple, w));
    });

    fx.fadeIn(wrap, at, 0.35);
    if (until !== undefined) fx.fadeOut(wrap, until, 0.35);

    /** The start time that makes a dur-long motion arrive on the beat nearest atTime + dur. */
    function arrivingOnBeat(atTime, dur) {
      return dur < 0.1 ? atTime : nearestBeat(atTime + dur) - dur;
    }

    function keyAll(atTime, partialFor, dur, curve) {
      for (const dancer of Object.values(dancers)) dancer.state.add(atTime, partialFor(dancer), dur, curve);
    }

    const api = {
      node: wrap,
      /**
       * Stage-pixel offset from the troupe's x to the middle of the couple's
       * footprint (Test's shoes on the left, Code's hem on the right), so a
       * caller can centre the couple on a floor mark.
       */
      footprintCenter: dancers.test && dancers.code ? ((gap + 54 - (gap + 14)) / 2) * scale : 0,
      /**
       * Keys one dancer: a pose name and/or a partial state. A gesture starts
       * on the triplet nearest its sung word (at most a sixth of a beat away).
       */
      pose(kind, atTime, pose, { dur = 0.5, curve = ease.inOut, ...extra } = {}) {
        const dancer = dancers[kind];
        const partial = typeof pose === 'string' ? { ...poseOf(pose), ...extra } : { ...pose, ...extra };
        dancer.state.add(dur < 0.1 ? atTime : nearestTriplet(atTime), partial, dur, curve);
        return api;
      },
      /**
       * Moves the whole troupe by (dx, dy) stage pixels from its placed
       * position. The rig draws inside the scaled SVG, so stage pixels are
       * converted to rig units here; otherwise a scaled troupe would fall
       * short of its target by the scale factor.
       */
      move(atTime, dx, dy, dur = 0.8) {
        stagePos.add(arrivingOnBeat(atTime, dur), { x: dx / scale, y: dy / scale }, dur);
        return api;
      },
      /** Moves one dancer to x (rig-local), keeping the other in place; arrives on a beat. */
      step(kind, atTime, dx, dur = 0.6) {
        dancers[kind].state.add(arrivingOnBeat(atTime, dur), { x: dancers[kind].home + dx }, dur);
        return api;
      },
      /** Joins (or releases) the inner hands on a beat; the other arms take `pose`. */
      hold(atTime, { pose = 'open', dur = 0.5, release = false } = {}) {
        keyAll(dur < 0.1 ? atTime : nearestBeat(atTime), (dancer) => ({
          hold: release ? 0 : 1,
          [dancer.kind === 'test' ? 'armL' : 'armR']: poseOf(pose)[dancer.kind === 'test' ? 'armL' : 'armR'],
        }), dur);
        return api;
      },
      /** The waltz box step (rise, fall, alternating feet) during [from, to). */
      waltz(from, to, { travel = 10 } = {}) {
        waltzes.push({ from, to, travel });
        return api;
      },
      /** Code spins under Test's raised arm: from a beat, for whole beats. */
      twirl(atTime, { dur = 1, turns = 1, who = 'code' } = {}) {
        const start = nearestBeat(atTime);
        const length = wholeBeats(start, dur);
        twirls.push({ at: start, dur: length, turns, who });
        if (dancers.test && who === 'code') {
          // Test lifts the joined hands into an arch, then lowers them again.
          dancers.test.state.add(start - 0.3, { armR: { sh: -158, el: 14 }, hold: 0 }, 0.35);
          dancers.test.state.add(start + length - 0.1, { hold: 1 }, 0.45);
        }
        return api;
      },
      /**
       * Test dips Code: both rise a little first (the preparation), then Code
       * sinks back in a slow arc that reaches its lowest point on a beat.
       */
      dip(atTime, { dur = 0.9, depth = 1 } = {}) {
        const start = arrivingOnBeat(atTime, dur);
        keyAll(start - 0.35, (dancer) => ({ bob: -3, lean: dancer.kind === 'code' ? -3 : 0 }), 0.35);
        if (dancers.code) dancers.code.state.add(start, { lean: 26 * depth, head: 12 * depth, bob: 5 * depth, armR: { sh: -150, el: 26 }, face: 'joy' }, dur);
        if (dancers.test) dancers.test.state.add(start, { lean: 11 * depth, head: 8 * depth, bob: 8 * depth, armL: { sh: 118, el: -28 } }, dur);
        return api;
      },
      /** Both stand tall again after a dip or bow, from a beat. */
      rise(atTime, dur = 0.8) {
        keyAll(nearestBeat(atTime), () => ({ lean: 0, head: 0, bob: 0 }), dur);
        return api;
      },
      /** Both bow toward each other, from a beat. */
      bow(atTime, { dur = 0.6 } = {}) {
        keyAll(nearestBeat(atTime), (dancer) => ({ lean: dancer.kind === 'test' ? 16 : -14, head: dancer.kind === 'test' ? 6 : -6, face: 'smile' }), dur);
        return api;
      },
      /** Test's lamp: 'idle' | 'red' | 'green' (with ✗ or ✓ on the badge). */
      lamp(atTime, status) {
        if (dancers.test) dancers.test.state.add(atTime, { lamp: status, face: status === 'red' ? 'focus' : status === 'green' ? 'joy' : 'happy' }, 0.01);
        return api;
      },
      /** Code's lines: 0 = jagged and messy, 1 = tidy indentation. */
      tidy(atTime, clean = 1, dur = 1.2) {
        if (dancers.code) dancers.code.state.add(atTime, { clean }, dur);
        return api;
      },
      face(kind, atTime, expression) {
        dancers[kind].state.add(atTime, { face: expression }, 0.01);
        return api;
      },
      look(kind, atTime, look, dur = 0.3) {
        dancers[kind].state.add(atTime, { look }, dur);
        return api;
      },
    };
    return api;
  }

  window.TddDancers = { troupe, POSES };
})();
