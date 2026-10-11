/* Accessible media controls; native audio remains the only playback clock. */
(function () {
  'use strict';

  function timestamp(seconds) {
    const value = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  function bind({ player, audio, listen, onError, onResize }) {
    const play = player.querySelector('.song-player-play');
    const mute = player.querySelector('.song-player-mute');
    const seek = player.querySelector('.song-player-seek');
    const time = player.querySelector('.song-player-time');
    const cc = player.querySelector('.song-player-cc');
    const captions = player.querySelector('.song-player-captions');
    const back = player.querySelector('.song-player-back');
    const forward = player.querySelector('.song-player-forward');
    let loading = false;

    function label(button, text) {
      button.setAttribute('aria-label', text);
    }

    function syncPlayback() {
      const playing = !audio.paused && !audio.ended;
      play.classList.toggle('is-playing', playing);
      label(play, playing ? 'Pause song' : 'Play song');
    }

    function syncPosition() {
      const duration = Number.isFinite(audio.duration) ? audio.duration : Number(seek.max);
      seek.disabled = loading || !Number.isFinite(audio.duration);
      back.disabled = seek.disabled;
      forward.disabled = seek.disabled;
      seek.max = duration;
      seek.value = audio.currentTime;
      seek.setAttribute('aria-valuetext', `${timestamp(audio.currentTime)} of ${timestamp(duration)}`);
      time.textContent = `${timestamp(audio.currentTime)} / ${timestamp(duration)}`;
    }

    function syncVolume() {
      const silent = audio.muted || audio.volume === 0;
      mute.classList.toggle('is-muted', silent);
      label(mute, silent ? 'Unmute song' : 'Mute song');
    }

    listen(play, 'click', async () => {
      if (!audio.paused && !audio.ended) { audio.pause(); return; }
      try {
        if (audio.ended) audio.currentTime = 0;
        await audio.play();
      } catch (error) {
        if (error.name !== 'AbortError') onError('The audio could not start. Use the audio downloads or full transcript below.');
      }
    });
    listen(seek, 'input', () => {
      if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, Number(seek.value));
      syncPosition();
    });
    function skip(seconds) {
      if (!seek.disabled) audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
      syncPosition();
    }
    listen(back, 'click', () => skip(-10));
    listen(forward, 'click', () => skip(10));
    listen(mute, 'click', () => {
      if (audio.muted || audio.volume === 0) {
        audio.muted = false;
        if (audio.volume === 0) audio.volume = 1;
      } else audio.muted = true;
    });
    listen(cc, 'click', () => {
      captions.hidden = !captions.hidden;
      cc.setAttribute('aria-pressed', String(!captions.hidden));
      onResize();
    });

    for (const event of ['play', 'pause', 'ended']) listen(audio, event, syncPlayback);
    for (const event of ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'ended', 'emptied']) listen(audio, event, syncPosition);
    listen(audio, 'volumechange', syncVolume);
    syncPlayback();
    syncPosition();
    syncVolume();
    return {
      setLoading(value) {
        loading = value;
        play.disabled = loading;
        syncPosition();
      },
    };
  }

  window.SongControls = { bind };
})();
