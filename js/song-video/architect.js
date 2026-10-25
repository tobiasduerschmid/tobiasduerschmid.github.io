/*
 * The architect of "Draw It Out While It's Cheap to Change": the viewer's
 * own SE Gym hero (SongStudentAvatar's heroHead), dressed for the drafting
 * room in a white shirt buttoned to the collar with its sleeves rolled
 * below the elbows, a camel knit vest, straight charcoal trousers, and
 * cognac derby shoes, a giant yellow pencil in one hand and a rolled
 * drawing in the other. Build and clothes are unisex, so any hero's face
 * fits them:
 * shoulders little wider than the hips, no waist shaping, and a pullover
 * vest with ribbed edges rather than a tailored one. Like Agent 00 in
 * the information-hiding song, the architect steps into scenes and works
 * with what is on screen: points at a part, taps it, ticks it off, crosses
 * it out, circles it, traces it, leans in to inspect it, sizes it up at
 * arm's length, or thinks a question through, pencil to chin.
 *
 * The figure is drawn in a 160×300 box, standing at ease with its weight on
 * the picture's left leg, lit from the upper left. Layers, back to front:
 * shoes and trousers; the shirt; the vest; each sleeve with the vest's
 * armhole again over its root while the arm hangs (it gives way when the
 * arm comes across the body); the collar, the neck, and the face; an upper
 * arm swung across the body; then the forearms and hands, an arm across
 * the body in front of the other, each hand in front of its forearm, so a
 * hand can come up to the chin. The hands are in proportion, about three
 * quarters as long as the forearm, and turn at the wrist only as far as a
 * wrist can (WRIST_RANGE). The pencil hand is seen from the thumb's side,
 * the pencil in a writing grip, in front of the forearm; the other is a
 * fist seen from its back, where the wristwatch is, round a roll that
 * passes behind its forearm. A hero's head goes where the drawn one is
 * (HEAD). Export stages never load the avatar renderer, so there the drawn
 * head stays.
 *
 * `flip` moves the pencil to the picture's left hand and the roll to its
 * right; the figure and its light stay as drawn. Every pose is a pure
 * function of song time. Under reduced motion the architect fades in and
 * out, holds still between moves, and each move snaps to its pose.
 * Coordinates are CSS pixels on the 960×540 stage.
 * Styles: css/song-video-architect.css.
 */
(function () {
  'use strict';

  const { fx, onFrame, onDispose, progress, easeInOutCubic } = window.Timeline;
  const { el, svg, place } = window.SongKit;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let uid = 0;

  // ------------------------------------------------------------------
  // Proportions and arm geometry (figure units; the picture's right arm,
  // which the left arm mirrors)
  // ------------------------------------------------------------------

  // The head, worn or drawn: centred on x, its chin at chin, its face this
  // wide. EYES is the height of its eyes, for glances.
  const HEAD = { x: 80, chin: 72, width: 34 };
  const EYES = 50;
  const SHOULDER = [104.2, 94.6];
  const ELBOW = [109, 138.4];
  const WRIST = [110.6, 172.4];
  const UPPER = Math.hypot(ELBOW[0] - SHOULDER[0], ELBOW[1] - SHOULDER[1]);
  // How short the upper arm looks when it comes fully forward, towards the
  // viewer, as when a hand comes up to the chin with the elbow at the side.
  const LIFT = 0.3;
  const degrees = (radians) => radians * 180 / Math.PI;
  const radians = (angle) => angle * Math.PI / 180;
  /** (x, y) turned `angle` degrees clockwise (SVG's sense) about the origin. */
  const rotate = ([x, y], angle) => {
    const [c, s] = [Math.cos(radians(angle)), Math.sin(radians(angle))];
    return [x * c - y * s, x * s + y * c];
  };
  const UPPER_REST = degrees(Math.atan2(ELBOW[1] - SHOULDER[1], ELBOW[0] - SHOULDER[0]));

  // The hands, each in its own frame: the wrist at (0, 0) and the fingers
  // down, so a hand's turn at the wrist (penHand, rollHand) is a rotation
  // of that frame, clockwise in degrees. The pencil hand is seen from the
  // thumb's side, its forearm turned palm in, as an arm hangs and points:
  // its back towards +x, its palm towards −x, so a positive turn bends the
  // wrist towards the palm. The roll hand is a fist seen from its back,
  // where the wristwatch is: its thumb towards −x, so a positive turn bends
  // the wrist towards the thumb.
  const WRIST_RANGE = { pen: [-60, 70], roll: [-30, 22] };
  // A giant pencil, PENCIL_RADIUS thick, in a writing grip: pinched at
  // PINCH, under the index finger's pad with the thumb's over it, it leans
  // PENCIL_ANGLE (SVG degrees in the hand's frame) towards the palm, its
  // tip PENCIL_TIP ahead of the pinch and its eraser PENCIL_BACK behind,
  // out past the back of the hand: as long as it can be and still clear
  // the head when the arm points.
  const PINCH = [-4.28, 18.57];
  const PENCIL_ANGLE = 130;
  const PENCIL_RADIUS = 2;
  const PENCIL_TIP = 13;
  const PENCIL_BACK = 66;
  const TIP_IN_HAND = [PINCH[0] + PENCIL_TIP * Math.cos(radians(PENCIL_ANGLE)), PINCH[1] + PENCIL_TIP * Math.sin(radians(PENCIL_ANGLE))];
  // The rolled drawing lies through the fist at ROLL_AT, behind the
  // fingers, its long end out past the little finger at ROLL_ANGLE, a
  // little towards the fingertips, as a roll held near one end hangs.
  const ROLL_AT = [0.6, 12.2];
  const ROLL_ANGLE = 18;
  /** Where a point of the hand's frame is on the forearm at rest, the hand turned `hand` degrees. */
  const onForearm = (point, hand) => {
    const [x, y] = rotate(point, hand);
    return [WRIST[0] + x, WRIST[1] + y];
  };
  // Pointing at something within reach, the wrist bends back a little and
  // the pencil's tip goes to it (aimPencil).
  const POINT_HAND = -14;
  const POINT_TIP = onForearm(TIP_IN_HAND, POINT_HAND);
  const FORE = Math.hypot(POINT_TIP[0] - ELBOW[0], POINT_TIP[1] - ELBOW[1]);
  const FOREARM_REST = degrees(Math.atan2(WRIST[1] - ELBOW[1], WRIST[0] - ELBOW[0]));
  // How far from the shoulder a gesture in the air is drawn, within reach.
  const GESTURE_REACH = UPPER + FORE - 10;
  const MIRROR = 'translate(160 0) scale(-1 1)';
  // The trousers foreshorten between their waist and their hems when the
  // knees give.
  const WAIST = 150;
  const HEMS = 286;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  /** How far (degrees, counter-clockwise) a segment hanging at `rest` turns to point along `dir`. */
  const raise = (rest, dir) => ((rest - dir + 540) % 360) - 180;

  /**
   * The [upper, forearm] raise that puts `end` (a point carried by the
   * forearm at rest: the pencil's tip while pointing, or the wrist) at
   * (x, y) (two-bone inverse kinematics), the elbow down and out at the
   * side, as a person holds an arm. `shorten` is how much of its length the
   * upper arm shows (1 when it hangs in the picture's plane). Out of reach,
   * the arm points at the target.
   */
  function reach([x, y], { shorten = 1, end = POINT_TIP } = {}) {
    const upper = UPPER * shorten;
    const fore = Math.hypot(end[0] - ELBOW[0], end[1] - ELBOW[1]);
    const foreRest = degrees(Math.atan2(end[1] - ELBOW[1], end[0] - ELBOW[0]));
    const dx = x - SHOULDER[0], dy = y - SHOULDER[1];
    const distance = Math.hypot(dx, dy);
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

  /**
   * The pencil arm held out along `along` (SVG degrees), the upper arm
   * `bend` degrees below that line and the forearm a quarter of that
   * above it, the wrist bent back so the pencil leads along it: as
   * { pen, penHand }.
   */
  function holdOutPencil(along, bend) {
    const pen = [raise(UPPER_REST, along + bend), raise(FOREARM_REST, along - bend / 4)];
    return { pen, penHand: handToward(pen, along) };
  }

  /**
   * The pencil arm's pose ({ pen, penHand }) for pointing at (x, y): within
   * reach, the pencil's tip touches it, the wrist bent back by POINT_HAND;
   * further off, the whole arm points at it, the elbow a little low.
   */
  function aimPencil([x, y]) {
    if (Math.hypot(x - SHOULDER[0], y - SHOULDER[1]) < UPPER + FORE - 4) return { pen: reach([x, y]), penHand: POINT_HAND };
    return holdOutPencil(degrees(Math.atan2(y - SHOULDER[1], x - SHOULDER[0])), 12);
  }

  // ------------------------------------------------------------------
  // Poses and moves
  // ------------------------------------------------------------------

  /**
   * At rest: the arms hang easy, the pencil held low by the thigh, its tip
   * towards it and its eraser up beside the elbow, and the rolled drawing
   * in the other hand, leaning out and down.
   *   pen, roll      [upper, forearm] raise in degrees (0 hangs, 180 is up)
   *   penLift,
   *   rollLift       0–1, how far the upper arm comes forward (LIFT)
   *   penHand,
   *   rollHand       degrees each hand turns at the wrist (clockwise), within
   *                  WRIST_RANGE
   *   look, down     the eyes' glance in picture space: −1 … 1 left … right,
   *                  and down (negative looks up)
   *   brow           0–1, a brow raised
   *   nod, tilt      0–1 head dip; head tilt in degrees
   *   crouch         0–1, a small give at the knees
   *   lean           degrees the whole figure leans about its feet
   */
  const REST = {
    pen: [3, -8], penLift: 0, penHand: -12,
    roll: [3, -6], rollLift: 0, rollHand: 6,
    look: 0, down: 0, brow: 0, nod: 0, tilt: 0, crouch: 0, lean: 0,
  };
  const ARMS_AT_REST = { pen: REST.pen, penLift: 0, penHand: REST.penHand };
  const EYES_AT_REST = { look: 0, down: 0, brow: 0, tilt: 0, lean: 0 };

  /** An angle as the turn of at most half a circle either way that it amounts to. */
  const aroundZero = (angle) => ((angle % 360) + 540) % 360 - 180;
  /**
   * The pencil hand's turn at the wrist that points the pencil along `dir`
   * (SVG degrees in the arm's own frame: −90 is up), on an arm posed at
   * [upper, forearm].
   */
  const handToward = ([, fore], dir) => aroundZero(dir - PENCIL_ANGLE + fore);
  /** The same for the roll hand: points the roll's long end along `dir`. */
  const rollToward = ([, fore], dir) => aroundZero(dir - ROLL_ANGLE + fore);

  /**
   * The pencil arm's pose that holds the pencil's tip at (x, y), pointing
   * along `dir` (SVG degrees), the upper arm come forward by `lift` (LIFT):
   * the wrist goes where the hand, turned so the pencil runs along `dir`,
   * puts the tip on the point.
   */
  function holdPencilAt([x, y], dir, lift) {
    const [tx, ty] = rotate(TIP_IN_HAND, dir - PENCIL_ANGLE);
    const pen = reach([x - tx, y - ty], { shorten: 1 - LIFT * lift, end: WRIST });
    return { pen, penLift: lift, penHand: handToward(pen, dir) };
  }

  // Thinking: the elbow out at the side, the upper arm come forward, the
  // hand up at the chest, and the pencil's tip under the chin, its eraser
  // down by the waist; the eyes go up and to the side.
  const THINK = holdPencilAt([HEAD.x + 0.6, HEAD.chin + 1.2], -106, 1);
  // Presenting the drawing: the elbow at the side, the forearm out and a
  // little up, and the roll held upright in the fist, the back of the hand
  // to the viewer.
  const PRESENT_ARM = reach([142, 125], { end: WRIST });
  const PRESENT = { roll: PRESENT_ARM, rollLift: 0, rollHand: rollToward(PRESENT_ARM, -90) };
  const ROLL_AT_REST = { roll: REST.roll, rollLift: 0, rollHand: REST.rollHand };

  /** Keys that end a gesture: the pencil arm, then the eyes, back at rest. */
  const settle = (at) => [[at, 0.55, ARMS_AT_REST], [at + 0.1, 0.4, EYES_AT_REST]];

  /**
   * The moves, as keys [delay, duration, fields] from the moment each is
   * cued; `g` (architect) turns stage points into arm poses and glances.
   * Arms set off a little before the cue, so a hand arrives on the word.
   * Gestures in the air (tap, check, cross, circle) are drawn within the
   * pencil's reach on the way to their stage point. Each pencil arm pose
   * comes with the hand's turn at the wrist that it was aimed with.
   */
  const MOVES = {
    point: ({ to, hold = 1.3 }, g) => [
      [-0.2, 0.5, { ...g.aim(to), penLift: 0 }], [-0.05, 0.35, g.glance(to)], ...settle(hold),
    ],
    // Pecks the pencil at a point, "this one".
    tap: ({ to, times = 3, hold = 0.7 }, g) => {
      const near = g.tip(to), off = g.tip(to, [0, 0], -6);
      const pecks = Array.from({ length: times * 2 }, (_, i) => [0.25 + i * 0.12, 0.12, i % 2 ? near : off]);
      return [[-0.2, 0.45, { ...near, penLift: 0 }], [-0.05, 0.35, g.glance(to)], ...pecks, ...settle(0.25 + times * 0.24 + hold)];
    },
    // Ticks a point off in the air: a short stroke down, a long one up.
    check: ({ to, size = 16, hold = 0.7 }, g) => {
      const [start, low, end] = [[-0.45, -0.1], [-0.12, 0.34], [0.5, -0.5]].map(([dx, dy]) => g.tip(to, [dx * size, dy * size]));
      return [
        [-0.25, 0.4, { ...start, penLift: 0 }], [-0.1, 0.35, g.glance(to)],
        [0.15, 0.12, low], [0.27, 0.2, end], ...settle(0.47 + hold),
      ];
    },
    // Crosses a point out in the air: two strokes.
    cross: ({ to, size = 16, hold = 0.6 }, g) => {
      const [a, b, c, d] = [[-0.5, -0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, 0.5]].map(([dx, dy]) => g.tip(to, [dx * size, dy * size]));
      return [
        [-0.25, 0.4, { ...a, penLift: 0 }], [-0.1, 0.35, g.glance(to)],
        [0.15, 0.16, b], [0.33, 0.12, c], [0.47, 0.16, d], ...settle(0.63 + hold),
      ];
    },
    // Rings a point in the air once.
    circle: ({ to, rx = 12, ry = 8, hold = 0.5 }, g) => {
      const ring = Array.from({ length: 9 }, (_, i) => {
        const a = -Math.PI / 2 - i * Math.PI / 4;
        return g.tip(to, [rx * Math.cos(a), ry * Math.sin(a)]);
      });
      return [
        [-0.25, 0.4, { ...ring[0], penLift: 0 }], [-0.1, 0.35, g.glance(to)],
        ...ring.slice(1).map((aimed, i) => [0.15 + i * 0.09, 0.09, aimed]), ...settle(0.87 + hold),
      ];
    },
    // Follows a route of stage points with the pencil, as a message travels.
    trace: ({ route, step = 0.18, hold = 0.5 }, g) => {
      const pens = route.map((point) => g.aim(point));
      return [
        [-0.25, 0.4, { ...pens[0], penLift: 0 }], [-0.1, 0.35, g.glance(route[Math.floor(route.length / 2)])],
        ...pens.slice(1).map((aimed, i) => [0.15 + i * step, step, aimed]), ...settle(0.15 + (pens.length - 1) * step + hold),
      ];
    },
    // Leans in towards a point to look it over, pencil to chin.
    inspect: ({ to, hold = 1.2 }, g) => {
      const side = g.side(to);
      return [
        [0, 0.5, { ...g.glance(to), lean: 3.4 * side, tilt: 3 * side, brow: 0.5 }], [-0.1, 0.55, THINK],
        ...settle(hold),
      ];
    },
    // Sizes a drawing up: the arm straight out towards it, the pencil at
    // arm's length, the head tipped.
    sight: ({ to, hold = 1.1 }, g) => [
      [-0.2, 0.5, { ...g.straight(to), penLift: 0 }], [-0.05, 0.35, { ...g.glance(to), tilt: -4 * g.side(to) }],
      ...settle(hold),
    ],
    think: ({ hold = 1.6 }) => [
      [-0.25, 0.6, THINK], [0.05, 0.4, { look: -0.45, down: -0.7, brow: 0.6, tilt: -3 }],
      [hold, 0.55, ARMS_AT_REST], [hold, 0.4, EYES_AT_REST],
    ],
    aha: () => [[0, 0.16, { brow: 1, look: 0, down: 0 }], [0.05, 0.2, { nod: 1, crouch: 0.6 }], [0.3, 0.3, { nod: 0, crouch: 0 }], [0.6, 0.4, { brow: 0 }]],
    nod: () => [[0, 0.22, { nod: 1 }], [0.26, 0.3, { nod: 0 }]],
    bow: () => [[0, 0.3, { nod: 1, crouch: 0.9, brow: 0.4 }], [0.55, 0.45, { nod: 0, crouch: 0, brow: 0 }]],
    present: ({ hold = 1.4 }) => [[-0.2, 0.55, PRESENT], [hold, 0.55, ROLL_AT_REST]],
    // Sketching in the air towards a stage point: the pencil scribbles at
    // the wrist for `duration` seconds.
    sketch: ({ to, duration = 1.2 }, g) => {
      const aimed = g.aim(to);
      const strokes = Array.from({ length: Math.max(2, Math.round(duration / 0.2)) }, (_, i) => [0.3 + i * 0.2, 0.18, { penHand: aimed.penHand + (i % 2 ? -10 : 10) }]);
      return [[-0.2, 0.5, { ...aimed, penLift: 0 }], [0, 0.35, g.glance(to)], ...strokes, ...settle(0.3 + duration)];
    },
  };

  /**
   * The pose at song time t: each key eases its fields from wherever they
   * are when it starts to its values, in cue order. Under reduced motion
   * every key snaps to its pose.
   */
  function poseAt(keys, t, reduced) {
    const pose = { ...REST };
    for (const [start, duration, fields] of keys) {
      if (t < start) break;
      const u = reduced ? 1 : easeInOutCubic(progress(t, start, duration));
      for (const [name, target] of Object.entries(fields)) {
        const from = pose[name];
        pose[name] = Array.isArray(target) ? target.map((value, i) => from[i] + (value - from[i]) * u) : from + (target - from) * u;
      }
    }
    return pose;
  }

  // ------------------------------------------------------------------
  // The artwork, as [class, path, paint] parts (paint names a gradient of
  // the figure's own) drawn in order
  // ------------------------------------------------------------------

  // Cognac leather derbies, toes turned out a little: the standing foot's
  // to the picture's left, the free foot's, set forward, to its right; each
  // heel goes back under its hem. Each: its ink; the sole, as the whole
  // shoe's shape under the upper, so it shows as a dark band along the
  // ground; the upper; its side turned from the light; the quarter's seam
  // where the lacing would end; the sole's lit edge; and the shine on the toe.
  const LEFT_SHOE = 'M79.4 283.8 C81.2 285 82.4 287.4 82.4 289.8 C82.4 291.6 81.8 292.8 80.4 293.1 C74.4 293.8 64.6 293.8 59 293.1 C56.6 292.8 55.4 291.4 55.8 289.6 C56.2 287.8 58.6 286.4 61.6 285.4 C63 284.9 64 284.4 64.8 283.8 Z';
  const RIGHT_SHOE = 'M88.8 286 C87.2 287.4 86.4 289.8 86.4 292 C86.4 293.8 87.2 295.2 88.8 295.6 C94.4 296.8 105.6 297 110.8 296.2 C113.2 295.8 114.4 294.2 113.8 292.4 C113 290.2 110 288.4 106 287.2 C105 286.9 104.2 286.6 103.4 286.2 Z';
  const SHOES = [
    [
      ['dio-arch-ink dio-arch-ink--leather', LEFT_SHOE],
      ['dio-arch-sole', LEFT_SHOE],
      ['dio-arch-shoe', 'M79.4 283.8 C81.2 285 82.4 287.4 82.4 289.8 C82.3 290.9 81.6 291.6 80.6 291.9 C74.6 292.5 65 292.5 59.6 291.9 C57.6 291.6 56.2 290.8 56 289.6 C56.2 287.8 58.6 286.4 61.6 285.4 C63 284.9 64 284.4 64.8 283.8 Z', 'leather'],
      ['dio-arch-shoe-turn', 'M79.4 283.8 C81.2 285 82.4 287.4 82.4 289.8 C82.3 290.9 81.6 291.6 80.6 291.9 C79.2 292 77.8 292.1 76.4 292.2 C77.8 289.6 78.2 286.6 77.4 284.2 Z'],
      ['dio-arch-shoe-seam', 'M71.4 285.9 C72.2 288 73.6 290.2 75.6 292.1'],
      ['dio-arch-welt', 'M56.4 290.6 C57.6 291.6 58.4 291.9 59.6 292.1 C65 292.8 74.6 292.8 80.6 292.1 C81.4 291.9 81.9 291.5 82.2 291'],
      ['dio-arch-shoe-shine', 'M57.6 289.2 C58.6 287.8 60.2 287 62.2 286.4'],
    ],
    [
      ['dio-arch-ink dio-arch-ink--leather', RIGHT_SHOE],
      ['dio-arch-sole', RIGHT_SHOE],
      ['dio-arch-shoe', 'M88.8 286 C87.2 287.4 86.4 289.8 86.4 291.8 C86.6 293 87.4 293.9 88.8 294.3 C94.4 295.4 105.4 295.6 110.6 294.8 C112.6 294.4 113.6 293.4 113.6 292.4 C113 290.2 110 288.4 106 287.2 C105 286.9 104.2 286.6 103.4 286.2 Z', 'leather'],
      ['dio-arch-shoe-turn', 'M113.6 292.4 C113.6 293.4 112.6 294.4 110.6 294.8 C108.4 295.2 105.8 295.4 103.2 295.5 C106.8 294 109.8 292.4 111.4 290.2 C112.6 290.8 113.4 291.6 113.6 292.4 Z'],
      ['dio-arch-shoe-seam', 'M96.6 288.4 C95.8 290.6 94.4 292.8 92.4 294.6'],
      ['dio-arch-welt', 'M86.8 293.2 C87.4 294 88 294.4 88.8 294.5 C94.4 295.6 105.4 295.8 110.6 295 C112 294.7 113 294.1 113.5 293.2'],
      ['dio-arch-shoe-shine', 'M105.4 288.4 C107.6 288.8 109.6 289.6 111 290.6'],
    ],
  ];

  // Straight charcoal trousers: the standing leg angled in under the body,
  // the free leg's knee come forward and in, its foot out. Their tops lie
  // under the vest.
  const LEGS = [
    'M80 150 L58.4 150 C57 155 56.4 161 56.4 167 C56.8 184 59.8 206 62.4 228 C62.8 236 63.2 250 63.8 262 C64.2 270 64.6 278 64.8 284.6 C69.4 286.2 75.2 286.2 79.6 284.4 C79.4 274 78.8 258 78.6 246 C78.4 238 78.6 232 79 226 C79.6 210 80 192 79.8 176 Z',
    'M80 151.4 L101 152.6 C102.6 156 103.6 161 103.6 168 C103.2 186 101 206 99.2 226 C98.8 232 99.2 240 99.8 248 C100.8 262 102.4 275 103.6 286.2 C99 288.2 93.2 288.4 88.6 286.6 C88 274 86.6 258 85.8 246 C85.2 238 84.8 232 84.6 226 C84 208 82.6 190 80.6 176.8 Z',
  ];
  // Light and form on the trousers: the shadow between the legs; each
  // leg's pressed crease, lit on one side; the folds where the free knee
  // bends; the soft break over each shoe; the slanted pockets; and blue
  // light from the sheet bounced onto the far side.
  const TROUSER_DETAIL = [
    ['dio-arch-trouser-shadow', 'M79.8 175.6 C80 192 79.6 210 79 226 C78 219 77.2 210 76.8 202 C77.4 193 77.8 185 78 176.6 Z'],
    ['dio-arch-trouser-shadow', 'M80.6 176.8 C82.6 190 84 208 84.6 226 C85.6 219 86.4 210 86.6 202 C85.6 193 84.4 185 83.4 177.6 Z'],
    ['dio-arch-crease-light', 'M69 154 C69.6 190 70.6 240 71.6 285.2'],
    ['dio-arch-crease', 'M69.8 154 C70.4 190 71.4 240 72.4 285.4'],
    ['dio-arch-crease-light', 'M91.2 156 C91.2 184 91 208 91.2 226 C91.6 248 93.4 268 95.4 287.6'],
    ['dio-arch-crease', 'M92 156 C92 184 91.8 208 92 226 C92.4 248 94.2 268 96.2 287.8'],
    ['dio-arch-fold-light', 'M85.6 216.6 C88.4 218.8 91.2 219.8 93.6 219.6 M89.4 232.8 C92 230.8 95.4 230.4 98.4 231.2'],
    ['dio-arch-fold', 'M85.4 218 C88.2 220.2 91.2 221.2 93.8 221 M89.6 234.2 C92.2 232.2 95.6 231.8 98.6 232.6'],
    ['dio-arch-fold-light', 'M65 277 C69 278.6 75 278.8 79.4 277.2'],
    ['dio-arch-fold', 'M64.8 278.2 C68.8 279.8 75 280 79.4 278.4'],
    ['dio-arch-fold-light', 'M88.2 279.4 C92.6 281.2 98.8 281.4 103.2 279.6'],
    ['dio-arch-fold', 'M88 280.6 C92.4 282.4 98.8 282.6 103.4 280.8'],
    ['dio-arch-pocket-light', 'M64.2 152.2 C62.8 157.2 61 162.2 59 165.8 M97.4 154.6 C99 159.4 101 163.8 103 167.2'],
    ['dio-arch-pocket', 'M63.4 152 C62 157 60.2 162 58.2 165.6 M96.6 154.4 C98.2 159.2 100.2 163.6 102.2 167'],
    ['dio-arch-bounce', 'M102.9 170 C102.6 186 100.4 206 98.6 226 M99.2 248 C100.2 262 101.8 275 102.9 284.4'],
  ];

  // The white shirt: its body, under the vest, its shoulders running into
  // the sleeves' heads; inside the vest's V, the vest's shadow, and the
  // button placket, lapped right over left, with two buttons.
  const SHIRT = 'M73.4 79 C76.4 77.8 83.6 77.8 86.6 79 C92.6 80.8 100.8 83.6 107.15 86.3 C111.4 92 111 102 103.2 110.4 C101.4 118 100.2 126 100.2 135.4 C100.2 143 101.4 149.6 102.4 154.8 L57.6 154.8 C58.6 149.6 59.8 143 59.8 135.4 C59.8 126 58.6 118 56.8 110.4 C49 102 48.6 92 52.85 86.3 C59.2 83.6 67.4 80.8 73.4 79 Z';
  const SHIRT_DETAIL = [
    ['dio-arch-v-shadow', 'M74.4 80.2 C76.2 90 77.6 100 78.8 110 M85.6 80.2 C84.4 90 82.4 100 79.2 110'],
    ['dio-arch-placket', 'M81.1 83.4 C81 92 80.8 101 80.5 110'],
  ];
  const SHIRT_BUTTONS = [90.4, 99.6];

  // The knit vest, pulled on over the head: shoulders that run to the
  // sleeves' heads, armholes cut in front of them, sides that fall straight
  // to a hem band at the hips, and a V neck.
  const VEST = 'M73.6 79.2 C67.4 80.6 58.5 84.3 52.85 86.3 C55 90.4 57.6 95.6 58.6 100.4 C59.2 103.4 58.6 107.4 56.8 110.4 C57.6 120 58.2 132 58.2 140 C58.2 146 57.8 152 57.6 157 C66 158.8 94 158.8 102.4 157 C102.2 152 101.8 146 101.8 140 C101.8 132 102.4 120 103.2 110.4 C101.4 107.4 100.8 103.4 101.4 100.4 C102.4 95.6 105 90.4 107.15 86.3 C101.5 84.3 92.8 80.6 86.4 79.2 C85.2 90 82.6 101 80 110.6 C77.4 101 74.8 90 73.6 79.2 Z';
  // Its form in the light: the far side turning away, the near side
  // turning gently.
  const VEST_FORM = [
    ['dio-arch-vest-form', 'M107.15 86.3 C105 90.4 102.4 95.6 101.4 100.4 C100.8 103.4 101.4 107.4 103.2 110.4 C102.4 120 101.8 132 101.8 140 C101.8 146 102.2 152 102.4 157 C99.6 157.6 96.8 158 94 158.2 C94.6 148 94.6 138 94.4 128 C94.2 118 95.6 106 98.6 98 C100.6 92.8 103.4 89 107.15 86.3 Z', 'vestFar'],
    ['dio-arch-vest-form', 'M52.85 86.3 C55 90.4 57.6 95.6 58.6 100.4 C59.2 103.4 58.6 107.4 56.8 110.4 C57.6 120 58.2 132 58.2 140 C58.2 146 57.8 152 57.6 157 C59.8 157.5 62.2 157.9 64.6 158.1 C65.2 148 65.4 138 65.2 128 C65 118 63.4 106 60.4 98 C58.4 93.2 55.8 89.4 52.85 86.3 Z', 'vestNear'],
  ];
  // Its ribbed edges (clipped to the vest): a band along each side of the
  // V, round each armhole, and at the hem, each striped across by its ribs
  // and bounded by a fine line where it meets the knit. Above the hem band
  // the knit blouses a little and casts a soft shadow.
  const VEST_RIBS = [
    ['dio-arch-rib-band', 'M72.4 79.4 C73.6 90.2 76.4 101.6 80 112.2 M87.6 79.4 C86.4 90.2 83.6 101.6 80 112.2 M54.2 85.8 C56.4 90 59 95.4 60 100.4 C60.6 103.6 60 107.8 58.2 111 M105.8 85.8 C103.6 90 101 95.4 100 100.4 C99.4 103.6 100 107.8 101.8 111'],
    ['dio-arch-rib', 'M72.4 79.4 C73.6 90.2 76.4 101.6 80 112.2 M87.6 79.4 C86.4 90.2 83.6 101.6 80 112.2 M54.2 85.8 C56.4 90 59 95.4 60 100.4 C60.6 103.6 60 107.8 58.2 111 M105.8 85.8 C103.6 90 101 95.4 100 100.4 C99.4 103.6 100 107.8 101.8 111'],
    ['dio-arch-rib-band dio-arch-rib-band--hem', 'M57 154.2 C66 155.8 94 155.8 103 154.2'],
    ['dio-arch-rib dio-arch-rib--hem', 'M57 154.2 C66 155.8 94 155.8 103 154.2'],
    ['dio-arch-rib-edge', 'M71.2 79.8 C72.4 90.6 75.2 102 80 113.8 C84.8 102 87.6 90.6 88.8 79.8 M55.6 85.3 C57.8 89.6 60.4 95.2 61.4 100.4 C62 103.8 61.4 108.2 59.6 111.6 M104.4 85.3 C102.2 89.6 99.6 95.2 98.6 100.4 C98 103.8 98.6 108.2 100.4 111.6 M57.2 151.4 C66 153 94 153 102.8 151.4'],
    ['dio-arch-blouse', 'M58 150.6 C66 152.2 94 152.2 102 150.6'],
  ];
  // Lamp light along its lit shoulder, and blue light from the sheet on
  // the far side.
  const VEST_LIGHT = [
    ['dio-arch-vest-rim', 'M72 79.8 C66 81.2 60 83.6 54.6 85.8'],
    ['dio-arch-bounce', 'M102.4 113 C101.8 121 101.4 131 101.4 140 C101.4 145 101.6 149 102 151'],
  ];

  // Where the vest lies over a hanging arm's sleeve: the shoulder and the
  // armhole down to the underarm (the picture's right; the left is its
  // mirror).
  const ARMHOLE_FRONT = 'M94 72 H117 V110.4 H94 Z';

  // The collar's back, round the neck, behind it; its band in front,
  // buttoned at the throat; and its two points, laid over the vest, each
  // casting a soft shadow, stitched along their edges.
  const COLLAR_BACK = 'M72.4 80.4 C72 77 73.2 74.6 75.8 73.6 C78.6 72.8 81.4 72.8 84.2 73.6 C86.8 74.6 88 77 87.6 80.4 Z';
  const COLLAR_BAND = 'M72.8 75.6 C74.6 78.4 77 80 80 80.6 C83 80 85.4 78.4 87.2 75.6 L87.4 78.4 C85.6 81.2 83 82.8 80 83.4 C77 82.8 74.4 81.2 72.6 78.4 Z';
  const COLLAR_POINT = 'M86.8 74.4 C88.6 78.8 90.2 84.2 91.4 89.8 C88.2 88.4 85 85.6 82 81.6 C83.8 79.8 85.6 77.4 86.8 74.4 Z';
  const COLLAR_POINT_SHADOW = 'M91.4 89.8 C88.2 88.4 85 85.6 82 81.6 C82.4 83.2 83 84.6 83.8 85.8 C86.2 88.4 88.8 90.2 91.6 91.2 Z';
  const COLLAR_POINT_STITCH = 'M87.4 76.8 C88.8 80.6 89.8 84.4 90.4 88.2';

  // The arm (the picture's right): the sleeve from its round head, set in
  // the armhole, to the elbow, loose and lit from above; a long fold runs
  // from the underarm towards the elbow, and it gathers above the cuff.
  const ARM = {
    sleeve: 'M96.4 98.8 A8.8 8.8 0 1 1 113 94.8 C114.2 104 115.4 117 115.9 128 C116.1 132 116.1 135.6 116 138.4 A7 7 0 0 1 102 138.6 C102 129 102.6 118 103.2 110.4 C101.6 104.8 99.2 100.8 96.4 98.8 Z',
    // Shading strips, [outer side, inner side]: shadeLimb shows the shade
    // on the side away from the light and the light on the side towards it.
    sleeveShade: ['M113 94.8 C114.2 104 115.4 117 115.9 128 C116.1 132 116.1 135.6 116 138.4 L111 138.4 C111.2 129 111 116 108.8 97.6 C110.6 96.8 111.8 95.8 113 94.8 Z', 'M103.2 110.4 C102.6 118 102 129 102 138.6 L106.4 138.6 C106.4 129 106.8 119 107.6 110.8 Z'],
    sleeveLight: ['M113 95.6 C114.1 104 115.2 117 115.7 128 L113 128.2 C112.8 117 112 106 110.6 97.4 Z', 'M103.4 111.4 C102.8 118 102.4 128 102.2 137.4 L104.6 137.4 C104.8 128 105.2 119 105.8 112.2 Z'],
    sleeveDetail: [
      ['dio-arch-sleeve-fold', 'M104.4 112.6 C107.4 118.8 110.4 125 113.6 130.4 C110.4 126.8 107.2 122.6 103.9 117.4 Z'],
      ['dio-arch-sleeve-fold-light', 'M105 111.6 C108 117.6 111 123.8 114 129.2'],
      ['dio-arch-sleeve-drape', 'M111.6 101.4 C112.6 109 113 116 112.8 123'],
      ['dio-arch-sleeve-fold-light', 'M102.4 131.6 C105.8 129.8 111 130 115.2 132'],
      ['dio-arch-sleeve-fold', 'M102.2 132.8 C105.6 131 111 131.2 115.4 133.2 C111.4 132.2 106.4 132.2 102.4 133.8 Z'],
    ],
    // The bare forearm, below the cuff, tapering to the wrist, the muscle
    // full below the elbow on its outer side. It ends round the wrist's
    // pivot, so the hand turns on it without a seam.
    forearm: 'M102.8 147.4 C102.4 152 103.2 158 104.6 163.6 C105.4 166.8 106.2 170 106.8 172.4 A3.8 3.8 0 0 0 114.4 172.4 C114.8 170 115.2 166.8 115.4 163.6 C115.8 158.8 116.4 153.6 115.8 147.4 Z',
    skinShade: ['M115.8 147.4 C116.4 153.6 115.8 158.8 115.4 163.6 C115.2 166.8 114.8 170 114.4 172.8 L111.4 172.8 C112 165 112.6 156 112 147.4 Z', 'M102.8 147.4 C102.4 152 103.2 158 104.6 163.6 C105.4 166.8 106.2 170 106.8 172.8 L109.4 172.8 C108.6 165 107.4 156 106.8 147.4 Z'],
    skinLight: ['M115.6 149.2 C116 154 115.6 158.8 115.2 163 L113.6 163 C114 158.8 114.4 154 114 149.2 Z', 'M103.2 149.2 C103.2 153.6 103.8 158.2 105 162.8 L106.8 162.8 C105.8 158.2 105.2 153.6 105.2 149.2 Z'],
    forearmDetail: [
      ['dio-arch-cuff-shadow', 'M103.2 149.8 C106.8 151.2 111.4 151.2 115.4 149.6'],
      ['dio-arch-muscle', 'M114 151.4 C112.6 156.6 111.4 162.4 110.8 167.8'],
      ['dio-arch-wrist-crease', 'M107.2 171.6 C109.4 172.2 112 172.2 114.2 171.6'],
    ],
    // The sleeve rolled twice into a cuff below the elbow: the rolls, the
    // shadow between them, creases where they bunch at the sides, light on
    // their tops, and the sleeve's inside at the lower edge.
    cuff: 'M101.2 139 C105.6 137 112.4 137 116.8 139 C117.2 141.2 117.4 143.8 117 146.2 C116.6 147.4 116 148.2 115.4 148.6 C111.2 149.8 106.6 149.8 102.4 148.6 C101.8 148.2 101.2 147.4 101 146.2 C100.6 143.8 100.8 141.2 101.2 139 Z',
    cuffShade: ['M116.8 139 C117.2 141.2 117.4 143.8 117 146.2 C116.6 147.4 116 148.2 115.4 148.6 L112.6 149.2 C113.2 145.8 113.2 141.8 112.6 138.2 C114.2 138.3 115.6 138.6 116.8 139 Z', 'M101.2 139 C100.8 141.2 100.6 143.8 101 146.2 C101.2 147.4 101.8 148.2 102.4 148.6 L105.2 149.2 C104.6 145.8 104.6 141.8 105.2 138.2 C103.8 138.3 102.4 138.6 101.2 139 Z'],
    cuffDetail: [
      ['dio-arch-cuff-inside', 'M102.4 148.6 C106.6 149.8 111.2 149.8 115.4 148.6 C115 148 114.6 147.6 114.2 147.4 C110.6 148.2 107.2 148.2 103.6 147.4 C103.2 147.6 102.8 148 102.4 148.6 Z'],
      ['dio-arch-cuff-roll', 'M101 143.6 C105.8 145.2 112.2 145.2 117.2 143.6'],
      ['dio-arch-cuff-light', 'M102.4 139.4 C106.6 138 111.6 138 115.6 139.4 M101.8 145 C106.2 146.4 111.8 146.4 116.4 145'],
      ['dio-arch-cuff-crease', 'M101.8 140.4 C102.8 141.2 103 142.2 102.8 143.2 M116.2 140.4 C115.2 141.2 115 142.2 115.2 143.2 M101.6 145.4 C102.4 146.2 102.6 147 102.4 147.8'],
    ],
  };

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

  // The pencil hand, in a writing grip, seen from the thumb's side (its
  // back towards +x), in proportion: about 26 long from the wrist to the
  // middle finger's tip, its knuckles 12 below the wrist. Behind the
  // pencil: the middle finger, curled under it, its tip just out past the
  // pencil's near side; the hand, from the wrist to the index finger's
  // knuckle; and the index finger, arched over the pencil, its pad on it,
  // its nail seen edge on. In front: the thumb, its pad on the pencil just
  // short of the index finger's, its nail to the viewer.
  const PEN_HAND = {
    behind: [
      finger([[2.6, 11.6], [2.2, 13.6], [-0.4, 19], [-4.4, 20], [-7.1, 19.3]], [1.3, 1.3, 1.2, 1.1, 1], 1, [
        ['dio-arch-nail', 'M-6 20.5 C-6.6 20.55 -7.1 20.4 -7.45 20.1 C-6.9 20.15 -6.4 20.15 -5.95 20.1 Z'],
      ]),
      handPart(
        'M-3.75 -0.6 H3.75 C3.95 1.4 3.7 3 3.55 4.6 C3.4 6.8 3.6 8.8 4 10.4 C4.2 11.4 4.3 12.4 4 13.4 C3 14.6 1.4 14.8 -0.4 15.2 C-2.2 15.4 -3.6 14.6 -4.4 12.8 C-5 10.6 -5 7 -4.6 4.2 C-4.3 2.4 -3.95 1 -3.75 -0.6 Z',
        'M3.75 -0.6 C3.95 1.4 3.7 3 3.55 4.6 C3.4 6.8 3.6 8.8 4 10.4 M-4.6 4.2 C-4.3 2.4 -3.95 1 -3.75 -0.6',
        [
          ['dio-arch-hand-shade', 'M3.75 -0.6 C3.95 1.4 3.7 3 3.55 4.6 C3.4 6.8 3.6 8.8 4 10.4 C3.3 10.2 2.7 9.2 2.6 7.8 C2.4 5.8 2.5 3.6 2.7 1.8 C2.8 0.8 2.9 0 3 -0.6 Z'],
          ['dio-arch-tendon', 'M2.3 1.4 C2.1 4.4 2.3 7.4 2.8 10'],
        ],
      ),
      finger([[3, 9.6], [2.6, 12.3], [1.25, 17.73], [-1.11, 20.18], [-3.41, 21.4]], [1.4, 1.4, 1.25, 1.12, 1], 1, [
        ['dio-arch-knuckle-light', 'M4.1 11.2 C4.3 12 4.2 12.8 3.9 13.5 M2.7 17.2 C2.5 17.8 2.2 18.3 1.8 18.7'],
        ['dio-arch-finger-crease', 'M0.3 16.6 C0.6 17.1 0.6 17.6 0.4 18.1 M-1.8 18.9 C-1.6 19.3 -1.5 19.7 -1.6 20.1'],
        ['dio-arch-nail', 'M-1.9 21.62 C-2.7 22.08 -3.5 22.32 -4.1 22.12 C-3.5 21.9 -2.8 21.6 -2.2 21.2 Z'],
      ]),
    ],
    front: [
      finger([[-2.4, 2.6], [-4.9, 8.9], [-5.3, 12.6], [-4.55, 16.2]], [2.1, 1.75, 1.5, 1.35], -1, [
        ['dio-arch-thumb-crease', 'M-1.6 5.2 C-2.4 6.4 -3 7.8 -3.4 9.2 M-6.4 12.4 C-5.7 12.9 -4.7 12.9 -4 12.5'],
        ['dio-arch-nail', 'M-5.55 14.7 C-5.6 13.9 -5.1 13.5 -4.55 13.6 C-4 13.7 -3.75 14.3 -3.8 15.1 C-3.85 15.9 -4.25 16.5 -4.75 16.5 C-5.25 16.4 -5.55 15.6 -5.55 14.7 Z'],
        ['dio-arch-knuckle-light', 'M-6.6 7.4 C-6.8 8.6 -6.8 9.8 -6.6 11'],
      ], [1, 3]),
    ],
  };


  // The roll hand: a fist round the roll, seen from its back, the thumb
  // along its near side (−x): the back of the hand to its knuckles; the
  // thumb, wrapped round the roll, its nail edge on, its tip tucked behind
  // the index finger; and the four fingers bent away from the viewer round
  // the roll, each showing its first bone up to the knuckle at its middle
  // joint. The roll itself is behind the forearm (roll()).
  const curledFinger = (fill, ink, knuckle, crease) => handPart(fill, ink, [
    ['dio-arch-knuckle-light', knuckle],
    ['dio-arch-finger-crease', crease],
  ]);
  const ROLL_HAND = [
    handPart(
      'M-3.75 -0.6 H3.75 C4.1 1.6 4.6 4.6 5.1 7.6 C5.5 9.6 5.7 11 5.6 12.2 L5.6 13.6 L-5.4 13.6 C-5.5 12.2 -5.4 10.4 -5 8.4 C-4.6 6 -4.2 3.2 -3.75 -0.6 Z',
      'M3.75 -0.6 C4.1 1.6 4.6 4.6 5.1 7.6 C5.5 9.6 5.7 11 5.6 12.2 M-4.4 4.8 C-4.1 3 -3.9 1.4 -3.75 -0.6',
      [
        ['dio-arch-hand-shade', 'M3.75 -0.6 C4.1 1.6 4.6 4.6 5.1 7.6 C5.5 9.6 5.7 11 5.6 12.2 C5 12.4 4.4 12 4.1 11.2 C3.6 8.8 3.2 5.6 3 3 C2.9 1.6 2.9 0.4 3 -0.6 Z'],
        ['dio-arch-tendon', 'M-1.6 1.4 C-2.2 5 -2.8 8.6 -3.4 11.4 M-0.2 1.6 C-0.4 5.4 -0.8 9 -1 12 M1.2 1.6 C1.4 5.2 1.4 8.8 1.4 11.8 M2.6 1.4 C3 4.8 3.4 8 3.8 10.8'],
      ],
    ),
    finger([[-2.4, 2.2], [-5.9, 7.6], [-6.9, 12.2], [-5.6, 15.6]], [2, 1.7, 1.5, 1.35], -1, [
      ['dio-arch-knuckle-light', 'M-7.4 6.6 C-7.8 7.6 -7.9 8.6 -7.8 9.6'],
      ['dio-arch-nail', 'M-7.3 13.6 C-7.4 14.5 -7.1 15.6 -6.5 16 C-6.1 15.6 -6 14.6 -6.2 13.8 C-6.5 13.4 -7 13.4 -7.3 13.6 Z'],
    ], [1, 4]),
    curledFinger(
      'M2.85 11.4 C2.9 13.4 2.9 15.2 3.1 16.4 C3.3 17.2 4 17.5 4.7 17.2 C5.3 16.9 5.5 16 5.5 15 C5.5 13.6 5.4 12.4 5.25 11.2 Z',
      'M2.85 12.6 C2.9 13.4 2.9 15.2 3.1 16.4 C3.3 17.2 4 17.5 4.7 17.2 C5.3 16.9 5.5 16 5.5 15 C5.5 13.6 5.4 12.4 5.25 11.2',
      'M3.1 12.4 C3.6 11.7 4.6 11.6 5.1 12.2',
      'M3.2 15.6 C3.8 16 4.6 16 5.3 15.6',
    ),
    curledFinger(
      'M0.25 12 C0.2 14.2 0.3 16.4 0.5 17.8 C0.7 18.7 1.4 19 2.1 18.8 C2.7 18.6 2.95 17.9 2.95 16.8 C2.95 15 2.9 13.4 2.85 12 Z',
      'M0.25 13 C0.2 14.2 0.3 16.4 0.5 17.8 C0.7 18.7 1.4 19 2.1 18.8 C2.7 18.6 2.95 17.9 2.95 16.8 C2.95 15 2.9 13.4 2.85 13',
      'M0.5 13 C1.1 12.3 2.1 12.3 2.6 13',
      'M0.6 17.1 C1.2 17.5 2.1 17.5 2.8 17.1',
    ),
    curledFinger(
      'M-2.5 12.6 C-2.6 14.8 -2.5 17 -2.3 18.4 C-2.1 19.3 -1.4 19.6 -0.7 19.4 C-0.1 19.2 0.2 18.5 0.2 17.4 C0.2 15.6 0.2 14 0.2 12.6 Z',
      'M-2.5 13.4 C-2.6 14.8 -2.5 17 -2.3 18.4 C-2.1 19.3 -1.4 19.6 -0.7 19.4 C-0.1 19.2 0.2 18.5 0.2 17.4 C0.2 15.6 0.2 14 0.2 13.4',
      'M-2.2 13.5 C-1.6 12.8 -0.6 12.8 -0.1 13.5',
      'M-2.2 17.7 C-1.6 18.1 -0.7 18.1 0.1 17.7',
    ),
    curledFinger(
      'M-5.3 12 C-5.4 14 -5.4 16 -5.1 17.4 C-4.9 18.3 -4.2 18.6 -3.5 18.4 C-2.9 18.2 -2.55 17.5 -2.5 16.4 C-2.5 14.8 -2.5 13.4 -2.5 12 Z',
      'M-5.3 12 C-5.4 14 -5.4 16 -5.1 17.4 C-4.9 18.3 -4.2 18.6 -3.5 18.4 C-2.9 18.2 -2.55 17.5 -2.5 16.4 C-2.5 14.8 -2.5 13.4 -2.5 12.8',
      'M-5 12.8 C-4.4 12.1 -3.4 12.1 -2.8 12.8',
      'M-5 16.7 C-4.4 17.1 -3.5 17.1 -2.7 16.7',
    ),
  ];
  // Each hand's parts behind what it holds and in front of it. The pencil
  // passes in front of the forearm; the roll, in the palm of a fist seen
  // from its back, passes behind it.
  const HANDS = {
    pen: { behind: PEN_HAND.behind, front: PEN_HAND.front, heldBehindForearm: false },
    roll: { behind: ROLL_HAND, front: [], heldBehindForearm: true },
  };

  // The drawn head, for export stages, in its own units: its chin at
  // (80, 86), about 38 wide; placed at HEAD by scaling about the chin.
  const DRAWN_HEAD_CHIN = 86;
  const DRAWN_HEAD_WIDTH = 38;
  // The drawn neck under it, shaded by the jaw.
  const DRAWN_NECK = [
    ['dio-arch-drawn-skin', 'M74.2 64 C74.2 69.6 73.8 75 73.4 80.6 L86.6 80.6 C86.2 75 85.8 69.6 85.8 64 Z'],
    ['dio-arch-neck-shade', 'M74.2 70.4 C77.6 72.8 82.4 72.8 85.8 70.4 L85.9 73.6 C82.4 75.8 77.6 75.8 74.1 73.6 Z'],
    ['dio-arch-neck-line', 'M76 74.4 C77 76.4 78 78 79 79.6 M84 74.4 C83 76.4 82 78 81 79.6'],
  ];

  /** Draws [class, path, paint] parts into parent, in order. */
  function drawParts(parent, parts, paint) {
    return parts.map(([cls, d, fill]) => svg('path', { class: cls, d, ...(fill ? { fill: paint[fill] } : {}) }, parent));
  }

  /**
   * Draws a hand's parts into parent, in order, each part's ink under its
   * skin and then its details; the first part's skin carries `testid`.
   */
  function drawHand(parent, parts, paint, testid) {
    parts.forEach(({ fill, ink, details }, i) => {
      svg('path', { class: 'dio-arch-ink dio-arch-ink--fine', d: ink }, parent);
      const skin = svg('path', { class: 'dio-arch-skin', d: fill, fill: paint.skinHand }, parent);
      if (testid && i === 0) skin.dataset.testid = testid;
      drawParts(parent, details, paint);
    });
  }

  /**
   * Shows the strips on the side of a limb segment that faces away from the
   * upper-left light (shade) or towards it (light), the segment turned
   * `angle` degrees counter-clockwise from hanging, on an arm drawn mirrored
   * when `side` is -1. Each pair is [outer side, inner side].
   */
  function shadeLimb({ shade, light }, angle, side) {
    const a = angle * Math.PI / 180;
    const away = side * Math.cos(a) - Math.sin(a);
    shade[0].setAttribute('fill-opacity', clamp(away, 0, 1).toFixed(2));
    shade[1].setAttribute('fill-opacity', clamp(-away, 0, 1).toFixed(2));
    if (!light) return;
    light[0].setAttribute('fill-opacity', clamp(-away, 0, 1).toFixed(2));
    light[1].setAttribute('fill-opacity', clamp(away, 0, 1).toFixed(2));
  }

  /**
   * A giant drafting pencil, held in the writing grip at PINCH: a pink
   * eraser in a crimped steel ferrule, a long hexagonal barrel in UCLA Gold
   * (three facets in view, a shine down the lit one, stamped in gold near
   * the ferrule), and the sharpened wood and lead. Drawn along its own
   * length from the pinch, then laid in the hand at PENCIL_ANGLE.
   */
  function pencil(parent, paint) {
    const r = PENCIL_RADIUS, face = r / 3;
    const top = -PENCIL_BACK, ferrule = top + 5.2, barrel = ferrule + 5, sharpened = 2, lead = PENCIL_TIP - 2.8, tip = PENCIL_TIP;
    const [x, y] = [WRIST[0] + PINCH[0], WRIST[1] + PINCH[1]];
    const g = svg('g', { class: 'dio-arch-pencil', transform: `translate(${x} ${y}) rotate(${PENCIL_ANGLE - 90})` }, parent);
    const cap = `M${-r + 0.1} ${ferrule} V${top + 1.6} Q${-r + 0.1} ${top} 0 ${top} Q${r - 0.1} ${top} ${r - 0.1} ${top + 1.6} V${ferrule}`;
    svg('path', { class: 'dio-arch-ink dio-arch-ink--fine', d: `${cap} H${r + 0.15} V${barrel} H${r} V${sharpened} L0.5 ${lead} L0 ${tip} L-0.5 ${lead} L${-r} ${sharpened} V${barrel} H${-r - 0.15} V${ferrule} Z` }, g);
    svg('path', { class: 'dio-arch-eraser', d: `${cap} Z` }, g);
    svg('path', { class: 'dio-arch-eraser-light', d: `M-0.9 ${top + 2.6} V${top + 1.6} Q-0.8 ${top + 0.7} 0 ${top + 0.5}` }, g);
    svg('path', { class: 'dio-arch-ferrule', d: `M${-r - 0.15} ${ferrule - 0.2} H${r + 0.15} V${barrel} H${-r - 0.15} Z`, fill: paint.steel }, g);
    svg('path', { class: 'dio-arch-ferrule-crimp', d: [1.2, 2.2, 3.4].map((dy) => `M${-r - 0.15} ${ferrule + dy} H${r + 0.15}`).join(' ') }, g);
    svg('path', { class: 'dio-arch-ferrule-light', d: `M-1 ${ferrule + 0.4} V${barrel - 0.4}` }, g);
    svg('path', { class: 'dio-arch-pencil-light', d: `M${-r} ${barrel} H${-face} V${sharpened} H${-r} Z` }, g);
    svg('path', { class: 'dio-arch-pencil-face', d: `M${-face} ${barrel} H${face} V${sharpened} H${-face} Z`, 'data-testid': 'dio-arch-pencil-barrel' }, g);
    svg('path', { class: 'dio-arch-pencil-dark', d: `M${face} ${barrel} H${r} V${sharpened} H${face} Z` }, g);
    svg('path', { class: 'dio-arch-pencil-edge', d: `M${-face} ${barrel} V${sharpened} M${face} ${barrel} V${sharpened}` }, g);
    svg('path', { class: 'dio-arch-pencil-shine', d: `M-1.15 ${barrel + 1.6} V${sharpened - 4}` }, g);
    svg('path', { class: 'dio-arch-pencil-stamp', d: [5, 6.4, 7.8, 9.2].map((dy) => `M-0.28 ${barrel + dy} H0.28`).join(' ') }, g);
    // Sharpened: the paint ends in scallops where the blade cut it.
    svg('path', { class: 'dio-arch-pencil-wood', d: `M${-r} ${sharpened} Q-1.13 ${sharpened + 1.5} ${-face} ${sharpened} Q0 ${sharpened + 1.5} ${face} ${sharpened} Q1.13 ${sharpened + 1.5} ${r} ${sharpened} L0.5 ${lead} L-0.5 ${lead} Z` }, g);
    svg('path', { class: 'dio-arch-pencil-grain', d: `M-0.9 ${sharpened + 1.8} L-0.25 ${lead - 0.5} M0.9 ${sharpened + 1.8} L0.25 ${lead - 0.5}` }, g);
    svg('path', { class: 'dio-arch-pencil-lead', d: `M-0.5 ${lead} L0.5 ${lead} L0 ${tip} Z`, 'data-testid': 'dio-arch-pencil-tip' }, g);
    return g;
  }

  /**
   * A rolled drawing held near one end, through the fist at ROLL_AT: its
   * long part out past the little finger, its short end past the thumb.
   * The paper's back outside, the outer sheet's edge running along it, two
   * rubber bands, and at its far end the rolled layers of the blue print
   * round a hollow core. Drawn along its own length, then laid in the hand
   * at ROLL_ANGLE.
   */
  function roll(parent) {
    const [r, top, end] = [4.6, -13, 46];
    const [x, y] = [WRIST[0] + ROLL_AT[0], WRIST[1] + ROLL_AT[1]];
    const g = svg('g', { class: 'dio-arch-roll', transform: `translate(${x} ${y}) rotate(${ROLL_ANGLE - 90})` }, parent);
    const outline = `M${-r} ${top + 2.4} Q${-r} ${top} 0 ${top} Q${r} ${top} ${r} ${top + 2.4} V${end} A${r} 1.7 0 0 1 ${-r} ${end} Z`;
    svg('path', { class: 'dio-arch-ink dio-arch-ink--fine', d: outline }, g);
    svg('path', { class: 'dio-arch-roll-paper', d: outline }, g);
    // Laid across, its left side (here) is its underside.
    svg('path', { class: 'dio-arch-roll-shade', d: `M-2.2 ${top + 0.2} Q${-r} ${top + 0.6} ${-r} ${top + 2.4} V${end} A${r} 1.7 0 0 0 -2.2 ${end + 1.49} Z` }, g);
    svg('path', { class: 'dio-arch-roll-light', d: `M3.1 ${top + 2} V${end - 0.6}` }, g);
    svg('path', { class: 'dio-arch-roll-edge', d: `M1.6 ${top + 0.2} V${end + 1.6}` }, g);
    svg('path', { class: 'dio-arch-roll-band', d: [11, 35].map((b) => `M${-r} ${b} Q0 ${b + 1} ${r} ${b}`).join(' ') }, g);
    svg('path', { class: 'dio-arch-roll-band-light', d: [10.6, 34.6].map((b) => `M-0.2 ${b + 0.6} Q1.8 ${b + 0.6} ${r - 0.8} ${b}`).join(' ') }, g);
    svg('ellipse', { class: 'dio-arch-roll-end', cx: 0, cy: end, rx: r, ry: 1.7 }, g);
    for (const [rx, ry] of [[3.6, 1.3], [2.6, 0.95], [1.6, 0.6]]) svg('ellipse', { class: 'dio-arch-roll-layer', cx: 0, cy: end, rx, ry }, g);
    svg('ellipse', { class: 'dio-arch-roll-core', cx: 0, cy: end, rx: 0.8, ry: 0.3 }, g);
    return g;
  }

  /** A wristwatch above the wrist: a leather strap, a steel case, a cream dial at ten past ten. */
  function watch(parent, paint) {
    const [cx, cy] = [WRIST[0], WRIST[1] - 4.8];
    const g = svg('g', { class: 'dio-arch-watch', 'data-testid': 'dio-arch-watch' }, parent);
    svg('path', { class: 'dio-arch-watch-strap', d: `M${cx - 5.2} ${cy - 2.2} C${cx - 1.8} ${cy - 1.4} ${cx + 1.8} ${cy - 1.4} ${cx + 5} ${cy - 2.2} L${cx + 4.6} ${cy + 2} C${cx + 1.6} ${cy + 2.8} ${cx - 1.6} ${cy + 2.8} ${cx - 4.6} ${cy + 2} Z` }, g);
    svg('path', { class: 'dio-arch-watch-stitch', d: `M${cx - 4.8} ${cy - 1.2} C${cx - 1.6} ${cy - 0.5} ${cx + 1.6} ${cy - 0.5} ${cx + 4.6} ${cy - 1.2} M${cx - 4.6} ${cy + 1.1} C${cx - 1.6} ${cy + 1.8} ${cx + 1.6} ${cy + 1.8} ${cx + 4.4} ${cy + 1.1}` }, g);
    svg('circle', { class: 'dio-arch-watch-case', cx, cy, r: 2.3, fill: paint.steel }, g);
    svg('circle', { class: 'dio-arch-watch-dial', cx, cy, r: 1.75 }, g);
    svg('path', { class: 'dio-arch-watch-ticks', d: `M${cx} ${cy - 1.5} V${cy - 1.1} M${cx + 1.5} ${cy} H${cx + 1.1} M${cx} ${cy + 1.5} V${cy + 1.1} M${cx - 1.5} ${cy} H${cx - 1.1}` }, g);
    svg('path', { class: 'dio-arch-watch-hands', d: `M${cx} ${cy} L${cx - 0.9} ${cy - 0.6} M${cx} ${cy} L${cx + 1.1} ${cy - 0.8}` }, g);
    svg('path', { class: 'dio-arch-watch-glint', d: `M${cx - 1.2} ${cy - 1} Q${cx - 0.7} ${cy - 1.5} ${cx - 0.1} ${cy - 1.6}` }, g);
    return g;
  }

  /**
   * Draws the architect into `sway` and returns { pose, face, wear }.
   * pose(p) places every joint from a REST-shaped p; face(time, p, reduced)
   * moves the eyes; wear(head) swaps the drawn head and neck for a hero's.
   */
  function architectFigure(fig, sway, { flip }) {
    const defs = svg('defs', {}, fig);
    const id = (name) => `dio-arch-${name}-${++uid}`;
    const gradient = (kind, name, attrs, stops) => {
      const gid = id(name);
      const node = svg(kind, { id: gid, ...attrs }, defs);
      stops.forEach((offset, index) => svg('stop', { offset, class: `dio-arch-${name}-stop-${index}` }, node));
      return `url(#${gid})`;
    };
    const user = { gradientUnits: 'userSpaceOnUse' };
    // A strip along a limb's edge, opaque at the edge and fading inwards:
    // 'out' strips lie on the edge at the right of their box, 'in' strips
    // at its left. Their colours and opacities are set per tone in CSS.
    const strip = (tone, edge) => gradient('linearGradient', `${tone}-${edge}`, { x1: 0, y1: 0, x2: 1, y2: 0 }, ['0', '1']);
    const strips = (tone) => [strip(tone, 'out'), strip(tone, 'in')];
    // Cloth on the body is lit across the whole figure from the upper left;
    // limbs, which turn, are lit from above in their own frame, the forearm
    // and the hand by one gradient across the wrist, and shaded by their
    // strips.
    const skinStops = ['0', '0.55', '1'];
    const paint = {
      shirt: gradient('linearGradient', 'shirt', { ...user, x1: 60, y1: 78, x2: 100, y2: 150 }, ['0', '1']),
      sleeve: gradient('linearGradient', 'sleeve', { x1: 0, y1: 0, x2: 0, y2: 1 }, ['0', '1']),
      collar: gradient('linearGradient', 'collar', { ...user, x1: 0, y1: 74, x2: 0, y2: 90 }, ['0', '1']),
      vest: gradient('linearGradient', 'vest', { ...user, x1: 60, y1: 80, x2: 102, y2: 164 }, ['0', '0.32', '0.7', '1']),
      vestFar: gradient('linearGradient', 'vest-far', { ...user, x1: 93, y1: 0, x2: 103.4, y2: 0 }, ['0', '1']),
      vestNear: gradient('linearGradient', 'vest-near', { ...user, x1: 56.6, y1: 0, x2: 66.6, y2: 0 }, ['0', '1']),
      chestLight: gradient('radialGradient', 'chest-light', {}, ['0', '1']),
      trouserLeft: gradient('linearGradient', 'trouser', { ...user, x1: 56.4, y1: 0, x2: 80, y2: 0 }, ['0', '0.34', '0.74', '1']),
      trouserRight: gradient('linearGradient', 'trouser', { ...user, x1: 80.6, y1: 0, x2: 103.6, y2: 0 }, ['0', '0.34', '0.74', '1']),
      trouserFall: gradient('linearGradient', 'trouser-fall', { ...user, x1: 0, y1: 150, x2: 0, y2: 290 }, ['0', '1']),
      leather: gradient('linearGradient', 'leather', { x1: 0, y1: 0, x2: 0.3, y2: 1 }, ['0', '0.5', '1']),
      skin: gradient('linearGradient', 'skin', { ...user, x1: 0, y1: 146, x2: 0, y2: 194 }, skinStops),
      skinHand: gradient('linearGradient', 'skin', { ...user, x1: 0, y1: 146 - WRIST[1], x2: 0, y2: 194 - WRIST[1] }, skinStops),
      steel: gradient('linearGradient', 'steel', { x1: 0, y1: 0, x2: 0, y2: 1 }, ['0', '0.5', '1']),
      sleeveShade: strips('sleeve-shade'),
      sleeveLight: strips('sleeve-light'),
      skinShade: strips('skin-shade'),
      skinLight: strips('skin-light'),
    };

    // Shoes, then the trousers over their tops. The trousers foreshorten
    // about their hems when the knees give (pose), so the shoes stay put.
    const shoes = svg('g', {}, sway);
    for (const shoe of SHOES) drawParts(shoes, shoe, paint);
    const legs = svg('g', {}, sway);
    const trouserFills = [paint.trouserLeft, paint.trouserRight];
    for (const d of LEGS) svg('path', { class: 'dio-arch-ink dio-arch-ink--cool', d }, legs);
    LEGS.forEach((d, i) => svg('path', { class: 'dio-arch-trousers', d, fill: trouserFills[i] }, legs));
    for (const d of LEGS) svg('path', { class: 'dio-arch-trouser-fall', d, fill: paint.trouserFall }, legs);
    drawParts(legs, TROUSER_DETAIL, paint);

    // Everything above the hips drops with the knees.
    const trunk = svg('g', {}, sway);
    // The vest's hem shades the trousers below it.
    svg('path', { class: 'dio-arch-hem-shadow', d: 'M58.4 158.4 C66 160.4 94 160.4 101.6 158.4' }, trunk);
    const shirt = svg('g', {}, trunk);
    svg('path', { class: 'dio-arch-ink dio-arch-ink--cool', d: SHIRT }, shirt);
    svg('path', { class: 'dio-arch-shirt', d: SHIRT, fill: paint.shirt }, shirt);
    drawParts(shirt, SHIRT_DETAIL, paint);
    for (const by of SHIRT_BUTTONS) svg('circle', { class: 'dio-arch-shirt-button', cx: 80.2, cy: by, r: 0.8 }, shirt);

    const vestId = id('vest');
    const vest = svg('g', { id: vestId }, trunk);
    svg('path', { class: 'dio-arch-ink', d: VEST }, vest);
    svg('path', { class: 'dio-arch-vest', d: VEST, fill: paint.vest }, vest);
    drawParts(vest, VEST_FORM, paint);
    svg('ellipse', { class: 'dio-arch-chest-light', cx: 69, cy: 99, rx: 9.5, ry: 14, fill: paint.chestLight }, vest);
    const knit = svg('clipPath', { id: id('knit') }, defs);
    svg('path', { d: VEST }, knit);
    drawParts(svg('g', { 'clip-path': `url(#${knit.id})` }, vest), VEST_RIBS, paint);
    drawParts(vest, VEST_LIGHT, paint);

    // Each shoulder (a sleeve and the vest's armhole over it) hangs in
    // upperArms; swung in across the body, it moves up to crossingArms
    // (poseArm), in front of the other shoulder, the collar, and a beard or
    // hair that falls on the chest.
    const upperArms = svg('g', {}, trunk);
    const collarBack = svg('g', {}, trunk);
    const wornUnder = svg('g', {}, trunk);
    const drawnNeck = svg('g', {}, trunk);
    const collarFront = svg('g', { 'data-testid': 'dio-arch-collar' }, trunk);
    const drawnHead = svg('g', { 'data-testid': 'dio-arch-drawn-face' }, trunk);
    const wornOver = svg('g', {}, trunk);
    const crossingArms = svg('g', {}, trunk);
    const frontArms = svg('g', {}, trunk);

    // The collar: its back round the neck, then (over the neck) its band,
    // buttoned at the throat, and its points over the vest.
    svg('path', { class: 'dio-arch-ink dio-arch-ink--cool', d: COLLAR_BACK }, collarBack);
    svg('path', { class: 'dio-arch-collar-inside', d: COLLAR_BACK }, collarBack);
    svg('path', { class: 'dio-arch-ink dio-arch-ink--cool', d: COLLAR_BAND }, collarFront);
    svg('path', { class: 'dio-arch-collar', d: COLLAR_BAND, fill: paint.collar }, collarFront);
    svg('circle', { class: 'dio-arch-shirt-button', cx: 80, cy: 82, r: 0.75 }, collarFront);
    for (const side of [1, -1]) {
      const point = svg('g', { transform: side < 0 ? MIRROR : '' }, collarFront);
      svg('path', { class: 'dio-arch-collar-shadow', d: COLLAR_POINT_SHADOW }, point);
      svg('path', { class: 'dio-arch-ink dio-arch-ink--cool', d: COLLAR_POINT }, point);
      svg('path', { class: 'dio-arch-collar', d: COLLAR_POINT, fill: paint.collar }, point);
      svg('path', { class: 'dio-arch-collar-stitch', d: COLLAR_POINT_STITCH }, point);
    }

    // The drawn head, for export stages: a neck under the collar; then ears,
    // short side-swept hair with strands and a sheen, brows, eyes with
    // irises and catchlights under their lids, a nose, a smile, and a blush,
    // all scaled about the chin to HEAD.
    drawParts(drawnNeck, DRAWN_NECK, paint);
    const head = svg('g', {}, drawnHead);
    const headScale = HEAD.width / DRAWN_HEAD_WIDTH;
    const headArt = svg('g', { transform: `translate(${HEAD.x} ${HEAD.chin}) scale(${headScale.toFixed(4)}) translate(-80 ${-DRAWN_HEAD_CHIN})` }, head);
    for (const side of [1, -1]) {
      const ear = svg('g', { transform: side < 0 ? MIRROR : '' }, headArt);
      svg('path', { class: 'dio-arch-drawn-skin dio-arch-drawn-line', d: 'M99 61.2 Q105.2 59.8 105 66 Q104.8 71.8 98.4 71.8 Z' }, ear);
      svg('path', { class: 'dio-arch-drawn-ear', d: 'M100.4 63.4 Q103.2 63.2 103 66.4 Q102.6 68.8 100.2 69.2' }, ear);
    }
    svg('ellipse', { class: 'dio-arch-drawn-skin dio-arch-drawn-line', cx: 80, cy: 64, rx: 19, ry: 22 }, headArt);
    svg('path', { class: 'dio-arch-drawn-jaw-shade', d: 'M95.4 66 Q95 80.4 80 86 Q90.4 79 92 66.4 Z' }, headArt);
    svg('path', { class: 'dio-arch-drawn-hair', d: 'M60.2 61 Q57 37 78 34.4 Q99.4 34 101 55 Q100.6 59.4 99.4 62 Q97.6 49 87.4 46.6 Q80.6 51.8 69.4 50.4 Q63.4 53.8 60.2 61 Z' }, headArt);
    svg('path', { class: 'dio-arch-drawn-hair-strand', d: 'M65.4 53.6 Q69.4 46.4 77.6 44.6 M73.6 49.4 Q80.4 45.4 88.6 46.2 M88.8 43.4 Q95.4 45.4 98.8 52.4 M62.4 56.4 Q62.6 50.4 66.4 46' }, headArt);
    svg('path', { class: 'dio-arch-drawn-hair-sheen', d: 'M64 52 Q66.6 42.4 76 39.4 M84.6 38.6 Q92.6 40.4 96.4 46' }, headArt);
    const brows = ['M65.6 55.8 Q71 52.8 76.4 55.2', 'M83.6 55.2 Q89 52.8 94.4 55.8'].map((d) => svg('path', { class: 'dio-arch-drawn-brow', d }, headArt));
    const eyes = [71, 89].map((ex) => {
      const eye = svg('g', {}, headArt);
      svg('ellipse', { class: 'dio-arch-drawn-eye-white', cx: ex, cy: 62, rx: 3.4, ry: 2.7 }, eye);
      const iris = svg('g', {}, eye);
      svg('circle', { class: 'dio-arch-drawn-iris', cx: ex, cy: 62.2, r: 2 }, iris);
      svg('circle', { class: 'dio-arch-drawn-pupil', cx: ex, cy: 62.2, r: 1 }, iris);
      svg('circle', { class: 'dio-arch-drawn-catchlight', cx: ex + 0.7, cy: 61.4, r: 0.6 }, iris);
      svg('path', { class: 'dio-arch-drawn-lid', d: `M${ex - 3.6} 61.4 Q${ex} 58.4 ${ex + 3.6} 61.4` }, eye);
      return { iris };
    });
    svg('path', { class: 'dio-arch-drawn-nose', d: 'M81.2 64.4 Q78.6 69.4 80.6 70.6 Q82.6 71 83.2 70' }, headArt);
    svg('path', { class: 'dio-arch-drawn-mouth', d: 'M72.6 76.4 Q80.4 81.6 87.6 75.6' }, headArt);
    svg('path', { class: 'dio-arch-drawn-lip', d: 'M76.4 79.6 Q80.2 80.8 83.6 79.4' }, headArt);
    for (const cx of [68.6, 91.4]) svg('ellipse', { class: 'dio-arch-drawn-blush', cx, cy: 72, rx: 3.6, ry: 2 }, headArt);

    // Arms. The sleeve turns at the shoulder, behind the vest's armhole;
    // the forearm (cuff, skin, hand, and what it holds) turns with
    // it, then at the elbow, in front of everything, so a hand can reach the
    // chin. Every part's ink goes under its fill at twice the line width, so
    // each part keeps one outline.
    const armholeClip = (side) => {
      const clip = svg('clipPath', { id: id('armhole') }, defs);
      svg('path', { d: ARMHOLE_FRONT, transform: side < 0 ? MIRROR : '' }, clip);
      return `url(#${clip.id})`;
    };
    const arm = (side, kind) => {
      const mirrored = side < 0 ? MIRROR : '';
      const shoulder = svg('g', { 'data-testid': `dio-arch-${kind}-shoulder` }, upperArms);
      const upper = svg('g', {}, svg('g', { transform: mirrored }, shoulder));
      svg('path', { class: 'dio-arch-ink dio-arch-ink--cool', d: ARM.sleeve }, upper);
      svg('path', { class: 'dio-arch-sleeve', d: ARM.sleeve, fill: paint.sleeve }, upper);
      const upperShading = {
        shade: ARM.sleeveShade.map((d, i) => svg('path', { class: 'dio-arch-limb-strip', d, fill: paint.sleeveShade[i] }, upper)),
        light: ARM.sleeveLight.map((d, i) => svg('path', { class: 'dio-arch-limb-strip', d, fill: paint.sleeveLight[i] }, upper)),
      };
      drawParts(upper, ARM.sleeveDetail, paint);
      // The vest again over the sleeve's root, in the armhole.
      const armhole = svg('use', { href: `#${vestId}`, 'clip-path': armholeClip(side) }, shoulder);

      const reachRoot = svg('g', { transform: mirrored, 'data-testid': `dio-arch-${kind}-forearm` }, frontArms);
      const reachGroup = svg('g', {}, reachRoot);
      const fore = svg('g', {}, reachGroup);
      // What the hand holds behind the forearm turns with the hand.
      const gripBehind = svg('g', {}, fore);
      svg('path', { class: 'dio-arch-ink', d: ARM.forearm }, fore);
      svg('path', { class: 'dio-arch-skin', d: ARM.forearm, fill: paint.skin }, fore);
      const foreShading = {
        shade: ARM.skinShade.map((d, i) => svg('path', { class: 'dio-arch-limb-strip', d, fill: paint.skinShade[i] }, fore)),
        light: ARM.skinLight.map((d, i) => svg('path', { class: 'dio-arch-limb-strip', d, fill: paint.skinLight[i] }, fore)),
      };
      drawParts(fore, ARM.forearmDetail, paint);
      const wrist = svg('g', {}, fore);
      svg('path', { class: 'dio-arch-ink dio-arch-ink--cool', d: ARM.cuff }, fore);
      svg('path', { class: 'dio-arch-cuff', d: ARM.cuff, fill: paint.sleeve }, fore);
      const cuffShading = { shade: ARM.cuffShade.map((d, i) => svg('path', { class: 'dio-arch-limb-strip', d, fill: paint.sleeveShade[i] }, fore)) };
      drawParts(fore, ARM.cuffDetail, paint);
      // The hand turns at the wrist, with what it holds between the parts of
      // it behind and the fingers in front, or else behind the forearm.
      const grip = svg('g', {}, fore);
      const { behind, front, heldBehindForearm } = HANDS[kind];
      const layer = () => svg('g', { class: 'dio-arch-hand', transform: `translate(${WRIST[0]} ${WRIST[1]})` }, grip);
      drawHand(layer(), behind, paint, 'dio-arch-hand');
      const held = heldBehindForearm ? gripBehind : svg('g', {}, grip);
      drawHand(layer(), front, paint);
      return { side, shoulder, upper, upperShading, armhole, reach: reachGroup, reachRoot, fore, foreShading, cuffShading, wrist, grips: [gripBehind, grip], held, wristRange: WRIST_RANGE[kind] };
    };
    // The pencil is in the hand on the side the figure works towards.
    const right = arm(1, flip ? 'roll' : 'pen');
    const left = arm(-1, flip ? 'pen' : 'roll');
    const penArm = flip ? left : right;
    const rollArm = flip ? right : left;
    roll(rollArm.held);
    watch(rollArm.wrist, paint);
    pencil(penArm.held, paint);

    const turn = (angle, [cx, cy]) => `rotate(${angle.toFixed(2)} ${cx} ${cy})`;
    // The upper arm, shortened along its own length about the shoulder.
    const axis = UPPER_REST - 90;
    const shorten = (f) => `translate(${SHOULDER[0]} ${SHOULDER[1]}) rotate(${axis.toFixed(2)}) scale(1 ${f.toFixed(4)}) rotate(${(-axis).toFixed(2)}) translate(${-SHOULDER[0]} ${-SHOULDER[1]})`;
    function poseArm(a, [up, fo], lift, hand) {
      const f = 1 - LIFT * lift;
      a.upper.setAttribute('transform', `${turn(-up, SHOULDER)} ${shorten(f)}`);
      a.reach.setAttribute('transform', turn(-up, SHOULDER));
      // The elbow comes up the arm as it shortens.
      const [dx, dy] = [(f - 1) * (ELBOW[0] - SHOULDER[0]), (f - 1) * (ELBOW[1] - SHOULDER[1])];
      a.fore.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) ${turn(up - fo, ELBOW)}`);
      // A wrist bends no further than a wrist can.
      for (const grip of a.grips) grip.setAttribute('transform', turn(clamp(hand, ...a.wristRange), WRIST));
      shadeLimb(a.upperShading, up, a.side);
      shadeLimb(a.foreShading, fo, a.side);
      shadeLimb(a.cuffShading, fo, a.side);
      // Swung in across the body (turned clockwise past a few degrees), the
      // arm is in front of the vest: its armhole gives way, quickly, so the
      // sleeve never shows through it for long. Once it has, the shoulder
      // moves in front of the other one and the collar; so near its side,
      // it covers neither yet, and nothing jumps.
      const across = clamp((-up - 3) / 4, 0, 1);
      a.armhole.setAttribute('opacity', (1 - across).toFixed(3));
      const layer = across === 1 ? crossingArms : upperArms;
      if (a.shoulder.parentNode !== layer) layer.appendChild(a.shoulder);
    }

    /** An arm across the body has its forearm and hand in front of the other arm's. */
    function stackForearms() {
      const across = [penArm, rollArm].find((a) => a.shoulder.parentNode === crossingArms);
      if (across && frontArms.lastChild !== across.reachRoot) frontArms.appendChild(across.reachRoot);
    }

    let worn;
    function pose(p) {
      // A give at the knees: the trousers foreshorten about their hems and
      // the body drops with them; the shoes stay put.
      const drop = 7 * p.crouch;
      const squash = 1 - drop / (HEMS - WAIST);
      legs.setAttribute('transform', `translate(0 ${HEMS}) scale(1 ${squash.toFixed(4)}) translate(0 ${-HEMS})`);
      trunk.setAttribute('transform', `translate(0 ${drop.toFixed(2)})`);
      poseArm(penArm, p.pen, p.penLift, p.penHand);
      poseArm(rollArm, p.roll, p.rollLift, p.rollHand);
      stackForearms();
      // The head dips in a nod and tilts about the chin.
      const tilt = `translate(0 ${(1.6 * p.nod).toFixed(2)}) rotate(${p.tilt.toFixed(2)} ${HEAD.x} ${HEAD.chin})`;
      head.setAttribute('transform', tilt);
      for (const layer of [wornUnder, wornOver]) layer.setAttribute('transform', tilt);
    }

    function face(time, p, reduced) {
      if (worn) {
        worn(time, { look: p.look, down: p.down, brow: p.brow }, reduced);
        return;
      }
      brows[0].setAttribute('transform', `translate(0 ${(-2.4 * p.brow).toFixed(2)})`);
      for (const { iris } of eyes) {
        iris.setAttribute('transform', `translate(${(1.1 * p.look).toFixed(2)} ${(0.6 * clamp(p.down, -1, 1)).toFixed(2)})`);
      }
    }

    function wear(heroHead) {
      // The hero's face sits where the drawn one was, its neck under the
      // shirt collar; the forearms and hands take the hero's skin tones (CSS).
      // A later appearance may bring another hero in place of this one.
      for (const layer of [wornUnder, wornOver]) layer.replaceChildren();
      worn = heroHead.wear({ underCollar: wornUnder, overCollar: wornOver }, HEAD);
      heroHead.paint(fig);
      fig.classList.add('dio-arch-art--hero');
      for (const drawn of [drawnNeck, drawnHead]) drawn.setAttribute('display', 'none');
    }

    pose(REST);
    return { pose, face, wear };
  }

  // ------------------------------------------------------------------
  // The architect on stage
  // ------------------------------------------------------------------

  /**
   * The architect at (x, y), 160×300 × `scale` CSS pixels, from `at` until
   * `until`. The pencil is in the hand on the side the figure works
   * towards: the picture's right, or with `flip` its left, so point at
   * things on that side. `hero` (a promise of SongStudentAvatar's heroHead)
   * gives the architect the viewer's saved human or Prof SE Gym face, or the
   * Gym's default face, or a new random face each time the architect comes
   * on stage; resolving to null, the drawn face stays. `entrance`
   * 'rise', or a glide in from the 'left' or 'right'. `moves` = [[time, name,
   * options]] plays MOVES: 'point' and 'sketch' take { to: [x, y] } in stage
   * pixels. `tag` labels the figure below its feet.
   */
  function architect(parent, { x, y, scale = 1, flip = false, at, until, entrance = 'rise', hero, tag = 'Architect', moves = [] }) {
    const wrap = place(el('div', 'dio-arch is-staged', parent), x, y);
    wrap.dataset.testid = 'dio-architect';
    wrap.style.width = `${160 * scale}px`;
    const fig = svg('svg', { class: 'dio-arch-art', viewBox: '0 0 160 300', width: 160 * scale, height: 300 * scale, 'aria-hidden': 'true' }, wrap);
    // Entrances move this group, in stage directions.
    const travel = svg('g', {}, fig);
    const shadow = svg('g', { class: 'dio-arch-shadow' }, travel);
    svg('ellipse', { cx: 84, cy: 293, rx: 40, ry: 5 }, shadow);
    for (const [cx, cy, rx] of [[69.2, 293.2, 13.8], [100.2, 296.2, 14.2]]) svg('ellipse', { class: 'dio-arch-contact', cx, cy, rx, ry: 1.8 }, shadow);
    const sway = svg('g', {}, travel);
    const figure = architectFigure(fig, sway, { flip });
    if (tag) el('div', 'dio-arch-tag', wrap, tag);

    // A scene culls its contents out of the document while they are hidden,
    // so only disposal (not being disconnected) means the face is unwanted.
    // Being culled does take the architect off stage: a later return is a
    // new appearance.
    let disposed = false;
    let onStage = false;
    let dress = null;
    onDispose(() => { disposed = true; });
    hero?.then((heads) => {
      if (!heads || disposed) return;
      dress = heads.dresser(figure.wear, onStage);
    }).catch(() => {
      // The saved face is optional; the drawn architect remains.
    });

    // Stage points in the pencil arm's own (possibly mirrored) figure units,
    // and what the moves make of them (MOVES).
    const toFigure = ([sx, sy]) => {
      const fx = (sx - x) / scale;
      return [flip ? 160 - fx : fx, (sy - y) / scale];
    };
    const g = {
      // The glance towards a stage point, in picture space, from the eyes.
      glance: (to) => ({
        look: clamp((to[0] - (x + HEAD.x * scale)) / (150 * scale), -1, 1),
        down: clamp((to[1] - (y + EYES * scale)) / (160 * scale), -0.8, 1),
      }),
      // The pencil arm pointing at a stage point, its tip on it within reach.
      aim: (to) => aimPencil(toFigure(to)),
      // The pencil arm with its tip in the air on the way to a stage point,
      // within reach, moved by `offset` (picture-space figure units) and by
      // `back` along the way.
      tip: (to, [dx, dy] = [0, 0], back = 0) => {
        const [fx, fy] = toFigure(to);
        const [vx, vy] = [fx - SHOULDER[0], fy - SHOULDER[1]];
        const d = Math.hypot(vx, vy) || 1;
        const r = Math.min(d, GESTURE_REACH) + back;
        return aimPencil([SHOULDER[0] + vx / d * r + (flip ? -dx : dx), SHOULDER[1] + vy / d * r + dy]);
      },
      // The pencil arm held straight out towards a stage point.
      straight: (to) => {
        const [fx, fy] = toFigure(to);
        return holdOutPencil(degrees(Math.atan2(fy - SHOULDER[1], fx - SHOULDER[0])), 3);
      },
      // The side of the figure a stage point is on: 1 right, −1 left.
      side: (to) => (to[0] < x + 80 * scale ? -1 : 1),
    };
    const keys = moves
      .flatMap(([time, name, options = {}]) => MOVES[name](options, g).map(([delay, duration, fields]) => [time + delay, duration, fields]))
      .sort((a, b) => a[0] - b[0]);

    const side = entrance === 'left' ? -1 : 1;
    const GLIDE = 0.95;
    onFrame((t) => {
      const local = t - at;
      const reduced = reducedMotion.matches;
      const p = poseAt(keys, t, reduced);
      // At ease: a slow, uneven shift of weight and a breath, and a lean
      // towards what it inspects.
      const shift = (reduced ? 0 : 0.6 * Math.sin(local * 0.9) + 0.3 * Math.sin(local * 2.1 + 0.7)) + p.lean;
      const breath = reduced ? 1 : 1 + 0.004 * Math.sin(local * 1.6);
      sway.setAttribute('transform', `rotate(${shift.toFixed(2)} 80 290) translate(80 290) scale(1 ${breath.toFixed(4)}) translate(-80 -290)`);
      // A glide in leans into the move, sways past upright, and settles with
      // a give at the knees.
      let glide = 0, lean = 0, settle = 0;
      if (!reduced && entrance !== 'rise' && local < GLIDE + 0.5) {
        const u = progress(t, at, GLIDE);
        glide = side * 70 * (1 - u) ** 3;
        lean = -side * 8 * Math.exp(-3.5 * u) * Math.cos(2.6 * Math.PI * u);
        settle = 0.8 * Math.sin(Math.PI * progress(t, at + 0.5, 0.42));
      }
      travel.setAttribute('transform', `translate(${(glide / scale).toFixed(2)} 0) rotate(${lean.toFixed(2)} 80 290)`);
      p.crouch = Math.max(p.crouch, settle);
      figure.pose(p);
      // The eyes (and a worn head's blinks) move only while on stage.
      const shown = local >= 0 && (until === undefined || t <= until + 0.3);
      onStage = shown && wrap.isConnected;
      dress?.(onStage);
      if (shown) figure.face(local, p, reduced);
    });
    if (entrance === 'rise') fx.rise(wrap, at, { distance: 24, duration: 0.45 });
    else fx.fadeIn(wrap, at, 0.22);
    if (until !== undefined) fx.fadeOut(wrap, until, 0.3);
    return wrap;
  }

  window.ArchitectKit = { architect };
})();
