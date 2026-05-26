---
title: "ArchUML Syntax Reference"
layout: sebook
permalink: /SEBook/tools/uml-reference
no_auto_uml: true
---

<p class="uml-reference-intro">Diagrams render after the page loads. Scroll to see each one.</p>


{% capture ref_md %}{% include REFERENCE.md %}{% endcapture %}
{% assign ref_md = ref_md | replace: '](../git-graph.js)', '](/js/git-graph.js)' %}
{{ ref_md | escape_chevrons_in_pre | markdownify }}

<script>
/* Deferred-but-eager rendering for the reference page.
   The sebook layout's deferred bundle is suppressed via no_auto_uml: true.
   This script runs synchronously before any JS loads:
     1. Converts every pre>code.language-uml-* into a placeholder div
        (so auto-init finds nothing when the bundle loads)
     2. Loads the bundle after idle so content paints first
     3. Renders every diagram up-front once the bundle is in.

   Up-front rendering (instead of an IntersectionObserver that fires while the
   user scrolls) is required for WCAG 2.4.11 (Focus Not Obscured). When the
   user Tabs to a link far down the page, the browser computes the scroll
   target from the current layout. If diagrams are still rendering above the
   target as the scroll happens, the target gets pushed below the viewport
   and the focused element ends up off-screen. Rendering all diagrams once
   the bundle loads keeps the layout stable from first interaction onward. */
(function () {
  var TYPE_MAP = {
    'class':      'UMLClassDiagram',
    'sequence':   'UMLSequenceDiagram',
    'state':      'UMLStateDiagram',
    'component':  'UMLComponentDiagram',
    'deployment': 'UMLDeploymentDiagram',
    'usecase':    'UMLUseCaseDiagram',
    'activity':   'UMLActivityDiagram',
  };
  var prefix = 'language-uml-';

  /* Convert all uml code blocks to placeholders so the bundle's auto-init
     (which runs on DOMContentLoaded) finds nothing to render — we drive the
     render ourselves below, after deferred bundle load. */
  var lazies = [];
  var codes = document.querySelectorAll('pre > code[class*="language-uml-"]');
  for (var i = 0; i < codes.length; i++) {
    var code = codes[i];
    var cls = null;
    for (var j = 0; j < code.classList.length; j++) {
      if (code.classList[j].indexOf(prefix) === 0) { cls = code.classList[j]; break; }
    }
    if (!cls) continue;
    var type = cls.slice(prefix.length);
    if (!TYPE_MAP[type]) continue;

    var spec = code.textContent;
    var pre  = code.parentElement;

    var ph = document.createElement('div');
    ph.className = 'uml-lazy-placeholder';
    ph.textContent = 'Diagram loading…';
    pre.parentElement.replaceChild(ph, pre);
    lazies.push({ el: ph, type: type, spec: spec, rendered: false });
  }

  function renderItem(item) {
    if (item.rendered) return;
    item.rendered = true;
    var R = window[TYPE_MAP[item.type]];
    if (!R || typeof R.render !== 'function') { item.el.textContent = ''; return; }
    item.el.textContent = '';
    item.el.classList.remove('uml-lazy-placeholder');
    try { R.render(item.el, item.spec); }
    catch (e) { item.el.textContent = '[Render error: ' + e.message + ']'; }
  }

  function renderAll() {
    for (var n = 0; n < lazies.length; n++) renderItem(lazies[n]);
  }

  function loadBundle() {
    if (window.UMLClassDiagram) { renderAll(); return; }
    var s = document.createElement('script');
    s.src = '/js/ArchUML/uml-bundle.js';
    s.onload = renderAll;
    document.head.appendChild(s);
  }

  if (window.requestIdleCallback) {
    requestIdleCallback(loadBundle, { timeout: 3000 });
  } else {
    setTimeout(loadBundle, 200);
  }
})();
</script>
