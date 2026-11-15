/*
 * The cast of "It Works on My Machine", a comic opera about one teammate
 * who keeps "helping" (storyboard: _data/songs/it_works_on_my_machine.yml).
 *
 * Seven singers share one rig, a figure standing at ease in a 160×300 box,
 * its weight on the picture's left leg, lit from the upper left:
 *   - the Teammate, the tenor: a drawn face (a towering pompadour and a
 *     twirled moustache) on a teal quarter-zip pullover with its sleeves
 *     pushed up, dark jeans, orange sneakers, and studio headphones round
 *     the neck, never without his stickered laptop;
 *   - six teammates who sing back, each in their own unisex clothes on a
 *     unisex build (shoulders little wider than the hips, no waist
 *     shaping), each wearing an SE Gym hero head the song casts
 *     (SongStudentAvatar's castHead): the Product Manager in a blazer over
 *     a tee, the Build Engineer in a hi-vis vest, the Test Engineer in a lab
 *     coat, the UI Developer in a painter's apron, the Back-End Developer in
 *     a hoodie, and the Security Engineer in a black field jacket;
 *   - the viewer's own hero (SongStudentAvatar's heroHead), who joins them
 *     at the end in a blue hoodie.
 *   Other songs reuse the cast; `coder` dresses a singer as a developer in
 *   the same hoodie in green, with a code tag on the chest, `maintainer`
 *   as a lead developer in plum, with a git branch, and `engineer` as a
 *   software engineer in rust, with curly braces. The Scrum song adds
 *   `coach`, its Scrum Master, the team coach, in a teal track jacket with
 *   striped sides and sleeves and a whistle on a lanyard, and `navigator`,
 *   its Product Owner, the value navigator, in a navy double-breasted sea
 *   coat with brass buttons and gold cuff braid over a Breton shirt, with a
 *   gold compass pin. A costume's `sleeveTrim(upper, fore)` adds stripes or
 *   braid to its sleeves. The reuse song adds `foreman`, the viewer's hero
 *   as the site foreman on its brick construction site: a safety-orange
 *   hi-vis vest with silver bands over a blue work shirt, sleeves rolled
 *   up, a leather tool pouch, jeans, work boots, and a gold hard hat (a
 *   costume's `headwear(layer)` goes over the worn head).
 *   Export stages never load the hero renderer, so there each keeps a
 *   drawn face: the costume's, or a woman's (long hair, finer brows) for a
 *   figure whose `gender` is 'woman', a role a woman sings.
 *
 * Every figure lives for the whole song: `stage` lists when it is on stage,
 * `places` where it stands (it walks there), `moves` what it does on which
 * sung word (MOVES), and `sings` the word intervals its mouth follows
 * (lipSync). Arms are two-bone limbs that reach for stage points; each hand
 * has a continuous, view-specific silhouette, about three quarters as
 * long as the forearm, in one view per shape, and turns at the wrist only
 * as far as a wrist can. Every pose is a pure function of song time; under
 * reduced motion the figures hold still between moves and each move snaps
 * to its pose. Coordinates are CSS pixels on the 960×540 stage; styles:
 * css/song-video-opera-cast.css.
 */
(function () {
  'use strict';

  const { fx, onFrame, onDispose, progress, easeInOutCubic, hash01 } = window.Timeline;
  const { el, svg, place } = window.SongKit;
  const { clamp, handPart } = window.SongFigure;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let uid = 0;

  // ------------------------------------------------------------------
  // Proportions and arm geometry (figure units; the picture's right arm,
  // which the left arm mirrors)
  // ------------------------------------------------------------------

  const MIRROR = 'translate(160 0) scale(-1 1)';
  // A worn hero head: centred on x, its chin at chin, its face this wide.
  const HEAD = { x: 80, chin: 72, width: 34 };
  const EYES = 50;
  const SHOULDER = [104.2, 94.6];
  const ELBOW = [109, 138.4];
  const WRIST = [110.6, 172.4];
  const UPPER = Math.hypot(ELBOW[0] - SHOULDER[0], ELBOW[1] - SHOULDER[1]);
  const FORE = Math.hypot(WRIST[0] - ELBOW[0], WRIST[1] - ELBOW[1]);
  // How short the upper arm looks when it comes fully forward, at the viewer.
  const LIFT = 0.32;
  const degrees = (r) => r * 180 / Math.PI;
  const radians = (a) => a * Math.PI / 180;
  /** (x, y) turned `angle` degrees clockwise (SVG's sense) about the origin. */
  const rotate = ([x, y], angle) => {
    const [c, s] = [Math.cos(radians(angle)), Math.sin(radians(angle))];
    return [x * c - y * s, x * s + y * c];
  };
  const UPPER_REST = degrees(Math.atan2(ELBOW[1] - SHOULDER[1], ELBOW[0] - SHOULDER[0]));
  const FOREARM_REST = degrees(Math.atan2(WRIST[1] - ELBOW[1], WRIST[0] - ELBOW[0]));
  /** How far (degrees, counter-clockwise) a segment hanging at `rest` turns to point along `dir`. */
  const raise = (rest, dir) => ((rest - dir + 540) % 360) - 180;
  /** An angle as the turn of at most half a circle either way that it amounts to. */
  const aroundZero = (angle) => ((angle % 360) + 540) % 360 - 180;
  // A wrist turns this far each way (degrees, clockwise in the hand's
  // frame): bending towards the palm or the thumb is the positive side.
  const WRIST_RANGE = [-55, 65];
  const ELBOW_FLEXION = 150;
  // The trousers foreshorten between their waist and hems when the knees give.
  const WAIST = 150;
  const HEMS = 286;

  /**
   * The [upper, forearm] raise that puts the wrist (or `end`, a point the
   * forearm carries) at (x, y): two-bone inverse kinematics with the elbow
   * down and out at the side, as a person holds an arm. `shorten` is how much
   * of its length the upper arm shows. Out of reach, the arm points at it.
   */
  function reach([x, y], { shorten = 1, end = WRIST } = {}) {
    const upper = UPPER * shorten;
    const fore = Math.hypot(end[0] - ELBOW[0], end[1] - ELBOW[1]);
    const foreRest = degrees(Math.atan2(end[1] - ELBOW[1], end[0] - ELBOW[0]));
    const dx = x - SHOULDER[0], dy = y - SHOULDER[1];
    const distance = Math.hypot(dx, dy);
    // A target close to the shoulder must not fold the forearm through the
    // upper arm. Keep a soft elbow even at either end of the reach envelope.
    const closest = Math.sqrt(upper ** 2 + fore ** 2 + 2 * upper * fore * Math.cos(radians(ELBOW_FLEXION)));
    const d = clamp(distance, closest, upper + fore - 0.5);
    const toward = Math.atan2(dy, dx);
    const bend = Math.acos(clamp((upper ** 2 + d ** 2 - fore ** 2) / (2 * upper * d), -1, 1));
    const elbows = [toward + bend, toward - bend].map((angle) => ({ angle, ex: SHOULDER[0] + upper * Math.cos(angle), ey: SHOULDER[1] + upper * Math.sin(angle) }));
    // An elbow inside the torso (left of the shoulder) counts against it.
    const score = (e) => e.ey - 3 * Math.max(0, SHOULDER[0] - e.ex);
    elbows.sort((a, b) => score(b) - score(a));
    const { angle, ex, ey } = elbows[0];
    const foreDir = Math.atan2(SHOULDER[1] + Math.sin(toward) * d - ey, SHOULDER[0] + Math.cos(toward) * d - ex);
    return [raise(UPPER_REST, degrees(angle)), raise(foreRest, degrees(foreDir))];
  }

  /** The arm held out straight along `along` (SVG degrees), the elbow `bend` degrees soft. */
  const outstretched = (along, bend = 8) => [raise(UPPER_REST, along + bend), raise(FOREARM_REST, along - bend / 3)];
  /** The hand's turn at the wrist that points its fingers along `dir`, on an arm posed at [upper, forearm]. */
  const handToward = ([, fore], dir) => aroundZero(dir - 90 + fore);

  // ------------------------------------------------------------------
  // Hands are authored as continuous silhouettes, wrist at (0, 0),
  // fingers along +y. Separate swept finger tubes cannot describe folded
  // fingers: they self-intersect and leave seams where the palm covers them.
  // Palm views have the thumb/index on +x; dorsal views on −x. Mirror the
  // entire arm, never individual digits. Surface marks belong to that view:
  // an extended palm-facing finger has flexion creases, never a visible nail.
  // ------------------------------------------------------------------

  /** One silhouette, an open wrist boundary, and view-specific interior ink.
   * The fill overlaps the forearm; the contour has no transverse wrist line. */
  function handSilhouette(outline, details = []) {
    return handPart(`${outline} Z`, outline, details);
  }

  const palmCreases = ['oc-palm-crease',
    'M-3.7 7.5 C-1.5 7.8 0.4 7.2 1.6 6.3 M-3.8 10.1 Q-1 10.8 1.2 9.8'];
  const foldedThumb = ['oc-crease',
    'M5.8 6.3 C5.5 8.2 3.6 9.8 1.2 11 C0.3 11.5 0.5 12.8 1.6 13 C3.1 13.2 4.5 12.4 5.3 11.7 M3.6 9.8 Q4.4 10.2 4.8 10.9'];
  const foldedFingers = ['oc-crease',
    'M-3.2 13.7 Q-3 12.2 -3.2 11.6 M-0.8 15 Q-0.5 13.4 -0.8 12.6 M1.8 15.5 Q2 14.2 1.8 13.5'];
  const fistContour = 'M4.4 0 C4.6 2.8 6.6 4.8 6.9 7.4 C7.2 9.3 6.7 11.4 5.5 12.6 L5.4 14.4 C5.4 16.1 4 16.8 2.9 15.8 C2.4 17.4 0.5 17.6 -0.5 16 C-1.3 17 -2.9 16.4 -3.4 14.9 C-4.5 15.4 -5.6 14.3 -5.7 12.8 C-6.1 8.3 -5.3 3.8 -4.4 0';
  const fist = handSilhouette(fistContour, [foldedFingers, foldedThumb, palmCreases]);

  const HANDS = {
    point: {
      behind: [], front: [handSilhouette(
        'M4.4 0 C4.8 2.8 6.7 4.7 6.9 7.2 C7.1 9 6.1 10.7 5.6 12.2 C5.3 15.8 5.6 20.7 5.3 24.5 C5.2 26.3 2.7 26.3 2.6 24.4 L2.5 15.1 C2.1 16.9 0.3 17.1 -0.6 15.2 C-1.2 16.3 -2.8 15.9 -3.3 14.3 C-4.5 15 -5.6 13.9 -5.7 12.4 C-6 8 -5.3 3.6 -4.4 0',
        [palmCreases, foldedThumb,
          ['oc-crease', 'M3.2 18.1 Q4 17.8 4.8 18.1 M3.2 22 Q4 21.7 4.7 22 M-3.1 13.6 L-3.2 11.8 M-0.6 14.7 L-0.8 12.8']],
      )], tip: [4, 25.8],
    },
    fist: { behind: [], front: [fist], hold: [0, 11, 0] },
    thumb: {
      behind: [], front: [handSilhouette(
        'M4.4 0 C5 2.6 6.8 4.2 7.3 7 C7.8 10.3 8.1 14.6 7.9 19.1 C7.8 21.2 5.4 21.6 5 19.3 L4.1 12.3 C4.2 14 4.4 15.4 3.6 16 C2.8 16.7 2 16.4 1.5 15.8 C0.8 17.3 -0.9 16.9 -1.6 15.5 C-2.5 16.2 -3.7 15.5 -4 14.2 C-4.9 14.5 -5.5 13.8 -5.6 12.7 C-6 8.1 -5.3 3.5 -4.4 0',
        [palmCreases, ['oc-crease', 'M5.2 14.8 Q6.2 14.3 7.3 14.5 M4.1 12.3 C2.7 11.5 0.2 11.2 -3.9 11.7 M1.5 15.8 L1.4 13.7 M-1.6 15.5 L-1.7 13.5 M-4 14.2 L-4.1 12.7']],
      )],
    },
    pinch: {
      behind: [], front: [handSilhouette(
        'M4.4 0 C5 2.7 7.2 4.9 8.1 7.5 L10 11.8 C10.7 13.5 10 15.4 8.4 16.1 C6.9 16.7 5.4 15.7 4.3 14.6 L2.8 13.1 C2.6 15 1.2 16.5 -0.2 15.5 C-1.1 16.2 -2.6 15.8 -3.2 14.3 C-4.4 14.9 -5.5 13.9 -5.7 12.4 C-6 8 -5.3 3.5 -4.4 0',
        [palmCreases, ['oc-crease', 'M4.5 6.7 C4.1 8.1 5.9 10.6 8.6 12.7 M8.6 12.7 C6.6 13.7 5.5 12.3 4.2 11 M-3 13.6 L-3.1 11.7 M-0.3 14.3 L-0.5 12.6']],
      )], hold: [8.6, 12.7, 60],
    },
    // The thumb crosses the curled index, with the shaft behind the fingers.
    grip: { behind: [], front: [fist], hold: [0, 11, 0], heldBehind: true },
  };

  /** Open fingers share one outer contour and properly formed web spaces.
   * Back views are the mirrored anatomy, with dorsal marks instead of palm
   * creases. This is an authored view change, not an isolated thumb flip. */
  function extendedHand({ spread = false, back = false, relaxed = false } = {}) {
    const contour = relaxed
      ? 'M4.4 0 C4.8 2.5 6 4.4 6.5 7.1 L7.1 13.6 C7.2 15.4 5.1 15.9 4.7 14.1 L4.1 10.8 L5.2 20.3 C5.4 22.2 3.2 22.7 2.9 20.8 L1.9 14.1 L1.9 22.5 C1.9 24.6 -0.5 24.7 -0.6 22.6 L-0.7 14.5 L-1.2 21.8 C-1.3 23.8 -3.5 23.5 -3.5 21.6 L-3.1 14 L-4 19.5 C-4.3 21.3 -6.4 20.9 -6.2 19.1 L-5.6 11.6 C-5.6 7.7 -5.2 3.5 -4.4 0'
      : spread
      ? 'M4.4 0 C4.8 2.6 6.2 4.7 8.1 6.4 L12.3 9 C14 10.1 12.6 12.5 11 11.5 L6.7 9.1 Q5.6 8.4 5.7 10.1 L8.6 20.9 C9.1 23.1 6.8 23.9 6.1 21.8 L3.1 13.8 Q2.7 12.7 2.7 14 L3 23.8 C3 26 0.5 26.1 0.4 23.9 L-0.1 14.1 Q-0.3 13 -0.7 14.1 L-2.5 22.8 C-2.9 24.9 -5.2 24.3 -4.8 22.2 L-3.2 13.7 Q-3 12.7 -3.6 13.5 L-7.1 19.7 C-8.2 21.5 -10.1 20.1 -9.2 18.5 L-5.6 11.9 C-4.6 9.1 -5.2 4 -4.4 0'
      : 'M4.4 0 C4.8 2.6 6.1 4.7 7.5 6.8 L10.6 12 C11.5 13.6 9.5 15 8.5 13.5 L6.3 10.4 Q5.1 9 5.1 10.8 L5.9 22.1 C6 24.1 3.8 24.3 3.6 22.3 L2.7 14 Q2.5 13.3 2.4 14 L2.5 24.1 C2.5 26.2 0 26.2 0 24.1 L-0.2 14.3 Q-0.3 13.5 -0.5 14.3 L-0.9 23 C-1 25 -3.3 24.8 -3.3 22.8 L-3 13.8 Q-3.1 13 -3.3 13.8 L-4.1 20.5 C-4.4 22.3 -6.5 21.9 -6.3 20.1 L-5.6 11.9 C-5.5 8.1 -5.3 3.6 -4.4 0';
    const details = relaxed ? [['oc-crease', 'M-4.7 16 L-3.7 16.2 M-2.8 17 L-1.5 17.1 M0 17.5 L1.3 17.5 M3.1 16.7 L4.1 16.5']] : back ? [
      ['oc-tendon', 'M-2.5 2.6 Q-3 6.6 -3.6 10.4 M-0.8 2.8 L-1.2 10.9 M1 2.8 L1.2 10.9'],
      ['oc-crease', 'M-4.9 16.3 L-3.8 16.4 M-2.6 17.5 L-1.4 17.5 M0.6 18 L1.9 18 M4.1 17.3 L5.2 17.2'],
      ['oc-nail', 'M-5.7 19.8 Q-5 19.3 -4.5 19.9 L-4.6 20.8 Q-5.3 21.3 -5.8 20.7 Z M-2.7 22.3 Q-2 21.8 -1.4 22.4 L-1.5 23.3 Q-2.2 23.8 -2.7 23.2 Z M0.6 23.3 Q1.2 22.8 1.9 23.3 L1.9 24.3 Q1.2 24.8 0.6 24.3 Z M4.1 21.6 Q4.7 21 5.3 21.5 L5.4 22.4 Q4.8 22.9 4.2 22.5 Z'],
    ] : [palmCreases, ['oc-crease', spread
      ? 'M-7 16.4 L-6 17 M-4.2 18 L-3 18.3 M0.5 18.4 L2 18.4 M5.2 17.7 L6.5 17.3 M9.1 9.2 L9.8 8.2'
      : 'M-5.1 16.3 L-4.1 16.4 M-2.7 17.5 L-1.4 17.5 M0.6 18 L1.9 18 M4 17.3 L5.2 17.2 M7.8 9.7 L8.8 9.1']];
    const part = handSilhouette(contour, details);
    // Reflection is baked into a group, retaining one continuous silhouette.
    part.transform = back ? 'scale(-1 1)' : null;
    return { behind: [], front: [part] };
  }
  HANDS.open = extendedHand();
  HANDS.spread = extendedHand({ spread: true });
  HANDS.flat = extendedHand({ back: true });
  HANDS.rest = extendedHand({ back: true, relaxed: true });
  // A side view of an upturned supporting hand: compact fingers beneath
  // the load, with the thumb rising over its front rim. +x faces upward
  // when the fingers point right; this is not a dorsal waving hand.
  HANDS.support = {
    behind: [], front: [handSilhouette(
      'M4.4 0 C4.6 2.5 6.2 4.5 7.8 6.5 L9.1 10.8 C9.7 12.8 8.2 14.1 6.9 12.8 L4.8 10.6 C4.5 13.5 4.7 17.6 4.7 21.8 C4.7 24 2.9 24.6 1.7 23.4 C0.9 24.6 -0.9 24.1 -1.4 22.6 C-2.4 23.2 -3.9 22.2 -3.8 20.5 C-4.8 20.7 -5.6 19.3 -5.3 18 L-4.7 10 C-4.4 6 -4.4 3 -4.4 0',
      [['oc-crease', 'M4.8 10.6 Q3.2 8.9 2.6 6.5 M1.7 23.4 L1.6 16.6 M-1.4 22.6 L-1.2 16 M-3.8 20.5 L-3.4 15.4']],
    )], contact: [4.6, 17],
  };
  // Thin objects lie between the supporting fingers and the opposing thumb.
  HANDS.edge = {
    behind: [fist], front: [handPart(
      'M5.8 6.3 C5.5 8.2 3.6 9.8 1.2 11 C0.3 11.5 0.5 12.8 1.6 13 C3.1 13.2 4.5 12.4 5.3 11.7 C6.4 10.1 6.5 8.3 5.8 6.3 Z',
      'M5.8 6.3 C5.5 8.2 3.6 9.8 1.2 11 C0.3 11.5 0.5 12.8 1.6 13 C3.1 13.2 4.5 12.4 5.3 11.7',
      [['oc-crease', 'M3.6 9.8 Q4.4 10.2 4.8 10.9']],
    )],
  };

  function drawHandParts(parent, parts) {
    for (const { fill, ink, details, transform } of parts) {
      const layer = transform ? svg('g', { transform }, parent) : parent;
      svg('path', { class: 'oc-skin', d: fill }, layer);
      svg('path', { class: 'oc-hand-outline', d: ink }, layer);
      for (const [cls, d] of details || []) svg('path', { class: cls, d }, layer);
    }
  }

  // ------------------------------------------------------------------
  // Poses
  // ------------------------------------------------------------------

  /**
   * At rest the arms hang easy.
   *   right, left   [upper, forearm] raise in degrees (0 hangs, 180 is up),
   *                 the picture's right and left arms (the left mirrored)
   *   rightLift,
   *   leftLift      0–1, how far the upper arm comes forward at the viewer
   *   rightHand,
   *   leftHand      the hand's turn at the wrist (degrees, within WRIST_RANGE)
   *   rightShape,
   *   leftShape     which hand (HANDS)
   *   look, down    the eyes' glance: −1 … 1 left … right, and down
   *   brow          0–1 brows raised; frown 0–1 knitted
   *   smile         −1 … 1 the mouth's corners down … up (drawn faces)
   *   wide          0–1 eyes wide; happy 0–1 eyes shut in a smile
   *   sweat, blush  0–1
   *   nod, tilt     0–1 a dip of the head; its tilt in degrees
   *   crouch        0–1 a give at the knees; hop: how high it jumps
   *   lean          degrees the figure leans about its feet
   *   age           0–1 the hair (brows, beard) gone silver
   *   mask          0–1 a sleep mask pulled down over the eyes
   */
  const REST = {
    right: [4, -6], rightLift: 0, rightHand: -8, rightShape: 'rest',
    left: [4, -6], leftLift: 0, leftHand: -8, leftShape: 'rest',
    look: 0, down: 0, brow: 0, frown: 0, smile: 0.4, wide: 0, happy: 0, round: 0, sweat: 0, blush: 0,
    nod: 0, tilt: 0, crouch: 0, hop: 0, lean: 0, age: 0, mask: 0,
  };
  const DISCRETE = new Set(['rightShape', 'leftShape']);
  const poseTracks = new WeakMap();
  // Zero velocity and acceleration at both ends, without the cubic
  // ease-in/out's sudden acceleration reversal halfway through a gesture.
  const easePose = (u) => u ** 3 * (10 + u * (-15 + 6 * u));

  function samplePoseKey(key, t, reduced) {
    const { start, duration, from, target, discrete } = key;
    const u = reduced ? 1 : easePose(progress(t, start, duration));
    if (discrete) return u >= 0.4 ? target : from;
    return Array.isArray(target)
      ? target.map((value, i) => from[i] + (value - from[i]) * u)
      : from + (target - from) * u;
  }

  function tracksFor(keys) {
    if (poseTracks.has(keys)) return poseTracks.get(keys);
    const tracks = new Map();
    for (const [start, duration, fields] of keys) {
      for (const [name, target] of Object.entries(fields)) {
        if (!tracks.has(name)) tracks.set(name, []);
        const track = tracks.get(name);
        const previous = track.at(-1);
        const from = previous ? samplePoseKey(previous, start, false) : REST[name];
        track.push({ start, duration, from, target, discrete: DISCRETE.has(name) });
      }
    }
    poseTracks.set(keys, tracks);
    return tracks;
  }

  /** The pose at song time t: each key eases its fields from wherever they are when it starts, in cue order. */
  function poseAt(keys, t, reduced) {
    const pose = { ...REST };
    for (const [name, track] of tracksFor(keys)) {
      const key = track.findLast((entry) => entry.start <= t);
      if (key) pose[name] = samplePoseKey(key, t, reduced);
    }
    return pose;
  }

  // ------------------------------------------------------------------
  // The body, in figure units: a unisex build, shoulders little wider
  // than the hips, with no waist shaping. Each costume draws over it.
  // ------------------------------------------------------------------

  // A top from the neck to the hips; attached sleeves meet it beneath its details.
  const TOP = 'M73.6 78.6 C70 79.6 62 82.4 56.6 85.2 C52.6 87.4 51.4 92.6 53.4 98 C55.4 103.6 57.6 108.4 58.4 114 C59 124 58.6 134 58.8 142 C58.9 148 58.2 153 57.6 157.4 C66 159.2 94 159.2 102.4 157.4 C101.8 153 101.1 148 101.2 142 C101.4 134 101 124 101.6 114 C102.4 108.4 104.6 103.6 106.6 98 C108.6 92.6 107.4 87.4 103.4 85.2 C98 82.4 90 79.6 86.4 78.6 C84 80.2 76 80.2 73.6 78.6 Z';
  const NECK = 'M74.4 58 C74.6 66 74.2 74 73.4 82.6 L86.6 82.6 C85.8 74 85.4 66 85.6 58 Z';
  const NECK_SHADE = 'M74.4 64.4 C77.8 67.4 82.2 67.4 85.6 64.4 L85.7 68.6 C82.2 71.4 77.8 71.4 74.3 68.6 Z';

  // Straight trousers: the standing leg in under the body, the free leg's
  // knee come forward and in, its foot out. Their tops lie under the top.
  const LEGS = [
    'M80 150 L58.6 150 C57.2 156 56.8 163 57 170 C57.6 190 60 210 62 230 C62.6 245 63.4 264 64.4 284.6 C69 286.4 75 286.4 79.4 284.4 C79 270 78.4 250 78.6 236 C78.8 220 80 196 80 176 Z',
    'M80 151 L101.4 152 C102.8 157 103.4 163 103.2 170 C102.6 190 100.4 210 98.8 230 C98.4 246 100 266 102.4 286 C97.6 288 91.6 288.2 87.6 286.4 C86.6 270 85 250 84.6 236 C84.2 220 82 196 80.6 176 Z',
  ];
  // Each leg's details: its inner shadow, its seam, its folds, its pocket.
  const LEG_DETAIL = [
    [
      ['oc-leg-shadow', 'M80 176 C80 196 78.8 220 78.6 236 C77.4 226 76.8 214 76.8 204 C77.2 194 77.8 184 78.2 176.6 Z'],
      ['oc-seam', 'M69.4 154 C69.8 190 70.8 240 71.8 285'],
      ['oc-fold', 'M65 278.2 C69 279.8 75 280 79.4 278.4'],
      ['oc-pocket', 'M63.4 152 C62 157 60.2 162 58.2 165.6'],
    ],
    [
      ['oc-leg-shadow', 'M80.6 176 C82 196 84.2 220 84.6 236 C85.8 226 86.4 214 86.4 204 C85.6 194 84.4 184 83.2 176.8 Z'],
      ['oc-seam', 'M91.6 156 C91.6 184 91.4 208 91.6 228 C92 248 93.8 268 95.6 287.4'],
      ['oc-fold', 'M85.4 218 C88.2 220.2 91.2 221.2 93.8 221 M89.6 234.2 C92.2 232.2 95.6 231.8 98.6 232.6 M88 280.6 C92.4 282.4 98.8 282.6 103.4 280.8'],
      ['oc-pocket', 'M96.6 154.4 C98.2 159.2 100.2 163.6 102.2 167'],
    ],
  ];
  // Where each leg turns as it swings: the hip joints.
  const HIPS = [[69, 152], [91, 153]];
  // Shoes from the front, toes turned out a little: the standing foot's to
  // the picture's left, the free foot's, set forward, to its right; each
  // heel goes back under its hem. Each is the sole (the whole shoe's shape
  // under the upper, so it shows as a band along the ground) and the upper.
  const FEET = [
    {
      sole: 'M80.2 282.8 C82.4 284.4 83.8 287.4 83.8 290.2 C83.8 292.2 83 293.6 81.4 294 C74.6 294.8 63.4 294.8 57.2 294 C54.6 293.6 53.4 292 53.8 290 C54.4 287.8 57.2 286.2 60.6 285 C62.2 284.4 63.4 283.8 64.2 282.8 Z',
      upper: 'M80.2 282.8 C82.2 284.2 83.4 286.6 83.6 288.8 C83.4 289.6 82.6 290 81.6 290.2 C74.8 290.8 63.8 290.8 57.6 290.2 C55.6 290 54.4 289.4 54.4 288.6 C54.8 287 57.2 285.8 60.6 285 C62.2 284.4 63.4 283.8 64.2 282.8 Z',
      toe: 'M54.6 289.2 C55.6 287.6 57.6 286.6 60 286',
      laces: 'M66.4 284.6 L76.4 284.4 M66 286.4 L77 286.2 M65.8 288.2 L77.4 288',
      turn: 'M80.2 282.8 C82.4 284.4 83.8 287.4 83.8 290 C83.6 291 82.8 291.6 81.6 291.8 C80.4 291.9 79 292 77.6 292.1 C79 289.6 79.4 286.4 78.6 283.6 Z',
    },
    {
      sole: 'M88.4 285.2 C86.6 286.8 85.6 289.6 85.6 292 C85.6 294 86.6 295.6 88.4 296 C94.6 297.2 107.2 297.4 112.8 296.4 C115.4 296 116.8 294.2 116 292.2 C115.2 289.8 111.8 287.8 107.4 286.6 C106.2 286.2 105.2 285.8 104.4 285.2 Z',
      upper: 'M88.4 285.2 C86.8 286.6 85.8 289 85.8 290.8 C86 291.8 87 292.6 88.4 292.9 C94.6 294 107 294.2 112.6 293.2 C114.6 292.8 115.6 292 115.6 291.2 C115 289.2 111.8 287.6 107.4 286.6 C106.2 286.2 105.2 285.8 104.4 285.2 Z',
      toe: 'M106.4 288.2 C109 288.8 111.4 289.8 113 291',
      laces: 'M90.6 287.4 L100.6 287.6 M90.2 289.2 L101.4 289.4 M90 291 L102 291.2',
      turn: 'M88.4 285.2 C86.6 286.8 85.6 289.6 85.6 291.8 C85.8 293 86.8 294 88.4 294.4 C89.6 294.6 90.8 294.8 92 294.9 C90.6 292.2 90.4 289 91.4 286 Z',
    },
  ];

  // The arm (the picture's right): the sleeve from its round head, set on
  // the shoulder, to the elbow; below it the forearm, which starts round
  // the elbow so it turns there without a seam, and ends round the wrist.
  const SLEEVE = 'M96 99.6 A9 9 0 1 1 113.2 95.2 C114.4 104 115.6 117 116.1 128 C116.4 133 116.4 137 116.2 140 A7.2 7.2 0 0 1 101.8 140.4 C101.8 131 102.4 119 103 111.4 C101.4 106 98.8 101.6 96 99.6 Z';
  const SLEEVE_FOLDS = 'M104.4 112.6 C107.4 118.8 110.4 125 113.6 130.4 M111.6 101.4 C112.6 109 113 116 112.8 123';
  // A long sleeve's forearm, from round the elbow to its cuff at the wrist.
  const FORE_SLEEVE = 'M102.2 138.6 A6.9 6.9 0 0 1 116 138.2 C116.2 146 115.8 154 115.2 161 C114.8 165 114.4 168.6 114.2 171.4 L106.8 171.6 C106.2 168.4 105.4 165 104.6 161.4 C103.2 155 102.2 146.6 102.2 138.6 Z';
  const FORE_SLEEVE_FOLDS = 'M104.4 146.8 C107.6 148.4 111.8 148.2 115.2 146.4 M105.2 156.2 C108.4 157.2 111.6 157 114.6 155.6';
  const CUFF = 'M105.4 166.8 C108.8 168 112.6 168 115.6 166.6 L115.2 172.6 C112.4 174 108.6 174 106 172.8 Z';
  // A bare forearm, from round the elbow to round the wrist.
  const FOREARM = 'M102.6 140.4 A6.6 6.6 0 0 1 115.8 140 C116.4 146 116 153 115.4 160 C115 164.6 114.6 168.6 114.4 172.4 A3.8 3.8 0 0 1 106.8 172.4 C106.2 169.6 105.4 166.4 104.6 163.2 C103.2 157 102.4 149 102.6 140.4 Z';
  const FOREARM_DETAIL = [
    ['oc-limb-shade', 'M115.8 140 C116.4 146 116 153 115.4 160 C115 164.6 114.6 168.6 114.4 172.4 L111.6 172.4 C112.2 165 112.6 154 112 140.4 Z'],
    ['oc-muscle', 'M114 147.4 C112.6 153 111.4 159.4 110.8 166'],
    ['oc-wrist-crease', 'M107.2 171.6 C109.4 172.2 112 172.2 114.2 171.6'],
  ];
  // ------------------------------------------------------------------
  // The Teammate's face, drawn in head units: the chin at (0, 0), the face
  // 100 wide; placed on the neck by drawnHead(). A towering pompadour with
  // a curl on the brow, sideburns, heavy brows, a strong nose, a twirled
  // moustache, and a cleft chin.
  // ------------------------------------------------------------------

  const TENOR_HEAD = {
    width: 40, detailed: true,
    face: 'M-49 -74 C-50 -104 -28 -127 0 -127 C28 -127 50 -104 49 -74 C48.4 -52 44 -33 35 -19 C26.6 -7 14.6 0 0 0 C-14.6 0 -26.6 -7 -35 -19 C-44 -33 -48.4 -52 -49 -74 Z',
    jawShade: 'M49 -74 C48.4 -52 44 -33 35 -19 C26.6 -7 14.6 0 0 0 C12 -4 22 -12 30 -24 C38 -37 42 -54 43 -74 C44 -88 44 -98 42 -106 C47 -98 49.6 -86 49 -74 Z',
    ear: 'M-47 -79 C-57 -86 -63 -73 -61 -62 C-59 -51 -53 -46 -46 -50 Z',
    earInner: 'M-50 -75 C-56 -76 -58 -68 -56 -61 C-55 -57 -52 -55 -49 -56',
    hair: 'M-51 -64 C-58 -92 -56 -122 -40 -146 C-28 -166 -8 -180 16 -180 C38 -180 56 -166 62 -144 C66 -128 61 -106 55 -92 C54 -84 52.4 -76 50 -66 C47.6 -79 45 -90 40 -98 C32 -106 18 -110 2 -110 C-14 -110 -30 -105 -40 -96 C-45 -88 -48.4 -78 -51 -64 Z',
    hairShade: 'M62 -144 C66 -128 61 -106 55 -92 C54 -84 52.4 -76 50 -66 C47.6 -79 45 -90 40 -98 C46 -108 52 -122 54 -138 C55 -150 52 -164 48 -170 C55 -164 60 -156 62 -144 Z',
    hairStrands: 'M-30 -106 C-34 -130 -24 -156 -2 -170 M-14 -110 C-14 -136 -4 -158 18 -170 M2 -110 C6 -134 18 -154 38 -164 M18 -108 C26 -128 38 -144 54 -150 M-42 -98 C-48 -118 -42 -140 -28 -156',
    hairSheen: 'M-40 -122 C-34 -150 -16 -170 8 -173 M-24 -118 C-20 -140 -8 -156 10 -162',
    sideburns: ['M-49.4 -70 C-50.6 -62 -50.4 -54 -48.4 -46 L-44.6 -48 C-45 -56 -45 -63 -44.4 -70 Z', 'M49.4 -70 C50.6 -62 50.4 -54 48.4 -46 L44.6 -48 C45 -56 45 -63 44.4 -70 Z'],
    brows: ['M-35 -85 C-29 -90 -20 -92 -11 -88.5 Q-9 -87 -10 -85.8 C-19 -88 -27 -85.8 -34 -82.8 Z', 'M35 -85 C29 -90 20 -92 11 -88.5 Q9 -87 10 -85.8 C19 -88 27 -85.8 34 -82.8 Z'],
    eyes: [-21, 21],
    eyeY: -70,
    nose: 'M-1.8 -68 C-2.4 -58 -4.2 -50 -6.5 -44 C-8 -40 -4.4 -37.6 0 -38.4 C4.4 -36.8 8.4 -39 7.8 -42.8 C5.2 -48 3.3 -58 2 -68 Z',
    noseLight: 'M-0.5 -61 C-1 -55 -2 -49 -3 -45',
    nostrils: 'M-5.1 -40.2 Q-3.6 -41.4 -2.1 -40.1 M3.5 -40 Q5 -41.2 6.2 -40',
    moustache: 'M0 -29.6 C-6 -33 -14 -33 -20 -29 C-26 -25 -30 -25.4 -34 -28.4 C-36.4 -30.4 -35.4 -33.8 -32 -33.4 C-34 -30.6 -31.4 -29.4 -29.4 -31.2 C-24 -36.4 -12 -36.6 -4 -31.6 C-2 -30.6 2 -30.6 4 -31.6 C12 -36.6 24 -36.4 29.4 -31.2 C31.4 -29.4 34 -30.6 32 -33.4 C35.4 -33.8 36.4 -30.4 34 -28.4 C30 -25.4 26 -25 20 -29 C14 -33 6 -33 0 -29.6 Z',
    moustacheSheen: 'M-22 -33 C-16 -35 -8 -34.6 -3 -32.4 M22 -33 C16 -35 8 -34.6 3 -32.4',
    mouth: { y: -20, halfWidth: 13 },
    dimple: 'M-2.4 -6.4 C-1.2 -4.2 1.2 -4.2 2.4 -6.4',
    cheeks: [[-30, -45], [30, -45]],
  };

  // A teammate's face for export stages, which never load the hero
  // renderer: unisex, a short tousled crop, no moustache.
  const TEAMMATE_HEAD = {
    width: 35,
    face: 'M-47 -74 C-48 -104 -27 -125 0 -125 C27 -125 48 -104 47 -74 C46.4 -52 42 -34 33.6 -20 C25.6 -8 14 0 0 0 C-14 0 -25.6 -8 -33.6 -20 C-42 -34 -46.4 -52 -47 -74 Z',
    jawShade: 'M47 -74 C46.4 -52 42 -34 33.6 -20 C25.6 -8 14 0 0 0 C11.4 -4 21 -12 28.8 -24 C36.4 -37 40.4 -54 41.4 -74 C42.4 -88 42.4 -98 40.4 -106 C45 -98 47.6 -86 47 -74 Z',
    ear: 'M-45 -78 C-55 -85 -60 -72 -58.4 -62 C-56.6 -52 -51 -47 -44.4 -51 Z',
    earInner: 'M-48 -74 C-53.6 -75 -55.6 -68 -53.8 -61.4 C-52.8 -57.6 -50 -55.6 -47.2 -56.4',
    hair: 'M-50 -70 C-57 -100 -45 -133 -12 -139 C15 -143 45 -131 53 -104 C57 -91 55 -79 50.4 -69 C48.4 -81 44.6 -91 38.4 -99 C27 -95 13 -99 4 -108 C-6 -97 -24 -95 -40 -97.6 C-44.4 -89.6 -47.4 -80 -50 -70 Z',
    hairShade: 'M53 -104 C57 -91 55 -79 50.4 -69 C48.4 -81 44.6 -91 38.4 -99 C43 -106 48 -118 49 -130 C51.6 -122 52.6 -112 53 -104 Z',
    hairStrands: 'M-36 -100 C-30 -116 -16 -128 2 -132 M-10 -104 C-4 -120 10 -130 28 -128 M8 -106 C16 -120 30 -124 44 -116',
    hairSheen: 'M-30 -118 C-20 -128 -6 -134 10 -135',
    eyes: [-20, 20],
    eyeY: -70,
    brows: ['M-32 -84 C-27 -89 -17 -89.6 -9.4 -86.4 C-11 -84.8 -18 -85.2 -30.6 -81.4 Z', 'M32 -84 C27 -89 17 -89.6 9.4 -86.4 C11 -84.8 18 -85.2 30.6 -81.4 Z'],
    nose: 'M-1 -68 C-1.6 -60 -4 -50 -6 -44 C-4.4 -39.6 -0.6 -39 1.6 -40.2 C4 -39 7.4 -40 7.6 -43.6 C5.4 -49 2.6 -58 1.8 -68',
    noseLight: 'M0 -64 C-0.4 -57 -1.4 -51 -2.6 -46.6',
    nostrils: 'M-3.8 -41.4 C-3 -40.2 -1.4 -40.2 -0.8 -41 M3.4 -41 C4 -40.2 5.6 -40.2 6.2 -41.4',
    mouth: { y: -22, halfWidth: 11 },
    cheeks: [[-28, -46], [28, -46]],
  };

  // A woman's face for export stages, for a role a woman sings: long hair
  // with a side-swept fringe that falls past the ears to the shoulders
  // (backHair: two lengths either side of the neck, over the collar),
  // finer arched brows, lashes flicked at the outer corners, a softer jaw.
  const WOMAN_HEAD = {
    width: 34,
    face: 'M-46 -74 C-47 -104 -26.6 -125 0 -125 C26.6 -125 47 -104 46 -74 C45.4 -54 40.6 -37 32.4 -23 C24.4 -10 13.4 0 0 0 C-13.4 0 -24.4 -10 -32.4 -23 C-40.6 -37 -45.4 -54 -46 -74 Z',
    jawShade: 'M46 -74 C45.4 -54 40.6 -37 32.4 -23 C24.4 -10 13.4 0 0 0 C11 -4 20.4 -13 27.8 -26 C35.4 -39 39.6 -55 40.6 -74 C41.6 -88 41.6 -98 39.6 -106 C44.2 -98 46.6 -86 46 -74 Z',
    ear: 'M-45 -78 C-55 -85 -60 -72 -58.4 -62 C-56.6 -52 -51 -47 -44.4 -51 Z',
    earInner: 'M-48 -74 C-53.6 -75 -55.6 -68 -53.8 -61.4 C-52.8 -57.6 -50 -55.6 -47.2 -56.4',
    backHair: 'M0 -146 C-30 -146 -56 -128 -60 -96 C-63 -70 -62 -40 -60 -12 C-58.6 10 -61 30 -64 46 C-60 54 -52 58 -44 56 C-40 44 -36 28 -32 8 C-30 -2 -28 -10 -26 -14 L26 -14 C28 -10 30 -2 32 8 C36 28 40 44 44 56 C52 58 60 54 64 46 C61 30 58.6 10 60 -12 C62 -40 63 -70 60 -96 C56 -128 30 -146 0 -146 Z',
    backHairShade: 'M44 56 C52 58 60 54 64 46 C61 30 58.6 10 60 -12 C57 6 55 26 54 40 C52 48 48 53 44 56 Z',
    backHairStrands: 'M-54 -40 C-52 -10 -54 20 -57 44 M-46 -20 C-42 4 -42 26 -45 48 M54 -40 C52 -10 54 20 57 44 M46 -20 C42 4 42 26 45 48',
    hair: 'M-54 -36 C-62 -70 -60 -112 -36 -134 C-18 -148 18 -150 38 -138 C57 -126 63 -98 61 -70 C60 -56 57 -44 53 -36 C49 -52 47 -68 46 -82 C43 -94 36 -100 26 -102 C10 -104 -4 -110 -13 -121 C-20 -112 -32 -104 -40 -94 C-45 -86 -47 -72 -47 -58 C-48 -50 -50 -42 -54 -36 Z',
    hairShade: 'M61 -70 C60 -56 57 -44 53 -36 C49 -52 47 -68 46 -82 C50 -92 55 -106 55 -120 C60 -108 62 -88 61 -70 Z',
    hairStrands: 'M-12 -128 C2 -132 22 -128 40 -116 M-8 -120 C8 -120 26 -114 44 -100 M-20 -130 C-32 -128 -44 -116 -52 -96 M-26 -122 C-36 -116 -46 -102 -52 -82 M56 -72 C56 -60 55 -50 53 -42 M-56 -70 C-57 -58 -56 -48 -54 -42',
    hairSheen: 'M-40 -124 C-30 -136 -14 -142 4 -143 M-30 -118 C-22 -128 -8 -134 8 -135',
    eyes: [-20, 20],
    eyeY: -70,
    lashes: true,
    brows: ['M-31 -86 C-25 -93 -15 -93.4 -8.6 -89 C-10 -88 -16.4 -89.2 -29.8 -84 Z', 'M31 -86 C25 -93 15 -93.4 8.6 -89 C10 -88 16.4 -89.2 29.8 -84 Z'],
    nose: 'M-0.8 -67 C-1.4 -60 -3.4 -51 -5.2 -45.6 C-3.8 -41.4 -0.4 -40.8 1.4 -41.8 C3.6 -40.8 6.4 -41.6 6.6 -45 C4.8 -50 2.4 -58 1.6 -67',
    noseLight: 'M0 -63 C-0.4 -57 -1.2 -52 -2.2 -48',
    nostrils: 'M-3.2 -43 C-2.6 -42 -1.2 -42 -0.6 -42.6 M3 -42.6 C3.6 -42 5 -42 5.6 -43',
    mouth: { y: -23, halfWidth: 10.4 },
    cheeks: [[-27, -46], [27, -46]],
  };

  /**
   * A mouth at openness `open` (0 shut … 1 wide), `smile` (−1 … 1) and
   * `round` (0 … 1, an "O"), in head units: its lips, the dark inside, the
   * upper teeth, and the tongue (as path data), or just the line of a shut
   * mouth.
   */
  function mouthShape({ y, halfWidth }, open, smile, round) {
    const hw = halfWidth * (1 - 0.38 * round);
    const corner = y - 3 * smile;
    const h = 17 * open;
    const upper = y - 1.6 - 0.18 * h;
    const lower = y + 0.8 + h;
    const f = (n) => n.toFixed(2);
    if (h < 1.2) {
      return { line: `M${f(-hw)} ${f(corner)} Q0 ${f(y + 1.2 + 3.4 * smile)} ${f(hw)} ${f(corner)}` };
    }
    const inside = `M${f(-hw)} ${f(corner)} C${f(-hw * 0.55)} ${f(upper)} ${f(hw * 0.55)} ${f(upper)} ${f(hw)} ${f(corner)} C${f(hw * 0.7)} ${f(lower + h * 0.08)} ${f(-hw * 0.7)} ${f(lower + h * 0.08)} ${f(-hw)} ${f(corner)} Z`;
    const teeth = `M${f(-hw * 0.78)} ${f(corner + 0.4)} C${f(-hw * 0.45)} ${f(upper + 0.2)} ${f(hw * 0.45)} ${f(upper + 0.2)} ${f(hw * 0.78)} ${f(corner + 0.4)} L${f(hw * 0.7)} ${f(upper + Math.min(4.4, 0.32 * h) + 1)} C${f(hw * 0.3)} ${f(upper + Math.min(4.4, 0.32 * h) + 1.6)} ${f(-hw * 0.3)} ${f(upper + Math.min(4.4, 0.32 * h) + 1.6)} ${f(-hw * 0.7)} ${f(upper + Math.min(4.4, 0.32 * h) + 1)} Z`;
    const tongueTop = lower - Math.min(6, 0.42 * h);
    const tongue = `M${f(-hw * 0.6)} ${f(lower)} C${f(-hw * 0.5)} ${f(tongueTop)} ${f(hw * 0.5)} ${f(tongueTop)} ${f(hw * 0.6)} ${f(lower)} Z`;
    const lip = `M${f(-hw * 0.6)} ${f(lower + h * 0.06 + 1.4)} C${f(-hw * 0.2)} ${f(lower + h * 0.08 + 3)} ${f(hw * 0.2)} ${f(lower + h * 0.08 + 3)} ${f(hw * 0.6)} ${f(lower + h * 0.06 + 1.4)}`;
    return { inside, teeth, tongue, lip };
  }

  // ------------------------------------------------------------------
  // Drawing helpers
  // ------------------------------------------------------------------

  /** Draws [class, path] parts into parent, in order. */
  function drawParts(parent, parts) {
    return parts.map(([cls, d]) => svg('path', { class: cls, d }, parent));
  }

  /** A part with its ink under its fill (twice the line width), so overlapping parts keep one outline. */
  function inked(parent, d, cls, inkCls = 'oc-ink', fill) {
    svg('path', { class: inkCls, d }, parent);
    return svg('path', { class: cls, d, ...(fill ? { fill } : {}) }, parent);
  }

  /** Torso outlines sit beneath BOTH torso and sleeves, so their overlap
   * is cloth, not an inked socket. Vest armholes keep their own seam. */
  function garment(parent, d, cls, paint, fill) {
    const outline = svg('g', { transform: parent.getAttribute('transform') || '' }, paint.garmentOutline);
    svg('path', { class: 'oc-ink oc-ink--cool', d }, outline);
    const cloth = fill === paint.top && parent.getAttribute('transform') === MIRROR ? paint.topLeft : fill;
    const surface = svg('path', { class: cls, d, ...(cloth ? { fill: cloth } : {}) }, parent);
    shadeCloth(parent, d, paint);
    return surface;
  }

  /** Broad, continuous light gives cloth volume without polygonal panels. */
  function shadeCloth(parent, d, paint) {
    const mirrored = parent.getAttribute('transform') === MIRROR;
    for (const name of ['clothDepth', 'clothGlow']) {
      svg('path', { class: 'oc-surface-volume', d, fill: paint[mirrored ? `${name}Left` : name] }, parent);
    }
  }

  // ------------------------------------------------------------------
  // Faces
  // ------------------------------------------------------------------

  /**
   * A drawn face (spec: TENOR_HEAD or a teammate's) in `parent`, placed so
   * its chin sits on the neck. Returns set(p, time, mouth) for the pose's
   * expression: glance, brows, eyes wide or smiling shut, a blink on the
   * song clock, blush and sweat, and the mouth's openness and shape.
   */
  function drawnHead(parent, spec, paint) {
    const scale = spec.width / 100;
    const g = svg('g', { class: `oc-face${spec.detailed ? ' oc-face--detailed' : ''}`, transform: `translate(${HEAD.x} ${HEAD.chin}) scale(${scale.toFixed(4)})` }, parent);
    const ink = (d, cls) => inked(g, d, cls, 'oc-ink oc-ink--face');
    // Long hair behind the ears and face; it falls over the collar.
    if (spec.backHair) {
      ink(spec.backHair, 'oc-hair');
      svg('path', { class: 'oc-hair-shade', d: spec.backHairShade }, g);
      svg('path', { class: 'oc-hair-strand', d: spec.backHairStrands }, g);
    }
    for (const side of [1, -1]) {
      const ear = svg('g', { transform: side < 0 ? 'scale(-1 1)' : '' }, g);
      inked(ear, spec.ear, 'oc-face-skin', 'oc-ink oc-ink--face', paint.face);
      svg('path', { class: 'oc-ear-line', d: spec.earInner }, ear);
      if (spec.detailed) {
        svg('path', { class: 'oc-face-plane', d: 'M-50 -72 C-56 -73 -57 -66 -54 -61 L-49 -59 C-51 -64 -48 -67 -50 -72 Z' }, ear);
        svg('path', { class: 'oc-face-contour', d: 'M-51 -69 C-54 -68 -54 -64 -51 -63 M-50 -58 Q-52 -54 -55 -57' }, ear);
      }
    }
    inked(g, spec.face, 'oc-face-skin', 'oc-ink oc-ink--face', paint.face);
    svg('path', { class: 'oc-face-shade', d: spec.jawShade }, g);
    const cheeks = spec.cheeks.map(([cx, cy]) => svg('ellipse', { class: spec.detailed ? 'oc-cheek-color' : 'oc-blush', ...(spec.detailed ? { fill: paint.blush } : {}), cx, cy, rx: spec.detailed ? 15 : 9, ry: spec.detailed ? 10 : 5.4 }, g));
    for (const d of spec.sideburns || []) svg('path', { class: 'oc-hair', d }, g);
    if (spec.detailed) inked(g, spec.hair, 'oc-rendered-hair', 'oc-ink oc-ink--face', paint.hair);
    else ink(spec.hair, 'oc-hair');
    const hairClip = svg('clipPath', { id: `oc-hair-detail-${++uid}` }, paint.defs);
    svg('path', { d: spec.hair }, hairClip);
    const hairDetail = svg('g', { 'clip-path': `url(#${hairClip.id})` }, g);
    svg('path', { class: 'oc-hair-shade', d: spec.hairShade }, hairDetail);
    svg('path', { class: 'oc-hair-strand', d: spec.hairStrands }, hairDetail);
    svg('path', { class: 'oc-hair-sheen', d: spec.hairSheen }, hairDetail);
    if (spec.detailed) drawParts(hairDetail, [
      ['oc-hair-fine', 'M-44 -102 C-47 -128 -33 -152 -15 -161 M-36 -108 C-38 -134 -23 -156 -5 -165 M-22 -110 C-22 -133 -7 -157 14 -167 M-5 -110 C-1 -137 17 -155 35 -164 M12 -109 C21 -131 35 -146 49 -151 M28 -104 C39 -120 49 -132 55 -141 M41 -96 Q49 -111 53 -123'],
      ['oc-hair-glint', 'M-43 -130 C-35 -152 -15 -169 5 -173 M-32 -128 C-25 -147 -13 -158 1 -164 M-13 -128 C-5 -145 8 -156 20 -160'],
    ]);
    if (spec.curl) svg('path', { class: 'oc-hair-curl', d: spec.curl }, g);
    // Eyes: the white, then the iris, pupil, and catchlights clipped to it,
    // then the upper lid's line; a lid of skin closes over it to blink, and
    // a smiling arc replaces it when the eyes shut happily.
    const eyes = spec.eyes.map((ex) => {
      const eye = svg('g', {}, g);
      const white = `M${ex - 11} ${spec.eyeY} C${ex - 7} ${spec.eyeY - 6.4} ${ex + 7} ${spec.eyeY - 6.4} ${ex + 11} ${spec.eyeY} C${ex + 7} ${spec.eyeY + 5} ${ex - 7} ${spec.eyeY + 5} ${ex - 11} ${spec.eyeY} Z`;
      const clip = svg('clipPath', { id: `oc-eye-${++uid}` }, paint.defs);
      svg('path', { d: white }, clip);
      const open = svg('g', {}, eye);
      svg('path', { class: 'oc-eye-white', d: white }, open);
      const iris = svg('g', { 'clip-path': `url(#${clip.id})` }, open);
      const look = svg('g', {}, iris);
      svg('circle', { class: spec.detailed ? 'oc-rendered-iris' : 'oc-iris', ...(spec.detailed ? { fill: paint.iris } : {}), cx: ex, cy: spec.eyeY + 0.4, r: 5.2 }, look);
      if (spec.detailed) {
        svg('circle', { class: 'oc-iris-rim', cx: ex, cy: spec.eyeY + 0.4, r: 5.1 }, look);
        const rays = Array.from({ length: 13 }, (_, i) => {
          const a = i * Math.PI * 2 / 13;
          return `M${ex + 3.1 * Math.cos(a)} ${spec.eyeY + 0.4 + 3.1 * Math.sin(a)} L${ex + 4.5 * Math.cos(a)} ${spec.eyeY + 0.4 + 4.5 * Math.sin(a)}`;
        }).join(' ');
        svg('path', { class: 'oc-iris-fiber', d: rays }, look);
      }
      svg('circle', { class: 'oc-pupil', cx: ex, cy: spec.eyeY + 0.4, r: 2.6 }, look);
      svg('circle', { class: 'oc-catchlight', cx: ex - 1.8, cy: spec.eyeY - 1.6, r: spec.detailed ? 1.15 : 1.5 }, look);
      svg('circle', { class: 'oc-catchlight oc-catchlight--soft', cx: ex + 1.6, cy: spec.eyeY + 2.2, r: 0.6 }, look);
      const lid = svg('path', { class: 'oc-lid', d: '' }, open);
      svg('path', { class: 'oc-lash-line', d: `M${ex - 12} ${spec.eyeY + 0.4} C${ex - 7.6} ${spec.eyeY - 7.2} ${ex + 7.6} ${spec.eyeY - 7.2} ${ex + 12} ${spec.eyeY + 0.4}` }, open);
      if (spec.lashes) {
        const out = Math.sign(ex);
        const y = spec.eyeY;
        svg('path', { class: 'oc-lash-line', d: `M${ex + out * 10.6} ${y - 1.4} Q${ex + out * 14} ${y - 2.4} ${ex + out * 15.6} ${y - 5.8} M${ex + out * 8} ${y - 3.6} Q${ex + out * 11} ${y - 5.8} ${ex + out * 12} ${y - 8.2}` }, open);
      }
      if (spec.detailed) {
        svg('path', { class: 'oc-eye-fold', d: `M${ex - 8.5} ${spec.eyeY - 8.5} Q${ex} ${spec.eyeY - 12} ${ex + 8} ${spec.eyeY - 8.3}` }, eye);
        svg('path', { class: 'oc-lower-lid', d: `M${ex - 8.5} ${spec.eyeY + 1.5} Q${ex} ${spec.eyeY + 5.8} ${ex + 8.5} ${spec.eyeY + 1.5}` }, open);
        svg('ellipse', { class: 'oc-tear-duct', cx: ex - Math.sign(ex) * 9.6, cy: spec.eyeY + 0.6, rx: 0.9, ry: 0.65 }, open);
      }
      const shut = svg('path', { class: 'oc-eye-shut', d: `M${ex - 11} ${spec.eyeY - 1} C${ex - 6} ${spec.eyeY - 7} ${ex + 6} ${spec.eyeY - 7} ${ex + 11} ${spec.eyeY - 1}`, opacity: 0 }, eye);
      return { ex, open, look, lid, shut, white };
    });
    const brows = spec.brows.map((d, i) => {
      const brow = svg('g', {}, g);
      svg('path', { class: 'oc-brow', d }, brow);
      if (spec.detailed) {
        const clip = svg('clipPath', { id: `oc-brow-${++uid}` }, paint.defs);
        svg('path', { d }, clip);
        const side = i ? 1 : -1;
        const hairs = [[12, -87, 14, -89], [16, -87.5, 19, -89.5], [22, -86.8, 25, -88.8], [28, -84.8, 31, -86.4]]
          .map(([x, y, tx, ty]) => `M${side * x} ${y} Q${side * (x + 1)} ${ty} ${side * tx} ${ty}`).join(' ');
        svg('path', { class: 'oc-brow-hair', d: hairs, 'clip-path': `url(#${clip.id})` }, brow);
      }
      return brow;
    });
    if (spec.detailed) {
      svg('path', { class: 'oc-nose', d: spec.nose, fill: paint.nose }, g);
      svg('path', { class: 'oc-nose-contour', d: 'M3 -59 C4 -53 5.3 -48 7.8 -42.8 C8.4 -39 4.4 -36.8 0 -38.4 M-6.5 -44 Q-8 -41 -5.8 -39.4' }, g);
    } else inked(g, spec.nose, 'oc-face-skin oc-nose', 'oc-ink oc-ink--face', paint.face);
    svg('path', { class: 'oc-nose-light', d: spec.noseLight }, g);
    svg('path', { class: 'oc-nostril', d: spec.nostrils }, g);
    // The mouth: its inside, teeth, and tongue while open, the lower lip's
    // light, or just its line while shut; the moustache over it.
    const mouth = svg('g', { class: 'oc-mouth' }, g);
    const inside = svg('path', { class: 'oc-mouth-inside', d: '' }, mouth);
    const mouthClip = svg('clipPath', { id: `oc-mouth-${++uid}` }, paint.defs);
    const clipPathNode = svg('path', { d: '' }, mouthClip);
    const inner = svg('g', { 'clip-path': `url(#${mouthClip.id})` }, mouth);
    const teeth = svg('path', { class: 'oc-teeth', d: '' }, inner);
    const tongue = svg('path', { class: 'oc-tongue', d: '' }, inner);
    const lip = svg('path', { class: 'oc-lip-light', d: '' }, mouth);
    const line = svg('path', { class: 'oc-mouth-line', d: '' }, mouth);
    if (spec.moustache) {
      inked(g, spec.moustache, 'oc-hair oc-moustache', 'oc-ink oc-ink--face');
      svg('path', { class: 'oc-hair-sheen', d: spec.moustacheSheen }, g);
      if (spec.detailed) svg('path', { class: 'oc-moustache-hair', d: 'M-3 -32 Q-12 -36 -23 -31 M-7 -30 Q-16 -34 -26 -29 M-14 -29 Q-23 -32 -30 -28 M3 -32 Q12 -36 23 -31 M7 -30 Q16 -34 26 -29 M14 -29 Q23 -32 30 -28' }, g);
    }
    if (spec.dimple) svg('path', { class: 'oc-dimple', d: spec.dimple }, g);
    const sweat = svg('path', { class: 'oc-sweat', d: 'M44 -100 C47 -94 49 -90 49 -87 C49 -84 47 -82 44.5 -82 C42 -82 40 -84 40.4 -87 C40.6 -90 42 -94 44 -100 Z', opacity: 0 }, g);

    let drawn = '';
    return (p, blink, open) => {
      const state = [p.look, p.down, p.brow, p.frown, p.smile, p.wide, p.happy, p.sweat, p.blush, blink, open, p.round || 0].map((v) => v.toFixed(3)).join('|');
      if (state === drawn) return;
      drawn = state;
      const happy = clamp(p.happy, 0, 1);
      for (const eye of eyes) {
        eye.look.setAttribute('transform', `translate(${(4.2 * p.look).toFixed(2)} ${(2.4 * clamp(p.down, -1, 1)).toFixed(2)})`);
        // The lid comes down from above the eye, to the lower lid at a blink.
        const shut = clamp(Math.max(blink, happy), 0, 1);
        const wide = clamp(p.wide, 0, 1);
        const top = spec.eyeY - 7.4 - 1.6 * wide;
        const edge = top + (13.2 + 1.6 * wide) * shut + (wide ? 0 : 1.6);
        const ex = eye.ex;
        eye.lid.setAttribute('d', `M${ex - 12} ${spec.eyeY + 1} L${ex - 12} ${top} L${ex + 12} ${top} L${ex + 12} ${spec.eyeY + 1} C${ex + 8} ${edge} ${ex - 8} ${edge} ${ex - 12} ${spec.eyeY + 1} Z`);
        eye.open.setAttribute('opacity', happy > 0.5 ? '0' : '1');
        eye.shut.setAttribute('opacity', happy > 0.5 ? '1' : '0');
        eye.open.setAttribute('transform', wide ? `translate(${ex} ${spec.eyeY}) scale(${1 + 0.1 * wide}) translate(${-ex} ${-spec.eyeY})` : '');
      }
      // Brows: raised, or knitted (in and down at their inner ends).
      brows.forEach((brow, i) => {
        const side = i === 0 ? -1 : 1;
        const lift = -7 * p.brow + 3.4 * p.frown;
        const turn = side * (-9 * p.frown + 4 * p.brow);
        brow.setAttribute('transform', `translate(0 ${lift.toFixed(2)}) rotate(${turn.toFixed(2)} ${side * 22} -86)`);
      });
      for (const cheek of cheeks) cheek.setAttribute('opacity', (0.32 + 0.5 * clamp(p.blush, 0, 1)).toFixed(2));
      sweat.setAttribute('opacity', clamp(p.sweat, 0, 1).toFixed(2));
      const shape = mouthShape(spec.mouth, open, p.smile, p.round || 0);
      if (shape.line) {
        line.setAttribute('d', shape.line);
        for (const node of [inside, teeth, tongue, lip]) node.setAttribute('d', '');
        if (spec.detailed) lip.setAttribute('d', `M-7 ${spec.mouth.y + 2.2} Q0 ${spec.mouth.y + 4} 7 ${spec.mouth.y + 2.2}`);
        clipPathNode.setAttribute('d', '');
      } else {
        line.setAttribute('d', '');
        inside.setAttribute('d', shape.inside);
        clipPathNode.setAttribute('d', shape.inside);
        teeth.setAttribute('d', shape.teeth);
        tongue.setAttribute('d', shape.tongue);
        lip.setAttribute('d', shape.lip);
      }
    };
  }

  /**
   * Two brief, unequally spaced blinks per 7.2 s cycle (0 open … 1 shut),
   * offset per figure, so song time is the whole state.
   */
  function blinkAt(time, seed) {
    const phase = (time + seed * 2.3) % 7.2;
    const elapsed = phase - (phase >= 5.1 ? 5.1 : 1.8);
    return Math.max(0, Math.min(1, elapsed / 0.06, (0.2 - elapsed) / 0.1));
  }

  // ------------------------------------------------------------------
  // Costumes: each draws its top (and what goes over the collar) on the
  // body; the arms, legs, and shoes take its sleeve, trouser, and shoe
  // kinds. Colours live in the stylesheet, under the costume's class.
  // ------------------------------------------------------------------

  // A zip-front jacket, longer than the hoodie, and its stand collar: the
  // Security Engineer's field jacket and the Scrum song's track jacket.
  const ZIP_JACKET = 'M73.6 78.6 C70 79.6 62 82.4 56.6 85.2 C52.6 87.4 51.4 92.6 53.4 98 C55.4 103.6 57.6 108.4 58.4 114 C59 124 58.6 134 58.8 142 C58.9 150 58.4 157 57.8 163.4 C66 165.2 94 165.2 102.2 163.4 C101.6 157 101.1 150 101.2 142 C101.4 134 101 124 101.6 114 C102.4 108.4 104.6 103.6 106.6 98 C108.6 92.6 107.4 87.4 103.4 85.2 C98 82.4 90 79.6 86.4 78.6 C84 80.2 76 80.2 73.6 78.6 Z';
  const STAND_COLLAR = 'M72 70.4 C71.6 74.6 72.4 78.6 74.2 81.4 C77.4 83.4 82.6 83.4 85.8 81.4 C87.6 78.6 88.4 74.6 88 70.4 C84.4 72 75.6 72 72 70.4 Z';
  const RIB_HEM = 'M57.8 151.6 C66 153.4 94 153.4 102.2 151.6 L102.4 157.4 C94 159.2 66 159.2 57.6 157.4 Z';
  /**
   * A hoodie, its hood behind the neck, drawstrings, a kangaroo pocket, and
   * print(layer) on the chest; long sleeves and sneakers.
   */
  function hoodie(print) {
    return {
      sleeve: 'long', head: TEAMMATE_HEAD, shoes: 'sneaker',
      back(layer) {
        // The hood, lying behind the neck and on the shoulders.
        inked(layer, 'M64 86 C62 76 66 66.6 73 63.4 C78 61.4 82 61.4 87 63.4 C94 66.6 98 76 96 86 C91 82.6 86 81 80 81 C74 81 69 82.6 64 86 Z', 'oc-hood', 'oc-ink oc-ink--cool');
      },
      top(layer, paint) {
        garment(layer, TOP, 'oc-top', paint, paint.top);
        inked(layer, RIB_HEM, 'oc-rib-band', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-rib', d: Array.from({ length: 21 }, (_, i) => `M${59.6 + i * 2.05} 152.4 V157.6`).join(' ') }, layer);
        inked(layer, 'M64 128.4 C72 127.4 88 127.4 96 128.4 C97.4 134 99 140 100.6 146.6 C88 148.4 72 148.4 59.4 146.6 C61 140 62.6 134 64 128.4 Z', 'oc-pocket-patch', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-fold', d: 'M64.4 130 C63 135.4 61.6 140.6 60.4 145.4 M95.6 130 C97 135.4 98.4 140.6 99.6 145.4' }, layer);
        print(layer);
      },
      collar(layer) {
        // The hood's front edges framing the neck, and its drawstrings.
        svg('path', { class: 'oc-under-neck oc-hood-inside', d: 'M72.4 79 C75 83.6 85 83.6 87.6 79 C85.6 80.2 74.4 80.2 72.4 79 Z' }, layer);
        svg('path', { class: 'oc-hood-edge', d: 'M66 86.6 C70 82 75 80.4 80 80.4 C85 80.4 90 82 94 86.6' }, layer);
        svg('path', { class: 'oc-drawstring', d: 'M75.4 82.6 C75 92 75.6 102 76.4 110 M84.6 82.6 C85 92 84.4 102 83.6 110' }, layer);
        svg('path', { class: 'oc-aglet', d: 'M75.6 109.4 L77.2 109.4 L77.4 113.4 L75.8 113.4 Z M82.8 109.4 L84.4 109.4 L84.2 113.4 L82.6 113.4 Z' }, layer);
      },
    };
  }

  const COSTUMES = {
    // The Teammate: a teal quarter-zip pullover, its collar unzipped over a
    // white tee, a rocket on its chest; studio headphones round the neck.
    tenor: {
      sleeve: 'pushed', head: TENOR_HEAD,
      top(layer, paint) {
        garment(layer, TOP, 'oc-top', paint, paint.top);
        inked(layer, RIB_HEM, 'oc-rib-band', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-rib', d: Array.from({ length: 21 }, (_, i) => `M${59.6 + i * 2.05} ${152.4 + (i === 0 || i === 20 ? 0.6 : 0)} V${157.6}`).join(' ') }, layer);
        drawParts(layer, [
          ['oc-fold', 'M62 120 C66 126 70 130 76 132 M98 122 C94 127 90 130 85 131.6 M63 146 C70 148.6 78 149.2 86 148.4'],
          ['oc-seam', 'M80 101.6 V112'],
        ]);
        // A small rocket on the chest: "ship it".
        const rocket = svg('g', { class: 'oc-logo', transform: 'translate(91.6 108) rotate(30)' }, layer);
        svg('path', { class: 'oc-logo-body', d: 'M0 -5.4 C1.8 -3.4 2.2 -0.6 1.8 2.4 L-1.8 2.4 C-2.2 -0.6 -1.8 -3.4 0 -5.4 Z M-1.8 1 L-3 3.4 L-1.6 3 Z M1.8 1 L3 3.4 L1.6 3 Z' }, rocket);
        svg('path', { class: 'oc-logo-flame', d: 'M-0.9 2.6 L0 4.8 L0.9 2.6 Z' }, rocket);
      },
      collar(layer) {
        // The tee in the zip's V, the collar's inside behind the neck, its
        // two halves folded open along the V, the open zipper, its slider.
        svg('path', { class: 'oc-tee', d: 'M74.8 79 L80 100.4 L85.2 79 C83.4 80.6 76.6 80.6 74.8 79 Z' }, layer);
        svg('path', { class: 'oc-tee-neck', d: 'M75.6 80.2 C77.8 82.6 82.2 82.6 84.4 80.2' }, layer);
        for (const side of [1, -1]) {
          const half = svg('g', { transform: side < 0 ? MIRROR : '' }, layer);
          inked(half, 'M88.6 71.4 C89.6 75.4 89 79.6 86.6 82.8 C84.6 88 82.2 94 80.2 100.6 L84.8 79.4 C85.6 76.6 85.8 74 85.6 72.6 C86.8 72.4 87.8 72 88.6 71.4 Z', 'oc-collar', 'oc-ink oc-ink--cool');
          svg('path', { class: 'oc-zip', d: 'M85 79.4 C83.6 86 81.8 93 80.4 100.2' }, half);
          svg('path', { class: 'oc-collar-fold', d: 'M88 75.6 C87.6 78.6 86.8 81 85.6 83' }, half);
        }
        svg('path', { class: 'oc-zip-pull', d: 'M79 100.2 H81 L81.4 105.6 C80.6 106.4 79.4 106.4 78.6 105.6 Z' }, layer);
      },
      neckwear(layer) {
        // Over-ear headphones round the neck: the band behind, a cup on each
        // collarbone, each with its cushion towards the neck.
        svg('path', { class: 'oc-phones-band', d: 'M66.4 83 C66 77 70 71.4 74.6 70 M93.6 83 C94 77 90 71.4 85.4 70' }, layer);
        for (const side of [1, -1]) {
          const cup = svg('g', { transform: side < 0 ? MIRROR : '' }, layer);
          inked(cup, 'M88.8 80.6 C92.6 79.4 96.6 80.6 97.6 84.4 C98.6 88.4 97 92.2 93.4 93.2 C89.8 94.2 86.8 92 86.2 88.2 C85.6 84.6 86 81.6 88.8 80.6 Z', 'oc-phones-cup', 'oc-ink oc-ink--cool');
          svg('path', { class: 'oc-phones-cushion', d: 'M87 82.6 C85.6 85.6 85.8 89.4 87.8 92 C88.4 89 88.4 85.6 87 82.6 Z' }, cup);
          svg('path', { class: 'oc-phones-accent', d: 'M93.4 84 C95 85.4 95.4 87.6 94.6 89.4' }, cup);
        }
      },
    },
    // The Product Manager: a navy blazer, open over a coral tee, a lanyard
    // and badge; grey trousers and white sneakers.
    pm: {
      sleeve: 'long', head: TEAMMATE_HEAD, shoes: 'sneaker',
      top(layer, paint) {
        garment(layer, TOP, 'oc-under', paint);
        for (const side of [1, -1]) {
          const panel = svg('g', { transform: side < 0 ? MIRROR : '' }, layer);
          garment(panel, 'M86.4 78.6 C90 79.6 98 82.4 103.4 85.2 C107.4 87.4 108.6 92.6 106.6 98 C104.6 103.6 102.4 108.4 101.6 114 C101 124 101.4 134 101.2 142 C101.1 150 101.6 156 102.4 162.4 C96.6 163.6 88.6 163.8 82.6 163 C81.6 154 81 142 80.8 128.4 C82.6 116 85.2 100 86.4 78.6 Z', 'oc-top', paint, paint.top);
          drawParts(panel, [
            ['oc-lapel', 'M85.8 79.6 C88 86 90.6 90 94.4 92.4 L91.6 95.4 C88 104 84 116 80.6 127.6 C83 116 84.4 100 85.8 79.6 Z'],
            ['oc-lapel-edge', 'M94.4 92.4 L91.6 95.4 M85.8 79.6 C88 86 90.6 90 94.4 92.4'],
            ['oc-welt', 'M88.6 106.4 L97 105.4'],
            ['oc-welt', 'M89.4 146.4 C92.6 146.8 96 146.6 99.4 146 M89.6 146.6 L89.8 149.6 M99.2 146.2 L99.4 149.2'],
          ]);
        }
        svg('circle', { class: 'oc-button', cx: 80.4, cy: 129, r: 1.4 }, layer);
      },
      collar(layer) {
        svg('path', { class: 'oc-under-neck', d: 'M74.8 79.2 C77.2 82.4 82.8 82.4 85.2 79.2' }, layer);
      },
      neckwear(layer) {
        // The lanyard round the neck, and its badge clipped on the tee.
        svg('path', { class: 'oc-lanyard', d: 'M75.6 80 C76.6 94 78.2 106 79.2 114.4 M84.4 80 C83.4 94 81.8 106 80.8 114.4' }, layer);
        inked(layer, 'M75.6 114.6 H84.4 V126.4 H75.6 Z', 'oc-badge', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-badge-photo', d: 'M77.2 116.6 H82.8 V121.6 H77.2 Z' }, layer);
        svg('path', { class: 'oc-badge-line', d: 'M77 123.6 H83 M77.6 125.2 H82.4' }, layer);
      },
    },
    // The Build Engineer: a hi-vis safety vest with reflective bands over a
    // navy tee, olive cargo trousers, and work boots.
    build: {
      sleeve: 'short', undershirt: true, head: TEAMMATE_HEAD, shoes: 'boot', cargo: true,
      top(layer, paint) {
        garment(layer, TOP, 'oc-under', paint);
        const vest = 'M74 79.2 C68 81 60 84.4 55.4 87 C56.6 92 58 98 59 104 C59.6 108 58.6 111 57.6 113.6 C58.2 124 58.4 136 58.4 146 C58.4 151 58 156 57.6 160.4 C66 162 94 162 102.4 160.4 C102 156 101.6 151 101.6 146 C101.6 136 101.8 124 102.4 113.6 C101.4 111 100.4 108 101 104 C102 98 103.4 92 104.6 87 C100 84.4 92 81 86 79.2 C84.6 92 82.4 104 80 116 C77.6 104 75.4 92 74 79.2 Z';
        inked(layer, vest, 'oc-top', 'oc-ink oc-ink--cool', paint.top);
        shadeCloth(layer, vest, paint);
        const clip = svg('clipPath', { id: `oc-vest-${++uid}` }, paint.defs);
        svg('path', { d: vest }, clip);
        const bands = svg('g', { 'clip-path': `url(#${clip.id})` }, layer);
        svg('path', { class: 'oc-reflective', d: 'M50 127.6 H110 V133.4 H50 Z M50 145 H110 V150.8 H50 Z M63.4 80 H69.2 V127.6 H63.4 Z M90.8 80 H96.6 V127.6 H90.8 Z' }, bands);
        svg('path', { class: 'oc-reflective-shine', d: 'M50 129 H110 M50 146.4 H110 M64.8 82 V127 M92.2 82 V127' }, bands);
        svg('path', { class: 'oc-zip', d: 'M80 116 V160' }, layer);
        svg('path', { class: 'oc-fold', d: 'M62 116 C66 120 70 122 74 122.6 M98 118 C94 121 90 122.6 86 123' }, layer);
      },
      collar(layer) {
        svg('path', { class: 'oc-under-neck', d: 'M74.8 79.2 C77.2 82.4 82.8 82.4 85.2 79.2' }, layer);
      },
    },
    // The site foreman ("Not a One-Time Investment"): a safety-orange hi-vis
    // vest with silver bands over a blue work shirt, its sleeves rolled up,
    // a leather tool pouch on the hip, jeans, work boots, and a gold hard hat.
    foreman: {
      sleeve: 'pushed', undershirt: true, head: TEAMMATE_HEAD, shoes: 'boot',
      top(layer, paint) {
        garment(layer, TOP, 'oc-under', paint);
        svg('path', { class: 'oc-placket', d: 'M80 82 V160' }, layer);
        const vest = 'M74 79.2 C68 81 60 84.4 55.4 87 C56.6 92 58 98 59 104 C59.6 108 58.6 111 57.6 113.6 C58.2 124 58.4 136 58.4 146 C58.4 151 58 156 57.6 160.4 C66 162 94 162 102.4 160.4 C102 156 101.6 151 101.6 146 C101.6 136 101.8 124 102.4 113.6 C101.4 111 100.4 108 101 104 C102 98 103.4 92 104.6 87 C100 84.4 92 81 86 79.2 C84.6 92 82.4 104 80 116 C77.6 104 75.4 92 74 79.2 Z';
        inked(layer, vest, 'oc-top', 'oc-ink oc-ink--cool', paint.top);
        shadeCloth(layer, vest, paint);
        const clip = svg('clipPath', { id: `oc-vest-${++uid}` }, paint.defs);
        svg('path', { d: vest }, clip);
        const bands = svg('g', { 'clip-path': `url(#${clip.id})` }, layer);
        svg('path', { class: 'oc-reflective', d: 'M50 127.6 H110 V133.4 H50 Z M50 145 H110 V150.8 H50 Z M63.4 80 H69.2 V127.6 H63.4 Z M90.8 80 H96.6 V127.6 H90.8 Z' }, bands);
        svg('path', { class: 'oc-reflective-shine', d: 'M50 129 H110 M50 146.4 H110 M64.8 82 V127 M92.2 82 V127' }, bands);
        svg('path', { class: 'oc-fold', d: 'M62 116 C66 120 70 122 74 122.6 M98 118 C94 121 90 122.6 86 123' }, layer);
        // A pencil in the vest's chest pocket, and the tool pouch on the hip.
        inked(layer, 'M71 104 H78 V112 H71 Z', 'oc-vest-pocket', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-pencil', d: 'M73.4 104 V97.4 L74.6 95.4 L75.8 97.4 V104 Z' }, layer);
        inked(layer, 'M88 157 H100.6 L100 170 C99.8 172 98.6 173 96.6 173 H91.6 C89.6 173 88.4 172 88.2 170 Z', 'oc-pouch', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-pouch-flap', d: 'M88 157 H100.6 L100.4 162 C96.6 163.4 92 163.4 88.2 162 Z' }, layer);
        svg('path', { class: 'oc-hammer', d: 'M86.6 156 V174 M83.6 155 H89.6' }, layer);
      },
      collar(layer) {
        svg('path', { class: 'oc-under-neck', d: 'M74.8 79.2 C77.2 82.4 82.8 82.4 85.2 79.2' }, layer);
        svg('path', { class: 'oc-shirt-collar', d: 'M73.6 76.6 L80 84 L76.6 85.6 C74.6 83.4 73.4 80.6 73.6 76.6 Z M86.4 76.6 L80 84 L83.4 85.6 C85.4 83.4 86.6 80.6 86.4 76.6 Z' }, layer);
      },
      headwear(layer) {
        // A gold hard hat: its dome with a raised centre ridge, the brim, and
        // a highlight from the upper left.
        inked(layer, 'M60.6 31.4 C60.6 17.6 69 9.4 80 9.4 C91 9.4 99.4 17.6 99.4 31.4 Z', 'oc-hardhat', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-hardhat-ridge', d: 'M76.6 10 C76.4 17 76.6 24 77 31.2 H83 C83.4 24 83.6 17 83.4 10 C81.4 9.4 78.6 9.4 76.6 10 Z' }, layer);
        inked(layer, 'M55 32.4 C55 30.4 57 29.6 60 29.6 H100 C103 29.6 105 30.4 105 32.4 C105 34.6 103 35.6 100 35.6 H60 C57 35.6 55 34.6 55 32.4 Z', 'oc-hardhat-brim', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-hardhat-shine', d: 'M64.6 25 C65.6 18 69.6 13.6 74 12' }, layer);
      },
    },
    // The Test Engineer: a white lab coat to the knees, a lilac shirt at
    // its neck, pens in the pocket, and safety goggles hung round the neck.
    test: {
      sleeve: 'long', head: TEAMMATE_HEAD, shoes: 'shoe',
      top(layer, paint) {
        garment(layer, TOP, 'oc-under', paint);
        const coat = 'M73.6 78.6 C70 79.6 62 82.4 56.6 85.2 C52.6 87.4 51.4 92.6 53.4 98 C55.4 103.6 57.6 108.4 58.4 114 C59 124 58.6 134 58.6 144 C58.4 162 57.2 186 56.2 206 C55.6 216 55.2 224 55 232 C62 233.8 72 234.2 78.4 233.6 C79.2 220 79.6 206 80 196 C80.4 206 80.8 220 81.6 233.6 C88 234.2 98 233.8 105 232 C104.8 224 104.4 216 103.8 206 C102.8 186 101.6 162 101.4 144 C101.4 134 101 124 101.6 114 C102.4 108.4 104.6 103.6 106.6 98 C108.6 92.6 107.4 87.4 103.4 85.2 C98 82.4 90 79.6 86.4 78.6 C84.6 92 82.4 106 80 118 C77.6 106 75.4 92 73.6 78.6 Z';
        garment(layer, coat, 'oc-top', paint, paint.top);
        drawParts(layer, [
          ['oc-lapel', 'M85.6 79.4 C88 86 90.4 90.4 94.2 92.8 L91.4 96 C88 106 84.4 116 80.6 124.6 C83 112 84.4 98 85.6 79.4 Z'],
          ['oc-lapel', 'M74.4 79.4 C72 86 69.6 90.4 65.8 92.8 L68.6 96 C72 106 75.6 116 79.4 124.6 C77 112 75.6 98 74.4 79.4 Z'],
          ['oc-coat-seam', 'M80 124 V196'],
          ['oc-welt', 'M86.4 108.6 H96.4 M61.2 168.4 H72.8 M87.2 168.4 H98.8'],
          ['oc-fold', 'M60 196 C62.6 210 63 220 62.4 230 M100 196 C97.4 210 97 220 97.6 230 M66 140 C70 146 74 148 78 148.6'],
        ]);
        for (const cy of [134, 152, 170]) svg('circle', { class: 'oc-button oc-button--coat', cx: 80, cy, r: 1.3 }, layer);
        // Two pens in the chest pocket.
        svg('path', { class: 'oc-pen oc-pen--blue', d: 'M88.6 103.2 H90.6 V109 H88.6 Z' }, layer);
        svg('path', { class: 'oc-pen oc-pen--red', d: 'M91.8 102.4 H93.8 V109 H91.8 Z' }, layer);
      },
      collar(layer) {
        svg('path', { class: 'oc-shirt-v', d: 'M74.4 79.4 L80 96 L85.6 79.4 C83.6 81.6 76.4 81.6 74.4 79.4 Z' }, layer);
      },
      neckwear(layer) {
        // Safety goggles hung round the neck on their strap.
        svg('path', { class: 'oc-goggle-strap', d: 'M72.6 81 C72.4 87 74 92.4 76.4 95.4 M87.4 81 C87.6 87 86 92.4 83.6 95.4' }, layer);
        inked(layer, 'M70.6 94.6 C70.6 91.4 73.4 89.8 76.6 90.2 C78.6 90.4 79.4 91.4 80 92.6 C80.6 91.4 81.4 90.4 83.4 90.2 C86.6 89.8 89.4 91.4 89.4 94.6 C89.4 97.6 87 99.6 84 99.4 C82 99.2 80.8 98.4 80 97 C79.2 98.4 78 99.2 76 99.4 C73 99.6 70.6 97.6 70.6 94.6 Z', 'oc-goggles', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-goggle-lens', d: 'M72.4 94.6 C72.4 92.6 74.2 91.6 76.4 91.8 C78.2 92 78.8 93.2 78.8 94.8 C78.8 96.8 77.4 97.8 75.6 97.8 C73.8 97.8 72.4 96.6 72.4 94.6 Z M87.6 94.6 C87.6 92.6 85.8 91.6 83.6 91.8 C81.8 92 81.2 93.2 81.2 94.8 C81.2 96.8 82.6 97.8 84.4 97.8 C86.2 97.8 87.6 96.6 87.6 94.6 Z' }, layer);
        svg('path', { class: 'oc-goggle-glint', d: 'M73.6 93.6 C74.2 92.8 75 92.4 76 92.4 M82.4 93.4 C83 92.6 83.8 92.4 84.8 92.6' }, layer);
      },
    },
    // The UI Developer: a mustard turtleneck under a denim painter's apron
    // with three dabs of paint and a brush in its pocket; rust trousers.
    ui: {
      sleeve: 'long', head: TEAMMATE_HEAD, shoes: 'sneaker',
      top(layer, paint) {
        garment(layer, TOP, 'oc-top', paint, paint.top);
        const apron = 'M68.4 96.4 C74 95.4 86 95.4 91.6 96.4 C92 106 92.8 116 94.6 124 C97.6 126.6 100.6 128.4 102.6 130.4 C103.4 156 103.4 186 102.8 212 C88 214.6 72 214.6 57.2 212 C56.6 186 56.6 156 57.4 130.4 C59.4 128.4 62.4 126.6 65.4 124 C67.2 116 68 106 68.4 96.4 Z';
        inked(layer, apron, 'oc-apron', 'oc-ink oc-ink--cool');
        drawParts(layer, [
          ['oc-apron-shade', 'M102.6 130.4 C103.4 156 103.4 186 102.8 212 C99.6 212.6 96.4 213 93.2 213.4 C94 190 94 160 93.2 132 C96.6 131 99.8 130.8 102.6 130.4 Z'],
          ['oc-apron-stitch', 'M69.6 98 C74.6 97.2 85.4 97.2 90.4 98 M58.8 132 C59 160 58.8 186 58.6 210.4 M101.2 132 C101 160 101.2 186 101.4 210.4'],
          ['oc-apron-pocket', 'M66 150 H94 V170 C86 172 74 172 66 170 Z'],
          ['oc-apron-stitch', 'M67 151.4 H93 M80 151.4 V171'],
        ]);
        svg('path', { class: 'oc-apron-strap', d: 'M68.6 96.6 C67.4 90 69 84 72.4 79.6 M91.4 96.6 C92.6 90 91 84 87.6 79.6' }, layer);
        // A brush and a pencil in the pocket, and three dabs of paint.
        svg('path', { class: 'oc-brush-handle', d: 'M71 152 L69.4 138.6 L71.4 138.4 L72.8 151.8 Z' }, layer);
        svg('path', { class: 'oc-brush-tip', d: 'M69.4 138.6 C69 136 69.6 134.4 70.6 133.6 C71.4 134.6 71.8 136.4 71.4 138.4 Z' }, layer);
        svg('path', { class: 'oc-pencil-body', d: 'M87.4 152 L89.8 139.4 L91.6 139.8 L89.2 152.4 Z' }, layer);
        svg('path', { class: 'oc-pencil-tip', d: 'M89.8 139.4 L91.2 136.4 L91.6 139.8 Z' }, layer);
        for (const [cx, cy, r, tone] of [[64.6, 186, 2.2, 'red'], [91, 192.6, 1.8, 'blue'], [74.4, 202.4, 1.5, 'gold']]) {
          svg('circle', { class: `oc-paint oc-paint--${tone}`, cx, cy, r }, layer);
        }
      },
      collar(layer) {
        // The turtleneck's folded collar, round the neck.
        inked(layer, 'M72.6 66.6 C72.2 71.6 72.6 76.6 73.8 81.2 C77.6 83.4 82.4 83.4 86.2 81.2 C87.4 76.6 87.8 71.6 87.4 66.6 C83.6 68.2 76.4 68.2 72.6 66.6 Z', 'oc-collar', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-rib', d: 'M74.4 69 V81.4 M76.4 69.4 V82.4 M78.4 69.6 V82.8 M80.4 69.6 V82.8 M82.4 69.6 V82.8 M84.4 69.4 V82.4 M86.2 69 V81.4' }, layer);
        svg('path', { class: 'oc-collar-fold', d: 'M72.8 72.6 C76.6 74.2 83.4 74.2 87.2 72.6' }, layer);
      },
    },
    // The Back-End Developer: a charcoal hoodie, its hood behind the neck,
    // drawstrings, a kangaroo pocket, a little database on the chest;
    // black jeans and sneakers.
    backend: hoodie((layer) => {
      // A small database on the chest: three stacked discs.
      const db = svg('g', { class: 'oc-print', transform: 'translate(91.6 108)' }, layer);
      svg('path', { d: 'M-3.6 -3 C-3.6 -4.4 3.6 -4.4 3.6 -3 V3 C3.6 4.4 -3.6 4.4 -3.6 3 Z' }, db);
      svg('path', { class: 'oc-print-line', d: 'M-3.6 -3 C-3.6 -1.6 3.6 -1.6 3.6 -3 M-3.6 0 C-3.6 1.4 3.6 1.4 3.6 0' }, db);
    }),
    // The viewer's hero, who joins the team at the end: the same hoodie in
    // blue with a gold star on the chest; jeans and sneakers.
    hero: hoodie((layer) => {
      svg('path', { class: 'oc-print', d: 'M91.6 102.6 L93.2 106 L96.9 106.4 L94.1 108.9 L94.9 112.6 L91.6 110.7 L88.3 112.6 L89.1 108.9 L86.3 106.4 L90 106 Z' }, layer);
    }),
    // A developer: the same hoodie in green with a code tag, </>, on the
    // chest; dark jeans and sneakers.
    coder: hoodie((layer) => {
      svg('path', { class: 'oc-print-code', d: 'M88.4 104.6 L85.8 108 L88.4 111.4 M94.8 104.6 L97.4 108 L94.8 111.4 M92.6 103.8 L90.6 112.2' }, layer);
    }),
    // A lead developer: the hoodie in plum with a merged git branch on the chest.
    maintainer: hoodie((layer) => {
      svg('path', { class: 'oc-print-code', d: 'M88.6 112.4 V103.6 M88.6 109.6 C88.6 106.6 94.6 107.4 94.6 104.4' }, layer);
      for (const [cx, cy] of [[88.6, 103.2], [88.6, 112.6], [94.6, 103.6]]) svg('circle', { class: 'oc-print-dot', cx, cy, r: 1.3 }, layer);
    }),
    // A software engineer: the hoodie in rust with curly braces on the
    // chest; stone chinos and white sneakers.
    engineer: hoodie((layer) => {
      svg('path', {
        class: 'oc-print-code',
        d: 'M89.6 103.2 C88.2 103.2 88 104 88 105.4 V106.6 C88 107.6 87.4 108 86.4 108 C87.4 108 88 108.4 88 109.4 V110.6 C88 112 88.2 112.8 89.6 112.8 '
          + 'M93.6 103.2 C95 103.2 95.2 104 95.2 105.4 V106.6 C95.2 107.6 95.8 108 96.8 108 C95.8 108 95.2 108.4 95.2 109.4 V110.6 C95.2 112 95 112.8 93.6 112.8',
      }, layer);
    }),
    // The Security Engineer: a black field jacket zipped to its stand
    // collar, flapped chest pockets, epaulettes, a gold shield badge, and
    // an earpiece's coiled wire; black cargo trousers and boots.
    security: {
      sleeve: 'long', head: TEAMMATE_HEAD, shoes: 'boot', cargo: true,
      top(layer, paint) {
        garment(layer, ZIP_JACKET, 'oc-top', paint, paint.top);
        drawParts(layer, [
          ['oc-zip oc-zip--dark', 'M80 82 V164'],
          ['oc-pocket-flap', 'M62 101.6 H75 V107.6 C71 108.8 66 108.8 62 107.6 Z M85 101.6 H98 V107.6 C94 108.8 89 108.8 85 107.6 Z'],
          ['oc-welt', 'M62.4 107.6 V121 H74.6 V107.6 M85.4 107.6 V121 H97.6 V107.6'],
          ['oc-epaulette', 'M58.6 86.6 L70.4 82.6 L71.2 85.2 L59.6 89.4 Z M101.4 86.6 L89.6 82.6 L88.8 85.2 L100.4 89.4 Z'],
          ['oc-fold', 'M62 130 C68 134 74 136 78 136.4 M98 132 C92 135 87 136.4 82.6 136.6 M62 156 C70 158.4 90 158.4 98 156'],
          ['oc-rim', 'M53.6 98.4 C55.6 104 57.8 108.6 58.6 114.2 C59.2 124 58.8 134 59 142'],
        ]);
        // The gold shield on the chest.
        const badge = svg('g', { transform: 'translate(91.4 114.4)' }, layer);
        inked(badge, 'M0 -4.6 C2 -3.6 3.6 -3.6 4.6 -4 C4.8 0 3.6 3 0 5 C-3.6 3 -4.8 0 -4.6 -4 C-3.6 -3.6 -2 -3.6 0 -4.6 Z', 'oc-shield', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-shield-star', d: 'M0 -2.2 L0.7 -0.4 L2.4 -0.4 L1 0.7 L1.5 2.4 L0 1.4 L-1.5 2.4 L-1 0.7 L-2.4 -0.4 L-0.7 -0.4 Z' }, badge);
      },
      collar(layer) {
        inked(layer, STAND_COLLAR, 'oc-collar', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-zip oc-zip--dark', d: 'M80 72 V83' }, layer);
      },
      neckwear(layer) {
        // The earpiece's clear coiled wire, from the collar up behind the jaw.
        svg('path', { class: 'oc-earwire', d: 'M86.4 74 C88.4 70 90.4 66 92 61.6' }, layer);
        svg('path', { class: 'oc-earwire-coil', d: 'M86.8 73 l1.6 -0.6 M87.6 71.2 l1.6 -0.6 M88.4 69.4 l1.6 -0.6 M89.2 67.6 l1.6 -0.6 M90 65.8 l1.6 -0.6 M90.8 64 l1.6 -0.6' }, layer);
      },
    },
    // The Scrum song's Scrum Master, the team coach: a zip-up track jacket
    // in teal with a stand collar, white and gold stripes down its sides and
    // sleeves, and a whistle on a lanyard; track trousers and sneakers.
    coach: {
      sleeve: 'long', head: TEAMMATE_HEAD, shoes: 'sneaker',
      top(layer, paint) {
        garment(layer, ZIP_JACKET, 'oc-top', paint, paint.top);
        drawParts(layer, [
          ['oc-track-stripe', 'M60.6 113 C61 124 60.6 134 60.8 142 C60.9 150 60.4 157 59.9 163'],
          ['oc-track-stripe oc-track-stripe--gold', 'M63 112 C63.4 124 63 134 63.2 142 C63.3 150 62.8 157 62.4 163.4'],
          ['oc-track-stripe', 'M99.4 113 C99 124 99.4 134 99.2 142 C99.1 150 99.6 157 100.1 163'],
          ['oc-track-stripe oc-track-stripe--gold', 'M97 112 C96.6 124 97 134 96.8 142 C96.7 150 97.2 157 97.6 163.4'],
          ['oc-zip oc-zip--light', 'M80 82 V164'],
          ['oc-welt', 'M66.4 134 L70.4 147 M93.6 134 L89.6 147'],
          ['oc-fold', 'M62 156 C70 158.4 90 158.4 98 156'],
        ]);
      },
      collar(layer) {
        inked(layer, STAND_COLLAR, 'oc-collar', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-track-stripe', d: 'M72.4 73.4 C76 74.8 84 74.8 87.6 73.4' }, layer);
        svg('path', { class: 'oc-zip oc-zip--light', d: 'M80 72 V83' }, layer);
      },
      neckwear(layer) {
        // The whistle on a yellow lanyard, its mouthpiece to the side.
        svg('path', { class: 'oc-lanyard', d: 'M75.6 80 C76.4 94 78.4 106 79.4 112.6 M84.4 80 C83.6 94 81.6 106 80.6 112.6' }, layer);
        const whistle = svg('g', { class: 'oc-whistle', transform: 'translate(80 117.6)' }, layer);
        svg('circle', { class: 'oc-whistle-ring', cx: 0, cy: -4.4, r: 1.2 }, whistle);
        inked(whistle, 'M-7.4 -2.6 H-0.4 V0.8 H-7.4 Z', 'oc-whistle-body', 'oc-ink oc-ink--cool');
        inked(whistle, 'M-3 0.8 A3.6 3.6 0 1 0 4.2 0.8 A3.6 3.6 0 1 0 -3 0.8 Z', 'oc-whistle-body', 'oc-ink oc-ink--cool');
        svg('circle', { class: 'oc-whistle-hole', cx: 0.6, cy: 0.8, r: 1.1 }, whistle);
        svg('path', { class: 'oc-whistle-shine', d: 'M-6.4 -1.6 H-2 M-1.4 -1.6 C0 -2.4 1.6 -2.4 2.8 -1.6' }, whistle);
      },
      sleeveTrim(upper, fore) {
        // The two stripes run down each sleeve's outer side to the cuff.
        svg('path', { class: 'oc-track-stripe', d: 'M110.6 99.6 C111.8 108 112.8 118 113.4 128 C113.6 133 113.6 137 113.4 140' }, upper);
        svg('path', { class: 'oc-track-stripe oc-track-stripe--gold', d: 'M108.2 101.2 C109.6 109 110.6 119 111.2 128 C111.4 133 111.4 137 111.2 140' }, upper);
        svg('path', { class: 'oc-track-stripe', d: 'M113.6 140.4 C113.8 147 113.4 155 112.8 162 C112.5 165 112.2 167 112 168' }, fore);
        svg('path', { class: 'oc-track-stripe oc-track-stripe--gold', d: 'M111.2 140.6 C111.4 147 111 155 110.4 162 C110.1 165 109.8 167 109.6 168' }, fore);
      },
    },
  };
  /**
   * The open neck of a blazer: the band between its two lapels' inner
   * edges, as [y, half-width] pairs from the collar down to where the
   * fronts meet, for a print on what shows underneath.
   */
  function blazerNeck() {
    const [p0, p1, p2, p3] = [[80.8, 128.4], [82.6, 116], [85.2, 100], [86.4, 78.6]];
    const at = (t) => [0, 1].map((k) => (1 - t) ** 3 * p0[k] + 3 * (1 - t) ** 2 * t * p1[k] + 3 * (1 - t) * t ** 2 * p2[k] + t ** 3 * p3[k]);
    const edge = Array.from({ length: 41 }, (_, i) => at(i / 40)).sort((a, b) => a[1] - b[1]);
    return (y) => {
      const i = edge.findIndex((point) => point[1] >= y);
      if (i <= 0) return 0;
      const [a, b] = [edge[i - 1], edge[i]];
      return a[0] + (b[0] - a[0]) * ((y - a[1]) / (b[1] - a[1])) - 80;
    };
  }

  // The Scrum song's Product Owner, the value navigator: a navy
  // double-breasted sea coat (the Product Manager's blazer, closed with two
  // rows of brass buttons, gold braid at its cuffs) over a striped Breton
  // shirt, and a gold compass pin on the lapel; the spyglass is a prop.
  const neckWidth = blazerNeck();
  COSTUMES.navigator = {
    ...COSTUMES.pm,
    shoes: 'sneaker',
    top(layer, paint) {
      COSTUMES.pm.top(layer, paint);
      // The Breton shirt's stripes, where it shows between the lapels.
      const stripes = [];
      for (let y = 84; y < 127; y += 4.4) {
        const half = neckWidth(y) - 0.6;
        if (half > 1) stripes.push(`M${(80 - half).toFixed(2)} ${y.toFixed(1)} H${(80 + half).toFixed(2)}`);
      }
      svg('path', { class: 'oc-breton', d: stripes.join(' ') }, layer);
      for (const y of [132, 141.6, 151.2]) {
        for (const x of [74.6, 85.4]) inked(layer, `M${x - 1.7} ${y} A1.7 1.7 0 1 0 ${x + 1.7} ${y} A1.7 1.7 0 1 0 ${x - 1.7} ${y} Z`, 'oc-brass-button', 'oc-ink oc-ink--cool');
      }
    },
    neckwear(layer) {
      const pin = svg('g', { class: 'oc-compass-pin', transform: 'translate(91.8 98.6)' }, layer);
      inked(pin, 'M0 -3 A3 3 0 1 1 -0.01 -3 Z', 'oc-compass-ring', 'oc-ink oc-ink--cool');
      svg('circle', { class: 'oc-compass-face', cx: 0, cy: 0, r: 2 }, pin);
      svg('path', { class: 'oc-compass-north', d: 'M0 -1.9 L0.7 0 H-0.7 Z' }, pin);
      svg('path', { class: 'oc-compass-south', d: 'M0 1.9 L0.7 0 H-0.7 Z' }, pin);
    },
    sleeveTrim(upper, fore) {
      // Two rings of gold braid above each cuff.
      svg('path', { class: 'oc-braid', d: 'M104.5 159.8 C108 161 112.2 161 115.3 159.6 M104.9 163 C108.4 164.2 112.4 164.2 115.1 162.8' }, fore);
    },
  };
  // ------------------------------------------------------------------
  // The figure
  // ------------------------------------------------------------------

  const addPoint = (a, b) => a.map((v, i) => v + b[i]);
  const scalePoint = (a, scale) => a.map((v) => v * scale);
  const mixPoint = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
  const unitPoint = (a) => scalePoint(a, 1 / (Math.hypot(...a) || 1));
  const xy = (point) => point.map((v) => v.toFixed(2)).join(' ');

  /** One skeletal frame drives both sides of each limb and its lighting. */
  function armFrame(up, fore, length, hand) {
    const upper = rotate([ELBOW[0] - SHOULDER[0], ELBOW[1] - SHOULDER[1]], -up);
    const elbow = addPoint(SHOULDER, scalePoint(upper, length));
    const lower = rotate([WRIST[0] - ELBOW[0], WRIST[1] - ELBOW[1]], -fore);
    const wrist = addPoint(elbow, lower);
    const u = unitPoint(upper), v = unitPoint(lower);
    const normal = ([x, y]) => [y, -x];
    return { elbow, wrist, u, v, nu: normal(u), nv: normal(v),
      hand: rotate([0, 1], hand - fore), handNormal: rotate([1, 0], hand - fore),
      point: (along, across) => addPoint(SHOULDER, addPoint(scalePoint(u, along * length), scalePoint(normal(u), across))),
    };
  }

  /** A rounded deltoid flows into a narrow upper arm. Only its short root
   * bridges to the torso; the upper arm does not stretch a web from the neck. */
  function attachedSleeve(frame, style, surface) {
    const { point, u } = frame;
    const short = style === 'short';
    const end = short ? UPPER * 0.52 : UPPER;
    const width = short ? 7.8 : 7.2;
    // Rolled cloth belongs to the upper arm, above the elbow. The bare
    // elbow articulates below it; the roll is not a rotating joint cap.
    const endpoint = (side) => style === 'pushed' ? surface[side > 0 ? 'outside' : 'inside'].start
      : style === 'long' ? elbowContour(frame, side, width).start : point(end, side * width);
    const outside = `M91 80.2 C99 81 ${xy(point(-3, 10))} ${xy(point(6, 9.4))} C${xy(point(12, 9.2))} ${xy(addPoint(endpoint(1), scalePoint(u, -6)))} ${xy(endpoint(1))}`;
    const inside = `M${xy(endpoint(-1))} C${xy(addPoint(endpoint(-1), scalePoint(u, -6)))} ${xy(point(10, -8))} ${xy(point(8, -8))} C${xy(point(4, -8))} 102 110 101.4 118`;
    const hem = short ? `Q${xy(point(end + 1.6, 0))} ${xy(endpoint(-1))}` : `L${xy(endpoint(-1))}`;
    const tail = inside.replace(/^M[^C]+/, '');
    const close = ' C101 103 97 88 91 80.2 Z';
    // A long sleeve is one continuous surface through the elbow. The
    // foreground forearm pass overlaps it only to cover the torso.
    const full = outside + traceContour(surface.outside).replace(/^M[^C]+/, '')
      + traceContour(surface.inside, true).replace(/^M/, 'L') + tail;
    const roll = (depth) => {
      const a = addPoint(endpoint(1), scalePoint(u, -depth));
      const b = addPoint(endpoint(-1), scalePoint(u, -depth));
      return `M${xy(a)} Q${xy(addPoint(mixPoint(a, b, 0.5), scalePoint(u, 1)))} ${xy(b)}`;
    };
    return { edge: style === 'long' ? full : outside + hem + tail,
      fill: (style === 'long' ? full : outside + hem + tail) + close,
      upper: outside + hem + tail + close,
      roll: style === 'pushed' ? roll(6) : '' };
  }

  /** Offset the elbow differently on its two sides. The outside rounds
   * around the joint; the inside cuts back to the crease. A symmetric
   * swollen cap on both sides is neither an elbow nor a cloth fold. */
  function elbowContour({ elbow, u, v, nu, nv }, side, radius) {
    const angle = Math.acos(clamp(u[0] * v[0] + u[1] * v[1], -1, 1));
    const inner = side * (u[0] * v[1] - u[1] * v[0]) < 0;
    const halfTangent = Math.tan(angle / 2);
    const inset = inner ? Math.min(29, (radius + 1.2) * halfTangent) : 0;
    const start = addPoint(elbow, addPoint(scalePoint(u, -inset), scalePoint(nu, side * radius)));
    const end = addPoint(elbow, addPoint(scalePoint(v, inset), scalePoint(nv, side * radius)));
    // Offset-line intersection plus a small tangent fillet. An arbitrary
    // inset/control length reverses the inner contour at deep flexion.
    const fillet = inner ? Math.max(0, halfTangent > 1e-5 ? inset / halfTangent - radius : 0) : radius;
    const tangent = 4 / 3 * Math.tan(angle / 4) * fillet;
    return { inner, inset, start, end, curve: [addPoint(start, scalePoint(u, tangent)), addPoint(end, scalePoint(v, -tangent)), end] };
  }

  /** Reversible cubic contours let skin and shading use the identical
   * elbow and wrist boundary, without overlapping capsule caps or seams. */
  function traceContour({ start, curves }, reverse = false) {
    if (!reverse) return `M${xy(start)}` + curves.map(([a, b, end]) => `C${xy(a)} ${xy(b)} ${xy(end)}`).join('');
    return `M${xy(curves.at(-1)[2])}` + curves.map((curve, i) => [curve[1], curve[0], i ? curves[i - 1][2] : start]).reverse()
      .map(([a, b, end]) => `C${xy(a)} ${xy(b)} ${xy(end)}`).join('');
  }

  function limbSurface(frame, sleeve) {
    const { elbow, wrist, u, v, nu, nv, hand, handNormal, point } = frame;
    const bare = sleeve !== 'long';
    const radius = bare ? 6.5 : 7.2;
    const contour = (side, fraction = 1) => {
      const edge = (center, normal, width) => addPoint(center, scalePoint(normal, side * width * fraction));
      const joint = elbowContour(frame, side, radius * fraction);
      const wristEdge = addPoint(edge(wrist, handNormal, 4.4), scalePoint(hand, 0.25));
      const exposed = sleeve === 'short' ? 20 : UPPER - 8;
      const remaining = Math.max(2, FORE - joint.inset);
      const distal = [addPoint(joint.end, scalePoint(v, remaining * 0.32)), addPoint(wristEdge, scalePoint(hand, -Math.min(7, remaining * 0.3))), wristEdge];
      const opening = point(exposed, side * radius * fraction);
      if (sleeve === 'pushed' && joint.inner) {
        // One inner contour runs from the cloth opening to the wrist.
        // Ease the opening toward the forearm as it folds, so no hidden
        // return arc appears as a hook or pops into view at a threshold.
        const available = Math.hypot(...addPoint(elbow, scalePoint(point(exposed, 0), -1)));
        const t = clamp(joint.inset / Math.max(1, available), 0, 1);
        return { start: mixPoint(opening, joint.end, t * t * (3 - 2 * t)), curves: [distal] };
      }
      const start = bare && joint.inset < UPPER - exposed ? opening : joint.start;
      const curves = bare ? [[mixPoint(start, joint.start, 0.35), mixPoint(start, joint.start, 0.7), joint.start]] : [];
      curves.push(joint.curve, distal);
      return { start, curves };
    };
    const outside = contour(1), inside = contour(-1);
    const join = (a, b) => traceContour(a) + traceContour(b, true).replace(/^M/, 'L') + ' Z';
    return { outside, inside, fill: join(outside, inside), edge: traceContour(outside) + traceContour(inside),
      shade: join(outside, contour(1, 0.55)), light: join(contour(-1, 0.6), contour(-1, 0.1)) };
  }

  // A cargo pocket on each thigh, and its flap.
  const CARGO = [
    ['M57.4 186 H67 V203.4 C63.8 204.6 60.6 204.6 57.4 203.4 Z', 'M57.2 186 H67.2 V190 H57.2 Z'],
    ['M93.4 188 H103 V205.4 C99.8 206.6 96.6 206.6 93.4 205.4 Z', 'M93.2 188 H103.2 V192 H93.2 Z'],
  ];

  /**
   * Draws a figure in `costume` into `sway` and returns its controls:
   * pose(p, time, open) places every joint from a REST-shaped pose, sets
   * the face, and opens the mouth; wear(heroHead) swaps the drawn face for
   * a hero's; hold(side, prop) puts a prop (PROPS) in a hand or empties it.
   * A 'woman' wears WOMAN_HEAD as her drawn face, anyone else the costume's.
   */
  function buildFigure(fig, sway, costumeName, gender) {
    const costume = COSTUMES[costumeName];
    const defs = svg('defs', {}, fig);
    const id = (name) => `oc-${name}-${++uid}`;
    const gradient = (kind, name, attrs, stops) => {
      const gid = id(name);
      const node = svg(kind, { id: gid, ...attrs }, defs);
      stops.forEach((offset, index) => svg('stop', { offset, class: `oc-${name}-stop-${index}` }, node));
      return `url(#${gid})`;
    };
    const user = { gradientUnits: 'userSpaceOnUse' };
    const paint = {
      defs,
      top: gradient('linearGradient', 'top', { ...user, x1: 56, y1: 80, x2: 104, y2: 160 }, ['0', '0.5', '1']),
      sleeve: gradient('linearGradient', 'sleeve', { ...user, x1: 56, y1: 80, x2: 104, y2: 160 }, ['0', '0.6', '1']),
      trouserLeft: gradient('linearGradient', 'trouser', { ...user, x1: 56.4, y1: 0, x2: 80, y2: 0 }, ['0', '0.34', '0.74', '1']),
      trouserRight: gradient('linearGradient', 'trouser', { ...user, x1: 80.6, y1: 0, x2: 103.6, y2: 0 }, ['0', '0.34', '0.74', '1']),
      trouserFall: gradient('linearGradient', 'trouser-fall', { ...user, x1: 0, y1: 150, x2: 0, y2: 290 }, ['0', '1']),
      shoe: gradient('linearGradient', 'shoe', { x1: 0, y1: 0, x2: 0.3, y2: 1 }, ['0', '0.55', '1']),
      skin: gradient('linearGradient', 'skin', { x1: 1, y1: 0, x2: 0, y2: 0 }, ['0', '0.55', '1']),
      hair: gradient('linearGradient', 'hair', { x1: 0, y1: 0, x2: 1, y2: 0.8 }, ['0', '0.4', '0.75', '1']),
      iris: gradient('radialGradient', 'iris', { cx: 0.4, cy: 0.35, r: 0.7 }, ['0', '0.6', '1']),
      blush: gradient('radialGradient', 'blush', { cx: 0.5, cy: 0.5, r: 0.5 }, ['0', '1']),
      face: gradient('radialGradient', 'face', { ...user, cx: -10, cy: -78, r: 70, fx: -18, fy: -92, gradientTransform: 'translate(0 23.4) scale(1 1.3)' }, ['0', '0.6', '1']),
      nose: gradient('linearGradient', 'face', { ...user, x1: -5, y1: -48, x2: 9, y2: -44 }, ['0', '0.55', '1']),
      clothDepth: gradient('radialGradient', 'cloth-depth', { ...user, cx: 78, cy: 111, r: 34, gradientTransform: 'translate(0 -77.7) scale(1 1.7)' }, ['0', '0.45', '0.78', '1']),
      clothGlow: gradient('radialGradient', 'cloth-glow', { ...user, cx: 71, cy: 106, r: 26, gradientTransform: 'translate(0 -74.2) scale(1 1.7)' }, ['0', '0.5', '1']),
    };

    for (const [name, transform] of [['clothDepth', 'translate(0 -77.7) scale(1 1.7)'], ['clothGlow', 'translate(0 -74.2) scale(1 1.7)']]) {
      const gid = id(name);
      svg('radialGradient', { id: gid, href: paint[name].slice(4, -1), gradientTransform: `${MIRROR} ${transform}` }, defs);
      paint[`${name}Left`] = `url(#${gid})`;
    }
    const softVolumeId = id('soft-volume');
    const softVolume = svg('filter', { id: softVolumeId, x: '-50%', y: '-50%', width: '200%', height: '200%', 'color-interpolation-filters': 'sRGB' }, defs);
    svg('feGaussianBlur', { stdDeviation: 1.3 }, softVolume);

    const topLeftId = id('top-left');
    svg('linearGradient', { id: topLeftId, href: paint.top.slice(4, -1), gradientTransform: MIRROR }, defs);
    paint.topLeft = `url(#${topLeftId})`;

    // Shoes, then the trousers over their tops; the trousers foreshorten
    // about their hems when the knees give, so the shoes stay put.
    const legs = svg('g', { class: `oc-legs oc-shoes--${costume.shoes || 'sneaker'}` }, sway);
    const legGroups = FEET.map((foot, i) => {
      const leg = svg('g', {}, legs);
      inked(leg, foot.sole, 'oc-sole');
      svg('path', { class: 'oc-upper', d: foot.upper, fill: paint.shoe }, leg);
      svg('path', { class: 'oc-shoe-turn', d: foot.turn }, leg);
      if (costume.shoes !== 'shoe') svg('path', { class: 'oc-laces', d: foot.laces }, leg);
      svg('path', { class: 'oc-shoe-shine', d: foot.toe }, leg);
      inked(leg, LEGS[i], 'oc-trousers', 'oc-ink oc-ink--cool', i ? paint.trouserRight : paint.trouserLeft);
      svg('path', { class: 'oc-trouser-fall', d: LEGS[i], fill: paint.trouserFall }, leg);
      drawParts(leg, LEG_DETAIL[i]);
      if (costume.cargo) {
        inked(leg, CARGO[i][0], 'oc-cargo', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-cargo-flap', d: CARGO[i][1] }, leg);
      }
      return leg;
    });

    // Everything above the hips drops with the knees.
    const trunk = svg('g', {}, sway);
    svg('path', { class: 'oc-hem-shadow', d: 'M58.4 158.8 C66 160.8 94 160.8 101.6 158.8' }, trunk);
    if (costume.back) costume.back(svg('g', {}, trunk), paint);
    paint.garmentOutline = svg('g', {}, trunk);
    const upperArms = svg('g', {}, trunk);
    costume.top(svg('g', { class: 'oc-top-layer' }, trunk), paint);
    const wornUnder = svg('g', {}, trunk);
    const drawnNeck = svg('g', {}, trunk);
    inked(drawnNeck, NECK, 'oc-skin-neck', 'oc-ink oc-ink--face', paint.skin);
    svg('path', { class: 'oc-neck-shade', d: NECK_SHADE }, drawnNeck);
    costume.collar(svg('g', { 'data-testid': 'oc-collar' }, trunk));
    if (costume.neckwear) costume.neckwear(svg('g', {}, trunk));
    const headGroup = svg('g', {}, trunk);
    const drawnFace = svg('g', { 'data-testid': 'oc-drawn-face' }, headGroup);
    const setFace = drawnHead(drawnFace, gender === 'woman' ? WOMAN_HEAD : costume.head, paint);
    const wornOver = svg('g', {}, headGroup);
    if (costume.headwear) costume.headwear(svg('g', { class: 'oc-headwear' }, headGroup), paint);
    const sleepMask = drawSleepMask(svg('g', { class: 'oc-sleep-mask', 'data-testid': 'oc-sleep-mask' }, headGroup));
    const arms = svg('g', {}, trunk);

    // The arms: the sleeve deforms from its attached root; the forearm turns with it,
    // then at the elbow; the hand at the wrist, holding what it holds
    // between its parts behind and in front (or behind them all).
    const arm = (side) => {
      const root = svg('g', { transform: side < 0 ? MIRROR : '', 'data-testid': `oc-arm-${side < 0 ? 'left' : 'right'}` }, arms);
      // Like the sheriff in Design It In: upper sleeves emerge beneath
      // the garment; forearms and hands remain in front. The shoulder and
      // axilla stay attached while the sleeve's distal end follows the bone.
      const shoulder = svg('g', { transform: side < 0 ? MIRROR : '' }, upperArms);
      const fabric = costume.undershirt ? paint.sleeve : paint.top;
      const sleevePaintId = id('upper-fabric');
      svg('linearGradient', { id: sleevePaintId, href: fabric.slice(4, -1), gradientTransform: side < 0 ? MIRROR : '' }, defs);
      const sleeveInk = svg('path', { class: 'oc-ink oc-ink--cool' }, shoulder);
      const sleeveFill = svg('path', { class: 'oc-sleeve', fill: `url(#${sleevePaintId})` }, shoulder);
      const sleeveClip = svg('clipPath', { id: id('sleeve-volume') }, defs);
      const sleeveBoundary = svg('path', {}, sleeveClip);
      const sleeveLight = svg('path', { class: 'oc-sleeve-volume-light', filter: `url(#${softVolumeId})`, 'clip-path': `url(#${sleeveClip.id})` }, shoulder);
      const foldWindow = svg('g', { 'clip-path': `url(#${sleeveClip.id})` }, shoulder);
      const folds = svg('g', {}, foldWindow);
      const rollDetail = svg('path', { class: 'oc-sleeve-fold' }, foldWindow);
      const upperFolds = costume.sleeve === 'short' ? 'M103.4 114.6 C107 116.2 111.4 116 115 114'
        : costume.sleeve === 'pushed' ? 'M111.6 101.4 C112.4 107 112.8 112 112.8 116' : SLEEVE_FOLDS;
      svg('path', { class: 'oc-sleeve-fold', d: upperFolds }, folds);
      const limb = svg('g', {}, root);
      const contourClipId = id('elbow-contour');
      const contourClip = svg('clipPath', { id: contourClipId }, defs);
      const contourWindow = svg('path', { 'clip-rule': 'evenodd' }, contourClip);
      // The shirt hem covers the bare upper arm, including its ink. Skin
      // must not paint over the hem and leave isolated fragments of outline.
      if (costume.sleeve === 'short') limb.setAttribute('clip-path', `url(#${contourClipId})`);
      const limbInk = svg('path', { class: costume.sleeve === 'long' ? 'oc-ink oc-ink--cool oc-limb-edge' : 'oc-hand-outline', ...(costume.sleeve === 'long' ? { 'clip-path': `url(#${contourClipId})` } : {}) }, limb);
      const limbFill = svg('path', { class: costume.sleeve === 'long' ? 'oc-sleeve' : 'oc-skin', ...(costume.sleeve === 'long' ? { fill: `url(#${sleevePaintId})` } : {}) }, limb);
      const limbClip = svg('clipPath', { id: id('limb-volume') }, defs);
      const limbBoundary = svg('path', {}, limbClip);
      const volume = svg('g', { 'clip-path': `url(#${limbClip.id})` }, limb);
      const limbShade = svg('path', { class: costume.sleeve === 'long' ? 'oc-cloth-volume-shade' : 'oc-limb-shade', filter: `url(#${softVolumeId})` }, volume);
      const limbLight = svg('path', { class: 'oc-surface-volume-light', filter: `url(#${softVolumeId})` }, volume);
      if (costume.sleeve !== 'long') limb.appendChild(limbInk);
      const wristFade = svg('linearGradient', { id: id('wrist-fade'), gradientUnits: 'userSpaceOnUse' }, defs);
      svg('stop', { offset: 0, 'stop-color': 'white' }, wristFade);
      svg('stop', { offset: 1, 'stop-color': 'black' }, wristFade);
      const wristMask = svg('mask', { id: id('wrist-light'), maskUnits: 'userSpaceOnUse', x: -500, y: -500, width: 1000, height: 1000 }, defs);
      svg('rect', { x: -500, y: -500, width: 1000, height: 1000, fill: `url(#${wristFade.id})` }, wristMask);
      if (costume.sleeve !== 'long') volume.setAttribute('mask', `url(#${wristMask.id})`);
      const foreDetailWindow = svg('g', { 'clip-path': `url(#${limbClip.id})` }, root);
      const foreDetails = svg('g', {}, foreDetailWindow);
      const reachGroup = svg('g', {}, root);
      const fore = svg('g', {}, reachGroup);
      if (costume.sleeve === 'long') svg('path', { class: 'oc-sleeve-fold', d: FORE_SLEEVE_FOLDS }, foreDetails);
      const wrist = svg('g', {}, fore);
      const heldBehind = svg('g', {}, wrist);
      const hand = svg('g', { class: 'oc-hand', 'data-testid': 'oc-hand', transform: `translate(${WRIST[0]} ${WRIST[1]})` }, wrist);
      if (costume.sleeve === 'long') inked(fore, CUFF, 'oc-cuff', 'oc-ink oc-ink--cool');
      if (costume.sleeveTrim) costume.sleeveTrim(folds, foreDetails);
      const shapes = new Map();
      let shown = null;
      const held = { name: null, node: null };
      return {
        side, root, shoulder, sleeveInk, sleeveFill, sleeveLight, sleeveBoundary, folds, rollDetail, foreDetails, limb, limbInk, limbFill, limbShade, limbLight, limbBoundary, wristFade, contourWindow, reach: reachGroup, fore, wrist, heldBehind, hand, held,
        get shown() { return shown; },
        shape(asked, force = false) {
          const grip = held.node ? HOLDING[held.name] : null;
          // Holding is a persistent contact, never an incidental gesture.
          // In particular, REST's open fingers cannot retain a tool.
          const name = grip ? grip.shape : asked;
          if (name === shown && !force) return;
          if (!shapes.has(name)) {
            const g = svg('g', {}, hand);
            const behind = svg('g', {}, g);
            drawHandParts(behind, HANDS[name].behind);
            const between = svg('g', {}, g);
            drawHandParts(g, HANDS[name].front);
            shapes.set(name, { g, between });
          }
          for (const [key, { g }] of shapes) g.setAttribute('display', key === name ? 'inline' : 'none');
          shown = name;
          hand.setAttribute('data-hand-shape', name);
          // A held prop sits between the hand's parts behind and in front,
          // at its hold, or behind the whole hand.
          if (held.node) {
            const parent = grip.shape === 'edge' ? shapes.get(name).between : heldBehind;
            held.at = parent === heldBehind ? addPoint(WRIST, grip.hand) : grip.hand;
            held.node.setAttribute('transform', `translate(${xy(held.at)}) rotate(${grip.turn || 0}) translate(${-grip.contact[0]} ${-grip.contact[1]})`);
            if (held.node.parentNode !== parent) parent.appendChild(held.node);
          }
        },
        /**
         * Cancels body sway at the contact point for gravity-sensitive props.
         * Their carrying wrist compensates as well: the prop does not spin
         * inside an independently rotating fist.
         */
        level(fig) {
          const grip = HOLDING[held.name];
          if (!held.node || !grip.upright) return;
          const parent = held.node.parentNode?.getCTM?.();
          const base = fig.getCTM?.();
          if (!parent || !base) return;
          const m = base.inverse().multiply(parent);
          // up in the figure, as seen from the hand's frame: L⁻¹ (0, -1).
          const det = m.a * m.d - m.b * m.c;
          if (!det) return;
          const [vx, vy] = [m.c / det, -m.a / det];
          const angle = degrees(Math.atan2(vx, -vy));
          held.node.setAttribute('transform', `translate(${xy(held.at)}) rotate(${angle.toFixed(2)}) translate(${-grip.contact[0]} ${-grip.contact[1]})`);
        },
      };
    };
    const right = arm(1);
    const left = arm(-1);

    const turn = (angle, [cx, cy]) => `rotate(${angle.toFixed(2)} ${cx} ${cy})`;
    const axis = UPPER_REST - 90;
    const shorten = (f) => `translate(${SHOULDER[0]} ${SHOULDER[1]}) rotate(${axis.toFixed(2)}) scale(1 ${f.toFixed(4)}) rotate(${(-axis).toFixed(2)}) translate(${-SHOULDER[0]} ${-SHOULDER[1]})`;
    function poseArm(a, [up, fo], lift, hand, shape) {
      const f = 1 - LIFT * lift;
      const upperTransform = `${turn(-up, SHOULDER)} ${shorten(f)}`;
      a.folds.setAttribute('transform', upperTransform);
      const frame = armFrame(up, fo, f, clamp(hand, ...WRIST_RANGE));
      const fadeStart = addPoint(frame.wrist, scalePoint(frame.hand, -12));
      for (const [key, value] of Object.entries({ x1: fadeStart[0], y1: fadeStart[1], x2: frame.wrist[0], y2: frame.wrist[1] })) a.wristFade.setAttribute(key, value);
      const surface = limbSurface(frame, costume.sleeve);
      const sleeve = attachedSleeve(frame, costume.sleeve, surface);
      a.limbInk.setAttribute('d', surface.edge);
      a.limbFill.setAttribute('d', surface.fill);
      a.limbShade.setAttribute('d', surface.shade);
      a.limbLight.setAttribute('d', surface.light);
      a.limbBoundary.setAttribute('d', surface.fill);
      a.sleeveInk.setAttribute('d', sleeve.edge);
      a.sleeveFill.setAttribute('d', sleeve.fill);
      a.sleeveBoundary.setAttribute('d', sleeve.fill);
      a.rollDetail.setAttribute('d', sleeve.roll);
      const sleeveEnd = costume.sleeve === 'short' ? UPPER * 0.52 : costume.sleeve === 'pushed' ? UPPER - 8 : UPPER;
      a.sleeveLight.setAttribute('d', `M${xy(frame.point(-3, -2.5))} C${xy(frame.point(6, -3.5))} ${xy(frame.point(sleeveEnd - 8, -2.8))} ${xy(frame.point(sleeveEnd, -2))}`);
      // Ink only the union's silhouette: the sleeve hides the proximal
      // forearm contour, just as the forearm fill hides the sleeve's end.
      a.contourWindow.setAttribute('d', `M-500 -500 H500 V500 H-500 Z ${sleeve.upper}`);
      const inFront = up < -18;
      const sleeveParent = inFront ? a.root : upperArms;
      if (a.shoulder.parentNode !== sleeveParent) {
        if (inFront) a.root.insertBefore(a.shoulder, a.limb);
        else upperArms.appendChild(a.shoulder);
      }
      a.shoulder.setAttribute('transform', !inFront && a.side < 0 ? MIRROR : '');
      a.reach.setAttribute('transform', turn(-up, SHOULDER));
      const [dx, dy] = [(f - 1) * (ELBOW[0] - SHOULDER[0]), (f - 1) * (ELBOW[1] - SHOULDER[1])];
      a.fore.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) ${turn(up - fo, ELBOW)}`);
      a.foreDetails.setAttribute('transform', `${turn(-up, SHOULDER)} ${a.fore.getAttribute('transform')}`);
      a.wrist.setAttribute('transform', turn(clamp(hand, ...WRIST_RANGE), WRIST));
      a.shape(shape);
    }

    let worn = null;
    function pose(p, time, open, blink) {
      const drop = 7 * p.crouch;
      const squash = 1 - drop / (HEMS - WAIST);
      legs.setAttribute('transform', `translate(0 ${HEMS}) scale(1 ${squash.toFixed(4)}) translate(0 ${-HEMS})`);
      trunk.setAttribute('transform', `translate(0 ${drop.toFixed(2)})`);
      const base = fig.getCTM(), matrix = trunk.getCTM();
      const relative = base && matrix ? base.inverse().multiply(matrix) : null;
      const bodyTurn = relative ? degrees(Math.atan2(relative.b, relative.a)) : 0;
      for (const [side, arm] of [['right', right], ['left', left]]) {
        const grip = HOLDING[arm.held.name];
        let joints = p[side], wristTurn = p[`${side}Hand`];
        if (arm.held.name === 'cane' && relative) {
          // A rigid cane plants at the floor; crouching or leaning moves
          // the supporting wrist, not the cane's length or its foot. Solve
          // the actual grip point after wrist limits, not just the wrist.
          const x = grip.carry.reach[0], figureX = side === 'left' ? 160 - x : x;
          let contactY = 0;
          for (let pass = 0; pass < 8; pass++) {
            const y = (162 - contactY - relative.f - relative.b * figureX) / relative.d;
            joints = reach([x, y]);
            wristTurn = handToward(joints, 0);
            const turn = clamp(wristTurn - bodyTurn * arm.side, ...WRIST_RANGE);
            const offset = rotate(grip.hand, turn - joints[1]);
            contactY = relative.b * offset[0] * arm.side + relative.d * offset[1];
          }
        }
        const hand = wristTurn - (grip?.upright ? bodyTurn * arm.side : 0);
        poseArm(arm, joints, arm.held.name === 'cane' ? 0 : p[`${side}Lift`], hand, p[`${side}Shape`]);
      }
      // An arm raised across the body comes in front of the other.
      const across = (a, [up]) => -up > 18;
      const front = across(left, p.left) && !across(right, p.right) ? left : right;
      if (arms.lastChild !== front.root) arms.appendChild(front.root);
      const tilt = `translate(0 ${(1.8 * p.nod).toFixed(2)}) rotate(${p.tilt.toFixed(2)} ${HEAD.x} ${HEAD.chin})`;
      headGroup.setAttribute('transform', tilt);
      wornUnder.setAttribute('transform', tilt);
      if (worn) worn(time, { look: p.look, down: p.down, brow: p.brow, frown: p.frown, sing: open }, reducedMotion.matches);
      else setFace(p, blink, open);
      age(p.age || 0);
      // The mask slides down from the forehead over the eyes (and glasses).
      sleepMask.setAttribute('opacity', clamp(p.mask * 4, 0, 1).toFixed(3));
      sleepMask.setAttribute('transform', `translate(0 ${(-18 * (1 - p.mask)).toFixed(2)})`);
    }

    // Silver for hair that has aged overnight: each colour token of a worn
    // hero's hair, brows, and beard, and the drawn face's hair, blends
    // towards its silver.
    const SILVER = {
      '--hero-hair': '#d6d9df', '--hero-hair-light': '#f2f3f6', '--hero-hair-dark': '#959ba5', '--hero-hair-rim': '#6c717b',
      '--hero-hair-specular': '#ffffff', '--hero-eyebrow': '#c4c8cf', '--hero-eyebrow-rim': '#8a8f99', '--hero-facial-hair': '#d6d9df',
      '--oc-hair': '#d6d9df', '--oc-hair-dark': '#959ba5', '--oc-hair-light': '#f2f3f6',
    };
    const hexMix = (a, b, u) => {
      const parse = (hex) => {
        const h = hex.trim().replace('#', '');
        const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
        return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
      };
      const [x, y] = [parse(a), parse(b)];
      if (x.some(Number.isNaN) || y.some(Number.isNaN)) return a;
      return `#${x.map((c, i) => Math.round(c + (y[i] - c) * u).toString(16).padStart(2, '0')).join('')}`;
    };
    const originals = new Map();
    let agedTo = 0;
    function age(amount) {
      if (Math.abs(amount - agedTo) < 0.004) return;
      agedTo = amount;
      for (const node of [fig, ...wornOver.querySelectorAll('svg'), ...wornUnder.querySelectorAll('svg')]) {
        if (!originals.has(node)) {
          const style = getComputedStyle(node);
          originals.set(node, Object.keys(SILVER).map((name) => [name, (node === fig ? style.getPropertyValue(name) : node.style.getPropertyValue(name)).trim()]).filter(([, value]) => value.startsWith('#')));
        }
        for (const [name, value] of originals.get(node)) node.style.setProperty(name, amount > 0 ? hexMix(value, SILVER[name], amount) : value);
      }
    }

    function wear(heroHead) {
      for (const layer of [wornUnder, wornOver]) layer.replaceChildren();
      agedTo = -1;
      worn = heroHead.wear({ underCollar: wornUnder, overCollar: wornOver }, HEAD);
      heroHead.paint(fig);
      fig.classList.add('oc-art--hero');
      for (const drawn of [drawnNeck, drawnFace]) drawn.setAttribute('display', 'none');
    }

    function hold(side, prop) {
      const a = side === 'left' ? left : right;
      if (a.held.name === prop) return;
      a.held.node?.remove();
      a.held.name = prop;
      a.held.node = prop ? PROPS[prop](svg('g', { class: `oc-prop oc-prop--${prop}`, 'data-testid': 'oc-held-prop', 'data-prop': prop })) : null;
      if (a.shown) a.shape(a.shown, true);
    }

    /** The legs' stride: each swings `angle` degrees from its hip, opposite ways. */
    function swing(angle) {
      legGroups.forEach((leg, i) => leg.setAttribute('transform', angle ? `rotate(${(i ? -angle : angle).toFixed(2)} ${HIPS[i][0]} ${HIPS[i][1]})` : ''));
    }

    /** Levels the upright props in both hands; call after the figure is placed and posed. */
    function level() {
      right.level(fig);
      left.level(fig);
    }

    return { pose, wear, hold, swing, level, arms: { right, left } };
  }

  // ------------------------------------------------------------------
  // Props a hand can hold, each drawn in its own frame with its handle at
  // the origin and its long axis along +x.
  // ------------------------------------------------------------------

  // Contacts are expressed in each object's drawing coordinates and in the
  // hand's wrist-local coordinates. One profile owns grip AND orientation.
  // Persistent carry poses reserve the occupied arm; transient actions
  // (raising a trophy, sweeping, stamping) author their own coordinated reach.
  const HOLDING = {
    clipboard: { shape: 'edge', hand: [2.4, 12.3], contact: [-1, 0], upright: true, carry: { reach: [142, 132], dir: 0 } },
    palette: { shape: 'edge', hand: [2.4, 12.3], contact: [1.6, 3], upright: true, carry: { reach: [143, 140], dir: 0 } },
    mug: { shape: 'grip', hand: [0, 11], contact: [-4, 0], upright: true, carry: { reach: [146, 128], dir: 0 } },
    wrench: { shape: 'grip', hand: [0, 11], contact: [0, 0], carry: { reach: [143, 140], dir: 24 } },
    magnifier: { shape: 'grip', hand: [0, 11], contact: [0, 0], carry: { reach: [142, 132], dir: 8 } },
    spyglass: { shape: 'grip', hand: [0, 11], contact: [0, 0], turn: 90 },
    trophy: { shape: 'grip', hand: [0, 11], contact: [0, 2], upright: true },
    stamp: { shape: 'grip', hand: [0, 12], contact: [0, 0], upright: true },
    broom: { shape: 'grip', hand: [0, 11], contact: [0, 0], turn: 116 },
    cane: { shape: 'grip', hand: [0, 12], contact: [0, -3], upright: true, carry: { reach: [128, 159], dir: 0 } },
    brick: { shape: 'flat', hand: [6.1, 19.5], contact: [10, 8], upright: true, carry: { reach: [143, 128], dir: 0 } },
  };

  const PROPS = {
    // A gold 2×2 toy brick, held from below: its studs up.
    brick(g) {
      inked(g, 'M-2 -6 H22 V8 H-2 Z', 'oc-brick', 'oc-ink oc-ink--cool');
      inked(g, 'M1.6 -9.4 H8 V-6 H1.6 Z M12 -9.4 H18.4 V-6 H12 Z', 'oc-brick-stud', 'oc-ink oc-ink--cool');
      svg('path', { class: 'oc-brick-shine', d: 'M0 -4 H20' }, g);
      return g;
    },
    // A clipboard held by its side edge: the board, its steel clip, and a
    // sheet with a ticked list.
    clipboard(g) {
      inked(g, 'M-1 -13 H22 V15 H-1 Z', 'oc-board', 'oc-ink oc-ink--cool');
      svg('path', { class: 'oc-paper', d: 'M1.4 -9.6 H19.6 V13 H1.4 Z' }, g);
      svg('path', { class: 'oc-paper-lines', d: 'M7 -5 H17.4 M7 0 H17.4 M7 5 H17.4 M7 10 H14' }, g);
      svg('path', { class: 'oc-paper-ticks', d: 'M2.8 -5.4 L3.8 -4.2 L5.4 -6.6 M2.8 -0.4 L3.8 0.8 L5.4 -1.6 M2.8 4.6 L3.8 5.8 L5.4 3.4' }, g);
      inked(g, 'M6.6 -14.6 H14.4 V-10.6 C12.4 -9.6 8.6 -9.6 6.6 -10.6 Z', 'oc-steel', 'oc-ink oc-ink--cool');
      return g;
    },
    // A coffee mug held by its handle, the mug out past the knuckles.
    mug(g) {
      svg('path', { class: 'oc-mug-handle', d: 'M-2 -5 C-6 -5 -6 5 -2 5' }, g);
      inked(g, 'M0 -8 H13 V7 C13 9.6 11 11 8.4 11 H4.6 C2 11 0 9.6 0 7 Z', 'oc-mug', 'oc-ink oc-ink--cool');
      svg('ellipse', { class: 'oc-coffee', cx: 6.5, cy: -8, rx: 6.5, ry: 1.6 }, g);
      svg('path', { class: 'oc-mug-band', d: 'M0 -2 H13 V1 H0 Z' }, g);
      svg('path', { class: 'oc-steam', d: 'M4 -11 C2.6 -13 5.2 -14.6 3.8 -17 M8.6 -11.4 C7.2 -13.4 9.8 -15 8.4 -17.4' }, g);
      return g;
    },
    // A steel spanner.
    wrench(g) {
      inked(g, 'M-6 -1.6 H22 V1.6 H-6 Z', 'oc-steel', 'oc-ink oc-ink--cool');
      inked(g, 'M22 -4.6 C26.4 -5.4 29.6 -2.6 29.6 0 C29.6 2.6 26.4 5.4 22 4.6 L24 1.4 H27.4 V-1.4 H24 Z', 'oc-steel', 'oc-ink oc-ink--cool');
      svg('path', { class: 'oc-steel-shine', d: 'M-4 -0.6 H20' }, g);
      return g;
    },
    // A magnifying glass: a handle and a brass-rimmed lens.
    magnifier(g) {
      inked(g, 'M-6 -1.8 H12 V1.8 H-6 Z', 'oc-handle', 'oc-ink oc-ink--cool');
      inked(g, 'M12 -1.2 H15.4 V1.2 H12 Z', 'oc-brass', 'oc-ink oc-ink--cool');
      svg('circle', { class: 'oc-ink oc-ink--cool', cx: 24.4, cy: 0, r: 9 }, g);
      svg('circle', { class: 'oc-brass', cx: 24.4, cy: 0, r: 9 }, g);
      svg('circle', { class: 'oc-lens', cx: 24.4, cy: 0, r: 7.2 }, g);
      svg('path', { class: 'oc-lens-glint', d: 'M19.6 -3 C20.6 -5 22.4 -6.2 24.4 -6.4' }, g);
      return g;
    },
    // A navigator's brass spyglass held by its eyepiece: three leather-bound
    // draw tubes, each wider than the last, and a brass hood at the lens.
    spyglass(g) {
      inked(g, 'M-6 -2 H6 V2 H-6 Z', 'oc-brass', 'oc-ink oc-ink--cool');
      inked(g, 'M6 -2.8 H17 V2.8 H6 Z', 'oc-spyglass', 'oc-ink oc-ink--cool');
      inked(g, 'M17 -3.8 H31 V3.8 H17 Z', 'oc-spyglass', 'oc-ink oc-ink--cool');
      inked(g, 'M31 -4.8 H35 V4.8 H31 Z', 'oc-brass', 'oc-ink oc-ink--cool');
      svg('path', { class: 'oc-spyglass-ring', d: 'M6 -2.8 V2.8 M17 -3.8 V3.8' }, g);
      svg('path', { class: 'oc-spyglass-shine', d: 'M8 -1.6 H15.4 M19 -2.4 H29.4' }, g);
      return g;
    },
    // A painter's palette held by its thumb hole, with dabs of colour.
    palette(g) {
      inked(g, 'M-4 -8 C6 -14 22 -12 28 -4 C32 2 28 10 20 11 C16 11.6 14 9 10 9.6 C6 10.2 6 14 1 13 C-6 11.6 -9 -3 -4 -8 Z', 'oc-palette', 'oc-ink oc-ink--cool');
      svg('ellipse', { class: 'oc-palette-hole', cx: 1.6, cy: 3, rx: 2.6, ry: 2.2 }, g);
      for (const [cx, cy, tone] of [[8, -6, 'red'], [15, -7.6, 'gold'], [21.6, -4.6, 'blue'], [24.4, 2.4, 'green'], [18, 6, 'violet']]) {
        svg('ellipse', { class: 'oc-dab oc-dab--' + tone, cx, cy, rx: 2.6, ry: 2 }, g);
      }
      return g;
    },
    // A rubber stamp, its knob in the fist and its pad below.
    stamp(g) {
      inked(g, 'M-3 -3.4 C-3 -6 3 -6 3 -3.4 V3 H-3 Z', 'oc-handle', 'oc-ink oc-ink--cool');
      inked(g, 'M-2 3 H2 V8 H-2 Z', 'oc-handle', 'oc-ink oc-ink--cool');
      inked(g, 'M-9 8 H9 V12 H-9 Z', 'oc-stamp-base', 'oc-ink oc-ink--cool');
      svg('path', { class: 'oc-stamp-ink', d: 'M-8.4 12 H8.4 V13.6 H-8.4 Z' }, g);
      return g;
    },
    // A broom: a long handle and its straw head.
    broom(g) {
      inked(g, 'M-40 -1.4 H85 V1.4 H-40 Z', 'oc-handle', 'oc-ink oc-ink--cool');
      inked(g, 'M85 -3 H89 L108 -11 C110 -4 110 4 108 11 L89 3 H85 Z', 'oc-straw', 'oc-ink oc-ink--cool');
      svg('path', { class: 'oc-straw-line', d: 'M91 -2.4 L108 -8 M91 0 L109 0 M91 2.4 L108 8 M88 -3 V3' }, g);
      return g;
    },
    // A gold trophy cup held by its stem.
    trophy(g) {
      inked(g, 'M-4 6 H4 V9 H-4 Z', 'oc-gold-dark', 'oc-ink oc-ink--cool');
      inked(g, 'M-1.6 -2 H1.6 V6 H-1.6 Z', 'oc-gold', 'oc-ink oc-ink--cool');
      inked(g, 'M-9 -18 H9 C9 -9 5 -2 0 -2 C-5 -2 -9 -9 -9 -18 Z', 'oc-gold', 'oc-ink oc-ink--cool');
      svg('path', { class: 'oc-gold-handle', d: 'M-9 -15 C-14 -15 -14 -8 -7.4 -7.4 M9 -15 C14 -15 14 -8 7.4 -7.4' }, g);
      svg('path', { class: 'oc-gold-shine', d: 'M-6 -15.6 C-6 -10 -3.6 -6 -1 -4.6' }, g);
      return g;
    },
    // A wooden walking cane, its crook in the hand.
    cane(g) {
      svg('path', { class: 'oc-cane-ink', d: 'M-5 -2 C-6 -8 2 -10 3 -4 L3 128' }, g);
      svg('path', { class: 'oc-cane', d: 'M-5 -2 C-6 -8 2 -10 3 -4 L3 128' }, g);
      return g;
    },
  };

  // ------------------------------------------------------------------
  // Singing: the mouth follows the sung words
  // ------------------------------------------------------------------

  /**
   * Word intervals [start, end] for a voice from the storyboard: each line's
   * marks, every word lasting until the next one starts, the last until the
   * line ends (a held note stays open). Omit voice for a solo performer
   * who sings every line.
   */
  function wordsFor(storyboard, voice) {
    const words = [];
    for (const section of storyboard.sections) {
      for (const line of section.lines) {
        if (voice !== undefined && (line.voice || section.voice) !== voice) continue;
        const times = Object.values(line.marks || {}).sort((a, b) => a - b);
        times.forEach((at, i) => words.push([at, i + 1 < times.length ? times[i + 1] : line.end]));
      }
    }
    return words.sort((a, b) => a[0] - b[0]);
  }

  /**
   * How open the mouth is at t (0 … 1): each word opens it quickly, holds,
   * and closes it before the next; a long held note opens wide and wavers
   * with a singer's vibrato. Words are sorted [start, end] pairs.
   */
  function mouthAt(words, t, reduced) {
    let lo = 0, hi = words.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (words[mid][0] <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (found < 0) return 0;
    const [start, end] = words[found];
    const length = Math.max(0.08, end - start);
    if (t >= end) return 0;
    const age = t - start;
    const peak = length > 0.9 ? 0.95 : length > 0.4 ? 0.8 : 0.42 + 0.3 * hash01(Math.round(start * 100));
    const rise = Math.min(1, age / 0.06);
    const closeFrom = length > 0.9 ? length - 0.14 : length * 0.62;
    const fall = age < closeFrom ? 1 : Math.max(0, 1 - (age - closeFrom) / Math.max(0.05, length - closeFrom));
    const vibrato = length > 0.9 && !reduced ? 0.07 * Math.sin(age * 2 * Math.PI * 5.6) * Math.min(1, age / 0.4) : 0;
    return clamp(peak * rise * fall + vibrato, 0, 1);
  }

  // ------------------------------------------------------------------
  // Moves: named gestures, each a list of keys [delay, duration, fields]
  // from the moment it is cued. `g` turns stage points into arm poses
  // and glances for the figure where it stands then. A side is 'right' or
  // 'left' in the picture.
  // ------------------------------------------------------------------

  const ARMS_DOWN = {
    right: REST.right, rightLift: 0, rightHand: REST.rightHand, rightShape: 'rest',
    left: REST.left, leftLift: 0, leftHand: REST.leftHand, leftShape: 'rest',
  };
  const FACE_REST = { look: 0, down: 0, brow: 0, frown: 0, smile: 0.4, wide: 0, happy: 0, round: 0, tilt: 0, nod: 0, lean: 0, crouch: 0 };
  /**
   * One arm's fields, named for its side: the arm, how far it comes
   * forward, its hand shape, and the wrist's turn, given directly (hand)
   * or as the way the fingers point (dir, SVG degrees in the picture's
   * right arm's frame: 90 hangs, −90 is up, 0 is out to the side).
   */
  /**
   * The same arm pose with its elbow bend (up - fo) within ±180°: poses ease
   * angle by angle, so a bend stored a full turn off (+272° for -88°) would
   * swing the forearm the long way round, across the chest.
   */
  const natural = ([up, fo]) => [up, up - (((up - fo) % 360) + 540) % 360 + 180];
  const armFields = (side, { arm: pose, lift = 0, hand = 0, dir, shape }) => ({
    [side]: natural(pose), [`${side}Lift`]: lift, [`${side}Hand`]: clamp(dir === undefined ? hand : handToward(pose, dir), ...WRIST_RANGE),
    ...(shape ? { [`${side}Shape`]: shape } : {}),
  });
  const restArm = (side) => armFields(side, { arm: REST[side], hand: REST[`${side}Hand`], shape: 'rest' });
  // The fields of keys that return a gesture to rest (see figure()).
  const RESTS = new WeakSet([FACE_REST]);
  /** Keys that end a gesture: its arms, then the face, back at rest. */
  const settle = (at, sides = ['right', 'left']) => {
    const arms = Object.assign({}, ...sides.map(restArm));
    RESTS.add(arms);
    return [[at, 0.65, arms], [at + 0.1, 0.4, FACE_REST]];
  };
  const other = (side) => (side === 'right' ? 'left' : 'right');
  // Fit complete repetitions inside a short sung phrase. A trailing tap
  // must never re-raise an arm after the gesture has started settling.
  const repetitions = (count, hold, fields) => {
    const duration = 0.14;
    const start = 0.25;
    const pairs = Math.min(count, Math.max(0, Math.floor((hold - start) / (2 * duration))));
    return Array.from({ length: pairs * 2 }, (_, i) => [start + i * duration, duration, fields(i)]);
  };

  // Hand-to-body targets in figure units (the picture's right arm's frame;
  // the left arm mirrors them): the chest over the heart, the chin, the
  // brow, the temple, the mouth.
  const CHEST = [86, 112];
  const CHIN = [86, 70];
  const BROW = [83, 44];
  const TEMPLE = [96, 46];
  const LIPS = [84, 64];

  const MOVES = {
    /** Points at a stage point with the near arm. */
    point: ({ to, hold = 1.2, side }, g) => {
      const s = side || g.side(to);
      return [[-0.4, 0.65, { ...armFields(s, { ...g.aim(s, to), shape: 'point' }) }], [-0.05, 0.3, g.glance(to)], ...settle(hold, [s])];
    },
    /** Both arms flung wide, palms up, chest out: the operatic gesture. */
    operatic: ({ hold = 1.6, high = 0 }) => [
      [-0.3, 0.65, {
        ...armFields('right', { arm: outstretched(-28 - 30 * high), shape: 'open', dir: -18 - 30 * high }),
        ...armFields('left', { arm: outstretched(-28 - 30 * high), shape: 'open', dir: -18 - 30 * high }),
        brow: 0.7, tilt: -2, lean: -1,
      }],
      ...settle(hold),
    ],
    /** One arm out towards something, palm up: "this". */
    present: ({ to, hold = 1.4, side }, g) => {
      const s = side || g.side(to);
      return [[-0.35, 0.65, { ...armFields(s, { arm: g.toward(s, to, 14), shape: 'open', dir: g.along(s, to) }), ...g.glance(to), brow: 0.4 }], ...settle(hold, [s])];
    },
    /** A palm raised to the audience: "no need to worry". */
    reassure: ({ hold = 1.4, side = 'right' }) => [
      // Raised beside the shoulder, the whole arm in view: an arm swung
      // toward the viewer hides its upper half behind the forearm.
      [-0.35, 0.65, { ...armFields(side, { arm: reach([134, 70]), shape: 'open', dir: -84 }), brow: 0.5, smile: 0.9, tilt: 2 }],
      ...settle(hold, [side]),
    ],
    /** A hand pressed flat on the chest: "leave it to me". */
    chest: ({ hold = 1.2, side = 'left', pats = 2 }) => {
      const at = reach(CHEST, { shorten: 1 - LIFT * 0.6 });
      const off = reach([CHEST[0] + 4, CHEST[1] + 4], { shorten: 1 - LIFT * 0.6 });
      const pat = repetitions(pats, hold, (i) => armFields(side, { arm: i % 2 ? at : off, lift: 0.6, shape: 'flat', dir: -150 }));
      return [[-0.4, 0.6, { ...armFields(side, { arm: at, lift: 0.6, shape: 'flat', dir: -150 }), smile: 1, brow: 0.5, tilt: -3 }], ...pat, ...settle(hold, [side])];
    },
    /** An index finger raised beside the face: "quite simple!" */
    finger: ({ hold = 1, side = 'right' }) => [
      [-0.35, 0.65, { ...armFields(side, { arm: reach([128, 82]), shape: 'point', dir: -88 }), brow: 0.8, smile: 0.9, tilt: 3 }],
      ...settle(hold, [side]),
    ],
    /** A finger wagged side to side: "no, no". */
    wag: ({ hold = 1.2, side = 'right', times = 3 }) => {
      const pose = reach([128, 82]);
      const wags = repetitions(times, hold, (i) => ({ [`${side}Hand`]: clamp(handToward(pose, -100 + (i % 2 ? -12 : 12)), ...WRIST_RANGE) }));
      return [[-0.4, 0.6, { ...armFields(side, { arm: pose, shape: 'point', dir: -88 }), brow: 0.6, smile: 0.7 }], ...wags, ...settle(hold, [side])];
    },
    /** A finger to the lips: "shh". */
    shh: ({ hold = 1.2, side = 'right' }) => [
      [-0.4, 0.65, { ...armFields(side, { arm: reach([88, 94], { shorten: 1 - LIFT * 0.8 }), lift: 0.8, shape: 'point', dir: -92 }), brow: 0.6, look: side === 'right' ? -0.5 : 0.5 }],
      ...settle(hold, [side]),
    ],
    /** A knowing tap at the temple: "I'm certain I know". */
    temple: ({ hold = 1.2, side = 'right', taps = 2 }) => {
      const at = reach([TEMPLE[0] + 12, TEMPLE[1] + 25], { shorten: 1 - LIFT * 0.5 });
      const off = reach([TEMPLE[0] + 15, TEMPLE[1] + 28], { shorten: 1 - LIFT * 0.5 });
      const taps2 = repetitions(taps, hold, (i) => armFields(side, { arm: i % 2 ? at : off, lift: 0.5, shape: 'point', dir: -112 }));
      return [[-0.4, 0.65, { ...armFields(side, { arm: at, lift: 0.5, shape: 'point', dir: -112 }), brow: 0.8, smile: 1, tilt: 4 }], ...taps2, ...settle(hold, [side])];
    },
    /** A chef's kiss: pinched fingers to the lips, then flung open. */
    kiss: ({ hold = 0.6, side = 'right' }) => [
      // Approach the lips from beside the face, keeping the elbow on the
      // same side of the arm's plane as the release: no sweep via the waist.
      [-0.4, 0.5, { ...armFields(side, { arm: reach([104, 74], { shorten: 1 - LIFT * 0.2 }), lift: 0.2, shape: 'pinch', dir: -165 }), happy: 1, round: 0.8 }],
      [0.25, 0.6, { ...armFields(side, { arm: reach([128, 54], { shorten: 1 - LIFT * 0.2 }), lift: 0.2, shape: 'spread', dir: -60 }), round: 0, smile: 1 }],
      ...settle(0.85 + hold, [side]),
    ],
    /** A deep bow, a hand at the waist and the other swept out. */
    bow: ({ hold = 0.9, side = 'right' }) => [
      [0, 0.4, {
        ...armFields(side, { arm: reach([86, 140], { shorten: 1 - LIFT * 0.5 }), lift: 0.5, shape: 'flat', dir: 172 }),
        ...armFields(other(side), { arm: outstretched(30), shape: 'open', dir: 36 }),
        nod: 1, crouch: 1, lean: 0, happy: 1, smile: 1,
      }],
      ...settle(0.4 + hold),
    ],
    /** A thumbs-up held out. */
    thumbs: ({ hold = 1.2, side = 'right' }) => [
      [-0.35, 0.65, { ...armFields(side, { arm: reach([132, 100]), shape: 'thumb', dir: -90 }), smile: 1, brow: 0.5, tilt: 3 }],
      ...settle(hold, [side]),
    ],
    /** A shrug: hands out palm up at the hips, shoulders and brows up. */
    shrug: ({ hold = 1.1 }) => [
      [-0.35, 0.6, {
        // Elbows at the sides, forearms out, palms up.
        ...armFields('right', { arm: [raise(UPPER_REST, 78), raise(FOREARM_REST, -6)], shape: 'open', dir: -24 }),
        ...armFields('left', { arm: [raise(UPPER_REST, 78), raise(FOREARM_REST, -6)], shape: 'open', dir: -24 }),
        brow: 1, smile: 0.2, tilt: 4, nod: -0.4,
      }],
      ...settle(hold),
    ],
    /** A crisp salute. */
    salute: ({ hold = 1, side = 'right' }) => [
      // The fingertips at the outer end of the brow, not over the eye.
      [-0.4, 0.55, { ...armFields(side, { arm: reach([BROW[0] + 40, BROW[1] + 12]), shape: 'flat', dir: -166 }), brow: 0.3, smile: 0.8 }],
      ...settle(hold, [side]),
    ],
    /** Both hands up, palms out: "I surrender". */
    surrender: ({ hold = 2 }) => [
      [-0.25, 0.6, {
        ...armFields('right', { arm: reach([124, 62]), shape: 'open', dir: -84 }),
        ...armFields('left', { arm: reach([124, 62]), shape: 'open', dir: -84 }),
        wide: 1, brow: 1, smile: -0.2, sweat: 1, lean: 1.4,
      }],
      ...settle(hold),
    ],
    /** A palm thrust at the viewer: "stop". */
    stop: ({ hold = 1.6, side = 'right' }) => [
      // Thrust out to the side at shoulder height, palm up and out.
      [-0.4, 0.55, { ...armFields(side, { arm: reach([142, 84]), shape: 'open', dir: -88 }), frown: 1, brow: 0, smile: -0.4 }],
      ...settle(hold, [side]),
    ],
    /** A hand flat over the eyes. */
    facepalm: ({ hold = 1.4, side = 'right' }) => [
      [-0.2, 0.65, { ...armFields(side, { arm: reach(BROW, { shorten: 1 - LIFT }), lift: 1, shape: 'flat', dir: -158 }), nod: 0.6, smile: -0.6, frown: 0.6 }],
      ...settle(hold, [side]),
    ],
    /** Hands up beside the head, fingers spread: despair. */
    despair: ({ hold = 1.4 }) => [
      [-0.4, 0.6, {
        ...armFields('right', { arm: reach([118, 50]), shape: 'spread', dir: -96 }),
        ...armFields('left', { arm: reach([118, 50]), shape: 'spread', dir: -96 }),
        wide: 1, brow: 1, smile: -0.8, round: 0.6,
      }],
      ...settle(hold),
    ],
    /** Both hands thrown up: "everywhere!" */
    throwUp: ({ hold = 1.2 }) => [
      [-0.15, 0.6, {
        ...armFields('right', { arm: outstretched(-62), shape: 'spread', dir: -62 }),
        ...armFields('left', { arm: outstretched(-62), shape: 'spread', dir: -62 }),
        wide: 1, brow: 1, frown: 0.4,
      }],
      ...settle(hold),
    ],
    /** Hands on the hips, impatient. */
    hips: ({ hold = 1.6 }) => [
      [-0.3, 0.6, {
        ...armFields('right', { arm: reach([106, 146]), shape: 'grip', dir: 150 }),
        ...armFields('left', { arm: reach([106, 146]), shape: 'grip', dir: 150 }),
        frown: 0.8, smile: -0.4, tilt: -3,
      }],
      ...settle(hold),
    ],
    /** Both arms pushing out in front: a shove. */
    shove: ({ hold = 0.9, to }, g) => {
      // A hard push out to the side of `to`: the near arm straight out, palm
      // first; the other fist braced at the chest.
      const near = to ? g.side(to) : 'right';
      return [[-0.4, 0.5, {
        ...armFields(near, { arm: outstretched(-4, 10), shape: 'open', dir: -84 }),
        ...armFields(other(near), { arm: reach([CHEST[0] + 22, CHEST[1] + 14]), shape: 'fist', dir: 150 }),
        lean: near === 'left' ? -4 : 4, frown: 0.6, smile: 0.6,
      }],
      ...settle(hold)];
    },
    /** A hand cupped behind an ear. */
    listen: ({ hold = 1.2, side = 'right' }) => [
      [-0.4, 0.6, { ...armFields(side, { arm: reach([104, 50]), shape: 'open', dir: -100 }), brow: 1, tilt: 6, look: side === 'right' ? 1 : -1 }],
      ...settle(hold, [side]),
    ],
    /** A hand over a yawn. */
    yawn: ({ hold = 1.4, side = 'right' }) => [
      // The palm up at the mouth, the elbow down: the eyes stay clear.
      [-0.4, 0.6, { ...armFields(side, { arm: reach([88, 94], { shorten: 1 - LIFT * 0.8 }), lift: 0.8, shape: 'flat', dir: -96 }), happy: 1, round: 1, tilt: -4 }],
      ...settle(hold, [side]),
    ],
    /** Knees give and the head drops: exhausted. */
    slump: ({ hold = 1.6 }) => [[0, 0.6, { crouch: 0.7, nod: 1, smile: -0.6, brow: -0.2, lean: 2, happy: 0.6 }], [hold, 0.6, FACE_REST]],
    /** A quick hop on the spot. */
    hop: ({ height = 14 }) => [[0, 0.16, { crouch: 0.6 }], [0.16, 0.18, { crouch: 0, hop: height }], [0.34, 0.2, { hop: 0 }], [0.54, 0.16, { crouch: 0.4 }], [0.7, 0.2, { crouch: 0 }]],
    /** A face, held: mood keys, no arms. */
    mood: ({ hold = 1.2, ...face }) => [[-0.1, 0.3, face], [hold, 0.45, FACE_REST]],
    /** Arms only: any arm pose, by side. */
    arms: ({ right, left, hold = 1.2 }, g) => {
      const fields = {};
      for (const [side, spec] of [['right', right], ['left', left]]) {
        if (!spec) continue;
        const aimed = spec.to ? g.aim(side, spec.to) : null;
        const arm = aimed ? aimed.arm : spec.arm || (spec.reach ? reach(spec.reach, { shorten: 1 - LIFT * (spec.lift || 0) }) : REST[side]);
        Object.assign(fields, armFields(side, { arm, lift: spec.lift || 0, hand: spec.hand ?? aimed?.hand ?? 0, dir: spec.dir, shape: spec.shape }));
      }
      return [[-0.4, 0.6, fields], ...(hold === Infinity ? [] : settle(hold, Object.keys(fields).filter((k) => k === 'right' || k === 'left')))];
    },
  };

  // ------------------------------------------------------------------
  // Sleeping: a mask over the eyes, and a bed the figure lies down in
  // ------------------------------------------------------------------

  /** A padded sleep mask across both eyes, its strap round the head, two stitched lashes. */
  function drawSleepMask(g) {
    svg('path', { class: 'oc-sleep-mask-strap', d: `M${HEAD.x - 36} ${EYES - 6} C${HEAD.x - 20} ${EYES - 10} ${HEAD.x + 20} ${EYES - 10} ${HEAD.x + 36} ${EYES - 6}` }, g);
    inked(g, `M${HEAD.x} ${EYES - 9} C${HEAD.x + 10} ${EYES - 15} ${HEAD.x + 30} ${EYES - 14} ${HEAD.x + 32} ${EYES - 3}
      C${HEAD.x + 33} ${EYES + 7} ${HEAD.x + 22} ${EYES + 11} ${HEAD.x + 11} ${EYES + 7} C${HEAD.x + 6} ${EYES + 5} ${HEAD.x + 3} ${EYES + 4} ${HEAD.x} ${EYES + 6}
      C${HEAD.x - 3} ${EYES + 4} ${HEAD.x - 6} ${EYES + 5} ${HEAD.x - 11} ${EYES + 7} C${HEAD.x - 22} ${EYES + 11} ${HEAD.x - 33} ${EYES + 7} ${HEAD.x - 32} ${EYES - 3}
      C${HEAD.x - 30} ${EYES - 14} ${HEAD.x - 10} ${EYES - 15} ${HEAD.x} ${EYES - 9} Z`, 'oc-sleep-mask-pad', 'oc-ink oc-ink--cool');
    svg('path', { class: 'oc-sleep-mask-sheen', d: `M${HEAD.x - 26} ${EYES - 7} C${HEAD.x - 18} ${EYES - 11} ${HEAD.x - 8} ${EYES - 11} ${HEAD.x - 3} ${EYES - 8}` }, g);
    for (const side of [-1, 1]) {
      const x = HEAD.x + side * 17;
      svg('path', { class: 'oc-sleep-mask-lash', d: `M${x - 8} ${EYES} C${x - 4} ${EYES + 4} ${x + 4} ${EYES + 4} ${x + 8} ${EYES} M${x - 6} ${EYES + 2.6} l-2 3 M${x} ${EYES + 3.4} v3.4 M${x + 6} ${EYES + 2.6} l2 3` }, g);
    }
    return g;
  }

  // The bed in figure units: lying down turns the figure a quarter turn
  // about LIE_PIVOT, head to the left on the pillow, feet to the right.
  const LIE_PIVOT = [80, 200];
  // How far it then sinks, so the head rests in the pillow.
  const LIE_SINK = 14;

  /** The headboard, footboard, mattress, and pillow, drawn behind the figure. */
  function drawBedBack(g) {
    svg('ellipse', { class: 'oc-bed-shadow', cx: 36, cy: 293, rx: 188, ry: 6 }, g);
    for (const x of [-138, -124, 194, 208]) inked(g, `M${x} 262 h6 V292 h-6 Z`, 'oc-bed-leg', 'oc-ink oc-ink--cool');
    inked(g, 'M-146 292 V150 C-146 132 -118 132 -118 150 V292 Z', 'oc-bed-board', 'oc-ink oc-ink--cool');
    svg('path', { class: 'oc-bed-board-shine', d: 'M-139 286 V152 C-139 144 -133 142 -129 146' }, g);
    inked(g, 'M190 292 V206 C190 192 214 192 214 206 V292 Z', 'oc-bed-board', 'oc-ink oc-ink--cool');
    inked(g, 'M-122 260 H192 V276 H-122 Z', 'oc-bed-rail', 'oc-ink oc-ink--cool');
    inked(g, 'M-120 236 C-120 230 -116 228 -110 228 H186 C190 228 192 230 192 236 V262 H-120 Z', 'oc-bed-mattress', 'oc-ink oc-ink--cool');
    svg('path', { class: 'oc-bed-seam', d: 'M-116 246 H188' }, g);
    inked(g, 'M-118 214 C-120 196 -104 186 -76 186 C-48 186 -24 190 -20 204 C-16 220 -24 234 -54 236 C-86 238 -116 234 -118 214 Z', 'oc-bed-pillow', 'oc-ink oc-ink--cool');
    svg('path', { class: 'oc-bed-pillow-crease', d: 'M-104 200 C-92 196 -80 196 -70 199 M-40 222 C-34 218 -30 212 -30 206' }, g);
    return g;
  }

  /** The quilt pulled up to the chin, drawn over the figure, and a drift of Zs. */
  function drawBedFront(g) {
    inked(g, 'M-14 166 C20 150 120 150 186 170 C194 196 194 236 190 264 C120 270 30 270 -22 264 C-30 236 -28 190 -14 166 Z', 'oc-bed-quilt', 'oc-ink oc-ink--cool');
    svg('path', { class: 'oc-bed-quilt-check', d: 'M-24 206 C40 200 130 200 192 210 M-22 240 C40 236 130 236 192 242 M40 158 C36 200 36 236 38 268 M110 156 C108 200 108 236 110 268' }, g);
    inked(g, 'M-20 166 C20 150 120 150 186 170 C186 178 186 182 184 186 C120 168 20 168 -18 184 C-22 178 -22 172 -20 166 Z', 'oc-bed-quilt-fold', 'oc-ink oc-ink--cool');
    const zs = [0, 1, 2].map((i) => {
      const z = svg('text', { class: 'oc-z', x: -70 + i * 14, y: 150 - i * 18 }, g);
      z.textContent = 'Z';
      return z;
    });
    return zs;
  }

  // ------------------------------------------------------------------
  // A figure on stage
  // ------------------------------------------------------------------

  /**
   * A cast member for the whole song:
   *   role      'tenor', 'pm', 'build', 'test', 'ui', 'backend', 'security', 'hero'
   *   gender    'woman' or 'man' (the default), the gender of the voice
   *             that sings the role: the drawn face a woman wears is
   *             WOMAN_HEAD; anyone else wears the costume's
   *   hero      a promise of SongStudentAvatar's heroHead or castHead; it
   *             resolves to null on export stages, and the drawn face stays
   *   stage     [[from, to, { enter, exit }]]: when it is on stage;
   *             'left' / 'right' glide in from (or out to) that wing,
   *             'fade' (the default) fades
   *   places    [[time, x, y, scale, duration]]: where its feet stand
   *             (x is its centre); it walks there over `duration` seconds
   *             or (time, reducedMotion) => { x, y, scale, walking } for a
   *             performer following a moving surface; walking is 0–1
   *   moves     [[time, name, options]] from MOVES
   *   gestureSpeed  transition speed (default 1); preserves anticipated cue landings
   *   holds     [[time, side, prop]]: a prop in a hand from then on (null
   *             empties it)
   *   words     [start, end] sung word intervals (wordsFor)
   *   singInReducedMotion  false holds a neutral mouth with reduced motion;
   *                        true preserves the cast's word-by-word poses
   *   beds      [[from, to]]: a bed appears behind it just before `from`;
   *             it lies down in it, mask on, under the quilt, until `to`
   *             (or its stage exit, when the bed glides off with it)
   * Returns the wrapper and where() (its place at a time).
   */
  function figure(parent, { role, gender = 'man', hero, stage = [], places, moves = [], gestureSpeed = 1, holds = [], words = [], singInReducedMotion = true, beds = [], seed = 0 }) {
    const wrap = el('div', `oc-figure oc-figure--${role} is-staged`, parent);
    wrap.dataset.testid = `oc-${role}`;
    const fig = svg('svg', { class: 'oc-art', viewBox: '0 0 160 300', width: 160, height: 300, 'aria-hidden': 'true' }, wrap);
    const travel = svg('g', {}, fig);
    const bedBack = beds.length ? drawBedBack(svg('g', { class: 'oc-bed', 'data-testid': 'oc-bed' }, travel)) : null;
    const shadow = svg('g', { class: 'oc-shadow' }, travel);
    svg('ellipse', { cx: 84, cy: 293, rx: 40, ry: 5 }, shadow);
    const hopper = svg('g', {}, travel);
    const recline = svg('g', {}, hopper);
    const sway = svg('g', {}, recline);
    const body = buildFigure(fig, sway, role, gender);
    const bedFront = beds.length ? svg('g', { class: 'oc-bed oc-bed--front' }, travel) : null;
    const zs = bedFront ? drawBedFront(bedFront) : [];

    // In bed: the bed shows from just before `from`; it lies down over
    // LIE_DOWN seconds, then the quilt and the mask come on and the Zs drift.
    // A bed with no `to` stays until the figure's stage exit, and goes with it.
    const LIE_DOWN = 0.7;
    const exitAfter = (at) => stage.map(([, to]) => to).filter((to) => to !== undefined && to > at).sort((a, b) => a - b)[0] ?? Infinity;
    const bedWindows = beds.map(([from, to]) => (to === undefined ? { from, to: exitAfter(from), leaves: true } : { from, to, leaves: false }));
    function inBed(t) {
      const bed = bedWindows.find(({ from, to, leaves }) => t >= from - 0.6 && t <= to + (leaves ? 0 : 0.6));
      if (!bed) return { shown: 0, lie: 0, tucked: 0, from: 0 };
      const { from, leaves } = bed;
      const up = leaves ? Infinity : bed.to;
      return {
        shown: progress(t, from - 0.6, 0.4) * (1 - progress(t, up, 0.6)),
        lie: easeInOutCubic(progress(t, from, LIE_DOWN)) * (1 - easeInOutCubic(progress(t, up, LIE_DOWN))),
        tucked: progress(t, from + LIE_DOWN * 0.7, 0.4) * (1 - progress(t, up - 0.4, 0.3)),
        from,
      };
    }

    // Where it stands at time t: the last place reached, or on its way to
    // the next, eased, with how fast it is walking (for its step).
    const sortedPlaces = typeof places === 'function' ? null : [...places].sort((a, b) => a[0] - b[0]);
    function where(t) {
      if (typeof places === 'function') return places(t, reducedMotion.matches);
      let [, x, y, scale = 1] = sortedPlaces[0];
      let walking = 0;
      for (let i = 1; i < sortedPlaces.length; i++) {
        const [at, nx, ny, ns = scale, duration = 0.8] = sortedPlaces[i];
        if (t < at) break;
        const u = progress(t, at, duration);
        const e = easeInOutCubic(u);
        if (u < 1) walking = Math.min(1, Math.hypot(nx - x, ny - y) / 40) * Math.sin(Math.PI * u);
        x += (nx - x) * e;
        y += (ny - y) * e;
        scale += (ns - scale) * e;
      }
      return { x, y, scale, walking };
    }

    const holdKeys = [...holds].sort((a, b) => a[0] - b[0]);
    const carries = holdKeys.flatMap(([from, side, prop], i) => {
      const carry = HOLDING[prop]?.carry;
      if (!carry) return [];
      const until = holdKeys.slice(i + 1).find(([, nextSide]) => nextSide === side)?.[0] ?? Infinity;
      return [{ from, until, side, prop, carry }];
    });
    const occupied = (side, t) => carries.some((c) => c.side === side && t >= c.from - 0.35 && t < c.until);

    // Moves are aimed from wherever the figure stands when they are cued.
    const geometry = (t) => {
      const { x, y, scale } = where(t);
      const left = x - 80 * scale, top = y - 293 * scale;
      const toFigure = ([sx, sy], side) => {
        const fx = (sx - left) / scale;
        return [side === 'left' ? 160 - fx : fx, (sy - top) / scale];
      };
      return {
        glance: (to) => ({
          look: clamp((to[0] - (left + HEAD.x * scale)) / (150 * scale), -1, 1),
          down: clamp((to[1] - (top + EYES * scale)) / (160 * scale), -0.8, 1),
        }),
        side: (to) => {
          const near = to[0] < left + 80 * scale ? 'left' : 'right';
          return occupied(near, t) && !occupied(other(near), t) ? other(near) : near;
        },
        // Points the arm on `side` at a stage point: within reach the
        // fingertip touches it, further off the whole arm points.
        aim: (side, to) => {
          const [fx, fy] = toFigure(to, side);
          const distance = Math.hypot(fx - SHOULDER[0], fy - SHOULDER[1]);
          const along = degrees(Math.atan2(fy - SHOULDER[1], fx - SHOULDER[0]));
          if (fx < 80) {
            const arm = reach([76, 126]);
            return { arm, hand: handToward(arm, along) };
          }
          if (distance < UPPER + FORE + 18) {
            const arm = reach([fx, fy], { end: [WRIST[0] + 1, WRIST[1] + 22] });
            return { arm, hand: handToward(arm, along) };
          }
          const arm = outstretched(along, 6);
          return { arm, hand: handToward(arm, along) };
        },
        along: (side, to) => {
          const [fx, fy] = toFigure(to, side);
          return degrees(Math.atan2(fy - SHOULDER[1], fx - SHOULDER[0]));
        },
        toward: (side, to, bend) => {
          const [fx, fy] = toFigure(to, side);
          if (fx < 80) return reach([78, 130]);
          return outstretched(degrees(Math.atan2(fy - SHOULDER[1], fx - SHOULDER[0])), bend);
        },
      };
    };
    const gestures = moves
      .map(([time, name, options = {}]) => {
        if (!MOVES[name]) throw new Error(`opera-cast.js has no move "${name}".`);
        const raw = MOVES[name](options, geometry(time));
        const moved = ['left', 'right'].filter((side) => raw.some(([, , fields]) => fields[side] && !RESTS.has(fields)));
        const swap = moved.length === 1 && occupied(moved[0], time) && !occupied(other(moved[0]), time) ? moved[0] : null;
        const own = raw.map(([delay, duration, fields]) => {
          const span = Math.max(Math.min(duration, 0.12), duration / gestureSpeed);
          if (swap) {
            const renamed = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key.startsWith(swap) ? other(swap) + key.slice(swap.length) : key, value]));
            if (RESTS.has(fields)) RESTS.add(renamed);
            fields = renamed;
          }
          // Quicker anticipation still arrives on the same sung word.
          return [time + delay + (delay < 0 ? duration - span : 0), span, fields];
        });
        return { time, start: Math.min(...own.map(([at]) => at)), keys: own };
      })
      .sort((a, b) => a.time - b.time);
    // A gesture's return to rest puts back only what that gesture moved,
    // and gives way to a later gesture that has already taken the same
    // part: a long hold never snaps an arm or a face out of the next pose.
    const posed = gestures.map(({ keys: own }) => new Set(own.filter(([, , fields]) => !RESTS.has(fields)).flatMap(([, , fields]) => Object.keys(fields))));
    const gestureKeys = gestures
      .flatMap(({ keys: own }, i) => own.flatMap(([at, duration, fields]) => {
        if (!RESTS.has(fields)) return [[at, duration, fields]];
        const kept = Object.entries(fields).filter(([name]) => posed[i].has(name)
          && !gestures.some((next, j) => j > i && next.start <= at && posed[j].has(name)));
        return kept.length ? [[at, duration, Object.fromEntries(kept)]] : [];
      }))
      .sort((a, b) => a[0] - b[0]);
    const keys = [
      ...gestureKeys.map(([at, duration, fields]) => [at, duration, Object.fromEntries(Object.entries(fields)
        .filter(([name]) => !['left', 'right'].some((side) => name.startsWith(side) && occupied(side, at))))]),
      ...carries.flatMap(({ from, until, side, prop, carry }) => {
        const pose = armFields(side, { arm: reach(carry.reach), dir: carry.dir, shape: HOLDING[prop].shape });
        return [[from - 0.35, 0.35, pose], ...(Number.isFinite(until) ? [[until, 0.4, restArm(side)]] : [])];
      }),
    ].sort((a, b) => a[0] - b[0]);
    const sortedWords = [...words].sort((a, b) => a[0] - b[0]);

    // On stage: each window fades the wrapper in and out (so the scene
    // culls it while it is off), and an entrance or exit glides it from or
    // to a wing.
    const windows = [...stage].sort((a, b) => a[0] - b[0]);
    for (const [from, to, { enter = 'fade', exit = 'fade' } = {}] of windows) {
      fx.fadeIn(wrap, from, enter === 'fade' ? 0.3 : 0.18);
      if (to !== undefined) fx.fadeOut(wrap, to - (exit === 'fade' ? 0.3 : 0.18), exit === 'fade' ? 0.3 : 0.18);
    }
    const windowAt = (t) => windows.findIndex(([from, to]) => t >= from - 0.05 && (to === undefined || t <= to + 0.05));

    // A teammate wears the viewer's hero head (or a new random one for each
    // appearance); being culled takes it off stage, so a return is new.
    let disposed = false;
    let dress = null;
    onDispose(() => { disposed = true; });
    hero?.then((heads) => {
      if (!heads || disposed) return;
      dress = heads.dresser(body.wear, 0, Math.max(1, windows.length));
    }).catch(() => {
      // The saved face is optional; the drawn face remains.
    });

    const GLIDE = 1.1;
    onFrame((t) => {
      const reduced = reducedMotion.matches;
      const index = windowAt(t);
      const onStage = index >= 0 && wrap.isConnected;
      dress?.(onStage ? index + 1 : 0);
      if (index < 0) return;
      const [from, to, { enter = 'fade', exit = 'fade' } = {}] = windows[index];
      const { x, y, scale, walking } = where(t);
      wrap.style.left = `${(x - 80 * scale).toFixed(2)}px`;
      wrap.style.top = `${(y - 293 * scale).toFixed(2)}px`;
      wrap.style.width = `${(160 * scale).toFixed(2)}px`;
      fig.setAttribute('width', (160 * scale).toFixed(2));
      fig.setAttribute('height', (300 * scale).toFixed(2));

      const p = poseAt(keys, t, reduced);
      const bed = inBed(t);
      if (bedBack) {
        bedBack.setAttribute('opacity', bed.shown.toFixed(3));
        bedFront.setAttribute('opacity', bed.tucked.toFixed(3));
        bedFront.setAttribute('transform', `translate(0 ${(24 * (1 - bed.tucked)).toFixed(2)})`);
        zs.forEach((z, i) => {
          const age = t - bed.from - 1 - i * 0.45;
          const loop = ((age % 1.8) + 1.8) % 1.8;
          z.setAttribute('opacity', age > 0 && !reduced ? Math.max(0, 1 - loop / 1.8).toFixed(3) : '0');
          z.setAttribute('transform', `translate(${(loop * 8).toFixed(1)} ${(-loop * 16).toFixed(1)})`);
        });
        p.mask = Math.max(p.mask, bed.tucked);
      }
      for (const side of ['right', 'left']) {
        let prop = null;
        for (const [at, which, name] of holdKeys) if (which === side && at <= t) prop = name;
        body.hold(side, prop);
      }
      // A glide in from a wing leans into the move, sways past upright, and
      // settles with a give at the knees; an exit leans away and goes.
      let glide = 0, lean = 0, settleKnees = 0, step = walking;
      if (!reduced && enter !== 'fade' && t - from < GLIDE + 0.5) {
        const side = enter === 'left' ? -1 : 1;
        const u = progress(t, from, GLIDE);
        glide = side * 260 * (1 - u) ** 2.4;
        lean = -side * 7 * Math.exp(-3.5 * u) * Math.cos(2.6 * Math.PI * u);
        settleKnees = 0.7 * Math.sin(Math.PI * progress(t, from + GLIDE * 0.7, 0.4));
        step = Math.max(step, 1 - u);
      }
      if (!reduced && to !== undefined && exit !== 'fade' && t > to - GLIDE) {
        const side = exit === 'left' ? -1 : 1;
        const u = progress(t, to - GLIDE, GLIDE);
        // A bed reaches far past the figure, so it glides out further.
        glide = side * (bed.shown ? 480 : 260) * u ** 2.2;
        lean = side * 5 * Math.sin(Math.PI * Math.min(1, u * 1.4));
        step = Math.max(step, u);
      }
      // Lying down, the figure stays still in the bed as it glides.
      if (bed.lie) {
        lean *= 1 - bed.lie;
        step *= 1 - bed.lie;
      }
      // A stroll: the hips bob twice a stride and the legs swing.
      const stride = reduced ? 0 : step;
      const phase = t * 2 * Math.PI * 1.7;
      const bob = -2.2 * stride * Math.abs(Math.sin(phase));
      // At ease the figure stands still: it leans only into a move or a glide.
      const shift = p.lean + lean;
      travel.setAttribute('transform', `translate(${(glide / scale).toFixed(2)} ${bob.toFixed(2)})`);
      hopper.setAttribute('transform', `translate(0 ${(-p.hop).toFixed(2)})`);
      sway.setAttribute('transform', `rotate(${shift.toFixed(2)} 80 290)`);
      shadow.setAttribute('transform', `translate(80 293) scale(${(1 - p.hop / 60).toFixed(3)}) translate(-80 -293)`);
      shadow.setAttribute('opacity', (1 - bed.lie).toFixed(3));
      recline.setAttribute('transform', bed.lie ? `translate(0 ${(LIE_SINK * bed.lie).toFixed(2)}) rotate(${(-90 * bed.lie).toFixed(2)} ${LIE_PIVOT[0]} ${LIE_PIVOT[1]})` : '');
      body.swing(stride * Math.sin(phase) * 9);
      p.crouch = Math.max(p.crouch, settleKnees);
      const open = reduced && !singInReducedMotion ? 0 : mouthAt(sortedWords, t, reduced);
      body.pose(p, t, open, reduced ? 0 : blinkAt(t, seed));
      body.level();
    });
    /** A supplied hand-surface contact in stage coordinates, including walking and sway. */
    function handPoint(side, at) {
      const matrix = fig.getCTM().inverse().multiply(body.arms[side].hand.getCTM());
      const point = new DOMPoint(...at).matrixTransform(matrix);
      const scale = parseFloat(fig.getAttribute('width')) / 160;
      return [parseFloat(wrap.style.left) + point.x * scale, parseFloat(wrap.style.top) + point.y * scale];
    }
    return { node: wrap, where, handPoint };
  }

  window.OperaCast = {
    HANDS, HEAD, SHOULDER, ELBOW, WRIST, MIRROR, REST, TEAMMATE_HEAD, TOP, NECK, NECK_SHADE, LEGS, LEG_DETAIL, FEET,
    SLEEVE, SLEEVE_FOLDS, FORE_SLEEVE, FORE_SLEEVE_FOLDS, CUFF, FOREARM, FOREARM_DETAIL, TENOR_HEAD,
    reach, outstretched, handToward, poseAt, drawHandParts, rotate, raise, aroundZero, degrees, mouthShape,
    buildFigure, blinkAt, COSTUMES, PROPS, HOLDING, MOVES, figure, wordsFor, mouthAt,
  };
})();
