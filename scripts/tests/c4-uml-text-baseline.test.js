'use strict';

// The fields the projection adds for editable UML views (UML-view editing spec §4.1) change no drawing: for every
// shipped model, the `toUml` text and the `describe` output of each UML-notation view (code, dynamic, deployment,
// interfaces) equal the ones recorded before the change.
//
// Shipped models: the core's fixtures (js/ArchUML/tests/c4/fixtures/*.yml), the site's models
// (_includes/c4-models/**/*.yml), the models the C4 tutorial content test grades (alternatives and reference models under
// scripts/tests/fixtures/c4-tutorial/<tutorial>/), and the design.yml starter and solution of every step of the C4
// tutorials (_data/tutorials/c4.yml, c4-interfaces.yml). Each listed view is compared, and the interfaces-annotated
// variant of every dynamic view.
//
// The recording keeps each model's sha256. A model that is new or whose text changed since the recording has no "before"
// and is not compared; the test reports how many models it compared.
//
// Record again only after a reviewed change to a drawing or its text, from the repository root:
//   C4_UML_BASELINE=record node --test scripts/tests/c4-uml-text-baseline.test.js
// The legend sentence of interfaces views changed after the recording (UML-view editing spec §6, "The subject of this
// view is …"); it was replaced in the recorded descriptions, scope name by scope name, and nothing else was touched.
//
// A second test checks that no shipped model holds a layout entry of a UML-notation view (spec §4.2), so the recording
// draws every view without pins, bends, or a lifeline order.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const yaml = require('js-yaml');
const core = require('../../js/ArchUML/c4/c4-core.js');

const REPO_ROOT = path.join(__dirname, '../..');
const BASELINE = path.join(__dirname, 'fixtures/c4-uml-text-baseline.json');
const TUTORIALS = ['c4', 'c4-interfaces'];

/** `{ source, text }` of each `.yml` file in `directory` (and below it with `deep`) whose name matches `pattern`. */
function modelFiles(directory, pattern, { deep = false } = {}) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).sort().flatMap((name) => {
    const file = path.join(directory, name);
    if (fs.statSync(file).isDirectory()) return deep ? modelFiles(file, pattern, { deep }) : [];
    return pattern.test(name) ? [{ source: path.relative(REPO_ROOT, file), text: fs.readFileSync(file, 'utf8') }] : [];
  });
}

/** The C4 file's starter and solution of each step of a tutorial, as the content test reads them. */
function tutorialModels(slug) {
  const file = `_data/tutorials/${slug}.yml`;
  const tutorial = yaml.load(fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'));
  return tutorial.steps.flatMap((step, index) => {
    const c4File = (step.c4 && step.c4.file) || tutorial.c4.file;
    const content = (files) => ((files || []).find((entry) => entry.path === c4File) || {}).content;
    return [['starter', content(step.files)], ['solution', content(step.solution && step.solution.files)]]
      .filter(([, text]) => typeof text === 'string')
      .map(([role, text]) => ({ source: `${file} step ${index + 1} ${role} ${c4File}`, text }));
  });
}

function shippedModels() {
  const graded = TUTORIALS.flatMap((slug) => {
    const fixtureDir = path.join(REPO_ROOT, 'scripts/tests/fixtures/c4-tutorial', slug);
    return modelFiles(path.join(fixtureDir, 'alternatives'), /\.yml$/, { deep: true })
      .concat(modelFiles(path.join(fixtureDir, 'models'), /^step-\d+-reference-.*\.yml$/));
  });
  return modelFiles(path.join(REPO_ROOT, 'js/ArchUML/tests/c4/fixtures'), /\.yml$/)
    .concat(modelFiles(path.join(REPO_ROOT, '_includes/c4-models'), /\.yml$/, { deep: true }), graded,
      TUTORIALS.flatMap(tutorialModels));
}

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

/** Each listed view, and each dynamic view annotated with interfaces, whose notation is a UML diagram. */
function umlViews(design) {
  const listed = core.listViews(design, { interfaces: true }).map((view) => view.selector);
  const annotated = core.listViews(design).filter((view) => view.type === 'dynamic').map((view) => `${view.selector} with interfaces`);
  return listed.concat(annotated)
    .map((selector) => ({ selector, viewModel: core.project(design, selector) }))
    .filter(({ viewModel }) => viewModel.notation.startsWith('uml-'));
}

/** `{ <selector>: { toUml: [line], describe } }` of a model's UML views. */
function outputsOf(text) {
  return Object.fromEntries(umlViews(core.load(text)).map(({ selector, viewModel }) =>
    [selector, { toUml: core.toUml(viewModel).text.split('\n'), describe: core.describe(viewModel) }]));
}

/**
 * The recording: each model's sha256 and, per view, the index of its `toUml` lines and of its description in the
 * shared output lists (models share many outputs, so each distinct output is kept once).
 */
function recording(models) {
  const outputs = { toUml: [], describe: [] };
  const indexByJson = { toUml: new Map(), describe: new Map() };
  const indexOf = (kind, value) => {
    const json = JSON.stringify(value);
    if (!indexByJson[kind].has(json)) {
      indexByJson[kind].set(json, outputs[kind].length);
      outputs[kind].push(value);
    }
    return indexByJson[kind].get(json);
  };
  const recorded = Object.fromEntries(models.map(({ source, text }) => [source, {
    sha256: sha256(text),
    views: Object.fromEntries(Object.entries(outputsOf(text)).map(([selector, { toUml, describe }]) =>
      [selector, { toUml: indexOf('toUml', toUml), describe: indexOf('describe', describe) }])),
  }]));
  return {
    about: 'toUml text and describe output of the UML-notation views of every shipped model, recorded by '
      + 'scripts/tests/c4-uml-text-baseline.test.js before the projection gained the fields of UML-view editing spec §4.1.',
    models: recorded,
    outputs,
  };
}

/** The recorded outputs of a model, in the shape `outputsOf` gives. */
function recordedOutputs(baseline, source) {
  return Object.fromEntries(Object.entries(baseline.models[source].views).map(([selector, { toUml, describe }]) =>
    [selector, { toUml: baseline.outputs.toUml[toUml], describe: baseline.outputs.describe[describe] }]));
}

/** The recording as JSON with one line per output line, description item, and view, so a new recording diffs line by line. */
function baselineText(recorded) {
  return `${JSON.stringify(recorded, null, 1)
    .replace(/\{\n\s*"toUml": (\d+),\n\s*"describe": (\d+)\n\s*\}/g, '{ "toUml": $1, "describe": $2 }')}\n`;
}

// The source-map test (c4-uml-source-map.test.js) draws the same shipped models and views; requiring this file gives it
// them without recording or registering this file's test a second time.
module.exports = { shippedModels, umlViews };

if (require.main === module && process.env.C4_UML_BASELINE === 'record') fs.writeFileSync(BASELINE, baselineText(recording(shippedModels())));

if (require.main === module) test('the added projection fields change no toUml text and no describe output', (t) => {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const models = shippedModels();
  const unchanged = models.filter(({ source, text }) => baseline.models[source] && baseline.models[source].sha256 === sha256(text));
  t.diagnostic(`compared ${unchanged.length} of ${models.length} shipped models; the others are new or changed since the recording`);
  assert.notEqual(unchanged.length, 0, 'at least one shipped model is as it was recorded');
  assert.deepEqual(
    Object.fromEntries(unchanged.map(({ source, text }) => [source, outputsOf(text)])),
    Object.fromEntries(unchanged.map(({ source }) => [source, recordedOutputs(baseline, source)])),
  );
});

// A pin, bend, or lifeline order in a shipped model would change its drawing, which the recording does not hold (spec §4.2).
if (require.main === module) test('no shipped model holds a UML-view layout entry', () => {
  const entries = shippedModels().flatMap(({ source, text }) => {
    const design = core.load(text);
    if (design.model === null) return [];
    return [...design.model.layout.keys()].filter((key) => core.project(design, key).notation.startsWith('uml-'))
      .map((key) => `${source}: layout of ${key}`);
  });
  assert.deepEqual(entries, []);
});
