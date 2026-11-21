'use strict';

// The UML design questions tutorial shows ten diagrams that an AI coding agent
// could draw from Headliner's code (tutorial_sources/uml-design-questions). These
// tests hold them to that code and to the notation the design specifies:
// - content: each diagram shows exactly what facts.json says its request covers.
//   scripts/uml_design_questions/ derives those facts by running and inspecting
//   Headliner. The capstone's website view leaves out one connection on purpose;
// - evidence: every path:line in a note names a line that holds its symbol;
// - notation (UML 2.5.1): instance lifelines, replies only to synchronous calls,
//   ball and socket for calls and plain connectors for messaging, a key on every
//   diagram, and the design's size ceilings;
// - rendering: no overlapping text, no package drawn around a non-member,
//   connector labels on their own paths, joined interface names in view, and
//   no note across a package frame.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { after, before, describe, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const ROOT = path.resolve(__dirname, '../..');
const SOURCES = path.join(ROOT, 'tutorial_sources/uml-design-questions');
const DIAGRAM_DIR = path.join(SOURCES, 'diagrams');
const HEADLINER = path.join(SOURCES, 'headliner');
const BUNDLE = path.join(ROOT, 'js/ArchUML/uml-bundle.js');
const FACTS = JSON.parse(fs.readFileSync(path.join(SOURCES, 'facts.json'), 'utf8'));
const VIEWS = FACTS.diagrams;

const FILES = [
  'capstone-cancellation.sequence.uml',
  'capstone-gateways.class.uml',
  'capstone-trip-items.class.uml',
  'capstone-website-connections.component.uml',
  'checkout-latency.sequence.uml',
  'data-model.class.uml',
  'event-consumers.component.uml',
  'failed-trips.sequence.uml',
  'outages-imports.class.uml',
  'outages.component.uml',
];
const RENDERERS = { class: 'UMLClassDiagram', component: 'UMLComponentDiagram', sequence: 'UMLSequenceDiagram' };
const CEILINGS = { class: 11, component: 14, sequence: 8 }; // design spec §8.2 and §16
// The one deliberate error (design spec §7.3): the website view misses the
// order-history page's SQL connection to the Order DB replica.
const OMITTED = { caller: 'TripWebsite', provider: 'OrderDB', interface: 'SQL' };

// ArchUML's parsers run without a browser.
const sandbox = {
  document: { readyState: 'loading', addEventListener() {}, documentElement: {} },
  MutationObserver: class { observe() {} },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(BUNDLE, 'utf8'), sandbox);

// Objects made in the vm have the vm's prototypes, which deepStrictEqual compares.
const isMap = (value) => Object.prototype.toString.call(value) === '[object Map]';
const plain = (value) => JSON.parse(JSON.stringify(value, (key, v) => (isMap(v) ? Object.fromEntries(v) : v)));

function load(file) {
  const source = fs.readFileSync(path.join(DIAGRAM_DIR, file), 'utf8');
  const type = file.split('.').at(-2);
  // Parse what the renderer parses: the source without its manual layout.
  const text = sandbox.UMLShared.extractLayoutMetadata(source).text;
  return { file, type, source, model: plain(sandbox[RENDERERS[type]].parse(text)) };
}

const sorted = (values) => [...values].sort();

// --- Component diagrams --------------------------------------------------------

function components(file) {
  const { model } = load(file);
  const owner = new Map();
  const ports = new Map();
  for (const component of model.components) {
    for (const port of component.ports) {
      owner.set(port.alias, component.name);
      ports.set(port.alias, port);
    }
  }
  // An assembly may be written from either end; the port kinds say which is which.
  const calls = model.connectors.filter((c) => c.type === 'assembly').map((c) => {
    const [ball, socket] = ports.get(c.fromPort).kind === 'provide' ? [c.fromPort, c.toPort] : [c.toPort, c.fromPort];
    return {
      caller: owner.get(socket), provider: owner.get(ball),
      interface: ports.get(ball).name, ball: ports.get(ball), socket: ports.get(socket),
    };
  });
  // A plain connector has no direction, so a link keeps its two ends unordered.
  const links = model.connectors.filter((c) => c.type !== 'assembly').map((c) => ({
    ends: [{ component: c.from, port: ports.get(c.fromPort) }, { component: c.to, port: ports.get(c.toPort) }],
    type: c.type, label: c.label,
  }));
  return { model, names: sorted(model.components.map((c) => c.name)), calls, links };
}

const callKey = (call) => `${call.caller} -> ${call.provider} : ${call.interface}`;
const linkName = (link) => link.ends.map((end) => end.component).join(' -- ');

// The end of a link that is not the given component, or null if neither end is it.
function farEnd(link, component) {
  const index = link.ends.findIndex((end) => end.component === component);
  return index < 0 ? null : link.ends[1 - index];
}
const stereotypeOf = (label) => (String(label).match(/«([^»]+)»/) || [])[1] || null;

function property(label, name) {
  const match = String(label).match(new RegExp(`\\{\\s*${name}\\s*=\\s*"([^"]*)"\\s*\\}`));
  return match ? match[1].split(/\s*,\s*/) : null;
}

// --- Sequence diagrams ---------------------------------------------------------

function sequence(file) {
  const { model } = load(file);
  const typeOf = Object.fromEntries(model.participants.map((p) => [p.id, p.label]));
  const messages = [];
  const fragments = [];
  for (const item of model.messages) {
    if (item.type === 'fragment_start') fragments.push({ kind: item.fragType, guard: item.condition });
    else if (item.type === 'fragment_else') fragments.at(-1).guard = item.condition;
    else if (item.type === 'fragment_end') fragments.pop();
    else if (item.type === 'message') {
      messages.push({ ...item, operation: item.label.split('(')[0].trim(), toType: typeOf[item.to],
        enclosing: fragments.map((f) => ({ ...f })) });
    }
  }
  return { model, typeOf, messages };
}

// The diagram's calls named as facts.json names them, in drawing order.
function timeline(diagram, serviceOf) {
  return diagram.messages.flatMap((m) => {
    if (m.msgType === 'response') return m.toType === 'TripWebsite' ? ['website.responds'] : [];
    const service = serviceOf[m.toType];
    return service ? [`${service}.${m.operation}`] : [];
  });
}

const firstOccurrences = (events, kept) => [...new Set(events)].filter((e) => kept.includes(e));

// --- Class diagrams ------------------------------------------------------------

function classes(file) {
  const { model } = load(file);
  const relations = (type) => model.relationships.filter((r) => r.type === type);
  return {
    model,
    names: sorted(model.classes.map((c) => c.name)),
    abstract: sorted(model.classes.filter((c) => c.type === 'abstract').map((c) => c.name)),
    generalizations: relations('generalization').map((r) => [r.from, r.to]).sort(),
    dependencies: relations('dependency'),
    associations: model.relationships.filter((r) =>
      !['generalization', 'realization', 'dependency'].includes(r.type)),
    operations: Object.fromEntries(model.classes.map((c) => [c.name, Object.fromEntries(
      c.methods.map((m) => [m.name, m.isAbstract ? 'abstract' : 'defined']).sort())])),
    packages: Object.fromEntries(model.classes.map((c) => [c.name, c.package])),
  };
}

function notes(file) {
  const { type, model } = load(file);
  const all = type === 'sequence' ? model.messages.filter((m) => m.type === 'note') : model.notes;
  return all.map((note) => note.lines);
}

// --- Content -------------------------------------------------------------------

test('the diagram folder holds exactly the requested diagrams', () => {
  assert.deepEqual(sorted(fs.readdirSync(DIAGRAM_DIR)), FILES);
});

describe('component diagrams contain exactly the components, interfaces, and subscribe bindings in facts.json', () => {
  test('event consumers: the trips exchange, its publisher, its consumers, and their calls', () => {
    const view = VIEWS.event_consumers;
    const diagram = components('event-consumers.component.uml');
    const subscriptions = diagram.links.filter((l) => stereotypeOf(l.label) === 'subscribe');

    assert.deepEqual(diagram.names, view.components);
    assert.deepEqual(sorted(diagram.calls.map(callKey)), sorted(view.calls.map(callKey)));
    assert.deepEqual(subscriptions.length, diagram.links.length, 'every other connector is a call');
    const consumers = subscriptions.map((link) => ({ ...farEnd(link, 'trips'), label: link.label }));
    assert.ok(consumers.every((end) => end.component), 'every subscription joins the trips exchange');
    assert.deepEqual(
      Object.fromEntries(sorted(consumers.map((end) => [end.component, sorted(property(end.label, 'binding'))]))),
      Object.fromEntries(Object.entries(view.bindings).map(([c, keys]) => [c, sorted(keys)])),
    );
    assert.deepEqual(Object.fromEntries(sorted(consumers.map((end) => [end.component, end.port && end.port.name]))),
      view.queues, 'each consumer port is named after its queue');
  });

  test('outages: the trip order path, its calls, and its queues', () => {
    const view = VIEWS.outages;
    const diagram = components('outages.component.uml');
    const consumed = diagram.links.filter((l) => stereotypeOf(l.label) === 'consume');

    assert.deepEqual(diagram.names, view.components);
    assert.deepEqual(sorted(diagram.calls.map(callKey)), sorted(view.calls.map(callKey)));
    assert.equal(consumed.length, diagram.links.length, 'every other connector is a call');
    const queued = (a, b, queues) => `${sorted([a, b]).join(' -- ')} ${sorted(queues).join(' ')}`;
    assert.deepEqual(
      sorted(consumed.map((l) => queued(l.ends[0].component, l.ends[1].component, property(l.label, 'queues')))),
      sorted(view.queued.map((q) => queued(q.provider, q.consumer, q.queues))),
    );
  });
});

test('the capstone website diagram omits only the order-history database connection', () => {
  const view = VIEWS.website_connections;
  const omitted = (call) => callKey(call) === callKey(OMITTED);
  const diagram = components('capstone-website-connections.component.uml');

  assert.ok(view.calls.some(omitted), 'the website reads the Order DB replica (the code)');
  assert.ok(FACTS.capstone.website_reads_order_db);
  assert.deepEqual(sorted(diagram.calls.map(callKey)),
    sorted(view.calls.filter((call) => !omitted(call)).map(callKey)));
  assert.deepEqual(diagram.names, view.components.filter((name) => name !== OMITTED.provider),
    'the Order DB appears in the facts only through the omitted connection');
  assert.deepEqual(diagram.links, []);
});

describe("sequence diagrams contain the facts' call order", () => {
  test('failed trips: submission returns, then capture, placement, and answers', () => {
    const diagram = sequence('failed-trips.sequence.uml');
    const expected = VIEWS.failed_trips.timeline;
    const events = timeline(diagram, {
      PurchaseOrderService: 'opc.PurchaseOrderService', SupplierCallbackService: 'opc.SupplierCallbackService',
      Bank: 'bank', SupplierProvider: 'supplier',
    });

    assert.deepEqual(firstOccurrences(events, expected), expected);
    assert.equal(FACTS.failed_trips.capture_before_first_answer, true);
  });

  test('failed trips: the reject branch draws exactly what the code does, and nothing it lacks', () => {
    const diagram = sequence('failed-trips.sequence.uml');
    const rejectBranch = diagram.messages.filter((m) =>
      m.enclosing.some((f) => f.kind === 'alt' && /reject/.test(f.guard)));
    const absent = { refund: 'refund', 'cancel confirmed suppliers': 'cancel' };

    assert.deepEqual(
      rejectBranch.map((m) => (m.msgType === 'async' ? `publish ${m.label}` : m.label)),
      FACTS.failed_trips.reject_branch_calls,
    );
    for (const step of FACTS.failed_trips.missing) {
      assert.ok(!diagram.messages.some((m) => m.operation === absent[step]), `no ${step} is drawn`);
    }
  });

  test('checkout latency: validation, a pass quote per attendee, a capacity check per experience, then submit', () => {
    const diagram = sequence('checkout-latency.sequence.uml');
    const services = { Bank: 'bank', BoxOffice: 'box_office', ExperienceProvider: 'experiences',
      PurchaseOrderService: 'opc.PurchaseOrderService' };
    const calls = diagram.messages.filter((m) => m.msgType !== 'response' && services[m.toType]);
    const collapse = (names) => names.filter((name, i) => name !== names[i - 1]);
    const inLoop = (operation, pattern) => calls.filter((m) => m.operation === operation)
      .every((m) => m.enclosing.some((f) => f.kind === 'loop' && pattern.test(f.guard)));

    assert.deepEqual(calls.map((m) => `${services[m.toType]}.${m.operation}`),
      collapse(FACTS.checkout_latency.call_ms.map(([name]) => name)));
    assert.ok(inLoop('quote', /each attendee/), 'a pass quote for each attendee');
    assert.ok(inLoop('capacity', /each experience/), 'a capacity check for each experience');
  });

  test('checkout latency: the notes give each call its duration', () => {
    const text = notes('checkout-latency.sequence.uml').flat().join('\n');
    const noted = new Set([...text.matchAll(/(\d[\d,]*)\s*ms/g)].map((m) => Number(m[1].replace(/,/g, ''))));
    const expected = new Set([...FACTS.checkout_latency.call_ms.map(([, ms]) => ms),
      VIEWS.checkout.bulk_quote_ms, VIEWS.checkout.catalog_query_ms]);

    assert.deepEqual(sorted(noted), sorted(expected));
  });

  test('cancellation: the refund within the request, supplier cancellations afterwards', () => {
    const diagram = sequence('capstone-cancellation.sequence.uml');
    const expected = VIEWS.cancellation.timeline;
    const events = timeline(diagram, {
      PurchaseOrderService: 'opc.PurchaseOrderService', Bank: 'bank', SupplierProvider: 'supplier',
    });

    assert.deepEqual(firstOccurrences(events, expected), expected);
    assert.equal(FACTS.capstone.refund_before_cancel, true);
    assert.ok(diagram.messages.filter((m) => m.toType === 'SupplierProvider')
      .every((m) => m.enclosing.some((f) => f.kind === 'loop')), 'one cancellation per supplier order');
  });
});

describe('class diagrams match the hierarchy and multiplicities in facts.json', () => {
  test('data model: classes, generalizations, compositions, and every multiplicity', () => {
    const view = VIEWS.data_model;
    const diagram = classes('data-model.class.uml');
    const ends = (a) => `${a.from} ${a.role} ${a.to} ${a.opposite} ${a.multiplicity} ${a.composition}`;

    assert.deepEqual(diagram.names, view.classes);
    assert.deepEqual(diagram.abstract, view.abstract);
    assert.deepEqual(diagram.generalizations, view.generalizations);
    assert.deepEqual(sorted(diagram.associations.map((r) => ends({ from: r.from, role: r.label, to: r.to,
      opposite: r.fromMult, multiplicity: r.toMult, composition: r.type === 'composition' }))),
    sorted(view.associations.map(ends)));
  });

  test('trip items: the hierarchy and the operations each class defines', () => {
    const view = VIEWS.trip_items;
    const diagram = classes('capstone-trip-items.class.uml');

    assert.deepEqual(diagram.names, view.classes);
    assert.deepEqual(diagram.abstract, view.abstract);
    assert.deepEqual(diagram.generalizations, view.generalizations);
    assert.deepEqual(diagram.operations, view.operations);
    assert.deepEqual(sorted(FACTS.capstone.rideshare_must_implement),
      sorted(Object.entries(view.operations.TripItem).filter(([name]) =>
        !(name in view.operations.TransportItem)).map(([name]) => name)));
  });

  test('gateways: packages, hierarchy, overridden operations, and raised exceptions', () => {
    const view = VIEWS.gateways;
    const diagram = classes('capstone-gateways.class.uml');

    assert.deepEqual(diagram.names, view.classes);
    assert.deepEqual(diagram.packages, view.packages);
    assert.deepEqual(diagram.abstract, view.abstract);
    assert.deepEqual(diagram.generalizations, view.generalizations);
    for (const [name, operations] of Object.entries(view.operations)) {
      assert.deepEqual(diagram.operations[name], operations, `${name} shows the operations it defines`);
    }
    assert.deepEqual(diagram.dependencies.map((d) => [d.from, d.to]).sort(), view.raises);
    assert.ok(diagram.dependencies.every((d) => d.label === 'raises'));
  });

  test('imports: the packages and the cross-package uses of every class shown', () => {
    const view = VIEWS.imports;
    const diagram = classes('outages-imports.class.uml');
    const shown = new Set(diagram.names);
    const expected = diagram.names.flatMap((name) =>
      (view.uses[name] || []).filter((used) => shown.has(used)).map((used) => `${name} -> ${used}`));

    for (const name of diagram.names) assert.equal(diagram.packages[name], view.packages[name], name);
    assert.deepEqual(sorted(diagram.dependencies.map((d) => `${d.from} -> ${d.to}`)), sorted(expected));
    assert.deepEqual(sorted(new Set(diagram.dependencies.filter((d) => d.to === 'Broker')
      .map((d) => diagram.packages[d.from]))), view.broker_client_importers);
    assert.equal(view.website_imports_from_opc, false);
    assert.deepEqual(diagram.associations, []);
  });
});

// --- Evidence ------------------------------------------------------------------

test('every note path:line points at a line containing its symbol', () => {
  const symbolsAt = new Map();
  for (const [symbol, ref] of Object.entries(FACTS.evidence)) {
    symbolsAt.set(ref, [...(symbolsAt.get(ref) || []), symbol]);
  }
  const cited = new Set();
  for (const file of FILES) {
    for (const line of notes(file).flat()) {
      for (const [ref, filePath, number] of line.matchAll(/([\w./-]+\.(?:py|toml|md)):(\d+)/g)) {
        cited.add(ref);
        assert.ok(symbolsAt.has(ref), `${file} cites ${ref}, which facts.json has no symbol for`);
        const text = fs.readFileSync(path.join(HEADLINER, filePath), 'utf8').split('\n')[number - 1];
        for (const symbol of symbolsAt.get(ref)) {
          assert.ok(text.includes(symbol), `${ref} no longer contains ${symbol}: run facts.py --write`);
        }
      }
    }
  }
  assert.deepEqual(sorted(symbolsAt.keys()).filter((ref) => !cited.has(ref)), [],
    'every evidence entry is cited by a note');
});

// --- Notation lint -------------------------------------------------------------

describe('notation lint', () => {
  const byType = (type) => FILES.filter((file) => file.split('.').at(-2) === type);

  test('lifelines are name: Type, : Type, or x[i]: Type', () => {
    for (const file of byType('sequence')) {
      for (const lifeline of load(file).model.participants) {
        assert.ok(lifeline.isInstance, `${file}: ${lifeline.id} is an instance`);
        assert.match(lifeline.id, /^[a-z][A-Za-z0-9]*(\[[a-z]\])?$/, `${file}: ${lifeline.id}`);
        assert.match(lifeline.label, /^[A-Z][A-Za-z0-9]*$/, `${file}: ${lifeline.label} is one type`);
      }
    }
  });

  test('no reply follows an asynchronous message', () => {
    for (const file of byType('sequence')) {
      let open = []; // synchronous calls still waiting for their reply: [caller, callee]
      const atFragmentStart = []; // the calls open when each enclosing fragment began
      for (const m of load(file).model.messages) {
        // The operands of an alt are alternatives: each starts from the calls open before it.
        if (m.type === 'fragment_start') atFragmentStart.push([...open]);
        if (m.type === 'fragment_else') open = [...atFragmentStart.at(-1)];
        if (m.type === 'fragment_end') atFragmentStart.pop();
        if (m.type !== 'message') continue;
        if (m.msgType === 'sync' && m.from !== m.to) open.push([m.from, m.to]);
        if (m.msgType !== 'response' || /«create»|<<create>>/.test(m.label)) continue;
        const call = open.findLastIndex(([caller, callee]) => caller === m.to && callee === m.from);
        assert.ok(call >= 0, `${file}: "${m.label}" from ${m.from} answers no open synchronous call`);
        open.splice(call, 1);
      }
    }
  });

  test('component diagrams use no --> between components: calls are ball and socket, messaging plain', () => {
    for (const file of byType('component')) {
      const diagram = components(file);
      for (const call of diagram.calls) {
        assert.deepEqual([call.ball.kind, call.socket.kind], ['provide', 'require'], `${file}: ${callKey(call)}`);
        assert.equal(call.ball.name, call.socket.name, `${file}: ball and socket name one interface`);
      }
      for (const link of diagram.links) {
        assert.equal(link.type, 'link', `${file}: ${linkName(link)} is a plain connector`);
        assert.ok(stereotypeOf(link.label), `${file}: ${linkName(link)} names its kind`);
      }
    }
  });

  test('no port name ends in ()', () => {
    for (const file of byType('component')) {
      for (const component of load(file).model.components) {
        for (const port of component.ports) assert.doesNotMatch(port.name, /\(\)$/, `${file}: ${port.name}`);
      }
    }
  });

  test('every diagram has a key note', () => {
    for (const file of FILES) {
      assert.ok(notes(file).some((lines) => lines[0].startsWith('Key:')), `${file} has a key`);
    }
  });

  test('size ceilings hold', () => {
    for (const file of FILES) {
      const { type, model } = load(file);
      const size = { class: model.classes, component: model.components, sequence: model.participants }[type].length;
      assert.ok(size <= CEILINGS[type], `${file}: ${size} elements, at most ${CEILINGS[type]}`);
    }
  });
});

// --- Rendering -----------------------------------------------------------------

describe('rendered diagrams', () => {
  let browser;
  const drawings = new Map();
  before(async () => {
    browser = await chromium.launch(chromiumLaunchOptions());
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.setContent('<!doctype html><html lang="en"><title>Diagrams</title><body><div id="d"></div></body></html>');
    await page.addScriptTag({ path: BUNDLE });
    for (const file of FILES) {
      const { type, source } = load(file);
      drawings.set(file, await page.evaluate(measure, { renderer: RENDERERS[type], source }));
    }
  });
  after(async () => { if (browser) await browser.close(); });

  test('every diagram renders without overlapping text', () => {
    for (const [file, drawing] of drawings) assert.deepEqual(drawing.overlappingText, [], file);
  });

  test('no package frame contains a non-member', () => {
    for (const [file, drawing] of drawings) assert.deepEqual(drawing.packageOverlaps, [], file);
  });

  test('connector labels sit on their own paths', () => {
    for (const [file, drawing] of drawings) assert.deepEqual(drawing.strayLabels, [], file);
  });

  test('joined interface names stay visible', () => {
    for (const [file, drawing] of drawings) assert.deepEqual(drawing.hiddenNames, [], file);
  });

  test('notes lie inside or outside each package frame, never across it', () => {
    for (const [file, drawing] of drawings) assert.deepEqual(drawing.notesOnFrames, [], file);
  });
});

// Runs in the page: render one diagram and measure what a reader would see.
function measure({ renderer, source }) {
  const host = document.getElementById('d');
  host.replaceChildren();
  window[renderer].render(host, source);
  const svg = host.querySelector('svg');
  const all = [...svg.querySelectorAll('*')];
  const box = (el) => el.getBoundingClientRect();
  const intersect = (a, b, pad = 0) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > pad &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > pad;
  const texts = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim());

  const overlappingText = [];
  texts.forEach((a, i) => texts.slice(i + 1).forEach((b) => {
    if (intersect(box(a), box(b), 1)) overlappingText.push([a.textContent.trim(), b.textContent.trim()]);
  }));

  const packageOverlaps = [...svg.querySelectorAll('g[data-uml-package]')]
    .filter((g) => g.getAttribute('data-package-overlaps'))
    .map((g) => `${g.getAttribute('data-uml-package')}: ${g.getAttribute('data-package-overlaps')}`);

  // Distance from a point to a polyline, in screen pixels.
  const routes = [...svg.querySelectorAll('polyline[data-layout-route-id]')].map((line) => {
    const matrix = line.getScreenCTM();
    const points = [...line.points].map((p) => new DOMPoint(p.x, p.y).matrixTransform(matrix));
    return { id: line.getAttribute('data-layout-route-id'), points };
  });
  const distance = (point, points) => Math.min(...points.slice(1).map((b, i) => {
    const a = points[i];
    const length = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length)) : 0;
    return Math.hypot(point.x - (a.x + t * (b.x - a.x)), point.y - (a.y + t * (b.y - a.y)));
  }));
  const strayLabels = [...svg.querySelectorAll('g[data-layout-kind="edge-label"]')].flatMap((group) => {
    const own = group.getAttribute('data-layout-id').replace(/^label:/, '');
    const b = box(group);
    const center = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
    const to = (route) => distance(center, route.points);
    const mine = Math.min(...routes.filter((r) => r.id === own).map(to));
    const others = Math.min(...routes.filter((r) => r.id !== own).map(to));
    return mine < others ? [] : [`${group.textContent.trim()} is nearer another connector`];
  });

  // A joined interface name is drawn before the boxes; a box painted over it hides it.
  const boxes = [...svg.querySelectorAll('rect[data-layout-id]')];
  const hiddenNames = [...svg.querySelectorAll('text.uml-component-connector-label')]
    .filter((t) => t.textContent.trim() && !t.closest('[data-layout-kind="edge-label"]'))
    .filter((t) => boxes.some((rect) => all.indexOf(rect) > all.indexOf(t) && intersect(box(rect), box(t))))
    .map((t) => t.textContent.trim());

  // A note across a package frame reads as half in the package; one on the tab hides its name.
  const contains = (outer, inner) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 &&
    inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
  const frames = [...svg.querySelectorAll('g[data-uml-package] rect[data-package-part]')].map((rect) => ({
    name: `${rect.closest('g[data-uml-package]').getAttribute('data-uml-package')} ${rect.getAttribute('data-package-part')}`,
    tab: rect.getAttribute('data-package-part') === 'tab',
    box: box(rect),
  }));
  const notesOnFrames = [...svg.querySelectorAll('.uml-note-box')].flatMap((note) => {
    const b = box(note);
    const first = texts.find((text) => contains(b, box(text)));
    return frames.filter((frame) => intersect(frame.box, b, 1) && (frame.tab || !contains(frame.box, b)))
      .map((frame) => `"${first ? first.textContent.trim() : 'a note'}" crosses ${frame.name}`);
  });

  return { overlappingText, packageOverlaps, strayLabels, hiddenNames, notesOnFrames };
}
