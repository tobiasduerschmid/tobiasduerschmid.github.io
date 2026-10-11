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

  const FONT_FACES = [
    '500 20px Inter', '700 20px Inter', '800 20px Inter', '900 20px Inter',
    'italic 900 20px Inter', '500 20px "Fira Code"', '600 20px "Fira Code"',
  ];

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

  /** Read-only access to the storyboard's sections, lines, and word marks. */
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
      /** When a section's visuals take over: just before its first line. */
      sectionStart(id) {
        return Math.max(0, sectionStarts[sectionIndex(id)] - 0.2);
      },
      sectionEnd(id) {
        const next = sectionIndex(id) + 1;
        return next < sectionStarts.length ? sectionStarts[next] - 0.2 : storyboard.duration;
      },
    };
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
      window.VirtualClock.real.requestAnimationFrame(frame);
    };
    document.body.addEventListener('click', () => {
      if (audio.paused) audio.play();
      else audio.pause();
    });
    window.VirtualClock.real.requestAnimationFrame(frame);
    return audio;
  }

  async function boot() {
    const params = new URLSearchParams(window.location.search);
    const songId = params.get('song') || 'snapshots_and_pointers';
    const storyboard = await loadStoryboard(songId);
    await loadScript(`songs/${songId}.js`);
    await Promise.all(FONT_FACES.map((font) => document.fonts.load(font)));
    await document.fonts.ready;

    const { Timeline, SongKit: kit } = window;
    Timeline.beats.configure(storyboard.beats);
    const stage = document.getElementById('stage');
    kit.backdrop(stage);
    const content = kit.el('div', 'layer camera', stage);
    Timeline.camera.attach(content);
    kit.equalizer(stage);
    const hud = kit.el('div', 'layer hud', stage);
    const terminal = kit.terminal(hud);

    const choreograph = window.SongChoreographies[songId];
    if (!choreograph) throw new Error(`songs/${songId}.js did not register a choreography.`);
    choreograph({ song: songData(storyboard), kit, layers: { stage, content, hud }, terminal });
    Timeline.seek(0);

    if (params.has('fit')) fitToViewport(stage);
    if (params.has('play')) playWithSound(storyboard, Timeline.seek);
    else if (params.has('t')) Timeline.seek(Number(params.get('t')));
    return { duration: storyboard.duration, fps: storyboard.fps };
  }

  window.songVideo = { seek: (t) => window.Timeline.seek(t), ready: boot() };
  window.songVideo.ready.catch((error) => console.error(error));
})();
