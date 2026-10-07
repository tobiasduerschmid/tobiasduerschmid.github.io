const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const root = path.resolve(__dirname, '../..');
const deck = id => yaml.load(fs.readFileSync(path.join(root, '_data/quizzes', id + '.yml'), 'utf8'));
const normalize = value => value.trim().replace(/\s+/g, ' ');

for (const id of ['python_output', 'shell_output']) {
  for (const question of deck(id).questions) {
    test(`${id}/${question.id}: the real program prints the short authored answer`, () => {
      assert.equal(question.type, 'write-in');
      assert.match(question.answer, /^[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$/);
      assert.ok(question.answer.length <= 7, 'practice answers stay quick to type');
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sebook-output-'));
      try {
        const python = question.program.language === 'python';
        const result = spawnSync(python ? 'python3' : '/bin/sh',
          [...(python ? ['-I'] : []), '-c', question.program.code],
          { cwd: directory, encoding: 'utf8', timeout: 5000, env: { ...process.env, LC_ALL: 'C' } });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stderr, '');
        assert.equal(normalize(result.stdout), question.answer);
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });
  }
}

test('the course master decks include the requested output decks', () => {
  assert.ok(deck('CS35_current').decks.includes('python_output'));
  assert.ok(deck('CS131_master').decks.includes('python_output'));
  assert.ok(deck('CS35_current').decks.includes('shell_output'));
});
