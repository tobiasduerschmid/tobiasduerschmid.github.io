const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const tutorial = yaml.load(fs.readFileSync(path.join(root, '_data/tutorials/tla.yml'), 'utf8'));
const pluscalTutorial = yaml.load(fs.readFileSync(path.join(root, '_data/tutorials/pluscal.yml'), 'utf8'));
const jar = process.env.TLA_TOOLS_JAR || path.join(root, 'js/vendor/tlaplus/1.8.0-fc6878c603f0/tla2tools.jar');
const java = process.env.JAVA_BIN || 'java';
const javaProbe = spawnSync(java, ['-version'], { encoding: 'utf8', timeout: 10000 });
const javaVersion = (javaProbe.stderr + javaProbe.stdout).match(/(?:openjdk|java) version "(?:1\.)?(\d+)/);
const javaSupported = javaProbe.status === 0 && javaVersion && Number(javaVersion[1]) >= 11;
const javaUnavailable = !process.env.JAVA_BIN && !javaSupported
  ? 'Java 11+ unavailable; set JAVA_BIN to run official TLC content checks.' : false;

function workspace(step, solution = false) {
  return Object.fromEntries([...step.files, ...(solution ? step.solution.files : [])]
    .map(file => [file.path, file.content]));
}

function runTool(directory, mainClass, args) {
  assert.ok(javaSupported, 'JAVA_BIN must select a working Java 11+ runtime.');
  const result = spawnSync(java, ['-XX:+UseParallelGC', '-Xmx256m', '-cp', jar, mainClass, ...args], {
    cwd: directory, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, 'Official tool must finish without termination.');
  return { status: result.status, output: result.stdout + result.stderr };
}

function check(files, { pluscal = false } = {}) {
  assert.ok(fs.existsSync(jar), 'Pinned official TLA+ tools JAR must be present.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sebook-tla-content-'));
  try {
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), content);
    if (pluscal) {
      const translation = runTool(directory, 'pcal.trans', ['Model.tla']);
      assert.equal(translation.status, 0, translation.output);
      assert.match(translation.output, /Translation completed\./);
      // Checking must preserve the authored configuration; translator output is derived code.
      fs.writeFileSync(path.join(directory, 'Model.cfg'), files['Model.cfg']);
    }
    return runTool(directory, 'tlc2.TLC', ['-workers', '1', '-config', 'Model.cfg', 'Model.tla']);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function assertComplete(result) {
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Model checking completed\. No error has been found\./);
  assert.match(result.output, /0 states left on queue/);
}

test('TLA tutorial provides optional, independently restorable model workspaces and its page pair', () => {
  assert.equal(tutorial.backend, 'tla');
  assert.equal(tutorial.require_tests, false);
  assert.equal(tutorial.require_quiz, false);
  assert.equal(tutorial.allow_skip_steps, true);
  assert.equal(new Set(tutorial.steps.map(step => step.key)).size, tutorial.steps.length);
  for (const step of tutorial.steps) {
    const files = workspace(step);
    assert.ok(files[step.run_file], step.key + ' needs an explicit source entry.');
    assert.ok(files[(step.tla || tutorial.tla).config_file], step.key + ' needs an editable model configuration.');
    assert.ok(step.files.every(file => file.reseed), step.key + ' needs an independent lesson draft.');
    assert.ok(Array.isArray(step.solution.files), step.key + ' uses the shared solution-file contract.');
    assert.ok(step.solution.files.every(file => typeof file.content === 'string'));
  }
  for (const [file, layout] of [
    ['SEBook/verification/tla-tutorial.md', 'tutorial'],
    ['SEBook/verification/tla-tutorial/print.md', 'print-tutorial']
  ]) {
    const frontMatter = yaml.load(fs.readFileSync(path.join(root, file), 'utf8').split('---')[1]);
    assert.equal(frontMatter.tutorial, 'tla');
    assert.equal(frontMatter.layout, layout);
  }
});

const outcomes = [
  { key: 'states-and-transitions', status: 0, evidence: /3 distinct states found/ },
  { key: 'invariant-counterexample', status: 12, evidence: /Invariant WithinCapacity is violated\.[\s\S]*count = 3/ },
  { key: 'pluscal-concurrent-updates', status: 12, evidence: /Invariant AllCounted is violated\.[\s\S]*pc = <<"Done", "Done">>[\s\S]*total = 1/, pluscal: true },
  { key: 'liveness-and-fairness', status: 13, evidence: /Temporal property EventuallyDone was violated\.[\s\S]*done = FALSE[\s\S]*Stuttering/ }
];

for (const outcome of outcomes) {
  test(outcome.key + ': official TLC reproduces the starter behavior', { skip: javaUnavailable }, () => {
    const step = tutorial.steps.find(candidate => candidate.key === outcome.key);
    assert.ok(step, 'The lesson with this semantic contract must exist.');
    const result = check(workspace(step), outcome);
    assert.equal(result.status, outcome.status, result.output);
    assert.match(result.output, outcome.evidence);
    if (outcome.status === 0) assertComplete(result);
  });

  test(outcome.key + ': official TLC completes the reference model', { skip: javaUnavailable }, () => {
    const step = tutorial.steps.find(candidate => candidate.key === outcome.key);
    const result = check(workspace(step, true), outcome);
    assertComplete(result);
    if (outcome.key === 'states-and-transitions') assert.match(result.output, /4 distinct states found/);
  });
}

test('the liveness comparison succeeds only because the temporal property is no longer selected', { skip: javaUnavailable }, () => {
  const step = tutorial.steps.find(candidate => candidate.key === 'liveness-and-fairness');
  const files = workspace(step);
  files['Model.cfg'] = files['Model.cfg'].replace(/^PROPERTY EventuallyDone\n/m, '');
  assertComplete(check(files));
});

test('the beginner PlusCal tutorial supplies editable source, trusted property checks, and a print view', () => {
  assert.equal(pluscalTutorial.backend, 'tla');
  assert.equal(pluscalTutorial.require_tests, false);
  for (const step of pluscalTutorial.steps) {
    assert.equal(step.open_file, step.run_file);
    assert.ok(step.files.every(file => file.reseed));
    assert.ok(workspace(step)[pluscalTutorial.tla.config_file]);
    assert.ok(step.tests.length > 0, 'Each introductory lesson offers Test My Work.');
    for (const check of step.tests) {
      assert.equal(check.tla.status, 'complete');
      assert.ok(check.tla.invariant, 'The exercise property must be independent of learner edits to the configuration.');
      assert.ok(check.tla.model_config);
    }
  }
  for (const [file, layout] of [
    ['SEBook/verification/pluscal-tutorial.md', 'tutorial'],
    ['SEBook/verification/pluscal-tutorial/print.md', 'print-tutorial']
  ]) {
    const frontMatter = yaml.load(fs.readFileSync(path.join(root, file), 'utf8').split('---')[1]);
    assert.equal(frontMatter.tutorial, 'pluscal');
    assert.equal(frontMatter.layout, layout);
  }
});

test('the worked C-style PlusCal counter satisfies its supplied property', { skip: javaUnavailable }, () => {
  assertComplete(check(workspace(pluscalTutorial.steps[0]), { pluscal: true }));
});

test('the C-style loop-bound bug produces count three in the counterexample', { skip: javaUnavailable }, () => {
  const result = check(workspace(pluscalTutorial.steps[1]), { pluscal: true });
  assert.equal(result.status, 12, result.output);
  assert.match(result.output, /Invariant CountWithinLimit is violated\.[\s\S]*count = 3/);
});

test('the repaired C-style loop satisfies the unchanged property', { skip: javaUnavailable }, () => {
  assertComplete(check(workspace(pluscalTutorial.steps[1], true), { pluscal: true }));
});

async function assessAuthoredModel(step, files, defaults) {
  const { snapshot } = await import('../../js/tla/model.mjs');
  const assessment = await import('../../js/tla/assessment.mjs');
  const expectation = step.tests[0].tla;
  const request = assessment.buildCheck(snapshot(files, step, defaults), expectation);
  const bridge = path.join(root, 'js/vendor/tlaplus/1.8.0-fc6878c603f0/sebook-tla-bridge.jar');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sebook-pluscal-assessment-'));
  try {
    assert.ok(javaSupported, 'JAVA_BIN must select a working Java 11+ runtime.');
    const execution = spawnSync(java, ['-XX:+UseParallelGC', '-Xmx256m', '-cp', jar + path.delimiter + bridge, 'sebook.tla.Bridge'], {
      cwd: directory, input: JSON.stringify(request) + '\n', encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024
    });
    assert.ifError(execution.error);
    assert.equal(execution.status, 0, execution.stderr);
    const result = JSON.parse(execution.stdout.trim());
    return { result, passed: assessment.assess(result, expectation) };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('the beginner Test My Work accepts both reference programs through the actual assessment bridge', { skip: javaUnavailable }, async () => {
  for (const step of pluscalTutorial.steps) {
    const { result, passed } = await assessAuthoredModel(step, workspace(step, true), pluscalTutorial.tla);
    assert.equal(result.status, 'complete', JSON.stringify(result));
    assert.equal(passed, true);
  }
});

test('removing or weakening the editable property cannot pass the faulty loop exercise', { skip: javaUnavailable }, async () => {
  const step = pluscalTutorial.steps[1];
  const files = workspace(step);
  files['Model.cfg'] = files['Model.cfg'].replace(/^INVARIANT CountWithinLimit\n/m, '');
  files['Model.tla'] = files['Model.tla'].replace('CountWithinLimit == count <= 2', 'CountWithinLimit == TRUE');
  const { result, passed } = await assessAuthoredModel(step, files, pluscalTutorial.tla);
  assert.equal(result.status, 'counterexample', JSON.stringify(result));
  assert.equal(result.reason, 'invariant');
  assert.equal(passed, false);
  assert.ok(result.trace.states.some(state => state.values.some(value => value.name === 'count' && value.text === '3')),
    'The trusted requirement must expose the real count-three counterexample.');
});

test('the broader tutorial reference models pass their actual authored invariant and temporal checks', { skip: javaUnavailable }, async () => {
  for (const step of tutorial.steps) {
    const { result, passed } = await assessAuthoredModel(step, workspace(step, true), tutorial.tla);
    assert.equal(result.status, 'complete', step.key + ': ' + JSON.stringify(result));
    assert.equal(passed, true);
  }
});

test('the broader tutorial faulty starters fail the exercise property independently of the editable configuration', { skip: javaUnavailable }, async () => {
  for (const key of ['invariant-counterexample', 'pluscal-concurrent-updates', 'liveness-and-fairness']) {
    const step = tutorial.steps.find(candidate => candidate.key === key);
    const files = workspace(step);
    files['Model.cfg'] = files['Model.cfg'].replace(/^(?:INVARIANT|PROPERTY) .+\n/gm, '');
    const { result, passed } = await assessAuthoredModel(step, files, tutorial.tla);
    assert.equal(result.status, 'counterexample', key + ': ' + JSON.stringify(result));
    assert.equal(result.reason, key === 'liveness-and-fairness' ? 'liveness' : 'invariant');
    assert.equal(passed, false);
  }
});
