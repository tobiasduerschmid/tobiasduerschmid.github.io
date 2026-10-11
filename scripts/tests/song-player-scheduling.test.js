'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { FrameBudget } = require('../../js/song-video/player');

test('render budget lowers visual frequency when rendering is expensive', () => {
  const budget = new FrameBudget();
  assert.equal(budget.interval, 1000 / 60);
  for (let frame = 0; frame < 20; frame++) budget.record(45);
  assert.equal(budget.interval, 100);
});

test('render budget recovers when frames become inexpensive', () => {
  const budget = new FrameBudget();
  for (let frame = 0; frame < 20; frame++) budget.record(45);
  for (let frame = 0; frame < 60; frame++) budget.record(1);
  assert.equal(budget.interval, 1000 / 60);
});

test('render budget leaves headroom even when a frame takes longer than 100ms', () => {
  const budget = new FrameBudget();
  for (let frame = 0; frame < 20; frame++) budget.record(180);
  assert.ok(budget.interval >= 250, 'slow frames must leave time for audio and controls');
});
