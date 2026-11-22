'use strict';
/**
 * What a gesture leaves on the UML editor's page, at one instant (spec 2026-11-12 §9.2, plan Task 3):
 * `{ text, regions, properties, draft, selection, focus }`.
 * - `text`: the value of the source, `#uml-pg-input`.
 * - `regions`: per announcement region of REGION_IDS, its text, and for the regions in
 *   REGIONS_WITH_HIDDEN its `hidden` state as well (`null` for a region the page lacks).
 * - `properties`: the aria snapshot of the Properties pane, `null` while the pane is hidden.
 * - `draft`: the stored draft under the page's autosave key for the current type, `null` on a page
 *   without persistence. Observe after the clock has passed the autosave delay (clock.settle).
 * - `selection`: the layout ids of the hit targets inside `.uml-pg-edit-layer` marked `is-selected`,
 *   in DOM order.
 * - `focus`: `{ tag, id, role, name, layoutId }` of the focused element; `role` and `name` are the
 *   ones the browser's accessibility tree computes. The editor names some generated fields with
 *   Math.random (a Properties field, the wrap condition); their random part reads `<random>`.
 */

const REGION_IDS = Object.freeze([
  'uml-pg-status',
  'uml-pg-tool-status',
  'uml-pg-class-selection',
  'uml-pg-error',
  'uml-pg-member-error',
  'uml-pg-callout-status',
  'uml-pg-diagnostics',
  'uml-pg-autosave',
]);
const REGIONS_WITH_HIDDEN = Object.freeze(['uml-pg-member-error', 'uml-pg-diagnostics']);
const PROPERTIES_PANE = '#uml-pg-props-pane';
// Ids the editor generates with Math.random().toString(36).slice(2, 9): `uml-pg-prop-…`, `uml-pg-wrap-cond-…`.
const GENERATED_ID = /^(uml-pg-(?:prop|wrap-cond))-[0-9a-z]{1,7}$/;

function readPage({ regionIds, regionsWithHidden }) {
  const regions = {};
  for (const id of regionIds) {
    const element = document.getElementById(id);
    if (!element) {
      regions[id] = null;
      continue;
    }
    regions[id] = regionsWithHidden.includes(id)
      ? { text: element.textContent, hidden: element.hidden }
      : { text: element.textContent };
  }
  const config = JSON.parse(document.getElementById('uml-pg-config').textContent);
  const draft = config.persistence === false ? null : localStorage.getItem(window.UMLEditor.autosaveKey());
  const selection = [...document.querySelectorAll('.uml-pg-edit-layer .is-selected')]
    .map((target) => target.getAttribute('data-layout-id'));
  const focused = document.activeElement;
  const focus = focused
    ? { tag: focused.tagName.toLowerCase(), id: focused.id || '', layoutId: focused.getAttribute('data-layout-id') }
    : null;
  const pane = document.querySelector('#uml-pg-props-pane');
  return { regions, draft, selection, focus, paneShown: !!pane && !pane.hidden };
}

/** The role and name the browser's accessibility tree gives the focused element. */
async function accessibleFocus(page) {
  const session = await page.context().newCDPSession(page);
  try {
    const { result } = await session.send('Runtime.evaluate', { expression: 'document.activeElement' });
    if (!result.objectId) return { role: null, name: null };
    const { node } = await session.send('DOM.describeNode', { objectId: result.objectId });
    const { nodes } = await session.send('Accessibility.getPartialAXTree', { backendNodeId: node.backendNodeId, fetchRelatives: false });
    const own = nodes.find((axNode) => axNode.backendDOMNodeId === node.backendNodeId) || nodes[0];
    return {
      role: own && own.role ? own.role.value : null,
      name: own && own.name ? own.name.value : '',
    };
  } finally {
    await session.detach();
  }
}

/** The observation of the page now (see the header). */
async function observe(page) {
  const text = await page.locator('#uml-pg-input').inputValue();
  const read = await page.evaluate(readPage, { regionIds: REGION_IDS, regionsWithHidden: REGIONS_WITH_HIDDEN });
  const properties = read.paneShown ? await page.locator(PROPERTIES_PANE).ariaSnapshot() : null;
  const focus = read.focus ? { ...read.focus, ...(await accessibleFocus(page)) } : null;
  return {
    text,
    regions: read.regions,
    properties,
    draft: read.draft,
    selection: read.selection,
    focus: focus && {
      tag: focus.tag,
      id: focus.id.replace(GENERATED_ID, '$1-<random>'),
      role: focus.role,
      name: focus.name,
      layoutId: focus.layoutId,
    },
  };
}

module.exports = { REGION_IDS, REGIONS_WITH_HIDDEN, observe };
