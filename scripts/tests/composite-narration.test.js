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
const story = loadStory('composite');
const examples = yaml.load(read('_data/explainers/composite_code.yml'));
const quizzes = yaml.load(read('_data/explainers/composite_quizzes.yml'));
const library = yaml.load(read('_data/explainers/composite_ui.yml'));

// The specification, independent of any language: both designs over the rows.
const [episode] = library.episode;
const titleOf = row => (row.kind === 'episode' ? `${row.show}: ${row.name}` : row.name);
function tree(rows) {
  const nodes = new Map(rows.map(row => [row.id, { row, items: [] }]));
  const open = [];
  for (const row of rows) {
    open.length = row.depth;
    if (row.depth > 0) open[row.depth - 1].items.push(nodes.get(row.id));
    if (row.kind === 'playlist') open[row.depth] = nodes.get(row.id);
  }
  return nodes;
}
// The composite design: each playlist forwards to its items, in order.
function composite(node) {
  if (node.row.kind !== 'playlist') return { seconds: node.row.seconds, queue: [titleOf(node.row)], visits: [node.row.id] };
  const parts = node.items.map(composite);
  return {
    seconds: parts.reduce((total, part) => total + part.seconds, 0),
    queue: parts.flatMap(part => part.queue),
    visits: [node.row.id, ...parts.flatMap(part => part.visits)],
  };
}
// The first design: songs, then nested playlists, then episodes, whose
// duration loop is missing.
function first(node) {
  if (node.row.kind !== 'playlist') return { seconds: node.row.seconds, queue: [titleOf(node.row)] };
  const kinds = kind => node.items.filter(item => item.row.kind === kind).map(first);
  const [songs, playlists, episodes] = ['song', 'playlist', 'episode'].map(kinds);
  return {
    seconds: [...songs, ...playlists].reduce((total, part) => total + part.seconds, 0),
    queue: [...songs, ...playlists, ...episodes].flatMap(part => part.queue),
  };
}
const rowsFor = panel => (['added', 'uncounted'].includes(panel.episode) ? [...library.rows, episode] : library.rows);
const base = tree(library.rows);
const withEpisode = tree([...library.rows, episode]);

test('the expected results follow from the library in both designs', () => {
  const { expected } = library;
  for (const id of ['road_trip', 'throwbacks', 'sunroof']) {
    const { seconds, queue } = composite(base.get(id));
    assert.deepEqual({ seconds, queue }, expected[id], `composite design: ${id}`);
    assert.equal(first(base.get(id)).seconds, expected[id].seconds, `first design: ${id} has the same length`);
  }
  assert.deepEqual(first(base.get('road_trip')).queue, expected.first_design_road_trip);
  assert.notDeepEqual(expected.first_design_road_trip, expected.road_trip.queue, 'the first design loses the order');
  const { seconds, queue } = composite(withEpisode.get('road_trip'));
  assert.deepEqual({ seconds, queue }, expected.with_episode);
});

test('every illustrated panel shows what its design computes', () => {
  for (const [name, panel] of Object.entries(library.panels)) {
    assert.ok(['composite', 'first'].includes(panel.design), `${name}: design`);
    const rows = rowsFor(panel);
    const ids = rows.map(row => row.id);
    for (const id of [...(panel.marked || []), ...(panel.visited || []), ...Object.keys(panel.flags || {})]) {
      assert.ok(ids.includes(id), `${name}: ${id} is a drawn row`);
    }
    if (panel.marked) assert.ok(panel.mark, `${name}: marked rows say why`);
    assert.ok(panel.note, `${name}: every panel explains itself`);
    if (!panel.played) {
      assert.equal(panel.queue, undefined, `${name}: nothing played, so no queue`);
      continue;
    }
    assert.ok(ids.includes(panel.played), `${name}: played row exists`);
    const node = tree(rows).get(panel.played);
    if (panel.visited) {
      // A trace shows play part of the way through the composite design.
      assert.equal(panel.design, 'composite');
      const { visits } = composite(node);
      assert.deepEqual(panel.visited, visits.slice(0, panel.visited.length), `${name}: visits follow the tree`);
      const leaves = panel.visited.map(id => rows.find(row => row.id === id)).filter(row => row.kind !== 'playlist');
      assert.deepEqual(panel.queue, leaves.map(titleOf), `${name}: the queue holds the visited leaves`);
      if (panel.current) assert.ok(panel.visited.includes(panel.current), `${name}: current row was visited`);
    } else {
      const design = panel.design === 'first' ? first : composite;
      assert.deepEqual(panel.queue, design(node).queue, `${name}: queue`);
    }
  }
});

test('every section ends in a valid check, and the last one is a multi-question summary', () => {
  assert.deepEqual(Object.keys(quizzes), story.scenes.map(scene => scene.id));
  const final = quizzes[story.scenes.at(-1).id];
  assert.ok(final.questions.length >= 6, 'The summary quiz covers every part of the pattern.');
  const keys = [];
  for (const scene of story.scenes) {
    const check = quizzes[scene.id];
    for (const question of check.questions || [check]) {
      assert.match(question.question, /Composite|pattern/, `${scene.id}: the stem names the pattern`);
      assert.ok(question.options.length >= 3 && question.explanation.trim());
      assert.ok(Number.isInteger(question.correct_index) && question.options[question.correct_index]);
      keys.push(question.correct_index);
      for (const index of Object.keys(question.option_feedback || {})) {
        assert.notEqual(Number(index), question.correct_index, `${scene.id}: feedback on the correct option never fires`);
        assert.ok(question.options[Number(index)], `${scene.id}: feedback names a real option`);
      }
    }
  }
  for (const index of [0, 1, 2]) assert.ok(keys.filter(key => key === index).length >= 4, `the key sits at index ${index} often enough`);
});

test('every cue names real code, diagram, and panel targets', () => {
  for (const scene of story.scenes) {
    for (const cue of scene.cues) {
      if (cue.focus) {
        assert.ok(scene.code, `${scene.id}/${cue.id}: focus without code`);
        for (const language of story.languages) {
          assert.ok(examples[language].blocks[scene.code].focus[cue.focus], `${language}/${scene.id}/${cue.focus}`);
        }
      }
      if (cue.ui_state) {
        assert.ok(scene.ui, `${scene.id}/${cue.id}: a panel state without the panel`);
        assert.ok(cue.ui_state in library.panels, `${scene.id}/${cue.id}: ${cue.ui_state}`);
      } else {
        assert.ok(!scene.ui, `${scene.id}/${cue.id}: the panel needs a state`);
      }
      const diagram = story.diagrams[cue.diagram || scene.diagram];
      if (cue.diagram_steps) assert.ok(cue.diagram_steps >= 1 && cue.diagram_steps <= diagram.steps.length);
      if (cue.diagram_focus) {
        const declared = new RegExp(`^(class|interface|participant) ${cue.diagram_focus}\\b`, 'm');
        assert.match(diagram.source, declared, `${scene.id}/${cue.id}: ${cue.diagram_focus} is declared`);
      }
    }
  }
});

test('code blocks exist in all four languages and their marks name real lines', () => {
  assert.deepEqual(Object.keys(examples).sort(), ['cpp', 'java', 'python', 'typescript']);
  for (const [language, example] of Object.entries(examples)) {
    for (const name of ['problem', ...story.example_order]) {
      const lines = example.blocks[name].source.trimEnd().split('\n');
      assert.ok(Object.keys(example.blocks[name].focus).length > 0, `${language}/${name}: at least one mark`);
      for (const marks of Object.values(example.blocks[name].focus)) {
        assert.ok(marks.length > 0);
        for (const line of marks) {
          assert.ok(line >= 1 && line <= lines.length, `${language}/${name}: line ${line}`);
          assert.ok(lines[line - 1].trim(), `${language}/${name}: line ${line} is not blank`);
        }
      }
    }
  }
});

test('predictions leave thinking time, and every check follows a viewing pause', () => {
  // js/narration-transport.js opens a check 0.3 s before the section boundary,
  // so 2.5 s of silence leaves 2.2 s to inspect the finished picture.
  for (const scene of story.scenes) {
    assert.ok(scene.cues.at(-1).pause_after >= 2.5, `${scene.id} ends with too little silence`);
    scene.cues.forEach((cue, index) => {
      if (!cue.prediction) return;
      assert.ok(cue.pause_after >= 5, `${scene.id}/${cue.id}: a prediction needs time to think`);
      assert.ok(index < scene.cues.length - 1, `${scene.id}/${cue.id}: the answer follows in the same section`);
    });
  }
});

test('speech, captions, and timing are generated from the published storyboard', () => {
  const timing = JSON.parse(read('_data/explainers/composite_timing.json'));
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

// Each harness rebuilds the library from its rows and prints
// name|seconds|title;title;... for Road Trip, Throwbacks, and one song. The
// composite harness then adds a podcast episode, a new leaf class the lesson
// never wrote, and shares one song with a second playlist; the first-design
// harness shows its own queue order.
const reported = ['road_trip', 'throwbacks', 'sunroof'];
const expectedLine = (name, { seconds, queue }) => `${name}|${seconds}|${queue.join(';')}`;
const nameOf = id => library.rows.find(row => row.id === id).name;
const literal = value => JSON.stringify(value);

function builder(language, design) {
  const statements = [];
  for (const row of library.rows) {
    const parent = [...library.rows].slice(0, library.rows.indexOf(row)).reverse().find(other => other.depth === row.depth - 1);
    const make = row.kind === 'playlist' ? `Playlist(${literal(row.name)})` : `Song(${literal(row.name)}, ${row.seconds})`;
    const add = design === 'first' ? (row.kind === 'playlist' ? 'add_playlist' : 'add_song') : 'add';
    const call = language === 'python' ? add : add.replace(/_(\w)/, (_, letter) => letter.toUpperCase());
    if (language === 'python') statements.push(`${row.id} = ${make}`);
    if (language === 'typescript') statements.push(`const ${row.id} = new ${make};`);
    if (language === 'java') statements.push(`${row.kind === 'playlist' ? 'Playlist' : 'Song'} ${row.id} = new ${make};`);
    if (language === 'cpp') {
      statements.push(row.kind === 'playlist' || design !== 'first'
        ? `auto ${row.id} = std::make_shared<${row.kind === 'playlist' ? 'Playlist' : 'Song'}>(${make.replace(/^\w+\(|\)$/g, '')});`
        : `Song ${row.id}{${make.replace(/^\w+\(|\)$/g, '')}};`);
    }
    if (parent) statements.push(`${parent.id}${language === 'cpp' ? '->' : '.'}${call}(${row.id})${language === 'python' ? '' : ';'}`);
  }
  return statements.join('\n');
}

function harness(language, design) {
  const build = builder(language, design);
  const seconds = id => {
    const row = library.rows.find(candidate => candidate.id === id);
    const arrow = language === 'cpp' && (row.kind === 'playlist' || design !== 'first') ? '->' : '.';
    if (design === 'first' && row.kind === 'song') return language === 'java' ? `${id}.seconds()` : `${id}${arrow}seconds`;
    return `${id}${arrow}duration()`;
  };
  if (language === 'python') {
    const show = id => `show(${literal(nameOf(id))}, ${seconds(id)}, PlayButton(${id}).press())`;
    return `
def show(name, seconds, queue):
    print(f"{name}|{seconds}|{';'.join(queue)}")
${build}
${reported.map(show).join('\n')}
${design === 'first' ? '' : `
@dataclass(frozen=True)
class Episode(Playable):
    show: str
    title: str
    seconds: int

    def duration(self) -> int:
        return self.seconds

    def play(self, queue: list[str]) -> None:
        queue.append(f"{self.show}: {self.title}")


road_trip.add(Episode(${literal(episode.show)}, ${literal(episode.name)}, ${episode.seconds}))
${show('road_trip')}
gym = Playlist("Gym")
gym.add(sunroof)
show("Gym", gym.duration(), PlayButton(gym).press())`}
`;
  }
  if (language === 'typescript') {
    const show = id => `show(${literal(nameOf(id))}, ${seconds(id)}, new PlayButton(${id}).press());`;
    return `
function show(name: string, seconds: number, queue: string[]): void {
  console.log(\`\${name}|\${seconds}|\${queue.join(";")}\`);
}
${build}
${reported.map(show).join('\n')}
${design === 'first' ? '' : `
class Episode implements Playable {
  readonly show: string;
  readonly title: string;
  readonly seconds: number;

  constructor(show: string, title: string, seconds: number) {
    this.show = show;
    this.title = title;
    this.seconds = seconds;
  }

  duration(): number {
    return this.seconds;
  }

  play(queue: string[]): void {
    queue.push(\`\${this.show}: \${this.title}\`);
  }
}

road_trip.add(new Episode(${literal(episode.show)}, ${literal(episode.name)}, ${episode.seconds}));
${show('road_trip')}
const gym = new Playlist("Gym");
gym.add(sunroof);
show("Gym", gym.duration(), new PlayButton(gym).press());`}
`;
  }
  if (language === 'java') {
    const show = id => `show(${literal(nameOf(id))}, ${seconds(id)}, new PlayButton(${id}).press());`;
    return `
${design === 'first' ? '' : `record Episode(String show, String title, int seconds) implements Playable {
    @Override
    public int duration() {
        return seconds;
    }

    @Override
    public void play(List<String> queue) {
        queue.add(show + ": " + title);
    }
}
`}
public class CompositeDemo {
    static void show(String name, int seconds, List<String> queue) {
        System.out.println(name + "|" + seconds + "|" + String.join(";", queue));
    }

    public static void main(String[] args) {
${build.split('\n').map(line => `        ${line}`).join('\n')}
        ${reported.map(show).join('\n        ')}
${design === 'first' ? '' : `        road_trip.add(new Episode(${literal(episode.show)}, ${literal(episode.name)}, ${episode.seconds}));
        ${show('road_trip')}
        Playlist gym = new Playlist("Gym");
        gym.add(sunroof);
        show("Gym", gym.duration(), new PlayButton(gym).press());`}
    }
}
`;
  }
  const show = id => `show(${literal(nameOf(id))}, ${seconds(id)}, PlayButton(${id}).press());`;
  return `
${design === 'first' ? '' : `class Episode : public Playable {
    std::string show_;
    std::string title_;
    int seconds_;

public:
    Episode(std::string show, std::string title, int seconds)
        : show_(std::move(show)), title_(std::move(title)), seconds_(seconds) {}

    int duration() const override { return seconds_; }
    void play(std::vector<std::string>& queue) const override {
        queue.push_back(show_ + ": " + title_);
    }
};
`}
void show(const std::string& name, int seconds, const std::vector<std::string>& queue) {
    std::cout << name << '|' << seconds << '|';
    for (std::size_t i = 0; i < queue.size(); ++i) std::cout << (i > 0 ? ";" : "") << queue[i];
    std::cout << '\\n';
}

int main() {
${build.split('\n').map(line => `    ${line}`).join('\n')}
    ${reported.map(show).join('\n    ')}
${design === 'first' ? '' : `    road_trip->add(std::make_shared<Episode>(${literal(episode.show)}, ${literal(episode.name)}, ${episode.seconds}));
    ${show('road_trip')}
    auto gym = std::make_shared<Playlist>("Gym");
    gym->add(sunroof);
    show("Gym", gym->duration(), PlayButton(gym).press());`}
}
`;
}

// Both designs must give the specified lengths, the composite must keep the
// listener's order, take a new kind of leaf without changes, and share a song,
// and the first design must show the order it loses. Compilers are optional
// for a local unit run; release checks should supply all four.
for (const language of story.languages) {
  test(`${examples[language].label}: both designs give the specified lengths and queues`, t => {
    const tool = { python: 'python3', java: 'javac', cpp: 'clang++', typescript: process.execPath }[language];
    if (spawnSync(tool, [language === 'java' ? '-version' : '--version']).status !== 0) {
      t.skip(`${tool} is required to execute this language`);
      return;
    }
    const example = examples[language];
    const directory = mkdtempSync(path.join(tmpdir(), 'composite-example-'));
    const block = name => example.blocks[name].source;
    const after = [example.imports, ...story.example_order.filter(name => name !== 'wire').map(block)].join('\n');
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
    const { expected } = library;
    try {
      assert.equal(run(`${after}\n${block('wire')}`),
        `${nameOf('road_trip')}: ${expected.road_trip.seconds} seconds\n${expected.road_trip.queue.join(', ')}\n`);
      const composed = [
        ...reported.map(id => expectedLine(nameOf(id), expected[id])),
        expectedLine(nameOf('road_trip'), expected.with_episode),
        expectedLine('Gym', expected.sunroof),
      ];
      assert.equal(run(`${after}\n${harness(language, 'composite')}`), `${composed.join('\n')}\n`);
      const firstDesign = [
        expectedLine(nameOf('road_trip'), { seconds: expected.road_trip.seconds, queue: expected.first_design_road_trip }),
        ...reported.slice(1).map(id => expectedLine(nameOf(id), expected[id])),
      ];
      assert.equal(run(`${example.imports}\n${block('problem')}\n${harness(language, 'first')}`), `${firstDesign.join('\n')}\n`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
