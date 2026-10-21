'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const compiler = require('../../js/vendor/typescript/5.9.3/typescript.min.js');
require('../../js/uml-analyzer-js.js');

function analyze(sources) {
  const result = global.analyzeJSSources(typeof sources === 'string' ? { 'model.ts': sources } : sources, compiler);
  assert.deepEqual(result.errors, []);
  return result;
}

test('TypeScript follows typed constructor arguments into fields and unannotated returns', () => {
  const { classDiagram } = analyze(`class Student {
    private _name;
    constructor(name: string) { const supplied = name; this._name = supplied; }
    displayName() { return this._name; }
    formatted() { return this.displayName().trim().toUpperCase(); }
    words() { return this._name.split(' '); }
  }`);
  assert.match(classDiagram, /-_name: string$/m);
  assert.match(classDiagram, /\+displayName\(\): string$/m);
  assert.match(classDiagram, /\+formatted\(\): string$/m);
  assert.match(classDiagram, /\+words\(\): string\[\]$/m);
});

test('TypeScript retains resolved unions and possibly uninitialized constructor fields', () => {
  const { classDiagram } = analyze(`class Choice {
    value;
    conditional;
    constructor(value: string | null, ready: boolean) {
      this.value = value;
      if (ready) this.conditional = value;
    }
    read() { return this.value; }
    readConditional() { return this.conditional; }
    choose(flag: boolean) { return flag ? 'yes' : 2; }
  }`);
  assert.match(classDiagram, /\+value: string \| null$/m);
  assert.match(classDiagram, /\+conditional: string \| null \| undefined$/m);
  assert.match(classDiagram, /\+read\(\): string \| null$/m);
  assert.match(classDiagram, /\+readConditional\(\): string \| null \| undefined$/m);
  assert.match(classDiagram, /\+choose\(flag: boolean\): "yes" \| 2$/m);
});

test('TypeScript omits complete and partial unknowns without dropping known nominal identities', () => {
  const { classDiagram } = analyze(`class Known { untyped; }
  class Ambiguous {
    value;
    constructor(value: any) { this.value = value; }
    read() { return this.value; }
    unknown(value: unknown) { return value; }
    array(value: any) { return [value]; }
    object(value: unknown) { return { nested: { value } }; }
    promise(value: any) { return Promise.resolve(value); }
    known() { return new Known(); }
  }`);
  for (const member of ['value', 'read()', 'unknown(value: unknown)', 'array(value: any)', 'object(value: unknown)', 'promise(value: any)']) {
    assert.ok(classDiagram.split('\n').includes('  +' + member), `Unresolved type should be omitted for ${member}:\n${classDiagram}`);
  }
  assert.match(classDiagram, /\+known\(\): Known$/m);
});

test('TypeScript preserves authored field and return annotations', () => {
  const { classDiagram } = analyze(`class Declared {
    value: unknown = 'known';
    dynamic: any = 1;
    read(): unknown { return 'known'; }
    dynamicRead(): any { return 1; }
  }`);
  assert.match(classDiagram, /\+value: unknown$/m);
  assert.match(classDiagram, /\+dynamic: any$/m);
  assert.match(classDiagram, /\+read\(\): unknown$/m);
  assert.match(classDiagram, /\+dynamicRead\(\): any$/m);
});

test('TypeScript omits unresolved callable and constructor signatures', () => {
  const { classDiagram } = analyze(`class Factory {
    private factory;
    constructor(factory: new () => unknown) { this.factory = factory; }
    read() { return this.factory; }
    callback() { return (value: unknown) => value; }
  }`);
  assert.match(classDiagram, /-factory$/m);
  assert.match(classDiagram, /\+read\(\)$/m);
  assert.match(classDiagram, /\+callback\(\)$/m);
});

test('TypeScript infers collections, asynchronous results, and parameter properties from standard declarations', () => {
  const { classDiagram } = analyze(`class Names {
    names = ['Ada'];
    constructor(public prefix = 'Dr.') {}
    first() { return this.names.map(name => name.toUpperCase())[0]; }
    async all() { return this.names; }
    pair() { const pair: [string, number] = ['Ada', 1]; return pair; }
    fixedPair() { return ['Ada', 1] as const; }
  }`);
  assert.match(classDiagram, /\+names: string\[\]$/m);
  assert.match(classDiagram, /\+prefix: string$/m);
  assert.match(classDiagram, /\+first\(\): string$/m);
  assert.match(classDiagram, /\+all\(\): Promise<string\[\]>$/m);
  assert.match(classDiagram, /\+pair\(\): \[string, number\]$/m);
  assert.match(classDiagram, /\+fixedPair\(\): readonly \["Ada", 1\]$/m);
});

test('TypeScript imported helper return types retain distinct canonical class identities', () => {
  const { classDiagram } = analyze({
    'sales/item.ts': 'export class Item { salesCode: string; } export function make() { return new Item(); }',
    'stock/item.ts': 'export class Item { stockCode: string; } export function make() { return new Item(); }',
    'order.ts': `import { make as sales } from './sales/item'; import { make as stock } from './stock/item';
      class Order { sales() { return sales(); } stock() { return stock(); } }`
  });
  assert.match(classDiagram, /\+sales\(\): sales_item_Item$/m);
  assert.match(classDiagram, /\+stock\(\): stock_item_Item$/m);
});

test('TypeScript does not invent field types from an ordinary initializer method', () => {
  const { classDiagram } = analyze(`class Later {
    name;
    initialize(name: string) { this.name = name; }
    read() { return this.name; }
  }`);
  assert.match(classDiagram, /\+name$/m);
  assert.match(classDiagram, /\+read\(\)$/m);
});

test('TypeScript omits unresolved generic returns but preserves declared generic contracts', () => {
  const { classDiagram } = analyze(`class Box<T> {
    constructor(private value: T) {}
    inferred() { return this.value; }
    declared(): T { return this.value; }
  }`);
  assert.match(classDiagram, /\+inferred\(\)$/m);
  assert.match(classDiagram, /\+declared\(\): T$/m);
});

test('TypeScript source updates and removed imports cannot reuse previous inferred types', () => {
  const source = `import { value } from './helper'; class Example { read() { return value(); } }`;
  const first = analyze({ 'model.ts': source, 'helper.ts': `export function value() { return 'text'; }` });
  const second = analyze({ 'model.ts': source, 'helper.ts': 'export function value() { return 42; }' });
  const removed = analyze({ 'model.ts': source });
  assert.match(first.classDiagram, /\+read\(\): string$/m);
  assert.match(second.classDiagram, /\+read\(\): number$/m);
  assert.match(removed.classDiagram, /\+read\(\)$/m);
});

test('TypeScript type enrichment preserves relationships and sequence calls', () => {
  const source = `class Part { label() { return 'part'; } }
    class Whole {
      part = new Part();
      read() { return this.part.label(); }
    }
    const whole = new Whole(); whole.read();`;
  const inferred = analyze(source);
  const declared = analyze(source.replace('label()', 'label(): string').replace('read()', 'read(): string'));
  const relationships = diagram => diagram.split('\n').filter(line => / --> | \.\.> | --\|> /.test(line));
  const interactions = diagram => diagram.split('\n').filter(line => /^(participant |actor |activate |deactivate )| -> /.test(line));
  assert.deepEqual(relationships(inferred.classDiagram), relationships(declared.classDiagram));
  // Explicit source return annotations still control sequence reply labels.
  // Class type enrichment must preserve the original participants and calls.
  assert.deepEqual(interactions(inferred.sequenceDiagram), interactions(declared.sequenceDiagram));
});
