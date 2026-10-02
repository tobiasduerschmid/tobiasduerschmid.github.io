// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { startRuntime, request, writeSource } = require('./haskell-runtime-helpers');

// The fixtures state independently authored valid solutions and realistic wrong
// mental models. The production YAML gates are the subject under test, not the
// source of expected answers. Real MicroHs compiles and evaluates every program.
const courses = [
  ['haskell', require('./fixtures/haskell-foundations-gate-cases')],
  ['haskell-functions', require('./fixtures/haskell-functions-gate-cases')],
  ['haskell-data', require('./fixtures/haskell-data-gate-cases')],
  ['haskell-backend-demo', require('./fixtures/haskell-demo-gate-cases')],
];

for (const [slug, cases] of courses) {
  const tutorial = yaml.load(fs.readFileSync(
    path.join(__dirname, '../_data/tutorials', slug + '.yml'), 'utf8'));

  test.describe(`${slug} student gate contracts`, () => {
    test.setTimeout(180_000);

    test('every lesson has independent correct alternatives and mistake cases', () => {
      expect(cases.map(entry => entry.key)).toEqual(tutorial.steps.map(step => step.key || step.title));
      for (const entry of cases) {
        expect(entry.correct.length, entry.key).toBeGreaterThanOrEqual(2);
        expect(entry.incorrect.length, entry.key).toBeGreaterThanOrEqual(3);
      }
    });

    for (const entry of cases) {
      const step = tutorial.steps.find(step => (step.key || step.title) === entry.key);
      if (!step) throw new Error(`Fixture has no corresponding lesson: ${slug}/${entry.key}`);

      test(`${step.title}: accepts equivalent solutions and rejects plausible mistakes`, async ({ page }) => {
        await startRuntime(page);
        for (const [category, variants] of [['correct', entry.correct], ['incorrect', entry.incorrect]]) {
          for (const variant of variants) {
            await test.step(`${category}: ${variant.name}`, async () => {
              await writeSource(page, variant.source, step.run_file);
              const compile = await request(page, {
                type: 'runTest', path: step.run_file, expression: 'True',
              });
              expect(compile.exitCode, `Fixture must compile before grading: ${compile.stderr || compile.error || ''}`)
                .toBe(variant.compileErrorExpected ? 1 : 0);

              const outcomes = [];
              for (const gate of step.tests) {
                const result = await request(page, {
                  type: 'runTest', path: step.run_file, expression: gate.command,
                  ...(gate.signature ? { signature: gate.signature } : {}),
                });
                outcomes.push({ description: gate.description, ...result });
              }
              if (!variant.gateErrorExpected && !variant.compileErrorExpected) {
                expect(outcomes.filter(result => result.stderr || result.error),
                  'Behavior cases must be graded on their results, not an unrelated compiler error').toEqual([]);
              }
              const failures = outcomes.filter(result => result.exitCode !== 0);
              if (category === 'correct') {
                expect(failures, 'Every gate must accept this valid implementation').toEqual([]);
              } else {
                expect(failures.length, 'At least one gate must expose this mistake').toBeGreaterThan(0);
              }
            });
          }
        }
      });
    }
  });
}
