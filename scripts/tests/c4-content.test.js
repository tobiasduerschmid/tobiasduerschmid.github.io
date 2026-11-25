'use strict';

// Every C4 figure the site ships must draw (spec §6.5, §10): shared models under _includes/c4-models/ load without
// errors and never declare their own view; every ```c4 fence under SEBook/ and every c4-view.html include under
// SEBook/ and in test-uml.html loads without errors and names a view that resolves. Broken figures fail here, before
// a build shows an error figure.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const core = require('../../js/ArchUML/c4/c4-core.js');

const { REPO_ROOT, MODELS_DIR, SEBOOK_DIR, relative, filesUnder, c4Fences, c4ViewIncludes } = require('./c4-page-figures.js');

const INCLUDE_PAGES = [path.join(REPO_ROOT, 'test-uml.html')];

/** The value of an embed's `# panels:` directive line, or undefined. */
function panelsDirective(text) {
  const match = /^#[ \t]*panels[ \t]*:[ \t]*(.*?)[ \t]*$/im.exec(text);
  return match ? match[1] : undefined;
}

const hasViewKey = (yamlText) => /^["']?view["']?\s*:/m.test(yamlText);

function errorsOf(design) {
  return core.check(design).filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => `${diagnostic.rule}: ${diagnostic.message}`);
}

/** Problems that keep an embed's text from drawing its view: load or check errors, or a selector that fails. */
function embedProblems(text, selector) {
  const design = core.load(text);
  const errors = errorsOf(design);
  if (errors.length) return errors;
  const viewModel = core.project(design, selector || core.defaultView(design));
  return viewModel.type === null
    ? [`view "${selector}" does not resolve: ${viewModel.diagnostics.map((diagnostic) => diagnostic.message).join('; ')}`]
    : [];
}

// Every shared model, including the deliberately flawed variants under flaws/ that the chapter's find-the-flaw
// figures include.
const MODELS = fs.existsSync(MODELS_DIR) ? filesUnder(MODELS_DIR, ['.yml']) : [];
// The chapter's reference model (spec §4.2): the model every worked example and Quick Check builds on.
const REFERENCE_MODEL = path.join(MODELS_DIR, 'course-registration.yml');
const FENCES = filesUnder(SEBOOK_DIR, ['.md', '.html']).flatMap((file) =>
  c4Fences(fs.readFileSync(file, 'utf8')).map((fence) => ({ ...fence, where: `${relative(file)}:${fence.line}` })));
const INCLUDES = filesUnder(SEBOOK_DIR, ['.md', '.html']).concat(INCLUDE_PAGES.filter((file) => fs.existsSync(file)))
  .flatMap((file) => c4ViewIncludes(fs.readFileSync(file, 'utf8')).map((include) => ({ ...include, where: `${relative(file)}:${include.line}` })));

/** Says so in the test output when a kind of C4 source does not exist yet, so a pass is visibly vacuous. */
function noteWhenVacuous(t, sources, kind) {
  if (sources.length === 0) t.diagnostic(`No ${kind} yet: nothing to check (vacuous pass).`);
}

test('shared models declare no view key', (t) => {
  noteWhenVacuous(t, MODELS, 'shared C4 models in _includes/c4-models/');
  for (const file of MODELS) {
    assert.equal(hasViewKey(fs.readFileSync(file, 'utf8')), false, `${relative(file)} must not declare view: (c4-view.html adds it)`);
  }
});

test('every shared C4 model loads without errors', (t) => {
  noteWhenVacuous(t, MODELS, 'shared C4 models in _includes/c4-models/');
  for (const file of MODELS) {
    assert.deepEqual(errorsOf(core.load(fs.readFileSync(file, 'utf8'))), [], `${relative(file)} has errors`);
  }
});

/** The reference model's diagnostics under default options, as "severity rule: message" lines. */
function referenceDiagnostics() {
  return core.check(core.load(fs.readFileSync(REFERENCE_MODEL, 'utf8')))
    .map((diagnostic) => ({ ...diagnostic, line: `${diagnostic.severity} ${diagnostic.rule}: ${diagnostic.message}` }));
}

test('the reference chapter model has zero errors and zero warnings', () => {
  const blocking = referenceDiagnostics().filter((diagnostic) => ['error', 'warning'].includes(diagnostic.severity));
  assert.deepEqual(blocking.map((diagnostic) => diagnostic.line), []);
});

test('the reference chapter model has no interface diagnostics', () => {
  // Info diagnostics of other categories stay (rdd/no-responsibility on code elements and on Billing, for example);
  // the interfaces the chapter teaches from must draw no interface finding at any severity.
  const interfaceFindings = referenceDiagnostics().filter((diagnostic) => diagnostic.category === 'interface');
  assert.deepEqual(interfaceFindings.map((diagnostic) => diagnostic.line), []);
});

test('every view a shared C4 model lists resolves', (t) => {
  noteWhenVacuous(t, MODELS, 'shared C4 models in _includes/c4-models/');
  for (const file of MODELS) {
    const design = core.load(fs.readFileSync(file, 'utf8'));
    for (const view of core.listViews(design)) {
      assert.notEqual(core.project(design, view.selector).type, null, `${relative(file)}: view "${view.selector}"`);
    }
  }
});

test('every c4 fence under SEBook/ loads without errors and names a view that resolves', (t) => {
  noteWhenVacuous(t, FENCES, 'c4 fences under SEBook/');
  for (const fence of FENCES) {
    assert.deepEqual(embedProblems(fence.body, core.extractEmbed(fence.body).selector), [], fence.where);
  }
});

test('every c4-view.html include names an existing shared model and a view that resolves', (t) => {
  noteWhenVacuous(t, INCLUDES, 'c4-view.html includes under SEBook/ or in test-uml.html');
  for (const include of INCLUDES) {
    assert.ok(include.model && include.view, `${include.where}: model and view must be quoted literals`);
    const modelFile = path.join(MODELS_DIR, `${include.model}.yml`);
    assert.ok(fs.existsSync(modelFile), `${include.where}: no shared model ${relative(modelFile)}`);
    const modelText = fs.readFileSync(modelFile, 'utf8');
    assert.equal(hasViewKey(modelText), false, `${include.where}: ${relative(modelFile)} must not declare view:`);
    // c4-view.html writes the view line in front of the model (after comment directives that YAML ignores).
    assert.deepEqual(embedProblems(`view: ${include.view}\n${modelText}`, include.view), [], include.where);
  }
});

/**
 * Problems with an embed's `panels` option (spec §6.6 item 7): only an interface description can show its syntactic
 * view alone, and `syntax` is the only other choice, so any other value would silently show the whole card.
 */
function panelsProblems(text, selector, panels) {
  if (panels === undefined) return [];
  const design = core.load(text);
  const notation = core.project(design, selector || core.defaultView(design)).notation;
  if (notation !== 'interface-card') return [`panels="${panels}" applies only to an interface description, not to "${selector}"`];
  return panels === 'syntax' ? [] : [`panels="${panels}" is not a choice; the only one is "syntax"`];
}

/** The fences and includes as embed texts, with where they are, their selector, and their `panels` option. */
function embeds() {
  const fromFences = FENCES.map((fence) => ({
    where: fence.where, text: fence.body, selector: core.extractEmbed(fence.body).selector, panels: panelsDirective(fence.body),
  }));
  const fromIncludes = INCLUDES.filter((include) => include.model && include.view).map((include) => ({
    where: include.where,
    text: `view: ${include.view}\n${fs.readFileSync(path.join(MODELS_DIR, `${include.model}.yml`), 'utf8')}`,
    selector: include.view,
    panels: include.panels,
  }));
  return fromFences.concat(fromIncludes);
}

test('interfaces views and interface descriptions in the content resolve, and only descriptions take panels', () => {
  const interfaceEmbeds = embeds().filter((entry) => /^interfaces? /i.test(entry.selector || ''));
  const notations = new Set(interfaceEmbeds.map((entry) => core.project(core.load(entry.text), entry.selector).notation));
  assert.deepEqual([...notations].sort(), ['interface-card', 'uml-component'],
    'the content shows both an interfaces view and an interface description');
  for (const entry of interfaceEmbeds) {
    assert.deepEqual(embedProblems(entry.text, entry.selector), [], entry.where);
  }
  for (const entry of embeds()) {
    assert.deepEqual(panelsProblems(entry.text, entry.selector, entry.panels), [], entry.where);
  }
});

test('a panels option on a drawing, or a value other than syntax, is a content problem', () => {
  const model = fs.readFileSync(path.join(MODELS_DIR, 'course-registration.yml'), 'utf8');
  const view = (selector) => `view: ${selector}\n${model}`;
  assert.deepEqual(panelsProblems(view('interface enrollment-api'), 'interface enrollment-api', 'syntax'), []);
  assert.deepEqual(panelsProblems(view('interfaces of api'), 'interfaces of api', undefined), []);
  assert.deepEqual(panelsProblems(view('interface enrollment-api'), 'interface enrollment-api', 'syntactic'),
    ['panels="syntactic" is not a choice; the only one is "syntax"']);
  assert.deepEqual(panelsProblems(view('interfaces of api'), 'interfaces of api', 'syntax'),
    ['panels="syntax" applies only to an interface description, not to "interfaces of api"']);
});

test('the content checks find fences and includes the way pages write them', () => {
  const markdown = [
    '```c4', 'view: context of a', '```',
    '````markdown', '```c4', 'shown as source', '```', '````',
    '~~~c4', 'view: b', '~~~',
  ].join('\n');
  assert.deepEqual(c4Fences(markdown), [{ line: 1, body: 'view: context of a' }, { line: 9, body: 'view: b' }]);

  const page = '{% include c4-view.html model="m" view=\'containers of s\' caption="x = y" %}\n' +
    '{%- include c4-view.html model=page.model view="v" -%}\n' +
    '{% include c4-view.html model="m" view="interface orders-api" panels="syntax" %}';
  assert.deepEqual(c4ViewIncludes(page), [
    { line: 1, model: 'm', view: 'containers of s', panels: undefined },
    { line: 2, model: null, view: 'v', panels: undefined },
    { line: 3, model: 'm', view: 'interface orders-api', panels: 'syntax' },
  ]);
  assert.equal(panelsDirective('# caption: c\n# panels: syntax\nview: interface a\n'), 'syntax');
  assert.equal(panelsDirective('view: interfaces of a\n'), undefined);
});

test('REFERENCE.md lists every interface rule with the severity, rationale, and source the checks use', () => {
  const reference = fs.readFileSync(path.join(REPO_ROOT, 'js/ArchUML/REFERENCE.md'), 'utf8');
  const rows = new Map(reference.split('\n')
    .map((line) => /^\| `([\w/-]+)` \| ([^|]+) \| (?:[^|]|\\\|)+ \| ((?:[^|]|\\\|)+) \| ((?:[^|]|\\\|)+) \|$/.exec(line))
    .filter(Boolean)
    .map(([, id, severity, rationale, source]) => [id, { severity, rationale: rationale.replace(/\\\|/g, '|'), source }]));
  const interfaceRules = core.rules.filter((rule) => rule.category === 'interface'
    || ['model/interface-provider', 'model/realizes-owner'].includes(rule.id));
  assert.ok(interfaceRules.length > 20, `the checks define the interface rules (${interfaceRules.length})`);
  for (const rule of interfaceRules) {
    const row = rows.get(rule.id);
    assert.ok(row, `${rule.id} has a row`);
    assert.ok(row.severity.startsWith(rule.severity), `${rule.id}: severity "${row.severity}" starts with ${rule.severity}`);
    assert.equal(row.rationale, rule.rationale, `${rule.id}: rationale`);
    assert.equal(row.source, rule.source, `${rule.id}: source`);
  }
});
