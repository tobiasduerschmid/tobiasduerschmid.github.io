/*
 * Artwork for the Publish-Subscribe video narration (choreography:
 * js/video-narration/publish-subscribe.js; styles: css/video-narration-
 * publish-subscribe.css). It builds on the wall kit and the architecture kit
 * (js/video-narration/arch-kit.js) and adds the lesson's own objects:
 *
 *   Mochi, the campus delivery robot, drawn from the side: a cooler-sized
 *     body on six wheels, a camera on its lid, a face panel with two LED
 *     eyes, and a safety flag;
 *   the campus as a paper map (the student union, the engineering building,
 *     the main walkway, scooters on it), and a walkway strip for the scenes
 *     that only need the robot, a tour group, or a skateboarder, whose people
 *     are drawn with a small rig of ink-edged limbs;
 *   the phone that orders lunch, with the app's tracking map, and a bus
 *     diagram: boxes hanging from one line, the picture that hides who
 *     talks to whom.
 *
 * Every builder schedules its own motion on the Timeline, and every pose is a
 * pure function of narration time. Coordinates are CSS pixels inside the
 * picture's 960x540 body.
 */
(function () {
  'use strict';

  const { fx, onFrame, progress, easeInOutCubic } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, icon } = kit;
  const wall = window.WallKit;
  const { staged } = wall;
  const arch = window.ArchKit;
  const { show } = arch;

  // ------------------------------------------------------------------
  // Mochi
  // ------------------------------------------------------------------

  const { shape } = arch;
  const { circle } = shape;
  /** Mochi's six wheels: the three on the near side, and the far three a little behind and above. */
  const WHEELS = [22, 48, 74];
  const BODY = 'M8 42 C8 35.4 13.4 31.6 20 31.2 L76 31.2 C82.6 31.6 88 35.4 88 42 L88 56 C88 61.4 84 64.6 78.6 64.6 L17.4 64.6 C12 64.6 8 61.4 8 56 Z';
  const LID = 'M10.4 35.6 C14 31 22 27.4 48 26.2 C74 27.4 82 31 85.6 35.6 Z';
  const FACE = 'M65.6 40.4 C65.6 37.4 67.6 35.6 70.6 35.6 L82.2 35.6 C85 35.6 86.8 37.4 86.8 40.4 L86.8 49.6 C86.8 52.6 85 54.4 82.2 54.4 L70.6 54.4 C67.6 54.4 65.6 52.6 65.6 49.6 Z';
  const ROCKER = 'M16 66 H80 C81.4 66 82.4 67 82.4 68.4 C82.4 69.8 81.4 70.8 80 70.8 H16 C14.6 70.8 13.6 69.8 13.6 68.4 C13.6 67 14.6 66 16 66 Z';

  /*
   * Mochi from the side, facing right, in a 96 x 84 box, drawn back to front:
   * its shadow; the far wheels in shade behind the rocker that carries the
   * near ones; the safety flag; a cooler-sized body with a domed lid lit from
   * above, a shaded skirt, a teal stripe, a status light, and the camera on
   * the lid; a dark face panel with two friendly LED eyes; the near wheels;
   * then the ink.
   */
  const ROBOT = [
    ['shadow', 'M10 81 C10 79.4 28 78.4 48 78.4 C68 78.4 86 79.4 86 81 C86 82.6 68 83.4 48 83.4 C28 83.4 10 82.6 10 81 Z'],
    ['wheel-far', WHEELS.map((x) => circle(x + 4, 67.6, 9)).join(' ')],
    ['rocker', ROCKER],
    ['pole', 'M20.4 29 V5.4'],
    ['pole-cap', circle(20.4, 4.4, 1.8)],
    ['flag', 'M21.4 5.6 C27 6.2 32.4 7.8 39 10.4 C32.4 12.8 27 14.4 21.4 15.2 Z'],
    ['flag-fold', 'M21.4 10.4 C26.4 10.8 31 10.8 35.6 10.4 C31 11.4 26.4 12 21.4 12.6 Z'],
    ['body', BODY],
    ['skirt', 'M8 53.4 H88 V56 C88 61.4 84 64.6 78.6 64.6 L17.4 64.6 C12 64.6 8 61.4 8 56 Z'],
    ['lid', LID],
    ['lid-light', 'M15.8 33.6 C20.6 30.6 30 28.8 44 28.2 C34.4 29.8 24.6 31.4 18.8 33.8 Z'],
    ['camera', circle(77, 30.4, 3.4)],
    ['lens', `${circle(77.6, 30.2, 1.6)}`],
    ['stripe', 'M8 45.4 H63.4 V49 H8 Z'],
    ['status', 'M43 25.6 C43 24.4 43.8 23.6 45 23.6 H51 C52.2 23.6 53 24.4 53 25.6 V26.6 H43 Z'],
    ['face', FACE],
    ['eye', 'M71.2 42.2 C71.2 41.2 72 40.4 73 40.4 C74 40.4 74.8 41.2 74.8 42.2 V47.2 C74.8 48.2 74 49 73 49 C72 49 71.2 48.2 71.2 47.2 Z M78 42.2 C78 41.2 78.8 40.4 79.8 40.4 C80.8 40.4 81.6 41.2 81.6 42.2 V47.2 C81.6 48.2 80.8 49 79.8 49 C78.8 49 78 48.2 78 47.2 Z'],
    ['glint', `${circle(72.4, 42.2, 0.6)} ${circle(79.2, 42.2, 0.6)}`],
    ['wheel', WHEELS.map((x) => circle(x, 69.6, 10)).join(' ')],
    ['hub', WHEELS.map((x) => circle(x, 69.6, 4.4)).join(' ')],
    ['hub-cap', WHEELS.map((x) => circle(x, 69.6, 1.7)).join(' ')],
    ['ink', `${BODY} ${LID} ${FACE} M8 53.4 H88 ${ROCKER}`],
    ['ink-fine', `${WHEELS.map((x) => circle(x, 69.6, 10)).join(' ')} ${circle(77, 30.4, 3.4)} M21.4 5.6 C27 6.2 32.4 7.8 39 10.4 C32.4 12.8 27 14.4 21.4 15.2 Z`],
  ];

  function robotArt(parent) {
    const art = svg('svg', { viewBox: '0 0 96 84', class: 'ps-robot-art', 'aria-hidden': 'true' }, parent);
    ROBOT.forEach(([part, d]) => svg('path', { d, class: `ps-robot-${part}` }, art));
    return art;
  }

  /**
   * Mochi on a path of points (body coordinates of its center), driven from
   * `at` over `duration` seconds with an ease at both ends; it rests at the
   * last point. `stops` = [{ at, state }] repaints it (frozen, stopped).
   */
  function robot(parent, { path, at, duration = 0.01, size = 96, until, states = [], drive = at, name }) {
    const node = staged(parent, 'ps-robot', path[0][0] - size / 2, path[0][1] - size * 0.44);
    node.style.width = `${size}px`;
    node.style.height = `${size * 0.875}px`;
    robotArt(node);
    if (name) el('span', 'ps-robot-name', node, name);
    const total = arch.pathLength(path);
    onFrame((t) => {
      const [x, y] = arch.along(path, total * easeInOutCubic(progress(t, drive, duration)));
      node.style.translate = `${(x - path[0][0]).toFixed(1)}px ${(y - path[0][1]).toFixed(1)}px`;
    });
    if (states.length) arch.track(node, 'is-', states);
    return show(node, at, until, 'fade');
  }

  // ------------------------------------------------------------------
  // The campus
  // ------------------------------------------------------------------

  /** The campus map: buildings, the walkway Mochi drives, side paths, trees, and the scooters it weaves between. */
  const CAMPUS = {
    w: 560,
    h: 380,
    walk: 'M120 104 C 190 130, 200 190, 280 196 S 400 238, 430 280',
    paths: ['M560 120 C 470 150, 380 200, 300 196', 'M0 252 C 90 238, 170 214, 232 196', 'M430 280 L 430 292'],
    ride: [[120, 98], [190, 132], [236, 176], [292, 186], [352, 222], [412, 262]],
    buildings: [
      { name: 'Student union', x: 20, y: 22, w: 190, h: 64, roof: 'tile' },
      { name: 'Engineering', x: 340, y: 292, w: 196, h: 66, roof: 'concrete' },
    ],
    trees: [[262, 44, 1.1], [308, 92, 0.9], [470, 54, 1.2], [528, 168, 0.9], [252, 284, 1], [44, 196, 1], [36, 318, 1.2], [126, 330, 0.9], [482, 200, 0.8], [178, 40, 0.0]],
    scooters: [[214, 132], [330, 236]],
  };

  /** A tree from above: a shadow on the grass, a canopy of three crowns, and their shaded side. */
  function treeShapes([x, y, s]) {
    const c = (dx, dy, r) => shape.circle(x + dx * s, y + dy * s, r * s);
    return { shadow: c(5, 6, 17), crown: `${c(0, 0, 15)} ${c(-11, 5, 10)} ${c(10, 7, 11)}`, shade: `${c(5, 4, 9)} ${c(12, 9, 6)}` };
  }

  /** An e-scooter from above: a deck with a lime stripe, wheels at both ends, and a handlebar with grips. */
  function scooterMark(parent, [x, y]) {
    const g = svg('g', { class: 'ps-map-scooter', transform: `translate(${x} ${y}) rotate(-24)` }, parent);
    svg('path', { d: `${shape.box(-17, -3.2, 4.4, 6.4)} ${shape.box(12.6, -3.2, 4.4, 6.4)}`, class: 'ps-scooter-wheel' }, g);
    svg('path', { d: 'M-14 -4.6 H11 C12.6 -4.6 13.6 -3.6 13.6 -2 V2 C13.6 3.6 12.6 4.6 11 4.6 H-14 C-15.6 4.6 -16.6 3.6 -16.6 2 V-2 C-16.6 -3.6 -15.6 -4.6 -14 -4.6 Z', class: 'ps-scooter-deck' }, g);
    svg('path', { d: shape.box(-11, -1.2, 18, 2.4), class: 'ps-scooter-stripe' }, g);
    svg('path', { d: 'M13.6 0 H17.4 M17.4 -10.6 V10.6', class: 'ps-scooter-bar' }, g);
    svg('path', { d: `${shape.box(15.8, -12.4, 3.2, 3.6)} ${shape.box(15.8, 8.8, 3.2, 3.6)}`, class: 'ps-scooter-grip' }, g);
    return g;
  }

  /** A building from above: its shadow, its roof, and what sits on a roof like it. */
  function building(art, { x, y, w, h, roof }) {
    svg('path', { d: shape.box(x + 6, y + 8, w, h), class: 'ps-map-shadow' }, art);
    svg('rect', { x, y, width: w, height: h, rx: 6, class: `ps-map-roof ps-map-roof--${roof}` }, art);
    // Roof details stay at the ends, clear of the building's name in the middle.
    if (roof === 'tile') svg('rect', { x: x + 6, y: y + 6, width: w - 12, height: h - 12, rx: 3, class: 'ps-map-parapet' }, art);
    else svg('path', { d: `${shape.box(x + 8, y + 8, 18, 12)} ${shape.box(x + 8, y + h - 20, 18, 12)} ${shape.box(x + w - 26, y + h - 22, 18, 14)}`, class: 'ps-map-unit' }, art);
    svg('rect', { x, y, width: w, height: h, rx: 6, class: 'ps-map-edge' }, art);
  }

  /** The campus as a paper map; Mochi drives it with drive(). Returns { node, origin }. */
  function campusMap(parent, { x, y, at, until }) {
    const node = staged(parent, 'ps-map', x, y);
    node.style.width = `${CAMPUS.w}px`;
    node.style.height = `${CAMPUS.h}px`;
    const art = svg('svg', { viewBox: `0 0 ${CAMPUS.w} ${CAMPUS.h}`, class: 'ps-map-art', 'aria-hidden': 'true' }, node);
    const trees = CAMPUS.trees.filter(([, , s]) => s > 0).map(treeShapes);
    svg('path', { d: CAMPUS.paths.join(' '), class: 'ps-map-path-edge' }, art);
    svg('path', { d: CAMPUS.paths.join(' '), class: 'ps-map-path' }, art);
    svg('path', { d: CAMPUS.walk, class: 'ps-map-walk-edge' }, art);
    svg('path', { d: CAMPUS.walk, class: 'ps-map-walk' }, art);
    svg('path', { d: CAMPUS.walk, class: 'ps-map-walk-line' }, art);
    svg('ellipse', { cx: 104, cy: 108, rx: 52, ry: 20, class: 'ps-map-plaza' }, art);
    svg('path', { d: shape.circle(74, 110, 11), class: 'ps-map-fountain' }, art);
    svg('path', { d: shape.circle(74, 110, 6.5), class: 'ps-map-water' }, art);
    svg('path', { d: trees.map((t) => t.shadow).join(' '), class: 'ps-map-tree-shadow' }, art);
    CAMPUS.buildings.forEach((b) => building(art, b));
    svg('path', { d: trees.map((t) => t.crown).join(' '), class: 'ps-map-tree' }, art);
    svg('path', { d: trees.map((t) => t.shade).join(' '), class: 'ps-map-tree-shade' }, art);
    CAMPUS.scooters.forEach((point) => scooterMark(art, point));
    CAMPUS.buildings.forEach((b) => {
      const label = el('span', 'ps-map-name', node, b.name);
      label.style.left = `${b.x + b.w / 2}px`;
      label.style.top = `${b.y + b.h / 2}px`;
    });
    const walkway = el('span', 'ps-map-name ps-map-name--walk', node, 'Main walkway');
    walkway.style.left = '150px';
    walkway.style.top = '214px';
    show(node, at, until, 'fade');
    return node;
  }

  /** Mochi riding the campus map placed at (mapX, mapY), from the union to the engineering building. */
  function rideCampus(parent, { mapX, mapY, at, drive, duration, size = 64, name = 'Mochi' }) {
    const path = CAMPUS.ride.map(([px, py]) => [mapX + px, mapY + py]);
    return robot(parent, { path, at, drive, duration, size, name });
  }

  // ------------------------------------------------------------------
  // People on the walkway
  // ------------------------------------------------------------------

  const pts = (points) => points.map(([px, py]) => `${shape.round(px)} ${shape.round(py)}`).join(' L');
  /**
   * A limb or a stick of one `kind` (leg, sleeve, arm, shoe, neck, stick): a
   * polyline drawn as an ink stroke under a colored one, so joints stay smooth.
   */
  function limb(g, points, kind, paint) {
    svg('path', { d: `M${pts(points)}`, class: `ps-person-ink ps-limb-${kind}` }, g);
    svg('path', { d: `M${pts(points)}`, class: `ps-person-limb ps-limb-${kind} ${paint}` }, g);
  }

  /**
   * One person seen from the side, feet at (x, y) and facing left (or right
   * with facing: 1), about 52 units tall. pose = { front, back } are each
   * arm's and leg's joints relative to the shoulder and hip; `carry` is a
   * pennant on a stick in the front hand; `pack` adds a backpack.
   */
  function person(parent, { x, y, facing = -1, skin, hair, shirt, pants, shoes = 'ps-shoe', legs, arms, lean = 0, pack, cap, carry }) {
    const g = svg('g', { transform: `translate(${x} ${y}) scale(${-facing} 1) rotate(${lean})` }, parent);
    const hip = [0.6, -24];
    const shoulder = [0.4, -38];
    const joint = ([ox, oy], [dx, dy]) => [ox + dx, oy + dy];
    const leg = (side) => legs[side].map((p) => joint(hip, p));
    const arm = (side) => arms[side].map((p) => joint(shoulder, p));
    // Back arm and back leg, a shade darker.
    const backArm = arm('back');
    limb(g, backArm.slice(1), 'arm', `${skin} ps-shade`);
    limb(g, backArm.slice(0, 2), 'sleeve', `${shirt} ps-shade`);
    const backLeg = leg('back');
    limb(g, backLeg, 'leg', `${pants} ps-shade`);
    limb(g, [backLeg[2], [backLeg[2][0] - 3.6, backLeg[2][1] + 0.6]], 'shoe', shoes);
    if (pack) {
      svg('path', { d: 'M3.2 -38.6 C7.6 -39 9.2 -36.4 9.2 -32 L9.2 -28.4 C9.2 -26.6 8 -25.6 6.2 -25.6 L3.6 -25.6 Z', class: `ps-person-fill ${pack}` }, g);
      svg('path', { d: 'M3.2 -38.6 C7.6 -39 9.2 -36.4 9.2 -32 L9.2 -28.4 C9.2 -26.6 8 -25.6 6.2 -25.6 L3.6 -25.6', class: 'ps-person-outline' }, g);
    }
    // Torso: chest in front, back behind, from the shoulders to the hips.
    const torso = 'M-3.4 -38.6 C-1.6 -40.2 2.6 -40.2 4.2 -38.4 C5 -34 4.8 -28 4.4 -23.4 C1.8 -22.4 -1.6 -22.4 -3.6 -23.4 C-4.6 -28 -4.6 -34.4 -3.4 -38.6 Z';
    svg('path', { d: torso, class: `ps-person-fill ${shirt}` }, g);
    svg('path', { d: torso, class: 'ps-person-outline' }, g);
    const frontLeg = leg('front');
    limb(g, frontLeg, 'leg', pants);
    limb(g, [frontLeg[2], [frontLeg[2][0] - 3.8, frontLeg[2][1] + 0.4]], 'shoe', shoes);
    // Head: neck, skull, face in profile, ear, eye, hair.
    limb(g, [[0, -38.6], [-0.4, -41.6]], 'neck', skin);
    const head = 'M-4.6 -44.8 C-4.6 -48.6 -2.2 -50.6 0.6 -50.6 C3.6 -50.6 5 -48.2 5 -45.2 C5 -42.2 3.2 -40.4 0.4 -40.4 C-1.4 -40.4 -2.8 -41 -3.6 -42 L-5.4 -43.2 C-5.8 -43.6 -5.4 -44.2 -4.6 -44.8 Z';
    svg('path', { d: head, class: `ps-person-fill ${skin}` }, g);
    svg('path', { d: head, class: 'ps-person-outline' }, g);
    svg('path', { d: shape.circle(1.6, -45.4, 1.1), class: `ps-person-fill ${skin} ps-shade` }, g);
    svg('path', { d: shape.circle(-2.4, -46.4, 0.55), class: 'ps-person-eye' }, g);
    if (cap) svg('path', { d: 'M-4.4 -47.4 C-4 -51 4.6 -51.6 5.4 -46.6 L5 -45.6 C2 -47.8 -1.2 -48.2 -4.4 -47.4 Z M-4.4 -47.4 L-7.6 -46.8 L-7 -45.8 L-4 -46.4 Z', class: `ps-person-fill ${cap}` }, g);
    else svg('path', { d: 'M-4.2 -47 C-3.6 -50.8 3.8 -52 5.4 -46.6 C5.6 -44.6 5 -42.8 4 -41.6 C3.6 -43.4 2.4 -44.6 1 -45 C-0.6 -46.4 -2.6 -46.8 -4.2 -47 Z', class: `ps-person-fill ${hair}` }, g);
    // Front arm, and what it carries.
    const frontArm = arm('front');
    if (carry) {
      const [hx, hy] = frontArm[2];
      limb(g, [[hx, hy + 4], [hx, hy - 12]], 'stick', 'ps-stick');
      svg('path', { d: `M${hx} ${hy - 12} L${hx - 9} ${hy - 9.4} L${hx} ${hy - 6.8} Z`, class: `ps-person-fill ${carry}` }, g);
    }
    limb(g, frontArm.slice(1), 'arm', skin);
    limb(g, frontArm.slice(0, 2), 'sleeve', shirt);
    return g;
  }

  /** A guide with a pennant up, talking to two students with backpacks: a campus tour stopped on the walkway. */
  function tourArt(parent) {
    const art = svg('svg', { viewBox: '0 0 84 60', class: 'ps-figure-art', 'aria-hidden': 'true' }, parent);
    const stand = { front: [[-0.4, 0], [-1.4, 11.6], [-1.6, 23]], back: [[1.4, 0], [2.6, 11.6], [3, 23]] };
    person(art, { x: 15, y: 57, facing: 1, skin: 'ps-skin-2', hair: 'ps-hair-0', shirt: 'ps-shirt-blue', pants: 'ps-pants-denim', pack: 'ps-pack-red', legs: stand, arms: { front: [[0, 0], [-1, 8], [-2, 15.4]], back: [[0.8, 0], [2.2, 8], [2, 15.4]] } });
    person(art, { x: 35, y: 57, facing: 1, skin: 'ps-skin-0', hair: 'ps-hair-2', shirt: 'ps-shirt-gold', pants: 'ps-pants-dark', pack: 'ps-pack-teal', legs: { front: [[-0.6, 0], [-2.4, 11.4], [-3.4, 22.8]], back: [[1.2, 0], [2.4, 11.6], [3.6, 23]] }, arms: { front: [[0, 0], [-1.6, 8], [-1.4, 15.4]], back: [[0.8, 0], [1.6, 8.2], [1, 15.6]] } });
    person(art, { x: 66, y: 57, facing: -1, skin: 'ps-skin-3', hair: 'ps-hair-1', shirt: 'ps-shirt-coral', pants: 'ps-pants-khaki', carry: 'ps-pennant', legs: stand, arms: { front: [[0, 0], [-5.4, 3.2], [-7.6, -4.4]], back: [[0.8, 0], [2.6, 8], [1.4, 15.2]] } });
    return art;
  }

  /** A skateboarder riding toward Mochi: knees bent, arms out for balance, helmet on, a deck on four wheels. */
  function skaterArt(parent) {
    const art = svg('svg', { viewBox: '0 0 52 60', class: 'ps-figure-art', 'aria-hidden': 'true' }, parent);
    svg('path', { d: 'M5 51.4 C5 50.2 6 49.6 7.4 49.6 L44.6 49.6 C46 49.6 47 50.2 47 51.4 C47 52.6 46 53.2 44.6 53.2 L7.4 53.2 C6 53.2 5 52.6 5 51.4 Z M3.6 49 C4 50.4 5 51 6.4 50.8 M48.4 49 C48 50.4 47 51 45.6 50.8', class: 'ps-deck' }, art);
    svg('path', { d: `${shape.circle(12, 55.6, 2.6)} ${shape.circle(40, 55.6, 2.6)}`, class: 'ps-deck-wheel' }, art);
    person(art, {
      x: 26, y: 51.4, facing: -1, lean: -8, skin: 'ps-skin-1', hair: 'ps-hair-0', cap: 'ps-helmet', shirt: 'ps-shirt-green', pants: 'ps-pants-dark',
      legs: { front: [[-0.6, 0], [-8.4, 7.6], [-9, 18.8]], back: [[1.4, 0], [6.4, 9], [9.6, 18.4]] },
      arms: { front: [[0, 0], [-7.6, -1.2], [-14.2, 1.4]], back: [[0.8, 0], [7.4, 2.4], [13.4, 6.6]] },
    });
    return art;
  }

  // ------------------------------------------------------------------
  // The walkway strip
  // ------------------------------------------------------------------

  /** The walkway seen from the side, `w` wide and 62 tall: hedges, trees, and lamps behind a paved path with a curb. */
  function laneArt(parent, w) {
    const art = svg('svg', { viewBox: `0 0 ${w} 62`, class: 'ps-lane-art', 'aria-hidden': 'true' }, parent);
    const trees = Array.from({ length: Math.ceil(w / 150) }, (_, i) => 60 + i * 150);
    const lamps = Array.from({ length: Math.ceil((w - 120) / 300) }, (_, i) => 135 + i * 300);
    let hedge = `M0 30 L0 20`;
    for (let hx = 0; hx < w; hx += 18) hedge += ` C${hx + 4} ${16} ${hx + 14} ${16} ${hx + 18} ${20}`;
    hedge += ` L${w} 30 Z`;
    svg('path', { d: shape.box(0, 0, w, 32), class: 'ps-lane-sky' }, art);
    svg('path', { d: trees.map((tx) => shape.box(tx - 2, 8, 4, 18)).join(' '), class: 'ps-lane-trunk' }, art);
    svg('path', { d: trees.map((tx) => `${shape.circle(tx, 8, 11)} ${shape.circle(tx - 9, 13, 8)} ${shape.circle(tx + 9, 13, 8)}`).join(' '), class: 'ps-lane-tree' }, art);
    svg('path', { d: trees.map((tx) => `${shape.circle(tx + 4, 11, 7)} ${shape.circle(tx + 10, 15, 5)}`).join(' '), class: 'ps-lane-tree-shade' }, art);
    svg('path', { d: hedge, class: 'ps-lane-hedge' }, art);
    svg('path', { d: lamps.map((lx) => `M${lx} 28 V4`).join(' '), class: 'ps-lane-pole' }, art);
    svg('path', { d: lamps.map((lx) => `M${lx - 4} 4 H${lx + 4} L${lx + 2.6} 8 H${lx - 2.6} Z`).join(' '), class: 'ps-lane-lamp' }, art);
    svg('path', { d: shape.box(0, 28, w, 4), class: 'ps-lane-curb' }, art);
    svg('path', { d: shape.box(0, 32, w, 30), class: 'ps-lane-path' }, art);
    let joints = '';
    for (let jx = 12; jx < w; jx += 26) joints += `M${jx} 32 V46 M${jx + 13} 46 V62 `;
    svg('path', { d: `${joints} M0 46 H${w}`, class: 'ps-lane-joint' }, art);
    return art;
  }

  /**
   * A strip of the main walkway for scenes that need only the robot and
   * who is on the walkway: Mochi's positions over time (stops = [{ at, x }],
   * gliding between them), props = [{ kind: tour, skater, bumper, at, x }],
   * and an optional word under the strip that changes (words = [{ at, text }]).
   */
  function walkway(parent, { x, y, w = 420, at, until, stops, props = [], states = [] }) {
    const node = staged(parent, 'ps-walk', x, y);
    node.style.width = `${w}px`;
    el('span', 'ps-walk-name', node, 'Main walkway');
    const lane = el('div', 'ps-walk-lane', node);
    laneArt(lane, w - 24);
    props.forEach(({ kind, x: px, at: propAt = at, until: propUntil }) => {
      const prop = el('span', `ps-walk-prop ps-walk-prop--${kind} is-staged`, lane);
      prop.style.left = `${px}px`;
      if (kind === 'tour') tourArt(prop);
      else if (kind === 'skater') skaterArt(prop);
      fx.pop(prop, propAt, { from: 0.5 });
      if (propUntil !== undefined) fx.fadeOut(prop, propUntil, 0.25);
    });
    const bot = el('span', 'ps-walk-robot', lane);
    robotArt(bot);
    const sorted = [...stops].sort((a, b) => a.at - b.at);
    onFrame((t) => {
      let px = sorted[0].x;
      for (let i = 1; i < sorted.length; i += 1) {
        const from = sorted[i - 1];
        const to = sorted[i];
        if (t >= to.at) px = to.x;
        else if (t > from.at && to.glide) px = from.x + (to.x - from.x) * easeInOutCubic(progress(t, from.at, to.at - from.at));
      }
      bot.style.left = `${px.toFixed(1)}px`;
    });
    if (states.length) arch.track(node, 'is-', states);
    return show(node, at, until, 'fade');
  }

  // ------------------------------------------------------------------
  // The phone
  // ------------------------------------------------------------------

  /** The route on the app's map, from the union to the door, as points Mochi follows. */
  const TRACK_ROUTE = [[18, 94], [52, 87], [84, 70], [118, 62], [154, 56]];

  /**
   * The app's tracking map, under its message: the walkway, the route, the pin
   * at the door, and Mochi driving the route as the big map's Mochi does
   * (ride = { at, duration }).
   */
  function trackingArt(parent, ride) {
    const art = svg('svg', { viewBox: '0 0 238 120', class: 'ps-track-art', 'aria-hidden': 'true' }, parent);
    svg('rect', { x: 0, y: 0, width: 238, height: 120, rx: 12, class: 'ps-track-lawn' }, art);
    svg('path', { d: `${shape.circle(40, 28, 11)} ${shape.circle(200, 92, 12)} ${shape.circle(120, 104, 9)}`, class: 'ps-track-tree' }, art);
    svg('rect', { x: 150, y: 14, width: 70, height: 36, rx: 4, class: 'ps-track-building' }, art);
    svg('path', { d: 'M-4 96 C 50 92, 70 64, 118 62 S 170 52, 184 50', class: 'ps-track-walk' }, art);
    svg('path', { d: 'M18 94 C 56 88, 76 64, 118 62 S 158 55, 168 54', class: 'ps-track-route' }, art);
    svg('path', { d: 'M184 24 C 176 24 170 30 170 37 C 170 46 184 56 184 56 C 184 56 198 46 198 37 C 198 30 192 24 184 24 Z', class: 'ps-track-pin' }, art);
    svg('path', { d: shape.circle(184, 37, 4.6), class: 'ps-track-pin-dot' }, art);
    const bot = svg('g', {}, art);
    ROBOT.filter(([part]) => !['shadow', 'ink-fine', 'glint', 'hub-cap', 'flag-fold', 'lid-light'].includes(part)).forEach(([part, d]) => svg('path', { d, class: `ps-robot-${part}` }, bot));
    const total = arch.pathLength(TRACK_ROUTE);
    onFrame((t) => {
      const done = ride ? easeInOutCubic(progress(t, ride.at, ride.duration)) : 0.5;
      const [px, py] = arch.along(TRACK_ROUTE, total * done);
      bot.setAttribute('transform', `translate(${(px - 12.5).toFixed(1)} ${(py - 20).toFixed(1)}) scale(0.26)`);
    });
    return art;
  }

  /**
   * A phone with the delivery app: screens = [{ at, title, text, iconName }],
   * each replacing the last, above a map where Mochi drives `ride`.
   */
  function phone(parent, { x, y, at, until, screens, ride }) {
    const node = staged(parent, 'ps-phone', x, y);
    el('p', 'ps-phone-app', node, 'Campus Eats');
    trackingArt(node, ride);
    const cards = screens.map(({ at: screenAt, title, text, iconName }, i) => {
      const card = el('div', 'ps-phone-card is-staged', node);
      if (iconName) el('span', 'ps-phone-icon', card).append(icon(iconName));
      const words = el('span', 'ps-phone-words', card);
      el('b', null, words, title);
      if (text) el('span', null, words, text);
      fx.rise(card, screenAt, { distance: 12, duration: 0.35 });
      const next = screens[i + 1];
      if (next) fx.fadeOut(card, next.at - 0.2, 0.2);
      return card;
    });
    show(node, at, until, 'slide');
    return { node, cards };
  }

  // ------------------------------------------------------------------
  // Diagrams
  // ------------------------------------------------------------------

  /**
   * Components on one shared topic, half above it and half below, each
   * attached to it: the diagram that says only that anyone might talk to
   * anyone. `y` is the top of the upper row; the whole is 290px tall.
   */
  function bus(parent, { x, y, w, names, at, until }) {
    const uml = window.UmlKit;
    const half = Math.ceil(names.length / 2);
    const bw = (w - (half - 1) * 14) / half;
    const topicTop = y + 64 + 36;
    const lane = arch.topic(parent, { x, y: topicTop + 38, w, name: 'events', tab: 'inside', at, until });
    names.forEach((name, i) => {
      const below = i >= half;
      const bx = x + (i % half) * (bw + 14);
      const by = below ? lane.bottom + 36 : y;
      const when = at + 0.1 + i * 0.12;
      uml.component(parent, { x: bx, y: by, w: bw, h: 64, name, variant: 'compact', at: when, until });
      const cx = bx + bw / 2;
      // A topic is a connector: the line has a port only at the component.
      uml.connector(parent, { from: below ? [cx, lane.bottom] : [cx, by + 64], to: below ? [cx, by] : [cx, lane.top], kind: 'link', ends: below ? 'to' : 'from', at: when + 0.1, until });
    });
    return lane;
  }

  window.PubSubKit = { robotArt, robot, campusMap, rideCampus, walkway, skaterArt, phone, bus, CAMPUS };
})();
