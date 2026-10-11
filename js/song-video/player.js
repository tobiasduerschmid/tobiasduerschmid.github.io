/* Native media time drives the scene. This page owns no chapter-global timers. */
(function () {
  'use strict';

  /** Leave main-thread headroom by skipping pictures, never by slowing audio. */
  class FrameBudget {
    constructor() {
      this.cost = 0;
      this.interval = 1000 / 60;
    }

    record(milliseconds) {
      this.cost = this.cost * 0.8 + milliseconds * 0.2;
      const minimum = this.cost * 1.5;
      this.interval = [60, 30, 20, 15, 10]
        .map((rate) => 1000 / rate)
        .find((interval) => interval >= minimum) ?? minimum;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FrameBudget };
    return;
  }

  const player = document.querySelector('.song-player');
  const audio = player.querySelector('audio');
  const fallback = player.querySelector('.song-player-fallback');
  const status = player.querySelector('.song-player-status');
  const lyricsOnly = player.querySelector('#lyrics-only');
  const viewport = player.querySelector('.song-player-viewport');
  const stage = player.querySelector('#stage');
  const lyricText = player.querySelector('#song-lyrics');
  const visualText = player.querySelector('#song-description');
  const captions = audio.querySelector('track');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const budget = new FrameBudget();
  let scene = null;
  let frameId = null;
  let lastFrameAt = -Infinity;
  let motionWasChosen = false;
  let lines = [];
  let lastHeight = 0;
  let sceneFailed = false;
  let tracks = null;
  let trackLoading = false;
  let fullscreen = null;

  function listen(target, type, handler) {
    target.addEventListener(type, handler, { signal: events.signal });
  }

  function stopDrawing() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
  }

  function showFallback(message) {
    status.textContent = message;
    fallback.open = true;
    if (fullscreen?.isActive()) void fullscreen.exit();
    reportHeight();
  }

  function failScene() {
    stopDrawing();
    sceneFailed = true;
    if (scene) scene.dispose();
    scene = null;
    viewport.hidden = true;
    player.querySelector('.song-player-description').hidden = false;
    player.querySelector('.song-player-screen').classList.add('is-lyrics-only');
    showFallback('The animation could not load. You can still listen with lyrics and audio description.');
  }

  function updateText() {
    if (trackLoading) {
      lyricText.textContent = 'Loading the selected audio track…';
      return;
    }
    const activeCues = captions.track.activeCues;
    if (audio.ended) {
      lyricText.textContent = 'End of song.';
    } else if (activeCues && activeCues.length) {
      lyricText.textContent = Array.from(activeCues, (cue) => cue.text).join('\n');
    } else {
      lyricText.textContent = audio.currentTime === 0 && audio.paused
        ? 'Press play to follow the lyrics.' : '[music]';
    }
    const line = lines.findLast((item) => item.start <= tracks.position().sceneTime);
    visualText.textContent = line ? `On screen: ${line.visual}`
      : 'Visual descriptions appear here during the song.';
  }

  function poseScene() {
    if (!scene || lyricsOnly.checked || document.hidden || trackLoading) return;
    try {
      const started = performance.now();
      // Never accumulate a simulated delta or replay missed frames.
      scene.seek(tracks.position().sceneTime);
      budget.record(performance.now() - started);
    } catch (error) {
      failScene();
    }
  }

  function canDraw() {
    return scene && !trackLoading && !lyricsOnly.checked && !audio.paused && !audio.ended && !document.hidden && audio.readyState >= 3;
  }

  function drawFrame(now) {
    frameId = null;
    if (!canDraw()) return;
    if (now - lastFrameAt >= budget.interval) {
      lastFrameAt = now;
      poseScene();
    }
    if (canDraw()) frameId = requestAnimationFrame(drawFrame);
  }

  function resumeDrawing() {
    stopDrawing();
    poseScene();
    lastFrameAt = performance.now();
    if (canDraw()) frameId = requestAnimationFrame(drawFrame);
  }

  function fitScene() {
    if (!viewport.hidden) {
      const scale = Math.min(viewport.clientWidth / 960, viewport.clientHeight / 540);
      const x = (viewport.clientWidth - 960 * scale) / 2;
      const y = (viewport.clientHeight - 540 * scale) / 2;
      stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }
    reportHeight();
  }

  function reportHeight() {
    if (window.parent === window || document.fullscreenElement || fullscreen?.isActive()) return;
    const height = Math.ceil(player.getBoundingClientRect().height);
    if (height === lastHeight) return;
    lastHeight = height;
    window.parent.postMessage({ type: 'song-player:resize', height }, window.location.origin);
  }

  function receiveParentMessage(event) {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    if (event.data?.type === 'song-player:pause') {
      tracks.pause();
      return;
    }
    if (event.data?.type !== 'song-player:theme') return;
    player.querySelector('.song-player-transcript-link').hidden = event.data.hasTranscript === true;
    document.documentElement.classList.toggle('dark-mode', event.data.dark === true);
    if (Number.isFinite(event.data.fontSize) && event.data.fontSize >= 16) {
      document.documentElement.style.fontSize = `${event.data.fontSize}px`;
    }
    fitScene();
  }

  function notifyPlayback() {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'song-player:playing' }, window.location.origin);
    }
  }

  function updateMotion() {
    viewport.hidden = lyricsOnly.checked || !scene;
    player.querySelector('.song-player-description').hidden = !viewport.hidden;
    player.querySelector('.song-player-screen').classList.toggle('is-lyrics-only', viewport.hidden);
    fitScene();
    resumeDrawing();
  }

  function failAudio() {
    audio.pause();
    stopDrawing();
    showFallback('The audio could not load. Try the other audio track, the audio downloads, or the full transcript.');
  }

  function bindMedia() {
    const controls = window.SongControls.bind({ player, audio, listen, onError: showFallback, onResize: fitScene });
    tracks = window.SongTracks.bind({
      player, audio, listen, signal: events.signal, onError: showFallback,
      onChange: () => { updateText(); resumeDrawing(); },
      onLoading: (loading) => {
        trackLoading = loading;
        controls.setLoading(loading);
        if (loading) status.textContent = 'Loading the selected audio track…';
        else if (status.textContent === 'Loading the selected audio track…') status.textContent = '';
        if (loading) stopDrawing();
      },
    });
    listen(audio, 'play', notifyPlayback);
    listen(audio, 'playing', resumeDrawing);
    listen(audio, 'canplay', resumeDrawing);
    listen(audio, 'waiting', stopDrawing);
    listen(audio, 'pause', stopDrawing);
    listen(audio, 'ended', () => { stopDrawing(); updateText(); });
    listen(audio, 'seeking', () => { stopDrawing(); updateText(); poseScene(); });
    listen(audio, 'seeked', () => { updateText(); resumeDrawing(); });
    listen(audio, 'timeupdate', updateText);
    listen(audio, 'error', failAudio);
    // With a nested <source>, an unavailable file reports its failure on the
    // source rather than the media element, and play() may remain pending.
    listen(audio.querySelector('source'), 'error', failAudio);
    listen(captions.track, 'cuechange', updateText);
    listen(captions, 'load', updateText);
    listen(captions, 'error', () => {
      tracks.pause();
      showFallback('The synchronized lyrics could not load. Use the full transcript below.');
    });
    captions.track.mode = 'hidden';
  }

  function bindPresentation() {
    // An unavailable optional enhancement must not hide the entire player.
    fullscreen = window.SongFullscreen?.bind({ player, listen, onResize: fitScene, onError: showFallback }) ?? null;
    lyricsOnly.checked = reducedMotion.matches;
    player.querySelector('.song-player-screen').hidden = false;
    player.querySelector('.song-player-options').hidden = false;
    listen(lyricsOnly, 'change', () => { motionWasChosen = true; updateMotion(); });
    listen(reducedMotion, 'change', () => {
      if (!motionWasChosen) { lyricsOnly.checked = reducedMotion.matches; updateMotion(); }
    });
    listen(document, 'visibilitychange', () => {
      if (document.hidden) stopDrawing();
      else { updateText(); resumeDrawing(); }
    });
    listen(window, 'message', receiveParentMessage);
    listen(window, 'resize', fitScene);
    listen(fallback, 'toggle', reportHeight);
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'song-player:ready' }, window.location.origin);
    }
  }

  async function initializeScene() {
    try {
      const storyboard = JSON.parse(document.getElementById('song-data').textContent);
      lines = storyboard.sections.flatMap((section) => section.lines);
      if (!window.SongScene || !Element.prototype.animate) throw new Error('Animation is unavailable.');
      await window.SongScene.loadFonts();
      if (events.signal.aborted) return;
      scene = window.SongScene.build(stage, storyboard, player.dataset.song);
      updateMotion();
      updateText();
    } catch (error) {
      failScene();
    }
  }

  bindMedia();
  bindPresentation();
  const resizeObserver = new ResizeObserver(fitScene);
  resizeObserver.observe(player);
  listen(window, 'pagehide', (event) => {
    stopDrawing();
    if (event.persisted) return;
    events.abort();
    resizeObserver.disconnect();
    if (scene && !sceneFailed) scene.dispose();
  });
  listen(window, 'pageshow', resumeDrawing);
  initializeScene();
})();
