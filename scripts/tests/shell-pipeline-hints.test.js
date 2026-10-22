const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const lesson = yaml.load(fs.readFileSync(path.join(__dirname, '../../_data/tutorials/shell-pipeline.yml'), 'utf8'));
const modules = Promise.all([
  import('../../js/shell-pipeline-hints.mjs'),
  import('../../js/shell-pipeline-runtime.mjs'),
  import('../../js/shell-pipeline-grading.mjs'),
]);

for (const [behavior, source, condition, expected] of [
  ['an empty command invites a first stage', '', 'pipeline_state: empty', true],
  ['comments alone are empty', '# sort | uniq', 'pipeline_state: empty', true],
  ['an unfinished quote gets syntax advice', "grep 'oops", 'pipeline_state: syntax-error', true],
  ['a trailing pipe needs a command', 'cat x |', 'pipeline_state: syntax-error', true],
  ['actual stages retain order', 'cut -f3 input | sort | uniq -c', 'pipeline_matches: ^cut \\| sort \\| uniq$', true],
  ['comments do not add stages', 'cut -f3 input | uniq -c # sort', 'pipeline_matches: \\bsort\\b', false],
  ['quoted arguments do not add stages', 'printf "sort | uniq"', 'pipeline_matches: \\buniq\\b', false],
  ['escaped pipes are arguments', 'echo sort\\|uniq', 'pipeline_matches: \\buniq\\b', false],
  ['quoted regex alternation is not a pipe', "grep -E 'a|b' input | sort", 'pipeline_matches: ^grep \\| sort$', true],
  ['redirection targets are not stages', 'cat input > sort', 'pipeline_matches: \\bsort\\b', false],
  ['command substitutions are not outer stages', 'printf "%s" "$(sort input)" | uniq', 'pipeline_matches: \\bsort\\b', false],
  ['literal quoted command names are recognized', '"sort" input | /usr/bin/uniq -c', 'pipeline_matches: ^sort \\| uniq$', true],
  ['line continuations preserve stages', 'sort input |\\\n uniq -c', 'pipeline_matches: ^sort \\| uniq$', true],
  ['separate statements are not connected pipes', 'sort input; uniq input', 'pipeline_matches: sort.*uniq', false],
  ['conditional commands are not connected pipes', 'sort input && uniq input', 'pipeline_matches: sort.*uniq', false],
  ['dynamic command names do not invite guessed stage advice', '$COMMAND input | uniq', 'pipeline_state: unsupported', true],
  ['function definitions need generic feedback', 'sort() { cat; }; sort input | uniq', 'pipeline_state: unsupported', true],
  ['invalid authored regex does not match', 'sort input', 'pipeline_matches: [', false],
]) {
  test(behavior, async () => {
    const [{ analyzePipeline, matchesPipelineHint }, { createShell }] = await modules;
    assert.equal(matchesPipelineHint(condition, analyzePipeline(source, createShell)), expected);
  });
}

async function failedChecksWithHints(step, command) {
  const [{ analyzePipeline, matchesPipelineHint }, { createShell }, { checkSolution }] = await modules;
  const analysis = analyzePipeline(command, createShell);
  const files = Object.fromEntries(step.files.map(file => [file.path, file.content]));
  const checks = await Promise.all(step.tests.map(async test => ({
    description: test.description,
    ...await checkSolution({ command, files, check: test.shell_pipeline, createShell }),
    hints: test.hints.filter(hint => matchesPipelineHint(hint.condition, analysis)),
  })));
  return checks.filter(check => !check.passed);
}

test('Failure Reports: a grep-only attempt gets guidance for continuing from records to fields', async () => {
  const step = lesson.steps.find(step => step.key === 'failure-reports');
  const failures = await failedChecksWithHints(step, "grep -E $'^[^\\t]+\\tGET\\t' access.tsv");
  assert.ok(failures.length > 0);
  const hints = failures.flatMap(check => check.hints);
  assert.ok(hints.some(hint => hint.title === 'Continue from matching records'));
  assert.ok(!hints.some(hint => hint.title === 'Plan the selection stages'));
});

test('Failure Reports: method-only mistakes receive method feedback instead of only status advice', async () => {
  const step = lesson.steps.find(step => step.key === 'failure-reports');
  const failures = await failedChecksWithHints(step, "grep GET access.tsv | awk '$4 >= 400 { print $3 }' | sort | uniq");
  assert.deepEqual(failures.map(check => check.description), ['Only GET requests contribute']);
  assert.equal(failures[0].exitCode, 0);
  assert.equal(failures[0].stderr, '');
  assert.ok(failures[0].hints.some(hint => hint.title === 'Match the complete method field'));
});

test('Failure Reports: a status-only mistake does not trigger method-specific feedback', async () => {
  const step = lesson.steps.find(step => step.key === 'failure-reports');
  const failures = await failedChecksWithHints(step, "grep -E $'^[^\\t]+\\tGET\\t' access.tsv | awk '$4 > 400 { print $3 }' | sort | uniq");
  assert.deepEqual(failures.map(check => check.description), ['Statuses immediately below, at, and above 400']);
  assert.equal(failures[0].exitCode, 0);
  assert.equal(failures[0].stderr, '');
  assert.ok(failures[0].hints.length > 0);
  assert.ok(!failures[0].hints.some(hint => hint.title === 'Match the complete method field'));
});

test('hint analysis never executes the command', async () => {
  const [{ analyzePipeline }, { createShell }] = await modules;
  const shell = createShell({ files: {} });
  analyzePipeline('touch should-not-exist', () => shell);
  await assert.rejects(shell.readFile('/home/student/should-not-exist'));
});

for (const [key, source, present, absent] of [
  ['request-counts', 'cut -f3 access.tsv | uniq -c # sort', 'Neighbors in the stream', 'The position of each stage'],
  ['request-counts', 'cut -f3 access.tsv | uniq -c | sort', 'The position of each stage', 'Neighbors in the stream'],
  ['path-suffixes', "cut -f3 access.tsv | sed 's/html/htm/' | sort -u", 'Keep order and repeated requests', 'Transform paths, not whole records'],
  ['path-suffixes', "sed 's/html$/htm/' access.tsv | cut -f3", 'Transform paths, not whole records', 'Keep order and repeated requests'],
  ['failure-reports', "grep GET access.tsv | awk '{print $3}' | sort | uniq", 'Selection and path groups', 'Group before removing duplicates'],
  ['failure-reports', "grep GET access.tsv | awk '{print $3}' | uniq | sort", 'Group before removing duplicates', 'Complete the pipeline syntax'],
]) {
  test(`${key}: advice fits ${source}`, async () => {
    const [{ analyzePipeline, matchesPipelineHint }, { createShell }] = await modules;
    const analysis = analyzePipeline(source, createShell);
    const hints = lesson.steps.find(step => step.key === key).tests[0].hints;
    const titles = hints.filter(hint => matchesPipelineHint(hint.condition, analysis)).map(hint => hint.title);
    assert.ok(titles.includes(present), `Missing advice: ${present}`);
    assert.ok(!titles.includes(absent), `Irrelevant advice: ${absent}`);
  });
}
