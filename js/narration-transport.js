/* Media and cue transport for NarrationPlayer. Native audio is the only clock;
   text-only lessons expose the same scene/cue navigation without a clock. */
(function () {
  'use strict';
  if (window.NarrationTransport) return;
  // Media clocks quantize timestamps; a sub-millisecond roundoff is not a previous cue.
  const TIME_EPSILON = 0.001;
  // A section's audio ends with its last cue's silence, and the next section's
  // speech starts right at the boundary. Checks run once per frame and output is
  // buffered, so stop inside that silence rather than at the boundary itself.
  const SECTION_END_LEAD = 0.3;

  // Full screen uses the standard API, Safari's prefixed one, or, where a
  // browser cannot show an element full screen (Safari on iPhone), a mode the
  // player draws itself over the whole viewport (.is-viewport-fullscreen).
  // Either way the player carries .is-fullscreen, which its styles key on.
  const nativeFullscreen = {
    supported: (target) => Boolean((document.fullscreenEnabled && target.requestFullscreen)
      || (document.webkitFullscreenEnabled && target.webkitRequestFullscreen)),
    element: () => document.fullscreenElement || document.webkitFullscreenElement || null,
    request: (target) => (target.requestFullscreen ? target.requestFullscreen() : target.webkitRequestFullscreen()),
    exit: () => (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen()),
  };

  // A toggle names its next action in its accessible name and tooltip (both
  // the native title and the site's tooltip copy); its state class picks the
  // matching shape of its icon (_includes/player-icon.html).
  function labelControl(button, label, state, active) {
    button.setAttribute('aria-label', label);
    button.title = label;
    button.setAttribute('data-original-title', label);
    button.classList.toggle(state, active);
  }

  // A player may place its own hidden button; otherwise one follows the mute button.
  function addFullscreenButton(root) {
    const placed = root.querySelector('[data-action="fullscreen"]');
    if (placed) {
      placed.hidden = false;
      return placed;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'fullscreen';
    button.textContent = 'Full screen';
    root.querySelector('[data-action="mute"]').after(button);
    return button;
  }

  // While a player fills the viewport, the page behind it is inert, so focus
  // and assistive technology stay in the player, as they do in full screen.
  // Returns a function that wakes exactly the elements it made inert.
  function inertOutside(element) {
    const madeInert = [];
    for (let node = element; node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling !== node && !sibling.inert) {
          sibling.inert = true;
          madeInert.push(sibling);
        }
      }
    }
    return () => madeInert.forEach((sibling) => { sibling.inert = false; });
  }

  /** The last index whose item matches, or -1 (Array#findLastIndex, for browsers before 2022). */
  function lastIndexWhere(items, matches) {
    for (let i = items.length - 1; i >= 0; i -= 1) if (matches(items[i])) return i;
    return -1;
  }

  function clockLabel(seconds) {
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  // Shows one cue: its scene panel, the scene select, the narration text, and
  // the art label. show() reports whether the scene changed.
  function cuePresenter(root, storyboard) {
    const scenes = Array.from(root.querySelectorAll('[data-scene]'));
    const sceneSelect = root.querySelector('[data-setting="scene"]');
    const narration = root.querySelector('.nja-narration p');
    let shownScene = -1;
    let shownCue = -1;
    function show(index, cueIndex) {
      const sceneChanged = index !== shownScene;
      if (sceneChanged) {
        scenes.forEach((scene, number) => { scene.hidden = number !== index; });
        sceneSelect.value = String(index);
      }
      if (sceneChanged || cueIndex !== shownCue) {
        const cue = storyboard.scenes[index].cues[cueIndex];
        narration.textContent = cue.text;
        // A scene's own art region names what it shows; a player with one
        // screen shared by every scene labels that screen in its renderer.
        const art = scenes[index].querySelector('.nja-art');
        if (art) art.setAttribute('aria-label', cue.visual);
      }
      shownScene = index;
      shownCue = cueIndex;
      return sceneChanged;
    }
    return { scenes, show };
  }

  // Makes the target fill the screen and keeps the button and the
  // narration-fullscreenchange event in step, however full screen changed.
  function fullscreenControl(root, target) {
    const button = addFullscreenButton(root);
    let viewportFullscreen = false;
    let wakePage = null;
    const isFullscreen = () => viewportFullscreen || nativeFullscreen.element() === target;

    function updateButton(active) {
      labelControl(button, active ? 'Exit full screen' : 'Enter full screen', 'is-active', active);
    }

    // Panels marked data-fullscreen-scroll scroll inside the full-screen frame,
    // so they are tab stops there and the keyboard can scroll them.
    function syncScrollPanels(active) {
      target.querySelectorAll('[data-fullscreen-scroll]').forEach((panel) => {
        if (active) panel.tabIndex = 0;
        else panel.removeAttribute('tabindex');
      });
    }

    function sync() {
      const active = isFullscreen();
      target.classList.toggle('is-fullscreen', active);
      syncScrollPanels(active);
      updateButton(active);
      root.dispatchEvent(new CustomEvent('narration-fullscreenchange', { detail: { active } }));
    }

    function setViewportFullscreen(active) {
      if (active === viewportFullscreen) return;
      viewportFullscreen = active;
      target.classList.toggle('is-viewport-fullscreen', active);
      document.documentElement.classList.toggle('has-viewport-fullscreen', active);
      if (active) wakePage = inertOutside(target);
      else wakePage();
      sync();
    }

    // The whole player, including checkpoints, fills the screen; Escape also exits.
    async function toggle() {
      if (viewportFullscreen) {
        setViewportFullscreen(false);
        return;
      }
      if (nativeFullscreen.element() === target) {
        await nativeFullscreen.exit();
        return;
      }
      if (!nativeFullscreen.supported(target)) {
        setViewportFullscreen(true);
        return;
      }
      try {
        await nativeFullscreen.request(target);
      } catch (error) {
        // A browser that refuses to show the element full screen still gets the whole viewport.
        setViewportFullscreen(true);
      }
    }

    button.addEventListener('click', toggle);
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    // Older Safari reports a refused prefixed request only as an event.
    document.addEventListener('webkitfullscreenerror', (event) => {
      if (event.target === target) setViewportFullscreen(true);
    });
    // Escape leaves the drawn full screen, as it leaves the browser's own.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && viewportFullscreen && !event.defaultPrevented) setViewportFullscreen(false);
    });
    updateButton(false);
    async function exitFullscreen() {
      if (viewportFullscreen) setViewportFullscreen(false);
      else if (nativeFullscreen.element() === target) await nativeFullscreen.exit();
    }

    return { isFullscreen, exitFullscreen, toggleFullscreen: toggle };
  }

  // Full screen fills the player's video frame; markup from an older build
  // without one fills the whole player.
  function fullscreenTargetOf(root, options) {
    return options.fullscreenTarget || root.querySelector('[data-vn-video]') || root.querySelector('.nja-player');
  }

  // Every player shares the song player's control bar, keyboard shortcuts, and
  // full-screen behavior (js/narration-player-controls.js).
  function bindPlayerControls(root, api) {
    if (window.NarrationPlayerControls) window.NarrationPlayerControls.bind(root, api);
  }

  // Printing includes the complete transcript, then restores the reader's choice.
  function printTranscript(root, beforePrint) {
    const transcript = root.querySelector('.nja-transcript');
    let openBeforePrint = [];
    window.addEventListener('beforeprint', () => {
      if (beforePrint) beforePrint();
      openBeforePrint = [transcript, ...transcript.querySelectorAll('details')]
        .map(element => ({ element, open: element.open }));
      openBeforePrint.forEach(({ element }) => { element.open = true; });
    });
    window.addEventListener('afterprint', () => {
      openBeforePrint.forEach(({ element, open }) => { element.open = open; });
    });
  }

  function audioSession(root, options) {
    if (root.classList.contains('is-enhanced')) return;
    const { storyboard, timing } = options;
    const presenter = cuePresenter(root, storyboard);
    const scenes = presenter.scenes;
    const audio = root.querySelector('audio');
    const seek = root.querySelector('.nja-seek');
    const sceneSelect = root.querySelector('[data-setting="scene"]');
    const motion = root.querySelector('[data-setting="motion"]');
    const status = root.querySelector('.nja-status');
    const playButton = root.querySelector('[data-action="play"]');
    const fullscreen = fullscreenControl(root, fullscreenTargetOf(root, options));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let position = 0;
    let currentScene = -1;
    let currentCue = -1;
    let pendingSeek = null;
    const prediction = window.NarrationPrediction && window.NarrationPrediction.create(root, {
      storyboard, onReveal: revealPrediction,
      onToggle(enabled) { if (enabled) renderPlayback(position); },
    });
    const predictionBoundaries = timing.scenes.flatMap((scene, sceneIndex) => scene.cues.flatMap((cue, cueIndex) => (
      storyboard.scenes[sceneIndex].cues[cueIndex].prediction
        ? [{ sceneIndex, cueIndex, end: cue.end, time: Math.max(cue.start, cue.end - SECTION_END_LEAD) }] : []
    )));

    let motionPreference;
    function syncMotion() {
      if (!motion) return;
      motion.checked = motionPreference ?? !reducedMotion.matches;
      if (currentScene >= 0) render(position);
    }
    window.NarrationPreferences.subscribe(preferences => {
      if (motionPreference === preferences.motion) return;
      motionPreference = preferences.motion;
      syncMotion();
    });

    function render(time) {
      position = Math.max(0, Math.min(timing.duration, time));
      const index = Math.max(0, lastIndexWhere(timing.scenes, (scene) => position + TIME_EPSILON >= scene.start));
      const sceneTiming = timing.scenes[index];
      const cueIndex = Math.max(0, lastIndexWhere(sceneTiming.cues, (cue) => position + TIME_EPSILON >= cue.start));
      const cueTiming = sceneTiming.cues[cueIndex];
      if (presenter.show(index, cueIndex)) {
        root.querySelector('[data-action="previous"]').disabled = index === 0;
        root.querySelector('[data-action="next"]').disabled = index === scenes.length - 1;
      }
      currentScene = index;
      currentCue = cueIndex;
      if (prediction) prediction.update({ sceneIndex: index, cueIndex });
      const progress = Math.max(0, Math.min(1, (position - cueTiming.start) / (cueTiming.end - cueTiming.start)));
      // Renderers that pose artwork on the narration clock also get its time.
      options.render({ element: scenes[index], scene: storyboard.scenes[index],
        cue: storyboard.scenes[index].cues[cueIndex], sceneIndex: index, cueIndex,
        progress, motion: motion ? motion.checked : false, time: position });
      seek.value = String(position);
      seek.setAttribute('aria-valuetext', `${clockLabel(position)} of ${clockLabel(timing.duration)}`);
      timeline.update(position);
      root.querySelector('.nja-time').textContent = `${clockLabel(position)} / ${clockLabel(timing.duration)}`;
    }

    function updatePlayButton() {
      labelControl(playButton, audio.paused ? 'Play narration' : 'Pause narration', 'is-playing', !audio.paused);
    }

    function renderPlayback(time) {
      const boundary = currentScene >= 0 ? timing.scenes[currentScene].end : Infinity;
      const checkAt = options.shouldCheck(currentScene) ? boundary - SECTION_END_LEAD : Infinity;
      // Consider crossed cues, too: a delayed animation frame must never show
      // an answer before stopping at the prediction that precedes it.
      const hold = prediction && predictionBoundaries.find(cue => cue.end > position + TIME_EPSILON
        && cue.time <= Math.min(time, checkAt) + TIME_EPSILON && prediction.shouldHold(cue));
      if (hold) {
        const resumePlayback = !audio.paused;
        audio.pause();
        audio.currentTime = hold.time;
        render(hold.time);
        prediction.hold({ ...hold, resumePlayback });
        return true;
      }
      if (options.shouldCheck(currentScene) && time + TIME_EPSILON >= boundary - SECTION_END_LEAD) {
        audio.pause();
        // Keep the completed section on screen while its checkpoint is open.
        audio.currentTime = Math.max(0, boundary - 0.002);
        render(audio.currentTime);
        options.onSectionEnd(currentScene);
        return true;
      }
      render(time);
      return false;
    }

    function tick() {
      renderPlayback(audio.currentTime);
      if (!audio.paused) frame = requestAnimationFrame(tick);
    }

    function stopFrames() {
      cancelAnimationFrame(frame);
      frame = 0;
    }

    function seekTo(time) {
      if (prediction) prediction.reset();
      if (options.onSeek) options.onSeek();
      const next = Math.max(0, Math.min(timing.duration, time));
      render(next);
      if (audio.readyState >= 1) {
        // Metadata may be readable before its queued event applies an older seek.
        pendingSeek = null;
        audio.currentTime = Math.min(next, audio.duration);
      } else {
        pendingSeek = next;
        audio.load();
      }
    }

    function selectScene(index) {
      seekTo(timing.scenes[index].start);
      status.textContent = `${index + 1}. ${storyboard.scenes[index].label}`;
    }

    async function play() {
      if (options.canPlay && !options.canPlay()) return;
      // A player may close a detour (such as a closer look) when playback resumes.
      if (options.onPlay) options.onPlay();
      if (prediction && prediction.isHolding()) { prediction.focusReveal(); return; }
      if (!audio.paused) return;
      if (position >= timing.duration - 0.1) seekTo(0);
      try {
        await audio.play();
        status.textContent = '';
      } catch (error) {
        status.textContent = 'Narration could not play. You can still select scenes, read the transcript, or download the audio.';
      }
    }

    function revealPrediction({ sceneIndex, cueIndex, resumePlayback = false }) {
      const scene = storyboard.scenes[sceneIndex];
      if (cueIndex + 1 < scene.cues.length) {
        seekTo(timing.scenes[sceneIndex].cues[cueIndex + 1].start);
      } else if (options.checkScenes.includes(sceneIndex) || sceneIndex === scenes.length - 1) {
        options.onSectionEnd(sceneIndex, resumePlayback);
        return;
      } else selectScene(sceneIndex + 1);
      const focusTarget = fullscreen.isFullscreen() ? fullscreenTargetOf(root, options) : playButton;
      focusTarget.focus({ preventScroll: true });
      if (resumePlayback) void play();
      else status.textContent = 'Explanation shown. Narration paused.';
    }

    // Sound and saved playback preferences belong to the shared control bar.
    const actions = {
      play() {
        if (audio.paused) play();
        else audio.pause();
      },
      previous() { selectScene(Math.max(0, currentScene - 1)); },
      next() { selectScene(Math.min(scenes.length - 1, currentScene + 1)); },
    };

    // The full-screen button already has its own handler.
    root.querySelectorAll('[data-action]').forEach((button) => {
      const action = actions[button.dataset.action];
      if (action) button.addEventListener('click', action);
    });
    seek.addEventListener('input', () => seekTo(Number(seek.value)));
    sceneSelect.addEventListener('change', () => selectScene(Number(sceneSelect.value)));
    if (motion) motion.addEventListener('change', () => window.NarrationPreferences.set({ motion: motion.checked }));
    // Full screen also resizes the window, so this refits the stage.
    window.addEventListener('resize', () => render(position));
    reducedMotion.addEventListener('change', syncMotion);
    audio.addEventListener('loadedmetadata', () => {
      if (pendingSeek !== null) {
        audio.currentTime = Math.min(pendingSeek, audio.duration);
        render(pendingSeek);
        pendingSeek = null;
      }
    });
    audio.addEventListener('play', updatePlayButton);
    audio.addEventListener('playing', () => {
      updatePlayButton();
      stopFrames();
      if (!document.hidden) frame = requestAnimationFrame(tick);
    });
    audio.addEventListener('pause', () => { stopFrames(); updatePlayButton(); });
    audio.addEventListener('waiting', stopFrames);
    audio.addEventListener('timeupdate', () => {
      if (pendingSeek === null) {
        if (audio.paused) render(audio.currentTime);
        else renderPlayback(audio.currentTime);
      }
    });
    audio.addEventListener('ended', () => {
      stopFrames();
      updatePlayButton();
      if (renderPlayback(timing.duration)) return;
      render(timing.duration);
      status.textContent = 'Narration complete.';
      if (options.onSectionEnd) options.onSectionEnd(scenes.length - 1);
    });
    audio.addEventListener('error', () => {
      stopFrames();
      updatePlayButton();
      status.textContent = 'The audio could not load. The scenes and complete transcript remain available.';
    });
    document.addEventListener('visibilitychange', () => {
      stopFrames();
      if (!document.hidden && !audio.paused) frame = requestAnimationFrame(tick);
    });
    window.addEventListener('pagehide', () => { audio.pause(); stopFrames(); });
    printTranscript(root, () => audio.pause());
    root.classList.add('is-enhanced');
    root.querySelectorAll('.nja-controls').forEach((controls) => { controls.hidden = false; });
    const timeline = window.NarrationTimeline.bind(root, {
      story: storyboard, timing, checkScenes: options.checkScenes,
      looks: options.looks, onLook: options.onLook,
      onCheck(index) {
        audio.pause();
        seekTo(timing.scenes[index].end - 0.002);
        // Explicit review remains available even when segment pauses are off.
        options.onSectionEnd(index, true, { review: true });
      },
    });
    render(0);
    const api = {
      refresh: () => render(position),
      seekTo,
      isFullscreen: fullscreen.isFullscreen, exitFullscreen: fullscreen.exitFullscreen, toggleFullscreen: fullscreen.toggleFullscreen,
      selectScene,
      play,
      currentScene: () => currentScene,
      currentCue: () => currentCue,
      pause: () => audio.pause(),
      dismissPrediction: () => { if (prediction) prediction.dismiss(); },
      holdPrediction() {
        if (!prediction || !prediction.shouldHold({ sceneIndex: currentScene, cueIndex: currentCue })) return false;
        audio.pause();
        return prediction.hold({ sceneIndex: currentScene, cueIndex: currentCue });
      },
      showCue(sceneIndex, cueIndex) {
        audio.pause();
        seekTo(timing.scenes[sceneIndex].cues[cueIndex].start);
        if (prediction) prediction.hold({ sceneIndex, cueIndex });
      },
    };
    bindPlayerControls(root, api);
    return api;
  }

  // A lesson without rendered speech: the reader moves through the same cues,
  // and the player calls showCue instead of following an audio clock. The
  // scene display, scene select, full screen, and printing match audio sessions.
  function stepSession(root, options) {
    if (root.classList.contains('is-enhanced')) return null;
    const { storyboard } = options;
    const presenter = cuePresenter(root, storyboard);
    const sceneSelect = root.querySelector('[data-setting="scene"]');
    const status = root.querySelector('.nja-status');
    const fullscreen = fullscreenControl(root, fullscreenTargetOf(root, options));
    let currentScene = -1;
    let currentCue = -1;
    const prediction = window.NarrationPrediction && window.NarrationPrediction.create(root, {
      storyboard, onReveal: revealPrediction,
      onToggle(enabled) { if (enabled) renderCue(currentScene, currentCue); },
    });

    function renderCue(index, cueIndex) {
      presenter.show(index, cueIndex);
      currentScene = index;
      currentCue = cueIndex;
      if (prediction) prediction.update({ sceneIndex: index, cueIndex });
      const scene = storyboard.scenes[index];
      // Without a clock, each cue shows its settled picture without motion.
      options.render({ element: presenter.scenes[index], scene, cue: scene.cues[cueIndex],
        sceneIndex: index, cueIndex, progress: 1, motion: false });
      if (prediction) prediction.hold({ sceneIndex: index, cueIndex });
    }

    function showCue(index, cueIndex) {
      if (prediction) prediction.reset();
      if (options.onSeek) options.onSeek();
      renderCue(index, cueIndex);
    }

    function revealPrediction({ sceneIndex, cueIndex }) {
      const scene = storyboard.scenes[sceneIndex];
      if (cueIndex + 1 < scene.cues.length) showCue(sceneIndex, cueIndex + 1);
      else { options.onSectionEnd(sceneIndex, false); return; }
      const nextStep = root.querySelector('[data-narration-action="next-step"]');
      if (nextStep) nextStep.focus({ preventScroll: true });
    }

    function selectScene(index) {
      showCue(index, 0);
      status.textContent = `${index + 1}. ${storyboard.scenes[index].label}`;
    }

    sceneSelect.addEventListener('change', () => selectScene(Number(sceneSelect.value)));
    printTranscript(root);
    root.classList.add('is-enhanced');
    root.querySelectorAll('.nja-controls').forEach((controls) => { controls.hidden = false; });
    showCue(0, 0);
    const api = {
      showCue, selectScene,
      refresh: () => renderCue(currentScene, currentCue),
      isFullscreen: fullscreen.isFullscreen, exitFullscreen: fullscreen.exitFullscreen, toggleFullscreen: fullscreen.toggleFullscreen,
      currentScene: () => currentScene, currentCue: () => currentCue,
      pause() {},
      dismissPrediction: () => { if (prediction) prediction.dismiss(); },
      holdPrediction: () => prediction && prediction.hold({ sceneIndex: currentScene, cueIndex: currentCue }),
    };
    bindPlayerControls(root, api);
    return api;
  }

  /** Create one transport. Audio and text-only sessions share cue navigation,
   * fullscreen, controls, and printing; only an audio session exposes play/seekTo. */
  function mount(root, options) {
    return options.storyboard.audio ? audioSession(root, options) : stepSession(root, options);
  }

  window.NarrationTransport = { mount };
})();
