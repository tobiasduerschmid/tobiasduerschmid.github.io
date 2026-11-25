'use strict';

// Content test for the C4 tutorial and its follow-up "Describe an interface" (spec §8 and §11). The real core
// (ArchUMLC4.query, with each step's c4.checks configuration and its authored starter as seedModel) grades every
// step's solution, seed, and alternative models; the test checks that
//   1. every tests[].c4 predicate and every object hint condition is a valid §8 predicate, and every c4 configuration
//      block uses only the documented keys (unknown keys under c4.scaffolds and c4.checks are author errors);
//   2. every solution passes all of its step's tests; every seed fails at least one targeted test, while each guard
//      passes on the seed and fails on a wrong model that names it (spec §11);
//   3. every alternative model's header comment states its expected results, and the real core agrees for every test;
//   4. no checks: predicate is vacuous at the severity the step configures, and no checks: test passes on a model it
//      fails once that model's own checks.ignore section suppresses every finding;
//   5. every conditional hint holds on some model on which its test fails, unless allow-listed below with a reason;
//   6. every locked_fields path names a part of the step's seed under the spec §11 lock semantics, and the solution
//      and the correct alternatives leave those parts as the seed has them;
//   7. every hint is true of every model on which it shows (the hint-truth audit): hint-claims.yml documents what each
//      conditional hint states about the learner's model as §8 predicates, and each holds (or fails) as documented on
//      every graded model on which the hint's test fails and its condition holds;
//   8. expectations.md lists, for each failing test of each model, exactly the hints that the learner is shown.
//
// Sources. Each tutorial is read from _data/tutorials/<slug>.yml once it exists there, otherwise from the reviewed
// copy in fixtures/c4-tutorial/<slug>/. Seeds and solutions always come from the tutorial file (the step's authored
// starter for c4.file and its solution.files), since that starter is what same_as_seed compares with (spec §8). The
// fixture directory holds what the tutorial file does not:
//   alternatives/step-N/*.yml       alternative models, each stating in its header the results the tests must give;
//   models/step-N-reference-*.yml   further reference designs, which pass every test like the solution;
//   expectations.md                 the oracle tables, from which each test's role (targeted or guard) is read;
//   hint-claims.yml                 the documented structural meaning of each conditional hint (the hint-truth audit).
//
// Header grammar. Tests a header does not name must pass.
//   "# WRONG (what is wrong): must pass T1 and T3, fail T2 (unknown element policy) and T4; commentary"
//     "the rest" and "only" refer to the tests not named; a parenthesis after a test names the failure reason, which
//     the core's message must contain; text after the first ";" is commentary.
//   "# expect: T6 fail, T9 fail E0 W0" or "# expect: all pass E0 W0"
//     E<n> and W<n> state the model's error and warning counts under default options.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test } = require('node:test');
const yaml = require('js-yaml');
const core = require('../../js/ArchUML/c4/c4-core.js');

const REPO_ROOT = path.join(__dirname, '../..');
const FIXTURE_ROOT = path.join(__dirname, 'fixtures/c4-tutorial');

/**
 * The tutorials under test. `unreachableHints` lists conditional hints that may legitimately never fire, each with
 * the reason; anything else unreachable is a content defect (a hint no learner can see). `singleHintTests` lists the
 * tests whose hints are one orienting hint by design, each with the reason (cs-tutorial-design, "The Fading
 * Imperative"); every other test has an orienting hint and at least one conditional hint (tutorial-authoring,
 * "Multi-layered hints"). The tutorial file says the same in a comment beside each listed test.
 */
const TUTORIALS = [
  { slug: 'c4', unreachableHints: [], singleHintTests: [] },
  { slug: 'c4-interfaces', unreachableHints: [], singleHintTests: [
    { step: 2, test: 11, reason: 'a guard: it fails only when the given syntax was edited, and its one hint says what to undo' },
    { step: 2, test: 13, reason: 'faded: the plan check repeats T4 (outcome meanings), which the learner met with a full ladder' },
    { step: 2, test: 14, reason: 'faded: what a check never does follows from T12 (its decision) and T8 (links), both with full ladders' },
    { step: 2, test: 15, reason: 'faded: the plan check repeats T10 (the operation the web app calls), met with a full ladder' },
  ] },
];

/** The tutorial's single source: the _data file once Plan 5 has moved it there, otherwise the fixture copy. */
function tutorialFile(slug) {
  const published = path.join(REPO_ROOT, '_data/tutorials', `${slug}.yml`);
  return fs.existsSync(published) ? published : path.join(FIXTURE_ROOT, slug, `${slug}.yml`);
}

// ---- Step configuration (spec §3.4, §7.2, §11) ---------------------------------------------------------------------

const RULE_IDS = new Set(core.rules.map((rule) => rule.id));
const SEVERITIES = ['error', 'warning', 'info'];

const isMap = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBoolean = (value) => typeof value === 'boolean';
const isText = (value) => typeof value === 'string' && value !== '';
const oneOf = (...values) => (value) => values.includes(value);
const isTextList = (value) => Array.isArray(value) && value.every(isText);
const isRuleList = (value) => isTextList(value) && value.every((id) => RULE_IDS.has(id));
const isSeverityMap = (value) => isMap(value) && Object.entries(value).every(([id, severity]) => RULE_IDS.has(id) && SEVERITIES.includes(severity));

const C4_KEYS = {
  file: isText, view: isText, profile: oneOf('novice', 'expert'), scaffolds: isMap, checks: isMap,
  locked_fields: isTextList, reveal: oneOf('all', 'on-request'), read_only: isBoolean,
};
const SCAFFOLD_KEYS = {
  definitions: isBoolean, sentenceFrames: isBoolean, inlineLint: isBoolean, carryDown: isBoolean, trace: isBoolean,
  emptyStateGuide: isBoolean,
};
const CHECKS_KEYS = {
  display: oneOf('live', 'on-request', 'after-submit'), disable: isRuleList, severity: isSeverityMap, thresholds: isMap,
  honorFileIgnores: isBoolean,
};

/** Unknown keys and unacceptable values of one key table, each as "<where>.<key> …". */
function tableProblems(where, value, table) {
  return Object.entries(value || {}).flatMap(([key, entry]) => {
    if (!(key in table)) return [`${where}.${key} is not a documented key`];
    return table[key](entry) ? [] : [`${where}.${key} has an unacceptable value ${JSON.stringify(entry)}`];
  });
}

/** Author errors in a c4 configuration block. */
function configProblems(where, config) {
  return tableProblems(where, config, C4_KEYS)
    .concat(tableProblems(`${where}.scaffolds`, config.scaffolds, SCAFFOLD_KEYS))
    .concat(tableProblems(`${where}.checks`, config.checks, CHECKS_KEYS));
}

/** The step's c4 configuration: the step's keys over the tutorial's, with scaffolds and checks merged by sub-key. */
function effectiveConfig(tutorialConfig = {}, stepConfig = {}) {
  return Object.assign({}, tutorialConfig, stepConfig, {
    scaffolds: Object.assign({}, tutorialConfig.scaffolds, stepConfig.scaffolds),
    checks: Object.assign({}, tutorialConfig.checks, stepConfig.checks),
  });
}

// ---- Locked fields (spec §11) ---------------------------------------------------------------------------------------

/**
 * The nodes a locked path names in YAML data, as a map from concrete dotted path to the node. The path is split on
 * ".", and a "*" segment matches exactly one key or list index.
 */
function lockedNodes(data, lockedPath) {
  return lockedPath.split('.').reduce((nodes, segment) => new Map([...nodes].flatMap(([at, node]) => {
    if (node === null || typeof node !== 'object') return [];
    const keys = Array.isArray(node) ? node.map((_, index) => String(index)) : Object.keys(node);
    return keys.filter((key) => segment === '*' || key === segment)
      .map((key) => [at === '' ? key : `${at}.${key}`, node[key]]);
  })), new Map([['', data]]));
}

/** design.yml text as the core reads it: every scalar stays text (failsafe schema). */
function designData(text) {
  return yaml.load(text, { schema: yaml.FAILSAFE_SCHEMA });
}

/** JSON with map keys sorted, so that reordering the keys of a map does not count as a change. */
function canonicalJson(value) {
  return JSON.stringify(value, (key, entry) => (isMap(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map((name) => [name, entry[name]])) : entry));
}

/** Whether two designs hold the same nodes, with equal data, at a locked path (a lock also forbids adding nodes). */
function sameLockedNodes(before, after, lockedPath) {
  return canonicalJson([...lockedNodes(before, lockedPath)]) === canonicalJson([...lockedNodes(after, lockedPath)]);
}

// ---- Vacuous checks: predicates (spec §8, Credit) -------------------------------------------------------------------

/**
 * The limits (max_errors, max_warnings) of a checks: assertion that no selected rule can exceed, reading each rule's
 * severity as the step configures it. Computed here from the rule catalog, independently of the core's validator.
 */
function vacuousLimits(assertion, checksConfig) {
  const named = assertion.rules || [];
  const categories = assertion.categories || [];
  const disabled = new Set((checksConfig.disable || []).concat(assertion.disable || []));
  const selectsAll = named.length === 0 && categories.length === 0;
  const selected = core.rules.filter((rule) => (selectsAll || named.includes(rule.id) || categories.includes(rule.category))
    && !disabled.has(rule.id));
  const severityOf = (rule) => (checksConfig.severity || {})[rule.id] || rule.severity;
  return [['max_errors', 'error'], ['max_warnings', 'warning']]
    .filter(([limit, severity]) => assertion[limit] !== undefined && !selected.some((rule) => severityOf(rule) === severity))
    .map(([limit]) => limit);
}

// ---- Findings ignored in the design itself (spec §4.8; §8, Credit) --------------------------------------------------

/**
 * The design with a justified checks.ignore entry for each rule the core reports on it under the step's configuration.
 * An entry without an element silences its rule everywhere (spec §4.8), so this is the strongest suppression a learner
 * can write into design.yml.
 */
function withEveryFindingIgnored(design, checksConfig) {
  assert.ok(!/^checks\s*:/m.test(design.text), 'the design has a checks section already, so a second one would not parse');
  const rules = [...new Set(core.check(design, checksConfig).map((diagnostic) => diagnostic.rule))];
  const entries = rules.map((rule) => `    - rule: ${JSON.stringify(rule)}\n      because: "It does not apply to this design."\n`);
  return core.load(`${design.text.replace(/\n*$/, '\n')}checks:\n  ignore:\n${entries.join('')}`);
}

// ---- Expected results stated in a model's header comment ----------------------------------------------------------

function leadingComments(text) {
  const lines = text.split('\n');
  const end = lines.findIndex((line) => !line.startsWith('#'));
  return lines.slice(0, end === -1 ? lines.length : end).map((line) => line.replace(/^#\s*/, ''));
}

/** Test numbers named by "T3" or a range "T1-T8". */
function testNumbers(reference) {
  const [, first, last] = reference.match(/^T(\d+)(?:\s*[-–]\s*T(\d+))?$/);
  const numbers = [];
  for (let number = Number(first); number <= Number(last || first); number += 1) numbers.push(number);
  return numbers;
}

/** "T6 fail, T9 fail E0 W0" or "all pass E0 W0". */
function parseExpectLine(claim) {
  const named = new Map([...claim.matchAll(/\bT(\d+) (pass|fail)\b/g)].map((match) => [Number(match[1]), match[2]]));
  const count = (letter) => (claim.match(new RegExp(`\\b${letter}(\\d+)\\b`)) || [])[1];
  return { named, others: 'pass', reasons: new Map(), errors: count('E'), warnings: count('W') };
}

const CLAIM_SENTENCE = /^[A-Z][A-Z ]*?(?:\s*\((?:[^()]|\([^()]*\))*\))?:\s*([^;]*)/;
const CLAIM_TOKENS = /\b(passes|pass|fails|fail)\b|\bT\d+(?:\s*[-–]\s*T\d+)?|\bthe rest\b|\bonly\b/g;

/** "must pass T1 and T3, fail T2 (unknown element policy) and T4, pass the rest". */
function parseClaimSentence(claim) {
  const reasons = new Map([...claim.matchAll(/\bT(\d+)\s*\(([^()]*)\)/g)].map((match) => [Number(match[1]), match[2]]));
  const named = new Map();
  let verb = null;
  let others = 'pass';
  for (const [token, verbWord] of claim.replace(/\([^()]*\)/g, '').matchAll(CLAIM_TOKENS)) {
    if (verbWord) verb = verbWord.startsWith('pass') ? 'pass' : 'fail';
    else if (verb === null) throw new Error(`"${token}" comes before "pass" or "fail" in "${claim}"`);
    else if (token === 'the rest') others = verb;
    else if (token === 'only') others = verb === 'pass' ? 'fail' : 'pass';
    else testNumbers(token).forEach((number) => named.set(number, verb));
  }
  return { named, others, reasons };
}

/**
 * The results a model's header states for a step with `testCount` tests: `{ results, reasons, errors, warnings }`,
 * where `results[k]` is "pass" or "fail" for test k + 1; null when the header states no results.
 */
function statedExpectations(text, testCount) {
  const comments = leadingComments(text);
  const expectLine = comments.find((line) => line.startsWith('expect:'));
  const sentence = comments.length > 0 && comments[0].match(CLAIM_SENTENCE);
  if (!expectLine && !(sentence && /\bT\d+/.test(sentence[1]))) return null;
  const claim = expectLine ? parseExpectLine(expectLine.slice('expect:'.length)) : parseClaimSentence(sentence[1]);
  const outOfRange = [...claim.named.keys()].filter((number) => number < 1 || number > testCount);
  if (outOfRange.length > 0) throw new Error(`the header names T${outOfRange.join(', T')}, but the step has ${testCount} tests`);
  const results = Array.from({ length: testCount }, (_, index) => claim.named.get(index + 1) || claim.others);
  return { results, reasons: claim.reasons, errors: claim.errors, warnings: claim.warnings };
}

// ---- Declared roles (expectations.md) -----------------------------------------------------------------------------

/** Each step's test rows in expectations.md: `| T<k> | <description> | `<predicate>` | guard|targeted (…) |`. */
function declaredRoles(markdown) {
  const roles = new Map();
  let step = null;
  markdown.split('\n').forEach((line) => {
    const heading = line.match(/^## Step (\d+)\b/);
    if (heading) {
      step = Number(heading[1]);
      roles.set(step, []);
      return;
    }
    const row = line.match(/^\| T(\d+) \| (.+?) \| `.*` \| (guard|targeted) \(/);
    if (row && step !== null) roles.get(step).push({ number: Number(row[1]), description: row[2], role: row[3] });
  });
  return roles;
}

// ---- Documented hints (expectations.md, hint-claims.yml) -----------------------------------------------------------

/** The cells of a Markdown table row; an escaped pipe (\|) stays inside its cell. */
function tableCells(line) {
  return line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

/**
 * The hints expectations.md says the learner is shown, as a map from `<step>|<model>|T<k>` to their titles joined by
 * "; " ("(none)" when no hint shows), read from each step's table whose last column is "Hints shown…". Its rows start
 * with the model in backticks and the test.
 */
function documentedHints(markdown) {
  const shown = new Map();
  let step = null;
  let inHintTable = false;
  markdown.split('\n').forEach((line) => {
    const heading = line.match(/^## Step (\d+)\b/);
    if (heading) step = Number(heading[1]);
    if (!line.startsWith('|')) {
      inHintTable = false;
      return;
    }
    const cells = tableCells(line);
    if (cells[0] === 'Model') inHintTable = /^Hints shown/.test(cells[cells.length - 1]);
    const model = cells[0].match(/^`(.+)`$/);
    const testCell = (cells[1] || '').match(/^T(\d+)$/);
    if (inHintTable && model && testCell) shown.set(`${step}|${model[1]}|T${testCell[1]}`, cells[cells.length - 1]);
  });
  return shown;
}

/** expectations.md names a further reference design without its file's step prefix ("reference-b"). */
const documentedModelName = (name) => name.replace(/^step-\d+-/, '');

const hintKey = (stepNumber, testNumber, title) => `S${stepNumber} T${testNumber} "${title}"`;

/**
 * hint-claims.yml: what each hint states about the learner's model. Each entry names a hint by `step`, `test`, and
 * `hint` (its title) and has either `claims`, a list of `{says, holds}` or `{says, fails}` (a §8 predicate that passes,
 * or fails, on every model on which the hint shows; `says` quotes or paraphrases the statement it checks), or
 * `states_nothing`, the reason the hint asserts nothing about the model (pure advice, or a statement hedged by "if").
 */
function loadHintClaims(file) {
  return yaml.load(fs.readFileSync(file, 'utf8'));
}

/** Shape errors of one hint-claims.yml entry. */
function claimEntryProblems(entry) {
  const where = hintKey(entry.step, entry.test, entry.hint);
  const unknown = Object.keys(entry).filter((key) => !['step', 'test', 'hint', 'claims', 'states_nothing'].includes(key));
  const problems = unknown.map((key) => `${where}: ${key} is not a documented key`);
  if (('claims' in entry) === ('states_nothing' in entry)) problems.push(`${where}: needs exactly one of claims and states_nothing`);
  if ('states_nothing' in entry && !isText(entry.states_nothing)) problems.push(`${where}: states_nothing needs a reason`);
  if ('claims' in entry && !(Array.isArray(entry.claims) && entry.claims.length > 0)) problems.push(`${where}: claims is an empty list`);
  (Array.isArray(entry.claims) ? entry.claims : []).forEach((claim, index) => {
    const keys = Object.keys(claim).sort().join();
    if (!isText(claim.says) || !['fails,says', 'holds,says'].includes(keys)) {
      problems.push(`${where}: claim ${index + 1} needs says and exactly one of holds and fails`);
    }
  });
  return problems;
}

// ---- Loading a tutorial ---------------------------------------------------------------------------------------------

function fileContent(files, filePath) {
  const file = (files || []).find((entry) => entry.path === filePath);
  return file ? file.content : null;
}

function modelsIn(directory, pattern) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((name) => pattern.test(name)).sort().map((name) => {
    const text = fs.readFileSync(path.join(directory, name), 'utf8');
    return { name: name.replace(/\.yml$/, ''), text, design: core.load(text) };
  });
}

/** One step with everything the checks need; `seed` and `solution` are loaded designs (or null when absent). */
function loadStep(tutorial, step, index, fixtureDir) {
  const number = index + 1;
  const config = effectiveConfig(tutorial.c4, step.c4);
  const seedText = fileContent(step.files, config.file);
  const solutionText = fileContent(step.solution && step.solution.files, config.file);
  const seed = seedText === null ? null : core.load(seedText);
  const solution = solutionText === null ? null : core.load(solutionText);
  const alternatives = modelsIn(path.join(fixtureDir, 'alternatives', `step-${number}`), /\.yml$/);
  const references = modelsIn(path.join(fixtureDir, 'models'), new RegExp(`^step-${number}-reference-.*\\.yml$`));
  return {
    number, title: step.title, config, checksConfig: config.checks, tests: step.tests || [], seedText, seed,
    solutionText, solution, alternatives, references,
    gradedModels: [{ name: 'seed', design: seed }].concat(references, alternatives),
  };
}

function loadTutorial({ slug }) {
  const file = tutorialFile(slug);
  const tutorial = yaml.load(fs.readFileSync(file, 'utf8'));
  const fixtureDir = path.join(FIXTURE_ROOT, slug);
  const expectations = fs.readFileSync(path.join(fixtureDir, 'expectations.md'), 'utf8');
  return {
    slug, file, tutorial,
    roles: declaredRoles(expectations),
    documentedHints: documentedHints(expectations),
    hintClaims: loadHintClaims(path.join(fixtureDir, 'hint-claims.yml')),
    steps: tutorial.steps.map((step, index) => loadStep(tutorial, step, index, fixtureDir)),
  };
}

/** The step's hint-claims.yml entry for a hint, or undefined. */
function claimEntry(loaded, step, testIndex, hint) {
  const key = hintKey(step.number, testIndex + 1, hint.title);
  return loaded.hintClaims.find((entry) => hintKey(entry.step, entry.test, entry.hint) === key);
}

// ---- Grading with the real core -------------------------------------------------------------------------------------

function evaluate(step, design, predicate) {
  return core.query.evaluate(design, predicate, { seedModel: step.seed.model, checksConfig: step.checksConfig });
}

const gradeCache = new WeakMap();

/** The step's test results on a design, as `{ passed, message }` per test. */
function grade(step, design) {
  if (!gradeCache.has(design)) gradeCache.set(design, step.tests.map((stepTest) => evaluate(step, design, stepTest.c4)));
  return gradeCache.get(design);
}

const outcome = (result) => ({ true: 'pass', false: 'fail' })[result.passed] || 'unreadable';
const byTest = (values) => Object.fromEntries(values.map((value, index) => [`T${index + 1}`, value]));

function severityCounts(design) {
  const diagnostics = core.check(design, {});
  return {
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length,
  };
}

/** The test failures of a design, listed with the core's messages for an assertion message. */
function failureReport(step, design) {
  return grade(step, design).map((result, index) => ({ result, index })).filter(({ result }) => result.passed !== true)
    .map(({ result, index }) => `T${index + 1} ${outcome(result)}: ${result.message}`).join('\n');
}

/**
 * Whether the learner is shown `hint` of test `testIndex` on a design: its test fails and its condition holds. A hint
 * without a condition always shows; so, for this audit, does one with a text condition, which no C4 hint uses.
 */
function hintShows(step, design, testIndex, hint) {
  if (grade(step, design)[testIndex].passed !== false) return false;
  return !isMap(hint.condition) || evaluate(step, design, hint.condition.c4).passed === true;
}

/** The titles of the hints shown for test `testIndex` on a design, in authored order. */
function shownHintTitles(step, design, testIndex) {
  return (step.tests[testIndex].hints || []).filter((hint) => hintShows(step, design, testIndex, hint)).map((hint) => hint.title);
}

/** Whether a documented claim is true of a design: its predicate passes (`holds`) or fails (`fails`). */
function claimIsTrue(step, design, claim) {
  const passed = evaluate(step, design, 'holds' in claim ? claim.holds : claim.fails).passed;
  return 'holds' in claim ? passed === true : passed === false;
}

/** Every predicate a step authors: each test's and each object hint condition's, with where it sits. */
function authoredPredicates(step) {
  return step.tests.flatMap((stepTest, index) => [{ where: `T${index + 1}`, predicate: stepTest.c4 }].concat(
    (stepTest.hints || []).filter((hint) => isMap(hint.condition))
      .map((hint) => ({ where: `T${index + 1} hint "${hint.title}"`, predicate: hint.condition.c4 }))));
}

// ---- The checks -----------------------------------------------------------------------------------------------------

test('the configuration check rejects unknown keys under c4.scaffolds and c4.checks', () => {
  const config = { file: 'design.yml', scaffolds: { sentence_frames: true }, checks: { severities: {} } };
  assert.deepEqual(configProblems('c4', config), [
    'c4.scaffolds.sentence_frames is not a documented key',
    'c4.checks.severities is not a documented key',
  ]);
});

test('a locked path\'s "*" matches exactly one key or list index', () => {
  const data = { a: { x: { c: '1' }, y: { z: { c: '2' } } }, list: [{ c: '3' }] };
  assert.deepEqual([...lockedNodes(data, 'a.*.c').keys()], ['a.x.c']);
  assert.deepEqual([...lockedNodes(data, 'list.*.c').keys()], ['list.0.c']);
  assert.deepEqual([...lockedNodes(data, 'a.c').keys()], []);
});

test('a design that ignores each of its findings passes a failing checks: test while file ignores count', () => {
  const design = core.load([
    'systems:', '  planner:', '    name: Planner', '    description: Plans schedules for students.', '    containers:',
    '      web:', '        name: Web App', '        technology: React', '        description: Shows schedules in the browser.',
    '        collaborators:', '          api: {description: uses, technology: HTTPS}',
    '      api:', '        name: Schedule API', '        technology: Python', '        description: Computes schedules for students.',
  ].join('\n'));
  const predicate = { checks: { max_warnings: 0, rules: ['c4/vague-relationship'] } };
  assert.equal(core.query.evaluate(design, predicate, {}).passed, false, 'the vague label fails the predicate');
  assert.equal(core.query.evaluate(withEveryFindingIgnored(design, {}), predicate, {}).passed, true,
    'the ignore entries silence the finding');
});

for (const entry of TUTORIALS) {
  const loaded = loadTutorial(entry);
  const source = path.relative(REPO_ROOT, loaded.file);

  describe(`${loaded.tutorial.title} (${source})`, () => {
    test('every c4 configuration block uses only documented keys and values', () => {
      const problems = configProblems('c4', loaded.tutorial.c4 || {}).concat(loaded.steps.flatMap((step) =>
        configProblems(`step ${step.number} c4`, loaded.tutorial.steps[step.number - 1].c4 || {})));
      assert.deepEqual(problems, []);
    });

    test('hint-claims.yml documents each conditional hint once, and only authored hints', () => {
      const authored = loaded.steps.flatMap((step) => step.tests.flatMap((stepTest, index) => (stepTest.hints || [])
        .map((hint) => ({ key: hintKey(step.number, index + 1, hint.title), conditional: isMap(hint.condition) }))));
      const documented = loaded.hintClaims.map((claimed) => hintKey(claimed.step, claimed.test, claimed.hint));
      const authoredKeys = new Set(authored.map((hint) => hint.key));
      assert.deepEqual({
        shape: loaded.hintClaims.flatMap(claimEntryProblems),
        undocumented: authored.filter((hint) => hint.conditional && !documented.includes(hint.key)).map((hint) => hint.key),
        notAuthored: documented.filter((key) => !authoredKeys.has(key)),
        twice: documented.filter((key, index) => documented.indexOf(key) !== index),
      }, { shape: [], undocumented: [], notAuthored: [], twice: [] });
    });

    test('every test has an orienting hint and a conditional hint, unless its single hint is listed with a reason', () => {
      const ladders = loaded.steps.flatMap((step) => step.tests.map((stepTest, index) => {
        const hints = stepTest.hints || [];
        const orients = hints.some((hint) => !isMap(hint.condition));
        const responds = hints.some((hint) => isMap(hint.condition));
        return { step: step.number, test: index + 1, single: hints.length === 1 && orients, complete: orients && responds };
      }));
      const listed = entry.singleHintTests.map((listedTest) => `step ${listedTest.step} T${listedTest.test}`);
      assert.deepEqual({
        incomplete: ladders.filter((ladder) => !ladder.complete && !ladder.single).map((ladder) => `step ${ladder.step} T${ladder.test}`),
        unlistedSingle: ladders.filter((ladder) => ladder.single).map((ladder) => `step ${ladder.step} T${ladder.test}`)
          .filter((key) => !listed.includes(key)),
        listedButLadder: listed.filter((key) => !ladders.some((ladder) => ladder.single && `step ${ladder.step} T${ladder.test}` === key)),
      }, { incomplete: [], unlistedSingle: [], listedButLadder: [] });
    });

    for (const step of loaded.steps) describeStep(loaded, entry.unreachableHints, step);
  });
}

function describeStep(loaded, unreachableHintsAllowed, step) {
  describe(`step ${step.number}: ${step.title}`, () => {
    test('has a starter for its c4 file', () => {
      assert.ok(step.seed, `step ${step.number} has no starter file ${step.config.file}`);
    });

    if (step.config.view && step.seed) {
      test('opens on a view that its seed can draw', () => {
        const unresolved = core.project(step.seed, step.config.view).diagnostics.filter((d) => d.rule === 'view/unknown-selector');
        assert.deepEqual(unresolved.map((diagnostic) => diagnostic.message), []);
      });
    }

    if (step.config.locked_fields && step.seed) {
      test('every locked path names a part of the seed', () => {
        const data = designData(step.seedText);
        const unmatched = step.config.locked_fields.filter((lockedPath) => lockedNodes(data, lockedPath).size === 0);
        assert.deepEqual(unmatched, []);
      });

      // A learner cannot change a locked part (spec §11), so a model that does is a state no learner can reach.
      test('the solution and every correct alternative keep each locked part of the seed', () => {
        const seedData = designData(step.seedText);
        const correct = [{ name: 'solution', text: step.solutionText }]
          .concat(step.alternatives.filter((model) => model.name.startsWith('correct-'))).filter((model) => model.text !== null);
        const changed = correct.flatMap((model) => step.config.locked_fields
          .filter((lockedPath) => !sameLockedNodes(seedData, designData(model.text), lockedPath))
          .map((lockedPath) => `${model.name} changes ${lockedPath}`));
        assert.deepEqual(changed, []);
      });
    }

    if (step.tests.length > 0) describeGradedStep(loaded, unreachableHintsAllowed, step);
  });
}

function describeGradedStep(loaded, unreachableHintsAllowed, step) {
  test('every test predicate and object hint condition is a valid §8 predicate', () => {
    const problems = authoredPredicates(step).flatMap(({ where, predicate }) =>
      core.query.validate(predicate, { checks: step.checksConfig }).errors
        .map((error) => `${where}: ${[].concat(error.path || []).join('.')} ${error.message}`));
    const malformedConditions = step.tests.flatMap((stepTest, index) => (stepTest.hints || [])
      .filter((hint) => isMap(hint.condition) && Object.keys(hint.condition).join() !== 'c4')
      .map((hint) => `T${index + 1} hint "${hint.title}": a condition object holds exactly one key, c4`));
    assert.deepEqual(problems.concat(malformedConditions), []);
  });

  test('no checks: predicate is vacuous at the step\'s configured severity', () => {
    const vacuous = authoredPredicates(step).filter(({ predicate }) => isMap(predicate) && isMap(predicate.checks))
      .flatMap(({ where, predicate }) => vacuousLimits(predicate.checks, step.checksConfig).map((limit) => `${where}: ${limit}`));
    assert.deepEqual(vacuous, []);
  });

  // Credit for consistency comes only from a checks: test (spec §8, Credit), and the learner can write checks.ignore
  // entries into design.yml (spec §4.8), so ignoring the findings there must not turn a failing checks: test into a pass.
  test('no checks: test can be passed by ignoring its findings in the design', () => {
    const problems = step.tests.flatMap((stepTest, index) => {
      if (!isMap(stepTest.c4) || !isMap(stepTest.c4.checks)) return [];
      const failing = step.gradedModels.filter(({ design }) => grade(step, design)[index].passed === false);
      if (failing.length === 0) return [`T${index + 1}: no model fails it, so none shows that ignoring cannot pass it`];
      const bypassed = failing.filter(({ design }) =>
        evaluate(step, withEveryFindingIgnored(design, step.checksConfig), stepTest.c4).passed === true);
      return bypassed.length === 0 ? []
        : [`T${index + 1} passes once checks.ignore suppresses the findings, on ${bypassed.map((model) => model.name).join(', ')}`];
    });
    assert.deepEqual(problems, []);
  });

  test('the solution passes every test with no errors or warnings', () => {
    assert.ok(step.solution, `step ${step.number} has no solution file ${step.config.file}`);
    assert.equal(failureReport(step, step.solution), '');
    assert.deepEqual(severityCounts(step.solution), { errors: 0, warnings: 0 });
  });

  for (const reference of step.references) {
    test(`reference design ${reference.name} passes every test with no errors or warnings`, () => {
      assert.equal(failureReport(step, reference.design), '');
      assert.deepEqual(severityCounts(reference.design), { errors: 0, warnings: 0 });
    });
  }

  describeSeedAndGuards(loaded, step);
  describeAlternatives(step);

  test('every conditional hint holds on some model on which its test fails', () => {
    const allowed = unreachableHintsAllowed.filter((hint) => hint.step === step.number)
      .map((hint) => `T${hint.test} "${hint.title}"`);
    assert.deepEqual(unreachableHints(step), allowed);
  });

  describeHintTruth(loaded, step);
}

// The hint-truth audit (spec §11: hints never state what is false of the learner's model). A hint shows on a model when
// its test fails and its condition holds; every claim hint-claims.yml documents for it must then be true of that model.
function describeHintTruth(loaded, step) {
  const documentedClaims = () => step.tests.flatMap((stepTest, index) => (stepTest.hints || []).flatMap((hint) => {
    const entry = claimEntry(loaded, step, index, hint);
    return entry && Array.isArray(entry.claims) ? entry.claims.map((claim) => ({ index, hint, claim })) : [];
  }));

  test('every documented hint claim is a valid §8 predicate', () => {
    const problems = documentedClaims().flatMap(({ index, hint, claim }) =>
      core.query.validate('holds' in claim ? claim.holds : claim.fails, { checks: step.checksConfig }).errors
        .map((error) => `T${index + 1} "${hint.title}" (${claim.says}): ${[].concat(error.path || []).join('.')} ${error.message}`));
    assert.deepEqual(problems, []);
  });

  test('every hint states only what is true of each model on which it shows', () => {
    const problems = documentedClaims().flatMap(({ index, hint, claim }) => step.gradedModels
      .filter(({ design }) => hintShows(step, design, index, hint) && !claimIsTrue(step, design, claim))
      .map((model) => `T${index + 1} "${hint.title}" says "${claim.says}", which is false on ${model.name}`));
    assert.deepEqual(problems, []);
  });

  test('expectations.md lists the hints the learner is shown for each failing test', () => {
    const problems = step.gradedModels.flatMap((model) => grade(step, model.design).flatMap((result, index) => {
      if (result.passed !== false) return [];
      const shown = shownHintTitles(step, model.design, index).join('; ') || '(none)';
      const documented = loaded.documentedHints.get(`${step.number}|${documentedModelName(model.name)}|T${index + 1}`);
      return documented === shown ? [] : [`${model.name} T${index + 1}: documented "${documented}", shown "${shown}"`];
    }));
    assert.deepEqual(problems, []);
  });
}

function describeSeedAndGuards(loaded, step) {
  const roles = loaded.roles.get(step.number) || [];

  test('expectations.md declares a role for each test, in order', () => {
    assert.deepEqual(roles.map((row) => `T${row.number} ${row.description}`),
      step.tests.map((stepTest, index) => `T${index + 1} ${stepTest.description}`));
  });

  test('the seed fails at least one targeted test', () => {
    const targeted = roles.filter((row) => row.role === 'targeted').map((row) => row.number);
    const failed = grade(step, step.seed).flatMap((result, index) => (result.passed === false ? [index + 1] : []));
    assert.ok(targeted.some((number) => failed.includes(number)),
      `targeted tests T${targeted.join(', T')}; the seed fails ${failed.length ? `T${failed.join(', T')}` : 'none'}`);
  });

  test('on the seed, each targeted test fails and each guard passes', () => {
    const declared = byTest(roles.map((row) => (row.role === 'guard' ? 'pass' : 'fail')));
    assert.deepEqual(byTest(grade(step, step.seed).map(outcome)), declared, failureReport(step, step.seed));
  });

  for (const guard of roles.filter((row) => row.role === 'guard')) {
    test(`guard T${guard.number} fails on a wrong model that names it`, () => {
      const named = step.alternatives.filter((model) => model.name.startsWith('wrong-') && statesFailure(step, model, guard.number));
      assert.ok(named.length > 0, `no wrong model's header names T${guard.number} as failing`);
      const caught = named.filter((model) => grade(step, model.design)[guard.number - 1].passed === false);
      assert.ok(caught.length > 0, `T${guard.number} passes on ${named.map((model) => model.name).join(', ')}`);
    });
  }
}

function statesFailure(step, model, number) {
  const stated = statedExpectations(model.text, step.tests.length);
  return stated !== null && stated.results[number - 1] === 'fail';
}

function describeAlternatives(step) {
  test('has at least two correct alternative models, each stating that every test passes', () => {
    const correct = step.alternatives.filter((model) => model.name.startsWith('correct-'));
    assert.ok(correct.length >= 2, `only ${correct.length} correct alternative(s)`);
    const partial = correct.filter((model) => (statedExpectations(model.text, step.tests.length) || { results: ['none'] })
      .results.some((result) => result !== 'pass'));
    assert.deepEqual(partial.map((model) => model.name), []);
  });

  for (const model of step.alternatives) {
    test(`alternative ${model.name}: the real core gives the results its header states`, () => {
      const stated = statedExpectations(model.text, step.tests.length);
      assert.ok(stated, 'the header comment states no expected results');
      const results = grade(step, model.design);
      assert.deepEqual(byTest(results.map(outcome)), byTest(stated.results), failureReport(step, model.design));
      for (const [number, reason] of stated.reasons) {
        assert.ok(results[number - 1].message.toLowerCase().includes(reason.toLowerCase()),
          `T${number} should fail with "${reason}"; the core says "${results[number - 1].message}"`);
      }
      const counts = severityCounts(model.design);
      if (stated.errors !== undefined) assert.equal(counts.errors, Number(stated.errors), 'errors under default options');
      if (stated.warnings !== undefined) assert.equal(counts.warnings, Number(stated.warnings), 'warnings under default options');
    });
  }
}

/** The conditional hints (as `T<k> "<title>"`) whose condition holds on no model on which their test fails. */
function unreachableHints(step) {
  return step.tests.flatMap((stepTest, index) => (stepTest.hints || []).filter((hint) => isMap(hint.condition))
    .filter((hint) => !step.gradedModels.some(({ design }) => grade(step, design)[index].passed === false
      && evaluate(step, design, hint.condition.c4).passed === true))
    .map((hint) => `T${index + 1} "${hint.title}"`));
}
