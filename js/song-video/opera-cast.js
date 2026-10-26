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
 *   Export stages never load the hero renderer, so there each keeps a
 *   drawn face.
 *
 * Every figure lives for the whole song: `stage` lists when it is on stage,
 * `places` where it stands (it walks there), `moves` what it does on which
 * sung word (MOVES), and `sings` the word intervals its mouth follows
 * (lipSync). Arms are two-bone limbs that reach for stage points; each hand
 * is built from its joints (figure-geometry.js), about three quarters as
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
  const { clamp, handPart, finger } = window.SongFigure;
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
    const distance = Math.hypot(dx, dy) || 1;
    const d = clamp(distance, Math.abs(upper - fore) + 0.5, upper + fore - 0.5);
    const toward = Math.atan2(dy, dx);
    const bend = Math.acos(clamp((upper ** 2 + d ** 2 - fore ** 2) / (2 * upper * d), -1, 1));
    const elbows = [toward + bend, toward - bend].map((angle) => ({ angle, ex: SHOULDER[0] + upper * Math.cos(angle), ey: SHOULDER[1] + upper * Math.sin(angle) }));
    // An elbow inside the torso (left of the shoulder) counts against it.
    const score = (e) => e.ey - 3 * Math.max(0, SHOULDER[0] - e.ex);
    elbows.sort((a, b) => score(b) - score(a));
    const { angle, ex, ey } = elbows[0];
    const k = Math.min(1, d / distance);
    const foreDir = Math.atan2(SHOULDER[1] + dy * k - ey, SHOULDER[0] + dx * k - ex);
    return [raise(UPPER_REST, degrees(angle)), raise(foreRest, degrees(foreDir))];
  }

  /** The arm held out straight along `along` (SVG degrees), the elbow `bend` degrees soft. */
  const outstretched = (along, bend = 8) => [raise(UPPER_REST, along + bend), raise(FOREARM_REST, along - bend / 3)];
  /** The hand's turn at the wrist that points its fingers along `dir`, on an arm posed at [upper, forearm]. */
  const handToward = ([, fore], dir) => aroundZero(dir - 90 + fore);

  // ------------------------------------------------------------------
  // Hands, each in its own frame: the wrist at (0, 0) and the fingers down
  // (+y), for the picture's right arm (the left arm's mirrors it). About 26
  // long from the wrist to the middle finger's tip, three quarters of the
  // forearm, with the knuckles half way. Views:
  //   thumb side (rest, point, fist, thumb, pinch): the back of the hand
  //     towards +x, the palm towards −x, the thumb in front;
  //   palm (open, spread): the palm to the viewer, the thumb towards +x
  //     (outwards while the arm hangs, inwards once it is raised);
  //   back (flat, grip): the back of the hand to the viewer, the thumb
  //     towards −x, the nails showing.
  // Each shape: parts behind what it holds, parts in front, and where a
  // held thing goes (`hold`: point, angle of its long axis).
  // ------------------------------------------------------------------

  const fingerDetail = (knuckles, creases, nail) => [
    ...(knuckles ? [['oc-knuckle', knuckles]] : []),
    ...(creases ? [['oc-crease', creases]] : []),
    ...(nail ? [['oc-nail', nail]] : []),
  ];

  // The palm of a hand seen from its thumb side, from the wrist to the
  // knuckles, full on the palm side where the thumb's mount is.
  const SIDE_PALM = handPart(
    'M-3.8 -0.6 H3.8 C4.1 1.6 3.9 3.6 3.8 5.4 C3.7 7.6 4 9.6 4.4 11.6 C4.6 12.8 4.4 14 3.6 14.8 C2.4 15.8 0.6 16 -1 15.6 C-2.6 15.2 -3.8 14.2 -4.6 12.8 C-5.4 11 -5.6 7.6 -5.2 4.8 C-4.8 2.6 -4.2 1 -3.8 -0.6 Z',
    'M3.8 -0.6 C4.1 1.6 3.9 3.6 3.8 5.4 C3.7 7.6 4 9.6 4.4 11.6 M-5.2 4.8 C-4.8 2.6 -4.2 1 -3.8 -0.6',
    [
      ['oc-hand-shade', 'M3.8 -0.6 C4.1 1.6 3.9 3.6 3.8 5.4 C3.7 7.6 4 9.6 4.4 11.6 C3.6 11.4 3 10.4 2.9 8.8 C2.7 6.6 2.8 4.2 3 2.2 C3.1 1.2 3.2 0.3 3.3 -0.6 Z'],
      ['oc-tendon', 'M2.4 1.6 C2.2 4.6 2.4 7.6 2.9 10.2'],
    ],
  );
  // A nail on a finger seen from the side, along its back near the tip.
  const sideNail = ([x, y], angle) => `M${x} ${y} m-0.5 -1 c0.5 -0.2 1 0 1.1 0.6 c0.1 0.7 -0.1 1.3 -0.6 1.5 c-0.5 0 -0.8 -0.6 -0.8 -1.2 c0 -0.4 0.1 -0.7 0.3 -0.9 z`;
  const sideFinger = (joints, widths, nail) => finger(joints, widths, 1, nail ? [['oc-nail', nail]] : []);
  const INDEX_W = [1.45, 1.45, 1.32, 1.18, 1.05];
  const MIDDLE_W = [1.38, 1.38, 1.26, 1.12, 1.02];
  const THUMB_W = [2.1, 1.8, 1.55, 1.38];
  const thumbNail = (x, y) => `M${x - 0.6} ${y - 0.9} C${x - 0.1} ${y - 1.2} ${x + 0.6} ${y - 0.8} ${x + 0.6} ${y} C${x + 0.6} ${y + 0.8} ${x + 0.1} ${y + 1.2} ${x - 0.4} ${y + 1} C${x - 0.8} ${y + 0.6} ${x - 0.9} ${y - 0.4} ${x - 0.6} ${y - 0.9} Z`;
  const sideThumb = (joints, nailAt, knuckle) => finger(joints, THUMB_W, -1, [
    ['oc-knuckle', knuckle],
    ['oc-nail', thumbNail(...nailAt)],
  ], [1, 3]);

  const HANDS = {
    // Hanging easy, the back of the hand a little towards the viewer: the
    // fingers together and a little curled, the thumb along the index
    // finger.
    rest: {
      behind: [],
      front: [
        handPart(
          'M-4.4 -0.6 H4.4 C4.7 1 5 2.6 5.2 4.6 C5.6 7.4 5.6 10.6 5.2 12.8 L-5.4 12.8 C-6.2 11.6 -6.6 9.6 -6.4 7.6 C-6 4.8 -5.2 2.2 -4.4 -0.6 Z',
          'M-4.4 -0.6 C-5.2 2.2 -6 4.8 -6.4 7.6 M5.2 4.6 C5 2.6 4.7 1 4.4 -0.6 M5.2 4.6 C5.6 7.4 5.6 10.6 5.2 12.8',
          [
            ['oc-hand-shade', 'M3.4 -0.6 H4.4 C4.7 1 5 2.6 5.2 4.6 C5.6 7.4 5.6 10.6 5.2 12.8 L3.6 12.8 C3.9 10 3.9 6.4 3.6 3.4 Z'],
            ['oc-tendon', 'M-2.4 1.8 C-2.8 4.8 -3.2 8 -3.6 10.6 M-0.7 2 C-0.9 5 -1.1 8.2 -1.2 10.8 M1 2 C1.2 5 1.3 8.2 1.4 10.8 M2.6 1.8 C3 4.8 3.3 8 3.6 10.6'],
            ['oc-knuckle', 'M-4.4 11.6 C-3.6 10.8 -2.6 10.8 -2 11.6 M-1.7 11.8 C-0.9 11 0.2 11 0.8 11.8 M1 11.8 C1.8 11 2.8 11 3.4 11.8 M3.5 11.6 C4.1 10.9 4.8 11 5.1 11.6'],
          ],
        ),
        finger([[3.8, 10.4], [3.9, 12.4], [3.9, 16.4], [3.5, 18.8], [2.9, 20.6]], [1.15, 1.15, 1.05, 0.95, 0.88], -1, [['oc-crease', 'M3 16.4 H4.8']]),
        finger([[1.4, 10.6], [1.4, 12.8], [1.3, 17.4], [0.8, 20.2], [0.1, 22.4]], [1.3, 1.3, 1.18, 1.06, 0.98], -1, [['oc-crease', 'M0.3 17.4 H2.4']]),
        finger([[-1.2, 10.6], [-1.2, 12.8], [-1.4, 18], [-2, 21], [-2.8, 23.2]], [1.35, 1.35, 1.22, 1.1, 1], -1, [['oc-crease', 'M-2.5 18 H-0.3']]),
        finger([[-3.8, 10.4], [-3.8, 12.6], [-4.2, 17.2], [-4.8, 19.8], [-5.6, 21.8]], [1.3, 1.3, 1.18, 1.06, 0.98], -1, [['oc-crease', 'M-5.3 17.2 H-3.1']]),
        finger([[-3.4, 2.6], [-5.6, 7.2], [-6.6, 11.2], [-6.6, 14.8]], [2, 1.7, 1.45, 1.3], 1, [['oc-nail', 'M-7.2 12.8 C-7.1 12.3 -6.6 12.1 -6.2 12.3 C-5.8 12.5 -5.8 13.1 -6 13.6 C-6.2 14.1 -6.7 14.3 -7.1 14.1 C-7.4 13.8 -7.4 13.2 -7.2 12.8 Z']], [2, 2]),
      ],
      hold: [-1, 18, 90],
    },
    // Pointing: the index finger straight on along the hand, the others
    // curled into the palm under the thumb.
    point: {
      behind: [
        sideFinger([[2.4, 11.8], [2.2, 13.6], [-0.4, 18], [-3, 17.6], [-3.6, 15.2]], MIDDLE_W),
        SIDE_PALM,
        sideFinger([[3, 10], [3, 12.6], [3, 18.2], [2.95, 21.8], [2.9, 25.2]], INDEX_W, 'M3.95 23.2 C3.95 24.2 3.6 25 3 25.3 C3.25 24.6 3.4 23.9 3.45 23.1 Z'),
      ],
      front: [sideThumb([[-2.8, 2.8], [-5.2, 8.8], [-4.6, 13], [-2.2, 15.8]], [-3, 14.8], 'M-6.9 7.2 C-7.2 8.4 -7.2 9.6 -7 10.8')],
      tip: [2.9, 26.3],
    },
    // A fist from the thumb side, the thumb wrapped over the curled fingers.
    fist: {
      behind: [
        SIDE_PALM,
        sideFinger([[3, 10], [3, 12.8], [2.6, 18.2], [-1.2, 19.6], [-3.2, 17]], INDEX_W),
      ],
      front: [sideThumb([[-2.8, 2.8], [-5.4, 8.6], [-4.6, 13.4], [-1.4, 16.4]], [-2.2, 15.6], 'M-7.1 7 C-7.4 8.2 -7.4 9.4 -7.2 10.6')],
      hold: [-0.4, 15.6, 0],
    },
    // Thumbs up: a compact fist from the thumb side, the thumb straight
    // on along the hand, well past the curled fingers.
    thumb: {
      behind: [
        sideFinger([[2.4, 11.8], [2.4, 13.6], [1.2, 18.4], [-2, 19.4], [-3.4, 16.4]], MIDDLE_W),
        SIDE_PALM,
        sideFinger([[3, 10], [3, 12.8], [2.4, 17.4], [-1.4, 18.2], [-2.8, 15.2]], INDEX_W),
      ],
      front: [finger([[-3, 3.6], [-4.6, 11.4], [-4.8, 20.4], [-4.4, 28]], [2.25, 2, 1.75, 1.55], -1, [
        ['oc-knuckle', 'M-6.9 10 C-7.2 11.4 -7.2 13 -7 14.4'],
        ['oc-crease', 'M-6.6 20.4 C-5.7 20.9 -4.4 20.9 -3.3 20.4'],
        ['oc-nail', thumbNail(-4.6, 26.2)],
      ], [1, 3])],
    },
    // A pinch: the thumb's pad on the index finger's, the others curled
    // behind (a chef's kiss, or holding a card, a brush, or a pen).
    pinch: {
      behind: [
        sideFinger([[2.4, 11.8], [2.2, 13.6], [0.2, 18.8], [-2.8, 19.4], [-3.8, 17]], MIDDLE_W),
        SIDE_PALM,
        sideFinger([[3, 10], [3, 12.6], [1.4, 18], [-1.6, 20.4], [-4, 20.8]], INDEX_W, 'M-2.6 21.4 C-3.2 21.8 -3.9 21.9 -4.5 21.7 C-3.9 21.4 -3.4 21.1 -3 20.7 Z'),
      ],
      front: [sideThumb([[-2.8, 2.8], [-5.4, 8.8], [-5.8, 13.6], [-4.8, 19.4]], [-5.2, 17.8], 'M-7.1 7.4 C-7.4 8.6 -7.4 9.8 -7.2 11')],
      hold: [-4.4, 20.4, 120],
    },
    // The palm to the viewer, the fingers together and straight, the
    // thumb out to the side: stop, presenting, reassuring.
    open: {
      behind: [],
      front: [
        handPart(
          'M-4.4 -0.6 H4.4 C5.4 2.2 6.6 4.8 7 7.6 C7.2 9.6 6.6 11.6 5.6 12.8 L-5.2 12.8 C-5.6 10.6 -5.6 7.4 -5.2 4.6 C-5 2.6 -4.7 1 -4.4 -0.6 Z',
          'M4.4 -0.6 C5.4 2.2 6.6 4.8 7 7.6 M-5.2 4.6 C-5 2.6 -4.7 1 -4.4 -0.6 M-5.2 4.6 C-5.6 7.4 -5.6 10.6 -5.2 12.8',
          [
            ['oc-palm-mount', 'M1.4 1.6 C3.6 2.6 5.4 4.8 5.8 7.4 C5.9 8.8 5.4 9.8 4.6 10.2 C3.4 8.2 2.2 5.4 1.4 1.6 Z'],
            ['oc-palm-crease', 'M-4.4 6.6 C-1.6 7 1.4 6 3.4 4 M-4.2 9.4 C-1.4 9.8 1.6 9.4 4.2 8.4 M1.8 2.4 C1.4 5.2 1.8 8 3 10.4'],
          ],
        ),
        finger([[-3.8, 10.4], [-3.9, 12.4], [-4.3, 16.6], [-4.6, 19.1], [-4.8, 21.2]], [1.15, 1.15, 1.05, 0.95, 0.88], 1, fingerDetail(null, 'M-5.3 16.6 H-3.3 M-5.5 19.1 H-3.7')),
        finger([[-1.4, 10.6], [-1.4, 12.8], [-1.5, 17.6], [-1.6, 20.6], [-1.7, 23.2]], [1.3, 1.3, 1.18, 1.06, 0.98], 1, fingerDetail(null, 'M-2.6 17.6 H-0.4 M-2.6 20.6 H-0.6')),
        finger([[1.2, 10.6], [1.2, 12.8], [1.2, 18.2], [1.2, 21.6], [1.2, 24.4]], [1.35, 1.35, 1.22, 1.1, 1], 1, fingerDetail(null, 'M0.1 18.2 H2.3 M0.1 21.6 H2.3')),
        finger([[3.8, 10.4], [3.8, 12.6], [4.2, 17.4], [4.5, 20.4], [4.7, 22.8]], [1.3, 1.3, 1.18, 1.06, 0.98], 1, fingerDetail(null, 'M3.1 17.4 H5.3 M3.4 20.4 H5.6')),
        finger([[3.6, 2.6], [6.2, 6.6], [8.6, 10], [10, 13.4]], [2, 1.7, 1.45, 1.3], -1, fingerDetail(null, 'M7.4 8.4 C8 9 8.6 9.2 9.4 9.2'), [2, 2]),
      ],
    },
    // The palm to the viewer, the fingers spread wide (jazz hands, despair).
    spread: {
      behind: [],
      front: [
        handPart(
          'M-4.4 -0.6 H4.4 C5.4 2.2 6.6 4.8 7 7.6 C7.2 9.6 6.6 11.6 5.6 12.8 L-5.2 12.8 C-5.6 10.6 -5.6 7.4 -5.2 4.6 C-5 2.6 -4.7 1 -4.4 -0.6 Z',
          'M4.4 -0.6 C5.4 2.2 6.6 4.8 7 7.6 M-5.2 4.6 C-5 2.6 -4.7 1 -4.4 -0.6 M-5.2 4.6 C-5.6 7.4 -5.6 10.6 -5.2 12.8',
          [
            ['oc-palm-mount', 'M1.4 1.6 C3.6 2.6 5.4 4.8 5.8 7.4 C5.9 8.8 5.4 9.8 4.6 10.2 C3.4 8.2 2.2 5.4 1.4 1.6 Z'],
            ['oc-palm-crease', 'M-4.4 6.6 C-1.6 7 1.4 6 3.4 4 M-4.2 9.4 C-1.4 9.8 1.6 9.4 4.2 8.4'],
          ],
        ),
        finger([[-3.8, 10.4], [-4.2, 12.2], [-6.2, 15.8], [-7.4, 18], [-8.4, 19.8]], [1.15, 1.15, 1.05, 0.95, 0.88], 1),
        finger([[-1.4, 10.6], [-1.6, 12.8], [-2.8, 17.6], [-3.4, 20.6], [-3.9, 23]], [1.3, 1.3, 1.18, 1.06, 0.98], 1),
        finger([[1.2, 10.6], [1.3, 12.8], [1.6, 18.2], [1.8, 21.6], [1.9, 24.4]], [1.35, 1.35, 1.22, 1.1, 1], 1),
        finger([[3.8, 10.4], [4.2, 12.6], [5.8, 17], [6.8, 19.8], [7.6, 22]], [1.3, 1.3, 1.18, 1.06, 0.98], 1),
        finger([[3.6, 2.6], [6.6, 5.8], [9.6, 8], [11.8, 10]], [2, 1.7, 1.45, 1.3], -1, null, [2, 2]),
      ],
    },
    // The back of the hand to the viewer, the fingers together: on the
    // chest, over the eyes, patting a shoulder.
    flat: {
      behind: [],
      front: [
        handPart(
          'M-4.4 -0.6 H4.4 C4.7 1 5 2.6 5.2 4.6 C5.6 7.4 5.6 10.6 5.2 12.8 L-5.6 12.8 C-6.6 11.6 -7.2 9.6 -7 7.6 C-6.6 4.8 -5.4 2.2 -4.4 -0.6 Z',
          'M-4.4 -0.6 C-5.4 2.2 -6.6 4.8 -7 7.6 M5.2 4.6 C5 2.6 4.7 1 4.4 -0.6 M5.2 4.6 C5.6 7.4 5.6 10.6 5.2 12.8',
          [
            ['oc-hand-shade', 'M3.4 -0.6 H4.4 C4.7 1 5 2.6 5.2 4.6 C5.6 7.4 5.6 10.6 5.2 12.8 L3.6 12.8 C3.9 10 3.9 6.4 3.6 3.4 Z'],
            ['oc-tendon', 'M-2.6 1.6 C-3 4.6 -3.4 8 -3.8 10.6 M-0.8 1.8 C-1 5 -1.2 8.2 -1.3 10.8 M0.9 1.8 C1.1 5 1.3 8.2 1.4 10.8 M2.6 1.6 C3 4.6 3.4 8 3.7 10.6'],
            ['oc-knuckle', 'M-4.6 11.6 C-3.8 10.8 -2.8 10.8 -2.2 11.6 M-1.9 11.8 C-1.1 11 0 11 0.6 11.8 M0.8 11.8 C1.6 11 2.6 11 3.2 11.8 M3.3 11.6 C4 10.9 4.8 11 5.2 11.6'],
          ],
        ),
        finger([[3.8, 10.4], [3.9, 12.4], [4.3, 16.6], [4.6, 19.1], [4.8, 21.2]], [1.15, 1.15, 1.05, 0.95, 0.88], -1, fingerDetail(null, null, 'M4.1 19.9 C4.2 19.4 4.6 19.2 5 19.3 C5.4 19.4 5.5 19.9 5.5 20.4 C5.4 20.9 5 21.2 4.6 21.1 C4.2 20.9 4.1 20.4 4.1 19.9 Z')),
        finger([[1.4, 10.6], [1.4, 12.8], [1.5, 17.6], [1.6, 20.6], [1.7, 23.2]], [1.3, 1.3, 1.18, 1.06, 0.98], -1, fingerDetail(null, null, 'M0.9 21.6 C1 21.1 1.4 20.9 1.8 21 C2.2 21.1 2.4 21.6 2.4 22.2 C2.3 22.8 1.9 23.1 1.5 23 C1.1 22.8 0.9 22.2 0.9 21.6 Z')),
        finger([[-1.2, 10.6], [-1.2, 12.8], [-1.2, 18.2], [-1.2, 21.6], [-1.2, 24.4]], [1.35, 1.35, 1.22, 1.1, 1], -1, fingerDetail(null, null, 'M-1.9 22.8 C-1.8 22.3 -1.4 22.1 -1 22.2 C-0.6 22.3 -0.4 22.8 -0.4 23.4 C-0.5 24 -0.9 24.3 -1.3 24.2 C-1.7 24 -1.9 23.4 -1.9 22.8 Z')),
        finger([[-3.8, 10.4], [-3.8, 12.6], [-4.2, 17.4], [-4.5, 20.4], [-4.7, 22.8]], [1.3, 1.3, 1.18, 1.06, 0.98], -1, fingerDetail(null, null, 'M-5.4 21.2 C-5.3 20.7 -4.9 20.5 -4.5 20.6 C-4.1 20.7 -3.9 21.2 -3.9 21.8 C-4 22.4 -4.4 22.7 -4.8 22.6 C-5.2 22.4 -5.4 21.8 -5.4 21.2 Z')),
        finger([[-3.6, 2.6], [-6.2, 6.6], [-8.4, 10.2], [-9.4, 13.6]], [2, 1.7, 1.45, 1.3], 1, fingerDetail(null, null, 'M-9.9 11.9 C-9.7 11.4 -9.2 11.3 -8.8 11.5 C-8.4 11.7 -8.4 12.3 -8.6 12.8 C-8.8 13.3 -9.3 13.5 -9.7 13.3 C-10 13 -10.1 12.4 -9.9 11.9 Z'), [2, 2]),
      ],
    },
    // A fist from its back round something held across behind the fingers
    // (a handle, a mug's handle, a rolled thing), the thumb wrapped round
    // the near side.
    grip: {
      behind: [],
      front: [
        handPart(
          'M-4.4 -0.6 H4.4 C4.8 1.6 5.4 4.6 5.8 7.6 C6.2 9.6 6.4 11 6.3 12.2 L6.3 13.6 L-6 13.6 C-6.1 12.2 -6 10.4 -5.6 8.4 C-5.2 6 -4.8 3.2 -4.4 -0.6 Z',
          'M4.4 -0.6 C4.8 1.6 5.4 4.6 5.8 7.6 C6.2 9.6 6.4 11 6.3 12.2 M-5 4.8 C-4.7 3 -4.5 1.4 -4.4 -0.6',
          [
            ['oc-hand-shade', 'M4.4 -0.6 C4.8 1.6 5.4 4.6 5.8 7.6 C6.2 9.6 6.4 11 6.3 12.2 C5.7 12.4 5.1 12 4.8 11.2 C4.3 8.8 3.9 5.6 3.7 3 C3.6 1.6 3.6 0.4 3.7 -0.6 Z'],
            ['oc-tendon', 'M-2 1.4 C-2.6 5 -3.2 8.6 -3.8 11.4 M-0.4 1.6 C-0.6 5.4 -1 9 -1.2 12 M1.2 1.6 C1.4 5.2 1.4 8.8 1.4 11.8 M2.8 1.4 C3.2 4.8 3.6 8 4 10.8'],
          ],
        ),
        finger([[-2.6, 2.2], [-6.4, 7.6], [-7.6, 12.2], [-6.2, 15.8]], [2, 1.75, 1.55, 1.38], -1, fingerDetail(
          'M-8.1 6.6 C-8.5 7.6 -8.6 8.6 -8.5 9.6', null,
          'M-8 13.6 C-8.1 14.5 -7.8 15.6 -7.2 16 C-6.8 15.6 -6.7 14.6 -6.9 13.8 C-7.2 13.4 -7.7 13.4 -8 13.6 Z',
        ), [1, 4]),
        handPart('M3.2 11.4 C3.3 13.4 3.3 15.2 3.5 16.4 C3.7 17.3 4.4 17.6 5.2 17.3 C5.8 17 6 16.1 6 15.1 C6 13.7 5.9 12.4 5.75 11.2 Z',
          'M3.2 12.6 C3.3 13.4 3.3 15.2 3.5 16.4 C3.7 17.3 4.4 17.6 5.2 17.3 C5.8 17 6 16.1 6 15.1 C6 13.7 5.9 12.4 5.75 11.2',
          [['oc-knuckle', 'M3.5 12.4 C4 11.7 5 11.6 5.6 12.2']]),
        handPart('M0.4 12 C0.3 14.2 0.4 16.4 0.6 17.8 C0.8 18.7 1.6 19 2.3 18.8 C2.9 18.6 3.2 17.9 3.2 16.8 C3.2 15 3.1 13.4 3.05 12 Z',
          'M0.4 13 C0.3 14.2 0.4 16.4 0.6 17.8 C0.8 18.7 1.6 19 2.3 18.8 C2.9 18.6 3.2 17.9 3.2 16.8 C3.2 15 3.1 13.4 3.05 13',
          [['oc-knuckle', 'M0.6 13 C1.2 12.3 2.2 12.3 2.8 13']]),
        handPart('M-2.6 12.6 C-2.7 14.8 -2.6 17 -2.4 18.4 C-2.2 19.3 -1.4 19.6 -0.7 19.4 C-0.1 19.2 0.3 18.5 0.3 17.4 C0.3 15.6 0.3 14 0.3 12.6 Z',
          'M-2.6 13.4 C-2.7 14.8 -2.6 17 -2.4 18.4 C-2.2 19.3 -1.4 19.6 -0.7 19.4 C-0.1 19.2 0.3 18.5 0.3 17.4 C0.3 15.6 0.3 14 0.3 13.4',
          [['oc-knuckle', 'M-2.3 13.5 C-1.7 12.8 -0.6 12.8 -0.1 13.5']]),
        handPart('M-5.6 12 C-5.7 14 -5.7 16 -5.4 17.4 C-5.2 18.3 -4.4 18.6 -3.7 18.4 C-3.1 18.2 -2.7 17.5 -2.6 16.4 C-2.6 14.8 -2.6 13.4 -2.6 12 Z',
          'M-5.6 12 C-5.7 14 -5.7 16 -5.4 17.4 C-5.2 18.3 -4.4 18.6 -3.7 18.4 C-3.1 18.2 -2.7 17.5 -2.6 16.4 C-2.6 14.8 -2.6 13.4 -2.6 12.8',
          [['oc-knuckle', 'M-5.2 12.8 C-4.6 12.1 -3.6 12.1 -3 12.8']]),
      ],
      hold: [0.2, 15.4, 0],
      heldBehind: true,
    },
  };

  /** Draws a hand's parts into parent, each part's ink under its skin and then its details. */
  function drawHandParts(parent, parts) {
    for (const { fill, ink, details } of parts) {
      svg('path', { class: 'oc-ink oc-ink--fine', d: ink }, parent);
      svg('path', { class: 'oc-skin', d: fill }, parent);
      for (const [cls, d] of details || []) svg('path', { class: cls, d }, parent);
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
    look: 0, down: 0, brow: 0, frown: 0, smile: 0.4, wide: 0, happy: 0, sweat: 0, blush: 0,
    nod: 0, tilt: 0, crouch: 0, hop: 0, lean: 0, age: 0, mask: 0,
  };
  const DISCRETE = new Set(['rightShape', 'leftShape']);

  /** The pose at song time t: each key eases its fields from wherever they are when it starts, in cue order. */
  function poseAt(keys, t, reduced) {
    const pose = { ...REST };
    for (const [start, duration, fields] of keys) {
      if (t < start) break;
      const u = reduced ? 1 : easeInOutCubic(progress(t, start, duration));
      for (const [name, target] of Object.entries(fields)) {
        if (DISCRETE.has(name)) {
          if (u >= 0.4) pose[name] = target;
          continue;
        }
        const from = pose[name];
        pose[name] = Array.isArray(target) ? target.map((value, i) => from[i] + (value - from[i]) * u) : from + (target - from) * u;
      }
    }
    return pose;
  }

  // ------------------------------------------------------------------
  // The body, in figure units: a unisex build, shoulders little wider
  // than the hips, with no waist shaping. Each costume draws over it.
  // ------------------------------------------------------------------

  // A top from the neck to the hips; the sleeves' heads cover its shoulders.
  const TOP = 'M73.6 78.6 C70 79.6 62 82.4 56.6 85.2 C52.6 87.4 51.4 92.6 53.4 98 C55.4 103.6 57.6 108.4 58.4 114 C59 124 58.6 134 58.8 142 C58.9 148 58.2 153 57.6 157.4 C66 159.2 94 159.2 102.4 157.4 C101.8 153 101.1 148 101.2 142 C101.4 134 101 124 101.6 114 C102.4 108.4 104.6 103.6 106.6 98 C108.6 92.6 107.4 87.4 103.4 85.2 C98 82.4 90 79.6 86.4 78.6 C84 80.2 76 80.2 73.6 78.6 Z';
  // Its far side turned from the light, and its near side catching it.
  const TOP_SHADE = 'M106.6 98 C104.6 103.6 102.4 108.4 101.6 114 C101 124 101.4 134 101.2 142 C101.1 148 101.8 153 102.4 157.4 C99 158.2 95.4 158.6 92 158.8 C93.2 148 93.6 136 93.2 124 C93 114 95.6 104 100.6 96 C102.4 93 104.6 90.6 106.4 89 Z';
  const TOP_LIGHT = 'M56.6 85.2 C52.6 87.4 51.4 92.6 53.4 98 C55.4 103.6 57.6 108.4 58.4 114 C59 124 58.6 134 58.8 142 L62.6 142 C62.6 130 62.4 116 61 106 C59.8 98 58.4 91 56.6 85.2 Z';
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
  // A sleeve pushed up to the elbow, bunched in rings there.
  const PUSHED = 'M101 137.2 C105.4 135.4 112.6 135.4 117 137.2 C117.6 140.4 117.8 144 117.2 147.4 C116.8 148.8 116 149.6 115.2 150 C111 151.2 106.8 151.2 102.6 150 C101.8 149.6 101.2 148.8 100.8 147.4 C100.2 144 100.4 140.4 101 137.2 Z';
  const PUSHED_FOLDS = 'M101 141.8 C105.6 143.4 112.4 143.4 117.2 141.8 M101.2 146 C105.8 147.4 112.2 147.4 116.8 146 M102.4 138.8 C103 140.4 103 141.6 102.6 142.8 M115.4 138.8 C114.8 140.4 114.8 141.6 115.2 142.8';

  // ------------------------------------------------------------------
  // The Teammate's face, drawn in head units: the chin at (0, 0), the face
  // 100 wide; placed on the neck by drawnHead(). A towering pompadour with
  // a curl on the brow, sideburns, heavy brows, a strong nose, a twirled
  // moustache, and a cleft chin.
  // ------------------------------------------------------------------

  const TENOR_HEAD = {
    width: 40,
    face: 'M-49 -74 C-50 -104 -28 -127 0 -127 C28 -127 50 -104 49 -74 C48.4 -52 44 -33 35 -19 C26.6 -7 14.6 0 0 0 C-14.6 0 -26.6 -7 -35 -19 C-44 -33 -48.4 -52 -49 -74 Z',
    jawShade: 'M49 -74 C48.4 -52 44 -33 35 -19 C26.6 -7 14.6 0 0 0 C12 -4 22 -12 30 -24 C38 -37 42 -54 43 -74 C44 -88 44 -98 42 -106 C47 -98 49.6 -86 49 -74 Z',
    ear: 'M-47 -79 C-57 -86 -63 -73 -61 -62 C-59 -51 -53 -46 -46 -50 Z',
    earInner: 'M-50 -75 C-56 -76 -58 -68 -56 -61 C-55 -57 -52 -55 -49 -56',
    hair: 'M-51 -64 C-58 -92 -56 -122 -40 -146 C-28 -166 -8 -180 16 -180 C38 -180 56 -166 62 -144 C66 -128 61 -106 55 -92 C54 -84 52.4 -76 50 -66 C47.6 -79 45 -90 40 -98 C32 -106 18 -110 2 -110 C-14 -110 -30 -105 -40 -96 C-45 -88 -48.4 -78 -51 -64 Z',
    hairShade: 'M62 -144 C66 -128 61 -106 55 -92 C54 -84 52.4 -76 50 -66 C47.6 -79 45 -90 40 -98 C46 -108 52 -122 54 -138 C55 -150 52 -164 48 -170 C55 -164 60 -156 62 -144 Z',
    hairStrands: 'M-30 -106 C-34 -130 -24 -156 -2 -170 M-14 -110 C-14 -136 -4 -158 18 -170 M2 -110 C6 -134 18 -154 38 -164 M18 -108 C26 -128 38 -144 54 -150 M-42 -98 C-48 -118 -42 -140 -28 -156',
    hairSheen: 'M-40 -122 C-34 -150 -16 -170 8 -173 M-24 -118 C-20 -140 -8 -156 10 -162',
    sideburns: ['M-49.4 -70 C-50.6 -62 -50.4 -54 -48.4 -46 L-44.6 -48 C-45 -56 -45 -63 -44.4 -70 Z', 'M49.4 -70 C50.6 -62 50.4 -54 48.4 -46 L44.6 -48 C45 -56 45 -63 44.4 -70 Z'],
    brows: ['M-35 -85 C-29 -92 -18 -93 -9 -88 C-11 -85 -19 -86 -33 -81 Z', 'M35 -85 C29 -92 18 -93 9 -88 C11 -85 19 -86 33 -81 Z'],
    eyes: [-21, 21],
    eyeY: -70,
    nose: 'M-1.6 -70 C-2.4 -60 -5.6 -48 -8.6 -41 C-6.6 -35.4 -1.4 -34.4 2 -36.4 C5.4 -34.4 9.6 -35.8 9.8 -40.6 C7 -47 3.4 -58 2.4 -70',
    noseLight: 'M-0.4 -66 C-1 -58 -2.4 -50 -3.8 -45',
    nostrils: 'M-5.6 -38.6 C-4.6 -37 -2.6 -37 -1.8 -38.2 M4.4 -38.2 C5.2 -37 7.2 -37 8 -38.6',
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
    const g = svg('g', { class: 'oc-face', transform: `translate(${HEAD.x} ${HEAD.chin}) scale(${scale.toFixed(4)})` }, parent);
    const ink = (d, cls) => inked(g, d, cls, 'oc-ink oc-ink--face');
    for (const side of [1, -1]) {
      const ear = svg('g', { transform: side < 0 ? 'scale(-1 1)' : '' }, g);
      inked(ear, spec.ear, 'oc-face-skin', 'oc-ink oc-ink--face', paint.face);
      svg('path', { class: 'oc-ear-line', d: spec.earInner }, ear);
    }
    inked(g, spec.face, 'oc-face-skin', 'oc-ink oc-ink--face', paint.face);
    svg('path', { class: 'oc-face-shade', d: spec.jawShade }, g);
    const cheeks = spec.cheeks.map(([cx, cy]) => svg('ellipse', { class: 'oc-blush', cx, cy, rx: 9, ry: 5.4 }, g));
    if (spec.backHair) parent.insertBefore(svg('path', { class: 'oc-hair', d: spec.backHair }), parent.firstChild);
    for (const d of spec.sideburns || []) svg('path', { class: 'oc-hair', d }, g);
    ink(spec.hair, 'oc-hair');
    svg('path', { class: 'oc-hair-shade', d: spec.hairShade }, g);
    svg('path', { class: 'oc-hair-strand', d: spec.hairStrands }, g);
    svg('path', { class: 'oc-hair-sheen', d: spec.hairSheen }, g);
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
      svg('circle', { class: 'oc-iris', cx: ex, cy: spec.eyeY + 0.4, r: 5.2 }, look);
      svg('circle', { class: 'oc-pupil', cx: ex, cy: spec.eyeY + 0.4, r: 2.6 }, look);
      svg('circle', { class: 'oc-catchlight', cx: ex + 1.8, cy: spec.eyeY - 1.6, r: 1.5 }, look);
      svg('circle', { class: 'oc-catchlight oc-catchlight--soft', cx: ex - 1.6, cy: spec.eyeY + 2.2, r: 0.7 }, look);
      const lid = svg('path', { class: 'oc-lid', d: '' }, open);
      svg('path', { class: 'oc-lash-line', d: `M${ex - 12} ${spec.eyeY + 0.4} C${ex - 7.6} ${spec.eyeY - 7.2} ${ex + 7.6} ${spec.eyeY - 7.2} ${ex + 12} ${spec.eyeY + 0.4}` }, open);
      const shut = svg('path', { class: 'oc-eye-shut', d: `M${ex - 11} ${spec.eyeY - 1} C${ex - 6} ${spec.eyeY - 7} ${ex + 6} ${spec.eyeY - 7} ${ex + 11} ${spec.eyeY - 1}`, opacity: 0 }, eye);
      return { ex, open, look, lid, shut, white };
    });
    const brows = spec.brows.map((d) => svg('path', { class: 'oc-brow', d }, g));
    inked(g, spec.nose, 'oc-face-skin oc-nose', 'oc-ink oc-ink--face', paint.face);
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
        inked(layer, TOP, 'oc-top', 'oc-ink oc-ink--cool', paint.top);
        svg('path', { class: 'oc-top-shade', d: TOP_SHADE }, layer);
        svg('path', { class: 'oc-top-light', d: TOP_LIGHT }, layer);
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
        inked(layer, TOP, 'oc-top', 'oc-ink oc-ink--cool', paint.top);
        svg('path', { class: 'oc-top-shade', d: TOP_SHADE }, layer);
        svg('path', { class: 'oc-top-light', d: TOP_LIGHT }, layer);
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
        inked(layer, TOP, 'oc-under', 'oc-ink oc-ink--cool');
        for (const side of [1, -1]) {
          const panel = svg('g', { transform: side < 0 ? MIRROR : '' }, layer);
          inked(panel, 'M86.4 78.6 C90 79.6 98 82.4 103.4 85.2 C107.4 87.4 108.6 92.6 106.6 98 C104.6 103.6 102.4 108.4 101.6 114 C101 124 101.4 134 101.2 142 C101.1 150 101.6 156 102.4 162.4 C96.6 163.6 88.6 163.8 82.6 163 C81.6 154 81 142 80.8 128.4 C82.6 116 85.2 100 86.4 78.6 Z', 'oc-top', 'oc-ink oc-ink--cool', paint.top);
          drawParts(panel, [
            ['oc-top-shade', 'M106.6 98 C104.6 103.6 102.4 108.4 101.6 114 C101 124 101.4 134 101.2 142 C101.1 150 101.6 156 102.4 162.4 C99.6 162.9 96.6 163.3 93.6 163.5 C94.6 150 95 136 94.6 124 C94.4 114 96.6 104 101 96 C102.6 93 104.4 90.6 106.2 89 Z'],
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
      sleeve: 'short', head: TEAMMATE_HEAD, shoes: 'boot', cargo: true,
      top(layer, paint) {
        inked(layer, TOP, 'oc-under', 'oc-ink oc-ink--cool');
        const vest = 'M74 79.2 C68 81 60 84.4 55.4 87 C56.6 92 58 98 59 104 C59.6 108 58.6 111 57.6 113.6 C58.2 124 58.4 136 58.4 146 C58.4 151 58 156 57.6 160.4 C66 162 94 162 102.4 160.4 C102 156 101.6 151 101.6 146 C101.6 136 101.8 124 102.4 113.6 C101.4 111 100.4 108 101 104 C102 98 103.4 92 104.6 87 C100 84.4 92 81 86 79.2 C84.6 92 82.4 104 80 116 C77.6 104 75.4 92 74 79.2 Z';
        inked(layer, vest, 'oc-top', 'oc-ink oc-ink--cool', paint.top);
        const clip = svg('clipPath', { id: `oc-vest-${++uid}` }, paint.defs);
        svg('path', { d: vest }, clip);
        const bands = svg('g', { 'clip-path': `url(#${clip.id})` }, layer);
        svg('path', { class: 'oc-top-shade', d: TOP_SHADE }, bands);
        svg('path', { class: 'oc-reflective', d: 'M50 127.6 H110 V133.4 H50 Z M50 145 H110 V150.8 H50 Z M63.4 80 H69.2 V127.6 H63.4 Z M90.8 80 H96.6 V127.6 H90.8 Z' }, bands);
        svg('path', { class: 'oc-reflective-shine', d: 'M50 129 H110 M50 146.4 H110 M64.8 82 V127 M92.2 82 V127' }, bands);
        svg('path', { class: 'oc-zip', d: 'M80 116 V160' }, layer);
        svg('path', { class: 'oc-fold', d: 'M62 116 C66 120 70 122 74 122.6 M98 118 C94 121 90 122.6 86 123' }, layer);
      },
      collar(layer) {
        svg('path', { class: 'oc-under-neck', d: 'M74.8 79.2 C77.2 82.4 82.8 82.4 85.2 79.2' }, layer);
      },
    },
    // The Test Engineer: a white lab coat to the knees, a lilac shirt at
    // its neck, pens in the pocket, and safety goggles hung round the neck.
    test: {
      sleeve: 'long', head: TEAMMATE_HEAD, shoes: 'shoe',
      top(layer, paint) {
        inked(layer, TOP, 'oc-under', 'oc-ink oc-ink--cool');
        const coat = 'M73.6 78.6 C70 79.6 62 82.4 56.6 85.2 C52.6 87.4 51.4 92.6 53.4 98 C55.4 103.6 57.6 108.4 58.4 114 C59 124 58.6 134 58.6 144 C58.4 162 57.2 186 56.2 206 C55.6 216 55.2 224 55 232 C62 233.8 72 234.2 78.4 233.6 C79.2 220 79.6 206 80 196 C80.4 206 80.8 220 81.6 233.6 C88 234.2 98 233.8 105 232 C104.8 224 104.4 216 103.8 206 C102.8 186 101.6 162 101.4 144 C101.4 134 101 124 101.6 114 C102.4 108.4 104.6 103.6 106.6 98 C108.6 92.6 107.4 87.4 103.4 85.2 C98 82.4 90 79.6 86.4 78.6 C84.6 92 82.4 106 80 118 C77.6 106 75.4 92 73.6 78.6 Z';
        inked(layer, coat, 'oc-top', 'oc-ink oc-ink--cool', paint.top);
        drawParts(layer, [
          ['oc-top-shade', 'M106.6 98 C104.6 103.6 102.4 108.4 101.6 114 C101 124 101.4 134 101.4 144 C101.6 162 102.8 186 103.8 206 C104.4 216 104.8 224 105 232 C101.6 232.8 98 233.4 94.6 233.8 C95 214 95 190 94.4 168 C94 146 94.4 124 97 108 C98.4 100 102 93 106.2 89 Z'],
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
        inked(layer, TOP, 'oc-top', 'oc-ink oc-ink--cool', paint.top);
        svg('path', { class: 'oc-top-shade', d: TOP_SHADE }, layer);
        svg('path', { class: 'oc-top-light', d: TOP_LIGHT }, layer);
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
    // The Security Engineer: a black field jacket zipped to its stand
    // collar, flapped chest pockets, epaulettes, a gold shield badge, and
    // an earpiece's coiled wire; black cargo trousers and boots.
    security: {
      sleeve: 'long', head: TEAMMATE_HEAD, shoes: 'boot', cargo: true,
      top(layer, paint) {
        const jacket = 'M73.6 78.6 C70 79.6 62 82.4 56.6 85.2 C52.6 87.4 51.4 92.6 53.4 98 C55.4 103.6 57.6 108.4 58.4 114 C59 124 58.6 134 58.8 142 C58.9 150 58.4 157 57.8 163.4 C66 165.2 94 165.2 102.2 163.4 C101.6 157 101.1 150 101.2 142 C101.4 134 101 124 101.6 114 C102.4 108.4 104.6 103.6 106.6 98 C108.6 92.6 107.4 87.4 103.4 85.2 C98 82.4 90 79.6 86.4 78.6 C84 80.2 76 80.2 73.6 78.6 Z';
        inked(layer, jacket, 'oc-top', 'oc-ink oc-ink--cool', paint.top);
        drawParts(layer, [
          ['oc-top-shade', TOP_SHADE],
          ['oc-top-light', TOP_LIGHT],
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
        inked(layer, 'M72 70.4 C71.6 74.6 72.4 78.6 74.2 81.4 C77.4 83.4 82.6 83.4 85.8 81.4 C87.6 78.6 88.4 74.6 88 70.4 C84.4 72 75.6 72 72 70.4 Z', 'oc-collar', 'oc-ink oc-ink--cool');
        svg('path', { class: 'oc-zip oc-zip--dark', d: 'M80 72 V83' }, layer);
      },
      neckwear(layer) {
        // The earpiece's clear coiled wire, from the collar up behind the jaw.
        svg('path', { class: 'oc-earwire', d: 'M86.4 74 C88.4 70 90.4 66 92 61.6' }, layer);
        svg('path', { class: 'oc-earwire-coil', d: 'M86.8 73 l1.6 -0.6 M87.6 71.2 l1.6 -0.6 M88.4 69.4 l1.6 -0.6 M89.2 67.6 l1.6 -0.6 M90 65.8 l1.6 -0.6 M90.8 64 l1.6 -0.6' }, layer);
      },
    },
  };

  // ------------------------------------------------------------------
  // The figure
  // ------------------------------------------------------------------

  // A bare upper arm under a short sleeve (the picture's right arm).
  const UPPER_ARM = 'M96.8 100 A8.6 8.6 0 1 1 113 95.6 C114 104 115 116 115.6 126 C115.9 131 116 135.6 115.8 139.4 A6.9 6.9 0 0 1 102 139.6 C102.2 131 102.6 120 103.2 111.6 C101.8 106.4 99.4 102 96.8 100 Z';
  const SHORT_SLEEVE = 'M95.6 99.4 A9.2 9.2 0 1 1 113.6 95 C114.4 102 115 109 115.4 116.2 C111.4 118.6 106.6 119 102.6 117.6 C102.8 115 103 113 103 111.4 C101.4 106 98.6 101.6 95.6 99.4 Z';
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
   */
  function buildFigure(fig, sway, costumeName) {
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
      sleeve: gradient('linearGradient', 'sleeve', { x1: 1, y1: 0, x2: 0, y2: 0 }, ['0', '0.6', '1']),
      trouserLeft: gradient('linearGradient', 'trouser', { ...user, x1: 56.4, y1: 0, x2: 80, y2: 0 }, ['0', '0.34', '0.74', '1']),
      trouserRight: gradient('linearGradient', 'trouser', { ...user, x1: 80.6, y1: 0, x2: 103.6, y2: 0 }, ['0', '0.34', '0.74', '1']),
      trouserFall: gradient('linearGradient', 'trouser-fall', { ...user, x1: 0, y1: 150, x2: 0, y2: 290 }, ['0', '1']),
      shoe: gradient('linearGradient', 'shoe', { x1: 0, y1: 0, x2: 0.3, y2: 1 }, ['0', '0.55', '1']),
      skin: gradient('linearGradient', 'skin', { x1: 1, y1: 0, x2: 0, y2: 0 }, ['0', '0.55', '1']),
      face: gradient('linearGradient', 'face', { ...user, x1: -40, y1: -120, x2: 40, y2: 0 }, ['0', '0.6', '1']),
    };

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
    costume.top(svg('g', { class: 'oc-top-layer' }, trunk), paint);
    const wornUnder = svg('g', {}, trunk);
    const drawnNeck = svg('g', {}, trunk);
    inked(drawnNeck, NECK, 'oc-skin-neck', 'oc-ink oc-ink--face', paint.skin);
    svg('path', { class: 'oc-neck-shade', d: NECK_SHADE }, drawnNeck);
    costume.collar(svg('g', { 'data-testid': 'oc-collar' }, trunk));
    if (costume.neckwear) costume.neckwear(svg('g', {}, trunk));
    const headGroup = svg('g', {}, trunk);
    const drawnFace = svg('g', { 'data-testid': 'oc-drawn-face' }, headGroup);
    const setFace = drawnHead(drawnFace, costume.head, paint);
    const wornOver = svg('g', {}, headGroup);
    const sleepMask = drawSleepMask(svg('g', { class: 'oc-sleep-mask', 'data-testid': 'oc-sleep-mask' }, headGroup));
    const arms = svg('g', {}, trunk);

    // The arms: the sleeve turns at the shoulder; the forearm turns with it,
    // then at the elbow; the hand at the wrist, holding what it holds
    // between its parts behind and in front (or behind them all).
    const arm = (side) => {
      const root = svg('g', { transform: side < 0 ? MIRROR : '', 'data-testid': `oc-arm-${side < 0 ? 'left' : 'right'}` }, arms);
      const upper = svg('g', {}, root);
      if (costume.sleeve === 'short') {
        inked(upper, UPPER_ARM, 'oc-skin-arm', 'oc-ink oc-ink--face', paint.skin);
        inked(upper, SHORT_SLEEVE, 'oc-sleeve', 'oc-ink oc-ink--cool', paint.sleeve);
        svg('path', { class: 'oc-sleeve-fold', d: 'M103.4 114.6 C107 116.2 111.4 116 115 114' }, upper);
      } else {
        inked(upper, SLEEVE, 'oc-sleeve', 'oc-ink oc-ink--cool', paint.sleeve);
        svg('path', { class: 'oc-sleeve-fold', d: SLEEVE_FOLDS }, upper);
      }
      const reachGroup = svg('g', {}, root);
      const fore = svg('g', {}, reachGroup);
      if (costume.sleeve === 'long') {
        inked(fore, FORE_SLEEVE, 'oc-sleeve', 'oc-ink oc-ink--cool', paint.sleeve);
        svg('path', { class: 'oc-sleeve-fold', d: FORE_SLEEVE_FOLDS }, fore);
      } else {
        inked(fore, FOREARM, 'oc-skin-arm', 'oc-ink oc-ink--face', paint.skin);
        drawParts(fore, FOREARM_DETAIL);
      }
      const wrist = svg('g', {}, fore);
      const heldBehind = svg('g', {}, wrist);
      const hand = svg('g', { class: 'oc-hand', 'data-testid': 'oc-hand', transform: `translate(${WRIST[0]} ${WRIST[1]})` }, wrist);
      if (costume.sleeve === 'long') inked(fore, CUFF, 'oc-cuff', 'oc-ink oc-ink--cool');
      if (costume.sleeve === 'pushed') {
        inked(fore, PUSHED, 'oc-sleeve', 'oc-ink oc-ink--cool', paint.sleeve);
        svg('path', { class: 'oc-sleeve-fold', d: PUSHED_FOLDS }, fore);
      }
      const shapes = new Map();
      let shown = null;
      const held = { name: null, node: null };
      return {
        side, root, upper, reach: reachGroup, fore, wrist, heldBehind, hand, held,
        get shown() { return shown; },
        shape(asked, force = false) {
          // A hand holding a prop keeps hold of it: an open-hand gesture
          // closes into a grip around the prop instead.
          const name = held.node && !HANDS[asked].hold ? 'grip' : asked;
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
          // A held prop sits between the hand's parts behind and in front,
          // at its hold, or behind the whole hand.
          if (held.node) {
            const { hold, heldBehind: behindAll } = HANDS[name];
            const parent = behindAll ? heldBehind : shapes.get(name).between;
            const [hx, hy, ha] = hold || [0, 16, 0];
            held.at = behindAll ? [WRIST[0] + hx, WRIST[1] + hy] : [hx, hy];
            held.node.setAttribute('transform', `translate(${held.at[0]} ${held.at[1]}) rotate(${ha})`);
            if (held.node.parentNode !== parent) parent.appendChild(held.node);
          }
        },
        /**
         * Keeps an UPRIGHT prop level whatever the arm does: turns it so its
         * up (-y) points up in the figure, about its grip.
         */
        level(fig) {
          if (!held.node || !UPRIGHT.has(held.name)) return;
          const parent = held.node.parentNode?.getCTM?.();
          const base = fig.getCTM?.();
          if (!parent || !base) return;
          const m = base.inverse().multiply(parent);
          // up in the figure, as seen from the hand's frame: L⁻¹ (0, -1).
          const det = m.a * m.d - m.b * m.c;
          if (!det) return;
          const [vx, vy] = [m.c / det, -m.a / det];
          const angle = degrees(Math.atan2(vx, -vy));
          held.node.setAttribute('transform', `translate(${held.at[0]} ${held.at[1]}) rotate(${angle.toFixed(2)})`);
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
      a.upper.setAttribute('transform', `${turn(-up, SHOULDER)} ${shorten(f)}`);
      a.reach.setAttribute('transform', turn(-up, SHOULDER));
      const [dx, dy] = [(f - 1) * (ELBOW[0] - SHOULDER[0]), (f - 1) * (ELBOW[1] - SHOULDER[1])];
      a.fore.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) ${turn(up - fo, ELBOW)}`);
      a.wrist.setAttribute('transform', turn(clamp(hand, ...WRIST_RANGE), WRIST));
      a.shape(shape);
    }

    let worn = null;
    function pose(p, time, open, blink) {
      const drop = 7 * p.crouch;
      const squash = 1 - drop / (HEMS - WAIST);
      legs.setAttribute('transform', `translate(0 ${HEMS}) scale(1 ${squash.toFixed(4)}) translate(0 ${-HEMS})`);
      trunk.setAttribute('transform', `translate(0 ${drop.toFixed(2)})`);
      poseArm(right, p.right, p.rightLift, p.rightHand, p.rightShape);
      poseArm(left, p.left, p.leftLift, p.leftHand, p.leftShape);
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
      a.held.node = prop ? PROPS[prop](svg('g', { class: `oc-prop oc-prop--${prop}` })) : null;
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

  // Props that stay upright in the hand, whatever the arm does (see level()).
  const UPRIGHT = new Set(['mug', 'trophy', 'stamp', 'cane']);

  const PROPS = {
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
      inked(g, 'M-40 -1.4 H30 V1.4 H-40 Z', 'oc-handle', 'oc-ink oc-ink--cool');
      inked(g, 'M30 -3 H34 L50 -9 C52 -3 52 3 50 9 L34 3 H30 Z', 'oc-straw', 'oc-ink oc-ink--cool');
      svg('path', { class: 'oc-straw-line', d: 'M36 -2.4 L50 -6.6 M36 0 L51 0 M36 2.4 L50 6.6 M33 -3 V3' }, g);
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
      svg('path', { class: 'oc-cane-ink', d: 'M-5 -2 C-6 -8 2 -10 3 -4 L3 68' }, g);
      svg('path', { class: 'oc-cane', d: 'M-5 -2 C-6 -8 2 -10 3 -4 L3 68' }, g);
      return g;
    },
  };

  // ------------------------------------------------------------------
  // Singing: the mouth follows the sung words
  // ------------------------------------------------------------------

  /**
   * Word intervals [start, end] for a voice from the storyboard: each line's
   * marks, every word lasting until the next one starts, the last until the
   * line ends (a held note stays open).
   */
  function wordsFor(storyboard, voice) {
    const words = [];
    for (const section of storyboard.sections) {
      for (const line of section.lines) {
        if ((line.voice || section.voice) !== voice) continue;
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
    [side]: natural(pose), [`${side}Lift`]: lift, [`${side}Hand`]: dir === undefined ? hand : handToward(pose, dir),
    ...(shape ? { [`${side}Shape`]: shape } : {}),
  });
  const restArm = (side) => armFields(side, { arm: REST[side], hand: REST[`${side}Hand`], shape: 'rest' });
  // The fields of keys that return a gesture to rest (see figure()).
  const RESTS = new WeakSet([FACE_REST]);
  /** Keys that end a gesture: its arms, then the face, back at rest. */
  const settle = (at, sides = ['right', 'left']) => {
    const arms = Object.assign({}, ...sides.map(restArm));
    RESTS.add(arms);
    return [[at, 0.5, arms], [at + 0.1, 0.4, FACE_REST]];
  };
  const other = (side) => (side === 'right' ? 'left' : 'right');

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
      return [[-0.2, 0.45, { ...armFields(s, { ...g.aim(s, to), shape: 'point' }) }], [-0.05, 0.3, g.glance(to)], ...settle(hold, [s])];
    },
    /** Both arms flung wide, palms up, chest out: the operatic gesture. */
    operatic: ({ hold = 1.6, high = 0 }) => [
      [-0.15, 0.5, {
        ...armFields('right', { arm: outstretched(-28 - 30 * high), shape: 'open', dir: -18 - 30 * high }),
        ...armFields('left', { arm: outstretched(-28 - 30 * high), shape: 'open', dir: -18 - 30 * high }),
        brow: 0.7, tilt: -2, lean: -1,
      }],
      ...settle(hold),
    ],
    /** One arm out towards something, palm up: "this". */
    present: ({ to, hold = 1.4, side }, g) => {
      const s = side || g.side(to);
      return [[-0.2, 0.5, { ...armFields(s, { arm: g.toward(s, to, 14), shape: 'open', dir: g.along(s, to) }), ...g.glance(to), brow: 0.4 }], ...settle(hold, [s])];
    },
    /** A palm raised to the audience: "no need to worry". */
    reassure: ({ hold = 1.4, side = 'right' }) => [
      // Raised beside the shoulder, the whole arm in view: an arm swung
      // toward the viewer hides its upper half behind the forearm.
      [-0.2, 0.5, { ...armFields(side, { arm: reach([134, 70]), shape: 'open', dir: -84 }), brow: 0.5, smile: 0.9, tilt: 2 }],
      ...settle(hold, [side]),
    ],
    /** A hand pressed flat on the chest: "leave it to me". */
    chest: ({ hold = 1.2, side = 'left', pats = 2 }) => {
      const at = reach(CHEST, { shorten: 1 - LIFT * 0.6 });
      const off = reach([CHEST[0] + 4, CHEST[1] + 4], { shorten: 1 - LIFT * 0.6 });
      const pat = Array.from({ length: pats * 2 }, (_, i) => [0.35 + i * 0.16, 0.14, armFields(side, { arm: i % 2 ? at : off, lift: 0.6, shape: 'flat', dir: -150 })]);
      return [[-0.2, 0.4, { ...armFields(side, { arm: at, lift: 0.6, shape: 'flat', dir: -150 }), smile: 1, brow: 0.5, tilt: -3 }], ...pat, ...settle(hold, [side])];
    },
    /** An index finger raised beside the face: "quite simple!" */
    finger: ({ hold = 1, side = 'right' }) => [
      [-0.2, 0.4, { ...armFields(side, { arm: reach([116, 66]), shape: 'point', dir: -88 }), brow: 0.8, smile: 0.9, tilt: 3 }],
      ...settle(hold, [side]),
    ],
    /** A finger wagged side to side: "no, no". */
    wag: ({ hold = 1.2, side = 'right', times = 3 }) => {
      const pose = reach([114, 70]);
      const wags = Array.from({ length: times * 2 }, (_, i) => [0.3 + i * 0.13, 0.12, { [`${side}Hand`]: handToward(pose, -88 + (i % 2 ? -16 : 16)) }]);
      return [[-0.2, 0.4, { ...armFields(side, { arm: pose, shape: 'point', dir: -88 }), brow: 0.6, smile: 0.7 }], ...wags, ...settle(hold, [side])];
    },
    /** A finger to the lips: "shh". */
    shh: ({ hold = 1.2, side = 'right' }) => [
      [-0.2, 0.45, { ...armFields(side, { arm: reach([88, 94], { shorten: 1 - LIFT * 0.8 }), lift: 0.8, shape: 'point', dir: -92 }), brow: 0.6, look: side === 'right' ? -0.5 : 0.5 }],
      ...settle(hold, [side]),
    ],
    /** A knowing tap at the temple: "I'm certain I know". */
    temple: ({ hold = 1.2, side = 'right', taps = 2 }) => {
      const at = reach([TEMPLE[0] + 12, TEMPLE[1] + 25], { shorten: 1 - LIFT * 0.5 });
      const off = reach([TEMPLE[0] + 15, TEMPLE[1] + 28], { shorten: 1 - LIFT * 0.5 });
      const taps2 = Array.from({ length: taps * 2 }, (_, i) => [0.35 + i * 0.14, 0.12, { [side]: i % 2 ? at : off }]);
      return [[-0.2, 0.45, { ...armFields(side, { arm: at, lift: 0.5, shape: 'point', dir: -112 }), brow: 0.8, smile: 1, tilt: 4 }], ...taps2, ...settle(hold, [side])];
    },
    /** A chef's kiss: pinched fingers to the lips, then flung open. */
    kiss: ({ hold = 0.6, side = 'right' }) => [
      // Pinched fingers at the lips, the elbow down (as for "shh").
      [-0.25, 0.35, { ...armFields(side, { arm: reach([88, 94], { shorten: 1 - LIFT * 0.8 }), lift: 0.8, shape: 'pinch', dir: -100 }), happy: 1, round: 0.8 }],
      [0.25, 0.3, { ...armFields(side, { arm: reach([128, 54]), lift: 0.2, shape: 'spread', dir: -60 }), round: 0, smile: 1 }],
      ...settle(0.55 + hold, [side]),
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
      [-0.2, 0.4, { ...armFields(side, { arm: reach([128, 92]), shape: 'thumb', dir: -90 }), smile: 1, brow: 0.5, tilt: 3 }],
      ...settle(hold, [side]),
    ],
    /** A shrug: hands out palm up at the hips, shoulders and brows up. */
    shrug: ({ hold = 1.1 }) => [
      [-0.15, 0.4, {
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
      [-0.2, 0.35, { ...armFields(side, { arm: reach([BROW[0] + 40, BROW[1] + 12]), shape: 'flat', dir: -166 }), brow: 0.3, smile: 0.8 }],
      ...settle(hold, [side]),
    ],
    /** Both hands up, palms out: "I surrender". */
    surrender: ({ hold = 2 }) => [
      [-0.1, 0.45, {
        ...armFields('right', { arm: reach([124, 62]), shape: 'open', dir: -84 }),
        ...armFields('left', { arm: reach([124, 62]), shape: 'open', dir: -84 }),
        wide: 1, brow: 1, smile: -0.2, sweat: 1, lean: 1.4,
      }],
      ...settle(hold),
    ],
    /** A palm thrust at the viewer: "stop". */
    stop: ({ hold = 1.6, side = 'right' }) => [
      // Thrust out to the side at shoulder height, palm up and out.
      [-0.2, 0.35, { ...armFields(side, { arm: reach([142, 84]), shape: 'open', dir: -88 }), frown: 1, brow: 0, smile: -0.4 }],
      ...settle(hold, [side]),
    ],
    /** A hand flat over the eyes. */
    facepalm: ({ hold = 1.4, side = 'right' }) => [
      [-0.2, 0.35, { ...armFields(side, { arm: reach(BROW, { shorten: 1 - LIFT }), lift: 1, shape: 'flat', dir: -158 }), nod: 0.6, smile: -0.6, frown: 0.6 }],
      ...settle(hold, [side]),
    ],
    /** Hands up beside the head, fingers spread: despair. */
    despair: ({ hold = 1.4 }) => [
      [-0.15, 0.35, {
        ...armFields('right', { arm: reach([118, 50]), shape: 'spread', dir: -96 }),
        ...armFields('left', { arm: reach([118, 50]), shape: 'spread', dir: -96 }),
        wide: 1, brow: 1, smile: -0.8, round: 0.6,
      }],
      ...settle(hold),
    ],
    /** Both hands thrown up: "everywhere!" */
    throwUp: ({ hold = 1.2 }) => [
      [-0.15, 0.3, {
        ...armFields('right', { arm: outstretched(-62), shape: 'spread', dir: -62 }),
        ...armFields('left', { arm: outstretched(-62), shape: 'spread', dir: -62 }),
        wide: 1, brow: 1, frown: 0.4,
      }],
      ...settle(hold),
    ],
    /** Hands on the hips, impatient. */
    hips: ({ hold = 1.6 }) => [
      [-0.15, 0.45, {
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
      return [[-0.2, 0.3, {
        ...armFields(near, { arm: outstretched(-4, 10), shape: 'open', dir: -84 }),
        ...armFields(other(near), { arm: reach([CHEST[0] + 22, CHEST[1] + 14]), shape: 'fist', dir: 150 }),
        lean: near === 'left' ? -4 : 4, frown: 0.6, smile: 0.6,
      }],
      ...settle(hold)];
    },
    /** A hand cupped behind an ear. */
    listen: ({ hold = 1.2, side = 'right' }) => [
      [-0.2, 0.4, { ...armFields(side, { arm: reach([104, 50]), shape: 'open', dir: -100 }), brow: 1, tilt: 6, look: side === 'right' ? 1 : -1 }],
      ...settle(hold, [side]),
    ],
    /** A hand over a yawn. */
    yawn: ({ hold = 1.4, side = 'right' }) => [
      // The palm up at the mouth, the elbow down: the eyes stay clear.
      [-0.2, 0.4, { ...armFields(side, { arm: reach([88, 94], { shorten: 1 - LIFT * 0.8 }), lift: 0.8, shape: 'flat', dir: -96 }), happy: 1, round: 1, tilt: -4 }],
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
        const arm = spec.to ? g.aim(side, spec.to).arm : spec.arm || (spec.reach ? reach(spec.reach, { shorten: 1 - LIFT * (spec.lift || 0) }) : REST[side]);
        Object.assign(fields, armFields(side, { arm, lift: spec.lift || 0, hand: spec.hand ?? 0, dir: spec.dir, shape: spec.shape }));
      }
      return [[-0.2, 0.4, fields], ...(hold === Infinity ? [] : settle(hold, Object.keys(fields).filter((k) => k === 'right' || k === 'left')))];
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
   *   hero      a promise of SongStudentAvatar's heroHead (teammates); it
   *             resolves to null on export stages, and the drawn face stays
   *   stage     [[from, to, { enter, exit }]]: when it is on stage;
   *             'left' / 'right' glide in from (or out to) that wing,
   *             'fade' (the default) fades
   *   places    [[time, x, y, scale, duration]]: where its feet stand
   *             (x is its centre); it walks there over `duration` seconds
   *   moves     [[time, name, options]] from MOVES
   *   holds     [[time, side, prop]]: a prop in a hand from then on (null
   *             empties it)
   *   words     [start, end] sung word intervals (wordsFor)
   *   beds      [[from, to]]: a bed appears behind it just before `from`;
   *             it lies down in it, mask on, under the quilt, until `to`
   *             (or its stage exit, when the bed glides off with it)
   * Returns the wrapper and where() (its place at a time).
   */
  function figure(parent, { role, hero, stage = [], places, moves = [], holds = [], words = [], beds = [], seed = 0 }) {
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
    const body = buildFigure(fig, sway, role);
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
    const sortedPlaces = [...places].sort((a, b) => a[0] - b[0]);
    function where(t) {
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
        side: (to) => (to[0] < left + 80 * scale ? 'left' : 'right'),
        // Points the arm on `side` at a stage point: within reach the
        // fingertip touches it, further off the whole arm points.
        aim: (side, to) => {
          const [fx, fy] = toFigure(to, side);
          const distance = Math.hypot(fx - SHOULDER[0], fy - SHOULDER[1]);
          const along = degrees(Math.atan2(fy - SHOULDER[1], fx - SHOULDER[0]));
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
          return outstretched(degrees(Math.atan2(fy - SHOULDER[1], fx - SHOULDER[0])), bend);
        },
      };
    };
    const gestures = moves
      .map(([time, name, options = {}]) => {
        if (!MOVES[name]) throw new Error(`opera-cast.js has no move "${name}".`);
        const own = MOVES[name](options, geometry(time)).map(([delay, duration, fields]) => [time + delay, duration, fields]);
        return { time, start: Math.min(...own.map(([at]) => at)), keys: own };
      })
      .sort((a, b) => a.time - b.time);
    // A gesture's return to rest puts back only what that gesture moved,
    // and gives way to a later gesture that has already taken the same
    // part: a long hold never snaps an arm or a face out of the next pose.
    const posed = gestures.map(({ keys: own }) => new Set(own.filter(([, , fields]) => !RESTS.has(fields)).flatMap(([, , fields]) => Object.keys(fields))));
    const keys = gestures
      .flatMap(({ keys: own }, i) => own.flatMap(([at, duration, fields]) => {
        if (!RESTS.has(fields)) return [[at, duration, fields]];
        const kept = Object.entries(fields).filter(([name]) => posed[i].has(name)
          && !gestures.some((next, j) => j > i && next.start <= at && posed[j].has(name)));
        return kept.length ? [[at, duration, Object.fromEntries(kept)]] : [];
      }))
      .sort((a, b) => a[0] - b[0]);
    const holdKeys = [...holds].sort((a, b) => a[0] - b[0]);
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
      // At ease: a slow, uneven shift of weight and a breath.
      const shift = (reduced ? 0 : 0.5 * Math.sin(t * 0.9 + seed) + 0.25 * Math.sin(t * 2.1 + 0.7 + seed)) + p.lean + lean;
      const breath = reduced ? 1 : 1 + 0.004 * Math.sin(t * 1.6 + seed);
      travel.setAttribute('transform', `translate(${(glide / scale).toFixed(2)} ${bob.toFixed(2)})`);
      hopper.setAttribute('transform', `translate(0 ${(-p.hop).toFixed(2)})`);
      sway.setAttribute('transform', `rotate(${shift.toFixed(2)} 80 290) translate(80 290) scale(1 ${breath.toFixed(4)}) translate(-80 -290)`);
      shadow.setAttribute('transform', `translate(80 293) scale(${(1 - p.hop / 60).toFixed(3)}) translate(-80 -293)`);
      shadow.setAttribute('opacity', (1 - bed.lie).toFixed(3));
      recline.setAttribute('transform', bed.lie ? `translate(0 ${(LIE_SINK * bed.lie).toFixed(2)}) rotate(${(-90 * bed.lie).toFixed(2)} ${LIE_PIVOT[0]} ${LIE_PIVOT[1]})` : '');
      body.swing(stride * Math.sin(phase) * 9);
      p.crouch = Math.max(p.crouch, settleKnees);
      const open = mouthAt(sortedWords, t, reduced);
      body.pose(p, t, open, reduced ? 0 : blinkAt(t, seed));
      body.level();
    });
    return { node: wrap, where };
  }

  window.OperaCast = {
    HANDS, HEAD, SHOULDER, ELBOW, WRIST, MIRROR, REST, TEAMMATE_HEAD, TOP, TOP_SHADE, TOP_LIGHT, NECK, NECK_SHADE, LEGS, LEG_DETAIL, FEET,
    SLEEVE, SLEEVE_FOLDS, FORE_SLEEVE, FORE_SLEEVE_FOLDS, CUFF, FOREARM, FOREARM_DETAIL, PUSHED, PUSHED_FOLDS, TENOR_HEAD,
    reach, outstretched, handToward, poseAt, drawHandParts, rotate, raise, aroundZero, degrees, mouthShape,
    buildFigure, blinkAt, COSTUMES, PROPS, MOVES, figure, wordsFor, mouthAt,
  };
})();
