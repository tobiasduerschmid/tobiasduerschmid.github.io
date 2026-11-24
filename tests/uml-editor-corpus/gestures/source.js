'use strict';
/**
 * Family `source` (plan Task 8; spec 2026-11-12 §3.4 "Raw source", §3.5, §9.2): the forms that edit
 * the document by its lines and stay in the classic host, and the host's own document loads.
 * - Line-model panels: every preset of `addLineModelPreset` (its eight write sites), a git graph's
 *   branch and commit rows, and a row replaced, deleted, and moved in each of the git graph, folder
 *   tree, Venn, entity-relationship, and freeform panels; the quick-insert buttons of a lifeline.
 * - Callouts on each of the seven UML types: created, edited, and removed through the callouts panel
 *   (`commitSource`), each entered another way, and one dragged onto the nearest label.
 * - Loads: the scaffold of an emptied document, Reset to the starter (confirmed and cancelled), a
 *   stored draft restored at load, and the autosave indicator after an edit.
 *
 * The git graph, folder tree, and Venn panels show on every page; the entity-relationship and
 * freeform panels ("Advanced source rows") only where the ArchUML source is hidden, the UML editor
 * page. A panel's disclosure closes whenever the drawing is made again, so a step opens it first.
 */

const { WINDOWS } = require('../clock');

const PLAYGROUND = '/SEBook/tools/uml-playground';
const UML_EDITOR = '/SEBook/tools/uml-editor';
const HOMEWORK = '/SEBook/designpatterns/monopoly-state-pattern-uml-homework';

/** A document of these lines between `@startuml` and `@enduml`. */
function doc(...lines) {
  return ['@startuml', ...lines, '@enduml'].join('\n');
}

// ---------- targets and steps ----------

const button = (name) => ({ role: 'button', name });
const click = (target) => ({ do: 'click', target });
const fill = (target, value) => ({ do: 'fill', target, value });
const select = (target, value) => ({ do: 'select', target, value });
const press = (target, key) => ({ do: 'press', target, key });
/** The hit target of a drawn element, as the canvas names it. */
const element = (label) => button(`Element ${label} — Enter to select, arrows to nudge, Delete to remove`);
const SOURCE = { role: 'textbox', name: 'ArchUML diagram source' };
const PREVIEW = { role: 'region', name: 'Diagram preview' };

/** Opens a line-model panel's disclosure by its summary ("Git graph model (6 rows)"). */
const openModelRows = (heading) => click({ text: `${heading} (`, exact: false });
const GIT_GRAPH_ROWS = 'Git graph model';
const FOLDER_TREE_ROWS = 'Folder tree model';
const VENN_ROWS = 'Venn model';
const ADVANCED_ROWS = 'Advanced source rows';

/** Types `value` into a row's field and commits it with Enter (`replaceLineModelRow`). */
const replaceRow = (rowLabel, value) => [
  fill({ label: rowLabel }, value),
  press({ label: rowLabel }, 'Enter'),
];

// Callouts panel controls (spec §3.7 ids, reached by their labels and names).
const CALLOUT_TARGET = { label: 'Callout target' };
const CALLOUT_SIDE = { label: 'Preferred position' };
const SAVED_CALLOUT = { label: 'Saved callout' };
const EXPLANATION = { label: 'Explanation' };
const openCallouts = () => click(button('Callouts'));
/** The drawn callout, which the callout drag script makes a button. */
const drawnCallout = (text) => button(`Edit callout: ${text}`);
// `.uml-callout-box` is a stable hook of ArchUML's teaching callouts (js/ArchUML/REFERENCE.md).
const CALLOUT_BOX = { css: '.uml-callout-box' };

// ---------- documents ----------

const GIT_GRAPH = doc(
  'branch main:',
  '  A "Initial commit"',
  '  B "Add README"',
  'branch feature from A:',
  '  C "Start feature"',
  'head main',
);
const FOLDER_TREE = doc('project/', '  src/', '    main.js', '  README.md');
const VENN = doc(
  'title Web',
  'set Frontend',
  'set Backend',
  'Frontend : React',
  'Frontend & Backend : Next.js',
  'outside : Docker',
);
const ENTITY_RELATIONSHIP = doc(
  'title Library',
  'entity Student',
  'entity Book',
  'relationship Borrows',
  'Student "N" -- Borrows',
  'Book "M" -- Borrows',
);
const FREEFORM = doc('box "Draft" as draft', 'box round "Review" as review', 'draft --> review : submit');
const SEQUENCE = doc('participant Client', 'participant Server', 'Client -> Server : request');

/** The models the callouts are attached to, one per UML type, with the target each callout names. */
const CALLOUT_MODELS = {
  class: {
    lines: ['class Account {', '+ balance: Money', '}', 'class Money', 'Account --> Money'],
    target: 'element Account',
    label: 'Account',
  },
  sequence: {
    lines: ['participant Client', 'participant Server', 'Client -> Server : request'],
    target: 'text "Client"',
    label: 'Client',
  },
  state: { lines: ['state Idle', 'state Running', 'Idle --> Running : start'], target: 'element Idle', label: 'Idle' },
  component: {
    lines: ['component Service', 'component Store', 'Service --> Store'],
    target: 'element Service',
    label: 'Service',
  },
  deployment: { lines: ['node Server', 'node Database', 'Server --> Database'], target: 'element Server', label: 'Server' },
  usecase: { lines: ['actor User', 'usecase Login', 'User --> Login'], target: 'element User', label: 'User' },
  activity: { lines: ['(*) --> "Validate"', '"Validate" --> (*)'], target: 'text "Validate"', label: 'Validate' },
};
const SAVED_EXPLANATION = 'Explains this notation';

/** The type's model with one saved callout on its target. */
function modelWithCallout(type) {
  const model = CALLOUT_MODELS[type];
  return doc(...model.lines, `callout right of ${model.target} : ${SAVED_EXPLANATION}`);
}

// ---------- gestures ----------

function gesture(id, { type, page = PLAYGROUND, start, steps, covers }) {
  return { id, family: 'source', type, page, start, steps, covers };
}

const linePresets = [
  gesture('git-graph-head-added-with-the-head-preset', {
    type: 'gitgraph', start: GIT_GRAPH,
    steps: [openModelRows(GIT_GRAPH_ROWS), click(button('+ HEAD'))],
    covers: ['addLineModelPreset'],
  }),
  // Boundary: the HEAD preset on an empty git graph first adds the branch it points at.
  gesture('git-graph-head-added-to-an-empty-git-graph-adds-branch-main', {
    type: 'gitgraph', start: doc(),
    steps: [openModelRows(GIT_GRAPH_ROWS), click(button('+ HEAD'))],
    covers: ['addLineModelPreset'],
  }),
  gesture('folder-tree-folder-added-with-the-folder-preset', {
    type: 'folder-tree', start: FOLDER_TREE,
    steps: [openModelRows(FOLDER_TREE_ROWS), click(button('+ Folder'))],
    covers: ['addLineModelPreset'],
  }),
  gesture('folder-tree-file-added-with-the-file-preset', {
    type: 'folder-tree', start: FOLDER_TREE,
    steps: [openModelRows(FOLDER_TREE_ROWS), click(button('+ File'))],
    covers: ['addLineModelPreset'],
  }),
  // Boundaries: a document without @enduml, and one without either marker (the scaffold wraps it).
  gesture('folder-tree-file-added-to-a-document-without-enduml', {
    type: 'folder-tree', start: '@startuml\nproject/\n  notes.txt',
    steps: [openModelRows(FOLDER_TREE_ROWS), click(button('+ File'))],
    covers: ['addLineModelPreset'],
  }),
  gesture('folder-tree-file-added-to-a-document-without-startuml-or-enduml', {
    type: 'folder-tree', start: 'project/\n  notes.txt',
    steps: [openModelRows(FOLDER_TREE_ROWS), click(button('+ File'))],
    covers: ['addLineModelPreset'],
  }),
  gesture('venn-set-added-with-the-set-preset', {
    type: 'venn', start: VENN,
    steps: [openModelRows(VENN_ROWS), click(button('+ Set'))],
    covers: ['addLineModelPreset'],
  }),
  gesture('venn-region-added-with-the-region-preset', {
    type: 'venn', start: VENN,
    steps: [openModelRows(VENN_ROWS), click(button('+ Region'))],
    covers: ['addLineModelPreset'],
  }),
  gesture('venn-outside-item-added-with-the-outside-preset', {
    type: 'venn', start: VENN,
    steps: [openModelRows(VENN_ROWS), click(button('+ Outside'))],
    covers: ['addLineModelPreset'],
  }),
  gesture('venn-title-added-with-the-title-preset', {
    type: 'venn', start: VENN,
    steps: [openModelRows(VENN_ROWS), click(button('+ Title'))],
    covers: ['addLineModelPreset'],
  }),
  // The page's own empty document: the UML editor page starts empty.
  gesture('entity-relationship-title-added-to-the-empty-page-document', {
    type: 'er', page: UML_EDITOR, start: null,
    steps: [openModelRows(ADVANCED_ROWS), click(button('+ Title'))],
    covers: ['addLineModelPreset'],
  }),
  gesture('entity-relationship-row-added-with-the-row-preset', {
    type: 'er', page: UML_EDITOR, start: ENTITY_RELATIONSHIP,
    steps: [openModelRows(ADVANCED_ROWS), click(button('+ Row'))],
    covers: ['addLineModelPreset'],
  }),
  gesture('freeform-row-added-with-the-row-preset', {
    type: 'freeform', page: UML_EDITOR, start: FREEFORM,
    steps: [openModelRows(ADVANCED_ROWS), click(button('+ Row'))],
    covers: ['addLineModelPreset'],
  }),
];

const gitGraphRows = [
  gesture('git-graph-branch-added-with-a-unique-name', {
    type: 'gitgraph', start: GIT_GRAPH,
    steps: [openModelRows(GIT_GRAPH_ROWS), click(button('+ Branch'))],
    covers: ['addGitgraphBranchRow'],
  }),
  // Boundary: the first branch of a git graph is main.
  gesture('git-graph-branch-added-to-an-empty-git-graph-is-main', {
    type: 'gitgraph', start: doc(),
    steps: [openModelRows(GIT_GRAPH_ROWS), click(button('+ Branch'))],
    covers: ['addGitgraphBranchRow'],
  }),
  gesture('git-graph-commit-added-to-the-end-of-the-first-branch', {
    type: 'gitgraph', start: GIT_GRAPH,
    steps: [openModelRows(GIT_GRAPH_ROWS), click(button('+ Commit'))],
    covers: ['addGitgraphCommitRow'],
  }),
  // Boundary: a commit in an empty git graph starts branch main.
  gesture('git-graph-commit-added-to-an-empty-git-graph-starts-branch-main', {
    type: 'gitgraph', start: doc(),
    steps: [openModelRows(GIT_GRAPH_ROWS), click(button('+ Commit'))],
    covers: ['addGitgraphCommitRow'],
  }),
];

/** A row replaced, deleted, and moved up in one line-model panel. */
function rowEdits(prefix, { type, page = PLAYGROUND, start, heading, replace, remove, moveUp }) {
  return [
    gesture(`${prefix}-row-replaced-in-the-model-panel`, {
      type, page, start,
      steps: [openModelRows(heading), ...replaceRow(replace.row, replace.value)],
      covers: ['replaceLineModelRow'],
    }),
    gesture(`${prefix}-row-deleted-in-the-model-panel`, {
      type, page, start,
      steps: [openModelRows(heading), click(button(remove))],
      covers: ['deleteLineModelRow'],
    }),
    gesture(`${prefix}-row-moved-up-in-the-model-panel`, {
      type, page, start,
      steps: [openModelRows(heading), click(button(moveUp))],
      covers: ['moveLineModelRow'],
    }),
  ];
}

// Rows are named by the kind the panel infers for them and their place among the rows.
const rowEditGestures = [
  ...rowEdits('git-graph', {
    type: 'gitgraph', start: GIT_GRAPH, heading: GIT_GRAPH_ROWS,
    replace: { row: 'Commit row 3', value: '  B "Add the README"' },
    remove: 'Delete commit row 5',
    moveUp: 'Move commit row 3 up',
  }),
  ...rowEdits('folder-tree', {
    type: 'folder-tree', start: FOLDER_TREE, heading: FOLDER_TREE_ROWS,
    replace: { row: 'File row 3', value: '    app.js' },
    remove: 'Delete file row 4',
    moveUp: 'Move file row 4 up',
  }),
  ...rowEdits('venn', {
    type: 'venn', start: VENN, heading: VENN_ROWS,
    replace: { row: 'Set row 3', value: 'set Server' },
    remove: 'Delete outside row 6',
    moveUp: 'Move set row 3 up',
  }),
  ...rowEdits('entity-relationship', {
    type: 'er', page: UML_EDITOR, start: ENTITY_RELATIONSHIP, heading: ADVANCED_ROWS,
    replace: { row: 'Title row 1', value: 'title Library loans' },
    remove: 'Delete relation row 6',
    moveUp: 'Move entity row 3 up',
  }),
  ...rowEdits('freeform', {
    type: 'freeform', page: UML_EDITOR, start: FREEFORM, heading: ADVANCED_ROWS,
    // A row of no named kind is a "Model row", so its field is "Model row row 1".
    replace: { row: 'Model row row 1', value: 'box "First draft" as draft' },
    remove: 'Delete relation row 3',
    moveUp: 'Move model row row 2 up',
  }),
  // Boundary: a line typed above the rows, then within the 120 ms render debounce a row deleted.
  // The panel still shows the rows of the last drawing, and the deletion applies its line number
  // to the text as typed.
  gesture('git-graph-row-deleted-within-the-render-debounce-after-a-line-typed-above-it', {
    type: 'gitgraph', start: GIT_GRAPH,
    steps: [
      openModelRows(GIT_GRAPH_ROWS),
      fill(SOURCE, doc(
        'branch main:',
        '  Z "Typed commit"',
        '  A "Initial commit"',
        '  B "Add README"',
        'branch feature from A:',
        '  C "Start feature"',
        'head main',
      )),
      click(button('Delete commit row 5')),
    ],
    covers: ['deleteLineModelRow'],
  }),
];

// The quick-insert buttons of a selected lifeline's Properties (`makeQuickInsertButton`).
const quickInserts = [
  ['activate', 'Client', 'Add an activate Client bar'],
  ['deactivate', 'Client', 'Add a deactivate Client marker'],
  ['destroy', 'Server', 'Mark Server as destroyed (X)'],
].map(([line, lifeline, name]) => gesture(`sequence-${line}-line-inserted-from-the-lifeline-properties`, {
  type: 'sequence', start: SEQUENCE,
  steps: [press(element(lifeline), 'Enter'), click(button(name))],
  covers: ['makeQuickInsertButton'],
}));

// ---------- callouts ----------

// Ways into a new callout, each `{ phrase, steps(type) }`: the toolbar's Callouts button, a drawn
// element's context menu, and the Properties pane of the selected element.
const NEW_CALLOUT = {
  toolbar: {
    phrase: 'from-the-callouts-button',
    steps: (type) => [openCallouts(), select(CALLOUT_TARGET, CALLOUT_MODELS[type].target)],
  },
  contextMenu: {
    phrase: 'from-the-element-context-menu',
    steps: (type) => [
      { do: 'pointerClick', point: { target: element(CALLOUT_MODELS[type].label) }, button: 'right' },
      click({ role: 'menuitem', name: 'Add callout' }),
    ],
  },
  properties: {
    phrase: 'from-the-element-properties',
    steps: (type) => [press(element(CALLOUT_MODELS[type].label), 'Enter'), click(button('Add teaching callout'))],
  },
};
// Ways into a saved callout: the panel's Saved callout list, Enter on the drawn callout, and a
// click on it.
const SAVED_CALLOUT_WAYS = {
  savedList: { phrase: 'from-the-saved-callout-list', steps: () => [openCallouts(), select(SAVED_CALLOUT, '0')] },
  enter: { phrase: 'by-enter-on-the-drawn-callout', steps: () => [press(drawnCallout(SAVED_EXPLANATION), 'Enter')] },
  click: { phrase: 'by-clicking-the-drawn-callout', steps: () => [{ do: 'pointerClick', point: { target: CALLOUT_BOX } }] },
};

// One row per UML type: how its callout is created, edited, and removed.
const CALLOUT_WAYS_BY_TYPE = [
  ['class', { create: 'toolbar', edit: 'savedList', remove: 'savedList' }],
  ['sequence', { create: 'contextMenu', edit: 'enter', remove: 'enter' }],
  ['state', { create: 'properties', edit: 'click', remove: 'savedList' }],
  ['component', { create: 'toolbar', edit: 'savedList', remove: 'enter' }],
  ['deployment', { create: 'contextMenu', edit: 'enter', remove: 'savedList' }],
  ['usecase', { create: 'properties', edit: 'savedList', remove: 'click' }],
  ['activity', { create: 'toolbar', edit: 'enter', remove: 'savedList' }],
];

const callouts = CALLOUT_WAYS_BY_TYPE.flatMap(([type, ways]) => {
  const create = NEW_CALLOUT[ways.create];
  const edit = SAVED_CALLOUT_WAYS[ways.edit];
  const remove = SAVED_CALLOUT_WAYS[ways.remove];
  return [
    gesture(`${type}-callout-created-${create.phrase}`, {
      type, start: doc(...CALLOUT_MODELS[type].lines),
      steps: [
        ...create.steps(type),
        fill(EXPLANATION, `Why ${CALLOUT_MODELS[type].label} matters`),
        click(button('Add callout')),
      ],
      covers: ['commitSource'],
    }),
    gesture(`${type}-callout-edited-${edit.phrase}`, {
      type, start: modelWithCallout(type),
      steps: [
        ...edit.steps(),
        fill(EXPLANATION, 'Explains this notation in more detail'),
        select(CALLOUT_SIDE, 'left'),
        click(button('Save callout')),
      ],
      covers: ['commitSource'],
    }),
    // Remove is pressed with the keyboard: a pointer resting where the button was can land on a
    // toolbar button once the panel shrinks, and that button's tooltip would cover Undo.
    gesture(`${type}-callout-removed-${remove.phrase}`, {
      type, start: modelWithCallout(type),
      steps: [...remove.steps(), press(button('Remove callout'), 'Enter')],
      covers: ['commitSource'],
    }),
  ];
});

// Boundary: a callout saved within the 120 ms render debounce after the source was typed is refused:
// nothing is written, and the typed text stays as it is. (The refusal's words are gone by the time
// the page is observed: the render that the debounce runs clears the panel's status.)
const calloutDuringRender = gesture('class-callout-saved-within-the-render-debounce-after-typing-is-refused', {
  type: 'class', start: doc(...CALLOUT_MODELS.class.lines),
  steps: [
    openCallouts(),
    select(CALLOUT_TARGET, CALLOUT_MODELS.class.target),
    fill(EXPLANATION, 'Why Account matters'),
    fill(SOURCE, doc(...CALLOUT_MODELS.class.lines, 'class Ledger')),
    click(button('Add callout')),
  ],
  covers: [],
});

// Dropped on a label, the callout attaches to the nearest target there.
const calloutDrag = gesture('class-callout-dragged-onto-the-nearest-label', {
  type: 'class', start: modelWithCallout('class'),
  steps: [{
    do: 'drag',
    from: { target: CALLOUT_BOX },
    to: { target: { text: 'Money', exact: true, within: PREVIEW } },
  }],
  covers: ['commitSource'],
});

// ---------- loads ----------

const CLASS_DRAFT = doc('class Order', 'class Customer', 'Customer --> Order : places');

const loads = [
  // Emptying the source leaves the empty document's scaffold (`renderDiagram`).
  gesture('emptied-source-gets-the-empty-document-scaffold', {
    type: 'class', start: CLASS_DRAFT,
    steps: [fill(SOURCE, '')],
    covers: ['renderDiagram'],
  }),
  gesture('reset-loads-the-example-after-confirmation', {
    type: 'class', start: CLASS_DRAFT,
    steps: [click(button('↺ Example')), click(button('Load example'))],
    covers: ['resetCurrentDiagramToStarter'],
  }),
  gesture('reset-empties-the-diagram-after-confirmation-on-the-uml-editor-page', {
    type: 'class', page: UML_EDITOR, start: CLASS_DRAFT,
    steps: [click(button('↺ Empty')), click(button('Empty diagram'))],
    covers: ['resetCurrentDiagramToStarter'],
  }),
  // Boundary: a reset the learner cancels changes nothing.
  gesture('reset-cancelled-keeps-the-draft', {
    type: 'class', start: CLASS_DRAFT,
    steps: [click(button('↺ Example')), click(button('Cancel'))],
    covers: [],
  }),
  gesture('stored-draft-restored-at-load-on-the-playground', {
    type: 'class', start: { draft: CLASS_DRAFT },
    steps: [{ do: 'reload' }],
    covers: ['init'],
  }),
  gesture('stored-draft-restored-at-load-on-the-homework-page', {
    type: 'class', page: HOMEWORK, start: { draft: CLASS_DRAFT },
    steps: [{ do: 'reload' }],
    covers: ['init'],
  }),
  // A typed edit (no write site: the learner's own input) is saved and says so. Typing renders
  // after the debounce, and that render starts the autosave delay again; so the clock runs one
  // debounce further before the observation, which waits out the autosave delay itself.
  gesture('autosave-indicator-shows-saved-after-an-edit', {
    type: 'class', start: CLASS_DRAFT,
    steps: [
      fill(SOURCE, doc('class Order', 'class Customer', 'class Invoice', 'Customer --> Order : places')),
      { do: 'advance', ms: WINDOWS.renderDebounceMs },
    ],
    covers: [],
  }),
];

// Ruling U-W10 (2026-11-15): two canvas gestures on these diagram types that only the drawing reaches.
// The folder-tree palette drop is the one write of placeElementAt with an undo key
// (`folder-tree-add`): two drops inside the coalescing window are one undo step. Reset Selected on a
// git-graph branch label is the `branch-label` half of its label branch, which writes no `branch:` position.
const canvasGestures = [
  gesture('folder-tree-folder-and-file-dropped-from-the-palette-inside-the-coalescing-window', {
    type: 'folder-tree', page: UML_EDITOR, start: FOLDER_TREE,
    steps: [
      { do: 'drag', from: { target: button('Add element: Folder') }, to: { target: { css: '#uml-pg-output svg' }, at: { x: 0.9, y: 0.9 } } },
      { do: 'drag', from: { target: button('Add element: File') }, to: { target: { css: '#uml-pg-output svg' }, at: { x: 0.8, y: 0.9 } } },
    ],
    covers: ['placeElementAt'],
  }),
  gesture('git-graph-branch-label-reset-with-reset-selected', {
    type: 'gitgraph', page: UML_EDITOR, start: GIT_GRAPH,
    steps: [
      { do: 'press', target: { role: 'button', name: 'Label main', exact: false }, key: 'Enter' },
      { do: 'click', target: button('Reset Selected') },
    ],
    covers: ['resetOneBtn:click'],
  }),
];

module.exports = [
  ...linePresets,
  ...gitGraphRows,
  ...rowEditGestures,
  ...quickInserts,
  ...callouts,
  calloutDuringRender,
  calloutDrag,
  ...loads,
  ...canvasGestures,
];
