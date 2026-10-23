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
 * A troupe (one or both dancers) is one stage-sized SVG rig that travels:
 * place() glides it to a new spot and size on the beat (walking in time),
 * so one couple can dance through every scene of a song. Every pose is a pure
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
  /**
   * Arm poses by name; L and R are screen sides. `wr` bends the wrist: for
   * a left arm, + lifts the hand toward up; for a right arm, − does.
   */
  const POSES = {
    /** Poised: arms relaxed a little away from the body, elbows soft. */
    stand: { armL: { sh: 14, el: -20, wr: 6 }, armR: { sh: -14, el: 20, wr: -6 } },
    open: { armL: { sh: 62, el: -14, wr: 10 }, armR: { sh: -62, el: 14, wr: -10 } },
    /**
     * The promenade line for the free (outer) arms: each extends from the
     * shoulder in a soft curve, elbow slightly lower than the hand, and the
     * hand lifts at the wrist. Test's line stays near shoulder height;
     * Code's rides higher. The inner arms belong to the hold (see hold()).
     */
    frame: { armL: { sh: 92, el: 26, wr: 14 }, armR: { sh: -112, el: -14, wr: -14 } },
    /** Presenting a partner: the free arm opens low to the side, palm up. */
    present: { armL: { sh: 58, el: -14, wr: 26 } },
    /** Code takes the spotlight: her free arm rises in a long line. */
    spotlight: { armR: { sh: -142, el: 12, wr: -16 } },
    /** A solo flourish: one arm high, the other opening out at the side. */
    solo: { armL: { sh: 140, el: -18, wr: 16 }, armR: { sh: -66, el: 10, wr: -22 } },
    flourish: { armL: { sh: 126, el: -16, wr: 14 }, armR: { sh: -136, el: 16, wr: -14 } },
    cheer: { armL: { sh: 160, el: -12, wr: 0 }, armR: { sh: -160, el: 12, wr: 0 }, face: 'joy' },
    /** Hands on hips: elbows out, forearms angled back in to the waist. */
    hips: { armL: { sh: 40, el: -92, wr: -20 }, armR: { sh: -40, el: 92, wr: 20 } },
    offerR: { armL: { sh: 14, el: -20, wr: 6 }, armR: { sh: -70, el: -14, wr: -18 } },
    offerL: { armL: { sh: 70, el: 14, wr: 18 }, armR: { sh: -14, el: 20, wr: -6 } },
    pointR: { armL: { sh: 14, el: -6, wr: 0 }, armR: { sh: -104, el: -4, wr: 0 } },
    pointL: { armL: { sh: 104, el: 4, wr: 0 }, armR: { sh: -14, el: 6, wr: 0 } },
    /** Stop: the arm straight out at shoulder height, the palm turned up and out. */
    stopR: { armL: { sh: 14, el: -20, wr: 6 }, armR: { sh: -98, el: -6, wr: -80 }, face: 'focus' },
    stopL: { armL: { sh: 98, el: 6, wr: 80 }, armR: { sh: -14, el: 20, wr: -6 }, face: 'focus' },
    thinkR: { armL: { sh: 30, el: 112, wr: 0 }, armR: { sh: -24, el: -150, wr: 0 }, face: 'focus' },
    shrug: { armL: { sh: 48, el: -96, wr: 0 }, armR: { sh: -48, el: 96, wr: 0 }, face: 'o' },
    bow: { lean: 0, armL: { sh: 8, el: -4, wr: 0 }, armR: { sh: -52, el: -92, wr: 0 } },
    wave: { armL: { sh: 14, el: -20, wr: 6 }, armR: { sh: -140, el: -26, wr: -10 }, face: 'joy' },
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
      /**
       * The keyed state, softened by a short bell-shaped time kernel
       * (±0.14 s): where one move interrupts another, or a quick key
       * starts from rest, the motion carries its momentum through the
       * change instead of hitching. Still a pure function of t.
       */
      value(t) {
        if (!compiled) compile();
        const samples = SMOOTHING.map(([dt]) => raw(t + dt));
        const centre = samples[2];
        const out = { ...centre };
        for (const name of Object.keys(centre)) {
          out[name] = blend(samples.map((sample) => sample[name]), SMOOTHING.map(([, weight]) => weight), centre[name]);
        }
        return out;
      },
    };

    function raw(t) {
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
    }
  }

  /** Binomial kernel offsets (s) and weights for track smoothing. */
  const SMOOTHING = [[-0.14, 1 / 16], [-0.07, 4 / 16], [0, 6 / 16], [0.07, 4 / 16], [0.14, 1 / 16]];

  /** Weighted average of numbers (recursively in objects); other values keep the centre sample. */
  function blend(values, weights, centre) {
    if (typeof centre === 'number') {
      if (!values.every((v) => typeof v === 'number')) return centre;
      return values.reduce((sum, v, i) => sum + v * weights[i], 0);
    }
    if (isObject(centre)) {
      const out = {};
      for (const key of Object.keys(centre)) out[key] = blend(values.map((v) => (isObject(v) ? v[key] : undefined)), weights, centre[key]);
      return out;
    }
    return centre;
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

  /** A simple rounded glove without a projecting thumb. */
  function glove(parent, size) {
    const g = svg('g', { class: 'tdd-glove-hand', transform: `scale(${size})` }, parent);
    svg('path', { class: 'tdd-glove', d: 'M-4.8 0.4 C-6.8 4 -6.9 10.8 -2.5 13 C0.6 14.4 4.8 12.8 6 8.8 C6.8 5.8 5.8 2.4 4.6 0.4 Z' }, g);
    svg('path', { class: 'tdd-glove-line', d: 'M-1.8 8.4 L-1.4 11.8 M1.4 8.6 L1.8 12' }, g);
    svg('rect', { class: 'tdd-glove-cuff', x: -5.6, y: -2.4, width: 11.2, height: 3.8, rx: 1.9 }, g);
  }

  /** Limb widths: [shoulder, elbow] for the upper arm, [elbow, wrist] below. */
  const ARM_WIDTHS = { test: [[13.5, 10.5], [10.5, 8.5]], code: [[9, 7.2], [7.2, 5.6]] };

  function arm(parent, front, kind, side, body, id) {
    const [sx, sy] = body.shoulder;
    const [upperW, foreW] = ARM_WIDTHS[kind];
    const upperArm = svg('g', { class: `tdd-arm tdd-arm--${kind}` }, parent);
    upperArm.dataset.side = side;
    const outer = side === 'L' ? -1 : 1;
    const upperPath = segmentPath(body.upper, ...upperW);
    if (kind === 'code') svg('path', { class: 'tdd-skin-rim', d: upperPath }, upperArm);
    svg('path', { class: 'tdd-arm-sleeve', d: upperPath }, upperArm);
    svg('path', { class: 'tdd-arm-shine', d: `M${f(outer * (upperW[0] / 2 - 2))} 4 Q${f(outer * (upperW[1] / 2 - 1))} ${f(body.upper * 0.55)} ${f(outer * (upperW[1] / 2 - 2))} ${f(body.upper - 4)}` }, upperArm);
    const foreArm = svg('g', { class: `tdd-forearm tdd-arm--${kind}` }, front);
    const forePath = segmentPath(body.fore, ...foreW);
    if (kind === 'code') svg('path', { class: 'tdd-skin-rim', d: forePath }, foreArm);
    svg('path', { class: 'tdd-arm-fore', d: forePath }, foreArm);
    if (kind === 'test') svg('rect', { class: 'tdd-cuff', x: -5.6, y: body.fore - 6, width: 11.2, height: 5, rx: 2 }, foreArm);
    const hand = svg('g', { transform: `translate(0 ${body.fore + 1})` }, foreArm);
    glove(hand, kind === 'test' ? 0.92 : 0.8);
    // Code's puffed cap sleeve sits on top of the shoulder and turns with it.
    const cap = kind === 'code' ? svg('g', {}, front) : null;
    if (cap) svg('path', { class: 'tdd-sleeve-puff', fill: `url(#${id}-gown)`, d: 'M-7.5 3 C-8.5 -5.5 8.5 -5.5 7.5 3 C6.4 9.5 -6.4 9.5 -7.5 3 Z' }, cap);
    return {
      apply(angles) {
        const x = side === 'L' ? -sx : sx;
        const shoulder = `translate(${x} ${sy}) rotate(${f(angles.sh)})`;
        upperArm.setAttribute('transform', shoulder);
        if (cap) cap.setAttribute('transform', shoulder);
        foreArm.setAttribute('transform', `${shoulder} translate(0 ${body.upper}) rotate(${f(angles.el)})`);
        hand.setAttribute('transform', `translate(0 ${body.fore + 1}) rotate(${f(angles.wr || 0)})`);
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
      const thigh = svg('path', { class: 'tdd-trouser', fill: `url(#${id}-trouser)` }, leg);
      const stripe = svg('path', { class: 'tdd-trouser-stripe' }, leg);
      const crease = svg('path', { class: 'tdd-trouser-crease' }, leg);
      // A patent oxford: heel under the ankle, toe turned a little outward.
      const shoe = svg('g', {}, leg);
      const shape = svg('g', { transform: `scale(${side === 'L' ? -1 : 1} 1)` }, shoe);
      svg('path', { class: 'tdd-shoe', d: 'M-6.5 -2 C-7.5 -8 -2 -10.5 3 -9.5 C8 -9 12.5 -7 13 -3.2 C13.4 0 10.5 1.2 6.5 1.2 L-4.2 1.2 C-6.4 1.2 -6.9 0 -6.5 -2 Z' }, shape);
      svg('path', { class: 'tdd-shoe-sole', d: 'M-6.2 0.2 L12.6 -0.6' }, shape);
      svg('path', { class: 'tdd-shoe-shine', d: 'M2 -7.6 Q6 -7.8 9.5 -5.6' }, shape);
      return { side, thigh, stripe, crease, shoe };
    });
    const upper = svg('g', {}, spin);
    const lean = svg('g', {}, upper);
    // Torso: tailcoat front over a white shirt, gold lapels, bow tie.
    const torso = svg('g', {}, lean);
    svg('path', { class: 'tdd-coat', fill: `url(#${id}-coat)`, d: 'M-27 -168 C-29 -175 -22 -178.5 -12 -178.5 L12 -178.5 C22 -178.5 29 -175 27 -168 C29.5 -152 25 -134 20.5 -122 C19.5 -114 20.5 -106 20 -100 Q0 -95 -20 -100 C-20.5 -106 -19.5 -114 -20.5 -122 C-25 -134 -29.5 -152 -27 -168 Z' }, torso);
    svg('path', { class: 'tdd-coat-shade', d: 'M6 -178.5 L12 -178.5 C22 -178.5 29 -175 27 -168 C29.5 -152 25 -134 20.5 -122 C19.5 -114 20.5 -106 20 -100 Q13 -97.5 6 -97 Z' }, torso);
    svg('path', { class: 'tdd-coat-seam', d: 'M-20.5 -122 Q0 -117 20.5 -122' }, torso);
    svg('path', { class: 'tdd-shirt', d: 'M-11 -177 L0 -128 L11 -177 Q0 -180 -11 -177 Z' }, torso);
    svg('path', { class: 'tdd-lapel', fill: `url(#${id}-satin)`, d: 'M-11 -177 L-2 -132 L-16 -156 L-12 -162 L-19 -170 Z' }, torso);
    svg('path', { class: 'tdd-lapel tdd-lapel--shade', d: 'M11 -177 L2 -132 L16 -156 L12 -162 L19 -170 Z' }, torso);
    for (const y of [-124, -114]) {
      svg('circle', { class: 'tdd-button', cx: 0, cy: y, r: 1.9 }, torso);
      svg('circle', { class: 'tdd-button-shine', cx: -0.6, cy: y - 0.6, r: 0.6 }, torso);
    }
    // A satin edge where each lapel rolls over.
    svg('path', { class: 'tdd-lapel-edge', d: 'M-11 -177 L-2 -132 M11 -177 L2 -132' }, torso);
    svg('path', { class: 'tdd-bowtie', d: 'M0 -175 L-10 -181 L-10 -168 Z M0 -175 L10 -181 L10 -168 Z' }, torso);
    // Folds pinched into each wing of the bow tie.
    svg('path', { class: 'tdd-bowtie-fold', d: 'M-3 -175 L-8 -177.5 M-3 -175 L-8 -172 M3 -175 L8 -177.5 M3 -175 L8 -172' }, torso);
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
    // Glass depth: a soft inner rim and a small second glint low on the dome.
    svg('path', { class: 'tdd-lamp-refraction', d: 'M-21 -206 Q-20 -196 -10 -191' }, dome);
    svg('circle', { class: 'tdd-lamp-glint', cx: 15, cy: -200, r: 1.6 }, dome);
    const faceGroup = svg('g', { transform: 'translate(0 -210)' }, dome);
    const faceRig = face(faceGroup, { eyeX: 8, eyeY: -5, mouthY: 7, browY: -12, seed: uid * 7 + 11 });
    // Upper arms emerge from behind the torso; bent forearms, cuffs, and
    // palms sit in front. Keep these layers in the same body coordinate frame.
    const rearArms = svg('g', { class: 'tdd-arms-rear' }, lean);
    lean.insertBefore(rearArms, lean.firstChild);
    const frontArms = svg('g', { class: 'tdd-arms-front' }, lean);
    const arms = { L: arm(rearArms, frontArms, 'test', 'L', body, id), R: arm(rearArms, frontArms, 'test', 'R', body, id) };

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
      // The pressed front crease runs down the middle of the leg.
      const c = bend * 0.12;
      const crease = `M${pt(side(hip, n0, wHip / 2, c))} Q${pt(side(knee, nk, wKnee / 2, c))} ${pt(side(ankle, n2, wAnkle / 2, c))}`;
      return { outline, stripe, crease };
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
        // The coat tails hang from the waist and swing a beat behind the body.
        back.setAttribute('transform', `translate(0 ${f(s.bob)}) rotate(${f(s.lean)} 0 ${body.hipY}) rotate(${f(s.tails || 0)} 0 -112)`);
        for (const leg of legs) {
          const sign = leg.side === 'L' ? -1 : 1;
          const foot = s[`foot${leg.side}`];
          const hip = rotateAbout([sign * body.hip, body.hipY + s.bob], [0, body.hipY + s.bob], s.lean * 0.35);
          const tip = [sign * body.foot + foot.dx, -8 - foot.lift];
          const { outline, stripe, crease } = legShape(hip, tip, sign);
          leg.crease.setAttribute('d', crease);
          leg.thigh.setAttribute('d', outline);
          leg.stripe.setAttribute('d', stripe);
          // A lifted foot points its toe.
          leg.shoe.setAttribute('transform', `translate(${f(sign * body.foot + foot.dx)} ${f(-foot.lift)}) rotate(${f(-sign * foot.lift * 2.4)})`);
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

  /** A four-point sparkle of radius 1, scaled per use. */
  const SPARKLE = 'M0 -1 L0.22 -0.22 L1 0 L0.22 0.22 L0 1 L-0.22 0.22 L-1 0 L-0.22 -0.22 Z';
  /** Where the refactoring sparkles twinkle around the gown (rig-local). */
  const SPARKLES = [[-62, -44, 9], [64, -76, 8], [-48, -104, 7], [58, -18, 9], [-24, -138, 6], [36, -126, 7], [-70, -12, 7], [8, -150, 6]];

  function buildCode(parent, id) {
    const body = BODY.code;
    const root = svg('g', { class: 'tdd-dancer tdd-dancer--code' }, parent);
    // Refactoring gets the spotlight: a cone of light from above and a glow
    // behind the gown while its code lines snap into clean indentation.
    const spot = svg('path', { class: 'tdd-tidy-spot', fill: `url(#${id}-spot)`, d: 'M-24 -440 L24 -440 L92 4 L-92 4 Z', opacity: 0 }, root);
    const glow = svg('ellipse', { class: 'tdd-tidy-glow', fill: `url(#${id}-tidy)`, cx: 0, cy: -72, rx: 86, ry: 100, opacity: 0 }, root);
    const shadow = svg('ellipse', { class: 'tdd-shadow', cx: 0, cy: 0, rx: 46, ry: 6.5 }, root);
    const spin = svg('g', {}, root);
    const shoes = svg('g', {}, spin);
    const slippers = ['L', 'R'].map((side, i) => ({
      side, node: (() => {
        const g = svg('g', {}, shoes);
        svg('ellipse', { class: 'tdd-slipper', cx: i ? 11 : -11, cy: -3, rx: 8, ry: 4 }, g);
        svg('path', { class: 'tdd-slipper-shine', d: `M${i ? 6 : -16} -5 Q${i ? 10 : -12} -6.5 ${i ? 14 : -8} -5.5` }, g);
        return g;
      })(),
    }));
    const skirtClip = svg('clipPath', { id: `${id}-skirt` }, svg('defs', {}, spin));
    const clipShape = svg('path', {}, skirtClip);
    const skirt = svg('path', { class: 'tdd-gown', fill: `url(#${id}-gown)` }, spin);
    const skirtShade = svg('path', { class: 'tdd-gown-fold' }, spin);
    // Soft folds fall from the waist through the skirt.
    const skirtFolds = [-0.55, -0.15, 0.3].map(() => svg('path', { class: 'tdd-gown-crease' }, spin));
    const page = svg('g', { 'clip-path': `url(#${id}-skirt)` }, spin);
    // Messy code is spaghetti: rows out of order, at the wrong indentation
    // and tilted; inside each row, tokens scattered, turned, and of uneven
    // length. Clean code is one neat row per line. Every offset is seeded,
    // so the mess is the same on every seek, and all of it collapses to zero
    // as the code is cleaned.
    const ORDER = [2, 0, 5, 1, 7, 3, 6, 4];
    const rows = CODE_ROWS.map((row, i) => {
      const y = -106 + i * 11.5;
      const group = svg('g', {}, page);
      let x = 0;
      const bars = row.bars.map(([w, tone], k) => {
        const width = w * 1.12;
        const bar = svg('rect', { class: `tdd-code-bar tdd-code-bar--${tone}`, x, y: -3.2, width, height: 6.4, rx: 3.2 }, group);
        const seed = i * 31 + k * 7;
        const messy = {
          dx: (hash01(seed + 1) - 0.5) * 18,
          dy: (hash01(seed + 2) - 0.5) * 8,
          turn: (hash01(seed + 3) - 0.5) * 44,
          stretch: 0.55 + hash01(seed + 4) * 1.0,
        };
        x += width + 4;
        return { node: bar, x: x - width - 4, width, messy };
      });
      return {
        group, y, indent: row.indent, bars,
        jitter: (hash01(i * 17 + 3) - 0.5) * 40,
        tilt: (hash01(i * 29 + 5) - 0.5) * 30,
        // Out of order: a messy row sits on another row's line, nudged off it.
        drop: (ORDER[i] - i) * 11.5 + (hash01(i * 13 + 7) - 0.5) * 6,
      };
    });
    // A bright band sweeps down the gown with the rows as they snap clean.
    const sweep = svg('rect', { class: 'tdd-tidy-sweep', x: -80, y: -9, width: 160, height: 18, fill: `url(#${id}-sweep)`, opacity: 0 }, page);
    const hem = svg('path', { class: 'tdd-gown-hem' }, spin);
    // The toes peek in front of the hem, so a lifted step stays visible.
    spin.appendChild(shoes);
    const sparkles = SPARKLES.map(([x, y, r]) => ({ x, y, r, node: svg('path', { class: 'tdd-sparkle', d: SPARKLE, opacity: 0 }, root) }));
    // The hem stays on the floor; the waist and everything above it ride on
    // `upper`, so the gown stretches and gathers with the rise and fall.
    const upper = svg('g', {}, spin);
    const lean = svg('g', {}, upper);
    // Bodice, sash, and the paper-white neck.
    svg('path', { class: 'tdd-bodice', fill: `url(#${id}-gown)`, d: 'M-18.5 -166 C-19.5 -171 -12 -172 -8 -170 Q0 -166 8 -170 C12 -172 19.5 -171 18.5 -166 C20 -150 15 -134 11.5 -118 L-11.5 -118 C-15 -134 -20 -150 -18.5 -166 Z' }, lean);
    svg('path', { class: 'tdd-bodice-seam', d: 'M-6 -160 Q-4 -138 -3 -120 M6 -160 Q4 -138 3 -120' }, lean);
    svg('path', { class: 'tdd-neckline', d: 'M-13 -169 Q-6 -158 0 -165 Q6 -158 13 -169' }, lean);
    svg('rect', { class: 'tdd-sash', x: -14, y: -123, width: 28, height: 8, rx: 3 }, lean);
    svg('path', { class: 'tdd-sash-sheen', d: 'M-11 -121 H6' }, lean);
    svg('path', { class: 'tdd-sash-bow', d: 'M9 -119 L19 -126 L18 -112 Z' }, lean);
    const neckPath = 'M-3 -181 L3 -181 L4.2 -168.5 Q0 -166.5 -4.2 -168.5 Z';
    svg('path', { class: 'tdd-skin-rim', d: neckPath }, lean);
    svg('path', { class: 'tdd-paper', d: neckPath }, lean);
    // The head: a page with a folded corner, a face, and brace clips.
    const head = svg('g', {}, lean);
    svg('path', { class: 'tdd-page', fill: `url(#${id}-page)`, d: 'M-21 -231 H10 L22 -219 V-184 Q22 -178 16 -178 H-15 Q-21 -178 -21 -184 Z' }, head);
    svg('path', { class: 'tdd-page-fold', d: 'M10 -231 V-222 Q10 -219 13 -219 H22 Z' }, head);
    svg('line', { class: 'tdd-page-rule', x1: -15, y1: -224, x2: 2, y2: -224 }, head);
    // The page's own faint ruled lines, and the shadow under its folded corner.
    for (const y of [-188, -183]) svg('line', { class: 'tdd-page-line', x1: -16, y1: y, x2: 17, y2: y }, head);
    svg('path', { class: 'tdd-page-fold-shadow', d: 'M10 -222 Q10 -219 13 -219 H22 V-217 H12 Q9 -217 9 -220 Z' }, head);
    for (const side of [-1, 1]) {
      svg('circle', { class: 'tdd-blush', cx: side * 12, cy: -195, r: 3.4 }, head);
      const d = side < 0
        ? 'M-26 -222 Q-31 -222 -31 -216 V-210 Q-31 -205 -35 -205 Q-31 -205 -31 -200 V-194 Q-31 -188 -26 -188'
        : 'M26 -222 Q31 -222 31 -216 V-210 Q31 -205 35 -205 Q31 -205 31 -200 V-194 Q31 -188 26 -188';
      // A wider under-stroke gives dark hair a thin rim without changing its color.
      svg('path', { class: 'tdd-brace-rim', d }, head);
      svg('path', { class: 'tdd-brace', d }, head);
      svg('path', { class: 'tdd-brace-shine', d, transform: 'translate(-0.7 -0.7)' }, head);
    }
    const faceGroup = svg('g', { transform: 'translate(0 -202)' }, head);
    const faceRig = face(faceGroup, { eyeX: 8, eyeY: -2, mouthY: 9, browY: -9, lashes: true, seed: uid * 7 + 23 });
    // Upper arms emerge from behind the torso; bent forearms, cuffs, and
    // palms sit in front. Keep these layers in the same body coordinate frame.
    const rearArms = svg('g', { class: 'tdd-arms-rear' }, lean);
    lean.insertBefore(rearArms, lean.firstChild);
    const frontArms = svg('g', { class: 'tdd-arms-front' }, lean);
    const arms = { L: arm(rearArms, frontArms, 'code', 'L', body, id), R: arm(rearArms, frontArms, 'code', 'R', body, id) };

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
        for (const slipper of slippers) {
          const foot = s[`foot${slipper.side}`];
          slipper.node.setAttribute('transform', `translate(${f(foot.dx)} ${f(-foot.lift)})`);
        }
        const waistY = body.hipY + 2 + s.bob;
        const d = skirtPath(s.sway, s.flare, waistY);
        skirt.setAttribute('d', d);
        clipShape.setAttribute('d', d);
        hem.setAttribute('d', d);
        [-0.55, -0.15, 0.3].forEach((k, i) => {
          const hw = 54 + s.flare;
          const bottomX = k * hw + s.sway * 9 * (0.6 + 0.2 * i);
          skirtFolds[i].setAttribute('d', `M${f(k * 9)} ${f(waistY + 6)} Q${f(k * hw * 0.55 + s.sway * 4)} -60 ${f(bottomX)} -12`);
        });
        skirtShade.setAttribute('d', `M2 ${f(waistY)} C10 -80 ${f(30 + s.sway * 6)} -40 ${f(44 + s.sway * 9 + s.flare)} -10 L${f(20 + s.sway * 6)} -8 C16 -40 8 -80 2 ${f(waistY)} Z`);
        const clean = clamp(s.clean, 0, 1);
        // Rows snap clean one after another, top to bottom, each with a
        // small overshoot, so a refactoring reads as code clicking into place.
        const STAGGER = 0.6;
        rows.forEach((row, i) => {
          const local = clamp(clean * (1 + STAGGER) - (i / (rows.length - 1)) * STAGGER, 0, 1);
          const c = local <= 0 ? 0 : local >= 1 ? 1 : ease.back(local);
          const mess = 1 - c;
          // While messy, the code never quite settles: a slow, restless wobble.
          const restless = Math.max(0, mess) * Math.sin(t * 2.6 + i * 1.7);
          const halfWidth = 12 + ((row.y - body.hipY) / (-8 - body.hipY)) * (40 + s.flare * 0.8);
          const tidyX = -halfWidth + 7 + row.indent * 8 + s.sway * 9 * ((row.y - body.hipY) / 110);
          const x = tidyX + mess * row.jitter + restless * 1.5;
          const y = row.y + mess * row.drop;
          const tilt = mess * row.tilt + restless * 2.5;
          const down = (row.y - body.hipY) / (-8 - body.hipY);
          row.group.setAttribute('transform', `translate(${f(x)} ${f(y + s.bob * (1 - down))}) rotate(${f(tilt)})`);
          for (const bar of row.bars) {
            const m = bar.messy;
            const width = bar.width * (1 + (m.stretch - 1) * mess);
            bar.node.setAttribute('width', f(Math.max(4, width)));
            bar.node.setAttribute('transform', mess === 0 ? '' : `translate(${f(m.dx * mess)} ${f(m.dy * mess)}) rotate(${f(m.turn * mess)} ${f(bar.x + width / 2)} 0)`);
          }
        });
        page.classList.toggle('is-messy', clean < 0.5);
        // The spotlight while the code is being cleaned up.
        const shine = clamp(s.tidyGlow || 0, 0, 1);
        spot.setAttribute('opacity', f(0.75 * shine));
        glow.setAttribute('opacity', f(0.9 * shine));
        glow.setAttribute('ry', f(100 + s.flare * 0.6));
        sweep.setAttribute('opacity', f(shine));
        sweep.setAttribute('y', f(-115 + clean * 96));
        sparkles.forEach((spark, i) => {
          const life = (t * 1.35 + i * 0.37) % 1;
          const size = spark.r * shine * Math.sin(Math.PI * life);
          spark.node.setAttribute('opacity', f(shine > 0.02 ? Math.min(1, 1.6 * Math.sin(Math.PI * life)) * shine : 0));
          spark.node.setAttribute('transform', `translate(${f(spark.x * s.spin)} ${f(spark.y + s.bob)}) rotate(${f(life * 90)}) scale(${f(Math.max(0.01, size))})`);
        });
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
    // Cloth: the tailcoat and trousers catch light at the shoulders and
    // fall into shadow below; the gold lapel has a satin sheen.
    stops(svg('linearGradient', { id: `${id}-coat`, class: 'tdd-coat-grad', x1: 0.2, y1: 0, x2: 0.5, y2: 1 }, node), ['top', 'mid', 'bottom']);
    stops(svg('linearGradient', { id: `${id}-trouser`, class: 'tdd-trouser-grad', x1: 0, y1: 0, x2: 0, y2: 1 }, node), ['top', 'bottom']);
    stops(svg('linearGradient', { id: `${id}-satin`, class: 'tdd-satin-grad', x1: 0, y1: 0, x2: 1, y2: 1 }, node), ['top', 'mid', 'bottom']);
    stops(svg('linearGradient', { id: `${id}-spot`, class: 'tdd-spot-grad', x1: 0, y1: 0, x2: 0, y2: 1 }, node), ['top', 'bottom']);
    stops(svg('radialGradient', { id: `${id}-tidy`, class: 'tdd-tidy-grad' }, node), ['core', 'edge']);
    stops(svg('linearGradient', { id: `${id}-sweep`, class: 'tdd-sweep-grad', x1: 0, y1: 0, x2: 0, y2: 1 }, node), ['edge', 'core', 'edge']);
    stops(svg('radialGradient', { id: `${id}-follow`, class: 'tdd-follow-grad' }, node), ['core', 'mid', 'edge']);
    stops(svg('radialGradient', { id: `${id}-pool`, class: 'tdd-pool-grad' }, node), ['core', 'edge']);
  }

  // ------------------------------------------------------------------
  // Troupe: one or both dancers in one rig, with joined hands
  // ------------------------------------------------------------------

  const NEUTRAL = {
    x: 0, y: 0, bob: 0, lean: 0, head: 0, spin: 1, look: 0, face: 'happy', lamp: 'idle',
    armL: { ...POSES.stand.armL }, armR: { ...POSES.stand.armR },
    footL: { dx: 0, lift: 0 }, footR: { dx: 0, lift: 0 },
    sway: 0, flare: 0, clean: 1, hold: 0, embrace: 0, low: 0, idleMotion: 1,
  };

  /**
   * troupe(parent, { x, y, scale, at, until, members }) draws the dancers
   * in `members` (['test', 'code'] by default; test stands left). Returns
   * { node, test, code, move, waltz, hold, twirl, … }: every method keys
   * motion at song times; none of them starts a clock.
   */
  const STAGE = { w: 960, h: 540 };

  function troupe(parent, { x, y, scale = 1, at, until, members = ['test', 'code'], gap = 56 }) {
    const id = `tdd-troupe-${++uid}`;
    const wrap = place(el('div', 'tdd-troupe is-staged', parent), 0, 0);
    const art = svg('svg', { class: 'tdd-troupe-art', viewBox: `0 0 ${STAGE.w} ${STAGE.h}`, width: STAGE.w, height: STAGE.h, 'aria-hidden': 'true' }, wrap);
    defs(art, id);
    // The floor group carries the troupe across the stage: x, y are the
    // stage point between the dancers' feet, and scaling about the feet
    // reads as a step toward or away from the viewer.
    const floor = svg('g', {}, art);
    // A follow spot keeps the couple lifted off the dark ballroom: a soft
    // glow behind them and a pool of light on the floor under their feet.
    if (members.length === 2) {
      svg('ellipse', { class: 'tdd-follow-glow', cx: 20, cy: -122, rx: 176, ry: 168, fill: `url(#${id}-follow)` }, floor);
      svg('ellipse', { class: 'tdd-follow-pool', cx: 20, cy: 2, rx: 150, ry: 20, fill: `url(#${id}-pool)` }, floor);
    }
    const origin = { x, y, scale };
    const stagePos = track({ ...origin });
    const dancers = {};
    members.forEach((kind) => {
      const offset = members.length === 2 ? (kind === 'test' ? -gap : gap) : 0;
      const rig = (kind === 'test' ? buildTest : buildCode)(floor, id);
      const state = track(merge(NEUTRAL, { x: offset, look: members.length === 2 ? (kind === 'test' ? 1 : -1) : 0 }));
      dancers[kind] = { kind, rig, state, home: offset };
    });
    const waltzes = [];
    const twirls = [];
    /** Rig units from the troupe's x to the middle of the couple's footprint. */
    const footprint = dancers.test && dancers.code ? (54 - 14) / 2 : 0;

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
      // `calm` scales the whole figure down to a gentle sway in place.
      // A full second to settle into the waltz and out of it again.
      const fade = smooth((t - active.from) / 1.0) * smooth((active.to - t) / 1.0) * (active.calm ?? 1);
      const { index, phase } = beats.at(t);
      const dir = index % 2 === 0 ? 1 : -1;
      const travel = active.travel;
      const glide = smooth(phase / 0.7);
      const swing = Math.PI * (index + phase);
      // Progressive travel: over eight measures the couple circles the
      // floor, out toward stage centre's far side and back, and toward and
      // away from the viewer, so the waltz moves through space instead of
      // rocking in place. The loop starts and ends where the couple was
      // placed and only ever drifts away from the teaching boxes (to +x).
      // Each measure advances on its "1" and settles by "3", like the box step.
      const measure = index - beats.index(active.from) + smooth(phase / 0.8);
      const around = (2 * Math.PI * measure) / 8;
      return {
        fade, index, phase, dir, travel,
        roam: { x: active.roam * 0.5 * (1 - Math.cos(around)), y: 6 * Math.sin(around), scale: 1 + 0.03 * Math.sin(around) },
        rise: riseOf(phase),
        x: travel * dir * (2 * glide - 1),
        // Legato footwork: the leading foot glides through most of "1",
        // the other brushes in to close on "2–3".
        lead: { from: -travel * dir, to: travel * dir, at: smooth(phase / 0.52), lift: Math.sin(Math.PI * clamp(phase / 0.52, 0, 1)) },
        trail: { from: -travel * dir, to: travel * dir, at: smooth((phase - 0.54) / 0.4), lift: Math.sin(Math.PI * clamp((phase - 0.54) / 0.4, 0, 1)) },
        sway: Math.sin(swing),
        lag: (delay) => Math.sin(swing - delay),
        depth: 1 + 0.022 * Math.sin((Math.PI / 2) * (index + phase)),
      };
    }

    /**
     * Footwork while a dancer travels outside a waltz: one step per beat, so
     * a walk between scenes is in time with the music. Speed is measured in
     * stage pixels and counts sideways travel, travel up or down the floor,
     * and moving toward or away from the viewer (a change of scale).
     */
    function walkOf(dancer, t) {
      const where = (time) => {
        const pos = stagePos.value(time);
        return [pos.x + dancer.state.value(time).x * pos.scale, pos.y, pos.scale];
      };
      const [x, y, sc] = where(t);
      const [x0, y0, sc0] = where(t - 0.1);
      const speed = Math.hypot(x - x0, (y - y0) * 1.5, (sc - sc0) * 260) / 0.1;
      const amount = smooth((speed - 8) / 60);
      if (amount <= 0) return null;
      const { index, phase } = beats.at(t);
      const cycle = Math.sin(Math.PI * (index + phase));
      return {
        amount,
        liftL: Math.max(0, cycle) * 8 * amount,
        liftR: Math.max(0, -cycle) * 8 * amount,
        dip: Math.abs(cycle) * 2.5 * amount,
        velocity: (x - where(t - 0.2)[0]) / 0.2 / sc,
      };
    }

    /** How far an underarm turn is under way at t (0 outside one, 1 in it). */
    function archAt(t) {
      const turn = twirls.find((tw) => tw.who === 'code' && t >= tw.at - 0.5 && t <= tw.at + tw.dur + 0.5);
      if (!turn || !dancers.test || !dancers.code) return 0;
      return smooth((t - turn.at + 0.5) / 0.5) * smooth((turn.at + turn.dur + 0.5 - t) / 0.5);
    }

    function stateOf(dancer, t, couple, w) {
      const isTest = dancer.kind === 'test';
      let s = dancer.state.value(t);
      // Follow-through: forearms and the head trail the body's keyed motion.
      // Overlapping action: the forearm trails the upper arm, the hand
      // trails the forearm, and the head settles last.
      const lagged = dancer.state.value(t - 0.12);
      const wristLag = dancer.state.value(t - 0.2);
      s = {
        ...s,
        armL: { ...s.armL, el: lagged.armL.el, wr: wristLag.armL.wr },
        armR: { ...s.armR, el: lagged.armR.el, wr: wristLag.armR.wr },
        head: dancer.state.value(t - 0.1).head,
      };
      // In the promenade hold (and under an arch) the partners stand close
      // enough to touch: Test's arm behind Code's back, her hand on his shoulder.
      const arch = archAt(t);
      const closer = Math.max(s.embrace * Math.max(0, Math.abs(dancer.home) - 40), arch * Math.max(0, Math.abs(dancer.home) - 34));
      if (closer > 0) s.x -= Math.sign(dancer.home) * closer;
      // The ballroom head line: in the hold each partner looks out over the
      // other's shoulder, Code's head tilted away from Test, his to his left.
      s.head += (isTest ? -3 : 5) * s.embrace;
      if (arch > 0) s.hold = Math.max(s.hold, arch);
      if (!isTest) {
        // Cleaning up: the spotlight follows the rate of the tidy, with a
        // short afterglow, and the gown lifts and flares as the code snaps.
        const rate = (s.clean - lagged.clean) / 0.08;
        const earlier = dancer.state.value(t - 0.35);
        const rateEarlier = (earlier.clean - dancer.state.value(t - 0.43).clean) / 0.08;
        s.tidyGlow = clamp(Math.max(rate, 0.8 * rateEarlier) / 0.8, 0, 1);
        s.flare += 7 * s.tidyGlow;
        s.bob -= 2 * s.tidyGlow;
      }
      // Alive at rest, in time: a soft settle on every beat and a weight
      // shift that sways the couple together over two beats.
      const pulse = beats.at(t);
      s.bob += s.idleMotion * 0.9 * Math.cos(2 * Math.PI * pulse.phase);
      s.lean += s.idleMotion * 0.8 * Math.sin(Math.PI * (pulse.index + pulse.phase));
      const outer = isTest ? 'armL' : 'armR';
      const outerSign = isTest ? 1 : -1;
      if (w) {
        const e = w.fade;
        const inward = isTest ? 1 : -1;
        s.bob += (4 - 7 * w.rise) * e;
        // Test stands tall, inclined a touch toward her; Code's top line
        // curves back and away from him, as in a ballroom hold.
        s.lean += (3.2 * w.sway + (isTest ? 1.2 : 3.4)) * e;
        s.head += 3 * inward * e;
        s.x += w.x * e;
        s.head += (isTest ? 2.5 * w.lag(0.3) : -2 + 3 * w.lag(0.45)) * e;
        // The free arms float on the beat, the forearm a little behind.
        // The wrist follows a beat later still, so the hand finishes the line.
        s[outer] = {
          sh: s[outer].sh + outerSign * 7 * w.lag(0.5) * e,
          el: s[outer].el + outerSign * 9 * w.lag(1.1) * e,
          wr: (s[outer].wr || 0) + outerSign * 8 * w.lag(1.6) * e,
        };
        {
          // Both partners step: the leading foot glides on "1–2";
          // the other closes on "3". Feet stay put while the body travels.
          const leadSide = w.dir > 0 ? 'R' : 'L';
          const trailSide = w.dir > 0 ? 'L' : 'R';
          const leadX = w.lead.from + (w.lead.to - w.lead.from) * w.lead.at;
          const trailX = w.trail.from + (w.trail.to - w.trail.from) * w.trail.at;
          // Rising onto the toes through "2–3", lowering on "1".
          const heel = isTest ? 4 * w.rise : 0;
          const lead = s[`foot${leadSide}`];
          const trail = s[`foot${trailSide}`];
          // A clear box step: the leading foot lifts and reaches, the closing
          // foot brushes in low.
          s[`foot${leadSide}`] = { dx: lead.dx + (leadX - w.x) * 1.3 * e, lift: lead.lift + (8 * w.lead.lift + heel) * e };
          s[`foot${trailSide}`] = { dx: trail.dx + (trailX - w.x) * 1.3 * e, lift: trail.lift + (4.5 * w.trail.lift + heel) * e };
        }
        if (isTest) s.tails = (9 * w.lag(1.0) - 0.12 * w.travel * w.dir * Math.sin(Math.PI * w.phase)) * e;
        if (!isTest) {
          // The gown trails the travel and sways with the frame.
          s.sway += (0.55 * w.lag(0.9) - 0.04 * w.travel * w.dir * Math.sin(Math.PI * w.phase)) * e;
          s.flare += 3 * w.rise * e;
        }
      } else {
        const walk = walkOf(dancer, t);
        if (walk) {
          s.bob += walk.dip;
          s.footL = { ...s.footL, lift: s.footL.lift + walk.liftL };
          s.footR = { ...s.footR, lift: s.footR.lift + walk.liftR };
          // Walking, the tails trail behind the direction of travel.
          if (isTest) s.tails = clamp(walk.velocity / 16, -10, 10) * walk.amount;
          if (!isTest) {
            s.sway += clamp(-walk.velocity / 140, -0.9, 0.9) * walk.amount;
          }
        }
      }
      for (const twirl of twirls) {
        if (dancer.kind !== twirl.who || t < twirl.at || t > twirl.at + twirl.dur) continue;
        const p = (t - twirl.at) / twirl.dur;
        const lift = Math.sin(Math.PI * p);
        // Turning: the figure narrows through edge-on and widens again
        // and widens again, while the gown flares and the body rises. The
        // inner hands stay joined above her head (archAt), so she turns
        // under Test's raised arm; her free arm stays rounded and low.
        const c = Math.cos(2 * Math.PI * twirl.turns * ease.inOut(p));
        // Continuous through edge-on (like a card turning), so the figure
        // never jumps from one side to its mirror image.
        s.spin = Math.abs(c) < 1e-3 ? 1e-3 : c;
        s.flare += 20 * lift;
        s.bob -= 4 * lift;
        s.head -= 6 * lift;
        // Her free arm wraps in close to the waist while she turns, so the
        // hand stays near the body's centre line as the figure narrows.
        if (twirl.who === 'code') s.armR = mix(s.armR, { sh: -22, el: 74, wr: -10 }, smooth(p / 0.35) * smooth((1 - p) / 0.35));
      }
      if (couple && s.hold > 0) {
        const target = isTest ? couple.test : couple.code;
        const body = dancer.rig.body;
        const side = isTest ? 'R' : 'L';
        const sign = side === 'L' ? -1 : 1;
        // Target in this dancer's un-leaned, un-turned body coordinates.
        const local = rotateAbout([(target[0] - s.x) / (s.spin || 1), target[1] - s.y - s.bob], [0, body.hipY], -s.lean);
        const shoulder = [sign * body.shoulder[0], body.shoulder[1]];
        const solved = reach(shoulder, local, body.upper, body.fore, side === 'R' ? 1 : -1);
        const key = `arm${side}`;
        // atan2 wraps at ±180°, so the solver's shoulder angle can come back a
        // whole turn from the poses it blends with. Keep it in the arm's own
        // range (the one every pose is written in: a left arm from across the
        // chest, through hanging and out, up to just past overhead; a right
        // arm mirrored), so the blend into and out of the hold never snaps.
        if (side === 'L') {
          while (solved.sh > 240) solved.sh -= 360;
          while (solved.sh <= -120) solved.sh += 360;
        } else {
          while (solved.sh < -240) solved.sh += 360;
          while (solved.sh >= 120) solved.sh -= 360;
        }
        solved.wr = s[key].wr || 0;
        if (!isTest && couple.drape > 0) {
          // Aim the palm down over his shoulder, independent of the elbow
          // angle. During a turn the hands join overhead instead.
          const direction = rotateAbout([couple.palm[0] / (s.spin || 1), couple.palm[1]], [0, 0], -s.lean);
          let wrist = Math.atan2(-direction[0], direction[1]) * 180 / Math.PI - solved.sh - solved.el;
          while (wrist - solved.wr > 180) wrist -= 360;
          while (wrist - solved.wr < -180) wrist += 360;
          solved.wr += (wrist - solved.wr) * couple.drape;
        }
        s[key] = mix(s[key], solved, s.hold);
      }
      return s;
    }

    onFrame((t) => {
      if (t < at - 0.5 || (until !== undefined && t > until + 0.5)) return;
      const pos = stagePos.value(t);
      const w = waltzAt(t);
      const roam = w ? { x: w.roam.x * w.fade, y: w.roam.y * w.fade, scale: 1 + (w.roam.scale * w.depth - 1) * w.fade } : { x: 0, y: 0, scale: 1 };
      const scaleNow = pos.scale * roam.scale;
      floor.setAttribute('transform', `translate(${f(pos.x + roam.x)} ${f(pos.y + roam.y)}) scale(${scaleNow.toFixed(4)})`);
      const raw = {};
      for (const dancer of Object.values(dancers)) raw[dancer.kind] = stateOf(dancer, t, null, w);
      let couple = null;
      if (dancers.test && dancers.code) {
        // A point on a dancer's body (body-local, before lean and turn).
        const on = (kind, [px, py]) => {
          const s = raw[kind];
          const p = rotateAbout([px, py], [0, dancers[kind].rig.body.hipY], s.lean);
          return [s.x + p[0] * s.spin, s.y + s.bob + p[1]];
        };
        const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
        // Hand in hand: the inner hands meet between the inner shoulders,
        // a little higher while waltzing.
        const a = on('test', [BODY.test.shoulder[0], BODY.test.shoulder[1]]);
        const b = on('code', [-BODY.code.shoulder[0], BODY.code.shoulder[1]]);
        // Presenting (low): the joined hands drop to waist height between them.
        const drop = 30 + 26 * Math.max(raw.test.low, raw.code.low) - (w ? 16 * w.fade : 0);
        const hands = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + drop];
        // Promenade hold: Test's hand on Code's back, behind her; Code's hand
        // resting on top of Test's near shoulder, her arm in a long line.
        const back = on('code', [-2, -150]);
        const contact = on('test', [25, -168]);
        const palm = rotateAbout([0, 7.2], [0, 0], raw.test.lean);
        // IK targets the wrist; the palm, not the cuff, rests on the shoulder.
        const shoulder = [contact[0] - palm[0], contact[1] - palm[1]];
        // Underarm turn: the joined hands rise above Code's head.
        const arch = [raw.code.x - 20, raw.code.y + raw.code.bob - 222];
        const k = archAt(t);
        couple = {
          palm, drape: raw.code.embrace * (1 - k),
          test: lerp(lerp(hands, back, raw.test.embrace), arch, k),
          code: lerp(lerp(hands, shoulder, raw.code.embrace), arch, k),
        };
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
      /** Runtime palette from the saved human hero; defaults remain in CSS. */
      codeAppearance({ skin, ink, glint, skinShadow, skinHighlight, skinIsDark, hair, hairIsDark }) {
        wrap.style.setProperty('--tdd-code-skin', skin);
        wrap.style.setProperty('--tdd-code-ink', ink);
        wrap.style.setProperty('--tdd-code-glint', glint);
        wrap.style.setProperty('--tdd-code-skin-shadow', skinShadow);
        wrap.style.setProperty('--tdd-code-skin-highlight', skinHighlight);
        wrap.style.setProperty('--tdd-code-hair', hair);
        wrap.classList.toggle('has-dark-code-hair', hairIsDark);
        wrap.classList.toggle('has-dark-code-skin', skinIsDark);
        return api;
      },
      /**
       * Stage-pixel offset from the troupe's x to the middle of the couple's
       * footprint (Test's shoes on the left, Code's hem on the right), so a
       * caller can centre the couple on a floor mark.
       */
      footprintCenter: footprint * scale,
      /**
       * Keys one dancer: a pose name and/or a partial state. A gesture starts
       * on the triplet nearest its sung word (at most a sixth of a beat away).
       */
      pose(kind, atTime, pose, { dur = 0.75, curve = ease.inOut, ...extra } = {}) {
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
        stagePos.add(arrivingOnBeat(atTime, dur), { x: origin.x + dx, y: origin.y + dy }, dur);
        return api;
      },
      /**
       * Glides the troupe so the middle of its footprint stands at stage
       * (x, y) at `scale`, arriving on a beat. Partial targets keep the rest.
       * Outside a waltz the dancers walk there, one step per beat.
       */
      place(atTime, { x: px, y: py, scale: ps } = {}, dur = 1.2) {
        const target = {};
        if (ps !== undefined) target.scale = ps;
        if (py !== undefined) target.y = py;
        if (px !== undefined) target.x = px - footprint * (ps ?? stagePos.value(atTime).scale);
        stagePos.add(arrivingOnBeat(atTime, dur), target, dur);
        return api;
      },
      /** Moves one dancer to x (rig-local), keeping the other in place; arrives on a beat. */
      step(kind, atTime, dx, dur = 0.6) {
        dancers[kind].state.add(arrivingOnBeat(atTime, dur), { x: dancers[kind].home + dx }, dur);
        return api;
      },
      /**
       * Takes (or releases) the hold on a beat; the free arms take `pose`.
       * style 'promenade' (the default): Test's inner arm around Code's
       * back and her hand on his shoulder, standing close; 'hands': the
       * inner hands joined between them.
       */
      hold(atTime, { pose = 'frame', dur = 0.8, release = false, style = 'promenade' } = {}) {
        keyAll(dur < 0.1 ? atTime : nearestBeat(atTime), (dancer) => ({
          hold: release ? 0 : 1,
          embrace: !release && style === 'promenade' ? 1 : 0,
          [dancer.kind === 'test' ? 'armL' : 'armR']: poseOf(pose)[dancer.kind === 'test' ? 'armL' : 'armR'],
        }), dur);
        return api;
      },
      /**
       * The refactoring showcase, a ballroom presentation: the couple opens
       * out to arm's length, hand in hand; Test presents Code with his free
       * arm opening low to the side, and she takes the spotlight with her
       * free arm raised while the code lines on her gown snap into clean
       * indentation, row by row. They close into the hold again on the beat
       * at `until`.
       */
      showcase(atTime, { until, clean = 1 } = {}) {
        const begin = nearestBeat(atTime);
        const back = nearestBeat(until ?? begin + 2.4);
        const tidyDur = clamp(back - begin - 0.4, 1.1, 2.2);
        keyAll(begin, () => ({ hold: 1, embrace: 0, low: 1 }), 0.5);
        if (dancers.test) dancers.test.state.add(begin, { ...POSES.present, look: 1, face: 'joy', lean: -4 }, 0.5);
        if (dancers.code) {
          dancers.code.state.add(begin, { ...POSES.spotlight, look: 0, face: 'joy', head: -4, lean: 2 }, 0.5);
          dancers.code.state.add(begin + 0.2, { clean }, tidyDur);
        }
        keyAll(back, (dancer) => ({
          hold: 1, embrace: 1, low: 0, lean: 0, head: 0, look: dancer.kind === 'test' ? 1 : -1,
          [dancer.kind === 'test' ? 'armL' : 'armR']: POSES.frame[dancer.kind === 'test' ? 'armL' : 'armR'],
        }), 0.5);
        return api;
      },
      /** The waltz box step (rise, fall, alternating feet) during [from, to). */
      waltz(from, to, { travel = 10, roam = 26, calm = 1 } = {}) {
        waltzes.push({ from, to, travel, roam, calm });
        return api;
      },
      /** Code spins under Test's raised arm: from a beat, for whole beats. */
      twirl(atTime, { dur = 1, turns = 1, who = 'code' } = {}) {
        const start = nearestBeat(atTime);
        const length = wholeBeats(start, dur);
        // The joined hands rise into an arch over her head (see archAt).
        twirls.push({ at: start, dur: length, turns, who });
        return api;
      },
      /**
       * Test dips Code: both rise a little first (the preparation), then Code
       * sinks back in a slow arc that reaches its lowest point on a beat.
       */
      dip(atTime, { dur = 0.9, depth = 1 } = {}) {
        const start = arrivingOnBeat(atTime, dur);
        keyAll(start - 0.35, (dancer) => ({ bob: -3, lean: dancer.kind === 'code' ? -3 : 0 }), 0.35);
        // Test's arm supports her back (the promenade hold) through the dip.
        keyAll(start - 0.35, () => ({ hold: 1, embrace: 1 }), 0.35);
        if (dancers.code) dancers.code.state.add(start, { lean: 26 * depth, head: 12 * depth, bob: 5 * depth, armR: { sh: -150, el: 26 }, face: 'joy' }, dur);
        if (dancers.test) dancers.test.state.add(start, { lean: 11 * depth, head: 8 * depth, bob: 8 * depth, armL: { sh: 118, el: -28 } }, dur);
        return api;
      },
      /** A grounded, supported final dip with long opposing arm lines, held still. */
      finale(atTime, { dur = 1.3 } = {}) {
        api.dip(atTime, { dur, depth: 1.55 });
        const start = arrivingOnBeat(atTime, dur);
        keyAll(start, () => ({ idleMotion: 0, low: 0, look: 0 }), dur);
        if (dancers.test) dancers.test.state.add(start, {
          footL: { dx: -22, lift: 0 }, footR: { dx: 12, lift: 0 },
          armL: { sh: 132, el: -12, wr: 18 }, face: 'joy',
        }, dur);
        if (dancers.code) dancers.code.state.add(start, {
          armR: { sh: -154, el: 12, wr: -20 }, flare: 14, sway: 0.55,
        }, dur);
        return api;
      },
      /** Both stand tall again after a dip or bow, from a beat. */
      rise(atTime, dur = 0.8) {
        keyAll(nearestBeat(atTime), () => ({ lean: 0, head: 0, bob: 0 }), dur);
        return api;
      },
      /**
       * Test bows (right hand to his chest, left arm opening to the side)
       * and Code curtsies (sinking, both hands lifting her skirt), from a beat.
       */
      bow(atTime, { dur = 0.6 } = {}) {
        const at0 = nearestBeat(atTime);
        keyAll(at0, (dancer) => ({ hold: 0, embrace: 0, lean: dancer.kind === 'test' ? 16 : -12, head: dancer.kind === 'test' ? 6 : -8, face: 'smile' }), dur);
        if (dancers.test) dancers.test.state.add(at0, { armR: POSES.bow.armR, armL: { sh: 52, el: -14, wr: 28 } }, dur);
        if (dancers.code) dancers.code.state.add(at0, { armL: { sh: 40, el: 30, wr: 14 }, armR: { sh: -40, el: -30, wr: -14 }, bob: 8 }, dur);
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
