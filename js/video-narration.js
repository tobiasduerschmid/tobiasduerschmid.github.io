/* Video narrations (docs/video-narration.md). One screen, shared by every
   scene, shows each cue's panels: a structured-text slide, a diagram, code,
   or the animated stage. Slides, diagrams, and code are copied from the
   build-time reading step for the cue; the animated stage is a same-origin
   frame that poses the song-video engine at the narration's time.
   js/narrated-lesson.js holds what every narrated lesson shares. */
(function () {
  'use strict';
  // Every cue ends with silence; a still picture rests this long before the
  // next cue, after everything the cue introduces has appeared.
  const REST_BEFORE_NEXT_CUE = 0.3;

  // Rotate the inner surface, not the native fullscreen element (whose
  // transform the browser resets). This also works without orientation-lock
  // support on iPhone. The viewer can keep device orientation in settings.
  function bindFullscreenLayout(root) {
    const video = root.querySelector('[data-vn-video]');
    const landscape = root.querySelector('.vn-landscape');
    const touch = window.matchMedia('(any-pointer: coarse)');
    let active = false;

    function resize() {
      const viewport = window.visualViewport;
      const width = viewport ? viewport.width : window.innerWidth;
      const height = viewport ? viewport.height : window.innerHeight;
      const rotated = active && landscape.checked && touch.matches && height > width;
      const surfaceWidth = rotated ? height : width;
      const surfaceHeight = rotated ? width : height;
      video.classList.toggle('is-rotated', rotated);
      video.classList.toggle('is-wide', active && surfaceWidth / surfaceHeight >= 1.5);
      video.classList.toggle('is-short', active && surfaceHeight <= 600);
      if (!active) return;
      video.style.setProperty('--vn-surface-width', `${surfaceWidth}px`);
      video.style.setProperty('--vn-surface-height', `${surfaceHeight}px`);
      video.style.setProperty('--vn-viewport-width', `${width}px`);
      video.style.setProperty('--vn-viewport-height', `${height}px`);
      video.style.setProperty('--vn-viewport-left', `${viewport ? viewport.offsetLeft : 0}px`);
      video.style.setProperty('--vn-viewport-top', `${viewport ? viewport.offsetTop : 0}px`);
    }

    root.addEventListener('narration-fullscreenchange', event => {
      active = event.detail.active;
      resize();
      const quiz = root.querySelector('.np-quiz');
      // The quiz replaces the toolbar, so its heading is the return target
      // when the full-screen-only exit button disappears.
      if (!active && !quiz.hidden) quiz.querySelector('h3').focus({ preventScroll: true });
    });
    landscape.addEventListener('change', resize);
    window.addEventListener('resize', resize);
    touch.addEventListener('change', resize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resize);
      window.visualViewport.addEventListener('scroll', resize);
    }
    root.querySelector('.vn-check-exit').addEventListener('click', () => {
      root.querySelector('[data-action="fullscreen"]').click();
    });
  }

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

  /*
   * The controls a video player has beyond the shared transport: five-second
   * skips, volume, captions and their size, settings, the picture's click and
   * double-click, keyboard shortcuts, and controls that hide during playback in
   * full screen. The last three are the song player's own modules
   * (js/song-video/), bound through their class hooks on the video.
   */
  function bindVideoControls(root, player) {
    const audio = root.querySelector('audio');
    const video = root.querySelector('[data-vn-video]');
    const seek = root.querySelector('.nja-seek');
    const picture = root.querySelector('.vn-picture-control');
    const feedback = root.querySelector('.vn-gesture-feedback');
    const cc = root.querySelector('.vn-cc');
    const settingsToggle = root.querySelector('.vn-settings-toggle');
    const settings = root.querySelector('.vn-settings');
    const volume = root.querySelector('.vn-volume');
    const listen = (target, type, handler, options) => target.addEventListener(type, handler, options);
    let feedbackTimer = 0;

    const visibility = window.SongControlsVisibility.bind({ player: root, audio, listen });
    const togglePlayback = () => root.querySelector('[data-action="play"]').click();
    function skip(direction) {
      player.seekTo(Number(seek.value) + 5 * direction);
      clearTimeout(feedbackTimer);
      feedback.textContent = direction < 0 ? '−5 seconds' : '+5 seconds';
      feedback.classList.toggle('is-back', direction < 0);
      feedback.hidden = false;
      feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 700);
    }
    function toggleCaptions() {
      const on = cc.getAttribute('aria-pressed') !== 'true';
      cc.setAttribute('aria-pressed', String(on));
      video.classList.toggle('are-captions-off', !on);
    }
    function toggleFullscreen() {
      const button = root.querySelector('[data-action="fullscreen"]');
      if (button) button.click();
    }
    function syncPicture() {
      picture.setAttribute('aria-label', audio.paused ? 'Play video' : 'Pause video');
    }

    picture.hidden = false;
    window.SongGestures.bind({ button: picture, screen: video, listen, toggle: togglePlayback, skip, revealControls: visibility.reveal });
    window.SongKeyboard.bind({
      player: video, positionControl: seek, listen, toggle: togglePlayback, skip,
      seekToFraction: fraction => player.seekTo(Number(seek.max) * fraction),
      fullscreen: toggleFullscreen, captions: toggleCaptions,
    });
    // Keys typed in a knowledge check belong to the quiz, never to playback.
    listen(root.querySelector('.np-quiz'), 'keydown', event => event.stopPropagation());
    root.querySelectorAll('[data-vn-skip]').forEach(button => listen(button, 'click', () => skip(Math.sign(Number(button.dataset.vnSkip)))));
    listen(cc, 'click', toggleCaptions);
    listen(root.querySelector('.vn-caption-size'), 'change', event => video.style.setProperty('--vn-caption-scale', event.target.value));
    listen(volume, 'input', () => {
      audio.volume = Number(volume.value) / 100;
      if (audio.volume > 0 && audio.muted) root.querySelector('[data-action="mute"]').click();
    });
    listen(settingsToggle, 'click', () => {
      const open = settings.hidden;
      settings.hidden = !open;
      settingsToggle.setAttribute('aria-expanded', String(open));
      visibility.reveal();
    });
    listen(settings, 'keydown', event => {
      if (event.key !== 'Escape') return;
      // Escape closes the settings first; in full screen, a second Escape leaves it.
      event.preventDefault();
      settings.hidden = true;
      settingsToggle.setAttribute('aria-expanded', 'false');
      visibility.focusControl(settingsToggle);
    });
    for (const type of ['play', 'pause', 'ended']) listen(audio, type, syncPicture);
    listen(root, 'narration-fullscreenchange', event => visibility.setFullscreen(event.detail.active));
    // While a knowledge check is open, the control bar steps aside (css/video-narration.css).
    const quiz = root.querySelector('.np-quiz');
    new MutationObserver(() => video.classList.toggle('has-open-check', !quiz.hidden)).observe(quiz, { attributes: true, attributeFilter: ['hidden'] });
    syncPicture();
  }

  function enhance(root) {
    if (root.classList.contains('is-enhanced')) return;
    const { renderDiagram, sectionChecks, linkNavigation } = window.NarratedLesson;
    const topic = root.dataset.vnTopic;
    const story = JSON.parse(root.querySelector('[data-np-storyboard]').textContent);
    const examples = JSON.parse(root.querySelector('[data-np-examples]').textContent);
    const timing = JSON.parse(root.querySelector('[data-np-timing]').textContent);
    const quizzes = JSON.parse(root.querySelector('[data-np-quizzes]').textContent);
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

    const checks = sectionChecks(root, story, quizzes);
    const player = window.NarratedExplainer.enhance(root, {
      storyboard: story, timing, render, onSectionEnd: checks.sectionEnded,
      onSeek: checks.close, canPlay: checks.isClosed, fullscreenTarget: root.querySelector('[data-vn-video]'),
    });
    checks.attach(player);
    bindFullscreenLayout(root);
    bindVideoControls(root, player);
    linkNavigation(root, story, timing, player);
    if (languageSelect) {
      languageSelect.addEventListener('sebook:languagechange', () => {
        player.refresh();
        root.querySelector('.nja-status').textContent = `Code language: ${examples[languageSelect.value].label}. Narration position unchanged.`;
      });
    }
  }

  function init() { document.querySelectorAll('section.video-narration').forEach(enhance); }
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
