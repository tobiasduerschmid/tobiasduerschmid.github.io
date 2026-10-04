const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const core = require('../../js/compiler-lab-core');
const adapter = require('../../js/compiler-tutorial-adapter');

const root = path.resolve(__dirname, '../..');
const doc = yaml.load(fs.readFileSync(path.join(root, '_data/tutorials/compilers.yml'), 'utf8'));
const configs = doc.steps.map(step => adapter.readConfig(step, filePath =>
  step.solution.files.find(file => file.path === filePath).content));

function setIdentifier(config, pattern) {
  config.tokenRules.find(rule => rule.name === 'IDENT').pattern = pattern;
}

function outcomes(index, config) {
  return doc.steps[index].tests.map(check => {
    const result = core.compile({ ...config, source: check.compiler.source ?? config.source });
    return { description: check.description, passed: adapter.assess(result, check.compiler), diagnostics: result.diagnostics };
  });
}

// Alternative solutions vary language definitions while preserving each lesson's output contract.
const alternatives = [
  [
    config => setIdentifier(config, '[a-zA-Z_][a-zA-Z_\\d]*'),
    config => setIdentifier(config, '[A-Za-z_]([A-Za-z_]|[0-9]){0,}')
  ],
  [
    config => { config.grammar = config.grammar.replace('expression = term { addop term } ;', 'expression = expression addop term | term ;'); },
    config => { config.grammar = config.grammar.replace('expression = term { addop term } ;', 'expression = term { ("+" | "-") term } ;'); }
  ],
  [
    config => { config.grammar = config.grammar.replace('factor = IDENT | NUMBER | LPAREN expression RPAREN ;', 'factor = ( IDENT | NUMBER | LPAREN expression RPAREN ) ;'); },
    config => { config.grammar = config.grammar.replace('LPAREN expression RPAREN', '"(" expression ")"'); }
  ],
  [
    config => { config.grammar = config.grammar.replace('program = assignment { SEMI assignment } ;', 'program = assignment { ";" assignment } ;'); },
    config => {
      config.grammar = config.grammar.replace('program = assignment { SEMI assignment } ;', 'program = statement { SEMI statement } ;\nstatement = assignment ;');
      config.ast.inlineRules.push('statement');
    }
  ]
];
const mutants = [
  [
    ['names without digits', config => setIdentifier(config, '[A-Za-z_]+')],
    ['names beginning with digits', config => setIdentifier(config, '[A-Za-z0-9_]+')],
    ['names without underscores', config => setIdentifier(config, '[A-Za-z][A-Za-z0-9]*')],
    ['underscores allowed only initially', config => setIdentifier(config, '[A-Za-z_][A-Za-z0-9]*')]
  ],
  [
    ['one operator level', config => { config.grammar = config.grammar.replace('expression = term { addop term } ;', 'expression = factor { operator factor } ;'); }],
    ['right-associative subtraction', config => { config.grammar = config.grammar.replace('expression = term { addop term } ;', 'expression = term [ addop expression ] ;'); }],
    ['reversed precedence', config => { config.grammar = config.grammar.replace('expression = term { addop term } ;', 'expression = term { STAR term } ;').replace('term = factor { STAR factor } ;', 'term = factor { addop factor } ;'); }]
  ],
  [
    ['only parenthesized numbers', config => { config.grammar = config.grammar.replace('LPAREN expression RPAREN', 'LPAREN NUMBER RPAREN'); }],
    ['only parenthesized products', config => { config.grammar = config.grammar.replace('LPAREN expression RPAREN', 'LPAREN term RPAREN'); }],
    ['an optional closing parenthesis', config => { config.grammar = config.grammar.replace('LPAREN expression RPAREN', 'LPAREN expression [ RPAREN ]'); }]
  ],
  [
    ['an empty program', config => { config.grammar = config.grammar.replace('program = assignment { SEMI assignment } ;', 'program = { assignment { SEMI assignment } } ;'); }],
    ['a two-statement maximum', config => { config.grammar = config.grammar.replace('program = assignment { SEMI assignment } ;', 'program = assignment [ SEMI assignment ] ;'); }],
    ['optional separators', config => { config.grammar = config.grammar.replace('program = assignment { SEMI assignment } ;', 'program = assignment { [ SEMI ] assignment } ;'); }],
    ['an optional trailing separator', config => { config.grammar = config.grammar.replace('program = assignment { SEMI assignment } ;', 'program = assignment { SEMI assignment } [ SEMI ] ;'); }]
  ]
];

configs.forEach((config, index) => {
  const step = doc.steps[index];
  test(step.title + ': model solution satisfies every authored behavior', () => {
    assert.deepEqual(outcomes(index, config).filter(row => !row.passed), []);
  });
  alternatives[index].forEach((alter, variant) => {
    test(step.title + ': equivalent solution ' + (variant + 1) + ' remains accepted', () => {
      const candidate = structuredClone(config);
      alter(candidate);
      assert.deepEqual(outcomes(index, candidate).filter(row => !row.passed), []);
    });
  });
  mutants[index].forEach(([label, mutate]) => {
    test(step.title + ': checks reject ' + label, () => {
      const candidate = structuredClone(config);
      mutate(candidate);
      assert.ok(outcomes(index, candidate).some(row => !row.passed), 'Incorrect behavior must fail a criterion');
    });
  });
  test(step.title + ': starter leaves meaningful work while retaining partial progress', () => {
    const starter = adapter.readConfig(step, filePath => step.files.find(file => file.path === filePath).content);
    const rows = outcomes(index, starter);
    assert.ok(rows.some(row => !row.passed), 'An unsolved starter must not earn full completion');
    assert.ok(rows.some(row => row.passed), 'Already-correct behavior should remain visible');
  });
});

test('conditional hints have valid JavaScript regex predicates', () => {
  const conditions = new Set(doc.steps.flatMap(step => step.tests.flatMap(check => check.hints.map(hint => hint.condition))));
  for (const condition of conditions) {
    const match = condition?.match(/^(?:source|code)_(?:not_)?matches:\s*(.*)$/);
    if (!match) continue;
    const delimited = match[1].match(/^\/(.*)\/([a-z]*)$/);
    assert.doesNotThrow(() => new RegExp(delimited ? delimited[1] : match[1], delimited ? delimited[2] : ''), condition);
  }
});

function matchingHintIndices(check, source) {
  return check.hints.flatMap((hint, index) => {
    const match = hint.condition.match(/^source_matches: \/(.*)\/([a-z]*)$/);
    assert.ok(match, 'This hint profile must declare an executable source regex');
    return new RegExp(match[1], match[2]).test(source) ? [index] : [];
  });
}

function hintSource(config) {
  return JSON.stringify({ tokenRules: config.tokenRules, ast: config.ast, startRule: config.startRule }, null, 2)
    + '\n' + config.grammar + '\n' + config.source;
}

// Distinct attempts exercise the promised feedback progression without making source form a grading rule.
const hintAttempts = [
  {
    partial: config => setIdentifier(config, '[A-Za-z_]*'),
    developed: config => setIdentifier(config, '[A-Za-z0-9_]+'),
    removed: config => { config.tokenRules = config.tokenRules.filter(rule => rule.name !== 'IDENT'); }
  },
  {
    partial: config => { config.grammar = config.grammar.replace(/^expression[^;]*;/m, 'expression = factor { operator factor } ;'); },
    developed: config => { config.grammar = config.grammar.replace(/^expression[^;]*;/m, 'expression = term [ addop term ] ;'); },
    removed: config => { config.grammar = config.grammar.replace(/^expression[^;]*;/m, ''); }
  },
  {
    partial: config => { config.grammar = config.grammar.replace(/^factor[^;]*;/m, 'factor = IDENT | NUMBER | LPAREN term RPAREN ;'); },
    developed: config => { config.grammar = config.grammar.replace(/^factor[^;]*;/m, 'factor = IDENT | NUMBER | LPAREN expression [ RPAREN ] ;'); },
    removed: config => { config.grammar = config.grammar.replace(/^factor[^;]*;/m, ''); }
  },
  {
    partial: config => { config.grammar = config.grammar.replace(/^program[^;]*;/m, 'program = assignment SEMI assignment ;'); },
    developed: config => { config.grammar = config.grammar.replace(/^program[^;]*;/m, 'program = { assignment SEMI } ;'); },
    removed: config => { config.grammar = config.grammar.replace(/^program[^;]*;/m, ''); }
  }
];

for (const [index, step] of doc.steps.entries()) {
  test(step.title + ': each criterion offers progressive feedback for actual attempt states', () => {
    const starter = adapter.readConfig(step, filePath => step.files.find(file => file.path === filePath).content);
    for (const check of step.tests) {
      assert.ok(check.hints.length >= 3, check.description + ' needs three useful levels of support');
      assert.deepEqual(matchingHintIndices(check, hintSource(starter)), [0], 'The starter should receive an initial orientation');
      for (const [state, expected] of [['partial', 1], ['developed', 2], ['removed', 0]]) {
        const candidate = structuredClone(starter);
        hintAttempts[index][state](candidate);
        assert.deepEqual(matchingHintIndices(check, hintSource(candidate)), [expected], check.description + ': ' + state);
      }
    }
  });
}

test('shorthand identifier regexes retain authored help without changing grading', () => {
  const candidate = structuredClone(configs[0]);
  setIdentifier(candidate, '[A-Za-z_]\\w*');
  assert.deepEqual(outcomes(0, candidate).filter(row => !row.passed), []);
  for (const pattern of ['[A-Za-z_][A-Za-z_\\d]*', '[\\dA-Za-z_]+']) {
    setIdentifier(candidate, pattern);
    for (const check of doc.steps[0].tests) {
      assert.equal(matchingHintIndices(check, hintSource(candidate)).length, 1,
        'A shorthand pattern must still select one authored feedback state');
    }
  }
});

test('the expression exploration exposes both distinct precedence interpretations', () => {
  const step = doc.steps.find(item => item.key === 'go-precedence');
  const config = adapter.readConfig(step, filePath => step.files.find(file => file.path === filePath).content);
  const operand = (type, value) => ({ type, value, children: [] });
  const operation = (value, left, right) => ({ type: 'BinaryExpression', value, children: [left, right] });
  const name = operand('IDENT', 'base');
  const three = operand('NUMBER', '3');
  const seven = operand('NUMBER', '7');
  const result = core.compile(config);
  assert.ok(adapter.assess(result, { asts: [
    operation('+', name, operation('*', three, seven)),
    operation('*', operation('+', name, three), seven)
  ] }), JSON.stringify(result.diagnostics));
  assert.equal(result.incomplete, false);
});

test('supplied reserved-word rules reject keywords while preserving longer names', () => {
  const config = configs[3];
  assert.ok(adapter.assess(core.compile({ ...config, source: 'for = 3' }), { error: 'syntax' }));
  const result = core.compile({ ...config, source: 'format2 = 3' });
  assert.equal(result.ok, true);
  assert.equal(result.tokens[0].type, 'IDENT');
  assert.equal(result.tokens[0].value, 'format2');
});

test('the supported decimal literal fragment does not silently reinterpret Go octal syntax', () => {
  const config = configs[3];
  assert.equal(core.compile({ ...config, source: 'total = 0' }).ok, true);
  assert.ok(adapter.assess(core.compile({ ...config, source: 'total = 07' }), { error: 'syntax' }));
  assert.ok(adapter.assess(core.compile({ ...config, source: 'total = 1_000' }), { error: 'syntax' }));
});

const chapterSource = fs.readFileSync(path.join(root, 'SEBook/tools/compilers.md'), 'utf8');
const chapter = yaml.load(chapterSource.split('---')[1]);
test('both chapter examples use the same Go identifier and literal fragment', () => {
  for (const config of [chapter.compiler_ambiguity, chapter.compiler_lab]) {
    assert.equal(core.compile({ ...config, source: '_total2 + 0' }).ok, true);
    assert.ok(adapter.assess(core.compile({ ...config, source: 'for + 1' }), { error: 'syntax' }));
    assert.ok(adapter.assess(core.compile({ ...config, source: 'x + 07' }), { error: 'syntax' }));
  }
});

const identifier = value => ({ type: 'IDENTIFIER', value, children: [] });
const literal = value => ({ type: 'LITERAL_NUM', value, children: [] });
const binary = (value, left, right) => ({ type: 'BinaryExpression', value, children: [left, right] });

const chapterCases = [
  {
    label: 'the original grammar exposes both precedence interpretations',
    config: chapter.compiler_ambiguity,
    source: 'x + 3 * 7',
    asts: [
      binary('+', identifier('x'), binary('*', literal('3'), literal('7'))),
      binary('*', binary('+', identifier('x'), literal('3')), literal('7'))
    ]
  },
  {
    label: 'the original grammar exposes both subtraction groupings',
    config: chapter.compiler_ambiguity,
    source: 'x - y - z',
    asts: [
      binary('-', binary('-', identifier('x'), identifier('y')), identifier('z')),
      binary('-', identifier('x'), binary('-', identifier('y'), identifier('z')))
    ]
  },
  {
    label: 'the factored grammar preserves only multiplication precedence',
    config: chapter.compiler_lab,
    source: 'x + 3 * 7',
    asts: [binary('+', identifier('x'), binary('*', literal('3'), literal('7')))]
  },
  {
    label: 'the declared left fold gives the unparenthesized subtraction chain one tree',
    config: chapter.compiler_lab,
    source: 'x - y - z',
    asts: [binary('-', binary('-', identifier('x'), identifier('y')), identifier('z'))]
  },
  {
    label: 'explicit parentheses preserve right nesting despite the left fold',
    config: chapter.compiler_lab,
    source: 'x - (y - z)',
    asts: [binary('-', identifier('x'), binary('-', identifier('y'), identifier('z')))]
  },
  {
    label: 'a parenthesized expression forms a multiplication factor',
    config: chapter.compiler_lab,
    source: '(x + 3) * 7',
    asts: [binary('*', binary('+', identifier('x'), literal('3')), literal('7'))]
  }
];

for (const { label, config, source, asts } of chapterCases) {
  test('chapter: ' + label, () => {
    const result = core.compile({ ...config, source });
    assert.ok(adapter.assess(result, { asts }), JSON.stringify(result.diagnostics));
    assert.equal(result.incomplete, false);
  });
}
