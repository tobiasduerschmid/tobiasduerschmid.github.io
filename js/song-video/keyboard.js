/* Focus-scoped media shortcuts, including consistent seeking on the timeline. */
(function () {
  'use strict';

  function bind({ player, positionControl, listen, toggle, skip, seekToFraction, fullscreen, captions }) {
    listen(player, 'keydown', (event) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      const key = event.key.toLowerCase();
      const digit = /^[0-9]$/.test(key);
      const seekKey = digit || key === 'arrowleft' || key === 'arrowright';
      // Timeline seeking uses the media clock, not the range input's rounded
      // value or native 0.1-second step. Other inputs keep their native keys.
      if (target.isContentEditable) return;
      if (target.closest('input, select, textarea') && !(target === positionControl && seekKey)) return;
      // Space always controls playback on player buttons, even after fullscreen
      // returns focus to its button. Enter retains native button activation.
      if (key === ' ' && target.closest('a, summary')) return;
      const actions = { arrowleft: () => skip(-1), arrowright: () => skip(1), f: fullscreen, c: captions, k: toggle, ' ': toggle };
      const action = digit ? () => seekToFraction(Number(key) / 10) : actions[key];
      if (!action) return;
      event.preventDefault();
      if (event.repeat && key !== 'arrowleft' && key !== 'arrowright') return;
      action();
    });
  }

  window.SongKeyboard = { bind };
})();
