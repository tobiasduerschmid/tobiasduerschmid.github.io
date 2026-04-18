---
title: "ArchUML Syntax Reference"
layout: sebook
permalink: /SEBook/tools/uml-reference
no_auto_uml: true
---

<p style="color:#666;font-style:italic;margin-bottom:1.5em;">Diagrams render after the page loads. Scroll to see each one.</p>

{% capture ref_md %}{% include REFERENCE.md %}{% endcapture %}
{{ ref_md | escape_chevrons_in_pre | markdownify }}

<script>
/* Progressive lazy rendering for the reference page.
   The sebook layout's deferred bundle is suppressed via no_auto_uml: true.
   This script runs synchronously before any JS loads:
     1. Converts every pre>code.language-uml-* into a placeholder div
        (so auto-init finds nothing when the bundle loads)
     2. Loads the bundle after idle so content paints first
     3. Uses IntersectionObserver to render each diagram only when visible */
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

  /* Convert all uml code blocks to lazy placeholders */
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
    ph.style.cssText = 'min-height:60px;padding:12px;color:#999;font-size:0.82em;border:1px solid #e0e0e0;border-radius:4px;margin:0.5em 0;';
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
    item.el.style.cssText = '';
    try { R.render(item.el, item.spec); }
    catch (e) { item.el.textContent = '[Render error: ' + e.message + ']'; }
  }

  var obs = new IntersectionObserver(function (entries) {
    for (var k = 0; k < entries.length; k++) {
      if (!entries[k].isIntersecting) continue;
      var target = entries[k].target;
      for (var m = 0; m < lazies.length; m++) {
        if (lazies[m].el === target) { renderItem(lazies[m]); obs.unobserve(target); break; }
      }
    }
  }, { rootMargin: '400px' });

  function setup() {
    for (var n = 0; n < lazies.length; n++) obs.observe(lazies[n].el);
  }

  function loadBundle() {
    if (window.UMLClassDiagram) { setup(); return; }
    var s = document.createElement('script');
    s.src = '/js/ArchUML/uml-bundle.js';
    s.onload = setup;
    document.head.appendChild(s);
  }

  if (window.requestIdleCallback) {
    requestIdleCallback(loadBundle, { timeout: 3000 });
  } else {
    setTimeout(loadBundle, 200);
  }
})();
</script>
