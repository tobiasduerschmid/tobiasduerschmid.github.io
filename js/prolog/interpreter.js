/* Prolog query interaction. The tutorial host owns the worker and exclusive
 * execution transaction; this component owns the page-session transcript. */
(function () {
  'use strict';

  class PrologInterpreter {
    constructor(host) {
      this.host = host;
      this.history = [];
      this.historyIndex = 0;
      this.draft = '';
      this.busy = false;
      this.events = new AbortController();
      this.createView();
      this.bindEvents();
    }

    createView() {
      const panel = this.host.root.querySelector('.tvm-output-panel');
      this.output = panel.querySelector('.tvm-output-container');
      const views = document.createElement('div');
      views.className = 'prolog-interpreter-views';
      views.setAttribute('role', 'group');
      views.setAttribute('aria-label', 'Prolog runtime view');
      views.innerHTML = '<button type="button" aria-pressed="true">Output</button>' +
        '<button type="button" aria-pressed="false">Terminal</button>';
      panel.querySelector('.tvm-output-header').after(views);
      [this.outputButton, this.interpreterButton] = views.children;
      this.detachedOutput = document.createElement('div');
      this.detachedOutput.className = 'prolog-interpreter-detached-output';
      this.detachedOutput.hidden = true;
      this.detachedOutput.innerHTML = '<p>Output is open in a separate window. You can keep using Terminal here.</p>' +
        '<button type="button">Reattach Output</button>';
      panel.append(this.detachedOutput);
      this.section = document.createElement('section');
      this.section.className = 'prolog-interpreter';
      this.section.setAttribute('aria-label', 'Prolog terminal');
      this.section.hidden = true;
      this.section.innerHTML =
        '<div class="prolog-interpreter-toolbar"><span>Tau Prolog</span>' +
        '<button type="button" data-action="stop" disabled>Stop evaluation</button>' +
        '<button type="button" data-action="previous" aria-label="Previous query" disabled>↑ Previous</button>' +
        '<button type="button" data-action="next" aria-label="Next query" disabled>Next ↓</button>' +
        '<button type="button" data-action="clear">Clear transcript</button></div>' +
        '<details class="prolog-interpreter-help"><summary>Examples and commands</summary>' +
        '<ul><li>Try <code>X is 6 * 7</code> or query a relation from your file. Enter the goal without <code>?-</code>; the final period is optional.</li>' +
        '<li>Each query consults the open Prolog file, including unsaved edits. All solutions are shown automatically, up to the answer limit; no semicolons are needed.</li>' +
        '<li>Facts and bindings created by a query do not carry into the next query. Add reusable facts and rules to the editor.</li>' +
        '<li>Use ↑/↓ for history, Ctrl+L to clear, and Ctrl+C to interrupt. Tab moves out of the prompt.</li>' +
        '<li>Run and Debug use the lesson’s default query. Terminal queries do not change it.</li></ul></details>' +
        '<div class="prolog-interpreter-terminal" role="group" aria-label="Prolog terminal">' +
        '<p class="prolog-interpreter-intro">Enter a query at <code>?-</code>. Press Enter to evaluate.</p>' +
        '<div class="prolog-interpreter-log" role="log" aria-label="Prolog terminal transcript" aria-live="polite" aria-relevant="additions" tabindex="0"></div>' +
        '<form class="prolog-interpreter-form">' +
        '<label class="prolog-interpreter-prompt"><span class="sr-only">Prolog query</span>' +
        '<span class="prolog-interpreter-prompt-marker" aria-hidden="true">?-</span>' +
        '<input type="text" name="query" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>' +
        '<button type="submit" aria-label="Evaluate query">↵</button></form></div>';
      panel.append(this.section);
      this.input = this.section.querySelector('input');
      this.log = this.section.querySelector('[role="log"]');
      this.terminal = this.section.querySelector('.prolog-interpreter-terminal');
      this.promptMarker = this.section.querySelector('.prolog-interpreter-prompt-marker');
      this.submit = this.section.querySelector('[type="submit"]');
      this.stop = this.section.querySelector('[data-action="stop"]');
      this.previous = this.section.querySelector('[data-action="previous"]');
      this.next = this.section.querySelector('[data-action="next"]');
    }

    bindEvents() {
      const listen = (element, event, handler) => element.addEventListener(event, handler, { signal: this.events.signal });
      listen(this.outputButton, 'click', () => this.showOutput());
      listen(this.interpreterButton, 'click', () => { this.showInterpreter(); this.input.focus(); });
      listen(this.detachedOutput.querySelector('button'), 'click', () => this.host._popoutManager.requestPopupClose('output'));
      listen(this.section.querySelector('form'), 'submit', event => {
        event.preventDefault();
        void this.evaluate();
      });
      listen(this.stop, 'click', () => this.interrupt());
      listen(this.section.querySelector('[data-action="clear"]'), 'click', () => this.clear());
      listen(this.previous, 'click', () => this.recall(-1));
      listen(this.next, 'click', () => this.recall(1));
      listen(this.input, 'keydown', event => this.onKeyDown(event));
      listen(this.terminal, 'click', event => {
        if ((event.target === this.terminal || event.target === this.log) && window.getSelection().isCollapsed) this.input.focus();
      });
    }

    onKeyDown(event) {
      if (event.isComposing || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.ctrlKey) {
        if (event.key.toLowerCase() === 'l') {
          event.preventDefault();
          this.clear();
        } else if (event.key.toLowerCase() === 'c' && this.input.selectionStart === this.input.selectionEnd) {
          event.preventDefault();
          if (this.busy) this.interrupt();
          else {
            this.append('?- ' + this.input.value + '^C');
            this.input.value = '';
            this.draft = '';
            this.historyIndex = this.history.length;
            this.updateHistoryButtons();
          }
        }
      } else if (!this.busy && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        this.recall(event.key === 'ArrowUp' ? -1 : 1);
      }
    }

    showOutput() {
      const moveFocus = this.section.contains(document.activeElement);
      this.output.hidden = !!this.outputDetached;
      this.detachedOutput.hidden = !this.outputDetached;
      this.section.hidden = true;
      this.outputButton.setAttribute('aria-pressed', 'true');
      this.interpreterButton.setAttribute('aria-pressed', 'false');
      if (moveFocus) this.outputButton.focus();
    }

    showInterpreter() {
      this.output.hidden = true;
      this.detachedOutput.hidden = true;
      this.section.hidden = false;
      this.outputButton.setAttribute('aria-pressed', 'false');
      this.interpreterButton.setAttribute('aria-pressed', 'true');
    }

    setOutputDetached(detached) {
      const moveFocus = !detached && this.detachedOutput.contains(document.activeElement);
      this.outputDetached = detached;
      if (this.section.hidden) this.showOutput();
      if (moveFocus) this.outputButton.focus();
    }

    clear() {
      this.log.replaceChildren();
      this.activeEntry = null;
      this.input.focus();
    }

    append(text) {
      // Keep each query together so a 100-answer query cannot evict its own
      // prompt or first answer. Clearing mid-query starts a new visible entry.
      if (!this.activeEntry || !this.log.contains(this.activeEntry)) {
        this.activeEntry = document.createElement('div');
        this.log.append(this.activeEntry);
        while (this.log.children.length > 100) this.log.firstElementChild.remove();
      }
      const line = document.createElement('pre');
      line.textContent = text.trimEnd();
      this.activeEntry.append(line);
      this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    recall(direction) {
      if (this.busy) return;
      if (this.historyIndex === this.history.length) this.draft = this.input.value;
      this.historyIndex = Math.max(0, Math.min(this.history.length, this.historyIndex + direction));
      this.input.value = this.historyIndex === this.history.length ? this.draft : this.history[this.historyIndex];
      this.updateHistoryButtons();
      this.input.focus();
    }

    updateHistoryButtons() {
      this.previous.disabled = this.busy || this.historyIndex === 0;
      this.next.disabled = this.busy || this.historyIndex === this.history.length;
    }

    setBusy(busy) {
      this.busy = busy;
      this.input.readOnly = busy;
      this.promptMarker.textContent = busy ? '…' : '?-';
      this.submit.disabled = busy;
      this.stop.disabled = !busy;
      this.updateHistoryButtons();
    }

    publishOutputControls() {
      if (this.host._popoutManager) {
        this.host._popoutManager.broadcastOutputControlsState(this.host._collectOutputControlsState());
      }
    }

    interrupt() {
      if (!this.busy || this.stop.disabled) return;
      this.restoreInputFocus = this.section.contains(document.activeElement);
      this.stop.disabled = true;
      this.append('^C');
      // The pending query observes termination and awaits this recovery.
      this.host._restartWorkerBackend('Evaluation stopped by the learner').catch(() => {});
    }

    async stopForWorkspaceChange() {
      this.interrupt();
      await this.execution;
    }

    async runQuery(filename, query, stepRequest) {
      const host = this.host;
      try {
        await host._syncFileToBackend(filename);
        if (host._latestStepLoadRequestId !== stepRequest) {
          this.append('The tutorial step changed. Enter the query again to use the current step.');
          return false;
        }
        const result = await host._runWorkerExecution({ type: 'run', path: '/tutorial/' + filename, query }, 'Evaluating…');
        if (result.error) this.append(result.error);
        return result.exitCode === 0;
      } catch (error) {
        if (error.reason === 'timeout') this.append('Evaluation timed out. Restarting the Prolog interpreter.');
        else if (error.reason === 'terminated') this.append('Evaluation stopped.');
        else this.append('Evaluation failed: ' + error.message);
        if (host._workerRestartPromise) {
          try { await host._workerRestartPromise; }
          catch (restartError) { this.append('Could not restart Prolog: ' + restartError.message); }
        }
        return false;
      }
    }

    async evaluate() {
      const host = this.host;
      const query = this.input.value.trim();
      if (!query || this.busy) return;
      if (!host.booted || host._workerRestartPromise || host._activeStepLoadRequest) {
        this.append('The Prolog runtime is loading. Try again when it is ready.');
        return;
      }
      if (host._activeRunTransaction || host._testRunInFlight || (host._debuggerCtl && host._debuggerCtl.session)) {
        this.append('Finish or stop the current run, tests, or debugging session before evaluating a query.');
        return;
      }
      const filename = host.activeFileName;
      if (!filename || !/\.pl$/i.test(filename)) {
        this.append('Open a Prolog (.pl) file in the editor first.');
        return;
      }
      const returnToPrompt = document.activeElement === this.input || document.activeElement === this.submit;
      this.activeEntry = null;
      this.append(filename + ' ?- ' + query);
      if (this.history[this.history.length - 1] !== query) this.history.push(query);
      if (this.history.length > 100) this.history.shift();
      this.historyIndex = this.history.length;
      this.draft = '';
      this.input.value = '';
      const run = { kind: 'interpreter', backend: 'prolog', onOutput: text => this.append(text) };
      const stepRequest = host._latestStepLoadRequestId;
      this.setBusy(true);
      this.execution = host._startExecutionTransaction(run, () => this.runQuery(filename, query, stepRequest), 'Evaluating…');
      this.publishOutputControls();
      await this.execution;
      const restoreFocus = this.restoreInputFocus || document.activeElement === this.stop;
      this.restoreInputFocus = false;
      this.setBusy(false);
      this.publishOutputControls();
      this.activeEntry = null;
      if (!host._destroyed && !this.section.hidden && (restoreFocus || (returnToPrompt &&
          (document.activeElement === document.body || document.activeElement === this.input)))) this.input.focus();
      this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    dispose() { this.events.abort(); }
  }

  window.SEBookPrologInterpreter = PrologInterpreter;
})();
