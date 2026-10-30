const { loadLesson } = require('../narration/source');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const { lesson, story } = loadLesson('uml_state_diagram');
const examples = yaml.load(read('_data/explainers/uml_state_diagram_code.yml'));
const quizzes = yaml.load(read('_data/explainers/uml_state_diagram_quizzes.yml'));
const oracle = yaml.load(read('_data/explainers/uml_state_diagram_ui.yml'));
const timing = JSON.parse(read('_data/explainers/uml_state_diagram_timing.json'));
const diagramOf = (scene, cue) => story.diagrams[cue.diagram || scene.diagram];

test('every scene with a part names one of the four parts, in the lesson order', () => {
  assert.deepEqual(lesson.parts, ['States', 'Transitions', 'Inside a state', 'Composite states']);
  const order = story.scenes.filter(scene => scene.part).map(scene => lesson.parts.indexOf(scene.part));
  assert.ok(order.every(index => index >= 0), 'unknown part');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'parts appear in order');
  for (const scene of story.scenes.filter(candidate => candidate.part)) {
    assert.ok(lesson.outline_labels[scene.id], `${scene.id}: short navigation label`);
  }
});

test('every section ends in a check, and the last one is a multi-question summary on a new example', () => {
  assert.deepEqual(Object.keys(quizzes), story.scenes.map(scene => scene.id));
  const summary = quizzes[story.scenes.at(-1).id].questions;
  assert.ok(summary.length >= 6, 'the summary covers every part');
  assert.ok(summary.every(question => /scooter|Riding|Parked|Reserved/.test(question.question)), 'one new example');
  const keys = [];
  for (const scene of story.scenes) {
    for (const question of quizzes[scene.id].questions || [quizzes[scene.id]]) {
      const { options, correct_index: key } = question;
      assert.ok(options.length >= 3 && question.explanation.trim(), `${scene.id}: options and explanation`);
      assert.ok(Number.isInteger(key) && options[key], `${scene.id}: a real key`);
      assert.doesNotMatch(question.question, /robot|delivery/i, `${scene.id}: checks apply the notation to a new situation`);
      for (const index of Object.keys(question.option_feedback || {})) {
        assert.notEqual(Number(index), key, `${scene.id}: feedback on the key never fires`);
      }
      // No length tell: the key is never conspicuously the longest option.
      const wrong = options.filter((_, index) => index !== key).map(option => option.length).sort((a, b) => a - b);
      const middle = wrong.length / 2;
      const median = wrong.length % 2 ? wrong[Math.floor(middle)] : (wrong[middle - 1] + wrong[middle]) / 2;
      assert.ok(options[key].length <= median * 1.8 && options[key].length - wrong.at(-1) <= 15, `${scene.id}: key length tell`);
      keys.push(key);
    }
  }
  assert.ok(new Set(keys).size === 3, 'keys rotate across positions');
});

test('every cue names real code lines and diagram states, and its diagram exists', () => {
  for (const scene of story.scenes) {
    for (const cue of scene.cues) {
      if (cue.focus) {
        assert.ok(scene.code, `${scene.id}: focus without code`);
        for (const language of story.languages) {
          assert.ok(examples[language].blocks[scene.code].focus[cue.focus], `${language}/${scene.id}/${cue.focus}`);
        }
      }
      if (cue.diagram_focus) {
        const diagram = diagramOf(scene, cue);
        assert.ok(diagram, `${scene.id}/${cue.id}: focus without a diagram`);
        assert.match(diagram.source, new RegExp(`(^|\\s)${cue.diagram_focus}(\\s|:|$)`, 'm'), `${scene.id}/${cue.id}: ${cue.diagram_focus} is drawn`);
      }
    }
  }
  for (const [name, diagram] of Object.entries(story.diagrams)) {
    assert.equal(diagram.type, 'state', name);
    assert.ok(diagram.label && diagram.description && diagram.caption, `${name}: label, text alternative, and caption`);
    assert.match(diagram.source, /^@startuml\n[\s\S]*@enduml\n$/, name);
  }
});

test('each prediction asks before its answer and leaves time to think', () => {
  story.scenes.forEach(scene => scene.cues.forEach((cue, index) => {
    if (!cue.prediction) return;
    assert.ok(cue.pause_after >= 4, `${scene.id}/${cue.id}: thinking time`);
    assert.ok(index + 1 < scene.cues.length, `${scene.id}/${cue.id}: the answer follows in the same section`);
    assert.match(cue.text, /\?/, `${scene.id}/${cue.id}: asks a question`);
  }));
});

// Each event method of the code is drawn in the diagrams with the trigger the
// narration uses, so code and notation tell one story.
const TRIGGERS = {
  arrived: 'Driving --> Waiting : arrived',
  enter_pin: 'Waiting --> Unlocked : enterPin(code) [pin matches]',
  extend_wait: 'Waiting --> Waiting : extendWait',
  wait_timed_out: 'Waiting --> Returning : after(10 min)',
  lid_closed: 'Unlocked --> Returning : lidClosed / playThanks()',
  battery_low: 'Delivering --> Returning : when(battery < 15%)',
  base_reached: 'Returning --> [*]',
};
test('the diagrams draw a transition for every event the complete code handles', () => {
  const drawn = Object.values(story.diagrams).map(diagram => diagram.source).join('\n');
  const python = examples.python.blocks.robot.source;
  for (const [method, transition] of Object.entries(TRIGGERS)) {
    assert.match(python, new RegExp(`def ${method}\\(`), `${method} is handled in code`);
    assert.ok(drawn.includes(transition), `${transition} is drawn`);
  }
  assert.ok(drawn.includes('Waiting : enterPin(code) [pin wrong] / beep()'), 'the internal transition is drawn inside Waiting');
});

test('code blocks exist in all four languages and their marks name real lines', () => {
  assert.deepEqual(Object.keys(examples).sort(), ['cpp', 'java', 'python', 'typescript']);
  assert.deepEqual(story.example_order, ['robot']);
  for (const [language, example] of Object.entries(examples)) {
    for (const [name, block] of Object.entries(example.blocks)) {
      const lines = block.source.trimEnd().split('\n');
      for (const marks of Object.values(block.focus)) {
        assert.ok(marks.length > 0);
        for (const line of marks) assert.ok(line >= 1 && line <= lines.length, `${language}/${name}: line ${line}`);
      }
      for (const [focus, line] of Object.entries(block.scroll || {})) {
        assert.ok(block.focus[focus].includes(line), `${language}/${name}: scroll line ${line} is one of the ${focus} marks`);
      }
    }
  }
});

// Long code stays beside the narration, so every cue that speaks while code is
// on screen marks the lines that implement what it says.
test('every cue in a code scene marks the code it discusses', () => {
  for (const scene of story.scenes.filter(candidate => candidate.code)) {
    for (const cue of scene.cues) assert.ok(cue.focus, `${scene.id}/${cue.id}: no code is marked`);
  }
});

// The guards scene's code cue says that each marked line maps to one part of a
// transition label, so it marks the guard and the effect and nothing else.
test('guard-and-effect marks are exactly the lines that carry a label part', () => {
  for (const [language, example] of Object.entries(examples)) {
    const lines = example.blocks.first.source.split('\n');
    const marked = example.blocks.first.focus.guard_effect.map(line => lines[line - 1]);
    assert.equal(marked.length, 2, `${language}: one guard line and one effect line`);
    assert.match(marked[0], /\[pin matches\]/, `${language}: the guard`);
    assert.match(marked[1], /\/ playThanks\(\)/, `${language}: the effect`);
  }
});

test('speech, captions, and timing are generated from the published storyboard', () => {
  assert.equal(timing.speech_sha256, story.speech_sha256, 'Regenerate audio, captions, and timing after editing the storyboard.');
  assert.equal(timing.scenes.length, story.scenes.length);
  let end = 0;
  timing.scenes.forEach((scene, index) => {
    assert.equal(scene.id, story.scenes[index].id);
    assert.deepEqual(scene.cues.map(cue => cue.id), story.scenes[index].cues.map(cue => cue.id));
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
  for (const written of Object.keys(story.pronunciations)) {
    assert.ok(cues.some(cue => cue.text.includes(written)), `${written}: unused pronunciation`);
  }
  const size = statSync(path.join(root, story.audio)).size;
  assert.ok(size > 0 && size * 8 / timing.duration < 64000);
});

test('every check follows a viewing pause, so the finished picture stays up before it opens', () => {
  // js/narrated-explainer.js opens a check 0.3 s before the section boundary.
  story.scenes.forEach((scene, index) => {
    assert.ok(scene.cues.at(-1).pause_after >= 2.5, `${scene.id}: viewing pause before its check`);
    const sceneTiming = timing.scenes[index];
    const viewing = sceneTiming.end - 0.3 - sceneTiming.cues.at(-1).speech_end;
    assert.ok(viewing >= 2, `${scene.id}: only ${viewing.toFixed(2)} s to inspect the picture before the check`);
  });
});

const camel = name => name.replace(/_(\w)/g, (_, letter) => letter.toUpperCase());
const call = (language, [name, ...args]) =>
  `${language === 'python' ? name : camel(name)}(${args.map(arg => JSON.stringify(arg)).join(', ')})`;

// Prints one line per scenario: the robot's actions, then its final state.
function harness(language, scenarios) {
  const runs = scenarios.map(scenario => scenario.events);
  const pin = JSON.stringify(oracle.pin);
  if (language === 'python') return runs.map(events => `robot = DeliveryRobot(${pin})\n`
    + events.map(event => `robot.${call(language, event)}\n`).join('')
    + 'print("|".join(robot.actions) + ";" + robot.state.name)\n').join('');
  if (language === 'typescript') return runs.map(events => `{\n  const robot = new DeliveryRobot(${pin});\n`
    + events.map(event => `  robot.${call(language, event)};\n`).join('')
    + '  console.log(robot.actions.join("|") + ";" + robot.state.toUpperCase());\n}\n').join('');
  if (language === 'java') return 'public class DeliveryRobotDemo {\n  public static void main(String[] args) {\n'
    + runs.map(events => `    {\n      DeliveryRobot robot = new DeliveryRobot(${pin});\n`
      + events.map(event => `      robot.${call(language, event)};\n`).join('')
      + '      System.out.println(String.join("|", robot.actions()) + ";" + robot.state().name());\n    }\n').join('')
    + '  }\n}\n';
  const names = ['Driving', 'Waiting', 'Unlocked', 'Returning', 'Done']
    .map(name => `    case State::${name}: return "${name.toUpperCase()}";\n`).join('');
  return '#include <iostream>\n'
    + `static const char* name(State state) {\n  switch (state) {\n${names}  }\n  return "?";\n}\n`
    + 'static std::string joined(const std::vector<std::string>& items) {\n  std::string out;\n'
    + '  for (const auto& item : items) out += (out.empty() ? "" : "|") + item;\n  return out;\n}\n'
    + 'int main() {\n' + runs.map(events => `  {\n    DeliveryRobot robot(${pin});\n`
      + events.map(event => `    robot.${call(language, event)};\n`).join('')
      + "    std::cout << joined(robot.actions()) << ';' << name(robot.state()) << '\\n';\n  }\n").join('') + '}\n';
}

// Both versions of the code must perform the specified behaviors in every
// language. Compilers are optional for a local run; release checks supply all four.
for (const language of story.languages) {
  test(`${examples[language].label}: the first and complete robots perform the specified behaviors`, t => {
    const tool = { python: 'python3', java: 'javac', cpp: 'clang++', typescript: process.execPath }[language];
    if (spawnSync(tool, [language === 'java' ? '-version' : '--version']).status !== 0) {
      t.skip(`${tool} is required to execute this language`);
      return;
    }
    const example = examples[language];
    const directory = mkdtempSync(path.join(tmpdir(), 'uml-state-diagram-'));
    const run = program => {
      writeFileSync(path.join(directory, example.filename), program);
      const options = { cwd: directory, encoding: 'utf8', timeout: 60000 };
      if (language === 'python') return execFileSync(tool, [example.filename], options);
      if (language === 'typescript') return execFileSync(tool, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', example.filename], options);
      if (language === 'java') {
        execFileSync('javac', [example.filename], options);
        return execFileSync('java', [example.filename.replace('.java', '')], options);
      }
      execFileSync(tool, ['-std=c++17', '-Wall', '-Wextra', '-pedantic', '-Werror', example.filename, '-o', 'example'], options);
      return execFileSync(path.join(directory, 'example'), [], options);
    };
    try {
      for (const [block, scenarios] of [['first', oracle.first], ['robot', oracle.complete]]) {
        const expected = scenarios.map(scenario => `${scenario.actions.join('|')};${scenario.state.toUpperCase()}`).join('\n');
        assert.equal(run(`${example.imports}${example.blocks[block].source}\n${harness(language, scenarios)}`), `${expected}\n`, block);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
