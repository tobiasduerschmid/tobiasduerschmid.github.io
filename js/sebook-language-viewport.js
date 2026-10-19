/** Keep the reader's place while synchronized language views resize. */
(function (global) {
  'use strict';
  let release = () => {};
  let restore = () => {};

  function visible(element) {
    const box = element.getBoundingClientRect();
    return box.height > 0 && box.bottom > 0 && box.top < global.innerHeight;
  }

  function readingAnchor() {
    const main = document.querySelector('main');
    if (!main) return null;
    const focused = document.activeElement;
    const control = focused.closest('[role="tablist"], [data-language-switcher]') || focused;
    if (main.contains(control) && visible(control)) return control;

    // A preference changed in another tab has no local activating control.
    // Use visible prose outside panels whose contents will be replaced/hidden.
    return [...main.querySelectorAll('h1, h2, h3, h4, p, [role="tablist"]')].find(element =>
      visible(element) && element.getBoundingClientRect().top >= 0
      && !element.closest('[data-language-panel], [data-code-language], [data-transcript-language], [data-uml-preview]'));
  }

  function preservePosition() {
    release();
    const anchor = readingAnchor();
    if (!anchor) return;
    const top = anchor.getBoundingClientRect().top;
    const events = new AbortController();
    const sizes = new ResizeObserver(() => restore());

    release = () => {
      events.abort();
      sizes.disconnect();
      restore = () => {};
      release = () => {};
    };
    restore = () => {
      if (!anchor.isConnected) return release();
      const displacement = anchor.getBoundingClientRect().top - top;
      if (Math.abs(displacement) > 0.5) {
        global.scrollBy({ top: displacement, behavior: 'instant' });
      }
    };

    // Resizing Monaco and replacing generated diagrams can finish after the
    // preference notification. Observe those views before paint, without a
    // timeout that could expire while a worker or editor is still loading.
    sizes.observe(document.body);
    document.querySelectorAll('[data-language-switcher], .observer-animation').forEach(element => sizes.observe(element));

    // Keep the anchor only until the reader next navigates. Never counteract
    // wheel, touch, keyboard, scrollbar, or link navigation with scroll fixes.
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'resize', 'hashchange', 'pagehide']) {
      global.addEventListener(event, () => release(), { capture: true, passive: true, signal: events.signal });
    }
  }

  global.addEventListener('sebook:before-code-language-change', preservePosition);
  global.addEventListener('sebook:code-language-changed', () => restore());
})(window);
