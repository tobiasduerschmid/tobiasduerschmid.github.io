// @ts-check
// Pages for the specs of the C4 editor's UML-notation views (UML-view editing spec §7, §9.3): code, deployment,
// dynamic, and interfaces views. It builds on `loadC4Editor` (tests/helpers/c4-editor-page.js), which loads the editor
// from the ArchUML manifests, with the diagram editor's `core` group that edits these views, so this file keeps no
// script list of its own. The host each editor gets records the
// texts and views it is told and what the editor announces, in `window.c4HostLogs[<mount point id>]`; the editor's
// handle is `window.c4Editors[<mount point id>]`.
const fs = require('node:fs');
const path = require('node:path');
const { C4, loadC4Editor } = require('./c4-editor-page.js');

// The reference model with its interface descriptions, which every UML view type can show: `code of policy`,
// `deployment production`, `dynamic enroll`, and `interfaces of api` (the Planner Web App uses the Registration API,
// which uses the Billing System).
const INTERFACES_REFERENCE = fs.readFileSync(path.join(__dirname, '../../js/ArchUML/tests/c4/fixtures/course-registration-interfaces.yml'), 'utf8');

/**
 * Runs in the page: mounts an editor on `#<rootId>` with `options` (the host contract's `text`, `view`, `profile`,
 * `readOnly`, `lockedFields`, `checks`, `size`; those left undefined take the editor's defaults) and a recording host.
 * With `exportSvg` the host also takes Download SVG and records each exported drawing.
 */
function mountRecorded({ rootId, options, exportSvg = false }) {
  const log = { texts: [], views: [], selections: [], announced: [], exported: [] };
  window.c4HostLogs = Object.assign(window.c4HostLogs || {}, { [rootId]: log });
  const host = {
    onTextChange: (text) => log.texts.push(text),
    onViewChange: (view) => log.views.push(view),
    onSelectionChange: (selection) => log.selections.push(selection),
    announce: (message) => log.announced.push(message),
  };
  if (exportSvg) host.exportSvg = (svgText) => log.exported.push(svgText);
  const editor = window.ArchUMLC4Editor.mount(document.getElementById(rootId), Object.assign({}, options, { host }));
  window.c4Editors = Object.assign(window.c4Editors || {}, { [rootId]: editor });
}

/** The mount options of `settings` (see openUmlEditor), with the reference model and `code of policy` as defaults. */
function mountOptions({ text = INTERFACES_REFERENCE, view = 'code of policy', profile, readOnly, lockedFields, checks, size }) {
  // `size` only when given: mount would take an explicit undefined for a size outside the contract.
  return Object.assign({ text, view, profile, readOnly, lockedFields, checks }, size ? { size } : {});
}

/**
 * Loads a page with one C4 editor and returns the locator of its mount point. `settings`: `text` (default: the reference
 * model with interfaces), `view` (default `code of policy`), `profile`, `readOnly`, `lockedFields`, `checks`, `size` as in
 * the host contract, `siteThemes` (load the site's theme stylesheets, for dark-mode checks; see `loadC4Editor`),
 * `diagramEditor` (default true: load the diagram editor's `core` group; false gives a page without it, as a host that
 * has not loaded it yet), `header` (a 96 px sticky site header above the editor), `exportSvg` (the host takes Download
 * SVG; what it is given is the log's `exported`), and `beforeMount` (a function run in
 * the page after the scripts load and before the editor mounts: test plumbing that must see a part as the mount reads
 * it from `ArchUMLC4EditorParts`).
 */
async function openUmlEditor(page, settings = {}) {
  await loadC4Editor(page, {
    title: 'C4 editor UML views', siteThemes: settings.siteThemes, diagramEditor: settings.diagramEditor !== false, header: settings.header,
  });
  if (settings.beforeMount) await page.evaluate(settings.beforeMount);
  await page.evaluate(mountRecorded, { rootId: 'editor', options: mountOptions(settings), exportSvg: Boolean(settings.exportSvg) });
  return page.locator('#editor');
}

/**
 * Loads a page with two C4 editors, mounted with the settings `a` and `b` (as for openUmlEditor; the page loads the
 * site's theme stylesheets when either asks for them), and returns the locators of their mount points.
 */
async function openTwoUmlEditors(page, a = {}, b = {}) {
  await loadC4Editor(page, { title: 'Two C4 editors', roots: ['first', 'second'], siteThemes: Boolean(a.siteThemes || b.siteThemes),
    diagramEditor: true });
  await page.evaluate(mountRecorded, { rootId: 'first', options: mountOptions(a) });
  await page.evaluate(mountRecorded, { rootId: 'second', options: mountOptions(b) });
  return [page.locator('#first'), page.locator('#second')];
}

/** What the host of the editor on `#<rootId>` was told: `{ texts, views, selections, announced, exported }`. */
const hostLog = (page, rootId = 'editor') => page.evaluate((id) => window.c4HostLogs[id], rootId);

const canvas = (editor) => editor.getByRole('region', { name: /^Canvas/ });
const elements = (editor) => canvas(editor).getByRole('listbox', { name: 'Elements in this view' });
const option = (editor, name) => elements(editor).getByRole('option', { name, exact: true });
// The visible message region directly before the canvas (UML-view editing spec §7.5): a region named "Messages"
// (c4-editor-messages.js). A read-only editor has none.
const messageRegion = (editor) => editor.getByRole('region', { name: 'Messages', exact: true });

module.exports = {
  C4, INTERFACES_REFERENCE, openUmlEditor, openTwoUmlEditors, hostLog, canvas, elements, option, messageRegion,
};
