const { loadStory } = require('../narration/source');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');
require('../../js/uml-analyzer-js.js');
// The exact compiler shipped to the chapter's TypeScript inference.
const typescriptCompiler = require('../../js/vendor/typescript/5.9.3/typescript.min.js');

const root = path.resolve(__dirname, '../..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const story = loadStory('uml_sequence_diagram');
const examples = yaml.load(read('_data/explainers/uml_sequence_diagram_code.yml'));
const quizzes = yaml.load(read('_data/explainers/uml_sequence_diagram_quizzes.yml'));
const notes = yaml.load(read('_data/explainers/uml_sequence_diagram_notes.yml'));
const game = yaml.load(read('_data/explainers/uml_sequence_diagram_ui.yml'));
const timing = JSON.parse(read('_data/explainers/uml_sequence_diagram_timing.json'));
const cues = story.scenes.flatMap(scene => scene.cues.map(cue => ({ scene, cue })));
const fullSource = diagram => diagram.source + (diagram.steps || []).join('');

// The scenarios are the specification the code, the concrete diagrams, and the
// scan panel share: a scan covers three times the probe's level, a fully scanned
// rock gives up its crystals, an unfinished one is tagged for two passes, and
// scanning every rock creates a star map of them and plays the chime.
test('every scenario follows the scan rules that the general diagram describes', () => {
  assert.equal(game.probe.power, 3 * game.probe.level);
  for (const [id, scenario] of Object.entries(game.scenarios)) {
    let crystals = 0;
    let scanned = 0;
    for (const rock of scenario.rocks) {
      const unscanned = Math.max(0, rock.size - game.probe.power);
      assert.equal(rock.unscanned_after, unscanned, `${id}/${rock.name}: points left after the scan`);
      if (unscanned === 0) {
        crystals += rock.crystals;
        scanned += 1;
        assert.deepEqual([rock.crystals_after, rock.tagged_after], [0, 0], `${id}/${rock.name}: gives up its sample`);
      } else {
        assert.deepEqual([rock.crystals_after, rock.tagged_after], [rock.crystals, 2], `${id}/${rock.name}: is tagged`);
      }
    }
    const charted = scanned === scenario.rocks.length;
    assert.equal(scenario.probe_crystals_after, crystals, `${id}: the probe collects the samples`);
    assert.equal(scenario.star_map_after, charted ? scanned : 0, `${id}: a star map appears only when every rock is scanned`);
    assert.deepEqual(scenario.sounds_after, charted ? ['ping', 'chime'] : ['ping'], `${id}: queued sounds`);
  }
  for (const panel of Object.values(game.panels)) assert.ok(game.scenarios[panel.scenario]);
  for (const drone of game.recharge.drones) {
    assert.equal(drone.battery_after, 2 * drone.battery < drone.capacity ? Math.min(drone.capacity, drone.battery + 5) : drone.battery);
  }
});

// The run a scenario specifies, written as the messages a concrete diagram must show.
function expectedTrace(scenario) {
  const messages = ['found scanAll(rocks)', 'async play("ping")', 'self scanPower()'];
  let scanned = 0;
  for (const rock of scenario.rocks) {
    messages.push(`call ${rock.name} scan(${game.probe.power})`, `reply ${rock.name} ${rock.unscanned_after}`);
    if (rock.unscanned_after === 0) {
      scanned += 1;
      messages.push(`call ${rock.name} collectSample()`, `reply ${rock.name} ${rock.crystals}`);
    } else {
      messages.push(`call ${rock.name} tag(2)`);
    }
  }
  if (scanned === scenario.rocks.length) messages.push('create starMap', 'async play("chime")');
  return messages;
}

function messagesOf(source) {
  const patterns = [
    [/^o-> probe: (.+)$/, match => `found ${match[1]}`],
    [/^probe ->> sfx: (.+)$/, match => `async ${match[1]}`],
    [/^probe -> probe: (.+)$/, match => `self ${match[1]}`],
    [/^probe --> (\w+): <<create>>$/, match => `create ${match[1]}`],
    [/^probe -> (\w+): (.+)$/, match => `call ${match[1]} ${match[2]}`],
    [/^(\w+) --> probe: (.+)$/, match => `reply ${match[1]} ${match[2]}`],
  ];
  return source.split('\n').flatMap(line => {
    for (const [pattern, format] of patterns) {
      const match = line.match(pattern);
      if (match) return [format(match)];
    }
    return [];
  });
}

test('the concrete diagrams show exactly the runs the scenarios specify', () => {
  assert.deepEqual(messagesOf(fullSource(story.diagrams.trace)), expectedTrace(game.scenarios.partial));
  assert.deepEqual(messagesOf(fullSource(story.diagrams.trace_bars)), expectedTrace(game.scenarios.partial));
  assert.deepEqual(messagesOf(fullSource(story.diagrams.charted_run)), expectedTrace(game.scenarios.charted));
});

// The lesson's consistency rule, applied to its own diagrams: every message
// names an operation of the class that types its receiving lifeline.
test('every message in a scan diagram is an operation of its receiver\'s class', () => {
  const operations = Object.fromEntries([...story.diagrams.classes.source.matchAll(/^class (\w+) \{([^}]*)\}/gm)]
    .map(([, name, body]) => [name, [...body.matchAll(/(\w+)\(/g)].map(match => match[1])]));
  for (const id of ['trace', 'trace_bars', 'scan_loop', 'scan_alt', 'scan', 'charted_run']) {
    const source = fullSource(story.diagrams[id]);
    const types = Object.fromEntries([...source.matchAll(/^participant (\w+): (\w+)$/gm)].map(([, name, type]) => [name, type]));
    const calls = [...source.matchAll(/^(?:\w+ |o)->>? ?(\w+): (\w+)\(/gm)];
    assert.ok(calls.length > 0, id);
    for (const [, receiver, operation] of calls) {
      assert.ok(operations[types[receiver]]?.includes(operation), `${id}: ${operation} is an operation of ${types[receiver]}`);
    }
  }
});

// Fragments and operation names in diagram order; creations and replies carry no call.
function skeleton(source) {
  return source.split('\n').flatMap(line => {
    const fragment = line.trim().match(/^(loop|alt|else|opt|end)\b/);
    if (fragment) return [fragment[1]];
    const call = line.match(/->>? ?\S+: (\w+)\(/);
    return call ? [call[1]] : [];
  });
}

// The chapter's code labs draw sequence diagrams with these analyzers, so the
// lesson's general diagram must be what they infer from its own code.
const analyzers = {
  java: sources => analyzeJavaSources(sources),
  typescript: sources => global.analyzeJSSources(sources, typescriptCompiler),
  cpp: sources => analyzeCppSources(sources),
};
for (const [language, analyze] of Object.entries(analyzers)) {
  test(`SEBook's ${examples[language].label} analyzer infers the general diagram's messages and fragments from the lesson code`, () => {
    const example = examples[language];
    const program = [example.imports, ...story.example_order.map(name => example.blocks[name].source)].join('\n');
    const result = analyze({ [example.filename]: program });
    assert.deepEqual(result.errors, []);
    const inferred = skeleton(result.sequenceDiagram);
    assert.deepEqual(inferred.slice(inferred.indexOf('scanAll')), skeleton(story.diagrams.scan.source));
  });
}

test('every section ends in a valid check, and the last one is a multi-question summary', () => {
  assert.deepEqual(Object.keys(quizzes), story.scenes.map(scene => scene.id));
  const final = quizzes[story.scenes.at(-1).id];
  assert.ok(final.questions.length >= 5, 'The summary quiz covers every part on a new app.');
  const keys = [];
  for (const scene of story.scenes) {
    const check = quizzes[scene.id];
    for (const question of check.questions || [check]) {
      assert.match(question.question, /sequence diagram|flashcard app/, `${scene.id}: the stem names the topic or the scenario`);
      assert.ok(question.options.length >= 3 && question.explanation.trim());
      assert.ok(Number.isInteger(question.correct_index) && question.options[question.correct_index]);
      keys.push(question.correct_index);
      for (const index of Object.keys(question.option_feedback || {})) {
        assert.notEqual(Number(index), question.correct_index, `${scene.id}: feedback on the correct option never fires`);
        assert.ok(question.options[Number(index)], `${scene.id}: feedback names a real option`);
      }
    }
  }
  assert.equal(new Set(keys).size, 3, 'The correct answer rotates across positions.');
});

test('every cue names real code, diagram, panel, and call-stack targets', () => {
  for (const { scene, cue } of cues) {
    const where = `${scene.id}/${cue.id}`;
    if (cue.focus) {
      assert.ok(scene.code, `${where}: focus without code`);
      for (const language of story.languages) assert.ok(examples[language].blocks[scene.code].focus[cue.focus], `${language}/${where}`);
    }
    const name = cue.diagram || scene.diagram;
    if (name) {
      const diagram = story.diagrams[name];
      assert.ok(diagram, `${where}: diagram ${name}`);
      if (cue.diagram_steps !== undefined) {
        assert.ok(diagram.steps, `${where}: steps on a diagram without steps`);
        assert.ok(cue.diagram_steps >= 0 && cue.diagram_steps <= diagram.steps.length, where);
      }
      if (cue.diagram_focus) {
        const declared = new RegExp(`^(class ${cue.diagram_focus} |participant ${cue.diagram_focus}:)`, 'm');
        assert.match(diagram.source, declared, `${where}: ${cue.diagram_focus} is declared in ${name}`);
      }
    } else {
      assert.equal(cue.diagram_focus, undefined, where);
    }
    assert.equal(Boolean(cue.panel_state), Boolean(scene.panel), `${where}: a panel scene names a panel state on every cue`);
    if (cue.panel_state) assert.ok(game.panels[cue.panel_state], `${where}: ${cue.panel_state}`);
    assert.equal(Boolean(cue.frames), Boolean(scene.stack), `${where}: a call-stack scene lists frames on every cue`);
  }
});

test('code blocks exist in all four languages and their marks name real lines', () => {
  assert.deepEqual(Object.keys(examples).sort(), ['cpp', 'java', 'python', 'typescript']);
  const names = Object.keys(examples.python.blocks);
  for (const [language, example] of Object.entries(examples)) {
    assert.deepEqual(Object.keys(example.blocks), names, language);
    for (const [name, block] of Object.entries(example.blocks)) {
      assert.deepEqual(Object.keys(block.focus).sort(), Object.keys(examples.python.blocks[name].focus).sort(), `${language}/${name}`);
      const lines = block.source.trimEnd().split('\n');
      for (const marks of Object.values(block.focus)) {
        assert.ok(marks.length > 0);
        for (const line of marks) assert.ok(lines[line - 1]?.trim(), `${language}/${name}: line ${line} is code`);
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
  const captions = read(story.captions);
  assert.equal((captions.match(/ --> /g) || []).length, cues.length);
  cues.forEach(({ cue }) => assert.ok(captions.includes(cue.text)));
  const spoken = cues.map(({ cue }) => Object.entries(story.pronunciations)
    .sort(([left], [right]) => right.length - left.length)
    .reduce((text, [written, pronunciation]) => text.split(written).join(pronunciation), cue.text));
  assert.equal(read(story.script), `${spoken.join('\n\n')}\n`);
  const size = statSync(path.join(root, story.audio)).size;
  assert.ok(size > 0 && size * 8 / timing.duration < 64000);
});

test('the words and the picture finish before every check, and predictions leave time to think', () => {
  // js/narrated-explainer.js opens a check 0.3 s before its section ends.
  for (const scene of story.scenes) {
    assert.ok(scene.cues.at(-1).pause_after >= 2.5, `${scene.id} leaves too little time to look before its check`);
    scene.cues.forEach((cue, index) => {
      if (!cue.prediction) return;
      assert.ok(cue.pause_after >= 4, `${scene.id}/${cue.id}: time to predict`);
      assert.ok(scene.cues[index + 1] && !scene.cues[index + 1].prediction, `${scene.id}/${cue.id}: the next cue answers`);
    });
  }
  for (const scene of timing.scenes) {
    assert.ok(scene.end - scene.cues.at(-1).speech_end >= 2.5, `${scene.id}: at least 2.5 s of silence after the last word`);
  }
});

// Notes are written apart from the speech: a few short bullets per cue that keep
// every idea in at most half the narration's words, never a copied sentence.
const words = text => text.toLowerCase().replace(/\*\*/g, '').replace(/['’]/g, '').split(/[^a-z0-9%]+/).filter(Boolean);
function longestCopiedRun(point, speech) {
  let longest = 0;
  point.forEach((_, start) => speech.forEach((__, from) => {
    let length = 0;
    while (start + length < point.length && point[start + length] === speech[from + length]) length += 1;
    longest = Math.max(longest, length);
  }));
  return longest;
}

test('every cue has a few short key points written as notes, not narration', () => {
  assert.deepEqual(Object.keys(notes).sort(), cues.map(({ scene, cue }) => `${scene.id}-${cue.id}`).sort());
  let noteWords = 0;
  let speechWords = 0;
  for (const { scene, cue } of cues) {
    const points = notes[`${scene.id}-${cue.id}`];
    const speech = words(cue.text);
    speechWords += speech.length;
    assert.ok(points.length >= 1 && points.length <= 4, `${scene.id}-${cue.id}: one to four points`);
    for (const point of points) {
      const pointWords = words(point);
      noteWords += pointWords.length;
      assert.ok(pointWords.length <= 16, `${scene.id}-${cue.id}: "${point}" is short`);
      assert.ok(longestCopiedRun(pointWords, speech) < 8, `${scene.id}-${cue.id}: "${point}" is a note, not a copied sentence`);
      assert.doesNotMatch(point.replace(/\*\*[^*]+\*\*/g, ''), /[*_`]/, `${scene.id}-${cue.id}: only **bold** markup`);
    }
    if (cue.prediction) assert.match(points[0], /^\*\*(Predict|Exercise):\*\*/, `${scene.id}-${cue.id}: keeps its question`);
  }
  assert.ok(noteWords <= speechWords / 2, `${noteWords} note words for ${speechWords} spoken words`);
});

// Each language prints, for every scenario, each rock as name:unscanned:crystals:tagged,
// then the probe's crystals, the star map, and the queued sounds; then the drones'
// batteries and sounds after the recharge. Compilers are optional for a local unit run.
const scenarioIds = Object.keys(game.scenarios);
const expectedLines = () => [
  ...scenarioIds.flatMap(id => {
    const scenario = game.scenarios[id];
    return [
      ...scenario.rocks.map(rock => `${rock.name}:${rock.unscanned_after}:${rock.crystals_after}:${rock.tagged_after}`),
      `crystals:${scenario.probe_crystals_after}`,
      `map:${scenario.star_map_after || 'none'}`,
      `sounds:${scenario.sounds_after.join(',')}`,
    ];
  }),
  game.recharge.drones.map(drone => drone.battery_after).join(','),
  game.recharge.sounds_after.join(','),
];

function harness(language) {
  const scenarios = scenarioIds.map(id => game.scenarios[id].rocks.map(rock => [rock.name, rock.size, rock.crystals]));
  const drones = game.recharge.drones.map(drone => [drone.battery, drone.capacity]);
  const level = game.probe.level;
  if (language === 'python') return `
for rocks in ${JSON.stringify(scenarios)}:
    sfx = SoundPlayer()
    probe = Probe(${level}, sfx)
    targets = [Asteroid(name, size, crystals) for name, size, crystals in rocks]
    probe.scan_all(targets)
    for rock in targets:
        print(f"{rock.name}:{rock.unscanned}:{rock.crystals}:{rock.tagged}")
    print(f"crystals:{probe.crystals}")
    print(f"map:{'none' if probe.star_map is None else probe.star_map.rocks}")
    print("sounds:" + ",".join(sfx.queued))
sfx = SoundPlayer()
drones = [Drone(battery, capacity) for battery, capacity in ${JSON.stringify(drones)}]
Dock(sfx).recharge_all(drones)
print(",".join(str(drone.battery) for drone in drones))
print(",".join(sfx.queued))
`;
  if (language === 'java') return `
public class Mission {
    static void report(Probe probe, SoundPlayer sfx, List<Asteroid> rocks) {
        for (Asteroid rock : rocks) System.out.println(rock.name + ":" + rock.unscanned + ":" + rock.crystals + ":" + rock.tagged);
        System.out.println("crystals:" + probe.crystals);
        System.out.println("map:" + (probe.starMap == null ? "none" : String.valueOf(probe.starMap.rocks)));
        System.out.println("sounds:" + String.join(",", sfx.queued));
    }

    public static void main(String[] args) {${scenarios.map(rocks => `
        {
            SoundPlayer sfx = new SoundPlayer();
            Probe probe = new Probe(${level}, sfx);
            List<Asteroid> rocks = List.of(${rocks.map(([name, size, crystals]) => `new Asteroid("${name}", ${size}, ${crystals})`).join(', ')});
            probe.scanAll(rocks);
            report(probe, sfx, rocks);
        }`).join('')}
        SoundPlayer sfx = new SoundPlayer();
        List<Drone> drones = List.of(${drones.map(([battery, capacity]) => `new Drone(${battery}, ${capacity})`).join(', ')});
        new Dock(sfx).rechargeAll(drones);
        StringBuilder batteries = new StringBuilder();
        for (Drone drone : drones) batteries.append(batteries.length() == 0 ? "" : ",").append(drone.battery);
        System.out.println(batteries);
        System.out.println(String.join(",", sfx.queued));
    }
}
`;
  if (language === 'cpp') return `
std::string joined(const std::vector<std::string>& items) {
    std::string text;
    for (const auto& item : items) text += (text.empty() ? "" : ",") + item;
    return text;
}

void report(const Probe& probe, const SoundPlayer& sfx, const std::vector<Asteroid*>& rocks) {
    for (const Asteroid* rock : rocks) std::cout << rock->name << ':' << rock->unscanned << ':' << rock->crystals << ':' << rock->tagged << '\\n';
    std::cout << "crystals:" << probe.crystals << '\\n';
    std::cout << "map:" << (probe.starMap ? std::to_string(probe.starMap->rocks) : std::string("none")) << '\\n';
    std::cout << "sounds:" << joined(sfx.queued) << '\\n';
}

int main() {${scenarios.map(rocks => `
    {
        SoundPlayer sfx;
        Probe probe(${level}, sfx);
${rocks.map(([name, size, crystals], index) => `        Asteroid rock${index}("${name}", ${size}, ${crystals});`).join('\n')}
        std::vector<Asteroid*> rocks{${rocks.map((_, index) => `&rock${index}`).join(', ')}};
        probe.scanAll(rocks);
        report(probe, sfx, rocks);
    }`).join('')}
    SoundPlayer sfx;
${drones.map(([battery, capacity], index) => `    Drone drone${index}(${battery}, ${capacity});`).join('\n')}
    std::vector<Drone*> drones{${drones.map((_, index) => `&drone${index}`).join(', ')}};
    Dock dock(sfx);
    dock.rechargeAll(drones);
    std::vector<std::string> batteries;
    for (const Drone* drone : drones) batteries.push_back(std::to_string(drone->battery));
    std::cout << joined(batteries) << '\\n' << joined(sfx.queued) << '\\n';
}
`;
  return `
for (const rocks of ${JSON.stringify(scenarios)} as [string, number, number][][]) {
  const sfx = new SoundPlayer();
  const probe = new Probe(${level}, sfx);
  const targets = rocks.map(([name, size, crystals]) => new Asteroid(name, size, crystals));
  probe.scanAll(targets);
  for (const rock of targets) console.log(\`\${rock.name}:\${rock.unscanned}:\${rock.crystals}:\${rock.tagged}\`);
  console.log(\`crystals:\${probe.crystals}\`);
  console.log(\`map:\${probe.starMap === null ? "none" : probe.starMap.rocks}\`);
  console.log(\`sounds:\${sfx.queued.join(",")}\`);
}
const sfx = new SoundPlayer();
const drones = (${JSON.stringify(drones)} as [number, number][]).map(([battery, capacity]) => new Drone(battery, capacity));
new Dock(sfx).rechargeAll(drones);
console.log(drones.map(drone => drone.battery).join(","));
console.log(sfx.queued.join(","));
`;
}

for (const language of story.languages) {
  test(`${examples[language].label}: the code produces every specified run, and the complete example prints the traced scan`, t => {
    const tool = { python: 'python3', java: 'javac', cpp: 'clang++', typescript: process.execPath }[language];
    if (spawnSync(tool, [language === 'java' ? '-version' : '--version']).status !== 0) {
      t.skip(`${tool} is required to execute this language`);
      return;
    }
    const example = examples[language];
    const directory = mkdtempSync(path.join(tmpdir(), 'sequence-example-'));
    const block = name => example.blocks[name].source;
    const declarations = [example.imports, ...story.example_order.filter(name => name !== 'mission').map(block)].join('\n');
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
    const [pebble, boulder] = game.scenarios.partial.rocks;
    try {
      assert.equal(run(`${declarations}\n${block('mission')}`),
        `pebble: ${pebble.unscanned_after} left | boulder: ${boulder.unscanned_after} left, tagged ${boulder.tagged_after}\n`
        + `crystals: ${game.scenarios.partial.probe_crystals_after} | star map: none\n`);
      assert.equal(run(`${declarations}\n${block('recharge')}\n${harness(language)}`), `${expectedLines().join('\n')}\n`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
