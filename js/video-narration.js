/* Video narrations (docs/video-narration.md). One screen, shared by every
   scene, shows each cue's panels: a structured-text slide, a diagram, code,
   or the animated stage. Slides, diagrams, and code are copied from the
   build-time reading step for the cue; the animated stage is a same-origin
   frame that poses the song-video engine at the narration's time.
   js/narrated-lesson.js holds what every narrated lesson shares, and
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

    return {
      pose(time, description) {
        wanted = time;
        poster.textContent = description;
        if (stage && time !== posed) {
          stage.seek(time);
          posed = time;
        }
      },
    };
  }

  function enhance(root) {
    if (root.classList.contains('is-enhanced')) return;
    const { story, timing, examples, quizzes } = window.NarratedExplainer.readData(root);
    const { renderDiagram, mount } = window.NarratedLesson;
    const topic = root.dataset.vnTopic;
    const screen = root.querySelector('[data-vn-screen]');
    const panels = Object.fromEntries(Array.from(screen.querySelectorAll('[data-vn-panel]'), panel => [panel.dataset.vnPanel, panel]));
    const animation = panels.animation ? animationStage(panels.animation, root.querySelector('audio')) : null;
    const languageSelect = root.querySelector('[data-setting="language"]');
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
      renderDiagram(container, readingStep.querySelector('[data-vn-settled="diagram"] .np-diagram'),
        diagram.type || 'class', cue.diagram_focus, `player-${topic}-${storyScene.id}-${diagramName}`);
      container.setAttribute('aria-label', diagram.label);
      panels.diagram.querySelector('.np-diagram-caption').textContent = diagram.caption || '';
      lastDiagramKey = diagramKey;
    }

    function render(scene, storyScene, cue, progress, motion, position) {
      const shown = cue.show || storyScene.show;
      if (animation && shown.includes('animation')) {
        animation.pose(motion ? position : restingTime(storyScene, cue), cue.visual);
      }
      const language = languageSelect ? languageSelect.value : null;
      if (cue === lastCue && language === lastLanguage) return;
      const cueChanged = cue !== lastCue;
      lastCue = cue;
      lastLanguage = language;
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
      root.querySelector('.nja-step').textContent = cue.step;
      root.querySelector('.nja-note').textContent = cue.note;
      root.querySelector('[data-vn-takeaway]').textContent = storyScene.takeaway;
      root.querySelector('.nja-takeaway').hidden = Boolean(cue.prediction);
    }

    // The shared control bar comes with the transport (js/narration-player-controls.js).
    mount(root, { story, timing, quizzes, examples, render });
  }

  function init() { document.querySelectorAll('section.video-narration').forEach(enhance); }
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
