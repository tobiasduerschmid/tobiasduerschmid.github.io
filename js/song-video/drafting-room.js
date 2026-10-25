/*
 * The "drafting-room" stage theme for "Draw It Out": a real architectural
 * blueprint on a drafting table at night. Prussian-blue cyanotype paper,
 * mottled and creased where it was folded, carries white graph lines, a
 * double border with zone ticks, a title block in the corner, and faint
 * linework from a floor plan: walls, a door swing, a window, stairs,
 * dimension strings with architect's ticks, a section marker, and a north
 * arrow. A desk lamp on a jointed arm hangs over the top left corner, dust
 * drifts through its light, and drafting tools lie at the edges, drawn in
 * the same white linework. Storyboards select it with `theme:
 * drafting-room`; css/song-video-drafting-room.css holds its look. Only the
 * backdrop changes: the HUD, type, and boxes keep the studio language.
 *
 * Everything is a pure function of song time. Motion is slow and the scenery
 * is low-contrast on purpose: the sheet must never compete with the diagrams
 * drawn over it, and nothing large changes brightness quickly (WCAG 2.3.1).
 * Under reduced motion the dust holds still.
 */
(function () {
  'use strict';

  const { onFrame, hash01 } = window.Timeline;
  const { el, svg } = window.SongKit;
  const W = 960;
  const H = 540;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** Plain text in the sheet's lettering. */
  function letters(parent, text, attrs) {
    const node = svg('text', { class: 'dr-lettering', ...attrs }, parent);
    node.textContent = text;
    return node;
  }

  /** The drawing border: a heavy outer line, a light inner one, and zone ticks between them. */
  function border(parent) {
    const g = svg('g', { class: 'dr-border' }, parent);
    svg('rect', { class: 'dr-border-outer', x: 10, y: 10, width: W - 20, height: H - 20 }, g);
    svg('rect', { class: 'dr-border-inner', x: 18, y: 18, width: W - 36, height: H - 36 }, g);
    const ticks = [];
    for (let i = 1; i < 8; i++) {
      const x = 10 + (i * (W - 20)) / 8;
      ticks.push(`M${x} 10 V18 M${x} ${H - 18} V${H - 10}`);
    }
    for (let i = 1; i < 4; i++) {
      const y = 10 + (i * (H - 20)) / 4;
      ticks.push(`M10 ${y} H18 M${W - 18} ${y} H${W - 10}`);
    }
    svg('path', { class: 'dr-border-inner', d: ticks.join(' ') }, g);
    return g;
  }

  /** The title block in the bottom right corner, ruled into cells. */
  function titleBlock(parent) {
    const g = svg('g', { class: 'dr-title-block', transform: `translate(${W - 268} ${H - 92})` }, parent);
    svg('rect', { class: 'dr-line', x: 0, y: 0, width: 250, height: 74 }, g);
    svg('path', { class: 'dr-line-fine', d: 'M0 30 H250 M0 52 H250 M150 30 V74 M200 52 V74' }, g);
    letters(g, 'DRAW IT OUT', { x: 12, y: 22, class: 'dr-lettering dr-lettering--title' });
    letters(g, 'UML · PLAN', { x: 12, y: 46 });
    letters(g, 'A-1', { x: 162, y: 46 });
    letters(g, '1:50', { x: 12, y: 68 });
    letters(g, 'SHEET 1', { x: 152, y: 68 });
    return g;
  }

  /**
   * A dimension string between two points: the extension ticks are the
   * architect's slashes, the figure sits above the line (or beside it when
   * the string is vertical).
   */
  function dimension(parent, [x1, y1], [x2, y2], figure) {
    const g = svg('g', { class: 'dr-dimension' }, parent);
    const vertical = x1 === x2;
    svg('path', { class: 'dr-line-fine', d: `M${x1} ${y1} L${x2} ${y2}` }, g);
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      svg('path', { class: 'dr-line', d: `M${x - 5} ${y + 5} L${x + 5} ${y - 5}` }, g);
      svg('path', { class: 'dr-line-fine', d: vertical ? `M${x - 9} ${y} H${x + 9}` : `M${x} ${y - 9} V${y + 9}` }, g);
    }
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    letters(g, figure, vertical
      ? { x: mx - 8, y: my, transform: `rotate(-90 ${mx - 8} ${my})`, 'text-anchor': 'middle' }
      : { x: mx, y: my - 7, 'text-anchor': 'middle' });
    return g;
  }

  /**
   * A corner of a floor plan in the bottom left: double walls, a door and
   * its swing, a window in the wall, a flight of stairs with its arrow, and
   * a dimension string along the top.
   */
  function planFragment(parent) {
    const g = svg('g', { class: 'dr-plan', transform: 'translate(30 330)' }, parent);
    // Walls: outer and inner faces 6 units apart, with the door opening on the right.
    svg('path', { class: 'dr-line', d: 'M0 0 H210 V44 M210 82 V118 H0 Z' }, g);
    svg('path', { class: 'dr-line-fine', d: 'M6 6 H204 V44 M204 82 V112 H6 Z' }, g);
    // Door leaf and its quarter-circle swing.
    svg('path', { class: 'dr-line', d: 'M210 82 L172 82' }, g);
    svg('path', { class: 'dr-line-fine dr-line--dashed', d: 'M172 82 A38 38 0 0 1 210 44' }, g);
    // A window: three lines through the top wall.
    svg('path', { class: 'dr-line-fine', d: 'M54 0 V6 M114 0 V6 M54 3 H114' }, g);
    // An interior wall and a flight of stairs with its direction arrow.
    svg('path', { class: 'dr-line-fine', d: 'M120 6 V70 M126 6 V70' }, g);
    const treads = [];
    for (let i = 0; i < 7; i++) treads.push(`M${18 + i * 13} 64 V108`);
    svg('path', { class: 'dr-line-fine', d: `M18 64 H108 V108 H18 Z ${treads.join(' ')}` }, g);
    svg('path', { class: 'dr-line-fine', d: 'M24 86 H100 M92 80 L100 86 L92 92' }, g);
    dimension(g, [0, -22], [120, -22], '3.60');
    dimension(g, [120, -22], [210, -22], '2.70');
    return g;
  }

  /** A dimension chain down the left edge, from the top storey to the ground. */
  function heightChain(parent) {
    const g = svg('g', { class: 'dr-chain' }, parent);
    dimension(g, [40, 92], [40, 196], '3.00');
    dimension(g, [40, 196], [40, 300], '3.00');
    return g;
  }

  /** A section marker (the cut A seen on sheet 3) and a north arrow, on the right. */
  function markers(parent) {
    const g = svg('g', { class: 'dr-markers' }, parent);
    const section = svg('g', { transform: 'translate(906 330)' }, g);
    svg('circle', { class: 'dr-line', cx: 0, cy: 0, r: 16 }, section);
    svg('path', { class: 'dr-line-fine', d: 'M-16 0 H16 M16 0 L30 -10 M16 0 L30 10' }, section);
    letters(section, 'A', { x: 0, y: -4, 'text-anchor': 'middle' });
    letters(section, '3', { x: 0, y: 12, 'text-anchor': 'middle' });
    const north = svg('g', { transform: 'translate(906 404)' }, g);
    svg('circle', { class: 'dr-line-fine', cx: 0, cy: 0, r: 16 }, north);
    svg('path', { class: 'dr-north', d: 'M0 -14 L7 10 L0 5 L-7 10 Z' }, north);
    letters(north, 'N', { x: 0, y: -21, 'text-anchor': 'middle' });
    return g;
  }

  /** The desk lamp: a weighted base off-stage, two arm segments, and the shade. */
  function lamp(parent) {
    const g = svg('g', { class: 'dr-lamp' }, parent);
    svg('path', { class: 'dr-lamp-arm', d: 'M-30 -10 L58 46 L118 8' }, g);
    svg('path', { class: 'dr-lamp-spring', d: 'M6 12 L18 22 M22 24 L34 34 M70 36 L82 30 M90 26 L102 18' }, g);
    for (const [cx, cy] of [[58, 46], [118, 8]]) svg('circle', { class: 'dr-lamp-joint', cx, cy, r: 4.5 }, g);
    svg('path', { class: 'dr-lamp-shade', d: 'M112 0 L150 -10 Q172 14 168 44 L132 58 Q120 30 112 0 Z' }, g);
    svg('path', { class: 'dr-lamp-rim', d: 'M168 44 L132 58' }, g);
    return g;
  }

  /** A 30-60-90 set square with its cut-out and a scale, lying in the lower left corner. */
  function setSquare(parent) {
    const g = svg('g', { class: 'dr-tool', transform: 'translate(-26 408) rotate(-8)' }, parent);
    svg('path', { class: 'dr-tool-body', d: 'M0 0 L150 120 L0 120 Z M22 60 L22 104 L78 104 Z', 'fill-rule': 'evenodd' }, g);
    for (let i = 1; i < 14; i++) svg('path', { class: 'dr-tool-tick', d: `M${i * 10} 120 V${i % 5 ? 114 : 110}` }, g);
    return g;
  }

  /** A pair of compasses, open, in the top right corner, with the arc it just drew. */
  function compass(parent) {
    const g = svg('g', { class: 'dr-tool', transform: 'translate(900 26) rotate(18)' }, parent);
    svg('circle', { class: 'dr-tool-body', cx: 0, cy: 0, r: 7 }, g);
    svg('path', { class: 'dr-tool-leg', d: 'M-3 6 L-34 104 M3 6 L30 100' }, g);
    svg('path', { class: 'dr-tool-tick', d: 'M30 100 L33 112 M-34 104 L-35 114' }, g);
    svg('path', { class: 'dr-tool-arc', d: 'M-60 118 Q0 150 60 112' }, g);
    return g;
  }

  /** A rolled blueprint along the right edge, its end showing the spiral. */
  function roll(parent) {
    const g = svg('g', { class: 'dr-tool', transform: 'translate(934 230) rotate(84)' }, parent);
    svg('rect', { class: 'dr-roll-body', x: -70, y: -13, width: 140, height: 26, rx: 13 }, g);
    svg('path', { class: 'dr-tool-tick', d: 'M-40 -13 V13 M10 -13 V13' }, g);
    svg('path', { class: 'dr-roll-end', d: 'M70 0 m-9 0 a9 9 0 1 0 18 0 a7 7 0 1 0 -14 0 a5 5 0 1 0 10 0' }, g);
    return g;
  }

  /** A scale rule along the top edge, marked every metre with finer ticks between. */
  function ruler(parent) {
    const g = svg('g', { class: 'dr-tool', transform: 'translate(330 -6)' }, parent);
    svg('rect', { class: 'dr-tool-body', x: 0, y: 0, width: 400, height: 22, rx: 3 }, g);
    for (let i = 1; i < 40; i++) svg('path', { class: 'dr-tool-tick', d: `M${i * 10} 22 V${i % 10 ? 16 : 9}` }, g);
    return g;
  }

  /** Dust motes drifting slowly through the lamplight. */
  function dust(parent, count) {
    const layer = el('div', 'dr-dust', parent);
    return Array.from({ length: count }, (_, i) => ({
      node: el('div', 'dr-mote', layer),
      x: 60 + hash01(i * 41 + 7) * 420,
      y: hash01(i * 83 + 3) * 420,
      drift: 2 + 4 * hash01(i * 19 + 5),
      period: 9 + 8 * hash01(i * 29 + 1),
      phase: hash01(i * 31 + 11) * Math.PI * 2,
    }));
  }

  function draftingRoom(stage) {
    const layer = el('div', 'layer dr-room', stage);
    el('div', 'dr-base', layer);
    el('div', 'dr-folds', layer);
    el('div', 'dr-grid', layer);
    el('div', 'dr-light', layer);
    const art = svg('svg', { class: 'dr-props', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, layer);
    border(art);
    planFragment(art);
    heightChain(art);
    markers(art);
    titleBlock(art);
    setSquare(art);
    compass(art);
    roll(art);
    ruler(art);
    const shade = svg('g', { transform: 'translate(-8 -2)' }, art);
    lamp(shade);
    const motes = dust(layer, 16);
    onFrame((time) => {
      const t = reducedMotion.matches ? 0 : time;
      for (const mote of motes) {
        const a = (t / mote.period) * Math.PI * 2 + mote.phase;
        const x = mote.x + mote.drift * 4 * Math.sin(a);
        const y = ((mote.y + t * mote.drift) % 430 + 430) % 430;
        mote.node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        mote.node.style.opacity = (0.25 + 0.25 * Math.sin(a * 1.3)).toFixed(3);
      }
    });
    el('div', 'layer vignette dr-vignette', stage);
    return layer;
  }

  window.SongKit.themes['drafting-room'] = { build: draftingRoom };
})();
