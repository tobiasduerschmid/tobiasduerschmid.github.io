---
title: "UML Playground"
layout: sebook
permalink: /SEBook/tools/uml-playground
---

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
    </select>
    <button id="uml-pg-download" title="Download diagram as SVG file">&#8595; Download SVG</button>
    <span id="uml-pg-status"></span>
  </div>

  <div id="uml-playground-body">
    <div id="uml-pg-editor-pane">
      <textarea id="uml-pg-input" spellcheck="false" autocorrect="off" autocapitalize="off"></textarea>
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
  overflow: hidden;
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

#uml-pg-type {
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
  color: #888;
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
body.dark-mode #uml-playground-wrap {
  border-color: #3a4a60;
}

body.dark-mode #uml-playground-toolbar {
  background: #1e2c3e;
  border-color: #3a4a60;
}

body.dark-mode #uml-playground-toolbar label {
  color: #b0c4d8;
}

body.dark-mode #uml-pg-type {
  background: #243347;
  border-color: #3a4a60;
  color: #d0e0f0;
}

body.dark-mode #uml-pg-input {
  background: #141e2b;
  color: #d0e0f0;
  border-color: #3a4a60;
}

body.dark-mode #uml-pg-editor-pane {
  border-color: #3a4a60;
}

body.dark-mode #uml-pg-preview-pane {
  background: #1a2535;
}

body.dark-mode #uml-pg-status {
  color: #6688aa;
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
      'participant user: User',
      'participant app: Application',
      'participant db: Database',
      'user -> app: login(username, password)',
      'activate app',
      'app -> db: queryUser(username)',
      'db --> app: userData',
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

    component: [
      '@startuml',
      'component Frontend {',
      '  port httpOut',
      '}',
      'component Backend {',
      '  port httpIn',
      '  port dbOut',
      '  port eventOut',
      '}',
      'component Database {',
      '  port dbIn',
      '}',
      'component EventBus {',
      '  port eventIn',
      '}',
      'Frontend.httpOut --> Backend.httpIn : REST / JSON',
      'Backend.dbOut --> Database.dbIn : SQL',
      'Backend.eventOut --> EventBus.eventIn : publish',
      '@enduml'
    ].join('\n'),
  };

  var RENDERERS = {
    class: function (container, text) { window.UMLClassDiagram.render(container, text); },
    sequence: function (container, text) { window.UMLSequenceDiagram.render(container, text); },
    state: function (container, text) { window.UMLStateDiagram.render(container, text); },
    component: function (container, text) { window.UMLComponentDiagram.render(container, text); },
    deployment: function (container, text) { window.UMLDeploymentDiagram.render(container, text); },
  };

  function init() {
    var typeSelect = document.getElementById('uml-pg-type');
    var textarea = document.getElementById('uml-pg-input');
    var output = document.getElementById('uml-pg-output');
    var errorBox = document.getElementById('uml-pg-error');
    var downloadBtn = document.getElementById('uml-pg-download');
    var status = document.getElementById('uml-pg-status');

    if (!typeSelect || !textarea || !output) return;

    var debounceTimer = null;
    var currentType = typeSelect.value;

    // Load initial example
    textarea.value = EXAMPLES[currentType] || '';

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
      if (textarea.value.trim() === (EXAMPLES[prev] || '').trim()) {
        textarea.value = EXAMPLES[currentType] || '';
      }
      renderDiagram();
    });

    textarea.addEventListener('input', scheduleRender);

    // Download SVG
    downloadBtn.addEventListener('click', function () {
      var svg = output.querySelector('svg');
      if (!svg) return;

      // Clone and ensure standalone SVG has XML namespace
      var clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      if (!clone.getAttribute('xmlns:xlink')) {
        clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      }

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
      var type = typeSelect.value;
      if (window.UMLClassDiagram && window.UMLSequenceDiagram &&
          window.UMLStateDiagram && window.UMLComponentDiagram &&
          window.UMLDeploymentDiagram) {
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
