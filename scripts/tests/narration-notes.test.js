const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const yaml = require('js-yaml');
const { ROOT, lessonIds, loadLesson } = require('../narration/source');

test('authored note bullets retain literal prefixes and inline Markdown without creating nested blocks', () => {
  const points = [
    '1. **Start** `watch()` with *care*; [read the lesson](/lesson/).',
    '2. Keep this step number.',
    '# This is a point, not a heading.',
    '> Compare a < b & c > d.',
  ];
  const html = execFileSync('bundle', ['exec', 'ruby', '-e', `
    require 'jekyll'
    require 'json'
    site = Jekyll::Site.new(Jekyll.configuration('quiet' => true, 'disable_disk_cache' => true))
    site.data = {
      'narration_lessons' => { 'demo' => { 'kind' => 'case-study', 'lesson' => { 'name' => 'Demo' } } },
      'explainers' => {
        'demo' => { 'title' => 'Demo', 'scenes' => [
          { 'id' => 'scene', 'label' => 'Scene', 'cues' => [
            { 'id' => 'cue', 'step' => 'Inspect the evidence', 'visual' => 'The evidence.' }
          ] }
        ] },
        'demo_notes' => { 'scene-cue' => JSON.parse(STDIN.read) }
      }
    }
    template = Liquid::Template.parse('{% include narration-notes.html topic="demo" %}')
    print template.render!({ 'site' => site.site_payload['site'] }, registers: { site: site })
  `], { cwd: ROOT, input: JSON.stringify(points), encoding: 'utf8' });
  const list = html.match(/<div class="vn-note-points">\s*<ul>([\s\S]*?)<\/ul>/)?.[1];
  assert.ok(list, 'the handout renders its authored points as a list');
  assert.doesNotMatch(list, /<(?:ol|ul|h[1-6]|blockquote|pre)\b/, 'one authored point remains one inline list item');
  const items = [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(match => match[1]);
  const text = html => html.replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
  assert.deepEqual(items.map(text), [
    '1. Start watch() with care; read the lesson.',
    '2. Keep this step number.',
    '# This is a point, not a heading.',
    '> Compare a < b & c > d.',
  ]);
  assert.match(items[0], /<strong>Start<\/strong>/);
  assert.match(items[0], /<code\b[^>]*>watch\(\)<\/code>/);
  assert.match(items[0], /<em>care<\/em>/);
  assert.match(items[0], /<a\b[^>]*href="\/lesson\/"[^>]*>read the lesson<\/a>/);
});

const words = text => text.toLowerCase().replace(/\*\*/g, '').replace(/['’]/g, '').split(/[^a-z0-9%]+/).filter(Boolean);
function copiedRun(point, speech) {
  let longest = 0;
  for (let start = 0; start < point.length; start += 1) {
    for (let from = 0; from < speech.length; from += 1) {
      let length = 0;
      while (start + length < point.length && point[start + length] === speech[from + length]) length += 1;
      longest = Math.max(longest, length);
    }
  }
  return longest;
}

for (const topic of lessonIds()) {
  test(`${topic}: the PDF handout has concise, authored notes for every cue`, () => {
    const { story } = loadLesson(topic);
    const notes = yaml.load(readFileSync(path.join(ROOT, `_data/explainers/${topic}_notes.yml`), 'utf8'));
    const used = [];
    let noteWords = 0;
    let speechWords = 0;
    for (const scene of story.scenes) {
      scene.cues.forEach((cue, index) => {
        const stableKey = `${scene.id}-${cue.id}`;
        const legacyKey = `${scene.id}-${index + 1}`;
        const key = Object.hasOwn(notes, stableKey) ? stableKey : legacyKey;
        const points = notes[key];
        used.push(key);
        assert.ok(Array.isArray(points), `${topic}/${stableKey}: missing notes`);
        assert.ok(points.length >= 1 && points.length <= 4, `${key}: expected one to four key points`);
        const speech = words(cue.text);
        speechWords += speech.length;
        for (const point of points) {
          assert.equal(typeof point, 'string', `${key}: bullet must be text`);
          const pointWords = words(point);
          assert.ok(pointWords.length > 0 && pointWords.length <= 16, `${key}: bullet must contain 1–16 words: ${point}`);
          assert.ok(copiedRun(pointWords, speech) < 8, `${key}: bullet copies eight consecutive spoken words: ${point}`);
          noteWords += pointWords.length;
        }
      });
    }
    assert.deepEqual(Object.keys(notes).sort(), used.sort(), `${topic}: orphaned or missing cue notes`);
    assert.ok(noteWords <= speechWords / 2, `${topic}: ${noteWords} note words exceed half of ${speechWords} spoken words`);
  });
}
