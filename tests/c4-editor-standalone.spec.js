// @ts-check
// The SEBook host adapter for the C4 editor (spec §3.4, §10): the standalone page's browser draft, the
// "Open in the C4 editor" fragment handoff from a chapter figure, downloads, and the storage, shortcut, and
// navigation inventories that list what the editor adds to the site.
//
// These tests run against the built site. The YAML source editor is a labelled textarea that Monaco replaces once
// it loads; the tests block Monaco so they type into the textarea, the path every reader also gets when Monaco
// cannot load. The draft's key and record shape ({version: 1, text, savedAt, view} under c4-editor-draft) are part
// of the contract published on /cookies/, so the tests read and seed localStorage directly.
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const fs = require('node:fs');
const path = require('node:path');

const EDITOR_PATH = '/SEBook/tools/c4-editor';
const CHAPTER_PATH = '/SEBook/architecture/c4';
const DRAFT_KEY = 'c4-editor-draft';
const COURSE_REGISTRATION = fs.readFileSync(path.join(__dirname, '../_includes/c4-models/course-registration.yml'), 'utf8');
// A draft that differs from every example, so a test can tell which text the editor shows.
const DRAFT_MODEL = 'schema: c4-design/1\nname: Draft design\npeople:\n  reader:\n    name: Reader\n';
const LINK_MODEL = 'schema: c4-design/1\nname: Linked design\nsystems:\n  library:\n    name: Library\n';
// Long enough for the YAML tab's debounce (250 ms) and the draft's (400 ms) together.
const PAST_THE_DEBOUNCE_MS = 2000;
// The worked example with its software system renamed: an edit whose effect the drawing shows in every view.
const RENAMED_SYSTEM = COURSE_REGISTRATION.replace(/^(\s+name: )Course Registration$/m, '$1Course Planner');

/** Keeps the textarea source editor: Monaco's files never arrive. */
async function withoutMonaco(context) {
  await context.route('**/vendor/monaco-editor/**', (route) => route.abort());
}

function draftRecord(text, view = null) {
  return JSON.stringify({ version: 1, text, savedAt: '2026-11-08T14:05:00.000Z', view });
}

/** The page's localStorage holds `record` before any page script runs (only on the first load of the test). */
async function seedDraft(page, record) {
  await page.addInitScript(([key, value]) => {
    if (sessionStorage.getItem('c4-test-seeded')) return;
    sessionStorage.setItem('c4-test-seeded', '1');
    localStorage.setItem(key, value);
  }, [DRAFT_KEY, record]);
}

function readDraft(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }, DRAFT_KEY);
}

function base64Url(text) {
  return Buffer.from(text, 'utf8').toString('base64url');
}

function fromBase64Url(text) {
  return Buffer.from(text, 'base64url').toString('utf8');
}

function canvas(page) {
  return page.getByRole('region', { name: /^Canvas/ });
}

/** The page's notice about the draft (the editor has status regions of its own). */
function notice(page, text) {
  return page.getByRole('status').filter({ hasText: text });
}

/** Opens the YAML tab and returns its source field. */
async function yamlSource(page) {
  await page.getByRole('tab', { name: 'YAML' }).click();
  const field = page.getByRole('textbox', { name: 'YAML source' });
  await expect(field).toBeVisible();
  return field;
}

/** Replaces the model through the YAML tab, as a reader typing would, and lets the debounces run out. */
async function typeModel(page, text) {
  const field = await yamlSource(page);
  await field.fill(text);
  await page.clock.runFor(PAST_THE_DEBOUNCE_MS);
  return field;
}

async function openEditor(page, hash = '') {
  await page.clock.install();
  await page.goto(EDITOR_PATH + hash);
  await expect(canvas(page)).toBeVisible();
}

test.describe('C4 editor page', () => {
  test.beforeEach(async ({ context }) => {
    await withoutMonaco(context);
  });

  test('the draft is written only after an edit and restored after reload', async ({ page }) => {
    await openEditor(page);
    await expect(canvas(page)).toHaveAccessibleName(/Course Registration/);
    // Opening the page and changing the view are not edits.
    await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Containers' }).click();
    await page.clock.runFor(PAST_THE_DEBOUNCE_MS);
    expect(await readDraft(page)).toBeNull();

    await typeModel(page, DRAFT_MODEL);

    const draft = await readDraft(page);
    expect(draft).toMatchObject({ version: 1, text: DRAFT_MODEL });
    expect(Number.isNaN(Date.parse(draft.savedAt))).toBe(false);

    await page.reload();
    await expect(notice(page, 'Restored your draft')).toBeVisible();
    await a11yCheckpoint(page, 'c4-editor-draft-restored', { feature: 'c4-editor' });
    await expect(await yamlSource(page)).toHaveValue(DRAFT_MODEL);
  });

  test('an existing draft prompts Replace draft, Keep draft, Download draft first', async ({ page }) => {
    await seedDraft(page, draftRecord(DRAFT_MODEL));
    await openEditor(page, `#c4=${base64Url(LINK_MODEL)}`);

    const prompt = page.getByRole('region', { name: 'You also have a saved draft' });
    await expect(prompt).toBeVisible();
    await expect(prompt.getByRole('button')).toHaveText(['Replace draft', 'Keep draft', 'Download draft first']);
    await a11yCheckpoint(page, 'c4-editor-draft-choice', { feature: 'c4-editor' });
    // The link's model is shown, and nothing overwrites the draft while the choice is open, edits included.
    const field = await typeModel(page, `${LINK_MODEL}description: edited before choosing\n`);
    await expect(field).toHaveValue(/Linked design/);
    expect(await readDraft(page)).toMatchObject({ text: DRAFT_MODEL });
    // The address no longer carries the model, so a reload restores the draft instead of asking again.
    expect(new URL(page.url()).hash).toBe('');
  });

  test('Keep draft shows the draft and leaves it stored', async ({ page }) => {
    await seedDraft(page, draftRecord(DRAFT_MODEL));
    await openEditor(page, `#c4=${base64Url(LINK_MODEL)}`);

    await page.getByRole('button', { name: 'Keep draft' }).click();

    await expect(page.getByRole('region', { name: 'You also have a saved draft' })).toBeHidden();
    await expect(await yamlSource(page)).toHaveValue(DRAFT_MODEL);
    expect(await readDraft(page)).toMatchObject({ text: DRAFT_MODEL });
  });

  test('Replace draft stores the model from the link', async ({ page }) => {
    await seedDraft(page, draftRecord(DRAFT_MODEL));
    await openEditor(page, `#c4=${base64Url(LINK_MODEL)}`);

    await page.getByRole('button', { name: 'Replace draft' }).click();

    await expect(notice(page, 'The model from the link replaced your draft.')).toBeVisible();
    expect(await readDraft(page)).toMatchObject({ text: LINK_MODEL });
  });

  test('Download draft first saves the old draft as a file, then replaces it', async ({ page }) => {
    await seedDraft(page, draftRecord(DRAFT_MODEL));
    await openEditor(page, `#c4=${base64Url(LINK_MODEL)}`);

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download draft first' }).click();
    const download = await downloading;

    expect(fs.readFileSync(await download.path(), 'utf8')).toBe(DRAFT_MODEL);
    expect(download.suggestedFilename()).toMatch(/\.ya?ml$/);
    expect(await readDraft(page)).toMatchObject({ text: LINK_MODEL });
  });

  test('a link whose model equals the draft opens without asking', async ({ page }) => {
    await seedDraft(page, draftRecord(LINK_MODEL));
    await openEditor(page, `#c4=${base64Url(LINK_MODEL)}`);

    await expect(await yamlSource(page)).toHaveValue(LINK_MODEL);
    await expect(page.getByRole('region', { name: 'You also have a saved draft' })).toBeHidden();
  });

  test('storage failure shows a message and editing continues', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = function setItem() {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      };
    });
    await openEditor(page);

    await typeModel(page, RENAMED_SYSTEM);

    await expect(notice(page, 'could not be saved')).toBeVisible();
    await a11yCheckpoint(page, 'c4-editor-storage-failed', { feature: 'c4-editor' });
    // The editor still takes edits after the failed save: a second rename reaches the drawing.
    await typeModel(page, RENAMED_SYSTEM.replace('Course Planner', 'Course Scheduler'));
    await expect(canvas(page)).toHaveAccessibleName(/Course Scheduler/);
  });

  test('blocked storage says so when the page opens, and the editor still works', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() { throw new DOMException('Storage is blocked.', 'SecurityError'); },
      });
    });
    await openEditor(page);

    await expect(notice(page, 'does not let the page keep a draft')).toBeVisible();
    await typeModel(page, RENAMED_SYSTEM);
    await expect(canvas(page)).toHaveAccessibleName(/Course Planner/);
  });

  test('Download YAML produces the current text', async ({ page }) => {
    await openEditor(page);
    await typeModel(page, RENAMED_SYSTEM);

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download YAML' }).click();
    const download = await downloading;

    expect(download.suggestedFilename()).toBe('design.yml');
    expect(fs.readFileSync(await download.path(), 'utf8')).toBe(RENAMED_SYSTEM);
  });

  test('loading an example over unsaved work asks first, and Cancel keeps the work', async ({ page }) => {
    await openEditor(page);
    await typeModel(page, DRAFT_MODEL);

    await page.getByLabel('Example').selectOption({ label: 'Blank model' });
    await page.getByRole('button', { name: 'Load example' }).click();
    const dialog = page.getByRole('dialog', { name: 'Load the example?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Keep my model' }).click();
    await expect(await yamlSource(page)).toHaveValue(DRAFT_MODEL);

    await page.getByRole('button', { name: 'Load example' }).click();
    await page.getByRole('dialog', { name: 'Load the example?' }).getByRole('button', { name: 'Load example' }).click();
    await expect(await yamlSource(page)).toHaveValue(/name: My design/);
  });

  test('a draft saved in another tab is announced in this one', async ({ page, context }) => {
    await openEditor(page);
    const other = await context.newPage();
    await other.clock.install();
    await other.goto(EDITOR_PATH);
    await expect(canvas(other)).toBeVisible();

    await typeModel(other, DRAFT_MODEL);

    await expect(notice(page, 'Another tab saved a newer C4 editor draft')).toBeVisible();
    await page.getByRole('button', { name: 'Open the newer draft' }).click();
    await expect(await yamlSource(page)).toHaveValue(DRAFT_MODEL);
  });

  test('the newer-draft notice asks over unsaved work: Cancel keeps it and the action stays usable', async ({ page, context }) => {
    await openEditor(page);
    await typeModel(page, DRAFT_MODEL);
    const other = await context.newPage();
    await other.clock.install();
    await other.goto(EDITOR_PATH);
    await expect(canvas(other)).toBeVisible();
    await typeModel(other, LINK_MODEL);

    const openNewer = notice(page, 'Another tab saved a newer C4 editor draft').getByRole('button', { name: 'Open the newer draft' });
    const dialog = page.getByRole('dialog', { name: 'Open the newer draft?' });
    await openNewer.click();
    await dialog.getByRole('button', { name: 'Keep this tab\'s model' }).click();
    await expect(dialog).toBeHidden();
    await expect(openNewer).toBeFocused();
    await expect(await yamlSource(page)).toHaveValue(DRAFT_MODEL);

    await openNewer.click();
    await dialog.getByRole('button', { name: 'Open the newer draft' }).click();
    // The notice loses its button, so focus moves to a control that stays instead of falling to the page.
    await expect(page.getByLabel('Example')).toBeFocused();
    await expect(await yamlSource(page)).toHaveValue(LINK_MODEL);
  });

  test('deleting all site storage in another tab is announced in this one', async ({ page, context }) => {
    await seedDraft(page, draftRecord(DRAFT_MODEL));
    await openEditor(page);
    const other = await context.newPage();
    await other.goto('/cookies/');

    // "Delete everything" on the storage page clears the whole store, which reports no key.
    await other.evaluate(() => localStorage.clear());

    await expect(notice(page, 'The saved draft was deleted in another tab')).toBeVisible();
  });

  test('Keep draft over edits to the linked model asks first, and Cancel keeps the edits', async ({ page }) => {
    await seedDraft(page, draftRecord(DRAFT_MODEL));
    await openEditor(page, `#c4=${base64Url(LINK_MODEL)}`);
    const edited = `${LINK_MODEL}description: edited before choosing\n`;
    await typeModel(page, edited);

    await page.getByRole('button', { name: 'Keep draft' }).click();
    const dialog = page.getByRole('dialog', { name: 'Keep your draft?' });
    await dialog.getByRole('button', { name: 'Go back' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('region', { name: 'You also have a saved draft' })).toBeVisible();
    await expect(await yamlSource(page)).toHaveValue(edited);
    expect(await readDraft(page)).toMatchObject({ text: DRAFT_MODEL });

    await page.getByRole('button', { name: 'Keep draft' }).click();
    await dialog.getByRole('button', { name: 'Keep draft' }).click();
    await expect(await yamlSource(page)).toHaveValue(DRAFT_MODEL);
  });

  test('an editor that cannot start leaves the figure and YAML, and no page controls', async ({ page }) => {
    // The editor script loads, but its mount fails.
    await page.addInitScript(() => {
      let editorApi;
      Object.defineProperty(window, 'ArchUMLC4Editor', {
        configurable: true,
        get: () => editorApi,
        set(value) {
          editorApi = Object.assign({}, value, { mount() { throw new Error('test: the editor cannot start'); } });
        },
      });
    });
    await page.goto(EDITOR_PATH);

    await expect(page.getByRole('alert').filter({ hasText: 'The C4 editor could not start' })).toBeVisible();
    await expect(page.getByText('YAML source', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Example')).toBeHidden();
    await expect(page.getByLabel('Profile', { exact: true })).toBeHidden();
  });

  test('switching the profile keeps the model', async ({ page }) => {
    await openEditor(page);
    await typeModel(page, DRAFT_MODEL);

    await page.getByLabel('Profile', { exact: true }).selectOption('expert');

    await expect(notice(page, 'Switched to the expert profile.')).toBeVisible();
    await expect(await yamlSource(page)).toHaveValue(DRAFT_MODEL);
  });
});

// The site host keeps the editor's own undo history (spec §3.4): undo keys typed in the YAML source editor go to
// the editor, and the source editor keeps no history of the editor's writes. These tests use the host's source
// editor directly, the way the YAML tab does, with an undo and a redo that record their calls.
test.describe('The YAML source editor of the site host', () => {
  const PROBE_LABEL = 'Probe YAML';

  /** Creates a source editor holding `value` in a new region of the editor page, with recording undo and redo. */
  async function createProbe(page, value) {
    await page.evaluate(([text, label]) => {
      window.historyCalls = [];
      const container = document.createElement('div');
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', 'Probe');
      document.querySelector('main').prepend(container);
      window.probeEditor = window.SebookC4EditorSite.createSourceEditor(container, {
        value: text,
        label,
        language: 'yaml',
        undo: () => window.historyCalls.push('undo'),
        redo: () => window.historyCalls.push('redo'),
      });
    }, [value, PROBE_LABEL]);
  }

  function historyCalls(page) {
    return page.evaluate(() => window.historyCalls);
  }

  test('undo and redo keys in the textarea go to the editor, not to the field\'s own history', async ({ page, context }) => {
    await withoutMonaco(context);
    await page.goto(EDITOR_PATH);
    await createProbe(page, 'name: Probe\n');
    const field = page.getByRole('textbox', { name: PROBE_LABEL });
    await field.click();
    await field.press('End');
    await field.pressSequentially('x');

    await field.press('ControlOrMeta+z');
    await field.press('ControlOrMeta+Shift+z');
    await field.press('Control+y');

    expect(await historyCalls(page)).toEqual(['undo', 'redo', 'redo']);
    await expect(field).toHaveValue(/x/);
  });

  test('in Monaco, undo keys go to the editor and the editor\'s writes are not on Monaco\'s undo stack', async ({ page }) => {
    await page.goto(EDITOR_PATH);
    await createProbe(page, 'name: Probe\n');
    const monacoField = page.getByRole('textbox', { name: `${PROBE_LABEL}. Press Escape to leave the editor.` });
    await expect(monacoField).toBeAttached();

    // A write from the editor (a canvas or form edit reaching the YAML tab).
    await page.evaluate(() => window.probeEditor.applyEdits([{ offset: 0, length: 0, text: '# edited\n' }]));
    await page.evaluate(() => window.probeEditor.focus());
    await monacoField.press('ControlOrMeta+z');

    expect(await historyCalls(page)).toEqual(['undo']);
    expect(await page.evaluate(() => window.probeEditor.getValue())).toBe('# edited\nname: Probe\n');
    // Monaco's own Undo command (its command palette runs it too) has nothing of the editor's to take back.
    await page.evaluate(() => window.monaco.editor.getEditors().forEach((editor) => editor.trigger('test', 'undo', null)));
    expect(await page.evaluate(() => window.probeEditor.getValue())).toBe('# edited\nname: Probe\n');
  });
});

// Ruling 11: one history. The YAML tab hands its source editor an undo and a redo that first apply typing still waiting
// for the tab's sync and then step the editor's history (the sourceOptions contract the integration step wires into
// c4-editor-panels.js). This drives the real state controller through that contract, so typing in the YAML tab and a
// form edit come back off one stack, in order, whether the reader types into the textarea or into Monaco.
test.describe('One undo history for the YAML tab and the forms', () => {
  const PROBE_LABEL = 'History YAML';
  const MODEL = 'schema: c4-design/1\nname: History\nsystems:\n  library:\n    name: Library\n';
  const TYPED = `${MODEL}# typed\n`;
  const TYPED_AND_RENAMED = TYPED.replace('name: Library', 'name: Archive');

  /** Mounts the source editor over a real editor state, wired the way the YAML tab wires it. */
  async function createHistoryProbe(page, text) {
    await page.evaluate(([value, label]) => {
      const { createEditorState } = window.ArchUMLC4EditorParts.state;
      let now = 0;
      const state = createEditorState({ text: value, host: { undo: 'editor', onTextChange() {} }, now: () => now });
      const container = document.createElement('div');
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', 'History probe');
      document.querySelector('main').prepend(container);
      let pending = null;
      let handle = null;
      const sync = () => {
        clearTimeout(pending);
        pending = null;
        state.applySourceText(handle.getValue());
      };
      handle = window.SebookC4EditorSite.createSourceEditor(container, {
        value: value, label, language: 'yaml',
        undo: () => { sync(); state.undo(); },
        redo: () => { sync(); state.redo(); },
      });
      handle.onDidChange(() => {
        clearTimeout(pending);
        pending = setTimeout(sync, 250);
      });
      state.on('text', (next, info) => { if (info.reason !== 'source') handle.setValue(next); });
      window.historyProbe = {
        state,
        handle,
        // Later edits are steps of their own: the history joins edits made within 600 ms of each other.
        later: () => { now += 10000; },
      };
    }, [text, PROBE_LABEL]);
  }

  const stateText = (page) => page.evaluate(() => window.historyProbe.state.getText());
  const shownText = (page) => page.evaluate(() => window.historyProbe.handle.getValue());

  for (const surface of ['textarea', 'Monaco']) {
    test(`typing in the YAML tab (${surface}) and a form edit are undone in order, with no second history`, async ({ page, context }) => {
      if (surface === 'textarea') await withoutMonaco(context);
      await page.goto(EDITOR_PATH);
      await createHistoryProbe(page, MODEL);
      const field = surface === 'textarea'
        ? page.getByRole('textbox', { name: PROBE_LABEL })
        : page.getByRole('textbox', { name: `${PROBE_LABEL}. Press Escape to leave the editor.` });
      await expect(field).toBeAttached();

      // Typing in the YAML tab reaches the editor once the tab's sync runs.
      await page.evaluate(() => {
        // The caret after the last line (line 6, column 1), through the handle's own revealRange.
        window.historyProbe.handle.revealRange({ start: { line: 6, col: 1 } });
        window.historyProbe.handle.focus();
      });
      await field.pressSequentially('# typed\n');
      await expect.poll(() => stateText(page)).toBe(TYPED);

      // A form edit (the inspector's Name field dispatches this command) reaches the YAML tab.
      await page.evaluate(() => {
        window.historyProbe.later();
        window.historyProbe.state.dispatch({ op: 'setElementField', elementId: 'library', field: 'name', value: 'Archive' });
      });
      await expect.poll(() => shownText(page)).toBe(TYPED_AND_RENAMED);

      await field.focus();
      await field.press('ControlOrMeta+z');
      expect(await shownText(page)).toBe(TYPED);
      await field.press('ControlOrMeta+z');
      expect(await shownText(page)).toBe(MODEL);
      // Nothing is left: no textarea or Monaco history of its own takes the text anywhere else.
      await field.press('ControlOrMeta+z');
      expect(await shownText(page)).toBe(MODEL);
      expect(await stateText(page)).toBe(MODEL);

      await field.press('ControlOrMeta+Shift+z');
      expect(await shownText(page)).toBe(TYPED);
      await field.press('Control+y');
      expect(await shownText(page)).toBe(TYPED_AND_RENAMED);

      if (surface === 'Monaco') {
        // Monaco's own Undo command (reached without the keys) steps the same history.
        await page.evaluate(() => {
          const probe = document.querySelector('[aria-label="History probe"]');
          window.monaco.editor.getEditors().find((editor) => probe.contains(editor.getDomNode())).trigger('test', 'undo', null);
        });
        expect(await shownText(page)).toBe(TYPED);
        expect(await stateText(page)).toBe(TYPED);
      }
    });
  }
});

test.describe('Open in the C4 editor', () => {
  test('Open in the C4 editor carries the figure\'s model in the fragment and opens it', async ({ page, context }) => {
    await withoutMonaco(context);
    await page.goto(CHAPTER_PATH);
    const figure = page.getByRole('figure', { name: /The same system as a C4 container view/ });
    const link = figure.getByRole('link', { name: 'Open in the C4 editor (opens a new tab)' });

    const href = new URL(await link.getAttribute('href'), page.url());
    expect(href.pathname).toBe(EDITOR_PATH);
    const fragment = new URLSearchParams(href.hash.slice(1));
    expect(fromBase64Url(fragment.get('c4')).trim()).toBe(COURSE_REGISTRATION.trim());
    expect(fragment.get('view')).toBe('containers of registration');
    await expect(link).toHaveAttribute('target', '_blank');

    const opening = context.waitForEvent('page');
    await link.click();
    const editorPage = await opening;
    await expect(canvas(editorPage)).toHaveAccessibleName('Canvas: Container view: Course Registration');
    await expect(await yamlSource(editorPage)).toHaveValue(/name: Course Registration/);
    expect(new URL(editorPage.url()).hash).toBe('');
    // Opening a link stores nothing.
    expect(await readDraft(editorPage)).toBeNull();
  });

  // The editor shows a flawed figure's faults in its Problems panel and an interface card whole, so a figure whose
  // page asks the reader to find, predict, or choose something keeps its answer: no link under it.
  test('figures that withhold an answer have no editor link', async ({ page }) => {
    await page.goto(CHAPTER_PATH);
    const linkIn = (scope) => scope.getByRole('link', { name: 'Open in the C4 editor (opens a new tab)', includeHidden: true });
    const syntaxOnlyCard = page.getByRole('figure', { name: /Syntactic view of the Enrollment API/ });
    const flawedView = page.getByRole('figure', { name: /First teammate's container view of Course Registration/ });
    await expect(syntaxOnlyCard).toHaveCount(1);
    await expect(flawedView).toHaveCount(1);
    await expect(linkIn(syntaxOnlyCard), 'the syntax-only card withholds the semantic view').toHaveCount(0);
    await expect(linkIn(flawedView), 'a find-the-flaw figure withholds its faults').toHaveCount(0);

    const quiz = page.getByRole('region', { name: /quiz$/ });
    await expect(quiz.locator('svg').first(), 'the quiz draws its C4 figures').toBeAttached();
    await expect(linkIn(quiz), 'quiz figures withhold the keyed answers').toHaveCount(0);
    await expect(linkIn(page.getByRole('figure', { name: /The same system as a C4 container view/ })), 'other figures keep the link').toHaveCount(1);
  });
});

// The link script runs on every SEBook page, and so do its styles: the UML reference does not embed the editor, so
// it loads none of the editor's stylesheets. Print has no editor to open, so no page prints the link.
test.describe('Open in the C4 editor on a page without the editor', () => {
  test('the links under the reference page\'s figures are not printed', async ({ page }) => {
    await page.goto('/SEBook/tools/uml-reference.html#c4-model-diagrams');
    const links = page.getByRole('link', { name: 'Open in the C4 editor (opens a new tab)' });
    await expect.poll(() => links.count(), 'the reference page links its C4 figures').toBeGreaterThan(1);
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('link', { name: 'Open in the C4 editor (opens a new tab)' }), 'print shows no link').toHaveCount(0);
  });
});

// The combined book (/SEBook/all.html) renders the editor page inside itself, next to the C4 chapter's own editor
// embeds. Every one of them is an in-memory embed: only /SEBook/tools/c4-editor owns the c4-editor-draft entry that
// /cookies/ lists.
test.describe('The C4 editor in the combined book', () => {
  test('keeps edits in memory: no draft, no example or profile controls', async ({ page, context }) => {
    test.slow(); // The combined book is every chapter on one page.
    await withoutMonaco(context);
    await page.clock.install();
    await page.goto('/SEBook/all.html');
    const embeds = page.locator('[data-c4-editor]');
    await expect(embeds.first().getByRole('region', { name: /^Canvas/ })).toBeVisible();
    const embedCount = await embeds.count();
    for (let index = 0; index < embedCount; index += 1) {
      const each = embeds.nth(index);
      await expect(each.getByLabel('Example', { exact: true }), `embed ${index + 1} has no example chooser`).toHaveCount(0);
      await expect(each.getByLabel('Profile', { exact: true }), `embed ${index + 1} has no profile switch`).toHaveCount(0);
    }
    await expect(page.getByRole('heading', { name: 'Your work stays in this browser' })).toHaveCount(0);

    const embed = embeds.first();

    await embed.getByRole('tab', { name: 'YAML' }).click();
    const field = embed.getByRole('textbox', { name: 'YAML source' });
    await field.fill(DRAFT_MODEL);
    await page.clock.runFor(PAST_THE_DEBOUNCE_MS);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));

    expect(await readDraft(page)).toBeNull();
    await expect(field).toHaveValue(DRAFT_MODEL);
  });
});

test.describe('Site inventories', () => {
  test('the cookies inventory lists c4-editor-draft', async ({ page }) => {
    await page.goto('/cookies/');
    const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'c4-editor-draft', exact: true }) });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('{version: 1, text, savedAt, view}');
    await expect(row).toContainText('tabs');
    await expect(page.getByRole('button', { name: 'Delete the C4 editor draft' })).toBeVisible();
    await a11yCheckpoint(page, 'cookies-c4-editor-draft', { feature: 'c4-editor' });
  });

  test('shortcuts page lists the C4 editor keys', async ({ page }) => {
    await page.goto('/shortcuts/');
    await expect(page.getByRole('navigation', { name: 'Sections on this page' }).getByRole('link', { name: 'C4 editor' }))
      .toHaveAttribute('href', '#c4-editor');
    const table = page.getByRole('table', { name: 'Keyboard shortcuts for the C4 editor.' });
    for (const key of ['F2', 'M', 'C', 'A', 'F', 'Esc']) {
      await expect(table.getByRole('cell', { name: key, exact: true }), `a row for ${key}`).toHaveCount(1);
    }
    await expect(table).toContainText('In tutorials: runs Test My Work (the step\'s tests) in every check-display mode; '
      + 'on a step that asks you to Submit for review first, it is disabled until you have');
    // The site host keeps one undo history for the drawing and the YAML tab (spec §3.4).
    await expect(table).toContainText('while the drawing or the YAML tab has focus. Both share one history');
    await expect(page.locator('#conflicts + p')).toContainText('In the C4 editor');
    await a11yCheckpoint(page, 'shortcuts-c4-editor', { feature: 'c4-editor' });
  });

  test('the SEBook navigation lists the C4 editor under Software Architecture', async ({ page }) => {
    await page.goto(EDITOR_PATH);
    const contents = page.getByRole('navigation', { name: 'SE Book table of contents' });
    const architecture = contents.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Software Architecture', exact: true }) });
    await expect(architecture.getByRole('link', { name: 'C4 Editor', exact: true })).toHaveAttribute('href', EDITOR_PATH);
  });
});
