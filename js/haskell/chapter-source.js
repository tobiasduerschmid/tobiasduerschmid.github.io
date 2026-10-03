import './syntax.js';

const keywords = new Set('case class data default deriving do else foreign if import in infix infixl infixr instance let module newtype of then type where'.split(' '));

// Reuse the analysis lexer; whitespace/comment gaps are retained verbatim.
// Highlighting is only a visual aid. The native textarea owns editing and undo.
function highlight(source) {
  const fragment = document.createDocumentFragment();
  const append = (text, kind) => {
    const node = document.createElement('span');
    if (kind) node.className = 'haskell-token-' + kind;
    node.textContent = text;
    fragment.append(node);
  };
  let end = 0;
  try {
    for (const token of globalThis.SEBookHaskellSyntax.tokenize(source)) {
      if (token.offset > end) append(source.slice(end, token.offset), 'comment');
      const text = token.text;
      const kind = keywords.has(text) ? 'keyword' : /^["']/.test(text) ? 'string'
        : /^\d/.test(text) ? 'number' : /^[A-Z]/.test(text) ? 'type' : '';
      append(text, kind);
      end = token.offset + text.length;
    }
    append(source.slice(end) + (source.endsWith('\n') ? ' ' : ''), 'comment');
  } catch {
    // Large or incomplete drafts must remain editable even if analysis stops.
    fragment.replaceChildren(document.createTextNode(source));
  }
  return fragment;
}

export class ChapterSource {
  constructor(block, { index, topic, onChange }) {
    this.code = block.querySelector('code');
    this.original = this.code.textContent;
    this.mirror = block.querySelector('.highlight');
    this.pre = block.querySelector('pre');
    block.classList.add('haskell-source');
    block.setAttribute('role', 'group');
    block.setAttribute('aria-label', 'Haskell example: ' + topic);
    const header = document.createElement('div');
    header.className = 'haskell-source-header';
    const label = document.createElement('label');
    label.textContent = 'Haskell code';
    label.htmlFor = 'haskell-source-' + index;
    this.reset = document.createElement('button');
    this.reset.type = 'button';
    this.reset.textContent = 'Reset code';
    this.reset.disabled = true;
    header.append(label, this.reset);
    const hint = document.createElement('p');
    hint.className = 'haskell-source-hint';
    hint.id = 'haskell-source-help-' + index;
    hint.textContent = 'Edit the example, then evaluate an expression. Tab moves to the next control.';
    const body = document.createElement('div');
    body.className = 'haskell-source-body';
    this.mirror.classList.add('haskell-source-mirror');
    this.mirror.setAttribute('aria-hidden', 'true');
    this.input = document.createElement('textarea');
    this.input.id = label.htmlFor;
    this.input.setAttribute('aria-label', 'Haskell code: ' + topic);
    this.input.setAttribute('aria-describedby', hint.id);
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';
    this.input.setAttribute('autocapitalize', 'off');
    this.input.wrap = 'off';
    this.input.value = this.original;
    body.append(this.mirror, this.input);
    block.append(header, hint, body);
    this.input.addEventListener('input', () => { this.refresh(); onChange(); });
    this.input.addEventListener('scroll', () => this.syncScroll());
    this.reset.addEventListener('click', () => {
      this.input.value = this.original;
      this.refresh();
      onChange();
      this.input.focus();
    });
    this.resize = new ResizeObserver(() => this.syncScroll());
    this.resize.observe(this.input);
    window.addEventListener('beforeprint', () => this.mirror.removeAttribute('aria-hidden'));
    window.addEventListener('afterprint', () => this.mirror.setAttribute('aria-hidden', 'true'));
    this.refresh();
  }

  get value() { return this.input.value; }

  refresh() {
    this.code.replaceChildren(highlight(this.value));
    this.input.rows = Math.max(4, Math.min(24, this.value.split('\n').length));
    this.reset.disabled = this.value === this.original;
    this.syncScroll();
  }

  syncScroll() {
    this.mirror.style.width = this.input.clientWidth + 'px';
    this.mirror.style.height = this.input.clientHeight + 'px';
    this.pre.style.transform = `translate(${-this.input.scrollLeft}px, ${-this.input.scrollTop}px)`;
  }

  setBusy(busy) {
    this.input.readOnly = busy;
    this.reset.disabled = busy || this.value === this.original;
  }
}
