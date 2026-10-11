const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(receipts) {
  const window = { SEBookSmalltalk: {} };
  const context = { window, structuredClone, AbortController };
  for (const name of ['protocol', 'fresh-runner']) {
    vm.runInNewContext(fs.readFileSync(`js/smalltalk/${name}.js`, 'utf8'), context);
  }
  const api = window.SEBookSmalltalk;
  // RuntimeHost is the public asynchronous boundary. Native behavior is covered
  // separately by real-image tests; here receipts make cancellation deterministic.
  const host = {
    async withFreshSession(work, { signal }) {
      if (signal.aborted) throw api.runtimeError('CANCELLED', 'Checks stopped');
      return work({});
    },
    async loadProgram() {},
    async request() { return receipts.shift(); },
  };
  return { runner: new api.FreshRunner(host), program: api.normalizeProgram({ stepKey: 'checks', files: [] }) };
}

test('check receipts preserve diagnostic values without exporting dead fresh-image handles', async () => {
  const { runner, program } = fixture([
    { value: { text: 'true', className: 'True', booleanValue: true, handle: 'fresh-handle' } },
    { value: { text: 'false', className: 'False', booleanValue: false } },
    { value: { text: '1', className: 'SmallInteger', handle: 'fresh-number' } },
    { error: { code: 'EVALUATION_ERROR', message: 'A meaningful native exception' } },
  ]);
  const result = await runner.runTests(Array(4).fill({ command: 'authored expression' }), { program });
  assert.deepEqual(Array.from(result.results, row => row.passed), [true, false, false, false]);
  assert.equal(result.results[0].value.booleanValue, true);
  assert.equal(result.results[1].value.text, 'false');
  assert.equal(result.results[2].value.className, 'SmallInteger');
  assert.equal(result.results[2].value.text, '1');
  assert.equal('handle' in result.results[0].value, false);
  assert.equal('booleanValue' in result.results[2].value, false);
  assert.equal(result.results[3].error.message, 'A meaningful native exception');
});

test('progress identifies the running check and its completed result in authored order', async () => {
  const { runner, program } = fixture([{ value: { text: 'false', booleanValue: false } }, { value: { text: 'true', booleanValue: true } }]);
  const progress = [];
  await runner.runTests([{ command: 'false' }, { command: 'true' }], { program, onProgress: event => progress.push(event) });
  assert.deepEqual(progress.map(event => [event.phase, event.index, event.total]), [
    ['running', 0, 2], ['complete', 0, 2], ['running', 1, 2], ['complete', 1, 2],
  ]);
  assert.equal(progress[1].result.passed, false);
  assert.equal(progress[3].result.passed, true);
});

test('stopping from progress cancels remaining checks instead of recording failed assertions', async () => {
  const { runner, program } = fixture([{ value: { text: 'true', booleanValue: true } }]);
  const started = [];
  await assert.rejects(runner.runTests([{ command: 'true' }, { command: 'false' }], {
    program, onProgress(event) {
      if (event.phase === 'running') started.push(event.index);
      if (event.phase === 'complete') runner.stop();
    },
  }), error => error.code === 'CANCELLED');
  assert.deepEqual(started, [0]);
});
