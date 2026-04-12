#!/usr/bin/env node
/**
 * uml_render.js — Render a UML diagram from stdin to an SVG file.
 *
 * Usage:
 *   echo "<spec>" | node uml_render.js <type> <output.svg>
 *   cat diagram.txt | node uml_render.js class out.svg
 *
 * Types: class, sequence, state, component, deployment, usecase, activity
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const VALID_TYPES = ['class', 'sequence', 'state', 'component', 'deployment', 'usecase', 'activity'];
const BUNDLE_PATH = path.join(__dirname, '../js/uml-bundle.js');

function usage() {
  console.error(`Usage: <spec on stdin> | node uml_render.js <type> <output.svg>
Types: ${VALID_TYPES.join(', ')}`);
  process.exit(1);
}

async function main() {
  const [type, outFile] = process.argv.slice(2);

  if (!type || !outFile) usage();
  if (!VALID_TYPES.includes(type)) {
    console.error(`Unknown diagram type "${type}". Valid types: ${VALID_TYPES.join(', ')}`);
    process.exit(1);
  }

  // Read spec from stdin
  const spec = fs.readFileSync('/dev/stdin', 'utf8').trim();
  if (!spec) {
    console.error('Error: No UML spec provided on stdin.');
    process.exit(1);
  }

  const bundleJs = fs.readFileSync(BUNDLE_PATH, 'utf8');
  const html = `<html><head><script>${bundleJs}</script></head><body><div id="c"></div></body></html>`;

  const browser = await chromium.launch();
  const page    = await browser.newPage(); page.on("console", msg => console.log(msg.text()));
  await page.setContent(html);

  const result = await page.evaluate(async ({ type, spec }) => {
    const RENDERERS = {
      class:      window.UMLClassDiagram,
      sequence:   window.UMLSequenceDiagram,
      state:      window.UMLStateDiagram,
      component:  window.UMLComponentDiagram,
      deployment: window.UMLDeploymentDiagram,
      usecase:    window.UMLUseCaseDiagram,
      activity:   window.UMLActivityDiagram,
    };
    const R = RENDERERS[type];
    if (!R) return { error: 'Unknown renderer: ' + type };
    const container = document.getElementById('c');
    R.render(container, spec);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const svgEl = container.querySelector('svg');
    if (!svgEl) return { error: 'Renderer produced no SVG' };
    return { svg: svgEl.outerHTML };
  }, { type, spec });

  await browser.close();

  if (result.error) {
    console.error('Render error:', result.error);
    process.exit(1);
  }

  const absOut = path.resolve(outFile);
  fs.writeFileSync(absOut, result.svg, 'utf8');
  console.log(`Saved ${type} diagram to ${absOut}`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
