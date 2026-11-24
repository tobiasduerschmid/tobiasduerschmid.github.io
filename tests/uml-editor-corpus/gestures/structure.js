'use strict';
// Family `structure` (plan Task 7): component and deployment diagrams, plus the Properties-pane
// removal of a composite state's sub-state (`renderChildren`), the third Properties removal of
// spec §3.5's `element.remove` row. Each gesture names in `covers` the write sites of spec §3.5 it
// reaches, by the site name of scripts/tests/helpers/uml-editor-script.js (a port added to a
// component, for example, is written by replaceLineForElementId, which addPortIntoComponent calls);
// one that writes nothing (a refusal, a cancel, a dismissal) names none. perform.js says what a
// step means.
//
// Beside the operations plan Task 7 lists, the family gives component and deployment drawings the
// operations of spec §3.4 that no other family reaches on them (the layout select, arrow-key nudges,
// a dragged bend, Reset Layout and Reset Selected, duplicate, invert, a relation's label and end in
// Properties, and a node's contents edited in its Properties), so every operation that these two
// types support has a gesture on each.
//
// Every gesture starts from a text of its own on the UML editor page, so no fixture depends on the
// page's built-in examples. The connectors of COMPONENT_START name ports by their bare aliases
// (`f_out --> b_in`), DEPLOYMENT_START nests nodes two deep (Cluster holds WebServer and DBServer),
// and COMPONENT_PINNED_START holds inline @pos beside an @layout block: the boundaries of spec §9.2
// this family carries.

const UML_EDITOR = '/SEBook/tools/uml-editor';

const COMPONENT_START = [
  '@startuml',
  'component Frontend {',
  '  portout "httpOut" as f_out',
  '}',
  'component Backend {',
  '  portin "httpIn" as b_in',
  '  portout "dbOut" as b_dbout',
  '}',
  'component Database {',
  '  portin "dbIn" as db_in',
  '}',
  'f_out --> b_in : REST',
  'b_dbout --> db_in : SQL',
  '@enduml',
].join('\n');

// COMPONENT_START as the editor writes it after a port is dragged: the components pinned with
// inline @pos, the ports in an @layout block.
const COMPONENT_PINNED_START = [
  '@startuml',
  '@layout schema=1 renderer="archuml-visual-editor"',
  'node "Frontend.f_out" x=187 y=129',
  'node "Backend.b_in" x=294 y=174',
  'node "Backend.b_dbout" x=430 y=129',
  'node "Database.db_in" x=521 y=129',
  '@endlayout',
  'component Frontend @pos(57, 84) {',
  '  portout "httpOut" as f_out',
  '}',
  'component Backend @pos(286, 84) {',
  '  portin "httpIn" as b_in',
  '  portout "dbOut" as b_dbout',
  '}',
  'component Database @pos(521, 84) {',
  '  portin "dbIn" as db_in',
  '}',
  'f_out --> b_in : REST',
  'b_dbout --> db_in : SQL',
  '@enduml',
].join('\n');

// Two components whose connector label holds a stored position: what the editor writes after the
// label was dragged 40 px up (Ruling U-W10).
const COMPONENT_WITH_A_STORED_LABEL = [
  '@startuml',
  '@layout schema=1 renderer="archuml-visual-editor"',
  'node "label:edge-0" x=220 y=70',
  'node "Frontend.f_out" x=187 y=129',
  'node "Backend.b_in" x=286 y=129',
  '@endlayout',
  'component Frontend @pos(57, 84) {',
  '  portout "httpOut" as f_out',
  '}',
  'component Backend @pos(286, 84) {',
  '  portin "httpIn" as b_in',
  '}',
  'f_out --> b_in : REST',
  '@enduml',
].join('\n');

const DEPLOYMENT_START = [
  '@startuml',
  'node Cluster {',
  '  node WebServer {',
  '    component AppServer',
  '  }',
  '  node DBServer {',
  '    component PostgreSQL',
  '  }',
  '}',
  'node Laptop {',
  '  component Browser',
  '  artifact app_ui',
  '}',
  'Laptop --> WebServer : HTTPS',
  'WebServer --> DBServer : JDBC',
  '@enduml',
].join('\n');

// DEPLOYMENT_START with Laptop and its contents pinned (inline @pos), for the two layout resets.
const DEPLOYMENT_PINNED_START = DEPLOYMENT_START
  .replace('node Laptop {', 'node Laptop @pos(400, 40) {')
  .replace('  component Browser', '  component Browser @pos(420, 96)')
  .replace('  artifact app_ui', '  artifact app_ui @pos(420, 158)');

const STATE_START = [
  '@startuml',
  '[*] --> Idle',
  'state Active {',
  '  state Running',
  '  state Paused',
  '}',
  'Idle --> Active : start',
  '@enduml',
].join('\n');

// ---------- targets and points ----------

// The drawn box of an element or port (spec §3.7: the hit layer's classes are a contract).
const hitbox = (id) => ({ css: `.uml-pg-edit-hitbox[data-layout-id="${id}"]` });
// The keyboard targets of the same boxes, by their role and accessible name.
const elementButton = (label) => ({ role: 'button', name: `Element ${label} — Enter to select, arrows to nudge, Delete to remove` });
const portButton = (label) => ({ role: 'button', name: `Port ${label} — Enter to select, arrows to nudge, Delete to remove` });
// A drawn relation's hit line, by its route id (`edge-N` in a component drawing, `rel:<line>` in a
// deployment one); the first one, because a route draws one per segment.
const edgeHitbox = (id) => ({ css: `.uml-pg-edge-hitbox[data-layout-id="${id}"]`, nth: 0 });
// The keyboard target of one segment of a drawn relation, by its role and accessible name.
const segment = (routeId, number = 1) => ({ role: 'button', name: `Relation segment ${number} of ${routeId} — Enter to select, Delete to remove` });
const extendHandle = (label) => ({ role: 'button', name: `Extend a relation from ${label}` });
const paletteElement = (label) => ({ role: 'button', name: `Add element: ${label}` });
const paletteRelation = (label) => ({ role: 'button', name: `Add relation: ${label}` });
const menuItem = (name) => ({ role: 'menuitem', name });
const propertiesPane = { css: '#uml-pg-props-pane' };
const inProperties = (target) => ({ ...target, within: propertiesPane });
const RESET_SELECTED = { role: 'button', name: 'Reset Selected' };
const RESET_LAYOUT = { role: 'button', name: 'Reset Layout' };
const LAYOUT_SELECT = { label: 'Layout:' };

const centreOf = (target) => ({ target });
// Just below a box's top edge: on a node's or a composite's own header, not on what it holds.
const headerOf = (target) => ({ target, at: { x: 0.5, y: 0 }, offset: { x: 0, y: 8 } });
const besideOf = (target, x, y) => ({ target, offset: { x, y } });
// Empty canvas, in the drawings of COMPONENT_START and DEPLOYMENT_START.
const BELOW_FRONTEND = { target: hitbox('Frontend'), at: { x: 0.5, y: 1 }, offset: { x: 0, y: 90 } };
const RIGHT_OF_LAPTOP = { target: hitbox('Laptop'), at: { x: 1, y: 0.5 }, offset: { x: 120, y: 0 } };
const BELOW_LAPTOP = { target: hitbox('Laptop'), at: { x: 0.1, y: 1 }, offset: { x: 0, y: 25 } };
// Off the drawing and off the preview: the label of the diagram type select.
const AWAY = { target: { css: 'label[for="uml-pg-type"]' } };

function gesture(id, type, start, steps, covers) {
  return { id, family: 'structure', type, page: UML_EDITOR, start, steps, covers };
}

// The extend handle ("+") shows while the pointer is over its box's header; then it is dragged.
const dragExtendHandle = (label, to) => [
  { do: 'pointerMove', point: headerOf(hitbox(label)) },
  { do: 'drag', from: centreOf(extendHandle(label)), to },
];

// ---------- component diagrams ----------

const COMPONENT_GESTURES = [
  // Elements and ports.
  gesture('component-added-by-dropping-the-palette-tool-on-empty-canvas', 'component', COMPONENT_START, [
    { do: 'drag', from: centreOf(paletteElement('Component')), to: BELOW_FRONTEND },
  ], ['placeElementAt']),
  gesture('component-added-with-the-keyboard-from-the-palette', 'component', COMPONENT_START, [
    { do: 'press', target: paletteElement('Component'), key: 'Enter' },
  ], ['addElementWithoutCanvas', 'placeElementAt']),
  gesture('component-port-in-dropped-onto-a-component-goes-inside-its-block', 'component', COMPONENT_START, [
    { do: 'drag', from: centreOf(paletteElement('Port In')), to: centreOf(hitbox('Database')) },
  ], ['placeElementAt', 'replaceLineForElementId']),
  gesture('component-port-created-by-dragging-the-extend-handle-to-empty-canvas', 'component', COMPONENT_START, [
    ...dragExtendHandle('Database', { target: hitbox('Database'), at: { x: 0.5, y: 1 }, offset: { x: 0, y: 80 } }),
    { do: 'click', target: menuItem('Port Out') },
  ], ['replaceLineForElementId']),
  // A port's position is constrained to its component's border.
  gesture('component-port-dragged-off-its-component-stays-on-the-border', 'component', COMPONENT_START, [
    { do: 'drag', from: centreOf(hitbox('Backend.b_in')), to: besideOf(hitbox('Backend.b_in'), -40, 30) },
  ], ['updateDrag']),
  gesture('component-provided-interface-dropped-onto-a-component', 'component', COMPONENT_START, [
    { do: 'drag', from: centreOf(paletteElement('Provided I/F')), to: centreOf(hitbox('Backend')) },
  ], ['placeElementAt', 'replaceLineForElementId']),
  gesture('component-required-interface-added-in-properties', 'component', COMPONENT_START, [
    { do: 'pointerClick', point: headerOf(hitbox('Frontend')) },
    { do: 'click', target: inProperties({ role: 'button', name: 'Add required interface (socket)' }) },
  ], ['replaceLineForElementId']),
  gesture('component-renamed-in-place', 'component', COMPONENT_START, [
    { do: 'pointerDblclick', point: headerOf(hitbox('Database')) },
    { do: 'fill', target: { label: 'Rename Database' }, value: 'Store' },
    { do: 'press', target: { label: 'Rename Database' }, key: 'Enter' },
  ], ['replaceLineForElementId']),
  gesture('component-dashed-outline-set-in-properties', 'component', COMPONENT_START, [
    { do: 'pointerClick', point: headerOf(hitbox('Frontend')) },
    { do: 'check', target: inProperties({ role: 'checkbox', name: 'Dashed outline' }) },
  ], ['replaceGenericElement']),
  // Renaming a port: its identifier in Properties (connectors that name it by its bare alias
  // follow), and its drawn name in place (the source keeps its text).
  gesture('component-port-renamed-in-properties-and-its-connectors-follow', 'component', COMPONENT_START, [
    { do: 'pointerClick', point: centreOf(hitbox('Backend.b_in')) },
    { do: 'fill', target: inProperties({ label: 'Identifier' }), value: 'Backend.b_api' },
    { do: 'press', target: inProperties({ label: 'Identifier' }), key: 'Enter' },
  ], ['renameElement']),
  gesture('component-port-renamed-in-place-keeps-its-source', 'component', COMPONENT_START, [
    { do: 'pointerDblclick', point: centreOf(hitbox('Database.db_in')) },
    { do: 'fill', target: { label: 'Rename dbIn' }, value: 'sqlIn' },
    { do: 'press', target: { label: 'Rename dbIn' }, key: 'Enter' },
  ], []),
  gesture('component-port-removed-in-the-components-properties', 'component', COMPONENT_START, [
    { do: 'pointerClick', point: headerOf(hitbox('Backend')) },
    { do: 'click', target: inProperties({ role: 'button', name: 'Remove port 1' }) },
  ], ['renderPorts']),
  gesture('component-port-deleted-with-the-delete-key', 'component', COMPONENT_START, [
    { do: 'press', target: portButton('httpIn'), key: 'Enter' },
    { do: 'press', target: portButton('httpIn'), key: 'Delete' },
  ], ['deleteSelected']),
  // Connectors. A port on a component's right edge (httpOut) lies under that component's extend
  // handle, so the connector tool reaches it with the keyboard.
  gesture('component-connector-added-between-two-ports-with-the-connector-tool', 'component', COMPONENT_START, [
    { do: 'click', target: paletteRelation('Connector') },
    { do: 'press', target: portButton('httpOut'), key: 'Enter' },
    { do: 'press', target: portButton('dbIn'), key: 'Enter' },
  ], ['handleHitboxClickForRelation']),
  // The chooser writes the connector without an undo step of its own; the corpus records that.
  gesture('component-connector-chosen-after-dragging-the-extend-handle-onto-a-component', 'component', COMPONENT_START, [
    ...dragExtendHandle('Frontend', centreOf(hitbox('Database'))),
    { do: 'click', target: menuItem('Dependency') },
  ], ['showRelationChooser']),
  gesture('component-connector-drawn-with-the-armed-tool-from-the-extend-handle', 'component', COMPONENT_START, [
    { do: 'click', target: paletteRelation('Plain Line') },
    ...dragExtendHandle('Frontend', centreOf(hitbox('Database'))),
  ], ['connectWithSelectedRelationTool']),
  // edge-0 is `b_dbout --> db_in : SQL`: the renderer numbers routes in its own order.
  gesture('component-connector-naming-ports-by-bare-alias-relabelled-in-properties', 'component', COMPONENT_START, [
    { do: 'pointerClick', point: centreOf(edgeHitbox('edge-0')) },
    { do: 'fill', target: inProperties({ label: 'Label' }), value: 'HTTPS' },
    { do: 'press', target: inProperties({ label: 'Label' }), key: 'Enter' },
  ], ['replaceRelationLine']),
  gesture('component-connector-naming-ports-by-bare-alias-rewired-in-properties', 'component', COMPONENT_START, [
    { do: 'pointerClick', point: centreOf(edgeHitbox('edge-0')) },
    { do: 'select', target: inProperties({ role: 'combobox', name: 'Target endpoint' }), value: 'Backend.b_in' },
  ], ['rewireRelationEndpoint']),
  // edge-1 is `f_out --> b_in : REST`.
  gesture('component-connector-inverted-from-its-context-menu', 'component', COMPONENT_START, [
    { do: 'pointerClick', point: centreOf(edgeHitbox('edge-1')), button: 'right' },
    { do: 'click', target: menuItem('Invert direction') },
  ], ['invertRelationDirection']),
  // The duplicate keeps its ports' aliases (`b_in`, `b_dbout`); the corpus records that.
  gesture('component-duplicated-from-its-context-menu', 'component', COMPONENT_START, [
    { do: 'pointerClick', point: headerOf(hitbox('Backend')), button: 'right' },
    { do: 'click', target: menuItem('Duplicate') },
  ], ['duplicateElement']),
  // Layout.
  gesture('component-layout-chosen-in-the-layout-select', 'component', COMPONENT_START, [
    { do: 'select', target: LAYOUT_SELECT, value: 'landscape' },
  ], ['layoutSelect:change']),
  // Two nudges inside the undo coalescing window: one undo step.
  gesture('component-port-nudged-twice-along-its-border', 'component', COMPONENT_START, [
    { do: 'press', target: portButton('httpIn'), key: 'ArrowDown' },
    { do: 'press', target: portButton('httpIn'), key: 'ArrowDown' },
  ], ['nudgeElement']),
  gesture('component-connector-bend-dragged', 'component', COMPONENT_START, [
    { do: 'drag', from: { target: segment('edge-1') }, to: { target: segment('edge-1'), offset: { x: 0, y: 60 } } },
  ], ['updateDrag']),
  gesture('component-port-position-reset-with-reset-selected', 'component', COMPONENT_PINNED_START, [
    { do: 'press', target: portButton('httpIn'), key: 'Enter' },
    { do: 'click', target: RESET_SELECTED },
  ], ['resetOneBtn:click']),
  gesture('component-positions-and-port-layout-block-cleared-with-reset-layout', 'component', COMPONENT_PINNED_START, [
    { do: 'click', target: RESET_LAYOUT },
  ], ['resetLayoutBtn:click']),
  // Ruling U-W10: Reset Selected on a label drops its stored position and takes no automatic layout.
  gesture('component-connector-label-with-a-stored-position-reset-with-reset-selected', 'component', COMPONENT_WITH_A_STORED_LABEL, [
    { do: 'press', target: { role: 'button', name: 'Label REST', exact: false }, key: 'Enter' },
    { do: 'click', target: RESET_SELECTED },
  ], ['resetOneBtn:click']),
];

// ---------- deployment diagrams ----------

const DEPLOYMENT_GESTURES = [
  // Elements, top level and nested.
  gesture('deployment-node-added-by-dropping-the-palette-tool-on-empty-canvas', 'deployment', DEPLOYMENT_START, [
    { do: 'drag', from: centreOf(paletteElement('Node')), to: RIGHT_OF_LAPTOP },
  ], ['placeElementAt']),
  gesture('deployment-component-added-by-arming-the-tool-and-clicking-empty-canvas', 'deployment', DEPLOYMENT_START, [
    { do: 'click', target: paletteElement('Component') },
    { do: 'pointerClick', point: RIGHT_OF_LAPTOP },
  ], ['placeElementAt']),
  gesture('deployment-artifact-added-with-the-keyboard-from-the-palette', 'deployment', DEPLOYMENT_START, [
    { do: 'press', target: paletteElement('Artifact'), key: 'Enter' },
  ], ['addElementWithoutCanvas', 'placeElementAt']),
  gesture('deployment-component-dropped-onto-a-node-nests-inside-it', 'deployment', DEPLOYMENT_START, [
    { do: 'drag', from: centreOf(paletteElement('Component')), to: { target: hitbox('Laptop'), at: { x: 0.5, y: 1 }, offset: { x: 0, y: -6 } } },
  ], ['placeElementAt', 'addDeploymentChildIntoNode']),
  gesture('deployment-artifact-dropped-onto-a-nested-node-nests-inside-it', 'deployment', DEPLOYMENT_START, [
    { do: 'drag', from: centreOf(paletteElement('Artifact')), to: { target: hitbox('DBServer'), at: { x: 0.5, y: 1 }, offset: { x: 0, y: -6 } } },
  ], ['placeElementAt', 'addDeploymentChildIntoNode']),
  gesture('deployment-node-and-connector-added-by-dragging-the-extend-handle-to-empty-canvas', 'deployment', DEPLOYMENT_START, [
    ...dragExtendHandle('Laptop', RIGHT_OF_LAPTOP),
    { do: 'click', target: menuItem('Node') },
    // The relation chooser opens 60 ms after the new node is drawn.
    { do: 'advance', ms: 100 },
    { do: 'click', target: menuItem('Connector') },
  ], ['updateExtendDrag', 'showRelationChooser']),
  gesture('deployment-nested-node-renamed-in-place-and-its-connectors-follow', 'deployment', DEPLOYMENT_START, [
    { do: 'pointerDblclick', point: headerOf(hitbox('WebServer')) },
    { do: 'fill', target: { label: 'Rename WebServer' }, value: 'AppHost' },
    { do: 'press', target: { label: 'Rename WebServer' }, key: 'Enter' },
  ], ['renameElement']),
  gesture('deployment-node-stereotype-set-in-properties', 'deployment', DEPLOYMENT_START, [
    { do: 'pointerClick', point: headerOf(hitbox('Laptop')) },
    { do: 'fill', target: inProperties({ label: 'Stereotype (e.g. <<service>>)' }), value: 'device' },
    { do: 'press', target: inProperties({ label: 'Stereotype (e.g. <<service>>)' }), key: 'Enter' },
  ], ['replaceGenericElement']),
  gesture('deployment-node-duplicated-from-its-context-menu', 'deployment', DEPLOYMENT_START, [
    { do: 'pointerClick', point: headerOf(hitbox('Laptop')), button: 'right' },
    { do: 'click', target: menuItem('Duplicate') },
  ], ['duplicateElement']),
  // A node's contents in its Properties, which rebuild the node's declaration; Cluster's list shows
  // its own children only, and its nested nodes stay.
  gesture('deployment-component-added-in-the-nodes-properties', 'deployment', DEPLOYMENT_START, [
    { do: 'press', target: elementButton('Laptop'), key: 'Enter' },
    { do: 'click', target: inProperties({ role: 'button', name: '+ Component' }) },
  ], ['replaceLineForElementId']),
  gesture('deployment-artifact-added-in-the-properties-of-a-node-that-holds-nested-nodes', 'deployment', DEPLOYMENT_START, [
    { do: 'press', target: elementButton('Cluster'), key: 'Enter' },
    { do: 'click', target: inProperties({ role: 'button', name: '+ Artifact' }) },
  ], ['replaceLineForElementId']),
  // Every row's kind select has the same name; the second row is app_ui, an artifact.
  gesture('deployment-child-kind-changed-in-the-nodes-properties', 'deployment', DEPLOYMENT_START, [
    { do: 'press', target: elementButton('Laptop'), key: 'Enter' },
    { do: 'select', target: inProperties({ role: 'combobox', name: 'Deployment child kind', nth: 1 }), value: 'component' },
  ], ['replaceLineForElementId']),
  gesture('deployment-child-renamed-in-the-nodes-properties', 'deployment', DEPLOYMENT_START, [
    { do: 'press', target: elementButton('Laptop'), key: 'Enter' },
    { do: 'fill', target: inProperties({ label: 'Deployment child 1 name' }), value: 'WebClient' },
    { do: 'press', target: inProperties({ label: 'Deployment child 1 name' }), key: 'Enter' },
  ], ['renameElement']),
  // Removals: in the node's Properties (one child), and with Delete (a nested node and its contents).
  gesture('deployment-child-removed-in-the-nodes-properties', 'deployment', DEPLOYMENT_START, [
    { do: 'pointerClick', point: headerOf(hitbox('Laptop')) },
    { do: 'click', target: inProperties({ role: 'button', name: 'Remove deployment child 2' }) },
  ], ['renderDeploymentChildren']),
  gesture('deployment-nested-node-deleted-with-the-delete-key', 'deployment', DEPLOYMENT_START, [
    { do: 'pointerClick', point: headerOf(hitbox('DBServer')) },
    { do: 'press', target: elementButton('DBServer'), key: 'Delete' },
  ], ['deleteSelected']),
  gesture('deployment-note-anchored-to-a-node', 'deployment', DEPLOYMENT_START, [
    { do: 'click', target: paletteElement('Note') },
    { do: 'pointerClick', point: headerOf(hitbox('Laptop')) },
  ], ['handleHitboxClickForAnchoredNoteTool']),
  // Connectors.
  gesture('deployment-connector-inverted-from-its-context-menu', 'deployment', DEPLOYMENT_START, [
    { do: 'pointerClick', point: centreOf(edgeHitbox('rel:13')), button: 'right' },
    { do: 'click', target: menuItem('Invert direction') },
  ], ['invertRelationDirection']),
  // rel:14 is `WebServer --> DBServer : JDBC`, drawn inside Cluster.
  gesture('deployment-connector-relabelled-in-properties', 'deployment', DEPLOYMENT_START, [
    { do: 'press', target: segment('rel:14'), key: 'Enter' },
    { do: 'fill', target: inProperties({ label: 'Label' }), value: 'TCP' },
    { do: 'press', target: inProperties({ label: 'Label' }), key: 'Enter' },
  ], ['replaceRelationLine']),
  gesture('deployment-connector-source-rewired-in-properties', 'deployment', DEPLOYMENT_START, [
    { do: 'press', target: segment('rel:14'), key: 'Enter' },
    { do: 'select', target: inProperties({ role: 'combobox', name: 'Source endpoint' }), value: 'Laptop' },
  ], ['rewireRelationEndpoint']),
  // Layout: the select, a dragged bend, and nudges (keyboard moves follow the nesting rules of drags).
  gesture('deployment-layout-chosen-in-the-layout-select', 'deployment', DEPLOYMENT_START, [
    { do: 'select', target: LAYOUT_SELECT, value: 'landscape' },
  ], ['layoutSelect:change']),
  // The editor offers rel:13's second segment, the vertical one left of the nodes; it moves left.
  gesture('deployment-connector-bend-dragged', 'deployment', DEPLOYMENT_START, [
    { do: 'drag', from: { target: segment('rel:13', 2) }, to: { target: segment('rel:13', 2), offset: { x: -30, y: 0 } } },
  ], ['updateDrag']),
  gesture('deployment-node-nudged-twice-carries-its-contents', 'deployment', DEPLOYMENT_START, [
    { do: 'press', target: elementButton('Laptop'), key: 'ArrowRight' },
    { do: 'press', target: elementButton('Laptop'), key: 'ArrowRight' },
  ], ['nudgeElement']),
  // WebServer lies 36 px inside Cluster's left edge: three 10 px nudges move it, the fourth would
  // take it out of Cluster and is refused with deploymentNestingRefusal's words.
  gesture('deployment-nested-node-nudged-out-of-its-parent-is-refused', 'deployment', DEPLOYMENT_START, [
    { do: 'press', target: elementButton('WebServer'), key: 'ArrowLeft' },
    { do: 'press', target: elementButton('WebServer'), key: 'ArrowLeft' },
    { do: 'press', target: elementButton('WebServer'), key: 'ArrowLeft' },
    { do: 'press', target: elementButton('WebServer'), key: 'ArrowLeft' },
  ], ['nudgeElement']),
  // Moves: a node carries what it holds; a move that would change nesting is refused with
  // deploymentNestingRefusal's words, and the text stays as it was.
  gesture('deployment-node-dragged-carries-its-contents', 'deployment', DEPLOYMENT_START, [
    { do: 'drag', from: headerOf(hitbox('Laptop')), to: { target: hitbox('Laptop'), at: { x: 0.5, y: 0 }, offset: { x: 60, y: 38 } } },
  ], ['updateDrag']),
  gesture('deployment-outer-node-dragged-carries-its-nested-nodes', 'deployment', DEPLOYMENT_START, [
    { do: 'drag', from: headerOf(hitbox('Cluster')), to: { target: hitbox('Cluster'), at: { x: 0.5, y: 0 }, offset: { x: 50, y: 28 } } },
  ], ['updateDrag']),
  gesture('deployment-nested-node-dragged-out-of-its-parent-is-refused', 'deployment', DEPLOYMENT_START, [
    { do: 'drag', from: headerOf(hitbox('WebServer')), to: { target: hitbox('Cluster'), at: { x: 1, y: 0 }, offset: { x: 160, y: 8 } } },
  ], []),
  gesture('deployment-component-moved-onto-a-nested-node-is-refused', 'deployment', DEPLOYMENT_START, [
    { do: 'drag', from: centreOf(hitbox('Browser')), to: centreOf(hitbox('DBServer')) },
  ], []),
  gesture('deployment-pinned-node-reset-to-its-automatic-position', 'deployment', DEPLOYMENT_PINNED_START, [
    { do: 'pointerClick', point: headerOf(hitbox('Laptop')) },
    { do: 'click', target: RESET_SELECTED },
  ], ['resetOneBtn:click']),
  gesture('deployment-layout-reset', 'deployment', DEPLOYMENT_PINNED_START, [
    { do: 'click', target: RESET_LAYOUT },
  ], ['resetLayoutBtn:click']),
  // Boundaries of spec §9.2.
  gesture('deployment-node-drag-released-outside-the-canvas', 'deployment', DEPLOYMENT_START, [
    { do: 'drag', from: headerOf(hitbox('Laptop')), to: AWAY },
  ], ['updateDrag']),
  gesture('deployment-node-drag-cancelled-with-escape', 'deployment', DEPLOYMENT_START, [
    // Focus first: the editor hears Escape only from inside it, and a press on a box keeps focus.
    { do: 'focus', target: elementButton('Laptop') },
    { do: 'drag', from: headerOf(hitbox('Laptop')), to: { target: hitbox('Laptop'), at: { x: 0.5, y: 0 }, offset: { x: 60, y: 38 } }, release: false },
    { do: 'press', key: 'Escape' },
    { do: 'pointerUp' },
  ], []),
  gesture('deployment-press-outside-an-open-context-menu-closes-it', 'deployment', DEPLOYMENT_START, [
    { do: 'pointerClick', point: headerOf(hitbox('Laptop')), button: 'right' },
    // The menu listens for a press outside it from the next timer task on.
    { do: 'advance', ms: 10 },
    // Empty canvas left of the menu, which opens down and right of the press: the press closes the
    // menu and clears the selection.
    { do: 'pointerClick', point: BELOW_LAPTOP },
    // An open menu would take this key and focus its next item; a closed one leaves focus alone.
    { do: 'press', key: 'ArrowDown' },
  ], []),
];

// ---------- the composite state's sub-states (the third Properties removal of §3.5) ----------

const STATE_GESTURES = [
  gesture('state-sub-state-removed-in-the-composite-states-properties', 'state', STATE_START, [
    { do: 'pointerClick', point: headerOf(hitbox('Active')) },
    { do: 'click', target: inProperties({ role: 'button', name: 'Remove sub-state 2' }) },
  ], ['renderChildren']),
];

module.exports = [...COMPONENT_GESTURES, ...DEPLOYMENT_GESTURES, ...STATE_GESTURES];
