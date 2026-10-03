/** Printable object-reference histories, using the screen graph renderer.
 * Hosts keep textual snapshots until print layout is visible. Each static
 * graph is measured synchronously and then released; no graph observers or
 * animation frames remain attached to the printable history.
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
    histories.forEach(history => history.prepare());
  }

  // One size observer serves all histories; static snapshot graphs have none.
  // Height changes also catch text spacing or font changes at a fixed width.
  const sizes = new ResizeObserver(entries => {
    entries.forEach(entry => {
      const history = histories.get(entry.target);
      if (history && (Math.abs(entry.contentRect.width - history.width) > 0.5
          || Math.abs(entry.contentRect.height - history.height) > 0.5)) history.prepare();
    });
  });

  class PrintHistory {
    constructor(host) {
      this.host = host;
      this.id = 'orl-print-history-' + (++historyNumber);
      this.snapshots = [];
      this.width = 0;
      this.height = 0;
      histories.set(host, this);
      sizes.observe(host);
    }

    /** Replace the history with already-filtered playback steps. labelStep(step)
     * supplies the same execution-position wording as the interactive view.
     * Prepared guidance is optional; callers omit it for edited programs. */
    render({ code, steps, labelStep, explanation, variation, variationExplanation, error }) {
      this.width = 0;
      this.height = 0;
      const source = element('pre', 'orl-print-source');
      source.append(window.ObjectReferenceCode.highlight(code));
      this.host.replaceChildren(element('p', 'orl-panel-title', 'Python code'), source);
      const lines = code.split('\n');
      this.snapshots = steps.map((step, index) => this.appendSnapshot(step, index, lines, labelStep));
      if (!steps.length) {
        this.host.append(element('p', '', 'No recorded execution. Trace this code before printing to include its reference states.'));
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
      return { step, block, graphHost };
    }

    /** Synchronous: beforeprint cannot await animation frames. Calling again
     * safely rebuilds measured paths after a paper-size or font-size change. */
    prepare() {
      if (!printIsVisible() || !this.host.isConnected) return;
      const width = this.host.getBoundingClientRect().width;
      if (!width) return;
      this.snapshots.forEach(({ step, block, graphHost }, index) => {
        graphHost.replaceChildren();
        const graph = new window.ObjectReferenceGraph.ReferenceGraph(graphHost, { interactive: false });
        try {
          graph.reset();
          // Preserve the same changed-object signals as sequential playback.
          if (index) graph.render(this.snapshots[index - 1].step);
          graph.render(step);
          block.classList.add('has-visual');
          graph.layout();
        } finally {
          graph.destroy();
        }
      });
      // Capture the resulting size, not the pre-layout height, so the observer
      // does not redraw in response to this preparation's own layout changes.
      const bounds = this.host.getBoundingClientRect();
      this.width = bounds.width;
      this.height = bounds.height;
    }

    destroy() {
      sizes.unobserve(this.host);
      histories.delete(this.host);
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
  window.ObjectReferencePrint = { PrintHistory };
}());
