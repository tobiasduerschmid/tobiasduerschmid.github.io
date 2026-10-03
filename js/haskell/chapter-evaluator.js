import { ChapterRuntime } from './chapter-runtime.js';
import { ChapterSource } from './chapter-source.js';

const runtime = new ChapterRuntime();
const HISTORY_LIMIT = 50;
const OUTPUT_LIMIT = 16_000;

class ChapterEvaluator {
  constructor(panel, codeBlock, index, topic) {
    this.panel = panel;
    this.history = [];
    this.historyIndex = 0;
    this.draft = '';
    this.busy = false;
    this.input = panel.querySelector('input');
    this.log = panel.querySelector('[role="log"]');
    this.status = panel.querySelector('[role="status"]');
    this.submit = panel.querySelector('[type="submit"]');
    this.stop = panel.querySelector('[data-action="stop"]');
    this.loading = panel.querySelector('.haskell-evaluator-loading');
    this.previous = panel.querySelector('[data-action="previous"]');
    this.next = panel.querySelector('[data-action="next"]');
    this.input.value = panel.dataset.example;
    this.status.id = 'haskell-expression-status-' + index;
    this.input.setAttribute('aria-describedby', this.status.id);
    const wrapper = document.createElement('div');
    wrapper.className = 'haskell-example';
    codeBlock.before(wrapper);
    wrapper.append(codeBlock, panel);
    if (!panel.hasAttribute('data-prelude-only')) {
      this.editor = new ChapterSource(codeBlock, { index, topic, onChange: () => {
        runtime.warmup();
        this.status.textContent = 'Code updated. Evaluate an expression to try your changes.';
      } });
    }
    panel.hidden = false;
    panel.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      void this.evaluate();
    });
    this.stop.addEventListener('click', () => runtime.stop());
    this.previous.addEventListener('click', () => this.recall(-1));
    this.next.addEventListener('click', () => this.recall(1));
    panel.querySelector('[data-action="clear"]').addEventListener('click', () => this.clear());
    this.input.addEventListener('keydown', event => this.onKey(event));
    this.input.addEventListener('input', () => runtime.warmup());
    runtime.addEventListener('busychange', () => this.updateControls());
  }

  updateControls() {
    this.submit.disabled = runtime.busy;
    this.input.readOnly = this.busy;
    this.stop.hidden = !this.busy;
    this.editor?.setBusy(this.busy);
    this.previous.disabled = this.busy || this.historyIndex === 0;
    this.next.disabled = this.busy || this.historyIndex === this.history.length;
  }

  onKey(event) {
    if (event.isComposing || event.altKey || event.metaKey || event.shiftKey) return;
    if (event.ctrlKey) {
      if (event.key.toLowerCase() === 'l') {
        event.preventDefault();
        this.clear();
      } else if (event.key.toLowerCase() === 'c' && this.input.selectionStart === this.input.selectionEnd) {
        event.preventDefault();
        if (this.busy) runtime.stop();
        else {
          this.input.value = '';
          this.historyIndex = this.history.length;
          this.draft = '';
          this.updateControls();
        }
      }
    } else if (!this.busy && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      this.recall(event.key === 'ArrowUp' ? -1 : 1);
    }
  }

  recall(direction) {
    if (this.historyIndex === this.history.length) this.draft = this.input.value;
    this.historyIndex = Math.max(0, Math.min(this.history.length, this.historyIndex + direction));
    this.input.value = this.historyIndex === this.history.length ? this.draft : this.history[this.historyIndex];
    this.updateControls();
    this.input.focus();
  }

  clear() {
    this.log.replaceChildren();
    this.log.tabIndex = -1;
    this.status.textContent = 'Transcript cleared. Command history is still available.';
    this.input.focus();
  }

  append(text) {
    const entry = document.createElement('pre');
    entry.textContent = text.length > OUTPUT_LIMIT ? text.slice(0, OUTPUT_LIMIT) + '\n[Display truncated: request a smaller result.]' : text;
    this.log.append(entry);
    this.log.tabIndex = 0;
    while (this.log.children.length > HISTORY_LIMIT * 2) this.log.firstElementChild.remove();
    this.log.scrollTop = this.log.scrollHeight;
  }

  async evaluate() {
    const expression = this.input.value.trim();
    if (!expression || runtime.busy) return;
    this.busy = true;
    this.append('λ> ' + expression);
    this.loading.hidden = false;
    if (this.history.at(-1) !== expression) this.history.push(expression);
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
    this.historyIndex = this.history.length;
    this.draft = '';
    this.input.value = '';
    // Focus stays in the prompt, including while it is read-only for Stop.
    this.input.focus({ preventScroll: true });
    try {
      const result = await runtime.evaluate(this.editor?.value || '', expression, message => { this.status.textContent = message; });
      const output = (result.stdout || '') + (result.stderr || '') + (result.error || '');
      this.append(output.trimEnd() || (result.exitCode === 0 ? 'Completed (no output).' : 'Expression could not be evaluated.'));
      this.status.textContent = result.exitCode === 0 ? 'Ready for another expression.' : 'Check the diagnostic above, edit the expression, and try again.';
    } catch (error) {
      this.append(error.message);
      this.status.textContent = 'Ready to try again.';
    } finally {
      const restoreFocus = document.activeElement === this.stop;
      this.busy = false;
      this.loading.hidden = true;
      this.updateControls();
      if (restoreFocus) this.input.focus({ preventScroll: true });
    }
  }
}

// Explicit author opt-in avoids trying to compile signature-only reference
// blocks or revealing quiz/puzzle answers. Editors never execute on input.
document.querySelectorAll('[data-haskell-evaluator]').forEach((panel, index) => {
  const block = panel.previousElementSibling;
  if (!block?.matches('.language-haskell') || !block.querySelector('code')) return;
  let heading = block.previousElementSibling;
  while (heading && !heading.matches('h1, h2, h3, h4')) heading = heading.previousElementSibling;
  const topic = heading?.textContent || 'Example ' + (index + 1);
  panel.setAttribute('aria-label', 'Haskell evaluator: ' + topic);
  new ChapterEvaluator(panel, block, index, topic);
});

// Keep a heading, its short introduction, and its first example together on
// paper. A temporary containing block is reliable across print pagination;
// break-after alone can be lost at the nested editor's box boundaries.
const printGroups = [];
window.addEventListener('beforeprint', () => {
  if (printGroups.length) return;
  document.querySelectorAll('.haskell-example').forEach(example => {
    let lead = example.previousElementSibling;
    if (lead?.matches('p')) lead = lead.previousElementSibling;
    if (!lead?.matches('h1, h2, h3')) return;
    const group = document.createElement('div');
    group.className = 'haskell-example-print-group';
    lead.before(group);
    for (let node = lead; node;) {
      const next = node.nextElementSibling;
      group.append(node);
      if (node === example) break;
      node = next;
    }
    printGroups.push(group);
  });
});
window.addEventListener('afterprint', () => {
  for (const group of printGroups.splice(0)) group.replaceWith(...group.childNodes);
});
