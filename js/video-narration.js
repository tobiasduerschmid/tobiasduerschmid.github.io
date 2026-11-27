/* Video narrations (docs/video-narration.md). One screen, shared by every
   scene, shows each cue's panels: a structured-text slide, a diagram, code,
   or the animated stage. Slides, diagrams, and code are copied from the
   build-time reading step for the cue; the animated stage is a same-origin
   frame that poses the song-video engine at the narration's time.
   js/narration-player.js owns the shared lesson lifecycle, and
   js/narration-player-controls.js the control bar of every player. */
(function () {
  'use strict';
  // Every cue ends with silence; a still picture rests this long before the
  // next cue, after everything the cue introduces has appeared.
  const REST_BEFORE_NEXT_CUE = 0.3;

  // The frame loads once the screen comes near the viewport, or when playback
  // starts (a page in a background tab may not report visibility). Until its
  // stage is ready (or if it fails), a poster describes the cue in words.
  function animationStage(panel, audio) {
    const frame = panel.querySelector('iframe');
    const poster = panel.querySelector('[data-vn-poster]');
    const dismissCover = () => panel.classList.remove('has-cover');
    let stage = null;
    let wanted = 0;
    let posed = null;

    frame.addEventListener('load', () => {
      const api = frame.contentWindow && frame.contentWindow.VideoNarrationStage;
      if (!api) return;
      api.ready.then(() => {
        stage = api;
        stage.seek(wanted);
        posed = wanted;
        panel.classList.add('is-ready');
      }, () => { /* The poster keeps describing each cue. */ });
    });
    // The frame loads when the screen comes near the viewport, or at once in a
    // browser without IntersectionObserver.
    const loader = 'IntersectionObserver' in window
      ? new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) load(); }, { rootMargin: '200px' })
      : null;
    function load() {
      if (loader) loader.disconnect();
      if (!frame.getAttribute('src')) frame.src = frame.dataset.src;
    }
    if (loader) loader.observe(panel.closest('[data-vn-screen]'));
    else load();
    audio.addEventListener('play', load, { once: true });
    if (panel.classList.contains('has-cover')) audio.addEventListener('play', dismissCover, { once: true });

    // A point on the page in the frame's own coordinates. Portrait full
    // screen turns the video a quarter clockwise (`rotated`), frame included.
    function framePoint(clientX, clientY, rotated) {
      const box = frame.getBoundingClientRect();
      if (rotated) return [(clientY - box.top) * (frame.clientWidth / box.height), (box.right - clientX) * (frame.clientHeight / box.width)];
      return [(clientX - box.left) * (frame.clientWidth / box.width), (clientY - box.top) * (frame.clientHeight / box.height)];
    }

    return {
      pose(time, description, position) {
        wanted = time;
        poster.textContent = description;
        if (position > 0) dismissCover();
        if (stage && time !== posed) {
          stage.seek(time);
          posed = time;
        }
      },
      /** The picture control (VideoNarrationStage.choiceAt) under a point on the page, or null. */
      choiceAt(clientX, clientY, rotated) {
        return stage && stage.choiceAt ? stage.choiceAt(...framePoint(clientX, clientY, rotated)) : null;
      },
      /** Marks the picture control under a point as pointed at; null clears it. */
      point(clientX, clientY, rotated) {
        if (!stage || !stage.point) return;
        if (clientX === null) stage.point(null, null);
        else stage.point(...framePoint(clientX, clientY, rotated));
      },
    };
  }

  /**
   * Clicks on a control drawn in the picture: a runner card picks its code
   * language. The play button over the picture announces each pointer click
   * (picture-click, js/song-video/gestures.js); a click on a control is taken
   * here and goes through the bar's Code select, so the site's preference,
   * the announcement, and the stage all follow as they do for the select.
   */
  function bindPictureChoices(root, animation, languageSelect) {
    const picture = root.querySelector('.vn-picture-control');
    const video = root.querySelector('[data-vn-video]');
    if (!picture || !languageSelect) return;
    const rotated = () => Boolean(video && video.classList.contains('is-rotated'));
    const languages = Array.from(languageSelect.options, option => option.value);
    picture.addEventListener('picture-click', (event) => {
      const choice = animation.choiceAt(event.detail.clientX, event.detail.clientY, rotated());
      if (!choice || choice.setting !== 'code-language' || !languages.includes(choice.value)) return;
      event.preventDefault();
      if (languageSelect.value === choice.value) return;
      languageSelect.value = choice.value;
      languageSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    picture.addEventListener('pointermove', event => animation.point(event.clientX, event.clientY, rotated()));
    picture.addEventListener('pointerleave', () => animation.point(null, null, false));
  }

  // Stage frames are hidden from assistive technology. The live player puts
  // authored references in its own focus order, above the picture's play layer.
  function articleReferences(root, audio) {
    const callout = root.querySelector('[data-vn-article-reference]');
    if (!callout) return null;
    const caption = root.querySelector('.vn-captions p');
    const pause = () => audio.pause();
    callout.addEventListener('focus', pause);

    return (scene, cue) => {
      const number = scene.cues.indexOf(cue) + 1;
      const beat = scene.essay_beats?.find(beat => beat.signal?.link && number >= beat.from && number <= beat.to);
      const signal = beat?.signal;
      const link = signal?.link;
      callout.hidden = !link || !/^\/(?!\/)/.test(link.href);
      if (callout.hidden) return;
      const href = root.dataset.articleRoot + link.href.slice(1);
      callout.href = href;
      callout.textContent = signal.text;

      if (number !== signal.cue || !link.caption) return;
      const start = cue.text.indexOf(link.caption);
      if (start < 0) return;
      const anchor = document.createElement('a');
      anchor.className = 'vn-caption-reference';
      anchor.href = href;
      anchor.textContent = link.caption;
      anchor.addEventListener('focus', pause);
      caption.replaceChildren(cue.text.slice(0, start), anchor, cue.text.slice(start + link.caption.length));
    };
  }

  function createRenderer(root, { story, timing, examples }) {
    const topic = root.dataset.vnTopic;
    const screen = root.querySelector('[data-vn-screen]');
    const panels = Object.fromEntries(Array.from(screen.querySelectorAll('[data-vn-panel]'), panel => [panel.dataset.vnPanel, panel]));
    const audio = root.querySelector('audio');
    const animation = panels.animation ? animationStage(panels.animation, audio) : null;
    const showReference = articleReferences(root, audio);
    const languageSelect = root.querySelector('[data-setting="language"]');
    if (animation) bindPictureChoices(root, animation, languageSelect);
    const explanation = root.querySelector('.nja-explanation');
    let lastCue = null;
    let lastLanguage = null;
    let lastDiagramKey = null;

    // Without motion, each cue shows one still picture.
    function restingTime(storyScene, cue) {
      const cueTiming = timing.scenes[story.scenes.indexOf(storyScene)].cues[storyScene.cues.indexOf(cue)];
      return cueTiming.end - REST_BEFORE_NEXT_CUE;
    }

    function copySettled(panel, readingStep, name) {
      const settled = readingStep.querySelector(`[data-vn-settled="${name}"]`);
      panel.replaceChildren(...Array.from(settled.childNodes, node => node.cloneNode(true)));
    }

    function showCode(readingStep, language) {
      copySettled(panels.code, readingStep, 'code');
      panels.code.querySelectorAll('[data-transcript-language]').forEach(code => {
        code.hidden = code.dataset.transcriptLanguage !== language;
      });
      const active = panels.code.querySelector('[data-transcript-language]:not([hidden]) pre');
      // The screen limits the code's height, so keyboard users can scroll it.
      active.tabIndex = 0;
      active.setAttribute('aria-label', `${examples[language].label} code`);
      const firstMark = active.querySelector('.is-highlighted');
      active.scrollTop = firstMark ? firstMark.offsetTop - active.offsetTop - 20 : 0;
    }

    function showDiagram(storyScene, cue, readingStep) {
      const diagramName = cue.diagram || storyScene.diagram;
      const diagramKey = `${storyScene.id}:${diagramName}:${cue.diagram_focus}:${cue.diagram_steps}`;
      if (diagramKey === lastDiagramKey) return;
      const diagram = story.diagrams[diagramName];
      const container = panels.diagram.querySelector('[data-np-diagram]');
      window.NarrationDiagram.showReadingStep(container, readingStep.querySelector('[data-vn-settled="diagram"] .np-diagram'),
        { type: diagram.type || 'class', focus: cue.diagram_focus, prefix: `player-${topic}-${storyScene.id}-${diagramName}` });
      container.setAttribute('aria-label', diagram.label);
      panels.diagram.querySelector('.np-diagram-caption').textContent = diagram.caption || '';
      lastDiagramKey = diagramKey;
    }

    function render({ scene: storyScene, cue, motion, time: position }) {
      const shown = cue.show || storyScene.show;
      if (animation && shown.includes('animation')) {
        animation.pose(motion ? position : restingTime(storyScene, cue), cue.visual, position);
      }
      const language = languageSelect ? languageSelect.value : null;
      if (cue === lastCue && language === lastLanguage) return;
      const cueChanged = cue !== lastCue;
      lastCue = cue;
      lastLanguage = language;
      if (cueChanged && showReference) showReference(storyScene, cue);
      const readingStep = root.querySelector(`[data-reading-scene="${storyScene.id}"][data-reading-cue="${storyScene.cues.indexOf(cue)}"]`);
      screen.setAttribute('aria-label', cue.visual);
      screen.dataset.vnCount = String(shown.length);
      Object.entries(panels).forEach(([name, panel]) => {
        panel.hidden = !shown.includes(name);
        // Panels keep their document order; the cue's order places them.
        panel.dataset.vnOrder = String(shown.indexOf(name));
      });
      // Code must stay scrollable and selectable, so its cues leave the picture's click alone.
      screen.classList.toggle('has-code', shown.includes('code'));
      if (shown.includes('slide') && cueChanged) copySettled(panels.slide, readingStep, 'slide');
      if (shown.includes('code')) showCode(readingStep, language);
      if (shown.includes('diagram')) showDiagram(storyScene, cue, readingStep);
      if (!explanation) return;
      explanation.querySelector('.nja-step').textContent = cue.step;
      explanation.querySelector('.nja-note').textContent = cue.note;
      root.querySelector('[data-vn-takeaway]').textContent = storyScene.takeaway;
      root.querySelector('.nja-takeaway').hidden = Boolean(cue.prediction);
    }

    return render;
  }

  window.VideoNarrationVisuals = { createRenderer };
})();
