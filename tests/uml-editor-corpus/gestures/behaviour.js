'use strict';
// Family `behaviour` (plan Task 6): the gestures of the state, activity, and use-case diagrams.
//
// - State: add a state, the starter, and the pseudostates; rename; add, label, rewire, and invert
//   a transition; edit a composite state whose body holds nested declarations; Delete on a state
//   and on the initial pseudostate, whose removal rewrites the transitions that name them. Layout:
//   a drag, a nudge, a bend drag, and Reset Selected, where the positions of states named only in
//   transitions and of pseudostates go into the `@layout` block and a declared state's into its
//   line. Duplicate on a composite state, whose copy renames its nested declarations.
// - Activity: add an action, a decision, a fork with its join, an initial with its final, and a
//   swimlane; rename an action; a flow's guard and a continuation flow (`--> [guard] Target`) in
//   their Guard fields; invert a guarded flow; Delete on the implicit flow into a decision, which
//   matches no single line, and on an action that a decision branch continues into; a nudge and
//   Reset Selected, where every position goes into the block (an activity declares no action).
// - Use case: actors, use cases, and system boundaries; membership checkboxes; relations; Delete on
//   a use case inside a system boundary, whose removal also rewrites the boundary's member list;
//   in-place renames of a use case and an actor; a drag and Reset Selected, where each position goes
//   into its declaration's line; Duplicate on a use case inside a system boundary and on a boundary
//   that declares a use case inside its braces.
// - Boundaries (spec §9.2): a line typed above a transition's line, then within the 120 ms render
//   debounce an edit of that transition's label (state routes have ordinal ids `edge-N`, and the
//   drawing still shows the text before the typing); a source that fails to render, then Undo.
//
// Steps name hit targets by the role and name the editor gives them. Two §3.7 ids scope a step:
// `#uml-pg-preview-pane`, the surface a palette tool is dropped on or clicked onto, and
// `#uml-pg-props-content`, the Properties pane's fields. Every gesture starts from its own text,
// or (`start: null`) from the empty document the editor page shows for its diagram type.

const EDITOR = '/SEBook/tools/uml-editor';
const PLAYGROUND = '/SEBook/tools/uml-playground';

// ---------- targets (plain data, so the fixtures can store the steps) ----------

const button = (name) => ({ role: 'button', name });
const element = (label) => button(`Element ${label} — Enter to select, arrows to nudge, Delete to remove`);
const segment = (routeId, number = 1) => button(`Relation segment ${number} of ${routeId} — Enter to select, Delete to remove`);
const plusHandle = (label) => button(`Extend a relation from ${label}`);
const chooserItem = (label) => ({ role: 'menuitem', name: label });
const inProperties = (target) => ({ ...target, within: { css: '#uml-pg-props-content' } });
const propertiesField = (label) => inProperties({ label });
const SOURCE = { role: 'textbox', name: 'ArchUML diagram source' };
// A free place on the canvas, right of every drawing below.
const FREE_PLACE = { target: { css: '#uml-pg-preview-pane' }, at: { x: 0.85, y: 0.2 } };
const pointAt = (target) => ({ target });

// ---------- steps ----------

const dropTool = (toolLabel) => ({ do: 'drag', from: pointAt(button(toolLabel)), to: FREE_PLACE });
const armToolThenClickFreePlace = (toolLabel) => [{ do: 'click', target: button(toolLabel) }, { do: 'pointerClick', point: FREE_PLACE }];
const fillAndEnter = (target, value) => [{ do: 'fill', target, value }, { do: 'press', target, key: 'Enter' }];
const renameInPlace = (label, value) => [
  { do: 'pointerDblclick', point: pointAt(element(label)) },
  { do: 'fill', target: { role: 'textbox', name: `Rename ${label}` }, value },
  { do: 'press', key: 'Enter' },
];
const connectThroughChooser = (fromLabel, toLabel, relationLabel) => [
  { do: 'pointerMove', point: pointAt(element(fromLabel)) }, // shows the "+" handle
  { do: 'drag', from: pointAt(plusHandle(fromLabel)), to: pointAt(element(toLabel)) },
  { do: 'click', target: chooserItem(relationLabel) },
];
const connectWithTool = (toolLabel, fromLabel, toLabel) => [
  { do: 'click', target: button(toolLabel) },
  { do: 'pointerClick', point: pointAt(element(fromLabel)) },
  { do: 'pointerClick', point: pointAt(element(toLabel)) },
];
const selectRoute = (routeId, number) => ({ do: 'pointerClick', point: pointAt(segment(routeId, number)) });
// Delete on a focused element removes it (its label: "Delete to remove").
const deleteWithTheKeyboard = (label) => ({ do: 'press', target: element(label), key: 'Delete' });
// The system boundary's box lies over the lines inside it, so those are selected with the keyboard.
const selectRouteWithKeyboard = (routeId, number) => ({ do: 'press', target: segment(routeId, number), key: 'Enter' });
const selectWithTheKeyboard = (label) => ({ do: 'press', target: element(label), key: 'Enter' });
// A focused element moves by one step per arrow key (its label: "arrows to nudge").
const nudgeRight = (label) => ({ do: 'press', target: element(label), key: 'ArrowRight' });
// Pressed at the element's centre and released `offset` CSS px from it.
const dragBy = (label, offset) => ({ do: 'drag', from: pointAt(element(label)), to: { target: element(label), offset } });
// The element's context menu, opened at `at` (a fraction of its box), then one of its items.
const fromTheContextMenu = (label, at, itemLabel) => [
  { do: 'pointerClick', point: { target: element(label), at }, button: 'right' },
  { do: 'click', target: chooserItem(itemLabel) },
];

// ---------- start documents ----------

const lines = (...rows) => ['@startuml', ...rows, '@enduml'].join('\n');

const STATE = lines('[*] --> Idle', 'Idle --> Busy : start', 'Busy --> Done : finish', 'Done --> [*]');
const STATE_DECLARED = lines('state Idle', 'state Busy', '[*] --> Idle', 'Idle --> Busy : start');
// Idle is declared, so its position is written into its line; Busy and Done are named only in
// transitions, and the pseudostates by `[*]`, so theirs go into an `@layout` block.
const STATE_PARTLY_DECLARED = lines('state Idle', '[*] --> Idle', 'Idle --> Busy : start', 'Busy --> Done : finish', 'Done --> [*]');
// STATE as the editor writes it after Busy was dragged right: every drawn position in the block.
const STATE_WITH_BUSY_DRAGGED = lines(
  '@layout schema=1 renderer="archuml-visual-editor"',
  'node "__initial__0" x=82 y=30',
  'node "Idle" x=30 y=101',
  'node "Busy" x=180 y=200',
  'node "Done" x=30 y=307',
  'node "__final__0" x=79 y=412',
  '@endlayout',
  '[*] --> Idle',
  'Idle --> Busy : start',
  'Busy --> Done : finish',
  'Done --> [*]',
);
const COMPOSITE = lines(
  'state Active {',
  '  state Waiting',
  '  state Working {',
  '    state Step1',
  '    state Step2',
  '    Step1 --> Step2 : next',
  '  }',
  '  [*] --> Waiting',
  '  Waiting --> Working : go',
  '}',
  '[*] --> Active',
);
// `rel:2` is the guarded flow; `rel:4` and `rel:6` are continuation flows out of the decision;
// `edge-2` is the flow into the decision, which no line of its own writes.
const ACTIVITY = lines(
  '(*) --> "Receive Order"',
  '"Receive Order" --> [paid] "Check Stock"',
  'if "In stock?" then',
  '  --> [yes] "Ship Order"',
  'else',
  '  --> [no] "Back Order"',
  'endif',
  '"Ship Order" --> (*)',
  '"Back Order" --> (*)',
);
// ACTIVITY as the editor writes it after Check Stock was nudged right: every position in the block.
const ACTIVITY_WITH_CHECK_STOCK_NUDGED = lines(
  '@layout schema=1 renderer="archuml-visual-editor"',
  'node "__initial__" x=183 y=30',
  'node "Receive Order" x=119 y=96',
  'node "Check Stock" x=134 y=188',
  'node "decision_1" x=138 y=280',
  'node "Ship Order" x=30 y=435',
  'node "Back Order" x=230 y=435',
  'node "__final__1" x=79 y=529',
  'node "__final__2" x=281 y=529',
  '@endlayout',
  '(*) --> "Receive Order"',
  '"Receive Order" --> [paid] "Check Stock"',
  'if "In stock?" then',
  '  --> [yes] "Ship Order"',
  'else',
  '  --> [no] "Back Order"',
  'endif',
  '"Ship Order" --> (*)',
  '"Back Order" --> (*)',
);
// `usecase:0` is the association, `usecase:1` the include. "Track Order" and "Cancel Order" lie
// outside the system boundary, whose box lies over the use cases inside it.
const USECASE = lines(
  'actor Customer',
  'actor Member',
  'usecase "Place Order" as UC1',
  'usecase "Track Order" as UC2',
  'usecase "Pay" as UC3',
  'usecase "Cancel Order" as UC4',
  'rectangle "Online Shop" {',
  '  UC1',
  '  UC3',
  '}',
  'Customer -- UC1',
  'UC1 ..> UC3 : <<include>>',
);
// USECASE as the editor writes it after Track Order was dragged down: every position in its line.
const USECASE_WITH_TRACK_ORDER_DRAGGED = lines(
  'actor Customer @pos(23, 152)',
  'actor Member @pos(28, 269)',
  'usecase "Place Order" as UC1 @pos(179, 124)',
  'usecase "Track Order" as UC2 @pos(179, 320)',
  'usecase "Pay" as UC3 @pos(386, 124)',
  'usecase "Cancel Order" as UC4 @pos(174, 360)',
  'rectangle "Online Shop" @pos(139, 60) {',
  '  UC1',
  '  UC3',
  '}',
  'Customer -- UC1',
  'UC1 ..> UC3 : <<include>>',
);
// A system boundary that declares a use case inside its braces and lists another as a member.
const USECASE_DECLARED_INSIDE_A_SYSTEM = lines(
  'actor Customer',
  'usecase "Place Order" as UC1',
  'rectangle "Online Shop" {',
  '  usecase "Pay" as UC3',
  '  UC1',
  '}',
  'Customer -- UC1',
  'UC1 ..> UC3 : <<include>>',
);
// STATE with a transition typed above `Busy --> Done : finish`: once drawn, `edge-2` is this new line.
const STATE_WITH_A_LINE_TYPED_ABOVE = lines('[*] --> Idle', 'Idle --> Busy : start', 'Idle --> Done : skip', 'Busy --> Done : finish', 'Done --> [*]');
// STATE with a callout whose target is malformed: the renderer throws an authoring error.
const STATE_WITH_A_MALFORMED_CALLOUT = lines('[*] --> Idle', 'Idle --> Busy : start', 'Busy --> Done : finish', 'Done --> [*]', 'callout right of Idle : waits for input');

const gesture = (type, id, page, start, steps, covers) => ({ id, family: 'behaviour', type, page, start, steps, covers });
const state = (...args) => gesture('state', ...args);
const activity = (...args) => gesture('activity', ...args);
const usecase = (...args) => gesture('usecase', ...args);

module.exports = [
  // ---------- state: elements ----------
  state('state-added-by-a-palette-drop', EDITOR, STATE,
    [dropTool('Add element: State')], ['placeElementAt']),
  state('state-added-from-the-empty-state-diagram', EDITOR, null,
    [{ do: 'click', target: button('+ State') }], ['addEmptyElement', 'placeElementAt']),
  state('state-machine-started-with-the-starter', EDITOR, null,
    [{ do: 'click', target: button('+ Start transition') }], ['addStateStarter']),
  state('composite-state-added-by-arming-the-tool-and-clicking-the-canvas', EDITOR, STATE,
    armToolThenClickFreePlace('Add element: Composite'), ['placeElementAt']),
  state('choice-pseudostate-added-with-enter-on-its-palette-button', EDITOR, STATE,
    [{ do: 'press', target: button('Add element: Choice <>'), key: 'Enter' }], ['addElementWithoutCanvas', 'placeElementAt']),
  state('initial-pseudostate-added-by-a-palette-drop', EDITOR, STATE,
    [dropTool('Add element: Initial ●')], ['placeElementAt']),
  state('final-pseudostate-added-by-arming-the-tool-and-clicking-the-canvas', EDITOR, STATE,
    armToolThenClickFreePlace('Add element: Final ◉'), ['placeElementAt']),

  // ---------- state: renames ----------
  state('declared-state-renamed-in-place', EDITOR, STATE_DECLARED,
    renameInPlace('Idle', 'Ready'), ['renameElement']),
  state('state-named-only-in-transitions-renamed-in-properties', PLAYGROUND, STATE,
    [{ do: 'pointerClick', point: pointAt(element('Busy')) }, ...fillAndEnter(propertiesField('Identifier'), 'Working')], ['renameElement']),
  state('state-rename-to-a-name-in-use-refused', EDITOR, STATE_DECLARED,
    [{ do: 'pointerClick', point: pointAt(element('Idle')) }, ...fillAndEnter(propertiesField('Identifier'), 'Busy')], ['renameElement']),

  // ---------- state: transitions ----------
  state('transition-added-through-the-plus-handle-and-the-chooser', EDITOR, STATE,
    connectThroughChooser('Idle', 'Done', 'Transition'), ['showRelationChooser']),
  state('transition-added-with-the-transition-tool', EDITOR, STATE,
    connectWithTool('Add relation: Transition', 'Done', 'Idle'), ['handleHitboxClickForRelation']),
  state('transition-labelled-in-properties', PLAYGROUND, STATE,
    [selectRoute('edge-2'), ...fillAndEnter(propertiesField('Label'), 'complete')], ['replaceRelationLine']),
  state('transition-label-edited-in-place', EDITOR, STATE, [
    { do: 'pointerDblclick', point: pointAt(segment('edge-1')) },
    { do: 'fill', target: { role: 'textbox', name: 'Edit relation label' }, value: 'begin' },
    { do: 'press', key: 'Enter' },
  ], ['replaceRelationLine']),
  state('transition-target-rewired-in-properties', EDITOR, STATE,
    [selectRoute('edge-2'), { do: 'select', target: propertiesField('Target endpoint'), value: 'Idle' }], ['rewireRelationEndpoint']),
  state('transition-inverted-in-properties', EDITOR, STATE,
    [selectRoute('edge-2'), { do: 'click', target: inProperties(button('Invert direction')) }], ['invertRelationDirection']),

  // ---------- state: a composite state with nested declarations ----------
  state('sub-state-added-to-a-composite-that-holds-nested-declarations', EDITOR, COMPOSITE,
    [{ do: 'press', target: element('Active'), key: 'Enter' }, { do: 'click', target: inProperties(button('+ Add sub-state')) }], ['replaceLineForElementId']),
  state('composite-state-stereotype-set-and-its-body-kept', EDITOR, COMPOSITE,
    [{ do: 'press', target: element('Active'), key: 'Enter' }, ...fillAndEnter(propertiesField('Stereotype (e.g. <<choice>>)'), 'busy')], ['replaceGenericElement']),
  state('sub-state-renamed-in-the-composite-properties', EDITOR, COMPOSITE,
    [{ do: 'press', target: element('Active'), key: 'Enter' }, ...fillAndEnter(propertiesField('Sub-state 1 name'), 'Pending')], ['renameElement']),
  state('sub-state-removed-in-the-composite-properties', EDITOR, COMPOSITE,
    [{ do: 'press', target: element('Active'), key: 'Enter' }, { do: 'click', target: inProperties(button('Remove sub-state 1')) }], ['renderChildren']),

  // ---------- state: removals ----------
  state('state-removed-with-its-transitions-by-the-delete-key', EDITOR, STATE,
    [deleteWithTheKeyboard('Busy')], ['deleteSelected']),
  state('initial-pseudostate-removed-with-the-delete-key', EDITOR, STATE,
    [deleteWithTheKeyboard('Initial pseudostate')], ['deleteSelected']),

  // ---------- state: layout and duplicates ----------
  // Every state of STATE is named only in transitions: each drawn position goes into the block.
  state('state-named-only-in-transitions-dragged', EDITOR, STATE,
    [dragBy('Busy', { x: 160, y: 0 })], ['updateDrag']),
  state('initial-pseudostate-nudged-beside-a-declared-state', EDITOR, STATE_PARTLY_DECLARED,
    [nudgeRight('Initial pseudostate')], ['nudgeElement']),
  state('state-named-only-in-transitions-reset-with-reset-selected', EDITOR, STATE_WITH_BUSY_DRAGGED,
    [selectWithTheKeyboard('Busy'), { do: 'click', target: button('Reset Selected') }], ['resetOneBtn:click']),
  state('transition-bend-dragged', EDITOR, STATE,
    [{ do: 'drag', from: pointAt(segment('edge-2')), to: { target: segment('edge-2'), offset: { x: -60, y: 0 } } }], ['updateDrag']),
  // Opened on the composite's name, above its sub-states' boxes.
  state('composite-state-duplicated-with-its-nested-declarations-from-its-context-menu', EDITOR, COMPOSITE,
    fromTheContextMenu('Active', { x: 0.5, y: 0.03 }, 'Duplicate'), ['duplicateElement']),

  // ---------- activity: elements ----------
  activity('action-added-by-a-palette-drop', EDITOR, ACTIVITY,
    [dropTool('Add element: Action')], ['placeElementAt']),
  activity('decision-added-by-arming-the-tool-and-clicking-the-canvas', EDITOR, ACTIVITY,
    armToolThenClickFreePlace('Add element: Decision (if)'), ['placeElementAt']),
  activity('fork-and-join-added-with-enter-on-their-palette-button', EDITOR, ACTIVITY,
    [{ do: 'press', target: button('Add element: Fork/Join'), key: 'Enter' }], ['addElementWithoutCanvas', 'placeElementAt']),
  activity('initial-and-final-added-from-the-empty-activity-diagram', EDITOR, null,
    [{ do: 'click', target: button('+ Initial/Final ◉') }], ['addEmptyElement', 'placeElementAt']),
  activity('swimlane-added-by-a-palette-drop', EDITOR, ACTIVITY,
    [dropTool('Add element: Swimlane')], ['placeElementAt']),

  // ---------- activity: renames ----------
  activity('action-renamed-in-properties', PLAYGROUND, ACTIVITY,
    [{ do: 'pointerClick', point: pointAt(element('Check Stock')) }, ...fillAndEnter(propertiesField('Action text'), 'Verify Stock')], ['renameActivityElement']),
  activity('action-renamed-in-place', EDITOR, ACTIVITY,
    renameInPlace('Ship Order', 'Dispatch Order'), ['renameElement', 'renameActivityElement']),
  activity('action-rename-to-a-label-in-use-refused', EDITOR, ACTIVITY,
    [{ do: 'pointerClick', point: pointAt(element('Back Order')) }, ...fillAndEnter(propertiesField('Action text'), 'Ship Order')], ['renameActivityElement']),

  // ---------- activity: flows ----------
  activity('flow-added-with-the-flow-tool', EDITOR, ACTIVITY,
    connectWithTool('Add relation: Flow', 'Back Order', 'Check Stock'), ['handleHitboxClickForRelation']),
  activity('flow-guard-changed-in-the-guard-field', EDITOR, ACTIVITY,
    [selectRoute('rel:2'), ...fillAndEnter(propertiesField('Guard'), 'paid in full')], ['replaceRelationLine']),
  activity('continuation-flow-guard-changed-in-the-guard-field', PLAYGROUND, ACTIVITY,
    [selectRoute('rel:4', 2), ...fillAndEnter(propertiesField('Guard'), 'available')], ['replaceRelationLine']),
  activity('continuation-flow-target-rewired-in-properties', EDITOR, ACTIVITY,
    [selectRoute('rel:4', 2), { do: 'select', target: propertiesField('Target endpoint'), value: 'Back Order' }], ['rewireRelationEndpoint']),
  activity('continuation-flow-invert-refused-from-its-context-menu', EDITOR, ACTIVITY,
    [{ do: 'pointerClick', point: pointAt(segment('rel:4', 2)), button: 'right' }, { do: 'click', target: chooserItem('Invert direction') }], ['invertRelationDirection']),
  activity('implicit-flow-into-a-decision-kept-on-delete', EDITOR, ACTIVITY,
    [{ do: 'focus', target: segment('edge-2') }, { do: 'press', key: 'Enter' }, { do: 'press', key: 'Delete' }], ['deleteSelected']),
  activity('action-a-decision-branch-continues-into-removed-with-the-delete-key', EDITOR, ACTIVITY,
    [deleteWithTheKeyboard('Back Order')], ['deleteSelected']),
  activity('guarded-flow-inverted-in-properties', EDITOR, ACTIVITY,
    [selectRoute('rel:2'), { do: 'click', target: inProperties(button('Invert direction')) }], ['invertRelationDirection']),

  // ---------- activity: layout ----------
  // An activity diagram declares no action, so every drawn position goes into the block.
  activity('action-nudged-with-an-arrow-key', EDITOR, ACTIVITY,
    [nudgeRight('Check Stock')], ['nudgeElement']),
  activity('action-reset-with-reset-selected', EDITOR, ACTIVITY_WITH_CHECK_STOCK_NUDGED,
    [selectWithTheKeyboard('Check Stock'), { do: 'click', target: button('Reset Selected') }], ['resetOneBtn:click']),

  // ---------- use case: elements and membership ----------
  usecase('actor-added-by-a-palette-drop', EDITOR, USECASE,
    [dropTool('Add element: Actor')], ['placeElementAt']),
  usecase('use-case-added-by-arming-the-tool-and-clicking-the-canvas', EDITOR, USECASE,
    armToolThenClickFreePlace('Add element: Use Case'), ['placeElementAt']),
  usecase('system-boundary-added-from-the-empty-use-case-diagram', EDITOR, null,
    [{ do: 'click', target: button('+ System Boundary') }], ['addEmptyElement', 'placeElementAt']),
  usecase('system-boundary-added-with-enter-on-its-palette-button', PLAYGROUND, USECASE,
    [{ do: 'press', target: button('Add element: System Boundary'), key: 'Enter' }], ['addElementWithoutCanvas', 'placeElementAt']),
  usecase('use-case-put-into-a-system-with-its-checkbox', PLAYGROUND, USECASE,
    [{ do: 'press', target: element('Online Shop'), key: 'Enter' }, { do: 'check', target: inProperties({ role: 'checkbox', name: 'Include Track Order' }) }], ['changeSystemMembership']),
  usecase('use-case-taken-out-of-a-system-with-its-checkbox', EDITOR, USECASE,
    [{ do: 'press', target: element('Online Shop'), key: 'Enter' }, { do: 'uncheck', target: inProperties({ role: 'checkbox', name: 'Include Pay' }) }], ['changeSystemMembership']),
  usecase('use-case-inside-a-system-removed-with-the-delete-key', EDITOR, USECASE,
    [deleteWithTheKeyboard('Pay')], ['deleteSelected']),
  usecase('use-case-renamed-in-place', EDITOR, USECASE,
    renameInPlace('Track Order', 'Follow Order'), ['replaceLineForElementId']),
  usecase('actor-renamed-in-place', EDITOR, USECASE,
    renameInPlace('Member', 'Guest'), ['replaceLineForElementId']),

  // ---------- use case: layout and duplicates ----------
  // Actors, use cases, and the boundary are declared: each drawn position goes into its line.
  usecase('use-case-dragged', EDITOR, USECASE,
    [dragBy('Track Order', { x: 0, y: 90 })], ['updateDrag']),
  usecase('use-case-reset-with-reset-selected', EDITOR, USECASE_WITH_TRACK_ORDER_DRAGGED,
    [selectWithTheKeyboard('Track Order'), { do: 'click', target: button('Reset Selected') }], ['resetOneBtn:click']),
  usecase('use-case-inside-a-system-duplicated-with-the-keyboard', EDITOR, USECASE,
    [selectWithTheKeyboard('Pay'), { do: 'press', key: 'ControlOrMeta+d' }], ['duplicateSelected']),
  // Opened near the boundary's top left corner, away from the use cases inside it.
  usecase('system-boundary-that-declares-a-use-case-duplicated-from-its-context-menu', EDITOR, USECASE_DECLARED_INSIDE_A_SYSTEM,
    fromTheContextMenu('Online Shop', { x: 0.05, y: 0.05 }, 'Duplicate'), ['duplicateElement']),

  // ---------- use case: relations ----------
  usecase('association-added-through-the-plus-handle-and-the-chooser', EDITOR, USECASE,
    connectThroughChooser('Member', 'Track Order', 'Association'), ['showRelationChooser']),
  usecase('extend-added-through-the-plus-handle-and-the-chooser', EDITOR, USECASE,
    connectThroughChooser('Cancel Order', 'Track Order', 'extend'), ['showRelationChooser']),
  usecase('include-added-with-the-include-tool', EDITOR, USECASE,
    connectWithTool('Add relation: include', 'Track Order', 'Cancel Order'), ['handleHitboxClickForRelation']),
  // A click on a use case inside a system boundary reaches the boundary's box, which lies over it.
  usecase('include-tool-click-on-a-use-case-inside-a-system-picks-the-system', EDITOR, USECASE,
    connectWithTool('Add relation: include', 'Track Order', 'Pay'), ['handleHitboxClickForRelation']),
  usecase('actor-generalization-added-with-the-generalize-tool', EDITOR, USECASE,
    connectWithTool('Add relation: Generalize', 'Member', 'Customer'), ['handleHitboxClickForRelation']),
  usecase('association-labelled-in-properties', EDITOR, USECASE,
    [selectRouteWithKeyboard('usecase:0'), ...fillAndEnter(propertiesField('Label'), 'places')], ['replaceRelationLine']),
  usecase('association-target-rewired-in-properties', EDITOR, USECASE,
    [selectRouteWithKeyboard('usecase:0'), { do: 'select', target: propertiesField('Target endpoint'), value: 'UC2' }], ['rewireRelationEndpoint']),
  usecase('include-inverted-in-properties', EDITOR, USECASE,
    [selectRouteWithKeyboard('usecase:1'), { do: 'click', target: inProperties(button('Invert direction')) }], ['invertRelationDirection']),
  usecase('include-removed-with-the-delete-key', EDITOR, USECASE,
    [{ do: 'focus', target: segment('usecase:1') }, { do: 'press', key: 'Delete' }], ['deleteSelected']),

  // ---------- boundaries ----------
  // Typed on the playground, whose source is shown. No step advances the clock, so the label is
  // edited on the drawing of the text before the typing.
  state('transition-label-edited-within-the-render-debounce-after-a-line-typed-above-it', PLAYGROUND, STATE, [
    { do: 'fill', target: SOURCE, value: STATE_WITH_A_LINE_TYPED_ABOVE },
    { do: 'pointerDblclick', point: pointAt(segment('edge-2')) },
    { do: 'fill', target: { role: 'textbox', name: 'Edit relation label' }, value: 'complete' },
    { do: 'press', key: 'Enter' },
  ], ['replaceRelationLine']),
  // The harness's Undo after the gesture is the "then Undo".
  state('source-that-fails-to-render-then-undo', PLAYGROUND, STATE,
    [{ do: 'fill', target: SOURCE, value: STATE_WITH_A_MALFORMED_CALLOUT }], []),
];
