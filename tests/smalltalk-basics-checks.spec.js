const { test, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');
const { installSmalltalk } = require('./helpers/smalltalk-runtime');

const tutorial = loadTutorialConfig('smalltalk-basics');
const liveStep = tutorial.steps.find(step => step.key === 'live-scorekeeper-v1');
const subclassStep = tutorial.steps.find(step => step.key === 'bonus-subclass-v1');
test.setTimeout(180000);

function overrideMethods(files, definitions) {
  return files.map((file, index) => index ? file : {
    ...file,
    content: file.content + definitions.map(([className, source]) =>
      `\n!${className} methodsFor: 'scoring'!\n${source}\n! !\n`).join(''),
  });
}

const liveCases = [
  { name: 'the supplied starter still needs the ten-point rule', files: liveStep.files, expected: [false, false] },
  { name: 'the model satisfies both win requirements', files: liveStep.solution.files, expected: [true, true] },
  { name: 'commuted addition is accepted', method: 'win points := 10 + points. ^ self', expected: [true, true] },
  { name: 'two smaller additions are accepted', method: 'win points := points + 5. points := points + 5. ^ self', expected: [true, true] },
  { name: 'a fixed total earns first-win credit but fails accumulation', method: 'win points := 10. ^ self', expected: [true, false] },
  { name: 'returning the total fails receiver identity while retaining accumulation', method: 'win points := points + 10. ^ points', expected: [false, true] },
  { name: 'multiplying the initial zero fails both win requirements', method: 'win points := points * 10. ^ self', expected: [false, false] },
  { name: 'subtracting the reward fails both win requirements', method: 'win points := points - 10. ^ self', expected: [false, false] },
];

const subclassCases = [
  { name: 'the starter preserves ordinary scoring but lacks the bonus', files: subclassStep.files, expected: [false, true] },
  { name: 'the model preserves ordinary and bonus scoring', files: subclassStep.solution.files, expected: [true, true] },
  { name: 'doubling the inherited rule is accepted', definitions: [['SEBookBonusScore', 'pointsPerWin ^ super pointsPerWin * 2']], expected: [true, true] },
  { name: 'an equivalent arithmetic rule is accepted', definitions: [['SEBookBonusScore', 'pointsPerWin ^ 10 + 10']], expected: [true, true] },
  { name: 'editing only the parent changes the wrong player', definitions: [['SEBookArcadeScore', 'pointsPerWin ^ 20']], expected: [false, false] },
  { name: 'changing both rules earns bonus credit but fails ordinary scoring', definitions: [['SEBookArcadeScore', 'pointsPerWin ^ 20'], ['SEBookBonusScore', 'pointsPerWin ^ 20']], expected: [true, false] },
  { name: 'using current state as the reward fails the bonus rule', definitions: [['SEBookBonusScore', 'pointsPerWin ^ points']], expected: [false, true] },
  { name: 'replacing the score on each win fails repeated bonus wins', definitions: [['SEBookBonusScore', 'win points := 20. ^ self']], expected: [false, true] },
];

async function checkAuthoredCriteria(page, step, files) {
  await installSmalltalk(page);
  await page.addScriptTag({ url: '/js/smalltalk/fresh-runner.js' });
  return page.evaluate(async ({ step, files }) => {
    const api = window.SEBookSmalltalk;
    const runner = await api.FreshRunner.create();
    try {
      const program = api.normalizeProgram({ stepKey: step.key, files, runFile: step.run_file });
      return (await runner.runTests(step.tests, { program })).results;
    } finally { runner.dispose(); }
  }, { step, files });
}

for (const scenario of liveCases) test('Live Objects: ' + scenario.name, async ({ page }) => {
  const files = scenario.files || overrideMethods(liveStep.files, [['SEBookArcadeScore', scenario.method]]);
  const results = await checkAuthoredCriteria(page, liveStep, files);
  expect(results.map(row => row.error), 'Authored checks must execute without native errors').toEqual([null, null]);
  expect(results.map(row => row.passed), liveStep.tests.map(check => check.description).join('\n')).toEqual(scenario.expected);
});

for (const scenario of subclassCases) test('Subclasses: ' + scenario.name, async ({ page }) => {
  const files = scenario.files || overrideMethods(subclassStep.files, scenario.definitions);
  const results = await checkAuthoredCriteria(page, subclassStep, files);
  expect(results.map(row => row.error), 'Authored checks must execute without native errors').toEqual([null, null]);
  expect(results.map(row => row.passed), subclassStep.tests.map(check => check.description).join('\n')).toEqual(scenario.expected);
});

async function evaluateExpressions(page, step, files, expressions) {
  await installSmalltalk(page);
  for (const url of ['/js/smalltalk/fresh-runner.js', '/js/smalltalk/workspace.js']) await page.addScriptTag({ url });
  return page.evaluate(async ({ step, files, expressions }) => {
    const api = window.SEBookSmalltalk;
    const runtime = await api.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json' });
    let workspace;
    try {
      const program = api.normalizeProgram({ stepKey: step.key, files, runFile: step.run_file });
      workspace = await api.Workspace.create({ runtime, program });
      const results = [];
      for (const source of expressions) results.push(await workspace.evaluate(source));
      return results;
    } finally { if (workspace) workspace.dispose(); runtime.dispose(); }
  }, { step, files, expressions });
}

function fencedExpressions(step) {
  return [...step.instructions.matchAll(/```smalltalk\n([\s\S]*?)```/g)]
    .flatMap(match => match[1].trim().split('\n'));
}

test('message examples demonstrate receivers, positions and binary precedence', async ({ page }) => {
  const step = tutorial.steps.find(step => step.key === 'messages-and-results-v1');
  const examples = fencedExpressions(step);
  // These inline expressions are the two contrasts and the exit question.
  const contrasts = ['2 + 3 * 4', '2 + (3 * 4)', '7 + 2'];
  for (const expression of contrasts) expect(step.instructions).toContain('`' + expression + '`');
  const results = await evaluateExpressions(page, step, step.files, [...examples, ...contrasts, step.run_command]);
  expect(results.map(row => row.error)).toEqual([null, null, null, null, null, null, null]);
  expect(results.map(row => row.value.text)).toEqual(['ARCADE', '7', 'rca', '20', '14', '9', 'ARCADE']);
});

test('conditional examples run only the chosen block and answer nil otherwise', async ({ page }) => {
  const step = tutorial.steps.find(step => step.key === 'boolean-objects-v1');
  const results = await evaluateExpressions(page, step, step.files, [
    ...fencedExpressions(step), step.run_command, "(3 < 2) ifTrue: ['Bonus unlocked!']",
  ]);
  expect(results.map(row => row.error), 'An unchosen division-by-zero block must not raise an error').toEqual([null, null, null, null]);
  expect(results.map(row => row.value.text)).toEqual(['nil', '42', 'Bonus unlocked!', 'nil']);
});

const learnerCheck = 'probe := SEBookBonusScore new. probe win. probe win. probe value = 40';
test('a learner check can be evaluated twice without retaining the prior probe score', async ({ page }) => {
  const results = await evaluateExpressions(page, subclassStep, subclassStep.solution.files, [learnerCheck, learnerCheck]);
  expect(results.map(row => row.error)).toEqual([null, null]);
  expect(results.map(row => row.value.booleanValue)).toEqual([true, true]);
});

test('the learner check detects a bonus method that replaces rather than accumulates points', async ({ page }) => {
  const files = overrideMethods(subclassStep.solution.files, [['SEBookBonusScore', 'win points := 20. ^ self']]);
  const results = await evaluateExpressions(page, subclassStep, files, [learnerCheck, learnerCheck]);
  expect(results.map(row => row.error)).toEqual([null, null]);
  expect(results.map(row => row.value.booleanValue)).toEqual([false, false]);
});
