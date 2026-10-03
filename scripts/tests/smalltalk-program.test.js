const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function normalize(options) {
  const window = { SEBookSmalltalk: {} };
  const context = { window, structuredClone };
  vm.runInNewContext(fs.readFileSync('js/smalltalk/protocol.js', 'utf8'), context);
  vm.runInNewContext(fs.readFileSync('js/smalltalk/fresh-runner.js', 'utf8'), context);
  return window.SEBookSmalltalk.normalizeProgram(options);
}
const file = (path, language = 'smalltalk', smalltalk_format) => ({ path, language, smalltalk_format, content: 'native source' });
const data = files => ({ stepKey: 'one', files, runFile: 'Counter.st', runCommand: 'Counter run' });
test('source definitions preserve authored order and run_file loads last exactly once', () => {
  const options = data([file('Counter.st'), file('Dependency.st'), file('Resource.txt', 'plaintext')]);
  const program = normalize(options);
  assert.deepEqual(Array.from(program.files, source => [source.path, source.kind, source.format]), [
    ['Dependency.st', 'source', 'filein'], ['Resource.txt', 'resource', null], ['Counter.st', 'source', 'filein'],
  ]);
  assert.equal(program.runCommand, 'Counter run');
  assert.equal(options.files[0].path, 'Counter.st');
});
test('explicit doit source is retained and extension inference only applies without a language', () => {
  const inferred = file('Other.st', undefined, 'doit');
  delete inferred.language;
  const program = normalize(data([inferred, file('Counter.st')]));
  assert.equal(program.files[0].format, 'doit');
});
for (const [name, options] of [
  ['missing run_file', data([file('Other.st')])],
  ['duplicate source', data([file('Counter.st'), file('./Counter.st')])],
  ['path escape', data([file('Counter.st'), file('../Outside.st')])],
  ['invalid format', data([file('Counter.st', 'smalltalk', 'unknown')])],
  ['resource run_file', data([file('Counter.st', 'plaintext')])],
]) test('rejects ' + name, () => assert.throws(() => normalize(options), error => error.code === 'PRECONDITION_FAILED'));
test('an omitted run_command normalizes to no entry without removing source', () => {
  const options = data([file('Counter.st')]); delete options.runCommand;
  const program = normalize(options);
  assert.equal(program.runCommand, null);
  assert.equal(program.files.length, 1);
});
test('an explicit non-Smalltalk language never executes a .st resource', () => {
  const program = normalize(data([file('notes.st', 'plaintext'), file('Counter.st')]));
  assert.equal(program.files[0].kind, 'resource');
});
