/**
 * SebookMermaid — centralized mermaid configuration and inline-render helper.
 *
 * Goals
 *   1. Every mermaid diagram in this project shares one visual language with the
 *      ArchUML renderer in `js/ArchUML/uml-bundle.js` (matching colors, font
 *      family, base font size, dark-mode behavior). Authors don't pick a theme;
 *      they get the project theme by loading this script.
 *   2. ```mermaid``` fenced code blocks inside instructions get rendered inline
 *      to SVG without each caller writing its own DOM-walking helper.
 *
 * Wire-up (do this in any page that uses mermaid):
 *   <script src="https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.min.js"></script>
 *   <script src="/js/mermaid-theme.js"></script>
 *   // Then, after each markdown render that may contain ```mermaid blocks:
 *   //   SebookMermaid.render(rootEl)
 *
 * The theme variables here mirror the ArchUML CSS-variable palette defined in
 * `css/uml-diagram.css`:
 *   --uml-stroke #4060a0   --uml-text #222   --uml-fill #fff (here #fdfcf8)
 *   --uml-header-fill #d0ddef   --uml-line #444
 * Typography is paragraph-sized in css/uml-diagram.css; the configuration
 * below reserves enough measurement space for Mermaid's HTML labels.
 *
 * Keeping the two diagram families on the same palette means a page that mixes
 * a Class Diagram (ArchUML) and a Flowchart (mermaid) reads as one figure set,
 * not two unrelated systems.
 */
(function () {
  'use strict';

  // Palette — mirrors css/uml-diagram.css and js/ArchUML/uml-bundle.js BASE_CFG.
  // Label presentation belongs to css/uml-diagram.css, including readable
  // edge text, dark-mode treatment, focus styling, and print sizing.
  var ARCHUML = {
    stroke:        '#4060a0',
    text:          '#222',
    fill:          '#fdfcf8',
    headerFill:    '#d0ddef',
    secondaryFill: '#eef4fa',
    line:          '#444',
    fontFamily:    "'Segoe UI', system-ui, -apple-system, sans-serif",
    // Mermaid bakes a `font-size: 0.75em` rule onto its inner <g class="label">
    // wrappers, which is also what it uses to MEASURE label width and pre-size
    // node boxes. So the SVG-level fontSize must be tall enough that
    // 0.75 × fontSize ≥ the rendered label size, otherwise long labels overflow
    // their boxes and get clipped. The CSS module renders node and edge
    // labels at 20px, so this measurement base must be at least 27px.
    fontSize:      '28px',
  };

  function buildThemeVariables() {
    return {
      // Mermaid v11 theme variables — names follow the mermaid theming docs
      // (see https://mermaid.js.org/config/theming.html).
      fontSize:           ARCHUML.fontSize,
      fontFamily:         ARCHUML.fontFamily,
      // Node defaults
      primaryColor:       ARCHUML.fill,
      primaryTextColor:   ARCHUML.text,
      primaryBorderColor: ARCHUML.stroke,
      // Edges
      lineColor:          ARCHUML.line,
      // Subgraphs / clusters
      clusterBkg:         ARCHUML.headerFill,
      clusterBorder:      ARCHUML.stroke,
      // Secondary nodes (e.g. some flowchart classDef defaults)
      secondaryColor:     ARCHUML.headerFill,
      secondaryTextColor: ARCHUML.text,
      secondaryBorderColor: ARCHUML.stroke,
      // Tertiary (notes / asides)
      tertiaryColor:        ARCHUML.secondaryFill,
      tertiaryTextColor:    ARCHUML.text,
      tertiaryBorderColor:  ARCHUML.stroke,
      // Notes (sequence + others)
      noteBkgColor:    ARCHUML.secondaryFill,
      noteBorderColor: ARCHUML.stroke,
      noteTextColor:   ARCHUML.text,
      // Sequence diagram specifics
      actorBkg:        ARCHUML.fill,
      actorBorder:     ARCHUML.stroke,
      actorTextColor:  ARCHUML.text,
      actorLineColor:  ARCHUML.line,
      signalColor:     ARCHUML.line,
      signalTextColor: ARCHUML.text,
      // State diagram specifics
      labelBackgroundColor: ARCHUML.fill,
      // ER diagram specifics
      attributeBackgroundColorOdd:  ARCHUML.fill,
      attributeBackgroundColorEven: ARCHUML.secondaryFill,
    };
  }

  // Public: configure the global mermaid instance.
  // Idempotent — safe to call from multiple entry points.
  function initialize(extraConfig) {
    if (!window.mermaid) return false;
    var cfg = {
      startOnLoad: false,
      theme: 'base',
      themeVariables: buildThemeVariables(),
      flowchart: { htmlLabels: true, curve: 'basis' },
      securityLevel: 'loose',
    };
    if (extraConfig) {
      for (var k in extraConfig) if (extraConfig.hasOwnProperty(k)) cfg[k] = extraConfig[k];
    }
    window.mermaid.initialize(cfg);
    return true;
  }

  // Pull a leading "caption:" line out of the diagram source so the diagram
  // can be wrapped in <figure><figcaption> without double-rendering the line.
  // Supports two equivalent forms (a mermaid comment or a plain leading line):
  //   %% caption: A flowchart of order processing
  //   caption: A flowchart of order processing
  // Returns { caption: string|null, source: string } where source is the
  // diagram text with the caption line removed.
  function extractCaption(text) {
    if (!text) return { caption: null, source: '' };
    var lines = text.split('\n');
    var firstNonBlank = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== '') { firstNonBlank = i; break; }
    }
    if (firstNonBlank === -1) return { caption: null, source: text };
    var head = lines[firstNonBlank];
    var match = head.match(/^\s*(?:%%\s*)?caption\s*:\s*(.+?)\s*$/i);
    if (!match) return { caption: null, source: text };
    var rest = lines.slice();
    rest.splice(firstNonBlank, 1);
    return { caption: match[1], source: rest.join('\n') };
  }

  function updateDiagramScrollability(div) {
    if (div.scrollWidth > div.clientWidth + 1) div.setAttribute('tabindex', '0');
    else div.removeAttribute('tabindex');
  }

  // Layout changes include viewport resizing, printing, and opening a reveal.
  const diagramResizeObserver = new ResizeObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.target.isConnected) {
        diagramResizeObserver.unobserve(entry.target);
        return;
      }
      updateDiagramScrollability(entry.target);
    });
  });

  // Public: convert ```mermaid fenced code blocks under `rootEl` into rendered
  // <figure><div class="mermaid"></div>[<figcaption>]</figure>. Idempotent
  // across re-renders because we replace the <pre> wrapper each time.
  // Returns a Promise that settles after rendering; print callers await it.
  // Retries once if mermaid is still loading.
  //
  // Accessibility (WCAG 2.2 §1.1.1, WCAG 3 figure caption requirements):
  // every diagram is wrapped in a <figure> so it's announced as a figure by
  // screen readers, and given an aria-label as its text alternative. If the
  // source begins with a `caption:` line (or `%% caption:`), that line becomes
  // BOTH the visible <figcaption> and the image wrapper's aria-label. Otherwise we fall
  // back to a generic label like "Mermaid flowchart" for aria-label only —
  // we no longer render a *visible* fallback caption because it just retells
  // the diagram type without adding pedagogical value (mirrors the ArchUML
  // policy in js/uml-auto-describe.js). An authored accDescr is also exposed
  // on that wrapper, whose atomic image role otherwise hides the SVG subtree.
  function render(rootEl) {
    if (!rootEl) return Promise.resolve();
    var blocks = rootEl.querySelectorAll('pre > code.language-mermaid');
    if (!blocks.length) return Promise.resolve();
    var divs = [];
    for (var i = 0; i < blocks.length; i++) {
      var code = blocks[i];
      var pre = code.parentElement;
      if (!pre || !pre.parentElement) continue;
      var parsed = extractCaption(code.textContent);
      var caption = parsed.caption;
      var hasExplicitCaption = !!caption;
      var ariaLabel = caption || guessMermaidLabel(parsed.source);

      var figure = document.createElement('figure');
      figure.className = 'sebook-figure sebook-figure--mermaid';
      var div = document.createElement('div');
      div.className = 'mermaid';
      div.setAttribute('role', 'img');
      div.setAttribute('aria-label', ariaLabel);
      div.textContent = parsed.source;
      figure.appendChild(div);

      // Visible figcaption only when the author explicitly supplied one.
      if (hasExplicitCaption) {
        var figcaption = document.createElement('figcaption');
        figcaption.className = 'sebook-figure__caption';
        figcaption.textContent = caption;
        figure.appendChild(figcaption);
      }

      pre.parentElement.replaceChild(figure, pre);
      divs.push(div);
    }
    const run = async function () {
      try {
        await window.mermaid.run({ nodes: divs });
        divs.forEach(function (div) {
          const svg = div.querySelector('svg');
          if (!svg) return;
          svg.style.setProperty('--mermaid-intrinsic-width', svg.viewBox.baseVal.width + 'px');
          const description = svg.getAttribute('aria-describedby');
          if (description) div.setAttribute('aria-describedby', description);
          updateDiagramScrollability(div);
          diagramResizeObserver.observe(div);
        });
      } catch (e) {
        console.warn('[SebookMermaid] run failed:', e);
      }
    };
    if (window.mermaid && window.mermaid.run) return run();
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(window.mermaid && window.mermaid.run ? run() : undefined);
      }, 500);
    });
  }

  // Heuristic fallback when no explicit caption was provided. Look at the
  // first directive line to figure out the diagram type, then return a short
  // human-readable label. Better than nothing for a screen reader.
  function guessMermaidLabel(source) {
    var firstLine = '';
    var lines = (source || '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (!ln || ln.indexOf('%%') === 0) continue;
      firstLine = ln.toLowerCase();
      break;
    }
    if (firstLine.indexOf('sequencediagram') === 0) return 'Mermaid sequence diagram';
    if (firstLine.indexOf('classdiagram') === 0)    return 'Mermaid class diagram';
    if (firstLine.indexOf('statediagram') === 0)    return 'Mermaid state diagram';
    if (firstLine.indexOf('erdiagram') === 0)       return 'Mermaid entity-relationship diagram';
    if (firstLine.indexOf('gantt') === 0)           return 'Mermaid gantt chart';
    if (firstLine.indexOf('pie') === 0)             return 'Mermaid pie chart';
    if (firstLine.indexOf('journey') === 0)         return 'Mermaid user journey diagram';
    if (firstLine.indexOf('mindmap') === 0)         return 'Mermaid mind map';
    if (firstLine.indexOf('timeline') === 0)        return 'Mermaid timeline';
    if (firstLine.indexOf('gitgraph') === 0)        return 'Mermaid git graph';
    if (firstLine.indexOf('flowchart') === 0 || firstLine.indexOf('graph') === 0) return 'Mermaid flowchart';
    return 'Mermaid diagram';
  }

  // Auto-initialize on script load if mermaid is already present (typical when
  // the mermaid CDN <script> appears before this file in the HTML). Pages that
  // load mermaid lazily can call SebookMermaid.initialize() themselves.
  window.SebookMermaid = {
    initialize: initialize,
    render: render,
    palette: ARCHUML,  // exposed for diagnostics / per-page tweaks
  };
  initialize();
})();
