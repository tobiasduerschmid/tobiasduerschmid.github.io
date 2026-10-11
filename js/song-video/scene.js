/* Shared scene assembly for the live player and offline video exporter.
 * One scene owns the window's Timeline; separate players use separate frames.
 */
(function (root) {
  'use strict';

  const FONT_FACES = [
    '500 20px Inter', '700 20px Inter', '800 20px Inter', '900 20px Inter',
    'italic 900 20px Inter', '500 20px "Fira Code"', '600 20px "Fira Code"',
  ];

  /** Read-only view of authored lyric timings used by every choreography. */
  function songData(storyboard) {
    const lines = new Map();
    const sectionStarts = storyboard.sections.map((section) => section.lines[0].start);
    storyboard.sections.forEach((section) => {
      for (const line of section.lines) lines.set(line.id, { ...line, section: section.id });
    });
    const sectionIndex = (id) => {
      const index = storyboard.sections.findIndex((section) => section.id === id);
      if (index < 0) throw new Error(`The storyboard has no section "${id}".`);
      return index;
    };
    return {
      storyboard,
      duration: storyboard.duration,
      line(id) {
        const line = lines.get(id);
        if (!line) throw new Error(`The storyboard has no line "${id}".`);
        return line;
      },
      mark(id, word) {
        const time = (this.line(id).marks || {})[word];
        if (time === undefined) throw new Error(`Line "${id}" has no mark "${word}".`);
        return time;
      },
      sectionStart(id) {
        return Math.max(0, sectionStarts[sectionIndex(id)] - 0.2);
      },
      sectionEnd(id) {
        const next = sectionIndex(id) + 1;
        return next < sectionStarts.length ? sectionStarts[next] - 0.2 : storyboard.duration;
      },
    };
  }

  async function loadFonts() {
    await Promise.all(FONT_FACES.map((font) => root.document.fonts.load(font)));
    await root.document.fonts.ready;
  }

  /** Build a song once; seek accepts absolute audio seconds, never frame deltas. */
  function build(stage, storyboard, songId) {
    const { Timeline, SongKit: kit } = root;
    const choreograph = root.SongChoreographies[songId];
    if (!choreograph) throw new Error(`No choreography for "${songId}".`);
    const themeName = storyboard.theme || 'studio';
    const theme = kit.themes[themeName];
    if (!theme) throw new Error(`No stage theme "${themeName}".`);
    function dispose() {
      Timeline.dispose();
      stage.replaceChildren();
      stage.classList.remove(`theme-${themeName}`);
    }
    try {
      Timeline.beats.configure(storyboard.beats);
      stage.classList.add(`theme-${themeName}`);
      theme.build(stage, { duration: storyboard.duration });
      const content = kit.el('div', 'layer camera', stage);
      Timeline.camera.attach(content);
      const hud = kit.el('div', 'layer hud', stage);
      const terminal = kit.terminal(hud);
      const student = root.SongStudentAvatar ? root.SongStudentAvatar.create(content, stage) : null;
      choreograph({ song: songData(storyboard), kit, layers: { stage, content, hud }, terminal, student });
      Timeline.seek(0);
    } catch (error) {
      dispose();
      throw error;
    }
    return {
      duration: storyboard.duration,
      seek: (time) => Timeline.seek(Math.max(0, Math.min(storyboard.duration, time))),
      dispose,
    };
  }

  const api = { build, loadFonts, songData };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SongScene = api;
})(typeof window === 'undefined' ? globalThis : window);
