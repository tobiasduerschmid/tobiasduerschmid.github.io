'use strict';
/**
 * Family `sequence` (plan Task 5): the gestures of the UML editor's sequence diagrams, recorded at
 * stage R0 (spec 2026-11-12 §9.2). One gesture per operation the sequence editor offers, plus the
 * boundaries the plan lists: nested fragments, an empty branch, the first and the last message, a
 * document without `@enduml`, and the draft diagnostics of an unclosed fragment.
 *
 * Every gesture runs on the UML editor page except one on the playground, whose stored draft the
 * corpus observes too. The starts are small: the editor draws a sequence at full size inside a
 * preview about 640 px wide, so three lifelines with short names are the most that stay in view.
 * Steps reach the drawing through the hit layer's own buttons (role and name), its classes
 * (spec §3.7), and the renderer's `data-layout-*` stamps on texts that have no role. Points on a
 * lifeline at a height are read from a message line: its left or right end, moved up or down.
 */

const EDITOR = '/SEBook/tools/uml-editor';
const PLAYGROUND = '/SEBook/tools/uml-playground';

// ---------- start documents ----------

const sequenceText = (...lines) => ['@startuml', ...lines, '@enduml'].join('\n');

// Lines 4-7 are messages (`seqmsg:4` … `seqmsg:7`); user, app, and db stand left to right.
const THREE_LIFELINES = sequenceText('actor user', 'participant app', 'participant db',
  'user -> app: login', 'app -> db: query', 'db --> app: rows', 'app --> user: ok');
const TWO_LIFELINES = sequenceText('actor user', 'participant app', 'user -> app: login');
// `alt` opens on line 4 (`frag:4`), its `else` is line 6; messages on lines 3, 5, 7, and 9.
const ALT_FRAGMENT = sequenceText('actor user', 'participant app',
  'user -> app: login', 'alt [valid]', '  app --> user: token', 'else [invalid]', '  app --> user: error', 'end',
  'user -> app: logout');
// `opt` opens on line 4 and `loop` on line 7, one after the other.
const SIBLING_FRAGMENTS = sequenceText('actor user', 'participant app',
  'user -> app: start', 'opt [cached]', '  app --> user: hit', 'end', 'loop [retry]', '  user -> app: again', 'end',
  'app --> user: done');
// The inner `opt` (line 5) sits in the outer `loop` (line 3), one indent deeper.
const NESTED_FRAGMENTS = sequenceText('actor user', 'participant app',
  'loop [each item]', '  user -> app: add', '  opt [in stock]', '    app --> user: added', '  end', 'end');
// The `else` branch (line 6) holds no message.
const EMPTY_BRANCH = sequenceText('actor user', 'participant app',
  'user -> app: pay', 'alt [approved]', '  app --> user: receipt', 'else [declined]', 'end');
// One activation bar on app, from line 4 (`actbar:4`) to its `deactivate` on line 6.
const ACTIVATION = sequenceText('actor user', 'participant app',
  'user -> app: login', 'activate app', 'app --> user: token', 'deactivate app', 'user -> app: logout', 'app --> user: bye');
const WITHOUT_ENDUML = ['@startuml', 'actor user', 'participant app', 'user -> app: login'].join('\n');
// The `alt` on line 4 has no `end`: the draft diagnostics name it.
const UNCLOSED_FRAGMENT = sequenceText('actor user', 'participant app',
  'user -> app: login', 'alt [valid]', '  app --> user: token');

// ---------- what steps point at ----------

// The hit layer's buttons, by the start of their accessible names.
const hitButton = (namePrefix) => ({ role: 'button', name: `${namePrefix} —`, exact: false });
const lifelineHead = (id) => hitButton(`Element ${id}`);
const messageLine = (line) => hitButton(`Relation segment 1 of seqmsg:${line}`);
const fragmentTab = (line) => hitButton(`Fragment frag:${line}`);
const activationBar = (lifeline) => hitButton(`Activation of ${lifeline}`);
const activationEdge = (line, edge) => ({ css: `.uml-pg-edit-layer .uml-pg-activation-handle.is-${edge}[data-layout-id="actbar:${line}"]` });
// Texts of the drawing that have no role: a message's label, a fragment's guard, a fragment's tab.
const drawing = '#uml-pg-output svg';
const messageLabel = (line) => ({ css: `${drawing} text[data-layout-route-id="seqmsg:${line}"]` });
const fragmentGuard = (line, role) => ({ css: `${drawing} text[data-layout-fragment-id="frag:${line}"][data-layout-fragment-role="${role}"]` });
const fragmentTabText = (line) => ({ css: `${drawing} text[data-layout-fragment-id="frag:${line}"]:not([data-layout-fragment-role])` });

const properties = { css: '#uml-pg-props-pane' };
const modelPanel = { role: 'region', name: 'Diagram model editor' };

/** A point on the lifeline at one end of a message (`end` 0 = left, 1 = right), `dy` px below it. */
const besideMessage = (line, end, dy) => ({ target: messageLine(line), at: { x: end, y: 0.5 }, offset: { x: 0, y: dy } });
const centreOf = (target, dy = 0) => ({ target, offset: { x: 0, y: dy } });

// ---------- steps ----------

const armElementTool = (name) => ({ do: 'click', target: { role: 'button', name: `Add element: ${name}` } });
const armRelationTool = (name) => ({ do: 'click', target: { role: 'button', name: `Add relation: ${name}` } });
const clickOn = (target, modifiers) => ({ do: 'pointerClick', point: centreOf(target), ...(modifiers ? { modifiers } : {}) });
const openModelRows = { do: 'click', target: { text: 'Advanced sequence rows', exact: false, within: modelPanel } };
const inProperties = (target) => ({ ...target, within: properties });

/** Types `value` into a field and commits it the way the field commits: Enter, or Tab for a change event. */
const typeInto = (field, value, commitKey = 'Enter') => [
  { do: 'fill', target: field, value },
  { do: 'press', target: field, key: commitKey },
];
// A lifeline's "+" handle shows while the pointer is over its head; then it is dragged onto another head.
const extendHandleOf = (id) => ({ role: 'button', name: `Extend a relation from ${id}` });
const extendOnto = (tool, from, to) => [
  armRelationTool(tool),
  { do: 'pointerMove', point: centreOf(lifelineHead(from)) },
  { do: 'drag', from: centreOf(extendHandleOf(from)), to: centreOf(lifelineHead(to)) },
];

function gesture(id, start, steps, covers, page = EDITOR) {
  return { id, family: 'sequence', type: 'sequence', page, start, steps, covers };
}

// ---------- lifelines ----------

const lifelines = [
  gesture('sequence-participant-placed-from-the-palette-by-a-canvas-click', TWO_LIFELINES, [
    armElementTool('Participant'),
    { do: 'pointerClick', point: { target: lifelineHead('app'), at: { x: 1, y: 0.5 }, offset: { x: 90, y: 0 } } },
  ], ['placeElementAt']),
  gesture('sequence-actor-added-with-the-keyboard-from-the-palette', THREE_LIFELINES, [
    { do: 'press', target: { role: 'button', name: 'Add element: Actor' }, key: 'Enter' },
  ], ['addElementWithoutCanvas', 'addSequenceParticipant']),
  gesture('sequence-starter-exchange-added-to-an-empty-diagram', null, [
    { do: 'click', target: { role: 'button', name: '+ Starter exchange' } },
  ], ['addSequenceStarterPair']),
  gesture('sequence-actor-added-from-the-model-panel', THREE_LIFELINES, [
    openModelRows,
    { do: 'click', target: { role: 'button', name: '+ Actor', within: modelPanel } },
  ], ['addSequenceParticipant']),
  gesture('sequence-participant-added-from-the-model-panel-on-the-playground', THREE_LIFELINES, [
    openModelRows,
    { do: 'click', target: { role: 'button', name: '+ Participant', within: modelPanel } },
  ], ['addSequenceParticipant'], PLAYGROUND),
  gesture('sequence-lifeline-reordered-by-dragging-its-head', THREE_LIFELINES, [
    { do: 'drag', from: { target: lifelineHead('db'), at: { x: 0.3, y: 0.5 } }, to: { target: lifelineHead('user'), at: { x: 0, y: 0.5 }, offset: { x: -30, y: 0 } } },
  ], ['updateDrag']),
  gesture('sequence-lifeline-head-renamed-in-place', THREE_LIFELINES, [
    { do: 'pointerDblclick', point: centreOf(lifelineHead('app')) },
    ...typeInto({ role: 'textbox', name: 'Rename app' }, 'api: Gateway'),
  ], ['setSequenceLifelineHead']),
  gesture('sequence-lifeline-rename-to-a-keyword-id-is-refused', THREE_LIFELINES, [
    { do: 'pointerDblclick', point: centreOf(lifelineHead('app')) },
    ...typeInto({ role: 'textbox', name: 'Rename app' }, 'loop: Gateway'),
  ], ['setSequenceLifelineHead']),
  gesture('sequence-participant-display-label-changed-in-properties', THREE_LIFELINES, [
    clickOn(lifelineHead('db')),
    ...typeInto(inProperties({ label: 'Display label' }), 'Database', 'Tab'),
  ], ['replaceGenericElement']),
];

// ---------- messages ----------

const messages = [
  gesture('sequence-synchronous-message-drawn-between-two-messages', THREE_LIFELINES, [
    armRelationTool('Synchronous'),
    { do: 'drag', from: besideMessage(6, 0, 26), to: besideMessage(6, 1, 26) },
  ], ['addSequenceRelationAtLine']),
  gesture('sequence-asynchronous-message-drawn-above-the-first-message', THREE_LIFELINES, [
    armRelationTool('Asynchronous'),
    { do: 'drag', from: besideMessage(4, 0, -24), to: besideMessage(4, 1, -24) },
  ], ['addSequenceRelationAtLine']),
  gesture('sequence-return-message-drawn-below-the-last-message', THREE_LIFELINES, [
    armRelationTool('Return'),
    { do: 'drag', from: besideMessage(7, 1, 30), to: besideMessage(7, 0, 30) },
  ], ['addSequenceRelationAtLine']),
  gesture('sequence-create-message-drawn-at-a-height', THREE_LIFELINES, [
    armRelationTool('Create'),
    { do: 'drag', from: besideMessage(5, 0, 26), to: besideMessage(5, 1, 26) },
  ], ['addSequenceRelationAtLine']),
  gesture('sequence-lost-message-added-by-a-click-on-a-lifeline', THREE_LIFELINES, [
    armRelationTool('Lost'),
    { do: 'pointerClick', point: besideMessage(5, 0, 26) },
  ], ['addSequenceSingleMessage']),
  gesture('sequence-found-message-added-by-a-drag-from-a-lifeline', THREE_LIFELINES, [
    armRelationTool('Found'),
    { do: 'drag', from: besideMessage(4, 1, 26), to: { target: messageLine(4), at: { x: 1, y: 0.5 }, offset: { x: 70, y: 26 } } },
  ], ['addSequenceSingleMessage']),
  gesture('sequence-found-message-added-with-the-keyboard', THREE_LIFELINES, [
    armRelationTool('Found'),
    { do: 'press', target: lifelineHead('app'), key: 'Enter' },
  ], ['handleHitboxClickForRelation', 'addSequenceSingleMessage']),
  gesture('sequence-synchronous-message-added-with-the-keyboard', THREE_LIFELINES, [
    armRelationTool('Synchronous'),
    { do: 'press', target: lifelineHead('user'), key: 'Enter' },
    { do: 'press', target: lifelineHead('db'), key: 'Enter' },
  ], ['handleHitboxClickForRelation']),
  gesture('sequence-message-dragged-earlier', THREE_LIFELINES, [
    { do: 'drag', from: centreOf(messageLine(6)), to: centreOf(messageLine(5), -22) },
  ], ['updateDrag', 'moveSequenceMessageBlockToLine']),
  gesture('sequence-message-dragged-later', THREE_LIFELINES, [
    { do: 'drag', from: centreOf(messageLine(4)), to: centreOf(messageLine(6), 22) },
  ], ['updateDrag', 'moveSequenceMessageBlockToLine']),
  // The refusal comes before any write site: `moveSequenceMessageBy` stops at the first message.
  gesture('sequence-first-message-cannot-move-earlier', THREE_LIFELINES, [
    clickOn(messageLine(4)),
    { do: 'click', target: inProperties({ role: 'button', name: 'Move earlier' }) },
  ], []),
  gesture('sequence-last-message-dragged-above-the-first', THREE_LIFELINES, [
    { do: 'drag', from: centreOf(messageLine(7)), to: centreOf(messageLine(4), -22) },
  ], ['updateDrag', 'moveSequenceMessageBlockToLine']),
  gesture('sequence-message-dragged-into-a-fragment-branch', ALT_FRAGMENT, [
    { do: 'drag', from: centreOf(messageLine(9)), to: centreOf(messageLine(7), 22) },
  ], ['updateDrag', 'moveSequenceMessageBlockToLine']),
  gesture('sequence-message-moved-to-the-other-branch-in-properties', ALT_FRAGMENT, [
    clickOn(messageLine(5)),
    { do: 'select', target: inProperties({ label: 'Branch' }), value: '1' },
  ], ['moveSequenceMessageToBranch']),
  gesture('sequence-message-moved-into-an-empty-branch-in-properties', EMPTY_BRANCH, [
    clickOn(messageLine(5)),
    { do: 'select', target: inProperties({ label: 'Branch' }), value: '1' },
  ], ['moveSequenceMessageToBranch']),
  // The classic editor rewires a message's end in Properties only: dragging a message moves it in time.
  gesture('sequence-message-target-rewired-in-properties', THREE_LIFELINES, [
    clickOn(messageLine(4)),
    { do: 'select', target: inProperties({ label: 'Target endpoint' }), value: 'db' },
  ], ['rewireRelationEndpoint']),
  gesture('sequence-message-inverted-from-its-context-menu', THREE_LIFELINES, [
    { do: 'pointerClick', point: centreOf(messageLine(5)), button: 'right' },
    { do: 'click', target: { role: 'menuitem', name: 'Invert direction' } },
  ], ['invertRelationDirection']),
  gesture('sequence-message-label-edited-in-place', THREE_LIFELINES, [
    { do: 'pointerDblclick', point: centreOf(messageLabel(5)) },
    ...typeInto({ role: 'textbox', name: 'Edit relation label' }, 'lookup(id)'),
  ], ['replaceRelationLine']),
  gesture('sequence-message-kind-changed-in-properties', THREE_LIFELINES, [
    clickOn(messageLine(5)),
    { do: 'select', target: inProperties({ label: 'Type' }), value: 'async' },
  ], ['replaceRelationLine']),
  gesture('sequence-message-drawn-in-a-document-without-enduml', WITHOUT_ENDUML, [
    armRelationTool('Return'),
    { do: 'drag', from: besideMessage(3, 1, 30), to: besideMessage(3, 0, 30) },
  ], ['addSequenceRelationAtLine']),
  // Ruling U-W10 (2026-11-15): a lost or found message made with the selected relation tool by
  // dragging a lifeline's "+" handle. The tool picks the end (Lost: the source; Found: the target),
  // the line goes before @enduml, and after a participant made from the element chooser the
  // participant and the message are one undo step.
  gesture('sequence-lost-message-added-by-dragging-the-extend-handle-onto-another-lifeline', THREE_LIFELINES,
    extendOnto('Lost', 'user', 'app'), ['connectWithSelectedRelationTool']),
  gesture('sequence-found-message-added-by-dragging-the-extend-handle-onto-another-lifeline', THREE_LIFELINES,
    extendOnto('Found', 'user', 'app'), ['connectWithSelectedRelationTool']),
  gesture('sequence-lost-message-added-after-a-participant-created-from-the-extend-handle', THREE_LIFELINES, [
    armRelationTool('Lost'),
    { do: 'pointerMove', point: centreOf(lifelineHead('user')) },
    { do: 'drag', from: centreOf(extendHandleOf('user')), to: { target: { css: drawing }, at: { x: 0.97, y: 0.97 } } },
    { do: 'click', target: { role: 'menuitem', name: 'Participant', exact: false } },
    { do: 'advance', ms: 100 },
  ], ['updateExtendDrag', 'connectWithSelectedRelationTool']),
];

// ---------- fragments ----------

const fragments = [
  gesture('sequence-opt-fragment-stub-placed-at-a-height', THREE_LIFELINES, [
    armElementTool('opt fragment'),
    { do: 'pointerClick', point: besideMessage(5, 0.5, 26) },
  ], ['placeElementAt']),
  // `commitWrap` looks for `edge-N` route ids, and a sequence message is `seqmsg:N`, so today the
  // wrap finds no selected message and says so. The corpus keeps that refusal.
  gesture('sequence-wrap-of-two-selected-messages-reports-them-not-located', THREE_LIFELINES, [
    clickOn(messageLine(5)),
    clickOn(messageLine(6), ['Shift']),
    { do: 'click', target: { role: 'button', name: 'Wrap selected messages in loop fragment' } },
    ...typeInto({ label: 'loop fragment condition' }, 'until rows arrive'),
  ], ['commitWrap']),
  gesture('sequence-fragment-kind-changed-in-properties', ALT_FRAGMENT, [
    clickOn(fragmentTab(4)),
    { do: 'select', target: inProperties({ label: 'Kind' }), value: 'par' },
  ], ['changeFragmentKind']),
  gesture('sequence-fragment-condition-edited-in-place', ALT_FRAGMENT, [
    { do: 'pointerDblclick', point: centreOf(fragmentGuard(4, 'condition')) },
    ...typeInto({ role: 'textbox', name: 'alt fragment condition' }, 'password matches'),
  ], ['changeFragmentCondition']),
  // With Visual edit off no hitbox covers the tab, so a double-click on it opens the tab's own editor.
  gesture('sequence-fragment-condition-retyped-on-its-tab-with-visual-edit-off', ALT_FRAGMENT, [
    { do: 'uncheck', target: { role: 'checkbox', name: 'Visual edit' } },
    { do: 'pointerDblclick', point: centreOf(fragmentTabText(4)) },
    ...typeInto({ role: 'textbox', name: 'alt fragment condition' }, 'password matches'),
  ], ['startInlineFragmentEdit']),
  gesture('sequence-fragment-branch-guard-edited-in-place', ALT_FRAGMENT, [
    { do: 'pointerDblclick', point: centreOf(fragmentGuard(4, 'branch')) },
    ...typeInto({ role: 'textbox', name: 'fragment branch condition' }, 'locked out'),
  ], ['changeFragmentBranchCondition']),
  gesture('sequence-else-branch-added-in-properties', ALT_FRAGMENT, [
    clickOn(fragmentTab(4)),
    { do: 'click', target: inProperties({ role: 'button', name: 'Add branch' }) },
  ], ['addFragmentElseBranch']),
  gesture('sequence-fragment-unwrapped-keeping-its-messages', ALT_FRAGMENT, [
    clickOn(fragmentTab(4)),
    { do: 'click', target: inProperties({ role: 'button', name: 'Remove fragment (keep inner messages)' }) },
  ], ['unwrapFragment']),
  gesture('sequence-fragment-moved-earlier-in-properties', ALT_FRAGMENT, [
    clickOn(fragmentTab(4)),
    { do: 'click', target: inProperties({ role: 'button', name: 'Move earlier' }) },
  ], ['moveFragmentBy']),
  gesture('sequence-fragment-moved-later-past-a-sibling-fragment-in-properties', SIBLING_FRAGMENTS, [
    clickOn(fragmentTab(4)),
    { do: 'click', target: inProperties({ role: 'button', name: 'Move later' }) },
  ], ['moveFragmentBy']),
  gesture('sequence-fragment-dragged-to-another-line', ALT_FRAGMENT, [
    { do: 'drag', from: centreOf(fragmentTab(4)), to: centreOf(messageLine(9), 24) },
  ], ['moveSequenceFragmentToLine']),
  gesture('sequence-fragment-deleted-with-the-delete-key', ALT_FRAGMENT, [
    { do: 'press', target: fragmentTab(4), key: 'Delete' },
  ], ['deleteSelected']),
  gesture('sequence-inner-fragment-of-a-nested-pair-unwrapped', NESTED_FRAGMENTS, [
    clickOn(fragmentTab(5)),
    { do: 'click', target: inProperties({ role: 'button', name: 'Remove fragment (keep inner messages)' }) },
  ], ['unwrapFragment']),
  gesture('sequence-inner-fragment-moved-earlier-inside-its-parent', NESTED_FRAGMENTS, [
    clickOn(fragmentTab(5)),
    { do: 'click', target: inProperties({ role: 'button', name: 'Move earlier' }) },
  ], ['moveFragmentBy']),
];

// ---------- activation bars and lifeline markers ----------

const activations = [
  gesture('sequence-activation-bar-created-by-dragging-down-a-lifeline', THREE_LIFELINES, [
    armElementTool('Activate'),
    { do: 'drag', from: besideMessage(5, 1, -20), to: besideMessage(6, 1, 20) },
  ], ['createActivationBar']),
  gesture('sequence-activation-bar-end-dragged-later', ACTIVATION, [
    { do: 'drag', from: { target: activationEdge(4, 'end') }, to: centreOf(messageLine(7), 20) },
  ], ['setActivationBarSlots']),
  gesture('sequence-activation-bar-deleted-with-the-delete-key', ACTIVATION, [
    { do: 'press', target: activationBar('app'), key: 'Delete' },
  ], ['deleteSelected']),
  gesture('sequence-deactivate-marker-added-by-clicking-a-lifeline-head', THREE_LIFELINES, [
    armElementTool('Deactivate'),
    clickOn(lifelineHead('app')),
  ], ['handleHitboxClickForSequenceElementTool']),
  gesture('sequence-note-added-to-a-lifeline-with-the-keyboard', THREE_LIFELINES, [
    { do: 'press', target: { role: 'button', name: 'Add element: Note' }, key: 'Enter' },
    { do: 'press', target: lifelineHead('db'), key: 'Enter' },
  ], ['handleHitboxClickForSequenceElementTool']),
];

// ---------- the model panel ("Advanced sequence rows") ----------

const modelRows = [
  gesture('sequence-participant-renamed-in-the-model-panel', THREE_LIFELINES, [
    openModelRows,
    ...typeInto({ label: 'Lifeline 3 identifier' }, 'store', 'Tab'),
  ], ['updateSequenceParticipant']),
  gesture('sequence-lifeline-row-deleted-in-the-model-panel', THREE_LIFELINES, [
    openModelRows,
    { do: 'click', target: { role: 'button', name: 'Delete lifeline db' } },
  ], ['buildSequenceParticipantRow']),
  gesture('sequence-timeline-row-replaced-in-the-model-panel', THREE_LIFELINES, [
    openModelRows,
    ...typeInto({ label: 'Sync message source line 2' }, 'app -> db: lookup', 'Tab'),
  ], ['replaceSequenceLineRange']),
];

// ---------- draft diagnostics of an unclosed fragment ----------

const diagnostics = [
  gesture('sequence-fragment-end-row-deleted-leaves-an-unclosed-fragment', ALT_FRAGMENT, [
    openModelRows,
    { do: 'click', target: { role: 'button', name: 'Delete fragment end 6' } },
  ], ['replaceSequenceLineRange']),
  gesture('sequence-message-drawn-while-a-fragment-is-unclosed', UNCLOSED_FRAGMENT, [
    armRelationTool('Synchronous'),
    { do: 'drag', from: besideMessage(5, 1, 30), to: besideMessage(5, 0, 30) },
  ], ['addSequenceRelationAtLine']),
];

module.exports = [...lifelines, ...messages, ...fragments, ...activations, ...modelRows, ...diagnostics];
