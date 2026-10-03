/* A terminal-style expression prompt for the tutorial's MicroHs runtime.
 * The host owns workspace synchronization, execution serialization and restart;
 * this component owns the transcript and in-memory command history. */
(function () {
  'use strict';

  // A tuple argument is valid Haskell, so suggest a curried call only after
  // an error, without assuming the learner's function actually expects it.
  function tupleApplicationHint(expression) {
    let tokens;
    try {
      tokens = window.SEBookHaskellSyntax.tokenize(expression);
    } catch (error) {
      if (error instanceof window.SEBookHaskellSyntax.UnsupportedSyntax) return '';
      throw error;
    }
    if (!tokens.length || !/^[A-Za-z_][\w'.]*$/.test(tokens[0].text) ||
        tokens[1]?.text !== '(' || tokens.at(-1).text !== ')' ||
        tokens.slice(2, -1).some(token => token.depth < 1)) return '';
    const commas = tokens.filter(token => token.text === ',' && token.depth === 1);
    if (!commas.length) return '';
    const boundaries = [tokens[1], ...commas, tokens.at(-1)];
    const args = boundaries.slice(0, -1).map((token, index) =>
      expression.slice(token.offset + 1, boundaries[index + 1].offset).trim());
    if (args.some(arg => !arg)) return '';
    const separateArgs = args.map(arg => /^[A-Za-z_][\w'.]*$|^\d+(?:\.\d+)?$/.test(arg) ? arg : '(' + arg + ')');
    const name = tokens[0].text;
    return '(' + args.join(', ') + ') is one tuple argument. ' +
      'If you meant to pass ' + args.length + ' separate arguments, write: ' +
      name + ' ' + separateArgs.join(' ') + '.\n' +
      'Haskell uses spaces between function arguments. Check the expected inputs with :type ' + name + '.';
  }

  function diagnosticHint(expression, diagnostic) {
    const hints = [];
    if (/\bShow\b/.test(diagnostic) && /->/.test(diagnostic)) {
      hints.push('The result still contains a function, which the interpreter cannot print. ' +
        'A function call may need more arguments; use :type to inspect its type.');
    }
    if (/type|constraint|unify/i.test(diagnostic)) {
      const tupleHint = tupleApplicationHint(expression);
      if (tupleHint) hints.push(tupleHint);
    }
    return hints.join('\n\n');
  }

  class HaskellInterpreter {
    constructor(host) {
      this.host = host;
      this.history = [];
      this.historyIndex = 0;
      this.draft = '';
      this.busy = false;
      this.events = new AbortController();
      const panel = host.root.querySelector('.tvm-output-panel');
      this.output = panel.querySelector('.tvm-output-container');
      const views = document.createElement('div');
      views.className = 'haskell-interpreter-views';
      views.setAttribute('role', 'group');
      views.setAttribute('aria-label', 'Haskell runtime view');
      views.innerHTML = '<button type="button" aria-pressed="true">Output</button>' +
        '<button type="button" aria-pressed="false">Terminal</button>';
      panel.querySelector('.tvm-output-header').after(views);
      [this.outputButton, this.interpreterButton] = views.children;
      this.section = document.createElement('section');
      this.section.className = 'haskell-interpreter';
      this.section.setAttribute('aria-label', 'Haskell terminal');
      this.section.hidden = true;
      this.section.innerHTML =
        '<div class="haskell-interpreter-toolbar"><span>MicroHs</span>' +
        '<button type="button" data-action="stop" disabled>Stop evaluation</button>' +
        '<button type="button" data-action="previous" aria-label="Previous command" disabled>↑ Previous</button>' +
        '<button type="button" data-action="next" aria-label="Next command" disabled>Next ↓</button>' +
        '<button type="button" data-action="clear">Clear transcript</button></div>' +
        '<details class="haskell-interpreter-help"><summary>Examples and commands</summary>' +
        '<ul><li>Try <code>2 + 3</code>, <code>take 5 [1..]</code>, or call a function from your file.</li>' +
        '<li>Use ↑/↓ for history, Ctrl+L to clear, and Ctrl+C to interrupt. Tab moves out of the prompt.</li>' +
        '<li>Inspect a type with <code>:type map</code> or <code>:t map</code>.</li>' +
        '<li>Use <code>let x = 3 in x * x</code> for local names. Add reusable definitions to the editor.</li>' +
        '<li>Each command reloads the active Haskell file, including unsaved edits. Definitions do not carry between commands.</li>' +
        '<li>This browser interpreter uses MicroHs. For GHCi locally, install GHC, save your file on your computer, and run <code>ghci Main.hs</code> in your terminal. Use <code>:reload</code> after editing. <a href="https://downloads.haskell.org/ghc/latest/docs/users_guide/ghci.html">GHCi guide</a>.</li></ul></details>' +
        '<div class="haskell-interpreter-terminal" role="group" aria-label="Haskell terminal">' +
        '<p class="haskell-interpreter-intro">Enter an expression or <code>:type map</code>. Press Enter to evaluate.</p>' +
        '<div class="haskell-interpreter-log" role="log" aria-label="Haskell terminal transcript" aria-live="polite" aria-relevant="additions" tabindex="0"></div>' +
        '<form class="haskell-interpreter-form">' +
        '<label class="haskell-interpreter-prompt"><span class="sr-only">Haskell expression</span>' +
        '<span class="haskell-interpreter-prompt-marker" aria-hidden="true">λ&gt;</span>' +
        '<input type="text" name="expression" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>' +
        '<button type="submit" aria-label="Evaluate" title="Evaluate expression">↵</button></form></div>';
      panel.append(this.section);
      this.input = this.section.querySelector('input');
      this.log = this.section.querySelector('[role="log"]');
      this.terminal = this.section.querySelector('.haskell-interpreter-terminal');
      this.promptMarker = this.section.querySelector('.haskell-interpreter-prompt-marker');
      this.submit = this.section.querySelector('[type="submit"]');
      this.stop = this.section.querySelector('[data-action="stop"]');
      this.previous = this.section.querySelector('[data-action="previous"]');
      this.next = this.section.querySelector('[data-action="next"]');
      const listen = (element, event, handler) => element.addEventListener(event, handler, { signal: this.events.signal });
      listen(this.outputButton, 'click', () => this.showOutput());
      listen(this.interpreterButton, 'click', () => { this.showInterpreter(); this.input.focus(); });
      listen(this.section.querySelector('form'), 'submit', event => {
        event.preventDefault();
        void this.evaluate();
      });
      listen(this.stop, 'click', () => this.interrupt());
      listen(this.section.querySelector('[data-action="clear"]'), 'click', () => this.clear());
      listen(this.terminal, 'click', event => {
        if ((event.target === this.terminal || event.target === this.log) && window.getSelection().isCollapsed) {
          this.input.focus();
        }
      });
      listen(this.previous, 'click', () => this.recall(-1));
      listen(this.next, 'click', () => this.recall(1));
      listen(this.input, 'keydown', event => {
        if (event.isComposing || event.altKey || event.metaKey || event.shiftKey) return;
        if (event.ctrlKey) {
          if (event.key.toLowerCase() === 'l') {
            event.preventDefault();
            this.clear();
          } else if (event.key.toLowerCase() === 'c' && this.input.selectionStart === this.input.selectionEnd) {
            event.preventDefault();
            if (this.busy) this.interrupt();
            else {
              this.append('λ> ' + this.input.value + '^C');
              this.input.value = '';
              this.historyIndex = this.history.length;
              this.draft = '';
              this.updateHistoryButtons();
            }
          }
          return;
        }
        if (this.busy) return;
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          this.recall(event.key === 'ArrowUp' ? -1 : 1);
        }
      });
    }

    clear() {
      this.log.replaceChildren();
      this.input.focus();
    }

    interrupt() {
      if (!this.busy || this.stop.disabled) return;
      this.restoreInputFocus = document.activeElement === this.stop || document.activeElement === this.input;
      this.stop.disabled = true;
      this.append('^C');
      // The host reports restart failures and rejects the pending evaluation.
      this.host._restartHaskellExecutor().catch(() => {});
    }

    showOutput() {
      const moveFocus = this.section.contains(document.activeElement);
      this.output.hidden = false;
      this.section.hidden = true;
      this.outputButton.setAttribute('aria-pressed', 'true');
      this.interpreterButton.setAttribute('aria-pressed', 'false');
      if (moveFocus) this.outputButton.focus();
    }

    showInterpreter() {
      this.output.hidden = true;
      this.section.hidden = false;
      this.outputButton.setAttribute('aria-pressed', 'false');
      this.interpreterButton.setAttribute('aria-pressed', 'true');
    }

    append(text) {
      const entry = document.createElement('pre');
      entry.textContent = text;
      this.log.append(entry);
      // Bound the transcript and command history to this page session.
      while (this.log.children.length > 100) this.log.firstElementChild.remove();
      this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    appendResult(expression, result) {
      const diagnostic = (result.stderr || '') + (result.error || '');
      const hint = result.exitCode !== 0 ? diagnosticHint(expression, diagnostic) : '';
      if (!hint) {
        const output = (result.stdout || '') + diagnostic;
        this.append(output.trimEnd() || (result.exitCode === 0 ? 'Completed (no output).' : 'Expression could not be evaluated.'));
        return;
      }
      if (result.stdout) this.append(result.stdout.trimEnd());
      this.append(hint);
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Compiler details';
      const original = document.createElement('pre');
      original.textContent = diagnostic.trimEnd();
      details.append(summary, original);
      this.log.append(details);
      this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    recall(direction) {
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

    async evaluate() {
      const host = this.host;
      const expression = this.input.value.trim();
      if (!expression || this.busy) return;
      if (!host.booted || host._haskellRestartPromise || host._activeStepLoadRequest) {
        this.append('The Haskell runtime is loading. Try again when it is ready.');
        return;
      }
      if (host._activeRunTransaction || host._testRunInFlight || (host._debuggerCtl && host._debuggerCtl.session)) {
        this.append('Finish or stop the current run, tests, or debugging session before evaluating an expression.');
        return;
      }
      const filename = host.activeFileName;
      const stepIndex = host.currentStep;
      const stepRequest = host._latestStepLoadRequestId;
      if (!filename || !/\.hs$/i.test(filename)) {
        this.append('Open a Haskell (.hs) file in the editor first.');
        return;
      }
      this.append(filename + ' λ> ' + expression);
      const returnToPrompt = document.activeElement === this.input || document.activeElement === this.submit;
      if (this.history[this.history.length - 1] !== expression) this.history.push(expression);
      if (this.history.length > 100) this.history.shift();
      this.historyIndex = this.history.length;
      this.draft = '';
      this.input.value = '';
      this.updateHistoryButtons();
      this.busy = true;
      this.updateHistoryButtons();
      this.input.readOnly = true;
      this.promptMarker.textContent = '…';
      this.submit.disabled = true;
      this.stop.disabled = false;
      const run = { kind: 'interpreter', backend: 'haskell', promise: null };
      await host._startExecutionTransaction(run, async () => {
        try {
          await host._syncFilesToBackend(Object.keys(host.editorModels));
          if (host.currentStep !== stepIndex || host._latestStepLoadRequestId !== stepRequest) {
            this.append('The tutorial step changed. Enter the expression again to use the current step.');
            return false;
          }
          const result = await host._requestWorker({
            type: 'evaluate', path: '/tutorial/' + filename, expression, silent: true,
          }, { timeoutMs: host._haskellExecutionTimeoutMs });
          this.appendResult(expression, result);
          return result.exitCode === 0;
        } catch (error) {
          if (error.reason === 'timeout') {
            this.append('Evaluation timed out. Restarting the Haskell interpreter.');
            await host._restartHaskellExecutor();
          } else if (error.reason === 'terminated') {
            this.append('Evaluation stopped. Restarting the Haskell interpreter.');
            await host._haskellRestartPromise;
          } else {
            this.append('Evaluation failed: ' + error.message);
          }
          return false;
        }
      }, 'Evaluating…');
      this.busy = false;
      this.updateHistoryButtons();
      this.input.readOnly = false;
      this.promptMarker.textContent = 'λ>';
      this.submit.disabled = false;
      const restoreFocus = this.restoreInputFocus || document.activeElement === this.stop;
      this.restoreInputFocus = false;
      this.stop.disabled = true;
      if (!this.section.hidden && (restoreFocus || (returnToPrompt &&
          (document.activeElement === document.body || document.activeElement === this.input)))) this.input.focus();
      this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    dispose() { this.events.abort(); }
  }

  window.SEBookHaskellInterpreter = HaskellInterpreter;
})();
