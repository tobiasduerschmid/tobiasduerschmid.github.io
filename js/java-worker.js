/**
 * Java Web Worker
 *
 * Compiles and runs Java code in a background thread using CheerpJ
 * (OpenJDK compiled to WebAssembly). Communication with the main thread
 * uses postMessage — same protocol as pyodide-worker.js:
 *
 * Inbound messages (main → worker):
 *   { type: 'run',      id, path }              Compile & run a .java file
 *   { type: 'runCode',  id, code, silent }       Compile & run Java code string
 *   { type: 'write',    id, path, content }      Write a file to virtual FS
 *   { type: 'read',     id, path }               Read a file from virtual FS
 *
 * Outbound messages (worker → main):
 *   { type: 'ready' }                           JVM is initialised
 *   { type: 'loading', message }                Progress during init
 *   { type: 'stdout', text }                    Streamed stdout (non-silent runs)
 *   { type: 'stderr', text }                    Streamed stderr (non-silent runs)
 *   { type: 'run_done',    id, exitCode }        Execution finished
 *   { type: 'write_ok',   id }                   File written
 *   { type: 'write_error', id, message }         File write failed
 *   { type: 'read_ok',    id, content }          File content
 *   { type: 'read_error', id }                   File not found / unreadable
 */
'use strict';

// ---------------------------------------------------------------------------
// CheerpJ 3.0 — OpenJDK 8 compiled to WebAssembly
// CheerpJ provides a complete JVM in the browser, including javac.
// CDN: https://cjrtnc.leaningtech.com/3.0/cj3loader.js
//
// NOTE: CheerpJ requires browser APIs (document, window) that are not
// available in a plain Web Worker. This worker instead implements a
// lightweight Java-to-JavaScript compilation pipeline:
//   1. A bundled ECJ (Eclipse Compiler for Java) compiled to JS handles
//      .java → .class compilation
//   2. A WASM-based bytecode interpreter executes the .class files
//
// For the initial implementation we use a simpler approach: the worker
// manages a virtual filesystem and delegates to a bundled Java toolchain.
// The toolchain is loaded from the path provided via the 'init' message
// or from a default CDN location.
// ---------------------------------------------------------------------------

var _running = false;

// Virtual filesystem — maps absolute paths to file content strings
var _fs = {};

// Captured output buffers
var _stdout = '';
var _stderr = '';
var _silent = false;

// ---------------------------------------------------------------------------
// Java Compiler + Runtime
//
// This implementation uses a two-stage pipeline:
//   Stage 1 — Compile: Parse Java source and compile to executable form
//   Stage 2 — Execute: Run the compiled code, capturing stdout/stderr
//
// The compiler is a self-contained Java-subset-to-JavaScript transpiler
// that handles core Java constructs: classes, methods, inheritance,
// interfaces, generics (erased), exceptions, enums, arrays, and the
// standard library basics (System.out, String, List, Map, etc.).
// ---------------------------------------------------------------------------

/**
 * Lightweight Java-to-JavaScript transpiler.
 *
 * Supports: classes, static/instance methods, fields, constructors,
 * inheritance (extends/implements), interfaces, enums (with fields,
 * constructors, and instance methods), arrays, lambda expressions /
 * functional interfaces, generics (type-erased), exceptions
 * (try/catch/finally/throw), for/while/do-while/for-each, switch,
 * ternary, varargs, auto-boxing, string concatenation, printf/format,
 * System.out.println/print/printf, Scanner(System.in) basics,
 * Math.*, Integer/Double/Boolean wrappers, ArrayList, HashMap,
 * HashSet, LinkedList, Arrays, Collections, Comparator.
 *
 * Does NOT support: threads, reflection, streams, NIO, networking,
 * Swing/AWT, JDBC. Annotations are parsed and silently skipped
 * (@Override, etc.) since they don't affect runtime behavior.
 */
var JavaCompiler = (function () {

  // ---- Tokenizer ------------------------------------------------------------

  var TOKEN_TYPES = {
    KEYWORD: 'KEYWORD',
    IDENTIFIER: 'IDENTIFIER',
    NUMBER: 'NUMBER',
    STRING: 'STRING',
    CHAR: 'CHAR',
    OPERATOR: 'OPERATOR',
    DELIMITER: 'DELIMITER',
    COMMENT: 'COMMENT',
    BOOLEAN: 'BOOLEAN',
    NULL: 'NULL',
  };

  var KEYWORDS = new Set([
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch',
    'char', 'class', 'const', 'continue', 'default', 'do', 'double',
    'else', 'enum', 'extends', 'final', 'finally', 'float', 'for',
    'if', 'implements', 'import', 'instanceof', 'int', 'interface',
    'long', 'native', 'new', 'package', 'private', 'protected', 'public',
    'return', 'short', 'static', 'strictfp', 'super', 'switch',
    'synchronized', 'this', 'throw', 'throws', 'transient', 'try',
    'void', 'volatile', 'while',
  ]);

  function tokenize(source) {
    var tokens = [];
    var i = 0;
    var len = source.length;
    var line = 1;
    var col = 1;

    while (i < len) {
      var ch = source[i];

      // Whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r') { i++; col++; continue; }
      if (ch === '\n') { i++; line++; col = 1; continue; }

      // Single-line comment
      if (ch === '/' && source[i + 1] === '/') {
        while (i < len && source[i] !== '\n') i++;
        continue;
      }

      // Multi-line comment
      if (ch === '/' && source[i + 1] === '*') {
        i += 2; col += 2;
        while (i < len && !(source[i] === '*' && source[i + 1] === '/')) {
          if (source[i] === '\n') { line++; col = 1; } else { col++; }
          i++;
        }
        i += 2; col += 2;
        continue;
      }

      // String literal
      if (ch === '"') {
        var str = '';
        i++; col++;
        while (i < len && source[i] !== '"') {
          if (source[i] === '\\') {
            i++; col++;
            var esc = source[i];
            if (esc === 'n') str += '\n';
            else if (esc === 't') str += '\t';
            else if (esc === 'r') str += '\r';
            else if (esc === '\\') str += '\\';
            else if (esc === '"') str += '"';
            else if (esc === '\'') str += '\'';
            else str += esc;
          } else {
            str += source[i];
          }
          i++; col++;
        }
        i++; col++;
        tokens.push({ type: TOKEN_TYPES.STRING, value: str, line: line, col: col });
        continue;
      }

      // Char literal
      if (ch === '\'') {
        i++; col++;
        var charVal = '';
        if (source[i] === '\\') {
          i++; col++;
          var ce = source[i];
          if (ce === 'n') charVal = '\n';
          else if (ce === 't') charVal = '\t';
          else if (ce === 'r') charVal = '\r';
          else if (ce === '\\') charVal = '\\';
          else if (ce === '\'') charVal = '\'';
          else charVal = ce;
        } else {
          charVal = source[i];
        }
        i++; col++;
        i++; col++; // closing quote
        tokens.push({ type: TOKEN_TYPES.CHAR, value: charVal, line: line, col: col });
        continue;
      }

      // Number literal (int, long, float, double, hex, binary)
      if ((ch >= '0' && ch <= '9') || (ch === '.' && source[i + 1] >= '0' && source[i + 1] <= '9')) {
        var num = '';
        if (ch === '0' && (source[i + 1] === 'x' || source[i + 1] === 'X')) {
          num += source[i] + source[i + 1]; i += 2; col += 2;
          while (i < len && /[0-9a-fA-F_]/.test(source[i])) { num += source[i]; i++; col++; }
        } else if (ch === '0' && (source[i + 1] === 'b' || source[i + 1] === 'B')) {
          num += source[i] + source[i + 1]; i += 2; col += 2;
          while (i < len && /[01_]/.test(source[i])) { num += source[i]; i++; col++; }
        } else {
          while (i < len && (/[0-9_]/.test(source[i]) || source[i] === '.')) { num += source[i]; i++; col++; }
          if (i < len && (source[i] === 'e' || source[i] === 'E')) {
            num += source[i]; i++; col++;
            if (i < len && (source[i] === '+' || source[i] === '-')) { num += source[i]; i++; col++; }
            while (i < len && /[0-9_]/.test(source[i])) { num += source[i]; i++; col++; }
          }
        }
        // Consume type suffix (L, l, F, f, D, d)
        if (i < len && /[LlFfDd]/.test(source[i])) { num += source[i]; i++; col++; }
        tokens.push({ type: TOKEN_TYPES.NUMBER, value: num.replace(/_/g, ''), line: line, col: col });
        continue;
      }

      // Identifier or keyword
      if (/[a-zA-Z_$]/.test(ch)) {
        var ident = '';
        while (i < len && /[a-zA-Z0-9_$]/.test(source[i])) { ident += source[i]; i++; col++; }
        if (ident === 'true' || ident === 'false') {
          tokens.push({ type: TOKEN_TYPES.BOOLEAN, value: ident, line: line, col: col });
        } else if (ident === 'null') {
          tokens.push({ type: TOKEN_TYPES.NULL, value: 'null', line: line, col: col });
        } else if (KEYWORDS.has(ident)) {
          tokens.push({ type: TOKEN_TYPES.KEYWORD, value: ident, line: line, col: col });
        } else {
          tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: ident, line: line, col: col });
        }
        continue;
      }

      // Multi-character operators
      var two = ch + (source[i + 1] || '');
      var three = two + (source[i + 2] || '');
      if (three === '>>>' || three === '>>=') {
        tokens.push({ type: TOKEN_TYPES.OPERATOR, value: three, line: line, col: col });
        i += 3; col += 3; continue;
      }
      if (['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=',
        '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '->'].indexOf(two) !== -1) {
        tokens.push({ type: TOKEN_TYPES.OPERATOR, value: two, line: line, col: col });
        i += 2; col += 2; continue;
      }

      // Single-character operators and delimiters
      if ('+-*/%=<>!&|^~?:'.indexOf(ch) !== -1) {
        tokens.push({ type: TOKEN_TYPES.OPERATOR, value: ch, line: line, col: col });
        i++; col++; continue;
      }
      if ('(){}[];,.@'.indexOf(ch) !== -1) {
        tokens.push({ type: TOKEN_TYPES.DELIMITER, value: ch, line: line, col: col });
        i++; col++; continue;
      }

      // Unknown character — skip
      i++; col++;
    }

    return tokens;
  }

  // ---- Parser (produces a simplified AST) ------------------------------------

  function Parser(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  Parser.prototype.peek = function (offset) {
    return this.tokens[this.pos + (offset || 0)] || null;
  };

  Parser.prototype.next = function () {
    return this.tokens[this.pos++] || null;
  };

  Parser.prototype.expect = function (type, value) {
    var t = this.next();
    if (!t) throw new Error('Unexpected end of input, expected ' + (value || type));
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error('Line ' + t.line + ': Expected ' + (value || type) + ' but got "' + t.value + '"');
    }
    return t;
  };

  Parser.prototype.match = function (type, value) {
    var t = this.peek();
    if (t && t.type === type && (value === undefined || t.value === value)) {
      return this.next();
    }
    return null;
  };

  Parser.prototype.is = function (type, value) {
    var t = this.peek();
    return t && t.type === type && (value === undefined || t.value === value);
  };

  // Parse a compilation unit (one .java file)
  Parser.prototype.parseCompilationUnit = function () {
    var unit = { package: null, imports: [], classes: [] };

    // Package declaration
    if (this.is(TOKEN_TYPES.KEYWORD, 'package')) {
      this.next();
      var pkg = '';
      while (!this.is(TOKEN_TYPES.DELIMITER, ';')) {
        pkg += this.next().value;
      }
      this.expect(TOKEN_TYPES.DELIMITER, ';');
      unit.package = pkg;
    }

    // Import declarations
    while (this.is(TOKEN_TYPES.KEYWORD, 'import')) {
      this.next();
      var isStatic = false;
      if (this.is(TOKEN_TYPES.KEYWORD, 'static')) { this.next(); isStatic = true; }
      var imp = '';
      while (!this.is(TOKEN_TYPES.DELIMITER, ';')) {
        imp += this.next().value;
      }
      this.expect(TOKEN_TYPES.DELIMITER, ';');
      unit.imports.push({ path: imp, static: isStatic });
    }

    // Class/interface/enum declarations
    while (this.pos < this.tokens.length) {
      unit.classes.push(this.parseClassDeclaration());
    }

    return unit;
  };

  Parser.prototype.parseModifiers = function () {
    var mods = [];
    while (this.peek()) {
      var v = this.peek().value;
      if (['public', 'private', 'protected', 'static', 'final', 'abstract',
        'native', 'synchronized', 'transient', 'volatile', 'strictfp'].indexOf(v) !== -1) {
        mods.push(this.next().value);
      } else if (this.is(TOKEN_TYPES.DELIMITER, '@')) {
        // Skip annotation
        this.next(); // @
        this.next(); // annotation name
        if (this.is(TOKEN_TYPES.DELIMITER, '(')) {
          this.skipBalanced('(', ')');
        }
      } else {
        break;
      }
    }
    return mods;
  };

  Parser.prototype.skipBalanced = function (open, close) {
    this.expect(TOKEN_TYPES.DELIMITER, open);
    var depth = 1;
    while (depth > 0 && this.pos < this.tokens.length) {
      var t = this.next();
      if (t.value === open) depth++;
      else if (t.value === close) depth--;
    }
  };

  Parser.prototype.parseClassDeclaration = function () {
    var mods = this.parseModifiers();
    var kind = 'class';
    if (this.is(TOKEN_TYPES.KEYWORD, 'class')) { this.next(); kind = 'class'; }
    else if (this.is(TOKEN_TYPES.KEYWORD, 'interface')) { this.next(); kind = 'interface'; }
    else if (this.is(TOKEN_TYPES.KEYWORD, 'enum')) { this.next(); kind = 'enum'; }
    else { throw new Error('Line ' + (this.peek() ? this.peek().line : '?') + ': Expected class, interface, or enum'); }

    var name = this.expect(TOKEN_TYPES.IDENTIFIER).value;

    // Type parameters <T, U extends Foo>
    var typeParams = null;
    if (this.is(TOKEN_TYPES.OPERATOR, '<')) {
      typeParams = this.parseTypeParams();
    }

    // extends
    var superClass = null;
    if (this.is(TOKEN_TYPES.KEYWORD, 'extends')) {
      this.next();
      superClass = this.parseTypeName();
    }

    // implements
    var interfaces = [];
    if (this.is(TOKEN_TYPES.KEYWORD, 'implements')) {
      this.next();
      interfaces.push(this.parseTypeName());
      while (this.match(TOKEN_TYPES.DELIMITER, ',')) {
        interfaces.push(this.parseTypeName());
      }
    }

    var body = this.parseClassBody(kind, name);

    return {
      node: 'class', kind: kind, name: name, modifiers: mods,
      typeParams: typeParams, superClass: superClass, interfaces: interfaces,
      members: body
    };
  };

  Parser.prototype.parseTypeParams = function () {
    this.expect(TOKEN_TYPES.OPERATOR, '<');
    var depth = 1;
    var params = '';
    while (depth > 0 && this.pos < this.tokens.length) {
      var t = this.next();
      if (t.value === '<') depth++;
      else if (t.value === '>') { depth--; if (depth === 0) break; }
      params += t.value + ' ';
    }
    return params.trim();
  };

  Parser.prototype.parseTypeName = function () {
    var name = this.next().value;
    // Handle qualified names (e.g., java.util.List)
    while (this.is(TOKEN_TYPES.DELIMITER, '.') &&
           this.peek(1) && this.peek(1).type === TOKEN_TYPES.IDENTIFIER) {
      this.next(); // .
      name += '.' + this.next().value;
    }
    // Handle generic type arguments
    if (this.is(TOKEN_TYPES.OPERATOR, '<')) {
      this.parseTypeParams(); // consume but we erase generics
    }
    return name;
  };

  Parser.prototype.parseClassBody = function (kind, className) {
    this.expect(TOKEN_TYPES.DELIMITER, '{');
    var members = [];

    // Enum constants
    if (kind === 'enum') {
      var enumConstants = [];
      while (!this.is(TOKEN_TYPES.DELIMITER, ';') && !this.is(TOKEN_TYPES.DELIMITER, '}')) {
        var cName = this.expect(TOKEN_TYPES.IDENTIFIER).value;
        var cArgs = null;
        if (this.is(TOKEN_TYPES.DELIMITER, '(')) {
          cArgs = this.parseArgList();
        }
        if (this.is(TOKEN_TYPES.DELIMITER, '{')) {
          this.skipBalanced('{', '}'); // enum body — skip for now
        }
        enumConstants.push({ name: cName, args: cArgs });
        this.match(TOKEN_TYPES.DELIMITER, ',');
      }
      members.push({ node: 'enumConstants', constants: enumConstants });
      this.match(TOKEN_TYPES.DELIMITER, ';');
    }

    while (!this.is(TOKEN_TYPES.DELIMITER, '}')) {
      if (this.pos >= this.tokens.length) throw new Error('Unexpected end of class body');
      members.push(this.parseMember(className));
    }
    this.expect(TOKEN_TYPES.DELIMITER, '}');
    return members;
  };

  Parser.prototype.parseMember = function (className) {
    // Inner class / interface / enum
    var t = this.peek();
    if (!t) throw new Error('Unexpected end of input in class body');

    // Static initializer block
    if (this.is(TOKEN_TYPES.KEYWORD, 'static') &&
        this.peek(1) && this.peek(1).value === '{') {
      this.next(); // static
      var body = this.parseBlock();
      return { node: 'staticInit', body: body };
    }

    var mods = this.parseModifiers();

    // Inner class/interface/enum
    if (this.is(TOKEN_TYPES.KEYWORD, 'class') || this.is(TOKEN_TYPES.KEYWORD, 'interface') ||
        this.is(TOKEN_TYPES.KEYWORD, 'enum')) {
      return this.parseClassDeclaration();
    }

    // Constructor: ClassName(...)
    if (this.is(TOKEN_TYPES.IDENTIFIER, className) &&
        this.peek(1) && this.peek(1).value === '(') {
      var cname = this.next().value;
      var params = this.parseParamList();
      // throws clause — store for checked exception enforcement
      var throwsTypes = [];
      if (this.is(TOKEN_TYPES.KEYWORD, 'throws')) {
        this.next();
        throwsTypes.push(this.parseTypeName());
        while (this.match(TOKEN_TYPES.DELIMITER, ',')) throwsTypes.push(this.parseTypeName());
      }
      var cbody = this.parseBlock();
      return { node: 'constructor', name: cname, modifiers: mods, params: params, body: cbody, throws: throwsTypes };
    }

    // Type parameters on methods (e.g., <T> T foo())
    if (this.is(TOKEN_TYPES.OPERATOR, '<')) {
      this.parseTypeParams();
    }

    // Method or field: type name ...
    var type = this.parseType();
    var name = this.expect(TOKEN_TYPES.IDENTIFIER).value;

    // Array brackets after name: int x[] = ...
    while (this.is(TOKEN_TYPES.DELIMITER, '[') &&
           this.peek(1) && this.peek(1).value === ']') {
      this.next(); this.next();
      type += '[]';
    }

    if (this.is(TOKEN_TYPES.DELIMITER, '(')) {
      // Method
      var params = this.parseParamList();
      // throws clause — store for checked exception enforcement
      var throwsTypes = [];
      if (this.is(TOKEN_TYPES.KEYWORD, 'throws')) {
        this.next();
        throwsTypes.push(this.parseTypeName());
        while (this.match(TOKEN_TYPES.DELIMITER, ',')) throwsTypes.push(this.parseTypeName());
      }
      var body = null;
      if (this.is(TOKEN_TYPES.DELIMITER, '{')) {
        body = this.parseBlock();
      } else {
        this.expect(TOKEN_TYPES.DELIMITER, ';');
      }
      return { node: 'method', name: name, type: type, modifiers: mods, params: params, body: body, throws: throwsTypes };
    } else {
      // Field(s) — possibly with initializer
      var fields = [];
      var init = null;
      if (this.match(TOKEN_TYPES.OPERATOR, '=')) {
        init = this.parseExpression();
      }
      fields.push({ name: name, type: type, init: init });
      while (this.match(TOKEN_TYPES.DELIMITER, ',')) {
        var fn = this.expect(TOKEN_TYPES.IDENTIFIER).value;
        var fi = null;
        if (this.match(TOKEN_TYPES.OPERATOR, '=')) {
          fi = this.parseExpression();
        }
        fields.push({ name: fn, type: type, init: fi });
      }
      this.expect(TOKEN_TYPES.DELIMITER, ';');
      return { node: 'field', modifiers: mods, type: type, fields: fields };
    }
  };

  Parser.prototype.parseType = function () {
    var t = this.peek();
    if (!t) throw new Error('Expected type');
    var type = '';
    // Primitive types
    if (['int', 'long', 'short', 'byte', 'float', 'double', 'boolean', 'char', 'void'].indexOf(t.value) !== -1) {
      type = this.next().value;
    } else {
      type = this.parseTypeName();
    }
    // Array dimensions
    while (this.is(TOKEN_TYPES.DELIMITER, '[') &&
           this.peek(1) && this.peek(1).value === ']') {
      this.next(); this.next();
      type += '[]';
    }
    // Varargs
    if (this.is(TOKEN_TYPES.DELIMITER, '.') &&
        this.peek(1) && this.peek(1).value === '.' &&
        this.peek(2) && this.peek(2).value === '.') {
      this.next(); this.next(); this.next();
      type += '...';
    }
    return type;
  };

  Parser.prototype.parseParamList = function () {
    this.expect(TOKEN_TYPES.DELIMITER, '(');
    var params = [];
    while (!this.is(TOKEN_TYPES.DELIMITER, ')')) {
      if (params.length > 0) this.expect(TOKEN_TYPES.DELIMITER, ',');
      var pmods = this.parseModifiers();
      var ptype = this.parseType();
      var pname = this.expect(TOKEN_TYPES.IDENTIFIER).value;
      // Array brackets after param name
      while (this.is(TOKEN_TYPES.DELIMITER, '[') &&
             this.peek(1) && this.peek(1).value === ']') {
        this.next(); this.next();
        ptype += '[]';
      }
      params.push({ type: ptype, name: pname, modifiers: pmods });
    }
    this.expect(TOKEN_TYPES.DELIMITER, ')');
    return params;
  };

  Parser.prototype.parseArgList = function () {
    this.expect(TOKEN_TYPES.DELIMITER, '(');
    var args = [];
    while (!this.is(TOKEN_TYPES.DELIMITER, ')')) {
      if (args.length > 0) this.expect(TOKEN_TYPES.DELIMITER, ',');
      args.push(this.parseExpression());
    }
    this.expect(TOKEN_TYPES.DELIMITER, ')');
    return args;
  };

  // ---- Block & Statement Parsing ---------------------------------------------

  Parser.prototype.parseBlock = function () {
    this.expect(TOKEN_TYPES.DELIMITER, '{');
    var stmts = [];
    while (!this.is(TOKEN_TYPES.DELIMITER, '}')) {
      if (this.pos >= this.tokens.length) throw new Error('Unexpected end of block');
      stmts.push(this.parseStatement());
    }
    this.expect(TOKEN_TYPES.DELIMITER, '}');
    return { node: 'block', statements: stmts };
  };

  Parser.prototype.parseStatement = function () {
    var t = this.peek();
    if (!t) throw new Error('Unexpected end of input');

    // Block
    if (t.value === '{') return this.parseBlock();

    // Control flow
    if (t.value === 'if') return this.parseIf();
    if (t.value === 'while') return this.parseWhile();
    if (t.value === 'do') return this.parseDoWhile();
    if (t.value === 'for') return this.parseFor();
    if (t.value === 'switch') return this.parseSwitch();
    if (t.value === 'try') return this.parseTry();
    if (t.value === 'throw') return this.parseThrow();
    if (t.value === 'return') return this.parseReturn();
    if (t.value === 'break') { this.next(); this.expect(TOKEN_TYPES.DELIMITER, ';'); return { node: 'break' }; }
    if (t.value === 'continue') { this.next(); this.expect(TOKEN_TYPES.DELIMITER, ';'); return { node: 'continue' }; }

    // Local class
    if (t.value === 'class') return this.parseClassDeclaration();

    // Variable declaration or expression statement
    // Heuristic: if we see a type-like pattern followed by an identifier, it's a declaration
    if (this.isLocalVarDecl()) {
      return this.parseLocalVarDecl();
    }

    // Expression statement
    var expr = this.parseExpression();
    this.expect(TOKEN_TYPES.DELIMITER, ';');
    return { node: 'exprStmt', expr: expr };
  };

  Parser.prototype.isLocalVarDecl = function () {
    // Save position, try to parse type + identifier
    var saved = this.pos;
    try {
      var mods = [];
      while (this.peek() && this.peek().value === 'final') { this.next(); mods.push('final'); }
      this.parseType();
      var nxt = this.peek();
      this.pos = saved;
      return nxt && nxt.type === TOKEN_TYPES.IDENTIFIER;
    } catch (e) {
      this.pos = saved;
      return false;
    }
  };

  Parser.prototype.parseLocalVarDecl = function () {
    var mods = [];
    while (this.peek() && this.peek().value === 'final') { this.next(); mods.push('final'); }
    var type = this.parseType();
    var decls = [];
    do {
      var name = this.expect(TOKEN_TYPES.IDENTIFIER).value;
      // Array brackets after name
      while (this.is(TOKEN_TYPES.DELIMITER, '[') &&
             this.peek(1) && this.peek(1).value === ']') {
        this.next(); this.next();
        type += '[]';
      }
      var init = null;
      if (this.match(TOKEN_TYPES.OPERATOR, '=')) {
        init = this.parseExpression();
      }
      decls.push({ name: name, init: init });
    } while (this.match(TOKEN_TYPES.DELIMITER, ','));
    this.expect(TOKEN_TYPES.DELIMITER, ';');
    return { node: 'localVar', type: type, modifiers: mods, declarations: decls };
  };

  Parser.prototype.parseIf = function () {
    this.expect(TOKEN_TYPES.KEYWORD, 'if');
    this.expect(TOKEN_TYPES.DELIMITER, '(');
    var cond = this.parseExpression();
    this.expect(TOKEN_TYPES.DELIMITER, ')');
    var then = this.parseStatement();
    var elseStmt = null;
    if (this.match(TOKEN_TYPES.KEYWORD, 'else')) {
      elseStmt = this.parseStatement();
    }
    return { node: 'if', condition: cond, then: then, else: elseStmt };
  };

  Parser.prototype.parseWhile = function () {
    this.expect(TOKEN_TYPES.KEYWORD, 'while');
    this.expect(TOKEN_TYPES.DELIMITER, '(');
    var cond = this.parseExpression();
    this.expect(TOKEN_TYPES.DELIMITER, ')');
    var body = this.parseStatement();
    return { node: 'while', condition: cond, body: body };
  };

  Parser.prototype.parseDoWhile = function () {
    this.expect(TOKEN_TYPES.KEYWORD, 'do');
    var body = this.parseStatement();
    this.expect(TOKEN_TYPES.KEYWORD, 'while');
    this.expect(TOKEN_TYPES.DELIMITER, '(');
    var cond = this.parseExpression();
    this.expect(TOKEN_TYPES.DELIMITER, ')');
    this.expect(TOKEN_TYPES.DELIMITER, ';');
    return { node: 'doWhile', condition: cond, body: body };
  };

  Parser.prototype.parseFor = function () {
    this.expect(TOKEN_TYPES.KEYWORD, 'for');
    this.expect(TOKEN_TYPES.DELIMITER, '(');

    // Determine if enhanced for-each: for (Type var : expr)
    var saved = this.pos;
    var isForEach = false;
    try {
      if (this.peek() && this.peek().value === 'final') this.next();
      this.parseType();
      this.expect(TOKEN_TYPES.IDENTIFIER);
      if (this.is(TOKEN_TYPES.OPERATOR, ':')) isForEach = true;
    } catch (e) { /* not for-each */ }
    this.pos = saved;

    if (isForEach) {
      var fmods = [];
      if (this.peek() && this.peek().value === 'final') { this.next(); fmods.push('final'); }
      var feType = this.parseType();
      var feName = this.expect(TOKEN_TYPES.IDENTIFIER).value;
      this.expect(TOKEN_TYPES.OPERATOR, ':');
      var feIter = this.parseExpression();
      this.expect(TOKEN_TYPES.DELIMITER, ')');
      var feBody = this.parseStatement();
      return { node: 'forEach', type: feType, name: feName, iterable: feIter, body: feBody };
    }

    // Classic for
    var init = null;
    if (!this.is(TOKEN_TYPES.DELIMITER, ';')) {
      if (this.isLocalVarDecl()) {
        init = this.parseLocalVarDecl(); // includes ;
      } else {
        init = this.parseExpression();
        this.expect(TOKEN_TYPES.DELIMITER, ';');
      }
    } else {
      this.next(); // ;
    }
    var cond = null;
    if (!this.is(TOKEN_TYPES.DELIMITER, ';')) {
      cond = this.parseExpression();
    }
    this.expect(TOKEN_TYPES.DELIMITER, ';');
    var update = null;
    if (!this.is(TOKEN_TYPES.DELIMITER, ')')) {
      update = this.parseExpression();
      // Handle comma-separated updates
      while (this.match(TOKEN_TYPES.DELIMITER, ',')) {
        var u2 = this.parseExpression();
        update = { node: 'comma', left: update, right: u2 };
      }
    }
    this.expect(TOKEN_TYPES.DELIMITER, ')');
    var body = this.parseStatement();
    return { node: 'for', init: init, condition: cond, update: update, body: body };
  };

  Parser.prototype.parseSwitch = function () {
    this.expect(TOKEN_TYPES.KEYWORD, 'switch');
    this.expect(TOKEN_TYPES.DELIMITER, '(');
    var expr = this.parseExpression();
    this.expect(TOKEN_TYPES.DELIMITER, ')');
    this.expect(TOKEN_TYPES.DELIMITER, '{');
    var cases = [];
    while (!this.is(TOKEN_TYPES.DELIMITER, '}')) {
      if (this.is(TOKEN_TYPES.KEYWORD, 'case')) {
        this.next();
        var val = this.parseExpression();
        this.expect(TOKEN_TYPES.OPERATOR, ':');
        var stmts = [];
        while (!this.is(TOKEN_TYPES.KEYWORD, 'case') && !this.is(TOKEN_TYPES.KEYWORD, 'default') && !this.is(TOKEN_TYPES.DELIMITER, '}')) {
          stmts.push(this.parseStatement());
        }
        cases.push({ node: 'case', value: val, body: stmts });
      } else if (this.is(TOKEN_TYPES.KEYWORD, 'default')) {
        this.next();
        this.expect(TOKEN_TYPES.OPERATOR, ':');
        var stmts = [];
        while (!this.is(TOKEN_TYPES.KEYWORD, 'case') && !this.is(TOKEN_TYPES.DELIMITER, '}')) {
          stmts.push(this.parseStatement());
        }
        cases.push({ node: 'default', body: stmts });
      }
    }
    this.expect(TOKEN_TYPES.DELIMITER, '}');
    return { node: 'switch', expr: expr, cases: cases };
  };

  Parser.prototype.parseTry = function () {
    this.expect(TOKEN_TYPES.KEYWORD, 'try');

    // Try-with-resources
    var resources = null;
    if (this.is(TOKEN_TYPES.DELIMITER, '(')) {
      this.next();
      resources = [];
      while (!this.is(TOKEN_TYPES.DELIMITER, ')')) {
        if (resources.length > 0) this.expect(TOKEN_TYPES.DELIMITER, ';');
        if (this.is(TOKEN_TYPES.DELIMITER, ')')) break;
        var rt = this.parseType();
        var rn = this.expect(TOKEN_TYPES.IDENTIFIER).value;
        this.expect(TOKEN_TYPES.OPERATOR, '=');
        var ri = this.parseExpression();
        resources.push({ type: rt, name: rn, init: ri });
      }
      this.match(TOKEN_TYPES.DELIMITER, ';'); // optional trailing semicolon
      this.expect(TOKEN_TYPES.DELIMITER, ')');
    }

    var tryBlock = this.parseBlock();
    var catches = [];
    while (this.is(TOKEN_TYPES.KEYWORD, 'catch')) {
      this.next();
      this.expect(TOKEN_TYPES.DELIMITER, '(');
      var exTypes = [this.parseTypeName()];
      while (this.match(TOKEN_TYPES.OPERATOR, '|')) {
        exTypes.push(this.parseTypeName());
      }
      var exName = this.expect(TOKEN_TYPES.IDENTIFIER).value;
      this.expect(TOKEN_TYPES.DELIMITER, ')');
      var catchBlock = this.parseBlock();
      catches.push({ types: exTypes, name: exName, body: catchBlock });
    }
    var finallyBlock = null;
    if (this.match(TOKEN_TYPES.KEYWORD, 'finally')) {
      finallyBlock = this.parseBlock();
    }
    return { node: 'try', resources: resources, body: tryBlock, catches: catches, finally: finallyBlock };
  };

  Parser.prototype.parseThrow = function () {
    this.expect(TOKEN_TYPES.KEYWORD, 'throw');
    var expr = this.parseExpression();
    this.expect(TOKEN_TYPES.DELIMITER, ';');
    return { node: 'throw', expr: expr };
  };

  Parser.prototype.parseReturn = function () {
    this.expect(TOKEN_TYPES.KEYWORD, 'return');
    var expr = null;
    if (!this.is(TOKEN_TYPES.DELIMITER, ';')) {
      expr = this.parseExpression();
    }
    this.expect(TOKEN_TYPES.DELIMITER, ';');
    return { node: 'return', expr: expr };
  };

  // ---- Expression Parsing (Pratt parser) -------------------------------------

  Parser.prototype.parseExpression = function () {
    return this.parseAssignment();
  };

  Parser.prototype.parseAssignment = function () {
    var left = this.parseTernary();
    var op = this.peek();
    if (op && ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>='].indexOf(op.value) !== -1) {
      this.next();
      var right = this.parseAssignment();
      return { node: 'assign', op: op.value, left: left, right: right };
    }
    return left;
  };

  Parser.prototype.parseTernary = function () {
    var expr = this.parseOr();
    if (this.match(TOKEN_TYPES.OPERATOR, '?')) {
      var then = this.parseExpression();
      this.expect(TOKEN_TYPES.OPERATOR, ':');
      var elseExpr = this.parseTernary();
      return { node: 'ternary', condition: expr, then: then, else: elseExpr };
    }
    return expr;
  };

  Parser.prototype.parseOr = function () {
    var left = this.parseAnd();
    while (this.match(TOKEN_TYPES.OPERATOR, '||')) {
      left = { node: 'binary', op: '||', left: left, right: this.parseAnd() };
    }
    return left;
  };

  Parser.prototype.parseAnd = function () {
    var left = this.parseBitOr();
    while (this.match(TOKEN_TYPES.OPERATOR, '&&')) {
      left = { node: 'binary', op: '&&', left: left, right: this.parseBitOr() };
    }
    return left;
  };

  Parser.prototype.parseBitOr = function () {
    var left = this.parseBitXor();
    while (this.is(TOKEN_TYPES.OPERATOR, '|') && !(this.peek(1) && this.peek(1).value === '|')) {
      this.next();
      left = { node: 'binary', op: '|', left: left, right: this.parseBitXor() };
    }
    return left;
  };

  Parser.prototype.parseBitXor = function () {
    var left = this.parseBitAnd();
    while (this.match(TOKEN_TYPES.OPERATOR, '^')) {
      left = { node: 'binary', op: '^', left: left, right: this.parseBitAnd() };
    }
    return left;
  };

  Parser.prototype.parseBitAnd = function () {
    var left = this.parseEquality();
    while (this.is(TOKEN_TYPES.OPERATOR, '&') && !(this.peek(1) && this.peek(1).value === '&')) {
      this.next();
      left = { node: 'binary', op: '&', left: left, right: this.parseEquality() };
    }
    return left;
  };

  Parser.prototype.parseEquality = function () {
    var left = this.parseRelational();
    while (this.peek() && (this.peek().value === '==' || this.peek().value === '!=')) {
      var op = this.next().value;
      left = { node: 'binary', op: op, left: left, right: this.parseRelational() };
    }
    return left;
  };

  Parser.prototype.parseRelational = function () {
    var left = this.parseShift();
    while (this.peek()) {
      if (this.is(TOKEN_TYPES.KEYWORD, 'instanceof')) {
        this.next();
        var type = this.parseTypeName();
        left = { node: 'instanceof', expr: left, type: type };
      } else if (['<', '>', '<=', '>='].indexOf(this.peek().value) !== -1) {
        var op = this.next().value;
        left = { node: 'binary', op: op, left: left, right: this.parseShift() };
      } else {
        break;
      }
    }
    return left;
  };

  Parser.prototype.parseShift = function () {
    var left = this.parseAdditive();
    while (this.peek() && ['<<', '>>', '>>>'].indexOf(this.peek().value) !== -1) {
      var op = this.next().value;
      left = { node: 'binary', op: op, left: left, right: this.parseAdditive() };
    }
    return left;
  };

  Parser.prototype.parseAdditive = function () {
    var left = this.parseMultiplicative();
    while (this.peek() && (this.peek().value === '+' || this.peek().value === '-') &&
           this.peek().type === TOKEN_TYPES.OPERATOR) {
      var op = this.next().value;
      left = { node: 'binary', op: op, left: left, right: this.parseMultiplicative() };
    }
    return left;
  };

  Parser.prototype.parseMultiplicative = function () {
    var left = this.parseUnary();
    while (this.peek() && ['*', '/', '%'].indexOf(this.peek().value) !== -1) {
      var op = this.next().value;
      left = { node: 'binary', op: op, left: left, right: this.parseUnary() };
    }
    return left;
  };

  Parser.prototype.parseUnary = function () {
    var t = this.peek();
    if (!t) throw new Error('Unexpected end of expression');

    if (t.value === '!' || t.value === '~' || t.value === '-' || t.value === '+') {
      this.next();
      return { node: 'unary', op: t.value, expr: this.parseUnary() };
    }
    if (t.value === '++' || t.value === '--') {
      this.next();
      return { node: 'preIncDec', op: t.value, expr: this.parseUnary() };
    }

    // Cast: (Type) expr
    if (t.value === '(' && this.peek(1)) {
      var saved = this.pos;
      try {
        this.next(); // (
        var castType = this.parseType();
        this.expect(TOKEN_TYPES.DELIMITER, ')');
        var expr = this.parseUnary();
        return { node: 'cast', type: castType, expr: expr };
      } catch (e) {
        this.pos = saved;
      }
    }

    return this.parsePostfix();
  };

  Parser.prototype.parsePostfix = function () {
    var expr = this.parsePrimary();

    while (true) {
      if (this.is(TOKEN_TYPES.DELIMITER, '.')) {
        this.next();
        if (this.is(TOKEN_TYPES.KEYWORD, 'class')) {
          this.next();
          expr = { node: 'classLiteral', expr: expr };
        } else if (this.is(TOKEN_TYPES.KEYWORD, 'this')) {
          this.next();
          expr = { node: 'qualifiedThis', qualifier: expr };
        } else {
          var member = this.expect(TOKEN_TYPES.IDENTIFIER).value;
          if (this.is(TOKEN_TYPES.DELIMITER, '(')) {
            var args = this.parseArgList();
            expr = { node: 'methodCall', object: expr, method: member, args: args };
          } else {
            expr = { node: 'fieldAccess', object: expr, field: member };
          }
        }
      } else if (this.is(TOKEN_TYPES.DELIMITER, '[')) {
        this.next();
        var index = this.parseExpression();
        this.expect(TOKEN_TYPES.DELIMITER, ']');
        expr = { node: 'arrayAccess', array: expr, index: index };
      } else if (this.peek() && (this.peek().value === '++' || this.peek().value === '--')) {
        var op = this.next().value;
        expr = { node: 'postIncDec', op: op, expr: expr };
      } else {
        break;
      }
    }

    return expr;
  };

  Parser.prototype.parsePrimary = function () {
    var t = this.peek();
    if (!t) throw new Error('Unexpected end of expression');

    // Literals
    if (t.type === TOKEN_TYPES.NUMBER) { this.next(); return { node: 'literal', type: 'number', value: t.value }; }
    if (t.type === TOKEN_TYPES.STRING) { this.next(); return { node: 'literal', type: 'string', value: t.value }; }
    if (t.type === TOKEN_TYPES.CHAR) { this.next(); return { node: 'literal', type: 'char', value: t.value }; }
    if (t.type === TOKEN_TYPES.BOOLEAN) { this.next(); return { node: 'literal', type: 'boolean', value: t.value }; }
    if (t.type === TOKEN_TYPES.NULL) { this.next(); return { node: 'literal', type: 'null', value: 'null' }; }

    // this
    if (t.value === 'this') {
      this.next();
      if (this.is(TOKEN_TYPES.DELIMITER, '(')) {
        var args = this.parseArgList();
        return { node: 'thisCall', args: args };
      }
      return { node: 'this' };
    }

    // super
    if (t.value === 'super') {
      this.next();
      if (this.is(TOKEN_TYPES.DELIMITER, '(')) {
        var args = this.parseArgList();
        return { node: 'superCall', args: args };
      }
      if (this.is(TOKEN_TYPES.DELIMITER, '.')) {
        this.next();
        var member = this.expect(TOKEN_TYPES.IDENTIFIER).value;
        if (this.is(TOKEN_TYPES.DELIMITER, '(')) {
          var args = this.parseArgList();
          return { node: 'superMethodCall', method: member, args: args };
        }
        return { node: 'superFieldAccess', field: member };
      }
      return { node: 'super' };
    }

    // new
    if (t.value === 'new') {
      this.next();
      var type = this.parseTypeName();
      if (this.is(TOKEN_TYPES.DELIMITER, '[')) {
        // Array creation: new int[5] or new int[]{1,2,3}
        var dims = [];
        while (this.is(TOKEN_TYPES.DELIMITER, '[')) {
          this.next();
          if (this.is(TOKEN_TYPES.DELIMITER, ']')) {
            this.next();
            dims.push(null);
          } else {
            dims.push(this.parseExpression());
            this.expect(TOKEN_TYPES.DELIMITER, ']');
          }
        }
        var init = null;
        if (this.is(TOKEN_TYPES.DELIMITER, '{')) {
          init = this.parseArrayInitializer();
        }
        return { node: 'newArray', type: type, dimensions: dims, init: init };
      }
      var args = this.parseArgList();
      // Anonymous class body
      var body = null;
      if (this.is(TOKEN_TYPES.DELIMITER, '{')) {
        body = this.parseClassBody('class', type);
      }
      return { node: 'new', type: type, args: args, body: body };
    }

    // Lambda or parenthesized expression: () -> ..., (x) -> ..., (Type x, ...) -> ...
    if (t.value === '(') {
      // Try lambda first
      var saved = this.pos;
      try {
        var lambdaParams = this._tryParseLambdaParams();
        if (lambdaParams !== null) {
          this.expect(TOKEN_TYPES.OPERATOR, '->');
          var lambdaBody;
          if (this.is(TOKEN_TYPES.DELIMITER, '{')) {
            lambdaBody = this.parseBlock();
          } else {
            lambdaBody = this.parseExpression();
          }
          return { node: 'lambda', params: lambdaParams, body: lambdaBody };
        }
      } catch (e) { /* not a lambda */ }
      this.pos = saved;

      // Normal parenthesized expression
      this.next();
      var expr = this.parseExpression();
      this.expect(TOKEN_TYPES.DELIMITER, ')');
      return { node: 'paren', expr: expr };
    }

    // Array initializer
    if (t.value === '{') {
      return this.parseArrayInitializer();
    }

    // Identifier: could be variable, method call, or single-param lambda (x -> ...)
    if (t.type === TOKEN_TYPES.IDENTIFIER) {
      var name = this.next().value;
      // Single-parameter lambda without parens: x -> expr
      if (this.is(TOKEN_TYPES.OPERATOR, '->')) {
        this.next(); // consume ->
        var lambdaBody;
        if (this.is(TOKEN_TYPES.DELIMITER, '{')) {
          lambdaBody = this.parseBlock();
        } else {
          lambdaBody = this.parseExpression();
        }
        return { node: 'lambda', params: [{ name: name, type: null }], body: lambdaBody };
      }
      if (this.is(TOKEN_TYPES.DELIMITER, '(')) {
        var args = this.parseArgList();
        return { node: 'call', name: name, args: args };
      }
      return { node: 'identifier', name: name };
    }

    throw new Error('Line ' + t.line + ': Unexpected token: ' + t.value);
  };

  // Try to parse lambda parameter list: () or (ident, ...) or (Type ident, ...)
  // Returns array of {name, type} or null if this isn't a lambda.
  Parser.prototype._tryParseLambdaParams = function () {
    this.expect(TOKEN_TYPES.DELIMITER, '(');
    var params = [];

    // () -> ... (zero params)
    if (this.is(TOKEN_TYPES.DELIMITER, ')')) {
      this.next();
      if (!this.is(TOKEN_TYPES.OPERATOR, '->')) return null;
      return params;
    }

    // Try to read parameter list
    while (!this.is(TOKEN_TYPES.DELIMITER, ')')) {
      if (params.length > 0) {
        if (!this.match(TOKEN_TYPES.DELIMITER, ',')) return null;
      }
      var t1 = this.peek();
      if (!t1 || (t1.type !== TOKEN_TYPES.IDENTIFIER && t1.type !== TOKEN_TYPES.KEYWORD)) return null;

      // Could be: "ident" (inferred type) or "Type ident" (explicit type)
      var first = this.next();
      if (this.is(TOKEN_TYPES.DELIMITER, ',') || this.is(TOKEN_TYPES.DELIMITER, ')')) {
        // Inferred type: just an identifier
        params.push({ name: first.value, type: null });
      } else if (this.peek() && this.peek().type === TOKEN_TYPES.IDENTIFIER) {
        // Explicit type: Type ident
        var pname = this.next().value;
        params.push({ name: pname, type: first.value });
      } else {
        return null;
      }
    }

    if (!this.match(TOKEN_TYPES.DELIMITER, ')')) return null;
    if (!this.is(TOKEN_TYPES.OPERATOR, '->')) return null;
    return params;
  };

  Parser.prototype.parseArrayInitializer = function () {
    this.expect(TOKEN_TYPES.DELIMITER, '{');
    var elements = [];
    while (!this.is(TOKEN_TYPES.DELIMITER, '}')) {
      if (elements.length > 0) {
        this.expect(TOKEN_TYPES.DELIMITER, ',');
        if (this.is(TOKEN_TYPES.DELIMITER, '}')) break; // trailing comma
      }
      if (this.is(TOKEN_TYPES.DELIMITER, '{')) {
        elements.push(this.parseArrayInitializer());
      } else {
        elements.push(this.parseExpression());
      }
    }
    this.expect(TOKEN_TYPES.DELIMITER, '}');
    return { node: 'arrayInit', elements: elements };
  };

  // ---- Code Generator (AST → JavaScript) ------------------------------------

  function CodeGen() {
    this.output = '';
    this.indent = 0;
    this.classes = {};         // className → class info
    this.currentClass = null;
    this.staticInits = [];
    this.localNames = {};      // set of parameter/local variable names in current method scope
  }

  CodeGen.prototype.emit = function (s) { this.output += s; };
  CodeGen.prototype.emitLine = function (s) {
    this.output += '  '.repeat(this.indent) + s + '\n';
  };

  CodeGen.prototype.generate = function (unit) {
    // Checked exception validation — run before codegen so errors are reported early
    this._validateCheckedExceptions(unit);

    // Emit Java runtime support (stdlib stubs)
    this.emitRuntime();

    // Process all classes
    for (var i = 0; i < unit.classes.length; i++) {
      this.generateClass(unit.classes[i]);
    }

    // Run static initializers
    for (var i = 0; i < this.staticInits.length; i++) {
      this.emit(this.staticInits[i] + '\n');
    }

    return this.output;
  };

  // ---- Checked Exception Enforcement ----------------------------------------
  // Mirrors javac's behavior: if method A declares "throws FooException" and
  // FooException is a checked exception (not a RuntimeException subclass),
  // then any call to A must be inside a try/catch or the caller must also
  // declare "throws FooException".

  /** Known unchecked (RuntimeException) hierarchy — never require handling */
  var UNCHECKED_EXCEPTIONS = [
    'RuntimeException', 'NullPointerException', 'IllegalArgumentException',
    'ArithmeticException', 'ArrayIndexOutOfBoundsException',
    'IndexOutOfBoundsException', 'ClassCastException',
    'UnsupportedOperationException', 'NumberFormatException',
    'IllegalStateException', 'ConcurrentModificationException',
    'StackOverflowError', 'OutOfMemoryError', 'Error',
  ];

  CodeGen.prototype._validateCheckedExceptions = function (unit) {
    var self = this;

    // 1. Build map: className → { methodName → [checkedExceptionTypes] }
    var methodThrows = {};   // "ClassName.methodName" → ["ExType", ...]
    var classParents = {};   // className → superClass name (for extends Exception detection)

    for (var i = 0; i < unit.classes.length; i++) {
      var cls = unit.classes[i];
      classParents[cls.name] = cls.superClass || null;
      for (var j = 0; j < cls.members.length; j++) {
        var m = cls.members[j];
        if ((m.node === 'method' || m.node === 'constructor') && m.throws && m.throws.length > 0) {
          var checked = m.throws.filter(function (t) {
            return UNCHECKED_EXCEPTIONS.indexOf(t) === -1;
          });
          if (checked.length > 0) {
            var key = cls.name + '.' + (m.node === 'constructor' ? '<init>' : m.name);
            methodThrows[key] = checked;
          }
        }
      }
    }

    // No checked exceptions declared anywhere — nothing to enforce
    if (Object.keys(methodThrows).length === 0) return;

    // 2. For each method body, check that calls to throws-methods are handled
    for (var i = 0; i < unit.classes.length; i++) {
      var cls = unit.classes[i];
      for (var j = 0; j < cls.members.length; j++) {
        var m = cls.members[j];
        if ((m.node === 'method' || m.node === 'constructor') && m.body) {
          var callerThrows = (m.throws || []).slice();
          var bodyStmts = m.body.statements || m.body;
          if (!Array.isArray(bodyStmts)) bodyStmts = [bodyStmts];
          self._checkBodyForUncaughtExceptions(
            cls.name, m.name || '<init>', bodyStmts, methodThrows, callerThrows, false
          );
        }
      }
    }
  };

  /** Extract statement array from a block node or raw array */
  CodeGen.prototype._stmtsOf = function (block) {
    if (!block) return [];
    if (Array.isArray(block)) return block;
    if (block.node === 'block' && block.statements) return block.statements;
    return [block];
  };

  /**
   * Recursively walk a block of statements checking for unhandled checked exceptions.
   * @param {string} className - class containing the method being checked
   * @param {string} methodName - method being checked (for error messages)
   * @param {Array} stmts - statement list
   * @param {Object} methodThrows - map of "Class.method" → [exception types]
   * @param {Array} callerThrows - exception types the caller declares
   * @param {boolean} insideTry - true if we're inside a try block with relevant catches
   */
  CodeGen.prototype._checkBodyForUncaughtExceptions = function (
    className, methodName, stmts, methodThrows, callerThrows, insideTry
  ) {
    if (!stmts || !stmts.length) return;
    var self = this;

    for (var i = 0; i < stmts.length; i++) {
      var stmt = stmts[i];
      if (!stmt) continue;

      // try/catch — check if the catch clauses handle the required types
      if (stmt.node === 'try') {
        var caughtTypes = [];
        if (stmt.catches) {
          for (var c = 0; c < stmt.catches.length; c++) {
            var ct = stmt.catches[c];
            // catch clause has 'types' array (for multi-catch: catch (A | B e))
            if (ct.types) {
              for (var t = 0; t < ct.types.length; t++) {
                caughtTypes.push(ct.types[t]);
              }
            }
          }
        }
        // Inside the try body, these types are caught
        self._checkBodyForUncaughtExceptions(
          className, methodName, self._stmtsOf(stmt.body),
          methodThrows, callerThrows.concat(caughtTypes), true
        );
        // Catch/finally bodies checked normally
        if (stmt.catches) {
          for (var c = 0; c < stmt.catches.length; c++) {
            self._checkBodyForUncaughtExceptions(
              className, methodName, self._stmtsOf(stmt.catches[c].body),
              methodThrows, callerThrows, insideTry
            );
          }
        }
        if (stmt['finally']) {
          self._checkBodyForUncaughtExceptions(
            className, methodName, self._stmtsOf(stmt['finally']),
            methodThrows, callerThrows, insideTry
          );
        }
        continue;
      }

      // Check for method calls in this statement
      self._findCallsInNode(stmt, function (objName, callMethodName) {
        // Try exact match: ClassName.method
        var exTypes = methodThrows[objName + '.' + callMethodName];
        // If no exact match, the object might be an instance variable —
        // search all classes for a method with this name that throws
        if (!exTypes) {
          var allKeys = Object.keys(methodThrows);
          for (var k = 0; k < allKeys.length; k++) {
            if (allKeys[k].indexOf('.' + callMethodName) !== -1) {
              exTypes = methodThrows[allKeys[k]];
              break;
            }
          }
        }
        if (!exTypes) return;

        for (var e = 0; e < exTypes.length; e++) {
          var exType = exTypes[e];
          // Is it handled by caller's throws clause or a surrounding catch?
          var handled = callerThrows.indexOf(exType) !== -1 ||
                        callerThrows.indexOf('Exception') !== -1;
          if (!handled) {
            throw new Error(
              'error: unreported exception ' + exType +
              '; must be caught or declared to be thrown\n' +
              '  in method ' + className + '.' + methodName
            );
          }
        }
      });

      // Recurse into sub-blocks (if, while, for, etc.)
      if (stmt.body) {
        self._checkBodyForUncaughtExceptions(
          className, methodName, self._stmtsOf(stmt.body),
          methodThrows, callerThrows, insideTry
        );
      }
      if (stmt.elseBody) {
        self._checkBodyForUncaughtExceptions(
          className, methodName, self._stmtsOf(stmt.elseBody),
          methodThrows, callerThrows, insideTry
        );
      }
    }
  };

  /**
   * Find method calls in an AST node and invoke callback(objectName, methodName).
   * AST shapes:
   *   { node: 'methodCall', object: expr, method: 'name', args: [...] }
   *   { node: 'call', name: 'name', args: [...] }  (same-class unqualified call)
   */
  /**
   * Resolve an unqualified method call (e.g. getYear()) to its qualified form
   * (e.g. this.getYear() for instance methods, ClassName.method() for static).
   * Walks the superclass chain to find inherited methods.
   * Returns the qualified name, or null if not a class method (e.g. println).
   */
  /**
   * Check if a name is a field of the current class or any superclass.
   */
  /**
   * Check if a name is a field of the current class (or superclass) AND not
   * shadowed by a local variable or parameter in the current method scope.
   */
  /**
   * Collect all local variable names declared in a block (for shadowing checks).
   * Also collects for-each loop variables and for-loop inits.
   */
  CodeGen.prototype._collectLocalVars = function (block, nameSet) {
    if (!block) return;
    var stmts = block.statements || (Array.isArray(block) ? block : []);
    for (var i = 0; i < stmts.length; i++) {
      var s = stmts[i];
      if (!s) continue;
      if (s.node === 'localVar' && s.declarations) {
        for (var j = 0; j < s.declarations.length; j++) {
          nameSet[s.declarations[j].name] = true;
        }
      }
      if (s.node === 'forEach' && s.name) {
        nameSet[s.name] = true;
      }
      if (s.node === 'for' && s.init && s.init.node === 'localVar' && s.init.declarations) {
        for (var j = 0; j < s.init.declarations.length; j++) {
          nameSet[s.init.declarations[j].name] = true;
        }
      }
      // Recurse into sub-blocks
      if (s.body) this._collectLocalVars(s.body, nameSet);
      if (s.then) this._collectLocalVars(s.then, nameSet);
      if (s['else']) this._collectLocalVars(s['else'], nameSet);
      if (s.elseBody) this._collectLocalVars(s.elseBody, nameSet);
    }
  };

  CodeGen.prototype._isClassField = function (name) {
    // If shadowed by a local/parameter, it's the local — don't qualify
    if (this.localNames[name]) return false;
    var className = this.currentClass;
    while (className && this.classes[className]) {
      var cls = this.classes[className];
      var members = cls.members || [];
      for (var i = 0; i < members.length; i++) {
        var m = members[i];
        if (m.node === 'field') {
          for (var j = 0; j < m.fields.length; j++) {
            if (m.fields[j].name === name) return true;
          }
        }
      }
      className = cls.superClass || null;
    }
    return false;
  };

  CodeGen.prototype._resolveUnqualifiedCall = function (name) {
    var className = this.currentClass;
    // Walk up the class hierarchy
    while (className && this.classes[className]) {
      var cls = this.classes[className];
      var members = cls.members || [];
      for (var i = 0; i < members.length; i++) {
        var m = members[i];
        if (m.node === 'method' && m.name === name) {
          if (m.modifiers && m.modifiers.indexOf('static') !== -1) {
            return this.currentClass + '.' + name;
          } else {
            return 'this.' + name;
          }
        }
      }
      className = cls.superClass || null;
    }
    return null; // not a class method — leave unqualified (e.g. built-in functions)
  };

  CodeGen.prototype._findCallsInNode = function (node, callback) {
    if (!node || typeof node !== 'object') return;
    var self = this;

    if (node.node === 'methodCall' && node.object && node.method) {
      // obj.method(args) — obj could be an instance variable or a class name
      if (node.object.node === 'identifier') {
        callback(node.object.name, node.method);
      }
    }
    // Unqualified call: method(args) within same class — skip for now;
    // same-class calls would need to check currentClass.method which is
    // complex and not needed for the tutorial's SafeCalculator scenario
    // (which always uses calc.divide() / calc.sqrt() qualified calls).

    // Recurse into all properties that could contain sub-expressions
    var keys = Object.keys(node);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'node') continue;  // skip the type tag
      var val = node[k];
      if (Array.isArray(val)) {
        for (var j = 0; j < val.length; j++) {
          if (val[j] && typeof val[j] === 'object') {
            self._findCallsInNode(val[j], callback);
          }
        }
      } else if (val && typeof val === 'object' && val.node) {
        self._findCallsInNode(val, callback);
      }
    }
  };

  CodeGen.prototype.emitRuntime = function () {
    if (this.skipRuntime) return;
    this.emit([
      '// ---- Java Runtime Support ------------------------------------------------',
      'var __javaOut = [];',
      'var __javaErr = [];',
      'var __javaClasses = {};',
      '',
      'var System = {',
      '  out: {',
      '    println: function(s) {',
      '      if (s === undefined) s = "";',
      '      __javaOut.push(String(s));',
      '    },',
      '    print: function(s) {',
      '      if (s === undefined) s = "";',
      '      if (__javaOut.length === 0) __javaOut.push("");',
      '      __javaOut[__javaOut.length - 1] += String(s);',
      '    },',
      '    printf: function(fmt) {',
      '      var args = Array.prototype.slice.call(arguments, 1);',
      '      var result = __javaFormat(fmt, args);',
      '      if (__javaOut.length === 0) __javaOut.push("");',
      '      var lines = result.split("\\n");',
      '      __javaOut[__javaOut.length - 1] += lines[0];',
      '      for (var i = 1; i < lines.length; i++) __javaOut.push(lines[i]);',
      '    },',
      '    format: function(fmt) {',
      '      return System.out.printf.apply(System.out, arguments);',
      '    },',
      '    flush: function() {},',
      '    close: function() {},',
      '  },',
      '  err: {',
      '    println: function(s) { if (s === undefined) s = ""; __javaErr.push(String(s)); },',
      '    print: function(s) {',
      '      if (s === undefined) s = "";',
      '      if (__javaErr.length === 0) __javaErr.push("");',
      '      __javaErr[__javaErr.length - 1] += String(s);',
      '    },',
      '    printf: function(fmt) {',
      '      var args = Array.prototype.slice.call(arguments, 1);',
      '      var result = __javaFormat(fmt, args);',
      '      if (__javaErr.length === 0) __javaErr.push("");',
      '      var lines = result.split("\\n");',
      '      __javaErr[__javaErr.length - 1] += lines[0];',
      '      for (var i = 1; i < lines.length; i++) __javaErr.push(lines[i]);',
      '    },',
      '    flush: function() {},',
      '    close: function() {},',
      '  },',
      '  exit: function(code) { throw { __javaExit: true, code: code }; },',
      '  currentTimeMillis: function() { return Date.now(); },',
      '  nanoTime: function() { return Math.round(performance.now() * 1e6); },',
      '  lineSeparator: function() { return "\\n"; },',
      '  getenv: function(k) { return null; },',
      '};',
      '',
      'function __javaFormat(fmt, args) {',
      '  var i = 0;',
      '  return fmt.replace(/%(-?\\d*\\.?\\d*)?([dfsScbBhHoxXeEgGaAtT%n])/g, function(m, flags, conv) {',
      '    if (conv === "%") return "%";',
      '    if (conv === "n") return "\\n";',
      '    var arg = args[i++];',
      '    if (conv === "d" || conv === "o" || conv === "x" || conv === "X") {',
      '      var n = parseInt(arg);',
      '      if (conv === "o") return n.toString(8);',
      '      if (conv === "x") return n.toString(16);',
      '      if (conv === "X") return n.toString(16).toUpperCase();',
      '      var s = String(n);',
      '      if (flags) {',
      '        var w = parseInt(flags);',
      '        if (flags.charAt(0) === "-") { while (s.length < Math.abs(w)) s = s + " "; }',
      '        else if (flags.charAt(0) === "0") { while (s.length < w) s = "0" + s; }',
      '        else { while (s.length < w) s = " " + s; }',
      '      }',
      '      return s;',
      '    }',
      '    if (conv === "f" || conv === "e" || conv === "E" || conv === "g" || conv === "G") {',
      '      var n = parseFloat(arg);',
      '      var prec = 6;',
      '      if (flags && flags.indexOf(".") !== -1) prec = parseInt(flags.split(".")[1]) || 0;',
      '      if (conv === "f") return n.toFixed(prec);',
      '      if (conv === "e") return n.toExponential(prec);',
      '      if (conv === "E") return n.toExponential(prec).toUpperCase();',
      '      return String(n);',
      '    }',
      '    if (conv === "s" || conv === "S") {',
      '      var s = arg == null ? "null" : String(arg);',
      '      if (conv === "S") s = s.toUpperCase();',
      '      if (flags) {',
      '        var w = parseInt(flags);',
      '        if (flags.charAt(0) === "-") { while (s.length < Math.abs(w)) s = s + " "; }',
      '        else { while (s.length < w) s = " " + s; }',
      '      }',
      '      return s;',
      '    }',
      '    if (conv === "c" || conv === "C") {',
      '      var c = typeof arg === "number" ? String.fromCharCode(arg) : String(arg).charAt(0);',
      '      return conv === "C" ? c.toUpperCase() : c;',
      '    }',
      '    if (conv === "b" || conv === "B") {',
      '      var b = arg == null ? "false" : String(Boolean(arg));',
      '      return conv === "B" ? b.toUpperCase() : b;',
      '    }',
      '    return String(arg);',
      '  });',
      '}',
      '',
      'var String = (function() {',
      '  // Keep native String but add Java-like static methods',
      '  var NativeString = self.String;',
      '  return NativeString;',
      '})();',
      '',
      'function __javaStringMethods(s) {',
      '  if (s == null) throw new NullPointerException("null");',
      '  return s;',
      '}',
      '',
      '// Math is already available globally',
      '',
      '// Integer wrapper',
      'var Integer = {',
      '  parseInt: function(s, radix) { return parseInt(s, radix || 10); },',
      '  valueOf: function(x) { return typeof x === "string" ? parseInt(x) : x; },',
      '  toString: function(n, radix) { return n.toString(radix || 10); },',
      '  MAX_VALUE: 2147483647,',
      '  MIN_VALUE: -2147483648,',
      '  toBinaryString: function(n) { return (n >>> 0).toString(2); },',
      '  toHexString: function(n) { return (n >>> 0).toString(16); },',
      '  toOctalString: function(n) { return (n >>> 0).toString(8); },',
      '  compare: function(a, b) { return a < b ? -1 : a > b ? 1 : 0; },',
      '  max: function(a, b) { return Math.max(a, b); },',
      '  min: function(a, b) { return Math.min(a, b); },',
      '  reverse: function(n) { var r = 0; for (var i = 0; i < 32; i++) { r = (r << 1) | (n & 1); n >>>= 1; } return r; },',
      '};',
      '',
      'var Long = { parseLong: function(s) { return parseInt(s); }, MAX_VALUE: 9007199254740991, MIN_VALUE: -9007199254740991 };',
      'var Double = { parseDouble: function(s) { return parseFloat(s); }, isNaN: function(n) { return isNaN(n); }, isInfinite: function(n) { return !isFinite(n); }, MAX_VALUE: Number.MAX_VALUE, MIN_VALUE: Number.MIN_VALUE, NaN: NaN, POSITIVE_INFINITY: Infinity, NEGATIVE_INFINITY: -Infinity, valueOf: function(x) { return typeof x === "string" ? parseFloat(x) : x; } };',
      'var Float = { parseFloat: function(s) { return parseFloat(s); }, isNaN: function(n) { return isNaN(n); }, valueOf: function(x) { return typeof x === "string" ? parseFloat(x) : x; } };',
      'var Boolean_ = { parseBoolean: function(s) { return s === "true"; }, valueOf: function(x) { return typeof x === "string" ? x === "true" : Boolean(x); } };',
      'var Character = { isLetter: function(c) { return /[a-zA-Z]/.test(String.fromCharCode(c)); }, isDigit: function(c) { return /[0-9]/.test(String.fromCharCode(c)); }, isWhitespace: function(c) { return /\\s/.test(String.fromCharCode(c)); }, toUpperCase: function(c) { return String.fromCharCode(c).toUpperCase().charCodeAt(0); }, toLowerCase: function(c) { return String.fromCharCode(c).toLowerCase().charCodeAt(0); }, isUpperCase: function(c) { return String.fromCharCode(c) === String.fromCharCode(c).toUpperCase() && /[a-zA-Z]/.test(String.fromCharCode(c)); }, isLowerCase: function(c) { return String.fromCharCode(c) === String.fromCharCode(c).toLowerCase() && /[a-zA-Z]/.test(String.fromCharCode(c)); } };',
      '',
      '// Collections',
      'function ArrayList(init) {',
      '  this._data = init ? init.slice() : [];',
      '  this.size = function() { return this._data.length; };',
      '  this.get = function(i) { if (i < 0 || i >= this._data.length) throw new IndexOutOfBoundsException("Index: " + i); return this._data[i]; };',
      '  this.set = function(i, v) { if (i < 0 || i >= this._data.length) throw new IndexOutOfBoundsException("Index: " + i); var old = this._data[i]; this._data[i] = v; return old; };',
      '  this.add = function(a, b) { if (b === undefined) { this._data.push(a); return true; } else { this._data.splice(a, 0, b); } };',
      '  this.remove = function(i) { if (typeof i === "number" && Number.isInteger(i)) { return this._data.splice(i, 1)[0]; } var idx = this._data.indexOf(i); if (idx !== -1) { this._data.splice(idx, 1); return true; } return false; };',
      '  this.contains = function(v) { return this._data.indexOf(v) !== -1; };',
      '  this.indexOf = function(v) { return this._data.indexOf(v); };',
      '  this.isEmpty = function() { return this._data.length === 0; };',
      '  this.clear = function() { this._data = []; };',
      '  this.toArray = function() { return this._data.slice(); };',
      '  this.toString = function() { return "[" + this._data.join(", ") + "]"; };',
      '  this.iterator = function() { var idx = 0; var d = this._data; return { hasNext: function() { return idx < d.length; }, next: function() { return d[idx++]; } }; };',
      '  this[Symbol.iterator] = function() { return this._data[Symbol.iterator](); };',
      '  this.forEach = function(fn) { this._data.forEach(fn); };',
      '  this.sort = function(cmp) { this._data.sort(cmp || function(a, b) { return a < b ? -1 : a > b ? 1 : 0; }); };',
      '  this.subList = function(from, to) { return new ArrayList(this._data.slice(from, to)); };',
      '  this.addAll = function(c) { var it = c[Symbol.iterator] ? c[Symbol.iterator]() : c.iterator(); var n; while (!(n = it.next()).done !== undefined ? !n.done : true) { this._data.push(n.done !== undefined ? n.value : n); if (n.done) break; } return true; };',
      '}',
      '',
      'function LinkedList(init) { ArrayList.call(this, init); }',
      'LinkedList.prototype = Object.create(ArrayList.prototype);',
      'LinkedList.prototype.addFirst = function(v) { this._data.unshift(v); };',
      'LinkedList.prototype.addLast = function(v) { this._data.push(v); };',
      'LinkedList.prototype.getFirst = function() { if (this._data.length === 0) throw new Error("NoSuchElement"); return this._data[0]; };',
      'LinkedList.prototype.getLast = function() { if (this._data.length === 0) throw new Error("NoSuchElement"); return this._data[this._data.length - 1]; };',
      'LinkedList.prototype.removeFirst = function() { if (this._data.length === 0) throw new Error("NoSuchElement"); return this._data.shift(); };',
      'LinkedList.prototype.removeLast = function() { if (this._data.length === 0) throw new Error("NoSuchElement"); return this._data.pop(); };',
      'LinkedList.prototype.peek = function() { return this._data.length > 0 ? this._data[0] : null; };',
      'LinkedList.prototype.poll = function() { return this._data.length > 0 ? this._data.shift() : null; };',
      'LinkedList.prototype.offer = function(v) { this._data.push(v); return true; };',
      '',
      'function HashMap() {',
      '  this._map = new Map();',
      '  this.put = function(k, v) { var old = this._map.get(k); this._map.set(k, v); return old !== undefined ? old : null; };',
      '  this.get = function(k) { var v = this._map.get(k); return v !== undefined ? v : null; };',
      '  this.getOrDefault = function(k, def) { return this._map.has(k) ? this._map.get(k) : def; };',
      '  this.containsKey = function(k) { return this._map.has(k); };',
      '  this.containsValue = function(v) { for (var val of this._map.values()) { if (val === v) return true; } return false; };',
      '  this.remove = function(k) { var old = this._map.get(k); this._map.delete(k); return old !== undefined ? old : null; };',
      '  this.size = function() { return this._map.size; };',
      '  this.isEmpty = function() { return this._map.size === 0; };',
      '  this.clear = function() { this._map.clear(); };',
      '  this.keySet = function() { var s = new HashSet(); for (var k of this._map.keys()) s.add(k); return s; };',
      '  this.values = function() { var a = new ArrayList(); for (var v of this._map.values()) a.add(v); return a; };',
      '  this.entrySet = function() { var s = new HashSet(); for (var [k,v] of this._map.entries()) s.add({getKey: function(){return k;}, getValue: function(){return v;}}); return s; };',
      '  this.toString = function() { var parts = []; for (var [k,v] of this._map.entries()) parts.push(k + "=" + v); return "{" + parts.join(", ") + "}"; };',
      '  this.forEach = function(fn) { for (var [k,v] of this._map.entries()) fn(k, v); };',
      '  this[Symbol.iterator] = function() { return this._map.entries(); };',
      '}',
      'function TreeMap() { HashMap.call(this); }',
      'TreeMap.prototype = Object.create(HashMap.prototype);',
      'function LinkedHashMap() { HashMap.call(this); }',
      'LinkedHashMap.prototype = Object.create(HashMap.prototype);',
      '',
      'function HashSet() {',
      '  this._set = new Set();',
      '  this.add = function(v) { var had = this._set.has(v); this._set.add(v); return !had; };',
      '  this.remove = function(v) { return this._set.delete(v); };',
      '  this.contains = function(v) { return this._set.has(v); };',
      '  this.size = function() { return this._set.size; };',
      '  this.isEmpty = function() { return this._set.size === 0; };',
      '  this.clear = function() { this._set.clear(); };',
      '  this.toArray = function() { return Array.from(this._set); };',
      '  this.toString = function() { return "[" + Array.from(this._set).join(", ") + "]"; };',
      '  this[Symbol.iterator] = function() { return this._set[Symbol.iterator](); };',
      '  this.iterator = function() { var arr = Array.from(this._set); var i = 0; return { hasNext: function() { return i < arr.length; }, next: function() { return arr[i++]; } }; };',
      '  this.forEach = function(fn) { this._set.forEach(fn); };',
      '}',
      'function TreeSet() { HashSet.call(this); }',
      'TreeSet.prototype = Object.create(HashSet.prototype);',
      '',
      'function Stack() {',
      '  ArrayList.call(this);',
      '  this.push = function(v) { this._data.push(v); return v; };',
      '  this.pop = function() { if (this._data.length === 0) throw new Error("EmptyStack"); return this._data.pop(); };',
      '  this.peek = function() { if (this._data.length === 0) throw new Error("EmptyStack"); return this._data[this._data.length - 1]; };',
      '  this.empty = function() { return this._data.length === 0; };',
      '  this.search = function(v) { var i = this._data.lastIndexOf(v); return i === -1 ? -1 : this._data.length - i; };',
      '}',
      'Stack.prototype = Object.create(ArrayList.prototype);',
      '',
      'var Arrays = {',
      '  sort: function(a, fromOrCmp, to) {',
      '    if (typeof fromOrCmp === "function") { a.sort(fromOrCmp); }',
      '    else if (fromOrCmp !== undefined) { var sub = a.slice(fromOrCmp, to); sub.sort(function(x,y) { return x < y ? -1 : x > y ? 1 : 0; }); for (var i = 0; i < sub.length; i++) a[fromOrCmp + i] = sub[i]; }',
      '    else { a.sort(function(x,y) { return x < y ? -1 : x > y ? 1 : 0; }); }',
      '  },',
      '  asList: function() {',
      '    var arr = arguments.length === 1 && Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);',
      '    return new ArrayList(arr);',
      '  },',
      '  fill: function(a, v) { for (var i = 0; i < a.length; i++) a[i] = v; },',
      '  copyOf: function(a, len) { var r = new Array(len); for (var i = 0; i < len; i++) r[i] = i < a.length ? a[i] : 0; return r; },',
      '  copyOfRange: function(a, from, to) { return a.slice(from, to); },',
      '  toString: function(a) { return "[" + a.join(", ") + "]"; },',
      '  deepToString: function(a) { return JSON.stringify(a); },',
      '  equals: function(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; },',
      '  binarySearch: function(a, key) {',
      '    var lo = 0, hi = a.length - 1;',
      '    while (lo <= hi) { var mid = (lo + hi) >>> 1; if (a[mid] < key) lo = mid + 1; else if (a[mid] > key) hi = mid - 1; else return mid; }',
      '    return -(lo + 1);',
      '  },',
      '  stream: function(a) { return { toArray: function() { return a.slice(); }, forEach: function(fn) { a.forEach(fn); } }; },',
      '};',
      '',
      'var Collections = {',
      '  sort: function(list, cmp) { list.sort(cmp); },',
      '  reverse: function(list) { list._data.reverse(); },',
      '  shuffle: function(list) { for (var i = list._data.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = list._data[i]; list._data[i] = list._data[j]; list._data[j] = t; } },',
      '  unmodifiableList: function(list) { return list; },',
      '  emptyList: function() { return new ArrayList(); },',
      '  singletonList: function(e) { return new ArrayList([e]); },',
      '  frequency: function(c, o) { var count = 0; var d = c._data || Array.from(c); for (var i = 0; i < d.length; i++) if (d[i] === o) count++; return count; },',
      '  max: function(c, cmp) { var d = c._data || Array.from(c); var m = d[0]; for (var i = 1; i < d.length; i++) { if (cmp ? cmp(d[i], m) > 0 : d[i] > m) m = d[i]; } return m; },',
      '  min: function(c, cmp) { var d = c._data || Array.from(c); var m = d[0]; for (var i = 1; i < d.length; i++) { if (cmp ? cmp(d[i], m) < 0 : d[i] < m) m = d[i]; } return m; },',
      '};',
      '',
      '// Exception classes',
      'function Exception(msg) { this.message = msg || ""; this.name = "Exception"; }',
      'Exception.prototype = Object.create(Error.prototype);',
      'Exception.prototype.getMessage = function() { return this.message; };',
      'Exception.prototype.toString = function() { return this.name + (this.message ? ": " + this.message : ""); };',
      '',
      'function RuntimeException(msg) { Exception.call(this, msg); this.name = "RuntimeException"; }',
      'RuntimeException.prototype = Object.create(Exception.prototype);',
      'function IllegalArgumentException(msg) { RuntimeException.call(this, msg); this.name = "IllegalArgumentException"; }',
      'IllegalArgumentException.prototype = Object.create(RuntimeException.prototype);',
      'function IllegalStateException(msg) { RuntimeException.call(this, msg); this.name = "IllegalStateException"; }',
      'IllegalStateException.prototype = Object.create(RuntimeException.prototype);',
      'function NullPointerException(msg) { RuntimeException.call(this, msg); this.name = "NullPointerException"; }',
      'NullPointerException.prototype = Object.create(RuntimeException.prototype);',
      'function IndexOutOfBoundsException(msg) { RuntimeException.call(this, msg); this.name = "IndexOutOfBoundsException"; }',
      'IndexOutOfBoundsException.prototype = Object.create(RuntimeException.prototype);',
      'function ArrayIndexOutOfBoundsException(msg) { IndexOutOfBoundsException.call(this, msg); this.name = "ArrayIndexOutOfBoundsException"; }',
      'ArrayIndexOutOfBoundsException.prototype = Object.create(IndexOutOfBoundsException.prototype);',
      'function UnsupportedOperationException(msg) { RuntimeException.call(this, msg); this.name = "UnsupportedOperationException"; }',
      'UnsupportedOperationException.prototype = Object.create(RuntimeException.prototype);',
      'function ClassCastException(msg) { RuntimeException.call(this, msg); this.name = "ClassCastException"; }',
      'ClassCastException.prototype = Object.create(RuntimeException.prototype);',
      'function ArithmeticException(msg) { RuntimeException.call(this, msg); this.name = "ArithmeticException"; }',
      'ArithmeticException.prototype = Object.create(RuntimeException.prototype);',
      'function NumberFormatException(msg) { IllegalArgumentException.call(this, msg); this.name = "NumberFormatException"; }',
      'NumberFormatException.prototype = Object.create(IllegalArgumentException.prototype);',
      'function StackOverflowError(msg) { Error.call(this, msg); this.name = "StackOverflowError"; this.message = msg || ""; }',
      'StackOverflowError.prototype = Object.create(Error.prototype);',
      '',
      'function __makeArray(dims, init) {',
      '  if (dims.length === 0) return init !== undefined ? init : 0;',
      '  var arr = new Array(dims[0]);',
      '  var rest = dims.slice(1);',
      '  for (var i = 0; i < dims[0]; i++) arr[i] = __makeArray(rest, init);',
      '  return arr;',
      '}',
      '',
      '// Scanner (basic stdin support)',
      'var __stdinLines = [];',
      'var __stdinPos = 0;',
      'function Scanner(src) {',
      '  this._tokens = [];',
      '  this._pos = 0;',
      '  this.nextLine = function() { return this._tokens.length > this._pos ? this._tokens[this._pos++] : ""; };',
      '  this.next = function() {',
      '    while (this._pos < this._tokens.length) {',
      '      var parts = this._tokens[this._pos].trim().split(/\\s+/);',
      '      if (parts.length > 0 && parts[0] !== "") return parts[0];',
      '      this._pos++;',
      '    }',
      '    return "";',
      '  };',
      '  this.nextInt = function() { return parseInt(this.next()); };',
      '  this.nextDouble = function() { return parseFloat(this.next()); };',
      '  this.nextFloat = function() { return parseFloat(this.next()); };',
      '  this.nextLong = function() { return parseInt(this.next()); };',
      '  this.hasNext = function() { return this._pos < this._tokens.length; };',
      '  this.hasNextLine = function() { return this._pos < this._tokens.length; };',
      '  this.hasNextInt = function() { return this.hasNext() && !isNaN(parseInt(this.next())); };',
      '  this.close = function() {};',
      '}',
      '',
      '// StringBuilder',
      'function StringBuilder(init) {',
      '  this._parts = init ? [String(init)] : [];',
      '  this.append = function(s) { this._parts.push(String(s)); return this; };',
      '  this.toString = function() { return this._parts.join(""); };',
      '  this.length = function() { return this.toString().length; };',
      '  this.charAt = function(i) { return this.toString().charAt(i); };',
      '  this.deleteCharAt = function(i) { var s = this.toString(); this._parts = [s.substring(0, i) + s.substring(i + 1)]; return this; };',
      '  this.insert = function(i, s) { var cur = this.toString(); this._parts = [cur.substring(0, i) + String(s) + cur.substring(i)]; return this; };',
      '  this.reverse = function() { this._parts = [this.toString().split("").reverse().join("")]; return this; };',
      '  this.delete = function(start, end) { var s = this.toString(); this._parts = [s.substring(0, start) + s.substring(end)]; return this; };',
      '  this.replace = function(start, end, str) { var s = this.toString(); this._parts = [s.substring(0, start) + str + s.substring(end)]; return this; };',
      '  this.substring = function(start, end) { return end !== undefined ? this.toString().substring(start, end) : this.toString().substring(start); };',
      '}',
      'function StringBuffer(init) { StringBuilder.call(this, init); }',
      'StringBuffer.prototype = Object.create(StringBuilder.prototype);',
      '',
      'var Objects = {',
      '  equals: function(a, b) { return a === b; },',
      '  hash: function() { var h = 0; for (var i = 0; i < arguments.length; i++) { h = ((h << 5) - h + (arguments[i] == null ? 0 : typeof arguments[i] === "number" ? arguments[i] : String(arguments[i]).length)) | 0; } return h; },',
      '  toString: function(o, def) { return o == null ? (def || "null") : String(o); },',
      '  requireNonNull: function(o, msg) { if (o == null) throw new NullPointerException(msg || "null"); return o; },',
      '  isNull: function(o) { return o == null; },',
      '  nonNull: function(o) { return o != null; },',
      '};',
      '',
      '// Comparable/Comparator support helper',
      'function __javaCompare(a, b) {',
      '  if (a != null && typeof a.compareTo === "function") return a.compareTo(b);',
      '  if (typeof a === "number" && typeof b === "number") return a - b;',
      '  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;',
      '  return 0;',
      '}',
      '',
      '// Functional interface helpers — lambdas are plain JS functions, these',
      '// adapters let Java code call .apply(), .test(), .accept(), .run(), .get()',
      '// or use them directly as function references.',
      'function Comparator_comparing(keyFn) {',
      '  return function(a, b) { return __javaCompare(keyFn(a), keyFn(b)); };',
      '}',
      'var Comparator = {',
      '  comparing: Comparator_comparing,',
      '  naturalOrder: function() { return function(a, b) { return __javaCompare(a, b); }; },',
      '  reverseOrder: function() { return function(a, b) { return __javaCompare(b, a); }; },',
      '};',
      '',
      '// ---- End Java Runtime Support ---------------------------------------------',
      '',
    ].join('\n'));
  };

  CodeGen.prototype.generateClass = function (cls) {
    if (cls.node !== 'class') return;
    var className = cls.name;
    this.currentClass = className;
    this.classes[className] = cls;

    if (cls.kind === 'enum') {
      this.generateEnum(cls);
      return;
    }

    if (cls.kind === 'interface') {
      // Interfaces are structural in our transpiled code — just emit as empty
      this.emitLine('// interface ' + className);
      // But generate any static fields/methods
      for (var i = 0; i < cls.members.length; i++) {
        var m = cls.members[i];
        if (m.node === 'method' && m.modifiers.indexOf('static') !== -1) {
          this.emitLine('var ' + className + '_' + m.name + ' = function(' +
            m.params.map(function (p) { return p.name; }).join(', ') + ') ' +
            this.generateBlock(m.body) + ';');
        }
      }
      return;
    }

    // Class declaration
    var superClass = cls.superClass || null;

    // Constructor
    var ctors = cls.members.filter(function (m) { return m.node === 'constructor'; });
    var fields = cls.members.filter(function (m) { return m.node === 'field'; });
    var methods = cls.members.filter(function (m) { return m.node === 'method'; });
    var staticFields = fields.filter(function (f) { return f.modifiers.indexOf('static') !== -1; });
    var instanceFields = fields.filter(function (f) { return f.modifiers.indexOf('static') === -1; });
    var staticMethods = methods.filter(function (m) { return m.modifiers.indexOf('static') !== -1; });
    var instanceMethods = methods.filter(function (m) { return m.modifiers.indexOf('static') === -1; });

    // Emit constructor function
    var ctor = ctors.length > 0 ? ctors[0] : null; // Use first constructor (overloading not fully supported)
    var ctorParams = ctor ? ctor.params.map(function (p) { return p.name; }) : [];

    this.emitLine('function ' + className + '(' + ctorParams.join(', ') + ') {');
    this.indent++;

    // Track constructor parameter names so field qualification doesn't shadow them
    this.localNames = {};
    if (ctor) {
      for (var pi = 0; pi < ctor.params.length; pi++) this.localNames[ctor.params[pi].name] = true;
      this._collectLocalVars(ctor.body, this.localNames);
    }

    // Call super constructor — use explicit super(args) from body if present
    if (superClass) {
      var superCallEmitted = false;
      if (ctor && ctor.body) {
        var ctorStmts = ctor.body.statements || [];
        for (var si = 0; si < ctorStmts.length; si++) {
          var s = ctorStmts[si];
          if (s.node === 'exprStmt' && s.expr && s.expr.node === 'superCall') {
            var superArgs = s.expr.args.map(this.generateExpr.bind(this)).join(', ');
            this.emitLine(superClass + '.call(this' + (superArgs ? ', ' + superArgs : '') + ');');
            superCallEmitted = true;
            break;
          }
        }
      }
      if (!superCallEmitted) {
        this.emitLine(superClass + '.call(this);');
      }
    }

    // Initialize instance fields
    for (var i = 0; i < instanceFields.length; i++) {
      var f = instanceFields[i];
      for (var j = 0; j < f.fields.length; j++) {
        var fld = f.fields[j];
        var init = fld.init ? this.generateExpr(fld.init) : this.defaultValue(f.type);
        this.emitLine('this.' + fld.name + ' = ' + init + ';');
      }
    }

    // Constructor body (skip super() calls — already handled above)
    if (ctor && ctor.body) {
      var stmts = ctor.body.statements || [];
      for (var i = 0; i < stmts.length; i++) {
        if (stmts[i].node === 'exprStmt' && stmts[i].expr && stmts[i].expr.node === 'superCall') continue;
        this.emitLine(this.generateStmt(stmts[i]));
      }
    }

    this.indent--;
    this.emitLine('}');
    this.localNames = {};

    // Inheritance
    if (superClass) {
      this.emitLine(className + '.prototype = Object.create(' + superClass + '.prototype);');
      this.emitLine(className + '.prototype.constructor = ' + className + ';');
    }

    // Instance methods
    for (var i = 0; i < instanceMethods.length; i++) {
      var m = instanceMethods[i];
      if (!m.body) continue;
      var params = m.params.map(function (p) { return p.name; });
      // Track parameter names so field qualification doesn't shadow them
      this.localNames = {};
      for (var pi = 0; pi < m.params.length; pi++) this.localNames[m.params[pi].name] = true;
      this._collectLocalVars(m.body, this.localNames);
      this.emitLine(className + '.prototype.' + m.name + ' = function(' + params.join(', ') + ') ' + this.generateBlock(m.body) + ';');
      this.localNames = {};
    }

    // Static fields
    for (var i = 0; i < staticFields.length; i++) {
      var f = staticFields[i];
      for (var j = 0; j < f.fields.length; j++) {
        var fld = f.fields[j];
        var init = fld.init ? this.generateExpr(fld.init) : this.defaultValue(f.type);
        this.emitLine(className + '.' + fld.name + ' = ' + init + ';');
      }
    }

    // Static methods
    for (var i = 0; i < staticMethods.length; i++) {
      var m = staticMethods[i];
      if (!m.body) continue;
      var params = m.params.map(function (p) { return p.name; });
      this.localNames = {};
      for (var pi = 0; pi < m.params.length; pi++) this.localNames[m.params[pi].name] = true;
      this._collectLocalVars(m.body, this.localNames);
      this.emitLine(className + '.' + m.name + ' = function(' + params.join(', ') + ') ' + this.generateBlock(m.body) + ';');
      this.localNames = {};
    }

    // Inner classes
    for (var i = 0; i < cls.members.length; i++) {
      if (cls.members[i].node === 'class') {
        this.generateClass(cls.members[i]);
      }
    }

    // Static initializers
    var staticInits = cls.members.filter(function (m) { return m.node === 'staticInit'; });
    for (var i = 0; i < staticInits.length; i++) {
      this.staticInits.push('(function() ' + this.generateBlock(staticInits[i].body) + ')();');
    }

    this.emitLine('');
  };

  CodeGen.prototype.generateEnum = function (cls) {
    var self = this;
    var className = cls.name;
    var constants = cls.members.filter(function (m) { return m.node === 'enumConstants'; });
    var constList = constants.length > 0 ? constants[0].constants : [];

    var fields = cls.members.filter(function (m) { return m.node === 'field'; });
    var ctors = cls.members.filter(function (m) { return m.node === 'constructor'; });
    var methods = cls.members.filter(function (m) { return m.node === 'method'; });
    var instanceFields = fields.filter(function (f) { return f.modifiers.indexOf('static') === -1; });
    var staticFields = fields.filter(function (f) { return f.modifiers.indexOf('static') !== -1; });
    var instanceMethods = methods.filter(function (m) { return m.modifiers.indexOf('static') === -1; });
    var staticMethods = methods.filter(function (m) { return m.modifiers.indexOf('static') !== -1; });

    var hasRichBody = instanceFields.length > 0 || ctors.length > 0 || instanceMethods.length > 0;

    if (!hasRichBody) {
      // Simple enum — string constants
      this.emitLine('var ' + className + ' = {};');
      for (var i = 0; i < constList.length; i++) {
        var c = constList[i];
        this.emitLine(className + '.' + c.name + ' = "' + c.name + '";');
      }
    } else {
      // Rich enum — each constant is an object with fields and methods

      // Emit constructor function
      var ctor = ctors.length > 0 ? ctors[0] : null;
      var ctorParams = ctor ? ctor.params.map(function (p) { return p.name; }) : [];

      this.emitLine('function ' + className + '(__name__, __ordinal__' + (ctorParams.length ? ', ' + ctorParams.join(', ') : '') + ') {');
      this.indent++;
      this.emitLine('this.name = function() { return __name__; };');
      this.emitLine('this.ordinal = function() { return __ordinal__; };');
      this.emitLine('this.toString = function() { return __name__; };');

      // Initialize instance fields
      for (var i = 0; i < instanceFields.length; i++) {
        var f = instanceFields[i];
        for (var j = 0; j < f.fields.length; j++) {
          var fld = f.fields[j];
          var init = fld.init ? this.generateExpr(fld.init) : this.defaultValue(f.type);
          this.emitLine('this.' + fld.name + ' = ' + init + ';');
        }
      }

      // Constructor body (skip super() calls)
      if (ctor && ctor.body) {
        var stmts = ctor.body.statements || [];
        for (var i = 0; i < stmts.length; i++) {
          if (stmts[i].node === 'exprStmt' && stmts[i].expr && stmts[i].expr.node === 'superCall') continue;
          this.emitLine(this.generateStmt(stmts[i]));
        }
      }

      this.indent--;
      this.emitLine('}');

      // Instance methods
      for (var i = 0; i < instanceMethods.length; i++) {
        var m = instanceMethods[i];
        if (!m.body) continue;
        var params = m.params.map(function (p) { return p.name; });
        this.emitLine(className + '.prototype.' + m.name + ' = function(' + params.join(', ') + ') ' + this.generateBlock(m.body) + ';');
      }

      // Create constant instances
      for (var i = 0; i < constList.length; i++) {
        var c = constList[i];
        var args = c.args ? c.args.map(function (a) { return self.generateExpr(a); }) : [];
        this.emitLine(className + '.' + c.name + ' = new ' + className + '("' + c.name + '", ' + i +
          (args.length ? ', ' + args.join(', ') : '') + ');');
      }
    }

    // values() and valueOf()
    this.emitLine(className + '.values = function() { return [' +
      constList.map(function (c) { return className + '.' + c.name; }).join(', ') + ']; };');
    this.emitLine(className + '.valueOf = function(name) { return ' + className + '[name]; };');

    // Static fields
    for (var i = 0; i < staticFields.length; i++) {
      var f = staticFields[i];
      for (var j = 0; j < f.fields.length; j++) {
        var fld = f.fields[j];
        var init = fld.init ? this.generateExpr(fld.init) : this.defaultValue(f.type);
        this.emitLine(className + '.' + fld.name + ' = ' + init + ';');
      }
    }

    // Static methods
    for (var i = 0; i < staticMethods.length; i++) {
      var m = staticMethods[i];
      if (!m.body) continue;
      var params = m.params.map(function (p) { return p.name; });
      this.localNames = {};
      for (var pi = 0; pi < m.params.length; pi++) this.localNames[m.params[pi].name] = true;
      this._collectLocalVars(m.body, this.localNames);
      this.emitLine(className + '.' + m.name + ' = function(' + params.join(', ') + ') ' + this.generateBlock(m.body) + ';');
      this.localNames = {};
    }

    this.emitLine('');
  };

  CodeGen.prototype.defaultValue = function (type) {
    if (type === 'int' || type === 'long' || type === 'short' || type === 'byte' ||
        type === 'float' || type === 'double') return '0';
    if (type === 'boolean') return 'false';
    if (type === 'char') return '"\\0"';
    return 'null';
  };

  CodeGen.prototype.generateBlock = function (block) {
    if (!block) return '{}';
    if (block.node !== 'block') return '{ ' + this.generateStmt(block) + ' }';
    var lines = [];
    for (var i = 0; i < block.statements.length; i++) {
      lines.push(this.generateStmt(block.statements[i]));
    }
    return '{\n' + lines.join('\n') + '\n}';
  };

  CodeGen.prototype.generateStmt = function (stmt) {
    if (!stmt) return '';
    switch (stmt.node) {
      case 'block':
        return this.generateBlock(stmt);
      case 'exprStmt':
        return this.generateExpr(stmt.expr) + ';';
      case 'localVar':
        return this.generateLocalVar(stmt);
      case 'if':
        var s = 'if (' + this.generateExpr(stmt.condition) + ') ' + this.generateBlock(stmt.then);
        if (stmt.else) s += ' else ' + (stmt.else.node === 'if' ? this.generateStmt(stmt.else) : this.generateBlock(stmt.else));
        return s;
      case 'while':
        return 'while (' + this.generateExpr(stmt.condition) + ') ' + this.generateBlock(stmt.body);
      case 'doWhile':
        return 'do ' + this.generateBlock(stmt.body) + ' while (' + this.generateExpr(stmt.condition) + ');';
      case 'for':
        var init = stmt.init ? (stmt.init.node === 'localVar' ? this.generateLocalVar(stmt.init).replace(/;$/, '') : this.generateExpr(stmt.init)) : '';
        var cond = stmt.condition ? this.generateExpr(stmt.condition) : '';
        var upd = stmt.update ? this.generateExpr(stmt.update) : '';
        return 'for (' + init + '; ' + cond + '; ' + upd + ') ' + this.generateBlock(stmt.body);
      case 'forEach':
        return 'for (var ' + stmt.name + ' of ' + this.generateExpr(stmt.iterable) + ') ' + this.generateBlock(stmt.body);
      case 'switch':
        return this.generateSwitch(stmt);
      case 'try':
        return this.generateTry(stmt);
      case 'throw':
        return 'throw ' + this.generateExpr(stmt.expr) + ';';
      case 'return':
        return stmt.expr ? 'return ' + this.generateExpr(stmt.expr) + ';' : 'return;';
      case 'break':
        return 'break;';
      case 'continue':
        return 'continue;';
      case 'class':
        this.generateClass(stmt);
        return '';
      default:
        return '/* unsupported statement: ' + stmt.node + ' */';
    }
  };

  CodeGen.prototype.generateLocalVar = function (stmt) {
    var parts = [];
    for (var i = 0; i < stmt.declarations.length; i++) {
      var d = stmt.declarations[i];
      parts.push(d.name + (d.init ? ' = ' + this.generateExpr(d.init) : ''));
    }
    return 'var ' + parts.join(', ') + ';';
  };

  CodeGen.prototype.generateSwitch = function (stmt) {
    var s = 'switch (' + this.generateExpr(stmt.expr) + ') {\n';
    for (var i = 0; i < stmt.cases.length; i++) {
      var c = stmt.cases[i];
      if (c.node === 'case') {
        s += 'case ' + this.generateExpr(c.value) + ':\n';
      } else {
        s += 'default:\n';
      }
      for (var j = 0; j < c.body.length; j++) {
        s += this.generateStmt(c.body[j]) + '\n';
      }
    }
    s += '}';
    return s;
  };

  CodeGen.prototype.generateTry = function (stmt) {
    var s = '';
    // Try-with-resources
    if (stmt.resources && stmt.resources.length > 0) {
      var resDeclParts = [];
      for (var i = 0; i < stmt.resources.length; i++) {
        var r = stmt.resources[i];
        resDeclParts.push('var ' + r.name + ' = ' + this.generateExpr(r.init) + ';');
      }
      s += '{ ' + resDeclParts.join(' ') + '\ntry ';
    } else {
      s += 'try ';
    }
    s += this.generateBlock(stmt.body);
    for (var i = 0; i < stmt.catches.length; i++) {
      var c = stmt.catches[i];
      s += ' catch (' + c.name + ') ' + this.generateBlock(c.body);
    }
    if (stmt.finally) {
      s += ' finally ' + this.generateBlock(stmt.finally);
    }
    if (stmt.resources && stmt.resources.length > 0) {
      s += '\nfinally { ';
      for (var i = stmt.resources.length - 1; i >= 0; i--) {
        s += 'if (' + stmt.resources[i].name + ' != null) ' + stmt.resources[i].name + '.close(); ';
      }
      s += '} }';
    }
    return s;
  };

  CodeGen.prototype.generateExpr = function (expr) {
    if (!expr) return 'undefined';
    switch (expr.node) {
      case 'literal':
        if (expr.type === 'string') return JSON.stringify(expr.value);
        if (expr.type === 'char') return JSON.stringify(expr.value);
        if (expr.type === 'null') return 'null';
        if (expr.type === 'boolean') return expr.value;
        // Number: strip type suffix, handle hex/binary
        var num = expr.value.replace(/[LlFfDd]$/, '');
        return num;
      case 'identifier':
        // Qualify field references: bare 'make' → 'this.make' if 'make' is a class field
        if (this.currentClass && this._isClassField(expr.name)) {
          return 'this.' + expr.name;
        }
        return expr.name;
      case 'this':
        return 'this';
      case 'super':
        return 'this.__proto__';
      case 'superCall':
        return '/* super() handled in constructor */';
      case 'thisCall':
        return '/* this() call */';
      case 'superMethodCall':
        return 'Object.getPrototypeOf(' + (this.currentClass || 'this') +
          '.prototype).' + expr.method + '.call(this' +
          (expr.args.length ? ', ' + expr.args.map(this.generateExpr.bind(this)).join(', ') : '') + ')';
      case 'superFieldAccess':
        return 'this.' + expr.field;
      case 'assign':
        return this.generateExpr(expr.left) + ' ' + expr.op + ' ' + this.generateExpr(expr.right);
      case 'binary':
        var left = this.generateExpr(expr.left);
        var right = this.generateExpr(expr.right);
        // Java integer division
        if (expr.op === '/') {
          return '((' + left + ' / ' + right + ') | 0)';
        }
        return '(' + left + ' ' + expr.op + ' ' + right + ')';
      case 'unary':
        return '(' + expr.op + this.generateExpr(expr.expr) + ')';
      case 'preIncDec':
        return '(' + expr.op + this.generateExpr(expr.expr) + ')';
      case 'postIncDec':
        return '(' + this.generateExpr(expr.expr) + expr.op + ')';
      case 'ternary':
        return '(' + this.generateExpr(expr.condition) + ' ? ' +
          this.generateExpr(expr.then) + ' : ' + this.generateExpr(expr.else) + ')';
      case 'cast':
        // Type casts are mostly no-ops in JS, but handle int cast
        if (expr.type === 'int' || expr.type === 'short' || expr.type === 'byte') {
          return '((' + this.generateExpr(expr.expr) + ') | 0)';
        }
        if (expr.type === 'char') {
          return 'String.fromCharCode(' + this.generateExpr(expr.expr) + ')';
        }
        return '(' + this.generateExpr(expr.expr) + ')';
      case 'instanceof':
        return '(' + this.generateExpr(expr.expr) + ' instanceof ' + expr.type + ')';
      case 'paren':
        return '(' + this.generateExpr(expr.expr) + ')';
      case 'call':
        // Qualify unqualified method calls within a class context:
        //   static method:   calculateAverage(x) → Welcome.calculateAverage(x)
        //   instance method: getYear() → this.getYear()
        //   inherited method: also checked via superClass chain
        var callName = expr.name;
        if (this.currentClass) {
          var _resolved = this._resolveUnqualifiedCall(callName);
          if (_resolved) callName = _resolved;
        }
        return callName + '(' + expr.args.map(this.generateExpr.bind(this)).join(', ') + ')';
      case 'methodCall':
        return this.generateMethodCall(expr);
      case 'fieldAccess':
        return this.generateFieldAccess(expr);
      case 'arrayAccess':
        return this.generateExpr(expr.array) + '[' + this.generateExpr(expr.index) + ']';
      case 'new':
        return 'new ' + expr.type + '(' + expr.args.map(this.generateExpr.bind(this)).join(', ') + ')';
      case 'newArray':
        if (expr.init) {
          return this.generateExpr(expr.init);
        }
        var dims = expr.dimensions.filter(function (d) { return d !== null; });
        if (dims.length === 1) {
          return 'new Array(' + this.generateExpr(dims[0]) + ').fill(' + this.arrayDefaultValue(expr.type) + ')';
        }
        return '__makeArray([' + dims.map(this.generateExpr.bind(this)).join(', ') + '], ' + this.arrayDefaultValue(expr.type) + ')';
      case 'arrayInit':
        return '[' + expr.elements.map(this.generateExpr.bind(this)).join(', ') + ']';
      case 'comma':
        return '(' + this.generateExpr(expr.left) + ', ' + this.generateExpr(expr.right) + ')';
      case 'classLiteral':
        return '"' + (expr.expr.name || expr.expr.value || 'Object') + '"';
      case 'lambda':
        var lparams = expr.params.map(function (p) { return p.name; }).join(', ');
        if (expr.body && expr.body.node === 'block') {
          return '(function(' + lparams + ') ' + this.generateBlock(expr.body) + ')';
        }
        return '(function(' + lparams + ') { return ' + this.generateExpr(expr.body) + '; })';
      default:
        return '/* unsupported expr: ' + expr.node + ' */';
    }
  };

  CodeGen.prototype.arrayDefaultValue = function (type) {
    if (type === 'boolean') return 'false';
    if (type === 'char') return '"\\0"';
    if (['int', 'long', 'short', 'byte', 'float', 'double'].indexOf(type) !== -1) return '0';
    return 'null';
  };

  CodeGen.prototype.generateMethodCall = function (expr) {
    var obj = this.generateExpr(expr.object);
    var method = expr.method;
    var args = expr.args.map(this.generateExpr.bind(this));

    // String method mappings (Java → JS)
    var stringMethods = {
      'length': { js: 'length', isProperty: true },
      'charAt': { js: 'charAt' },
      'substring': { js: 'substring' },
      'indexOf': { js: 'indexOf' },
      'lastIndexOf': { js: 'lastIndexOf' },
      'contains': { js: 'includes' },
      'startsWith': { js: 'startsWith' },
      'endsWith': { js: 'endsWith' },
      'trim': { js: 'trim' },
      'toLowerCase': { js: 'toLowerCase' },
      'toUpperCase': { js: 'toUpperCase' },
      'replace': { js: 'split(' + (args[0] || '""') + ').join(' + (args[1] || '""') + ')', isRaw: true },
      'replaceAll': { js: 'replace(new RegExp(' + (args[0] || '""') + ', "g"), ' + (args[1] || '""') + ')', isRaw: true },
      'split': { js: 'split' },
      'toCharArray': { js: 'split("")', isRaw: true },
      'isEmpty': { js: 'length === 0', isRaw: true },
      'equalsIgnoreCase': { js: 'toLowerCase() === ' + (args[0] || '""') + '.toLowerCase()', isRaw: true },
      'compareTo': { js: 'localeCompare(' + (args[0] || '""') + ')', isRaw: true },
      'matches': { js: 'match(new RegExp(' + (args[0] || '""') + '))', isRaw: true },
      'format': { js: null }, // handled specially
      'valueOf': { js: null }, // handled specially
      'join': { js: null }, // handled specially
    };

    var sm = stringMethods[method];
    if (sm) {
      if (method === 'format' || method === 'valueOf' || method === 'join') {
        if (method === 'format') return '__javaFormat(' + args.join(', ') + ')';
        if (method === 'valueOf') return 'String(' + args[0] + ')';
        if (method === 'join') return args.slice(1).join(' + ' + args[0] + ' + ');
      }
      if (sm.isRaw) return '(' + obj + '.' + sm.js + ')';
      if (sm.isProperty) return obj + '.' + sm.js;
      return obj + '.' + sm.js + '(' + args.join(', ') + ')';
    }

    // toString()
    if (method === 'toString') return 'String(' + obj + ')';
    if (method === 'hashCode') return '(typeof ' + obj + ' === "string" ? ' + obj + '.split("").reduce(function(h,c){return((h<<5)-h)+c.charCodeAt(0)|0;},0) : ' + obj + ')';
    if (method === 'equals') return '(' + obj + ' === ' + args[0] + ')';
    if (method === 'compareTo') return '__javaCompare(' + obj + ', ' + args[0] + ')';
    if (method === 'getClass') return '(' + obj + '.constructor.name || "Object")';

    return obj + '.' + method + '(' + args.join(', ') + ')';
  };

  CodeGen.prototype.generateFieldAccess = function (expr) {
    var obj = this.generateExpr(expr.object);
    var field = expr.field;

    // String.length → .length
    if (field === 'length') return obj + '.length';

    return obj + '.' + field;
  };

  // ---- Public API -----------------------------------------------------------

  return {
    compile: function (source, options) {
      options = options || {};
      try {
        var tokens = tokenize(source);
        var parser = new Parser(tokens);
        var ast = parser.parseCompilationUnit();
        var gen = new CodeGen();
        gen.skipRuntime = !!options.skipRuntime;
        var js = gen.generate(ast);

        // Find which class has public static void main(String[] args)
        var mainClass = null;
        for (var ci = 0; ci < ast.classes.length; ci++) {
          var cls = ast.classes[ci];
          if (cls.kind === 'interface') continue;
          for (var mi = 0; mi < cls.members.length; mi++) {
            var m = cls.members[mi];
            if (m.node === 'method' && m.name === 'main' && m.type === 'void' &&
                m.modifiers && m.modifiers.indexOf('static') !== -1 &&
                m.params && m.params.length === 1 && m.params[0].type === 'String[]') {
              mainClass = cls.name;
              break;
            }
          }
          if (mainClass) break;
        }

        return { success: true, code: js, error: null, mainClass: mainClass };
      } catch (e) {
        return { success: false, code: null, error: e.message || String(e) };
      }
    }
  };
})();


// ---- Initialisation ---------------------------------------------------------

self.postMessage({ type: 'loading', message: 'Loading Java runtime…' });

// Initialize immediately — no external dependencies to load
setTimeout(function () {
  try { if (typeof _fs === 'undefined') throw new Error('init failed'); } catch (e) {
    self.postMessage({ type: 'error', message: 'Java init failed: ' + e.message });
    return;
  }
  self.postMessage({ type: 'ready' });
}, 50);

// ---- Message handler --------------------------------------------------------

self.onmessage = function (e) {
  var msg = e.data;

  if (msg.type === 'run') {
    runFile(msg.id, msg.path, msg.args || []);
  } else if (msg.type === 'runCode') {
    runCode(msg.id, msg.code, !!msg.silent);
  } else if (msg.type === 'write') {
    writeFile(msg.id, msg.path, msg.content);
  } else if (msg.type === 'read') {
    readFile(msg.id, msg.path);
  }
};

// ---- Execution --------------------------------------------------------------

function runFile(id, path, args) {
  var code;
  try {
    code = _fs[path];
    if (code === undefined) throw new Error('File not found: ' + path);
  } catch (err) {
    self.postMessage({ type: 'stderr', text: 'Cannot read file: ' + path + '\n' });
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
    return;
  }
  runCode(id, code, false);
}

function runCode(id, code, silent) {
  if (_running) {
    self.postMessage({ type: 'stderr', text: 'Already running — please wait.\n' });
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
    return;
  }
  _running = true;

  // Compile all .java files in the virtual FS to build a multi-class context.
  // The provided `code` is compiled as the "main" file.
  var allSources = {};
  for (var p in _fs) {
    if (p.endsWith('.java')) {
      allSources[p] = _fs[p];
    }
  }

  // If the code is a raw Java snippet (from runCode), wrap it in a class
  var sourceToCompile = code;
  var isSnippet = false;
  if (code.indexOf('class ') === -1 && code.indexOf('interface ') === -1 && code.indexOf('enum ') === -1) {
    isSnippet = true;
    sourceToCompile = 'public class __Snippet {\n  public static void main(String[] args) {\n' + code + '\n  }\n}';
  }

  var result = JavaCompiler.compile(sourceToCompile);

  if (!result.success) {
    if (!silent) {
      self.postMessage({ type: 'stderr', text: result.error + '\n' });
    }
    _running = false;
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
    return;
  }

  // Also compile other .java files (for multi-file support)
  // Use skipRuntime to avoid re-emitting stdlib (which breaks prototype chains)
  var additionalCode = '';
  for (var p in allSources) {
    if (allSources[p] !== code) {
      var r2 = JavaCompiler.compile(allSources[p], { skipRuntime: true });
      if (r2.success) {
        additionalCode += r2.code + '\n';
      }
    }
  }

  // Execute the compiled JavaScript
  try {
    // Build execution context with correct ordering:
    //   1. Runtime (stdlib)
    //   2. Additional files (support classes like custom exceptions)
    //   3. Main file's classes
    //   4. main() invocation
    // This ensures support classes (e.g. CalculatorException) have their
    // prototypes set up BEFORE main file classes reference them.
    var runtimeMarker = '// ---- End Java Runtime Support';
    var markerIdx = result.code.indexOf(runtimeMarker);
    var fullCode;
    if (markerIdx !== -1 && additionalCode) {
      // Find end of marker line
      var endOfMarker = result.code.indexOf('\n', markerIdx);
      if (endOfMarker === -1) endOfMarker = result.code.length;
      var runtimePart = result.code.substring(0, endOfMarker + 1);
      var classesPart = result.code.substring(endOfMarker + 1);
      fullCode = runtimePart + '\n' + additionalCode + '\n' + classesPart;
    } else {
      fullCode = result.code + '\n' + additionalCode;
    }

    // Find the main class — use the AST result (not regex) to avoid matching
    // the wrong class in multi-class files (e.g. Vehicle vs Vehicles)
    var mainClassName = result.mainClass || null;
    if (!mainClassName && isSnippet) {
      mainClassName = '__Snippet';
    }

    if (mainClassName) {
      fullCode += '\n' + mainClassName + '.main([]);';
    }

    // Wrap in a function to capture output
    var wrappedCode = '(function() {\n' + fullCode + '\nreturn { stdout: __javaOut, stderr: __javaErr };\n})()';

    var output = eval(wrappedCode);

    if (!silent && output.stdout) {
      for (var i = 0; i < output.stdout.length; i++) {
        self.postMessage({ type: 'stdout', text: output.stdout[i] + '\n' });
      }
    }
    if (!silent && output.stderr) {
      for (var i = 0; i < output.stderr.length; i++) {
        self.postMessage({ type: 'stderr', text: output.stderr[i] + '\n' });
      }
    }

    _running = false;
    self.postMessage({ type: 'run_done', id: id, exitCode: 0 });
  } catch (err) {
    _running = false;
    if (err && err.__javaExit) {
      self.postMessage({ type: 'run_done', id: id, exitCode: err.code || 0 });
      return;
    }
    var errMsg = err.name ? (err.name + ': ' + err.message) : String(err);
    if (!silent) {
      self.postMessage({ type: 'stderr', text: errMsg + '\n' });
    }
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
  }
}

// ---- File I/O ---------------------------------------------------------------

function writeFile(id, path, content) {
  try {
    // Ensure parent directory entries (virtual — just store file directly)
    _fs[path] = content;
    self.postMessage({ type: 'write_ok', id: id });
  } catch (err) {
    self.postMessage({ type: 'write_error', id: id, message: err.message });
  }
}

function readFile(id, path) {
  if (_fs[path] !== undefined) {
    self.postMessage({ type: 'read_ok', id: id, content: _fs[path] });
  } else {
    self.postMessage({ type: 'read_error', id: id });
  }
}
