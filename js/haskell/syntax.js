/** Shared bounded Haskell tokenization/layout for source analyses; no evaluation. */
(function (root) {
  'use strict';
  class UnsupportedSyntax extends Error {}
  // Preserve UTF-16 editor positions separately from Haskell's 8-column tabs.
  function tokenize(source) {
    const tokens = [];
    let i = 0, line = 1, column = 1, indent = 1, depth = 0;
    function advance(end) {
      while (i < end) {
        const c = source[i++];
        if (c === '\n') { line++; column = indent = 1; }
        else { column++; indent += c === '\t' ? 8 - ((indent - 1) % 8) : 1; }
      }
    }
    while (i < source.length) {
      if (/\s/.test(source[i])) { advance(i + 1); continue; }
      if (source.startsWith('{-', i)) {
        let end = i + 2, nesting = 1;
        while (end < source.length && nesting) {
          if (source.startsWith('{-', end)) { nesting++; end += 2; }
          else if (source.startsWith('-}', end)) { nesting--; end += 2; }
          else end++;
        }
        advance(end); continue;
      }
      if (/^--+(?![!#$%&*+.\/<=>?@\\^|:~-])/.test(source.slice(i))) {
        const end = source.indexOf('\n', i);
        advance(end < 0 ? source.length : end); continue;
      }
      const start = i;
      let text;
      if (source[i] === '"' || source[i] === "'") {
        const quote = source[i];
        let end = i + 1;
        while (end < source.length) {
          if (source[end] === '\\') end += 2;
          else if (source[end++] === quote) break;
        }
        text = source.slice(i, end);
      } else {
        const match = source.slice(i).match(/^[A-Za-z_][\w']*(?:\.[A-Za-z_][\w']*)*|^\d+(?:\.\d+)?|^`[A-Za-z_][\w']*`|^[!#$%&*+.\/<=>?@\\^|:~-]+/);
        text = match ? match[0] : source[i];
      }
      if (/^[)\]}]$/.test(text)) depth--;
      tokens.push({ text, line, column, indent, depth, offset: start });
      if (/^[([{]$/.test(text)) depth++;
      advance(i + text.length);
      if (tokens.length > 12000) throw new UnsupportedSyntax('analysis budget');
    }
    return tokens;
  }

  // Insert the layout delimiters used by the supported declaration/expression
  // subset. Explicit braces remain ordinary tokens. Parsing failures are opaque.
  function layout(tokens, moduleBody = true) {
    const out = [], stack = [];
    let pending = moduleBody && tokens[0]?.text !== 'module' ? 'module' : null;
    let previousLine = 0;
    const close = token => { out.push({ ...token, text: '}' }); stack.pop(); };
    for (const token of tokens) {
      let opened = false;
      if (pending) {
        if (token.text !== '{') {
          out.push({ ...token, text: '{' });
          stack.push({ indent: token.indent, depth: token.depth, kind: pending });
          opened = true;
        }
        pending = null;
      }
      if (token.text === 'in' && stack.some(frame => frame.kind === 'let')) {
        while (stack.length) {
          const kind = stack.at(-1).kind;
          close(token);
          if (kind === 'let') break;
        }
      } else {
        while (stack.length && token.depth < stack.at(-1).depth) close(token);
        if (!opened && token.line > previousLine) {
          while (stack.length && token.depth === stack.at(-1).depth && token.indent < stack.at(-1).indent) close(token);
          if (stack.length && token.depth === stack.at(-1).depth && token.indent === stack.at(-1).indent) out.push({ ...token, text: ';' });
        }
      }
      out.push(token);
      if (['where', 'let', 'do', 'of'].includes(token.text)) pending = token.text;
      previousLine = token.line;
    }
    while (stack.length) close(tokens.at(-1));
    return out;
  }

  const api = { tokenize, layout, UnsupportedSyntax };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SEBookHaskellSyntax = api;
})(globalThis);
