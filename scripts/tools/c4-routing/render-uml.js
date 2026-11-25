#!/usr/bin/env node
// Renders ArchUML component or deployment specs to SVG and PNG with Playwright and prints rough route metrics
// (proper crossings, bends per route, render time). This is the diagnosis tool the routing redesign used to study
// the UML component engine (routing redesign §1–§2, docs/superpowers/specs/2026-11-09-c4-routing-redesign.md); the
// specs it was run on are scripts/tests/fixtures/c4-routing/specs/*.puml. It gates nothing.
//
// Usage: node scripts/tools/c4-routing/render-uml.js <outDir> <type>:<spec.puml> ...
//   type is component or deployment; outDir receives <spec>.svg and <spec>.png (keep it outside the repository).
//   BUNDLE=<path> renders with another uml-bundle.js (for example an A/B snapshot's).
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../../chromium-launch-options');

const REPO = path.resolve(__dirname, '../../..');
const BUNDLE = process.env.BUNDLE || path.join(REPO, 'js/ArchUML/uml-bundle.js');
const WIDTH = 1200; // a fixed container width: the component and deployment layouts read the container's aspect
const RENDERERS = { component: 'UMLComponentDiagram', deployment: 'UMLDeploymentDiagram' };

/** In the page: renders one spec and measures its routes. */
function renderAndMeasure({ rendererName, spec }) {
  const container = document.getElementById('c');
  container.replaceChildren();
  const started = performance.now();
  window[rendererName].render(container, spec);
  const ms = performance.now() - started;
  const svg = container.querySelector('svg');
  const routes = [...svg.querySelectorAll('polyline[data-layout-route-id], polyline.uml-component-connector, path[data-layout-route-id]')]
    .map((line) => (line.getAttribute('points') || '').trim().split(/\s+/).map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return { x, y };
    }))
    .filter((points) => points.length >= 2 && points.every((point) => Number.isFinite(point.x)));
  const segments = (points) => points.slice(1).map((point, index) => [points[index], point]);
  let crossings = 0;
  routes.forEach((first, a) => routes.slice(a + 1).forEach((second) => {
    segments(first).forEach(([p, q]) => segments(second).forEach(([r, s]) => {
      const firstHorizontal = Math.abs(p.y - q.y) < 1;
      const secondHorizontal = Math.abs(r.y - s.y) < 1;
      if (firstHorizontal === secondHorizontal) return;
      const [h0, h1, v0, v1] = firstHorizontal ? [p, q, r, s] : [r, s, p, q];
      const x = v0.x;
      const y = h0.y;
      if (x > Math.min(h0.x, h1.x) + 2 && x < Math.max(h0.x, h1.x) - 2 && y > Math.min(v0.y, v1.y) + 2 && y < Math.max(v0.y, v1.y) - 2) crossings++;
    }));
  }));
  return { ms: Math.round(ms), svg: svg.outerHTML, routes: routes.length, crossings, bends: routes.map((points) => points.length - 2), viewBox: svg.getAttribute('viewBox') };
}

async function main() {
  const [outDirArg, ...jobsArgs] = process.argv.slice(2);
  if (!outDirArg || !jobsArgs.length) {
    console.error('usage: render-uml.js <outDir> <component|deployment>:<spec.puml> ...');
    process.exit(64);
  }
  const outDir = path.resolve(outDirArg);
  fs.mkdirSync(outDir, { recursive: true });
  const jobs = jobsArgs.map((arg) => {
    const [type, file] = arg.split(/:(.*)/s);
    if (!RENDERERS[type]) throw new Error(`unknown type ${type} in ${arg}`);
    return { type, file, spec: fs.readFileSync(file, 'utf8') };
  });
  const bundle = fs.readFileSync(BUNDLE, 'utf8');
  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH + 40, height: 900 }, deviceScaleFactor: 2 });
    page.on('console', (message) => { if (message.type() === 'error') console.error('console:', message.text()); });
    await page.setContent(`<!doctype html><html lang="en"><head><title>UML</title><script>${bundle}</script></head><body><div id="c"></div></body></html>`);
    await page.addStyleTag({ content: `body{margin:0;background:#fff;font-family:system-ui}#c{width:${WIDTH}px;padding:16px}` });
    for (const job of jobs) {
      const result = await page.evaluate(renderAndMeasure, { rendererName: RENDERERS[job.type], spec: job.spec });
      const base = path.basename(job.file).replace(/\.puml$/, '');
      fs.writeFileSync(path.join(outDir, `${base}.svg`), result.svg);
      await page.locator('#c svg').screenshot({ path: path.join(outDir, `${base}.png`) });
      console.log(JSON.stringify({
        diagram: base, renderMs: result.ms, routes: result.routes, crossings: result.crossings,
        bendsPerRoute: result.bends, totalBends: result.bends.reduce((a, b) => a + b, 0), viewBox: result.viewBox,
      }));
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
