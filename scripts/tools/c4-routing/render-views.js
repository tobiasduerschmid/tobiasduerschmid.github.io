#!/usr/bin/env node
// Renders the router's gated C4 views (scripts/tests/c4-route-views.js: the §9.3 table, the pinned booking component
// view, and the generated landscapes, `generated seed <n>` and `generated 40 elements`) with a copy of ArchUML to PNG, plain and annotated with the metric findings, and writes the
// metrics of every view as JSON (routing redesign §9, docs/superpowers/specs/2026-11-09-c4-routing-redesign.md).
// The numbers come from the same metrics module the route-quality gates use (scripts/tests/c4-route-metrics.js).
//
// Usage: node scripts/tools/c4-routing/render-views.js <outPrefix> [archumlDir]
//   outPrefix   where the files go, for example /tmp/c4/after- (gives after-<view>.png, after-<view>-annotated.png
//               and after-metrics.json); keep it outside the repository.
//   archumlDir  a folder holding uml-bundle.js, c4/ and vendor/ (default: the working tree's js/ArchUML; an A/B
//               snapshot's <snapshot>/js/ArchUML works too).
//   ONLY=name1,name2 renders only the named views.
//
// Annotations: red circles mark crossings, orange dashed boxes mark labels that are detached (farther than 6 from
// their route) or ambiguous (nearer than 12 to another route), and blue bands mark segments along a boundary line.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../../chromium-launch-options');
const { analyse, sceneOf, meetingPlaces, hugsBoundary, simplify, segmentsOf } = require('../../tests/c4-route-metrics.js');
const { VIEWS, PINNED, GENERATED_VIEWS, LARGE_VIEW, generatedLandscape } = require('../../tests/c4-route-views.js');

const REPO = path.resolve(__dirname, '../../..');
const SVG_PAD = 24;
const TITLE_OFFSET = 26 + 24; // the title line and the gap below it (c4-render.js CFG.lineHeight + CFG.titleGap)

/** The boxes each pair of edges shares as an end: a crossing on their outline does not count. */
function sharedBoxes(scene, first, second) {
  return [first.source, first.target].filter((id) => id === second.source || id === second.target)
    .map((id) => scene.boxes[id] || scene.boundaries[id]).filter(Boolean);
}

/** SVG markup that marks the findings of `m` on the layout, in the drawing's coordinates. */
function overlay(view, layout, m, hasTitle) {
  const dx = SVG_PAD - layout.x;
  const dy = SVG_PAD + (hasTitle ? TITLE_OFFSET : 0) - layout.y;
  const scene = sceneOf(view, layout);
  const routes = layout.edges.map((edge) => edge.points);
  const parts = [];
  scene.edges.forEach((first, a) => scene.edges.forEach((second, b) => {
    if (b <= a) return;
    meetingPlaces(routes[a], routes[b], sharedBoxes(scene, first, second)).crossings.forEach((component) => {
      parts.push(`<circle cx="${component[0].x}" cy="${component[0].y}" r="11" fill="none" stroke="#d00" stroke-width="4"/>`);
    });
  }));
  m.edges.forEach((edge, index) => {
    const box = layout.edges[index].labelBox;
    if (box && (edge.detachedLabel || edge.ambiguousLabel)) {
      parts.push(`<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="none" stroke="#e67700" stroke-width="4" stroke-dasharray="8 4"/>`);
    }
    if (edge.boundaryHugging) {
      segmentsOf(simplify(routes[index])).forEach((segment) => {
        const ends = segment.horizontal
          ? [{ x: segment.lo, y: segment.at }, { x: segment.hi, y: segment.at }]
          : [{ x: segment.at, y: segment.lo }, { x: segment.at, y: segment.hi }];
        if (!Object.values(scene.boundaries).some((boundary) => hugsBoundary(ends, boundary))) return;
        parts.push(`<line x1="${ends[0].x}" y1="${ends[0].y}" x2="${ends[1].x}" y2="${ends[1].y}" stroke="#06c" stroke-width="9" stroke-opacity="0.45"/>`);
      });
    }
  });
  return `<g transform="translate(${dx},${dy})">${parts.join('')}</g>`;
}

async function openPage(browser, archumlDir) {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html lang="en"><title>C4 views</title><body></body></html>');
  await page.addScriptTag({ path: path.join(archumlDir, 'uml-bundle.js') });
  const manifest = JSON.parse(fs.readFileSync(path.join(archumlDir, 'c4/manifest.json'), 'utf8'));
  for (const file of manifest.core.concat(manifest.render)) await page.addScriptTag({ path: path.join(archumlDir, file) });
  return page;
}

/** The projected view, `layoutView`'s result and the drawn SVG of one view. */
function drawView(page, text, selector, pins) {
  return page.evaluate(([source, viewSelector, pinList]) => {
    const C4 = window.ArchUMLC4;
    const projected = C4.project(C4.load(source), viewSelector);
    const options = { pins: new Map(pinList || []) };
    const layout = window.ArchUMLC4Render.layoutView(projected, undefined, options);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { svgText } = window.ArchUMLC4Render.renderView(container, C4.project(C4.load(source), viewSelector), options);
    container.remove();
    return {
      view: {
        title: projected.title,
        direction: projected.direction,
        nodes: projected.nodes.map((node) => ({ id: node.id, name: node.name, type: node.type, boundaryId: node.boundaryId || null })),
        boundaries: projected.boundaries.map((boundary) => ({ id: boundary.id, kind: boundary.kind, parentBoundaryId: boundary.parentBoundaryId || null })),
        edges: projected.edges.map((edge) => ({ id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId })),
      },
      layout,
      svgText,
    };
  }, [text, selector, pins || null]);
}

async function main() {
  const [outPrefixArg, archumlArg] = process.argv.slice(2);
  if (!outPrefixArg) {
    console.error('usage: render-views.js <outPrefix> [archumlDir]');
    process.exit(64);
  }
  const outPrefix = path.resolve(outPrefixArg);
  const archumlDir = path.resolve(archumlArg || path.join(REPO, 'js/ArchUML'));
  fs.mkdirSync(path.dirname(outPrefix), { recursive: true });
  const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
  const generated = GENERATED_VIEWS.map(([seed, size]) => [`generated seed ${seed}`, generatedLandscape(seed, size).text, 'landscape', null])
    .concat([['generated 40 elements', generatedLandscape(LARGE_VIEW.seed, LARGE_VIEW.size).text, 'landscape', null]]);
  const rows = VIEWS.map(([name, text, selector]) => [name, text, selector, null])
    .concat([[PINNED[0], PINNED[1], PINNED[2], PINNED[4].pins]], generated);
  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    const page = await openPage(browser, archumlDir);
    const shot = await browser.newPage({ deviceScaleFactor: 1 });
    const all = {};
    for (const [name, text, selector, pins] of rows) {
      if (only && !only.has(name)) continue;
      const out = await drawView(page, text, selector, pins);
      const m = analyse(out.view, out.layout);
      all[name] = { summary: m.summary, edges: m.edges, layout: out.layout };
      const file = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const width = Number(out.svgText.match(/width="(\d+)"/)[1]);
      const height = Number(out.svgText.match(/height="(\d+)"/)[1]);
      await shot.setViewportSize({ width, height });
      await shot.setContent(`<!doctype html><html lang="en"><title>${file}</title><body style="margin:0;background:#fdfdfd">${out.svgText}</body></html>`);
      await shot.screenshot({ path: `${outPrefix}${file}.png` });
      const annotated = out.svgText.replace(/<\/svg>$/, overlay(out.view, out.layout, m, Boolean(out.view.title)) + '</svg>');
      await shot.setContent(`<!doctype html><html lang="en"><title>${file}</title><body style="margin:0;background:#fdfdfd">${annotated}</body></html>`);
      await shot.screenshot({ path: `${outPrefix}${file}-annotated.png` });
      const { headSides, ...summary } = m.summary;
      console.log(name.padEnd(34), JSON.stringify(summary));
    }
    fs.writeFileSync(`${outPrefix}metrics.json`, JSON.stringify(all, null, 1));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
