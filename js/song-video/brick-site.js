/*
 * The "brick-site" stage theme for "Not a One-Time Investment", the
 * design-with-reuse song: a construction site of toy bricks at sunrise,
 * after the title picture of Lecture 12 (a campus hall built of blue, gold,
 * and tan bricks while a crane lifts a prebuilt module into place, the
 * lecture's image of reuse). Storyboards select it with `theme: brick-site`;
 * css/song-video-brick-site.css holds its colours.
 *
 * Back to front: a dawn sky with a rising sun, hills, and layered clouds; a far
 * skyline; a twin-towered hall on the left (tiled pyramid roofs with
 * finials, an arcaded belfry in each tower, cornices of blue and gold
 * bricks, a loggia of arches along its front wing); a building going up on
 * the right (an unfinished top course, an open storey behind scaffolding,
 * bricks waiting on a plank); a tower crane whose jib crosses the top of
 * the stage and carries a prebuilt module of bricks slowly towards the
 * site; lamp posts; and a studded baseplate as the ground, with large loose
 * bricks in front. Every window is a toy window piece: a pale frame, glass
 * split by mullions, a sill. Only some rooms are occupied, with varied warm
 * interior light over cool, recessed glass. As morning brightens, the lamps
 * and room lights fade while sky reflections and window frames brighten.
 * Depth comes from light and shadow: the glass sits back in its
 * frame, frames and sills and eaves cast shadows, a few bricks in every
 * wall are a shade lighter or darker, the crane is a square truss with its
 * far faces in shadow, soft contact shadows ground the buildings and lamps
 * on the baseplate, and faint shafts of light fan up from the low sun. The casebook spreads of js/song-video/reuse-kit.js stand on the
 * ground in front of all this.
 *
 * The ground, studs, loose bricks, lamps and sky are present from frame zero.
 * During the intro (BUILD), the ground-floor bases rise course by course,
 * the crane's mast climbs and its jib reaches out, and in the instrumental
 * the crane lifts the prebuilt module off the ground. The three refrains add
 * lower floors, upper walls, then belfries and roofs. Construction holds
 * between refrains. At the end the crane fills the site's final module slot.
 *
 * Between the build and the set-down, the open teaching composition leaves
 * the site visible. Clouds drift gently with their highlights facing the sun;
 * the forklift settles while the diagrams explain each case. Architectural
 * detail stays crisp on both sides. The crane, its pennant, and the hanging
 * module hold still once the module is up. The forklift resumes in the finale.
 *
 * The sky starts in blue hour with cool violet cloud shadows. Their
 * rose undersides are already lit before the sun appears, then brighten into
 * peach and gold as it rises. The last stars disappear, and the windows and
 * lamps yield to golden daylight. This reverses the security song's cloud
 * lighting, retaining its cool upper masses and warm lower surfaces.
 *
 * Every pose is a pure function of song time, including backwards seeks.
 * The sunrise changes brightness over minutes, never in flashes. With
 * reduced motion the scenery is fully built in a still mid-morning pose.
 * The player hides this decorative artwork in print in favour of its transcript.
 */
(function () {
  'use strict';

  const { onFrame, clamp, easeInOutCubic, hash01 } = window.Timeline;
  const { el, svg } = window.SongKit;
  const W = 960;
  const H = 540;
  const GROUND = 466;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  /** One course of bricks: the height, and the width of one brick in it. */
  const COURSE = 12;
  const BRICK = 28;
  /**
   * The intro's build, in song seconds: each part's start and finish. The
   * prebuilt module is lifted in the instrumental before verse 1, and set
   * onto the site at the end of the song.
   */
  const BUILD = {
    hall: [1.0, 7.4], site: [2.2, 7.8],
    mast: [3.0, 6.2], jib: [6.2, 7.6],
    lift: [8.4, 11.8],
  };
  const SET_DOWN = 9.0;
  const TROLLEY_X = 812;  // over the site's unfinished left part (x 766–858)
  const MODULE_BOTTOM = 98;

  /** A gradient whose stops take their colours from CSS classes. */
  function gradient(defs, tag, id, attrs, stops) {
    const grad = svg(tag, { id, ...attrs }, defs);
    stops.forEach(([offset, className]) => svg('stop', { offset, class: className }, grad));
    return grad;
  }

  function definitions(art) {
    const defs = svg('defs', {}, art);
    const horizontal = { x1: 0, y1: 0, x2: 1, y2: 0 };
    const vertical = { x1: 0, y1: 0, x2: 0, y2: 1 };
    gradient(defs, 'linearGradient', 'bs-sky', vertical, [
      [0, 'bs-sky-0'], [0.4, 'bs-sky-1'], [0.68, 'bs-sky-2'], [0.87, 'bs-sky-3'], [1, 'bs-sky-4'],
    ]);
    gradient(defs, 'radialGradient', 'bs-sun', { cx: 0.5, cy: 0.5, r: 0.5 }, [[0, 'bs-sun-0'], [0.35, 'bs-sun-1'], [1, 'bs-sun-2']]);
    gradient(defs, 'radialGradient', 'bs-lamp-glow', { cx: 0.5, cy: 0.5, r: 0.5 }, [[0, 'bs-lamp-0'], [1, 'bs-lamp-1']]);
    gradient(defs, 'linearGradient', 'bs-lit', horizontal, [[0, 'bs-lit-0'], [0.55, 'bs-lit-1'], [1, 'bs-lit-2']]);
    gradient(defs, 'linearGradient', 'bs-side', vertical, [[0, 'bs-side-0'], [1, 'bs-side-1']]);
    gradient(defs, 'linearGradient', 'bs-shadow', horizontal, [[0, 'bs-shadow-0'], [0.45, 'bs-shadow-1'], [1, 'bs-shadow-2']]);
    gradient(defs, 'linearGradient', 'bs-roof', horizontal, [[0, 'bs-roof-0'], [0.5, 'bs-roof-1'], [0.5, 'bs-roof-2'], [1, 'bs-roof-3']]);
    // The same lower-surface lighting as the security song's sunset, with
    // its palette progressing in reverse: blue hour into golden hour.
    gradient(defs, 'linearGradient', 'bs-cloud', vertical, [[0, 'bs-cloud-0'], [0.48, 'bs-cloud-1'], [0.8, 'bs-cloud-2'], [1, 'bs-cloud-3']]);
    defs.querySelector('.bs-cloud-3').setAttribute('data-testid', 'reuse-cloud-highlight');
    gradient(defs, 'linearGradient', 'bs-cloud-edge', vertical, [[0, 'bs-cloud-edge-0'], [0.55, 'bs-cloud-edge-1'], [1, 'bs-cloud-edge-2']]);
    gradient(defs, 'linearGradient', 'bs-haze', vertical, [[0, 'bs-haze-0'], [1, 'bs-haze-1']]);
    gradient(defs, 'linearGradient', 'bs-morning', vertical, [[0, 'bs-morning-0'], [0.42, 'bs-morning-1'], [0.7, 'bs-morning-2'], [1, 'bs-morning-3']]);
    gradient(defs, 'linearGradient', 'bs-plate', vertical, [[0, 'bs-plate-0'], [0.1, 'bs-plate-1'], [1, 'bs-plate-2']]);
    gradient(defs, 'linearGradient', 'bs-base-shadow', vertical, [[0, 'bs-base-shadow-0'], [1, 'bs-base-shadow-1']]);
    gradient(defs, 'linearGradient', 'bs-glass-dark', vertical, [[0, 'bs-glass-dark-0'], [0.46, 'bs-glass-dark-1'], [1, 'bs-glass-dark-2']]);
    defs.querySelector('.bs-glass-dark-0').setAttribute('data-testid', 'reuse-window-sky-reflection');
    gradient(defs, 'radialGradient', 'bs-glass-lit', { cx: 0.42, cy: 0.24, r: 0.9 }, [[0, 'bs-glass-lit-0'], [0.38, 'bs-glass-lit-1'], [0.75, 'bs-glass-lit-2'], [1, 'bs-glass-lit-3']]);
    gradient(defs, 'linearGradient', 'bs-stud-side', horizontal, [[0, 'bs-stud-side-0'], [0.35, 'bs-stud-side-1'], [1, 'bs-stud-side-2']]);
    gradient(defs, 'linearGradient', 'bs-cast', vertical, [[0, 'bs-cast-0'], [1, 'bs-cast-1']]);
    gradient(defs, 'linearGradient', 'bs-ray', horizontal, [[0, 'bs-ray-0'], [1, 'bs-ray-1']]);
    // Brick courses: mortar lines in running bond, one pattern for every wall.
    const bond = svg('pattern', { id: 'bs-bond', width: 28, height: 24, patternUnits: 'userSpaceOnUse' }, defs);
    svg('path', { class: 'bs-mortar', d: 'M0 11.5 H28 M0 23.5 H28 M0.5 0 V12 M14.5 12 V24' }, bond);
    // A few bricks in each run a shade lighter or darker, as real bricks are,
    // laid on the same running bond (three bricks a course, two courses).
    const tint = svg('pattern', { id: 'bs-tint', width: 84, height: 24, patternUnits: 'userSpaceOnUse' }, defs);
    [[0, 0, 28, 'light'], [56, 0, 28, 'dark'], [42, 12, 28, 'light'], [70, 12, 14, 'dark'], [0, 12, 14, 'dark']]
      .forEach(([tx, ty, tw, tone]) => svg('rect', { class: `bs-tint--${tone}`, x: tx, y: ty, width: tw, height: 11.5 }, tint));
  }

  // ------------------------------------------------------------------
  // Sky
  // ------------------------------------------------------------------

  /** Smooth a closed contour through the midpoints of its control points. */
  function cloudOutline(points) {
    const midpoint = (a, b) => `${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2).toFixed(1)}`;
    let path = `M${midpoint(points[points.length - 1], points[0])}`;
    points.forEach((point, i) => {
      path += ` Q${point[0].toFixed(1)} ${point[1].toFixed(1)} ${midpoint(point, points[(i + 1) % points.length])}`;
    });
    return `${path} Z`;
  }

  // Unequal shoulders, hollows, and tapered tails make the banks read as
  // wind-shaped masses rather than copies of one regularly scalloped ribbon.
  const CLOUD_PROFILES = [
    {
      upper: [[-30, 20], [-5, 11], [19, 12], [32, -5], [59, -3], [81, -30], [117, -36], [145, -21], [168, -32], [201, -27], [225, -10], [261, -16], [290, -3], [327, -7], [352, 10], [390, 17]],
      lower: [[-30, 20], [4, 29], [29, 25], [49, 39], [76, 35], [113, 49], [135, 44], [165, 52], [203, 40], [233, 44], [261, 34], [298, 37], [323, 25], [358, 28], [390, 17]],
    },
    {
      upper: [[-30, 24], [2, 20], [19, 9], [48, 13], [70, -8], [89, -5], [106, -26], [142, -33], [167, -15], [204, -20], [228, -9], [252, -12], [286, 5], [322, 3], [347, 12], [390, 10]],
      lower: [[-30, 24], [8, 30], [37, 27], [57, 40], [87, 38], [109, 46], [146, 40], [168, 45], [205, 32], [232, 35], [251, 25], [279, 27], [309, 18], [338, 22], [390, 10]],
    },
    {
      upper: [[-30, 10], [1, 8], [31, -2], [54, 4], [81, -7], [111, -1], [130, -15], [153, -11], [172, -34], [210, -40], [237, -24], [258, -29], [286, -14], [318, -18], [351, 2], [390, 12]],
      lower: [[-30, 10], [3, 23], [39, 17], [60, 33], [89, 29], [111, 42], [151, 39], [184, 52], [208, 46], [231, 49], [260, 35], [293, 39], [326, 24], [352, 27], [390, 12]],
    },
  ];

  function cloudContours(variant) {
    const profile = CLOUD_PROFILES[variant % CLOUD_PROFILES.length];
    const body = cloudOutline([...profile.upper, ...profile.lower.toReversed()]);
    const rim = [[1, 4], [6, 9], [11, 13]].map(([from, to]) => {
      const edge = profile.lower.slice(from, to + 1);
      const inset = edge.map(([x, y], i) => [x, y - Math.sin(Math.PI * i / (edge.length - 1)) * 2.4]);
      return cloudOutline([...inset, ...edge.toReversed()]);
    }).join(' ');
    return { body, rim };
  }

  /** Small overlapping volumes stay clipped inside their bank's silhouette. */
  function cloudInterior(parent, variant, highlightId) {
    const rolls = [[24, 7, 1.05], [110, -1, 1.35], [224, 5, 1.1]];
    rolls.forEach(([x, y, scale], i) => {
      const profile = CLOUD_PROFILES[(variant + i + 1) % CLOUD_PROFILES.length];
      const points = [...profile.upper, ...profile.lower.toReversed()];
      const patch = points.map(([px, py]) => [x + (px + 30) * scale * 0.32, y + py * 0.6]);
      svg('path', { class: 'bs-cloud-roll', d: cloudOutline(patch) }, parent);
    });
    [[41, 25, 0.55], [148, 31, 0.72], [262, 23, 0.48]].forEach(([x, y, scale]) => {
      const points = [[0, 3], [13, 0], [22, -5], [37, -2], [51, -10], [67, -6], [82, -7], [107, -1], [132, -3], [111, 6], [85, 4], [68, 11], [45, 7], [26, 10]];
      svg('path', { class: 'bs-cloud-filament', fill: `url(#${highlightId})`, d: cloudOutline(points.map(([px, py]) => [x + px * scale, y + py * scale])) }, parent);
    });
  }

  /** A layered bank with shaded billows and fine detached wind-torn wisps. */
  function cloud(parent, { scale = 1, variant = 0 } = {}) {
    const g = svg('g', { class: 'bs-cloud', 'data-testid': 'reuse-cloud-bank' }, parent);
    const shape = svg('g', { transform: `scale(${scale})`, 'data-testid': 'reuse-cloud-shape' }, g);
    const defs = svg('defs', {}, shape);
    const lighting = svg('linearGradient', {
      id: `bs-cloud-edge-${variant}`, href: '#bs-cloud-edge', gradientUnits: 'userSpaceOnUse',
      'data-testid': 'reuse-cloud-light-direction',
    }, defs);
    const highlightId = lighting.id;
    const contours = cloudContours(variant);
    svg('path', { class: 'bs-cloud-body', d: contours.body }, shape);
    svg('path', { class: 'bs-cloud-sunlight', fill: `url(#${highlightId})`, d: contours.body }, shape);
    const clipId = `bs-cloud-interior-${variant}`;
    const clip = svg('clipPath', { id: clipId }, shape);
    svg('path', { d: contours.body }, clip);
    const interior = svg('g', { 'clip-path': `url(#${clipId})` }, shape);
    cloudInterior(interior, variant, highlightId);
    svg('path', { class: 'bs-cloud-light', fill: `url(#${highlightId})`, d: contours.rim }, shape);
    // The small scraps vary in position and width; they never repeat evenly.
    [[-39, 31, 32], [317, 40, 44], [365, 25, 24]].forEach(([x, y, w], i) => {
      const shift = 8 * hash01(variant * 31 + i * 7);
      svg('path', { class: 'bs-cloud-scrap', d: cloudOutline([[x, y], [x + w * 0.2, y - 3 - shift * 0.2], [x + w * 0.6, y - 1], [x + w, y - 5], [x + w * 0.75, y + 1], [x + w * 0.35, y + 3]]) }, shape);
    });
    return { node: g, lighting, scale };
  }

  /** Move the bank and aim its light in local SVG coordinates. The gradient
   * runs from the shaded side toward the sun, accounting for drift and scale. */
  function poseCloud(bank, time, sun) {
    const x = bank.x + time * bank.speed;
    bank.node.setAttribute('transform', `translate(${x.toFixed(3)} ${bank.y})`);
    const dx = (sun.x - x) / bank.scale - 180;
    const dy = (sun.y - bank.y) / bank.scale - 8;
    const distance = Math.hypot(dx, dy);
    const ux = dx / distance;
    const uy = dy / distance;
    // Project the bank's half-width/height onto the light direction. This
    // keeps the same relief when a low bank is lit from the side at sunrise.
    const reach = 210 * Math.abs(ux) + 46 * Math.abs(uy);
    const axis = { x1: 180 - ux * reach, y1: 8 - uy * reach, x2: 180 + ux * reach, y2: 8 + uy * reach };
    Object.entries(axis).forEach(([name, value]) => bank.lighting.setAttribute(name, value.toFixed(3)));
  }

  /** Repeated tapered wisps cover the whole top edge while drifting. */
  function cloudBand(parent, y, w) {
    const g = svg('g', { class: 'bs-cloud-band' }, parent);
    for (let copy = -1; copy < 2; copy++) {
      for (let i = 0; i < 4; i++) {
        const x = copy * w + i * w / 4;
        const yy = y + 13 * hash01(i * 17 + 2);
        svg('path', { class: 'bs-cloud-wisp', d: `M${x - 28} ${yy} C${x + 45} ${yy - 18} ${x + 104} ${yy + 12} ${x + 205} ${yy - 6} C${x + 135} ${yy + 18} ${x + 39} ${yy + 3} ${x - 28} ${yy} Z` }, g);
      }
    }
    return g;
  }

  // ------------------------------------------------------------------
  // Brick walls and their pieces
  // ------------------------------------------------------------------

  const windows = [];

  /**
   * A toy window piece: a pale frame (arched or square), glass split by
   * mullions, and a sill. Only occupied rooms have interior light, with a
   * stable brightness per room. `lightsOffAt` is a threshold in the dawn
   * lighting progression; unlit glass reflects the brightening sky.
   */
  function windowPiece(parent, x, y, w, h, { arched = true, occupied = false, lightsOffAt = 0.5, panes = 2 } = {}) {
    const g = svg('g', { class: 'bs-win' }, parent);
    const r = w / 2;
    const outline = (inset) => {
      const left = x + inset;
      const right = x + w - inset;
      const top = y + inset;
      const bottom = y + h - inset;
      if (!arched) return `M${left} ${top} H${right} V${bottom} H${left} Z`;
      const rr = r - inset;
      return `M${left} ${bottom} V${y + r} A${rr} ${rr} 0 0 1 ${right} ${y + r} V${bottom} Z`;
    };
    // The frame casts a shadow down and to the right onto the wall.
    svg('path', { class: 'bs-win-cast', d: outline(0), transform: 'translate(2 2.5)' }, g);
    svg('path', { class: 'bs-win-frame', d: outline(0) }, g);
    const paneId = `bs-window-pane-${windows.length}`;
    const clip = svg('clipPath', { id: paneId }, g);
    svg('path', { d: outline(2.6) }, clip);
    const pane = svg('g', { 'clip-path': `url(#${paneId})` }, g);
    svg('path', { class: 'bs-win-dark', d: outline(2.6) }, pane);
    const lit = svg('g', { class: 'bs-win-lit', 'data-testid': 'reuse-window-light' }, pane);
    svg('path', { class: 'bs-room-light', d: outline(2.6) }, lit);
    // A ceiling-lit room has a darker floor and recess, not a glowing disc.
    svg('rect', { class: 'bs-room-floor', x, y: y + h * 0.82, width: w, height: h * 0.18 }, lit);
    svg('path', { class: 'bs-room-reveal', d: `M${x + 3} ${y + h - 3} V${y + h * 0.28} M${x + w - 3} ${y + h * 0.28} V${y + h - 3}` }, lit);
    // Broad, quiet sky reflections replace the identical white diagonal slash.
    // Stable geometry keeps seeking deterministic and avoids decorative motion.
    const reflectionY = y + h * (0.42 + 0.1 * hash01(x * 13 + y));
    svg('path', {
      class: 'bs-win-reflect',
      d: `M${x} ${y} H${x + w} V${reflectionY.toFixed(1)} Q${x + w * 0.55} ${(reflectionY + 2).toFixed(1)} ${x} ${(reflectionY - h * 0.1).toFixed(1)} Z`,
    }, pane);
    svg('path', { class: 'bs-win-glint', d: `M${x + w - 4} ${y + h * 0.3} V${y + h - 5}` }, pane);
    // The glass sits back inside its frame; the inking stays above the light.
    svg('path', { class: 'bs-win-inner', d: outline(2.6) }, g);
    // Mullions: a centre bar, and a transom bar where the arch begins.
    let bars = `M${x + w / 2} ${y + 2.6} V${y + h - 2.6}`;
    if (panes > 1) bars += ` M${x + 2.6} ${(arched ? y + r : y + h * 0.45).toFixed(1)} H${x + w - 2.6}`;
    svg('path', { class: 'bs-win-bar', d: bars }, g);
    svg('rect', { class: 'bs-win-sill-shadow', x: x - 1.5, y: y + h + 3, width: w + 5, height: 2.5 }, g);
    svg('rect', { class: 'bs-win-sill', x: x - 2.5, y: y + h - 0.5, width: w + 5, height: 3.5, rx: 1 }, g);
    const brightness = occupied ? 0.9 + 0.1 * hash01(x * 17 + y * 11) : 0;
    windows.push({ lit, brightness, lightsOffAt, shown: -1 });
    return g;
  }

  /** A row of studs along the top edge of a wall, seen from the front. */
  function studs(parent, x0, x1, y, { pitch = 14, w = 9, h = 4, cls = 'bs-stud' } = {}) {
    for (let x = x0 + pitch / 2; x <= x1 - w / 2 + 0.01; x += pitch) {
      svg('rect', { class: cls, x: (x - w / 2).toFixed(1), y: y - h, width: w, height: h + 1, rx: 1.5 }, parent);
      svg('rect', { class: 'bs-stud-shine', x: (x - w / 2 + 1.5).toFixed(1), y: y - h + 1, width: 2, height: h - 1, rx: 1 }, parent);
    }
  }

  /**
   * A wall of brick courses: the face (lit from the left, a few bricks a
   * shade lighter or darker), the right-hand side face receding (depth),
   * accent cornices that stand out a little and cast a line of shadow,
   * mortar, studs on top, and a rim of sunlight on the lit edge.
   */
  function wall(parent, { x, y, w, h, depth = 0, cornices = [], top = true }) {
    if (depth) {
      svg('path', { class: 'bs-side', d: `M${x + w} ${y} L${x + w + depth} ${y - depth * 0.6} V${y + h} H${x + w} Z` }, parent);
      svg('rect', { class: 'bs-bond', x: x + w, y: y - depth * 0.6, width: depth, height: h + depth * 0.6 }, parent);
    }
    svg('rect', { class: 'bs-face', x, y, width: w, height: h }, parent);
    svg('rect', { class: 'bs-tinted', x, y, width: w, height: h }, parent);
    svg('rect', { class: 'bs-bond', x, y, width: w, height: h }, parent);
    cornices.forEach(([cy, ch, tone]) => {
      svg('rect', { class: `bs-band bs-band--${tone}`, x: x - 2, y: cy, width: w + 4, height: ch }, parent);
      svg('rect', { class: 'bs-band-light', x: x - 2, y: cy, width: w + 4, height: 2 }, parent);
      svg('rect', { class: 'bs-band-shadow', x, y: cy + ch, width: w, height: 3 }, parent);
    });
    svg('rect', { class: 'bs-shade', x, y, width: w, height: h }, parent);
    svg('rect', { class: 'bs-rim', x, y, width: 2.5, height: h }, parent);
    if (top) {
      svg('path', { class: 'bs-edge', d: `M${x} ${y} H${x + w}` }, parent);
      studs(parent, x, x + w, y);
    }
  }

  /** A pyramid roof of terracotta tiles with a gold finial. */
  function roof(parent, x, w, base, apex) {
    const mid = x + w / 2;
    svg('path', { class: 'bs-roof', d: `M${x - 9} ${base} L${mid} ${apex} L${x + w + 9} ${base} Z` }, parent);
    for (let i = 1; i < 6; i++) {
      const yy = apex + ((base - apex) * i) / 6;
      const half = ((w / 2 + 9) * i) / 6;
      svg('path', { class: 'bs-roof-tile', d: `M${(mid - half).toFixed(1)} ${yy.toFixed(1)} H${(mid + half).toFixed(1)}` }, parent);
    }
    for (let course = 1; course < 6; course++) {
      const top = apex + (base - apex) * course / 6;
      const bottom = apex + (base - apex) * (course + 1) / 6;
      const half = (w / 2 + 9) * course / 6;
      for (let tile = 1; tile < course * 2; tile++) {
        const xx = mid - half + tile * half / course;
        svg('path', { class: 'bs-roof-joint', d: `M${xx.toFixed(1)} ${top.toFixed(1)} l1.5 ${(bottom - top).toFixed(1)}` }, parent);
      }
    }
    svg('path', { class: 'bs-roof-ridge', d: `M${mid} ${apex} V${base}` }, parent);
    svg('rect', { class: 'bs-eave-shadow', x: x - 2, y: base + 4, width: w + 4, height: 5 }, parent);
    svg('rect', { class: 'bs-eave', x: x - 11, y: base - 1, width: w + 22, height: 5, rx: 1 }, parent);
    svg('rect', { class: 'bs-finial-post', x: mid - 1.5, y: apex - 10, width: 3, height: 10 }, parent);
    svg('circle', { class: 'bs-finial', cx: mid, cy: apex - 12, r: 3.6 }, parent);
  }

  /** A quiet upper arcade: shaded arches on pale columns. */
  function belfry(parent, x, y, w, h, count) {
    const pitch = w / count;
    svg('rect', { class: 'bs-belfry-back', x, y, width: w, height: h }, parent);
    for (let i = 0; i < count; i++) {
      const ax = x + i * pitch + 3;
      const aw = pitch - 6;
      windowPiece(parent, ax, y + 3, aw, h - 6, { lightsOffAt: 0.16, panes: 1 });
    }
    for (let i = 0; i <= count; i++) {
      svg('rect', { class: 'bs-column', x: x + i * pitch - 1.5, y, width: 3, height: h }, parent);
    }
    svg('rect', { class: 'bs-band bs-band--gold', x: x - 3, y: y + h, width: w + 6, height: 5 }, parent);
  }

  /** The hall on the left: two towers with belfries, a hall between, and a loggia wing. */
  function hall(parent) {
    const g = svg('g', { class: 'bs-hall' }, parent);
    // The hall between the towers, behind them.
    const middle = svg('g', {}, g);
    wall(middle, { x: 104, y: 252, w: 64, h: GROUND - 252, cornices: [[300, 8, 'gold'], [370, 8, 'blue']] });
    [[112, 266], [142, 266], [112, 318], [142, 318]].forEach(([wx, wy], i) => windowPiece(middle, wx, wy, 16, 30, { occupied: [false, true, true, false][i], lightsOffAt: 0.28 + 0.07 * i }));
    // Tower A, the taller one.
    const tall = svg('g', {}, g);
    wall(tall, { x: 18, y: 124, w: 94, h: GROUND - 124, depth: 12, cornices: [[178, 9, 'blue'], [262, 9, 'gold'], [344, 9, 'blue']], top: false });
    roof(tall, 18, 106, 124, 60);
    belfry(tall, 26, 132, 78, 40, 3);
    [[30, 196], [70, 196], [30, 280], [70, 280]].forEach(([wx, wy], i) => windowPiece(tall, wx, wy, 20, 42, { occupied: [true, false, false, true][i], lightsOffAt: [0.16, 0.38, 0.33, 0.46][i] }));
    // Tower B.
    const short = svg('g', {}, g);
    wall(short, { x: 168, y: 170, w: 80, h: GROUND - 170, depth: 10, cornices: [[220, 8, 'gold'], [304, 8, 'blue']], top: false });
    roof(short, 168, 90, 170, 116);
    belfry(short, 176, 176, 64, 34, 3);
    [[178, 238], [214, 238], [178, 320], [214, 320]].forEach(([wx, wy], i) => windowPiece(short, wx, wy, 18, 38, { occupied: [false, true, true, false][i], lightsOffAt: [0.26, 0.42, 0.16, 0.35][i] }));
    // The loggia wing in front: a mix of occupied rooms and unlit bays.
    const wing = svg('g', {}, g);
    wall(wing, { x: -4, y: 390, w: 306, h: GROUND - 390, depth: 10, cornices: [[390, 6, 'gold']] });
    [[16, 410], [72, 410], [128, 410], [184, 410], [240, 410]].forEach(([wx, wy], i) => windowPiece(wing, wx, wy, 34, 50, { occupied: [true, true, false, true, false][i], lightsOffAt: [0.16, 0.3, 0.25, 0.4, 0.34][i], panes: 1 }));
    // Stairs at the central arch.
    svg('path', { class: 'bs-step', d: 'M118 466 h82 v-3 h-76 v-3 h-6 Z' }, wing);
    // The towers have staggered floors. Separate course milestones keep
    // each inter-chorus pause above a complete row of windows.
    return { node: g, parts: [
      { group: middle, x0: 100, x1: 172, top: 240, levels: [7, 14, 19], solid: [[104, 168, 252]] },
      { group: tall, x0: 4, x1: 140, top: 40, levels: [7, 17, 24], solid: [[18, 124, 60]] },
      { group: short, x0: 154, x1: 272, top: 96, levels: [7, 14, 20], solid: [[168, 258, 116]] },
      { group: wing, x0: -12, x1: 312, top: 382, levels: [7, 7, 7], solid: [[-4, 312, 390]] },
    ] };
  }

  /** The building site on the right: walls going up, scaffolding, bricks on a plank. */
  function site(parent) {
    const g = svg('g', { class: 'bs-site' }, parent);
    // The finished lower storeys.
    wall(g, { x: 766, y: 248, w: 210, h: GROUND - 248, cornices: [[300, 9, 'gold'], [384, 9, 'blue']], top: false });
    [[786, 318], [836, 318], [886, 318], [936, 318], [786, 404], [836, 404], [936, 404]]
      .forEach(([wx, wy], i) => windowPiece(g, wx, wy, 24, 46, { occupied: [false, true, false, false, true, false, true][i], lightsOffAt: [0.27, 0.16, 0.41, 0.32, 0.48, 0.36, 0.44][i] }));
    // The storey going up: unfinished courses stepping down to the right.
    const courses = [[766, 236, 210], [766, 224, 168], [766, 212, 128], [766, 200, 92]];
    courses.forEach(([cx, cy, cw]) => {
      svg('rect', { class: 'bs-course', x: cx, y: cy, width: cw, height: 12 }, g);
      svg('rect', { class: 'bs-bond', x: cx, y: cy, width: cw, height: 12 }, g);
    });
    studs(g, 766, 858, 200);
    studs(g, 858, 894, 212);
    studs(g, 894, 934, 224);
    studs(g, 934, 976, 236);
    [[776, 252, 22, 40], [816, 252, 22, 40]].forEach(([wx, wy, ww, wh]) => windowPiece(g, wx, wy, ww, wh, { arched: false, lightsOffAt: 0.51 }));
    // Scaffolding: poles, ledgers, braces, and planks with bricks waiting on one.
    const scaffold = 'M778 466 V188 M870 466 V188 M962 466 V188 M772 250 H970 M772 336 H970 M772 420 H970'
      + ' M778 336 L870 250 M870 420 L962 336';
    svg('path', { class: 'bs-scaffold', d: scaffold }, g);
    [778, 870, 962].forEach((x) => {
      [250, 336, 420].forEach((y) => svg('rect', { class: 'bs-scaffold-clamp', x: x - 3, y: y - 3, width: 6, height: 6, rx: 1 }, g));
      svg('rect', { class: 'bs-scaffold-foot', x: x - 7, y: GROUND - 3, width: 14, height: 3, rx: 1 }, g);
    });
    [[772, 246], [772, 332], [772, 416]].forEach(([px, py]) => svg('rect', { class: 'bs-plank', x: px, y: py, width: 198, height: 5, rx: 1 }, g));
    [[884, 236, 22, 'blue'], [906, 236, 22, 'gold'], [895, 226, 22, 'tan']].forEach(([bx, by, bw, tone]) => {
      svg('rect', { class: `bs-mod bs-mod--${tone}`, x: bx, y: by, width: bw, height: 10, rx: 1.5 }, g);
      studs(g, bx, bx + bw, by, { pitch: 11, w: 7, h: 3, cls: 'bs-stud bs-stud--module' });
    });
    return g;
  }

  /** A lamp post of round bricks, its lamp still glowing before sunrise. */
  function lamp(parent, x) {
    const g = svg('g', { class: 'bs-lamp' }, parent);
    const glow = svg('circle', { class: 'bs-lamp-halo', 'data-testid': 'reuse-lamp-glow', cx: x, cy: 396, r: 30 }, g);
    svg('rect', { class: 'bs-lamp-post', x: x - 2.5, y: 400, width: 5, height: GROUND - 400 }, g);
    [0, 1, 2].forEach((i) => svg('rect', { class: 'bs-lamp-ring', x: x - 4, y: 412 + i * 18, width: 8, height: 3, rx: 1 }, g));
    svg('rect', { class: 'bs-lamp-base', x: x - 7, y: GROUND - 8, width: 14, height: 8, rx: 2 }, g);
    svg('rect', { class: 'bs-lamp-cap', x: x - 7, y: 384, width: 14, height: 4, rx: 1.5 }, g);
    const bulb = svg('rect', { class: 'bs-lamp-bulb', x: x - 5.5, y: 388, width: 11, height: 12, rx: 4 }, g);
    return { glow, bulb };
  }

  /**
   * A forklift built of bricks, dim in the ground shadow so its motion stays
   * in the background: a dull ochre body and a dark cage, a dark mast with
   * its forks, and two wheels whose spokes turn as it drives. It carries a
   * muted blue 2×2 brick. Its origin is the middle of the ground under its
   * wheels.
   */
  function forklift(parent) {
    const g = svg('g', { class: 'bs-forklift', 'data-testid': 'reuse-site-forklift' }, parent);
    const body = svg('g', {}, g);
    svg('ellipse', { class: 'bs-fork-shadow', cx: 0, cy: 0, rx: 34, ry: 4 }, body);
    svg('rect', { class: 'bs-fork-weight', x: -30, y: -24, width: 12, height: 16, rx: 2 }, body);
    svg('rect', { class: 'bs-fork-body', x: -22, y: -22, width: 38, height: 14, rx: 2.5 }, body);
    svg('rect', { class: 'bs-fork-shine', x: -20, y: -20.5, width: 34, height: 2.5, rx: 1 }, body);
    svg('path', { class: 'bs-fork-cage', d: 'M-16 -22 V-40 H8 V-22 M-16 -40 L8 -40' }, body);
    svg('rect', { class: 'bs-fork-seat', x: -12, y: -30, width: 9, height: 8, rx: 1.5 }, body);
    svg('rect', { class: 'bs-fork-mast', x: 18, y: -44, width: 4, height: 38 }, body);
    svg('path', { class: 'bs-fork-tine', d: 'M20 -8 H40' }, body);
    const load = svg('g', { transform: 'translate(24 -22)' }, body);
    svg('rect', { class: 'bs-mod bs-mod--blue', x: 0, y: 0, width: 18, height: 12, rx: 1.5 }, load);
    studs(load, 0, 18, 0, { pitch: 9, w: 6, h: 3, cls: 'bs-stud bs-stud--blue' });
    const wheels = [-14, 10].map((wx) => {
      const wheel = svg('g', { transform: `translate(${wx} -6)` }, g);
      svg('circle', { class: 'bs-fork-tyre', cx: 0, cy: 0, r: 6 }, wheel);
      const hub = svg('g', {}, wheel);
      svg('circle', { class: 'bs-fork-hub', cx: 0, cy: 0, r: 2.6 }, hub);
      svg('path', { class: 'bs-fork-spoke', d: 'M-4 0 H4 M0 -4 V4' }, hub);
      return hub;
    });
    return { node: g, body, wheels };
  }

  /**
   * Where the forklift is at song time t: it drives from one end of its run
   * to the other, waits, and drives back. Returns { x, facing, rolling }.
   */
  function forkliftPose(t, { from = 312, to = 650, drive = 30, wait = 12 } = {}) {
    const cycle = 2 * (drive + wait);
    const u = ((t % cycle) + cycle) % cycle;
    const ease = (v) => easeInOutCubic(clamp(v, 0, 1));
    if (u < drive) return { x: from + (to - from) * ease(u / drive), facing: 1, rolling: (to - from) * ease(u / drive) };
    if (u < drive + wait) return { x: to, facing: 1, rolling: to - from };
    if (u < 2 * drive + wait) {
      const back = ease((u - drive - wait) / drive);
      return { x: to - (to - from) * back, facing: -1, rolling: (to - from) * (1 + back) };
    }
    return { x: from, facing: -1, rolling: 2 * (to - from) };
  }

  // ------------------------------------------------------------------
  // The crane
  // ------------------------------------------------------------------

  /**
   * The tower crane: lattice mast and jib, counter-jib and counterweight,
   * pendant ties, and the cab, drawn into `parent`; the trolley, its cable,
   * and the prebuilt module of bricks go into `load`, which the build does
   * not clip. Returns the trolley's carriage (shown once the jib reaches
   * it), the swing
   * (cable and hoist, turning at the trolley), the hoist (hook, slings, and
   * module, raised and lowered), and the cable.
   */
  function crane(parent, load) {
    const g = svg('g', { class: 'bs-crane' }, parent);
    const truss = (x0, x1, yTop, yBottom, step) => {
      let d = `M${x0} ${yTop} H${x1} M${x0} ${yBottom} H${x1} `;
      for (let x = x0, up = true; x < x1; x += step, up = !up) {
        d += `M${x} ${up ? yBottom : yTop} L${Math.min(x + step, x1)} ${up ? yTop : yBottom} M${x} ${yTop} V${yBottom} `;
      }
      return d;
    };
    let mast = 'M902 34 V470 M918 34 V470 ';
    for (let y = 34, left = true; y < 470; y += 16, left = !left) mast += `M${left ? 902 : 918} ${y} L${left ? 918 : 902} ${y + 16} M902 ${y} H918 `;
    // The far faces of the square mast and the jib, set back up and to the
    // right in shadow, so the crane reads as a truss with depth.
    svg('path', { class: 'bs-crane-lattice bs-crane-lattice--back', d: mast, transform: 'translate(5 -3)' }, g);
    svg('path', { class: 'bs-crane-lattice bs-crane-lattice--back', d: truss(392, 918, 24, 34, 13), transform: 'translate(3 -3)' }, g);
    svg('path', { class: 'bs-crane-lattice', d: mast }, g);
    svg('path', { class: 'bs-crane-lattice', d: truss(392, 918, 24, 34, 13) }, g);
    svg('path', { class: 'bs-crane-lattice', d: 'M380 29 L392 24 M380 29 L392 34' }, g);
    svg('path', { class: 'bs-crane-lattice', d: truss(918, 976, 26, 34, 12) }, g);
    svg('rect', { class: 'bs-crane-weight', x: 940, y: 34, width: 26, height: 20, rx: 2 }, g);
    svg('path', { class: 'bs-crane-weight-line', d: 'M940 41 H966 M940 47 H966' }, g);
    svg('path', { class: 'bs-crane-lattice', d: 'M902 34 L910 4 L918 34 M904 26 H916 M906 18 H914' }, g);
    svg('path', { class: 'bs-crane-tie', d: 'M910 4 L560 24 M910 4 L972 26' }, g);
    svg('rect', { class: 'bs-crane-cab', x: 882, y: 36, width: 20, height: 16, rx: 2 }, g);
    svg('rect', { class: 'bs-crane-glass', x: 885, y: 39, width: 9, height: 7, rx: 1 }, g);
    // A pennant on the cab.
    svg('path', { class: 'bs-pennant-pole', d: 'M892 36 V12' }, g);
    svg('path', { class: 'bs-pennant', d: 'M892 14 Q880 15 866 19 Q880 23 892 24 Z' }, g);
    const trolley = svg('g', { transform: `translate(${TROLLEY_X} 0)` }, load);
    const carriage = svg('rect', { class: 'bs-crane-trolley', x: -8, y: 33, width: 16, height: 5, rx: 1 }, trolley);
    const swing = svg('g', {}, trolley);
    const cable = svg('path', { class: 'bs-crane-cable' }, swing);
    const hoist = svg('g', {}, swing);
    svg('path', { class: 'bs-crane-cable', d: 'M0 62 L-38 70 M0 62 L38 70' }, hoist);
    svg('rect', { class: 'bs-crane-hook', x: -5, y: 56, width: 10, height: 7, rx: 1.5 }, hoist);
    const module = svg('g', { class: 'bs-module' }, hoist);
    const bricks = [[-46, 70, 30, 'blue'], [-16, 70, 32, 'gold'], [16, 70, 30, 'tan'],
      [-46, 84, 46, 'gold'], [0, 84, 46, 'blue']];
    bricks.forEach(([bx, by, bw, tone]) => {
      svg('rect', { class: `bs-mod bs-mod--${tone}`, x: bx, y: by, width: bw, height: 14, rx: 1.5 }, module);
      svg('rect', { class: 'bs-mod-shine', x: bx + 1.5, y: by + 1.5, width: bw - 3, height: 2.5, rx: 1 }, module);
    });
    studs(module, -46, 46, 70, { pitch: 11.5, w: 7, h: 4, cls: 'bs-stud bs-stud--module' });
    return { crane: g, carriage, swing, hoist, cable };
  }

  // ------------------------------------------------------------------
  // The ground
  // ------------------------------------------------------------------

  /** The baseplate: rows of studs that grow towards the viewer. */
  function ground(parent) {
    const g = svg('g', { class: 'bs-ground' }, parent);
    svg('rect', { class: 'bs-plate', x: 0, y: GROUND, width: W, height: H - GROUND }, g);
    svg('rect', { class: 'bs-base-shadow', x: 0, y: GROUND, width: W, height: 10 }, g);
    [[GROUND + 8, 3.4, 1.6, 2.4, 22], [GROUND + 20, 4.6, 2.1, 3.2, 27], [GROUND + 37, 6.2, 2.9, 4.3, 34], [GROUND + 60, 8.2, 3.8, 5.6, 43], [GROUND + 92, 10.6, 4.9, 7.2, 55]]
      .forEach(([y, rx, ry, h, pitch], row) => {
        const rowGroup = svg('g', { class: 'bs-gstud-row' }, g);
        for (let x = (row % 2 ? pitch / 2 : 0) + 4; x < W + rx; x += pitch) {
          svg('ellipse', { class: 'bs-gstud-shadow', cx: (x + rx * 0.5).toFixed(1), cy: (y + ry * 0.4).toFixed(1), rx: rx * 1.15, ry: ry * 1.1 }, rowGroup);
          svg('path', {
            class: 'bs-gstud',
            d: `M${(x - rx).toFixed(1)} ${(y - h).toFixed(1)} V${y} A${rx} ${ry} 0 0 0 ${(x + rx).toFixed(1)} ${y} V${(y - h).toFixed(1)} Z`,
          }, rowGroup);
          svg('ellipse', { class: 'bs-gstud-top', cx: x.toFixed(1), cy: (y - h).toFixed(1), rx, ry }, rowGroup);
          svg('ellipse', { class: 'bs-gstud-shine', cx: (x - rx * 0.35).toFixed(1), cy: (y - h - ry * 0.2).toFixed(1), rx: rx * 0.35, ry: ry * 0.4 }, rowGroup);
        }
      });
    return g;
  }

  /**
   * A large loose brick seen from the front and a little above: its shadow,
   * front and side faces, the top face, and its studs in perspective.
   */
  function looseBrick(parent, { x, y, w, h, dx = 0, dy = 0, cols = 1, rows = 1, tone, round = false }) {
    const g = svg('g', { class: `bs-big bs-big--${tone}` }, parent);
    svg('ellipse', { class: 'bs-big-shadow', cx: x + w / 2 + dx, cy: y + h - 2, rx: w / 2 + dx, ry: 8 }, g);
    if (round) {
      // A round 1×1 brick: a cylinder with one stud.
      const r = w / 2;
      const cx = x + r;
      svg('path', { class: 'bs-big-front', d: `M${x} ${y} V${y + h} A${r} ${r * 0.4} 0 0 0 ${x + w} ${y + h} V${y} Z` }, g);
      svg('ellipse', { class: 'bs-big-top', cx, cy: y, rx: r, ry: r * 0.4 }, g);
      svg('path', { class: 'bs-big-stud', d: `M${cx - r * 0.55} ${y - 4} V${y} A${r * 0.55} ${r * 0.22} 0 0 0 ${cx + r * 0.55} ${y} V${y - 4} Z` }, g);
      svg('ellipse', { class: 'bs-big-stud-top', cx, cy: y - 4, rx: r * 0.55, ry: r * 0.22 }, g);
      return g;
    }
    svg('path', { class: 'bs-big-side', d: `M${x + w} ${y} L${x + w + dx} ${y - dy} V${y - dy + h} L${x + w} ${y + h} Z` }, g);
    svg('rect', { class: 'bs-big-front', x, y, width: w, height: h }, g);
    svg('rect', { class: 'bs-big-front-shine', x: x + 3, y: y + 3, width: w - 6, height: 3, rx: 1.5 }, g);
    svg('path', { class: 'bs-big-bevel', d: `M${x + 2} ${y + h - 2} V${y + 2} H${x + w - 2} M${x + w - 2} ${y + 3} V${y + h - 2}` }, g);
    svg('path', { class: 'bs-big-mold', d: `M${x + w + 1} ${y + 4} l${Math.max(0, dx - 3)} ${-Math.max(0, dy - 3)}` }, g);
    svg('path', { class: 'bs-big-top', d: `M${x} ${y} H${x + w} L${x + w + dx} ${y - dy} H${x + dx} Z` }, g);
    const r = (w / cols) * 0.3;
    const ry = r * 0.42;
    const sh = r * 0.42;
    for (let row = rows - 1; row >= 0; row--) {
      const v = (row + 0.5) / rows;
      for (let col = 0; col < cols; col++) {
        const u = (col + 0.5) / cols;
        const cx = x + u * w + v * dx;
        const cy = y - v * dy;
        svg('path', {
          class: 'bs-big-stud',
          d: `M${(cx - r).toFixed(1)} ${(cy - sh).toFixed(1)} V${cy.toFixed(1)} A${r.toFixed(1)} ${ry.toFixed(1)} 0 0 0 ${(cx + r).toFixed(1)} ${cy.toFixed(1)} V${(cy - sh).toFixed(1)} Z`,
        }, g);
        svg('ellipse', { class: 'bs-big-stud-top', cx: cx.toFixed(1), cy: (cy - sh).toFixed(1), rx: r.toFixed(1), ry: ry.toFixed(1) }, g);
        svg('ellipse', { class: 'bs-big-stud-rim', cx: cx.toFixed(1), cy: (cy - sh).toFixed(1), rx: (r * 0.76).toFixed(1), ry: (ry * 0.72).toFixed(1) }, g);
        svg('ellipse', { class: 'bs-big-stud-shine', cx: (cx - r * 0.35).toFixed(1), cy: (cy - sh - ry * 0.15).toFixed(1), rx: (r * 0.32).toFixed(1), ry: (ry * 0.4).toFixed(1) }, g);
      }
    }
    svg('path', { class: 'bs-big-edge', d: `M${x} ${y} H${x + w}` }, g);
    return g;
  }

  // ------------------------------------------------------------------
  // The build
  // ------------------------------------------------------------------

  /** Progress of a BUILD span at time t: 0 before it, 1 after it. */
  const span = (t, [from, to]) => clamp((t - from) / (to - from), 0, 1);

  /**
   * A perspective view east at 34° north, with a fixed seasonal declination.
   * Uniform hour-angle motion produces a rising arc to the right, rather
   * than an eased vertical slide. This is an illustrative morning, not a
   * date-specific ephemeris. Every light cue follows the resulting elevation.
   * Solar geometry: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
   */
  function sunriseAt(progress) {
    const radians = Math.PI / 180;
    const latitude = 34 * radians;
    const declination = -12 * radians;
    const hourAngle = (-89 + 17 * progress) * radians;
    const east = -Math.cos(declination) * Math.sin(hourAngle);
    const north = Math.cos(latitude) * Math.sin(declination)
      - Math.sin(latitude) * Math.cos(declination) * Math.cos(hourAngle);
    const up = Math.sin(latitude) * Math.sin(declination)
      + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
    const elevation = Math.asin(up) / radians;
    return {
      x: 100 - 1200 * north / east,
      y: 390 - 1200 * up / east,
      elevation,
      firstLight: span(elevation, [-6, 0]),
      golden: span(elevation, [0, 8]),
      ambient: span(elevation, [-6, 8]),
    };
  }

  /** Cumulative course count; completed phases hold until the next chorus. */
  function constructionAt(t, phases) {
    let courses = 0;
    let previous = 0;
    let active = false;
    phases.forEach(({ from, to, target }) => {
      courses += (target - previous) * clamp((t - from) / (to - from), 0, 1);
      active ||= t >= from && t < to;
      previous = target;
    });
    return { courses, active };
  }

  /**
   * Lays `group` brick by brick over its timed phases: courses from the
   * ground up, each course left to right, with the next brick dropping into
   * its slot. It clips the group to what is laid so far. `solid` lists the
   * group's walls as [left, right, top]; the falling brick shows only over a
   * wall, never in the air beside it. `levels` gives whole-course milestones
   * before the final phase completes the building. Returns a pose(t).
   */
  function builder(art, defs, group, id, { x0, x1, bottom, top, timing, levels, solid }) {
    const clip = svg('clipPath', { id }, defs);
    const laid = svg('rect', { 'data-testid': 'reuse-building-courses', x: x0, width: x1 - x0, y: bottom, height: 0 }, clip);
    const course = svg('rect', { x: x0, y: bottom, width: 0, height: COURSE }, clip);
    group.setAttribute('clip-path', `url(#${id})`);
    const drop = svg('g', { class: 'bs-drop' }, art);
    const brick = svg('rect', { class: 'bs-drop-brick', x: 0, y: 0, width: BRICK - 1, height: COURSE - 1, rx: 1.5 }, drop);
    [6, 16].forEach((sx) => svg('rect', { class: 'bs-drop-stud', x: sx, y: -3.5, width: 6, height: 4, rx: 1.2 }, drop));
    const courses = Math.ceil((bottom - top) / COURSE);
    const targets = [...levels, courses];
    const phases = timing.map(([from, to], i) => ({ from, to, target: targets[i] }));
    const perCourse = Math.ceil((x1 - x0) / BRICK);
    const tones = ['tan', 'blue', 'gold'];
    return (t, still) => {
      const construction = still ? { courses, active: false } : constructionAt(t, phases);
      const done = construction.courses;
      const full = Math.floor(done);
      const bricks = Math.floor((done - full) * perCourse);
      laid.setAttribute('y', String(bottom - full * COURSE));
      laid.setAttribute('height', String(full * COURSE));
      course.setAttribute('y', String(bottom - (full + 1) * COURSE));
      course.setAttribute('width', String(done >= courses ? 0 : bricks * BRICK));
      const x = x0 + bricks * BRICK;
      const slotY = bottom - (full + 1) * COURSE;
      const overWall = solid.some(([left, right, wallTop]) => x + BRICK / 2 >= left && x + BRICK / 2 <= right && slotY + COURSE >= wallTop);
      const building = construction.active && done > 0 && done < courses && overWall;
      drop.style.display = building ? '' : 'none';
      if (!building) return;
      // The next brick falls the last 18 px into its slot.
      const fall = 1 - ((done - full) * perCourse - bricks);
      const y = slotY - 18 * fall * fall;
      drop.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      const tone = tones[(full * 7 + bricks * 3) % tones.length];
      const className = `bs-drop-brick bs-drop-brick--${tone}`;
      if (brick.getAttribute('class') !== className) brick.setAttribute('class', className);
    };
  }

  function brickSite(stage, { duration = 300, song } = {}) {
    windows.length = 0;
    const layer = el('div', 'layer bs-room', stage);
    const art = svg('svg', { class: 'bs-art', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, layer);
    definitions(art);
    const defs = art.querySelector('defs');
    svg('rect', { class: 'bs-sky', x: 0, y: 0, width: W, height: GROUND }, art);
    const morningSky = svg('rect', { class: 'bs-morning-sky', 'data-testid': 'reuse-morning-sky', x: 0, y: 0, width: W, height: GROUND }, art);

    const stars = svg('g', { class: 'bs-stars', 'data-testid': 'reuse-stars' }, art);
    const starField = Array.from({ length: 34 }, (_, i) => [Math.round(20 + 920 * hash01(i * 41 + 9)), Math.round(6 + 230 * hash01(i * 59 + 13) ** 1.6)]);
    const starDots = [[402, 14], [530, 46], [610, 12], [700, 52], [258, 30], [820, 70], [470, 64], [330, 58], [356, 10], [662, 34], ...starField]
      .map(([sx, sy], i) => ({ dot: svg('circle', { class: 'bs-star', cx: sx, cy: sy, r: i % 3 ? 0.9 : 1.3 }, stars), phase: hash01(i * 17 + 3) * 6.28, speed: 0.6 + 0.6 * hash01(i * 23 + 7) }));
    const sky = svg('g', {}, art);
    const rays = svg('g', { class: 'bs-rays' }, sky);
    const sun = svg('g', { class: 'bs-sunrise', 'data-testid': 'reuse-sun' }, sky);
    svg('circle', { class: 'bs-sun', cx: 0, cy: 0, r: 180 }, sun);
    svg('circle', { class: 'bs-sun-disc', cx: 0, cy: 0, r: 22 }, sun);
    // Rays sit behind the disc, so their overlaps never mark its face.
    [-18, -31, -44, -58].forEach((deg, i) => svg('path', {
      class: 'bs-ray', d: `M0 -2 L${640 - i * 60} ${-14 - 4 * i} L${640 - i * 60} ${14 + 4 * i} L0 2 Z`, transform: `rotate(${deg})`,
    }, rays));
    svg('path', { class: 'bs-hills bs-hills--far', d: 'M0 404 Q160 360 330 384 T640 370 T960 362 V466 H0 Z' }, sky);
    svg('path', { class: 'bs-hills', d: 'M0 420 Q120 372 250 398 T520 384 T780 396 T960 380 V466 H0 Z' }, sky);
    svg('rect', { class: 'bs-haze', x: 0, y: 330, width: W, height: GROUND - 330 }, sky);
    const BAND = 760;
    const band = cloudBand(sky, 40, BAND);
    const clouds = [[-120, 5, 1.35, 0.09], [240, 56, 1.25, 0.12], [650, 18, 1.4, 0.07], [-75, 155, 0.9, 0.15], [510, 194, 1.05, 0.1]]
      .map(([x, y, scale, speed], variant) => ({ ...cloud(sky, { scale, variant }), x, y, speed }));
    // A far skyline between the two buildings, a few rooms still lit.
    const far = svg('g', { class: 'bs-far' }, art);
    svg('path', { class: 'bs-far-shape', d: 'M240 466 V420 H290 V398 H340 V410 H400 V380 H446 V404 H520 V388 H580 V412 H650 V394 H700 V408 H780 V466 Z' }, far);
    [[296, 408], [308, 408], [352, 418], [410, 390], [422, 400], [458, 412], [530, 398], [542, 398], [590, 420], [660, 404], [710, 416]]
      .forEach(([fx, fy], i) => {
        const lit = svg('rect', { class: 'bs-far-window', x: fx, y: fy, width: 4, height: 5 }, far);
        windows.push({ lit, brightness: 0.45 + 0.4 * hash01(i * 19 + 5), lightsOffAt: 0.16 + hash01(i * 7 + 3) * 0.28, shown: -1 });
      });
    const { node: hallGroup, parts: hallParts } = hall(art);
    const siteGroup = site(art);
    const lampGroup = svg('g', {}, art);
    const lamps = [lamp(lampGroup, 18), lamp(lampGroup, 944)];
    const load = svg('g', {}, art);
    const { crane: craneGroup, carriage, swing: swingGroup, hoist, cable } = crane(art, load);
    const groundGroup = ground(art);
    groundGroup.dataset.testid = 'reuse-ground';
    hallGroup.dataset.testid = 'reuse-hall';
    siteGroup.dataset.testid = 'reuse-site';
    // Soft contact shadows where the buildings and lamps meet the baseplate.
    const contact = svg('g', { class: 'bs-contact' }, art);
    svg('path', { class: 'bs-cast', d: `M-4 ${GROUND} H312 L332 ${GROUND + 18} H-4 Z` }, contact);
    svg('path', { class: 'bs-cast', d: `M766 ${GROUND} H984 L998 ${GROUND + 18} H778 Z` }, contact);
    [18, 944].forEach((lx) => svg('ellipse', { class: 'bs-lamp-shadow', cx: lx + 6, cy: GROUND + 3, rx: 14, ry: 3.5 }, contact));
    const truck = forklift(art);
    looseBrick(art, { x: 26, y: 500, w: 224, h: 60, dx: 26, dy: 16, cols: 4, rows: 2, tone: 'tan' });
    looseBrick(art, { x: 690, y: 508, w: 120, h: 50, dx: 22, dy: 14, cols: 2, rows: 2, tone: 'blue' });
    looseBrick(art, { x: 560, y: 520, w: 62, h: 40, dx: 14, dy: 9, cols: 2, rows: 1, tone: 'gold' });
    looseBrick(art, { x: 452, y: 514, w: 26, h: 24, tone: 'red', round: true });
    // Both sites start with a complete ground-floor base. Each refrain adds
    // supported walls above it; the hall's belfries and roofs come last.
    const choruses = ['refrain-1', 'refrain-2', 'refrain-3']
      .map((id) => [song.sectionStart(id), song.sectionEnd(id)]);
    const poses = [
      ...hallParts.map(({ group, ...geometry }, i) => builder(art, defs, group, `bs-clip-hall-${i}`, {
        ...geometry, bottom: GROUND, timing: [BUILD.hall, ...choruses],
      })),
      builder(art, defs, siteGroup, 'bs-clip-site', {
        x0: 760, x1: 984, bottom: GROUND, top: 180, timing: [BUILD.site, ...choruses], levels: [7, 14, 18],
        solid: [[766, 976, 200]],
      }),
    ];
    const craneClip = svg('clipPath', { id: 'bs-clip-crane' }, defs);
    const mastRect = svg('rect', { x: 892, width: 34, y: 470, height: 0 }, craneClip);
    const jibRect = svg('rect', { x: 980, y: 0, width: 0, height: 60 }, craneClip);
    craneGroup.setAttribute('clip-path', 'url(#bs-clip-crane)');
    const dawnShade = svg('rect', { class: 'bs-dawn-shade', x: 0, y: 0, width: W, height: H }, art);
    const goldenLight = svg('rect', { class: 'bs-golden-light', x: 0, y: 0, width: W, height: H }, art);
    onFrame((t) => {
      const still = reducedMotion.matches;
      const light = sunriseAt(still ? 0.62 : clamp(t / duration, 0, 1));
      const built = (part) => (still ? 1 : span(t, BUILD[part]));
      // Site activity settles during explanations; the sky keeps drifting
      // slowly. Both clocks rewind exactly and stop under reduced motion.
      const ambientTime = still ? 0 : Math.min(t, BUILD.lift[1]) + Math.max(0, t - (duration - SET_DOWN - 10));
      const cloudTime = still ? 0 : clamp(t, 0, duration);
      // Before sunrise, light already reaches the horizon and cloud undersides.
      art.style.setProperty('--bs-first-light', `${(100 * light.firstLight).toFixed(2)}%`);
      art.style.setProperty('--bs-golden', `${(100 * light.golden).toFixed(2)}%`);
      art.style.setProperty('--bs-ambient', `${(100 * light.ambient).toFixed(2)}%`);
      art.style.setProperty('--bs-glazing-reflection', (0.08 + 0.2 * light.ambient).toFixed(3));
      art.style.setProperty('--bs-cloud-warmth', (0.25 + 0.75 * light.firstLight).toFixed(3));
      // The ground, loose bricks and sky are already present at frame zero.
      // Only the buildings and crane assemble during the opening.
      poses.forEach((pose) => pose(t, still));
      const mast = built('mast');
      mastRect.setAttribute('y', (470 - 470 * mast).toFixed(1));
      mastRect.setAttribute('height', (470 * mast).toFixed(1));
      const jib = built('jib');
      jibRect.setAttribute('x', (980 - 612 * jib).toFixed(1));
      jibRect.setAttribute('width', (612 * jib).toFixed(1));
      // The same sun elevation drives its disc, sky, clouds, and site lights.
      const sunAt = `translate(${light.x.toFixed(1)} ${light.y.toFixed(1)})`;
      sun.setAttribute('transform', sunAt);
      rays.setAttribute('transform', sunAt);
      rays.style.opacity = (0.42 * light.golden).toFixed(3);
      dawnShade.style.opacity = (0.16 * (1 - light.ambient)).toFixed(3);
      goldenLight.style.opacity = (0.1 * light.golden).toFixed(3);
      morningSky.style.opacity = light.golden.toFixed(3);
      stars.style.opacity = (0.65 * (1 - span(light.elevation, [-5, -1]))).toFixed(3);
      band.style.opacity = (0.65 + 0.35 * light.ambient).toFixed(3);
      // Interior lights switch off at staggered times as daylight takes over.
      windows.forEach((win) => {
        const daylight = clamp((span(light.elevation, [-2, 3]) - win.lightsOffAt) / 0.16, 0, 1);
        const on = Number((win.brightness * (1 - easeInOutCubic(daylight))).toFixed(3));
        if (on !== win.shown) {
          win.lit.style.opacity = String(on);
          win.shown = on;
        }
      });
      const lampOn = 1 - span(light.elevation, [-2, 2]);
      lamps.forEach(({ glow, bulb }) => {
        glow.style.opacity = lampOn.toFixed(3);
        bulb.style.opacity = (0.3 + 0.7 * lampOn).toFixed(2);
      });
      // The last stars glimmer slowly before daylight hides them.
      starDots.forEach(({ dot, phase, speed }) => {
        dot.style.opacity = still ? '0.75' : (0.72 + 0.12 * Math.sin(ambientTime * speed + phase)).toFixed(2);
      });
      // The high cloud band drifts along the top of the stage.
      band.setAttribute('transform', `translate(${(cloudTime * 0.08).toFixed(3)} 0)`);
      // The forklift, dim in the ground shadow, carries its brick slowly back
      // and forth along the ground.
      const drive = still ? { x: 312, facing: 1, rolling: 0 } : forkliftPose(Math.max(0, ambientTime - BUILD.lift[0]));
      truck.node.setAttribute('transform', `translate(${drive.x.toFixed(1)} ${GROUND + 22}) scale(${drive.facing} 1)`);
      const spin = (drive.rolling / (2 * Math.PI * 6)) * 360;
      truck.wheels.forEach((hub) => hub.setAttribute('transform', `rotate(${spin.toFixed(1)})`));
      // A bank travels less than five percent of the stage over the whole
      // song, without wrapping. Its sun-facing relief follows the new pose.
      clouds.forEach((bank) => poseCloud(bank, cloudTime, light));
      // The module: on the ground until the crane lifts it in the
      // instrumental, swaying a little as it rises and settling still within
      // seconds, then set onto the site at the end of the song.
      const onGround = GROUND - MODULE_BOTTOM;
      const setDown = 200 - MODULE_BOTTOM;
      const lift = easeInOutCubic(still ? 1 : span(t, BUILD.lift));
      const lower = easeInOutCubic(span(t, [duration - SET_DOWN, duration - SET_DOWN + 4.5]));
      const drop = onGround * (1 - lift) + setDown * lower;
      const swing = lift * (1 - lower);
      const settle = Math.exp(-Math.max(0, t - BUILD.lift[1]) / 2.5);
      const sway = still ? 0 : swing * settle * (1.3 * Math.sin(t * 0.85) + 0.5 * Math.sin(t * 0.37));
      swingGroup.setAttribute('transform', `rotate(${sway.toFixed(2)} 0 38)`);
      hoist.setAttribute('transform', `translate(0 ${drop.toFixed(1)})`);
      cable.setAttribute('d', `M-2 38 V${(60 + drop).toFixed(1)} M2 38 V${(60 + drop).toFixed(1)}`);
      cable.style.opacity = mast >= 1 && jib >= 1 ? '1' : '0';
      carriage.style.opacity = jib >= 0.3 ? '1' : '0';
    });
    el('div', 'layer vignette bs-vignette', stage);
    return layer;
  }

  window.SongKit.themes['brick-site'] = { build: brickSite };
})();
