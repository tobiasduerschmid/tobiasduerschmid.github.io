/** Discover direct where bindings without evaluating source or guessing types.
 * Inferred observer types require the same proven type at every use of a local;
 * specializing one use of a polymorphic binding would change valid programs.
 */
(function (scope) {
  'use strict';
  const identifier = text => /^[a-z_][A-Za-z0-9_']*$/.test(text) && text !== '_';
  const endOf = token => token.offset + token.text.length;
  const scopes = new Set(['let', 'where', 'case', 'of', 'do', '\\', '<-']);
  const arithmetic = new Set(['+', '-', '*', '/']);
  const operators = /^[!#$%&*+.\/<=>?@\\^|:~`-]/;

  function unparen(tokens) {
    while (tokens[0]?.text === '(' && tokens.at(-1)?.text === ')' &&
        tokens.slice(1, -1).every(token => token.depth > tokens[0].depth)) tokens = tokens.slice(1, -1);
    return tokens;
  }

  function declarations(tokens) {
    if (!tokens.length || tokens[0].text === '{') return [];
    const first = tokens[0], blocks = [];
    let previousLine = 0;
    for (const token of tokens) {
      if (token.depth === first.depth && token.indent < first.indent) return [];
      if (!blocks.length || token.line !== previousLine && token.depth === first.depth && token.indent === first.indent) blocks.push([]);
      blocks.at(-1).push(token);
      previousLine = token.line;
    }
    return blocks;
  }

  function signature(block) {
    const colon = block.findIndex(token => token.text === '::' && token.depth === block[0].depth);
    if (colon < 0) return null;
    const names = block.slice(0, colon);
    if (!names.length || names.some((token, i) => i % 2 ? token.text !== ',' : !identifier(token.text))) return null;
    if (names.length % 2 === 0 || colon + 1 === block.length) return null;
    return { names: names.filter((_, i) => i % 2 === 0).map(token => token.text), type: block.slice(colon + 1) };
  }

  function binding(block, source) {
    if (!identifier(block[0].text) || block[1]?.text !== '=' || block.length < 3) return null;
    const rhs = block.slice(2);
    if (rhs.some(token => scopes.has(token.text) || token.text === ';')) return null;
    const expression = source.slice(rhs[0].offset, endOf(rhs.at(-1))).trim();
    return { name: block[0].text, line: block[0].line, rhs,
      expression: expression.length > 240 ? expression.slice(0, 237) + '…' : expression };
  }

  // Only branches share an if expression's result type. Its condition does not.
  function branches(tokens) {
    if (tokens[0]?.text !== 'if') return null;
    let nested = 0, then = -1;
    for (let i = 1; i < tokens.length; i++) {
      if (tokens[i].depth !== tokens[0].depth) continue;
      const text = tokens[i].text;
      if (text === 'if') nested++;
      else if (text === 'else' && nested) nested--;
      else if (text === 'then' && !nested && then < 0) then = i;
      else if (text === 'else' && !nested && then >= 0) return [tokens.slice(then + 1, i), tokens.slice(i + 1)];
    }
    return null;
  }

  /** Record type equality only through parentheses, branches and ordinary
   * homogeneous arithmetic. Applications and other operators are opaque.
   */
  function hintUses(tokens, type, hints, names, allowArithmetic, budget = 80) {
    tokens = unparen(tokens);
    if (!tokens.length || budget <= 0) return;
    if (tokens.length === 1 && names.has(tokens[0].text)) {
      hints.set(tokens[0].offset, type);
      return;
    }
    const alternatives = branches(tokens);
    if (alternatives) {
      alternatives.forEach(part => hintUses(part, type, hints, names, allowArithmetic, budget - 1));
      return;
    }
    if (!allowArithmetic || tokens.some(token => ['if', 'then', 'else'].includes(token.text))) return;
    const outer = tokens.filter(token => token.depth === tokens[0].depth);
    if (outer.some(token => operators.test(token.text) && !arithmetic.has(token.text))) return;
    const positions = tokens.map((token, i) => token.depth === tokens[0].depth && arithmetic.has(token.text) ? i : -1).filter(i => i >= 0);
    if (!positions.length) return;
    const boundaries = [-1, ...positions, tokens.length];
    // Prefix negation and operator sections are deliberately outside this proof.
    if (boundaries.some((index, i) => i && index === boundaries[i - 1] + 1)) return;
    for (let i = 1; i < boundaries.length; i++) hintUses(tokens.slice(boundaries[i - 1] + 1, boundaries[i]), type, hints, names, allowArithmetic, budget - 1);
  }

  const typeKey = tokens => tokens.map(token => token.text).join(' ');
  const concrete = tokens => tokens?.length && !tokens.some(token => identifier(token.text) || ['=>', '->'].includes(token.text));

  /** Return supported equation-level layout declarations with original RHS
   * token offsets. Unsupported scopes stay uninstrumented. The caller decides
   * whether imports/top-level definitions leave Prelude arithmetic unshadowed.
   */
  function analyze(eq, source, resultTypeTokens, allowPreludeOperators) {
    const delimiter = eq.block.indexOf(eq.delimiter);
    const where = eq.block.findIndex((token, i) => i > delimiter && token.depth === eq.delimiter.depth && token.text === 'where');
    if (where < 0 || eq.block.slice(delimiter + 1, where).some(token => scopes.has(token.text))) return [];
    const blocks = declarations(eq.block.slice(where + 1));
    if (blocks.length > 128) return [];
    const signatures = new Map(), excluded = new Set(), locals = [];
    let allowArithmetic = allowPreludeOperators;
    for (const block of blocks) {
      const colonOrEquals = block.findIndex(token => ['::', '='].includes(token.text) && token.depth === block[0].depth);
      const header = colonOrEquals < 0 ? block : block.slice(0, colonOrEquals);
      if (header.some(token => arithmetic.has(token.text)) || /^infix/.test(block[0].text)) allowArithmetic = false;
      const declaredType = signature(block);
      if (declaredType) {
        declaredType.names.forEach(name => signatures.set(name, declaredType.type));
        block.forEach(token => excluded.add(token.offset));
        continue;
      }
      const local = binding(block, source);
      if (local) {
        locals.push(local);
        excluded.add(block[0].offset);
      }
    }
    const counts = new Map();
    locals.forEach(local => counts.set(local.name, (counts.get(local.name) || 0) + 1));
    const names = new Set(counts.keys());
    // Duplicate definitions are not a single nullary binding to instrument.
    const unique = locals.filter(local => counts.get(local.name) === 1);
    const references = new Map([...names].map(name => [name, []]));
    for (const token of eq.block.slice(delimiter + 1)) {
      if (names.has(token.text) && !excluded.has(token.offset)) references.get(token.text).push(token);
    }
    const hints = new Map();
    for (const local of unique) {
      if (signatures.has(local.name)) local.typeTokens = signatures.get(local.name);
    }
    // A rebindable ifThenElse need not give its two branches the result type.
    if (/\bRebindableSyntax\b/.test(source)) return unique;
    if (concrete(resultTypeTokens)) {
      eq.rhss.forEach((rhs, i) => {
        const start = eq.block.indexOf(rhs.equals) + 1;
        const next = eq.rhss[i + 1];
        const end = next ? eq.block.indexOf(next.guard[0]) - 1 : where;
        hintUses(eq.block.slice(start, end), resultTypeTokens, hints, names, allowArithmetic);
      });
    }
    // A proved binding can establish the type of an alias or branch inside its
    // RHS. Missing or conflicting use-site evidence always leaves it opaque.
    for (let pass = 0; pass <= unique.length; pass++) {
      let changed = false;
      for (const local of unique) {
        if (!local.typeTokens) {
          const uses = references.get(local.name);
          const type = uses.length && hints.get(uses[0].offset);
          if (type && uses.every(token => hints.has(token.offset) && typeKey(hints.get(token.offset)) === typeKey(type))) {
            local.typeTokens = type;
            changed = true;
          }
        }
        if (concrete(local.typeTokens)) hintUses(local.rhs, local.typeTokens, hints, names, allowArithmetic);
      }
      if (!changed && pass > 0) break;
    }
    return unique;
  }

  const api = { analyze };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.SEBookHaskellLocalBindings = api;
})(globalThis);
