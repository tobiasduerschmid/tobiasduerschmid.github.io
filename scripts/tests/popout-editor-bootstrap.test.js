const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../js/popout/shared-editor.js'), 'utf8');

function createDeferredMonacoPopup(kind) {
  const loaderCallbacks = [];
  const editors = [];
  let onMessage;
  const monaco = {
    KeyMod: { CtrlCmd: 1 },
    KeyCode: { KeyS: 2 },
    editor: {
      createModel(content, language) {
        return {
          content, language,
          getValue() { return this.content; },
          setValue(value) { this.content = value; },
          onDidChangeContent() {},
          dispose() {},
        };
      },
      create(_element, options) {
        const editor = {
          options,
          addCommand() {},
          onDidChangeModelContent() {},
          setModel(model) { this.model = model; },
        };
        editors.push(editor);
        return editor;
      },
    },
  };
  const classList = { contains() { return false; }, toggle() {}, add() {} };
  const sandbox = {
    document: { documentElement: { classList }, title: '' },
    require: Object.assign((_modules, callback) => loaderCallbacks.push(callback), { config() {} }),
    SebookPopoutClient: {
      connect({ onMessage: handle }) {
        onMessage = handle;
        return {
          tutorialTitle: 'Tutorial', channel: {},
          markConnected() {}, post() {}, setStatus() {}, flashStatus() {},
        };
      },
    },
    SebookMonacoFocusExit: { attach() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'shared-editor.js' });
  const element = { style: {} };
  sandbox.SebookSharedEditor.bootForRole({
    kind,
    filename: kind === 'tab' ? 'query.sql' : undefined,
    pane: kind === 'pane' ? 'left' : undefined,
    els: { editor: element },
  });
  return {
    send: message => onMessage(message),
    finishLoad() {
      sandbox.monaco = monaco;
      for (const callback of loaderCallbacks) callback();
    },
    editors,
  };
}

test('tab popup creates one editor with the newest snapshot when Monaco loads later', () => {
  const popup = createDeferredMonacoPopup('tab');
  popup.send({ type: 'file-snapshot', filename: 'query.sql', content: 'SELECT 1', language: 'sql', version: 1 });
  popup.send({ type: 'state-snapshot', files: {
    'query.sql': { filename: 'query.sql', content: 'SELECT 2', language: 'sql', version: 2 },
  } });
  popup.finishLoad();

  assert.equal(popup.editors.length, 1);
  assert.equal(popup.editors[0].options.model.getValue(), 'SELECT 2');
});

test('pane popup creates one editor with the newest snapshot when Monaco loads later', () => {
  const popup = createDeferredMonacoPopup('pane');
  popup.send({ type: 'pane-snapshot', pane: 'left', files: {
    'query.sql': { content: 'SELECT 1', language: 'sql', version: 1 },
  }, activeFile: 'query.sql' });
  popup.send({ type: 'pane-snapshot', pane: 'left', files: {
    'query.sql': { content: 'SELECT 2', language: 'sql', version: 2 },
  }, activeFile: 'query.sql' });
  popup.finishLoad();

  assert.equal(popup.editors.length, 1);
  assert.equal(popup.editors[0].model.getValue(), 'SELECT 2');
});
