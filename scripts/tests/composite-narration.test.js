// The Composite lesson's photo collage: its oracle, its four-language code,
// its storyboard, and its generated speech. The specification of both designs
// lives in tests/helpers/composite-collage.js and is pinned here against the
// hand-derived values in _data/explainers/composite_ui.yml.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const collageSpec = require('../../tests/helpers/composite-collage');

const collage = collageSpec.load();
const { tree, share, part, position, rowsFor, canvasDescription, pressDescription, rowTags } = collageSpec;
const plain = tree(collage.rows);
const captioned = tree(collage.captioned_rows);
const designs = ['composite', 'first'];
// Every tile of both trees, shared alone, in both designs.
const everyShare = () => [plain, captioned].flatMap(nodes => [...nodes.keys()]
  .flatMap(id => designs.map(design => ({ nodes, id, design, result: share(nodes, id, design) }))));

// Parts of one cut lie side by side (or stacked) with equal sizes, starting at
// the area's edge, each touching the next, and ending at the opposite edge.
function assertCoveredExactly(area, parts, direction, label) {
  const [x, y, width, height] = area;
  const [along, size, start, total] = direction === 'side by side' ? [0, 2, x, width] : [1, 3, y, height];
  const [across, acrossSize] = direction === 'side by side' ? [1, 3] : [0, 2];
  assert.ok(parts.every(piece => piece[size] === parts[0][size]), `${label}: parts have equal sizes`);
  assert.ok(parts.every(piece => piece[across] === area[across] && piece[acrossSize] === area[acrossSize]), `${label}: parts span the area`);
  assert.equal(parts[0][along], start, `${label}: the first part starts at the edge`);
  parts.slice(1).forEach((piece, index) => {
    assert.equal(piece[along], parts[index][along] + parts[index][size], `${label}: part ${index + 1} touches the one before`);
  });
  assert.equal(parts.at(-1)[along] + parts.at(-1)[size], start + total, `${label}: the last part ends at the edge`);
}

test('the area helper cuts each split\'s area into equal parts that cover it exactly', () => {
  assert.deepEqual(part([0, 0, 1080, 1920], 1, 2, 'side by side'), [540, 0, 540, 1920]);
  assert.deepEqual(part([540, 0, 540, 1920], 1, 2, 'stacked'), [540, 960, 540, 960]);
  for (const { nodes, id, design, result } of everyShare()) {
    for (const cut of result.cuts) {
      const split = nodes.get(cut.tile);
      const parts = split.tiles.map((_, index) => part(cut.area, index, split.tiles.length, split.row.direction));
      assertCoveredExactly(cut.area, parts, split.row.direction, `${design} share of ${id}: ${cut.tile}`);
    }
  }
});

test('the expected canvases follow from the rows in both designs', () => {
  const { expected } = collage;
  for (const design of designs) {
    assert.deepEqual(share(plain, 'story', design).drawn, expected.start.drawn, `${design} design: the photo story`);
    assert.equal(share(plain, 'story', design).photos, expected.start.photos);
    assert.equal(share(captioned, 'story', design).photos, 4, `${design} design: a caption has no photos`);
  }
  assert.deepEqual(share(captioned, 'story', 'composite').drawn, expected.caption.drawn, 'composite design: the captioned story');
  assert.deepEqual(share(captioned, 'story', 'first').drawn, expected.first_design_caption.drawn, 'first design: the captioned story');
  for (const name of ['start', 'caption', 'first_design_caption']) assert.equal(expected[name].photos, 4, name);
  assert.ok(expected.caption.drawn.some(entry => entry.tile === 'caption'), 'the composite draws the caption');
  assert.ok(!expected.first_design_caption.drawn.some(entry => entry.tile === 'caption'), 'the first design leaves the caption out');
});

test('every area a Share press can produce sits on the 4 × 4 grid and has position words', () => {
  for (const { id, design, result } of everyShare()) {
    for (const { tile, area } of [...result.drawn, ...result.skipped, ...result.cuts]) {
      const [x, y, width, height] = area;
      assert.ok(x % 270 === 0 && width % 270 === 0 && y % 480 === 0 && height % 480 === 0,
        `${design} share of ${id}: ${tile} at ${area} is off the grid`);
    }
    for (const { tile, area } of [...result.drawn, ...result.skipped]) {
      assert.doesNotThrow(() => position(collage, area), `${design} share of ${id}: ${tile} at ${area}`);
    }
  }
});

test('every illustrated panel names tiles, marks, and traces that its design and tree produce', () => {
  for (const [name, panel] of Object.entries(collage.panels)) {
    assert.ok(designs.includes(panel.design), `${name}: design`);
    assert.ok([undefined, 'pending', 'added'].includes(panel.caption), `${name}: caption`);
    const rows = rowsFor(collage, panel);
    const ids = rows.map(row => row.id);
    const named = [...(panel.marked || []), ...Object.keys(panel.flags || {}), ...(panel.drawn || []), ...(panel.current ? [panel.current] : [])];
    for (const id of named) assert.ok(ids.includes(id), `${name}: ${id} is a tile of its tree`);
    if (panel.marked) assert.ok(panel.mark, `${name}: marked tiles say why`);
    assert.ok(panel.note && panel.note.trim().split(/\s+/).length <= 20, `${name}: a note of at most 20 words`);
    if (panel.drawn) {
      const order = share(tree(rows), 'story', panel.design).drawn.map(entry => entry.tile);
      assert.deepEqual(panel.drawn, order.slice(0, panel.drawn.length), `${name}: the trace follows the drawing order`);
    }
    if (panel.current) assert.equal(rows.find(row => row.id === panel.current).kind, 'split', `${name}: only a split cuts its area`);
    for (const neighbor of panel.neighbors || []) assert.ok(['carousel', 'frame'].includes(neighbor), `${name}: ${neighbor}`);
    if (panel.design === 'first' && panel.caption === 'added') {
      assert.equal(panel.flags?.caption, 'not drawn', `${name}: the blank caption is labeled`);
    }
  }
  assert.doesNotMatch(collage.panels.new_kinds.note, /caption/i, 'new_kinds stays general, so the transfer stays a prediction');
});

test('the helper describes canvases and rows the way the lesson words them', () => {
  const { panels } = collage;
  const right = 'cat, top right quarter; gig, left half of the bottom right quarter; taco, right half of the bottom right quarter';
  assert.equal(canvasDescription(collage, panels.start), `Canvas, in reading order: beach, left half; ${right}.`);
  assert.equal(canvasDescription(collage, panels.trace_press), 'Canvas: nothing drawn yet.');
  assert.equal(canvasDescription(collage, panels.trace_drawn),
    'Canvas, in reading order: beach, left half, drawn 1st; cat, top right quarter, drawn 2nd; '
    + 'gig, left half of the bottom right quarter, drawn 3rd; taco, right half of the bottom right quarter, drawn 4th.');
  assert.equal(canvasDescription(collage, panels.first_caption_blank),
    `Canvas, in reading order: beach, top left quarter; caption "core memories", bottom left quarter, tagged not drawn; ${right}.`);
  assert.equal(canvasDescription(collage, panels.caption),
    `Canvas, in reading order: beach, top left quarter; caption "core memories", bottom left quarter, tagged new; ${right}.`);
  assert.equal(canvasDescription(collage, panels.photo_shared),
    `Canvas, in reading order: beach, left half, tagged also in another story; ${right}.`);
  assert.match(canvasDescription(collage, panels.frame), /; cat, top right quarter, in a polaroid frame; /);
  assert.equal(pressDescription(collage, panels.start, 'bottom'), 'Canvas, in reading order: gig, left half; taco, right half.');
  assert.equal(pressDescription(collage, panels.start, 'beach'), 'Canvas, in reading order: beach, the whole story.');
  assert.equal(pressDescription(collage, panels.first_caption_blank, 'left'),
    'Canvas, in reading order: beach, top half; caption "core memories", bottom half, tagged not drawn.');
  assert.equal(pressDescription(collage, panels.first_caption_blank, 'caption'),
    'Canvas, in reading order: caption "core memories", the whole story.');
  assert.equal(pressDescription(collage, panels.caption, 'left'), 'Canvas, in reading order: beach, top half; caption "core memories", bottom half.');
  const tagsOf = (panel, id) => rowTags(collage, panel, rowsFor(collage, panel).find(row => row.id === id));
  assert.deepEqual(tagsOf(panels.start, 'story'), []);
  assert.deepEqual(tagsOf(panels.trace_press, 'story'), ['drawing']);
  assert.deepEqual(tagsOf(panels.trace_drawn, 'gig'), ['drawn 3rd']);
  assert.deepEqual(tagsOf(panels.photo_shared, 'beach'), ['Photo', 'also in another story']);
  assert.deepEqual(tagsOf(panels.role_client, 'cat'), ['Client']);
  assert.deepEqual(tagsOf(panels.first_caption_blank, 'caption'), ['not drawn']);
});

// ---------------------------------------------------------------------------
// The four-language code. Every cue marks lines by a focus key, so every
// language must offer the same keys for each block.
const { loadStory } = require('../narration/source');
const { readFileSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const story = loadStory('composite');
const examples = yaml.load(readFileSync(path.join(root, '_data/explainers/composite_code.yml'), 'utf8'));
const FOCUS_KEYS = {
  area: ['part'],
  problem: ['area', 'types', 'branches', 'client', 'changes'],
  tile: ['interface', 'draw'],
  photo: ['requests', 'fields'],
  split: ['tiles', 'count', 'draw', 'add', 'press', 'result'],
  caption: ['class'],
  wire: ['build', 'print'],
};

test('the complete example lists the blocks in teaching order', () => {
  assert.deepEqual(story.example_order, ['area', 'tile', 'photo', 'split', 'caption', 'wire']);
  assert.deepEqual(Object.keys(examples).sort(), ['cpp', 'java', 'python', 'typescript']);
});

for (const language of story.languages) {
  test(`${examples[language].label}: code blocks exist and their marks name real lines`, () => {
    for (const [name, keys] of Object.entries(FOCUS_KEYS)) {
      const block = examples[language].blocks[name];
      assert.ok(block, `${language} has a ${name} block`);
      assert.deepEqual(Object.keys(block.focus).sort(), [...keys].sort(), `${language}/${name}: focus keys`);
      const lines = block.source.trimEnd().split('\n');
      for (const [key, marks] of Object.entries(block.focus)) {
        assert.ok(marks.length > 0, `${language}/${name}/${key}: at least one line`);
        for (const line of marks) {
          assert.ok(line >= 1 && line <= lines.length, `${language}/${name}/${key}: line ${line} exists`);
          assert.ok(lines[line - 1].trim(), `${language}/${name}/${key}: line ${line} is not blank`);
        }
      }
    }
  });
}

// Each harness builds trees with the lesson's classes and prints one line per
// press of Share: name|photo count|drawn line;drawn line;... The expected text
// comes from the specification, so every language must draw what it draws.
const partyRows = [
  { id: 'party', kind: 'split', direction: 'stacked', depth: 0 },
  { id: 'gif', kind: 'gif', name: 'dance', depth: 1 },
  { id: 'taco', kind: 'photo', depth: 1 },
];
const linesOf = (rows, id, design) => {
  const rowsById = new Map(rows.map(row => [row.id, row]));
  return share(tree(rows), id, design).drawn.map(entry => collageSpec.line(entry, rowsById));
};
const report = (name, rows, id, design) => `${name}|${share(tree(rows), id, design).photos}|${linesOf(rows, id, design).join(';')}`;
const expectedComposite = [
  ...collage.rows.map(row => report(row.id, collage.rows, row.id, 'composite')),
  report('story2', collage.captioned_rows, 'story', 'composite'),
  report('left', collage.captioned_rows, 'left', 'composite'),
  report('story', collage.rows, 'story', 'composite'),
  report('party', partyRows, 'party', 'composite'),
];
const expectedFirst = [
  ...['story', 'right', 'bottom', 'beach'].map(id => report(id, collage.rows, id, 'first')),
  report('story2', collage.captioned_rows, 'story', 'first'),
  report('left', collage.captioned_rows, 'left', 'first'),
];
const expectedWire = [
  `story: ${collage.expected.caption.photos} photos`,
  ...collage.expected.caption.drawn.map(entry => collageSpec.line(entry, new Map(collage.captioned_rows.map(row => [row.id, row])))),
];

// How each language spells the harness statements. A first-design photo or
// caption is a plain value in C++; everything else is built the same way in
// both designs.
const DIRECTIONS = {
  python: { 'side by side': 'Direction.SIDE_BY_SIDE', stacked: 'Direction.STACKED' },
  java: { 'side by side': 'Direction.SIDE_BY_SIDE', stacked: 'Direction.STACKED' },
  cpp: { 'side by side': 'Direction::SideBySide', stacked: 'Direction::Stacked' },
  typescript: { 'side by side': '"side by side"', stacked: '"stacked"' },
};
function statement(language, design, kind, ...args) {
  const end = language === 'python' ? '' : ';';
  const [id, value] = args;
  const literal = JSON.stringify(value);
  if (kind === 'add') return language === 'cpp' ? `${id}->add(${value});` : `${id}.add(${value})${end}`;
  if (kind === 'report') return `report(${JSON.stringify(id)}, ${value})${end}`;
  const make = {
    split: { cls: 'Split', arg: DIRECTIONS[language][value] },
    photo: { cls: 'Photo', arg: literal },
    caption: { cls: 'Caption', arg: literal },
  }[kind];
  if (language === 'python') return `${id} = ${make.cls}(${make.arg})`;
  if (language === 'typescript') return `const ${id} = new ${make.cls}(${make.arg});`;
  if (language === 'java') return `${kind === 'split' ? 'Split' : make.cls} ${id} = new ${make.cls}(${make.arg});`;
  if (design === 'first' && kind !== 'split') return `${make.cls} ${id}{${make.arg}};`;
  return `auto ${id} = std::make_shared<${make.cls}>(${make.arg});`;
}
function buildStory(language, design) {
  const lines = collage.rows.map(row => statement(language, design, row.kind, row.id, row.kind === 'split' ? row.direction : row.id));
  for (const [index, row] of collage.rows.entries()) {
    const parent = collage.rows.slice(0, index).reverse().find(other => other.depth === row.depth - 1);
    if (parent) lines.push(statement(language, design, 'add', parent.id, row.id));
  }
  return lines;
}
// The captioned story reuses the photo story's beach and right objects.
function buildCaptioned(language, design) {
  return [
    statement(language, design, 'split', 'left', 'stacked'),
    statement(language, design, 'caption', 'caption', 'core memories'),
    statement(language, design, 'split', 'story2', 'side by side'),
    statement(language, design, 'add', 'left', 'beach'),
    statement(language, design, 'add', 'left', 'caption'),
    statement(language, design, 'add', 'story2', 'left'),
    statement(language, design, 'add', 'story2', 'right'),
  ];
}
function harnessStatements(language, design) {
  const say = (name, variable = name) => statement(language, design, 'report', name, variable);
  if (design === 'first') {
    return [...buildStory(language, design), ...['story', 'right', 'bottom', 'beach'].map(id => say(id)),
      ...buildCaptioned(language, design), say('story2'), say('left')];
  }
  return [...buildStory(language, design), ...collage.rows.map(row => say(row.id)),
    ...buildCaptioned(language, design), say('story2'), say('left'), say('story'),
    statement(language, design, 'split', 'party', 'stacked'),
    language === 'cpp' ? 'party->add(std::make_shared<Gif>("dance"));' : statement(language, design, 'add', 'party', language === 'python' ? 'Gif("dance")' : 'new Gif("dance")'),
    statement(language, design, 'add', 'party', 'taco'), say('party')];
}

// The report function and the extra classes each harness needs.
const HARNESS = {
  python: {
    composite: `
def report(name: str, tile: Tile) -> None:
    print(f"{name}|{tile.photo_count()}|{';'.join(ShareButton(tile).press())}")


@dataclass(frozen=True)
class Gif(Tile):
    name: str

    def draw(self, area: Area, canvas: list[str]) -> None:
        canvas.append(f"gif {self.name} {area}")

    def photo_count(self) -> int:
        return 0
`,
    first: `
@dataclass(frozen=True)
class Caption:
    text: str


def report(name: str, item: Photo | Split) -> None:
    count = 1 if isinstance(item, Photo) else item.photo_count()
    print(f"{name}|{count}|{';'.join(ShareButton(item).press())}")
`,
  },
  typescript: {
    composite: `
function report(name: string, tile: Tile): void {
  console.log(\`\${name}|\${tile.photoCount()}|\${new ShareButton(tile).press().join(";")}\`);
}

class Gif implements Tile {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  draw(area: Area, canvas: string[]): void {
    canvas.push(\`gif \${this.name} \${area}\`);
  }

  photoCount(): number {
    return 0;
  }
}
`,
    first: `
class Caption {
  readonly text: string;

  constructor(text: string) {
    this.text = text;
  }
}

function report(name: string, item: Item): void {
  // With captions in Item, this client needs its own caption branch too.
  const count = item instanceof Photo ? 1 : item instanceof Split ? item.photoCount() : 0;
  console.log(\`\${name}|\${count}|\${new ShareButton(item).press().join(";")}\`);
}
`,
  },
  java: {
    composite: `
record Gif(String name) implements Tile {
    @Override
    public void draw(Area area, List<String> canvas) {
        canvas.add("gif " + name + " " + area);
    }

    @Override
    public int photoCount() {
        return 0;
    }
}
`,
    first: `
record Caption(String text) {}
`,
    report: {
      composite: `    static void report(String name, Tile tile) {
        System.out.println(name + "|" + tile.photoCount() + "|" + String.join(";", new ShareButton(tile).press()));
    }`,
      first: `    static void report(String name, Object item) {
        int count = item instanceof Photo ? 1 : ((Split) item).photoCount();
        System.out.println(name + "|" + count + "|" + String.join(";", new ShareButton(item).press()));
    }`,
    },
  },
  cpp: {
    composite: `
class Gif : public Tile {
    std::string name_;

public:
    explicit Gif(std::string name) : name_(std::move(name)) {}

    void draw(const Area& area, std::vector<std::string>& canvas) const override {
        canvas.push_back("gif " + name_ + " " + area.str());
    }

    int photoCount() const override { return 0; }
};

void report(const std::string& name, const std::shared_ptr<const Tile>& tile) {
    print(name, tile->photoCount(), ShareButton(tile).press());
}
`,
    first: `
void report(const std::string& name, const Item& item) {
    const int count = std::holds_alternative<Photo>(item) ? 1 : std::get<std::shared_ptr<const Split>>(item)->photoCount();
    print(name, count, ShareButton(item).press());
}
`,
    print: `
void print(const std::string& name, int count, const std::vector<std::string>& canvas) {
    std::cout << name << '|' << count << '|';
    for (std::size_t i = 0; i < canvas.size(); ++i) std::cout << (i > 0 ? ";" : "") << canvas[i];
    std::cout << '\\n';
}
`,
  },
};

// The first design declares its "photo or split" type once. When captions
// arrive, TypeScript and C++ must widen it before a caption fits in a split.
const WIDEN = {
  typescript: [/^type Item = Photo \| Split;$/m, 'type Item = Photo | Split | Caption;'],
  cpp: [/^using Item = std::variant<Photo, SplitPtr>;$/m,
    'struct Caption {\n    std::string text;\n};\nusing Item = std::variant<Photo, Caption, SplitPtr>;'],
};
function firstDesign(language) {
  const source = examples[language].blocks.problem.source;
  if (!WIDEN[language]) return source;
  const [declaration, widened] = WIDEN[language];
  assert.equal((source.match(new RegExp(declaration.source, 'gm')) || []).length, 1, `${language}: the first design declares Item once`);
  return source.replace(declaration, widened);
}

function harness(language, design) {
  const statements = harnessStatements(language, design);
  const own = HARNESS[language][design];
  if (language === 'python' || language === 'typescript') return `${own}\n${statements.join('\n')}\n`;
  if (language === 'java') {
    return `${own}
public class CompositeDemo {
${HARNESS.java.report[design]}

    public static void main(String[] args) {
${statements.map(line => `        ${line}`).join('\n')}
    }
}
`;
  }
  return `${HARNESS.cpp.print}${own}
int main() {
${statements.map(line => `    ${line}`).join('\n')}
}
`;
}

// The three programs each language must run: the reader's complete example,
// the composite design under the harness, and the first design under it.
function programsFor(language) {
  const example = examples[language];
  const block = name => example.blocks[name].source;
  const composite = [example.imports, ...story.example_order.filter(name => name !== 'wire').map(block)].join('\n');
  return {
    complete: `${composite}\n${block('wire')}`,
    composite: `${composite}\n${harness(language, 'composite')}`,
    first: `${example.imports}\n${block('area')}\n${firstDesign(language)}\n${harness(language, 'first')}`,
  };
}

const TOOLS = { python: 'python3', java: 'javac', cpp: 'clang++', typescript: process.execPath };
function runProgram(language, directory, program) {
  const example = examples[language];
  writeFileSync(path.join(directory, example.filename), program);
  const options = { cwd: directory, encoding: 'utf8', timeout: 60000 };
  if (language === 'python') return execFileSync('python3', [example.filename], options);
  if (language === 'typescript') {
    return execFileSync(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', example.filename], options);
  }
  if (language === 'java') {
    execFileSync('javac', [example.filename], options);
    return execFileSync('java', [example.filename.replace('.java', '')], options);
  }
  execFileSync('clang++', ['-std=c++17', '-Wall', '-Wextra', '-pedantic', '-Werror', example.filename, '-o', 'example'], options);
  return execFileSync(path.join(directory, 'example'), [], options);
}

for (const language of story.languages) {
  test(`${examples[language].label}: both designs draw what the specification draws`, t => {
    const tool = TOOLS[language];
    if (spawnSync(tool, [language === 'java' ? '-version' : '--version']).status !== 0) {
      t.skip(`${tool} is required to run this language`);
      return;
    }
    const programs = programsFor(language);
    const directory = mkdtempSync(path.join(tmpdir(), 'composite-collage-'));
    try {
      assert.equal(runProgram(language, directory, programs.complete), `${expectedWire.join('\n')}\n`, 'the complete example');
      assert.equal(runProgram(language, directory, programs.composite), `${expectedComposite.join('\n')}\n`, 'the composite design');
      assert.equal(runProgram(language, directory, programs.first), `${expectedFirst.join('\n')}\n`, 'the first design');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

// Node only strips TypeScript's types, so the type checker runs separately:
// the shipped examples, and the first design once it is widened for captions.
test('TypeScript: the complete example and both designs pass tsc --strict', t => {
  let tsc;
  try {
    tsc = require.resolve('typescript/bin/tsc');
  } catch {
    t.skip('the typescript package is required to type-check');
    return;
  }
  const directory = mkdtempSync(path.join(tmpdir(), 'composite-tsc-'));
  try {
    for (const [name, program] of Object.entries(programsFor('typescript'))) {
      const file = path.join(directory, `${name}.ts`);
      writeFileSync(file, program);
      const result = spawnSync(process.execPath, [tsc, '--strict', '--noEmit', '--target', 'es2022', '--lib', 'es2022,dom', file], { encoding: 'utf8' });
      assert.equal(result.status, 0, `${name} program:\n${result.stdout}${result.stderr}`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// The storyboard: scenes, cues, and the targets each cue marks.
const PLANNED = [
  ['intro', null, ['photo-dump', 'try-it', 'pattern-parts']],
  ['context', 'Context', ['part-whole', 'alike', 'trees']],
  ['problem', 'Problem', ['area', 'first-design', 'branches', 'client-check', 'predict-captions', 'every-change', 'demands']],
  ['tile_role', 'Solution', ['shared-type', 'canvas']],
  ['photo_role', 'Solution', ['direct', 'shared']],
  ['split_role', 'Solution', ['one-list', 'count', 'draw', 'safe-add', 'transparent-add']],
  ['collaborations', 'Solution', ['press', 'first-tile', 'recursion', 'loop']],
  ['solution', 'Solution', ['component', 'leaf', 'composite', 'client']],
  ['consequences', 'Consequences', ['simple-clients', 'new-kinds', 'overly-general', 'safety']],
  ['applicability', 'Context', ['fit', 'plain-list', 'neighbors']],
  ['transfer', null, ['plan', 'caption']],
  ['summary', null, ['recap']],
];

test('the storyboard follows the planned scenes, cues, parts, and predictions', () => {
  assert.equal(story.title, 'The Composite pattern in a photo collage');
  assert.deepEqual(story.scenes.map(scene => [scene.id, scene.part ?? null, scene.cues.map(cue => cue.id)]), PLANNED);
  assert.deepEqual(story.scenes.flatMap(scene => scene.cues.filter(cue => cue.prediction).map(cue => `${scene.id}/${cue.id}`)),
    ['problem/predict-captions', 'collaborations/first-tile', 'transfer/plan']);
  assert.ok(story.scenes.every(scene => scene.ui), 'every scene shows the collage');
});

test('every cue names real code, diagram, and panel targets', () => {
  const shown = new Set();
  for (const scene of story.scenes) {
    for (const cue of scene.cues) {
      const at = `${scene.id}/${cue.id}`;
      if (scene.code) {
        assert.ok(cue.focus, `${at}: every cue in a code scene marks its lines`);
        for (const language of story.languages) {
          assert.ok(examples[language].blocks[scene.code].focus[cue.focus], `${language}/${at}: ${scene.code} has ${cue.focus}`);
        }
      } else {
        assert.equal(cue.focus, undefined, `${at}: focus without code`);
      }
      assert.ok(cue.ui_state in collage.panels, `${at}: ${cue.ui_state} is an illustrated panel`);
      shown.add(cue.ui_state);
      const diagram = story.diagrams[cue.diagram || scene.diagram];
      if (cue.diagram) assert.ok(diagram, `${at}: the diagram ${cue.diagram} exists`);
      if (cue.diagram_steps) assert.ok(cue.diagram_steps >= 1 && cue.diagram_steps <= diagram.steps.length, `${at}: diagram steps`);
      if (cue.diagram_focus) {
        assert.match(diagram.source, new RegExp(`^(class|interface|participant) ${cue.diagram_focus}\\b`, 'm'), `${at}: ${cue.diagram_focus} is declared`);
      }
    }
  }
  assert.deepEqual([...shown].sort(), Object.keys(collage.panels).sort(), 'every illustrated panel is shown by some cue');
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
  assert.ok(story.scenes.find(scene => scene.id === 'problem').cues.at(-1).pause_after >= 3, 'the problem section ends with three seconds');
});

test('speech never asks for arithmetic', () => {
  for (const scene of story.scenes) {
    for (const cue of scene.cues) assert.doesNotMatch(cue.text, /\d{3,}|px\b/, `${scene.id}/${cue.id} names pixel numbers`);
  }
});

// ---------------------------------------------------------------------------
// Knowledge checks: one per section, and a summary quiz on a new scenario.
const quizzes = yaml.load(readFileSync(path.join(root, '_data/explainers/composite_quizzes.yml'), 'utf8'));

test('every section ends in a valid check, and the last one is a multi-question summary', () => {
  assert.deepEqual(Object.keys(quizzes), story.scenes.map(scene => scene.id));
  const final = quizzes[story.scenes.at(-1).id];
  assert.ok(final.questions.length >= 6, 'The summary quiz covers every part of the pattern.');
  const keys = [];
  for (const scene of story.scenes) {
    const check = quizzes[scene.id];
    for (const question of check.questions || [check]) {
      assert.match(question.question, /Composite|pattern/, `${scene.id}: the stem names the pattern`);
      assert.ok(question.options.length >= 3 && question.explanation.trim(), `${scene.id}: options and an explanation`);
      assert.ok(Number.isInteger(question.correct_index) && question.options[question.correct_index], `${scene.id}: a real key`);
      keys.push(question.correct_index);
      for (const index of Object.keys(question.option_feedback || {})) {
        assert.notEqual(Number(index), question.correct_index, `${scene.id}: feedback on the correct option never fires`);
        assert.ok(question.options[Number(index)], `${scene.id}: feedback names a real option`);
      }
    }
  }
  for (const index of [0, 1, 2]) assert.ok(keys.filter(key => key === index).length >= 4, `the key sits at index ${index} often enough`);
});
