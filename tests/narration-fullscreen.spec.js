const { loadStory } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const sceneNumber = (topic, id) => loadStory(topic)
  .scenes.findIndex(scene => scene.id === id);
// Every narration uses the shared transport, so each one gets the same contract.
// Pattern lessons also name a scene that shows code beside a fitted diagram.
const narrations = [
  { url: '/SEBook/tools/nodejs.html', id: 'nodejs-animation', title: 'Node.js in motion' },
  { url: '/SEBook/tools/react.html', id: 'react-animation', title: 'React in motion' },
  { url: '/SEBook/designpatterns/observer.html', id: 'observer-animation', title: 'Observer in a user interface',
    diagramScene: sceneNumber('observer', 'contract') },
  { url: '/SEBook/designpatterns/state.html', id: 'state-animation', title: 'The State pattern in a game companion',
    diagramScene: sceneNumber('state', 'state_role') },
  { url: '/SEBook/designpatterns/strategy.html', id: 'strategy-animation', title: 'The Strategy pattern in a bill-splitting app',
    diagramScene: sceneNumber('strategy', 'strategy_role') },
  { url: '/SEBook/designpatterns/mvc.html', id: 'mvc-animation', title: 'Model-View-Controller in a data visualizer',
    diagramScene: sceneNumber('mvc', 'model_role') },
  { url: '/SEBook/uml_class_diagram.html', id: 'uml_class_diagram-animation', title: 'UML class diagrams in a study-group chat app',
    diagramScene: sceneNumber('uml_class_diagram', 'class_box') },
  { url: '/SEBook/uml_sequence_diagram.html', id: 'uml_sequence_diagram-animation', title: "UML sequence diagrams on a space probe's scan",
    diagramScene: sceneNumber('uml_sequence_diagram', 'practice') },
  { url: '/SEBook/process/scrum.html', id: 'scrum-video', title: 'Scrum in one sprint' },
];
const lessonOf = (page, narration) => page.getByRole('region', { name: narration.title, exact: true });
// Accessibility checkpoints audit `.nja-player`, the element that fills the screen.
const insideFullScreen = locator => locator.evaluate(element =>
  Boolean(document.fullscreenElement && document.fullscreenElement.contains(element)));
const fullScreenActive = page => page.evaluate(() => document.fullscreenElement !== null);

for (const narration of narrations) {
  test(`${narration.title}: full screen keeps the controls and narration, then returns to the page`, async ({ page }) => {
    await page.goto(narration.url);
    const lesson = lessonOf(page, narration);
    await lesson.getByRole('button', { name: 'Enter full screen' }).press('Enter');
    const exit = lesson.getByRole('button', { name: 'Exit full screen' });
    await expect(exit).toBeFocused();
    expect(await insideFullScreen(lesson.getByRole('button', { name: 'Play narration' }))).toBe(true);
    expect(await insideFullScreen(lesson.getByRole('region', { name: 'Narration' }))).toBe(true);
    await a11yCheckpoint(page, `${narration.id} full screen`, { include: `#${narration.id} .nja-player`, feature: 'narration-fullscreen' });

    await exit.click();
    await expect(lesson.getByRole('button', { name: 'Enter full screen' })).toBeFocused();
    expect(await fullScreenActive(page)).toBe(false);
  });
}

for (const narration of narrations.filter(item => item.diagramScene !== undefined)) {
  test(`${narration.title}: knowledge checks and diagrams stay usable in full screen`, async ({ page }) => {
    await page.goto(narration.url);
    const lesson = lessonOf(page, narration);
    const diagram = lesson.locator('[data-np-diagram]:visible');
    await lesson.getByRole('combobox', { name: 'Scene' }).selectOption(String(narration.diagramScene));
    const fitsColumn = () => diagram.evaluate(container =>
      container.querySelector('svg').getBoundingClientRect().width <= container.getBoundingClientRect().width + 1);

    const enter = lesson.getByRole('button', { name: 'Enter full screen' });
    const exit = lesson.getByRole('button', { name: 'Exit full screen' });
    // The cue's diagram fits its column in both layouts without moving to another cue.
    await enter.click();
    await expect(exit).toBeVisible();
    await expect.poll(fitsColumn).toBe(true);
    await exit.click();
    await expect(enter).toBeVisible();
    await expect.poll(fitsColumn).toBe(true);

    await enter.click();
    await lesson.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    // Focus lands on the heading or, once the window has focus, the first answer.
    const check = lesson.getByRole('region', { name: /Knowledge check$/ });
    await expect.poll(() => check.evaluate(region => region.contains(document.activeElement))).toBe(true);
    expect(await insideFullScreen(check)).toBe(true);
    await a11yCheckpoint(page, `${narration.id} full-screen check`, { include: `#${narration.id} .nja-player`, feature: 'narration-fullscreen' });
  });
}

// What a viewer sees at the screen's corners and center belongs to the narration.
const coversViewport = lesson => lesson.evaluate(root => {
  const right = window.innerWidth - 2;
  const bottom = window.innerHeight - 2;
  return [[1, 1], [right, 1], [1, bottom], [right, bottom], [right / 2, bottom / 2]]
    .every(([x, y]) => root.contains(document.elementFromPoint(x, y)));
});
// Where Tab takes focus outside the narration (the page itself counts as nowhere).
const focusEscapes = async (page, lesson, presses) => {
  const escapes = [];
  for (let press = 0; press < presses; press += 1) {
    await page.keyboard.press('Tab');
    const outside = await lesson.evaluate(root => (root.contains(document.activeElement) || document.activeElement === document.body
      ? null : document.activeElement.outerHTML.slice(0, 80)));
    if (outside) escapes.push(outside);
  }
  return escapes;
};

test('a refused full-screen request fills the viewport instead, and the button leaves it', async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('Permissions check failed'));
  });
  const narration = narrations[3];
  await page.goto(narration.url);
  const lesson = lessonOf(page, narration);
  await lesson.getByRole('button', { name: 'Enter full screen' }).click();
  const exit = lesson.getByRole('button', { name: 'Exit full screen' });
  await expect(exit).toBeVisible();
  expect(await coversViewport(lesson)).toBe(true);
  expect(await fullScreenActive(page)).toBe(false);

  await exit.click();
  await expect(lesson.getByRole('button', { name: 'Enter full screen' })).toBeFocused();
  expect(await coversViewport(lesson)).toBe(false);
});

test('without element full screen (Safari on iPhone), the narration fills the viewport and keeps focus until Escape', async ({ page }) => {
  // Neither the standard API nor Safari's prefixed one, as on an iPhone.
  await page.addInitScript(() => {
    delete Element.prototype.requestFullscreen;
    delete Element.prototype.webkitRequestFullscreen;
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
    Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => false });
  });
  const narration = narrations[0];
  await page.goto(narration.url);
  const lesson = lessonOf(page, narration);
  await lesson.getByRole('button', { name: 'Enter full screen' }).click();
  await expect(lesson.getByRole('button', { name: 'Exit full screen' })).toBeFocused();
  expect(await coversViewport(lesson)).toBe(true);
  expect(await fullScreenActive(page)).toBe(false);
  // More presses than the player has controls, so Tab would reach the page behind it.
  expect(await focusEscapes(page, lesson, 30)).toEqual([]);
  await a11yCheckpoint(page, `${narration.id} viewport full screen`, { include: `#${narration.id} .nja-player`, feature: 'narration-fullscreen' });

  await page.keyboard.press('Escape');
  await expect(lesson.getByRole('button', { name: 'Enter full screen' })).toBeVisible();
  expect(await coversViewport(lesson)).toBe(false);
  expect(await focusEscapes(page, lesson, 30)).not.toEqual([]);
});
