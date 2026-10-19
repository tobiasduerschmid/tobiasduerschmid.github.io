'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function check(actual, expected) {
  return require('../../js/sql-test-helpers').assertResult(actual, expected);
}

const report = {
  columns: ['major', 'avg_gpa', 'n'],
  values: [['CS', 3.533333333333333, 3], ['Math', 3.25, 2]],
  ordered: true,
  tolerances: { avg_gpa: 0.005 },
};

test('SQL results accept equivalent rows and explicitly permitted rounding', () => {
  assert.doesNotThrow(() => check([{
    columns: ['MAJOR', 'avg_gpa', 'n'],
    values: [['CS', 3.53, 3], ['Math', 3.25, 2]],
  }], report));
});

test('SQL grading compares each number to its own column, including every group', () => {
  for (const values of [
    [['CS', 35.33333333333333, 3], ['Math', 32.5, 2]],
    [['CS', 3.533333333333333, 3], ['Math', 3.5, 2]],
    [['CS', 3, 3.533333333333333], ['Math', 2, 3.25]],
    [['CS', '3.53', 3], ['Math', 3.25, 2]],
  ]) {
    assert.throws(() => check([{ columns: report.columns, values }], report), /row|value/i);
  }
});

test('SQL grading enforces requested order but allows order-independent results', () => {
  const reversed = [{ columns: report.columns, values: [...report.values].reverse() }];
  assert.throws(() => check(reversed, report), /row|order/i);
  assert.doesNotThrow(() => check(reversed, { ...report, ordered: false }));
});

test('SQL grading preserves duplicate multiplicity and distinguishes NULL from text', () => {
  const expected = { columns: ['major'], values: [['CS'], ['CS'], [null]] };
  assert.doesNotThrow(() => check([{ columns: ['major'], values: [[null], ['CS'], ['CS']] }], expected));
  for (const values of [[['CS'], ['CS'], ['NULL']], [['CS'], [null], [null]], [['CS'], [null]]]) {
    assert.throws(() => check([{ columns: ['major'], values }], expected), /row|value/i);
  }
});

test('SQL grading rejects missing, extra or mislabeled output columns', () => {
  for (const columns of [['major', 'n', 'avg_gpa'], ['major', 'avg_gpa'], ['major', 'avg_gpa', 'n', 'id']]) {
    assert.throws(() => check([{ columns, values: report.values }], report), /column/i);
  }
});

test('SQL grading rejects empty output and extra result sets', () => {
  assert.throws(() => check([], report), /result|query/i);
  assert.throws(() => check([report, report], report), /result|query/i);
  assert.throws(() => check([{ columns: report.columns, values: [] }], report), /row/i);
});
