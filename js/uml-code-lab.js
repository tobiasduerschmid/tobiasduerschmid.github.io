/** Chapter controls; analysis and SVG rendering belong to UMLLive. */
(function (global) {
  'use strict';
  const mounted = new Map();
  let nextId = 0;
  // Problems surface only after a typing pause, so half-typed code is not flagged.
  const PROBLEM_REVEAL_DELAY_MS = 500;
  // Lets the pointer cross from the badge to its details without closing them.
  const HOVER_CLOSE_DELAY_MS = 300;

  function describeProblem(problem) {
    const heading = document.createElement('strong');
    heading.textContent = `${problem.kind === 'syntax' ? 'Syntax error' : 'Error'} on line ${problem.line}, column ${problem.column}:`;
    const item = document.createElement('li');
    item.append(heading, ' ' + [problem.message, problem.hint].filter(Boolean).join(' '));
    return item;
  }

  /**
   * The badge beside the diagram title. report(problems) shows problems after
   * a typing pause (at once if the badge is already up); details open on hover
   * or click and close with Escape. It owns the source's aria-invalid and the
   * editor's markers while problems are shown.
   */
  function createProblemReport(root, codeEditor, signal) {
    const anchor = root.querySelector('[data-uml-problems-anchor]');
    const toggle = root.querySelector('[data-uml-problems-toggle]');
    const panel = root.querySelector('[data-uml-problems]');
    const source = root.querySelector('[data-uml-source]');
    const status = root.querySelector('[data-uml-status]');
    let revealTimer = null;
    let closeTimer = null;
    let shown = false;
    let pinned = false;

    panel.id = root.querySelector('[data-uml-task]').id.replace('task', 'problems');
    toggle.setAttribute('aria-controls', panel.id);

    function setOpen(open, pin = false) {
      clearTimeout(closeTimer);
      pinned = open && pin;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    }

    function show(problems) {
      shown = true;
      const count = problems.length === 1 ? 'the code problem' : `the ${problems.length} code problems`;
      const note = document.createElement('p');
      note.textContent = 'The diagram stays as it was until the code is fixed.';
      const list = document.createElement('ul');
      list.append(...problems.map(describeProblem));
      panel.replaceChildren(list, note);
      toggle.setAttribute('aria-label', 'Show ' + count);
      toggle.hidden = false;
      source.setAttribute('aria-invalid', 'true');
      status.textContent = `Diagram paused: the code has ${problems.length === 1 ? 'a problem' : problems.length + ' problems'}. Details are beside the diagram title.`;
      codeEditor.showProblems(problems);
    }

    function clear() {
      clearTimeout(revealTimer);
      if (!shown) return;
      shown = false;
      setOpen(false);
      toggle.hidden = true;
      source.setAttribute('aria-invalid', 'false');
      codeEditor.showProblems([]);
    }

    toggle.addEventListener('click', () => setOpen(panel.hidden || !pinned, true), { signal });
    anchor.addEventListener('mouseenter', () => { if (panel.hidden) setOpen(true); else clearTimeout(closeTimer); }, { signal });
    anchor.addEventListener('mouseleave', () => {
      if (!pinned) closeTimer = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
    }, { signal });
    document.addEventListener('pointerdown', event => {
      if (!panel.hidden && !anchor.contains(event.target)) setOpen(false);
    }, { signal });
    // Capture so the first Escape closes the details before an editor reacts to it.
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || panel.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      if (panel.contains(document.activeElement)) toggle.focus();
      setOpen(false);
    }, { signal, capture: true });

    return {
      /** problems is non-empty; clear() reports code that checks cleanly. */
      report(problems) {
        clearTimeout(revealTimer);
        if (shown) show(problems);
        else revealTimer = setTimeout(() => show(problems), PROBLEM_REVEAL_DELAY_MS);
      },
      /** New input restarts the pause before problems appear. */
      postpone() { clearTimeout(revealTimer); },
      clear
    };
  }

  function mount(root) {
    const example = JSON.parse(root.querySelector('script[type="application/json"]').textContent);
    const languageTabs = [...root.querySelectorAll('[data-language-option]')];
    const languageSwitcher = global.SEBookLanguageSwitcher.initSwitcher(root);
    const source = root.querySelector('[data-uml-source]');
    const preview = root.querySelector('[data-uml-preview]');
    const status = root.querySelector('[data-uml-status]');
    const task = root.querySelector('[data-uml-task]');
    const explanation = root.querySelector('[data-uml-explanation]');
    const events = new AbortController();
    const languages = languageTabs.map(button => button.dataset.languageOption);
    const drafts = Object.fromEntries(languages.map(id => [id, example[id].code]));
    let selectedLanguage = 'python';
    let client = null;
    let timer = null;
    let revision = 0;
    let renderRevision = 0;
    let lastAnalysis = null;
    let diagramView = 'implementation';
    let composing = false;
    let paused = false;

    task.id = 'uml-lab-task-' + (++nextId);
    status.id = 'uml-lab-status-' + nextId;
    source.setAttribute('aria-describedby', task.id + ' ' + status.id);
    const codeEditor = global.UMLCodeLabEditor.create(source, root.querySelector('[data-uml-editor]'), languages);
    const problemReport = createProblemReport(root, codeEditor, events.signal);
    const viewControls = global.UMLViewControls.mount(root.querySelector('[data-uml-view-controls]'), {
      view: diagramView,
      helpScope: document,
      onChange(view) {
        diagramView = view;
        if (lastAnalysis && lastAnalysis.revision === revision) renderAnalysis(lastAnalysis.result, revision);
      }
    });

    function syncSource() {
      drafts[selectedLanguage] = source.value;
      root.querySelector('[data-uml-print-code]').textContent = source.value;
    }

    function setStatus(message, state) {
      status.textContent = message;
      root.dataset.state = state;
      // While edits are pending or the code has problems, the problem report owns aria-invalid.
      if (state !== 'pending' && state !== 'invalid') source.setAttribute('aria-invalid', state === 'error' ? 'true' : 'false');
      preview.setAttribute('aria-busy', state === 'pending' ? 'true' : 'false');
    }

    /** Authored starter code is verified by tests, so it renders without loading checkers. */
    function sourceProblems(code) {
      if (code === example[selectedLanguage].code) return Promise.resolve([]);
      return global.SEBookSourceCheck.check(selectedLanguage, code).catch(error => {
        // A newer edit replaced this check; an unavailable checker must not
        // block the diagram, and analysis still reports what it cannot read.
        if (!error.superseded) console.warn('Source check unavailable:', error);
        return [];
      });
    }

    function clearPreview() {
      preview.replaceChildren();
      for (const attribute of ['role', 'aria-label', 'tabindex', 'data-uml-scroll-tabindex']) {
        preview.removeAttribute(attribute);
      }
    }

    function showLanguage() {
      selectedLanguage = languageSwitcher.language;
      const selectedTab = languageTabs.find(button => button.dataset.languageOption === selectedLanguage);
      const label = selectedTab.textContent + ' code';
      root.querySelector('[data-uml-source-label]').textContent = label;
      root.querySelector('[data-uml-print-label]').textContent = label;
      source.value = drafts[selectedLanguage];
      source.rows = Math.max(8, Math.min(18, source.value.trimEnd().split('\n').length));
      problemReport.clear();
      codeEditor.sync(selectedLanguage, label, selectedTab.dataset.filename);
      task.textContent = example[selectedLanguage].task;
      explanation.open = false;
      syncSource();
      schedule(0);
    }

    function schedule(delay = 150) {
      const currentRevision = ++revision;
      renderRevision++;
      clearTimeout(timer);
      problemReport.postpone();
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
      const filename = languageTabs.find(button => button.dataset.languageOption === selectedLanguage).dataset.filename;
      const code = source.value;
      try {
        const problems = await sourceProblems(code);
        if (!isCurrent()) return;
        if (problems.length) {
          // The preview keeps its last diagram until the code checks cleanly.
          setStatus('', 'invalid');
          problemReport.report(problems);
          return;
        }
        problemReport.clear();
        const result = await client.analyze({ language: selectedLanguage, sources: { [filename]: code } });
        if (!isCurrent()) return;
        if (result.errors.length) throw new Error(result.errors.join(' '));
        lastAnalysis = { result, revision: currentRevision };
        await renderAnalysis(result, currentRevision);
      } catch (error) {
        if (!isCurrent() || global.UMLLive.isSuperseded(error)) return;
        clearPreview();
        setStatus('Could not update the diagram. ' + error.message, 'error');
      }
    }

    /** A view change reuses the current source analysis and never changes the editor. */
    async function renderAnalysis(result, currentRevision) {
      const currentRender = ++renderRevision;
      const isCurrent = () => !paused && revision === currentRevision && renderRevision === currentRender;
      setStatus('Updating diagram…', 'pending');
      try {
        const projected = client.project(result, { language: selectedLanguage, view: diagramView });
        const warnings = example.type === 'sequence' ? projected.sequenceWarnings || [] : [];
        const warningText = 'Warning: partial sequence. ' + warnings.map(item => item.message).join(' ');
        const syntax = projected[example.type + 'Diagram'];
        if (!hasDiagram(syntax)) {
          clearPreview();
          setStatus(warnings.length ? warningText : example.type === 'class' ? 'No classes found.' : 'No calls found. Add an entry-point call.', warnings.length ? 'warning' : 'empty');
          return;
        }
        const rendered = await client.render({ type: example.type, syntax, target: preview, isCurrent, readOnly: true });
        if (rendered && isCurrent()) setStatus(warnings.length ? warningText : 'Diagram updated.', warnings.length ? 'warning' : 'ready');
      } catch (error) {
        if (!isCurrent() || global.UMLLive.isSuperseded(error)) return;
        setStatus('Could not update the diagram. ' + error.message, 'error');
      }
    }

    function listen(element, name, callback) {
      element.addEventListener(name, callback, { signal: events.signal });
    }

    // Checkers load on first use; start when the learner reaches the code.
    listen(root.querySelector('.uml-code-lab-editor'), 'focusin', () => global.SEBookSourceCheck.prepare(selectedLanguage));
    listen(source, 'input', () => schedule());
    listen(source, 'compositionstart', () => { composing = true; schedule(); });
    listen(source, 'compositionend', () => { composing = false; schedule(); });
    listen(root, 'sebook:languagechange', showLanguage);
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
      destroy() { pause(); viewControls.destroy(); codeEditor.destroy(); languageSwitcher.destroy(); events.abort(); mounted.delete(root); }
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
