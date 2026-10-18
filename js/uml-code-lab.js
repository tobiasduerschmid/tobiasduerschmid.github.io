/** Chapter controls; analysis and SVG rendering belong to UMLLive. */
(function (global) {
  'use strict';
  const mounted = new Map();
  let nextId = 0;

  function mount(root) {
    const example = JSON.parse(root.querySelector('script[type="application/json"]').textContent);
    const language = root.querySelector('[data-uml-language]');
    const source = root.querySelector('[data-uml-source]');
    const preview = root.querySelector('[data-uml-preview]');
    const status = root.querySelector('[data-uml-status]');
    const task = root.querySelector('[data-uml-task]');
    const explanation = root.querySelector('[data-uml-explanation]');
    const events = new AbortController();
    const drafts = { java: example.java.code, python: example.python.code };
    let selectedLanguage = 'python';
    let client = null;
    let timer = null;
    let revision = 0;
    let composing = false;
    let paused = false;

    task.id = 'uml-lab-task-' + (++nextId);
    status.id = 'uml-lab-status-' + nextId;
    source.setAttribute('aria-describedby', task.id + ' ' + status.id);
    const codeEditor = global.UMLCodeLabEditor.create(source, root.querySelector('[data-uml-editor]'));

    function syncSource() {
      drafts[selectedLanguage] = source.value;
      root.querySelector('[data-uml-print-code]').textContent = source.value;
    }

    function setStatus(message, state) {
      status.textContent = message;
      root.dataset.state = state;
      source.setAttribute('aria-invalid', state === 'error' ? 'true' : 'false');
      preview.setAttribute('aria-busy', state === 'pending' ? 'true' : 'false');
    }

    function clearPreview() {
      preview.replaceChildren();
      for (const attribute of ['role', 'aria-label', 'tabindex', 'data-uml-scroll-tabindex']) {
        preview.removeAttribute(attribute);
      }
    }

    function showLanguage() {
      selectedLanguage = language.value;
      const label = selectedLanguage === 'java' ? 'Java code' : 'Python code';
      root.querySelector('[data-uml-source-label]').textContent = label;
      root.querySelector('[data-uml-print-label]').textContent = label;
      source.value = drafts[selectedLanguage];
      source.rows = Math.max(8, Math.min(18, source.value.trimEnd().split('\n').length));
      codeEditor.sync(selectedLanguage, label);
      task.textContent = example[selectedLanguage].task;
      explanation.open = false;
      syncSource();
      schedule(0);
    }

    function schedule(delay = 150) {
      const currentRevision = ++revision;
      clearTimeout(timer);
      syncSource();
      setStatus('Updating diagram…', 'pending');
      if (!composing && !paused) timer = setTimeout(() => update(currentRevision), delay);
    }

    function hasDiagram(syntax) {
      if (!syntax) return false;
      return example.type !== 'class' || global.UMLClassDiagram.parse(syntax).classes.length > 0;
    }

    async function update(currentRevision) {
      const isCurrent = () => !paused && revision === currentRevision;
      if (!isCurrent()) return;
      if (!client) client = global.UMLLive.createClient();
      const filename = selectedLanguage === 'java' ? 'Example.java' : 'example.py';
      try {
        const result = await client.analyze({ language: selectedLanguage, sources: { [filename]: source.value } });
        if (!isCurrent()) return;
        if (result.errors.length) throw new Error(result.errors.join(' '));
        const syntax = result[example.type + 'Diagram'];
        if (!hasDiagram(syntax)) {
          clearPreview();
          setStatus(example.type === 'class' ? 'No classes found.' : 'No calls found. Add an entry-point call.', 'empty');
          return;
        }
        const rendered = await client.render({
          type: example.type, syntax, target: preview, isCurrent, readOnly: true
        });
        if (rendered && isCurrent()) setStatus('Diagram updated.', 'ready');
      } catch (error) {
        if (!isCurrent() || global.UMLLive.isSuperseded(error)) return;
        clearPreview();
        setStatus('Could not update the diagram. ' + error.message, 'error');
      }
    }

    function listen(element, name, callback) {
      element.addEventListener(name, callback, { signal: events.signal });
    }

    listen(source, 'input', () => schedule());
    listen(source, 'compositionstart', () => { composing = true; schedule(); });
    listen(source, 'compositionend', () => { composing = false; schedule(); });
    listen(language, 'change', showLanguage);
    listen(root.querySelector('[data-uml-reset]'), 'click', () => {
      drafts[selectedLanguage] = example[selectedLanguage].code;
      showLanguage();
    });
    root.querySelector('.uml-code-lab-interactive').hidden = false;
    root.querySelector('.uml-code-lab-fallback').hidden = true;
    showLanguage();

    function pause() {
      paused = true;
      revision++;
      clearTimeout(timer);
      if (client) client.dispose();
      client = null;
    }

    return {
      pause,
      resume() { paused = false; schedule(0); },
      destroy() { pause(); codeEditor.destroy(); events.abort(); mounted.delete(root); }
    };
  }

  function initFrom(scope = document) {
    scope.querySelectorAll('[data-uml-code-lab]').forEach(root => {
      if (!mounted.has(root)) mounted.set(root, mount(root));
    });
  }

  global.UMLCodeLab = {
    initFrom,
    destroyWithin(scope) {
      mounted.forEach((lab, root) => { if (scope.contains(root)) lab.destroy(); });
    }
  };
  global.addEventListener('pagehide', () => mounted.forEach(lab => lab.pause()));
  global.addEventListener('pageshow', event => {
    if (event.persisted) mounted.forEach(lab => lab.resume());
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initFrom());
  else initFrom();
})(window);
