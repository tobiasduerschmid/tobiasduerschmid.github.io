(function () {
  'use strict';

  function enhance(cover) {
    const poster = cover.querySelector('[data-blog-video-poster]');
    const trigger = cover.querySelector('[data-blog-video-play]');
    const player = cover.querySelector('[data-blog-video-player]');
    const play = player.querySelector('.is-enhanced [data-action="play"]');
    const videoAudio = player.querySelector('audio');
    if (!play || !videoAudio) return;

    const readAloud = cover.closest('article').querySelector('.cap__audio');
    if (readAloud) {
      videoAudio.addEventListener('play', () => {
        if (!videoAudio.paused) readAloud.pause();
      });
      readAloud.addEventListener('play', () => {
        if (!readAloud.paused) videoAudio.pause();
      });
    }

    trigger.addEventListener('click', event => {
      player.hidden = false;
      poster.hidden = true;
      readAloud?.pause();
      // Keep the play action in the same user gesture for mobile browsers.
      play.click();
      play.focus({ preventScroll: event.detail > 0 });
    });
    trigger.hidden = false;
  }

  function init() {
    document.querySelectorAll('[data-blog-video-cover]').forEach(enhance);
  }

  if (document.readyState === 'complete') init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
