// The Composite lesson's photo collage, specified independently of every
// implementation that the lesson ships (the four-language code, the static
// panel, and js/composite-collage.js). Tests compare those implementations
// with this specification; scripts/tests/composite-narration.test.js pins the
// specification itself against hand-derived values.
const { readFileSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ORACLE = path.resolve(__dirname, '../../_data/explainers/composite_ui.yml');
let loaded = null;

/** The parsed oracle, _data/explainers/composite_ui.yml. */
function load() {
  loaded ??= yaml.load(readFileSync(ORACLE, 'utf8'));
  return loaded;
}

/** The tiles of `rows` by ID; each row belongs to the closest earlier split one level up. */
function tree(rows) {
  const nodes = new Map(rows.map(row => [row.id, { row, tiles: [] }]));
  const open = [];
  for (const row of rows) {
    open.length = row.depth;
    if (row.depth > 0) open[row.depth - 1].tiles.push(nodes.get(row.id));
    if (row.kind === 'split') open[row.depth] = nodes.get(row.id);
  }
  return nodes;
}

/** The tree a panel shows: the caption joins it only once it is added. */
function rowsFor(collage, panel) {
  return panel.caption === 'added' ? collage.captioned_rows : collage.rows;
}

/** Part `index` of `count` equal parts of `area`, side by side or stacked. */
function part([x, y, width, height], index, count, direction) {
  if (direction === 'side by side') return [x + index * (width / count), y, width / count, height];
  if (direction === 'stacked') return [x, y + index * (height / count), width, height / count];
  throw new Error(`unknown direction: ${direction}`);
}

// The first design's splits ask "photo or split?" with no else, so they skip
// every other kind of tile. Its Share button did learn about captions.
const FIRST_DESIGN_KINDS = ['photo', 'split'];

/** What drawing `node` into `area` does, in call order: cuts, draws, and skips. */
function draw(node, area, design) {
  const { row } = node;
  if (row.kind !== 'split') return [{ type: 'draw', tile: row.id, area }];
  const events = [{ type: 'cut', tile: row.id, area }];
  node.tiles.forEach((child, index) => {
    const childArea = part(area, index, node.tiles.length, row.direction);
    if (design === 'first' && !FIRST_DESIGN_KINDS.includes(child.row.kind)) {
      events.push({ type: 'skip', tile: child.row.id, area: childArea });
    } else {
      events.push(...draw(child, childArea, design));
    }
  });
  return events;
}

/** How many photos a tile holds; captions and other leaves hold none. */
function photoCount(node) {
  if (node.row.kind === 'photo') return 1;
  return node.tiles.reduce((total, child) => total + photoCount(child), 0);
}

/** One press of Share on tile `id`: it draws into the whole story area. */
function share(nodes, id, design) {
  const { width, height } = load().canvas;
  const events = draw(nodes.get(id), [0, 0, width, height], design);
  const entries = type => events.filter(event => event.type === type).map(({ tile, area }) => ({ tile, area }));
  return { events, drawn: entries('draw'), skipped: entries('skip'), cuts: entries('cut'), photos: photoCount(nodes.get(id)) };
}

/** How a tile is named on the canvas and in drawn lines. */
function nameOf(row) {
  if (row.kind === 'caption') return `caption "${row.text}"`;
  if (row.kind === 'gif') return `gif ${row.name}`;
  return row.id;
}

/** The line a drawn tile adds to the canvas in the lesson's code. */
function line({ tile, area: [x, y, width, height] }, rowsById) {
  return `${nameOf(rowsById.get(tile))} ${width}x${height} at ${x},${y}`;
}

/** An area in grid cells, [column, row, columns wide, rows tall]. */
function cell([x, y, width, height]) {
  const { width: storyWidth, height: storyHeight, columns, rows } = load().canvas;
  const [cellWidth, cellHeight] = [storyWidth / columns, storyHeight / rows];
  return [x / cellWidth, y / cellHeight, width / cellWidth, height / cellHeight];
}

/** Where an area sits on the story, in words. */
function position(collage, area) {
  const key = cell(area).join(',');
  const words = collage.positions[key];
  if (!words) throw new Error(`no position words for the cell ${key}`);
  return words;
}

function ordinal(number) {
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[number % 100 > 10 && number % 100 < 14 ? 0 : number % 10] || 'th';
  return `${number}${suffix}`;
}

function describe(entries) {
  return entries.length ? `Canvas, in reading order: ${entries.join('; ')}.` : 'Canvas: nothing drawn yet.';
}

/** The canvas of a narrated state: Share on the story, with the panel's trace, flags, and frame. */
function canvasDescription(collage, panel) {
  const rows = rowsFor(collage, panel);
  const rowsById = new Map(rows.map(row => [row.id, row]));
  let events = share(tree(rows), 'story', panel.design).events.filter(event => event.type !== 'cut');
  if (panel.drawn) events = events.slice(0, panel.drawn.length);
  const framed = (panel.neighbors || []).includes('frame') ? collage.neighbors.frame : null;
  return describe(events.map((event, index) => {
    let words = `${nameOf(rowsById.get(event.tile))}, ${position(collage, event.area)}`;
    if (panel.drawn) words += `, drawn ${ordinal(index + 1)}`;
    if (event.tile === framed) words += ', in a polaroid frame';
    if (event.type === 'draw' && panel.flags?.[event.tile]) words += `, tagged ${panel.flags[event.tile]}`;
    if (event.type === 'skip') words += ', tagged not drawn';
    return words;
  }));
}

/** The canvas after a learner presses Share on `id` in a panel's tree and design. */
function pressDescription(collage, panel, id) {
  const rows = rowsFor(collage, panel);
  const rowsById = new Map(rows.map(row => [row.id, row]));
  const events = share(tree(rows), id, panel.design).events.filter(event => event.type !== 'cut');
  return describe(events.map(event => `${nameOf(rowsById.get(event.tile))}, ${position(collage, event.area)}`
    + (event.type === 'skip' ? ', tagged not drawn' : '')));
}

/** A layout-tree row's tags in a narrated state, in display order. */
function rowTags(collage, panel, row) {
  const tags = [];
  if ((panel.marked || []).includes(row.id)) tags.push(panel.mark);
  if (panel.share_mark) tags.push(panel.share_mark);
  if (panel.flags?.[row.id]) tags.push(panel.flags[row.id]);
  if (panel.current === row.id) tags.push('drawing');
  const drawnAt = (panel.drawn || []).indexOf(row.id);
  if (drawnAt >= 0) tags.push(`drawn ${ordinal(drawnAt + 1)}`);
  return tags;
}

module.exports = {
  load, tree, rowsFor, part, draw, share, photoCount, line, cell, position,
  canvasDescription, pressDescription, rowTags,
};
