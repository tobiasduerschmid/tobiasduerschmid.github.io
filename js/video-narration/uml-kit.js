/*
 * The UML kit: software structures drawn in UML on a narration's stage, in
 * the shapes and palette of ArchUML (js/ArchUML), the site's UML renderer,
 * so a diagram in a video reads like the diagrams in the chapters. It
 * follows the notations of Clements et al., Documenting Software
 * Architectures: Views and Beyond (2nd ed.), where each kind of view has its
 * own shapes, so a learner can tell them apart at a glance:
 *
 *   C&C view (what runs): a component is a box with the UML component icon.
 *     Connectors attach to ports, the small squares on its edge. A solid line
 *     with a filled arrowhead shows which way data or events flow, and its
 *     stereotype («pipe», «call») names the connector's type. A connector
 *     with behavior of its own, such as a topic, is drawn as a component.
 *   Module view (the code): a package is a folder with a tab; its modules sit
 *     inside it as small packages; a dependency is a dashed line with an open
 *     arrowhead, stereotyped «use» or «allowed to use». An interface is a box
 *     stereotyped «interface» that lists its operations.
 *   Allocation view (where it runs): a node is a box drawn in depth that holds
 *     what runs on it; a communication path is a solid line without heads.
 *
 * A frame names its view on the pentagon tab at its top-left corner, after
 * the UML diagram keyword (cmp, pkg, deployment). Elements are paper pieces
 * with dark ink in both modes, like ArchUML's light diagrams; the lines and
 * frames drawn straight on the sheet use the stage's tokens. Built on the
 * wall kit; styles: css/video-narration-uml-kit.css. Coordinates are CSS
 * pixels on the 960x540 stage.
 */
(function () {
  'use strict';

  const { fx } = window.Timeline;
  const { el, svg } = window.SongKit;
  const { staged, show, track } = window.WallKit;

  /**
   * The kinds of view a frame names: its UML diagram keyword, its name, and
   * its full name, which a lesson writes on the first frame of that view.
   */
  const VIEWS = {
    cnc: { keyword: 'cmp', name: 'C&C view', full: 'Component-and-connector (C&C) view' },
    module: { keyword: 'pkg', name: 'Module view', full: 'Module view' },
    allocation: { keyword: 'deployment', name: 'Allocation view', full: 'Allocation view' },
  };
  const stereo = (text) => `«${text}»`;
  const round = (v) => +v.toFixed(2);
  /** An element's outline width and a port's side, as in the stylesheet. */
  const BORDER = 2.5;
  const PORT = 14;
  /** How far a package's tab stands above its body (named, blank), and a node's depth. */
  const TAB = 32;
  const BLANK_TAB = 12;
  const DEPTH = 12;

  // ------------------------------------------------------------------
  // Frames: one per diagram, naming its view
  // ------------------------------------------------------------------

  /**
   * A diagram frame around [x, y, w, h]. Its view is always named on a
   * pentagon tab at its top-left corner: the UML keyword, the view, and the
   * diagram's own `title` after a colon ("cmp C&C view: photo desk"). Its
   * key (legend) runs along the top edge at the right: key = [[glyph,
   * words], ...], each glyph one of GLYPHS. Both sit in the frame's top
   * 32px, so the diagram starts below them; in a narrow frame, `keyAt:
   * 'bottom'` moves the key to the bottom edge. `fullName` spells out the
   * view's name, for the first frame of a view whose short name is an
   * abbreviation. It is drawn under every other piece of its picture.
   */
  function frame(parent, { x, y, w, h, view = 'cnc', title, fullName = false, key = [], keyAt = 'top', at, until, how = 'fade' }) {
    const kind = VIEWS[view];
    const node = staged(parent, `uk-frame uk-frame--${view}`, x, y);
    // Under everything else in its picture, so it never covers what it frames.
    parent.prepend(node);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    const tab = el('div', 'uk-frame-tab', node);
    const words = el('span', 'uk-frame-words', tab);
    el('b', 'uk-frame-keyword', words, kind.keyword);
    const name = fullName ? kind.full : kind.name;
    el('span', 'uk-frame-name', words, title ? `${name}: ${title}` : name);
    // The tab's cut corner, its slanted edge drawn in the frame's line.
    const corner = svg('svg', { class: 'uk-frame-corner', viewBox: '0 0 16 32', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, tab);
    svg('path', { class: 'uk-frame-corner-fill', d: 'M0 0 H16 V18 L2 32 H0 Z' }, corner);
    svg('path', { class: 'uk-frame-corner-line', d: 'M16 0 V18 L2 32 H0' }, corner);
    if (key.length) legend(node, key).classList.add(`uk-key--${keyAt}`);
    return show(node, at, until, how);
  }

  /*
   * The key's glyphs, drawn in a 30x20 box: what each shape of the notation
   * looks like, in the same colors as on the diagram.
   */
  const GLYPHS = {
    component: [['uk-g-fill', 'M6 3 H28 V17 H6 Z'], ['uk-g-paper', 'M2 6 H10 V9 H2 Z M2 11 H10 V14 H2 Z']],
    port: [['uk-g-paper', 'M10 5 H20 V15 H10 Z']],
    flow: [['uk-g-line', 'M2 10 H20'], ['uk-g-head', 'M19 5 L29 10 L19 15 Z']],
    dependency: [['uk-g-line uk-g-dash', 'M2 10 H27'], ['uk-g-line', 'M21 5 L28 10 L21 15']],
    link: [['uk-g-line', 'M2 10 H28']],
    attempt: [['uk-g-line uk-g-dash uk-g-red', 'M2 10 H20'], ['uk-g-head uk-g-red', 'M19 5 L29 10 L19 15 Z']],
    package: [['uk-g-paper uk-g-grey', 'M2 3 H12 V7 H2 Z M2 7 H28 V17 H2 Z']],
    module: [['uk-g-fill', 'M5 5 H13 V8 H5 Z M5 8 H25 V16 H5 Z']],
    interface: [['uk-g-fill', 'M4 3 H26 V17 H4 Z'], ['uk-g-line uk-g-thin', 'M4 10 H26']],
    node: [['uk-g-fill', 'M2 7 L7 2 H28 L23 7 Z M23 7 L28 2 V13 L23 18 Z'], ['uk-g-paper', 'M2 7 H23 V18 H2 Z']],
    topic: [['uk-g-line', 'M8 4 H22 A6 6 0 0 1 22 16 H8 A6 6 0 0 1 8 4 Z']],
    call: [['uk-g-line', 'M2 10 H20'], ['uk-g-head', 'M19 5 L29 10 L19 15 Z']],
    banned: [['uk-g-line uk-g-dash uk-g-red', 'M2 10 H27'], ['uk-g-line uk-g-red', 'M21 5 L28 10 L21 15']],
    realize: [['uk-g-line uk-g-dash', 'M2 10 H19'], ['uk-g-hollow', 'M19 4 L29 10 L19 16 Z']],
    control: [['uk-g-line uk-g-cyan', 'M2 10 H20'], ['uk-g-head uk-g-cyan', 'M19 5 L29 10 L19 15 Z']],
    boundary: [['uk-g-line uk-g-dash', 'M3 3 H27 V17 H3 Z']],
    // A use the style forbids: a red dependency struck by a cross, as on the diagram.
    forbidden: [['uk-g-line uk-g-dash uk-g-red', 'M2 10 H27'], ['uk-g-line uk-g-red', 'M21 5 L28 10 L21 15'], ['uk-g-line uk-g-red', 'M8 4 L16 16 M16 4 L8 16']],
    // A documented exception, such as layer bridging: an amber dependency.
    bridge: [['uk-g-line uk-g-dash uk-g-amber', 'M2 10 H27'], ['uk-g-line uk-g-amber', 'M21 5 L28 10 L21 15']],
    association: [['uk-g-line', 'M2 10 H27'], ['uk-g-line', 'M21 5 L28 10 L21 15']],
  };

  function glyph(parent, name) {
    const art = svg('svg', { class: 'uk-key-glyph', viewBox: '0 0 30 20', 'aria-hidden': 'true' }, parent);
    GLYPHS[name].forEach(([className, d]) => svg('path', { class: className, d }, art));
    return art;
  }

  /** A frame's key: the word Key, then each glyph beside the words it stands for. */
  function legend(frameNode, items) {
    const node = el('div', 'uk-key', frameNode);
    el('span', 'uk-key-title', node, 'Key');
    items.forEach(([name, words]) => {
      const item = el('span', 'uk-key-item', node);
      glyph(item, name);
      el('span', null, item, words);
    });
    return node;
  }

  // ------------------------------------------------------------------
  // Ports and geometry
  // ------------------------------------------------------------------

  /**
   * The point on a box's side where a port sits: `along` is a fraction of the
   * side (0 to 1) or, above 1, pixels from its start. box = { x, y, w, h }.
   */
  function edgePoint({ x, y, w, h }, side, along = 0.5) {
    const span = side === 'left' || side === 'right' ? h : w;
    const d = along <= 1 ? span * along : along;
    if (side === 'left') return [x, y + d];
    if (side === 'right') return [x + w, y + d];
    if (side === 'top') return [x + d, y];
    return [x + d, y + h];
  }

  /** A port's outer face on that side: where a connector leaves the port. */
  function portFace(box, side, along) {
    const [px, py] = edgePoint(box, side, along);
    const out = PORT / 2;
    if (side === 'left') return [px - out, py];
    if (side === 'right') return [px + out, py];
    if (side === 'top') return [px, py - out];
    return [px, py + out];
  }

  function addPort(node, box, side, along) {
    const [px, py] = edgePoint(box, side, along);
    const square = el('span', 'uk-port', node);
    // Placed from the padding box, inside the outline.
    square.style.left = `${round(px - box.x - BORDER - PORT / 2)}px`;
    square.style.top = `${round(py - box.y - BORDER - PORT / 2)}px`;
    return square;
  }

  // ------------------------------------------------------------------
  // C&C view: components
  // ------------------------------------------------------------------

  /** The UML component icon: a box with two small tabs on its left side. */
  function componentIcon(parent) {
    const art = svg('svg', { class: 'uk-icon', viewBox: '0 0 26 20', 'aria-hidden': 'true' }, parent);
    svg('path', { d: 'M6.5 1.5 H24.5 V18.5 H6.5 Z' }, art);
    svg('path', { d: 'M1.5 4.5 H11.5 V8.5 H1.5 Z M1.5 11.5 H11.5 V15.5 H1.5 Z' }, art);
    return art;
  }

  /**
   * A component: the UML component icon, an optional «stereotype», its name,
   * and compartments under a rule: `lines` that stay (such as the steps it
   * runs) and `sub`, words that change with its state. states = [{ at,
   * state, sub }] repaints it (busy, idle, crashed, down, new, same, changed,
   * unknown, focus, lit) and rewrites `sub`, so a state is always written in
   * words too. ports = [{ side, along }] draws ports on its edge (give `h`).
   * Returns the node; node.box is its geometry.
   */
  function component(parent, {
    x, y, w = 220, h, name, stereotype, sub, lines = [], states = [], ports = [],
    align = 'center', variant, at, until, how = 'pop',
  }) {
    const classes = ['uk-component', `uk-component--${align}`];
    if (!stereotype) classes.push('uk-component--bare');
    if (variant) classes.push(`uk-component--${variant}`);
    const node = staged(parent, classes.join(' '), x, y);
    node.style.width = `${w}px`;
    if (h) node.style.height = `${h}px`;
    componentIcon(node);
    const head = el('div', 'uk-head', node);
    if (stereotype) el('span', 'uk-stereo', head, stereo(stereotype));
    el('b', 'uk-name', head, name);
    if (lines.length) {
      const list = el('div', 'uk-compartment uk-lines', node);
      lines.forEach((text) => el('span', null, list, text));
    }
    let words = el('div', 'uk-compartment uk-sub', node, sub || '');
    if (!sub && !states.some((state) => state.sub)) {
      words.remove();
      words = undefined;
    }
    node.box = { x, y, w, h };
    ports.forEach(({ side, along }) => addPort(node, node.box, side, along));
    if (states.length) track(node, 'is-', states.map(({ at: when, state, sub: text }) => ({ at: when, state, words: text })), words);
    return show(node, at, until, how);
  }

  // ------------------------------------------------------------------
  // Module view: packages, modules, interfaces
  // ------------------------------------------------------------------

  /**
   * A package: a folder whose tab holds its «stereotype» and name, with its
   * modules inside as small packages (`items`). `y` is the top of its body;
   * the tab stands TAB pixels above it. With `tab: 'blank'` the tab is small
   * and empty and the name sits inside, as UML draws a package whose
   * contents are not shown (it stands BLANK_TAB pixels above). states =
   * [{ at, state }] repaints it (new, same, changed, lit); `variant` wrong
   * edges it in red for a design the narration calls wrong.
   */
  function pkg(parent, { x, y, w, h = 56, name, stereotype, items = [], tab = 'name', states = [], variant, at, until, how = 'rise' }) {
    const node = staged(parent, `uk-package uk-package--tab-${tab}${variant ? ` uk-package--${variant}` : ''}`, x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    const tabNode = el('div', 'uk-tab', node);
    const holder = tab === 'name' ? tabNode : el('div', 'uk-head uk-head--row', node);
    if (stereotype) el('span', 'uk-stereo', holder, stereo(stereotype));
    el('b', 'uk-name', holder, name);
    if (items.length) {
      const row = el('div', 'uk-modules', node);
      items.forEach((text) => el('span', 'uk-module', row, text));
    }
    node.box = { x, y, w, h };
    if (states.length) track(node, 'is-', states);
    return show(node, at, until, how);
  }

  /**
   * A classifier box: an optional «stereotype» and its name, then its
   * operations or attributes (`lines`, set in code type when `mono`). An
   * interface is one stereotyped «interface».
   */
  function classBox(parent, { x, y, w = 260, name, stereotype, lines = [], mono = true, states = [], at, until, how = 'pop' }) {
    const node = staged(parent, 'uk-class', x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'uk-head', node);
    if (stereotype) el('span', 'uk-stereo', head, stereo(stereotype));
    el('b', 'uk-name', head, name);
    if (lines.length) {
      const list = el('div', `uk-compartment uk-lines${mono ? ' uk-mono' : ''}`, node);
      lines.forEach((text) => el('span', null, list, text));
    }
    if (states.length) track(node, 'is-', states);
    return show(node, at, until, how);
  }

  // ------------------------------------------------------------------
  // Allocation view: nodes
  // ------------------------------------------------------------------

  /**
   * A node: a box drawn in depth (its top and right faces stand DEPTH pixels
   * outside it), its «stereotype» and name at its top left. What runs on it
   * is drawn inside, after it.
   */
  function deviceNode(parent, { x, y, w, h, name, stereotype, states = [], at, until, how = 'pop' }) {
    const node = staged(parent, 'uk-node', x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    const depth = svg('svg', { class: 'uk-node-depth', viewBox: `0 0 ${w + DEPTH} ${h + DEPTH}`, 'aria-hidden': 'true' }, node);
    depth.style.width = `${w + DEPTH}px`;
    depth.style.height = `${h + DEPTH}px`;
    // The front face's top-left corner is at (0, DEPTH) here.
    svg('path', { d: `M0 ${DEPTH} L${DEPTH} 0 H${w + DEPTH} L${w} ${DEPTH} Z M${w} ${DEPTH} L${w + DEPTH} 0 V${h} L${w} ${h + DEPTH} Z` }, depth);
    const head = el('div', 'uk-head', node);
    if (stereotype) el('span', 'uk-stereo', head, stereo(stereotype));
    el('b', 'uk-name', head, name);
    node.box = { x, y, w, h };
    if (states.length) track(node, 'is-', states);
    return show(node, at, until, how);
  }

  // ------------------------------------------------------------------
  // Relations: connectors, dependencies, communication paths
  // ------------------------------------------------------------------

  /**
   * A line between elements along `points` (or `from`, `to`), in stage
   * pixels. kind 'flow' is a solid line with a filled arrowhead (a C&C
   * connector: a pipe, an event, a call); 'link' a solid line without heads
   * (an attachment, a communication path); 'dependency' a dashed line with an
   * open arrowhead (the module view's «use» and «allowed to use»); 'realize'
   * a dashed line with a hollow triangle (a class implements an interface);
   * 'association' a solid line with an open arrowhead (a class holds
   * references to another, navigable toward the head); 'note' a dotted line
   * ending in a small circle, a note's anchor. `ends`
   * ('from', 'to', 'both') draws ports at those ends for elements drawn
   * without their own; an arrow then stops at the port. `tone` (red, green,
   * cyan, amber) marks one the narration singles out, which a label also says
   * in words; amber marks a documented exception, such as a layer bridge.
   * `dashed` dashes a flow that is only an attempt.
   */
  function connector(parent, { points, from, to, kind = 'flow', ends = 'none', tone, dashed = false, at, until }) {
    const path = points || [from, to];
    const last = path.length - 1;
    const [ax, ay] = path[last - 1];
    const [bx, by] = path[last];
    const length = Math.hypot(bx - ax, by - ay) || 1;
    const [ux, uy] = [(bx - ax) / length, (by - ay) / length];
    const portAt = (end) => ends === 'both' || ends === end;
    const tip = portAt('to') ? [bx - (ux * PORT) / 2, by - (uy * PORT) / 2] : [bx, by];
    const [HEAD, HALF] = kind === 'realize' ? [18, 10] : [16, 7];
    const wing = (sign) => [tip[0] - ux * HEAD - sign * uy * HALF, tip[1] - uy * HEAD + sign * ux * HALF];
    const head = kind === 'link' || kind === 'note' ? [] : [wing(1), tip, wing(-1)];
    // A flow's line stops inside its filled head, so no line pokes past the tip.
    const end = kind === 'flow' ? [tip[0] - ux * HEAD * 0.8, tip[1] - uy * HEAD * 0.8] : kind === 'realize' ? [tip[0] - ux * HEAD, tip[1] - uy * HEAD] : tip;
    const line = [...path.slice(0, last), end];
    const fromSquare = portAt('from') ? path[0] : null;
    const toSquare = portAt('to') ? path[last] : null;
    const corners = (point) => (point ? [[point[0] - PORT / 2, point[1] - PORT / 2], [point[0] + PORT / 2, point[1] + PORT / 2]] : []);
    const classes = ['uk-connector', `uk-connector--${kind}`];
    if (tone) classes.push(`uk-connector--${tone}`);
    if (dashed) classes.push('uk-connector--dashed');
    // Each straight segment is its own piece, so a bent line's box never
    // spreads over the elements it passes.
    const pieces = line.slice(1).map((b, i) => {
      const a = line[i];
      const first = i === 0;
      const lastPiece = i === line.length - 2;
      const extras = [
        ...(first ? corners(fromSquare) : []),
        ...(lastPiece ? [...head, ...corners(toSquare), ...(kind === 'note' ? [[bx - 6, by - 6], [bx + 6, by + 6]] : [])] : []),
      ];
      const all = [a, b, ...extras];
      const pad = 3;
      const minX = Math.min(...all.map((p) => p[0])) - pad;
      const minY = Math.min(...all.map((p) => p[1])) - pad;
      const w = Math.max(...all.map((p) => p[0])) + pad - minX;
      const h = Math.max(...all.map((p) => p[1])) + pad - minY;
      const node = staged(parent, classes.join(' '), round(minX), round(minY));
      node.style.width = `${round(w)}px`;
      node.style.height = `${round(h)}px`;
      const art = svg('svg', { class: 'uk-connector-art', viewBox: `0 0 ${round(w)} ${round(h)}`, 'aria-hidden': 'true' }, node);
      const local = ([px, py]) => `${round(px - minX)} ${round(py - minY)}`;
      const segment = `M${local(a)} L${local(b)}`;
      // A dark casing under the line and its head outlines the ink where the
      // line crosses paper or the lamp-lit sheet. Light mode's dark ink needs
      // none (the stylesheet hides it).
      if (kind !== 'note') svg('path', { class: 'uk-casing uk-casing--line', d: segment }, art);
      svg('path', { class: 'uk-line', d: segment }, art);
      if (lastPiece) {
        const tip = `M${head.map(local).join(' L')}`;
        const open = kind === 'dependency' || kind === 'association';
        if (open) svg('path', { class: 'uk-casing', d: tip }, art);
        else if (head.length) svg('path', { class: 'uk-casing uk-casing--head', d: `${tip} Z` }, art);
        if (kind === 'note') svg('circle', { class: 'uk-casing uk-casing--head', cx: round(bx - minX), cy: round(by - minY), r: 4.5 }, art);
        if (kind === 'flow') svg('path', { class: 'uk-arrow uk-arrow--filled', d: `M${head.map(local).join(' L')} Z` }, art);
        if (open) svg('path', { class: 'uk-arrow uk-arrow--open', d: `M${head.map(local).join(' L')}` }, art);
        if (kind === 'realize') svg('path', { class: 'uk-arrow uk-arrow--hollow', d: `M${head.map(local).join(' L')} Z` }, art);
        if (kind === 'note') svg('circle', { class: 'uk-note-anchor', cx: round(bx - minX), cy: round(by - minY), r: 4.5 }, art);
      }
      [first ? fromSquare : null, lastPiece ? toSquare : null].filter(Boolean).forEach(([px, py]) => svg('rect', {
        class: 'uk-end-port', x: round(px - minX - PORT / 2), y: round(py - minY - PORT / 2), width: PORT, height: PORT,
      }, art));
      fx.fadeIn(node, at, 0.35);
      if (until !== undefined) fx.fadeOut(node, until - 0.25, 0.25);
      return node;
    });
    return pieces[pieces.length - 1];
  }

  /**
   * A boundary laid over a C&C diagram around elements that belong
   * together without being an element themselves, such as a tier: a dashed
   * outline with its stereotyped name, and an optional line under it, at
   * its top left. Draw it before the elements inside it, so they sit on top.
   */
  function boundary(parent, { x, y, w, h, name, stereotype, sub, at, until, how = 'fade' }) {
    const node = staged(parent, 'uk-boundary', x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    const head = el('div', 'uk-boundary-head', node);
    const title = el('span', 'uk-boundary-name', head);
    if (stereotype) el('span', 'uk-boundary-stereo', title, stereo(stereotype));
    title.append(name);
    if (sub) el('span', 'uk-boundary-sub', head, sub);
    return show(node, at, until, how);
  }

  /**
   * A callout, drawn as ArchUML draws a note: a dog-eared box with words
   * (one line, `w` wide, at [x, y]) and a dotted anchor line to the point it
   * names (`to`), which ends in a small circle. The line leaves the side of
   * the box that faces the point, or faces the first of the bends (`via`)
   * that lead it around other shapes.
   */
  const NOTE_H = 36;
  function callout(parent, { x, y, w, text, to, via = [], tone, at, until, how = 'pop' }) {
    const node = staged(parent, `uk-note${tone ? ` uk-note--${tone}` : ''}`, x, y);
    node.style.width = `${w}px`;
    const art = svg('svg', { class: 'uk-note-art', viewBox: `0 0 ${w} ${NOTE_H}`, 'aria-hidden': 'true' }, node);
    svg('path', { class: 'uk-note-box', d: `M1 1 H${w - 13} L${w - 1} 13 V${NOTE_H - 1} H1 Z` }, art);
    svg('path', { class: 'uk-note-fold', d: `M${w - 13} 1 V13 H${w - 1}` }, art);
    el('span', 'uk-note-words', node, text);
    const [tx, ty] = via[0] || to;
    const clampX = Math.min(Math.max(tx, x + 14), x + w - 20);
    let start;
    if (ty >= y + NOTE_H) start = [clampX, y + NOTE_H];
    else if (ty <= y) start = [clampX, y];
    else start = tx < x ? [x, y + NOTE_H / 2] : [x + w, y + NOTE_H / 2];
    show(node, at, until, how);
    connector(parent, { points: [start, ...via, to], kind: 'note', at: at + 0.15, until });
    return node;
  }

  /**
   * A connector's or relation's type, set beside its line, never on it:
   * «pipe», «allowed to use». Plain words (`stereotype: false`) name what
   * the line does in this picture.
   */
  function label(parent, { x, y, text, stereotype = true, tone, at, until, how = 'fade' }) {
    const node = staged(parent, `uk-label${tone ? ` uk-label--${tone}` : ''}${stereotype ? '' : ' uk-label--plain'}`, x, y, stereotype ? stereo(text) : text);
    return show(node, at, until, how);
  }

  window.UmlKit = {
    VIEWS, TAB, BLANK_TAB, DEPTH, PORT, GLYPHS, stereo, frame, edgePoint, portFace, componentIcon,
    component, pkg, classBox, node: deviceNode, connector, label, callout, boundary,
  };
})();
