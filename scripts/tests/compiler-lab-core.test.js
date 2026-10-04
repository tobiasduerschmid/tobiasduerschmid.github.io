'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { compile } = require('../../js/compiler-lab-core.js');

const tokenRules = [
  { name: 'WS', pattern: '\\s+', skip: true },
  { name: 'NUMBER', pattern: '[0-9]+' },
  { name: 'PLUS', pattern: '\\+' },
  { name: 'MINUS', pattern: '-' },
  { name: 'STAR', pattern: '\\*' },
  { name: 'POWER', pattern: '\\^' },
  { name: 'LPAREN', pattern: '\\(' },
  { name: 'RPAREN', pattern: '\\)' },
];
const grammar = 'Expr = Term { (PLUS | MINUS) Term };\nTerm = Atom { STAR Atom };\nAtom = NUMBER | LPAREN Expr RPAREN;';
const ast = {
  discardTokens: ['LPAREN', 'RPAREN'],
  inlineRules: ['Atom'],
  foldRules: { Expr: 'left', Term: 'left' },
};
const expression = (source, overrides = {}) => compile({ tokenRules, grammar, source, ast, ...overrides });
const treeShape = node => ({ type: node.type, ...(node.value === undefined ? {} : { value: node.value }), children: node.children.map(treeShape) });
const number = value => ({ type: 'NUMBER', value, children: [] });
const binary = (operator, left, right) => ({ type: 'BinaryExpression', value: operator, children: [left, right] });

function failure(result, stage, code) {
  assert.equal(result.ok, false);
  assert.equal(result.ast, null);
  assert.equal(result.diagnostics[0].stage, stage);
  if (code) assert.equal(result.diagnostics[0].code, code);
  return result.diagnostics[0];
}

test('tokenization retains source spans while skipping multiline whitespace', () => {
  const result = expression(' 12 +\n  3');
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.tokens.map(({ type, value, start, end, line, column }) => ({ type, value, start, end, line, column })), [
    { type: 'NUMBER', value: '12', start: 1, end: 3, line: 1, column: 2 },
    { type: 'PLUS', value: '+', start: 4, end: 5, line: 1, column: 5 },
    { type: 'NUMBER', value: '3', start: 8, end: 9, line: 2, column: 3 },
  ]);
});

test('the standalone browser build exposes the same API without DOM or module-loader dependencies', () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../../js/compiler-lab-core.js'), 'utf8'), context);
  const result = context.CompilerLabCore.compile({ tokenRules, grammar, source: '2+3*4', ast });
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(treeShape(result.ast)), JSON.stringify(binary('+', number('2'), binary('*', number('3'), number('4')))));
});

test('longest token wins and rule order resolves equal-length keyword matches', () => {
  const rules = [
    { name: 'IF', pattern: 'if' },
    { name: 'ID', pattern: '[a-z]+' },
    { name: 'EQ', pattern: '=' },
    { name: 'EQUAL', pattern: '==' },
    { name: 'WS', pattern: '\\s+', skip: true },
  ];
  const result = compile({ tokenRules: rules, grammar: 'S = IF ID EQUAL EQ;', source: 'if iffy == =' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.tokens.map(token => [token.type, token.value]), [['IF', 'if'], ['ID', 'iffy'], ['EQUAL', '=='], ['EQ', '=']]);
});

test('longest matching prefix also wins within alternatives and lazy quantifiers', () => {
  for (const pattern of ['a|aa', 'a+?']) {
    const result = compile({ tokenRules: [{ name: 'A', pattern }], grammar: 'S = A;', source: 'aa' });
    assert.equal(result.ok, true, pattern);
    assert.deepEqual(result.tokens.map(token => token.value), ['aa']);
  }
});

test('prefix matching never treats a newline after a token as part of that token', () => {
  const result = expression('12\n');
  assert.equal(result.ok, true);
  assert.deepEqual(result.tokens.map(token => [token.value, token.end]), [['12', 2]]);
});

test('Unicode token matching does not split a source character into surrogate-half tokens', () => {
  const result = compile({
    tokenRules: [{ name: 'HIGH', pattern: '\\uD83D' }, { name: 'LOW', pattern: '\\uDE00' }],
    grammar: 'S = HIGH LOW;', source: '😀',
  });
  const diagnostic = failure(result, 'lexical', 'UNRECOGNIZED_CHARACTER');
  assert.deepEqual([diagnostic.start, diagnostic.end], [0, 2]);
  assert.match(diagnostic.message, /😀/);
});

test('Unicode tokens keep UTF-16 offsets and columns without losing whole characters', () => {
  const result = compile({ tokenRules: [{ name: 'CHAR', pattern: '.' }], grammar: 'S = CHAR CHAR;', source: '😀x' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.tokens.map(({ value, start, end, column }) => [value, start, end, column]), [['😀', 0, 2, 1], ['x', 2, 3, 3]]);
});

test('grammar levels produce precedence while projection removes concrete scaffolding', () => {
  const result = expression('2 + 3 * 4');
  assert.equal(result.ok, true);
  assert.deepEqual(treeShape(result.ast), binary('+', number('2'), binary('*', number('3'), number('4'))));
  assert.equal(result.parseTree.type, 'Expr');
  assert.deepEqual(result.parseTree.children.map(node => node.type), ['Term', 'PLUS', 'Term']);
  assert.deepEqual([result.ast.start, result.ast.end], [0, 9]);
});

test('parentheses remain in the concrete tree but control the projected AST', () => {
  const result = expression('(2 + 3) * 4');
  assert.equal(result.ok, true);
  assert.deepEqual(treeShape(result.ast), binary('*', binary('+', number('2'), number('3')), number('4')));
  assert.match(JSON.stringify(result.parseTree), /LPAREN/);
  assert.doesNotMatch(JSON.stringify(result.ast), /LPAREN|RPAREN|Atom|Term/);
});

test('left and right folds encode different associativity for a three-operand chain', () => {
  assert.deepEqual(treeShape(expression('9 - 3 - 1').ast), binary('-', binary('-', number('9'), number('3')), number('1')));
  const result = expression('2 ^ 3 ^ 4', {
    grammar: 'Power = NUMBER { POWER NUMBER };',
    ast: { foldRules: { Power: 'right' } },
  });
  assert.deepEqual(treeShape(result.ast), binary('^', number('2'), binary('^', number('3'), number('4'))));
});

test('CFG alternatives reconsider a short successful branch when following input needs a longer one', () => {
  const result = expression('1+2', { grammar: 'S = Choice NUMBER; Choice = NUMBER | NUMBER PLUS;', ast: {} });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.parseTree.children[0].children.map(node => node.type), ['NUMBER', 'PLUS']);
});

test('optional groups and repetitions handle zero, one, and several occurrences', () => {
  const listGrammar = 'List = [ NUMBER { PLUS NUMBER } ];';
  for (const source of ['', '4', '4+5+6']) {
    const result = expression(source, { grammar: listGrammar, ast: {} });
    assert.equal(result.ok, true, source || 'empty list');
    assert.equal(result.parseTree.children.length, source ? source.length : 0);
  }
});

test('quoted terminals match token values and an explicit start rule selects a production', () => {
  const result = expression('3+4', { grammar: 'Single = NUMBER; Sum = NUMBER "+" NUMBER;', startRule: 'Sum', ast: {} });
  assert.equal(result.ok, true);
  assert.equal(result.parseTree.type, 'Sum');
  assert.deepEqual(result.parseTree.children.map(node => node.type), ['NUMBER', 'PLUS', 'NUMBER']);
});

test('grammar comments, single-quoted terminals, and escaped quotes keep their literal meaning', () => {
  const result = compile({
    tokenRules: [{ name: 'QUOTE', pattern: '"' }, { name: 'SLASHES', pattern: '//' }],
    grammar: '# Beginning\nS = \'"\' "//" "\\\""; // Ending',
    source: '"//"',
  });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.tokens.map(token => token.value), ['"', '//', '"']);
});

test('right-recursive rules parse nested structures without synthetic EBNF nodes', () => {
  const result = expression('((2))', { grammar: 'Nested = NUMBER | "(" Nested ")";', ast: {} });
  assert.equal(result.ok, true);
  assert.equal(result.parseTree.children[1].children[1].children[0].value, '2');
});

test('all complete parses are returned instead of quietly selecting one alternative', () => {
  const result = expression('1+2', { grammar: 'S = A | B | C; A = NUMBER PLUS NUMBER; B = NUMBER PLUS NUMBER; C = NUMBER PLUS NUMBER;', ast: {} });
  assert.equal(result.ok, true);
  assert.deepEqual(result.parseTrees.map(tree => tree.children[0].type), ['A', 'B', 'C']);
  assert.deepEqual(result.asts.map(tree => tree.children[0].type), ['A', 'B', 'C']);
  assert.deepEqual(result.astParseTreeIndices, [[0], [1], [2]]);
  assert.equal(result.ast, result.asts[0]);
  assert.equal(result.parseTree, result.parseTrees[0]);
});

test('different concrete derivations sharing one AST are deduplicated with a complete correspondence', () => {
  const result = expression('1', { grammar: 'S = [NUMBER] [NUMBER];', ast: {} });
  assert.equal(result.ok, true);
  assert.equal(result.parseTrees.length, 2);
  assert.equal(result.asts.length, 1);
  assert.deepEqual(result.astParseTreeIndices, [[0, 1]]);
});

test('different repetition partitions are all returned', () => {
  const result = expression('1+2', { grammar: 'S = { NUMBER | PLUS | NUMBER PLUS };', ast: {} });
  assert.equal(result.ok, true);
  assert.equal(result.parseTrees.length, 2);
  assert.equal(result.asts.length, 1);
});

test('one source can produce distinct left- and right-grouped ASTs', () => {
  const result = expression('1+2+3', {
    grammar: 'S = Left | Right; Left = Pair PLUS NUMBER; Right = NUMBER PLUS Pair; Pair = NUMBER PLUS NUMBER;',
    ast: { inlineRules: ['S'], foldRules: { Left: 'left', Right: 'left', Pair: 'left' } },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.asts.map(treeShape), [
    binary('+', binary('+', number('1'), number('2')), number('3')),
    binary('+', number('1'), binary('+', number('2'), number('3'))),
  ]);
});

test('AST projection may erase different production names without losing the concrete alternatives', () => {
  const result = expression('7', { grammar: 'S = A | B; A = NUMBER; B = NUMBER;', ast: { inlineRules: ['S', 'A', 'B'] } });
  assert.equal(result.ok, true);
  assert.deepEqual(result.asts.map(treeShape), [number('7')]);
  assert.deepEqual(result.parseTrees.map(tree => tree.children[0].type), ['A', 'B']);
  assert.deepEqual(result.astParseTreeIndices, [[0, 1]]);
});

test('AST uniqueness ignores different source spans on otherwise identical empty nodes', () => {
  const result = expression('7', { grammar: 'S = Left Right; Left = [NUMBER]; Right = [NUMBER];', ast: { discardTokens: ['NUMBER'] } });
  assert.equal(result.ok, true);
  assert.equal(result.parseTrees.length, 2);
  assert.equal(result.asts.length, 1);
  assert.deepEqual(result.astParseTreeIndices, [[0, 1]]);
});

test('nullable rules can appear in a sequence and do not consume a following token', () => {
  const result = expression('2', { grammar: 'S = Empty NUMBER; Empty = "";', ast: {} });
  assert.equal(result.ok, true);
  assert.deepEqual(result.parseTree.children.map(node => node.type), ['Empty', 'NUMBER']);
  assert.deepEqual(result.parseTree.children[0].children, []);
});

test('all combinations of nullable alternatives survive completion before later waiters', () => {
  const result = expression('', { grammar: 'S = Empty Empty; Empty = "" | "";', ast: {} });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.parseTrees.length, 4);
  assert.equal(result.asts.length, 1);
  assert.deepEqual(result.astParseTreeIndices, [[0, 1, 2, 3]]);
  assert.deepEqual(treeShape(result.ast), { type: 'S', children: [
    { type: 'Empty', children: [] }, { type: 'Empty', children: [] },
  ] });
});

test('nullable bases with consuming left and right recursion retain each placement', () => {
  const result = expression('++', { grammar: 'S = S PLUS | PLUS S | "";', ast: {} });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.parseTrees.length, 4);
  assert.equal(result.asts.length, 4);
});

test('an empty tokenizer can parse an epsilon-only language and rejects nonempty input lexically', () => {
  const options = { tokenRules: [], grammar: 'S = "";', source: '' };
  const result = compile(options);
  assert.equal(result.ok, true);
  assert.deepEqual(result.tokens, []);
  assert.deepEqual(result.asts.map(treeShape), [{ type: 'S', children: [] }]);
  failure(compile({ ...options, source: 'x' }), 'lexical', 'UNRECOGNIZED_CHARACTER');
});

test('incomplete parses identify the first unexpected token and keep the token stream', () => {
  const result = expression('1 + * 2');
  const diagnostic = failure(result, 'syntax', 'UNEXPECTED_TOKEN');
  assert.deepEqual([diagnostic.start, diagnostic.line, diagnostic.column], [4, 1, 5]);
  assert.equal(result.tokens.length, 4);
  assert.match(diagnostic.message, /NUMBER|LPAREN/);
});

test('missing final operands and trailing input never count as successful parses', () => {
  const end = failure(expression('1 +\n'), 'syntax');
  assert.deepEqual([end.start, end.line, end.column], [4, 2, 1]);
  const extra = failure(expression('1 2'), 'syntax');
  assert.equal(extra.start, 2);
});

test('lexical failures report the unmatched source position without a partial AST', () => {
  const result = expression('1 +\n @');
  const diagnostic = failure(result, 'lexical', 'UNRECOGNIZED_CHARACTER');
  assert.deepEqual([diagnostic.start, diagnostic.end, diagnostic.line, diagnostic.column], [5, 6, 2, 2]);
});

test('malformed and empty-matching token patterns are diagnosed before parsing', () => {
  failure(expression('1', { tokenRules: [{ name: 'NUMBER', pattern: '[' }] }), 'tokenRules', 'INVALID_REGEX');
  failure(expression('1', { tokenRules: [{ name: 'NUMBER', pattern: '[0-9]*' }] }), 'tokenRules', 'EMPTY_TOKEN_MATCH');
});

test('context-dependent regex assertions and backreferences are rejected explicitly', () => {
  for (const pattern of ['(?=1)', '^1', '1$', '(a)\\1', '\\bword\\b']) {
    failure(expression('1', { tokenRules: [{ name: 'BAD', pattern }, ...tokenRules] }), 'tokenRules', 'UNSUPPORTED_REGEX');
  }
});

test('invalid grammar syntax points into the grammar rather than the source program', () => {
  const diagnostic = failure(expression('1', { grammar: 'S = NUMBER;\nBroken NUMBER;' }), 'grammar', 'INVALID_GRAMMAR');
  assert.deepEqual([diagnostic.line, diagnostic.column], [2, 8]);
});

test('undefined, duplicate, and colliding names are grammar diagnostics', () => {
  failure(expression('1', { grammar: 'S = Missing;' }), 'grammar', 'UNDEFINED_SYMBOL');
  failure(expression('1', { grammar: 'S = NUMBER; S = NUMBER;' }), 'grammar', 'DUPLICATE_RULE');
  failure(expression('1', { grammar: 'NUMBER = "1";' }), 'grammar', 'NAME_COLLISION');
  failure(expression('1', { startRule: 'Absent' }), 'grammar', 'UNKNOWN_START_RULE');
});

test('direct and indirect left recursion retain all consuming derivations', () => {
  for (const recursive of ['S = S PLUS NUMBER | NUMBER;', 'S = A PLUS NUMBER | NUMBER; A = S;']) {
    const result = expression('1+2+3', { grammar: recursive, ast: {} });
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.equal(result.parseTrees.length, 1);
    assert.deepEqual(result.tokens.map(token => token.value), ['1', '+', '2', '+', '3']);
  }
});

test('productive rule cycles over the same span are rejected as infinitely ambiguous', () => {
  for (const recursive of ['S = S | NUMBER;', 'S = A; A = S | NUMBER;', 'S = [PLUS] S | NUMBER;', 'S = S Empty | NUMBER; Empty = "";']) {
    failure(expression('1', { grammar: recursive, ast: {} }), 'grammar', 'CYCLIC_DERIVATION');
  }
});

test('unproductive cycles terminate with a syntax diagnostic instead of looping', () => {
  failure(expression('1', { grammar: 'S = A; A = S;', ast: {} }), 'syntax', 'UNEXPECTED_TOKEN');
  const result = expression('1', { grammar: 'S = Dead | NUMBER; Dead = Dead;', ast: {} });
  assert.equal(result.ok, true);
  assert.equal(result.parseTrees.length, 1);
  assert.deepEqual(treeShape(result.ast), { type: 'S', children: [number('1')] });
});

const lectureTokens = [
  { name: 'IDENTIFIER', pattern: '[a-z]+' },
  { name: 'LITERAL_NUM', pattern: '[0-9]+' },
  { name: 'ADD_SUB', pattern: '[+-]' },
  { name: 'MUL_DIV', pattern: '[*/]' },
  { name: 'DELIM_LPAREN', pattern: '\\(' },
  { name: 'DELIM_RPAREN', pattern: '\\)' },
];
const ambiguousLecture = 'expr = expr operator expr | IDENTIFIER | LITERAL_NUM; operator = ADD_SUB | MUL_DIV;';
const lectureLeaf = (type, value) => ({ type, value, children: [] });
const identifier = value => lectureLeaf('IDENTIFIER', value);
const literal = value => lectureLeaf('LITERAL_NUM', value);

test('the lecture unfactored expression grammar reveals both precedence interpretations', () => {
  const result = compile({ tokenRules: lectureTokens, grammar: ambiguousLecture, source: 'x+3*7',
    ast: { inlineRules: ['operator'], foldRules: { expr: 'left' } } });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.parseTrees.length, 2);
  assert.deepEqual(new Set(result.asts.map(tree => JSON.stringify(treeShape(tree)))), new Set([
    binary('*', binary('+', identifier('x'), literal('3')), literal('7')),
    binary('+', identifier('x'), binary('*', literal('3'), literal('7'))),
  ].map(tree => JSON.stringify(tree))));
  assert.deepEqual(result.astParseTreeIndices.flat().sort(), [0, 1]);
});

test('the lecture unfactored grammar reveals both associations for subtraction', () => {
  const result = compile({ tokenRules: lectureTokens, grammar: ambiguousLecture, source: 'x-y-z',
    ast: { inlineRules: ['operator'], foldRules: { expr: 'left' } } });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.parseTrees.length, 2);
  assert.deepEqual(new Set(result.asts.map(tree => JSON.stringify(treeShape(tree)))), new Set([
    binary('-', binary('-', identifier('x'), identifier('y')), identifier('z')),
    binary('-', identifier('x'), binary('-', identifier('y'), identifier('z'))),
  ].map(tree => JSON.stringify(tree))));
});

test('the lecture factored grammar chooses precedence and parentheses override it', () => {
  const factored = 'expr = term {add_sub_op term}; term = factor {mul_div_op factor}; factor = IDENTIFIER | LITERAL_NUM | DELIM_LPAREN expr DELIM_RPAREN; add_sub_op = ADD_SUB; mul_div_op = MUL_DIV;';
  const policy = { discardTokens: ['DELIM_LPAREN', 'DELIM_RPAREN'], inlineRules: ['factor', 'add_sub_op', 'mul_div_op'], foldRules: { expr: 'left', term: 'left' } };
  for (const [source, expected] of [
    ['x+3*7', binary('+', identifier('x'), binary('*', literal('3'), literal('7')))],
    ['(x+3)*7', binary('*', binary('+', identifier('x'), literal('3')), literal('7'))],
    ['x-y-z', binary('-', binary('-', identifier('x'), identifier('y')), identifier('z'))],
  ]) {
    const result = compile({ tokenRules: lectureTokens, grammar: factored, source, ast: policy });
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.equal(result.parseTrees.length, 1);
    assert.deepEqual(result.asts.map(treeShape), [expected]);
  }
});

test('automatic trees support either chapter grammar without preset production names', () => {
  const factored = 'sum = product {add product}; product = primary {multiply primary}; primary = IDENTIFIER | LITERAL_NUM | DELIM_LPAREN sum DELIM_RPAREN; add = ADD_SUB; multiply = MUL_DIV;';
  const examples = [
    { grammar: ambiguousLecture, source: 'x+3*7', expected: [
      binary('*', binary('+', identifier('x'), literal('3')), literal('7')),
      binary('+', identifier('x'), binary('*', literal('3'), literal('7'))),
    ] },
    { grammar: factored, source: 'x+3*7', expected: [binary('+', identifier('x'), binary('*', literal('3'), literal('7')))] },
    { grammar: factored, source: '(x+3)*7', expected: [binary('*', binary('+', identifier('x'), literal('3')), literal('7'))] },
    { grammar: factored, source: 'x-y-z', expected: [binary('-', binary('-', identifier('x'), identifier('y')), identifier('z'))] },
    { grammar: factored, source: 'x-(y-z)', expected: [binary('-', identifier('x'), binary('-', identifier('y'), identifier('z')))] },
  ];
  for (const example of examples) {
    const result = compile({ tokenRules: lectureTokens, grammar: example.grammar, source: example.source, ast: 'auto' });
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(new Set(result.asts.map(tree => JSON.stringify(treeShape(tree)))),
      new Set(example.expected.map(tree => JSON.stringify(tree))), example.source);
  }
});

test('automatic arithmetic follows renamed tokenizer rules and quoted operators', () => {
  const result = compile({ tokenRules: [
    { name: 'DIGITS', pattern: '[0-9]+' }, { name: 'SYMBOL', pattern: '[+*()]' },
  ], grammar: 'formula = atom { "+" atom }; atom = DIGITS | "(" formula ")";', source: '(2+3)+7', ast: 'auto' });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  const digit = value => lectureLeaf('DIGITS', value);
  assert.deepEqual(result.asts.map(treeShape), [binary('+', binary('+', digit('2'), digit('3')), digit('7'))]);
});

test('automatic trees retain non-expression sequences without applying arithmetic to their children', () => {
  const result = compile({ tokenRules: [...tokenRules, { name: 'EQUALS', pattern: '=' }, { name: 'NAME', pattern: '[a-z]+' }],
    grammar: 'statement = NAME EQUALS sum; sum = atom {PLUS atom}; atom = NUMBER | LPAREN sum RPAREN;',
    source: 'x=(2+3)', ast: 'auto' });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.asts.map(treeShape), [{ type: 'statement', children: [
    lectureLeaf('NAME', 'x'), lectureLeaf('EQUALS', '='), { type: 'sum', children: [
      { type: 'atom', children: [lectureLeaf('LPAREN', '('), { type: 'sum', children: [
        { type: 'atom', children: [number('2')] }, lectureLeaf('PLUS', '+'), { type: 'atom', children: [number('3')] },
      ] }, lectureLeaf('RPAREN', ')')] },
    ] },
  ] }]);
});

test('automatic trees preserve lists, literal parentheses and empty productions', () => {
  const examples = [
    { grammar: 'list = { item }; item = LPAREN NUMBER RPAREN;', source: '(1)(2)', expected: { type: 'list', children: [
      { type: 'item', children: [lectureLeaf('LPAREN', '('), number('1'), lectureLeaf('RPAREN', ')')] },
      { type: 'item', children: [lectureLeaf('LPAREN', '('), number('2'), lectureLeaf('RPAREN', ')')] },
    ] } },
    { grammar: 'punctuation = LPAREN PLUS RPAREN;', source: '(+)', expected: { type: 'punctuation', children: [
      lectureLeaf('LPAREN', '('), lectureLeaf('PLUS', '+'), lectureLeaf('RPAREN', ')'),
    ] } },
    { grammar: 'single = LPAREN NUMBER RPAREN;', source: '(1)', expected: { type: 'single', children: [
      lectureLeaf('LPAREN', '('), number('1'), lectureLeaf('RPAREN', ')'),
    ] } },
    { grammar: 'empty = "";', source: '', expected: { type: 'empty', children: [] } },
  ];
  for (const example of examples) {
    const result = compile({ tokenRules, grammar: example.grammar, source: example.source, ast: 'auto' });
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(result.asts.map(treeShape), [example.expected], example.grammar);
  }
});

test('automatic trees retain all distinct alternatives for unfamiliar structures', () => {
  const result = expression('1', { grammar: 'value = count | size; count = NUMBER; size = NUMBER;', ast: 'auto' });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.asts.map(treeShape), [
    { type: 'value', children: [{ type: 'count', children: [number('1')] }] },
    { type: 'value', children: [{ type: 'size', children: [number('1')] }] },
  ]);
  assert.deepEqual(result.astParseTreeIndices, [[0], [1]]);
});

test('automatic mode still diagnoses invalid grammars and respects an explicitly selected start rule', () => {
  failure(expression('1', { grammar: 'newRoot = Unknown;', ast: 'auto' }), 'grammar', 'UNDEFINED_SYMBOL');
  failure(expression('1', { grammar: 'newRoot NUMBER;', ast: 'auto' }), 'grammar', 'INVALID_GRAMMAR');
  failure(expression('1+', { grammar: 'newRoot = NUMBER PLUS NUMBER;', ast: 'auto' }), 'syntax', 'UNEXPECTED_TOKEN');
  failure(expression('1', { grammar: 'newRoot = NUMBER;', startRule: 'Expr', ast: 'auto' }), 'grammar', 'UNKNOWN_START_RULE');
  const result = expression('1+2', { grammar: 'single = NUMBER; pair = NUMBER PLUS NUMBER;', startRule: 'pair', ast: 'auto' });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.asts.map(treeShape), [binary('+', number('1'), number('2'))]);
});

test('all five associations of a four-operand ambiguous expression are retained', () => {
  const result = expression('1+2+3+4', { grammar: 'S = S PLUS S | NUMBER;', ast: { foldRules: { S: 'left' } } });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.parseTrees.length, 5);
  assert.equal(result.asts.length, 5);
  assert.deepEqual(result.astParseTreeIndices.flat().sort(), [0, 1, 2, 3, 4]);
});

test('repetition whose body can match empty input is rejected as infinitely ambiguous', () => {
  failure(expression('', { grammar: 'S = { [NUMBER] };' }), 'grammar', 'NULLABLE_REPETITION');
});

test('invalid projection policies preserve the parse tree but cannot claim an AST', () => {
  const result = expression('1+2', { ast: { foldRules: { Expr: 'left' }, discardTokens: ['PLUS'] } });
  failure(result, 'ast', 'INVALID_FOLD');
  assert.equal(result.parseTree.type, 'Expr');
});

test('a policy-free result retains grammar productions without implicit arithmetic rules', () => {
  const result = expression('1+2', { ast: undefined });
  assert.equal(result.ok, true);
  assert.deepEqual(treeShape(result.ast), treeShape(result.parseTree));
});

test('calls are isolated and never mutate caller-owned rules or AST configuration', () => {
  const input = { tokenRules, grammar, source: '2+3', ast };
  const before = JSON.stringify(input);
  const first = compile(input);
  first.ast.children[0].value = 'changed';
  assert.equal(compile(input).ast.children[0].value, '2');
  assert.equal(JSON.stringify(input), before);
});

test('resource exhaustion is an explicit diagnostic rather than a truncated successful parse', () => {
  failure(expression('1'.repeat(100000)), 'limits', 'SOURCE_LIMIT');
  failure(expression('('.repeat(80) + '1' + ')'.repeat(80)), 'limits', 'PARSE_DEPTH_LIMIT');
});

test('a tiny grammar cannot expand empty productions into an unbounded output tree', () => {
  const doubling = Array.from({ length: 20 }, (_, index) => 'R' + index + ' = R' + (index + 1) + ' R' + (index + 1) + ';').join('\n');
  const result = expression('', { grammar: doubling + '\nR20 = "";', ast: {} });
  failure(result, 'limits', 'TREE_SIZE_LIMIT');
  assert.equal(result.parseTree, null);
});

test('a forest limit reports incompleteness instead of succeeding with omitted alternatives', () => {
  const result = expression('1 2 3 4 5 6 7 8', { grammar: 'S = { Choice }; Choice = A | B; A = NUMBER; B = NUMBER;', ast: {} });
  failure(result, 'limits', 'PARSE_FOREST_LIMIT');
  assert.equal(result.incomplete, true);
  assert.deepEqual(result.parseTrees, []);
  assert.deepEqual(result.asts, []);
  assert.deepEqual(result.astParseTreeIndices, []);
});

test('exactly 128 complete alternatives are retained at the forest boundary', () => {
  const result = expression('1 2 3 4 5 6 7', { grammar: 'S = { Choice }; Choice = A | B; A = NUMBER; B = NUMBER;', ast: {} });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.incomplete, false);
  assert.equal(result.parseTrees.length, 128);
  assert.equal(result.asts.length, 128);
  assert.equal(new Set(result.asts.map(tree => JSON.stringify(treeShape(tree)))).size, 128);
  assert.deepEqual(result.astParseTreeIndices.flat(), Array.from({ length: 128 }, (_, index) => index));
});

test('sparse JavaScript configuration arrays report diagnostics rather than throwing or ignoring missing entries', () => {
  failure(compile({ tokenRules: Array(1), grammar: 'S = "";', source: '' }), 'tokenRules', 'INVALID_TOKEN_RULE');
  failure(expression('1', { ast: { discardTokens: Array(1) } }), 'ast', 'INVALID_POLICY');
});

test('a flat repetition accepts the full token budget and preserves source order', () => {
  const source = 'ab'.repeat(256);
  const result = compile({ tokenRules: [{ name: 'CHAR', pattern: '[ab]' }], grammar: 'S = {CHAR};', source });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.parseTrees.length, 1);
  assert.equal(result.parseTree.children.map(node => node.value).join(''), source);
  assert.deepEqual(result.parseTree.children.map(node => node.start), Array.from({ length: source.length }, (_, index) => index));
});

test('wide nullable productions cannot exhaust memory by retaining large intermediate derivations', () => {
  const result = compile({ tokenRules: [], grammar: 'S = ' + 'Empty '.repeat(1900) + '; Empty = "";', source: '' });
  failure(result, 'limits', 'PARSE_STORAGE_LIMIT');
  assert.equal(result.incomplete, true);
  assert.deepEqual(result.parseTrees, []);
  assert.deepEqual(result.asts, []);
});

test('repetition enumerates every partition when its body can consume one or two tokens', () => {
  const partitions = count => count === 0 ? [[]] : [1, 2].filter(size => size <= count)
    .flatMap(size => partitions(count - size).map(tail => [size, ...tail]));
  for (let count = 0; count <= 10; count++) {
    const result = compile({ tokenRules: [{ name: 'N', pattern: 'a' }],
      grammar: 'S = {Atom}; Atom = N | N N;', source: 'a'.repeat(count) });
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    const expected = partitions(count).map(partition => JSON.stringify(partition));
    const actual = result.parseTrees.map(tree => JSON.stringify(tree.children.map(atom => atom.children.length)));
    assert.equal(actual.length, expected.length);
    assert.deepEqual(new Set(actual), new Set(expected));
  }
});
