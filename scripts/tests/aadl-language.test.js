const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

let server, browser, page;
test.before(async () => {
  const root = path.resolve(__dirname, '../..');
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>AADL lexical test</title><script src="/js/monaco-loader.js"></script>');
      return;
    }
    if (!/^\/js\/(aadl\/language\.mjs|monaco-(loader|sebook-langs|focus-exit)\.js|popout\/shared-editor\.js|vendor\/monaco-editor\/)/.test(pathname) || pathname.includes('..')) {
      response.writeHead(404).end(); return;
    }
    try {
      response.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
      response.end(await readFile(path.join(root, pathname)));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(() => window.SEBookMonaco.load());
});
test.after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function tokens(source) {
  return page.evaluate(async source => {
    const { registerAADLLanguage } = await import('/js/aadl/language.mjs');
    registerAADLLanguage(monaco);
    await monaco.editor.colorize(source, 'aadl', {});
    return monaco.editor.tokenize(source, 'aadl').map((line, index) => {
      const text = source.split('\n')[index];
      return line.map((token, i) => ({ text: text.slice(token.offset, line[i + 1]?.offset ?? text.length), type: token.type.split('.')[0] }));
    });
  }, source);
}

test('AADL highlights case-insensitive keywords and categories without treating identifiers as keywords', async () => {
  const [line] = await tokens('SYSTEM implementation System_Controller.impl');
  assert.equal(line.find(token => token.text === 'SYSTEM').type, 'keyword');
  assert.equal(line.find(token => token.text === 'implementation').type, 'keyword');
  assert.equal(line.find(token => token.text === 'System_Controller').type, 'identifier');
});

test('AADL comments and quoted strings shield their contents from keyword highlighting', async () => {
  const lines = await tokens('-- system 25 ms\nDescription => "system -- device";\nthread Worker');
  assert.deepEqual(lines[0], [{ text: '-- system 25 ms', type: 'comment' }]);
  assert.equal(lines[1].find(token => token.text.includes('system -- device')).type, 'string');
  assert.equal(lines[2][0].type, 'keyword');
});

test('AADL highlights numeric ranges, units, connection arrows, and property operators', async () => {
  const [line] = await tokens('Latency => 8 ms .. 1.2e+1 MS; a -> b; c <-> d; Values +=> 16#FF#;');
  for (const value of ['8', '1.2e+1', '16#FF#']) assert.equal(line.find(token => token.text === value)?.type, 'number', value);
  for (const value of ['ms', 'MS']) assert.equal(line.find(token => token.text === value)?.type, 'type', value);
  for (const value of ['=>', '..', '->', '<->', '+=>']) assert.equal(line.find(token => token.text === value)?.type, 'operator', value);
});

test('AADL registration is idempotent for the same Monaco instance', async () => {
  await tokens('system S');
  assert.equal(await page.evaluate(() => monaco.languages.getLanguages().filter(language => language.id === 'aadl').length), 1);
});

for (const kind of ['tab', 'pane']) {
  test(`${kind} popout loads the shared AADL lexer before creating its model in a fresh window`, async t => {
    const popup = await browser.newPage();
    t.after(() => popup.close());
    await popup.goto(`http://127.0.0.1:${server.address().port}`);
    await popup.evaluate(() => window.SEBookMonaco.load());
    for (const src of ['/js/monaco-sebook-langs.js', '/js/monaco-focus-exit.js', '/js/popout/shared-editor.js']) await popup.addScriptTag({ url: src });
    // Supply the parent-message boundary while retaining the real popup editor,
    // language registry, model creation, and Monaco tokenizer.
    await popup.evaluate(kind => {
      SebookMonacoLangs.register(monaco);
      let receive;
      window.SebookPopoutClient = { connect({ onMessage }) {
        receive = onMessage;
        return { tutorialTitle: 'AADL', markConnected() {}, post() {}, setStatus() {}, flashStatus() {} };
      } };
      const editor = document.createElement('div');
      editor.style.height = '300px'; document.body.append(editor);
      SebookSharedEditor.bootForRole({ kind, filename: 'Model.aadl', pane: 'left', els: { editor } });
      const file = { content: 'SYSTEM Example\nend Example;', version: 1 };
      receive(kind === 'tab' ? { type: 'file-snapshot', filename: 'Model.aadl', ...file }
        : { type: 'pane-snapshot', pane: 'left', activeFile: 'Model.aadl', files: { 'Model.aadl': { ...file, language: 'aadl' } } });
    }, kind);
    await expect.poll(() => popup.evaluate(() => monaco.editor.getModels().some(model => model.getValue().startsWith('SYSTEM Example')))).toBe(true);
    const token = await popup.evaluate(async () => {
      const model = monaco.editor.getModels().find(model => model.getValue().startsWith('SYSTEM Example'));
      await monaco.editor.colorize(model.getValue(), model.getLanguageId(), {});
      return { language: model.getLanguageId(), type: monaco.editor.tokenize(model.getValue(), model.getLanguageId())[0][0].type };
    });
    assert.equal(token.language, 'aadl');
    assert.match(token.type, /^keyword\b/);
  });
}
