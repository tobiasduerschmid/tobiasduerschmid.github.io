/**
 * JS/TS UML Analyzer — extracts class diagrams and sequence diagrams from
 * JavaScript/TypeScript source code.
 *
 * Parallel to uml-analyzer.py (which handles Python). Requires the TypeScript
 * compiler API (window.ts or passed as parameter) for AST parsing.
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
  function _extractBaseTypeName(ts, typeNode, allTypeNames) {
    if (!typeNode) return null;

    // Direct type reference: Task
    if (ts.isTypeReferenceNode(typeNode)) {
      var name = typeNode.typeName.text ||
                 (typeNode.typeName.right && typeNode.typeName.right.text) || '';
      if (name && allTypeNames.has(name)) return name;
      // Generic: Array<Task>, Set<Task>, Promise<Task>
      if (CONTAINER_TYPES.has(name) && typeNode.typeArguments && typeNode.typeArguments.length > 0) {
        var idx = MAPPING_TYPES.has(name) ? typeNode.typeArguments.length - 1 : 0;
        return _extractBaseTypeName(ts, typeNode.typeArguments[idx], allTypeNames);
      }
      return null;
    }

    // Array shorthand: Task[]
    if (ts.isArrayTypeNode(typeNode)) {
      return _extractBaseTypeName(ts, typeNode.elementType, allTypeNames);
    }

    // Union type: Task | null → Task
    if (ts.isUnionTypeNode(typeNode)) {
      for (var i = 0; i < typeNode.types.length; i++) {
        var inner = _extractBaseTypeName(ts, typeNode.types[i], allTypeNames);
        if (inner) return inner;
      }
    }

    return null;
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
   * ClassInfo — mirrors uml-analyzer.py ClassInfo
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
    this.compositions = [];  // [className] — created internally  (strong ownership)
    this.aggregations = [];  // [className] — injected from outside (weak ownership)
    this.associations = [];  // [className] — reference without ownership semantics
    this.dependencies = [];  // [className] — transient usage (params/returns)
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
        info.attributes.push({ name: pName, type: pType, visibility: _getVisibility(ts, param) });
      }

      var resolved = _extractBaseTypeName(ts, param.type, this.allTypeNames);
      if (resolved) {
        initParamTypes[pName] = resolved;
        mParams[pName] = resolved;
        // TS parameter property with known class type → aggregation
        if (isProperty) {
          _addUnique(info.aggregations, resolved);
          info._relAttrs.add(pName);
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
          _addUnique(info.compositions, typeName);
          info._relAttrs.add(attrName);
          aTypes[attrName] = typeName;
          return;
        }
      }

      // this.x = param → aggregation if param is a typed constructor arg
      if (ts.isIdentifier(right)) {
        var paramCls = initParamTypes[right.text];
        if (paramCls) {
          _addUnique(info.aggregations, paramCls);
          info._relAttrs.add(attrName);
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
      name: name, type: type, visibility: vis, isStatic: isStatic, isAbstract: isAbstract
    });

    // Property initializer: x = new ClassName() → composition
    if (member.initializer && ts.isNewExpression(member.initializer)) {
      var initType = _getNodeText(member.initializer.expression, sourceFile);
      if (this.allTypeNames.has(initType)) {
        _addUnique(info.compositions, initType);
        info._relAttrs.add(name);
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
        info.attributes.push({ name: propName, type: propType, visibility: '+' });
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
    info.compositions.forEach(function (c) { structural.add(c); });
    info.aggregations.forEach(function (a) { structural.add(a); });

    // Remaining typed attributes → association
    for (var i = 0; i < info.attributes.length; i++) {
      var attr = info.attributes[i];
      var resolved = this._resolveTypeStr(attr.type);
      if (resolved && resolved !== info.name &&
          !structural.has(resolved) && !info._relAttrs.has(attr.name)) {
        _addUnique(info.associations, resolved);
        info._relAttrs.add(attr.name);
        structural.add(resolved);
      }
    }

    // Method param/return types → dependency
    for (var m = 0; m < info.methods.length; m++) {
      var method = info.methods[m];
      var retResolved = this._resolveTypeStr(method.returnType);
      if (retResolved && retResolved !== info.name && !structural.has(retResolved)) {
        _addUnique(info.dependencies, retResolved);
        structural.add(retResolved);
      }
      for (var p = 0; p < method.params.length; p++) {
        var paramResolved = this._resolveTypeStr(method.params[p].type);
        if (paramResolved && paramResolved !== info.name && !structural.has(paramResolved)) {
          _addUnique(info.dependencies, paramResolved);
          structural.add(paramResolved);
        }
      }
    }
  };

  /** Resolve a type string to a known class name (string-level fallback). */
  ClassExtractor.prototype._resolveTypeStr = function (typeStr) {
    if (!typeStr) return null;
    if (this.allTypeNames.has(typeStr)) return typeStr;
    // Task[]
    var arrMatch = typeStr.match(/^(\w+)\[\]$/);
    if (arrMatch && this.allTypeNames.has(arrMatch[1])) return arrMatch[1];
    // Array<Task>, Set<Task>, etc.
    var genMatch = typeStr.match(/^\w+<(?:[\w,\s]+,\s*)?(\w+)>$/);
    if (genMatch && this.allTypeNames.has(genMatch[1])) return genMatch[1];
    // Task | null
    var parts = typeStr.split(/\s*\|\s*/);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p !== 'null' && p !== 'undefined' && this.allTypeNames.has(p)) return p;
    }
    return null;
  };

  /* ===================================================================
   * Generate PlantUML class diagram
   * =================================================================== */

  ClassExtractor.prototype.generatePlantUML = function () {
    if (this.classMap.size === 0) return '';

    var lines = ['@startuml'];
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
      // Composition (*--)
      for (var c = 0; c < cls.compositions.length; c++) {
        lines.push(cls.name + ' *-- ' + cls.compositions[c]);
      }
      // Aggregation (o--)
      for (var ag = 0; ag < cls.aggregations.length; ag++) {
        lines.push(cls.name + ' o-- ' + cls.aggregations[ag]);
      }
      // Association (-->)
      for (var as = 0; as < cls.associations.length; as++) {
        lines.push(cls.name + ' --> ' + cls.associations[as]);
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
    this.lines           = [];

    // Scope
    this.varTypes     = {};           // {varName: className}
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

    for (var i = 0; i < entry.length; i++) {
      this._processStmt(entry[i].stmt, entry[i].sourceFile, 'Main', 0);
    }
  };

  SequenceDiagramGenerator.prototype.generatePlantUML = function () {
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
          this.varTypes[varName]    = clsName;
          this._callerClass[varName] = clsName;
          if (this._dataClasses.has(clsName)) continue;
          this._ensureParticipant(varName, clsName);
          this.lines.push('create ' + varName);
          this.lines.push(caller + ' --> ' + varName + ': <<create>>');
          this._maybeFollow(clsName, 'constructor', varName, depth);
          // Scan constructor args
          if (decl.initializer.arguments) {
            for (var a = 0; a < decl.initializer.arguments.length; a++)
              this._scanExprForCalls(decl.initializer.arguments[a], sf, caller, depth);
          }
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

    var calleeId = this._calleeIdFor(clsName, caller, resolved.attrHint);
    var label    = this._buildCallLabel(call, sf, method);

    var isSuper = resolved.isSuper;

    if (method === 'constructor' && !isSuper) {
      this._ensureParticipant(calleeId, clsName);
      this._callerClass[calleeId] = clsName;
      this.lines.push('create ' + calleeId);
      this.lines.push(caller + ' --> ' + calleeId + ': <<create>>');
      this._maybeFollow(clsName, 'constructor', calleeId, depth);
    } else if (method === 'constructor' && isSuper) {
      this._ensureParticipant(calleeId, clsName);
      this._callerClass[calleeId] = clsName;
      this.lines.push(caller + ' -> ' + calleeId + ': ' + label);
      this._maybeFollow(clsName, method, calleeId, depth);
    } else if (calleeId === caller) {
      this.lines.push(caller + ' -> ' + caller + ': ' + label);
      this._maybeFollow(clsName, method, calleeId, depth);
    } else {
      this._ensureParticipant(calleeId, clsName);
      this._callerClass[calleeId] = clsName;
      this.lines.push(caller + ' -> ' + calleeId + ': ' + label);
      this._maybeFollow(clsName, method, calleeId, depth);
      // Return/reply message (Ambler G172: only when return type is not obvious)
      var retType = this._getReturnType(clsName, method);
      if (retType) this.lines.push(calleeId + ' --> ' + caller + ': ' + retType);
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

    // var.method()
    if (ts.isPropertyAccessExpression(func) && ts.isIdentifier(func.expression)) {
      var varName = func.expression.text;
      var method  = func.name.text;

      if (varName === 'this') {
        var cc = this._classOf(caller);
        if (cc) return { className: cc, method: method };
      } else if (this.varTypes[varName]) {
        return { className: this.varTypes[varName], method: method };
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
      var clsName = _getNodeText(node.expression, sf);
      if (this.allTypeNames.has(clsName) && !this._dataClasses.has(clsName)) {
        // Treat as constructor call — resolve manually since _resolveCall
        // expects a CallExpression
        var calleeId = this._calleeIdFor(clsName, caller, null);
        this._ensureParticipant(calleeId, clsName);
        this._callerClass[calleeId] = clsName;
        this.lines.push('create ' + calleeId);
        this.lines.push(caller + ' --> ' + calleeId + ': <<create>>');
        this._maybeFollow(clsName, 'constructor', calleeId, depth);
      }
      // Scan constructor arguments
      if (node.arguments) {
        for (var i = 0; i < node.arguments.length; i++)
          this._scanExprForCalls(node.arguments[i], sf, caller, depth);
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

    // Seed local scope with parameter type hints
    this.varTypes = {};
    var pt = (this.paramTypes[clsName] || {})[methodName];
    if (pt) { for (var p in pt) this.varTypes[p] = pt[p]; }

    var sf    = this._sourceFileForClass(clsName);
    var stmts = node.body.statements || [];
    for (var i = 0; i < stmts.length; i++) {
      this._processStmt(stmts[i], sf, calleeId, depth + 1);
    }

    this.varTypes = savedVarTypes;
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
    if (!this._participantSet.has(id)) {
      this._participantSet.add(id);
      this.participants.push({ id: id, label: label });
    }
  };

  SequenceDiagramGenerator.prototype._calleeIdFor = function (clsName, caller, attrHint) {
    // Reuse existing participant of same class
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

  SequenceDiagramGenerator.prototype._classOf = function (pid) {
    if (this._callerClass[pid]) return this._callerClass[pid];
    if (this.allTypeNames.has(pid)) return pid;
    return null;
  };

  /* ===================================================================
   * Export
   * =================================================================== */

  global.analyzeJSSources = analyzeJSSources;

})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
