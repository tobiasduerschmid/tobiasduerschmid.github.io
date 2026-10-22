const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const tutorial = yaml.load(fs.readFileSync(path.join(__dirname, '../../_data/tutorials/shell-pipeline.yml'), 'utf8'));
const modules = Promise.all([
  import('../../js/shell-pipeline-runtime.mjs'),
  import('../../js/shell-pipeline-grading.mjs'),
]);

async function evaluate(step, command) {
  const [{ createShell }, { checkSolution }] = await modules;
  const files = Object.fromEntries(step.files.map(file => [file.path, file.content]));
  return Promise.all(step.tests.map(async fixture => ({
    description: fixture.description,
    ...await checkSolution({ command, files, check: fixture.shell_pipeline, createShell }),
  })));
}

for (const step of tutorial.steps) {
  test(`${step.title}: the model solution satisfies every authored fixture`, async () => {
    for (const result of await evaluate(step, step.solution.command)) {
      assert.equal(result.passed, true, `${result.description}: ${result.diagnostic}`);
    }
  });
}

// These use different command structures from the authored answers: grading
// must judge the report, not the presence or position of particular commands.
const alternatives = [
  ['request-counts', "awk '{ count[$3]++ } END { for (path in count) print count[path], path }' access.tsv | sort -k2"],
  ['path-suffixes', "awk '{ sub(/\\.html$/, \".htm\", $3); print $3 }' access.tsv"],
  ['failure-reports', "awk '$2 == \"GET\" && $4 >= 400 { count[$3]++ } END { for (path in count) print path }' access.tsv | sort"],
];
for (const [key, command] of alternatives) {
  const step = tutorial.steps.find(candidate => candidate.key === key);
  test(`${step.title}: an equivalent implementation passes every fixture`, async () => {
    for (const result of await evaluate(step, command)) {
      assert.equal(result.passed, true, `${result.description}: ${result.diagnostic}`);
    }
  });
}

const mistakes = [
  ['request-counts', 'counting only adjacent duplicates', 'cut -f3 access.tsv | uniq -c'],
  ['request-counts', 'reversing the required path order', 'cut -f3 access.tsv | sort -r | uniq -c'],
  ['request-counts', 'removing requests before counting', 'cut -f3 access.tsv | sort -u | uniq -c'],
  ['path-suffixes', 'replacing internal occurrences of the suffix', "cut -f3 access.tsv | sed 's/\\.html/.htm/g'"],
  ['path-suffixes', 'treating the suffix dot as a wildcard', "cut -f3 access.tsv | sed 's/.html$/.htm/'"],
  ['path-suffixes', 'sorting and removing repeated paths', "cut -f3 access.tsv | sed 's/\\.html$/.htm/' | sort -u"],
  ['failure-reports', 'combining method and status with OR', "awk '$2 == \"GET\" || $4 >= 400 {print $3}' access.tsv | sort | uniq"],
  ['failure-reports', 'excluding the status boundary', "awk '$2 == \"GET\" && $4 > 400 {print $3}' access.tsv | sort | uniq"],
  ['failure-reports', 'matching a method substring', "awk '$2 ~ /GET/ && $4 >= 400 {print $3}' access.tsv | sort | uniq"],
  ['failure-reports', 'matching GET outside the method field', "awk '/GET/ && $4 >= 400 {print $3}' access.tsv | sort | uniq"],
  ['failure-reports', 'finding status digits instead of comparing numbers', "awk '$2 == \"GET\" && $4 ~ /[45]/ {print $3}' access.tsv | sort | uniq"],
  ['failure-reports', 'inventing an upper status limit', "awk '$2 == \"GET\" && $4 >= 400 && $4 <= 599 {print $3}' access.tsv | sort | uniq"],
  ['failure-reports', 'leaving duplicate paths in the report', "awk '$2 == \"GET\" && $4 >= 400 {print $3}' access.tsv | sort"],
  ['failure-reports', 'reversing alphabetical path order', "awk '$2 == \"GET\" && $4 >= 400 { count[$3]++ } END { for (path in count) print path }' access.tsv | sort -r"],
];
for (const [key, mistake, command] of mistakes) {
  const step = tutorial.steps.find(candidate => candidate.key === key);
  test(`${step.title}: the fixtures reject ${mistake}`, async () => {
    const results = await evaluate(step, command);
    // A syntax/runtime error is not evidence that the fixtures distinguish
    // the intended misconception from a correct solution.
    for (const result of results) {
      assert.equal(result.exitCode, 0, `${result.description}: ${result.diagnostic}`);
      assert.equal(result.stderr, '', result.description);
      assert.equal(result.sourceUnchanged, true, result.description);
    }
    assert.ok(results.some(result => !result.passed), `All fixtures accepted: ${command}`);
  });
}
