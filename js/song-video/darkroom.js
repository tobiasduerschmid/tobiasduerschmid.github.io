/*
 * The "darkroom" stage theme for "Snapshots and Pointers": a photographer's
 * darkroom behind the scenes. Prints of earlier snapshots dry on a line
 * across the top, each held by a clothespin; two paper tags hang beside the
 * newest print, a gold one pointing at a cyan one that points at the print,
 * the way HEAD names a branch and a branch names a commit. Strips of
 * negatives hang at both edges, out-of-focus lights drift through the
 * safelight glow, and three developing trays wait on the counter.
 * Storyboards select it with `theme: darkroom`; css/song-video-darkroom.css
 * holds its look. Only the backdrop changes: the HUD, type, and boxes keep
 * the studio language.
 *
 * Everything is a pure function of song time. Motion is slow and the scenery
 * is low-contrast on purpose: the room must never compete with the diagrams,
 * and nothing large changes brightness quickly (WCAG 2.3.1).
 */
(function () {
  'use strict';

  const { onFrame, hash01, beats } = window.Timeline;
  const { el, svg } = window.SongKit;
  const W = 960;
  const H = 540;
  const COUNTER_TOP = 474;
  // The drying line sags across the top of the frame (a quadratic curve),
  // high enough that its prints stay above the boards of most scenes.
  const LINE = { x0: -20, y0: 16, cx: 480, cy: 60, x1: 980, y1: 12 };
  // Prints and tags are drawn at this size, small enough to read as scenery.
  const HANGER_SIZE = 0.86;
  // Prints along the line, oldest first: curve parameter, picture, size, and
  // resting tilt, so the line looks hand-hung rather than ruled.
  const PRINTS = [
    { u: 0.095, doodle: 'landscape', scale: 0.92, tilt: -3 },
    { u: 0.19, doodle: 'files', scale: 1.04, tilt: 2 },
    { u: 0.285, doodle: 'portrait', scale: 0.96, tilt: -1.5 },
    { u: 0.385, doodle: 'history', scale: 1.08, tilt: 3 },
    { u: 0.48, doodle: 'files', scale: 0.94, tilt: -2.5 },
    { u: 0.58, doodle: 'landscape', scale: 1.06, tilt: 1.5 },
  ];
  let ids = 0;

  function linePoint(u) {
    const v = 1 - u;
    return {
      x: v * v * LINE.x0 + 2 * v * u * LINE.cx + u * u * LINE.x1,
      y: v * v * LINE.y0 + 2 * v * u * LINE.cy + u * u * LINE.y1,
    };
  }

  /** A small picture inside a print's 46×44 image area (centred on x = 0). */
  function doodle(parent, kind) {
    const g = svg('g', { class: 'dr-doodle' }, parent);
    if (kind === 'landscape') {
      svg('circle', { class: 'dr-doodle-sun', cx: 11, cy: 20, r: 5 }, g);
      svg('path', { class: 'dr-doodle-hill', d: 'M-23 53 L-9 33 L1 44 L9 36 L23 53 Z' }, g);
    } else if (kind === 'files') {
      for (const [dx, dy] of [[-12, 15], [-4, 22]]) {
        svg('path', { class: 'dr-doodle-file', d: `M${dx} ${dy} h12 l6 6 v18 h-18 Z` }, g);
        svg('path', { class: 'dr-doodle-line', d: `M${dx + 4} ${dy + 13} h10 M${dx + 4} ${dy + 18} h7` }, g);
      }
    } else if (kind === 'portrait') {
      svg('circle', { class: 'dr-doodle-hill', cx: 0, cy: 26, r: 8 }, g);
      svg('path', { class: 'dr-doodle-hill', d: 'M-15 53 Q-14 37 0 37 Q14 37 15 53 Z' }, g);
    } else {
      // A tiny history: three snapshots in a row, each pointing at its parent.
      svg('path', { class: 'dr-doodle-line', d: 'M-12 31 H12' }, g);
      for (const x of [-12, 0, 12]) svg('circle', { class: 'dr-doodle-node', cx: x, cy: 31, r: 4.5 }, g);
    }
    return g;
  }

  /** One print hanging from a clothespin; its origin is the pin on the line. */
  function print(parent, { x, y, doodle: kind, image }) {
    const g = svg('g', { class: 'dr-print' }, parent);
    svg('rect', { class: 'dr-print-shadow', x: -25, y: 9, width: 56, height: 68, rx: 2 }, g);
    svg('rect', { class: 'dr-print-frame', x: -28, y: 5, width: 56, height: 68, rx: 2 }, g);
    svg('rect', { class: 'dr-print-image', x: -23, y: 10, width: 46, height: 44, fill: image }, g);
    doodle(g, kind);
    svg('path', { class: 'dr-print-sheen', d: 'M-23 10 H3 L-23 36 Z' }, g);
    svg('rect', { class: 'dr-pin', x: -3.5, y: -7, width: 7, height: 21, rx: 1.6 }, g);
    svg('path', { class: 'dr-pin-slit', d: 'M0 -5 V12' }, g);
    return { node: g, x, y };
  }

  /** A paper tag on a short string, its arrow pointing left along the line. */
  function tag(parent, { x, y, kind, drop }) {
    const g = svg('g', { class: `dr-tag dr-tag--${kind}` }, parent);
    svg('path', { class: 'dr-tag-string', d: `M0 0 L0 ${drop}` }, g);
    svg('path', {
      class: 'dr-tag-card',
      d: `M-26 ${drop + 12} L-14 ${drop} H22 Q26 ${drop} 26 ${drop + 4} V${drop + 20} Q26 ${drop + 24} 22 ${drop + 24} H-14 Z`,
    }, g);
    svg('circle', { class: 'dr-tag-hole', cx: 0, cy: drop + 5, r: 2.4 }, g);
    svg('path', { class: 'dr-tag-mark', d: `M-8 ${drop + 15} H14 M-8 ${drop + 15} l5 -4 M-8 ${drop + 15} l5 4` }, g);
    return { node: g, x, y };
  }

  /** A strip of negatives hanging from the line, frames and sprocket holes. */
  function negatives(parent, { x, y, frames }) {
    const g = svg('g', { class: 'dr-negatives' }, parent);
    svg('rect', { class: 'dr-neg-strip', x: -14, y: 8, width: 28, height: 10 + frames * 38, rx: 1 }, g);
    for (let i = 0; i < frames; i++) {
      const top = 14 + i * 38;
      svg('rect', { class: 'dr-neg-frame', x: -9, y: top, width: 18, height: 31, rx: 1 }, g);
      svg('circle', { class: 'dr-neg-ghost', cx: hash01(i * 13 + x) * 6 - 3, cy: top + 12, r: 4 }, g);
      for (let k = 0; k < 3; k++) {
        svg('rect', { class: 'dr-neg-hole', x: -12.5, y: top + 3 + k * 10, width: 2.5, height: 4.5, rx: 0.7 }, g);
        svg('rect', { class: 'dr-neg-hole', x: 10, y: top + 3 + k * 10, width: 2.5, height: 4.5, rx: 0.7 }, g);
      }
    }
    svg('rect', { class: 'dr-pin', x: -3.5, y: -7, width: 7, height: 20, rx: 1.6 }, g);
    return { node: g, x, y };
  }

  /** The drying line with its prints, tags, and negatives. */
  function dryingLine(parent) {
    const art = svg('svg', { class: 'dr-line-art', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, parent);
    const defs = svg('defs', {}, art);
    const image = `dr-print-grad-${++ids}`;
    const grad = svg('linearGradient', { id: image, x1: 0, y1: 0, x2: 0.4, y2: 1 }, defs);
    svg('stop', { offset: 0, 'stop-color': '#251c52' }, grad);
    svg('stop', { offset: 1, 'stop-color': '#0f2a3d' }, grad);
    svg('path', { class: 'dr-line', d: `M${LINE.x0} ${LINE.y0} Q${LINE.cx} ${LINE.cy} ${LINE.x1} ${LINE.y1}` }, art);
    const hangers = [];
    hangers.push({ ...negatives(art, { ...linePoint(0.03), frames: 7 }), swing: 0.6, period: 9.5 });
    hangers.push({ ...negatives(art, { ...linePoint(0.972), frames: 8 }), swing: 0.5, period: 11 });
    for (const [i, spec] of PRINTS.entries()) {
      const point = linePoint(spec.u);
      hangers.push({
        ...print(art, { ...point, doodle: spec.doodle, image: `url(#${image})` }),
        tilt: spec.tilt, scale: spec.scale * HANGER_SIZE, swing: 1.3, period: 5.5 + 2.5 * hash01(i * 7 + 3), beat: 0.5,
      });
    }
    // HEAD → branch → newest print, told only with colour and arrows.
    hangers.push({ ...tag(art, { ...linePoint(0.655), kind: 'branch', drop: 16 }), scale: HANGER_SIZE, swing: 3, period: 4.6, beat: 1 });
    hangers.push({ ...tag(art, { ...linePoint(0.72), kind: 'head', drop: 30 }), scale: HANGER_SIZE, swing: 3.4, period: 5.2, beat: 1 });
    hangers.forEach((hanger, i) => { hanger.phase = hash01(i * 31 + 17) * Math.PI * 2; });
    return hangers;
  }

  /** Three developing trays on the counter; a print develops in the middle one. */
  function counter(parent) {
    const art = svg('svg', { class: 'dr-counter', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, parent);
    const defs = svg('defs', {}, art);
    const id = `dr-counter-grad-${++ids}`;
    const grad = svg('linearGradient', { id, x1: 0, y1: COUNTER_TOP, x2: 0, y2: H, gradientUnits: 'userSpaceOnUse' }, defs);
    svg('stop', { offset: 0, 'stop-color': '#141629' }, grad);
    svg('stop', { offset: 1, 'stop-color': '#08091a' }, grad);
    svg('rect', { x: 0, y: COUNTER_TOP, width: W, height: H - COUNTER_TOP, fill: `url(#${id})` }, art);
    svg('path', { class: 'dr-counter-edge', d: `M0 ${COUNTER_TOP} H${W}` }, art);
    const ripples = [];
    let developing = null;
    [180, 480, 780].forEach((cx, i) => {
      svg('path', { class: 'dr-tray', d: `M${cx - 104} ${COUNTER_TOP + 8} H${cx + 104} L${cx + 120} ${COUNTER_TOP + 46} H${cx - 120} Z` }, art);
      svg('path', { class: 'dr-tray-liquid', d: `M${cx - 98} ${COUNTER_TOP + 13} H${cx + 98} L${cx + 110} ${COUNTER_TOP + 40} H${cx - 110} Z` }, art);
      svg('path', { class: 'dr-tray-rim', d: `M${cx - 104} ${COUNTER_TOP + 8} H${cx + 104}` }, art);
      if (i === 1) {
        const paper = svg('g', { class: 'dr-tray-print' }, art);
        svg('path', { class: 'dr-tray-paper', d: `M${cx - 40} ${COUNTER_TOP + 17} H${cx + 40} L${cx + 46} ${COUNTER_TOP + 36} H${cx - 46} Z` }, paper);
        developing = svg('path', { class: 'dr-tray-image', d: `M${cx - 34} ${COUNTER_TOP + 33} L${cx - 12} ${COUNTER_TOP + 22} L${cx + 2} ${COUNTER_TOP + 29} L${cx + 14} ${COUNTER_TOP + 24} L${cx + 38} ${COUNTER_TOP + 33} Z` }, paper);
      }
      ripples.push({ node: svg('path', { class: 'dr-tray-ripple', d: `M${cx - 70} ${COUNTER_TOP + 27} Q${cx} ${COUNTER_TOP + 24} ${cx + 70} ${COUNTER_TOP + 27}` }, art), phase: i * 2.1 });
    });
    return { ripples, developing };
  }

  /** Out-of-focus lights drifting slowly upward through the room. */
  function bokeh(parent, count) {
    const layer = el('div', 'dr-bokeh', parent);
    const kinds = ['warm', 'cool', 'teal'];
    return Array.from({ length: count }, (_, i) => ({
      node: el('div', `dr-bokeh-dot dr-bokeh-dot--${kinds[i % kinds.length]}`, layer),
      x: 40 + hash01(i * 53 + 7) * (W - 80),
      y: hash01(i * 29 + 3) * H,
      size: 0.5 + hash01(i * 17 + 11),
      rise: 3 + 4 * hash01(i * 11 + 5),
      phase: hash01(i * 41 + 13) * Math.PI * 2,
    }));
  }

  function darkroom(stage) {
    const layer = el('div', 'layer dr-room', stage);
    el('div', 'dr-base', layer);
    el('div', 'dr-backsplash', layer);
    // The enlarger's cone of light, breathing slowly from the top left.
    const beam = el('div', 'dr-beam', layer);
    const lights = bokeh(layer, 11);
    const { ripples, developing } = counter(layer);
    const hangers = dryingLine(layer);
    onFrame((t) => {
      const pulse = beats.pulse(t, 0.3);
      beam.style.transform = `rotate(${(-20 + 3 * Math.sin(t * 0.09)).toFixed(2)}deg)`;
      beam.style.opacity = (0.8 + 0.2 * Math.sin(t * 0.13)).toFixed(3);
      for (const h of hangers) {
        const angle = (h.tilt || 0) + h.swing * Math.sin((t / h.period) * Math.PI * 2 + h.phase) + (h.beat || 0) * pulse;
        h.node.setAttribute('transform', `translate(${h.x.toFixed(1)} ${h.y.toFixed(1)}) rotate(${angle.toFixed(2)}) scale(${h.scale || 1})`);
      }
      for (const dot of lights) {
        const y = ((dot.y - t * dot.rise) % (H + 120) + H + 120) % (H + 120) - 60;
        const x = dot.x + 18 * Math.sin(t * 0.07 + dot.phase);
        dot.node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${dot.size.toFixed(2)})`;
        dot.node.style.opacity = (0.55 + 0.35 * Math.sin(t * 0.21 + dot.phase)).toFixed(3);
      }
      for (const ripple of ripples) {
        ripple.node.setAttribute('transform', `translate(${(10 * Math.sin(t * 0.6 + ripple.phase)).toFixed(1)} 0)`);
      }
      // A print develops over 24 s, rests, and fades for the next one: slow, never a flash.
      const c = t % 36;
      developing.setAttribute('opacity', (c < 24 ? c / 24 : c < 32 ? 1 : 1 - (c - 32) / 4).toFixed(3));
    });
    el('div', 'layer vignette dr-vignette', stage);
    return layer;
  }

  window.SongKit.themes.darkroom = { build: darkroom };
})();
