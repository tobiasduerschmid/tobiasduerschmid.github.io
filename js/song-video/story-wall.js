/*
 * The "story-wall" stage theme for "Invest in Your Stories": the wall of a
 * team room behind the scenes. Sticky notes and pinned index cards gather in
 * loose columns under strips of masking tape at both edges (a story map, in
 * the room where stories get their conversations), finished stories carry a
 * check mark, a pendant lamp warms the wall, a few notes flutter in the
 * air-conditioning breeze, and soft light pools drift slowly across.
 * Storyboards select it with `theme: story-wall`; css/song-video-story-wall.css
 * holds its look. Only the backdrop changes: the HUD, type, and boxes keep
 * the studio language.
 *
 * The notes carry marker scribbles, never words, so the wall cannot be read
 * as content. Everything is a pure function of song time. Motion is slow and
 * the scenery is low-contrast on purpose: the room must never compete with
 * the diagrams, and nothing large changes brightness quickly (WCAG 2.3.1).
 */
(function () {
  'use strict';

  const { onFrame, hash01, beats } = window.Timeline;
  const { el, svg } = window.SongKit;
  const W = 960;
  const H = 540;
  // Column headers (masking tape) and the notes and cards under them.
  const TAPES = [
    { x: 26, y: 112, w: 116, tilt: -2.5 },
    { x: 812, y: 142, w: 122, tilt: 1.8 },
  ];
  const NOTES = [
    { x: 30, y: 136, color: 'yellow', tilt: -4 },
    { x: 90, y: 146, color: 'pink', tilt: 3, flutter: 1 },
    { x: 34, y: 198, color: 'cyan', tilt: 2 },
    { x: 94, y: 210, color: 'yellow', tilt: -3, done: true },
    { x: 26, y: 262, color: 'green', tilt: -1.5, done: true },
    { x: 826, y: 238, color: 'yellow', tilt: 2.5 },
    { x: 886, y: 232, color: 'cyan', tilt: -3, flutter: 1 },
    { x: 832, y: 298, color: 'pink', tilt: -2 },
    { x: 890, y: 306, color: 'green', tilt: 3.5, done: true },
    { x: 846, y: 362, color: 'yellow', tilt: -1, flutter: 1 },
  ];
  const CARDS = [
    { x: 30, y: 326, tilt: 2 },
    { x: 816, y: 166, tilt: -1.5 },
  ];

  /** Marker scribbles: a few wavy lines that read as handwriting, not text. */
  function scribble(parent, { x, y, w, rows, seed }) {
    for (let r = 0; r < rows; r++) {
      const len = w * (0.55 + 0.4 * hash01(seed * 7 + r));
      let d = `M${x} ${y + r * 8}`;
      for (let s = 1; s <= 6; s++) {
        const px = x + (len * s) / 6;
        const py = y + r * 8 + (s % 2 ? -1.6 : 1.6) * (0.6 + hash01(seed * 13 + r * 5 + s));
        d += ` L${px.toFixed(1)} ${py.toFixed(1)}`;
      }
      svg('path', { class: 'sw-scribble', d }, parent);
    }
  }

  /** A sticky note; its origin is the middle of its sticky top edge. */
  function note(parent, spec, index) {
    const g = svg('g', { class: `sw-note sw-note--${spec.color}` }, parent);
    svg('path', { class: 'sw-note-shadow', d: 'M-22 3 H26 V50 Q4 46 -22 52 Z' }, g);
    svg('path', { class: 'sw-note-paper', d: 'M-24 0 H24 V46 Q2 43 -24 49 Z' }, g);
    svg('rect', { class: 'sw-note-glue', x: -24, y: 0, width: 48, height: 9 }, g);
    scribble(g, { x: -16, y: 18, w: 30, rows: spec.done ? 2 : 3, seed: index + 1 });
    if (spec.done) svg('path', { class: 'sw-note-check', d: 'M4 36 l6 6 l12 -14' }, g);
    return { node: g, x: spec.x + 24, y: spec.y, tilt: spec.tilt, flutter: spec.flutter || 0, phase: hash01(index * 19 + 4) * Math.PI * 2 };
  }

  /** An index card held by a pushpin; its origin is the pin. */
  function card(parent, spec, index) {
    const g = svg('g', { class: 'sw-card' }, parent);
    svg('rect', { class: 'sw-card-shadow', x: -46, y: -3, width: 96, height: 60, rx: 2 }, g);
    svg('rect', { class: 'sw-card-paper', x: -48, y: -6, width: 96, height: 60, rx: 2 }, g);
    svg('path', { class: 'sw-card-rule', d: 'M-48 8 H48' }, g);
    for (const y of [22, 33, 44]) svg('path', { class: 'sw-card-line', d: `M-48 ${y} H48` }, g);
    scribble(g, { x: -38, y: 18, w: 70, rows: 3, seed: index + 20 });
    svg('circle', { class: 'sw-pin', cx: 0, cy: 0, r: 5 }, g);
    svg('circle', { class: 'sw-pin-shine', cx: -1.6, cy: -1.6, r: 1.6 }, g);
    return { node: g, x: spec.x + 48, y: spec.y + 6, tilt: spec.tilt, flutter: 0, phase: 0 };
  }

  /** A strip of masking tape with a scribbled column heading. */
  function tape(parent, spec, index) {
    const g = svg('g', { class: 'sw-tape', transform: `translate(${spec.x} ${spec.y}) rotate(${spec.tilt})` }, parent);
    svg('path', { class: 'sw-tape-strip', d: `M0 0 L${spec.w} 1 L${spec.w - 3} 18 L2 17 Z` }, g);
    scribble(g, { x: 12, y: 9, w: spec.w - 30, rows: 1, seed: index + 40 });
  }

  /** A pendant lamp hanging from the ceiling, with its warm pool of light. */
  function lamp(parent) {
    const art = svg('svg', { class: 'sw-lamp', viewBox: '0 0 120 90', width: 120, height: 90, 'aria-hidden': 'true' }, parent);
    svg('path', { class: 'sw-lamp-cord', d: 'M60 0 V38' }, art);
    svg('path', { class: 'sw-lamp-shade', d: 'M36 60 Q38 40 60 38 Q82 40 84 60 Z' }, art);
    svg('ellipse', { class: 'sw-lamp-bulb', cx: 60, cy: 61, rx: 10, ry: 4 }, art);
    return art;
  }

  function storyWall(stage) {
    const layer = el('div', 'layer sw-room', stage);
    el('div', 'sw-base', layer);
    el('div', 'sw-texture', layer);
    const pools = ['warm', 'violet', 'teal'].map((kind) => el('div', `sw-pool sw-pool--${kind}`, layer));
    el('div', 'sw-lamp-glow', layer);
    const hanging = lamp(layer);
    const art = svg('svg', { class: 'sw-wall', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, layer);
    TAPES.forEach((spec, i) => tape(art, spec, i));
    const pieces = [...CARDS.map((spec, i) => card(art, spec, i)), ...NOTES.map((spec, i) => note(art, spec, i))];
    const drift = [
      { x: 200, y: 120, rx: 140, ry: 50, w: 0.021, phase: 0 },
      { x: 120, y: 360, rx: 90, ry: 60, w: 0.017, phase: 2 },
      { x: 800, y: 420, rx: 120, ry: 50, w: 0.019, phase: 4 },
    ];
    onFrame((t) => {
      const pulse = beats.pulse(t, 0.35);
      for (const p of pieces) {
        // Fluttering notes lift a little on the beat, like paper in a breeze.
        const angle = p.tilt + p.flutter * (2.2 * Math.sin(t * 1.3 + p.phase) + 1.2 * pulse);
        p.node.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle.toFixed(2)})`);
      }
      pools.forEach((pool, i) => {
        const d = drift[i];
        const a = t * d.w * Math.PI * 2 + d.phase;
        pool.style.transform = `translate(${(d.x + d.rx * Math.cos(a)).toFixed(1)}px, ${(d.y + d.ry * Math.sin(a * 1.3)).toFixed(1)}px)`;
      });
      hanging.style.transform = `rotate(${(0.9 * Math.sin(t * 0.45)).toFixed(2)}deg)`;
    });
    el('div', 'layer vignette sw-vignette', stage);
    return layer;
  }

  window.SongKit.themes['story-wall'] = { build: storyWall };
})();
