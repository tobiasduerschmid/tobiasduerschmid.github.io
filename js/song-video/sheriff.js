/*
 * The sheriff of "Design It In Before They Break In": the viewer's own SE Gym hero as the town
 * sheriff, a rigged figure in the manner of the information-hiding song's
 * Agent 00 (ih-kit.js). It stands at ease in a 160×300 box, its feet at the
 * bottom, lit from the upper left, in unisex clothes on a unisex build
 * (shoulders little wider than the hips, no waist shaping): a white felt hat with
 * a pinched crown and a band, a red bandana knotted at the throat, a
 * chambray shirt with pearl snaps, a leather vest with a silver star on the
 * chest, a belt with a silver buckle, jeans, and stitched boots with the toes
 * turned out. A gun belt with cartridge loops is slung low across the hips,
 * with a holstered revolver on the picture's right hip that the right hand
 * reaches for when trouble comes (the 'draw' move); it is never drawn.
 *
 * It wears SongStudentAvatar's heroHead (the saved human or Prof head, or the
 * Gym's default), neck up, under the hat; on export stages, or if the
 * renderer fails, it keeps a drawn face.
 *
 * Arms are two bones each: the upper arm turns at the shoulder and the
 * forearm at the elbow (inverse kinematics reach for stage points), the
 * forearm and hand always in front of the body, so a hand can touch the hat
 * brim. Each hand is seen from the thumb's side and built from its joints
 * (frontier-hand.js): its fingers curl joint by joint, so poses blend
 * smoothly from one grip to another, and the wrist turns only as far as a
 * wrist can. Every pose is a pure function of song time; under reduced
 * motion each move snaps to its pose and the idle sway holds still.
 * Coordinates are CSS pixels on the 960×540 stage; styles:
 * css/song-video-western-kit.css (`.sh-*`).
 */
(function () {
  'use strict';

  const { fx, onFrame, onDispose, progress, easeInOutCubic } = window.Timeline;
  const { el, svg, place } = window.SongKit;
  const { clamp } = window.SongFigure;
  const { hand, SHAPES } = window.FrontierHand;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let uid = 0;

  // ------------------------------------------------------------------
  // Arm geometry, in the picture's right arm's frame (the left mirrors it)
  // ------------------------------------------------------------------

  const ARM = { sx: 114, sy: 112, ex: 121, ey: 154, wx: 123, wy: 192 };
  ARM.upper = Math.hypot(ARM.ex - ARM.sx, ARM.ey - ARM.sy);
  ARM.fore = Math.hypot(ARM.wx - ARM.ex, ARM.wy - ARM.ey);
  ARM.upperDir = Math.atan2(ARM.ey - ARM.sy, ARM.ex - ARM.sx) * 180 / Math.PI;
  ARM.foreDir = Math.atan2(ARM.wy - ARM.ey, ARM.wx - ARM.ex) * 180 / Math.PI;
  // A hand is about seven tenths of its forearm's length, as a real one.
  const HAND_SCALE = 1.15;
  const mirror = (side) => (side < 0 ? 'translate(160 0) scale(-1 1)' : '');
  const wrap180 = (a) => ((a + 540) % 360) - 180;

  /**
   * The [upper, forearm] raise (degrees up from hanging) that puts the hand's
   * wrist at figure point (x, y): two-bone inverse kinematics. side 1 is the
   * picture's right arm, -1 the left. elbow 'out' bends it away from the
   * body, 'down' below the line to the target. Out of reach, the arm points
   * at the target along one line.
   */
  function reach([x, y], side = 1, elbow = 'down') {
    const tx = side > 0 ? x : 160 - x;
    const dx = tx - ARM.sx, dy = y - ARM.sy;
    const full = Math.hypot(dx, dy) || 1;
    const d = clamp(full, Math.abs(ARM.upper - ARM.fore) + 0.5, ARM.upper + ARM.fore - 0.4);
    const toward = Math.atan2(dy, dx);
    const bend = Math.acos(clamp((ARM.upper ** 2 + d ** 2 - ARM.fore ** 2) / (2 * ARM.upper * d), -1, 1));
    const elbows = [toward + bend, toward - bend].map((dir) => ({ dir, ex: ARM.sx + ARM.upper * Math.cos(dir), ey: ARM.sy + ARM.upper * Math.sin(dir) }));
    elbows.sort(elbow === 'out' ? (a, b) => b.ex - a.ex : (a, b) => b.ey - a.ey);
    const { dir, ex, ey } = elbows[0];
    const k = d / full;
    const fore = Math.atan2(ARM.sy + dy * k - ey, ARM.sx + dx * k - ex);
    return [wrap180(ARM.upperDir - dir * 180 / Math.PI), wrap180(ARM.foreDir - fore * 180 / Math.PI)];
  }

  // ------------------------------------------------------------------
  // Props held in the right hand (hand frame, the grip at about (0, 13))
  // ------------------------------------------------------------------

  const PROPS = {
    /** A ring of three brass keys, hanging from the fingers. */
    keys(g) {
      svg('circle', { class: 'sh-ring', cx: -1, cy: 14, r: 5 }, g);
      [[-4, 0], [0, 4], [4, -6]].forEach(([dx, turn]) => {
        const k = svg('g', { transform: `translate(${-1 + dx} 19) rotate(${turn})` }, g);
        svg('circle', { class: 'sh-key', cx: 0, cy: 2.8, r: 2.6 }, k);
        svg('path', { class: 'sh-key', d: 'M-0.8 5 H0.8 V15 H2.6 V16.6 H0.8 V18 H2.2 V19.6 H-0.8 Z' }, k);
      });
      return g;
    },
    /** One brass key, bow up, held between the thumb and the index. */
    key(g) {
      const k = svg('g', { transform: 'translate(-2 9) rotate(-80)' }, g);
      svg('circle', { class: 'sh-key', cx: 0, cy: 0, r: 4 }, k);
      svg('circle', { class: 'sh-key-hole', cx: 0, cy: 0, r: 1.4 }, k);
      svg('path', { class: 'sh-key', d: 'M-1 3.6 H1 V18 H3.6 V20 H1 V22 H3 V24 H-1 Z' }, k);
      return g;
    },
  };

  // ------------------------------------------------------------------
  // The figure
  // ------------------------------------------------------------------

  /** Draws the sheriff into `sway`; returns { pose, face, wear, holdIn }. */
  function build(fig, sway) {
    const defs = svg('defs', {}, fig);
    const gradient = (kind, name, attrs, offsets) => {
      const id = `sh-${name}-${++uid}`;
      const g = svg(kind, { id, ...attrs }, defs);
      offsets.forEach((offset, i) => svg('stop', { offset, class: `sh-${name}-stop-${i}` }, g));
      return { id, g, url: `url(#${id})` };
    };
    const shirt = gradient('linearGradient', 'shirt', { gradientUnits: 'userSpaceOnUse', x1: 40, y1: 90, x2: 124, y2: 210 }, ['0', '0.5', '1']).url;
    const leather = gradient('linearGradient', 'leather', { gradientUnits: 'userSpaceOnUse', x1: 44, y1: 96, x2: 120, y2: 206 }, ['0', '0.55', '1']).url;
    const denim = gradient('linearGradient', 'denim', { gradientUnits: 'userSpaceOnUse', x1: 50, y1: 200, x2: 112, y2: 286 }, ['0', '0.6', '1']).url;
    const felt = gradient('linearGradient', 'felt', { x1: 0, y1: 0, x2: 0.4, y2: 1 }, ['0', '1']).url;
    const silver = gradient('radialGradient', 'silver', { cx: 0.35, cy: 0.3, r: 0.85 }, ['0', '0.6', '1']).url;
    const skins = [1, -1].map((side) => gradient('radialGradient', 'skin', { cx: side < 0 ? 0.62 : 0.38, cy: 0.3, r: 0.9 }, ['0', '0.55', '1']));

    // Legs: straight jeans from the hips to the boot shafts, then boots with
    // a stitched shaft, a slanted heel, and a pointed toe turned out.
    const legs = svg('g', {}, sway);
    for (const side of [1, -1]) {
      const g = svg('g', { transform: mirror(side) }, legs);
      svg('path', { class: 'sh-jeans', fill: denim, d: 'M61 198 C60 222 61 248 62 270 L77 270 C77.6 248 79 222 80 202 Z' }, g);
      svg('path', { class: 'sh-seam', d: 'M70.6 204 C70.4 226 70.2 248 70.4 268' }, g);
      svg('path', { class: 'sh-jeans-light', d: 'M63.4 206 C62.8 228 63.4 250 64 266' }, g);
      // The boot from the front, its toe turned out to the picture's left.
      svg('path', { class: 'sh-boot', d: 'M61.4 266 L77.8 266 L78.4 282 C78.6 286 77 289.6 72 290.4 C66 291.2 56 291.6 50.4 291 C47.6 290.6 47.2 288.6 49.4 287.4 C53 285.6 58.6 284.6 61 282 Z' }, g);
      svg('path', { class: 'sh-heel', d: 'M72.4 289.4 L78 288.6 L77.6 292.4 L72.8 292.6 Z' }, g);
      svg('path', { class: 'sh-sole', d: 'M48.6 289.6 C54 291.4 64 291.6 72.4 290.6' }, g);
      svg('path', { class: 'sh-stitch', d: 'M64 270 C66.4 274 70 274.6 74.6 270 M65 276 C67.6 279 71 279.2 74.4 276' }, g);
      svg('path', { class: 'sh-boot-shine', d: 'M52.6 288 C55.6 287 58.6 286.4 60.8 285' }, g);
    }

    // The trunk: shirt, upper arms, vest, the worn head's layers, collar and
    // bandana, hat, and the forearms in front.
    const trunk = svg('g', {}, sway);
    const torso = svg('g', {}, trunk);
    const upperArms = svg('g', {}, trunk);
    const vestLayer = svg('g', {}, trunk);
    const gearLayer = svg('g', { class: 'sh-gear' }, trunk);
    const wornUnder = svg('g', {}, trunk);
    const collarLayer = svg('g', {}, trunk);
    const wornOver = svg('g', {}, trunk);
    const hatLayer = svg('g', {}, trunk);
    const frontArms = svg('g', {}, trunk);

    // The shirt's body, straight from the shoulders to the hips, tucked in.
    const SHIRT = 'M68 92 Q56 97 46.6 103.4 C44.6 112 45.6 124 47.4 134 C48.6 156 48.4 178 47.6 200 H112.4 C111.6 178 111.4 156 112.6 134 C114.4 124 115.4 112 113.4 103.4 Q104 97 92 92 L80 90.6 Z';
    svg('path', { class: 'sh-shirt sh-outline', fill: shirt, d: SHIRT }, torso);
    svg('path', { class: 'sh-placket', d: 'M80 92 V198' }, torso);
    for (const sy of [104, 122, 140, 158, 176]) svg('circle', { class: 'sh-snap', cx: 80, cy: sy, r: 1.3 }, torso);
    // The belt, its buckle, and the jeans' waistband below it.
    svg('path', { class: 'sh-belt', d: 'M47.4 191 H112.6 V200.6 H47.4 Z' }, torso);
    svg('path', { class: 'sh-belt-stitch', d: 'M48.6 192.6 H111.4 M48.6 199 H111.4' }, torso);
    svg('rect', { class: 'sh-buckle', x: 71.4, y: 188.6, width: 17.2, height: 14, rx: 2.6, fill: silver }, torso);
    svg('rect', { class: 'sh-buckle-inset', x: 74.6, y: 191.6, width: 10.8, height: 8, rx: 1.6 }, torso);
    svg('path', { class: 'sh-jeans sh-outline', fill: denim, d: 'M47.6 200.4 H112.4 L112 210 Q96 214 82 212 L80 206 L78 212 Q64 214 48 210 Z' }, torso);

    // The gun belt, slung low from the left hip down to the right, with a
    // row of cartridges in their loops; the holster hangs from it on the
    // picture's right hip, tied around the thigh, with the revolver's
    // cylinder at its mouth and the grip and hammer above it, where the
    // hanging right hand can reach.
    const wood = gradient('linearGradient', 'wood', { x1: 0, y1: 0, x2: 1, y2: 1 }, ['0', '1']).url;
    svg('path', { class: 'sh-gunbelt', d: 'M46.6 200.4 Q80 210.6 114.8 207.6 L115 214 Q80 217.4 46.4 206.8 Z' }, gearLayer);
    svg('path', { class: 'sh-belt-stitch', d: 'M47.6 202.2 Q80 211.8 114 209.2 M47.4 205.4 Q80 215.4 114 212.6' }, gearLayer);
    for (let k = 0; k < 8; k += 1) {
      const cx = 54 + k * 5.6;
      const u = (cx - 46.6) / 68.2;
      const top = (1 - u) ** 2 * 200.4 + 2 * u * (1 - u) * 210.6 + u * u * 207.6;
      svg('rect', { class: 'sh-cartridge', x: (cx - 1.3).toFixed(2), y: (top - 2.6).toFixed(2), width: 2.6, height: 5.4, rx: 1.1 }, gearLayer);
      svg('rect', { class: 'sh-cartridge-loop', x: (cx - 1.9).toFixed(2), y: (top + 0.6).toFixed(2), width: 3.8, height: 3.2, rx: 0.6 }, gearLayer);
    }
    const holster = svg('g', { class: 'sh-holster' }, gearLayer);
    svg('path', { class: 'sh-holster-tie', d: 'M104.6 243 C100 244.6 96 245.2 92.4 244.6' }, holster);
    svg('path', { class: 'sh-holster-body', fill: leather, d: 'M100.8 206.4 C100.4 220 101.8 235 105 247.4 C106.4 250.6 110.8 250.6 112.2 247.4 C114.6 235 116.4 220 116.2 206.4 Z' }, holster);
    svg('path', { class: 'sh-vest-stitch', d: 'M102.6 209 C102.4 221 103.6 234 106.4 245.4 M114.4 209 C114.2 221 113 234 110.6 245.4' }, holster);
    svg('path', { class: 'sh-holster-welt', d: 'M100.6 206.4 C104 209.4 112.6 209.6 116.4 206.4' }, holster);
    // The revolver: the cylinder at the holster's mouth, the hammer spur,
    // and a walnut grip curving back with two checkered panels.
    svg('rect', { class: 'sh-gun-steel', x: 103.4, y: 199.4, width: 10.8, height: 7.6, rx: 2.4 }, holster);
    svg('path', { class: 'sh-gun-flute', d: 'M106.4 200.6 V205.8 M109 200.4 V206 M111.6 200.6 V205.8' }, holster);
    svg('path', { class: 'sh-gun-steel', d: 'M104.4 200.4 L101.4 196.6 C100.8 195.6 101.8 195 102.6 195.6 L106.6 199.6 Z' }, holster);
    svg('path', { class: 'sh-gun-grip', fill: wood, d: 'M106.2 200.8 C106.6 196.4 108.6 192.2 112.4 189.8 C115 188.2 118.4 189 118.4 191.8 C118.2 195 115.6 197.8 114.4 201.6 Z' }, holster);
    svg('path', { class: 'sh-gun-check', d: 'M109.2 196.6 L113.8 192 M110.6 197.8 L115.4 193 M110 193.6 L114.2 197.4' }, holster);
    svg('circle', { class: 'sh-gun-pin', cx: 112.4, cy: 194.6, r: 0.8 }, holster);

    // Upper arms, under the vest: a sleeve with a round head at the
    // shoulder and a round elbow, coming out of the vest's armhole. Arms
    // reach out to their own side (MOVES), never across the chest.
    const UPPER = `M${ARM.sx - 7.4} ${ARM.sy} A7.4 7.4 0 0 1 ${ARM.sx + 7.4} ${ARM.sy - 1} L${ARM.ex + 7} ${ARM.ey} L${ARM.ex - 7} ${ARM.ey + 1} Z`;
    // The forearm tapers to the wrist, where it is as wide as the hand it
    // runs on into, with a rounded end over the top of the palm, so the
    // wrist has no step.
    const WRIST = 3.9 * HAND_SCALE;
    const FORE = `M${ARM.ex - 6.6} ${ARM.ey} L${ARM.ex + 6.6} ${ARM.ey - 0.6} L${ARM.wx + WRIST} ${ARM.wy - 1.6} Q${ARM.wx} ${ARM.wy + 1.6} ${ARM.wx - WRIST} ${ARM.wy - 1.2} Z`;
    const FORE_SIDES = `M${ARM.ex + 6.6} ${ARM.ey - 0.6} L${ARM.wx + WRIST} ${ARM.wy - 1.6} M${ARM.wx - WRIST} ${ARM.wy - 1.2} L${ARM.ex - 6.6} ${ARM.ey}`;
    const arm = (side) => {
      const upper = svg('g', {}, svg('g', { transform: mirror(side) }, upperArms));
      svg('path', { class: 'sh-limb-ink', d: UPPER }, upper);
      svg('circle', { class: 'sh-limb-ink', cx: ARM.ex, cy: ARM.ey, r: 7 }, upper);
      svg('path', { class: 'sh-shirt', fill: shirt, d: UPPER }, upper);
      svg('circle', { class: 'sh-shirt', fill: shirt, cx: ARM.ex, cy: ARM.ey, r: 7 }, upper);
      svg('path', { class: 'sh-fold', d: `M${ARM.ex - 5} ${ARM.ey - 8} Q${ARM.ex} ${ARM.ey - 5} ${ARM.ex + 5} ${ARM.ey - 9}` }, upper);
      // The forearm and hand: in front of everything, turning with the upper
      // arm, then at the elbow; its sleeve rolled to below the elbow.
      const reachG = svg('g', {}, svg('g', { transform: mirror(side) }, frontArms));
      const fore = svg('g', {}, reachG);
      const grip = svg('g', {}, fore);
      svg('path', { class: 'sh-skin sh-forearm', fill: skins[side > 0 ? 0 : 1].url, d: FORE }, fore);
      svg('path', { class: 'sh-hand-line', d: FORE_SIDES }, fore);
      svg('path', { class: 'sh-cuff sh-outline', fill: shirt, d: `M${ARM.ex - 7.4} ${ARM.ey - 2} L${ARM.ex + 7.4} ${ARM.ey - 2.6} L${ARM.ex + 7.2} ${ARM.ey + 9} L${ARM.ex - 7} ${ARM.ey + 9.6} Z` }, fore);
      svg('path', { class: 'sh-fold', d: `M${ARM.ex - 6.6} ${ARM.ey + 3.6} L${ARM.ex + 6.6} ${ARM.ey + 3}` }, fore);
      const handG = svg('g', {}, grip);
      const drawn = hand(handG, skins[side > 0 ? 0 : 1].url);
      const held = svg('g', { class: 'sh-held' }, handG);
      return { side, upper, reachG, fore, grip, handG, held, drawn, skin: skins[side > 0 ? 0 : 1] };
    };
    const arms = { right: arm(1), left: arm(-1) };

    // The vest: two leather fronts open over the shirt, with welt pockets,
    // stitching, and the silver star on the picture's right chest.
    for (const side of [1, -1]) {
      const g = svg('g', { transform: mirror(side) }, vestLayer);
      svg('path', { class: 'sh-vest sh-outline', fill: leather, d: 'M93.4 92.6 Q104.6 97.6 112.8 103 C114.8 111 114 122 112.2 132 C111 154 111.2 176 111.6 194 C104 197 94 197.6 86 196 C85.6 176 85.2 150 84.8 128 C84.6 116 86.6 104 93.4 92.6 Z' }, g);
      svg('path', { class: 'sh-vest-stitch', d: 'M94.4 96 C88.6 106 87 116 87.2 128 C87.6 150 88 172 88.4 193.6 M110 106 C111.4 113 111 122 109.6 130' }, g);
      svg('path', { class: 'sh-pocket', d: 'M93.4 166 L105.6 165' }, g);
    }
    const star = svg('g', { class: 'sh-star', transform: 'translate(99 128)' }, vestLayer);
    const STAR = Array.from({ length: 10 }, (_, k) => {
      const r = k % 2 ? 4 : 9.4, a = (k * 36 - 90) * Math.PI / 180;
      return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
    });
    svg('path', { class: 'sh-star-body', fill: silver, d: `M${STAR.join(' L')} Z` }, star);
    for (let k = 0; k < 5; k += 1) {
      const a = (k * 72 - 90) * Math.PI / 180;
      svg('circle', { class: 'sh-star-tip', fill: silver, cx: (10.4 * Math.cos(a)).toFixed(2), cy: (10.4 * Math.sin(a)).toFixed(2), r: 1.6 }, star);
    }
    svg('circle', { class: 'sh-star-boss', cx: 0, cy: 0, r: 3 }, star);
    svg('path', { class: 'sh-star-shine', d: 'M-5 -3 L-2 -6' }, star);

    // Neck, collar, and bandana: the bandana sits in front of a worn head's neck.
    const drawnNeck = svg('rect', { class: 'sh-neck', x: 72, y: 78, width: 16, height: 16 }, torso);
    const collar = svg('g', {}, collarLayer);
    svg('path', { class: 'sh-collar sh-outline', fill: shirt, d: 'M68 90 L74 84 L80 96 L86 84 L92 90 L84 100 L80 95 L76 100 Z' }, collar);
    svg('path', { class: 'sh-bandana sh-outline', d: 'M70.4 88.6 C74 93 86 93 89.6 88.6 L86 99 L80 112 L74 99 Z' }, collar);
    svg('path', { class: 'sh-bandana-fold', d: 'M74.6 96 Q80 99 85.4 96 M77 104 L80 110' }, collar);
    svg('circle', { class: 'sh-bandana-knot', cx: 80, cy: 95.4, r: 2.6 }, collar);
    for (const [dx, dy] of [[-4, 102], [3, 98], [1, 106], [-1.6, 93.2], [5, 91.6]]) svg('circle', { class: 'sh-bandana-dot', cx: 80 + dx, cy: dy, r: 0.7 }, collar);

    // The drawn face (export stages): a calm face under the hat.
    const drawnHead = svg('g', { 'data-testid': 'sh-drawn-face' }, torso);
    svg('circle', { class: 'sh-face', cx: 61.4, cy: 66, r: 4.2 }, drawnHead);
    svg('circle', { class: 'sh-face', cx: 98.6, cy: 66, r: 4.2 }, drawnHead);
    svg('ellipse', { class: 'sh-face', cx: 80, cy: 64, rx: 18.6, ry: 21.6 }, drawnHead);
    svg('path', { class: 'sh-hair', d: 'M61.6 60 Q61 46 70 42 Q80 39 90 42 Q99 46 98.4 60 Q96 50 88 48 Q80 46.6 72 48 Q64 50 61.6 60 Z' }, drawnHead);
    const brows = ['M66.6 55.4 Q71 53.6 75.4 55.2', 'M84.6 55.2 Q89 53.6 93.4 55.4'].map((d) => svg('path', { class: 'sh-brow', d }, drawnHead));
    const eyes = [71, 89].map((ex) => {
      const g = svg('g', {}, drawnHead);
      svg('ellipse', { class: 'sh-eye', cx: ex, cy: 61.6, rx: 2.1, ry: 2.5 }, g);
      svg('circle', { class: 'sh-catchlight', cx: ex + 0.7, cy: 60.8, r: 0.7 }, g);
      return g;
    });
    svg('path', { class: 'sh-nose', d: 'M80.8 63.6 Q78.4 69 80.4 70.2 Q82.2 70.6 83 69.6' }, drawnHead);
    const mouth = svg('path', { class: 'sh-mouth', d: 'M73.6 76.4 Q80 80.4 86.4 76.4' }, drawnHead);
    const openMouth = svg('ellipse', { class: 'sh-mouth-open', cx: 80, cy: 77.6, rx: 4.6, ry: 0, opacity: 0 }, drawnHead);

    // The hat: a felt crown pinched at the front, a band, and a brim curled
    // up at the sides; it can tip on its brim (hatTip).
    const hat = svg('g', { class: 'sh-hat' }, hatLayer);
    svg('path', { class: 'sh-brim sh-outline', fill: felt, d: 'M40.6 44.8 C46 49.8 60 52.4 80 52.4 C100 52.4 114 49.8 119.4 44.8 C121.6 42.6 119 41.4 115.4 42.8 C108 45.4 96 46.6 80 46.6 C64 46.6 52 45.4 44.6 42.8 C41 41.4 38.4 42.6 40.6 44.8 Z' }, hat);
    svg('path', { class: 'sh-crown sh-outline', fill: felt, d: 'M58.6 46.4 C58 36 59.6 26.6 64 21.6 C68 18.6 72.6 21 76.6 19.6 C79 18.8 81 18.8 83.4 19.6 C87.4 21 92 18.6 96 21.6 C100.4 26.6 102 36 101.4 46.4 C94 47.6 66 47.6 58.6 46.4 Z' }, hat);
    svg('path', { class: 'sh-crease', d: 'M80 21 C79.4 27 79.6 33 80 38 M66.6 26 C68 30 69 34 69.6 38 M93.4 26 C92 30 91 34 90.4 38' }, hat);
    svg('path', { class: 'sh-band', d: 'M58.8 40.6 C66 42 94 42 101.2 40.6 L101.4 46.2 C94 47.6 66 47.6 58.6 46.2 Z' }, hat);
    svg('path', { class: 'sh-brim-shine', d: 'M47 46.6 C56 49.6 66 50.6 76 50.8' }, hat);
    svg('path', { class: 'sh-crown-shine', d: 'M63 40 C62.4 32 63.6 27 66.4 24.4' }, hat);

    const poseArm = (a, [up, fo], wrist, curls) => {
      const shoulder = `rotate(${(-up).toFixed(1)} ${ARM.sx} ${ARM.sy})`;
      a.upper.setAttribute('transform', shoulder);
      a.reachG.setAttribute('transform', shoulder);
      a.fore.setAttribute('transform', `rotate(${(up - fo).toFixed(1)} ${ARM.ex} ${ARM.ey})`);
      // The hand turns at the wrist, its fingers down the forearm; its light
      // turns back so the upper left stays lit.
      const turn = ARM.foreDir - 90;
      a.handG.setAttribute('transform', `translate(${ARM.wx} ${ARM.wy - 2}) rotate(${(turn - clamp(wrist, -70, 70)).toFixed(1)}) scale(${HAND_SCALE})`);
      a.skin.g.setAttribute('gradientTransform', `rotate(${fo.toFixed(1)} .5 .5)`);
      a.drawn.shape(curls);
    };
    function pose(p) {
      poseArm(arms.right, p.right, p.rightWrist, p.rightCurl);
      poseArm(arms.left, p.left, p.leftWrist, p.leftCurl);
      const tilt = `translate(0 ${(1.6 * p.nod).toFixed(2)}) rotate(${p.tilt.toFixed(2)} 80 84.5)`;
      drawnHead.setAttribute('transform', tilt);
      for (const layer of [wornUnder, wornOver]) layer.setAttribute('transform', tilt);
      hat.setAttribute('transform', `${tilt} translate(0 ${(-5 * p.hatTip).toFixed(2)}) rotate(${(-9 * p.hatTip).toFixed(2)} 104 46)`);
    }
    let worn;
    function face(time, p, reduced, sing = 0) {
      if (worn) {
        worn(time, { look: p.look, down: p.down, wink: 0, brow: p.brow, hush: 0, sing }, reduced);
        return;
      }
      mouth.setAttribute('opacity', (1 - Math.min(1, sing * 3)).toFixed(2));
      openMouth.setAttribute('opacity', Math.min(1, sing * 3).toFixed(2));
      openMouth.setAttribute('ry', (4.2 * sing).toFixed(2));
      brows.forEach((b) => b.setAttribute('transform', `translate(0 ${(-2 * p.brow).toFixed(2)})`));
      eyes.forEach((eye) => eye.setAttribute('transform', `translate(${(1.5 * p.look).toFixed(2)} ${(1.2 * p.down).toFixed(2)})`));
    }
    function wear(head) {
      if (!worn) {
        fig.classList.add('sh-art--hero');
        drawnNeck.setAttribute('display', 'none');
        drawnHead.setAttribute('display', 'none');
      }
      for (const layer of [wornUnder, wornOver]) layer.replaceChildren();
      // The hero's face where the drawn one was, its chin above the bandana.
      worn = head.wear({ underCollar: wornUnder, overCollar: wornOver }, { x: 80, chin: 84.5, width: 38 });
      head.paint(fig);
    }
    /** Puts `prop` (a PROPS key, or null) in the right or left hand. */
    function holdIn(side, prop) {
      const a = arms[side];
      a.held.replaceChildren();
      if (prop) PROPS[prop](svg('g', { class: `sh-prop sh-prop--${prop}` }, a.held));
    }
    return { pose, face, wear, holdIn };
  }

  // ------------------------------------------------------------------
  // Moves
  // ------------------------------------------------------------------

  /** At ease: hands relaxed at the sides. */
  const AT_EASE = {
    right: [4, 2], left: [4, 2], rightWrist: 0, leftWrist: 0,
    rightCurl: SHAPES.rest, leftCurl: SHAPES.rest,
    look: 0, down: 0, brow: 0, nod: 0, tilt: 0, hatTip: 0,
  };
  // Hands on the hips: the elbows out to each side, the fists at each hip
  // (figure points; reach mirrors the left arm itself).
  const HIPS = { right: reach([110, 184], 1, 'out'), left: reach([50, 184], -1, 'out'), rightWrist: 30, leftWrist: 30, rightCurl: SHAPES.fist, leftCurl: SHAPES.fist };
  // Ready to draw: the right hand hovers over the revolver's grip, fingers
  // half curled, the elbow out; the left fist on its hip.
  const DRAW = { right: reach([115, 177], 1, 'out'), rightWrist: 34, rightCurl: SHAPES.claw, left: HIPS.left, leftWrist: 30, leftCurl: SHAPES.fist };
  // The hat tip: the elbow out and up, the fingers pinching the brim.
  const TIP_HAND = reach([110, 50], 1, 'out');
  const toRest = (at, sides = ['right'], duration = 0.6) => [at, duration, Object.fromEntries(sides.flatMap((s) => [[s, AT_EASE[s]], [`${s}Wrist`, 0], [`${s}Curl`, SHAPES.rest]]))];

  /**
   * The sheriff's moves for sheriff({ moves }): each a list of pose keys
   * [delay, duration, fields] from its sung moment. `point` and `present`
   * aim at a stage point (`to`), converted to the figure's frame, with the
   * arm on the target's side, so an arm reaches out and never across the
   * chest. Each returns its arm to rest after `hold` seconds.
   */
  const MOVES = {
    point: ({ to, hold = 1.2, side: forced }, frame) => {
      const target = frame(to);
      const side = forced ?? (target[0] < 80 ? 'left' : 'right');
      const pose = reach(target, side === 'right' ? 1 : -1, 'down');
      return [[-0.25, 0.5, { [side]: pose, [`${side}Wrist`]: 0, [`${side}Curl`]: SHAPES.point }], [-0.05, 0.35, { look: target[0] < 80 ? -0.8 : 0.8 }], [hold, 0.4, { look: 0 }], toRest(hold, [side])];
    },
    present: ({ to, hold = 1.4, side: forced }, frame) => {
      const target = frame(to);
      const side = forced ?? (target[0] < 80 ? 'left' : 'right');
      const pose = reach([80 + (target[0] - 80) * 0.5, Math.min(170, 120 + (target[1] - 120) * 0.3)], side === 'right' ? 1 : -1, 'down');
      return [[-0.25, 0.55, { [side]: pose, [`${side}Wrist`]: -30, [`${side}Curl`]: SHAPES.open }], [-0.05, 0.35, { look: target[0] < 80 ? -0.7 : 0.7, brow: 0.5 }], [hold, 0.45, { look: 0, brow: 0 }], toRest(hold, [side])];
    },
    tip: ({ hold = 0.9 }) => [
      [-0.4, 0.5, { right: TIP_HAND, rightWrist: -20, rightCurl: SHAPES.pinch }], [0.05, 0.3, { hatTip: 1, nod: 0.8, brow: 0.6 }],
      [hold, 0.35, { hatTip: 0, nod: 0, brow: 0 }], toRest(hold + 0.2),
    ],
    hips: ({ hold = 1.6 }) => [[-0.2, 0.55, HIPS], [0.1, 0.3, { tilt: -3 }], [hold, 0.4, { tilt: 0 }], toRest(hold, ['right', 'left'])],
    /** Reaches for the holstered revolver and waits, fingers twitching once; the gun stays holstered. */
    draw: ({ hold = 1.8 }) => [
      [-0.3, 0.45, DRAW], [0.05, 0.3, { tilt: -2, look: 0.3 }],
      [0.6, 0.18, { rightCurl: SHAPES.rest }], [0.78, 0.2, { rightCurl: SHAPES.claw }],
      [hold, 0.4, { tilt: 0, look: 0 }], toRest(hold, ['right', 'left']),
    ],
    nod: () => [[0, 0.22, { nod: 1 }], [0.3, 0.28, { nod: 0 }]],
    look: ({ dir = -1, hold = 1 }) => [[0, 0.25, { look: dir, tilt: dir * 2 }], [hold, 0.3, { look: 0, tilt: 0 }]],
    hold: ({ side: forced, to = [150, 150], hold = 1.6 }, frame) => {
      const target = frame(to);
      const side = forced ?? (target[0] < 80 ? 'left' : 'right');
      return [[-0.3, 0.5, { [side]: reach(target, side === 'right' ? 1 : -1, 'down'), [`${side}Wrist`]: 10, [`${side}Curl`]: SHAPES.grip }], toRest(hold, [side])];
    },
  };

  /** A pose at song time t from timed keys: each field eases to its key's value. */
  function poseTrack(keys) {
    const sorted = keys.slice().sort((a, b) => a[0] - b[0]);
    const lerp = (a, b, u) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * u) : a + (b - a) * u);
    return (t, reduced) => {
      const state = { ...AT_EASE };
      for (const [start, duration, fields] of sorted) {
        if (t < start) break;
        const u = reduced ? 1 : easeInOutCubic(clamp((t - start) / duration, 0, 1));
        for (const [name, value] of Object.entries(fields)) state[name] = lerp(state[name], value, u);
      }
      return state;
    };
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
  function mouthAt(words, t, reduced) {
    let lo = 0, hi = words.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (words[mid][0] <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (found < 0) return 0;
    const [start, end] = words[found];
    if (t >= end) return 0;
    const length = Math.max(0.08, end - start), age = t - start;
    const peak = length > 0.8 ? 0.85 : length > 0.35 ? 0.7 : 0.5;
    const closeFrom = length > 0.8 ? length - 0.14 : length * 0.62;
    const fall = age < closeFrom ? 1 : Math.max(0, 1 - (age - closeFrom) / Math.max(0.05, length - closeFrom));
    const wobble = length > 0.8 && !reduced ? 0.06 * Math.sin(age * 2 * Math.PI * 5.4) : 0;
    return clamp(peak * Math.min(1, age / 0.06) * fall + wobble, 0, 1);
  }

  /**
   * The sheriff on stage from `at` to `until`, its feet at stage (x + 80 ×
   * scale, y + 300 × scale): `entrance` 'left' or 'right' glides it in (or
   * 'rise'); `moves` = [[time, name, options]] (MOVES); `holds` = [[time,
   * side, prop]] (PROPS, or null to empty the hand); `hero` is a promise of
   * SongStudentAvatar's heroHead, whose face it wears while on stage;
   * `words` = sorted [start, end] sung-word intervals (wordsOf) its mouth
   * opens on.
   */
  function sheriff(parent, { x, y, scale = 1, at, until, entrance = 'rise', moves = [], holds = [], hero, words = [] }) {
    const wrap = place(el('div', 'sh-sheriff is-staged', parent), x, y);
    wrap.dataset.testid = 'sheriff';
    wrap.style.width = `${160 * scale}px`;
    const fig = svg('svg', { class: 'sh-art', viewBox: '0 0 160 300', width: 160 * scale, height: 300 * scale, 'aria-hidden': 'true' }, wrap);
    const travel = svg('g', {}, fig);
    const shadow = svg('g', { class: 'sh-shadow' }, travel);
    svg('ellipse', { cx: 80, cy: 292, rx: 46, ry: 5.5 }, shadow);
    const sway = svg('g', {}, travel);
    const body = build(fig, sway);
    let onStage = false, dress = null, disposed = false;
    onDispose(() => { disposed = true; });
    hero?.then((heads) => {
      if (heads && !disposed) dress = heads.dresser(body.wear, onStage);
    }).catch(() => {
      // The saved face is optional; the drawn sheriff remains.
    });
    // Stage points into the figure's own frame.
    const frame = ([sx, sy]) => [(sx - x) / scale, (sy - y) / scale];
    const track = poseTrack(moves.flatMap(([when, name, options = {}]) => MOVES[name](options, frame).map(([delay, duration, fields]) => [when + delay, duration, fields])));
    const heldAt = holds.slice().sort((a, b) => a[0] - b[0]);
    const holding = { right: undefined, left: undefined };
    const side = entrance === 'left' ? -1 : 1;
    const GLIDE = 0.95;
    onFrame((t) => {
      const local = t - at;
      const reduced = reducedMotion.matches;
      for (const s of ['right', 'left']) {
        const latest = heldAt.filter(([when, which]) => which === s && when <= t).pop();
        const prop = latest ? latest[2] : null;
        if (prop !== holding[s]) {
          holding[s] = prop;
          body.holdIn(s, prop);
        }
      }
      const shift = reduced ? 0 : 0.5 * Math.sin(local * 0.9) + 0.25 * Math.sin(local * 2.1 + 0.7);
      const breath = reduced ? 1 : 1 + 0.004 * Math.sin(local * 1.6);
      sway.setAttribute('transform', `rotate(${shift.toFixed(2)} 80 290) translate(80 290) scale(1 ${breath.toFixed(4)}) translate(-80 -290)`);
      let glide = 0, lean = 0;
      if (!reduced && entrance !== 'rise' && local < GLIDE) {
        const u = progress(t, at, GLIDE);
        glide = side * 70 * (1 - u) ** 3;
        lean = -side * 6 * Math.exp(-3.5 * u) * Math.cos(2.6 * Math.PI * u);
      }
      travel.setAttribute('transform', `translate(${glide.toFixed(2)} 0) rotate(${lean.toFixed(2)} 80 290)`);
      const p = track(t, reduced);
      body.pose(p);
      const shown = local >= 0 && (until === undefined || t <= until + 0.3);
      onStage = shown && wrap.isConnected;
      dress?.(onStage);
      if (shown) body.face(local, p, reduced, mouthAt(words, t, reduced));
    });
    if (entrance === 'rise') fx.rise(wrap, at, { distance: 20, duration: 0.45 });
    else fx.fadeIn(wrap, at, 0.22);
    if (until !== undefined) fx.fadeOut(wrap, until, 0.3);
    return wrap;
  }

  window.Sheriff = { sheriff, reach, wordsOf, mouthAt, MOVES };
})();
