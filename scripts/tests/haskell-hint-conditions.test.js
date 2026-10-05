const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { tokenize } = require('../../js/haskell/syntax');

const tutorialDirectory = path.join(__dirname, '../../_data/tutorials');
const tutorials = new Map(['haskell', 'haskell-functions', 'haskell-data'].map(slug => [
  slug, yaml.load(fs.readFileSync(path.join(tutorialDirectory, slug + '.yml'), 'utf8')),
]));

// Match the tutorial condition contract without invoking a compiler or a DOM.
// The shared tokenizer preserves strings while excluding nested/line comments.
function codeWithoutComments(source) {
  let cursor = 0;
  const pieces = tokenize(source).map(token => {
    const gap = source.slice(cursor, token.offset).replace(/\S/g, ' ');
    cursor = token.offset + token.text.length;
    return gap + token.text;
  });
  pieces.push(source.slice(cursor).replace(/\S/g, ' '));
  return pieces.join('');
}

function applicableHints(check, source) {
  const code = codeWithoutComments(source);
  return check.hints.flatMap((hint, index) => {
    if (!hint.condition) return [index];
    const match = hint.condition.match(/^(source|code)_(contains|missing|matches|not_matches):\s*(.+)$/i);
    assert.ok(match, 'this source-progress fixture supports source/code conditions');
    const value = match[1].toLowerCase() === 'code' ? code : source;
    const operation = match[2].toLowerCase();
    const pattern = match[3].trim();
    let applies;
    if (operation === 'contains' || operation === 'missing') {
      applies = value.includes(pattern);
      if (operation === 'missing') applies = !applies;
    } else {
      const slashPattern = pattern.match(/^\/(.*)\/([a-z]*)$/);
      const regex = slashPattern ? new RegExp(slashPattern[1], slashPattern[2]) : new RegExp(pattern);
      applies = regex.test(value);
      if (operation === 'not_matches') applies = !applies;
    }
    return applies ? [index] : [];
  });
}

function stepFor(slug, key) {
  const step = tutorials.get(slug).steps.find(candidate => candidate.key === key);
  assert.ok(step, `the ${slug}/${key} lesson exists`);
  return step;
}

function starterSource(step) {
  return step.files.map(file => file.content || '').join('\n');
}

const unrelatedExample = `
hintExample :: [Int] -> [Int]
hintExample xs = filter even (map abs xs)
hintExampleWindow start count xs = drop start (take count xs)
hintExampleTotal bonus xs = sum xs + bonus
hintExampleFold xs = foldr (+) 0 xs
`;

for (const [slug, tutorial] of tutorials) {
  for (const step of tutorial.steps) {
    for (const check of step.tests) {
      test(`${slug}/${step.key}: ${check.description} starts with orientation despite example distractions`, () => {
        const starter = starterSource(step);
        assert.deepEqual(applicableHints(check, starter), [0], 'starter selects exactly the orientation hint');
        const solutionExample = (step.solution?.files || []).map(file => file.content || '').join('\n');
        const commentedExample = '{- An example, not the learner implementation:\n'
          + solutionExample + '\n{- Nested explanatory comment -}\n-}\n';
        assert.deepEqual(applicableHints(check, commentedExample + starter), [0],
          'solution-shaped text in nested comments does not advance support');
        assert.deepEqual(applicableHints(check, unrelatedExample + starter), [0],
          'operations in an unrelated helper do not advance support');
      });
    }
  }
}

for (const [name, key, before, after] of [
  ['parenthesized score transformation', 'map-filter',
    'qualifiedScores scores = map doublePoints scores',
    'qualifiedScores scores = (map doublePoints scores)'],
  ['multiline score transformation', 'map-filter',
    'qualifiedScores scores = map doublePoints scores',
    'qualifiedScores scores =\n  map doublePoints scores'],
  ['renamed score parameter', 'map-filter',
    'qualifiedScores scores = map doublePoints scores',
    'qualifiedScores xs = map doublePoints xs'],
  ['parenthesized window lambda', 'captured-settings',
    'makeWindow start count = \\items -> take count items',
    'makeWindow start count = (\\items -> take count items)'],
  ['renamed captured window parameters', 'captured-settings',
    'makeWindow start count = \\items -> take count items',
    'makeWindow offset limit = \\xs -> take limit xs'],
  ['renamed bounded-list parameters', 'lazy-lists',
    'firstMatches n predicate items = take n items',
    'firstMatches count test xs = take count xs'],
  ['undefined pair-conversion placeholder', 'higher-order-types',
    'convertPairs convert entries = []', 'convertPairs convert entries = undefined'],
  ['renamed queue placeholder', 'deferred-work',
    'queueForRide ride queued songs = queued', 'queueForRide r q s = q'],
]) {
  test(`${name} retains orientation support`, () => {
    const step = stepFor('haskell-functions', key);
    const starter = starterSource(step);
    assert.ok(starter.includes(before), 'the fixture changes the intended learner definition');
    assert.deepEqual(applicableHints(step.tests[0], starter.replace(before, after)), [0]);
  });
}

for (const [name, key, source, expectedLevel] of [
  ['transforming scores before selection', 'map-filter',
    'qualifiedScores scores = filter qualifies (map doublePoints scores)', 1],
  ['trimming a window before moving its start', 'captured-settings',
    'makeWindow start count = \\items -> drop start (take count items)', 1],
  ['bounding input positions before matching', 'lazy-lists',
    'firstMatches n predicate items = filter predicate (take n items)', 1],
  ['selecting scores without their transformation', 'map-filter',
    'qualifiedScores scores = filter qualifies scores', 2],
  ['moving a window without its length bound', 'captured-settings',
    'makeWindow start count = \\items -> drop start items', 2],
  ['matching items without an output bound', 'lazy-lists',
    'firstMatches n predicate items = filter predicate items', 2],
]) {
  test(`${name} selects ${expectedLevel === 1 ? 'diagnostic tracing' : 'an incomplete scaffold'}`, () => {
    const check = stepFor('haskell-functions', key).tests[0];
    assert.deepEqual(applicableHints(check, 'module Main where\n' + source + '\n'), [expectedLevel]);
  });
}

// Both deferred-work ladders separate totaling every song from checking the
// song list before the ride; each applies to the value and demand checks.
for (const [name, source, expectedLevel] of [
  ['totaling every song before stopping',
    'queueForRide ride queued songs = min (minutesPlayed queued songs) ride', 1],
  ['matching the song list before checking the ride',
    'queueForRide ride queued [] = queued\nqueueForRide ride queued (song:songs)\n'
    + '  | queued >= ride = queued\n  | otherwise = queueForRide ride (queued + song) songs', 2],
]) {
  test(`${name} selects the same support level for every queue check`, () => {
    for (const check of stepFor('haskell-functions', 'deferred-work').tests) {
      assert.deepEqual(applicableHints(check, 'module Main where\n' + source + '\n'), [expectedLevel],
        check.description);
    }
  });
}

for (const [name, slug, key, before, after] of [
  ['parenthesized pizza balance', 'haskell', 'session-time',
    'moneyLeftAfterTwoPizzas budget pizzaPrice = remainingMoney budget pizzaPrice * 2',
    'moneyLeftAfterTwoPizzas budget pizzaPrice = (remainingMoney budget pizzaPrice * 2)'],
  ['multiline snack-bill placeholder', 'haskell', 'local-bindings',
    'snackBill count unitCost fee = 0', 'snackBill count unitCost fee =\n  0'],
  ['renamed undefined bookend placeholder', 'haskell', 'lists',
    'bookend item items = []', 'bookend x xs = undefined'],
  ['renamed empty swap placeholder', 'haskell', 'swap-front',
    'swapFront values = []', 'swapFront xs = []'],
  ['renamed count placeholder beside a genuine empty base case', 'haskell', 'recursion',
    'countAtLeast threshold scores = 0', 'countAtLeast t xs = 0'],
  ['renamed empty budget placeholder', 'haskell', 'budget',
    'takeBudget budget costs = []', 'takeBudget b xs = []'],
  ['renamed record fields in an unchanged heal', 'haskell-data', 'records',
    'healHero amount (Hero name hp) = Hero name amount',
    'healHero gain (Hero label health) = Hero label gain'],
  ['multiline empty trail placeholder', 'haskell-data', 'recursive-data',
    'fromList xs = End', 'fromList xs =\n  (End)'],
  ['parenthesized unchanged expression cases', 'haskell-data', 'expression-trees',
    'eval (Plus left right) = eval left\neval (Times left right) = eval left',
    'eval (Plus left right) = (eval left)\neval (Times left right) = (eval left)'],
]) {
  test(`${name} does not advance support`, () => {
    const step = stepFor(slug, key);
    const starter = starterSource(step);
    assert.ok(starter.includes(before), 'the fixture changes the intended learner definition');
    for (const check of step.tests) {
      assert.deepEqual(applicableHints(check, starter.replace(before, after)), [0]);
    }
  });
}
