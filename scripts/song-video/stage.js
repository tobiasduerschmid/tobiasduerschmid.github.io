/*
 * Song-video render stage runtime.
 *
 * Loads a song's storyboard (_data/songs/<song>.yml) and its choreography
 * (songs/<song>.js), builds the layers, and exposes a deterministic clock:
 *
 *   window.songVideo.ready    Promise that settles once fonts + scenes are built
 *   window.songVideo.seek(t)  poses every element at song time t (seconds)
 *
 * Choreographies register themselves as SongChoreographies[<song>] = fn and
 * receive { song, kit, layers, terminal } (see songs/snapshots_and_pointers.js).
 *
 * Preview (serve the repo root, e.g. `python3 -m http.server 4591`):
 *   stage.html?song=snapshots_and_pointers&play&fit   plays with the soundtrack
 *   stage.html?song=snapshots_and_pointers&t=61&fit   one still frame
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.body.append(script);
    });
  }

  async function loadStoryboard(songId) {
    const url = `/_data/songs/${songId}.yml`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${url}: HTTP ${response.status}`);
    return window.jsyaml.load(await response.text());
  }

  function fitToViewport(stage) {
    const scale = Math.min(window.innerWidth / stage.offsetWidth, window.innerHeight / stage.offsetHeight);
    stage.style.transform = `scale(${scale})`;
    document.body.classList.add('is-fit');
  }

  /** Real-time preview with sound; uses the real animation frame, not the virtual clock. */
  function playWithSound(storyboard, seek) {
    const audio = new Audio(`/${storyboard.soundtrack}`);
    const frame = () => {
      seek(audio.currentTime);
      window.requestAnimationFrame(frame);
    };
    document.body.addEventListener('click', () => {
      if (audio.paused) audio.play().catch(console.error);
      else audio.pause();
    });
    window.requestAnimationFrame(frame);
    return audio;
  }

  async function boot() {
    const params = new URLSearchParams(window.location.search);
    const songId = params.get('song') || 'snapshots_and_pointers';
    const storyboard = await loadStoryboard(songId);
    await loadScript(`/js/song-video/songs/${songId}.js`);
    await window.SongScene.loadFonts();

    const stage = document.getElementById('stage');
    const scene = window.SongScene.build(stage, storyboard, songId);

    if (params.has('fit')) {
      fitToViewport(stage);
      window.addEventListener('resize', () => fitToViewport(stage));
    }
    if (params.has('play')) playWithSound(storyboard, scene.seek);
    else if (params.has('t')) scene.seek(Number(params.get('t')));
    return { duration: storyboard.duration, fps: storyboard.fps };
  }

  window.songVideo = { seek: (t) => window.Timeline.seek(t), ready: boot() };
  window.songVideo.ready.catch((error) => console.error(error));
})();
