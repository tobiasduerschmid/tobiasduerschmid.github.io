---
title: "UML Playground"
layout: sebook
permalink: /SEBook/tools/uml-playground
---

<script src="/js/git-graph.js"></script>
<link rel="stylesheet" href="/css/git-graph.css">

# UML Playground

Edit the diagram spec on the left and see the rendered SVG update live on the right. Switch between diagram types using the selector, then download the SVG when you're happy with the result.

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
      <input type="checkbox" id="uml-pg-edit" aria-label="Visual edit">
      Visual edit
    </label>
    <label for="uml-pg-edit-mode">Edit:</label>
    <select id="uml-pg-edit-mode">
      <option value="nodes" selected>Elements</option>
      <option value="lines">Lines</option>
    </select>
    <label class="uml-pg-check" for="uml-pg-snap">
      <input type="checkbox" id="uml-pg-snap" aria-label="Snap to layout grid" checked>
      Snap
    </label>
    <button id="uml-pg-reset-one" title="Reset selected layout override" disabled>Reset Selected</button>
    <button id="uml-pg-reset-layout" title="Remove layout overrides">Reset Layout</button>
    <button id="uml-pg-copy-source" title="Copy generated ArchUML">Copy ArchUML</button>
    <button id="uml-pg-download" title="Download diagram as SVG file">&#8595; Download SVG</button>
    <span id="uml-pg-status"></span>
  </div>

  <div id="uml-playground-body">
    <div id="uml-pg-editor-pane">
      <textarea id="uml-pg-input" aria-label="ArchUML diagram source" spellcheck="false" autocorrect="off" autocapitalize="off"></textarea>
    </div>
    <div id="uml-pg-preview-pane">
      <div id="uml-pg-output" class="uml-class-diagram-container"></div>
      <div id="uml-pg-error" style="display:none;"></div>
    </div>
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
#uml-pg-layout,
#uml-pg-edit-mode {
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
#uml-pg-copy-source {
  font-size: 0.88em;
  padding: 3px 10px;
  background: #fff;
  color: #26415f;
  border: 1px solid #b0bdd4;
  border-radius: 4px;
  cursor: pointer;
  min-height: 24px;
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

#uml-playground-body {
  display: flex;
  min-height: 420px;
}

#uml-pg-editor-pane {
  flex: 0 0 40%;
  border-right: 1px solid #c8d4e8;
  display: flex;
  flex-direction: column;
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
html.dark-mode #uml-pg-layout,
html.dark-mode #uml-pg-edit-mode {
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

  function init() {
    var typeSelect = document.getElementById('uml-pg-type');
    var layoutSelect = document.getElementById('uml-pg-layout');
    var layoutLabel = document.getElementById('uml-pg-layout-label');
    var textarea = document.getElementById('uml-pg-input');
    var output = document.getElementById('uml-pg-output');
    var errorBox = document.getElementById('uml-pg-error');
    var downloadBtn = document.getElementById('uml-pg-download');
    var editToggle = document.getElementById('uml-pg-edit');
    var editModeSelect = document.getElementById('uml-pg-edit-mode');
    var snapToggle = document.getElementById('uml-pg-snap');
    var resetOneBtn = document.getElementById('uml-pg-reset-one');
    var resetLayoutBtn = document.getElementById('uml-pg-reset-layout');
    var copySourceBtn = document.getElementById('uml-pg-copy-source');
    var status = document.getElementById('uml-pg-status');

    if (!typeSelect || !layoutSelect || !textarea || !output) return;

    var debounceTimer = null;
    var currentType = typeSelect.value;
    var selectedLayoutId = null;
    var selectedLayoutKind = null;
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

    function setSelectedLayoutId(id, kind) {
      selectedLayoutId = id || null;
      selectedLayoutKind = selectedLayoutId ? (kind || 'node') : null;
      if (resetOneBtn) resetOneBtn.disabled = !selectedLayoutId;
      var layer = output.querySelector('.uml-pg-edit-layer');
      if (!layer) return;
      Array.prototype.slice.call(layer.querySelectorAll('.uml-pg-edit-hitbox')).forEach(function (rect) {
        rect.classList.toggle('is-selected', selectedLayoutKind === 'node' && rect.getAttribute('data-layout-id') === selectedLayoutId);
      });
      Array.prototype.slice.call(layer.querySelectorAll('.uml-pg-edge-hitbox')).forEach(function (line) {
        line.classList.toggle('is-selected', selectedLayoutKind === 'route' && line.getAttribute('data-layout-id') === selectedLayoutId);
      });
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
          setRouteOverlaySegment(seg, route.points[i], route.points[i + 1]);
          seg.addEventListener('pointerdown', function (event) {
            event.preventDefault();
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
            event.currentTarget.setPointerCapture(event.pointerId);
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
        return;
      }

      clearEditLayer();
      svg.classList.add('uml-pg-editing');
      var editables = findEditableElements(svg);
      var ns = 'http://www.w3.org/2000/svg';
      var layer = document.createElementNS(ns, 'g');
      layer.setAttribute('class', 'uml-pg-edit-layer');
      svg.appendChild(layer);

      if (editModeSelect && editModeSelect.value === 'lines') {
        installRouteEditor(svg, layer);
        return;
      }

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
        rect.addEventListener('pointerdown', function (event) {
          event.preventDefault();
          var start = svgPoint(svg, event.clientX, event.clientY);
          setSelectedLayoutId(item.id, 'node');
          dragState = {
            svg: svg,
            rect: rect,
            item: item,
            start: start,
            box: item.box,
            positions: collectPositions(editables),
            parts: collectMoveParts(svg, item.box, item.id),
            connectedRoutes: collectConnectedRoutes(svg, item.id)
          };
          rect.setPointerCapture(event.pointerId);
        });
        layer.appendChild(rect);
      });

      if (!editables.length) {
        status.textContent = 'No movable elements detected for this diagram yet.';
      } else {
        status.textContent = 'Drag a highlighted element.';
      }
    }

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

      if (finish) {
        dragState.positions[dragState.item.id] = { x: nextX, y: nextY };
        textarea.value = writePositionsIntoSource(textarea.value, typeSelect.value, dragState.positions);
        dragState.parts.forEach(function (part) {
          if (part.el.classList && part.el.classList.contains('git-graph-label-g')) {
            if (part.el.style) part.el.style.transform = part.styleTransform;
          } else if (part.transform) part.el.setAttribute('transform', part.transform);
          else part.el.removeAttribute('transform');
        });
        dragState = null;
        renderDiagram();
      }
    }

    // Load initial example
    textarea.value = exampleText(currentType, layoutSelect.value);
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

    // Switch diagram type — load example if textarea matches previous example
    typeSelect.addEventListener('change', function () {
      var prev = currentType;
      currentType = typeSelect.value;
      if (normalizeLineEndings(textarea.value).trim() === exampleText(prev, layoutSelect.value).trim()) {
        textarea.value = exampleText(currentType, layoutSelect.value);
      }
      updateLayoutVisibility();
      renderDiagram();
    });

    layoutSelect.addEventListener('change', function () {
      if (!ignoresLayout()) {
        textarea.value = applyLayoutDirective(textarea.value, layoutSelect.value);
      }
      renderDiagram();
    });

    textarea.addEventListener('input', scheduleRender);

    document.addEventListener('pointermove', function (event) {
      if (dragState) updateDrag(event, false);
    });

    document.addEventListener('pointerup', function (event) {
      if (dragState) updateDrag(event, true);
    });

    if (editToggle) {
      editToggle.addEventListener('change', function () {
        if (!editToggle.checked) {
          dragState = null;
          setSelectedLayoutId(null);
          clearEditLayer();
        } else {
          installVisualEditor();
        }
      });
    }

    if (editModeSelect) {
      editModeSelect.addEventListener('change', function () {
        dragState = null;
        setSelectedLayoutId(null);
        installVisualEditor();
      });
    }

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
        textarea.value = stripLayoutMetadata(textarea.value);
        setSelectedLayoutId(null);
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

<div style="margin:1.5em 0;padding:1em 1.2em;background:#eef4fb;border:1px solid #c0d4ec;border-radius:6px;display:flex;align-items:center;gap:1em;flex-wrap:wrap;">
  <div style="flex:1;min-width:200px;">
    <strong>Need syntax help?</strong> The full ArchUML syntax reference with live rendered examples is available on a dedicated page.
  </div>
  <a href="/SEBook/tools/uml-reference" target="_blank" style="white-space:nowrap;padding:7px 16px;background:#2774AE;color:#fff;border-radius:4px;text-decoration:none;font-weight:600;font-size:0.9em;">Open Syntax Reference ↗</a>
</div>
