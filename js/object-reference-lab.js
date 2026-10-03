/**
 * ObjectReferenceLab — real Python traces with reversible visual playback.
 *
 * Embed a prepared example: <div data-object-reference-example="shared_slots"></div>
 * Or embed {title, code, prediction?, explanation?, variation?,
 * variation_explanation?, trace?} as application/json
 * inside <div data-object-reference-lab>. Trace Python records an edited program
 * in a disposable worker; Forward/Back replay snapshots without re-execution.
 * Set data-object-reference-editor="inline" to keep the code editor visible.
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

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function eventLabel(step) {
    if (step.event === 'initial') return 'Before execution';
    if (step.event === 'final') return 'End of execution';
    if (step.event === 'error') return 'Execution stopped with an error';
    if (step.event === 'exception') return 'Exception at line ' + step.line;
    if (step.event === 'call') return 'Entering a scope at line ' + step.line;
    if (step.event === 'return') return 'Leaving a scope at line ' + step.line;
    return 'Next: line ' + step.line;
  }

  class Lab {
    constructor(host, example) {
      this.host = host;
      this.example = example;
      this.inlineEditor = host.dataset.objectReferenceEditor === 'inline';
      this.trace = null;
      this.steps = [];
      this.index = 0;
      this.worker = null;
      this.playTimer = 0;
      this.runTimer = 0;
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
      this.buildEditor();
      this.buildControls();
      this.buildStateViews();
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
      const instructions = element('p', 'orl-instructions',
        this.inlineEditor
          ? 'Edit the Python code below, then choose Trace Python. Use Forward and Back to follow the resulting execution.'
          : 'Use Forward and Back to follow execution. Open Edit Python code to try a change, then choose Trace Python.');
      instructions.id = this.id + '-instructions';
      const label = element('label', 'orl-editor-label', 'Python code');
      label.htmlFor = this.id + '-editor';
      this.editor = element('textarea', 'orl-editor');
      this.editor.id = label.htmlFor;
      this.editor.rows = Math.min(8, Math.max(6, this.example.code.trimEnd().split('\n').length));
      this.editor.spellcheck = false;
      this.editor.autocomplete = 'off';
      this.editor.setAttribute('aria-describedby', instructions.id);
      this.editor.addEventListener('input', () => this.invalidate(), { signal: this.listeners.signal });
      this.screen.append(instructions);
      if (this.inlineEditor) {
        this.screen.append(label, this.editor);
      } else {
        this.editDetails = element('details', 'orl-edit');
        this.editDetails.append(element('summary', '', 'Edit Python code'), label, this.editor);
        this.screen.append(this.editDetails);
      }
    }

    buildControls() {
      const toolbar = element('div', 'orl-toolbar');
      toolbar.setAttribute('role', 'group');
      toolbar.setAttribute('aria-label', 'Trace and playback controls');
      this.buttons = {};
      const actions = [
        ['trace', 'Trace Python', () => this.run()],
        ['stop', 'Stop', () => this.stop('Run stopped. Edit the code or choose Trace Python to try again.')],
        ['back', 'Back', () => this.move(-1)],
        ['forward', 'Forward', () => this.move(1)],
        ['play', 'Play', () => this.togglePlay()],
        ['reset', 'Reset example', () => this.restoreExample()]
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
      this.status.setAttribute('role', 'status');
      this.status.setAttribute('aria-atomic', 'true');
      this.error = element('p', 'orl-error');
      this.error.setAttribute('role', 'alert');
      this.error.hidden = true;
      this.screen.append(toolbar, this.status, this.error);
    }

    buildStateViews() {
      this.screen.append(element('p', 'orl-legend',
        'Arrows show references; primitive values appear in place. Select a labeled reference to follow it. A bridge means two arrows pass without joining.'));
      const columns = element('div', 'orl-columns');
      const codePanel = element('div', 'orl-code-panel');
      codePanel.append(element('p', 'orl-panel-title', 'Execution position'));
      this.code = element('ol', 'orl-code');
      this.code.setAttribute('aria-label', 'Recorded Python source');
      this.code.tabIndex = 0;
      codePanel.append(this.code);
      const diagramPanel = element('div', 'orl-diagram-panel');
      diagramPanel.append(element('p', 'orl-panel-title', 'Object references'));
      const scroll = element('div', 'orl-graph-scroll');
      scroll.setAttribute('role', 'region');
      scroll.setAttribute('aria-label', 'Object reference diagram');
      this.graphHost = element('div', 'orl-graph');
      scroll.append(this.graphHost);
      diagramPanel.append(scroll);
      columns.append(codePanel, diagramPanel);
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
        'At a “Next: line” step, the highlighted line is about to execute. Playback skips function/class declaration bookkeeping and continues to statements; those definitions still execute. Class-body assignments, called function bodies, returns, and errors remain visible. Local parameter names appear beside their objects. Only this program’s source is stepped through; built-in operations and imported code execute between steps. Individual names have reference slots; cards contain objects. Primitive values appear directly at names and members, but still follow Python’s object-reference rules. Repeated literals do not imply separate objects. Function/module objects and classes without displayed data attributes are omitted from the diagram; Reference details retains the full recorded identities and scopes of the displayed state. Object labels identify objects within this run, not memory addresses. Collection and reference counts are not modeled.'));
      limits.append(element('p', '',
        'Edited code runs in your browser. Trace Python executes the program before playback begins; Back restores recorded views without undoing external side effects. Stop cancels a run. Small programs work best: execution stops after 10 seconds or at the trace limit, and any omitted graph details or output are reported. Some built-in or extension objects are shown without internals. The initial Python download may take longer. input() and interactive programs are not supported. Edits are kept only while this lab is open.'));
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
      this.editor.value = this.example.code.trimEnd();
      if (this.editDetails) this.editDetails.open = false;
      this.explanation.hidden = false;
      this.explanation.open = false;
      if (this.variationFeedback) this.variationFeedback.open = false;
      this.error.hidden = true;
      this.setTrace(this.example.trace || null);
      if (!this.trace) this.status.textContent = 'Choose Trace Python to record this example.';
    }

    invalidate() {
      this.cancelRun();
      this.pause();
      this.error.hidden = true;
      this.explanation.hidden = this.editor.value.trimEnd() !== this.example.code.trimEnd();
      this.setTrace(null);
      this.status.textContent = 'Code changed. Choose Trace Python to record the edited program.';
    }

    renderCode() {
      this.code.replaceChildren();
      this.editor.value.split('\n').forEach(line => {
        const item = element('li', '');
        item.append(element('code', '', line || ' '));
        this.code.append(item);
      });
    }

    setTrace(trace) {
      this.trace = trace;
      // Python classifies execution events; never infer Python syntax from
      // source text here. One timeline keeps Back, Play, and print consistent.
      this.steps = trace ? trace.steps.filter(step => !step.skipPlayback) : [];
      this.index = 0;
      this.graph.reset();
      this.renderCode();
      this.renderPrint();
      if (this.steps.length) {
        this.showStep();
      } else {
        this.graph.render({ scopes: [], objects: [] });
        this.stateText.textContent = 'No recorded execution yet.';
        this.output.textContent = '(no output yet)';
      }
      this.updateControls();
    }

    updateControls() {
      const busy = Boolean(this.worker);
      const steps = this.steps.length;
      this.buttons.trace.disabled = busy;
      this.buttons.stop.disabled = !busy;
      this.buttons.back.disabled = busy || !steps || this.index === 0;
      this.buttons.forward.disabled = busy || !steps || this.index >= steps - 1;
      this.buttons.play.disabled = busy || !steps || (this.index >= steps - 1 && !this.playTimer);
      this.buttons.play.textContent = this.playTimer ? 'Pause' : 'Play';
      this.editor.readOnly = busy;
    }

    showStep() {
      const step = this.steps[this.index];
      this.graph.render(step);
      this.stateText.textContent = window.ObjectReferenceGraph.describeState(step);
      this.output.textContent = step.output || '(no output yet)';
      Array.from(this.code.children).forEach((line, index) => {
        const current = index + 1 === step.line;
        line.classList.toggle('is-current', current);
        if (current) {
          line.setAttribute('aria-current', 'step');
          line.dataset.positionLabel = step.event === 'line' ? 'next' : step.event;
        }
        else line.removeAttribute('aria-current');
      });
      const currentLine = this.code.querySelector('.is-current');
      if (currentLine) {
        const pane = this.code.getBoundingClientRect();
        const line = currentLine.getBoundingClientRect();
        if (line.top < pane.top) this.code.scrollTop -= pane.top - line.top;
        else if (line.bottom > pane.bottom) this.code.scrollTop += line.bottom - pane.bottom;
      }
      this.status.textContent = 'Step ' + (this.index + 1) + ' of ' + this.steps.length + ' · ' + eventLabel(step)
        + (step.note ? '. ' + step.note : '');
      this.updateControls();
    }

    move(delta) {
      this.pause();
      if (!this.trace) return;
      this.index = Math.max(0, Math.min(this.steps.length - 1, this.index + delta));
      this.showStep();
    }

    togglePlay() {
      if (this.playTimer) { this.pause(); return; }
      if (!this.trace || this.index >= this.steps.length - 1) return;
      this.playTimer = window.setInterval(() => {
        this.index += 1;
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
      this.setTrace(null);
      if (this.editDetails) this.editDetails.open = false;
      this.status.textContent = 'Loading Python… You can stop this run.';
      try {
        this.worker = new Worker(workerURL);
      } catch (error) {
        this.fail('Python could not start: ' + error.message);
        return;
      }
      this.updateControls();
      this.runTimer = setTimeout(() => this.stop('Python loading timed out. Choose Trace Python to retry.'), 60000);
      this.worker.onmessage = event => this.receive(event.data);
      this.worker.onerror = event => this.fail('Python could not run. ' + (event.message || 'Please retry.'));
      this.worker.postMessage({ type: 'trace', code: this.editor.value });
    }

    receive(message) {
      if (message.type === 'ready') {
        clearTimeout(this.runTimer);
        this.runTimer = setTimeout(() => this.stop('Execution stopped after 10 seconds. Shorten the program and trace again.'), 10000);
        this.status.textContent = 'Recording execution… You can stop this run.';
      } else if (message.type === 'result') {
        this.cancelRun();
        if (!message.trace || !message.trace.steps.length) {
          this.fail(message.error || (message.trace && message.trace.error) || 'Python could not produce a trace.');
          return;
        }
        this.setTrace(message.trace);
        if (message.trace.error) this.showError(message.trace.error);
      } else if (message.type === 'error') {
        this.fail(message.error || 'Python could not load. Choose Trace Python to retry.');
      }
    }

    showError(message) {
      this.error.textContent = message;
      this.error.hidden = false;
    }

    fail(message) {
      this.cancelRun();
      this.showError(message);
      this.status.textContent = 'Trace unavailable. Edit the code or try again.';
      this.updateControls();
    }

    stop(message) {
      this.cancelRun();
      this.status.textContent = message;
      this.updateControls();
    }

    cancelRun() {
      clearTimeout(this.runTimer);
      if (this.worker) this.worker.terminate();
      this.worker = null;
      this.editor.readOnly = false;
    }

    renderPrint() {
      const prepared = this.editor.value.trimEnd() === this.example.code.trimEnd();
      this.printHistory.render({
        code: this.editor.value,
        steps: this.steps,
        labelStep: eventLabel,
        error: this.trace && this.trace.error,
        explanation: prepared ? this.example.explanation : undefined,
        variation: prepared ? this.example.variation : undefined,
        variationExplanation: prepared ? this.example.variation_explanation : undefined
      });
    }

    destroy() {
      this.cancelRun();
      this.pause();
      this.listeners.abort();
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
    if (lab.worker) lab.stop('Run stopped when leaving the page. Choose Trace Python to retry.');
  }));
  window.addEventListener('beforeprint', () => instances.forEach(lab => lab.pause()));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initFrom());
  else initFrom();
}());
