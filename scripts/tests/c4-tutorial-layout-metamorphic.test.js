'use strict';

// A metamorphic test of the C4 tutorials' grading (UML-view editing spec §4.2, §8): layout is presentation, so a learner
// who moves the boxes of a code, deployment, or interfaces view, bends its lines, or reorders the lifelines of a dynamic
// view gets the same test results as before. Every model the content test grades (each step's solution and seed, its
// alternatives, and its further reference designs) is graded as c4-tutorial-content.test.js grades it, through
// ArchUMLC4.query.evaluate with the step's checks configuration and its seed, once as written and once with a generated
// layout entry for every UML view it lists. The control shows that the same harness reports a change that is not
// layout, so the comparison can fail.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const yaml = require('js-yaml');
const core = require('../../js/ArchUML/c4/c4-core.js');

const REPO_ROOT = path.join(__dirname, '../..');
const FIXTURE_ROOT = path.join(__dirname, 'fixtures/c4-tutorial');
const TUTORIALS = ['c4', 'c4-interfaces'];

// ---- The graded models, read as the content test reads them --------------------------------------------------------

/** The tutorial's single source: the _data file once it exists there, otherwise the reviewed fixture copy. */
function tutorialFile(slug) {
  const published = path.join(REPO_ROOT, '_data/tutorials', `${slug}.yml`);
  return fs.existsSync(published) ? published : path.join(FIXTURE_ROOT, slug, `${slug}.yml`);
}

function fileContent(files, filePath) {
  const file = (files || []).find((entry) => entry.path === filePath);
  return file ? file.content : null;
}

function modelsIn(directory, pattern) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((name) => pattern.test(name)).sort()
    .map((name) => ({ name, text: fs.readFileSync(path.join(directory, name), 'utf8') }));
}

/**
 * Each step of a tutorial with what grading needs: its tests, its checks configuration (the step's over the
 * tutorial's), its seed design, and its graded models as `{ name, text }`.
 */
function gradedSteps(slug) {
  const tutorial = yaml.load(fs.readFileSync(tutorialFile(slug), 'utf8'));
  return tutorial.steps.map((step, index) => {
    const number = index + 1;
    const config = Object.assign({}, tutorial.c4, step.c4);
    const checksConfig = Object.assign({}, (tutorial.c4 || {}).checks, (step.c4 || {}).checks);
    const seedText = fileContent(step.files, config.file);
    const solutionText = fileContent(step.solution && step.solution.files, config.file);
    const fixtureDir = path.join(FIXTURE_ROOT, slug);
    const models = [{ name: 'solution', text: solutionText }, { name: 'seed', text: seedText }]
      .filter((model) => model.text !== null)
      .concat(modelsIn(path.join(fixtureDir, 'models'), new RegExp(`^step-${number}-reference-.*\\.yml$`)),
        modelsIn(path.join(fixtureDir, 'alternatives', `step-${number}`), /\.yml$/));
    return { where: `${slug} step ${number}`, title: step.title, tests: step.tests || [], checksConfig,
      seed: seedText === null ? null : core.load(seedText), models };
  }).filter((step) => step.tests.length > 0 && step.seed !== null);
}

/**
 * What the content test reads off a design: `{ passed, message }` for each of the step's tests, and the error and
 * warning counts under default options, which an alternative's header states as E<n> W<n>; keyed `T<k>`, `errors`,
 * `warnings`.
 */
function grade(step, design) {
  const tests = step.tests.map((stepTest, index) => {
    const { passed, message } = core.query.evaluate(design, stepTest.c4, { seedModel: step.seed.model, checksConfig: step.checksConfig });
    return [`T${index + 1}`, { passed, message }];
  });
  const diagnostics = core.check(design, {});
  const count = (severity) => diagnostics.filter((diagnostic) => diagnostic.severity === severity).length;
  return new Map(tests.concat([['errors', count('error')], ['warnings', count('warning')]]));
}

/** Each part of the grade that differs between two designs, as `<part>: <before> / <after>`. */
function changedResults(step, before, after) {
  const [was, now] = [grade(step, before), grade(step, after)];
  return [...was].flatMap(([part, result]) => (JSON.stringify(result) === JSON.stringify(now.get(part)) ? []
    : [`${part}: ${JSON.stringify(result)} / ${JSON.stringify(now.get(part))}`]));
}

// ---- Generated layout entries (spec §4.2) ----------------------------------------------------------------------------

/** A distinct place for each of the boxes `ids`, left to right. */
const places = (ids) => Object.fromEntries(ids.map((id, index) => [id, [40 + 260 * index, 40 + 30 * (index % 2)]]));
const bend = (index) => [[10 * index, 300], [10 * index + 120, 340], [10 * index + 240, 300]];

/** The layout entry a learner could leave in a UML view: every box placed, every line bent, the lifelines reversed. */
const ENTRIES = {
  'uml-class': ({ classes, relations }) => ({
    positions: places(classes.map((entry) => entry.id)),
    routes: relations.filter((relation) => relation.type === 'dependency')
      .map((relation, index) => ({ from: relation.sourceId, to: relation.targetId, relation: 'collaborator', points: bend(index) })),
  }),
  'uml-deployment': ({ nodes, links }) => {
    const keyOf = new Map(nodes.flatMap((node) => [[node.id, node.id]]
      .concat(node.hosted.map((instance) => [instance.instanceId, `${instance.elementId}@${instance.nodeId}`]))));
    return {
      positions: places(nodes.filter((node) => node.parentId === null).map((node) => node.id)),
      routes: links.map((link, index) => ({ from: keyOf.get(link.sourceId), to: keyOf.get(link.targetId),
        relation: link.derived ? 'derived' : 'link', points: bend(index) })),
    };
  },
  'uml-component': ({ components }) => ({ positions: places(components.map((component) => component.id)) }),
  'uml-sequence': ({ participants }) => ({ lifelines: participants.map((participant) => participant.id).reverse() }),
};

/** One layout entry as YAML lines below `layout:`, in JSON flow style (JSON is YAML); empty parts are left out. */
function entryLines(key, entry) {
  const parts = Object.entries(entry).filter(([, value]) => (Array.isArray(value) ? value.length : Object.keys(value).length) > 0);
  if (parts.length === 0) return [];
  return [`  ${JSON.stringify(key)}:`].concat(parts.map(([part, value]) => `    ${part}: ${JSON.stringify(value)}`));
}

/** The model text with a layout entry for every UML view it lists, added to its `layout` section or in a new one. */
function withGeneratedLayout(text) {
  const design = core.load(text);
  const lines = core.listViews(design, { interfaces: true })
    .map((view) => core.project(design, view.selector))
    .filter((viewModel) => ENTRIES[viewModel.notation] && viewModel.uml)
    .flatMap((viewModel) => entryLines(viewModel.key, ENTRIES[viewModel.notation](viewModel.uml)));
  if (lines.length === 0) return text;
  const block = `${lines.join('\n')}\n`;
  if (/^layout:[ \t]*\n/m.test(text)) return text.replace(/^layout:[ \t]*\n/m, (header) => header + block);
  return `${text.replace(/\n*$/, '\n')}layout:\n${block}`;
}

// ---- The tests -------------------------------------------------------------------------------------------------------

const STEPS = TUTORIALS.flatMap(gradedSteps);

test('adding layout entries for every UML view to every graded model changes no test result', (t) => {
  let entries = 0;
  const changes = STEPS.flatMap((step) => step.models.flatMap(({ name, text }) => {
    const laidOut = withGeneratedLayout(text);
    entries += laidOut === text ? 0 : 1;
    return changedResults(step, core.load(text), core.load(laidOut)).map((change) => `${step.where} ${name} ${change}`);
  }));
  t.diagnostic(`graded ${STEPS.reduce((sum, step) => sum + step.models.length, 0)} models of ${STEPS.length} steps; ${entries} gained layout entries`);
  assert.ok(entries > 0, 'some graded model has a UML view to lay out');
  assert.deepEqual(changes, []);
});

// Without the student's relationship to the Planner Web App, the container view of the "Context View Repair" solution
// no longer shows the student, which one of its tests checks.
test('the same harness reports a changed result for a change that is not layout', () => {
  const step = STEPS.find((candidate) => candidate.title === 'Context View Repair');
  const solution = core.load(step.models.find((model) => model.name === 'solution').text);
  const [first] = solution.model.relationships;
  assert.deepEqual([first.sourceId, first.targetId], ['student', 'web'], 'the first relationship of the solution');
  const changed = core.edit(solution, { op: 'removeRelationship', relationshipId: first.id });
  assert.equal(changed.error, undefined, JSON.stringify(changed));
  assert.notDeepEqual(changedResults(step, solution, core.load(changed.text)), [],
    `removing the relationship from student to web from the ${step.where} solution changes a result`);
});
