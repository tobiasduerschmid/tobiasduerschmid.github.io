/* Shared narration transport. Native audio is the only clock; scene renderers own visuals. */
(function () {
  'use strict';
  // Media clocks quantize timestamps; a sub-millisecond roundoff is not a previous cue.
  const TIME_EPSILON = 0.001;
  // A section's audio ends with its last cue's silence, and the next section's
  // speech starts right at the boundary. Checks run once per frame and output is
  // buffered, so stop inside that silence rather than at the boundary itself.
  const SECTION_END_LEAD = 0.3;

  function clockLabel(seconds) {
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function enhance(root, options) {
    if (root.classList.contains('is-enhanced')) return;
    const { storyboard, timing } = options;
    const scenes = Array.from(root.querySelectorAll('[data-scene]'));
    const audio = root.querySelector('audio');
    const seek = root.querySelector('.nja-seek');
    const sceneSelect = root.querySelector('[data-setting="scene"]');
    const motion = root.querySelector('[data-setting="motion"]');
    const narration = root.querySelector('.nja-narration p');
    const status = root.querySelector('.nja-status');
    const playButton = root.querySelector('[data-action="play"]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let position = 0;
    let currentScene = -1;
    let currentCue = -1;
    let pendingSeek = null;
    let wasTranscriptOpen = false;

    if (motion) motion.checked = !reducedMotion.matches;

    function render(time) {
      position = Math.max(0, Math.min(timing.duration, time));
      const index = Math.max(0, timing.scenes.findLastIndex((scene) => position + TIME_EPSILON >= scene.start));
      const sceneTiming = timing.scenes[index];
      const cueIndex = Math.max(0, sceneTiming.cues.findLastIndex((cue) => position + TIME_EPSILON >= cue.start));
      const cueTiming = sceneTiming.cues[cueIndex];
      if (index !== currentScene) {
        scenes.forEach((scene, number) => { scene.hidden = number !== index; });
        sceneSelect.value = String(index);
        root.querySelector('[data-action="previous"]').disabled = index === 0;
        root.querySelector('[data-action="next"]').disabled = index === scenes.length - 1;
      }
      if (index !== currentScene || cueIndex !== currentCue) {
        const cue = storyboard.scenes[index].cues[cueIndex];
        narration.textContent = cue.text;
        scenes[index].querySelector('.nja-art').setAttribute('aria-label', cue.visual);
      }
      currentScene = index;
      currentCue = cueIndex;
      const progress = Math.max(0, Math.min(1, (position - cueTiming.start) / (cueTiming.end - cueTiming.start)));
      options.render(scenes[index], storyboard.scenes[index],
        storyboard.scenes[index].cues[cueIndex], progress, motion ? motion.checked : false);
      seek.value = String(position);
      seek.setAttribute('aria-valuetext', `${clockLabel(position)} of ${clockLabel(timing.duration)}`);
      root.querySelector('.nja-time').textContent = `${clockLabel(position)} / ${clockLabel(timing.duration)}`;
    }

    function updatePlayButton() {
      const paused = audio.paused;
      const label = paused ? 'Play narration' : 'Pause narration';
      playButton.setAttribute('aria-label', label);
      playButton.title = label;
      playButton.setAttribute('data-original-title', label);
      playButton.querySelector('i').className = paused ? 'fa fa-play' : 'fa fa-pause';
    }

    function renderPlayback(time) {
      const boundary = currentScene >= 0 ? timing.scenes[currentScene].end : Infinity;
      if (options.onSectionEnd && time + TIME_EPSILON >= boundary - SECTION_END_LEAD) {
        audio.pause();
        // Keep the completed section on screen while its checkpoint is open.
        audio.currentTime = Math.max(0, boundary - 0.002);
        render(audio.currentTime);
        options.onSectionEnd(currentScene);
        return;
      }
      render(time);
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
      if (!audio.paused) return;
      if (position >= timing.duration - 0.1) seekTo(0);
      try {
        await audio.play();
        status.textContent = '';
      } catch (error) {
        status.textContent = 'Narration could not play. You can still select scenes, read the transcript, or download the audio.';
      }
    }

    const actions = {
      play() {
        if (audio.paused) play();
        else audio.pause();
      },
      restart() { audio.pause(); seekTo(0); status.textContent = 'Returned to the beginning.'; },
      previous() { selectScene(Math.max(0, currentScene - 1)); },
      next() { selectScene(Math.min(scenes.length - 1, currentScene + 1)); },
      mute() {
        audio.muted = !audio.muted;
        const button = root.querySelector('[data-action="mute"]');
        const label = audio.muted ? 'Unmute narration' : 'Mute narration';
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', String(audio.muted));
        button.title = label;
        button.setAttribute('data-original-title', label);
        button.querySelector('i').className = audio.muted ? 'fa fa-volume-off' : 'fa fa-volume-up';
      },
    };

    root.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', actions[button.dataset.action]);
    });
    seek.addEventListener('input', () => seekTo(Number(seek.value)));
    sceneSelect.addEventListener('change', () => selectScene(Number(sceneSelect.value)));
    root.querySelector('[data-setting="speed"]').addEventListener('change', (event) => {
      audio.playbackRate = Number(event.target.value);
    });
    if (motion) motion.addEventListener('change', () => render(position));
    window.addEventListener('resize', () => render(position));
    reducedMotion.addEventListener('change', (event) => {
      if (motion) motion.checked = !event.matches;
      render(position);
    });
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
    window.addEventListener('beforeprint', () => {
      audio.pause();
      const transcript = root.querySelector('.nja-transcript');
      wasTranscriptOpen = transcript.open;
      transcript.open = true;
    });
    window.addEventListener('afterprint', () => {
      root.querySelector('.nja-transcript').open = wasTranscriptOpen;
    });
    root.classList.add('is-enhanced');
    root.querySelectorAll('.nja-controls').forEach((controls) => { controls.hidden = false; });
    render(0);
    return {
      refresh: () => render(position),
      selectScene,
      play,
      currentScene: () => currentScene,
    };
  }

  window.NarratedExplainer = { enhance };

  // Generic lessons supply a renderer by name. Observer supplies its own
  // adapter so section checkpoints stay outside the shared transport.
  document.querySelectorAll('.narrated-explainer[data-art-renderer]').forEach((root) => {
    const artwork = window[root.dataset.artRenderer];
    // Combined chapters load renderer/player pairs in document order.
    if (!artwork) return;
    enhance(root, {
      storyboard: JSON.parse(root.querySelector('[data-explainer-storyboard]').textContent),
      timing: JSON.parse(root.querySelector('[data-explainer-timing]').textContent),
      render(scene, storyScene, cue, progress, motion) {
        artwork.render(scene, storyScene.id, cue, progress, motion);
      },
    });
  });
})();
