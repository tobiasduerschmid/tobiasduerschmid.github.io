/**
 * C++ source-to-UML inference, following the Java analyzer's small-parser
 * approach: tokenize, collect declarations, infer relationships, walk main().
 * This is a source sketch, not a compiler or a runtime trace. No code executes.
 * Supports supplied C++ headers/translation units without expanding includes,
 * macros or template specializations. Sequence expansion is bounded to 3 calls.
 */
(function (global) {
  'use strict';
  const SequenceDiagnostics = typeof module !== 'undefined' && module.exports
    ? require('./uml-sequence-diagnostics.js') : global.UMLSequenceDiagnostics;

  const identifier = value => /^[A-Za-z_]\w*$/.test(value || '');
  const access = new Set(['public', 'protected', 'private']);
  const modifiers = new Set(['static', 'virtual', 'inline', 'explicit', 'constexpr', 'consteval', 'constinit', 'friend', 'extern', 'mutable']);
  const qualifiers = new Set(['const', 'volatile', 'typename', 'class', 'struct', 'enum']);
  const primitives = new Set(['void', 'bool', 'char', 'wchar_t', 'char16_t', 'char32_t', 'short', 'int', 'long', 'signed', 'unsigned', 'float', 'double', 'auto', 'size_t']);
  const pairs = { '(': ')', '[': ']', '{': '}', '<': '>' };
  const qualified = (scope, name) => scope ? scope + '::' + name : name;
  const shortName = name => name.split('::').pop();
  const diagramId = name => name.replace(/::/g, '__').replace(/[^\w]/g, '_');

  function uniqueDiagramId(name, allocated) {
    const base = diagramId(name);
    let id = base, suffix = 2;
    while (allocated.has(id)) id = base + '_' + suffix++;
    allocated.add(id);
    return id;
  }

  function tokensToText(tokens) {
    return tokens.join(' ').replace(/\s*::\s*/g, '::').replace(/\s*([<>,*&\[\]])\s*/g, '$1')
      .replace(/,/g, ', ').replace(/\s*(->|\.)\s*/g, '$1').replace(/\s+\(/g, '(')
      .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+/g, ' ').trim();
  }

  function closing(tokens, start) {
    const open = tokens[start], close = pairs[open];
    let depth = 1;
    for (let i = start + 1; i < tokens.length; i++) {
      if (tokens[i] === open) depth++;
      if (tokens[i] === close && --depth === 0) return i;
    }
    throw new Error('Unclosed ' + open);
  }

  function split(tokens, separator = ',', angles = true) {
    const parts = [], stack = [];
    let start = 0;
    tokens.forEach((token, i) => {
      if (!stack.length && token === separator) { parts.push(tokens.slice(start, i)); start = i + 1; }
      else if (pairs[token] && (token !== '<' || angles)) stack.push(pairs[token]);
      else if (token === stack[stack.length - 1]) stack.pop();
    });
    parts.push(tokens.slice(start));
    return parts;
  }

  function tokenize(source) {
    const tokens = [];
    let i = 0;
    while (i < source.length) {
      const rest = source.slice(i);
      if (/^\s/.test(rest)) { i++; continue; }
      if (rest.startsWith('//') || rest.startsWith('#')) {
        const directive = rest.startsWith('#');
        do {
          const end = source.indexOf('\n', i);
          if (end < 0) { i = source.length; break; }
          const continued = directive && source[end - 1] === '\\';
          i = end + 1;
          if (!continued) break;
        } while (i < source.length);
        continue;
      }
      if (rest.startsWith('/*')) {
        const end = source.indexOf('*/', i + 2);
        if (end < 0) throw new Error('Unclosed block comment');
        i = end + 2; continue;
      }
      const raw = rest.match(/^(?:u8|u|U|L)?R"([^\s()\\]{0,16})\(/);
      if (raw) {
        const ending = ')' + raw[1] + '"', end = source.indexOf(ending, i + raw[0].length);
        if (end < 0) throw new Error('Unclosed raw string');
        tokens.push(source.slice(i, end + ending.length)); i = end + ending.length; continue;
      }
      const literal = rest.match(/^(?:u8|u|U|L)?(["'])/);
      if (literal) {
        const start = i, quote = literal[1];
        i += literal[0].length;
        while (i < source.length && source[i] !== quote) { if (source[i] === '\\') i++; i++; }
        if (i >= source.length) throw new Error('Unclosed string or character literal');
        tokens.push(source.slice(start, ++i)); continue;
      }
      const word = rest.match(/^[A-Za-z_]\w*|^(?:0[xX][\da-fA-F']+|\d[\d']*(?:\.\d*)?(?:[eE][+-]?\d+)?)[uUlLfF]*|^(?:::|->\*|->|&&|\|\||==|!=|<=|>=|\+\+|--|\+=|-=|\*=|\/=|\.\.\.)/);
      const token = word ? word[0] : source[i];
      tokens.push(token); i += token.length;
    }
    const stack = [];
    for (const token of tokens) {
      if ('([{'.includes(token) && token.length === 1) stack.push(token);
      else if (')]}'.includes(token) && token.length === 1 && pairs[stack.pop()] !== token) throw new Error('Unexpected ' + token);
    }
    if (stack.length) throw new Error('Unclosed ' + stack.pop());
    return tokens;
  }

  // Read a type independently from its declarator: const ns::Type<T>* name.
  function typeEnd(tokens, start = 0, tentative = false) {
    let i = start;
    while (qualifiers.has(tokens[i]) || modifiers.has(tokens[i])) i++;
    if (tokens[i] === '::') i++;
    if (!identifier(tokens[i])) return start;
    const primitive = primitives.has(tokens[i]);
    i++;
    if (primitive) while (primitives.has(tokens[i]) && tokens[i] !== 'auto') i++;
    while (i < tokens.length) {
      if (tokens[i] === '<') {
        // In an expression, `<` may be comparison rather than a template.
        try { i = closing(tokens, i) + 1; }
        catch (error) { if (tentative) return start; throw error; }
      }
      else if (tokens[i] === '::' && identifier(tokens[i + 1])) i += 2;
      else break;
    }
    while (['*', '&', '&&', 'const', 'volatile'].includes(tokens[i])) i++;
    return i;
  }

  function parameter(tokens, index) {
    const declaration = split(tokens, '=')[0];
    const end = typeEnd(declaration);
    const name = identifier(declaration[end]) ? declaration[end] : 'arg' + (index + 1);
    return { name, type: declaration.slice(0, end).concat(declaration.slice(end + 1)), optional: tokens.includes('=') };
  }

  function parameters(tokens) {
    if (!tokens.length || (tokens.length === 1 && tokens[0] === 'void')) return [];
    return split(tokens).map(parameter);
  }

  function fieldDeclarations(tokens, visibility) {
    const declarations = split(tokens);
    const end = typeEnd(declarations[0]);
    const firstType = declarations[0].slice(0, end);
    const base = firstType.slice();
    while (['*', '&', '&&', 'const'].includes(base[base.length - 1])) base.pop();
    return declarations.flatMap((part, index) => {
      let nameAt = index === 0 ? end : 0;
      while (['*', '&', '&&'].includes(part[nameAt])) nameAt++;
      if (!identifier(part[nameAt])) return [];
      const type = index === 0 ? firstType : base.concat(part.slice(0, nameAt));
      if (part[nameAt + 1] === '[') type.push(...part.slice(nameAt + 1, closing(part, nameAt + 1) + 1));
      return [{ name: part[nameAt], type, visibility, static: tokens.includes('static') }];
    });
  }

  class CppParser {
    constructor() { this.classes = new Map(); this.functions = []; this.aliases = new Map(); }

    parse(tokens, scope = '', owner = null) {
      let i = 0, visibility = owner && owner.kind === 'class' ? '-' : '+';
      while (i < tokens.length) {
        const start = i;
        if (access.has(tokens[i]) && tokens[i + 1] === ':') {
          visibility = { public: '+', protected: '#', private: '-' }[tokens[i]]; i += 2;
        } else if (tokens[i] === 'template' && tokens[i + 1] === '<') i = closing(tokens, i + 1) + 1;
        else if (tokens[i] === ';') i++;
        else if (tokens[i] === 'namespace' || (tokens[i] === 'inline' && tokens[i + 1] === 'namespace')) {
          const nameAt = tokens[i] === 'inline' ? i + 2 : i + 1;
          let end = nameAt;
          while (end < tokens.length && !['{', ';', '='].includes(tokens[end])) end++;
          if (tokens[end] === '{') {
            const close = closing(tokens, end), name = tokens.slice(nameAt, end).join('');
            this.parse(tokens.slice(end + 1, close), qualified(scope, name || 'anonymous'));
            i = close + 1;
          } else i = this.semicolon(tokens, end) + 1;
        } else if (['class', 'struct', 'enum'].includes(tokens[i])) {
          i = this.typeDeclaration(tokens, i, scope);
        } else if (tokens[i] === 'using' || tokens[i] === 'typedef') {
          i = this.alias(tokens, i, scope);
        } else i = this.declaration(tokens, i, scope, owner, visibility);
        if (i <= start) i = start + 1;
      }
    }

    semicolon(tokens, start) {
      let i = start;
      while (i < tokens.length && tokens[i] !== ';') {
        if (['(', '[', '{'].includes(tokens[i])) i = closing(tokens, i);
        i++;
      }
      return i;
    }

    alias(tokens, start, scope) {
      const end = this.semicolon(tokens, start), part = tokens.slice(start, end);
      if (part[0] === 'using' && part[2] === '=') this.aliases.set(qualified(scope, part[1]), { type: part.slice(3), scope });
      if (part[0] === 'typedef' && identifier(part[part.length - 1])) this.aliases.set(qualified(scope, part[part.length - 1]), { type: part.slice(1, -1), scope });
      return end + 1;
    }

    typeDeclaration(tokens, start, scope) {
      const kind = tokens[start];
      let nameAt = start + 1;
      if (kind === 'enum' && ['class', 'struct'].includes(tokens[nameAt])) nameAt++;
      if (!identifier(tokens[nameAt])) return start + 1;
      const name = qualified(scope, tokens[nameAt]);
      let body = nameAt + 1;
      while (body < tokens.length && !['{', ';'].includes(tokens[body])) body++;
      const previous = this.classes.get(name);
      if (tokens[body] !== '{') {
        if (!previous) this.classes.set(name, { name, scope, kind, fields: [], methods: [], bases: [], constants: [] });
        return body + 1;
      }
      const end = closing(tokens, body);
      const node = { name, scope, kind, fields: [], methods: [], bases: [], constants: [] };
      if (kind === 'enum') node.constants = split(tokens.slice(body + 1, end)).map(part => part[0]).filter(identifier);
      else {
        const colon = tokens.slice(nameAt + 1, body).indexOf(':');
        if (colon >= 0) node.bases = split(tokens.slice(nameAt + 2 + colon, body)).map(part => part.filter(token => !access.has(token) && token !== 'virtual'));
        this.parse(tokens.slice(body + 1, end), name, node);
      }
      this.classes.set(name, node);
      return end + 1;
    }

    declaration(tokens, start, scope, owner, visibility) {
      let i = start;
      while (i < tokens.length && tokens[i] !== ';') {
        if (tokens[i] === '<' && tokens[i - 1] !== 'operator') { i = closing(tokens, i) + 1; continue; }
        if (tokens[i] === '=' || tokens[i] === '{') break;
        if (tokens[i] === '(') {
          if (identifier(tokens[i - 1]) && !['decltype', 'alignas', 'noexcept'].includes(tokens[i - 1])) {
            return this.method(tokens, start, i, scope, owner, visibility);
          }
          i = closing(tokens, i);
        }
        i++;
      }
      const end = this.semicolon(tokens, i);
      if (owner) owner.fields.push(...fieldDeclarations(tokens.slice(start, end), visibility));
      return end + 1;
    }

    method(tokens, start, open, scope, owner, visibility) {
      let nameAt = open - 1;
      if (tokens[nameAt - 1] === '~') nameAt--;
      while (nameAt >= start + 2 && tokens[nameAt - 1] === '::' && identifier(tokens[nameAt - 2])) nameAt -= 2;
      const fullName = tokens.slice(nameAt, open).join('');
      const name = shortName(fullName), explicitOwner = fullName.includes('::') ? fullName.slice(0, fullName.lastIndexOf('::')) : '';
      const ownerName = owner ? owner.name : explicitOwner ? qualified(scope, explicitOwner) : null;
      const close = closing(tokens, open);
      const node = { name, scope, owner: ownerName, visibility,
        params: parameters(tokens.slice(open + 1, close)), body: null, initializers: [],
        returnType: tokens.slice(start, nameAt).filter(token => !modifiers.has(token)),
        static: tokens.slice(start, nameAt).includes('static'), abstract: false };
      node.constructor = !!ownerName && name === shortName(ownerName);
      node.destructor = !!ownerName && name === '~' + shortName(ownerName);
      let i = close + 1;
      while (i < tokens.length && !['{', ';', ':'].includes(tokens[i])) {
        if (tokens[i] === '=' && tokens[i + 1] === '0') node.abstract = true;
        if (tokens[i] === '->') {
          const end = typeEnd(tokens, i + 1); node.returnType = tokens.slice(i + 1, end); i = end; continue;
        }
        if (tokens[i] === '(') i = closing(tokens, i);
        i++;
      }
      if (tokens[i] === ':') {
        i++;
        while (i < tokens.length && tokens[i] !== '{') {
          const fieldAt = i;
          while (i < tokens.length && !['(', '{', ';'].includes(tokens[i])) i++;
          if (!['(', '{'].includes(tokens[i])) break;
          const end = closing(tokens, i);
          node.initializers.push({ name: tokens.slice(fieldAt, i).join(''), args: tokens.slice(i + 1, end) });
          i = end + 1;
          if (tokens[i] !== ',') break;
          i++;
        }
      }
      if (tokens[i] === '{') { const end = closing(tokens, i); node.body = tokens.slice(i + 1, end); i = end + 1; }
      else if (tokens[i] === ';') i++;
      if (owner) owner.methods.push(node);
      else this.functions.push(node);
      return i;
    }
  }

  const containers = new Set(['vector', 'list', 'deque', 'set', 'multiset', 'unordered_set', 'unordered_multiset', 'map', 'multimap', 'unordered_map', 'unordered_multimap', 'array', 'span', 'forward_list']);

  class CppModel {
    constructor(parser) {
      this.classes = parser.classes; this.aliases = parser.aliases;
      this.functions = []; this.freeFunctions = new Map();
      const classIds = new Set();
      this.classes.forEach(node => { node.id = uniqueDiagramId(node.name, classIds); });
      for (const fn of parser.functions) {
        const owner = fn.owner && this.resolve(fn.owner, fn.scope);
        // A qualified definition can belong to a namespace as well as a class.
        const definition = !owner && fn.owner ? { ...fn, scope: fn.owner, owner: null } : fn;
        this.mergeFunction(owner ? owner.methods : this.functions, definition);
      }
      for (const fn of this.functions) {
        const name = qualified(fn.scope, fn.name);
        if (!this.freeFunctions.has(name)) this.freeFunctions.set(name, []);
        this.freeFunctions.get(name).push(fn);
      }
    }

    signature(method) { return method.name + '(' + method.params.map(param => tokensToText(param.type)).join(',') + ')'; }

    mergeFunction(functions, definition) {
      const declaration = functions.find(fn => (fn.owner || fn.scope) === (definition.owner || definition.scope)
        && this.signature(fn) === this.signature(definition));
      if (!declaration) { functions.push(definition); return; }
      const params = definition.body ? definition.params : declaration.params;
      declaration.params = params.map((param, index) => ({ ...param,
        optional: declaration.params[index].optional || definition.params[index].optional }));
      if (definition.body) {
        declaration.body = definition.body;
        declaration.initializers = definition.initializers;
      }
    }

    callable(functions, count) {
      const candidates = functions.filter(fn => count <= fn.params.length && count >= fn.params.filter(param => !param.optional).length);
      if (candidates.length < 2) return candidates[0] || null;
      const first = candidates[0];
      // Without overload resolution, neither a body nor a differing return
      // type can be selected safely from candidates with the same arity.
      return { ...first, body: null, ambiguous: true,
        returnType: candidates.every(fn => tokensToText(fn.returnType) === tokensToText(first.returnType)) ? first.returnType : [] };
    }

    lookup(map, name, scope) {
      if (name.startsWith('::')) return map.get(name.slice(2));
      let prefix = scope;
      while (prefix) {
        if (map.has(qualified(prefix, name))) return map.get(qualified(prefix, name));
        prefix = prefix.includes('::') ? prefix.slice(0, prefix.lastIndexOf('::')) : '';
      }
      return map.get(name);
    }

    resolve(name, scope) { return this.lookup(this.classes, name, scope); }

    type(tokens, scope, seen = new Set()) {
      const clean = tokens.filter(token => !qualifiers.has(token) && !modifiers.has(token));
      const end = clean.findIndex(token => ['<', '*', '&', '&&', '['].includes(token));
      const name = clean.slice(0, end < 0 ? clean.length : end).join('');
      const alias = this.lookup(this.aliases, name, scope);
      // Unqualified names inside an alias belong to its declaration scope,
      // even when a use site declares another class with the same short name.
      if (alias && !seen.has(alias)) return this.type(alias.type.concat(clean.slice(end < 0 ? clean.length : end)), alias.scope, new Set([...seen, alias]));
      const pointer = clean.includes('*'), reference = clean.includes('&') || clean.includes('&&');
      let info = { node: this.resolve(name, scope), arrow: pointer || reference ? '-->' : '*--', multiplicity: pointer ? '0..1' : '1', collection: false, reference: pointer || reference };
      const base = shortName(name);
      const standardType = !info.node && (!name.includes('::') || name.replace(/^::/, '').startsWith('std::'));
      if (standardType && clean[end] === '<' && (containers.has(base) || ['unique_ptr', 'shared_ptr', 'weak_ptr', 'optional', 'reference_wrapper'].includes(base))) {
        const genericEnd = closing(clean, end);
        const args = split(clean.slice(end + 1, genericEnd));
        const item = this.type(args[base.includes('map') ? 1 : 0] || [], scope, seen);
        info = { ...item, collection: containers.has(base) || item.collection };
        if (containers.has(base)) info.multiplicity = base === 'array' ? tokensToText(args[1] || ['*']) : '*';
        else {
          // The arrow targets the elements, not the optional container itself.
          let multiplicity = item.collection || base === 'reference_wrapper' ? item.multiplicity : '0..1';
          if (base !== 'reference_wrapper' && item.collection && /^\d+$/.test(multiplicity)) multiplicity = '0..' + multiplicity;
          if (['shared_ptr', 'weak_ptr', 'reference_wrapper'].includes(base)) Object.assign(info, { arrow: '-->', multiplicity, reference: true });
          else Object.assign(info, { arrow: item.reference ? item.arrow : '*--', multiplicity });
        }
        // Borrowing an owning wrapper does not transfer ownership of its contents.
        const borrowed = clean.slice(genericEnd + 1).some(token => ['*', '&', '&&'].includes(token));
        if (borrowed || base === 'span') Object.assign(info, { arrow: '-->', reference: true });
      }
      const arrayAt = clean.indexOf('[');
      if (arrayAt >= 0) Object.assign(info, { collection: true, multiplicity: tokensToText(clean.slice(arrayAt + 1, closing(clean, arrayAt))) || '*' });
      return info;
    }

    method(node, name, count, visited = new Set()) {
      if (!node || visited.has(node.name)) return null;
      visited.add(node.name);
      const candidate = this.callable(node.methods.filter(method => method.name === name), count);
      if (candidate) return candidate;
      for (const base of node.bases) {
        const found = this.method(this.type(base, node.scope).node, name, count, visited);
        if (found) return found;
      }
      return null;
    }

    field(node, name, visited = new Set()) {
      if (!node || visited.has(node.name)) return null;
      visited.add(node.name);
      const field = node.fields.find(field => field.name === name);
      if (field) return { ...field, scope: node.name };
      for (const base of node.bases) {
        const found = this.field(this.type(base, node.scope).node, name, visited);
        if (found) return found;
      }
      return null;
    }
  }

  function classDiagramResult(model, options) {
    const constructionMethods = [];
    if (!model.classes.size) return { classDiagram: '', constructionMethods };
    const lines = ['@startuml', 'layout landscape', 'layout compact'], relationships = new Set();
    for (const node of model.classes.values()) {
      const kind = node.kind === 'enum' ? 'enum' : node.methods.some(method => method.abstract) ? 'abstract class' : 'class';
      lines.push(kind + ' ' + node.id + ' {');
      for (const constant of node.constants) lines.push('  ' + constant);
      const structural = new Set();
      for (const base of node.bases) {
        const parent = model.type(base, node.scope).node;
        if (parent) { relationships.add(node.id + ' --|> ' + parent.id); structural.add(parent.name); }
      }
      const fields = node.fields.map(field => ({ field, type: model.type(field.type, node.name) }));
      const targetRoles = new Map();
      for (const { type } of fields) {
        if (type.node) targetRoles.set(type.node.name, (targetRoles.get(type.node.name) || 0) + 1);
      }
      for (const { field, type } of fields) {
        if (type.node) {
          // This field constrains its target end, not all instances' inverse ownership.
          const multiplicity = options.hideMultiplicity ? ' ' + type.arrow + ' ' : ' ' + type.arrow + ' "' + type.multiplicity + '" ';
          const role = targetRoles.get(type.node.name) > 1 ? ' : ' + field.name : '';
          relationships.add(node.id + multiplicity + type.node.id + role); structural.add(type.node.name);
        }
        if (!type.node || type.collection) lines.push('  ' + (field.static ? '{static} ' : '') + (options.hideVisibility ? '' : field.visibility) + field.name + ': ' + tokensToText(field.type.filter(token => !modifiers.has(token))));
      }
      for (const method of node.methods) {
        const params = method.params.map(param => param.name + ': ' + tokensToText(param.type)).join(', ');
        const returns = tokensToText(method.returnType);
        if (method.constructor || method.destructor) {
          constructionMethods.push({ owner: node.id, name: method.name, lineIndex: lines.length,
            isDefault: method.params.length === 0 && Array.isArray(method.body) && method.body.length === 0 && method.initializers.length === 0 });
        }
        lines.push('  ' + (method.static ? '{static} ' : '') + (method.abstract ? '{abstract} ' : '') + (options.hideVisibility ? '' : method.visibility) + method.name + '(' + params + ')' + (returns && returns !== 'void' ? ': ' + returns : ''));
        for (const typeTokens of [method.returnType, ...method.params.map(param => param.type)]) {
          const target = model.type(typeTokens, node.name).node;
          if (target && target !== node && !structural.has(target.name)) relationships.add(node.id + ' ..> ' + target.id);
        }
      }
      lines.push('}');
    }
    return { classDiagram: lines.concat([...relationships], '@enduml').join('\n'), constructionMethods };
  }

  function statement(tokens, start) {
    const kind = tokens[start];
    if (kind === '{') {
      const end = closing(tokens, start);
      return { kind: 'block', body: tokens.slice(start + 1, end), end: end + 1 };
    }
    if (['if', 'for', 'while', 'switch'].includes(kind)) {
      let open = start + 1;
      if (tokens[open] === 'constexpr') open++;
      if (tokens[open] === '(') {
        const close = closing(tokens, open), body = statement(tokens, close + 1);
        const node = { kind, condition: tokens.slice(open + 1, close), body, end: body.end };
        if (kind === 'if' && tokens[node.end] === 'else') { node.otherwise = statement(tokens, node.end + 1); node.end = node.otherwise.end; }
        return node;
      }
    }
    if (kind === 'do') {
      const body = statement(tokens, start + 1);
      if (tokens[body.end] === 'while' && tokens[body.end + 1] === '(') {
        const end = closing(tokens, body.end + 1);
        return { kind: 'do', body, condition: tokens.slice(body.end + 2, end), end: end + 2 };
      }
    }
    if (kind === 'try') {
      const body = statement(tokens, start + 1), catches = [];
      let end = body.end;
      while (tokens[end] === 'catch' && tokens[end + 1] === '(') {
        const close = closing(tokens, end + 1), handler = statement(tokens, close + 1);
        catches.push({ condition: tokens.slice(end + 2, close), body: handler });
        end = handler.end;
      }
      return { kind: 'try', body, catches, end };
    }
    let end = start;
    while (end < tokens.length && tokens[end] !== ';') {
      if (['(', '{', '['].includes(tokens[end])) end = closing(tokens, end);
      end++;
    }
    return { kind: 'simple', tokens: tokens.slice(start, end), end: end + 1 };
  }

  class CppSequence {
    constructor(model) {
      this.diagnostics = new SequenceDiagnostics();
      this.model = model; this.lines = []; this.participants = new Map();
      this.identities = new Set(['Main']); this.activeCalls = new Set(); this.steps = 0;
      this.entities = new Set();
    }

    generate() {
      const main = this.model.functions.find(fn => fn.name === 'main' && fn.body);
      if (!main) return '';
      const receiver = { id: 'Main', node: null, fields: new Map() };
      this.walk(main.body, { receiver, scope: main.scope, vars: new Map(), depth: 0 });
      if (!this.lines.length) return '';
      return ['@startuml', 'layout landscape', 'layout compact', 'participant Main as : Main',
        ...[...this.participants].map(([id, node]) => 'participant ' + id + ': ' + node.id),
        'activate Main', ...this.lines, 'deactivate Main', '@enduml'].join('\n');
    }

    entity(name, node) {
      const entity = { id: uniqueDiagramId(name, this.identities), node, fields: new Map(), inferredFields: new Map() };
      this.entities.add(entity);
      return entity;
    }

    ensure(entity) { if (entity.node) this.participants.set(entity.id, entity.node); }

    field(receiver, name) {
      if (receiver.fields.has(name)) return receiver.fields.get(name);
      const field = this.model.field(receiver.node, name);
      if (!field) return null;
      const type = this.model.type(field.type, field.scope);
      if (!type.node || type.collection) return null;
      if (receiver.inferredFields.has(name)) return receiver.inferredFields.get(name);
      const value = this.entity(receiver.id + '_' + name, type.node);
      receiver.inferredFields.set(name, value);
      return value;
    }

    variable(name, context) {
      if (name === 'this') return context.receiver;
      if (context.vars.has(name)) return context.vars.get(name);
      return this.field(context.receiver, name);
    }

    freeFunction(name, scope, count) {
      return this.model.callable(this.model.lookup(this.model.freeFunctions, name, scope) || [], count);
    }

    arguments(tokens, context) {
      const parts = tokens.length ? split(tokens) : [];
      if (parts.filter(part => part.includes('(')).length > 1) this.diagnostics.add('ordering');
      return parts.map(part => this.expression(part, context));
    }

    invoke(receiver, method, args, argumentText, context) {
      if (++this.steps > 5000) throw new SequenceLimitError();
      if (!method) { this.diagnostics.add('unresolved'); return null; }
      if (method.ambiguous) this.diagnostics.add('dispatch', method.name);
      else if (!method.body) this.diagnostics.add('unresolved', method.name);
      this.ensure(receiver);
      this.lines.push(context.receiver.id + ' -> ' + receiver.id + ': ' + method.name + '(' + argumentText + ')');
      this.lines.push('activate ' + receiver.id);
      const result = this.follow(receiver, method, args, context.depth);
      const returnType = tokensToText(method.returnType);
      if (returnType && returnType !== 'void') this.lines.push(receiver.id + ' --> ' + context.receiver.id + ': ' + returnType);
      this.lines.push('deactivate ' + receiver.id);
      if (result) return result;
      const type = this.model.type(method.returnType, method.owner || method.scope);
      return type.node && !type.collection ? this.entity(receiver.id + '_' + method.name + '_result', type.node) : null;
    }

    follow(receiver, method, args, depth) {
      const key = (method.owner || method.scope) + '::' + this.model.signature(method);
      if (!method.body || (!method.body.length && !method.initializers.length)) return null;
      if (!this.diagnostics.canExpand(method.name, this.activeCalls.has(key), depth, 3)) return null;
      this.activeCalls.add(key);
      const context = { receiver, scope: method.owner || method.scope, vars: new Map(), depth: depth + 1 };
      method.params.forEach((param, index) => {
        const type = this.model.type(param.type, context.scope);
        let value = args[index];
        if (type.node && !type.collection && (!value || (!type.reference && !param.type.includes('*')))) value = this.entity(param.name, type.node);
        context.vars.set(param.name, value || null);
      });
      for (const initializer of method.initializers) {
        const field = this.model.field(receiver.node, initializer.name);
        const values = this.arguments(initializer.args, context);
        if (field && values[0]) {
          const type = this.model.type(field.type, field.scope);
          if (type.reference || field.type.includes('*')) receiver.fields.set(field.name, values[0]);
        }
      }
      const result = this.walk(method.body, context);
      this.activeCalls.delete(key);
      return result;
    }

    // Parse calls as expressions so argument calls precede the enclosing call,
    // and a typed return value can be the receiver of the next member access.
    expression(tokens, context) {
      if (++this.steps > 5000) throw new SequenceLimitError();
      if (tokens.some(token => ['&&', '||', '?'].includes(token))) this.diagnostics.add('conditional');
      if (tokens.some((token, index) => ['co_await', 'co_yield'].includes(token) ||
          (token === '[' && ['.', '->', '(', '{'].includes(tokens[closing(tokens, index) + 1])))) this.diagnostics.add('unsupported', 'Coroutine, lambda, or indexed receiver');
      let result = null, i = 0;
      while (i < tokens.length) {
        if (tokens[i] === '(') {
          const end = closing(tokens, i);
          result = this.expression(tokens.slice(i + 1, end), context); i = end + 1;
        } else if (identifier(tokens[i]) && !['return', 'new', 'delete'].includes(tokens[i])) {
          let name = tokens[i++];
          while (tokens[i] === '::' && identifier(tokens[i + 1])) { name += '::' + tokens[i + 1]; i += 2; }
          if (tokens[i] === '(') {
            const end = closing(tokens, i), argTokens = tokens.slice(i + 1, end), args = this.arguments(argTokens, context);
            const className = name.includes('::') ? name.slice(0, name.lastIndexOf('::')) : '';
            const node = className && this.model.resolve(className, context.scope);
            let receiver = context.receiver;
            if (node) {
              receiver = this.staticReceiver(node);
              result = this.invoke(receiver, this.model.method(node, shortName(name), args.length), args, tokensToText(argTokens), context);
            } else if (['std::move', 'std::ref', 'std::cref'].includes(name)) result = args[0];
            else {
              const method = this.model.method(receiver.node, name, args.length) || this.freeFunction(name, context.scope, args.length);
              result = this.invoke(receiver, method, args, tokensToText(argTokens), context);
            }
            i = end + 1;
          } else result = this.variable(name, context);
        } else { i++; continue; }
        while (['.', '->'].includes(tokens[i]) && identifier(tokens[i + 1])) {
          const name = tokens[i + 1]; i += 2;
          if (tokens[i] === '(') {
            const end = closing(tokens, i), argTokens = tokens.slice(i + 1, end), args = this.arguments(argTokens, context);
            if (!result) this.diagnostics.add('unresolved', name);
            result = result ? this.invoke(result, this.model.method(result.node, name, args.length), args, tokensToText(argTokens), context) : null;
            i = end + 1;
          } else result = result ? this.field(result, name) : null;
        }
      }
      return result;
    }

    staticReceiver(node) {
      if (!this.staticReceivers) this.staticReceivers = new Map();
      if (!this.staticReceivers.has(node.name)) this.staticReceivers.set(node.name, this.entity(node.id, node));
      return this.staticReceivers.get(node.name);
    }

    construction(type, initializer, context) {
      let node = type.node, open = -1;
      const newAt = initializer.indexOf('new');
      const makerAt = initializer.findIndex(token => token === 'make_unique' || token === 'make_shared');
      if (newAt >= 0) {
        const end = typeEnd(initializer, newAt + 1);
        node = this.model.type(initializer.slice(newAt + 1, end), context.scope).node; open = end;
      } else if (makerAt >= 0 && initializer[makerAt + 1] === '<') {
        const end = closing(initializer, makerAt + 1);
        node = this.model.type(initializer.slice(makerAt + 2, end), context.scope).node; open = end + 1;
      } else if (initializer[0] === '=') {
        const end = typeEnd(initializer, 1, true);
        const created = this.model.type(initializer.slice(1, end), context.scope).node;
        if (!created) return null;
        node = created; open = end;
      } else if (initializer[0] === '(' || initializer[0] === '{') open = 0;
      else if (initializer.length || type.reference || type.multiplicity === '0..1' || type.collection) return null;
      if (!node || type.collection) return null;
      const args = open >= 0 && pairs[initializer[open]] ? initializer.slice(open + 1, closing(initializer, open)) : [];
      return { node, args };
    }

    local(tokens, context) {
      if (context.vars.has(tokens[0])) return false;
      const end = typeEnd(tokens, 0, true);
      if (!end || !identifier(tokens[end])) return false;
      const declarations = split(tokens);
      if (declarations.length > 1) {
        const base = tokens.slice(0, end);
        while (['*', '&', '&&', 'const'].includes(base[base.length - 1])) base.pop();
        declarations.forEach((part, index) => this.local(index ? base.concat(part) : part, context));
        return true;
      }
      const typeTokens = tokens.slice(0, end), name = tokens[end], initializer = tokens.slice(end + 1);
      const type = this.model.type(typeTokens, context.scope);
      const construct = this.construction(type, initializer, context);
      let value = null;
      if (construct) {
        const args = this.arguments(construct.args, context);
        value = this.entity(name, construct.node); this.ensure(value);
        this.lines.push('create ' + value.id, context.receiver.id + ' --> ' + value.id + ': <<create>>');
        const constructor = this.model.method(value.node, shortName(value.node.name), args.length);
        if (constructor) {
          this.lines.push('activate ' + value.id);
          this.follow(value, constructor, args, context.depth);
          this.lines.push('deactivate ' + value.id);
        }
      } else {
        value = this.expression(initializer[0] === '=' ? initializer.slice(1) : initializer, context);
        if (!value && type.node && !type.collection) value = this.entity(name, type.node);
      }
      context.vars.set(name, value);
      if (context.declared) context.declared.add(name);
      return true;
    }

    simple(tokens, context) {
      if (!tokens.length) return;
      if (this.local(tokens, context)) return;
      const assignment = split(tokens, '=', false);
      if (assignment.length === 2) {
        const value = this.expression(assignment[1], context), lhs = assignment[0];
        if (lhs.length === 1 && context.vars.has(lhs[0])) context.vars.set(lhs[0], value);
        else if (lhs.length === 1 && this.model.field(context.receiver.node, lhs[0])) context.receiver.fields.set(lhs[0], value);
        else if (lhs[0] === 'this' && lhs[1] === '->') context.receiver.fields.set(lhs[2], value);
        else if (['.', '->'].includes(lhs.at(-2))) {
          const owner = this.expression(lhs.slice(0, -2), context);
          if (owner) owner.fields.set(lhs.at(-1), value);
        }
      } else this.expression(tokens, context);
    }

    snapshot(context) {
      return { vars: new Map(context.vars), fields: new Map([...this.entities].map(entity => [entity, new Map(entity.fields)])) };
    }

    mergeReceiver(values, label) {
      if (values.every(value => value === values[0])) return values[0];
      this.diagnostics.add('identity', label);
      const node = values.find(value => value)?.node;
      return node && values.every(value => !value || value.node === node) ? this.entity(label, node) : null;
    }

    mergeStates(states, baseline, context) {
      for (const name of baseline.vars.keys()) {
        context.vars.set(name, this.mergeReceiver(states.map(state => state.vars.get(name)), name));
      }
      for (const [entity] of baseline.fields) {
        const names = new Set(states.flatMap(state => [...(state.fields.get(entity) || new Map()).keys()]));
        for (const name of names) {
          const values = states.map(state => state.fields.get(entity)?.has(name)
            ? state.fields.get(entity).get(name) : this.field(entity, name));
          entity.fields.set(name, this.mergeReceiver(values, entity.id + '_' + name));
        }
      }
    }

    isAbrupt(node) {
      return node.kind === 'simple' && ['return', 'throw', 'break', 'continue'].includes(node.tokens[0]);
    }

    capture(nodes, context, states) {
      const baseline = this.snapshot(context);
      const outer = this.lines; this.lines = [];
      const branch = { ...context, vars: new Map(context.vars), fragment: true };
      try {
        for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
          this.process(node, branch);
          if (this.isAbrupt(node)) break;
        }
        if (states) states.push(this.snapshot(branch));
        return this.lines;
      } finally {
        this.lines = outer;
        for (const entity of this.entities) entity.fields = new Map(baseline.fields.get(entity));
      }
    }

    process(node, context) {
      if (node.kind === 'block') {
        const block = { ...context, vars: new Map(context.vars), declared: new Set() };
        const result = this.walk(node.body, block);
        for (const name of context.vars.keys()) {
          if (!block.declared.has(name)) context.vars.set(name, block.vars.get(name));
        }
        return result;
      }
      if (this.isAbrupt(node)) {
        if (context.fragment || node.tokens[0] === 'throw') this.diagnostics.add('control');
        return this.expression(node.tokens.slice(1), context);
      }
      if (node.kind === 'simple') return this.simple(node.tokens, context);
      if (node.kind === 'if') {
        this.expression(node.condition, context);
        const baseline = this.snapshot(context), states = [];
        const yes = this.capture(node.body, context, states), no = node.otherwise ? this.capture(node.otherwise, context, states) : [];
        if (!node.otherwise) states.push(baseline);
        this.mergeStates(states, baseline, context);
        if (yes.length || no.length) {
          this.lines.push((node.otherwise ? 'alt' : 'opt') + ' [' + tokensToText(node.condition) + ']', ...yes);
          if (node.otherwise) this.lines.push('else', ...no);
          this.lines.push('end');
        }
      } else if (['for', 'while', 'do'].includes(node.kind)) {
        const baseline = this.snapshot(context);
        if (['true', '1', ';;', ';true;', ';1;'].includes(node.condition.join(''))) this.diagnostics.add('loop');
        const loopContext = { ...context, vars: new Map(context.vars) };
        const init = split(node.condition, ';', false)[0];
        if (node.kind === 'for') this.simple(split(init, ':', false)[0], loopContext);
        const clauses = split(node.condition, ';', false);
        const condition = node.kind === 'for' ? (clauses.length === 3 ? clauses[1] : []) : node.condition;
        if (node.kind !== 'do') this.expression(condition, loopContext);
        const states = node.kind === 'do' ? [] : [this.snapshot(loopContext)];
        const iteration = [node.body];
        if (node.kind === 'for' && clauses.length === 3) iteration.push({ kind: 'simple', tokens: clauses[2] });
        iteration.push({ kind: 'simple', tokens: condition });
        const body = this.capture(iteration, loopContext, states);
        this.mergeStates(states, baseline, context);
        if (body.length) this.lines.push('loop [' + node.kind + ' (' + tokensToText(node.condition) + ')]', ...body, 'end');
      } else if (node.kind === 'try') {
        this.diagnostics.add('control', 'Exception paths');
        const body = this.capture(node.body, context);
        const handlers = node.catches.map(handler => ({ label: tokensToText(handler.condition), lines: this.capture(handler.body, context) }));
        if (body.length || handlers.some(handler => handler.lines.length)) {
          this.lines.push('alt [try]', ...body);
          handlers.forEach(handler => this.lines.push('else [catch (' + handler.label + ')]', ...handler.lines));
          this.lines.push('end');
        }
      } else if (node.kind === 'switch') {
        this.diagnostics.add('control', 'Switch fall-through');
        this.expression(node.condition, context);
        const tokens = node.body.body || [], branches = [];
        let i = 0;
        while (i < tokens.length) {
          if (!['case', 'default'].includes(tokens[i])) { i++; continue; }
          const start = i++;
          while (i < tokens.length && tokens[i] !== ':') i++;
          const label = tokensToText(tokens.slice(start, i++)), bodyStart = i;
          while (i < tokens.length && !['case', 'default'].includes(tokens[i])) { if (tokens[i] === '{') i = closing(tokens, i); i++; }
          branches.push({ label, lines: this.capture({ kind: 'block', body: tokens.slice(bodyStart, i) }, context) });
        }
        if (branches.some(branch => branch.lines.length)) {
          branches.forEach((branch, index) => this.lines.push((index ? 'else' : 'alt') + ' [' + branch.label + ']', ...branch.lines));
          this.lines.push('end');
        }
      }
    }

    walk(tokens, context) {
      let i = 0;
      while (i < tokens.length) {
        if (++this.steps > 5000) throw new SequenceLimitError();
        const node = statement(tokens, i);
        const result = this.process(node, context);
        if (this.isAbrupt(node)) return result;
        i = node.end;
      }
      return null;
    }
  }

  class SequenceLimitError extends Error {
    constructor() {
      super('C++ sequence inference limit reached; simplify the example to inspect its interactions.');
      this.name = 'SequenceLimitError';
    }
  }

  function analyzeCppSources(sources, options = {}) {
    const parser = new CppParser(), errors = [];
    for (const [filename, source] of Object.entries(sources)) {
      try { parser.parse(tokenize(source)); }
      catch (error) { errors.push(filename + ': ' + error.message); }
    }
    const model = new CppModel(parser);
    let sequenceDiagram = '';
    let sequenceFailed = false;
    const sequence = new CppSequence(model);
    try { sequenceDiagram = sequence.generate(); }
    catch (error) {
      if (!(error instanceof SequenceLimitError)) throw error;
      sequenceFailed = true;
      errors.push(error.message);
    }
    return { ...classDiagramResult(model, options), ...sequence.diagnostics.result(sequenceDiagram, { failed: sequenceFailed }), errors };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { analyzeCppSources };
  if (global) global.analyzeCppSources = analyzeCppSources;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);
