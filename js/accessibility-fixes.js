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
    // rule.
    //
    // We deliberately do NOT add aria-label / role="region": the visible
    // content of a <pre> IS the announced text, and an aria-label like
    // "java code" would (1) mismatch the visible text (WCAG 2.5.3 Label in
    // Name) and (2) hide the actual code from screen-reader announcement.
    //
    // We also skip blocks that live inside an aria-hidden ancestor — those
    // are intentionally hidden from AT (e.g. tab-panel back-faces, alternate
    // language tabs) and a focusable element inside aria-hidden is itself a
    // WCAG 4.1.2 violation.
    const blocks = document.querySelectorAll('.highlight > pre, .highlighter-rouge .highlight pre, pre.highlight');
    blocks.forEach((pre) => {
      if (pre.hasAttribute('tabindex')) return;
      if (pre.closest('[aria-hidden="true"]')) return;
      pre.setAttribute('tabindex', '0');
    });

    // Scrollable tutorial step content (rendered by the tutorial JS) and
    // the editor tab row both produce horizontal-overflow regions that axe
    // flags as `scrollable-region-focusable`. Same fix.
    const otherScrollable = document.querySelectorAll(
      '.tvm-step-content-wrap, .tvm-editor-tabs',
    );
    otherScrollable.forEach((el) => {
      if (el.hasAttribute('tabindex')) return;
      if (el.closest('[aria-hidden="true"]')) return;
      el.setAttribute('tabindex', '0');
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

  function enhanceTables() {
    document.querySelectorAll('table').forEach((table, index) => {
      table.querySelectorAll('thead th').forEach((th) => {
        if (!th.hasAttribute('scope')) th.setAttribute('scope', 'col');
      });
      table.querySelectorAll('tbody tr > th').forEach((th) => {
        if (!th.hasAttribute('scope')) th.setAttribute('scope', 'row');
      });

      if (table.querySelector(':scope > caption')) return;

      let label = '';
      const previous = table.previousElementSibling;
      if (previous && /^H[1-6]$/i.test(previous.tagName)) {
        label = previous.textContent.trim();
      }
      if (!label) {
        const sectionHeading = table.closest('section, article, main')?.querySelector('h1, h2, h3, h4, h5, h6');
        if (sectionHeading) label = sectionHeading.textContent.trim();
      }

      const caption = document.createElement('caption');
      caption.className = 'sr-only';
      caption.textContent = label ? label + ' table' : 'Data table ' + (index + 1);
      table.insertBefore(caption, table.firstChild);
    });
  }

  function run() {
    try { makeScrollableCodeBlocksFocusable(); } catch (e) { /* non-fatal */ }
    try { deroleCarouselListboxes(); } catch (e) { /* non-fatal */ }
    try { enhanceTables(); } catch (e) { /* non-fatal */ }
  }

  // Tutorial step content (.tvm-step-content-wrap), editor tab rows, and
  // Rouge code blocks inside dynamically-rendered content are inserted
  // AFTER DOMContentLoaded by the tutorial JS. Re-run the patch a few times
  // post-load to catch them — but don't keep a long-lived MutationObserver
  // wired to document.body, since the tutorial's init burst fires hundreds
  // of mutations and the constant querySelectorAll(...) sweep adds up.
  function scheduleLatePasses() {
    [200, 800, 2500, 6000].forEach((ms) => setTimeout(run, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { run(); scheduleLatePasses(); }, { once: true });
  } else {
    run();
    scheduleLatePasses();
  }
})();
