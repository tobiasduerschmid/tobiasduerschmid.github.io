'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const bundlePath = path.join(__dirname, '../../js/ArchUML/uml-bundle.js');
const source = fs.readFileSync(bundlePath, 'utf8');

function parsers() {
  // Browser bootstrapping is outside the parse API contract. No model or
  // renderer collaborator is replaced: each assertion calls the real parser.
  const context = {
    document: { readyState: 'loading', addEventListener() {}, documentElement: {} },
    MutationObserver: class { observe() {} },
  };
  context.window = context;
  vm.runInNewContext(source, context, { filename: bundlePath });
  return {
    activity: text => context.UMLActivityDiagram.parse(text),
    state: text => context.UMLStateDiagram.parse(text),
    sequence: text => context.UMLSequenceDiagram.parse(text),
    shared: context.UMLShared,
  };
}

function nodeNamed(model, label) {
  const node = model.nodes.find(item => item.label === label);
  assert.ok(node, `diagram must contain ${label}`);
  return node;
}

function successor(model, node) {
  const outgoing = model.edges.filter(edge => edge.from === node.id);
  assert.equal(outgoing.length, 1, `${node.label || node.type} must have one outgoing flow`);
  return model.nodes.find(item => item.id === outgoing[0].to);
}

test('saved route metadata preserves fractional endpoint and bend coordinates', () => {
  const shared = parsers().shared;
  const points = [{ x: 270.75, y: -19.125 }, { x: 1 / 3, y: 0.00000001 }, { x: 400, y: 60.5 }];
  const serialized = shared.layoutRoutePointsToString(points);
  const restored = shared.extractLayoutMetadata(`@layout schema=1\nedge "edge-0" points="${serialized}"\n@endlayout`).layout.routes['edge-0'].points;
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), points, 'saving an edited bend must not move either anchored endpoint');
});

test('activity alternatives meet at a merge before the next action', () => {
  const model = parsers().activity('(*) --> "Start"\nif "ok?" then\n --> [yes] "A"\nelse\n --> [no] "B"\nendif\n--> "Continue"');
  const merge = successor(model, nodeNamed(model, 'A'));
  assert.equal(merge.type, 'merge', 'alternatives need an OR merge, not an implicit AND-join at an action');
  assert.equal(successor(model, nodeNamed(model, 'B')).id, merge.id);
  assert.equal(successor(model, merge).label, 'Continue');
  assert.equal(model.edges.filter(edge => edge.to === nodeNamed(model, 'Continue').id).length, 1);
});

test('nested activity alternatives merge within their own branch', () => {
  const model = parsers().activity('(*) --> "Start"\nif "outer?" then\n if "inner?" then\n  --> [yes] "A"\n else\n  --> [no] "B"\n endif\nelse\n --> [no] "C"\nendif\n--> "Continue"');
  const innerMerge = successor(model, nodeNamed(model, 'A'));
  assert.equal(innerMerge.type, 'merge');
  assert.equal(successor(model, nodeNamed(model, 'B')).id, innerMerge.id);
  const outerMerge = successor(model, innerMerge);
  assert.equal(outerMerge.type, 'merge');
  assert.equal(successor(model, nodeNamed(model, 'C')).id, outerMerge.id);
  assert.equal(successor(model, outerMerge).label, 'Continue');
});

test('an activity decision without an else arm can bypass its optional action', () => {
  const model = parsers().activity('(*) --> "Start"\nif "ready?" then\n --> [yes] "Work"\nendif\n--> "Continue"');
  const decision = model.nodes.find(node => node.type === 'decision');
  const merge = successor(model, nodeNamed(model, 'Work'));
  assert.equal(merge.type, 'merge');
  assert.ok(model.edges.some(edge => edge.from === decision.id && edge.to === merge.id && edge.guard === 'else'));
  assert.equal(successor(model, merge).label, 'Continue');
});

test('an activity branch that reaches a final node never flows out of it', () => {
  const model = parsers().activity('(*) --> "Start"\nif "stop?" then\n --> [yes] (*)\nelse\n --> [no] "Work"\nendif\n--> "Continue"');
  const final = model.nodes.find(node => node.type === 'final');
  assert.equal(model.edges.filter(edge => edge.from === final.id).length, 0);
  const next = successor(model, nodeNamed(model, 'Work'));
  assert.equal(next.type === 'merge' ? successor(model, next).label : next.label, 'Continue');
});

test('explicit activity exits keep their branch flows without an unused synthetic merge', () => {
  const model = parsers().activity('(*) --> "Start"\nif "ok?" then\n --> [yes] "A"\nelse\n --> [no] "B"\nendif\n"A" --> "A2"\n"A2" --> (*)\n"B" --> (*)');
  assert.equal(successor(model, nodeNamed(model, 'A')).label, 'A2');
  assert.equal(successor(model, nodeNamed(model, 'B')).type, 'final');
  assert.equal(model.nodes.filter(node => node.type === 'merge').length, 0);
});

test('nested activity forks synchronize the inner join at the outer join', () => {
  const model = parsers().activity('(*) --> "Start"\nfork\n --> "A"\n fork\n  --> "B"\n  --> "C"\n endfork\nendfork\n--> "Continue"');
  const innerJoin = successor(model, nodeNamed(model, 'B'));
  assert.equal(innerJoin.type, 'join');
  assert.equal(successor(model, nodeNamed(model, 'C')).id, innerJoin.id);
  const outerJoin = successor(model, nodeNamed(model, 'A'));
  assert.equal(outerJoin.type, 'join');
  assert.equal(successor(model, innerJoin).id, outerJoin.id);
  assert.equal(successor(model, outerJoin).label, 'Continue');
});

test('an explicit flow extends its fork branch without moving the other branch source', () => {
  const model = parsers().activity('(*) --> "Start"\nfork\n --> "A"\n "A" --> "A2"\n --> "B"\nendfork\n--> "Continue"');
  const fork = model.nodes.find(node => node.type === 'fork');
  assert.ok(model.edges.some(edge => edge.from === fork.id && edge.to === nodeNamed(model, 'B').id));
  assert.equal(successor(model, nodeNamed(model, 'A')).label, 'A2');
  const join = successor(model, nodeNamed(model, 'A2'));
  assert.equal(join.type, 'join');
  assert.equal(successor(model, nodeNamed(model, 'B')).id, join.id);
});

test('composite state declarations retain children even before they have transitions', () => {
  const model = parsers().state('state Parent { state Child; state Choice <<choice>> }');
  const child = model.states.find(state => state.name === 'Child');
  assert.ok(child, 'declared child must be present without inferring it from a transition');
  assert.equal(child.parent, 'Parent');
  assert.equal(model.states.find(state => state.name === 'Choice').type, 'choice');
  assert.equal(model.states.find(state => state.name === 'Choice').parent, 'Parent');
});

const nestedState = 'state Parent {\n entry / startParent()\n exit / stopParent()\n do / monitor()\n [*] --> Middle\n state Middle {\n  entry / startMiddle()\n  [*] --> Choice\n  state Choice <<choice>>\n  Choice --> Leaf : [yes]\n  state Leaf\n }\n}';

test('nested states retain their direct parent, kind, and local initial transition', () => {
  const model = parsers().state(nestedState);
  const byName = Object.fromEntries(model.states.map(state => [state.name, state]));
  assert.equal(byName.Middle.parent, 'Parent');
  assert.equal(byName.Choice.parent, 'Middle');
  assert.equal(byName.Choice.type, 'choice');
  assert.equal(byName.Leaf.parent, 'Middle');
  assert.equal(byName.Parent.entryAction, 'startParent()');
  assert.equal(byName.Middle.entryAction, 'startMiddle()');
  const choiceEntry = model.transitions.find(edge => edge.to === 'Choice');
  assert.equal(choiceEntry.parent, 'Middle');
  assert.equal(byName[choiceEntry.from].parent, 'Middle');
});

test('state action text keeps embedded braces, quoted braces, and semicolons', () => {
  const model = parsers().state('state Parent {\n entry / configure({key: "}"}); start()\n state Child\n}');
  assert.equal(model.states.find(state => state.name === 'Parent').entryAction, 'configure({key: "}"}); start()');
  assert.equal(model.states.find(state => state.name === 'Child').parent, 'Parent');
});

test('state declarations inside note text remain literal note content', () => {
  const model = parsers().state('state Parent\nnote right of Parent\nstate Example { state Child; }\nend note');
  assert.deepEqual(Array.from(model.notes[0].lines), ['state Example { state Child; }']);
  assert.equal(model.states.length, 1);
});

for (const outsideFirst of [true, false]) {
  test(`a transition cannot move an explicitly declared external state (${outsideFirst ? 'earlier' : 'later'} declaration)`, () => {
    const body = 'state Parent {\n state Child\n Child --> Outside : leave\n}';
    const model = parsers().state(outsideFirst ? 'state Outside\n' + body : body + '\nstate Outside');
    assert.equal(model.states.find(state => state.name === 'Outside').parent || null, null);
    assert.equal(model.states.find(state => state.name === 'Child').parent, 'Parent');
    assert.equal(model.transitions[0].parent || null, null);
  });
}

test('left-pointing asynchronous messages keep their asynchronous arrow type', () => {
  const model = parsers().sequence('participant A\nparticipant B\nA <<- B : signal');
  assert.equal(model.messages.length, 1);
  assert.equal(model.messages[0].from, 'B');
  assert.equal(model.messages[0].to, 'A');
  assert.equal(model.messages[0].msgType, 'async');
});

test('sequence participant names may begin with fragment keywords', () => {
  const model = parsers().sequence('participant alternative\nparticipant elsewhere\nalternative -> elsewhere : first\nelsewhere -> alternative : second');
  assert.equal(model.messages.length, 2);
  assert.ok(model.messages.every(message => message.type === 'message'));
  assert.equal(model.messages[0].from, 'alternative');
  assert.equal(model.messages[1].from, 'elsewhere');
});

test('rendered nested composites contain their descendants and show their own actions', async () => {
  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html lang="en"><title>State behavior regression</title><body><div id="diagram"></div></body></html>');
    await page.addScriptTag({ path: bundlePath });
    const result = await page.evaluate(text => {
      const container = document.getElementById('diagram');
      window.UMLStateDiagram.render(container, text);
      const svg = container.querySelector('svg');
      const boxes = Object.fromEntries(['Parent', 'Middle', 'Choice', 'Leaf'].map(id => [id, window.UMLShared.renderedLayoutBox(svg, id)]));
      const actionBoxes = [...svg.querySelectorAll('text')].filter(node => /^(entry|exit|do) \/ /.test(node.textContent)).map(node => {
        const box = node.getBBox();
        return { text: node.textContent, x: box.x, y: box.y, width: box.width, height: box.height, fontSize: Number.parseFloat(getComputedStyle(node).fontSize) };
      });
      return { boxes, actionBoxes, text: svg.textContent, invalidGeometry: /NaN|Infinity/.test(svg.outerHTML) };
    }, nestedState);
    assert.equal(result.invalidGeometry, false);
    for (const action of ['entry / startParent()', 'exit / stopParent()', 'do / monitor()', 'entry / startMiddle()']) {
      assert.ok(result.text.includes(action), `rendered state must show ${action}`);
    }
    for (const [child, parent] of [['Middle', 'Parent'], ['Choice', 'Middle'], ['Leaf', 'Middle']]) {
      const inner = result.boxes[child], outer = result.boxes[parent];
      assert.ok(inner, `${child} must render`);
      assert.ok(inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width + 1 && inner.y + inner.height <= outer.y + outer.height + 1, `${child} must fit within ${parent}`);
    }
    for (const action of result.actionBoxes) {
      assert.ok(action.fontSize >= 20, 'state action text must use paragraph-size type');
      const child = action.text.includes('Middle') ? result.boxes.Choice : result.boxes.Middle;
      assert.ok(action.y + action.height <= child.y, 'state action text must sit above the child region');
    }
  } finally {
    await browser.close();
  }
});

test('transitions across state-region boundaries retain actual endpoints and visible routes', async () => {
  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html lang="en"><title>State region regression</title><body><div id="diagram"></div></body></html>');
    await page.addScriptTag({ path: bundlePath });
    const result = await page.evaluate(() => {
      const host = document.getElementById('diagram');
      window.UMLStateDiagram.render(host, 'state Outside\nstate Parent {\n state Middle {\n  state Child\n  Child --> Outside : leave\n  Child --> Sibling : next\n }\n state Sibling\n}');
      const svg = host.querySelector('svg');
      return {
        parent: window.UMLShared.renderedLayoutBox(svg, 'Parent'),
        outside: window.UMLShared.renderedLayoutBox(svg, 'Outside'),
        routes: window.UMLShared.collectEditableRoutes(svg).map(route => ({ source: route.source, target: route.target, points: route.points })),
        invalid: /NaN|Infinity/.test(svg.outerHTML),
      };
    });
    assert.equal(result.invalid, false);
    const outside = result.outside, parent = result.parent;
    assert.ok(outside.x + outside.width <= parent.x || outside.x >= parent.x + parent.width || outside.y + outside.height <= parent.y || outside.y >= parent.y + parent.height, 'external state must remain outside the composite');
    for (const target of ['Outside', 'Sibling']) {
      const route = result.routes.find(item => item.source === 'Child' && item.target === target);
      assert.ok(route && route.points.length >= 2, `Child to ${target} must have an editable rendered route`);
    }
  } finally {
    await browser.close();
  }
});

test('saved composite positions carry unsaved descendants while respecting their own saved positions', async () => {
  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html lang="en"><title>Saved state position regression</title><body><div id="diagram"></div></body></html>');
    await page.addScriptTag({ path: bundlePath });
    for (const saved of [
      { Parent: { x: 400, y: 300 } },
      { Parent: { x: 400, y: 300 }, Middle: { x: 800, y: 700 } },
      { Parent: { x: 400, y: 300 }, Middle: { x: 800, y: 700 }, Leaf: { x: 900, y: 950 } },
    ]) {
      const boxes = await page.evaluate(positions => {
        const host = document.getElementById('diagram');
        const metadata = Object.entries(positions).map(([id, pos]) => `node ${id} x=${pos.x} y=${pos.y}`).join('\n');
        window.UMLStateDiagram.render(host, `state Parent {\n state Middle {\n  state Leaf\n }\n}\n@layout schema=1\n${metadata}\n@endlayout`);
        return Object.fromEntries(['Parent', 'Middle', 'Leaf'].map(id => {
          const rect = host.querySelector(`rect[data-layout-bounds-id="${id}"]`);
          return [id, Object.fromEntries(['x', 'y', 'width', 'height'].map(attribute => [attribute, Number(rect.getAttribute(attribute))]))];
        }));
      }, saved);
      for (const [id, position] of Object.entries(saved)) {
        assert.equal(boxes[id].x, position.x, `${id} must retain its saved x coordinate`);
        assert.equal(boxes[id].y, position.y, `${id} must retain its saved y coordinate`);
      }
      for (const [child, parent] of [['Middle', 'Parent'], ['Leaf', 'Middle']]) {
        if (saved[child]) continue;
        const inner = boxes[child], outer = boxes[parent];
        assert.ok(inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width + 1 && inner.y + inner.height <= outer.y + outer.height + 1, `unsaved ${child} must follow its saved ${parent}`);
      }
    }
  } finally {
    await browser.close();
  }
});

test('internal transitions are listed inside their state; description rows stay unlisted', () => {
  const model = parsers().state('state Waiting {\n entry / notifyCustomer()\n enterPin(code) [pin wrong] / beep()\n}\nWaiting : locate / shareLocation()\nRed : write a tiny failing test\nWaiting --> Unlocked : enterPin(code) [pin matches]');
  const byName = Object.fromEntries(model.states.map(state => [state.name, state]));
  assert.deepEqual(Array.from(byName.Waiting.internalTransitions), ['enterPin(code) [pin wrong] / beep()', 'locate / shareLocation()']);
  assert.equal(byName.Waiting.entryAction, 'notifyCustomer()');
  assert.equal(byName.Red, undefined, 'a description row without an effect slash keeps its existing meaning');
  assert.equal(model.transitions.length, 1);
});

test('a top-level highlight restyles a nested state without moving it out of its composite', () => {
  const model = parsers().state('state Delivering {\n [*] --> Driving\n Driving --> Unlocked : arrived\n}\nDelivering --> Returning : low\nstate Unlocked #fff0ac hatched');
  const unlocked = model.states.find(state => state.name === 'Unlocked');
  assert.equal(unlocked.parent, 'Delivering');
  assert.ok(unlocked.highlight || unlocked.texture, 'the highlight still applies');
});

// Distance from a rendered label to the nearest point of a rendered route.
function nearestRouteDistance(label, route) {
  let best = Infinity;
  const length = route.getTotalLength();
  for (let at = 0; at <= length; at += 3) {
    const point = route.getPointAtLength(at);
    const dx = Math.max(label.x - point.x, 0, point.x - (label.x + label.width));
    const dy = Math.max(label.y - point.y, 0, point.y - (label.y + label.height));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

test('a self-transition moves to a free face when another route passes its default spot', async () => {
  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html lang="en"><title>Self-transition regression</title><body><div id="diagram"></div></body></html>');
    await page.addScriptTag({ path: bundlePath });
    await page.addScriptTag({ content: `window.nearestRouteDistance = ${nearestRouteDistance}` });
    const result = await page.evaluate(() => {
      const host = document.getElementById('diagram');
      window.UMLStateDiagram.render(host, 'layout compact\n[*] --> Driving\nDriving --> Waiting : arrived\nWaiting --> Unlocked : enterPin(code) [pin matches]\nWaiting --> Waiting : extendWait\nUnlocked --> Returning : lidClosed / playThanks()\nWaiting --> Returning : after(10 min)\nDriving --> Returning : when(battery < 15%)\nReturning --> [*]\nWaiting : entry / notifyCustomer()\nWaiting : enterPin(code) [pin wrong] / beep()\nUnlocked : entry / unlockLid()\nUnlocked : exit / lockLid()\nReturning : do / driveToBase()');
      const svg = host.querySelector('svg');
      const label = Array.from(svg.querySelectorAll('text[data-layout-kind="edge-label"]')).find(node => node.textContent === 'extendWait');
      const loopId = label.getAttribute('data-layout-route-id');
      const others = Array.from(svg.querySelectorAll('[data-layout-route-id]:not([data-layout-route-decorative])'))
        .filter(path => path.getAttribute('data-layout-route-id') !== loopId);
      const box = label.getBBox();
      return {
        nearestOther: Math.min(...others.map(path => window.nearestRouteDistance(box, path))),
        own: window.nearestRouteDistance(box, svg.querySelector(`[data-layout-route-id="${loopId}"]:not([data-layout-route-decorative])`)),
      };
    });
    assert.ok(result.own <= 30, 'the label stays beside its loop');
    assert.ok(result.nearestOther > result.own, `another route (${result.nearestOther}px) must not be closer to the label than its loop (${result.own}px)`);
  } finally {
    await browser.close();
  }
});
