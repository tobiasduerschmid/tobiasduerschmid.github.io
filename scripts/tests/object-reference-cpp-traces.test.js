const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const generator = import('../build-object-reference-cpp-traces.mjs');
async function trace(code) {
  const result = await (await generator).traceCpp(code);
  assert.equal(result.error, null, result.error);
  assert.equal(result.truncated, false);
  assert.equal(result.steps.at(-1).event, 'final');
  assert.deepEqual(result.steps.at(-1).scopes, []);
  assert.deepEqual(result.steps.at(-1).objects, []);
  assert.equal(result.steps.at(-1).output, result.steps.at(-2).output);
  // Value/identity assertions inspect the retained pre-return state; final has no live locals.
  return result.steps.slice(0, -1);
}
function binding(step, scopeName, name) {
  const scope = step.scopes.find(scope => scope.name === scopeName && scope.bindings.some(binding => binding.name === name));
  assert.ok(scope, `${scopeName}.${name} is visible at line ${step.line}`);
  return scope.bindings.find(binding => binding.name === name);
}
function value(step, scope, name) { return step.objects.find(object => object.id === binding(step, scope, name).target).value; }

test('value parameters and string copies retain distinct storage and cannot rebind the caller', async () => {
  const steps = await trace('#include <string>\nvoid edit(std::string text) { text += "!"; text = "new"; }\nint main() { std::string title="song"; std::string copy=title; edit(title); }');
  const entered = steps.find(step => step.event === 'call' && step.scopes.at(-1).name === 'edit');
  assert.notEqual(binding(entered, 'main', 'title').target, binding(entered, 'edit', 'text').target);
  assert.notEqual(binding(entered, 'main', 'title').target, binding(entered, 'main', 'copy').target);
  assert.equal(value(steps.at(-1), 'main', 'title'), '"song"');
  assert.equal(value(steps.find(step => step.scopes.at(-1).name === 'edit' && step.event === 'return'), 'edit', 'text'), '"new"');
});

test('reference parameters and local aliases share the caller through mutation and assignment', async () => {
  const steps = await trace('void edit(std::string& text) { std::string& alias=text; alias += "!"; text = "new"; }\nint main() { std::string title="song"; edit(title); }');
  const step = steps.find(step => step.scopes.at(-1).name === 'edit' && step.event === 'return');
  assert.equal(binding(step, 'main', 'title').target, binding(step, 'edit', 'text').target);
  assert.equal(binding(step, 'edit', 'text').target, binding(step, 'edit', 'alias').target);
  assert.equal(binding(step, 'edit', 'alias').semantics, 'reference');
  assert.equal(value(steps.at(-1), 'main', 'title'), '"new"');
});

test('const-reference parameters alias existing storage without copying', async () => {
  const steps = await trace('int size(const std::string& text) { return text.size(); }\nint main() { std::string title="song"; int count=size(title); }');
  const entered = steps.find(step => step.scopes.at(-1).name === 'size');
  assert.equal(binding(entered, 'main', 'title').target, binding(entered, 'size', 'text').target);
  assert.equal(binding(entered, 'size', 'text').semantics, 'reference');
  assert.equal(value(steps.at(-1), 'main', 'count'), '4');
});

test('string value returns preserve separate local and caller storage lifetimes', async () => {
  const steps = await trace('std::string make() { std::string local="song"; return local; }\nint main() { std::string result=make(); }');
  const leaving = steps.find(step => step.event === 'return' && step.scopes.at(-1).name === 'make');
  assert.equal(value(leaving, 'make', 'local'), '"song"');
  assert.equal(value(steps.at(-1), 'main', 'result'), '"song"');
  assert.notEqual(binding(leaving, 'make', 'local').target, binding(steps.at(-1), 'main', 'result').target);
});

test('auto-deduced pointers keep pointer semantics', async () => {
  const steps = await trace('int main() { int value=4; auto pointer=&value; *pointer=8; }');
  assert.equal(binding(steps.at(-1), 'main', 'pointer').semantics, 'object-reference');
  assert.equal(binding(steps.at(-1), 'main', 'pointer').target, binding(steps.at(-1), 'main', 'value').target);
  assert.equal(value(steps.at(-1), 'main', 'value'), '8');
});

test('pointer parameter retargeting preserves the caller pointer while dereference writes change its pointee', async () => {
  const steps = await trace('void edit(int* pointer, int* other) { pointer=other; *pointer=19; }\nint main() { int first=2; int second=7; int* caller=&first; edit(caller, &second); *caller=4; }');
  const entered = steps.find(step => step.scopes.at(-1).name === 'edit');
  assert.equal(binding(entered, 'main', 'caller').target, binding(entered, 'edit', 'pointer').target);
  const leaving = steps.find(step => step.scopes.at(-1).name === 'edit' && step.event === 'return');
  assert.equal(binding(leaving, 'edit', 'pointer').target, binding(leaving, 'main', 'second').target);
  assert.equal(binding(leaving, 'main', 'caller').target, binding(leaving, 'main', 'first').target);
  assert.equal(binding(leaving, 'main', 'caller').semantics, 'object-reference');
  assert.equal(value(steps.at(-1), 'main', 'first'), '4');
  assert.equal(value(steps.at(-1), 'main', 'second'), '19');
});

test('copy-in/out changes the caller only at the explicit caller assignment', async () => {
  const steps = await trace('int edit(int score) { score += 3; return score; }\nint main() {\n int score=4;\n int returned=edit(score);\n score=returned;\n}');
  const returned = steps.find(step => step.event === 'line' && step.line === 4 && step.scopes.length === 1);
  assert.equal(value(returned, 'main', 'score'), '4');
  assert.equal(value(returned, 'main', 'returned'), '7');
  const assigned = steps.find(step => step.event === 'line' && step.line === 5);
  assert.equal(value(assigned, 'main', 'score'), '7');
  assert.equal(assigned.visualizedLine, 5);
  assert.notEqual(binding(assigned, 'main', 'score').target, binding(assigned, 'main', 'returned').target);
});

test('macro precedence is evaluated by the real C++ preprocessor and compiler', async () => {
  const steps = await trace('#define SQUARE(x) x*x\nint main() {\n int result=SQUARE(1+2);\n std::cout << result;\n}');
  assert.equal(value(steps.at(-1), 'main', 'result'), '5');
  assert.equal(steps.at(-1).output, '5');
  assert.equal(steps.find(step => step.objects.length).visualizedLine, 3);
});

test('statement macros evaluate repeated arguments separately while value calls evaluate their argument once', async () => {
  const steps = await trace('#define TWICE(action) do { action; action; } while(false)\nvoid twice(int value) { std::cout << value << value; }\nint main() {\n int count=0;\n TWICE(++count);\n twice(++count);\n}');
  const macroValues = steps.filter(step => step.line === 5).map(step => value(step, 'main', 'count'));
  assert.ok(macroValues.includes('1')); assert.ok(macroValues.includes('2'));
  assert.equal(value(steps.at(-1), 'main', 'count'), '3');
  assert.equal(steps.at(-1).output, '33');
});

test('macro variable capture records inner and outer same-named variables as separate storage', async () => {
  const steps = await trace('#define SWAP(X,Y) { int temp=X; X=Y; Y=temp; }\nint main() {\n int a=2;\n int temp=17;\n SWAP(a,temp);\n std::cout << a << "," << temp;\n}');
  const captured = steps.find(step => step.scopes.filter(scope => scope.bindings.some(binding => binding.name === 'temp')).length === 2);
  const temps = captured.scopes.flatMap(scope => scope.bindings.filter(binding => binding.name === 'temp'));
  assert.notEqual(temps[0].target, temps[1].target);
  assert.equal(captured.visualizedLine, 5);
  assert.equal(steps.at(-1).output, '2,17');
});

test('null and expired pointer targets are explicit and observers do not dereference them', async () => {
  const steps = await trace('int main() {\n int* p=nullptr;\n { int local=4; p=&local; }\n std::cout << "done";\n}');
  const nullStep = steps.find(step => step.line === 2 && step.event === 'line');
  assert.equal(value(nullStep, 'main', 'p'), 'nullptr');
  const final = steps.at(-1);
  const target = final.objects.find(object => object.id === binding(final, 'main', 'p').target);
  assert.match(target.note, /Dangling pointer/);
  assert.equal(final.output, 'done');
});

test('braced loops record actual repeated values and bounded runaway loops are incomplete', async () => {
  const steps = await trace('int main() { int count=0; while(count<3) { count++; } }');
  assert.equal(value(steps.at(-1), 'main', 'count'), '3');
  const runaway = await (await generator).traceCpp('int main() { while(true) {} }');
  assert.equal(runaway.truncated, true);
  assert.match(runaway.error, /limit/);
  assert.ok(runaway.steps.length <= 241);
  assert.equal(runaway.steps.at(-1).event, 'error');
});

test('unsupported declarations and syntax fail explicitly instead of disappearing', async () => {
  for (const [code, diagnostic] of [
    ['int main() { int values[2]={1,2}; }', /simple named|arrays/],
    ['int main() { int value; }', /Initialize every scalar/],
    ['int main() { static int count=1; }', /Static/],
    ['struct Point { int x; }; int main() {}', /global variables, classes/],
    ['int main() { auto f=[]() {return 1;}; }', /lambda/],
    ['int main() { for(int i=0;i<2;i++) {} }', /for statement/],
    ['int main() { if(int x=1; x) {} }', /init statement|declaration/],
    ['int main() { int count=1; count = "bad"; }', /input.cpp:1/],
  ]) {
    const result = await (await generator).traceCpp(code);
    assert.match(result.error, diagnostic); assert.deepEqual(result.steps, []);
  }
});

test('unsequenced macro side effects are rejected as compilation errors', async () => {
  const result = await (await generator).traceCpp('#define TWICE(x) ((x)+(x))\nint main() { int i=0; int x=TWICE(++i); }');
  assert.match(result.error, /unsequenced/); assert.deepEqual(result.steps, []);
});

test('source and output resource bounds report incomplete traces', async () => {
  const tooLong = await (await generator).traceCpp(' '.repeat(16001) + 'int main() {}');
  assert.equal(tooLong.truncated, true); assert.match(tooLong.error, /16,000/);
  const output = await (await generator).traceCpp('int main() { std::string chunk(4096, \'x\'); std::cout << chunk << chunk << chunk << chunk << chunk; }');
  assert.equal(output.truncated, true); assert.match(output.error, /output/);
});

test('batch generator accepts JSON records and produces deterministic traces', async () => {
  const input = JSON.stringify([{ id: 'simple', code: 'int main() { int x=7; }' }]);
  const command = path.resolve(__dirname, '../build-object-reference-cpp-traces.mjs');
  const first = spawnSync(process.execPath, [command], { input, encoding: 'utf8' });
  const second = spawnSync(process.execPath, [command], { input, encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr); assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);
  assert.equal(JSON.parse(first.stdout).simple.error, null);
});

test('final state retains output produced while evaluating the main return expression', async () => {
  const result = await (await generator).traceCpp('int main() { unsigned long long count=4; return (std::cout << count, 0); }');
  assert.equal(result.error, null);
  assert.equal(result.steps.at(-1).event, 'final');
  assert.equal(result.steps.at(-1).line, 0);
  assert.equal(result.steps.at(-1).visualizedLine, 1);
  assert.equal(result.steps.at(-1).output, '4');
  assert.deepEqual(result.steps.at(-1).scopes, []);
});

test('references to string subobjects and untracked temporaries are rejected before installing a reader', async () => {
  for (const code of [
    'int main() { std::string s(100,\'a\'); char& first=s.front(); s=std::string(2000,\'z\'); std::cout << s.size(); }',
    'int main() { std::string s="abc"; char& first=s.front(); }',
    'int main() { std::string s="abc"; auto& first=s.front(); }',
    'void read(const char& value) {} int main() { std::string s="abc"; read(s.front()); }',
    'void read(const int& value) {} int main() { read(4); }',
  ]) {
    const result = await (await generator).traceCpp(code);
    assert.match(result.error, /already observed whole object of the same type/);
    assert.equal(result.truncated, false);
    assert.equal(result.steps.at(-1).event, 'error');
    assert.ok(result.steps.every(step => step.scopes.every(scope => scope.bindings.every(binding => binding.name !== 'first'))));
  }
});

test('subobject pointer addresses never alias the containing string card', async () => {
  const steps = await trace('int main() { std::string s="abc"; char* first=&s.front(); }');
  const final = steps.at(-1);
  assert.notEqual(binding(final, 'main', 's').target, binding(final, 'main', 'first').target);
  const target = final.objects.find(object => object.id === binding(final, 'main', 'first').target);
  assert.match(target.note, /outside observed live storage/);
});

test('ASan confirms that refusing a string subobject reference adds no invalid memory read', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sebook-cpp-asan-'));
  const previousCompiler = process.env.CXX;
  const previousAsan = process.env.ASAN_OPTIONS;
  const code = 'int main() { std::string s(100,\'a\'); char& first=s.front(); s=std::string(2000,\'z\'); std::cout << s.size(); }';
  try {
    const wrapper = path.join(directory, 'asan-clang');
    await fs.writeFile(wrapper, '#!/bin/sh\nexec clang++ -fsanitize=address -fno-omit-frame-pointer "$@"\n', { mode: 0o700 });
    process.env.ASAN_OPTIONS = `detect_leaks=0:log_path=${path.join(directory, 'asan-report')}`;
    await fs.writeFile(path.join(directory, 'baseline.cpp'), '#include <string>\n#include <iostream>\n' + code);
    const baselineBuild = spawnSync(wrapper, ['-std=c++17', 'baseline.cpp', '-o', 'baseline'], { cwd: directory, encoding: 'utf8' });
    assert.equal(baselineBuild.status, 0, baselineBuild.stderr);
    const baseline = spawnSync(path.join(directory, 'baseline'), [], { encoding: 'utf8' });
    assert.equal(baseline.status, 0, baseline.stderr);
    assert.equal(baseline.stdout, '2000');
    process.env.CXX = wrapper;
    const observed = await (await generator).traceCpp(code);
    assert.match(observed.error, /already observed whole object/);
    assert.deepEqual((await fs.readdir(directory)).filter(name => name.startsWith('asan-report')), [], 'Neither the baseline nor the observer may trigger AddressSanitizer');
  } finally {
    if (previousCompiler === undefined) delete process.env.CXX; else process.env.CXX = previousCompiler;
    if (previousAsan === undefined) delete process.env.ASAN_OPTIONS; else process.env.ASAN_OPTIONS = previousAsan;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('raw and multiline literals are diagnosed before directive-looking contents can be rewritten', async () => {
  for (const body of ['first\nsecond', 'first\n#include <string>\nsecond', 'first\n#line 100 "input.cpp"\nsecond']) {
    const result = await (await generator).traceCpp('int main() { std::string s=R"(' + body + ')"; std::cout << s; }');
    assert.match(result.error, /Raw string literals are not supported/);
    assert.deepEqual(result.steps, []);
  }
  const continued = await (await generator).traceCpp('int main() { std::string s="first\\\n#include <string>"; }');
  assert.match(continued.error, /Multiline quoted literals/);
  assert.deepEqual(continued.steps, []);
  const steps = await trace('/*\n#include <vector>\n#pragma ignored\n*/\nint main() { std::string s="#include <string>"; std::cout << s; }');
  assert.equal(steps.at(-1).output, '#include <string>');
});

test('multi-declarator statements are rejected while separate declarations preserve caller identity through initializer calls', async () => {
  const prefix = 'int id(const int& value) { return value; }\n';
  const invalid = await (await generator).traceCpp(prefix + 'int main() { int x=4, y=id(x); }');
  assert.match(invalid.error, /Multiple declarators/);
  assert.deepEqual(invalid.steps, []);
  const steps = await trace(prefix + 'int main() { int x=4; int y=id(x); }');
  const called = steps.find(step => step.event === 'call' && step.scopes.at(-1).name === 'id');
  assert.equal(binding(called, 'id', 'value').target, binding(called, 'main', 'x').target);
  assert.equal(binding(called, 'main', 'x').target, binding(steps.at(-1), 'main', 'x').target);
  assert.notEqual(binding(steps.at(-1), 'main', 'x').target, binding(steps.at(-1), 'main', 'y').target);
});

test('deduced multiple-indirection pointers cannot bypass the supported pointer type contract', async () => {
  for (const declaration of ['auto pp=&p;', 'auto* pp=&p;', 'const auto pp=&p;']) {
    const result = await (await generator).traceCpp('int main() { int x=1; int* p=&x; ' + declaration + ' }');
    assert.match(result.error, /Pointers must have one level of indirection/);
    assert.deepEqual(result.steps, []);
  }
});

test('numeric separators after alphabetic hex digits remain distinct from character quotes', async () => {
  const steps = await trace(`int main() {
 unsigned int upper=0xAB'CD;
 unsigned int lower=0xab'cd;
 unsigned int digits=0x12'34;
 int decimal=1'000;
 int binary=0b10'01;
 double fraction=0xA'B.C'Dp+0;
 char letter='A';
 char prefixed=u8'B';
 char apostrophe='\\'';
 std::cout << upper << ',' << lower << ',' << digits << ',' << decimal << ',' << binary << ',' << fraction << ',' << letter << prefixed << apostrophe;
}`);
  assert.equal(steps.at(-1).output, "43981,43981,4660,1000,9,171.801,AB'");
});
