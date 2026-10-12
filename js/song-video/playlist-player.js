/* The playlist's single iframe: accept events only from its current, same-origin song. */
(function () {
  'use strict';

  function bind({ frame, onPlaying, onEnded, onPlayBlocked, onNavigate, signal }) {
    let current = null;
    let ready = false;
    let playWhenReady = false;
    let options = { previous: false, next: false, quizPause: false };
    let focusNavigation = null;

    function send(type, data = {}) {
      frame.contentWindow.postMessage({ type, song: current?.id, ...data }, window.location.origin);
    }
    function configure() {
      if (!ready) return;
      send('song-player:playlist', { ...options, focusNavigation });
      focusNavigation = null;
    }
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
      if (!current || event.data?.song !== current.id) return;
      if (event.data.type === 'song-player:ready') {
        ready = true;
        configure();
        if (playWhenReady) { playWhenReady = false; send('song-player:play'); }
      }
      if (event.data.type === 'song-player:playing') onPlaying(current.id);
      if (event.data.type === 'song-player:ended') onEnded(current.id);
      if (event.data.type === 'song-player:play-blocked') onPlayBlocked();
      for (const direction of ['previous', 'next']) {
        if (event.data.type === `song-player:${direction}` && options[direction]) onNavigate(direction);
      }
    }, { signal });

    return {
      configure(value) { options = { ...options, ...value }; configure(); },
      load(song, { play = false, focus = null } = {}) {
        focusNavigation = focus;
        if (current?.id === song.id) {
          configure();
          if (play && ready) send('song-player:play');
          else playWhenReady = play;
          return;
        }
        current = song;
        ready = false;
        playWhenReady = play;
        frame.title = `${song.title}: interactive music player`;
        frame.src = song.player;
      },
      clear() {
        current = null;
        ready = false;
        playWhenReady = false;
        frame.removeAttribute('src');
      },
    };
  }
  window.SongPlaylistPlayer = { bind };
})();
