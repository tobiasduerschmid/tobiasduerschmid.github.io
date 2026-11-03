/*
 * The "review-stage" theme for "Same Shape, Not the Same", the design
 * patterns musical: a Broadway stage where a code review plays out. A gold
 * proscenium with a velvet valance and tied-back drapes frames a plank
 * floor in perspective. Upstage hangs a big screen in a metal bezel, the
 * teaching surface for every diagram and app screen; above it, a marquee
 * board whose bulbs glow steadily (the choreography writes each verse's
 * pattern name on it). Two soft spotlight cones fall on the places where
 * the rival patterns stand, footlights line the stage lip, and the
 * audience sits in silhouette below.
 *
 * Everything is a pure function of song time. The light only drifts: the
 * cones sway a few pixels over several seconds and the audience nods on the
 * beat in the choruses, so nothing large changes brightness quickly
 * (WCAG 2.3.1). Under reduced motion the room holds still. Storyboards
 * select it with `theme: review-stage`; css/song-video-review-stage.css holds
 * its look and restyles the shared stickers, stamps, and badge.
 */
(function () {
  'use strict';

  const { onFrame, beats, hash01 } = window.Timeline;
  const { el, svg } = window.SongKit;
  const W = 960;
  const H = 540;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** The teaching screen's panel, in stage pixels (choreography places content inside it). */
  const SCREEN = { x: 186, y: 70, w: 588, h: 300 };
  /** Where the marquee's lettering sits. */
  const MARQUEE = { x: 330, y: 8, w: 300, h: 50 };
  /** Floor line where the cast stands. */
  const FLOOR = 452;

  function gradient(defs, id, stops, { x2 = 0, y2 = 1, radial = false, attrs = {} } = {}) {
    const g = radial
      ? svg('radialGradient', { id, ...attrs }, defs)
      : svg('linearGradient', { id, x1: 0, y1: 0, x2, y2, ...attrs }, defs);
    for (const [offset, color, opacity = 1] of stops) svg('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }, g);
    return g;
  }

  function defsFor(root) {
    const defs = svg('defs', {}, root);
    gradient(defs, 'rs-wall', [[0, '#1f1235'], [0.55, '#140c28'], [1, '#0a0b1c']]);
    gradient(defs, 'rs-gold', [[0, '#f8df9a'], [0.35, '#d8a948'], [0.7, '#9c6a22'], [1, '#e9c46a']], { x2: 1, y2: 0 });
    gradient(defs, 'rs-gold-v', [[0, '#f6dc95'], [0.5, '#c08f36'], [1, '#7c5218']]);
    gradient(defs, 'rs-velvet', [[0, '#8e1730'], [0.5, '#5e0b1f'], [1, '#2e0410']]);
    gradient(defs, 'rs-drape', [[0, '#3a0714'], [0.18, '#8d1a32'], [0.32, '#55091c'], [0.5, '#9a2038'], [0.66, '#4c0818'], [0.84, '#7f142c'], [1, '#2a0410']], { x2: 1, y2: 0 });
    gradient(defs, 'rs-floor', [[0, '#5a3520'], [0.45, '#3b2213'], [1, '#1c0f08']]);
    gradient(defs, 'rs-bezel', [[0, '#3a4058'], [0.5, '#1a1e2e'], [1, '#2b3047']]);
    gradient(defs, 'rs-panel', [[0, '#0f1d3d'], [0.6, '#0a1430'], [1, '#060c1f']]);
    gradient(defs, 'rs-sheen', [[0, '#ffffff', 0.09], [0.4, '#ffffff', 0.02], [1, '#ffffff', 0]], { x2: 1, y2: 1 });
    gradient(defs, 'rs-beam', [[0, '#fff3cf', 0.28], [0.55, '#ffe7a8', 0.1], [1, '#ffe7a8', 0]]);
    gradient(defs, 'rs-pool', [[0, '#ffe9b0', 0.32], [0.6, '#ffe2a0', 0.08], [1, '#ffe2a0', 0]], { radial: true });
    gradient(defs, 'rs-bulb', [[0, '#fffbe8'], [0.45, '#ffd776'], [1, '#ffb43a', 0]], { radial: true });
    gradient(defs, 'rs-marquee', [[0, '#5b0d22'], [1, '#2c0612']]);
    gradient(defs, 'rs-lip', [[0, '#2a160b'], [1, '#0e0703']]);
    const grid = svg('pattern', { id: 'rs-grid', width: 24, height: 24, patternUnits: 'userSpaceOnUse' }, defs);
    svg('path', { d: 'M24 0H0V24', fill: 'none', stroke: '#6f8fff', 'stroke-opacity': 0.07, 'stroke-width': 1 }, grid);
    // The centre spotlight lights the floor in front of the screen, never the
    // screen itself, so no cone of light runs behind its words.
    const below = svg('clipPath', { id: 'rs-below-screen' }, defs);
    svg('rect', { x: 0, y: SCREEN.y + SCREEN.h + 12, width: W, height: H }, below);
    return defs;
  }

  /** The back wall and the upstage screen in its bezel. */
  function backWall(root) {
    svg('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#rs-wall)' }, root);
    // Faint pilasters on the back wall, for depth.
    for (const x of [150, 810]) svg('rect', { class: 'rs-pilaster', x: x - 10, y: 40, width: 20, height: 380 }, root);
    const s = SCREEN;
    svg('rect', { class: 'rs-screen-glow', x: s.x - 26, y: s.y - 22, width: s.w + 52, height: s.h + 44, rx: 26 }, root);
    svg('rect', { x: s.x - 12, y: s.y - 10, width: s.w + 24, height: s.h + 20, rx: 14, fill: 'url(#rs-bezel)' }, root);
    svg('rect', { class: 'rs-bezel-line', x: s.x - 6, y: s.y - 4, width: s.w + 12, height: s.h + 8, rx: 10 }, root);
    svg('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: 6, fill: 'url(#rs-panel)' }, root);
    svg('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: 6, fill: 'url(#rs-grid)' }, root);
    svg('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: 6, fill: 'url(#rs-sheen)' }, root);
    // Screen feet on the floor.
    for (const x of [s.x + 70, s.x + s.w - 70]) svg('rect', { class: 'rs-screen-foot', x: x - 5, y: s.y + s.h + 10, width: 10, height: FLOOR - (s.y + s.h + 10) - 30 }, root);
  }

  /** The marquee board over the screen: a velvet sign in a gold frame, bulbs all round. */
  function marquee(root) {
    const m = MARQUEE;
    svg('rect', { x: m.x - 6, y: m.y - 4, width: m.w + 12, height: m.h + 8, rx: 12, fill: 'url(#rs-gold)' }, root);
    svg('rect', { x: m.x, y: m.y + 2, width: m.w, height: m.h - 4, rx: 8, fill: 'url(#rs-marquee)' }, root);
    const bulbs = svg('g', { class: 'rs-bulbs' }, root);
    const across = 15;
    for (let i = 0; i <= across; i++) {
      const x = m.x + 4 + (i * (m.w - 8)) / across;
      for (const y of [m.y + 1, m.y + m.h - 1]) svg('circle', { cx: x, cy: y, r: 3.4, fill: 'url(#rs-bulb)' }, bulbs);
    }
    for (const x of [m.x - 2, m.x + m.w + 2]) {
      for (let j = 1; j < 4; j++) svg('circle', { cx: x, cy: m.y + (j * m.h) / 4, r: 3.4, fill: 'url(#rs-bulb)' }, bulbs);
    }
  }

  /** Plank floor in perspective, its lip, and the footlights along it. */
  function floor(root) {
    const top = 392;
    svg('path', { d: `M0 ${top} H${W} V${H} H0 Z`, fill: 'url(#rs-floor)' }, root);
    const planks = svg('g', { class: 'rs-planks' }, root);
    const vanish = W / 2;
    for (let i = -14; i <= 14; i++) {
      const xBottom = vanish + i * 78;
      const xTop = vanish + i * 30;
      svg('path', { d: `M${xTop} ${top} L${xBottom} ${H}` }, planks);
    }
    for (const [y, o] of [[408, 0.35], [428, 0.3], [452, 0.25], [482, 0.2]]) svg('path', { d: `M0 ${y} H${W}`, 'stroke-opacity': o }, planks);
    // The screen's soft reflection on the varnish.
    svg('rect', { class: 'rs-reflection', x: SCREEN.x + 20, y: top + 2, width: SCREEN.w - 40, height: 54, rx: 20 }, root);
    svg('rect', { x: 0, y: 486, width: W, height: 14, fill: 'url(#rs-lip)' }, root);
    svg('rect', { class: 'rs-lip-trim', x: 0, y: 486, width: W, height: 2 }, root);
    const lights = svg('g', { class: 'rs-footlights' }, root);
    for (let i = 0; i < 24; i++) {
      const x = 60 + i * 36.5;
      svg('ellipse', { class: 'rs-footlight-glow', cx: x, cy: 488, rx: 16, ry: 7 }, lights);
      svg('rect', { class: 'rs-footlight', x: x - 6, y: 486, width: 12, height: 5, rx: 2 }, lights);
    }
  }

  /** Spotlight cones from above, each with its pool on the floor; they drift slowly. */
  function spotlights(root) {
    const g = svg('g', { class: 'rs-spots' }, root);
    const spots = [
      { from: [60, -20], to: 100, phase: 0 },
      { from: [900, -20], to: 860, phase: 2.1 },
      { from: [480, -30], to: 480, phase: 4.2, center: true },
    ].map((spot) => {
      const node = svg('g', { class: spot.center ? 'rs-spot rs-spot--center' : 'rs-spot' }, g);
      if (spot.center) node.setAttribute('clip-path', 'url(#rs-below-screen)');
      const beam = svg('path', { fill: 'url(#rs-beam)' }, node);
      const pool = svg('ellipse', { cx: 0, cy: FLOOR - 2, rx: 92, ry: 16, fill: 'url(#rs-pool)' }, node);
      return { ...spot, beam, pool };
    });
    function pose(t) {
      for (const spot of spots) {
        const sway = reducedMotion.matches ? 0 : 14 * Math.sin(t * 0.35 + spot.phase);
        const x = spot.to + sway;
        const [sx, sy] = spot.from;
        spot.beam.setAttribute('d', `M${sx - 10} ${sy} L${sx + 10} ${sy} L${x + 86} ${FLOOR} L${x - 86} ${FLOOR} Z`);
        spot.pool.setAttribute('cx', x.toFixed(1));
      }
    }
    pose(0);
    onFrame(pose);
  }

  /** The proscenium: valance, tied-back drapes, gold columns and arch. */
  function proscenium(root) {
    // Drapes, tied back at each side.
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 18 : W - 18;
      const inner = side < 0 ? 96 : W - 96;
      const d = `M${x0} 30 C${x0 + side * 0} 160 ${inner} 250 ${inner - side * 30} 300 C${inner - side * 12} 360 ${x0 + side * 30} 420 ${x0} 500 Z`;
      svg('path', { class: 'rs-drape', d, fill: 'url(#rs-drape)' }, root);
      svg('path', { class: 'rs-drape-tie', d: `M${inner - side * 36} 296 q${side * 14} 12 ${side * 4} 24` }, root);
      svg('circle', { class: 'rs-tassel', cx: inner - side * 30, cy: 324, r: 4 }, root);
    }
    // Valance: a velvet swag with a gold fringe.
    const swag = [];
    for (let i = 0; i < 8; i++) {
      const a = i * 120;
      swag.push(`M${a} 0 H${a + 120} V18 Q${a + 60} 44 ${a} 18 Z`);
    }
    svg('path', { class: 'rs-valance', d: swag.join(' '), fill: 'url(#rs-velvet)' }, root);
    const fringe = svg('g', { class: 'rs-fringe' }, root);
    for (let i = 0; i < 8; i++) {
      const a = i * 120;
      svg('path', { d: `M${a} 18 Q${a + 60} 44 ${a + 120} 18` }, fringe);
    }
    // Gold columns and the arch line.
    svg('rect', { x: 0, y: 0, width: 16, height: H, fill: 'url(#rs-gold-v)' }, root);
    svg('rect', { x: W - 16, y: 0, width: 16, height: H, fill: 'url(#rs-gold-v)' }, root);
    for (const x of [5, W - 11]) svg('rect', { class: 'rs-flute', x, y: 0, width: 6, height: H }, root);
    svg('rect', { x: 0, y: 0, width: W, height: 6, fill: 'url(#rs-gold)' }, root);
  }

  /** The audience in silhouette along the bottom edge; heads nod on the beat. */
  function audience(root) {
    const g = svg('g', { class: 'rs-audience' }, root);
    const rows = [
      { y: 528, r: 15, step: 38, offset: 6, seed: 1 },
      { y: 546, r: 17, step: 44, offset: 24, seed: 2 },
    ];
    const heads = [];
    for (const row of rows) {
      for (let x = row.offset; x < W + 20; x += row.step) {
        const jitter = hash01(Math.round(x * 7 + row.seed * 131));
        const head = svg('g', {}, g);
        svg('ellipse', { cx: 0, cy: 0, rx: row.r * (0.85 + 0.25 * jitter), ry: row.r * 1.05 }, head);
        svg('path', { d: `M${-row.r * 1.6} ${row.r * 2.6} Q0 ${row.r * 0.6} ${row.r * 1.6} ${row.r * 2.6} Z` }, head);
        heads.push({ node: head, x: x + (jitter - 0.5) * 10, y: row.y, phase: jitter });
      }
    }
    function pose(t) {
      const lift = reducedMotion.matches ? 0 : 3 * beats.pulse(t, 0.18);
      for (const head of heads) {
        const dy = lift * (0.6 + 0.4 * Math.sin(head.phase * 6.28 + t));
        head.node.setAttribute('transform', `translate(${head.x.toFixed(1)} ${(head.y - dy).toFixed(1)})`);
      }
    }
    pose(0);
    onFrame(pose);
  }

  function reviewStage(stage) {
    const layer = el('div', 'layer rs-room', stage);
    const root = svg('svg', { class: 'rs-art', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, layer);
    defsFor(root);
    backWall(root);
    floor(root);
    spotlights(root);
    proscenium(root);
    // The marquee hangs in front of the valance and the light, so nothing
    // runs behind the pattern's name.
    marquee(root);
    el('div', 'layer rs-vignette', stage);
    // The audience sits in front of the cast, so it is drawn on its own
    // layer over the camera layer (see the stylesheet's z-index).
    const front = el('div', 'layer rs-front', stage);
    audience(svg('svg', { class: 'rs-art', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, front));
    return layer;
  }

  window.SongKit.themes['review-stage'] = { build: reviewStage };
  window.ReviewStage = { SCREEN, MARQUEE, FLOOR };
})();
