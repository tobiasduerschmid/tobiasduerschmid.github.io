/**
 * Time-travel debugger — browser-backend AST instrumenter.
 *
 * Loaded inside the debugger Worker via importScripts (after acorn). Exposes
 * `self.__ttdInstrument(source, file)` which returns the instrumented source.
 * Instrumentation:
 *
 *   1. Parse with acorn (script + module fallback).
 *   2. Walk the program tracking declared identifiers per scope (function +
 *      block).
 *   3. For each Statement node — except control-flow shells like If/While
 *      themselves (we instrument INSIDE their bodies via descent) — prepend
 *      `__ttd.onLine('<file>', <line>, function () { return {x: x, y: y, …}; });`
 *      where the object literal lists every variable visible at that point.
 *   4. For each function entry, also prepend `__ttd.onCall(name, file, line)`;
 *      and at every function-body exit point we wrap the return so __ttd.onReturn
 *      is called.
 *
 * The injected code uses `var` capture so it works inside both modules and
 * scripts; we run via `new Function` so the user code is in script mode.
 *
 * Source is reconstructed by string-splicing into the original source — we
 * don't pretty-print the AST. This preserves comments and formatting and
 * keeps line numbers stable for breakpoint matching.
 */

'use strict';

(function () {
  // Worker context: acorn was loaded via importScripts() in runtime.js
  // BEFORE this file. We no longer need to load it ourselves. If for some
  // reason it isn't there yet, surface clearly.
  if (typeof self.acorn === 'undefined') {
    self.postMessage({ __ttd: true, payload: { type: 'debugComplete', exitCode: 1, error: 'acorn not loaded before instrument.js' } });
    return;
  }

  // Statement kinds where we want to inject a step hook BEFORE the statement.
  var STMT_KINDS = {
    ExpressionStatement: 1, VariableDeclaration: 1, ReturnStatement: 1,
    IfStatement: 1, ForStatement: 1, ForInStatement: 1, ForOfStatement: 1,
    WhileStatement: 1, DoWhileStatement: 1, SwitchStatement: 1,
    ThrowStatement: 1, TryStatement: 1, BreakStatement: 1, ContinueStatement: 1,
    BlockStatement: 0,   // descended into; no own injection
    FunctionDeclaration: 1,
  };

  function instrument(source, file) {
    var ast;
    try {
      ast = self.acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowReturnOutsideFunction: true });
    } catch (e1) {
      // Fallback to module syntax (allows top-level await, import, etc.)
      ast = self.acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    }

    // Each insertion: { offset, text }. Sort descending by offset and splice
    // so earlier offsets aren't shifted by later inserts.
    var inserts = [];

    var scopes = [];   // stack of Sets of declared identifiers

    function currentScopeVars() {
      // Aggregate from outermost scope down; nearer scopes shadow.
      var seen = new Set();
      for (var i = 0; i < scopes.length; i++) {
        scopes[i].forEach(function (n) { seen.add(n); });
      }
      // Filter out reserved-ish names and our own injected refs.
      var arr = [];
      seen.forEach(function (n) {
        if (n === '__ttd' || n.indexOf('__ttd_') === 0) return;
        // Skip identifiers that aren't valid as object-literal shorthand
        // (e.g. starts with non-letter).
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n)) return;
        arr.push(n);
      });
      return arr;
    }

    function makeScopeFn() {
      var names = currentScopeVars();
      // Use shorthand: ({x: typeof x === 'undefined' ? undefined : x, …})
      // — typeof guard avoids ReferenceError if a let/const is used before
      // its declaration line is reached during stepping.
      var entries = names.map(function (n) {
        return n + ': (typeof ' + n + " !== 'undefined' ? " + n + ' : undefined)';
      }).join(', ');
      return 'function () { return {' + entries + '}; }';
    }

    function addVarsToCurrentScope(names) {
      if (!scopes.length) return;
      var top = scopes[scopes.length - 1];
      names.forEach(function (n) { top.add(n); });
    }

    function patternIds(node, out) {
      if (!node) return;
      if (node.type === 'Identifier') out.push(node.name);
      else if (node.type === 'ArrayPattern') node.elements.forEach(function (el) { if (el) patternIds(el, out); });
      else if (node.type === 'ObjectPattern') node.properties.forEach(function (p) {
        if (p.type === 'Property') patternIds(p.value, out);
        else if (p.type === 'RestElement') patternIds(p.argument, out);
      });
      else if (node.type === 'RestElement') patternIds(node.argument, out);
      else if (node.type === 'AssignmentPattern') patternIds(node.left, out);
    }

    function declaredFromVarDecl(node) {
      var out = [];
      node.declarations.forEach(function (d) { patternIds(d.id, out); });
      return out;
    }

    function declaredFromParams(params) {
      var out = [];
      params.forEach(function (p) { patternIds(p, out); });
      return out;
    }

    function injectBefore(stmt) {
      if (!stmt || !stmt.loc) return;
      var line = stmt.loc.start.line;
      var col = stmt.loc.start.column;
      var indent = '';
      // Inherit indentation by reading the spaces before the statement
      var lineStart = stmt.start - col;
      indent = source.substring(lineStart, lineStart + col).replace(/[^\s]/g, ' ');
      var hook = '__ttd.onLine(' + JSON.stringify(file) + ', ' + line + ', ' + makeScopeFn() + ');\n' + indent;
      inserts.push({ offset: stmt.start, text: hook });
    }

    // Wrap `throw expr;` so __ttd.onThrow records an exception snapshot and
    // pauses BEFORE the throw propagates. This is what makes "every throw is
    // a breakpoint" — the Exception Breakpoint navigation buttons jump to
    // these snapshots regardless of whether the exception is later caught.
    function wrapThrow(stmt) {
      if (!stmt || !stmt.argument || !stmt.loc) return;
      var line = stmt.loc.start.line;
      var argStart = stmt.argument.start;
      var argEnd = stmt.argument.end;
      // Replace `throw EXPR` with `throw __ttd.onThrow(file, line, scopeFn, (EXPR))`
      inserts.push({
        offset: argStart,
        text: '__ttd.onThrow(' + JSON.stringify(file) + ', ' + line + ', ' + makeScopeFn() + ', (',
      });
      inserts.push({ offset: argEnd, text: '))' });
    }

    // For each try { ... } catch (...) { ... } we push a marker on a runtime
    // stack at body entry and pop on exit (normal or exception). When
    // __ttd.onThrow fires, it inspects the stack to set `caught: true|false`
    // on the exception snapshot. try { } finally { } without catch DOES NOT
    // push a marker — finally runs but the exception still propagates.
    function wrapTryStatement(stmt) {
      if (!stmt || !stmt.block || !stmt.block.loc) return;
      // Only wrap when there is a catch handler that will actually intercept
      // the exception. Bare try/finally still propagates.
      if (!stmt.handler) return;
      var blockOpen = stmt.block.start + 1;     // after `{`
      var blockClose = stmt.block.end - 1;      // before `}`
      inserts.push({
        offset: blockOpen,
        text: ' __ttd.onTryEnter(); try {\n',
      });
      inserts.push({
        offset: blockClose,
        text: '\n} finally { __ttd.onTryExit(); }',
      });
    }

    function descendStmt(node) {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach(descendStmt); return; }

      // Hoist `var` and `function` declarations — they're visible anywhere
      // in the enclosing function, so add to current scope BEFORE descending.
      if (node.type === 'VariableDeclaration' && node.kind === 'var') {
        addVarsToCurrentScope(declaredFromVarDecl(node));
      }
      if (node.type === 'FunctionDeclaration' && node.id) {
        addVarsToCurrentScope([node.id.name]);
      }

      // Inject step hook for top-level statement kinds we recognize.
      if (STMT_KINDS[node.type]) {
        injectBefore(node);
      }

      // ThrowStatement gets the line hook AND its argument wrapped so that
      // __ttd.onThrow records the exception snapshot before propagation.
      if (node.type === 'ThrowStatement') {
        wrapThrow(node);
      }

      // TryStatement gets enter/exit hooks so onThrow can decide caught vs
      // uncaught at runtime via the dynamic try-handler stack.
      if (node.type === 'TryStatement') {
        wrapTryStatement(node);
      }

      // After hooking, add `let`/`const` to scope (so subsequent statements
      // in the same block see them).
      if (node.type === 'VariableDeclaration' && (node.kind === 'let' || node.kind === 'const')) {
        addVarsToCurrentScope(declaredFromVarDecl(node));
      }

      // Recurse into the structures that hold further statements.
      switch (node.type) {
        case 'BlockStatement':
          scopes.push(new Set());
          node.body.forEach(descendStmt);
          scopes.pop();
          break;
        case 'IfStatement':
          descendStmt(node.consequent);
          if (node.alternate) descendStmt(node.alternate);
          break;
        case 'ForStatement':
          if (node.init && node.init.type === 'VariableDeclaration') {
            addVarsToCurrentScope(declaredFromVarDecl(node.init));
          }
          descendStmt(node.body);
          break;
        case 'ForInStatement':
        case 'ForOfStatement':
          if (node.left && node.left.type === 'VariableDeclaration') {
            addVarsToCurrentScope(declaredFromVarDecl(node.left));
          }
          descendStmt(node.body);
          break;
        case 'WhileStatement':
        case 'DoWhileStatement':
          descendStmt(node.body);
          break;
        case 'SwitchStatement':
          (node.cases || []).forEach(function (c) {
            (c.consequent || []).forEach(descendStmt);
          });
          break;
        case 'TryStatement':
          descendStmt(node.block);
          if (node.handler && node.handler.body) {
            scopes.push(new Set());
            if (node.handler.param) addVarsToCurrentScope(declaredFromParams([node.handler.param]));
            node.handler.body.body.forEach(descendStmt);
            scopes.pop();
          }
          if (node.finalizer) descendStmt(node.finalizer);
          break;
        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'ArrowFunctionExpression':
          // Function body — fresh scope.
          var bodyNode = node.body;
          if (bodyNode && bodyNode.type === 'BlockStatement') {
            scopes.push(new Set());
            addVarsToCurrentScope(declaredFromParams(node.params || []));
            // Inject onCall at function entry — first thing inside the body.
            if (bodyNode.loc) {
              var bodyOpenOffset = bodyNode.start + 1;   // after the `{`
              var fnName = (node.id && node.id.name) || '<anonymous>';
              inserts.push({
                offset: bodyOpenOffset,
                text: '\n  __ttd.onCall(' + JSON.stringify(fnName) + ', ' + JSON.stringify(file) + ', ' + (node.loc.start.line) + ');\n  try {\n  ',
              });
              // And close out with onReturn before `}`.
              inserts.push({
                offset: bodyNode.end - 1,
                text: '\n  } finally { __ttd.onReturn(); }\n',
              });
            }
            bodyNode.body.forEach(descendStmt);
            scopes.pop();
          }
          break;
        case 'ExpressionStatement':
        case 'VariableDeclaration':
        case 'ReturnStatement':
        case 'ThrowStatement':
        case 'BreakStatement':
        case 'ContinueStatement':
          // Leaf statements — already injected before; nothing to descend.
          break;
        default:
          // Unknown / unhandled — descend into children if possible.
          for (var k in node) {
            if (k === 'loc' || k === 'start' || k === 'end' || k === 'parent') continue;
            var child = node[k];
            if (child && typeof child === 'object' && child.type) descendStmt(child);
            else if (Array.isArray(child)) child.forEach(function (c) { if (c && c.type) descendStmt(c); });
          }
      }
    }

    // Top-level program scope
    scopes.push(new Set());
    ast.body.forEach(descendStmt);
    scopes.pop();

    // Apply inserts in reverse offset order so positions remain valid.
    inserts.sort(function (a, b) { return b.offset - a.offset; });
    var out = source;
    inserts.forEach(function (ins) {
      out = out.substring(0, ins.offset) + ins.text + out.substring(ins.offset);
    });
    return out;
  }

  // Public entry — synchronous in worker context (acorn was importScripts'd
  // before us, so it's already on `self`).
  self.__ttdInstrument = instrument;
})();
