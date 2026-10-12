/* Focus-scoped media shortcuts. Native inputs retain their own key handling. */
(function () {
  'use strict';

  function bind({ player, listen, toggle, skip, fullscreen }) {
    listen(player, 'keydown', (event) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target.closest('input, select, textarea') || target.isContentEditable) return;
      const key = event.key.toLowerCase();
      // Space always controls playback on player buttons, even after fullscreen
      // returns focus to its button. Enter retains native button activation.
      if (key === ' ' && target.closest('a, summary')) return;
      const actions = { arrowleft: () => skip(-1), arrowright: () => skip(1), f: fullscreen, k: toggle, ' ': toggle };
      const action = actions[key];
      if (!action) return;
      event.preventDefault();
      if (event.repeat && key !== 'arrowleft' && key !== 'arrowright') return;
      action();
    });
  }

  window.SongKeyboard = { bind };
})();
