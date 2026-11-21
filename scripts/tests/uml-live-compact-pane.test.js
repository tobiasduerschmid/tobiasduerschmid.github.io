'use strict';

// The live client renders in an off-screen staging element, whose height is
// not the pane's. A bare `layout compact` must therefore reach the renderer
// sized for the element the diagram is shown in; other specs, and the
// staging geometry every layout reads, stay as they were.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function fakeElement(box = {}) {
  return {
    className: '', style: { cssText: '' }, dataset: {}, innerHTML: '',
    classList: { add() {} }, setAttribute() {}, removeAttribute() {}, append() {}, remove() {},
    clientWidth: box.clientWidth || 0, clientHeight: box.clientHeight || 0, padding: box.padding || 0,
    // A styled width is laid out; an off-screen staging copy has no height.
    getBoundingClientRect() { return { width: parseFloat(this.style.width) || box.rectWidth || 0, height: box.rectHeight || 0 }; },
    getComputedTextLength() { return 10; }
  };
}

function loadClient() {
  const workers = [];
  class ControlledWorker {
    constructor() { this.messages = []; workers.push(this); }
    postMessage(message) { this.messages.push(message); }
    terminate() {}
    replyRender() {
      const message = this.messages.shift();
      this.onmessage({ data: { type: 'renderResult', id: message.id, ok: true, svg: '<svg></svg>' } });
      return message;
    }
  }
  const document = {
    currentScript: { src: 'https://example.test/js/uml-live.js' },
    body: { append() {} },
    createElement: () => fakeElement(),
    createElementNS: () => fakeElement()
  };
  const getComputedStyle = element => {
    const padding = `${element.padding || 0}px`;
    return { paddingLeft: padding, paddingRight: padding, paddingTop: padding, paddingBottom: padding,
      maxHeight: element.maxHeight || 'none', boxSizing: element.boxSizing || 'content-box', getPropertyValue: () => '' };
  };
  const window = {
    UMLShared: {
      BASE_CFG: { fontFamily: 'sans-serif', fontSize: 14, fontSizeBold: 14 },
      textWidth: () => 10, prepareDiagramContainer() {}, autoFitSVG() {}, applySvgAccessibility() {}
    },
    UMLSequenceDiagram: { parse: () => ({}), render() {} }
  };
  const context = vm.createContext({ document, getComputedStyle, Worker: ControlledWorker, URL, setTimeout, clearTimeout, window });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/archuml-compact-pane.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/uml-live.js'), 'utf8'), context);
  return { api: context.window.UMLLive, workers };
}

// The tutorial's diagram pane: 640×480 with 10 px padding, so its content
// box is 620×460. The staging copy is laid out off-screen and has no height.
function pane() {
  const target = fakeElement({ clientWidth: 640, clientHeight: 480, padding: 10, rectWidth: 640, rectHeight: 480 });
  target.parentElement = { appendChild() {} };
  return target;
}

async function renderedMessage(syntax) {
  const { api, workers } = loadClient();
  const client = api.createClient();
  try {
    const rendering = client.render({ type: 'sequence', syntax, target: pane() });
    await new Promise(resolve => setImmediate(resolve));
    const message = workers[0].replyRender();
    assert.equal(await rendering, true);
    return message;
  } finally { client.dispose(); }
}

test('a bare compact spec is laid out for the pane content box, not the staging element', async () => {
  const message = await renderedMessage('@startuml\nlayout landscape\nlayout compact\nA -> B: go\n@enduml');
  assert.equal(message.syntax, '@startuml\nlayout landscape\nlayout compact 620x460\nA -> B: go\n@enduml');
});

test('a spec that already names its pane keeps it', async () => {
  const syntax = '@startuml\nlayout compact 900x500\nA -> B: go\n@enduml';
  assert.equal((await renderedMessage(syntax)).syntax, syntax);
});

test('specs without compact, and the staging geometry, reach the worker unchanged', async () => {
  const syntax = '@startuml\nlayout landscape\nA -> B: go\n@enduml';
  const message = await renderedMessage(syntax);
  assert.equal(message.syntax, syntax);
  // The staging element copies the pane width; its height falls back as before.
  assert.deepEqual({ ...message.container }, { width: 640, height: 600, clientWidth: 640 });
});

test('a pane too small to measure leaves compact for ArchUML to resolve', async () => {
  const { api, workers } = loadClient();
  const client = api.createClient();
  try {
    const target = fakeElement({ clientWidth: 640, clientHeight: 20, rectWidth: 640, rectHeight: 20 });
    target.parentElement = { appendChild() {} };
    const syntax = '@startuml\nlayout compact\nA -> B: go\n@enduml';
    const rendering = client.render({ type: 'sequence', syntax, target });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(workers[0].replyRender().syntax, syntax);
    await rendering;
  } finally { client.dispose(); }
});

test('a pane that grows with its drawing up to a maximum is laid out for that maximum', async () => {
  // The chapter lab preview: auto height (currently the last drawing's) up to max-height.
  const { api, workers } = loadClient();
  const client = api.createClient();
  try {
    const target = fakeElement({ clientWidth: 640, clientHeight: 140, padding: 10, rectWidth: 640, rectHeight: 140 });
    target.maxHeight = '600px';
    target.boxSizing = 'border-box';
    target.parentElement = { appendChild() {} };
    const rendering = client.render({ type: 'sequence', syntax: '@startuml\nlayout compact\nA -> B: go\n@enduml', target });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(workers[0].replyRender().syntax, '@startuml\nlayout compact 620x580\nA -> B: go\n@enduml');
    await rendering;
  } finally { client.dispose(); }
});

test('a content-box maximum is already the content height', async () => {
  const { api, workers } = loadClient();
  const client = api.createClient();
  try {
    const target = fakeElement({ clientWidth: 640, clientHeight: 140, padding: 10, rectWidth: 640, rectHeight: 140 });
    target.maxHeight = '600px';
    target.parentElement = { appendChild() {} };
    const rendering = client.render({ type: 'sequence', syntax: '@startuml\nlayout compact\nA -> B: go\n@enduml', target });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(workers[0].replyRender().syntax, '@startuml\nlayout compact 620x600\nA -> B: go\n@enduml');
    await rendering;
  } finally { client.dispose(); }
});
