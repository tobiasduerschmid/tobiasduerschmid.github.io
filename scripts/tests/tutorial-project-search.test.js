const test = require('node:test');
const assert = require('node:assert/strict');
const { search, MAX_RESULTS } = require('../../js/tutorial-project-search.js');

const BROKER = [
  '[exchange.orders]',
  'type = "topic"',
  '',
  '[[binding]]',
  'queue = "warehouse-etl"',
  'key = "#"',
  '',
  '[[binding]]',
  'queue = "partner-gateway"',
  'key = "order.placed"',
].join('\n');

const files = [
  { path: 'deploy/broker.toml', content: BROKER },
  { path: 'services/opc/orders.py', content: 'def place(order_id):\n    return bus.receivers("order.placed")\n' },
];

test('finds a binding key in a .toml file', () => {
  const { results, truncated, error } = search(files, 'partner-gateway', {});

  assert.equal(error, null);
  assert.equal(truncated, false);
  assert.equal(results.length, 1);
  assert.equal(results[0].path, 'deploy/broker.toml');
  assert.equal(results[0].line, 9);
  assert.equal(results[0].column, 10, 'columns are 1-based like editor positions');
  assert.equal(results[0].preview, 'queue = "partner-gateway"');
});

test('every occurrence is a result, in file and line order', () => {
  const { results } = search(files, 'order.placed', {});
  assert.deepEqual(results.map(result => [result.path, result.line]), [
    ['deploy/broker.toml', 10],
    ['services/opc/orders.py', 2],
  ]);
});

test('matching ignores case unless match case is on', () => {
  assert.equal(search(files, 'PARTNER', {}).results.length, 1);
  assert.equal(search(files, 'PARTNER', { matchCase: true }).results.length, 0);
});

test('whole-word excludes partial identifiers', () => {
  const code = [{ path: 'orders.py', content: 'order = place(order_id)\nreorder(order)\n' }];
  const { results } = search(code, 'order', { wholeWord: true });
  assert.deepEqual(results.map(result => [result.line, result.column]), [[1, 1], [2, 9]]);
});

test('a regular expression query matches by pattern', () => {
  const { results } = search(files, 'queue = "\\w+-gateway"', { regex: true });
  assert.deepEqual(results.map(result => result.line), [9]);
});

test('invalid regex reports an error', () => {
  const outcome = search(files, 'order.(placed', { regex: true });
  assert.deepEqual(outcome.results, []);
  assert.equal(outcome.truncated, false);
  assert.match(outcome.error, /regular expression/i);
});

test('without the regex option, pattern characters match literally', () => {
  const { results, error } = search(files, 'order.(placed', {});
  assert.equal(error, null);
  assert.deepEqual(results, []);
});

test('caps at 500 and sets truncated', () => {
  const many = [{ path: 'log.txt', content: Array.from({ length: MAX_RESULTS + 1 }, () => 'hit').join('\n') }];
  const capped = search(many, 'hit', {});
  assert.equal(MAX_RESULTS, 500);
  assert.equal(capped.results.length, 500);
  assert.equal(capped.truncated, true);

  const exact = search([{ path: 'log.txt', content: Array.from({ length: MAX_RESULTS }, () => 'hit').join('\n') }], 'hit', {});
  assert.equal(exact.results.length, 500);
  assert.equal(exact.truncated, false, 'exactly 500 matches are all shown');
});

test('an empty query finds nothing and reports no error', () => {
  assert.deepEqual(search(files, '', {}), { results: [], truncated: false, error: null });
});

test('the preview marks the match within long lines', () => {
  const long = 'x'.repeat(300) + ' needle ' + 'y'.repeat(300);
  const [result] = search([{ path: 'long.txt', content: long }], 'needle', {}).results;
  assert.equal(result.column, 302);
  assert.ok(result.preview.length < long.length, 'long lines are shortened around the match');
  assert.equal(result.preview.slice(result.matchStart, result.matchStart + result.matchLength), 'needle');
});
