const { loadStory } = require('../narration/source');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const root = path.resolve(__dirname, '../..');
const story = loadStory('nodejs');

test('worked examples actually produce the outputs the lesson teaches', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'nodejs-lesson-'));
  const snippet = (id) => story.scenes.find((scene) => scene.id === id).code;
  async function run(code) {
    writeFileSync(path.join(directory, 'example.cjs'), code);
    return promisify(execFile)(process.execPath, ['example.cjs'], { cwd: directory });
  }
  try {
    writeFileSync(path.join(directory, 'note.txt'), 'Hello from disk.');
    assert.equal((await run(snippet('syntax'))).stdout, 'Hello Sam\n');
    assert.equal((await run(snippet('blocking'))).stdout, 'Hello from disk.\nNext\n');
    const callbackDefinition = snippet('callbacks').split('\n').slice(0, -1).join('\n');
    assert.equal((await run(`${callbackDefinition}\n${snippet('nonblocking')}`)).stdout,
      'Next\nHello from disk.\n');
    assert.equal((await run(snippet('await'))).stdout, 'Hello from disk.\n');
    assert.equal((await run(snippet('predict'))).stdout, 'A\nC\nB\n');
    rmSync(path.join(directory, 'note.txt'));
    const failedRead = await run(`const fs = require('node:fs');\n${snippet('callbacks')}`);
    assert.equal(failedRead.stdout, '', 'An error must not fall through to printing text.');
    assert.match(failedRead.stderr, /ENOENT/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
