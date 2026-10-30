const { loadStory, loadLesson } = require('../narration/source');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const topic = 'uml_class_diagram';
const story = loadStory(topic);
const { lesson } = loadLesson(topic);
const examples = yaml.load(read(`_data/explainers/${topic}_code.yml`));
const quizzes = yaml.load(read(`_data/explainers/${topic}_quizzes.yml`));
const timing = JSON.parse(read(`_data/explainers/${topic}_timing.json`));

// The classes of the chat app's program. Role exists only in the transfer task.
const PROGRAM_CLASSES = ['Mentionable', 'Member', 'Message', 'Channel', 'TextChannel', 'VoiceChannel', 'Invite', 'Category', 'Server'];
const cueDiagram = (scene, cue) => cue.diagram || scene.diagram;

/** Class boxes declared in an ArchUML class diagram, with their members. */
function classBoxes(source) {
  const boxes = {};
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index].match(/^(abstract class|class|interface) (\w+)(?: #\S+(?: \w+)?)?( \{)?$/);
    if (!header) continue;
    const box = { kind: header[1], members: [] };
    if (header[3]) {
      for (index += 1; lines[index] !== '}'; index += 1) {
        const member = lines[index].trim().match(/^([+\-#~])?\s*(?:\{abstract\}\s*)?(\w+)(\()?/);
        box.members.push({ visibility: member[1] || '', name: member[2], operation: Boolean(member[3]) });
      }
    }
    boxes[header[2]] = box;
  }
  return boxes;
}

test('the lesson is a class-diagram roadmap with a check after every section', () => {
  assert.deepEqual(lesson.parts, ['Classes', 'Generalization', 'Associations', 'Dependencies']);
  const used = story.scenes.filter(scene => scene.part).map(scene => scene.part);
  assert.deepEqual([...new Set(used)], lesson.parts, 'every part has scenes, in roadmap order');
  for (const scene of story.scenes.filter(scene => scene.part)) {
    assert.ok(lesson.outline_labels[scene.id], `${scene.id}: a short navigation label`);
  }
  assert.deepEqual(Object.keys(quizzes), story.scenes.map(scene => scene.id));
  const summary = quizzes[story.scenes.at(-1).id];
  assert.ok(summary.questions.length >= 5, 'the summary quiz covers every part');
  const keys = [];
  for (const [id, check] of Object.entries(quizzes)) {
    for (const question of check.questions || [check]) {
      assert.match(question.question, /UML|class diagram/, `${id}: the stem names the notation`);
      assert.ok(question.options.length >= 3 && question.explanation.trim());
      assert.ok(Number.isInteger(question.correct_index) && question.options[question.correct_index]);
      for (const index of Object.keys(question.option_feedback || {})) {
        assert.notEqual(Number(index), question.correct_index, `${id}: feedback on the key never fires`);
      }
      keys.push(question.correct_index);
    }
  }
  for (const index of [0, 1, 2]) assert.ok(keys.filter(key => key === index).length >= 4, 'keys rotate across positions');
});

test('every cue marks real code lines and real diagram classes', () => {
  for (const scene of story.scenes) {
    for (const cue of scene.cues) {
      if (cue.focus) {
        assert.ok(scene.code, `${scene.id}/${cue.id}: code focus without code`);
        for (const language of story.languages) {
          assert.ok(examples[language].blocks[scene.code].focus[cue.focus], `${language}/${scene.id}/${cue.focus}`);
        }
      }
      const name = cueDiagram(scene, cue);
      if (!scene.cards) assert.ok(story.diagrams[name], `${scene.id}/${cue.id}: diagram ${name}`);
      if (cue.diagram_focus) {
        const declared = new RegExp(`^(abstract class|class|interface) ${cue.diagram_focus}\\b`, 'm');
        assert.match(story.diagrams[name].source, declared, `${scene.id}/${cue.id}: ${cue.diagram_focus} is declared`);
      }
    }
  }
});

test('every diagram is labeled, described, and uses only classes of the model', () => {
  const referenced = new Set(story.scenes.flatMap(scene => scene.cues.map(cue => cueDiagram(scene, cue))).filter(Boolean));
  assert.deepEqual([...referenced].sort(), Object.keys(story.diagrams).sort(), 'no unused or missing diagram');
  for (const [name, diagram] of Object.entries(story.diagrams)) {
    assert.ok(diagram.label && diagram.description && diagram.caption, `${name}: label, description, caption`);
    assert.match(diagram.source, /^@startuml\n[\s\S]*\n@enduml\n$/, `${name}: one ArchUML block`);
    if (diagram.type === 'freeform') continue;
    const boxes = classBoxes(diagram.source);
    for (const className of Object.keys(boxes)) {
      assert.ok([...PROGRAM_CLASSES, 'Role'].includes(className), `${name}: unknown class ${className}`);
    }
    for (const line of diagram.source.split('\n').filter(text => /(--|\.\.)/.test(text) && !text.startsWith('callout'))) {
      for (const className of line.match(/^(\w+)|(\w+)(?: :.*)?$/g) || []) {
        const bare = className.replace(/ :.*$/, '');
        if (/^[A-Z]/.test(bare)) assert.ok(boxes[bare], `${name}: ${bare} is drawn before it is linked`);
      }
    }
  }
});

// Words a diagram shows must exist in every language's code with the same visibility.
const snake = name => name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
function memberIn(language, source, member) {
  const { name, visibility, operation } = member;
  if (language === 'python') {
    const python = snake(name);
    if (operation) return new RegExp(`def ${python}\\(`).test(source) && visibility !== '-';
    const prefix = { '-': '__', '#': '_', '+': '' }[visibility];
    return new RegExp(`self\\.${prefix}${python}\\b`).test(source);
  }
  if (language === 'cpp') {
    const field = operation ? `\\b${name}\\(` : `\\b${name}(?:\\{| *;)`;
    const sections = source.split(/^(public|protected|private):$/m);
    const label = { '+': 'public', '#': 'protected', '-': 'private' }[visibility];
    return sections.some((text, index) => sections[index - 1] === label && new RegExp(field).test(text))
      || (operation && new RegExp(`virtual .*\\b${name}\\(`).test(source));
  }
  const keyword = { '-': 'private', '#': 'protected', '+': language === 'java' ? 'public' : '' }[visibility];
  if (operation) {
    return language === 'java'
      ? new RegExp(`(?:public|abstract)[\\w<> ]* ${name}\\(`).test(source) || new RegExp(`^\\s+String ${name}\\(\\);`, 'm').test(source)
      : new RegExp(`^\\s+(?:abstract )?${name}\\(`, 'm').test(source);
  }
  return new RegExp(`${keyword}(?: final| readonly)?[\\w<>\\[\\] ]* ${name}\\b`).test(source)
    || new RegExp(`${keyword}(?: readonly)? ${name}\\b`).test(source);
}

// The source of one top-level class or interface: Python ends it at the next
// unindented line; the brace languages at the first closing brace in column one.
function classSource(language, source, className) {
  const lines = source.split('\n');
  const header = language === 'python'
    ? new RegExp(`^class ${className}\\b`)
    : new RegExp(`^(?:abstract )?(?:class|interface) ${className}\\b`);
  const start = lines.findIndex(line => header.test(line));
  assert.ok(start >= 0, `${language}: class ${className} exists`);
  const end = lines.findIndex((line, index) => index > start
    && (language === 'python' ? /^\S/.test(line) : /^\};?$/.test(line)));
  return lines.slice(start, end < 0 ? undefined : end + 1).join('\n');
}

test('class boxes match the code in all four languages', () => {
  for (const [name, diagram] of Object.entries(story.diagrams)) {
    if (diagram.type === 'freeform') continue;
    for (const [className, box] of Object.entries(classBoxes(diagram.source))) {
      if (className === 'Role') continue;
      for (const member of box.members.filter(entry => entry.visibility)) {
        for (const language of story.languages) {
          const program = story.example_order.map(block => examples[language].blocks[block].source).join('\n');
          const source = classSource(language, program, className);
          assert.ok(memberIn(language, source, member), `${name}/${className}: ${member.visibility}${member.name} in ${language}`);
        }
      }
    }
  }
});

test('code blocks exist in all four languages and their marks name real lines', () => {
  assert.deepEqual(Object.keys(examples).sort(), ['cpp', 'java', 'python', 'typescript']);
  for (const [language, example] of Object.entries(examples)) {
    assert.deepEqual(Object.keys(example.blocks).sort(), [...story.example_order].sort());
    for (const [name, block] of Object.entries(example.blocks)) {
      const lines = block.source.trimEnd().split('\n');
      for (const marks of Object.values(block.focus)) {
        assert.ok(marks.length > 0);
        for (const line of marks) assert.ok(line >= 1 && line <= lines.length, `${language}/${name}: line ${line}`);
      }
    }
  }
});

// Each mark must land on the code its cue talks about, in every language.
const MARKED_WORDS = {
  message: { header: ['Message'], fields: ['text', 'author'], operations: ['edit', 'preview'], visibility: ['text', 'edit'],
    spelling: [/private|__/], constructor: [/__init__|Message\(|constructor/], author: ['author'], navigate: ['mention'] },
  mentionable: { interface: ['Mentionable', 'mention'], realize: ['Member', 'Mentionable'], implement: ['"@"'] },
  channels: { kinds: ['Channel', 'TextChannel', 'VoiceChannel'], triangle: ['TextChannel', 'VoiceChannel', 'rename'],
    abstract: ['Channel', 'name', 'summary'], substitution: ['summary', 'topic', 'talking'] },
  server: { owned: ['Channel', 'owned'], evidence: ['owned'], grouped: ['grouped', /[Cc]ategor/],
    ownership: ['grouped, not owned', 'owned: deleted with the server', /[Cc]ategor/], join: ['join', 'redeem', 'member'],
    param: ['Invite', 'redeem'], members: ['owner', 'member'] },
};

test('every code mark lands on the lines its cue describes', () => {
  for (const language of story.languages) {
    for (const [block, marks] of Object.entries(MARKED_WORDS)) {
      const { source, focus } = examples[language].blocks[block];
      assert.deepEqual(Object.keys(focus).sort(), Object.keys(marks).sort(), `${language}/${block}: marks`);
      const lines = source.split('\n');
      for (const [mark, words] of Object.entries(marks)) {
        const marked = focus[mark].map(line => lines[line - 1]).join('\n');
        for (const word of words) assert.match(marked, word instanceof RegExp ? word : new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${language}/${block}/${mark}`);
      }
    }
  }
});

// The code follows the narration: a cue that speaks while code is on screen
// marks the lines it discusses, and its description says what is marked.
test('every cue in a code scene marks the code it discusses', () => {
  for (const scene of story.scenes.filter(candidate => candidate.code)) {
    for (const cue of scene.cues) {
      assert.ok(cue.focus, `${scene.id}/${cue.id}: no code is marked`);
      assert.match(cue.visual, /\bcode\b/, `${scene.id}/${cue.id}: describe the marked code`);
    }
  }
});

// The player's code window shows about ten lines (24em of 2.15em lines). The
// tests/ spec checks the real window; this keeps the data honest without one.
const CODE_WINDOW_LINES = 10;

test('marks too far apart for the code window name the marked line to show', () => {
  for (const language of story.languages) {
    for (const [name, block] of Object.entries(examples[language].blocks)) {
      const scroll = block.scroll || {};
      for (const [mark, line] of Object.entries(scroll)) {
        assert.ok(block.focus[mark]?.includes(line), `${language}/${name}/${mark}: scroll line ${line} is one of the marks`);
      }
      for (const [mark, lines] of Object.entries(block.focus)) {
        const span = Math.max(...lines) - Math.min(...lines) + 1;
        if (span > CODE_WINDOW_LINES) assert.ok(Object.hasOwn(scroll, mark), `${language}/${name}/${mark}: marks span ${span} lines; name the line to show`);
      }
    }
  }
});

test('speech never names a source, and each section ends before its check', () => {
  const NAMED = /Rumbaugh|Jacobson|Booch|Clements|Ambler|Fowler|\bOMG\b|Object Management Group|Documenting Software|Reference Manual|\bthe book\b|\bSEBook\b/;
  for (const scene of story.scenes) {
    for (const cue of scene.cues) assert.doesNotMatch(cue.text, NAMED, `${scene.id}/${cue.id}: move the source to cue.source`);
    assert.ok(scene.cues.at(-1).pause_after >= 2.5, `${scene.id}: at least 2.5 s to look before the check`);
    for (const cue of scene.cues.filter(entry => entry.prediction)) {
      assert.ok(cue.pause_after >= 4, `${scene.id}/${cue.id}: time to think`);
      assert.notEqual(cue, scene.cues.at(-1), `${scene.id}: a prediction is answered before the check`);
    }
  }
});

test('speech, captions, and timing are generated from the published script', () => {
  assert.equal(timing.speech_sha256, story.speech_sha256,
    'Regenerate audio, captions, and timing after editing the speech.');
  assert.equal(timing.scenes.length, story.scenes.length);
  let end = 0;
  timing.scenes.forEach((scene, index) => {
    assert.equal(scene.id, story.scenes[index].id);
    assert.equal(scene.cues.length, story.scenes[index].cues.length);
    scene.cues.forEach(cue => { assert.equal(cue.start, end); assert.ok(cue.end > end); end = cue.end; });
  });
  assert.equal(timing.duration, end);
  const cues = story.scenes.flatMap(scene => scene.cues);
  const captions = read(story.captions);
  assert.equal((captions.match(/ --> /g) || []).length, cues.length);
  cues.forEach(cue => assert.ok(captions.includes(cue.text)));
  const spoken = cues.map(cue => Object.entries(story.pronunciations)
    .sort(([left], [right]) => right.length - left.length)
    .reduce((text, [written, pronunciation]) => text.split(written).join(pronunciation), cue.text));
  assert.equal(read(story.script), `${spoken.join('\n\n')}\n`);
  const size = statSync(path.join(root, story.audio)).size;
  assert.ok(size > 0 && size * 8 / timing.duration < 64000);
});

test('the player stops in each section-ending silence with at least two seconds to look', () => {
  // js/narrated-explainer.js opens a check 0.3 s before the section boundary.
  for (const scene of timing.scenes) {
    const last = scene.cues.at(-1);
    assert.ok(last.end - last.speech_end - 0.3 >= 2, `${scene.id}: ${last.end - last.speech_end} s of silence`);
  }
});

// The same scenario in every language: post, preview, join, connect, delete a
// category (its channels stay), rename (the message follows its author link),
// and redeem a used-up invite.
const EXPECTED = [
  '@ana: Who has th',
  '@ben',
  'CS 130 study group: #homework: Week 3 problem set; #study-room: 1 talking',
  '@ana_b: Who',
  'rejected',
].join('\n') + '\n';

function harness(language) {
  if (language === 'python') return `
ana = Member("ana")
server = Server("CS 130 study group", ana)
homework = TextChannel("homework", "Week 3 problem set")
study = VoiceChannel("study-room")
server.add_channel(homework)
server.add_channel(study)
classes = Category("Classes")
classes.add(homework)
server.add_category(classes)
message = homework.post(ana, "Who has the lecture notes?")
print(message.preview(10))
ben = server.join(Invite(1), "ben")
study.connect(ben)
print(ben.mention())
server.delete_category(classes)
print(server.overview())
ana.rename("ana_b")
print(message.preview(3))
try:
    server.join(Invite(0), "cam")
except ValueError:
    print("rejected")
`;
  if (language === 'java') return `
public class ChatApp {
    public static void main(String[] args) {
        Member ana = new Member("ana");
        Server server = new Server("CS 130 study group", ana);
        TextChannel homework = new TextChannel("homework", "Week 3 problem set");
        VoiceChannel study = new VoiceChannel("study-room");
        server.addChannel(homework);
        server.addChannel(study);
        Category classes = new Category("Classes");
        classes.add(homework);
        server.addCategory(classes);
        Message message = homework.post(ana, "Who has the lecture notes?");
        System.out.println(message.preview(10));
        Member ben = server.join(new Invite(1), "ben");
        study.connect(ben);
        System.out.println(ben.mention());
        server.deleteCategory(classes);
        System.out.println(server.overview());
        ana.rename("ana_b");
        System.out.println(message.preview(3));
        try {
            server.join(new Invite(0), "cam");
        } catch (IllegalStateException usedUp) {
            System.out.println("rejected");
        }
    }
}
`;
  if (language === 'cpp') return `
#include <iostream>

int main() {
    auto ana = std::make_shared<Member>("ana");
    Server server("CS 130 study group", ana);
    auto homeworkOwned = std::make_unique<TextChannel>("homework", "Week 3 problem set");
    auto studyOwned = std::make_unique<VoiceChannel>("study-room");
    TextChannel& homework = *homeworkOwned;
    VoiceChannel& study = *studyOwned;
    server.addChannel(std::move(homeworkOwned));
    server.addChannel(std::move(studyOwned));
    auto classesOwned = std::make_unique<Category>("Classes");
    Category& classes = *classesOwned;
    classes.add(homework);
    server.addCategory(std::move(classesOwned));
    Message& message = homework.post(*ana, "Who has the lecture notes?");
    std::cout << message.preview(10) << '\\n';
    Invite invite(1);
    auto ben = server.join(invite, "ben");
    study.connect(*ben);
    std::cout << ben->mention() << '\\n';
    server.deleteCategory(classes);
    std::cout << server.overview() << '\\n';
    ana->rename("ana_b");
    std::cout << message.preview(3) << '\\n';
    Invite usedUp(0);
    try {
        server.join(usedUp, "cam");
    } catch (const std::runtime_error&) {
        std::cout << "rejected\\n";
    }
}
`;
  return `
const ana = new Member("ana");
const server = new Server("CS 130 study group", ana);
const homework = new TextChannel("homework", "Week 3 problem set");
const study = new VoiceChannel("study-room");
server.addChannel(homework);
server.addChannel(study);
const classes = new Category("Classes");
classes.add(homework);
server.addCategory(classes);
const message = homework.post(ana, "Who has the lecture notes?");
console.log(message.preview(10));
const ben = server.join(new Invite(1), "ben");
study.connect(ben);
console.log(ben.mention());
server.deleteCategory(classes);
console.log(server.overview());
ana.rename("ana_b");
console.log(message.preview(3));
try {
  server.join(new Invite(0), "cam");
} catch {
  console.log("rejected");
}
`;
}

const program = language => [examples[language].imports, ...story.example_order.map(name => examples[language].blocks[name].source)].join('\n');

// Compilers are optional for a local unit run; release checks should supply all four.
for (const language of story.languages) {
  test(`${examples[language].label}: the chat app gives the specified results`, t => {
    const tool = { python: 'python3', java: 'javac', cpp: 'clang++', typescript: process.execPath }[language];
    if (spawnSync(tool, [language === 'java' ? '-version' : '--version']).status !== 0) {
      t.skip(`${tool} is required to execute this language`);
      return;
    }
    const example = examples[language];
    const directory = mkdtempSync(path.join(tmpdir(), 'uml-class-diagram-'));
    try {
      writeFileSync(path.join(directory, example.filename), `${program(language)}\n${harness(language)}`);
      const options = { cwd: directory, encoding: 'utf8', timeout: 60000 };
      let output;
      if (language === 'python') output = execFileSync(tool, [example.filename], options);
      else if (language === 'typescript') output = execFileSync(tool, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', example.filename], options);
      else if (language === 'java') {
        execFileSync('javac', [example.filename], options);
        output = execFileSync('java', ['ChatApp'], options);
      } else {
        execFileSync(tool, ['-std=c++17', '-Wall', '-Wextra', '-pedantic', '-Werror', example.filename, '-o', 'chat_app'], options);
        output = execFileSync(path.join(directory, 'chat_app'), [], options);
      }
      assert.equal(output, EXPECTED);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('TypeScript: the program type-checks under strict mode', () => {
  // The vendored compiler and ES2022 declarations, served from memory. The
  // harness's console comes from the runtime, not from the ES library.
  const ts = require(path.join(root, 'js/vendor/typescript/5.9.3/typescript.min.js'));
  const libraries = require(path.join(root, 'js/vendor/typescript/5.9.3/lib-map.js'));
  const source = `declare const console: { log(...data: unknown[]): void };\n${program('typescript')}\n${harness('typescript')}`;
  const files = new Map([['/chat_app.ts', ts.createSourceFile('/chat_app.ts', source, ts.ScriptTarget.ES2022, true)]]);
  for (const [name, text] of Object.entries(libraries)) {
    files.set(`/lib/${name}`, ts.createSourceFile(`/lib/${name}`, text, ts.ScriptTarget.ES2022, true));
  }
  const host = {
    getSourceFile: name => files.get(name), getDefaultLibFileName: () => '/lib/lib.es2022.d.ts', writeFile: () => {},
    getCurrentDirectory: () => '/', getDirectories: () => [], fileExists: name => files.has(name),
    readFile: name => files.get(name)?.text, getCanonicalFileName: name => name,
    useCaseSensitiveFileNames: () => true, getNewLine: () => '\n',
  };
  const options = { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022 };
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram(['/chat_app.ts'], options, host));
  assert.deepEqual(diagnostics.map(entry => ts.flattenDiagnosticMessageText(entry.messageText, '\n')), []);
});
