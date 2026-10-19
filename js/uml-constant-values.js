/**
 * Bounded constant expressions for source-to-UML evidence. This is a small
 * interpreter for literal data, never an evaluator of learner JavaScript.
 * Adapters own scopes and side-effect invalidation; this module owns values.
 */
(function (global) {
  'use strict';

  const MAX_TEXT = 4096, MAX_NODES = 128, MAX_DEPTH = 8, MAX_ITEMS = 32;
  const MIN_INTEGER = -2147483648, MAX_INTEGER = 2147483647;
  class UnknownExpression extends Error {}
  const unknown = () => { throw new UnknownExpression(); };
  const integer = value => Number.isInteger(value) && value >= MIN_INTEGER && value <= MAX_INTEGER;

  function collectionSource(text, language, allowBraceSequence) {
    // Only element-list construction. Size/fill/range constructors have other
    // meanings, even when every argument is a literal.
    if (language === 'java') {
      const array = text.match(/^new\s+(?:int|long|boolean|String)\s*(?:\[\s*\]\s*)+(\{[\s\S]*\})$/);
      if (array) return { text: array[1], braces: true };
    }
    if (language === 'cpp') {
      const sequence = text.match(/^std::(?:vector|list|deque)\s*<\s*(int|bool|std::string)\s*>\s*(\{[\s\S]*\})$/);
      if (sequence) return { text: sequence[2], braces: true, elementType: sequence[1] };
    }
    return { text, braces: allowBraceSequence };
  }

  class LiteralParser {
    constructor(text, options) {
      this.text = text; this.position = 0; this.nodes = 0;
      this.language = options.language;
      this.bindings = options.bindings || new Map();
      this.braces = options.braces;
    }

    skipSpace() {
      while (/\s/.test(this.text[this.position] || '') && this.position < this.text.length) this.position++;
    }

    take(character) {
      this.skipSpace();
      if (this.text[this.position] !== character) return false;
      this.position++;
      return true;
    }

    expression(depth = 0, precedence = 0) {
      if (++this.nodes > MAX_NODES || depth > MAX_DEPTH) unknown();
      let value = this.atom(depth);
      const priorities = { '+': 1, '-': 1, '*': 2 };
      while (true) {
        this.skipSpace();
        const operator = this.text[this.position], priority = priorities[operator];
        if (!priority || priority <= precedence) return value;
        if (this.text[this.position + 1] === operator) unknown();
        this.position++;
        const right = this.expression(depth + 1, priority);
        if (!integer(value) || !integer(right)) unknown();
        value = operator === '+' ? value + right : operator === '-' ? value - right : value * right;
        // Check every intermediate: C++ signed overflow is undefined, Java
        // wraps, and other languages have different number representations.
        if (!integer(value)) unknown();
        if (this.language !== 'js' && value === 0) value = 0;
      }
    }

    atom(depth) {
      this.skipSpace();
      const character = this.text[this.position];
      if (character === '+' || character === '-') {
        if (this.text[this.position + 1] === character) unknown();
        this.position++;
        const value = this.expression(depth + 1, 2);
        if (!integer(value)) unknown();
        const result = character === '-' ? -value : value;
        if (!integer(result)) unknown();
        return this.language !== 'js' && result === 0 ? 0 : result;
      }
      if (this.take('(')) {
        const value = this.expression(depth + 1);
        if (!this.take(')')) unknown();
        return value;
      }
      if (character === '[' && ['python', 'js'].includes(this.language) || character === '{' && this.braces) return this.sequence(depth);
      if (character === '"' || character === "'") return this.string();
      const remaining = this.text.slice(this.position);
      const number = remaining.match(/^(?:0|[1-9]\d*)/);
      if (number) {
        this.position += number[0].length;
        const value = Number(number[0]);
        if (!integer(value)) unknown();
        return value;
      }
      const identifier = remaining.match(/^[A-Za-z_]\w*/)?.[0];
      if (!identifier) unknown();
      this.position += identifier.length;
      const literals = this.language === 'python' ? { True: true, False: false, None: null }
        : this.language === 'cpp' ? { true: true, false: false } : { true: true, false: false, null: null };
      if (Object.hasOwn(literals, identifier)) return literals[identifier];
      if (!this.bindings.has(identifier)) unknown();
      return this.checkValue(this.bindings.get(identifier), depth + 1);
    }

    sequence(depth) {
      const close = this.text[this.position++] === '[' ? ']' : '}';
      const values = [];
      if (this.take(close)) return values;
      do {
        if (values.length === MAX_ITEMS) unknown();
        values.push(this.expression(depth + 1));
        if (this.take(close)) return values;
        if (!this.take(',')) unknown();
        if (this.take(close)) return values;
      } while (true);
    }

    string() {
      const quote = this.text[this.position++];
      if (quote === "'" && ['java', 'cpp'].includes(this.language)) unknown();
      const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', '"': '"', "'": "'" };
      let value = '';
      while (this.position < this.text.length) {
        let character = this.text[this.position++];
        if (character === quote) return value;
        if (character === '\\') {
          const escape = this.text[this.position++];
          if (!Object.hasOwn(escapes, escape)) unknown();
          character = escapes[escape];
        } else if (character.charCodeAt(0) < 32) unknown();
        value += character;
      }
      unknown();
    }

    checkValue(value, depth) {
      if (++this.nodes > MAX_NODES || depth > MAX_DEPTH) unknown();
      if (Array.isArray(value)) {
        if (value.length > MAX_ITEMS) unknown();
        for (const item of value) this.checkValue(item, depth + 1);
        return value;
      }
      if (value === null || typeof value === 'boolean' || integer(value)) return value;
      if (typeof value === 'string' && value.length <= MAX_TEXT) return value;
      unknown();
    }
  }

  /** Unknown/unsupported/over-budget expressions return undefined. No effects.
   * Returned collections are immutable evidence, including stored bindings.
   */
  function evaluate(source, { language, bindings, allowBraceSequence = false } = {}) {
    if (typeof source !== 'string' || source.length > MAX_TEXT) return undefined;
    language = ['typescript', 'javascript'].includes(language) ? 'js' : language;
    const input = collectionSource(source.trim(), language, allowBraceSequence);
    const parser = new LiteralParser(input.text, { language, bindings, braces: input.braces });
    try {
      const value = parser.expression();
      parser.skipSpace();
      if (parser.position !== input.text.length || format(value).length > MAX_TEXT) return undefined;
      // A C++ brace list of integers for vector<string> selects a range
      // constructor; reject it rather than presenting imaginary string items.
      if (input.elementType && (!Array.isArray(value) || !value.every(item =>
        input.elementType === 'int' ? integer(item) : input.elementType === 'bool' ? typeof item === 'boolean' : typeof item === 'string'))) return undefined;
      return value;
    } catch (error) {
      if (error instanceof UnknownExpression) return undefined;
      throw error;
    }
  }

  function format(value) {
    return Array.isArray(value) ? '[' + value.map(format).join(', ') + ']'
      : Object.is(value, -0) ? '-0' : JSON.stringify(value);
  }

  /** Exact-header evidence survives fragment buffering. Ambiguity disables it. */
  class LoopFacts {
    constructor() { this.values = new Map(); }
    record(header, value) {
      const text = Array.isArray(value) ? format(value) : undefined;
      if (!this.values.has(header)) this.values.set(header, text);
      else if (this.values.get(header) !== text) this.values.set(header, undefined);
    }
    toJSON() {
      return [...this.values].filter(([, iterable]) => iterable !== undefined)
        .map(([header, iterable]) => ({ header, iterable }));
    }
  }

  const api = { evaluate, format, LoopFacts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.UMLConstantValues = api;
})(typeof window !== 'undefined' ? window : globalThis);
