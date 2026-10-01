/**
 * Conservative alias-cycle diagnostics, independent of Monaco and MicroHs.
 * This is a bounded syntax/demand analysis, not an evaluator or termination
 * checker. Unsupported syntax is opaque; unknown demand never blocks a run.
 */
(function (root) {
  'use strict';
  const identifier = /^[a-z_][\w']*$/;
  const stops = new Set([';', '}', ')', ']', ',', 'in', 'then', 'else', 'where', '=']);
  const precedence = { '$': 0, '>>': 1, '&&': 2, '||': 2, '==': 3, '/=': 3, '<': 3, '>': 3, '<=': 3, '>=': 3, ':': 4, '+': 5, '-': 5, '*': 6, '/': 6, '`seq`': 0 };
  const unknown = () => ({ kind: 'unknown' });
  const completeValue = node => node.kind === 'literal' || node.kind === 'boolean' || node.complete === true;
  class UnsupportedSyntax extends Error {}
  const scope = parent => ({ parent, bindings: new Map() });
  const opaqueBinding = { body: unknown(), parameters: [] };
  function resolve(env, name) {
    for (; env; env = env.parent) {
      if (env.bindings.has(name)) return env.bindings.get(name);
      if (env.opaque) return opaqueBinding;
    }
    return null;
  }

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

  class Parser {
    constructor(tokens) { this.tokens = tokens; this.i = 0; this.bindings = []; this.level = 0; }
    peek() { return this.tokens[this.i]?.text; }
    take(text) { if (this.peek() === text) { this.i++; return true; } return false; }
    need(text) { if (!this.take(text)) throw new UnsupportedSyntax('unsupported syntax'); }
    skipDeclaration() {
      let depth = 0;
      while (this.peek()) {
        const text = this.peek();
        if (!depth && (text === ';' || text === '}')) return;
        if (['{', '(', '['].includes(text)) depth++;
        if (['}', ')', ']'].includes(text)) depth--;
        this.i++;
      }
    }
    declarations(env) {
      this.need('{');
      while (this.peek() && this.peek() !== '}') {
        if (this.take(';')) continue;
        const start = this.i;
        const token = this.tokens[this.i++];
        if (['import', 'data', 'newtype', 'type', 'instance', 'class', 'infix', 'infixl', 'infixr', 'foreign', 'default'].includes(token.text)) {
          this.skipDeclaration(); continue;
        }
        if (!identifier.test(token.text)) throw new UnsupportedSyntax('unsupported binding pattern');
        const count = this.bindings.length;
        const level = this.level;
        try {
          this.declaration(env, token);
        } catch (error) {
          if (!(error instanceof UnsupportedSyntax)) throw error;
          // An unsupported equation is opaque, including any partially parsed
          // local scopes. It still shadows outer/imported names.
          this.bindings.length = count;
          env.bindings.set(token.text, { body: unknown(), parameters: [] });
          // An as-pattern or infix lhs can bind names other than its first
          // token. Do not accidentally resolve them to outer names/Prelude.
          let headerEnd = start + 1;
          while (headerEnd < this.tokens.length && !['=', '|', '::', ';', '}'].includes(this.tokens[headerEnd].text)) headerEnd++;
          const header = this.tokens.slice(start + 1, headerEnd);
          if (header.some(part => part.depth === token.depth && /^[!#$%&*+.\/<=>?@\\^|:~`-]/.test(part.text))) env.opaque = true;
          this.i = start; this.level = level; this.skipDeclaration();
        }
      }
      this.need('}');
    }
    declaration(env, token) {
        const parameters = [];
        while (identifier.test(this.peek() || '') && this.peek() !== 'where') parameters.push(this.tokens[this.i++].text);
        if (this.take('::')) { this.skipDeclaration(); return; }
        if (!this.take('=')) throw new UnsupportedSyntax('unsupported equation');
        const local = scope(env);
        parameters.forEach(name => local.bindings.set(name, { body: unknown(), parameters: [] }));
        const binding = { token, parameters, body: unknown() };
        // Multiple equations are intentionally opaque to demand analysis.
        const prior = env.bindings.get(token.text);
        env.bindings.set(token.text, prior ? { body: unknown(), parameters: [] } : binding);
        this.bindings.push(binding);
        binding.body = this.expression(local);
        if (this.take('where')) this.declarations(local);
        if (this.peek() !== ';' && this.peek() !== '}') throw new UnsupportedSyntax('incomplete declaration');
    }
    expression(env, minimum = 0) {
      if (++this.level > 100) throw new UnsupportedSyntax('analysis nesting budget');
      let node = this.atom(env);
      while (this.peek() && !stops.has(this.peek())) {
        const text = this.peek();
        if (text === '::') {
          this.i++;
          while (this.peek() && !stops.has(this.peek())) this.i++;
          break;
        }
        const operator = Object.hasOwn(precedence, text) ? precedence[text] : undefined;
        if (operator !== undefined) {
          if (operator < minimum) break;
          this.i++;
          node = { kind: 'binary', operator: text, env, left: node, right: this.expression(env, operator + (text === '$' ? 0 : 1)) };
        } else if (/^[A-Za-z_\d"'(\[\\]/.test(text)) {
          if (9 < minimum) break;
          node = { kind: 'apply', fn: node, arg: this.expression(env, 10) };
        } else throw new UnsupportedSyntax('unsupported expression');
      }
      this.level--;
      return node;
    }
    atom(env) {
      const token = this.tokens[this.i++];
      if (!token) throw new UnsupportedSyntax('incomplete expression');
      const text = token.text;
      if (text === 'let') {
        const local = scope(env);
        this.declarations(local);
        this.need('in');
        return this.expression(local);
      }
      if (text === 'if') {
        const condition = this.expression(env); this.need('then');
        const yes = this.expression(env); this.need('else');
        return { kind: 'if', condition, yes, no: this.expression(env) };
      }
      if (text === '\\') {
        const local = scope(env);
        while (identifier.test(this.peek() || '')) local.bindings.set(this.tokens[this.i++].text, { body: unknown(), parameters: [] });
        this.need('->');
        this.expression(local);
        return unknown();
      }
      if (text === 'do') return this.doBlock(env);
      if (text === '(' || text === '[') {
        const end = text === '(' ? ')' : ']';
        if (this.take(end)) return { kind: 'constructor', complete: true };
        const first = this.expression(env);
        let aggregate = text === '[';
        let complete = completeValue(first);
        while (this.take(',')) { aggregate = true; complete = completeValue(this.expression(env)) && complete; }
        this.need(end);
        return aggregate ? { kind: 'constructor', complete } : first;
      }
      if (['True', 'False'].includes(text)) return { kind: 'boolean', value: text === 'True' };
      if (/^[A-Za-z_]/.test(text)) return { kind: 'ref', name: text, env };
      if (/^[\d"']/.test(text)) return { kind: 'literal' };
      throw new UnsupportedSyntax('unsupported atom');
    }
    doBlock(env) {
      this.need('{');
      let local = scope(env);
      const actions = [];
      while (this.peek() && this.peek() !== '}') {
        if (this.take(';')) continue;
        if (this.take('let')) {
          local = scope(local); this.declarations(local);
        } else if (identifier.test(this.peek()) && this.tokens[this.i + 1]?.text === '<-') {
          const name = this.tokens[this.i].text; this.i += 2;
          actions.push(this.expression(local));
          local = scope(local); local.bindings.set(name, { body: unknown(), parameters: [] });
        } else actions.push(this.expression(local));
      }
      this.need('}');
      // Only the first action is guaranteed to be entered. Later actions can
      // depend on earlier effects, exceptions, or nontermination.
      return { kind: 'do', actions };
    }
  }

  function alias(binding) {
    return !binding.parameters.length && binding.body.kind === 'ref'
      ? resolve(binding.body.env, binding.body.name) : null;
  }
  function cycles(bindings) {
    const found = [], done = new Set();
    for (const binding of bindings) {
      const path = [], positions = new Map();
      let current = binding;
      while (current && !done.has(current) && !positions.has(current)) {
        positions.set(current, path.length); path.push(current); current = alias(current);
      }
      if (current && positions.has(current)) found.push(path.slice(positions.get(current)));
      path.forEach(item => done.add(item));
    }
    return found;
  }

  /** Follow only mandatory demand edges; never execute or unfold a function. */
  function demanded(node, context, action = false, seen = new Set(), depth = 0) {
    if (!node || context.budget-- <= 0 || depth > 100) return new Set();
    const visit = (child, execute = false) => demanded(child, context, execute, new Set(seen), depth + 1);
    const union = (...sets) => new Set(sets.flatMap(set => [...set]));
    if (node.kind === 'ref') {
      const binding = resolve(node.env, node.name);
      if (!binding || binding.parameters.length) return new Set();
      if (context.cyclic.has(binding)) return new Set([context.cyclic.get(binding)]);
      if (seen.has(binding)) return new Set();
      seen.add(binding);
      return demanded(binding.body, context, action, seen, depth + 1);
    }
    // Obtaining an IO action's value (e.g. with seq) does not run its effects.
    if (node.kind === 'do' && action && context.standardSyntax) return visit(node.actions[0], true);
    if (node.kind === 'if' && context.standardSyntax) {
      return union(visit(node.condition), node.condition.kind === 'boolean'
        ? visit(node.condition.value ? node.yes : node.no, action) : new Set());
    }
    if (node.kind === 'apply' || (node.kind === 'binary' && node.operator === '$' && context.prelude && !resolve(node.env, '$'))) {
      const fn = node.fn || node.left, arg = node.arg || node.right;
      const result = visit(fn);
      if (action && context.prelude && fn.kind === 'ref' && ['print', 'putStr', 'putStrLn'].includes(fn.name) && !resolve(fn.env, fn.name)) {
        return union(result, visit(arg));
      }
      return result;
    }
    if (node.kind === 'binary' && context.prelude && !resolve(node.env, node.operator.replace(/`/g, ''))) {
      if (node.operator === ':' || node.operator === '>>') return new Set();
      if (['&&', '||', '`seq`'].includes(node.operator)) return visit(node.left);
      // Prelude comparisons can inspect either operand first.
      // Only literal values/aggregates prove the other operand completes;
      // never force unknown constructor fields or assume evaluation order.
      if (['==', '/=', '<', '>', '<=', '>='].includes(node.operator) && completeValue(node.right)) return visit(node.left);
      // Numeric instances can optimize away operands, e.g. multiplication
      // by zero. Their demand remains unknown without a type/instance proof.
      return new Set();
    }
    return new Set();
  }

  /**
   * Return {diagnostics, blocked}. `expression` selects a Boolean Test entry;
   * otherwise entry is main. No diagnostics is NOT a termination guarantee.
   * Unsupported syntax stays opaque or abandons analysis, without executing it.
   */
  function analyze(source, { filename = 'Main.hs', expression } = {}) {
    const empty = { diagnostics: [], blocked: false };
    if (source.length > 200000) return empty;
    try {
      const tokens = layout(tokenize(source));
      const parser = new Parser(tokens), env = scope(null);
      // MicroHs Parse.pModuleEmpty follows Haskell's implicit Main(main).
      let exports = ['main'];
      if (parser.take('module')) {
        exports = null;
        parser.i++; // module name
        if (parser.take('(')) {
          exports = [];
          while (parser.peek() && parser.peek() !== ')') {
            if (identifier.test(parser.peek())) exports.push(parser.peek());
            else if (parser.peek() !== ',') throw new UnsupportedSyntax('complex export list');
            parser.i++;
          }
          parser.need(')');
        }
        parser.need('where');
      }
      parser.declarations(env);
      if (parser.peek()) return empty;
      let entry = { kind: 'ref', name: 'main', env };
      if (exports && !exports.includes('main')) entry = unknown();
      if (expression !== undefined) {
        const imported = scope(null);
        for (const [name, binding] of env.bindings) {
          if (!exports || exports.includes(name)) imported.bindings.set(name, binding);
        }
        imported.opaque = env.opaque;
        const testParser = new Parser(layout(tokenize(String(expression)), false));
        entry = testParser.expression(imported);
        if (testParser.peek()) entry = unknown();
        testParser.bindings.forEach(binding => { binding.testExpression = true; });
        parser.bindings.push(...testParser.bindings);
      }
      const groups = cycles(parser.bindings);
      const cyclic = new Map();
      groups.forEach(group => group.forEach(binding => cyclic.set(binding, group)));
      // Imports/instances/extensions can change the meaning or strictness of
      // apparently familiar operations. In that case only alias demand counts.
      const prelude = !tokens.some(token => ['import', 'instance', 'data', 'newtype'].includes(token.text)) && !/\{-#\s*LANGUAGE/.test(source);
      const standardSyntax = !/\{-#\s*LANGUAGE/.test(source);
      const reached = demanded(entry, { cyclic, prelude, standardSyntax, budget: 12000 }, expression === undefined);
      const diagnostics = groups.sort((a, b) => Number(reached.has(b)) - Number(reached.has(a))).flatMap(group => {
        const names = group.map(binding => binding.token.text.length > 60 ? binding.token.text.slice(0, 60) + '…' : binding.token.text);
        const chain = (names.length > 8 ? [...names.slice(0, 8), '…', names[0]] : [...names, names[0]]).join(' → ');
        const blocked = reached.has(group);
        return group.map(binding => ({ filename: binding.testExpression ? filename + ' (test expression)' : filename, line: binding.token.line, column: binding.token.column,
          endColumn: binding.token.column + binding.token.text.length, severity: blocked ? 'error' : 'warning',
          message: 'Cyclic value alias: ' + chain + '. ' + (blocked
            ? 'Execution blocked: this entry demands the cycle, which can freeze MicroHs. '
            : 'Demanding this cycle can freeze MicroHs; it may remain unused. ')
            + 'Give a binding a concrete value or construct a value before recurring.' }));
      });
      return { diagnostics: diagnostics.slice(0, 100), truncated: diagnostics.length > 100, blocked: reached.size > 0 };
    } catch (error) {
      if (!(error instanceof UnsupportedSyntax)) throw error;
      return empty;
    }
  }
  const api = { analyze };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SEBookHaskellCycles = api;
})(globalThis);
