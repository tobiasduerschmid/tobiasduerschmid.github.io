/* The animated stage of a video narration, inside its same-origin frame
   (_layouts/video-narration-stage.html). It presents the narration to the
   song-video engine as a song: each scene a section, each cue a line with
   word marks. It builds the topic's choreography once and poses it at any
   narration time the parent player asks for (docs/video-narration.md). */
(function () {
  'use strict';
  const STAGE_WIDTH = 960;
  const STAGE_HEIGHT = 540;
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

  function fit() {
    const scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
    const x = (window.innerWidth - STAGE_WIDTH * scale) / 2;
    const y = (window.innerHeight - STAGE_HEIGHT * scale) / 2;
    stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  // The stage follows the site's light or dark mode: it mirrors the dark-mode
  // class of the page that embeds it, and keeps following when it changes.
  // A host page the frame cannot read (a sandboxed embed) leaves the stage in light mode.
  let host = null;
  try {
    if (window.parent !== window) host = window.parent.document.documentElement;
  } catch (error) { /* cross-origin host */ }
  function syncTheme() {
    document.documentElement.classList.toggle('dark-mode', Boolean(host && host.classList.contains('dark-mode')));
  }
  syncTheme();
  if (host) new MutationObserver(syncTheme).observe(host, { attributes: true, attributeFilter: ['class'] });

  let scene = null;
  const ready = window.SongScene.loadFonts().then(() => {
    scene = window.SongScene.build(stage, songStoryboard(), stage.dataset.topic);
    fit();
  });
  window.addEventListener('resize', fit);

  window.VideoNarrationStage = {
    ready,
    /** Poses every picture at `time`, in narration seconds. Call after ready. */
    seek: time => scene.seek(time),
  };
})();
