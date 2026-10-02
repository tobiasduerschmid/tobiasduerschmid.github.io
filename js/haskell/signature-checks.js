/**
 * Find explicit top-level Haskell type declarations without evaluating code.
 * The compiler separately checks the declared binding's actual type. Sharing
 * the cycle analyzer's lexer/layout rules avoids treating comments, literals,
 * expression annotations, or local declarations as the learner's interface.
 */
(function (root) {
  'use strict';
  const { tokenize, layout, UnsupportedSyntax } = typeof module !== 'undefined' && module.exports
    ? require('./syntax') : root.SEBookHaskellSyntax;
  const variableName = /^[a-z_][A-Za-z0-9_']*$/;
  const opening = new Map([['(', ')'], ['[', ']'], ['{', '}']]);
  const closing = new Set(opening.values());

  function moduleDeclarations(source) {
    const tokens = layout(tokenize(source));
    let cursor = 0;
    if (tokens[0]?.text === 'module') {
      const where = tokens.findIndex(token => token.text === 'where' && token.depth === 0);
      if (where < 0) throw new UnsupportedSyntax('incomplete module header');
      cursor = where + 1;
    }
    if (tokens[cursor++]?.text !== '{') throw new UnsupportedSyntax('missing module body');
    const declarations = [], delimiters = ['}'];
    let declaration = [];
    for (; cursor < tokens.length; cursor++) {
      const text = tokens[cursor].text;
      if (opening.has(text)) delimiters.push(opening.get(text));
      else if (closing.has(text)) {
        if (delimiters.pop() !== text) throw new UnsupportedSyntax('unbalanced declaration');
        if (!delimiters.length) {
          if (declaration.length) declarations.push(declaration);
          if (cursor !== tokens.length - 1) throw new UnsupportedSyntax('trailing module tokens');
          return declarations;
        }
      }
      if (text === ';' && delimiters.length === 1) {
        if (declaration.length) declarations.push(declaration);
        declaration = [];
      } else declaration.push(text);
    }
    throw new UnsupportedSyntax('incomplete module body');
  }

  function declaresName(declaration, name) {
    let cursor = 0, includesName = false;
    while (variableName.test(declaration[cursor] || '')) {
      includesName ||= declaration[cursor] === name;
      cursor++;
      if (declaration[cursor] !== ',') break;
      cursor++;
      if (!variableName.test(declaration[cursor] || '')) return false;
    }
    return includesName && declaration[cursor] === '::' && cursor + 1 < declaration.length;
  }

  /**
   * Find exactly one explicit top-level declaration for the named binding.
   * Type aliases, constraints and type syntax are interpreted by MicroHs, not
   * this lexical check. Unsupported layout or oversized source returns false.
   */
  function hasDeclaration(source, { name }) {
    if (typeof source !== 'string' || source.length > 200000 || !variableName.test(name)) return false;
    try {
      return moduleDeclarations(source).filter(declaration => declaresName(declaration, name)).length === 1;
    } catch (error) {
      if (!(error instanceof UnsupportedSyntax)) throw error;
      return false;
    }
  }

  const api = { hasDeclaration };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SEBookHaskellSignatures = api;
})(globalThis);
