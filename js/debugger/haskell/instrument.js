/** Instrument source equations, leaving matching and evaluation to MicroHs.
 * Each equation becomes a local alternative with its original patterns and
 * where scope. A fallback records failure before trying the next alternative.
 * Lazy observers report only demand caused by the learner's computation.
 */
(function (scope) {
  'use strict';
  const syntax = typeof module !== 'undefined' && module.exports
    ? require('../../haskell/syntax') : scope.SEBookHaskellSyntax;
  const callSites = typeof module !== 'undefined' && module.exports
    ? require('./call-sites') : scope.SEBookHaskellCallSites;
  const DECLARATIONS = new Set(['module', 'import', 'data', 'newtype', 'type',
    'class', 'instance', 'infix', 'infixl', 'infixr', 'foreign', 'default', 'deriving']);
  const variable = text => /^[a-z_][A-Za-z0-9_']*$/.test(text) && text !== '_';
  const endOf = token => token.offset + token.text.length;
  const quoted = value => JSON.stringify(value);

  function blocksFor(tokens) {
    const blocks = [];
    const column = tokens[0]?.indent;
    let line = 0;
    for (const token of tokens) {
      if (!blocks.length || (token.line !== line && token.depth === 0 && token.indent === column)) blocks.push([]);
      blocks.at(-1).push(token);
      line = token.line;
    }
    return blocks;
  }

  // Split at the outer level, preserving nested list, tuple and function types.
  function split(tokens, delimiter) {
    const depth = tokens[0]?.depth || 0;
    const parts = [[]];
    for (const token of tokens) {
      if (token.depth === depth && token.text === delimiter) parts.push([]);
      else parts.at(-1).push(token);
    }
    return parts;
  }

  function unparen(tokens) {
    if (tokens[0]?.text === '(' && tokens.at(-1)?.text === ')' &&
        tokens.slice(1, -1).every(t => t.depth > tokens[0].depth)) return tokens.slice(1, -1);
    return tokens;
  }

  function observerFor(tokens, shadowed) {
    const unknown = 'SEBookTrace.opaque';
    if (!tokens?.length) return unknown;
    if (tokens[0].text === '[' && tokens.at(-1).text === ']') {
      return '(SEBookTrace.list ' + observerFor(tokens.slice(1, -1), shadowed) + ')';
    }
    const inner = unparen(tokens);
    if (inner !== tokens) {
      const parts = split(inner, ',');
      if (parts.length === 2) return '(SEBookTrace.pair ' + parts.map(p => observerFor(p, shadowed)).join(' ') + ')';
      if (parts.length === 1) return observerFor(inner, shadowed);
      return unknown;
    }
    if (tokens[0].text === 'Maybe' && !shadowed.has('Maybe') && tokens.length > 1) {
      return '(SEBookTrace.optional ' + observerFor(tokens.slice(1), shadowed) + ')';
    }
    const name = tokens[0].text;
    if (tokens.length !== 1 || shadowed.has(name)) return unknown;
    if (name === 'String') return '(SEBookTrace.list SEBookTrace.char)';
    const primitives = { Int: 'int', Word: 'word', Bool: 'bool', Char: 'char', Float: 'float', Double: 'double' };
    return primitives[name] ? 'SEBookTrace.' + primitives[name] : unknown;
  }

  function argumentPatterns(tokens) {
    const result = [];
    let i = 0;
    function atom() {
      const start = i;
      if (['!', '~', '-'].includes(tokens[i]?.text)) i++;
      if (variable(tokens[i]?.text || '') && tokens[i + 1]?.text === '@') { i += 2; atom(); }
      else if (['(', '[', '{'].includes(tokens[i]?.text)) {
        const depth = tokens[i++].depth;
        while (i < tokens.length && tokens[i].depth > depth) i++;
        i++;
      } else {
        i++;
        if (tokens[i]?.text === '{') {
          const depth = tokens[i++].depth;
          while (i < tokens.length && tokens[i].depth > depth) i++;
          i++;
        }
      }
      return tokens.slice(start, i);
    }
    while (i < tokens.length) result.push(atom());
    return result;
  }

  function patternBindings(tokens, path, output = {}) {
    const pattern = unparen(tokens);
    if (pattern.length === 1 && variable(pattern[0].text)) output[pattern[0].text] = path;
    else if (pattern[1]?.text === '@' && variable(pattern[0].text)) {
      output[pattern[0].text] = path;
      patternBindings(pattern.slice(2), path, output);
    } else {
      const cons = split(pattern, ':');
      const tuple = split(pattern, ',');
      if (cons.length > 1) {
        patternBindings(cons[0], path + '.h', output);
        const tailStart = pattern.indexOf(cons[1][0]);
        patternBindings(pattern.slice(tailStart), path + '.t', output);
      } else if (tuple.length === 2) {
        tuple.forEach((part, i) => patternBindings(part, path + '.' + i, output));
      } else if (pattern[0]?.text === '[' && pattern.at(-1)?.text === ']') {
        split(pattern.slice(1, -1), ',').forEach((part, i) => patternBindings(part, path + '.t'.repeat(i) + '.h', output));
      } else if (pattern[0]?.text === 'Just') patternBindings(pattern.slice(1), path + '.0', output);
      else for (let i = 0; i < pattern.length; i++) {
        if (pattern[i].text === '::') break;
        if (variable(pattern[i].text) && pattern[i + 1]?.text !== '=') output[pattern[i].text] = null;
      }
    }
    return output;
  }

  function parseEquation(block, source, filename) {
    const first = block[0];
    if (DECLARATIONS.has(first.text)) return null;
    const outer = block.filter(t => t.depth === 0);
    const delimiter = outer.find(t => ['=', '|', '::'].includes(t.text));
    if (!delimiter || delimiter.text === '::') return null;
    if (!variable(first.text)) throw new Error('Haskell debugger supports named prefix equations at ' + filename + ':' + first.line + '.');
    const header = block.slice(1, block.indexOf(delimiter));
    if (header.some(t => t.depth === 0 && (t.text.startsWith('`') || /^[!#$%&*+.\/<=>?\\^|:~-]+$/.test(t.text) && !['!', '~', '-'].includes(t.text)))) {
      throw new Error('Haskell debugger supports named prefix equations at ' + filename + ':' + first.line + '.');
    }
    if (outer.some(t => t.text === ';')) throw new Error('Haskell debugger does not support semicolon declarations; put declarations on separate lines.');
    const patterns = argumentPatterns(header);
    const rhss = [];
    if (delimiter.text === '=') rhss.push({ equals: delimiter, line: first.line });
    else {
      const guardColumn = delimiter.indent;
      for (let i = outer.indexOf(delimiter); i < outer.length; i++) {
        if (outer[i].text === 'where') break;
        if (outer[i].text !== '|' || (outer[i] !== delimiter && outer[i].indent > guardColumn)) continue;
        const start = i;
        while (++i < outer.length && !['=', '|', '->'].includes(outer[i].text)) { /* guard */ }
        if (outer[i]?.text !== '=') continue;
        const condition = block.slice(block.indexOf(outer[start]) + 1, block.indexOf(outer[i]));
        if (condition.some(t => ['let', '<-', ','].includes(t.text) && t.depth === 0)) throw new Error('Haskell debugger supports Boolean guards, not pattern guards.');
        rhss.push({ equals: outer[i], line: outer[start].line, guard: condition });
      }
    }
    return { name: first.text, first, block, patterns, delimiter, rhss,
      header: source.slice(first.offset, delimiter.offset).trim(),
      bindings: Object.assign({}, ...patterns.map((p, i) => patternBindings(p, 'arg' + i))) };
  }

  /** Edits may supply a per-line source map for generated declarations. */
  function applyEdits(source, edits) {
    let code = '', cursor = 0, originalLine = 1;
    const lineMap = [null, 1];
    function append(text, mapped) {
      code += text;
      let index = 1;
      for (const ch of text) if (ch === '\n') {
        if (!mapped) originalLine++;
        lineMap.push(mapped ? mapped[++index] || originalLine : originalLine);
      }
    }
    for (const edit of edits.sort((a, b) => a.offset - b.offset)) {
      append(source.slice(cursor, edit.offset));
      append(edit.text, edit.lineMap || [null, originalLine]);
      const end = edit.end ?? edit.offset;
      originalLine += (source.slice(edit.offset, end).match(/\n/g) || []).length;
      cursor = end;
    }
    append(source.slice(cursor));
    return { code, lineMap };
  }

  function instrument(source, filename, firstId = 0) {
    const tokens = syntax.tokenize(source);
    if (tokens.some(t => t.text === 'SEBookTrace' || t.text.startsWith('_sebook'))) throw new Error('The Haskell debugger reserves SEBookTrace and names starting with _sebook.');
    let body = tokens, importOffset = tokens[0]?.offset || 0;
    if (tokens[0]?.text === 'module') {
      const where = tokens.findIndex(t => t.text === 'where' && t.depth === 0);
      if (where < 0) throw new Error('Haskell debugger requires a complete module declaration.');
      if (tokens[where + 1]?.text === '{') throw new Error('Haskell debugger does not support explicit module braces.');
      body = tokens.slice(where + 1);
      importOffset = endOf(tokens[where]);
    }
    const blocks = blocksFor(body);
    const signatures = new Map(), shadowed = new Set();
    for (const block of blocks) {
      if (['data', 'newtype', 'type'].includes(block[0].text)) shadowed.add(block.slice(1).find(t => /^[A-Z]/.test(t.text))?.text);
      // An explicit Prelude import can hide or rename its types. Fall back to
      // opaque observations rather than imposing our Prelude types on source.
      if (block[0].text === 'import' && block.some(t => t.text === 'Prelude')) {
        ['Int', 'Word', 'Bool', 'Char', 'Float', 'Double', 'String', 'Maybe'].forEach(name => shadowed.add(name));
      }
      const colon = block.findIndex(t => t.text === '::' && t.depth === 0);
      if (colon >= 0 && !DECLARATIONS.has(block[0].text)) {
        let type = block.slice(colon + 1);
        const context = type.findIndex(t => t.text === '=>' && t.depth === 0);
        if (context >= 0) type = type.slice(context + 1);
        for (const token of block.slice(0, colon)) if (variable(token.text)) signatures.set(token.text, split(type, '->'));
      }
    }
    if (/\bNoImplicitPrelude\b/.test(source)) {
      ['Int', 'Word', 'Bool', 'Char', 'Float', 'Double', 'String', 'Maybe'].forEach(name => shadowed.add(name));
    }
    const groups = [];
    for (const block of blocks) {
      const equation = parseEquation(block, source, filename);
      if (!equation) continue;
      if (groups.at(-1)?.[0].name === equation.name) groups.at(-1).push(equation);
      else groups.push([equation]);
    }
    const functions = new Map(groups.map(equations => [equations[0].name, equations[0].patterns.length]));
    const sites = [], edits = [];
    function site(equation, extra = {}) {
      const value = { id: firstId + sites.length, function: equation.name, file: filename,
        line: equation.first.line, first_line: equation.first.line,
        bindings: equation.bindings, ...extra };
      sites.push(value);
      return value;
    }
    for (const equations of groups) {
      const first = equations[0], last = equations.at(-1);
      const arity = first.patterns.length;
      if (equations.some(eq => eq.patterns.length !== arity)) throw new Error('Equations for ' + first.name + ' must have the same number of arguments.');
      const types = signatures.get(first.name) || [];
      const entry = site(first, { kind: 'entry', arity, argument_types: types.slice(0, arity).map(ts => source.slice(ts[0].offset, endOf(ts.at(-1)))), result_type: types.slice(arity).map(part => part.map(t => t.text).join(' ')).join(' -> ') });
      entry.equations = equations.map((eq, i) => {
        eq.site = site(eq, { kind: 'equation', index: i, header: eq.header });
        return { id: eq.site.id, line: eq.first.line, header: eq.header };
      });
      const raw = Array.from({ length: arity }, (_, i) => '_sebookRaw' + i);
      const args = raw.map((_, i) => '_sebookArg' + i);
      const context = '_sebookContext';
      const callArgs = args.length ? ' ' + args.join(' ') : '';
      const rows = [], mapping = [null];
      const base = ' '.repeat(first.first.indent - 1);
      function add(text, line) {
        text.split('\n').forEach(part => { rows.push((rows.length ? base : '') + part); mapping.push(line); });
      }
      add(first.name + (raw.length ? ' ' + raw.join(' ') : '') + ' = SEBookTrace.call ' + entry.id + ' ' + observerFor(types.length === arity + 1 ? types[arity] : null, shadowed) + ' SEBookTrace.$ \\' + context + ' ->', first.first.line);
      add('  let', first.first.line);
      raw.forEach((name, i) => {
        let observer = observerFor(types[i], shadowed);
        // A list pattern gives a sound structural observer even without a signature.
        if (!types[i] && equations.some(eq => {
          const pattern = unparen(eq.patterns[i]);
          return pattern[0]?.text === '[' || split(pattern, ':').length > 1;
        })) observer = '(SEBookTrace.list SEBookTrace.opaque)';
        add('    ' + args[i] + ' = ' + observer + ' ' + context + ' "arg' + i + '" ' + name, first.first.line);
      });
      equations.forEach((eq, i) => {
        const next = i + 1 < equations.length ? '_sebookTry' + (i + 1) : 'SEBookTrace.noMatch ' + quoted(first.name);
        add('    _sebookTry' + i + ' = SEBookTrace.step "try" ' + eq.site.id + ' ' + context + ' SEBookTrace.$ _sebookChoose' + i + callArgs, eq.first.line);
        const start = eq.first.offset, end = endOf(eq.block.at(-1));
        const localEdits = [{ offset: 0, end: eq.first.text.length, text: '_sebookChoose' + i }];
        for (const call of callSites.find(eq.block.slice(eq.block.indexOf(eq.delimiter) + 1), source, functions, eq.bindings)) {
          const application = site(eq, { kind: 'application', callee: call.callee, arguments: call.arguments });
          localEdits.push({ offset: call.start - start, text: '(SEBookTrace.application ' + application.id + ' ' + context + ' (' });
          localEdits.push({ offset: call.end - start, text: '))' });
        }
        for (const rhs of eq.rhss) {
          let selectedSite = eq.site;
          if (rhs.guard) {
            selectedSite = site(eq, { kind: 'body', line: rhs.line, equation: eq.site.id, index: i, header: eq.header });
            const guardSite = site(eq, { kind: 'guard', line: rhs.line, equation: eq.site.id,
              expression: source.slice(rhs.guard[0].offset, endOf(rhs.guard.at(-1))).trim() });
            localEdits.push({ offset: rhs.guard[0].offset - start, text: 'SEBookTrace.condition ' + guardSite.id + ' ' + context + ' (' });
            localEdits.push({ offset: endOf(rhs.guard.at(-1)) - start, text: ')' });
          }
          localEdits.push({ offset: endOf(rhs.equals) - start, text: ' SEBookTrace.step "select" ' + selectedSite.id + ' ' + context + ' SEBookTrace.$\n' + ' '.repeat(rhs.equals.indent) });
        }
        if (eq.delimiter.text === '|') localEdits.push({ offset: eq.delimiter.offset - start,
          text: '| SEBookTrace.matched ' + eq.site.id + ' ' + context + ' = SEBookTrace.noMatch "debugger guard"\n' + ' '.repeat(eq.delimiter.indent - 1) });
        // Record if tests, including local where expressions, in their lexical scope.
        const pending = [];
        for (const token of eq.block.slice(eq.block.indexOf(eq.delimiter) + 1)) {
          if (token.text === 'if' && !/\bRebindableSyntax\b/.test(source)) pending.push(token);
          if (token.text === 'then' && pending.length) {
            const begin = pending.pop();
            const conditional = site(eq, { kind: 'condition', line: begin.line, equation: eq.site.id,
              expression: source.slice(endOf(begin), token.offset).trim() });
            localEdits.push({ offset: endOf(begin) - start, text: ' SEBookTrace.condition ' + conditional.id + ' ' + context + ' (' });
            localEdits.push({ offset: token.offset - start, text: ') ' });
          }
        }
        const local = applyEdits(source.slice(start, end), localEdits);
        local.code.split('\n').forEach((line, lineIndex) => {
          // Expand indentation only. Literal tabs remain literal tabs.
          const expanded = line.replace(/^[ \t]+/, whitespace => {
            let col = 0; for (const ch of whitespace) col += ch === '\t' ? 8 - col % 8 : 1;
            return ' '.repeat(Math.max(0, col - (lineIndex ? first.first.indent - 1 : 0)));
          });
          add('    ' + expanded, eq.first.line + local.lineMap[lineIndex + 1] - 1);
        });
        if (arity) add('    _sebookChoose' + i + ' ' + raw.map(() => '_').join(' ') + ' = SEBookTrace.step "reject" ' + eq.site.id + ' ' + context + ' SEBookTrace.$ ' + next, eq.first.line);
      });
      add('  in _sebookTry0', first.first.line);
      edits.push({ offset: first.first.offset, end: endOf(last.block.at(-1)), text: rows.join('\n'), lineMap: mapping });
    }
    if (sites.length) {
      const indentation = ' '.repeat(body[0].indent - 1);
      const explicitModule = tokens[0]?.text === 'module';
      const inline = explicitModule && body[0].line === tokens.find(t => t.text === 'where').line;
      edits.push({ offset: importOffset, text: (explicitModule ? '\n' + indentation : '') + 'import qualified SEBookDebug as SEBookTrace\n' + (inline ? ' '.repeat(Math.max(0, body[0].indent - 1 - (body[0].offset - importOffset))) : '') });
    }
    return { ...applyEdits(source, edits), sites };
  }
  const api = { instrument };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.SEBookHaskellInstrument = api;
})(globalThis);
