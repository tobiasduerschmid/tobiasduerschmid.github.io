/* The photo collage of the Composite lesson, built with the pattern it
   teaches. Photo, Caption, and Split answer the same two requests, draw and
   photo count; the first design's splits ask "photo or split?" with no else,
   so they skip a caption. Each narration cue moves the collage to that cue's
   state; between cues, learners press Share on any tile and watch it fill the
   whole story, one tile at a time. */
(function () {
  'use strict';
  const SVG = 'http://www.w3.org/2000/svg';
  const STEP_MS = 320; // how long each drawing step stays on screen
  const SHARE_ICON = 'M8 10.5V2.5M5 5.5l3-3 3 3M3.5 9v4.5h9V9';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let collages = 0;

  function el(tag, attributes = {}, ...children) {
    const element = tag.startsWith('svg:')
      ? document.createElementNS(SVG, tag.slice(4)) : document.createElement(tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    element.append(...children);
    return element;
  }

  const wait = ms => new Promise(resolve => { setTimeout(resolve, reducedMotion.matches ? 0 : ms); });
  const ordinal = n => `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th'}`;
  const photos = n => (n === 1 ? '1 photo' : `${n} photos`);
  const nameOf = row => (row.kind === 'caption' ? `caption "${row.text}"` : row.id);
  const describeCanvas = words => (words.length ? `Canvas, in reading order: ${words.join('; ')}.` : 'Canvas: nothing drawn yet.');
  // A panel's absent fields are missing from its JSON; give every field its empty value.
  const readCue = json => {
    const cue = JSON.parse(json);
    return {
      ...cue,
      caption: cue.caption || '',
      marked: cue.marked || [],
      mark: cue.mark || '',
      share_mark: cue.share_mark || '',
      flags: cue.flags || {},
      cuts: Boolean(cue.cuts),
      drawn: cue.drawn || null,
      current: cue.current || '',
      neighbors: cue.neighbors || [],
      note: cue.note || '',
    };
  };

  // An area of the story in story pixels; a split cuts it into equal parts.
  class Area {
    constructor(x, y, width, height) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
    }

    part(index, count, direction) {
      if (direction === 'side by side') {
        const width = this.width / count;
        return new Area(this.x + index * width, this.y, width, this.height);
      }
      const height = this.height / count;
      return new Area(this.x, this.y + index * height, this.width, height);
    }
  }

  // The canvas collects what a draw does, in call order: the areas splits
  // cut, the tiles drawn, and the tiles a first-design split skipped.
  class Canvas {
    constructor() { this.events = []; }
    cut(row, area) { this.events.push({ type: 'cut', row, area }); }
    draw(row, area) { this.events.push({ type: 'draw', row, area }); }
    skip(row, area) { this.events.push({ type: 'skip', row, area }); }
  }

  // Leaves answer both requests from their own data.
  class Photo {
    constructor(row) { this.row = row; }
    draw(area, canvas) { canvas.draw(this.row, area); }
    photoCount() { return 1; }
  }

  class Caption {
    constructor(row) { this.row = row; }
    draw(area, canvas) { canvas.draw(this.row, area); }
    photoCount() { return 0; }
  }

  // The composite forwards both requests to its tiles, in list order.
  class Split {
    constructor(row) {
      this.row = row;
      this.tiles = [];
    }

    add(tile) { this.tiles.push(tile); }

    draw(area, canvas) {
      canvas.cut(this.row, area);
      this.tiles.forEach((tile, index) => tile.draw(area.part(index, this.tiles.length, this.row.direction), canvas));
    }

    photoCount() { return this.tiles.reduce((total, tile) => total + tile.photoCount(), 0); }
  }

  // The first design: a split asks "photo or split?" and has no else. The
  // canvas notes the part a skipped item would have filled, so it shows blank.
  class FirstSplit {
    constructor(row) {
      this.row = row;
      this.items = [];
    }

    add(item) { this.items.push(item); }

    draw(area, canvas) {
      canvas.cut(this.row, area);
      this.items.forEach((item, index) => {
        const part = area.part(index, this.items.length, this.row.direction);
        if (item instanceof Photo) canvas.draw(item.row, part);
        else if (item instanceof FirstSplit) item.draw(part, canvas);
        else canvas.skip(item.row, part);
      });
    }

    photoCount() {
      let count = 0;
      for (const item of this.items) {
        if (item instanceof Photo) count += 1;
        else if (item instanceof FirstSplit) count += item.photoCount();
      }
      return count;
    }
  }

  // Rows list the tree in order; each belongs to the closest earlier split one level up.
  function build(rows, design) {
    const Group = design === 'first' ? FirstSplit : Split;
    const tiles = new Map();
    const open = [];
    for (const row of rows) {
      let tile;
      if (row.kind === 'split') tile = new Group(row);
      else if (row.kind === 'caption') tile = new Caption(row);
      else tile = new Photo(row);
      tiles.set(row.id, tile);
      open.length = row.depth;
      if (row.depth > 0) open[row.depth - 1].add(tile);
      if (row.kind === 'split') open[row.depth] = tile;
    }
    return tiles;
  }

  // The splits that hold a row, nearest first.
  function splitsAbove(rows, id) {
    const chain = [];
    let index = rows.findIndex(row => row.id === id);
    let depth = rows[index].depth;
    for (index -= 1; index >= 0 && depth > 0; index -= 1) {
      if (rows[index].depth < depth) {
        chain.push(rows[index].id);
        depth = rows[index].depth;
      }
    }
    return chain;
  }

  // One press of Share: the selection draws into the whole story area. The
  // first design's Share button checks the kind too; it did learn captions.
  function share(tile, design, story) {
    const canvas = new Canvas();
    if (design === 'first' && !(tile instanceof FirstSplit)) canvas.draw(tile.row, story);
    else tile.draw(story, canvas);
    return canvas.events;
  }

  class Collage {
    constructor(panel) {
      this.panel = panel;
      this.trees = JSON.parse(panel.dataset.compositeRows);
      this.positions = JSON.parse(panel.dataset.compositePositions);
      this.neighbors = JSON.parse(panel.dataset.compositeNeighbors);
      this.size = JSON.parse(panel.dataset.compositeCanvas);
      this.art = panel.dataset.compositeArt;
      this.id = `composite-collage-${++collages}`;
      this.token = 0;
      this.cue = null;
      this.structure = '';
      this.render();
      this.applyCue(readCue(panel.dataset.compositeCue), false);
    }

    // Replace the static picture with the same collage as live controls.
    render() {
      const panel = this.panel;
      panel.removeAttribute('aria-label');
      panel.classList.add('is-live');
      panel.setAttribute('role', 'group');
      panel.setAttribute('aria-labelledby', `${this.id}-title`);
      this.title = el('div', { class: 'nja-window-bar', id: `${this.id}-title` });
      this.canvas = el('div', { class: 'composite-canvas', role: 'img' });
      this.tree = el('ul', { class: 'composite-tree', 'aria-label': 'Layout tree' });
      this.pending = el('p', { class: 'composite-pending', hidden: '' });
      this.carousel = this.carouselFigure();
      this.note = el('p', { class: 'composite-collage-note' });
      this.status = el('p', { class: 'composite-collage-status', role: 'status' });
      const reset = el('button', { type: 'button', class: 'composite-reset' }, 'Back to the narration’s picture');
      reset.addEventListener('click', () => {
        this.applyCue(this.cue, false);
        this.status.textContent = 'The story is back to the narration’s picture.';
      });
      // Space presses a focused Share or reset button, as on any button, instead of starting the narration.
      panel.addEventListener('keydown', event => {
        if (event.key === ' ') event.stopPropagation();
      });
      // The status stays rendered, even when empty, so screen readers announce what is added.
      panel.replaceChildren(this.title, el('div', { class: 'composite-collage-body' },
        this.canvas, this.tree, this.pending, this.carousel, this.note,
        el('div', { class: 'composite-collage-controls' }, reset, this.status)));
    }

    // The carousel post, a neighbor of the pattern: a picture, not part of the tree.
    carouselFigure() {
      const ids = this.neighbors.carousel;
      const rows = new Map(this.trees.rows.map(row => [row.id, row]));
      const count = { 2: 'two', 3: 'three', 4: 'four' }[ids.length] || String(ids.length);
      const list = ids.length > 1 ? `${ids.slice(0, -1).join(', ')}, and ${ids.at(-1)}` : ids[0];
      return el('figure', {
        class: 'composite-carousel', role: 'img', hidden: '',
        'aria-label': `Carousel post: a flat list of ${count} photos, ${list}, showing 1 of ${ids.length}.`,
      },
      el('div', { class: 'composite-carousel-strip' },
        ...ids.map(id => el('img', { class: 'composite-art composite-thumb', src: `${this.art}${rows.get(id).art}`, alt: '' }))),
      el('figcaption', {}, el('span', { class: 'composite-tag composite-tag--neighbor' }, 'carousel post'), ` 1 of ${ids.length}`));
    }

    get story() { return new Area(0, 0, this.size.width, this.size.height); }

    // Rebuild the layout tree for a design and a caption state. A focused
    // Share button is replaced by the same tile's new button or, when that
    // tile leaves the tree, by the button of the nearest split that stays.
    drawTree(cue) {
      const focused = this.tree.contains(document.activeElement)
        ? document.activeElement.closest('[data-tile]')?.dataset.tile : null;
      const keep = focused ? [focused, ...splitsAbove(this.rows, focused)] : [];
      this.rows = cue.caption === 'added' ? this.trees.captioned_rows : this.trees.rows;
      this.tiles = build(this.rows, cue.design);
      this.design = cue.design;
      this.rowParts = new Map();
      this.tree.replaceChildren(...this.rows.map(row => {
        const button = el('button', { type: 'button', class: 'composite-share', 'aria-label': `Share ${row.id}` },
          el('svg:svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' }, el('svg:path', { d: SHARE_ICON })));
        button.addEventListener('click', () => this.press(row.id));
        const tags = el('span', { class: 'composite-tags' });
        const kind = row.kind === 'split' ? `split, ${row.direction}` : row.kind;
        const item = el('li', { class: `composite-node composite-node--depth-${row.depth} composite-node--${row.kind}` },
          el('span', { class: 'composite-node-main' }, button, el('span', { class: 'composite-name' }, row.id)), ' ',
          el('span', { class: 'composite-kind' }, kind), ' ',
          el('span', { class: 'composite-count' }, photos(this.tiles.get(row.id).photoCount())), tags);
        item.dataset.tile = row.id;
        this.rowParts.set(row.id, { item, tags });
        return item;
      }));
      this.structure = `${cue.design}|${cue.caption === 'added'}`;
      const target = keep.find(id => this.rowParts.has(id));
      if (target) this.rowParts.get(target).item.querySelector('button').focus({ preventScroll: true });
    }

    // A cue's marks, flags, and trace, each with a text tag; no cue clears them.
    drawTags(cue, drawn = cue ? cue.drawn : null, current = cue ? cue.current : '') {
      this.rowParts.forEach(({ tags }, id) => {
        const words = [];
        if (cue) {
          if (cue.marked.includes(id)) words.push(['mark', cue.mark]);
          if (cue.share_mark) words.push(['share', cue.share_mark]);
          if (cue.flags[id]) words.push(['flag', cue.flags[id]]);
          if (current === id) words.push(['current', 'drawing']);
          const at = (drawn || []).indexOf(id);
          if (at >= 0) words.push(['drawn', `drawn ${ordinal(at + 1)}`]);
        }
        tags.replaceChildren(...words.flatMap(([kind, text]) => [' ', el('span', { class: `composite-tag composite-tag--${kind}` }, text)]));
      });
    }

    // Grid classes and the position-words key for an area.
    place(area) {
      const cellWidth = this.size.width / this.size.columns;
      const cellHeight = this.size.height / this.size.rows;
      const [x, y, w, h] = [area.x / cellWidth, area.y / cellHeight, area.width / cellWidth, area.height / cellHeight];
      return { key: `${x},${y},${w},${h}`, classes: `composite-cell--x${x} composite-cell--y${y} composite-cell--w${w} composite-cell--h${h}` };
    }

    // Paint drawn and skipped tiles and the outlines, and name the canvas.
    paint(entries, { ordinals = false, flags = {}, framed = '', outlines = [], current = '', fresh = null } = {}) {
      const words = [];
      const cells = entries.map((event, index) => {
        const { row } = event;
        const drawn = event.type === 'draw';
        const { key, classes } = this.place(event.area);
        const order = ordinal(index + 1);
        let phrase = `${nameOf(row)}, ${this.positions[key]}`;
        if (ordinals) phrase += `, drawn ${order}`;
        if (row.id === framed) phrase += ', in a polaroid frame';
        if (drawn && flags[row.id]) phrase += `, tagged ${flags[row.id]}`;
        if (!drawn) phrase += ', tagged not drawn';
        words.push(phrase);
        const cell = el('div', { class: `composite-cell ${classes} composite-cell--${row.kind}${drawn ? '' : ' is-blank'}${row.id === framed ? ' is-framed' : ''}${event === fresh ? ' is-new' : ''}` });
        cell.dataset.tile = row.id;
        if (drawn && row.kind === 'photo') cell.append(el('img', { class: 'composite-art', src: `${this.art}${row.art}`, alt: '' }));
        if (drawn && row.kind === 'caption') cell.append(el('span', { class: 'composite-caption-text' }, row.text));
        const labels = el('span', { class: 'composite-cell-labels' }, el('span', { class: 'composite-chip' }, row.id));
        if (ordinals) labels.append(' ', el('span', { class: 'composite-badge' }, order));
        if (row.id === framed) labels.append(' ', el('span', { class: 'composite-tag composite-tag--neighbor' }, 'polaroid frame'));
        if (drawn && flags[row.id]) labels.append(' ', el('span', { class: 'composite-tag composite-tag--flag' }, flags[row.id]));
        if (!drawn) labels.append(' ', el('span', { class: 'composite-tag composite-tag--blank' }, 'not drawn'));
        cell.append(labels);
        return cell;
      });
      const areas = outlines.map(cut => {
        const isCurrent = cut.row.id === current;
        const area = el('span', { class: `composite-area ${this.place(cut.area).classes}${isCurrent ? ' is-current' : ''}` });
        if (isCurrent) area.append(el('span', { class: 'composite-area-label' }, `${cut.row.id} · ${cut.row.direction}`));
        return area;
      });
      this.canvas.replaceChildren(...cells, ...areas);
      this.canvas.setAttribute('aria-label', describeCanvas(words));
    }

    // A narrated state, or a step of a narrated trace: the first `reached`
    // tiles drawn, with `current` the split cutting its area now.
    paintCue(cue, events, reached = cue.drawn ? cue.drawn.length : null, current = cue.current, fresh = null) {
      let entries = events.filter(event => event.type !== 'cut');
      if (reached !== null) entries = entries.filter(event => event.type === 'draw').slice(0, reached);
      const outlines = events.filter(event => event.type === 'cut' && (cue.cuts || event.row.id === current));
      const framed = cue.neighbors.includes('frame') ? this.neighbors.frame : '';
      this.paint(entries, { ordinals: reached !== null, flags: cue.flags, framed, outlines, current, fresh });
      return entries.map(event => event.row.id);
    }

    showExtras(cue) {
      this.pending.hidden = cue.caption !== 'pending';
      if (!this.pending.hidden) {
        const rows = this.trees.captioned_rows;
        const caption = rows.find(row => row.kind === 'caption');
        const above = rows[rows.indexOf(caption) - 1];
        this.pending.replaceChildren(el('span', { class: 'composite-tag composite-tag--flag' }, 'new'),
          ` caption “${caption.text}” waits to go under ${above.id}`);
      }
      this.carousel.hidden = !cue.neighbors.includes('carousel');
    }

    // Move to a cue's state. When the cue continues the previous cue's trace,
    // the newly drawn tiles appear one at a time, each split outlined as it cuts.
    async applyCue(cue, animate) {
      const token = ++this.token;
      const previous = this.cue;
      this.cue = cue;
      const sameTree = `${cue.design}|${cue.caption === 'added'}` === this.structure;
      if (!sameTree) this.drawTree(cue);
      this.title.textContent = `Summer story · ${cue.design} design · try it: press Share on any tile`;
      this.note.hidden = false;
      this.note.textContent = cue.note;
      this.status.textContent = '';
      this.showExtras(cue);
      const events = share(this.tiles.get(this.rows[0].id), cue.design, this.story);
      const before = previous && previous.drawn;
      const continues = animate && sameTree && cue.drawn && before && cue.drawn.length > before.length
        && before.every((id, index) => cue.drawn[index] === id);
      if (continues) {
        let reached = 0;
        let current = previous.current;
        for (const event of events) {
          if (event.type === 'cut') current = event.row.id;
          else reached += 1;
          if (reached <= before.length && event.type === 'cut') continue;
          if (reached <= before.length || reached > cue.drawn.length) continue;
          await wait(STEP_MS);
          if (token !== this.token) return;
          const fresh = event.type === 'cut' ? null : event;
          const drawn = this.paintCue(cue, events, reached, current, fresh);
          this.drawTags(cue, drawn, current);
        }
        await wait(STEP_MS);
        if (token !== this.token) return;
      }
      this.paintCue(cue, events);
      this.drawTags(cue);
    }

    // A learner's press: the tile draws into the whole story, one step at a
    // time, in the design on screen.
    async press(id) {
      const token = ++this.token;
      const tile = this.tiles.get(id);
      const events = share(tile, this.design, this.story);
      // On narrow layouts the canvas sits above the tree; show it for the learner's own press.
      this.canvas.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      this.note.hidden = true;
      this.status.textContent = '';
      this.drawTags(null);
      const shown = [];
      let current = '';
      this.paint([]);
      for (const event of events) {
        if (event.type === 'cut') current = event.row.id;
        else shown.push(event);
        const outlines = event.type === 'cut' || current ? events.filter(cut => cut.type === 'cut' && cut.row.id === current) : [];
        this.paint(shown, { outlines, current, fresh: event.type === 'cut' ? null : event });
        await wait(STEP_MS);
        if (token !== this.token) return;
      }
      this.paint(shown);
      const skipped = shown.some(event => event.type === 'skip');
      this.status.textContent = `Shared ${id}: ${photos(tile.photoCount())}.`
        + (skipped ? ' The caption’s area stays blank: Split.draw has no branch for captions.' : '');
    }
  }

  // Each scene's collage stays live; cue changes move it instead of replacing it.
  document.querySelectorAll('.narrated-pattern .nja-stage [data-np-visual] .composite-collage').forEach(panel => {
    const collage = new Collage(panel);
    panel.closest('[data-np-visual]').addEventListener('narrated-pattern:cue', event => {
      const settled = event.detail.settled.querySelector('.composite-collage');
      if (!settled) return;
      event.preventDefault();
      collage.applyCue(readCue(settled.dataset.compositeCue), true);
    });
  });
})();
