/**
 * Bounded return-origin analysis shared by the source analyzers.
 * Language adapters supply statements; this module proves only which input
 * object is returned, never whether a method is pure or a branch is feasible.
 */
(function (global) {
  'use strict';

  const UNKNOWN = Symbol('unknown return origin');
  const MAX_NODES = 128, MAX_DEPTH = 8, MAX_PARAMETERS = 32;
  class UnsupportedSummary extends Error {}

  function join(left, right) {
    if (!left) return right;
    if (!right) return left;
    return new Map([...left].filter(([name, origin]) => right.get(name) === origin));
  }

  /**
   * Return {kind:'receiver'} / {kind:'parameter',index} only when every
   * considered path returns that same origin. Otherwise return null.
   *
   * readStatement lazily adapts source nodes to return, assign, if, scope,
   * noop or unknown. Parameters exclude any implicit receiver. Assignments
   * copy origins; declare:true marks a name local to its enclosing scope.
   * Unsupported constructs and exceeded budgets decline the whole summary.
   */
  function analyze(body, { parameters, receiver, readStatement }) {
    if (parameters.length > MAX_PARAMETERS) return null;
    const bindings = new Map(parameters.map((name, index) => [name, Object.freeze({ kind: 'parameter', index })]));
    if (receiver) bindings.set(receiver, Object.freeze({ kind: 'receiver' }));
    const returns = [];
    let remaining = MAX_NODES;

    function walk(statements, incoming, depth, declarations = new Set()) {
      if (depth > MAX_DEPTH) throw new UnsupportedSummary();
      let state = incoming;
      for (const source of statements) {
        if (!state) break; // Unreachable statements cannot change a return.
        if (--remaining < 0) throw new UnsupportedSummary();
        const statement = readStatement(source);
        switch (statement.kind) {
          case 'return':
            returns.push(state.get(statement.name) || UNKNOWN);
            state = null;
            break;
          case 'assign': {
            const origin = state.get(statement.value) || UNKNOWN;
            if (statement.declare) declarations.add(statement.name);
            state.set(statement.name, origin);
            break;
          }
          case 'if': {
            const yes = walk(statement.consequent, new Map(state), depth + 1, declarations);
            const no = walk(statement.alternate, new Map(state), depth + 1, declarations);
            state = join(yes, no);
            break;
          }
          case 'scope': {
            const localDeclarations = new Set();
            const nested = walk(statement.body, new Map(state), depth + 1, localDeclarations);
            if (nested) {
              for (const name of localDeclarations) {
                if (state.has(name)) nested.set(name, state.get(name));
                else nested.delete(name);
              }
            }
            state = nested;
            break;
          }
          case 'noop': break;
          default: throw new UnsupportedSummary();
        }
      }
      return state;
    }

    try {
      const fallthrough = walk(body, bindings, 0);
      return !fallthrough && returns.length && returns[0] !== UNKNOWN && returns.every(origin => origin === returns[0])
        ? returns[0] : null;
    } catch (error) {
      if (error instanceof UnsupportedSummary) return null;
      throw error;
    }
  }

  const api = { analyze };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.UMLReturnSummaries = api;
})(typeof window !== 'undefined' ? window : globalThis);
