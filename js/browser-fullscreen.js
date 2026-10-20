/* Whole-page browser fullscreen preserves the page's panes, overlays and controls. */
(function () {
  'use strict';
  const root = document.documentElement;
  const buttons = document.querySelectorAll('[data-browser-fullscreen]');
  if (!buttons.length) return;
  const status = document.getElementById('browser-fullscreen-status');
  let pending = false;
  let exitRequested = false;

  function synchronize() {
    const active = document.fullscreenElement === root;
    buttons.forEach(button => {
      button.setAttribute('aria-pressed', String(active));
      button.querySelector('[data-fullscreen-label]').textContent = active ? 'Exit full screen' : 'Full screen';
      button.querySelector('i').className = active ? 'fa fa-compress' : 'fa fa-expand';
    });
    if (window.dismissAccessibleTooltips) window.dismissAccessibleTooltips();
  }

  async function change(active) {
    if (pending) {
      if (!active) exitRequested = true;
      return false;
    }
    if (active && document.fullscreenElement === root) return true;
    if (!active && document.fullscreenElement !== root) return false;
    pending = true;
    status.textContent = '';
    try {
      if (active) {
        if (!root.requestFullscreen) throw new Error('Fullscreen unavailable');
        await root.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
      return true;
    } catch (error) {
      status.textContent = active
        ? 'The browser could not enter fullscreen. You can continue here or try the Full screen button.'
        : 'The browser could not exit fullscreen. Use the browser’s fullscreen exit control.';
      return false;
    } finally {
      pending = false;
      synchronize();
      if (exitRequested) {
        exitRequested = false;
        await change(false);
      }
    }
  }

  window.BrowserFullscreen = { enter: () => change(true), exit: () => change(false) };
  buttons.forEach(button => button.addEventListener('click', () => change(document.fullscreenElement !== root)));
  document.addEventListener('fullscreenchange', synchronize);
  synchronize();
})();
