const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync, statSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const source = readFileSync(path.join(root, '_data/explainers/mvc.yml'));
const story = yaml.load(source.toString());
const examples = yaml.load(read('_data/explainers/mvc_code.yml'));
const quizzes = yaml.load(read('_data/explainers/mvc_quizzes.yml'));
const dashboard = yaml.load(read('_data/explainers/mvc_ui.yml'));
const timing = JSON.parse(read('_data/explainers/mvc_timing.json'));

// The dashboard's rules, replayed from the start week: an edit through a
// view's controller changes the data unless that view is read-only (the pie
// chart); a click highlights a bar in the bar chart only.
function replay(events) {
  const minutes = { ...dashboard.start };
  let selected = '';
  for (const event of events) {
    if (event.kind === 'edit' && event.view === 'table') minutes[event.category] = event.minutes;
    if (event.kind === 'click' && event.view === 'bars') selected = event.category;
  }
  const rows = dashboard.categories.map(name => [name, minutes[name]]);
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  const mark = name => (name === selected ? '> ' : '');
  return {
    table: rows.map(([name, value]) => `${name}: ${value} min`),
    bars: rows.map(([name, value]) => `${mark(name)}${name} ${'#'.repeat(Math.floor(value / dashboard.bar_unit))}`),
    pie: rows.map(([name, value]) => `${name} ${Math.round((100 * value) / total)}%`),
  };
}

test('the expected dashboard follows from the start week and the events', () => {
  assert.deepEqual(dashboard.expected, replay(dashboard.events));
  for (const [id, panel] of Object.entries(dashboard.panels)) {
    assert.deepEqual(Object.keys(panel.minutes), dashboard.categories, `${id}: every category, in order`);
    if (panel.selected) assert.ok(dashboard.categories.includes(panel.selected), `${id}: ${panel.selected}`);
    if (panel.from) assert.ok(dashboard.panels[panel.from], `${id}: animates from a real panel`);
  }
});

test('the narration follows the pattern description from context to consequences', () => {
  const parts = story.scenes.map(scene => scene.part).filter(Boolean);
  assert.deepEqual([...new Set(parts)], ['Context', 'Problem', 'Solution', 'Consequences']);
  for (const scene of story.scenes) {
    if (scene.part) assert.ok(scene.label.startsWith(scene.part), `${scene.id}: its label names its part`);
  }
});

test('every section ends in a valid check, and the last one is a multi-question summary', () => {
  assert.deepEqual(Object.keys(quizzes), story.scenes.map(scene => scene.id));
  const final = quizzes[story.scenes.at(-1).id];
  assert.ok(final.questions.length >= 4, 'The summary quiz covers every part of the pattern.');
  for (const scene of story.scenes) {
    const check = quizzes[scene.id];
    for (const question of check.questions || [check]) {
      assert.match(question.question, /Model-View-Controller|fitness app/, `${scene.id}: the stem names the pattern or scenario`);
      assert.ok(question.options.length >= 2 && question.explanation.trim());
      assert.ok(Number.isInteger(question.correct_index) && question.options[question.correct_index]);
      for (const index of Object.keys(question.option_feedback || {})) {
        assert.notEqual(Number(index), question.correct_index, `${scene.id}: feedback on the correct option never fires`);
      }
    }
  }
});

test('every cue names real code, diagram, and dashboard targets', () => {
  for (const scene of story.scenes) {
    for (const cue of scene.cues) {
      // A cue may switch the scene to another diagram.
      const diagram = story.diagrams[cue.diagram || scene.diagram];
      if (cue.diagram) assert.ok(scene.diagram && diagram, `${scene.id}: ${cue.diagram} is a diagram of a diagram scene`);
      if (cue.focus) {
        for (const language of story.languages) {
          assert.ok(examples[language].blocks[scene.code].focus[cue.focus], `${language}/${scene.id}/${cue.focus}`);
        }
      }
      if (scene.ui) assert.ok(dashboard.panels[cue.ui_state], `${scene.id}: ${cue.ui_state}`);
      if (cue.ui_redraw) assert.equal(cue.ui_redraw, 'all', `${scene.id}: the first design redraws all views`);
      if (cue.diagram_steps) assert.ok(cue.diagram_steps >= 1 && cue.diagram_steps <= diagram.steps.length);
      if (cue.diagram_focus) {
        assert.notEqual(diagram.type, 'crc', `${scene.id}: CRC cards cannot be highlighted`);
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
  assert.equal(timing.source_sha256, createHash('sha256').update(source).digest('hex'),
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

// The before design has no read-only view, so it replays only the table edit
// and the bar click.
const BEFORE = {
  python: `
app = ScreenTimeApp({"Social": 120, "Video": 90, "Games": 60, "Study": 30})
app.on_cell_edited("Study", 90)
app.on_bar_clicked("Games")
for lines in (app.table, app.bars, app.pie):
    print("\\n".join(lines))
`,
  java: `
public class MvcDemo {
  public static void main(String[] args) {
    Map<String, Integer> week = new LinkedHashMap<>();
    week.put("Social", 120); week.put("Video", 90); week.put("Games", 60); week.put("Study", 30);
    ScreenTimeApp app = new ScreenTimeApp(week);
    app.onCellEdited("Study", 90);
    app.onBarClicked("Games");
    for (List<String> lines : List.of(app.table, app.bars, app.pie)) System.out.println(String.join("\\n", lines));
  }
}
`,
  cpp: `
int main() {
  ScreenTimeApp app({{"Social", 120}, {"Video", 90}, {"Games", 60}, {"Study", 30}});
  app.onCellEdited("Study", 90);
  app.onBarClicked("Games");
  for (const auto* lines : {&app.table, &app.bars, &app.pie})
    for (const auto& line : *lines) std::cout << line << '\\n';
}
`,
  typescript: `
const app = new ScreenTimeApp(new Map([["Social", 120], ["Video", 90], ["Games", 60], ["Study", 30]]));
app.onCellEdited("Study", 90);
app.onBarClicked("Games");
for (const lines of [app.table, app.bars, app.pie]) console.log(lines.join("\\n"));
`,
};

// Both designs must print the specified dashboard. Compilers are optional for a
// local unit run; release checks should supply all four.
for (const language of story.languages) {
  test(`${examples[language].label}: both designs print the specified dashboard`, t => {
    const tool = { python: 'python3', java: 'javac', cpp: 'clang++', typescript: process.execPath }[language];
    if (spawnSync(tool, [language === 'java' ? '-version' : '--version']).status !== 0) {
      t.skip(`${tool} is required to execute this language`);
      return;
    }
    const example = examples[language];
    const directory = mkdtempSync(path.join(tmpdir(), 'mvc-example-'));
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
    const printed = lines => `${[...lines.table, ...lines.bars, ...lines.pie].join('\n')}\n`;
    try {
      assert.equal(run(`${declarations}\n${block('wire')}`), printed(dashboard.expected));
      const beforeEvents = dashboard.events.filter(event => event.view !== 'pie');
      assert.equal(run(`${declarations}\n${block('problem')}\n${BEFORE[language]}`), printed(replay(beforeEvents)));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
