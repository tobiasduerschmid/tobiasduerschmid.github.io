/* Fullscreen chrome follows user activity without interrupting playback. */
(function () {
  'use strict';

  function bind({ player, audio, listen }) {
    const screen = player.querySelector('.song-player-screen');
    const controls = player.querySelector('.song-player-controls');
    const idleDelay = 3000;
    const pointersDown = new Set();
    let fullscreen = false;
    let loading = false;
    let buffering = false;
    let hoveringControls = false;
    let keyboardInteraction = false;
    let timer = null;
    let lastPointer = null;

    function clearTimer() {
      clearTimeout(timer);
      timer = null;
    }

    function canHide() {
      const focused = document.activeElement;
      // Safari may omit :focus-visible after the fullscreen focus loop moves
      // focus. A select can also keep its popup open without pointer events.
      const usingControl = controls.contains(focused)
        && (keyboardInteraction || focused.matches(':focus-visible, select'));
      return fullscreen && !audio.paused && !audio.ended && !audio.seeking
        && !loading && !buffering && !hoveringControls && !usingControl && pointersDown.size === 0;
    }

    function hide() {
      clearTimer();
      if (!canHide()) return;
      // Pointer activation may leave focus on a toolbar button. Keep subsequent
      // shortcuts scoped to the player without hiding a focused control.
      if (controls.contains(document.activeElement)) screen.focus({ preventScroll: true });
      clearTimer();
      screen.classList.add('are-controls-hidden');
    }

    function reveal() {
      const wasHidden = screen.classList.contains('are-controls-hidden');
      clearTimer();
      screen.classList.remove('are-controls-hidden');
      if (canHide()) timer = setTimeout(hide, idleDelay);
      return wasHidden;
    }

    listen(screen, 'pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      // Changing the cursor can itself generate a stationary pointer event.
      if (lastPointer?.x === event.clientX && lastPointer?.y === event.clientY) return;
      lastPointer = { x: event.clientX, y: event.clientY };
      reveal();
    });
    listen(controls, 'pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      hoveringControls = true;
      reveal();
    });
    listen(controls, 'pointerleave', (event) => {
      if (event.pointerType === 'touch') return;
      hoveringControls = false;
      reveal();
    });
    listen(screen, 'pointerdown', (event) => {
      keyboardInteraction = false;
      pointersDown.add(event.pointerId);
      reveal();
    });
    for (const type of ['pointerup', 'pointercancel']) listen(document, type, (event) => {
      if (pointersDown.delete(event.pointerId)) reveal();
    });
    listen(screen, 'keydown', () => {
      keyboardInteraction = true;
      reveal();
    });
    listen(screen, 'focusin', reveal);
    listen(screen, 'focusout', reveal);
    listen(controls, 'input', reveal);
    listen(controls, 'change', reveal);
    for (const type of ['play', 'pause', 'ended', 'seeking', 'seeked']) listen(audio, type, reveal);
    for (const type of ['waiting', 'playing', 'canplay', 'emptied']) listen(audio, type, () => {
      buffering = type === 'waiting';
      reveal();
    });
    listen(window, 'pagehide', () => {
      clearTimer();
      pointersDown.clear();
      hoveringControls = false;
      screen.classList.remove('are-controls-hidden');
    });

    return {
      reveal,
      setFullscreen(value) { fullscreen = value; reveal(); },
      setLoading(value) { loading = value; reveal(); },
    };
  }

  window.SongControlsVisibility = { bind };
})();
