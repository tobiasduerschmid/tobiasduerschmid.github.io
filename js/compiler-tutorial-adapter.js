/** Tutorial file/check adapter. Parsing and visualization have no dependency on this module. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CompilerTutorial = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function readConfig(step, getFile) {
    const paths = step.compiler_files || { tokens: 'tokens.json', grammar: 'grammar.ebnf', source: 'source.txt' };
    function read(kind) {
      const content = getFile(paths[kind]);
      if (typeof content !== 'string') throw new Error('Compiler file is missing: ' + (paths[kind] || kind));
      return content;
    }
    let settings;
    try { settings = JSON.parse(read('tokens')); }
    catch (error) { throw new Error('Tokenizer JSON: ' + error.message); }
    if (!settings || Array.isArray(settings) || typeof settings !== 'object') {
      throw new Error('Tokenizer JSON must be an object containing tokenRules and optional ast rules.');
    }
    return { tokenRules: settings.tokenRules, ast: settings.ast, startRule: settings.startRule,
      grammar: read('grammar'), source: read('source') };
  }

  function matchesNode(actual, expected) {
    if (!actual || !expected || typeof expected.type !== 'string') return false;
    if (actual.type !== expected.type) return false;
    if (Object.hasOwn(expected, 'value') && actual.value !== expected.value) return false;
    if (!Object.hasOwn(expected, 'children')) return true;
    return Array.isArray(expected.children) && Array.isArray(actual.children) &&
      actual.children.length === expected.children.length &&
      expected.children.every((child, index) => matchesNode(actual.children[index], child));
  }

  function validateNodeExpectation(expected) {
    if (!expected || Array.isArray(expected) || typeof expected !== 'object' || typeof expected.type !== 'string') {
      throw new Error('Each AST expectation must be an object with a type.');
    }
    for (const key of Object.keys(expected)) {
      if (!['type', 'value', 'children', 'start', 'end'].includes(key)) throw new Error('Unknown AST expectation property: ' + key);
    }
    if (Object.hasOwn(expected, 'children')) {
      if (!Array.isArray(expected.children)) throw new Error('AST expectation children must be an array.');
      Array.from(expected.children).forEach(validateNodeExpectation);
    }
  }

  function validateTokenExpectation(expected) {
    if (!expected || Array.isArray(expected) || typeof expected !== 'object' ||
        typeof expected.type !== 'string' || typeof expected.value !== 'string') {
      throw new Error('Each token expectation must provide string type and value fields.');
    }
    for (const key of Object.keys(expected)) {
      if (!['type', 'value'].includes(key)) throw new Error('Unknown token expectation property: ' + key);
    }
  }

  function matchesAlternatives(trees, expected) {
    if (!Array.isArray(expected) || trees.length !== expected.length) return false;
    // Expectations can be partial. A broad pattern must not consume the only
    // candidate for a more specific pattern, so find a complete matching.
    const assigned = new Array(trees.length).fill(-1);
    function assign(expectedIndex, seen) {
      for (let index = 0; index < trees.length; index++) {
        if (seen.has(index) || !matchesNode(trees[index], expected[expectedIndex])) continue;
        seen.add(index);
        if (assigned[index] === -1 || assign(assigned[index], seen)) {
          assigned[index] = expectedIndex;
          return true;
        }
      }
      return false;
    }
    return expected.every((_, index) => assign(index, new Set()));
  }

  /** Compare only authored semantic expectations; source positions are deliberately ignored. */
  function assess(result, check) {
    if (!check || Array.isArray(check) || typeof check !== 'object') throw new Error('Each compiler test needs a compiler object.');
    for (const key of Object.keys(check)) {
      if (!['source', 'tokens', 'ast', 'asts', 'error'].includes(key)) throw new Error('Unknown compiler expectation: ' + key);
    }
    if (Object.hasOwn(check, 'source') && typeof check.source !== 'string') throw new Error('Compiler source override must be a string.');
    if (Object.hasOwn(check, 'tokens')) {
      if (!Array.isArray(check.tokens)) throw new Error('Compiler tokens expectation must be an array.');
      Array.from(check.tokens).forEach(validateTokenExpectation);
    }
    if (Object.hasOwn(check, 'error') && (typeof check.error !== 'string' || !check.error)) throw new Error('Compiler error expectation must name a diagnostic stage.');
    if (check.error && ['tokens', 'ast', 'asts'].some(key => Object.hasOwn(check, key))) throw new Error('A compiler error check cannot also expect a successful tree or token stream.');
    if (Object.hasOwn(check, 'ast') && Object.hasOwn(check, 'asts')) throw new Error('Choose ast or asts for a compiler check, not both.');
    if (Object.hasOwn(check, 'ast')) validateNodeExpectation(check.ast);
    if (Object.hasOwn(check, 'asts')) {
      if (!Array.isArray(check.asts)) throw new Error('Compiler asts expectation must be an array.');
      Array.from(check.asts).forEach(validateNodeExpectation);
    }
    if (result.cancelled) return false;
    if (check.error) return !result.ok && result.diagnostics.some(item => item.stage === check.error);
    if (!result.ok) return false;
    if (check.tokens && (check.tokens.length !== result.tokens.length ||
      !check.tokens.every((token, index) => token.type === result.tokens[index].type && token.value === result.tokens[index].value))) return false;
    const trees = result.asts || [result.ast];
    if (Object.hasOwn(check, 'ast')) return trees.length === 1 && matchesNode(trees[0], check.ast);
    if (Object.hasOwn(check, 'asts')) return matchesAlternatives(trees, check.asts);
    return true;
  }

  class Adapter {
    constructor({ getFile, client }) {
      this.getFile = getFile;
      this.client = client;
      this.generation = 0;
    }
    snapshot(step) { return readConfig(step, this.getFile); }
    isCurrent(step, config) {
      try { return JSON.stringify(this.snapshot(step)) === JSON.stringify(config); }
      catch (_) { return false; } // The learner may have an unfinished JSON edit.
    }
    cancel() { this.generation++; this.client.cancel(); }
    destroy() { this.cancel(); this.client.destroy(); }
    async run(step) {
      const config = this.snapshot(step);
      const result = await this.client.run(config);
      return { config, result };
    }
    async check(step, tests) {
      const generation = ++this.generation;
      const config = this.snapshot(step);
      const results = [];
      const diagnostics = [];
      for (const test of tests) {
        if (generation !== this.generation) break;
        const check = test.compiler;
        const source = check && Object.hasOwn(check, 'source') ? check.source : config.source;
        const result = await this.client.run({ ...config, source });
        if (generation !== this.generation || result.cancelled) break;
        results.push(assess(result, check));
        diagnostics.push(result.diagnostics.map(item => item.stage + ': ' + item.message).join('\n'));
      }
      return { config, results: tests.map((_, index) => results[index] ?? null), diagnostics };
    }
  }
  return { Adapter, readConfig, assess };
});
