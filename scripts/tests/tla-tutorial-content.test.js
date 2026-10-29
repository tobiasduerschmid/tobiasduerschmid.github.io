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

function pluscalStep(key) {
  const step = pluscalTutorial.steps.find(candidate => candidate.key === key);
  assert.ok(step, 'The PlusCal lesson ' + key + ' must exist.');
  return step;
}

function replaceSource(files, filename, before, after) {
  assert.ok(files[filename].includes(before), 'The mutation must change the intended source expression: ' + before);
  files[filename] = files[filename].replace(before, after);
  return files;
}

function applicableHints(criterion, files) {
  const source = Object.values(files).join('\n');
  return criterion.hints.filter(hint => {
    const condition = hint.condition.match(/^source_matches:\s*\/(.*)\/([a-z]*)$/);
    assert.ok(condition, 'PlusCal hints must inspect full source, including the algorithm comment.');
    return new RegExp(condition[1], condition[2]).test(source);
  });
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

function check(files, { pluscal = false, entry = 'Model.tla', config = 'Model.cfg' } = {}) {
  assert.ok(fs.existsSync(jar), 'Pinned official TLA+ tools JAR must be present.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sebook-tla-content-'));
  try {
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), content);
    if (pluscal) {
      const translation = runTool(directory, 'pcal.trans', [entry]);
      assert.equal(translation.status, 0, translation.output);
      assert.match(translation.output, /Translation completed\./);
      // Checking must preserve the authored configuration; translator output is derived code.
      fs.writeFileSync(path.join(directory, config), files[config]);
    }
    return runTool(directory, 'tlc2.TLC', ['-workers', '1', '-config', config, entry]);
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

test('the PlusCal tutorial supplies restorable workspaces, valid assessment requests, and a print view', async () => {
  const { snapshot } = await import('../../js/tla/model.mjs');
  const { buildCheck } = await import('../../js/tla/assessment.mjs');
  assert.equal(pluscalTutorial.backend, 'tla');
  assert.equal(pluscalTutorial.require_tests, false);
  assert.equal(new Set(pluscalTutorial.steps.map(step => step.key)).size, pluscalTutorial.steps.length);
  for (const step of pluscalTutorial.steps) {
    assert.equal(step.open_file, step.run_file);
    assert.ok(step.files.every(file => file.reseed));
    const source = snapshot(workspace(step), step, pluscalTutorial.tla);
    for (const criterion of step.tests || []) {
      assert.doesNotThrow(() => buildCheck(source, criterion.tla), step.key + ': ' + criterion.description);
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

for (const step of pluscalTutorial.steps) {
  for (const criterion of step.tests || []) {
    test(step.key + ': focused hints for ' + criterion.description, () => {
      for (const [name, files] of [['starter', workspace(step)], ['developed attempt', workspace(step, true)], ['empty workspace', {}]]) {
        assert.equal(applicableHints(criterion, files).length, 1,
          name + ' should receive one relevant hint: ' + applicableHints(criterion, files).map(hint => hint.title).join(', '));
      }
    });
  }
}

test('PlusCal hints respond to partial attempts across the source and configuration files', () => {
  const cases = [
    ['playlist-boundary', 0, true, 'count < 2', 'count < 1', 'The Other Side of the Boundary'],
    ['atomic-reservations', 0, true, 'sold := sold + 1;', 'skip;', 'Two Obligations Together'],
    ['response-contract', 0, true, '[](requested => <>delivered)', '<>delivered', 'A Request That Arrives Later'],
    ['upload-capstone', 0, true, 'either { uploaded := TRUE; }\n    or { skip; };', 'skip;', 'The Stop Decision']
  ];
  for (const [key, checkIndex, reference, before, after, title] of cases) {
    const step = pluscalStep(key);
    const files = replaceSource(workspace(step, reference), step.run_file, before, after);
    assert.deepEqual(applicableHints(step.tests[checkIndex], files).map(hint => hint.title), [title]);
  }
  const step = pluscalStep('playlist-property');
  const selectedWithoutAlgorithm = workspace(step, true);
  selectedWithoutAlgorithm[step.run_file] = '';
  assert.deepEqual(applicableHints(step.tests[1], selectedWithoutAlgorithm).map(hint => hint.title), ['Restore the Evidence']);
});

const pluscalOutcomes = [
  { key: 'playlist-states', starter: 0, reference: 0 },
  { key: 'playlist-boundary', starter: 12, reference: 0, evidence: /Invariant CountWithinLimit is violated\.[\s\S]*count = 3/ },
  { key: 'playlist-property', starter: 0, reference: 12, evidence: /Invariant WithinCapacity is violated\.[\s\S]*count = 3/ },
  { key: 'ticket-interleavings', starter: 12, reference: 12, evidence: /Invariant Capacity is violated\.[\s\S]*sold = 2/ },
  { key: 'atomic-reservations', starter: 12, reference: 0, evidence: /Invariant Capacity is violated\.[\s\S]*sold = 2/ },
  { key: 'temporal-truth', starter: 0, reference: 0 },
  { key: 'eventual-upload', starter: 13, reference: 0, evidence: /Temporal property EventuallyUploaded was violated\.[\s\S]*Stuttering/ },
  { key: 'response-contract', starter: 0, reference: 13, evidence: /Temporal property Response was violated\./ },
  { key: 'upload-capstone', starter: 13, reference: 0, evidence: /Temporal property Finished was violated\./ },
  { key: 'scoped-evidence', starter: 0, reference: 0 }
];

for (const outcome of pluscalOutcomes) {
  for (const reference of [false, true]) {
    test(outcome.key + ': the ' + (reference ? 'reference' : 'starter') + ' model demonstrates its intended checking outcome', { skip: javaUnavailable }, () => {
      const step = pluscalStep(outcome.key);
      const result = check(workspace(step, reference), {
        pluscal: true, entry: step.run_file, config: (step.tla || pluscalTutorial.tla).config_file
      });
      const expectedStatus = reference ? outcome.reference : outcome.starter;
      assert.equal(result.status, expectedStatus, result.output);
      if (expectedStatus === 0) assertComplete(result);
      else assert.match(result.output, outcome.evidence);
    });
  }
}

test('the temporal comparison distinguishes eventually true now from always true', { skip: javaUnavailable }, () => {
  const step = pluscalStep('temporal-truth');
  const files = replaceSource(workspace(step), 'Model.cfg', 'PROPERTY EverPlaying', 'PROPERTY AlwaysPlaying');
  const result = check(files, { pluscal: true });
  // TLC recognizes []playing as an invariant and gives a finite safety trace.
  assert.equal(result.status, 12, result.output);
  assert.match(result.output, /Invariant playing is violated\.[\s\S]*playing = FALSE/);
});

async function assessAuthoredModel(step, files, defaults) {
  const { snapshot } = await import('../../js/tla/model.mjs');
  const assessment = await import('../../js/tla/assessment.mjs');
  const source = snapshot(files, step, defaults);
  const outcomes = [];
  for (const criterion of step.tests || []) {
    const request = assessment.buildCheck(source, criterion.tla);
    const result = runAssessment(request);
    outcomes.push({ description: criterion.description, result, passed: assessment.assess(result, criterion.tla) });
  }
  return outcomes;
}

function assertAssessment(outcomes, accepted, context) {
  assert.ok(outcomes.length > 0, 'The exercise must provide semantic assessment.');
  for (const outcome of outcomes) {
    assert.equal(typeof outcome.passed, 'boolean', context + ': checks must finish without a tool error: ' + JSON.stringify(outcome));
  }
  assert.equal(outcomes.every(outcome => outcome.passed === true), accepted,
    context + ': ' + JSON.stringify(outcomes));
}

function runAssessment(request) {
  const bridge = path.join(root, 'js/vendor/tlaplus/1.8.0-fc6878c603f0/sebook-tla-bridge.jar');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sebook-pluscal-assessment-'));
  try {
    assert.ok(javaSupported, 'JAVA_BIN must select a working Java 11+ runtime.');
    const execution = spawnSync(java, ['-XX:+UseParallelGC', '-Xmx256m', '-cp', jar + path.delimiter + bridge, 'sebook.tla.Bridge'], {
      cwd: directory, input: JSON.stringify(request) + '\n', encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024
    });
    assert.ifError(execution.error);
    assert.equal(execution.status, 0, execution.stderr);
    return JSON.parse(execution.stdout.trim());
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('PlusCal Test My Work accepts every reference program through the actual assessment bridge', { skip: javaUnavailable }, async () => {
  for (const step of pluscalTutorial.steps) {
    const outcomes = await assessAuthoredModel(step, workspace(step, true), pluscalTutorial.tla);
    for (const { description, result, passed } of outcomes) {
      assert.equal(passed, true, step.key + ': ' + description + ': ' + JSON.stringify(result));
    }
  }
});

test('the playlist boundary checks accept equivalent guards and reject early termination', { skip: javaUnavailable }, async () => {
  const step = pluscalStep('playlist-boundary');
  // This exercise limits edits to the guard. Safety and a terminal-state
  // obligation do not establish progress for arbitrary replacement programs.
  for (const [guard, expected] of [['count <= 1', true], ['count # 2', true], ['FALSE', false], ['count < 1', false]]) {
    const files = replaceSource(workspace(step, true), step.run_file, 'count < 2', guard);
    const outcomes = await assessAuthoredModel(step, files, pluscalTutorial.tla);
    assertAssessment(outcomes, expected, guard);
  }
});

test('writing a property requires both the correct boundary and selecting it for checking', { skip: javaUnavailable }, async () => {
  const step = pluscalStep('playlist-property');
  const variants = [
    { expression: 'count <= 2', select: false, expected: false },
    { expression: 'TRUE', select: true, expected: false },
    { expression: 'count < 0', select: true, expected: false },
    { expression: 'count < 2', select: true, expected: false },
    { expression: 'count \\in 0..2', select: true, expected: true }
  ];
  for (const variant of variants) {
    const files = replaceSource(workspace(step), step.run_file, 'WithinCapacity == TRUE', 'WithinCapacity == ' + variant.expression);
    if (variant.select) files[pluscalTutorial.tla.config_file] += '\nINVARIANT WithinCapacity\n';
    const outcomes = await assessAuthoredModel(step, files, pluscalTutorial.tla);
    assert.ok(outcomes.length >= 2, 'The property exercise must assess meaning and selection separately.');
    assertAssessment(outcomes, variant.expected, JSON.stringify(variant));
  }
});

test('unfinished PlusCal exercises do not receive credit for safe or vacuous starter behavior', { skip: javaUnavailable }, async () => {
  for (const key of ['playlist-boundary', 'playlist-property', 'atomic-reservations', 'eventual-upload', 'response-contract', 'upload-capstone']) {
    const step = pluscalStep(key);
    assertAssessment(await assessAuthoredModel(step, workspace(step), pluscalTutorial.tla), false, key);
  }
});

test('atomic reservation checks reject repairs that make no sale', { skip: javaUnavailable }, async () => {
  const step = pluscalStep('atomic-reservations');
  for (const [before, after] of [['sold := sold + 1;', 'skip;'], ['sold < 1', 'FALSE']]) {
    const files = replaceSource(workspace(step, true), step.run_file, before, after);
    assertAssessment(await assessAuthoredModel(step, files, pluscalTutorial.tla), false, after);
  }
});

test('fairness cannot turn a disabled or ineffective upload into progress', { skip: javaUnavailable }, async () => {
  const step = pluscalStep('eventual-upload');
  for (const replacement of ['skip;', 'await FALSE;\n  uploaded := TRUE;']) {
    const files = replaceSource(workspace(step, true), step.run_file, 'uploaded := TRUE;', replacement);
    assertAssessment(await assessAuthoredModel(step, files, pluscalTutorial.tla), false, replacement);
  }
});

test('response grading accepts leads-to and rejects missing, overly strict, or initially vacuous obligations', { skip: javaUnavailable }, async () => {
  const step = pluscalStep('response-contract');
  for (const [expression, accepted] of [
    ['requested ~> delivered', true], ['<>delivered', false],
    ['[](requested => delivered)', false], ['requested => <>delivered', false]
  ]) {
    const files = replaceSource(workspace(step, true), step.run_file,
      'Response == [](requested => <>delivered)', 'Response == ' + expression);
    assertAssessment(await assessAuthoredModel(step, files, pluscalTutorial.tla), accepted, expression);
  }
});

test('the retry capstone rejects excess, futile, compulsory-success, repeated-success, and unfair attempts', { skip: javaUnavailable }, async () => {
  const step = pluscalStep('upload-capstone');
  const choice = 'either { uploaded := TRUE; }\n    or { skip; };';
  for (const [name, before, after] of [
    ['excess attempt', 'attempts < RetryLimit', 'attempts <= RetryLimit'],
    ['no successful behavior', choice, 'skip;'],
    ['no failed behavior', choice, 'uploaded := TRUE;'],
    ['retry after success', ' /\\ ~uploaded', ''],
    ['no attempt accounting', 'attempts := attempts + 1;', 'skip;'],
    ['skipped attempt accounting', 'attempts := attempts + 1;', 'attempts := attempts + RetryLimit;'],
    ['unfair scheduling', '--fair algorithm', '--algorithm']
  ]) {
    const files = replaceSource(workspace(step, true), step.run_file, before, after);
    assertAssessment(await assessAuthoredModel(step, files, pluscalTutorial.tla), false, name);
  }
});

test('the retry reference generalizes to a larger budget while retaining the zero-budget check', { skip: javaUnavailable }, async () => {
  const step = structuredClone(pluscalStep('upload-capstone'));
  for (const criterion of step.tests) {
    criterion.tla.model_config = criterion.tla.model_config.replace('RetryLimit = 2', 'RetryLimit = 3');
  }
  assertAssessment(await assessAuthoredModel(step, workspace(step, true), pluscalTutorial.tla), true, 'retry budget 3 and zero');
});

test('the retry capstone accepts an equivalent reordered stopping condition', { skip: javaUnavailable }, async () => {
  const step = pluscalStep('upload-capstone');
  const files = replaceSource(workspace(step, true), step.run_file,
    'attempts < RetryLimit /\\ ~uploaded', '~uploaded /\\ attempts # RetryLimit');
  assertAssessment(await assessAuthoredModel(step, files, pluscalTutorial.tla), true, 'equivalent retry guard');
});

test('removing or weakening the editable property cannot pass the faulty loop exercise', { skip: javaUnavailable }, async () => {
  const step = pluscalStep('playlist-boundary');
  const files = workspace(step);
  files['Model.cfg'] = files['Model.cfg'].replace(/^INVARIANT CountWithinLimit\n/m, '');
  files['Model.tla'] = files['Model.tla'].replace('CountWithinLimit == count <= 2', 'CountWithinLimit == TRUE');
  const [{ result, passed }] = await assessAuthoredModel(step, files, pluscalTutorial.tla);
  assert.equal(result.status, 'counterexample', JSON.stringify(result));
  assert.equal(result.reason, 'invariant');
  assert.equal(passed, false);
  assert.ok(result.trace.states.some(state => state.values.some(value => value.name === 'count' && value.text === '3')),
    'The trusted requirement must expose the real count-three counterexample.');
});

test('the broader tutorial reference models pass their actual authored invariant and temporal checks', { skip: javaUnavailable }, async () => {
  for (const step of tutorial.steps) {
    const outcomes = await assessAuthoredModel(step, workspace(step, true), tutorial.tla);
    for (const { description, result, passed } of outcomes) {
      assert.equal(result.status, 'complete', step.key + ': ' + description + ': ' + JSON.stringify(result));
      assert.equal(passed, true);
    }
  }
});

test('the broader tutorial faulty starters fail the exercise property independently of the editable configuration', { skip: javaUnavailable }, async () => {
  for (const key of ['invariant-counterexample', 'pluscal-concurrent-updates', 'liveness-and-fairness']) {
    const step = tutorial.steps.find(candidate => candidate.key === key);
    const files = workspace(step);
    files['Model.cfg'] = files['Model.cfg'].replace(/^(?:INVARIANT|PROPERTY) .+\n/gm, '');
    const outcomes = await assessAuthoredModel(step, files, tutorial.tla);
    for (const { description, result, passed } of outcomes) {
      assert.equal(result.status, 'counterexample', key + ': ' + description + ': ' + JSON.stringify(result));
      assert.equal(result.reason, key === 'liveness-and-fairness' ? 'liveness' : 'invariant');
      assert.equal(passed, false);
    }
  }
});
