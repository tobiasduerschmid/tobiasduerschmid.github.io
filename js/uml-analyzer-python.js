/**
 * Python UML Analyzer — extracts class diagrams and sequence diagrams from
 * Python source code using a lightweight line-based parser.
 *
 * Replaces the Pyodide-based uml-analyzer.py for ~100x faster analysis.
 * No external dependencies — runs synchronously in the browser main thread
 * for sub-10ms latency on tutorial-scale files.
 *
 * Produces the same @startuml/@enduml syntax consumed by the SVG renderers
 * in uml-bundle.js.
 *
 * Relationship inference adapted from:
 * - Milanova (2007) "Composition inference for UML class diagrams"
 *   DOI: 10.1007/s10515-007-0010-8
 * - SEKE 2021 "Mapping OO relationships to UML relationships"
 *   DOI: 10.18293/SEKE2021-170
 * - Tonella & Potrich (2005) "Reverse Engineering of Object Oriented Code"
 *
 * Sequence diagram generation based on:
 * - Fauzi et al. (2016) "Reverse engineering of source code to sequence
 *   diagram using AST"
 * - Rountev et al. (2005) "Static control-flow analysis for reverse
 *   engineering of UML sequence diagrams"
 * - Briand et al. (2006) "Reverse Engineering of UML Sequence Diagrams"
 */
(function (global) {
  'use strict';

  /* ===================================================================
   * Main entry point
   * =================================================================== */

  function analyzePythonSources(sources) {
    var errors = [];
    var allTypeNames = new Set();
    var parsedFiles = {};

    // Parse all source files
    for (var filename in sources) {
      if (!sources.hasOwnProperty(filename)) continue;
      try {
        var ast = parsePythonSource(sources[filename]);
        parsedFiles[filename] = ast;
        // Collect type names (classes)
        astWalk(ast, function (node) {
          if (node.type === 'ClassDef') allTypeNames.add(node.name);
        });
      } catch (e) {
        errors.push(filename + ': Parse error: ' + e.message);
      }
    }

    // Extract class diagram
    var extractor = new PythonClassExtractor(parsedFiles, allTypeNames, errors);
    extractor.analyze();
    var classDiagram = extractor.generatePlantUML();

    // Extract sequence diagram
    var seqGen = new PythonSequenceDiagramGenerator(parsedFiles, extractor, allTypeNames);
    seqGen.generate();
    var sequenceDiagram = seqGen.generatePlantUML();

    return {
      classDiagram: classDiagram,
      sequenceDiagram: sequenceDiagram,
      errors: errors
    };
  }

  /* ===================================================================
   * Expression tokenizer — tokenizes a Python expression string
   * =================================================================== */

  function exprTokenize(text) {
    var tokens = [];
    var i = 0;
    while (i < text.length) {
      var ch = text[i];
      // Whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }
      // Comment
      if (ch === '#') break;
      // String literal (including prefix)
      if (ch === '"' || ch === "'") {
        var end = _scanStr(text, i);
        tokens.push({ t: 'STRING', v: text.substring(i, end) });
        i = end;
        continue;
      }
      if (/[fFrRbBuU]/.test(ch)) {
        var k = i + 1;
        if (k < text.length && /[fFrRbBuU]/.test(text[k])) k++;
        if (k < text.length && (text[k] === '"' || text[k] === "'")) {
          var end = _scanStr(text, k);
          tokens.push({ t: 'STRING', v: text.substring(i, end) });
          i = end;
          continue;
        }
      }
      // Number
      if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < text.length && /[0-9]/.test(text[i + 1]))) {
        var m = text.substring(i).match(/^(0[xXoObB][0-9a-fA-F_]+|[0-9][0-9_]*\.?[0-9_]*(?:[eE][+-]?[0-9_]+)?j?)/);
        if (m) { tokens.push({ t: 'NUM', v: m[1] }); i += m[1].length; continue; }
      }
      // Name / keyword
      if (/[a-zA-Z_]/.test(ch)) {
        var m = text.substring(i).match(/^[a-zA-Z_]\w*/);
        tokens.push({ t: 'NAME', v: m[0] }); i += m[0].length; continue;
      }
      // Three-char operators
      var t3 = text.substring(i, i + 3);
      if (t3 === '...' || t3 === '**=' || t3 === '//=' || t3 === '>>=' || t3 === '<<=') {
        tokens.push({ t: 'OP', v: t3 }); i += 3; continue;
      }
      // Two-char operators
      var t2 = text.substring(i, i + 2);
      if ('== != <= >= -> := ** // << >> += -= *= /= %= &= |= ^='.split(' ').indexOf(t2) !== -1) {
        tokens.push({ t: 'OP', v: t2 }); i += 2; continue;
      }
      // Single char
      tokens.push({ t: 'OP', v: ch }); i++;
    }
    return tokens;
  }

  /** Scan a string literal starting at pos, return end position. */
  function _scanStr(text, pos) {
    var q = text[pos];
    // Triple-quoted
    if (text.substring(pos, pos + 3) === q + q + q) {
      var i = pos + 3;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text.substring(i, i + 3) === q + q + q) return i + 3;
        i++;
      }
      return text.length;
    }
    // Single-quoted
    var i = pos + 1;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === q) return i + 1;
      if (text[i] === '\n') return i; // unterminated
      i++;
    }
    return text.length;
  }

  /* ===================================================================
   * Expression parser — Pratt-style parser for Python expressions
   * =================================================================== */

  function ExprParser(tokens) {
    this.toks = tokens;
    this.pos = 0;
  }

  ExprParser.prototype.peek = function () {
    return this.pos < this.toks.length ? this.toks[this.pos] : { t: 'EOF', v: '' };
  };
  ExprParser.prototype.advance = function () {
    return this.pos < this.toks.length ? this.toks[this.pos++] : { t: 'EOF', v: '' };
  };
  ExprParser.prototype.at = function (type, value) {
    var tok = this.peek();
    return tok.t === type && (value === undefined || tok.v === value);
  };
  ExprParser.prototype.eat = function (type, value) {
    if (this.at(type, value)) return this.advance();
    return null;
  };
  ExprParser.prototype.atEnd = function () {
    return this.pos >= this.toks.length || this.peek().t === 'EOF';
  };

  ExprParser.prototype.parseExpr = function () {
    return this.parseTernary();
  };

  ExprParser.prototype.parseTernary = function () {
    var expr = this.parseOr();
    if (this.eat('NAME', 'if')) {
      var test = this.parseOr();
      this.eat('NAME', 'else');
      var orelse = this.parseTernary();
      return { type: 'IfExp', test: test, body: expr, orelse: orelse };
    }
    return expr;
  };

  ExprParser.prototype.parseOr = function () {
    var left = this.parseAnd();
    while (this.eat('NAME', 'or')) {
      var right = this.parseAnd();
      left = { type: 'BoolOp', op: 'or', values: [left, right] };
    }
    return left;
  };

  ExprParser.prototype.parseAnd = function () {
    var left = this.parseNot();
    while (this.eat('NAME', 'and')) {
      var right = this.parseNot();
      left = { type: 'BoolOp', op: 'and', values: [left, right] };
    }
    return left;
  };

  ExprParser.prototype.parseNot = function () {
    if (this.eat('NAME', 'not')) {
      return { type: 'UnaryOp', op: 'not', operand: this.parseNot() };
    }
    return this.parseComparison();
  };

  ExprParser.prototype.parseComparison = function () {
    var left = this.parseBitOr();
    var ops = [];
    var comparators = [];
    while (true) {
      var tok = this.peek();
      if (tok.t === 'OP' && '== != < > <= >='.split(' ').indexOf(tok.v) !== -1) {
        this.advance();
        ops.push(tok.v);
        comparators.push(this.parseBitOr());
      } else if (tok.t === 'NAME' && tok.v === 'in') {
        this.advance();
        ops.push('in');
        comparators.push(this.parseBitOr());
      } else if (tok.t === 'NAME' && tok.v === 'not') {
        this.advance();
        this.eat('NAME', 'in');
        ops.push('not in');
        comparators.push(this.parseBitOr());
      } else if (tok.t === 'NAME' && tok.v === 'is') {
        this.advance();
        if (this.eat('NAME', 'not')) {
          ops.push('is not');
        } else {
          ops.push('is');
        }
        comparators.push(this.parseBitOr());
      } else {
        break;
      }
    }
    if (ops.length > 0) {
      return { type: 'Compare', left: left, ops: ops, comparators: comparators };
    }
    return left;
  };

  ExprParser.prototype.parseBitOr = function () {
    var left = this.parseBitXor();
    while (this.at('OP', '|')) { this.advance(); left = { type: 'BinOp', left: left, op: '|', right: this.parseBitXor() }; }
    return left;
  };
  ExprParser.prototype.parseBitXor = function () {
    var left = this.parseBitAnd();
    while (this.at('OP', '^')) { this.advance(); left = { type: 'BinOp', left: left, op: '^', right: this.parseBitAnd() }; }
    return left;
  };
  ExprParser.prototype.parseBitAnd = function () {
    var left = this.parseAddSub();
    while (this.at('OP', '&')) { this.advance(); left = { type: 'BinOp', left: left, op: '&', right: this.parseAddSub() }; }
    return left;
  };

  ExprParser.prototype.parseAddSub = function () {
    var left = this.parseMulDiv();
    while (true) {
      var tok = this.peek();
      if (tok.t === 'OP' && (tok.v === '+' || tok.v === '-')) {
        this.advance();
        left = { type: 'BinOp', left: left, op: tok.v, right: this.parseMulDiv() };
      } else { break; }
    }
    return left;
  };

  ExprParser.prototype.parseMulDiv = function () {
    var left = this.parseUnary();
    while (true) {
      var tok = this.peek();
      if (tok.t === 'OP' && (tok.v === '*' || tok.v === '/' || tok.v === '//' || tok.v === '%' || tok.v === '**')) {
        this.advance();
        left = { type: 'BinOp', left: left, op: tok.v, right: this.parseUnary() };
      } else { break; }
    }
    return left;
  };

  ExprParser.prototype.parseUnary = function () {
    var tok = this.peek();
    if (tok.t === 'OP' && (tok.v === '-' || tok.v === '+' || tok.v === '~')) {
      this.advance();
      return { type: 'UnaryOp', op: tok.v, operand: this.parseUnary() };
    }
    if (tok.t === 'NAME' && tok.v === 'await') {
      this.advance();
      return { type: 'Await', value: this.parseUnary() };
    }
    return this.parsePostfix();
  };

  ExprParser.prototype.parsePostfix = function () {
    var expr = this.parsePrimary();
    while (true) {
      if (this.at('OP', '.')) {
        this.advance();
        var name = this.advance();
        expr = { type: 'Attribute', value: expr, attr: name.v };
      } else if (this.at('OP', '(')) {
        expr = this._parseCallArgs(expr);
      } else if (this.at('OP', '[')) {
        this.advance();
        var slice = this.parseExpr();
        // Handle tuple slices: a[x, y]
        if (this.at('OP', ',')) {
          var elts = [slice];
          while (this.eat('OP', ',')) {
            if (this.at('OP', ']')) break;
            elts.push(this.parseExpr());
          }
          slice = { type: 'Tuple', elts: elts };
        }
        this.eat('OP', ']');
        expr = { type: 'Subscript', value: expr, slice: slice };
      } else {
        break;
      }
    }
    return expr;
  };

  ExprParser.prototype._parseCallArgs = function (func) {
    this.advance(); // eat '('
    var args = [];
    var keywords = [];
    while (!this.at('OP', ')') && !this.atEnd()) {
      // Check for **kwargs or keyword=value
      if (this.at('OP', '**')) {
        this.advance();
        keywords.push({ arg: null, value: this.parseExpr() });
      } else if (this.at('OP', '*')) {
        this.advance();
        args.push({ type: 'Starred', value: this.parseExpr() });
      } else {
        var expr = this.parseExpr();
        // Check if this is a keyword argument
        if (this.at('OP', '=') && expr.type === 'Name') {
          this.advance();
          keywords.push({ arg: expr.id, value: this.parseExpr() });
        } else {
          args.push(expr);
        }
      }
      if (!this.eat('OP', ',')) break;
    }
    this.eat('OP', ')');
    return { type: 'Call', func: func, args: args, keywords: keywords };
  };

  ExprParser.prototype.parsePrimary = function () {
    var tok = this.peek();

    // Parenthesized expression or tuple
    if (tok.t === 'OP' && tok.v === '(') {
      this.advance();
      if (this.at('OP', ')')) { this.advance(); return { type: 'Tuple', elts: [] }; }
      var expr = this.parseExpr();
      if (this.at('OP', ',')) {
        var elts = [expr];
        while (this.eat('OP', ',')) {
          if (this.at('OP', ')')) break;
          elts.push(this.parseExpr());
        }
        this.eat('OP', ')');
        return { type: 'Tuple', elts: elts };
      }
      this.eat('OP', ')');
      return expr;
    }

    // List literal
    if (tok.t === 'OP' && tok.v === '[') {
      this.advance();
      var elts = [];
      while (!this.at('OP', ']') && !this.atEnd()) {
        elts.push(this.parseExpr());
        if (!this.eat('OP', ',')) break;
      }
      this.eat('OP', ']');
      return { type: 'List', elts: elts };
    }

    // Dict or set literal
    if (tok.t === 'OP' && tok.v === '{') {
      this.advance();
      if (this.at('OP', '}')) { this.advance(); return { type: 'Dict', keys: [], values: [] }; }
      var first = this.parseExpr();
      if (this.at('OP', ':')) {
        // Dict
        this.advance();
        var firstVal = this.parseExpr();
        var keys = [first], values = [firstVal];
        while (this.eat('OP', ',')) {
          if (this.at('OP', '}')) break;
          keys.push(this.parseExpr());
          this.eat('OP', ':');
          values.push(this.parseExpr());
        }
        this.eat('OP', '}');
        return { type: 'Dict', keys: keys, values: values };
      }
      // Set
      var elts = [first];
      while (this.eat('OP', ',')) {
        if (this.at('OP', '}')) break;
        elts.push(this.parseExpr());
      }
      this.eat('OP', '}');
      return { type: 'Set', elts: elts };
    }

    // Starred expression
    if (tok.t === 'OP' && tok.v === '*') {
      this.advance();
      return { type: 'Starred', value: this.parseUnary() };
    }

    // Ellipsis
    if (tok.t === 'OP' && tok.v === '...') {
      this.advance();
      return { type: 'Constant', value: '...' };
    }

    // Lambda
    if (tok.t === 'NAME' && tok.v === 'lambda') {
      this.advance();
      // Skip to colon then parse body
      while (!this.at('OP', ':') && !this.atEnd()) this.advance();
      this.eat('OP', ':');
      var body = this.parseExpr();
      return { type: 'Lambda', body: body };
    }

    // Name or keyword constant
    if (tok.t === 'NAME') {
      this.advance();
      if (tok.v === 'True') return { type: 'Constant', value: true };
      if (tok.v === 'False') return { type: 'Constant', value: false };
      if (tok.v === 'None') return { type: 'Constant', value: null };
      return { type: 'Name', id: tok.v };
    }

    // Number
    if (tok.t === 'NUM') {
      this.advance();
      return { type: 'Constant', value: parseFloat(tok.v.replace(/_/g, '')) };
    }

    // String
    if (tok.t === 'STRING') {
      this.advance();
      // Strip quotes to get value
      var s = tok.v;
      // Remove prefix
      while (/[fFrRbBuU]/.test(s[0])) s = s.substring(1);
      if (s.startsWith('"""') || s.startsWith("'''")) s = s.slice(3, -3);
      else s = s.slice(1, -1);
      return { type: 'Constant', value: s };
    }

    // Fallback
    this.advance();
    return { type: 'Constant', value: tok.v };
  };

  /** Parse an expression from text string. */
  function parseExpr(text) {
    if (!text || !text.trim()) return null;
    try {
      var tokens = exprTokenize(text.trim());
      if (tokens.length === 0) return null;
      var parser = new ExprParser(tokens);
      return parser.parseExpr();
    } catch (e) {
      return { type: 'Constant', value: text.trim() };
    }
  }

  /* ===================================================================
   * Source parser — line-based Python parser producing AST
   * =================================================================== */

  /**
   * Collect logical lines from raw source, merging continuations.
   * Returns [{text, indent, lineNo}] where text is stripped of leading whitespace.
   */
  function collectLogicalLines(source) {
    var rawLines = source.split('\n');
    var result = [];
    var pending = '';
    var pendingIndent = 0;
    var pendingLineNo = 0;
    var depth = 0;

    for (var i = 0; i < rawLines.length; i++) {
      var raw = rawLines[i];
      var rtrimmed = raw.replace(/\s+$/, '');
      var stripped = rtrimmed.replace(/^\s+/, '');

      // Blank or comment-only
      if (stripped === '' || (depth === 0 && stripped[0] === '#')) {
        if (depth > 0 && pending) {
          // Inside bracket continuation — merge comments are rare but skip blanks
        }
        continue;
      }

      if (pending) {
        pending += ' ' + stripped;
        depth += _netBrackets(stripped);
        if (depth <= 0) {
          depth = 0;
          result.push({ text: pending, indent: pendingIndent, lineNo: pendingLineNo });
          pending = '';
        }
        continue;
      }

      var indent = _calcIndent(raw);

      // Explicit continuation
      if (rtrimmed.endsWith('\\')) {
        pending = stripped.slice(0, -1).trimEnd();
        pendingIndent = indent;
        pendingLineNo = i;
        continue;
      }

      depth = _netBrackets(stripped);
      if (depth > 0) {
        pending = stripped;
        pendingIndent = indent;
        pendingLineNo = i;
        continue;
      }

      result.push({ text: stripped, indent: indent, lineNo: i });
      depth = 0;
    }

    if (pending) {
      result.push({ text: pending, indent: pendingIndent, lineNo: pendingLineNo });
    }
    return result;
  }

  function _calcIndent(line) {
    var n = 0;
    for (var i = 0; i < line.length; i++) {
      if (line[i] === ' ') n++;
      else if (line[i] === '\t') n = (Math.floor(n / 4) + 1) * 4;
      else break;
    }
    return n;
  }

  /** Count net open brackets, respecting strings. */
  function _netBrackets(text) {
    var d = 0;
    var inStr = false, strQ = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inStr) {
        if (ch === '\\') { i++; continue; }
        if (ch === strQ) inStr = false;
        continue;
      }
      if (ch === '#') break;
      if (ch === '"' || ch === "'") { inStr = true; strQ = ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') d++;
      if (ch === ')' || ch === ']' || ch === '}') d--;
    }
    return d;
  }

  /** Parse Python source into a Module AST node. */
  function parsePythonSource(source) {
    var logLines = collectLogicalLines(source);
    var ctx = { lines: logLines, pos: 0 };
    return { type: 'Module', body: parseBody(ctx, -1) };
  }

  function parseBody(ctx, parentIndent) {
    var stmts = [];
    while (ctx.pos < ctx.lines.length) {
      var line = ctx.lines[ctx.pos];
      if (line.indent <= parentIndent) break;
      var stmt = parseStatement(ctx, line.indent);
      if (stmt) {
        if (Array.isArray(stmt)) {
          for (var i = 0; i < stmt.length; i++) stmts.push(stmt[i]);
        } else {
          stmts.push(stmt);
        }
      }
    }
    return stmts;
  }

  function parseStatement(ctx, blockIndent) {
    if (ctx.pos >= ctx.lines.length) return null;
    var line = ctx.lines[ctx.pos];
    var text = line.text;

    // Decorators
    if (text[0] === '@') return parseDecorated(ctx, blockIndent);

    // Class def
    if (/^class\s/.test(text)) return parseClassDef(ctx, blockIndent, []);

    // Function def
    if (/^(?:async\s+)?def\s/.test(text)) return parseFuncDef(ctx, blockIndent, []);

    // Control flow
    if (/^if\s/.test(text) || text === 'if:') return parseIf(ctx, blockIndent);
    if (/^for\s/.test(text)) return parseFor(ctx, blockIndent);
    if (/^while\s/.test(text)) return parseWhile(ctx, blockIndent);
    if (text === 'try:' || /^try\s*:/.test(text)) return parseTry(ctx, blockIndent);
    if (/^with\s/.test(text)) return parseWith(ctx, blockIndent);

    // Simple statements
    ctx.pos++;

    if (/^return\b/.test(text)) {
      var rest = text.substring(6).trim();
      return { type: 'Return', value: rest ? parseExpr(rest) : null };
    }
    if (text === 'pass') return { type: 'Pass' };
    if (/^raise\b/.test(text)) {
      var rest = text.substring(5).trim();
      return { type: 'Raise', exc: rest ? parseExpr(rest) : null };
    }
    if (/^(?:import|from)\s/.test(text)) return { type: 'Import' };
    if (text === 'break') return { type: 'Break' };
    if (text === 'continue') return { type: 'Continue' };

    // Assignment or expression statement
    return parseAssignOrExpr(text);
  }

  function parseDecorated(ctx, blockIndent) {
    var decorators = [];
    while (ctx.pos < ctx.lines.length && ctx.lines[ctx.pos].text[0] === '@') {
      var decText = ctx.lines[ctx.pos].text.substring(1).trim();
      // Extract decorator name (handle @mod.name and @name(args))
      var parenIdx = decText.indexOf('(');
      var decName = parenIdx !== -1 ? decText.substring(0, parenIdx).trim() : decText.trim();
      // For dotted decorators, take the last part
      var dotIdx = decName.lastIndexOf('.');
      if (dotIdx !== -1) decName = decName.substring(dotIdx + 1);
      decorators.push(decName);
      ctx.pos++;
    }
    if (ctx.pos >= ctx.lines.length) return null;
    var text = ctx.lines[ctx.pos].text;
    if (/^class\s/.test(text)) return parseClassDef(ctx, blockIndent, decorators);
    if (/^(?:async\s+)?def\s/.test(text)) return parseFuncDef(ctx, blockIndent, decorators);
    ctx.pos++;
    return null;
  }

  function parseClassDef(ctx, blockIndent, decorators) {
    var text = ctx.lines[ctx.pos].text;
    ctx.pos++;

    var match = text.match(/^class\s+(\w+)/);
    if (!match) return null;
    var name = match[1];
    var bases = [];

    // Extract bases from parentheses
    var afterName = text.substring(match[0].length);
    var pStart = afterName.indexOf('(');
    if (pStart !== -1) {
      var pEnd = afterName.lastIndexOf(')');
      if (pEnd > pStart) {
        var basesStr = afterName.substring(pStart + 1, pEnd);
        // Parse bases handling generics like Generic[T]
        bases = _splitCommaTopLevel(basesStr)
          .map(function (b) { return b.trim(); })
          .filter(Boolean)
          .map(function (b) {
            // Strip generic params: Generic[T] → Generic, Protocol → Protocol
            var bracket = b.indexOf('[');
            return bracket !== -1 ? b.substring(0, bracket).trim() : b;
          });
      }
    }

    var body = parseBody(ctx, blockIndent);

    return {
      type: 'ClassDef',
      name: name,
      bases: bases,
      decorators: decorators || [],
      body: body
    };
  }

  function parseFuncDef(ctx, blockIndent, decorators) {
    var text = ctx.lines[ctx.pos].text;
    ctx.pos++;

    var isAsync = text.startsWith('async ');
    var match = text.match(/(?:async\s+)?def\s+(\w+)\s*\(/);
    if (!match) return null;
    var name = match[1];

    // Extract parameter list: everything between first ( and matching )
    var paramStart = text.indexOf('(', match[0].length - 1);
    var paramEnd = _findMatchingParen(text, paramStart);
    var paramsStr = text.substring(paramStart + 1, paramEnd);

    var args = _parseParams(paramsStr);

    // Extract return type: -> Type before the colon
    var returns = null;
    var afterParen = text.substring(paramEnd + 1);
    var arrowMatch = afterParen.match(/\s*->\s*(.*?)\s*:/);
    if (arrowMatch) {
      returns = parseExpr(arrowMatch[1].trim());
    }

    var body = parseBody(ctx, blockIndent);

    return {
      type: 'FunctionDef',
      name: name,
      args: { args: args },
      returns: returns,
      decorators: decorators || [],
      body: body,
      isAsync: isAsync
    };
  }

  /** Parse Python function parameters into [{arg, annotation}]. */
  function _parseParams(text) {
    var parts = _splitCommaTopLevel(text);
    var result = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p || p === '/') continue;
      // Strip leading * or **
      if (p.startsWith('**')) p = p.substring(2).trim();
      else if (p.startsWith('*')) {
        if (p === '*') continue; // bare * separator
        p = p.substring(1).trim();
      }
      // Strip default value
      var eqIdx = _findTopLevel(p, '=');
      if (eqIdx !== -1) p = p.substring(0, eqIdx).trim();
      // Split name: annotation
      var colonIdx = _findTopLevel(p, ':');
      if (colonIdx !== -1) {
        var argName = p.substring(0, colonIdx).trim();
        var annText = p.substring(colonIdx + 1).trim();
        result.push({ arg: argName, annotation: annText ? parseExpr(annText) : null });
      } else {
        result.push({ arg: p, annotation: null });
      }
    }
    return result;
  }

  function parseIf(ctx, blockIndent) {
    var text = ctx.lines[ctx.pos].text;
    ctx.pos++;
    var condText = _extractCondition(text, 'if');
    var body = parseBody(ctx, blockIndent);
    var orelse = [];

    // Handle elif / else
    while (ctx.pos < ctx.lines.length) {
      var next = ctx.lines[ctx.pos];
      if (next.indent !== blockIndent) break;
      if (/^elif\s/.test(next.text)) {
        ctx.pos++;
        var elifCond = _extractCondition(next.text, 'elif');
        var elifBody = parseBody(ctx, blockIndent);
        orelse = [{ type: 'If', test: parseExpr(elifCond), body: elifBody, orelse: [] }];
        // Chain: the elif's orelse gets filled by the next iteration
        var tip = orelse[0];
        while (ctx.pos < ctx.lines.length) {
          var n2 = ctx.lines[ctx.pos];
          if (n2.indent !== blockIndent) break;
          if (/^elif\s/.test(n2.text)) {
            ctx.pos++;
            var ec = _extractCondition(n2.text, 'elif');
            var eb = parseBody(ctx, blockIndent);
            tip.orelse = [{ type: 'If', test: parseExpr(ec), body: eb, orelse: [] }];
            tip = tip.orelse[0];
          } else if (/^else\s*:/.test(n2.text)) {
            ctx.pos++;
            tip.orelse = parseBody(ctx, blockIndent);
            break;
          } else {
            break;
          }
        }
        break;
      } else if (/^else\s*:/.test(next.text)) {
        ctx.pos++;
        orelse = parseBody(ctx, blockIndent);
        break;
      } else {
        break;
      }
    }

    return { type: 'If', test: parseExpr(condText), body: body, orelse: orelse };
  }

  function parseFor(ctx, blockIndent) {
    var text = ctx.lines[ctx.pos].text;
    ctx.pos++;
    // for target in iter:
    var match = text.match(/^for\s+(.+?)\s+in\s+(.+?)\s*:/);
    var target = null, iter = null;
    if (match) {
      target = parseExpr(match[1]);
      iter = parseExpr(match[2]);
    }
    var body = parseBody(ctx, blockIndent);
    return { type: 'For', target: target, iter: iter, body: body };
  }

  function parseWhile(ctx, blockIndent) {
    var text = ctx.lines[ctx.pos].text;
    ctx.pos++;
    var condText = _extractCondition(text, 'while');
    var body = parseBody(ctx, blockIndent);
    return { type: 'While', test: parseExpr(condText), body: body };
  }

  function parseTry(ctx, blockIndent) {
    ctx.pos++; // skip 'try:'
    var body = parseBody(ctx, blockIndent);
    var handlers = [];
    var finalbody = [];

    while (ctx.pos < ctx.lines.length) {
      var next = ctx.lines[ctx.pos];
      if (next.indent !== blockIndent) break;
      if (/^except\b/.test(next.text)) {
        ctx.pos++;
        var handler = { excType: null, name: null, body: [] };
        var excMatch = next.text.match(/^except\s+(\w[\w.]*)\s*(?:as\s+(\w+))?\s*:/);
        if (excMatch) {
          handler.excType = parseExpr(excMatch[1]);
          handler.name = excMatch[2] || null;
        }
        handler.body = parseBody(ctx, blockIndent);
        handlers.push(handler);
      } else if (/^finally\s*:/.test(next.text)) {
        ctx.pos++;
        finalbody = parseBody(ctx, blockIndent);
        break;
      } else if (/^else\s*:/.test(next.text)) {
        ctx.pos++;
        parseBody(ctx, blockIndent); // skip else body for now
      } else {
        break;
      }
    }

    return { type: 'Try', body: body, handlers: handlers, finalbody: finalbody };
  }

  function parseWith(ctx, blockIndent) {
    ctx.pos++;
    var body = parseBody(ctx, blockIndent);
    return { type: 'With', body: body };
  }

  /** Parse an assignment or expression statement from a single line. */
  function parseAssignOrExpr(text) {
    // Annotated assignment: target : type [= value]
    // Need to find top-level : that's not inside brackets
    var colonIdx = _findTopLevel(text, ':');
    if (colonIdx !== -1) {
      var beforeColon = text.substring(0, colonIdx).trim();
      var afterColon = text.substring(colonIdx + 1).trim();
      // Make sure beforeColon looks like a valid target (name, self.attr, etc.)
      if (/^[\w.]+$/.test(beforeColon) || /^self\.\w+$/.test(beforeColon)) {
        var eqIdx = _findTopLevel(afterColon, '=');
        var annotation = null, value = null;
        if (eqIdx !== -1) {
          annotation = parseExpr(afterColon.substring(0, eqIdx).trim());
          value = parseExpr(afterColon.substring(eqIdx + 1).trim());
        } else {
          annotation = parseExpr(afterColon);
        }
        return {
          type: 'AnnAssign',
          target: parseExpr(beforeColon),
          annotation: annotation,
          value: value
        };
      }
    }

    // Augmented assignment: target op= value
    var augMatch = text.match(/^([\w.[\]]+)\s*(\+=|-=|\*=|\/=|\/\/=|%=|\*\*=|&=|\|=|\^=|<<=|>>=)\s*(.+)$/);
    if (augMatch) {
      return {
        type: 'AugAssign',
        target: parseExpr(augMatch[1]),
        op: augMatch[2],
        value: parseExpr(augMatch[3])
      };
    }

    // Plain assignment: target = value (possibly chained: a = b = expr)
    var eqIdx = _findTopLevelAssign(text);
    if (eqIdx !== -1) {
      var lhs = text.substring(0, eqIdx).trim();
      var rhs = text.substring(eqIdx + 1).trim();
      // Handle chained assignment: a = b = expr
      var targets = [];
      while (true) {
        targets.push(parseExpr(lhs));
        var nextEq = _findTopLevelAssign(rhs);
        if (nextEq !== -1) {
          lhs = rhs.substring(0, nextEq).trim();
          rhs = rhs.substring(nextEq + 1).trim();
        } else {
          break;
        }
      }
      return { type: 'Assign', targets: targets, value: parseExpr(rhs) };
    }

    // Expression statement
    return { type: 'Expr', value: parseExpr(text) };
  }

  /** Extract condition text from 'if cond:' or 'while cond:' */
  function _extractCondition(text, keyword) {
    var rest = text.substring(keyword.length).trim();
    // Remove trailing colon
    if (rest.endsWith(':')) rest = rest.slice(0, -1).trim();
    return rest;
  }

  /** Find matching closing paren for opening paren at pos. */
  function _findMatchingParen(text, pos) {
    var depth = 0;
    var inStr = false, strQ = '';
    for (var i = pos; i < text.length; i++) {
      var ch = text[i];
      if (inStr) {
        if (ch === '\\') { i++; continue; }
        if (ch === strQ) inStr = false;
        continue;
      }
      if (ch === '"' || ch === "'") { inStr = true; strQ = ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      if (ch === ')' || ch === ']' || ch === '}') { depth--; if (depth === 0) return i; }
    }
    return text.length - 1;
  }

  /** Split text by comma at top bracket level. */
  function _splitCommaTopLevel(text) {
    var result = [];
    var depth = 0, start = 0;
    var inStr = false, strQ = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inStr) {
        if (ch === '\\') { i++; continue; }
        if (ch === strQ) inStr = false;
        continue;
      }
      if (ch === '"' || ch === "'") { inStr = true; strQ = ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      if (ch === ')' || ch === ']' || ch === '}') depth--;
      if (ch === ',' && depth === 0) {
        result.push(text.substring(start, i));
        start = i + 1;
      }
    }
    result.push(text.substring(start));
    return result;
  }

  /** Find a character at top bracket level (not inside strings/brackets). */
  function _findTopLevel(text, ch) {
    var depth = 0;
    var inStr = false, strQ = '';
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inStr) {
        if (c === '\\') { i++; continue; }
        if (c === strQ) inStr = false;
        continue;
      }
      if (c === '"' || c === "'") { inStr = true; strQ = c; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      if (c === ')' || c === ']' || c === '}') depth--;
      if (c === ch && depth === 0) return i;
    }
    return -1;
  }

  /**
   * Find '=' at top level that is NOT part of ==, !=, <=, >=, :=, +=, etc.
   */
  function _findTopLevelAssign(text) {
    var depth = 0;
    var inStr = false, strQ = '';
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inStr) {
        if (c === '\\') { i++; continue; }
        if (c === strQ) inStr = false;
        continue;
      }
      if (c === '"' || c === "'") { inStr = true; strQ = c; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      if (c === ')' || c === ']' || c === '}') depth--;
      if (c === '=' && depth === 0) {
        // Not ==, !=, <=, >=, :=, +=, -=, *=, /=, etc.
        if (i > 0 && '!<>:+-*/%&|^'.indexOf(text[i - 1]) !== -1) continue;
        if (i + 1 < text.length && text[i + 1] === '=') continue;
        return i;
      }
    }
    return -1;
  }

  /* ===================================================================
   * AST utilities
   * =================================================================== */

  /** Walk all nodes in an AST subtree, calling fn(node) for each. */
  function astWalk(node, fn) {
    if (!node || typeof node !== 'object') return;
    if (node.type) fn(node);
    for (var key in node) {
      if (!node.hasOwnProperty(key)) continue;
      var val = node[key];
      if (Array.isArray(val)) {
        for (var i = 0; i < val.length; i++) astWalk(val[i], fn);
      } else if (val && typeof val === 'object' && val.type) {
        astWalk(val, fn);
      }
    }
  }

  /** Collect all nodes matching a predicate. */
  function astCollect(node, pred) {
    var result = [];
    astWalk(node, function (n) { if (pred(n)) result.push(n); });
    return result;
  }

  /** Convert an AST expression back to readable text. */
  function unparse(node) {
    if (!node) return '';
    switch (node.type) {
      case 'Name': return node.id;
      case 'Constant':
        if (node.value === true) return 'True';
        if (node.value === false) return 'False';
        if (node.value === null) return 'None';
        if (typeof node.value === 'string') return "'" + node.value + "'";
        return String(node.value);
      case 'Attribute': return unparse(node.value) + '.' + node.attr;
      case 'Call':
        var args = (node.args || []).map(unparse);
        var kws = (node.keywords || []).map(function (kw) {
          return kw.arg ? kw.arg + '=' + unparse(kw.value) : '**' + unparse(kw.value);
        });
        return unparse(node.func) + '(' + args.concat(kws).join(', ') + ')';
      case 'Subscript': return unparse(node.value) + '[' + unparse(node.slice) + ']';
      case 'Tuple': return (node.elts || []).map(unparse).join(', ');
      case 'List': return '[' + (node.elts || []).map(unparse).join(', ') + ']';
      case 'Dict':
        var items = [];
        for (var i = 0; i < (node.keys || []).length; i++) {
          items.push(unparse(node.keys[i]) + ': ' + unparse(node.values[i]));
        }
        return '{' + items.join(', ') + '}';
      case 'Compare':
        var s = unparse(node.left);
        for (var i = 0; i < node.ops.length; i++) {
          s += ' ' + node.ops[i] + ' ' + unparse(node.comparators[i]);
        }
        return s;
      case 'BoolOp': return (node.values || []).map(unparse).join(' ' + node.op + ' ');
      case 'BinOp': return unparse(node.left) + ' ' + node.op + ' ' + unparse(node.right);
      case 'UnaryOp': return node.op + (node.op === 'not' ? ' ' : '') + unparse(node.operand);
      case 'IfExp': return unparse(node.body) + ' if ' + unparse(node.test) + ' else ' + unparse(node.orelse);
      case 'Starred': return '*' + unparse(node.value);
      case 'Lambda': return 'lambda: ' + unparse(node.body);
      default: return '...';
    }
  }

  /**
   * Infer multiplicity from a type annotation node.
   * Returns '*' for collection types (List[X], Set[X], etc.), '0..1' for Optional[X], '1' otherwise.
   */
  function inferMultiplicity(annNode) {
    if (!annNode) return '1';
    if (annNode.type === 'Subscript' && annNode.value && annNode.value.type === 'Name') {
      var wrapper = annNode.value.id;
      if (CONTAINER_TYPES[wrapper]) return '*';
      if (OPTIONAL_TYPES[wrapper]) return '0..1';
      if (MAPPING_TYPES[wrapper]) return '*';
    }
    // Python 3.9+ built-in generics: list[X], set[X]
    if (annNode.type === 'Subscript' && annNode.value && annNode.value.type === 'Name') {
      var name = annNode.value.id;
      if (name === 'list' || name === 'set' || name === 'tuple' || name === 'frozenset'
          || name === 'dict' || name === 'deque') return '*';
    }
    return '1';
  }

  /**
   * Check if an annotation node is a container type (used for determining if
   * an annotation wraps a class type — e.g., List[Task] is a container of Task).
   */
  function isContainerAnnotation(annNode) {
    return inferMultiplicity(annNode) === '*';
  }

  /** Get annotation as a readable string (for type hints). */
  function annotationStr(node) {
    return unparse(node);
  }

  /** Check if a node is self.xxx */
  function isSelfAttr(node) {
    return node && node.type === 'Attribute' && node.value && node.value.type === 'Name' && node.value.id === 'self';
  }

  /** Get the callee name from a Call node's func. */
  function callName(node) {
    if (node.type !== 'Call') return null;
    var f = node.func;
    if (f.type === 'Name') return f.id;
    if (f.type === 'Attribute') return f.attr;
    return null;
  }

  /* ===================================================================
   * Container / annotation type utilities
   * =================================================================== */

  var CONTAINER_TYPES = { List: 1, list: 1, Set: 1, set: 1, Tuple: 1, tuple: 1,
    FrozenSet: 1, frozenset: 1, Sequence: 1, Iterable: 1, Collection: 1, Deque: 1, deque: 1 };
  var OPTIONAL_TYPES = { Optional: 1 };
  var MAPPING_TYPES = { Dict: 1, dict: 1, Mapping: 1, DefaultDict: 1, OrderedDict: 1 };

  /** Extract a known class name from a type annotation node, unwrapping containers. */
  function extractClassFromAnnotation(node, allTypeNames) {
    if (!node) return null;
    if (node.type === 'Name') return allTypeNames.has(node.id) ? node.id : null;
    if (node.type === 'Constant' && typeof node.value === 'string') {
      return allTypeNames.has(node.value) ? node.value : null;
    }
    if (node.type === 'Subscript') {
      var wrapper = node.value && node.value.type === 'Name' ? node.value.id : '';
      if (CONTAINER_TYPES[wrapper] || OPTIONAL_TYPES[wrapper]) {
        return extractClassFromAnnotation(node.slice, allTypeNames);
      }
      if (MAPPING_TYPES[wrapper]) {
        if (node.slice && node.slice.type === 'Tuple' && node.slice.elts && node.slice.elts.length === 2) {
          return extractClassFromAnnotation(node.slice.elts[1], allTypeNames);
        }
      }
    }
    // Union type: X | Y — check both sides
    if (node.type === 'BinOp' && node.op === '|') {
      return extractClassFromAnnotation(node.left, allTypeNames) ||
             extractClassFromAnnotation(node.right, allTypeNames);
    }
    return null;
  }

  /** Resolve an annotation to a known class, unwrapping containers. */
  function resolveAnnotationToClass(annNode, allTypeNames) {
    return extractClassFromAnnotation(annNode, allTypeNames);
  }

  /* ===================================================================
   * PythonClassExtractor — extracts class info and relationships
   * =================================================================== */

  function PythonClassExtractor(parsedFiles, allTypeNames, errors) {
    this.parsedFiles = parsedFiles;
    this.allTypeNames = allTypeNames;
    this.errors = errors;
    this.classes = [];      // ClassInfo objects
    this.classMap = {};     // name → ClassInfo
  }

  function ClassInfo(name, bases, filename) {
    this.name = name;
    this.bases = bases;
    this.filename = filename;
    this.methods = [];       // [{name, params, isPrivate, isAbstract, isStatic, isClassMethod, isProperty, returnType}]
    this.attributes = [];    // [{name, typeHint}]
    this.compositions = [];  // [className]
    this.aggregations = [];  // [className]
    this.associations = [];  // [className]
    this.dependencies = [];  // [className]
    this._relAttrs = {};     // attribute names promoted to relationship arrows
    this._relMult = {};      // {targetClass: {srcMult, tgtMult}} — multiplicity metadata
    this.decorators = [];    // decorator names on the class
  }

  PythonClassExtractor.prototype.analyze = function () {
    for (var fn in this.parsedFiles) {
      if (!this.parsedFiles.hasOwnProperty(fn)) continue;
      var tree = this.parsedFiles[fn];
      this._extractFromBody(tree.body, fn);
    }
  };

  PythonClassExtractor.prototype._extractFromBody = function (body, filename) {
    for (var i = 0; i < body.length; i++) {
      var node = body[i];
      if (node.type === 'ClassDef') {
        this._extractClass(node, filename);
      }
    }
  };

  PythonClassExtractor.prototype._extractClass = function (node, filename) {
    var info = new ClassInfo(node.name, node.bases || [], filename);
    info.decorators = node.decorators || [];
    this.classes.push(info);
    this.classMap[node.name] = info;

    var self = this;

    // Process class body
    for (var i = 0; i < node.body.length; i++) {
      var item = node.body[i];
      if (item.type === 'FunctionDef') {
        this._extractMethod(item, info);
      } else if (item.type === 'AnnAssign') {
        // Class-level annotated attribute (e.g., name: str)
        this._extractClassLevelAnnotation(item, info);
      }
    }

    // Collect dependency relationships
    this._collectDependencies(node, info);
  };

  PythonClassExtractor.prototype._extractMethod = function (node, classInfo) {
    var params = [];
    var args = node.args ? node.args.args : [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a.arg === 'self' || a.arg === 'cls') continue;
      var hint = '';
      if (a.annotation) hint = annotationStr(a.annotation);
      params.push(a.arg + (hint ? ': ' + hint : ''));
    }

    var isPrivate = node.name[0] === '_' && !node.name.startsWith('__');
    var isAbstract = (node.decorators || []).indexOf('abstractmethod') !== -1;
    var isStatic = (node.decorators || []).indexOf('staticmethod') !== -1;
    var isClassMethod = (node.decorators || []).indexOf('classmethod') !== -1;
    var isProperty = (node.decorators || []).indexOf('property') !== -1;

    // Get return type
    var returnType = node.returns ? annotationStr(node.returns) : null;

    classInfo.methods.push({
      name: node.name,
      params: params,
      isPrivate: isPrivate,
      isAbstract: isAbstract,
      isStatic: isStatic,
      isClassMethod: isClassMethod,
      isProperty: isProperty,
      returnType: returnType
    });

    // Build param types map for aggregation detection in this method.
    // Works for __init__ and setter/mutator methods (Milanova 2007:
    // an object injected from outside via any method parameter = aggregation).
    var initParamTypes = {};
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a.arg === 'self' || a.arg === 'cls') continue;
      if (a.annotation) {
        var cls = extractClassFromAnnotation(a.annotation, this.allTypeNames);
        if (cls) initParamTypes[a.arg] = cls;
      }
    }

    // Walk method body for self.x assignments and relationships
    var self = this;
    astWalk({ type: '_wrap', body: node.body }, function (child) {
      self._checkAttribute(child, classInfo);
      self._checkFieldRelationship(child, classInfo, initParamTypes, node.name);
    });
  };

  PythonClassExtractor.prototype._extractClassLevelAnnotation = function (node, classInfo) {
    if (!node.target || node.target.type !== 'Name') return;
    var attrName = node.target.id;
    var typeHint = node.annotation ? annotationStr(node.annotation) : null;

    // Avoid duplicates
    for (var i = 0; i < classInfo.attributes.length; i++) {
      if (classInfo.attributes[i].name === attrName) return;
    }
    classInfo.attributes.push({ name: attrName, typeHint: typeHint });

    // Check for association
    if (node.annotation) {
      var annCls = extractClassFromAnnotation(node.annotation, this.allTypeNames);
      if (annCls) {
        _addUnique(classInfo.associations, annCls);
        classInfo._relAttrs[attrName] = true;
      }
    }
  };

  PythonClassExtractor.prototype._checkAttribute = function (node, classInfo) {
    if (node.type === 'Assign') {
      var targets = node.targets || [];
      for (var i = 0; i < targets.length; i++) {
        this._extractSelfAttr(targets[i], node.value, null, classInfo);
      }
    } else if (node.type === 'AnnAssign' && node.target) {
      this._extractSelfAttr(node.target, node.value, node.annotation, classInfo);
    }
  };

  PythonClassExtractor.prototype._extractSelfAttr = function (target, value, annotation, classInfo) {
    if (!isSelfAttr(target)) return;
    var attrName = target.attr;
    var typeHint = annotation ? annotationStr(annotation) : null;

    // Avoid duplicates
    for (var i = 0; i < classInfo.attributes.length; i++) {
      if (classInfo.attributes[i].name === attrName) return;
    }
    classInfo.attributes.push({ name: attrName, typeHint: typeHint });
  };

  PythonClassExtractor.prototype._checkFieldRelationship = function (node, classInfo, initParamTypes, methodName) {
    var self = this;

    /** Store a relationship with multiplicity inferred from an annotation node. */
    function addRel(list, target, annNode, attrName) {
      _addUnique(list, target);
      classInfo._relAttrs[attrName] = true;
      if (annNode && !classInfo._relMult[target]) {
        var tgtMult = inferMultiplicity(annNode);
        classInfo._relMult[target] = { srcMult: '1', tgtMult: tgtMult };
      }
    }

    if (node.type === 'Assign') {
      var targets = node.targets || [];
      for (var i = 0; i < targets.length; i++) {
        var tgt = targets[i];
        if (!isSelfAttr(tgt)) continue;
        var attrName = tgt.attr;

        // self.x = ClassName() → composition (1 to 1)
        if (node.value && node.value.type === 'Call') {
          var callee = callName(node.value);
          if (callee && this.allTypeNames.has(callee)) {
            addRel(classInfo.compositions, callee, null, attrName);
            continue;
          }
        }
        // self.x = param → aggregation if param is a typed method arg
        if (node.value && node.value.type === 'Name') {
          var paramCls = initParamTypes[node.value.id];
          if (paramCls) {
            addRel(classInfo.aggregations, paramCls, null, attrName);
            continue;
          }
        }
        // self.x = [ClassName(), ...] → composition (* multiplicity)
        if (node.value && node.value.type === 'List' && node.value.elts) {
          for (var j = 0; j < node.value.elts.length; j++) {
            var elt = node.value.elts[j];
            if (elt.type === 'Call') {
              var c = callName(elt);
              if (c && this.allTypeNames.has(c)) {
                _addUnique(classInfo.compositions, c);
                classInfo._relAttrs[attrName] = true;
                if (!classInfo._relMult[c]) {
                  classInfo._relMult[c] = { srcMult: '1', tgtMult: '*' };
                }
              }
            }
          }
        }
      }
    } else if (node.type === 'AnnAssign' && node.target) {
      if (!isSelfAttr(node.target)) return;
      var attrName = node.target.attr;
      var annCls = node.annotation ? extractClassFromAnnotation(node.annotation, this.allTypeNames) : null;

      if (node.value) {
        // self.x: T = ClassName() → composition
        if (node.value.type === 'Call') {
          var callee = callName(node.value);
          if (callee && this.allTypeNames.has(callee)) {
            addRel(classInfo.compositions, callee, node.annotation, attrName);
            return;
          }
        }
        // self.x: T = param → aggregation
        if (node.value.type === 'Name') {
          var paramCls = initParamTypes[node.value.id];
          if (paramCls) {
            addRel(classInfo.aggregations, paramCls, node.annotation, attrName);
            return;
          }
        }
        // self.x: List[T] = [] → composition (empty container, annotation gives element type)
        if (annCls && _isEmptyCollection(node.value)) {
          addRel(classInfo.compositions, annCls, node.annotation, attrName);
          return;
        }
        // self.x: T = <other expr> → association from annotation
        if (annCls) {
          addRel(classInfo.associations, annCls, node.annotation, attrName);
        }
      } else {
        // self.x: ClassName (no value) → association
        if (annCls) {
          addRel(classInfo.associations, annCls, node.annotation, attrName);
        }
      }
    }
  };

  PythonClassExtractor.prototype._collectDependencies = function (classNode, classInfo) {
    var structural = {};
    var arr = classInfo.compositions.concat(classInfo.aggregations, classInfo.associations, classInfo.bases);
    for (var i = 0; i < arr.length; i++) structural[arr[i]] = true;

    var self = this;
    for (var i = 0; i < classNode.body.length; i++) {
      var item = classNode.body[i];
      if (item.type !== 'FunctionDef') continue;

      // Method parameter types → dependency
      var args = item.args ? item.args.args : [];
      for (var j = 0; j < args.length; j++) {
        var a = args[j];
        if (a.arg === 'self' || a.arg === 'cls') continue;
        if (a.annotation) {
          var paramCls = extractClassFromAnnotation(a.annotation, self.allTypeNames);
          if (paramCls && !structural[paramCls]) {
            if (item.name === '__init__' && classInfo.aggregations.indexOf(paramCls) !== -1) continue;
            _addUnique(classInfo.dependencies, paramCls);
          }
        }
      }

      // Return type → dependency
      if (item.returns) {
        var retCls = extractClassFromAnnotation(item.returns, self.allTypeNames);
        if (retCls && !structural[retCls]) {
          _addUnique(classInfo.dependencies, retCls);
        }
      }

      // Local ClassName() calls and raise statements → dependency
      if (item.name !== '__init__') {
        astWalk({ type: '_wrap', body: item.body }, function (child) {
          if (child.type === 'Assign') {
            var targets = child.targets || [];
            for (var k = 0; k < targets.length; k++) {
              if (targets[k].type === 'Name' && child.value && child.value.type === 'Call') {
                var callee = callName(child.value);
                if (callee && self.allTypeNames.has(callee) && !structural[callee]) {
                  _addUnique(classInfo.dependencies, callee);
                }
              }
            }
          }
          // raise ClassName(...) or raise ClassName → "throws" dependency
          if (child.type === 'Raise' && child.exc) {
            var excNode = child.exc;
            var excClass = null;
            // raise ClassName(...)
            if (excNode.type === 'Call') {
              var cn = excNode.func;
              if (cn && cn.type === 'Name') excClass = cn.id;
            }
            // raise ClassName (no call, bare name)
            if (excNode.type === 'Name') excClass = excNode.id;
            if (excClass && self.allTypeNames.has(excClass) && !structural[excClass]) {
              _addUnique(classInfo.dependencies, excClass);
            }
          }
        });
      } else {
        // __init__ can also raise exceptions → "throws" dependency
        astWalk({ type: '_wrap', body: item.body }, function (child) {
          if (child.type === 'Raise' && child.exc) {
            var excNode = child.exc;
            var excClass = null;
            if (excNode.type === 'Call') {
              var cn = excNode.func;
              if (cn && cn.type === 'Name') excClass = cn.id;
            }
            if (excNode.type === 'Name') excClass = excNode.id;
            if (excClass && self.allTypeNames.has(excClass) && !structural[excClass]) {
              _addUnique(classInfo.dependencies, excClass);
            }
          }
        });
      }
    }
  };

  PythonClassExtractor.prototype.generatePlantUML = function () {
    if (this.classes.length === 0) return '';
    var lines = ['@startuml'];
    var sorted = _topoSortClasses(this.classes);

    for (var i = 0; i < sorted.length; i++) {
      var cls = sorted[i];
      // Determine class type
      var decl;
      if (_isInterface(cls, this.allTypeNames)) {
        decl = 'interface ' + cls.name;
      } else if (_isAbstractClass(cls)) {
        decl = 'abstract class ' + cls.name;
      } else if (_isEnum(cls)) {
        decl = 'enum ' + cls.name;
      } else {
        decl = 'class ' + cls.name;
      }
      lines.push(decl + ' {');

      // Attributes — filter out those promoted to relationships
      for (var j = 0; j < cls.attributes.length; j++) {
        var attr = cls.attributes[j];
        if (cls._relAttrs[attr.name]) continue;
        // Visibility: __ → private, _ → protected, else → public
        var prefix;
        if (attr.name.startsWith('__') && !attr.name.endsWith('__')) prefix = '-';
        else if (attr.name.startsWith('_')) prefix = '#';
        else prefix = '+';
        var line = '  ' + prefix + attr.name;
        if (attr.typeHint) line += ': ' + attr.typeHint;
        lines.push(line);
      }

      // @property methods shown as attributes
      for (var j = 0; j < cls.methods.length; j++) {
        var m = cls.methods[j];
        if (m.isProperty) {
          var prefix = m.isPrivate ? '#' : '+';
          var line = '  ' + prefix + m.name;
          if (m.returnType) line += ': ' + m.returnType;
          lines.push(line);
        }
      }

      // Methods (excluding @property)
      for (var j = 0; j < cls.methods.length; j++) {
        var m = cls.methods[j];
        if (m.isProperty) continue;
        var prefix = '';
        if (m.isAbstract) prefix += '{abstract} ';
        if (m.isStatic) prefix += '{static} ';
        // Visibility
        if (m.name.startsWith('__') && !m.name.endsWith('__')) prefix += '-';
        else if (m.isPrivate) prefix += '#';
        else prefix += '+';
        lines.push('  ' + prefix + m.name + '(' + m.params.join(', ') + ')');
      }

      lines.push('}');
    }

    // Build bidirectional association set (both classes reference each other)
    var bidir = {};
    var emittedBidir = {};
    for (var i = 0; i < sorted.length; i++) {
      var biCls = sorted[i];
      for (var j = 0; j < biCls.associations.length; j++) {
        var target = biCls.associations[j];
        var targetInfo = this.classMap[target];
        if (targetInfo && targetInfo.associations.indexOf(biCls.name) !== -1) {
          var key = [biCls.name, target].sort().join('::');
          bidir[key] = true;
        }
      }
    }

    // Relationships
    for (var i = 0; i < sorted.length; i++) {
      var cls = sorted[i];

      // Inheritance — use ..|> (realization) for interface/Protocol bases, --|> for class bases
      for (var j = 0; j < cls.bases.length; j++) {
        var base = cls.bases[j];
        if (base === 'ABC' || base === 'ABCMeta' || base === 'object') continue;
        if (this.classMap[base]) {
          var baseInfo = this.classMap[base];
          var arrow = _isInterface(baseInfo, this.allTypeNames) ? ' ..|> ' : ' --|> ';
          lines.push(cls.name + arrow + base);
        }
      }

      // Composition — with multiplicity
      for (var j = 0; j < cls.compositions.length; j++) {
        var compTarget = cls.compositions[j];
        var compMult = cls._relMult[compTarget];
        var compLabel = compMult
          ? ' "' + compMult.srcMult + '" *-- "' + compMult.tgtMult + '" '
          : ' *-- ';
        lines.push(cls.name + compLabel + compTarget);
      }

      // Aggregation — with multiplicity
      for (var j = 0; j < cls.aggregations.length; j++) {
        var aggTarget = cls.aggregations[j];
        var aggMult = cls._relMult[aggTarget];
        var aggLabel = aggMult
          ? ' "' + aggMult.srcMult + '" o-- "' + aggMult.tgtMult + '" '
          : ' o-- ';
        lines.push(cls.name + aggLabel + aggTarget);
      }

      // Association — with bidirectionality detection and multiplicity
      for (var j = 0; j < cls.associations.length; j++) {
        var assocTarget = cls.associations[j];
        var bdKey = [cls.name, assocTarget].sort().join('::');
        if (bidir[bdKey]) {
          // Bidirectional — emit once with undirected arrow
          if (!emittedBidir[bdKey]) {
            emittedBidir[bdKey] = true;
            var m1 = cls._relMult[assocTarget];
            var srcM = m1 ? m1.srcMult : '1';
            var tgtM = m1 ? m1.tgtMult : '1';
            lines.push(cls.name + ' "' + srcM + '" -- "' + tgtM + '" ' + assocTarget);
          }
        } else {
          // Unidirectional — directed arrow with multiplicity
          var assocMult = cls._relMult[assocTarget];
          var assocLabel = assocMult
            ? ' "' + assocMult.srcMult + '" --> "' + assocMult.tgtMult + '" '
            : ' --> ';
          lines.push(cls.name + assocLabel + assocTarget);
        }
      }

      // Dependency
      for (var j = 0; j < cls.dependencies.length; j++) {
        lines.push(cls.name + ' ..> ' + cls.dependencies[j]);
      }
    }

    lines.push('@enduml');
    return lines.join('\n');
  };

  /* ===================================================================
   * PythonSequenceDiagramGenerator
   * =================================================================== */

  function PythonSequenceDiagramGenerator(parsedFiles, extractor, allTypeNames) {
    this.parsedFiles = parsedFiles;
    this.extractor = extractor;
    this.allTypeNames = allTypeNames;

    // Lookup tables
    this.classMethods = {};    // {className: {methodName: FunctionDef}}
    this.attrTypes = {};       // {className: {attrName: className}}
    this.paramTypes = {};      // {className: {methodName: {param: className}}}
    this.fieldAnnotations = {}; // {className: {attrName: annotationNode}}
    this.classBases = {};      // {className: [baseName]}
    this._dataClasses = {};    // {className: true}
    this._buildLookups();

    // Output state
    this.participants = [];
    this._participantSet = {};
    this.lines = [];

    // Scope tracking
    this.varTypes = {};
    this._callerClass = {};

    // Recursion guard
    this._callStack = {};
    this.MAX_DEPTH = 3;
  }

  PythonSequenceDiagramGenerator.prototype._buildLookups = function () {
    var self = this;
    for (var fn in this.parsedFiles) {
      if (!this.parsedFiles.hasOwnProperty(fn)) continue;
      var tree = this.parsedFiles[fn];
      astWalk(tree, function (node) {
        if (node.type !== 'ClassDef') return;
        var cname = node.name;
        var methods = {};
        var aTypes = {};
        var pTypes = {};
        var fAnns = {};

        // Track bases
        var bases = [];
        for (var i = 0; i < (node.bases || []).length; i++) {
          var b = node.bases[i];
          if (self.allTypeNames.has(b)) bases.push(b);
        }
        self.classBases[cname] = bases;

        for (var i = 0; i < node.body.length; i++) {
          var item = node.body[i];
          if (item.type !== 'FunctionDef') continue;
          methods[item.name] = item;

          // Parameter types
          var mParams = {};
          var args = item.args ? item.args.args : [];
          for (var j = 0; j < args.length; j++) {
            var a = args[j];
            if (a.arg === 'self' || a.arg === 'cls') continue;
            if (a.annotation) {
              var resolved = resolveAnnotationToClass(a.annotation, self.allTypeNames);
              if (resolved) mParams[a.arg] = resolved;
            }
          }
          if (Object.keys(mParams).length > 0) pTypes[item.name] = mParams;

          // __init__: extract attribute types
          if (item.name === '__init__') {
            var initParams = {};
            for (var j = 0; j < args.length; j++) {
              var a = args[j];
              if (a.arg === 'self' || a.arg === 'cls') continue;
              if (a.annotation) {
                var resolved = resolveAnnotationToClass(a.annotation, self.allTypeNames);
                if (resolved) initParams[a.arg] = resolved;
              }
            }
            astWalk({ type: '_wrap', body: item.body }, function (child) {
              if (child.type === 'Assign') {
                var targets = child.targets || [];
                for (var k = 0; k < targets.length; k++) {
                  var tgt = targets[k];
                  if (isSelfAttr(tgt)) {
                    if (child.value && child.value.type === 'Call') {
                      var cn = child.value.func;
                      if (cn && cn.type === 'Name' && self.allTypeNames.has(cn.id)) {
                        aTypes[tgt.attr] = cn.id;
                      }
                    } else if (child.value && child.value.type === 'Name') {
                      var pc = initParams[child.value.id];
                      if (pc) aTypes[tgt.attr] = pc;
                    }
                  }
                }
              } else if (child.type === 'AnnAssign' && child.target && isSelfAttr(child.target)) {
                var attrName = child.target.attr;
                if (child.annotation) fAnns[attrName] = child.annotation;
                var resolved = null;
                if (child.value && child.value.type === 'Call') {
                  var cn = child.value.func;
                  if (cn && cn.type === 'Name' && self.allTypeNames.has(cn.id)) resolved = cn.id;
                }
                if (!resolved && child.value && child.value.type === 'Name') {
                  resolved = initParams[child.value.id];
                }
                if (!resolved && child.annotation) {
                  resolved = resolveAnnotationToClass(child.annotation, self.allTypeNames);
                }
                if (resolved) aTypes[attrName] = resolved;
              }
            });
          }
        }

        self.classMethods[cname] = methods;
        self.attrTypes[cname] = aTypes;
        self.paramTypes[cname] = pTypes;
        self.fieldAnnotations[cname] = fAnns;
      });
    }

    // Identify data classes
    this._identifyDataClasses();
  };

  PythonSequenceDiagramGenerator.prototype._identifyDataClasses = function () {
    var self = this;
    for (var fn in this.parsedFiles) {
      if (!this.parsedFiles.hasOwnProperty(fn)) continue;
      astWalk(this.parsedFiles[fn], function (node) {
        if (node.type !== 'ClassDef') return;
        if (!self.allTypeNames.has(node.name)) return;
        // @dataclass decorator
        var decs = node.decorators || [];
        for (var i = 0; i < decs.length; i++) {
          if (decs[i] === 'dataclass') { self._dataClasses[node.name] = true; return; }
        }
        // No behavioral methods → data class
        var hasBehavioral = false;
        for (var i = 0; i < node.body.length; i++) {
          var item = node.body[i];
          if (item.type === 'FunctionDef') {
            if (!(item.name.startsWith('__') && item.name.endsWith('__'))) {
              hasBehavioral = true;
              break;
            }
          }
        }
        if (!hasBehavioral) self._dataClasses[node.name] = true;
      });
    }
  };

  PythonSequenceDiagramGenerator.prototype.generate = function () {
    var entry = this._collectEntryStmts();
    if (!entry || entry.length === 0) return;
    this._ensureParticipant('Main', 'Main');
    this._processStmts(entry, 'Main', 0);
  };

  PythonSequenceDiagramGenerator.prototype.generatePlantUML = function () {
    if (this.lines.length === 0) return '';
    var out = ['@startuml'];
    for (var i = 0; i < this.participants.length; i++) {
      var p = this.participants[i];
      out.push('participant ' + p.id + ': ' + p.label);
    }
    out.push('');
    for (var i = 0; i < this.lines.length; i++) out.push(this.lines[i]);
    out.push('@enduml');
    return out.join('\n');
  };

  PythonSequenceDiagramGenerator.prototype._collectEntryStmts = function () {
    var mainBlocks = {};
    var topStmts = [];
    for (var fn in this.parsedFiles) {
      if (!this.parsedFiles.hasOwnProperty(fn)) continue;
      var tree = this.parsedFiles[fn];
      for (var i = 0; i < tree.body.length; i++) {
        var node = tree.body[i];
        if (node.type === 'ClassDef' || node.type === 'FunctionDef' || node.type === 'Import') continue;
        if (node.type === 'If' && this._isMainGuard(node)) {
          if (!mainBlocks[fn]) mainBlocks[fn] = [];
          mainBlocks[fn] = mainBlocks[fn].concat(node.body);
        } else {
          topStmts.push(node);
        }
      }
    }
    var keys = Object.keys(mainBlocks);
    if (keys.length > 0) return mainBlocks[keys[keys.length - 1]];
    return topStmts;
  };

  PythonSequenceDiagramGenerator.prototype._isMainGuard = function (node) {
    if (node.type !== 'If' || !node.test) return false;
    var test = node.test;
    if (test.type !== 'Compare') return false;
    if (!test.left || test.left.type !== 'Name' || test.left.id !== '__name__') return false;
    if (!test.comparators || test.comparators.length !== 1) return false;
    var comp = test.comparators[0];
    return comp.type === 'Constant' && comp.value === '__main__';
  };

  // ── Statement processing ──────────────────────────────────────────

  PythonSequenceDiagramGenerator.prototype._processStmts = function (stmts, caller, depth) {
    for (var i = 0; i < stmts.length; i++) {
      this._processStmt(stmts[i], caller, depth);
    }
  };

  PythonSequenceDiagramGenerator.prototype._processStmt = function (stmt, caller, depth) {
    if (!stmt) return;
    switch (stmt.type) {
      case 'Assign': this._processAssign(stmt, caller, depth); break;
      case 'AnnAssign':
        if (stmt.value) this._processAssignValue(stmt.value, [stmt.target], caller, depth);
        break;
      case 'AugAssign': this._scanExprForCalls(stmt.value, caller, depth); break;
      case 'Expr': this._processExprStmt(stmt, caller, depth); break;
      case 'Return':
        if (stmt.value) this._scanExprForCalls(stmt.value, caller, depth);
        break;
      case 'If':
        if (!this._isMainGuard(stmt)) this._processIf(stmt, caller, depth);
        else this._processStmts(stmt.body, caller, depth);
        break;
      case 'For': this._processFor(stmt, caller, depth); break;
      case 'While': this._processWhile(stmt, caller, depth); break;
      case 'With': this._processStmts(stmt.body, caller, depth); break;
      case 'Try': this._processTry(stmt, caller, depth); break;
    }
  };

  PythonSequenceDiagramGenerator.prototype._processAssign = function (stmt, caller, depth) {
    this._processAssignValue(stmt.value, stmt.targets || [], caller, depth);
  };

  PythonSequenceDiagramGenerator.prototype._processAssignValue = function (value, targets, caller, depth) {
    if (value && value.type === 'Call') {
      var resolved = this._resolveCall(value, caller);
      if (resolved) {
        var clsName = resolved[0], method = resolved[1];
        if (method === '__init__' && targets.length === 1) {
          var tgt = targets[0];
          if (tgt.type === 'Name') {
            this.varTypes[tgt.id] = clsName;
            this._callerClass[tgt.id] = clsName;
            if (this._dataClasses[clsName]) return;
            this._ensureParticipant(tgt.id, clsName);
            this.lines.push('create ' + tgt.id);
            this.lines.push(caller + ' --> ' + tgt.id + ': <<create>>');
            this._maybeFollow(clsName, '__init__', tgt.id, depth);
            return;
          }
          if (isSelfAttr(tgt)) {
            if (this._dataClasses[clsName]) return;
            var pid = tgt.attr;
            this._ensureParticipant(pid, clsName);
            this._callerClass[pid] = clsName;
            this.lines.push('create ' + pid);
            this.lines.push(caller + ' --> ' + pid + ': <<create>>');
            return;
          }
        }
        // Non-constructor call assigned to a variable — return IS captured
        // (Cheers & Lin 2020: show return arrow when value is used)
        this._processCall(value, caller, depth, true);
        // Track the variable's type from the return annotation
        if (targets.length === 1 && targets[0].type === 'Name') {
          var retCls = this._getReturnClassType(clsName, method);
          if (retCls) this.varTypes[targets[0].id] = retCls;
        }
        return;
      }
    }
    this._scanExprForCalls(value, caller, depth);
  };

  PythonSequenceDiagramGenerator.prototype._processExprStmt = function (stmt, caller, depth) {
    if (stmt.value && stmt.value.type === 'Call') {
      // Bare expression statement — return value is NOT captured (Cheers & Lin 2020:
      // only show return messages when the return value is assigned to a variable)
      this._processCall(stmt.value, caller, depth, false);
    } else {
      this._scanExprForCalls(stmt.value, caller, depth);
    }
  };

  // ── Control flow → combined fragments ────────────────────────────

  PythonSequenceDiagramGenerator.prototype._collectFragmentLines = function (stmts, caller, depth) {
    var snapshot = this.lines.length;
    this._processStmts(stmts, caller, depth);
    var newLines = this.lines.splice(snapshot);
    return newLines;
  };

  PythonSequenceDiagramGenerator.prototype._hasMessages = function (fragmentLines) {
    for (var i = 0; i < fragmentLines.length; i++) {
      var s = fragmentLines[i].trim();
      if (s && !/^(alt |else |loop |opt |end|activate |deactivate |create )/.test(s)) return true;
    }
    return false;
  };

  PythonSequenceDiagramGenerator.prototype._processIf = function (stmt, caller, depth) {
    var cond = unparse(stmt.test);

    if (!stmt.orelse || stmt.orelse.length === 0) {
      var bodyLines = this._collectFragmentLines(stmt.body, caller, depth);
      if (this._hasMessages(bodyLines)) {
        this.lines.push('opt [' + cond + ']');
        this.lines = this.lines.concat(bodyLines);
        this.lines.push('end');
      } else {
        this.lines = this.lines.concat(bodyLines);
      }
      return;
    }

    var branches = [];
    var bodyLines = this._collectFragmentLines(stmt.body, caller, depth);
    branches.push({ header: 'alt [' + cond + ']', lines: bodyLines });

    var orelse = stmt.orelse;
    while (orelse && orelse.length > 0) {
      if (orelse.length === 1 && orelse[0].type === 'If') {
        var elifNode = orelse[0];
        var elifLines = this._collectFragmentLines(elifNode.body, caller, depth);
        branches.push({ header: 'else [' + unparse(elifNode.test) + ']', lines: elifLines });
        orelse = elifNode.orelse;
      } else {
        var elseLines = this._collectFragmentLines(orelse, caller, depth);
        branches.push({ header: 'else [else]', lines: elseLines });
        break;
      }
    }

    var hasAny = false;
    for (var i = 0; i < branches.length; i++) {
      if (this._hasMessages(branches[i].lines)) { hasAny = true; break; }
    }
    if (hasAny) {
      for (var i = 0; i < branches.length; i++) {
        this.lines.push(branches[i].header);
        this.lines = this.lines.concat(branches[i].lines);
      }
      this.lines.push('end');
    } else {
      for (var i = 0; i < branches.length; i++) {
        this.lines = this.lines.concat(branches[i].lines);
      }
    }
  };

  PythonSequenceDiagramGenerator.prototype._processFor = function (stmt, caller, depth) {
    var target = unparse(stmt.target);
    var iterText = unparse(stmt.iter);
    this._inferLoopVarType(stmt, caller);
    var bodyLines = this._collectFragmentLines(stmt.body, caller, depth);
    if (this._hasMessages(bodyLines)) {
      this.lines.push('loop [for ' + target + ' in ' + iterText + ']');
      this.lines = this.lines.concat(bodyLines);
      this.lines.push('end');
    } else {
      this.lines = this.lines.concat(bodyLines);
    }
  };

  PythonSequenceDiagramGenerator.prototype._processWhile = function (stmt, caller, depth) {
    var bodyLines = this._collectFragmentLines(stmt.body, caller, depth);
    if (this._hasMessages(bodyLines)) {
      this.lines.push('loop [while ' + unparse(stmt.test) + ']');
      this.lines = this.lines.concat(bodyLines);
      this.lines.push('end');
    } else {
      this.lines = this.lines.concat(bodyLines);
    }
  };

  PythonSequenceDiagramGenerator.prototype._processTry = function (stmt, caller, depth) {
    var bodyLines = this._collectFragmentLines(stmt.body, caller, depth);
    var handlerBranches = [];
    for (var i = 0; i < (stmt.handlers || []).length; i++) {
      var h = stmt.handlers[i];
      var excType = h.excType ? unparse(h.excType) : 'Exception';
      var hLines = this._collectFragmentLines(h.body, caller, depth);
      handlerBranches.push({ excType: excType, lines: hLines });
    }

    var hasBody = this._hasMessages(bodyLines);
    var hasHandlers = false;
    for (var i = 0; i < handlerBranches.length; i++) {
      if (this._hasMessages(handlerBranches[i].lines)) { hasHandlers = true; break; }
    }

    if (hasBody || hasHandlers) {
      this.lines.push('alt [try]');
      this.lines = this.lines.concat(bodyLines);
      for (var i = 0; i < handlerBranches.length; i++) {
        this.lines.push('else [except ' + handlerBranches[i].excType + ']');
        this.lines = this.lines.concat(handlerBranches[i].lines);
      }
      this.lines.push('end');
    } else {
      this.lines = this.lines.concat(bodyLines);
      for (var i = 0; i < handlerBranches.length; i++) {
        this.lines = this.lines.concat(handlerBranches[i].lines);
      }
    }
  };

  // ── Call processing ──────────────────────────────────────────────

  /**
   * Process a call node: emit a message and optionally follow the body.
   *
   * @param {object} call — Call AST node
   * @param {string} caller — current participant id
   * @param {number} depth — recursion depth
   * @param {boolean} returnCaptured — true if the call's return value is assigned
   *   to a variable (Cheers & Lin 2020: only show return arrows when the return
   *   value is consumed by subsequent logic)
   */
  PythonSequenceDiagramGenerator.prototype._processCall = function (call, caller, depth, returnCaptured) {
    // Scan arguments first (they execute before the call)
    for (var i = 0; i < (call.args || []).length; i++) {
      this._scanExprForCalls(call.args[i], caller, depth);
    }
    for (var i = 0; i < (call.keywords || []).length; i++) {
      this._scanExprForCalls(call.keywords[i].value, caller, depth);
    }

    var resolved = this._resolveCall(call, caller);
    if (!resolved) return;
    var clsName = resolved[0], method = resolved[1];

    if (this._dataClasses[clsName]) return;

    // Determine callee participant id
    var attrHint = null;
    if (call.func && call.func.type === 'Attribute'
        && call.func.value && call.func.value.type === 'Attribute'
        && call.func.value.value && call.func.value.value.type === 'Name'
        && call.func.value.value.id === 'self') {
      attrHint = call.func.value.attr;
    }
    var calleeId = this._calleeIdFor(clsName, caller, attrHint);
    var label = this._buildCallLabel(call, clsName, method);

    // Detect super() call
    var isSuper = call.func && call.func.type === 'Attribute'
        && call.func.value && call.func.value.type === 'Call'
        && call.func.value.func && call.func.value.func.type === 'Name'
        && call.func.value.func.id === 'super';

    if (method === '__init__' && !isSuper) {
      this._ensureParticipant(calleeId, clsName);
      this._callerClass[calleeId] = clsName;
      this.lines.push('create ' + calleeId);
      this.lines.push(caller + ' --> ' + calleeId + ': <<create>>');
    } else if (method === '__init__' && isSuper) {
      this._ensureParticipant(calleeId, clsName);
      this._callerClass[calleeId] = clsName;
      this.lines.push(caller + ' -> ' + calleeId + ': ' + label);
      this._maybeFollow(clsName, method, calleeId, depth);
    } else if (calleeId === caller) {
      // Self-call — no return message needed
      this.lines.push(caller + ' -> ' + caller + ': ' + label);
      this._maybeFollow(clsName, method, calleeId, depth);
    } else {
      this._ensureParticipant(calleeId, clsName);
      this._callerClass[calleeId] = clsName;
      this.lines.push(caller + ' -> ' + calleeId + ': ' + label);
      this._maybeFollow(clsName, method, calleeId, depth);
      // Return/reply message — only when return value is captured AND method has
      // a non-void return type (Cheers & Lin 2020 + Ambler G172: "Label return
      // messages only when not obvious." Void/uncaptured returns are obvious.)
      if (returnCaptured !== false) {
        var retType = this._getReturnType(clsName, method);
        if (retType) {
          this.lines.push(calleeId + ' --> ' + caller + ': ' + retType);
        }
      }
    }
  };

  PythonSequenceDiagramGenerator.prototype._buildCallLabel = function (call, clsName, method) {
    var argParts = [];
    var args = call.args || [];
    for (var i = 0; i < Math.min(args.length, 3); i++) {
      var text = unparse(args[i]);
      if (text.length > 20) text = text.substring(0, 17) + '...';
      argParts.push(text);
    }
    if (args.length > 3) argParts.push('...');
    return method + '(' + argParts.join(', ') + ')';
  };

  /** Resolve a method's return type to a known class name (for type tracking). */
  PythonSequenceDiagramGenerator.prototype._getReturnClassType = function (clsName, methodName) {
    var node = this._findMethodNode(clsName, methodName);
    if (node && node.returns) {
      return resolveAnnotationToClass(node.returns, this.allTypeNames);
    }
    return null;
  };

  PythonSequenceDiagramGenerator.prototype._getReturnType = function (clsName, methodName) {
    var node = this._findMethodNode(clsName, methodName);
    if (node && node.returns) {
      var ret = annotationStr(node.returns);
      if (ret && ret !== 'None') return ret;
    }
    return null;
  };

  PythonSequenceDiagramGenerator.prototype._findMethodNode = function (clsName, methodName) {
    var visited = {};
    var current = clsName;
    while (current && !visited[current]) {
      visited[current] = true;
      var meths = this.classMethods[current];
      if (meths && meths[methodName]) return meths[methodName];
      current = this._findParent(current);
    }
    return null;
  };

  PythonSequenceDiagramGenerator.prototype._maybeFollow = function (clsName, methodName, calleeId, depth) {
    if (depth >= this.MAX_DEPTH) return;
    var key = clsName + '::' + methodName;
    if (this._callStack[key]) return;

    var node = this._findMethodNode(clsName, methodName);
    if (!node) return;

    if (this._isStubMethod(node)) {
      var concrete = this._findConcreteOverride(clsName, methodName);
      if (concrete) {
        clsName = concrete[0];
        node = concrete[1];
        key = clsName + '::' + methodName;
        if (this._callStack[key]) return;
      }
    }

    this._callStack[key] = true;
    var saved = {};
    for (var k in this.varTypes) saved[k] = this.varTypes[k];
    this.varTypes = {};

    var pt = (this.paramTypes[clsName] || {})[methodName] || {};
    for (var k in pt) this.varTypes[k] = pt[k];

    this._processStmts(node.body, calleeId, depth + 1);

    this.varTypes = saved;
    delete this._callStack[key];
  };

  // ── Call resolution ──────────────────────────────────────────────

  PythonSequenceDiagramGenerator.prototype._resolveCall = function (call, caller) {
    var func = call.func;
    if (!func) return null;

    // ClassName(...)
    if (func.type === 'Name' && this.allTypeNames.has(func.id)) {
      return [func.id, '__init__'];
    }

    // var.method() or ClassName.static_method()
    if (func.type === 'Attribute' && func.value && func.value.type === 'Name') {
      var varName = func.value.id;
      var method = func.attr;
      if (varName === 'self') {
        var cc = this._classOf(caller);
        if (cc) return [cc, method];
      } else if (this.varTypes[varName]) {
        return [this.varTypes[varName], method];
      }
      // ClassName.static_method() — static/class method call on a known type
      if (this.allTypeNames.has(varName)) {
        var targetMeths = this.classMethods[varName] || {};
        if (targetMeths[method]) return [varName, method];
      }
      return null;
    }

    // self.attr.method()
    if (func.type === 'Attribute'
        && func.value && func.value.type === 'Attribute'
        && func.value.value && func.value.value.type === 'Name'
        && func.value.value.id === 'self') {
      var attr = func.value.attr;
      var method = func.attr;
      var cc = this._classOf(caller);
      if (cc && this.attrTypes[cc] && this.attrTypes[cc][attr]) {
        var targetCls = this.attrTypes[cc][attr];
        var targetMeths = this.classMethods[targetCls] || {};
        if (targetMeths[method]) return [targetCls, method];
      }
    }

    // super().method()
    if (func.type === 'Attribute'
        && func.value && func.value.type === 'Call'
        && func.value.func && func.value.func.type === 'Name'
        && func.value.func.id === 'super') {
      var method = func.attr;
      var cc = this._classOf(caller);
      if (cc) {
        var parent = this._findParent(cc);
        if (parent) return [parent, method];
      }
    }

    return null;
  };

  PythonSequenceDiagramGenerator.prototype._scanExprForCalls = function (node, caller, depth) {
    if (!node) return;
    if (node.type === 'Call') {
      this._processCall(node, caller, depth);
      return;
    }
    // Walk child expressions
    for (var key in node) {
      if (!node.hasOwnProperty(key)) continue;
      var val = node[key];
      if (Array.isArray(val)) {
        for (var i = 0; i < val.length; i++) {
          if (val[i] && typeof val[i] === 'object' && val[i].type) {
            this._scanExprForCalls(val[i], caller, depth);
          }
        }
      } else if (val && typeof val === 'object' && val.type) {
        this._scanExprForCalls(val, caller, depth);
      }
    }
  };

  // ── Loop variable type inference ─────────────────────────────────

  PythonSequenceDiagramGenerator.prototype._inferLoopVarType = function (forNode, caller) {
    if (!forNode.target || forNode.target.type !== 'Name') return;
    var varName = forNode.target.id;
    var it = forNode.iter;

    // for x in self.things
    if (it && it.type === 'Attribute' && it.value && it.value.type === 'Name' && it.value.id === 'self') {
      var attr = it.attr;
      var cc = this._classOf(caller);
      if (!cc) return;

      // Strategy 1: Field annotation (e.g., self._tasks: List[Task])
      var ann = (this.fieldAnnotations[cc] || {})[attr];
      if (ann) {
        var elemType = resolveAnnotationToClass(ann, this.allTypeNames);
        if (elemType) { this.varTypes[varName] = elemType; return; }
      }

      // Strategy 2: Append heuristic
      var meths = this.classMethods[cc] || {};
      for (var mname in meths) {
        var mnode = meths[mname];
        var args = mnode.args ? mnode.args.args : [];
        for (var i = 0; i < args.length; i++) {
          var a = args[i];
          if (a.arg === 'self' || a.arg === 'cls') continue;
          if (a.annotation) {
            var resolved = resolveAnnotationToClass(a.annotation, this.allTypeNames);
            if (resolved && this._methodAppendsTo(mnode, attr)) {
              this.varTypes[varName] = resolved;
              return;
            }
          }
        }
      }

      // Strategy 3: attr_types
      var elem = (this.attrTypes[cc] || {})[attr];
      if (elem) { this.varTypes[varName] = elem; return; }
    }
  };

  PythonSequenceDiagramGenerator.prototype._methodAppendsTo = function (funcNode, attrName) {
    var found = false;
    astWalk({ type: '_wrap', body: funcNode.body }, function (child) {
      if (found) return;
      if (child.type === 'Call'
          && child.func && child.func.type === 'Attribute'
          && child.func.attr === 'append'
          && child.func.value && child.func.value.type === 'Attribute'
          && child.func.value.value && child.func.value.value.type === 'Name'
          && child.func.value.value.id === 'self'
          && child.func.value.attr === attrName) {
        found = true;
      }
    });
    return found;
  };

  // ── Helpers ──────────────────────────────────────────────────────

  PythonSequenceDiagramGenerator.prototype._ensureParticipant = function (pid, label) {
    if (!this._participantSet[pid]) {
      this._participantSet[pid] = true;
      this.participants.push({ id: pid, label: label });
    }
  };

  PythonSequenceDiagramGenerator.prototype._calleeIdFor = function (clsName, caller, attrHint) {
    for (var i = 0; i < this.participants.length; i++) {
      var p = this.participants[i];
      if (this._callerClass[p.id] === clsName && p.id !== 'Main') return p.id;
    }
    if (attrHint) return attrHint;
    for (var v in this.varTypes) {
      if (this.varTypes[v] === clsName) return v;
    }
    return clsName;
  };

  PythonSequenceDiagramGenerator.prototype._classOf = function (participantId) {
    if (this._callerClass[participantId]) return this._callerClass[participantId];
    if (this.allTypeNames.has(participantId)) return participantId;
    return null;
  };

  PythonSequenceDiagramGenerator.prototype._findParent = function (clsName) {
    var bases = this.classBases[clsName] || [];
    for (var i = 0; i < bases.length; i++) {
      var b = bases[i];
      if (b === 'ABC' || b === 'ABCMeta') continue;
      if (this.classMethods[b]) return b;
    }
    return null;
  };

  PythonSequenceDiagramGenerator.prototype._isStubMethod = function (node) {
    var body = node.body || [];
    if (body.length === 0) return true;
    var stmts = body;
    // Skip docstring
    if (stmts[0] && stmts[0].type === 'Expr' && stmts[0].value
        && stmts[0].value.type === 'Constant' && typeof stmts[0].value.value === 'string') {
      stmts = stmts.slice(1);
    }
    if (stmts.length === 0) return true;
    if (stmts.length === 1) {
      var s = stmts[0];
      if (s.type === 'Pass') return true;
      if (s.type === 'Expr' && s.value && s.value.type === 'Constant' && s.value.value === '...') return true;
      if (s.type === 'Raise') return true;
      if (s.type === 'Return' && (!s.value || s.value.type === 'Constant')) return true;
    }
    return false;
  };

  PythonSequenceDiagramGenerator.prototype._findConcreteOverride = function (clsName, methodName) {
    for (var cname in this.classBases) {
      var bases = this.classBases[cname];
      if (bases.indexOf(clsName) !== -1 && this.classMethods[cname]) {
        var meths = this.classMethods[cname];
        if (meths[methodName] && !this._isStubMethod(meths[methodName])) {
          return [cname, meths[methodName]];
        }
      }
    }
    return null;
  };

  /* ===================================================================
   * Utility functions
   * =================================================================== */

  /** Check if an expression is an empty collection literal: [], {}, set(), dict(), list() */
  function _isEmptyCollection(node) {
    if (!node) return false;
    // []
    if (node.type === 'List' && (!node.elts || node.elts.length === 0)) return true;
    // {}
    if (node.type === 'Dict' && (!node.keys || node.keys.length === 0)) return true;
    if (node.type === 'Set' && (!node.elts || node.elts.length === 0)) return true;
    // list(), dict(), set(), tuple()
    if (node.type === 'Call' && node.func && node.func.type === 'Name') {
      var name = node.func.id;
      if ((name === 'list' || name === 'dict' || name === 'set' || name === 'tuple')
          && (!node.args || node.args.length === 0)) {
        return true;
      }
    }
    return false;
  }

  function _addUnique(arr, item) {
    if (arr.indexOf(item) === -1) arr.push(item);
  }

  function _topoSortClasses(classes) {
    var map = {};
    for (var i = 0; i < classes.length; i++) map[classes[i].name] = classes[i];
    var visited = {};
    var order = [];
    function visit(cls) {
      if (visited[cls.name]) return;
      visited[cls.name] = true;
      for (var j = 0; j < cls.bases.length; j++) {
        if (map[cls.bases[j]]) visit(map[cls.bases[j]]);
      }
      order.push(cls);
    }
    for (var i = 0; i < classes.length; i++) visit(classes[i]);
    return order;
  }

  function _isAbstractClass(cls) {
    for (var i = 0; i < cls.bases.length; i++) {
      if (cls.bases[i] === 'ABC' || cls.bases[i] === 'ABCMeta') return true;
    }
    for (var i = 0; i < cls.methods.length; i++) {
      if (cls.methods[i].isAbstract) return true;
    }
    return false;
  }

  function _isInterface(cls, allTypeNames) {
    // Protocol base → interface
    if (cls.bases.indexOf('Protocol') !== -1) return true;
    if (!_isAbstractClass(cls)) return false;
    // All abstract, no attributes → interface
    if (cls.attributes.length > 0) return false;
    for (var i = 0; i < cls.methods.length; i++) {
      if (cls.methods[i].name === '__init__') continue;
      if (!cls.methods[i].isAbstract) return false;
    }
    return true;
  }

  function _isEnum(cls) {
    return cls.bases.indexOf('Enum') !== -1
        || cls.bases.indexOf('IntEnum') !== -1
        || cls.bases.indexOf('StrEnum') !== -1;
  }

  /* ===================================================================
   * Export
   * =================================================================== */

  global.analyzePythonSources = analyzePythonSources;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
