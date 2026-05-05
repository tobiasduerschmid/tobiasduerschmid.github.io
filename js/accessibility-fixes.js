// Post-load accessibility patches for content rendered by Jekyll/Rouge,
// MathJax, Bootstrap carousel, etc. These elements are produced by templates
// or libraries we don't fully control, so we adjust them on the client.

(function () {
  'use strict';

  const SCROLLABLE_REGION_SELECTOR = [
    '.highlight > pre',
    '.highlighter-rouge .highlight pre',
    'pre.highlight',
    '.tvm-step-content-wrap',
    '.tvm-editor-tabs',
    '.tvm-git-graph-container',
    '.tvm-output-container',
    '.tvm-diagram-content',
    '.git-command-lab__rebase-file',
  ].join(', ');

  const MEASURED_SCROLLABLE_SELECTOR = [
    '.highlight > pre',
    '.highlighter-rouge .highlight pre',
    'pre.highlight',
    '.git-command-lab__rebase-file',
  ].join(', ');

  function isScrollable(el) {
    return el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
  }

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
    const blocks = document.querySelectorAll(SCROLLABLE_REGION_SELECTOR);
    blocks.forEach((pre) => {
      if (pre.hasAttribute('tabindex')) return;
      if (pre.closest('[aria-hidden="true"]')) return;
      if (pre.closest('.inline-language-panel')) return;
      if (pre.matches(MEASURED_SCROLLABLE_SELECTOR) && !isScrollable(pre)) return;
      pre.setAttribute('tabindex', '0');
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

  function distinguishCitationLinks() {
    document.querySelectorAll('a.citation').forEach((link, index) => {
      if (link.className.split(/\s+/).some((name) => /^citation-ref-\d+$/.test(name))) return;
      link.classList.add('citation-ref-' + (index + 1));
    });
  }

  function run() {
    try { makeScrollableCodeBlocksFocusable(); } catch (e) { /* non-fatal */ }
    try { deroleCarouselListboxes(); } catch (e) { /* non-fatal */ }
    try { enhanceTables(); } catch (e) { /* non-fatal */ }
    try { distinguishCitationLinks(); } catch (e) { /* non-fatal */ }
  }

  // Tutorial step content (.tvm-step-content-wrap), editor tab rows, and
  // Rouge code blocks inside dynamically-rendered content are inserted
  // AFTER DOMContentLoaded by the tutorial JS. Re-run the patch a few times
  // post-load, then keep one throttled observer for later step transitions.
  function scheduleLatePasses() {
    [200, 800, 2500, 6000].forEach((ms) => setTimeout(run, ms));
  }

  function installDynamicScrollableRegionObserver() {
    if (!document.body || window.__sebookScrollableA11yObserverInstalled) return;
    window.__sebookScrollableA11yObserverInstalled = true;

    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        try { makeScrollableCodeBlocksFocusable(); } catch (e) { /* non-fatal */ }
      });
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches?.(SCROLLABLE_REGION_SELECTOR) || node.querySelector?.(SCROLLABLE_REGION_SELECTOR)) {
            schedule();
            return;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      run();
      scheduleLatePasses();
      installDynamicScrollableRegionObserver();
    }, { once: true });
  } else {
    run();
    scheduleLatePasses();
    installDynamicScrollableRegionObserver();
  }
})();
