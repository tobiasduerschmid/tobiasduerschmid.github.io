/*
 * The "spy" stage theme for "Every Module Keeps a Secret": a noir operations
 * room behind the scenes (a dark navy room lit by a desk lamp, light through
 * venetian blinds, two searchlight beams that sweep slowly, a faint radar
 * sweep in the corner, and film-grain dust). Storyboards select it with
 * `theme: spy`; css/song-video-spy-noir.css holds its look. Only the backdrop
 * changes: the HUD, type, and boxes keep the studio language.
 *
 * Everything is a pure function of song time. Motion is slow and the lights
 * are low-contrast on purpose: the room must never compete with the
 * diagrams, and nothing large changes brightness quickly (WCAG 2.3.1).
 */
(function () {
  'use strict';

  const { onFrame, hash01 } = window.Timeline;
  const { el } = window.SongKit;

  /** Dust motes that drift slowly through the lamp light. */
  function dust(parent, count) {
    const layer = el('div', 'spy-dust', parent);
    const motes = Array.from({ length: count }, (_, i) => ({
      node: el('div', 'spy-mote', layer),
      x: hash01(i * 37 + 5) * 960,
      y: hash01(i * 91 + 2) * 540,
      drift: 4 + 6 * hash01(i * 13 + 1),
      period: 7 + 9 * hash01(i * 17 + 3),
      phase: hash01(i * 23 + 9) * Math.PI * 2,
    }));
    onFrame((t) => {
      for (const mote of motes) {
        const a = (t / mote.period) * Math.PI * 2 + mote.phase;
        const x = mote.x + mote.drift * 3 * Math.sin(a);
        const y = (mote.y - t * mote.drift + 540 * 4) % 560 - 10;
        mote.node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        mote.node.style.opacity = (0.25 + 0.25 * Math.sin(a * 1.3)).toFixed(3);
      }
    });
  }

  function spyNoir(stage) {
    const layer = el('div', 'layer spy-noir', stage);
    el('div', 'spy-base', layer);
    const blinds = el('div', 'spy-blinds', layer);
    const beams = [el('div', 'spy-beam spy-beam--left', layer), el('div', 'spy-beam spy-beam--right', layer)];
    const radar = el('div', 'spy-radar', layer);
    el('div', 'spy-radar-rings', layer);
    dust(layer, 22);
    el('div', 'spy-grain', layer);
    onFrame((t) => {
      beams[0].style.transform = `rotate(${(-30 + 16 * Math.sin(t * 0.19)).toFixed(2)}deg)`;
      beams[1].style.transform = `rotate(${(26 + 14 * Math.sin(t * 0.15 + 1.4)).toFixed(2)}deg)`;
      blinds.style.transform = `translateX(${(8 * Math.sin(t * 0.11)).toFixed(2)}px) skewX(-16deg)`;
      radar.style.transform = `rotate(${((t * 40) % 360).toFixed(1)}deg)`;
    });
    el('div', 'layer vignette', stage);
    return layer;
  }

  window.SongKit.themes.spy = { build: spyNoir };
})();
