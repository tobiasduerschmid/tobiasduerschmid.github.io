/* Media and cue transport for NarrationPlayer. Native audio is the only clock;
   text-only lessons expose the same scene/cue navigation without a clock. */
(function () {
  'use strict';
  if (window.NarrationTransport) return;
  // Media clocks quantize timestamps; a sub-millisecond roundoff is not a previous cue.
  const TIME_EPSILON = 0.001;
  // A section's audio ends with its last cue's silence, and the next section's
  // speech starts right at the boundary. A check (or a prediction's reveal)
  // opens this long before that boundary, after the authored viewing pause.
  const SECTION_END_LEAD = 0.3;
  // Audio a browser has already handed to the output keeps playing after
  // pause(): tens of milliseconds on speakers, a quarter second or more on
  // Bluetooth headphones, seconds over AirPlay, and twice as much media at
  // double speed. Pausing 0.3 s before the boundary let the next section's
  // first syllable through. So every automatic stop pauses the audio right
  // after the last spoken word (speech is trimmed to within 0.08 s of the
  // voice, and MP3 decoding may shift it by 0.05 s), holds the finished picture
  // silently through the rest of the authored pause, and only then opens the
  // check or the prediction.
  const SPEECH_TAIL = 0.35;
  // A rendering's audio and timing differ in length by a few encoder frames; a
  // larger difference means the audio comes from another rendering of the speech.
  const DURATION_TOLERANCE = 0.75;
  const STALE_AUDIO = 'This narration’s audio was updated after the page loaded. Reload the page to keep the audio, pictures, and pauses in step.';

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
    // Reader snapshots also identify their scene; only live panels participate
    // in playback visibility. Transcript steps must stay available for print.
    const scenes = Array.from(root.querySelectorAll('.nja-scene[data-scene]'));
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
        const art = scenes[index]?.querySelector('.nja-art');
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
      if (!transcript) return;
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
    let stopTimer = 0;
    // A stop in the silence after the last word: { at, timer, open } until what follows opens.
    let silentHold = null;
    // Set once the audio turns out to come from another rendering; the warning outlives starting playback.
    let staleAudio = false;
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
        ? [{ sceneIndex, cueIndex, end: cue.end, ...stopWindow(cue) }] : []
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
        root.querySelector('[data-action="next"]').disabled = index === storyboard.scenes.length - 1;
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

    // Stops in the silence right after a checked section's last word, holds
    // its finished picture through the rest of the viewing pause, then opens
    // its check.
    function stopAtCheck(index) {
      disarmStop();
      holdSilently(stopWindow(timing.scenes[index].cues.at(-1)).open, () => openCheck(index));
    }

    function openCheck(index) {
      audio.pause();
      // Keep the completed section on screen while its checkpoint is open.
      audio.currentTime = Math.max(0, timing.scenes[index].end - 0.002);
      render(audio.currentTime);
      options.onSectionEnd(index);
    }

    // Pauses where the audio is now, a moment after the last word, and calls
    // `open` once the clock would have reached `openAt`: the rest of the
    // authored pause passes in silence, with the finished picture on screen.
    function holdSilently(openAt, open) {
      cancelSilentHold();
      audio.pause();
      render(audio.currentTime);
      const wait = Math.max(0, openAt - audio.currentTime) / (audio.playbackRate || 1);
      silentHold = { at: audio.currentTime, open, timer: setTimeout(finishSilentHold, wait * 1000) };
    }

    function finishSilentHold() {
      const hold = silentHold;
      cancelSilentHold();
      if (hold) hold.open();
    }

    function cancelSilentHold() {
      if (!silentHold) return;
      clearTimeout(silentHold.timer);
      silentHold = null;
    }

    function renderPlayback(time) {
      const checked = currentScene >= 0 && options.shouldCheck(currentScene);
      const checkAt = checked ? stopWindow(timing.scenes[currentScene].cues.at(-1)).stop : Infinity;
      // Consider crossed cues, too: a delayed animation frame must never show
      // an answer before stopping at the prediction that precedes it.
      const hold = prediction && predictionBoundaries.find(cue => cue.end > position + TIME_EPSILON
        && cue.stop <= Math.min(time, checkAt) + TIME_EPSILON && prediction.shouldHold(cue));
      if (hold) {
        const resumePlayback = !audio.paused;
        audio.pause();
        // A late frame may have crossed into the answer; return to the prediction's silence.
        if (audio.currentTime > hold.open) audio.currentTime = hold.open;
        holdSilently(hold.open, () => {
          audio.pause();
          render(audio.currentTime);
          prediction.hold({ ...hold, time: audio.currentTime, resumePlayback });
        });
        return true;
      }
      if (checked && time + TIME_EPSILON >= checkAt) {
        stopAtCheck(currentScene);
        return true;
      }
      render(time);
      armStop();
      return false;
    }

    // Where an automatic stop pauses the audio (just after the cue's last
    // word) and when it opens what follows (SECTION_END_LEAD before its end).
    function stopWindow(cue) {
      const open = Math.max(cue.start, cue.end - SECTION_END_LEAD);
      const stop = Number.isFinite(cue.speech_end) ? Math.max(cue.start, Math.min(open, cue.speech_end + SPEECH_TAIL)) : open;
      return { stop, open };
    }

    // The first check the learner will stop at whose section has not ended
    // by `time`: playback that starts inside a check's silence stops at once.
    function nextStop(time) {
      return options.checkScenes
        .filter(index => options.shouldCheck(index))
        .map(index => ({ index, at: stopWindow(timing.scenes[index].cues.at(-1)).stop, end: timing.scenes[index].end }))
        .filter(stop => stop.end > time + TIME_EPSILON)
        .sort((a, b) => a.at - b.at)[0] || null;
    }

    // Frames stop in a hidden tab, and timeupdate fires only a few times a
    // second, too coarse at higher speeds to stop before the next section. So
    // from the moment playback starts, a timer is due at the next check's stop
    // point; it is armed again until playback reaches that point. When it is
    // due, a prediction the playback crossed still holds first.
    function armStop() {
      if (stopTimer || audio.paused || pendingSeek !== null) return;
      const stop = nextStop(audio.currentTime);
      if (!stop) return;
      const wait = Math.max(0, (stop.at - audio.currentTime) / (audio.playbackRate || 1));
      stopTimer = setTimeout(() => {
        stopTimer = 0;
        if (audio.paused || pendingSeek !== null) return;
        if (audio.currentTime + TIME_EPSILON < stop.at) armStop();
        else if (!renderPlayback(audio.currentTime) && options.shouldCheck(stop.index)) stopAtCheck(stop.index);
      }, wait * 1000);
    }

    function disarmStop() {
      clearTimeout(stopTimer);
      stopTimer = 0;
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
      // Play during a silent hold skips the rest of the pause to the check or the prediction.
      if (silentHold) { finishSilentHold(); return; }
      if (options.canPlay && !options.canPlay()) return;
      // A player may close a detour (such as a closer look) when playback resumes.
      if (options.onPlay) options.onPlay();
      if (prediction && prediction.isHolding()) { prediction.focusReveal(); return; }
      if (!audio.paused) return;
      if (position >= timing.duration - 0.1) seekTo(0);
      try {
        await audio.play();
        status.textContent = staleAudio ? STALE_AUDIO : '';
      } catch (error) {
        status.textContent = 'Narration could not play. You can still select scenes, read the transcript, or download the audio.';
      }
    }

    function revealPrediction({ sceneIndex, cueIndex, resumePlayback = false }) {
      const scene = storyboard.scenes[sceneIndex];
      if (cueIndex + 1 < scene.cues.length) {
        seekTo(timing.scenes[sceneIndex].cues[cueIndex + 1].start);
      } else if (options.checkScenes.includes(sceneIndex) || sceneIndex === storyboard.scenes.length - 1) {
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
      next() { selectScene(Math.min(storyboard.scenes.length - 1, currentScene + 1)); },
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
      // Audio from another rendering would play out of step with the pictures and stop mid-sentence at checks.
      if (Number.isFinite(audio.duration) && Math.abs(audio.duration - timing.duration) > DURATION_TOLERANCE) {
        staleAudio = true;
        status.textContent = STALE_AUDIO;
      }
    });
    audio.addEventListener('play', updatePlayButton);
    audio.addEventListener('playing', () => {
      updatePlayButton();
      stopFrames();
      if (!document.hidden) frame = requestAnimationFrame(tick);
      armStop();
    });
    audio.addEventListener('pause', () => { stopFrames(); disarmStop(); updatePlayButton(); });
    // A new position or speed moves the stop.
    audio.addEventListener('seeking', () => {
      disarmStop();
      // A seek away from a silent hold cancels it; the hold's own position does not.
      if (silentHold && Math.abs(audio.currentTime - silentHold.at) > 0.01) cancelSilentHold();
    });
    audio.addEventListener('seeked', armStop);
    audio.addEventListener('ratechange', () => { disarmStop(); armStop(); });
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
      if (options.onSectionEnd) options.onSectionEnd(storyboard.scenes.length - 1);
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
