/*
 * Visual kit for song-video choreographies: DOM builders for the recurring
 * pieces of a music video (stickers, stamps, kinetic type, a terminal, Git
 * stations, file chips, flow arrows, snapshot cards, GitGraph panels, the
 * Time Stone, confetti). Every builder schedules its own motion on the
 * Timeline, so a choreography reads as "what appears when".
 *
 * Coordinates are CSS pixels on the 960×540 stage. Times are song seconds.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, clamp, progress, hash01, beats, camera } = window.Timeline;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // ------------------------------------------------------------------
  // DOM helpers
  // ------------------------------------------------------------------

  function el(tag, className, parent, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    if (parent) parent.append(node);
    return node;
  }

  function svg(tag, attrs = {}, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    if (parent) parent.append(node);
    return node;
  }

  function place(node, x, y) {
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    return node;
  }

  // ------------------------------------------------------------------
  // Icons: one 24×24 line family (2-unit round strokes in currentColor)
  // ------------------------------------------------------------------

  const ICONS = {
    camera: [['path', { d: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z' }], ['circle', { cx: 12, cy: 13, r: 3.5 }]],
    laptop: [['rect', { x: 5, y: 5, width: 14, height: 10, rx: 1.5 }], ['path', { d: 'M2 19l2-3h16l2 3z' }]],
    cloud: [['path', { d: 'M7 18h10.5a4 4 0 0 0 .3-8A6 6 0 0 0 6.2 9.4 4.4 4.4 0 0 0 7 18z' }]],
    stack: [['rect', { x: 4, y: 9, width: 13, height: 11, rx: 1.5 }], ['path', { d: 'M7 6h12v11' }], ['path', { d: 'M10 3h11v11' }]],
    pencil: [['path', { d: 'M4 20l4.2-1.1L19 8.1 15.9 5 5.1 15.8z' }], ['path', { d: 'M13.8 7.1l3.1 3.1' }]],
    lock: [['rect', { x: 5, y: 11, width: 14, height: 9, rx: 2 }], ['path', { d: 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3' }]],
    pin: [['path', { d: 'M12 21s-6-5.4-6-10.5a6 6 0 0 1 12 0C18 15.6 12 21 12 21z' }], ['circle', { cx: 12, cy: 10.5, r: 2.2 }]],
    tag: [['path', { d: 'M3 12V4h8l10 10-8 7z' }], ['circle', { cx: 7.5, cy: 8, r: 1.4 }]],
    pointer: [['path', { d: 'M3 7.5h11l5.5 4.5-5.5 4.5H3z' }]],
    file: [['path', { d: 'M6 3h8l4 4v14H6z' }], ['path', { d: 'M14 3v4h4' }]],
    check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
    cross: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
    bolt: [['path', { d: 'M13 2L4.5 13.5H11L10 22l8.5-11.5H12z' }]],
    snow: [['path', { d: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2' }]],
    forward: [['path', { d: 'M3 6l8 6-8 6zM12 6l8 6-8 6z' }]],
    rewind: [['path', { d: 'M21 6l-8 6 8 6zM12 6l-8 6 8 6z' }]],
    team: [['circle', { cx: 8, cy: 8.5, r: 3 }], ['circle', { cx: 16.5, cy: 8.5, r: 3 }], ['path', { d: 'M2.5 19.5a5.5 5.5 0 0 1 11 0M11 19.5a5.5 5.5 0 0 1 11 0' }]],
    shield: [['path', { d: 'M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6z' }], ['path', { d: 'M8.8 12l2.3 2.3 4.1-4.6' }]],
    warning: [['path', { d: 'M12 3.5l9.5 16.5h-19z' }], ['path', { d: 'M12 10v4.5M12 17.4v.1' }]],
    search: [['circle', { cx: 10.5, cy: 10.5, r: 6 }], ['path', { d: 'M15 15l5.5 5.5' }]],
    sparkle: [['path', { d: 'M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z' }]],
    merge: [['circle', { cx: 6, cy: 5, r: 2 }], ['circle', { cx: 18, cy: 5, r: 2 }], ['circle', { cx: 12, cy: 19, r: 2 }], ['path', { d: 'M6 7c0 5 6 5 6 10M18 7c0 5-6 5-6 10' }]],
  };

  function icon(name, className) {
    const shapes = ICONS[name];
    if (!shapes) throw new Error(`kit.js has no icon "${name}".`);
    const node = svg('svg', {
      viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
    });
    if (className) node.setAttribute('class', className);
    for (const [tag, attrs] of shapes) svg(tag, attrs, node);
    return node;
  }

  // ------------------------------------------------------------------
  // Scenes: a positioned layer that enters and leaves as a unit
  // ------------------------------------------------------------------

  function scene(parent, from, to, { enter = 'fade', exit = 'whip' } = {}) {
    const node = el('div', 'scene is-staged', parent);
    if (enter === 'whip') fx.slideIn(node, from, { dx: 70, duration: 0.32 });
    else fx.fadeIn(node, from, 0.25);
    if (to !== undefined) {
      if (exit === 'whip') fx.exit(node, to - 0.28, { dx: -70, duration: 0.28 });
      else fx.fadeOut(node, to - 0.3, 0.3);
    }
    return node;
  }

  // ------------------------------------------------------------------
  // Stickers, stamps, kinetic type
  // ------------------------------------------------------------------

  function sticker(parent, text, { x, y, at, until, variant = 'white', iconName, rotate = -4 }) {
    const node = place(el('div', `sticker sticker--${variant} is-staged`, parent), x, y);
    if (iconName) node.append(icon(iconName));
    node.append(document.createTextNode(text));
    fx.pop(node, at, { rotate });
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  function stamp(parent, text, { x, y, at, until, color = 'red', rotate = -8, shake = true }) {
    const node = place(el('div', `stamp stamp--${color} is-staged`, parent, text), x, y);
    fx.slam(node, at, { from: 2.6, rotate });
    if (shake) camera.shake(at + 0.12, 6);
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /** A row of words that slam in one at a time: words = [{ text, at, color, iconName }]. */
  function kinetic(parent, words, { y, size = 64, until, punch = true }) {
    const row = el('div', 'kinetic', parent);
    row.style.top = `${y}px`;
    row.style.fontSize = `${size}px`;
    for (const word of words) {
      const node = el('span', `kinetic-word${word.color ? ` kinetic-word--${word.color}` : ''} is-staged`, row);
      if (word.iconName) node.append(icon(word.iconName));
      node.append(document.createTextNode(word.text));
      fx.slam(node, word.at, { from: 2.2, rotate: word.rotate || 0 });
      if (punch) camera.punch(word.at + 0.05, 0.03);
    }
    if (until !== undefined) fx.exit(row, until, { dx: 0, dy: -30, duration: 0.25 });
    return row;
  }

  // ------------------------------------------------------------------
  // HUD: section badge and terminal
  // ------------------------------------------------------------------

  function badge(parent, text, from, to) {
    const node = el('div', 'badge is-staged', parent, text);
    fx.pop(node, from, { rotate: -2 });
    if (to !== undefined) fx.popOut(node, to - 0.25);
    return node;
  }

  const TERMINAL_LINES = 3;
  const TERMINAL_LINE_HEIGHT = 22;

  /**
   * The HUD terminal. run(at, text, { kind }) adds a line: commands type out
   * at TYPE_CPS characters per second; output lines appear whole. Lines only
   * show inside a window(from, to) that contains them, newest at the bottom.
   */
  function terminal(parent) {
    const TYPE_CPS = 45;
    const node = el('div', 'terminal is-staged', parent);
    const bar = el('div', 'terminal-bar', node);
    for (let i = 0; i < 3; i++) el('span', 'terminal-dot', bar);
    el('span', 'terminal-title', bar, 'terminal');
    const body = el('div', 'terminal-body', node);
    const slots = Array.from({ length: TERMINAL_LINES }, () => el('div', 'terminal-line', body));
    const cursor = el('span', 'terminal-cursor');
    const windows = [];
    const lines = [];

    onFrame((t) => {
      const active = windows.find((w) => t >= w.from && t < w.to);
      const shown = active ? lines.filter((line) => line.at <= t && line.at >= active.from && line.at < active.to) : [];
      const visible = shown.slice(-TERMINAL_LINES);
      slots.forEach((slot, i) => {
        const line = visible[visible.length - 1 - i];
        slot.style.transform = `translateY(${-i * TERMINAL_LINE_HEIGHT}px)`;
        if (!line) {
          slot.textContent = '';
          slot.className = 'terminal-line';
          return;
        }
        slot.className = `terminal-line terminal-line--${line.kind}`;
        const typed = line.kind === 'command'
          ? line.text.slice(0, Math.floor((t - line.at) * TYPE_CPS) + 1)
          : line.text;
        slot.textContent = typed;
        const typing = typed.length < line.text.length;
        if (i === 0 && line.kind === 'command' && (typing || Math.floor(t * 2.5) % 2 === 0)) slot.append(cursor);
      });
    });

    return {
      node,
      window(from, to) {
        windows.push({ from, to });
        fx.slideIn(node, from, { dx: 40, duration: 0.3 });
        fx.exit(node, to - 0.25, { dx: 40, duration: 0.25 });
      },
      run(at, text, { kind = 'command' } = {}) {
        lines.push({ at, text, kind });
        lines.sort((a, b) => a.at - b.at);
      },
    };
  }

  // ------------------------------------------------------------------
  // Git stations, file chips, flow arrows
  // ------------------------------------------------------------------

  function station(parent, { x, y, w, h, label, iconName, remote = false, compact = false }) {
    const variants = `${remote ? ' station--remote' : ''}${compact ? ' station--compact' : ''}`;
    const node = place(el('div', `station${variants} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    const glow = el('div', 'station-glow is-staged', node);
    if (remote) glow.style.borderRadius = '60px 60px 18px 18px';
    const head = el('div', 'station-head', node);
    head.append(icon(iconName));
    head.append(document.createTextNode(label));
    return {
      node, x, y, w, h,
      enter(at, delay = 0) {
        fx.rise(node, at + delay, { distance: 24, duration: 0.4 });
        return this;
      },
      light(at, until) {
        tween(glow, [{ opacity: 0 }, { opacity: 1 }], at, 0.18, EASE.out);
        fx.bump(node, at, 0.05);
        if (until !== undefined) tween(glow, { opacity: 0 }, until, 0.3, EASE.in);
        return this;
      },
    };
  }

  /** A file chip; versions = [{ at, text }] flips its version badge over time. */
  function chip(parent, { name, x, y, version, versions = [], dashed = false }) {
    const node = place(el('div', `chip${dashed ? ' chip--dashed' : ''} is-staged`, parent), x, y);
    node.append(icon('file'));
    node.append(document.createTextNode(name));
    if (version !== undefined) {
      const badgeNode = el('span', 'chip-version', node, version);
      const changes = [...versions].sort((a, b) => a.at - b.at);
      if (changes.length) {
        onFrame((t) => {
          let text = version;
          for (const change of changes) if (change.at <= t) text = change.text;
          if (badgeNode.textContent !== text) badgeNode.textContent = text;
        });
        for (const change of changes) fx.bump(node, change.at, 0.16);
      }
    }
    return node;
  }

  /**
   * A copy of something flying from (fromX, fromY) to its own position:
   * the node is placed at its destination and tweened from the source offset.
   */
  function flyIn(node, at, fromX, fromY, { duration = 0.5, spin = 0, fromScale = 0.8 } = {}) {
    const dx = fromX - parseFloat(node.style.left);
    const dy = fromY - parseFloat(node.style.top);
    tween(node, [
      { opacity: 0.2, translate: `${dx}px ${dy}px`, scale: fromScale, rotate: `${spin}deg` },
      { opacity: 1, translate: '0 0', scale: 1, rotate: '0deg' },
    ], at, duration, EASE.inOut);
  }

  /** An arrow from `from` to `to` bowing by `bend` (negative = up), drawn on at `at`. */
  function flow(parent, { from, to, bend = -40, color = 'gold', at, until, label, labelAt }) {
    const art = svg('svg', { class: 'flow', viewBox: '0 0 960 540' }, parent);
    const [x1, y1] = from;
    const [x2, y2] = to;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 + bend;
    const path = svg('path', { class: `flow-path flow-path--${color}`, d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}` }, art);
    fx.draw(path, at, 0.32);
    const angle = Math.atan2(y2 - cy, x2 - cx) * 180 / Math.PI;
    const head = svg('path', {
      class: `flow-head flow-head--${color} is-staged`,
      d: 'M 0 0 L -14 -7 L -14 7 Z',
      transform: `translate(${x2} ${y2}) rotate(${angle.toFixed(1)})`,
    }, art);
    fx.fadeIn(head, at + 0.28, 0.08);
    let labelNode = null;
    if (label) {
      const [lx, ly] = labelAt || [cx - 40, cy - 16];
      labelNode = place(el('div', `cmd-chip cmd-chip--${color} is-staged`, parent, label), lx, ly);
      fx.pop(labelNode, at + 0.05, { rotate: -3 });
    }
    if (until !== undefined) {
      fx.fadeOut(art, until, 0.25);
      if (labelNode) fx.fadeOut(labelNode, until, 0.25);
    }
    return { art, path, labelNode };
  }

  function polaroid(parent, { x, y, id, caption = '', captionAt, photoText }) {
    const node = place(el('div', 'polaroid is-staged', parent), x, y);
    el('div', 'polaroid-photo', node, photoText || id);
    const captionNode = el('div', 'polaroid-caption', node, captionAt === undefined ? caption : '');
    if (captionAt !== undefined) typewriter(captionNode, caption, captionAt, 40);
    return node;
  }

  // ------------------------------------------------------------------
  // Text effects
  // ------------------------------------------------------------------

  function typewriter(node, text, at, cps = 30) {
    onFrame((t) => {
      const count = t < at ? 0 : Math.min(text.length, Math.floor((t - at) * cps) + 1);
      const shown = text.slice(0, count);
      if (node.textContent !== shown) node.textContent = shown;
    });
  }

  const HEX = '0123456789abcdef';

  /** Hex characters that churn from `at` and lock in left to right by `settle`. */
  function scramble(node, { at, settle, text, seed = 1, before = '' }) {
    onFrame((t) => {
      if (t < at) {
        node.textContent = before;
        return;
      }
      const locked = Math.floor(progress(t, at, settle - at) * text.length);
      const frame = Math.floor(t * 30);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        out += i < locked || text[i] === ' ' ? text[i] : HEX[Math.floor(hash01(seed * 7919 + frame * 131 + i) * 16)];
      }
      node.textContent = out;
    });
  }

  /**
   * Keeps `node` next to the element `selector` finds inside `within` (for
   * example a branch label in a GitGraph panel), so a sticker follows the
   * label as it glides. Offsets are in the node's own coordinate space;
   * `anchor` picks the target's left or right edge.
   */
  function pin(node, within, selector, { dx = 0, dy = 0, anchor = 'left' } = {}) {
    onFrame(() => {
      const target = within.querySelector(selector);
      const frame = node.offsetParent;
      if (!target || !frame) return;
      const box = target.getBoundingClientRect();
      const ref = frame.getBoundingClientRect();
      const scale = ref.width / frame.offsetWidth || 1;
      const x = ((anchor === 'right' ? box.right : box.left) - ref.left) / scale + dx;
      const y = (box.top + box.height / 2 - ref.top) / scale + dy;
      node.style.left = `${x.toFixed(1)}px`;
      node.style.top = `${y.toFixed(1)}px`;
    });
    return node;
  }

  // ------------------------------------------------------------------
  // GitGraph panels
  // ------------------------------------------------------------------

  /**
   * A card holding a GraphTrack (graph-track.js) that is posed only while
   * visible. Give `right` instead of `x` to anchor the card to the stage's
   * right edge (it then scales from its top-right corner).
   */
  function graph(parent, { x, right, y, scale = 1, title, iconName, keyframes, speed = 1.6, from, to }) {
    const card = el('div', 'graph-card is-staged', parent);
    card.style.top = `${y}px`;
    if (right === undefined) {
      card.style.left = `${x}px`;
    } else {
      card.style.right = `${right}px`;
      card.style.transformOrigin = '100% 0';
    }
    card.style.scale = String(scale);
    if (title) {
      const head = el('div', 'graph-card-title', card);
      if (iconName) head.append(icon(iconName));
      head.append(document.createTextNode(title));
    }
    const host = el('div', 'graph-card-host', card);
    const track = new window.GraphTrack(host, keyframes, { speed });
    fx.rise(card, from, { distance: 30, duration: 0.4 });
    if (to !== undefined) fx.exit(card, to - 0.3, { dx: -60, duration: 0.3 });
    const settled = to === undefined ? Infinity : to + 0.1;
    onFrame((t) => {
      if (t >= from - 0.1 && t <= settled) track.pose(t);
    });
    return card;
  }

  // ------------------------------------------------------------------
  // Time Stone, confetti, falling things
  // ------------------------------------------------------------------

  let stoneCount = 0;

  function timeStone(parent, { x, y, size, from, to, spin = 1 }) {
    const id = `stone-${++stoneCount}`;
    const art = svg('svg', { class: 'time-stone is-staged', viewBox: '-100 -100 200 200', width: size, height: size }, parent);
    art.style.left = `${x - size / 2}px`;
    art.style.top = `${y - size / 2}px`;
    const defs = svg('defs', {}, art);
    const gem = svg('linearGradient', { id: `${id}-gem`, x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
    svg('stop', { offset: '0', 'stop-color': '#a7f3d0' }, gem);
    svg('stop', { offset: '0.45', 'stop-color': '#10b981' }, gem);
    svg('stop', { offset: '1', 'stop-color': '#065f46' }, gem);
    const glow = svg('circle', { class: 'time-stone-glow', r: 46 }, art);
    const outer = svg('g', {}, art);
    svg('circle', { class: 'time-stone-ring', r: 88, 'stroke-width': 6 }, outer);
    svg('circle', { class: 'time-stone-runes', r: 79, 'stroke-width': 6 }, outer);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      svg('line', {
        class: 'time-stone-ring', 'stroke-width': 4, 'stroke-linecap': 'round',
        x1: (92 * Math.sin(a)).toFixed(2), y1: (-92 * Math.cos(a)).toFixed(2),
        x2: (99 * Math.sin(a)).toFixed(2), y2: (-99 * Math.cos(a)).toFixed(2),
      }, outer);
    }
    const inner = svg('g', {}, art);
    svg('circle', { class: 'time-stone-ring', r: 62, 'stroke-width': 3 }, inner);
    for (let i = 0; i < 4; i++) {
      svg('path', { d: 'M -7 -62 L 0 -44 L 7 -62 Z', fill: '#ffd100', transform: `rotate(${i * 90 + 45})` }, inner);
    }
    svg('path', {
      class: 'time-stone-gem', fill: `url(#${id}-gem)`,
      d: 'M 0 -40 L 34 -14 L 21 30 L -21 30 L -34 -14 Z',
    }, art);
    svg('path', { d: 'M 0 -40 L 0 30 M -34 -14 L 34 -14', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 2, fill: 'none' }, art);

    fx.pop(art, from, { from: 0.2, duration: 0.6 });
    if (to !== undefined) fx.fadeOut(art, to - 0.3, 0.3);
    onFrame((t) => {
      const age = t - from;
      outer.setAttribute('transform', `rotate(${(age * 24 * spin).toFixed(2)})`);
      inner.setAttribute('transform', `rotate(${(-age * 40 * spin).toFixed(2)})`);
      const pulse = beats.pulse(t, 0.18);
      glow.setAttribute('opacity', (0.55 + 0.3 * pulse).toFixed(3));
      glow.setAttribute('r', (46 + 8 * pulse).toFixed(2));
    });
    return art;
  }

  const CONFETTI_COLORS = ['#ffd100', '#ff5fb0', '#38d3f5', '#4ade80', '#a78bfa', '#ff6b7d'];

  /** A deterministic confetti burst from (x, y) at `at` that lasts about two seconds. */
  function confetti(parent, { x, y, at, count = 46, seed = 3 }) {
    const pieces = [];
    for (let i = 0; i < count; i++) {
      const node = el('div', 'confetti-piece', parent);
      node.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      node.style.opacity = '0';
      const angle = -Math.PI / 2 + (hash01(seed * 101 + i) - 0.5) * 2.4;
      const speed = 260 + hash01(seed * 37 + i) * 240;
      pieces.push({ node, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, spin: (hash01(seed * 13 + i) - 0.5) * 1440 });
    }
    onFrame((t) => {
      const age = t - at;
      for (const piece of pieces) {
        if (age < 0 || age > 2.2) {
          piece.node.style.opacity = '0';
          continue;
        }
        const px = x + piece.vx * age;
        const py = y + piece.vy * age + 0.5 * 620 * age * age;
        piece.node.style.opacity = String(clamp(1.6 - age * 0.8, 0, 1));
        piece.node.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) rotate(${(piece.spin * age).toFixed(1)}deg)`;
      }
    });
  }

  /** Drops a node off the bottom of the frame from `at`, tumbling. */
  function fall(node, at, { spin = 220, drift = 30 } = {}) {
    onFrame((t) => {
      const age = Math.max(0, t - at);
      const dy = 0.5 * 1500 * age * age;
      node.style.transform = age > 0 ? `translate(${(drift * age).toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${(spin * age).toFixed(1)}deg)` : '';
    });
  }

  // ------------------------------------------------------------------
  // Backdrop, equalizer, camera
  // ------------------------------------------------------------------

  function backdrop(stage) {
    const layer = el('div', 'layer backdrop', stage);
    const grid = el('div', 'backdrop-grid', layer);
    const blobs = [
      { kind: 'violet', x: 260, y: 170, rx: 120, ry: 60, w: 0.11, phase: 0 },
      { kind: 'cyan', x: 720, y: 380, rx: 140, ry: 70, w: 0.09, phase: 2 },
      { kind: 'pink', x: 600, y: 120, rx: 100, ry: 90, w: 0.13, phase: 4 },
    ].map((blob) => ({ ...blob, node: el('div', `blob blob--${blob.kind}`, layer) }));
    onFrame((t) => {
      const pulse = beats.pulse(t, 0.16);
      for (const blob of blobs) {
        const a = t * blob.w * Math.PI * 2 + blob.phase;
        const x = blob.x + blob.rx * Math.cos(a);
        const y = blob.y + blob.ry * Math.sin(a * 1.3);
        blob.node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(1 + 0.05 * pulse).toFixed(3)})`;
      }
      grid.style.transform = `translate(${(-(t * 6) % 24).toFixed(2)}px, ${(-(t * 3) % 24).toFixed(2)}px)`;
    });
    el('div', 'layer vignette', stage);
    return layer;
  }

  function equalizer(stage, bars = 48) {
    const strip = el('div', 'eq', stage);
    const nodes = Array.from({ length: bars }, () => el('div', 'eq-bar', strip));
    onFrame((t) => {
      const beat = beats.index(t);
      const pulse = beats.pulse(t, 0.22);
      nodes.forEach((node, i) => {
        const base = 0.18 + 0.25 * hash01(beat * 97 + i);
        const hit = pulse * (0.35 + 0.65 * hash01(beat * 31 + i * 7));
        node.style.transform = `scaleY(${clamp(base + hit, 0.08, 1).toFixed(3)})`;
      });
    });
    return strip;
  }

  window.SongKit = {
    el, svg, place, icon, scene, sticker, stamp, kinetic, badge, terminal,
    station, chip, flyIn, flow, polaroid, typewriter, scramble, pin, graph,
    timeStone, confetti, fall, backdrop, equalizer,
  };
})();
