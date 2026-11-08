const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');

async function serve() {
  const server = http.createServer((request, response) => {
    if (request.url === '/') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>C++ worker contract</title>'); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(request.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    response.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : /\.(mjs|js)$/.test(file) ? 'text/javascript' : 'application/octet-stream');
    const stream = fs.createReadStream(file);
    stream.on('error', () => response.writeHead(404).end());
    stream.pipe(response);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server;
}

test('real browser Clang/WASI agrees with native execution and recovers after compilation errors', { timeout: 180000 }, async t => {
  const server = await serve();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const code = `#include <string>
#define TWICE(action) do { action; action; } while(false)
#define SQUARE(x) x*x
#define SWAP(X,Y) { int temp=X; X=Y; Y=temp; }
void byValue(std::string title) { title += "!"; title="new"; }
void byReference(std::string& title) { title += "!"; }
int size(const std::string& title) { return title.size(); }
void point(int* p, int* other) { p=other; *p=9; }
int copyOut(int n) { n+=2; return n; }
int main() {
 std::string title="song";
 byValue(title);
 byReference(title);
 int count=size(title);
 int a=2;
 int temp=17;
 int* p=&a;
 point(p,&temp);
 TWICE(++count);
 int precedence=SQUARE(1+2);
 SWAP(a,temp);
 int result=copyOut(a);
 a=result;
 std::cout << title << "," << count << "," << a << "," << temp << "," << precedence;
 unsigned int mask=0xAB'CD;
 unsigned int lower=0xab'cd;
 int decimal=1'000;
 char letter='A';
 char prefixed=u8'B';
 std::cout << "," << mask << "," << lower << "," << decimal << "," << letter << prefixed;
}`;
  const results = await page.evaluate(async code => {
    const worker = new Worker('/js/object-reference-cpp-worker.js', { type: 'module' });
    const messages = [];
    let receive;
    worker.onmessage = ({ data }) => { messages.push(data.type); if (data.type !== 'running') receive?.(data); };
    const ready = await new Promise((resolve, reject) => { receive = resolve; worker.onerror = event => reject(new Error(event.message)); });
    if (ready.type !== 'ready') throw new Error(ready.message);
    const run = code => new Promise(resolve => { receive = resolve; worker.postMessage({ type: 'trace', code }); });
    try {
      const valid = await run(code);
      const invalid = await run('int main() { int count="bad"; }');
      const edited = await run('int main() { int score=21; score*=2; std::cout << score; }');
      const rejected = [];
      for (const source of [
        'int main() { std::string s(100,\'a\'); char& first=s.front(); s=std::string(2000,\'z\'); }',
        'int main() { std::string s="abc"; auto& first=s.front(); }',
        'int main() { std::string s=R"(first\n#include <string>\nsecond)"; }',
        'int id(const int& v) { return v; } int main() { int x=4, y=id(x); }',
        'int main() { int x=1; int* p=&x; auto* pp=&p; }',
      ]) rejected.push(await run(source));
      return { valid, invalid, edited, rejected, messages };
    } finally { worker.terminate(); }
  }, code);
  assert.equal(results.valid.type, 'result', results.valid.message);
  const native = await (await import('../build-object-reference-cpp-traces.mjs')).traceCpp(code);
  assert.equal(native.error, null);
  assert.deepEqual(results.valid.trace, native, 'Native and WASI must agree on values, aliases, macro expansion, scopes and source lines');
  assert.equal(results.valid.trace.steps.at(-1).output, 'song!,7,4,9,5,43981,43981,1000,AB');
  assert.equal(results.invalid.type, 'error');
  assert.match(results.invalid.message, /input.cpp:1/);
  assert.equal(results.edited.type, 'result');
  assert.equal(results.edited.trace.error, null);
  assert.equal(results.edited.trace.steps.at(-1).output, '42');
  assert.match(results.rejected[0].trace.error, /already observed whole object/);
  assert.match(results.rejected[1].trace.error, /already observed whole object/);
  assert.match(results.rejected[2].message, /Raw string literals/);
  assert.match(results.rejected[3].message, /Multiple declarators/);
  assert.match(results.rejected[4].message, /Pointers must have one level of indirection/);
  assert.equal(results.messages.filter(message => message === 'running').length, 4, 'Compilation and source-rejection failures must never execute an old binary');
});
