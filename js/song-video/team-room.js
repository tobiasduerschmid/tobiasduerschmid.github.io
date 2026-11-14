/*
 * The "team-room" theme for "Inspect and Adapt", the Scrum musical: the
 * office where the Found It team works. A large display fills most of a
 * warm white wall, the teaching surface for every slide; above it, a slim
 * team sign (the choreography writes each section's name on it). A floor-to-
 * ceiling window on the left looks out over the city in three depths; on the
 * right hang the team's task board, its sticky notes in three columns (the
 * work is on the wall), and a clock. Downlights wash the wall in soft
 * scallops and the display lights it faintly; oak planks, a rug under the
 * team, and a plant in the corner.
 *
 * The slides are laid out on the logical 588×300 SCREEN and shown 1.2 times
 * larger on the DISPLAY: slides() makes the scaled layer they go in, behind
 * the cast, and toDisplay() turns a SCREEN point into a stage point (for a
 * singer pointing at a slide).
 *
 * The room lives quietly all song: clouds drift past the window, the city's
 * lit windows glow up and down, the daylight through the window dims a
 * little as clouds pass and creeps across the floor as the sun moves, dust
 * floats in its shaft, the plant sways, a few sticky notes stir in the air,
 * and the clock keeps the song's time. Every motion is slow and small and a
 * pure function of song time (animate()), so nothing flashes (WCAG 2.3.1);
 * under reduced motion the room holds still. Storyboards select it with
 * `theme: team-room`; css/song-video-team-room.css holds its look and
 * restyles the shared badge and stamps.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE } = window.Timeline;
  const { el, svg, place } = window.SongKit;
  const W = 960;
  const H = 540;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** The logical slide frame, in stage pixels (choreography places content inside it). */
  const SCREEN = { x: 186, y: 70, w: 588, h: 300 };
  /** How much larger the display shows the slides, round the screen's centre. */
  const ZOOM = 1.2;
  const CENTRE = [SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2];
  /** A SCREEN point as the stage point where the display shows it. */
  const toDisplay = ([x, y]) => [CENTRE[0] + (x - CENTRE[0]) * ZOOM, CENTRE[1] + (y - CENTRE[1]) * ZOOM];
  /** The display's panel on the wall: the SCREEN, scaled. */
  const DISPLAY = (() => {
    const [x, y] = toDisplay([SCREEN.x, SCREEN.y]);
    return { x, y, w: SCREEN.w * ZOOM, h: SCREEN.h * ZOOM };
  })();
  /** Where the team sign's lettering sits, between the ceiling and the display. */
  const SIGN = { x: 330, y: 4, w: 300, h: 30 };
  /** Floor line where the cast stands. */
  const FLOOR = 452;
  /** Where the wall meets the floor. */
  const BASE = 420;
  /** The window's glass: floor to ceiling on the left of the wall. */
  const WIN = { x: 10, y: 16, w: 102, h: BASE - 22 };

  /** −1 … 1 over `period` seconds, starting `phase` (0–1) of the way through. */
  const wave = (t, period, phase = 0) => Math.sin((t / period + phase) * 2 * Math.PI);
  const f1 = (n) => n.toFixed(1);

  function gradient(defs, id, stops, { x2 = 0, y2 = 1, radial = false, attrs = {} } = {}) {
    const g = radial
      ? svg('radialGradient', { id, ...attrs }, defs)
      : svg('linearGradient', { id, x1: 0, y1: 0, x2, y2, ...attrs }, defs);
    for (const [offset, color, opacity = 1] of stops) svg('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }, g);
    return g;
  }

  function defsFor(root) {
    const defs = svg('defs', {}, root);
    gradient(defs, 'tr-wall', [[0, '#e3ddd2'], [0.18, '#efebe4'], [1, '#e6e0d6']]);
    gradient(defs, 'tr-floor', [[0, '#c69a6b'], [0.45, '#d2a878'], [1, '#b98c5e']]);
    gradient(defs, 'tr-sky', [[0, '#6fa3d4'], [0.45, '#a6cbe9'], [0.8, '#dbe8f1'], [1, '#efe9de']]);
    gradient(defs, 'tr-bezel', [[0, '#2a2d34'], [0.5, '#131519'], [1, '#202329']]);
    gradient(defs, 'tr-panel', [[0, '#0f1d3d'], [0.6, '#0a1430'], [1, '#060c1f']]);
    gradient(defs, 'tr-sheen', [[0, '#ffffff', 0.07], [0.35, '#ffffff', 0.015], [1, '#ffffff', 0]], { x2: 1, y2: 1 });
    gradient(defs, 'tr-scallop', [[0, '#fffaf0', 0.75], [0.55, '#fffaf0', 0.22], [1, '#fffaf0', 0]], { radial: true, attrs: { cx: 0.5, cy: 0, r: 1 } });
    gradient(defs, 'tr-halo', [[0, '#8fa8ff', 0.16], [0.7, '#8fa8ff', 0.05], [1, '#8fa8ff', 0]], { radial: true });
    gradient(defs, 'tr-daylight', [[0, '#fff6df', 0.42], [1, '#fff6df', 0]], { x2: 1, y2: 0.4 });
    gradient(defs, 'tr-shaft', [[0, '#fff8e6', 0.2], [1, '#fff8e6', 0]], { x2: 0.7, y2: 1 });
    gradient(defs, 'tr-floor-glow', [[0, '#7f9cff', 0.12], [1, '#7f9cff', 0]]);
    gradient(defs, 'tr-occlusion', [[0, '#5a4a36', 0.28], [1, '#5a4a36', 0]]);
    gradient(defs, 'tr-rug', [[0, '#7c8798'], [1, '#5f6b7d']]);
    gradient(defs, 'tr-pot', [[0, '#f1ede6'], [0.6, '#d6cfc3'], [1, '#bdb4a6']], { x2: 1, y2: 0 });
    gradient(defs, 'tr-sign', [[0, '#2d3a55'], [1, '#1b2438']]);
    const grid = svg('pattern', { id: 'tr-grid', width: 24, height: 24, patternUnits: 'userSpaceOnUse' }, defs);
    svg('path', { d: 'M24 0H0V24', fill: 'none', stroke: '#6f8fff', 'stroke-opacity': 0.07, 'stroke-width': 1 }, grid);
    // Office windows on the city's towers: rows of small panes.
    const panes = svg('pattern', { id: 'tr-panes', width: 6, height: 9, patternUnits: 'userSpaceOnUse' }, defs);
    svg('rect', { x: 1.6, y: 2.4, width: 2.6, height: 4, fill: '#e9f1f8' }, panes);
    const clip = svg('clipPath', { id: 'tr-glass' }, defs);
    svg('rect', { x: WIN.x, y: WIN.y, width: WIN.w, height: WIN.h }, clip);
    return defs;
  }

  /**
   * Poses every moving part of the room from the song time; under reduced
   * motion it holds the pose of time 0.
   */
  function animate(posers) {
    const pose = (t) => {
      const time = reducedMotion.matches ? 0 : t;
      for (const poser of posers) poser(time);
    };
    pose(0);
    onFrame(pose);
  }

  /** The wall, the ceiling's soffit with its downlights and their soft scallops, and the display's faint light on it. */
  function wall(root) {
    svg('rect', { x: 0, y: 0, width: W, height: BASE, fill: 'url(#tr-wall)' }, root);
    for (const x of [62, 270, 690, 898]) {
      svg('ellipse', { cx: x, cy: 0, rx: 70, ry: x === 62 || x === 898 ? 240 : 120, fill: 'url(#tr-scallop)' }, root);
    }
    const d = DISPLAY;
    svg('ellipse', { cx: d.x + d.w / 2, cy: d.y + d.h / 2, rx: d.w * 0.62, ry: d.h * 0.7, fill: 'url(#tr-halo)' }, root);
    svg('rect', { class: 'tr-soffit', x: 0, y: 0, width: W, height: 3 }, root);
    svg('rect', { class: 'tr-soffit-shadow', x: 0, y: 3, width: W, height: 2 }, root);
    for (const x of [62, 270, 690, 898]) svg('rect', { class: 'tr-downlight', x: x - 9, y: 0, width: 18, height: 3, rx: 1.5 }, root);
  }

  /** A soft cloud `w` wide: rounded puffs over a flat, shaded base. */
  function cloud(parent, w) {
    const g = svg('g', { class: 'tr-cloud' }, parent);
    const h = w * 0.4;
    svg('ellipse', { class: 'tr-cloud-shade', cx: w * 0.52, cy: h * 0.78, rx: w * 0.46, ry: h * 0.2 }, g);
    for (const [cx, cy, r] of [[0.24, 0.6, 0.17], [0.44, 0.42, 0.24], [0.66, 0.5, 0.19], [0.82, 0.66, 0.13]]) {
      svg('circle', { class: 'tr-cloud-puff', cx: w * cx, cy: h * cy, r: w * r }, g);
    }
    svg('rect', { class: 'tr-cloud-puff', x: w * 0.1, y: h * 0.6, width: w * 0.8, height: h * 0.28, rx: h * 0.14 }, g);
    return g;
  }

  /**
   * The floor-to-ceiling window on the left, in four panes: a sky with
   * drifting clouds, the city in three depths with rows of office windows
   * and a few lit ones glowing up and down, glints on the glass. Daylight
   * falls through it in a dusty shaft onto the floor.
   */
  function window_(root, motion) {
    const bottom = WIN.y + WIN.h;
    const g = svg('g', { class: 'tr-window' }, root);
    const glass = svg('g', { 'clip-path': 'url(#tr-glass)' }, g);
    svg('rect', { x: WIN.x, y: WIN.y, width: WIN.w, height: WIN.h, fill: 'url(#tr-sky)' }, glass);

    // Clouds drift right at their own speeds and come round again.
    const MARGIN = 72;
    const span = WIN.w + 2 * MARGIN;
    const clouds = [
      { y: 52, w: 58, speed: 1.1, start: 0.1 },
      { y: 112, w: 42, speed: 1.7, start: 0.62 },
      { y: 168, w: 66, speed: 0.75, start: 0.38 },
    ].map((c) => ({ ...c, node: cloud(glass, c.w) }));
    motion.push((t) => {
      for (const c of clouds) {
        const x = WIN.x - MARGIN + ((c.start * span + c.speed * t) % span);
        c.node.setAttribute('transform', `translate(${f1(x)} ${c.y})`);
      }
    });

    // The city: [left, height, width] blocks, paler and bluer with distance.
    const blocks = (list) => list.map(([dx, h, w]) => `M${WIN.x + dx} ${bottom} V${bottom - h} h${w} V${bottom} Z`).join('');
    const far = blocks([[-4, 226, 20], [14, 250, 15], [27, 214, 22], [47, 268, 13], [58, 232, 24], [80, 252, 17], [95, 220, 14]]);
    const mid = blocks([[-2, 168, 22], [18, 196, 17], [33, 156, 26], [57, 184, 20], [75, 150, 31]]);
    const near = blocks([[0, 98, 25], [23, 126, 22], [43, 106, 28], [69, 136, 18], [85, 112, 22]]);
    svg('path', { class: 'tr-city tr-city--far', d: far }, glass);
    svg('path', { class: 'tr-antenna', d: `M${WIN.x + 53.5} ${bottom - 268} v-20 M${WIN.x + 21} ${bottom - 250} v-10` }, glass);
    svg('path', { class: 'tr-city tr-city--mid', d: mid }, glass);
    svg('path', { class: 'tr-city-panes tr-city-panes--mid', d: mid, fill: 'url(#tr-panes)' }, glass);
    // A water tower on a mid-rise roof.
    const tower = { x: WIN.x + 37, y: bottom - 156 };
    svg('path', { class: 'tr-water-tower', d: `M${tower.x} ${tower.y} l2 -7 M${tower.x + 10} ${tower.y} l-2 -7 M${tower.x - 1} ${tower.y - 7} h12 v-7 a6 3 0 0 0 -12 0 z` }, glass);
    svg('path', { class: 'tr-city tr-city--near', d: near }, glass);
    svg('path', { class: 'tr-city-panes', d: near, fill: 'url(#tr-panes)' }, glass);
    // Lit windows, each glowing up and down at its own slow pace.
    const lights = [[7, 79], [13, 52], [31, 106], [37, 70], [49, 88], [61, 61], [73, 115], [79, 97], [91, 79], [97, 52]].map(([dx, dy], i) => ({
      node: svg('rect', { class: 'tr-city-light', x: WIN.x + dx - 0.4, y: bottom - dy - 0.2, width: 3.4, height: 4.4 }, glass),
      period: 9 + (i * 7) % 9,
      phase: (i * 0.37) % 1,
    }));
    motion.push((t) => {
      for (const l of lights) l.node.setAttribute('opacity', (0.55 + 0.35 * wave(t, l.period, l.phase)).toFixed(3));
    });
    // Glints on the glass.
    svg('path', { class: 'tr-glass-glint', d: `M${WIN.x + 34} ${WIN.y} h16 L${WIN.x - 14} ${WIN.y + 170} h-16 Z` }, glass);
    svg('path', { class: 'tr-glass-glint tr-glass-glint--thin', d: `M${WIN.x + 70} ${WIN.y} h6 L${WIN.x + 10} ${WIN.y + 160} h-6 Z` }, glass);

    svg('rect', { class: 'tr-window-frame', x: WIN.x, y: WIN.y, width: WIN.w, height: WIN.h }, g);
    svg('path', { class: 'tr-window-mullion', d: `M${WIN.x} ${WIN.y + WIN.h * 0.46}H${WIN.x + WIN.w} M${WIN.x + WIN.w / 2} ${WIN.y}V${bottom}` }, g);
    svg('rect', { class: 'tr-sill', x: WIN.x - 4, y: bottom, width: WIN.w + 8, height: 5 }, g);

    // Daylight: a shaft through the lower panes and a patch on the floor.
    // It dims a little as clouds pass and creeps right as the sun moves.
    const shaft = svg('path', { class: 'tr-shaft', fill: 'url(#tr-shaft)' }, root);
    const patch = svg('path', { class: 'tr-daylight', fill: 'url(#tr-daylight)' }, root);
    const motes = Array.from({ length: 9 }, (_, i) => ({
      node: svg('circle', { class: 'tr-dust', r: 0.8 + (i % 3) * 0.3 }, root),
      x: 34 + ((i * 53) % 150),
      y: 300 + ((i * 41) % 130),
      rise: 1.6 + (i % 4) * 0.5,
      sway: 7 + (i % 5) * 1.3,
      phase: (i * 0.29) % 1,
    }));
    const RISE = 90;
    motion.push((t) => {
      const creep = 0.09 * t;
      const shade = 0.86 + 0.14 * wave(t, 31, 0.2);
      shaft.setAttribute('d', `M${WIN.x} ${WIN.y + WIN.h * 0.5} L${WIN.x + WIN.w} ${WIN.y + WIN.h * 0.5} L${f1(WIN.x + WIN.w + 210 + creep)} ${H} L${f1(WIN.x - 10 + creep)} ${H} Z`);
      shaft.setAttribute('opacity', shade.toFixed(3));
      patch.setAttribute('d', `M${WIN.x} ${BASE} L${WIN.x + WIN.w} ${BASE} L${f1(WIN.x + WIN.w + 190 + creep)} ${H} L${f1(WIN.x - 20 + creep)} ${H} Z`);
      patch.setAttribute('opacity', shade.toFixed(3));
      for (const m of motes) {
        const loop = ((m.rise * t) / RISE + m.phase) % 1;
        const x = m.x + 0.4 * creep + 5 * wave(t, m.sway, m.phase);
        m.node.setAttribute('cx', f1(x));
        m.node.setAttribute('cy', f1(m.y - loop * RISE));
        m.node.setAttribute('opacity', (0.5 * Math.sin(Math.PI * loop) * shade).toFixed(3));
      }
    });
  }

  /** The team's task board on the right, three columns of sticky notes, and a clock above it that keeps the song's time. */
  function taskBoard(root, motion) {
    const b = { x: 846, y: 48, w: 104, h: 150 };
    const g = svg('g', { class: 'tr-board' }, root);
    svg('rect', { class: 'tr-board-shadow', x: b.x - 2, y: b.y + 3, width: b.w + 6, height: b.h + 6, rx: 4 }, g);
    svg('rect', { class: 'tr-board-frame', x: b.x - 3, y: b.y - 3, width: b.w + 6, height: b.h + 6, rx: 3 }, g);
    svg('rect', { class: 'tr-board-face', x: b.x, y: b.y, width: b.w, height: b.h, rx: 1.5 }, g);
    const colW = b.w / 3;
    svg('path', { class: 'tr-board-rule', d: `M${b.x + colW} ${b.y + 6}V${b.y + b.h - 6} M${b.x + 2 * colW} ${b.y + 6}V${b.y + b.h - 6} M${b.x + 4} ${b.y + 17}H${b.x + b.w - 4}` }, g);
    for (let c = 0; c < 3; c++) svg('path', { class: 'tr-board-heading', d: `M${b.x + c * colW + 7} ${b.y + 10}H${b.x + c * colW + colW - 7}` }, g);
    const notes = [
      [0, 0, 'yellow'], [0, 1, 'blue'], [0, 2, 'yellow'], [0, 3, 'pink'], [0, 4, 'yellow'],
      [1, 0, 'green'], [1, 1, 'yellow'],
      [2, 0, 'yellow'], [2, 1, 'blue'], [2, 2, 'green'], [2, 3, 'yellow'],
    ];
    // Three notes stir in the air, each hanging from its magnet.
    const STIR = new Map([[3, [5.3, 0.1]], [6, [6.7, 0.55]], [9, [4.9, 0.8]]]);
    const stirring = [];
    notes.forEach(([c, r, tone], i) => {
      const x = b.x + c * colW + 6 + (r % 2) * 2;
      const y = b.y + 22 + r * 25;
      const tilt = ((c * 7 + r * 5) % 5) - 2;
      const pin = [x + (colW - 12) / 2, y + 2.5];
      const note = svg('g', { transform: `rotate(${tilt} ${pin[0]} ${pin[1]})` }, g);
      svg('rect', { class: `tr-note tr-note--${tone}`, x, y, width: colW - 12, height: 19, rx: 1.2 }, note);
      svg('path', { class: 'tr-note-line', d: `M${x + 3} ${y + 9}h${colW - 20} M${x + 3} ${y + 13}h${colW - 24}` }, note);
      svg('circle', { class: 'tr-magnet', cx: pin[0], cy: pin[1], r: 1.6 }, g);
      if (STIR.has(i)) stirring.push({ note, tilt, pin, period: STIR.get(i)[0], phase: STIR.get(i)[1] });
    });
    motion.push((t) => {
      for (const s of stirring) s.note.setAttribute('transform', `rotate(${f1(s.tilt + 1.4 * wave(t, s.period, s.phase))} ${s.pin[0]} ${s.pin[1]})`);
    });

    // The clock over the board: 10:15 at the downbeat, then the song's time.
    const c = { x: b.x + b.w / 2, y: 26, r: 14 };
    const clock = svg('g', { class: 'tr-clock', transform: `translate(${c.x} ${c.y})` }, root);
    svg('circle', { class: 'tr-clock-shadow', cx: 1.5, cy: 2, r: c.r }, clock);
    svg('circle', { class: 'tr-clock-rim', r: c.r }, clock);
    svg('circle', { class: 'tr-clock-face', r: c.r - 2.2 }, clock);
    const ticks = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const inner = i % 3 ? c.r - 5 : c.r - 6.5;
      ticks.push(`M${f1(Math.sin(a) * inner)} ${f1(-Math.cos(a) * inner)}L${f1(Math.sin(a) * (c.r - 3.4))} ${f1(-Math.cos(a) * (c.r - 3.4))}`);
    }
    svg('path', { class: 'tr-clock-ticks', d: ticks.join('') }, clock);
    const hour = svg('path', { class: 'tr-clock-hand', d: 'M0 0 L0 -6.5' }, clock);
    const minute = svg('path', { class: 'tr-clock-hand', d: 'M0 0 L0 -9.5' }, clock);
    const second = svg('path', { class: 'tr-clock-second', d: 'M0 2.5 L0 -10.5' }, clock);
    svg('circle', { class: 'tr-clock-pin', r: 1.2 }, clock);
    motion.push((t) => {
      hour.setAttribute('transform', `rotate(${f1(307.5 + t / 120)})`);
      minute.setAttribute('transform', `rotate(${f1(90 + t / 10)})`);
      second.setAttribute('transform', `rotate(${f1((t * 6) % 360)})`);
    });
  }

  /** The display on the wall: its soft shadow, slim bezel, and panel. */
  function display(root) {
    const d = DISPLAY;
    svg('rect', { class: 'tr-display-shadow', x: d.x - 6, y: d.y + 6, width: d.w + 12, height: d.h + 10, rx: 12 }, root);
    svg('rect', { x: d.x - 7, y: d.y - 7, width: d.w + 14, height: d.h + 14, rx: 8, fill: 'url(#tr-bezel)' }, root);
    svg('rect', { class: 'tr-bezel-edge', x: d.x - 6.5, y: d.y - 6.5, width: d.w + 13, height: d.h + 13, rx: 7.5 }, root);
    svg('rect', { x: d.x, y: d.y, width: d.w, height: d.h, rx: 3, fill: 'url(#tr-panel)' }, root);
    svg('rect', { x: d.x, y: d.y, width: d.w, height: d.h, rx: 3, fill: 'url(#tr-grid)' }, root);
    svg('rect', { x: d.x, y: d.y, width: d.w, height: d.h, rx: 3, fill: 'url(#tr-sheen)' }, root);
  }

  /** The team sign: a slim slate panel on four standoffs, between the ceiling and the display. */
  function signBoard(root) {
    const m = SIGN;
    svg('rect', { class: 'tr-sign-shadow', x: m.x, y: m.y + 3, width: m.w, height: m.h, rx: 6 }, root);
    svg('rect', { x: m.x, y: m.y, width: m.w, height: m.h, rx: 6, fill: 'url(#tr-sign)' }, root);
    svg('rect', { class: 'tr-sign-rim', x: m.x + 2.5, y: m.y + 2.5, width: m.w - 5, height: m.h - 5, rx: 4.5 }, root);
    for (const dx of [9, m.w - 9]) svg('circle', { class: 'tr-standoff', cx: m.x + dx, cy: m.y + m.h / 2, r: 2.2 }, root);
  }

  /**
   * Oak planks toward the wall, a few a shade darker, their joints
   * staggered; the shadow where they meet the wall, the display's sheen on
   * them, and a rug under the team.
   */
  function floor(root) {
    svg('rect', { x: 0, y: BASE, width: W, height: H - BASE, fill: 'url(#tr-floor)' }, root);
    const vanish = W / 2;
    // A plank edge's x at height y: the edges converge toward the wall.
    const edge = (i, y) => vanish + i * (24 + 38 * (y - BASE) / (H - BASE));
    const dark = [];
    const joints = [];
    for (let i = -18; i < 18; i++) {
      if ((i * 7 + 40) % 5 === 0) dark.push(`M${f1(edge(i, BASE))} ${BASE} L${f1(edge(i + 1, BASE))} ${BASE} L${f1(edge(i + 1, H))} ${H} L${f1(edge(i, H))} ${H} Z`);
      for (const y of [BASE + 14 + ((i * 37 + 400) % 46), BASE + 66 + ((i * 53 + 400) % 44)]) {
        joints.push(`M${f1(edge(i, y))} ${y} L${f1(edge(i + 1, y))} ${y}`);
      }
    }
    svg('path', { class: 'tr-plank-dark', d: dark.join('') }, root);
    const boards = svg('g', { class: 'tr-boards' }, root);
    for (let i = -18; i <= 18; i++) svg('path', { d: `M${f1(edge(i, BASE))} ${BASE} L${f1(edge(i, H))} ${H}` }, boards);
    svg('path', { class: 'tr-plank-joint', d: joints.join('') }, root);
    svg('rect', { x: 0, y: BASE, width: W, height: 14, fill: 'url(#tr-occlusion)' }, root);
    const d = DISPLAY;
    svg('path', { d: `M${f1(d.x + 30)} ${BASE} H${f1(d.x + d.w - 30)} L${f1(d.x + d.w + 10)} ${BASE + 70} H${f1(d.x - 10)} Z`, fill: 'url(#tr-floor-glow)' }, root);
    svg('rect', { class: 'tr-baseboard', x: 0, y: BASE - 6, width: W, height: 6 }, root);
    // The rug lies flat: narrower where it meets the back of the room.
    svg('path', { class: 'tr-rug', d: 'M232 432 H728 L812 548 H148 Z', fill: 'url(#tr-rug)' }, root);
    svg('path', { class: 'tr-rug-border', d: 'M240 437 H720 L798 548 M162 548 L240 437' }, root);
    svg('path', { class: 'tr-rug-border tr-rug-border--inner', d: 'M250 443 H710 L784 548 M176 548 L250 443' }, root);
  }

  /** A potted plant in the right corner, its leaves swaying a little in the air. */
  function plant(root, x, motion) {
    const g = svg('g', { class: 'tr-plant', transform: `translate(${x} ${FLOOR + 4})` }, root);
    svg('ellipse', { class: 'tr-plant-shadow', cx: 2, cy: 2, rx: 22, ry: 4 }, g);
    const crown = svg('g', {}, g);
    svg('path', { class: 'tr-stem', d: 'M0 -38 C-2 -70 3 -100 -1 -128 M0 -60 C8 -80 14 -96 18 -110 M-1 -74 C-9 -92 -14 -104 -18 -114 M0 -48 C10 -56 18 -62 24 -70 M0 -52 C-10 -58 -18 -64 -24 -72' }, crown);
    // [x, y, angle, size]: the back leaves a shade darker.
    const leaves = [
      [-1, -128, -8, 1], [18, -110, 32, 1], [-18, -114, -36, 1], [12, -88, 58, 0.95], [-14, -92, -62, 0.95],
      [6, -70, 76, 0.9], [-8, -64, -82, 0.9], [2, -100, 12, 1], [24, -70, 88, 0.8], [-24, -72, -92, 0.8],
      [8, -118, 18, 0.85], [-9, -106, -20, 0.85],
    ].map(([lx, ly, angle, size], i) => {
      const leaf = svg('g', {}, crown);
      const art = svg('g', { transform: `scale(${size})` }, leaf);
      svg('path', { class: `tr-leaf${i >= 8 ? ' tr-leaf--back' : ''}`, d: 'M0 0 C8 -6 10 -20 0 -30 C-10 -20 -8 -6 0 0 Z' }, art);
      svg('path', { class: 'tr-leaf-light', d: 'M0 -2 C5 -8 6 -18 0 -27 C2 -18 2 -8 0 -2 Z' }, art);
      svg('path', { class: 'tr-leaf-vein', d: 'M0 -2 L0 -26' }, art);
      return { leaf, lx, ly, angle, period: 4.6 + (i % 4) * 0.9, phase: (i * 0.23) % 1 };
    });
    // Back leaves behind the front ones.
    for (const l of leaves.slice(8)) crown.insertBefore(l.leaf, crown.children[1]);
    svg('path', { d: 'M-20 -38 H20 L16 0 H-16 Z', fill: 'url(#tr-pot)', class: 'tr-pot' }, g);
    svg('path', { class: 'tr-pot-rim', d: 'M-21 -38 H21' }, g);
    motion.push((t) => {
      crown.setAttribute('transform', `rotate(${f1(0.8 * wave(t, 7.3))} 0 -38)`);
      for (const l of leaves) l.leaf.setAttribute('transform', `translate(${l.lx} ${l.ly}) rotate(${f1(l.angle + 2.4 * wave(t, l.period, l.phase))})`);
    });
  }

  function teamRoom(stage) {
    const layer = el('div', 'layer tr-room', stage);
    const root = svg('svg', { class: 'tr-art', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, layer);
    const motion = [];
    defsFor(root);
    wall(root);
    window_(root, motion);
    taskBoard(root, motion);
    floor(root);
    display(root);
    signBoard(root);
    plant(root, 934, motion);
    animate(motion);
    return layer;
  }

  /**
   * The layer the slides go in: the stage's frame, shown ZOOM times larger
   * round the screen's centre (css/song-video-team-room.css), behind the
   * cast. The choreography returns it so the scene culls its pictures.
   */
  function slides({ stage, content }) {
    const layer = el('div', 'layer tr-slides', stage);
    stage.insertBefore(layer, content);
    return layer;
  }

  /** The team sign's lettering, in front of the room, from `at` (until `until`). */
  function sign(layer, text, { at, until }) {
    const node = place(el('div', 'tr-sign-text is-staged', layer, text), SIGN.x, SIGN.y);
    node.style.width = `${SIGN.w}px`;
    node.style.height = `${SIGN.h}px`;
    tween(node, [{ opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1 }], at, 0.35, EASE.out);
    if (until !== undefined) fx.fadeOut(node, until - 0.2, 0.2);
    return node;
  }

  window.SongKit.themes['team-room'] = { build: teamRoom };
  window.TeamRoom = { SCREEN, DISPLAY, ZOOM, SIGN, FLOOR, toDisplay, slides, sign };
})();
