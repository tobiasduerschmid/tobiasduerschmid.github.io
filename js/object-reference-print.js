/** Printable object-reference histories, using the screen graph renderer.
 * Histories prepare layouts ahead of printing. A complete synchronous channel
 * layout covers immediate native printing while compact layouts are calculated.
 */
(function () {
  'use strict';
  if (window.ObjectReferencePrint) return;
  const histories = new Map();
  const printMedia = matchMedia('print');
  let historyNumber = 0;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function printIsVisible() {
    return printMedia.matches || document.documentElement.classList.contains('print-light-mode')
      || document.documentElement.classList.contains('orl-print-preparing');
  }

  function prepareAll() {
    return Promise.all(Array.from(histories.values(), history => history.prepare()));
  }

  class PrintHistory {
    constructor(host) {
      this.host = host;
      this.id = 'orl-print-history-' + (++historyNumber);
      this.snapshots = [];
      histories.set(host, this);
    }

    /** Replace the history with already-filtered playback steps. labelStep(step)
     * supplies the same execution-position wording as the interactive view.
     * Prepared guidance is optional; callers omit it for edited programs. */
    render({ code, steps, labelStep, explanation, variation, variationExplanation, error }) {
      this.snapshots.forEach(snapshot => snapshot.graph?.destroy());
      const source = element('pre', 'orl-print-source');
      source.append(window.ObjectReferenceCode.highlight(code));
      this.host.replaceChildren(element('p', 'orl-panel-title', 'Python code'), source);
      const lines = code.split('\n');
      // Do not build thousands of hidden cards for a long edited trace.
      // Native printing still prepares every requested state synchronously.
      this.prewarm = steps.reduce((count, step) => count + step.objects.length, 0) <= 300;
      this.snapshots = steps.map((step, index) => this.appendSnapshot(step, index, lines, labelStep));
      if (!steps.length) {
        this.host.append(element('p', '', 'No recorded execution for this edit yet. Wait for the automatic update before printing its reference states.'));
      }
      if (error) this.host.append(element('p', 'orl-error', error));
      if (explanation) this.host.append(element('p', '', explanation));
      if (variation) {
        this.host.append(element('p', 'orl-panel-title', 'Try one change'), element('p', '', variation));
        if (variationExplanation) {
          this.host.append(element('p', 'orl-panel-title', 'Check the suggested change'), element('p', '', variationExplanation));
        }
      }
      this.prepare();
    }

    appendSnapshot(step, index, lines, labelStep) {
      const block = element('figure', 'orl-print-step');
      const caption = element('figcaption', 'orl-print-caption', 'Step ' + (index + 1) + ': ' + labelStep(step));
      caption.id = this.id + '-step-' + index;
      block.setAttribute('aria-labelledby', caption.id);
      block.append(caption);
      if (step.line > 0 && lines[step.line - 1] !== undefined) {
        const sourceLine = element('pre', 'orl-print-line');
        sourceLine.append(window.ObjectReferenceCode.highlight(lines[step.line - 1]));
        block.append(sourceLine);
      }
      const description = window.ObjectReferenceGraph.describeState(step);
      const diagram = element('div', 'orl-print-diagram');
      diagram.setAttribute('role', 'img');
      diagram.setAttribute('aria-label', description);
      const graphHost = element('div', 'orl-graph');
      graphHost.setAttribute('aria-hidden', 'true');
      diagram.append(graphHost);
      block.append(diagram, element('pre', 'orl-print-description', description));
      if (step.output) block.append(element('pre', 'orl-output', 'Output:\n' + step.output));
      this.host.append(block);
      return { step, block, graphHost, graph: null };
    }

    /** Ready layouts are reused by native beforeprint; callers that initiate
     * printing programmatically can await prepareAll() for the compact view. */
    prepare() {
      if (!this.host.isConnected || (!this.prewarm && !printIsVisible())) return Promise.resolve();
      const pending = this.snapshots.map(snapshot => {
        if (!snapshot.graph) {
          snapshot.graph = new window.ObjectReferenceGraph.ReferenceGraph(snapshot.graphHost, { interactive: false });
          snapshot.block.classList.add('has-visual');
          return snapshot.graph.render(snapshot.step);
        }
        return snapshot.graph.layout();
      });
      return Promise.all(pending);
    }

    destroy() {
      histories.delete(this.host);
      this.snapshots.forEach(snapshot => snapshot.graph?.destroy());
      this.snapshots = [];
    }
  }

  window.addEventListener('beforeprint', () => {
    // Some browsers dispatch beforeprint before applying print media. Reveal
    // only this component's print layout, then remeasure on the media change.
    document.documentElement.classList.add('orl-print-preparing');
    prepareAll();
  });
  window.addEventListener('afterprint', () => {
    document.documentElement.classList.remove('orl-print-preparing');
  });
  printMedia.addEventListener('change', event => { if (event.matches) prepareAll(); });
  if (document.fonts) document.fonts.ready.then(prepareAll);
  window.ObjectReferencePrint = { PrintHistory, prepareAll };
}());
