/* Cue-based light for the office opera. The choreography names the subjects
 * and their windows; CSS owns the resting/key-light palettes. Light changes
 * painted luminosity, never object opacity, geometry, or text content. */
(function () {
  'use strict';

  const { onFrame, progress, easeInOutCubic } = window.Timeline;
  const FADE = 0.9;

  function strength(windows, t) {
    return windows.reduce((brightest, [from, to = Infinity]) => {
      const fade = Math.min(FADE, (to - from) / 2);
      const enter = easeInOutCubic(progress(t, from, fade));
      const leave = 1 - easeInOutCubic(progress(t, to - fade, fade));
      return Math.max(brightest, Math.min(enter, leave));
    }, 0);
  }

  /** Register stage subjects once; every frame, including reverse seeks,
   * reconstructs their light from song time. Optional recesses soften a key
   * light while a competing reveal deserves the viewer's attention. Speech
   * and important reactions override recesses: full light starts 0.18 s
   * before the interval and holds until 0.28 s after it, with fades outside. */
  function create(stage) {
    stage.classList.add('tm-lighting');
    const subjects = [];
    onFrame((t) => {
      for (const subject of subjects) {
        const key = strength(subject.windows, t);
        const recess = strength(subject.recesses, t);
        const level = Math.max(subject.minimum, strength(subject.fullWindows, t), key * (1 - recess * 0.6)).toFixed(3);
        const presence = subject.presence ? strength(subject.presence, t).toFixed(3) : '1';
        const drawn = `${level}/${presence}`;
        if (drawn === subject.drawn) continue;
        subject.node.style.setProperty('--tm-key-light', level);
        subject.node.style.setProperty('--tm-light-presence', presence);
        subject.drawn = drawn;
      }
    });
    return {
      subject(node, { kind = 'cast', windows, recesses = [], minimum = 0, fullLight = [], presence }) {
        node.classList.add('tm-lit', `tm-lit--${kind}`);
        const fullWindows = fullLight.map(([from, to]) => [from - FADE - 0.18, to + FADE + 0.28]);
        subjects.push({ node, windows, recesses, minimum, fullWindows, presence, drawn: null });
      },
    };
  }

  window.TeammateLighting = { create };
})();
