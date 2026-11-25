'use strict';

// The diagram editor's scene (UML-view editing spec §2.1, §3.4; plan Task 22): one drawing of the bundle, read with
// the contents() the text adapter gives for its document. Its items are the drawn boxes, its routes the drawn lines;
// a route resolves to the relation line it stands for (spec §3.4, relation reference), a height in a sequence drawing
// to the insertion anchor before a line, and a point to what holds it. Each drawing is made in Chromium by the
// bundle's renderer, and the scene is read from the manifest's files on that page.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test, before, after } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const ARCHUML = path.join(__dirname, '..', '..', 'js', 'ArchUML');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'diagram-editor', 'manifest.json'), 'utf8'));

const lines = (...rows) => rows.join('\n');

// The superclass has members enough that the tree's shared trunk starts within the reach of its box (see the
// inheritance-tree test).
const CLASS_WITH_TREE = lines(
  '@startuml',
  'abstract class Animal {',
  '  +name: str',
  '  +age: int',
  '  +weight: float',
  '  +speak(): str',
  '  +eat(food: str)',
  '}',
  'class Dog',
  'class Cat',
  'class Owner',
  'Dog --|> Animal',
  'Cat --|> Animal',
  'Owner --> Dog : walks',
  '@enduml',
);
const SEQUENCE_WITH_NESTED_FRAGMENTS = lines(
  '@startuml',
  'participant A',
  'participant B',
  'participant C',
  'A -> B : start',
  'alt [ok]',
  '  B -> C : work',
  '  loop [each]',
  '    C -> B : item',
  '  end',
  'else [fail]',
  '  B -> A : error',
  'end',
  'A -> C : finish',
  '@enduml',
);
const DEPLOYMENT_WITH_NESTED_NODES = lines(
  '@startuml',
  'node Cluster {',
  '  node Worker {',
  '    component App',
  '  }',
  '  artifact Config',
  '}',
  'node DB {',
  '  component Postgres',
  '}',
  'Cluster --> DB : SQL',
  'App --> Postgres : query',
  '@enduml',
);
const COMPONENT_WITH_PORTS = lines(
  '@startuml',
  'component Frontend {',
  '  portout "httpOut" as f_out',
  '}',
  'component Backend {',
  '  portin "httpIn" as b_in',
  '  portout "dbOut" as b_dbout',
  '}',
  'component Database {',
  '  portin "dbIn" as db_in',
  '}',
  'f_out --> b_in : REST',
  'b_dbout --> db_in : SQL',
  '@enduml',
);
const STATE_MACHINE = lines(
  '@startuml',
  '[*] --> Idle',
  'Idle --> Processing : submit',
  'Processing --> Done : success',
  'Processing --> Error : failure',
  'Error --> Idle : retry',
  'Done --> [*]',
  '@enduml',
);
const USE_CASES = lines(
  '@startuml',
  'actor User',
  'usecase "Login" as UC1',
  'usecase "Register" as UC2',
  'User -- UC1',
  'User -- UC2',
  'UC2 ..> UC1 : <<include>>',
  '@enduml',
);

const DRAWINGS = {
  class: { renderer: 'UMLClassDiagram', text: CLASS_WITH_TREE },
  sequence: { renderer: 'UMLSequenceDiagram', text: SEQUENCE_WITH_NESTED_FRAGMENTS },
  deployment: { renderer: 'UMLDeploymentDiagram', text: DEPLOYMENT_WITH_NESTED_NODES },
  component: { renderer: 'UMLComponentDiagram', text: COMPONENT_WITH_PORTS },
  state: { renderer: 'UMLStateDiagram', text: STATE_MACHINE },
  usecase: { renderer: 'UMLUseCaseDiagram', text: USE_CASES },
};

/** The index of the line of `text` that reads `row`, trimmed. */
function lineOf(text, row) {
  const index = text.split('\n').findIndex((candidate) => candidate.trim() === row);
  assert.notEqual(index, -1, `the source has the line "${row}"`);
  return index;
}

let browser;
let page;

before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  for (const file of ['uml-bundle.js', ...MANIFEST.core, ...MANIFEST.text]) {
    await page.addScriptTag({ path: path.join(ARCHUML, file) });
  }
  // Each drawing gets its own container, `drawings[type]`, with its source; `sceneOf(type, text)` reads the drawing
  // with the contents of `text` (the drawn source when it is left out).
  await page.evaluate((drawings) => {
    window.drawings = {};
    for (const [type, { renderer, text }] of Object.entries(drawings)) {
      const container = document.createElement('div');
      document.body.appendChild(container);
      window[renderer].render(container, text);
      window.drawings[type] = { svg: container.querySelector('svg'), text };
    }
    window.contentsOf = (type, text) => window.ArchUMLDiagramEditorParts.text.readContents(text || window.drawings[type].text, type, window);
    window.sceneOf = (type, text) => window.ArchUMLDiagramEditorParts.scene.readScene(window.drawings[type].svg, window.contentsOf(type, text), window);
  }, DRAWINGS);
});

after(async () => {
  await browser.close();
});

test('every stamped layout id is an item', async () => {
  const results = await page.evaluate((types) => types.map((type) => {
    const svg = window.drawings[type].svg;
    const stamped = [...svg.querySelectorAll('[data-layout-id], [data-layout-bounds-id]')]
      .map((node) => node.getAttribute('data-layout-bounds-id') || node.getAttribute('data-layout-id'));
    const items = new Set(window.sceneOf(type).items().map((item) => item.id));
    return { type, stamped: [...new Set(stamped)], missing: [...new Set(stamped)].filter((id) => !items.has(id)) };
  }), Object.keys(DRAWINGS));

  for (const { type, missing } of results) assert.deepEqual(missing, [], `${type}: stamped ids that are no item`);
  // The check means something only where a drawing stamps ids: a class box by its bounds, a port, a nested node.
  const stampedTypes = results.filter((result) => result.stamped.length).map((result) => result.type);
  for (const type of ['class', 'component', 'deployment', 'state']) assert.ok(stampedTypes.includes(type), `the ${type} drawing stamps layout ids`);
});

test('rel:N, seqmsg:N, edge-N, and usecase:N resolve to the lines today\'s functions give', async () => {
  const resolved = await page.evaluate((types) => Object.fromEntries(types.map((type) => {
    const scene = window.sceneOf(type);
    const contents = window.contentsOf(type);
    return [type, Object.fromEntries(scene.routes().map((route) => [route.id, scene.relationRef(route.id, contents).line]))];
  })), Object.keys(DRAWINGS));
  const at = (type, row) => lineOf(DRAWINGS[type].text, row);

  assert.equal(resolved.class['rel:13'], at('class', 'Owner --> Dog : walks'));
  for (const row of ['A -> B : start', 'B -> C : work', 'C -> B : item', 'B -> A : error', 'A -> C : finish']) {
    assert.equal(resolved.sequence[`seqmsg:${at('sequence', row)}`], at('sequence', row), row);
  }
  assert.equal(resolved.deployment['rel:10'], at('deployment', 'Cluster --> DB : SQL'));
  assert.equal(resolved.deployment['rel:11'], at('deployment', 'App --> Postgres : query'));
  // The component and state renderers number their lines in drawing order, and the scene matches each by its ends.
  assert.equal(resolved.component['edge-0'], at('component', 'b_dbout --> db_in : SQL'));
  assert.equal(resolved.component['edge-1'], at('component', 'f_out --> b_in : REST'));
  ['[*] --> Idle', 'Idle --> Processing : submit', 'Processing --> Done : success', 'Processing --> Error : failure',
    'Error --> Idle : retry', 'Done --> [*]'].forEach((row, index) => {
    assert.equal(resolved.state[`edge-${index}`], at('state', row), row);
  });
  // A use-case route numbers the parser's relationships.
  assert.equal(resolved.usecase['usecase:0'], at('usecase', 'User -- UC1'));
  assert.equal(resolved.usecase['usecase:1'], at('usecase', 'User -- UC2'));
  assert.equal(resolved.usecase['usecase:2'], at('usecase', 'UC2 ..> UC1 : <<include>>'));
});

test('a relation reference resolves against the contents it is given, so a line inserted above the relation moves the answer', async () => {
  const drawn = DRAWINGS.component.text;
  const withLineAbove = drawn.replace('f_out --> b_in : REST', 'component Cache\nf_out --> b_in : REST');

  const [before, afterInsert] = await page.evaluate((text) => {
    const scene = window.sceneOf('component');
    return [scene.relationRef('edge-1', window.contentsOf('component')), scene.relationRef('edge-1', window.contentsOf('component', text))];
  }, withLineAbove);

  assert.deepEqual(before, { routeId: 'edge-1', line: lineOf(drawn, 'f_out --> b_in : REST'), candidates: [lineOf(drawn, 'f_out --> b_in : REST')] });
  assert.equal(afterInsert.line, lineOf(withLineAbove, 'f_out --> b_in : REST'));
  assert.equal(afterInsert.line, before.line + 1);
});

test('a subclass branch of an inheritance tree resolves to its line and the shared trunk to line -1 with two candidates', async () => {
  // The class renderer draws a generalization tree without route ids: a trunk below the superclass, a bar, and one
  // branch down to each subclass. Each is read here by where it ends.
  const tree = await page.evaluate(() => {
    const scene = window.sceneOf('class');
    const contents = window.contentsOf('class');
    const boxes = Object.fromEntries(scene.items().map((item) => [item.id, item.box]));
    const meets = (point, box) => Math.abs(point.y - box.y) < 2 && point.x > box.x && point.x < box.x + box.width;
    const tops = (route) => route.points[route.points.length - 1];
    const unnamed = scene.routes().filter((route) => /^edge-\d+$/.test(route.id));
    const branchTo = (id) => unnamed.find((route) => meets(tops(route), boxes[id]));
    const animal = boxes.Animal;
    const trunk = unnamed.find((route) => route.points[0].y > animal.y + animal.height && route.points[0].y - (animal.y + animal.height) < 24
      && Math.abs(route.points[0].x - route.points[1].x) < 1);
    return {
      dog: scene.relationRef(branchTo('Dog').id, contents),
      cat: scene.relationRef(branchTo('Cat').id, contents),
      trunk: scene.relationRef(trunk.id, contents),
    };
  });
  const text = DRAWINGS.class.text;

  assert.equal(tree.dog.line, lineOf(text, 'Dog --|> Animal'));
  assert.equal(tree.cat.line, lineOf(text, 'Cat --|> Animal'));
  assert.equal(tree.trunk.line, -1);
  assert.deepEqual([...tree.trunk.candidates].sort((a, b) => a - b), [lineOf(text, 'Dog --|> Animal'), lineOf(text, 'Cat --|> Animal')]);
});

test('each message height maps to the anchor before its line', async () => {
  const anchors = await page.evaluate(() => {
    const scene = window.sceneOf('sequence');
    const contents = window.contentsOf('sequence');
    return scene.routes().map((route) => ({
      line: Number(route.id.split(':')[1]),
      justAbove: scene.anchorAt(route.points[0].y - 1, contents).beforeLine,
      leavingItOut: scene.anchorAt(route.points[0].y - 1, contents, { route: route.id }).beforeLine,
    }));
  });
  const text = DRAWINGS.sequence.text;

  assert.deepEqual(anchors.map((anchor) => anchor.line),
    ['A -> B : start', 'B -> C : work', 'C -> B : item', 'B -> A : error', 'A -> C : finish'].map((row) => lineOf(text, row)));
  for (const anchor of anchors) assert.equal(anchor.justAbove, anchor.line, `just above the message on line ${anchor.line}`);
  // Leaving the message out (it is the one being moved), the height above it falls to the next anchor below it.
  assert.equal(anchors[0].leavingItOut, lineOf(text, 'alt [ok]'), 'above the first message, without it: before the alt');
});

test('a sequence drawing without a message or fragment anchors at the end of the document', async () => {
  const anchor = await page.evaluate(() => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const text = '@startuml\nparticipant A\nparticipant B\n@enduml';
    window.UMLSequenceDiagram.render(container, text);
    const contents = window.ArchUMLDiagramEditorParts.text.readContents(text, 'sequence', window);
    return window.ArchUMLDiagramEditorParts.scene.readScene(container.querySelector('svg'), contents, window).anchorAt(200, contents);
  });

  assert.deepEqual(anchor, { beforeLine: null });
});

test('a deployment node\'s children are contained in it by geometry', async () => {
  const nesting = await page.evaluate(() => {
    const scene = window.sceneOf('deployment');
    const geometry = window.ArchUMLDiagramEditorParts.geometry;
    return window.contentsOf('deployment').elements.filter((element) => element.parentId).map((element) => {
      const box = scene.boxOf(element.id);
      const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      return {
        id: element.id,
        kind: element.kind,
        parentId: element.parentId,
        inside: geometry.containsBox(scene.boxOf(element.parentId), box),
        holder: scene.containerAt(centre),
      };
    });
  });

  assert.deepEqual(nesting.map((child) => `${child.id} in ${child.parentId}`).sort(),
    ['App in Worker', 'Config in Cluster', 'Postgres in DB', 'Worker in Cluster']);
  for (const child of nesting) assert.equal(child.inside, true, `${child.id} lies inside ${child.parentId}`);
  // What a component or an artifact dropped on a child's centre goes into: the innermost node there.
  for (const child of nesting.filter((candidate) => candidate.kind !== 'node')) {
    assert.equal(child.holder, child.parentId, `a drop on ${child.id} goes into ${child.parentId}`);
  }
});

test('a port dropped on a component goes into it, and a point on no box goes into nothing', async () => {
  const holders = await page.evaluate(() => {
    const scene = window.sceneOf('component');
    const backend = scene.boxOf('Backend');
    return {
      onBackend: scene.containerAt({ x: backend.x + backend.width / 2, y: backend.y + backend.height / 2 }),
      offCanvas: scene.containerAt({ x: -500, y: -500 }),
      inAState: window.sceneOf('state').containerAt({ x: 0, y: 0 }),
    };
  });

  assert.deepEqual(holders, { onBackend: 'Backend', offCanvas: null, inAState: null });
});

test('overlapsAmong names the pairs of boxes that overlap, nested nodes among them', async () => {
  const pairs = await page.evaluate(() => {
    const scene = window.sceneOf('deployment');
    return { nested: scene.overlapsAmong(['Cluster', 'Worker', 'DB']), apart: scene.overlapsAmong(['Cluster', 'DB']) };
  });

  assert.deepEqual(pairs, { nested: [['Cluster', 'Worker']], apart: [] });
});

test('routeOf finds a drawn route by its id, and boxOf a drawn box, a class by its bounds', async () => {
  const found = await page.evaluate(() => {
    const scene = window.sceneOf('class');
    const bounds = [...window.drawings.class.svg.querySelectorAll('[data-layout-bounds-id="Owner"]')]
      .map((node) => node.getBoundingClientRect());
    return {
      route: scene.routeOf('rel:13') && scene.routeOf('rel:13').id,
      missing: scene.routeOf('rel:99'),
      owner: scene.boxOf('Owner'),
      boundsWidth: Math.max(...bounds.map((rect) => rect.right)) - Math.min(...bounds.map((rect) => rect.left)),
    };
  });

  assert.equal(found.route, 'rel:13');
  assert.equal(found.missing, null);
  assert.ok(Math.abs(found.owner.width - found.boundsWidth) < 1, 'the box of a class spans its bounds');
});
