const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');

const sceneNumber = (topic, id) => yaml.load(readFileSync(require.resolve(`../_data/explainers/${topic}.yml`), 'utf8'))
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

test('a refused full-screen request leaves the narration in the page with a status message', async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('Permissions check failed'));
  });
  const narration = narrations[3];
  await page.goto(narration.url);
  const lesson = lessonOf(page, narration);
  await lesson.getByRole('button', { name: 'Enter full screen' }).click();
  await expect(lesson.getByRole('status').filter({ hasText: 'could not change full screen' })).toBeVisible();
  await expect(lesson.getByRole('button', { name: 'Enter full screen' })).toBeVisible();
  expect(await fullScreenActive(page)).toBe(false);
});

test('browsers without element full screen get no full-screen button', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
  });
  const narration = narrations[0];
  await page.goto(narration.url);
  const lesson = lessonOf(page, narration);
  await expect(lesson.getByRole('button', { name: 'Play narration' })).toBeVisible();
  await expect(lesson.getByRole('button', { name: /full screen/ })).toHaveCount(0);
});
