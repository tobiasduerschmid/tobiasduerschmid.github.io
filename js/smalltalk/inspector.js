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
  /** Bounded, text-only command records; history never owns native object handles. */
  function commandHistory(root, reuse) {
    let serial = 0, active = null;
    const empty = element('p', 'smalltalk-history-empty', 'No commands yet. Evaluate an expression to start.');
    root.append(empty);
    function begin(source) {
      root.tabIndex = 0;
      empty.hidden = true;
      const number = ++serial;
      const record = element('article', 'smalltalk-command'); record.setAttribute('aria-label', 'Command ' + number);
      const header = element('div', 'smalltalk-command-header');
      const reuseButton = button('Reuse', () => reuse(source)); reuseButton.setAttribute('aria-label', 'Reuse command ' + number);
      header.append(element('strong', '', 'Command ' + number), reuseButton);
      const output = element('pre', 'smalltalk-command-output'); output.hidden = true;
      output.setAttribute('role', 'region'); output.setAttribute('aria-label', 'Transcript for command ' + number); output.tabIndex = 0;
      const answer = element('p', 'smalltalk-command-answer', 'Evaluating…');
      record.append(header, element('pre', 'smalltalk-command-source', source), output, answer);
      root.append(record);
      if (root.querySelectorAll('article').length > 100) root.querySelector('article').remove();
      active = { record, output, answer };
      root.scrollTop = root.scrollHeight;
    }
    return {
      begin,
      output(text) {
        if (!active) return;
        const following = root.scrollHeight - root.scrollTop - root.clientHeight < 32;
        active.output.hidden = false;
        active.output.textContent = (active.output.textContent + text).slice(-32768);
        if (following) root.scrollTop = root.scrollHeight;
      },
      finish(label, text) {
        if (!active) return;
        active.record.classList.toggle('is-error', label === 'Error');
        active.answer.replaceChildren(element('strong', '', label + ': '), document.createTextNode(text));
        active = null;
      },
      clear() { root.replaceChildren(empty); root.removeAttribute('tabindex'); empty.hidden = false; active = null; },
    };
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
    evaluate.setAttribute('aria-keyshortcuts', 'Control+Enter Meta+Enter');
    const stop = button('Stop evaluation', () => stopEvaluation()); stop.disabled = true;
    const restart = button('Restart session', () => restartSession());
    const inspectResult = button('Inspect result', () => showInspection(lastResult, 'Result')); inspectResult.disabled = true;
    const newCommand = button('New command', () => { commandIndex = commands.length; pendingExpression = ''; editor.setValue(''); editor.focus(); updateHistory(); });
    toolbar.append(evaluate, element('kbd', 'smalltalk-evaluate-shortcut', 'Ctrl/Cmd + Enter'), stop, newCommand, inspectResult);
    const historyToolbar = element('div', 'smalltalk-toolbar'); historyToolbar.setAttribute('aria-label', 'Command history');
    const previous = button('Previous command', () => recall(-1)); const next = button('Next command', () => recall(1));
    const clearHistory = button('Clear history', () => {
      history.clear(); commands = []; commandIndex = 0; pendingExpression = editor.getValue(); updateHistory();
      status.textContent = 'History cleared. Live variables and objects are unchanged.';
    });
    historyToolbar.append(previous, next, clearHistory);
    const cleanupStatus = element('p'); cleanupStatus.setAttribute('role', 'status'); cleanupStatus.setAttribute('aria-label', 'Inspector cleanup status'); cleanupStatus.hidden = true;
    const retryCleanup = button('Retry inspector cleanup', () => release([...pendingCleanup.keys()])); retryCleanup.hidden = true;
    const terminalRegion = element('section'); terminalRegion.setAttribute('aria-label', 'Terminal history');
    const terminalHistory = element('div', 'smalltalk-terminal-history'); terminalHistory.setAttribute('role', 'region'); terminalHistory.setAttribute('aria-label', 'Submitted commands and native output');
    terminalRegion.append(terminalHistory);
    const resultRegion = element('section'); resultRegion.setAttribute('aria-label', 'Evaluation result');
    const result = element('pre', 'smalltalk-evaluation-result'); resultRegion.append(result);
    const resultLabel = element('strong', '', 'Result');
    const resultLine = element('div', 'smalltalk-terminal-result'); resultLine.hidden = true;
    resultLine.append(resultLabel, resultRegion);
    const errorHelp = element('p', 'smalltalk-terminal-error-help', 'If these are separate statements, put a period (.) between them; a newline is only whitespace. The final expression supplies the result.'); errorHelp.hidden = true;
    const transcriptRegion = element('section'); transcriptRegion.setAttribute('aria-label', 'Transcript');
    const transcript = element('pre', 'smalltalk-transcript'); transcript.tabIndex = 0; transcript.setAttribute('role', 'region'); transcript.setAttribute('aria-label', 'Transcript output');
    transcriptRegion.append(element('h3', '', 'Transcript'), button('Clear Transcript', () => { transcript.textContent = ''; }), transcript);
    const objects = element('section', 'smalltalk-inspected-objects'); objects.setAttribute('aria-label', 'Object inspector');
    objects.append(element('h3', '', 'Object inspector')); objects.hidden = true;
    const header = element('div', 'smalltalk-terminal-header'); header.append(heading, status);
    const help = element('details', 'smalltalk-terminal-help'); help.append(element('summary', '', 'Live session help'), description, restart);
    const inputHelp = element('p', 'smalltalk-terminal-input-help');
    inputHelp.append(element('kbd', '', 'Ctrl/Cmd + Enter'), document.createTextNode(' evaluates the input. Separate statements with periods (.); Enter adds a line.'));
    if (compact) {
      view.classList.add('smalltalk-compact-terminal');
      heading.classList.add('sr-only'); status.classList.add('sr-only');
      const details = element('details', 'smalltalk-terminal-details');
      details.append(element('summary', '', 'History and Transcript'), historyToolbar, terminalRegion, transcriptRegion);
      details.addEventListener('toggle', () => { if (details.open) terminalHistory.scrollTop = terminalHistory.scrollHeight; });
      help.append(inputHelp);
      const utilities = element('div', 'smalltalk-terminal-utilities'); utilities.append(details, help);
      view.append(header, expressionRegion, toolbar, resultLine, errorHelp, utilities, cleanupStatus, retryCleanup, objects);
    } else {
      toolbar.append(restart);
      view.append(header, help, inputHelp, expressionRegion, toolbar, resultLine, errorHelp, historyToolbar, cleanupStatus, retryCleanup, terminalRegion, transcriptRegion, objects);
    }
    const editor = createEditor({ element: editorHost, value: '', language: 'smalltalk', ariaLabel: 'Smalltalk expression', onChange() {} });
    const handles = new Map(); const pendingCleanup = new Map(); const panels = new Set(); let commands = [], commandIndex = 0, pendingExpression = '', handleGeneration = 0;
    let lastResult = null, evaluation = null, disposed = false, stopping = false;
    const history = commandHistory(terminalHistory, source => {
      if (commandIndex === commands.length) pendingExpression = editor.getValue();
      commandIndex = commands.lastIndexOf(source);
      editor.setValue(source); editor.focus(); updateHistory();
    });
    // Capture before Monaco's newline command; no page-wide keyboard interception.
    editorHost.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) return;
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat && !evaluate.disabled) evaluateExpression();
    }, true);
    const unsubscribe = workspace.subscribe(event => {
      if (event.type !== 'runtime') return;
      const detail = event.detail;
      if (detail.type === 'output') appendTranscript(detail.payload.text);
      if (detail.type === 'recovered') {
        invalidatePanels();
        if (detail.stateRewound) showSessionStatus('Session restored; inspector handles are stale. Evaluate again to inspect live objects.');
        else status.textContent = 'Session ready.';
      }
    });
    updateHistory();
    function appendTranscript(text) { transcript.textContent = (transcript.textContent + text).slice(-32768); history.output(text); }
    function updateHistory() { previous.disabled = !commands.length || commandIndex <= 0; next.disabled = commandIndex >= commands.length; }
    function recall(direction) {
      if (commandIndex === commands.length) pendingExpression = editor.getValue();
      commandIndex += direction; editor.setValue(commandIndex === commands.length ? pendingExpression : commands[commandIndex]); editor.focus(); updateHistory();
    }
    function restoreFocus(control, hadFocus) {
      if (hadFocus && [document.body, document.documentElement].includes(document.activeElement)) control.focus();
    }
    function setRunning(running) { evaluate.disabled = running; stop.disabled = !running; restart.disabled = running; clearHistory.disabled = running; }
    function retain(summary, sessionId) { if (summary && summary.handle) handles.set(summary.handle, sessionId); }
    function releaseUnowned(list, sessionId) {
      return release(list.filter(handle => handle !== (lastResult && lastResult.handle) &&
        ![...panels].some(panel => panel.handles.has(handle))), sessionId);
    }
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
      const source = editor.getValue(); if (!source.trim()) { showSessionStatus('Enter a Smalltalk expression to evaluate.'); editor.focus(); return; }
      if (commands[commands.length - 1] !== source) commands.push(source);
      if (commands.length > 100) commands.shift(); commandIndex = commands.length; pendingExpression = ''; updateHistory();
      history.begin(source); resultLabel.textContent = 'Running'; result.textContent = 'Evaluating in the live image…';
      resultLine.hidden = false; resultRegion.classList.remove('is-error'); errorHelp.hidden = true;
      evaluation = new AbortController(); setRunning(true); status.textContent = 'Evaluating in the live image…';
      const oldHandle = lastResult && lastResult.handle; lastResult = null; inspectResult.disabled = true;
      if (oldHandle) releaseUnowned([oldHandle]);
      try {
        const response = await workspace.evaluate(source, { signal: evaluation.signal });
        if (disposed || stopping) return;
        if (response.error) showError(response.error, source);
        else {
          lastResult = response.value; retain(lastResult); result.textContent = lastResult ? lastResult.text : '';
          resultLabel.textContent = 'Result'; resultLine.hidden = false; history.finish('Result', result.textContent);
          inspectResult.disabled = !lastResult || !lastResult.handle;
          status.textContent = 'Result: ' + result.textContent.slice(0, 500) + '. Live variables and objects are retained.';
        }
      } catch (error) { if (!disposed && !stopping) showError(error, source); }
      finally { evaluation = null; if (!disposed && !stopping) { setRunning(false); restoreFocus(evaluate, hadFocus); } }
    }
    function showError(error, source) {
      history.finish('Error', error.message); result.textContent = error.message; resultLabel.textContent = 'Error'; resultLine.hidden = false;
      resultRegion.classList.add('is-error'); errorHelp.hidden = !/[\r\n]/.test(source);
      status.textContent = 'Evaluation error: ' + error.message.slice(0, 500);
      if (compact) onInspect();
    }
    function showSessionStatus(message) {
      status.textContent = message; resultLabel.textContent = 'Session'; result.textContent = message;
      resultLine.hidden = false; resultRegion.classList.remove('is-error'); errorHelp.hidden = true;
    }
    function invalidatePanels() {
      handleGeneration++; lastResult = null; inspectResult.disabled = true; handles.clear(); pendingCleanup.clear(); cleanupStatus.hidden = true; retryCleanup.hidden = true;
      for (const panel of panels) markStale(panel, 'Stale object: the live session was restored or restarted. Evaluate again to obtain a current object.');
    }
    function markStale(panel, message) {
      panel.stale = true; panel.status.textContent = message;
      panel.refresh.disabled = true; panel.next.disabled = true;
      panel.list.querySelectorAll('button').forEach(control => { control.disabled = true; });
    }
    async function restartSession() {
      const hadFocus = document.activeElement === restart;
      evaluate.disabled = true; restart.disabled = true;
      status.textContent = 'Restarting the live session…';
      try { await workspace.restart(); if (!disposed) { invalidatePanels(); showSessionStatus('Session restarted. Live bindings and objects were cleared; accepted code and drafts were retained.'); } }
      catch (error) { if (!disposed) showSessionStatus('Restart error: ' + error.message); }
      finally { if (!disposed) { setRunning(false); restoreFocus(restart, hadFocus); } }
    }
    async function stopEvaluation() {
      if (!evaluation || stopping) return; const hadFocus = document.activeElement === stop; stopping = true; stop.disabled = true; status.textContent = 'Stopping evaluation and rebuilding the live session…';
      evaluation.abort(); history.finish('Stopped', 'Evaluation cancelled; the live session is being reset.');
      try { await workspace.restart(); if (!disposed) { invalidatePanels(); resultLabel.textContent = 'Stopped'; result.textContent = 'Live session reset.'; status.textContent = 'Evaluation stopped. Session reset: live bindings and objects were cleared; accepted code and drafts were retained.'; } }
      catch (error) { if (!disposed) showSessionStatus('Session reset error: ' + error.message); }
      finally { stopping = false; if (!disposed) { setRunning(false); restoreFocus(evaluate, hadFocus); } }
    }
    async function showInspection(summary, label) {
      if (!summary || !summary.handle || disposed) return;
      onInspect();
      const section = element('section', 'smalltalk-object'); section.setAttribute('aria-label', label + ' object'); section.tabIndex = -1;
      const list = element('dl', 'smalltalk-slots'); const message = element('p', 'smalltalk-status'); message.setAttribute('role', 'status');
      message.setAttribute('aria-label', label + ' inspection status');
      const panel = { handle: summary.handle, section, list, status: message, next: null, refresh: null, offset: 0, stale: false, handles: new Set([summary.handle]), loading: false };
      const close = button('Close ' + label + ' inspector', () => closeInspection(panel));
      panel.refresh = button('Refresh', () => loadSlots(panel, { replace: true }));
      panel.refresh.setAttribute('aria-label', 'Refresh ' + label + ' object');
      panel.next = button('Next slots for ' + label, () => loadSlots(panel)); panel.next.hidden = true;
      const actions = element('div', 'smalltalk-toolbar'); actions.append(panel.refresh, close);
      section.append(element('h3', '', label + ': ' + summary.className), actions, message, list, panel.next); objects.hidden = false; objects.append(section); panels.add(panel);
      await loadSlots(panel);
    }
    function closeInspection(panel) {
      const ownedFocus = panel.section.contains(document.activeElement);
      panels.delete(panel); panel.section.remove(); objects.hidden = panels.size === 0;
      releaseUnowned([...panel.handles]);
      if (ownedFocus) {
        const destination = [inspectResult, stop, evaluate, view].find(control => !control.disabled &&
          !control.closest('[inert]') && control.getClientRects().length && getComputedStyle(control).visibility === 'visible');
        if (destination) destination.focus();
      }
    }
    function appendSlots(panel, inspection) {
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
      return firstAction;
    }
    async function loadSlots(panel, { replace = false } = {}) {
      if (panel.stale || panel.loading || disposed || !panels.has(panel)) return;
      const generation = handleGeneration;
      const refreshHadFocus = document.activeElement === panel.refresh, nextHadFocus = document.activeElement === panel.next;
      panel.loading = true; panel.refresh.disabled = true; panel.next.disabled = true;
      panel.status.textContent = replace ? 'Refreshing the same live object…' : 'Loading slots…';
      try {
        const inspection = await workspace.inspect(panel.handle, replace ? 0 : panel.offset, 25);
        if (generation !== handleGeneration) return; // Reset destroyed the old session's roots.
        if (disposed || panel.stale || !panels.has(panel)) {
          await releaseUnowned(inspection.slots.map(slot => slot.value.handle).filter(Boolean), inspection.sessionId); return;
        }
        const previousHandles = replace ? [...panel.handles] : [];
        if (replace) { panel.handles = new Set([panel.handle]); panel.list.replaceChildren(); }
        const firstAction = appendSlots(panel, inspection);
        panel.offset = inspection.nextOffset; panel.next.hidden = inspection.nextOffset === null;
        if (nextHadFocus && panel.next.hidden) restoreFocus(firstAction || panel.section, true);
        panel.status.textContent = (replace ? 'Refreshed the same live object. ' : '') +
          (inspection.slots.length ? 'Loaded ' + inspection.slots.length + ' slots.' : 'This object has no slots.');
        await releaseUnowned(previousHandles);
      } catch (error) {
        if (disposed || !panels.has(panel) || generation !== handleGeneration) return;
        if (error.code === 'STALE_HANDLE') markStale(panel, 'Stale object. Evaluate again to inspect a current object.');
        else panel.status.textContent = 'Inspection error: ' + error.message + '. Refresh to try again.';
      } finally {
        panel.loading = false;
        if (!disposed && panels.has(panel)) {
          panel.refresh.disabled = panel.stale; panel.next.disabled = panel.stale;
          if (!panel.stale) { restoreFocus(panel.refresh, refreshHadFocus); restoreFocus(panel.next, nextHadFocus && !panel.next.hidden); }
        }
      }
    }
    return { dispose() {
      disposed = true; if (evaluation) evaluation.abort(); unsubscribe(); release([...handles.keys()]); panels.clear(); editor.dispose(); view.remove();
    } };
  }
  api.Inspector = { mount };
})(window);
