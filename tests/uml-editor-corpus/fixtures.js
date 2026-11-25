'use strict';
/**
 * The corpus fixtures (spec 2026-11-12 §9.2): one JSON file per gesture under
 * tests/fixtures/uml-editor-corpus/<family>/<id>.json, shaped
 * `{ id, family, type, page, platform: { os, browser }, start, steps, after, afterUndo, afterRedo, operations }`.
 * A fixture is recorded once, at stage R0, and never written again: recording refuses an existing
 * file. Only its `operations` (Task 11) may be added later; the evidence seal ignores that field.
 */

const fs = require('node:fs');
const path = require('node:path');

const FIXTURE_ROOT = path.join(__dirname, '..', 'fixtures', 'uml-editor-corpus');

function fixturePathOf(gesture) {
  return path.join(FIXTURE_ROOT, gesture.family, `${gesture.id}.json`);
}

/** The gesture's fixture, or null when none was recorded. */
function readFixture(gesture) {
  const file = fixturePathOf(gesture);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function buildFixture(gesture, platform, run) {
  return {
    id: gesture.id,
    family: gesture.family,
    type: gesture.type,
    page: gesture.page,
    platform,
    start: gesture.start,
    steps: gesture.steps,
    after: run.after,
    afterUndo: run.afterUndo,
    afterRedo: run.afterRedo,
    operations: [],
  };
}

/** Writes a new fixture; refuses to overwrite one. */
function writeFixture(gesture, fixture) {
  const file = fixturePathOf(gesture);
  if (fs.existsSync(file)) {
    throw new Error(`record refuses to overwrite ${path.relative(process.cwd(), file)}: a fixture is recorded once (spec §9.2)`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`, { flag: 'wx' });
}

module.exports = { FIXTURE_ROOT, fixturePathOf, readFixture, buildFixture, writeFixture };
