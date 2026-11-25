// Unit tests of scripts/uml-editor-gate.js, the A/B gate of the UML editor refactor (spec §9.4).
// Each file-system test builds its own repository in a temporary directory. The fixtures below
// contain the gate's search patterns on purpose, so this file is itself a gate file: the gate
// guards its own rules.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gate = require('../uml-editor-gate');

const repositories = [];
after(() => {
  for (const root of repositories) fs.rmSync(root, { recursive: true, force: true });
});

function makeRepository(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uml-editor-gate-'));
  repositories.push(root);
  for (const [file, text] of Object.entries(files)) writeFile(root, file, text);
  return root;
}

function writeFile(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}

const ENVIRONMENT = { node: 'v22.18.0', playwright: '1.58.2', a11yInteractiveChecks: true };

function baselineWith(overrides) {
  return { environment: ENVIRONMENT, files: {}, wrapper: 'wrapper-hash', evidence: {}, outcomes: {}, unstable: [], ...overrides };
}

function currentWith(overrides) {
  return { environment: ENVIRONMENT, files: {}, wrapper: 'wrapper-hash', evidence: {}, outcomes: {}, reruns: {}, ...overrides };
}

test('finds a gate file by each pattern and ignores an unrelated test, a fixture, and a helper that contain a pattern', () => {
  const root = makeRepository({
    'tests/hit-layer.spec.js': "page.locator('#uml-pg-input')",
    'tests/editor-page.spec.js': "page.goto('/SEBook/tools/uml-editor')",
    'tests/playground.spec.js': "page.goto('/SEBook/tools/uml-playground')",
    'tests/include.spec.js': "read('_includes/uml-editor.html')",
    'scripts/tests/wrapper.test.js': 'new sandbox.UMLTutorialEditor(null, {})',
    'tests/backend-quoted.spec.js': "openFixture(page, { backend: 'uml-editor' })",
    'tests/backend-json.spec.js': '{ "backend": "uml-editor" }',
    'tests/backend-yaml.spec.js': 'const yaml = `backend: uml-editor`;',
    'tests/unrelated.spec.js': "page.goto('/SEBook/uml_class_diagram')",
    'tests/fixtures/uml-editor-corpus/class/add.json': '{ "page": "/SEBook/tools/uml-editor" }',
    'tests/fixtures/sample.spec.js': "page.locator('#uml-pg-input')",
    'scripts/tests/helpers/uml-editor-script.js': "assignmentsTo(ast, 'textarea.value') // #uml-pg-input",
    'tests/uml-renderer.spec.js': 'renders every diagram',
  });

  assert.deepEqual(gate.findGateFiles(root), [
    'scripts/tests/wrapper.test.js',
    'tests/backend-json.spec.js',
    'tests/backend-quoted.spec.js',
    'tests/backend-yaml.spec.js',
    'tests/editor-page.spec.js',
    'tests/hit-layer.spec.js',
    'tests/include.spec.js',
    'tests/playground.spec.js',
    'tests/uml-renderer.spec.js',
  ]);
});

test('always includes tests/uml-renderer.spec.js', () => {
  const root = makeRepository({ 'tests/uml-renderer.spec.js': "test('renders a class diagram', () => {});" });

  assert.deepEqual(gate.findGateFiles(root), ['tests/uml-renderer.spec.js']);
});

test('keys one title run in two projects as two outcomes', () => {
  const root = '/repo';
  const report = {
    config: { rootDir: '/repo/tests' },
    suites: [{
      title: 'uml-readable-sizing.spec.js',
      file: 'uml-readable-sizing.spec.js',
      specs: [],
      suites: [{
        title: 'reading view',
        file: 'uml-readable-sizing.spec.js',
        suites: [],
        specs: [{
          title: 'diagram text stays paragraph-sized',
          file: 'uml-readable-sizing.spec.js',
          line: 35,
          tests: [
            { projectName: 'chromium', status: 'expected', results: [{ status: 'passed' }] },
            { projectName: 'observer-firefox', status: 'unexpected', results: [{ status: 'timedOut' }] },
          ],
        }],
      }],
    }],
    errors: [],
  };

  assert.deepEqual(gate.outcomesFromPlaywrightReport(report, root).outcomes, {
    'chromium › tests/uml-readable-sizing.spec.js › reading view › diagram text stays paragraph-sized': 'passed',
    'observer-firefox › tests/uml-readable-sizing.spec.js › reading view › diagram text stays paragraph-sized': 'timedOut',
  });
});

test('keys node:test outcomes by their suite path, and a file that fails to load as one failure', () => {
  const root = makeRepository({
    'scripts/tests/sample.test.js': [
      "const test = require('node:test');",
      "const assert = require('node:assert');",
      "test('passes at the top level', () => {});",
      "test.describe('a group', () => {",
      "  test('fails inside it', () => assert.equal(1, 2));",
      "  test('keeps a # in its title', () => {});",
      '});',
      "test('is skipped', { skip: true }, () => {});",
    ].join('\n'),
    'scripts/tests/broken.test.js': "require('./a-module-that-does-not-exist');",
  });

  assert.deepEqual(gate.runNodeTests(root, ['scripts/tests/sample.test.js', 'scripts/tests/broken.test.js']).outcomes, {
    'node › scripts/tests/sample.test.js › passes at the top level': 'passed',
    'node › scripts/tests/sample.test.js › a group › fails inside it': 'failed',
    'node › scripts/tests/sample.test.js › a group › keeps a # in its title': 'passed',
    'node › scripts/tests/sample.test.js › is skipped': 'skipped',
    'node › scripts/tests/broken.test.js › (file)': 'failed',
  });
});

test('compareToBaseline reports a changed gate file, a changed evidence file, a removed fixture, a newly failing test, and a failing new file, and accepts a new file whose tests pass', () => {
  const baseline = baselineWith({
    files: { 'tests/kept.spec.js': 'kept-hash', 'tests/edited.spec.js': 'edited-hash' },
    evidence: {
      'tests/fixtures/uml-editor-corpus/class/add.json': 'add-hash',
      'tests/fixtures/uml-editor-corpus/class/remove.json': 'remove-hash',
      'tests/uml-editor-corpus/observe.js': 'observe-hash',
    },
    outcomes: {
      'chromium › tests/kept.spec.js › adds a class': ['passed', 'passed'],
      'chromium › tests/kept.spec.js › renames a class': ['passed', 'passed'],
    },
  });
  const current = currentWith({
    files: {
      'tests/kept.spec.js': 'kept-hash',
      'tests/edited.spec.js': 'edited-hash-2',
      'tests/new-failing.spec.js': 'new-failing-hash',
      'tests/new-passing.spec.js': 'new-passing-hash',
    },
    evidence: {
      'tests/fixtures/uml-editor-corpus/class/add.json': 'add-hash',
      'tests/uml-editor-corpus/observe.js': 'observe-hash-2',
    },
    outcomes: {
      'chromium › tests/kept.spec.js › adds a class': 'passed',
      'chromium › tests/kept.spec.js › renames a class': 'failed',
      'chromium › tests/new-failing.spec.js › opens the menu': 'failed',
      'chromium › tests/new-passing.spec.js › moves a class': 'passed',
    },
    reruns: { 'chromium › tests/kept.spec.js › renames a class': 'failed' },
  });

  assert.deepEqual(gate.compareToBaseline(baseline, current), {
    changedFiles: ['tests/edited.spec.js'],
    changedEvidence: ['tests/fixtures/uml-editor-corpus/class/remove.json', 'tests/uml-editor-corpus/observe.js'],
    newFailures: ['chromium › tests/kept.spec.js › renames a class'],
    failingNewFiles: [{ file: 'tests/new-failing.spec.js', tests: ['chromium › tests/new-failing.spec.js › opens the menu'] }],
    environmentMismatch: [],
  });
});

test('compareToBaseline reports a changed wrapper, an added fixture, and each environment value that differs', () => {
  const baseline = baselineWith({ evidence: { 'tests/fixtures/uml-editor-corpus/class/add.json': 'add-hash' } });
  const current = currentWith({
    wrapper: 'wrapper-hash-2',
    environment: { ...ENVIRONMENT, playwright: '1.59.0' },
    evidence: {
      'tests/fixtures/uml-editor-corpus/class/add.json': 'add-hash',
      'tests/fixtures/uml-editor-corpus/class/added.json': 'added-hash',
    },
  });

  const comparison = gate.compareToBaseline(baseline, current);

  assert.deepEqual(comparison.changedFiles, ['js/tutorial-uml-editor.js']);
  assert.deepEqual(comparison.changedEvidence, ['tests/fixtures/uml-editor-corpus/class/added.json']);
  assert.deepEqual(comparison.environmentMismatch, [{ name: 'playwright', baseline: '1.58.2', current: '1.59.0' }]);
});

test('a test that failed in either R0 run is not counted as passed at R0', () => {
  const baseline = baselineWith({
    files: { 'tests/flaky.spec.js': 'flaky-hash' },
    outcomes: {
      'chromium › tests/flaky.spec.js › failed in the first run': ['failed', 'passed'],
      'chromium › tests/flaky.spec.js › failed in the second run': ['passed', 'timedOut'],
    },
    unstable: ['chromium › tests/flaky.spec.js › failed in the first run', 'chromium › tests/flaky.spec.js › failed in the second run'],
  });
  const current = currentWith({
    files: { 'tests/flaky.spec.js': 'flaky-hash' },
    outcomes: {
      'chromium › tests/flaky.spec.js › failed in the first run': 'failed',
      'chromium › tests/flaky.spec.js › failed in the second run': 'failed',
    },
  });

  assert.deepEqual(gate.compareToBaseline(baseline, current).newFailures, []);
});

test('a new failure counts only when the re-run alone fails too', () => {
  const key = 'chromium › tests/kept.spec.js › moves a class';
  const baseline = baselineWith({ files: { 'tests/kept.spec.js': 'kept-hash' }, outcomes: { [key]: ['passed', 'passed'] } });
  const failing = { files: { 'tests/kept.spec.js': 'kept-hash' }, outcomes: { [key]: 'failed' } };

  assert.deepEqual(gate.compareToBaseline(baseline, currentWith({ ...failing, reruns: { [key]: 'passed' } })).newFailures, []);
  assert.deepEqual(gate.compareToBaseline(baseline, currentWith({ ...failing, reruns: { [key]: 'failed' } })).newFailures, [key]);
});

test('seal refuses once a write site is converted', () => {
  const root = makeRepository({
    'tests/fixtures/uml-editor-corpus/class/add.json': JSON.stringify({ id: 'add', operations: [] }),
    'scripts/tests/fixtures/uml-editor-write-sites.json': JSON.stringify({
      'commitSource#1': { key: 'commitSource#1', status: 'assignment' },
    }),
  });
  const sealed = gate.sealEvidence(root, baselineWith({}));
  assert.ok(sealed.evidence['tests/fixtures/uml-editor-corpus/class/add.json'], 'before any conversion the seal records the fixture');

  writeFile(root, 'scripts/tests/fixtures/uml-editor-write-sites.json', JSON.stringify({
    'commitSource#1': { key: 'commitSource#1', status: 'converted' },
  }));

  assert.throws(() => gate.sealEvidence(root, sealed), { name: 'GateRefusal', message: /converted/ });
});

test("a fixture's operations and key order leave its evidence hash unchanged, and any other field changes it", () => {
  const fixture = 'tests/fixtures/uml-editor-corpus/class/add.json';
  const root = makeRepository({ [fixture]: JSON.stringify({ id: 'add', after: { text: 'class A' }, operations: [] }) });
  const sealedHash = gate.evidenceOf(root)[fixture];

  writeFile(root, fixture, JSON.stringify({ operations: [{ kind: 'element.add' }], after: { text: 'class A' }, id: 'add' }));
  assert.equal(gate.evidenceOf(root)[fixture], sealedHash);

  writeFile(root, fixture, JSON.stringify({ id: 'add', after: { text: 'class B' }, operations: [] }));
  assert.notEqual(gate.evidenceOf(root)[fixture], sealedHash);
});

test('an accepted change is compared with its accepted hash and counted in the last line, and a later edit of that file fails again', () => {
  const file = 'tests/menus.spec.js';
  const listsTheMenu = `chromium › ${file} › the context menu lists its items`;
  const baseline = baselineWith({ files: { [file]: 'r0-hash' }, outcomes: { [listsTheMenu]: ['passed', 'passed'] } });
  const accepted = gate.acceptChange(
    baseline,
    { file, sha256: 'accepted-hash', reason: 'the menu now lists "Move…"', date: '2026-11-20T10:00:00.000Z' },
    () => ({ [listsTheMenu]: 'passed' }),
  );
  const run = files => currentWith({ files, outcomes: { [listsTheMenu]: 'passed' } });

  const afterAcceptance = gate.compareToBaseline(accepted, run({ [file]: 'accepted-hash' }));
  assert.deepEqual(afterAcceptance.changedFiles, []);
  assert.equal(
    gate.summaryLine(accepted, afterAcceptance, 1),
    'gate: 1 files, 0 changed since R0, 1 accepted, evidence not sealed yet, 0 new failures',
  );

  assert.deepEqual(gate.compareToBaseline(accepted, run({ [file]: 'later-edit-hash' })).changedFiles, [file]);
});

test('accept-change without a reason is refused', () => {
  const file = 'tests/menus.spec.js';
  const baseline = baselineWith({ files: { [file]: 'r0-hash' } });
  let runs = 0;
  const runFile = () => { runs += 1; return {}; };

  for (const reason of [undefined, '', '   ']) {
    assert.throws(
      () => gate.acceptChange(baseline, { file, sha256: 'accepted-hash', reason, date: '2026-11-20T10:00:00.000Z' }, runFile),
      { name: 'GateRefusal', message: /reason/ },
    );
  }
  assert.equal(runs, 0, 'a refused acceptance runs no test');
});
