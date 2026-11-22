// @ts-check
// Runner of the UML editor's gesture corpus (spec 2026-11-12 §9.2; plan Task 3): every gesture of
// tests/uml-editor-corpus/gestures/ is performed on the page it names (the editor of
// _includes/uml-editor.html on /SEBook/tools/uml-editor, the playground, and the Monopoly UML
// homework), and what it leaves is compared with the fixture recorded at stage R0. This file holds
// the modes and the wiring only; perform.js runs a gesture, observe.js reads the page, verify.js
// compares, fixtures.js reads and writes the fixtures, coverage.js finds the write sites a run executed,
// operation-log.js reads and checks the operations the editor writes.
//
// UML_CORPUS_MODE: unset verifies, and from stage R1 also checks that each gesture whose write sites
// are converted (scripts/tests/fixtures/uml-editor-write-sites.json) logs the operations its fixture
// records; `record` writes the fixtures of UML_CORPUS_FAMILY and refuses to overwrite one; `coverage`
// verifies and also writes, per gesture, the write sites its run executed into
// UML_CORPUS_COVERAGE_DIR, a folder outside the repository (plan Task 10, the write-site map);
// `log-operations` (plan Task 11) runs only the gestures whose write sites are converted, verifies
// them, checks their operations, and writes them into the fixtures' `operations`.
// UML_CORPUS_FAMILY selects one family in any mode. Verify mode also runs the cases of stage R0
// behaviour that no sealed gesture reaches (below), with the family `class`.
//
// The corpus after stage R6 (plan Task 25). The refactor is done, and the corpus stays as the UML editor's
// characterization suite: it pins what the editor does to the text, the announcements, the Properties pane,
// the stored draft, the selection, and the focus, gesture by gesture. It runs in the `chromium` project on
// the platform that recorded it: each fixture names the operating system and the browser version
// (`platform`), because drawn coordinates depend on fonts. Elsewhere a gesture is skipped with that reason.
// A fixture is recorded again only for a behaviour change the user approved, one gesture at a time, with
// `rerecorded: { date, reason }` in it and the seal renewed in the same change; never to make a refactor pass.
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { loadGestures } = require('./uml-editor-corpus/gestures');
const { runGesture } = require('./uml-editor-corpus/perform');
const { differenceOfRun } = require('./uml-editor-corpus/verify');
const fixtures = require('./uml-editor-corpus/fixtures');
const coverage = require('./uml-editor-corpus/coverage');
const operationLog = require('./uml-editor-corpus/operation-log');
const writeSiteMap = require('../scripts/tests/fixtures/uml-editor-write-sites.json');

const MODES = ['verify', 'record', 'coverage', 'log-operations'];
const MODE = process.env.UML_CORPUS_MODE || 'verify';
const FAMILY = process.env.UML_CORPUS_FAMILY || '';
const COVERAGE_DIR = process.env.UML_CORPUS_COVERAGE_DIR ? path.resolve(process.env.UML_CORPUS_COVERAGE_DIR) : '';
const REPOSITORY = path.resolve(__dirname, '..');
const LOG_TEST = 'a gesture whose write sites are converted logs one operation per write, with a revision and its scene facts';

if (!MODES.includes(MODE)) throw new Error(`unknown UML_CORPUS_MODE=${MODE}`);
if (MODE === 'record' && !FAMILY) throw new Error('UML_CORPUS_MODE=record records one family: set UML_CORPUS_FAMILY');
if (MODE === 'coverage' && (!COVERAGE_DIR || !path.relative(REPOSITORY, COVERAGE_DIR).startsWith('..'))) {
  throw new Error('UML_CORPUS_MODE=coverage writes what each gesture executed: set UML_CORPUS_COVERAGE_DIR to a folder outside the repository');
}

const gestures = loadGestures({ family: FAMILY });
if (FAMILY && gestures.length === 0) throw new Error(`no gesture of the family "${FAMILY}"`);
const loggedGestures = gestures.filter((gesture) => operationLog.convertedOperationSites(writeSiteMap, gesture.id).length > 0);

function platformOf(browserName, browser) {
  return { os: `${process.platform}-${process.arch}`, browser: `${browserName} ${browser.version()}` };
}

/** Skips the running test when `fixture` was recorded on another platform than this run's (see the header). */
function skipOffItsPlatform(fixture, browserName, browser) {
  if (!fixture || !fixture.platform) return;
  const here = platformOf(browserName, browser);
  test.skip(fixture.platform.os !== here.os || fixture.platform.browser !== here.browser,
    `the fixture was recorded on ${fixture.platform.os} with ${fixture.platform.browser}, and drawn coordinates depend on fonts; this run is ${here.os} with ${here.browser}`);
}

// Each built page's URL and the write sites of its editor script, fetched once per page (coverage mode).
const builtWriteSites = new Map();

async function writeSitesOfPage(request, pagePath) {
  if (!builtWriteSites.has(pagePath)) {
    const response = await request.get(pagePath);
    expect(response.ok(), `the built page ${pagePath} loads`).toBe(true);
    builtWriteSites.set(pagePath, { url: response.url(), sites: coverage.writeSitesOfBuiltPage(await response.text()) });
  }
  return builtWriteSites.get(pagePath);
}

/** Starts recording the write sites the gesture's page runs, before the page opens (coverage mode). */
async function startRecordingWrites(page, request, gesture) {
  const devtools = await page.context().newCDPSession(page);
  const recording = await coverage.startWriteSiteRecording(devtools, await writeSitesOfPage(request, gesture.page));
  return {
    async stop() {
      const executed = await recording.stop();
      await devtools.detach();
      return executed;
    },
  };
}

/** Runs the gesture with the operation log listening to its steps alone; resolves to the run and the log. */
async function runLoggingOperations(page, gesture) {
  let entries = null;
  const run = await runGesture(page, gesture, {
    beforeSteps: (stepsPage) => operationLog.startOperationLog(stepsPage),
    afterSteps: async (stepsPage) => { entries = await operationLog.stopOperationLog(stepsPage); },
  });
  return { run, entries };
}

if (MODE !== 'log-operations') {
  for (const gesture of gestures) {
    test(`${gesture.family} › ${gesture.id}`, async ({ page, browser, browserName, request }) => {
      const fixture = fixtures.readFixture(gesture);
      const fixtureFile = path.relative(process.cwd(), fixtures.fixturePathOf(gesture));
      if (MODE === 'record') {
        expect(fixture, `record refuses to overwrite ${fixtureFile}`).toBeNull();
      } else {
        expect(fixture, `no fixture: ${fixtureFile} (record it with UML_CORPUS_MODE=record)`).not.toBeNull();
        skipOffItsPlatform(fixture, browserName, browser);
      }

      // The recording starts before the page opens and its breakpoints hold across reloads, so it sees the whole run.
      const recording = MODE === 'coverage' ? await startRecordingWrites(page, request, gesture) : null;
      const run = await runGesture(page, gesture);
      const executed = recording ? await recording.stop() : null;

      if (MODE === 'record') {
        fixtures.writeFixture(gesture, fixtures.buildFixture(gesture, platformOf(browserName, browser), run));
      } else {
        expect(differenceOfRun(fixture, gesture, run), `the gesture matches its fixture (recorded on ${JSON.stringify(fixture.platform)})`).toBeNull();
      }
      if (executed !== null) coverage.writeGestureCoverage(COVERAGE_DIR, gesture, executed);
    });
  }
}

// What the editor did at stage R0 on paths no sealed gesture reaches. The corpus was sealed before
// stage R1 converted its first write site, so a gesture can no longer join it; each case here pins
// R0's result with its own oracle and runs by the corpus protocol (runGesture). Reset Layout at R0
// replaced the source by the source without its layout lines and pinned positions, read nothing
// from the drawing, and so worked on a source that does not draw (review of plan Task 11, finding 1).
const R0_CASES_FAMILY = 'class';
const RESET_LAYOUT = { role: 'button', name: 'Reset Layout' };
const SOURCE_FIELD = { role: 'textbox', name: 'ArchUML diagram source' };
const CARD_LEFT_OPEN = [
  '@startuml',
  'card Cart @pos(40, 40) {',
  '  responsibility: Know selected products',
  '  collaborator: Catalog',
  '}',
  'card Catalog @pos(40, 300) {',
  '  responsibility: Provide current prices',
  '@enduml',
].join('\n');
const CARD_LEFT_OPEN_WITHOUT_LAYOUT = [
  '@startuml',
  'card Cart {',
  '  responsibility: Know selected products',
  '  collaborator: Catalog',
  '}',
  'card Catalog {',
  '  responsibility: Provide current prices',
  '@enduml',
].join('\n');
const CARDS_CLOSED = CARD_LEFT_OPEN.replace('\n@enduml', '\n}\n@enduml');

function crcCase(id, start, steps) {
  // The playground shows the source beside the drawing, so the source can be typed into.
  return { id, family: R0_CASES_FAMILY, type: 'crc', page: '/SEBook/tools/uml-playground', start, steps };
}

/** Runs a case by the corpus protocol and collects the page errors it throws on the way. */
async function runCollectingPageErrors(page, gesture) {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const run = await runGesture(page, gesture);
  return { run, pageErrors };
}

if (MODE === 'verify' && (!FAMILY || FAMILY === R0_CASES_FAMILY)) {
  test.describe('Reset Layout on a CRC source that does not draw, as at stage R0', () => {
    test('after the drawing failed, Reset Layout removes the pinned positions in one undo step without a page error', async ({ page }) => {
      const gesture = crcCase('crc-reset-layout-after-the-drawing-failed', CARD_LEFT_OPEN, [
        { do: 'click', target: RESET_LAYOUT },
      ]);

      const { run, pageErrors } = await runCollectingPageErrors(page, gesture);

      expect(pageErrors, 'the page throws no error').toEqual([]);
      expect(run.after.text, 'the source without its pinned positions').toBe(CARD_LEFT_OPEN_WITHOUT_LAYOUT);
      expect(run.afterUndo.text, 'Undo gives back the source as it was').toBe(CARD_LEFT_OPEN);
      expect(run.afterRedo.text, 'Redo removes them again').toBe(CARD_LEFT_OPEN_WITHOUT_LAYOUT);
    });

    test('while the last drawing still shows, before the edited source is drawn, Reset Layout removes the pinned positions without a page error', async ({ page }) => {
      // The clock stays paused after the fill, so the render delay has not run when the button is pressed.
      const gesture = crcCase('crc-reset-layout-before-the-edited-source-is-drawn', CARDS_CLOSED, [
        { do: 'fill', target: SOURCE_FIELD, value: CARD_LEFT_OPEN },
        { do: 'click', target: RESET_LAYOUT },
      ]);

      const { run, pageErrors } = await runCollectingPageErrors(page, gesture);

      expect(pageErrors, 'the page throws no error').toEqual([]);
      expect(run.after.text, 'the edited source without its pinned positions').toBe(CARD_LEFT_OPEN_WITHOUT_LAYOUT);
      expect(run.afterUndo.text, 'Undo gives back the source Reset Layout started from').toBe(CARD_LEFT_OPEN);
      expect(run.afterRedo.text, 'Redo removes them again').toBe(CARD_LEFT_OPEN_WITHOUT_LAYOUT);
    });
  });
}

// Stage R0 placed an element into a document without its @startuml frame (a learner may delete the
// first line; the drawing still renders) by framing the document first, and an Undo of the placement
// returned to the framed document; a lifeline added from the palette or the model panel framed it
// after its undo step, so its Undo returned to the document as it was. Duplicate on the selection
// placed the copy of an element without a stored position 20 px right and below where the original
// is drawn (its hit target), while Duplicate from the context menu gave such a copy no position.
// No sealed gesture reaches these paths (every start of the corpus has its frame and its positions);
// plan Task 12 moved them into rewrites, and these cases pin R0's results.
const EDITOR_PAGE = '/SEBook/tools/uml-editor';
const PALETTE_ENUM = { role: 'button', name: 'Add element: Enum' };
const PALETTE_PARTICIPANT = { role: 'button', name: 'Add element: Participant' };
const classBox = (name) => ({ role: 'button', name: `Element ${name} — Enter to select, arrows to nudge, Delete to remove` });
const CLASSES_WITHOUT_A_FRAME = ['class Order @pos(80, 80)', 'class Invoice @pos(80, 300)'].join('\n');
const SEQUENCE_WITHOUT_A_FRAME = ['actor user', 'participant app', 'user -> app : hi'].join('\n');
const CLASSES_WITHOUT_POSITIONS = ['@startuml', 'class Order', 'class Invoice', '@enduml'].join('\n');
const framed = (text) => `@startuml\n${text}\n@enduml`;

function r0Case(id, type, start, steps) {
  return { id, family: R0_CASES_FAMILY, type, page: EDITOR_PAGE, start, steps };
}

/** Where each element of `ids` is drawn: the top left corner of its hit target, in whole pixels. */
async function drawnCorners(page, ids) {
  return page.evaluate((layoutIds) => Object.fromEntries(layoutIds.map((id) => {
    const box = document.querySelector(`.uml-pg-edit-hitbox[data-layout-id="${id}"]`).getBBox();
    return [id, { x: Math.round(box.x), y: Math.round(box.y) }];
  })), ids);
}

if (MODE === 'verify' && (!FAMILY || FAMILY === R0_CASES_FAMILY)) {
  test.describe('Additions to a document without its frame, and copies of elements without a position, as at stage R0', () => {
    test('an enum added with the keyboard to a class diagram without its frame lands in a new frame, and Undo returns to the framed document', async ({ page }) => {
      const gesture = r0Case('enum-added-with-the-keyboard-to-a-class-diagram-without-its-frame', 'class', CLASSES_WITHOUT_A_FRAME, [
        { do: 'press', target: PALETTE_ENUM, key: 'Enter' },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'the framed document with the enum before @enduml')
        .toMatch(/^@startuml\nclass Order @pos\(80, 80\)\nclass Invoice @pos\(80, 300\)\nenum Enum @pos\(\d+, 80\)\n@enduml$/);
      expect(run.afterUndo.text, 'Undo returns to the framed document').toBe(framed(CLASSES_WITHOUT_A_FRAME));
      expect(run.afterRedo.text, 'Redo adds the enum again').toBe(run.after.text);
    });

    test('a participant added with the keyboard to a sequence without its frame lands in a new frame, and Undo returns to the document as it was', async ({ page }) => {
      const gesture = r0Case('participant-added-with-the-keyboard-to-a-sequence-without-its-frame', 'sequence', SEQUENCE_WITHOUT_A_FRAME, [
        { do: 'press', target: PALETTE_PARTICIPANT, key: 'Enter' },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'the framed document with the participant before @enduml')
        .toBe(framed(`${SEQUENCE_WITHOUT_A_FRAME}\nparticipant p: Participant`));
      expect(run.afterUndo.text, 'Undo returns to the document without its frame').toBe(SEQUENCE_WITHOUT_A_FRAME);
      expect(run.afterRedo.text, 'Redo adds the participant again').toBe(run.after.text);
    });

    test('classes without a stored position, duplicated with the keyboard, are placed 20 px right and below where each is drawn', async ({ page }) => {
      const gesture = r0Case('classes-without-positions-duplicated-with-the-keyboard', 'class', CLASSES_WITHOUT_POSITIONS, [
        { do: 'pointerClick', point: { target: classBox('Order') } },
        { do: 'pointerClick', point: { target: classBox('Invoice') }, modifiers: ['ControlOrMeta'] },
        { do: 'press', key: 'ControlOrMeta+d' },
      ]);
      let drawn = null;

      const run = await runGesture(page, gesture, { beforeSteps: async (stepsPage) => { drawn = await drawnCorners(stepsPage, ['Order', 'Invoice']); } });

      const copyAt = (id) => `@pos(${drawn[id].x + 20}, ${drawn[id].y + 20})`;
      expect(run.after.text, 'each copy declared after the originals, 20 px from where its original is drawn')
        .toBe(['@startuml', 'class Order', 'class Invoice', `class Order2 ${copyAt('Order')}`, `class Invoice2 ${copyAt('Invoice')}`, '@enduml'].join('\n'));
      expect(run.after.selection, 'the copies become the selection').toEqual(['Order2', 'Invoice2']);
      expect(run.afterUndo.text, 'Undo removes both copies in one step').toBe(CLASSES_WITHOUT_POSITIONS);
    });

    test('a class without a stored position, duplicated from its context menu, gets no position', async ({ page }) => {
      const gesture = r0Case('class-without-a-position-duplicated-from-its-context-menu', 'class', CLASSES_WITHOUT_POSITIONS, [
        { do: 'pointerClick', point: { target: classBox('Order') }, button: 'right' },
        { do: 'click', target: { role: 'menuitem', name: 'Duplicate' } },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'the copy is declared after the originals, with no position')
        .toBe(['@startuml', 'class Order', 'class Invoice', 'class Order_copy', '@enduml'].join('\n'));
      expect(run.after.selection, 'the copy is selected').toEqual(['Order_copy']);
      expect(run.afterUndo.text, 'Undo removes the copy').toBe(CLASSES_WITHOUT_POSITIONS);
    });
  });
}

// A git graph's Branch and Commit from the palette add the rows of the model panel's buttons. Stage
// R0 framed the document before the row command took its undo step, so an Undo returned to the
// framed document; rows added in quick succession were one undo step under the row command's key;
// and the commit command selected its commit after the drawing, so the commit showed selected only
// from the next drawing on. Task 12 (fix round 1) made these placements element.add operations.
const PALETTE_BRANCH = { role: 'button', name: 'Add element: Branch' };
const PALETTE_COMMIT = { role: 'button', name: 'Add element: Commit' };
const GIT_GRAPH_WITHOUT_A_FRAME = ['branch main:', '  c1 "init"'].join('\n');

if (MODE === 'verify' && (!FAMILY || FAMILY === R0_CASES_FAMILY)) {
  test.describe('Git-graph rows added from the palette to a document without its frame, as at stage R0', () => {
    test('a branch added with the keyboard lands in a new frame, and Undo returns to the framed document', async ({ page }) => {
      const gesture = r0Case('git-graph-branch-added-with-the-keyboard-without-its-frame', 'gitgraph', GIT_GRAPH_WITHOUT_A_FRAME, [
        { do: 'press', target: PALETTE_BRANCH, key: 'Enter' },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'the framed document with a second branch before @enduml')
        .toBe(framed(`${GIT_GRAPH_WITHOUT_A_FRAME}\nbranch branch:`));
      expect(run.after.regions['uml-pg-tool-status'].text, 'the branch is announced').toBe('Added branch "branch".');
      expect(run.afterUndo.text, 'Undo returns to the framed document').toBe(framed(GIT_GRAPH_WITHOUT_A_FRAME));
      expect(run.afterRedo.text, 'Redo adds the branch again').toBe(run.after.text);
    });

    test('a commit added with the keyboard lands on the first branch in a new frame, shows selected from the next drawing on, and Undo returns to the framed document', async ({ page }) => {
      const gesture = r0Case('git-graph-commit-added-with-the-keyboard-without-its-frame', 'gitgraph', GIT_GRAPH_WITHOUT_A_FRAME, [
        { do: 'press', target: PALETTE_COMMIT, key: 'Enter' },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'the framed document with the commit at the end of branch main')
        .toBe(framed(`${GIT_GRAPH_WITHOUT_A_FRAME}\n  C "Commit message"`));
      expect(run.after.selection, 'the commit is not selected by the drawing the addition makes').toEqual([]);
      expect(run.afterUndo.text, 'Undo returns to the framed document').toBe(framed(GIT_GRAPH_WITHOUT_A_FRAME));
      expect(run.afterRedo.selection, 'the next drawings select the commit').toEqual(['C']);
    });

    test('two branches added with the keyboard in quick succession are one undo step back to the framed document', async ({ page }) => {
      const gesture = r0Case('git-graph-two-branches-added-with-the-keyboard-without-its-frame', 'gitgraph', GIT_GRAPH_WITHOUT_A_FRAME, [
        { do: 'press', target: PALETTE_BRANCH, key: 'Enter' },
        { do: 'press', target: PALETTE_BRANCH, key: 'Enter' },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'the framed document with two more branches')
        .toBe(framed(`${GIT_GRAPH_WITHOUT_A_FRAME}\nbranch branch:\nbranch branch2:`));
      expect(run.afterUndo.text, 'one Undo removes both branches').toBe(framed(GIT_GRAPH_WITHOUT_A_FRAME));
    });
  });
}

// Renames, updates, and deletions on paths no sealed gesture reaches, which plan Task 13 moved into
// rewrites. A component's rename read the source as it was before the rename, so a moved port's
// stored place follows its component. The Properties pane's class form rebuilt the declaration from
// the class as the form held it, so a member typed with a visibility sign while its visibility is
// "Unspecified" keeps its bytes through a later edit of the form. Delete announced at once only when
// it removed nothing. And Delete on a selection read each kind of item in the document the removal
// before it left: a message selected with an activation bar names a line of the document without
// the bar's lines, and a fragment selected with a message above it is looked up after the message
// went. Those two are defects of stage R0 (lane R's note for Task 13 reports them), pinned here until
// they are fixed on their own.
const toolStatusIsActive = (page) => page.locator('#uml-pg-tool-status').evaluate((status) => status.classList.contains('is-active'));
const hitboxOf = (id) => ({ css: `.uml-pg-edit-hitbox[data-layout-id="${id}"]` });
const headerOf = (target) => ({ target, at: { x: 0.5, y: 0 }, offset: { x: 0, y: 8 } });
const inProperties = (target) => ({ ...target, within: { css: '#uml-pg-props-pane' } });
const segmentOf = (routeId) => ({ role: 'button', name: `Relation segment 1 of ${routeId} — Enter to select, Delete to remove` });
const hitButton = (namePrefix) => ({ role: 'button', name: `${namePrefix} —`, exact: false });
const COMPONENTS_WITH_MOVED_PORTS = [
  '@layout schema=1 renderer="archuml-visual-editor"', 'node "Frontend.f_out" x=187 y=129', 'node "Backend.b_in" x=294 y=174', '@endlayout',
  'component Frontend @pos(57, 84) {', '  portout "httpOut" as f_out', '}',
  'component Backend @pos(286, 84) {', '  portin "httpIn" as b_in', '  portout "dbOut" as b_dbout', '}',
  'f_out --> b_in : REST'];
const ORDER_WITH_TWO_MEMBERS = ['class Order @pos(80, 80) { -id: int; +total(): float }', 'class Invoice @pos(80, 300)'];
const AN_ACTIVATION = ['actor user', 'participant app',
  'user -> app: login', 'activate app', 'app --> user: token', 'deactivate app', 'user -> app: logout', 'app --> user: bye'];
// `alt` opens on line 4 (`frag:4`); the message above it is line 3.
const A_FRAGMENT = ['actor user', 'participant app',
  'user -> app: login', 'alt [valid]', '  app --> user: token', 'else [invalid]', '  app --> user: error', 'end', 'user -> app: logout'];
const A_GENERALIZATION_TREE = ['abstract class Animal @pos(160, 40)', 'class Dog @pos(40, 240)', 'class Cat @pos(280, 240)', 'Dog --|> Animal', 'Cat --|> Animal'];

if (MODE === 'verify' && (!FAMILY || FAMILY === R0_CASES_FAMILY)) {
  test.describe('Renames, updates, and deletions on paths no sealed gesture reaches, as at stage R0', () => {
    test('a component renamed in Properties takes its moved port\'s stored place along', async ({ page }) => {
      const gesture = r0Case('component-with-a-moved-port-renamed-in-properties', 'component', framed(COMPONENTS_WITH_MOVED_PORTS.join('\n')), [
        { do: 'pointerClick', point: headerOf(hitboxOf('Frontend')) },
        { do: 'fill', target: inProperties({ label: 'Identifier' }), value: 'WebApp' },
        { do: 'press', target: inProperties({ label: 'Identifier' }), key: 'Enter' },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'the port\'s place is stored under the component\'s new identifier').toBe(framed([
        '@layout schema=1 renderer="archuml-visual-editor"', 'node "Backend.b_in" x=294 y=174', 'node "WebApp.f_out" x=187 y=129', '@endlayout',
        'component WebApp @pos(57, 84) {', '  portout "httpOut" as f_out', '}',
        ...COMPONENTS_WITH_MOVED_PORTS.slice(7)].join('\n')));
      expect(run.afterUndo.text, 'Undo gives the component its old identifier back').toBe(gesture.start);
    });

    test('a member typed with a visibility sign under "Unspecified" keeps its bytes when the form deletes another member', async ({ page }) => {
      const firstVisibility = inProperties({ css: '.uml-pg-member-list .uml-pg-member:first-child select.uml-pg-member-vis' });
      const firstMemberText = inProperties({ label: 'Member text (member 1)' });
      const gesture = r0Case('class-member-typed-with-a-sign-then-another-member-deleted-in-properties', 'class', framed(ORDER_WITH_TWO_MEMBERS.join('\n')), [
        { do: 'press', target: classBox('Order'), key: 'Enter' },
        { do: 'select', target: firstVisibility, value: '' },
        { do: 'fill', target: firstMemberText, value: '+bar' },
        { do: 'press', target: firstMemberText, key: 'Enter' },
        { do: 'click', target: inProperties({ role: 'button', name: 'Delete member 2' }) },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'the member keeps "+bar" as typed').toBe(framed(['class Order @pos(80, 80) { +bar }', ORDER_WITH_TWO_MEMBERS[1]].join('\n')));
      expect(run.afterRedo.text, 'Redo deletes the member again').toBe(run.after.text);
    });

    test('a Delete that removes nothing announces what it kept at once', async ({ page }) => {
      const gesture = r0Case('generalization-trunk-deleted-alone', 'class', framed(A_GENERALIZATION_TREE.join('\n')), [
        { do: 'press', target: segmentOf('edge-0'), key: 'Enter' },
        { do: 'press', target: segmentOf('edge-0'), key: 'Delete' },
      ]);
      let atOnce = null;

      const run = await runGesture(page, gesture, { afterSteps: async (stepsPage) => { atOnce = await toolStatusIsActive(stepsPage); } });

      expect(run.after.regions['uml-pg-tool-status'].text).toBe('Kept 1 connection that could not be matched to one line of the source.');
      expect(atOnce, 'the tool status is the active one').toBe(true);
    });

    test('a Delete that removes something announces politely, also what it kept', async ({ page }) => {
      const gesture = r0Case('generalization-trunk-and-a-class-deleted-together', 'class', framed(A_GENERALIZATION_TREE.join('\n')), [
        { do: 'press', target: segmentOf('edge-0'), key: 'Enter' },
        { do: 'pointerClick', point: { target: classBox('Dog') }, modifiers: ['ControlOrMeta'] },
        { do: 'press', key: 'Delete' },
      ]);
      let atOnce = null;

      const run = await runGesture(page, gesture, { afterSteps: async (stepsPage) => { atOnce = await toolStatusIsActive(stepsPage); } });

      expect(run.after.regions['uml-pg-tool-status'].text)
        .toBe('Deleted 1 item. Kept 1 connection that could not be matched to one line of the source.');
      expect(atOnce, 'the tool status is not the active one').toBe(false);
    });

    test('a message deleted with an activation bar names a line of the document without the bar\'s lines', async ({ page }) => {
      const gesture = r0Case('sequence-activation-bar-and-a-later-message-deleted-together', 'sequence', framed(AN_ACTIVATION.join('\n')), [
        { do: 'press', target: hitButton('Activation of app'), key: 'Enter' },
        { do: 'pointerClick', point: { target: hitButton('Relation segment 1 of seqmsg:7') }, modifiers: ['ControlOrMeta'] },
        { do: 'press', key: 'Delete' },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'line 7 of what the bar\'s removal left goes: @enduml, not the selected message')
        .toBe(['@startuml', 'actor user', 'participant app', 'user -> app: login', 'app --> user: token', 'user -> app: logout', 'app --> user: bye'].join('\n'));
      expect(run.after.regions['uml-pg-tool-status'].text).toBe('Deleted 2 items.');
      expect(run.afterUndo.text, 'one Undo gives everything back').toBe(gesture.start);
    });

    test('a fragment deleted with the message above it is looked up after the message went, and stays', async ({ page }) => {
      const gesture = r0Case('sequence-fragment-and-the-message-above-it-deleted-together', 'sequence', framed(A_FRAGMENT.join('\n')), [
        { do: 'pointerClick', point: { target: hitButton('Fragment frag:4') } },
        { do: 'pointerClick', point: { target: hitButton('Relation segment 1 of seqmsg:3') }, modifiers: ['ControlOrMeta'] },
        { do: 'press', key: 'Delete' },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'the message goes and the fragment stays').toBe(framed(A_FRAGMENT.filter((line) => line !== 'user -> app: login').join('\n')));
      expect(run.after.regions['uml-pg-tool-status'].text, 'both are counted').toBe('Deleted 2 items.');
    });
  });
}

// Relations (plan Task 14). Stage R0's relation chooser took no undo step, so the relation it adds
// joins the step before it, and a Redo waiting before it stays.
const CUSTOMERS_AND_ORDERS = ['class Order @pos(80, 80)', 'class Customer @pos(360, 80)', 'class Invoice @pos(80, 300)',
  'Customer "1" -- "*" Order : places'];

if (MODE === 'verify' && (!FAMILY || FAMILY === R0_CASES_FAMILY)) {
  test.describe('Relations on paths no sealed gesture reaches, as at stage R0', () => {
    test('a relation chosen after an Undo takes no undo step of its own, and the Redo stays', async ({ page }) => {
      const gesture = r0Case('relation-chosen-after-an-undo-keeps-the-redo', 'class', framed(CUSTOMERS_AND_ORDERS.join('\n')), [
        { do: 'press', target: classBox('Invoice'), key: 'ArrowRight' },
        { do: 'click', target: { role: 'button', name: 'Undo', exact: false } },
        { do: 'pointerMove', point: { target: classBox('Order') } },
        { do: 'drag', from: { target: { role: 'button', name: 'Extend a relation from Order' } }, to: { target: classBox('Invoice') } },
        { do: 'click', target: { role: 'menuitem', name: 'Dependency' } },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'the dependency is added').toBe(framed([...CUSTOMERS_AND_ORDERS, 'Order ..> Invoice'].join('\n')));
      expect(run.afterUndo.text, 'Undo finds no step of the dependency\'s own').toBe(run.after.text);
      expect(run.afterRedo.text, 'Redo brings back the undone move, without the dependency')
        .toMatch(/^@startuml\nclass Order @pos\(\d+, \d+\)\nclass Customer @pos\(\d+, \d+\)\nclass Invoice @pos\(\d+, \d+\)\nCustomer "1" -- "\*" Order : places\n@enduml$/);
      expect(run.afterRedo.text, 'the move changed a position').not.toBe(gesture.start);
    });
  });
}

// The sequence family (plan Task 15). A message moved from Properties keeps one undo key, so two
// moves in a row are one undo step; an activation bar moved with the keyboard or added by a click of
// the Activate tool on a lifeline head; and a fragment moved one step from Properties, which swaps it
// with its next sibling and leaves a blank line between them where it was.
const THREE_MESSAGES = ['actor user', 'participant app', 'participant db',
  'user -> app: login', 'app -> db: query', 'db --> app: rows', 'app --> user: ok'];
const A_FRAGMENT_BEFORE_A_BLANK_LINE = ['actor user', 'participant app',
  'user -> app: login', 'alt [valid]', '  app --> user: token', 'end', '', 'user -> app: logout'];
// The layout ids marked selected, each once (a bar is marked on its rectangle and on its two handles).
const selectedIds = (observation) => [...new Set(observation.selection)];

if (MODE === 'verify' && (!FAMILY || FAMILY === R0_CASES_FAMILY)) {
  test.describe('The sequence family on paths no sealed gesture reaches, as at stage R0', () => {
    test('a message moved later twice from Properties is one undo step', async ({ page }) => {
      const gesture = r0Case('sequence-message-moved-later-twice-in-properties', 'sequence', framed(THREE_MESSAGES.join('\n')), [
        { do: 'pointerClick', point: { target: hitButton('Relation segment 1 of seqmsg:4') } },
        { do: 'click', target: inProperties({ role: 'button', name: 'Move later' }) },
        { do: 'click', target: inProperties({ role: 'button', name: 'Move later' }) },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'the message is now third').toBe(framed([...THREE_MESSAGES.slice(0, 3),
        'app -> db: query', 'db --> app: rows', 'user -> app: login', 'app --> user: ok'].join('\n')));
      expect(selectedIds(run.after), 'the moved message stays selected').toEqual(['seqmsg:6']);
      expect(run.afterUndo.text, 'one Undo takes back both moves').toBe(gesture.start);
    });

    test('an activation bar whose end is moved later with Shift+ArrowDown says so and stays selected', async ({ page }) => {
      const gesture = r0Case('sequence-activation-bar-end-moved-later-with-the-keyboard', 'sequence', framed(AN_ACTIVATION.join('\n')), [
        { do: 'press', target: hitButton('Activation of app'), key: 'Shift+ArrowDown' },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'the deactivate goes below the next message').toBe(framed([...AN_ACTIVATION.slice(0, 5),
        'user -> app: logout', 'deactivate app', 'app --> user: bye'].join('\n')));
      expect(run.after.regions['uml-pg-tool-status'].text).toBe('Activation of "app" now stops later.');
      expect(selectedIds(run.after)).toEqual(['actbar:4']);
    });

    test('the Activate tool clicked on a lifeline head adds a bar around the lifeline\'s first message', async ({ page }) => {
      const gesture = r0Case('sequence-activation-bar-added-by-clicking-a-lifeline-head', 'sequence', framed(THREE_MESSAGES.join('\n')), [
        { do: 'click', target: { role: 'button', name: 'Add element: Activate' } },
        { do: 'pointerClick', point: { target: hitButton('Element app') } },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text).toBe(framed([...THREE_MESSAGES.slice(0, 3),
        'activate app', 'user -> app: login', 'deactivate app', ...THREE_MESSAGES.slice(4)].join('\n')));
      expect(run.after.regions['uml-pg-tool-status'].text)
        .toBe('Added activation for "app". Drag its top or bottom edge to change when it starts and stops.');
      expect(selectedIds(run.after)).toEqual(['actbar:4']);
    });

    test('a fragment moved later from Properties swaps with the next message and leaves the blank line after itself', async ({ page }) => {
      const gesture = r0Case('sequence-fragment-moved-later-past-a-blank-line-in-properties', 'sequence', framed(A_FRAGMENT_BEFORE_A_BLANK_LINE.join('\n')), [
        { do: 'pointerClick', point: { target: hitButton('Fragment frag:4') } },
        { do: 'click', target: inProperties({ role: 'button', name: 'Move later' }) },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text).toBe(framed([...A_FRAGMENT_BEFORE_A_BLANK_LINE.slice(0, 3), 'user -> app: logout',
        ...A_FRAGMENT_BEFORE_A_BLANK_LINE.slice(3, 7)].join('\n')));
      expect(run.after.regions['uml-pg-tool-status'].text).toBe('Moved fragment later.');
      expect(selectedIds(run.after)).toEqual(['frag:5']);
    });
  });
}

// The raw-source family (plan Task 16) on paths no sealed gesture reaches: a lifeline's display
// label changed in the sequence model panel, which rebuilds its line and keeps its identifier (the
// sealed gesture changes the identifier); and a quick-insert button of a lifeline's Properties on a
// document without its @startuml frame, which added its line at the end of the document as it was.
const MODEL_PANEL = { role: 'region', name: 'Diagram model editor' };
const OPEN_MODEL_ROWS = { do: 'click', target: { text: 'Advanced sequence rows', exact: false, within: MODEL_PANEL } };
const APP_LABEL_FIELD = { role: 'textbox', name: 'Lifeline 2 display label', within: MODEL_PANEL };

if (MODE === 'verify' && (!FAMILY || FAMILY === R0_CASES_FAMILY)) {
  test.describe('The raw-source family on paths no sealed gesture reaches, as at stage R0', () => {
    test('a lifeline\'s display label changed in the model panel rebuilds its line, keeps its identifier, and is one undo step', async ({ page }) => {
      const gesture = r0Case('sequence-lifeline-label-changed-in-the-model-panel', 'sequence', framed(THREE_MESSAGES.join('\n')), [
        OPEN_MODEL_ROWS,
        { do: 'fill', target: APP_LABEL_FIELD, value: 'App server' },
        { do: 'press', target: APP_LABEL_FIELD, key: 'Tab' },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'only the lifeline\'s line changes').toBe(framed([THREE_MESSAGES[0], 'participant app: App server',
        ...THREE_MESSAGES.slice(2)].join('\n')));
      expect(run.afterUndo.text, 'one Undo returns to the start').toBe(gesture.start);
      expect(run.afterRedo.text, 'Redo changes the label again').toBe(run.after.text);
    });

    test('a quick-insert button on a document without its frame adds its line at the end and leaves the document unframed', async ({ page }) => {
      const gesture = r0Case('sequence-activate-inserted-into-a-document-without-its-frame', 'sequence', SEQUENCE_WITHOUT_A_FRAME, [
        { do: 'pointerClick', point: { target: hitButton('Element app') } },
        { do: 'click', target: inProperties({ role: 'button', name: 'Add an activate app bar' }) },
      ]);

      const run = await runGesture(page, gesture);

      expect(run.after.text, 'the line follows the last line, with no frame added').toBe(`${SEQUENCE_WITHOUT_A_FRAME}\nactivate app`);
      expect(run.after.regions['uml-pg-tool-status'].text, 'the insertion is announced').toBe('Inserted: activate app');
      expect(run.afterUndo.text, 'Undo returns to the document as it was').toBe(SEQUENCE_WITHOUT_A_FRAME);
    });
  });
}

if (MODE === 'verify' || MODE === 'log-operations') {
  test.describe(LOG_TEST, () => {
    for (const gesture of loggedGestures) {
      test(`${gesture.family} › ${gesture.id}`, async ({ page, browser, browserName }) => {
        const fixture = fixtures.readFixture(gesture);
        expect(fixture, `no fixture: ${path.relative(process.cwd(), fixtures.fixturePathOf(gesture))}`).not.toBeNull();
        skipOffItsPlatform(fixture, browserName, browser);
        const sites = operationLog.convertedOperationSites(writeSiteMap, gesture.id);

        const { run, entries } = await runLoggingOperations(page, gesture);

        expect(operationLog.operationLogProblems(entries, sites), 'each write is one operation of a converted site, with its revision and scene facts').toEqual([]);
        if (MODE === 'log-operations') {
          expect(differenceOfRun(fixture, gesture, run), 'the gesture matches its fixture before its operations are stored').toBeNull();
          operationLog.writeOperations(gesture, entries);
        } else {
          expect(operationLog.recordedLogDifference(fixture, entries), 'the operations match the ones its fixture records').toBeNull();
        }
      });
    }
  });
}
