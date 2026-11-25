'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const context = { window: {}, setInterval() {}, clearInterval() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/uml-auto-describe.js'), 'utf8'), context);
const descriptions = context.window.UMLAutoDescribe;

// The live example under "Display Names, Keywords & Layout Direction" in js/ArchUML/REFERENCE.md.
const REFERENCE_EXAMPLE = [
  '@startuml',
  'layout vertical',
  'component "Planner Web App" as web <<Container: TypeScript, React>> {',
  '  require "Enrollment API" as web_enroll',
  '}',
  'component "Registration API" as api <<Container: Python, FastAPI>> {',
  '  provide "Enrollment API" as api_enroll',
  '}',
  'api_enroll --> web_enroll : POST /v1/enrollments',
  '@enduml',
].join('\n');

test('component text alternatives name aliased components by their display names, with their interfaces and connector', () => {
  const summary = descriptions.describe('component', REFERENCE_EXAMPLE);
  assert.match(summary, /^UML component diagram with 2 components \(Planner Web App, a Container: TypeScript, React; Registration API, a Container: Python, FastAPI\)\./);
  assert.match(summary, /Planner Web App requires Enrollment API\./);
  assert.match(summary, /Registration API provides Enrollment API\./);
  assert.match(summary, /Connections: Registration API connects to Planner Web App labeled "POST \/v1\/enrollments"\./);
  assert.doesNotMatch(summary, /\b(web|api|web_enroll|api_enroll)\b/, 'aliases are identifiers, not names on the drawing');
});

test('component detailed descriptions list each display name with its keyword and interfaces', () => {
  const verbose = descriptions.describeVerbose('component', REFERENCE_EXAMPLE);
  assert.deepEqual(JSON.parse(JSON.stringify(verbose.sections)), [
    { heading: 'Components', items: [
      'Planner Web App, a Container: TypeScript, React — requires Enrollment API',
      'Registration API, a Container: Python, FastAPI — provides Enrollment API',
    ] },
    { heading: 'Connections', items: ['Registration API connects to Planner Web App labeled "POST /v1/enrollments"'] },
  ]);
});

test('component descriptions read bracketed names, unaliased quoted names, and inline port blocks', () => {
  const source = [
    'component [Billing System] as bill { provide "Tuition Charges" as charges }',
    'component "Planner Web App" {',
    '  require "Tuition Charges" as needs_charges',
    '}',
    'charges --> needs_charges',
  ].join('\n');
  const summary = descriptions.describe('component', source);
  assert.match(summary, /2 components \(Billing System, Planner Web App\)/);
  assert.match(summary, /Billing System provides Tuition Charges\. Planner Web App requires Tuition Charges\./);
  assert.match(summary, /Billing System connects to Planner Web App\./);
});

test('only a whole block line that starts with a port keyword declares a port', () => {
  const source = [
    'component Billing {',
    '  provide "Tuition Charges" as charges',
    '  note: callers require a session',
    '  this line will provide nothing',
    '}',
  ].join('\n');
  const verbose = descriptions.describeVerbose('component', source);
  assert.deepEqual(JSON.parse(JSON.stringify(verbose.sections)), [
    { heading: 'Components', items: ['Billing — provides Tuition Charges'] },
  ]);
});

// A block line is a port as the bundle's parsePortLine reads it: `port` declares one with no direction, and a
// trailing `dashed` in any case is the port's line style, not part of its name (unless it is the whole name).
test('a block port line may use the plain port keyword and end with dashed in any case', () => {
  const source = [
    'component Billing {',
    '  port "Audit Log" as audit',
    '  provide "Tuition Charges" as charges DASHED',
    '  portout Receipts Dashed',
    '  port dashed',
    '}',
  ].join('\n');
  const verbose = descriptions.describeVerbose('component', source);
  assert.deepEqual(JSON.parse(JSON.stringify(verbose.sections)), [
    { heading: 'Components', items: ['Billing — provides Tuition Charges; outgoing ports Receipts; ports Audit Log, dashed'] },
  ]);
});

// The describer reads the bundle's grammar, so its component list must be the boxes the bundle draws: a stereotype
// glued to a bare name (`Billing<<Service>>`, no space before `<<`) is a stereotype, and a connector end that names no
// declared component draws a box of its own.
test('component descriptions name the boxes the bundle draws, a glued stereotype and a connector-declared box included', async () => {
  const { chromium } = require('playwright');
  const { chromiumLaunchOptions } = require('../chromium-launch-options');
  const source = [
    '@startuml',
    'component Billing<<Service>> {',
    '  provide "Tuition Charges" as charges',
    '}',
    'component "Planner Web App" as web <<Container>>',
    'web --> Ledger',
    'web ..> charges',
    '@enduml',
  ].join('\n');
  const browser = await chromium.launch(chromiumLaunchOptions());
  let drawn;
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html lang="en"><title>Component boxes</title><body></body></html>');
    await page.addScriptTag({ path: path.join(__dirname, '../../js/ArchUML/uml-bundle.js') });
    // Each box's text carries the box's id; a port's elements carry `box.port`. A box's bold text is its name.
    drawn = await page.evaluate((spec) => {
      const container = document.body.appendChild(document.createElement('div'));
      window.UMLComponentDiagram.render(container, spec);
      const names = new Map();
      for (const text of container.querySelectorAll('svg text[data-layout-id][font-weight="bold"]')) {
        const id = text.getAttribute('data-layout-id');
        if (!id.includes('.') && !names.has(id)) names.set(id, text.textContent);
      }
      return [...names.values()];
    }, source);
  } finally {
    await browser.close();
  }
  // The describer runs in its own context; JSON gives its arrays this context's prototypes.
  const sections = JSON.parse(JSON.stringify(descriptions.describeVerbose('component', source).sections));
  const described = sections.find((section) => section.heading === 'Components').items.map((item) => item.split(/ — |, (?:an? |with stereotypes )/)[0]);
  assert.deepEqual(drawn, ['Billing', 'Planner Web App', 'Ledger'], 'precondition: the bundle draws these boxes');
  assert.deepEqual(described, drawn);
});
