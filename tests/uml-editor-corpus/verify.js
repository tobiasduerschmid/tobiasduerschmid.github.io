'use strict';
/**
 * Compares what a gesture left with what its fixture recorded (spec 2026-11-12 §9.2: byte for byte,
 * never re-recorded to make a stage pass). It names the first difference, so a failing stage reads
 * as one line: the phase, the field, and the two values.
 */

const OBSERVATION_FIELDS = Object.freeze(['text', 'regions', 'properties', 'draft', 'selection', 'focus']);
const GESTURE_FIELDS = Object.freeze(['type', 'page', 'start', 'steps']);
const PHASES = Object.freeze(['after', 'afterUndo', 'afterRedo']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function describeLine(text, lineIndex) {
  const line = text.split('\n')[lineIndex];
  return line === undefined ? '(no such line)' : JSON.stringify(line);
}

/** For two different strings with line breaks: the first line where they differ. */
function lineDifference(expected, actual) {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const count = Math.max(expectedLines.length, actualLines.length);
  for (let index = 0; index < count; index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      return `line ${index + 1}: expected ${describeLine(expected, index)}, got ${describeLine(actual, index)}`;
    }
  }
  return `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}

function describeValues(expected, actual) {
  if (typeof expected === 'string' && typeof actual === 'string' && (expected.includes('\n') || actual.includes('\n'))) {
    return lineDifference(expected, actual);
  }
  return `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}

/** The first place where two values differ, as `{ path, expected, actual }`, or null. */
function firstDifferenceAt(pathParts, expected, actual) {
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const count = Math.max(expected.length, actual.length);
    for (let index = 0; index < count; index += 1) {
      const found = firstDifferenceAt([...pathParts, `[${index}]`], expected[index], actual[index]);
      if (found) return found;
    }
    return null;
  }
  if (isPlainObject(expected) && isPlainObject(actual)) {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])];
    for (const key of keys) {
      const found = firstDifferenceAt([...pathParts, key], expected[key], actual[key]);
      if (found) return found;
    }
    return null;
  }
  return Object.is(expected, actual) ? null : { path: pathParts, expected, actual };
}

function formatDifference(found) {
  return `${found.path.join('.').replace(/\.\[/g, '[')}: ${describeValues(found.expected, found.actual)}`;
}

/** The first field, in the order of OBSERVATION_FIELDS, where two observations differ; null when equal. */
function firstDifference(expected, actual) {
  for (const field of OBSERVATION_FIELDS) {
    const found = firstDifferenceAt([field], expected[field], actual[field]);
    if (found) return formatDifference(found);
  }
  return null;
}

/**
 * The first difference between a fixture and a run of its gesture, or null: first the gesture
 * itself (a gesture changed after recording no longer matches its fixture), then each phase.
 */
function differenceOfRun(fixture, gesture, run) {
  for (const field of GESTURE_FIELDS) {
    const found = firstDifferenceAt([field], fixture[field], gesture[field]);
    if (found) return `the gesture changed since it was recorded: ${formatDifference(found)}`;
  }
  for (const phase of PHASES) {
    const difference = firstDifference(fixture[phase], run[phase]);
    if (difference) return `${phase}: ${difference}`;
  }
  return null;
}

module.exports = { OBSERVATION_FIELDS, PHASES, firstDifference, differenceOfRun };
