/**
 * ObjectReferenceLab — real Python traces with reversible visual playback.
 *
 * Embed a prepared example: <div data-object-reference-example="shared_slots"></div>
 * Or embed {title, code, prediction?, explanation?, variation?,
 * variation_explanation?, trace?} as application/json
 * inside <div data-object-reference-lab>. Edits automatically record a program
 * in a disposable worker; Forward/Back replay snapshots without re-execution.
 * The source editor also displays the current execution position.
 *
 * Dynamic instruction renderers must call destroyWithin(root) before replacing
 * content and await initFrom(root) afterward. No learner code is persisted.
 */
(function () {
  'use strict';
  if (window.ObjectReferenceLab) return;
  const scriptURL = new URL(document.currentScript.src);
  const workerURL = new URL('object-reference-worker.js', scriptURL);
  const examplesURL = new URL('../assets/object-reference-labs.json', scriptURL);
  const selector = '[data-object-reference-lab], [data-object-reference-example]';
  const instances = new Map();
  const mounts = new WeakMap();
  let examplesPromise;
  let labNumber = 0;
  const EDIT_DELAY_MS = 650;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function eventLabel(step) {
    const line = step.visualizedLine;
    if (step.event === 'initial') return 'Before execution';
    if (step.event === 'final') return 'End of execution' + (line ? ' · Line ' + line : '');
    if (step.event === 'error') return 'Execution stopped with an error' + (line ? ' at line ' + line : '');
    if (step.event === 'exception') return 'Exception at line ' + line;
    if (step.event === 'call') return line ? 'Entering a scope from line ' + line : 'Entering a scope';
    if (step.event === 'return') return line ? 'Leaving a scope at line ' + line : 'Leaving a scope';
    return line ? 'Line ' + line : 'Before first statement';
  }

  class Lab {
    constructor(host, example) {
      this.host = host;
      this.example = example;
      this.trace = null;
      this.steps = [];
      this.index = 0;
      // The requested playback position survives pending edits and errors.
      // It is a visible step index, not a source line or Python object identity.
      this.resumeIndex = 0;
      this.dirty = false;
      this.worker = null;
      this.playTimer = 0;
      this.runTimer = 0;
      this.editTimer = 0;
      this.composing = false;
      this.id = 'object-reference-lab-' + (++labNumber);
      this.listeners = new AbortController();
      this.build();
      this.graph = new window.ObjectReferenceGraph.ReferenceGraph(this.graphHost);
      this.restoreExample();
    }

    build() {
      this.host.classList.add('object-reference-lab');
      this.host.setAttribute('role', 'region');
      this.host.setAttribute('aria-label', 'Object reference lab: ' + this.example.title);
      this.host.replaceChildren();
      this.host.append(element('h3', 'orl-title', this.example.title));
      this.host.append(element('p', 'orl-prediction', this.example.prediction || 'Predict which references each line will change.'));
      this.screen = element('div', 'orl-screen');
      this.host.append(this.screen);
      const toolbar = this.buildControls();
      this.buildStateViews(toolbar);
      this.buildExplanation();
      this.print = element('div', 'orl-print');
      this.host.append(this.print);
      this.printHistory = new window.ObjectReferencePrint.PrintHistory(this.print);
      this.host.addEventListener('focusin', event => {
        const header = document.querySelector('.navbar-fixed-top');
        const safeTop = header ? Math.max(0, header.getBoundingClientRect().bottom) + 12 : 12;
        const top = event.target.getBoundingClientRect().top;
        if (top < safeTop) window.scrollBy({ top: top - safeTop, behavior: 'instant' });
      }, { signal: this.listeners.signal });
    }

    buildEditor() {
      this.codePanel = element('div', 'orl-code-panel');
      this.codeEditor = new window.ObjectReferenceCode.Editor(this.codePanel, {
        id: this.id + '-editor',
        rows: Math.min(12, Math.max(6, this.example.code.trimEnd().split('\n').length)),
        describedBy: this.id + '-instructions ' + this.status.id,
        onInput: () => this.invalidate()
      });
      this.editor = this.codeEditor.input;
      this.editor.addEventListener('compositionstart', () => {
        this.composing = true;
        this.cancelRun();
        this.updateControls();
      }, { signal: this.listeners.signal });
      this.editor.addEventListener('compositionend', () => {
        this.composing = false;
        this.invalidate();
      }, { signal: this.listeners.signal });
    }

    buildControls() {
      const instructions = element('p', 'orl-instructions',
        'Use Forward and Back to follow the marked line. Edits retrace automatically after a short pause and return to the same step number, or the last step if the new trace is shorter.');
      instructions.id = this.id + '-instructions';
      this.screen.append(instructions);
      const toolbar = element('div', 'orl-toolbar');
      toolbar.setAttribute('role', 'group');
      toolbar.setAttribute('aria-label', 'Trace and playback controls');
      this.buttons = {};
      const actions = [
        ['restart', 'Restart', () => this.restart()],
        ['back', 'Back', () => this.move(-1)],
        ['forward', 'Forward', () => this.move(1)],
        ['play', 'Play', () => this.togglePlay()],
        ['reset', 'Restore original code', () => this.restoreExample()]
      ];
      actions.forEach(([action, label, handler]) => {
        const button = element('button', '', label);
        button.type = 'button';
        button.dataset.action = action;
        button.addEventListener('click', handler, { signal: this.listeners.signal });
        this.buttons[action] = button;
        toolbar.append(button);
      });
      this.status = element('p', 'orl-status');
      this.status.id = this.id + '-status';
      this.status.setAttribute('role', 'status');
      this.status.setAttribute('aria-atomic', 'true');
      this.error = element('p', 'orl-error');
      this.error.setAttribute('role', 'alert');
      this.error.hidden = true;
      this.screen.append(this.status, this.error);
      return toolbar;
    }

    buildStateViews(toolbar) {
      this.screen.append(element('p', 'orl-legend',
        'Each box is one object, including strings and numbers. Names and members point to these objects. Glow marks changes at this step. Select a labeled reference to follow it. A bridge means two arrows pass without joining.'));
      const columns = element('div', 'orl-columns');
      this.buildEditor();
      const codeColumn = element('div', 'orl-code-column');
      codeColumn.append(this.codePanel, toolbar);
      const diagramPanel = element('div', 'orl-diagram-panel');
      diagramPanel.append(element('p', 'orl-diagram-title', 'Object references'));
      const scroll = element('div', 'orl-graph-scroll');
      scroll.setAttribute('role', 'region');
      scroll.setAttribute('aria-label', 'Object reference diagram');
      this.graphHost = element('div', 'orl-graph');
      scroll.append(this.graphHost);
      diagramPanel.append(scroll);
      columns.append(codeColumn, diagramPanel);
      this.details = element('details', 'orl-details');
      this.details.append(element('summary', '', 'Reference details'));
      this.stateText = element('pre', 'orl-reference-text');
      this.details.append(this.stateText);
      const outputLabel = element('p', 'orl-panel-title', 'Program output');
      this.output = element('pre', 'orl-output');
      this.output.setAttribute('role', 'region');
      this.output.setAttribute('aria-label', 'Program output');
      this.screen.append(columns, this.details, outputLabel, this.output);
    }

    buildExplanation() {
      this.explanation = element('details', 'orl-explanation');
      this.explanation.append(element('summary', '', 'Explain the prepared example'));
      this.explanation.append(element('p', '', this.example.explanation || 'Follow the arrows to distinguish a changed binding from a changed object.'));
      this.screen.append(this.explanation);
      this.buildVariation();
      const limits = element('details', 'orl-limits');
      limits.append(element('summary', '', 'What the trace shows'));
      limits.append(element('p', '',
        'The highlighted line is the operation represented by the displayed state. When a call binds local parameters, the call site is highlighted; returning to the caller highlights the completed call there. Before the first statement, no line is highlighted. The final state retains the last visualized line. Playback skips function/class declaration bookkeeping; those definitions still execute. Class-body assignments, called function bodies, returns, and errors remain visible. Local parameter names appear beside their objects. Only this program’s source is stepped through; built-in operations and imported code execute between steps. Individual names have reference slots; cards contain objects. Strings, numbers, and other primitive values have their own object cards, so shared references remain visible. Repeated literals do not imply separate objects. Function/module objects and classes without displayed data attributes are omitted from the diagram; Reference details retains the full recorded identities and scopes of the displayed state. Arrows show which object each reference points to. Object labels in Reference details identify objects within this run, not memory addresses. Collection and reference counts are not modeled.'));
      limits.append(element('p', '',
        'Edited code runs automatically in your browser after you pause typing. Each update executes the whole program again and displays your previous step number; it does not continue a running Python process. That number may describe a different statement if you change the control flow. The previous diagram stays visible while the update runs. Temporary errors retain your requested position for the next correction. Restart returns to step 1 without changing your code. Restore original code returns to the prepared example. Editing again replaces any running update. Back restores recorded views without undoing external side effects. Small programs work best: execution stops after 10 seconds or at the trace limit, and any omitted graph details or output are reported. Some built-in or extension objects are shown without internals. The initial Python download may take longer. input() and interactive programs are not supported. Edits are kept only while this lab is open.'));
      this.screen.append(limits);
    }

    buildVariation() {
      if (!this.example.variation) return;
      const variation = element('div', 'orl-explanation');
      const label = element('p', '');
      label.append(element('strong', '', 'Try one change'));
      variation.append(label, element('p', '', this.example.variation));
      if (this.example.variation_explanation) {
        this.variationFeedback = element('details', 'orl-explanation');
        this.variationFeedback.append(
          element('summary', '', 'Check the suggested change'),
          element('p', '', this.example.variation_explanation));
        variation.append(this.variationFeedback);
      }
      this.screen.append(variation);
    }

    restoreExample() {
      this.cancelRun();
      this.pause();
      this.resumeIndex = 0;
      this.composing = false;
      this.editor.value = this.example.code.trimEnd();
      this.explanation.hidden = false;
      this.explanation.open = false;
      if (this.variationFeedback) this.variationFeedback.open = false;
      this.error.hidden = true;
      this.setTrace(this.example.trace || null);
      if (!this.trace) this.invalidate();
    }

    restart() {
      this.pause();
      this.resumeIndex = 0;
      if (this.dirty) {
        // The pending edit will select step 1 once its replacement is ready.
        this.status.textContent = 'Updating automatically at step 1… Showing the previous run until ready.';
        if (!this.worker && !this.editTimer && !this.composing) this.run();
      } else if (this.steps.length) {
        this.index = 0;
        this.showStep();
      }
    }

    invalidate() {
      this.cancelRun();
      this.pause();
      this.error.hidden = true;
      this.explanation.hidden = this.editor.value.trimEnd() !== this.example.code.trimEnd();
      this.dirty = true;
      this.codeEditor.setPosition(0, 'Updating…');
      // The last completed graph/output remains visible until its replacement
      // is ready. Printing never pairs those old states with the edited source.
      this.renderPrint();
      this.status.textContent = 'Code changed. Updating automatically at step ' + (this.resumeIndex + 1) + '…'
        + (this.trace ? ' Showing the previous run until ready.' : '');
      if (!this.composing) this.editTimer = setTimeout(() => this.run(), EDIT_DELAY_MS);
      this.updateControls();
    }

    setTrace(trace, { index = 0, reveal = true } = {}) {
      this.trace = trace;
      this.dirty = false;
      // Python classifies execution events; never infer Python syntax from
      // source text here. One timeline keeps Back, Play, and print consistent.
      this.steps = trace ? trace.steps.filter(step => !step.skipPlayback && !(step.event === 'line' && step.line === 0)) : [];
      this.graph.setTimeline(this.steps);
      this.index = Math.max(0, Math.min(index, this.steps.length - 1));
      this.codeEditor.refresh();
      if (this.steps.length) {
        this.showStep(reveal);
      } else {
        this.graph.render({ scopes: [], objects: [] });
        this.stateText.textContent = 'No recorded execution yet.';
        this.output.textContent = '(no output yet)';
      }
      this.renderPrint();
      this.updateControls();
    }

    updateControls() {
      const busy = Boolean(this.worker || this.editTimer || this.composing);
      const steps = this.steps.length;
      this.buttons.restart.disabled = !steps && !this.dirty;
      this.buttons.back.disabled = busy || this.dirty || !steps || this.index === 0;
      this.buttons.forward.disabled = busy || this.dirty || !steps || this.index >= steps - 1;
      this.buttons.play.disabled = busy || this.dirty || !steps || (this.index >= steps - 1 && !this.playTimer);
      this.buttons.play.textContent = this.playTimer ? 'Pause' : 'Play';
    }

    showStep(reveal = true) {
      const step = this.steps[this.index];
      this.graph.render(step);
      this.stateText.textContent = window.ObjectReferenceGraph.describeState(step);
      this.output.textContent = step.output || '(no output yet)';
      this.codeEditor.setPosition(step.visualizedLine, eventLabel(step), { reveal });
      this.status.textContent = 'Step ' + (this.index + 1) + ' of ' + this.steps.length + ' · ' + eventLabel(step)
        + (step.note ? '. ' + step.note : '');
      this.updateControls();
    }

    move(delta) {
      this.pause();
      if (!this.trace || this.dirty) return;
      this.index = Math.max(0, Math.min(this.steps.length - 1, this.index + delta));
      this.resumeIndex = this.index;
      this.showStep();
    }

    togglePlay() {
      if (this.playTimer) { this.pause(); return; }
      if (!this.trace || this.dirty || this.index >= this.steps.length - 1) return;
      this.playTimer = window.setInterval(() => {
        this.index += 1;
        this.resumeIndex = this.index;
        this.showStep();
        if (this.index === this.steps.length - 1) this.pause();
      }, 1600);
      this.updateControls();
    }

    pause() {
      clearInterval(this.playTimer);
      this.playTimer = 0;
      if (this.buttons) this.updateControls();
    }

    run() {
      this.cancelRun();
      this.pause();
      this.error.hidden = true;
      this.status.textContent = 'Loading Python…' + (this.trace ? ' Showing the previous run until ready.' : '');
      try {
        this.worker = new Worker(workerURL);
      } catch (error) {
        this.fail('Python could not start: ' + error.message);
        return;
      }
      this.updateControls();
      this.runTimer = setTimeout(() => this.stop('Python loading timed out. Edit the code to retry.'), 60000);
      const worker = this.worker;
      // Edits can replace a worker while it is loading or executing. Only the
      // current worker may publish results, errors, or timeout transitions.
      worker.onmessage = event => { if (this.worker === worker) this.receive(event.data); };
      worker.onerror = event => {
        if (this.worker === worker) this.fail('Python could not run. ' + (event.message || 'Please retry.'));
      };
      this.worker.postMessage({ type: 'trace', code: this.editor.value });
    }

    receive(message) {
      if (message.type === 'ready') {
        clearTimeout(this.runTimer);
        this.runTimer = setTimeout(() => this.stop('Execution stopped after 10 seconds. Shorten the program to retry.'), 10000);
        this.status.textContent = 'Recording execution…' + (this.trace ? ' Showing the previous run until ready.' : '');
      } else if (message.type === 'result') {
        this.cancelRun();
        if (!message.trace || !message.trace.steps.length) {
          this.fail(message.error || (message.trace && message.trace.error) || 'Python could not produce a trace.');
          return;
        }
        if (message.trace.error && !message.trace.steps.some(step => step.event === 'line' && step.line > 0)) {
          // Incomplete syntax has no replacement diagram. Retain the last
          // completed image and the saved position while the learner repairs it.
          this.fail(message.trace.error);
          return;
        }
        const requestedIndex = this.resumeIndex;
        this.setTrace(message.trace, { index: requestedIndex, reveal: document.activeElement !== this.editor });
        // A temporary syntax/runtime error must not erase the position the
        // learner was inspecting. A successful shorter trace clamps it.
        if (!message.trace.error) this.resumeIndex = this.index;
        if (this.index < requestedIndex && !message.trace.error) {
          this.status.textContent += ' · The new trace ends before step ' + (requestedIndex + 1) + '.';
        }
        if (message.trace.error) this.showError(message.trace.error);
      } else if (message.type === 'error') {
        this.fail(message.error || 'Python could not load. Edit the code to retry.');
      }
    }

    showError(message) {
      this.error.textContent = message;
      this.error.hidden = false;
    }

    fail(message) {
      this.cancelRun();
      this.showError(message);
      this.codeEditor.setPosition(0, 'Update failed');
      this.status.textContent = 'Could not update. Edit the code to retry.' + (this.trace ? ' Showing the previous run.' : '');
      this.renderPrint();
      this.updateControls();
    }

    stop(message) {
      this.cancelRun();
      this.status.textContent = message;
      if (this.dirty && this.trace) this.status.textContent += ' Showing the previous run.';
      this.updateControls();
    }

    cancelRun() {
      clearTimeout(this.editTimer);
      this.editTimer = 0;
      clearTimeout(this.runTimer);
      if (this.worker) {
        this.worker.onmessage = null;
        this.worker.onerror = null;
        this.worker.terminate();
      }
      this.worker = null;
    }

    renderPrint() {
      const prepared = this.editor.value.trimEnd() === this.example.code.trimEnd();
      this.printHistory.render({
        code: this.editor.value,
        steps: this.dirty ? [] : this.steps,
        labelStep: eventLabel,
        error: this.dirty ? (this.error.hidden ? undefined : this.error.textContent) : this.trace && this.trace.error,
        explanation: prepared ? this.example.explanation : undefined,
        variation: prepared ? this.example.variation : undefined,
        variationExplanation: prepared ? this.example.variation_explanation : undefined
      });
    }

    destroy() {
      this.cancelRun();
      this.pause();
      this.listeners.abort();
      this.codeEditor.destroy();
      this.graph.destroy();
      this.printHistory.destroy();
      instances.delete(this.host);
    }
  }

  async function readExample(host) {
    const key = host.dataset.objectReferenceExample;
    if (key) {
      if (!examplesPromise) {
        examplesPromise = fetch(examplesURL).then(response => {
          if (!response.ok) throw new Error('Prepared examples could not load. Reload to retry.');
          return response.json();
        }).catch(error => { examplesPromise = null; throw error; });
      }
      const examples = await examplesPromise;
      if (!examples[key]) throw new Error('Unknown object-reference example: ' + key);
      return examples[key];
    }
    const data = host.querySelector('script[type="application/json"]');
    if (!data) throw new Error('The object-reference lab needs an example or a code specification.');
    return JSON.parse(data.textContent);
  }

  /** Mount every lab under a newly rendered instruction element; safe to repeat. */
  async function initFrom(root = document) {
    const hosts = Array.from(root.querySelectorAll(selector));
    if (root.matches && root.matches(selector)) hosts.unshift(root);
    return Promise.all(hosts.map(host => {
      if (instances.has(host)) return Promise.resolve();
      if (mounts.has(host)) return mounts.get(host);
      const mounting = (async () => {
        try {
          const example = await readExample(host);
          if (!host.isConnected) return;
          if (!example || typeof example.code !== 'string' || typeof example.title !== 'string') {
            throw new Error('A lab requires a title and Python code.');
          }
          instances.set(host, new Lab(host, example));
        } catch (error) {
          const message = element('p', 'orl-error', error.message);
          message.setAttribute('role', 'alert');
          host.append(message);
        } finally {
          mounts.delete(host);
        }
      })();
      mounts.set(host, mounting);
      return mounting;
    }));
  }

  function destroyWithin(root) {
    instances.forEach((lab, host) => { if (root.contains(host)) lab.destroy(); });
  }

  window.ObjectReferenceLab = { initFrom, destroyWithin };
  // Tutorial steps and popouts replace whole instruction roots. Also clean up
  // when another renderer removes a lab without invoking the explicit API.
  new MutationObserver(() => {
    instances.forEach((lab, host) => { if (!host.isConnected) lab.destroy(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) instances.forEach(lab => lab.pause());
  });
  window.addEventListener('pagehide', () => instances.forEach(lab => {
    lab.pause();
    if (lab.worker || lab.editTimer) lab.stop('Run stopped when leaving the page. Edit the code to retry.');
  }));
  window.addEventListener('beforeprint', () => instances.forEach(lab => lab.pause()));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initFrom());
  else initFrom();
}());
