// @ts-check
// Style evidence of the UML editor refactor (spec 2026-11-12 §9.4 point 3; plan Task 3): the computed
// styles of the hit layer's states (.uml-pg-edit-hitbox, .uml-pg-edge-hitbox, the extend handle, …)
// and of every element a literal style assignment in the editor's init() styles stay the same in
// light mode, dark mode, and print while presentation moves into CSS (stages R4 and R5d). The states,
// their gestures, and the entries they read are in tests/uml-editor-corpus/style-states.js.
//
// UML_STYLES_MODE: unset verifies against tests/fixtures/uml-editor-computed-styles.json; `record`
// writes each state's entry and refuses to overwrite one.
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { loadIncludeScript, literalStyleAssignments } = require('../scripts/tests/helpers/uml-editor-script');
const { STYLE_STATES, styleAssignmentEntries, reachState, readState } = require('./uml-editor-corpus/style-states');
const { THEMES } = require('./uml-editor-corpus/perform');

const FIXTURE = path.join(__dirname, 'fixtures', 'uml-editor-computed-styles.json');
const MODE = process.env.UML_STYLES_MODE || 'verify';
// A whole style attribute or cssText is not one property; the entry of such an assignment names its own.
const WHOLE_STYLE = new Set(['cssText', 'style']);

if (MODE !== 'verify' && MODE !== 'record') throw new Error(`unknown UML_STYLES_MODE=${MODE}`);

function readFixture() {
  return fs.existsSync(FIXTURE) ? JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) : null;
}

function recordedStyles(theme, stateId) {
  const fixture = readFixture();
  return fixture && fixture[theme] ? fixture[theme][stateId] : undefined;
}

function recordState(theme, stateId, values) {
  const fixture = readFixture() || Object.fromEntries(THEMES.map((name) => [name, {}]));
  fixture[theme][stateId] = values;
  fs.writeFileSync(FIXTURE, `${JSON.stringify(fixture, null, 2)}\n`);
}

function cssPropertyName(property) {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

test('every literal style assignment in init has a style state', () => {
  const entries = styleAssignmentEntries();

  const unread = literalStyleAssignments(loadIncludeScript().ast, { within: 'init' })
    .filter((assignment) => !entries[assignment.key]
      || (!WHOLE_STYLE.has(assignment.property)
        && !entries[assignment.key].entry.properties.includes(cssPropertyName(assignment.property))))
    .map((assignment) => `${assignment.key}: ${assignment.target}.style.${assignment.property} = ${JSON.stringify(assignment.value)} (include line ${assignment.line})`);

  expect(unread, 'each needs an entry in a state of style-states.js that reads its property').toEqual([]);
});

for (const state of STYLE_STATES) {
  for (const theme of THEMES) {
    test(`${state.id} (${theme})`, async ({ page }) => {
      const expected = recordedStyles(theme, state.id);
      if (MODE === 'record') {
        expect(expected, `record refuses to overwrite the ${theme} styles of "${state.id}"`).toBeUndefined();
      } else {
        expect(expected, `no recorded ${theme} styles of "${state.id}" in ${path.relative(process.cwd(), FIXTURE)}`).toBeDefined();
      }

      await reachState(page, state, theme);
      const values = await readState(page, state);

      if (MODE === 'record') recordState(theme, state.id, values);
      else expect(values).toEqual(expected);
    });
  }
}
