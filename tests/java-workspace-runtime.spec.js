const { test, expect } = require('@playwright/test');

// The upstream JVM is downloaded on demand. Run this integration alongside the
// offline editor/worker contract tests when changing the Java backend.
test.describe('Java compiler and execution workspace', () => {
  test.skip(process.env.JAVA_BROWSER_ENGINE !== '1', 'Set JAVA_BROWSER_ENGINE=1 to exercise the hosted browser JVM.');
  test.setTimeout(180000);

  test('uses the current project, isolates checks, and recovers from a runaway program', async ({ page }) => {
    await page.goto('/java-runtime-frame.html');
    const results = await page.evaluate(async () => {
      const { JavaWorkspace } = await import('/js/java/workspace.mjs');
      const workspace = new JavaWorkspace();
      try {
        const files = {
          'tools/Main.java': 'package tools; class Main { public static void main(String[] args) { System.out.print(args[0]); } }',
          'Counter.java': 'class Counter { static int count; }',
        };
        const run = () => workspace.run({ files, entry: 'tools/Main.java', args: ['ready'] });
        const harness = 'class Helper { public static void main(String[] args) { throw new Error(); } } public class __Test { public static void main(String[] args) { assert ++Counter.count == 1; } }';
        const output = await run();
        const firstCheck = await workspace.test({ files, code: harness });
        const repeatedCheck = await workspace.test({ files, code: harness });
        const failedAssertion = await workspace.test({ files, code: 'assert false : "mismatch";' });
        const invalid = await workspace.test({ files: { ...files, 'Broken.java': 'class Broken { int n = "x"; }' }, code: harness });
        const project = {
          'Value.java': 'class Value {static final int N = 1; static int get() { return 1; }}',
          'Other.java': 'class Other {static int sum() { return Value.N + Value.get(); }}',
        };
        const sums = [];
        for (const [before, after] of [['', ''], ['return 1;', 'return 10;'], ['N = 1', 'N = 3']]) {
          project['Value.java'] = project['Value.java'].replace(before, after);
          const sum = await workspace.test({files: project, code: 'System.out.print(Other.sum());'});
          sums.push(sum.stdout);
        }
        project['Value.java'] = project['Value.java'].replace('int get()', 'int get(int argument)');
        const invalidCaller = await workspace.analyze({files: project});
        const removedClass = await workspace.test({ files: { 'tools/Main.java': files['tools/Main.java'] }, code: harness });
        const analysis = await workspace.analyze({ files });
        workspace.runTimeoutMs = 2500;
        const loop = { 'Loop.java': 'public class Loop { public static void main(String[] args) { while (true) {} } }' };
        const timeout = await workspace.run({ files: loop, entry: 'Loop.java' }).then(() => null, error => error.message);
        workspace.runTimeoutMs = 30000;
        const recovered = await run();
        await workspace.analyze({ files: loop });
        const running = workspace.run({ files: loop, entry: 'Loop.java' });
        // Give the already-compiled loop time to execute before pressing Stop.
        const timer = setTimeout(() => workspace.cancel(), 250);
        const stopped = await running.then(() => null, error => error.name);
        clearTimeout(timer);
        const afterStop = await run();
        return { output, sums, invalidCaller, firstCheck, repeatedCheck, failedAssertion, invalid, removedClass, analysis, timeout, recovered, stopped, afterStop };
      } finally { workspace.destroy(); }
    });
    expect(results.output.stdout).toBe('ready');
    expect(results.sums).toEqual(['2', '11', '13']);
    expect(results.invalidCaller.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({file: 'Other.java', severity: 'error'})]));
    expect(results.firstCheck.exitCode).toBe(0);
    expect(results.repeatedCheck.exitCode).toBe(0);
    expect(results.failedAssertion.exitCode).toBe(1);
    expect(results.failedAssertion.stderr).toContain('AssertionError: mismatch');
    expect(results.invalid.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'error', file: 'Broken.java', line: 1 }),
    ]));
    expect(results.removedClass.exitCode).toBe(1);
    expect(results.removedClass.stderr).toContain('Counter');
    expect(results.analysis.success).toBe(true);
    expect(results.analysis.bindings).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Counter' })]));
    expect(results.timeout).toMatch(/time limit/);
    expect(results.recovered.stdout).toBe('ready');
    expect(results.stopped).toBe('AbortError');
    expect(results.afterStop.stdout).toBe('ready');
  });
});
