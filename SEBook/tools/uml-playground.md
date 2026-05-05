---
title: "UML Playground"
layout: sebook
permalink: /SEBook/tools/uml-playground
---

<script src="/js/git-graph.js"></script>
<link rel="stylesheet" href="/css/git-graph.css">

# UML Playground

Edit the **Diagram spec** textarea and the playground re-renders the SVG output live. Switch between diagram types using the selector, then download the SVG when you're happy with the result.

<div id="uml-playground-wrap">
  <div id="uml-playground-toolbar">
    <label for="uml-pg-type">Diagram type:</label>
    <select id="uml-pg-type">
      <option value="class">Class</option>
      <option value="sequence">Sequence</option>
      <option value="state">State</option>
      <option value="component">Component</option>
      <option value="deployment">Deployment</option>
      <option value="usecase">Use Case</option>
      <option value="activity">Activity</option>
      <option value="gitgraph">Git Graph</option>
      <option value="venn">Venn</option>
      <option value="er">ER (Chen)</option>
    </select>
    <label id="uml-pg-layout-label" for="uml-pg-layout">Layout:</label>
    <select id="uml-pg-layout">
      <option value="auto">Auto</option>
      <option value="square" selected>Square</option>
      <option value="landscape">Landscape</option>
      <option value="portrait">Portrait</option>
    </select>
    <label class="uml-pg-check" for="uml-pg-edit">
      <input type="checkbox" id="uml-pg-edit" aria-label="Visual edit" checked>
      Visual edit
    </label>
    <label class="uml-pg-check" for="uml-pg-snap">
      <input type="checkbox" id="uml-pg-snap" aria-label="Snap to layout grid" checked>
      Snap
    </label>
    <button id="uml-pg-undo" type="button" title="Undo (Cmd/Ctrl+Z)" aria-keyshortcuts="Control+Z" disabled>↶ Undo</button>
    <button id="uml-pg-redo" type="button" title="Redo (Cmd/Ctrl+Shift+Z)" aria-keyshortcuts="Control+Shift+Z" disabled>↷ Redo</button>
    <button id="uml-pg-reset-one" title="Reset selected layout override" disabled>Reset Selected</button>
    <button id="uml-pg-reset-layout" title="Remove layout overrides">Reset Layout</button>
    <button id="uml-pg-reset-example" title="Discard your draft and reload the built-in example for this diagram type" type="button">↺ Example</button>
    <button id="uml-pg-copy-source" title="Copy generated ArchUML">Copy ArchUML</button>
    <button id="uml-pg-download" title="Download diagram as SVG file">&#8595; Download SVG</button>
    <span class="uml-pg-zoom-group" role="group" aria-label="Zoom">
      <button id="uml-pg-zoom-out" type="button" title="Zoom out (Cmd/Ctrl+−)" aria-keyshortcuts="Control+-" aria-label="Zoom out">−</button>
      <button id="uml-pg-zoom-readout-btn" type="button" title="Reset zoom to 100% (Cmd/Ctrl+0)" aria-keyshortcuts="Control+0"><span id="uml-pg-zoom-readout">100%</span></button>
      <button id="uml-pg-zoom-in" type="button" title="Zoom in (Cmd/Ctrl++)" aria-keyshortcuts="Control+=" aria-label="Zoom in">+</button>
    </span>
    <button id="uml-pg-fullscreen" type="button" title="Toggle full-screen (F)" aria-pressed="false">⛶ Full screen</button>
    <span id="uml-pg-autosave" aria-live="polite"></span>
    <span id="uml-pg-status"></span>
  </div>

  <div id="uml-pg-palette" hidden aria-label="Visual editor palette">
    <div class="uml-pg-palette-row">
      <span class="uml-pg-palette-label">+ Element:</span>
      <span class="uml-pg-palette-buttons" id="uml-pg-palette-elements"></span>
    </div>
    <div class="uml-pg-palette-row">
      <span class="uml-pg-palette-label">+ Relation:</span>
      <span class="uml-pg-palette-buttons" id="uml-pg-palette-relations"></span>
    </div>
    <div class="uml-pg-palette-row uml-pg-palette-status-row">
      <span id="uml-pg-tool-status"></span>
      <button id="uml-pg-tool-cancel" type="button" hidden>Cancel</button>
    </div>
  </div>

  <div id="uml-pg-help-banner" hidden role="region" aria-label="Visual editor tips">
    <div class="uml-pg-help-text">
      <strong>Tips:</strong>
      Click a palette tool then click the canvas to place an element.
      Drag a tool onto the canvas to drop one in place.
      Hover an element and drag the <span class="uml-pg-help-plus" aria-hidden="true">+</span> handle to another element to connect them.
      Click a relation to edit its label / multiplicity / navigability.
      Double-click to rename.
      <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+click to add to selection.
      Drag empty canvas to pan.
    </div>
    <button id="uml-pg-help-dismiss" type="button" aria-label="Got it — dismiss tips">Got it</button>
  </div>

  <div id="uml-playground-body">
    <div id="uml-pg-editor-pane">
      <textarea id="uml-pg-input" aria-label="ArchUML diagram source" spellcheck="false" autocorrect="off" autocapitalize="off"></textarea>
    </div>
    <div class="uml-pg-splitter" id="uml-pg-split-editor" role="separator" aria-orientation="vertical" aria-label="Resize editor pane" tabindex="0" aria-valuenow="40" aria-valuemin="20" aria-valuemax="80"></div>
    <div id="uml-pg-preview-pane">
      <div id="uml-pg-output" class="uml-class-diagram-container"></div>
      <div id="uml-pg-error" style="display:none;"></div>
    </div>
    <div class="uml-pg-splitter" id="uml-pg-split-props" role="separator" aria-orientation="vertical" aria-label="Resize properties pane" tabindex="0" aria-valuenow="280" aria-valuemin="200" aria-valuemax="600" hidden></div>
    <aside id="uml-pg-props-pane" hidden aria-label="Properties of selected item">
      <div class="uml-pg-props-header">
        <h2 id="uml-pg-props-title">Properties</h2>
        <button id="uml-pg-props-delete" type="button" title="Delete selected (Del)">&#x2715; Delete</button>
      </div>
      <div id="uml-pg-props-content"></div>
    </aside>
  </div>
</div>

<style>
#uml-playground-wrap {
  margin: 1.5em 0;
  border: 1px solid #c8d4e8;
  border-radius: 6px;
  font-family: inherit;
}

#uml-playground-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #eef2f9;
  border-bottom: 1px solid #c8d4e8;
  flex-wrap: wrap;
}

#uml-playground-toolbar label {
  font-size: 0.88em;
  font-weight: 600;
  color: #445;
  margin: 0;
}

#uml-pg-type,
#uml-pg-layout {
  font-size: 0.88em;
  padding: 3px 8px;
  border: 1px solid #b0bdd4;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}

#uml-pg-download {
  font-size: 0.88em;
  padding: 3px 12px;
  background: #2774AE;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  min-height: 24px;
}

#uml-pg-reset-one,
#uml-pg-reset-layout,
#uml-pg-reset-example,
#uml-pg-copy-source,
#uml-pg-fullscreen,
#uml-pg-undo,
#uml-pg-redo {
  font-size: 0.88em;
  padding: 3px 10px;
  background: #fff;
  color: #26415f;
  border: 1px solid #b0bdd4;
  border-radius: 4px;
  cursor: pointer;
  min-height: 24px;
}

#uml-pg-undo:hover:not(:disabled),
#uml-pg-redo:hover:not(:disabled) {
  background: #f5f8fc;
}

#uml-pg-undo:disabled,
#uml-pg-redo:disabled {
  color: #8a96a8;
  background: #f3f5f8;
  cursor: not-allowed;
}

#uml-pg-undo:focus-visible,
#uml-pg-redo:focus-visible {
  outline: 3px solid #2774AE;
  outline-offset: 2px;
}

html.dark-mode #uml-pg-undo,
html.dark-mode #uml-pg-redo {
  background: #243347;
  border-color: #3a4a60;
  color: #d0e0f0;
}

html.dark-mode #uml-pg-undo:hover:not(:disabled),
html.dark-mode #uml-pg-redo:hover:not(:disabled) {
  background: #2c3f57;
}

html.dark-mode #uml-pg-undo:disabled,
html.dark-mode #uml-pg-redo:disabled {
  background: #1b2635;
  border-color: #303d50;
  color: #718399;
}

html.dark-mode #uml-pg-undo:focus-visible,
html.dark-mode #uml-pg-redo:focus-visible {
  outline-color: #FFD100;
}

/* Help banner */
#uml-pg-help-banner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 14px;
  background: #fff8e1;
  border-bottom: 1px solid #f0d590;
  color: #4a3b08;
  font-size: 0.93em;
}

.uml-pg-help-text {
  flex: 1 1 auto;
  line-height: 1.5;
}

.uml-pg-help-text kbd {
  font: inherit;
  font-size: 0.92em;
  padding: 1px 6px;
  background: #fff;
  border: 1px solid #c4ad6d;
  border-radius: 3px;
  color: #4a3b08;
}

.uml-pg-help-plus {
  display: inline-block;
  font-weight: 700;
  background: #2774AE;
  color: #fff;
  padding: 0 6px;
  border-radius: 50%;
  min-width: 1.2em;
  text-align: center;
  font-size: 0.92em;
}

#uml-pg-help-dismiss {
  font: inherit;
  font-size: 0.92em;
  padding: 5px 12px;
  background: #fff;
  color: #4a3b08;
  border: 1px solid #c4ad6d;
  border-radius: 4px;
  cursor: pointer;
  min-height: 30px;
  flex: 0 0 auto;
}

#uml-pg-help-dismiss:hover {
  background: #f8f0d0;
  border-color: #8c6e1a;
}

#uml-pg-help-dismiss:focus-visible {
  outline: 3px solid #8c6e1a;
  outline-offset: 2px;
}

html.dark-mode #uml-pg-help-banner {
  background: #2a230d;
  border-color: #5a4a1d;
  color: #f0e3b8;
}

html.dark-mode .uml-pg-help-text kbd {
  background: #1f1a08;
  border-color: #5a4a1d;
  color: #f0e3b8;
}

html.dark-mode #uml-pg-help-dismiss {
  background: #1f1a08;
  color: #f0e3b8;
  border-color: #5a4a1d;
}

html.dark-mode #uml-pg-help-dismiss:hover {
  background: #2a230d;
  border-color: #f0e3b8;
}

html.dark-mode #uml-pg-help-dismiss:focus-visible {
  outline-color: #FFD100;
}

/* Zoom toolbar group */
.uml-pg-zoom-group {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid #b0bdd4;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.uml-pg-zoom-group > button {
  font: inherit;
  font-size: 0.92em;
  padding: 3px 10px;
  background: #fff;
  color: #26415f;
  border: none;
  border-right: 1px solid #b0bdd4;
  cursor: pointer;
  min-height: 24px;
  min-width: 32px;
}

.uml-pg-zoom-group > button:last-child {
  border-right: none;
}

.uml-pg-zoom-group > button:hover:not(:disabled) {
  background: #f5f8fc;
}

.uml-pg-zoom-group > button:disabled {
  color: #8a96a8;
  background: #f3f5f8;
  cursor: not-allowed;
}

.uml-pg-zoom-group > button:focus-visible {
  outline: 3px solid #2774AE;
  outline-offset: -1px;
  z-index: 1;
  position: relative;
}

#uml-pg-zoom-readout-btn {
  min-width: 56px;
  font-variant-numeric: tabular-nums;
}

html.dark-mode .uml-pg-zoom-group {
  background: #243347;
  border-color: #3a4a60;
}

html.dark-mode .uml-pg-zoom-group > button {
  background: #243347;
  color: #d0e0f0;
  border-right-color: #3a4a60;
}

html.dark-mode .uml-pg-zoom-group > button:hover:not(:disabled) {
  background: #2c3f57;
}

html.dark-mode .uml-pg-zoom-group > button:disabled {
  background: #1b2635;
  color: #718399;
}

html.dark-mode .uml-pg-zoom-group > button:focus-visible {
  outline-color: #FFD100;
}

/* Pan cursor */
#uml-pg-output svg {
  cursor: default;
}

#uml-pg-output svg.uml-pg-editing:not(.uml-pg-tool-place):not(.uml-pg-tool-connect) {
  cursor: grab;
}

#uml-pg-output svg.uml-pg-panning {
  cursor: grabbing !important;
}

/* Inline rename overlay */
.uml-pg-inline-input {
  position: fixed;
  z-index: 10000;
  font: inherit;
  font-size: 0.95em;
  padding: 4px 8px;
  border: 2px solid #2774AE;
  border-radius: 3px;
  background: #fff;
  color: #1a1a2e;
  box-shadow: 0 2px 8px rgba(39, 116, 174, 0.4);
  outline: none;
  box-sizing: border-box;
}

html.dark-mode .uml-pg-inline-input {
  border-color: #7cc4ff;
  background: #1f2c3c;
  color: #e3eef9;
  box-shadow: 0 2px 8px rgba(124, 196, 255, 0.5);
}

#uml-pg-fullscreen:hover {
  background: #f5f8fc;
}

#uml-pg-fullscreen:focus-visible {
  outline: 3px solid #2774AE;
  outline-offset: 2px;
}

#uml-pg-fullscreen[aria-pressed="true"] {
  background: #2774AE;
  color: #fff;
  border-color: #1a5a8a;
}

/* Full-screen mode: take over the viewport. */
#uml-playground-wrap.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  margin: 0;
  border-radius: 0;
  border: none;
  display: flex;
  flex-direction: column;
  background: #fff;
}

html.dark-mode #uml-playground-wrap.is-fullscreen {
  background: #101827;
}

#uml-playground-wrap.is-fullscreen #uml-playground-body {
  flex: 1 1 auto;
  min-height: 50vh;
}

#uml-playground-wrap.is-fullscreen #uml-playground-toolbar,
#uml-playground-wrap.is-fullscreen #uml-pg-palette {
  flex-shrink: 0;
  max-height: 35vh;
  overflow-y: auto;
}

#uml-playground-wrap.is-fullscreen #uml-pg-input {
  min-height: 0;
}

#uml-playground-wrap.is-fullscreen #uml-pg-preview-pane {
  overflow: auto;
}

/* In fullscreen, let the SVG canvas grow to fill the preview pane while
   keeping its aspect ratio. The SVG's preserveAspectRatio (default
   xMidYMid meet) keeps it centred. */
#uml-playground-wrap.is-fullscreen #uml-pg-output {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
}

#uml-playground-wrap.is-fullscreen #uml-pg-output svg {
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
}

/* When fullscreen, scroll the document up so the toolbar isn't hidden by anything below. */
body.uml-pg-fullscreen-lock {
  overflow: hidden;
}

#uml-pg-reset-one:hover,
#uml-pg-reset-layout:hover,
#uml-pg-copy-source:hover {
  background: #f5f8fc;
}

#uml-pg-reset-one:disabled {
  color: #8a96a8;
  background: #f3f5f8;
  cursor: not-allowed;
}

.uml-pg-check {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

#uml-pg-download:hover {
  background: #1a5a8a;
}

#uml-pg-download:disabled {
  background: #8aaac8;
  cursor: not-allowed;
}

#uml-pg-status {
  font-size: 0.8em;
  color: #555;
  margin-left: 4px;
}

#uml-pg-autosave {
  font-size: 0.85em;
  color: #2a7a37;
  font-weight: 600;
  margin-left: 6px;
  opacity: 0;
  transition: opacity 0.18s ease-in;
  min-width: 60px;
  display: inline-block;
}

#uml-pg-autosave.is-saved {
  opacity: 1;
}

html.dark-mode #uml-pg-autosave {
  color: #88e58b;
}

#uml-playground-body {
  display: flex;
  min-height: 420px;
}

#uml-pg-editor-pane {
  flex: 0 0 40%;
  display: flex;
  flex-direction: column;
}

/* Resizeable splitter handles —
   WCAG 2.5.8 requires the interactive target be ≥24×24 CSS px. We give the
   splitter a 24-px flex basis and render the visible 6-px bar via ::before
   centered inside that hit zone. The dotty grip indicator moves into
   ::after. The element's getBoundingClientRect now reports 24×N (or N×24
   when stacked) so the audit's target-size check passes. */
.uml-pg-splitter {
  flex: 0 0 24px;
  background: transparent;
  cursor: col-resize;
  position: relative;
  align-self: stretch;
  touch-action: none;
}

/* Visible 6-px bar centered inside the 24-px hit zone. */
.uml-pg-splitter::before {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 0;
  bottom: 0;
  width: 6px;
  background: #c8d4e8;
  transition: background 0.15s;
  pointer-events: none;
}

/* Decorative grip — two short verticals near the bar's center. */
.uml-pg-splitter::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
  top: 50%;
  width: 4px;
  height: 28px;
  border-left: 1px solid #8aa3c2;
  border-right: 1px solid #8aa3c2;
  pointer-events: none;
}

.uml-pg-splitter:hover::before,
.uml-pg-splitter.is-dragging::before {
  background: #2774AE;
}

.uml-pg-splitter:focus-visible {
  outline: 3px solid #2774AE;
  outline-offset: -1px;
}
.uml-pg-splitter:focus-visible::before { background: #99bedd; }

html.dark-mode .uml-pg-splitter::before {
  background: #3a4a60;
}

html.dark-mode .uml-pg-splitter:hover::before,
html.dark-mode .uml-pg-splitter.is-dragging::before {
  background: #7cc4ff;
}

html.dark-mode .uml-pg-splitter:focus-visible {
  outline-color: #FFD100;
}

#uml-pg-input {
  flex: 1;
  width: 100%;
  min-height: 420px;
  padding: 12px;
  font-family: 'Cascadia Code', 'Fira Mono', 'Menlo', 'Consolas', monospace;
  font-size: 0.82em;
  line-height: 1.55;
  border: none;
  outline: none;
  resize: none;
  background: #fafbfd;
  color: #1a1a2e;
  box-sizing: border-box;
}

#uml-pg-input:focus-visible {
  outline: 3px solid #2774AE;
  outline-offset: -3px;
  box-shadow: inset 0 0 0 2px #fff;
}

#uml-pg-preview-pane {
  flex: 1;
  overflow: auto;
  padding: 12px;
  background: #fff;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

#uml-pg-output {
  width: 100%;
  padding: 0;
}

#uml-pg-output svg.uml-pg-editing {
  touch-action: none;
  user-select: none;
}

.uml-pg-edit-hitbox {
  fill: rgba(39, 116, 174, 0.04);
  stroke: rgba(39, 116, 174, 0.72);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
  vector-effect: non-scaling-stroke;
  cursor: move;
}

.uml-pg-edit-hitbox.is-selected {
  fill: rgba(39, 116, 174, 0.10);
  stroke: #2774AE;
  stroke-width: 2;
  stroke-dasharray: none;
}

.uml-pg-edit-hitbox.is-port {
  fill: rgba(39, 174, 96, 0.08);
  stroke: rgba(39, 174, 96, 0.78);
}

.uml-pg-edit-hitbox.is-port.is-selected {
  fill: rgba(39, 174, 96, 0.16);
  stroke: #27ae60;
}

.uml-pg-edit-hitbox.is-label {
  fill: rgba(243, 156, 18, 0.08);
  stroke: rgba(210, 126, 8, 0.78);
}

.uml-pg-edit-hitbox.is-label.is-selected {
  fill: rgba(243, 156, 18, 0.16);
  stroke: #d27e08;
}

/* "+" extend handle on hover */
.uml-pg-extend-handle {
  fill: #2774AE;
  stroke: #fff;
  stroke-width: 2;
  cursor: crosshair;
  opacity: 0;
  pointer-events: all;
  transition: opacity 0.12s;
}

.uml-pg-extend-handle.is-visible,
.uml-pg-edit-hitbox:hover ~ .uml-pg-extend-handle,
.uml-pg-edit-hitbox:focus ~ .uml-pg-extend-handle {
  opacity: 1;
}

.uml-pg-extend-handle-plus {
  fill: #fff;
  pointer-events: none;
  font-size: 16px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: middle;
}

.uml-pg-extend-line {
  stroke: #2774AE;
  stroke-width: 2;
  stroke-dasharray: 6 4;
  fill: none;
  pointer-events: none;
}

html.dark-mode .uml-pg-extend-handle {
  fill: #7cc4ff;
  stroke: #18242f;
}

html.dark-mode .uml-pg-extend-handle-plus {
  fill: #18242f;
}

html.dark-mode .uml-pg-extend-line {
  stroke: #7cc4ff;
}

/* Relation chooser popup */
.uml-pg-relation-chooser {
  position: fixed;
  z-index: 10000;
  background: #fff;
  border: 1px solid #97afca;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 180px;
  max-height: 70vh;
  overflow-y: auto;
}

.uml-pg-relation-chooser-title {
  font-size: 0.92em;
  font-weight: 700;
  color: #1a3656;
  padding: 4px 8px 6px;
  border-bottom: 1px solid #d7e0ec;
  margin-bottom: 4px;
}

.uml-pg-relation-chooser button {
  font: inherit;
  font-size: 0.92em;
  text-align: left;
  padding: 6px 10px;
  background: #fff;
  color: #1a3656;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.uml-pg-relation-chooser button:hover,
.uml-pg-relation-chooser button:focus-visible {
  background: #eef4fb;
  border-color: #2774AE;
  outline: none;
}

.uml-pg-relation-chooser button:focus-visible {
  outline: 2px solid #2774AE;
  outline-offset: 1px;
}

html.dark-mode .uml-pg-relation-chooser {
  background: #18242f;
  border-color: #5a7392;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

html.dark-mode .uml-pg-relation-chooser-title {
  color: #e3eef9;
  border-color: #3a4a60;
}

html.dark-mode .uml-pg-relation-chooser button {
  background: #243347;
  color: #e3eef9;
}

html.dark-mode .uml-pg-relation-chooser button:hover,
html.dark-mode .uml-pg-relation-chooser button:focus-visible {
  background: #2c3f57;
  border-color: #7cc4ff;
}

html.dark-mode .uml-pg-relation-chooser button:focus-visible {
  outline-color: #FFD100;
}

.uml-pg-edge-hitbox {
  fill: none;
  stroke: rgba(39, 116, 174, 0.52);
  stroke-width: 11;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  cursor: grab;
  pointer-events: stroke;
}

.uml-pg-edge-hitbox.is-selected {
  stroke: rgba(39, 116, 174, 0.82);
}

#uml-pg-error {
  color: #c0392b;
  font-size: 0.85em;
  font-family: monospace;
  padding: 8px;
  background: #fdf0ee;
  border-radius: 4px;
  width: 100%;
  white-space: pre-wrap;
}

/* Dark mode support */
html.dark-mode #uml-playground-wrap {
  border-color: #3a4a60;
  background: #101827;
}

html.dark-mode #uml-playground-toolbar {
  background: #1e2c3e;
  border-color: #3a4a60;
}

html.dark-mode #uml-playground-toolbar label {
  color: #b0c4d8;
}

html.dark-mode #uml-pg-type,
html.dark-mode #uml-pg-layout {
  background: #243347;
  border-color: #3a4a60;
  color: #d0e0f0;
}

html.dark-mode #uml-pg-reset-one,
html.dark-mode #uml-pg-reset-layout,
html.dark-mode #uml-pg-copy-source {
  background: #243347;
  border-color: #3a4a60;
  color: #d0e0f0;
}

html.dark-mode #uml-pg-reset-one:hover,
html.dark-mode #uml-pg-reset-layout:hover,
html.dark-mode #uml-pg-copy-source:hover {
  background: #2c3f57;
}

html.dark-mode #uml-pg-reset-one:disabled {
  background: #1b2635;
  border-color: #303d50;
  color: #718399;
}

html.dark-mode #uml-pg-download:disabled {
  background: #35546d;
  color: #c4d4e2;
}

html.dark-mode .uml-pg-check input {
  accent-color: #7cc4ff;
}

html.dark-mode #uml-pg-input {
  background: #141e2b;
  color: #d0e0f0;
  border-color: #3a4a60;
}

html.dark-mode #uml-pg-input:focus-visible {
  outline-color: #FFD100;
  box-shadow: inset 0 0 0 2px #000;
}

html.dark-mode #uml-pg-editor-pane {
  border-color: #3a4a60;
}

html.dark-mode #uml-pg-preview-pane {
  background: #1a2535;
}

html.dark-mode #uml-pg-status {
  color: #8fb2d2;
}

html.dark-mode #uml-pg-error {
  color: #ffd6d1;
  background: #3a1d23;
}

.uml-pg-syntax-help {
  margin: 1.5em 0;
  padding: 1em 1.2em;
  background: #eef4fb;
  border: 1px solid #c0d4ec;
  color: #1a1a1a;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 1em;
  flex-wrap: wrap;
}

.uml-pg-syntax-help-text {
  flex: 1;
  min-width: 200px;
}

a.uml-pg-syntax-help-link,
a.uml-pg-syntax-help-link:visited {
  white-space: nowrap;
  padding: 7px 16px;
  background: #2774AE;
  color: #fff;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9em;
}

a.uml-pg-syntax-help-link:hover,
a.uml-pg-syntax-help-link:focus {
  background: #1f5d8a;
  color: #fff;
  text-decoration: none;
}

a.uml-pg-syntax-help-link:focus-visible {
  outline: 3px solid #111;
  outline-offset: 3px;
}

html.dark-mode .uml-pg-syntax-help {
  background: #1e2c3e;
  border-color: #3a4a60;
  color: #d0e0f0;
}

html.dark-mode a.uml-pg-syntax-help-link,
html.dark-mode a.uml-pg-syntax-help-link:visited {
  /* The global `html.dark-mode a` rule paints links UCLA gold (#FFD100),
     which on a UCLA-blue background only hits ~3.5:1 — below 4.5:1.
     Override with white-on-blue (~5.1:1) and chain `:visited` so the
     style sticks even after the user has clicked through to the
     reference page. */
  background: #2774AE;
  color: #fff;
}

html.dark-mode a.uml-pg-syntax-help-link:hover,
html.dark-mode a.uml-pg-syntax-help-link:focus {
  /* Slightly darker than the default UCLA blue so the hover affordance
     reads in dark mode while keeping ≥4.5:1 against white text. */
  background: #1f5d8a;
  color: #fff;
}

html.dark-mode a.uml-pg-syntax-help-link:focus-visible {
  outline-color: #FFD100;
}

@media (max-width: 700px) {
  #uml-playground-body {
    flex-direction: column;
  }
  #uml-pg-editor-pane {
    flex: none;
    border-right: none;
    border-bottom: 1px solid #c8d4e8;
  }
  #uml-pg-input {
    min-height: 200px;
  }
  #uml-pg-props-pane {
    flex: none !important;
    width: 100% !important;
    max-width: none !important;
    border-left: none !important;
    border-top: 1px solid #c8d4e8;
  }
  /* Splitters become horizontal bars on mobile. Keep the 24-px hit zone
     (WCAG 2.5.8) and swap the visible bar from a vertical 6-px stripe to
     a horizontal one. */
  .uml-pg-splitter {
    flex: 0 0 24px;
    width: 100%;
    cursor: row-resize;
  }
  .uml-pg-splitter::before {
    left: 0;
    right: 0;
    top: 50%;
    bottom: auto;
    transform: translateY(-50%);
    width: auto;
    height: 6px;
  }
  .uml-pg-splitter::after {
    /* Re-orient grip to a horizontal pair of dashes. */
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 28px;
    height: 4px;
    border-left: 0;
    border-right: 0;
    border-top: 1px solid #8aa3c2;
    border-bottom: 1px solid #8aa3c2;
  }
}

/* ─── Visual-editor palette ─── */
#uml-pg-palette {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: #f6f9fd;
  border-bottom: 1px solid #c8d4e8;
}

.uml-pg-palette-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-height: 28px;
}

.uml-pg-palette-label {
  font-size: 0.92em;
  font-weight: 600;
  color: #26415f;
  flex: 0 0 auto;
  min-width: 90px;
}

.uml-pg-palette-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1 1 auto;
}

.uml-pg-tool-btn {
  font: inherit;
  font-size: 0.92em;
  padding: 6px 11px;
  background: #fff;
  color: #1d3557;
  border: 1px solid #97afca;
  border-radius: 4px;
  cursor: pointer;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
}

.uml-pg-tool-btn:hover {
  background: #eef4fb;
  border-color: #2774AE;
}

.uml-pg-tool-btn:focus-visible {
  outline: 3px solid #2774AE;
  outline-offset: 2px;
  box-shadow: 0 0 0 1px #fff inset;
}

.uml-pg-tool-btn[aria-pressed="true"] {
  background: #2774AE;
  color: #fff;
  border-color: #1a5a8a;
  box-shadow: inset 0 0 0 2px #1a5a8a;
}

.uml-pg-tool-btn[aria-pressed="true"]:hover {
  background: #1f5d8a;
  border-color: #144767;
}

.uml-pg-tool-glyph {
  display: inline-block;
  font-weight: 700;
  min-width: 1.2em;
  text-align: center;
}

#uml-pg-tool-cancel {
  font: inherit;
  font-size: 0.9em;
  padding: 5px 12px;
  background: #fff;
  color: #1d3557;
  border: 1px solid #97afca;
  border-radius: 4px;
  cursor: pointer;
  min-height: 30px;
}

#uml-pg-tool-cancel:hover {
  background: #fbe9e7;
  border-color: #c0392b;
  color: #842622;
}

#uml-pg-tool-cancel:focus-visible {
  outline: 3px solid #2774AE;
  outline-offset: 2px;
}

.uml-pg-palette-status-row {
  font-size: 0.92em;
  color: #2c3f57;
}

#uml-pg-tool-status {
  flex: 1 1 auto;
  font-style: italic;
  color: #2c3f57;
  min-height: 1em;
}

#uml-pg-tool-status.is-active {
  font-style: normal;
  font-weight: 600;
  color: #1a5a8a;
}

/* Highlight pending source element when relation tool is mid-pick */
.uml-pg-edit-hitbox.is-relation-source {
  fill: rgba(155, 89, 182, 0.18);
  stroke: #6b3a8c;
  stroke-width: 2.5;
  stroke-dasharray: none;
}

#uml-pg-output svg.uml-pg-tool-place {
  cursor: copy;
}

#uml-pg-output svg.uml-pg-tool-connect {
  cursor: crosshair;
}

/* ─── Properties side-panel ─── */
#uml-pg-props-pane {
  flex: 0 0 280px;
  max-width: 320px;
  border-left: 1px solid #c8d4e8;
  background: #fafbfd;
  overflow-y: auto;
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.uml-pg-props-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0;
}

#uml-pg-props-title {
  font-size: 1em;
  font-weight: 700;
  color: #1a3656;
  margin: 0;
}

#uml-pg-props-delete {
  font: inherit;
  font-size: 0.9em;
  padding: 4px 10px;
  background: #fff;
  color: #842622;
  border: 1px solid #c39994;
  border-radius: 4px;
  cursor: pointer;
  min-height: 30px;
}

#uml-pg-props-delete:hover {
  background: #fbe9e7;
  border-color: #842622;
}

#uml-pg-props-delete:focus-visible {
  outline: 3px solid #842622;
  outline-offset: 2px;
}

#uml-pg-props-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.uml-pg-prop-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.uml-pg-prop-row > label {
  font-size: 0.92em;
  font-weight: 600;
  color: #26415f;
}

.uml-pg-prop-row input[type="text"],
.uml-pg-prop-row select,
.uml-pg-prop-row textarea {
  font: inherit;
  font-size: 0.95em;
  padding: 5px 7px;
  border: 1px solid #97afca;
  border-radius: 4px;
  background: #fff;
  color: #1a1a2e;
  min-height: 30px;
  width: 100%;
  box-sizing: border-box;
}

.uml-pg-prop-row textarea {
  font-family: 'Cascadia Code', 'Fira Mono', 'Menlo', 'Consolas', monospace;
  resize: vertical;
  min-height: 80px;
}

.uml-pg-prop-row input[type="text"]:focus-visible,
.uml-pg-prop-row select:focus-visible,
.uml-pg-prop-row textarea:focus-visible {
  outline: 3px solid #2774AE;
  outline-offset: 1px;
  border-color: #2774AE;
}

.uml-pg-prop-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.95em;
  color: #1a3656;
  cursor: pointer;
}

.uml-pg-prop-checkbox input {
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
  accent-color: #2774AE;
}

.uml-pg-prop-fieldset {
  border: 1px solid #c8d4e8;
  border-radius: 5px;
  padding: 8px 10px 10px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #fff;
}

.uml-pg-prop-fieldset > legend {
  font-size: 0.92em;
  font-weight: 700;
  color: #1a3656;
  padding: 0 4px;
}

.uml-pg-member-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.uml-pg-member {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 6px;
  align-items: center;
  padding: 4px 6px;
  background: #f6f9fd;
  border: 1px solid #d3e0f0;
  border-radius: 4px;
}

.uml-pg-member > input[type="text"] {
  font: inherit;
  font-size: 0.92em;
  padding: 3px 6px;
  border: 1px solid #b6c5dc;
  border-radius: 3px;
  background: #fff;
  color: #1a1a2e;
  min-height: 28px;
  width: 100%;
  box-sizing: border-box;
}

.uml-pg-member > input[type="text"]:focus-visible {
  outline: 2px solid #2774AE;
  outline-offset: 1px;
}

.uml-pg-member-vis {
  font: inherit;
  font-size: 0.92em;
  padding: 3px 4px;
  border: 1px solid #b6c5dc;
  border-radius: 3px;
  background: #fff;
  min-height: 28px;
}

.uml-pg-member-remove {
  font: inherit;
  font-size: 0.92em;
  background: #fff;
  color: #842622;
  border: 1px solid #c39994;
  border-radius: 3px;
  padding: 3px 8px;
  min-height: 28px;
  cursor: pointer;
}

.uml-pg-member-remove:hover {
  background: #fbe9e7;
  border-color: #842622;
}

.uml-pg-member-remove:focus-visible {
  outline: 2px solid #842622;
  outline-offset: 1px;
}

.uml-pg-member-flags {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 0.88em;
  color: #2c3f57;
  margin-top: 2px;
}

.uml-pg-member-flags label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.uml-pg-member-flags input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: #2774AE;
}

.uml-pg-add-member {
  font: inherit;
  font-size: 0.92em;
  padding: 5px 10px;
  background: #fff;
  color: #1a3656;
  border: 1px dashed #6e89ad;
  border-radius: 4px;
  cursor: pointer;
  align-self: flex-start;
  min-height: 30px;
}

.uml-pg-add-member:hover {
  background: #eef4fb;
  border-style: solid;
  border-color: #2774AE;
}

.uml-pg-add-member:focus-visible {
  outline: 2px solid #2774AE;
  outline-offset: 1px;
}

.uml-pg-prop-hint {
  font-size: 0.86em;
  color: #46627e;
  font-style: italic;
}

/* Dark-mode parity */
html.dark-mode #uml-pg-palette {
  background: #18242f;
  border-color: #3a4a60;
}

html.dark-mode .uml-pg-palette-label,
html.dark-mode #uml-pg-tool-status,
html.dark-mode #uml-pg-props-title {
  color: #e3eef9;
}

html.dark-mode .uml-pg-tool-btn {
  background: #243347;
  color: #e3eef9;
  border-color: #5a7392;
}

html.dark-mode .uml-pg-tool-btn:hover {
  background: #2c3f57;
  border-color: #7cc4ff;
}

html.dark-mode .uml-pg-tool-btn:focus-visible {
  outline-color: #FFD100;
  box-shadow: 0 0 0 1px #000 inset;
}

html.dark-mode .uml-pg-tool-btn[aria-pressed="true"] {
  background: #1d4a73;
  color: #fff;
  border-color: #7cc4ff;
  box-shadow: inset 0 0 0 2px #7cc4ff;
}

html.dark-mode #uml-pg-tool-cancel {
  background: #243347;
  color: #e3eef9;
  border-color: #5a7392;
}

html.dark-mode #uml-pg-tool-cancel:hover {
  background: #4a1d20;
  border-color: #ff8a85;
  color: #ffd6d1;
}

html.dark-mode #uml-pg-tool-status.is-active {
  color: #7cc4ff;
}

html.dark-mode #uml-pg-props-pane {
  background: #18242f;
  border-color: #3a4a60;
}

html.dark-mode .uml-pg-prop-row > label,
html.dark-mode .uml-pg-prop-checkbox,
html.dark-mode .uml-pg-prop-fieldset > legend,
html.dark-mode .uml-pg-prop-hint,
html.dark-mode .uml-pg-member-flags {
  color: #c4d6e8;
}

html.dark-mode .uml-pg-prop-row input[type="text"],
html.dark-mode .uml-pg-prop-row select,
html.dark-mode .uml-pg-prop-row textarea,
html.dark-mode .uml-pg-member > input[type="text"],
html.dark-mode .uml-pg-member-vis {
  background: #1f2c3c;
  color: #e3eef9;
  border-color: #5a7392;
}

html.dark-mode .uml-pg-prop-row input[type="text"]:focus-visible,
html.dark-mode .uml-pg-prop-row select:focus-visible,
html.dark-mode .uml-pg-prop-row textarea:focus-visible {
  outline-color: #FFD100;
  border-color: #7cc4ff;
}

html.dark-mode .uml-pg-prop-fieldset {
  background: #1f2c3c;
  border-color: #3a4a60;
}

html.dark-mode .uml-pg-member {
  background: #243347;
  border-color: #3a4a60;
}

html.dark-mode #uml-pg-props-delete,
html.dark-mode .uml-pg-member-remove {
  background: #2c1d20;
  color: #ffd6d1;
  border-color: #a55d59;
}

html.dark-mode #uml-pg-props-delete:hover,
html.dark-mode .uml-pg-member-remove:hover {
  background: #4a1d20;
  border-color: #ff8a85;
}

html.dark-mode #uml-pg-props-delete:focus-visible,
html.dark-mode .uml-pg-member-remove:focus-visible {
  outline-color: #FFD100;
}

html.dark-mode .uml-pg-add-member {
  background: #243347;
  color: #e3eef9;
  border-color: #6e89ad;
}

html.dark-mode .uml-pg-add-member:hover {
  background: #2c3f57;
  border-color: #7cc4ff;
}

html.dark-mode .uml-pg-edit-hitbox.is-relation-source {
  fill: rgba(195, 132, 230, 0.20);
  stroke: #c684e8;
}
</style>

<script>
(function () {
  var EXAMPLES = {
    class: [
      '@startuml',
      'abstract class Animal { +name: str; +{abstract} speak(): str }',
      'class Dog { +breed: str; +speak(): str }',
      'class Cat { +indoor: bool; +speak(): str }',
      'interface Trainable { +train(cmd: str): bool }',
      'Dog --|> Animal',
      'Cat --|> Animal',
      'Dog ..|> Trainable',
      '@enduml'
    ].join('\n'),

    sequence: [
      '@startuml',
      'actor user: User',
      'participant app: Application',
      'participant db: Database',
      'user -> app: login(username, password)',
      'activate app',
      'app -> db: queryUser(username)',
      'activate db',
      'db --> app: userData',
      'deactivate db',
      'alt [valid credentials]',
      '  app --> user: token',
      'else [invalid]',
      '  app --> user: error 401',
      'end',
      'deactivate app',
      '@enduml'
    ].join('\n'),

    state: [
      '@startuml',
      '[*] --> Idle',
      'Idle --> Processing : submit',
      'Processing --> Done : success',
      'Processing --> Error : failure',
      'Error --> Idle : retry',
      'Done --> [*]',
      '@enduml'
    ].join('\n'),

    deployment: [
      '@startuml',
      'node ClientDevice {',
      '  component WebBrowser',
      '}',
      'node WebServer {',
      '  component AppServer',
      '  component StaticFiles',
      '}',
      'node AppServer_Host {',
      '  component APIService',
      '  component AuthService',
      '}',
      'node DBServer {',
      '  component PostgreSQL',
      '}',
      'ClientDevice --> WebServer : HTTPS',
      'WebServer --> AppServer_Host : HTTP / REST',
      'AppServer_Host --> DBServer : TCP 5432',
      '@enduml'
    ].join('\n'),

    usecase: [
      '@startuml',
      'actor User',
      'actor Admin',
      '',
      'usecase "Login" as UC1',
      'usecase "Register" as UC2',
      'usecase "Reset Password" as UC3',
      'usecase "Manage Users" as UC4',
      '',
      'rectangle "Auth System" {',
      '  UC1',
      '  UC2',
      '  UC3',
      '  UC4',
      '}',
      '',
      'User -- UC1',
      'User -- UC2',
      'User -- UC3',
      'Admin -- UC1',
      'Admin -- UC4',
      'UC1 ..> UC3 : <<extend>>',
      'UC2 ..> UC1 : <<include>>',
      '@enduml'
    ].join('\n'),

    activity: [
      '@startuml',
      '(*) --> "Receive Order"',
      '"Receive Order" --> "Validate Payment"',
      'if "Payment Valid?" then',
      '  --> [yes] "Process Order"',
      'else',
      '  --> [no] "Reject Order"',
      'endif',
      '"Process Order" --> "Ship Order"',
      '"Ship Order" --> (*)',
      '"Reject Order" --> (*)',
      '@enduml'
    ].join('\n'),

    component: [
      '@startuml',
      'component Frontend {',
      '  portout "httpOut" as f_out',
      '}',
      'component Backend {',
      '  portin "httpIn" as b_in',
      '  portout "dbOut" as b_dbout',
      '  portout "eventOut" as b_eventout',
      '}',
      'component Database {',
      '  portin "dbIn" as db_in',
      '}',
      'component EventBus {',
      '  portin "eventIn" as eb_in',
      '}',
      'f_out --> b_in : REST / JSON',
      'b_dbout --> db_in : SQL',
      'b_eventout --> eb_in : publish',
      '@enduml'
    ].join('\n'),

    gitgraph: [
      '@startuml',
      'branch main:',
      '  A "Initial commit"',
      '  B "Add README"',
      '  C "Release 1.0"',
      '  D "Add logging support"',
      '  E merge feature/parser "Merge feature/parser"',
      '',
      'branch feature/parser from C:',
      '  F "Add tokenizer"',
      '  G "Add error recovery"',
      '  H "Wire parser into build"',
      '',
      'branch experiment from C:',
      '  I "Add experimental optimization"',
      '  J "Try aggressive inlining"',
      '',
      'head main',
      '@enduml'
    ].join('\n'),

    venn: [
      '@startuml',
      'title Web Technologies',
      '',
      'set Frontend',
      'set Backend',
      'set Database',
      '',
      'Frontend                      : React, Vue',
      'Backend                       : Django, Rails',
      'Database                      : PostgreSQL, Redis',
      'Frontend & Backend            : Next.js, SvelteKit',
      'Backend & Database            : Prisma, SQLAlchemy',
      'Frontend & Database           : PouchDB',
      'Frontend & Backend & Database : Firebase, Supabase',
      'outside                       : Docker',
      '@enduml'
    ].join('\n'),

    er: [
      '@startuml',
      'title Library System',
      '',
      'entity Student {',
      '  # student_id',
      '  name',
      '  email',
      '  / age',
      '  * phones',
      '}',
      '',
      'entity Book {',
      '  # isbn',
      '  title',
      '  * authors',
      '}',
      '',
      'relationship Borrows {',
      '  date_out',
      '  date_due',
      '}',
      '',
      'Student "N" -- Borrows',
      'Book "M" -- Borrows',
      '@enduml'
    ].join('\n'),
  };

  var RENDERERS = {
    class: function (container, text) { window.UMLClassDiagram.render(container, text); },
    sequence: function (container, text) { window.UMLSequenceDiagram.render(container, text); },
    state: function (container, text) { window.UMLStateDiagram.render(container, text); },
    component: function (container, text) { window.UMLComponentDiagram.render(container, text); },
    deployment: function (container, text) { window.UMLDeploymentDiagram.render(container, text); },
    usecase: function (container, text) { window.UMLUseCaseDiagram.render(container, text); },
    activity: function (container, text) { window.UMLActivityDiagram.render(container, text); },
    gitgraph: function (container, text) {
      var pre = document.createElement('pre');
      var code = document.createElement('code');
      code.className = 'diagram-gitgraph';
      code.textContent = text;
      pre.appendChild(code);
      container.appendChild(pre);
      if (window.UMLShared && window.UMLShared.renderAll) {
        window.UMLShared.renderAll();
      }
    },
    venn: function (container, text) { window.UMLVennDiagram.render(container, text); },
    er: function (container, text) { window.UMLERDiagram.render(container, text); },
  };

  // ─── Element + relation schemas ───
  // Each element schema: id (palette key), label (visible), glyph (icon), base (default name),
  //   build(id, opts) → ArchUML line, supports flags for the properties panel.
  // Each relation schema: id, label, glyph, op (the connector), supports flags.
  // Note schema is shared across diagrams that support `note as id "text"`.
  var NOTE_SCHEMA = { id: 'note', label: 'Note', glyph: '✎', base: 'N', keyword: 'note', supports: { displayLabel: true }, isNote: true };

  var ELEMENT_SCHEMAS = {
    class: [
      { id: 'class',     label: 'Class',     glyph: '▢', base: 'Class',     keyword: 'class',          supports: { stereotype: true, members: true, abstract: true, highlight: true } },
      { id: 'abstract',  label: 'Abstract',  glyph: '■', base: 'Abstract',  keyword: 'abstract class', supports: { stereotype: true, members: true, highlight: true } },
      { id: 'interface', label: 'Interface', glyph: '○', base: 'IFace',     keyword: 'interface',      supports: { stereotype: true, members: true, highlight: true } },
      { id: 'enum',      label: 'Enum',      glyph: '≡', base: 'Enum',      keyword: 'enum',           supports: { stereotype: true, enumValues: true, highlight: true } },
      NOTE_SCHEMA
    ],
    sequence: [
      { id: 'actor',       label: 'Actor',       glyph: '☺', base: 'actor',  keyword: 'actor',       supports: { displayLabel: true, highlight: true } },
      { id: 'participant', label: 'Participant', glyph: '▭', base: 'p',      keyword: 'participant', supports: { displayLabel: true, highlight: true } },
      { id: 'alt',   label: 'alt fragment',   glyph: '⌥', base: 'alt',   keyword: 'alt',   supports: {}, sequenceFragment: 'alt' },
      { id: 'opt',   label: 'opt fragment',   glyph: '?', base: 'opt',   keyword: 'opt',   supports: {}, sequenceFragment: 'opt' },
      { id: 'loop',  label: 'loop fragment',  glyph: '↻', base: 'loop',  keyword: 'loop',  supports: {}, sequenceFragment: 'loop' },
      { id: 'par',   label: 'par fragment',   glyph: '∥', base: 'par',   keyword: 'par',   supports: {}, sequenceFragment: 'par' },
      { id: 'break', label: 'break fragment', glyph: '⊗', base: 'break', keyword: 'break', supports: {}, sequenceFragment: 'break' },
      NOTE_SCHEMA
    ],
    state: [
      { id: 'state',     label: 'State',          glyph: '▢', base: 'State',  keyword: 'state', supports: { stereotype: true, highlight: true, subStates: true } },
      { id: 'composite', label: 'Composite',      glyph: '⊞', base: 'Group',  keyword: 'state', supports: { stereotype: true, highlight: true, subStates: true }, isComposite: true },
      { id: 'choice',    label: 'Choice <>',      glyph: '⬢', base: 'Choice', keyword: 'state', supports: {}, fixedStereotype: '<<choice>>' },
      { id: 'initial', label: 'Initial ●', glyph: '●', base: '__init', keyword: '',     supports: {}, pseudo: 'initial' },
      { id: 'final',   label: 'Final ◉',   glyph: '◉', base: '__final',keyword: '',     supports: {}, pseudo: 'final' },
      NOTE_SCHEMA
    ],
    component: [
      { id: 'component', label: 'Component', glyph: '▢', base: 'Component', keyword: 'component', supports: { stereotype: true, dashed: true, ports: true, highlight: true } },
      { id: 'portin',    label: 'Port In',   glyph: '▶', base: 'in',  keyword: 'port',    supports: { displayLabel: true }, isPort: true,      portKind: 'portin' },
      { id: 'portout',   label: 'Port Out',  glyph: '◀', base: 'out', keyword: 'port',    supports: { displayLabel: true }, isPort: true,      portKind: 'portout' },
      { id: 'provide',   label: 'Provided I/F', glyph: '○', base: 'p_iface', keyword: 'provide', supports: { displayLabel: true }, isInterface: true, interfaceKind: 'provide' },
      { id: 'require',   label: 'Required I/F', glyph: '⊃', base: 'r_iface', keyword: 'require', supports: { displayLabel: true }, isInterface: true, interfaceKind: 'require' },
      NOTE_SCHEMA
    ],
    deployment: [
      { id: 'node',      label: 'Node',      glyph: '□', base: 'Node',     keyword: 'node',      supports: { stereotype: true, highlight: true } },
      { id: 'component', label: 'Component', glyph: '▢', base: 'Component',keyword: 'component', supports: { stereotype: true, highlight: true } },
      { id: 'artifact',  label: 'Artifact',  glyph: '⧉', base: 'Artifact', keyword: 'artifact',  supports: { displayLabel: true, highlight: true } },
      NOTE_SCHEMA
    ],
    usecase: [
      { id: 'actor',     label: 'Actor',           glyph: '☺', base: 'Actor',  keyword: 'actor',     supports: { displayLabel: true, highlight: true } },
      { id: 'usecase',   label: 'Use Case',        glyph: '⬭', base: 'UC',     keyword: 'usecase',   supports: { displayLabel: true, highlight: true } },
      { id: 'system',    label: 'System Boundary', glyph: '⬚', base: 'System', keyword: 'rectangle', supports: { displayLabel: true, system: true } },
      NOTE_SCHEMA
    ],
    activity: [
      { id: 'action',   label: 'Action',          glyph: '▢', base: 'Action', keyword: 'action', supports: { displayLabel: true }, activityAction: true },
      { id: 'initial',  label: 'Initial/Final ◉', glyph: '◉', base: '*',      keyword: '(*)',    supports: {}, activityPseudo: true },
      { id: 'decision', label: 'Decision (if)',   glyph: '⬥', base: 'Cond',   keyword: 'if',     supports: { displayLabel: true }, activityDecision: true },
      { id: 'fork',     label: 'Fork/Join',       glyph: '∥', base: 'Fork',   keyword: 'fork',   supports: {}, activityFork: true },
      { id: 'lane',     label: 'Swimlane',        glyph: '|', base: 'Lane',   keyword: '||',     supports: { displayLabel: true }, activityLane: true }
    ],
    er: [
      { id: 'entity',       label: 'Entity',       glyph: '□', base: 'Entity',     keyword: 'entity',                   supports: { erAttributes: true, highlight: true } },
      { id: 'weak',         label: 'Weak Entity',  glyph: '⧈', base: 'Weak',       keyword: 'weak entity',              supports: { erAttributes: true, highlight: true } },
      { id: 'relationship', label: 'Relationship', glyph: '◈', base: 'Rel',        keyword: 'relationship',             supports: { erAttributes: true, highlight: true } },
      { id: 'idrel',        label: 'ID Relation',  glyph: '⧖', base: 'IDRel',      keyword: 'identifying relationship', supports: { erAttributes: true, highlight: true } }
    ]
  };

  var RELATION_SCHEMAS = {
    class: [
      { id: 'gen',       label: 'Inherits',     glyph: '▷', op: '--|>', supports: { label: true } },
      { id: 'real',      label: 'Realizes',     glyph: '▷', op: '..|>', supports: { label: true }, dashed: true },
      { id: 'compose',   label: 'Composition',  glyph: '◆', op: '*--',  supports: { label: true, multiplicity: true, navigability: true } },
      { id: 'aggregate', label: 'Aggregation',  glyph: '◇', op: 'o--',  supports: { label: true, multiplicity: true, navigability: true } },
      { id: 'assoc',     label: 'Association',  glyph: '→', op: '-->',  supports: { label: true, multiplicity: true } },
      { id: 'biassoc',   label: 'Bidirect.',    glyph: '↔', op: '<-->', supports: { label: true, multiplicity: true } },
      { id: 'plain',     label: 'Plain Line',   glyph: '─', op: '--',   supports: { label: true, multiplicity: true } },
      { id: 'depend',    label: 'Dependency',   glyph: '⇢', op: '..>',  supports: { label: true, stereotype: true } }
    ],
    sequence: [
      { id: 'sync',   label: 'Sync Call',  glyph: '→', op: '->',  supports: { label: true }, defaultLabel: 'message()' },
      { id: 'async',  label: 'Async',      glyph: '↠', op: '->>', supports: { label: true }, defaultLabel: 'event()' },
      { id: 'return', label: 'Return',     glyph: '⇢', op: '-->', supports: { label: true }, defaultLabel: 'response' }
    ],
    state: [
      { id: 'transition', label: 'Transition', glyph: '→', op: '-->', supports: { label: true } }
    ],
    component: [
      { id: 'arrow',  label: 'Connector',  glyph: '→', op: '-->', supports: { label: true } },
      { id: 'plain',  label: 'Plain Line', glyph: '─', op: '--',  supports: { label: true } },
      { id: 'depend', label: 'Dependency', glyph: '⇢', op: '..>', supports: { label: true } }
    ],
    deployment: [
      { id: 'arrow',  label: 'Connector',  glyph: '→', op: '-->', supports: { label: true } },
      { id: 'plain',  label: 'Plain Line', glyph: '─', op: '--',  supports: { label: true } },
      { id: 'depend', label: 'Dependency', glyph: '⇢', op: '..>', supports: { label: true } }
    ],
    usecase: [
      { id: 'plain',   label: 'Association',  glyph: '─', op: '--',  supports: { label: true } },
      { id: 'arrow',   label: 'Directed',     glyph: '→', op: '-->', supports: { label: true } },
      { id: 'include', label: 'include',      glyph: '«', op: '..>', stereotype: '<<include>>' },
      { id: 'extend',  label: 'extend',       glyph: '«', op: '..>', stereotype: '<<extend>>' },
      { id: 'gen',     label: 'Generalize',   glyph: '▷', op: '--|>' }
    ],
    activity: [
      { id: 'flow', label: 'Flow', glyph: '→', op: '-->', supports: { label: true } }
    ],
    er: [
      { id: 'plain', label: 'Connection',     glyph: '─', op: '--', supports: { erCardinality: true } },
      { id: 'total', label: 'Total Particip.', glyph: '═', op: '==', supports: { erCardinality: true } }
    ]
  };

  function diagramSupportsCreation(type) {
    return Object.prototype.hasOwnProperty.call(ELEMENT_SCHEMAS, type);
  }

  function init() {
    var typeSelect = document.getElementById('uml-pg-type');
    var layoutSelect = document.getElementById('uml-pg-layout');
    var layoutLabel = document.getElementById('uml-pg-layout-label');
    var textarea = document.getElementById('uml-pg-input');
    var output = document.getElementById('uml-pg-output');
    var errorBox = document.getElementById('uml-pg-error');
    var downloadBtn = document.getElementById('uml-pg-download');
    var editToggle = document.getElementById('uml-pg-edit');
    var snapToggle = document.getElementById('uml-pg-snap');
    var resetOneBtn = document.getElementById('uml-pg-reset-one');
    var resetLayoutBtn = document.getElementById('uml-pg-reset-layout');
    var copySourceBtn = document.getElementById('uml-pg-copy-source');
    var status = document.getElementById('uml-pg-status');
    palette = document.getElementById('uml-pg-palette');
    paletteEls = document.getElementById('uml-pg-palette-elements');
    paletteRels = document.getElementById('uml-pg-palette-relations');
    toolStatus = document.getElementById('uml-pg-tool-status');
    toolCancel = document.getElementById('uml-pg-tool-cancel');
    propsPane = document.getElementById('uml-pg-props-pane');
    propsContent = document.getElementById('uml-pg-props-content');
    propsTitle = document.getElementById('uml-pg-props-title');
    propsDelete = document.getElementById('uml-pg-props-delete');

    if (!typeSelect || !layoutSelect || !textarea || !output) return;

    // aria-live for tool status messages so screen readers hear feedback.
    if (toolStatus) {
      toolStatus.setAttribute('role', 'status');
      toolStatus.setAttribute('aria-live', 'polite');
      toolStatus.setAttribute('aria-atomic', 'true');
    }
    if (status) {
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
    }
    if (propsPane) {
      propsPane.setAttribute('role', 'region');
      propsPane.setAttribute('aria-live', 'polite');
    }

    var debounceTimer = null;
    var currentType = typeSelect.value;
    var selectedLayoutId = null;
    var selectedLayoutKind = null;
    // Multi-select: keys = ids, values = 'node' | 'route'. Single-select scalars
    // above remain the "primary" (most recent click) for the props panel.
    var selectedLayoutIds = Object.create(null);
    function selectionSize() { return Object.keys(selectedLayoutIds).length; }
    function clearSelectionSet() {
      for (var k in selectedLayoutIds) delete selectedLayoutIds[k];
    }
    var dragState = null;

    function normalizeLineEndings(text) {
      return (text || '').replace(/\r\n?/g, '\n');
    }

    function normalizeLayoutMode(mode) {
      var value = (mode || '').toLowerCase();
      if (value === 'square' || value === 'landscape' || value === 'portrait' || value === 'auto') return value;
      return null;
    }

    function applyLayoutDirective(text, layoutMode) {
      var normalizedText = normalizeLineEndings(text);
      var lines = normalizedText.split('\n');
      var filtered = [];
      for (var i = 0; i < lines.length; i++) {
        if (/^\s*layout\s+.+$/i.test(lines[i].trim())) continue;
        filtered.push(lines[i]);
      }

      var mode = normalizeLayoutMode(layoutMode);
      if (!mode) return filtered.join('\n');

      var insertAt = 0;
      while (insertAt < filtered.length && !filtered[insertAt].trim()) insertAt++;
      if (insertAt < filtered.length && filtered[insertAt].trim() === '@startuml') insertAt++;
      filtered.splice(insertAt, 0, 'layout ' + mode);
      return filtered.join('\n');
    }

    function stripLayoutMetadata(text) {
      var lines = normalizeLineEndings(text).split('\n');
      var out = [];
      var inLayout = false;
      for (var i = 0; i < lines.length; i++) {
        var raw = lines[i];
        var trimmed = raw.trim();
        if (/^@layout\b/i.test(trimmed)) { inLayout = true; continue; }
        if (/^@endlayout\b/i.test(trimmed)) { inLayout = false; continue; }
        if (inLayout) continue;
        out.push(raw.replace(/\s+@pos\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)/i, ''));
      }
      return out.join('\n');
    }

    function unquoteId(text) {
      return String(text || '').trim().replace(/^"((?:[^"\\]|\\.)*)"$/, '$1').replace(/\\"/g, '"');
    }

    function addElement(list, seen, id, label, axis) {
      id = unquoteId(id);
      label = unquoteId(label || id);
      if (!id || seen[id]) return;
      seen[id] = true;
      list.push({ id: id, label: label, axis: axis || 'xy' });
    }

    function sequenceDisplay(id, label) {
      id = unquoteId(id);
      label = unquoteId(label || id);
      if (label.charAt(0) === ':') return label.replace(/^:\s*/, ': ');
      return id !== label ? id + ': ' + label : label;
    }

    function parseComponentPortLine(line) {
      var m = String(line || '').trim().match(/^(portin|portout|port|provide|require)\s+"([^"]+)"(?:\s+as\s+(\S+))?/i) ||
        String(line || '').trim().match(/^(portin|portout|port|provide|require)\s+(\S+?)(?:\s+as\s+(\S+))?(?:\s+dashed)?$/i);
      if (!m) return null;
      return { label: m[2], alias: m[3] || m[2] };
    }

    function collectModelElements(text, type) {
      var lines = stripLayoutMetadata(text).split('\n');
      var elements = [];
      var seen = {};
      var componentContext = null;

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line === '@startuml' || line === '@enduml' || /^layout\s+/i.test(line)) continue;
        if (type === 'component' && line === '}') {
          componentContext = null;
          continue;
        }
        var m;

        if (type === 'class') {
          m = line.match(/^(?:abstract\s+class|class|interface|enum)\s+("[^"]+"|\S+)(?:\s+as\s+(\S+))?/i);
          if (m) addElement(elements, seen, m[2] || m[1], m[1]);
        } else if (type === 'sequence') {
          m = line.match(/^(participant|actor)\s+(.+)$/i);
          if (m) {
            var decl = m[2].replace(/\s*\{.*$/, '').trim();
            var asIdx = decl.indexOf(' as ');
            var colonIdx = decl.indexOf(':');
            var id, label;
            if (asIdx !== -1) {
              id = decl.substring(0, asIdx).trim();
              label = decl.substring(asIdx + 4).trim();
            } else if (colonIdx !== -1) {
              id = decl.substring(0, colonIdx).trim();
              label = decl.substring(colonIdx + 1).trim();
            } else {
              id = decl;
              label = decl;
            }
            addElement(elements, seen, id, sequenceDisplay(id, label), 'x');
          }
          m = line.match(/^(\S+)\s*(?:[-.]+[>x]|<[-.]+)\s*(\S+)/);
          if (m) {
            addElement(elements, seen, m[1], m[1], 'x');
            addElement(elements, seen, m[2].replace(/:.*$/, ''), m[2].replace(/:.*$/, ''), 'x');
          }
          m = line.match(/^(?:activate|deactivate|destroy|create(?:\s+participant)?)\s+(\S+)/i);
          if (m) addElement(elements, seen, m[1], m[1], 'x');
        } else if (type === 'state') {
          m = line.match(/^state\s+("[^"]+"|\S+)/i);
          if (m) addElement(elements, seen, m[1], m[1]);
          m = line.match(/^(\S+)\s+[-.]+>+\s+(\S+)/);
          if (m) {
            if (m[1] !== '[*]') addElement(elements, seen, m[1], m[1]);
            if (m[2] !== '[*]') addElement(elements, seen, m[2], m[2]);
          }
        } else if (type === 'component') {
          m = line.match(/^component\s+("[^"]+"|\S+)(?:\s+as\s+(\S+))?/i);
          if (m) {
            var componentId = m[2] || unquoteId(m[1]).replace(/^\[|\]$/g, '');
            addElement(elements, seen, componentId, m[1]);
            if (line.indexOf('{') !== -1) {
              componentContext = componentId;
              var inlineBody = line.match(/\{([^}]*)\}/);
              if (inlineBody) {
                var portRe = /(portin|portout|port|provide|require)\s+(?:"([^"]+)"|(\S+?))(?:\s+as\s+(\S+))?(?=\s+(?:portin|portout|port|provide|require)\b|\s*$)/ig;
                var pm;
                while ((pm = portRe.exec(inlineBody[1])) !== null) {
                  var inlinePortLabel = pm[2] || pm[3];
                  var inlinePortAlias = pm[4] || inlinePortLabel;
                  addElement(elements, seen, componentId + '.' + inlinePortAlias, inlinePortLabel, 'port');
                }
                componentContext = null;
              }
            }
            continue;
          }
          if (componentContext) {
            var port = parseComponentPortLine(line);
            if (port) addElement(elements, seen, componentContext + '.' + port.alias, port.label, 'port');
          }
        } else if (type === 'deployment') {
          m = line.match(/^node\s+("[^"]+"|\S+)(?:\s+as\s+(\S+))?/i);
          if (m) addElement(elements, seen, m[2] || m[1], m[1]);
        } else if (type === 'usecase') {
          m = line.match(/^actor\s+("[^"]+"|\S+)/i);
          if (m) addElement(elements, seen, m[1], m[1]);
          m = line.match(/^usecase\s+("[^"]+"|\S+)(?:\s+as\s+(\S+))?/i);
          if (m) addElement(elements, seen, m[2] || m[1], m[1]);
        } else if (type === 'activity') {
          // A line like `"Receive Order" --> "Validate Payment"` declares two
          // movable activity nodes. Capture every quoted token, not just the
          // first — otherwise nodes that only appear as the target of a
          // transition (e.g. `"Validate Payment"` above, which never appears
          // again as the start of another transition) silently lose their
          // movable handle.
          var quotedRe = /"([^"]+)"/g;
          var quotedMatch;
          while ((quotedMatch = quotedRe.exec(line)) !== null) {
            addElement(elements, seen, quotedMatch[1], quotedMatch[1]);
          }
        } else if (type === 'freeform') {
          m = line.match(/^box(?:\s+[a-z]+)?\s+"((?:[^"\\]|\\.)*)"\s+as\s+(\S+)/i);
          if (m) addElement(elements, seen, m[2], m[1].replace(/\\n/g, '\n'));
        } else if (type === 'gitgraph') {
          m = line.match(/^branch\s+([^:\s]+)(?:\s+(?:from|at)\s+\S+)?\s*:?\s*$/i);
          if (m) {
            addElement(elements, seen, 'branch:' + m[1], m[1], 'branch-label');
            continue;
          }
          m = line.match(/^\s*(\S+)(?:\s+merge\s+\S+)?(?:\s+"((?:[^"\\]|\\.)*)")?\s*$/i);
          if (m && !/^(branch|head|@startuml|@enduml)\b/i.test(m[1])) addElement(elements, seen, m[1], m[1]);
        } else if (type === 'venn') {
          m = line.match(/^set\s+(.+)$/i);
          if (m) addElement(elements, seen, m[1].replace(/\s+#(?:[0-9a-fA-F]{3,8}|[A-Za-z][A-Za-z0-9]*)\s*$/, ''), m[1].replace(/\s+#(?:[0-9a-fA-F]{3,8}|[A-Za-z][A-Za-z0-9]*)\s*$/, ''));
        } else if (type === 'er') {
          m = line.match(/^(entity|relationship)\s+("[^"]+"|\S+)/i);
          if (m) addElement(elements, seen, m[2], m[2]);
        }
      }
      return elements;
    }

    function insertPos(line, pos) {
      var suffix = ' @pos(' + Math.round(pos.x) + ', ' + Math.round(pos.y || 0) + ')';
      var brace = line.match(/(\s*\{.*)$/);
      if (brace) return line.slice(0, -brace[1].length) + suffix + brace[1];
      return line + suffix;
    }

    function cloneRoutes(routes) {
      var copy = {};
      Object.keys(routes || {}).forEach(function (id) {
        var route = routes[id];
        if (!route || !route.points || route.points.length < 2) return;
        copy[id] = {
          points: route.points.map(function (p) { return { x: Number(p.x), y: Number(p.y) }; })
        };
      });
      return copy;
    }

    function clonePositions(positions) {
      var copy = {};
      Object.keys(positions || {}).forEach(function (id) {
        var pos = positions[id];
        if (!pos || pos.x === undefined || pos.y === undefined) return;
        copy[id] = { x: Number(pos.x), y: Number(pos.y) };
      });
      return copy;
    }

    function readLayoutPositions(text) {
      if (!window.UMLShared || !window.UMLShared.extractLayoutMetadata) return {};
      return clonePositions(window.UMLShared.extractLayoutMetadata(text).layout.positions);
    }

    function readLayoutRoutes(text) {
      if (!window.UMLShared || !window.UMLShared.extractLayoutMetadata) return {};
      return cloneRoutes(window.UMLShared.extractLayoutMetadata(text).layout.routes);
    }

    function routePointsToString(points) {
      if (window.UMLShared && window.UMLShared.layoutRoutePointsToString) {
        return window.UMLShared.layoutRoutePointsToString(points);
      }
      return (points || []).map(function (p) {
        return Math.round(p.x) + ',' + Math.round(p.y);
      }).join(' ');
    }

    function appendLayoutBlock(out, positions, routes) {
      var block = [];
      Object.keys(positions || {}).forEach(function (id) {
        var p = positions[id];
        block.push('node "' + id.replace(/"/g, '\\"') + '" x=' + Math.round(p.x) + ' y=' + Math.round(p.y || 0));
      });
      Object.keys(routes || {}).forEach(function (id) {
        var route = routes[id];
        if (!route || !route.points || route.points.length < 2) return;
        block.push('edge "' + id.replace(/"/g, '\\"') + '" points="' + routePointsToString(route.points) + '"');
      });
      if (!block.length) return;

      var insertAt = 0;
      while (insertAt < out.length && !out[insertAt].trim()) insertAt++;
      if (out[insertAt] && out[insertAt].trim() === '@startuml') insertAt++;
      out.splice.apply(out, [insertAt, 0].concat(['@layout schema=1 renderer="archuml-visual-editor"'], block, ['@endlayout']));
    }

    function declarationIdForLine(line, type) {
      var clean = line.trim();
      var m;
      if (type === 'class') {
        m = clean.match(/^(?:abstract\s+class|class|interface|enum)\s+("[^"]+"|\S+)(?:\s+as\s+(\S+))?/i);
        return m ? unquoteId(m[2] || m[1]) : null;
      }
      if (type === 'sequence') {
        m = clean.match(/^(participant|actor)\s+(.+)$/i);
        if (!m) return null;
        var decl = m[2].trim();
        var asIdx = decl.indexOf(' as ');
        var colonIdx = decl.indexOf(':');
        return unquoteId(asIdx !== -1 ? decl.substring(0, asIdx) : (colonIdx !== -1 ? decl.substring(0, colonIdx) : decl));
      }
      if (type === 'state') {
        m = clean.match(/^state\s+("[^"]+"|\S+)/i);
        return m ? unquoteId(m[1]) : null;
      }
      if (type === 'component') {
        m = clean.match(/^component\s+("[^"]+"|\S+)(?:\s+as\s+(\S+))?/i);
        return m ? unquoteId(m[2] || m[1]) : null;
      }
      if (type === 'deployment') {
        m = clean.match(/^node\s+("[^"]+"|\S+)(?:\s+as\s+(\S+))?/i);
        return m ? unquoteId(m[2] || m[1]) : null;
      }
      if (type === 'usecase') {
        m = clean.match(/^actor\s+("[^"]+"|\S+)/i);
        if (m) return unquoteId(m[1]);
        m = clean.match(/^usecase\s+("[^"]+"|\S+)(?:\s+as\s+(\S+))?/i);
        return m ? unquoteId(m[2] || m[1]) : null;
      }
      if (type === 'freeform') {
        m = clean.match(/^box(?:\s+[a-z]+)?\s+"(?:[^"\\]|\\.)*"\s+as\s+(\S+)/i);
        return m ? unquoteId(m[1]) : null;
      }
      if (type === 'er') {
        m = clean.match(/^(entity|relationship)\s+("[^"]+"|\S+)/i);
        return m ? unquoteId(m[2]) : null;
      }
      if (type === 'gitgraph') {
        m = clean.match(/^\s*(\S+)(?:\s+merge\s+\S+|\s+"(?:[^"\\]|\\.)*"|\s*)$/);
        return m && !/^(branch|head|@startuml|@enduml)\b/i.test(m[1]) ? unquoteId(m[1]) : null;
      }
      if (type === 'venn') {
        m = clean.match(/^set\s+(.+)$/i);
        return m ? unquoteId(m[1].replace(/\s+#(?:[0-9a-fA-F]{3,8}|[A-Za-z][A-Za-z0-9]*)\s*$/, '')) : null;
      }
      return null;
    }

    function writePositionsIntoSource(text, type, positions, routeOverrides) {
      var routes = routeOverrides || readLayoutRoutes(text);
      var lines = stripLayoutMetadata(text).split('\n');
      var remaining = {};
      Object.keys(positions || {}).forEach(function (id) { remaining[id] = positions[id]; });
      var out = [];

      for (var i = 0; i < lines.length; i++) {
        var id = declarationIdForLine(lines[i], type);
        if (id && remaining[id]) {
          out.push(insertPos(lines[i], remaining[id]));
          delete remaining[id];
        } else {
          out.push(lines[i]);
        }
      }

      var leftover = Object.keys(remaining);
      var blockPositions = {};
      leftover.forEach(function (id) { blockPositions[id] = remaining[id]; });
      appendLayoutBlock(out, blockPositions, routes);

      return out.join('\n');
    }

    function isGitgraph(type) {
      return (type || typeSelect.value) === 'gitgraph';
    }

    function ignoresLayout(type) {
      var t = type || typeSelect.value;
      return t === 'gitgraph' || t === 'venn';
    }

    function updateLayoutVisibility() {
      var hide = ignoresLayout();
      if (layoutLabel) layoutLabel.style.display = hide ? 'none' : '';
      layoutSelect.style.display = hide ? 'none' : '';
    }

    function exampleText(type, layoutMode) {
      if (ignoresLayout(type)) return EXAMPLES[type] || '';
      return applyLayoutDirective(EXAMPLES[type] || '', layoutMode);
    }

    function svgPoint(svg, clientX, clientY) {
      var pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      var ctm = svg.getScreenCTM();
      return ctm ? pt.matrixTransform(ctm.inverse()) : { x: clientX, y: clientY };
    }

    function clientRectToSvgBox(svg, rect) {
      var p1 = svgPoint(svg, rect.left, rect.top);
      var p2 = svgPoint(svg, rect.right, rect.bottom);
      var x = Math.min(p1.x, p2.x);
      var y = Math.min(p1.y, p2.y);
      return { x: x, y: y, width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y) };
    }

    function cssTranslateOffset(svg, el) {
      var dx = 0;
      var dy = 0;
      var cur = el;
      while (cur && cur !== svg && cur.nodeType === 1) {
        var styleTransform = cur.style ? (cur.style.transform || '') : '';
        styleTransform.replace(/translate\(\s*(-?\d+(?:\.\d+)?)px(?:\s*,\s*|\s+)(-?\d+(?:\.\d+)?)px\s*\)/g, function (_, x, y) {
          dx += Number(x);
          dy += Number(y);
          return '';
        });
        cur = cur.parentNode;
      }
      if (!dx && !dy) return { x: 0, y: 0 };
      var ctm = svg && svg.getScreenCTM ? svg.getScreenCTM() : null;
      return {
        x: dx / (ctm && ctm.a ? ctm.a : 1),
        y: dy / (ctm && ctm.d ? ctm.d : 1)
      };
    }

    function elementSvgBox(svg, el) {
      if (!el || !el.getBoundingClientRect) return safeBBox(el);
      var rect = el.getBoundingClientRect();
      var box = (!rect || rect.width <= 0 || rect.height <= 0) ? safeBBox(el) : clientRectToSvgBox(svg, rect);
      if (!box) return null;
      var cssOffset = cssTranslateOffset(svg, el);
      if (cssOffset.x || cssOffset.y) {
        box = { x: box.x + cssOffset.x, y: box.y + cssOffset.y, width: box.width, height: box.height };
      }
      return box;
    }

    function safeBBox(el) {
      try {
        var b = el.getBBox();
        if (!isFinite(b.x) || !isFinite(b.y) || b.width <= 0 || b.height <= 0) return null;
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      } catch (e) {
        return null;
      }
    }

    function textOf(el) {
      return (el.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function containsPoint(box, x, y, pad) {
      pad = pad || 0;
      return x >= box.x - pad && x <= box.x + box.width + pad &&
        y >= box.y - pad && y <= box.y + box.height + pad;
    }

    function containsBox(outer, inner, pad) {
      pad = pad || 0;
      return inner.x >= outer.x - pad &&
        inner.y >= outer.y - pad &&
        inner.x + inner.width <= outer.x + outer.width + pad &&
        inner.y + inner.height <= outer.y + outer.height + pad;
    }

    function unionBox(a, b) {
      var x1 = Math.min(a.x, b.x);
      var y1 = Math.min(a.y, b.y);
      var x2 = Math.max(a.x + a.width, b.x + b.width);
      var y2 = Math.max(a.y + a.height, b.y + b.height);
      return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    }

    function layoutElementsForId(svg, id) {
      id = String(id || '');
      return Array.prototype.slice.call(svg.querySelectorAll('[data-layout-id]')).filter(function (el) {
        return el.getAttribute('data-layout-id') === id && !el.closest('defs') && !el.closest('.uml-pg-edit-layer');
      });
    }

    function layoutBoundsElementsForId(svg, id) {
      id = String(id || '');
      return Array.prototype.slice.call(svg.querySelectorAll('[data-layout-bounds-id]')).filter(function (el) {
        return el.getAttribute('data-layout-bounds-id') === id && !el.closest('defs') && !el.closest('.uml-pg-edit-layer');
      });
    }

    function unionElementsBox(svg, elements) {
      var dataBox = null;
      elements.forEach(function (el) {
        var box = elementSvgBox(svg, el);
        if (box) dataBox = dataBox ? unionBox(dataBox, box) : box;
      });
      return dataBox;
    }

    function expandStackedRects(svg, box) {
      var rects = Array.prototype.slice.call(svg.querySelectorAll('rect')).map(function (r) {
        return { el: r, box: elementSvgBox(svg, r) };
      }).filter(function (r) { return r.box; });
      var expanded = box;
      var changed = true;
      while (changed) {
        changed = false;
        for (var i = 0; i < rects.length; i++) {
          var rb = rects[i].box;
          var sameColumn = Math.abs(rb.x - expanded.x) < 1.5 && Math.abs(rb.width - expanded.width) < 1.5;
          var touches = rb.y <= expanded.y + expanded.height + 1.5 && rb.y + rb.height >= expanded.y - 1.5;
          if (sameColumn && touches && !containsBox(expanded, rb, 0.5)) {
            expanded = unionBox(expanded, rb);
            changed = true;
          }
        }
      }
      return expanded;
    }

    function findRenderedBox(svg, element) {
      var dataEls = layoutElementsForId(svg, element.id);
      if (dataEls.length) {
        var bounds = layoutBoundsElementsForId(svg, element.id);
        var dataBox = unionElementsBox(svg, bounds.length ? bounds : dataEls);
        if (dataBox) return dataBox;
      }

      var labels = [element.label, element.id].filter(Boolean).map(function (s) {
        return String(s).replace(/\s+/g, ' ').trim();
      });
      var allTexts = Array.prototype.slice.call(svg.querySelectorAll('text')).filter(function (t) {
        return !t.closest('.uml-pg-edit-layer') && !t.closest('defs');
      });

      // Split candidate texts into exact and partial matches. The text-based
      // heuristic must prefer texts that are *equal* to the label over texts
      // that only contain it as a substring — otherwise an actor named
      // `User` happily latches on to a use case `"Manage Users"` (because
      // "Manage Users" contains "User"), and the resulting hitbox sits on
      // top of the wrong shape with no way to drag the actor itself.
      var exactTexts = allTexts.filter(function (t) {
        var txt = textOf(t);
        return labels.some(function (label) { return txt === label; });
      });
      var partialTexts = allTexts.filter(function (t) {
        var txt = textOf(t);
        if (labels.some(function (label) { return txt === label; })) return false;
        return labels.some(function (label) { return txt.indexOf(label) !== -1; });
      });
      if (!exactTexts.length && !partialTexts.length) return null;

      var shapes = Array.prototype.slice.call(svg.querySelectorAll('rect,circle,ellipse,polygon,path')).filter(function (el) {
        return !el.closest('.uml-pg-edit-layer') && !el.closest('defs');
      }).map(function (el) {
        return { el: el, box: elementSvgBox(svg, el) };
      }).filter(function (item) { return item.box; });

      function bestForTexts(texts) {
        var local = null;
        for (var ti = 0; ti < texts.length; ti++) {
          var tb = elementSvgBox(svg, texts[ti]);
          if (!tb) continue;
          var cx = tb.x + tb.width / 2;
          var cy = tb.y + tb.height / 2;
          var foundShape = false;
          for (var si = 0; si < shapes.length; si++) {
            var sb = shapes[si].box;
            if (!containsPoint(sb, cx, cy, 4)) continue;
            var area = sb.width * sb.height;
            if (area < Math.max(80, tb.width * tb.height * 1.2)) continue;
            // Real shape always beats a text-bounds fallback (which carries
            // area=0 and would otherwise dominate via `area < best.area`).
            if (!local || local.fallback || area < local.area) {
              local = { box: sb, area: area, fallback: false };
            }
            foundShape = true;
          }
          if (!foundShape && !local) {
            local = {
              box: { x: tb.x - 12, y: tb.y - 10, width: tb.width + 24, height: tb.height + 20 },
              area: 0,
              fallback: true
            };
          }
        }
        return local;
      }

      var best = bestForTexts(exactTexts) || bestForTexts(partialTexts);
      return best ? expandStackedRects(svg, best.box) : null;
    }

    function findEditableElements(svg) {
      if (!svg) return [];
      var models = collectModelElements(textarea.value, typeSelect.value);
      var found = [];
      for (var i = 0; i < models.length; i++) {
        if (models[i].axis === 'none') continue;
        var box = findRenderedBox(svg, models[i]);
        if (box) {
          var item = { id: models[i].id, label: models[i].label, axis: models[i].axis, box: box, parent: models[i].parent };
          if (models[i].axis === 'port') {
            item.parent = models[i].id.split('.')[0];
            item.parentBox = findRenderedBox(svg, { id: item.parent, label: item.parent });
            if (item.parentBox) {
              var pcx = box.x + box.width / 2;
              var pcy = box.y + box.height / 2;
              var sideDistances = [
                { side: 'left', distance: Math.abs(pcx - item.parentBox.x) },
                { side: 'right', distance: Math.abs(pcx - (item.parentBox.x + item.parentBox.width)) },
                { side: 'top', distance: Math.abs(pcy - item.parentBox.y) },
                { side: 'bottom', distance: Math.abs(pcy - (item.parentBox.y + item.parentBox.height)) }
              ];
              sideDistances.sort(function (a, b) { return a.distance - b.distance; });
              item.portSide = sideDistances[0].side;
            }
          }
          found.push(item);
        }
      }
      Array.prototype.slice.call(svg.querySelectorAll('[data-layout-kind="edge-label"][data-layout-id]')).forEach(function (el) {
        if (el.closest('defs') || el.closest('.uml-pg-edit-layer')) return;
        var id = el.getAttribute('data-layout-id') || '';
        if (!id) return;
        var box = unionElementsBox(svg, [el]);
        if (!box) return;
        found.push({ id: id, label: textOf(el) || id, axis: 'label', box: box });
      });
      return found;
    }

    function collectPositions(editables) {
      var positions = {};
      var existingPositions = readLayoutPositions(textarea.value);
      for (var i = 0; i < editables.length; i++) {
        var item = editables[i];
        if ((item.axis === 'branch-label' || item.axis === 'label') &&
            item.id !== selectedLayoutId && !existingPositions[item.id]) continue;
        positions[item.id] = {
          x: item.axis === 'x' || item.axis === 'port' ? item.box.x + item.box.width / 2 : item.box.x,
          y: item.axis === 'port' ? item.box.y + item.box.height / 2 : item.box.y
        };
      }
      return positions;
    }

    function withTemporaryAutoSvg(text, type, callback) {
      var renderer = RENDERERS[type];
      if (!renderer) return null;
      var host = document.createElement('div');
      host.style.position = 'absolute';
      host.style.left = '-10000px';
      host.style.top = '-10000px';
      host.style.width = output.getBoundingClientRect().width + 'px';
      host.style.visibility = 'hidden';
      document.body.appendChild(host);
      try {
        renderer(host, stripLayoutMetadata(text));
        var svg = host.querySelector('svg');
        return svg ? callback(svg) : null;
      } catch (e) {
        return null;
      } finally {
        host.remove();
      }
    }

    function autoLayoutPositions(text, type) {
      return withTemporaryAutoSvg(text, type, function (svg) {
        var models = collectModelElements(stripLayoutMetadata(text), type);
        var found = [];
        for (var i = 0; i < models.length; i++) {
          if (models[i].axis === 'none') continue;
          var box = findRenderedBox(svg, models[i]);
          if (box) found.push({ id: models[i].id, label: models[i].label, axis: models[i].axis, box: box });
        }
        return collectPositions(found);
      }) || {};
    }

    function collectMoveParts(svg, box, id) {
      var dataEls = layoutElementsForId(svg, id);
      if (dataEls.length) {
        if ((typeSelect.value || '') === 'component' && String(id).indexOf('.') === -1) {
          Array.prototype.slice.call(svg.querySelectorAll('[data-layout-id]')).forEach(function (el) {
            var childId = el.getAttribute('data-layout-id') || '';
            if (childId.indexOf(id + '.') === 0 && !el.closest('defs') && !el.closest('.uml-pg-edit-layer')) {
              dataEls.push(el);
            }
          });
        }
        if ((typeSelect.value || '') === 'gitgraph') {
          var explicitPositions = readLayoutPositions(textarea.value);
          Array.prototype.slice.call(svg.querySelectorAll('[data-layout-id][data-layout-anchor]')).forEach(function (el) {
            var labelId = el.getAttribute('data-layout-id') || '';
            if (el.getAttribute('data-layout-anchor') !== id || explicitPositions[labelId]) return;
            if (el.closest('defs') || el.closest('.uml-pg-edit-layer')) return;
            if (dataEls.indexOf(el) === -1) dataEls.push(el);
          });
        }
        return dataEls.map(function (el) {
          return {
            el: el,
            transform: el.getAttribute('transform') || '',
            styleTransform: el.style ? (el.style.transform || '') : ''
          };
        });
      }

      var selector = 'rect,circle,ellipse,polygon,path,line,polyline,text';
      return Array.prototype.slice.call(svg.querySelectorAll(selector)).filter(function (el) {
        if (el.closest('.uml-pg-edit-layer') || el.closest('defs')) return false;
        var b = elementSvgBox(svg, el);
        if (!b) return false;
        return containsBox(box, b, 3) || containsPoint(box, b.x + b.width / 2, b.y + b.height / 2, 3);
      }).map(function (el) {
        return {
          el: el,
          transform: el.getAttribute('transform') || '',
          styleTransform: el.style ? (el.style.transform || '') : ''
        };
      });
    }

    function clearEditLayer() {
      var svg = output.querySelector('svg');
      if (!svg) return;
      var layer = svg.querySelector('.uml-pg-edit-layer');
      if (layer) layer.remove();
      svg.classList.remove('uml-pg-editing');
    }

    /**
     * @param {string|null} id    The element/route to select. null clears.
     * @param {string} kind       'node' | 'route'
     * @param {object} [opts]
     * @param {boolean} [opts.extend]  Toggle id in the selection instead of
     *                                 replacing — used by Cmd/Ctrl/Shift+click.
     */
    function setSelectedLayoutId(id, kind, opts) {
      opts = opts || {};
      var k = kind || 'node';
      if (!id) {
        clearSelectionSet();
        selectedLayoutId = null;
        selectedLayoutKind = null;
      } else if (opts.extend) {
        if (selectedLayoutIds[id]) {
          delete selectedLayoutIds[id];
          // If we just removed the primary, pick the most recently kept one.
          if (selectedLayoutId === id) {
            var keys = Object.keys(selectedLayoutIds);
            if (keys.length) {
              selectedLayoutId = keys[keys.length - 1];
              selectedLayoutKind = selectedLayoutIds[selectedLayoutId];
            } else {
              selectedLayoutId = null;
              selectedLayoutKind = null;
            }
          }
        } else {
          selectedLayoutIds[id] = k;
          selectedLayoutId = id;
          selectedLayoutKind = k;
        }
      } else {
        clearSelectionSet();
        selectedLayoutIds[id] = k;
        selectedLayoutId = id;
        selectedLayoutKind = k;
      }
      if (resetOneBtn) resetOneBtn.disabled = selectionSize() !== 1;
      var layer = output.querySelector('.uml-pg-edit-layer');
      if (layer) {
        Array.prototype.slice.call(layer.querySelectorAll('.uml-pg-edit-hitbox')).forEach(function (rect) {
          var rid = rect.getAttribute('data-layout-id');
          rect.classList.toggle('is-selected', selectedLayoutIds[rid] === 'node');
        });
        Array.prototype.slice.call(layer.querySelectorAll('.uml-pg-edge-hitbox')).forEach(function (line) {
          var rid = line.getAttribute('data-layout-id');
          line.classList.toggle('is-selected', selectedLayoutIds[rid] === 'route');
        });
      }
      if (typeof rebuildPropsPane === 'function') rebuildPropsPane();
    }

    function clonePoints(points) {
      return (points || []).map(function (p) { return { x: Number(p.x), y: Number(p.y) }; });
    }

    function setRouteOverlaySegment(seg, p1, p2) {
      seg.setAttribute('x1', p1.x);
      seg.setAttribute('y1', p1.y);
      seg.setAttribute('x2', p2.x);
      seg.setAttribute('y2', p2.y);
    }

    function syncRouteOverlays(layer, routeId, points) {
      if (!layer) return;
      Array.prototype.slice.call(layer.querySelectorAll('.uml-pg-edge-hitbox[data-route-id="' + routeId + '"]')).forEach(function (seg) {
        var idx = Number(seg.getAttribute('data-segment-index'));
        if (seg.getAttribute('data-locked-endpoints') === 'true' && points.length === 4 && idx === 0) {
          setRouteOverlaySegment(seg, points[1], points[2]);
          return;
        }
        if (!points[idx] || !points[idx + 1]) return;
        setRouteOverlaySegment(seg, points[idx], points[idx + 1]);
      });
    }

    function findEditableRoutes(svg) {
      if (!window.UMLShared || !window.UMLShared.collectEditableRoutes) return [];
      return window.UMLShared.collectEditableRoutes(svg);
    }

    function applyRoutePoints(route, points) {
      if (window.UMLShared && window.UMLShared.setRoutePointsForElement) {
        route.element = window.UMLShared.setRoutePointsForElement(route.element, points) || route.element;
      }
    }

    function collectConnectedRoutes(svg, id) {
      return findEditableRoutes(svg).filter(function (route) {
        return routeEndpointBelongsTo(route.source, id) || routeEndpointBelongsTo(route.target, id);
      }).map(function (route) {
        return {
          route: route,
          points: clonePoints(route.points),
          source: route.source,
          target: route.target
        };
      });
    }

    function routeEndpointBelongsTo(endpoint, id) {
      if (!endpoint || !id) return false;
      if (endpoint === id) return true;
      return (typeSelect.value || '') === 'component' && endpoint.indexOf(id + '.') === 0;
    }

    function applyConnectedRouteDelta(routes, id, dx, dy) {
      (routes || []).forEach(function (entry) {
        var next = clonePoints(entry.points);
        if (routeEndpointBelongsTo(entry.source, id) && next[0]) {
          next[0].x += dx;
          next[0].y += dy;
        }
        if (routeEndpointBelongsTo(entry.target, id) && next[next.length - 1]) {
          var end = next.length - 1;
          next[end].x += dx;
          next[end].y += dy;
        }
        applyRoutePoints(entry.route, next);
      });
    }

    function routeElementTag(route) {
      return route && route.element && route.element.tagName ? route.element.tagName.toLowerCase() : '';
    }

    function routeUsesLockedEndpoints(route) {
      if ((typeSelect.value || '') === 'sequence') return false;
      return routeElementTag(route) !== 'rect';
    }

    function editableRouteSegmentIndices(route, lockedEndpoints) {
      var count = route && route.points ? route.points.length : 0;
      if (count < 2) return [];
      if (!lockedEndpoints) {
        var all = [];
        for (var ai = 0; ai < count - 1; ai++) all.push(ai);
        return all;
      }
      if (count === 2) return [0];
      var inner = [];
      for (var ii = 1; ii < count - 2; ii++) inner.push(ii);
      return inner;
    }

    function anchoredTwoPointRoute(points, moveX, moveY) {
      var a = points[0];
      var b = points[1];
      var segDx = b.x - a.x;
      var segDy = b.y - a.y;
      if (Math.abs(segDx) >= Math.abs(segDy)) {
        return [
          { x: a.x, y: a.y },
          { x: a.x, y: a.y + moveY },
          { x: b.x, y: b.y + moveY },
          { x: b.x, y: b.y }
        ];
      }
      return [
        { x: a.x, y: a.y },
        { x: a.x + moveX, y: a.y },
        { x: b.x + moveX, y: b.y },
        { x: b.x, y: b.y }
      ];
    }

    function constrainedPortPosition(item, x, y) {
      if (!item || item.axis !== 'port' || !item.parentBox) return { x: x, y: y };
      var box = item.parentBox;
      var inset = 8;
      var minX = box.x + inset;
      var maxX = box.x + box.width - inset;
      var minY = box.y + inset;
      var maxY = box.y + box.height - inset;
      if (maxX < minX) {
        minX = box.x;
        maxX = box.x + box.width;
      }
      if (maxY < minY) {
        minY = box.y;
        maxY = box.y + box.height;
      }
      function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
      }
      var choices = [
        { side: 'left', x: box.x, y: clamp(y, minY, maxY), distance: Math.abs(x - box.x) },
        { side: 'right', x: box.x + box.width, y: clamp(y, minY, maxY), distance: Math.abs(x - (box.x + box.width)) },
        { side: 'top', x: clamp(x, minX, maxX), y: box.y, distance: Math.abs(y - box.y) },
        { side: 'bottom', x: clamp(x, minX, maxX), y: box.y + box.height, distance: Math.abs(y - (box.y + box.height)) }
      ];
      choices.sort(function (a, b) {
        if (Math.abs(a.distance - b.distance) > 0.75) return a.distance - b.distance;
        if (a.side === item.portSide) return -1;
        if (b.side === item.portSide) return 1;
        return 0;
      });
      return { x: choices[0].x, y: choices[0].y, side: choices[0].side };
    }

    // ─── Source-modification helpers (used by the visual creation tools) ───
    var activeTool = null; // null | { kind:'element'|'relation', spec, type }
    var pendingRelation = null; // null | { spec, sourceId }
    var renamingId = null; // id currently in rename mode

    // ─── Undo / redo: snapshot the textarea before each visual mutation. ───
    var undoStack = [];
    var redoStack = [];
    var UNDO_LIMIT = 100;
    var COALESCE_MS = 600;
    var suspendUndo = false;
    /**
     * Push the current textarea value onto the undo stack.
     *
     * If `kind` matches the most recent push within COALESCE_MS, replace its
     * top entry instead of pushing a new one — so holding ↓ to nudge or
     * dragging a class around becomes a single undoable step.
     */
    function snapshotForUndo(kind) {
      if (suspendUndo) return;
      var now = Date.now();
      var top = undoStack[undoStack.length - 1];
      if (kind && top && top.kind === kind && (now - top.t) < COALESCE_MS) {
        top.t = now;
        // Don't update top.value — we want the *original* pre-burst snapshot.
        return;
      }
      undoStack.push({ value: textarea.value, kind: kind || null, t: now });
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
      redoStack.length = 0;
      refreshUndoButtons();
    }
    function refreshUndoButtons() {
      if (undoBtn) undoBtn.disabled = !undoStack.length;
      if (redoBtn) redoBtn.disabled = !redoStack.length;
    }
    function applySnapshot(value) {
      suspendUndo = true;
      textarea.value = value;
      suspendUndo = false;
      renderDiagram();
      refreshUndoButtons();
    }
    function undo() {
      if (!undoStack.length) return;
      redoStack.push({ value: textarea.value, kind: null, t: Date.now() });
      var prev = undoStack.pop();
      applySnapshot(prev.value);
      announce('Undone.', false);
    }
    function redo() {
      if (!redoStack.length) return;
      undoStack.push({ value: textarea.value, kind: null, t: Date.now() });
      var next = redoStack.pop();
      applySnapshot(next.value);
      announce('Redone.', false);
    }

    function elementSchemasFor(type) { return ELEMENT_SCHEMAS[type] || []; }
    function relationSchemasFor(type) { return RELATION_SCHEMAS[type] || []; }
    function findElementSchema(type, id) {
      return (elementSchemasFor(type) || []).find(function (s) { return s.id === id; }) || null;
    }
    function findRelationSchema(type, id) {
      return (relationSchemasFor(type) || []).find(function (s) { return s.id === id; }) || null;
    }

    function existingIds(text, type) {
      var seen = {};
      collectModelElements(text, type).forEach(function (e) {
        var id = String(e.id || '');
        if (id) seen[id] = true;
        if (id.indexOf('.') !== -1) seen[id.split('.')[0]] = true;
      });
      // Also pre-seed with raw declarations (e.g., aliases, rectangles) the visual
      // editor doesn't otherwise list — protects against accidental ID collisions.
      var lines = stripLayoutMetadata(text).split('\n');
      lines.forEach(function (line) {
        var m = line.match(/\bas\s+([A-Za-z_][\w-]*)/);
        if (m) seen[m[1]] = true;
      });
      return seen;
    }

    function generateUniqueId(text, type, base) {
      var taken = existingIds(text, type);
      var safe = String(base || 'New').replace(/[^A-Za-z0-9_]/g, '') || 'New';
      // Try base, base2, base3... so the first new element gets a clean name.
      if (!taken[safe]) return safe;
      var i = 2;
      while (taken[safe + i]) i++;
      return safe + i;
    }

    function findInsertPointForDeclaration(lines) {
      // Insert just before @enduml, or at end if missing.
      for (var i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim() === '@enduml') return i;
      }
      return lines.length;
    }

    function buildElementLine(spec, id, opts) {
      opts = opts || {};
      // Pseudostates / activity special tokens are written by the relation, not as
      // a standalone declaration line. The caller checks `spec.pseudo` / `activityPseudo`.
      if (spec.activityPseudo) return null;
      if (spec.pseudo) return null;
      if (spec.activityDecision || spec.activityFork || spec.activityLane) return null;

      var label = opts.label || id;
      var stereotype = opts.stereotype || spec.fixedStereotype || '';
      var line;

      if (spec.isNote) {
        // note as id "text"
        line = 'note as ' + id + ' "' + escapeQuoted(label) + '"';
      } else if (spec.isPort) {
        // portin/portout "Label" as id
        line = spec.portKind + ' "' + escapeQuoted(label) + '" as ' + id;
      } else if (spec.isInterface) {
        // provide/require "Label" as id
        line = spec.interfaceKind + ' "' + escapeQuoted(label) + '" as ' + id;
      } else if (spec.keyword === 'usecase') {
        line = 'usecase "' + escapeQuoted(label) + '" as ' + id;
      } else if (spec.keyword === 'rectangle') {
        line = 'rectangle "' + escapeQuoted(label) + '" as ' + id + ' { }';
      } else if (spec.keyword === 'artifact') {
        line = 'artifact "' + escapeQuoted(label) + '" as ' + id;
      } else if (spec.keyword === 'actor' && (typeSelect.value === 'sequence' || typeSelect.value === 'usecase')) {
        if (typeSelect.value === 'sequence') {
          line = 'actor ' + id + ': ' + label;
        } else if (id !== label) {
          line = 'actor "' + escapeQuoted(label) + '" as ' + id;
        } else {
          line = 'actor ' + id;
        }
      } else if (spec.keyword === 'participant') {
        line = 'participant ' + id + ': ' + label;
      } else if (spec.keyword === 'action') {
        line = '"' + escapeQuoted(label) + '"';
      } else if (spec.keyword === '(*)') {
        line = null;
      } else if (spec.keyword) {
        line = spec.keyword + ' ' + id;
      } else {
        line = id;
      }

      if (line && stereotype) {
        line = line.replace(/(\s*\{[^}]*\}|\s*$)$/, ' ' + stereotype + '$1');
      }
      if (line && opts.highlight) {
        line += ' #' + opts.highlight.replace(/^#/, '');
      }

      if (opts.abstract && spec.id === 'class') {
        line = line.replace(/^class\b/, 'abstract class');
      }
      if (opts.dashed && spec.keyword === 'component') {
        line = line + ' dashed';
      }
      return line;
    }

    function escapeQuoted(s) {
      return String(s || '').replace(/"/g, '\\"');
    }

    function addElementToSource(text, type, spec, opts) {
      opts = opts || {};
      // Activity (*) doesn't need its own line — caller usually creates an arrow
      // already containing it. Just preserve text.
      if (spec.activityPseudo) return text;
      // State pseudostates: same — they live inside transitions.
      if (spec.pseudo) return text;

      var positions = readLayoutPositions(text);
      var routes = readLayoutRoutes(text);
      var clean = stripLayoutMetadata(text);
      var lines = clean.split('\n');
      var declLine = buildElementLine(spec, opts.id, opts);
      if (declLine == null) return text;
      var insertAt = findInsertPointForDeclaration(lines);
      lines.splice(insertAt, 0, declLine);
      if (opts.position) {
        positions[opts.id] = { x: Math.round(opts.position.x), y: Math.round(opts.position.y) };
      }
      return writePositionsIntoSource(lines.join('\n'), type, positions, routes);
    }

    function buildRelationLine(spec, sourceId, targetId, opts) {
      opts = opts || {};
      var op = spec.op;
      // Composition / aggregation navigability: combine '*--' or 'o--' with the
      // navigability variant.
      if (opts.navigability === 'navigable' && spec.id === 'compose') op = '*-->';
      if (opts.navigability === 'bidirectional' && spec.id === 'compose') op = '*<-->';
      if (opts.navigability === 'nonnav' && spec.id === 'compose') op = '*--x';
      if (opts.navigability === 'navigable' && spec.id === 'aggregate') op = 'o-->';
      if (opts.navigability === 'bidirectional' && spec.id === 'aggregate') op = 'o<-->';
      if (opts.navigability === 'nonnav' && spec.id === 'aggregate') op = 'o--x';
      if (opts.navigability === 'navigable' && spec.id === 'plain') op = '-->';
      if (opts.navigability === 'bidirectional' && spec.id === 'plain') op = '<-->';
      if (opts.navigability === 'nonnav' && spec.id === 'assoc') op = '--x';

      var src = sourceId;
      var tgt = targetId;
      if (opts.sourceMult) src = '"' + escapeQuoted(opts.sourceMult) + '" ' + src;
      if (opts.targetMult) tgt = '"' + escapeQuoted(opts.targetMult) + '" ' + tgt;

      // For ER, the cardinality goes in quotes before the entity, like `Student "N" -- Borrows`.
      // We surface it via `sourceMult` / `targetMult` already, but the entity-quote
      // ordering differs: cardinality follows the entity name. Correct that for ER.
      if (typeSelect.value === 'er') {
        src = sourceId + (opts.sourceMult ? ' "' + escapeQuoted(opts.sourceMult) + '"' : '');
        tgt = (opts.targetMult ? '"' + escapeQuoted(opts.targetMult) + '" ' : '') + targetId;
      }

      var line = src + ' ' + op + ' ' + tgt;
      var label = opts.label || (spec.defaultLabel || '');
      var stereo = opts.stereotype || spec.stereotype || '';
      if (stereo && label) line += ' : ' + stereo + ' ' + label;
      else if (stereo) line += ' : ' + stereo;
      else if (label) line += ' : ' + label;
      return line;
    }

    function addRelationToSource(text, type, spec, sourceId, targetId, opts) {
      opts = opts || {};
      var positions = readLayoutPositions(text);
      var routes = readLayoutRoutes(text);
      var clean = stripLayoutMetadata(text);
      var lines = clean.split('\n');
      var insertAt = findInsertPointForDeclaration(lines);
      var line = buildRelationLine(spec, sourceId, targetId, opts);
      lines.splice(insertAt, 0, line);
      return writePositionsIntoSource(lines.join('\n'), type, positions, routes);
    }

    function isRelationLineFor(line, type, sourceId, targetId, op) {
      var t = line.trim();
      // Test plain `A op B` ignoring multiplicity quotes / labels.
      var stripped = t.replace(/"((?:[^"\\]|\\.)*)"\s*/g, '').replace(/\s*:.*$/, '').trim();
      var parts = stripped.split(/\s+/);
      if (parts.length < 3) return false;
      var s = parts[0], operator = parts.slice(1, parts.length - 1).join(' '), tg = parts[parts.length - 1];
      if (op && operator !== op) return false;
      // Case-insensitive symmetric match for plain associations.
      return (s === sourceId && tg === targetId) || (s === targetId && tg === sourceId);
    }

    function lineMentionsId(line, id) {
      var t = line.trim();
      if (!t || /^@/.test(t)) return false;
      // Match whole-word occurrences of id (alphanumeric + underscore boundary aware).
      var re = new RegExp('(^|[^\\w.])' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^\\w])');
      return re.test(t) || t.indexOf('"' + id + '"') !== -1;
    }

    function removeElementFromSource(text, type, id) {
      var positions = readLayoutPositions(text);
      var routes = readLayoutRoutes(text);
      delete positions[id];
      Object.keys(routes).forEach(function (rid) {
        if (rid.indexOf(id) !== -1) delete routes[rid];
      });
      var clean = stripLayoutMetadata(text);
      var lines = clean.split('\n');
      var keep = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var t = line.trim();
        if (t === '@startuml' || t === '@enduml' || /^layout\s+/i.test(t)) {
          keep.push(line);
          continue;
        }
        // Strip declarations whose id matches.
        var declId = declarationIdForLine(line, type);
        if (declId === id) continue;
        // Strip any line that mentions id (relations, activations, etc.).
        if (lineMentionsId(line, id)) continue;
        keep.push(line);
      }
      return writePositionsIntoSource(keep.join('\n'), type, positions, routes);
    }

    function removeRelationLine(text, type, lineIndex) {
      var positions = readLayoutPositions(text);
      var routes = readLayoutRoutes(text);
      var clean = stripLayoutMetadata(text);
      var lines = clean.split('\n');
      if (lineIndex < 0 || lineIndex >= lines.length) return text;
      lines.splice(lineIndex, 1);
      return writePositionsIntoSource(lines.join('\n'), type, positions, routes);
    }

    function replaceLineByMatch(text, type, predicate, newLine) {
      var positions = readLayoutPositions(text);
      var routes = readLayoutRoutes(text);
      var clean = stripLayoutMetadata(text);
      var lines = clean.split('\n');
      for (var i = 0; i < lines.length; i++) {
        if (predicate(lines[i], i)) {
          if (newLine == null) lines.splice(i, 1);
          else lines[i] = newLine;
          break;
        }
      }
      return writePositionsIntoSource(lines.join('\n'), type, positions, routes);
    }

    function findDeclarationLineIndex(text, type, id) {
      var clean = stripLayoutMetadata(text);
      var lines = clean.split('\n');
      for (var i = 0; i < lines.length; i++) {
        if (declarationIdForLine(lines[i], type) === id) return i;
      }
      return -1;
    }

    function getDeclarationLine(text, type, id) {
      var idx = findDeclarationLineIndex(text, type, id);
      if (idx === -1) return null;
      var lines = stripLayoutMetadata(text).split('\n');
      var line = lines[idx];
      // Collapse multi-line `{ ... }` blocks into a single semicolon-separated form
      // so the props panel can parse them uniformly.
      if (line.indexOf('{') !== -1 && line.indexOf('}') === -1) {
        var body = [];
        var j = idx + 1;
        var depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        while (j < lines.length && depth > 0) {
          var l = lines[j];
          depth += (l.match(/\{/g) || []).length;
          depth -= (l.match(/\}/g) || []).length;
          if (depth === 0) {
            // l is the closing }; everything before } belongs to body.
            var beforeBrace = l.substring(0, l.lastIndexOf('}'));
            if (beforeBrace.trim()) body.push(beforeBrace.trim());
          } else {
            body.push(l.trim());
          }
          j++;
        }
        return line.replace(/\{$/, '').trim() + ' { ' + body.filter(Boolean).join('; ') + ' }';
      }
      return line;
    }

    // For multi-line declarations, replace the entire block (decl line + body) with a
    // single-line form (or new multi-line form). predicate(lines[i]) identifies the
    // decl line.
    function replaceBlockByMatch(text, type, predicate, newLine) {
      var positions = readLayoutPositions(text);
      var routes = readLayoutRoutes(text);
      var clean = stripLayoutMetadata(text);
      var lines = clean.split('\n');
      for (var i = 0; i < lines.length; i++) {
        if (!predicate(lines[i], i)) continue;
        var line = lines[i];
        if (line.indexOf('{') !== -1 && line.indexOf('}') === -1) {
          // Collapse multi-line block into the single line
          var depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
          var j = i + 1;
          while (j < lines.length && depth > 0) {
            depth += (lines[j].match(/\{/g) || []).length;
            depth -= (lines[j].match(/\}/g) || []).length;
            j++;
          }
          // Replace lines[i..j-1] with newLine (single line).
          lines.splice(i, j - i, newLine);
        } else {
          lines[i] = newLine;
        }
        break;
      }
      return writePositionsIntoSource(lines.join('\n'), type, positions, routes);
    }

    function svgPointFromEvent(svg, ev) { return svgPoint(svg, ev.clientX, ev.clientY); }

    // ─── Palette / tool state ───
    // Note: these are declared without initializers because the DOM-query
    // assignments live at the top of init(); var-hoisting would otherwise reset
    // them to null after the assignment ran. Same applies to propsPane below.
    var palette, paletteEls, paletteRels, toolStatus, toolCancel;

    function announce(msg, isActive) {
      if (!toolStatus) return;
      toolStatus.textContent = msg || '';
      toolStatus.classList.toggle('is-active', !!isActive);
    }

    function buildPaletteButton(spec, kind) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'uml-pg-tool-btn';
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('data-tool-kind', kind);
      btn.setAttribute('data-tool-spec', spec.id);
      var glyph = document.createElement('span');
      glyph.className = 'uml-pg-tool-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = spec.glyph || '';
      btn.appendChild(glyph);
      btn.appendChild(document.createTextNode(spec.label));
      var aria = (kind === 'element' ? 'Add element: ' : 'Add relation: ') + spec.label;
      btn.setAttribute('aria-label', aria);
      btn.title = aria + ' — click to arm, then click on the diagram. Or drag onto the diagram.';
      // Click-to-arm interaction
      btn.addEventListener('click', function () {
        if (paletteDragState) return; // ignore the click that follows a drag
        if (activeTool && activeTool.spec === spec && activeTool.kind === kind) {
          setActiveTool(null);
        } else {
          setActiveTool(kind, spec);
        }
      });
      // Drag-from-palette interaction. Start a drag once the pointer moves past
      // a small threshold so a normal click still works.
      btn.addEventListener('pointerdown', function (event) {
        if (event.button !== 0) return;
        var startX = event.clientX, startY = event.clientY;
        var armed = false;
        function onMove(ev) {
          if (armed) return;
          if (Math.abs(ev.clientX - startX) > 5 || Math.abs(ev.clientY - startY) > 5) {
            armed = true;
            paletteDragState = { kind: kind, spec: spec, x: ev.clientX, y: ev.clientY, sourceId: null };
            announce('Drop on the canvas to ' + (kind === 'element' ? 'place a ' + spec.label : 'start a ' + spec.label + ' relation') + '. Esc to cancel.', true);
            // Visual hint on the button
            btn.style.opacity = '0.6';
          }
        }
        function onUp() {
          document.removeEventListener('pointermove', onMove, true);
          document.removeEventListener('pointerup', onUp, true);
          btn.style.opacity = '';
        }
        document.addEventListener('pointermove', onMove, true);
        document.addEventListener('pointerup', onUp, true);
      });
      return btn;
    }

    var paletteDragState = null;
    function updatePaletteDrag(event, finish) {
      if (!paletteDragState) return;
      paletteDragState.x = event.clientX;
      paletteDragState.y = event.clientY;
      if (finish) {
        var svg = output.querySelector('svg');
        if (!svg) { paletteDragState = null; return; }
        var hit = findItemAtPoint(svg, event.clientX, event.clientY);
        var ds = paletteDragState;
        paletteDragState = null;
        if (ds.kind === 'element') {
          // Drop position → SVG point. If dropped outside SVG, ignore.
          var svgRect = svg.getBoundingClientRect();
          if (event.clientX < svgRect.left || event.clientX > svgRect.right ||
              event.clientY < svgRect.top || event.clientY > svgRect.bottom) {
            announce('Drop inside the diagram canvas to place an element.', false);
            return;
          }
          var pt = svgPoint(svg, event.clientX, event.clientY);
          placeElementAt(ds.spec, pt);
        } else {
          // Relation: drop on element → use as source, await target click.
          if (!hit) {
            // Activate connect-mode anyway and prompt to click a source.
            setActiveTool('relation', ds.spec);
            announce('Click a source element for the ' + ds.spec.label + ' relation. Esc to cancel.', true);
            return;
          }
          setActiveTool('relation', ds.spec);
          pendingRelation = { spec: ds.spec, sourceId: hit.id };
          if (hit.hitbox && hit.hitbox.classList) hit.hitbox.classList.add('is-relation-source');
          announce('Source = "' + hit.id + '". Now click the target element. Esc to cancel.', true);
        }
      }
    }

    function rebuildPalette() {
      if (!paletteEls || !paletteRels) return;
      paletteEls.textContent = '';
      paletteRels.textContent = '';
      var t = typeSelect.value;
      var els = elementSchemasFor(t);
      var rels = relationSchemasFor(t);
      els.forEach(function (s) { paletteEls.appendChild(buildPaletteButton(s, 'element')); });
      rels.forEach(function (s) { paletteRels.appendChild(buildPaletteButton(s, 'relation')); });
      updatePaletteVisibility();
    }

    function updatePaletteVisibility() {
      if (!palette) return;
      var on = !!(editToggle && editToggle.checked) && diagramSupportsCreation(typeSelect.value);
      palette.hidden = !on;
      if (!on) setActiveTool(null);
    }

    function refreshActiveButtonStates() {
      if (!palette) return;
      Array.prototype.slice.call(palette.querySelectorAll('.uml-pg-tool-btn')).forEach(function (btn) {
        var pressed = !!(activeTool &&
          btn.getAttribute('data-tool-kind') === activeTool.kind &&
          btn.getAttribute('data-tool-spec') === activeTool.spec.id);
        btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      });
      if (toolCancel) toolCancel.hidden = !activeTool;
      var svg = output.querySelector('svg');
      if (svg) {
        svg.classList.toggle('uml-pg-tool-place', !!(activeTool && activeTool.kind === 'element'));
        svg.classList.toggle('uml-pg-tool-connect', !!(activeTool && activeTool.kind === 'relation'));
      }
    }

    function setActiveTool(kind, spec) {
      if (!kind) {
        activeTool = null;
        pendingRelation = null;
      } else {
        activeTool = { kind: kind, spec: spec, type: typeSelect.value };
        pendingRelation = null;
      }
      refreshActiveButtonStates();
      // Clear pending source highlight.
      var layer = output.querySelector('.uml-pg-edit-layer');
      if (layer) {
        Array.prototype.slice.call(layer.querySelectorAll('.is-relation-source')).forEach(function (el) {
          el.classList.remove('is-relation-source');
        });
      }
      if (!activeTool) { announce(''); return; }
      if (activeTool.kind === 'element') {
        announce('Click on the diagram to add a ' + spec.label + '. Press Esc to cancel.', true);
      } else {
        announce('Click the source element for a ' + spec.label + ' relation. Press Esc to cancel.', true);
      }
    }

    function handleCanvasPointerDown(svg, event) {
      if (!activeTool || activeTool.kind !== 'element') return false;
      // Don't handle if click landed on a hitbox (those have their own handler).
      var target = event.target;
      while (target && target !== svg) {
        if (target.classList && (target.classList.contains('uml-pg-edit-hitbox') || target.classList.contains('uml-pg-edge-hitbox'))) {
          return false;
        }
        target = target.parentNode;
      }
      event.preventDefault();
      var pt = svgPointFromEvent(svg, event);
      placeElementAt(activeTool.spec, pt);
      return true;
    }

    function placeElementAt(spec, pt) {
      snapshotForUndo();
      var type = typeSelect.value;
      var id = generateUniqueId(textarea.value, type, spec.base);
      var opts = { id: id, label: id, position: pt };
      // Sequence fragments insert a stub block at the end of the source.
      if (type === 'sequence' && spec.sequenceFragment) {
        var blocks = {
          alt: ['alt [condition]', '  A -> B: messageA', 'else [otherwise]', '  A -> B: messageB', 'end'],
          opt: ['opt [condition]', '  A -> B: optionalMsg', 'end'],
          loop: ['loop [while condition]', '  A -> B: repeatedMsg', 'end'],
          par: ['par', '  A -> B: branchA', 'else', '  A -> C: branchB', 'end'],
          break: ['break [condition]', '  A -> B: abortMsg', 'end']
        };
        var lines = blocks[spec.sequenceFragment] || [];
        lines.forEach(function (l) { textarea.value = appendRawLine(textarea.value, l); });
        renderDiagram(); return;
      }
      // Composite state — wrap a sub-state inside `{ }`.
      if (type === 'state' && spec.isComposite) {
        var subId = generateUniqueId(textarea.value, type, 'Sub');
        textarea.value = appendRawLine(textarea.value, 'state ' + id + ' { state ' + subId + ' }');
        renderDiagram(); selectAfterRender(id, 'node'); return;
      }
      // Activity decisions: insert if/else block stub.
      if (type === 'activity' && spec.activityDecision) {
        var stub = ['if "Condition?" then', '  --> [yes] "ThenAction"', 'else', '  --> [no] "ElseAction"', 'endif'].join('\n');
        textarea.value = appendRawLine(textarea.value, stub);
        renderDiagram(); return;
      }
      if (type === 'activity' && spec.activityFork) {
        var fstub = ['fork', '  --> "Branch A"', '  --> "Branch B"', 'endfork'].join('\n');
        textarea.value = appendRawLine(textarea.value, fstub);
        renderDiagram(); return;
      }
      if (type === 'activity' && spec.activityLane) {
        var laneId = generateUniqueId(textarea.value, type, 'Lane');
        textarea.value = appendRawLine(textarea.value, '|' + laneId + '|');
        renderDiagram(); return;
      }
      // State pseudostate placeholders.
      if (type === 'state' && spec.pseudo === 'initial') {
        textarea.value = appendRawLine(textarea.value, '[*] --> ' + (id = generateUniqueId(textarea.value, type, 'New')));
        renderDiagram(); selectAfterRender(id, 'node'); return;
      }
      if (type === 'state' && spec.pseudo === 'final') {
        textarea.value = appendRawLine(textarea.value, (id = generateUniqueId(textarea.value, type, 'Last')) + ' --> [*]');
        renderDiagram(); selectAfterRender(id, 'node'); return;
      }
      if (type === 'activity' && spec.activityPseudo) {
        var actId = generateUniqueId(textarea.value, type, 'Step');
        textarea.value = appendRawLine(textarea.value, '(*) --> "' + actId + '"');
        textarea.value = appendRawLine(textarea.value, '"' + actId + '" --> (*)');
        renderDiagram(); selectAfterRender(actId, 'node'); return;
      }
      if (type === 'activity' && spec.activityAction) {
        var existing = collectModelElements(textarea.value, type).length;
        var stub2;
        if (existing === 0) stub2 = '(*) --> "' + escapeQuoted(opts.label) + '"';
        else {
          var prev = collectModelElements(textarea.value, type);
          var prevId = prev[prev.length - 1].id;
          stub2 = '"' + escapeQuoted(prevId) + '" --> "' + escapeQuoted(opts.label) + '"';
        }
        textarea.value = appendRawLine(textarea.value, stub2);
        renderDiagram(); selectAfterRender(opts.label, 'node'); return;
      }
      // Notes / ports get sensible defaults.
      if (spec.isNote) opts.label = 'New note text';
      if (spec.isPort) opts.label = spec.portKind === 'portin' ? 'in' : 'out';
      if (spec.isInterface) opts.label = spec.interfaceKind === 'provide' ? 'P_iface' : 'R_iface';

      // Ports / interfaces dropped onto a component go INSIDE that component's
      // `{ }` block — they live there in ArchUML and the renderer lays them out
      // on the component border.
      if (type === 'component' && (spec.isPort || spec.isInterface)) {
        var hostId = findComponentAtSvgPoint(pt);
        if (hostId) {
          addPortIntoComponent(hostId, spec, id, opts.label);
          renderDiagram();
          selectAfterRender(hostId, 'node');
          return;
        }
      }
      textarea.value = addElementToSource(textarea.value, type, spec, opts);
      renderDiagram();
      selectAfterRender(id, 'node');
    }

    /** Find the topmost component element under the given SVG-coord point. */
    function findComponentAtSvgPoint(pt) {
      var svg = output.querySelector('svg');
      if (!svg) return null;
      var editables = findEditableElements(svg);
      var hit = null;
      // Iterate in reverse so visually-on-top components win.
      for (var i = editables.length - 1; i >= 0; i--) {
        var e = editables[i];
        if (e.axis === 'port' || e.axis === 'label' || e.axis === 'branch-label') continue;
        if (pt.x >= e.box.x && pt.x <= e.box.x + e.box.width &&
            pt.y >= e.box.y && pt.y <= e.box.y + e.box.height) {
          // Prefer components specifically.
          var line = getDeclarationLine(textarea.value, 'component', e.id);
          if (line && /^component\b/i.test(line.trim())) return e.id;
          if (!hit) hit = e.id;
        }
      }
      // Fall back to any element if we didn't find a component (shouldn't happen).
      return hit;
    }

    /** Insert a port/interface line inside the host component's body. */
    function addPortIntoComponent(componentId, spec, newPortId, label) {
      snapshotForUndo();
      var line = getDeclarationLine(textarea.value, 'component', componentId);
      if (!line) return;
      var body = parseBraceBody(line);
      var parsed = parseComponentBody(body);
      var kind = spec.isInterface ? spec.interfaceKind : spec.portKind;
      parsed.ports.push({ kind: kind, label: label, alias: newPortId, dashed: false });
      var newBody = buildComponentBody(parsed);
      var newLine = setBraceBody(line, newBody);
      replaceLineForElementId(componentId, newLine);
    }

    function appendRawLine(text, line) {
      var positions = readLayoutPositions(text);
      var routes = readLayoutRoutes(text);
      var clean = stripLayoutMetadata(text);
      var lines = clean.split('\n');
      lines.splice(findInsertPointForDeclaration(lines), 0, line);
      return writePositionsIntoSource(lines.join('\n'), typeSelect.value, positions, routes);
    }

    var pendingSelect = null;
    function selectAfterRender(id, kind) {
      pendingSelect = { id: id, kind: kind };
      // If render is synchronous, the selection is applied at the end of installVisualEditor.
    }

    // ─── Hover-to-extend "+" handle + relation chooser popup ───
    var relationChooser = null;
    var extendDragState = null;

    function closeRelationChooser() {
      if (relationChooser && relationChooser.parentNode) relationChooser.parentNode.removeChild(relationChooser);
      relationChooser = null;
    }

    /**
     * Floating chooser of element types for the current diagram. Used when a
     * "+" handle drag lands on empty canvas — the user picks an element type
     * and we then chain through to the relation-type chooser. The signature is
     * intentionally similar to showRelationChooser.
     */
    function showElementChooser(clientX, clientY, sourceId, onPick) {
      closeRelationChooser();
      var type = typeSelect.value;
      var els = elementSchemasFor(type);
      if (!els.length) { onPick(null); return; }
      var box = document.createElement('div');
      box.className = 'uml-pg-relation-chooser';
      box.setAttribute('role', 'menu');
      box.setAttribute('aria-label', 'Pick an element type to create');
      var title = document.createElement('div');
      title.className = 'uml-pg-relation-chooser-title';
      title.textContent = 'Create new element from "' + sourceId + '"';
      box.appendChild(title);
      els.forEach(function (spec) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'menuitem');
        var glyph = document.createElement('span');
        glyph.setAttribute('aria-hidden', 'true');
        glyph.style.color = '#2774AE';
        glyph.style.fontWeight = '700';
        glyph.style.minWidth = '1.4em';
        glyph.textContent = spec.glyph || '▢';
        btn.appendChild(glyph);
        btn.appendChild(document.createTextNode(spec.label));
        btn.addEventListener('click', function () {
          closeRelationChooser();
          cleanupChooserListeners();
          onPick(spec);
        });
        box.appendChild(btn);
      });
      document.body.appendChild(box);
      var W = window.innerWidth, H = window.innerHeight;
      var rect = box.getBoundingClientRect();
      var x = Math.min(Math.max(clientX, 8), W - rect.width - 8);
      var y = Math.min(Math.max(clientY, 8), H - rect.height - 8);
      box.style.left = x + 'px';
      box.style.top = y + 'px';
      var firstBtn = box.querySelector('button');
      if (firstBtn) firstBtn.focus();
      setTimeout(function () {
        document.addEventListener('pointerdown', dismissOnOutside, true);
        document.addEventListener('keydown', dismissOnEsc, true);
      }, 0);
      relationChooser = box; // re-use the same global so dismissOnOutside / Esc works
    }

    function showRelationChooser(clientX, clientY, sourceId, targetId) {
      closeRelationChooser();
      var type = typeSelect.value;
      var rels = relationSchemasFor(type);
      if (!rels.length) return;
      var box = document.createElement('div');
      box.className = 'uml-pg-relation-chooser';
      box.setAttribute('role', 'menu');
      box.setAttribute('aria-label', 'Pick a relation type');
      var title = document.createElement('div');
      title.className = 'uml-pg-relation-chooser-title';
      title.textContent = 'Connect "' + sourceId + '" → "' + targetId + '"';
      box.appendChild(title);
      rels.forEach(function (spec, idx) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'menuitem');
        var glyph = document.createElement('span');
        glyph.setAttribute('aria-hidden', 'true');
        glyph.style.color = '#2774AE';
        glyph.style.fontWeight = '700';
        glyph.style.minWidth = '1.4em';
        glyph.textContent = spec.glyph || '→';
        btn.appendChild(glyph);
        btn.appendChild(document.createTextNode(spec.label));
        btn.addEventListener('click', function () {
          textarea.value = addRelationToSource(textarea.value, type, spec, sourceId, targetId);
          closeRelationChooser();
          announce('Added ' + spec.label + ' from "' + sourceId + '" to "' + targetId + '".', false);
          renderDiagram();
        });
        box.appendChild(btn);
      });
      document.body.appendChild(box);
      // Position near the cursor, kept inside the viewport.
      var W = window.innerWidth, H = window.innerHeight;
      var rect = box.getBoundingClientRect();
      var x = Math.min(Math.max(clientX, 8), W - rect.width - 8);
      var y = Math.min(Math.max(clientY, 8), H - rect.height - 8);
      box.style.left = x + 'px';
      box.style.top = y + 'px';
      // Focus first item for keyboard nav.
      var firstBtn = box.querySelector('button');
      if (firstBtn) firstBtn.focus();
      // Close on outside click / Escape.
      setTimeout(function () {
        document.addEventListener('pointerdown', dismissOnOutside, true);
        document.addEventListener('keydown', dismissOnEsc, true);
      }, 0);
      relationChooser = box;
    }

    function dismissOnOutside(ev) {
      if (!relationChooser) return cleanupChooserListeners();
      if (!relationChooser.contains(ev.target)) {
        closeRelationChooser();
        cleanupChooserListeners();
      }
    }

    function dismissOnEsc(ev) {
      if (!relationChooser) return cleanupChooserListeners();
      if (ev.key === 'Escape') {
        ev.preventDefault();
        closeRelationChooser();
        cleanupChooserListeners();
      } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        var btns = Array.prototype.slice.call(relationChooser.querySelectorAll('button'));
        var i = btns.indexOf(document.activeElement);
        var next = ev.key === 'ArrowDown' ? (i + 1) % btns.length : (i - 1 + btns.length) % btns.length;
        if (btns[next]) btns[next].focus();
      }
    }

    function cleanupChooserListeners() {
      document.removeEventListener('pointerdown', dismissOnOutside, true);
      document.removeEventListener('keydown', dismissOnEsc, true);
    }

    function installExtendHandle(svg, layer, item, hitbox) {
      // Render a circular "+" handle on the right edge, centred vertically.
      var ns = 'http://www.w3.org/2000/svg';
      var hx = item.box.x + item.box.width;
      var hy = item.box.y + item.box.height / 2;
      var g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'uml-pg-extend-handle-group');
      var circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('class', 'uml-pg-extend-handle');
      circle.setAttribute('cx', hx);
      circle.setAttribute('cy', hy);
      circle.setAttribute('r', 9);
      circle.setAttribute('tabindex', '0');
      circle.setAttribute('role', 'button');
      circle.setAttribute('aria-label', 'Extend a relation from ' + (item.label || item.id));
      g.appendChild(circle);
      var plus = document.createElementNS(ns, 'text');
      plus.setAttribute('class', 'uml-pg-extend-handle-plus');
      plus.setAttribute('x', hx);
      plus.setAttribute('y', hy + 1);
      plus.textContent = '+';
      g.appendChild(plus);
      // Show the handle when hovering either the hitbox OR the handle itself.
      function show() { circle.classList.add('is-visible'); plus.style.opacity = '1'; }
      function hide() { circle.classList.remove('is-visible'); plus.style.opacity = ''; }
      hitbox.addEventListener('mouseenter', show);
      hitbox.addEventListener('mouseleave', hide);
      circle.addEventListener('mouseenter', show);
      circle.addEventListener('mouseleave', hide);
      hitbox.addEventListener('focus', show);
      hitbox.addEventListener('blur', hide);
      circle.addEventListener('focus', show);
      circle.addEventListener('blur', hide);
      circle.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        circle.setPointerCapture(ev.pointerId);
        var startPt = svgPoint(svg, ev.clientX, ev.clientY);
        var line = document.createElementNS(ns, 'line');
        line.setAttribute('class', 'uml-pg-extend-line');
        line.setAttribute('x1', hx);
        line.setAttribute('y1', hy);
        line.setAttribute('x2', startPt.x);
        line.setAttribute('y2', startPt.y);
        layer.appendChild(line);
        extendDragState = { svg: svg, layer: layer, line: line, sourceItem: item, sourceHitbox: hitbox, originX: hx, originY: hy };
        announce('Drag onto a target element. Release to choose a relation. Esc to cancel.', true);
      });
      // Keyboard activation on the handle: pressing Enter/Space starts a connect-mode
      // fallback (asks user to click target).
      circle.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          // Activate "association" relation tool by default; user can switch via palette.
          var spec = relationSchemasFor(typeSelect.value)[0];
          if (spec) {
            setActiveTool('relation', spec);
            pendingRelation = { spec: spec, sourceId: item.id };
            hitbox.classList.add('is-relation-source');
            announce('Press Enter on a target hitbox to connect, or pick a different relation in the palette.', true);
          }
        }
      });
      layer.appendChild(g);
    }

    function findItemAtPoint(svg, clientX, clientY) {
      var els = document.elementsFromPoint(clientX, clientY);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.classList && el.classList.contains('uml-pg-edit-hitbox')) {
          return { id: el.getAttribute('data-layout-id'), hitbox: el };
        }
      }
      return null;
    }

    function updateExtendDrag(ev, finish) {
      if (!extendDragState) return;
      var pt = svgPoint(extendDragState.svg, ev.clientX, ev.clientY);
      extendDragState.line.setAttribute('x2', pt.x);
      extendDragState.line.setAttribute('y2', pt.y);
      if (finish) {
        var hit = findItemAtPoint(extendDragState.svg, ev.clientX, ev.clientY);
        var sourceId = extendDragState.sourceItem.id;
        var svg = extendDragState.svg;
        // Clean up the rubberband line first
        if (extendDragState.line.parentNode) extendDragState.line.parentNode.removeChild(extendDragState.line);
        var clientX = ev.clientX, clientY = ev.clientY;
        extendDragState = null;
        if (!hit) {
          // Drop on empty canvas — offer to create a new element here, then
          // immediately follow up with the relation-type picker so the whole
          // gesture stays in flow.
          var rect = svg.getBoundingClientRect();
          if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
            announce('Drop inside the canvas to create or connect.', false);
            return;
          }
          showElementChooser(clientX, clientY, sourceId, function (spec) {
            if (!spec) return;
            snapshotForUndo();
            var type = typeSelect.value;
            var newId = generateUniqueId(textarea.value, type, spec.base);
            var place = svgPoint(svg, clientX, clientY);
            // Special pseudo / structural elements: route through placeElementAt
            // so they get the right surrounding source manipulation (state pseudo,
            // activity decision blocks, etc.).
            if (spec.pseudo || spec.activityPseudo || spec.activityDecision || spec.activityFork || spec.activityLane || spec.sequenceFragment || spec.isComposite) {
              placeElementAt(spec, place);
              // For these, we don't auto-connect — they have their own connect semantics.
              return;
            }
            var opts = { id: newId, label: newId, position: place };
            if (spec.isNote) opts.label = 'New note text';
            if (spec.isPort) opts.label = spec.portKind === 'portin' ? 'in' : 'out';
            textarea.value = addElementToSource(textarea.value, type, spec, opts);
            renderDiagram();
            setTimeout(function () {
              showRelationChooser(clientX, clientY, sourceId, newId);
            }, 60);
          });
          return;
        }
        var targetId = hit.id;
        if (targetId === sourceId && typeSelect.value !== 'sequence') {
          announce('Self-relations not supported here.', false);
          return;
        }
        showRelationChooser(clientX, clientY, sourceId, targetId);
      }
    }

    function handleHitboxClickForRelation(item, hitbox) {
      if (!activeTool || activeTool.kind !== 'relation') return false;
      if (!pendingRelation) {
        pendingRelation = { spec: activeTool.spec, sourceId: item.id };
        // Highlight pending source
        if (hitbox && hitbox.classList) hitbox.classList.add('is-relation-source');
        announce('Now click the target element for a ' + activeTool.spec.label + ' relation from "' + item.id + '". Press Esc to cancel.', true);
        return true;
      }
      var sourceId = pendingRelation.sourceId;
      var targetId = item.id;
      if (sourceId === targetId && typeSelect.value !== 'sequence') {
        announce('Pick a different target — self-loops are not supported here. Press Esc to cancel.', true);
        return true;
      }
      var spec = pendingRelation.spec;
      pendingRelation = null;
      snapshotForUndo();
      textarea.value = addRelationToSource(textarea.value, typeSelect.value, spec, sourceId, targetId);
      announce('Connected "' + sourceId + '" to "' + targetId + '". Tool stays active — pick another source or press Esc.', true);
      // Clear visual highlight
      var layer = output.querySelector('.uml-pg-edit-layer');
      if (layer) {
        Array.prototype.slice.call(layer.querySelectorAll('.is-relation-source')).forEach(function (el) {
          el.classList.remove('is-relation-source');
        });
      }
      renderDiagram();
      return true;
    }

    // ─── Properties panel ───
    var propsPane, propsContent, propsTitle, propsDelete;

    function parseClassDeclaration(line) {
      var t = line.trim();
      var info = { kind: 'class', isAbstract: false, name: '', stereotype: '', highlight: '', members: [], rawAfter: '', body: '' };
      var bodyMatch = t.match(/\{([\s\S]*)\}\s*$/);
      if (bodyMatch) {
        info.body = bodyMatch[1];
        t = t.replace(/\s*\{[\s\S]*\}\s*$/, '');
      }
      var m = t.match(/^(abstract\s+class|class|interface|enum)\s+("[^"]+"|\S+)(.*)$/i);
      if (!m) return info;
      info.kind = /abstract/i.test(m[1]) ? 'abstract' : (m[1].toLowerCase() === 'class' ? 'class' : m[1].toLowerCase());
      info.isAbstract = /abstract/i.test(m[1]);
      info.name = unquoteId(m[2]);
      var rest = m[3] || '';
      var stereo = rest.match(/<<\s*([^>]+?)\s*>>/);
      if (stereo) {
        info.stereotype = '<<' + stereo[1] + '>>';
        rest = rest.replace(/<<\s*[^>]+?\s*>>/, '');
      }
      var hl = rest.match(/\s+#([A-Za-z0-9]+)/);
      if (hl) {
        info.highlight = hl[1];
        rest = rest.replace(/\s+#[A-Za-z0-9]+/, '');
      }
      info.rawAfter = rest.trim();
      info.members = info.body.split(/[;\n]/).map(function (s) { return s.trim(); }).filter(Boolean).map(parseMemberLine);
      return info;
    }

    function parseMemberLine(line) {
      var t = line.trim();
      var member = { visibility: '+', isAbstract: false, isStatic: false, text: t };
      var m = t.match(/^([+\-#~])\s*(.*)$/);
      if (m) { member.visibility = m[1]; t = m[2]; }
      while (true) {
        var mod = t.match(/^\{(abstract|static)\}\s*(.*)$/i);
        if (!mod) break;
        if (mod[1].toLowerCase() === 'abstract') member.isAbstract = true;
        if (mod[1].toLowerCase() === 'static') member.isStatic = true;
        t = mod[2];
      }
      member.text = t;
      return member;
    }

    function buildClassLine(info) {
      var keyword;
      if (info.kind === 'abstract' || info.isAbstract && info.kind === 'class') keyword = 'abstract class';
      else if (info.kind === 'interface') keyword = 'interface';
      else if (info.kind === 'enum') keyword = 'enum';
      else keyword = 'class';
      var line = keyword + ' ' + (/[\s"<>]/.test(info.name) ? '"' + escapeQuoted(info.name) + '"' : info.name);
      if (info.stereotype) line += ' ' + info.stereotype;
      if (info.highlight) line += ' #' + String(info.highlight).replace(/^#/, '');
      if (info.rawAfter) line += ' ' + info.rawAfter;
      if (info.members && info.members.length) {
        var body = info.members.map(function (m) {
          var s = m.visibility || '+';
          if (m.isAbstract) s += ' {abstract}';
          if (m.isStatic) s += ' {static}';
          s += ' ' + (m.text || '').trim();
          return s.trim();
        }).join('; ');
        line += ' { ' + body + ' }';
      }
      return line;
    }

    function clearPropsPane() {
      if (!propsPane) return;
      propsPane.hidden = true;
      var splitProps = document.getElementById('uml-pg-split-props');
      if (splitProps) splitProps.hidden = true;
      if (propsContent) propsContent.textContent = '';
      if (propsTitle) propsTitle.textContent = 'Properties';
      if (propsDelete) propsDelete.hidden = true;
    }

    function rebuildPropsPane() {
      if (!propsPane) return;
      if (!editToggle || !editToggle.checked || selectionSize() === 0) {
        clearPropsPane();
        return;
      }
      propsContent.textContent = '';
      propsPane.hidden = false;
      var splitPropsEl = document.getElementById('uml-pg-split-props');
      if (splitPropsEl) splitPropsEl.hidden = false;
      if (propsDelete) propsDelete.hidden = false;
      if (selectionSize() > 1) {
        buildGroupProps();
        return;
      }
      if (selectedLayoutKind === 'route') {
        buildRelationProps();
      } else {
        buildElementProps();
      }
    }

    /**
     * Replace the wrap-button row with an inline condition prompt for the
     * chosen fragment kind, then wrap all currently-selected sequence-message
     * routes in a single fragment block.
     */
    function startSequenceWrap(kind, fieldset, buttonRow) {
      // par takes no condition — wrap immediately.
      if (kind === 'par') {
        commitWrap(kind, '');
        return;
      }
      // Replace button row with inline form
      var inlineForm = document.createElement('div');
      inlineForm.style.display = 'flex';
      inlineForm.style.gap = '6px';
      inlineForm.style.alignItems = 'center';
      inlineForm.style.flexWrap = 'wrap';
      var lbl = document.createElement('label');
      lbl.style.fontSize = '0.92em';
      lbl.style.fontWeight = '600';
      lbl.textContent = kind + ' [';
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.style.flex = '1 1 120px';
      inp.style.minWidth = '120px';
      var placeholders = {
        alt: 'condition',
        opt: 'if condition',
        loop: 'while condition',
        break: 'if condition'
      };
      inp.placeholder = placeholders[kind] || 'condition';
      inp.setAttribute('aria-label', kind + ' fragment condition');
      var lblClose = document.createElement('span');
      lblClose.style.fontSize = '0.92em';
      lblClose.textContent = ']';
      var ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'uml-pg-add-member';
      ok.textContent = '✓';
      ok.setAttribute('aria-label', 'Confirm wrap');
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'uml-pg-add-member';
      cancel.textContent = '✕';
      cancel.setAttribute('aria-label', 'Cancel wrap');
      var lblId = 'uml-pg-wrap-cond-' + Math.random().toString(36).slice(2, 9);
      inp.id = lblId;
      lbl.setAttribute('for', lblId);
      inlineForm.appendChild(lbl);
      inlineForm.appendChild(inp);
      inlineForm.appendChild(lblClose);
      inlineForm.appendChild(ok);
      inlineForm.appendChild(cancel);
      buttonRow.replaceWith(inlineForm);
      inp.focus();
      function done() {
        commitWrap(kind, inp.value.trim());
      }
      function abort() {
        inlineForm.replaceWith(buttonRow);
      }
      ok.addEventListener('click', done);
      cancel.addEventListener('click', abort);
      inp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); done(); }
        else if (ev.key === 'Escape') { ev.preventDefault(); abort(); }
      });
    }

    function commitWrap(kind, condition) {
      // Collect line indices for currently-selected route ids.
      var rIndices = relationLineIndices(textarea.value, typeSelect.value);
      var lineIdxs = [];
      Object.keys(selectedLayoutIds).forEach(function (id) {
        if (selectedLayoutIds[id] !== 'route') return;
        var ord = String(id).match(/^edge[-:_](\d+)$/);
        if (ord && rIndices[Number(ord[1])] != null) {
          lineIdxs.push(rIndices[Number(ord[1])]);
        }
      });
      if (!lineIdxs.length) {
        announce('Could not locate the selected messages in the source.', false);
        return;
      }
      lineIdxs.sort(function (a, b) { return a - b; });
      var first = lineIdxs[0];
      var last = lineIdxs[lineIdxs.length - 1];

      snapshotForUndo();
      var positions = readLayoutPositions(textarea.value);
      var routes = readLayoutRoutes(textarea.value);
      var clean = stripLayoutMetadata(textarea.value);
      var lines = clean.split('\n');

      var opener = condition ? (kind + ' [' + condition + ']') : kind;

      // Indent the wrapped range two spaces and inject `else` between first and last
      // for alt and par.
      var wrapped = [];
      for (var i = first; i <= last; i++) {
        wrapped.push('  ' + lines[i]);
      }
      // For alt/par with multiple selected lines, insert one `else` placeholder
      // between the first and the last selected line indices (relative to
      // wrapped, not absolute line numbers).
      if ((kind === 'alt' || kind === 'par') && lineIdxs.length >= 2) {
        // Relative positions of first and last within `wrapped`:
        var lastRel = last - first;
        // Insert `else` directly before the last wrapped line.
        wrapped.splice(lastRel, 0, kind === 'alt' ? 'else [otherwise]' : 'else');
      }
      var newLines = lines.slice(0, first)
        .concat([opener])
        .concat(wrapped)
        .concat(['end'])
        .concat(lines.slice(last + 1));
      textarea.value = writePositionsIntoSource(newLines.join('\n'), typeSelect.value, positions, routes);
      announce('Wrapped ' + lineIdxs.length + ' message' + (lineIdxs.length === 1 ? '' : 's') + ' in ' + kind + '.', false);
      setSelectedLayoutId(null);
      renderDiagram();
    }

    function buildGroupProps() {
      var ids = Object.keys(selectedLayoutIds);
      var nNodes = 0, nRoutes = 0;
      ids.forEach(function (id) {
        if (selectedLayoutIds[id] === 'route') nRoutes++; else nNodes++;
      });
      propsTitle.textContent = ids.length + ' selected';
      var summary = document.createElement('p');
      summary.className = 'uml-pg-prop-hint';
      var parts = [];
      if (nNodes) parts.push(nNodes + ' element' + (nNodes === 1 ? '' : 's'));
      if (nRoutes) parts.push(nRoutes + ' relation' + (nRoutes === 1 ? '' : 's'));
      summary.textContent = parts.join(' + ') + ' selected. Drag any selected element to move all together. Press Delete to remove all.';
      propsContent.appendChild(summary);

      // For sequence diagrams, offer "Wrap in fragment".
      if (typeSelect.value === 'sequence' && nRoutes >= 1) {
        var fs = document.createElement('fieldset');
        fs.className = 'uml-pg-prop-fieldset';
        var leg = document.createElement('legend');
        leg.textContent = 'Wrap in combined fragment';
        fs.appendChild(leg);
        var btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '6px';
        btnRow.style.flexWrap = 'wrap';
        ['alt', 'opt', 'loop', 'par', 'break'].forEach(function (kind) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'uml-pg-add-member';
          b.textContent = kind;
          b.setAttribute('aria-label', 'Wrap selected messages in ' + kind + ' fragment');
          b.addEventListener('click', function () {
            startSequenceWrap(kind, fs, btnRow);
          });
          btnRow.appendChild(b);
        });
        fs.appendChild(btnRow);
        propsContent.appendChild(fs);
      }
    }

    function field(label, ctrl) {
      var row = document.createElement('div');
      row.className = 'uml-pg-prop-row';
      var lab = document.createElement('label');
      var fieldId = 'uml-pg-prop-' + Math.random().toString(36).slice(2, 9);
      ctrl.id = fieldId;
      lab.setAttribute('for', fieldId);
      lab.textContent = label;
      row.appendChild(lab);
      row.appendChild(ctrl);
      return row;
    }

    function checkbox(label, checked, onChange) {
      var wrap = document.createElement('label');
      wrap.className = 'uml-pg-prop-checkbox';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !!checked;
      box.addEventListener('change', function () { onChange(box.checked); });
      wrap.appendChild(box);
      wrap.appendChild(document.createTextNode(' ' + label));
      return wrap;
    }

    function textInput(value, onChange) {
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.value = value || '';
      var commit = function () { onChange(inp.value); };
      inp.addEventListener('change', commit);
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
      });
      return inp;
    }

    function selectInput(options, value, onChange) {
      var sel = document.createElement('select');
      options.forEach(function (opt) {
        var o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === value) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () { onChange(sel.value); });
      return sel;
    }

    function buildElementProps() {
      var type = typeSelect.value;
      var id = selectedLayoutId;
      var line = getDeclarationLine(textarea.value, type, id);
      var schema = null;
      // Detect schema from line
      if (line) {
        var t = line.trim();
        if (type === 'class') {
          if (/^abstract\s+class\b/i.test(t)) schema = findElementSchema('class', 'abstract');
          else if (/^class\b/i.test(t)) schema = findElementSchema('class', 'class');
          else if (/^interface\b/i.test(t)) schema = findElementSchema('class', 'interface');
          else if (/^enum\b/i.test(t)) schema = findElementSchema('class', 'enum');
        } else if (type === 'sequence') {
          if (/^actor\b/i.test(t)) schema = findElementSchema('sequence', 'actor');
          else if (/^participant\b/i.test(t)) schema = findElementSchema('sequence', 'participant');
        } else if (type === 'state') {
          schema = findElementSchema('state', 'state');
        } else if (type === 'component') schema = findElementSchema('component', 'component');
        else if (type === 'deployment') {
          if (/^node\b/i.test(t)) schema = findElementSchema('deployment', 'node');
          else if (/^component\b/i.test(t)) schema = findElementSchema('deployment', 'component');
          else if (/^artifact\b/i.test(t)) schema = findElementSchema('deployment', 'artifact');
        } else if (type === 'usecase') {
          if (/^actor\b/i.test(t)) schema = findElementSchema('usecase', 'actor');
          else if (/^usecase\b/i.test(t)) schema = findElementSchema('usecase', 'usecase');
          else if (/^rectangle\b/i.test(t)) schema = findElementSchema('usecase', 'system');
        } else if (type === 'er') {
          if (/^weak\s+entity\b/i.test(t)) schema = findElementSchema('er', 'weak');
          else if (/^entity\b/i.test(t)) schema = findElementSchema('er', 'entity');
          else if (/^identifying\s+relationship\b/i.test(t)) schema = findElementSchema('er', 'idrel');
          else if (/^relationship\b/i.test(t)) schema = findElementSchema('er', 'relationship');
        } else if (type === 'activity') {
          schema = findElementSchema('activity', 'action');
        }
      }
      propsTitle.textContent = (schema ? schema.label + ' — ' : 'Element — ') + id;

      // Class — full editor (name, kind, stereotype, abstract, members)
      if (type === 'class' && schema) {
        var info = parseClassDeclaration(line || (schema.keyword + ' ' + id));
        propsContent.appendChild(field('Name (id)', textInput(info.name, function (v) {
          info.name = v.trim() || info.name;
          replaceClassDeclaration(id, info);
        })));
        propsContent.appendChild(field('Kind', selectInput(
          [{ value: 'class', label: 'Class' }, { value: 'abstract', label: 'Abstract Class' },
           { value: 'interface', label: 'Interface' }, { value: 'enum', label: 'Enum' }],
          info.kind, function (v) { info.kind = v; info.isAbstract = (v === 'abstract'); replaceClassDeclaration(id, info); })));
        propsContent.appendChild(field('Stereotype (e.g. <<service>>)', textInput(info.stereotype, function (v) {
          info.stereotype = v.trim() ? (/^<</.test(v.trim()) ? v.trim() : '<<' + v.trim().replace(/<<|>>/g, '') + '>>') : '';
          replaceClassDeclaration(id, info);
        })));
        propsContent.appendChild(field('Highlight color (#hex or color name)', textInput(info.highlight, function (v) {
          info.highlight = v.trim();
          replaceClassDeclaration(id, info);
        })));

        var memFs = document.createElement('fieldset');
        memFs.className = 'uml-pg-prop-fieldset';
        var memLeg = document.createElement('legend');
        memLeg.textContent = 'Members';
        memFs.appendChild(memLeg);
        var list = document.createElement('div');
        list.className = 'uml-pg-member-list';
        memFs.appendChild(list);

        function renderMembers() {
          list.textContent = '';
          info.members.forEach(function (m, idx) {
            var row = document.createElement('div');
            row.className = 'uml-pg-member';
            var vis = document.createElement('select');
            vis.className = 'uml-pg-member-vis';
            vis.setAttribute('aria-label', 'Visibility');
            ['+ public', '- private', '# protected', '~ package'].forEach(function (lab) {
              var o = document.createElement('option');
              o.value = lab.charAt(0);
              o.textContent = lab;
              if (o.value === m.visibility) o.selected = true;
              vis.appendChild(o);
            });
            vis.addEventListener('change', function () { m.visibility = vis.value; replaceClassDeclaration(id, info); });

            var txt = document.createElement('input');
            txt.type = 'text';
            txt.placeholder = 'name: type   or   method(args): type';
            txt.value = m.text || '';
            txt.setAttribute('aria-label', 'Member text (member ' + (idx + 1) + ')');
            txt.addEventListener('change', function () { m.text = txt.value; replaceClassDeclaration(id, info); });
            txt.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); m.text = txt.value; replaceClassDeclaration(id, info); } });

            var rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'uml-pg-member-remove';
            rm.setAttribute('aria-label', 'Delete member ' + (idx + 1));
            rm.textContent = '✕';
            rm.addEventListener('click', function () {
              info.members.splice(idx, 1);
              replaceClassDeclaration(id, info);
              renderMembers();
            });

            row.appendChild(vis);
            row.appendChild(txt);
            row.appendChild(rm);

            var flags = document.createElement('div');
            flags.className = 'uml-pg-member-flags';
            flags.style.gridColumn = '1 / -1';
            flags.appendChild(checkbox('abstract', m.isAbstract, function (b) { m.isAbstract = b; replaceClassDeclaration(id, info); }));
            flags.appendChild(checkbox('static', m.isStatic, function (b) { m.isStatic = b; replaceClassDeclaration(id, info); }));
            row.appendChild(flags);
            list.appendChild(row);
          });
        }
        renderMembers();

        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'uml-pg-add-member';
        addBtn.textContent = '+ Add Member';
        addBtn.addEventListener('click', function () {
          info.members.push({ visibility: '+', text: 'newMember', isAbstract: false, isStatic: false });
          replaceClassDeclaration(id, info);
          renderMembers();
        });
        memFs.appendChild(addBtn);
        propsContent.appendChild(memFs);
        return;
      }

      // Generic element editor for the other types — name, label, stereotype.
      var current = parseGenericElement(line, type);
      propsContent.appendChild(field('Identifier', textInput(id, function (v) {
        renameElement(id, v.trim() || id);
      })));
      if (schema && schema.supports && schema.supports.displayLabel) {
        propsContent.appendChild(field('Display label', textInput(current.label || id, function (v) {
          current.label = v;
          replaceGenericElement(id, schema, current);
        })));
      }
      if (schema && schema.supports && schema.supports.stereotype) {
        propsContent.appendChild(field('Stereotype (e.g. <<choice>>)', textInput(current.stereotype || '', function (v) {
          current.stereotype = v.trim() ? (/^<</.test(v.trim()) ? v.trim() : '<<' + v.trim().replace(/<<|>>/g, '') + '>>') : '';
          replaceGenericElement(id, schema, current);
        })));
      }
      if (schema && schema.supports && schema.supports.dashed) {
        propsContent.appendChild(checkbox('Dashed outline', /\bdashed\b/i.test(line || ''), function (b) {
          current.dashed = b;
          replaceGenericElement(id, schema, current);
        }));
      }
      if (schema && schema.supports && schema.supports.highlight) {
        var hlMatch = (line || '').match(/\s+#([A-Za-z0-9]+)/);
        propsContent.appendChild(field('Highlight color (#hex or name)', textInput(hlMatch ? hlMatch[1] : '', function (v) {
          current.highlight = v.trim();
          replaceGenericElement(id, schema, current);
        })));
      }
      // ─── Container children editors (composite state / component ports / ER attrs) ───
      if (type === 'state' && line) {
        var body = parseBraceBody(line);
        if (body || (schema && schema.supports && schema.supports.subStates)) {
          var parsed = parseStateBody(body);
          var fs = document.createElement('fieldset');
          fs.className = 'uml-pg-prop-fieldset';
          var leg = document.createElement('legend');
          leg.textContent = 'Sub-states';
          fs.appendChild(leg);
          var list = document.createElement('div');
          list.className = 'uml-pg-member-list';
          fs.appendChild(list);

          function commitState() {
            var newBody = buildStateBody(parsed);
            var newLine = setBraceBody(line, newBody);
            replaceLineForElementId(id, newLine);
          }
          function renderChildren() {
            list.textContent = '';
            parsed.children.forEach(function (c, idx) {
              var row = document.createElement('div');
              row.className = 'uml-pg-member';
              var name = document.createElement('input');
              name.type = 'text';
              name.value = c.name;
              name.placeholder = 'Sub-state name';
              name.setAttribute('aria-label', 'Sub-state ' + (idx + 1) + ' name');
              name.addEventListener('change', function () { c.name = name.value.trim() || c.name; commitState(); });
              var rm = document.createElement('button');
              rm.type = 'button';
              rm.className = 'uml-pg-member-remove';
              rm.textContent = '✕';
              rm.setAttribute('aria-label', 'Remove sub-state ' + (idx + 1));
              rm.addEventListener('click', function () { parsed.children.splice(idx, 1); commitState(); });
              // Two-cell row: span the name across the visibility column for layout consistency
              var spacer = document.createElement('span');
              spacer.style.gridColumn = '1';
              row.appendChild(spacer);
              row.appendChild(name);
              row.appendChild(rm);
              list.appendChild(row);
            });
          }
          renderChildren();
          var add = document.createElement('button');
          add.type = 'button';
          add.className = 'uml-pg-add-member';
          add.textContent = '+ Add sub-state';
          add.addEventListener('click', function () {
            var newName = generateUniqueId(textarea.value, type, 'Sub');
            parsed.children.push({ kind: 'state', name: newName, stereotype: '' });
            commitState();
          });
          fs.appendChild(add);
          propsContent.appendChild(fs);
        }
      }

      if (type === 'component' && line && /^component\b/i.test(line.trim())) {
        var compBody = parseBraceBody(line);
        var parsedComp = parseComponentBody(compBody);
        var compFs = document.createElement('fieldset');
        compFs.className = 'uml-pg-prop-fieldset';
        var compLeg = document.createElement('legend');
        compLeg.textContent = 'Ports & Interfaces';
        compFs.appendChild(compLeg);
        var compList = document.createElement('div');
        compList.className = 'uml-pg-member-list';
        compFs.appendChild(compList);

        function commitComp() {
          var newBody = buildComponentBody(parsedComp);
          var newLine = setBraceBody(line, newBody);
          replaceLineForElementId(id, newLine);
        }
        function renderPorts() {
          compList.textContent = '';
          parsedComp.ports.forEach(function (p, idx) {
            var row = document.createElement('div');
            row.className = 'uml-pg-member';
            var kindSel = document.createElement('select');
            kindSel.className = 'uml-pg-member-vis';
            kindSel.setAttribute('aria-label', 'Port / interface kind');
            [
              ['portin',  '→ port-in'],
              ['portout', 'port-out →'],
              ['port',    'port (standalone)'],
              ['provide', '○ provide (ball)'],
              ['require', '⊃ require (socket)']
            ].forEach(function (pair) {
              var o = document.createElement('option');
              o.value = pair[0]; o.textContent = pair[1];
              if (pair[0] === p.kind) o.selected = true;
              kindSel.appendChild(o);
            });
            kindSel.addEventListener('change', function () { p.kind = kindSel.value; commitComp(); });
            var nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = p.label || '';
            nameInput.placeholder = 'Port name';
            nameInput.setAttribute('aria-label', 'Port ' + (idx + 1) + ' name');
            nameInput.addEventListener('change', function () {
              p.label = nameInput.value;
              if (!p.alias || p.alias === p.label) p.alias = nameInput.value;
              commitComp();
            });
            var rmBtn = document.createElement('button');
            rmBtn.type = 'button';
            rmBtn.className = 'uml-pg-member-remove';
            rmBtn.setAttribute('aria-label', 'Remove port ' + (idx + 1));
            rmBtn.textContent = '✕';
            rmBtn.addEventListener('click', function () { parsedComp.ports.splice(idx, 1); commitComp(); });
            row.appendChild(kindSel);
            row.appendChild(nameInput);
            row.appendChild(rmBtn);
            var flags = document.createElement('div');
            flags.className = 'uml-pg-member-flags';
            flags.style.gridColumn = '1 / -1';
            flags.appendChild(checkbox('dashed', p.dashed, function (b) { p.dashed = b; commitComp(); }));
            row.appendChild(flags);
            compList.appendChild(row);
          });
        }
        renderPorts();
        var addInBtn = document.createElement('button');
        addInBtn.type = 'button';
        addInBtn.className = 'uml-pg-add-member';
        addInBtn.textContent = '+ Add port-in';
        addInBtn.addEventListener('click', function () {
          var alias = generateUniqueId(textarea.value, type, 'in');
          parsedComp.ports.push({ kind: 'portin', label: alias, alias: alias, dashed: false });
          commitComp();
        });
        compFs.appendChild(addInBtn);
        var addOutBtn = document.createElement('button');
        addOutBtn.type = 'button';
        addOutBtn.className = 'uml-pg-add-member';
        addOutBtn.textContent = '+ Add port-out';
        addOutBtn.style.marginLeft = '6px';
        addOutBtn.addEventListener('click', function () {
          var alias = generateUniqueId(textarea.value, type, 'out');
          parsedComp.ports.push({ kind: 'portout', label: alias, alias: alias, dashed: false });
          commitComp();
        });
        compFs.appendChild(addOutBtn);
        var addProvideBtn = document.createElement('button');
        addProvideBtn.type = 'button';
        addProvideBtn.className = 'uml-pg-add-member';
        addProvideBtn.textContent = '+ Provided I/F';
        addProvideBtn.style.marginLeft = '6px';
        addProvideBtn.setAttribute('aria-label', 'Add provided interface (ball)');
        addProvideBtn.addEventListener('click', function () {
          var alias = generateUniqueId(textarea.value, type, 'p_iface');
          parsedComp.ports.push({ kind: 'provide', label: alias, alias: alias, dashed: false });
          commitComp();
        });
        compFs.appendChild(addProvideBtn);
        var addRequireBtn = document.createElement('button');
        addRequireBtn.type = 'button';
        addRequireBtn.className = 'uml-pg-add-member';
        addRequireBtn.textContent = '+ Required I/F';
        addRequireBtn.style.marginLeft = '6px';
        addRequireBtn.setAttribute('aria-label', 'Add required interface (socket)');
        addRequireBtn.addEventListener('click', function () {
          var alias = generateUniqueId(textarea.value, type, 'r_iface');
          parsedComp.ports.push({ kind: 'require', label: alias, alias: alias, dashed: false });
          commitComp();
        });
        compFs.appendChild(addRequireBtn);
        propsContent.appendChild(compFs);
      }

      if (type === 'er' && line && /^(entity|weak\s+entity|relationship|identifying\s+relationship)\b/i.test(line.trim())) {
        var erBody = parseBraceBody(line);
        var parsedEr = parseEntityBody(erBody);
        var erFs = document.createElement('fieldset');
        erFs.className = 'uml-pg-prop-fieldset';
        var erLeg = document.createElement('legend');
        erLeg.textContent = 'Attributes';
        erFs.appendChild(erLeg);
        var erList = document.createElement('div');
        erList.className = 'uml-pg-member-list';
        erFs.appendChild(erList);

        function commitEr() {
          var newBody = buildEntityBody(parsedEr);
          var newLine = setBraceBody(line, newBody);
          replaceLineForElementId(id, newLine);
        }
        function renderAttrs() {
          erList.textContent = '';
          parsedEr.attrs.forEach(function (a, idx) {
            var row = document.createElement('div');
            row.className = 'uml-pg-member';
            var markerSel = document.createElement('select');
            markerSel.className = 'uml-pg-member-vis';
            markerSel.setAttribute('aria-label', 'Attribute kind');
            [['', 'attr'], ['#', '# pk'], ['~', '~ partial key'], ['/', '/ derived'], ['*', '* multivalued']].forEach(function (pair) {
              var o = document.createElement('option');
              o.value = pair[0]; o.textContent = pair[1];
              if (pair[0] === a.marker) o.selected = true;
              markerSel.appendChild(o);
            });
            markerSel.addEventListener('change', function () { a.marker = markerSel.value; commitEr(); });
            var nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = a.name || '';
            nameInput.placeholder = 'attribute_name';
            nameInput.setAttribute('aria-label', 'Attribute ' + (idx + 1) + ' name');
            nameInput.addEventListener('change', function () { a.name = nameInput.value; commitEr(); });
            var rmBtn = document.createElement('button');
            rmBtn.type = 'button';
            rmBtn.className = 'uml-pg-member-remove';
            rmBtn.setAttribute('aria-label', 'Remove attribute ' + (idx + 1));
            rmBtn.textContent = '✕';
            rmBtn.addEventListener('click', function () { parsedEr.attrs.splice(idx, 1); commitEr(); });
            row.appendChild(markerSel);
            row.appendChild(nameInput);
            row.appendChild(rmBtn);
            erList.appendChild(row);
          });
        }
        renderAttrs();
        var erAdd = document.createElement('button');
        erAdd.type = 'button';
        erAdd.className = 'uml-pg-add-member';
        erAdd.textContent = '+ Add attribute';
        erAdd.addEventListener('click', function () {
          parsedEr.attrs.push({ marker: '', name: 'new_attribute' });
          commitEr();
        });
        erFs.appendChild(erAdd);
        propsContent.appendChild(erFs);
      }

      // Sequence-specific helpers: activate/deactivate buttons for participants/actors.
      if (type === 'sequence') {
        var seqFs = document.createElement('fieldset');
        seqFs.className = 'uml-pg-prop-fieldset';
        var seqLeg = document.createElement('legend');
        seqLeg.textContent = 'Lifeline';
        seqFs.appendChild(seqLeg);
        seqFs.appendChild(makeQuickInsertButton('activate', 'activate ' + id, 'Add an activate ' + id + ' bar'));
        seqFs.appendChild(makeQuickInsertButton('deactivate', 'deactivate ' + id, 'Add a deactivate ' + id + ' marker'));
        seqFs.appendChild(makeQuickInsertButton('destroy', 'destroy ' + id, 'Mark ' + id + ' as destroyed (X)'));
        propsContent.appendChild(seqFs);
      }

      var hint = document.createElement('p');
      hint.className = 'uml-pg-prop-hint';
      hint.textContent = 'Press Delete to remove. Press F2 to focus the name. Drag to reposition.';
      propsContent.appendChild(hint);
    }

    function makeQuickInsertButton(label, line, ariaLabel) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'uml-pg-add-member';
      btn.textContent = '+ ' + label;
      btn.setAttribute('aria-label', ariaLabel || label);
      btn.style.alignSelf = 'flex-start';
      btn.addEventListener('click', function () {
        snapshotForUndo();
        textarea.value = appendRawLine(textarea.value, line);
        renderDiagram();
        announce('Inserted: ' + line, false);
      });
      return btn;
    }

    // ─── Container child helpers (composite state, component ports, ER attrs) ───

    function parseBraceBody(line) {
      var m = String(line || '').match(/\{([\s\S]*)\}\s*$/);
      return m ? m[1] : '';
    }

    function setBraceBody(line, body) {
      // Drop existing { ... } and append new body. If new body empty, drop entirely.
      var stripped = String(line || '').replace(/\s*\{[\s\S]*\}\s*$/, '');
      if (!body || !body.trim()) return stripped;
      return stripped + ' { ' + body.trim() + ' }';
    }

    function parseStateBody(body) {
      // Body is a list of `state X` substates (separated by ; or \n).
      // Other forms (transitions inside composite) are preserved as-is.
      var pieces = (body || '').split(/[;\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
      var children = [];
      var raw = [];
      pieces.forEach(function (p) {
        var m = p.match(/^state\s+("[^"]+"|\S+)(?:\s+(<<[^>]+>>))?\s*$/i);
        if (m) {
          children.push({ kind: 'state', name: unquoteId(m[1]), stereotype: m[2] || '' });
        } else {
          raw.push(p);
        }
      });
      return { children: children, raw: raw };
    }

    function buildStateBody(parsed) {
      var pieces = parsed.children.map(function (c) {
        var s = 'state ' + (/[\s"<>]/.test(c.name) ? '"' + escapeQuoted(c.name) + '"' : c.name);
        if (c.stereotype) s += ' ' + c.stereotype;
        return s;
      });
      pieces = pieces.concat(parsed.raw);
      return pieces.join('; ');
    }

    function parseComponentBody(body) {
      // Body holds portin/portout/port and provide/require lines plus arbitrary
      // raw lines. Split by ; or \n.
      var pieces = (body || '').split(/[;\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
      var ports = [];
      var raw = [];
      pieces.forEach(function (p) {
        var m = p.match(/^(portin|portout|port|provide|require)\s+(?:"((?:[^"\\]|\\.)*)"|(\S+?))(?:\s+as\s+(\S+))?(?:\s+(dashed))?$/i);
        if (m) {
          ports.push({
            kind: m[1].toLowerCase(),
            label: m[2] || m[3],
            alias: m[4] || (m[2] || m[3]),
            dashed: !!m[5]
          });
        } else {
          raw.push(p);
        }
      });
      return { ports: ports, raw: raw };
    }

    function buildComponentBody(parsed) {
      var pieces = parsed.ports.map(function (p) {
        var s = (p.kind || 'portin') + ' "' + escapeQuoted(p.label || '') + '"';
        if (p.alias && p.alias !== p.label) s += ' as ' + p.alias;
        if (p.dashed) s += ' dashed';
        return s;
      });
      pieces = pieces.concat(parsed.raw);
      return pieces.join('; ');
    }

    function parseEntityBody(body) {
      // Body = list of attributes, each prefixed with #, /, *, ~ or none.
      var pieces = (body || '').split(/[;\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
      var attrs = [];
      pieces.forEach(function (p) {
        var marker = '';
        var name = p;
        var m = p.match(/^([#~/\*])\s*(.*)$/);
        if (m) { marker = m[1]; name = m[2]; }
        attrs.push({ marker: marker, name: name });
      });
      return { attrs: attrs };
    }

    function buildEntityBody(parsed) {
      return parsed.attrs.map(function (a) {
        return (a.marker ? a.marker + ' ' : '') + (a.name || '');
      }).join('; ');
    }

    // Generic helper: replace the source line for an element id with a new line.
    // Handles multi-line `{ ... }` blocks too — collapses the whole block into newLine.
    function replaceLineForElementId(elementId, newLine) {
      var type = typeSelect.value;
      var sourceText = textarea.value;
      // Coalesce by element id so rapid attribute edits in the props panel
      // become a single undo step.
      snapshotForUndo('edit:' + elementId);
      sourceText = replaceBlockByMatch(sourceText, type, function (line) {
        return declarationIdForLine(line, type) === elementId;
      }, newLine);
      textarea.value = sourceText;
      renderDiagram();
      selectAfterRender(elementId, 'node');
    }

    function parseGenericElement(line, type) {
      var info = { name: '', label: '', stereotype: '', dashed: false };
      if (!line) return info;
      var t = line.trim();
      var st = t.match(/<<\s*([^>]+?)\s*>>/);
      if (st) info.stereotype = '<<' + st[1] + '>>';
      var m = t.match(/^(actor|participant|state|node|component|usecase|artifact|entity|weak\s+entity|relationship|identifying\s+relationship|rectangle)\s+(.+)$/i);
      if (m) {
        var rest = m[2].trim();
        // pull body off
        rest = rest.replace(/\s*\{[\s\S]*\}\s*$/, '');
        rest = rest.replace(/\s*<<\s*[^>]+?\s*>>/, '');
        rest = rest.replace(/\s+#[A-Za-z0-9]+\b/, '');
        rest = rest.replace(/\s+dashed\b/i, function () { info.dashed = true; return ''; });
        // Patterns: "Label" as id   |   id: Label   |   "Label"   |   id
        var qm = rest.match(/^"((?:[^"\\]|\\.)*)"\s+as\s+(\S+)$/);
        if (qm) { info.label = qm[1]; info.name = qm[2]; return info; }
        var asm = rest.match(/^(\S+)\s+as\s+(\S+)$/);
        if (asm) { info.label = unquoteId(asm[1]); info.name = asm[2]; return info; }
        var col = rest.match(/^(\S+)\s*:\s*(.+)$/);
        if (col) { info.name = col[1]; info.label = col[2].trim(); return info; }
        var quoted = rest.match(/^"((?:[^"\\]|\\.)*)"$/);
        if (quoted) { info.name = quoted[1]; info.label = quoted[1]; return info; }
        info.name = unquoteId(rest);
        info.label = info.name;
      }
      return info;
    }

    function replaceClassDeclaration(oldId, info) {
      snapshotForUndo('edit:' + oldId);
      var type = typeSelect.value;
      var newLine = buildClassLine(info);
      var newId = info.name;
      var sourceText = textarea.value;
      sourceText = replaceLineByMatch(sourceText, type, function (line) {
        return declarationIdForLine(line, type) === oldId;
      }, newLine);
      if (newId !== oldId && newId) sourceText = renameReferencesInRelations(sourceText, oldId, newId);
      textarea.value = sourceText;
      var preserveId = (newId !== oldId && newId) ? newId : oldId;
      renderDiagram();
      selectAfterRender(preserveId, 'node');
    }

    function replaceGenericElement(oldId, schema, info) {
      snapshotForUndo('edit:' + oldId);
      var type = typeSelect.value;
      var newId = (info.name || oldId).trim();
      var label = info.label || newId;
      var declLine = buildElementLine(schema, newId, { label: label, stereotype: info.stereotype });
      if (info.dashed && /\bcomponent\b/.test(declLine)) declLine = declLine.replace(/\s+dashed\b/i, '') + ' dashed';
      var sourceText = textarea.value;
      sourceText = replaceLineByMatch(sourceText, type, function (line) {
        return declarationIdForLine(line, type) === oldId;
      }, declLine);
      if (newId !== oldId && newId) sourceText = renameReferencesInRelations(sourceText, oldId, newId);
      textarea.value = sourceText;
      renderDiagram();
      selectAfterRender(newId, 'node');
    }

    function renameReferencesInRelations(text, oldId, newId) {
      var positions = readLayoutPositions(text);
      var routes = readLayoutRoutes(text);
      // Migrate positions/routes keyed by oldId → newId.
      if (positions[oldId]) { positions[newId] = positions[oldId]; delete positions[oldId]; }
      Object.keys(routes).forEach(function (rid) {
        if (rid === oldId) { routes[newId] = routes[rid]; delete routes[rid]; }
      });
      var clean = stripLayoutMetadata(text);
      var lines = clean.split('\n');
      var re = new RegExp('(^|[^\\w.])' + oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^\\w])', 'g');
      var quotedRe = new RegExp('"' + oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 'g');
      for (var i = 0; i < lines.length; i++) {
        // Only rewrite relation/usage lines (don't double-rewrite the rename target,
        // which has already been replaced by replaceLineByMatch).
        if (declarationIdForLine(lines[i], typeSelect.value) === newId) continue;
        lines[i] = lines[i].replace(re, function (m, pre) { return pre + newId; });
        lines[i] = lines[i].replace(quotedRe, '"' + newId + '"');
      }
      return writePositionsIntoSource(lines.join('\n'), typeSelect.value, positions, routes);
    }

    function renameElement(oldId, newId) {
      if (!newId || newId === oldId) return;
      var type = typeSelect.value;
      var taken = existingIds(textarea.value, type);
      if (taken[newId]) {
        announce('"' + newId + '" is already used. Pick a different identifier.', true);
        return;
      }
      snapshotForUndo();
      var sourceText = textarea.value;
      // Re-emit declaration with the new id, then rewrite references.
      var line = getDeclarationLine(sourceText, type, oldId);
      if (line == null) return;
      var declId = declarationIdForLine(line, type);
      var renamed = line;
      // Substitute the declared identifier token. Be conservative — just swap the
      // first whole-word occurrence of oldId in the declaration line.
      var re = new RegExp('\\b' + oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      renamed = renamed.replace(re, newId);
      sourceText = replaceLineByMatch(sourceText, type, function (l) { return declarationIdForLine(l, type) === oldId; }, renamed);
      sourceText = renameReferencesInRelations(sourceText, oldId, newId);
      textarea.value = sourceText;
      renderDiagram();
      selectAfterRender(newId, 'node');
    }

    function relationLineIndices(text, type) {
      // Return indices of source lines that look like a relation (have a connector
      // operator) and aren't declarations themselves.
      var lines = stripLayoutMetadata(text).split('\n');
      var out = [];
      var connectorRe = /(?:^|\s)(?:<-->|<->|<-+|--?\|>?|\.\.\|>?|\.\.+>?|\*-+>?|\*<-+>?|o-+>?|o<-+>?|->>?|--+x?|==+|--+>|\.\.>|--?)/;
      for (var i = 0; i < lines.length; i++) {
        var t = lines[i].trim();
        if (!t || /^@/.test(t) || /^layout\s+/i.test(t)) continue;
        if (declarationIdForLine(lines[i], type)) continue;
        if (/^(activate|deactivate|destroy|create|note\b|portin\b|portout\b|fork|endfork|if\s+|else|endif|\|)/i.test(t)) continue;
        // Must contain a connector + at least one whitespace
        if (/\s+(?:--|\.\.|->|<-|==|--?\|>?|\.\.>|->>|<-->|\*-|o-)\S*\s+\S/.test(t)) out.push(i);
      }
      return out;
    }

    function buildRelationProps() {
      var type = typeSelect.value;
      var id = String(selectedLayoutId || '');
      var lines = stripLayoutMetadata(textarea.value).split('\n');
      var sourceId = null, targetId = null, lineIdx = -1, lineText = '';
      // First try: explicit source|target encoding (used by some renderers).
      var routeMatch = id.match(/^edge:([^|]+)\|([^|]+)$/);
      if (routeMatch) {
        sourceId = routeMatch[1]; targetId = routeMatch[2];
        for (var i = 0; i < lines.length; i++) {
          if (lineMentionsId(lines[i], sourceId) && lineMentionsId(lines[i], targetId) &&
              /[-.<=>|*ox]/.test(lines[i]) && !/^@/.test(lines[i].trim())) {
            lineIdx = i;
            lineText = lines[i];
            break;
          }
        }
      }
      // Fallback: ordinal match (route N ↔ Nth relation line in the source).
      if (lineIdx === -1) {
        var ordinalMatch = id.match(/^edge[-:_](\d+)$/);
        if (ordinalMatch) {
          var n = Number(ordinalMatch[1]);
          var indices = relationLineIndices(textarea.value, type);
          if (indices[n] != null) {
            lineIdx = indices[n];
            lineText = lines[lineIdx];
          }
        }
      }
      // Parse to get source/target if we have a line.
      var preInfo = parseRelationLine(lineText);
      if (preInfo.source) sourceId = preInfo.source;
      if (preInfo.target) targetId = preInfo.target;
      propsTitle.textContent = 'Relation' + (sourceId && targetId ? ' — ' + sourceId + ' → ' + targetId : '');
      var info = preInfo;
      info.source = sourceId; info.target = targetId;
      var rels = relationSchemasFor(type);

      propsContent.appendChild(field('Type', selectInput(
        rels.map(function (r) { return { value: r.id, label: r.label }; }),
        info.kind, function (v) {
          info.kind = v;
          replaceRelationLine(lineIdx, info);
        }
      )));
      propsContent.appendChild(field('Label', textInput(info.label, function (v) {
        info.label = v;
        replaceRelationLine(lineIdx, info);
      })));
      var multSpec = (rels.find(function (r) { return r.id === info.kind; }) || {}).supports || {};
      if (multSpec.multiplicity || type === 'er') {
        propsContent.appendChild(field('Source multiplicity / cardinality', textInput(info.sourceMult, function (v) {
          info.sourceMult = v;
          replaceRelationLine(lineIdx, info);
        })));
        propsContent.appendChild(field('Target multiplicity / cardinality', textInput(info.targetMult, function (v) {
          info.targetMult = v;
          replaceRelationLine(lineIdx, info);
        })));
      }
      if (multSpec.navigability || /^(compose|aggregate|plain|assoc)$/.test(info.kind)) {
        propsContent.appendChild(field('Navigability', selectInput(
          [{ value: '', label: 'Default' }, { value: 'navigable', label: 'Navigable →' },
           { value: 'bidirectional', label: 'Bidirectional ↔' }, { value: 'nonnav', label: 'Non-navigable ✕' }],
          info.navigability, function (v) { info.navigability = v; replaceRelationLine(lineIdx, info); }
        )));
      }
      if (multSpec.stereotype || /^(include|extend|depend)$/.test(info.kind)) {
        propsContent.appendChild(field('Stereotype', textInput(info.stereotype, function (v) {
          info.stereotype = v.trim() ? (/^<</.test(v.trim()) ? v.trim() : '<<' + v.trim().replace(/<<|>>/g, '') + '>>') : '';
          replaceRelationLine(lineIdx, info);
        })));
      }
      var hint = document.createElement('p');
      hint.className = 'uml-pg-prop-hint';
      hint.textContent = 'Drag a line segment to reroute, or press Delete to remove this relation.';
      propsContent.appendChild(hint);
    }

    function parseRelationLine(line) {
      var info = { kind: '', label: '', sourceMult: '', targetMult: '', navigability: '', stereotype: '', source: '', target: '' };
      if (!line) return info;
      var t = line.trim();
      // Pull off label
      var labMatch = t.match(/\s*:\s*(.*)$/);
      if (labMatch) {
        var labRaw = labMatch[1];
        var sm = labRaw.match(/^<<\s*([^>]+?)\s*>>\s*(.*)$/);
        if (sm) { info.stereotype = '<<' + sm[1] + '>>'; info.label = sm[2].trim(); }
        else info.label = labRaw.trim();
        t = t.replace(/\s*:\s*.*$/, '');
      }
      // Pull source/target multiplicities
      var firstQ = t.match(/^"((?:[^"\\]|\\.)*)"\s+(.*)$/);
      if (firstQ) { info.sourceMult = firstQ[1]; t = firstQ[2]; }
      // Tokens: source op (... maybe quote ...) target — handle ER form: A "N" -- B
      var lastQ = t.match(/^(\S+)\s+"((?:[^"\\]|\\.)*)"\s+([-.\|<>=*ox]+)\s+(\S+)$/);
      if (lastQ) { info.source = lastQ[1]; info.sourceMult = info.sourceMult || lastQ[2]; var op0 = lastQ[3]; var tg0 = lastQ[4]; info.kind = guessRelationKind(op0); info.target = tg0; return info; }
      var midQ = t.match(/^(\S+)\s+([-.\|<>=*ox]+)\s+"((?:[^"\\]|\\.)*)"\s+(\S+)$/);
      if (midQ) { info.source = midQ[1]; info.kind = guessRelationKind(midQ[2]); info.targetMult = midQ[3]; info.target = midQ[4]; return info; }
      var simple = t.match(/^(\S+)\s+([-.\|<>=*ox]+)\s+(\S+)$/);
      if (simple) { info.source = simple[1]; info.kind = guessRelationKind(simple[2]); info.target = simple[3]; }
      // Navigability detection
      var op = simple ? simple[2] : (lastQ ? lastQ[3] : (midQ ? midQ[2] : ''));
      if (/^(\*|o)<-->$/.test(op)) info.navigability = 'bidirectional';
      else if (/^(\*|o)-->$/.test(op)) info.navigability = 'navigable';
      else if (/^(\*|o)--x$/.test(op)) info.navigability = 'nonnav';
      else if (op === '<-->') info.navigability = 'bidirectional';
      else if (op === '--x') info.navigability = 'nonnav';
      return info;
    }

    function guessRelationKind(op) {
      var t = (op || '').trim();
      if (t === '--|>') return 'gen';
      if (t === '..|>') return 'real';
      if (t.charAt(0) === '*') return 'compose';
      if (t.charAt(0) === 'o' && t !== 'o-->' /* preserved */) return 'aggregate';
      if (t === '<-->') return 'biassoc';
      if (t === '-->') return 'assoc';
      if (t === '..>') return 'depend';
      if (t === '--') return 'plain';
      if (t === '==') return 'total';
      if (t === '->') return 'sync';
      if (t === '->>') return 'async';
      return '';
    }

    function replaceRelationLine(lineIdx, info) {
      if (lineIdx === -1) return;
      var type = typeSelect.value;
      var rels = relationSchemasFor(type);
      var spec = rels.find(function (r) { return r.id === info.kind; });
      if (!spec) return;
      snapshotForUndo('rel:' + lineIdx);
      var newLine = buildRelationLine(spec, info.source, info.target, {
        label: info.label, sourceMult: info.sourceMult, targetMult: info.targetMult,
        navigability: info.navigability, stereotype: info.stereotype
      });
      var positions = readLayoutPositions(textarea.value);
      var routes = readLayoutRoutes(textarea.value);
      var clean = stripLayoutMetadata(textarea.value);
      var lines = clean.split('\n');
      lines[lineIdx] = newLine;
      textarea.value = writePositionsIntoSource(lines.join('\n'), type, positions, routes);
      renderDiagram();
      selectAfterRender(selectedLayoutId, 'route');
    }

    function deleteSelected() {
      if (!selectionSize()) return;
      snapshotForUndo();
      // Snapshot the set so we can iterate while mutating.
      var entries = Object.keys(selectedLayoutIds).map(function (id) {
        return { id: id, kind: selectedLayoutIds[id] };
      });
      // Compute relation line indices once before any mutations so ordinal
      // matching stays consistent if multiple routes are selected.
      var rIndices = relationLineIndices(textarea.value, typeSelect.value);
      // Collect line indices to drop for routes (so we can drop higher-index
      // first and avoid shifting issues), and id list for elements.
      var routeIdxs = [];
      var elementIds = [];
      entries.forEach(function (e) {
        if (e.kind === 'route') {
          var id = String(e.id);
          var idx = -1;
          var rm = id.match(/^edge:([^|]+)\|([^|]+)$/);
          if (rm) {
            var src = rm[1], tgt = rm[2];
            var lines = stripLayoutMetadata(textarea.value).split('\n');
            for (var i = 0; i < lines.length; i++) {
              if (lineMentionsId(lines[i], src) && lineMentionsId(lines[i], tgt) && /[-.<=>|*ox]/.test(lines[i]) && !/^@/.test(lines[i].trim())) { idx = i; break; }
            }
          } else {
            var ord = id.match(/^edge[-:_](\d+)$/);
            if (ord && rIndices[Number(ord[1])] != null) idx = rIndices[Number(ord[1])];
          }
          if (idx !== -1) routeIdxs.push(idx);
        } else {
          elementIds.push(e.id);
        }
      });
      // Drop highest-numbered route lines first.
      routeIdxs.sort(function (a, b) { return b - a; });
      routeIdxs.forEach(function (idx) {
        textarea.value = removeRelationLine(textarea.value, typeSelect.value, idx);
      });
      // Then drop elements (each call also strips relations referencing the id).
      elementIds.forEach(function (id) {
        textarea.value = removeElementFromSource(textarea.value, typeSelect.value, id);
      });
      setSelectedLayoutId(null);
      renderDiagram();
      announce('Deleted ' + entries.length + ' item' + (entries.length === 1 ? '' : 's') + '.', false);
    }

    function installRouteEditor(svg, layer) {
      var routes = findEditableRoutes(svg);
      var ns = 'http://www.w3.org/2000/svg';
      var handleCount = 0;

      routes.forEach(function (route) {
        var lockedEndpoints = routeUsesLockedEndpoints(route);
        var segmentIndices = editableRouteSegmentIndices(route, lockedEndpoints);
        segmentIndices.forEach(function (i) {
          var seg = document.createElementNS(ns, 'line');
          seg.setAttribute('class', 'uml-pg-edge-hitbox' + (route.id === selectedLayoutId && selectedLayoutKind === 'route' ? ' is-selected' : ''));
          seg.setAttribute('data-layout-id', route.id);
          seg.setAttribute('data-route-id', route.id);
          seg.setAttribute('data-segment-index', String(i));
          seg.setAttribute('data-locked-endpoints', lockedEndpoints ? 'true' : 'false');
          seg.setAttribute('tabindex', '0');
          seg.setAttribute('role', 'button');
          seg.setAttribute('aria-label', 'Relation segment ' + (i + 1) + ' of ' + route.id + ' — Enter to select, Delete to remove');
          setRouteOverlaySegment(seg, route.points[i], route.points[i + 1]);
          seg.addEventListener('pointerdown', function (event) {
            // Yield to an active tool — element hitbox underneath should handle
            // the click for relation-tool source/target picks.
            if (activeTool) return;
            event.preventDefault();
            event.stopPropagation();
            var extend = event.metaKey || event.ctrlKey || event.shiftKey;
            if (extend) {
              setSelectedLayoutId(route.id, 'route', { extend: true });
              return;
            }
            snapshotForUndo('drag:route:' + route.id);
            var start = svgPoint(svg, event.clientX, event.clientY);
            var segmentIndex = Number(event.currentTarget.getAttribute('data-segment-index'));
            var locked = event.currentTarget.getAttribute('data-locked-endpoints') === 'true';
            setSelectedLayoutId(route.id, 'route');
            dragState = {
              kind: 'route',
              svg: svg,
              layer: layer,
              route: route,
              segmentIndex: segmentIndex,
              lockedEndpoints: locked,
              start: start,
              points: clonePoints(route.points)
            };
            try { event.currentTarget.setPointerCapture(event.pointerId); } catch (e) {}
          });
          seg.addEventListener('keydown', function (event) {
            if (activeTool) return;
            var k = event.key;
            if (k === 'Enter' || k === ' ') {
              event.preventDefault();
              setSelectedLayoutId(route.id, 'route');
            } else if (k === 'Delete' || k === 'Backspace') {
              event.preventDefault();
              setSelectedLayoutId(route.id, 'route');
              deleteSelected();
            } else if (k === 'Escape') {
              event.preventDefault();
              setSelectedLayoutId(null);
            }
          });
          layer.appendChild(seg);
          handleCount++;
        });
      });

      if (!routes.length || !handleCount) {
        status.textContent = 'No editable lines detected for this diagram yet.';
      } else {
        status.textContent = 'Drag a highlighted line segment.';
      }
    }

    function installVisualEditor() {
      var svg = output.querySelector('svg');
      if (!svg || !editToggle || !editToggle.checked) {
        clearEditLayer();
        rebuildPropsPane();
        refreshActiveButtonStates();
        return;
      }

      clearEditLayer();
      svg.classList.add('uml-pg-editing');
      var editables = findEditableElements(svg);
      var ns = 'http://www.w3.org/2000/svg';
      var layer = document.createElementNS(ns, 'g');
      layer.setAttribute('class', 'uml-pg-edit-layer');
      svg.appendChild(layer);

      // Restore current pan + zoom on this newly-rendered SVG.
      applyViewTransform(svg);

      // Wheel-zoom: Cmd/Ctrl + wheel zooms; pinch-zoom on trackpads also works
      // because it reports as a wheel event with ctrlKey=true.
      svg.addEventListener('wheel', function (ev) {
        if (!ev.ctrlKey && !ev.metaKey) return;
        ev.preventDefault();
        var factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
        zoomAt(factor, ev.clientX, ev.clientY);
      }, { passive: false });

      // SVG-level pointerdown handles three things:
      //   1. Place-element tool: click on empty canvas → place at cursor.
      //   2. Empty-canvas drag: pan the canvas (start once movement > 5 px).
      //   3. Empty-canvas click without drag: cancel active relation tool / clear selection.
      svg.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0) return;
        // First, if the click landed on a hitbox / edge / handle, ignore — those
        // have their own handlers.
        var target = ev.target;
        var landedOnInteractive = false;
        while (target && target !== svg) {
          if (target.classList && (
              target.classList.contains('uml-pg-edit-hitbox') ||
              target.classList.contains('uml-pg-edge-hitbox') ||
              target.classList.contains('uml-pg-extend-handle') ||
              target.classList.contains('uml-pg-extend-handle-group'))) {
            landedOnInteractive = true;
            break;
          }
          target = target.parentNode;
        }
        if (landedOnInteractive) return;

        // Empty canvas: begin a click-vs-pan gesture. We commit to one or the
        // other on pointermove (>5 px → pan) or pointerup (no movement → click).
        ev.preventDefault();
        var startX = ev.clientX, startY = ev.clientY;
        var startPan = { x: panOffset.x, y: panOffset.y };
        var moved = false;
        function onMove(mv) {
          var dx = mv.clientX - startX, dy = mv.clientY - startY;
          if (!moved && Math.abs(dx) <= 5 && Math.abs(dy) <= 5) return;
          moved = true;
          svg.classList.add('uml-pg-panning');
          panOffset.x = startPan.x + dx;
          panOffset.y = startPan.y + dy;
          applyPanTransform(svg);
        }
        function onUp(up) {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          svg.classList.remove('uml-pg-panning');
          if (moved) return; // pan committed, no click action
          // Treat as click on empty canvas
          if (handleCanvasPointerDown(svg, up)) return; // place tool succeeded
          if (activeTool) {
            setActiveTool(null);
            announce('Cancelled.', false);
          } else if (selectionSize() > 0) {
            setSelectedLayoutId(null);
          }
        }
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });

      // One unified mode: install relation hitboxes for click-to-edit (label /
      // multiplicity / navigability / stereotype) AND drag-to-reroute, then
      // install element hitboxes for click-to-select / drag-to-move on top.
      installRouteEditor(svg, layer);

      editables.sort(function (a, b) {
        function rank(item) {
          if (!item) return 0;
          if (item.axis === 'port') return 3;
          if (item.axis === 'label' || item.axis === 'branch-label') return 2;
          return 1;
        }
        return rank(a) - rank(b);
      });

      editables.forEach(function (item) {
        var rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('class', 'uml-pg-edit-hitbox' +
          (item.axis === 'port' ? ' is-port' : '') +
          (item.axis === 'branch-label' || item.axis === 'label' ? ' is-label' : '') +
          (item.id === selectedLayoutId ? ' is-selected' : ''));
        rect.setAttribute('data-layout-id', item.id);
        rect.setAttribute('x', item.box.x);
        rect.setAttribute('y', item.box.y);
        rect.setAttribute('width', item.box.width);
        rect.setAttribute('height', item.box.height);
        // Make hitboxes keyboard-focusable for full WCAG keyboard support.
        rect.setAttribute('tabindex', '0');
        rect.setAttribute('role', 'button');
        var aria = (item.axis === 'port' ? 'Port ' : item.axis === 'label' || item.axis === 'branch-label' ? 'Label ' : 'Element ');
        rect.setAttribute('aria-label', aria + (item.label || item.id) + ' — Enter to select, arrows to nudge, Delete to remove');
        rect.addEventListener('dblclick', function (event) {
          if (activeTool) return;
          event.preventDefault();
          event.stopPropagation();
          // Did the double-click land on a specific class-member text? If so,
          // edit that member inline instead of renaming the whole class.
          if (typeSelect.value === 'class') {
            var memberText = findClassMemberTextAt(svg, item.id, event.clientX, event.clientY);
            if (memberText) {
              startInlineMemberEdit(item.id, memberText.index, memberText.textEl);
              return;
            }
          }
          // Resolve the latest item shape (label may have been edited).
          var live = findEditableElements(svg).find(function (e) { return e.id === item.id; }) || item;
          startInlineRename(live);
        });
        rect.addEventListener('pointerdown', function (event) {
          // In relation-tool mode, click → record source/target instead of drag.
          if (activeTool && activeTool.kind === 'relation') {
            event.preventDefault();
            event.stopPropagation();
            setSelectedLayoutId(item.id, 'node');
            handleHitboxClickForRelation(item, rect);
            return;
          }
          // In element-tool mode, click on hitbox is ignored — the user wants
          // to place on empty canvas. Surface a hint.
          if (activeTool && activeTool.kind === 'element') {
            event.preventDefault();
            event.stopPropagation();
            announce('Click an empty area to place. Click an existing element to select it instead — switch tools first.', true);
            return;
          }
          event.preventDefault();
          var extend = event.metaKey || event.ctrlKey || event.shiftKey;
          if (extend) {
            // Toggle in selection — no drag.
            setSelectedLayoutId(item.id, 'node', { extend: true });
            return;
          }
          // Plain click on a hitbox already in the selection? Keep selection,
          // but start drag of all selected elements (group move).
          var alreadySelected = selectedLayoutIds[item.id] === 'node';
          if (!alreadySelected) {
            setSelectedLayoutId(item.id, 'node');
          }
          snapshotForUndo('drag:elt:' + item.id);
          var start = svgPoint(svg, event.clientX, event.clientY);
          // Build group drag state if multiple selected.
          var allPositions = collectPositions(editables);
          var groupItems = [];
          Object.keys(selectedLayoutIds).forEach(function (sid) {
            if (selectedLayoutIds[sid] !== 'node') return;
            var ed = editables.find(function (e) { return e.id === sid; });
            if (!ed) return;
            groupItems.push({
              item: ed,
              rect: layer.querySelector('.uml-pg-edit-hitbox[data-layout-id="' + cssAttrEscape(sid) + '"]'),
              parts: collectMoveParts(svg, ed.box, sid),
              connectedRoutes: collectConnectedRoutes(svg, sid)
            });
          });
          dragState = {
            svg: svg,
            rect: rect,
            item: item,
            start: start,
            box: item.box,
            positions: allPositions,
            parts: collectMoveParts(svg, item.box, item.id),
            connectedRoutes: collectConnectedRoutes(svg, item.id),
            groupItems: groupItems.length > 1 ? groupItems : null
          };
          rect.setPointerCapture(event.pointerId);
        });
        // Keyboard activation
        rect.addEventListener('keydown', function (event) {
          var k = event.key;
          if (k === 'Enter' || k === ' ') {
            event.preventDefault();
            if (activeTool && activeTool.kind === 'relation') {
              setSelectedLayoutId(item.id, 'node');
              handleHitboxClickForRelation(item, rect);
            } else {
              setSelectedLayoutId(item.id, 'node');
            }
          } else if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
            if (activeTool) return;
            event.preventDefault();
            var step = event.shiftKey ? 1 : 10;
            var dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0;
            var dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
            nudgeElement(item.id, dx, dy);
          } else if (k === 'Delete' || k === 'Backspace') {
            event.preventDefault();
            setSelectedLayoutId(item.id, 'node');
            deleteSelected();
          } else if (k === 'F2') {
            event.preventDefault();
            setSelectedLayoutId(item.id, 'node');
            // Focus the Identifier field in the props panel.
            setTimeout(function () {
              var firstInput = propsContent && propsContent.querySelector('input[type="text"]');
              if (firstInput) { firstInput.focus(); firstInput.select(); }
            }, 0);
          } else if (k === 'Escape') {
            event.preventDefault();
            if (activeTool) { setActiveTool(null); announce('Cancelled.', false); }
            else { setSelectedLayoutId(null); }
          }
        });
        layer.appendChild(rect);
        // Add hover-to-extend "+" handle for elements (skip ports/labels — they
        // have no clear connect semantics).
        if (item.axis !== 'port' && item.axis !== 'label' && item.axis !== 'branch-label') {
          installExtendHandle(svg, layer, item, rect);
        }
      });

      if (!editables.length) {
        status.textContent = 'No movable elements detected for this diagram yet.';
      } else {
        status.textContent = activeTool ? '' : 'Drag a highlighted element. Tab to focus, arrows to nudge, Delete to remove.';
      }
      if (pendingSelect) {
        var ps2 = pendingSelect; pendingSelect = null;
        setSelectedLayoutId(ps2.id, ps2.kind);
      }
      refreshActiveButtonStates();
    }

    // ─── In-canvas inline rename (label-only, never id) ───
    var inlineRenameInput = null;

    function startInlineRename(item) {
      cancelInlineRename();
      var svg = output.querySelector('svg');
      if (!svg) return;
      // The hitbox might have moved since the item was found — re-locate it.
      var hitbox = svg.querySelector('.uml-pg-edit-hitbox[data-layout-id="' + cssAttrEscape(item.id) + '"]');
      if (!hitbox) return;
      var rect = hitbox.getBoundingClientRect();
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'uml-pg-inline-input';
      input.value = item.label || item.id;
      input.setAttribute('aria-label', 'Rename ' + (item.label || item.id));
      input.style.left = rect.left + 'px';
      input.style.top = rect.top + 'px';
      input.style.width = Math.max(rect.width, 100) + 'px';
      input.style.minHeight = Math.max(rect.height * 0.5, 28) + 'px';
      document.body.appendChild(input);
      input.focus();
      input.select();
      inlineRenameInput = input;

      var labelTextNode = findElementLabelTextNode(svg, item);
      var originalText = labelTextNode ? labelTextNode.textContent : null;
      function preview() {
        if (labelTextNode) labelTextNode.textContent = input.value;
      }
      function commit() {
        var newLabel = input.value.trim();
        cleanup();
        if (!newLabel || newLabel === item.label) return;
        snapshotForUndo();
        setElementLabel(item.id, newLabel);
      }
      function cancel() {
        if (labelTextNode && originalText !== null) labelTextNode.textContent = originalText;
        cleanup();
      }
      function cleanup() {
        input.removeEventListener('input', preview);
        input.removeEventListener('keydown', onKey);
        input.removeEventListener('blur', commit);
        if (input.parentNode) input.parentNode.removeChild(input);
        inlineRenameInput = null;
      }
      function onKey(ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
        else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
      }
      input.addEventListener('input', preview);
      input.addEventListener('keydown', onKey);
      input.addEventListener('blur', commit);
    }

    function cancelInlineRename() {
      if (inlineRenameInput && inlineRenameInput.parentNode) {
        inlineRenameInput.parentNode.removeChild(inlineRenameInput);
      }
      inlineRenameInput = null;
    }

    function findElementLabelTextNode(svg, item) {
      // Find the SVG <text> element rendering the visible label so we can do
      // live preview during inline rename without re-rendering the diagram.
      var labels = [item.label, item.id].filter(Boolean).map(function (s) {
        return String(s).replace(/\s+/g, ' ').trim();
      });
      var texts = svg.querySelectorAll('text');
      for (var i = 0; i < texts.length; i++) {
        var t = texts[i];
        if (t.closest('.uml-pg-edit-layer') || t.closest('defs')) continue;
        var content = (t.textContent || '').replace(/\s+/g, ' ').trim();
        if (labels.indexOf(content) !== -1) return t;
      }
      return null;
    }

    /**
     * Rewrite the visible label of an element while preserving its id (used as
     * the cross-reference key in relations).
     *
     * For schemas that already separate label from id (sequence's
     * `actor user: User` form, use-case's `usecase "Label" as id` form), this
     * just rewrites the label part. For schemas that previously had no
     * separate label (class, state, component, deployment node, ER entity),
     * this introduces a `keyword "Label" as id` alias so the id keeps working.
     */
    function setElementLabel(id, newLabel) {
      var type = typeSelect.value;
      var line = getDeclarationLine(textarea.value, type, id);
      if (line == null) return;
      var t = line.trim();
      // Preserve any trailing { ... } body so members / ports / attributes survive.
      var bodyMatch = t.match(/(\s*\{[\s\S]*\}\s*)$/);
      var body = bodyMatch ? bodyMatch[1] : '';
      var head = bodyMatch ? t.slice(0, -body.length) : t;
      var newHead = rewriteLabelInHead(head, type, id, newLabel);
      if (!newHead) return;
      var newLine = newHead + body;
      replaceLineForElementId(id, newLine);
    }

    function rewriteLabelInHead(head, type, id, newLabel) {
      // Returns the rewritten head, or null if the schema is unrecognized.
      var t = head.trim();
      var quotedId = /[\s"<>]/.test(id) ? '"' + escapeQuoted(id) + '"' : id;
      var quotedLbl = '"' + escapeQuoted(newLabel) + '"';

      // Sequence: `actor id: Label` or `participant id: Label`
      if (type === 'sequence') {
        var ms = t.match(/^(actor|participant)\s+(\S+?)(?::\s*.*)?$/i);
        if (ms) return ms[1] + ' ' + ms[2] + ': ' + newLabel;
      }
      // Use-case: `usecase "Label" as id` | `actor "Label" as id` | `actor id` | `rectangle "Label" as id`
      if (type === 'usecase') {
        var mu = t.match(/^(usecase|actor|rectangle)\s+/i);
        if (mu) {
          // Strip current Label/id forms then re-emit
          var kw = mu[1].toLowerCase();
          if (kw === 'actor' && t.match(/^actor\s+\S+\s*$/i) && !/\sas\s+/i.test(t)) {
            // Plain `actor X` — rewrite as `actor "Label" as X`.
            return 'actor ' + quotedLbl + ' as ' + id;
          }
          return kw + ' ' + quotedLbl + ' as ' + id;
        }
      }
      // Deployment artifact: `artifact "Label" as id`
      if (type === 'deployment') {
        if (/^artifact\b/i.test(t)) return 'artifact ' + quotedLbl + ' as ' + id;
      }
      // Notes: `note as id "text"`
      if (/^note\s+as\b/i.test(t)) return 'note as ' + id + ' ' + quotedLbl;

      // Default: introduce a `keyword "Label" as id` alias for class/state/
      // component/node/entity/relationship/etc. Find the keyword (one or two
      // words like `class`, `abstract class`, `weak entity`, `identifying relationship`).
      var keywordMatch = t.match(/^((?:abstract\s+class|weak\s+entity|identifying\s+relationship|class|interface|enum|state|component|node|entity|relationship)(?:\s+\S+)?)/i);
      if (!keywordMatch) return null;
      // Extract the keyword (without the id)
      var kw2 = keywordMatch[1];
      // The keyword might include the id (e.g. "class Animal") — strip it.
      var kwTokens = kw2.split(/\s+/);
      var schemaKeywords = {
        'abstract class': true, 'class': true, 'interface': true, 'enum': true,
        'state': true, 'component': true, 'node': true,
        'entity': true, 'weak entity': true, 'relationship': true, 'identifying relationship': true
      };
      // Try 2-word, then 1-word, both lowercase
      var twoWord = kwTokens.length >= 2 ? (kwTokens[0] + ' ' + kwTokens[1]).toLowerCase() : null;
      var oneWord = kwTokens[0].toLowerCase();
      var keyword;
      if (twoWord && schemaKeywords[twoWord]) keyword = kwTokens[0] + ' ' + kwTokens[1];
      else if (schemaKeywords[oneWord]) keyword = kwTokens[0];
      else return null;
      // Detect any trailing tokens (stereotype, color, dashed, etc.) after the id.
      var afterIdRe = new RegExp('^' + keyword.replace(/\s+/g, '\\s+') + '\\s+(?:"[^"]+"\\s+as\\s+\\S+|\\S+(?:\\s+as\\s+\\S+)?)\\s*(.*)$', 'i');
      var aft = t.match(afterIdRe);
      var trailing = aft && aft[1] ? ' ' + aft[1] : '';
      return keyword + ' ' + quotedLbl + ' as ' + id + trailing;
    }

    /**
     * Reorder sequence lifeline declarations based on their final x-positions.
     * Returns the rewritten source if the order changed, else null.
     */
    function reorderSequenceLifelines(draggedId, positions) {
      // Collect every participant/actor id with its final x coordinate.
      var ids = collectModelElements(textarea.value, 'sequence')
        .filter(function (e) { return e.axis === 'x'; })
        .map(function (e) { return e.id; });
      if (ids.length < 2 || ids.indexOf(draggedId) === -1) return null;
      // Sort by final x.
      var ordered = ids.slice().sort(function (a, b) {
        var pa = positions[a] ? positions[a].x : 0;
        var pb = positions[b] ? positions[b].x : 0;
        return pa - pb;
      });
      // Same order? Nothing to do.
      var same = ordered.length === ids.length && ordered.every(function (id, i) { return id === ids[i]; });
      if (same) return null;

      // Reorder the lifeline declaration lines in source-order to match `ordered`.
      // We capture each declaration line + any contiguous trailing layout-extras
      // (none in practice — declarations are single lines), reposition them.
      var clean = stripLayoutMetadata(textarea.value);
      var lines = clean.split('\n');
      var declLineByIds = {};
      var declLineIdxs = [];
      for (var i = 0; i < lines.length; i++) {
        var declId = declarationIdForLine(lines[i], 'sequence');
        if (declId && ids.indexOf(declId) !== -1) {
          declLineByIds[declId] = lines[i];
          declLineIdxs.push(i);
        }
      }
      if (declLineIdxs.length !== ids.length) return null; // missing decls — bail
      // Sort declLineIdxs ascending and replace in source order.
      declLineIdxs.sort(function (a, b) { return a - b; });
      ordered.forEach(function (id, i) {
        lines[declLineIdxs[i]] = declLineByIds[id];
      });
      // Drop the dragged lifeline's @pos override so the renderer lays it out fresh.
      var freshPositions = {};
      Object.keys(positions).forEach(function (k) {
        if (k !== draggedId) freshPositions[k] = positions[k];
      });
      // Also drop @pos for the lifeline it crossed (so the fresh layout is clean).
      ordered.forEach(function (id) { delete freshPositions[id]; });
      var routes = readLayoutRoutes(textarea.value);
      // Drop routes — message routes are tied to old positions and would draw wrong.
      Object.keys(routes).forEach(function (k) { delete routes[k]; });
      return writePositionsIntoSource(lines.join('\n'), 'sequence', freshPositions, routes);
    }

    // ─── Class-member inline edit (double-click an attribute / method) ───
    function findClassMemberTextAt(svg, classId, clientX, clientY) {
      var line = getDeclarationLine(textarea.value, 'class', classId);
      if (!line) return null;
      var info = parseClassDeclaration(line);
      if (!info.members.length) return null;
      // Find the visible <text> element under the cursor that's inside the
      // class's bbox AND whose text content matches one of the member rows.
      var below = document.elementsFromPoint(clientX, clientY);
      for (var i = 0; i < below.length; i++) {
        var el = below[i];
        if (el.tagName && el.tagName.toLowerCase() === 'text' && !el.closest('.uml-pg-edit-layer')) {
          var content = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (!content) continue;
          if (content === info.name) return null; // hit the class name — fall back to rename
          // Match against parsed member text. Members render as `+ {abstract} foo()`
          // or `+ name: type`. Strip leading visibility/modifier tokens to compare.
          for (var j = 0; j < info.members.length; j++) {
            var m = info.members[j];
            var rendered = (m.visibility || '+') + ' ';
            if (m.isAbstract) rendered += '{abstract} ';
            if (m.isStatic) rendered += '{static} ';
            rendered += (m.text || '').trim();
            // Normalize whitespace for comparison.
            var normalized = rendered.replace(/\s+/g, ' ').trim();
            if (content === normalized || content.indexOf(m.text || '!nope') !== -1) {
              return { index: j, textEl: el };
            }
          }
        }
      }
      return null;
    }

    function startInlineMemberEdit(classId, memberIdx, textEl) {
      cancelInlineRename();
      var line = getDeclarationLine(textarea.value, 'class', classId);
      if (!line) return;
      var info = parseClassDeclaration(line);
      var member = info.members[memberIdx];
      if (!member) return;
      var rect = textEl.getBoundingClientRect();
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'uml-pg-inline-input';
      input.value = (member.visibility || '+') +
                    (member.isAbstract ? ' {abstract}' : '') +
                    (member.isStatic ? ' {static}' : '') +
                    ' ' + (member.text || '');
      input.setAttribute('aria-label', 'Edit class member');
      input.style.left = rect.left + 'px';
      input.style.top = rect.top + 'px';
      input.style.width = Math.max(rect.width + 60, 160) + 'px';
      input.style.minHeight = Math.max(rect.height + 4, 24) + 'px';
      document.body.appendChild(input);
      input.focus();
      input.select();
      inlineRenameInput = input;

      var originalText = textEl.textContent;
      function preview() {
        textEl.textContent = input.value;
      }
      function commit() {
        var raw = input.value.trim();
        cleanup();
        if (!raw) return;
        var parsed = parseMemberLine(raw);
        // If the user wrote no visibility, parseMemberLine defaults to '+'. Keep that.
        info.members[memberIdx] = parsed;
        snapshotForUndo();
        var newLine = buildClassLine(info);
        replaceLineForElementId(classId, newLine);
      }
      function cancel() {
        textEl.textContent = originalText;
        cleanup();
      }
      function cleanup() {
        input.removeEventListener('input', preview);
        input.removeEventListener('keydown', onKey);
        input.removeEventListener('blur', commit);
        if (input.parentNode) input.parentNode.removeChild(input);
        inlineRenameInput = null;
      }
      function onKey(ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
        else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
      }
      input.addEventListener('input', preview);
      input.addEventListener('keydown', onKey);
      input.addEventListener('blur', commit);
    }

    // ─── Canvas pan + zoom ───
    // panOffset and zoom survive re-renders (we re-apply them after each render)
    // but do not survive page reloads.
    var panOffset = { x: 0, y: 0 };
    var zoom = 1;
    var ZOOM_MIN = 0.2;
    var ZOOM_MAX = 5;
    function applyViewTransform(svg) {
      if (!svg) return;
      svg.style.transformOrigin = '0 0';
      if (panOffset.x === 0 && panOffset.y === 0 && zoom === 1) {
        svg.style.transform = '';
      } else {
        svg.style.transform = 'translate(' + panOffset.x + 'px,' + panOffset.y + 'px) scale(' + zoom + ')';
      }
      updateZoomReadout();
    }
    // Backwards-compat alias — older call sites still use applyPanTransform.
    var applyPanTransform = applyViewTransform;
    function resetView() {
      panOffset.x = 0; panOffset.y = 0; zoom = 1;
      var svg = output.querySelector('svg');
      if (svg) applyViewTransform(svg);
    }
    var resetPan = resetView; // keep old name available

    /**
     * Zoom by a multiplicative factor anchored at a viewport position so the
     * point under the cursor / button stays visually fixed.
     * @param {number} factor   e.g. 1.2 to zoom in, 1/1.2 to zoom out.
     * @param {number} clientX  Viewport X to keep stationary. Defaults to viewport center of SVG.
     * @param {number} clientY  Viewport Y to keep stationary.
     */
    function zoomAt(factor, clientX, clientY) {
      var svg = output.querySelector('svg');
      if (!svg) return;
      var oldZoom = zoom;
      var newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, oldZoom * factor));
      if (Math.abs(newZoom - oldZoom) < 1e-6) return;
      var rect = svg.getBoundingClientRect();
      // If no anchor was given, anchor on the SVG's viewport centre.
      if (clientX == null) clientX = rect.left + rect.width / 2;
      if (clientY == null) clientY = rect.top + rect.height / 2;
      // Convert cursor to pre-transform local coords. With transform-origin 0 0:
      //   screen = layoutOrigin + pan + local * zoom
      // The current visual rect.left already equals layoutOrigin + pan. So:
      var localX = (clientX - rect.left) / oldZoom;
      var localY = (clientY - rect.top) / oldZoom;
      // Compensate pan so localX/localY map back to the same screen point at newZoom.
      panOffset.x -= localX * (newZoom - oldZoom);
      panOffset.y -= localY * (newZoom - oldZoom);
      zoom = newZoom;
      applyViewTransform(svg);
    }
    function zoomIn(clientX, clientY) { zoomAt(1.2, clientX, clientY); }
    function zoomOut(clientX, clientY) { zoomAt(1 / 1.2, clientX, clientY); }
    function zoomToFit() {
      // Reset pan + zoom — the renderer's intrinsic SVG fits its container.
      resetView();
    }
    function updateZoomReadout() {
      var el = document.getElementById('uml-pg-zoom-readout');
      if (el) el.textContent = Math.round(zoom * 100) + '%';
      var zin = document.getElementById('uml-pg-zoom-in');
      var zout = document.getElementById('uml-pg-zoom-out');
      if (zin) zin.disabled = zoom >= ZOOM_MAX - 1e-6;
      if (zout) zout.disabled = zoom <= ZOOM_MIN + 1e-6;
    }

    function selectAll() {
      var svg = output.querySelector('svg');
      if (!svg) return;
      var layer = svg.querySelector('.uml-pg-edit-layer');
      if (!layer) return;
      clearSelectionSet();
      Array.prototype.slice.call(layer.querySelectorAll('.uml-pg-edit-hitbox')).forEach(function (rect) {
        var id = rect.getAttribute('data-layout-id');
        if (id) selectedLayoutIds[id] = 'node';
      });
      Array.prototype.slice.call(layer.querySelectorAll('.uml-pg-edge-hitbox')).forEach(function (line) {
        var id = line.getAttribute('data-layout-id');
        if (id) selectedLayoutIds[id] = 'route';
      });
      var keys = Object.keys(selectedLayoutIds);
      if (keys.length) {
        selectedLayoutId = keys[keys.length - 1];
        selectedLayoutKind = selectedLayoutIds[selectedLayoutId];
      }
      // Mirror to UI without the side effects of setSelectedLayoutId reset.
      Array.prototype.slice.call(layer.querySelectorAll('.uml-pg-edit-hitbox')).forEach(function (rect) {
        rect.classList.add('is-selected');
      });
      Array.prototype.slice.call(layer.querySelectorAll('.uml-pg-edge-hitbox')).forEach(function (line) {
        line.classList.add('is-selected');
      });
      if (resetOneBtn) resetOneBtn.disabled = selectionSize() !== 1;
      rebuildPropsPane();
      announce('Selected ' + keys.length + ' item' + (keys.length === 1 ? '' : 's') + '.', false);
    }

    function nudgeElement(id, dx, dy) {
      var svg = output.querySelector('svg');
      if (!svg) return;
      var editables = findEditableElements(svg);
      var positions = collectPositions(editables);
      if (!positions[id]) return;
      snapshotForUndo('nudge:' + id);
      positions[id] = { x: positions[id].x + dx, y: positions[id].y + dy };
      textarea.value = writePositionsIntoSource(textarea.value, typeSelect.value, positions);
      pendingSelect = { id: id, kind: 'node' };
      renderDiagram();
      // Restore focus to the same hitbox after the re-render.
      setTimeout(function () {
        var newSvg = output.querySelector('svg');
        if (!newSvg) return;
        var hitbox = newSvg.querySelector('.uml-pg-edit-hitbox[data-layout-id="' + cssAttrEscape(id) + '"]');
        if (hitbox && hitbox.focus) hitbox.focus();
      }, 0);
    }

    function cssAttrEscape(s) { return String(s).replace(/(["\\])/g, '\\$1'); }

    function updateDrag(event, finish) {
      if (!dragState) return;
      var now = svgPoint(dragState.svg, event.clientX, event.clientY);
      if (dragState.kind === 'route') {
        var routeDx = now.x - dragState.start.x;
        var routeDy = now.y - dragState.start.y;
        var nextPoints = clonePoints(dragState.points);
        var si = dragState.segmentIndex;
        var a = dragState.points[si];
        var b = dragState.points[si + 1];
        var segDx = b.x - a.x;
        var segDy = b.y - a.y;
        var moveX = routeDx;
        var moveY = routeDy;

        if (Math.abs(segDx) >= Math.abs(segDy) * 1.4) {
          moveX = 0;
        } else if (Math.abs(segDy) >= Math.abs(segDx) * 1.4) {
          moveY = 0;
        }
        if (snapToggle && snapToggle.checked) {
          if (moveX) moveX = Math.round((a.x + moveX) / 10) * 10 - a.x;
          if (moveY) moveY = Math.round((a.y + moveY) / 10) * 10 - a.y;
        }
        if (dragState.lockedEndpoints && dragState.points.length === 2) {
          nextPoints = anchoredTwoPointRoute(dragState.points, moveX, moveY);
        } else {
          nextPoints[si] = { x: a.x + moveX, y: a.y + moveY };
          nextPoints[si + 1] = { x: b.x + moveX, y: b.y + moveY };
        }
        applyRoutePoints(dragState.route, nextPoints);
        syncRouteOverlays(dragState.layer, dragState.route.id, nextPoints);

        if (finish) {
          var routes = readLayoutRoutes(textarea.value);
          routes[dragState.route.id] = { points: nextPoints };
          var editables = findEditableElements(dragState.svg);
          textarea.value = writePositionsIntoSource(textarea.value, typeSelect.value, collectPositions(editables), routes);
          dragState = null;
          renderDiagram();
        }
        return;
      }

      var dx = now.x - dragState.start.x;
      var dy = dragState.item.axis === 'x' ? 0 : now.y - dragState.start.y;
      var basePos = dragState.positions[dragState.item.id];
      var nextX = basePos.x + dx;
      var nextY = basePos.y + dy;
      if (dragState.item.axis === 'port') {
        var constrained = constrainedPortPosition(dragState.item, nextX, nextY);
        nextX = constrained.x;
        nextY = constrained.y;
      }
      if (snapToggle && snapToggle.checked) {
        if (dragState.item.axis !== 'port') nextX = Math.round(nextX / 10) * 10;
        nextY = Math.round(nextY / 10) * 10;
        if (dragState.item.axis === 'port') {
          var resnapped = constrainedPortPosition(dragState.item, nextX, nextY);
          nextX = resnapped.x;
          nextY = resnapped.y;
        }
      }
      var visualDx = dragState.item.axis === 'x'
        ? nextX - basePos.x
        : dragState.item.axis === 'port'
          ? nextX - basePos.x
          : nextX - dragState.box.x;
      var visualDy = dragState.item.axis === 'x' ? 0 : (dragState.item.axis === 'port' ? nextY - basePos.y : nextY - dragState.box.y);

      dragState.rect.setAttribute('x', dragState.box.x + visualDx);
      dragState.rect.setAttribute('y', dragState.box.y + visualDy);
      dragState.parts.forEach(function (part) {
        if (part.el.classList && part.el.classList.contains('git-graph-label-g')) {
          var cssT = 'translate(' + visualDx + 'px,' + visualDy + 'px)';
          part.el.style.transform = part.styleTransform ? part.styleTransform + ' ' + cssT : cssT;
        } else {
          var t = 'translate(' + visualDx + ' ' + visualDy + ')';
          part.el.setAttribute('transform', part.transform ? part.transform + ' ' + t : t);
        }
      });
      applyConnectedRouteDelta(dragState.connectedRoutes, dragState.item.id, visualDx, visualDy);

      // Group move: apply the same visual delta to every other selected element.
      if (dragState.groupItems) {
        dragState.groupItems.forEach(function (g) {
          if (g.item.id === dragState.item.id) return;
          if (g.rect) {
            g.rect.setAttribute('x', g.item.box.x + visualDx);
            g.rect.setAttribute('y', g.item.box.y + visualDy);
          }
          g.parts.forEach(function (part) {
            if (part.el.classList && part.el.classList.contains('git-graph-label-g')) {
              var cssT = 'translate(' + visualDx + 'px,' + visualDy + 'px)';
              part.el.style.transform = part.styleTransform ? part.styleTransform + ' ' + cssT : cssT;
            } else {
              var t = 'translate(' + visualDx + ' ' + visualDy + ')';
              part.el.setAttribute('transform', part.transform ? part.transform + ' ' + t : t);
            }
          });
          applyConnectedRouteDelta(g.connectedRoutes, g.item.id, visualDx, visualDy);
        });
      }

      if (finish) {
        dragState.positions[dragState.item.id] = { x: nextX, y: nextY };
        // For group: shift every other selected element's stored position by the
        // same visualDx/Dy.
        if (dragState.groupItems) {
          dragState.groupItems.forEach(function (g) {
            if (g.item.id === dragState.item.id) return;
            var p = dragState.positions[g.item.id];
            if (p) dragState.positions[g.item.id] = { x: p.x + visualDx, y: p.y + visualDy };
          });
        }
        // Sequence lifeline reordering: if a participant / actor was dragged
        // past another lifeline horizontally, swap their declaration order in
        // the source so the renderer lays them out in the new sequence.
        if (typeSelect.value === 'sequence' && dragState.item.axis === 'x') {
          var reordered = reorderSequenceLifelines(dragState.item.id, dragState.positions);
          if (reordered) {
            textarea.value = reordered;
            dragState.parts.forEach(function (part) {
              if (part.transform) part.el.setAttribute('transform', part.transform);
              else part.el.removeAttribute('transform');
            });
            dragState = null;
            renderDiagram();
            return;
          }
        }
        textarea.value = writePositionsIntoSource(textarea.value, typeSelect.value, dragState.positions);
        dragState.parts.forEach(function (part) {
          if (part.el.classList && part.el.classList.contains('git-graph-label-g')) {
            if (part.el.style) part.el.style.transform = part.styleTransform;
          } else if (part.transform) part.el.setAttribute('transform', part.transform);
          else part.el.removeAttribute('transform');
        });
        if (dragState.groupItems) {
          dragState.groupItems.forEach(function (g) {
            g.parts.forEach(function (part) {
              if (part.el.classList && part.el.classList.contains('git-graph-label-g')) {
                if (part.el.style) part.el.style.transform = part.styleTransform;
              } else if (part.transform) part.el.setAttribute('transform', part.transform);
              else part.el.removeAttribute('transform');
            });
          });
        }
        dragState = null;
        renderDiagram();
      }
    }

    // Load initial example, but prefer autosaved content if present.
    var autosaved = loadAutosaved(currentType);
    if (autosaved && autosaved.trim()) {
      textarea.value = autosaved;
    } else {
      textarea.value = exampleText(currentType, layoutSelect.value);
    }
    updateLayoutVisibility();

    function renderDiagram() {
      var text = textarea.value.trim();
      var type = typeSelect.value;
      errorBox.style.display = 'none';
      output.innerHTML = '';

      if (!text) {
        status.textContent = '';
        downloadBtn.disabled = true;
        return;
      }

      var renderer = RENDERERS[type];
      if (!renderer) {
        showError('Renderer for "' + type + '" not loaded yet.');
        return;
      }

      try {
        renderer(output, text);
        var svg = output.querySelector('svg');
        if (svg) {
          downloadBtn.disabled = false;
          status.textContent = '';
          installVisualEditor();
          // Visual mutations all funnel through renderDiagram; autosave once
          // per render so localStorage tracks every visual change.
          scheduleAutosave();
        } else {
          downloadBtn.disabled = true;
          status.textContent = 'No diagram produced.';
        }
      } catch (e) {
        showError(e.message || String(e));
        downloadBtn.disabled = true;
      }
    }

    function showError(msg) {
      errorBox.textContent = 'Error: ' + msg;
      errorBox.style.display = 'block';
      output.innerHTML = '';
      clearEditLayer();
      status.textContent = '';
    }

    function scheduleRender() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(renderDiagram, 250);
    }

    // Switch diagram type — restore autosaved content for that type, or load
    // the example if the user hadn't deviated from the previous type's example.
    typeSelect.addEventListener('change', function () {
      var prev = currentType;
      currentType = typeSelect.value;
      // Persist whatever's in the editor under the *previous* type before loading
      // the new type's content, so each type keeps its own draft.
      try { localStorage.setItem(autosaveKey(prev), textarea.value); } catch (e) {}
      var saved = loadAutosaved(currentType);
      if (saved && saved.trim()) {
        textarea.value = saved;
      } else if (normalizeLineEndings(textarea.value).trim() === exampleText(prev, layoutSelect.value).trim()) {
        textarea.value = exampleText(currentType, layoutSelect.value);
      }
      updateLayoutVisibility();
      setActiveTool(null);
      setSelectedLayoutId(null);
      rebuildPalette();
      renderDiagram();
    });

    layoutSelect.addEventListener('change', function () {
      if (!ignoresLayout()) {
        textarea.value = applyLayoutDirective(textarea.value, layoutSelect.value);
      }
      renderDiagram();
    });

    textarea.addEventListener('input', function () {
      scheduleRender();
      scheduleAutosave();
    });

    document.addEventListener('pointermove', function (event) {
      if (dragState) updateDrag(event, false);
      if (extendDragState) updateExtendDrag(event, false);
      if (paletteDragState) updatePaletteDrag(event, false);
    });

    document.addEventListener('pointerup', function (event) {
      if (dragState) updateDrag(event, true);
      if (extendDragState) updateExtendDrag(event, true);
      if (paletteDragState) updatePaletteDrag(event, true);
    });

    if (editToggle) {
      editToggle.addEventListener('change', function () {
        if (!editToggle.checked) {
          dragState = null;
          setSelectedLayoutId(null);
          setActiveTool(null);
          clearEditLayer();
        } else {
          installVisualEditor();
        }
        updatePaletteVisibility();
        rebuildPropsPane();
      });
    }

    if (toolCancel) {
      toolCancel.addEventListener('click', function () {
        setActiveTool(null);
        announce('Cancelled.', false);
      });
    }

    var fullscreenBtn = document.getElementById('uml-pg-fullscreen');
    var wrap = document.getElementById('uml-playground-wrap');
    var autosaveIndicator = document.getElementById('uml-pg-autosave');

    // ─── Autosave ─────────────────────────────────────────────────────────
    // Persist the textarea per diagram-type, restore on load. We key by type
    // so each example has its own slot — switching types doesn't clobber.
    function autosaveKey(t) { return 'uml-pg-autosave-' + (t || typeSelect.value); }
    var autosaveTimer = null;
    function scheduleAutosave() {
      if (autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(function () {
        try {
          localStorage.setItem(autosaveKey(), textarea.value);
          showSavedIndicator();
        } catch (e) { /* quota or disabled — silent */ }
        autosaveTimer = null;
      }, 250);
    }
    function showSavedIndicator() {
      if (!autosaveIndicator) return;
      autosaveIndicator.textContent = '✓ Saved';
      autosaveIndicator.classList.add('is-saved');
      clearTimeout(showSavedIndicator._t);
      showSavedIndicator._t = setTimeout(function () {
        autosaveIndicator.classList.remove('is-saved');
        autosaveIndicator.textContent = '';
      }, 1400);
    }
    function loadAutosaved(type) {
      try { return localStorage.getItem(autosaveKey(type)); }
      catch (e) { return null; }
    }
    function clearAutosaved(type) {
      try { localStorage.removeItem(autosaveKey(type)); } catch (e) {}
    }
    var helpBanner = document.getElementById('uml-pg-help-banner');
    var helpDismiss = document.getElementById('uml-pg-help-dismiss');
    var undoBtn = document.getElementById('uml-pg-undo');
    var redoBtn = document.getElementById('uml-pg-redo');

    // Show the help banner once per browser. Persist dismissal.
    try {
      if (helpBanner && !localStorage.getItem('uml-pg-help-dismissed')) {
        helpBanner.hidden = false;
      }
    } catch (e) { /* localStorage unavailable */ }
    if (helpDismiss) {
      helpDismiss.addEventListener('click', function () {
        if (helpBanner) helpBanner.hidden = true;
        try { localStorage.setItem('uml-pg-help-dismissed', '1'); } catch (e) {}
      });
    }
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);
    refreshUndoButtons();

    var zoomInBtn = document.getElementById('uml-pg-zoom-in');
    var zoomOutBtn = document.getElementById('uml-pg-zoom-out');
    var zoomReadoutBtn = document.getElementById('uml-pg-zoom-readout-btn');
    if (zoomInBtn) zoomInBtn.addEventListener('click', function () { zoomIn(); });
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', function () { zoomOut(); });
    if (zoomReadoutBtn) zoomReadoutBtn.addEventListener('click', function () { zoomToFit(); });
    updateZoomReadout();
    var splitEditor = document.getElementById('uml-pg-split-editor');
    var splitProps = document.getElementById('uml-pg-split-props');
    var editorPane = document.getElementById('uml-pg-editor-pane');

    function bindSplitter(splitter, paneEl, kind) {
      if (!splitter || !paneEl) return;
      var dragging = null;
      function onPointerDown(ev) {
        if (ev.button !== 0) return;
        ev.preventDefault();
        splitter.setPointerCapture(ev.pointerId);
        splitter.classList.add('is-dragging');
        var bodyRect = document.getElementById('uml-playground-body').getBoundingClientRect();
        var paneRect = paneEl.getBoundingClientRect();
        dragging = {
          startX: ev.clientX,
          startY: ev.clientY,
          startWidth: paneRect.width,
          bodyWidth: bodyRect.width,
          horizontal: window.matchMedia('(max-width: 700px)').matches
        };
      }
      function onPointerMove(ev) {
        if (!dragging) return;
        var newSize;
        if (dragging.horizontal) {
          newSize = dragging.startWidth + (ev.clientY - dragging.startY);
        } else if (kind === 'editor') {
          newSize = dragging.startWidth + (ev.clientX - dragging.startX);
        } else { // props pane on the right — drag left to grow
          newSize = dragging.startWidth - (ev.clientX - dragging.startX);
        }
        applyPaneSize(paneEl, kind, newSize, dragging.bodyWidth);
      }
      function onPointerUp(ev) {
        dragging = null;
        splitter.classList.remove('is-dragging');
        try { splitter.releasePointerCapture(ev.pointerId); } catch (e) {}
        // Persist
        try {
          var sz = paneEl.getBoundingClientRect().width;
          localStorage.setItem('uml-pg-' + kind + '-size', String(Math.round(sz)));
        } catch (e) {}
        // Re-render so canvas reflows.
        setTimeout(renderDiagram, 30);
      }
      function onKey(ev) {
        var step = ev.shiftKey ? 40 : 10;
        var delta = 0;
        if (ev.key === 'ArrowLeft') delta = kind === 'editor' ? -step : step;
        else if (ev.key === 'ArrowRight') delta = kind === 'editor' ? step : -step;
        else return;
        ev.preventDefault();
        var rect = paneEl.getBoundingClientRect();
        applyPaneSize(paneEl, kind, rect.width + delta, document.getElementById('uml-playground-body').getBoundingClientRect().width);
        try {
          localStorage.setItem('uml-pg-' + kind + '-size', String(Math.round(paneEl.getBoundingClientRect().width)));
        } catch (e) {}
        setTimeout(renderDiagram, 30);
      }
      splitter.addEventListener('pointerdown', onPointerDown);
      splitter.addEventListener('pointermove', onPointerMove);
      splitter.addEventListener('pointerup', onPointerUp);
      splitter.addEventListener('keydown', onKey);
    }

    function applyPaneSize(paneEl, kind, newSize, bodyWidth) {
      var min = kind === 'editor' ? 180 : 200;
      var max = kind === 'editor' ? Math.max(240, (bodyWidth || 1000) - 280) : Math.min(600, (bodyWidth || 1000) * 0.6);
      var size = Math.max(min, Math.min(max, newSize));
      paneEl.style.flex = '0 0 ' + size + 'px';
    }

    bindSplitter(splitEditor, editorPane, 'editor');
    bindSplitter(splitProps, propsPane, 'props');

    // Restore persisted sizes
    try {
      var ed = localStorage.getItem('uml-pg-editor-size');
      if (ed) editorPane.style.flex = '0 0 ' + Number(ed) + 'px';
      var pp = localStorage.getItem('uml-pg-props-size');
      if (pp && propsPane) propsPane.style.flex = '0 0 ' + Number(pp) + 'px';
    } catch (e) {}
    function setFullscreen(on) {
      if (!wrap || !fullscreenBtn) return;
      wrap.classList.toggle('is-fullscreen', !!on);
      document.body.classList.toggle('uml-pg-fullscreen-lock', !!on);
      fullscreenBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      fullscreenBtn.textContent = on ? '⤢ Exit full screen' : '⛶ Full screen';
      // Re-render so the canvas resizes to the new pane.
      setTimeout(renderDiagram, 30);
    }
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', function () {
        setFullscreen(!wrap.classList.contains('is-fullscreen'));
      });
    }

    if (propsDelete) {
      propsDelete.addEventListener('click', function () { deleteSelected(); });
    }

    // Global keyboard: Esc to cancel active tool, Delete to remove selected,
    // F to toggle fullscreen (only when not typing), Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo.
    document.addEventListener('keydown', function (event) {
      if (event.defaultPrevented) return;
      var key = event.key;
      var t = event.target;
      var typingInTextarea = t === textarea;
      var typingInForm = propsContent && propsContent.contains(t);
      var tag = t.tagName ? t.tagName.toLowerCase() : '';
      var inFormControl = tag === 'input' || tag === 'textarea' || tag === 'select';
      var inWrap = wrap && wrap.contains(t);
      var mod = event.metaKey || event.ctrlKey;
      // Undo / redo: only when not in a native text-editing surface (otherwise the
      // browser's textarea undo wins).
      if (mod && (key === 'z' || key === 'Z') && !inFormControl) {
        if (event.shiftKey) {
          event.preventDefault();
          redo();
        } else {
          event.preventDefault();
          undo();
        }
        return;
      }
      if (mod && (key === 'y' || key === 'Y') && !inFormControl) {
        event.preventDefault();
        redo();
        return;
      }
      // Select all elements + relations.
      if (mod && (key === 'a' || key === 'A') && inWrap && !inFormControl) {
        event.preventDefault();
        selectAll();
        return;
      }
      // Zoom: Cmd/Ctrl + +/-/0. We accept both '+' and '=' since '+' typically
      // requires Shift on US layouts; the keyCode-without-Shift variant is '='.
      if (mod && (key === '+' || key === '=' || event.code === 'Equal') && inWrap) {
        event.preventDefault();
        zoomIn();
        return;
      }
      if (mod && (key === '-' || event.code === 'Minus') && inWrap) {
        event.preventDefault();
        zoomOut();
        return;
      }
      if (mod && (key === '0' || event.code === 'Digit0') && inWrap) {
        event.preventDefault();
        zoomToFit();
        return;
      }
      if (key === 'Escape') {
        if (activeTool) {
          event.preventDefault();
          setActiveTool(null);
          announce('Cancelled.', false);
        } else if (wrap && wrap.classList.contains('is-fullscreen') && !inFormControl) {
          event.preventDefault();
          setFullscreen(false);
        } else if (selectedLayoutId && !typingInForm && !typingInTextarea) {
          event.preventDefault();
          setSelectedLayoutId(null);
        }
      } else if ((key === 'Delete' || key === 'Backspace') && selectedLayoutId &&
                 !typingInTextarea && !typingInForm) {
        if (inFormControl || tag === 'button') return;
        event.preventDefault();
        deleteSelected();
      } else if ((key === 'f' || key === 'F') && inWrap && !inFormControl) {
        event.preventDefault();
        setFullscreen(!wrap.classList.contains('is-fullscreen'));
      }
    });

    if (resetOneBtn) {
      resetOneBtn.addEventListener('click', function () {
        if (!selectedLayoutId) return;
        if (selectedLayoutKind === 'route') {
          var routes = readLayoutRoutes(textarea.value);
          delete routes[selectedLayoutId];
          var editablesForRouteReset = findEditableElements(output.querySelector('svg'));
          textarea.value = writePositionsIntoSource(textarea.value, typeSelect.value, collectPositions(editablesForRouteReset), routes);
          setSelectedLayoutId(null);
          renderDiagram();
          return;
        }
        var editables = findEditableElements(output.querySelector('svg'));
        var positions = collectPositions(editables);
        var selectedItem = editables.find(function (item) { return item.id === selectedLayoutId; });
        if (selectedItem && (selectedItem.axis === 'branch-label' || selectedItem.axis === 'label')) {
          delete positions[selectedLayoutId];
          textarea.value = writePositionsIntoSource(textarea.value, typeSelect.value, positions);
          setSelectedLayoutId(null);
          renderDiagram();
          return;
        }
        var autoPositions = autoLayoutPositions(textarea.value, typeSelect.value);
        if (autoPositions[selectedLayoutId]) positions[selectedLayoutId] = autoPositions[selectedLayoutId];
        else delete positions[selectedLayoutId];
        textarea.value = writePositionsIntoSource(textarea.value, typeSelect.value, positions);
        setSelectedLayoutId(null);
        renderDiagram();
      });
    }

    if (resetLayoutBtn) {
      resetLayoutBtn.addEventListener('click', function () {
        snapshotForUndo();
        textarea.value = stripLayoutMetadata(textarea.value);
        setSelectedLayoutId(null);
        resetView(); // also reset pan + zoom — the canvas snaps back to identity
        renderDiagram();
      });
    }

    var resetExampleBtn = document.getElementById('uml-pg-reset-example');
    if (resetExampleBtn) {
      resetExampleBtn.addEventListener('click', function () {
        if (!confirm('Discard your current draft and load the built-in example for this diagram type? (Use Cmd/Ctrl+Z to undo if you change your mind.)')) return;
        snapshotForUndo();
        textarea.value = exampleText(currentType, layoutSelect.value);
        clearAutosaved(currentType);
        setSelectedLayoutId(null);
        resetView();
        renderDiagram();
      });
    }

    if (copySourceBtn) {
      copySourceBtn.addEventListener('click', function () {
        var text = textarea.value;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            status.textContent = 'Copied ArchUML.';
            setTimeout(function () { status.textContent = ''; }, 1800);
          }, function () {
            textarea.focus();
            textarea.select();
          });
        } else {
          textarea.focus();
          textarea.select();
        }
      });
    }

    // Download SVG — produce a self-contained, portable file that renders
    // correctly in PowerPoint, Word, Inkscape, browsers, and other SVG
    // consumers. The renderer already inlines fills/strokes and uses SVG 1.1
    // filter primitives (no feDropShadow); here we strip CSS that only
    // makes sense in an HTML-embedded SVG and remove any in-page transform
    // applied by zoom/pan.
    downloadBtn.addEventListener('click', function () {
      var svg = output.querySelector('svg');
      if (!svg) return;

      var clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      if (!clone.getAttribute('xmlns:xlink')) {
        clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      }
      clone.classList.remove('uml-pg-editing');
      Array.prototype.slice.call(clone.querySelectorAll('.uml-pg-edit-layer')).forEach(function (layer) {
        if (layer.parentNode) layer.parentNode.removeChild(layer);
      });

      // The in-page renderer sets `style="font-family: ...; max-width: 100%;
      // height: auto;"` so the SVG flows nicely inside the article. The
      // last two declarations are HTML layout hints that some renderers
      // (notably PowerPoint) misinterpret; keep only `font-family`.
      var rootStyle = clone.getAttribute('style') || '';
      var fontMatch = rootStyle.match(/font-family\s*:\s*[^;]+/i);
      if (fontMatch) {
        clone.setAttribute('style', fontMatch[0] + ';');
      } else {
        clone.removeAttribute('style');
      }

      // Drop any inline transform from interactive zoom/pan that lives on
      // the root SVG so the export reflects the diagram's intrinsic size.
      clone.style.removeProperty('transform');

      var serializer = new XMLSerializer();
      var svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(clone);
      var blob = new Blob([svgStr], { type: 'image/svg+xml' });
      var url = URL.createObjectURL(blob);

      var a = document.createElement('a');
      a.href = url;
      a.download = 'uml-' + typeSelect.value + '-diagram.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      status.textContent = 'Downloaded!';
      setTimeout(function () { status.textContent = ''; }, 2000);
    });

    // Re-render on dark mode toggle
    var observer = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        if (mutations[m].attributeName === 'class') {
          setTimeout(renderDiagram, 60);
          break;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Build the palette once renderers are wired and the initial type is known.
    rebuildPalette();
    rebuildPropsPane();

    // Initial render — wait for renderers to be available
    function tryRender() {
      if (window.UMLClassDiagram && window.UMLSequenceDiagram &&
          window.UMLStateDiagram && window.UMLComponentDiagram &&
          window.UMLDeploymentDiagram && window.UMLUseCaseDiagram &&
          window.UMLActivityDiagram && window.UMLVennDiagram &&
          window.UMLERDiagram && window.UMLShared) {
        renderDiagram();
      } else {
        setTimeout(tryRender, 100);
      }
    }
    tryRender();

    downloadBtn.disabled = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>

---

<div class="uml-pg-syntax-help">
  <div class="uml-pg-syntax-help-text">
    <strong>Need syntax help?</strong> The full ArchUML syntax reference with live rendered examples is available on a dedicated page.
  </div>
  <a class="uml-pg-syntax-help-link" href="/SEBook/tools/uml-reference" target="_blank" rel="noopener">Open Syntax Reference ↗</a>
</div>
