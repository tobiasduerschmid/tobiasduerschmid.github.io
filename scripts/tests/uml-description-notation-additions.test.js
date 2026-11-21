'use strict';

// Text alternatives for the notation added to component and class diagrams:
// stereotypes, UML packages, aliased display names, dashed connectors, and
// declarations with inline manual positions. Run through the CLI that the
// static build uses, so the descriptions match what pages ship.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const CLI = path.join(__dirname, '../../js/uml-describe-cli.js');

function describe(type, spec) {
  const run = spawnSync(process.execPath, [CLI], { input: JSON.stringify({ 0: { type, spec } }), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const { brief, verbose } = JSON.parse(run.stdout)[0];
  const section = (heading) => (verbose.sections.find((s) => s.heading === heading) || { items: [] }).items;
  return { brief, section };
}

const HEADLINER = [
  'package Headliner {',
  '  component OPC <<service>> {',
  '    portout "trip events" as opc_pub',
  '  }',
  '  component trips <<topic exchange>> {',
  '    portin "publish" as ex_in',
  '  }',
  '  package Integrations {',
  '    component AffiliateRelay <<service>>',
  '  }',
  '}',
  'component AffiliatePartners <<external>>',
  'component Gateway <<Service, External>>',
  'opc_pub -- ex_in : <<publish>>',
  'AffiliateRelay ..> AffiliatePartners : HTTPS webhook',
].join('\n');

test('component descriptions name each component with its stereotypes', () => {
  const { brief, section } = describe('component', HEADLINER);
  assert.match(brief, /OPC, a service; trips, a topic exchange; AffiliateRelay, a service; AffiliatePartners, an external; Gateway, with stereotypes Service and External\)/);
  assert.deepEqual(section('Components'), [
    'OPC, a service — outgoing ports trip events',
    'trips, a topic exchange — incoming ports publish',
    'AffiliateRelay, a service',
    'AffiliatePartners, an external',
    'Gateway, with stereotypes Service and External',
  ]);
});

test('component descriptions say which components each package contains', () => {
  const { brief, section } = describe('component', HEADLINER);
  assert.match(brief, /In package Headliner: OPC, trips\. In package Integrations \(in package Headliner\): AffiliateRelay\./);
  assert.deepEqual(section('Packages'), ['Headliner: OPC, trips', 'Integrations (in package Headliner): AffiliateRelay']);
});

test('connector stereotypes read as they are drawn', () => {
  const { brief } = describe('component', HEADLINER);
  assert.match(brief, /OPC is associated with trips labeled "«publish»"/);
  assert.match(brief, /AffiliateRelay depends on AffiliatePartners labeled "HTTPS webhook"/);
  const binding = describe('component', 'component Exchange\ncomponent Loyalty\nExchange -- Loyalty : <<subscribe>> {binding = "trip.*"}');
  assert.match(binding.brief, /Exchange is associated with Loyalty labeled "«subscribe» \{binding = "trip\.\*"\}"/);
});

test('ports belong to their components when declarations carry stereotypes or manual positions', () => {
  const spec = [
    'component "Trip Website" as Website <<web application>> @pos(400, 120) {',
    '  portout "orders" as w_out',
    '}',
    'component OPC <<service>> #lightblue @pos(40, 20) {',
    '  portin "orders" as opc_in',
    '}',
    'w_out --> opc_in : HTTPS',
  ].join('\n');
  const { brief, section } = describe('component', spec);
  assert.match(brief, /2 components \(Trip Website, a web application; OPC, a service\)\. Trip Website outgoing ports orders\. OPC incoming ports orders\./);
  assert.match(brief, /Connections: Trip Website connects to OPC labeled "HTTPS"\./);
  assert.deepEqual(section('Connections'), ['Trip Website connects to OPC labeled "HTTPS"']);
});

test('quoted display names resolve to their labels', () => {
  const { brief } = describe('component', 'component "Order DB" as OrderDB\ncomponent Billing\nBilling --> OrderDB : reads');
  assert.match(brief, /2 components \(Order DB, Billing\)/);
  assert.match(brief, /Billing connects to Order DB labeled "reads"/);
});

test('dashed connectors stay in the description', () => {
  const { brief, section } = describe('component', 'component A\ncomponent B\nA --> B dashed : retries');
  assert.match(brief, /Connections: A connects to B \(dashed\) labeled "retries"\./);
  assert.deepEqual(section('Connections'), ['A connects to B (dashed) labeled "retries"']);
});

test('the detailed class description lists stereotyped and positioned classes with their members', () => {
  const spec = [
    'class Order <<Entity>> {',
    '  +id: int',
    '}',
    'class Customer @pos(10, 20) {',
    '  +name: str',
    '}',
    'interface Payable <<boundary>> #lightblue',
    'Customer --> Order',
  ].join('\n');
  const { section } = describe('class', spec);
  assert.deepEqual(section('Classes'), [
    'Order, an Entity — Attributes: public id: int — Operations: none declared',
    'Customer — Attributes: public name: str — Operations: none declared',
  ]);
  assert.deepEqual(section('Interfaces'), ['Payable, a boundary — Attributes: none declared — Operations: none declared']);
});

test('class descriptions say which package each class is in', () => {
  const spec = [
    'package opc::partners {',
    '  class SupplierProvider {',
    '    +place(order)',
    '  }',
    '  class ShuttleProvider',
    '}',
    'abstract class Provider',
    'SupplierProvider --|> Provider',
  ].join('\n');
  const { brief, section } = describe('class', spec);
  assert.match(brief, /^UML class diagram with 2 classes \(SupplierProvider, ShuttleProvider\), 1 abstract class \(Provider\)\. In package opc::partners: SupplierProvider, ShuttleProvider\. SupplierProvider extends Provider\.$/);
  assert.deepEqual(section('Packages'), ['opc::partners: SupplierProvider, ShuttleProvider']);
  assert.deepEqual(section('Classes'), [
    'SupplierProvider — Attributes: none declared — Operations: public place(order)',
    'ShuttleProvider — Attributes: none declared — Operations: none declared',
  ]);
});

test('bracket declarations and bracket connectors read as the renderer reads them', () => {
  const { brief } = describe('component', '[Legacy Module] #lightcoral hatched\n[Active Service]\n[Legacy Module] --> [Active Service]');
  assert.equal(brief, 'UML component diagram with 2 components (Legacy Module, Active Service). Connections: Legacy Module connects to Active Service.');
});

test('classes named like a texture keep their names after a color and texture suffix', () => {
  const { section } = describe('class', 'class Hatched #lightblue hatched\nclass Dotted dotted\nHatched --> Dotted');
  assert.deepEqual(section('Classes'), [
    'Hatched — Attributes: none declared — Operations: none declared',
    'Dotted — Attributes: none declared — Operations: none declared',
  ]);
});

test('descriptions without the new notation keep their wording', () => {
  const component = describe('component', 'component Client\ncomponent Backend {\n  portin "httpIn" as b_in\n}\nClient --> b_in : REST');
  assert.equal(component.brief, 'UML component diagram with 2 components (Client, Backend). Backend incoming ports httpIn. Connections: Client connects to Backend labeled "REST".');
  const cls = describe('class', 'class Team {}\nclass Member {}\nTeam --> Member');
  assert.equal(cls.brief, 'UML class diagram with 2 classes (Team, Member). Team references Member.');
});
