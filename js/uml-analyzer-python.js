/**
 * Python UML Analyzer — extracts class diagrams and sequence diagrams from
 * Python source code using a lightweight line-based parser.
 *
 * No external dependencies — runs synchronously in the browser main thread
 * for sub-10ms latency on tutorial-scale files (a previous Pyodide-based
 * `uml-analyzer.py` handled this and was ~100x slower; removed in favor
 * of this native JS analyzer).
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
  const SequenceDiagnostics = typeof module !== 'undefined' && module.exports
    ? require('./uml-sequence-diagnostics.js') : global.UMLSequenceDiagnostics;

  /* ===================================================================
   * Main entry point
   * =================================================================== */

  function analyzePythonSources(sources, options) {
    var errors = [];
    var allTypeNames = new Set();
    var parsedFiles = {};

    // Parse all source files
    for (var filename in sources) {
      if (!sources.hasOwnProperty(filename)) continue;
      try {
        var ast = parsePythonSource(sources[filename]);
        parsedFiles[filename] = ast;
      } catch (e) {
        errors.push(filename + ': Parse error: ' + e.message);
      }
    }

    // Resolve supplied-source names once so both diagrams use the same identities.
    var symbols = new PythonSourceSymbols(parsedFiles);
    symbols.normalize();
    symbols.classes.forEach(function (entry) { allTypeNames.add(entry.id); });

    // Extract class diagram
    var extractor = new PythonClassExtractor(parsedFiles, allTypeNames, errors);
    extractor.symbols = symbols;
    extractor.analyze();
    var classDiagram = extractor.generatePlantUML(options || {});

    // Extract sequence diagram
    var seqGen = new PythonSequenceDiagramGenerator(parsedFiles, extractor, allTypeNames);
    var sequenceDiagram = '';
    let sequenceFailed = false;
    try {
      seqGen.generate();
      sequenceDiagram = seqGen.generatePlantUML();
    } catch (error) {
      if (!(error instanceof PythonSequenceLimitError)) throw error;
      sequenceFailed = true;
      errors.push(error.message);
    }

    return {
      classDiagram: classDiagram,
      constructionMethods: extractor.constructionMethods,
      ...seqGen.diagnostics.result(sequenceDiagram, { failed: sequenceFailed }),
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
      // Remove prefix — remember if it was an f-string so downstream code can
      // see through the interpolations (the value still contains `{name}`
      // syntax verbatim since this lightweight parser doesn't split f-strings
      // into JoinedStr/FormattedValue nodes).
      var isF = false;
      while (/[fFrRbBuU]/.test(s[0])) {
        if (s[0] === 'f' || s[0] === 'F') isF = true;
        s = s.substring(1);
      }
      if (s.startsWith('"""') || s.startsWith("'''")) s = s.slice(3, -3);
      else s = s.slice(1, -1);
      var node = { type: 'Constant', value: s, sourceLiteral: tok.v };
      if (isF) node.isFString = true;
      return node;
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
      const expression = parser.parseExpr();
      if (!parser.atEnd()) expression.inferenceIncomplete = true;
      return expression;
    } catch (e) {
      return { type: 'Constant', value: text.trim(), inferenceIncomplete: true };
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

    // Preserve unsupported syntax so inference cannot silently treat it as a name.
    if (/^(?:yield|match|case|async\s+(?:with|for))\b/.test(text)) {
      ctx.pos++;
      if (text.endsWith(':')) parseBody(ctx, blockIndent);
      return { type: 'Unsupported', text: text };
    }

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
    if (/^(?:import|from)\s/.test(text)) return { type: 'Import', text: text };
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
    var orelse = [];

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
        orelse = parseBody(ctx, blockIndent);
      } else {
        break;
      }
    }

    return { type: 'Try', body: body, handlers: handlers, orelse: orelse, finalbody: finalbody };
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
   * Supplied-source symbol resolution
   * =================================================================== */

  function pythonModuleName(filename) {
    return filename.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\.pyi?$/, '')
      .replace(/\/__init__$/, '').replace(/\//g, '.');
  }

  function bindPythonSourceName(scope, name, binding) {
    // Source-only resolution cannot pick one binding for a name that is
    // reassigned at runtime. Keep such references unresolved.
    scope.bindings.set(name, scope.bindings.has(name) ? { kind: 'unknown' } : binding);
  }

  function PythonSourceSymbols(parsedFiles) {
    this.parsedFiles = parsedFiles;
    this.modules = new Map();
    this.classes = [];
    this.nodeScopes = new WeakMap();
    this.bySimpleName = new Map();
    for (const filename of Object.keys(parsedFiles)) {
      const scope = { kind: 'module', filename, module: pythonModuleName(filename), path: '', parent: null, bindings: new Map() };
      this.modules.set(scope.module, scope);
      this.collect(parsedFiles[filename].body, scope);
    }
    const usedIds = new Set();
    const ordered = this.classes.slice().sort((left, right) => {
      const uniqueLeft = this.bySimpleName.get(left.name).length === 1;
      const uniqueRight = this.bySimpleName.get(right.name).length === 1;
      return Number(uniqueRight) - Number(uniqueLeft) ||
        (left.scope.module + '.' + left.path).localeCompare(right.scope.module + '.' + right.path);
    });
    for (const entry of ordered) {
      const candidates = this.bySimpleName.get(entry.name);
      const baseId = candidates.length === 1 ? entry.name : [entry.scope.module, entry.path].filter(Boolean).join('.').replace(/[^\w]/g, '__');
      let id = baseId, suffix = 2;
      while (usedIds.has(id)) id = baseId + '__' + suffix++;
      entry.id = id;
      usedIds.add(id);
    }
  }

  PythonSourceSymbols.prototype.collect = function (body, scope) {
    for (const node of body) {
      this.nodeScopes.set(node, scope);
      if (node.type === 'ClassDef' || node.type === 'FunctionDef') {
        const path = scope.path ? scope.path + '.' + node.name : node.name;
        const childScope = { kind: node.type === 'ClassDef' ? 'class' : 'function', filename: scope.filename,
          module: scope.module, path, parent: scope, bindings: new Map() };
        if (node.type === 'ClassDef') {
          const entry = { node, name: node.name, path, scope, childScope };
          this.classes.push(entry);
          if (!this.bySimpleName.has(node.name)) this.bySimpleName.set(node.name, []);
          this.bySimpleName.get(node.name).push(entry);
          bindPythonSourceName(scope, node.name, { kind: 'class', entry });
        } else {
          bindPythonSourceName(scope, node.name, { kind: 'unknown' });
          for (const arg of node.args.args) childScope.bindings.set(arg.arg, { kind: 'unknown' });
        }
        this.nodeScopes.set(node.body, childScope);
        this.collect(node.body, childScope);
      } else if (node.type === 'Import') {
        this.collectImport(node.text, scope);
      } else if (node.type === 'Assign' || node.type === 'AnnAssign') {
        for (const target of node.targets || [node.target]) {
          if (target && target.type === 'Name') {
            bindPythonSourceName(scope, target.id, { kind: 'alias', value: node.value, scope });
          }
        }
      } else {
        for (const key of ['body', 'orelse', 'finalbody']) {
          if (Array.isArray(node[key])) this.collect(node[key], scope);
        }
        for (const handler of node.handlers || []) this.collect(handler.body || [], scope);
      }
    }
  };

  PythonSourceSymbols.prototype.collectImport = function (text, scope) {
    const from = /^from\s+([.\w]+)\s+import\s+(.+)$/.exec(text || '');
    const imported = from ? from[2].replace(/^\(|\)$/g, '') : (text || '').replace(/^import\s+/, '');
    let module = from ? from[1] : '';
    if (module.startsWith('.')) {
      const dots = /^\.+/.exec(module)[0].length;
      const packageParts = scope.module.split('.');
      if (!/(?:^|\/)__init__\.pyi?$/.test(scope.filename)) packageParts.pop();
      module = packageParts.slice(0, Math.max(0, packageParts.length - dots + 1))
        .concat(module.slice(dots).split('.').filter(Boolean)).join('.');
    }
    for (const part of _splitCommaTopLevel(imported)) {
      const match = /^\s*([\w.]+)(?:\s+as\s+(\w+))?\s*$/.exec(part);
      if (!match) continue;
      const local = match[2] || (from ? match[1] : match[1].split('.')[0]);
      const path = from ? [module, match[1]].filter(Boolean).join('.') : (match[2] ? match[1] : local);
      bindPythonSourceName(scope, local, { kind: 'import', path });
    }
  };

  PythonSourceSymbols.prototype.resolvePath = function (path, visited) {
    if (this.modules.has(path)) return { kind: 'module', scope: this.modules.get(path) };
    const parts = path.split('.');
    for (let split = parts.length - 1; split > 0; split--) {
      const module = this.modules.get(parts.slice(0, split).join('.'));
      if (module) return this.resolve(parts.slice(split).join('.'), module, visited, false);
    }
    return { kind: 'external', path };
  };

  PythonSourceSymbols.prototype.resolve = function (name, scope, visited, lexical) {
    visited = visited || new Set();
    const parts = name.split('.');
    let binding = null;
    for (let owner = scope; owner; owner = lexical === false ? null : owner.parent) {
      // A class body has its own namespace, but it is not an enclosing
      // lexical scope for methods or nested class bodies.
      if (owner !== scope && owner.kind === 'class') continue;
      if (owner.bindings.has(parts[0])) { binding = owner.bindings.get(parts[0]); break; }
    }
    if (!binding) {
      // Merely supplying another module never imports its names. Keep dotted
      // external syntax for supported annotations such as typing.Optional,
      // but do not use it to discover unrelated supplied declarations.
      return parts.length > 1 ? { kind: 'external', path: name } : null;
    }
    if (visited.has(binding)) return null;
    visited = new Set(visited).add(binding);
    if (binding.kind === 'import') {
      return this.resolvePath([binding.path].concat(parts.slice(1)).join('.'), visited);
    }
    if (binding.kind === 'alias') {
      const value = unquoteAnnotation(binding.value);
      if (!value || !['Name', 'Attribute'].includes(value.type)) return parts.length === 1 ? binding : null;
      const target = this.resolve(unparse(value), binding.scope, visited);
      if (!target || parts.length === 1) return target;
      binding = target;
    }
    if (parts.length === 1) return binding;
    if (binding.kind === 'class') return this.resolve(parts.slice(1).join('.'), binding.entry.childScope, visited, false);
    if (binding.kind === 'module') return this.resolve(parts.slice(1).join('.'), binding.scope, visited, false);
    return null;
  };

  PythonSourceSymbols.prototype.annotation = function (node, scope, visited) {
    node = unquoteAnnotation(node);
    if (!node) return node;
    visited = visited || new Set();
    if (node.type === 'Name' || node.type === 'Attribute') {
      const symbol = this.resolve(unparse(node), scope);
      if (symbol && symbol.kind === 'class') return { type: 'Name', id: symbol.entry.id, _resolvedClass: true };
      if (symbol && symbol.kind === 'alias' && !visited.has(symbol)) {
        return this.annotation(symbol.value, symbol.scope, new Set(visited).add(symbol));
      }
      if (symbol && symbol.kind === 'external') return parseExpr(symbol.path);
      if (node.type === 'Name' && (symbol || this.bySimpleName.has(node.id))) {
        return { type: 'Name', id: node.id, _unresolvedType: true };
      }
      return node;
    }
    if (node.type === 'Subscript') return { type: 'Subscript', value: this.annotation(node.value, scope, visited), slice: this.annotation(node.slice, scope, visited) };
    if (node.type === 'Tuple') return { type: 'Tuple', elts: node.elts.map(element => this.annotation(element, scope, visited)) };
    if (node.type === 'BinOp' && node.op === '|') return { type: 'BinOp', op: '|', left: this.annotation(node.left, scope, visited), right: this.annotation(node.right, scope, visited) };
    return node;
  };

  PythonSourceSymbols.prototype.normalize = function () {
    const normalizeAnnotation = (annotation, scope) => {
      const normalized = this.annotation(annotation, scope);
      return normalized ? Object.assign({}, normalized, { _annotationText: unparse(annotation) }) : normalized;
    };
    const normalizeNode = (node, scope) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(item => normalizeNode(item, scope)); return; }
      if (node.type === 'ClassDef' || node.type === 'FunctionDef') {
        if (node.type === 'ClassDef') {
          const entry = this.classes.find(candidate => candidate.node === node);
          node.name = entry.id;
          node.bases = node.bases.map(base => {
            const symbol = this.resolve(base, scope);
            return symbol && symbol.kind === 'class' ? symbol.entry.id : base;
          });
        } else {
          for (const arg of node.args.args) {
            if (arg.annotation) arg.annotation = normalizeAnnotation(arg.annotation, scope);
          }
          if (node.returns) node.returns = normalizeAnnotation(node.returns, scope);
        }
        normalizeNode(node.body, this.nodeScopes.get(node.body));
        return;
      }
      if (node.annotation) node.annotation = normalizeAnnotation(node.annotation, scope);
      if (node.type === 'Call') {
        const symbol = this.resolve(unparse(node.func), scope);
        node._classTarget = symbol && symbol.kind === 'class' ? symbol.entry.id : null;
        if (node._classTarget) node.func = { type: 'Name', id: node._classTarget };
        else if (node.func.type === 'Attribute') {
          const receiver = this.resolve(unparse(node.func.value), scope);
          if (receiver && receiver.kind === 'class') {
            node.func.value = { type: 'Name', id: receiver.entry.id, _typeTarget: receiver.entry.id };
          } else if (node.func.value) {
            node.func.value._typeTarget = null;
          }
        }
      }
      for (const key of Object.keys(node)) {
        if (key !== 'annotation' && typeof node[key] === 'object') normalizeNode(node[key], scope);
      }
    };
    for (const [module, scope] of this.modules) normalizeNode(this.parsedFiles[scope.filename], scope);
  };

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

  /**
   * Convert an AST expression back to readable text.
   *
   * Optional `caller` rewrites `self` references to the given participant id
   * during unparse. This is the sound, scope-aware analog of the naive
   * `str.replace('self.', caller + '.')` and avoids its failure modes:
   *   - identifiers sharing the substring (`myself.x` → `mybot.x`)
   *   - string-literal corruption (f-strings with `"self.x"` in the constant
   *     part)
   *   - bare `self` references (e.g. `isinstance(self, Foo)`) that a textual
   *     `self.` match would miss entirely
   *
   * Scoping: a `Lambda` whose first argument is named `self` shadows the
   * outer binding, so substitution is disabled for its body. (Python methods
   * are parsed as FunctionDef — they do not appear in expression context and
   * so need no handling here.)
   */
  function unparse(node, caller) {
    if (!node) return '';
    switch (node.type) {
      case 'Name':
        return (caller && caller !== 'self' && node.id === 'self') ? caller : node.id;
      case 'Constant':
        if (node.value === true) return 'True';
        if (node.value === false) return 'False';
        if (node.value === null) return 'None';
        if (typeof node.value === 'string') return node.sourceLiteral || "'" + node.value + "'";
        return String(node.value);
      case 'Attribute': return unparse(node.value, caller) + '.' + node.attr;
      case 'Call':
        var args = (node.args || []).map(function (a) { return unparse(a, caller); });
        var kws = (node.keywords || []).map(function (kw) {
          return kw.arg ? kw.arg + '=' + unparse(kw.value, caller) : '**' + unparse(kw.value, caller);
        });
        return unparse(node.func, caller) + '(' + args.concat(kws).join(', ') + ')';
      case 'Subscript': return unparse(node.value, caller) + '[' + unparse(node.slice, caller) + ']';
      case 'Tuple': return (node.elts || []).map(function (e) { return unparse(e, caller); }).join(', ');
      case 'List': return '[' + (node.elts || []).map(function (e) { return unparse(e, caller); }).join(', ') + ']';
      case 'Dict':
        var items = [];
        for (var i = 0; i < (node.keys || []).length; i++) {
          items.push(unparse(node.keys[i], caller) + ': ' + unparse(node.values[i], caller));
        }
        return '{' + items.join(', ') + '}';
      case 'Compare':
        var s = unparse(node.left, caller);
        for (var i = 0; i < node.ops.length; i++) {
          s += ' ' + node.ops[i] + ' ' + unparse(node.comparators[i], caller);
        }
        return s;
      case 'BoolOp':
        return (node.values || []).map(function (v) { return unparse(v, caller); }).join(' ' + node.op + ' ');
      case 'BinOp': return unparse(node.left, caller) + ' ' + node.op + ' ' + unparse(node.right, caller);
      case 'UnaryOp': return node.op + (node.op === 'not' ? ' ' : '') + unparse(node.operand, caller);
      case 'IfExp':
        return unparse(node.body, caller) + ' if ' + unparse(node.test, caller) + ' else ' + unparse(node.orelse, caller);
      case 'Starred': return '*' + unparse(node.value, caller);
      case 'Lambda':
        var rebindsSelf = node.args && node.args.args
            && node.args.args.length > 0 && node.args.args[0].arg === 'self';
        return 'lambda: ' + unparse(node.body, rebindsSelf ? null : caller);
      default: return '...';
    }
  }

  /**
   * Infer multiplicity from a type annotation node.
   * Collections describe many related elements, even when the collection itself
   * is optional. Nullable scalar annotations describe zero or one element.
   */
  function inferMultiplicity(annNode, targetClass) {
    const annotation = unquoteAnnotation(annNode);
    if (!annotation) return '1';
    if (annotation.type === 'Subscript') {
      const wrapper = annotationWrapperName(annotation.value);
      if (CONTAINER_TYPES.has(wrapper) || MAPPING_TYPES.has(wrapper)) return '*';
      if (wrapper === 'Optional') {
        return inferMultiplicity(annotation.slice, targetClass) === '*' ? '*' : '0..1';
      }
    }
    const alternatives = annotationUnionMembers(annotation);
    if (alternatives.length) {
      // Other union arms may contain collections of unrelated types. Their
      // cardinality says nothing about this relationship's target class.
      const targets = targetClass ? new Set([targetClass]) : null;
      const contributing = targets
        ? alternatives.filter(member => extractClassFromAnnotation(member, targets))
        : alternatives;
      const multiplicities = contributing.map(member => inferMultiplicity(member, targetClass));
      if (multiplicities.includes('*')) return '*';
      if (contributing.length < alternatives.length || multiplicities.includes('0..1')) return '0..1';
      if (alternatives.some(member => {
        const normalized = unquoteAnnotation(member);
        return normalized && normalized.type === 'Constant' && normalized.value === null;
      })) return '0..1';
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
    return node && node._annotationText || unparse(node);
  }

  /** Check if a node is self.xxx */
  function isSelfAttr(node) {
    return node && node.type === 'Attribute' && node.value && node.value.type === 'Name' && node.value.id === 'self';
  }

  /** Get the callee name from a Call node's func. */
  function callName(node) {
    if (node.type !== 'Call') return null;
    if (Object.prototype.hasOwnProperty.call(node, '_classTarget')) return node._classTarget;
    var f = node.func;
    if (f.type === 'Name') return f.id;
    if (f.type === 'Attribute') return f.attr;
    return null;
  }

  /* ===================================================================
   * Container / annotation type utilities
   * =================================================================== */

  const CONTAINER_TYPES = new Set(['List', 'list', 'Set', 'set', 'Tuple', 'tuple',
    'FrozenSet', 'frozenset', 'Sequence', 'Iterable', 'Collection', 'Deque', 'deque']);
  const MAPPING_TYPES = new Set(['Dict', 'dict', 'Mapping', 'DefaultDict', 'OrderedDict']);

  // Forward annotations contain Python type syntax, never executable code.
  function unquoteAnnotation(node) {
    while (node && node.type === 'Constant' && typeof node.value === 'string') {
      const parsed = parseExpr(node.value);
      // The lightweight parser also represents Ellipsis as the string '...'.
      if (parsed && parsed.type === 'Constant' && parsed.value === node.value) return parsed;
      node = parsed;
    }
    return node;
  }

  function annotationWrapperName(node) {
    if (!node) return '';
    if (node._resolvedClass || node._unresolvedType) return '';
    if (node.type === 'Name') return node.id;
    const qualified = unparse(node);
    const match = /^(?:typing|collections\.abc)\.(\w+)$/.exec(qualified);
    return match ? match[1] : '';
  }

  function annotationUnionMembers(node) {
    if (!node) return [];
    if (node.type === 'BinOp' && node.op === '|') {
      return [node.left, node.right].flatMap(member => {
        const nested = annotationUnionMembers(member);
        return nested.length ? nested : [member];
      });
    }
    if (node.type === 'Subscript' && annotationWrapperName(node.value) === 'Union') {
      return node.slice && node.slice.type === 'Tuple' ? node.slice.elts : [node.slice];
    }
    return [];
  }

  /** Extract every known target from an annotation, preserving union alternatives. */
  function extractClassesFromAnnotation(node, allTypeNames) {
    node = unquoteAnnotation(node);
    if (!node) return [];
    if (node._unresolvedType) return [];
    if (node.type === 'Name') return allTypeNames.has(node.id) ? [node.id] : [];
    const alternatives = annotationUnionMembers(node);
    if (alternatives.length) return [...new Set(alternatives.flatMap(alternative => extractClassesFromAnnotation(alternative, allTypeNames)))];
    if (node.type === 'Subscript') {
      if (node.value && node.value.type === 'Name' && !node.value._unresolvedType && allTypeNames.has(node.value.id)) {
        return [node.value.id];
      }
      const wrapper = annotationWrapperName(node.value);
      if (CONTAINER_TYPES.has(wrapper) || wrapper === 'Optional') {
        const elements = node.slice && node.slice.type === 'Tuple' ? node.slice.elts : [node.slice];
        return [...new Set(elements.flatMap(element => extractClassesFromAnnotation(element, allTypeNames)))];
      }
      if (MAPPING_TYPES.has(wrapper)) {
        if (node.slice && node.slice.type === 'Tuple' && node.slice.elts && node.slice.elts.length === 2) {
          return extractClassesFromAnnotation(node.slice.elts[1], allTypeNames);
        }
      }
    }
    return [];
  }

  function extractClassFromAnnotation(node, allTypeNames) {
    const classes = extractClassesFromAnnotation(node, allTypeNames);
    return classes.length === 1 ? classes[0] : null;
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
    this.dependencies = [];  // [className]
    this._relAttrs = {};     // attribute names promoted to relationship arrows
    this.relationships = []; // Stored references: [{target, attrName, multiplicity}]
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
        this._extractFromBody(node.body, filename);
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
    var isSetter = (node.decorators || []).indexOf('setter') !== -1;
    var isDeleter = (node.decorators || []).indexOf('deleter') !== -1;

    // Skip property setters/deleters — the @property getter already shows the attribute
    if (isSetter || isDeleter) return;

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
      returnType: returnType,
      isConstructor: ['__init__', '__new__'].includes(node.name),
      isDefault: params.length === 0 && node.body.every(statement =>
        statement.type === 'Pass' ||
        (statement.type === 'Expr' && statement.value?.type === 'Constant' && typeof statement.value.value === 'string') ||
        (statement.type === 'Return' && (!statement.value || (statement.value.type === 'Constant' && statement.value.value === null))))
    });

    // Keep the complete annotation: a parameter may describe several targets.
    var initParamTypes = {};
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a.arg !== 'self' && a.arg !== 'cls' && a.annotation) initParamTypes[a.arg] = a.annotation;
    }

    var localCreations = {};
    var self = this;
    walkPythonMethodBody(node.body, function (child) {
      if (child.type === 'Assign' && child.targets && child.targets.length === 1) {
        var tgt = child.targets[0];
        if (tgt.type === 'Name' && child.value && child.value.type === 'Call') {
          var callee = callName(child.value);
          if (callee && self.allTypeNames.has(callee)) localCreations[tgt.id] = callee;
        }
      }
      self._checkAttribute(child, classInfo);
      self._checkFieldRelationship(child, classInfo, initParamTypes, localCreations);
    });
  };

  // Nested functions/classes have their own receivers; their assignments are
  // not fields of the enclosing method's class.
  function walkPythonMethodBody(body, visit) {
    for (const node of body) {
      if (node.type === 'FunctionDef' || node.type === 'ClassDef') continue;
      visit(node);
      for (const key of ['body', 'orelse', 'finalbody']) {
        if (Array.isArray(node[key])) walkPythonMethodBody(node[key], visit);
      }
      for (const handler of node.handlers || []) walkPythonMethodBody(handler.body || [], visit);
    }
  }

  PythonClassExtractor.prototype._recordRelationship = function (info, target, attrName, multiplicity) {
    // Retaining an object proves a reference, not its ownership or lifecycle.
    const existing = info.relationships.find(relation => relation.target === target && relation.attrName === attrName);
    if (existing) {
      if (multiplicity === '*' || !existing.multiplicity) existing.multiplicity = multiplicity;
    } else {
      info.relationships.push({ target, attrName, multiplicity });
    }
    info._relAttrs[attrName] = true;
  };

  PythonClassExtractor.prototype._annotationRelationships = function (info, annotation, attrName, multiplicity) {
    for (const target of extractClassesFromAnnotation(annotation, this.allTypeNames)) {
      this._recordRelationship(info, target, attrName, multiplicity || inferMultiplicity(annotation, target));
    }
  };

  PythonClassExtractor.prototype._extractClassLevelAnnotation = function (node, classInfo) {
    if (!node.target || node.target.type !== 'Name') return;
    var attrName = node.target.id;
    if (!classInfo.attributes.some(attribute => attribute.name === attrName)) {
      classInfo.attributes.push({ name: attrName, typeHint: node.annotation ? annotationStr(node.annotation) : null });
    }
    this._annotationRelationships(classInfo, node.annotation, attrName);
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

  PythonClassExtractor.prototype._checkFieldRelationship = function (node, info, parameterAnnotations, localCreations) {
    if (node.type === 'Assign' || node.type === 'AnnAssign') {
      for (const target of node.targets || [node.target]) {
        if (!isSelfAttr(target)) continue;
        const annotation = node.annotation;
        const value = node.value;
        const attrName = target.attr;
        if (annotation) this._annotationRelationships(info, annotation, attrName);
        if (!value) continue;
        if (value.type === 'Call') {
          const created = callName(value);
          if (created && this.allTypeNames.has(created)) {
            this._recordRelationship(info, created, attrName, annotation ? inferMultiplicity(annotation, created) : null);
          }
        } else if (value.type === 'Name') {
          if (!annotation && parameterAnnotations[value.id]) {
            const parameterAnnotation = parameterAnnotations[value.id];
            for (const related of extractClassesFromAnnotation(parameterAnnotation, this.allTypeNames)) {
              const multiplicity = inferMultiplicity(parameterAnnotation, related);
              // Keep the tutorial's distinction between an explicit scalar
              // field bound and a type learned only from its supplied argument.
              this._recordRelationship(info, related, attrName, multiplicity === '1' ? null : multiplicity);
            }
          } else if (localCreations[value.id]) {
            this._recordRelationship(info, localCreations[value.id], attrName, annotation ? inferMultiplicity(annotation, localCreations[value.id]) : null);
          }
        } else if (value.type === 'List') {
          for (const element of value.elts || []) {
            const created = element.type === 'Call' ? callName(element) : localCreations[element.id];
            if (created && this.allTypeNames.has(created)) this._recordRelationship(info, created, attrName, '*');
          }
        }
      }
      return;
    }
    if (node.type !== 'Expr' || !node.value || node.value.type !== 'Call') return;
    const call = node.value;
    const func = call.func;
    if (func.type !== 'Attribute' || !['append', 'add'].includes(func.attr) || !isSelfAttr(func.value) || !call.args.length) return;
    const value = call.args[0];
    const created = value.type === 'Call' ? callName(value) : localCreations[value.id];
    if (created && this.allTypeNames.has(created)) {
      this._recordRelationship(info, created, func.value.attr, '*');
    } else if (value.type === 'Name' && parameterAnnotations[value.id]) {
      this._annotationRelationships(info, parameterAnnotations[value.id], func.value.attr, '*');
    }
  };

  PythonClassExtractor.prototype._collectDependencies = function (classNode, classInfo) {
    var structural = {};
    var arr = classInfo.relationships.map(relation => relation.target).concat(classInfo.bases);
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
          for (const paramCls of extractClassesFromAnnotation(a.annotation, self.allTypeNames)) {
            if (structural[paramCls]) continue;
            _addUnique(classInfo.dependencies, paramCls);
          }
        }
      }

      // Return type → dependency
      if (item.returns) {
        for (const retCls of extractClassesFromAnnotation(item.returns, self.allTypeNames)) {
          if (!structural[retCls]) _addUnique(classInfo.dependencies, retCls);
        }
      }

      // Local ClassName() calls and raise statements → dependency
      if (item.name !== '__init__') {
        walkPythonMethodBody(item.body, function (child) {
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
        walkPythonMethodBody(item.body, function (child) {
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

  PythonClassExtractor.prototype.generatePlantUML = function (options) {
    this.constructionMethods = [];
    if (this.classes.length === 0) return '';
    var hideVis = options && options.hideVisibility;
    var hideMult = options && options.hideMultiplicity;
    var lines = ['@startuml', 'layout landscape', 'layout compact'];
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

      // Scalar references are represented by arrows. Collection fields stay
      // visible as well, preserving the tutorial's container representation.
      for (var j = 0; j < cls.attributes.length; j++) {
        var attr = cls.attributes[j];
        const isCollection = cls.relationships.some(relation => relation.attrName === attr.name && relation.multiplicity === '*');
        if (cls._relAttrs[attr.name] && !isCollection) continue;
        // Visibility: __ → private, _ → protected, else → public
        var prefix;
        if (hideVis) {
          prefix = '';
        } else if (attr.name.startsWith('__') && !attr.name.endsWith('__')) {
          prefix = '-';
        } else if (attr.name.startsWith('_')) {
          prefix = '#';
        } else {
          prefix = '+';
        }
        var line = '  ' + prefix + attr.name;
        if (attr.typeHint) line += ': ' + attr.typeHint;
        lines.push(line);
      }

      // @property methods shown as attributes
      for (var j = 0; j < cls.methods.length; j++) {
        var m = cls.methods[j];
        if (m.isProperty) {
          var prefix = hideVis ? '' : (m.isPrivate ? '#' : '+');
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
        if (!hideVis) {
          if (m.name.startsWith('__') && !m.name.endsWith('__')) prefix += '-';
          else if (m.isPrivate) prefix += '#';
          else prefix += '+';
        }
        var methodLine = '  ' + prefix + m.name + '(' + m.params.join(', ') + ')';
        if (m.returnType) methodLine += ': ' + m.returnType;
        if (m.isConstructor) {
          this.constructionMethods.push({ owner: cls.name, name: m.name, lineIndex: lines.length, isDefault: m.isDefault });
        }
        lines.push(methodLine);
      }

      lines.push('}');
    }

    var externalBases = this._externalBaseClassNames(sorted);
    for (var eb = 0; eb < externalBases.length; eb++) {
      lines.push('class ' + externalBases[eb]);
    }

    const emittedBidir = new Set();

    // Relationships
    for (var i = 0; i < sorted.length; i++) {
      var cls = sorted[i];

      // Inheritance — use ..|> (realization) for interface/Protocol bases, --|> for class bases
      for (var j = 0; j < cls.bases.length; j++) {
        var base = cls.bases[j];
        if (base === 'ABC' || base === 'ABCMeta' || base === 'object') continue;
        var baseInfo = this.classMap[base];
        var arrow = baseInfo && _isInterface(baseInfo, this.allTypeNames) ? ' ..|> ' : ' --|> ';
        lines.push(cls.name + arrow + base);
      }

      // Distinct fields keep their own arrows. Collapse reciprocal references
      // only when each side has one role, so no role or cardinality is lost.
      for (const relation of cls.relationships) {
        const targetInfo = this.classMap[relation.target];
        const sameTarget = cls.relationships.filter(other => other.target === relation.target);
        const reverse = targetInfo ? targetInfo.relationships.filter(other => other.target === cls.name) : [];
        const bidirectional = sameTarget.length === 1 && reverse.length === 1;
        if (bidirectional) {
          const key = [cls.name, relation.target].sort().join('::');
          if (emittedBidir.has(key)) continue;
          emittedBidir.add(key);
          const left = !hideMult && reverse[0].multiplicity ? ' "' + reverse[0].multiplicity + '"' : '';
          const right = !hideMult && relation.multiplicity ? '"' + relation.multiplicity + '" ' : '';
          lines.push(cls.name + left + ' -- ' + right + relation.target);
          continue;
        }
        const multiplicity = !hideMult && relation.multiplicity ? '"' + relation.multiplicity + '" ' : '';
        const role = sameTarget.length > 1 ? ' : ' + relation.attrName : '';
        lines.push(cls.name + ' --> ' + multiplicity + relation.target + role);
      }

      // Dependency
      for (var j = 0; j < cls.dependencies.length; j++) {
        lines.push(cls.name + ' ..> ' + cls.dependencies[j]);
      }
    }

    lines.push('@enduml');
    return lines.join('\n');
  };

  PythonClassExtractor.prototype._externalBaseClassNames = function (classes) {
    var ignored = { ABC: true, ABCMeta: true, object: true };
    var seen = {};
    var out = [];
    for (var i = 0; i < classes.length; i++) {
      var bases = classes[i].bases || [];
      for (var j = 0; j < bases.length; j++) {
        var base = bases[j];
        if (!base || ignored[base] || this.classMap[base] || seen[base]) continue;
        seen[base] = true;
        out.push(base);
      }
    }
    return out.sort();
  };

  /* ===================================================================
   * PythonSequenceDiagramGenerator
   * =================================================================== */

  function PythonSequenceDiagramGenerator(parsedFiles, extractor, allTypeNames) {
    this.diagnostics = new SequenceDiagnostics();
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
    this._participantSet = new Set();
    this._participantIds = new Set(['Main']);
    this._symbolicParticipantIds = new Map();
    this.lines = [];

    // Scope tracking
    this.varTypes = {};
    this.varParticipants = {}; // aliases and parameter bindings to known objects
    this.fieldBindings = {}; // owning participant -> field -> object binding (null after invalidation)
    this._scopeCaller = 'Main';
    this._scopeIdentity = 'Main';
    this._invocationCount = 0;
    this._callerClass = {};
    this._referencedVars = {};   // {name: true} for names read in current scope

    // Recursion guard
    this._callStack = {};
    this.MAX_DEPTH = 3;
  }

  /**
   * Collect Load-context names anywhere in the given statements.
   *
   * Used to decide whether a reply arrow should be labeled `var: type` or
   * bare `type`: if the assignment's target is read somewhere in the scope,
   * the binding is worth showing.
   *
   * Strictly, this is the use side of reaching-definitions — a forward
   * dataflow analysis that needs a CFG. We instead use a sound
   * over-approximation: "is the name read anywhere in the scope?". Any
   * false positives are harmless extra labels; false negatives are
   * impossible because a genuine use appears as a Name in a non-write
   * position. Write positions are the slots we deliberately skip below
   * (the target of Assign / AnnAssign / For, and simple-Name components
   * of a Tuple target). Everything else is treated as a use.
   */
  function collectNameLoads(stmts) {
    var names = {};
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'Assign') {
        for (var i = 0; i < (node.targets || []).length; i++) {
          walkAsTarget(node.targets[i]);
        }
        walk(node.value);
        return;
      }
      if (node.type === 'AnnAssign') {
        walkAsTarget(node.target);
        walk(node.value);
        walk(node.annotation);
        return;
      }
      if (node.type === 'AugAssign') {
        // target is both read and written — count as read
        walk(node.target);
        walk(node.value);
        return;
      }
      if (node.type === 'For') {
        walkAsTarget(node.target);
        walk(node.iter);
        (node.body || []).forEach(walk);
        (node.orelse || []).forEach(walk);
        return;
      }
      if (node.type === 'Name') {
        names[node.id] = true;
        return;
      }
      // f-string Constant: the lightweight parser keeps `{name}` interpolations
      // as literal text in the Constant value instead of emitting JoinedStr /
      // FormattedValue nodes. Scan the raw value for `{...}` braces and pull
      // out the leading identifier of each interpolation so those reads are
      // counted toward `_referencedVars`. Covers the common case
      // `f"{count} members"` as well as `f"{obj.attr}"` and `f"{fn(x)}"`.
      if (node.type === 'Constant' && node.isFString && typeof node.value === 'string') {
        // Naive but sufficient: find `{…}` groups and extract the first
        // identifier on the inside. Doubled braces `{{` / `}}` are escapes,
        // so strip them before scanning.
        var s = node.value.replace(/\{\{/g, '').replace(/\}\}/g, '');
        var re = /\{\s*([A-Za-z_][A-Za-z0-9_]*)/g;
        var m;
        while ((m = re.exec(s)) !== null) names[m[1]] = true;
        return;
      }
      // Generic recursion into children
      for (var key in node) {
        if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
        var val = node[key];
        if (!val || typeof val !== 'object') continue;
        if (Array.isArray(val)) val.forEach(walk);
        else walk(val);
      }
    }
    function walkAsTarget(node) {
      if (!node || typeof node !== 'object') return;
      // Pure-write terminals: a Name or a Tuple of Names on the LHS
      if (node.type === 'Name') return;
      if (node.type === 'Tuple') {
        (node.elts || []).forEach(walkAsTarget);
        return;
      }
      // self.x / x[0] — the base expression IS read even though we're writing
      if (node.type === 'Attribute') { walk(node.value); return; }
      if (node.type === 'Subscript') { walk(node.value); walk(node.slice); return; }
      walk(node);
    }
    (stmts || []).forEach(walk);
    return names;
  }

  function extractFStringExpressions(value) {
    var expressions = [];
    if (typeof value !== 'string') return expressions;

    for (var i = 0; i < value.length; i++) {
      if (value[i] !== '{') continue;
      if (value[i + 1] === '{') { i++; continue; }

      var depth = 1;
      var start = i + 1;
      var j = start;
      for (; j < value.length && depth > 0; j++) {
        if (value[j] === '{') depth++;
        else if (value[j] === '}') depth--;
      }
      if (depth !== 0) break;

      var raw = value.slice(start, j - 1).trim();
      var expr = stripFStringFormat(raw);
      if (expr) expressions.push(expr);
      i = j - 1;
    }

    return expressions;
  }

  function stripFStringFormat(raw) {
    var paren = 0, bracket = 0, brace = 0;
    for (var i = 0; i < raw.length; i++) {
      var ch = raw[i];
      if (ch === '(') paren++;
      else if (ch === ')') paren = Math.max(0, paren - 1);
      else if (ch === '[') bracket++;
      else if (ch === ']') bracket = Math.max(0, bracket - 1);
      else if (ch === '{') brace++;
      else if (ch === '}') brace = Math.max(0, brace - 1);
      else if ((ch === ':' || ch === '!') && paren === 0 && bracket === 0 && brace === 0) {
        return raw.slice(0, i).trim();
      }
    }
    return raw.trim();
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
          if (item.type === 'AnnAssign' && item.target && item.target.type === 'Name') {
            fAnns[item.target.id] = item.annotation;
            const scalarType = self._scalarAnnotationClass(item.annotation);
            if (scalarType) aTypes[item.target.id] = scalarType;
          }
          if (item.type !== 'FunctionDef') continue;
          methods[item.name] = item;

          // Parameter types
          var mParams = {};
          var args = item.args ? item.args.args : [];
          for (var j = 0; j < args.length; j++) {
            var a = args[j];
            if (a.arg === 'self' || a.arg === 'cls') continue;
            if (a.annotation) {
              var resolved = self._scalarAnnotationClass(a.annotation);
              if (resolved) mParams[a.arg] = resolved;
            }
          }
          if (Object.keys(mParams).length > 0) pTypes[item.name] = mParams;

          // __init__: extract attribute types
          if (item.name === '__init__') {
            var initParams = {};
            var initAnnotations = {};
            for (var j = 0; j < args.length; j++) {
              var a = args[j];
              if (a.arg === 'self' || a.arg === 'cls') continue;
              if (a.annotation) {
                initAnnotations[a.arg] = a.annotation;
                var resolved = self._scalarAnnotationClass(a.annotation);
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
                      const cn = callName(child.value);
                      if (cn && self.allTypeNames.has(cn)) {
                        aTypes[tgt.attr] = cn;
                      }
                    } else if (child.value && child.value.type === 'Name') {
                      var pc = initParams[child.value.id];
                      if (initAnnotations[child.value.id]) fAnns[tgt.attr] = initAnnotations[child.value.id];
                      if (pc) aTypes[tgt.attr] = pc;
                    }
                  }
                }
              } else if (child.type === 'AnnAssign' && child.target && isSelfAttr(child.target)) {
                var attrName = child.target.attr;
                if (child.annotation) fAnns[attrName] = child.annotation;
                var resolved = null;
                if (child.value && child.value.type === 'Call') {
                  const cn = callName(child.value);
                  if (cn && self.allTypeNames.has(cn)) resolved = cn;
                }
                if (!resolved && child.value && child.value.type === 'Name') {
                  resolved = initParams[child.value.id];
                }
                if (!resolved && child.annotation) {
                  resolved = self._scalarAnnotationClass(child.annotation);
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

  // A collection's element type is useful for loop variables, but the
  // collection itself is not an instance of that element's class.
  PythonSequenceDiagramGenerator.prototype._scalarAnnotationClass = function (annotation) {
    const type = resolveAnnotationToClass(annotation, this.allTypeNames);
    return type && inferMultiplicity(annotation, type) !== '*' ? type : null;
  };

  PythonSequenceDiagramGenerator.prototype._identifyDataClasses = function () {
    var self = this;
    for (var fn in this.parsedFiles) {
      if (!this.parsedFiles.hasOwnProperty(fn)) continue;
      astWalk(this.parsedFiles[fn], function (node) {
        if (node.type !== 'ClassDef') return;
        if (!self.allTypeNames.has(node.name)) return;
        let hasCalls = false;
        astWalk(node, child => { if (child.type === 'Call') hasCalls = true; });
        if (hasCalls) return;
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
    this._referencedVars = collectNameLoads(entry);
    var lineStart = this.lines.length;
    this._processStmts(entry, 'Main', 0);
    if (this.lines.length > lineStart) {
      this.lines.splice(lineStart, 0, 'activate Main');
      this.lines.push('deactivate Main');
    }
  };

  PythonSequenceDiagramGenerator.prototype.generatePlantUML = function () {
    if (this.lines.length === 0) return '';
    var out = ['@startuml', 'layout landscape'];
    for (var i = 0; i < this.participants.length; i++) {
      var p = this.participants[i];
      // The synthetic "Main" participant represents the module-level entry
      // code (the `if __name__ == "__main__":` block). It is not a real
      // object instance the user named — render it as an *anonymous*
      // instance (": Main") using the `as` form that the renderer treats as
      // a label-starting-with-colon.
      if (p.id === 'Main' && p.label === 'Main') {
        out.push('participant Main as : Main');
      } else {
        out.push('participant ' + p.id + ': ' + p.label);
      }
    }
    out.push('');
    for (var i = 0; i < this.lines.length; i++) out.push(this.lines[i]);
    out.push('@enduml');
    return out.join('\n');
  };

  PythonSequenceDiagramGenerator.prototype._collectEntryStmts = function () {
    var fileEntries = {};
    var mainFile = null;
    var topStmts = [];
    for (var fn in this.parsedFiles) {
      if (!this.parsedFiles.hasOwnProperty(fn)) continue;
      var tree = this.parsedFiles[fn];
      fileEntries[fn] = [];
      for (var i = 0; i < tree.body.length; i++) {
        var node = tree.body[i];
        if (node.type === 'ClassDef' || node.type === 'FunctionDef' || node.type === 'Import') continue;
        if (node.type === 'If' && this._isMainGuard(node)) {
          mainFile = fn;
          fileEntries[fn] = fileEntries[fn].concat(node.body);
        } else {
          topStmts.push(node);
          fileEntries[fn].push(node);
        }
      }
    }
    if (mainFile !== null) return fileEntries[mainFile];
    return topStmts;
  };

  PythonSequenceDiagramGenerator.prototype._isMainGuard = function (node) {
    if (node.type !== 'If' || !node.test) return false;
    var test = node.test;
    if (test.type !== 'Compare') return false;
    if (!test.ops || test.ops.length !== 1 || test.ops[0] !== '==') return false;
    if (!test.comparators || test.comparators.length !== 1) return false;
    var comp = test.comparators[0];
    return (test.left && test.left.type === 'Name' && test.left.id === '__name__'
        && comp.type === 'Constant' && comp.value === '__main__')
      || (comp.type === 'Name' && comp.id === '__name__'
        && test.left && test.left.type === 'Constant' && test.left.value === '__main__');
  };

  // ── Statement processing ──────────────────────────────────────────

  PythonSequenceDiagramGenerator.prototype._processStmts = function (stmts, caller, depth) {
    if (depth === 0) this._sequenceVisits = 0;
    const flow = this._buildSequenceFlow(stmts, caller, depth, false);
    this.lines.push(...this._flowLines(flow));
    this._mergeScopes(this._flowOutcomes(flow).map(outcome => outcome.scope));
    return flow;
  };

  PythonSequenceDiagramGenerator.prototype._processStmt = function (stmt, caller, depth, preservePaths) {
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
        return this._completion('Return');
      case 'Raise':
        this.diagnostics.add('control', 'Exception propagation');
        if (stmt.exc) this._scanExprForCalls(stmt.exc, caller, depth);
        return this._completion('Raise');
      case 'Break': case 'Continue': return this._completion(stmt.type);
      case 'If':
        if (!this._isMainGuard(stmt)) return this._processIf(stmt, caller, depth, { preservePaths });
        return this._collectFragment(stmt.body, caller, depth, preservePaths);
      case 'For': return this._processFor(stmt, caller, depth);
      case 'While': return this._processWhile(stmt, caller, depth);
      case 'With':
        this.diagnostics.add('unsupported', 'Context manager entry and exit are omitted');
        return this._collectFragment(stmt.body, caller, depth, preservePaths);
      case 'Try': return this._processTry(stmt, caller, depth);
      case 'Unsupported': this.diagnostics.add('unsupported', stmt.text); break;
    }
  };

  PythonSequenceDiagramGenerator.prototype._processAssign = function (stmt, caller, depth) {
    this._processAssignValue(stmt.value, stmt.targets || [], caller, depth);
  };

  // Resolve object expressions independently of call syntax. Bindings are local
  // names or fields of a particular owner; a type alone never identifies an
  // unrelated object that happens to share that type.
  PythonSequenceDiagramGenerator.prototype._objectBinding = function (expression, caller) {
    if (!expression) return null;
    if (expression.type === 'Name') {
      if (expression.id === 'self') return { type: this._classOf(caller), participant: caller };
      const type = this.varTypes[expression.id];
      return type ? { type: type, participant: this.varParticipants[expression.id]
        || this._symbolicParticipantId('local', this._scopeIdentity, expression.id, type,
          caller === 'Main' ? expression.id : caller + '_' + expression.id) } : null;
    }
    if (expression.type !== 'Attribute') return null;
    const owner = this._objectBinding(expression.value, caller);
    if (!owner) return null;
    const fields = this.fieldBindings[owner.participant] || {};
    if (Object.prototype.hasOwnProperty.call(fields, expression.attr)) return fields[expression.attr];
    let ownerType = owner.type;
    const seen = new Set();
    while (ownerType && !seen.has(ownerType)) {
      seen.add(ownerType);
      const type = (this.attrTypes[ownerType] || {})[expression.attr];
      if (type) return { type: type, participant: this._symbolicParticipantId(
        'field', owner.participant, expression.attr, type, owner.participant + '_' + expression.attr) };
      ownerType = this._findParent(ownerType);
    }
    return null;
  };

  PythonSequenceDiagramGenerator.prototype._assignBinding = function (target, binding, caller) {
    if (target.type === 'Name') {
      delete this.varTypes[target.id];
      delete this.varParticipants[target.id];
      if (binding) {
        this.varTypes[target.id] = binding.type;
        this.varParticipants[target.id] = binding.participant;
      }
    } else if (target.type === 'Attribute') {
      const owner = this._objectBinding(target.value, caller);
      if (!owner) return;
      if (!this.fieldBindings[owner.participant]) this.fieldBindings[owner.participant] = {};
      this.fieldBindings[owner.participant][target.attr] = binding;
    }
  };

  PythonSequenceDiagramGenerator.prototype._newParticipantId = function (base) {
    let id = base;
    for (let suffix = 2; this._participantIds.has(id); suffix++) id = base + '_' + suffix;
    // Reserve immediately: aliases/fields can reference an object before any
    // message causes it to be rendered as a participant.
    this._participantIds.add(id);
    return id;
  };

  PythonSequenceDiagramGenerator.prototype._symbolicParticipantId = function (kind, owner, role, type, base) {
    const key = JSON.stringify([kind, owner, role, type]);
    if (!this._symbolicParticipantIds.has(key)) {
      this._symbolicParticipantIds.set(key, this._newParticipantId(base));
    }
    return this._symbolicParticipantIds.get(key);
  };

  PythonSequenceDiagramGenerator.prototype._processAssignValue = function (value, targets, caller, depth) {
    if (value && value.type === 'Call') {
      const resolved = this._resolveCall(value, caller);
      if (resolved) {
        const [clsName, method] = resolved;
        const target = targets.length === 1 ? targets[0] : null;
        const fieldOwner = target && target.type === 'Attribute'
          ? this._objectBinding(target.value, caller) : null;
        if (method === '__init__' && target && (target.type === 'Name' || fieldOwner)) {
          this._scanCallInputs(value, caller, depth);
          const base = target.type === 'Name'
            ? (caller === 'Main' ? target.id : caller + '_' + target.id)
            : (this._callerClass[target.attr] ? fieldOwner.participant + '_' + target.attr : target.attr);
          const id = this._newParticipantId(base);
          this._callerClass[id] = clsName;
          if (!this._dataClasses[clsName]) {
            this._ensureParticipant(id, clsName);
            this.lines.push('create ' + id, caller + ' --> ' + id + ': <<create>>', 'activate ' + id);
            this._maybeFollow(clsName, '__init__', id, depth, value);
            this.lines.push('deactivate ' + id);
          }
          this._assignBinding(target, { type: clsName, participant: id }, caller);
          return;
        }
        const returnName = target && target.type === 'Name' && this._referencedVars[target.id] ? target.id : null;
        const returnType = this._getReturnClassType(clsName, method);
        this._processCall(value, caller, depth, true, returnName);
        let returnBinding = null;
        if (returnType && targets.length) {
          const name = targets[0].type === 'Name' ? targets[0].id : targets[0].attr;
          if (name) {
            const id = this._newParticipantId((caller === 'Main' ? '' : caller + '_') + name);
            this._callerClass[id] = returnType;
            returnBinding = { type: returnType, participant: id };
          }
        }
        for (const assignment of targets) {
          this._assignBinding(assignment, returnBinding, caller);
        }
        return;
      }
    }
    const binding = this._objectBinding(value, caller);
    this._scanExprForCalls(value, caller, depth);
    for (const target of targets) this._assignBinding(target, binding, caller);
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

  PythonSequenceDiagramGenerator.prototype._scopeSnapshot = function () {
    const fields = {};
    for (const owner in this.fieldBindings) fields[owner] = Object.assign({}, this.fieldBindings[owner]);
    return { types: Object.assign({}, this.varTypes), participants: Object.assign({}, this.varParticipants), fields: fields };
  };

  PythonSequenceDiagramGenerator.prototype._restoreScope = function (scope, preserveFields) {
    this.varTypes = Object.assign({}, scope.types);
    this.varParticipants = Object.assign({}, scope.participants);
    if (!preserveFields) {
      this.fieldBindings = {};
      for (const owner in scope.fields) this.fieldBindings[owner] = Object.assign({}, scope.fields[owner]);
    }
  };

  PythonSequenceDiagramGenerator.prototype._mergeScopes = function (scopes) {
    this.varTypes = {};
    this.varParticipants = {};
    var baseline = scopes[0];
    for (var name in baseline.types) {
      var type = baseline.types[name];
      var participant = baseline.participants[name];
      // Retain only facts that hold on every path; choosing one branch's
      // receiver would fabricate an object identity after the merge.
      if (!scopes.every(function (scope) {
        return scope.types[name] === type && scope.participants[name] === participant;
      })) continue;
      this.varTypes[name] = type;
      if (participant) this.varParticipants[name] = participant;
    }
    this.fieldBindings = {};
    const owners = new Set(scopes.flatMap(scope => Object.keys(scope.fields)));
    for (const owner of owners) {
      const names = new Set(scopes.flatMap(scope => Object.keys(scope.fields[owner] || {})));
      this.fieldBindings[owner] = {};
      for (const name of names) {
        const bindings = scopes.map(scope => (scope.fields[owner] || {})[name]);
        const first = bindings[0];
        if (first && bindings.every(binding => binding && binding.type === first.type)) {
          this.fieldBindings[owner][name] = { type: first.type,
            participant: bindings.every(binding => binding.participant === first.participant)
              ? first.participant : this._symbolicParticipantId('merged-field', owner, name,
                first.type, owner + '_' + name) };
        } else {
          this.fieldBindings[owner][name] = null;
        }
      }
    }
  };

  class PythonSequenceLimitError extends Error {
    constructor() {
      super('Python sequence inference limit reached; simplify the example to inspect its interactions.');
      this.name = 'PythonSequenceLimitError';
    }
  }

  // A flow retains each completion's scope and pending transfer until its
  // enclosing construct consumes it. In particular, finally runs before paths
  // join, while a method return still contributes heap effects at its caller.
  PythonSequenceDiagramGenerator.prototype._completion = function (exit, lines) {
    return { lines: lines || [], scope: this._scopeSnapshot(), exit: exit || null };
  };

  PythonSequenceDiagramGenerator.prototype._flowOutcomes = function (flow) {
    return flow.branches ? flow.branches.flatMap(branch => this._flowOutcomes(branch.flow)) : [flow];
  };

  PythonSequenceDiagramGenerator.prototype._flowLines = function (flow) {
    if (!flow.branches) return flow.lines;
    const branches = flow.branches.map(branch => ({ header: branch.header, lines: this._flowLines(branch.flow) }));
    if (!branches.some(branch => this._hasMessages(branch.lines))) return flow.lines;
    const optional = flow.optional && !this._hasMessages(branches[1].lines);
    const lines = flow.lines.slice();
    branches.forEach((branch, index) => {
      if (optional && index === 1) return;
      lines.push(optional ? branch.header.replace(/^alt /, 'opt ') : branch.header, ...branch.lines);
    });
    lines.push('end');
    return lines;
  };

  PythonSequenceDiagramGenerator.prototype._mapCompletions = function (flow, transform) {
    if (flow.branches) return { ...flow,
      branches: flow.branches.map(branch => ({ ...branch, flow: this._mapCompletions(branch.flow, transform) })) };
    const saved = this._scopeSnapshot();
    this._restoreScope(flow.scope);
    const next = transform(flow);
    this._restoreScope(saved);
    return { ...next, lines: flow.lines.concat(next.lines) };
  };

  PythonSequenceDiagramGenerator.prototype._buildSequenceFlow = function (stmts, caller, depth, preservePaths) {
    const prefix = [];
    for (let index = 0; index < stmts.length; index++) {
      // Source paths can multiply inside nested cleanup. Refuse a partial
      // diagram when the work bound is reached instead of silently dropping
      // paths or fabricating a merged receiver for their finalizers.
      if (++this._sequenceVisits > 2000) throw new PythonSequenceLimitError();
      const start = this.lines.length;
      let flow = this._processStmt(stmts[index], caller, depth, preservePaths);
      const lines = this.lines.splice(start);
      if (!flow) { prefix.push(...lines); continue; }
      flow = { ...flow, lines: lines.concat(flow.lines) };
      const outcomes = this._flowOutcomes(flow);
      const sameScope = outcomes.every(outcome => JSON.stringify(outcome.scope) === JSON.stringify(outcomes[0].scope));
      if ((preservePaths && !sameScope) || outcomes.some(outcome => outcome.exit)) {
        const remaining = stmts.slice(index + 1);
        flow = this._mapCompletions(flow, outcome => outcome.exit
          ? { ...outcome, lines: [] }
          : this._collectFragment(remaining, caller, depth, preservePaths));
        return { ...flow, lines: prefix.concat(flow.lines) };
      }
      prefix.push(...this._flowLines(flow));
      this._mergeScopes(outcomes.map(outcome => outcome.scope));
    }
    return this._completion(null, prefix);
  };

  PythonSequenceDiagramGenerator.prototype._collectFragment = function (stmts, caller, depth, preservePaths) {
    const scope = this._scopeSnapshot();
    const flow = this._buildSequenceFlow(stmts, caller, depth, Boolean(preservePaths));
    this._restoreScope(scope);
    return flow;
  };

  PythonSequenceDiagramGenerator.prototype._hasMessages = function (fragmentLines) {
    return fragmentLines.some(line => line.trim()
      && !/^(alt |else |loop |opt |end|activate |deactivate |create )/.test(line.trim()));
  };

  PythonSequenceDiagramGenerator.prototype._processIf = function (stmt, caller, depth, context) {
    this._scanExprForCalls(stmt.test, caller, depth);
    const flow = { lines: [], optional: !(stmt.orelse || []).length, branches: [
      { header: 'alt [' + unparse(stmt.test, caller) + ']',
        flow: this._collectFragment(stmt.body, caller, depth, context && context.preservePaths) },
      { header: 'else [else]',
        flow: this._collectFragment(stmt.orelse || [], caller, depth, context && context.preservePaths) },
    ] };
    // Conditional expressions use the same branch emitter without asking the
    // statement walker to consume their outcome tree.
    if (!context) {
      this.lines.push(...this._flowLines(flow));
      this._mergeScopes(this._flowOutcomes(flow).map(outcome => outcome.scope));
    }
    return flow;
  };

  PythonSequenceDiagramGenerator.prototype._completionPaths = function (flow, conditions) {
    if (!flow.branches) return [{ outcome: flow, conditions }];
    const firstCondition = flow.branches[0].header.replace(/^(?:alt|else) \[|\]$/g, '');
    return flow.branches.flatMap(branch => {
      const condition = branch.header === 'else [else]' ? 'not (' + firstCondition + ')'
        : branch.header.replace(/^(?:alt|else) \[|\]$/g, '');
      return this._completionPaths(branch.flow, conditions.concat(condition));
    });
  };

  PythonSequenceDiagramGenerator.prototype._loopFlow = function (body, originalScope, header) {
    const bodyLines = this._flowLines(body);
    const lines = this._hasMessages(bodyLines) ? [header, ...bodyLines, 'end'] : bodyLines;
    const paths = this._completionPaths(body, []);
    const methodExits = paths.some(path => ['Return', 'Raise'].includes(path.outcome.exit));
    if (!methodExits) {
      // Break/continue stay within the bounded zero/one-iteration loop model.
      this._mergeScopes([originalScope, ...paths.map(path => path.outcome.scope)]);
      return this._completion(null, lines);
    }
    // A loop may run zero times, but a return/raise in an executed iteration
    // still leaves the method. Keep those completions for enclosing cleanup
    // instead of placing the continuation on every path after the loop.
    const branches = paths.map((path, index) => {
      const exit = ['Return', 'Raise'].includes(path.outcome.exit) ? path.outcome.exit : null;
      const label = exit === 'Return' ? 'return from loop' : exit === 'Raise' ? 'exception from loop' : 'loop finished';
      return { header: (index ? 'else' : 'alt') + ' [' + [label, ...path.conditions].join('; ') + ']',
        flow: { lines: [], scope: path.outcome.scope, exit } };
    });
    branches.push({ header: 'else [zero iterations]', flow: { lines: [], scope: originalScope, exit: null } });
    return { lines, branches };
  };

  PythonSequenceDiagramGenerator.prototype._processFor = function (stmt, caller, depth) {
    this._scanExprForCalls(stmt.iter, caller, depth);
    const originalScope = this._scopeSnapshot();
    this._inferLoopVarType(stmt, caller);
    const body = this._collectFragment(stmt.body, caller, depth, true);
    return this._loopFlow(body, originalScope, 'loop [for ' + unparse(stmt.target, caller) + ' in ' + unparse(stmt.iter, caller) + ']');
  };

  PythonSequenceDiagramGenerator.prototype._processWhile = function (stmt, caller, depth) {
    if (stmt.test?.type === 'Constant' && stmt.test.value) this.diagnostics.add('loop');
    this._scanExprForCalls(stmt.test, caller, depth);
    const originalScope = this._scopeSnapshot();
    let body = this._collectFragment(stmt.body, caller, depth, true);
    body = this._mapCompletions(body, outcome => {
      if (outcome.exit && outcome.exit !== 'Continue') return { ...outcome, lines: [] };
      const start = this.lines.length;
      this._scanExprForCalls(stmt.test, caller, depth);
      return this._completion(outcome.exit, this.lines.splice(start));
    });
    return this._loopFlow(body, originalScope, 'loop [while ' + unparse(stmt.test, caller) + ']');
  };

  PythonSequenceDiagramGenerator.prototype._processTry = function (stmt, caller, depth) {
    let body = this._collectFragment(stmt.body, caller, depth, true);
    body = this._mapCompletions(body, outcome => outcome.exit
      ? { ...outcome, lines: [] }
      : this._collectFragment(stmt.orelse || [], caller, depth, true));
    const branches = [{ header: 'alt [try]', flow: body }];
    for (const handler of stmt.handlers || []) {
      branches.push({ header: 'else [except ' + (handler.excType ? unparse(handler.excType) : 'Exception') + ']',
        flow: this._collectFragment(handler.body, caller, depth, true) });
    }
    let flow = branches.length > 1 ? { lines: [], branches } : body;
    // Each finalizer sees its incoming path's bindings. A transfer in cleanup
    // replaces a pending transfer; normal completion resumes the pending one.
    if ((stmt.finalbody || []).length) {
      flow = this._mapCompletions(flow, outcome => {
        const cleanup = this._collectFragment(stmt.finalbody, caller, depth, true);
        return this._mapCompletions(cleanup, final => ({ ...final, lines: [], exit: final.exit || outcome.exit }));
      });
    }
    return flow;
  };

  // ── Call processing ──────────────────────────────────────────────

  PythonSequenceDiagramGenerator.prototype._scanCallInputs = function (call, caller, depth) {
    // Python evaluates the receiver before arguments, then invokes the method.
    const receiverBinding = call.func && call.func.type === 'Attribute'
      ? this._scanExprForCalls(call.func.value, caller, depth) : null;
    for (var i = 0; i < (call.args || []).length; i++) {
      this._scanExprForCalls(call.args[i], caller, depth);
    }
    for (var i = 0; i < (call.keywords || []).length; i++) {
      this._scanExprForCalls(call.keywords[i].value, caller, depth);
    }
    return receiverBinding;
  };

  /**
   * Process a call node: emit a message and optionally follow the body.
   *
   * @param {object} call — Call AST node
   * @param {string} caller — current participant id
   * @param {number} depth — recursion depth
   * @param {boolean} returnCaptured — true if the call's return value is assigned
   *   to a variable (Cheers & Lin 2020: only show return arrows when the return
   *   value is consumed by subsequent logic)
   * @param {string?} returnBinding — when the assignment target is referenced
   *   later in the scope, the target's variable name. The reply arrow is then
   *   labeled ``var: type`` so the reader can trace the returned value through
   *   subsequent messages.
   */
  PythonSequenceDiagramGenerator.prototype._processCall = function (call, caller, depth, returnCaptured, returnBinding) {
    if (call.inferenceIncomplete) this.diagnostics.add('unsupported', 'Expression is only partly parsed');
    const computedReceiverBinding = this._scanCallInputs(call, caller, depth);

    var resolved = this._resolveCall(call, caller);
    if (!resolved) {
      const name = callName(call);
      if (!['print', 'len', 'range', 'str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'super', 'isinstance', 'enumerate', 'zip', 'min', 'max', 'sum'].includes(name)) {
        this.diagnostics.add('unresolved', unparse(call.func, caller));
      }
      return;
    }
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
    // A known object takes precedence over the class-based fallback.
    var receiver = call.func && call.func.type === 'Attribute' ? call.func.value : null;
    var isSuper = receiver && receiver.type === 'Call' && this._isSuperCall(receiver);
    const receiverBinding = this._objectBinding(receiver, caller) || computedReceiverBinding;
    var calleeId = receiverBinding ? receiverBinding.participant
      : method === '__init__' && !isSuper ? null : this._calleeIdFor(clsName, caller, attrHint);
    if (!receiverBinding && receiver && receiver.type === 'Call' && !this._isSuperCall(receiver)) {
      // A computed receiver has a known return type, not the identity of the
      // first existing participant with that type.
      calleeId = this._newParticipantId(unparse(receiver, caller).replace(/\W+/g, '_').replace(/_$/, '') + '_result');
    }
    var label = this._buildCallLabel(call, clsName, method, caller);

    if (method === '__init__' && !isSuper) {
      calleeId = this._newParticipantId(clsName);
      this._ensureParticipant(calleeId, clsName);
      this._callerClass[calleeId] = clsName;
      this.lines.push('create ' + calleeId);
      this.lines.push(caller + ' --> ' + calleeId + ': <<create>>');
      this.lines.push('activate ' + calleeId);
      this._maybeFollow(clsName, '__init__', calleeId, depth, call);
      this.lines.push('deactivate ' + calleeId);
      return { type: clsName, participant: calleeId };
    } else if (method === '__init__' && isSuper) {
      this._ensureParticipant(calleeId, clsName);
      this._callerClass[calleeId] = clsName;
      this.lines.push(caller + ' -> ' + calleeId + ': ' + label);
      this.lines.push('activate ' + calleeId);
      this._maybeFollow(clsName, method, calleeId, depth, call);
      this.lines.push('deactivate ' + calleeId);
    } else if (calleeId === caller) {
      // Self-call — nested activation bar on same lifeline (UML spec: stacked rectangles)
      this.lines.push(caller + ' -> ' + caller + ': ' + label);
      this.lines.push('activate ' + caller);
      this._maybeFollow(clsName, method, calleeId, depth, call);
      this.lines.push('deactivate ' + caller);
    } else {
      this._ensureParticipant(calleeId, clsName);
      this._callerClass[calleeId] = clsName;
      this.lines.push(caller + ' -> ' + calleeId + ': ' + label);
      this.lines.push('activate ' + calleeId);
      this._maybeFollow(clsName, method, calleeId, depth, call);
      // Return/reply message — only when return value is captured AND method has
      // a non-void return type (Cheers & Lin 2020 + Ambler G172: "Label return
      // messages only when not obvious." Void/uncaptured returns are obvious.)
      if (returnCaptured !== false) {
        var retType = this._getReturnType(clsName, method);
        if (retType) {
          var reply = returnBinding ? (returnBinding + ': ' + retType) : retType;
          this.lines.push(calleeId + ' --> ' + caller + ': ' + reply);
        }
      }
      this.lines.push('deactivate ' + calleeId);
    }
  };

  PythonSequenceDiagramGenerator.prototype._buildCallLabel = function (call, clsName, method, caller) {
    var argParts = [];
    var args = (call.args || []).map(function (arg) { return unparse(arg, caller); });
    for (var i = 0; i < (call.keywords || []).length; i++) {
      var keyword = call.keywords[i];
      args.push((keyword.arg ? keyword.arg + '=' : '**') + unparse(keyword.value, caller));
    }
    for (var i = 0; i < args.length; i++) argParts.push(args[i]);
    return method + '(' + argParts.join(', ') + ')';
  };

  /** Resolve a method's return type to a known class name (for type tracking). */
  PythonSequenceDiagramGenerator.prototype._getReturnClassType = function (clsName, methodName) {
    var node = this._findMethodNode(clsName, methodName);
    if (node && node.returns) {
      return this._scalarAnnotationClass(node.returns);
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

  PythonSequenceDiagramGenerator.prototype._argumentBindings = function (node, call) {
    var bindings = { types: {}, participants: {} };
    var parameters = (node.args ? node.args.args : []).filter(function (arg) {
      return arg.arg !== 'self' && arg.arg !== 'cls';
    });
    for (var i = 0; call && i < parameters.length; i++) {
      var parameter = parameters[i].arg;
      var actual = (call.args || [])[i];
      for (var j = 0; j < (call.keywords || []).length; j++) {
        if (call.keywords[j].arg === parameter) actual = call.keywords[j].value;
      }
      const binding = this._objectBinding(actual, this._scopeCaller);
      if (!binding) continue;
      bindings.types[parameter] = binding.type;
      bindings.participants[parameter] = binding.participant;
    }
    return bindings;
  };

  PythonSequenceDiagramGenerator.prototype._maybeFollow = function (clsName, methodName, calleeId, depth, call) {
    var key = clsName + '::' + methodName;

    var node = this._findMethodNode(clsName, methodName);
    if (!node) {
      if (methodName !== '__init__') this.diagnostics.add('unresolved', clsName + '.' + methodName);
      return;
    }

    if (node.isAsync) this.diagnostics.add('deferred', clsName + '.' + methodName);
    if (node.body.some(statement => statement.type === 'Raise')) this.diagnostics.add('control', 'Exception propagation');

    if (this._isStubMethod(node)) {
      var concrete = this._findConcreteOverride(clsName, methodName);
      if (concrete) {
        this.diagnostics.add('dispatch', clsName + '.' + methodName);
        clsName = concrete[0];
        node = concrete[1];
        key = clsName + '::' + methodName;
      } else return;
    }

    if (!this.diagnostics.canExpand(clsName + '.' + methodName, Boolean(this._callStack[key]), depth, this.MAX_DEPTH)) return;
    this._callStack[key] = true;
    var bindings = this._argumentBindings(node, call);
    var savedScope = this._scopeSnapshot();
    var savedCaller = this._scopeCaller;
    var savedIdentity = this._scopeIdentity;
    var savedRefs = this._referencedVars;
    this.varTypes = {};
    this.varParticipants = bindings.participants;
    this._scopeCaller = calleeId;
    this._scopeIdentity = ++this._invocationCount;

    var pt = (this.paramTypes[clsName] || {})[methodName] || {};
    for (var k in pt) this.varTypes[k] = pt[k];
    for (var k in bindings.types) this.varTypes[k] = bindings.types[k];

    // Recompute the use-set for this method body so reply arrows can be
    // labeled `var: type` only when `var` is actually referenced later.
    this._referencedVars = collectNameLoads(node.body);

    this._processStmts(node.body, calleeId, depth + 1);

    this._restoreScope(savedScope, true);
    this._scopeCaller = savedCaller;
    this._scopeIdentity = savedIdentity;
    this._referencedVars = savedRefs;
    delete this._callStack[key];
  };

  // ── Call resolution ──────────────────────────────────────────────

  PythonSequenceDiagramGenerator.prototype._resolveCall = function (call, caller) {
    var func = call.func;
    if (!func) return null;

    // ClassName(...)
    const constructedClass = callName(call);
    if (constructedClass && this.allTypeNames.has(constructedClass)) {
      return [constructedClass, '__init__'];
    }

    // var.method() or ClassName.static_method()
    if (func.type === 'Attribute' && func.value && func.value.type === 'Name') {
      var varName = func.value.id;
      var method = func.attr;
      if (varName === 'self') {
        var cc = this._classOf(caller);
        if (cc) return [cc, method];
      } else if (this.varTypes[varName]) {
        var resolvedCls = this.varTypes[varName];
        // Single-implementor resolution (Rountev 2005): if the resolved class
        // is an interface/abstract with one concrete subclass, use that instead
        var concrete = this._resolveSingleImplementor(resolvedCls, method);
        if (concrete) return [concrete, method];
        return [resolvedCls, method];
      }
      // ClassName.static_method() — static/class method call on a known type
      if (func.value._typeTarget !== null && this.allTypeNames.has(varName)) {
        var targetMeths = this.classMethods[varName] || {};
        if (targetMeths[method]) return [varName, method];
      }
      return null;
    }

    // Field receivers belong to the particular owning object, including aliases
    // and expressions such as client.service.method().
    if (func.type === 'Attribute'
        && func.value && func.value.type === 'Attribute') {
      const binding = this._objectBinding(func.value, caller);
      if (binding && this._findMethodNode(binding.type, func.attr)) return [binding.type, func.attr];
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

    // factory.create().method() — resolve the receiver's declared return type.
    if (func.type === 'Attribute' && func.value && func.value.type === 'Call') {
      var factoryCall = this._resolveCall(func.value, caller);
      if (factoryCall) {
        var returnClass = factoryCall[1] === '__init__' ? factoryCall[0]
          : this._getReturnClassType(factoryCall[0], factoryCall[1]);
        if (returnClass) return [returnClass, func.attr];
      }
    }

    return null;
  };

  PythonSequenceDiagramGenerator.prototype._isSuperCall = function (call) {
    return call.func && call.func.type === 'Name' && call.func.id === 'super';
  };

  PythonSequenceDiagramGenerator.prototype._scanExprForCalls = function (node, caller, depth) {
    if (++this._sequenceVisits > 2000) throw new PythonSequenceLimitError();
    if (!node) return;
    if (node.inferenceIncomplete) this.diagnostics.add('unsupported', 'Expression is only partly parsed');
    if (node.type === 'Lambda') {
      this.diagnostics.add('deferred', 'Lambda body is omitted');
      return;
    }
    if (node.type === 'Await') this.diagnostics.add('deferred', 'await');
    if (node.type === 'Call') {
      return this._processCall(node, caller, depth);
    }
    if (node.type === 'BoolOp') {
      this._scanBooleanCalls(node.values || [], node.op, caller, depth);
      return;
    }
    if (node.type === 'IfExp') {
      this._processIf({ test: node.test,
        body: [{ type: 'Expr', value: node.body }],
        orelse: [{ type: 'Expr', value: node.orelse }] }, caller, depth);
      return;
    }
    if (node.type === 'Compare') {
      this._scanExprForCalls(node.left, caller, depth);
      this._scanComparisonCalls(node, 0, caller, depth);
      return;
    }
    if (node.type === 'Dict') {
      for (var di = 0; di < (node.keys || []).length; di++) {
        this._scanExprForCalls(node.keys[di], caller, depth);
        this._scanExprForCalls(node.values[di], caller, depth);
      }
      return;
    }
    if (node.type === 'Constant' && node.isFString && typeof node.value === 'string') {
      var expressions = extractFStringExpressions(node.value);
      for (var ei = 0; ei < expressions.length; ei++) {
        this._scanExprForCalls(parseExpr(expressions[ei]), caller, depth);
      }
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

  PythonSequenceDiagramGenerator.prototype._scanBooleanCalls = function (values, operator, caller, depth) {
    if (!values.length) return;
    this._scanExprForCalls(values[0], caller, depth);
    if (values.length === 1) return;
    var start = this.lines.length;
    this._scanBooleanCalls(values.slice(1), operator, caller, depth);
    var conditionalLines = this.lines.splice(start);
    if (!this._hasMessages(conditionalLines)) return;
    var condition = unparse(values[0], caller);
    if (operator === 'or') condition = 'not (' + condition + ')';
    this.lines.push('opt [' + condition + ']');
    this.lines = this.lines.concat(conditionalLines);
    this.lines.push('end');
  };

  PythonSequenceDiagramGenerator.prototype._scanComparisonCalls = function (node, index, caller, depth) {
    if (index >= node.comparators.length) return;
    this._scanExprForCalls(node.comparators[index], caller, depth);
    if (index + 1 === node.comparators.length) return;
    var start = this.lines.length;
    this._scanComparisonCalls(node, index + 1, caller, depth);
    var tail = this.lines.splice(start);
    if (!this._hasMessages(tail)) return;
    var preceding = { type: 'Compare', left: index === 0 ? node.left : node.comparators[index - 1],
      ops: [node.ops[index]], comparators: [node.comparators[index]] };
    this.lines.push('opt [' + unparse(preceding, caller) + ']');
    this.lines = this.lines.concat(tail);
    this.lines.push('end');
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
    this._participantIds.add(pid);
    if (!this._participantSet.has(pid)) {
      this._participantSet.add(pid);
      this.participants.push({ id: pid, label: label });
    }
  };

  PythonSequenceDiagramGenerator.prototype._calleeIdFor = function (clsName, caller, attrHint) {
    return attrHint ? this._symbolicParticipantId('field', caller, attrHint, clsName, caller + '_' + attrHint)
      : this._symbolicParticipantId('class', clsName, '', clsName, clsName);
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

  /**
   * Single-implementor resolution (Rountev 2005, Tonella & Potrich 2004):
   * When a variable is typed as an interface/abstract class and exactly one
   * concrete subclass exists in scope that implements the called method,
   * resolve to that concrete class. This allows following into the real
   * method body instead of hitting a stub.
   */
  PythonSequenceDiagramGenerator.prototype._resolveSingleImplementor = function (clsName, methodName) {
    // Only apply when the target class has a stub method (abstract/interface)
    var meths = this.classMethods[clsName] || {};
    if (meths[methodName] && !this._isStubMethod(meths[methodName])) return null;

    // Find all subclasses that have a concrete implementation
    var candidates = [];
    for (var cname in this.classBases) {
      var bases = this.classBases[cname];
      if (bases.indexOf(clsName) === -1) continue;
      var cMeths = this.classMethods[cname] || {};
      if (cMeths[methodName] && !this._isStubMethod(cMeths[methodName])) {
        candidates.push(cname);
      }
    }
    // Only resolve if exactly one concrete implementor
    if (candidates.length === 1) return candidates[0];
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
    // Only Protocol base → interface.
    // ABC/ABCMeta are abstract classes, not interfaces.
    return cls.bases.indexOf('Protocol') !== -1;
  }

  function _isEnum(cls) {
    return cls.bases.indexOf('Enum') !== -1
        || cls.bases.indexOf('IntEnum') !== -1
        || cls.bases.indexOf('StrEnum') !== -1
        || cls.bases.indexOf('Flag') !== -1
        || cls.bases.indexOf('IntFlag') !== -1;
  }

  /* ===================================================================
   * Export
   * =================================================================== */

  global.analyzePythonSources = analyzePythonSources;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
