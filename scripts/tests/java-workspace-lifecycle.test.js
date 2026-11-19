const { test } = require('node:test');
const assert = require('node:assert/strict');

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

test('Stop during startup settles active and queued work and permits a clean restart', async () => {
  const { JavaWorkspace } = await import('../../js/java/workspace.mjs');
  const delayed = deferred(), started = deferred();
  const messages = [];
  let opens = 0;
  const workspace = new JavaWorkspace({ openRuntime: async ({ onMessage }) => {
    if (++opens === 1) { started.resolve(); await delayed.promise; }
    return { close() {}, send(id, request) {
      messages.push(request);
      onMessage({ type: 'result', id, result: { exitCode: 0, stdout: 'ready' } });
    } };
  } });
  const files = [{ path: 'Main.java', content: 'class Main {}' }];
  const first = workspace.run({ files, entry: 'Main.java' });
  const queued = workspace.test({ files, code: 'assert true;' });
  await started.promise;
  workspace.cancel();
  await Promise.all([assert.rejects(first, { name: 'AbortError' }), assert.rejects(queued, { name: 'AbortError' })]);
  delayed.resolve();
  const result = await workspace.run({ files, entry: 'Main.java' });
  assert.equal(result.stdout, 'ready');
  assert.equal(opens, 2);
  assert.equal(messages.length, 1);
  workspace.destroy();
});

test('a queued request uses the source revision captured when Run was pressed', async () => {
  const { JavaWorkspace } = await import('../../js/java/workspace.mjs');
  const delayed = deferred();
  const workspace = new JavaWorkspace({ openRuntime: async ({ onMessage }) => {
    await delayed.promise;
    return { close() {}, send(id, { files }) { onMessage({ type: 'result', id, result: files }); } };
  } });
  const files = { 'Main.java': 'class Before {}' };
  const run = workspace.run({ files, entry: 'Main.java' });
  files['Main.java'] = 'class After {}';
  delayed.resolve();
  assert.equal((await run)['Main.java'], 'class Before {}');
  workspace.destroy();
});
