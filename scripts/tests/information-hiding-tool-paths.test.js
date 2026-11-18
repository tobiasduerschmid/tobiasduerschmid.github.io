'use strict';

// The Information Hiding tutorial asks learners to make every change with the
// editor's refactoring tools. Each lesson's starter code is shaped so that
// exactly those refactorings apply. This file replays every lesson's tool path
// through the real engine and runs the lesson's own pytest file on the result,
// so a later edit to a starter file cannot silently break the taught path.

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const yaml = require('js-yaml');

const repoRoot = process.env.IH_REPO_ROOT || path.resolve(__dirname, '../..');
const tutorialPath = process.env.IH_TUTORIAL_YAML
  || path.join(repoRoot, '_data/tutorials/information-hiding.yml');
const analyzerPath = path.join(repoRoot, 'js', 'python-ast-analyzer.py');
const enginePath = path.join(repoRoot, 'js', 'tutorial-refactorings.js');

const tutorial = yaml.load(fs.readFileSync(tutorialPath, 'utf8'));
const lessons = Object.fromEntries(tutorial.steps.map((step) => [step.key, step]));

const adapter = (() => {
  const sandbox = { window: {}, console };
  vm.runInNewContext(fs.readFileSync(enginePath, 'utf8'), sandbox, { filename: enginePath });
  return sandbox.window.SebookRefactorings._test.PythonAdapter;
})();

function starterFiles(key) {
  return Object.fromEntries(lessons[key].files.map((file) => [file.path, file.content]));
}

function solutionFiles(key) {
  const files = starterFiles(key);
  for (const file of lessons[key].solution.files) files[file.path] = file.content;
  return files;
}

function workspaceOf(files, activeFile) {
  return {
    activeFile,
    files: Object.entries(files).map(([filename, content]) => ({ filename, content, language: 'python' })),
  };
}

function analyze(workspace) {
  const result = JSON.parse(execFileSync('python3', [analyzerPath], {
    input: JSON.stringify(workspace.files), cwd: repoRoot, encoding: 'utf8',
  }));
  assert.deepEqual(result.errors || [], [], 'the lesson files must parse');
  return result;
}

// The one line that contains `needle`.
function lineOf(content, needle) {
  const lines = content.split('\n');
  const matches = lines.map((text, index) => ({ text, index })).filter(({ text }) => text.includes(needle));
  assert.equal(matches.length, 1, `expected exactly one line containing ${JSON.stringify(needle)}`);
  const { text, index } = matches[0];
  return { lineNumber: index + 1, column: text.indexOf(needle) + 1, text };
}

// From the first token of the line containing `from` to the end of the line
// containing `to`: the selection a learner makes for Extract Function/Method.
function statements(content, from, to) {
  const first = lineOf(content, from);
  const last = lineOf(content, to);
  return {
    startLineNumber: first.lineNumber,
    startColumn: first.text.length - first.text.trimStart().length + 1,
    endLineNumber: last.lineNumber,
    endColumn: last.text.length + 1,
    isEmpty: () => false,
  };
}

function apply(files, plan, what) {
  assert.equal(plan.error, undefined, `${what}: ${plan.error}`);
  const result = { ...files };
  const edits = [...plan.edits].sort((a, b) => (
    a.filename !== b.filename ? (a.filename < b.filename ? -1 : 1)
      : (b.range.startLineNumber - a.range.startLineNumber) || (b.range.startColumn - a.range.startColumn)));
  const offset = (content, line, column) => content.split('\n').slice(0, line - 1)
    .reduce((sum, text) => sum + text.length + 1, 0) + column - 1;
  for (const edit of edits) {
    const content = result[edit.filename];
    result[edit.filename] = content.slice(0, offset(content, edit.range.startLineNumber, edit.range.startColumn))
      + edit.text + content.slice(offset(content, edit.range.endLineNumber, edit.range.endColumn));
  }
  return result;
}

// Select the statements from `from` through `to`, then Refactor: Extract Function/Method.
function extract(files, file, from, to, name) {
  const workspace = workspaceOf(files, file);
  return apply(files, adapter.planExtract(workspace, analyze(workspace), file,
    statements(files[file], from, to), name), `Extract ${name} in ${file}`);
}

// Put the cursor inside the method that contains `inside`, then Refactor: Move Method.
function move(files, file, inside, target) {
  const workspace = workspaceOf(files, file);
  return apply(files, adapter.planMoveMethod(workspace, analyze(workspace), file,
    lineOf(files[file], inside), target), `Move Method to ${target} from ${file}`);
}

// Put the cursor on `oldName` in the line containing `line`, then Refactor: Rename Symbol.
function rename(files, file, line, oldName, newName) {
  const workspace = workspaceOf(files, file);
  const at = lineOf(files[file], line);
  const position = { lineNumber: at.lineNumber, column: at.text.indexOf(oldName) + 1 };
  return apply(files, adapter.planRename(workspace, analyze(workspace), file, position, oldName, newName),
    `Rename ${oldName} in ${file}`);
}

// Run the lesson's own test file; return pytest's outcome per test name.
function runTests(key, files) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ih-tool-path-'));
  try {
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), content);
    const run = spawnSync('python3', ['-m', 'pytest', lessons[key].run_file, '-q', '-rA',
      '-p', 'no:cacheprovider', '--tb=line'], { cwd: directory, encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    const outcomes = {};
    for (const match of run.stdout.matchAll(/^(PASSED|FAILED|ERROR) \S+::(\w+)/gm)) outcomes[match[2]] = match[1];
    assert.notDeepEqual(outcomes, {}, `pytest reported no tests:\n${run.stdout}\n${run.stderr}`);
    return outcomes;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function assertAllPass(key, files) {
  const outcomes = runTests(key, files);
  assert.deepEqual(Object.entries(outcomes).filter(([, outcome]) => outcome !== 'PASSED'), [],
    'every test should still pass after the refactoring');
}

test('payments: three Extract + Move rounds and one Rename give PayPalGateway the PayPal protocol', () => {
  const key = 'payments';
  const speaksPayPal = 'token = gateway.paypal.authenticate()';
  let files = starterFiles(key);
  assertAllPass(key, files);

  files = extract(files, 'order_service.py', speaksPayPal, 'paid = result.was_successful()', 'charge');
  files = move(files, 'order_service.py', speaksPayPal, 'PayPalGateway');
  assertAllPass(key, files);

  files = extract(files, 'refund_service.py', speaksPayPal, 'refunded = result.was_successful()', 'refund');
  files = move(files, 'refund_service.py', speaksPayPal, 'PayPalGateway');
  files = extract(files, 'wallet_service.py', speaksPayPal, 'card_id = gateway.paypal.vault(token, customer)', 'save_card');
  files = move(files, 'wallet_service.py', speaksPayPal, 'PayPalGateway');
  files = rename(files, 'paypal_gateway.py', 'self.paypal = PayPalClient', 'paypal', '__paypal');
  assertAllPass(key, files);

  for (const service of ['order_service.py', 'refund_service.py', 'wallet_service.py']) {
    assert.doesNotMatch(files[service], /\.paypal\b|authenticate|capture|reverse|vault/,
      `${service} should no longer mention PayPal's calls`);
  }
  for (const operation of ['charge', 'refund', 'save_card']) {
    assert.match(files['paypal_gateway.py'], new RegExp(`^    def ${operation}\\(`, 'm'),
      `the tools should give PayPalGateway the ${operation} operation`);
  }

  // Promising the interface is the one hand edit in paypal_gateway.py.
  const promised = `from payment_gateway import PaymentGateway\n${files['paypal_gateway.py']}`
    .replace('class PayPalGateway:', 'class PayPalGateway(PaymentGateway):');
  const solution = solutionFiles(key);
  assert.equal(promised, solution['paypal_gateway.py'],
    'the published solution should be the tool output plus the base class and its import');

  // The services and gateway_choice.py then name only the interface, by hand.
  assertAllPass(key, { ...files, 'paypal_gateway.py': promised,
    'order_service.py': solution['order_service.py'],
    'refund_service.py': solution['refund_service.py'],
    'wallet_service.py': solution['wallet_service.py'],
    'gateway_choice.py': solution['gateway_choice.py'] });
});

test('menu: Extract + Move twice, then Rename from the def line; only the test that knew the layout fails', () => {
  const key = 'menu';
  let files = starterFiles(key);
  assertAllPass(key, files);

  files = extract(files, 'kiosk.py', 'price = 0', 'price = int(fields[1])', 'price_cents');
  files = move(files, 'kiosk.py', 'price = int(fields[1])', 'Menu');
  files = extract(files, 'kiosk.py', 'available = []', 'available = fields[2].split("|")', 'sizes');
  files = move(files, 'kiosk.py', 'available = fields[2].split("|")', 'Menu');
  assertAllPass(key, files);

  files = rename(files, 'menu.py', 'def rows(self)', 'rows', '__rows');
  assert.doesNotMatch(files['kiosk.py'], /rows|split/, 'the kiosk should no longer parse rows');
  assert.equal(files['menu.py'], solutionFiles(key)['menu.py'],
    'the published solution should be exactly what the tools produce');

  const failing = Object.entries(runTests(key, files)).filter(([, outcome]) => outcome !== 'PASSED');
  assert.deepEqual(failing, [['test_menu_keeps_the_supplier_rows', 'FAILED']],
    'only the test that depended on rows() should fail; the lesson asks the learner to rewrite it');
  assertAllPass(key, { ...files, 'test_kiosk.py': solutionFiles(key)['test_kiosk.py'] });
});

test('wait-times: one Extract + Move gives the estimate an owner; the second client just calls it', () => {
  const key = 'wait-times';
  const firstLine = 'ahead = wait_times.queue.position(order_id)';
  const lastLine = 'minutes = (ahead + 1) * wait_times.minutes_per_drink';
  let files = starterFiles(key);
  assertAllPass(key, files);

  files = extract(files, 'pickup_screen.py', firstLine, lastLine, 'minutes_until_ready');
  files = move(files, 'pickup_screen.py', firstLine, 'WaitTimes');
  assertAllPass(key, files);
  assert.equal(files['wait_times.py'], solutionFiles(key)['wait_times.py'],
    'the published solution should be exactly what the tools produce');

  // The lesson's remaining edits are made by hand: the second client and the tests.
  assertAllPass(key, { ...files,
    'text_message.py': solutionFiles(key)['text_message.py'],
    'test_pickup.py': solutionFiles(key)['test_pickup.py'] });
});

test('clubhub: Extract + Move, a hand edit in the second client, then Rename', () => {
  const key = 'clubhub';
  const firstLine = 'session = notifier.textly.open_session()';
  let files = starterFiles(key);
  assertAllPass(key, files);

  files = extract(files, 'rsvp_service.py', firstLine, 'sent = receipt.delivered', 'send');
  files = move(files, 'rsvp_service.py', firstLine, 'Notifier');
  assertAllPass(key, files);

  files = { ...files, 'reminder_service.py': solutionFiles(key)['reminder_service.py'] };
  files = rename(files, 'notifier.py', 'self.textly = TextlyClient', 'textly', '__textly');
  assertAllPass(key, files);
  assert.equal(files['notifier.py'], solutionFiles(key)['notifier.py'],
    'the published solution should be exactly what the tools produce');
});

test('every model solution passes its own lesson tests', () => {
  for (const key of Object.keys(lessons)) assertAllPass(key, solutionFiles(key));
});
