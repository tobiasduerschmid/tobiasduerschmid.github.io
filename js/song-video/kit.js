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
  const graphTracks = new WeakMap();

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
    wifi: [['path', { d: 'M2.5 9a14 14 0 0 1 19 0M5.8 12.6a9 9 0 0 1 12.4 0M9.2 16.1a4.2 4.2 0 0 1 5.6 0M12 19.6v.1' }]],
    link: [['path', { d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1' }], ['path', { d: 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' }]],
    globe: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M3 12h18M12 3c-3.2 3.2-3.2 14.8 0 18M12 3c3.2 3.2 3.2 14.8 0 18' }]],
    transfer: [['path', { d: 'M4 8h15l-3.5-3.5M20 16H5l3.5 3.5' }]],
    chat: [['path', { d: 'M4 5h16v11H10l-5 4v-4H4z' }]],
    router: [['rect', { x: 3, y: 12.5, width: 18, height: 7, rx: 2 }], ['path', { d: 'M7 12.5V6M17 12.5V6M7.5 16h.1M11 16h.1' }]],
    key: [['circle', { cx: 8, cy: 15, r: 4 }], ['path', { d: 'M10.8 12.2L20 3M16.5 6.5l3 3M14.5 8.5l2 2' }]],
    gamepad: [['path', { d: 'M7 8h10a4 4 0 0 1 4 4l.6 3.6a2 2 0 0 1-3.5 1.6L16 15H8l-2.1 2.2a2 2 0 0 1-3.5-1.6L3 12a4 4 0 0 1 4-4z' }], ['path', { d: 'M8 10v4M6 12h4M15.5 11h.1M17.5 13h.1' }]],
    phone: [['path', { d: 'M5 3h3.2l1.8 4.6-2.4 1.6a11.5 11.5 0 0 0 5.2 5.2l1.6-2.4L19 13.8V17a2 2 0 0 1-2 2A15 15 0 0 1 3 5a2 2 0 0 1 2-2z' }]],
    video: [['rect', { x: 3, y: 6, width: 12.5, height: 12, rx: 2 }], ['path', { d: 'M15.5 10.5L21 7.5v9l-5.5-3z' }]],
    house: [['path', { d: 'M3 11.5L12 4l9 7.5M5.5 9.8V20h13V9.8M10 20v-5h4v5' }]],
    hourglass: [['path', { d: 'M6 3h12M6 21h12M7.5 3c0 5.5 9 6.5 9 9s-9 3.5-9 9M16.5 3c0 5.5-9 6.5-9 9s9 3.5 9 9' }]],
    timer: [['circle', { cx: 12, cy: 13.5, r: 7.5 }], ['path', { d: 'M12 9.5v4.2l2.6 1.6M9.5 2.5h5' }]],
    envelope: [['rect', { x: 3, y: 5.5, width: 18, height: 13, rx: 2 }], ['path', { d: 'M3.5 7l8.5 6 8.5-6' }]],
    box: [['path', { d: 'M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z' }], ['path', { d: 'M3.5 7.5L12 12l8.5-4.5M12 12v9' }]],
    eye: [['path', { d: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
    chip: [['rect', { x: 6, y: 6, width: 12, height: 12, rx: 1.5 }], ['path', { d: 'M9.5 3v3M14.5 3v3M9.5 18v3M14.5 18v3M3 9.5h3M3 14.5h3M18 9.5h3M18 14.5h3' }]],
    resend: [['path', { d: 'M20 12a8 8 0 1 1-2.4-5.7' }], ['path', { d: 'M20 4v4.5h-4.5' }]],
    trash: [['path', { d: 'M4 7h16M9.5 7V4h5v3M6.5 7l1 13h9l1-13' }]],
    user: [['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4.5 21a7.5 7.5 0 0 1 15 0' }]],
    castle: [['path', { d: 'M4 21V9h3V6h2.5v3h1.5V6h2v3h1.5V6H17v3h3v12z' }], ['path', { d: 'M10 21v-4a2 2 0 0 1 4 0v4' }]],
    question: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M9.6 9.3a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.6v.5M12 16.8v.1' }]],
    receipt: [['path', { d: 'M6 3h12v18l-3-2-3 2-3-2-3 2z' }], ['path', { d: 'M9 8h6M9 12h6' }]],
    door: [['path', { d: 'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M3.5 21h17M14.5 12.5h.1' }]],
    arrowDown: [['path', { d: 'M12 4v16M5.5 13.5L12 20l6.5-6.5' }]],
    arrowUp: [['path', { d: 'M12 20V4M5.5 10.5L12 4l6.5 6.5' }]],
    plug: [['path', { d: 'M8 3v4.5M16 3v4.5M5.5 7.5h13V11a6.5 6.5 0 0 1-13 0zM12 17.5V21' }]],
    folder: [['path', { d: 'M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z' }]],
    folderPlus: [['path', { d: 'M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z' }], ['path', { d: 'M12 10.5v6M9 13.5h6' }]],
    filePlus: [['path', { d: 'M6 3h8l4 4v14H6z' }], ['path', { d: 'M14 3v4h4M12 10.5v6M9 13.5h6' }]],
    copy: [['rect', { x: 8, y: 8, width: 12, height: 12, rx: 1.5 }], ['path', { d: 'M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8' }]],
    move: [['path', { d: 'M3 12h13M11 6.5l5.5 5.5-5.5 5.5M20.5 5v14' }]],
    enter: [['path', { d: 'M10 4h8.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H10M3 12h11M10.5 8l4 4-4 4' }]],
    list: [['path', { d: 'M9 6h11M9 12h11M9 18h11M4.5 6h.1M4.5 12h.1M4.5 18h.1' }]],
    pages: [['path', { d: 'M6 3h8l3 3v5H6zM6 14h11v7H6z' }]],
    lines: [['path', { d: 'M4 6h16M4 18h16M5 12h.1M9 12h.1M13 12h.1' }]],
    sortAsc: [['path', { d: 'M4 6h5M4 12h8M4 18h11M18.5 5v14M15.5 16l3 3 3-3' }]],
    dedupe: [['path', { d: 'M4 6h11M4 12h11M4 18h6M15.5 15.5l5 5M20.5 15.5l-5 5' }]],
    hash: [['path', { d: 'M9.5 4L7.5 20M16.5 4l-2 16M4.5 9h15.5M4 15h15.5' }]],
    scissors: [['circle', { cx: 6, cy: 7, r: 2.6 }], ['circle', { cx: 6, cy: 17, r: 2.6 }], ['path', { d: 'M8.3 8.5L20 18M8.3 15.5L20 6' }]],
    book: [['path', { d: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z' }]],
    chart: [['path', { d: 'M4 4v16h16M8.5 16v-5M12.5 16V8M16.5 16v-7' }]],
    terminal: [['rect', { x: 3, y: 4.5, width: 18, height: 15, rx: 2 }], ['path', { d: 'M7 10l3 2.5L7 15M12.5 15H17' }]],
    gear: [['circle', { cx: 12, cy: 12, r: 3.5 }], ['path', { d: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1' }]],
    image: [['rect', { x: 3, y: 5, width: 18, height: 14, rx: 2 }], ['path', { d: 'M3.5 16.5l5-5 4 4 3-3 5 5' }], ['circle', { cx: 16, cy: 9.5, r: 1.6 }]],
    loop: [['path', { d: 'M17 2.5l3 3-3 3M20 5.5H8a4 4 0 0 0-4 4v1M7 21.5l-3-3 3-3M4 18.5h12a4 4 0 0 0 4-4v-1' }]],
    cart: [['path', { d: 'M3 4h2.5l2.2 10.3a1.5 1.5 0 0 0 1.5 1.2h7.7a1.5 1.5 0 0 0 1.4-1.1L20.5 8H6.4' }], ['circle', { cx: 10, cy: 19.5, r: 1.4 }], ['circle', { cx: 17, cy: 19.5, r: 1.4 }]],
    wallet: [['path', { d: 'M5 6.5l9.5-3 1.2 3' }], ['rect', { x: 3.5, y: 6.5, width: 17, height: 13, rx: 2 }], ['path', { d: 'M20.5 11H15a2 2 0 0 0 0 4h5.5' }], ['path', { d: 'M15.5 13h.1' }]],
    card: [['rect', { x: 3, y: 5.5, width: 18, height: 13, rx: 2 }], ['path', { d: 'M3 10h18M6.5 14.5h4' }]],
    calendar: [['rect', { x: 4, y: 5.5, width: 16, height: 14.5, rx: 1.5 }], ['path', { d: 'M4 10h16M8.5 3.5v4M15.5 3.5v4M8 14h2M12 14h2M8 17h2' }]],
    database: [['ellipse', { cx: 12, cy: 6, rx: 7, ry: 2.5 }], ['path', { d: 'M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5' }]],
    cash: [['rect', { x: 2.5, y: 6.5, width: 19, height: 11, rx: 1.5 }], ['circle', { cx: 12, cy: 12, r: 2.6 }], ['path', { d: 'M6 9.5v5M18 9.5v5' }]],
    percent: [['path', { d: 'M18.5 5.5l-13 13' }], ['circle', { cx: 7.5, cy: 7.5, r: 2.2 }], ['circle', { cx: 16.5, cy: 16.5, r: 2.2 }]],
    truck: [['path', { d: 'M2.5 6h11.5v10H2.5zM14 9.5h3.6l3.4 3.6V16H14' }], ['circle', { cx: 6.5, cy: 17.5, r: 1.9 }], ['circle', { cx: 17, cy: 17.5, r: 1.9 }]],
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

  /** `from` is the scale the stamp slams down from; keep it small for a wide stamp near other art. */
  function stamp(parent, text, { x, y, at, until, color = 'red', rotate = -8, shake = true, small = false, from = 2.6 }) {
    const node = place(el('div', `stamp stamp--${color}${small ? ' stamp--small' : ''} is-staged`, parent, text), x, y);
    fx.slam(node, at, { from, rotate });
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
    const art = svg('svg', { class: 'flow is-staged', viewBox: '0 0 960 540' }, parent);
    // A fully offset dashed path still paints its round end caps. Hide the
    // whole arrow until its cue rather than leaking dots into earlier scenes.
    fx.fadeIn(art, at, 0.08);
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
   * `anchor` picks the target's left or right edge. For a graph target,
   * `anchorAt` freezes that position at an authored song time before the
   * target disappears, independent of frame rate or seek history.
   */
  function pin(node, within, selector, { dx = 0, dy = 0, anchor = 'left', anchorAt } = {}) {
    let frozenPosition = null;
    function position() {
      const target = within.querySelector(selector);
      const frame = node.offsetParent;
      if (!target || !frame) return null;
      const box = target.getBoundingClientRect();
      const ref = frame.getBoundingClientRect();
      const scale = ref.width / frame.offsetWidth || 1;
      const x = ((anchor === 'right' ? box.right : box.left) - ref.left) / scale + dx;
      const y = (box.top + box.height / 2 - ref.top) / scale + dy;
      return { x, y };
    }
    onFrame((t) => {
      let currentPosition;
      if (anchorAt !== undefined && t >= anchorAt) {
        if (!frozenPosition) {
          const track = graphTracks.get(within);
          track.pose(anchorAt);
          frozenPosition = position();
          track.pose(t);
        }
        currentPosition = frozenPosition;
      } else {
        currentPosition = position();
      }
      if (!currentPosition) return;
      node.style.left = `${currentPosition.x.toFixed(1)}px`;
      node.style.top = `${currentPosition.y.toFixed(1)}px`;
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
    graphTracks.set(card, track);
    window.Timeline.onDispose(() => track.dispose());
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

  /** Layered metal and cut emerald; only the two engraved rings rotate. */
  function timeStoneArtwork(art, id) {
    const defs = svg('defs', {}, art);
    const gold = svg('linearGradient', { id: `${id}-gold`, x1: '0', y1: '0', x2: '0.8', y2: '1' }, defs);
    for (const [offset, tone] of [['0', 'glint'], ['0.28', 'light'], ['0.5', 'mid'], ['0.72', 'light'], ['1', 'shadow']]) {
      svg('stop', { offset, class: `time-stone-gold-${tone}` }, gold);
    }
    const bronze = svg('linearGradient', { id: `${id}-bronze`, x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
    for (const [offset, tone] of [['0', 'light'], ['0.48', 'shadow'], ['1', 'mid']]) {
      svg('stop', { offset, class: `time-stone-gold-${tone}` }, bronze);
    }
    const gem = svg('linearGradient', { id: `${id}-gem`, x1: '0', y1: '0', x2: '0.8', y2: '1' }, defs);
    for (const [offset, tone] of [['0', 'light'], ['0.45', 'mid'], ['1', 'deep']]) {
      svg('stop', { offset, class: `time-stone-emerald-${tone}` }, gem);
    }
    const aura = svg('radialGradient', { id: `${id}-aura` }, defs);
    for (const [offset, tone] of [['0', 'core'], ['0.5', 'halo'], ['1', 'edge']]) {
      svg('stop', { offset, class: `time-stone-aura-${tone}` }, aura);
    }
    const glow = svg('circle', { class: 'time-stone-glow', r: 98, fill: `url(#${id}-aura)` }, art);
    const outer = svg('g', { class: 'time-stone-outer' }, art);
    svg('circle', { class: 'time-stone-orbit', r: 91 }, outer);
    svg('circle', { class: 'time-stone-runes', r: 85 }, outer);
    for (let i = 0; i < 8; i++) {
      svg('path', { class: 'time-stone-orbit-mark', d: 'M-3-92 0-97 3-92 0-87Z', transform: `rotate(${i * 45})` }, outer);
    }

    svg('circle', { class: 'time-stone-metal', r: 76, fill: `url(#${id}-bronze)` }, art);
    svg('circle', { class: 'time-stone-recess', r: 69 }, art);
    const inner = svg('g', { class: 'time-stone-inner' }, art);
    svg('circle', { class: 'time-stone-engraving', r: 65 }, inner);
    svg('path', {
      class: 'time-stone-engraving',
      d: 'M0-69 9-57 0-45-9-57ZM69 0 57 9 45 0 57-9ZM0 69-9 57 0 45 9 57ZM-69 0-57-9-45 0-57 9Z',
    }, inner);

    // The fixed almond silhouette keeps the amulet readable during a rewind.
    const setting = svg('g', { class: 'time-stone-setting' }, art);
    svg('path', {
      class: 'time-stone-metal', fill: `url(#${id}-gold)`,
      d: 'M-94 0C-69-17-48-58 0-58S69-17 94 0C69 17 48 58 0 58S-69 17-94 0Z',
    }, setting);
    svg('path', {
      class: 'time-stone-recess',
      d: 'M-78 0C-52-25-33-42 0-42S52-25 78 0C52 25 33 42 0 42S-52 25-78 0Z',
    }, setting);
    for (const flip of [1, -1]) {
      const band = svg('g', { transform: `scale(1 ${flip})` }, setting);
      svg('path', {
        class: 'time-stone-metal', fill: `url(#${id}-gold)`,
        d: 'M-87-2C-58-10-47-42-8-48 28-53 61-24 86-2 63-12 34-34 4-34-32-34-57-6-87-2Z',
      }, band);
      svg('path', { class: 'time-stone-highlight', d: 'M-76-9C-52-22-34-44-7-46 22-49 48-30 68-16' }, band);
      svg('path', { class: 'time-stone-filigree', d: 'M-71-4C-64-17-47-25-40-20-32-14-42-3-48-8-53-12-45-18-42-12M71-4C64-17 47-25 40-20 32-14 42-3 48-8 53-12 45-18 42-12' }, band);
    }
    svg('circle', { class: 'time-stone-metal', r: 38, fill: `url(#${id}-gold)` }, setting);
    svg('circle', { class: 'time-stone-bezel', r: 33 }, setting);
    svg('path', { class: 'time-stone-gem', fill: `url(#${id}-gem)`, d: 'M-13-30 13-30 27-16 27 15 12 31-12 31-27 15-27-16Z' }, setting);
    const facets = [
      ['light', 'M-13-30 13-30 9-17-9-17Z'],
      ['shine', 'M-13-30-9-17-16-8-27-16Z'],
      ['mid', 'M13-30 27-16 16-8 9-17Z'],
      ['deep', 'M27-16 27 15 16 8 16-8Z'],
      ['mid', 'M27 15 12 31 9 17 16 8Z'],
      ['deep', 'M12 31-12 31-9 17 9 17Z'],
      ['light', 'M-12 31-27 15-16 8-9 17Z'],
      ['mid', 'M-27 15-27-16-16-8-16 8Z'],
    ];
    for (const [tone, d] of facets) svg('path', { class: `time-stone-facet time-stone-facet--${tone}`, d }, setting);
    svg('path', { class: 'time-stone-table', d: 'M-9-17 9-17 16-8 16 8 9 17-9 17-16 8-16-8Z' }, setting);
    svg('path', { class: 'time-stone-gem-reflection', d: 'M-8-14 6-14-13 6-13-6ZM3 15 13 5 13 9 8 15Z' }, setting);
    svg('path', { class: 'time-stone-highlight', d: 'M-12-30 12-30M-27-14V5M-33-10A35 35 0 0 1-7-34' }, setting);
    svg('path', { class: 'time-stone-claws', d: 'M-15-33-11-27M15-33 11-27M-15 33-11 27M15 33 11 27' }, setting);
    return { glow, outer, inner };
  }

  function timeStone(parent, { x, y, size, from, to, spin = 1 }) {
    const id = `stone-${++stoneCount}`;
    const art = svg('svg', { class: 'time-stone is-staged', viewBox: '-105 -105 210 210', width: size, height: size, 'aria-hidden': 'true' }, parent);
    art.style.left = `${x - size / 2}px`;
    art.style.top = `${y - size / 2}px`;
    const { glow, outer, inner } = timeStoneArtwork(art, id);

    fx.pop(art, from, { from: 0.2, duration: 0.6 });
    if (to !== undefined) fx.fadeOut(art, to - 0.3, 0.3);
    onFrame((t) => {
      const age = t - from;
      outer.setAttribute('transform', `rotate(${(age * 24 * spin).toFixed(2)})`);
      inner.setAttribute('transform', `rotate(${(-age * 40 * spin).toFixed(2)})`);
      const pulse = beats.pulse(t, 0.18);
      glow.setAttribute('opacity', (0.6 + 0.15 * pulse).toFixed(3));
      glow.setAttribute('r', (98 + 3 * pulse).toFixed(2));
    });
    return art;
  }

  const CONFETTI_COLORS = ['gold', 'ivory', 'teal', 'coral', 'blue'];
  const CONFETTI_SHAPES = ['ribbon', 'ticket', 'ribbon', 'ticket', 'ribbon', 'ticket', 'ribbon'];

  function confettiPiece(layer, seed, index) {
    const random = (channel, low, high) => low + (high - low) * hash01(seed * 4099 + index * 131 + channel * 17);
    const shape = CONFETTI_SHAPES[index % CONFETTI_SHAPES.length];
    const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
    const node = el('div', `confetti-piece confetti-piece--${shape} confetti-piece--${color}`, layer);
    const depth = random(1, 0.72, 1.22);
    const width = random(2, shape === 'ribbon' ? 7 : 13, shape === 'ribbon' ? 11 : 20) * depth;
    const height = random(3, shape === 'ribbon' ? 23 : 10, shape === 'ribbon' ? 35 : 16) * depth;
    node.style.setProperty('--piece-width', `${width.toFixed(2)}px`);
    node.style.setProperty('--piece-height', `${height.toFixed(2)}px`);
    return {
      node, depth, delay: random(4, 0, 0.24), duration: random(5, 2.2, 2.7),
      vx: random(6, -220, 220), vy: random(7, -470, -260),
      gravity: random(8, 380, 490), wind: random(9, -16, 16),
      phase: random(10, 0, Math.PI * 2), rotation: random(11, -90, 90),
      spin: random(12, -250, 250), tumble: random(13, 2.4, 4.2),
      flutter: random(14, 8, 19), frequency: random(15, 3, 5),
      offsetX: random(16, -140, 140), offsetY: random(17, -70, 20),
    };
  }

  function poseConfettiPiece(piece, age, x, y) {
    const elapsed = age - piece.delay;
    if (elapsed <= 0 || elapsed >= piece.duration) {
      piece.node.style.opacity = '0';
      return;
    }
    const fraction = elapsed / piece.duration;
    const flutter = (Math.sin(piece.phase + elapsed * piece.frequency) - Math.sin(piece.phase)) * piece.flutter * fraction;
    const drift = piece.vx * (1 - Math.exp(-0.6 * elapsed)) / 0.6;
    const px = x + piece.offsetX + drift + piece.wind * elapsed * elapsed + flutter;
    const py = y + piece.offsetY + piece.vy * elapsed + 0.5 * piece.gravity * elapsed * elapsed;
    const turn = piece.rotation + piece.spin * elapsed + flutter * 0.6;
    const face = 0.18 + 0.82 * Math.abs(Math.cos(piece.phase + elapsed * piece.tumble));
    const opacity = Math.min(clamp(elapsed / 0.12, 0, 1), clamp((1 - fraction) / 0.35, 0, 1)) * (0.68 + piece.depth * 0.25);
    piece.node.style.opacity = opacity.toFixed(3);
    piece.node.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) rotate(${turn.toFixed(1)}deg) scaleX(${face.toFixed(3)})`;
  }

  /** Seeded paper pieces pose directly from song time, including backward seeks. */
  function confetti(parent, { x, y, at, count = 46, seed = 3 }) {
    const layer = el('div', 'confetti-layer');
    layer.setAttribute('aria-hidden', 'true');
    parent.prepend(layer);
    const pieces = Array.from({ length: Math.min(count, 46) }, (_, index) => confettiPiece(layer, seed, index));
    // Spread side celebrations around the card, rather than exposing only the
    // fastest particles from a compact burst hidden behind its opaque center.
    const originX = x + Math.sign(x - 480) * 90;
    pieces.sort((a, b) => a.depth - b.depth);
    layer.append(...pieces.map((piece) => piece.node));
    const end = Math.max(0, ...pieces.map((piece) => piece.delay + piece.duration));
    let visible = false;
    onFrame((t) => {
      const age = t - at;
      const active = age >= 0 && age < end;
      if (active !== visible) {
        layer.classList.toggle('is-active', active);
        visible = active;
      }
      if (!active) return;
      for (const piece of pieces) poseConfettiPiece(piece, age, originX, y);
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
  // Backdrop, camera
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

  // ------------------------------------------------------------------
  // Themes: the look of the stage behind every scene
  // ------------------------------------------------------------------

  /**
   * A theme builds the backdrop under the camera layer. A storyboard picks
   * one with `theme` (default "studio"); theme scripts such as night-sky.js
   * register more. The type, boxes, and HUD stay the same in every theme.
   */
  const themes = {
    studio: { build: backdrop },
  };

  window.SongKit = {
    el, svg, place, icon, scene, sticker, stamp, kinetic, badge, terminal,
    station, chip, flyIn, flow, polaroid, typewriter, scramble, pin, graph,
    timeStone, confetti, fall, backdrop, themes,
  };
})();
