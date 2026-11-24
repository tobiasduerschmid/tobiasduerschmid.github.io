#!/usr/bin/env node
// Records the seed of every placement test graph (routing redesign Task 8b-2 Step 1,
// docs/superpowers/specs/2026-11-09-c4-routing-redesign.md §4.2): loads the working tree's bundle and C4 scripts in
// Chromium, calls ArchUMLC4Render.seedPositions(graph) for every graph of js/ArchUML/tests/c4/place-graphs.js, and
// writes js/ArchUML/tests/c4/fixtures/place-seeds.json, which the Node placement tests (place.test.js) read because
// the seed needs the browser's text measurement. Run it after changing a graph or the seed.
//
// Usage: node scripts/tools/c4-routing/record-place-seeds.js
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../../chromium-launch-options');

const ARCHUML = path.resolve(__dirname, '../../../js/ArchUML');
const { GRAPHS } = require(path.join(ARCHUML, 'tests/c4/place-graphs.js'));

async function main() {
  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html lang="en"><title>Seeds</title><body></body></html>');
    await page.addScriptTag({ path: path.join(ARCHUML, 'uml-bundle.js') });
    const manifest = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
    for (const file of manifest.core.concat(manifest.render)) await page.addScriptTag({ path: path.join(ARCHUML, file) });
    const graphs = Object.fromEntries(Object.entries(GRAPHS).map(([name, entry]) => [name, entry.graph]));
    const seeds = await page.evaluate((all) => Object.fromEntries(Object.entries(all)
      .map(([name, graph]) => [name, window.ArchUMLC4Render.seedPositions(graph)])), graphs);
    const out = path.join(ARCHUML, 'tests/c4/fixtures/place-seeds.json');
    fs.writeFileSync(out, JSON.stringify(seeds, null, 2) + '\n');
    console.log(`wrote ${Object.keys(seeds).length} seeds to ${out}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
