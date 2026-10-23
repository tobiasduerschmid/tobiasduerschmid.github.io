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

  /** Velvet drapes, gathered toward the walls. */
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
    return art;
  }

  /**
   * A candle flame anchored at its base (x, y): a soft halo, a teardrop of
   * warm flame, and a pale core. Its group is animated by the room.
   */
  function flame(art, x, y) {
    const node = svg('g', { transform: `translate(${x} ${y})` }, art);
    const halo = svg('circle', { class: 'br-flame-halo', cx: 0, cy: -6, r: 10, fill: 'url(#br-flame-halo)' }, node);
    const body = svg('g', {}, node);
    svg('path', { class: 'br-flame-outer', d: 'M0 0 C-4.2 -2 -4 -7 -1.2 -11 C-0.5 -12.6 0 -14 0 -15 C0.6 -13 4.4 -8.5 3.9 -4.4 C3.6 -1.6 2 0 0 0 Z' }, body);
    svg('path', { class: 'br-flame-core', d: 'M0 -1 C-1.9 -2 -1.8 -5 -0.3 -7.4 C0.4 -5.8 1.9 -4 1.6 -2.4 C1.4 -1.3 0.8 -1 0 -1 Z' }, body);
    return { node, halo, body };
  }

  /**
   * A small gilded chandelier, built the way a real one hangs together: a
   * chain into an urn-shaped body; four S-curved arms that grow out of the
   * body and end in cups that hold the candles; and a beaded garland swagged
   * between the arms, with crystal drops hanging from it on short threads.
   */
  function chandelier(parent) {
    const art = svg('svg', { class: 'br-chandelier', viewBox: '0 0 220 120', width: 220, height: 120, 'aria-hidden': 'true' }, parent);
    const defs = svg('defs', {}, art);
    const glow = svg('radialGradient', { id: 'br-flame-halo' }, defs);
    svg('stop', { offset: 0, 'stop-color': '#ffd27a', 'stop-opacity': 0.55 }, glow);
    svg('stop', { offset: 1, 'stop-color': '#ffd27a', 'stop-opacity': 0 }, glow);
    // Gilt: bright where the arms face the candles above, darker below.
    const gilt = svg('linearGradient', { id: 'br-gilt', x1: 0, y1: 40, x2: 0, y2: 78, gradientUnits: 'userSpaceOnUse' }, defs);
    [[0, '#f1d48a'], [0.45, '#c9a24a'], [1, '#7d5d1f']].forEach(([offset, color]) => svg('stop', { offset, 'stop-color': color }, gilt));
    const urn = svg('radialGradient', { id: 'br-urn', cx: 0.38, cy: 0.32, r: 0.75 }, defs);
    [[0, '#f6dc96'], [0.5, '#c39a42'], [1, '#6e5019']].forEach(([offset, color]) => svg('stop', { offset, 'stop-color': color }, urn));
    const wax = svg('linearGradient', { id: 'br-wax', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    [[0, '#fff3dc'], [0.6, '#efe3c8'], [1, '#c9b998']].forEach(([offset, color]) => svg('stop', { offset, 'stop-color': color }, wax));

    // The chain, link by link, into the canopy of the body.
    for (let y = 1; y < 30; y += 5) svg('ellipse', { class: 'br-ch-link', cx: 110, cy: y + 2, rx: 1.4, ry: 2.6 }, art);

    // Arms: from the body, down in an S-curve, and up into a cup.
    const tips = [[32, 50], [70, 46], [150, 46], [188, 50]];
    const arms = [
      'M104 52 C88 70 44 78 32 56',
      'M106 56 C98 66 76 70 70 52',
      'M114 56 C122 66 144 70 150 52',
      'M116 52 C132 70 176 78 188 56',
    ];
    for (const d of arms) {
      svg('path', { class: 'br-ch-arm', d }, art);
      svg('path', { class: 'br-ch-arm-shine', d, transform: 'translate(0 -1.2)' }, art);
    }

    // Garland: beads swag from cup to cup, crystals hang at each low point.
    const swags = [[32, 56, 70, 52], [70, 52, 110, 68], [110, 68, 150, 52], [150, 52, 188, 56]];
    const drops = [];
    for (const [x0, y0, x1, y1] of swags) {
      const mx = (x0 + x1) / 2;
      const my = Math.max(y0, y1) + 13;
      svg('path', { class: 'br-ch-beads', d: `M${x0} ${y0} Q${mx} ${my + 6} ${x1} ${y1}` }, art);
      const lowY = (y0 + 2 * (my + 6) + y1) / 4;
      svg('line', { class: 'br-ch-thread', x1: mx, y1: lowY, x2: mx, y2: lowY + 4 }, art);
      drops.push(crystal(art, mx, lowY + 4, 1));
    }
    // A pendant crystal under each cup.
    for (const [x, y] of tips) {
      svg('line', { class: 'br-ch-thread', x1: x, y1: y + 7, x2: x, y2: y + 10 }, art);
      drops.push(crystal(art, x, y + 10, 0.8));
    }

    // The body: a canopy, an urn with a sheen and a band, and a finial.
    svg('path', { class: 'br-ch-canopy', d: 'M102 33 Q110 27 118 33 Z' }, art);
    svg('path', { class: 'br-ch-body', fill: 'url(#br-urn)', d: 'M102 34 C95 42 95 58 104 66 Q110 70 116 66 C125 58 125 42 118 34 Z' }, art);
    svg('path', { class: 'br-ch-body-ring', d: 'M97 52 Q110 57 123 52' }, art);
    svg('path', { class: 'br-ch-body-shine', d: 'M101 46 Q101 39 106 36' }, art);
    svg('path', { class: 'br-ch-finial', fill: 'url(#br-urn)', d: 'M106 67 Q110 82 114 67 Z' }, art);
    drops.push(crystal(art, 110, 82, 1.1));

    // Candles stand in their cups at the arm tips.
    const flames = [];
    for (const [x, y] of tips) {
      svg('rect', { class: 'br-ch-candle', fill: 'url(#br-wax)', x: x - 3, y: y - 15, width: 6, height: 15, rx: 1.4 }, art);
      svg('path', { class: 'br-ch-drip', d: `M${x + 1.6} ${y - 14.5} v4.5 a0.9 0.9 0 0 0 1.8 0 v-4` }, art);
      svg('line', { class: 'br-ch-wick', x1: x, y1: y - 17, x2: x, y2: y - 14.5 }, art);
      svg('path', { class: 'br-ch-cup', fill: 'url(#br-gilt)', d: `M${x - 7} ${y} Q${x} ${y - 2.4} ${x + 7} ${y} Q${x} ${y + 5.5} ${x - 7} ${y} Z` }, art);
      flames.push(flame(art, x, y - 16));
    }
    return { art, flames, drops };
  }

  /** A faceted crystal drop hanging from (x, y). */
  function crystal(art, x, y, size) {
    const g = svg('g', { transform: `translate(${x} ${y}) scale(${size})` }, art);
    svg('path', { class: 'br-ch-drop', d: 'M0 0 L2.6 5 L0 12 L-2.6 5 Z' }, g);
    svg('path', { class: 'br-ch-facet', d: 'M-1.4 4.6 L0 1.2 L0.9 6' }, g);
    return g;
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
      // Each flame flickers on its own: it stretches and settles, leans in a
      // slow draught with a quicker tremble on top, and its halo breathes.
      // Small and smooth, never a flash.
      flames.forEach((f, i) => {
        const lean = 7 * Math.sin(t * 1.9 + i * 1.7) + 3 * Math.sin(t * 5.3 + i * 2.9);
        const tall = 1 + 0.14 * Math.sin(t * 6.1 + i * 2.3) + 0.07 * Math.sin(t * 11.7 + i * 0.9);
        const wide = 1 - 0.06 * Math.sin(t * 6.1 + i * 2.3);
        f.body.setAttribute('transform', `rotate(${lean.toFixed(2)}) scale(${wide.toFixed(3)} ${tall.toFixed(3)})`);
        f.halo.setAttribute('opacity', (0.75 + 0.15 * Math.sin(t * 3.1 + i * 1.7) + 0.1 * pulse).toFixed(3));
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
