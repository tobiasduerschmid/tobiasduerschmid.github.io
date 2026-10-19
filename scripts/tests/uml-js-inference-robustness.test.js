'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

require('../../js/uml-analyzer-js.js');

// Exercise the real parser already shipped with the site's editor, without
// downloading a compiler or substituting a hand-built AST.
const compilerContext = vm.createContext({
  console,
  define(_name, _dependencies, factory) { factory(() => {}); }
});
vm.runInContext(fs.readFileSync(path.join(__dirname,
  '../../js/vendor/monaco-editor/0.44.0/min/vs/language/typescript/tsWorker.js'), 'utf8'),
compilerContext);
const compiler = compilerContext.ts;

function analyze(source, extension = 'ts') {
  const result = global.analyzeJSSources({ [`example.${extension}`]: source }, compiler);
  assert.deepEqual(result.errors, []);
  return result.sequenceDiagram;
}

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
