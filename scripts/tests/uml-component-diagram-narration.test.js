const { loadStory } = require('../narration/source');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const story = loadStory('uml_component_diagram');
const quizzes = yaml.load(read('_data/explainers/uml_component_diagram_quizzes.yml'));
const notes = yaml.load(read('_data/explainers/uml_component_diagram_notes.yml'));
const timing = JSON.parse(read('_data/explainers/uml_component_diagram_timing.json'));
const cues = story.scenes.flatMap(scene => scene.cues.map(cue => ({ scene, cue })));
const diagramOf = (scene, cue) => story.diagrams[cue.diagram || scene.diagram];

// What a component diagram's source declares, read the way ArchUML reads it.
function model(source) {
  const components = [...source.matchAll(/^component (\w+)/gm)].map(match => match[1]);
  const interfaces = kind => [...source.matchAll(new RegExp(`^\\s+${kind} "(\\w+)" as (\\w+)`, 'gm'))]
    .map(([, name, alias]) => ({ name, alias }));
  const provided = interfaces('provide');
  const required = interfaces('require');
  const assemblies = [...source.matchAll(/^(\w+) --> (\w+)$/gm)].map(([, ball, socket]) => ({
    ball: provided.find(entry => entry.alias === ball), socket: required.find(entry => entry.alias === socket),
  }));
  const connectors = [...source.matchAll(/^\w+ -- \w+ : («\w+»)$/gm)].map(match => match[1]);
  const dependencies = [...source.matchAll(/^(\w+) \.\.> (\w+)$/gm)].map(([, client, supplier]) => ({ client, supplier }));
  return { components, provided, required, assemblies, connectors, dependencies };
}

test('every section ends in a check about component diagrams, and the last one is a summary quiz', () => {
  assert.deepEqual(Object.keys(quizzes), story.scenes.map(scene => scene.id));
  const final = quizzes[story.scenes.at(-1).id];
  assert.ok(final.questions.length >= 6, 'The summary quiz covers components, interfaces, connectors, and reading.');
  for (const scene of story.scenes) {
    const check = quizzes[scene.id];
    for (const question of check.questions || [check]) {
      assert.match(question.question, /component diagram|shuttle app/, `${scene.id}: the stem names the topic or the summary scenario`);
      assert.ok(question.options.length >= 3 && question.explanation.trim());
      assert.ok(Number.isInteger(question.correct_index) && question.options[question.correct_index]);
      for (const index of Object.keys(question.option_feedback || {})) {
        assert.notEqual(Number(index), question.correct_index, `${scene.id}: feedback on the correct option never fires`);
        assert.ok(question.options[Number(index)], `${scene.id}: feedback names a real option`);
      }
    }
  }
  const keys = story.scenes.flatMap(scene => (quizzes[scene.id].questions || [quizzes[scene.id]]).map(q => q.correct_index));
  assert.ok(new Set(keys).size === 3, 'answer keys rotate across every option position');
});

test('the lesson shows diagrams and cards only, with no code panel', () => {
  assert.equal(story.languages, undefined);
  for (const scene of story.scenes) {
    assert.equal(scene.code, undefined, `${scene.id}: no code`);
    assert.ok(scene.diagram || scene.cards, `${scene.id}: shows a diagram or cards`);
  }
});

test('every highlight names a component that the cue\'s diagram declares', () => {
  for (const { scene, cue } of cues) {
    const diagram = diagramOf(scene, cue);
    if (cue.diagram) assert.ok(story.diagrams[cue.diagram], `${scene.id}/${cue.id}: diagram ${cue.diagram} exists`);
    if (!cue.diagram_focus) continue;
    assert.equal(diagram.type, 'component', `${scene.id}/${cue.id}: only component diagrams take a highlight`);
    assert.ok(model(diagram.source).components.includes(cue.diagram_focus), `${scene.id}/${cue.id}: ${cue.diagram_focus} is declared`);
  }
});

test('each callout points at text its diagram draws', () => {
  for (const [name, diagram] of Object.entries(story.diagrams)) {
    for (const [, target] of diagram.source.matchAll(/^callout \w+ of text "([^"]+)"/gm)) {
      assert.ok(diagram.source.replace(/^callout .*$/gm, '').includes(target), `${name}: callout target ${target}`);
    }
    for (const [, component, port] of diagram.source.matchAll(/^callout \w+ of element (\w+)\.(\w+)/gm)) {
      assert.match(diagram.source, new RegExp(`^component ${component} \\{[^}]*\\bas ${port}\\b`, 'm'), `${name}: port ${component}.${port}`);
    }
  }
});

test('every assembly snaps a ball into a socket of the same interface', () => {
  for (const [name, diagram] of Object.entries(story.diagrams).filter(([, entry]) => entry.type === 'component')) {
    for (const { ball, socket } of model(diagram.source).assemblies) {
      assert.ok(ball && socket, `${name}: an assembly runs from a provided to a required interface`);
      assert.equal(ball.name, socket.name, `${name}: the ball matches the socket`);
    }
  }
});

test('the diagrams show what the narration says about them', () => {
  // "Six components, three interfaces, and three kinds of connectors told the whole story."
  const full = model(story.diagrams.full.source);
  assert.equal(full.components.length, 6);
  assert.deepEqual(full.provided.map(entry => entry.name).sort(), ['SeatCounts', 'TextMessages', 'Watches']);
  assert.equal(full.assemblies.length, 3, 'every required interface is met by an assembly');
  assert.match(story.diagrams.full.caption, /ball-and-socket connector .*«HTTPS»/, 'the caption names the assemblies\' kind');
  assert.deepEqual(full.connectors.sort(), ['«SQL»', '«queue»']);
  // The wiring scene names AlertService's two ports, keeps its Watches ball on the box,
  // labels each port connector with its kind, and its key names the assembly's kind.
  const wiring = story.diagrams.wiring.source;
  for (const port of ['events', 'store']) assert.match(wiring, new RegExp(`^\\s+port(in|out) "${port}" as as_`, 'm'));
  assert.deepEqual(model(wiring).assemblies.map(entry => entry.ball.name), ['Watches']);
  assert.deepEqual(model(wiring).connectors.sort(), ['«SQL»', '«queue»']);
  assert.match(story.diagrams.wiring_key.source, /^note .*Key: ball in socket = «HTTPS» call$/m);
  assert.match(story.diagrams.full_notes.source, /^note .*Key: ball in socket = «HTTPS»/m, 'the fixed diagram has a key');
  // Dependencies: AlertService needs three parts; nothing depends on StudentWeb, the
  // registrar depends on nothing, and SeatPoller doesn't depend on AlertService.
  const { dependencies } = model(story.diagrams.overview.source);
  const suppliers = client => dependencies.filter(entry => entry.client === client).map(entry => entry.supplier).sort();
  assert.deepEqual(suppliers('AlertService'), ['AlertDB', 'SeatPoller', 'TextGateway']);
  assert.ok(!dependencies.some(entry => entry.supplier === 'StudentWeb'));
  assert.deepEqual(suppliers('Registrar'), []);
  assert.deepEqual(suppliers('SeatPoller'), ['Registrar']);
  // Swapping a part: FakeRegistrar fills the same socket that Registrar filled.
  const swap = model(story.diagrams.swap_test.source).assemblies[0];
  assert.equal(swap.socket.name, model(story.diagrams.assembly_pair.source).assemblies[0].socket.name);
  // The assembly scene shows every assembly of the complete diagram, split across two pictures.
  const shown = ['assembly_pair', 'assembly_chain'].flatMap(name => model(story.diagrams[name].source).assemblies);
  assert.deepEqual(shown.map(entry => entry.ball.name).sort(), full.assemblies.map(entry => entry.ball.name).sort());
  // The transfer adds one component and one socket and keeps AlertService's other interfaces.
  const push = model(story.diagrams.push.source);
  assert.deepEqual(push.components.filter(name => !full.components.includes(name)), ['PushGateway']);
  assert.deepEqual(push.required.map(entry => entry.name).filter(name => !full.required.some(entry => entry.name === name)), ['PushMessages']);
  for (const kept of ['Watches', 'TextMessages']) assert.ok(push.assemblies.some(entry => entry.ball.name === kept), `push keeps ${kept}`);
});

test('the handout keeps every taught term', () => {
  const handout = Object.values(notes).flat().join(' ').toLowerCase();
  for (const term of ['component', 'run-time view', 'code view', 'interface', 'provided interface', 'required interface',
    'ball', 'socket', 'assembly connector', 'replaceable', 'adapter', 'port', 'connector', '«queue»', '«https»', '«sql»',
    'key', 'dependency', 'deployment diagram', 'class', 'sequence']) {
    assert.ok(handout.includes(term), `the notes name ${term}`);
  }
  assert.deepEqual(Object.keys(notes).sort(), cues.map(({ scene, cue }) => `${scene.id}-${cue.id}`).sort());
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

test('every check opens after at least two seconds of silence with the finished picture', () => {
  // js/narrated-explainer.js stops 0.3 s before a section boundary.
  story.scenes.forEach((scene, index) => {
    assert.ok((scene.cues.at(-1).pause_after ?? 0.55) >= 2.5, `${scene.id} ends with too little silence`);
    const last = timing.scenes[index].cues.at(-1);
    assert.ok(timing.scenes[index].end - 0.3 - last.speech_end >= 2, `${scene.id}: at least two seconds to look`);
  });
});
