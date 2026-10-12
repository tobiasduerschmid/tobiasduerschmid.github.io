/* Optional track navigation shared by every song; only the playlist enables it. */
(function () {
  'use strict';

  function bind({ player, listen, onNavigate }) {
    const buttons = [...player.querySelectorAll('[data-track-navigation]')];
    for (const button of buttons) {
      listen(button, 'click', () => onNavigate(button.dataset.trackNavigation));
    }
    return {
      update(options) {
        for (const button of buttons) {
          button.hidden = false;
          button.disabled = options[button.dataset.trackNavigation] !== true;
        }
        if (options.focusNavigation) {
          const preferred = buttons.find((button) => button.dataset.trackNavigation === options.focusNavigation && !button.disabled);
          (preferred || buttons.find((button) => !button.disabled) || player.querySelector('.song-player-play')).focus();
        }
      },
    };
  }
  window.SongPlaylistControls = { bind };
})();
