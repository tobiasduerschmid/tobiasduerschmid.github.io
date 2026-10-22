const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([
  import('../../js/shell-pipeline-grading.mjs'),
  import('../../js/shell-pipeline-runtime.mjs'),
]);

const comparisons = [
  ['exact output preserves characters and record order', 'exact', '/b.htm\n/a.htm\n', '/a.htm\n/b.htm\n', false],
  ['exact output preserves the final newline', 'exact', '/a.htm', '/a.htm\n', false],
  ['count padding may use spaces or tabs', 'count-lines', ' \t2\t/a \n 1 /b\n', '2 /a\n1 /b\n', true],
  ['count rows preserve the authored order', 'count-lines', '1 /b\n2 /a\n', '2 /a\n1 /b\n', false],
  ['ranked count ties may appear in either order', 'ranked-counts', '3 /z\n1 /b\n1 /a\n', '3 /z\n1 /a\n1 /b\n', true],
  ['ranked counts use numeric descending order', 'ranked-counts', '2 /a\n10 /z\n', '10 /z\n2 /a\n', false],
  ['a repeated value cannot replace an omitted value', 'ranked-counts', '1 /a\n1 /a\n', '1 /a\n1 /b\n', false],
  ['non-numeric counts fail', 'count-lines', 'two /a\n', '2 /a\n', false],
  ['incorrect counts fail', 'count-lines', '3 /a\n', '2 /a\n', false],
  ['extra output records fail', 'count-lines', '2 /a\n1 /b\n', '2 /a\n', false],
  ['missing output records fail', 'count-lines', '2 /a\n', '2 /a\n1 /b\n', false],
  ['extra blank records fail', 'count-lines', '2 /a\n\n', '2 /a\n', false],
  ['empty output passes an empty expectation', 'ranked-counts', '', '', true],
  ['nonempty output fails an empty expectation', 'count-lines', '1 /a\n', '', false],
];
for (const [behavior, comparison, actual, expected, accepted] of comparisons) {
  test(behavior, async () => {
    const [{ assessOutput }] = await modules;
    assert.equal(assessOutput(actual, expected, comparison), accepted);
  });
}

async function check(command, expectation, files = {}) {
  const [{ checkSolution }, { createShell }] = await modules;
  return checkSolution({ command, files, check: expectation, createShell });
}
const fixture = { files: { 'access.tsv': '/b\n/a\n/b\n' }, expected_stdout: '1 /a\n2 /b\n', comparison: 'count-lines', preserve_files: ['access.tsv'] };

for (const command of ['sort access.tsv | uniq -c', "awk '{ count[$1]++ } END { for (path in count) print count[path], path }' access.tsv | sort -k2"]) {
  test('equivalent count implementations satisfy the same output contract: ' + command.split(' ')[0], async () => {
    assert.equal((await check(command, fixture)).passed, true);
  });
}

test('fixture files override edited input while preserving other editor files', async () => {
  const result = await check('cat access.tsv extra.txt', {
    files: { 'access.tsv': 'fixture\n' }, expected_stdout: 'fixture\nhelper\n',
  }, { '/home/student/access.tsv': 'edited\n', 'extra.txt': 'helper\n' });
  assert.equal(result.passed, true);
});

test('each check starts with fresh virtual files', async () => {
  const command = 'if test -f visited; then echo stale; else touch visited; sort access.tsv | uniq -c; fi';
  assert.equal((await check(command, fixture)).passed, true);
  assert.equal((await check(command, fixture)).passed, true);
});

for (const [condition, suffix] of [['nonzero exit status', '; exit 1'], ['standard error', '; echo diagnostic >&2']]) {
  test('correct output cannot hide ' + condition, async () => {
    const result = await check('sort access.tsv | uniq -c' + suffix, fixture);
    assert.match(result.stdout, /1 \/a\n\s*2 \/b\n/);
    assert.equal(result.passed, false);
    assert.ok(result.diagnostic.length);
  });
}

for (const [change, command] of [['truncation', ': > access.tsv'], ['deletion', 'rm access.tsv'], ['rename', 'mv access.tsv renamed.tsv']]) {
  test('a preservation requirement detects input ' + change, async () => {
    const result = await check('sort access.tsv | uniq -c; ' + command, fixture);
    assert.equal(result.sourceUnchanged, false);
    assert.equal(result.passed, false);
    assert.match(result.diagnostic, /file/i);
  });
}

test('a sample answer fails a changed fixture', async () => {
  const result = await check("printf '1 /a\n2 /b\n'", { ...fixture, files: { 'access.tsv': '/other\n' }, expected_stdout: '1 /other\n' });
  assert.equal(result.passed, false);
});

test('invalid authored expectations fail visibly instead of awarding credit', async () => {
  await assert.rejects(check('true', { expected_stdout: '', comparison: 'typo' }), /comparison/i);
  await assert.rejects(check('true', { expected_stdout: '', preserve_files: ['missing'] }), /missing/i);
  await assert.rejects(check('true', { expected_stdout: '', expected_output: '' }), /expectation/i);
});
