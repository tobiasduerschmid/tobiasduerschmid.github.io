'use strict';

// Deployment views of a C4 model are drawn by the UML deployment renderer (spec §6.3). Every communication path
// label must name its own link: it sits beside that link and nearer to it than to any other link, and it lies across
// no other link. The chapter's production deployment view once drew "sends HTTPS requests to" beside the
// ingress → pod link and "forwards HTTPS requests to" far from every link, because each label was placed before the
// links drawn after it existed.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');
const { openC4Page } = require('./c4-route-views.js');

const ROOT = path.join(__dirname, '../..');
// The farthest a label may sit from its own link (the deployment renderer's beside-label placements are 8 away).
const BESIDE_DISTANCE = 30;

let browser;
let page;
before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  page = await openC4Page(browser);
});
after(async () => { if (browser) await browser.close(); });

/**
 * Draws a C4 embed through `ArchUMLC4Render.render` and returns the drawn links (`{source, target, label, points}`,
 * the label as the deployment text it was drawn from) and the drawn link labels (`{text, x, y, width, height}`).
 */
function drawnDeployment(embed) {
  return page.evaluate((text) => {
    const renderer = window.UMLDeploymentDiagram;
    let umlText = null;
    window.UMLDeploymentDiagram = Object.assign({}, renderer, { render: (container, source) => renderer.render(container, umlText = source) });
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      window.ArchUMLC4Render.render(container, text);
    } finally {
      window.UMLDeploymentDiagram = renderer;
    }
    const svg = container.querySelector('svg');
    const parsed = renderer.parse(umlText);
    const links = [...svg.querySelectorAll('polyline[data-layout-route-id]')].map((line) => {
      const source = line.getAttribute('data-layout-source');
      const target = line.getAttribute('data-layout-target');
      const link = parsed.links.find((candidate) => candidate.from === source && candidate.to === target);
      return { source, target, label: link ? link.label : null, points: [...line.points].map((point) => ({ x: point.x, y: point.y })) };
    });
    const labels = [...svg.querySelectorAll('text[font-style="italic"]')].map((label) => {
      const box = label.getBBox();
      return { text: label.textContent, x: box.x, y: box.y, width: box.width, height: box.height };
    });
    // Each drawn node: its box, and everything its outline covers (the box with a node's cube faces).
    const nodes = [...svg.querySelectorAll('rect[data-layout-bounds-id]')].map((rect) => {
      const drawn = rect.closest('[data-layout-id]').getBBox();
      return {
        name: rect.getAttribute('data-layout-bounds-id'),
        box: { x: rect.x.baseVal.value, y: rect.y.baseVal.value, width: rect.width.baseVal.value, height: rect.height.baseVal.value },
        outline: { x: drawn.x, y: drawn.y, width: drawn.width, height: drawn.height },
      };
    });
    container.remove();
    return { links, labels, nodes };
  }, embed);
}

function segments(points) {
  return points.slice(1).map((point, index) => [points[index], point]);
}

/** Distance between an axis-aligned rectangle and an axis-aligned segment. */
function rectSegmentDistance(rect, [a, b]) {
  const dx = Math.max(0, Math.min(a.x, b.x) - (rect.x + rect.width), rect.x - Math.max(a.x, b.x));
  const dy = Math.max(0, Math.min(a.y, b.y) - (rect.y + rect.height), rect.y - Math.max(a.y, b.y));
  return Math.hypot(dx, dy);
}

function routeDistance(rect, points) {
  return Math.min(...segments(points).map((segment) => rectSegmentDistance(rect, segment)));
}

/** Every problem with the labels of a drawn deployment view, as sentences. */
function labelProblems({ links, labels }) {
  const problems = [];
  const labelled = links.filter((link) => link.label);
  if (labels.map((label) => label.text).sort().join('|') !== labelled.map((link) => link.label).sort().join('|')) {
    problems.push(`drawn labels ${JSON.stringify(labels.map((label) => label.text))} differ from link labels ${JSON.stringify(labelled.map((link) => link.label))}`);
  }
  for (const label of labels) {
    const own = labelled.find((link) => link.label === label.text);
    if (!own) continue;
    const ownDistance = routeDistance(label, own.points);
    if (ownDistance > BESIDE_DISTANCE) problems.push(`"${label.text}" is ${Math.round(ownDistance)} from its own link ${own.source} -> ${own.target}`);
    for (const other of links.filter((link) => link !== own)) {
      const distance = routeDistance(label, other.points);
      if (distance === 0) problems.push(`"${label.text}" lies across ${other.source} -> ${other.target}`);
      else if (distance <= ownDistance) problems.push(`"${label.text}" is as near to ${other.source} -> ${other.target} (${Math.round(distance)}) as to its own link (${Math.round(ownDistance)})`);
    }
  }
  return problems;
}

test('each label of the chapter deployment view sits beside its own link and nearer to it than to any other link', async () => {
  const model = fs.readFileSync(path.join(ROOT, '_includes/c4-models/course-registration.yml'), 'utf8');
  const drawn = await drawnDeployment(`view: deployment production\n${model}`);
  assert.equal(drawn.links.length, 4, 'the view draws its four communication paths');
  assert.deepEqual(labelProblems(drawn), []);
});

const contains = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y
  && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
const intersects = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// Final review I4: "forwards HTTPS requests to" ran across the Campus cloud node's right outline, where it reads as part
// of the outline. A label lies inside a node's box or clear of everything its outline covers.
test('no label of the chapter deployment view lies across a node outline', async () => {
  const model = fs.readFileSync(path.join(ROOT, '_includes/c4-models/course-registration.yml'), 'utf8');
  const { labels, nodes } = await drawnDeployment(`view: deployment production\n${model}`);
  assert.ok(nodes.length >= 5, 'the check covers the nodes');
  const across = labels.flatMap((label) => nodes.filter((node) => intersects(label, node.outline) && !contains(node.box, label))
    .map((node) => `"${label.text}" lies across the outline of ${node.name}`));
  assert.deepEqual(across, []);
});

test('each label of the reference deployment example sits beside its own link and nearer to it than to any other link', async () => {
  const reference = fs.readFileSync(path.join(ROOT, 'js/ArchUML/REFERENCE.md'), 'utf8');
  const example = reference.split('<pre><code class="language-c4">').slice(1).map((block) => block.split('</code></pre>')[0])
    .find((block) => /^view: deployment /m.test(block));
  assert.ok(example, 'the reference has a deployment example');
  const decoded = example.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const drawn = await drawnDeployment(decoded);
  assert.ok(drawn.links.length > 0, 'the example draws communication paths');
  assert.deepEqual(labelProblems(drawn), []);
});
