'use strict';
/**
 * The style evidence of the UML editor refactor (spec 2026-11-12 §9.4 point 3; plan Task 3): the
 * states whose computed styles must stay the same, in light mode, dark mode, and print, while the
 * editor's presentation moves into CSS (stage R4) and into the module's stylesheet (R5d).
 *
 * A state is reached by one gesture (perform.js) on the UML editor page and lists the entries read
 * there: `{ name, target, properties }`, where `target` locates the styled element as perform.js
 * does, or `{ name, capture, properties }` for an element that exists only inside one call.
 * An entry of a literal style assignment also carries `assignment: true`.
 * - The states of the CSS that R5d moves are listed by hand; their entries are named by selector.
 * - Every literal style assignment that `literalStyleAssignments` finds in `init` is an entry named
 *   by its key, in a state where that assignment has run, reading the property it sets.
 *
 * Fixture: tests/fixtures/uml-editor-computed-styles.json,
 * `{ light, dark, print: { <state>: { <entry>: { <property>: <value> } } } }`.
 */

const clock = require('./clock');
const { locate, openGesturePage, performSteps } = require('./perform');

const UML_EDITOR = '/SEBook/tools/uml-editor';

// ---------- properties ----------

const SVG_PROPERTIES = Object.freeze([
  'display', 'visibility', 'opacity', 'pointer-events', 'cursor',
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'stroke-linecap',
  'vector-effect', 'outline-style', 'outline-width', 'outline-color',
  'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'transition-property', 'transition-duration',
]);
const BOX_PROPERTIES = Object.freeze([
  'display', 'visibility', 'opacity', 'position', 'z-index', 'pointer-events', 'cursor', 'box-sizing',
  'color', 'background-color', 'border-top-style', 'border-top-width', 'border-top-color',
  'border-top-left-radius', 'box-shadow', 'outline-style', 'outline-width', 'outline-color', 'outline-offset',
  'font-family', 'font-size', 'font-weight', 'padding-top', 'padding-left', 'margin-top', 'margin-left',
  'align-self',
]);

// ---------- starts ----------

const CLASS_START = [
  '@startuml',
  'abstract class Animal { +name: str; +{abstract} speak(): str }',
  'class Dog { +breed: str; +speak(): str }',
  'class Cat { +indoor: bool; +speak(): str }',
  'Dog --|> Animal',
  'Cat --|> Animal',
  'Dog ..> Cat : chases',
  '@enduml',
].join('\n');
const CLASS_WITH_A_MOVED_BOX = CLASS_START.replace('class Dog { +breed: str; +speak(): str }',
  'class Dog { +breed: str; +speak(): str } @pos(420, 320)');
const SEQUENCE_START = [
  '@startuml',
  'actor user: User',
  'participant app: Application',
  'participant db: Database',
  'user -> app: login(username, password)',
  'activate app',
  'app -> db: queryUser(username)',
  'activate db',
  'db --> app: userData',
  'deactivate db',
  'alt [valid credentials]',
  '  app --> user: token',
  'else [invalid]',
  '  app --> user: error 401',
  'end',
  'deactivate app',
  '@enduml',
].join('\n');
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
const COMPONENT_START = [
  '@startuml',
  'component Frontend {',
  '  portout "httpOut" as f_out',
  '}',
  'component Backend {',
  '  portin "httpIn" as b_in',
  '}',
  'f_out --> b_in : REST / JSON',
  '@enduml',
].join('\n');
const DEPLOYMENT_START = [
  '@startuml',
  'node ClientDevice {',
  '  component WebBrowser',
  '}',
  'node WebServer {',
  '  component AppServer',
  '}',
  'ClientDevice --> WebServer : HTTPS',
  '@enduml',
].join('\n');
// The renderer refuses a callout whose target the diagram does not declare.
const FAILING_START = '@startuml\nclass Dog\ncallout right of element Cat : Cat is not in this diagram\n@enduml';

// ---------- targets and points ----------

const hitbox = (id) => ({ css: `.uml-pg-edit-hitbox[data-layout-id="${id}"]` });
const a11yTarget = (id) => ({ css: `.uml-pg-edit-a11y-target[data-layout-id="${id}"]` });
const edgeHitbox = (id) => ({ css: `.uml-pg-edge-hitbox[data-layout-id="${id}"]`, nth: 0 });
const extendPlus = (id) => ({ css: `.uml-pg-extend-handle-group:has(> [aria-label="Extend a relation from ${id}"]) > .uml-pg-extend-handle-plus` });
const PALETTE_CLASS = { role: 'button', name: 'Add element: Class' };
// Off the drawing: the label of the diagram type select.
const AWAY = { target: { css: 'label[for="uml-pg-type"]' } };
// Empty canvas below the box of Dog in CLASS_START.
const EMPTY_CANVAS = { target: { css: '.uml-pg-edit-hitbox[data-layout-id="Dog"]' }, at: { x: 0, y: 1 }, offset: { x: 0, y: 40 } };
const centreOf = (target) => ({ target });
const headerOf = (target) => ({ target, at: { x: 0.5, y: 0 }, offset: { x: 0, y: 8 } });

function gesture(type, start, steps) {
  return { page: UML_EDITOR, type, start, steps };
}

const literal = (key, target, property) => ({ name: key, assignment: true, target, properties: [property] });
const selector = (css, properties) => ({ name: css, target: { css }, properties });

// ---------- states ----------

const STYLE_STATES = [
  // The states of the hit layer's CSS (moved by R5d), listed by hand.
  {
    id: 'hitbox idle',
    gesture: gesture('class', CLASS_START, [{ do: 'pointerMove', point: AWAY }]),
    entries: [
      selector('.uml-pg-edit-hitbox[data-layout-id="Dog"]', SVG_PROPERTIES),
      selector('.uml-pg-edit-a11y-target[data-layout-id="Dog"]', SVG_PROPERTIES),
      selector('.uml-pg-edge-hitbox[data-layout-id="rel:6"]', SVG_PROPERTIES),
      literal('applyViewTransform#1', { css: '#uml-pg-output svg' }, 'transform-origin'),
      literal('applyViewTransform#2', { css: '#uml-pg-output svg' }, 'transform'),
      literal('renderDiagram#1', { css: '#uml-pg-error' }, 'display'),
    ],
  },
  {
    // In print this is the hit layer under print.
    id: 'hit layer',
    gesture: gesture('class', CLASS_START, [{ do: 'pointerMove', point: AWAY }]),
    entries: [
      selector('.uml-pg-edit-layer', SVG_PROPERTIES),
      selector('.uml-pg-edit-target-layer', SVG_PROPERTIES),
      selector('.uml-pg-edit-visual-layer', SVG_PROPERTIES),
    ],
  },
  {
    id: 'hitbox hovered',
    gesture: gesture('class', CLASS_START, [{ do: 'pointerMove', point: centreOf(hitbox('Dog')) }]),
    entries: [selector('.uml-pg-edit-hitbox[data-layout-id="Dog"]', SVG_PROPERTIES)],
  },
  {
    id: 'hitbox selected',
    gesture: gesture('class', CLASS_START, [
      { do: 'pointerClick', point: centreOf(hitbox('Dog')) },
      { do: 'pointerMove', point: AWAY },
    ]),
    entries: [
      selector('.uml-pg-edit-hitbox[data-layout-id="Dog"]', SVG_PROPERTIES),
      literal('buildElementProps>renderMembers#1', { css: '#uml-pg-props-content .uml-pg-member-flags', nth: 0 }, 'grid-column'),
    ],
  },
  {
    id: 'hitbox focused',
    gesture: gesture('class', CLASS_START, [{ do: 'focus', target: a11yTarget('Dog') }]),
    entries: [
      selector('.uml-pg-edit-a11y-target[data-layout-id="Dog"]', SVG_PROPERTIES),
      selector('.uml-pg-edit-hitbox[data-layout-id="Dog"]', SVG_PROPERTIES),
    ],
  },
  {
    id: 'edge hitbox selected',
    gesture: gesture('class', CLASS_START, [
      { do: 'pointerClick', point: centreOf(edgeHitbox('rel:6')) },
      { do: 'pointerMove', point: AWAY },
    ]),
    entries: [selector('.uml-pg-edge-hitbox[data-layout-id="rel:6"]', SVG_PROPERTIES)],
  },
  {
    id: 'extend handle and its plus sign',
    gesture: gesture('class', CLASS_START, [{ do: 'pointerMove', point: centreOf(hitbox('Dog')) }]),
    entries: [
      selector('.uml-pg-extend-handle[aria-label="Extend a relation from Dog"]', SVG_PROPERTIES),
      selector('.uml-pg-extend-handle-group:has(> [aria-label="Extend a relation from Dog"]) > .uml-pg-extend-handle-plus', SVG_PROPERTIES),
      literal('installExtendHandle>show#1', extendPlus('Dog'), 'opacity'),
    ],
  },
  {
    id: 'extend handle hidden again',
    gesture: gesture('class', CLASS_START, [
      { do: 'pointerMove', point: centreOf(hitbox('Dog')) },
      { do: 'pointerMove', point: AWAY },
    ]),
    entries: [
      selector('.uml-pg-extend-handle[aria-label="Extend a relation from Dog"]', SVG_PROPERTIES),
      literal('installExtendHandle>hide#1', extendPlus('Dog'), 'opacity'),
    ],
  },
  {
    // A box dragged level with another and held: the smart guides show.
    id: 'guide line',
    gesture: gesture('class', CLASS_START, [
      { do: 'drag', from: centreOf(hitbox('Dog')), to: { target: hitbox('Dog'), offset: { x: 24, y: 0 } }, release: false },
    ]),
    entries: [{ name: '.uml-pg-guide-line', target: { css: '.uml-pg-guide-line', nth: 0 }, properties: SVG_PROPERTIES }],
  },
  {
    id: 'marquee',
    gesture: gesture('class', CLASS_START, [
      { do: 'drag', from: EMPTY_CANVAS, to: { ...EMPTY_CANVAS, offset: { x: 90, y: 100 } }, modifiers: ['Shift'], release: false },
    ]),
    entries: [selector('.uml-pg-marquee-box', BOX_PROPERTIES)],
  },
  {
    id: 'inline input',
    gesture: gesture('class', CLASS_START, [{ do: 'pointerDblclick', point: headerOf(hitbox('Dog')) }]),
    entries: [selector('.uml-pg-inline-input', BOX_PROPERTIES)],
  },
  {
    id: 'quick-insert buttons',
    gesture: gesture('sequence', SEQUENCE_START, [
      { do: 'pointerClick', point: centreOf(hitbox('app')) },
      { do: 'pointerMove', point: AWAY },
    ]),
    entries: [
      { name: 'button "Add an activate app bar"', target: { role: 'button', name: 'Add an activate app bar' }, properties: BOX_PROPERTIES },
      literal('makeQuickInsertButton#1', { role: 'button', name: 'Add an activate app bar' }, 'align-self'),
    ],
  },
  {
    // A relation's segment under the pointer: the handle that bends it when dragged.
    id: 'route bend handle',
    gesture: gesture('class', CLASS_START, [{ do: 'pointerMove', point: centreOf(edgeHitbox('rel:6')) }]),
    entries: [selector('.uml-pg-edge-hitbox[data-layout-id="rel:6"]', SVG_PROPERTIES)],
  },

  // The states where the other literal style assignments of init have run.
  {
    id: 'palette drag armed',
    gesture: gesture('class', CLASS_START, [
      { do: 'drag', from: centreOf(PALETTE_CLASS), to: { target: PALETTE_CLASS, offset: { x: 30, y: 40 } }, release: false },
    ]),
    entries: [literal('buildPaletteButton>btn:pointerdown>onMove#1', PALETTE_CLASS, 'opacity')],
  },
  {
    id: 'palette drag dropped',
    gesture: gesture('class', CLASS_START, [{ do: 'drag', from: centreOf(PALETTE_CLASS), to: EMPTY_CANVAS }]),
    entries: [literal('buildPaletteButton>btn:pointerdown>onUp#1', PALETTE_CLASS, 'opacity')],
  },
  {
    id: 'palette drag cancelled',
    gesture: gesture('class', CLASS_START, [
      { do: 'drag', from: centreOf(PALETTE_CLASS), to: { target: PALETTE_CLASS, offset: { x: 30, y: 40 } }, release: false },
      { do: 'dispatch', type: 'pointercancel', init: { pointerId: 1, isPrimary: true } },
    ]),
    entries: [literal('buildPaletteButton>btn:pointerdown>onCancel#1', PALETTE_CLASS, 'opacity')],
  },
  {
    id: 'fragment selected',
    gesture: gesture('sequence', SEQUENCE_START, [
      { do: 'pointerClick', point: centreOf(hitbox('frag:10')) },
      { do: 'pointerMove', point: AWAY },
    ]),
    entries: [
      literal('buildFragmentProps#1', { role: 'button', name: 'Move later' }, 'margin-left'),
      literal('buildFragmentProps#2', { role: 'button', name: 'Remove fragment (keep inner messages)' }, 'margin-top'),
    ],
  },
  {
    id: 'message selected',
    gesture: gesture('sequence', SEQUENCE_START, [
      { do: 'pointerClick', point: centreOf(edgeHitbox('seqmsg:6')) },
      { do: 'pointerMove', point: AWAY },
    ]),
    entries: [literal('buildRelationProps#1', { role: 'button', name: 'Move later' }, 'margin-left')],
  },
  {
    id: 'messages selected for a wrap',
    gesture: gesture('sequence', SEQUENCE_START, [
      { do: 'pointerClick', point: centreOf(edgeHitbox('seqmsg:4')) },
      { do: 'pointerClick', point: centreOf(edgeHitbox('seqmsg:6')), modifiers: ['Shift'] },
      { do: 'pointerMove', point: AWAY },
    ]),
    entries: ['display', 'gap', 'flex-wrap'].map((property, index) => literal(`buildGroupProps#${index + 1}`,
      { css: '#uml-pg-props-content div:has(> button[aria-label="Wrap selected messages in alt fragment"])' }, property)),
  },
  {
    id: 'wrap condition form',
    gesture: gesture('sequence', SEQUENCE_START, [
      { do: 'pointerClick', point: centreOf(edgeHitbox('seqmsg:4')) },
      { do: 'pointerClick', point: centreOf(edgeHitbox('seqmsg:6')), modifiers: ['Shift'] },
      { do: 'click', target: { role: 'button', name: 'Wrap selected messages in alt fragment' } },
    ]),
    entries: [
      ...['display', 'gap', 'align-items', 'flex-wrap'].map((property, index) => literal(`startSequenceWrap#${index + 1}`,
        { css: '#uml-pg-props-content div:has(> input[aria-label="alt fragment condition"])' }, property)),
      ...['font-size', 'font-weight'].map((property, index) => literal(`startSequenceWrap#${index + 5}`,
        { css: '#uml-pg-props-content label:has(+ input[aria-label="alt fragment condition"])' }, property)),
      ...['flex', 'min-width'].map((property, index) => literal(`startSequenceWrap#${index + 7}`,
        { role: 'textbox', name: 'alt fragment condition' }, property)),
      literal('startSequenceWrap#9', { css: '#uml-pg-props-content input[aria-label="alt fragment condition"] + span' }, 'font-size'),
    ],
  },
  {
    id: 'composite state selected',
    gesture: gesture('state', STATE_START, [
      { do: 'pointerClick', point: headerOf(hitbox('Active')) },
      { do: 'pointerMove', point: AWAY },
    ]),
    entries: [literal('buildElementProps>renderChildren#1', { css: '#uml-pg-props-content .uml-pg-member > span:first-child', nth: 0 }, 'grid-column')],
  },
  {
    id: 'component selected',
    gesture: gesture('component', COMPONENT_START, [
      { do: 'pointerClick', point: headerOf(hitbox('Backend')) },
      { do: 'pointerMove', point: AWAY },
    ]),
    entries: [
      literal('buildElementProps>renderPorts#1', { css: '#uml-pg-props-content .uml-pg-member-flags', nth: 0 }, 'grid-column'),
      literal('buildElementProps#1', { role: 'button', name: '+ Add port-out' }, 'margin-left'),
      literal('buildElementProps#2', { role: 'button', name: 'Add provided interface (ball)' }, 'margin-left'),
      literal('buildElementProps#3', { role: 'button', name: 'Add required interface (socket)' }, 'margin-left'),
    ],
  },
  {
    id: 'deployment node selected',
    gesture: gesture('deployment', DEPLOYMENT_START, [
      { do: 'pointerClick', point: headerOf(hitbox('ClientDevice')) },
      { do: 'pointerMove', point: AWAY },
    ]),
    entries: [literal('buildElementProps#4', { role: 'button', name: '+ Artifact' }, 'margin-left')],
  },
  {
    id: 'relation label editor',
    gesture: gesture('class', CLASS_START, [{ do: 'pointerDblclick', point: centreOf(edgeHitbox('rel:6')) }]),
    // Print hides in-place editors, so the editor is located by its class, not by its role.
    entries: [
      literal('startInlineRelationEdit#1', { css: 'input.uml-pg-inline-input[aria-label="Edit relation label"]' }, 'width'),
      literal('startInlineRelationEdit#2', { css: 'input.uml-pg-inline-input[aria-label="Edit relation label"]' }, 'min-height'),
    ],
  },
  {
    id: 'render error',
    gesture: gesture('class', FAILING_START, [{ do: 'pointerMove', point: AWAY }]),
    entries: [literal('showError#1', { css: '#uml-pg-error' }, 'display')],
  },
  {
    // Reset Selected draws the automatic layout in a host it adds to the page and removes again.
    id: 'automatic position computed',
    capture: 'removedDrawingHost',
    gesture: gesture('class', CLASS_WITH_A_MOVED_BOX, [
      { do: 'pointerClick', point: centreOf(hitbox('Dog')) },
      { do: 'click', target: { role: 'button', name: 'Reset Selected' } },
    ]),
    entries: ['position', 'left', 'top', 'visibility'].map((property, index) => ({
      name: `withTemporaryAutoSvg#${index + 1}`, assignment: true, capture: 'removedDrawingHost', properties: [property],
    })),
  },
];

/** Each literal style assignment's key, mapped to the state (its gesture) and the entry that reads it. */
function styleAssignmentEntries() {
  const entries = {};
  for (const state of STYLE_STATES) {
    for (const entry of state.entries) {
      if (entry.assignment) entries[entry.name] = { state: state.id, entry };
    }
  }
  return entries;
}

// ---------- reading ----------

/**
 * Before navigation: remember the computed styles of every element that is removed from
 * document.body while it holds a drawing (`removedDrawingHost`), once `reset` has been called.
 */
function installRemovedDrawingHostCapture(page, properties) {
  return page.addInitScript((names) => {
    const captured = [];
    let armed = false;
    window.__umlStyleCapture = {
      reset() { captured.length = 0; armed = true; },
      read() { return captured.slice(); },
    };
    function remember(node) {
      if (!armed || !(node instanceof Element) || node.parentNode !== document.body || !node.querySelector('svg')) return;
      const style = getComputedStyle(node);
      captured.push(Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)])));
    }
    const remove = Element.prototype.remove;
    Element.prototype.remove = function patchedRemove() { remember(this); return remove.call(this); };
    const removeChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function patchedRemoveChild(child) { remember(child); return removeChild.call(this, child); };
  }, properties);
}

const CAPTURES = {
  removedDrawingHost: {
    install: (page, state) => installRemovedDrawingHostCapture(page, state.entries.flatMap((entry) => entry.properties)),
    arm: (page) => page.evaluate(() => window.__umlStyleCapture.reset()),
    read: async (page) => {
      const captured = await page.evaluate(() => window.__umlStyleCapture.read());
      if (captured.length === 0) throw new Error('no drawing host was added and removed while the state was reached');
      return captured[0];
    },
  },
};

/**
 * Opens the editor page in the theme and performs the state's gesture. The page's clock is paused
 * throughout; it is settled after the gesture, as after a corpus gesture.
 */
async function reachState(page, state, theme) {
  const capture = state.capture && CAPTURES[state.capture];
  if (capture) await capture.install(page, state);
  await openGesturePage(page, state.gesture, { theme });
  if (capture) await capture.arm(page);
  await performSteps(page, state.gesture.steps);
  await clock.settle(page);
}

function propertiesOf(values, properties) {
  return Object.fromEntries(properties.map((property) => [property, values[property]]));
}

/**
 * The computed styles of the state's entries: `{ <entry>: { <property>: <value> } }`. Running CSS
 * transitions are finished first, so a value is the one the state settles on, not one in between.
 */
async function readState(page, state) {
  await page.evaluate(() => document.getAnimations().forEach((animation) => {
    try { animation.finish(); } catch (error) { /* an endless animation has no end to jump to */ }
  }));
  const values = {};
  for (const entry of state.entries) {
    if (entry.capture) {
      values[entry.name] = propertiesOf(await CAPTURES[entry.capture].read(page), entry.properties);
      continue;
    }
    const element = locate(page, entry.target);
    const count = await element.count();
    if (count !== 1) throw new Error(`style entry ${entry.name} of "${state.id}" matches ${count} elements, not one`);
    values[entry.name] = await element.evaluate((node, properties) => {
      const style = getComputedStyle(node);
      return Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)]));
    }, entry.properties);
  }
  return values;
}

module.exports = {
  STYLE_STATES,
  SVG_PROPERTIES,
  BOX_PROPERTIES,
  styleAssignmentEntries,
  reachState,
  readState,
};
