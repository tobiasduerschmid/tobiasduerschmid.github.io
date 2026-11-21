'use strict';

// The pure parts of the layout benchmark: which specs it finds, which text
// each variant renders, and the geometry it judges a drawing with.
const assert = require('node:assert/strict');
const test = require('node:test');
const bench = require('../uml-layout-benchmark.js');

const box = (x, y, width, height) => ({ x, y, width, height });
const pts = (...pairs) => pairs.map(([x, y]) => ({ x, y }));
const uml = (...lines) => ['@startuml', ...lines, '@enduml'].join('\n');

// ── spec extraction ──────────────────────────────────────────────────

test('a pre/code block yields its type and its decoded text', () => {
  const html = '<pre><code class="language-uml-class">@startuml\nA --&gt; B : &quot;x&quot;\n@enduml</code></pre>';
  const [found] = bench.specsFromPreCode(html);
  assert.equal(found.type, 'class');
  assert.equal(found.text, '@startuml\nA --> B : "x"\n@enduml');
});

test('a fenced uml block in Markdown yields its body', () => {
  const md = 'Text\n```uml-state\n@startuml\n[*] --> A\n@enduml\n```\nmore';
  const found = bench.specsFromMarkdown(md);
  assert.deepEqual(found.map((f) => [f.type, f.text]), [['state', '@startuml\n[*] --> A\n@enduml']]);
});

test('a data-uml-spec div yields its spec whatever the attribute order', () => {
  const md = `<div data-uml-spec='@startuml\nA -> B : hi\n@enduml' class="x" data-uml-type="sequence"></div>`;
  const [found] = bench.specsFromDataAttributes(md);
  assert.equal(found.type, 'sequence');
  assert.equal(found.text, '@startuml\nA -> B : hi\n@enduml');
});

test('a narration visual yields each diagram, class when no type is given', () => {
  const json = { resources: { diagrams: { a: { source: uml('class A') }, b: { type: 'state', source: uml('[*] --> S') } } } };
  assert.deepEqual(bench.specsFromNarration(json).map((f) => f.type), ['class', 'state']);
});

test('the corpus keeps class, state, sequence and component specs that are self-contained, each text once', () => {
  const block = (type, body) => `<pre><code class="language-uml-${type}">${body}</code></pre>`;
  const sources = [
    { file: 'a.html', kind: 'html', content: block('class', uml('class A')) + block('component', uml('[C]')) + block('usecase', uml('actor U')) },
    { file: 'b.md', kind: 'markdown', content: block('class', uml('class A')) + block('state', uml('[*] --> {{ page.x }}')) },
    { file: 'c.json', kind: 'narration', content: JSON.stringify({ resources: { diagrams: { d: { type: 'state', source: 'S1 --> S2' } } } }) },
  ];
  const corpus = bench.buildCorpus(sources);
  assert.deepEqual(corpus.map((s) => [s.id, s.file]), [['class-001', 'a.html'], ['component-001', 'a.html']]);
  assert.equal(corpus[0].alsoIn.length, 1);
  assert.match(corpus[0].alsoIn[0], /^b\.md /);
});

test('a spec is self-contained only with both markers and no Liquid', () => {
  assert.equal(bench.isSelfContained(uml('class A')), true);
  assert.equal(bench.isSelfContained('class A\n@enduml'), false);
  assert.equal(bench.isSelfContained(uml('class {% raw %}A')), false);
});

// ── variants ─────────────────────────────────────────────────────────

test('the no-preference variant drops every layout preference and keeps the direction', () => {
  const text = uml('layout compact 600x750', 'layout horizontal', 'layout tight', 'class A');
  assert.equal(bench.withLayoutPreference(text, null), uml('layout horizontal', 'class A'));
});

test('a compact variant puts its directive right after @startuml, replacing the authored one', () => {
  const text = uml('class A', 'layout compact');
  assert.equal(bench.variantText(text, bench.VARIANTS[1], true), uml('layout compact 600x750', 'class A'));
  assert.equal(bench.variantText(text, bench.VARIANTS[2], true), uml('layout compact 1200x675', 'class A'));
});

test('a bundle that cannot read a pane size gets a bare compact line', () => {
  assert.equal(bench.variantText(uml('class A'), bench.VARIANTS[1], false), uml('layout compact', 'class A'));
});

test('an @layout block survives every variant', () => {
  const text = uml('class A', '@layout', 'pos A 10 10', '@endlayout');
  bench.VARIANTS.forEach((v) => assert.match(bench.variantText(text, v, true), /@layout\npos A 10 10\n@endlayout/));
});

// ── geometry ─────────────────────────────────────────────────────────

test('bends: a straight run has none, an L one, a run split by collinear points none, a reversal one', () => {
  assert.equal(bench.bendCount(pts([0, 0], [100, 0])), 0);
  assert.equal(bench.bendCount(pts([0, 0], [100, 0], [100, 50])), 1);
  assert.equal(bench.bendCount(pts([0, 0], [40, 0], [40, 0], [100, 0])), 0);
  assert.equal(bench.bendCount(pts([0, 0], [100, 0], [50, 0])), 1);
});

test('crossings: a proper cross counts, a T-junction and a shared end do not', () => {
  const s = pts([0, 0], [100, 100]);
  assert.equal(bench.properCross(s, pts([0, 100], [100, 0])), true);
  assert.equal(bench.properCross(pts([0, 50], [100, 50]), pts([50, 50], [50, 100])), false);
  assert.equal(bench.properCross(s, pts([100, 100], [200, 0])), false);
});

test('crossings are counted between different routes only', () => {
  const routes = [
    { id: 'a', points: pts([0, 0], [100, 100]) },
    { id: 'b', points: pts([0, 100], [100, 0]) },
    { id: 'a', points: pts([0, 20], [100, 80]) }, // crosses b, not its own first part
  ];
  assert.equal(bench.crossingCount(routes), 2);
});

test('boxes just touching do not overlap; one unit in does; containment is not overlap of their own', () => {
  assert.equal(bench.boxesOverlap(box(0, 0, 10, 10), box(10, 0, 10, 10)), false);
  assert.equal(bench.boxesOverlap(box(0, 0, 10, 10), box(9, 0, 10, 10)), true);
  assert.equal(bench.containsBox(box(0, 0, 100, 100), box(10, 10, 10, 10)), true);
});

test('a line through a box is found, one passing beside it is not', () => {
  assert.equal(bench.lineThroughBox(pts([-10, 5], [20, 5]), box(0, 0, 10, 10)), true);
  assert.equal(bench.lineThroughBox(pts([-10, 15], [20, 15]), box(0, 0, 10, 10)), false);
});

test('distance from a box to a line: zero when it crosses, the gap otherwise', () => {
  assert.equal(bench.boxToLineDistance(box(0, 0, 10, 10), pts([5, -5], [5, 20])), 0);
  assert.equal(bench.boxToLineDistance(box(0, 0, 10, 10), pts([30, -5], [30, 20])), 20);
});

test('label px is the smallest font scaled into the pane', () => {
  assert.equal(bench.labelPx(14, 600, 300, { width: 600, height: 750 }), 14);
  assert.equal(bench.labelPx(14, 1200, 300, { width: 600, height: 750 }), 7);
  assert.equal(bench.labelPx(null, 600, 300, { width: 600, height: 750 }), null);
});

test('percentiles interpolate and ignore missing values', () => {
  assert.equal(bench.median([3, null, 1, 2]), 2);
  assert.equal(bench.percentile([0, 10], 0.1), 1);
  assert.equal(bench.percentile([], 0.5), null);
});

// ── judging a drawing ───────────────────────────────────────────────

function drawing(extra) {
  return {
    width: 600, height: 300, smallestFont: 14,
    nodes: [{ id: 'A', box: box(0, 0, 100, 40), container: false }, { id: 'B', box: box(0, 200, 100, 40), container: false }],
    routes: [{ id: 'e1', source: 'A', target: 'B', points: pts([50, 40], [50, 200]) }],
    texts: [{ text: 'A', box: box(10, 10, 20, 14), route: null, font: 14 }, { text: 'go', box: box(55, 100, 30, 14), route: 'e1', font: 14 }],
    ...extra,
  };
}

test('a clean drawing has no overlap and its label sits by its line', () => {
  const judged = bench.judge(drawing());
  assert.equal(judged.overlapTotal, 0);
  assert.equal(judged.labelsMeasured, 1);
  assert.equal(judged.labelsDetached, 0);
  assert.equal(judged.labelPx.column, 14);
});

test('two overlapping boxes and a line through a foreign box are each counted once', () => {
  const judged = bench.judge(drawing({
    nodes: [
      { id: 'A', box: box(0, 0, 100, 40), container: false },
      { id: 'B', box: box(0, 200, 100, 40), container: false },
      { id: 'C', box: box(30, 100, 60, 40), container: false },
      { id: 'D', box: box(80, 110, 60, 40), container: false },
    ],
  }));
  assert.equal(judged.overlaps.boxBox, 1);
  assert.equal(judged.overlaps.lineBox, 1);
});

test('texts sharing one box may overlap; a label far from its line is detached', () => {
  const judged = bench.judge(drawing({
    texts: [
      { text: 'x', box: box(10, 10, 20, 14), route: null, font: 14 },
      { text: 'y', box: box(15, 12, 20, 14), route: null, font: 14 },
      { text: 'go', box: box(300, 100, 30, 14), route: 'e1', font: 14 },
    ],
  }));
  assert.equal(judged.overlaps.textText, 0);
  assert.equal(judged.labelsDetached, 1);
});

test('a free label crossed by a foreign line overlaps; by its own line it does not', () => {
  const routes = [
    { id: 'e1', source: 'A', target: 'B', points: pts([50, 40], [50, 200]) },
    { id: 'e2', source: 'A', target: 'B', points: pts([70, 40], [70, 200]) },
  ];
  const judged = bench.judge(drawing({ routes, texts: [{ text: 'go', box: box(45, 100, 20, 14), route: 'e1', font: 14 }] }));
  assert.equal(judged.overlaps.textLine, 0);
  const crossed = bench.judge(drawing({ routes, texts: [{ text: 'go', box: box(60, 100, 20, 14), route: 'e1', font: 14 }] }));
  assert.equal(crossed.overlaps.textLine, 1);
});

// ── report ───────────────────────────────────────────────────────────

// The drawing without a layout line depends on its container's shape, so a
// compact drawing is held against the one drawn in the same pane.
test('a compact drawing is compared with the no-preference drawing of its own pane', () => {
  const corpus = [{ id: 'class-001', type: 'class', file: 'f.md', where: 'L1', text: uml('class A') }];
  const record = (variant, column, wide, bends) => ({
    id: 'class-001', type: 'class', file: 'f.md L1', variant, ms: 1, markup: '', labelPx: { column, wide },
    overlaps: { boxBox: 0, textText: 0, textLine: 0, lineBox: 0 }, overlapTotal: 0, crossings: 0, bends, labelsDetached: 0,
  });
  const records = bench.VARIANTS.map((v) => ({
    'none': record('none', 10, 20, 4),               // a wide row in 1200×675
    'none-600x750': record('none-600x750', 8, 16, 16), // a column in 600×750
    'compact-600x750': record('compact-600x750', 9, 18, 16),
    'compact-1200x675': record('compact-1200x675', 10, 21, 4),
  })[v.name]);
  const text = bench.report(corpus, records, null);
  assert.match(text, /below the no-preference layout: 0 /);
  assert.match(text, /more crossings than none: 0; more bends: 0/);
});
