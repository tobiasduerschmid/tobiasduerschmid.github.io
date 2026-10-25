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

  // Each stage's top-level pictures and whether they are shown; see culledPictures().
  const cullings = new WeakMap();

  /**
   * Transparent top-level pictures leave the document until they show again;
   * a comment keeps each one's place. Their DOM and timeline stay in memory
   * for arbitrary seeks, but out of the document they cost no style, layout,
   * paint, or compositor surface. Hiding them with display: none is not
   * enough: WebKit keeps allocating style data for paused animations posed
   * inside a display:none subtree that was once rendered, until an iPhone
   * runs out of memory within seconds. Nested words/cards are not culled:
   * they can reserve space in flex layouts.
   */
  function manageVisibility(layers) {
    const pictures = layers.flatMap(layer => Array.from(layer.children)).map(node => ({
      node,
      placeholder: root.document.createComment(' culled picture '),
      shown: true,
      opacity: Number(root.getComputedStyle(node).opacity),
      effects: node.getAnimations().flatMap(animation => {
        const frames = animation.effect.getKeyframes().filter(frame => frame.opacity !== undefined);
        return frames.length ? [{ effect: animation.effect, first: frames[0], last: frames[frames.length - 1] }] : [];
      }),
    })).filter(picture => picture.effects.length);
    root.Timeline.onBeforeFrame(() => {
      for (const picture of pictures) {
        let opacity = picture.node.style.opacity === '' ? picture.opacity : Number(picture.node.style.opacity);
        for (const { effect, first, last } of picture.effects) {
          // Effect timing resolves in or out of the document; computed styles
          // do not. Only cull known zero endpoints; retain every in-between
          // pose, including overshooting easing curves.
          const { progress } = effect.getComputedTiming();
          if (progress === null) continue;
          if (progress === 0 && first.computedOffset === 0) opacity = Number(first.opacity);
          else if (progress === 1 && last.computedOffset === 1) opacity = Number(last.opacity);
          else opacity = 1;
        }
        const shown = opacity !== 0;
        if (shown === picture.shown) continue;
        picture.shown = shown;
        if (shown) picture.placeholder.replaceWith(picture.node);
        else picture.node.replaceWith(picture.placeholder);
      }
    });
    return pictures;
  }

  /**
   * The stage's top-level pictures that are out of the document at the
   * current pose, each with the comment that keeps its place: for tests and
   * checks that inspect a song's whole artwork.
   */
  function culledPictures(stage) {
    return (cullings.get(stage) || []).filter(picture => !picture.shown)
      .map(({ node, placeholder }) => ({ node, placeholder }));
  }

  /**
   * Build a song once; seek accepts absolute audio seconds, never frame deltas.
   * With `randomAvatar`, the viewer's hero is a new random one at each appearance.
   */
  function build(stage, storyboard, songId, { randomAvatar = false } = {}) {
    const { Timeline, SongKit: kit } = root;
    const choreograph = root.SongChoreographies[songId];
    if (!choreograph) throw new Error(`No choreography for "${songId}".`);
    const themeName = storyboard.theme || 'studio';
    const theme = kit.themes[themeName];
    if (!theme) throw new Error(`No stage theme "${themeName}".`);
    function dispose() {
      Timeline.dispose();
      cullings.delete(stage);
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
      const student = root.SongStudentAvatar ? root.SongStudentAvatar.create(content, stage, {
        laptopLogo: storyboard.student?.laptop_logo, randomAvatar,
      }) : null;
      choreograph({ song: songData(storyboard), kit, layers: { stage, content, hud }, terminal, student });
      root.SongRoundedSurfaces.prepare(stage);
      cullings.set(stage, manageVisibility([content, hud]));
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

  const api = { build, culledPictures, loadFonts, songData };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SongScene = api;
})(typeof window === 'undefined' ? globalThis : window);
