const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createPyodideWorker } = require('./helpers/pyodide-worker');

function output(worker, type) {
  return worker.messages.filter(message => message.type === type).map(message => message.text).join('');
}

for (const [argument, exitCode] of [
  ['', 0], ['None', 0], ['0', 0], ['7', 7], ['-3', -3], ['False', 0], ['True', 1],
]) {
  test(`sys.exit(${argument}) reports status ${exitCode} without a traceback`, async t => {
    const worker = createPyodideWorker(t);
    const result = await worker.request({ type: 'runCode', code: `import sys; sys.exit(${argument})` });
    assert.equal(result.exitCode, exitCode);
    assert.equal(output(worker, 'stderr'), '');
    const next = await worker.request({ type: 'runCode', code: 'print("next run")' });
    assert.equal(next.exitCode, 0, 'an exit must not terminate the Python runtime');
    assert.match(output(worker, 'stdout'), /next run/);
  });
}

for (const reason of ['0', '', 'SystemExit: 0 is not a successful exit', 'missing input']) {
  test(`a string exit reason ${JSON.stringify(reason)} reports failure and prints the reason`, async t => {
    const worker = createPyodideWorker(t);
    const result = await worker.request({ type: 'runCode', code: `import sys; sys.exit(${JSON.stringify(reason)})` });
    assert.equal(result.exitCode, 1);
    assert.equal(output(worker, 'stderr'), reason + '\n');
  });
}

test('ordinary exceptions mentioning SystemExit remain failures with diagnostics', async t => {
  const worker = createPyodideWorker(t);
  const result = await worker.request({
    type: 'runCode', code: 'raise RuntimeError("SystemExit: 0 was unexpected")',
  });
  assert.equal(result.exitCode, 1);
  assert.match(output(worker, 'stderr'), /RuntimeError: SystemExit: 0 was unexpected/);
});

for (const suffix of ['', ' from cause']) {
  test(`an outer exception remains a failure with ${suffix ? 'explicit' : 'implicit'} SystemExit context`, async t => {
    const worker = createPyodideWorker(t);
    const result = await worker.request({ type: 'runCode', code: [
      'try:',
      '    raise SystemExit(0)',
      'except SystemExit as cause:',
      `    raise ValueError("failed after exit")${suffix}`,
    ].join('\n') });
    assert.equal(result.exitCode, 1);
    assert.match(output(worker, 'stderr'), /ValueError: failed after exit/);
  });
}

test('SystemExit subclasses retain their integer exit status', async t => {
  const worker = createPyodideWorker(t);
  const result = await worker.request({ type: 'runCode', code: [
    'class Finished(SystemExit): pass',
    'raise Finished(-4)',
  ].join('\n') });
  assert.equal(result.exitCode, -4);
  assert.equal(output(worker, 'stderr'), '');
});

test('noninteger exit codes remain error reasons even when numerically zero', async t => {
  const worker = createPyodideWorker(t);
  const result = await worker.request({ type: 'runCode', code: 'import sys; sys.exit(0.0)' });
  assert.equal(result.exitCode, 1);
  assert.equal(output(worker, 'stderr'), '0.0\n');
});

test('source diagnostics retain the original filename and line number', async t => {
  const worker = createPyodideWorker(t);
  const result = await worker.request({ type: 'runCode', code: [
    'number = 1',
    'number += 1',
    'raise ValueError("source line")',
  ].join('\n') });
  assert.equal(result.exitCode, 1);
  assert.match(output(worker, 'stderr'), /File "<exec>", line 3, in <module>/);
  assert.match(output(worker, 'stderr'), /ValueError: source line/);
});

test('execution helpers survive learner names and the ordinary globals reset', async t => {
  const worker = createPyodideWorker(t);
  const first = await worker.request({ type: 'runCode', code: [
    'execute_with_exit_status = eval_code_async = source = namespace = None',
    'SystemExit = ValueError',
    'import sys; sys.exit(0)',
  ].join('\n') });
  assert.equal(first.exitCode, 0);
  const second = await worker.request({ type: 'runCode', code: [
    'assert "source" not in globals()',
    'assert "SystemExit" not in globals()',
    'import asyncio',
    'await asyncio.sleep(0)',
    'print("fresh globals and top-level await")',
  ].join('\n') });
  assert.equal(second.exitCode, 0);
  assert.match(output(worker, 'stdout'), /fresh globals and top-level await/);
});

test('a grader rejects learner tests that exit instead of checking behavior', async t => {
  const worker = createPyodideWorker(t);
  const gradingSource = fs.readFileSync(path.resolve(__dirname, '../../assets/tutorials/python_test_grading.py'), 'utf8');
  const setup = await worker.request({ type: 'runCode', code: "import sys, pyodide_js; sys.path.insert(0, '/tutorial'); await pyodide_js.loadPackage('pytest')" });
  assert.equal(setup.exitCode, 0);
  await worker.request({ type: 'write', path: '/tutorial/grading.py', content: gradingSource });
  await worker.request({ type: 'write', path: '/tutorial/service.py', content: 'def reward(): return 50\n' });
  const gradingCommand = [
    'from grading import check_suite',
    'check_suite("/tutorial/test_service.py", "service", "def reward(): return 50\\n")',
  ].join('\n');
  await worker.request({ type: 'write', path: '/tutorial/test_service.py', content: 'from service import reward\ndef test_reward(): assert reward() == 50\n' });
  const reference = await worker.request({ type: 'runCode', code: gradingCommand, silent: true });
  assert.equal(reference.exitCode, 0, 'the same grader must accept a valid test first');
  await worker.request({ type: 'write', path: '/tutorial/test_service.py', content: [
    'def test_reward():',
    '    raise SystemExit(0)',
  ].join('\n') });
  const result = await worker.request({ type: 'runCode', silent: true, code: gradingCommand });
  assert.equal(result.exitCode, 1, 'a rejected pytest suite must not become a successful worker result');
  assert.equal(output(worker, 'stderr'), '', 'silent assessment must keep its existing output policy');
});

test('pytest status is preserved for passing and failing toolbar runs', async t => {
  const worker = createPyodideWorker(t);
  await worker.request({ type: 'runCode', code: "import pyodide_js; await pyodide_js.loadPackage('pytest')" });
  await worker.request({ type: 'write', path: '/tutorial/test_pass.py', content: 'def test_pass(): assert 2 + 2 == 4\n' });
  await worker.request({ type: 'write', path: '/tutorial/test_fail.py', content: 'def test_fail(): assert 2 + 2 == 5\n' });
  const passing = await worker.request({ type: 'runCode', code: 'import pytest; raise SystemExit(pytest.main(["/tutorial/test_pass.py", "-q"]))' });
  assert.equal(passing.exitCode, 0);
  const failing = await worker.request({ type: 'runCode', code: 'import pytest; raise SystemExit(pytest.main(["/tutorial/test_fail.py", "-q"]))' });
  assert.equal(failing.exitCode, 1);
  assert.match(output(worker, 'stdout'), /1 passed/);
  assert.match(output(worker, 'stdout'), /1 failed/);
});
