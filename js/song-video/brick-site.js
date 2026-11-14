/*
 * The "brick-site" stage theme for "Not a One-Time Investment", the
 * design-with-reuse song: a construction site of toy bricks at golden hour,
 * after the title picture of Lecture 12 (a campus hall built of blue, gold,
 * and tan bricks while a crane lifts a prebuilt module into place, the
 * lecture's image of reuse). Storyboards select it with `theme: brick-site`;
 * css/song-video-brick-site.css holds its colours.
 *
 * Back to front: a dusk sky with the low sun, hills, and a few clouds; a far
 * skyline; a twin-towered hall on the left (tiled pyramid roofs with
 * finials, an arcaded belfry in each tower, cornices of blue and gold
 * bricks, a loggia of arches along its front wing); a building going up on
 * the right (an unfinished top course, an open storey behind scaffolding,
 * bricks waiting on a plank); a tower crane whose jib crosses the top of
 * the stage and carries a prebuilt module of bricks slowly towards the
 * site; lamp posts; and a studded baseplate as the ground, with large loose
 * bricks in front. Every window is a toy window piece: a white frame, glass
 * split by mullions, a sill. Dark glass reflects the sky; as the evening
 * comes, the rooms behind the windows light up one by one, and so do the
 * lamps. Depth comes from light and shadow: the glass sits back in its
 * frame, frames and sills and eaves cast shadows, a few bricks in every
 * wall are a shade lighter or darker, the crane is a square truss with its
 * far faces in shadow, soft contact shadows ground the buildings and lamps
 * on the baseplate, and faint shafts of light fan up from the low sun. The casebook spreads of js/song-video/reuse-kit.js stand on the
 * ground in front of all this.
 *
 * The intro builds all of it from bricks (BUILD): the baseplate is laid and
 * its studs pop up row by row, loose bricks and the prebuilt module drop
 * onto it, the hall and the site rise course by course, each course laid
 * left to right with the next brick dropping into its slot, the crane's
 * mast climbs and its jib reaches out, and in the instrumental the crane
 * lifts the prebuilt module off the ground. At the end of the song it sets
 * the module onto the site's unfinished top course.
 *
 * Between the build and the set-down the site stays gently alive in the
 * strips the casebook leaves visible, and only low-contrast things move, so
 * nothing pulls the eye from the casebook: the clouds and a high band of
 * cloud drift slowly, the light in each lit window shifts a little as if
 * someone moved about the room, a forklift in the dusk shadow carries a
 * brick slowly back and forth along the ground, the lamp glows breathe,
 * and the first stars glimmer. The crane, its pennant, and the hanging
 * module hold still once the module is up.
 *
 * The light stays a warm, hopeful golden hour all song, darkening only a
 * little; over the last seconds it turns, slowly, into a clear night: a deep
 * blue sky, a full moon with its halo, and a sky full of stars over the lit
 * windows.
 *
 * Everything is a pure function of song time, so any seek shows the right
 * stage of the build. The sky darkens and the windows light over the whole
 * song, each window fading in over seconds, so nothing large changes
 * brightness quickly (WCAG 2.3.1); the ambient motion is slow and keeps its
 * colours. With reduced motion the scene is built from the start and all of
 * it holds still. The scenery stays dark where the stage draws light text.
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
    sky: [0.1, 1.4], ground: [0.2, 1.2], loose: [0.9, 1.9], far: [0.4, 1.6],
    hall: [1.0, 7.4], site: [2.2, 7.8],
    mast: [3.0, 6.2], jib: [6.2, 7.6], lamps: [7.0, 7.8],
    lift: [8.4, 11.8],
  };
  const SET_DOWN = 9.0;
  /** Night falls between these many seconds before the song's end. */
  const NIGHTFALL = [20, 4];   // seconds before the song ends: the module goes into place
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
      [0, 'bs-sky-0'], [0.42, 'bs-sky-1'], [0.68, 'bs-sky-2'], [0.86, 'bs-sky-3'], [1, 'bs-sky-4'],
    ]);
    gradient(defs, 'radialGradient', 'bs-sun', { cx: 0.5, cy: 0.5, r: 0.5 }, [[0, 'bs-sun-0'], [0.35, 'bs-sun-1'], [1, 'bs-sun-2']]);
    gradient(defs, 'radialGradient', 'bs-lamp-glow', { cx: 0.5, cy: 0.5, r: 0.5 }, [[0, 'bs-lamp-0'], [1, 'bs-lamp-1']]);
    gradient(defs, 'linearGradient', 'bs-lit', horizontal, [[0, 'bs-lit-0'], [0.55, 'bs-lit-1'], [1, 'bs-lit-2']]);
    gradient(defs, 'linearGradient', 'bs-side', vertical, [[0, 'bs-side-0'], [1, 'bs-side-1']]);
    gradient(defs, 'linearGradient', 'bs-shadow', horizontal, [[0, 'bs-shadow-0'], [0.45, 'bs-shadow-1'], [1, 'bs-shadow-2']]);
    gradient(defs, 'linearGradient', 'bs-roof', horizontal, [[0, 'bs-roof-0'], [0.5, 'bs-roof-1'], [0.5, 'bs-roof-2'], [1, 'bs-roof-3']]);
    gradient(defs, 'linearGradient', 'bs-cloud', vertical, [[0, 'bs-cloud-0'], [0.6, 'bs-cloud-1'], [1, 'bs-cloud-2']]);
    gradient(defs, 'linearGradient', 'bs-haze', vertical, [[0, 'bs-haze-0'], [1, 'bs-haze-1']]);
    gradient(defs, 'radialGradient', 'bs-moon-halo', { cx: 0.5, cy: 0.5, r: 0.5 }, [[0, 'bs-moon-halo-0'], [0.4, 'bs-moon-halo-1'], [1, 'bs-moon-halo-2']]);
    gradient(defs, 'linearGradient', 'bs-night', vertical, [[0, 'bs-night-0'], [0.6, 'bs-night-1'], [1, 'bs-night-2']]);
    gradient(defs, 'linearGradient', 'bs-plate', vertical, [[0, 'bs-plate-0'], [0.1, 'bs-plate-1'], [1, 'bs-plate-2']]);
    gradient(defs, 'linearGradient', 'bs-base-shadow', vertical, [[0, 'bs-base-shadow-0'], [1, 'bs-base-shadow-1']]);
    gradient(defs, 'linearGradient', 'bs-glass-dark', { x1: 0, y1: 0, x2: 0.4, y2: 1 }, [[0, 'bs-glass-dark-0'], [1, 'bs-glass-dark-1']]);
    gradient(defs, 'radialGradient', 'bs-glass-lit', { cx: 0.5, cy: 0.62, r: 0.62 }, [[0, 'bs-glass-lit-0'], [0.6, 'bs-glass-lit-1'], [1, 'bs-glass-lit-2']]);
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

  /**
   * An ellipse as one closed subpath, always drawn clockwise, so several of
   * them in one path fill as a single shape: overlaps do not darken.
   */
  function ellipsePath(cx, cy, rx, ry) {
    const r = `${rx.toFixed(1)} ${ry.toFixed(1)}`;
    return `M${(cx - rx).toFixed(1)} ${cy.toFixed(1)} a${r} 0 1 1 ${(2 * rx).toFixed(1)} 0 a${r} 0 1 1 ${(-2 * rx).toFixed(1)} 0 Z`;
  }

  /** How far past either edge a drifting cloud goes before it wraps round. */
  const CLOUD_MARGIN = 220;

  /**
   * A cumulus cloud at the origin, scaled by s: rounded puffs over a flat
   * base, all one shape, so the evening light runs through it as a whole:
   * cool lilac on top, the low sun warming its underside. Thin rims pick out
   * the upper puffs.
   */
  function cloud(parent, s) {
    const g = svg('g', { class: 'bs-cloud' }, parent);
    const lobes = [[-6, 4, 22, 11], [18, -8, 28, 19], [50, -16, 34, 25], [86, -8, 29, 20], [112, 2, 22, 12]];
    const outline = [[53, 9, 70, 6], ...lobes].map(([lx, ly, rx, ry]) => ellipsePath(lx * s, ly * s, rx * s, ry * s));
    svg('path', { class: 'bs-cloud-body', d: outline.join(' ') }, g);
    lobes.slice(0, 4).forEach(([lx, ly, rx, ry]) => svg('path', {
      class: 'bs-cloud-rim',
      d: `M${((lx - rx * 0.8) * s).toFixed(1)} ${((ly - ry * 0.35) * s).toFixed(1)} Q${((lx - rx * 0.3) * s).toFixed(1)} ${((ly - ry * 1.05) * s).toFixed(1)} ${((lx + rx * 0.4) * s).toFixed(1)} ${((ly - ry * 0.95) * s).toFixed(1)}`,
    }, g));
    return g;
  }

  /**
   * A long, thin band of high cloud along the top of the stage: one pattern
   * of wisps `w` wide, repeated three times from x = -w, so shifting it by
   * any amount up to `w` still covers the stage and the drift wraps
   * seamlessly.
   */
  function cloudBand(parent, y, w) {
    const wisps = [];
    for (let copy = 0; copy < 3; copy++) {
      for (let i = 0; i < 7; i++) {
        const cx = -w + copy * w + (w * (i + 0.5)) / 7 + 18 * (hash01(i * 3 + 1) - 0.5);
        wisps.push(ellipsePath(cx, y + 5 * (hash01(i * 5 + 2) - 0.5), 40 + 30 * hash01(i * 7 + 3), 4 + 3 * hash01(i * 11 + 4)));
      }
    }
    return svg('path', { class: 'bs-cloud-wisp', d: wisps.join(' ') }, parent);
  }

  // ------------------------------------------------------------------
  // Brick walls and their pieces
  // ------------------------------------------------------------------

  const windows = [];

  /**
   * A toy window piece: a white frame (arched or square), glass split by
   * mullions, and a sill. Its room lights at `lightAt` (a fraction of the
   * song; below 0 = lit from the start); dark glass reflects the sky.
   */
  function windowPiece(parent, x, y, w, h, { arched = true, lightAt = 2, panes = 2 } = {}) {
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
    svg('path', { class: 'bs-win-dark', d: outline(2.6) }, g);
    const lit = svg('path', { class: 'bs-win-lit', d: outline(2.6) }, g);
    svg('path', { class: 'bs-win-reflect', d: `M${x + w * 0.22} ${y + h * 0.78} L${x + w * 0.62} ${y + h * 0.3}` }, g);
    // The glass sits back inside its frame: a soft shade around its edge.
    svg('path', { class: 'bs-win-inner', d: outline(2.6) }, g);
    // Mullions: a centre bar, and a transom bar where the arch begins.
    let bars = `M${x + w / 2} ${y + 2.6} V${y + h - 2.6}`;
    if (panes > 1) bars += ` M${x + 2.6} ${(arched ? y + r : y + h * 0.45).toFixed(1)} H${x + w - 2.6}`;
    svg('path', { class: 'bs-win-bar', d: bars }, g);
    svg('rect', { class: 'bs-win-sill-shadow', x: x - 1.5, y: y + h + 3, width: w + 5, height: 2.5 }, g);
    svg('rect', { class: 'bs-win-sill', x: x - 2.5, y: y + h - 0.5, width: w + 5, height: 3.5, rx: 1 }, g);
    windows.push({ lit, lightAt, shown: -1 });
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
    svg('path', { class: 'bs-roof-ridge', d: `M${mid} ${apex} V${base}` }, parent);
    svg('rect', { class: 'bs-eave-shadow', x: x - 2, y: base + 4, width: w + 4, height: 5 }, parent);
    svg('rect', { class: 'bs-eave', x: x - 11, y: base - 1, width: w + 22, height: 5, rx: 1 }, parent);
    svg('rect', { class: 'bs-finial-post', x: mid - 1.5, y: apex - 10, width: 3, height: 10 }, parent);
    svg('circle', { class: 'bs-finial', cx: mid, cy: apex - 12, r: 3.6 }, parent);
  }

  /** An open belfry arcade: arches on white columns, warm light inside. */
  function belfry(parent, x, y, w, h, count) {
    const pitch = w / count;
    svg('rect', { class: 'bs-belfry-back', x, y, width: w, height: h }, parent);
    for (let i = 0; i < count; i++) {
      const ax = x + i * pitch + 3;
      const aw = pitch - 6;
      windowPiece(parent, ax, y + 3, aw, h - 6, { lightAt: -1, panes: 1 });
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
    wall(g, { x: 104, y: 252, w: 64, h: GROUND - 252, cornices: [[300, 8, 'gold'], [370, 8, 'blue']] });
    [[112, 266], [142, 266], [112, 318], [142, 318]].forEach(([wx, wy], i) => windowPiece(g, wx, wy, 16, 30, { lightAt: 0.15 + 0.2 * i }));
    // Tower A, the taller one.
    wall(g, { x: 18, y: 124, w: 94, h: GROUND - 124, depth: 12, cornices: [[178, 9, 'blue'], [262, 9, 'gold'], [344, 9, 'blue']], top: false });
    roof(g, 18, 106, 124, 60);
    belfry(g, 26, 132, 78, 40, 3);
    [[30, 196], [70, 196], [30, 280], [70, 280]].forEach(([wx, wy], i) => windowPiece(g, wx, wy, 20, 42, { lightAt: [-1, 0.42, 0.28, 0.66][i] }));
    // Tower B.
    wall(g, { x: 168, y: 170, w: 80, h: GROUND - 170, depth: 10, cornices: [[220, 8, 'gold'], [304, 8, 'blue']], top: false });
    roof(g, 168, 90, 170, 116);
    belfry(g, 176, 176, 64, 34, 3);
    [[178, 238], [214, 238], [178, 320], [214, 320]].forEach(([wx, wy], i) => windowPiece(g, wx, wy, 18, 38, { lightAt: [0.08, 0.55, -1, 0.35][i] }));
    // The loggia wing in front: an arcade on white columns, its rooms lit.
    wall(g, { x: -4, y: 390, w: 306, h: GROUND - 390, depth: 10, cornices: [[390, 6, 'gold']] });
    [[16, 410], [72, 410], [128, 410], [184, 410], [240, 410]].forEach(([wx, wy], i) => windowPiece(g, wx, wy, 34, 50, { lightAt: [-1, 0.2, 0.05, 0.48, 0.3][i], panes: 1 }));
    // Stairs at the central arch.
    svg('path', { class: 'bs-step', d: 'M118 466 h82 v-3 h-76 v-3 h-6 Z' }, g);
    return g;
  }

  /** The building site on the right: walls going up, scaffolding, bricks on a plank. */
  function site(parent) {
    const g = svg('g', { class: 'bs-site' }, parent);
    // The finished lower storeys.
    wall(g, { x: 766, y: 248, w: 210, h: GROUND - 248, cornices: [[300, 9, 'gold'], [384, 9, 'blue']], top: false });
    [[786, 318], [836, 318], [886, 318], [936, 318], [786, 404], [836, 404], [936, 404]]
      .forEach(([wx, wy], i) => windowPiece(g, wx, wy, 24, 46, { lightAt: [0.12, -1, 0.5, 0.25, 0.7, 0.38, 0.6][i] }));
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
    [[776, 252, 22, 40], [816, 252, 22, 40]].forEach(([wx, wy, ww, wh]) => windowPiece(g, wx, wy, ww, wh, { arched: false, lightAt: 0.9 }));
    // Scaffolding: poles, ledgers, braces, and planks with bricks waiting on one.
    const scaffold = 'M778 466 V188 M870 466 V188 M962 466 V188 M772 250 H970 M772 336 H970 M772 420 H970'
      + ' M778 336 L870 250 M870 420 L962 336';
    svg('path', { class: 'bs-scaffold', d: scaffold }, g);
    [[772, 246], [772, 332], [772, 416]].forEach(([px, py]) => svg('rect', { class: 'bs-plank', x: px, y: py, width: 198, height: 5, rx: 1 }, g));
    [[884, 236, 22, 'blue'], [906, 236, 22, 'gold'], [895, 226, 22, 'tan']].forEach(([bx, by, bw, tone]) => {
      svg('rect', { class: `bs-mod bs-mod--${tone}`, x: bx, y: by, width: bw, height: 10, rx: 1.5 }, g);
      studs(g, bx, bx + bw, by, { pitch: 11, w: 7, h: 3, cls: 'bs-stud bs-stud--module' });
    });
    return g;
  }

  /** A lamp post of round bricks, its lamp glowing as the evening comes. */
  function lamp(parent, x) {
    const g = svg('g', { class: 'bs-lamp' }, parent);
    const glow = svg('circle', { class: 'bs-lamp-halo', cx: x, cy: 396, r: 30 }, g);
    svg('rect', { class: 'bs-lamp-post', x: x - 2.5, y: 400, width: 5, height: GROUND - 400 }, g);
    [0, 1, 2].forEach((i) => svg('rect', { class: 'bs-lamp-ring', x: x - 4, y: 412 + i * 18, width: 8, height: 3, rx: 1 }, g));
    svg('rect', { class: 'bs-lamp-base', x: x - 7, y: GROUND - 8, width: 14, height: 8, rx: 2 }, g);
    svg('rect', { class: 'bs-lamp-cap', x: x - 7, y: 384, width: 14, height: 4, rx: 1.5 }, g);
    const bulb = svg('rect', { class: 'bs-lamp-bulb', x: x - 5.5, y: 388, width: 11, height: 12, rx: 4 }, g);
    return { glow, bulb };
  }

  /**
   * A forklift built of bricks, dim in the dusk shadow so its motion stays
   * in the background: a dull ochre body and a dark cage, a dark mast with
   * its forks, and two wheels whose spokes turn as it drives. It carries a
   * muted blue 2×2 brick. Its origin is the middle of the ground under its
   * wheels.
   */
  function forklift(parent) {
    const g = svg('g', { class: 'bs-forklift' }, parent);
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
   * Lays `group` brick by brick between `from` and `to`: courses from the
   * ground up, each course left to right, with the next brick dropping into
   * its slot. It clips the group to what is laid so far. `solid` lists the
   * group's walls as [left, right, top]; the falling brick shows only over a
   * wall, never in the air beside it. Returns a pose(t).
   */
  function builder(art, defs, group, id, { x0, x1, bottom, top, from, to, solid }) {
    const clip = svg('clipPath', { id }, defs);
    const laid = svg('rect', { x: x0, width: x1 - x0, y: bottom, height: 0 }, clip);
    const course = svg('rect', { x: x0, y: bottom, width: 0, height: COURSE }, clip);
    group.setAttribute('clip-path', `url(#${id})`);
    const drop = svg('g', { class: 'bs-drop' }, art);
    const brick = svg('rect', { class: 'bs-drop-brick', x: 0, y: 0, width: BRICK - 1, height: COURSE - 1, rx: 1.5 }, drop);
    [6, 16].forEach((sx) => svg('rect', { class: 'bs-drop-stud', x: sx, y: -3.5, width: 6, height: 4, rx: 1.2 }, drop));
    const courses = Math.ceil((bottom - top) / COURSE);
    const perCourse = Math.ceil((x1 - x0) / BRICK);
    const tones = ['tan', 'blue', 'gold'];
    return (t, still) => {
      const p = still ? 1 : clamp((t - from) / (to - from), 0, 1);
      const done = courses * p;
      const full = Math.floor(done);
      const bricks = Math.floor((done - full) * perCourse);
      laid.setAttribute('y', String(bottom - full * COURSE));
      laid.setAttribute('height', String(full * COURSE));
      course.setAttribute('y', String(bottom - (full + 1) * COURSE));
      course.setAttribute('width', String(p >= 1 ? 0 : bricks * BRICK));
      const x = x0 + bricks * BRICK;
      const slotY = bottom - (full + 1) * COURSE;
      const overWall = solid.some(([left, right, wallTop]) => x + BRICK / 2 >= left && x + BRICK / 2 <= right && slotY + COURSE >= wallTop);
      const building = p > 0 && p < 1 && overWall;
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

  function brickSite(stage, { duration = 300 } = {}) {
    windows.length = 0;
    const layer = el('div', 'layer bs-room', stage);
    const art = svg('svg', { class: 'bs-art', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, layer);
    definitions(art);
    const defs = art.querySelector('defs');
    svg('rect', { class: 'bs-sky', x: 0, y: 0, width: W, height: GROUND }, art);
    // At the very end the golden evening turns, slowly, into a clear night:
    // a deep blue sky over the sunset colours, a moon, all the stars.
    const nightSky = svg('rect', { class: 'bs-night-sky', x: 0, y: 0, width: W, height: GROUND }, art);

    const stars = svg('g', { class: 'bs-stars' }, art);
    const starField = Array.from({ length: 34 }, (_, i) => [Math.round(20 + 920 * hash01(i * 41 + 9)), Math.round(6 + 230 * hash01(i * 59 + 13) ** 1.6)]);
    const starDots = [[402, 14], [530, 46], [610, 12], [700, 52], [258, 30], [820, 70], [470, 64], [330, 58], [356, 10], [662, 34], ...starField]
      .map(([sx, sy], i) => ({ dot: svg('circle', { class: 'bs-star', cx: sx, cy: sy, r: i % 3 ? 0.9 : 1.3 }, stars), phase: hash01(i * 17 + 3) * 6.28, speed: 0.6 + 0.6 * hash01(i * 23 + 7) }));
    const sky = svg('g', {}, art);
    const sun = svg('circle', { class: 'bs-sun', cx: 0, cy: 0, r: 240 }, sky);
    // Faint shafts of light fan up from the low sun behind the hall.
    const rays = svg('g', { class: 'bs-rays' }, sky);
    [-18, -31, -44, -58].forEach((deg, i) => svg('path', {
      class: 'bs-ray', d: `M0 -2 L${640 - i * 60} ${-14 - 4 * i} L${640 - i * 60} ${14 + 4 * i} L0 2 Z`, transform: `rotate(${deg})`,
    }, rays));
    svg('path', { class: 'bs-hills bs-hills--far', d: 'M0 404 Q160 360 330 384 T640 370 T960 362 V466 H0 Z' }, sky);
    svg('path', { class: 'bs-hills', d: 'M0 420 Q120 372 250 398 T520 384 T780 396 T960 380 V466 H0 Z' }, sky);
    svg('rect', { class: 'bs-haze', x: 0, y: 330, width: W, height: GROUND - 330 }, sky);
    const BAND = 760;
    const band = cloudBand(sky, 40, BAND);
    const clouds = [[300, 104, 1.4, 0.7], [600, 78, 1.1, 1.0], [120, 58, 0.9, 1.3]]
      .map(([x, y, scale, speed]) => ({ node: cloud(sky, scale), x, y, speed }));
    // A far skyline between the two buildings, a few rooms already lit.
    const far = svg('g', { class: 'bs-far' }, art);
    svg('path', { class: 'bs-far-shape', d: 'M240 466 V420 H290 V398 H340 V410 H400 V380 H446 V404 H520 V388 H580 V412 H650 V394 H700 V408 H780 V466 Z' }, far);
    [[296, 408], [308, 408], [352, 418], [410, 390], [422, 400], [458, 412], [530, 398], [542, 398], [590, 420], [660, 404], [710, 416]]
      .forEach(([fx, fy], i) => {
        const lit = svg('rect', { class: 'bs-far-window', x: fx, y: fy, width: 4, height: 5 }, far);
        windows.push({ lit, lightAt: hash01(i * 7 + 3) * 0.8 - 0.2, shown: -1 });
      });
    const hallGroup = hall(art);
    const siteGroup = site(art);
    const lampGroup = svg('g', {}, art);
    const lamps = [lamp(lampGroup, 18), lamp(lampGroup, 944)];
    const load = svg('g', {}, art);
    const { crane: craneGroup, carriage, swing: swingGroup, hoist, cable } = crane(art, load);
    const groundGroup = ground(art);
    const studRows = Array.from(groundGroup.querySelectorAll('.bs-gstud-row'));
    // Soft contact shadows where the buildings and lamps meet the baseplate.
    const contact = svg('g', { class: 'bs-contact' }, art);
    svg('path', { class: 'bs-cast', d: `M-4 ${GROUND} H312 L332 ${GROUND + 18} H-4 Z` }, contact);
    svg('path', { class: 'bs-cast', d: `M766 ${GROUND} H984 L998 ${GROUND + 18} H778 Z` }, contact);
    [18, 944].forEach((lx) => svg('ellipse', { class: 'bs-lamp-shadow', cx: lx + 6, cy: GROUND + 3, rx: 14, ry: 3.5 }, contact));
    const truck = forklift(art);
    const loose = [
      looseBrick(art, { x: 26, y: 500, w: 224, h: 60, dx: 26, dy: 16, cols: 4, rows: 2, tone: 'tan' }),
      looseBrick(art, { x: 690, y: 508, w: 120, h: 50, dx: 22, dy: 14, cols: 2, rows: 2, tone: 'blue' }),
      looseBrick(art, { x: 560, y: 520, w: 62, h: 40, dx: 14, dy: 9, cols: 2, rows: 1, tone: 'gold' }),
      looseBrick(art, { x: 452, y: 514, w: 26, h: 24, tone: 'red', round: true }),
    ];
    // The builders: the hall (its wing first, then the towers), the site, and the crane.
    const poses = [
      builder(art, defs, hallGroup, 'bs-clip-hall', {
        x0: -12, x1: 312, bottom: GROUND, top: 40, from: BUILD.hall[0], to: BUILD.hall[1],
        solid: [[-4, 302, 390], [18, 124, 66], [104, 168, 252], [168, 258, 120]],
      }),
      builder(art, defs, siteGroup, 'bs-clip-site', {
        x0: 760, x1: 984, bottom: GROUND, top: 180, from: BUILD.site[0], to: BUILD.site[1],
        solid: [[766, 976, 200]],
      }),
    ];
    const craneClip = svg('clipPath', { id: 'bs-clip-crane' }, defs);
    const mastRect = svg('rect', { x: 892, width: 34, y: 470, height: 0 }, craneClip);
    const jibRect = svg('rect', { x: 980, y: 0, width: 0, height: 60 }, craneClip);
    craneGroup.setAttribute('clip-path', 'url(#bs-clip-crane)');
    const dusk = svg('rect', { class: 'bs-dusk', x: 0, y: 0, width: W, height: H }, art);
    // The moon shines above the evening veil, with a soft halo.
    const moon = svg('g', { class: 'bs-moon' }, art);
    svg('circle', { class: 'bs-moon-glow', cx: 336, cy: 40, r: 34 }, moon);
    svg('circle', { class: 'bs-moon-disc', cx: 336, cy: 40, r: 12 }, moon);
    [[331, 36, 2.4], [340, 44, 1.7], [338, 34, 1.1]].forEach(([mx, my, r]) => svg('circle', { class: 'bs-moon-crater', cx: mx, cy: my, r }, moon));
    onFrame((t) => {
      const day = clamp(t / duration, 0, 1);
      const still = reducedMotion.matches;
      const built = (part) => (still ? 1 : span(t, BUILD[part]));
      const night = easeInOutCubic(span(t, [duration - NIGHTFALL[0], duration - NIGHTFALL[1]]));
      // The build: sky, ground and its studs, loose bricks, skyline, walls, crane, lamps.
      sky.style.opacity = built('sky').toFixed(3);
      groundGroup.style.opacity = Math.min(1, built('ground') * 3).toFixed(3);
      studRows.forEach((row, i) => {
        const p = clamp(built('ground') * studRows.length - i, 0, 1);
        row.style.opacity = p.toFixed(3);
        row.setAttribute('transform', `translate(0 ${(6 * (1 - easeInOutCubic(p))).toFixed(1)})`);
      });
      loose.forEach((brick, i) => {
        const p = clamp(built('loose') * loose.length - i * 0.8, 0, 1);
        const fall = 1 - easeInOutCubic(p);
        brick.style.opacity = Math.min(1, p * 4).toFixed(3);
        brick.setAttribute('transform', `translate(0 ${(-70 * fall).toFixed(1)})`);
      });
      far.style.opacity = built('far').toFixed(3);
      poses.forEach((pose) => pose(t, still));
      const mast = built('mast');
      mastRect.setAttribute('y', (470 - 470 * mast).toFixed(1));
      mastRect.setAttribute('height', (470 * mast).toFixed(1));
      const jib = built('jib');
      jibRect.setAttribute('x', (980 - 612 * jib).toFixed(1));
      jibRect.setAttribute('width', (612 * jib).toFixed(1));
      const lampsUp = built('lamps');
      lampGroup.style.opacity = lampsUp.toFixed(3);
      lampGroup.setAttribute('transform', `translate(0 ${(20 * (1 - easeInOutCubic(lampsUp))).toFixed(1)})`);
      // The sun sinks behind the hall; the scene darkens a little.
      const sunAt = `translate(${(150 - 30 * day).toFixed(1)} ${(400 + 70 * easeInOutCubic(day)).toFixed(1)})`;
      sun.setAttribute('transform', sunAt);
      rays.setAttribute('transform', sunAt);
      rays.style.opacity = ((1 - 0.6 * day) * (1 - night)).toFixed(3);
      // Golden hour all song (only a light evening veil), then night falls
      // over the last NIGHTFALL seconds, slowly (no quick brightness change).
      dusk.style.opacity = (0.12 * day + 0.3 * night).toFixed(3);
      nightSky.style.opacity = (0.92 * night).toFixed(3);
      moon.style.opacity = night.toFixed(3);
      sun.style.opacity = (1 - night).toFixed(3);
      stars.style.opacity = Math.max(clamp((day - 0.8) / 0.15, 0, 1) * 0.5, night).toFixed(3);
      band.style.opacity = (1 - 0.7 * night).toFixed(3);
      // Each room lights on its own over a few seconds (about 1.5% of the
      // song); after that its light shifts a little, slowly, as if someone
      // moved about the room.
      windows.forEach((win, i) => {
        const shift = still ? 1 : 0.86 + 0.14 * Math.sin(t * (0.18 + 0.2 * hash01(i * 31 + 7)) + 6.28 * hash01(i * 17 + 11));
        const on = Math.round(clamp((day - win.lightAt) / 0.015, 0, 1) * shift * 20) / 20;
        if (on !== win.shown) {
          win.lit.style.opacity = String(on);
          win.shown = on;
        }
      });
      const lampOn = clamp((day - 0.3) / 0.03, 0, 1);
      const breathe = still ? 1 : 0.9 + 0.1 * Math.sin(t * 1.1);
      lamps.forEach(({ glow, bulb }) => {
        glow.style.opacity = (lampOn * breathe).toFixed(3);
        bulb.style.opacity = (0.45 + 0.55 * lampOn).toFixed(2);
      });
      // The first stars glimmer, slowly.
      starDots.forEach(({ dot, phase, speed }) => {
        dot.style.opacity = still ? '0.75' : (0.72 + 0.12 * Math.sin(t * speed + phase)).toFixed(2);
      });
      // The high cloud band drifts along the top of the stage.
      band.setAttribute('transform', `translate(${still ? 0 : ((t * 1.6) % BAND).toFixed(1)} 0)`);
      // The forklift, dim in the dusk shadow, carries its brick slowly back
      // and forth along the ground.
      const drive = still ? { x: 312, facing: 1, rolling: 0 } : forkliftPose(Math.max(0, t - BUILD.lift[0]));
      truck.node.style.opacity = Math.min(1, built('loose') * 3).toFixed(3);
      truck.node.setAttribute('transform', `translate(${drive.x.toFixed(1)} ${GROUND + 22}) scale(${drive.facing} 1)`);
      const spin = (drive.rolling / (2 * Math.PI * 6)) * 360;
      truck.wheels.forEach((hub) => hub.setAttribute('transform', `rotate(${spin.toFixed(1)})`));
      // The clouds drift right; each wraps round while it is off the stage.
      clouds.forEach(({ node, x, y, speed }) => {
        const lap = W + 2 * CLOUD_MARGIN;
        const cx = (((x + CLOUD_MARGIN + (still ? 0 : t * speed)) % lap) + lap) % lap - CLOUD_MARGIN;
        node.setAttribute('transform', `translate(${cx.toFixed(1)} ${y})`);
      });
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
      load.style.opacity = Math.min(1, built('loose') * 3).toFixed(3);
      cable.setAttribute('d', `M-2 38 V${(60 + drop).toFixed(1)} M2 38 V${(60 + drop).toFixed(1)}`);
      cable.style.opacity = mast >= 1 && jib >= 1 ? '1' : '0';
      carriage.style.opacity = jib >= 0.3 ? '1' : '0';
    });
    el('div', 'layer vignette bs-vignette', stage);
    return layer;
  }

  window.SongKit.themes['brick-site'] = { build: brickSite };
})();
