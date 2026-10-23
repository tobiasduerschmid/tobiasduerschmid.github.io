/*
 * The "ballroom" stage theme for "Red, Green, Refactor": an evening ballroom
 * behind the scenes (a plum-and-navy hall with art-deco wall panels, velvet
 * drapes at both sides, a chandelier, slow mirror-ball light flecks, two warm
 * follow-spots, and a polished parquet floor in perspective). Storyboards
 * select it with `theme: ballroom`; css/song-video-ballroom.css holds its
 * look. Only the backdrop changes: the HUD, type, and boxes keep the studio
 * language.
 *
 * Everything is a pure function of song time. Motion is slow and the lights
 * are low-contrast on purpose: the room must never compete with the
 * diagrams, and nothing large changes brightness quickly (WCAG 2.3.1).
 */
(function () {
  'use strict';

  const { onFrame, hash01, beats } = window.Timeline;
  const { el, svg } = window.SongKit;
  const W = 960;
  const H = 540;
  const FLOOR_TOP = 404;

  /** Art-deco wall: tall panels with fan arches, drawn once as faint gold lines. */
  function wall(parent) {
    const art = svg('svg', { class: 'br-wall', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, parent);
    // Each panel is a little lighter under its arch, falling off toward the floor.
    const grad = svg('linearGradient', { id: 'br-panel-grad', x1: 0, y1: 0, x2: 0, y2: 1 }, svg('defs', {}, art));
    svg('stop', { offset: 0, 'stop-color': '#ffd68c', 'stop-opacity': 0.06 }, grad);
    svg('stop', { offset: 1, 'stop-color': '#ffd68c', 'stop-opacity': 0.01 }, grad);
    for (let i = 0; i < 7; i++) {
      const x = 92 + i * 132;
      svg('path', { class: 'br-wall-panel', d: `M${x - 46} ${FLOOR_TOP} V150 Q${x - 46} 96 ${x} 86 Q${x + 46} 96 ${x + 46} 150 V${FLOOR_TOP}` }, art);
      for (let r = 0; r < 4; r++) {
        const a = -70 + r * 46.7;
        const rad = (a * Math.PI) / 180;
        svg('line', { class: 'br-wall-fan', x1: x, y1: 150, x2: (x + 38 * Math.sin(rad)).toFixed(1), y2: (150 - 38 * Math.cos(rad)).toFixed(1) }, art);
      }
      svg('circle', { class: 'br-wall-boss', cx: x, cy: 150, r: 4 }, art);
      // The panel's arch carries a faint inner bevel, catching the light.
      svg('path', { class: 'br-wall-bevel', d: `M${x - 41} ${FLOOR_TOP} V152 Q${x - 41} 101 ${x} 92 Q${x + 41} 101 ${x + 41} 152` }, art);
    }
    svg('line', { class: 'br-wall-rail', x1: 0, y1: 300, x2: W, y2: 300 }, art);
    return art;
  }

  /** The parquet floor in one-point perspective, with a soft reflection. */
  function floor(parent) {
    const art = svg('svg', { class: 'br-floor', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, parent);
    const defs = svg('defs', {}, art);
    const grad = svg('linearGradient', { id: 'br-floor-grad', x1: 0, y1: FLOOR_TOP, x2: 0, y2: H, gradientUnits: 'userSpaceOnUse' }, defs);
    svg('stop', { offset: 0, 'stop-color': '#2b1a33' }, grad);
    svg('stop', { offset: 1, 'stop-color': '#120c1c' }, grad);
    const shine = svg('radialGradient', { id: 'br-floor-shine', cx: 480, cy: FLOOR_TOP + 20, r: 420, gradientUnits: 'userSpaceOnUse', gradientTransform: `translate(0 ${FLOOR_TOP}) scale(1 0.22) translate(0 ${-FLOOR_TOP})` }, defs);
    svg('stop', { offset: 0, 'stop-color': '#ffd98a', 'stop-opacity': 0.26 }, shine);
    svg('stop', { offset: 1, 'stop-color': '#ffd98a', 'stop-opacity': 0 }, shine);
    svg('rect', { x: 0, y: FLOOR_TOP, width: W, height: H - FLOOR_TOP, fill: 'url(#br-floor-grad)' }, art);
    const vx = 480;
    const vy = 120;
    for (let i = -14; i <= 14; i++) {
      const bx = vx + i * 74;
      const tx = vx + (bx - vx) * ((FLOOR_TOP - vy) / (H - vy));
      svg('line', { class: 'br-floor-seam', x1: tx.toFixed(1), y1: FLOOR_TOP, x2: bx, y2: H }, art);
    }
    for (let k = 1; k <= 5; k++) {
      const y = FLOOR_TOP + (H - FLOOR_TOP) * (1 - Math.pow(0.68, k));
      svg('line', { class: 'br-floor-row', x1: 0, y1: y.toFixed(1), x2: W, y2: y.toFixed(1) }, art);
    }
    svg('rect', { x: 0, y: FLOOR_TOP, width: W, height: H - FLOOR_TOP, fill: 'url(#br-floor-shine)' }, art);
    svg('line', { class: 'br-floor-edge', x1: 0, y1: FLOOR_TOP, x2: W, y2: FLOOR_TOP }, art);
    return art;
  }

  /** Velvet drapes, gathered toward the walls, with gold tassels. */
  function drape(parent, side) {
    const art = svg('svg', { class: `br-drape br-drape--${side}`, viewBox: '0 0 130 470', width: 130, height: 470, 'aria-hidden': 'true' }, parent);
    const defs = svg('defs', {}, art);
    const grad = svg('linearGradient', { id: `br-drape-grad-${side}`, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    [[0, '#1b1446'], [0.18, '#2f2470'], [0.32, '#191241'], [0.5, '#32277a'], [0.66, '#1a1343'], [0.84, '#2d2268'], [1, '#140f36']]
      .forEach(([offset, color]) => svg('stop', { offset, 'stop-color': color }, grad));
    svg('path', { d: 'M0 0 H124 Q96 150 74 300 Q66 360 88 470 H0 Z', fill: `url(#br-drape-grad-${side})` }, art);
    // Soft fold highlights and shadows down the velvet.
    for (const [d, cls] of [['M22 0 Q18 160 16 300 Q16 380 24 470', 'br-drape-fold'], ['M52 0 Q44 160 40 300 Q40 380 52 470', 'br-drape-fold'], ['M36 0 Q30 160 28 300 Q28 380 38 470', 'br-drape-crease'], ['M86 0 Q70 150 58 300 Q56 380 70 470', 'br-drape-crease']]) {
      svg('path', { class: cls, d }, art);
    }
    svg('path', { class: 'br-drape-hem', d: 'M0 0 H124 Q96 150 74 300 Q66 360 88 470' }, art);
    svg('path', { class: 'br-drape-tie', d: 'M58 300 Q74 296 84 306' }, art);
    svg('circle', { class: 'br-drape-tassel', cx: 86, cy: 312, r: 6 }, art);
    svg('path', { class: 'br-drape-tassel', d: 'M80 316 L78 340 H94 L92 316 Z' }, art);
    return art;
  }

  /** A small chandelier: gold arms, crystal drops, and warm candle points. */
  function chandelier(parent) {
    const art = svg('svg', { class: 'br-chandelier', viewBox: '0 0 220 120', width: 220, height: 120, 'aria-hidden': 'true' }, parent);
    svg('line', { class: 'br-ch-chain', x1: 110, y1: 0, x2: 110, y2: 34 }, art);
    for (const d of ['M30 58 Q70 92 110 60 Q150 92 190 58', 'M62 50 Q86 74 110 52 Q134 74 158 50']) {
      svg('path', { class: 'br-ch-arm', d }, art);
      // A thin highlight along the top of each gilded arm.
      svg('path', { class: 'br-ch-arm-shine', d, transform: 'translate(0 -1)' }, art);
    }
    svg('ellipse', { class: 'br-ch-body', cx: 110, cy: 52, rx: 15, ry: 20 }, art);
    svg('ellipse', { class: 'br-ch-body-ring', cx: 110, cy: 58, rx: 15, ry: 4 }, art);
    svg('path', { class: 'br-ch-body-shine', d: 'M102 40 Q104 34 110 33' }, art);
    const flames = [];
    for (const x of [30, 62, 110, 158, 190]) {
      svg('rect', { class: 'br-ch-candle', x: x - 3, y: 38, width: 6, height: 16, rx: 2 }, art);
      // A wick and a wax drip on each candle, and a cup under it.
      svg('line', { class: 'br-ch-wick', x1: x, y1: 36, x2: x, y2: 39 }, art);
      svg('path', { class: 'br-ch-drip', d: `M${x + 3} 40 q-1.4 3 0 5.5` }, art);
      svg('path', { class: 'br-ch-cup', d: `M${x - 5} 54 Q${x} 58 ${x + 5} 54 Z` }, art);
      flames.push(svg('ellipse', { class: 'br-ch-flame', cx: x, cy: 34, rx: 3.5, ry: 6 }, art));
    }
    const drops = [];
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 17.5;
      const y = 78 + 10 * Math.sin((i / 8) * Math.PI);
      drops.push(svg('path', { class: 'br-ch-drop', d: `M${x} ${y} l3 7 l-3 7 l-3 -7 Z` }, art));
      // A facet line catches the light on each crystal.
      svg('path', { class: 'br-ch-facet', d: `M${x - 1.6} ${y + 6} L${x} ${y + 2} L${x + 1} ${y + 7}` }, art);
    }
    return { art, flames, drops };
  }

  /** Mirror-ball flecks: soft dots that drift slowly across the walls. */
  function flecks(parent, count) {
    const layer = el('div', 'br-flecks', parent);
    const dots = Array.from({ length: count }, (_, i) => ({
      node: el('div', 'br-fleck', layer),
      x: hash01(i * 41 + 3) * W,
      y: 40 + hash01(i * 67 + 11) * 330,
      speed: 7 + 7 * hash01(i * 13 + 5),
      phase: hash01(i * 29 + 7) * Math.PI * 2,
      size: 0.6 + 0.8 * hash01(i * 7 + 19),
    }));
    onFrame((t) => {
      for (const dot of dots) {
        const x = ((dot.x + t * dot.speed) % (W + 40)) - 20;
        const y = dot.y + 6 * Math.sin(t * 0.4 + dot.phase);
        const glow = 0.18 + 0.14 * Math.sin(t * 0.7 + dot.phase * 2);
        dot.node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${dot.size.toFixed(2)})`;
        dot.node.style.opacity = glow.toFixed(3);
      }
    });
  }

  function ballroom(stage) {
    const layer = el('div', 'layer br-room', stage);
    el('div', 'br-base', layer);
    wall(layer);
    const spots = [el('div', 'br-spot br-spot--left', layer), el('div', 'br-spot br-spot--right', layer)];
    flecks(layer, 26);
    floor(layer);
    const { art: lamp, flames, drops } = chandelier(layer);
    drape(layer, 'left');
    drape(layer, 'right');
    el('div', 'br-glow', layer);
    onFrame((t) => {
      spots[0].style.transform = `rotate(${(-24 + 9 * Math.sin(t * 0.17)).toFixed(2)}deg)`;
      spots[1].style.transform = `rotate(${(22 + 8 * Math.sin(t * 0.13 + 1.7)).toFixed(2)}deg)`;
      lamp.style.transform = `rotate(${(0.8 * Math.sin(t * 0.5)).toFixed(2)}deg)`;
      const pulse = beats.pulse(t, 0.35);
      flames.forEach((flame, i) => {
        flame.setAttribute('opacity', (0.75 + 0.15 * Math.sin(t * 3.1 + i * 1.7) + 0.1 * pulse).toFixed(3));
      });
      // Now and then one crystal catches the light: a slow, small glint.
      drops.forEach((drop, i) => {
        const glint = Math.max(0, Math.sin(t * 0.55 + i * 2.1) - 0.92) / 0.08;
        drop.setAttribute('opacity', (0.7 + 0.3 * glint).toFixed(3));
      });
    });
    el('div', 'layer vignette br-vignette', stage);
    return layer;
  }

  window.SongKit.themes.ballroom = { build: ballroom };
})();
