const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const lessons = yaml.load(read('_data/narrated_patterns.yml'));

// Authors and book titles that narrations draw on. Book titles are matched
// with their capitals so that "design patterns" as a concept stays allowed.
const NAMED_SOURCE = /Gang of Four|\bGoF\b|Gamma|Buschmann|Pattern-Oriented Software Architecture|\bPOSA\b|Head First|Freeman|Kerievsky|Refactoring to Patterns|Reenskaug|Krasner|Burbeck|Fowler|Nystrom|\bthe book\b/;

for (const topic of Object.keys(lessons)) {
  test(`${topic}: sources are shown on screen, never spoken`, () => {
    const story = yaml.load(read(`_data/explainers/${topic}.yml`));
    for (const scene of story.scenes) {
      scene.cues.forEach((cue, index) => {
        assert.doesNotMatch(cue.text, NAMED_SOURCE, `${scene.id}#${index}: move the source to cue.source`);
        if ('source' in cue) assert.ok(typeof cue.source === 'string' && cue.source.trim(), `${scene.id}#${index}: empty source`);
      });
    }
  });
}
