/** Python presentation for the reference lab. The native textarea owns editing,
 * selection, undo, IME, and accessibility; an inert mirror owns syntax and the
 * execution marker. Neither highlighting nor playback rewrites the input. */
(function () {
  'use strict';
  if (window.ObjectReferenceCode) return;

  const keywords = new Set(('False None True and as assert async await break class continue def del elif else '
    + 'except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield').split(' '));
  const builtins = new Set(('abs all any bool dict enumerate filter float id input int isinstance iter len list map '
    + 'max min next object open print range repr reversed round set sorted str sum super tuple type zip').split(' '));
  // This is a lexical aid, not a Python parser. Incomplete strings remain
  // colored while typing; f-string contents deliberately stay string-colored.
  const pattern = /(#[^\n]*)|((?:[rRbBfFuU]{1,2})?(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\[\s\S]|[^"\\\n])*(?:"|(?=\n)|$)|'(?:\\[\s\S]|[^'\\\n])*(?:'|(?=\n)|$)))|(\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?[\d_]+)?j?))|([A-Za-z_]\w*)/g;

  function tokens(source) {
    const result = [];
    let end = 0;
    for (const match of source.matchAll(pattern)) {
      if (match.index > end) result.push({ text: source.slice(end, match.index) });
      const kind = match[1] ? 'comment' : match[2] ? 'string' : match[3] ? 'number'
        : keywords.has(match[0]) ? 'keyword' : builtins.has(match[0]) ? 'builtin' : '';
      result.push({ text: match[0], kind });
      end = match.index + match[0].length;
    }
    if (end < source.length) result.push({ text: source.slice(end) });
    return result;
  }

  function tokenNode(text, kind) {
    if (!kind) return document.createTextNode(text);
    const span = document.createElement('span');
    span.className = 'orl-syntax-' + kind;
    span.textContent = text;
    return span;
  }

  function highlight(source) {
    const fragment = document.createDocumentFragment();
    tokens(source).forEach(token => fragment.append(tokenNode(token.text, token.kind)));
    return fragment;
  }

  function node(tag, className) {
    const result = document.createElement(tag);
    result.className = className;
    return result;
  }

  class Editor {
    constructor(host, { id, describedBy, rows, onInput }) {
      this.host = host;
      this.listeners = new AbortController();
      const header = node('div', 'orl-code-header');
      const label = node('label', 'orl-editor-label');
      label.htmlFor = id;
      label.textContent = 'Python code';
      this.position = node('span', 'orl-code-position');
      // The live status describes execution to assistive technology once.
      this.position.setAttribute('aria-hidden', 'true');
      header.append(label, this.position);

      const body = node('div', 'orl-code-body');
      const gutter = node('div', 'orl-code-gutter');
      gutter.setAttribute('aria-hidden', 'true');
      gutter.inert = true;
      this.numbers = node('div', 'orl-line-numbers');
      gutter.append(this.numbers);
      const inputArea = node('div', 'orl-code-input');
      this.viewport = node('div', 'orl-code-mirror');
      this.viewport.setAttribute('aria-hidden', 'true');
      this.viewport.inert = true;
      this.source = node('pre', 'orl-highlighted-source');
      this.viewport.append(this.source);
      this.input = node('textarea', 'orl-editor');
      this.input.id = id;
      this.input.setAttribute('aria-describedby', describedBy);
      this.input.setAttribute('autocapitalize', 'off');
      this.input.spellcheck = false;
      this.input.autocomplete = 'off';
      this.input.wrap = 'off';
      this.input.rows = rows;
      inputArea.append(this.viewport, this.input);
      body.append(gutter, inputArea);
      host.append(header, body);

      this.input.addEventListener('input', () => { this.refresh(); onInput(); }, { signal: this.listeners.signal });
      this.input.addEventListener('scroll', () => this.syncScroll(), { signal: this.listeners.signal });
      this.resize = new ResizeObserver(() => this.syncScroll());
      this.resize.observe(this.input);
    }

    refresh() {
      this.source.replaceChildren();
      this.numbers.replaceChildren();
      let line;
      const appendLine = () => {
        line = node('span', 'orl-source-line');
        this.source.append(line);
        const number = node('span', 'orl-line-number');
        number.textContent = String(this.source.children.length);
        this.numbers.append(number);
      };
      appendLine();
      tokens(this.input.value).forEach(token => {
        token.text.split('\n').forEach((part, index) => {
          if (index) appendLine();
          if (part) line.append(tokenNode(part, token.kind));
        });
      });
      // Empty lines still occupy one textarea line, including a final newline.
      for (const row of this.source.children) if (!row.textContent) row.textContent = ' ';
      this.setPosition(0, 'Edit and trace');
      this.syncScroll();
    }

    setPosition(lineNumber, label, { reveal = true } = {}) {
      this.position.textContent = label;
      [this.source, this.numbers].forEach(parent => {
        Array.from(parent.children).forEach((line, index) => line.classList.toggle('is-current', index + 1 === lineNumber));
      });
      const line = this.source.children[lineNumber - 1];
      if (line && reveal) {
        const top = line.offsetTop;
        const bottom = top + line.offsetHeight;
        if (top < this.input.scrollTop) this.input.scrollTop = top;
        else if (bottom > this.input.scrollTop + this.input.clientHeight) this.input.scrollTop = bottom - this.input.clientHeight;
      }
      this.syncScroll();
    }

    syncScroll() {
      // Use the input's content viewport, excluding native scrollbars. This
      // keeps long lines, resized editors, and enlarged text exactly aligned.
      this.viewport.style.width = this.input.clientWidth + 'px';
      this.viewport.style.height = this.input.clientHeight + 'px';
      this.source.style.transform = `translate(${-this.input.scrollLeft}px, ${-this.input.scrollTop}px)`;
      this.numbers.style.transform = `translateY(${-this.input.scrollTop}px)`;
    }

    destroy() {
      this.listeners.abort();
      this.resize.disconnect();
    }
  }

  window.ObjectReferenceCode = { Editor, highlight };
}());
