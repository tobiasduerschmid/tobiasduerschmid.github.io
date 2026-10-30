const { loadStory } = require('../narration/source');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const root = path.resolve(__dirname, '../..');

test('Observer provides all four languages with a complete worked UI example', () => {
  const sourcePath = path.join(root, '_data/explainers/observer_code.yml');
  assert.ok(existsSync(sourcePath), 'The four-language Observer example must be authored.');
  const examples = yaml.load(readFileSync(sourcePath, 'utf8'));
  assert.deepEqual(Object.keys(examples).sort(), ['cpp', 'java', 'python', 'typescript']);
  for (const [language, example] of Object.entries(examples)) {
    for (const name of ['problem', 'observer', 'subject', 'document', 'views', 'wire']) {
      assert.ok(example.blocks[name].source.trim(), `${language}: ${name} must contain code`);
      const lines = example.blocks[name].source.trimEnd().split('\n');
      for (const focus of Object.values(example.blocks[name].focus)) {
        assert.ok(focus.length > 0);
        for (const line of focus) assert.ok(line >= 1 && line <= lines.length, `${language}: focus must name real lines`);
      }
    }
  }
});

const { statSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const story = loadStory('observer');
const examples = yaml.load(readFileSync(path.join(root, '_data/explainers/observer_code.yml'), 'utf8'));
const quizzes = yaml.load(readFileSync(path.join(root, '_data/explainers/observer_quizzes.yml'), 'utf8'));
const timing = require('../../_data/explainers/observer_timing.json');

test('every section has one question, the summary covers every part, and every cue has valid focus', () => {
  assert.deepEqual(Object.keys(quizzes), story.scenes.map(scene => scene.id));
  // The last section's summary quiz checks context, problem, solution, and consequences.
  assert.ok(quizzes[story.scenes.at(-1).id].questions.length >= 4);
  story.scenes.forEach(scene => {
    const check = quizzes[scene.id];
    for (const question of check.questions || [check]) {
      assert.equal(typeof question.question, 'string');
      assert.ok(question.options.length >= 2);
      assert.ok(Number.isInteger(question.correct_index));
      assert.ok(question.correct_index >= 0 && question.correct_index < question.options.length);
      assert.ok(question.explanation.trim());
    }
    for (const cue of scene.cues) {
      if (!cue.focus) continue;
      for (const language of story.languages) {
        assert.ok(examples[language].blocks[scene.code].focus[cue.focus], `${language}/${scene.id}/${cue.focus}`);
      }
    }
  });
});

test('Observer speech, captions and timing are generated from the published storyboard', () => {
  assert.equal(timing.speech_sha256, story.speech_sha256);
  let end = 0;
  assert.equal(timing.scenes.length, story.scenes.length);
  timing.scenes.forEach((scene, index) => {
    assert.equal(scene.id, story.scenes[index].id);
    assert.equal(scene.start, end);
    assert.equal(scene.cues.length, story.scenes[index].cues.length);
    scene.cues.forEach(cue => { assert.equal(cue.start, end); assert.ok(cue.end > end); end = cue.end; });
    assert.equal(scene.end, end);
  });
  assert.equal(timing.duration, end);
  const cues = story.scenes.flatMap(scene => scene.cues);
  const captions = readFileSync(path.join(root, story.captions), 'utf8');
  assert.ok(captions.startsWith('WEBVTT\n'));
  assert.equal((captions.match(/ --> /g) || []).length, cues.length);
  cues.forEach(cue => assert.ok(captions.includes(cue.text)));
  const spoken = cues.map(cue => Object.entries(story.pronunciations)
    .reduce((text, [written, pronunciation]) => text.split(written).join(pronunciation), cue.text));
  assert.equal(readFileSync(path.join(root, story.script), 'utf8'), spoken.join('\n\n') + '\n');
  const size = statSync(path.join(root, story.audio)).size;
  assert.ok(size > 0 && size * 8 / timing.duration < 64000);
});

// Exercise public UI state, including the empty/nonempty boundary and detached view.
// Compilers are optional for a developer's local unit run; CI/release verification
// should supply all four runtimes. TypeScript stripping does not replace tsc.
for (const language of story.languages) {
  test(`${examples[language].label} examples implement the narrated UI behavior`, t => {
    const tool = { python: 'python3', java: 'javac', cpp: 'clang++', typescript: process.execPath }[language];
    if (spawnSync(tool, [language === 'java' ? '-version' : '--version']).status !== 0) {
      t.skip(`${tool} is required to execute this language`); return;
    }
    const directory = mkdtempSync(path.join(tmpdir(), 'observer-example-'));
    const example = examples[language];
    const declarations = example.imports + '\n' + story.example_order.filter(key => key !== 'wire')
      .map(key => example.blocks[key].source).join('\n');
    const run = (source, filename = example.filename) => {
      writeFileSync(path.join(directory, filename), source);
      const opts = { cwd: directory, encoding: 'utf8', timeout: 30000 };
      if (language === 'python') return execFileSync(tool, [filename], opts);
      if (language === 'typescript') return execFileSync(tool, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', filename], opts);
      if (language === 'java') { execFileSync('javac', [filename], opts); return execFileSync('java', [filename.replace('.java', '')], opts); }
      execFileSync(tool, ['-std=c++17', '-Wall', '-Wextra', '-pedantic', filename, '-o', 'example'], opts);
      return execFileSync(path.join(directory, 'example'), [], opts);
    };
    try {
      run(declarations + '\n' + example.blocks.wire.source);
      let harness;
      if (language === 'python') harness = `
document = Document()
preview, count, save = Preview(), CharacterCount(), SaveButton()
for observer in (preview, count, save): document.attach(observer)
def snapshot(): print(document.text, preview.text, count.text, str(save.enabled).lower(), sep='|')
snapshot()
document.set_text('Hi')
snapshot()
document.detach(preview)
document.set_text('Hello')
snapshot()
document.set_text('')
snapshot()
`;
      if (language === 'typescript') harness = `
const document = new Document();
const preview = new Preview(), count = new CharacterCount(), save = new SaveButton();
for (const observer of [preview, count, save]) document.attach(observer);
function snapshot() { console.log([document.text, preview.text, count.text, save.enabled].join('|')); }
snapshot(); document.setText('Hi'); snapshot(); document.detach(preview);
document.setText('Hello'); snapshot(); document.setText(''); snapshot();
`;
      if (language === 'java') harness = `
public class ObserverDemo {
  static void snapshot(Document d, Preview p, CharacterCount c, SaveButton s) {
    System.out.println(d.text + "|" + p.text + "|" + c.text + "|" + s.enabled);
  }
  public static void main(String[] args) {
    Document d = new Document(); Preview p = new Preview(); CharacterCount c = new CharacterCount(); SaveButton s = new SaveButton();
    d.attach(p); d.attach(c); d.attach(s); snapshot(d,p,c,s);
    d.setText("Hi"); snapshot(d,p,c,s); d.detach(p);
    d.setText("Hello"); snapshot(d,p,c,s); d.setText(""); snapshot(d,p,c,s);
  }
}
`;
      if (language === 'cpp') harness = `
#include <iostream>
int main() {
  Document d; Preview p; CharacterCount c; SaveButton s;
  d.attach(p); d.attach(c); d.attach(s);
  auto snapshot = [&] { std::cout << d.text << '|' << p.text << '|' << c.text << '|' << std::boolalpha << s.enabled << '\\n'; };
  snapshot(); d.setText("Hi"); snapshot(); d.detach(p);
  d.setText("Hello"); snapshot(); d.setText(""); snapshot();
  d.detach(c); d.detach(s);
}
`;
      assert.equal(run(declarations + '\n' + example.blocks.problem.source + harness),
        '||0|false\nHi|Hi|2|true\nHello|Hi|5|true\n|Hi|0|false\n');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}
