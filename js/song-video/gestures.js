/* Interpret picture clicks without tying gesture timing to a song or media API. */
(function () {
  'use strict';

  function bind({ button, screen, listen, toggle, skip }) {
    const doubleClickDelay = 300;
    let pending = null;

    function cancel() {
      if (pending) clearTimeout(pending.timer);
      pending = null;
    }

    function sideOf(event) {
      const bounds = button.getBoundingClientRect();
      // Portrait full-screen rotates the surface clockwise, including its controls.
      const position = screen.classList.contains('is-rotated')
        ? (event.clientY - bounds.top) / bounds.height
        : (event.clientX - bounds.left) / bounds.width;
      return position < 0.5 ? -1 : 1;
    }

    listen(button, 'click', (event) => {
      if (event.detail === 0) { cancel(); toggle(); return; } // Native keyboard/assistive activation.
      const side = sideOf(event);
      if (pending && pending.side === side) {
        cancel();
        skip(side);
        return;
      }
      if (pending) { cancel(); toggle(); }
      pending = { side, timer: setTimeout(() => { pending = null; toggle(); }, doubleClickDelay) };
    });
    listen(window, 'pagehide', cancel);
    return { cancel };
  }

  window.SongGestures = { bind };
})();
