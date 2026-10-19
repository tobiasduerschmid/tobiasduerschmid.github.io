/**
 * Purposeful display projections of analyzer output. The source result stays
 * untouched for grading, diagnostics and switching back to implementation.
 * This module reads the analyzers' line-oriented UML dialect, not source code.
 */
(function (global) {
  'use strict';

  const expressionModule = typeof module !== 'undefined' && module.exports
    ? require('./uml-expression-views.js') : null;
  const expressions = () => expressionModule || global.UMLExpressionViews;

  const primitives = {
    python: { int: 'Integer', bool: 'Boolean', str: 'String', float: 'Real' },
    java: { byte: 'Integer', short: 'Integer', int: 'Integer', long: 'Integer',
      boolean: 'Boolean', String: 'String', float: 'Real', double: 'Real',
      Byte: 'Optional<Integer>', Short: 'Optional<Integer>', Integer: 'Optional<Integer>',
      Long: 'Optional<Integer>', Boolean: 'Optional<Boolean>', Float: 'Optional<Real>', Double: 'Optional<Real>' },
    cpp: { bool: 'Boolean', string: 'String', 'std::string': 'String',
      short: 'Integer', 'short int': 'Integer', int: 'Integer', long: 'Integer',
      'long int': 'Integer', 'long long': 'Integer', 'long long int': 'Integer',
      float: 'Real', double: 'Real', 'long double': 'Real' },
    js: { boolean: 'Boolean', string: 'String', number: 'Real', bigint: 'Integer',
      Boolean: 'Boolean {boxed}', String: 'String {boxed}', Number: 'Real {boxed}' }
  };
  const collections = {
    python: { list: 'Sequence', List: 'Sequence', Sequence: 'Sequence',
      set: 'Set', Set: 'Set', frozenset: 'Set', FrozenSet: 'Set', dict: 'Map', Dict: 'Map',
      Mapping: 'Map', tuple: 'Tuple', Tuple: 'Tuple', Optional: 'Optional', Union: 'Union' },
    java: { List: 'Sequence', ArrayList: 'Sequence', LinkedList: 'Sequence',
      Set: 'Set', HashSet: 'Set', TreeSet: 'Set', Map: 'Map', HashMap: 'Map',
      TreeMap: 'Map', Collection: 'Collection', Optional: 'Optional' },
    cpp: { vector: 'Sequence', list: 'Sequence', deque: 'Sequence', set: 'Set',
      unordered_set: 'Set', map: 'Map', unordered_map: 'Map', tuple: 'Tuple', optional: 'Optional' },
    js: { Array: 'Sequence', ReadonlyArray: 'Sequence', Set: 'Set', Map: 'Map' }
  };

  // Separators in nested generics, literal strings or default expressions are
  // not member/parameter separators. In particular, C++ :: is never a colon.
  function splitTopLevel(text, separator) {
    const parts = [];
    const stack = [];
    const pairs = { '(': ')', '[': ']', '<': '>', '{': '}' };
    let quote = '', start = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quote) {
        if (char === '\\') i++;
        else if (char === quote) quote = '';
      } else if (char === '"' || char === "'") quote = char;
      else if (pairs[char]) stack.push(pairs[char]);
      else if (stack.length && char === stack[stack.length - 1]) stack.pop();
      else if (!stack.length && char === separator &&
        !(separator === ':' && (text[i - 1] === ':' || text[i + 1] === ':')) &&
        !(separator === '=' && (/[=!<>:+*/%&|^?-]/.test(text[i - 1] || '') || text[i + 1] === '='))) {
        parts.push(text.slice(start, i).trim()); start = i + 1;
      }
    }
    parts.push(text.slice(start).trim());
    return parts;
  }

  function nullable(type) {
    return type.startsWith('Optional<') ? type : 'Optional<' + type + '>';
  }

  /** Maps a source type without renaming user-defined types or literal values. */
  function mapType(source, { language, declaredTypes = new Set() }) {
    const lang = language === 'typescript' ? 'js' : language;
    const context = { language: lang, declaredTypes };
    const type = source.trim();
    if (!type || declaredTypes.has(type)) return type;
    if (lang === 'python' && /^(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")$/.test(type)) {
      return mapType(type.slice(1, -1), context);
    }
    // Function types are outside this small type vocabulary. Preserve them as
    // one unit instead of presenting a partly translated function signature.
    if (type.includes('=>')) return type;
    const union = splitTopLevel(type, '|');
    if (union.length > 1) {
      const mapped = union.map(part => mapType(part, context));
      const present = mapped.filter(part => part !== 'null');
      if (present.length === 1 && present.length !== mapped.length) return nullable(present[0]);
      return mapped.join(' | ');
    }
    if (type.startsWith('(') && type.endsWith(')')) return mapType(type.slice(1, -1), context);
    if (['None', 'null', 'undefined'].includes(type)) return 'null';
    if (lang === 'cpp') return mapCppType(type, context);
    const native = lang === 'java' ? type.replace(/^java\.lang\./, '') : type;
    if (Object.hasOwn(primitives[lang] || {}, native)) return primitives[lang][native];
    const array = type.match(/^(.+)\[\]$/);
    if (array) return 'Sequence<' + mapType(array[1], context) + '>';
    return mapGenericType(type, context);
  }

  function mapCppType(type, context) {
    const value = type.replace(/\b(?:const|volatile)\s*/g, '').replace(/\s*&&?\s*$/, '').trim();
    if (context.declaredTypes.has(value)) return value;
    if (value.endsWith('*') && !value.slice(0, -1).includes('*')) {
      return 'Optional<' + mapType(value.slice(0, -1), context) + '>';
    }
    if (Object.hasOwn(primitives.cpp, value)) return primitives.cpp[value];
    if (/^(?:unsigned(?: (?:short|long|long long|int))?(?: int)?|(?:std::)?(?:u?int(?:8|16|32|64)_t|size_t))$/.test(value)) {
      return /^(?:unsigned|(?:std::)?(?:uint|size_t))/.test(value) ? 'Integer {>=0}' : 'Integer';
    }
    if (/^signed(?: (?:short|long|long long|int))?(?: int)?$/.test(value)) return 'Integer';
    const array = value.match(/^(.+)\[(\d*)\]$/);
    if (array) return 'Sequence<' + mapType(array[1], context) + '>' + (array[2] ? ' [' + array[2] + ']' : '');
    return mapGenericType(value, context);
  }

  function mapGenericType(type, context) {
    const generic = type.match(/^([\w.:]+)\s*[<\[]([\s\S]*)[>\]]$/);
    if (!generic) {
      const bare = collections[context.language]?.[type];
      return bare && bare !== 'Optional' && bare !== 'Union' ? bare + (bare === 'Map' ? '<?, ?>' : '<?>') : type;
    }
    const [ , name, body ] = generic;
    const shortName = name.split(/::|\./).pop();
    if (context.declaredTypes.has(name) || ['Literal', 'Annotated', 'Callable'].includes(shortName)) return type;
    const args = splitTopLevel(body, ',').map(part => mapType(part, context));
    const standardName = !/[.:]/.test(name) || {
      python: /^(?:typing|collections\.abc)\.[^.]+$/,
      java: /^java\.util\.[^.]+$/,
      cpp: /^std::[^:]+$/,
      js: /^globalThis\.[^.]+$/
    }[context.language]?.test(name);
    if (standardName && context.language === 'cpp' && ['unique_ptr', 'shared_ptr', 'weak_ptr'].includes(shortName)) return 'Optional<' + args[0] + '>';
    if (standardName && context.language === 'cpp' && shortName === 'array' && args.length === 2) return 'Sequence<' + args[0] + '> [' + args[1] + ']';
    const mappedName = standardName && collections[context.language]?.[shortName];
    if (mappedName === 'Optional' && args.length === 1) {
      // C++ optional can contain an empty optional. Java Optional cannot contain
      // a null boxed value, but can contain another Optional.empty().
      const nestedWrapper = /^(?:std::)?optional\s*</.test(body) || /^Optional\s*</.test(body);
      return context.language === 'cpp' || context.language === 'java' && nestedWrapper
        ? 'Optional<' + args[0] + '>' : nullable(args[0]);
    }
    if (mappedName === 'Union') {
      const present = args.filter(arg => arg !== 'null');
      return present.length === 1 && present.length !== args.length ? nullable(present[0]) : args.join(' | ');
    }
    // Unknown generic types retain their own name and syntax; only known type
    // arguments change. No assumption that an arbitrary wrapper is a collection.
    const open = mappedName ? '<' : type.includes('<') ? '<' : '[';
    const close = open === '<' ? '>' : ']';
    return (mappedName || name) + open + args.join(', ') + close;
  }

  function typedMember(text, context) {
    if (text.includes('=>')) return text;
    const declaration = splitTopLevel(text, '=');
    const parts = splitTopLevel(declaration[0], ':');
    const projected = parts.length === 2 ? parts[0] + ': ' + mapType(parts[1], context) : declaration[0];
    return projected + (declaration.length > 1
      ? ' = ' + expressions().projectExpression(declaration.slice(1).join(' = '), expressionOptions(context)) : '');
  }

  function expressionOptions(context) {
    return { language: context.language, mapType: type => mapType(type, context),
      projectName: context.language === 'python'
        ? name => context.pythonNames.get(name) || pythonDisplayName(name) : name => name };
  }

  function projectMember(line, owner, context, retainConstruction) {
    const open = line.indexOf('(');
    const memberColon = splitTopLevel(line.slice(0, open < 0 ? undefined : open), ':').length > 1;
    if (open < 0 || memberColon) return line.match(/^\s*/)[0] + typedMember(line.trim(), context);
    // The enclosing parameter list can contain callable annotations/defaults.
    let depth = 1, close = open + 1;
    for (; close < line.length && depth; close++) {
      if (line[close] === '(') depth++;
      else if (line[close] === ')') depth--;
    }
    if (depth) return line;
    close--;
    const name = line.slice(0, open).replace(/\{\w+\}/g, '').trim().replace(/^[+#~\-]/, '').trim();
    const construction = isConstruction(name, owner, context);
    if (construction && !retainConstruction && context.defaultConstructionLines.has(context.lineIndex)) return null;
    const params = splitTopLevel(line.slice(open + 1, close), ',').map(param => typedMember(param, context)).join(', ');
    const suffix = line.slice(close + 1).trim();
    let returns = suffix;
    if (suffix.startsWith(':')) {
      const type = suffix.slice(1).trim();
      returns = ['None', 'void'].includes(type) ? '' : ': ' + mapType(type, context);
    } else if (!suffix && context.language === 'python' && !construction) returns = ': ?';
    let prefix = line.slice(0, open);
    if (construction && context.language === 'js') {
      prefix = prefix.slice(0, prefix.lastIndexOf(name)) + owner;
    }
    return prefix + '(' + params + ')' + returns;
  }

  function isConstruction(name, owner, context) {
    // Serializer provenance distinguishes constructors from same-named Java
    // operations, including void operations with identical displayed text.
    if (context.constructionLines) return context.constructionLines.has(context.lineIndex);
    if (context.language === 'python') return ['__init__', '__new__'].includes(name);
    if (context.language === 'js') return name === 'constructor';
    return name === owner || name === '~' + owner;
  }

  function classTypes(syntax) {
    return new Set(Array.from(syntax.matchAll(/^\s*(?:abstract\s+)?(?:class|interface|enum)\s+([\w.:]+)/gm), match => match[1]));
  }

  function pythonDisplayName(name, owner) {
    if (owner && ['__init__', '__new__'].includes(name)) return owner;
    if (/^__.+__$/.test(name)) return name.slice(2, -2);
    return name.replace(/^_+/, '') || name;
  }

  const pythonMember = /^(\s*(?:\{\w+\}\s*)*[+#~\-]?\s*)([\w$]+)(?=\s*[:(]|$)/;

  function pythonNames(lines, owner) {
    const originals = new Set(lines.map(line => line.match(pythonMember)?.[2]).filter(Boolean));
    const counts = new Map();
    for (const name of originals) {
      const display = pythonDisplayName(name, owner);
      counts.set(display, (counts.get(display) || 0) + 1);
    }
    // Keep source spellings when stripping markers would merge distinct names.
    return new Map(Array.from(originals, name => {
      const display = pythonDisplayName(name, owner);
      return [name, counts.get(display) === 1 ? display : name];
    }));
  }

  function renamePythonMember(line, names) {
    return line.replace(pythonMember, (whole, prefix, name) => prefix + (names.get(name) || name));
  }

  function projectClass(syntax, context, retainConstruction) {
    let owner = null;
    let names = new Map();
    const lines = syntax.split('\n');
    return lines.map((line, lineIndex) => {
      const declaration = line.match(/^\s*(?:abstract\s+)?(?:class|interface|enum)\s+([\w.:]+)[^{]*\{/);
      if (declaration) {
        owner = declaration[1].split(/::|\./).pop();
        if (context.language === 'python') {
          const end = lines.findIndex((candidate, index) => index > lineIndex && candidate.trim() === '}');
          names = pythonNames(lines.slice(lineIndex + 1, end < 0 ? undefined : end), owner);
        }
        return line;
      }
      if (line.trim() === '}') { owner = null; return line; }
      if (!owner) return line;
      const member = projectMember(line, owner, { ...context, lineIndex }, retainConstruction);
      return member !== null && context.language === 'python' ? renamePythonMember(member, names) : member;
    }).filter(line => line !== null).join('\n');
  }

  function projectSequence(syntax, context) {
    const typed = syntax.split('\n').map(line => {
      if (context.language === 'python') {
        line = line.replace(/^(\S+\s+->\s+\S+\s*:\s*)(\w+)(\()/,
          (whole, prefix, name, open) => prefix + (context.pythonNames.get(name) || pythonDisplayName(name)) + open);
      }
      const reply = line.match(/^(\S+\s+-->\s+\S+\s*:\s*)(.*)$/);
      if (!reply || reply[2].includes('<<create>>')) return line;
      // Analyzer reply labels are declared types, optionally prefixed with the
      // receiving variable. Expression projection is applied separately below.
      const binding = splitTopLevel(reply[2], ':');
      return reply[1] + (binding.length === 2
        ? binding[0] + ': ' + mapType(binding[1], context) : mapType(reply[2], context));
    }).join('\n');
    return expressions().projectSequence(typed, expressionOptions(context));
  }

  /**
   * Both views describe current source, not a reference design. Relationships,
   * visibility, errors and diagnostic evidence are invariant. Python member
   * markers recede unless that would merge distinct names. Optional
   * retainConstruction keeps class constructors for lifecycle-focused lessons.
   */
  function project(result, { language, view = 'design', retainConstruction = false }) {
    if (view === 'implementation') return { ...result };
    if (view !== 'design') throw new Error('Unknown UML diagram view: ' + view);
    const context = { language: language === 'typescript' ? 'js' : language,
      declaredTypes: classTypes(result.classDiagram || ''),
      constructionLines: result.constructionMethods && new Set(result.constructionMethods.map(method => method.lineIndex)),
      defaultConstructionLines: new Set((result.constructionMethods || []).filter(method => method.isDefault).map(method => method.lineIndex)),
      pythonNames: pythonNames((result.classDiagram || '').split('\n')) };
    return { ...result,
      classDiagram: projectClass(result.classDiagram || '', context, retainConstruction),
      sequenceDiagram: projectSequence(result.sequenceDiagram || '', context) };
  }

  const api = { project, mapType };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.UMLDiagramViews = api;
})(typeof window !== 'undefined' ? window : globalThis);
