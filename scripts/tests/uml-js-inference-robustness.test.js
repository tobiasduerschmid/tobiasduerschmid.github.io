'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

require('../../js/uml-analyzer-js.js');

// Use the exact compiler shipped to chapter and tutorial inference workers.
const compiler = require('../../js/vendor/typescript/5.9.3/typescript.min.js');

function analyze(source, extension = 'ts') {
  const result = global.analyzeJSSources({ [`example.${extension}`]: source }, compiler);
  assert.deepEqual(result.errors, []);
  return result.sequenceDiagram;
}

test('TypeScript aliases retain object identity when the original variable is rebound', () => {
  const diagram = analyze(`
    class Sensor { read(): number { return 25; } }
    const indoor = new Sensor();
    const outdoor = new Sensor();
    let selected: Sensor = indoor;
    const saved = (selected as Sensor)!;
    selected = outdoor;
    saved.read();
    selected.read();
  `);
  assert.deepEqual(diagram.split('\n').filter(line => line.includes(' -> ')), [
    'Main -> indoor: read()', 'Main -> outdoor: read()'
  ]);
  assert.equal((diagram.match(/^participant .*: Sensor$/gm) || []).length, 2);
});

test('TypeScript method arguments keep caller identities and callee locals stay scoped', () => {
  const diagram = analyze(`
    class Sensor { read(): number { return 25; } }
    class Reader { read(sensor: Sensor): void { const selected = sensor; selected.read(); } }
    const indoor = new Sensor();
    const outdoor = new Sensor();
    const reader = new Reader();
    const selected = indoor;
    reader.read(outdoor);
    selected.read();
  `);
  assert.deepEqual(diagram.split('\n').filter(line => line.includes(' -> ')), [
    'Main -> reader: read(outdoor)', 'reader -> outdoor: read()', 'Main -> indoor: read()'
  ]);
});

test('TypeScript syntax diagnostics clear after correcting an incomplete edit', () => {
  const broken = global.analyzeJSSources({ 'example.ts': 'class Student { read(value: ) {}' }, compiler);
  assert.ok(broken.errors.some(error => /example\.ts/.test(error)));
  const repaired = global.analyzeJSSources({ 'example.ts': 'class Student { read(value: number): void {} }' }, compiler);
  assert.deepEqual(repaired.errors, []);
  assert.match(repaired.classDiagram, /read\(value: number\)/);
});

test('TypeScript constructor arguments preserve the supplied receiver identity', () => {
  const diagram = analyze(`
    class Sensor { read(): number { return 25; } }
    class Reader {
      constructor(sensor: Sensor) { sensor.read(); }
      run(): void {}
    }
    const indoor = new Sensor();
    const reader = new Reader(indoor);
  `);
  assert.match(diagram, /^reader -> indoor: read\(\)$/m);
  assert.equal((diagram.match(/^participant .*: Sensor$/gm) || []).length, 1);
});

for (const control of [
  'if (condition) { selected = outdoor; selected.read(); } else { selected.read(); }',
  'if (condition) { selected = outdoor; }',
  'while (condition) { selected = outdoor; }',
  'for (const item of items) { selected = outdoor; }',
  'switch (condition) { case true: selected = outdoor; break; default: break; }'
]) {
  test(`TypeScript keeps uncertain receiver identity after ${control}`, () => {
    const diagram = analyze(`
      class Sensor { read(): number { return 25; } }
      const indoor = new Sensor();
      const outdoor = new Sensor();
      let selected = indoor;
      ${control}
      selected.read();
    `);
    const calls = diagram.split('\n').filter(line => line.includes(' -> '));
    assert.match(calls.at(-1), /^Main -> (?!indoor:|outdoor:)[^:]+: read\(\)$/);
    if (control.includes('else { selected.read(); }')) {
      assert.deepEqual(calls.slice(0, 2), ['Main -> outdoor: read()', 'Main -> indoor: read()']);
    }
  });
}

test('TypeScript retains an identity agreed on by both branches', () => {
  const diagram = analyze(`
    class Sensor { read(): number { return 25; } }
    const indoor = new Sensor(); const outdoor = new Sensor();
    let selected = indoor;
    if (condition) { selected = outdoor; } else { selected = outdoor; }
    selected.read();
  `);
  assert.match(diagram, /^Main -> outdoor: read\(\)$/m);
});

test('TypeScript does not execute calls inside an uncalled callback', () => {
  const diagram = analyze(`
    class Sensor { read(): number { return 25; } }
    const sensor = new Sensor();
    const callback = () => sensor.read();
  `);
  assert.doesNotMatch(diagram, /: read\(\)/);
});

test('TypeScript keeps cleanup calls after try/catch alternatives', () => {
  const diagram = analyze(`
    class Job { run(): void {} fail(): void {} close(): void {} }
    const job = new Job();
    try { job.run(); } catch (error) { job.fail(); } finally { job.close(); }
  `);
  assert.deepEqual(diagram.split('\n').filter(line => line.includes(' -> ')), [
    'Main -> job: run()', 'Main -> job: fail()', 'Main -> job: close()'
  ]);
  assert.ok(diagram.indexOf('end\n') < diagram.indexOf('Main -> job: close()'));
});

test('TypeScript block-local aliases do not overwrite outer references', () => {
  const diagram = analyze(`
    class Sensor { read(): number { return 25; } }
    const indoor = new Sensor(); const outdoor = new Sensor();
    const selected = indoor;
    { const selected = outdoor; selected.read(); }
    selected.read();
  `);
  assert.deepEqual(diagram.split('\n').filter(line => line.includes(' -> ')), [
    'Main -> outdoor: read()', 'Main -> indoor: read()'
  ]);
});

test('TypeScript bounds sequence expansion without returning a partial diagram', () => {
  const repeated = method => `this.${method}();`.repeat(20);
  const result = global.analyzeJSSources({ 'example.ts': `
    class Fanout {
      run(): void { ${repeated('middle')} }
      middle(): void { ${repeated('leaf')} }
      leaf(): void { ${repeated('ping')} }
      ping(): void {}
    }
    const fanout = new Fanout(); fanout.run();
  ` }, compiler);
  assert.match(result.classDiagram, /class Fanout/);
  assert.equal(result.sequenceDiagram, '');
  assert.ok(result.errors.some(error => /sequence inference limit/i.test(error)));
  assert.match(analyze('class Reader { read() {} } const reader = new Reader(); reader.read();'), /: read\(\)/);
});

for (const extension of ['js', 'ts']) {
  test(`${extension}: synchronous self-calls stay on the called instance`, () => {
    const diagram = analyze(`
      class Bot {
        log() {}
        send() {}
        handle() { this.log(); this.send(); }
      }
      const bot = new Bot();
      bot.handle();
    `, extension);
    assert.deepEqual(diagram.split('\n').filter(line => line.includes(' -> ')), [
      'Main -> bot: handle()',
      'bot -> bot: log()',
      'bot -> bot: send()'
    ]);
  });
}

test('calls, nested self-calls, and replies distinguish two instances of the same class', () => {
  const diagram = analyze(`
    class Sensor {
      calibrate() {}
      read(): number { this.calibrate(); return 25; }
    }
    const indoor = new Sensor();
    const outdoor = new Sensor();
    const outside = outdoor.read();
    const inside = indoor.read();
  `);
  assert.deepEqual(diagram.split('\n').filter(line => line.includes(' -> ')), [
    'Main -> outdoor: read()',
    'outdoor -> outdoor: calibrate()',
    'Main -> indoor: read()',
    'indoor -> indoor: calibrate()'
  ]);
  assert.match(diagram, /^participant indoor: Sensor$/m);
  assert.match(diagram, /^participant outdoor: Sensor$/m);
  assert.match(diagram, /^outdoor --> Main: number$/m);
  assert.match(diagram, /^indoor --> Main: number$/m);
});

for (const declaration of [true, false]) {
  test(`constructor arguments execute before ${declaration ? 'assigned' : 'standalone'} construction`, () => {
    const diagram = analyze(`
      class Factory { make() { return 5; } }
      class Sensor {
        constructor(value) { this.calibrate(); }
        calibrate() {}
      }
      const factory = new Factory();
      ${declaration ? 'const sensor = ' : ''}new Sensor(factory.make());
    `);
    const sensor = declaration ? 'sensor' : 'Sensor';
    assert.deepEqual(diagram.split('\n').filter(line => / -> | --> /.test(line)), [
      'Main --> factory: <<create>>',
      'Main -> factory: make()',
      `Main --> ${sensor}: <<create>>`,
      `${sensor} -> ${sensor}: calibrate()`
    ]);
  });
}
