/*
 * The "workshop" stage theme for "Small Tools, One Job Each": a workshop
 * wall behind the scenes. A pegboard shadow board holds one small tool per
 * painted outline (hammer, screwdriver, wrench, pliers, magnifier, tape
 * measure, saw), the scissors' outline stands empty because the song is
 * using them, a shop light hangs overhead, dust drifts through its light,
 * and a toolbox waits on the workbench. Storyboards select it with
 * `theme: workshop`; css/song-video-workshop.css holds its look. Only the
 * backdrop changes: the HUD, type, and boxes keep the studio language.
 *
 * Everything is a pure function of song time. Motion is slow and the scenery
 * is low-contrast on purpose: the room must never compete with the diagrams,
 * and nothing large changes brightness quickly (WCAG 2.3.1).
 */
(function () {
  'use strict';

  const { onFrame, hash01 } = window.Timeline;
  const { el, svg } = window.SongKit;
  const W = 960;
  const H = 540;
  const BENCH_TOP = 450;

  // Each tool is drawn hanging from its hook: `top` is where it meets the
  // hook, and each part is a path, the class that colours it, and an
  // optional fill rule for parts with holes (a wrench jaw, a saw handle).
  const TOOLS = {
    hammer: { top: -12, parts: [
      ['ws-wood', 'M-4 -2 H4 V68 Q4 72 0 72 Q-4 72 -4 68 Z'],
      ['ws-steel', 'M-20 -12 H8 Q20 -12 24 -3 L15 1 Q11 -4 5 -4 H-20 Z'],
    ] },
    screwdriver: { top: -4, parts: [
      ['ws-handle ws-handle--red', 'M-6 0 Q-7 18 -5 32 H5 Q7 18 6 0 Q6 -4 0 -4 Q-6 -4 -6 0 Z'],
      ['ws-steel', 'M-1.6 32 H1.6 V74 L0 78 L-1.6 74 Z'],
    ] },
    wrench: { top: -22, parts: [
      ['ws-steel', 'M0 -22 A13 13 0 1 1 -0.1 -22 Z M-4.5 -24 H4.5 V-12 H-4.5 Z', 'evenodd'],
      ['ws-steel', 'M-4 2 H4 V64 Q4 70 0 70 Q-4 70 -4 64 Z'],
    ] },
    pliers: { top: -30, parts: [
      ['ws-steel', 'M-1.5 -30 L-6 -12 Q-7 -4 -4 2 H4 Q7 -4 6 -12 L1.5 -30 Z'],
      ['ws-steel', 'M0 -6 A5 5 0 1 1 -0.1 -6 Z M0 -3 A2 2 0 1 0 0.1 -3 Z', 'evenodd'],
      ['ws-handle ws-handle--blue', 'M-4 4 Q-12 30 -13 58 Q-12 64 -8 62 Q-6 32 0 6 Z M4 4 Q12 30 13 58 Q12 64 8 62 Q6 32 0 6 Z'],
    ] },
    magnifier: { top: -26, parts: [
      ['ws-steel', 'M0 -26 A14 14 0 1 1 -0.1 -26 Z M0 -21 A9 9 0 1 0 0.1 -21 Z', 'evenodd'],
      ['ws-handle ws-handle--yellow', 'M-3.5 2 H3.5 V40 Q3.5 44 0 44 Q-3.5 44 -3.5 40 Z'],
    ] },
    tape: { top: -16, parts: [
      ['ws-handle ws-handle--yellow', 'M-2 -16 A18 18 0 1 1 -2.1 -16 Z M-2 -8 A10 10 0 1 0 -1.9 -8 Z', 'evenodd'],
      ['ws-steel', 'M14 12 H30 V17 H14 Z M30 9 H33 V20 H30 Z'],
    ] },
    saw: { top: -16, parts: [
      ['ws-steel', 'M0 -12 L96 -4 L96 8 L0 14 Z'],
      ['ws-handle ws-handle--red', 'M-30 -16 H2 V18 H-30 Q-38 1 -30 -16 Z M-22 -8 H-6 V8 H-22 Z', 'evenodd'],
    ] },
    scissors: { top: -36, parts: [
      ['ws-steel', 'M-2 0 L-7 -34 L-3 -36 L2 -2 Z M2 0 L7 -34 L3 -36 L-2 -2 Z'],
      ['ws-handle ws-handle--red', 'M-9 12 A8 8 0 1 1 -9.1 12 Z M9 12 A8 8 0 1 1 8.9 12 Z'],
    ] },
  };
  // Where each tool hangs on the board; the scissors are out, in use. The
  // tools keep to the outer edges and are drawn at TOOL_SIZE, so diagrams
  // that reach the sides of the frame pass over as little of them as possible.
  const TOOL_SIZE = 0.84;
  const BOARD = [
    { tool: 'hammer', x: 44, y: 128, tilt: -4 },
    { tool: 'screwdriver', x: 90, y: 126, tilt: 3 },
    { tool: 'wrench', x: 42, y: 254, tilt: 2 },
    { tool: 'pliers', x: 90, y: 246, tilt: -3 },
    { tool: 'magnifier', x: 64, y: 368, tilt: 4 },
    { tool: 'tape', x: 912, y: 170, tilt: 0, swing: 1 },
    { tool: 'scissors', x: 872, y: 282, tilt: -6, missing: true },
    { tool: 'saw', x: 852, y: 376, tilt: -3 },
  ];

  /** One tool on its hook, over the outline painted for it on the board. */
  function hang(parent, spec) {
    const g = svg('g', { class: 'ws-tool' }, parent);
    const { top, parts } = TOOLS[spec.tool];
    const path = (cls, d, rule, extra = {}) => svg('path', { class: cls, d, 'fill-rule': rule || 'nonzero', ...extra }, g);
    for (const [, d, rule] of parts) path('ws-outline', d, rule);
    if (!spec.missing) {
      for (const [, d, rule] of parts) path('ws-tool-shadow', d, rule, { transform: 'translate(3 4)' });
      for (const [cls, d, rule] of parts) path(cls, d, rule);
    }
    svg('path', { class: 'ws-hook', d: `M-5 ${top - 14} V${top - 4} Q-5 ${top} 0 ${top}` }, g);
    return { node: g, ...spec, phase: hash01(spec.x * 3 + spec.y) * Math.PI * 2 };
  }

  /** The workbench along the bottom, with a toolbox and a bench vise. */
  function bench(parent) {
    const art = svg('svg', { class: 'ws-bench', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, parent);
    svg('rect', { class: 'ws-bench-front', x: 0, y: BENCH_TOP + 14, width: W, height: H - BENCH_TOP - 14 }, art);
    for (let x = 60; x < W; x += 120) svg('path', { class: 'ws-bench-seam', d: `M${x} ${BENCH_TOP + 14} V${H}` }, art);
    svg('rect', { class: 'ws-bench-top', x: 0, y: BENCH_TOP, width: W, height: 14 }, art);
    svg('path', { class: 'ws-bench-edge', d: `M0 ${BENCH_TOP} H${W}` }, art);
    // A toolbox like the song's Unix toolbox, closed for now.
    const box = svg('g', { class: 'ws-toolbox', transform: `translate(150 ${BENCH_TOP})` }, art);
    svg('path', { class: 'ws-toolbox-handle', d: 'M-22 -44 V-54 H22 V-44' }, box);
    svg('rect', { class: 'ws-toolbox-body', x: -60, y: -44, width: 120, height: 44, rx: 4 }, box);
    svg('path', { class: 'ws-toolbox-lid', d: 'M-60 -30 H60' }, box);
    svg('rect', { class: 'ws-toolbox-latch', x: -7, y: -34, width: 14, height: 9, rx: 2 }, box);
    // The vise at the right end of the bench.
    const vise = svg('g', { class: 'ws-vise', transform: `translate(820 ${BENCH_TOP})` }, art);
    svg('path', { class: 'ws-vise-body', d: 'M-44 0 V-20 Q-44 -26 -38 -26 H-8 V0 Z M4 0 V-26 H34 Q40 -26 40 -20 V0 Z' }, vise);
    svg('path', { class: 'ws-vise-screw', d: 'M40 -13 H72 M72 -22 V-4' }, vise);
  }

  /** Dust motes drifting slowly through the shop light. */
  function dust(parent, count) {
    const layer = el('div', 'ws-dust', parent);
    return Array.from({ length: count }, (_, i) => ({
      node: el('div', 'ws-mote', layer),
      x: 220 + hash01(i * 37 + 5) * 520,
      y: hash01(i * 91 + 2) * 420,
      drift: 3 + 5 * hash01(i * 13 + 1),
      period: 8 + 9 * hash01(i * 17 + 3),
      phase: hash01(i * 23 + 9) * Math.PI * 2,
    }));
  }

  function workshop(stage) {
    const layer = el('div', 'layer ws-room', stage);
    el('div', 'ws-base', layer);
    el('div', 'ws-pegboard', layer);
    el('div', 'ws-light', layer);
    const fixture = el('div', 'ws-fixture', layer);
    el('div', 'ws-fixture-tube', fixture);
    const art = svg('svg', { class: 'ws-board', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, layer);
    const tools = BOARD.map((spec) => hang(art, spec));
    bench(layer);
    const motes = dust(layer, 18);
    onFrame((t) => {
      for (const tool of tools) {
        const angle = tool.tilt + (tool.swing || 0) * 2.5 * Math.sin(t * 0.9 + tool.phase);
        tool.node.setAttribute('transform', `translate(${tool.x} ${tool.y}) rotate(${angle.toFixed(2)}) scale(${TOOL_SIZE})`);
      }
      for (const mote of motes) {
        const a = (t / mote.period) * Math.PI * 2 + mote.phase;
        const x = mote.x + mote.drift * 4 * Math.sin(a);
        const y = ((mote.y - t * mote.drift) % 440 + 440) % 440;
        mote.node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        mote.node.style.opacity = (0.3 + 0.3 * Math.sin(a * 1.3)).toFixed(3);
      }
    });
    el('div', 'layer vignette ws-vignette', stage);
    return layer;
  }

  window.SongKit.themes.workshop = { build: workshop };
})();
