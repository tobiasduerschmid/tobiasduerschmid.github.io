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
const story = loadStory('strategy');
const examples = yaml.load(read('_data/explainers/strategy_code.yml'));
const quizzes = yaml.load(read('_data/explainers/strategy_quizzes.yml'));
const split = yaml.load(read('_data/explainers/strategy_ui.yml'));
const timing = JSON.parse(read('_data/explainers/strategy_timing.json'));

// The cases are the specification both designs implement.
const method = id => split.methods.find(entry => entry.id === id);
const { people, cases } = split;
const { percents } = method('percent');
const { guest } = method('birthday');
const shareLine = entry => `${entry.label}|${people.map(person => `${person}=${entry.shares[person]}`).join(',')}`;

test('every case keeps the contract, and every method and panel has a case', () => {
  for (const entry of cases) {
    assert.deepEqual(Object.keys(entry.shares), people, `${entry.method}: one share per person, in order`);
    const sum = Object.values(entry.shares).reduce((total, share) => total + share, 0);
    assert.equal(sum, entry.total, `${entry.method} ${entry.total}: the shares add up to the total`);
  }
  assert.deepEqual([...new Set(cases.map(entry => entry.method))].sort(), split.methods.map(entry => entry.id).sort());
  assert.equal(Object.values(percents).reduce((total, percent) => total + percent, 0), 100);
  for (const [id, index] of Object.entries(split.panels)) {
    assert.equal(cases[index].method, id, `panel ${id} shows its own method`);
  }
});

test('every section ends in a valid check, and the last one is a multi-question summary', () => {
  assert.deepEqual(Object.keys(quizzes), story.scenes.map(scene => scene.id));
  const final = quizzes[story.scenes.at(-1).id];
  assert.ok(final.questions.length >= 4, 'The summary quiz covers every part of the pattern.');
  for (const scene of story.scenes) {
    const check = quizzes[scene.id];
    for (const question of check.questions || [check]) {
      assert.match(question.question, /pattern|Strategy|photo app/, `${scene.id}: the stem names the pattern or scenario`);
      assert.ok(question.options.length >= 2 && question.explanation.trim());
      assert.ok(Number.isInteger(question.correct_index) && question.options[question.correct_index]);
      for (const index of Object.keys(question.option_feedback || {})) {
        assert.notEqual(Number(index), question.correct_index, `${scene.id}: feedback on the correct option never fires`);
      }
    }
  }
});

test('every cue names real code, diagram, table, and panel targets', () => {
  const rows = split.methods.map(entry => entry.id);
  const columns = split.operations.map(operation => operation.id);
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
      if (cue.ui_state) assert.ok(cue.ui_state in split.panels, `${scene.id}: ${cue.ui_state}`);
      const diagram = story.diagrams[scene.diagram];
      if (cue.diagram_steps) assert.ok(cue.diagram_steps >= 1 && cue.diagram_steps <= diagram.steps.length);
      if (cue.diagram_focus) {
        const declared = new RegExp(`^(class|interface|participant) ${cue.diagram_focus}\\b`, 'm');
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

// Each harness prints label|person=cents,... for the before and after design
// of every case, then a birthday split chosen at runtime, then whether an
// invalid percentage split is rejected.
const pairs = cases.map(entry => [entry.total, entry.method]);
const enumName = { equal: 'EQUAL', percent: 'PERCENT', birthday: 'BIRTHDAY' };
const cppEnum = { equal: 'Equal', percent: 'Percent', birthday: 'Birthday' };

function harness(language) {
  if (language === 'python') return `
PEOPLE = ${JSON.stringify(people)}
PERCENTS = ${JSON.stringify(percents)}
AFTER = {"equal": EQUAL, "percent": PercentSplit(PERCENTS), "birthday": BirthdaySplit(${JSON.stringify(guest)})}
def show(expense):
    print(expense.label() + "|" + ",".join(f"{p}={c}" for p, c in expense.shares().items()))
for total, method in ${JSON.stringify(pairs)}:
    show(ExpenseBefore(total, PEOPLE, method, PERCENTS, ${JSON.stringify(guest)}))
    show(Expense(total, PEOPLE, AFTER[method]))
switched = Expense(6000, PEOPLE, EQUAL)
switched.set_strategy(AFTER["birthday"])
show(switched)
try:
    PercentSplit({"Ava": 50, "Ben": 30, "Chloe": 30})
except ValueError:
    print("rejected")
`;
  if (language === 'java') {
    const strategy = { equal: 'EqualSplit.INSTANCE', percent: 'new PercentSplit(percents)', birthday: `new BirthdaySplit("${guest}")` };
    const calls = pairs.map(([total, id], index) => `
    ExpenseBefore before${index} = new ExpenseBefore(${total}, people, Method.${enumName[id]}, percents, "${guest}");
    System.out.println(line(before${index}.label(), before${index}.shares()));
    Expense after${index} = new Expense(${total}, people, ${strategy[id]});
    System.out.println(line(after${index}.label(), after${index}.shares()));`).join('');
    return `
public class StrategyDemo {
  static String line(String label, Map<String, Integer> shares) {
    StringJoiner joiner = new StringJoiner(",");
    shares.forEach((person, cents) -> joiner.add(person + "=" + cents));
    return label + "|" + joiner;
  }

  public static void main(String[] args) {
    List<String> people = List.of(${people.map(person => `"${person}"`).join(', ')});
    Map<String, Integer> percents = new LinkedHashMap<>();
    ${Object.entries(percents).map(([person, percent]) => `percents.put("${person}", ${percent});`).join(' ')}${calls}
    Expense switched = new Expense(6000, people, EqualSplit.INSTANCE);
    switched.setStrategy(${strategy.birthday});
    System.out.println(line(switched.label(), switched.shares()));
    try {
      new PercentSplit(Map.of("Ava", 50, "Ben", 30, "Chloe", 30));
    } catch (IllegalArgumentException rejected) {
      System.out.println("rejected");
    }
  }
}
`;
  }
  if (language === 'cpp') {
    const strategy = { equal: 'equalSplit()', percent: 'std::make_shared<PercentSplit>(percents)', birthday: `std::make_shared<BirthdaySplit>("${guest}")` };
    const calls = pairs.map(([total, id]) => `
  {
    ExpenseBefore before(${total}, people, Method::${cppEnum[id]}, percents, "${guest}");
    std::cout << line(before.label(), before.shares()) << '\\n';
    Expense after(${total}, people, ${strategy[id]});
    std::cout << line(after.label(), after.shares()) << '\\n';
  }`).join('');
    return `
std::string line(const std::string& label, const Shares& shares) {
  std::string joined;
  for (const auto& [person, cents] : shares) joined += (joined.empty() ? "" : ",") + person + "=" + std::to_string(cents);
  return label + "|" + joined;
}

int main() {
  const std::vector<std::string> people{${people.map(person => `"${person}"`).join(', ')}};
  const std::map<std::string, int> percents{${Object.entries(percents).map(([person, percent]) => `{"${person}", ${percent}}`).join(', ')}};${calls}
  Expense switched(6000, people, equalSplit());
  switched.setStrategy(${strategy.birthday});
  std::cout << line(switched.label(), switched.shares()) << '\\n';
  try {
    (void)PercentSplit(std::map<std::string, int>{{"Ava", 50}, {"Ben", 30}, {"Chloe", 30}});
  } catch (const std::invalid_argument&) {
    std::cout << "rejected\\n";
  }
}
`;
  }
  return `
const people = ${JSON.stringify(people)};
const percents: Record<string, number> = ${JSON.stringify(percents)};
const after: Record<string, SplitStrategy> = { equal: EQUAL, percent: new PercentSplit(percents), birthday: new BirthdaySplit(${JSON.stringify(guest)}) };
function line(label: string, shares: Shares): string {
  return label + "|" + [...shares].map(([person, cents]) => person + "=" + cents).join(",");
}
const pairs: [number, Method][] = ${JSON.stringify(pairs)};
for (const [total, method] of pairs) {
  const before = new ExpenseBefore(total, people, method, percents, ${JSON.stringify(guest)});
  console.log(line(before.label(), before.shares()));
  const expense = new Expense(total, people, after[method]);
  console.log(line(expense.label(), expense.shares()));
}
const switched = new Expense(6000, people, EQUAL);
switched.setStrategy(after.birthday);
console.log(line(switched.label(), switched.shares()));
try {
  new PercentSplit({ Ava: 50, Ben: 30, Chloe: 30 });
} catch {
  console.log("rejected");
}
`;
}

// Both designs must give the specified label and shares for every case, a
// strategy set at runtime must take effect, and invalid percentages must be
// rejected. Compilers are optional for a local unit run; release checks
// should supply all four.
for (const language of story.languages) {
  test(`${examples[language].label}: both designs give the specified shares, and strategies can change at runtime`, t => {
    const tool = { python: 'python3', java: 'javac', cpp: 'clang++', typescript: process.execPath }[language];
    if (spawnSync(tool, [language === 'java' ? '-version' : '--version']).status !== 0) {
      t.skip(`${tool} is required to execute this language`);
      return;
    }
    const example = examples[language];
    const directory = mkdtempSync(path.join(tmpdir(), 'strategy-example-'));
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
    const receipt = entry => `${entry.label}: ${people.map(person => `${person} ${entry.shares[person]}`).join(', ')}`;
    try {
      assert.equal(run(`${declarations}\n${block('wire')}`), `${receipt(cases[0])}\n${receipt(cases[1])}\n`);
      const expected = cases.flatMap(entry => [shareLine(entry), shareLine(entry)]);
      const birthday = cases.find(entry => entry.method === 'birthday' && entry.total === 6000);
      assert.equal(run(`${declarations}\n${block('problem')}\n${harness(language)}`),
        `${[...expected, shareLine(birthday), 'rejected'].join('\n')}\n`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
