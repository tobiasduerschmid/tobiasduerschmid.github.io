const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const yaml = require('js-yaml');

test('Python debugging checks accept equivalent repairs and reject misleading workarounds', async t => {
  const tutorialPath = path.resolve(__dirname, '../../_data/tutorials/python-debugging.yml');
  const config = yaml.load(fs.readFileSync(tutorialPath, 'utf8'));
  const result = spawnSync('python3', [path.join(__dirname, 'helpers/python-debugging-checks.py')], {
    input: JSON.stringify(config),
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const candidates = JSON.parse(result.stdout);
  assert.ok(candidates.length > 0, 'Exercise the authored checks against actual submissions');
  for (const candidate of candidates) {
    await t.test(candidate.name, () => {
      const details = JSON.stringify(candidate.failures, null, 2);
      if (candidate.expected === 'accept') {
        assert.deepEqual(candidate.failures, [], details);
      } else {
        assert.ok(candidate.failures.length > 0, 'Incorrect submission passed every authored check');
        for (const failure of candidate.failures) {
          assert.equal(failure.type, 'AssertionError', `Detect the violated contract, not an incidental execution error: ${details}`);
        }
        if (candidate.expected === 'partial') {
          assert.ok(candidate.passed > 0, 'Completed criteria must pass independently');
        } else {
          assert.equal(candidate.expected, 'reject');
        }
      }
    });
  }
});
