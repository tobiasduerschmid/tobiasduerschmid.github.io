/**
 * Readable SEBook pseudocode for labels in inferred diagrams, not an OCL
 * compiler. Source evaluation order, truthiness, equality and bitwise semantics
 * remain in force. Unknown constructs and literal contents stay recognizable.
 */
(function (global) {
  'use strict';

  const pairs = { '(': ')', '[': ']', '{': '}' };
  const operators = /^(?:>>>=|===|!==|<<=|>>=|\*\*=|&&=|\|\|=|\?\?=|>>>|==|!=|<=|>=|&&|\|\||\?\?|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<|>>|\*\*|\/\/|->|::|\?\.|=>|:=|\.\.\.)/;

  function languageOf(options) {
    return ['typescript', 'javascript'].includes(options.language) ? 'js' : options.language;
  }

  function quotedEnd(text, start, delimiter, depth = 0) {
    if (depth > 32) return -1;
    for (let i = start + delimiter.length; i < text.length; i++) {
      if (text[i] === '\\') i++;
      else if (delimiter === '`' && text.startsWith('${', i)) {
        let braces = 1;
        i += 2;
        for (; i < text.length && braces; i++) {
          if (['"', "'", '`'].includes(text[i])) {
            const end = quotedEnd(text, i, text[i], depth + 1);
            if (end < 0) return -1;
            i = end - 1;
          } else if (text[i] === '{') braces++;
          else if (text[i] === '}') braces--;
        }
        if (braces) return -1;
        i--;
      }
      else if (text.startsWith(delimiter, i)) return i + delimiter.length;
    }
    return -1;
  }

  function regexEnd(text, start) {
    let characterClass = false;
    for (let i = start + 1; i < text.length; i++) {
      if (text[i] === '\\') i++;
      else if (text[i] === '[') characterClass = true;
      else if (text[i] === ']') characterClass = false;
      else if (text[i] === '/' && !characterClass) {
        while (/[a-z]/i.test(text[i + 1] || '') && i + 1 < text.length) i++;
        return i + 1;
      }
    }
    return -1;
  }

  /** Literals are indivisible, including templates, raw strings and regexes. */
  function tokenize(text, language) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      if (/\s/.test(text[i])) { i++; continue; }
      const tail = text.slice(i);
      if (tail.startsWith('/*') || language !== 'python' && tail.startsWith('//')) {
        const end = tail.startsWith('/*') ? text.indexOf('*/', i + 2) : text.length;
        if (end < 0) return null;
        tokens.push({ value: text.slice(i, tail.startsWith('/*') ? end + 2 : end), kind: 'literal' });
        i = tail.startsWith('/*') ? end + 2 : end;
        continue;
      }
      const raw = language === 'cpp' && tail.match(/^(?:u8|u|U|L)?R"([^\s()\\]{0,16})\(/);
      if (raw) {
        const closing = ')' + raw[1] + '"';
        const end = text.indexOf(closing, i + raw[0].length);
        if (end < 0) return null;
        tokens.push({ value: text.slice(i, end + closing.length), kind: 'literal' });
        i = end + closing.length;
        continue;
      }
      const prefix = language === 'python' ? tail.match(/^[rubf]{1,2}(?=['"])/i)
        : language === 'cpp' ? tail.match(/^(?:u8|u|U|L)(?=['"])/) : null;
      const quoteStart = i + (prefix ? prefix[0].length : 0);
      if (['"', "'", '`'].includes(text[quoteStart])) {
        const quote = text[quoteStart];
        const delimiter = quote !== '`' && text.startsWith(quote.repeat(3), quoteStart) ? quote.repeat(3) : quote;
        const end = quotedEnd(text, quoteStart, delimiter);
        if (end < 0) return null;
        tokens.push({ value: text.slice(i, end), kind: 'literal' });
        i = end;
        continue;
      }
      const previous = tokens[tokens.length - 1]?.value;
      if (language === 'js' && text[i] === '/' && (!previous ||
        tokens[tokens.length - 1]?.kind === 'symbol' && ![')', ']', '}', '++', '--', '.', '?.'].includes(previous) ||
        ['return', 'throw', 'yield', 'case', 'typeof', 'void', 'delete', 'await', 'and', 'or'].includes(previous))) {
        const end = regexEnd(text, i);
        if (end < 0) return null;
        tokens.push({ value: text.slice(i, end), kind: 'literal' });
        i = end;
        continue;
      }
      const word = tail.match(/^(?:[\p{L}_$][\p{L}\p{N}_$]*|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?\w*)/u);
      const operator = tail.match(operators);
      const value = word ? word[0] : operator ? operator[0] : text[i];
      tokens.push({ value, kind: word ? 'word' : 'symbol' });
      i += value.length;
    }
    return tokens;
  }

  function closingIndex(tokens, start) {
    const stack = [];
    for (let i = start; i < tokens.length; i++) {
      const value = tokens[i].value;
      if (tokens[i].kind === 'literal') continue;
      if (pairs[value]) stack.push(pairs[value]);
      else if (value === stack[stack.length - 1]) {
        stack.pop();
        if (!stack.length) return i;
      }
    }
    return -1;
  }

  function format(tokens) {
    let output = '';
    for (let i = 0; i < tokens.length; i++) {
      const value = tokens[i].value;
      const previous = tokens[i - 1]?.value;
      const tight = !i || [')', ']', '}', ',', ';', '.', '?.', '::', '->', '++', '--'].includes(value) ||
        ['(', '[', '{', '.', '?.', '::', '->'].includes(previous) ||
        ['(', '['].includes(value) && !['and', 'or', 'in', 'is', 'as'].includes(previous) &&
          (tokens[i - 1]?.kind === 'word' || [')', ']'].includes(previous));
      output += (tight ? '' : ' ') + value;
    }
    return output;
  }

  function topLevelParts(tokens, separator) {
    const parts = [];
    let start = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (pairs[tokens[i].value]) {
        const end = closingIndex(tokens, i);
        if (end < 0) return [tokens];
        i = end;
      } else if (tokens[i].value === separator) {
        parts.push(tokens.slice(start, i)); start = i + 1;
      }
    }
    parts.push(tokens.slice(start));
    return parts;
  }

  function stripOuter(tokens) {
    return tokens[0]?.value === '(' && closingIndex(tokens, 0) === tokens.length - 1 ? tokens.slice(1, -1) : tokens;
  }

  function namedCast(tokens, start) {
    if (!/^(?:static|dynamic|reinterpret|const)_cast$/.test(tokens[start]?.value || '') || tokens[start + 1]?.value !== '<') return null;
    let depth = 0;
    for (let i = start + 1; i < tokens.length; i++) {
      if (tokens[i].value === '<') depth++;
      else if (['>', '>>'].includes(tokens[i].value)) depth -= tokens[i].value.length;
      if (!depth) {
        const end = tokens[i + 1]?.value === '(' ? closingIndex(tokens, i + 1) : -1;
        return end >= 0 ? { angle: i, end } : null;
      }
    }
    return null;
  }

  // Find precisely the operand of !; not(x) retains the source unary binding
  // in expressions such as !x == y and never changes it to not(x == y).
  function unaryEnd(tokens, start) {
    if (!tokens[start]) return start;
    if (['!', '~', '+', '-', '++', '--', 'typeof', 'void', 'delete', 'await'].includes(tokens[start].value)) {
      return unaryEnd(tokens, start + 1);
    }
    let end = start + 1;
    const cast = namedCast(tokens, start);
    if (cast) end = cast.end + 1;
    else if (tokens[start].value === 'new') end = unaryEnd(tokens, start + 1);
    else if (pairs[tokens[start].value]) {
      const close = closingIndex(tokens, start);
      if (close < 0) return start;
      end = close + 1;
      // A parenthesized type directly followed by a primary expression is a
      // cast, not the complete operand. Include its value in unary negation.
      if (tokens[start].value === '(' && /^[\w.:<>\[\], &*]+$/.test(format(tokens.slice(start + 1, close))) &&
          ['word', 'literal'].includes(tokens[end]?.kind)) end = unaryEnd(tokens, end);
    }
    while (end < tokens.length) {
      if (['.', '?.', '::', '->'].includes(tokens[end].value) && tokens[end + 1]?.kind === 'word') end += 2;
      else if (tokens[end].value === '?.' && ['(', '['].includes(tokens[end + 1]?.value)) end++;
      else if (['(', '['].includes(tokens[end].value)) {
        const close = closingIndex(tokens, end);
        if (close < 0) return start;
        end = close + 1;
      } else if (['++', '--'].includes(tokens[end].value)) end++;
      else break;
    }
    return end;
  }

  function projectTokens(tokens, options) {
    const language = languageOf(options);
    const output = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let value = token.value;
      if (token.kind === 'literal') { output.push(token); continue; }
      const cast = language === 'cpp' && namedCast(tokens, i);
      if (cast) {
        const type = format(tokens.slice(i + 2, cast.angle)) + (tokens[cast.angle].value === '>>' ? '>' : '');
        const mapped = options.mapType ? options.mapType(type) : type;
        const argument = format(projectTokens(tokens.slice(cast.angle + 2, cast.end), options));
        output.push({ value: value + '<' + mapped + '>(' + argument + ')', kind: 'word' });
        i = cast.end;
        continue;
      }
      if (value === '!' && language !== 'python') {
        const end = unaryEnd(tokens, i + 1);
        if (end > i + 1) {
          output.push({ value: 'not(' + format(projectTokens(stripOuter(tokens.slice(i + 1, end)), options)) + ')', kind: 'word' });
          i = end - 1;
          continue;
        }
      }
      if (pairs[value]) {
        const end = closingIndex(tokens, i);
        if (end >= 0) {
          const sourceType = format(tokens.slice(i + 1, end));
          const castType = value === '(' && ['java', 'cpp'].includes(language) && options.mapType &&
            /^[\w.:<>\[\], &*]+$/.test(sourceType) && tokens[end + 1] &&
            (['word', 'literal'].includes(tokens[end + 1].kind) || tokens[end + 1].value === '(')
            ? options.mapType(sourceType) : sourceType;
          if (castType !== sourceType) {
            output.push(token, { value: castType, kind: 'word' }, tokens[end]);
            i = end;
            continue;
          }
          output.push(token, ...projectTokens(tokens.slice(i + 1, end), options), tokens[end]);
          i = end;
          continue;
        }
      }
      if (language !== 'python' && ['&&', '||'].includes(value)) value = value === '&&' ? 'and' : 'or';
      if (language === 'python' && ['True', 'False', 'None'].includes(value)) value = { True: 'true', False: 'false', None: 'null' }[value];
      if (language === 'cpp' && value === 'nullptr') value = 'null';
      if (language !== 'python' && value === 'this') value = 'self';
      if (language === 'cpp' && value === '->') value = '.';
      if (language === 'js' && tokens[i - 1]?.value === 'as' && options.mapType && token.kind === 'word') value = options.mapType(value);
      if (options.projectName && token.kind === 'word' &&
        (tokens[i + 1]?.value === '(' || ['.', '?.', '->'].includes(tokens[i - 1]?.value))) value = options.projectName(value);
      output.push({ ...token, value });
    }
    return output;
  }

  function bindingName(tokens) {
    const text = format(tokens).replace(/^(?:const|let|var)\s+/, '');
    if (/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(text)) return text;
    const annotation = text.match(/^([\w$]+)\s*:(?!:)\s*[\w.<>,\[\]| ?]+$/);
    if (annotation) return annotation[1];
    // Typed declaration, not an arbitrary lvalue. Never drop a receiver or an
    // index expression: duplicating those can change evaluation and side effects.
    const typed = text.match(/^[\w$][\w.:<>\[\], &*]*\s+([\w$]+)$/);
    return typed ? typed[1] : null;
  }

  function projectAssignment(tokens, options) {
    const parts = topLevelParts(tokens, '=');
    if (parts.length === 2) {
      const left = bindingName(parts[0]) || format(projectTokens(parts[0], options));
      return left + ' := ' + format(projectTokens(parts[1], options));
    }
    const name = '[\\p{L}_$][\\p{L}\\p{N}_$]*';
    const text = format(tokens);
    const step = text.match(new RegExp('^(?:(' + name + ')\\s*(\\+\\+|--)|(\\+\\+|--)\\s*(' + name + '))$', 'u'));
    if (step) {
      const variable = step[1] || step[4];
      if (languageOf(options) === 'cpp' && !options.scalarUpdates?.has(variable)) return format(projectTokens(tokens, options));
      return variable + ' := ' + variable + ((step[2] || step[3]) === '++' ? ' + 1' : ' - 1');
    }
    for (const operator of ['+=', '-=', '*=', '/=', '%=']) {
      const compound = topLevelParts(tokens, operator);
      if (compound.length === 2 && compound[0].length === 1 && compound[0][0].kind === 'word') {
        const variable = compound[0][0].value;
        // Python += may mutate a shared collection through __iadd__; spelling
        // it as x := x + y would incorrectly suggest creating another value.
        if (languageOf(options) === 'python') return format(projectTokens(tokens, options));
        if (languageOf(options) === 'cpp' && !options.scalarUpdates?.has(variable)) return format(projectTokens(tokens, options));
        return variable + ' := ' + variable + ' ' + operator[0] + ' (' + format(projectTokens(compound[1], options)) + ')';
      }
    }
    return format(projectTokens(tokens, options));
  }

  function scalarLoopUpdates(initial) {
    const declared = topLevelParts(initial, '=')[0];
    const name = declared[declared.length - 1]?.value;
    const type = format(declared.slice(0, -1)).replace(/\b(?:const|volatile)\s*/g, '').trim();
    // C++ update operators can be overloaded. Only explicit built-in scalar
    // declarations prove that expanding ++ or += keeps the same operation.
    const primitive = /^(?:(?:signed|unsigned)(?: int)?|(?:(?:signed|unsigned) )?(?:char|short(?: int)?|int|long(?: long)?(?: int)?)|float|double|long double)$/;
    return new Set(name && primitive.test(type) ? [name] : []);
  }

  function projectExpression(text, options = {}) {
    const tokens = tokenize(text, languageOf(options));
    if (!tokens) return text;
    return options.assignment ? projectAssignment(tokens, options) : format(projectTokens(tokens, options));
  }

  function iterableExpression(tokens, options) {
    // Java's explicit array allocation is a collection literal in this label;
    // object construction elsewhere remains a visible source operation.
    if (languageOf(options) === 'java' && tokens[0]?.value === 'new') {
      const array = tokens.findIndex(token => token.value === '[');
      const open = tokens.findIndex(token => token.value === '{');
      if (array > 1 && tokens[array + 1]?.value === ']' && open === array + 2 && closingIndex(tokens, open) === tokens.length - 1) {
        return '[' + format(projectTokens(tokens.slice(open + 1, -1), options)) + ']';
      }
    }
    return format(projectTokens(tokens, options));
  }

  function projectLoop(label, options = {}) {
    if (label.startsWith('for each ') || label.startsWith('start ') || label.startsWith('repeat')) return label;
    const language = languageOf(options);
    const post = label.match(/^(?:do-while\s*|do,\s*then\s+while\s+|do\s+)([\s\S]*)$/);
    if (post) {
      const tokens = tokenize(post[1], language);
      return tokens ? 'repeat; then while ' + format(projectTokens(stripOuter(tokens), options)) : label;
    }
    const tokens = tokenize(label, language);
    if (!tokens) return label;
    const keyword = tokens[0]?.value;
    const body = stripOuter(tokens.slice(1));
    if (keyword === 'while') return 'while ' + format(projectTokens(body, options));
    if (keyword !== 'for') return format(projectTokens(tokens, options));
    const clauses = topLevelParts(body, ';');
    if (clauses.length === 3) {
      const [initial, condition, update] = clauses;
      const parts = [];
      if (initial.length) parts.push('start ' + projectAssignment(initial, options));
      parts.push(condition.length ? 'while ' + format(projectTokens(condition, options)) : 'repeat');
      if (update.length) parts.push('after each iteration ' + projectAssignment(update,
        { ...options, scalarUpdates: scalarLoopUpdates(initial) }));
      return parts.join('; ');
    }
    const separator = language === 'python' ? 'in' : language === 'js' ? (topLevelParts(body, 'of').length === 2 ? 'of' : 'in') : ':';
    const range = topLevelParts(body, separator);
    if (range.length === 2) {
      const binder = language === 'python' ? format(range[0]) : bindingName(range[0]);
      if (binder) return 'for each ' + binder + ' in ' + (language === 'js' && separator === 'in' ? 'keys of ' : '') + iterableExpression(range[1], options);
    }
    // Older analyzer results may contain only the condition of a C-style loop.
    // It cannot be expanded without inventing the omitted initialization/update.
    return format(projectTokens(tokens, options));
  }

  function projectSequence(syntax, options = {}) {
    return syntax.split('\n').map(line => {
      const fragment = line.match(/^(\s*)(loop|alt|opt|else|break)\s+\[([\s\S]*)\](\s*)$/);
      if (fragment) {
        const label = fragment[2] === 'loop' ? projectLoop(fragment[3], options) : projectExpression(fragment[3], options);
        return fragment[1] + fragment[2] + ' [' + label + ']' + fragment[4];
      }
      const message = line.match(/^(\s*\S+\s+(?:->|-->)\s+\S+\s*:\s*)([\s\S]*)$/);
      if (!message || message[2].includes('<<create>>')) return line;
      // Reply type mapping is owned by UMLDiagramViews. A colon-bound declared
      // reply is not assignment syntax; only explicit equals bindings are.
      const isReply = message[1].includes('-->');
      if (isReply && !tokenize(message[2], languageOf(options))?.some(token => token.value === '=')) return line;
      return message[1] + projectExpression(message[2], { ...options, assignment: isReply });
    }).join('\n');
  }

  const api = { projectExpression, projectLoop, projectSequence };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.UMLExpressionViews = api;
})(typeof window !== 'undefined' ? window : globalThis);
