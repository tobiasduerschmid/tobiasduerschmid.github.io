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

    expect(sequence).toContain('participant Main as : App');
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

test('the Java compiler refines an unresolved sequence call to the overload chosen for a variable', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/robots.txt');
  await page.addScriptTag({ url: '/js/uml-live.js' });
  const diagrams = await page.evaluate(async () => {
    const { JavaWorkspace } = await import('/js/java/workspace.mjs');
    const workspace = new JavaWorkspace();
    const uml = window.UMLLive.createClient();
    const sources = {
      'App.java': 'class App { public static void main(String[] args) { Picker p = new Picker(); int n = 3; p.pick(n); } }',
      'Picker.java': 'class Picker { int pick(int n) { useNumber(); return n; } String pick(String text) { useText(); return text; } void useText() {} void useNumber() {} }'
    };
    try {
      const preview = await uml.analyze({ language: 'java', sources });
      const { bindings } = await workspace.analyze({ files: sources });
      const resolved = await uml.analyze({ language: 'java', sources, options: { javaBindings: bindings } });
      return { preview: preview.sequenceDiagram, resolved: resolved.sequenceDiagram };
    } finally {
      uml.dispose();
      workspace.destroy();
    }
  });

  expect(diagrams.preview).toContain('p: pick(n)');
  expect(diagrams.preview).not.toMatch(/: useNumber\(\)|: useText\(\)|p --> Main:/);
  expect(diagrams.resolved).toContain('p -> p: useNumber()');
  expect(diagrams.resolved).toContain('p --> Main: int');
  expect(diagrams.resolved).not.toContain(': useText()');
});
