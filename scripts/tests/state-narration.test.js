const { loadStory } = require('../narration/source');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const story = loadStory('state');
const examples = yaml.load(read('_data/explainers/state_code.yml'));
const quizzes = yaml.load(read('_data/explainers/state_quizzes.yml'));
const companion = yaml.load(read('_data/explainers/state_ui.yml'));
const timing = JSON.parse(read('_data/explainers/state_timing.json'));

// The table of reactions is the specification both designs implement. Starting
// in Following with full energy, this input sequence reaches every state-input
// cell, including the tick that spends the last energy.
const INPUTS = ['throw_ball', 'whistle', 'throw_ball', 'tick', 'whistle', 'tick',
  'throw_ball', 'tick', 'throw_ball', 'tick', 'whistle', 'throw_ball'];

function simulate(inputs) {
  const states = new Map(companion.states.map(state => [state.label, state]));
  let current = states.get('Following');
  let energy = companion.full_energy;
  const visited = new Set();
  const reactions = inputs.map(input => {
    let reaction = current.reactions[input];
    if (reaction.uses_energy) {
      energy -= 1;
      if (energy === 0) reaction = reaction.when_tired;
    }
    if (reaction.restores_energy) energy = companion.full_energy;
    visited.add(`${current.id}:${input}:${reaction.message}`);
    if (reaction.next) current = states.get(reaction.next);
    return reaction.message;
  });
  return { reactions, visited };
}

test('the input sequence reaches every reaction in the table', () => {
  const cells = companion.states.flatMap(state => companion.requests.flatMap(request => {
    const reaction = state.reactions[request.id];
    return [reaction, reaction.when_tired].filter(Boolean)
      .map(variant => `${state.id}:${request.id}:${variant.message}`);
  }));
  assert.deepEqual([...simulate(INPUTS).visited].sort(), cells.sort());
});

test('the state machine diagram draws exactly the transitions in the table', () => {
  const drawn = story.diagrams.lifecycle.source.split('\n')
    .map(line => line.match(/^(\w+) --> (\w+) : (\w+)\(\)/))
    .filter(Boolean)
    .map(([, from, to, event]) => `${from} -${event}-> ${to}`);
  const camel = id => id.replace(/_(\w)/g, (_, letter) => letter.toUpperCase());
  const specified = companion.states.flatMap(state => companion.requests.flatMap(request => {
    const reaction = state.reactions[request.id];
    return [reaction, reaction.when_tired].filter(variant => variant && variant.next)
      .map(variant => `${state.label} -${camel(request.id)}-> ${variant.next}`);
  }));
  assert.deepEqual(drawn.sort(), specified.sort());
});

test('every section ends in a valid check, and the last one is a multi-question summary', () => {
  assert.deepEqual(Object.keys(quizzes), story.scenes.map(scene => scene.id));
  const final = quizzes[story.scenes.at(-1).id];
  assert.ok(final.questions.length >= 4, 'The summary quiz covers every part of the pattern.');
  for (const scene of story.scenes) {
    const check = quizzes[scene.id];
    for (const question of check.questions || [check]) {
      assert.match(question.question, /pattern|State|video player/, `${scene.id}: the stem names the pattern or scenario`);
      assert.ok(question.options.length >= 2 && question.explanation.trim());
      assert.ok(Number.isInteger(question.correct_index) && question.options[question.correct_index]);
      for (const index of Object.keys(question.option_feedback || {})) {
        assert.notEqual(Number(index), question.correct_index, `${scene.id}: feedback on the correct option never fires`);
      }
    }
  }
});

test('every cue names real code, diagram, table, and panel targets', () => {
  const rows = companion.states.map(state => state.id);
  const columns = companion.requests.map(request => request.id);
  for (const scene of story.scenes) {
    for (const cue of scene.cues) {
      if (cue.focus) {
        for (const language of story.languages) {
          assert.ok(examples[language].blocks[scene.code].focus[cue.focus], `${language}/${scene.id}/${cue.focus}`);
        }
      }
      if (cue.table_focus) {
        assert.ok(scene.table, `${scene.id}: table focus without a table`);
        if (cue.table_focus.row) assert.ok(rows.includes(cue.table_focus.row));
        if (cue.table_focus.column) assert.ok(columns.includes(cue.table_focus.column));
      }
      if (cue.ui_state) assert.ok(companion.panels[cue.ui_state], `${scene.id}: ${cue.ui_state}`);
      const diagram = story.diagrams[scene.diagram];
      if (cue.diagram_steps) assert.ok(cue.diagram_steps >= 1 && cue.diagram_steps <= diagram.steps.length);
      if (cue.diagram_focus) {
        const declared = new RegExp(`^(class|interface|state|participant) ${cue.diagram_focus}\\b`, 'm');
        assert.match(diagram.source, declared, `${scene.id}: ${cue.diagram_focus} is declared`);
      }
    }
  }
});

test('code blocks exist in all four languages and their marks name real lines', () => {
  assert.deepEqual(Object.keys(examples).sort(), ['cpp', 'java', 'python', 'typescript']);
  for (const [language, example] of Object.entries(examples)) {
    for (const name of ['problem', ...story.example_order]) {
      const lines = example.blocks[name].source.trimEnd().split('\n');
      for (const marks of Object.values(example.blocks[name].focus)) {
        assert.ok(marks.length > 0);
        for (const line of marks) assert.ok(line >= 1 && line <= lines.length, `${language}/${name}: line ${line}`);
      }
    }
  }
});

test('speech, captions, and timing are generated from the published storyboard', () => {
  assert.equal(timing.speech_sha256, story.speech_sha256,
    'Regenerate audio, captions, and timing after editing the storyboard.');
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

test('every section ends in enough silence for the player to stop before the next section', () => {
  // js/narrated-explainer.js stops 0.3 s before a section boundary; the
  // renderer's default pause after a cue is 0.55 s.
  for (const scene of story.scenes) {
    assert.ok((scene.cues.at(-1).pause_after ?? 0.55) > 0.3, `${scene.id} ends with too little silence`);
  }
});

const CALLS = {
  python: input => input,
  java: input => input.replace('throw_ball', 'throwBall'),
  cpp: input => input.replace('throw_ball', 'throwBall'),
  typescript: input => input.replace('throw_ball', 'throwBall'),
};

function harness(language) {
  const calls = object => INPUTS.map(input => `${object}.${CALLS[language](input)}()`);
  const throwBall = object => `${object}.${CALLS[language]('throw_ball')}()`;
  if (language === 'python') return `
before, after = DogBefore(), Dog()
print("|".join([${calls('before').join(', ')}]))
print("|".join([${calls('after').join(', ')}]))
first, second = Dog(), Dog()
${throwBall('first')}
print(${throwBall('second')} + "|" + ${throwBall('first')})
`;
  if (language === 'java') return `
public class StateDemo {
  public static void main(String[] args) {
    DogBefore before = new DogBefore();
    Dog after = new Dog();
    System.out.println(String.join("|", ${calls('before').join(', ')}));
    System.out.println(String.join("|", ${calls('after').join(', ')}));
    Dog first = new Dog(), second = new Dog();
    ${throwBall('first')};
    System.out.println(${throwBall('second')} + "|" + ${throwBall('first')});
  }
}
`;
  if (language === 'cpp') return `
int main() {
  DogBefore before;
  Dog after;
  std::cout << ${calls('before').join(" << '|' << ")} << '\\n';
  std::cout << ${calls('after').join(" << '|' << ")} << '\\n';
  Dog first, second;
  ${throwBall('first')};
  std::cout << ${throwBall('second')} << '|' << ${throwBall('first')} << '\\n';
}
`;
  return `
const before = new DogBefore(), after = new Dog();
console.log([${calls('before').join(', ')}].join("|"));
console.log([${calls('after').join(', ')}].join("|"));
const first = new Dog(), second = new Dog();
${throwBall('first')};
console.log([${throwBall('second')}, ${throwBall('first')}].join("|"));
`;
}

// Both designs must give the specified reaction to every input in every state,
// and dogs that share state objects must not share state. Compilers are optional
// for a local unit run; release checks should supply all four.
for (const language of story.languages) {
  test(`${examples[language].label}: both designs give the table's reactions, and dogs share no state`, t => {
    const tool = { python: 'python3', java: 'javac', cpp: 'clang++', typescript: process.execPath }[language];
    if (spawnSync(tool, [language === 'java' ? '-version' : '--version']).status !== 0) {
      t.skip(`${tool} is required to execute this language`);
      return;
    }
    const example = examples[language];
    const directory = mkdtempSync(path.join(tmpdir(), 'state-example-'));
    const block = name => example.blocks[name].source;
    const declarations = [example.imports, ...story.example_order.filter(name => name !== 'wire').map(block)].join('\n');
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
      assert.equal(run(`${declarations}\n${block('wire')}`), 'runs after the ball\nkeeps chasing the first ball\nbrings the ball back\n');
      const expected = simulate(INPUTS).reactions.join('|');
      assert.equal(run(`${declarations}\n${block('problem')}\n${harness(language)}`),
        `${expected}\n${expected}\nruns after the ball|keeps chasing the first ball\n`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
