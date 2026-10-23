/* Accessible media controls; native audio remains the only playback clock. */
(function () {
  'use strict';

  function timestamp(seconds) {
    const value = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  function bind({ player, audio, listen, onError, onResize, onFullscreen, onPlayBlocked }) {
    const play = player.querySelector('.song-player-play');
    const mute = player.querySelector('.song-player-mute');
    const seek = player.querySelector('.song-player-seek');
    const time = player.querySelector('.song-player-time');
    const cc = player.querySelector('.song-player-cc');
    const captions = player.querySelector('.song-player-captions');
    const back = player.querySelector('.song-player-back');
    const forward = player.querySelector('.song-player-forward');
    const picture = player.querySelector('.song-player-picture-control');
    const speed = player.querySelector('.song-player-speed');
    const feedback = player.querySelector('.song-player-gesture-feedback');
    const visibility = window.SongControlsVisibility.bind({ player, audio, listen });
    window.SongPlayerSettings.bind({
      player, audio, listen, onResize, onActivity: visibility.reveal, focusControl: visibility.focusControl,
    });
    let loading = false;
    let feedbackTimer = null;

    function label(button, text) {
      button.setAttribute('aria-label', text);
    }

    function syncPlayback() {
      const playing = !audio.paused && !audio.ended;
      play.classList.toggle('is-playing', playing);
      label(play, playing ? 'Pause song' : 'Play song');
      label(picture, playing ? 'Pause video' : 'Play video');
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

    async function startPlayback() {
      if (loading) return;
      try {
        if (audio.ended) audio.currentTime = 0;
        await audio.play();
      } catch (error) {
        if (error.name === 'NotAllowedError') {
          onPlayBlocked();
        }
        else if (error.name !== 'AbortError') onError('The audio could not start. Use the audio downloads or full transcript below.');
      }
    }
    function togglePlayback() {
      if (loading) return;
      if (!audio.paused && !audio.ended) audio.pause();
      else void startPlayback();
    }
    function toggleCaptions() {
      captions.hidden = !captions.hidden;
      cc.setAttribute('aria-pressed', String(!captions.hidden));
      onResize();
    }
    listen(play, 'click', togglePlayback);
    function seekTo(seconds) {
      if (seek.disabled) return;
      audio.currentTime = Math.max(0, Math.min(audio.duration, seconds));
      syncPosition();
    }
    listen(seek, 'input', () => seekTo(Number(seek.value)));
    function skip(direction) {
      const seconds = direction * 5;
      if (seek.disabled) return;
      seekTo(audio.currentTime + seconds);
      clearTimeout(feedbackTimer);
      feedback.textContent = `${seconds < 0 ? '−' : '+'}${Math.abs(seconds)} seconds`;
      feedback.classList.toggle('is-back', seconds < 0);
      feedback.hidden = false;
      feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 700);
    }
    const gestures = window.SongGestures.bind({
      button: picture, screen: player.querySelector('.song-player-screen'),
      listen, toggle: togglePlayback, skip, revealControls: visibility.reveal,
    });
    window.SongKeyboard.bind({
      player, positionControl: seek, listen, toggle: togglePlayback, skip,
      seekToFraction: (fraction) => seekTo(audio.duration * fraction),
      fullscreen: onFullscreen, captions: toggleCaptions,
    });
    function applySpeed(value) {
      audio.defaultPlaybackRate = value;
      audio.playbackRate = value;
      speed.value = String(value);
    }
    applySpeed(window.SongPreferences.speed());
    listen(speed, 'change', () => {
      applySpeed(Number(speed.value));
      if (!window.SongPreferences.saveSpeed(audio.playbackRate)) {
        onError('Playback speed changed for this visit. Your browser could not save it.');
      }
    });
    listen(window, 'storage', (event) => {
      if (event.key === window.SongPreferences.SPEED_KEY || event.key === null) applySpeed(window.SongPreferences.speed());
    });
    listen(audio, 'ratechange', () => { speed.value = String(audio.playbackRate); });
    listen(window, 'pagehide', () => clearTimeout(feedbackTimer));
    listen(back, 'click', () => skip(-1));
    listen(forward, 'click', () => skip(1));
    listen(mute, 'click', () => {
      if (audio.muted || audio.volume === 0) {
        audio.muted = false;
        if (audio.volume === 0) audio.volume = 1;
      } else audio.muted = true;
    });
    listen(cc, 'click', toggleCaptions);

    for (const event of ['play', 'pause', 'ended']) listen(audio, event, syncPlayback);
    for (const event of ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'ended', 'emptied']) listen(audio, event, syncPosition);
    listen(audio, 'volumechange', syncVolume);
    syncPlayback();
    syncPosition();
    syncVolume();
    return {
      play: startPlayback,
      setFullscreen: visibility.setFullscreen,
      setLoading(value) {
        loading = value;
        visibility.setLoading(value);
        play.disabled = loading;
        picture.disabled = loading;
        gestures.cancel();
        syncPosition();
      },
    };
  }

  window.SongControls = { bind };
})();
