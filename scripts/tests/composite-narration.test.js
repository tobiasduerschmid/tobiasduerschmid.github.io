// The Composite lesson's photo collage: its oracle, its four-language code,
// its storyboard, and its generated speech. The specification of both designs
// lives in tests/helpers/composite-collage.js and is pinned here against the
// hand-derived values in _data/explainers/composite_ui.yml.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const collageSpec = require('../../tests/helpers/composite-collage');

const collage = collageSpec.load();
const { tree, share, part, position, rowsFor, canvasDescription, pressDescription, rowTags } = collageSpec;
const plain = tree(collage.rows);
const captioned = tree(collage.captioned_rows);
const designs = ['composite', 'first'];
// Every tile of both trees, shared alone, in both designs.
const everyShare = () => [plain, captioned].flatMap(nodes => [...nodes.keys()]
  .flatMap(id => designs.map(design => ({ nodes, id, design, result: share(nodes, id, design) }))));

// Parts of one cut lie side by side (or stacked) with equal sizes, starting at
// the area's edge, each touching the next, and ending at the opposite edge.
function assertCoveredExactly(area, parts, direction, label) {
  const [x, y, width, height] = area;
  const [along, size, start, total] = direction === 'side by side' ? [0, 2, x, width] : [1, 3, y, height];
  const [across, acrossSize] = direction === 'side by side' ? [1, 3] : [0, 2];
  assert.ok(parts.every(piece => piece[size] === parts[0][size]), `${label}: parts have equal sizes`);
  assert.ok(parts.every(piece => piece[across] === area[across] && piece[acrossSize] === area[acrossSize]), `${label}: parts span the area`);
  assert.equal(parts[0][along], start, `${label}: the first part starts at the edge`);
  parts.slice(1).forEach((piece, index) => {
    assert.equal(piece[along], parts[index][along] + parts[index][size], `${label}: part ${index + 1} touches the one before`);
  });
  assert.equal(parts.at(-1)[along] + parts.at(-1)[size], start + total, `${label}: the last part ends at the edge`);
}

test('the area helper cuts each split\'s area into equal parts that cover it exactly', () => {
  assert.deepEqual(part([0, 0, 1080, 1920], 1, 2, 'side by side'), [540, 0, 540, 1920]);
  assert.deepEqual(part([540, 0, 540, 1920], 1, 2, 'stacked'), [540, 960, 540, 960]);
  for (const { nodes, id, design, result } of everyShare()) {
    for (const cut of result.cuts) {
      const split = nodes.get(cut.tile);
      const parts = split.tiles.map((_, index) => part(cut.area, index, split.tiles.length, split.row.direction));
      assertCoveredExactly(cut.area, parts, split.row.direction, `${design} share of ${id}: ${cut.tile}`);
    }
  }
});

test('the expected canvases follow from the rows in both designs', () => {
  const { expected } = collage;
  for (const design of designs) {
    assert.deepEqual(share(plain, 'story', design).drawn, expected.start.drawn, `${design} design: the photo story`);
    assert.equal(share(plain, 'story', design).photos, expected.start.photos);
    assert.equal(share(captioned, 'story', design).photos, 4, `${design} design: a caption has no photos`);
  }
  assert.deepEqual(share(captioned, 'story', 'composite').drawn, expected.caption.drawn, 'composite design: the captioned story');
  assert.deepEqual(share(captioned, 'story', 'first').drawn, expected.first_design_caption.drawn, 'first design: the captioned story');
  for (const name of ['start', 'caption', 'first_design_caption']) assert.equal(expected[name].photos, 4, name);
  assert.ok(expected.caption.drawn.some(entry => entry.tile === 'caption'), 'the composite draws the caption');
  assert.ok(!expected.first_design_caption.drawn.some(entry => entry.tile === 'caption'), 'the first design leaves the caption out');
});

test('every area a Share press can produce sits on the 4 × 4 grid and has position words', () => {
  for (const { id, design, result } of everyShare()) {
    for (const { tile, area } of [...result.drawn, ...result.skipped, ...result.cuts]) {
      const [x, y, width, height] = area;
      assert.ok(x % 270 === 0 && width % 270 === 0 && y % 480 === 0 && height % 480 === 0,
        `${design} share of ${id}: ${tile} at ${area} is off the grid`);
    }
    for (const { tile, area } of [...result.drawn, ...result.skipped]) {
      assert.doesNotThrow(() => position(collage, area), `${design} share of ${id}: ${tile} at ${area}`);
    }
  }
});

test('every illustrated panel names tiles, marks, and traces that its design and tree produce', () => {
  for (const [name, panel] of Object.entries(collage.panels)) {
    assert.ok(designs.includes(panel.design), `${name}: design`);
    assert.ok([undefined, 'pending', 'added'].includes(panel.caption), `${name}: caption`);
    const rows = rowsFor(collage, panel);
    const ids = rows.map(row => row.id);
    const named = [...(panel.marked || []), ...Object.keys(panel.flags || {}), ...(panel.drawn || []), ...(panel.current ? [panel.current] : [])];
    for (const id of named) assert.ok(ids.includes(id), `${name}: ${id} is a tile of its tree`);
    if (panel.marked) assert.ok(panel.mark, `${name}: marked tiles say why`);
    assert.ok(panel.note && panel.note.trim().split(/\s+/).length <= 20, `${name}: a note of at most 20 words`);
    if (panel.drawn) {
      const order = share(tree(rows), 'story', panel.design).drawn.map(entry => entry.tile);
      assert.deepEqual(panel.drawn, order.slice(0, panel.drawn.length), `${name}: the trace follows the drawing order`);
    }
    if (panel.current) assert.equal(rows.find(row => row.id === panel.current).kind, 'split', `${name}: only a split cuts its area`);
    for (const neighbor of panel.neighbors || []) assert.ok(['carousel', 'frame'].includes(neighbor), `${name}: ${neighbor}`);
    if (panel.design === 'first' && panel.caption === 'added') {
      assert.equal(panel.flags?.caption, 'not drawn', `${name}: the blank caption is labeled`);
    }
  }
  assert.doesNotMatch(collage.panels.new_kinds.note, /caption/i, 'new_kinds stays general, so the transfer stays a prediction');
});

test('the helper describes canvases and rows the way the lesson words them', () => {
  const { panels } = collage;
  const right = 'cat, top right quarter; gig, left half of the bottom right quarter; taco, right half of the bottom right quarter';
  assert.equal(canvasDescription(collage, panels.start), `Canvas, in reading order: beach, left half; ${right}.`);
  assert.equal(canvasDescription(collage, panels.trace_press), 'Canvas: nothing drawn yet.');
  assert.equal(canvasDescription(collage, panels.trace_drawn),
    'Canvas, in reading order: beach, left half, drawn 1st; cat, top right quarter, drawn 2nd; '
    + 'gig, left half of the bottom right quarter, drawn 3rd; taco, right half of the bottom right quarter, drawn 4th.');
  assert.equal(canvasDescription(collage, panels.first_caption_blank),
    `Canvas, in reading order: beach, top left quarter; caption "core memories", bottom left quarter, tagged not drawn; ${right}.`);
  assert.equal(canvasDescription(collage, panels.caption),
    `Canvas, in reading order: beach, top left quarter; caption "core memories", bottom left quarter, tagged new; ${right}.`);
  assert.equal(canvasDescription(collage, panels.photo_shared),
    `Canvas, in reading order: beach, left half, tagged also in another story; ${right}.`);
  assert.match(canvasDescription(collage, panels.frame), /; cat, top right quarter, in a polaroid frame; /);
  assert.equal(pressDescription(collage, panels.start, 'bottom'), 'Canvas, in reading order: gig, left half; taco, right half.');
  assert.equal(pressDescription(collage, panels.start, 'beach'), 'Canvas, in reading order: beach, the whole story.');
  assert.equal(pressDescription(collage, panels.first_caption_blank, 'left'),
    'Canvas, in reading order: beach, top half; caption "core memories", bottom half, tagged not drawn.');
  assert.equal(pressDescription(collage, panels.first_caption_blank, 'caption'),
    'Canvas, in reading order: caption "core memories", the whole story.');
  assert.equal(pressDescription(collage, panels.caption, 'left'), 'Canvas, in reading order: beach, top half; caption "core memories", bottom half.');
  const tagsOf = (panel, id) => rowTags(collage, panel, rowsFor(collage, panel).find(row => row.id === id));
  assert.deepEqual(tagsOf(panels.start, 'story'), []);
  assert.deepEqual(tagsOf(panels.trace_press, 'story'), ['drawing']);
  assert.deepEqual(tagsOf(panels.trace_drawn, 'gig'), ['drawn 3rd']);
  assert.deepEqual(tagsOf(panels.photo_shared, 'beach'), ['Photo', 'also in another story']);
  assert.deepEqual(tagsOf(panels.role_client, 'cat'), ['Client']);
  assert.deepEqual(tagsOf(panels.first_caption_blank, 'caption'), ['not drawn']);
});
