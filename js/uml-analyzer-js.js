/**
 * JS/TS UML Analyzer — extracts class diagrams and sequence diagrams from
 * JavaScript/TypeScript source code.
 *
 * Parallel to uml-analyzer-python.js (which handles Python). Requires the
 * TypeScript compiler API (window.ts or passed as parameter) for AST parsing.
 *
 * Produces the same @startuml/@enduml custom syntax consumed by the SVG
 * renderers in uml-bundle.js.
 *
 * Relationship inference adapted from:
 * - Milanova (2007) "Composition inference for UML class diagrams"
 *   DOI: 10.1007/s10515-007-0010-8
 * - SEKE 2021 "Mapping OO relationships to UML relationships"
 *   DOI: 10.18293/SEKE2021-170
 *
 * Sequence diagram generation based on:
 * - Fauzi et al. (2016) "Reverse engineering of source code to sequence diagram"
 * - Rountev et al. (2005) "Static control-flow analysis for reverse engineering
 *   of UML sequence diagrams"
 */
(function (global) {
  'use strict';

  /* ===================================================================
   * Main entry point
   * =================================================================== */

  function analyzeJSSources(sources, tsCompiler) {
    var ts = tsCompiler || (typeof window !== 'undefined' && window.ts);
    if (!ts) {
      return { classDiagram: '', sequenceDiagram: '', errors: ['TypeScript compiler not available'] };
    }

    var errors = [];
    var parsedFiles = {};

    // Parse all source files into ASTs
    for (var filename in sources) {
      if (!sources.hasOwnProperty(filename)) continue;
      try {
        var scriptKind = _getScriptKind(ts, filename);
        parsedFiles[filename] = ts.createSourceFile(
          filename, sources[filename], ts.ScriptTarget.Latest, true, scriptKind
        );
      } catch (e) {
        errors.push(filename + ': Parse error: ' + e.message);
      }
    }

    parsedFiles = _resolveSuppliedSymbols(ts, parsedFiles);

    // First pass: collect all type names (classes, interfaces, enums)
    var allTypeNames = new Set();
    for (var fn in parsedFiles) {
      _collectTypeNames(ts, parsedFiles[fn], allTypeNames);
    }

    // Extract class diagram
    var extractor = new ClassExtractor(ts, parsedFiles, allTypeNames, errors);
    extractor.analyze();
    var classDiagram = extractor.generatePlantUML();

    // Extract sequence diagram
    var seqGen = new SequenceDiagramGenerator(ts, parsedFiles, extractor, allTypeNames, errors);
    seqGen.generate();
    var sequenceDiagram = seqGen.generatePlantUML();

    return {
      classDiagram: classDiagram,
      sequenceDiagram: sequenceDiagram,
      errors: errors
    };
  }

  /* ===================================================================
   * Helpers
   * =================================================================== */

  // Bind only supplied files: imports never trigger network or filesystem access.
  // Canonical names are introduced only for collisions; ordinary examples retain
  // their familiar labels. The existing extractors can then use one name index.
  function _resolveSuppliedSymbols(ts, parsedFiles) {
    const files = new Map(Object.entries(parsedFiles).map(([name, source]) => ['/' + name.replace(/^\/+/, ''), source]));
    const normalize = name => {
      const parts = [];
      for (const part of name.split('/')) {
        if (part === '..') parts.pop();
        else if (part && part !== '.') parts.push(part);
      }
      return '/' + parts.join('/');
    };
    const host = {
      getSourceFile: name => files.get(normalize(name)),
      getDefaultLibFileName: () => '', writeFile: () => {},
      getCurrentDirectory: () => '/', getDirectories: () => [],
      fileExists: name => files.has(normalize(name)),
      readFile: name => { const source = files.get(normalize(name)); return source && source.text; },
      getCanonicalFileName: name => normalize(name), useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      resolveModuleNames: (names, containingFile) => names.map(name => {
        if (!name.startsWith('.')) return undefined;
        const base = normalize(containingFile.slice(0, containingFile.lastIndexOf('/') + 1) + name);
        const candidates = [base, ...['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'].map(extension => base + extension)];
        const resolvedFileName = candidates.find(candidate => files.has(candidate));
        return resolvedFileName ? { resolvedFileName: resolvedFileName, isExternalLibraryImport: false } : undefined;
      })
    };
    const program = ts.createProgram(Array.from(files.keys()), { noLib: true, allowJs: true, checkJs: true }, host);
    const checker = program.getTypeChecker();
    const declarations = [];
    const counts = new Map();
    for (const source of files.values()) {
      const visit = node => {
        if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) {
          declarations.push(node);
          counts.set(node.name.text, (counts.get(node.name.text) || 0) + 1);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    const ids = new Map();
    const used = new Set();
    for (const declaration of declarations) {
      const name = declaration.name.text;
      let id = name;
      if (counts.get(name) > 1) {
        const file = declaration.getSourceFile().fileName.replace(/\.[^.]+$/, '').replace(/[^\w$]/g, '_').replace(/^_+/, '');
        id = file + '_' + name;
      }
      const base = id;
      for (let suffix = 2; used.has(id); suffix++) id = base + '_' + suffix;
      ids.set(declaration, id);
      used.add(id);
    }
    const symbolAt = node => {
      let symbol = checker.getSymbolAtLocation(node);
      if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) symbol = checker.getAliasedSymbol(symbol);
      return symbol;
    };
    const declarationId = symbol => {
      const targets = new Set((symbol && symbol.declarations || []).map(declaration => ids.get(declaration)).filter(Boolean));
      return targets.size === 1 ? Array.from(targets)[0] : null;
    };
    const renderType = (node, aliases = new Set(), bindings = new Map()) => {
      if (ts.isTypeReferenceNode(node) || ts.isExpressionWithTypeArguments(node)) {
        const typeName = node.typeName || node.expression;
        const symbol = symbolAt(typeName);
        if (bindings.has(symbol)) return bindings.get(symbol);
        const id = declarationId(symbol);
        const args = node.typeArguments ? '<' + node.typeArguments.map(type => renderType(type, aliases, bindings)).join(', ') + '>' : '';
        if (id) return id + args;
        const alias = (symbol && symbol.declarations || []).find(declaration => ts.isTypeAliasDeclaration(declaration));
        if (alias && !aliases.has(alias)) {
          const nextAliases = new Set(aliases).add(alias);
          const nextBindings = new Map(bindings);
          for (let index = 0; index < (alias.typeParameters || []).length; index++) {
            const parameter = alias.typeParameters[index];
            const suppliedArgument = node.typeArguments && node.typeArguments[index];
            const argument = suppliedArgument || parameter.default;
            if (argument) nextBindings.set(symbolAt(parameter.name),
              renderType(argument, nextAliases, suppliedArgument ? bindings : nextBindings));
          }
          return '(' + renderType(alias.type, nextAliases, nextBindings) + ')';
        }
        const name = typeName.getText();
        return (counts.has(name) ? 'unresolved.' + name : name) + args;
      }
      const edits = [];
      ts.forEachChild(node, child => {
        if (ts.isTypeNode(child)) edits.push({ start: child.getStart(), end: child.end, text: renderType(child, aliases, bindings) });
      });
      let text = node.getText();
      const start = node.getStart();
      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        text = text.slice(0, edit.start - start) + edit.text + text.slice(edit.end - start);
      }
      return text;
    };
    const resolved = {};
    for (const [filename, source] of Object.entries(parsedFiles)) {
      const edits = [];
      const visit = node => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
        if (ts.isTypeNode(node)) {
          edits.push({ start: node.getStart(), end: node.end, text: renderType(node) });
          return;
        }
        if ((ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) && !ts.isPrivateIdentifier(node)) {
          const parentDeclaration = ids.has(node.parent) && node.parent.name === node ? node.parent : null;
          const symbol = symbolAt(node);
          const id = parentDeclaration ? ids.get(parentDeclaration) : declarationId(symbol);
          if (id) {
            edits.push({ start: node.getStart(), end: node.end, text: id });
            return;
          }
          if (ts.isIdentifier(node) && counts.has(node.text) && (!symbol || !(symbol.declarations || []).length)) {
            edits.push({ start: node.getStart(), end: node.end, text: 'unresolved_' + node.text });
            return;
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      let text = source.text;
      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
      }
      resolved[filename] = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, _getScriptKind(ts, filename));
    }
    return resolved;
  }

  function _getScriptKind(ts, filename) {
    if (filename.endsWith('.tsx')) return ts.ScriptKind.TSX;
    if (filename.endsWith('.ts'))  return ts.ScriptKind.TS;
    if (filename.endsWith('.jsx')) return ts.ScriptKind.JSX;
    return ts.ScriptKind.JS;
  }

  function _collectTypeNames(ts, sourceFile, names) {
    function visit(node) {
      if (ts.isClassDeclaration(node) && node.name) {
        names.add(node.name.text);
      } else if (ts.isInterfaceDeclaration(node) && node.name) {
        names.add(node.name.text);
      } else if (ts.isEnumDeclaration(node) && node.name) {
        names.add(node.name.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }

  /** Container types whose generic argument holds the element class. */
  var CONTAINER_TYPES = new Set([
    'Array', 'ReadonlyArray', 'Set', 'ReadonlySet',
    'Map', 'ReadonlyMap', 'WeakSet', 'WeakMap',
    'Promise', 'Observable', 'Iterable', 'AsyncIterable',
    'Iterator', 'AsyncIterator', 'IterableIterator',
    'Generator', 'AsyncGenerator'
  ]);
  var MAPPING_TYPES = new Set(['Map', 'ReadonlyMap', 'WeakMap']);

  /**
   * Unwrap container/generic types to find the inner class name.
   *  Array<Task> → Task, Task[] → Task, Map<string,Task> → Task,
   *  Promise<Task> → Task, Set<Task> → Task, etc.
   */
  function _typeReferences(ts, node, allTypeNames) {
    if (!node) return [];
    if (ts.isParenthesizedTypeNode(node)) return _typeReferences(ts, node.type, allTypeNames);
    if (ts.isUnionTypeNode(node)) {
      const byTarget = new Map();
      for (const reference of node.types.flatMap(type => _typeReferences(ts, type, allTypeNames))) {
        const previous = byTarget.get(reference.target);
        byTarget.set(reference.target, {
          ...reference,
          multiplicity: previous && previous.multiplicity === '*' ? '*' : reference.multiplicity,
          alternative: reference.alternative || !!(previous && previous.alternative)
        });
      }
      const references = Array.from(byTarget.values());
      const alternatives = new Set(references.map(reference => reference.target)).size > 1;
      return references.map(reference => ({
        ...reference, multiplicity: reference.multiplicity === '*' ? '*' : '0..1',
        alternative: alternatives || reference.alternative
      }));
    }
    if (ts.isArrayTypeNode(node)) {
      return _typeReferences(ts, node.elementType, allTypeNames)
        .map(reference => ({ ...reference, multiplicity: '*' }));
    }
    if (!ts.isTypeReferenceNode(node)) return [];
    const name = node.typeName.getText();
    if (allTypeNames.has(name)) return [{ target: name, multiplicity: '1', alternative: false }];
    if (!CONTAINER_TYPES.has(name) || !node.typeArguments || !node.typeArguments.length) return [];
    const argument = node.typeArguments[MAPPING_TYPES.has(name) ? node.typeArguments.length - 1 : 0];
    const many = !['Promise', 'Observable'].includes(name);
    return _typeReferences(ts, argument, allTypeNames)
      .map(reference => ({ ...reference, multiplicity: many ? '*' : reference.multiplicity }));
  }

  function _extractBaseTypeName(ts, typeNode, allTypeNames) {
    const targets = new Set(_typeReferences(ts, typeNode, allTypeNames).map(reference => reference.target));
    return targets.size === 1 ? Array.from(targets)[0] : null;
  }

  function _recordRelationship(info, role, target, kind) {
    if (!info.relationships.some(edge => edge.role === role && edge.target === target && edge.kind === kind)) {
      info.relationships.push({ role: role, target: target, kind: kind, multiplicity: '1', alternative: false });
    }
    info._relAttrs.add(role);
  }

  function _getNodeText(node, sourceFile) {
    if (!node) return '';
    try { return node.getText(sourceFile); }
    catch (e) { return ''; }
  }

  function _getVisibility(ts, node) {
    if (!node.modifiers) {
      if (node.name && ts.isPrivateIdentifier && ts.isPrivateIdentifier(node.name))
        return '-';
      return '+';
    }
    for (var i = 0; i < node.modifiers.length; i++) {
      var k = node.modifiers[i].kind;
      if (k === ts.SyntaxKind.PrivateKeyword) return '-';
      if (k === ts.SyntaxKind.ProtectedKeyword) return '#';
    }
    return '+';
  }

  function _hasMod(ts, node, kind) {
    return node.modifiers && node.modifiers.some(function (m) { return m.kind === kind; });
  }

  function _addUnique(arr, item) {
    if (arr.indexOf(item) === -1) arr.push(item);
  }

  /* ===================================================================
   * ClassInfo — mirrors uml-analyzer-python.js ClassInfo
   * =================================================================== */

  function ClassInfo(name, opts) {
    this.name = name;
    this.isInterface = opts.isInterface || false;
    this.isAbstract  = opts.isAbstract  || false;
    this.isEnum      = opts.isEnum      || false;
    this.bases       = opts.bases       || [];  // [className] — extends
    this.implements  = opts.implements  || [];  // [ifaceName] — implements
    this.attributes  = [];   // [{name, type, visibility, isStatic, isAbstract}]
    this.methods     = [];   // [{name, params:[{name,type}], returnType, visibility, isStatic, isAbstract, isAsync}]
    this.dependencies = [];  // [className] — transient usage (params/returns)
    this.relationships = []; // Field-level edges; each role retains its own cardinality.
    this._relAttrs    = new Set(); // attrs promoted to relationship arrows
  }

  /* ===================================================================
   * ClassExtractor — extract classes, interfaces, relationships
   *
   * Relationship heuristics (adapted from Python analyzer):
   *   Composition:  this.x = new ClassName()        — created internally
   *   Aggregation:  constructor param property       — injected from outside
   *                 this.x = param (typed ctor arg)
   *   Association:  property typed as known class    — reference only
   *   Dependency:   method param/return type         — transient use
   * =================================================================== */

  function ClassExtractor(ts, parsedFiles, allTypeNames, errors) {
    this.ts           = ts;
    this.parsedFiles  = parsedFiles;
    this.allTypeNames = allTypeNames;
    this.errors       = errors;
    this.classMap     = new Map();   // name → ClassInfo

    // Lookup tables for the sequence diagram generator
    this.classMethods = {};  // {className: {methodName: AST node}}
    this.attrTypes    = {};  // {className: {attrName:  className}}
    this.paramTypes   = {};  // {className: {methodName: {paramName: className}}}
  }

  ClassExtractor.prototype.analyze = function () {
    var self = this;
    for (var fn in this.parsedFiles) {
      if (!this.parsedFiles.hasOwnProperty(fn)) continue;
      this._extractFromFile(this.parsedFiles[fn], fn);
    }
    this.classMap.forEach(function (info) { self._classifyRelationships(info); });
  };

  ClassExtractor.prototype._extractFromFile = function (sourceFile, filename) {
    var self = this, ts = this.ts;
    function visit(node) {
      if (ts.isClassDeclaration(node) && node.name) {
        self._visitClass(node, sourceFile);
      } else if (ts.isInterfaceDeclaration(node) && node.name) {
        self._visitInterface(node, sourceFile);
      } else if (ts.isEnumDeclaration(node) && node.name) {
        self._visitEnum(node, sourceFile);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  };

  /* ── Class declarations ─────────────────────────────────────── */

  ClassExtractor.prototype._visitClass = function (node, sourceFile) {
    var ts = this.ts;
    var name = node.name.text;
    var isAbstract = _hasMod(ts, node, ts.SyntaxKind.AbstractKeyword);

    // Heritage clauses
    var bases = [], impls = [];
    if (node.heritageClauses) {
      for (var i = 0; i < node.heritageClauses.length; i++) {
        var clause = node.heritageClauses[i];
        var list = clause.token === ts.SyntaxKind.ExtendsKeyword ? bases : impls;
        for (var j = 0; j < clause.types.length; j++) {
          var expr = clause.types[j].expression;
          // Handle qualified names: React.Component → Component
          var bName = ts.isPropertyAccessExpression(expr)
            ? _getNodeText(expr.name, sourceFile) : _getNodeText(expr, sourceFile);
          list.push(bName);
        }
      }
    }

    var info = new ClassInfo(name, { isAbstract: isAbstract, bases: bases, implements: impls });
    var methods = {}, aTypes = {}, pTypes = {}, initParamTypes = {};

    for (var m = 0; m < node.members.length; m++) {
      var member = node.members[m];
      var kind = member.kind;

      if (kind === ts.SyntaxKind.Constructor) {
        this._visitConstructor(member, info, sourceFile, methods, aTypes, pTypes, initParamTypes);
      } else if (kind === ts.SyntaxKind.PropertyDeclaration) {
        this._visitProperty(member, info, sourceFile, aTypes);
      } else if (kind === ts.SyntaxKind.MethodDeclaration ||
                 kind === ts.SyntaxKind.GetAccessor ||
                 kind === ts.SyntaxKind.SetAccessor) {
        this._visitMethod(member, info, sourceFile, methods, pTypes);
      }
    }

    this.classMap.set(name, info);
    this.classMethods[name] = methods;
    this.attrTypes[name]    = aTypes;
    this.paramTypes[name]   = pTypes;
  };

  /* ── Constructor ────────────────────────────────────────────── */

  ClassExtractor.prototype._visitConstructor = function (member, info, sourceFile, methods, aTypes, pTypes, initParamTypes) {
    var ts = this.ts;
    var params = [], mParams = {};

    for (var i = 0; i < member.parameters.length; i++) {
      var param = member.parameters[i];
      var pName = _getNodeText(param.name, sourceFile);
      var pType = param.type ? _getNodeText(param.type, sourceFile) : '';

      // TS parameter properties: constructor(private name: string)
      var isProperty = param.modifiers && param.modifiers.some(function (mod) {
        var k = mod.kind;
        return k === ts.SyntaxKind.PublicKeyword    || k === ts.SyntaxKind.PrivateKeyword ||
               k === ts.SyntaxKind.ProtectedKeyword || k === ts.SyntaxKind.ReadonlyKeyword;
      });

      if (isProperty) {
        info.attributes.push({ name: pName, type: pType, visibility: _getVisibility(ts, param), optional: !!param.questionToken });
      }

      var resolved = _extractBaseTypeName(ts, param.type, this.allTypeNames);
      if (resolved) {
        initParamTypes[pName] = resolved;
        mParams[pName] = resolved;
        // TS parameter property with known class type → aggregation
        if (isProperty) {
          _recordRelationship(info, pName, resolved, 'aggregation');
          aTypes[pName] = resolved;
        }
      }
      params.push({ name: pName, type: pType });
    }

    if (Object.keys(mParams).length > 0) pTypes['constructor'] = mParams;
    info.methods.push({ name: 'constructor', params: params, returnType: '', visibility: '+' });
    methods['constructor'] = member;

    // Walk constructor body for this.x = ... assignments
    if (member.body) {
      this._walkConstructorBody(member.body, info, sourceFile, aTypes, initParamTypes);
    }
  };

  ClassExtractor.prototype._walkConstructorBody = function (body, info, sourceFile, aTypes, initParamTypes) {
    var ts = this.ts, self = this;

    function visit(node) {
      if (!ts.isExpressionStatement(node)) { ts.forEachChild(node, visit); return; }
      var expr = node.expression;
      if (!ts.isBinaryExpression(expr) ||
          expr.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
        ts.forEachChild(node, visit);
        return;
      }
      var left = expr.left;
      if (!ts.isPropertyAccessExpression(left) ||
          left.expression.kind !== ts.SyntaxKind.ThisKeyword) {
        ts.forEachChild(node, visit);
        return;
      }
      var attrName = _getNodeText(left.name, sourceFile);
      var right    = expr.right;

      // this.x = new ClassName() → composition
      if (ts.isNewExpression(right)) {
        var typeName = _getNodeText(right.expression, sourceFile);
        if (self.allTypeNames.has(typeName)) {
          _recordRelationship(info, attrName, typeName, 'composition');
          aTypes[attrName] = typeName;
          return;
        }
      }

      // this.x = param → aggregation if param is a typed constructor arg
      if (ts.isIdentifier(right)) {
        var paramCls = initParamTypes[right.text];
        if (paramCls) {
          _recordRelationship(info, attrName, paramCls, 'aggregation');
          aTypes[attrName] = paramCls;
        }
      }
      ts.forEachChild(node, visit);
    }
    ts.forEachChild(body, visit);
  };

  /* ── Property declarations ──────────────────────────────────── */

  ClassExtractor.prototype._visitProperty = function (member, info, sourceFile, aTypes) {
    var ts   = this.ts;
    var name = _getNodeText(member.name, sourceFile);
    var vis  = _getVisibility(ts, member);
    var type = member.type ? _getNodeText(member.type, sourceFile) : '';
    var isStatic   = _hasMod(ts, member, ts.SyntaxKind.StaticKeyword);
    var isAbstract = _hasMod(ts, member, ts.SyntaxKind.AbstractKeyword);

    info.attributes.push({
      name: name, type: type, visibility: vis, isStatic: isStatic, isAbstract: isAbstract, optional: !!member.questionToken
    });

    // Property initializer: x = new ClassName() → composition
    if (member.initializer && ts.isNewExpression(member.initializer)) {
      var initType = _getNodeText(member.initializer.expression, sourceFile);
      if (this.allTypeNames.has(initType)) {
        _recordRelationship(info, name, initType, 'composition');
        aTypes[name] = initType;
        return;
      }
    }

    // Track type annotation for later relationship inference
    var resolved = _extractBaseTypeName(ts, member.type, this.allTypeNames);
    if (resolved) aTypes[name] = resolved;
  };

  /* ── Method declarations ────────────────────────────────────── */

  ClassExtractor.prototype._visitMethod = function (member, info, sourceFile, methods, pTypes) {
    var ts   = this.ts;
    var name = _getNodeText(member.name, sourceFile);
    var vis  = _getVisibility(ts, member);
    var isStatic   = _hasMod(ts, member, ts.SyntaxKind.StaticKeyword);
    var isAbstract = _hasMod(ts, member, ts.SyntaxKind.AbstractKeyword);
    var isAsync    = _hasMod(ts, member, ts.SyntaxKind.AsyncKeyword);
    var returnType = member.type ? _getNodeText(member.type, sourceFile) : '';

    var prefix = '';
    if (member.kind === ts.SyntaxKind.GetAccessor) prefix = 'get ';
    if (member.kind === ts.SyntaxKind.SetAccessor) prefix = 'set ';

    var params = [], mParams = {};
    if (member.parameters) {
      for (var i = 0; i < member.parameters.length; i++) {
        var p = member.parameters[i];
        var pName = _getNodeText(p.name, sourceFile);
        var pType = p.type ? _getNodeText(p.type, sourceFile) : '';
        params.push({ name: pName, type: pType });
        var resolved = _extractBaseTypeName(ts, p.type, this.allTypeNames);
        if (resolved) mParams[pName] = resolved;
      }
    }

    var fullName = prefix + name;
    if (Object.keys(mParams).length > 0) pTypes[fullName] = mParams;
    info.methods.push({
      name: fullName, params: params, returnType: returnType,
      visibility: vis, isStatic: isStatic, isAbstract: isAbstract, isAsync: isAsync
    });

    methods[fullName] = member;
    if (prefix) methods[name] = member;  // also store without prefix for lookup
  };

  /* ── Interface declarations ─────────────────────────────────── */

  ClassExtractor.prototype._visitInterface = function (node, sourceFile) {
    var ts = this.ts, name = node.name.text;

    // Interface extends
    var impls = [];
    if (node.heritageClauses) {
      for (var i = 0; i < node.heritageClauses.length; i++) {
        var clause = node.heritageClauses[i];
        for (var j = 0; j < clause.types.length; j++) {
          impls.push(_getNodeText(clause.types[j].expression, sourceFile));
        }
      }
    }

    var info = new ClassInfo(name, { isInterface: true, implements: impls });

    for (var m = 0; m < node.members.length; m++) {
      var member = node.members[m];
      if (member.kind === ts.SyntaxKind.PropertySignature) {
        var propName = _getNodeText(member.name, sourceFile);
        var propType = member.type ? _getNodeText(member.type, sourceFile) : 'any';
        info.attributes.push({ name: propName, type: propType, visibility: '+', optional: !!member.questionToken });
      } else if (member.kind === ts.SyntaxKind.MethodSignature) {
        var methName = _getNodeText(member.name, sourceFile);
        var params = [];
        if (member.parameters) {
          for (var p = 0; p < member.parameters.length; p++) {
            params.push({
              name: _getNodeText(member.parameters[p].name, sourceFile),
              type: member.parameters[p].type
                ? _getNodeText(member.parameters[p].type, sourceFile) : ''
            });
          }
        }
        var retType = member.type ? _getNodeText(member.type, sourceFile) : 'void';
        info.methods.push({
          name: methName, params: params, returnType: retType,
          visibility: '+', isAbstract: true
        });
      }
    }

    this.classMap.set(name, info);
    this.classMethods[name] = {};
    this.attrTypes[name]    = {};
    this.paramTypes[name]   = {};
  };

  /* ── Enum declarations ──────────────────────────────────────── */

  ClassExtractor.prototype._visitEnum = function (node, sourceFile) {
    var name = node.name.text;
    var info = new ClassInfo(name, { isEnum: true });

    for (var m = 0; m < node.members.length; m++) {
      info.attributes.push({
        name: _getNodeText(node.members[m].name, sourceFile), type: '', visibility: '+'
      });
    }

    this.classMap.set(name, info);
    this.classMethods[name] = {};
    this.attrTypes[name]    = {};
    this.paramTypes[name]   = {};
  };

  /* ── Relationship classification ────────────────────────────── */

  ClassExtractor.prototype._classifyRelationships = function (info) {
    var structural = new Set();
    info.bases.forEach(function (b) { structural.add(b); });
    info.implements.forEach(function (i) { structural.add(i); });

    // Each field is a separate relationship even when its target is shared.
    for (const attr of info.attributes) {
      const references = this._resolveTypeReferences(attr.type);
      for (const reference of references) {
        if (!info.relationships.some(edge => edge.role === attr.name && edge.target === reference.target)) {
          _recordRelationship(info, attr.name, reference.target, 'association');
        }
      }
      for (const edge of info.relationships.filter(edge => edge.role === attr.name)) {
        const annotation = references.find(reference => reference.target === edge.target);
        if (annotation) Object.assign(edge, annotation);
        if (attr.optional && edge.multiplicity !== '*') edge.multiplicity = '0..1';
      }
    }
    info.relationships.forEach(edge => structural.add(edge.target));

    // Temporary method uses remain dependencies unless a structural edge exists.
    for (const method of info.methods) {
      for (const type of [method.returnType, ...method.params.map(param => param.type)]) {
        for (const reference of this._resolveTypeReferences(type)) {
          if (reference.target !== info.name && !structural.has(reference.target)) {
            _addUnique(info.dependencies, reference.target);
            structural.add(reference.target);
          }
        }
      }
    }
  };

  ClassExtractor.prototype._resolveTypeReferences = function (typeStr) {
    if (!typeStr) return [];
    const source = this.ts.createSourceFile('type.ts', 'type Inferred = ' + typeStr + ';',
      this.ts.ScriptTarget.Latest, true, this.ts.ScriptKind.TS);
    return _typeReferences(this.ts, source.statements[0].type, this.allTypeNames);
  };

  /* ===================================================================
   * Generate PlantUML class diagram
   * =================================================================== */

  ClassExtractor.prototype.generatePlantUML = function () {
    if (this.classMap.size === 0) return '';

    var lines = ['@startuml', 'layout landscape', 'layout compact'];
    var sorted = this._topologicalSort();

    for (var idx = 0; idx < sorted.length; idx++) {
      var info = sorted[idx];

      // Determine stereotype keyword
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

    // Relationships
    for (var r = 0; r < sorted.length; r++) {
      var cls = sorted[r];
      // Inheritance (--|>)
      for (var b = 0; b < cls.bases.length; b++) {
        if (this.allTypeNames.has(cls.bases[b])) {
          lines.push(cls.name + ' --|> ' + cls.bases[b]);
        }
      }
      // Realization (..|>) for implements; inheritance (--|>) for interface-extends-interface
      for (var ii = 0; ii < cls.implements.length; ii++) {
        if (this.allTypeNames.has(cls.implements[ii])) {
          var arrow = cls.isInterface ? '--|>' : '..|>';
          lines.push(cls.name + ' ' + arrow + ' ' + cls.implements[ii]);
        }
      }
      const arrows = { composition: '*--', aggregation: 'o--', association: '-->' };
      for (const edge of cls.relationships) {
        const repeated = cls.relationships.filter(other => other.target === edge.target).length > 1;
        const labeled = repeated || edge.alternative;
        const multiplicities = labeled || edge.multiplicity !== '1';
        const arrow = multiplicities ? ' "1" ' + arrows[edge.kind] + ' "' + edge.multiplicity + '" ' : ' ' + arrows[edge.kind] + ' ';
        lines.push(cls.name + arrow + edge.target + (labeled ? ' : ' + edge.role + (edge.alternative ? ' (alternative)' : '') : ''));
      }
      // Dependency (..>)
      for (var d = 0; d < cls.dependencies.length; d++) {
        lines.push(cls.name + ' ..> ' + cls.dependencies[d]);
      }
    }

    lines.push('@enduml');
    return lines.join('\n');
  };

  ClassExtractor.prototype._topologicalSort = function () {
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
   * SequenceDiagramGenerator
   *
   * Walks top-level executable statements, tracks variable types,
   * maps control-flow to UML 2.0 combined fragments, and follows
   * method bodies recursively (max depth 3).
   * =================================================================== */

  var SEQ_MAX_DEPTH = 3;

  function SequenceDiagramGenerator(ts, parsedFiles, extractor, allTypeNames, errors) {
    this.ts           = ts;
    this.parsedFiles  = parsedFiles;
    this.classMethods = extractor.classMethods;
    this.attrTypes    = extractor.attrTypes;
    this.paramTypes   = extractor.paramTypes;
    this.classMap     = extractor.classMap;
    this.allTypeNames = allTypeNames;
    this.errors       = errors;

    // Class hierarchy for super() resolution
    this.classBases = {};
    var self = this;
    extractor.classMap.forEach(function (info, name) {
      self.classBases[name] = info.bases.filter(function (b) { return allTypeNames.has(b); });
    });

    this._dataClasses = this._identifyDataClasses();

    // Output
    this.participants    = [];        // [{id, label}]
    this._participantSet = new Set();
    this._syntheticReceiverIds = new Map();
    this._reservedParticipantIds = new Set(['Main', ...allTypeNames]);
    const reserveName = node => {
      if (ts.isIdentifier(node)) this._reservedParticipantIds.add(node.text);
      ts.forEachChild(node, reserveName);
    };
    Object.values(parsedFiles).forEach(reserveName);
    this.lines           = [];

    // Scope
    this.varTypes     = {};           // {varName: className}
    this.varParticipants = Object.create(null); // known object identities in this scope
    this._callerClass = {};           // {participantId: className}
    this._callStack   = new Set();    // "className::methodName"
  }

  /** Data/value classes: enums, or classes with no behavioral methods. */
  SequenceDiagramGenerator.prototype._identifyDataClasses = function () {
    var data = new Set();
    this.classMap.forEach(function (info, name) {
      if (info.isEnum) { data.add(name); return; }
      if (info.isInterface) return;
      var hasBehavioral = info.methods.some(function (m) {
        return m.name !== 'constructor' &&
               !m.name.startsWith('get ') && !m.name.startsWith('set ');
      });
      if (!hasBehavioral) data.add(name);
    });
    return data;
  };

  /* ── Public entry point ────────────────────────────────────── */

  SequenceDiagramGenerator.prototype.generate = function () {
    var entry = this._collectEntryStmts();
    if (!entry || entry.length === 0) return;

    this._ensureParticipant('Main', 'Main');

    var lineStart = this.lines.length;
    for (var i = 0; i < entry.length; i++) {
      this._processStmt(entry[i].stmt, entry[i].sourceFile, 'Main', 0);
    }
    if (this.lines.length > lineStart) {
      this.lines.splice(lineStart, 0, 'activate Main');
      this.lines.push('deactivate Main');
    }
  };

  SequenceDiagramGenerator.prototype.generatePlantUML = function () {
    if (this.lines.length === 0) return '';
    var out = ['@startuml', 'layout landscape'];
    for (var i = 0; i < this.participants.length; i++) {
      var p = this.participants[i];
      if (p.id === 'Main' && p.label === 'Main') {
        out.push('participant Main as : Main');
      } else {
        out.push('participant ' + p.id + ': ' + p.label);
      }
    }
    out.push('');
    out.push.apply(out, this.lines);
    out.push('@enduml');
    return out.join('\n');
  };

  /* ── Entry-point collection ────────────────────────────────── */

  SequenceDiagramGenerator.prototype._collectEntryStmts = function () {
    var ts = this.ts;
    var mainBlocks = {};  // {filename: [{stmt, sourceFile}]}
    var topStmts   = [];

    for (var fn in this.parsedFiles) {
      if (!this.parsedFiles.hasOwnProperty(fn)) continue;
      var sf = this.parsedFiles[fn];

      for (var i = 0; i < sf.statements.length; i++) {
        var stmt = sf.statements[i];
        // Skip declarations and imports
        if (ts.isClassDeclaration(stmt) || ts.isInterfaceDeclaration(stmt) ||
            ts.isEnumDeclaration(stmt)  || ts.isFunctionDeclaration(stmt) ||
            ts.isImportDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt) ||
            ts.isExportDeclaration(stmt)) {
          continue;
        }
        // Check for if (require.main === module) { ... }
        if (ts.isIfStatement(stmt) && this._isMainGuard(stmt, sf)) {
          var body = ts.isBlock(stmt.thenStatement)
            ? Array.from(stmt.thenStatement.statements) : [stmt.thenStatement];
          mainBlocks[fn] = (mainBlocks[fn] || []).concat(
            body.map(function (s) { return { stmt: s, sourceFile: sf }; })
          );
        } else {
          topStmts.push({ stmt: stmt, sourceFile: sf });
        }
      }
    }

    // Use the last file's main block if any
    var fns = Object.keys(mainBlocks);
    if (fns.length > 0) return mainBlocks[fns[fns.length - 1]];
    return topStmts;
  };

  SequenceDiagramGenerator.prototype._isMainGuard = function (node, sourceFile) {
    var text = _getNodeText(node.expression, sourceFile);
    return text.indexOf('require.main') !== -1 && text.indexOf('module') !== -1;
  };

  /* ── Statement dispatch ────────────────────────────────────── */

  SequenceDiagramGenerator.prototype._processStmt = function (stmt, sf, caller, depth) {
    var ts = this.ts;
    if (ts.isVariableStatement(stmt))     return this._processVarStmt(stmt, sf, caller, depth);
    if (ts.isExpressionStatement(stmt))   return this._processExprStmt(stmt, sf, caller, depth);
    if (ts.isIfStatement(stmt))           return this._processIf(stmt, sf, caller, depth);
    if (ts.isForStatement(stmt) || ts.isForOfStatement(stmt) || ts.isForInStatement(stmt))
      return this._processFor(stmt, sf, caller, depth);
    if (ts.isWhileStatement(stmt) || ts.isDoStatement(stmt))
      return this._processWhile(stmt, sf, caller, depth);
    if (ts.isTryStatement(stmt))          return this._processTry(stmt, sf, caller, depth);
    if (ts.isSwitchStatement(stmt))       return this._processSwitch(stmt, sf, caller, depth);
    if (ts.isReturnStatement(stmt) && stmt.expression)
      return this._scanExprForCalls(stmt.expression, sf, caller, depth);
    if (ts.isBlock(stmt)) {
      for (var i = 0; i < stmt.statements.length; i++)
        this._processStmt(stmt.statements[i], sf, caller, depth);
    }
  };

  /* ── Variable declarations ─────────────────────────────────── */

  SequenceDiagramGenerator.prototype._processVarStmt = function (stmt, sf, caller, depth) {
    var ts = this.ts;
    var decls = stmt.declarationList.declarations;

    for (var i = 0; i < decls.length; i++) {
      var decl = decls[i];
      if (!decl.initializer) continue;
      var varName = _getNodeText(decl.name, sf);

      // const x = new ClassName(...)
      if (ts.isNewExpression(decl.initializer)) {
        var clsName = _getNodeText(decl.initializer.expression, sf);
        if (this.allTypeNames.has(clsName)) {
          // Arguments are evaluated before the constructed object's body runs.
          for (const argument of decl.initializer.arguments || []) {
            this._scanExprForCalls(argument, sf, caller, depth);
          }
          this.varTypes[varName]    = clsName;
          this.varParticipants[varName] = varName;
          this._callerClass[varName] = clsName;
          if (this._dataClasses.has(clsName)) continue;
          this._ensureParticipant(varName, clsName);
          this.lines.push('create ' + varName);
          this.lines.push(caller + ' --> ' + varName + ': <<create>>');
          this.lines.push('activate ' + varName);
          this._maybeFollow(clsName, 'constructor', varName, depth);
          this.lines.push('deactivate ' + varName);
          continue;
        }
      }

      // Type annotation → track variable type
      if (decl.type) {
        var resolved = _extractBaseTypeName(ts, decl.type, this.allTypeNames);
        if (resolved) this.varTypes[varName] = resolved;
      }

      this._scanExprForCalls(decl.initializer, sf, caller, depth);
    }
  };

  /* ── Expression statements ─────────────────────────────────── */

  SequenceDiagramGenerator.prototype._processExprStmt = function (stmt, sf, caller, depth) {
    var ts = this.ts, expr = stmt.expression;
    // Unwrap await
    if (ts.isAwaitExpression(expr)) expr = expr.expression;
    if (ts.isCallExpression(expr)) {
      this._processCall(expr, sf, caller, depth);
    } else {
      this._scanExprForCalls(stmt.expression, sf, caller, depth);
    }
  };

  /* ── Control flow → combined fragments ─────────────────────── */

  SequenceDiagramGenerator.prototype._collectFragmentLines = function (stmts, sf, caller, depth) {
    var snapshot = this.lines.length;
    for (var i = 0; i < stmts.length; i++)
      this._processStmt(stmts[i], sf, caller, depth);
    var newLines = this.lines.slice(snapshot);
    this.lines.length = snapshot;
    return newLines;
  };

  SequenceDiagramGenerator.prototype._hasMessages = function (fl) {
    for (var i = 0; i < fl.length; i++) {
      var ln = fl[i].trim();
      if (ln && !/^(alt |else |loop |opt |end|activate |deactivate |create )/.test(ln))
        return true;
    }
    return false;
  };

  /* if / else if / else → alt/else or opt */
  SequenceDiagramGenerator.prototype._processIf = function (stmt, sf, caller, depth) {
    var ts = this.ts;
    var cond = _getNodeText(stmt.expression, sf);
    if (cond.length > 40) cond = cond.substring(0, 37) + '...';

    // Skip main-guard wrappers
    if (this._isMainGuard(stmt, sf)) {
      var body = ts.isBlock(stmt.thenStatement)
        ? Array.from(stmt.thenStatement.statements) : [stmt.thenStatement];
      for (var i = 0; i < body.length; i++) this._processStmt(body[i], sf, caller, depth);
      return;
    }

    var thenStmts = ts.isBlock(stmt.thenStatement)
      ? Array.from(stmt.thenStatement.statements) : [stmt.thenStatement];

    if (!stmt.elseStatement) {
      var bodyLines = this._collectFragmentLines(thenStmts, sf, caller, depth);
      if (this._hasMessages(bodyLines)) {
        this.lines.push('opt [' + cond + ']');
        this.lines.push.apply(this.lines, bodyLines);
        this.lines.push('end');
      } else {
        this.lines.push.apply(this.lines, bodyLines);
      }
      return;
    }

    // Multi-branch → alt / else
    var branches = [];
    branches.push({
      header: 'alt [' + cond + ']',
      lines:  this._collectFragmentLines(thenStmts, sf, caller, depth)
    });

    var elseNode = stmt.elseStatement;
    while (elseNode) {
      if (ts.isIfStatement(elseNode)) {
        var ec = _getNodeText(elseNode.expression, sf);
        if (ec.length > 40) ec = ec.substring(0, 37) + '...';
        var es = ts.isBlock(elseNode.thenStatement)
          ? Array.from(elseNode.thenStatement.statements) : [elseNode.thenStatement];
        branches.push({
          header: 'else [' + ec + ']',
          lines:  this._collectFragmentLines(es, sf, caller, depth)
        });
        elseNode = elseNode.elseStatement;
      } else {
        var elseStmts = ts.isBlock(elseNode)
          ? Array.from(elseNode.statements) : [elseNode];
        branches.push({
          header: 'else [else]',
          lines:  this._collectFragmentLines(elseStmts, sf, caller, depth)
        });
        break;
      }
    }

    var self = this;
    if (branches.some(function (b) { return self._hasMessages(b.lines); })) {
      for (var j = 0; j < branches.length; j++) {
        this.lines.push(branches[j].header);
        this.lines.push.apply(this.lines, branches[j].lines);
      }
      this.lines.push('end');
    } else {
      for (var k = 0; k < branches.length; k++)
        this.lines.push.apply(this.lines, branches[k].lines);
    }
  };

  /* for / for-of / for-in → loop fragment */
  SequenceDiagramGenerator.prototype._processFor = function (stmt, sf, caller, depth) {
    var ts = this.ts, label;

    if (ts.isForOfStatement(stmt)) {
      var varText  = _getNodeText(stmt.initializer, sf).replace(/^(const|let|var)\s+/, '');
      var iterText = _getNodeText(stmt.expression, sf);
      label = 'for ' + varText + ' of ' + iterText;
      this._inferLoopVarType(varText, stmt.expression, sf, caller);
    } else if (ts.isForInStatement(stmt)) {
      label = 'for ' + _getNodeText(stmt.initializer, sf).replace(/^(const|let|var)\s+/, '') +
              ' in ' + _getNodeText(stmt.expression, sf);
    } else {
      // C-style for
      var condText = stmt.condition ? _getNodeText(stmt.condition, sf) : '';
      label = condText ? 'for (' + condText + ')' : 'for loop';
    }

    var bodyStmts = ts.isBlock(stmt.statement)
      ? Array.from(stmt.statement.statements) : [stmt.statement];
    var bodyLines = this._collectFragmentLines(bodyStmts, sf, caller, depth);

    if (this._hasMessages(bodyLines)) {
      this.lines.push('loop [' + label + ']');
      this.lines.push.apply(this.lines, bodyLines);
      this.lines.push('end');
    } else {
      this.lines.push.apply(this.lines, bodyLines);
    }
  };

  /* while / do-while → loop fragment */
  SequenceDiagramGenerator.prototype._processWhile = function (stmt, sf, caller, depth) {
    var ts = this.ts;
    var cond = _getNodeText(stmt.expression, sf);
    if (cond.length > 40) cond = cond.substring(0, 37) + '...';

    var bodyStmts = ts.isBlock(stmt.statement)
      ? Array.from(stmt.statement.statements) : [stmt.statement];
    var bodyLines = this._collectFragmentLines(bodyStmts, sf, caller, depth);

    if (this._hasMessages(bodyLines)) {
      this.lines.push('loop [while ' + cond + ']');
      this.lines.push.apply(this.lines, bodyLines);
      this.lines.push('end');
    } else {
      this.lines.push.apply(this.lines, bodyLines);
    }
  };

  /* try/catch → alt/else fragment */
  SequenceDiagramGenerator.prototype._processTry = function (stmt, sf, caller, depth) {
    var bodyLines = this._collectFragmentLines(
      Array.from(stmt.tryBlock.statements), sf, caller, depth
    );

    var handlerBranches = [];
    if (stmt.catchClause) {
      var excType = (stmt.catchClause.variableDeclaration && stmt.catchClause.variableDeclaration.type)
        ? _getNodeText(stmt.catchClause.variableDeclaration.type, sf) : 'Error';
      handlerBranches.push({
        type:  excType,
        lines: this._collectFragmentLines(
          Array.from(stmt.catchClause.block.statements), sf, caller, depth
        )
      });
    }

    var self = this;
    var hasBody     = this._hasMessages(bodyLines);
    var hasHandlers = handlerBranches.some(function (h) { return self._hasMessages(h.lines); });

    if (hasBody || hasHandlers) {
      this.lines.push('alt [try]');
      this.lines.push.apply(this.lines, bodyLines);
      for (var i = 0; i < handlerBranches.length; i++) {
        this.lines.push('else [catch ' + handlerBranches[i].type + ']');
        this.lines.push.apply(this.lines, handlerBranches[i].lines);
      }
      this.lines.push('end');
    } else {
      this.lines.push.apply(this.lines, bodyLines);
      for (var j = 0; j < handlerBranches.length; j++)
        this.lines.push.apply(this.lines, handlerBranches[j].lines);
    }
  };

  /* switch/case → alt/else fragment */
  SequenceDiagramGenerator.prototype._processSwitch = function (stmt, sf, caller, depth) {
    var ts = this.ts;
    var branches = [];

    for (var i = 0; i < stmt.caseBlock.clauses.length; i++) {
      var clause = stmt.caseBlock.clauses[i];
      var label  = clause.kind === ts.SyntaxKind.DefaultClause
        ? 'default'
        : 'case ' + _getNodeText(clause.expression, sf);
      branches.push({
        header: (i === 0 ? 'alt' : 'else') + ' [' + label + ']',
        lines:  this._collectFragmentLines(Array.from(clause.statements), sf, caller, depth)
      });
    }

    var self = this;
    if (branches.some(function (b) { return self._hasMessages(b.lines); })) {
      for (var j = 0; j < branches.length; j++) {
        this.lines.push(branches[j].header);
        this.lines.push.apply(this.lines, branches[j].lines);
      }
      this.lines.push('end');
    }
  };

  /* ── Call processing ──────────────────────────────────────── */

  SequenceDiagramGenerator.prototype._processCall = function (call, sf, caller, depth) {
    var ts = this.ts;

    // Scan arguments first (they execute before the call)
    if (call.arguments) {
      for (var i = 0; i < call.arguments.length; i++)
        this._scanExprForCalls(call.arguments[i], sf, caller, depth);
    }

    var resolved = this._resolveCall(call, sf, caller);
    if (!resolved) return;

    var clsName = resolved.className;
    var method  = resolved.method;
    if (this._dataClasses.has(clsName)) return;

    var calleeId = resolved.participantId || this._calleeIdFor(clsName, caller, resolved.attrHint);
    var label    = this._buildCallLabel(call, sf, method);

    var isSuper = resolved.isSuper;

    if (method === 'constructor' && !isSuper) {
      this._ensureParticipant(calleeId, clsName);
      this._callerClass[calleeId] = clsName;
      this.lines.push('create ' + calleeId);
      this.lines.push(caller + ' --> ' + calleeId + ': <<create>>');
      this.lines.push('activate ' + calleeId);
      this._maybeFollow(clsName, 'constructor', calleeId, depth);
      this.lines.push('deactivate ' + calleeId);
    } else if (method === 'constructor' && isSuper) {
      this._ensureParticipant(calleeId, clsName);
      this._callerClass[calleeId] = clsName;
      this.lines.push(caller + ' -> ' + calleeId + ': ' + label);
      this.lines.push('activate ' + calleeId);
      this._maybeFollow(clsName, method, calleeId, depth);
      this.lines.push('deactivate ' + calleeId);
    } else if (calleeId === caller) {
      this.lines.push(caller + ' -> ' + caller + ': ' + label);
      this.lines.push('activate ' + caller);
      this._maybeFollow(clsName, method, calleeId, depth);
      this.lines.push('deactivate ' + caller);
    } else {
      this._ensureParticipant(calleeId, clsName);
      this._callerClass[calleeId] = clsName;
      this.lines.push(caller + ' -> ' + calleeId + ': ' + label);
      this.lines.push('activate ' + calleeId);
      this._maybeFollow(clsName, method, calleeId, depth);
      // Return/reply message (Ambler G172: only when return type is not obvious)
      var retType = this._getReturnType(clsName, method);
      if (retType) this.lines.push(calleeId + ' --> ' + caller + ': ' + retType);
      this.lines.push('deactivate ' + calleeId);
    }
  };

  SequenceDiagramGenerator.prototype._buildCallLabel = function (call, sf, method) {
    var args = [];
    if (call.arguments) {
      for (var i = 0; i < Math.min(call.arguments.length, 3); i++) {
        var text = _getNodeText(call.arguments[i], sf);
        if (text.length > 20) text = text.substring(0, 17) + '...';
        args.push(text);
      }
      if (call.arguments.length > 3) args.push('...');
    }
    return method + '(' + args.join(', ') + ')';
  };

  SequenceDiagramGenerator.prototype._getReturnType = function (clsName, methodName) {
    var node = this._findMethodNode(clsName, methodName);
    if (node && node.type) {
      var sf  = this._sourceFileForClass(clsName);
      var ret = sf ? _getNodeText(node.type, sf) : '';
      if (ret && ret !== 'void' && ret !== 'undefined') return ret;
    }
    return null;
  };

  SequenceDiagramGenerator.prototype._findMethodNode = function (clsName, methodName) {
    var visited = new Set(), current = clsName;
    while (current && !visited.has(current)) {
      visited.add(current);
      var meths = this.classMethods[current];
      if (meths && meths[methodName]) return meths[methodName];
      current = this._findParent(current);
    }
    return null;
  };

  SequenceDiagramGenerator.prototype._sourceFileForClass = function (clsName) {
    var ts = this.ts;
    for (var fn in this.parsedFiles) {
      var sf = this.parsedFiles[fn];
      for (var i = 0; i < sf.statements.length; i++) {
        var s = sf.statements[i];
        if (ts.isClassDeclaration(s) && s.name && s.name.text === clsName) return sf;
      }
    }
    var fns = Object.keys(this.parsedFiles);
    return fns.length ? this.parsedFiles[fns[0]] : null;
  };

  /* ── Call resolution ──────────────────────────────────────── */

  SequenceDiagramGenerator.prototype._resolveCall = function (call, sf, caller) {
    var ts = this.ts, func = call.expression;

    // new ClassName(...)  — handled when the outer node is NewExpression
    // (reached via _scanExprForCalls)

    // ClassName(...)  — direct class call
    if (ts.isIdentifier(func) && this.allTypeNames.has(func.text)) {
      return { className: func.text, method: 'constructor' };
    }

    // The compiler represents `this` as a keyword, not an Identifier.
    if (ts.isPropertyAccessExpression(func) &&
        func.expression.kind === ts.SyntaxKind.ThisKeyword) {
      const currentClass = this._classOf(caller);
      if (currentClass) {
        return { className: currentClass, method: func.name.text, participantId: caller };
      }
      return null;
    }

    // var.method()
    if (ts.isPropertyAccessExpression(func) && ts.isIdentifier(func.expression)) {
      var varName = func.expression.text;
      var method  = func.name.text;

      if (this.varTypes[varName]) {
        // A known receiver identifies an object, not just its class. Keep a
        // type-only fallback for parameters whose instance binding is unknown.
        return { className: this.varTypes[varName], method: method,
          participantId: this.varParticipants[varName] || this._syntheticReceiverId(this.varTypes[varName], caller, varName, 'variable') };
      } else if (this.allTypeNames.has(varName)) {
        return { className: varName, method: method };  // static call
      }
      return null;
    }

    // this.attr.method()
    if (ts.isPropertyAccessExpression(func) &&
        ts.isPropertyAccessExpression(func.expression) &&
        func.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
      var attr   = func.expression.name.text;
      var method = func.name.text;
      var cc     = this._classOf(caller);
      if (cc && this.attrTypes[cc] && this.attrTypes[cc][attr]) {
        var targetCls  = this.attrTypes[cc][attr];
        var targetMeth = this.classMethods[targetCls];
        if (targetMeth && targetMeth[method]) {
          return { className: targetCls, method: method, attrHint: attr };
        }
      }
      return null;
    }

    // super.method()
    if (ts.isPropertyAccessExpression(func) &&
        func.expression.kind === ts.SyntaxKind.SuperKeyword) {
      var method = func.name.text;
      var cc     = this._classOf(caller);
      if (cc) {
        var parent = this._findParent(cc);
        if (parent) return { className: parent, method: method, isSuper: true };
      }
      return null;
    }

    return null;
  };

  /* ── Scan nested calls in arbitrary expressions ────────────── */

  SequenceDiagramGenerator.prototype._scanExprForCalls = function (node, sf, caller, depth) {
    if (!node) return;
    var ts = this.ts;

    if (ts.isCallExpression(node)) {
      this._processCall(node, sf, caller, depth);
      return;
    }
    if (ts.isNewExpression(node)) {
      for (const argument of node.arguments || []) {
        this._scanExprForCalls(argument, sf, caller, depth);
      }
      var clsName = _getNodeText(node.expression, sf);
      if (this.allTypeNames.has(clsName) && !this._dataClasses.has(clsName)) {
        // Treat as constructor call — resolve manually since _resolveCall
        // expects a CallExpression
        var calleeId = this._calleeIdFor(clsName, caller, null);
        this._ensureParticipant(calleeId, clsName);
        this._callerClass[calleeId] = clsName;
        this.lines.push('create ' + calleeId);
        this.lines.push(caller + ' --> ' + calleeId + ': <<create>>');
        this.lines.push('activate ' + calleeId);
        this._maybeFollow(clsName, 'constructor', calleeId, depth);
        this.lines.push('deactivate ' + calleeId);
      }
      return;
    }
    if (ts.isAwaitExpression(node)) {
      this._scanExprForCalls(node.expression, sf, caller, depth);
      return;
    }

    var self = this;
    ts.forEachChild(node, function (child) {
      self._scanExprForCalls(child, sf, caller, depth);
    });
  };

  /* ── Loop variable type inference ──────────────────────────── */

  SequenceDiagramGenerator.prototype._inferLoopVarType = function (varName, iterExpr, sf, caller) {
    var ts = this.ts;

    // for (x of this.items) — check attribute type from class info
    if (ts.isPropertyAccessExpression(iterExpr) &&
        iterExpr.expression.kind === ts.SyntaxKind.ThisKeyword) {
      var attr = iterExpr.name.text;
      var cc   = this._classOf(caller);
      if (cc && this.attrTypes[cc] && this.attrTypes[cc][attr]) {
        this.varTypes[varName] = this.attrTypes[cc][attr];
        return;
      }
    }

    // for (x of localVar) — check local variable element type
    if (ts.isIdentifier(iterExpr) && this.varTypes[iterExpr.text]) {
      this.varTypes[varName] = this.varTypes[iterExpr.text];
    }
  };

  /* ── Method following ──────────────────────────────────────── */

  SequenceDiagramGenerator.prototype._maybeFollow = function (clsName, methodName, calleeId, depth) {
    if (depth >= SEQ_MAX_DEPTH) return;

    var key = clsName + '::' + methodName;
    if (this._callStack.has(key)) return;

    var node = this._findMethodNode(clsName, methodName);
    if (!node || !node.body) return;

    // Abstract/stub method → try concrete override in subclass
    if (this._isStubMethod(node)) {
      var concrete = this._findConcreteOverride(clsName, methodName);
      if (concrete) {
        clsName = concrete.className;
        node    = concrete.node;
        key     = clsName + '::' + methodName;
        if (this._callStack.has(key)) return;
      } else {
        return;
      }
    }

    this._callStack.add(key);
    var savedVarTypes = {};
    for (var v in this.varTypes) savedVarTypes[v] = this.varTypes[v];
    const savedVarParticipants = this.varParticipants;

    // Seed local scope with parameter type hints
    this.varTypes = {};
    this.varParticipants = Object.create(null);
    var pt = (this.paramTypes[clsName] || {})[methodName];
    if (pt) { for (var p in pt) this.varTypes[p] = pt[p]; }

    var sf    = this._sourceFileForClass(clsName);
    var stmts = node.body.statements || [];
    for (var i = 0; i < stmts.length; i++) {
      this._processStmt(stmts[i], sf, calleeId, depth + 1);
    }

    this.varTypes = savedVarTypes;
    this.varParticipants = savedVarParticipants;
    this._callStack.delete(key);
  };

  SequenceDiagramGenerator.prototype._isStubMethod = function (node) {
    var ts = this.ts;
    if (!node.body) return true;
    var stmts = node.body.statements;
    if (!stmts || stmts.length === 0) return true;
    if (stmts.length === 1) {
      var s = stmts[0];
      if (ts.isThrowStatement(s)) return true;
      if (ts.isReturnStatement(s) && (!s.expression ||
          s.expression.kind === ts.SyntaxKind.UndefinedKeyword ||
          ts.isLiteralExpression(s.expression))) return true;
    }
    return false;
  };

  SequenceDiagramGenerator.prototype._findConcreteOverride = function (clsName, methodName) {
    for (var cname in this.classBases) {
      if (this.classBases[cname].indexOf(clsName) !== -1 && this.classMethods[cname]) {
        var node = this.classMethods[cname][methodName];
        if (node && !this._isStubMethod(node)) {
          return { className: cname, node: node };
        }
      }
    }
    return null;
  };

  /* ── Hierarchy helpers ─────────────────────────────────────── */

  SequenceDiagramGenerator.prototype._findParent = function (clsName) {
    var bases = this.classBases[clsName] || [];
    for (var i = 0; i < bases.length; i++) {
      if (this.classMethods[bases[i]]) return bases[i];
    }
    return null;
  };

  /* ── Participant helpers ───────────────────────────────────── */

  SequenceDiagramGenerator.prototype._ensureParticipant = function (id, label) {
    this._reservedParticipantIds.add(id);
    if (!this._participantSet.has(id)) {
      this._participantSet.add(id);
      this.participants.push({ id: id, label: label });
    }
  };

  // A type-only reference has its own symbolic identity. Reserve source names
  // up front so later declarations cannot accidentally take that lifeline.
  SequenceDiagramGenerator.prototype._syntheticReceiverId = function (type, owner, role, kind) {
    const key = JSON.stringify([owner, kind, role, type]);
    if (this._syntheticReceiverIds.has(key)) return this._syntheticReceiverIds.get(key);
    const base = owner + '_' + role;
    let id = base;
    for (let suffix = 2; this._reservedParticipantIds.has(id); suffix++) id = base + '_' + suffix;
    this._reservedParticipantIds.add(id);
    this._syntheticReceiverIds.set(key, id);
    return id;
  };

  SequenceDiagramGenerator.prototype._calleeIdFor = function (clsName, caller, attrHint) {
    // A matching class does not prove that two references denote the same object.
    return attrHint ? this._syntheticReceiverId(clsName, caller, attrHint, 'field') : clsName;
  };

  SequenceDiagramGenerator.prototype._classOf = function (pid) {
    if (this._callerClass[pid]) return this._callerClass[pid];
    if (this.allTypeNames.has(pid)) return pid;
    return null;
  };

  /* ===================================================================
   * Export
   * =================================================================== */

  global.analyzeJSSources = analyzeJSSources;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
