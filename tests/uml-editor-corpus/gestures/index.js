'use strict';
/**
 * The gestures of the UML editor's corpus (spec 2026-11-12 §9.2), merged from the family files in
 * this folder: every `<family>.js` beside this one exports an array of gestures of that family
 * (`smoke` here; the families of plan Tasks 4-8 add their own files). A gesture is
 * `{ id, family, type, page, start, steps, covers }`; perform.js says what each field means.
 * Ids are unique across families and safe as file names: a gesture's fixture is
 * tests/fixtures/uml-editor-corpus/<family>/<id>.json.
 */

const fs = require('node:fs');
const path = require('node:path');
const { EDITOR_PAGES } = require('../perform');

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// A fixture stores the start and the steps, so they must survive JSON as they are.
function isJsonData(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonData);
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.values(value).every(isJsonData);
  }
  return false;
}

function problemsOf(gesture, family) {
  const problems = [];
  if (!ID_PATTERN.test(gesture.id || '')) problems.push('an id of lowercase words joined by hyphens');
  if (gesture.family !== family) problems.push(`family "${family}", the name of its file`);
  if (!EDITOR_PAGES.includes(gesture.page)) problems.push(`a page among ${EDITOR_PAGES.join(', ')}`);
  if (typeof gesture.type !== 'string' || !gesture.type) problems.push('a diagram type');
  const start = gesture.start;
  const startIsDraft = start !== null && typeof start === 'object' && typeof start.draft === 'string';
  if (!(start === null || typeof start === 'string' || startIsDraft)) problems.push('a start: a string, null, or { draft }');
  if (!Array.isArray(gesture.steps) || gesture.steps.length === 0) problems.push('at least one step');
  if (!isJsonData(gesture.start) || !isJsonData(gesture.steps)) problems.push('a start and steps of plain JSON data (no RegExp, function, or undefined)');
  if (!Array.isArray(gesture.covers) || gesture.covers.some((name) => typeof name !== 'string')) {
    problems.push('covers: the names of the functions of spec §3.5 it reaches');
  }
  return problems;
}

/**
 * Every gesture of every family file in `directory`, in file order, each checked. With `family`,
 * only that family's file is read, so a family can be recorded while another file is being written.
 */
function loadGestures({ family = '', directory = __dirname } = {}) {
  const files = family
    ? [`${family}.js`].filter((name) => fs.existsSync(path.join(directory, name)))
    : fs.readdirSync(directory).filter((name) => name.endsWith('.js') && name !== 'index.js').sort();
  const gestures = files.flatMap((file) => {
    const family = path.basename(file, '.js');
    const list = require(path.join(directory, file));
    if (!Array.isArray(list)) throw new Error(`gestures/${file} must export an array of gestures`);
    return list.map((gesture) => {
      const problems = problemsOf(gesture, family);
      if (problems.length) throw new Error(`gesture ${JSON.stringify(gesture.id)} in gestures/${file} needs ${problems.join('; ')}`);
      return gesture;
    });
  });
  const seen = new Set();
  for (const gesture of gestures) {
    if (seen.has(gesture.id)) throw new Error(`two gestures have the id "${gesture.id}"`);
    seen.add(gesture.id);
  }
  return gestures;
}

module.exports = { loadGestures };
