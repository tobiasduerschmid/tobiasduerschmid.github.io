/* Session-local player adjustments in the shared settings panel (settings-panel.js). */
(function () {
  'use strict';

  function bind({ player, audio, listen, onResize, onActivity, focusControl }) {
    const volume = player.querySelector('.song-player-volume');
    const subtitleSize = player.querySelector('.song-player-subtitle-size');
    window.SongSettingsPanel.bind({
      player, listen, onActivity, focusControl,
      panel: player.querySelector('.song-player-settings'),
      toggle: player.querySelector('.song-player-settings-toggle'),
      close: player.querySelector('.song-player-settings-close'),
    });

    function syncVolume() {
      volume.value = String(Math.round((audio.muted ? 0 : audio.volume) * 100));
      volume.setAttribute('aria-valuetext', `${volume.value}%`);
    }
    listen(volume, 'input', () => {
      audio.volume = Number(volume.value) / 100;
      audio.muted = audio.volume === 0;
      syncVolume();
    });
    listen(audio, 'volumechange', syncVolume);
    syncVolume();
    listen(subtitleSize, 'change', () => {
      player.style.setProperty('--song-subtitle-scale', subtitleSize.value);
      onResize();
    });
  }

  window.SongPlayerSettings = { bind };
})();
