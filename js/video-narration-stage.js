/* The animated stage of a video narration, inside its same-origin frame
   (_layouts/video-narration-stage.html) or on the printable notes page. It
   presents the narration to the song-video engine as a song: each scene a
   section, each cue a line with word marks. It builds the topic's
   choreography once and poses it at any narration time the page asks for
   (docs/video-narration.md). */
(function () {
  'use strict';
  const STAGE_WIDTH = 960;
  const STAGE_HEIGHT = 540;
  // Keyframe fields that are not CSS properties.
  const KEYFRAME_FIELDS = new Set(['offset', 'computedOffset', 'easing', 'composite']);
  const stage = document.getElementById('stage');
  const story = JSON.parse(document.getElementById('narration-storyboard').textContent);
  const timing = JSON.parse(document.getElementById('narration-timing').textContent);
  const { wordMarks } = window.VideoNarrationMarks;

  function songStoryboard() {
    return {
      duration: timing.duration,
      theme: stage.dataset.theme,
      // Narration has no beat; kit pulses fall back to one a second.
      beats: { bpm: 60, first: 0 },
      sections: story.scenes.map((scene, sceneIndex) => ({
        id: scene.id,
        lines: scene.cues.map((cue, cueIndex) => {
          const cueTiming = timing.scenes[sceneIndex].cues[cueIndex];
          return {
            id: `${scene.id}-${cueIndex + 1}`,
            start: cueTiming.start,
            end: cueTiming.end,
            text: cue.text,
            marks: wordMarks(cue.text, cueTiming.start, cueTiming.speech_end ?? cueTiming.end),
          };
        }),
      })),
    };
  }

  // On the stage page (body.is-fit), the stage fills the frame.
  const fits = document.body.classList.contains('is-fit');
  function fit() {
    const responsive = stage.dataset.theme === 'blog-essay';
    const width = (responsive && stage.offsetWidth) || STAGE_WIDTH;
    const height = (responsive && stage.offsetHeight) || STAGE_HEIGHT;
    const scale = Math.min(window.innerWidth / width, window.innerHeight / height);
    const x = (window.innerWidth - width * scale) / 2;
    const y = (window.innerHeight - height * scale) / 2;
    stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  // The stage follows the site's light or dark mode: it mirrors the dark-mode
  // class of the page that embeds it, and keeps following when it changes.
  // A page with no host it can read (the notes, a sandboxed embed) stays light.
  let host = null;
  try {
    if (window.parent !== window) {
      host = window.parent.document.documentElement;
      if (window.frameElement?.hasAttribute('data-vn-native-links')) {
        document.documentElement.classList.add('has-native-video-links');
      }
    }
  } catch (error) { /* cross-origin host */ }
  function syncTheme() {
    document.documentElement.classList.toggle('dark-mode', Boolean(host && host.classList.contains('dark-mode')));
  }
  syncTheme();
  if (host) new MutationObserver(syncTheme).observe(host, { attributes: true, attributeFilter: ['class'] });

  // A lesson with code in several languages draws each code piece in every
  // language; the stage shows the viewer's (data-code-language). It follows
  // the code-language preference of the page that embeds the frame (or of
  // this page, on the notes), and shows the lesson's default until then.
  function followCodeLanguage() {
    const languages = story.languages;
    if (!Array.isArray(languages) || !languages.length) return;
    const fallback = story.default_language || languages[0];
    stage.dataset.codeLanguage = fallback;
    let preferences = window.SEBookCodePreferences;
    try {
      if (!preferences && window.parent !== window) preferences = window.parent.SEBookCodePreferences;
    } catch (error) { /* cross-origin host */ }
    if (!preferences) return;
    const unsubscribe = preferences.subscribe(() => {
      stage.dataset.codeLanguage = preferences.choose(languages, fallback);
    });
    window.addEventListener('pagehide', unsubscribe, { once: true });
  }
  followCodeLanguage();

  // The picture's own controls: an element marked data-stage-choice (the
  // setting it picks, such as code-language) and data-stage-value (its value)
  // answers a click on the picture. The page that embeds the frame covers
  // the picture with its play button, so it asks for the choice under a
  // point (in this frame's coordinates) and applies it; keyboard users have
  // the same setting in the player's controls. Only a control the picture
  // shows now counts: one still to come is in place but transparent.
  function shown(element) {
    for (let node = element; node && node !== stage.parentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.5) return false;
    }
    return true;
  }
  function controlAt(x, y) {
    return [...stage.querySelectorAll('[data-stage-choice]')].reverse().find((element) => {
      const box = element.getBoundingClientRect();
      return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom && shown(element);
    }) || null;
  }
  function choiceAt(x, y) {
    const control = controlAt(x, y);
    return control ? { setting: control.dataset.stageChoice, value: control.dataset.stageValue } : null;
  }
  /** Marks the control under the pointer (is-pointed); a null point, off the picture, marks none. */
  function point(x, y) {
    const control = x === null ? null : controlAt(x, y);
    stage.querySelectorAll('[data-stage-choice]').forEach(element => element.classList.toggle('is-pointed', element === control));
  }

  let scene = null;
  const ready = window.SongScene.loadFonts().then(() => {
    scene = window.SongScene.build(stage, songStoryboard(), stage.dataset.topic);
    if (fits) fit();
  });
  if (fits) window.addEventListener('resize', fit);

  // Each still's ids get their own suffix, so copies never share an id and
  // their url(#…) references stay inside the copy.
  let stillCount = 0;
  function renameIds(copy) {
    const suffix = `--still-${++stillCount}`;
    const renamed = new Map();
    copy.querySelectorAll('[id]').forEach((element) => {
      renamed.set(element.id, `${element.id}${suffix}`);
      element.id += suffix;
    });
    if (!renamed.size) return;
    copy.querySelectorAll('*').forEach((element) => {
      for (const attribute of [...element.attributes]) {
        const value = attribute.value.replace(/url\(#([^)]+)\)/g, (match, id) => (renamed.has(id) ? `url(#${renamed.get(id)})` : match))
          .replace(/^#(.+)$/, (match, id) => (renamed.has(id) ? `#${renamed.get(id)}` : match));
        if (value !== attribute.value) element.setAttribute(attribute.name, value);
      }
    });
  }

  /**
   * A copy of the stage posed at `time` that keeps the pose without the
   * timeline: every animated value is written into the copy's inline styles.
   * The copy has no id or fit transform; place and scale it with CSS.
   */
  function still(time) {
    scene.seek(time);
    const copy = stage.cloneNode(true);
    const originals = stage.querySelectorAll('*');
    const copies = copy.querySelectorAll('*');
    const copyOf = new Map([[stage, copy]]);
    originals.forEach((original, index) => copyOf.set(original, copies[index]));
    for (const animation of stage.getAnimations({ subtree: true })) {
      const { target, pseudoElement } = animation.effect;
      if (pseudoElement || !copyOf.has(target)) continue;
      const computed = getComputedStyle(target);
      for (const frame of animation.effect.getKeyframes()) {
        for (const name of Object.keys(frame)) {
          if (KEYFRAME_FIELDS.has(name)) continue;
          if (name.startsWith('--')) copyOf.get(target).style.setProperty(name, computed.getPropertyValue(name));
          else copyOf.get(target).style[name] = computed[name];
        }
      }
    }
    copy.removeAttribute('id');
    copy.style.transform = '';
    renameIds(copy);
    return copy;
  }

  window.VideoNarrationStage = {
    ready,
    /** Poses every picture at `time`, in narration seconds. Call after ready. */
    seek: time => scene.seek(time),
    still,
    choiceAt,
    point,
  };
})();
