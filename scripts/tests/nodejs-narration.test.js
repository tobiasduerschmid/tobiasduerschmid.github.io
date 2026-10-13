const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const yaml = require('js-yaml');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const root = path.resolve(__dirname, '../..');
const source = readFileSync(path.join(root, '_data/explainers/nodejs.yml'));
const story = yaml.load(source.toString());
const timing = JSON.parse(readFileSync(path.join(root, '_data/explainers/nodejs_timing.json')));

test('published narration and cue times match the current storyboard', () => {
  assert.equal(timing.source_sha256, createHash('sha256').update(source).digest('hex'),
    'Regenerate the audio, captions, and timing after editing the storyboard.');
  assert.equal(timing.voice, story.voice);
  assert.equal(timing.speed, story.speed);
  assert.equal(timing.scenes.length, story.scenes.length);
  let end = 0;
  timing.scenes.forEach((scene, index) => {
    assert.equal(scene.id, story.scenes[index].id);
    assert.equal(scene.start, end);
    assert.equal(scene.cues.length, story.scenes[index].cues.length);
    scene.cues.forEach((cue) => {
      assert.equal(cue.start, end);
      assert.ok(cue.end > cue.start, 'Every narrated cue has a positive duration.');
      end = cue.end;
    });
    assert.equal(scene.end, end);
  });
  assert.equal(timing.duration, end);
  const audioSize = statSync(path.join(root, story.audio)).size;
  assert.equal(path.extname(story.audio), '.mp3');
  assert.ok(audioSize > 0 && audioSize * 8 / timing.duration < 64000,
    'Published speech must stay compressed below 64 kbps, including container overhead.');
});

test('downloadable speech script and captions contain every narrated cue', () => {
  const cues = story.scenes.flatMap((scene) => scene.cues);
  const spoken = cues.map((cue) => Object.entries(story.pronunciations)
    .sort(([left], [right]) => right.length - left.length)
    .reduce((text, [written, pronunciation]) => text.split(written).join(pronunciation), cue.text));
  assert.equal(readFileSync(path.join(root, story.script), 'utf8'), `${spoken.join('\n\n')}\n`);
  const captions = readFileSync(path.join(root, story.captions), 'utf8');
  assert.ok(captions.startsWith('WEBVTT\n'));
  assert.equal((captions.match(/ --> /g) || []).length, cues.length);
  cues.forEach((cue) => assert.ok(captions.includes(cue.text)));
});

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
