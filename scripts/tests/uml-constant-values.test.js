'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { evaluate, format, LoopFacts } = require('../../js/uml-constant-values.js');

test('shared folding follows integer precedence and local scalar bindings without side effects', () => {
  for (const language of ['python', 'java', 'cpp', 'typescript']) {
    const bindings = new Map([['start', 2]]);
    assert.equal(evaluate('(start + 1) * 2 - 3', { language, bindings }), 3);
    assert.equal(evaluate('-start + 3 * 2', { language, bindings }), 4);
    for (const source of ['++start', '--start', 'start++', 'start++ + 1', 'start-- - 1', 'start = 3', 'start += 1', 'run()', 'start / 2']) {
      assert.equal(evaluate(source, { language, bindings }), undefined, source);
    }
    assert.deepEqual([...bindings], [['start', 2]]);
  }
});

test('element lists retain order, duplicates, empty lists and literal values', () => {
  const cases = [
    ['python', "['book', 'pen', 'book']", ['book', 'pen', 'book']],
    ['typescript', '[1, 1 + 1, -3]', [1, 2, -3]],
    ['java', 'new String[] {"book", "pen"}', ['book', 'pen']],
    ['java', 'new int[][] {{1, 2}, {}}', [[1, 2], []]],
    ['cpp', 'std::vector<int> {1, 1 + 1}', [1, 2]],
    ['cpp', 'std::vector<std::string> {"book", "pen"}', ['book', 'pen']],
    ['cpp', 'std::list<bool> {true, false}', [true, false]],
    ['python', '[True, False, None]', [true, false, null]],
    ['typescript', '[]', []]
  ];
  for (const [language, source, expected] of cases) {
    const value = evaluate(source, { language });
    assert.deepEqual(value, expected, source);
    assert.equal(format(value), format(expected));
  }
  assert.deepEqual(evaluate('{1, 2}', { language: 'cpp', allowBraceSequence: true }), [1, 2]);
  assert.equal(format(['book', 'pen']), '["book", "pen"]');
});

test('unknown source constructs, constructors and numeric representations remain unknown', () => {
  const cases = [
    ['cpp', 'std::vector<int>(2, 1)'], ['cpp', 'std::vector<std::string>{1, 2}'],
    ['cpp', 'std::vector<bool>{1, 0}'], ['cpp', '[1, 2]'], ['cpp', "'a'"],
    ['java', 'new int[2]'], ['java', '[1, 2]'], ['java', "'a'"],
    ['typescript', 'new Array(2)'], ['typescript', '`book`'], ['typescript', '[,]'],
    ['python', '{1, 2}'], ['python', '(1, 2)'], ['python', 'f"{name}"'],
    ['python', 'r"a\\n"'], ['python', 'b"book"'], ['python', '[x for x in xs]']
  ];
  for (const language of ['python', 'java', 'cpp', 'typescript']) {
    for (const source of ['0x10', '010', '1.5', '9007199254740993', '2147483647 + 1 - 1', '-(-2147483647 - 1)', '1e20']) cases.push([language, source]);
  }
  for (const [language, source] of cases) assert.equal(evaluate(source, { language }), undefined, language + ': ' + source);
});

test('string escape handling preserves values and declines language-specific escapes', () => {
  for (const language of ['python', 'java', 'cpp', 'typescript']) {
    assert.equal(evaluate('"a\\n\\t\\\\\\\"b"', { language }), 'a\n\t\\"b');
    assert.equal(evaluate('"\\u0061"', { language }), undefined);
  }
});

test('JavaScript negative zero survives projection without introducing it into integer languages', () => {
  for (const expression of ['-0', '0 * -1']) {
    assert.equal(format(evaluate(expression, { language: 'typescript' })), '-0');
    for (const language of ['python', 'cpp', 'java']) assert.equal(format(evaluate(expression, { language })), '0');
  }
});

test('long, deeply nested, wide and expanding expressions stop within fixed budgets', () => {
  const language = 'python';
  for (const source of [' '.repeat(5000) + '1', '('.repeat(10000) + '1' + ')'.repeat(10000),
    '[' + Array(1000).fill('1').join(',') + ']', Array(1000).fill('1').join('+')]) {
    assert.equal(evaluate(source, { language }), undefined);
  }
  const bindings = new Map([['huge', Array(1000).fill(1)]]);
  assert.equal(evaluate('huge', { language, bindings }), undefined);
  assert.deepEqual(evaluate('[1, 2]', { language }), [1, 2], 'an over-budget request does not poison the next one');
});

test('loop evidence is discarded permanently when identical headers disagree', () => {
  const facts = new LoopFacts();
  facts.record('loop [for item in items]', [1, 2]);
  facts.record('loop [for item in items]', [1, 2]);
  assert.deepEqual(facts.toJSON(), [{ header: 'loop [for item in items]', iterable: '[1, 2]' }]);
  facts.record('loop [for item in items]', undefined);
  facts.record('loop [for item in items]', [1, 2]);
  assert.deepEqual(facts.toJSON(), []);
});
