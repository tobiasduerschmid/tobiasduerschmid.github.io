(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  function element(tag, className, text) {
    const node = document.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  }
  function button(label, action) {
    const node = element('button', '', label); node.type = 'button'; node.addEventListener('click', action); return node;
  }
  /** A terminal and bounded inspector for the Browser's persistent live Workspace. */
  function mount({ root, workspace, createEditor, compact = false, onInspect = () => {} }) {
    const view = element('section', 'smalltalk-inspector'); view.setAttribute('aria-label', 'Smalltalk live terminal'); view.tabIndex = -1; root.append(view);
    const heading = element('h2', '', 'Live terminal');
    const description = element('p', '', 'Same live image: variables and objects persist. Restart clears live objects and reloads accepted code. Each grading check runs in its own fresh image. Keep Trait definitions and their methods in source files for Restart and check replay.');
    const status = element('p', 'smalltalk-status', 'Live session ready.'); status.setAttribute('role', 'status'); status.setAttribute('aria-label', 'Live session status');
    const expressionRegion = element('section'); expressionRegion.setAttribute('aria-label', 'Smalltalk expression');
    const expressionLabel = element('h3', compact ? 'sr-only' : '', 'Smalltalk expression'); const editorHost = element('div', 'smalltalk-expression-editor');
    expressionRegion.append(expressionLabel, editorHost);
    const toolbar = element('div', 'smalltalk-toolbar');
    const evaluate = button('Evaluate', () => evaluateExpression());
    evaluate.classList.add('smalltalk-action-primary');
    const stop = button('Stop evaluation', () => stopEvaluation()); stop.disabled = true;
    const restart = button('Restart session', () => restartSession());
    const inspectResult = button('Inspect result', () => showInspection(lastResult, 'Result')); inspectResult.disabled = true;
    toolbar.append(evaluate, stop, restart, inspectResult);
    const historyToolbar = element('div', 'smalltalk-toolbar'); historyToolbar.setAttribute('aria-label', 'Command history');
    const previous = button('Previous command', () => recall(-1)); const next = button('Next command', () => recall(1));
    historyToolbar.append(previous, next);
    const cleanupStatus = element('p'); cleanupStatus.setAttribute('role', 'status'); cleanupStatus.setAttribute('aria-label', 'Inspector cleanup status'); cleanupStatus.hidden = true;
    const retryCleanup = button('Retry inspector cleanup', () => release([...pendingCleanup.keys()])); retryCleanup.hidden = true;
    const terminalRegion = element('section'); terminalRegion.setAttribute('aria-label', 'Terminal history');
    const terminalHistory = element('pre', 'smalltalk-terminal-history'); terminalHistory.tabIndex = 0; terminalHistory.setAttribute('role', 'region'); terminalHistory.setAttribute('aria-label', 'Submitted commands and native output');
    terminalRegion.append(element('h3', '', 'Terminal history'), terminalHistory);
    const resultRegion = element('section'); resultRegion.setAttribute('aria-label', 'Evaluation result');
    const result = element('pre', 'smalltalk-evaluation-result'); resultRegion.append(result);
    const transcriptRegion = element('section'); transcriptRegion.setAttribute('aria-label', 'Transcript');
    const transcript = element('pre', 'smalltalk-transcript'); transcript.tabIndex = 0; transcript.setAttribute('role', 'region'); transcript.setAttribute('aria-label', 'Transcript output');
    transcriptRegion.append(element('h3', '', 'Transcript'), button('Clear Transcript', () => { transcript.textContent = ''; }), transcript);
    const objects = element('section', 'smalltalk-inspected-objects'); objects.setAttribute('aria-label', 'Object inspector');
    objects.append(element('h3', '', 'Object inspector')); objects.hidden = true;
    const header = element('div', 'smalltalk-terminal-header'); header.append(heading, status);
    const help = element('details', 'smalltalk-terminal-help'); help.append(element('summary', '', 'Live session help'), description);
    if (compact) {
      view.classList.add('smalltalk-compact-terminal');
      const details = element('details', 'smalltalk-terminal-details');
      details.append(element('summary', '', 'History and Transcript'), historyToolbar, terminalRegion, transcriptRegion, help);
      view.append(header, expressionRegion, toolbar, resultRegion, details, cleanupStatus, retryCleanup, objects);
    } else view.append(header, help, expressionRegion, toolbar, historyToolbar, cleanupStatus, retryCleanup, terminalRegion, resultRegion, transcriptRegion, objects);
    const editor = createEditor({ element: editorHost, value: '', language: 'smalltalk', ariaLabel: 'Smalltalk expression', onChange() {} });
    const handles = new Map(); const pendingCleanup = new Map(); const panels = new Set(); let commands = [], commandIndex = 0, pendingExpression = '', handleGeneration = 0;
    let lastResult = null, evaluation = null, disposed = false, stopping = false;
    const unsubscribe = workspace.subscribe(event => {
      if (event.type !== 'runtime') return;
      const detail = event.detail;
      if (detail.type === 'output') appendTranscript(detail.payload.text);
      if (detail.type === 'recovered') {
        invalidatePanels(); status.textContent = detail.stateRewound ? 'Session restored; inspector handles are stale. Evaluate again to inspect live objects.' : 'Session ready.';
      }
    });
    updateHistory();
    function appendHistory(text) { terminalHistory.textContent = (terminalHistory.textContent + text).slice(-32768); }
    function appendTranscript(text) { transcript.textContent = (transcript.textContent + text).slice(-32768); appendHistory(text); }
    function updateHistory() { previous.disabled = !commands.length || commandIndex <= 0; next.disabled = commandIndex >= commands.length; }
    function recall(direction) {
      if (commandIndex === commands.length) pendingExpression = editor.getValue();
      commandIndex += direction; editor.setValue(commandIndex === commands.length ? pendingExpression : commands[commandIndex]); updateHistory();
    }
    function restoreFocus(control, hadFocus) {
      if (hadFocus && [document.body, document.documentElement].includes(document.activeElement)) control.focus();
    }
    function setRunning(running) { evaluate.disabled = running; stop.disabled = !running; restart.disabled = running; }
    function retain(summary, sessionId) { if (summary && summary.handle) handles.set(summary.handle, sessionId); }
    async function release(list, sessionId) {
      const generation = handleGeneration;
      const groups = new Map();
      for (const handle of new Set(list)) {
        const identity = sessionId === undefined ? handles.get(handle) : sessionId;
        handles.set(handle, identity); // Late responses also remain owned until release succeeds.
        pendingCleanup.set(handle, identity);
        if (!groups.has(identity)) groups.set(identity, []);
        groups.get(identity).push(handle);
      }
      await Promise.all([...groups].map(async ([identity, group]) => {
        try {
          // Workspace checks this opaque session identity when its queued release executes.
          await workspace.releaseHandles(group, identity === undefined ? {} : { sessionId: identity });
          if (generation !== handleGeneration) return;
          group.forEach(handle => { handles.delete(handle); pendingCleanup.delete(handle); });
        } catch (error) {
          if (generation !== handleGeneration) return;
          const invalidSession = error.code === 'CANCELLED' || (error.code === 'PRECONDITION_FAILED' &&
            ['Workspace is disposed', 'Session is no longer active'].includes(error.message));
          if (invalidSession) { group.forEach(handle => { handles.delete(handle); pendingCleanup.delete(handle); }); return; }
          if (disposed) console.error('Smalltalk Inspector cleanup failed', error);
          else { cleanupStatus.hidden = false; cleanupStatus.textContent = 'Inspector cleanup failed: ' + error.message; retryCleanup.hidden = false; }
        }
      }));
      if (!disposed && !pendingCleanup.size) {
        const ownedFocus = document.activeElement === retryCleanup;
        cleanupStatus.hidden = true; retryCleanup.hidden = true;
        if (ownedFocus) (evaluate.disabled ? view : evaluate).focus();
      }
    }
    async function evaluateExpression() {
      if (evaluation || disposed) return;
      const hadFocus = document.activeElement === evaluate;
      const source = editor.getValue(); if (!source.trim()) { status.textContent = 'Enter a Smalltalk expression to evaluate.'; return; }
      if (commands[commands.length - 1] !== source) commands.push(source);
      if (commands.length > 100) commands.shift(); commandIndex = commands.length; pendingExpression = ''; updateHistory();
      appendHistory('> ' + source + '\n');
      evaluation = new AbortController(); setRunning(true); status.textContent = 'Evaluating in the live image…';
      const oldHandle = lastResult && lastResult.handle; lastResult = null; inspectResult.disabled = true;
      if (oldHandle && ![...panels].some(panel => panel.handle === oldHandle)) release([oldHandle]);
      try {
        const response = await workspace.evaluate(source, { signal: evaluation.signal });
        if (disposed || stopping) return;
        if (response.error) { appendHistory('Error: ' + response.error.message + '\n'); result.textContent = response.error.message; status.textContent = 'Evaluation error: ' + response.error.message; }
        else { appendHistory('→ ' + (response.value ? response.value.text : '') + '\n'); lastResult = response.value; retain(lastResult); result.textContent = lastResult ? lastResult.text : ''; inspectResult.disabled = !lastResult || !lastResult.handle; status.textContent = compact ? 'Evaluation complete. Live state retained.' : 'Evaluation complete. Live variables and objects are retained.'; }
      } catch (error) { if (!disposed && !stopping) { appendHistory('Error: ' + error.message + '\n'); result.textContent = error.message; status.textContent = 'Evaluation error: ' + error.message; } }
      finally { evaluation = null; if (!disposed && !stopping) { setRunning(false); restoreFocus(evaluate, hadFocus); } }
    }
    function invalidatePanels() {
      handleGeneration++; lastResult = null; inspectResult.disabled = true; handles.clear(); pendingCleanup.clear(); cleanupStatus.hidden = true; retryCleanup.hidden = true;
      for (const panel of panels) { panel.stale = true; panel.status.textContent = 'Stale object: the live session was restored or restarted. Evaluate again to obtain a current object.'; panel.next.disabled = true; panel.list.querySelectorAll('button').forEach(control => { control.disabled = true; }); }
    }
    async function restartSession() {
      const hadFocus = document.activeElement === restart;
      evaluate.disabled = true; restart.disabled = true;
      try { await workspace.restart(); if (!disposed) { invalidatePanels(); status.textContent = 'Session restarted. Live bindings and objects were cleared; accepted code and drafts were retained.'; } }
      catch (error) { if (!disposed) status.textContent = 'Restart error: ' + error.message; }
      finally { if (!disposed) { setRunning(false); restoreFocus(restart, hadFocus); } }
    }
    async function stopEvaluation() {
      if (!evaluation || stopping) return; const hadFocus = document.activeElement === stop; stopping = true; stop.disabled = true; status.textContent = 'Stopping evaluation and rebuilding the live session…';
      evaluation.abort();
      try { await workspace.restart(); if (!disposed) { invalidatePanels(); status.textContent = 'Evaluation stopped. Session reset: live bindings and objects were cleared; accepted code and drafts were retained.'; } }
      catch (error) { if (!disposed) status.textContent = 'Session reset error: ' + error.message; }
      finally { stopping = false; if (!disposed) { setRunning(false); restoreFocus(evaluate, hadFocus); } }
    }
    async function showInspection(summary, label) {
      if (!summary || !summary.handle || disposed) return;
      onInspect();
      const section = element('section', 'smalltalk-object'); section.setAttribute('aria-label', label + ' object'); section.tabIndex = -1;
      const list = element('dl', 'smalltalk-slots'); const message = element('p', 'smalltalk-status'); message.setAttribute('role', 'status');
      const panel = { handle: summary.handle, section, list, status: message, next: null, offset: 0, stale: false, handles: new Set([summary.handle]), loading: false };
      const close = button('Close ' + label + ' inspector', () => closeInspection(panel));
      panel.next = button('Next slots for ' + label, () => loadSlots(panel)); panel.next.hidden = true;
      section.append(element('h3', '', label + ': ' + summary.className), close, message, list, panel.next); objects.hidden = false; objects.append(section); panels.add(panel);
      await loadSlots(panel);
    }
    function closeInspection(panel) {
      const ownedFocus = panel.section.contains(document.activeElement);
      panels.delete(panel); panel.section.remove(); objects.hidden = panels.size === 0;
      release([...panel.handles].filter(handle => handle !== (lastResult && lastResult.handle) && ![...panels].some(other => other.handles.has(handle))));
      if (ownedFocus) {
        const destination = [inspectResult, stop, evaluate, view].find(control => !control.disabled &&
          !control.closest('[inert]') && control.getClientRects().length && getComputedStyle(control).visibility === 'visible');
        if (destination) destination.focus();
      }
    }
    async function loadSlots(panel) {
      if (panel.stale || panel.loading || disposed) return; const generation = handleGeneration; panel.loading = true; panel.status.textContent = 'Loading slots…';
      try {
        const inspection = await workspace.inspect(panel.handle, panel.offset, 25);
        if (generation !== handleGeneration) return; // Reset destroyed the old session's roots.
        if (disposed || panel.stale || !panels.has(panel)) {
          await release(inspection.slots.map(slot => slot.value.handle).filter(Boolean), inspection.sessionId); return;
        }
        let firstAction = null;
        inspection.slots.forEach(slot => {
          retain(slot.value, inspection.sessionId); if (slot.value.handle) panel.handles.add(slot.value.handle);
          const name = element('dt', '', slot.name); const value = element('dd'); value.append(element('span', '', slot.value.text));
          if (slot.value.handle) {
            const expand = button('Expand ' + slot.name, () => showInspection(slot.value, slot.name));
            if (!firstAction) firstAction = expand;
            value.append(expand);
          }
          panel.list.append(name, value);
        });
        const ownedFocus = document.activeElement === panel.next;
        panel.offset = inspection.nextOffset; panel.next.hidden = inspection.nextOffset === null;
        if (ownedFocus && panel.next.hidden) (firstAction || panel.section).focus();
        panel.status.textContent = inspection.slots.length ? 'Loaded ' + inspection.slots.length + ' slots.' : 'This object has no slots.';
      } catch (error) { panel.status.textContent = error.code === 'STALE_HANDLE' ? 'Stale object. Evaluate again to inspect a current object.' : 'Inspection error: ' + error.message; }
      finally { panel.loading = false; }
    }
    return { dispose() {
      disposed = true; if (evaluation) evaluation.abort(); unsubscribe(); release([...handles.keys()]); panels.clear(); editor.dispose(); view.remove();
    } };
  }
  api.Inspector = { mount };
})(window);
