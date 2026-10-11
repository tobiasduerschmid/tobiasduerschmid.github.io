const { test, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');
const { installSmalltalk } = require('./helpers/smalltalk-runtime');

const step = loadTutorialConfig('smalltalk').steps[0];
test.setTimeout(180000);

function withIncrement(source) {
  return step.files.map(file => file.path === 'Counter.st' ? {
    ...file,
    content: file.content + "\n!SEBookCounter methodsFor: 'counting'!\n" + source + '\n! !\n',
  } : file);
}

const cases = [
  {
    name: 'the starter earns credit only for independent objects',
    files: step.files,
    expected: [false, false, true],
  },
  {
    name: 'the supplied solution satisfies every counter requirement',
    files: step.solution.files,
    expected: [true, true, true],
  },
  {
    name: 'two separate additions satisfy the same counter contract',
    files: withIncrement('increment\n  count := count + 1.\n  count := count + 1.\n  ^ self'),
    expected: [true, true, true],
  },
  {
    name: 'commuted addition satisfies the same counter contract',
    files: withIncrement('increment\n  count := 2 + count.\n  ^ self'),
    expected: [true, true, true],
  },
  {
    name: 'assigning a fixed value fails the accumulation check only',
    files: withIncrement('increment\n  count := 2.\n  ^ self'),
    expected: [true, false, true],
  },
  {
    name: 'returning the count fails the receiver-return requirement',
    files: withIncrement('increment\n  count := count + 2.\n  ^ count'),
    expected: [false, true, true],
  },
  {
    name: 'shared class state fails the independent-object check only',
    files: [{ path: 'Counter.st', language: 'smalltalk', content: `
Object subclass: #SEBookCounter
    instanceVariableNames: ''
    classVariableNames: 'SharedCount'
    poolDictionaries: ''
    category: 'SEBook-Smalltalk'!
!SEBookCounter methodsFor: 'counting'!
initialize
    super initialize.
    SharedCount := 0
!
increment
    SharedCount := SharedCount + 2.
    ^ self
!
value
    ^ SharedCount
! !
` }],
    expected: [true, true, false],
  },
  {
    name: 'editing old helper checks cannot make the unchanged starter pass',
    files: step.files.map(file => file.path === 'Counter.st' ? {
      ...file,
      content: file.content + `
!SEBookCounter class methodsFor: 'testing'!
checkIncrement
    ^ true
!
checkRepeatedIncrement
    ^ true
!
checkIndependentCounters
    ^ true
! !
`,
    } : file),
    expected: [false, false, true],
  },
];

for (const scenario of cases) {
  test('Smalltalk lesson: ' + scenario.name, async ({ page }) => {
    // These are native assessment integration tests, not UI simulations. Exercise
    // the same authored commands and fresh-image runner used by Test My Work.
    await installSmalltalk(page);
    await page.addScriptTag({ url: '/js/smalltalk/fresh-runner.js' });
    const results = await page.evaluate(async ({ step, files }) => {
      const api = window.SEBookSmalltalk;
      const runner = await api.FreshRunner.create();
      try {
        const program = api.normalizeProgram({ stepKey: step.key, files, runFile: step.run_file });
        return (await runner.runTests(step.tests, { program })).results;
      } finally { runner.dispose(); }
    }, { step, files: scenario.files });

    expect(results.map(result => result.error), 'Each authored check must execute successfully').toEqual([null, null, null]);
    expect(results.map(result => result.passed), step.tests.map(check => check.description).join('\n')).toEqual(scenario.expected);
  });
}
