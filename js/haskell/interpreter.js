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
        '<button type="button" aria-pressed="false">Interpreter</button>';
      panel.querySelector('.tvm-output-header').after(views);
      [this.outputButton, this.interpreterButton] = views.children;
      this.section = document.createElement('section');
      this.section.className = 'haskell-interpreter';
      this.section.setAttribute('aria-label', 'Haskell interpreter');
      this.section.hidden = true;
      this.section.innerHTML =
        '<p class="haskell-interpreter-intro"><strong>Haskell interpreter · MicroHs</strong> ' +
        'Evaluate expressions using your current editor code.</p>' +
        '<details class="haskell-interpreter-help"><summary>Examples and commands</summary>' +
        '<ul><li>Try <code>2 + 3</code>, <code>take 5 [1..]</code>, or call a function from your file.</li>' +
        '<li>Inspect a type with <code>:type map</code> or <code>:t map</code>.</li>' +
        '<li>Use <code>let x = 3 in x * x</code> for local names. Add reusable definitions to the editor.</li>' +
        '<li>Each command reloads the active Haskell file, including unsaved edits. Definitions do not carry between commands.</li>' +
        '<li>This browser interpreter uses MicroHs. For GHCi locally, install GHC, save your file on your computer, and run <code>ghci Main.hs</code> in your terminal. Use <code>:reload</code> after editing. <a href="https://downloads.haskell.org/ghc/latest/docs/users_guide/ghci.html">GHCi guide</a>.</li></ul></details>' +
        '<div class="haskell-interpreter-log" role="log" aria-label="Haskell interpreter transcript" aria-live="polite" aria-relevant="additions" tabindex="0"></div>' +
        '<form class="haskell-interpreter-form">' +
        '<label>Haskell expression<span class="haskell-interpreter-prompt"><span aria-hidden="true">λ&gt;</span>' +
        '<input type="text" name="expression" autocomplete="off" spellcheck="false" placeholder="e.g. take 5 [1..]" required></span></label>' +
        '<div class="haskell-interpreter-actions"><button type="submit">Evaluate</button>' +
        '<button type="button" data-action="stop" disabled>Stop evaluation</button>' +
        '<button type="button" data-action="previous" aria-label="Previous command" disabled>↑ Previous</button>' +
        '<button type="button" data-action="next" aria-label="Next command" disabled>Next ↓</button>' +
        '<button type="button" data-action="clear">Clear transcript</button></div></form>';
      panel.append(this.section);
      this.input = this.section.querySelector('input');
      this.log = this.section.querySelector('[role="log"]');
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
      listen(this.stop, 'click', () => {
        this.restoreInputFocus = document.activeElement === this.stop;
        this.stop.disabled = true;
        // Terminating the executor also rejects the pending evaluation. Its
        // completion waits for this restart before accepting another command.
        host._restartHaskellExecutor().catch(() => {});
      });
      listen(this.section.querySelector('[data-action="clear"]'), 'click', () => this.log.replaceChildren());
      listen(this.previous, 'click', () => this.recall(-1));
      listen(this.next, 'click', () => this.recall(1));
      listen(this.input, 'keydown', event => {
        if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          this.recall(event.key === 'ArrowUp' ? -1 : 1);
        }
      });
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
      this.log.scrollTop = this.log.scrollHeight;
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
      this.log.scrollTop = this.log.scrollHeight;
    }

    recall(direction) {
      if (this.historyIndex === this.history.length) this.draft = this.input.value;
      this.historyIndex = Math.max(0, Math.min(this.history.length, this.historyIndex + direction));
      this.input.value = this.historyIndex === this.history.length ? this.draft : this.history[this.historyIndex];
      this.updateHistoryButtons();
      this.input.focus();
    }

    updateHistoryButtons() {
      this.previous.disabled = this.historyIndex === 0;
      this.next.disabled = this.historyIndex === this.history.length;
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
      this.append('Step ' + (stepIndex + 1) + ' · ' + filename + ' λ> ' + expression);
      if (this.history[this.history.length - 1] !== expression) this.history.push(expression);
      if (this.history.length > 100) this.history.shift();
      this.historyIndex = this.history.length;
      this.draft = '';
      this.input.value = '';
      this.updateHistoryButtons();
      this.busy = true;
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
      this.submit.disabled = false;
      const restoreFocus = this.restoreInputFocus || document.activeElement === this.stop;
      this.restoreInputFocus = false;
      this.stop.disabled = true;
      if (restoreFocus) this.input.focus();
    }

    dispose() { this.events.abort(); }
  }

  window.SEBookHaskellInterpreter = HaskellInterpreter;
})();
