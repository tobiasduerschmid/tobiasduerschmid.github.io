#!/usr/bin/env node
'use strict';
/**
 * uml-editor-gate.js: the A/B gate of the UML editor refactor
 * (docs/superpowers/specs/2026-11-12-c4-uml-view-editing.md §9.4; plan Task 1).
 *
 * While the editor's code moves, every suite that drives it must keep passing with its file unchanged.
 * The list of those suites is derived, so it cannot drift: a gate file is a `*.spec.js` or `*.test.js`
 * under tests/ or scripts/tests/ (never inside a fixtures or helpers folder) whose text names the
 * editor, plus tests/uml-renderer.spec.js for the bundle.
 *
 * A baseline, recorded once at stage R0, holds the environment, the sha256 of every gate file and of
 * js/tutorial-uml-editor.js, the sealed evidence (empty until Task 9 seals it), the outcome of every
 * test in two runs, and the keys whose two outcomes differ. Outcome keys read
 * `<project> › <file> › <title path>`; node:test files use the project `node`, and a file that fails
 * to load is keyed with the title `(file)`.
 *
 * Usage, from the repository root. Playwright runs only against the built site
 * (PLAYWRIGHT_SERVE_BUILT_SITE=1), so the gate never starts a site build of its own.
 *   node scripts/uml-editor-gate.js --list [--baseline <file>]
 *   node scripts/uml-editor-gate.js --record-baseline <file>
 *   node scripts/uml-editor-gate.js --seal-evidence <file>
 *   node scripts/uml-editor-gate.js --baseline <file>
 *   node scripts/uml-editor-gate.js --baseline <file> --accept-change <gate file> --reason <text>
 *
 * Exit codes: 0 the gate holds; 1 the gate failed; 2 refused (usage, environment, or a baseline rule).
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SEARCH_DIRS = ['tests', 'scripts/tests'];
const SUPPORT_DIRS = new Set(['fixtures', 'helpers', 'node_modules']);
const TEST_FILE = /\.(spec|test)\.js$/;
const GATE_PATTERNS = [
  /uml-pg-/,
  /tools\/uml-editor/,
  /uml-playground/,
  /uml-editor\.html/,
  /UMLTutorialEditor/,
  /\bbackend['"`]?\s*:\s*['"`]?uml-editor\b/,
];
const ALWAYS_GATED = ['tests/uml-renderer.spec.js'];
const WRAPPER = 'js/tutorial-uml-editor.js';
const WRITE_SITE_MAP = 'scripts/tests/fixtures/uml-editor-write-sites.json';
const CORPUS_FIXTURES = 'tests/fixtures/uml-editor-corpus';
const CORPUS_CODE = 'tests/uml-editor-corpus';
const STYLE_EVIDENCE = [
  'tests/uml-editor-computed-styles.spec.js',
  'tests/fixtures/uml-editor-computed-styles.json',
  'scripts/tests/helpers/uml-editor-script.js',
];

const SEPARATOR = ' › ';
const NODE_PROJECT = 'node';
const PLAYWRIGHT_PROJECT = 'playwright';
const WHOLE_FILE = '(file)';
const PASSED = 'passed';
const MISSING = 'missing';
const FAILING = new Set(['failed', 'timedOut', 'interrupted']);
// A broad breakage needs no confirmation: beyond this many candidates the failures count without re-runs.
const MAX_RERUNS = 20;

class GateRefusal extends Error {
  constructor(message) {
    super(message);
    this.name = 'GateRefusal';
  }
}

// ---------- gate files ----------

function listFiles(root, dir, skipDirs = new Set()) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return skipDirs.has(entry.name) ? [] : listFiles(root, relative, skipDirs);
    return entry.isFile() ? [relative] : [];
  });
}

function namesTheEditor(text) {
  return GATE_PATTERNS.some(pattern => pattern.test(text));
}

/** The gate files of the repository at `root`: repository-relative POSIX paths, sorted. */
function findGateFiles(root) {
  const matching = SEARCH_DIRS
    .flatMap(dir => listFiles(root, dir, SUPPORT_DIRS))
    .filter(file => TEST_FILE.test(file))
    .filter(file => namesTheEditor(fs.readFileSync(path.join(root, file), 'utf8')));
  return [...new Set([...matching, ...ALWAYS_GATED])].sort();
}

// ---------- hashes and evidence ----------

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hashFile(root, file) {
  const absolute = path.join(root, file);
  return fs.existsSync(absolute) ? sha256(fs.readFileSync(absolute)) : null;
}

function hashFiles(root, files) {
  return Object.fromEntries(files.map(file => [file, hashFile(root, file)]));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])]));
}

// The operation log is the one part of a fixture that later stages may write (Task 11).
function withoutOperations(fixture) {
  if (Array.isArray(fixture)) return fixture.map(withoutOperations);
  if (fixture === null || typeof fixture !== 'object') return fixture;
  return Object.fromEntries(Object.entries(fixture).filter(([key]) => key !== 'operations'));
}

function fixtureHash(root, file) {
  const raw = fs.readFileSync(path.join(root, file), 'utf8');
  if (!file.endsWith('.json')) return sha256(raw);
  let fixture;
  try {
    fixture = JSON.parse(raw);
  } catch (error) {
    throw new GateRefusal(`refused: the corpus fixture ${file} is not valid JSON (${error.message})`);
  }
  return sha256(JSON.stringify(sortKeys(withoutOperations(fixture))));
}

/** The evidence the seal covers: corpus fixtures without `operations`, the corpus code, and the style evidence. */
function evidenceOf(root) {
  const fixtures = listFiles(root, CORPUS_FIXTURES).map(file => [file, fixtureHash(root, file)]);
  const code = listFiles(root, CORPUS_CODE).map(file => [file, hashFile(root, file)]);
  const styles = STYLE_EVIDENCE.map(file => [file, hashFile(root, file)]);
  return sortKeys(Object.fromEntries([...fixtures, ...code, ...styles]));
}

function holdsConvertedEntry(value) {
  if (Array.isArray(value)) return value.some(holdsConvertedEntry);
  if (value === null || typeof value !== 'object') return false;
  return value.status === 'converted' || Object.values(value).some(holdsConvertedEntry);
}

function writeSiteConverted(root) {
  const map = path.join(root, WRITE_SITE_MAP);
  return fs.existsSync(map) && holdsConvertedEntry(JSON.parse(fs.readFileSync(map, 'utf8')));
}

/** The baseline with its evidence sealed; refused once stage R1 has converted a write site. */
function sealEvidence(root, baseline) {
  if (writeSiteConverted(root)) {
    throw new GateRefusal(`refused: ${WRITE_SITE_MAP} holds a converted write site, so the evidence can no longer be sealed`);
  }
  return { ...baseline, evidence: evidenceOf(root) };
}

// ---------- outcomes ----------

function keyOf(project, file, titles) {
  return [project, file, ...titles].join(SEPARATOR);
}

function fileOfKey(key) {
  return key.split(SEPARATOR)[1];
}

// Two tests with one title in one file stay apart as "<title> [2]", "<title> [3]", … in run order.
function addOutcome(run, key, outcome, location) {
  let unique = key;
  for (let ordinal = 2; unique in run.outcomes; ordinal += 1) unique = `${key} [${ordinal}]`;
  run.outcomes[unique] = outcome;
  run.locations[unique] = location;
}

function emptyRun() {
  return { outcomes: {}, locations: {}, errors: [] };
}

function playwrightOutcome(test) {
  if (test.status === 'skipped') return 'skipped';
  if (test.status === 'expected') return PASSED;
  if (test.status === 'flaky') return 'flaky';
  const last = test.results[test.results.length - 1];
  return last && last.status !== PASSED ? last.status : 'failed';
}

/** Outcomes and locations from a report of Playwright's JSON reporter. */
function outcomesFromPlaywrightReport(report, root) {
  const run = emptyRun();
  const fileOf = specFile => path.relative(root, path.join(report.config.rootDir, specFile)).split(path.sep).join('/');
  const visit = (suite, titles) => {
    for (const spec of suite.specs || []) {
      const file = fileOf(spec.file);
      for (const test of spec.tests) {
        const location = { project: test.projectName, file, line: spec.line };
        addOutcome(run, keyOf(test.projectName, file, [...titles, spec.title]), playwrightOutcome(test), location);
      }
    }
    for (const child of suite.suites || []) visit(child, [...titles, child.title]);
  };
  for (const fileSuite of report.suites || []) visit(fileSuite, []);
  for (const error of report.errors || []) {
    if (!error.location) run.errors.push(error.message);
    else {
      const file = path.relative(root, error.location.file).split(path.sep).join('/');
      addOutcome(run, keyOf(PLAYWRIGHT_PROJECT, file, [WHOLE_FILE]), 'failed', { project: PLAYWRIGHT_PROJECT, file, line: null });
    }
  }
  return run;
}

const TAP_UNESCAPES = { b: '\b', f: '\f', t: '\t', n: '\n', r: '\r', v: '\v', '\\': '\\', '#': '#' };

function unescapeTap(text) {
  return text.replace(/\\(.)/g, (match, char) => TAP_UNESCAPES[char] ?? match);
}

function tapOutcome(status, directive) {
  if (directive === 'SKIP') return 'skipped';
  if (directive === 'TODO') return 'todo';
  return status === 'ok' ? PASSED : 'failed';
}

// Every result line of Node's TAP reporter, with the titles of the subtests around it.
function tapResults(tap) {
  const results = [];
  const open = [];
  let yamlIndent = null;
  for (const line of tap.split('\n')) {
    const indent = line.length - line.trimStart().length;
    const text = line.trim();
    if (yamlIndent !== null) {
      if (indent === yamlIndent && text === '...') yamlIndent = null;
      continue;
    }
    const depth = Math.floor(indent / 4);
    const subtest = /^# Subtest: (.*)$/.exec(text);
    const result = /^(not ok|ok) \d+ - (.*?)(?: # (SKIP|TODO)\b.*)?$/.exec(text);
    if (subtest) {
      open.length = depth;
      if (depth > 0 && open[depth - 1]) open[depth - 1].hasChildren = true;
      open[depth] = { name: unescapeTap(subtest[1]), hasChildren: false };
    } else if (result) {
      const titles = [...open.slice(0, depth).map(parent => parent.name), unescapeTap(result[2])];
      results.push({ titles, outcome: tapOutcome(result[1], result[3]), hasChildren: Boolean(open[depth]?.hasChildren) });
    } else if (text === '---') {
      yamlIndent = indent;
    }
  }
  return results;
}

const startsWith = (titles, prefix) => prefix.every((title, index) => titles[index] === title);

// Leaves carry the outcomes; a parent counts only when it failed without a failing child (a hook failed).
function reportedTests(results) {
  return results.filter(result => !result.hasChildren || (result.outcome === 'failed' && !results.some(other =>
    other !== result && other.titles.length > result.titles.length && startsWith(other.titles, result.titles) && other.outcome === 'failed')));
}

function testEnvironment() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // set inside a node:test run; it would turn the child's report into the parent's protocol
  return env;
}

/** Runs each node:test file alone with the TAP reporter; outcomes keyed `node › <file> › <title path>`. */
function runNodeTests(root, files) {
  const run = emptyRun();
  for (const file of files) {
    const child = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], {
      cwd: root, env: testEnvironment(), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
    });
    const tests = reportedTests(tapResults(child.stdout || ''));
    for (const { titles, outcome } of tests) {
      const loadFailure = titles.length === 1 && path.resolve(root, titles[0]) === path.resolve(root, file);
      addOutcome(run, keyOf(NODE_PROJECT, file, loadFailure ? [WHOLE_FILE] : titles), outcome, { project: NODE_PROJECT, file, line: null });
    }
    if (tests.length === 0 && child.status !== 0) {
      addOutcome(run, keyOf(NODE_PROJECT, file, [WHOLE_FILE]), 'failed', { project: NODE_PROJECT, file, line: null });
    }
  }
  return run;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Playwright reads a file argument as a pattern over absolute paths; this one matches the file only.
function fileFilter(file) {
  return `(?:^|/)${escapeRegExp(file)}$`;
}

function runPlaywright(root, args) {
  const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uml-editor-gate-'));
  const reportFile = path.join(reportDir, 'report.json');
  try {
    const child = spawnSync('npx', ['playwright', 'test', ...args, '--reporter=list,json'], {
      cwd: root,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, A11Y_INTERACTIVE_CHECKS: '1', PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile },
    });
    if (!fs.existsSync(reportFile)) return { ...emptyRun(), errors: [`Playwright wrote no report (exit ${child.status})`] };
    return outcomesFromPlaywrightReport(JSON.parse(fs.readFileSync(reportFile, 'utf8')), root);
  } finally {
    fs.rmSync(reportDir, { recursive: true, force: true });
  }
}

function mergeRuns(runs, files) {
  const merged = emptyRun();
  for (const run of runs) {
    for (const [key, outcome] of Object.entries(run.outcomes)) {
      if (files.includes(fileOfKey(key))) addOutcome(merged, key, outcome, run.locations[key]);
    }
    merged.errors.push(...run.errors);
  }
  return merged;
}

/** One run of the given gate files: every spec in one Playwright call, every unit test through node --test. */
function runGateFiles(root, files) {
  const present = files.filter(file => fs.existsSync(path.join(root, file)));
  const specs = present.filter(file => file.endsWith('.spec.js'));
  const unitTests = present.filter(file => file.endsWith('.test.js'));
  const browser = specs.length > 0 ? runPlaywright(root, specs.map(fileFilter)) : emptyRun();
  return mergeRuns([browser, runNodeTests(root, unitTests)], files);
}

function rerunArguments(location) {
  if (location.project === PLAYWRIGHT_PROJECT) return [fileFilter(location.file)];
  return [`${fileFilter(location.file)}:${location.line}`, `--project=${location.project}`];
}

/** Re-runs each key alone in its project (a node:test file as a whole) and returns its outcome there. */
function rerunAlone(root, keys, locations) {
  const reruns = {};
  const runs = new Map();
  for (const key of keys.filter(candidate => locations[candidate])) {
    const location = locations[key];
    const isNode = location.project === NODE_PROJECT;
    const id = isNode ? location.file : rerunArguments(location).join(' ');
    if (!runs.has(id)) runs.set(id, isNode ? runNodeTests(root, [location.file]) : runPlaywright(root, rerunArguments(location)));
    reruns[key] = runs.get(id).outcomes[key] ?? MISSING;
  }
  return reruns;
}

// ---------- baselines ----------

function pairRuns(runs) {
  const keys = [...new Set(runs.flatMap(run => Object.keys(run)))].sort();
  return Object.fromEntries(keys.map(key => [key, runs.map(run => run[key] ?? MISSING)]));
}

function buildBaseline({ environment, files, wrapper, runs }) {
  const outcomes = pairRuns(runs);
  const unstable = Object.keys(outcomes).filter(key => new Set(outcomes[key]).size > 1);
  return { environment, files, wrapper, evidence: {}, outcomes, unstable };
}

function passedInEveryRun(runs) {
  return runs.length > 0 && runs.every(outcome => outcome === PASSED);
}

/** The keys that count as "passed at R0": both runs passed (for an accepted file, both acceptance runs). */
function passesAtR0(baseline) {
  const accepted = baseline.accepted || {};
  const fromR0 = Object.entries(baseline.outcomes).filter(([key]) => !(fileOfKey(key) in accepted));
  const fromAcceptance = Object.values(accepted).flatMap(change => Object.entries(change.outcomes));
  return new Set([...fromR0, ...fromAcceptance]
    .filter(([, runs]) => passedInEveryRun(runs))
    .map(([key]) => key));
}

// An accepted change needs a reason and must concern a gate file of the R0 baseline.
function validateAcceptance(baseline, { file, reason }) {
  if (typeof reason !== 'string' || reason.trim() === '') {
    throw new GateRefusal('refused: --accept-change needs --reason <text>: the absence the stage removes');
  }
  if (!(file in baseline.files)) {
    throw new GateRefusal(`refused: ${file} is not a gate file of the R0 baseline`);
  }
}

// An acceptance changes what a test of the file asserts, never which of its tests pass (spec §3.11: any
// other failure fails the stage). Without this check, a regression in the accepted file would drop out of
// "passed at R0" with the acceptance and from then on count as a known failure.
function requireR0PassesKept(baseline, file, outcomes) {
  const runsOf = key => outcomes[key] ?? [MISSING, MISSING];
  const notKept = [...passesAtR0(baseline)]
    .filter(key => fileOfKey(key) === file && !passedInEveryRun(runsOf(key)))
    .sort();
  if (notKept.length === 0) return;
  const details = notKept.map(key => `  ${key}: ${runsOf(key).join(', ')}`);
  throw new GateRefusal(`refused: ${file} is not accepted, because ${notKept.length} of its tests that passed at R0 `
    + `did not pass in both acceptance runs (the baseline is unchanged):\n${details.join('\n')}`);
}

/**
 * Records the one gate-file edit stage A1 may make. Validates before it runs anything; `runFile(file)`
 * returns the outcomes of one run of that file, and is called twice. Refuses, and records nothing, unless
 * every test of the file that passed at R0 passes in both runs.
 */
function acceptChange(baseline, { file, sha256: hash, reason, date }, runFile) {
  validateAcceptance(baseline, { file, reason });
  const outcomes = pairRuns([runFile(file), runFile(file)]);
  requireR0PassesKept(baseline, file, outcomes);
  const change = { file, sha256: hash, reason: reason.trim(), date, outcomes };
  return { ...baseline, accepted: { ...(baseline.accepted || {}), [file]: change } };
}

// ---------- comparison ----------

function expectedHash(baseline, file) {
  const accepted = (baseline.accepted || {})[file];
  return accepted ? accepted.sha256 : baseline.files[file];
}

function changedFiles(baseline, current) {
  const changed = Object.keys(baseline.files).filter(file => (current.files[file] ?? null) !== expectedHash(baseline, file));
  if ((current.wrapper ?? null) !== baseline.wrapper) changed.push(WRAPPER);
  return changed.sort();
}

function changedEvidence(sealed, current) {
  if (Object.keys(sealed).length === 0) return [];
  const changed = Object.keys(sealed).filter(file => (current[file] ?? null) !== sealed[file]);
  const addedFixtures = Object.keys(current).filter(file => file.startsWith(`${CORPUS_FIXTURES}/`) && !(file in sealed));
  return [...changed, ...addedFixtures].sort();
}

function newFailures(baseline, current) {
  const reruns = current.reruns || {};
  return [...passesAtR0(baseline)]
    .filter(key => current.outcomes[key] !== PASSED && reruns[key] !== PASSED)
    .sort();
}

function failingNewFiles(baseline, current) {
  const failingKeys = Object.keys(current.outcomes).filter(key => FAILING.has(current.outcomes[key])).sort();
  return Object.keys(current.files)
    .filter(file => !(file in baseline.files))
    .sort()
    .map(file => ({ file, tests: failingKeys.filter(key => fileOfKey(key) === file) }))
    .filter(entry => entry.tests.length > 0);
}

function environmentMismatch(expected = {}, actual = {}) {
  const names = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  return names
    .filter(name => JSON.stringify(expected[name] ?? null) !== JSON.stringify(actual[name] ?? null))
    .map(name => ({ name, baseline: expected[name] ?? null, current: actual[name] ?? null }));
}

/**
 * Compares a run with the baseline. `current` is `{ environment, files, wrapper, evidence, outcomes, reruns }`;
 * `reruns` holds the outcome of each re-run alone.
 */
function compareToBaseline(baseline, current) {
  return {
    changedFiles: changedFiles(baseline, current),
    changedEvidence: changedEvidence(baseline.evidence || {}, current.evidence || {}),
    newFailures: newFailures(baseline, current),
    failingNewFiles: failingNewFiles(baseline, current),
    environmentMismatch: environmentMismatch(baseline.environment, current.environment),
  };
}

function holds(comparison) {
  return Object.values(comparison).every(list => list.length === 0);
}

function evidenceState(baseline, comparison) {
  if (Object.keys(baseline.evidence || {}).length === 0) return 'not sealed yet';
  if (comparison.changedEvidence.length === 0) return 'sealed and unchanged';
  return `changed in ${comparison.changedEvidence.length} files`;
}

/** The last line of a gate run. */
function summaryLine(baseline, comparison, fileCount) {
  const accepted = Object.keys(baseline.accepted || {}).length;
  const failures = comparison.newFailures.length + comparison.failingNewFiles.reduce((sum, entry) => sum + entry.tests.length, 0);
  return `gate: ${fileCount} files, ${comparison.changedFiles.length} changed since R0, ${accepted} accepted, `
    + `evidence ${evidenceState(baseline, comparison)}, ${failures} new failures`;
}

// ---------- command line ----------

function packageVersion(root, name) {
  const manifest = path.join(root, 'node_modules', name, 'package.json');
  return fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')).version : null;
}

// What the gate's runs depend on beyond the files; a baseline is compared only under the same values.
function environmentOf(root, env = process.env) {
  return {
    node: process.version,
    playwright: packageVersion(root, '@playwright/test'),
    platform: `${process.platform}-${process.arch}`,
    ci: Boolean(env.CI),
    servesBuiltSite: env.PLAYWRIGHT_SERVE_BUILT_SITE === '1',
    a11yInteractiveChecks: true,
    a11yFeatures: env.A11Y_INTERACTIVE_FEATURES || null,
    wcagFullSweep: env.WCAG_AUDIT_FULL_SWEEP === '1',
    chromeExecutable: env.PLAYWRIGHT_CHROME_EXECUTABLE || null,
    lang: env.LANG || null,
    lcAll: env.LC_ALL || null,
  };
}

const VALUE_OPTIONS = new Set(['record-baseline', 'seal-evidence', 'baseline', 'accept-change', 'reason']);

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index].startsWith('--') ? argv[index].slice(2) : null;
    if (name === 'list') {
      options.list = true;
    } else if (VALUE_OPTIONS.has(name) && index + 1 < argv.length) {
      options[name] = argv[index + 1];
      index += 1;
    } else {
      throw new GateRefusal(`refused: unknown or incomplete argument ${argv[index]} (see the usage at the top of this script)`);
    }
  }
  return options;
}

function readJson(file) {
  if (!fs.existsSync(file)) throw new GateRefusal(`refused: ${file} does not exist`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function requireBuiltSite() {
  if (process.env.PLAYWRIGHT_SERVE_BUILT_SITE !== '1') {
    throw new GateRefusal('refused: set PLAYWRIGHT_SERVE_BUILT_SITE=1; the gate runs against the built site and never starts a build');
  }
}

function requireEnvironment(baseline, environment) {
  const mismatch = environmentMismatch(baseline.environment, environment);
  if (mismatch.length === 0) return;
  const details = mismatch.map(({ name, baseline: then, current }) => `${name} ${JSON.stringify(then)} → ${JSON.stringify(current)}`);
  throw new GateRefusal(`refused: the environment differs from the baseline's: ${details.join('; ')}`);
}

function printList(title, items) {
  if (items.length === 0) return;
  console.log(`${title} (${items.length}):`);
  for (const item of items) console.log(`  ${item}`);
}

function listCommand(options) {
  const files = findGateFiles(ROOT);
  for (const file of files) console.log(file);
  if (options.baseline) {
    for (const change of Object.values(readJson(options.baseline).accepted || {})) {
      console.log(`accepted: ${change.file} (${change.date}): ${change.reason}`);
    }
  }
  console.log(`gate: ${files.length} files`);
  return 0;
}

function recordCommand(options) {
  const target = options['record-baseline'];
  if (fs.existsSync(target)) throw new GateRefusal(`refused: ${target} exists; the baseline is recorded once, at R0`);
  requireBuiltSite();
  const files = findGateFiles(ROOT);
  const hashes = hashFiles(ROOT, files);
  const wrapper = hashFile(ROOT, WRAPPER);
  const runs = [1, 2].map(number => {
    console.log(`gate: run ${number} of 2 over ${files.length} files`);
    return runGateFiles(ROOT, files).outcomes;
  });
  const baseline = buildBaseline({ environment: environmentOf(ROOT), files: hashes, wrapper, runs });
  writeJson(target, baseline);
  const failedAtR0 = Object.keys(baseline.outcomes).filter(key => !passedInEveryRun(baseline.outcomes[key]));
  printList('not passed in both R0 runs', failedAtR0.map(key => `${key}: ${baseline.outcomes[key].join(', ')}`));
  printList('unstable', baseline.unstable);
  console.log(`gate: baseline recorded, ${files.length} files, ${Object.keys(baseline.outcomes).length} outcomes, `
    + `${failedAtR0.length} not passed at R0, ${baseline.unstable.length} unstable`);
  return 0;
}

function sealCommand(options) {
  const target = options['seal-evidence'];
  const sealed = sealEvidence(ROOT, readJson(target));
  writeJson(target, sealed);
  const missing = Object.keys(sealed.evidence).filter(file => sealed.evidence[file] === null);
  printList('sealed as absent', missing);
  console.log(`gate: evidence sealed, ${Object.keys(sealed.evidence).length} files`);
  return 0;
}

function acceptCommand(options) {
  const baseline = readJson(options.baseline);
  const file = options['accept-change'];
  const request = { file, sha256: hashFile(ROOT, file), reason: options.reason, date: new Date().toISOString() };
  validateAcceptance(baseline, request);
  requireBuiltSite();
  requireEnvironment(baseline, environmentOf(ROOT));
  const accepted = acceptChange(baseline, request, gateFile => runGateFiles(ROOT, [gateFile]).outcomes);
  writeJson(options.baseline, accepted);
  const { outcomes } = accepted.accepted[file];
  printList(`accepted ${file}, outcomes of its two runs`, Object.keys(outcomes).map(key => `${key}: ${outcomes[key].join(', ')}`));
  console.log(`gate: accepted ${file}, ${Object.keys(accepted.accepted).length} accepted`);
  return 0;
}

function reportDetails(baseline, current, comparison, runErrors) {
  printList('changed since R0', comparison.changedFiles);
  printList('evidence changed', comparison.changedEvidence);
  printList('new failures (passed at R0, failed again when re-run alone)', comparison.newFailures.map(key =>
    `${key}: ${current.outcomes[key] ?? MISSING}, re-run ${current.reruns[key] ?? 'not run'}`));
  printList('failing tests in new gate files', comparison.failingNewFiles.flatMap(entry => entry.tests));
  const passes = passesAtR0(baseline);
  const known = Object.keys(current.outcomes).filter(key => !passes.has(key) && FAILING.has(current.outcomes[key]));
  printList('known failures (not passed at R0; reported, not fixed: PR-5)', known.filter(key => fileOfKey(key) in baseline.files));
  printList('run errors', runErrors);
  printList('accepted changes', Object.values(baseline.accepted || {}).map(change => `${change.file}: ${change.reason}`));
}

function checkCommand(options) {
  const baseline = readJson(options.baseline);
  requireBuiltSite();
  const environment = environmentOf(ROOT);
  requireEnvironment(baseline, environment);
  const gateFiles = findGateFiles(ROOT);
  const files = hashFiles(ROOT, [...new Set([...Object.keys(baseline.files), ...gateFiles])]);
  const run = runGateFiles(ROOT, gateFiles);
  const candidates = [...passesAtR0(baseline)].filter(key => run.outcomes[key] !== PASSED);
  if (candidates.length > MAX_RERUNS) console.log(`gate: ${candidates.length} tests that passed at R0 failed; they count without re-runs`);
  const reruns = candidates.length <= MAX_RERUNS ? rerunAlone(ROOT, candidates, run.locations) : {};
  const evidence = Object.keys(baseline.evidence || {}).length > 0 ? evidenceOf(ROOT) : {};
  const current = { environment, files, wrapper: hashFile(ROOT, WRAPPER), evidence, outcomes: run.outcomes, reruns };
  const comparison = compareToBaseline(baseline, current);
  reportDetails(baseline, current, comparison, run.errors);
  console.log(summaryLine(baseline, comparison, gateFiles.length));
  return holds(comparison) ? 0 : 1;
}

function main(argv) {
  const options = parseArguments(argv);
  if (options.list) return listCommand(options);
  if (options['record-baseline']) return recordCommand(options);
  if (options['seal-evidence']) return sealCommand(options);
  if (options['accept-change'] && options.baseline) return acceptCommand(options);
  if (options.baseline && !options['accept-change'] && !options.reason) return checkCommand(options);
  throw new GateRefusal('refused: choose one of --list, --record-baseline, --seal-evidence, --baseline (see the usage at the top of this script)');
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof GateRefusal)) throw error;
    console.log(`gate: ${error.message}`);
    process.exitCode = 2;
  }
}

module.exports = {
  GateRefusal,
  findGateFiles,
  evidenceOf,
  sealEvidence,
  outcomesFromPlaywrightReport,
  runNodeTests,
  acceptChange,
  compareToBaseline,
  summaryLine,
};
