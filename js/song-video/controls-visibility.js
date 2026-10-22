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
    let keyboardNavigation = false;
    let pointerSelect = null;
    let pointerFocusTarget = null;
    let timer = null;
    let lastPointer = null;

    function clearTimer() {
      clearTimeout(timer);
      timer = null;
    }

    function canHide() {
      const focused = document.activeElement;
      // Range inputs can match :focus-visible after a mouse click, and media
      // shortcuts can give pointer-focused buttons that state too. Only actual
      // keyboard navigation should pin the toolbar for the rest of playback.
      const usingControl = controls.contains(focused) && keyboardNavigation;
      return fullscreen && !audio.paused && !audio.ended && !audio.seeking
        && !loading && !buffering && !hoveringControls && !usingControl && pointersDown.size === 0;
    }

    function hide() {
      clearTimer();
      if (!canHide()) return;
      // Native select pickers need to remain usable until dismissed. Older
      // engines do not expose :open, so keep their picker until a change/blur.
      const selectOpen = CSS.supports('selector(select:open)')
        ? controls.querySelector('select:open') : pointerSelect;
      if (selectOpen) {
        timer = setTimeout(hide, idleDelay);
        return;
      }
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
      // Native pickers consume pointer movement while open. Movement back on
      // the picture also ends an unchanged selection in older engines.
      if (!controls.contains(event.target)) pointerSelect = null;
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
      keyboardNavigation = false;
      pointerFocusTarget = event.target.closest('button, input, select');
      pointerSelect = event.target.closest('select');
      // A native picker can consume pointerup outside this document. Its open
      // state is tracked separately, so it must not leave a drag lock behind.
      if (!pointerSelect) pointersDown.add(event.pointerId);
      reveal();
    });
    for (const type of ['pointerup', 'pointercancel']) listen(document, type, (event) => {
      if (pointersDown.delete(event.pointerId)) reveal();
    });
    listen(document, 'keydown', (event) => {
      // Observe Tab before focus enters the screen as well as within it.
      if (event.key === 'Tab') keyboardNavigation = true;
      const dismissingPointerSelect = event.target === pointerSelect && ['Enter', 'Escape', 'Tab'].includes(event.key);
      if (event.target.matches('select') && !dismissingPointerSelect) keyboardNavigation = true;
      if (dismissingPointerSelect) pointerSelect = null;
      if (screen.contains(event.target)) reveal();
    });
    listen(screen, 'focusin', (event) => {
      // Assistive technology may move focus without a preceding Tab event.
      if (controls.contains(event.target) && event.target !== pointerFocusTarget) keyboardNavigation = true;
      reveal();
    });
    listen(screen, 'focusout', (event) => {
      if (event.target === pointerFocusTarget) pointerFocusTarget = null;
      if (event.target === pointerSelect) pointerSelect = null;
      reveal();
    });
    listen(controls, 'input', reveal);
    listen(controls, 'change', () => { pointerSelect = null; reveal(); });
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
      setFullscreen(value) {
        fullscreen = value;
        // Entering presentation starts a fresh idle period, including through F.
        // Subsequent Tab navigation keeps controls visible until pointer use.
        keyboardNavigation = false;
        reveal();
      },
      setLoading(value) { loading = value; reveal(); },
    };
  }

  window.SongControlsVisibility = { bind };
})();
