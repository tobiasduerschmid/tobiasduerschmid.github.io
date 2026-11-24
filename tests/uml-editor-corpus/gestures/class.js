'use strict';
// Family `class` (plan Task 4): the gestures of class diagrams and CRC cards, recorded at stage R0.
// Each gesture names the functions of spec §3.5 it reaches in `covers` (an empty list: the gesture
// ends before any of them, a cancelled form for one). Most gestures draw on the UML editor page,
// whose preview is wide enough to show every box of the start documents below; the playground
// (persistence, a visible source) and the Monopoly homework (a tutorial's storage key) carry the
// gestures that need them. Positions are pinned with `@pos`, so every point read from the drawing
// is the same in every run.

const EDITOR = '/SEBook/tools/uml-editor';
const PLAYGROUND = '/SEBook/tools/uml-playground';
const HOMEWORK = '/SEBook/designpatterns/monopoly-state-pattern-uml-homework';

const lines = (...rows) => rows.join('\n');

// Three classes, no relations.
const THREE_CLASSES = lines(
  '@startuml',
  'class Order @pos(80, 80) { -id: int; +total(): float }',
  'class Customer @pos(360, 80) { +name: str }',
  'class Invoice @pos(80, 300)',
  '@enduml',
);
// The three classes and an interface, for the six relation kinds.
const WITH_INTERFACE = lines(
  '@startuml',
  'class Order @pos(80, 80) { -id: int; +total(): float }',
  'class Customer @pos(360, 80) { +name: str }',
  'class Invoice @pos(80, 300)',
  'interface Payable @pos(360, 300) { +pay(): bool }',
  '@enduml',
);
// The three classes with a dependency and an association. A route id `rel:N` names the relation's
// line counted from 0 (`@startuml` is line 0): the dependency is `rel:4`, the association `rel:5`.
const WITH_RELATIONS = lines(
  '@startuml',
  'class Order @pos(80, 80) { -id: int; +total(): float }',
  'class Customer @pos(360, 80) { +name: str }',
  'class Invoice @pos(80, 300)',
  'Order ..> Invoice : creates',
  'Customer "1" -- "*" Order : places',
  '@enduml',
);
// WITH_RELATIONS with a line typed above the dependency's line, so line 4 (from 0) is that new
// line and the dependency moves to line 5.
const WITH_A_LINE_ABOVE_THE_DEPENDENCY = lines(
  '@startuml',
  'class Order @pos(80, 80) { -id: int; +total(): float }',
  'class Customer @pos(360, 80) { +name: str }',
  'class Invoice @pos(80, 300)',
  'class Payment',
  'Order ..> Invoice : creates',
  'Customer "1" -- "*" Order : places',
  '@enduml',
);
// The dependency of WITH_RELATIONS after its bend was dragged: stored bends in an `@layout` block.
const WITH_A_BENT_DEPENDENCY = lines(
  '@startuml',
  '@layout schema=1 renderer="archuml-visual-editor"',
  'edge "rel:4" points="80,138 30,138 30,256 80,256"',
  '@endlayout',
  'class Order @pos(30, 36) { -id: int; +total(): float }',
  'class Customer @pos(310, 36) { +name: str }',
  'class Invoice @pos(30, 256)',
  'Order ..> Invoice : creates',
  'Customer "1" -- "*" Order : places',
  '@enduml',
);
// Two generalizations into one superclass: the renderer draws a shared trunk (`edge-0`).
const GENERALIZATION_TREE = lines(
  '@startuml',
  'abstract class Animal @pos(160, 40)',
  'class Dog @pos(40, 240)',
  'class Cat @pos(280, 240)',
  'Dog --|> Animal',
  'Cat --|> Animal',
  '@enduml',
);
// A class whose members span lines; a Properties edit writes the declaration again.
const MULTILINE_BODY = lines(
  '@startuml',
  'class Order @pos(80, 80) {',
  '  -id: int',
  '  +total(): float',
  '}',
  'class Customer @pos(360, 80)',
  '@enduml',
);
const QUOTED_AND_NAMESPACED = lines(
  '@startuml',
  'class "Line Item" @pos(40, 60) { +quantity: int }',
  'class shop::Order @pos(260, 60) { +lines: List<Line Item> }',
  '@enduml',
);
const GENERIC_MEMBER_TYPES = lines(
  '@startuml',
  'class Item @pos(40, 60) { +name: str }',
  'class Cart @pos(260, 60) { -items: List<Item>; +add(item: Item): void }',
  'Cart o-- Item',
  '@enduml',
);
const INLINE_POS_AND_LAYOUT_BLOCK = lines(
  '@startuml',
  '@layout schema=1 renderer="archuml-visual-editor"',
  'node "Customer" x=360 y=80',
  '@endlayout',
  'class Order @pos(80, 80)',
  'class Customer',
  'Order --> Customer',
  '@enduml',
);
const TWO_CARDS = lines(
  '@startuml',
  'card Cart @pos(40, 40) {',
  '  responsibility: Know selected products',
  '  collaborator: Catalog',
  '}',
  'card Catalog @pos(40, 300) {',
  '  responsibility: Provide current prices',
  '}',
  '@enduml',
);

// ---------- targets and points ----------

const button = (name) => ({ role: 'button', name });
const menuItem = (name) => ({ role: 'menuitem', name });
const field = (label) => ({ label });
// The keyboard target of a box (an `.uml-pg-edit-a11y-target`), named by the editor.
const box = (name) => button(`Element ${name} — Enter to select, arrows to nudge, Delete to remove`);
const segment = (routeId, number = 1) => button(`Relation segment ${number} of ${routeId} — Enter to select, Delete to remove`);
// A point inside a box, as fractions of its width and height.
const inBox = (name, x = 0.5, y = 0.5) => ({ target: box(name), at: { x, y } });
const besideBox = (name, offset) => ({ target: box(name), offset });
const extendHandle = (name) => ({ target: button(`Extend a relation from ${name}`) });
const renameField = (name) => ({ role: 'textbox', name: `Rename ${name}` });

function classGesture(id, page, start, steps, covers) {
  return { id, family: 'class', type: 'class', page, start, steps, covers };
}

function crcGesture(id, steps, covers) {
  return { id, family: 'class', type: 'crc', page: EDITOR, start: TWO_CARDS, steps, covers };
}

function renamedInPlace(id, start, point, oldName, newName, covers) {
  return classGesture(id, EDITOR, start, [
    { do: 'pointerDblclick', point },
    { do: 'fill', target: renameField(oldName), value: newName },
    { do: 'press', target: renameField(oldName), key: 'Enter' },
  ], covers);
}

// A connect drag from the "+" handle of `from` onto `to`, then the relation chooser's item.
function addedThroughTheChooser(kind, from, to) {
  return classGesture(`${kind.toLowerCase()}-added-through-the-relation-chooser`, EDITOR, WITH_INTERFACE, [
    { do: 'drag', from: extendHandle(from), to: inBox(to) },
    { do: 'click', target: menuItem(kind) },
  ], ['showRelationChooser']);
}

// The palette's relation tool, then a click on the source and one on the target.
function addedWithTheRelationTool(kind, from, to) {
  return classGesture(`${kind.toLowerCase()}-added-with-the-selected-relation-tool`, EDITOR, WITH_INTERFACE, [
    { do: 'click', target: button(`Add relation: ${kind}`) },
    { do: 'pointerClick', point: inBox(from) },
    { do: 'pointerClick', point: inBox(to) },
  ], ['handleHitboxClickForRelation']);
}

// Selects the association `rel:5` with the keyboard, then edits one Properties field.
function associationEditedInProperties(id, steps) {
  return classGesture(id, EDITOR, WITH_RELATIONS, [
    { do: 'press', target: segment('rel:5'), key: 'Enter' },
    ...steps,
  ], ['replaceRelationLine']);
}

function selectedThenEdited(id, page, start, name, fieldLabel, value, covers) {
  return classGesture(id, page, start, [
    { do: 'press', target: box(name), key: 'Enter' },
    { do: 'fill', target: field(fieldLabel), value },
    { do: 'press', target: field(fieldLabel), key: 'Enter' },
  ], covers);
}

// Eight nudges half a second apart: each joins the undo step of the nudges before it until 3 s
// have passed since the first, and the nudges from then on start a new undo step.
const NUDGE_BURST = Array.from({ length: 8 }, (_, index) => [
  ...(index ? [{ do: 'advance', ms: 500 }] : []),
  { do: 'press', target: box('Invoice'), key: 'ArrowRight' },
]).flat();

// ---------- layout ----------

const layout = [
  classGesture('class-layout-chosen-in-the-layout-select', PLAYGROUND, THREE_CLASSES, [
    { do: 'select', target: field('Layout:'), value: 'landscape' },
  ], ['layoutSelect:change']),
  // Released below Customer's centre: the smart guide aligns the two centres.
  classGesture('class-dragged-until-a-smart-guide-aligns-it', EDITOR, THREE_CLASSES, [
    { do: 'drag', from: inBox('Invoice'), to: besideBox('Customer', { x: 0, y: 200 }) },
  ], ['updateDrag']),
  classGesture('class-nudged-twice-inside-the-coalescing-window', EDITOR, THREE_CLASSES, [
    { do: 'press', target: box('Invoice'), key: 'ArrowRight' },
    { do: 'press', target: box('Invoice'), key: 'ArrowRight' },
  ], ['nudgeElement']),
  classGesture('class-nudge-burst-beyond-the-three-second-cap', EDITOR, THREE_CLASSES, NUDGE_BURST, ['nudgeElement']),
  classGesture('class-position-reset-with-reset-selected', EDITOR, THREE_CLASSES, [
    { do: 'press', target: box('Invoice'), key: 'Enter' },
    { do: 'click', target: button('Reset Selected') },
  ], ['resetOneBtn:click']),
  classGesture('class-route-bends-reset-with-reset-selected', EDITOR, WITH_A_BENT_DEPENDENCY, [
    { do: 'press', target: segment('rel:4', 2), key: 'Enter' },
    { do: 'click', target: button('Reset Selected') },
  ], ['resetOneBtn:click']),
  classGesture('class-layout-cleared-with-reset-layout', EDITOR, WITH_RELATIONS, [
    { do: 'click', target: button('Reset Layout') },
  ], ['resetLayoutBtn:click']),
  classGesture('class-dependency-bend-dragged', EDITOR, WITH_RELATIONS, [
    { do: 'drag', from: { target: segment('rel:4') }, to: { target: segment('rel:4'), offset: { x: -60, y: 0 } } },
  ], ['updateDrag']),
];

// ---------- elements ----------

const elements = [
  classGesture('class-added-by-a-palette-drop', EDITOR, THREE_CLASSES, [
    { do: 'drag', from: { target: button('Add element: Class') }, to: besideBox('Invoice', { x: 240, y: 0 }) },
  ], ['placeElementAt']),
  classGesture('interface-added-by-a-palette-click-then-a-canvas-click', EDITOR, THREE_CLASSES, [
    { do: 'click', target: button('Add element: Interface') },
    { do: 'pointerClick', point: besideBox('Invoice', { x: 240, y: 0 }) },
  ], ['placeElementAt']),
  classGesture('abstract-class-added-with-the-space-key-on-an-empty-canvas', PLAYGROUND, lines('@startuml', '@enduml'), [
    { do: 'press', target: button('Add element: Abstract'), key: ' ' },
  ], ['addElementWithoutCanvas']),
  classGesture('enum-added-with-the-enter-key-on-a-populated-canvas', PLAYGROUND, THREE_CLASSES, [
    { do: 'press', target: button('Add element: Enum'), key: 'Enter' },
  ], ['addElementWithoutCanvas']),
  classGesture('class-diagram-started-with-the-starter-hierarchy', EDITOR, null, [
    { do: 'click', target: button('+ Starter hierarchy') },
  ], ['addClassStarter']),
  classGesture('enum-added-from-the-empty-class-diagram-actions', EDITOR, null, [
    { do: 'click', target: button('+ Enum') },
  ], ['addEmptyElement']),
  renamedInPlace('class-renamed-by-double-clicking-its-header', THREE_CLASSES, inBox('Order', 0.5, 0.15), 'Order', 'Purchase', ['renameElement']),
  classGesture('class-renamed-from-the-class-editing-bar', EDITOR, THREE_CLASSES, [
    { do: 'press', target: box('Invoice'), key: 'Enter' },
    { do: 'click', target: button('Rename class') },
    { do: 'fill', target: renameField('Invoice'), value: 'Bill' },
    { do: 'press', target: renameField('Invoice'), key: 'Enter' },
  ], ['renameElement']),
  renamedInPlace('class-rename-to-an-empty-name-changes-nothing', THREE_CLASSES, inBox('Invoice'), 'Invoice', '', []),
  renamedInPlace('class-rename-to-a-taken-name-is-refused', THREE_CLASSES, inBox('Invoice'), 'Invoice', 'Order', ['renameElement']),
  selectedThenEdited('class-rename-to-a-taken-name-in-properties-is-refused', PLAYGROUND, THREE_CLASSES,
    'Invoice', 'Name (id)', 'Customer', ['replaceClassDeclaration']),
  classGesture('class-made-abstract-in-properties', PLAYGROUND, THREE_CLASSES, [
    { do: 'press', target: box('Order'), key: 'Enter' },
    { do: 'select', target: field('Kind'), value: 'abstract' },
  ], ['replaceClassDeclaration']),
  selectedThenEdited('class-stereotype-set-in-properties', PLAYGROUND, THREE_CLASSES,
    'Customer', 'Stereotype (e.g. <<service>>)', 'entity', ['replaceClassDeclaration']),
  // On a class diagram the Properties fields write the whole declaration again through
  // replaceClassDeclaration; replaceLineForElementId has no caller on a class or CRC diagram.
  selectedThenEdited('class-highlight-set-in-properties-rebuilds-its-declaration', PLAYGROUND, MULTILINE_BODY,
    'Order', 'Highlight color (#hex or color name)', 'lightyellow', ['replaceClassDeclaration']),
  classGesture('class-duplicated-from-its-context-menu', EDITOR, THREE_CLASSES, [
    { do: 'pointerClick', point: inBox('Invoice'), button: 'right' },
    { do: 'click', target: menuItem('Duplicate') },
  ], ['duplicateElement']),
  classGesture('class-multi-selection-duplicated-with-the-keyboard', EDITOR, THREE_CLASSES, [
    { do: 'pointerClick', point: inBox('Order') },
    { do: 'pointerClick', point: inBox('Invoice'), modifiers: ['ControlOrMeta'] },
    { do: 'press', key: 'ControlOrMeta+d' },
  ], ['duplicateSelected']),
  classGesture('class-multi-selection-made-with-ctrl-or-cmd-click-deleted', EDITOR, WITH_RELATIONS, [
    { do: 'pointerClick', point: inBox('Order') },
    { do: 'pointerClick', point: inBox('Invoice'), modifiers: ['ControlOrMeta'] },
    { do: 'press', key: 'Delete' },
  ], ['deleteSelected']),
  // Shift+drag from above Order's top left corner to below Customer's bottom right corner.
  classGesture('class-multi-selection-made-with-the-marquee-deleted', EDITOR, WITH_RELATIONS, [
    {
      do: 'drag',
      modifiers: ['Shift'],
      from: { target: box('Order'), at: { x: 0, y: 0 }, offset: { x: -30, y: -30 } },
      to: { target: box('Customer'), at: { x: 1, y: 1 }, offset: { x: 20, y: 20 } },
    },
    { do: 'press', key: 'Delete' },
  ], ['deleteSelected']),
  classGesture('class-deleted-with-the-properties-delete-button', EDITOR, WITH_RELATIONS, [
    { do: 'press', target: box('Invoice'), key: 'Enter' },
    { do: 'click', target: button('✕ Delete') },
  ], ['deleteSelected']),
];

// ---------- members ----------

const members = [
  classGesture('attribute-added-with-the-member-form-add-button', EDITOR, THREE_CLASSES, [
    { do: 'press', target: box('Order'), key: 'Enter' },
    { do: 'click', target: button('Add attribute') },
    { do: 'fill', target: field('Attribute signature'), value: '-status: str' },
    { do: 'click', target: button('Add') },
  ], ['replaceClassDeclaration']),
  classGesture('method-added-with-the-member-form-enter-key-on-the-homework', HOMEWORK, THREE_CLASSES, [
    { do: 'press', target: box('Customer'), key: 'Enter' },
    { do: 'click', target: button('Add method') },
    { do: 'fill', target: field('Method signature'), value: '+rename(name: str): void' },
    { do: 'press', target: field('Method signature'), key: 'Enter' },
  ], ['replaceClassDeclaration']),
  classGesture('member-form-closed-with-its-cancel-button', EDITOR, THREE_CLASSES, [
    { do: 'press', target: box('Order'), key: 'Enter' },
    { do: 'click', target: button('Add attribute') },
    { do: 'fill', target: field('Attribute signature'), value: '-status: str' },
    { do: 'click', target: button('Cancel') },
  ], []),
  classGesture('member-form-closed-with-escape', EDITOR, THREE_CLASSES, [
    { do: 'press', target: box('Order'), key: 'Enter' },
    { do: 'click', target: button('Add method') },
    { do: 'fill', target: field('Method signature'), value: '+cancel(): void' },
    { do: 'press', target: field('Method signature'), key: 'Escape' },
  ], []),
  classGesture('attribute-added-from-the-class-context-menu', EDITOR, THREE_CLASSES, [
    { do: 'pointerClick', point: inBox('Invoice'), button: 'right' },
    { do: 'click', target: menuItem('Add attribute') },
    { do: 'fill', target: field('Attribute signature'), value: '-number: int' },
    { do: 'press', target: field('Attribute signature'), key: 'Enter' },
  ], ['replaceClassDeclaration']),
  classGesture('method-added-from-the-class-context-menu', EDITOR, THREE_CLASSES, [
    { do: 'pointerClick', point: inBox('Order'), button: 'right' },
    { do: 'click', target: menuItem('Add method') },
    { do: 'fill', target: field('Method signature'), value: '#recalculate(): void' },
    { do: 'click', target: button('Add') },
  ], ['replaceClassDeclaration']),
  classGesture('method-without-parentheses-refused-by-the-member-form', EDITOR, THREE_CLASSES, [
    { do: 'press', target: box('Order'), key: 'Enter' },
    { do: 'click', target: button('Add method') },
    { do: 'fill', target: field('Method signature'), value: '+total' },
    { do: 'click', target: button('Add') },
  ], []),
  // A double-click on Order's first member, `-id: int`, edits that member's exact text.
  classGesture('member-signature-edited-in-place', EDITOR, THREE_CLASSES, [
    { do: 'pointerDblclick', point: inBox('Order', 0.35, 0.5) },
    { do: 'fill', target: { role: 'textbox', name: 'Edit class member' }, value: '-id: long' },
    { do: 'press', target: { role: 'textbox', name: 'Edit class member' }, key: 'Enter' },
  ], ['replaceClassDeclaration']),
  classGesture('member-removed-in-properties', EDITOR, THREE_CLASSES, [
    { do: 'press', target: box('Order'), key: 'Enter' },
    { do: 'click', target: button('Delete member 2') },
  ], ['replaceClassDeclaration']),
];

// ---------- relations ----------

const relations = [
  addedThroughTheChooser('Generalization', 'Invoice', 'Order'),
  addedThroughTheChooser('Realization', 'Customer', 'Payable'),
  addedThroughTheChooser('Composition', 'Order', 'Invoice'),
  addedThroughTheChooser('Aggregation', 'Customer', 'Order'),
  addedThroughTheChooser('Association', 'Order', 'Customer'),
  addedThroughTheChooser('Dependency', 'Invoice', 'Payable'),
  addedWithTheRelationTool('Generalization', 'Customer', 'Order'),
  addedWithTheRelationTool('Realization', 'Invoice', 'Payable'),
  addedWithTheRelationTool('Composition', 'Order', 'Customer'),
  addedWithTheRelationTool('Aggregation', 'Order', 'Invoice'),
  addedWithTheRelationTool('Association', 'Customer', 'Invoice'),
  addedWithTheRelationTool('Dependency', 'Order', 'Payable'),
  classGesture('dependency-added-by-a-connect-drag-with-the-selected-relation-tool', EDITOR, THREE_CLASSES, [
    { do: 'click', target: button('Add relation: Dependency') },
    { do: 'drag', from: extendHandle('Order'), to: inBox('Invoice') },
  ], ['connectWithSelectedRelationTool']),
  classGesture('association-added-with-the-relation-tool-from-the-keyboard', EDITOR, WITH_INTERFACE, [
    { do: 'press', target: button('Add relation: Association'), key: 'Enter' },
    { do: 'press', target: box('Invoice'), key: 'Enter' },
    { do: 'press', target: box('Customer'), key: 'Enter' },
  ], ['handleHitboxClickForRelation']),
  associationEditedInProperties('association-label-set-in-properties', [
    { do: 'fill', target: field('Label'), value: 'buys' },
    { do: 'press', target: field('Label'), key: 'Enter' },
  ]),
  associationEditedInProperties('association-multiplicity-set-in-properties', [
    { do: 'fill', target: field('Source multiplicity / cardinality'), value: '0..1' },
    { do: 'press', target: field('Source multiplicity / cardinality'), key: 'Enter' },
  ]),
  associationEditedInProperties('association-navigability-set-in-properties', [
    { do: 'select', target: field('Target navigability'), value: 'navigable' },
  ]),
  // A class relation's end is rewired in Properties: the editor has no end handle to drag.
  classGesture('dependency-target-rewired-in-properties', EDITOR, WITH_RELATIONS, [
    { do: 'press', target: segment('rel:4'), key: 'Enter' },
    { do: 'select', target: field('Target endpoint'), value: 'Customer' },
  ], ['rewireRelationEndpoint']),
  // Dragging near a dependency's end onto Customer moves the line's bend; its ends stay.
  classGesture('dependency-end-dragged-onto-another-class-bends-without-rewiring', EDITOR, WITH_RELATIONS, [
    { do: 'drag', from: { target: segment('rel:4'), at: { x: 0.5, y: 0.9 } }, to: inBox('Customer') },
  ], ['updateDrag']),
  classGesture('dependency-inverted-from-its-context-menu', EDITOR, WITH_RELATIONS, [
    { do: 'pointerClick', point: { target: segment('rel:4') }, button: 'right' },
    { do: 'click', target: menuItem('Invert direction') },
  ], ['invertRelationDirection']),
  classGesture('dependency-deleted-with-the-delete-key', EDITOR, WITH_RELATIONS, [
    { do: 'press', target: segment('rel:4'), key: 'Enter' },
    { do: 'press', target: segment('rel:4'), key: 'Delete' },
  ], ['deleteSelected']),
  // The trunk matches both generalization lines: Delete keeps it and says so, and once it is
  // selected again Properties says why it cannot be edited.
  classGesture('generalization-trunk-delete-keeps-it-and-properties-says-why', EDITOR, GENERALIZATION_TREE, [
    { do: 'press', target: segment('edge-0'), key: 'Enter' },
    { do: 'press', target: segment('edge-0'), key: 'Delete' },
    { do: 'press', target: segment('edge-0'), key: 'Enter' },
  ], ['deleteSelected']),
];

// ---------- CRC cards ----------

const crcCards = [
  crcGesture('crc-card-added-by-a-palette-drop', [
    { do: 'drag', from: { target: button('Add element: CRC Card') }, to: { target: box('Catalog'), at: { x: 0.5, y: 1 }, offset: { x: 0, y: 60 } } },
  ], ['placeElementAt']),
  // Each list commits when its field loses focus.
  crcGesture('crc-card-lists-edited-in-properties', [
    { do: 'press', target: box('Catalog'), key: 'Enter' },
    { do: 'fill', target: field('Responsibilities (one per line)'), value: 'Provide current prices\nList products by category' },
    { do: 'fill', target: field('Collaborators (one per line)'), value: 'Cart' },
    { do: 'press', target: field('Collaborators (one per line)'), key: 'Tab' },
  ], ['replaceCrcCard']),
  crcGesture('crc-card-moved-by-a-drag', [
    { do: 'drag', from: inBox('Catalog'), to: besideBox('Catalog', { x: 0, y: 40 }) },
  ], ['updateDrag']),
  crcGesture('crc-card-renamed-in-place', [
    { do: 'pointerDblclick', point: inBox('Catalog', 0.5, 0.1) },
    { do: 'fill', target: renameField('Catalog'), value: 'Price List' },
    { do: 'press', target: renameField('Catalog'), key: 'Enter' },
  ], ['replaceCrcCard']),
  crcGesture('crc-card-duplicated-from-its-context-menu', [
    { do: 'pointerClick', point: inBox('Catalog'), button: 'right' },
    { do: 'click', target: menuItem('Duplicate') },
  ], ['duplicateElement']),
  crcGesture('crc-card-deleted-with-the-delete-key', [
    { do: 'press', target: box('Catalog'), key: 'Delete' },
  ], ['deleteSelected']),
];

// ---------- boundaries ----------

const boundaries = [
  classGesture('class-relation-between-a-quoted-id-and-a-namespaced-name', EDITOR, QUOTED_AND_NAMESPACED, [
    { do: 'click', target: button('Add relation: Composition') },
    { do: 'pointerClick', point: inBox('shop::Order') },
    { do: 'pointerClick', point: inBox('Line Item') },
  ], ['handleHitboxClickForRelation']),
  renamedInPlace('namespaced-class-renamed-in-place', QUOTED_AND_NAMESPACED, inBox('shop::Order', 0.5, 0.2),
    'shop::Order', 'shop::Purchase', ['renameElement']),
  renamedInPlace('quoted-class-renamed-in-place', QUOTED_AND_NAMESPACED, inBox('Line Item', 0.5, 0.2),
    'Line Item', 'Order Line', ['renameElement']),
  renamedInPlace('generic-member-type-follows-a-class-rename', GENERIC_MEMBER_TYPES, inBox('Item', 0.5, 0.2),
    'Item', 'Product', ['renameElement']),
  classGesture('class-nudged-beside-an-inline-pos-and-a-layout-block', EDITOR, INLINE_POS_AND_LAYOUT_BLOCK, [
    { do: 'press', target: box('Order'), key: 'ArrowDown' },
  ], ['nudgeElement']),
  // The start's line breaks are CRLF; the source reads them as LF.
  classGesture('class-added-to-a-crlf-document', EDITOR, THREE_CLASSES.replace(/\n/g, '\r\n'), [
    { do: 'press', target: button('Add element: Class'), key: 'Enter' },
  ], ['addElementWithoutCanvas']),
  // Nudge, Undo, then another nudge: Redo afterwards finds nothing to bring back.
  classGesture('class-edit-after-undo-drops-the-redo-branch', EDITOR, THREE_CLASSES, [
    { do: 'press', target: box('Invoice'), key: 'ArrowRight' },
    { do: 'advance', ms: 3500 },
    { do: 'click', target: button('↶ Undo') },
    { do: 'advance', ms: 3500 },
    { do: 'press', target: box('Invoice'), key: 'ArrowDown' },
    { do: 'press', target: box('Invoice'), key: 'ControlOrMeta+Shift+z' },
  ], ['nudgeElement', 'applySnapshot']),
  // The dependency is selected (Properties reads its line), a line is typed above it, and its
  // label is edited before the 120 ms render debounce runs: the route id `rel:4` is line-based.
  classGesture('dependency-label-edited-within-the-render-debounce-after-a-line-typed-above-it', PLAYGROUND, WITH_RELATIONS, [
    { do: 'press', target: segment('rel:4'), key: 'Enter' },
    { do: 'fill', target: field('ArchUML diagram source'), value: WITH_A_LINE_ABOVE_THE_DEPENDENCY },
    { do: 'fill', target: field('Label'), value: 'makes' },
    { do: 'press', target: field('Label'), key: 'Enter' },
  ], ['replaceRelationLine']),
  classGesture('class-diagram-switched-to-sequence-and-back', PLAYGROUND, THREE_CLASSES, [
    { do: 'select', target: field('Diagram type:'), value: 'sequence' },
    { do: 'select', target: field('Diagram type:'), value: 'class' },
  ], ['typeSelect:change']),
];

// ---------- anchored notes (Ruling U-W10, 2026-11-15) ----------

// replaceVirtualNoteText has two callers and two rewrites: the Text field in Properties replaces the
// text after a single-line note's colon; the in-place rename splices a block note's body to one line.
const CLASS_WITH_A_NOTE = lines('@startuml', 'class Order @pos(80, 80)', 'note right of Order: old text', '@enduml');
const CLASS_WITH_A_BLOCK_NOTE = lines('@startuml', 'class Order @pos(80, 80)', 'note right of Order', '  first line', '  second line', 'end note', '@enduml');
const noteTextField = { label: 'Text', within: { css: '#uml-pg-props-pane' } };
const inlineInput = { css: 'input.uml-pg-inline-input' }; // a uml-pg-* class: a test contract (spec §3.7)

const notes = [
  classGesture('class-anchored-note-text-changed-in-properties', EDITOR, CLASS_WITH_A_NOTE, [
    { do: 'press', target: box('old text'), key: 'Enter' },
    { do: 'fill', target: noteTextField, value: 'new text' },
    { do: 'press', target: noteTextField, key: 'Enter' },
  ], ['replaceVirtualNoteText']),
  classGesture('class-block-note-renamed-in-place', EDITOR, CLASS_WITH_A_BLOCK_NOTE, [
    { do: 'pointerDblclick', point: { target: { css: '.uml-pg-edit-hitbox[data-layout-id="note:2"]' } } },
    { do: 'fill', target: inlineInput, value: 'one line' },
    { do: 'press', target: inlineInput, key: 'Enter' },
  ], ['replaceVirtualNoteText']),
];

module.exports = [...layout, ...elements, ...members, ...relations, ...crcCards, ...boundaries, ...notes];
