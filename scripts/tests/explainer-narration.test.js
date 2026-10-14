const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const yaml = require('js-yaml');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '../..');
for (const topic of ['nodejs', 'react']) {
  const source = readFileSync(path.join(root, `_data/explainers/${topic}.yml`));
  const story = yaml.load(source.toString());
  const timing = JSON.parse(readFileSync(path.join(root, `_data/explainers/${topic}_timing.json`)));

  test(`${topic}: published speech and cue times match the storyboard`, () => {
    assert.equal(timing.source_sha256, createHash('sha256').update(source).digest('hex'),
      'Regenerate audio, captions, and timing after editing the storyboard.');
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
        assert.ok(cue.end > cue.start);
        end = cue.end;
      });
      assert.equal(scene.end, end);
    });
    assert.equal(timing.duration, end);
    const size = statSync(path.join(root, story.audio)).size;
    assert.equal(path.extname(story.audio), '.mp3');
    assert.ok(size > 0 && size * 8 / timing.duration < 64000,
      'Published speech must stay below 64 kbps, including container overhead.');
  });

  test(`${topic}: downloadable speech and captions include every cue`, () => {
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

  test(`${topic}: examples parse and all focus lines exist in the displayed variant`, () => {
    for (const scene of story.scenes) {
      for (const key of ['code', 'alternate_code']) {
        const filename = key === 'alternate_code' ? scene.alternate_filename || scene.filename : scene.filename;
        if (scene[key] && filename !== 'terminal') {
          parser.parse(scene[key], { sourceType: 'unambiguous', plugins: ['jsx'] });
        }
      }
      for (const cue of scene.cues) {
        const alternate = cue.variant === 'alternate' || ['inline', 'import'].includes(cue.pose);
        const code = alternate ? scene.alternate_code : scene.code;
        for (const line of cue.focus || []) {
          assert.ok(line >= 1 && line <= code.split('\n').length, `${scene.id}/${cue.pose}: missing line ${line}`);
        }
      }
    }
  });
}
