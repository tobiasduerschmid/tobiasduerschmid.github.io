'use strict';

// Timing budget of a delegated UML view's drawing (UML-view editing spec §7.9; C4 spec §9.2: 250 ms for a view, a hard
// ceiling of 1500 ms). A drop on a UML view is one dispatch, one projection, and one draw, also when a stored bend is
// dropped (Ruling RR-11); this file times the draw, `ArchUMLC4Render.renderDelegatedView`, on both paths:
// - every bend kept: each UML view of the reference model with its pinned layout (c4-delegated-view.test.js:
//   positions, the lifeline order, and a bend in the code and the deployment view), where every bend still joins its
//   boxes;
// - a bend dropped: each view that keeps a bend (code and deployment, spec §4.2), with a pin moved so that its bend no
//   longer ends on its box, so the one draw leaves that bend out (`UMLShared.renderSkippingDetachedRoutes`) and reports
//   it (spec §6 rule 5).
//
// These gates measure wall-clock time, so they hold only in the serial lane `npm run test:timing`, run alone (see
// c4-route-timing.test.js).

const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../../chromium-launch-options');
const { UML_VIEWS, BENT_LINES, openRendererPage, pinnedModel, withBendDetached } = require('../c4-delegated-view.test.js');

const TIMED_RUNS = 5;
const BUDGET_MS = 250;
const CEILING_MS = 1500;

let browser;
let pinned;

before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  const page = await openRendererPage(browser);
  pinned = await pinnedModel(page);
  await page.close();
});
after(async () => { if (browser) await browser.close(); });

/**
 * `TIMED_RUNS` draws of view `selector` of `model`, each into a fresh container, in a fresh page so no other view's
 * work shares its heap. The view model is projected once, before the timed draws. Returns every run's time and the
 * stored routes each run dropped, which tell whether the draw kept every bend or left one out.
 */
async function timedDraws(model, selector) {
  const page = await openRendererPage(browser);
  try {
    return await page.evaluate(([source, viewSelector, runs]) => {
      const view = window.ArchUMLC4.project(window.ArchUMLC4.load(source), viewSelector);
      const draws = Array.from({ length: runs }, () => {
        const container = document.createElement('div');
        document.body.append(container);
        const start = performance.now();
        const { droppedRoutes } = window.ArchUMLC4Render.renderDelegatedView(container, view);
        const time = performance.now() - start;
        container.remove();
        return { time, droppedRoutes };
      });
      return { times: draws.map((draw) => draw.time), droppedRoutes: draws.map((draw) => draw.droppedRoutes) };
    }, [model, selector, TIMED_RUNS]);
  } finally {
    await page.close();
  }
}

const median = (times) => times.slice().sort((a, b) => a - b)[Math.floor(times.length / 2)];
const describeTimes = (label, times) => `renderDelegatedView of ${label}: median ${Math.round(median(times))} ms (${times.map(Math.round).join(', ')} ms)`;

/** Asserts the budget and the ceiling on `times`, the draws of `label`. */
function assertWithinBudget(label, times) {
  console.log(describeTimes(label, times));
  assert.ok(median(times) <= BUDGET_MS, describeTimes(label, times));
  assert.ok(Math.max(...times) <= CEILING_MS, describeTimes(label, times));
}

UML_VIEWS.forEach((selector) => {
  test(`each UML view of the reference model with pins draws within ${BUDGET_MS} ms, and never beyond ${CEILING_MS} ms (${selector})`, async () => {
    const { times, droppedRoutes } = await timedDraws(pinned, selector);

    assert.deepEqual(droppedRoutes, Array(TIMED_RUNS).fill([]), `every bend of ${selector} joins its boxes, so every draw keeps it`);
    assertWithinBudget(selector, times);
  });
});

Object.entries(BENT_LINES).forEach(([selector, bentLine]) => {
  test(`a UML view of the reference model whose stored bend left its box is drawn once without the bend, within ${BUDGET_MS} ms, `
    + `and never beyond ${CEILING_MS} ms (${selector})`, async () => {
    const { times, droppedRoutes } = await timedDraws(withBendDetached(pinned, selector), selector);

    assert.deepEqual(droppedRoutes, Array(TIMED_RUNS).fill([bentLine]), `every draw of ${selector} leaves its detached bend out and reports it`);
    assertWithinBudget(`${selector} with its bend dropped`, times);
  });
});
