/* Interpret picture clicks without tying gesture timing to a song or media API. */
(function () {
  'use strict';

  function bind({ button, screen, listen, toggle, skip, revealControls }) {
    const doubleClickDelay = 300;
    let pending = null;
    let revealedByTouch = false;

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

    listen(button, 'pointerdown', (event) => {
      // Capture this before the event bubbles to the screen's activity handler.
      revealedByTouch = event.pointerType === 'touch' && revealControls();
    });
    listen(button, 'click', (event) => {
      if (event.detail === 0) { cancel(); toggle(); return; } // Native keyboard/assistive activation.
      // A control drawn in the picture (a runner card that picks the code
      // language) may claim the click first: a listener for the cancelable
      // `picture-click` event calls preventDefault, and the click neither
      // toggles playback nor counts toward a double click.
      const claim = new CustomEvent('picture-click', { bubbles: true, cancelable: true, detail: { clientX: event.clientX, clientY: event.clientY } });
      if (!button.dispatchEvent(claim)) { cancel(); revealedByTouch = false; return; }
      const revealOnly = revealedByTouch;
      revealedByTouch = false;
      const side = sideOf(event);
      if (pending && pending.side === side) {
        cancel();
        skip(side);
        return;
      }
      if (pending) { const finish = pending.finish; cancel(); finish(); }
      const finish = () => { if (!revealOnly) toggle(); };
      pending = { side, finish, timer: setTimeout(() => { pending = null; finish(); }, doubleClickDelay) };
    });
    listen(window, 'pagehide', cancel);
    return { cancel };
  }

  window.SongGestures = { bind };
})();
