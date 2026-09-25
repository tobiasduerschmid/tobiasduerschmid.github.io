const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const yaml = require('js-yaml');

test('Python tutorial graders accept correct alternatives and reject contract violations', async t => {
  const tutorialPath = path.resolve(__dirname, '../../_data/tutorials/python.yml');
  const config = yaml.load(fs.readFileSync(tutorialPath, 'utf8'));
  const runnerPath = path.join(__dirname, 'helpers/python-tutorial-checks.py');
  const result = spawnSync('python3', [runnerPath], {
    input: JSON.stringify(config),
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const results = JSON.parse(result.stdout);
  assert.ok(results.length > 0, 'The runner must execute candidate submissions');
  for (const candidate of results) {
    await t.test(candidate.name, () => {
      const details = JSON.stringify(candidate.failures, null, 2);
      if (candidate.expected === 'accept') {
        assert.deepEqual(candidate.failures, [], details);
      } else {
        assert.equal(candidate.expected, 'reject', 'Every case must declare an explicit outcome');
        assert.ok(candidate.failures.length > 0, 'Incorrect submission passed every authored check');
        for (const failure of candidate.failures) {
          assert.equal(failure.type, candidate.rejectionType,
            `An incidental execution error cannot count as detecting the intended mistake: ${details}`);
        }
      }
    });
  }
});
