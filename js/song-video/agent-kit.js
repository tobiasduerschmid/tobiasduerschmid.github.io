/*
 * The teaching pictures of "Meet Me One Level Up", the coding-agent song
 * (storyboard: _data/songs/meet_me_one_level_up.yml; styles in
 * css/song-video-agent-kit.css).
 *
 * One visual language for the whole song: cards (cream paper in the library
 * while the agent trains, white in the office once it works), dark code
 * panels in the shared syntax colours, round check and cross marks, pills
 * for short labels, and speech bubbles. Gold means what is worth keeping,
 * green what is right or checked, red what goes wrong, UCLA blue the agent.
 *
 * Each builder places its picture, schedules its own entrance and exit from
 * song times, and returns handles for the choreography. Every pose is a
 * function of song time (Timeline), so seeking reproduces any frame.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, clamp } = window.Timeline;
  const { el, svg, place, icon, highlightPython, writeCode } = window.SongKit;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const smooth = (p) => p * p * (3 - 2 * p);

  // ------------------------------------------------------------------
  // Entrances and exits shared by every picture
  // ------------------------------------------------------------------

  /** Brings a staged node in at `at` the way `how` says. */
  function enter(node, at, how = 'pop') {
    if (at === undefined || how === 'none') return;
    if (how === 'pop') fx.pop(node, at, { from: 0.82, duration: 0.45 });
    else if (how === 'rise') fx.rise(node, at, { distance: 22, duration: 0.5 });
    else if (how === 'drop') tween(node, [{ opacity: 0, translate: '0 -26px' }, { opacity: 1, translate: '0 0' }], at, 0.5, EASE.back);
    else if (how === 'left') fx.slideIn(node, at, { dx: -40, duration: 0.5 });
    else if (how === 'right') fx.slideIn(node, at, { dx: 40, duration: 0.5 });
    else fx.fadeIn(node, at, 0.35);
  }

  /** Takes a staged node out at `until`. */
  function leave(node, until, how = 'fade') {
    if (until === undefined) return;
    if (how === 'pop') fx.popOut(node, until - 0.25);
    else if (how === 'up') fx.exit(node, until - 0.3, { dx: 0, dy: -20, duration: 0.3 });
    else fx.fadeOut(node, until - 0.3, 0.3);
  }

  /** An absolutely placed, staged box of size w × h (h optional). */
  function box(parent, className, { x, y, w, h }) {
    const node = place(el('div', `${className} is-staged`, parent), x, y);
    if (w !== undefined) node.style.width = `${w}px`;
    if (h !== undefined) node.style.height = `${h}px`;
    return node;
  }

  /** A child that fades and lifts in at `at` (shown from the start without one). */
  function reveal(node, at, how = 'rise') {
    if (at === undefined) return node;
    node.classList.add('is-staged');
    if (how === 'rise') tween(node, [{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], at, 0.4);
    else if (how === 'pop') fx.pop(node, at, { from: 0.6, duration: 0.4 });
    else fx.fadeIn(node, at, 0.3);
    return node;
  }

  /**
   * Toggles a state class from song time: states = [[t, value], …] sets
   * data-state to the latest value at or before t (and none before the first).
   */
  function states(node, list) {
    const sorted = list.slice().sort((a, b) => a[0] - b[0]);
    let shown;
    onFrame((t) => {
      let value = '';
      for (const [when, state] of sorted) if (when <= t) value = state;
      if (value !== shown) {
        shown = value;
        if (value) node.dataset.state = value;
        else delete node.dataset.state;
      }
    });
  }

  // ------------------------------------------------------------------
  // Small pieces: text rows, pills, marks, bubbles, code
  // ------------------------------------------------------------------

  /** One row of text in a card body, revealed at `at`. */
  function row(parent, text, { className = '', at, how } = {}) {
    const node = el('div', `ak-row ${className}`.trim(), parent);
    if (typeof text === 'string') node.textContent = text;
    else if (text) node.append(text);
    return reveal(node, at, how);
  }

  /** A short label pill: tone blue, gold, green, red, ink, white, or paper. */
  function pill(parent, text, { x, y, tone = 'white', iconName, at, until, rotate = 0, how = 'pop', exit = 'pop' }) {
    const node = place(el('div', `ak-pill ak-pill--${tone} is-staged`, parent), x, y);
    if (rotate) node.style.rotate = `${rotate}deg`;
    if (iconName) node.append(icon(iconName));
    node.append(document.createTextNode(text));
    enter(node, at, how);
    leave(node, until, exit);
    return node;
  }

  /** A round check (ok) or cross mark that draws its stroke on. */
  function mark(parent, ok, { x, y, size = 40, at, until }) {
    const node = place(el('div', `ak-mark ak-mark--${ok ? 'ok' : 'no'} is-staged`, parent), x, y);
    node.style.width = node.style.height = `${size}px`;
    const glyph = icon(ok ? 'check' : 'cross');
    node.append(glyph);
    fx.pop(node, at, { from: 0.4, duration: 0.4 });
    for (const path of glyph.querySelectorAll('path')) fx.draw(path, at + 0.08, 0.32);
    leave(node, until, 'pop');
    return node;
  }

  /** A speech or thought bubble; tail points left, right, down, or up. */
  function bubble(parent, text, { x, y, w, tail = 'down', tone = 'white', think = false, at, until, how = 'pop' }) {
    const node = box(parent, `ak-bubble ak-bubble--${tone} ak-bubble--tail-${tail}${think ? ' ak-bubble--think' : ''}`, { x, y, w });
    if (typeof text === 'string') node.textContent = text;
    else node.append(text);
    enter(node, at, how);
    leave(node, until, 'pop');
    return node;
  }

  /** Python source in the shared syntax colours; lines may each appear at their own time. */
  function code(parent, source, { className = '', lineTimes } = {}) {
    const node = el('div', `ak-code ${className}`.trim(), parent);
    source.split('\n').forEach((text, i) => {
      const lineNode = el('div', 'ak-code-line', node);
      writeCode(lineNode, highlightPython(text || ' '));
      if (lineTimes && lineTimes[i] !== undefined) reveal(lineNode, lineTimes[i], 'fade');
    });
    return node;
  }

  // ------------------------------------------------------------------
  // Cards
  // ------------------------------------------------------------------

  /**
   * A card at (x, y), w wide (h optional): tone paper, white, code, board
   * (chalkboard), note (sticky yellow), or glass. Returns { node, head, body }.
   */
  function card(parent, { x, y, w, h, tone = 'white', title, iconName, kicker, at, until, how = 'pop', exit = 'fade', className = '' }) {
    const node = box(parent, `ak-card ak-card--${tone} ${className}`.trim(), { x, y, w, h });
    let head = null;
    if (title || kicker) {
      head = el('div', 'ak-card-head', node);
      if (iconName) head.append(icon(iconName, 'ak-card-icon'));
      const words = el('div', 'ak-card-words', head);
      if (kicker) el('div', 'ak-card-kicker', words, kicker);
      if (title) el('div', 'ak-card-title', words, title);
    }
    const body = el('div', 'ak-card-body', node);
    enter(node, at, how);
    leave(node, until, exit);
    return { node, head, body };
  }

  // ------------------------------------------------------------------
  // The three phases: the lecture's own tabs
  // ------------------------------------------------------------------

  const PHASES = [['1', 'Pre-training', 'book'], ['2', 'Post-training', 'target'], ['3', 'Inference', 'terminal']];

  /** The phase strip at the top; lit = [[t, index], …] lights one tab from t. */
  function phaseStrip(parent, { at, until, lit }) {
    const node = box(parent, 'ak-phases', { x: 300, y: 14 });
    const tabs = PHASES.map(([n, label, iconName]) => {
      const tab = el('div', 'ak-phase', node);
      el('span', 'ak-phase-n', tab, n);
      tab.append(icon(iconName, 'ak-phase-icon'));
      el('span', 'ak-phase-label', tab, label);
      return tab;
    });
    fx.rise(node, at, { distance: -16, duration: 0.5 });
    leave(node, until, 'up');
    const sorted = lit.slice().sort((a, b) => a[0] - b[0]);
    onFrame((t) => {
      let on = -1;
      for (const [when, index] of sorted) if (when <= t) on = index;
      tabs.forEach((tab, i) => tab.classList.toggle('is-lit', i === on));
    });
    return node;
  }

  // ------------------------------------------------------------------
  // The weights: a brass console of sliders
  // ------------------------------------------------------------------

  /**
   * The model's weights as a brass console of sliders, (x, y) its top-left.
   * Each nudge moves the knobs a little; from frozenAt, frost covers it and
   * a lock closes. Returns the node.
   */
  function weights(parent, { x, y, at, until, nudges = [], frozenAt, label = 'Weights', how = 'pop' }) {
    const node = box(parent, 'ak-weights', { x, y });
    const art = svg('svg', { class: 'ak-weights-art', viewBox: '0 0 250 132', width: 250, height: 132, 'aria-hidden': 'true' }, node);
    svg('rect', { class: 'ak-weights-case', x: 3, y: 3, width: 244, height: 126, rx: 16 }, art);
    svg('rect', { class: 'ak-weights-face', x: 14, y: 30, width: 222, height: 88, rx: 10 }, art);
    for (let i = 0; i < 4; i++) svg('circle', { class: 'ak-weights-rivet', cx: i % 2 ? 236 : 14, cy: i < 2 ? 14 : 120, r: 3 }, art);
    const knobs = [];
    const COUNT = 7;
    for (let i = 0; i < COUNT; i++) {
      const cx = 36 + i * 30;
      svg('line', { class: 'ak-weights-track', x1: cx, y1: 42, x2: cx, y2: 106 }, art);
      const knob = svg('g', { class: 'ak-weights-knob' }, art);
      svg('rect', { x: cx - 10, y: -6, width: 20, height: 12, rx: 4 }, knob);
      svg('line', { x1: cx - 6, y1: 0, x2: cx + 6, y2: 0 }, knob);
      knobs.push(knob);
    }
    el('div', 'ak-weights-label', node, label);
    // Knob heights: a fixed pattern, each nudge moving every knob a little.
    const base = Array.from({ length: COUNT }, (_, i) => 52 + window.Timeline.hash01(i + 3) * 44);
    const offsets = nudges.map((_, k) => Array.from({ length: COUNT }, (_, i) => (window.Timeline.hash01(k * 31 + i * 7 + 11) - 0.5) * 16));
    onFrame((t) => {
      const sum = new Array(COUNT).fill(0);
      nudges.forEach((when, k) => {
        const p = reducedMotion.matches ? (t >= when ? 1 : 0) : smooth(clamp((t - when) / 0.5, 0, 1));
        for (let i = 0; i < COUNT; i++) sum[i] += offsets[k][i] * p;
      });
      knobs.forEach((knob, i) => knob.setAttribute('transform', `translate(0 ${clamp(base[i] + sum[i], 46, 102).toFixed(1)})`));
    });
    if (frozenAt !== undefined) {
      const frost = svg('g', { class: 'ak-weights-frost is-staged' }, art);
      svg('rect', { x: 14, y: 30, width: 222, height: 88, rx: 10 }, frost);
      const flake = (cx, cy, r) => {
        let d = '';
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3, ca = Math.cos(a), sa = Math.sin(a);
          d += `M${cx} ${cy}l${(ca * r).toFixed(1)} ${(sa * r).toFixed(1)}`;
          const bx = cx + ca * r * 0.6, by = cy + sa * r * 0.6;
          for (const turn of [0.6, -0.6]) {
            d += `M${bx.toFixed(1)} ${by.toFixed(1)}l${(Math.cos(a + turn) * r * 0.35).toFixed(1)} ${(Math.sin(a + turn) * r * 0.35).toFixed(1)}`;
          }
        }
        svg('path', { class: 'ak-weights-crystal', d }, frost);
      };
      [[40, 52, 9], [104, 88, 11], [168, 50, 8], [210, 96, 10], [70, 100, 6], [140, 64, 6]].forEach(([cx, cy, r]) => flake(cx, cy, r));
      svg('path', { class: 'ak-weights-icicles', d: 'M18 118l5 9 5-9M60 118l4 7 4-7M120 118l6 10 6-10M190 118l4 7 4-7M220 118l5 9 5-9' }, frost);
      fx.fadeIn(frost, frozenAt, 0.6);
      const lock = el('div', 'ak-weights-lock is-staged', node);
      lock.append(icon('lock'));
      el('span', '', lock, 'Frozen');
      fx.pop(lock, frozenAt + 0.35, { from: 0.5 });
    }
    enter(node, at, how);
    leave(node, until);
    return node;
  }

  // ------------------------------------------------------------------
  // Context: what the model sees in one call
  // ------------------------------------------------------------------

  /**
   * A whiteboard listing the context, one numbered item per entry
   * (items = [{ text, at, code }]). Each sweep in `sweeps` runs a reading
   * band from the first item down to the last one shown; wipeAt brings a
   * sponge across that clears the board.
   */
  function contextBoard(parent, { x, y, w, h, items, sweeps = [], wipeAt, at, until, title = 'Context', sub = 'this session' }) {
    const { node, body } = card(parent, { x, y, w, h, tone: 'whiteboard', title, kicker: sub, iconName: 'list', at, until });
    const list = el('div', 'ak-context-list', body);
    const rows = items.map((item, i) => {
      const r = el('div', `ak-context-item${item.code ? ' is-code' : ''}${item.result ? ' is-result' : ''}`, list);
      el('span', 'ak-context-n', r, String(i + 1));
      el('span', 'ak-context-text', r, item.text);
      reveal(r, item.at, 'rise');
      return { node: r, at: item.at };
    });
    const band = el('div', 'ak-context-band', list);
    onFrame((t) => {
      let shown = false;
      for (const when of sweeps) {
        const visible = rows.filter((r) => r.at <= when + 0.05);
        const span = Math.max(0.6, visible.length * 0.22);
        const p = (t - when) / span;
        if (p < 0 || p > 1 || !visible.length) continue;
        const k = Math.min(visible.length - 1, Math.floor(p * visible.length));
        band.style.top = `${visible[k].node.offsetTop}px`;
        band.style.height = `${visible[k].node.offsetHeight}px`;
        shown = true;
      }
      band.classList.toggle('is-on', shown && !reducedMotion.matches);
    });
    if (wipeAt !== undefined) {
      const sponge = el('div', 'ak-sponge is-staged', node);
      tween(sponge, [
        { opacity: 0, translate: '-40px 0', rotate: '-8deg' },
        { opacity: 1, translate: '0 0', rotate: '-4deg', offset: 0.15 },
        { opacity: 1, translate: `${w - 40}px 30px`, rotate: '6deg', offset: 0.55 },
        { opacity: 1, translate: `${w * 0.2}px 80px`, rotate: '-4deg', offset: 0.85 },
        { opacity: 0, translate: `${w * 0.5}px 90px`, rotate: '0deg' },
      ], wipeAt, 1.6, EASE.inOut);
      tween(list, { opacity: 0 }, wipeAt + 0.25, 0.9, EASE.inOut);
    }
    return { node, rows };
  }

  // ------------------------------------------------------------------
  // Free shipping: a receipt
  // ------------------------------------------------------------------

  /**
   * The cart's receipt: items, a coupon from couponAt, and a shipping line
   * whose value follows shipping = [[t, text, tone]] (tone: unknown, free,
   * paid).
   */
  function receipt(parent, { x, y, w = 280, at, until, couponAt, shipping }) {
    const { node, body } = card(parent, { x, y, w, tone: 'receipt', title: 'Your cart', iconName: 'cart', at, until });
    const line = (label, value, className, when) => {
      const r = el('div', `ak-receipt-line ${className || ''}`.trim(), body);
      el('span', 'ak-receipt-label', r, label);
      const v = el('span', 'ak-receipt-value', r, value);
      reveal(r, when, 'rise');
      return v;
    };
    line('Items', '$55.00');
    line('Coupon', '−$10.00', 'is-coupon', couponAt);
    el('div', 'ak-receipt-rule', body);
    const ship = line('Shipping', '?', 'is-shipping');
    const sorted = shipping.slice().sort((a, b) => a[0] - b[0]);
    let shown = '';
    onFrame((t) => {
      let current = ['?', 'unknown'];
      for (const [when, text, tone] of sorted) if (when <= t) current = [text, tone];
      const key = current.join('|');
      if (key !== shown) {
        shown = key;
        ship.textContent = current[0];
        ship.dataset.tone = current[1];
      }
    });
    return { node, ship };
  }

  // ------------------------------------------------------------------
  // The photo folder
  // ------------------------------------------------------------------

  /** One photo in the folder list: a little landscape (seeded), its file name, and the day it was taken. */
  function photoTile(parent, seed) {
    const tile = el('div', 'ak-photo', parent);
    const pic = svg('svg', { class: 'ak-photo-pic', viewBox: '0 0 60 40', width: 45, height: 30, 'aria-hidden': 'true' }, tile);
    const h = window.Timeline.hash01;
    const sky = ['#9fd3f5', '#f7c59f', '#b9e3ff', '#ffd6a5'][seed % 4];
    svg('rect', { x: 0, y: 0, width: 60, height: 40, fill: sky }, pic);
    svg('circle', { cx: 12 + h(seed) * 36, cy: 10 + h(seed + 9) * 6, r: 4.5, fill: '#fff4c2' }, pic);
    const m1 = 18 + h(seed + 2) * 14;
    svg('path', { d: `M0 34L${m1} ${14 + h(seed + 4) * 6}L${m1 + 16} 30L${m1 + 26} ${18 + h(seed + 5) * 6}L60 32V40H0z`, fill: '#5b8a72' }, pic);
    svg('path', { d: 'M0 36Q30 30 60 36V40H0z', fill: '#3f6f5a' }, pic);
    const name = el('div', 'ak-photo-name', tile);
    const date = el('div', 'ak-photo-date', tile, '2025-07-04');
    return { tile, name, date };
  }

  /**
   * The trip folder as a file list: the first six of its 212 photos. From
   * dateAt each shows the day it was taken; renameAt = [t…] renames the
   * rows in turn to the same name, each one overwriting the one before;
   * restoreAt brings them all back with numbered names.
   */
  function photoFolder(parent, { x, y, at, until, dateAt, renameAt = [], restoreAt }) {
    const { node, body } = card(parent, { x, y, w: 450, tone: 'white', title: '~/Pictures/trip', iconName: 'folder', at, until });
    const count = el('div', 'ak-photo-count', node);
    const grid = el('div', 'ak-photo-grid', body);
    const tiles = Array.from({ length: 5 }, (_, i) => photoTile(grid, i + 1));
    tiles.forEach(({ name }, i) => { name.textContent = `IMG_${String(i + 1).padStart(4, '0')}.jpg`; });
    const renamed = renameAt.length;
    const restore = restoreAt === undefined ? Infinity : restoreAt;
    onFrame((t) => {
      let alive = 212;
      tiles.forEach(({ tile, name, date }, i) => {
        date.classList.toggle('is-on', t >= dateAt);
        const when = renameAt[i];
        const restored = t >= restore;
        let label = `IMG_${String(i + 1).padStart(4, '0')}.jpg`;
        let state = '';
        if (restored) {
          label = `2025-07-04_${String(i + 1).padStart(3, '0')}.jpg`;
          state = 'is-safe';
        } else if (when !== undefined && t >= when) {
          label = '2025-07-04.jpg';
          // A tile renamed later overwrites this one.
          const next = renameAt[i + 1];
          state = next !== undefined && t >= next ? 'is-gone' : 'is-renamed';
        }
        if (name.textContent !== label) name.textContent = label;
        tile.dataset.state = state;
      });
      if (!(t >= restore)) {
        const done = renameAt.filter((when) => t >= when).length;
        if (done === renamed && renamed) alive = 1;
        else if (done > 1) alive = 212 - Math.round((done - 1) * (211 / (renamed - 1)));
      }
      const text = `${alive} photo${alive === 1 ? '' : 's'}`;
      if (count.textContent !== text) count.textContent = text;
      count.dataset.state = alive === 1 ? 'lost' : t >= restore ? 'safe' : '';
    });
    return { node, tiles };
  }

  // ------------------------------------------------------------------
  // The abstraction ladder (verse 5)
  // ------------------------------------------------------------------

  /**
   * Three levels, bottom to top (levels = [{ name, sample, at, iconName }]),
   * with a review lens that moves to lens = [[t, index]], and a "writes"
   * arrow from each level to the one below (writers = [{ from, label, at }]).
   */
  function ladder(parent, { x, y, w = 470, at, until, levels, lens, writers = [] }) {
    const node = box(parent, 'ak-ladder', { x, y, w });
    const ROW = 92;
    const rungs = levels.map((level, i) => {
      const rung = place(el('div', 'ak-ladder-level', node), 0, (levels.length - 1 - i) * ROW);
      rung.style.width = `${w}px`;
      const tag = el('div', 'ak-ladder-name', rung);
      if (level.iconName) tag.append(icon(level.iconName));
      tag.append(document.createTextNode(level.name));
      const sample = el('div', `ak-ladder-sample${level.code ? ' is-code' : ''}`, rung);
      if (level.code) writeCode(sample, highlightPython(level.sample));
      else sample.textContent = level.sample;
      reveal(rung, level.at, 'rise');
      return rung;
    });
    node.style.height = `${levels.length * ROW - 14}px`;
    for (const writer of writers) {
      const arrow = place(el('div', 'ak-ladder-writes', node), w - 132, (levels.length - 1 - writer.from) * ROW + 62);
      arrow.append(icon('arrowDown'));
      el('span', '', arrow, writer.label);
      reveal(arrow, writer.at, 'pop');
    }
    const lensNode = el('div', 'ak-lens is-staged', node);
    lensNode.append(icon('search'));
    el('span', 'ak-lens-label', lensNode, 'review');
    const sorted = lens.slice().sort((a, b) => a[0] - b[0]);
    fx.pop(lensNode, sorted[0][0], { from: 0.5 });
    onFrame((t) => {
      let level = sorted[0][1];
      let from = level;
      let since = Infinity;
      for (let k = 0; k < sorted.length; k++) {
        if (sorted[k][0] <= t) {
          from = level;
          level = sorted[k][1];
          since = t - sorted[k][0];
        }
      }
      const p = reducedMotion.matches ? 1 : smooth(clamp(since / 0.7, 0, 1));
      const yFrom = (levels.length - 1 - from) * ROW, yTo = (levels.length - 1 - level) * ROW;
      lensNode.style.translate = `0 ${(yFrom + (yTo - yFrom) * p + 8).toFixed(1)}px`;
      rungs.forEach((rung, i) => rung.classList.toggle('is-reviewed', i === level && since >= 0));
    });
    enter(node, at, 'fade');
    leave(node, until);
    return { node, rungs };
  }

  // ------------------------------------------------------------------
  // A sequence diagram (verse 6), drawn in UML notation
  // ------------------------------------------------------------------

  /**
   * A sequence diagram on a sheet: parts = ['name:Type' or ':Type', …];
   * messages = [{ from, to, label, at, reply, lost, id, retry }], one row
   * each. Returns { node, art, arrow(id) → its path group, point(id) → its
   * middle in sheet pixels }.
   */
  function sequence(parent, { x, y, w, h, parts, messages, at, until, title, tone = 'white', how = 'pop' }) {
    const { node, body } = card(parent, { x, y, w, h, tone, title, iconName: 'chart', at, until, how });
    const art = svg('svg', { class: 'ak-seq', viewBox: `0 0 ${w - 28} ${h - 70}`, width: w - 28, height: h - 70, 'aria-hidden': 'true' }, body);
    const W = w - 28;
    const gap = W / parts.length;
    const xs = parts.map((_, i) => gap * (i + 0.5));
    const H = h - 70;
    parts.forEach((name, i) => {
      const g = svg('g', { class: 'ak-seq-part' }, art);
      svg('rect', { x: xs[i] - gap * 0.42, y: 2, width: gap * 0.84, height: 30, rx: 4 }, g);
      const label = svg('text', { x: xs[i], y: 22, 'text-anchor': 'middle' }, g);
      label.textContent = name;
      svg('line', { class: 'ak-seq-life', x1: xs[i], y1: 32, x2: xs[i], y2: H - 4 }, art);
    });
    const ROW = (H - 52) / Math.max(1, messages.length);
    const byId = {};
    messages.forEach((m, k) => {
      const yy = 52 + ROW * (k + 0.5);
      const x1 = xs[m.from], x2 = xs[m.to];
      const dir = Math.sign(x2 - x1) || 1;
      const g = svg('g', { class: `ak-seq-msg${m.reply ? ' is-reply' : ''}${m.lost ? ' is-lost' : ''}${m.tone ? ` is-${m.tone}` : ''}` }, art);
      const end = m.lost ? x1 + (x2 - x1) * 0.55 : x2 - dir * 2;
      const shaft = svg('path', { class: 'ak-seq-shaft', d: `M${x1} ${yy}H${end}` }, g);
      if (!m.lost) {
        svg('path', { class: m.reply ? 'ak-seq-head-open' : 'ak-seq-head', d: `M${end - dir * 10} ${yy - 5}L${end} ${yy}L${end - dir * 10} ${yy + 5}${m.reply ? '' : 'z'}` }, g);
      }
      const label = svg('text', { class: 'ak-seq-label', x: (x1 + (m.lost ? end : x2)) / 2, y: yy - 7, 'text-anchor': 'middle' }, g);
      label.textContent = m.label;
      if (m.lost) {
        const cross = svg('g', { class: 'ak-seq-lost' }, g);
        svg('path', { d: `M${end - 7} ${yy - 7}l14 14M${end + 7} ${yy - 7}l-14 14` }, cross);
      }
      if (m.lostAt !== undefined) {
        // The reply goes missing later: a cross lands on its middle.
        const cx = x1 + (x2 - x1) * 0.25;
        const cross = svg('g', { class: 'ak-seq-lost is-staged' }, g);
        svg('path', { d: `M${cx - 9} ${yy - 9}l18 18M${cx + 9} ${yy - 9}l-18 18` }, cross);
        fx.fadeIn(cross, m.lostAt, 0.25);
      }
      if (m.at !== undefined) {
        g.classList.add('is-staged');
        fx.fadeIn(g, m.at, 0.25);
        if (!m.reply) fx.draw(shaft, m.at, 0.45);
      }
      if (m.id) byId[m.id] = { g, mid: [(x1 + x2) / 2 + 14, yy + 35] };
    });
    return {
      node,
      art,
      arrow: (id) => byId[id].g,
      point: (id) => byId[id].mid,
      lifeline: (i) => xs[i] + 14,
    };
  }

  // ------------------------------------------------------------------
  // Tests (verse 7) and the boundary
  // ------------------------------------------------------------------

  /**
   * A test card: name, the input, and the expected result; status follows
   * status = [[t, 'pending'|'pass'|'fail']]; author tags who wrote it; from
   * lockAt a padlock shows it is not to be changed.
   */
  function testCard(parent, { x, y, w = 250, name, given, expect, author, at, until, status = [], lockAt, how = 'pop' }) {
    const node = box(parent, 'ak-test', { x, y, w });
    const head = el('div', 'ak-test-head', node);
    head.append(icon('check', 'ak-test-icon'));
    el('span', 'ak-test-name', head, name);
    if (author) el('span', `ak-test-author ak-test-author--${author === 'You' ? 'you' : 'agent'}`, head, author);
    const io = el('div', 'ak-test-io', node);
    el('span', 'ak-test-given', io, given);
    io.append(icon('forward', 'ak-test-arrow'));
    el('span', 'ak-test-expect', io, expect);
    states(node, status);
    if (lockAt !== undefined) {
      const lock = el('div', 'ak-test-lock is-staged', node);
      lock.append(icon('lock'));
      fx.pop(lock, lockAt, { from: 0.5 });
    }
    enter(node, at, how);
    leave(node, until);
    return node;
  }

  /**
   * A number line of order totals (after coupons) from `from` to `to`, with
   * the boundary at `boundary`; pins = [{ value, label, at, tone }].
   */
  function numberLine(parent, { x, y, w, from, to, boundary, ticks, at, until, pins = [], boundaryAt, caption }) {
    const node = box(parent, 'ak-number-line', { x, y, w });
    const scale = (v) => ((v - from) / (to - from)) * (w - 40) + 20;
    const art = svg('svg', { class: 'ak-nl-art', viewBox: `0 0 ${w} 96`, width: w, height: 96, 'aria-hidden': 'true' }, node);
    svg('rect', { class: 'ak-nl-paid', x: 20, y: 50, width: scale(boundary) - 20, height: 12, rx: 6 }, art);
    svg('rect', { class: 'ak-nl-free', x: scale(boundary), y: 50, width: w - 20 - scale(boundary), height: 12, rx: 6 }, art);
    for (const v of ticks) {
      svg('line', { class: 'ak-nl-tick', x1: scale(v), y1: 46, x2: scale(v), y2: 66 }, art);
      const label = svg('text', { class: 'ak-nl-tick-label', x: scale(v), y: 86, 'text-anchor': 'middle' }, art);
      label.textContent = `$${v}`;
    }
    // Zone names stand at the outer ends, leaving the boundary clear for its pins.
    const zone = (text, x, anchor, className) => {
      const t = svg('text', { class: className, x, y: 38, 'text-anchor': anchor }, art);
      t.textContent = text;
    };
    zone('shipping $5.99', 22, 'start', 'ak-nl-zone ak-nl-zone--paid');
    zone('free shipping', w - 22, 'end', 'ak-nl-zone ak-nl-zone--free');
    if (boundaryAt !== undefined) {
      const line = svg('line', { class: 'ak-nl-boundary is-staged', x1: scale(boundary), y1: 22, x2: scale(boundary), y2: 72 }, art);
      fx.fadeIn(line, boundaryAt, 0.3);
    }
    if (caption) el('div', 'ak-nl-caption', node, caption);
    for (const pin of pins) {
      // A pin just left of the boundary stands to its left, so both read.
      const p = place(el('div', `ak-nl-pin ak-nl-pin--${pin.tone || 'gold'} is-staged`, node), scale(pin.value) - 13 - (pin.side === 'left' ? 24 : 0), 4);
      p.append(icon('pin'));
      if (pin.label) el('span', 'ak-nl-pin-label', p, pin.label);
      tween(p, [{ opacity: 0, translate: '0 -24px' }, { opacity: 1, translate: '0 0' }], pin.at, 0.45, EASE.back);
    }
    enter(node, at, 'fade');
    leave(node, until);
    return { node, scale };
  }

  // ------------------------------------------------------------------
  // The chorus: one level up
  // ------------------------------------------------------------------

  /**
   * The chorus picture, the same every time: a two-storey cut-away. Below,
   * the code floor, piled with pages; above, the glass floor one level up
   * with three cards: Requirements, Design, Tests. `cue` holds the sung
   * times: up, judge, req, design, tests, meet, need, guess, diagram, pin.
   * (x, y) is the top-left of a 520 × 400 picture. Returns { node, point }.
   */
  function levels(parent, { x, y, at, until, cue, tone = 'paper' }) {
    const node = box(parent, `ak-levels ak-levels--${tone}`, { x, y, w: 520, h: 400 });
    // The lower floor: code, too much of it.
    const floor = el('div', 'ak-levels-code', node);
    const floorHead = el('div', 'ak-levels-floor-name', floor);
    floorHead.append(icon('code'));
    floorHead.append(document.createTextNode('Code'));
    el('div', 'ak-levels-count', floor, '10,000 lines');
    const sheet = el('div', 'ak-levels-lines', floor);
    for (let i = 0; i < 16; i++) {
      const bar = el('span', 'ak-levels-line', sheet);
      bar.style.width = `${38 + window.Timeline.hash01(i * 5 + 2) * 56}%`;
      bar.style.marginLeft = `${(i % 4 === 0 ? 0 : i % 3 === 0 ? 8 : 4)}%`;
    }
    // "Judge the design, not line by line": a lens crawls the code, then gives up.
    const crawl = el('div', 'ak-levels-crawl is-staged', floor);
    crawl.append(icon('search'));
    tween(crawl, [{ opacity: 0, translate: '0 0' }, { opacity: 1, translate: '0 6px', offset: 0.15 }, { opacity: 1, translate: '0 44px', offset: 0.8 }, { opacity: 0.0, translate: '0 50px' }], cue.judge - 0.1, 2.2, EASE.linear);
    const notLine = el('div', 'ak-levels-not is-staged', floor);
    notLine.append(icon('cross'));
    notLine.append(document.createTextNode('line by line'));
    fx.pop(notLine, cue.judge + 0.6, { from: 0.6 });
    // The stairs between them.
    const stairs = el('div', 'ak-levels-stairs', node);
    stairs.append(icon('arrowUp'));
    el('span', '', stairs, 'one level up');
    // The upper floor.
    const upper = el('div', 'ak-levels-upper', node);
    fx.fadeIn(upper, cue.up - 0.2, 0.5);
    upper.classList.add('is-staged');
    const slots = [
      ['Requirements', 'list', cue.req],
      ['Design', 'chart', cue.design],
      ['Tests', 'check', cue.tests],
    ].map(([name, iconName, when]) => {
      const slot = el('div', 'ak-levels-card is-staged', upper);
      const head = el('div', 'ak-levels-card-head', slot);
      head.append(icon(iconName));
      el('span', '', head, name);
      const body = el('div', 'ak-levels-card-body', slot);
      fx.pop(slot, when, { from: 0.5, duration: 0.45 });
      return { slot, body };
    });
    // Requirements: the need, not the how; then nothing left to guess.
    const req = slots[0].body;
    reveal(row(req, 'Need: messages show within 2 s', { className: 'ak-levels-need' }), cue.need, 'rise');
    const how = reveal(row(req, 'How: poll every second', { className: 'ak-levels-how' }), cue.need + 0.5, 'rise');
    tween(how, { opacity: 0.55 }, cue.need + 1.1, 0.3);
    how.classList.add('is-struck-later');
    states(how, [[cue.need + 1.1, 'struck']]);
    const guesses = el('div', 'ak-levels-guesses', slots[0].slot);
    // Above the card's title, so they never sit on its text.
    [[8, -36], [58, -42], [108, -36]].forEach(([gx, gy], i) => {
      const q = place(el('span', 'ak-levels-guess is-staged', guesses), gx, gy);
      q.textContent = '?';
      fx.pop(q, cue.need - 0.4 + i * 0.12, { from: 0.4 });
      fx.popOut(q, cue.guess + 0.1 + i * 0.1, 0.25);
    });
    const sure = el('div', 'ak-levels-sure is-staged', slots[0].slot);
    sure.append(icon('check'));
    fx.pop(sure, cue.guess + 0.45, { from: 0.4 });
    // Design: a small diagram draws itself.
    const mini = svg('svg', { class: 'ak-levels-mini is-staged', viewBox: '0 0 120 70', width: 120, height: 70, 'aria-hidden': 'true' }, slots[1].body);
    fx.fadeIn(mini, cue.diagram - 0.05, 0.2);
    const parts = [
      svg('rect', { x: 4, y: 6, width: 40, height: 18, rx: 3 }, mini),
      svg('rect', { x: 76, y: 6, width: 40, height: 18, rx: 3 }, mini),
      svg('path', { d: 'M24 24V66M96 24V66', class: 'ak-levels-mini-life' }, mini),
      svg('path', { d: 'M24 38H92M86 34l6 4-6 4', class: 'ak-levels-mini-msg' }, mini),
      svg('path', { d: 'M96 54H28M34 50l-6 4 6 4', class: 'ak-levels-mini-reply' }, mini),
    ];
    parts.forEach((part, i) => {
      part.classList.add('ak-draw');
      fx.draw(part, cue.diagram + i * 0.12, 0.35);
    });
    // Tests: the boundary, pinned.
    const tests = slots[2].body;
    reveal(row(tests, '$50.00 → free', { className: 'ak-levels-test' }), cue.pin + 0.1, 'rise');
    reveal(row(tests, '$49.99 → $5.99', { className: 'ak-levels-test' }), cue.pin + 0.45, 'rise');
    const pinNode = el('div', 'ak-levels-pin is-staged', slots[2].slot);
    pinNode.append(icon('pin'));
    tween(pinNode, [{ opacity: 0, translate: '0 -20px' }, { opacity: 1, translate: '0 0' }], cue.pin, 0.4, EASE.back);
    // "That's where your thoughts meet mine": two thought bubbles meet over the cards.
    const meetL = place(el('div', 'ak-levels-thought ak-levels-thought--you is-staged', node), 20, -8);
    meetL.textContent = 'you';
    const meetR = place(el('div', 'ak-levels-thought ak-levels-thought--me is-staged', node), 404, -8);
    meetR.textContent = 'me';
    tween(meetL, [{ opacity: 0, translate: '-30px 10px' }, { opacity: 1, translate: '0 0', offset: 0.35 }, { opacity: 1, translate: '150px 0' }], cue.meet, 1.1, EASE.inOut);
    tween(meetR, [{ opacity: 0, translate: '30px 10px' }, { opacity: 1, translate: '0 0', offset: 0.35 }, { opacity: 1, translate: '-150px 0' }], cue.meet, 1.1, EASE.inOut);
    const shared = place(el('div', 'ak-levels-shared is-staged', node), 196, -14);
    shared.append(icon('sparkle'));
    shared.append(document.createTextNode('shared understanding'));
    fx.pop(shared, cue.meet + 1.05, { from: 0.6 });
    tween(meetL, { opacity: 0 }, cue.meet + 1.1, 0.15);
    tween(meetR, { opacity: 0 }, cue.meet + 1.1, 0.15);
    enter(node, at, 'fade');
    leave(node, until);
    // Stage points of the floors, for the agent's glide.
    return {
      node,
      upper: [x + 260, y + 150],
      lower: [x + 260, y + 380],
    };
  }

  // ------------------------------------------------------------------
  // The bridge: complexity, and your skills
  // ------------------------------------------------------------------

  /** A tray of accidental-complexity tiles that fly off at sweepAt. */
  function accidental(parent, { x, y, at, until, sweepAt }) {
    const { node, body } = card(parent, { x, y, w: 300, tone: 'white', kicker: 'Accidental complexity', title: 'from the tools', iconName: 'gear', at, until });
    const tray = el('div', 'ak-tiles', body);
    const TILES = ['import …', '{ } ;', 'getters & setters', 'config.yaml', 'boilerplate', 'syntax'];
    TILES.forEach((text, i) => {
      const tile = el('span', 'ak-tile is-staged', tray);
      tile.textContent = text;
      fx.pop(tile, at + 0.3 + i * 0.12, { from: 0.6 });
      if (sweepAt !== undefined) {
        tween(tile, { opacity: 0, translate: `${260 + i * 14}px ${-40 - (i % 3) * 30}px`, rotate: `${12 + i * 6}deg` }, sweepAt + i * 0.09, 0.6, EASE.in);
      }
    });
    if (sweepAt !== undefined) {
      const done = el('div', 'ak-tiles-done is-staged', body);
      done.append(icon('sparkle'));
      done.append(document.createTextNode('handled by your agent'));
      fx.pop(done, sweepAt + 0.9, { from: 0.6 });
    }
    return node;
  }

  /** The essential complexity: a glowing core with what the problem itself demands. */
  function essential(parent, { x, y, at, until, facets }) {
    const { node, body } = card(parent, { x, y, w: 300, tone: 'gold', kicker: 'Essential complexity', title: 'comes with the problem', iconName: 'target', at, until });
    const core = el('div', 'ak-core', body);
    for (const facet of facets) {
      const r = row(core, '', { className: 'ak-core-facet', at: facet.at });
      r.append(icon(facet.iconName));
      r.append(document.createTextNode(facet.text));
    }
    return node;
  }

  /**
   * A seedling in a pot labelled "your skills": stays small and droops at
   * droopAt, grows from growAt, and a paper bird takes wing at birdAt,
   * flying to (flyTo) stage-relative offsets.
   */
  function seedling(parent, { x, y, at, until, droopAt, growAt, birdAt }) {
    const node = box(parent, 'ak-seedling', { x, y });
    const art = svg('svg', { class: 'ak-seedling-art', viewBox: '0 0 160 190', width: 160, height: 190, 'aria-hidden': 'true' }, node);
    const plant = svg('g', { class: 'ak-plant' }, art);
    const stem = svg('path', { class: 'ak-stem', d: 'M80 150C80 128 80 112 80 96' }, plant);
    const leafL = svg('path', { class: 'ak-leaf', d: 'M80 128C64 126 54 116 52 104C66 104 78 112 80 128z' }, plant);
    const leafR = svg('path', { class: 'ak-leaf', d: 'M80 118C96 116 106 106 108 94C94 94 82 102 80 118z' }, plant);
    const bigL = svg('path', { class: 'ak-leaf ak-leaf--big', d: 'M80 98C58 96 42 80 40 60C62 60 78 74 80 98z' }, plant);
    const bigR = svg('path', { class: 'ak-leaf ak-leaf--big', d: 'M80 86C102 84 118 66 120 46C98 46 82 62 80 86z' }, plant);
    const bud = svg('circle', { class: 'ak-bud', cx: 80, cy: 52, r: 7 }, plant);
    svg('path', { class: 'ak-pot', d: 'M44 148H116L108 186H52z' }, art);
    svg('rect', { class: 'ak-pot-rim', x: 40, y: 140, width: 80, height: 14, rx: 4 }, art);
    el('div', 'ak-seedling-label', node, 'your skills');
    // Growth 0 … 1 from song time; droop tilts the young leaves.
    onFrame((t) => {
      const grow = reducedMotion.matches ? (t >= growAt ? 1 : 0) : smooth(clamp((t - growAt) / 2.4, 0, 1));
      const droop = (t >= droopAt && t < growAt) ? smooth(clamp((t - droopAt) / 1.2, 0, 1)) : t >= growAt ? 1 - grow : 0;
      stem.setAttribute('d', `M80 150C80 128 80 ${112 - grow * 30} 80 ${96 - grow * 44}`);
      plant.style.rotate = `${(droop * 9).toFixed(2)}deg`;
      for (const leaf of [bigL, bigR]) leaf.style.opacity = (grow * 1).toFixed(2);
      bud.style.opacity = clamp((grow - 0.7) / 0.3, 0, 1).toFixed(2);
      leafL.style.opacity = leafR.style.opacity = '1';
    });
    plant.style.transformOrigin = '80px 150px';
    plant.style.transformBox = 'view-box';
    if (birdAt !== undefined) {
      const bird = place(el('div', 'ak-bird is-staged', node), 58, 20);
      const b = svg('svg', { viewBox: '0 0 60 40', width: 60, height: 40, 'aria-hidden': 'true' }, bird);
      const wingA = svg('path', { class: 'ak-bird-wing', d: 'M30 22L4 8L22 26z' }, b);
      svg('path', { class: 'ak-bird-body', d: 'M10 26L58 14L30 30z' }, b);
      const wingB = svg('path', { class: 'ak-bird-wing ak-bird-wing--far', d: 'M30 22L50 2L36 24z' }, b);
      tween(bird, [
        { opacity: 0, translate: '0 20px', rotate: '0deg' },
        { opacity: 1, translate: '0 0', rotate: '-6deg', offset: 0.15 },
        { opacity: 1, translate: '120px -110px', rotate: '-14deg', offset: 0.7 },
        { opacity: 0.9, translate: '230px -190px', rotate: '-10deg' },
      ], birdAt, 2.6, EASE.inOut);
      onFrame((t) => {
        const flap = reducedMotion.matches || t < birdAt ? 0 : Math.sin((t - birdAt) * 14);
        wingA.setAttribute('transform', `rotate(${(flap * 16).toFixed(1)} 30 22)`);
        wingB.setAttribute('transform', `rotate(${(-flap * 12).toFixed(1)} 30 22)`);
      });
    }
    enter(node, at, 'rise');
    leave(node, until);
    return node;
  }

  // ------------------------------------------------------------------
  // The quiz card (shared .quiz-card look)
  // ------------------------------------------------------------------

  /** The shared quiz card, narrowed for the agent beside it. */
  function quizCard(parent, { entry, index, count, at, until, iconName }) {
    const node = el('div', 'quiz-card ak-quiz is-staged', parent);
    el('div', 'quiz-count', node, `Quiz ${index} / ${count}`);
    if (iconName) node.append(icon(iconName, 'ak-quiz-icon'));
    el('div', 'quiz-question ak-quiz-question', node, entry.text.replace(/^Pop quiz[:!]\s*(No asking me:\s*)?/, ''));
    const answer = el('div', 'quiz-answer ak-quiz-answer is-staged', node);
    answer.append(icon('check'));
    el('span', '', answer, entry.answer);
    fx.slam(answer, entry.answer_at, { from: 1.4, duration: 0.3 });
    enter(node, at, 'pop');
    leave(node, until);
    return node;
  }

  window.AgentKit = {
    enter, leave, box, reveal, states, row, pill, mark, bubble, code, card,
    phaseStrip, weights, contextBoard, receipt, photoFolder, ladder, sequence,
    testCard, numberLine, levels, accidental, essential, seedling, quizCard,
  };
})();
