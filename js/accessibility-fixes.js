// Post-load accessibility patches for content rendered by Jekyll/Rouge,
// MathJax, Bootstrap carousel, etc. These elements are produced by templates
// or libraries we don't fully control, so we adjust them on the client.

(function () {
  'use strict';

  function makeScrollableCodeBlocksFocusable() {
    // Rouge renders <div class="highlight"><pre>...</pre></div> for fenced
    // code. When the pre overflows horizontally, keyboard-only users can't
    // scroll it without tabindex (WCAG 2.1.1, axe rule
    // scrollable-region-focusable). We mark every highlighted pre as
    // focusable; the visible focus ring comes from the global :focus-visible
    // rule. We also add an aria-label so screen readers announce the region.
    const blocks = document.querySelectorAll('.highlight > pre, .highlighter-rouge .highlight pre, pre.highlight');
    blocks.forEach((pre) => {
      if (pre.hasAttribute('tabindex')) return;
      pre.setAttribute('tabindex', '0');
      if (!pre.hasAttribute('role')) pre.setAttribute('role', 'region');
      if (!pre.hasAttribute('aria-label')) {
        const lang = (pre.closest('[class*="language-"]')?.className || '')
          .match(/language-([a-z0-9_-]+)/i);
        pre.setAttribute('aria-label', lang ? `${lang[1]} code` : 'Code');
      }
    });
  }

  function deroleCarouselListboxes() {
    // Bootstrap-style image carousels were authored with role="listbox" on
    // the inner wrapper, but their children are <img tabindex="...">
    // elements, not role="option". A slideshow is not a listbox; remove the
    // role so axe-core's aria-required-children stops failing and screen
    // readers don't promise a select-from-list interaction that doesn't
    // exist.
    document.querySelectorAll('.carousel-inner[role="listbox"]').forEach((el) => {
      el.removeAttribute('role');
    });
  }

  function run() {
    try { makeScrollableCodeBlocksFocusable(); } catch (e) { /* non-fatal */ }
    try { deroleCarouselListboxes(); } catch (e) { /* non-fatal */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
