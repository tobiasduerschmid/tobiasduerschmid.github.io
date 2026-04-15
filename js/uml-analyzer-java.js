/**
 * Java UML Analyzer — extracts class diagrams and sequence diagrams from
 * Java source code using a lightweight recursive-descent parser.
 *
 * Parallel to uml-analyzer-js.js (JS/TS) and uml-analyzer.py (Python).
 * No external dependencies — runs synchronously in the browser main thread
 * for sub-10ms latency on tutorial-scale files.
 *
 * Produces the same @startuml/@enduml syntax consumed by the SVG renderers
 * in uml-bundle.js.
 *
 * Relationship inference adapted from:
 * - Milanova (2007) "Composition inference for UML class diagrams"
 * - Tonella & Potrich (2005) "Reverse Engineering of Object Oriented Code"
 * - Briand et al. (2006) "Reverse Engineering of UML Sequence Diagrams"
 */
(function (global) {
  'use strict';

  /* ===================================================================
   * Main entry point
   * =================================================================== */

  function analyzeJavaSources(sources) {
    var errors = [];
    var allTypeNames = new Set();
    var parsedFiles = {};

    // Parse all source files
    for (var filename in sources) {
      if (!sources.hasOwnProperty(filename)) continue;
      try {
        var tokens = tokenize(sources[filename]);
        var ast = parseJava(tokens, errors);
        parsedFiles[filename] = { ast: ast, source: sources[filename] };
        // Collect type names
        for (var i = 0; i < ast.length; i++) {
          var decl = ast[i];
          if (decl.kind === 'class' || decl.kind === 'interface' || decl.kind === 'enum') {
            allTypeNames.add(decl.name);
          }
        }
      } catch (e) {
        errors.push(filename + ': Parse error: ' + e.message);
      }
    }

    // Extract class diagram
    var extractor = new JavaClassExtractor(parsedFiles, allTypeNames, errors);
    extractor.analyze();
    var classDiagram = extractor.generatePlantUML();

    // Extract sequence diagram
    var seqGen = new JavaSequenceDiagramGenerator(parsedFiles, extractor, allTypeNames, errors);
    seqGen.generate();
    var sequenceDiagram = seqGen.generatePlantUML();

    return {
      classDiagram: classDiagram,
      sequenceDiagram: sequenceDiagram,
      errors: errors
    };
  }

  /* ===================================================================
   * Tokenizer — fast regex-based Java lexer
   * =================================================================== */

  var JAVA_KEYWORDS = new Set([
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch',
    'char', 'class', 'const', 'continue', 'default', 'do', 'double',
    'else', 'enum', 'extends', 'final', 'finally', 'float', 'for',
    'if', 'implements', 'import', 'instanceof', 'int', 'interface',
    'long', 'native', 'new', 'package', 'private', 'protected', 'public',
    'return', 'short', 'static', 'strictfp', 'super', 'switch',
    'synchronized', 'this', 'throw', 'throws', 'transient', 'try',
    'void', 'volatile', 'while', 'var', 'record', 'sealed', 'permits',
    'yield', 'null', 'true', 'false'
  ]);

  function tokenize(source) {
    var tokens = [];
    var i = 0, len = source.length;

    while (i < len) {
      var ch = source[i];

      // Whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        i++;
        continue;
      }

      // Line comment
      if (ch === '/' && i + 1 < len && source[i + 1] === '/') {
        while (i < len && source[i] !== '\n') i++;
        continue;
      }

      // Block comment
      if (ch === '/' && i + 1 < len && source[i + 1] === '*') {
        i += 2;
        while (i + 1 < len && !(source[i] === '*' && source[i + 1] === '/')) i++;
        i += 2;
        continue;
      }

      // String literal
      if (ch === '"') {
        var start = i;
        i++;
        while (i < len && source[i] !== '"') {
          if (source[i] === '\\') i++;
          i++;
        }
        i++; // closing quote
        tokens.push({ type: 'string', value: source.substring(start, i) });
        continue;
      }

      // Char literal
      if (ch === '\'') {
        var start = i;
        i++;
        while (i < len && source[i] !== '\'') {
          if (source[i] === '\\') i++;
          i++;
        }
        i++;
        tokens.push({ type: 'char', value: source.substring(start, i) });
        continue;
      }

      // Number
      if (ch >= '0' && ch <= '9') {
        var start = i;
        while (i < len && /[0-9a-fA-FxXlLfFdD._]/.test(source[i])) i++;
        tokens.push({ type: 'number', value: source.substring(start, i) });
        continue;
      }

      // Identifier or keyword
      if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
        var start = i;
        while (i < len && /[\w$]/.test(source[i])) i++;
        var word = source.substring(start, i);
        var type = JAVA_KEYWORDS.has(word) ? 'keyword' : 'ident';
        tokens.push({ type: type, value: word });
        continue;
      }

      // Annotation
      if (ch === '@') {
        i++;
        var start = i;
        while (i < len && /[\w$.]/.test(source[i])) i++;
        var name = source.substring(start, i);
        // Skip annotation arguments
        if (i < len && source[i] === '(') {
          var depth = 1;
          i++;
          while (i < len && depth > 0) {
            if (source[i] === '(') depth++;
            else if (source[i] === ')') depth--;
            i++;
          }
        }
        tokens.push({ type: 'annotation', value: '@' + name });
        continue;
      }

      // Operators and punctuation
      tokens.push({ type: 'punct', value: ch });
      i++;
    }

    return tokens;
  }

  /* ===================================================================
   * Parser — recursive descent producing simplified AST
   *
   * AST node types:
   *   {kind: 'class', name, modifiers, extends, implements, members}
   *   {kind: 'interface', name, modifiers, extends, members}
   *   {kind: 'enum', name, modifiers, implements, constants, members}
   *   {kind: 'field', name, type, modifiers}
   *   {kind: 'method', name, returnType, params, modifiers, body}
   *   {kind: 'constructor', name, params, modifiers, body}
   * =================================================================== */

  function parseJava(tokens, errors) {
    var pos = 0;
    var declarations = [];

    function peek(offset) { return tokens[pos + (offset || 0)] || null; }
    function advance() { return tokens[pos++] || null; }
    function at(type, value) {
      var t = peek();
      if (!t) return false;
      if (type && t.type !== type) return false;
      if (value !== undefined && t.value !== value) return false;
      return true;
    }
    function expect(type, value) {
      if (at(type, value)) return advance();
      return null;
    }
    function consume(type, value) {
      if (at(type, value)) { advance(); return true; }
      return false;
    }

    // Skip package and import statements
    function skipPreamble() {
      while (pos < tokens.length) {
        if (at('keyword', 'package')) {
          while (pos < tokens.length && !consume('punct', ';')) advance();
        } else if (at('keyword', 'import')) {
          while (pos < tokens.length && !consume('punct', ';')) advance();
        } else {
          break;
        }
      }
    }

    // Collect modifiers
    function parseModifiers() {
      var mods = [];
      while (pos < tokens.length) {
        var t = peek();
        if (!t) break;
        if (t.type === 'annotation') { advance(); continue; }
        if (t.type === 'keyword' && (
          t.value === 'public' || t.value === 'private' || t.value === 'protected' ||
          t.value === 'static' || t.value === 'final' || t.value === 'abstract' ||
          t.value === 'synchronized' || t.value === 'native' || t.value === 'transient' ||
          t.value === 'volatile' || t.value === 'strictfp' || t.value === 'default' ||
          t.value === 'sealed'
        )) {
          mods.push(advance().value);
        } else {
          break;
        }
      }
      return mods;
    }

    // Parse a type expression (e.g., List<Map<String, Integer>>[], int)
    function parseType() {
      if (!peek()) return '';
      var parts = [];

      // Handle primitive types and identifiers
      var t = peek();
      if (!t) return '';

      // Simple type or qualified name
      if (t.type === 'ident' || t.type === 'keyword') {
        parts.push(advance().value);
        // Qualified name: com.example.MyClass
        while (at('punct', '.') && peek(1) && peek(1).type === 'ident') {
          advance(); // .
          parts.push('.' + advance().value);
        }
      } else {
        return '';
      }

      // Generic parameters: <Type, Type>
      if (at('punct', '<')) {
        var depth = 0;
        var genStr = '';
        while (pos < tokens.length) {
          var gt = peek();
          if (!gt) break;
          if (gt.value === '<') depth++;
          else if (gt.value === '>') {
            depth--;
            if (depth === 0) { genStr += advance().value; break; }
          }
          genStr += advance().value;
        }
        parts.push(genStr);
      }

      // Array dimensions
      while (at('punct', '[')) {
        advance();
        if (at('punct', ']')) advance();
        parts.push('[]');
      }

      // Varargs
      if (at('punct', '.') && peek(1) && peek(1).value === '.' && peek(2) && peek(2).value === '.') {
        advance(); advance(); advance();
        parts.push('...');
      }

      return parts.join('');
    }

    // Parse a parameter list: (Type name, Type name, ...)
    function parseParams() {
      var params = [];
      if (!consume('punct', '(')) return params;
      while (pos < tokens.length && !at('punct', ')')) {
        // Skip annotations on params
        while (at('annotation')) advance();
        // Skip 'final'
        if (at('keyword', 'final')) advance();
        var pType = parseType();
        var pName = '';
        if (peek() && peek().type === 'ident') {
          pName = advance().value;
        }
        if (pType) {
          params.push({ name: pName, type: pType });
        }
        consume('punct', ',');
      }
      consume('punct', ')');
      return params;
    }

    // Parse throws clause: throws ExceptionType, AnotherException
    function parseThrowsClause() {
      var types = [];
      if (!consume('keyword', 'throws')) return types;
      while (pos < tokens.length && !at('punct', '{') && !at('punct', ';')) {
        var t = parseType();
        if (t) types.push(t);
        if (!consume('punct', ',')) break;
      }
      return types;
    }

    // Skip a balanced brace block and return an array of raw tokens inside
    function parseBlock() {
      if (!consume('punct', '{')) return [];
      var depth = 1;
      var bodyTokens = [];
      while (pos < tokens.length && depth > 0) {
        var t = advance();
        if (t.value === '{') depth++;
        else if (t.value === '}') { depth--; if (depth === 0) break; }
        bodyTokens.push(t);
      }
      return bodyTokens;
    }

    // Skip to next sync point (} or ; at depth 0)
    function skipToSync() {
      var depth = 0;
      while (pos < tokens.length) {
        var t = advance();
        if (t.value === '{') depth++;
        else if (t.value === '}') {
          if (depth === 0) return;
          depth--;
        }
        else if (t.value === ';' && depth === 0) return;
      }
    }

    // Parse enum constants
    function parseEnumConstants() {
      var constants = [];
      while (pos < tokens.length) {
        if (at('punct', ';') || at('punct', '}')) break;
        if (peek() && peek().type === 'ident') {
          constants.push(advance().value);
          // Skip constructor args if present
          if (at('punct', '(')) {
            var depth = 1;
            advance();
            while (pos < tokens.length && depth > 0) {
              var t = advance();
              if (t.value === '(') depth++;
              else if (t.value === ')') depth--;
            }
          }
          // Skip class body if present
          if (at('punct', '{')) parseBlock();
        }
        consume('punct', ',');
      }
      consume('punct', ';');
      return constants;
    }

    // Parse class/interface/enum members
    function parseMembers(className, isInterface) {
      var members = [];
      if (!consume('punct', '{')) return members;

      while (pos < tokens.length && !at('punct', '}')) {
        try {
          var member = parseMember(className, isInterface);
          if (member) members.push(member);
        } catch (e) {
          skipToSync();
        }
      }
      consume('punct', '}');
      return members;
    }

    // Parse a single member (field or method/constructor)
    function parseMember(className, isInterface) {
      if (at('punct', ';')) { advance(); return null; }

      // Nested class/interface/enum
      var mods = parseModifiers();
      if (at('keyword', 'class') || at('keyword', 'interface') || at('keyword', 'enum')) {
        var nested = parseTypeDeclaration(mods);
        if (nested) return nested;
        return null;
      }

      // Static/instance initializer block
      if (at('punct', '{')) {
        parseBlock();
        return null;
      }

      // Constructor: ClassName(...)
      if (peek() && peek().type === 'ident' && peek().value === className &&
          peek(1) && peek(1).value === '(') {
        var name = advance().value;
        var params = parseParams();
        // throws clause
        var throwsTypes = parseThrowsClause();
        var body = at('punct', '{') ? parseBlock() : [];
        return { kind: 'constructor', name: name, params: params, modifiers: mods, body: body, throwsTypes: throwsTypes };
      }

      // Method or field: Type name(...) or Type name;
      var savedPos = pos;
      var type = parseType();
      if (!type) {
        if (pos === savedPos) advance(); // prevent infinite loop
        return null;
      }

      if (!peek() || peek().type !== 'ident') {
        // Could be a constructor with generics or broken syntax
        // Try to recover
        while (pos < tokens.length && !at('punct', ';') && !at('punct', '{') && !at('punct', '}')) advance();
        if (at('punct', ';')) advance();
        else if (at('punct', '{')) parseBlock();
        return null;
      }
      var memberName = advance().value;

      if (at('punct', '(')) {
        // Method
        var params = parseParams();
        // throws clause
        var throwsTypes = parseThrowsClause();
        var body = [];
        if (at('punct', '{')) {
          body = parseBlock();
        } else {
          consume('punct', ';'); // abstract or interface method
        }
        return {
          kind: 'method', name: memberName, returnType: type,
          params: params, modifiers: mods, body: body, throwsTypes: throwsTypes
        };
      } else {
        // Field — may have initializer and multiple declarators
        // Capture whether initializer starts with 'new' for composition inference
        var initHasNew = false;
        var initNewType = '';
        if (at('punct', '=')) {
          advance();
          if (at('keyword', 'new') && peek(1) && peek(1).type === 'ident') {
            initHasNew = true;
            initNewType = peek(1).value;
          }
          skipFieldInit();
        }
        var firstField = {
          kind: 'field', name: memberName, type: type, modifiers: mods,
          initHasNew: initHasNew, initNewType: initNewType
        };
        var fields = [firstField];

        // Additional declarators: int x = 1, y = 2;
        while (consume('punct', ',')) {
          if (peek() && peek().type === 'ident') {
            var extraName = advance().value;
            // Handle array dims on declarator
            var extraType = type;
            while (at('punct', '[')) {
              advance();
              if (at('punct', ']')) advance();
              extraType += '[]';
            }
            if (at('punct', '=')) { advance(); skipFieldInit(); }
            fields.push({ kind: 'field', name: extraName, type: extraType, modifiers: mods });
          }
        }
        consume('punct', ';');
        return fields.length === 1 ? firstField : { kind: 'fields', fields: fields };
      }
    }

    // Skip a field initializer (handles nested expressions with braces)
    function skipFieldInit() {
      var depth = 0;
      while (pos < tokens.length) {
        var t = peek();
        if (!t) break;
        if (t.value === '{') { depth++; advance(); }
        else if (t.value === '}') {
          if (depth === 0) break;
          depth--; advance();
        }
        else if ((t.value === ';' || t.value === ',') && depth === 0) break;
        else advance();
      }
    }

    // Parse a type declaration (class/interface/enum)
    function parseTypeDeclaration(mods) {
      if (at('keyword', 'class')) {
        advance();
        if (!peek() || peek().type !== 'ident') return null;
        var name = advance().value;
        // Skip type parameters
        if (at('punct', '<')) {
          var depth = 1; advance();
          while (pos < tokens.length && depth > 0) {
            if (peek().value === '<') depth++;
            else if (peek().value === '>') depth--;
            advance();
          }
        }
        var ext = '';
        if (consume('keyword', 'extends')) { ext = parseType(); }
        var impls = [];
        if (consume('keyword', 'implements')) {
          impls.push(parseType());
          while (consume('punct', ',')) impls.push(parseType());
        }
        // permits clause (sealed classes)
        if (at('keyword', 'permits')) {
          advance();
          parseType();
          while (consume('punct', ',')) parseType();
        }
        var members = parseMembers(name, false);
        return {
          kind: 'class', name: name, modifiers: mods,
          extends: ext, implements: impls, members: members
        };
      }

      if (at('keyword', 'interface')) {
        advance();
        if (!peek() || peek().type !== 'ident') return null;
        var name = advance().value;
        // Skip type parameters
        if (at('punct', '<')) {
          var depth = 1; advance();
          while (pos < tokens.length && depth > 0) {
            if (peek().value === '<') depth++;
            else if (peek().value === '>') depth--;
            advance();
          }
        }
        var ext = [];
        if (consume('keyword', 'extends')) {
          ext.push(parseType());
          while (consume('punct', ',')) ext.push(parseType());
        }
        var members = parseMembers(name, true);
        return {
          kind: 'interface', name: name, modifiers: mods,
          extends: ext, members: members
        };
      }

      if (at('keyword', 'enum')) {
        advance();
        if (!peek() || peek().type !== 'ident') return null;
        var name = advance().value;
        var impls = [];
        if (consume('keyword', 'implements')) {
          impls.push(parseType());
          while (consume('punct', ',')) impls.push(parseType());
        }
        if (!consume('punct', '{')) return null;
        var constants = parseEnumConstants();
        // Parse any members after the constants
        var members = [];
        while (pos < tokens.length && !at('punct', '}')) {
          try {
            var member = parseMember(name, false);
            if (member) members.push(member);
          } catch (e) { skipToSync(); }
        }
        consume('punct', '}');
        return {
          kind: 'enum', name: name, modifiers: mods,
          implements: impls, constants: constants, members: members
        };
      }

      return null;
    }

    // Main parse loop
    skipPreamble();
    while (pos < tokens.length) {
      try {
        var mods = parseModifiers();
        if (pos >= tokens.length) break;
        if (at('keyword', 'class') || at('keyword', 'interface') || at('keyword', 'enum')) {
          var decl = parseTypeDeclaration(mods);
          if (decl) declarations.push(decl);
        } else {
          // Skip unexpected token
          advance();
        }
      } catch (e) {
        errors.push('Parse error: ' + e.message);
        skipToSync();
      }
    }

    return declarations;
  }

  /* ===================================================================
   * Helpers
   * =================================================================== */

  /** Container types whose generic argument holds the element class. */
  var CONTAINER_TYPES = new Set([
    'List', 'ArrayList', 'LinkedList', 'Vector', 'Stack', 'CopyOnWriteArrayList',
    'Set', 'HashSet', 'TreeSet', 'LinkedHashSet', 'EnumSet',
    'Queue', 'Deque', 'ArrayDeque', 'PriorityQueue', 'LinkedList',
    'Collection', 'Iterable', 'Iterator', 'ListIterator',
    'Optional', 'Stream', 'Supplier', 'Consumer', 'Function', 'Predicate',
    'Future', 'CompletableFuture'
  ]);
  var MAPPING_TYPES = new Set([
    'Map', 'HashMap', 'TreeMap', 'LinkedHashMap', 'Hashtable',
    'ConcurrentHashMap', 'EnumMap', 'WeakHashMap'
  ]);

  function _extractBaseTypeName(typeStr, allTypeNames) {
    if (!typeStr) return null;

    // Strip array suffixes
    var base = typeStr.replace(/\[\]/g, '').replace(/\.\.\./g, '').trim();

    // Direct match
    if (allTypeNames.has(base)) return base;

    // Qualified name: take last segment
    var dotIdx = base.lastIndexOf('.');
    if (dotIdx !== -1) {
      var simple = base.substring(dotIdx + 1);
      if (allTypeNames.has(simple)) return simple;
      base = simple;
    }

    // Generic: Container<Element> or Container<Key, Value>
    var genMatch = base.match(/^(\w+)<(.+)>$/);
    if (genMatch) {
      var outer = genMatch[1];
      var inner = genMatch[2];

      if (CONTAINER_TYPES.has(outer)) {
        // Single type arg containers
        var cleaned = inner.replace(/<[^>]*>/g, '').trim();
        if (allTypeNames.has(cleaned)) return cleaned;
      }
      if (MAPPING_TYPES.has(outer)) {
        // Map<K, V> → extract V (last type arg)
        var args = _splitGenericArgs(inner);
        if (args.length > 0) {
          var lastArg = args[args.length - 1].trim().replace(/<[^>]*>/g, '');
          if (allTypeNames.has(lastArg)) return lastArg;
        }
      }
      // Try direct match of outer
      if (allTypeNames.has(outer)) return outer;
    }

    return null;
  }

  function _splitGenericArgs(s) {
    var args = [], depth = 0, current = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '<') depth++;
      else if (c === '>') depth--;
      else if (c === ',' && depth === 0) {
        args.push(current);
        current = '';
        continue;
      }
      current += c;
    }
    if (current.trim()) args.push(current);
    return args;
  }

  /** Check if a type string is a collection (List<X>, Set<X>, Map<K,V>, etc.) or array X[] */
  function _isCollectionType(typeStr) {
    if (!typeStr) return false;
    if (/\[\]/.test(typeStr)) return true;
    var match = typeStr.match(/^(\w+)</);
    if (!match) return false;
    return CONTAINER_TYPES.has(match[1]) || MAPPING_TYPES.has(match[1]);
  }

  /** Infer multiplicity from a type string: "1" for single, "*" for collection/array */
  function _inferMultiplicity(typeStr) {
    if (!typeStr) return '1';
    return _isCollectionType(typeStr) ? '*' : '1';
  }

  function _getVisibility(modifiers) {
    if (modifiers.indexOf('private') !== -1) return '-';
    if (modifiers.indexOf('protected') !== -1) return '#';
    if (modifiers.indexOf('public') !== -1) return '+';
    return '~'; // package-private
  }

  function _hasMod(modifiers, mod) {
    return modifiers.indexOf(mod) !== -1;
  }

  function _addUnique(arr, item) {
    if (arr.indexOf(item) === -1) arr.push(item);
  }

  /* ===================================================================
   * ClassInfo — same structure as JS analyzer
   * =================================================================== */

  function ClassInfo(name, opts) {
    this.name = name;
    this.isInterface = opts.isInterface || false;
    this.isAbstract  = opts.isAbstract  || false;
    this.isEnum      = opts.isEnum      || false;
    this.bases       = opts.bases       || [];
    this.implements  = opts.implements  || [];
    this.attributes  = [];
    this.methods     = [];
    this.compositions = [];   // [className]
    this.aggregations = [];   // [className]
    this.associations = [];   // [className]
    this.dependencies = [];   // [className]
    this._relAttrs    = new Set();
    this._relMult     = {};   // {targetClass: {srcMult, tgtMult}} — multiplicity metadata
  }

  /* ===================================================================
   * JavaClassExtractor
   * =================================================================== */

  function JavaClassExtractor(parsedFiles, allTypeNames, errors) {
    this.parsedFiles  = parsedFiles;
    this.allTypeNames = allTypeNames;
    this.errors       = errors;
    this.classMap     = new Map();

    // Lookup tables for sequence diagram generator
    this.classMethods = {};  // {className: {methodName: bodyTokens}}
    this.attrTypes    = {};  // {className: {attrName: className}}
    this.paramTypes   = {};  // {className: {methodName: {paramName: className}}}
    this.methodParams = {};  // {className: {methodName: [{name, type}]}}
  }

  JavaClassExtractor.prototype.analyze = function () {
    var self = this;
    for (var fn in this.parsedFiles) {
      if (!this.parsedFiles.hasOwnProperty(fn)) continue;
      var ast = this.parsedFiles[fn].ast;
      for (var i = 0; i < ast.length; i++) {
        this._visitDeclaration(ast[i]);
      }
    }
    this.classMap.forEach(function (info) { self._classifyRelationships(info); });
  };

  JavaClassExtractor.prototype._visitDeclaration = function (decl) {
    if (decl.kind === 'class')     this._visitClass(decl);
    else if (decl.kind === 'interface') this._visitInterface(decl);
    else if (decl.kind === 'enum')      this._visitEnum(decl);
  };

  /* ── Class ──────────────────────────────────────────────────── */

  JavaClassExtractor.prototype._visitClass = function (decl) {
    var name = decl.name;
    var isAbstract = _hasMod(decl.modifiers, 'abstract');
    var bases = decl.extends ? [_simpleTypeName(decl.extends)] : [];
    var impls = (decl.implements || []).map(_simpleTypeName);

    var info = new ClassInfo(name, { isAbstract: isAbstract, bases: bases, implements: impls });
    var methods = {}, aTypes = {}, pTypes = {}, mParams = {};

    for (var i = 0; i < decl.members.length; i++) {
      var member = decl.members[i];
      if (member.kind === 'field') {
        this._visitField(member, info, aTypes);
      } else if (member.kind === 'fields') {
        for (var f = 0; f < member.fields.length; f++) {
          this._visitField(member.fields[f], info, aTypes);
        }
      } else if (member.kind === 'constructor') {
        this._visitConstructor(member, info, methods, aTypes, pTypes, mParams);
      } else if (member.kind === 'method') {
        this._visitMethod(member, info, methods, pTypes, mParams);
      } else if (member.kind === 'class' || member.kind === 'interface' || member.kind === 'enum') {
        this._visitDeclaration(member);
      }
    }

    this.classMap.set(name, info);
    this.classMethods[name] = methods;
    this.attrTypes[name]    = aTypes;
    this.paramTypes[name]   = pTypes;
    this.methodParams[name] = mParams;
  };

  /* ── Field ──────────────────────────────────────────────────── */

  JavaClassExtractor.prototype._visitField = function (field, info, aTypes) {
    var vis = _getVisibility(field.modifiers);
    var isStatic = _hasMod(field.modifiers, 'static');
    var isFinal  = _hasMod(field.modifiers, 'final');
    var isAbstract = _hasMod(field.modifiers, 'abstract');

    info.attributes.push({
      name: field.name, type: _simpleTypeName(field.type), visibility: vis,
      isStatic: isStatic, isFinal: isFinal, isAbstract: isAbstract
    });

    // Field initializer: x = new ClassName() → composition
    if (field.initHasNew && field.initNewType && this.allTypeNames.has(field.initNewType)) {
      _addUnique(info.compositions, field.initNewType);
      info._relAttrs.add(field.name);
      aTypes[field.name] = field.initNewType;
      return;
    }

    var resolved = _extractBaseTypeName(field.type, this.allTypeNames);
    if (resolved) aTypes[field.name] = resolved;
  };

  /* ── Constructor ────────────────────────────────────────────── */

  JavaClassExtractor.prototype._visitConstructor = function (member, info, methods, aTypes, pTypes, mParamsMap) {
    var vis = _getVisibility(member.modifiers);
    var params = member.params || [];
    var paramTypeMap = {};

    for (var i = 0; i < params.length; i++) {
      var resolved = _extractBaseTypeName(params[i].type, this.allTypeNames);
      if (resolved) paramTypeMap[params[i].name] = resolved;
    }

    if (Object.keys(paramTypeMap).length > 0) pTypes['constructor'] = paramTypeMap;

    info.methods.push({
      name: info.name, params: params.map(function (p) {
        return { name: p.name, type: _simpleTypeName(p.type) };
      }),
      returnType: '', visibility: vis, isConstructor: true
    });

    methods['constructor'] = member.body;
    mParamsMap['constructor'] = params;

    // Scan constructor body for this.x = new Y() and this.x = param patterns
    this._scanConstructorBody(member.body, info, aTypes, paramTypeMap);
  };

  JavaClassExtractor.prototype._scanConstructorBody = function (bodyTokens, info, aTypes, paramTypeMap) {
    for (var i = 0; i < bodyTokens.length - 4; i++) {
      // Pattern: this . fieldName = ...
      if (bodyTokens[i].value === 'this' &&
          bodyTokens[i + 1] && bodyTokens[i + 1].value === '.' &&
          bodyTokens[i + 2] && bodyTokens[i + 2].type === 'ident' &&
          bodyTokens[i + 3] && bodyTokens[i + 3].value === '=') {
        var fieldName = bodyTokens[i + 2].value;
        var rhsStart = i + 4;

        if (rhsStart < bodyTokens.length) {
          // this.x = new ClassName(...) → composition (direct known type)
          if (bodyTokens[rhsStart].value === 'new' &&
              rhsStart + 1 < bodyTokens.length &&
              bodyTokens[rhsStart + 1].type === 'ident') {
            var typeName = bodyTokens[rhsStart + 1].value;
            if (this.allTypeNames.has(typeName)) {
              _addUnique(info.compositions, typeName);
              info._relAttrs.add(fieldName);
              aTypes[fieldName] = typeName;
            }
            // this.x = new ArrayList<>() — container created internally
            // The element type relationship is left to _classifyRelationships
            // (it will be association since elements aren't created here)
          }
          // this.x = paramName → aggregation if param is typed as known class
          else if (bodyTokens[rhsStart].type === 'ident') {
            var paramCls = paramTypeMap[bodyTokens[rhsStart].value];
            if (paramCls) {
              _addUnique(info.aggregations, paramCls);
              info._relAttrs.add(fieldName);
              aTypes[fieldName] = paramCls;
            }
          }
        }
      }

      // Pattern: this . collection . add ( new ClassName ( ) ) → composition via collection
      if (i + 6 < bodyTokens.length &&
          bodyTokens[i].value === 'this' &&
          bodyTokens[i + 1].value === '.' &&
          bodyTokens[i + 2].type === 'ident' &&
          bodyTokens[i + 3].value === '.' &&
          bodyTokens[i + 4].type === 'ident' &&
          (bodyTokens[i + 4].value === 'add' || bodyTokens[i + 4].value === 'put') &&
          bodyTokens[i + 5].value === '(') {
        // Scan inside parens for 'new ClassName'
        for (var j = i + 6; j < bodyTokens.length && bodyTokens[j].value !== ')'; j++) {
          if (bodyTokens[j].value === 'new' && j + 1 < bodyTokens.length &&
              bodyTokens[j + 1].type === 'ident' && this.allTypeNames.has(bodyTokens[j + 1].value)) {
            _addUnique(info.compositions, bodyTokens[j + 1].value);
            break;
          }
        }
      }
    }
  };

  /* ── Method ─────────────────────────────────────────────────── */

  JavaClassExtractor.prototype._visitMethod = function (member, info, methods, pTypes, mParamsMap) {
    var vis = _getVisibility(member.modifiers);
    var isStatic   = _hasMod(member.modifiers, 'static');
    var isAbstract = _hasMod(member.modifiers, 'abstract');
    var params = member.params || [];
    var paramTypeMap = {};

    for (var i = 0; i < params.length; i++) {
      var resolved = _extractBaseTypeName(params[i].type, this.allTypeNames);
      if (resolved) paramTypeMap[params[i].name] = resolved;
    }

    if (Object.keys(paramTypeMap).length > 0) pTypes[member.name] = paramTypeMap;

    info.methods.push({
      name: member.name,
      params: params.map(function (p) {
        return { name: p.name, type: _simpleTypeName(p.type) };
      }),
      returnType: _simpleTypeName(member.returnType),
      visibility: vis, isStatic: isStatic, isAbstract: isAbstract,
      throwsTypes: (member.throwsTypes || []).map(_simpleTypeName)
    });

    methods[member.name] = member.body;
    mParamsMap[member.name] = params;

    // Scan method body for this.collection.add(new X()) → composition
    this._scanMethodBodyForCompositions(member.body, info);
  };

  /** Scan a method body for this.field.add(new KnownClass()) patterns → composition */
  JavaClassExtractor.prototype._scanMethodBodyForCompositions = function (bodyTokens, info) {
    if (!bodyTokens) return;
    for (var i = 0; i + 6 < bodyTokens.length; i++) {
      if (bodyTokens[i].value === 'this' &&
          bodyTokens[i + 1].value === '.' &&
          bodyTokens[i + 2].type === 'ident' &&
          bodyTokens[i + 3].value === '.' &&
          bodyTokens[i + 4].type === 'ident' &&
          (bodyTokens[i + 4].value === 'add' || bodyTokens[i + 4].value === 'put') &&
          bodyTokens[i + 5].value === '(') {
        for (var j = i + 6; j < bodyTokens.length && bodyTokens[j].value !== ')'; j++) {
          if (bodyTokens[j].value === 'new' && j + 1 < bodyTokens.length &&
              bodyTokens[j + 1].type === 'ident' && this.allTypeNames.has(bodyTokens[j + 1].value)) {
            _addUnique(info.compositions, bodyTokens[j + 1].value);
            break;
          }
        }
      }
    }
  };

  /* ── Interface ──────────────────────────────────────────────── */

  JavaClassExtractor.prototype._visitInterface = function (decl) {
    var name = decl.name;
    var ext = (decl.extends || []).map(_simpleTypeName);

    var info = new ClassInfo(name, { isInterface: true, implements: ext });
    var methods = {}, pTypes = {}, mParamsMap = {};

    for (var i = 0; i < decl.members.length; i++) {
      var member = decl.members[i];
      if (member.kind === 'method') {
        var vis = _getVisibility(member.modifiers);
        var params = member.params || [];
        info.methods.push({
          name: member.name,
          params: params.map(function (p) {
            return { name: p.name, type: _simpleTypeName(p.type) };
          }),
          returnType: _simpleTypeName(member.returnType),
          visibility: '+', isAbstract: !_hasMod(member.modifiers, 'default')
        });
        methods[member.name] = member.body;
        mParamsMap[member.name] = params;
      } else if (member.kind === 'field') {
        info.attributes.push({
          name: member.name, type: _simpleTypeName(member.type),
          visibility: '+', isStatic: true, isFinal: true
        });
      }
    }

    this.classMap.set(name, info);
    this.classMethods[name] = methods;
    this.attrTypes[name]    = {};
    this.paramTypes[name]   = pTypes;
    this.methodParams[name] = mParamsMap;
  };

  /* ── Enum ───────────────────────────────────────────────────── */

  JavaClassExtractor.prototype._visitEnum = function (decl) {
    var name = decl.name;
    var impls = (decl.implements || []).map(_simpleTypeName);
    var info = new ClassInfo(name, { isEnum: true, implements: impls });

    for (var i = 0; i < (decl.constants || []).length; i++) {
      info.attributes.push({ name: decl.constants[i], type: '', visibility: '+' });
    }

    var methods = {}, pTypes = {}, mParamsMap = {};
    for (var i = 0; i < (decl.members || []).length; i++) {
      var member = decl.members[i];
      if (member.kind === 'method') {
        this._visitMethod(member, info, methods, pTypes, mParamsMap);
      } else if (member.kind === 'field') {
        this._visitField(member, info, {});
      }
    }

    this.classMap.set(name, info);
    this.classMethods[name] = methods;
    this.attrTypes[name]    = {};
    this.paramTypes[name]   = pTypes;
    this.methodParams[name] = mParamsMap;
  };

  /* ── Relationship classification ────────────────────────────── */

  JavaClassExtractor.prototype._classifyRelationships = function (info) {
    var structural = new Set();
    info.bases.forEach(function (b) { structural.add(b); });
    info.implements.forEach(function (i) { structural.add(i); });
    info.compositions.forEach(function (c) { structural.add(c); });
    info.aggregations.forEach(function (a) { structural.add(a); });

    // Remaining typed attributes → association or aggregation
    for (var i = 0; i < info.attributes.length; i++) {
      var attr = info.attributes[i];
      var resolved = _extractBaseTypeName(attr.type, this.allTypeNames);
      if (resolved && resolved !== info.name &&
          !structural.has(resolved) && !info._relAttrs.has(attr.name)) {
        var tgtMult = _inferMultiplicity(attr.type);
        // Collection-typed field (List<X>, Set<X>, etc.) → aggregation (1-to-many)
        if (_isCollectionType(attr.type)) {
          _addUnique(info.aggregations, resolved);
        } else {
          _addUnique(info.associations, resolved);
        }
        info._relMult[resolved] = { srcMult: '1', tgtMult: tgtMult };
        info._relAttrs.add(attr.name);
        structural.add(resolved);
      }
    }

    // Record multiplicity for compositions/aggregations by checking field types
    var self = this;
    function _findFieldMult(target) {
      for (var fi = 0; fi < info.attributes.length; fi++) {
        var attrResolved = _extractBaseTypeName(info.attributes[fi].type, self.allTypeNames);
        if (attrResolved === target) {
          return _isCollectionType(info.attributes[fi].type) ? '*' : '1';
        }
      }
      return '1';
    }
    for (var ci = 0; ci < info.compositions.length; ci++) {
      if (!info._relMult[info.compositions[ci]]) {
        info._relMult[info.compositions[ci]] = { srcMult: '1', tgtMult: _findFieldMult(info.compositions[ci]) };
      }
    }
    for (var ai = 0; ai < info.aggregations.length; ai++) {
      if (!info._relMult[info.aggregations[ai]]) {
        info._relMult[info.aggregations[ai]] = { srcMult: '1', tgtMult: _findFieldMult(info.aggregations[ai]) };
      }
    }

    // Method param/return types → dependency
    for (var m = 0; m < info.methods.length; m++) {
      var method = info.methods[m];
      var retResolved = _extractBaseTypeName(method.returnType, this.allTypeNames);
      if (retResolved && retResolved !== info.name && !structural.has(retResolved)) {
        _addUnique(info.dependencies, retResolved);
        structural.add(retResolved);
      }
      for (var p = 0; p < method.params.length; p++) {
        var paramResolved = _extractBaseTypeName(method.params[p].type, this.allTypeNames);
        if (paramResolved && paramResolved !== info.name && !structural.has(paramResolved)) {
          _addUnique(info.dependencies, paramResolved);
          structural.add(paramResolved);
        }
      }
      // throws clause types → dependency
      var throwsList = method.throwsTypes || [];
      for (var t = 0; t < throwsList.length; t++) {
        var throwsResolved = _extractBaseTypeName(throwsList[t], this.allTypeNames);
        if (throwsResolved && throwsResolved !== info.name && !structural.has(throwsResolved)) {
          _addUnique(info.dependencies, throwsResolved);
          structural.add(throwsResolved);
        }
      }
    }
  };

  /* ===================================================================
   * Generate PlantUML class diagram
   * =================================================================== */

  JavaClassExtractor.prototype.generatePlantUML = function () {
    if (this.classMap.size === 0) return '';

    var lines = ['@startuml'];
    var sorted = this._topologicalSort();

    for (var idx = 0; idx < sorted.length; idx++) {
      var info = sorted[idx];

      var keyword = 'class';
      if (info.isEnum)           keyword = 'enum';
      else if (info.isInterface) keyword = 'interface';
      else if (info.isAbstract)  keyword = 'abstract class';

      lines.push(keyword + ' ' + info.name + ' {');

      // Attributes (filter out those promoted to relationship arrows)
      for (var a = 0; a < info.attributes.length; a++) {
        var attr = info.attributes[a];
        if (info._relAttrs.has(attr.name)) continue;
        var aPrefix = '';
        if (attr.isStatic)   aPrefix += '{static} ';
        if (attr.isAbstract) aPrefix += '{abstract} ';
        aPrefix += attr.visibility || '+';
        var typeStr = attr.type ? ': ' + attr.type : '';
        lines.push('  ' + aPrefix + attr.name + typeStr);
      }

      // Methods
      for (var m = 0; m < info.methods.length; m++) {
        var method = info.methods[m];
        var mPrefix = '';
        if (method.isStatic)   mPrefix += '{static} ';
        if (method.isAbstract) mPrefix += '{abstract} ';
        mPrefix += method.visibility || '+';
        var paramStr = method.params.map(function (p) {
          return p.name + (p.type ? ': ' + p.type : '');
        }).join(', ');
        var retStr = (method.returnType && method.returnType !== 'void')
          ? ': ' + method.returnType : '';
        lines.push('  ' + mPrefix + method.name + '(' + paramStr + ')' + retStr);
      }

      lines.push('}');
    }

    // Build bidirectional association set for navigability
    var bidir = new Set();
    for (var bi = 0; bi < sorted.length; bi++) {
      var biCls = sorted[bi];
      for (var bj = 0; bj < biCls.associations.length; bj++) {
        var target = biCls.associations[bj];
        var targetInfo = this.classMap.get(target);
        if (targetInfo && targetInfo.associations.indexOf(biCls.name) !== -1) {
          // Both reference each other — bidirectional
          var key = [biCls.name, target].sort().join('::');
          bidir.add(key);
        }
      }
    }
    var emittedBidir = new Set();

    // Relationships
    for (var r = 0; r < sorted.length; r++) {
      var cls = sorted[r];
      for (var b = 0; b < cls.bases.length; b++) {
        if (this.allTypeNames.has(cls.bases[b])) {
          lines.push(cls.name + ' --|> ' + cls.bases[b]);
        }
      }
      for (var ii = 0; ii < cls.implements.length; ii++) {
        if (this.allTypeNames.has(cls.implements[ii])) {
          var arrow = cls.isInterface ? '--|>' : '..|>';
          lines.push(cls.name + ' ' + arrow + ' ' + cls.implements[ii]);
        }
      }
      for (var c = 0; c < cls.compositions.length; c++) {
        var compTarget = cls.compositions[c];
        var compMult = cls._relMult[compTarget];
        var compLabel = compMult ? ' "' + compMult.srcMult + '" *-- "' + compMult.tgtMult + '" ' : ' *-- ';
        lines.push(cls.name + compLabel + compTarget);
      }
      for (var ag = 0; ag < cls.aggregations.length; ag++) {
        var aggTarget = cls.aggregations[ag];
        var aggMult = cls._relMult[aggTarget];
        var aggLabel = aggMult ? ' "' + aggMult.srcMult + '" o-- "' + aggMult.tgtMult + '" ' : ' o-- ';
        lines.push(cls.name + aggLabel + aggTarget);
      }
      for (var as = 0; as < cls.associations.length; as++) {
        var assocTarget = cls.associations[as];
        var bdKey = [cls.name, assocTarget].sort().join('::');
        if (bidir.has(bdKey)) {
          // Bidirectional — emit once with undirected arrow
          if (!emittedBidir.has(bdKey)) {
            emittedBidir.add(bdKey);
            var m1 = cls._relMult[assocTarget];
            var m2 = this.classMap.get(assocTarget)._relMult[cls.name];
            var srcM = m1 ? m1.srcMult : '1';
            var tgtM = m1 ? m1.tgtMult : '1';
            lines.push(cls.name + ' "' + srcM + '" -- "' + tgtM + '" ' + assocTarget);
          }
        } else {
          // Unidirectional — directed arrow
          var assocMult = cls._relMult[assocTarget];
          var assocLabel = assocMult ? ' "' + assocMult.srcMult + '" --> "' + assocMult.tgtMult + '" ' : ' --> ';
          lines.push(cls.name + assocLabel + assocTarget);
        }
      }
      for (var d = 0; d < cls.dependencies.length; d++) {
        lines.push(cls.name + ' ..> ' + cls.dependencies[d]);
      }
    }

    lines.push('@enduml');
    return lines.join('\n');
  };

  JavaClassExtractor.prototype._topologicalSort = function () {
    var self = this;
    var visited = new Set(), order = [];

    function visit(name) {
      if (visited.has(name)) return;
      visited.add(name);
      var info = self.classMap.get(name);
      if (!info) return;
      info.bases.forEach(function (b)    { if (self.classMap.has(b)) visit(b); });
      info.implements.forEach(function (i) { if (self.classMap.has(i)) visit(i); });
      order.push(info);
    }
    this.classMap.forEach(function (_, name) { visit(name); });
    return order;
  };

  /* ===================================================================
   * JavaSequenceDiagramGenerator
   *
   * Walks main() or top-level code, tracks variable types (Java is
   * explicitly typed!), maps control-flow to combined fragments, and
   * follows method bodies recursively (max depth 3).
   * =================================================================== */

  var SEQ_MAX_DEPTH = 3;

  function JavaSequenceDiagramGenerator(parsedFiles, extractor, allTypeNames, errors) {
    this.parsedFiles  = parsedFiles;
    this.classMethods = extractor.classMethods;
    this.attrTypes    = extractor.attrTypes;
    this.paramTypes   = extractor.paramTypes;
    this.methodParams = extractor.methodParams;
    this.classMap     = extractor.classMap;
    this.allTypeNames = allTypeNames;
    this.errors       = errors;

    this.classBases = {};
    var self = this;
    extractor.classMap.forEach(function (info, name) {
      self.classBases[name] = info.bases.filter(function (b) { return allTypeNames.has(b); });
    });

    this._dataClasses = this._identifyDataClasses();

    this.participants    = [];
    this._participantSet = new Set();
    this.lines           = [];
    this.varTypes        = {};
    this._callerClass    = {};
    this._callStack      = new Set();
  }

  JavaSequenceDiagramGenerator.prototype._identifyDataClasses = function () {
    var data = new Set();
    this.classMap.forEach(function (info, name) {
      if (info.isEnum) { data.add(name); return; }
      if (info.isInterface) return;
      var hasBehavioral = info.methods.some(function (m) {
        return !m.isConstructor && m.name.indexOf('get') !== 0 &&
               m.name.indexOf('set') !== 0 && m.name !== 'toString' &&
               m.name !== 'hashCode' && m.name !== 'equals';
      });
      if (!hasBehavioral) data.add(name);
    });
    return data;
  };

  /* ── Public entry point ────────────────────────────────────── */

  JavaSequenceDiagramGenerator.prototype.generate = function () {
    var mainBody = this._findMain();
    if (!mainBody || mainBody.length === 0) return;

    this._ensureParticipant('Main', 'Main');
    this._processTokenBlock(mainBody, 'Main', 0);
  };

  JavaSequenceDiagramGenerator.prototype.generatePlantUML = function () {
    if (this.lines.length === 0) return '';
    var out = ['@startuml'];
    for (var i = 0; i < this.participants.length; i++) {
      var p = this.participants[i];
      out.push('participant ' + p.id + ': ' + p.label);
    }
    out.push('');
    out.push.apply(out, this.lines);
    out.push('@enduml');
    return out.join('\n');
  };

  /* ── Find main method ──────────────────────────────────────── */

  JavaSequenceDiagramGenerator.prototype._findMain = function () {
    for (var cn in this.classMethods) {
      if (this.classMethods[cn]['main']) return this.classMethods[cn]['main'];
    }
    // Fallback: look for any static method as entry point
    return null;
  };

  /* ── Token-based statement processing ──────────────────────── */

  JavaSequenceDiagramGenerator.prototype._processTokenBlock = function (tokens, caller, depth) {
    var i = 0;
    while (i < tokens.length) {
      var result = this._processTokenStmt(tokens, i, caller, depth);
      i = result;
    }
  };

  JavaSequenceDiagramGenerator.prototype._processTokenStmt = function (tokens, i, caller, depth) {
    if (i >= tokens.length) return tokens.length;
    var tok = tokens[i];

    // Variable declaration: Type varName = ...;
    if (this._isTypeStart(tokens, i)) {
      return this._processVarDecl(tokens, i, caller, depth);
    }

    // if statement → alt/opt fragment
    if (tok.value === 'if') {
      return this._processIf(tokens, i, caller, depth);
    }

    // for/while → loop fragment
    if (tok.value === 'for' || tok.value === 'while') {
      return this._processLoop(tokens, i, caller, depth);
    }

    // do-while → loop fragment
    if (tok.value === 'do') {
      return this._processDoWhile(tokens, i, caller, depth);
    }

    // try-catch → combined fragment
    if (tok.value === 'try') {
      return this._processTry(tokens, i, caller, depth);
    }

    // switch → alt fragment
    if (tok.value === 'switch') {
      return this._processSwitch(tokens, i, caller, depth);
    }

    // return statement with expression
    if (tok.value === 'return') {
      return this._processReturn(tokens, i, caller, depth);
    }

    // Expression statement (method call, assignment, etc.)
    return this._processExprStmt(tokens, i, caller, depth);
  };

  /* ── Type detection heuristic ──────────────────────────────── */

  JavaSequenceDiagramGenerator.prototype._isTypeStart = function (tokens, i) {
    // Heuristic: a type start is an identifier or keyword type followed by another identifier
    // Handles: Type varName, Type[] varName, Type<Generic> varName
    var tok = tokens[i];
    if (!tok) return false;

    // Skip annotations and modifiers
    var j = i;
    while (j < tokens.length && (tokens[j].type === 'annotation' ||
           (tokens[j].type === 'keyword' && (
             tokens[j].value === 'final' || tokens[j].value === 'var')))) j++;

    if (j >= tokens.length) return false;
    tok = tokens[j];

    // Must be an identifier or primitive type keyword
    if (tok.type !== 'ident' && !(tok.type === 'keyword' && _isPrimitiveType(tok.value))) return false;

    // Skip the type (including generics and array dims)
    j++;
    // Skip qualified name
    while (j + 1 < tokens.length && tokens[j].value === '.' && tokens[j + 1].type === 'ident') j += 2;
    // Skip generics
    if (j < tokens.length && tokens[j].value === '<') {
      var depth = 1; j++;
      while (j < tokens.length && depth > 0) {
        if (tokens[j].value === '<') depth++;
        else if (tokens[j].value === '>') depth--;
        j++;
      }
    }
    // Skip array dims
    while (j + 1 < tokens.length && tokens[j].value === '[' && tokens[j + 1].value === ']') j += 2;
    // Skip varargs
    while (j < tokens.length && tokens[j].value === '.') j++;

    // Next token must be an identifier (the variable name)
    return j < tokens.length && tokens[j].type === 'ident' &&
           j + 1 < tokens.length && (tokens[j + 1].value === '=' || tokens[j + 1].value === ';' || tokens[j + 1].value === ',');
  };

  function _isPrimitiveType(v) {
    return v === 'int' || v === 'long' || v === 'short' || v === 'byte' ||
           v === 'float' || v === 'double' || v === 'boolean' || v === 'char' || v === 'void';
  }

  /* ── Variable declaration ──────────────────────────────────── */

  JavaSequenceDiagramGenerator.prototype._processVarDecl = function (tokens, i, caller, depth) {
    // Skip modifiers
    while (i < tokens.length && (tokens[i].type === 'annotation' ||
           (tokens[i].type === 'keyword' && (tokens[i].value === 'final' || tokens[i].value === 'var')))) i++;

    // Read type
    var typeStr = '';
    var typeStart = i;
    i = this._readType(tokens, i);
    for (var t = typeStart; t < i; t++) typeStr += tokens[t].value;

    // Variable name
    if (i >= tokens.length || tokens[i].type !== 'ident') return this._skipToSemicolon(tokens, i);
    var varName = tokens[i].value;
    i++;

    // Track type
    var resolved = _extractBaseTypeName(typeStr, this.allTypeNames);
    if (resolved) this.varTypes[varName] = resolved;

    // Check for initializer
    if (i < tokens.length && tokens[i].value === '=') {
      i++;
      // new ClassName(...)
      if (i < tokens.length && tokens[i].value === 'new') {
        i++;
        if (i < tokens.length && tokens[i].type === 'ident') {
          var clsName = tokens[i].value;
          if (this.allTypeNames.has(clsName)) {
            this.varTypes[varName] = clsName;
            this._callerClass[varName] = clsName;
            if (!this._dataClasses.has(clsName)) {
              this._ensureParticipant(varName, clsName);
              this.lines.push('create ' + varName);
              this.lines.push(caller + ' --> ' + varName + ': <<create>>');
              this._maybeFollow(clsName, 'constructor', varName, depth);
            }
            i++;
            // Skip generic args
            if (i < tokens.length && tokens[i].value === '<') {
              var gd = 1; i++;
              while (i < tokens.length && gd > 0) {
                if (tokens[i].value === '<') gd++;
                else if (tokens[i].value === '>') gd--;
                i++;
              }
            }
            // Scan constructor args for nested calls
            if (i < tokens.length && tokens[i].value === '(') {
              var argTokens = this._extractParenContents(tokens, i);
              i = argTokens.endIdx;
              this._scanTokensForCalls(argTokens.tokens, caller, depth);
            }
            return this._skipToSemicolon(tokens, i);
          }
        }
      }
      // Other initializer — scan for method calls
      var exprEnd = this._findSemicolon(tokens, i);
      this._scanTokensForCalls(tokens.slice(i, exprEnd), caller, depth);
      return exprEnd < tokens.length ? exprEnd + 1 : tokens.length;
    }

    return this._skipToSemicolon(tokens, i);
  };

  /* ── Expression statement ──────────────────────────────────── */

  JavaSequenceDiagramGenerator.prototype._processExprStmt = function (tokens, i, caller, depth) {
    var end = this._findStmtEnd(tokens, i);
    var stmtTokens = tokens.slice(i, end);
    this._scanTokensForCalls(stmtTokens, caller, depth);
    return end < tokens.length && tokens[end].value === ';' ? end + 1 : end;
  };

  /* ── Return statement ──────────────────────────────────────── */

  JavaSequenceDiagramGenerator.prototype._processReturn = function (tokens, i, caller, depth) {
    i++; // skip 'return'
    var end = this._findSemicolon(tokens, i);
    this._scanTokensForCalls(tokens.slice(i, end), caller, depth);
    return end < tokens.length ? end + 1 : tokens.length;
  };

  /* ── If/else → alt/opt fragment ────────────────────────────── */

  JavaSequenceDiagramGenerator.prototype._processIf = function (tokens, i, caller, depth) {
    i++; // skip 'if'
    // Extract condition
    var condResult = this._extractParenContents(tokens, i);
    i = condResult.endIdx;
    var cond = condResult.tokens.map(function (t) { return t.value; }).join(' ');
    if (cond.length > 40) cond = cond.substring(0, 37) + '...';

    // Then block
    var thenResult = this._extractBlock(tokens, i);
    i = thenResult.endIdx;
    var thenLines = this._collectFragmentLines(thenResult.tokens, caller, depth);

    // Check for else
    if (i < tokens.length && tokens[i].value === 'else') {
      i++;
      // else if
      if (i < tokens.length && tokens[i].value === 'if') {
        var elseIfResult = this._processIfBranches(tokens, i, caller, depth);
        i = elseIfResult.endIdx;

        var branches = [{ header: 'alt [' + cond + ']', lines: thenLines }];
        branches.push.apply(branches, elseIfResult.branches);

        if (this._hasMessages(branches)) {
          for (var b = 0; b < branches.length; b++) {
            this.lines.push(branches[b].header);
            this.lines.push.apply(this.lines, branches[b].lines);
          }
          this.lines.push('end');
        } else {
          for (var b = 0; b < branches.length; b++)
            this.lines.push.apply(this.lines, branches[b].lines);
        }
      } else {
        // else block
        var elseResult = this._extractBlock(tokens, i);
        i = elseResult.endIdx;
        var elseLines = this._collectFragmentLines(elseResult.tokens, caller, depth);

        var branches = [
          { header: 'alt [' + cond + ']', lines: thenLines },
          { header: 'else [else]', lines: elseLines }
        ];
        if (this._hasMessages(branches)) {
          for (var b = 0; b < branches.length; b++) {
            this.lines.push(branches[b].header);
            this.lines.push.apply(this.lines, branches[b].lines);
          }
          this.lines.push('end');
        } else {
          for (var b = 0; b < branches.length; b++)
            this.lines.push.apply(this.lines, branches[b].lines);
        }
      }
    } else {
      // No else → opt
      if (this._anyMessages(thenLines)) {
        this.lines.push('opt [' + cond + ']');
        this.lines.push.apply(this.lines, thenLines);
        this.lines.push('end');
      } else {
        this.lines.push.apply(this.lines, thenLines);
      }
    }
    return i;
  };

  JavaSequenceDiagramGenerator.prototype._processIfBranches = function (tokens, i, caller, depth) {
    var branches = [];
    while (i < tokens.length && tokens[i].value === 'if') {
      i++; // skip 'if'
      var condResult = this._extractParenContents(tokens, i);
      i = condResult.endIdx;
      var cond = condResult.tokens.map(function (t) { return t.value; }).join(' ');
      if (cond.length > 40) cond = cond.substring(0, 37) + '...';

      var blockResult = this._extractBlock(tokens, i);
      i = blockResult.endIdx;
      var branchLines = this._collectFragmentLines(blockResult.tokens, caller, depth);
      branches.push({ header: 'else [' + cond + ']', lines: branchLines });

      if (i < tokens.length && tokens[i].value === 'else') {
        i++;
        if (i < tokens.length && tokens[i].value === 'if') continue;
        // Final else
        var elseResult = this._extractBlock(tokens, i);
        i = elseResult.endIdx;
        var elseLines = this._collectFragmentLines(elseResult.tokens, caller, depth);
        branches.push({ header: 'else [else]', lines: elseLines });
        break;
      } else {
        break;
      }
    }
    return { branches: branches, endIdx: i };
  };

  /* ── Loop → loop fragment ──────────────────────────────────── */

  JavaSequenceDiagramGenerator.prototype._processLoop = function (tokens, i, caller, depth) {
    var keyword = tokens[i].value;
    i++;

    // Extract condition/header in parens
    var condResult = this._extractParenContents(tokens, i);
    i = condResult.endIdx;
    var label = keyword + ' (' + condResult.tokens.map(function (t) { return t.value; }).join(' ') + ')';
    if (label.length > 50) label = label.substring(0, 47) + '...)';

    // Infer loop variable type for enhanced for
    this._inferForEachType(condResult.tokens, caller);

    var bodyResult = this._extractBlock(tokens, i);
    i = bodyResult.endIdx;
    var bodyLines = this._collectFragmentLines(bodyResult.tokens, caller, depth);

    if (this._anyMessages(bodyLines)) {
      this.lines.push('loop [' + label + ']');
      this.lines.push.apply(this.lines, bodyLines);
      this.lines.push('end');
    } else {
      this.lines.push.apply(this.lines, bodyLines);
    }
    return i;
  };

  JavaSequenceDiagramGenerator.prototype._processDoWhile = function (tokens, i, caller, depth) {
    i++; // skip 'do'
    var bodyResult = this._extractBlock(tokens, i);
    i = bodyResult.endIdx;

    var label = 'do-while';
    if (i < tokens.length && tokens[i].value === 'while') {
      i++;
      var condResult = this._extractParenContents(tokens, i);
      i = condResult.endIdx;
      label = 'do-while (' + condResult.tokens.map(function (t) { return t.value; }).join(' ') + ')';
    }
    if (i < tokens.length && tokens[i].value === ';') i++;

    var bodyLines = this._collectFragmentLines(bodyResult.tokens, caller, depth);
    if (this._anyMessages(bodyLines)) {
      this.lines.push('loop [' + label + ']');
      this.lines.push.apply(this.lines, bodyLines);
      this.lines.push('end');
    } else {
      this.lines.push.apply(this.lines, bodyLines);
    }
    return i;
  };

  /* ── Try/catch → combined fragment ─────────────────────────── */

  JavaSequenceDiagramGenerator.prototype._processTry = function (tokens, i, caller, depth) {
    i++; // skip 'try'
    // Skip try-with-resources parens
    if (i < tokens.length && tokens[i].value === '(') {
      var twrResult = this._extractParenContents(tokens, i);
      i = twrResult.endIdx;
    }
    var tryResult = this._extractBlock(tokens, i);
    i = tryResult.endIdx;
    var tryLines = this._collectFragmentLines(tryResult.tokens, caller, depth);

    var catchBranches = [];
    while (i < tokens.length && tokens[i].value === 'catch') {
      i++;
      var excType = 'Exception';
      if (i < tokens.length && tokens[i].value === '(') {
        var catchParens = this._extractParenContents(tokens, i);
        // Extract exception type from catch params (e.g., "IOException e")
        var catchTokens = catchParens.tokens;
        for (var ct = 0; ct < catchTokens.length; ct++) {
          if (catchTokens[ct].type === 'identifier') { excType = catchTokens[ct].value; break; }
        }
        i = catchParens.endIdx;
      }
      var catchResult = this._extractBlock(tokens, i);
      i = catchResult.endIdx;
      var catchLines = this._collectFragmentLines(catchResult.tokens, caller, depth);
      catchBranches.push({ excType: excType, lines: catchLines });
    }

    if (i < tokens.length && tokens[i].value === 'finally') {
      i++;
      var finallyResult = this._extractBlock(tokens, i);
      i = finallyResult.endIdx;
      this._processTokenBlock(finallyResult.tokens, caller, depth);
    }

    // Emit as alt/else combined fragment (same pattern as Python try/except)
    var hasTryMsgs = this._anyMessages(tryLines);
    var hasCatchMsgs = false;
    for (var cb = 0; cb < catchBranches.length; cb++) {
      if (this._anyMessages(catchBranches[cb].lines)) { hasCatchMsgs = true; break; }
    }
    if (hasTryMsgs || hasCatchMsgs) {
      this.lines.push('alt [try]');
      for (var tl = 0; tl < tryLines.length; tl++) this.lines.push(tryLines[tl]);
      for (var cb = 0; cb < catchBranches.length; cb++) {
        this.lines.push('else [catch ' + catchBranches[cb].excType + ']');
        for (var cl = 0; cl < catchBranches[cb].lines.length; cl++) this.lines.push(catchBranches[cb].lines[cl]);
      }
      this.lines.push('end');
    } else {
      for (var tl = 0; tl < tryLines.length; tl++) this.lines.push(tryLines[tl]);
      for (var cb = 0; cb < catchBranches.length; cb++) {
        for (var cl = 0; cl < catchBranches[cb].lines.length; cl++) this.lines.push(catchBranches[cb].lines[cl]);
      }
    }

    return i;
  };

  /* ── Switch → alt fragment ─────────────────────────────────── */

  JavaSequenceDiagramGenerator.prototype._processSwitch = function (tokens, i, caller, depth) {
    i++; // skip 'switch'
    var condResult = this._extractParenContents(tokens, i);
    i = condResult.endIdx;

    if (i >= tokens.length || tokens[i].value !== '{') return i;
    i++; // skip '{'

    var branches = [];
    var currentLabel = 'default';
    var currentTokens = [];

    while (i < tokens.length && tokens[i].value !== '}') {
      if (tokens[i].value === 'case') {
        if (currentTokens.length > 0) {
          var lines = this._collectFragmentLines(currentTokens, caller, depth);
          branches.push({ header: (branches.length === 0 ? 'alt' : 'else') + ' [' + currentLabel + ']', lines: lines });
          currentTokens = [];
        }
        i++;
        var caseLabel = '';
        while (i < tokens.length && tokens[i].value !== ':') {
          caseLabel += tokens[i].value + ' ';
          i++;
        }
        currentLabel = 'case ' + caseLabel.trim();
        i++; // skip ':'
      } else if (tokens[i].value === 'default') {
        if (currentTokens.length > 0) {
          var lines = this._collectFragmentLines(currentTokens, caller, depth);
          branches.push({ header: (branches.length === 0 ? 'alt' : 'else') + ' [' + currentLabel + ']', lines: lines });
          currentTokens = [];
        }
        currentLabel = 'default';
        i++;
        if (i < tokens.length && tokens[i].value === ':') i++;
      } else if (tokens[i].value === 'break') {
        i++;
        if (i < tokens.length && tokens[i].value === ';') i++;
      } else {
        currentTokens.push(tokens[i]);
        i++;
      }
    }
    if (currentTokens.length > 0) {
      var lines = this._collectFragmentLines(currentTokens, caller, depth);
      branches.push({ header: (branches.length === 0 ? 'alt' : 'else') + ' [' + currentLabel + ']', lines: lines });
    }
    if (i < tokens.length && tokens[i].value === '}') i++;

    if (this._hasMessages(branches)) {
      for (var b = 0; b < branches.length; b++) {
        this.lines.push(branches[b].header);
        this.lines.push.apply(this.lines, branches[b].lines);
      }
      this.lines.push('end');
    }
    return i;
  };

  /* ── Call scanning and resolution ──────────────────────────── */

  JavaSequenceDiagramGenerator.prototype._scanTokensForCalls = function (tokens, caller, depth) {
    for (var i = 0; i < tokens.length; i++) {
      // Pattern: identifier.method(
      if (i + 2 < tokens.length &&
          tokens[i].type === 'ident' &&
          tokens[i + 1].value === '.' &&
          tokens[i + 2].type === 'ident' &&
          i + 3 < tokens.length && tokens[i + 3].value === '(') {
        var receiver = tokens[i].value;
        var method   = tokens[i + 2].value;
        this._handleCall(receiver, method, tokens, i + 3, caller, depth);
        i += 3;
        continue;
      }

      // Pattern: this.method(
      if (i + 2 < tokens.length &&
          tokens[i].value === 'this' &&
          tokens[i + 1].value === '.' &&
          tokens[i + 2].type === 'ident' &&
          i + 3 < tokens.length && tokens[i + 3].value === '(') {
        var method = tokens[i + 2].value;
        var cc = this._classOf(caller);
        if (cc) {
          this._emitCall(caller, cc, method, tokens, i + 3, depth);
        }
        i += 3;
        continue;
      }

      // Pattern: super.method(
      if (i + 2 < tokens.length &&
          tokens[i].value === 'super' &&
          tokens[i + 1].value === '.' &&
          tokens[i + 2].type === 'ident' &&
          i + 3 < tokens.length && tokens[i + 3].value === '(') {
        var method = tokens[i + 2].value;
        var cc = this._classOf(caller);
        if (cc) {
          var parent = this._findParent(cc);
          if (parent) {
            this._emitCall(caller, parent, method, tokens, i + 3, depth, true);
          }
        }
        i += 3;
        continue;
      }

      // Pattern: new ClassName(
      if (tokens[i].value === 'new' &&
          i + 1 < tokens.length && tokens[i + 1].type === 'ident' &&
          i + 2 < tokens.length) {
        var clsName = tokens[i + 1].value;
        // Skip generic type args
        var j = i + 2;
        if (j < tokens.length && tokens[j].value === '<') {
          var gd = 1; j++;
          while (j < tokens.length && gd > 0) {
            if (tokens[j].value === '<') gd++;
            else if (tokens[j].value === '>') gd--;
            j++;
          }
        }
        if (this.allTypeNames.has(clsName) && !this._dataClasses.has(clsName) &&
            j < tokens.length && tokens[j].value === '(') {
          var calleeId = this._calleeIdFor(clsName, caller, null);
          this._ensureParticipant(calleeId, clsName);
          this._callerClass[calleeId] = clsName;
          this.lines.push('create ' + calleeId);
          this.lines.push(caller + ' --> ' + calleeId + ': <<create>>');
          this._maybeFollow(clsName, 'constructor', calleeId, depth);
          i = j;
        }
        continue;
      }

      // Pattern: ClassName.staticMethod(
      if (i + 2 < tokens.length &&
          tokens[i].type === 'ident' &&
          this.allTypeNames.has(tokens[i].value) &&
          tokens[i + 1].value === '.' &&
          tokens[i + 2].type === 'ident' &&
          i + 3 < tokens.length && tokens[i + 3].value === '(') {
        var clsName = tokens[i].value;
        var method  = tokens[i + 2].value;
        if (!this._dataClasses.has(clsName)) {
          this._emitCall(caller, clsName, method, tokens, i + 3, depth);
        }
        i += 3;
        continue;
      }
    }
  };

  JavaSequenceDiagramGenerator.prototype._handleCall = function (receiver, method, tokens, parenIdx, caller, depth) {
    // Resolve receiver to a class
    var clsName = this.varTypes[receiver];
    if (!clsName) {
      // Check if receiver is an attribute of the caller's class
      var cc = this._classOf(caller);
      if (cc && this.attrTypes[cc] && this.attrTypes[cc][receiver]) {
        clsName = this.attrTypes[cc][receiver];
      }
    }
    if (!clsName || this._dataClasses.has(clsName)) return;

    // Verify the method exists on the class
    if (!this.classMethods[clsName] || !this.classMethods[clsName][method]) {
      // Check parent classes
      var parentCls = this._findMethodInHierarchy(clsName, method);
      if (!parentCls) return;
      clsName = parentCls;
    }

    this._emitCall(caller, clsName, method, tokens, parenIdx, depth);
  };

  JavaSequenceDiagramGenerator.prototype._emitCall = function (caller, clsName, method, tokens, parenIdx, depth, isSuper) {
    var calleeId = this._calleeIdFor(clsName, caller, null);
    var label = method + '(';
    // Extract abbreviated args
    if (parenIdx < tokens.length && tokens[parenIdx].value === '(') {
      var argResult = this._extractParenContents(tokens, parenIdx);
      var argStr = argResult.tokens.slice(0, 10).map(function (t) { return t.value; }).join(' ');
      if (argStr.length > 30) argStr = argStr.substring(0, 27) + '...';
      label += argStr;
    }
    label += ')';

    if (calleeId === caller) {
      this.lines.push(caller + ' -> ' + caller + ': ' + label);
      this._maybeFollow(clsName, method, calleeId, depth);
    } else {
      this._ensureParticipant(calleeId, clsName);
      this._callerClass[calleeId] = clsName;
      this.lines.push(caller + ' -> ' + calleeId + ': ' + label);
      this._maybeFollow(clsName, method, calleeId, depth);
      var retType = this._getReturnType(clsName, method);
      if (retType) this.lines.push(calleeId + ' --> ' + caller + ': ' + retType);
    }
  };

  /* ── Method following ──────────────────────────────────────── */

  JavaSequenceDiagramGenerator.prototype._maybeFollow = function (clsName, methodName, calleeId, depth) {
    if (depth >= SEQ_MAX_DEPTH) return;

    var key = clsName + '::' + methodName;
    if (this._callStack.has(key)) return;

    var bodyTokens = this._findMethodBody(clsName, methodName);
    if (!bodyTokens || bodyTokens.length === 0) {
      // Try concrete override
      var concrete = this._findConcreteOverride(clsName, methodName);
      if (concrete) {
        clsName = concrete.className;
        bodyTokens = concrete.body;
        key = clsName + '::' + methodName;
        if (this._callStack.has(key)) return;
      } else {
        return;
      }
    }

    this._callStack.add(key);
    var savedVarTypes = {};
    for (var v in this.varTypes) savedVarTypes[v] = this.varTypes[v];

    // Seed with parameter types
    this.varTypes = {};
    var pt = (this.paramTypes[clsName] || {})[methodName];
    if (pt) { for (var p in pt) this.varTypes[p] = pt[p]; }

    this._processTokenBlock(bodyTokens, calleeId, depth + 1);

    this.varTypes = savedVarTypes;
    this._callStack.delete(key);
  };

  JavaSequenceDiagramGenerator.prototype._findMethodBody = function (clsName, methodName) {
    var visited = new Set(), current = clsName;
    while (current && !visited.has(current)) {
      visited.add(current);
      var meths = this.classMethods[current];
      if (meths && meths[methodName] && meths[methodName].length > 0) {
        // Check if the body is a stub (abstract/placeholder patterns)
        if (!this._isStubBody(meths[methodName])) return meths[methodName];
        // Stub body — try concrete override before falling through
        var concrete = this._findConcreteOverride(current, methodName);
        if (concrete) return concrete.body;
        return meths[methodName]; // return stub as fallback
      }
      current = this._findParent(current);
    }
    return null;
  };

  /** Check if a method body is a stub (throw UnsupportedOperationException, return null/0, etc.) */
  JavaSequenceDiagramGenerator.prototype._isStubBody = function (tokens) {
    if (!tokens || tokens.length === 0) return true;
    // Filter out whitespace-like tokens
    var meaningful = [];
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'whitespace' && tokens[i].type !== 'newline') {
        meaningful.push(tokens[i]);
      }
    }
    if (meaningful.length === 0) return true;
    // Single statement: throw new ...Exception(...)
    if (meaningful.length >= 2 && meaningful[0].value === 'throw' && meaningful[1].value === 'new') return true;
    // Single statement: return null; or return 0; or return false;
    if (meaningful.length === 2 && meaningful[0].value === 'return'
        && (meaningful[1].value === 'null' || meaningful[1].value === '0'
            || meaningful[1].value === 'false' || meaningful[1].value === 'true')) return true;
    // Single return; (void)
    if (meaningful.length === 1 && meaningful[0].value === 'return') return true;
    return false;
  };

  JavaSequenceDiagramGenerator.prototype._findMethodInHierarchy = function (clsName, methodName) {
    var visited = new Set(), current = clsName;
    while (current && !visited.has(current)) {
      visited.add(current);
      if (this.classMethods[current] && this.classMethods[current][methodName]) return current;
      current = this._findParent(current);
    }
    return null;
  };

  JavaSequenceDiagramGenerator.prototype._findConcreteOverride = function (clsName, methodName) {
    for (var cname in this.classBases) {
      if (this.classBases[cname].indexOf(clsName) !== -1 && this.classMethods[cname]) {
        var body = this.classMethods[cname][methodName];
        if (body && body.length > 0) {
          return { className: cname, body: body };
        }
      }
    }
    return null;
  };

  JavaSequenceDiagramGenerator.prototype._getReturnType = function (clsName, methodName) {
    var info = this.classMap.get(clsName);
    if (!info) return null;
    for (var i = 0; i < info.methods.length; i++) {
      if (info.methods[i].name === methodName) {
        var ret = info.methods[i].returnType;
        if (ret && ret !== 'void') return ret;
      }
    }
    return null;
  };

  /* ── Enhanced for-each type inference ──────────────────────── */

  JavaSequenceDiagramGenerator.prototype._inferForEachType = function (condTokens, caller) {
    // Pattern: Type varName : collection
    // Look for `:` separator which indicates enhanced for
    var colonIdx = -1;
    for (var i = 0; i < condTokens.length; i++) {
      if (condTokens[i].value === ':') { colonIdx = i; break; }
    }
    if (colonIdx < 2) return;

    var varName = condTokens[colonIdx - 1].value;
    // The type is everything before varName
    var typeStr = '';
    for (var i = 0; i < colonIdx - 1; i++) typeStr += condTokens[i].value;

    var resolved = _extractBaseTypeName(typeStr.trim(), this.allTypeNames);
    if (resolved) this.varTypes[varName] = resolved;

    // Also check collection type for element type
    if (colonIdx + 1 < condTokens.length) {
      var collectionVar = condTokens[colonIdx + 1].value;
      if (this.varTypes[collectionVar]) {
        // If the type isn't resolved directly, use the collection's element type
        if (!resolved) this.varTypes[varName] = this.varTypes[collectionVar];
      }
    }
  };

  /* ── Fragment helpers ──────────────────────────────────────── */

  JavaSequenceDiagramGenerator.prototype._collectFragmentLines = function (tokens, caller, depth) {
    var snapshot = this.lines.length;
    this._processTokenBlock(tokens, caller, depth);
    var newLines = this.lines.slice(snapshot);
    this.lines.length = snapshot;
    return newLines;
  };

  JavaSequenceDiagramGenerator.prototype._hasMessages = function (branches) {
    for (var b = 0; b < branches.length; b++) {
      if (this._anyMessages(branches[b].lines)) return true;
    }
    return false;
  };

  JavaSequenceDiagramGenerator.prototype._anyMessages = function (lines) {
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (ln && !/^(alt |else |loop |opt |end|activate |deactivate |create )/.test(ln))
        return true;
    }
    return false;
  };

  /* ── Token navigation helpers ──────────────────────────────── */

  JavaSequenceDiagramGenerator.prototype._extractParenContents = function (tokens, i) {
    if (i >= tokens.length || tokens[i].value !== '(') return { tokens: [], endIdx: i };
    var depth = 1, contents = [];
    i++;
    while (i < tokens.length && depth > 0) {
      if (tokens[i].value === '(') depth++;
      else if (tokens[i].value === ')') { depth--; if (depth === 0) { i++; break; } }
      contents.push(tokens[i]);
      i++;
    }
    return { tokens: contents, endIdx: i };
  };

  JavaSequenceDiagramGenerator.prototype._extractBlock = function (tokens, i) {
    if (i >= tokens.length) return { tokens: [], endIdx: i };
    // Single statement (no braces)
    if (tokens[i].value !== '{') {
      var end = this._findStmtEnd(tokens, i);
      var stmtTokens = tokens.slice(i, end);
      if (end < tokens.length && tokens[end].value === ';') end++;
      return { tokens: stmtTokens, endIdx: end };
    }
    // Braced block
    var depth = 1, contents = [];
    i++;
    while (i < tokens.length && depth > 0) {
      if (tokens[i].value === '{') depth++;
      else if (tokens[i].value === '}') { depth--; if (depth === 0) { i++; break; } }
      contents.push(tokens[i]);
      i++;
    }
    return { tokens: contents, endIdx: i };
  };

  JavaSequenceDiagramGenerator.prototype._readType = function (tokens, i) {
    if (i >= tokens.length) return i;
    // identifier or keyword
    if (tokens[i].type === 'ident' || (tokens[i].type === 'keyword' && _isPrimitiveType(tokens[i].value))) {
      i++;
    } else {
      return i;
    }
    // Qualified name
    while (i + 1 < tokens.length && tokens[i].value === '.' && tokens[i + 1].type === 'ident') i += 2;
    // Generics
    if (i < tokens.length && tokens[i].value === '<') {
      var depth = 1; i++;
      while (i < tokens.length && depth > 0) {
        if (tokens[i].value === '<') depth++;
        else if (tokens[i].value === '>') depth--;
        i++;
      }
    }
    // Array dims
    while (i + 1 < tokens.length && tokens[i].value === '[' && tokens[i + 1].value === ']') i += 2;
    // Varargs
    if (i + 2 < tokens.length && tokens[i].value === '.' && tokens[i + 1].value === '.' && tokens[i + 2].value === '.') i += 3;
    return i;
  };

  JavaSequenceDiagramGenerator.prototype._findSemicolon = function (tokens, i) {
    var depth = 0;
    while (i < tokens.length) {
      if (tokens[i].value === '{' || tokens[i].value === '(') depth++;
      else if (tokens[i].value === '}' || tokens[i].value === ')') depth--;
      else if (tokens[i].value === ';' && depth === 0) return i;
      i++;
    }
    return tokens.length;
  };

  JavaSequenceDiagramGenerator.prototype._findStmtEnd = function (tokens, i) {
    var depth = 0;
    while (i < tokens.length) {
      if (tokens[i].value === '{') {
        if (depth === 0) return i;
        depth++;
      }
      else if (tokens[i].value === '}') {
        if (depth === 0) return i;
        depth--;
      }
      else if (tokens[i].value === '(' || tokens[i].value === '[') depth++;
      else if (tokens[i].value === ')' || tokens[i].value === ']') depth--;
      else if (tokens[i].value === ';' && depth === 0) return i;
      i++;
    }
    return tokens.length;
  };

  JavaSequenceDiagramGenerator.prototype._skipToSemicolon = function (tokens, i) {
    while (i < tokens.length && tokens[i].value !== ';') i++;
    return i < tokens.length ? i + 1 : tokens.length;
  };

  /* ── Hierarchy & participant helpers ───────────────────────── */

  JavaSequenceDiagramGenerator.prototype._findParent = function (clsName) {
    var bases = this.classBases[clsName] || [];
    for (var i = 0; i < bases.length; i++) {
      if (this.classMethods[bases[i]]) return bases[i];
    }
    return null;
  };

  JavaSequenceDiagramGenerator.prototype._ensureParticipant = function (id, label) {
    if (!this._participantSet.has(id)) {
      this._participantSet.add(id);
      this.participants.push({ id: id, label: label });
    }
  };

  JavaSequenceDiagramGenerator.prototype._calleeIdFor = function (clsName, caller, attrHint) {
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

  JavaSequenceDiagramGenerator.prototype._classOf = function (pid) {
    if (this._callerClass[pid]) return this._callerClass[pid];
    if (this.allTypeNames.has(pid)) return pid;
    return null;
  };

  /* ===================================================================
   * Utility: simplify qualified type names for display
   * =================================================================== */

  function _simpleTypeName(typeStr) {
    if (!typeStr) return '';
    // Strip leading package qualifiers from simple types
    // java.util.List<String> → List<String>
    return typeStr.replace(/\b\w+\.\w+\./g, '');
  }

  /* ===================================================================
   * Export
   * =================================================================== */

  global.analyzeJavaSources = analyzeJavaSources;

})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
