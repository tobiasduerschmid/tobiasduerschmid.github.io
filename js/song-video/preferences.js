/* Browser persistence for the shared song player; unavailable storage is optional. */
(function () {
  'use strict';

  const SPEED_KEY = 'song-player-speed';
  const QUIZ_PAUSE_KEY = 'song-player-quiz-pause';
  const RANDOM_AVATAR_KEY = 'song-player-random-avatar';
  const PLAYLIST_KEY = 'song-player-playlist';
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch (error) { return null; } // Private browsing or malformed data: use defaults.
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false; // The caller keeps the session usable and reports the failed save.
    }
  }

  function normalizeSpeed(value) {
    return speeds.includes(value) ? value : 1;
  }

  window.SongPreferences = {
    SPEED_KEY, PLAYLIST_KEY, QUIZ_PAUSE_KEY, RANDOM_AVATAR_KEY,
    quizPause: () => read(QUIZ_PAUSE_KEY) === true,
    saveQuizPause: (value) => write(QUIZ_PAUSE_KEY, value === true),
    randomAvatar: () => read(RANDOM_AVATAR_KEY) === true,
    saveRandomAvatar: (value) => write(RANDOM_AVATAR_KEY, value === true),
    speed: () => normalizeSpeed(read(SPEED_KEY)),
    saveSpeed: (value) => write(SPEED_KEY, normalizeSpeed(value)),
    playlist: () => read(PLAYLIST_KEY),
    savePlaylist: (ids) => write(PLAYLIST_KEY, { version: 1, songs: ids }),
  };
})();
