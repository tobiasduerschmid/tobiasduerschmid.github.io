/** Capture supplied argument syntax, never evaluate learner expressions.
 * Only direct, saturated calls in an unambiguous lexical scope are annotated.
 * Everything else retains the runtime's ordinary lazy observations.
 */
(function (scope) {
  'use strict';
  const endOf = token => token.offset + token.text.length;
  const keywords = new Set(['if', 'then', 'else', 'case', 'of', 'let', 'in', 'do', 'where']);

  function parts(tokens, delimiter) {
    const depth = tokens[0]?.depth;
    const result = [[]];
    for (const token of tokens) {
      if (token.depth === depth && token.text === delimiter) result.push([]);
      else result.at(-1).push(token);
    }
    return result;
  }

  function expression(tokens, source, bindings, budget = 80) {
    if (!tokens.length) return { kind: 'expression', text: '' };
    const text = source.slice(tokens[0].offset, endOf(tokens.at(-1))).trim();
    const fallback = { kind: 'expression', text: text.length > 240 ? text.slice(0, 237) + '…' : text };
    if (budget <= 0) return fallback;
    if (tokens.length === 1 && bindings[tokens[0].text]) return { kind: 'reference', path: bindings[tokens[0].text], text };
    if (tokens[0].text === '(' && tokens.at(-1).text === ')' && tokens.slice(1, -1).every(t => t.depth > tokens[0].depth)) {
      const inner = tokens.slice(1, -1);
      if (!inner.length) return fallback;
      const tuple = parts(inner, ',');
      if (tuple.length === 2) return { kind: 'pair', items: tuple.map(p => expression(p, source, bindings, budget - 1)) };
      if (tuple.length === 1) return expression(inner, source, bindings, budget - 1);
    }
    if (tokens[0].text === '[' && tokens.at(-1).text === ']' && tokens.slice(1, -1).every(t => t.depth > tokens[0].depth)) {
      const inner = tokens.slice(1, -1);
      if (!inner.length) return { kind: 'list', items: [] };
      if (!inner.some(t => ['|', '..'].includes(t.text))) {
        const items = parts(inner, ',');
        if (items.length <= 40) return { kind: 'list', items: items.map(p => expression(p, source, bindings, budget - 1)) };
      }
    }
    return fallback;
  }

  function atomEnd(tokens, index) {
    const token = tokens[index];
    if (!token || keywords.has(token.text)) return index;
    if (['(', '['].includes(token.text)) {
      let end = index + 1;
      while (end < tokens.length && tokens[end].depth > token.depth) end++;
      return end < tokens.length ? end + 1 : index;
    }
    if (/^(?:[A-Za-z_]|\d|["'])/.test(token.text)) {
      const following = tokens[index + 1];
      // The shared tokenizer intentionally splits some numeric extensions
      // (e.g. 1e3 and 0xff). Never insert a boundary inside such a lexeme.
      if (following?.offset === endOf(token) && /^[A-Za-z_0-9#]/.test(following.text)) return index;
      // Record construction/update binds to the preceding atom; leave it opaque.
      if (tokens[index + 1]?.text === '{') {
        let end = index + 2;
        while (end < tokens.length && tokens[end].depth > tokens[index + 1].depth) end++;
        return end < tokens.length ? end + 1 : index;
      }
      return index + 1;
    }
    return index;
  }

  function find(tokens, source, functions, bindings) {
    const where = tokens.findIndex(t => t.text === 'where');
    const body = where < 0 ? tokens : tokens.slice(0, where);
    // These constructs introduce scopes requiring a full name resolver. Do not
    // accidentally label a shadowing local function as a top-level invocation.
    if (body.some(t => ['let', 'case', '\\', '<-'].includes(t.text))) return [];
    const localNames = new Set(where < 0 ? [] : tokens.slice(where + 1).map(t => t.text));
    const calls = [];
    for (let i = 0; i < body.length; i++) {
      const callee = body[i];
      const arity = functions.get(callee.text);
      if (!arity || Object.hasOwn(bindings, callee.text) || localNames.has(callee.text)) continue;
      const previous = body[i - 1];
      // Application associates to the left: in `map f xs`, f is an argument,
      // not the head of `f xs`. Parentheses/operators start a fresh expression.
      if (previous && !keywords.has(previous.text) && (/^(?:[A-Za-z_]|\d|["'])/.test(previous.text) || /^[)\]}]$/.test(previous.text))) continue;
      const args = [];
      let cursor = i + 1;
      while (args.length < arity) {
        if (body[cursor]?.line > callee.line && body[cursor].indent <= callee.indent) break;
        const end = atomEnd(body, cursor);
        if (end === cursor) break;
        args.push(expression(body.slice(cursor, end), source, bindings));
        cursor = end;
      }
      if (args.length === arity) calls.push({ start: callee.offset, end: endOf(body[cursor - 1]), callee: callee.text, arguments: args });
    }
    return calls;
  }

  const api = { find };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.SEBookHaskellCallSites = api;
})(globalThis);
