'use strict';

// The render worker hands ArchUML text widths measured on the page. ArchUML
// remembers compact drawings by their inputs, so a render repeated with the
// same spec and widths reuses the drawing, and a render after the page's
// widths changed (a web font finished loading) must draw anew.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const JS = path.join(__dirname, '..', '..', 'js');

/** js/uml-worker.js in a sandbox; render(syntax, measurements) → svg. */
function loadWorker() {
  const replies = [];
  const sandbox = {
    location: { href: 'https://example.test/js/uml-worker.js' },
    URL, console, setTimeout, clearTimeout,
    // The bundle's page-refit timer never needs to fire here.
    setInterval() { return 1; }, clearInterval() {}, addEventListener() {}, removeEventListener() {},
    OffscreenCanvas: class {
      getContext() { return { font: '', measureText: (text) => ({ width: String(text || '').length * 8 }) }; }
    },
    postMessage: (message) => replies.push(message),
    importScripts(url) {
      const file = path.join(JS, new URL(url).pathname.replace(/^\/js\//, ''));
      vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
    },
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(JS, 'uml-worker.js'), 'utf8'), sandbox, { filename: 'uml-worker.js' });
  let id = 0;
  function render(syntax, measurements) {
    sandbox.onmessage({ data: { type: 'renderDiagram', id: ++id, diagramType: 'component', syntax, cssVars: {},
      container: { width: 600, height: 750, clientWidth: 600 }, measurements } });
    const reply = replies.pop();
    assert.equal(reply.ok, true, reply.error);
    return reply.svg;
  }
  return { sandbox, render };
}

const SPEC = `@startuml
layout compact 600x750
component Client
component Server
Client --> Server : request
callout bottom of text "Server" : Server: answers every request
@enduml`;

test('a compact render repeated with the same page widths reuses the drawing', () => {
  const { sandbox, render } = loadWorker();
  const first = render(SPEC, {});
  let searches = 0;
  const optimize = sandbox.UMLCompactLayout.optimize;
  sandbox.UMLCompactLayout.optimize = function () { searches++; return optimize.apply(this, arguments); };
  assert.equal(render(SPEC, {}), first);
  assert.equal(searches, 0);
});

test('a compact render after the page widths changed gives what a fresh render gives', () => {
  const { sandbox, render } = loadWorker();
  const before = render(SPEC, {});
  const { fontFamily, fontSizeBold } = sandbox.UMLShared.BASE_CFG;
  const wider = { [`B|${fontSizeBold}|${fontFamily}|Server`]: 400 };
  const after = render(SPEC, wider);
  assert.notEqual(after, before, 'the widths change the drawing');
  sandbox.UMLCompactMemo.forget();
  assert.equal(after, render(SPEC, wider));
});
