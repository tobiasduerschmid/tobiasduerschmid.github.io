'use strict';

// Every route the ArchUML renderers stamp on a C4 UML view resolves through toUml's source map to the line it stands for
// (UML-view editing spec §4.1, §11): for every shipped model, for generated models, and for a model per word the
// grammar reads at the start of a line. Each text is drawn by the bundle's renderer of its type, the renderer the C4
// figure delegates to (the C4 figure draws a deployment link with its technology as the label, which moves no line).
//
// What a renderer stamps, and what it resolves to:
//   class        rel:N on a dependency line            line N is a collaborator relation between the stamped ends
//   deployment   rel:N on a link                       line N is a link between the stamped ends
//   sequence     seqmsg:N on a message                 line N is a message whose step has the stamped ends
//                frag:N on a fragment frame            line N is a fragment, and the step there has its operator
//                a branch line N on an else divider    line N is a branch
//   component    edge-k on each half of an assembly    (numbered in drawing order) the stamped ball or socket is a port
//                line whose element and interface are the stamped ones, and an assembly line joins it

const assert = require('node:assert/strict');
const path = require('node:path');
const { before, after, test } = require('node:test');
const yaml = require('js-yaml');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');
const core = require('../../js/ArchUML/c4/c4-core.js');
const { UML_ALIAS_KEYWORDS } = require('../../js/ArchUML/c4/c4-uml.js');
const { shippedModels, umlViews } = require('./c4-uml-text-baseline.test.js');

const ARCHUML = path.join(__dirname, '../../js/ArchUML');
const RENDERERS = { class: 'UMLClassDiagram', sequence: 'UMLSequenceDiagram', deployment: 'UMLDeploymentDiagram', component: 'UMLComponentDiagram' };

let browser;
let page;
before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  page = await browser.newPage();
  await page.setContent('<!doctype html><html lang="en"><title>C4 source map test</title><body></body></html>');
  await page.addScriptTag({ path: path.join(ARCHUML, 'uml-bundle.js') });
});
after(async () => { if (browser) await browser.close(); });

/** The stamps of each text, drawn once: `{ error }` or `{ stamps: [{ kind: route|fragment|branch, id, source, target }] }`. */
async function stampsOf(texts) {
  const jobs = [...new Set(texts.map((uml) => uml.type + '\n' + uml.text))].map((key) => {
    const [type, ...lines] = key.split('\n');
    return { key, renderer: RENDERERS[type], text: lines.join('\n') };
  });
  const drawnStamps = await page.evaluate((list) => list.map(({ renderer, text }) => {
    const container = document.createElement('div');
    document.body.append(container);
    try {
      window[renderer].render(container, text);
      const byKey = new Map();
      const keep = (key, stamp) => { if (!byKey.has(key)) byKey.set(key, stamp); };
      container.querySelectorAll('[data-layout-route-id], [data-layout-fragment-id], [data-layout-branch-line]').forEach((element) => {
        const route = element.getAttribute('data-layout-route-id');
        if (route && element.getAttribute('data-layout-route-decorative') !== 'true') {
          keep(`route ${route}`, { kind: 'route', id: route,
            source: element.getAttribute('data-layout-source'), target: element.getAttribute('data-layout-target') });
        }
        const fragment = element.getAttribute('data-layout-fragment-id');
        if (fragment) keep(`fragment ${fragment}`, { kind: 'fragment', id: fragment });
        const branch = element.getAttribute('data-layout-branch-line');
        if (branch !== null) keep(`branch ${branch}`, { kind: 'branch', id: branch });
      });
      return { stamps: [...byKey.values()] };
    } catch (error) {
      return { error: String((error && error.message) || error) };
    } finally {
      container.remove();
    }
  }), jobs);
  return new Map(jobs.map((job, index) => [job.key, drawnStamps[index]]));
}

/** `[index, operator, branch?]` segments of a container path in the scenario commands' form. */
function segmentsOf(containerPath) {
  const segments = [];
  containerPath.forEach((part, position) => {
    if (position === 0 || part === 'steps') segments.push([]);
    if (part !== 'steps') segments[segments.length - 1].push(part);
  });
  return segments;
}

/** The model step at `{ containerPath, index }` of a scenario. */
function stepAt(scenario, { containerPath, index }) {
  const list = segmentsOf(containerPath).reduce((steps, [at, , branch = 0]) => steps[at].branches[branch].steps, scenario.steps);
  return list[index];
}

/** The entry of the line a line-numbered id (`rel:7`, `frag:12`, a branch line `19`) names, or null. */
function entryOfLine(uml, id, pattern) {
  const match = pattern.exec(id);
  return match ? uml.source.lines[Number(match[1])] || null : null;
}

const endsMatch = (uml, entry, stamp) => entry.from === uml.ids[stamp.source] && entry.to === uml.ids[stamp.target];

/** Whether a component route's stamped ball or socket (`e2.p1`) is a port line that an assembly line joins. */
function portResolves(uml, stamp) {
  const end = stamp.source || stamp.target;
  const [elementAlias, portAlias] = (end || '').split('.');
  const lineIndex = uml.text.split('\n').findIndex((line) => line.endsWith(` as ${portAlias}`) && /^ {2}(provide|require) /.test(line));
  const port = lineIndex < 0 ? null : uml.source.lines[lineIndex];
  if (!port || port.kind !== 'port' || port.elementId !== uml.ids[elementAlias] || port.interfaceId !== uml.ids[portAlias]) return false;
  const joins = (entry) => entry && entry.kind === 'assembly' && entry.interfaceId === port.interfaceId && (port.role === 'provided'
    ? entry.providerId === port.elementId && entry.consumerId === port.consumerId
    : entry.consumerId === port.elementId);
  return uml.source.lines.some(joins);
}

/** Whether one stamp resolves through the source map, by the table at the top of this file. */
function resolves({ design, viewModel, uml }, stamp) {
  if (uml.type === 'component') return stamp.kind === 'route' && /^edge-\d+$/.test(stamp.id) && portResolves(uml, stamp);
  if (stamp.kind === 'branch') {
    const entry = entryOfLine(uml, stamp.id, /^(\d+)$/);
    return uml.type === 'sequence' && entry !== null && entry.kind === 'branch';
  }
  if (stamp.kind === 'fragment') {
    const entry = entryOfLine(uml, stamp.id, /^frag:(\d+)$/);
    return uml.type === 'sequence' && entry !== null && entry.kind === 'fragment'
      && stepAt(design.model.scenarios.get(viewModel.scopeId), entry).operator === entry.operator;
  }
  if (uml.type === 'sequence') {
    const entry = entryOfLine(uml, stamp.id, /^seqmsg:(\d+)$/);
    if (!entry || entry.kind !== 'message') return false;
    const step = stepAt(design.model.scenarios.get(viewModel.scopeId), entry);
    return step.from === uml.ids[stamp.source] && step.to === uml.ids[stamp.target];
  }
  const entry = entryOfLine(uml, stamp.id, /^rel:(\d+)$/);
  if (uml.type === 'class') return entry !== null && entry.kind === 'relation' && entry.relation === 'collaborator' && endsMatch(uml, entry, stamp);
  return entry !== null && entry.kind === 'link' && endsMatch(uml, entry, stamp);
}

/** `{ views, resolved, problems }` for drawn views `{ label, design, viewModel, uml }`; a problem names its view and stamp. */
async function checkViews(views) {
  const stamps = await stampsOf(views.map((view) => view.uml));
  const problems = [];
  let resolved = 0;
  views.forEach((view) => {
    const drawing = stamps.get(view.uml.type + '\n' + view.uml.text);
    if (drawing.error) problems.push(`${view.label}: the renderer failed: ${drawing.error}`);
    else {
      drawing.stamps.forEach((stamp) => {
        if (resolves(view, stamp)) resolved += 1;
        else problems.push(`${view.label}: ${stamp.kind} ${stamp.id} (${stamp.source || ''} → ${stamp.target || ''}) does not resolve`);
      });
    }
  });
  return { views: views.length, resolved, problems, stamps };
}

/** The drawn UML views of a model text: each listed view with interfaces, and each dynamic view annotated with interfaces. */
function drawnViews(text, label) {
  const design = core.load(text);
  assert.notEqual(design.model, null, `${label}: the YAML is readable`);
  return umlViews(design).map(({ selector, viewModel }) => ({ label: `${label} / ${selector}`, design, viewModel, uml: core.toUml(viewModel) }));
}

test('every stamped route id of every shipped model view resolves through the source map to the line it stands for', async (t) => {
  const views = shippedModels().flatMap(({ source, text }) => drawnViews(text, source));
  const { resolved, problems } = await checkViews(views);
  t.diagnostic(`${views.length} views of ${new Set(views.map((view) => view.uml.text)).size} distinct texts; ${resolved} stamps resolved`);
  assert.deepEqual(problems, []);
  assert.deepEqual([...new Set(views.map((view) => view.uml.type))].sort(), ['class', 'component', 'deployment', 'sequence']);
  assert.ok(resolved > 0, 'the shipped views stamp routes');
});

// ---- Generated models (spec §11) -----------------------------------------------------------------

/** A seeded pseudo-random source (mulberry32), so a generated model is the same on every run. */
function randomSource(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    chance: (p) => next() < p,
    between: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}

const KEYWORDS = [...new Set(Object.values(UML_ALIAS_KEYWORDS).flat())];
const LETTER_CASES = [(word) => word, (word) => word[0].toUpperCase() + word.slice(1), (word) => word.toUpperCase()];
const CODE_KINDS = ['class', 'interface', 'abstract_class', 'enum', 'function', 'module'];
const FRAGMENTS = ['alt', 'par', 'opt', 'loop', 'break'];
// Names that collide once their spaces become underscores, and names that are keywords.
const NAMES = ['Seat Holds', 'Seat_Holds', 'Ledger', 'Note', 'end', 'Alt', 'Layout', 'Gateway', 'Rule Set'];

/**
 * A design model from a seed: people; internal and external systems; containers, components, and code elements of
 * every kind, nested; relationships between any two of them (some asynchronous, some using an interface); scenarios of
 * messages and nested fragments, with empty branches and steps whose end is no element; deployment nodes nested three
 * deep, hosting elements once or twice, with links. Ids and names are often keywords in some letter case.
 */
function generatedModel(seed) {
  const random = randomSource(seed);
  const taken = new Set();
  const newId = (stem) => {
    let id;
    do {
      id = random.chance(0.3) ? random.pick(LETTER_CASES)(random.pick(KEYWORDS)) : `${stem}${random.between(1, 99)}`;
    } while (taken.has(id));
    taken.add(id);
    return id;
  };
  const elements = [];
  const providers = [];
  const element = (type, stem, fields) => {
    const id = newId(stem);
    const entry = Object.assign({ name: random.chance(0.4) ? random.pick(NAMES) : `${stem} ${id}` }, fields);
    elements.push({ id, type, entry });
    return [id, entry];
  };
  const map = (count, make) => Object.fromEntries(Array.from({ length: count }, make));
  const codeElements = () => {
    const code = map(random.between(0, 4), () => element('code', 'Code', { kind: random.pick(CODE_KINDS),
      attributes: Array.from({ length: random.between(0, 2) }, (_, i) => `- field${i}: int`),
      operations: Array.from({ length: random.between(0, 2) }, (_, i) => `+ act${i}(): void`) }));
    const ids = Object.keys(code);
    ids.forEach((id) => ['extends', 'implements'].forEach((list) => {
      if (ids.length > 1 && random.chance(0.3)) code[id][list] = [random.pick(ids.filter((other) => other !== id))];
    }));
    return code;
  };
  const container = () => element('container', 'Container', {
    components: map(random.between(0, 3), () => element('component', 'Component', { code: codeElements() })),
  });
  const people = map(random.between(1, 2), () => element('person', 'Person', {}));
  const systems = map(random.between(1, 3), (_, index) => (index === 0
    ? element('system', 'System', { containers: map(random.between(1, 3), container) })
    : element('system', 'External', { external: true })));
  elements.filter(({ type }) => type === 'container' || (type === 'system' && random.chance(0.5))).forEach(({ id, entry }) => {
    if (!random.chance(0.4)) return;
    const interfaceId = newId('api');
    entry.provides = { [interfaceId]: { name: `Interface ${interfaceId}`, operations: { call: { syntax: `call${interfaceId}()` } } } };
    providers.push({ elementId: id, interfaceId });
  });
  elements.forEach(({ id, entry }) => {
    const collaborators = {};
    for (let n = random.between(0, 2); n > 0; n -= 1) {
      const target = random.pick(elements).id;
      if (target === id) continue;
      const provided = providers.find((provider) => provider.elementId === target);
      collaborators[target] = { description: `talks to ${target}`, connector: random.chance(0.3) ? 'message' : 'call' };
      if (provided && random.chance(0.6)) collaborators[target].uses = `${provided.interfaceId}.call`;
    }
    if (Object.keys(collaborators).length > 0) entry.collaborators = collaborators;
  });
  const endId = () => (random.chance(0.1) ? 'nobody-at-all' : random.pick(elements).id);
  const steps = (depth) => Array.from({ length: random.between(0, 4) }, () => {
    if (depth < 2 && random.chance(0.3)) {
      const operator = random.pick(FRAGMENTS);
      const branch = () => (random.chance(0.2) ? { when: 'nothing yet' } : { when: `case ${random.between(1, 9)}`, steps: steps(depth + 1) });
      return { [operator]: operator === 'alt' || operator === 'par' ? Array.from({ length: random.between(1, 3) }, branch) : branch() };
    }
    return { [`${endId()} -> ${endId()}`]: 'sends a message to' };
  });
  const scenarios = map(random.between(1, 2), () => [newId('scenario'), { title: 'A generated scenario', steps: steps(0) }]);
  const deployable = elements.filter(({ type }) => type === 'container' || type === 'system').map(({ id }) => id);
  const nodeIds = new Set();
  // At most three hosted instances per environment: the deployment layout's time grows fast with the derived links
  // between instances (one dense generated environment of 30 links took 30 s).
  let freeInstances = 3;
  const someHosts = () => {
    const hosts = new Set();
    while (freeInstances > 0 && random.chance(0.4)) {
      hosts.add(random.pick(deployable));
      freeInstances -= 1;
    }
    return [...hosts];
  };
  const node = (depth) => {
    let id = random.chance(0.15) ? random.pick(deployable) : newId('node');
    while (nodeIds.has(id)) id = newId('node');
    nodeIds.add(id);
    const kind = random.pick(['device', 'environment', 'infrastructure', null]);
    const entry = { name: `Node ${id}` };
    const hosts = someHosts();
    if (hosts.length > 0) entry.hosts = hosts;
    if (kind) entry.kind = kind;
    if (random.chance(0.2)) entry.instances = 3;
    if (depth < 3 && kind !== 'infrastructure' && random.chance(0.5)) entry.nodes = map(random.between(1, 2), () => node(depth + 1));
    return [id, entry];
  };
  const nodes = map(random.between(1, 2), () => node(1));
  const allNodes = [];
  const collect = (level) => Object.entries(level).forEach(([id, entry]) => { allNodes.push([id, entry]); if (entry.nodes) collect(entry.nodes); });
  collect(nodes);
  allNodes.forEach(([id, entry]) => {
    const target = random.pick(allNodes)[0];
    if (target !== id && random.chance(0.4)) entry.collaborators = { [target]: 'forwards requests to' };
  });
  return yaml.dump({ schema: 'c4-design/1', name: `Generated model ${seed}`, people, systems, scenarios,
    deployment: { live: { name: 'Live', nodes } } }, { lineWidth: -1 });
}

const SEEDS = Array.from({ length: 24 }, (_, index) => 1000 + index);

test('for generated models every stamped route id of every UML view resolves through the source map', async (t) => {
  const views = SEEDS.flatMap((seed) => drawnViews(generatedModel(seed), `seed ${seed}`));
  const { resolved, problems } = await checkViews(views);
  t.diagnostic(`${views.length} views of ${SEEDS.length} generated models; ${resolved} stamps resolved`);
  assert.deepEqual(problems, []);
  assert.deepEqual([...new Set(views.map((view) => view.uml.type))].sort(), ['class', 'component', 'deployment', 'sequence']);
});

// ---- One model per listed keyword ------------------------------------------------------------------

const inCase = (word, n) => LETTER_CASES[n % LETTER_CASES.length](word);

/** A model whose alias at the start of a line is the n-th keyword (as in uml-source-map.test.js of the core). */
const KEYWORD_MODELS = {
  sequence: (word, n) => ['dynamic run', [
    'schema: c4-design/1', 'name: Keyword probe',
    'people:', '  student:', '    name: Student', '    collaborators:', `      ${inCase(word, n)}: uses`,
    'systems:', `  ${inCase(word, n)}:`, '    name: Keyword system', '    collaborators:', '      other: asks', '  other:', '    name: Other system',
    'scenarios:', '  run:', '    title: Run', '    steps:', `      - student -> ${inCase(word, n)}: uses`, `      - ${inCase(word, n)} -> other: asks`,
  ]],
  class: (word, n) => ['code of core', [
    'schema: c4-design/1', 'name: Keyword probe',
    'systems:', '  app:', '    name: App', '    containers:', '      api:', '        name: API', '        components:',
    '          core:', '            name: Core', '            code:',
    '              Probe:', `                name: ${inCase(word, n)}`, '                kind: class', '                extends: [Base]',
    '                collaborators:', '                  Helper: asks', '              Base: {kind: class}', '              Helper: {kind: class}',
  ]],
  deployment: (word, n) => ['deployment live', [
    'schema: c4-design/1', 'name: Keyword probe',
    'systems:', `  ${inCase(word, n)}:`, '    name: Keyword system', '    collaborators:', '      other: sends data to',
    '  other:', '    name: Other system',
    'deployment:', '  live:', '    name: Live', '    nodes:',
    `      ${inCase(word, n + 1)}: {name: Keyword node, hosts: [${inCase(word, n)}], collaborators: {relay: forwards requests to}}`,
    '      host-b: {name: Other node, hosts: [other]}', '      relay: {name: Relay node}',
  ]],
};

/** The entry kind each stamped route of a type stands for. */
const ROUTED_KINDS = { class: (entry) => entry.kind === 'relation' && entry.relation === 'collaborator',
  sequence: (entry) => entry.kind === 'message', deployment: (entry) => entry.kind === 'link' };
// Each keyword model has two steps (sequence), one dependency beside its generalization (class), or a derived link
// and a link between nodes (deployment).
const ROUTED_COUNTS = { sequence: 2, class: 1, deployment: 2 };

test('a model per listed keyword draws one stamped route per relation or step', async () => {
  const views = Object.entries(UML_ALIAS_KEYWORDS).flatMap(([type, words]) => words.map((word, n) => {
    const [selector, lines] = KEYWORD_MODELS[type](word, n);
    const design = core.load(lines.join('\n'));
    const viewModel = core.project(design, selector);
    return { label: `${type} ${word}`, design, viewModel, uml: core.toUml(viewModel) };
  }));
  const { problems, stamps } = await checkViews(views);
  assert.deepEqual(problems, []);
  const routeCounts = views.map(({ label, uml }) => {
    const routed = uml.source.lines.flatMap((entry, index) => (entry && ROUTED_KINDS[uml.type](entry) ? [index] : []));
    const routeLines = stamps.get(uml.type + '\n' + uml.text).stamps.filter((stamp) => stamp.kind === 'route')
      .map((stamp) => Number(/:(\d+)$/.exec(stamp.id)[1])).sort((a, b) => a - b);
    return [label, routeLines, routed];
  });
  assert.deepEqual(routeCounts.map(([label, , routed]) => [label, routed.length]),
    views.map(({ label, uml }) => [label, ROUTED_COUNTS[uml.type]]), 'the source map lists every relation or step of each model');
  assert.deepEqual(routeCounts.map(([label, routeLines]) => [label, routeLines]), routeCounts.map(([label, , routed]) => [label, routed]),
    'each listed relation or step is drawn with its stamped route');
});
