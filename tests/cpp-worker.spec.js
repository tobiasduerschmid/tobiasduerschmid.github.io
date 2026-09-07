const { test, expect } = require('@playwright/test');

// These are integration tests of the worker's public message protocol. The
// tutorial UI and its Stop/restart behavior have separate end-to-end coverage.
test.setTimeout(120_000);

async function startCompiler(page) {
  // A same-origin, script-free document avoids involving tutorial boot/setup.
  await page.goto('/js/vendor/browser-wasi-shim/0.4.2/README.md');
  await page.evaluate(() => new Promise((resolve, reject) => {
    const worker = new Worker('/js/cpp-worker.js', { type: 'module' });
    const pending = new Map();
    let nextId = 0;
    window.cppMessages = [];
    window.cppRequest = message => new Promise((done, fail) => {
      const id = ++nextId;
      pending.set(id, { done, fail });
      worker.postMessage({ ...message, id });
    });
    worker.onerror = event => {
      reject(new Error(event.message));
      for (const request of pending.values()) request.fail(new Error(event.message));
    };
    worker.onmessage = ({ data }) => {
      window.cppMessages.push(data);
      if (data.type === 'ready') resolve();
      if (data.type === 'error') {
        reject(new Error(data.message));
        for (const request of pending.values()) request.fail(new Error(data.message));
      }
      const request = pending.get(data.id);
      if (request) {
        pending.delete(data.id);
        request.done(data);
      }
    };
  }));
}

async function request(page, message) {
  return page.evaluate(input => window.cppRequest(input), message);
}

async function write(page, path, content) {
  const result = await request(page, { type: 'write', path, content });
  expect(result.type, result.message).toBe('write_ok');
}

async function run(page, options = {}) {
  return request(page, { type: 'run', path: '/tutorial/main.cpp', ...options });
}

test('compiles and runs standard C++ locally without a VM or cross-origin isolation', async ({ page, context }) => {
  const requestedUrls = [];
  context.on('request', req => requestedUrls.push(req.url()));
  await startCompiler(page);
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);
  await write(page, '/tutorial/main.cpp', `
    #include <iostream>
    #include <string>
    class Person { public: virtual std::string greet() const { return "base"; } };
    class Student : public Person { public: std::string greet() const override { return "hello"; } };
    void change(int& value) { value = 42; }
    int main() {
      Student student; Person& person = student;
      std::string name; std::getline(std::cin, name);
      int value = 0; change(value);
      std::cout << person.greet() << ", " << name << ": " << value << " ✓\\n";
    }
  `);
  const result = await run(page, { stdin: 'Ada\n' });
  expect(result.exitCode, result.stderr).toBe(0);
  expect(result.stdout).toBe('hello, Ada: 42 ✓\n');
  const messages = await page.evaluate(() => window.cppMessages);
  expect(messages.filter(message => message.type === 'stdout').map(message => message.text).join(''))
    .toBe(result.stdout);
  expect(requestedUrls.some(url => url.endsWith('.wasm.gz'))).toBe(true);
  expect(requestedUrls.every(url => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
  expect(requestedUrls.some(url => /\/vm\/|v86|coi-serviceworker/.test(url))).toBe(false);
});

test('uses current source and headers, and never runs an old binary after compilation fails', async ({ page }) => {
  await startCompiler(page);
  await write(page, '/tutorial/helpers/value.h', 'inline int value() { return 10; }');
  await write(page, '/tutorial/main.cpp', '#include "helpers/value.h"\n#include <iostream>\nint main() { std::cout << value(); }');
  expect((await run(page)).stdout).toBe('10');
  await write(page, '/tutorial/helpers/value.h', 'inline int value() { return 20; }');
  const edited = await run(page);
  expect(edited.exitCode, edited.stderr).toBe(0);
  expect(edited.stdout).toBe('20');
  await write(page, '/tutorial/main.cpp', 'int main() { invalid C++ source }');
  const failed = await run(page);
  expect(failed.exitCode).not.toBe(0);
  expect(failed.phase).toBe('compile');
  expect(failed.stderr).toMatch(/error:/);
  expect(failed.stdout).toBe('');
  await write(page, '/tutorial/main.cpp', 'int main() { return 0; }');
  const recovered = await run(page);
  expect(recovered.exitCode, recovered.stderr).toBe(0);
  expect(recovered.stdout).toBe('');
});

test('grades authored C++ harnesses from actual return status with fresh execution state', async ({ page }) => {
  await startCompiler(page);
  await write(page, '/tutorial/main.cpp', `
    int counter = 0;
    int next() { return ++counter; }
    int main() { return 27; }
  `);
  const check = `
    #include <iostream>
    #define main learner_main
    #include "main.cpp"
    #undef main
    int main() { if (next() != 1) { std::cerr << "not fresh"; return 1; } return 0; }
  `;
  for (let attempt = 0; attempt < 2; attempt++) {
    const passed = await request(page, { type: 'runTest', path: '/tutorial/main.cpp', code: check, silent: true });
    expect(passed.exitCode, passed.stderr).toBe(0);
  }
  const failed = await request(page, {
    type: 'runTest', path: '/tutorial/main.cpp', silent: true,
    code: '#include <iostream>\nint main() { std::cout << "looks correct"; std::cerr << "coordinates differ"; return 3; }',
  });
  expect(failed.exitCode).toBe(3);
  expect(failed.stdout).toBe('looks correct');
  expect(failed.stderr).toBe('coordinates differ');
  expect((await page.evaluate(() => window.cppMessages)).filter(message => /^(stdout|stderr)$/.test(message.type))).toHaveLength(0);
  // A check must not overwrite the learner's entry point or influence Run.
  expect((await run(page)).exitCode).toBe(27);
});

test('supports checking a source file without a main function and reports failed assertions', async ({ page }) => {
  await startCompiler(page);
  await write(page, '/tutorial/main.cpp', 'struct Point { int x; int y; };\nvoid modify(Point& p) { p.x = 20; p.y = 30; }');
  const code = '#include "main.cpp"\n#include <cassert>\nint main() { Point p{-4, 7}; modify(p); assert(p.x == 20 && p.y == 30); }';
  const passed = await request(page, { type: 'runTest', path: '/tutorial/main.cpp', code, silent: true });
  expect(passed.exitCode, passed.stderr).toBe(0);
  await write(page, '/tutorial/main.cpp', 'struct Point { int x; int y; };\nvoid modify(Point& p) { p.x = 20; }');
  const failed = await request(page, { type: 'runTest', path: '/tutorial/main.cpp', code, silent: true });
  expect(failed.exitCode).not.toBe(0);
  expect(failed.phase).toBe('run');
  expect(failed.stderr).toMatch(/assert|Assertion/);
});

test('reports runtime traps and excessive output even after earlier diagnostics', async ({ page }) => {
  await startCompiler(page);
  await write(page, '/tutorial/main.cpp', '#warning compilation warning\n#include <iostream>\nint main() { std::cerr << "before trap\\n"; __builtin_trap(); }');
  const trapped = await run(page, { silent: true });
  expect(trapped.exitCode).not.toBe(0);
  expect(trapped.phase).toBe('run');
  expect(trapped.stderr).toContain('before trap');
  expect(trapped.stderr).toMatch(/unreachable/i);
  await write(page, '/tutorial/main.cpp', '#include <iostream>\nint main() { std::cerr << "before output\\n"; for (int i = 0; i < 400000; ++i) std::cout << "x"; }');
  const exceeded = await run(page, { silent: true });
  expect(exceeded.exitCode).not.toBe(0);
  expect(exceeded.stderr).toMatch(/output limit exceeded/i);
  expect(exceeded.stdout.length + exceeded.stderr.length).toBeLessThan(270000);
  await write(page, '/tutorial/main.cpp', '#include <iostream>\nint main() { std::cout << "ready again"; }');
  const recovered = await run(page, { silent: true });
  expect(recovered.exitCode, recovered.stderr).toBe(0);
  expect(recovered.stdout).toBe('ready again');
});
