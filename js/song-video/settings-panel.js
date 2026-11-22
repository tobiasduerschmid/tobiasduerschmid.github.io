/* The dismissible, non-modal settings panel of the song player and every
   narration player. Its toggle opens it and moves focus to its close button;
   the close button, Escape, or a click or focus outside the panel dismisses
   it. Only a dismissal from inside the panel returns focus to the toggle. */
(function () {
  'use strict';

  /**
   * `player` receives the Escape key while the panel is open; `onActivity`
   * runs on every open and close (the player reveals auto-hidden controls);
   * `focusControl` moves focus to a control, revealing hidden controls first.
   */
  function bind({ player, panel, toggle, close, listen, onActivity = () => {}, focusControl = (control) => control.focus() }) {
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
    return { dismiss };
  }

  window.SongSettingsPanel = { bind };
})();
