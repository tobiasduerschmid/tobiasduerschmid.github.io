/**
 * Reusable, dependency-free lexer / EBNF parser / declarative AST projection.
 *
 * Browser and Worker: CompilerLabCore.compile(options). CommonJS: require(...).
 * No DOM, storage, network, evaluation of source code, or tutorial state.
 *
 * compile({tokenRules, grammar, source, startRule?, ast?}) returns
 * {ok, tokens, parseTrees, asts, astParseTreeIndices, parseTree, ast, diagnostics,
 * incomplete}. parseTrees contains every concrete derivation. asts contains
 * structurally unique projections (ignoring spans), in first-occurrence order;
 * astParseTreeIndices maps each AST to its concrete derivation indices. The
 * singular fields alias the first entries. Resource limits return ok:false and
 * incomplete:true with empty tree arrays, never a silently truncated success.
 * Token rules are ordered {name, pattern, skip?} records. Patterns are JavaScript
 * Unicode RegExp bodies, without /delimiters/. The longest complete matching
 * prefix wins, including alternatives and lazy quantifiers; ties use rule order.
 * Prefix boundaries never split a Unicode surrogate pair. An empty rule array
 * is valid for an empty source (for example, an epsilon-only grammar).
 * Anchors, lookaround, word boundaries and backreferences are unsupported because
 * tokens are matched as independent prefixes. Capturing / noncapturing groups,
 * character classes, alternatives and quantifiers are supported. Empty matches
 * are errors. Skipped matches advance source positions but produce no token.
 *
 * EBNF: Rule = sequence | alternative ; with (), [], {}, quoted literals and
 * named rule/token references. Empty sequences or "" denote the empty string.
 * # and // introduce line comments. A quoted literal matches one token's value.
 * The first rule is the default start. Alternatives have CFG semantics: every
 * possible endpoint and complete derivation is considered. An Earley chart
 * supports direct/indirect left and right recursion. Productive cycles that can
 * recur over the same span, and nullable repetition, are infinitely ambiguous
 * and rejected. Finite forests have explicit work, depth and size bounds below.
 *
 * Concrete trees retain named productions and token leaves; EBNF scaffolding is
 * flattened. ast:{discardTokens:[], inlineRules:[], foldRules:{Rule:'left'|'right'}}
 * controls abstraction. Inline rules collapse only with one retained child.
 * Fold rules require alternating operands/operator token leaves, creating binary
 * nodes; a singleton collapses. No policy means productions remain: a grammar
 * alone does not specify a language's abstract syntax. Nodes use
 * {type,value?,children,start,end}; tokens also carry one-based line/column.
 * Offsets, end-exclusive spans, and columns count JavaScript UTF-16 code units.
 * Inputs are never modified and calls share no mutable compiler state.
 * ast:'auto' is an opt-in for editable arithmetic examples. A complete tree of
 * ASCII names/decimal integers, binary + - * / %, singleton productions and
 * parenthesized operands becomes a compact operator tree. At least one binary
 * operation is required; every other tree retains all productions and tokens.
 * Existing grouping is preserved; flat operator chains fold left. This mode
 * never uses production names or preset discard/fold hints. The ordinary
 * startRule contract still applies (omit it to follow the first production).
 *
 * Limits bound JavaScript parsing work, NOT native RegExp execution time.
 * Run untrusted patterns in a disposable Worker with a host-owned watchdog.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CompilerLabCore = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const LIMITS = Object.freeze({ source: 4096, grammar: 16384, tokenRules: 64,
    pattern: 2048, tokens: 512, grammarNodes: 2048, rules: 128,
    depth: 160, treeNodes: 8192, forestNodes: 32768, alternatives: 128,
    parseWork: 200000, parseStorage: 1000000, regexChecks: 2000000 });
  const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

  function location(text, start) {
    const prefix = text.slice(0, start);
    const lines = prefix.split(/\r\n|\r|\n/);
    return { start, line: lines.length, column: lines[lines.length - 1].length + 1 };
  }

  class CompileDiagnostic extends Error {
    constructor(stage, code, message, text, start = 0, end = start) {
      super(message);
      this.diagnostic = { stage, code, message, ...location(text, start), end };
    }
  }

  function fail(stage, code, message, text = '', start = 0, end = start) {
    throw new CompileDiagnostic(stage, code, message, text, start, end);
  }

  function checkLength(text, maximum, code, label) {
    if (text.length > maximum) fail('limits', code, label + ' exceeds the limit of ' + maximum + ' characters.');
  }

  /** Reject context-sensitive RegExp features before prefix matching. */
  function validateRegexSubset(pattern, name) {
    let inClass = false;
    for (let index = 0; index < pattern.length; index += 1) {
      const character = pattern[index];
      if (character === '\\') {
        const escaped = pattern[++index];
        if (!inClass && (/[1-9bB]/.test(escaped || '') || escaped === 'k')) {
          fail('tokenRules', 'UNSUPPORTED_REGEX', name + ': boundaries and backreferences are unsupported; use regular token patterns.', pattern, index - 1, index + 1);
        }
      } else if (character === '[' && !inClass) inClass = true;
      else if (character === ']' && inClass) inClass = false;
      else if (!inClass && (character === '^' || character === '$' ||
          (character === '(' && pattern[index + 1] === '?' && pattern[index + 2] !== ':'))) {
        fail('tokenRules', 'UNSUPPORTED_REGEX', name + ': anchors, lookaround and special groups are unsupported; token matching is already anchored.', pattern, index, index + 1);
      }
    }
  }

  function prepareTokenRules(definitions) {
    if (!Array.isArray(definitions)) {
      fail('tokenRules', 'INVALID_TOKEN_RULES', 'Provide an array of token rules.');
    }
    if (definitions.length > LIMITS.tokenRules) fail('limits', 'TOKEN_RULE_LIMIT', 'Too many token rules.');
    const names = new Set();
    return Array.from(definitions, definition => {
      if (!definition || typeof definition.name !== 'string' || !NAME.test(definition.name) ||
          typeof definition.pattern !== 'string' || (definition.skip !== undefined && typeof definition.skip !== 'boolean')) {
        fail('tokenRules', 'INVALID_TOKEN_RULE', 'Every token rule needs an identifier name, a string pattern and an optional Boolean skip.');
      }
      if (names.has(definition.name)) fail('tokenRules', 'DUPLICATE_TOKEN', 'Duplicate token name: ' + definition.name + '.');
      names.add(definition.name);
      checkLength(definition.pattern, LIMITS.pattern, 'PATTERN_LIMIT', 'Token pattern');
      validateRegexSubset(definition.pattern, definition.name);
      let regex;
      try {
        // Validate before wrapping: an unfinished character class must not
        // consume characters from our own anchoring syntax and become valid.
        new RegExp(definition.pattern, 'u');
        // Unlike $, this final assertion cannot match before a trailing newline.
        regex = new RegExp('^(?:' + definition.pattern + ')(?![\\s\\S])', 'u');
      } catch (error) {
        fail('tokenRules', 'INVALID_REGEX', definition.name + ': ' + error.message, definition.pattern);
      }
      if (regex.test('')) fail('tokenRules', 'EMPTY_TOKEN_MATCH', definition.name + ' can match empty text; every token must consume a character.', definition.pattern);
      return { name: definition.name, regex, skip: definition.skip === true };
    });
  }

  function isCodePointBoundary(source, offset) {
    const previous = source.charCodeAt(offset - 1);
    const next = source.charCodeAt(offset);
    return !(previous >= 0xD800 && previous <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF);
  }

  function tokenize(source, rules, tokens) {
    let offset = 0;
    let checks = 0;
    while (offset < source.length) {
      let winner = null;
      let end = source.length;
      for (; end > offset && !winner; end -= 1) {
        if (!isCodePointBoundary(source, end)) continue;
        const candidate = source.slice(offset, end);
        for (const rule of rules) {
          checks += 1;
          if (checks > LIMITS.regexChecks) fail('limits', 'LEXER_WORK_LIMIT', 'Token matching exceeded its work limit; shorten the source or simplify the rules.', source, offset);
          if (rule.regex.test(candidate)) { winner = { rule, value: candidate, end }; break; }
        }
      }
      if (!winner) {
        const character = String.fromCodePoint(source.codePointAt(offset));
        fail('lexical', 'UNRECOGNIZED_CHARACTER', 'No token rule matches ' + JSON.stringify(character) + '.', source, offset, offset + character.length);
      }
      if (!winner.rule.skip) {
        if (tokens.length >= LIMITS.tokens) fail('limits', 'TOKEN_LIMIT', 'The source exceeds the limit of ' + LIMITS.tokens + ' tokens.', source, offset);
        tokens.push({ type: winner.rule.name, value: winner.value, ...location(source, offset), end: winner.end });
      }
      offset = winner.end;
    }
  }

  /** Parses only the small EBNF notation, not the learner's language. */
  class GrammarReader {
    constructor(text) {
      this.text = text;
      this.offset = 0;
      this.nodeId = 0;
      this.current = this.readToken();
    }

    error(message, token = this.current) {
      fail('grammar', 'INVALID_GRAMMAR', message, this.text, token.at, token.end);
    }

    skipWhitespace() {
      while (this.offset < this.text.length) {
        const rest = this.text.slice(this.offset);
        const trivia = /^(?:\s+|#[^\r\n]*|\/\/[^\r\n]*)/.exec(rest);
        if (!trivia) return;
        this.offset += trivia[0].length;
      }
    }

    readString(quote, at) {
      let value = '';
      while (this.offset < this.text.length) {
        const character = this.text[this.offset++];
        if (character === quote) return { kind: 'literal', value, at, end: this.offset };
        if (character !== '\\') { value += character; continue; }
        const escaped = this.text[this.offset++];
        const escapes = { n: '\n', r: '\r', t: '\t', '\\': '\\', "'": "'", '"': '"' };
        if (!Object.hasOwn(escapes, escaped)) this.error('Use \\n, \\r, \\t, \\\\, or an escaped quote in a literal.', { at: this.offset - 2, end: this.offset });
        value += escapes[escaped];
      }
      this.error('Unterminated quoted literal.', { at, end: this.offset });
    }

    readToken() {
      this.skipWhitespace();
      const at = this.offset;
      if (at === this.text.length) return { kind: 'end', at, end: at };
      const character = this.text[this.offset++];
      if ('=;|()[]{}'.includes(character)) return { kind: character, at, end: this.offset };
      if (character === '"' || character === "'") return this.readString(character, at);
      const identifier = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.text.slice(at));
      if (identifier) {
        this.offset = at + identifier[0].length;
        return { kind: 'name', value: identifier[0], at, end: this.offset };
      }
      this.error('Unexpected grammar character ' + JSON.stringify(character) + '.', { at, end: this.offset });
    }

    take(kind) {
      if (this.current.kind !== kind) this.error('Expected ' + JSON.stringify(kind) + ' in the grammar.');
      const token = this.current;
      this.current = this.readToken();
      return token;
    }

    node(kind, at, properties) {
      this.nodeId += 1;
      if (this.nodeId > LIMITS.grammarNodes) fail('limits', 'GRAMMAR_SIZE_LIMIT', 'The grammar contains too many expressions.');
      return { kind, at, id: this.nodeId, ...properties };
    }

    expression(depth = 0) {
      if (depth > LIMITS.depth) fail('limits', 'GRAMMAR_DEPTH_LIMIT', 'The grammar is nested too deeply.');
      const at = this.current.at;
      const choices = [this.sequence(depth)];
      while (this.current.kind === '|') {
        this.take('|');
        choices.push(this.sequence(depth));
      }
      return choices.length === 1 ? choices[0] : this.node('choice', at, { children: choices });
    }

    sequence(depth) {
      const at = this.current.at;
      const children = [];
      while (['name', 'literal', '(', '[', '{'].includes(this.current.kind)) children.push(this.term(depth));
      return this.node('sequence', at, { children });
    }

    term(depth) {
      const token = this.current;
      if (token.kind === 'name' || token.kind === 'literal') {
        this.take(token.kind);
        return this.node(token.kind, token.at, { value: token.value });
      }
      const closing = { '(': ')', '[': ']', '{': '}' }[token.kind];
      this.take(token.kind);
      const child = this.expression(depth + 1);
      this.take(closing);
      if (token.kind === '(') return child;
      return this.node(token.kind === '[' ? 'optional' : 'repeat', token.at, { child });
    }

    readRules() {
      const rules = new Map();
      while (this.current.kind !== 'end') {
        const name = this.take('name');
        if (rules.has(name.value)) fail('grammar', 'DUPLICATE_RULE', 'Duplicate production: ' + name.value + '.', this.text, name.at, name.end);
        this.take('=');
        const expression = this.expression();
        this.take(';');
        rules.set(name.value, { name: name.value, expression, at: name.at });
        if (rules.size > LIMITS.rules) fail('limits', 'RULE_LIMIT', 'Too many grammar productions.');
      }
      if (!rules.size) this.error('Provide at least one EBNF production.');
      return rules;
    }
  }

  function visitExpression(expression, visitor) {
    visitor(expression);
    for (const child of expression.children || []) visitExpression(child, visitor);
    if (expression.child) visitExpression(expression.child, visitor);
  }

  function isNullable(expression, nullableRules) {
    if (expression.kind === 'name') return nullableRules.has(expression.value);
    if (expression.kind === 'literal') return expression.value === '';
    if (expression.kind === 'optional' || expression.kind === 'repeat') return true;
    if (expression.kind === 'choice') return expression.children.some(child => isNullable(child, nullableRules));
    return expression.children.every(child => isNullable(child, nullableRules));
  }

  function collectSameSpanRules(expression, nullableRules, ruleNames, names) {
    if (expression.kind === 'name' && ruleNames.has(expression.value)) names.add(expression.value);
    if (expression.child) collectSameSpanRules(expression.child, nullableRules, ruleNames, names);
    const children = expression.children || [];
    for (let index = 0; index < children.length; index += 1) {
      // A reference can retain its parent's complete span only if every sibling
      // can disappear. Left recursion with a consuming suffix is therefore safe.
      if (expression.kind !== 'sequence' || children.every((child, sibling) => sibling === index || isNullable(child, nullableRules))) {
        collectSameSpanRules(children[index], nullableRules, ruleNames, names);
      }
    }
  }

  function isProductive(expression, productiveRules, rules) {
    if (expression.kind === 'name') return !rules.has(expression.value) || productiveRules.has(expression.value);
    if (expression.kind === 'literal' || expression.kind === 'optional' || expression.kind === 'repeat') return true;
    if (expression.kind === 'choice') return expression.children.some(child => isProductive(child, productiveRules, rules));
    return expression.children.every(child => isProductive(child, productiveRules, rules));
  }

  function validateRecursion(rules, text, nullableRules) {
    const productive = new Set();
    let changed;
    do {
      changed = false;
      for (const rule of rules.values()) {
        if (!productive.has(rule.name) && isProductive(rule.expression, productive, rules)) {
          productive.add(rule.name);
          changed = true;
        }
      }
    } while (changed);
    const sameSpanRules = new Map();
    for (const rule of rules.values()) {
      const names = new Set();
      collectSameSpanRules(rule.expression, nullableRules, rules, names);
      sameSpanRules.set(rule.name, names);
    }
    const visited = new Set();
    const active = new Set();
    function visit(name) {
      if (active.has(name)) fail('grammar', 'CYCLIC_DERIVATION', 'A productive cycle reaches ' + name + ' without consuming additional tokens. It creates infinitely many derivations; make each cycle consume input.', text, rules.get(name).at);
      if (visited.has(name) || !productive.has(name)) return;
      active.add(name);
      for (const next of sameSpanRules.get(name)) visit(next);
      active.delete(name);
      visited.add(name);
    }
    for (const name of rules.keys()) visit(name);
  }

  function prepareGrammar(text, tokenRules, requestedStart) {
    const rules = new GrammarReader(text).readRules();
    const tokenNames = new Map(tokenRules.map(rule => [rule.name, rule]));
    for (const rule of rules.values()) {
      if (tokenNames.has(rule.name)) fail('grammar', 'NAME_COLLISION', rule.name + ' names both a token and a production.', text, rule.at);
      visitExpression(rule.expression, expression => {
        if (expression.kind !== 'name') return;
        if (!rules.has(expression.value) && !tokenNames.has(expression.value)) fail('grammar', 'UNDEFINED_SYMBOL', 'Undefined token or production: ' + expression.value + '.', text, expression.at);
        if (tokenNames.get(expression.value)?.skip) fail('grammar', 'SKIPPED_TOKEN', expression.value + ' is skipped by the tokenizer and cannot appear in a production.', text, expression.at);
      });
    }
    const start = requestedStart === undefined ? rules.keys().next().value : requestedStart;
    if (!rules.has(start)) fail('grammar', 'UNKNOWN_START_RULE', 'Unknown start production: ' + String(start) + '.', text);
    const nullableRules = new Set();
    let changed;
    do {
      changed = false;
      for (const rule of rules.values()) {
        if (!nullableRules.has(rule.name) && isNullable(rule.expression, nullableRules)) {
          nullableRules.add(rule.name);
          changed = true;
        }
      }
    } while (changed);
    for (const rule of rules.values()) visitExpression(rule.expression, expression => {
      if (expression.kind === 'repeat' && isNullable(expression.child, nullableRules)) fail('grammar', 'NULLABLE_REPETITION', 'A repeated expression must consume at least one token; this body can match empty input.', text, expression.at);
    });
    validateRecursion(rules, text, nullableRules);
    return { rules, tokenNames, start };
  }

  /** Private productions make EBNF ordinary CFG syntax without adding tree nodes. */
  function lowerGrammar(grammar) {
    const productions = new Map();
    let nextId = 0;
    function add(name, symbols, named = false) {
      const production = { id: nextId++, name, symbols, named };
      if (!productions.has(name)) productions.set(name, []);
      productions.get(name).push(production);
      return production;
    }
    function lower(expression) {
      if (expression.kind === 'name') return { kind: grammar.rules.has(expression.value) ? 'rule' : 'token', value: expression.value };
      if (expression.kind === 'literal' && expression.value !== '') return { kind: 'literal', value: expression.value };
      const symbol = { kind: 'rule', value: '$' + expression.id };
      if (expression.kind === 'sequence') add(symbol.value, expression.children.map(lower));
      else if (expression.kind === 'choice') {
        for (const child of expression.children) add(symbol.value, [lower(child)]);
      } else if (expression.kind === 'optional' || expression.kind === 'repeat') {
        add(symbol.value, []);
        const body = lower(expression.child);
        // Left recursion extends the one accumulated prefix. Right recursion
        // would predict every suffix and retain quadratic overlapping forests
        // even for an ordinary, unambiguous flat list.
        add(symbol.value, expression.kind === 'repeat' ? [symbol, body] : [body]);
      } else add(symbol.value, []); // The quoted empty string is epsilon.
      return symbol;
    }
    for (const rule of grammar.rules.values()) add(rule.name, [lower(rule.expression)], true);
    const root = add('$root', [{ kind: 'rule', value: grammar.start }]);
    return { productions, root };
  }

  function chartColumn() {
    return { queue: [], seen: new Set(), families: new Map(), waiting: new Map(), nullable: new Map() };
  }

  /**
   * Earley states retain derivation identities as well as recognition positions.
   * Prediction deduplicates recursive requests; completion propagates every
   * distinct derivation. A state family may have at most LIMITS.alternatives
   * members. Crossing any bound fails the whole result, never pruning a forest.
   */
  class SourceParser {
    constructor(grammar, tokens, source) {
      const lowered = lowerGrammar(grammar);
      this.productions = lowered.productions;
      this.root = lowered.root;
      this.tokens = tokens;
      this.source = source;
      this.chart = Array.from({ length: tokens.length + 1 }, chartColumn);
      this.roots = new Map();
      this.nextDerivation = 0;
      this.work = 0;
      this.storage = 0;
      this.farthest = 0;
      this.expected = new Set();
    }

    spend() {
      this.work += 1;
      if (this.work > LIMITS.parseWork) fail('limits', 'PARSE_WORK_LIMIT', 'Parsing exceeded its work limit; simplify the grammar or shorten the source.');
    }

    retain(references) {
      this.storage += references;
      if (this.storage > LIMITS.parseStorage) fail('limits', 'PARSE_STORAGE_LIMIT', 'Parsing exceeded its intermediate storage limit; simplify the grammar or shorten the source.');
    }

    expect(position, description) {
      if (position < this.farthest) return;
      if (position > this.farthest) { this.farthest = position; this.expected.clear(); }
      this.expected.add(description);
    }

    makeNode(type, children, from, to) {
      const start = this.tokens[from]?.start ?? this.source.length;
      const end = to > from ? this.tokens[to - 1].end : start;
      return { type, children, start, end };
    }

    add(position, production, dot, origin, children) {
      this.spend();
      const column = this.chart[position];
      const family = production.id + ':' + dot + ':' + origin;
      const key = family + ':' + children.map(child => child.id).join(',');
      if (column.seen.has(key)) return;
      const count = column.families.get(family) || 0;
      if (count >= LIMITS.alternatives) fail('limits', 'PARSE_FOREST_LIMIT', 'Parsing exceeded the limit of ' + LIMITS.alternatives + ' alternatives for one chart state. The result is incomplete; simplify the grammar or shorten the source.');
      this.retain(1 + children.length);
      column.seen.add(key);
      column.families.set(family, count + 1);
      column.queue.push({ production, dot, origin, children });
    }

    advance(item, completion, position) {
      this.add(position, item.production, item.dot + 1, item.origin, item.children.concat(completion));
    }

    terminal(item, symbol, position) {
      const token = this.tokens[position];
      const description = symbol.kind === 'literal' ? JSON.stringify(symbol.value) : symbol.value;
      const matches = token && (symbol.kind === 'literal' ? token.value === symbol.value : token.type === symbol.value);
      if (!matches) { this.expect(position, description); return; }
      const node = { type: token.type, value: token.value, children: [], start: token.start, end: token.end };
      this.advance(item, { id: 't' + position, nodes: [node], depth: 1, size: 1 }, position + 1);
    }

    predict(item, name, position) {
      const column = this.chart[position];
      if (!column.waiting.has(name)) column.waiting.set(name, []);
      column.waiting.get(name).push(item);
      for (const production of this.productions.get(name)) this.add(position, production, 0, position, []);
      // A nullable completion can precede its waiter in this column's queue.
      // Replay it here so epsilon behavior never depends on production order.
      for (const completion of column.nullable.get(name) || []) this.advance(item, completion, position);
    }

    complete(item, position) {
      let size = item.production.named ? 1 : 0;
      let depth = 0;
      let references = 1;
      for (const child of item.children) {
        size += child.size;
        depth = Math.max(depth, child.depth);
        references += child.nodes.length;
      }
      if (item.production.named) depth += 1;
      if (depth > LIMITS.depth) fail('limits', 'PARSE_DEPTH_LIMIT', 'Parsing exceeded its nesting limit; use a smaller or less deeply nested example.');
      if (size > LIMITS.treeNodes) fail('limits', 'TREE_SIZE_LIMIT', 'The syntax tree exceeds the limit of ' + LIMITS.treeNodes + ' nodes.');
      // Count flattened arrays as well as chart items: a small final tree can
      // still require many overlapping intermediate derivations.
      this.retain(references);
      let nodes = item.children.flatMap(child => child.nodes);
      if (item.production.named) nodes = [this.makeNode(item.production.name, nodes, item.origin, position)];
      const completion = { id: 'c' + this.nextDerivation++, nodes, depth, size };
      if (item.production === this.root) {
        if (!this.roots.has(position)) this.roots.set(position, []);
        this.roots.get(position).push(nodes[0]);
      }
      const name = item.production.name;
      if (item.origin === position) {
        const nullable = this.chart[position].nullable;
        if (!nullable.has(name)) nullable.set(name, []);
        nullable.get(name).push(completion);
      }
      for (const waiting of this.chart[item.origin].waiting.get(name) || []) this.advance(waiting, completion, position);
    }

    parse() {
      this.add(0, this.root, 0, 0, []);
      for (let position = 0; position < this.chart.length; position += 1) {
        const queue = this.chart[position].queue;
        for (let index = 0; index < queue.length; index += 1) {
          const item = queue[index];
          const symbol = item.production.symbols[item.dot];
          if (!symbol) this.complete(item, position);
          else if (symbol.kind === 'rule') this.predict(item, symbol.value, position);
          else this.terminal(item, symbol, position);
        }
      }
      const complete = this.roots.get(this.tokens.length);
      if (complete) return complete;
      for (const end of this.roots.keys()) this.expect(end, 'end of input');
      const token = this.tokens[this.farthest];
      const start = token ? token.start : this.source.length;
      const actual = token ? JSON.stringify(token.value) : 'end of input';
      const expected = this.expected.size ? Array.from(this.expected).join(' or ') : 'a finite derivation from the start production';
      fail('syntax', 'UNEXPECTED_TOKEN', 'Expected ' + expected + '; found ' + actual + '.', this.source, start, token?.end ?? start);
    }
  }

  function preparePolicy(policy, grammar) {
    if (policy === undefined) policy = {};
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) fail('ast', 'INVALID_POLICY', 'AST policy must be an object.');
    function names(key, allowed) {
      const entries = policy[key] === undefined ? [] : policy[key];
      if (!Array.isArray(entries) || Array.from(entries).some(name => typeof name !== 'string' || !allowed.has(name))) fail('ast', 'INVALID_POLICY', key + ' must list known names.');
      return new Set(entries);
    }
    const discard = names('discardTokens', grammar.tokenNames);
    const inline = names('inlineRules', grammar.rules);
    const folds = policy.foldRules === undefined ? {} : policy.foldRules;
    if (!folds || typeof folds !== 'object' || Array.isArray(folds)) fail('ast', 'INVALID_POLICY', 'foldRules must map production names to left or right.');
    for (const [name, direction] of Object.entries(folds)) {
      if (!grammar.rules.has(name) || !['left', 'right'].includes(direction)) fail('ast', 'INVALID_POLICY', 'Each fold rule must name a production and select left or right.');
    }
    return { discard, inline, folds: new Map(Object.entries(folds)) };
  }

  function foldNode(node, children, direction, source) {
    if (children.length === 1) return children[0];
    if (!children.length || children.length % 2 === 0 || children.some((child, index) => index % 2 === 1 && (child.value === undefined || child.children.length))) {
      fail('ast', 'INVALID_FOLD', node.type + ' must contain an operand followed by operator/operand pairs after punctuation is discarded.', source, node.start, node.end);
    }
    const binary = (left, operator, right) => ({ type: 'BinaryExpression', value: operator.value, children: [left, right], start: left.start, end: right.end });
    if (direction === 'left') {
      let result = children[0];
      for (let index = 1; index < children.length; index += 2) result = binary(result, children[index], children[index + 1]);
      return result;
    }
    let result = children[children.length - 1];
    for (let index = children.length - 2; index > 0; index -= 2) result = binary(children[index - 1], children[index], result);
    return result;
  }

  function projectTree(tree, policy, source, depth = 0) {
    if (depth > LIMITS.depth) fail('limits', 'AST_DEPTH_LIMIT', 'The syntax tree exceeds its nesting limit.');
    if (policy.discard.has(tree.type)) return null;
    const children = tree.children.map(child => projectTree(child, policy, source, depth + 1)).filter(child => child !== null);
    if (policy.folds.has(tree.type)) return foldNode(tree, children, policy.folds.get(tree.type), source);
    if (policy.inline.has(tree.type) && children.length === 1) return children[0];
    return { type: tree.type, ...(tree.value === undefined ? {} : { value: tree.value }), children, start: tree.start, end: tree.end };
  }

  /** Recognize complete arithmetic shapes; an unfamiliar child vetoes compaction. */
  function arithmeticCandidate(tree, source) {
    if (tree.value !== undefined) {
      const node = { ...tree, children: [] };
      if (/^[+*/%\-]$/.test(tree.value)) return { role: 'operator', node };
      if (tree.value === '(' || tree.value === ')') return { role: tree.value, node };
      if (NAME.test(tree.value) || /^(?:0|[1-9][0-9]*)$/.test(tree.value)) {
        return { role: 'operand', node, hasOperation: false };
      }
      return null;
    }
    const children = tree.children.map(child => arithmeticCandidate(child, source));
    if (children.some(child => child === null)) return null;
    if (children.length === 1) return children[0];
    if (children.length === 3 && children[0].role === '(' &&
        children[1].role === 'operand' && children[2].role === ')') return children[1];
    if (children.length < 3 || children.length % 2 === 0 ||
        children.some((child, index) => child.role !== (index % 2 ? 'operator' : 'operand'))) return null;
    return { role: 'operand', hasOperation: true,
      node: foldNode(tree, children.map(child => child.node), 'left', source) };
  }

  function automaticTree(tree, source) {
    const candidate = arithmeticCandidate(tree, source);
    // Never partially apply arithmetic conventions to records, lists or other
    // languages: their punctuation and named productions may carry meaning.
    if (candidate?.role === 'operand' && candidate.hasOperation) return candidate.node;
    return projectTree(tree, { discard: new Set(), inline: new Set(), folds: new Map() }, source);
  }

  function checkTreeSize(tree) {
    const pending = [tree];
    let size = 0;
    while (pending.length) {
      const node = pending.pop();
      size += 1;
      if (size > LIMITS.treeNodes) fail('limits', 'TREE_SIZE_LIMIT', 'The complete syntax tree exceeds the limit of ' + LIMITS.treeNodes + ' nodes.');
      // Count occurrences, including shared memoized subtrees: serialization
      // and projection expand each occurrence, even for zero-token rules.
      pending.push(...node.children);
    }
    return size;
  }

  function checkForestSize(trees) {
    let total = 0;
    for (const tree of trees) {
      total += checkTreeSize(tree);
      if (total > LIMITS.forestNodes) fail('limits', 'FOREST_SIZE_LIMIT', 'The complete parse forest exceeds the limit of ' + LIMITS.forestNodes + ' nodes.');
    }
  }

  function abstractShape(node) {
    return [node.type, node.value === undefined ? null : node.value, node.children.map(abstractShape)];
  }

  function projectForest(trees, policy, source) {
    const asts = [];
    const astParseTreeIndices = [];
    const byShape = new Map();
    trees.forEach((tree, index) => {
      const ast = policy === 'auto' ? automaticTree(tree, source) : projectTree(tree, policy, source);
      const shape = JSON.stringify(abstractShape(ast));
      if (!byShape.has(shape)) {
        byShape.set(shape, asts.length);
        asts.push(ast);
        astParseTreeIndices.push([]);
      }
      astParseTreeIndices[byShape.get(shape)].push(index);
    });
    return { asts, astParseTreeIndices };
  }

  function compile(options) {
    const result = { ok: false, tokens: [], parseTrees: [], asts: [],
      astParseTreeIndices: [], parseTree: null, ast: null, diagnostics: [], incomplete: false };
    try {
      if (!options || typeof options.grammar !== 'string' || typeof options.source !== 'string') fail('grammar', 'INVALID_INPUT', 'Provide grammar and source strings.');
      checkLength(options.source, LIMITS.source, 'SOURCE_LIMIT', 'Source');
      checkLength(options.grammar, LIMITS.grammar, 'GRAMMAR_LIMIT', 'Grammar');
      const tokenRules = prepareTokenRules(options.tokenRules);
      const grammar = prepareGrammar(options.grammar, tokenRules, options.startRule);
      tokenize(options.source, tokenRules, result.tokens);
      const parseTrees = new SourceParser(grammar, result.tokens, options.source).parse();
      checkForestSize(parseTrees);
      result.parseTrees = parseTrees;
      result.parseTree = parseTrees[0];
      const policy = options.ast === 'auto' ? 'auto' : preparePolicy(options.ast, grammar);
      Object.assign(result, projectForest(parseTrees, policy, options.source));
      result.ast = result.asts[0];
      result.ok = true;
    } catch (error) {
      if (!(error instanceof CompileDiagnostic)) throw error;
      result.diagnostics.push(error.diagnostic);
      if (error.diagnostic.stage === 'limits') {
        result.incomplete = true;
        result.parseTrees = [];
        result.asts = [];
        result.astParseTreeIndices = [];
        result.parseTree = null;
        result.ast = null;
      }
    }
    return result;
  }

  return Object.freeze({ compile, LIMITS });
});
