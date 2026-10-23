/* Session-local player adjustments and a dismissible, non-modal settings panel. */
(function () {
  'use strict';

  function bind({ player, audio, listen, onResize, onActivity, focusControl }) {
    const panel = player.querySelector('.song-player-settings');
    const toggle = player.querySelector('.song-player-settings-toggle');
    const close = player.querySelector('.song-player-settings-close');
    const volume = player.querySelector('.song-player-volume');
    const subtitleSize = player.querySelector('.song-player-subtitle-size');

    function dismiss(restoreFocus = false) {
      if (panel.hidden) return;
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      if (restoreFocus) focusControl(toggle);
      onActivity();
    }

    listen(toggle, 'click', () => {
      if (!panel.hidden) return dismiss(true);
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      focusControl(close);
      onActivity();
    });
    listen(close, 'click', () => dismiss(true));
    listen(document, 'click', (event) => {
      if (!panel.contains(event.target) && !toggle.contains(event.target)) {
        dismiss(panel.contains(document.activeElement));
      }
    });
    listen(document, 'focusin', (event) => {
      if (!panel.contains(event.target) && event.target !== toggle) dismiss();
    });
    // Handle Escape before fullscreen handles it. Native selects retain their
    // own Escape key so dismissing a picker does not also close its panel.
    listen(player, 'keydown', (event) => {
      if (panel.hidden || event.key !== 'Escape') return;
      event.stopPropagation();
      if (event.target.matches('select')) return;
      event.preventDefault();
      dismiss(true);
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
