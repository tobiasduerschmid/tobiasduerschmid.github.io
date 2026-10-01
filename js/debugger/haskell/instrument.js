/**
 * Add demand probes to layout-based Haskell top-level equations.
 *
 * This is deliberately a declaration instrumenter, not a Haskell evaluator.
 * MicroHs still parses, type-checks and evaluates each original expression.
 * Probes surround only whole right-hand sides, preserving their layout and
 * laziness. Nested bindings, lambda bodies and do statements remain intact.
 */
(function (scope) {
  'use strict';

  const DECLARATION_KEYWORDS = new Set([
    'module', 'import', 'data', 'newtype', 'type', 'class', 'instance',
    'infix', 'infixl', 'infixr', 'foreign', 'default', 'deriving',
  ]);

  function withoutTrivia(source) {
    const chars = source.split('');
    let index = 0;
    function blank(end) {
      while (index < end) {
        if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
        index += 1;
      }
    }
    while (index < source.length) {
      if (source.startsWith('{-', index)) {
        let cursor = index + 2;
        let depth = 1;
        while (cursor < source.length && depth) {
          if (source.startsWith('{-', cursor)) { depth += 1; cursor += 2; }
          else if (source.startsWith('-}', cursor)) { depth -= 1; cursor += 2; }
          else cursor += 1;
        }
        blank(cursor);
      } else if (source.startsWith('--', index) && !/^--+[!#$%&*+./<=>?@\\^|:~]/.test(source.slice(index))) {
        const end = source.indexOf('\n', index);
        blank(end < 0 ? source.length : end);
      } else if (source[index] === '"' ||
                 (source[index] === "'" && !/[A-Za-z0-9_']/.test(source[index - 1] || ' '))) {
        const quote = source[index];
        let cursor = index + 1;
        while (cursor < source.length) {
          if (source[cursor] === '\\') cursor += 2;
          else if (source[cursor++] === quote) break;
        }
        blank(cursor);
      } else index += 1;
    }
    return chars.join('');
  }

  function tokensFor(source) {
    const clean = withoutTrivia(source);
    const pattern = /[A-Za-z_][A-Za-z0-9_']*|[!#$%&*+.\/<=>?@\\^|:~-]+|[^\s]/g;
    const tokens = [];
    let line = 1;
    let column = 1;
    let cursor = 0;
    let depth = 0;
    let previousLine = 0;
    let match;
    while ((match = pattern.exec(clean))) {
      while (cursor < match.index) {
        const character = source[cursor++];
        if (character === '\n') { line += 1; column = 1; }
        else if (character === '\t') column += 8 - ((column - 1) % 8);
        else column += 1;
      }
      const text = match[0];
      if (/^[)\]}]$/.test(text)) depth -= 1;
      tokens.push({ text, offset: match.index, end: pattern.lastIndex,
        line, column, depth,
        firstOnLine: previousLine !== line });
      previousLine = line;
      if (/^[([{]$/.test(text)) depth += 1;
    }
    return tokens;
  }

  function moduleBody(tokens) {
    if (!tokens.length) return { tokens: [], importOffset: 0 };
    if (tokens[0].text !== 'module') return { tokens, importOffset: tokens[0].offset };
    const where = tokens.findIndex(token => token.text === 'where' && token.depth === 0);
    if (where < 0) throw new Error('Haskell debugger requires a complete module declaration.');
    if (tokens[where + 1] && tokens[where + 1].text === '{') {
      throw new Error('Haskell debugger does not support explicit module braces; use one declaration per line.');
    }
    return { tokens: tokens.slice(where + 1), importOffset: tokens[where].end,
      headerLine: tokens[where].line, headerColumnEnd: tokens[where].column + tokens[where].text.length };
  }

  function declarationBlocks(tokens) {
    if (!tokens.length) return [];
    const column = tokens[0].column;
    const blocks = [];
    for (const token of tokens) {
      if (!blocks.length || (token.firstOnLine && token.depth === 0 && token.column === column)) {
        blocks.push([]);
      }
      blocks[blocks.length - 1].push(token);
    }
    return blocks;
  }

  function equationSites(block, filename) {
    const first = block[0];
    if (DECLARATION_KEYWORDS.has(first.text)) return [];
    const outer = block.filter(token => token.depth === 0);
    const delimiter = outer.findIndex(token => ['=', '|', '::'].includes(token.text));
    if (delimiter < 0 || outer[delimiter].text === '::') return [];
    if (!/^[a-z_][A-Za-z0-9_']*$/.test(first.text) || outer.slice(1, delimiter).some(token => token.text === '`' || /^[!#$%&*+.\/<=>?\\^|:~-]+$/.test(token.text) && !['!', '~'].includes(token.text))) {
      throw new Error('Haskell debugger supports named prefix equations; rewrite the binding at ' + filename + ':' + first.line + '.');
    }
    if (outer.some(token => token.text === ';')) {
      throw new Error('Haskell debugger does not support semicolon declarations; place each declaration or do statement on its own line.');
    }
    const headerEnd = block.indexOf(outer[delimiter]);
    const bindings = [...new Set(block.slice(1, headerEnd)
      .map(token => token.text).filter(text => /^[a-z][A-Za-z0-9_']*$/.test(text)))];
    const equation = (equals, line) => ({
      function: first.text, file: filename, line, first_line: first.line,
      bindings, offset: equals.end, column: equals.column,
    });
    if (outer[delimiter].text === '=') return [equation(outer[delimiter], first.line)];

    const sites = [];
    const guardColumn = outer[delimiter].column;
    for (let index = delimiter; index < outer.length; index += 1) {
      const token = outer[index];
      if (token.text === 'where') break;
      if (token.text !== '|' || (index !== delimiter && token.column > guardColumn)) continue;
      let end = index + 1;
      while (end < outer.length && !['=', '->', '|'].includes(outer[end].text)) end += 1;
      if (end === outer.length) break;
      if (outer[end].text !== '=') continue;
      if (outer.slice(index + 1, end).some(part => ['let', '<-'].includes(part.text))) {
        throw new Error('Haskell debugger does not support pattern guards; use Boolean guards at ' + filename + ':' + token.line + '.');
      }
      sites.push(equation(outer[end], token.line));
      index = end;
    }
    return sites;
  }

  function applyEdits(source, edits) {
    const chunks = [];
    const lineMap = [null, 1];
    let originalLine = 1;
    let cursor = 0;
    function append(text, original) {
      chunks.push(text);
      for (const character of text) {
        if (character !== '\n') continue;
        if (original) originalLine += 1;
        lineMap.push(originalLine);
      }
    }
    for (const edit of edits.sort((left, right) => left.offset - right.offset)) {
      append(source.slice(cursor, edit.offset), true);
      append(edit.text, false);
      cursor = edit.offset;
    }
    append(source.slice(cursor), true);
    return { code: chunks.join(''), lineMap };
  }

  /** Return instrumented source plus probe locations in the original source. */
  function instrument(source, filename, firstId = 0) {
    const tokens = tokensFor(source);
    if (tokens.some(token => token.text === 'SEBookTrace')) {
      throw new Error('The Haskell debugger reserves the import alias SEBookTrace.');
    }
    const body = moduleBody(tokens);
    const sites = declarationBlocks(body.tokens).flatMap(block => equationSites(block, filename));
    const edits = sites.map((site, index) => {
      site.id = firstId + index;
      return { offset: site.offset, text: ' SEBookTrace.probe ' + site.id + ' SEBookTrace.$\n' + ' '.repeat(site.column) };
    });
    if (sites.length) {
      const explicitModule = tokens.length && tokens[0].text === 'module';
      const indentation = ' '.repeat(body.tokens[0].column - 1);
      const prefix = explicitModule ? '\n' + indentation : '';
      const inlineBody = explicitModule && body.headerLine === body.tokens[0].line;
      const suffix = explicitModule
        ? '\n' + (inlineBody ? ' '.repeat(body.headerColumnEnd - 1) : '')
        : '\n' + indentation;
      edits.push({ offset: body.importOffset, text: prefix + 'import qualified SEBookDebug as SEBookTrace' + suffix });
    }
    return { ...applyEdits(source, edits), sites };
  }

  const api = { instrument };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.SEBookHaskellInstrument = api;
})(globalThis);
