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
 *   <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
 *   <script src="/js/mermaid-theme.js"></script>
 *   // Then, after each markdown render that may contain ```mermaid blocks:
 *   //   SebookMermaid.render(rootEl)
 *
 * The theme variables here mirror the ArchUML CSS-variable palette defined in
 * `css/uml-diagram.css`:
 *   --uml-stroke #4060a0   --uml-text #222   --uml-fill #fff (here #fdfcf8)
 *   --uml-header-fill #d0ddef   --uml-line #444
 * Font + size mirror BASE_CFG in `js/ArchUML/uml-bundle.js`:
 *   'Segoe UI', system-ui, -apple-system, sans-serif at 14px.
 *
 * Keeping the two diagram families on the same palette means a page that mixes
 * a Class Diagram (ArchUML) and a Flowchart (mermaid) reads as one figure set,
 * not two unrelated systems.
 */
(function () {
  'use strict';

  // Palette — mirrors css/uml-diagram.css and js/ArchUML/uml-bundle.js BASE_CFG.
  // Sizing note: ArchUML uses BASE_CFG.fontSize=14 for body text and
  // fontSizeBold=15 for headers/labels. Mermaid flowchart nodes are the visual
  // equivalent of ArchUML class/component HEADERS (one bold word per box), so
  // we anchor mermaid's base to the bold-header size and weight, not the body
  // size. That makes a mermaid flowchart sit alongside an ArchUML diagram
  // without feeling visually lighter.
  var ARCHUML = {
    stroke:        '#4060a0',
    strokeStrong:  '#3b5896',
    strokeWidth:   '1.5px',
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
    // their boxes and get clipped. We render labels at 20px bold (substantially
    // larger than body text so the diagram reads as a primary visual, not a
    // footnote), which requires fontSize ≥ 27px.
    fontSize:      '28px',
    labelFontSize: '20px',
    labelWeight:   '600',
    edgeFontSize:  '15px',
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

  // Mermaid's flowchart-internal CSS sometimes needs nudging for visual parity
  // with ArchUML (line-height for HTML labels, dark-mode filter that mirrors
  // the one ArchUML uses in css/uml-diagram.css). Inject as a single page-level
  // <style> the first time this file initializes.
  var STYLE_ID = 'sebook-mermaid-theme-style';
  function injectPageStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    // Mermaid v11 bakes a `font-size: 0.75em` rule onto its inner <g class="label">
    // wrappers, so HTML labels in flowchart nodes drop to ~12px when the SVG
    // base is 16px. We accept that 12px AT MEASURE TIME (mermaid sizes boxes
    // to fit ~12px content), then bump rendered labels to ArchUML's bold
    // header size (15px / weight 600) which still fits the pre-sized boxes.
    var labelFs = ARCHUML.labelFontSize;
    var labelWeight = ARCHUML.labelWeight;
    var stroke = ARCHUML.stroke;
    var strokeWidth = ARCHUML.strokeWidth;
    style.textContent = [
      '/* SebookMermaid — page-level overrides for visual parity with ArchUML */',
      'div.mermaid { display: block; padding: 8px 0; overflow-x: auto; }',
      'div.mermaid svg { max-width: 100%; height: auto; }',
      // HTML labels inside flowchart nodes — match ArchUML header style
      // (bold 15px, no <p> margins). Use !important to beat mermaid's
      // internal <style> block which sets a 0.75em rule on g.label.
      'div.mermaid svg g.label,',
      'div.mermaid svg g.label foreignObject,',
      'div.mermaid svg foreignObject,',
      'div.mermaid svg foreignObject div,',
      'div.mermaid svg foreignObject span,',
      'div.mermaid svg foreignObject p {',
      '  font-size: ' + labelFs + ' !important;',
      '  font-weight: ' + labelWeight + ';',
      '  line-height: 1.35;',
      '  margin: 0;',
      '}',
      // Edge labels stay regular weight + italic to match ArchUML edge style,
      // and at a smaller font than node labels so they read as annotations.
      'div.mermaid svg .edgeLabel,',
      'div.mermaid svg .edgeLabel * {',
      '  font-size: ' + ARCHUML.edgeFontSize + ' !important;',
      '  font-weight: 400 !important;',
      '  font-style: italic;',
      '}',
      // Stroke width matches ArchUML's visible stroke weight. Mermaid's internal
      // <style> sets id-prefixed rules so we need !important to win specificity.
      // Drop-shadow mirrors the ArchUML feDropShadow filter (uml-bundle.js
      // ~line 411: dx=1.5 dy=3 stdDeviation=3 flood-opacity=0.35).
      'div.mermaid svg .node rect,',
      'div.mermaid svg .node polygon,',
      'div.mermaid svg .node circle,',
      'div.mermaid svg .node ellipse,',
      'div.mermaid svg .node path,',
      'div.mermaid svg .cluster rect {',
      '  stroke-width: ' + strokeWidth + ' !important;',
      '  filter: drop-shadow(1.5px 3px 3px rgba(0, 0, 0, 0.35));',
      '}',
      // Edge lines bumped slightly so the diagram reads as connected at a glance.
      'div.mermaid svg .flowchart-link,',
      'div.mermaid svg .messageLine0,',
      'div.mermaid svg .messageLine1 { stroke-width: 1.4px !important; }',
      // Dark mode: invert + hue-rotate matches the ArchUML dark-mode rule in
      // css/uml-diagram.css so a page mixing both renders consistently.
      'html.dark-mode div.mermaid svg { filter: invert(1) hue-rotate(180deg); }',
    ].join('\n');
    document.head.appendChild(style);
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
    injectPageStyle();
    return true;
  }

  // Public: convert ```mermaid fenced code blocks under `rootEl` into rendered
  // <div class="mermaid"> SVG. Idempotent across re-renders because we replace
  // the <pre> wrapper each time. Retries once if mermaid is still loading.
  function render(rootEl) {
    if (!rootEl) return;
    var blocks = rootEl.querySelectorAll('pre > code.language-mermaid');
    if (!blocks.length) return;
    var divs = [];
    for (var i = 0; i < blocks.length; i++) {
      var code = blocks[i];
      var pre = code.parentElement;
      if (!pre || !pre.parentElement) continue;
      var div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = code.textContent;
      pre.parentElement.replaceChild(div, pre);
      divs.push(div);
    }
    var run = function () {
      try { window.mermaid.run({ nodes: divs }); }
      catch (e) { console.warn('[SebookMermaid] run failed:', e); }
    };
    if (window.mermaid && window.mermaid.run) run();
    else setTimeout(function () { if (window.mermaid && window.mermaid.run) run(); }, 500);
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
