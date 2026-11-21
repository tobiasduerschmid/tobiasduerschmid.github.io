#!/usr/bin/env node
'use strict';

/**
 * ArchUML layout benchmark: how large the smallest label of every class,
 * state, sequence and component diagram of the site ends up in its pane, and what the
 * drawing pays for it (overlaps, crossings, bends, labels away from their
 * lines, render time). Everything is measured from the rendered DOM, not
 * from the renderer's own records.
 *
 *   node scripts/uml-layout-benchmark.js --bundle <path> [--compare <oldBundle>] [--json <out>] [--types class,sequence]
 *
 * Each spec is rendered four times, in a container of the pane's size:
 *   none              no layout preference                 1200×675
 *   compact-600x750   `layout compact 600x750`             600×750
 *   compact-1200x675  `layout compact 1200x675`            1200×675
 *   none-600x750      no layout preference                 600×750
 * The drawing without a layout line follows its container's shape, so each
 * compact drawing is compared with the no-preference drawing of its pane.
 * A bundle whose parser does not know the pane size (today's) gets a bare
 * `layout compact` in the same container instead, which is how its compact
 * reads its pane.
 *
 * Corpus: `test-uml.html`, `SEBook/**\/*.md` and `_data/narration_visuals/*.json`,
 * self-contained specs only (no Liquid, a complete @startuml … @enduml).
 * No Jekyll server: the bundle is loaded into a blank page.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RENDERERS = { class: 'UMLClassDiagram', state: 'UMLStateDiagram', sequence: 'UMLSequenceDiagram', component: 'UMLComponentDiagram' };
const PANES = {
  wide: { width: 1200, height: 675 },
  column: { width: 600, height: 750 },
};
const VARIANTS = [
  { name: 'none', pane: 'wide', compact: false },
  { name: 'compact-600x750', pane: 'column', compact: true },
  { name: 'compact-1200x675', pane: 'wide', compact: true },
  { name: 'none-600x750', pane: 'column', compact: false },
];
const OVERLAP_TOLERANCE = 0.5;   // design spec 6.4
const DETACHED_MARGIN = 6;       // a label farther than font + 6 from its line is detached
const REGRESSION_SHARE = 0.02;   // "more than 2 % below"
const RENDER_TIMEOUT_MS = 120000;

// ───── Spec extraction ───────────────────────────────────────────────

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function lineAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

// A spec the bundle can render as it stands: one complete @startuml block
// and nothing a page template fills in later.
function isSelfContained(text) {
  return /^\s*@startuml\b/m.test(text) && /^\s*@enduml\b/m.test(text) && !/\{\{|\{%/.test(text);
}

function normalizeSpec(text) {
  return text.replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\s+$/, '') + '\n';
}

// `<pre><code class="language-uml-class">…</code></pre>` blocks.
function specsFromPreCode(content) {
  const found = [];
  const re = /<pre[^>]*>\s*<code\s+class="([^"]*)"[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/g;
  let m;
  while ((m = re.exec(content))) {
    const type = (m[1].match(/language-uml-([a-z]+)/) || [])[1];
    if (type) found.push({ type, text: decodeEntities(m[2]), where: `pre-code L${lineAt(content, m.index)}` });
  }
  return found;
}

// ```uml-class fenced blocks.
function specsFromFences(content) {
  const found = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(/^\s*(`{3,}|~{3,})\s*uml-([a-z]+)\s*$/);
    if (!open) continue;
    const fence = open[1];
    const body = [];
    let j = i + 1;
    while (j < lines.length && !lines[j].trim().startsWith(fence)) body.push(lines[j++]);
    found.push({ type: open[2], text: body.join('\n'), where: `fence L${i + 1}` });
    i = j;
  }
  return found;
}

// `<div data-uml-type="state" data-uml-spec='…'>`, attributes in any order.
function specsFromDataAttributes(content) {
  const found = [];
  const tagRe = /<div\b(?=(?:[^>"']|"[^"]*"|'[^']*')*data-uml-type)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let m;
  while ((m = tagRe.exec(content))) {
    const type = (m[1].match(/data-uml-type\s*=\s*(["'])([a-z]+)\1/) || [])[2];
    const spec = m[1].match(/data-uml-spec\s*=\s*(?:"([^"]*)"|'([^']*)')/);
    if (type && spec) found.push({ type, text: decodeEntities(spec[1] != null ? spec[1] : spec[2]), where: `data-uml-spec L${lineAt(content, m.index)}` });
  }
  return found;
}

function specsFromMarkdown(content) {
  return [...specsFromPreCode(content), ...specsFromFences(content), ...specsFromDataAttributes(content)];
}

// A narration visual's `resources.diagrams`: { id: { type, source } }.
function specsFromNarration(json) {
  const diagrams = (json && json.resources && json.resources.diagrams) || {};
  return Object.entries(diagrams).map(([id, d]) => ({
    type: d.type || 'class',
    text: typeof d.source === 'string' ? d.source : '',
    where: `diagrams.${id}`,
  }));
}

/**
 * The benchmark corpus from a list of `{file, kind, content}` sources:
 * class, state, sequence and component specs that are self-contained, each text once
 * (later copies are listed in `alsoIn`), with ids like `state-007`.
 */
function buildCorpus(sources) {
  const byKey = new Map();
  const corpus = [];
  sources.forEach(({ file, kind, content }) => {
    const found = kind === 'narration' ? specsFromNarration(JSON.parse(content))
      : kind === 'html' ? specsFromPreCode(content) : specsFromMarkdown(content);
    found.forEach(({ type, text, where }) => {
      if (!RENDERERS[type] || !isSelfContained(text)) return;
      const spec = normalizeSpec(text);
      const key = type + '\u0000' + spec;
      if (byKey.has(key)) { byKey.get(key).alsoIn.push(`${file} ${where}`); return; }
      const entry = { id: null, type, file, where, text: spec, alsoIn: [] };
      byKey.set(key, entry);
      corpus.push(entry);
    });
  });
  const counters = {};
  corpus.forEach((entry) => {
    counters[entry.type] = (counters[entry.type] || 0) + 1;
    entry.id = `${entry.type}-${String(counters[entry.type]).padStart(3, '0')}`;
  });
  return corpus;
}

function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return markdownFiles(p);
    return e.name.endsWith('.md') ? [p] : [];
  });
}

function readSources(root) {
  const read = (file, kind) => ({ file: path.relative(root, file), kind, content: fs.readFileSync(file, 'utf8') });
  const narrationDir = path.join(root, '_data', 'narration_visuals');
  return [
    read(path.join(root, 'test-uml.html'), 'html'),
    ...markdownFiles(path.join(root, 'SEBook')).sort().map((f) => read(f, 'markdown')),
    ...fs.readdirSync(narrationDir).filter((f) => f.endsWith('.json')).sort().map((f) => read(path.join(narrationDir, f), 'narration')),
  ];
}

// ───── Variants ──────────────────────────────────────────────────────

const PREFERENCE_LINE = /^\s*layout\s+(square|landscape|portrait|compact|tight|auto|default|none)(\s+\S+)?\s*$/i;

/**
 * The spec with every layout preference line removed and, when `directive`
 * is given (`layout compact 600x750`), that line put right after @startuml.
 * Direction lines (`layout horizontal`) and @layout blocks stay.
 */
function withLayoutPreference(text, directive) {
  const lines = text.split('\n').filter((line) => !PREFERENCE_LINE.test(line));
  if (directive) {
    const start = lines.findIndex((line) => /^\s*@startuml\b/.test(line));
    lines.splice(start + 1, 0, directive);
  }
  return lines.join('\n');
}

function variantText(text, variant, paneDirective) {
  if (!variant.compact) return withLayoutPreference(text, null);
  const pane = PANES[variant.pane];
  return withLayoutPreference(text, paneDirective ? `layout compact ${pane.width}x${pane.height}` : 'layout compact');
}

// ───── Geometry ──────────────────────────────────────────────────────
// Boxes are {x, y, width, height}; points are {x, y}; a route is
// {id, source, target, points}.

const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

// Drops repeated points and points on a straight run; a reversal stays a bend.
function mergeCollinear(points) {
  const out = [];
  points.forEach((p) => { if (!out.length || distance(out[out.length - 1], p) > 0.01) out.push(p); });
  for (let i = 1; i < out.length - 1;) {
    const a = out[i - 1], b = out[i], c = out[i + 1];
    const span = distance(a, c);
    const off = span < 0.01 ? Infinity : Math.abs((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / span;
    const forward = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) > 0;
    if (off < 0.5 && forward) out.splice(i, 1); else i++;
  }
  return out;
}

function bendCount(points) {
  return Math.max(0, mergeCollinear(points).length - 2);
}

function segmentsOf(points) {
  const out = [];
  for (let i = 1; i < points.length; i++) out.push([points[i - 1], points[i]]);
  return out;
}

// Signed distance of c from the line through a and b.
function side(a, b, c) {
  const length = distance(a, b);
  return length < 1e-9 ? 0 : ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / length;
}

// Two segments cross at a point inside both (no T-junction, no shared end).
function properCross(s, t) {
  const E = 0.01;
  const opposite = (u, v) => (u > E && v < -E) || (u < -E && v > E);
  return opposite(side(s[0], s[1], t[0]), side(s[0], s[1], t[1])) &&
    opposite(side(t[0], t[1], s[0]), side(t[0], t[1], s[1]));
}

function crossingCount(routes) {
  let count = 0;
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      if (routes[i].id === routes[j].id) continue;
      segmentsOf(routes[i].points).forEach((s) => {
        segmentsOf(routes[j].points).forEach((t) => { if (properCross(s, t)) count++; });
      });
    }
  }
  return count;
}

// Length of segment s inside box b (Liang–Barsky clipping).
function lengthInBox(s, b) {
  let t0 = 0, t1 = 1;
  const dx = s[1].x - s[0].x, dy = s[1].y - s[0].y;
  const P = [-dx, dx, -dy, dy];
  const Q = [s[0].x - b.x, b.x + b.width - s[0].x, s[0].y - b.y, b.y + b.height - s[0].y];
  for (let i = 0; i < 4; i++) {
    if (P[i] === 0) { if (Q[i] < 0) return 0; continue; }
    const r = Q[i] / P[i];
    if (P[i] < 0) { if (r > t1) return 0; t0 = Math.max(t0, r); } else { if (r < t0) return 0; t1 = Math.min(t1, r); }
  }
  return Math.max(0, t1 - t0) * Math.hypot(dx, dy);
}

function lineThroughBox(points, box, tolerance = OVERLAP_TOLERANCE) {
  return segmentsOf(points).some((s) => lengthInBox(s, box) > tolerance);
}

function boxesOverlap(a, b, tolerance = OVERLAP_TOLERANCE) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > tolerance && h > tolerance;
}

function containsBox(outer, inner, tolerance = OVERLAP_TOLERANCE) {
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance;
}

function inset(box, by) {
  return { x: box.x + by, y: box.y + by, width: box.width - 2 * by, height: box.height - 2 * by };
}

// Shortest distance between a box and a polyline (0 when they touch).
function boxToLineDistance(box, points) {
  let best = Infinity;
  segmentsOf(points).forEach(([a, b]) => {
    if (lengthInBox([a, b], box) > 0) { best = 0; return; }
    const corners = [
      { x: box.x, y: box.y }, { x: box.x + box.width, y: box.y },
      { x: box.x, y: box.y + box.height }, { x: box.x + box.width, y: box.y + box.height },
    ];
    corners.forEach((c) => { best = Math.min(best, pointToSegment(c, a, b)); });
    [a, b].forEach((p) => { best = Math.min(best, pointToBox(p, box)); });
  });
  return best;
}

function pointToSegment(p, a, b) {
  const lengthSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = lengthSq ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / lengthSq)) : 0;
  return distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

function pointToBox(p, box) {
  const dx = Math.max(box.x - p.x, 0, p.x - box.x - box.width);
  const dy = Math.max(box.y - p.y, 0, p.y - box.y - box.height);
  return Math.hypot(dx, dy);
}

// Predicted on-screen size of the smallest label (design spec 6.1).
function labelPx(smallestFont, width, height, pane) {
  if (!(smallestFont > 0 && width > 0 && height > 0)) return null;
  return smallestFont * Math.min(pane.width / width, pane.height / height);
}

// ───── Judging one drawing ───────────────────────────────────────────
// `raw` is what the page measured: {width, height, smallestFont, nodes,
// routes, texts}; nodes {id, box, container}, texts {text, box, route, font}.

function endpointIds(route) {
  const ids = new Set();
  [route.source, route.target].forEach((id) => {
    if (id == null) return;
    ids.add(id);
    ids.add(String(id).split('.')[0]); // a port belongs to its box
  });
  return ids;
}

// The smallest node a text lies inside, or null.
function enclosingNode(text, nodes) {
  let best = null;
  nodes.forEach((n) => {
    if (containsBox(n.box, text.box, 1) && (!best || n.box.width * n.box.height < best.box.width * best.box.height)) best = n;
  });
  return best;
}

function boxBoxOverlaps(plain) {
  const found = [];
  for (let i = 0; i < plain.length; i++) {
    for (let j = i + 1; j < plain.length; j++) {
      const a = plain[i], b = plain[j];
      if (boxesOverlap(a.box, b.box) && !containsBox(a.box, b.box) && !containsBox(b.box, a.box)) found.push(`${a.id} x ${b.id}`);
    }
  }
  return found;
}

function textTextOverlaps(texts) {
  const found = [];
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.node && a.node === b.node) continue;
      if (boxesOverlap(a.box, b.box)) found.push(`"${a.text}" x "${b.text}"`);
    }
  }
  return found;
}

function textLineOverlaps(texts, routes) {
  const found = [];
  texts.filter((t) => !t.node).forEach((t) => {
    const box = inset(t.box, 1);
    routes.forEach((r) => {
      if (r.id !== t.route && lineThroughBox(r.points, box)) found.push(`"${t.text}" by ${r.id}`);
    });
  });
  return found;
}

function lineBoxOverlaps(routes, plain) {
  const found = [];
  routes.forEach((r) => {
    const ends = endpointIds(r);
    plain.forEach((n) => {
      if (ends.has(n.id) || ends.has(String(n.id).split('.')[0])) return;
      const box = inset(n.box, 2);
      if (box.width > 0 && box.height > 0 && lineThroughBox(r.points, box)) found.push(`${r.id} through ${n.id}`);
    });
  });
  return found;
}

// Labels that name a drawn route: how far from it, and whether they are
// detached (farther than one line height, or nearer to another route).
function labelPlacement(texts, routes) {
  const byId = new Map(routes.map((r) => [r.id, r]));
  const result = { measured: 0, detached: [], maxDistance: 0 };
  texts.forEach((t) => {
    const own = byId.get(t.route);
    if (!own) return;
    result.measured++;
    const ownDistance = boxToLineDistance(t.box, own.points);
    const nearestOther = Math.min(Infinity, ...routes.filter((r) => r.id !== own.id).map((r) => boxToLineDistance(t.box, r.points)));
    result.maxDistance = Math.max(result.maxDistance, ownDistance);
    if (ownDistance > t.font + DETACHED_MARGIN || nearestOther < ownDistance) result.detached.push(`"${t.text}" ${ownDistance.toFixed(1)} from ${own.id}`);
  });
  return result;
}

function judge(raw) {
  const routes = raw.routes.map((r) => ({ ...r, points: mergeCollinear(r.points) }));
  const plain = raw.nodes.filter((n) => !n.container);
  const texts = raw.texts.map((t) => ({ ...t, node: (enclosingNode(t, plain) || {}).id || null }));
  const overlaps = {
    boxBox: boxBoxOverlaps(plain),
    textText: textTextOverlaps(texts),
    textLine: textLineOverlaps(texts, routes),
    lineBox: lineBoxOverlaps(routes, plain),
  };
  const labels = labelPlacement(texts, routes);
  return {
    width: raw.width,
    height: raw.height,
    smallestFont: raw.smallestFont,
    labelPx: { wide: labelPx(raw.smallestFont, raw.width, raw.height, PANES.wide), column: labelPx(raw.smallestFont, raw.width, raw.height, PANES.column) },
    overlaps: Object.fromEntries(Object.entries(overlaps).map(([k, v]) => [k, v.length])),
    overlapExamples: Object.values(overlaps).flat().slice(0, 6),
    overlapTotal: Object.values(overlaps).reduce((sum, v) => sum + v.length, 0),
    crossings: crossingCount(routes),
    bends: routes.reduce((sum, r) => sum + bendCount(r.points), 0),
    labelsMeasured: labels.measured,
    labelsDetached: labels.detached.length,
    detachedExamples: labels.detached.slice(0, 4),
    maxLabelDistance: labels.maxDistance,
  };
}

// ───── Statistics and report ─────────────────────────────────────────

function percentile(values, p) {
  const sorted = values.filter((v) => v != null && isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const at = (sorted.length - 1) * p;
  const lo = Math.floor(at), hi = Math.ceil(at);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}

const median = (values) => percentile(values, 0.5);
const fmt = (v, digits = 1) => (v == null ? '–' : Number(v).toFixed(digits));
const table = (header, rows) => [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

// Each compact variant with its pane and the no-preference drawing of that pane.
const COMPACT_PANES = [
  { variant: 'compact-600x750', pane: 'column', none: 'none-600x750' },
  { variant: 'compact-1200x675', pane: 'wide', none: 'none' },
];
const noneOf = (variant) => COMPACT_PANES.find((c) => c.variant === variant).none;

// Rows keyed `${id}|${variant}` → record, per bundle.
function indexRecords(records) {
  return new Map(records.map((r) => [`${r.id}|${r.variant}`, r]));
}

function labelSizeTable(corpus, newRecords, oldRecords) {
  const fresh = indexRecords(newRecords), old = oldRecords && indexRecords(oldRecords);
  const rows = [];
  Object.keys(RENDERERS).forEach((type) => {
    const specs = corpus.filter((s) => s.type === type);
    if (!specs.length) return;
    COMPACT_PANES.forEach(({ variant, pane, none: noneVariant }) => {
      const px = (index, v) => specs.map((s) => { const r = index.get(`${s.id}|${v}`); return r && !r.error ? r.labelPx[pane] : null; });
      const none = px(fresh, noneVariant), now = px(fresh, variant), then = old ? px(old, variant) : [];
      rows.push([type, `${PANES[pane].width}×${PANES[pane].height}`, specs.length,
        fmt(median(none)), fmt(percentile(none, 0.1)),
        fmt(median(then)), fmt(percentile(then, 0.1)),
        fmt(median(now)), fmt(percentile(now, 0.1))]);
    });
  });
  return table(['type', 'pane', 'specs', 'none median', 'none p10', 'old compact median', 'old p10', 'new compact median', 'new p10'], rows);
}

// Specs where new compact's label size falls short of a reference variant.
function shortfalls(corpus, newRecords, refRecords, refVariantOf, share) {
  const fresh = indexRecords(newRecords), ref = indexRecords(refRecords);
  const found = [];
  corpus.forEach((s) => {
    COMPACT_PANES.forEach(({ variant, pane }) => {
      const now = fresh.get(`${s.id}|${variant}`), then = ref.get(`${s.id}|${refVariantOf(variant)}`);
      if (!now || !then || now.error || then.error) return;
      const a = now.labelPx[pane], b = then.labelPx[pane];
      if (a != null && b != null && a < b * (1 - share)) found.push({ id: s.id, file: `${s.file} ${s.where}`, pane: variant, now: a, ref: b, ratio: a / b });
    });
  });
  return found.sort((p, q) => p.ratio - q.ratio);
}

function shortfallTable(found) {
  return table(['spec', 'source', 'pane', 'new px', 'reference px', 'ratio'],
    found.slice(0, 10).map((f) => [f.id, f.file, f.pane, fmt(f.now), fmt(f.ref), fmt(f.ratio, 2)]));
}

function totals(records, variant) {
  const rows = records.filter((r) => r.variant === variant && !r.error);
  const sum = (key) => rows.reduce((acc, r) => acc + key(r), 0);
  return {
    overlaps: sum((r) => r.overlapTotal),
    boxBox: sum((r) => r.overlaps.boxBox), textText: sum((r) => r.overlaps.textText),
    textLine: sum((r) => r.overlaps.textLine), lineBox: sum((r) => r.overlaps.lineBox),
    detached: sum((r) => r.labelsDetached), crossings: sum((r) => r.crossings), bends: sum((r) => r.bends),
    errors: records.filter((r) => r.variant === variant && r.error).length,
  };
}

function totalsTable(newRecords, oldRecords) {
  const rows = [];
  const add = (label, records, variant) => {
    const t = totals(records, variant);
    rows.push([label, t.overlaps, t.boxBox, t.textText, t.textLine, t.lineBox, t.detached, t.crossings, t.bends, t.errors]);
  };
  ['none', 'none-600x750'].forEach((variant) => {
    add(`${variant} (new)`, newRecords, variant);
    if (oldRecords) add(`${variant} (old)`, oldRecords, variant);
  });
  COMPACT_PANES.forEach(({ variant }) => {
    if (oldRecords) add(`old ${variant}`, oldRecords, variant);
    add(`new ${variant}`, newRecords, variant);
  });
  return table(['drawing', 'overlaps', 'box/box', 'text/text', 'text/line', 'line/box', 'detached labels', 'crossings', 'bends', 'errors'], rows);
}

// Specs where a compact drawing has more crossings or bends than the
// no-preference drawing of its pane.
function edgeRegressions(corpus, records) {
  const index = indexRecords(records);
  const found = { crossings: [], bends: [] };
  corpus.forEach((s) => {
    COMPACT_PANES.forEach(({ variant, none: noneVariant }) => {
      const none = index.get(`${s.id}|${noneVariant}`);
      const c = index.get(`${s.id}|${variant}`);
      if (!none || !c || none.error || c.error) return;
      if (c.crossings > none.crossings) found.crossings.push(`${s.id} ${variant} ${c.crossings}>${none.crossings}`);
      if (c.bends > none.bends) found.bends.push(`${s.id} ${variant} ${c.bends}>${none.bends}`);
    });
  });
  return found;
}

function unchangedOutside(corpus, newRecords, oldRecords) {
  const fresh = indexRecords(newRecords), old = indexRecords(oldRecords);
  return corpus.filter((s) => ['none', 'none-600x750'].some((variant) => {
    const a = fresh.get(`${s.id}|${variant}`), b = old.get(`${s.id}|${variant}`);
    return !a || !b || a.markup !== b.markup;
  })).map((s) => `${s.id} (${s.file} ${s.where})`);
}

function slowest(records, count) {
  return records.filter((r) => r.ms != null).sort((a, b) => b.ms - a.ms).slice(0, count)
    .map((r) => `${r.id} ${r.variant} ${fmt(r.ms, 0)} ms (${r.file})`);
}

function report(corpus, newRecords, oldRecords) {
  const parts = [];
  parts.push(`Corpus: ${Object.keys(RENDERERS).map((t) => `${corpus.filter((s) => s.type === t).length} ${t}`).join(', ')}`);
  parts.push('\n## Label px (smallest font × min(paneW/w, paneH/h))\n' + labelSizeTable(corpus, newRecords, oldRecords));
  if (oldRecords) {
    const belowOld = shortfalls(corpus, newRecords, oldRecords, (v) => v, REGRESSION_SHARE);
    parts.push(`\n## New compact more than 2 % below old compact: ${belowOld.length} (spec, pane)\n` + shortfallTable(belowOld));
  }
  const belowNone = shortfalls(corpus, newRecords, newRecords, noneOf, 0);
  parts.push(`\n## New compact below the no-preference layout: ${belowNone.length} (spec, pane)\n` + shortfallTable(belowNone));
  parts.push('\n## Totals\n' + totalsTable(newRecords, oldRecords));
  const edges = edgeRegressions(corpus, newRecords);
  parts.push(`\n## New compact with more crossings than none: ${edges.crossings.length}; more bends: ${edges.bends.length}\n` +
    [...edges.crossings.map((e) => `- crossings ${e}`), ...edges.bends.map((e) => `- bends ${e}`)].join('\n'));
  if (oldRecords) {
    const differing = unchangedOutside(corpus, newRecords, oldRecords);
    parts.push(`\n## No-preference renders differing old vs new: ${differing.length}\n` + differing.map((d) => `- ${d}`).join('\n'));
  }
  parts.push('\n## Slowest five renders (new)\n' + slowest(newRecords, 5).map((s) => `- ${s}`).join('\n'));
  if (oldRecords) parts.push('\n## Slowest five renders (old)\n' + slowest(oldRecords, 5).map((s) => `- ${s}`).join('\n'));
  return parts.join('\n');
}

// ───── Rendering in the browser ──────────────────────────────────────

// Runs in the page: render one spec into a pane-sized container and read
// everything back in root SVG units (callouts nest the model in groups).
async function renderAndMeasure({ renderer, text, pane }) {
  document.body.innerHTML = '';
  const container = document.createElement('div');
  container.setAttribute('data-uml-fit', 'off');
  container.style.cssText = `width:${pane.width}px;height:${pane.height}px;overflow:hidden`;
  document.body.appendChild(container);
  const t0 = performance.now();
  try {
    window[renderer].render(container, text);
  } catch (e) {
    return { error: 'render threw: ' + (e && e.message ? e.message : String(e)) };
  }
  const ms = performance.now() - t0;
  const svg = container.querySelector('svg');
  if (!svg || !svg.viewBox.baseVal || !svg.viewBox.baseVal.width) return { ms, error: 'no svg with a viewBox' };
  const vb = svg.viewBox.baseVal;
  const toRoot = svg.getScreenCTM().inverse();
  const matrixOf = (el) => toRoot.multiply(el.getScreenCTM());
  const map = (m, x, y) => ({ x: m.a * x + m.c * y + m.e - vb.x, y: m.b * x + m.d * y + m.f - vb.y });
  const visible = (el) => !el.closest('defs') && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  const boxOf = (el) => {
    let b;
    try { b = el.getBBox(); } catch (e) { return null; }
    if (!b || (b.width === 0 && b.height === 0)) return null;
    const m = matrixOf(el);
    const corners = [map(m, b.x, b.y), map(m, b.x + b.width, b.y), map(m, b.x, b.y + b.height), map(m, b.x + b.width, b.y + b.height)];
    const xs = corners.map((p) => p.x), ys = corners.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  };
  const union = (a, b) => {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
  };

  const nodeBoxes = new Map();
  const addNode = (id, el) => {
    if (!visible(el)) return;
    const b = boxOf(el);
    if (b) nodeBoxes.set(id, nodeBoxes.has(id) ? union(nodeBoxes.get(id), b) : b);
  };
  svg.querySelectorAll('[data-layout-bounds-id]').forEach((el) => addNode(el.getAttribute('data-layout-bounds-id'), el));
  svg.querySelectorAll('rect.uml-component-box[data-layout-id]').forEach((el) => addNode(el.getAttribute('data-layout-id'), el));
  svg.querySelectorAll('.uml-note-box').forEach((el, i) => addNode(`note:${i}`, el));
  svg.querySelectorAll('.uml-callout-box').forEach((el, i) => addNode(`callout:${i}`, el));
  const nodes = [...nodeBoxes].map(([id, box]) => ({ id, box }));
  const inside = (outer, inner) => inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 && inner.y + inner.height <= outer.y + outer.height + 0.5;
  nodes.forEach((n) => { n.container = nodes.some((o) => o !== n && inside(n.box, o.box) && !inside(o.box, n.box)); });

  const routes = [];
  svg.querySelectorAll('polyline[data-layout-route-id], line[data-layout-route-id]').forEach((el) => {
    if (el.getAttribute('data-layout-route-decorative') === 'true' || !visible(el)) return;
    const m = matrixOf(el);
    const raw = el.tagName === 'line'
      ? [[el.x1.baseVal.value, el.y1.baseVal.value], [el.x2.baseVal.value, el.y2.baseVal.value]]
      : [...el.points].map((p) => [p.x, p.y]);
    routes.push({ id: el.getAttribute('data-layout-route-id'), source: el.getAttribute('data-layout-source'),
      target: el.getAttribute('data-layout-target'), points: raw.map(([x, y]) => map(m, x, y)) });
  });

  let smallestFont = Infinity;
  const texts = [];
  svg.querySelectorAll('text, tspan').forEach((el) => {
    if (!visible(el) || !el.textContent.trim()) return;
    const m = matrixOf(el);
    const font = parseFloat(getComputedStyle(el).fontSize) * Math.hypot(m.c, m.d);
    if (font > 0) smallestFont = Math.min(smallestFont, font);
    if (el.tagName !== 'text') return;
    const box = boxOf(el);
    // A component edge label sits in a group `label:<route id>`.
    const labelGroup = el.closest('g[data-layout-id^="label:"]');
    const route = el.getAttribute('data-layout-route-id') || (labelGroup ? labelGroup.getAttribute('data-layout-id').slice('label:'.length) : null);
    if (box) texts.push({ text: el.textContent.trim().slice(0, 40), box, route, font });
  });

  return {
    ms, width: vb.width, height: vb.height, smallestFont: isFinite(smallestFont) ? smallestFont : null,
    nodes, routes, texts, markup: container.innerHTML,
  };
}

async function openRenderer(browser, bundle) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><title>ArchUML layout benchmark</title></head><body style="margin:0;background:#fff"></body></html>');
  await page.addStyleTag({ path: path.join(ROOT, 'js', 'ArchUML', 'css', 'callouts.css') });
  await page.addScriptTag({ path: path.resolve(bundle) });
  const paneDirective = await page.evaluate(() => {
    const parsed = window.UMLShared && window.UMLShared.parseLayoutDirective && window.UMLShared.parseLayoutDirective('layout compact 600x700');
    return Boolean(parsed && parsed.pane);
  });
  return { page, paneDirective };
}

async function renderOnce(page, args) {
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve({ error: 'timeout' }), RENDER_TIMEOUT_MS); });
  const job = page.evaluate(renderAndMeasure, args).catch((e) => ({ error: 'evaluate failed: ' + String(e.message || e).slice(0, 200) }));
  const out = await Promise.race([job, timeout]);
  clearTimeout(timer);
  return out;
}

async function benchmarkBundle(browser, bundle, corpus, log) {
  let renderer = await openRenderer(browser, bundle);
  const records = [];
  for (const spec of corpus) {
    for (const variant of VARIANTS) {
      const raw = await renderOnce(renderer.page, {
        renderer: RENDERERS[spec.type], text: variantText(spec.text, variant, renderer.paneDirective), pane: PANES[variant.pane],
      });
      const base = { id: spec.id, type: spec.type, file: `${spec.file} ${spec.where}`, variant: variant.name };
      records.push(raw.error ? { ...base, ms: raw.ms, error: raw.error } : { ...base, ms: raw.ms, markup: raw.markup, ...judge(raw) });
      if (raw.error && /timeout|evaluate failed/.test(raw.error)) {
        await renderer.page.close().catch(() => {});
        renderer = await openRenderer(browser, bundle);
      }
    }
    log(`${path.basename(bundle)}: ${spec.id}`);
  }
  await renderer.page.close();
  return records;
}

// ───── Command line ──────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (['bundle', 'compare', 'json', 'types'].includes(key)) args[key] = argv[++i];
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!args.bundle) throw new Error('usage: node scripts/uml-layout-benchmark.js --bundle <path> [--compare <oldBundle>] [--json <out>] [--types class,sequence]');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { chromium } = require('playwright');
  const types = args.types ? args.types.split(',') : Object.keys(RENDERERS);
  const corpus = buildCorpus(readSources(ROOT)).filter((s) => types.includes(s.type));
  const browser = await chromium.launch();
  const log = (line) => process.stderr.write(line + '\n');
  try {
    const fresh = await benchmarkBundle(browser, args.bundle, corpus, log);
    const old = args.compare ? await benchmarkBundle(browser, args.compare, corpus, log) : null;
    if (args.json) {
      const strip = (records) => records && records.map(({ markup, ...rest }) => rest);
      fs.writeFileSync(args.json, JSON.stringify({ corpus, new: strip(fresh), old: strip(old) }, null, 1));
    }
    process.stdout.write(report(corpus, fresh, old) + '\n');
  } finally {
    await browser.close();
  }
}

module.exports = {
  decodeEntities, isSelfContained, specsFromPreCode, specsFromFences, specsFromDataAttributes,
  specsFromMarkdown, specsFromNarration, buildCorpus, readSources, withLayoutPreference, variantText,
  mergeCollinear, bendCount, properCross, crossingCount, lengthInBox, lineThroughBox, boxesOverlap,
  containsBox, boxToLineDistance, labelPx, judge, percentile, median, report, benchmarkBundle, renderAndMeasure, VARIANTS, PANES,
};

if (require.main === module) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}
