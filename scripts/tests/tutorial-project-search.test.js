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

// --- Diagrams --------------------------------------------------------------
// The Diagram pane's loaded diagrams join the search as entries with
// kind 'diagram'. Only what the drawing shows is searched: labels, member
// and message texts, guards, and notes; never the @startuml/@enduml
// markers, the @layout block, element keywords, or aliases.

const { diagramText, textMatches } = require('../../js/tutorial-project-search.js');

const EVENTS = [
  '@startuml',
  'component OPC <<BackendService>> {',
  '  portout "order events" as opc_pub',
  '}',
  'participant web: TripWebsite',
  'opc_pub -- ex_in : binding order.placed',
  'note top of OPC',
  'Publishes every order event',
  'end note',
  '@layout',
  'OPC @pos(0, 470)',
  '@endlayout',
  '@enduml',
].join('\n');
const diagram = { path: 'diagram:events', content: EVENTS, kind: 'diagram', diagramId: 'events', label: 'Order events' };

test('a diagram result names its diagram instead of a file line', () => {
  const { results } = search([diagram], 'order events', {});
  assert.equal(results.length, 1);
  assert.equal(results[0].kind, 'diagram');
  assert.equal(results[0].diagramId, 'events');
  assert.equal(results[0].label, 'Order events');
  assert.equal(results[0].preview, 'order events', 'the preview shows the label, not the port syntax');
});

test('diagram search leaves out markers, the layout block, keywords, and aliases', () => {
  for (const syntax of ['@startuml', '@enduml', '@pos', '@layout', 'portout', 'component', 'opc_pub', 'ex_in', 'participant']) {
    assert.deepEqual(search([diagram], syntax, {}).results, [], syntax);
  }
});

test('diagram search reads names, message labels, lifelines, and notes', () => {
  assert.deepEqual(search([diagram], 'OPC', { matchCase: true }).results.map(result => result.preview), ['OPC «BackendService»']);
  assert.deepEqual(search([diagram], 'order.placed', {}).results.map(result => result.preview), ['binding order.placed']);
  assert.deepEqual(search([diagram], 'TripWebsite', {}).results.map(result => result.preview), ['web: TripWebsite']);
  assert.equal(search([diagram], 'Publishes every', {}).results.length, 1);
});

test('files and diagrams are searched together, files keep their results', () => {
  const { results } = search([...files, diagram], 'order.placed', {});
  assert.deepEqual(results.map(result => result.kind || 'file'), ['file', 'file', 'diagram']);
});

test('diagramText keeps one line per source line', () => {
  assert.equal(diagramText(EVENTS).split('\n').length, EVENTS.split('\n').length);
});

test('textMatches applies the same options as search', () => {
  assert.equal(textMatches('PartnerGateway', 'gateway', {}), true);
  assert.equal(textMatches('PartnerGateway', 'gateway', { matchCase: true }), false);
  assert.equal(textMatches('PartnerGateway', 'gateway', { wholeWord: true }), false);
  assert.equal(textMatches('place(order_id)', 'place\\(\\w+\\)', { regex: true }), true);
  assert.equal(textMatches('anything', '(', { regex: true }), false, 'an invalid pattern matches nothing');
  assert.equal(textMatches('anything', '', {}), false);
});

test('an association shows its multiplicities and role, not its ends or arrow', () => {
  const source = '@startuml\nclass TripOrder\nclass Fan\nTripOrder "0..*" --> "1" Fan : buyer\n@enduml';
  assert.equal(diagramText(source).split('\n')[3], '0..* 1 buyer');
});
