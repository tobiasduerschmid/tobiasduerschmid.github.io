/* Compare SQLite result sets without prescribing the student's SQL syntax. */
(function (root) {
  'use strict';

  function sameRow(actual, expected, columns, tolerances) {
    return actual.length === expected.length && expected.every(function (value, index) {
      const candidate = actual[index];
      if (typeof value === 'number' && typeof candidate === 'number') {
        return Math.abs(candidate - value) <= (tolerances[columns[index]] ?? 1e-9);
      }
      return candidate === value;
    });
  }

  /**
   * Assert one result set with exactly the requested columns and rows.
   * Column labels are case-insensitive; cell types, NULL and duplicates matter.
   * Row order matters only with ordered:true. Numeric tolerances are per column.
   * Inputs are not changed. Throws a diagnostic Error on a mismatch.
   */
  function assertResult(results, expected) {
    if (results.length !== 1) throw new Error('Return exactly one query result.');
    const result = results[0];
    const columns = expected.columns;
    if (result.columns.length !== columns.length || result.columns.some(function (column, index) {
      return column.toLowerCase() !== columns[index].toLowerCase();
    })) {
      throw new Error('Expected columns in this order: ' + columns.join(', ') + '.');
    }
    if (result.values.length !== expected.values.length) {
      throw new Error('Expected ' + expected.values.length + ' rows; got ' + result.values.length + '.');
    }
    const remaining = result.values.slice();
    expected.values.forEach(function (row, index) {
      const matches = function (candidate) {
        return sameRow(candidate, row, columns, expected.tolerances || {});
      };
      const matchIndex = expected.ordered
        ? (matches(remaining[0]) ? 0 : -1)
        : remaining.findIndex(matches);
      if (matchIndex < 0) {
        throw new Error('Check the values' + (expected.ordered ? ' and order' : '') +
          ' for result row ' + (index + 1) + '.');
      }
      remaining.splice(matchIndex, 1);
    });
  }

  const api = { assertResult: assertResult };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SEBookSqlTestHelpers = api;
}(typeof self !== 'undefined' ? self : globalThis));
