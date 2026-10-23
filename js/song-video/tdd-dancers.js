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
      hipY: -100, shoulder: [20.5, -165], upper: 35.5, fore: 33, hip: 9.5, thigh: 48, shin: 46, foot: 12.5,
    },
    code: {
      hipY: -118, shoulder: [17, -165], upper: 33, fore: 31, chestY: -150, foot: 11,
    },
  };

  /** Arm poses by name; L and R are screen sides. */
  /**
   * Arm poses by name; L and R are screen sides. `wr` bends the wrist: for
   * a left arm, + lifts the hand toward up; for a right arm, − does.
   */
  const POSES = {
    /** Poised: arms rounded a little away from the body, hands soft by the hips. */
    stand: { armL: { sh: 18, el: -30, wr: 12 }, armR: { sh: -18, el: 30, wr: -12 } },
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
    let version = 0;
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
        version++;
      },
      /** Counts the keys added so far, so a cache of derived motion can tell when it is stale. */
      get version() {
        return version;
      },
      /**
       * The keyed state, softened by a short bell-shaped time kernel
       * (±0.21 s): where one move interrupts another, or a quick key
       * starts from rest, the motion carries its momentum through the
       * change instead of hitching. Still a pure function of t.
       */
      value(t) {
        if (!compiled) compile();
        const samples = SMOOTHING.map(([dt]) => raw(t + dt));
        const centre = samples[(SMOOTHING.length - 1) / 2];
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
        // The last key at or before t (keys are sorted by time).
        let current = null;
        let lo = 0;
        let hi = keys.length - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (keys[mid].at <= t) {
            current = keys[mid];
            lo = mid + 1;
          } else hi = mid - 1;
        }
        if (current) out[name] = mix(current.start, current.target, current.curve(clamp((t - current.at) / current.dur, 0, 1)));
      }
      return out;
    }
  }

  /** Binomial kernel offsets (s) and weights for track smoothing. */
  const SMOOTHING = [[-0.21, 1 / 64], [-0.14, 6 / 64], [-0.07, 15 / 64], [0, 20 / 64], [0.07, 15 / 64], [0.14, 6 / 64], [0.21, 1 / 64]];

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

  /**
   * Two-bone IK: rotations that bring a hand from the shoulder to target.
   * Near full extension the reach eases in (it never locks straight in a
   * single frame), so an arm stretching for a target out of reach slows
   * into a long line instead of snapping into it.
   */
  function reach(shoulder, target, upper, fore, bendSign) {
    const dx = target[0] - shoulder[0];
    const dy = target[1] - shoulder[1];
    const full = upper + fore - 0.5;
    const knee = full - 6;
    const span = Math.hypot(dx, dy);
    const d = span <= knee
      ? Math.max(span, Math.abs(upper - fore) + 1)
      : knee + (full - knee) * (1 - Math.exp(-(span - knee) / (full - knee)));
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

  /**
   * A slender glove, fingers together and tapering to soft tips, the thumb
   * resting along the side nearest the body (`thumb`: +1 or -1 in x).
   */
  function glove(parent, size, thumb) {
    const g = svg('g', { class: 'tdd-glove-hand', transform: `scale(${size})` }, parent);
    const x = (v) => f(v * thumb);
    svg('path', {
      class: 'tdd-glove',
      d: `M${x(-3.6)} 0.2 C${x(-4.4)} 3.6 ${x(-4.6)} 7.6 ${x(-3.7)} 10.6 C${x(-3)} 12.8 ${x(-1)} 14.6 ${x(0.8)} 14.2`
        + ` C${x(2.4)} 13.8 ${x(3.4)} 12.2 ${x(3.6)} 10 C${x(3.8)} 8.6 ${x(3.9)} 7.4 ${x(4.1)} 6.6`
        + ` C${x(5.6)} 6.9 ${x(6.8)} 5.8 ${x(6.3)} 4.4 C${x(5.8)} 3 ${x(4.6)} 2.6 ${x(3.9)} 1.6 C${x(3.7)} 1 ${x(3.6)} 0.4 ${x(3.6)} 0.2 Z`,
    }, g);
    svg('path', { class: 'tdd-glove-line', d: `M${x(-1.6)} 9.4 Q${x(-1.7)} 11.4 ${x(-1.3)} 13.1 M${x(0.9)} 9.8 Q${x(1)} 11.7 ${x(1)} 13.3` }, g);
    svg('rect', { class: 'tdd-glove-cuff', x: -4.4, y: -2.4, width: 8.8, height: 3.6, rx: 1.8 }, g);
  }

  /** Limb widths: [shoulder, elbow] for the upper arm, [elbow, wrist] below. */
  const ARM_WIDTHS = { test: [[12, 10.3], [10.3, 8.5]], code: [[10.4, 8], [8, 6.1]] };

  function arm(parent, front, kind, side, body, id) {
    const [sx, sy] = body.shoulder;
    const [upperW, foreW] = ARM_WIDTHS[kind];
    const upperArm = svg('g', { class: `tdd-arm tdd-arm--${kind}` }, parent);
    upperArm.dataset.side = side;
    const outer = side === 'L' ? -1 : 1;
    const upperPath = segmentPath(body.upper, ...upperW);
    if (kind === 'code') svg('path', { class: 'tdd-skin-rim', d: upperPath }, upperArm);
    if (kind === 'test') {
      // His sleeve lies on the coat with no outline across its rounded top,
      // so it merges into the shoulder and the coat's own sloped shoulder
      // line stays the silhouette; its sides keep their outline.
      const top = svg('mask', { id: `${id}-sleeve-top-${side}`, maskUnits: 'userSpaceOnUse', x: -20, y: -20, width: 40, height: body.upper + 40 }, svg('defs', {}, upperArm));
      svg('rect', { class: 'tdd-mask-show', x: -20, y: -20, width: 40, height: body.upper + 40 }, top);
      svg('circle', { class: 'tdd-mask-hide', cx: 0, cy: 0, r: upperW[0] / 2 + 1.2 }, top);
      svg('path', { class: 'tdd-arm-sleeve tdd-arm-sleeve--fill', d: upperPath }, upperArm);
      svg('path', { class: 'tdd-arm-sleeve tdd-arm-sleeve--line', d: upperPath, mask: `url(#${id}-sleeve-top-${side})` }, upperArm);
    } else svg('path', { class: 'tdd-arm-sleeve', d: upperPath }, upperArm);
    // A rim highlight runs down the arm's outer side, pausing at the elbow
    // (where the joint turns away from the light) so the two highlights
    // never cross or overlap as the elbow bends.
    const elbowGap = upperW[1] / 2 + 1.5;
    const reach = [[outer * (upperW[0] / 2 - 2), 4], [outer * (upperW[1] / 2 - 1), body.upper * 0.5], [outer * (upperW[1] / 2 - 1.8), body.upper - elbowGap - 0.8]];
    const quad = ([a, b, c]) => `M${f(a[0])} ${f(a[1])} Q${f(b[0])} ${f(b[1])} ${f(c[0])} ${f(c[1])}`;
    svg('path', { class: 'tdd-arm-shine', d: quad(reach) }, upperArm);
    const foreArm = svg('g', { class: `tdd-forearm tdd-arm--${kind}` }, front);
    foreArm.dataset.side = side;
    const forePath = segmentPath(body.fore, ...foreW);
    if (kind === 'code') svg('path', { class: 'tdd-skin-rim', d: forePath }, foreArm);
    svg('path', { class: 'tdd-arm-fore', d: forePath }, foreArm);
    // Where the forearm overlaps the upper arm, a fill-only copy of the upper
    // arm's end (inset by half its outline) hides the forearm's outline, so
    // the elbow reads as one bent limb rather than two parts. It lives in the
    // forearm's layer, turned back into the upper arm's frame, and is clipped
    // to the forearm (with its outline), so it can only paint where the
    // forearm already covers: where the upper arm passes behind the torso,
    // the patch never draws its silhouette over the coat.
    const clip = svg('clipPath', { id: `${id}-elbow-${kind}-${side}` }, svg('defs', {}, foreArm));
    const stroke = kind === 'test' ? 1.6 : 2.6;
    svg('path', { d: segmentPath(body.fore, foreW[0] + stroke, foreW[1] + stroke) }, clip);
    const elbow = svg('g', {}, svg('g', { 'clip-path': `url(#${id}-elbow-${kind}-${side})` }, foreArm));
    const inset = kind === 'test' ? 1.5 : 1;
    const from = body.upper - elbowGap;
    const width = (k) => upperW[0] + (upperW[1] - upperW[0]) * k - inset;
    svg('path', { class: 'tdd-elbow-patch', d: segmentPath(body.upper - from, width(from / body.upper), width(1)), transform: `translate(0 ${f(from)})` }, elbow);
    svg('path', { class: 'tdd-arm-shine', d: quad([[outer * (foreW[0] / 2 - 2), foreW[0] / 2 + 1], [outer * (foreW[1] / 2 - 0.8), body.fore * 0.5], [outer * (foreW[1] / 2 - 1.4), body.fore - (kind === 'test' ? 8 : 5)]]) }, foreArm);
    if (kind === 'test') {
      svg('rect', { class: 'tdd-cuff', x: -5.6, y: body.fore - 6, width: 11.2, height: 5, rx: 2 }, foreArm);
      svg('circle', { class: 'tdd-cufflink', cx: outer * 3.1, cy: body.fore - 3.5, r: 0.95 }, foreArm);
    }
    const hand = svg('g', { class: 'tdd-hand', transform: `translate(0 ${body.fore + 1})` }, foreArm);
    hand.dataset.side = side;
    hand.dataset.kind = kind;
    glove(hand, kind === 'test' ? 0.92 : 0.8, -outer);
    // Code's puffed cap sleeve sits on top of the shoulder and turns with it.
    const cap = kind === 'code' ? svg('g', {}, front) : null;
    if (cap) {
      svg('path', { class: 'tdd-sleeve-puff', fill: `url(#${id}-gown)`, d: 'M-7.5 3 C-8.5 -5.5 8.5 -5.5 7.5 3 C6.4 9.5 -6.4 9.5 -7.5 3 Z' }, cap);
      svg('path', { class: 'tdd-sleeve-pleat', d: 'M-3.4 -2.4 Q-2.6 2.6 -3.2 7 M0 -3.3 Q0.5 2.6 0 7.8 M3.4 -2.4 Q2.8 2.6 3.3 7' }, cap);
    }
    return {
      /** The arm's two layers, which the troupe may lift into the hold layers. */
      parts: [upperArm, foreArm],
      /** Where the two layers live when the arm is the dancer's own. */
      homes: [parent, front],
      /** The gloved hand, which the hold may draw in front of the partner's arm. */
      hand,

      apply(angles) {
        const x = side === 'L' ? -sx : sx;
        const shoulder = `translate(${x} ${sy}) rotate(${f(angles.sh)})`;
        upperArm.setAttribute('transform', shoulder);
        if (cap) cap.setAttribute('transform', shoulder);
        const fore = `${shoulder} translate(0 ${body.upper}) rotate(${f(angles.el)})`;
        foreArm.setAttribute('transform', fore);
        elbow.setAttribute('transform', `rotate(${f(-angles.el)}) translate(0 ${-body.upper})`);
        // Lifted out of the forearm (see the troupe's hold layers), the hand
        // carries the forearm's transform itself.
        const palm = `translate(0 ${body.fore + 1}) rotate(${f(angles.wr || 0)})`;
        hand.setAttribute('transform', hand.parentNode === foreArm ? palm : `${fore} ${palm}`);
      },
    };
  }

  /**
   * Eyes (with a blink), brows, a nose, and an expression mouth around
   * (0, 0). Each eye has a coloured iris low in it under two glints;
   * `lashes` adds a lined upper lid flicked out at the corner. An open
   * smile shows its upper teeth and tongue.
   */
  function face(parent, { eyeY, eyeX, mouthY, browY, noseY, lashes = false, iris, seed }) {
    const node = svg('g', { class: 'tdd-face' }, parent);
    const eyes = [-eyeX, eyeX].map((x) => {
      const out = x < 0 ? -1 : 1;
      const eye = svg('g', { transform: `translate(${x} ${eyeY})` }, node);
      const ball = svg('g', {}, eye);
      // A dark rim, an iris that is light below and shaded under the lid,
      // a pupil, and two catchlights.
      svg('ellipse', { class: 'tdd-eye', rx: 3.4, ry: 4.4 }, ball);
      svg('ellipse', { class: 'tdd-eye-iris', cx: 0, cy: 0.55, rx: 2.55, ry: 3.3, fill: iris }, ball);
      svg('circle', { class: 'tdd-eye-pupil', cx: 0, cy: 0.8, r: 1.35 }, ball);
      svg('circle', { class: 'tdd-eye-glint', cx: 1.15, cy: -1.25, r: 1.2 }, ball);
      svg('circle', { class: 'tdd-eye-glint tdd-eye-glint--small', cx: -1.05, cy: 2.1, r: 0.5 }, ball);
      if (lashes) {
        // Liner hugging the upper lid, thickening to a small wing at the
        // outer corner, and two fine lashes fanning out above it.
        const x = (v) => f(v * out);
        svg('path', { class: 'tdd-lid', d: `M${x(-3.1)} -1.9 C${x(-2.6)} -5 ${x(2)} -6.2 ${x(3.5)} -3.9 L${x(5.3)} -4.6 L${x(3.3)} -2 C${x(2.6)} -4.6 ${x(-1.6)} -5.1 ${x(-3.1)} -1.9 Z` }, ball);
        svg('path', { class: 'tdd-lash', d: `M${x(1.3)} -5.3 Q${x(1.5)} -6.5 ${x(2.4)} -7 M${x(2.6)} -4.9 Q${x(3)} -6 ${x(4.1)} -6.3` }, ball);
      }
      return ball;
    });
    // Brows taper from a blunt inner end to a fine outer tail.
    const brows = [-eyeX, eyeX].map((x) => {
      const inward = x < 0 ? 1 : -1;
      const inner = x + 4 * inward;
      const outer = x - 4.4 * inward;
      return svg('path', { class: 'tdd-brow', d: `M${f(inner)} ${f(browY + 0.7)} Q${x} ${f(browY - 3.6)} ${f(outer)} ${f(browY + 0.1)} Q${x} ${f(browY - 1.3)} ${f(inner)} ${f(browY - 0.9)} Z` }, node);
    });
    if (noseY !== undefined) svg('path', { class: 'tdd-nose', d: `M0.5 ${f(noseY - 1.1)} Q1.5 ${f(noseY - 0.1)} 0.4 ${f(noseY + 0.7)}` }, node);
    // The open mouth is filled first, then its teeth and tongue, then the lip line on top.
    const mouthGroup = svg('g', { transform: `translate(0 ${mouthY})` }, node);
    const mouthFill = svg('path', { class: 'tdd-mouth-fill' }, mouthGroup);
    const teeth = svg('path', { class: 'tdd-teeth', d: 'M-5.6 -0.75 L5.6 -0.75 Q0 1.5 -5.6 -0.75 Z' }, mouthGroup);
    const tongue = svg('path', { class: 'tdd-tongue', d: 'M-2.7 3.5 Q0 1.4 2.7 3.5 Q0 5 -2.7 3.5 Z' }, mouthGroup);
    const mouth = svg('path', { class: 'tdd-mouth' }, mouthGroup);
    const blinkAt = 1.3 + hash01(seed) * 2.4;
    return {
      apply(t, expression, look) {
        const lookX = look * 2.4;
        const phase = (t + blinkAt) % 4.3;
        const open = phase < 0.13 ? 0.12 : 1;
        eyes.forEach((ball) => ball.setAttribute('transform', `translate(${f(lookX)} 0) scale(1 ${open})`));
        const lift = BROWS[expression] ?? 0;
        brows.forEach((brow, i) => brow.setAttribute('transform', `translate(${f(lookX)} ${lift}) rotate(${(i ? -1 : 1) * (expression === 'worried' ? -8 : expression === 'focus' ? 8 : 0)} ${i ? eyeX : -eyeX} ${browY})`));
        const shape = MOUTHS[expression] || MOUTHS.happy;
        const opened = expression === 'joy' || expression === 'o';
        mouth.setAttribute('d', shape);
        mouthFill.setAttribute('d', opened ? shape : '');
        teeth.setAttribute('opacity', expression === 'joy' ? 1 : 0);
        tongue.setAttribute('opacity', expression === 'joy' ? 1 : 0);
        mouthGroup.setAttribute('transform', `translate(${f(lookX * 0.8)} ${mouthY})`);
        mouth.classList.toggle('is-open', opened);
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
    svg('path', { class: 'tdd-coat-tail-fold', d: 'M-13 -108 C-15 -92 -18 -74 -19.5 -54 M13 -108 C15 -92 18 -74 19.5 -54' }, back);
    const legs = ['L', 'R'].map((side) => {
      const leg = svg('g', { class: 'tdd-leg' }, spin);
      const thigh = svg('path', { class: 'tdd-trouser', fill: `url(#${id}-trouser)` }, leg);
      const stripe = svg('path', { class: 'tdd-trouser-stripe' }, leg);
      const crease = svg('path', { class: 'tdd-trouser-crease' }, leg);
      const fold = svg('path', { class: 'tdd-trouser-break' }, leg);
      // A patent oxford: heel under the ankle, toe turned a little outward.
      const shoe = svg('g', {}, leg);
      const shape = svg('g', { transform: `scale(${side === 'L' ? -1 : 1} 1)` }, shoe);
      svg('path', { class: 'tdd-shoe', d: 'M-6.5 -2 C-7.5 -8 -2 -10.5 3 -9.5 C8 -9 12.5 -7 13 -3.2 C13.4 0 10.5 1.2 6.5 1.2 L-4.2 1.2 C-6.4 1.2 -6.9 0 -6.5 -2 Z' }, shape);
      svg('path', { class: 'tdd-shoe-heel-block', d: 'M-6.4 -1.6 Q-6.6 1.2 -4.2 1.2 L-1.4 1.2 L-1.2 -1.4 Z' }, shape);
      svg('path', { class: 'tdd-shoe-sole', d: 'M-6.2 0.2 L12.6 -0.6' }, shape);
      // The toe cap's seam, and the patent leather's highlights.
      svg('path', { class: 'tdd-shoe-cap', d: 'M7.2 -8.7 Q9 -5 8 -0.2' }, shape);
      svg('path', { class: 'tdd-shoe-shine', d: 'M2 -7.6 Q6 -7.8 9.5 -5.6' }, shape);
      svg('path', { class: 'tdd-shoe-shine tdd-shoe-shine--toe', d: 'M10.6 -5.4 Q11.8 -4.4 11.9 -3' }, shape);
      return { side, thigh, stripe, crease, fold, shoe };
    });
    const upper = svg('g', {}, spin);
    const lean = svg('g', {}, upper);
    // Torso: tailcoat front over a white shirt, gold lapels, bow tie.
    const torso = svg('g', {}, lean);
    const coat = svg('path', { class: 'tdd-coat', fill: `url(#${id}-coat)`, d: 'M-26.5 -167 C-27.5 -171.5 -24.5 -174 -19 -175.8 C-15 -177.2 -11.5 -179.6 -8 -180.4 Q0 -181.6 8 -180.4 C11.5 -179.6 15 -177.2 19 -175.8 C24.5 -174 27.5 -171.5 26.5 -167 C29.5 -152 25 -134 20.5 -122 C19.5 -114 20.5 -106 20 -100 Q0 -95 -20 -100 C-20.5 -106 -19.5 -114 -20.5 -122 C-25 -134 -29.5 -152 -27 -168 Z' }, torso);
    svg('path', { class: 'tdd-coat-shade', d: 'M6 -180.6 Q7 -180.5 8 -180.4 C11.5 -179.6 15 -177.2 19 -175.8 C24.5 -174 27.5 -171.5 26.5 -167 C29.5 -152 25 -134 20.5 -122 C19.5 -114 20.5 -106 20 -100 Q13 -97.5 6 -97 Z' }, torso);
    svg('path', { class: 'tdd-coat-seam', d: 'M-20.5 -122 Q0 -117 20.5 -122' }, torso);
    // Where the coat's two fronts overlap, down from the lapels to the hem.
    svg('path', { class: 'tdd-coat-front', d: 'M-1.2 -131 C-0.9 -118 -1.1 -107 -1.6 -97.6' }, torso);
    // The upper arms sit on the coat, under the shirt front, lapels, bow
    // tie, and badge, which lie on top of the sleeves' shoulders; the
    // forearms (and anything a hand reaches across) come in front of all.
    const upperArms = svg('g', { class: 'tdd-arms-upper' }, lean);
    const front = svg('g', {}, lean);
    svg('path', { class: 'tdd-shirt', d: 'M-11 -177 L0 -128 L11 -177 Q0 -180 -11 -177 Z' }, front);
    for (const y of [-163, -152]) svg('circle', { class: 'tdd-stud', cx: 0, cy: y, r: 1.3 }, front);
    svg('path', { class: 'tdd-lapel', fill: `url(#${id}-satin)`, d: 'M-11 -177 L-2 -132 L-16 -156 L-12 -162 L-19 -170 Z' }, front);
    svg('path', { class: 'tdd-lapel tdd-lapel--shade', d: 'M11 -177 L2 -132 L16 -156 L12 -162 L19 -170 Z' }, front);
    for (const y of [-124, -114]) {
      svg('circle', { class: 'tdd-button', cx: 0, cy: y, r: 1.9 }, front);
      svg('circle', { class: 'tdd-button-shine', cx: -0.6, cy: y - 0.6, r: 0.6 }, front);
    }
    // A satin edge where each lapel rolls over.
    svg('path', { class: 'tdd-lapel-edge', d: 'M-11 -177 L-2 -132 M11 -177 L2 -132' }, front);
    svg('path', { class: 'tdd-bowtie', d: 'M0 -175 L-10 -181 L-10 -168 Z M0 -175 L10 -181 L10 -168 Z' }, front);
    // Folds pinched into each wing of the bow tie.
    svg('path', { class: 'tdd-bowtie-fold', d: 'M-3 -175 L-8 -177.5 M-3 -175 L-8 -172 M3 -175 L8 -177.5 M3 -175 L8 -172' }, front);
    svg('rect', { class: 'tdd-bowtie-knot', x: -3, y: -178, width: 6, height: 6, rx: 1.5 }, front);
    const badge = svg('g', { class: 'tdd-badge', transform: 'translate(14 -146)' }, front);
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
    // Glass depth: a soft inner rim low on the dome.
    svg('path', { class: 'tdd-lamp-refraction', d: 'M-21 -206 Q-20 -196 -10 -191' }, dome);
    const faceGroup = svg('g', { transform: 'translate(0 -210)' }, dome);
    const faceRig = face(faceGroup, { eyeX: 8, eyeY: -5, mouthY: 7, browY: -12, iris: `url(#${id}-iris)`, seed: uid * 7 + 11 });
    // His sleeves lie on the tailcoat (so a hanging elbow beside the coat's
    // edge reads as one limb), under the lapels; each forearm comes in front.
    const frontArms = svg('g', { class: 'tdd-arms-front' }, lean);
    const arms = { L: arm(upperArms, frontArms, 'test', 'L', body, id), R: arm(upperArms, frontArms, 'test', 'R', body, id) };

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
      // A soft break where the trouser hem rests on the shoe.
      const above = [ankle[0] - (ankle[0] - knee[0]) * 0.12, ankle[1] - (ankle[1] - knee[1]) * 0.12];
      const fold = `M${pt(side(above, n2, wAnkle / 2, 0.92))} Q${pt([above[0], above[1] + 2.4])} ${pt(side(above, n2, wAnkle / 2, -0.92))}`;
      return { outline, stripe, crease, fold };
    }

    return {
      body,
      root,
      arms,
      coat,
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
          // Rising, the heel lifts and the shoe rolls over its toe, carrying
          // the ankle up and forward; a lifted foot points its toe down.
          const rise = (foot.rise || 0) * 18;
          const point = foot.lift * 2.2;
          const footX = sign * body.foot + foot.dx;
          const ankle = rotateAbout([0, -8], [sign * 10, 0.8], sign * rise);
          const tip = [footX + ankle[0], ankle[1] - foot.lift];
          const { outline, stripe, crease, fold } = legShape(hip, tip, sign);
          leg.crease.setAttribute('d', crease);
          leg.fold.setAttribute('d', fold);
          leg.thigh.setAttribute('d', outline);
          leg.stripe.setAttribute('d', stripe);
          leg.shoe.setAttribute('transform', `translate(${f(footX)} ${f(-foot.lift)}) rotate(${f(sign * rise)} ${sign * 10} 0.8) rotate(${f(sign * point)} 0 -8)`);
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

  /** Code's gown is ankle-length: the hem's sides hang this high off the floor. */
  const HEM_SIDE = -22;
  /** The hem is a circle on the floor seen from a little above: its near side dips this share of its radius below its sides. */
  const HEM_PERSPECTIVE = 0.1;
  /** Scallops around the hem's full circle (about half of them face the viewer). */
  const HEM_WAVES = 5;
  /** Soft folds fall from the waist at these angles around the skirt (radians, 0 faces the viewer). */
  const GOWN_FOLDS = Array.from({ length: 7 }, (_, i) => 0.35 + (i * 2 * Math.PI) / 7);
  /** Spacing of the gown's code rows. */
  const ROW_STEP = 10.8;
  /** Code's bodice, its satin highlight, and its seams, upright (bent per frame by bendPath). */
  const BODICE = {
    bodice: 'M-18.5 -166 C-19.5 -171 -12 -172 -8 -170 Q0 -166 8 -170 C12 -172 19.5 -171 18.5 -166 C20 -150 15 -134 11.5 -118 L-11.5 -118 C-15 -134 -20 -150 -18.5 -166 Z',
    sheen: 'M-16.5 -165 C-17.5 -151 -14 -135 -10.5 -119.5 L-5 -119.5 C-7 -135 -9 -151 -8 -167.5 Z',
    seams: 'M-6 -160 Q-4 -138 -3 -120 M6 -160 Q4 -138 3 -120',
  };

  /**
   * Bends a path (absolute M/L/Q/C/Z commands) along the spine: points from
   * the chest up turn fully by `deg` about (0, chestY), points at the waist
   * stay put, and the ribs between follow smoothly.
   */
  function bendPath(d, deg, chestY) {
    if (!deg) return d;
    const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g);
    const pair = [];
    let out = '';
    for (const token of tokens) {
      if (/[A-Za-z]/.test(token)) {
        out += token;
        continue;
      }
      pair.push(Number(token));
      if (pair.length < 2) continue;
      const [x, y] = pair.splice(0);
      const k = deg * ease.inOut(clamp((chestY + 18 - y) / 24, 0, 1));
      const [bx, by] = rotateAbout([x, y], [0, chestY], k);
      out += `${f(bx)} ${f(by)} `;
    }
    return out.trim();
  }

  /** A point on a cubic Bézier (four [x, y] points) at t. */
  function cubicAt([p0, p1, p2, p3], t) {
    const u = 1 - t;
    return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
  }

  /** Where Code's inner (left) shoulder is, in the troupe's floor coordinates. */
  function heldShoulder(s, body) {
    const p = rotateAbout(rotateAbout([-body.shoulder[0], body.shoulder[1]], [0, body.chestY], s.arch || 0), [0, body.hipY], s.lean);
    return [s.x + s.spin * p[0], s.y + s.bob + p[1]];
  }

  /** An angle wrapped into (-π, π]. */
  const wrapAngle = (a) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI));

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
    // The gown hangs from the waist on its own layer: a round skirt keeps
    // its silhouette while she turns, and only the cloth's pattern travels
    // around it. The bodice, arms, and head turn on `spin`.
    const gown = svg('g', {}, root);
    // Legs and slippers stand behind the gown, so only the ankles and
    // slippers show beneath the hem.
    const shoes = svg('g', {}, gown);
    const feet = ['L', 'R'].map((side, i) => {
      const m = i ? 1 : -1;
      // A soft contact shadow stays on the floor and fades as the foot lifts.
      const contact = svg('ellipse', { class: 'tdd-foot-contact', cx: m * 11.5, cy: -0.2, rx: 7.5, ry: 1.5 }, shoes);
      const leg = svg('g', { class: 'tdd-code-leg' }, shoes);
      const rim = svg('path', { class: 'tdd-skin-rim' }, leg);
      const skin = svg('path', { class: 'tdd-code-shin' }, leg);
      // The hem's shadow falls across the ankles.
      const shade = svg('path', { class: 'tdd-code-shin-shade', fill: `url(#${id}-legshade)` }, leg);
      const shine = svg('path', { class: 'tdd-code-shin-shine' }, leg);
      const node = svg('g', {}, shoes);
      // A gold satin court shoe, its toe turned out: a slim heel, the heel
      // counter behind, a low vamp that shows the instep, a pointed toe, and
      // an ankle strap with a small buckle. The parts are outlined together
      // first and filled on top, so they read as one shoe.
      const x = (v) => f(m * v);
      const heel = `M${x(5.6)} -2.6 L${x(7.8)} -2.6 L${x(7.2)} -0.15 L${x(6.3)} -0.15 Z`;
      const counter = `M${x(4.8)} -6.1 C${x(4.2)} -4.4 ${x(4.6)} -2.4 ${x(6)} -1.7 L${x(8.5)} -1.5 L${x(8.2)} -4.8 C${x(7.2)} -5.4 ${x(6)} -6.3 ${x(4.8)} -6.1 Z`;
      const toe = `M${x(13)} -5.1 C${x(16.2)} -4.6 ${x(18.6)} -2.6 ${x(18.5)} -1.1 C${x(18.3)} -0.2 ${x(15.4)} -0.2 ${x(12.6)} -0.5 Z`;
      svg('path', { class: 'tdd-shoe-heel', d: heel }, node);
      svg('path', { class: 'tdd-code-instep', d: `M${x(8.6)} -9.2 C${x(8.4)} -7.4 ${x(7.4)} -5.8 ${x(6.6)} -4.6 L${x(14.6)} -4.6 C${x(13.2)} -5.6 ${x(12.6)} -7.4 ${x(12.8)} -9.2 Z` }, node);
      for (const d of [counter, toe]) svg('path', { class: 'tdd-shoe-outline', d }, node);
      svg('ellipse', { class: 'tdd-shoe-outline', cx: m * 11, cy: -3, rx: 5.6, ry: 2.4 }, node);
      for (const d of [counter, toe]) svg('path', { class: 'tdd-shoe-satin', fill: `url(#${id}-shoe)`, d }, node);
      svg('ellipse', { class: 'tdd-slipper', fill: `url(#${id}-shoe)`, cx: m * 11, cy: -3, rx: 5.6, ry: 2.4 }, node);
      svg('path', { class: 'tdd-slipper-sole', d: `M${x(6)} -1.2 C${x(9)} -0.4 ${x(14)} -0.1 ${x(18.1)} -0.6` }, node);
      svg('path', { class: 'tdd-slipper-shine', d: `M${x(8)} -4.3 Q${x(12)} -5.3 ${x(16)} -3.5` }, node);
      svg('path', { class: 'tdd-slipper-strap', d: `M${x(8.3)} -9 Q${x(10.7)} -7.7 ${x(13.1)} -9` }, node);
      svg('rect', { class: 'tdd-shoe-buckle', x: f(m * 12.5 - 0.9), y: -9.8, width: 1.8, height: 1.5, rx: 0.35 }, node);
      return { side, m, contact, rim, skin, shade, shine, node };
    });
    const gownDefs = svg('defs', {}, gown);
    const skirtClip = svg('clipPath', { id: `${id}-skirt` }, gownDefs);
    const clipShape = svg('path', {}, skirtClip);
    // The hem's shadow on the ankles follows the hem as it lifts.
    const legShade = svg('linearGradient', { id: `${id}-legshade`, class: 'tdd-legshade-grad', gradientUnits: 'userSpaceOnUse', x1: 0, y1: -24, x2: 0, y2: -10 }, gownDefs);
    svg('stop', { class: 'tdd-stop--top', offset: 0 }, legShade);
    svg('stop', { class: 'tdd-stop--bottom', offset: 1 }, legShade);
    const petticoat = svg('path', { class: 'tdd-petticoat' }, gown);
    const skirt = svg('path', { class: 'tdd-gown', fill: `url(#${id}-gown)` }, gown);
    // Satin catches the light down the left flank; the right falls into shade.
    const skirtSheen = svg('path', { class: 'tdd-gown-sheen', fill: `url(#${id}-sheen)`, 'clip-path': `url(#${id}-skirt)` }, gown);
    const skirtShade = svg('path', { class: 'tdd-gown-fold', 'clip-path': `url(#${id}-skirt)` }, gown);
    // Soft folds fall from the waist through the skirt and turn with it.
    const skirtFolds = GOWN_FOLDS.map(() => svg('path', { class: 'tdd-gown-crease', 'clip-path': `url(#${id}-skirt)` }, gown));
    const page = svg('g', { 'clip-path': `url(#${id}-skirt)` }, gown);
    // Messy code is spaghetti: rows out of order, at the wrong indentation
    // and tilted; inside each row, tokens scattered, turned, and of uneven
    // length. Clean code is one neat row per line. Every offset is seeded,
    // so the mess is the same on every seek, and all of it collapses to zero
    // as the code is cleaned.
    const ORDER = [2, 0, 5, 1, 7, 3, 6, 4];
    const rows = CODE_ROWS.map((row, i) => {
      const y = -106 + i * ROW_STEP;
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
        group, y, indent: row.indent, bars, width: x - 4,
        jitter: (hash01(i * 17 + 3) - 0.5) * 40,
        tilt: (hash01(i * 29 + 5) - 0.5) * 30,
        // Out of order: a messy row sits on another row's line, nudged off it.
        drop: (ORDER[i] - i) * ROW_STEP + (hash01(i * 13 + 7) - 0.5) * 6,
      };
    });
    // A bright band sweeps down the gown with the rows as they snap clean.
    const sweep = svg('rect', { class: 'tdd-tidy-sweep', x: -80, y: -9, width: 160, height: 18, fill: `url(#${id}-sweep)`, opacity: 0 }, page);
    // A satin band just inside the hem follows its scallops.
    const hemTrim = svg('path', { class: 'tdd-gown-trim', 'clip-path': `url(#${id}-skirt)` }, gown);
    const hem = svg('path', { class: 'tdd-gown-hem' }, gown);
    const spin = svg('g', {}, root);
    const sparkles = SPARKLES.map(([x, y, r]) => ({ x, y, r, node: svg('path', { class: 'tdd-sparkle', d: SPARKLE, opacity: 0 }, root) }));
    // The hem stays on the floor; the waist and everything above it ride on
    // `upper`, so the gown stretches and gathers with the rise and fall.
    const upper = svg('g', {}, spin);
    const lean = svg('g', {}, upper);
    // Her spine curves: the chest, shoulders, arms, and head turn on the
    // chest groups about body.chestY, and the bodice bends between the
    // chest and the waist (see bendPath), so her top line arcs instead of
    // tilting as one plank.
    const chestBack = svg('g', {}, lean);
    const bodiceParts = [
      [svg('path', { class: 'tdd-bodice', fill: `url(#${id}-gown)` }, lean), BODICE.bodice],
      [svg('path', { class: 'tdd-bodice-sheen', fill: `url(#${id}-sheen)` }, lean), BODICE.sheen],
      [svg('path', { class: 'tdd-bodice-seam' }, lean), BODICE.seams],
    ];
    svg('rect', { class: 'tdd-sash', x: -14, y: -123, width: 28, height: 8, rx: 3 }, lean);
    svg('path', { class: 'tdd-sash-sheen', d: 'M-11 -121 H6' }, lean);
    for (const d of [
      'M11.6 -117.6 C13 -112 13.4 -106 12.6 -100.5 L15.4 -101.6 C15.6 -107 14.8 -113 12.8 -117.8 Z',
      'M11 -120.5 C14 -127.5 20.5 -128.5 21 -123.8 C21.3 -120.6 16 -119.6 11 -120 Z',
      'M11 -119.2 C15.5 -118.6 21 -117.4 20.4 -113.8 C19.8 -110.8 14.6 -114 11 -118 Z',
    ]) svg('path', { class: 'tdd-sash-bow', d }, lean);
    svg('path', { class: 'tdd-sash-bow-sheen', d: 'M13.4 -122.6 Q17 -126.4 19.6 -124.4' }, lean);
    svg('rect', { class: 'tdd-sash-knot', x: 9.2, y: -122.6, width: 4, height: 5, rx: 1.4 }, lean);
    const chestFront = svg('g', {}, lean);
    const neckPath = 'M-3 -181 L3 -181 L4.2 -168.5 Q0 -166.5 -4.2 -168.5 Z';
    svg('path', { class: 'tdd-skin-rim', d: neckPath }, chestFront);
    svg('path', { class: 'tdd-paper', d: neckPath }, chestFront);
    svg('path', { class: 'tdd-neck-shadow', d: 'M-3 -181 L3 -181 L3.3 -177 Q0 -175.6 -3.3 -177 Z' }, chestFront);
    // A strand of pearls on a fine gold chain rests on her collarbones, with
    // a violet teardrop in a gold bezel at its centre that sways as she moves.
    const strand = [[-9.6, -170.4], [-7.4, -163.2], [7.4, -163.2], [9.6, -170.4]];
    svg('path', { class: 'tdd-necklace-chain', d: `M${strand[0].join(' ')} C${strand.slice(1).map((p) => p.join(' ')).join(' ')}` }, chestFront);
    for (let i = 1; i <= 9; i++) {
      const [x, y] = cubicAt(strand, i / 10);
      svg('circle', { class: 'tdd-necklace-pearl', cx: f(x), cy: f(y), r: 1.05, fill: `url(#${id}-pearl)` }, chestFront);
    }
    const pendant = svg('g', {}, chestFront);
    svg('circle', { class: 'tdd-pendant-bail', cx: 0, cy: -163.1, r: 0.75 }, pendant);
    svg('path', { class: 'tdd-pendant-gem', fill: `url(#${id}-gem)`, d: 'M0 -162.5 C1.9 -160.3 2.1 -158.3 0 -157.4 C-2.1 -158.3 -1.9 -160.3 0 -162.5 Z' }, pendant);
    svg('circle', { class: 'tdd-pendant-glint', cx: -0.6, cy: -160.4, r: 0.45 }, pendant);
    // The head: a page with a folded corner, a face, and brace clips.
    const head = svg('g', {}, chestFront);
    svg('path', { class: 'tdd-page', fill: `url(#${id}-page)`, d: 'M-21 -231 H10 L22 -219 V-184 Q22 -178 16 -178 H-15 Q-21 -178 -21 -184 Z' }, head);
    svg('path', { class: 'tdd-page-fold', d: 'M10 -231 V-222 Q10 -219 13 -219 H22 Z' }, head);
    svg('line', { class: 'tdd-page-rule', x1: -15, y1: -224, x2: 2, y2: -224 }, head);
    // The page's own faint ruled lines, and the shadow under its folded corner.
    for (const y of [-188, -183]) svg('line', { class: 'tdd-page-line', x1: -16, y1: y, x2: 17, y2: y }, head);
    svg('path', { class: 'tdd-page-fold-shadow', d: 'M10 -222 Q10 -219 13 -219 H22 V-217 H12 Q9 -217 9 -220 Z' }, head);
    const blushes = [];
    for (const side of [-1, 1]) {
      blushes.push(svg('circle', { class: 'tdd-blush', cx: side * 12, cy: -195, r: 4.6, fill: `url(#${id}-blush)` }, head));
      const d = side < 0
        ? 'M-26 -222 Q-31 -222 -31 -216 V-210 Q-31 -205 -35 -205 Q-31 -205 -31 -200 V-194 Q-31 -188 -26 -188'
        : 'M26 -222 Q31 -222 31 -216 V-210 Q31 -205 35 -205 Q31 -205 31 -200 V-194 Q31 -188 26 -188';
      // A wider under-stroke gives dark hair a thin rim without changing its color.
      svg('path', { class: 'tdd-brace-rim', d }, head);
      svg('path', { class: 'tdd-brace', d }, head);
      svg('path', { class: 'tdd-brace-shine', d, transform: 'translate(-0.7 -0.7)' }, head);
    }
    // Pearl drops hang from the page's edges on short gold links; they
    // keep hanging straight down as she tilts, and swing as she moves.
    const pearls = [-1, 1].map((side) => {
      const pivot = [side * 21.8, -192.4];
      const ring = svg('g', { class: 'tdd-earring' }, head);
      svg('circle', { class: 'tdd-earring-stud', cx: pivot[0], cy: pivot[1], r: 1.1 }, ring);
      const drop = svg('g', {}, ring);
      svg('path', { class: 'tdd-earring-link', d: `M${pivot[0]} ${f(pivot[1] + 0.9)} V${f(pivot[1] + 3.3)}` }, drop);
      svg('circle', { class: 'tdd-pearl', cx: pivot[0], cy: f(pivot[1] + 5.7), r: 2.5, fill: `url(#${id}-pearl)` }, drop);
      svg('circle', { class: 'tdd-pearl-glint', cx: f(pivot[0] - 0.8), cy: f(pivot[1] + 4.8), r: 0.65 }, drop);
      return { side, pivot, drop };
    });
    const faceGroup = svg('g', { transform: 'translate(0 -202)' }, head);
    const faceRig = face(faceGroup, { eyeX: 8, eyeY: -2, mouthY: 9, browY: -9, noseY: 4, lashes: true, iris: `url(#${id}-iris-code)`, seed: uid * 7 + 23 });
    // Upper arms emerge from behind the torso; bent forearms, cuffs, and
    // palms sit in front. Both layers turn with the chest.
    const rearArms = svg('g', { class: 'tdd-arms-rear' }, chestBack);
    const frontArms = svg('g', { class: 'tdd-arms-front' }, chestFront);
    const arms = { L: arm(rearArms, frontArms, 'code', 'L', body, id), R: arm(rearArms, frontArms, 'code', 'R', body, id) };

    /**
     * The gown from the waist (which rises and falls at waistY, and narrows
     * to the waist's depth as she turns side-on) to an ankle-length hem.
     * The hem is a circle seen from a little above, so its near side dips
     * below its sides; its scallops belong to the cloth, so they travel
     * around the skirt as it turns (by `turn`), bunching up toward the
     * sides. A lifted foot carries the hem up with it ({ x, lift } each).
     * Returns the outline and the hem's point at any angle around it.
     */
    function skirtShape(sway, flare, waistY, waist, turn, steps, drop = 0) {
      const hw = 54 + flare + drop * 0.6;
      const sx = sway * 9;
      // A swirling skirt lifts off the floor as it flares.
      const side = HEM_SIDE - flare * 0.3 + drop;
      const amp = 3 + flare * 0.05;
      const hemAt = (a) => {
        const x = sx + hw * Math.sin(a);
        const kick = steps.reduce((sum, step) => sum + 0.7 * step.lift * Math.exp(-(((x - step.x) / 15) ** 2)), 0);
        return [x, side + HEM_PERSPECTIVE * hw * Math.cos(a) + amp * Math.cos(HEM_WAVES * (a - turn)) - kick];
      };
      const points = Array.from({ length: 25 }, (_, i) => hemAt(-Math.PI / 2 + (Math.PI * i) / 24));
      const wx = 11.5 * waist;
      const hip = 22 * (0.4 + 0.6 * waist);
      const left = points[0];
      const d = `M${f(-wx)} ${f(waistY)} C${f(-hip)} -82 ${f(-hw * 0.82 + sx * 0.5)} -48 ${f(left[0])} ${f(left[1])}`
        + smoothThrough(points)
        + ` C${f(hw * 0.82 + sx * 0.5)} -48 ${f(hip)} -82 ${f(wx)} ${f(waistY)} Z`;
      const band = points.map(([x, y]) => [sx + (x - sx) * 0.985, y - 4.2]);
      const trim = `M${f(band[0][0])} ${f(band[0][1])}${smoothThrough(band)}`;
      return { d, trim, hemAt, hw, sx, front: side + HEM_PERSPECTIVE * hw };
    }

    /** Cubic Béziers through points (Catmull-Rom), continuing a path at the first point. */
    function smoothThrough(points) {
      let d = '';
      for (let i = 0; i < points.length - 1; i++) {
        const [p0, p1, p2, p3] = [points[Math.max(0, i - 1)], points[i], points[i + 1], points[Math.min(points.length - 1, i + 2)]];
        d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
      }
      return d;
    }

    /** A slim leg from inside the skirt down to the ankle: a soft calf, then a narrow ankle. */
    function shin(top, ankle, m) {
      const dx = ankle[0] - top[0];
      const dy = ankle[1] - top[1];
      const len = Math.hypot(dx, dy) || 1;
      // Away from the other leg.
      const out = [(m * dy) / len, (-m * dx) / len];
      const at = (k, w) => [top[0] + dx * k + out[0] * w, top[1] + dy * k + out[1] * w];
      const pt = ([x, y]) => `${f(x)} ${f(y)}`;
      const outline = `M${pt(at(0, 4.4))} C${pt(at(0.32, 5.4))} ${pt(at(0.7, 3.4))} ${pt(at(0.97, 2.3))}`
        + ` Q${pt(at(1.06, 0))} ${pt(at(0.97, -2.3))}`
        + ` C${pt(at(0.72, -2.9))} ${pt(at(0.34, -4.6))} ${pt(at(0, -4.2))} Z`;
      // The light comes from the left: a soft highlight down the shin.
      const shine = `M${pt(at(0.5, -m * 1.3))} Q${pt(at(0.74, -m * 1))} ${pt(at(0.92, -m * 0.6))}`;
      return { outline, shine };
    }

    return {
      body,
      root,
      arms,
      /**
       * The frame her inner arm hangs in while it is held (troupe floor
       * coordinates): pinned at her shoulder as her body turns, but never
       * narrowed with the body, so an arm raised to her partner keeps its
       * length while she turns beneath it. Front-on it is exactly her body's
       * own frame.
       */
      armFrame: (s) => {
        const [sx, sy] = heldShoulder(s, body);
        const [px, py] = [-body.shoulder[0], body.shoulder[1]];
        return `translate(${f(sx)} ${f(sy)}) rotate(${f(s.lean + (s.arch || 0))}) translate(${f(-px)} ${f(-py)})`;
      },
      apply(t, s) {
        root.setAttribute('transform', `translate(${f(s.x)} ${f(s.y)})`);
        shadow.setAttribute('rx', f(46 + s.flare * 0.5 + s.bob * 0.4));
        spin.setAttribute('transform', `scale(${f(s.spin)} 1)`);
        upper.setAttribute('transform', `translate(0 ${f(s.bob)})`);
        lean.setAttribute('transform', `rotate(${f(s.lean)} 0 ${body.hipY})`);
        const arch = s.arch || 0;
        const chest = `rotate(${f(arch)} 0 ${body.chestY})`;
        chestBack.setAttribute('transform', chest);
        chestFront.setAttribute('transform', chest);
        for (const [node, template] of bodiceParts) node.setAttribute('d', bendPath(template, arch, body.chestY));
        // The feet turn with the body; a lifted foot points its toe.
        shoes.setAttribute('transform', `scale(${f(s.spin)} 1)`);
        for (const foot of feet) {
          const { dx, lift } = s[`foot${foot.side}`];
          const { outline, shine } = shin([foot.m * 6.5 + dx * 0.35, -62], [foot.m * 10.5 + dx, -5.5 - lift], foot.m);
          foot.rim.setAttribute('d', outline);
          foot.skin.setAttribute('d', outline);
          foot.shade.setAttribute('d', outline);
          foot.shine.setAttribute('d', shine);
          foot.node.setAttribute('transform', `translate(${f(dx)} ${f(-lift)}) rotate(${f(foot.m * lift * 1.6)} ${foot.m * 11} -3)`);
          foot.contact.setAttribute('transform', `translate(${f(dx)} 0)`);
          foot.contact.setAttribute('opacity', f(clamp(1 - lift / 7, 0, 1)));
        }
        const waistY = body.hipY + 2 + s.bob;
        const waist = Math.min(1, Math.abs(s.spin));
        const skirtTurn = wrapAngle(s.turnSkirt || 0);
        const steps = feet.map((foot) => ({ x: (foot.m * 11 + s[`foot${foot.side}`].dx) * s.spin, lift: s[`foot${foot.side}`].lift }));
        const shape = skirtShape(s.sway, s.flare, waistY, waist, skirtTurn, steps);
        // The petticoat hangs a little lower and its ruffles sit between the gown's scallops.
        petticoat.setAttribute('d', skirtShape(s.sway * 0.85, s.flare * 0.9, waistY + 4, waist, skirtTurn * 0.92 + Math.PI / HEM_WAVES, steps, 2.8).d);
        skirt.setAttribute('d', shape.d);
        clipShape.setAttribute('d', shape.d);
        hem.setAttribute('d', shape.d);
        hemTrim.setAttribute('d', shape.trim);
        legShade.setAttribute('y1', f(shape.front - 6));
        legShade.setAttribute('y2', f(shape.front + 6));
        // In a turn the waist turns with the body and the hem a moment
        // later, so the folds (and the code) twist around the skirt and
        // untwist as it settles.
        const bodyTurn = s.turn || 0;
        const turnedAt = (down) => wrapAngle(bodyTurn + ((s.turnSkirt || 0) - bodyTurn) * down);
        GOWN_FOLDS.forEach((angle, i) => {
          const a = wrapAngle(angle + skirtTurn);
          const facing = Math.cos(a);
          skirtFolds[i].setAttribute('opacity', f(clamp((facing - 0.08) / 0.3, 0, 1)));
          if (facing <= 0.08) return;
          const [bx, by] = shape.hemAt(a);
          const top = angle + turnedAt(0);
          const middle = angle + turnedAt(0.55);
          skirtFolds[i].setAttribute('d', `M${f(11.5 * waist * Math.sin(top) * 0.8)} ${f(waistY + 6)} Q${f(shape.hw * 0.55 * Math.sin(middle) + s.sway * 4)} -64 ${f(bx)} ${f(by - 3)}`);
        });
        skirtSheen.setAttribute('d', `M-4 ${f(waistY)} C-14 -86 ${f(-shape.hw * 0.72 + shape.sx)} -52 ${f(-shape.hw * 0.64 + shape.sx)} 4 L${f(-shape.hw * 0.18 + shape.sx)} 4 C${f(-shape.hw * 0.16 + shape.sx * 0.5)} -50 -6 -86 0 ${f(waistY)} Z`);
        // The light comes from the left, so the right flank is in shadow
        // (clipped to the skirt, it follows the hem wherever it swings).
        skirtShade.setAttribute('d', `M2 ${f(waistY)} C14 -84 ${f(shape.hw + shape.sx + 10)} -50 ${f(shape.hw + shape.sx + 10)} 4 L${f(20 + s.sway * 7)} 4 C16 -40 8 -80 2 ${f(waistY)} Z`);
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
          const down = (row.y - body.hipY) / (HEM_SIDE - body.hipY);
          const halfWidth = 12 + down * (40 + s.flare * 0.8);
          const tidyX = -halfWidth + 7 + row.indent * 8 + s.sway * 9 * ((row.y - body.hipY) / 110);
          const x = tidyX + mess * row.jitter + restless * 1.5;
          const y = row.y + mess * row.drop;
          const tilt = mess * row.tilt + restless * 2.5;
          let transform = `translate(${f(x)} ${f(y + s.bob * (1 - down))}) rotate(${f(tilt)})`;
          let shown = 1;
          if (s.turn || s.turnSkirt) {
            // The code is printed on the round skirt: as it turns, each row
            // slides around the cloth, narrowing toward the side and passing
            // out of sight behind it.
            const radius = halfWidth + 4;
            const centre = x + row.width / 2;
            const a = Math.asin(clamp(centre / radius, -0.95, 0.95));
            const b = a + turnedAt(down);
            const squeeze = Math.max(0.02, Math.cos(b)) / Math.cos(a);
            transform = `translate(${f(radius * Math.sin(b) - centre * squeeze)} 0) scale(${f(squeeze)} 1) ${transform}`;
            shown = clamp(Math.cos(b) / 0.3, 0, 1);
          }
          row.group.setAttribute('transform', transform);
          row.group.setAttribute('opacity', f(shown));
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
          spark.node.setAttribute('transform', `translate(${f(spark.x)} ${f(spark.y + s.bob)}) rotate(${f(life * 90)}) scale(${f(Math.max(0.01, size))})`);
        });
        // Spotting: in a turn the head keeps its own facing (headSpin, its
        // width as seen from the front) while the body turns under it. The
        // head is unscaled from the body's turn, then given its own, about
        // the same upright axis.
        const headScale = (s.headSpin ?? s.spin) / s.spin;
        head.setAttribute('transform', headScale === 1
          ? `rotate(${f(s.head)} 0 -176)`
          : `rotate(${f(-arch)} 0 ${body.chestY}) rotate(${f(-s.lean)} 0 ${body.hipY}) scale(${f(headScale)} 1) rotate(${f(s.lean)} 0 ${body.hipY}) rotate(${f(arch)} 0 ${body.chestY}) rotate(${f(s.head)} 0 -176)`);
        // Facing away, the face is out of sight: only the back of the page shows.
        const facing = f(clamp((Math.cos(s.turnHead || 0) + 0.25) / 0.4, 0, 1));
        faceGroup.setAttribute('opacity', facing);
        for (const blush of blushes) blush.setAttribute('opacity', facing);
        // The pearls hang plumb whatever the head's tilt, swing behind the
        // motion, and fly outward in a turn.
        for (const pearl of pearls) {
          const angle = (s.earSwing || 0) - s.lean - arch - s.head - pearl.side * (s.earFling || 0);
          pearl.drop.setAttribute('transform', `rotate(${f(angle)} ${pearl.pivot[0]} ${pearl.pivot[1]})`);
        }
        // The pendant lies against her chest, so it swings only a little.
        pendant.setAttribute('transform', `rotate(${f(0.35 * (s.earSwing || 0))} 0 -163.1)`);
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
    stops(svg('linearGradient', { id: `${id}-sheen`, class: 'tdd-sheen-grad', x1: 0, y1: 0, x2: 1, y2: 0 }, node), ['edge', 'core', 'edge']);
    stops(svg('linearGradient', { id: `${id}-shoe`, class: 'tdd-shoe-grad', x1: 0, y1: 0, x2: 0.3, y2: 1 }, node), ['top', 'bottom']);
    stops(svg('radialGradient', { id: `${id}-pearl`, class: 'tdd-pearl-grad', cx: 0.36, cy: 0.32, r: 0.75 }, node), ['core', 'mid', 'edge']);
    stops(svg('radialGradient', { id: `${id}-blush`, class: 'tdd-blush-grad' }, node), ['core', 'edge']);
    stops(svg('radialGradient', { id: `${id}-gem`, class: 'tdd-gem-grad', cx: 0.4, cy: 0.35, r: 0.8 }, node), ['core', 'mid', 'edge']);
    stops(svg('radialGradient', { id: `${id}-iris`, class: 'tdd-iris-grad', cx: 0.5, cy: 0.78, r: 0.75 }, node), ['core', 'mid', 'edge']);
    stops(svg('radialGradient', { id: `${id}-iris-code`, class: 'tdd-iris-grad tdd-iris-grad--code', cx: 0.5, cy: 0.78, r: 0.75 }, node), ['core', 'mid', 'edge']);
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
    x: 0, y: 0, bob: 0, lean: 0, arch: 0, head: 0, spin: 1, look: 0, face: 'happy', lamp: 'idle',
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
  /**
   * How far each dancer stands from the couple's centre under an arch: wide
   * enough that the joined hands rise between the two heads, not over one.
   */
  const ARCH_SPACING = 46;
  /** The spine's bend point; only Code arches (Test's arch stays 0). */
  const CHEST_Y = BODY.code.chestY;

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
    // In the hold Code's arm reaches round behind Test's shoulder and his
    // arm reaches behind her back. From the front her inner arm is behind
    // his body and arms (so her hand travels behind his back whenever it
    // moves to or from his shoulder); his arms keep their own layers, all
    // behind her; and her hand, once it rests on his shoulder, lies on top
    // of it. Back to front: her arm, Test, her resting hand, Code.
    const holdLayers = dancers.test && dancers.code
      ? { code: svg('g', {}, floor), codeHand: svg('g', {}, floor) }
      : null;
    if (holdLayers) {
      floor.insertBefore(holdLayers.code, dancers.test.rig.root);
      floor.insertBefore(holdLayers.codeHand, dancers.code.rig.root);
    }
    /** Puts an arm (and, given handLayer, its hand) in the hold layers, or back in its dancer's own layers. */
    function layerArm(rig, side, layer, handLayer) {
      const [upperArm, foreArm] = rig.arms[side].parts;
      const { hand } = rig.arms[side];
      if (layer) {
        if (upperArm.parentNode !== layer) layer.append(upperArm, foreArm);
      } else if (upperArm.parentNode !== rig.arms[side].homes[0]) {
        // Back home: an upper arm behind the torso and a forearm in front
        // of it (Code), or the whole arm together in front (Test).
        const [upperHome, foreHome] = rig.arms[side].homes;
        upperHome.append(upperArm);
        if (foreHome === upperHome) foreHome.append(foreArm);
        else foreHome.prepend(foreArm);
      }
      const handHome = (layer && handLayer) || foreArm;
      if (hand.parentNode !== handHome) handHome.append(hand);
    }
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
    /**
     * 0–1 through a measure of travel that never stops: a little quicker
     * just after the downbeat and a little slower on "3", like the swing of
     * a real waltz (the speed varies by ±30 % and matches across measures).
     */
    function surge(phase) {
      return phase + (0.3 / (2 * Math.PI)) * (Math.sin(2 * Math.PI * (phase - 0.2)) + Math.sin(2 * Math.PI * 0.2));
    }

    function waltzAt(t) {
      const active = waltzes.find((w) => t >= w.from && t < w.to);
      if (!active) return null;
      // `calm` scales the whole figure down to a gentle sway in place.
      // A full second to settle into the waltz and out of it again.
      const fade = smooth((t - active.from) / 1.0) * smooth((active.to - t) / 1.0) * (active.calm ?? 1);
      const { index, phase } = beats.at(t);
      const dir = index % 2 === 0 ? 1 : -1;
      const travel = active.travel;
      // The body swings through the whole measure, arriving over the new
      // foot just as the next measure begins: no stop at either end.
      const glide = (1 - Math.cos(Math.PI * phase)) / 2;
      const swing = Math.PI * (index + phase);
      // Progressive travel: over eight measures the couple circles the
      // floor, out toward stage centre's far side and back, and toward and
      // away from the viewer, so the waltz moves through space instead of
      // rocking in place. The loop starts and ends where the couple was
      // placed and only ever drifts away from the teaching boxes (to +x).
      // Each measure advances on its "1" and settles by "3", like the box step.
      const measure = index - beats.index(active.from) + surge(phase);
      const around = (2 * Math.PI * measure) / 8;
      return {
        fade, index, phase, dir, travel, who: active.who,
        roam: { x: active.roam * 0.5 * (1 - Math.cos(around)), y: 6 * Math.sin(around), scale: 1 + 0.03 * Math.sin(around) },
        rise: riseOf(phase),
        x: travel * dir * (2 * glide - 1),
        sway: Math.sin(swing),
        lag: (delay) => Math.sin(swing - delay),
        depth: 1 + 0.022 * Math.sin((Math.PI / 2) * (index + phase)),
      };
    }

    /**
     * Momentum: travelling, a dancer's body leans a little into the motion
     * and into each change of speed (degrees, + leaning screen-right), so a
     * start or a stop has weight instead of the figure gliding upright.
     */
    function travelLean(dancer, t) {
      const scale = placementAt(t).scale;
      const h = 0.12;
      const [a, b, c] = [t - h, t, t + h].map((time) => floorPoint(dancer, time, 0) / scale);
      return clamp(0.006 * (c - a) / (2 * h) + 0.004 * (c - 2 * b + a) / (h * h), -5, 5);
    }

    /** How far each dancer's foot may stand from under its hip (rig units). */
    const REACH = { test: 40, code: 28 };

    /** The troupe's placement at `time`: stage x and scale, with the waltz's roam. */
    function placementAt(time) {
      const pos = stagePos.value(time);
      const w = waltzAt(time);
      const roam = w && !w.who ? w : null;
      return {
        x: pos.x + (roam ? roam.roam.x * roam.fade : 0),
        scale: pos.scale * (roam ? 1 + (roam.roam.scale * roam.depth - 1) * roam.fade : 1),
      };
    }

    /**
     * A dancer's own spot at `time` (rig x): its keyed x, drawn closer to its
     * partner in the promenade hold and under an arch, but not its waltz sway,
     * which is the body moving over planted feet.
     */
    function spotAt(dancer, time) {
      const keyed = dancer.state.value(time);
      const spacing = ARCH_SPACING - (dancer.kind === 'test' ? 8 : 0);
      const closer = Math.max(keyed.embrace * Math.max(0, Math.abs(dancer.home) - 40), archAt(time) * Math.max(0, Math.abs(dancer.home) - spacing));
      return keyed.x - Math.sign(dancer.home) * closer;
    }

    /**
     * The stage x of the floor under a point `offset` rig units from the
     * dancer's spot at `time`. A foot that has landed keeps that stage point
     * however the troupe travels, roams, or grows, so no planted foot skates.
     */
    function floorPoint(dancer, time, offset) {
      const place = placementAt(time);
      return place.x + (spotAt(dancer, time) + offset) * place.scale;
    }

    /** The rig offset from the dancer's spot at `time` that lands on stage x `stageX`. */
    function offsetAt(dancer, time, stageX) {
      const place = placementAt(time);
      return (stageX - place.x) / place.scale - spotAt(dancer, time);
    }

    /** The waltz `dancer` dances at `time`, if any (a couple's waltz or its own solo). */
    function waltzOf(dancer, time) {
      const w = waltzAt(time);
      return w && (!w.who || w.who === dancer.kind) ? w : null;
    }

    /**
     * What a dancer's feet do during beat `b`: 'waltz' (the box step, while
     * the floor moves no faster than a box step travels), 'walk' (the floor
     * is moving), or 'still'. A jump faster than anyone could step (an
     * instant setup key, eased by the tracks' smoothing) is 'still' too:
     * a placement, not a journey. Cached: the choreography is fixed once
     * the scenes are built, so each beat is classified once.
     */
    const beatPlans = new Map();
    let plannedFor = '';
    function beatPlan(dancer, b) {
      // Keys added after a frame was drawn (while scenes are still being
      // built) invalidate the cache.
      const version = [stagePos.version, waltzes.length, ...Object.values(dancers).map((d) => d.state.version)].join(':');
      if (version !== plannedFor) {
        beatPlans.clear();
        plannedFor = version;
      }
      const key = `${dancer.kind}:${b}`;
      if (beatPlans.has(key)) return beatPlans.get(key);
      const t0 = beats.time(b);
      const t1 = beats.time(b + 1);
      const at = (p) => t0 + p * (t1 - t0);
      const scale = placementAt(t0).scale;
      // The jump test looks a little past both ends of the beat, as far as
      // the tracks' smoothing spreads an instant key.
      const span = t1 - t0 + 0.4;
      const xs = Array.from({ length: 13 }, (_, i) => floorPoint(dancer, t0 - 0.2 + (i / 12) * span, 0) / scale);
      const peak = Math.max(...xs.slice(1).map((x, i) => Math.abs(x - xs[i]))) / (span / 12);
      const travel = Math.abs(floorPoint(dancer, t1, 0) - floorPoint(dancer, t0, 0)) / scale;
      const w = waltzOf(dancer, at(0.05));
      let mode = 'still';
      if (peak <= 400) {
        if (w && w.fade > 0.5 && travel / (t1 - t0) < 30) mode = 'waltz';
        else if (travel > 4) mode = 'walk';
      }
      const plan = { mode, travel, w, at };
      beatPlans.set(key, plan);
      return plan;
    }

    /**
     * The steps around t, beat by beat: in a waltz the leading foot glides
     * out on "1–2" and the other closes on "2–3"; travelling, light steps
     * divide the beat, enough of them (two to six) that the body never
     * passes beyond a planted foot, so the feet never cross; and the first
     * still beat after moving closes both feet under the body again. Each
     * step: { side, lift, land, offset (from the foot's own spot), height }.
     */
    function stepsAround(dancer, t) {
      const now = beats.index(t);
      const events = [];
      for (let b = now - 4; b <= now + 3; b++) {
        const { mode, travel, w, at } = beatPlan(dancer, b);
        if (mode === 'waltz') {
          const dir = b % 2 === 0 ? 1 : -1;
          const offset = w.travel * dir;
          events.push({ side: dir > 0 ? 'R' : 'L', lift: at(0), land: at(0.52), offset, height: 4.2 });
          events.push({ side: dir > 0 ? 'L' : 'R', lift: at(0.54), land: at(0.94), offset, height: 2.4 });
        } else if (mode === 'walk') {
          const count = clamp(2 * Math.ceil(travel / 60), 2, 6);
          for (let k = 0; k < count; k++) {
            events.push({ side: k % 2 === 0 ? 'R' : 'L', lift: at(k / count), land: at((k + 1) / count), offset: 0, height: 3.4 * smooth(travel / 12) });
          }
        } else if (beatPlan(dancer, b - 1).mode !== 'still') {
          // Come to rest: both feet close under the body.
          events.push({ side: 'R', lift: at(0), land: at(0.42), offset: 0, height: 1.6 });
          events.push({ side: 'L', lift: at(0.5), land: at(0.92), offset: 0, height: 1.6 });
        }
      }
      return events;
    }

    /**
     * Footwork as planted steps: each foot lifts, travels, lands at a spot
     * on the floor, and stays exactly there until it lifts again, so no
     * planted foot skates, and one figure gives way to the next (walking
     * into a waltz, the waltz into walking) one step at a time instead of
     * two footworks blending. A foot lands where the floor under its side of
     * the body will be halfway through its stance, so the body passes evenly
     * over it even while the troupe travels. Returns body-relative offsets,
     * lifts, and the body's dip as each step lands; null at rest.
     */
    function footworkAt(dancer, t) {
      const events = stepsAround(dancer, t);
      if (!events.length) return null;
      const w = waltzOf(dancer, t);
      const sway = w ? w.x * w.fade : 0;
      const reach = REACH[dancer.kind];
      const out = { dip: 0 };
      for (const side of ['L', 'R']) {
        const base = (side === 'L' ? -1 : 1) * dancer.rig.body.foot;
        const mine = events.filter((e) => e.side === side);
        // Where a step lands: the floor under the foot's spot halfway
        // through the stance that follows it.
        const landing = (i) => {
          const step = mine[i];
          const next = mine[i + 1];
          const stanceEnd = next ? next.lift : step.land + (beats.at(step.land).period || 1);
          return floorPoint(dancer, (step.land + stanceEnd) / 2, base + step.offset);
        };
        let i = -1;
        while (i + 1 < mine.length && mine[i + 1].lift <= t) i++;
        let stand;
        let lift = 0;
        if (i < 0) stand = floorPoint(dancer, t, base);
        else {
          const step = mine[i];
          const from = i > 0 ? landing(i - 1) : floorPoint(dancer, step.lift, base);
          const to = landing(i);
          const k = clamp((t - step.lift) / (step.land - step.lift), 0, 1);
          stand = from + (to - from) * smooth(k);
          // The foot peels off the floor and touches down softly (no speed
          // at either end), skimming highest mid-step.
          lift = 1.1 * step.height * Math.sin(Math.PI * k) ** 1.5;
          if (k < 1) out.dip = Math.max(out.dip, 0.45 * step.height * (1 - Math.cos(2 * Math.PI * k)) / 2);
        }
        out[side] = { dx: clamp(offsetAt(dancer, t, stand) - base - sway, -reach, reach), lift };
      }
      return out;
    }

    /** How fast, and how much, a dancer is travelling at t (for the coat tails and gown). */
    function travelOf(dancer, t) {
      const scale = placementAt(t).scale;
      const velocity = (floorPoint(dancer, t, 0) - floorPoint(dancer, t - 0.2, 0)) / 0.2 / scale;
      return { velocity, amount: smooth((Math.abs(velocity) - 6) / 40) };
    }

    /**
     * How far an underarm turn is under way at t (0 outside one, 1 in it):
     * the joined hands rise into the arch over the turn's preparation and
     * come down again through its finish, unhurried at both ends.
     */
    function archAt(t) {
      const turn = twirls.find((tw) => tw.who === 'code' && !tw.solo && t >= tw.at - 0.8 && t <= tw.at + tw.dur + 0.8);
      if (!turn || !dancers.test || !dancers.code) return 0;
      return smooth((t - turn.at + 0.8) / 0.75) * smooth((turn.at + turn.dur + 0.8 - t) / 0.75);
    }

    /**
     * A turn as a dancer does it. Preparation: she sinks into a plié and
     * winds a little against the turn, arms opening. On the beat she pushes
     * up onto her standing foot (relevé), draws the other foot to its ankle,
     * and turns: a sharp push, an even spin, a controlled finish into a
     * plié. Her head spots, holding the front until the body has turned
     * away, then whipping round ahead of it. The skirt follows the body a
     * moment late, flares with its speed, swirls past the finish and swings
     * back as it settles. Times in seconds, angles in radians; `depth` is
     * how wide the body (and the head) still looks side-on.
     */
    const TURN = { prep: 0.42, finish: 0.7, wind: 0.32, accel: 0.12, decel: 0.28, lag: 0.14, swish: 0.32, depth: 0.38, headDepth: 0.3 };

    /** The twirl whose preparation, turn, or finish covers t, if any. */
    function twirlAt(kind, t) {
      return twirls.find((tw) => tw.who === kind && t >= tw.at - TURN.prep && t <= tw.at + tw.dur + TURN.finish);
    }

    /** 0–1 through a turn's rotation: constant acceleration, an even spin, constant deceleration. */
    function spinProgress(p) {
      const { accel: a, decel: d } = TURN;
      const v = 1 / (1 - a / 2 - d / 2);
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      if (p < a) return (v * p * p) / (2 * a);
      if (p < 1 - d) return v * (a / 2 + p - a);
      return 1 - (v * (1 - p) ** 2) / (2 * d);
    }

    /** The body's angle through a twirl at `time`: the wind-up against the turn, then the turn. */
    function turnAngle(tw, time) {
      if (time <= tw.at - TURN.prep) return 0;
      if (time < tw.at) return -TURN.wind * smooth((time - tw.at + TURN.prep) / TURN.prep);
      return -TURN.wind + (2 * Math.PI * tw.turns + TURN.wind) * spinProgress((time - tw.at) / tw.dur);
    }

    /** The skirt's angle: the body's, a moment late, plus a damped swirl past the finish. */
    function skirtAngle(tw, time) {
      const q = time - tw.at - tw.dur;
      const swirl = q > 0 ? TURN.swish * Math.sin((2 * Math.PI * q) / TURN.finish) * Math.exp(-q / 0.3) : 0;
      return turnAngle(tw, time - TURN.lag) + swirl;
    }

    /** Spotting: the head holds the front while the body turns away, then whips round ahead of it. */
    function spotAngle(angle) {
      const rev = angle / (2 * Math.PI);
      const whole = Math.floor(rev);
      return 2 * Math.PI * (whole + smooth((rev - whole - 0.4) / 0.32));
    }

    /**
     * How wide a body turned by `angle` looks from the front: 1 facing us or
     * away, `depth` side-on. The figure is never mirrored, so nothing jumps
     * from one side to the other mid-turn; the travelling skirt pattern and
     * the spotting head (blank while it faces away) show the rotation.
     */
    function turnedWidth(angle, depth) {
      const c = Math.cos(angle);
      return Math.sqrt(c * c + depth * depth * (1 - c * c));
    }

    /** Arm lines through a turn: open to prepare, drawn in to turn, opened out to finish. */
    const TURN_ARMS = {
      solo: {
        prep: { armL: { sh: 70, el: -12, wr: 12 }, armR: { sh: -70, el: 12, wr: -12 } },
        // First position: arms rounded in front of the chest, hands almost
        // touching, which keeps the turn tight and fast.
        turn: { armL: { sh: 52, el: -134, wr: 8 }, armR: { sh: -52, el: 134, wr: -8 } },
        finish: { armL: { sh: 118, el: -10, wr: 18 }, armR: { sh: -74, el: 8, wr: -24 } },
      },
      // Under his arm only her free arm is hers: it wraps in to the waist.
      partnered: {
        prep: { armR: { sh: -64, el: 14, wr: -12 } },
        turn: { armR: { sh: -22, el: 74, wr: -10 } },
        finish: { armR: { sh: -112, el: -14, wr: -18 } },
      },
    };

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
      // Under an arch Test stands a little nearer than Code, so his raised
      // arm reaches the joined hands even when they pass over her axis.
      const spacing = ARCH_SPACING - (isTest ? 8 : 0);
      const closer = Math.max(s.embrace * Math.max(0, Math.abs(dancer.home) - 40), arch * Math.max(0, Math.abs(dancer.home) - spacing));
      if (closer > 0) s.x -= Math.sign(dancer.home) * closer;
      // The ballroom head line: in the hold each partner looks out over the
      // other's shoulder, Code's head tilted away from Test, his to his left.
      s.head += (isTest ? -3 : 5) * s.embrace;
      // Code's top line arcs back and away from him in the hold.
      if (!isTest) s.arch += 3 * s.embrace;
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
      s.lean += travelLean(dancer, t);
      if (w) {
        const e = w.fade;
        const inward = isTest ? 1 : -1;
        s.bob += (4 - 7 * w.rise) * e;
        // Test stands tall, inclined a touch toward her; Code's top line
        // curves back and away from him, as in a ballroom hold.
        s.lean += (4 * w.sway + (isTest ? 1.2 : 3.4)) * e;
        if (!isTest) s.arch += (2 + 1.5 * w.lag(0.4)) * e;
        s.head += 3 * inward * e;
        s.x += w.x * e;
        s.head += (isTest ? 2.5 * w.lag(0.3) : -2 + 3 * w.lag(0.45)) * e;
        // The free arms float on the beat, the forearm a little behind.
        // The wrist follows a beat later still, so the hand finishes the line.
        s[outer] = {
          sh: s[outer].sh + outerSign * 10 * w.lag(0.5) * e,
          el: s[outer].el + outerSign * 12 * w.lag(1.1) * e,
          wr: (s[outer].wr || 0) + outerSign * 12 * w.lag(1.6) * e,
        };
        // Test rises onto the balls of his feet through "2–3" and lowers on
        // "1": his heels lift while his toes stay down.
        if (isTest) s.footL = { ...s.footL, rise: (s.footL.rise || 0) + w.rise * e };
        if (isTest) s.footR = { ...s.footR, rise: (s.footR.rise || 0) + w.rise * e };
        if (isTest) s.tails = (9 * w.lag(1.0) - 0.12 * w.travel * w.dir * Math.sin(Math.PI * w.phase)) * e;
        if (!isTest) {
          // The gown trails the travel and sways with the frame.
          s.sway += (0.55 * w.lag(0.9) - 0.04 * w.travel * w.dir * Math.sin(Math.PI * w.phase)) * e;
          s.flare += 3 * w.rise * e;
        }
      } else {
        const walk = travelOf(dancer, t);
        if (walk.amount > 0) {
          // Travelling, the tails and the gown trail the direction of travel.
          if (isTest) s.tails = clamp(walk.velocity / 16, -10, 10) * walk.amount;
          if (!isTest) {
            s.sway += clamp(-walk.velocity / 140, -0.9, 0.9) * walk.amount;
          }
        }
      }
      // The feet: planted steps through every figure (footworkAt).
      const steps = footworkAt(dancer, t);
      if (steps) {
        s.bob += w ? 0 : steps.dip;
        for (const side of ['L', 'R']) {
          const foot = s[`foot${side}`];
          s[`foot${side}`] = { ...foot, dx: foot.dx + steps[side].dx, lift: foot.lift + steps[side].lift };
        }
      }
      const tw = twirlAt(dancer.kind, t);
      if (tw) {
        const end = tw.at + tw.dur;
        s.turn = turnAngle(tw, t);
        s.turnHead = spotAngle(s.turn);
        s.turnSkirt = skirtAngle(tw, t);
        s.spin = turnedWidth(s.turn, TURN.depth);
        s.headSpin = turnedWidth(s.turnHead, TURN.headDepth);
        // The axis stands straight up through the turn.
        const axis = smooth((t - tw.at + TURN.prep) / 0.3) * smooth((end + 0.4 - t) / 0.4);
        s.lean *= 1 - axis;
        s.arch *= 1 - axis;
        s.head *= 1 - axis;
        // A plié to prepare, the relevé to turn, a plié again to land.
        const bump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 2);
        const up = smooth((t - tw.at) / 0.12) * smooth((end - t) / 0.14);
        s.bob += 5 * bump((t - tw.at + TURN.prep) / (TURN.prep + 0.06)) - 5 * up + 4 * bump((t - end + 0.04) / 0.5);
        // The skirt flares with its own speed and twists a moment behind the body.
        const skirtSpeed = Math.abs(s.turnSkirt - skirtAngle(tw, t - 0.05)) / 0.05;
        const peak = (2 * Math.PI * tw.turns + TURN.wind) / tw.dur / (1 - TURN.accel / 2 - TURN.decel / 2);
        s.flare += 22 * clamp(skirtSpeed / peak, 0, 1);
        s.earFling = 34 * clamp((s.turn - turnAngle(tw, t - 0.05)) / 0.05 / peak, 0, 1);
        s.sway += clamp(-1.1 * (s.turn - s.turnSkirt), -1.6, 1.6);
        // The standing foot under the axis, the other drawn up to its ankle.
        const feet = smooth((t - tw.at + 0.16) / 0.16) * smooth((end + 0.1 - t) / 0.26);
        s.footL = mix(s.footL, { dx: 9, lift: 0 }, feet);
        s.footR = mix(s.footR, { dx: -6, lift: 11 }, feet);
        // Each arm stage takes over from the one before; the last hands
        // back to the keyed pose.
        const lines = TURN_ARMS[tw.solo ? 'solo' : 'partnered'];
        const stages = [
          [lines.prep, smooth((t - tw.at + TURN.prep) / (TURN.prep * 0.85))],
          [lines.turn, smooth((t - tw.at + 0.2) / 0.46)],
          [lines.finish, smooth((t - end + 0.45) / 0.5)],
        ];
        const release = smooth((t - end - TURN.finish + 0.55) / 0.55);
        for (const key of Object.keys(lines.turn)) {
          const keyed = s[key];
          let line = keyed;
          for (const [stage, weight] of stages) line = mix(line, stage[key], weight);
          s[key] = mix(line, keyed, release);
        }
      }
      if (couple && s.hold > 0) {
        const plan = isTest ? couple.test : couple.code;
        const body = dancer.rig.body;
        const side = isTest ? 'R' : 'L';
        const sign = side === 'L' ? -1 : 1;
        const key = `arm${side}`;
        const shoulder = [sign * body.shoulder[0], body.shoulder[1]];
        const solve = (target, palm, drape) => {
          // Target in this dancer's un-leaned, un-turned body coordinates;
          // her held arm (see Code's armFrame) is never narrowed by her turn.
          let local;
          if (isTest) local = rotateAbout(rotateAbout([(target[0] - s.x) / (s.spin || 1), target[1] - s.y - s.bob], [0, body.hipY], -s.lean), [0, CHEST_Y], -s.arch);
          else {
            const [sx, sy] = heldShoulder(s, body);
            local = rotateAbout([target[0] - sx + shoulder[0], target[1] - sy + shoulder[1]], shoulder, -s.lean - s.arch);
          }
          const solved = reach(shoulder, local, body.upper, body.fore, side === 'R' ? 1 : -1);
          // atan2 wraps at ±180°, so the solver's shoulder angle can come back
          // a whole turn from the poses it blends with. Keep it in the arm's
          // own range (the one every pose is written in: a left arm from
          // across the chest, through hanging and out, up to just past
          // overhead; a right arm mirrored), so blends never snap.
          if (side === 'L') {
            while (solved.sh > 240) solved.sh -= 360;
            while (solved.sh <= -120) solved.sh += 360;
          } else {
            while (solved.sh < -240) solved.sh += 360;
            while (solved.sh >= 120) solved.sh -= 360;
          }
          solved.wr = s[key].wr || 0;
          if (palm && drape > 0) {
            // Aim the hand along his shoulder, independent of the elbow.
            const direction = rotateAbout(palm, [0, 0], -s.lean - s.arch);
            let wrist = Math.atan2(-direction[0], direction[1]) * 180 / Math.PI - solved.sh - solved.el;
            while (wrist - solved.wr > 180) wrist -= 360;
            while (wrist - solved.wr < -180) wrist += 360;
            // A wrist bends only so far; past that the hand follows the forearm.
            wrist = clamp(wrist, -105, 105);
            solved.wr += (wrist - solved.wr) * drape;
          }
          return solved;
        };
        let solved;
        if (plan.target) {
          // Her hand follows one planned path (see the couple's targets).
          solved = solve(plan.target, plan.palm, plan.drape);
        } else {
          // His joined hand (low between them, or raised into an arch) is
          // the point she reaches for too; moving between that and his hand
          // on her back, his arm swings in joint space, an arc about the
          // shoulder, never along a straight line through a head.
          const joined = solve(plan.joined, null, 0);
          solved = plan.ownWeight > 0 ? mix(joined, solve(plan.own, null, 0), plan.ownWeight) : joined;
        }
        // Her arm reaches its path in the first three-quarters of a change of
        // hold, so her hand is already at the clear spot off his shoulder
        // when it settles onto it (or lifts from it) and changes layer.
        s[key] = mix(s[key], solved, isTest ? s.hold : smooth(s.hold / 0.75));
      }
      return s;
    }

    /**
     * Code's pearl drops are small pendulums: when her head accelerates one
     * way they swing the other, a moment late. The ear's sideways position
     * (the troupe's travel, her own, and her sway about the hips) is
     * sampled three times to find that acceleration. Degrees, + swings the
     * drops toward screen-left.
     */
    function pearlSwing(dancer, t, now) {
      const h = 0.12;
      const earX = (time, s) => {
        const pos = stagePos.value(time);
        const w = waltzAt(time);
        const roam = w && !w.who ? w.roam.x * w.fade : 0;
        return (pos.x + roam) / pos.scale + s.x + 78 * Math.sin((s.lean + s.head + 0.55 * s.arch) * DEG);
      };
      const earlier = (time) => {
        const w = waltzAt(time);
        return earX(time, stateOf(dancer, time, null, w && (!w.who || w.who === dancer.kind) ? w : null));
      };
      const accel = (earX(t, now) - 2 * earlier(t - h) + earlier(t - 2 * h)) / (h * h);
      return clamp(0.04 * accel, -26, 26);
    }

    onFrame((t) => {
      if (t < at - 0.5 || (until !== undefined && t > until + 0.5)) return;
      const pos = stagePos.value(t);
      const w = waltzAt(t);
      const roam = w && !w.who ? { x: w.roam.x * w.fade, y: w.roam.y * w.fade, scale: 1 + (w.roam.scale * w.depth - 1) * w.fade } : { x: 0, y: 0, scale: 1 };
      const waltzFor = (dancer) => (w && (!w.who || w.who === dancer.kind) ? w : null);
      const scaleNow = pos.scale * roam.scale;
      floor.setAttribute('transform', `translate(${f(pos.x + roam.x)} ${f(pos.y + roam.y)}) scale(${scaleNow.toFixed(4)})`);
      const raw = {};
      for (const dancer of Object.values(dancers)) raw[dancer.kind] = stateOf(dancer, t, null, waltzFor(dancer));
      let couple = null;
      if (dancers.test && dancers.code) {
        // A point on a dancer's body (body-local, before lean and turn).
        const on = (kind, [px, py]) => {
          const s = raw[kind];
          const p = rotateAbout(rotateAbout([px, py], [0, CHEST_Y], s.arch), [0, dancers[kind].rig.body.hipY], s.lean);
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
        // resting on his near shoulder.
        const back = on('code', [-2, -150]);
        // Her hand's path. Resting, it lies along the top of his shoulder,
        // draped a little toward his neck, its wrist just above the
        // shoulder's corner, clear of his raised arm, so the hand (in front
        // of him) and her forearm (behind his arm) meet where nothing of him
        // covers them. Coming to rest it slides up from under his arm,
        // hidden behind it, rises clear above his shoulder, and settles onto
        // it; leaving it lifts off first and slides back down under his arm,
        // then on to their joined hands or to her side. Rising into an arch
        // it lifts off and goes straight up. It changes layer only while
        // lifted clear of him (handRests), so the change never shows.
        const k = archAt(t);
        const e = raw.code.embrace;
        const settle = smooth((e - 0.8) / 0.2) * (1 - smooth(k / 0.3));
        // Lifted, the hand waits just off the corner of his shoulder, clear
        // of his coat, his arm, and his lamp; that is where it changes layer.
        const contact = on('test', [21.5 + 6 * (1 - settle), -178 - 9 * (1 - settle)]);
        const palm = rotateAbout([-6.6, 2.9], [0, 0], raw.test.lean);
        // IK targets the wrist; the palm, not the cuff, rests on the shoulder.
        const overShoulder = [contact[0] - palm[0], contact[1] - palm[1]];
        const underArm = lerp(on('test', [BODY.test.shoulder[0], BODY.test.shoulder[1]]), back, 0.5);
        const slide = smooth((e - 0.2) / 0.7);
        const own = lerp(underArm, overShoulder, slide);
        // Underarm turn: the joined hands rise into the gap between the two
        // heads, clear of both, and stay there while she turns beneath them.
        const arch = [raw.code.x - 36, raw.code.y + raw.code.bob - 220];
        couple = {
          handRests: settle > 0.15,
          test: { joined: lerp(hands, arch, k), own: back, ownWeight: raw.test.embrace * (1 - k) },
          code: { target: lerp(lerp(hands, own, smooth(e / 0.55)), arch, k), palm, drape: slide * (1 - k) },
        };
      }
      const finals = {};
      for (const dancer of Object.values(dancers)) {
        const s = stateOf(dancer, t, couple, waltzFor(dancer));
        if (dancer.kind === 'code') s.earSwing = pearlSwing(dancer, t, s);
        finals[dancer.kind] = s;
      }
      // Layer the inner arms before posing them, so a hand that changes
      // layer is placed for its new layer in the same frame.
      const placeArm = (held) => {
        // Her hand comes in front of him only while it rests on his
        // shoulder, switching while lifted clear of him; on its way there
        // and away it travels behind his back with her arm.
        layerArm(dancers.code.rig, 'L', held ? holdLayers.code : null, held && couple.handRests ? holdLayers.codeHand : null);
        if (held) {
          holdLayers.code.setAttribute('transform', dancers.code.rig.armFrame(finals.code));
          holdLayers.codeHand.setAttribute('transform', dancers.code.rig.armFrame(finals.code));
        }
      };
      // Her inner arm is behind him (in the hold layers) for the whole of
      // any hold and any change of hold.
      const holding = holdLayers && Math.max(finals.code.hold, finals.test.hold) > 0.002;
      if (holdLayers) placeArm(holding);
      for (const dancer of Object.values(dancers)) dancer.rig.apply(t, finals[dancer.kind]);
      // Out of the hold it comes back in front of him only once it is clear
      // of him: while it still crosses his arm or his body it stays behind,
      // so its order never flips where the two overlap.
      if (holdLayers && !holding && crossesTest()) {
        placeArm(true);
        dancers.code.rig.apply(t, finals.code);
      }
    });

    /** Whether Code's inner arm overlaps Test's arms or body (screen boxes). */
    function crossesTest() {
      const boxes = (nodes) => nodes.map((node) => node.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
      const mine = boxes(dancers.code.rig.arms.L.parts);
      const his = boxes([...dancers.test.rig.arms.L.parts, ...dancers.test.rig.arms.R.parts, dancers.test.rig.coat]);
      return mine.some((a) => his.some((b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
    }

    fx.fadeIn(wrap, at, 0.35);
    if (until !== undefined) fx.fadeOut(wrap, until, 0.35);

    /** The start time that makes a dur-long motion arrive on the beat nearest atTime + dur. */
    function arrivingOnBeat(atTime, dur) {
      return dur < 0.1 ? atTime : nearestBeat(atTime + dur) - dur;
    }

    function keyAll(atTime, partialFor, dur, curve) {
      for (const dancer of Object.values(dancers)) addKey(dancer, atTime, partialFor(dancer), dur, curve);
    }

    /** Taking or letting go of a hold never takes less than this (s). */
    const HOLD_CHANGE = 1.1;

    /**
     * Adds a key to one dancer. Taking or letting go of the hold carries a
     * whole arm from one place to another (round behind a partner, onto or
     * off a shoulder), so those changes take at least HOLD_CHANGE, starting
     * earlier and arriving at the same moment as the rest of the key.
     */
    function addKey(dancer, atTime, partial, dur, curve) {
      const holdKeys = {};
      const rest = {};
      for (const [name, value] of Object.entries(partial)) (name === 'hold' || name === 'embrace' ? holdKeys : rest)[name] = value;
      if (Object.keys(holdKeys).length && dur >= 0.1 && dur < HOLD_CHANGE) {
        dancer.state.add(atTime + dur - HOLD_CHANGE, holdKeys, HOLD_CHANGE, curve);
        if (Object.keys(rest).length) dancer.state.add(atTime, rest, dur, curve);
      } else dancer.state.add(atTime, partial, dur, curve);
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
        addKey(dancer, dur < 0.1 ? atTime : nearestTriplet(atTime), partial, dur, curve);
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
        keyAll(dur < 0.1 ? atTime : nearestBeat(atTime), (dancer) => {
          const outer = dancer.kind === 'test' ? 'armL' : 'armR';
          const inner = dancer.kind === 'test' ? 'armR' : 'armL';
          return {
            hold: release ? 0 : 1,
            embrace: !release && style === 'promenade' ? 1 : 0,
            [outer]: poseOf(pose)[outer],
            // Letting go, the inner arm settles into the pose as well,
            // rather than into whatever it held before the hold.
            ...(release && poseOf(pose)[inner] ? { [inner]: poseOf(pose)[inner] } : {}),
          };
        }, dur);
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
        keyAll(begin, () => ({ hold: 1, embrace: 0, low: 1 }), 0.8);
        if (dancers.test) dancers.test.state.add(begin, { ...POSES.present, look: 1, face: 'joy', lean: -4 }, 0.8);
        if (dancers.code) {
          dancers.code.state.add(begin, { ...POSES.spotlight, look: 0, face: 'joy', head: -4, lean: 1, arch: 4 }, 0.8);
          dancers.code.state.add(begin + 0.2, { clean }, tidyDur);
        }
        keyAll(back, (dancer) => ({
          hold: 1, embrace: 1, low: 0, lean: 0, arch: 0, head: 0, look: dancer.kind === 'test' ? 1 : -1,
          [dancer.kind === 'test' ? 'armL' : 'armR']: POSES.frame[dancer.kind === 'test' ? 'armL' : 'armR'],
        }), 0.8);
        return api;
      },
      /** The waltz box step (rise, fall, alternating feet) during [from, to). */
      waltz(from, to, { travel = 10, roam = 26, calm = 1, who } = {}) {
        // `who` ('test' or 'code') makes it a solo: only that dancer steps,
        // and the couple's floor position stays put.
        waltzes.push({ from, to, travel, roam: who ? 0 : roam, calm, who });
        return api;
      },
      /**
       * Code turns under Test's raised arm: pushing off on a beat, for whole
       * beats, with a preparation before and a finish after (see TURN).
       */
      twirl(atTime, { dur = 1, turns = 1, who = 'code', solo = false } = {}) {
        const start = nearestBeat(atTime);
        const length = wholeBeats(start, dur);
        // The joined hands rise into an arch over her head (see archAt);
        // a solo turn is a free pirouette, her arms rounded in front.
        twirls.push({ at: start, dur: length, turns, who, solo });
        return api;
      },
      /**
       * Test dips Code: both rise a little first (the preparation), then Code
       * sinks back in a slow arc that reaches its lowest point on a beat.
       */
      dip(atTime, { dur = 0.9, depth = 1 } = {}) {
        const start = arrivingOnBeat(atTime, dur);
        // Both stand tall as he draws her into the hold (never still bowed
        // toward each other, or their heads would meet), then she sinks.
        keyAll(start - HOLD_CHANGE - 0.4, () => ({ bob: -3, lean: 0, arch: 0, head: 0 }), HOLD_CHANGE);
        // Test's arm supports her back (the promenade hold) through the dip.
        keyAll(start - 0.35, () => ({ hold: 1, embrace: 1 }), 0.35);
        if (dancers.code) dancers.code.state.add(start, { lean: 21 * depth, arch: 11 * depth, head: 10 * depth, bob: 5 * depth, armR: { sh: -112, el: 16, wr: -18 }, face: 'joy' }, dur);
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
          armR: { sh: -108, el: 10, wr: -22 }, flare: 14, sway: 0.55,
        }, dur);
        return api;
      },
      /** Both stand tall again after a dip or bow, from a beat. */
      rise(atTime, dur = 0.8) {
        keyAll(nearestBeat(atTime), () => ({ lean: 0, arch: 0, head: 0, bob: 0 }), dur);
        return api;
      },
      /**
       * Test bows (right hand to his chest, left arm opening to the side)
       * and Code curtsies (sinking, both hands lifting her skirt), from a beat.
       */
      bow(atTime, { dur = 0.6 } = {}) {
        const at0 = nearestBeat(atTime);
        keyAll(at0, (dancer) => ({ hold: 0, embrace: 0, lean: dancer.kind === 'test' ? 16 : -9, arch: dancer.kind === 'test' ? 0 : -5, head: dancer.kind === 'test' ? 6 : -8, face: 'smile' }), dur);
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
