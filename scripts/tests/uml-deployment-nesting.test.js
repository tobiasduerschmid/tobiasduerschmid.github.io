'use strict';

// Nested deployment nodes (environment > node > node > component): the parser
// keeps every containment level, the renderer draws each element inside its
// parent, routes links around everything that does not contain an endpoint,
// keeps every link label beside its link, and the text alternative names
// every enclosing level.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const root = path.join(__dirname, '../..');

const CAMPUS = `@startuml
node "Student laptop" as laptop <<device>> {
  node "Web browser" as browser <<executionEnvironment>> {
    component "Web app" as web
  }
}
node "Campus cloud" as cloud <<executionEnvironment>> {
  node "Kubernetes cluster" as k8s <<executionEnvironment>> {
    node "API pod" as pod <<executionEnvironment>> {
      component "Registration API" as api
    }
    node "Worker pod" as worker <<executionEnvironment>> {
      component "Notifier" as notifier
    }
  }
  node "Database server" as db <<device>>
}
web --> api : HTTPS
api --> notifier : AMQP
api --> db : SQL
@enduml`;

const EXPECTED_PARENTS = {
  laptop: null, browser: 'laptop', web: 'browser',
  cloud: null, k8s: 'cloud', pod: 'k8s', api: 'pod',
  worker: 'k8s', notifier: 'worker', db: 'cloud'
};

// The shape of a C4 deployment view projected to ArchUML text (spec §6.3):
// hyphenated node ids, an instance count in a name, «device»,
// «executionEnvironment», and «infrastructure» nodes, hosted containers and
// systems as stereotyped components, and labelled links between nested
// siblings, including a node collaborator. Links between top-level nodes
// carry short labels: room for a long label between top-level nodes is the
// shared layout engine's job, not part of nesting.
const C4_SHAPED = `@startuml
node "Student's computer" as laptop <<device>> {
  node "Web browser" as browser <<executionEnvironment>> {
    component "Planner Web App" as web <<container>>
  }
}
node "Campus cloud" as campus-cloud <<executionEnvironment>> {
  node "Kubernetes cluster" as k8s <<executionEnvironment>> {
    node "Ingress load balancer" as ingress <<infrastructure>>
    node "API pod ×3" as api-pod <<executionEnvironment>> {
      component "Registration API" as api <<container>>
    }
  }
  node "Managed database" as postgres <<executionEnvironment>> {
    component "Registration Database" as db <<container>>
  }
}
node "University data centre" as data-centre <<executionEnvironment>> {
  component "Billing System" as billing <<software system>>
}
web --> api : JSON/HTTPS
api --> db : reads and writes [SQL/TCP]
api --> billing : HTTPS
ingress --> api-pod : forwards HTTPS requests to
@enduml`;

const C4_PARENTS = {
  laptop: null, browser: 'laptop', web: 'browser',
  'campus-cloud': null, k8s: 'campus-cloud', ingress: 'k8s', 'api-pod': 'k8s', api: 'api-pod',
  postgres: 'campus-cloud', db: 'postgres',
  'data-centre': null, billing: 'data-centre'
};

// The most common deployment shape has no nested nodes: components and
// artifacts inside top-level nodes, linked within one node and across nodes.
// Their gaps are too narrow for a label beside the link, and a label must
// still not straddle a node's outline or sit beside another link.
const SINGLE_LEVEL = {
  'client, server, and database': `@startuml
node Client <<device>> {
  component Browser
}
node Server {
  component API
  component Worker
}
node DB {
  artifact Schema
}
Browser --> API : HTTPS
API --> Worker : AMQP
Worker --> Schema : SQL
@enduml`,
  'three-tier chain': `@startuml
node Web {
  component UI
}
node App {
  component Svc
}
node Data {
  component Store
}
UI --> Svc : REST
Svc --> Store : JDBC
@enduml`
};

let browser;
before(async () => { browser = await chromium.launch(chromiumLaunchOptions()); });
after(async () => { if (browser) await browser.close(); });

async function renderGeometry(source) {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html lang="en"><title>Nested deployment</title><body><div id="diagram"></div></body></html>');
    await page.addScriptTag({ path: path.join(root, 'js/ArchUML/uml-bundle.js') });
    return await page.evaluate((text) => {
      const container = document.getElementById('diagram');
      window.UMLDeploymentDiagram.render(container, text);
      const svg = container.querySelector('svg');
      const parsed = window.UMLDeploymentDiagram.parse(text);
      const elements = {};
      for (const group of svg.querySelectorAll('g[data-layout-id]')) {
        const id = group.getAttribute('data-layout-id');
        const rect = group.querySelector('rect[data-layout-bounds-id]');
        const box = { x: +rect.getAttribute('x'), y: +rect.getAttribute('y'), width: +rect.getAttribute('width'), height: +rect.getAttribute('height') };
        // The cube's top and side faces extend the drawn footprint of a node.
        const footprint = group.querySelector('polygon') ? group.getBBox() : box;
        const texts = [...group.querySelectorAll(':scope > text')].map((text) => {
          const b = text.getBBox();
          return { text: text.textContent, x: b.x, y: b.y, width: b.width, height: b.height };
        });
        // The drawn outline as straight edges: the box and every cube face.
        const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x + box.width, box.y + box.height], [box.x, box.y + box.height]]
          .map(([x, y]) => ({ x, y }));
        const outline = [corners, ...[...group.querySelectorAll('polygon')].map((polygon) =>
          [...polygon.points].map((point) => ({ x: point.x, y: point.y })))]
          .flatMap((shape) => shape.map((point, index) => ({ a: point, b: shape[(index + 1) % shape.length] })));
        elements[id] = {
          box,
          footprint: { x: footprint.x, y: footprint.y, width: footprint.width, height: footprint.height },
          outline,
          texts,
          cubeFaces: group.querySelectorAll('polygon').length
        };
      }
      const routes = [...svg.querySelectorAll('polyline[data-layout-route-id]')].map((line) => ({
        source: line.getAttribute('data-layout-source'),
        target: line.getAttribute('data-layout-target'),
        points: [...line.points].map((point) => ({ x: point.x, y: point.y }))
      }));
      const labels = [...svg.querySelectorAll('text[font-style="italic"]')].map((text) => {
        const b = text.getBBox();
        return { text: text.textContent, x: b.x, y: b.y, width: b.width, height: b.height };
      });
      return {
        parents: Object.fromEntries(parsed.elements.map((element) => [element.name, element.parentId])),
        kinds: Object.fromEntries(parsed.elements.map((element) => [element.name, element.kind])),
        stereotypes: Object.fromEntries(parsed.elements.map((element) => [element.name, element.stereotype])),
        links: parsed.links.map((link) => ({ from: link.from, to: link.to, label: link.label })),
        elements,
        routes,
        labels
      };
    }, source);
  } finally {
    await page.close();
  }
}

function inside(inner, outer, margin) {
  return inner.x >= outer.x + margin && inner.y >= outer.y + margin &&
    inner.x + inner.width <= outer.x + outer.width - margin &&
    inner.y + inner.height <= outer.y + outer.height - margin;
}

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function ancestors(parents, id) {
  const chain = [];
  for (let parent = parents[id]; parent; parent = parents[parent]) chain.push(parent);
  return chain;
}

function segments(points) {
  return points.slice(1).map((point, index) => ({ a: points[index], b: point }));
}

// Does an axis-parallel segment pass through the open interior of a box?
function segmentEntersBox(segment, box) {
  const x1 = Math.min(segment.a.x, segment.b.x), x2 = Math.max(segment.a.x, segment.b.x);
  const y1 = Math.min(segment.a.y, segment.b.y), y2 = Math.max(segment.a.y, segment.b.y);
  return x2 > box.x + 0.5 && x1 < box.x + box.width - 0.5 && y2 > box.y + 0.5 && y1 < box.y + box.height - 0.5;
}

// Length a segment runs on top of one of the box's four border lines.
function borderRunLength(segment, box) {
  const horizontal = Math.abs(segment.a.y - segment.b.y) < 0.5;
  const lo = horizontal ? Math.min(segment.a.x, segment.b.x) : Math.min(segment.a.y, segment.b.y);
  const hi = horizontal ? Math.max(segment.a.x, segment.b.x) : Math.max(segment.a.y, segment.b.y);
  const fixed = horizontal ? segment.a.y : segment.a.x;
  const lines = horizontal
    ? [box.y, box.y + box.height].map((value) => ({ value, lo: box.x, hi: box.x + box.width }))
    : [box.x, box.x + box.width].map((value) => ({ value, lo: box.y, hi: box.y + box.height }));
  let longest = 0;
  for (const line of lines) {
    if (Math.abs(line.value - fixed) > 2) continue;
    longest = Math.max(longest, Math.min(hi, line.hi) - Math.max(lo, line.lo));
  }
  return longest;
}

function onBorder(point, box) {
  const tolerance = 1.5;
  const withinX = point.x >= box.x - tolerance && point.x <= box.x + box.width + tolerance;
  const withinY = point.y >= box.y - tolerance && point.y <= box.y + box.height + tolerance;
  return (withinX && (Math.abs(point.y - box.y) <= tolerance || Math.abs(point.y - box.y - box.height) <= tolerance)) ||
    (withinY && (Math.abs(point.x - box.x) <= tolerance || Math.abs(point.x - box.x - box.width) <= tolerance));
}

function distanceToSegment(rect, segment) {
  const x1 = Math.min(segment.a.x, segment.b.x), x2 = Math.max(segment.a.x, segment.b.x);
  const y1 = Math.min(segment.a.y, segment.b.y), y2 = Math.max(segment.a.y, segment.b.y);
  const dx = Math.max(0, rect.x - x2, x1 - (rect.x + rect.width));
  const dy = Math.max(0, rect.y - y2, y1 - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

// Every element is drawn inside its parent (cube faces included) and clear of
// the parent's name; every text fits its box; unrelated elements never overlap.
function assertNestedGeometry(result, expectedParents) {
  assert.deepEqual(result.parents, expectedParents, 'every element keeps its innermost enclosing node');
  for (const [id, parentId] of Object.entries(expectedParents)) {
    const element = result.elements[id];
    assert.ok(element, id + ' has its own selectable geometry');
    if (result.kinds[id] === 'node') assert.equal(element.cubeFaces, 2, id + ' is drawn as a three-dimensional node at every level');
    if (!parentId) continue;
    const parent = result.elements[parentId];
    assert.ok(inside(element.footprint, parent.box, 4), id + ' (including its cube faces) is drawn inside ' + parentId);
    for (const label of parent.texts) {
      assert.ok(!overlaps(element.footprint, label), id + ' does not cover the label "' + label.text + '" of ' + parentId);
    }
  }
  for (const [id, element] of Object.entries(result.elements)) {
    for (const label of element.texts) {
      assert.ok(inside(label, element.box, 2), 'label "' + label.text + '" fits inside ' + id);
    }
  }
  const ids = Object.keys(expectedParents);
  for (const a of ids) {
    for (const b of ids) {
      if (a >= b || ancestors(result.parents, a).includes(b) || ancestors(result.parents, b).includes(a)) continue;
      assert.ok(!overlaps(result.elements[a].footprint, result.elements[b].footprint), a + ' and ' + b + ' do not overlap');
    }
  }
}

// Does a straight segment pass through the rectangle's interior? (Liang-Barsky
// clipping; touching the rectangle's edge within half a pixel does not count.)
function segmentCrossesRect(segment, rect) {
  const inset = 0.5;
  const dx = segment.b.x - segment.a.x, dy = segment.b.y - segment.a.y;
  const limits = [
    [-dx, segment.a.x - (rect.x + inset)],
    [dx, rect.x + rect.width - inset - segment.a.x],
    [-dy, segment.a.y - (rect.y + inset)],
    [dy, rect.y + rect.height - inset - segment.a.y]
  ];
  let enter = 0, leave = 1;
  for (const [p, q] of limits) {
    if (p === 0) {
      if (q <= 0) return false;
    } else if (p < 0) {
      enter = Math.max(enter, q / p);
    } else {
      leave = Math.min(leave, q / p);
    }
  }
  return enter < leave;
}

// Does an edge of the element's drawn outline (box or cube face) pass through
// the rectangle? A label that does reads as part of that outline.
function crossesOutline(rect, element) {
  return element.outline.some((edge) => segmentCrossesRect(edge, rect));
}

function routeOfLabel(result, label) {
  const link = result.links.find((candidate) => candidate.label === label.text);
  return result.routes.find((candidate) => candidate.source === link.from && candidate.target === link.to);
}

function distanceToRoute(rect, route) {
  return Math.min(...segments(route.points).map((segment) => distanceToSegment(rect, segment)));
}

// A route runs from border to border, crosses only the nodes that enclose an
// endpoint, never strikes through a name, and never runs along an outline.
// Its label sits beside it, centred inside the innermost node that encloses
// both endpoints, and covers no name and no element other than those
// enclosing nodes.
function assertRoutesAndLabels(result) {
  assert.equal(result.routes.length, result.links.length, 'every link is drawn');
  for (const route of result.routes) {
    const name = route.source + ' -> ' + route.target;
    const source = result.elements[route.source], target = result.elements[route.target];
    assert.ok(onBorder(route.points[0], source.box), name + ' starts on the border of ' + route.source);
    assert.ok(onBorder(route.points.at(-1), target.box), name + ' ends on the border of ' + route.target);
    const enclosing = new Set([route.source, route.target,
      ...ancestors(result.parents, route.source), ...ancestors(result.parents, route.target)]);
    for (const segment of segments(route.points)) {
      for (const [id, element] of Object.entries(result.elements)) {
        if (!enclosing.has(id)) {
          assert.ok(!segmentEntersBox(segment, element.footprint), name + ' does not pass through unrelated ' + id);
        }
        for (const label of element.texts) {
          assert.ok(!segmentEntersBox(segment, label), name + ' does not cross the label "' + label.text + '" of ' + id);
        }
        assert.ok(borderRunLength(segment, element.box) <= 6, name + ' does not run along the border of ' + id);
      }
    }
  }
  assert.deepEqual(result.labels.map((label) => label.text).sort(),
    result.links.map((link) => link.label).filter(Boolean).sort(), 'every link label is drawn once');
  for (const label of result.labels) {
    const link = result.links.find((candidate) => candidate.label === label.text);
    const nearest = distanceToRoute(label, routeOfLabel(result, label));
    assert.ok(nearest <= 30, 'label "' + label.text + '" sits beside its own link (' + Math.round(nearest) + ' px away)');
    const sourceChain = [link.from, ...ancestors(result.parents, link.from)];
    const targetChain = [link.to, ...ancestors(result.parents, link.to)];
    const common = sourceChain.find((id) => targetChain.includes(id));
    if (common) {
      const centre = { x: label.x + label.width / 2, y: label.y + label.height / 2, width: 0, height: 0 };
      assert.ok(inside(centre, result.elements[common].box, 0), 'label "' + label.text + '" is centred inside ' + common + ', which encloses both ends');
    }
    const enclosing = new Set([...sourceChain.slice(1), ...targetChain.slice(1)]);
    for (const [id, element] of Object.entries(result.elements)) {
      if (!enclosing.has(id)) assert.ok(!overlaps(label, element.footprint), 'label "' + label.text + '" does not cover ' + id);
      for (const text of element.texts) assert.ok(!overlaps(label, text), 'label "' + label.text + '" does not cover the name of ' + id);
    }
  }
}

test('three-level nested nodes parse with correct parents and render each node inside its parent', async () => {
  const result = await renderGeometry(CAMPUS);
  assert.equal(result.kinds.pod, 'node');
  assert.equal(result.kinds.api, 'component');
  assertNestedGeometry(result, EXPECTED_PARENTS);
});

test('links between components in different nested nodes are routed outside unrelated nodes', async () => {
  const result = await renderGeometry(CAMPUS);
  assert.equal(result.routes.length, 3);
  assertRoutesAndLabels(result);
  // A short label between two stacked nested siblings has room between them:
  // it stays wholly inside their parent and crosses no outline.
  const amqp = result.labels.find((label) => label.text === 'AMQP');
  assert.ok(inside(amqp, result.elements.k8s.box, 0), 'the AMQP label stays inside the Kubernetes cluster');
  for (const [id, element] of Object.entries(result.elements)) {
    assert.ok(!crossesOutline(amqp, element), 'the AMQP label does not straddle the outline of ' + id);
  }
});

test('labels in single-level diagrams straddle no outline and sit nearest their own link', async () => {
  for (const [name, source] of Object.entries(SINGLE_LEVEL)) {
    const result = await renderGeometry(source);
    assert.deepEqual(result.labels.map((label) => label.text).sort(),
      result.links.map((link) => link.label).sort(), name + ': every link label is drawn once');
    for (const label of result.labels) {
      for (const [id, element] of Object.entries(result.elements)) {
        assert.ok(!crossesOutline(label, element), name + ': label "' + label.text + '" does not straddle the outline of ' + id);
      }
      const ownRoute = routeOfLabel(result, label);
      const ownDistance = distanceToRoute(label, ownRoute);
      for (const route of result.routes.filter((candidate) => candidate !== ownRoute)) {
        assert.ok(distanceToRoute(label, route) > ownDistance, name + ': label "' + label.text + '" is nearer its own link than ' +
          route.source + ' -> ' + route.target);
      }
    }
  }
});

// Stands in for the C4 projection test until the C4 core can produce this text.
test('C4-shaped deployment text with hyphenated aliases, instance counts, and stereotyped hosts parses and nests', async () => {
  const result = await renderGeometry(C4_SHAPED);
  assert.equal(result.kinds['api-pod'], 'node');
  assert.equal(result.stereotypes['api-pod'], 'executionEnvironment');
  assert.equal(result.stereotypes.ingress, 'infrastructure');
  assert.equal(result.stereotypes.api, 'container');
  assert.equal(result.stereotypes.billing, 'software system');
  assert.deepEqual(result.links.map((link) => link.from + ' -> ' + link.to),
    ['web -> api', 'api -> db', 'api -> billing', 'ingress -> api-pod']);
  assert.ok(result.elements['api-pod'].texts.some((text) => text.text === 'API pod ×3'), 'the instance count is part of the visible name');
  assertNestedGeometry(result, C4_PARENTS);
  assertRoutesAndLabels(result);
});

test('the describer reports containment for every nesting level', () => {
  const context = { window: {}, setInterval() {}, clearInterval() {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/uml-auto-describe.js'), 'utf8'), context);
  const describe = context.window.UMLAutoDescribe;

  const summary = describe.describe('deployment', CAMPUS);
  assert.match(summary, /7 nodes/);
  assert.match(summary, /3 components/);

  const items = describe.describeVerbose('deployment', CAMPUS).sections.flatMap((section) => section.items);
  const item = (label) => items.find((text) => text.startsWith(label + ' '));
  assert.match(item('API pod'), /inside Kubernetes cluster.*inside Campus cloud/, 'a doubly nested node names both enclosing levels');
  assert.match(item('Registration API'), /inside API pod.*inside Kubernetes cluster.*inside Campus cloud/);
  assert.match(item('Web app'), /inside Web browser.*inside Student laptop/);
  assert.match(item('Kubernetes cluster'), /contains node API pod and node Worker pod/);
  assert.match(item('Campus cloud'), /contains node Kubernetes cluster and node Database server/);
  assert.doesNotMatch(item('Campus cloud'), /inside/, 'a top-level node is not inside anything');
  assert.doesNotMatch(item('Database server'), /contains/);

  // A closing brace returns to the enclosing node rather than to the top level.
  const reopened = describe.describeVerbose('deployment',
    'node Outer {\n  node Inner {\n    component A\n  }\n  component B\n}\ncomponent C');
  const reopenedItems = reopened.sections.flatMap((section) => section.items);
  assert.ok(reopenedItems.includes('B inside Outer'), JSON.stringify(reopenedItems));
  assert.ok(reopenedItems.includes('C'), JSON.stringify(reopenedItems));

  // Hyphenated aliases resolve to their display names at every level.
  const c4Items = describe.describeVerbose('deployment', C4_SHAPED).sections.flatMap((section) => section.items);
  const c4Item = (label) => c4Items.find((text) => text.startsWith(label + ' '));
  assert.match(c4Item('Registration API'), /inside API pod ×3 inside Kubernetes cluster inside Campus cloud/);
  assert.match(c4Item('API pod ×3'), /inside Kubernetes cluster inside Campus cloud contains component Registration API/);
  assert.match(c4Item('Ingress load balancer'), /^Ingress load balancer \(infrastructure\) inside Kubernetes cluster inside Campus cloud$/);
  assert.ok(c4Items.some((text) => /^Ingress load balancer .*API pod ×3: forwards HTTPS requests to\.$/.test(text)), JSON.stringify(c4Items));
});

test('saved positions of nested declarations with stereotypes are kept, not shifted with their parent', async () => {
  // The visual editor saves every element's absolute position after a move;
  // a stereotype after the alias stores that position under the label.
  const source = CAMPUS.replace('@enduml', [
    '@layout schema=1',
    'node "Campus cloud" x=500 y=400',
    'node "Kubernetes cluster" x=540 y=500',
    'node "API pod" x=580 y=600',
    'node api x=600 y=690',
    '@endlayout',
    '@enduml'
  ].join('\n'));
  const result = await renderGeometry(source);
  assert.deepEqual([result.elements.cloud.box.x, result.elements.cloud.box.y], [500, 400]);
  assert.deepEqual([result.elements.k8s.box.x, result.elements.k8s.box.y], [540, 500]);
  assert.deepEqual([result.elements.pod.box.x, result.elements.pod.box.y], [580, 600]);
  assert.deepEqual([result.elements.api.box.x, result.elements.api.box.y], [600, 690]);
});

// The reference model's production environment, projected and written as ArchUML text by the C4 core.
test('C4 deployment text from ArchUMLC4.toUml parses and nests', async () => {
  const core = require('../../js/ArchUML/c4/c4-core.js');
  const model = fs.readFileSync(path.join(root, 'js/ArchUML/tests/c4/fixtures/course-registration.yml'), 'utf8');
  const generated = core.toUml(core.project(core.load(model), 'deployment production'));
  assert.equal(generated.type, 'deployment');
  const result = await renderGeometry(generated.text);
  assertNestedGeometry(result, {
    laptop: null, browser: 'laptop', web: 'browser',
    campus_cloud: null, ingress: 'campus_cloud', api_pod: 'campus_cloud', api: 'api_pod',
    postgres: 'campus_cloud', db: 'postgres',
    data_centre: null, billing: 'data_centre'
  });
  assert.equal(result.routes.length, result.links.length, 'every communication path is drawn');
});
