'use strict';

// Timing budgets of the C4 router (routing redesign §8, docs/superpowers/specs/2026-11-09-c4-routing-redesign.md).
//
// These gates measure wall-clock time, so they hold only when nothing else competes for the CPU. That is why this
// file sits outside the parallel `npm run test:unit` glob (`scripts/tests/*.test.js` does not reach this folder)
// and runs in its own serial lane: `npm run test:timing`, which passes `--test-concurrency=1`. Run that lane alone,
// not beside another test run or build. Under the parallel unit run the 40-element view measured a 1665 ms median
// against the 1500 ms ceiling; alone it measured about 1050 ms (Task 8d).

const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../../chromium-launch-options');
const { VIEWS, PINNED, LARGE_VIEW, generatedLandscape, openC4Page } = require('../c4-route-views.js');

const TIMED_RUNS = 5;

let browser;

before(async () => { browser = await chromium.launch(chromiumLaunchOptions()); });
after(async () => { if (browser) await browser.close(); });

/**
 * The median time of `TIMED_RUNS` `layoutView` calls on one view, in a fresh page so no other test's work shares
 * its heap, with every run's time for the log.
 */
async function layoutTimes(text, selector, pins) {
  const c4Page = await openC4Page(browser);
  try {
    const times = await c4Page.evaluate(([source, viewSelector, pinList, runs]) => {
      const view = window.ArchUMLC4.project(window.ArchUMLC4.load(source), viewSelector);
      return Array.from({ length: runs }, () => {
        const start = performance.now();
        window.ArchUMLC4Render.layoutView(view, undefined, { pins: new Map(pinList || []) });
        return performance.now() - start;
      });
    }, [text, selector, pins || null, TIMED_RUNS]);
    return { median: times.slice().sort((a, b) => a - b)[Math.floor(TIMED_RUNS / 2)], times };
  } finally {
    await c4Page.close();
  }
}

function describeTimes(name, { median, times }) {
  return `layoutView of ${name}: median ${Math.round(median)} ms (${times.map(Math.round).join(', ')} ms)`;
}

// The §8 design target for the 40-element view is 250 ms; 1500 ms is the hard ceiling the task enforces. The ceiling
// holds only in the serial lane described at the top of this file.
const LARGE_VIEW_CEILING_MS = 1500;

test(`the 40-element view lays out within the ${LARGE_VIEW_CEILING_MS} ms ceiling`, async () => {
  const timing = await layoutTimes(generatedLandscape(LARGE_VIEW.seed, LARGE_VIEW.size).text, 'landscape');
  console.log(describeTimes('the 40-element view', timing));
  assert.ok(timing.median <= LARGE_VIEW_CEILING_MS, describeTimes('the 40-element view', timing));
});

// No gated view is larger than the 40-element view, so each stays within that view's design budget (§8).
const GATED_VIEW_BUDGET_MS = 250;

VIEWS.concat([PINNED]).forEach(([name, text, selector, , options = {}]) => {
  test(`the view lays out within ${GATED_VIEW_BUDGET_MS} ms (${name})`, async () => {
    const timing = await layoutTimes(text, selector, options.pins);
    console.log(describeTimes(name, timing));
    assert.ok(timing.median <= GATED_VIEW_BUDGET_MS, describeTimes(name, timing));
  });
});
