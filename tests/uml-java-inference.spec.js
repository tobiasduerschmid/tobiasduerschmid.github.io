// @ts-check

const { test, expect } = require('@playwright/test');
const { analyzeJavaSources } = require('../js/uml-analyzer-java.js');

function inferSequence(code) {
  return analyzeJavaSources({ 'App.java': code }).sequenceDiagram;
}

test.describe('Java sequence diagram execution specifications', () => {
  test('main-method calls follow bare self-calls around loop fragments', () => {
    const code = [
      'class Worker {',
      '  void prepare() {}',
      '  void process() {}',
      '  void finish() {}',
      '  void run() {',
      '    prepare();',
      '    for (String item : new String[] {}) {',
      '      process();',
      '    }',
      '    finish();',
      '  }',
      '}',
      'class App {',
      '  public static void main(String[] args) {',
      '    Worker w = new Worker();',
      '    w.run();',
      '  }',
      '}',
    ].join('\n');

    const sequence = inferSequence(code);
    const mainActivateIdx = sequence.indexOf('activate Main');
    const createIdx = sequence.indexOf('Main --> w: <<create>>');
    const runIdx = sequence.indexOf('Main -> w: run()');
    const runActivateIdx = sequence.indexOf('activate w', runIdx);
    const prepareIdx = sequence.indexOf('w -> w: prepare()', runActivateIdx);
    const prepareDeactivateIdx = sequence.indexOf('deactivate w', prepareIdx);
    const loopIdx = sequence.indexOf('loop [for (String item : new String [ ] { })]');
    const processIdx = sequence.indexOf('w -> w: process()', loopIdx);
    const processDeactivateIdx = sequence.indexOf('deactivate w', processIdx);
    const loopEndIdx = sequence.indexOf('end', processDeactivateIdx);
    const finishIdx = sequence.indexOf('w -> w: finish()', loopEndIdx);
    const finishDeactivateIdx = sequence.indexOf('deactivate w', finishIdx);
    const runDeactivateIdx = sequence.indexOf('deactivate w', finishDeactivateIdx + 1);
    const mainDeactivateIdx = sequence.indexOf('deactivate Main', runDeactivateIdx);

    expect(sequence).toContain('participant Main as : Main');
    expect(mainActivateIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(mainActivateIdx);
    expect(runActivateIdx).toBeGreaterThan(runIdx);
    expect(prepareDeactivateIdx).toBeGreaterThan(prepareIdx);
    expect(prepareDeactivateIdx).toBeLessThan(loopIdx);
    expect(processIdx).toBeGreaterThan(loopIdx);
    expect(processDeactivateIdx).toBeGreaterThan(processIdx);
    expect(processDeactivateIdx).toBeLessThan(loopEndIdx);
    expect(finishIdx).toBeGreaterThan(loopEndIdx);
    expect(finishDeactivateIdx).toBeGreaterThan(finishIdx);
    expect(runDeactivateIdx).toBeGreaterThan(finishDeactivateIdx);
    expect(mainDeactivateIdx).toBeGreaterThan(runDeactivateIdx);
  });
});
