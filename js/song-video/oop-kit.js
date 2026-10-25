/*
 * Teaching artwork for "Let the Object Decide", the object-oriented
 * programming song (choreography: js/song-video/songs/let_the_object_decide.js).
 *
 * The song's visual language, used the same way every time:
 *   - an object card is a UML-style box: a header (`car1 : Car` for an
 *     object, `Car` for a class), a state compartment behind a padlock, and
 *     a methods compartment whose methods are buttons on a door;
 *   - a message is an envelope labeled with its selector (`brake()`) flying
 *     along a dashed arc, like a sequence-diagram message;
 *   - code is C++ on a code card that changes in place (strike, add, swap)
 *     instead of swapping cards, so every line stays up long enough to read;
 *   - the rule card in the corner collects the song's five rules.
 * Everything is posed from song time through Timeline. Coordinates are CSS
 * pixels on the 960×540 stage; nothing essential goes below y = 460, where
 * the player draws captions. Styles: css/song-video-oop-kit.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, clamp, easeInOutCubic } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, place, icon } = kit;

  function requireTime(at, what) {
    if (!Number.isFinite(at)) throw new Error(`oop-kit.js: ${what} needs a finite \`at\` time.`);
  }

  /** Pops a node in at `at` and out at `until`. */
  function show(node, at, until, { rotate = 0, from = 0.94 } = {}) {
    requireTime(at, node.className);
    tween(node, [{ opacity: 0, scale: from, rotate: `${rotate}deg` }, { opacity: 1, scale: 1, rotate: `${rotate}deg` }], at, 0.24, EASE.out);
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  /** Rises a node in at `at` and fades it out at `until`. */
  function enter(node, at, until, distance = 8) {
    requireTime(at, node.className);
    fx.rise(node, at, { distance, duration: 0.28 });
    if (until !== undefined) fx.fadeOut(node, until, 0.28);
    return node;
  }

  /** Toggles a class on a node during [from, to). */
  function during(node, className, from, to = Infinity) {
    onFrame((t) => node.classList.toggle(className, t >= from && t < to));
  }

  /** The newest entry of a time-sorted list at or before t. */
  function latest(entries, t) {
    let found;
    for (const entry of entries) if (entry.at <= t) found = entry;
    return found;
  }

  // ------------------------------------------------------------------
  // Small line icons (24×24, round strokes in currentColor)
  // ------------------------------------------------------------------

  const GLYPHS = {
    lockClosed: [['rect', { x: 5, y: 11, width: 14, height: 10, rx: 2 }], ['path', { d: 'M8 11V8a4 4 0 0 1 8 0v3' }]],
    lockOpen: [['rect', { x: 5, y: 11, width: 14, height: 10, rx: 2 }], ['path', { d: 'M8 11V8a4 4 0 0 1 7.6-1.8' }]],
    gear: [['circle', { cx: 12, cy: 12, r: 3.2 }], ['path', { d: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1' }]],
    envelope: [['rect', { x: 3, y: 6, width: 18, height: 13, rx: 2 }], ['path', { d: 'M3.5 7l8.5 6.5L20.5 7' }]],
    check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
    cross: [['path', { d: 'M7 7l10 10M17 7L7 17' }]],
    pin: [['path', { d: 'M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z' }], ['circle', { cx: 12, cy: 11, r: 2.2 }]],
    gauge: [['path', { d: 'M4 16a8 8 0 1 1 16 0' }], ['path', { d: 'M12 16l4-5' }]],
    pads: [['rect', { x: 4, y: 5, width: 5, height: 14, rx: 1.5 }], ['rect', { x: 15, y: 5, width: 5, height: 14, rx: 1.5 }], ['path', { d: 'M9 12h6' }]],
    battery: [['rect', { x: 3, y: 7, width: 16, height: 10, rx: 2 }], ['path', { d: 'M21 10v4' }]],
    seal: [['circle', { cx: 12, cy: 10, r: 6 }], ['path', { d: 'M9 15l-2 6 5-2 5 2-2-6' }], ['path', { d: 'M9.5 10l1.8 1.8L14.8 8.4' }]],
    search: [['circle', { cx: 10.5, cy: 10.5, r: 6 }], ['path', { d: 'M15 15l5 5' }]],
    ticket: [['path', { d: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z' }], ['path', { d: 'M9 7v10', 'stroke-dasharray': '2 2' }]],
    chat: [['path', { d: 'M4 5h16v11H9l-5 4z' }]],
    plane: [['path', { d: 'M3 11l18-7-7 18-3-8z' }], ['path', { d: 'M11 14l10-10' }]],
  };

  function glyph(name, className) {
    const shapes = GLYPHS[name];
    if (!shapes) throw new Error(`oop-kit.js has no glyph "${name}".`);
    const node = svg('svg', {
      viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
    });
    if (className) node.setAttribute('class', className);
    for (const [tag, attrs] of shapes) svg(tag, attrs, node);
    return node;
  }

  // ------------------------------------------------------------------
  // Object cards
  // ------------------------------------------------------------------

  /**
   * objectCard(parent, { x, y, w, title, kind, fields, methods, at, until,
   *   methodsAt, compact, lockAt })
   * kind: 'object' (underlined `name : Class`), 'class', 'record' (state
   * only), 'blueprint' (names, no values). fields = [[name, value]];
   * methods = ['steer()', …]. With `methodsAt`, the methods compartment
   * grows in at that time (a record becoming an object).
   */
  function objectCard(parent, { x, y, w = 220, title, kind = 'object', fields = [], methods = [], at, until, methodsAt, compact = false, lockAt, unlocked = false }) {
    const node = place(el('div', `oop-card oop-card--${kind}${compact ? ' oop-card--compact' : ''} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'oop-card-head', node);
    el('span', 'oop-card-title', head, title);
    // A card without fields (a class or interface box) has no state compartment.
    const state = fields.length || kind === 'record' ? el('div', 'oop-card-state', node) : null;
    let lock = null;
    if (state) {
      const stateHead = el('div', 'oop-card-label', state);
      lock = el('span', 'oop-lock', stateHead);
      lock.append(glyph('lockOpen', 'oop-lock-open'), glyph('lockClosed', 'oop-lock-closed'));
      el('span', null, stateHead, kind === 'record' ? 'fields' : 'state');
    }
    const fieldRows = new Map();
    for (const [name, value] of fields) {
      const row = el('div', 'oop-field', state);
      el('span', 'oop-field-name', row, name);
      const valueNode = el('span', 'oop-field-value', row, value === undefined ? '' : ` = ${value}`);
      fieldRows.set(name, { row, valueNode, versions: [{ at: -Infinity, text: value }] });
    }
    const methodRows = new Map();
    let methodBox = null;
    if (methods.length || methodsAt !== undefined) {
      methodBox = el('div', 'oop-card-methods', node);
      const methodHead = el('div', 'oop-card-label', methodBox);
      methodHead.append(glyph('gear', 'oop-gear'));
      el('span', null, methodHead, 'methods');
      const door = el('div', 'oop-door', methodBox);
      for (const name of methods) methodRows.set(name, el('span', 'oop-method', door, name));
      if (methodsAt !== undefined) {
        tween(methodBox, [{ opacity: 0, maxHeight: '0px', paddingTop: '0px', paddingBottom: '0px' }, { opacity: 1, maxHeight: '160px', paddingTop: '6px', paddingBottom: '8px' }], methodsAt, 0.5, EASE.out);
        methodBox.style.opacity = '0';
        methodBox.style.maxHeight = '0px';
      }
    }
    enter(node, at, until);
    // Values change over time: `name = value` swaps in on its cue.
    for (const entry of fieldRows.values()) {
      onFrame((t) => {
        const current = latest(entry.versions, t);
        const text = current.text === undefined ? '' : ` = ${current.text}`;
        if (entry.valueNode.textContent !== text) entry.valueNode.textContent = text;
      });
    }
    const locks = [{ at: -Infinity, locked: kind !== 'record' && !unlocked }];
    if (lockAt !== undefined) {
      locks.push({ at: lockAt, locked: true });
      if (lock) fx.bump(lock, lockAt, 0.5);
    }
    onFrame((t) => node.classList.toggle('is-unlocked', !latest(locks, t).locked));
    const api = {
      node,
      state,
      methodBox,
      field: (name) => fieldRows.get(name).row,
      method: (name) => methodRows.get(name),
      /** A method button glows while it runs. */
      light(name, from, to) {
        during(methodRows.get(name), 'is-lit', from, to);
        during(node, 'is-running', from, to);
        return api;
      },
      focus(name, from, to, tone = 'focus') {
        during(fieldRows.get(name).row, `is-${tone}`, from, to);
        return api;
      },
      /** At `atTime` the field shows `value`, tinted with `tone` until `toneUntil`. */
      setValue(name, atTime, value, tone, toneUntil = Infinity) {
        const entry = fieldRows.get(name);
        entry.versions.push({ at: atTime, text: value });
        entry.versions.sort((p, q) => p.at - q.at);
        fx.bump(entry.row, atTime, 0.12);
        if (tone) during(entry.row, `is-${tone}`, atTime, toneUntil);
        return api;
      },
      lock(atTime) {
        locks.push({ at: atTime, locked: true });
        locks.sort((p, q) => p.at - q.at);
        if (lock) fx.bump(lock, atTime, 0.4);
        return api;
      },
      unlock(atTime) {
        locks.push({ at: atTime, locked: false });
        locks.sort((p, q) => p.at - q.at);
        if (lock) fx.bump(lock, atTime, 0.4);
        return api;
      },
      /** A gold seal: this object keeps its class's promises. */
      seal(atTime) {
        const badge = el('div', 'oop-seal is-staged', node);
        badge.append(glyph('seal'));
        el('span', null, badge, 'keeps the promise');
        fx.pop(badge, atTime, { rotate: -6 });
        return badge;
      },
      /**
       * A panel that slides out beside (or below) the card: a method's own
       * implementation. side: 'right', 'left', or 'below'.
       */
      panel(text, { at: pAt, until: pUntil, iconName, side = 'right', w: pw }) {
        const box = el('div', `oop-impl oop-impl--${side} is-staged`, node);
        if (pw) box.style.width = `${pw}px`;
        if (iconName) box.append(glyph(iconName));
        el('code', null, box, text);
        const [dx, dy] = { right: [-24, 0], left: [24, 0], below: [0, -16] }[side];
        fx.slideIn(box, pAt, { dx, dy, duration: 0.35 });
        if (pUntil !== undefined) tween(box, { opacity: 0, translate: `${dx}px ${dy}px` }, pUntil, 0.3, EASE.in);
        return box;
      },
    };
    return api;
  }

  // ------------------------------------------------------------------
  // Messages: an envelope flying along a dashed arc
  // ------------------------------------------------------------------

  /**
   * envelope(parent, { from, to, label, at, dur, bend, stay, tone })
   * The envelope travels from `from` to `to` (stage points) in `dur`
   * seconds, then lands and fades after `stay` seconds. The default hold leaves time
   * to read the selector after the movement has stopped.
   */
  function envelope(parent, { from, to, label, at, dur = 0.7, bend = -50, stay = 1.25, tone = 'gold', trail = true }) {
    requireTime(at, 'envelope');
    const [x1, y1] = from;
    const [x2, y2] = to;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 + bend;
    let path = null;
    if (trail) {
      const art = svg('svg', { class: 'oop-trail is-staged', viewBox: '0 0 960 540' }, parent);
      path = svg('path', { class: `oop-trail-path oop-trail-path--${tone}`, d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}` }, art);
      fx.fadeIn(art, at, 0.1);
      fx.draw(path, at, dur);
      fx.fadeOut(art, at + dur + stay, 0.25);
    }
    const node = el('div', `oop-envelope oop-envelope--${tone}`, parent);
    node.append(glyph('envelope'));
    if (label) el('span', 'oop-envelope-label', node, label);
    onFrame((t) => {
      const age = t - at;
      if (age < 0 || age > dur + stay + 0.25) {
        node.style.display = 'none';
        return;
      }
      node.style.display = '';
      const p = easeInOutCubic(clamp(age / dur, 0, 1));
      const bx = (1 - p) * (1 - p) * x1 + 2 * (1 - p) * p * cx + p * p * x2;
      const by = (1 - p) * (1 - p) * y1 + 2 * (1 - p) * p * cy + p * p * y2;
      const landed = age > dur;
      const fade = landed ? clamp(1 - (age - dur - stay) / 0.25, 0, 1) : clamp(age / 0.12, 0, 1);
      node.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px) translate(-50%, -50%)`;
      node.style.opacity = fade.toFixed(2);
    });
    return node;
  }

  // ------------------------------------------------------------------
  // C++ code cards with syntax colours
  // ------------------------------------------------------------------

  const KEYWORDS = new Set(['for', 'int', 'if', 'else', 'return', 'class', 'public', 'private', 'virtual', 'void', 'override', 'double', 'const', 'struct', 'auto', 'new', 'bool', 'true', 'false', 'while', 'record']);
  const TOKEN = /(\/\/.*$)|("[^"]*")|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)|(\s+)|(.)/g;

  /** Splits one line of C++ into [text, tone] runs. */
  function highlight(source) {
    const runs = [];
    for (const match of source.matchAll(TOKEN)) {
      const [text, comment, string, number, word] = match;
      let tone = null;
      if (comment) tone = 'cm';
      else if (string) tone = 'str';
      else if (number) tone = 'num';
      else if (word) {
        if (KEYWORDS.has(word)) tone = 'kw';
        else if (/^[A-Z]/.test(word)) tone = 'cls';
        else if (source[match.index + word.length] === '(') tone = 'call';
        else if (/^[A-Z_]+$/.test(word)) tone = 'const';
      }
      runs.push([text, tone]);
    }
    return runs;
  }

  /**
   * code(parent, { x, y, w, title, lines, at, until, size })
   * lines = [string | { text, at, until, tone: 'add'|'del'|'dim'|'focus',
   * strikeAt, focusAt, focusUntil, swap: [{ at, text }] }]. Lines with `at`
   * rise in on their own; `swap` rewrites a line in place.
   * Returns { node, rows, mark(index, from, to, tone) }.
   */
  function code(parent, { x, y, w, title, lines, at, until, size }) {
    const node = place(el('div', 'code-card oop-code is-staged', parent), x, y);
    node.style.width = `${w}px`;
    if (size) node.style.setProperty('--oop-code-size', `${size}px`);
    if (title) {
      const bar = el('div', 'code-card-title oop-code-title', node);
      bar.append(icon('file'));
      bar.append(document.createTextNode(title));
    }
    const body = el('div', 'oop-code-body', node);
    const rows = lines.map((spec) => {
      const line = typeof spec === 'string' ? { text: spec } : spec;
      const row = el('div', `code-line oop-code-line${line.at !== undefined ? ' is-staged' : ''}`, body);
      const versions = [{ at: -Infinity, text: line.text }, ...(line.swap || [])].map((version) => {
        const holder = kit.writeCode(el('span', 'oop-code-text', row), highlight(version.text));
        return { ...version, holder };
      });
      if (versions.length > 1) {
        onFrame((t) => {
          const current = latest(versions, t);
          for (const version of versions) version.holder.style.display = version === current ? '' : 'none';
        });
        for (const version of versions.slice(1)) fx.bump(row, version.at, 0.04);
      }
      if (line.tone) row.classList.add(`oop-code-line--${line.tone}`);
      if (line.at !== undefined) fx.rise(row, line.at, { distance: 6, duration: 0.25 });
      if (line.until !== undefined) fx.fadeOut(row, line.until, 0.2);
      if (line.strikeAt !== undefined) during(row, 'is-struck', line.strikeAt);
      if (line.focusAt !== undefined) during(row, 'is-focus', line.focusAt, line.focusUntil);
      return row;
    });
    enter(node, at, until);
    return {
      node,
      rows,
      mark(index, from, to, tone = 'focus') {
        during(rows[index], `is-${tone}`, from, to);
      },
    };
  }

  // ------------------------------------------------------------------
  // The rule card: the song's five rules, collected in the corner
  // ------------------------------------------------------------------

  const RULES = ['state + code inside', 'send a message', 'the object decides', 'keep the promise', 'use where it fits'];

  /**
   * ruleCard(parent, { x, y, at, until, shown, row }) → { add(i, at), glow(i, from, to) }
   * The first `shown` rules are there from the start; `row` lays all five
   * out in one line (the curtain call).
   */
  function ruleCard(parent, { x, y, at, until, shown = 0, row = false }) {
    const node = place(el('div', `oop-rules${row ? ' oop-rules--row' : ''} is-staged`, parent), x, y);
    el('div', 'oop-rules-title', node, 'The object rules');
    const rows = RULES.map((text, i) => {
      const row = el('div', `oop-rule${i < shown ? '' : ' is-staged'}`, node);
      el('span', 'oop-rule-num', row, String(i + 1));
      el('span', 'oop-rule-text', row, text);
      return row;
    });
    enter(node, at, until, 10);
    return {
      node,
      add(i, atTime) { fx.pop(rows[i], atTime, { from: 0.7 }); return this; },
      glow(i, from, to) { during(rows[i], 'is-lit', from, to); return this; },
    };
  }

  // ------------------------------------------------------------------
  // Captions inside the picture: name cards, labels, bubbles, notices
  // ------------------------------------------------------------------

  /** A credits card for a person or a language: name, then a detail line. */
  function nameCard(parent, { x, y, name, detail, at, until, w }) {
    const node = place(el('div', 'oop-name is-staged', parent), x, y);
    if (w) node.style.width = `${w}px`;
    el('div', 'oop-name-main', node, name);
    if (detail) el('div', 'oop-name-detail', node, detail);
    return enter(node, at, until, 10);
  }

  /** A short label, optionally with a ✓ / ✗ glyph (shape, never colour alone). */
  function label(parent, text, { x, y, at, until, tone = 'plain', mark, rotate = 0 }) {
    const node = place(el('div', `oop-label oop-label--${tone} is-staged`, parent), x, y);
    if (mark) node.append(glyph(mark === 'pass' ? 'check' : 'cross', `oop-label-mark oop-label-mark--${mark}`));
    el('span', null, node, text);
    return show(node, at, until, { rotate });
  }

  function bubble(parent, text, { x, y, at, until, tail = 'down', tone = 'white', w }) {
    const node = place(el('div', `oop-bubble oop-bubble--${tail} oop-bubble--${tone} is-staged`, parent), x, y);
    if (w) node.style.width = `${w}px`;
    el('span', null, node, text);
    return show(node, at, until, { from: 0.5 });
  }

  /** A group-chat system notice, as in a messaging app. */
  function chatNotice(parent, text, { x, y, at, until }) {
    const node = place(el('div', 'oop-chat is-staged', parent), x, y);
    node.append(glyph('chat'));
    el('span', null, node, text);
    fx.slideIn(node, at, { dx: 0, dy: -16, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /** A feature-request ticket. */
  function ticket(parent, { x, y, from, title, at, until }) {
    const node = place(el('div', 'oop-ticket is-staged', parent), x, y);
    const head = el('div', 'oop-ticket-from', node);
    head.append(glyph('ticket'));
    el('span', null, head, from);
    el('div', 'oop-ticket-title', node, title);
    fx.slideIn(node, at, { dx: 60, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /** A search box whose match count runs up to `count`. */
  function search(parent, { x, y, query, count, at, countFrom, countTo, until }) {
    const node = place(el('div', 'oop-search is-staged', parent), x, y);
    node.append(glyph('search'));
    el('code', 'oop-search-query', node, query);
    const hits = el('span', 'oop-search-hits', node, '');
    onFrame((t) => {
      const n = t < countFrom ? 0 : Math.round(count * clamp((t - countFrom) / (countTo - countFrom), 0, 1));
      const text = t < countFrom ? '' : `${n} matches`;
      if (hits.textContent !== text) hits.textContent = text;
    });
    fx.bump(node, countTo, 0.08);
    return enter(node, at, until);
  }

  /** A data table: cols = names, rows = [[cells]]. set() changes a cell. */
  function table(parent, { x, y, w, cols, rows, at, until }) {
    const node = place(el('div', 'oop-table is-staged', parent), x, y);
    if (w) node.style.width = `${w}px`;
    const head = el('div', 'oop-table-row oop-table-head', node);
    for (const c of cols) el('span', null, head, c);
    const cells = rows.map((cellsInRow) => {
      const row = el('div', 'oop-table-row', node);
      return cellsInRow.map((value) => ({ node: el('span', null, row, value), versions: [{ at: -Infinity, text: value }] }));
    });
    for (const row of cells) {
      for (const cell of row) {
        onFrame((t) => {
          const text = latest(cell.versions, t).text;
          if (cell.node.textContent !== text) cell.node.textContent = text;
        });
      }
    }
    enter(node, at, until);
    return {
      node,
      cell: (r, c) => cells[r][c].node,
      set(r, c, atTime, value, tone) {
        const cell = cells[r][c];
        cell.versions.push({ at: atTime, text: value });
        cell.versions.sort((p, q) => p.at - q.at);
        fx.bump(cell.node, atTime, 0.3);
        if (tone) during(cell.node, `is-${tone}`, atTime);
      },
      highlightColumn(c, from, to) {
        for (const row of cells) during(row[c].node, 'is-focus', from, to);
        during(head.children[c], 'is-focus', from, to);
      },
    };
  }

  // ------------------------------------------------------------------
  // Flags: red pennant ✗ or green banner ✓ (label + shape + colour)
  // ------------------------------------------------------------------

  function flagArt(kind) {
    const art = svg('svg', { class: `oop-flag-art oop-flag-art--${kind}`, viewBox: '0 0 60 70', 'aria-hidden': 'true' });
    svg('path', { class: 'oop-flag-pole', d: 'M8 4 V68' }, art);
    if (kind === 'red') {
      svg('path', { class: 'oop-flag-cloth', d: 'M10 6 L56 20 L10 34 Z' }, art);
      svg('path', { class: 'oop-flag-mark', d: 'M19 14 L31 26 M31 14 L19 26' }, art);
    } else {
      svg('path', { class: 'oop-flag-cloth', d: 'M10 6 H54 V34 H10 Z' }, art);
      svg('path', { class: 'oop-flag-mark', d: 'M20 20 L27 27 L42 12' }, art);
    }
    return art;
  }

  /** A planted flag with its label: flag(parent, { x, y, kind, at, until }). */
  function flag(parent, { x, y, kind, at, until, text }) {
    const node = place(el('div', `oop-flag oop-flag--${kind} is-staged`, parent), x, y);
    node.append(flagArt(kind));
    el('span', 'oop-flag-label', node, text || (kind === 'red' ? 'Red flag' : 'Green flag'));
    tween(node, [{ opacity: 0, translate: '0 -60px', rotate: '-14deg' }, { opacity: 1, translate: '0 0', rotate: '0deg' }], at, 0.32, EASE.back);
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /** Both flags waving while the class decides: from `from` to `to`. */
  function flagPair(parent, { x, y, from, to }) {
    const node = place(el('div', 'oop-flagpair is-staged', parent), x, y);
    const red = el('div', 'oop-flagpair-flag', node);
    red.append(flagArt('red'));
    el('span', 'oop-flag-label', red, 'Red flag?');
    const green = el('div', 'oop-flagpair-flag', node);
    green.append(flagArt('green'));
    el('span', 'oop-flag-label', green, 'Green flag?');
    fx.fadeIn(node, from, 0.2);
    fx.fadeOut(node, to, 0.15);
    onFrame((t) => {
      if (t < from || t > to + 0.2) return;
      red.style.rotate = `${(6 * Math.sin(t * 7)).toFixed(2)}deg`;
      green.style.rotate = `${(-6 * Math.sin(t * 7 + 1)).toFixed(2)}deg`;
    });
    return node;
  }

  // ------------------------------------------------------------------
  // Pictures for single lines
  // ------------------------------------------------------------------

  /** A living cell that turns into a small computer at `morphAt`. */
  function cellComputer(parent, { x, y, at, morphAt, until }) {
    const node = place(el('div', 'oop-cell is-staged', parent), x, y);
    const art = svg('svg', { viewBox: '0 0 120 110', width: 120, height: 110, 'aria-hidden': 'true' }, node);
    const cell = svg('g', { class: 'oop-cell-life' }, art);
    svg('ellipse', { class: 'oop-cell-membrane', cx: 60, cy: 54, rx: 50, ry: 44 }, cell);
    svg('ellipse', { class: 'oop-cell-nucleus', cx: 60, cy: 54, rx: 20, ry: 17 }, cell);
    const machine = svg('g', { class: 'oop-cell-machine' }, art);
    svg('rect', { class: 'oop-pc-screen', x: 18, y: 14, width: 84, height: 58, rx: 6 }, machine);
    svg('rect', { class: 'oop-pc-glass', x: 26, y: 21, width: 68, height: 43, rx: 3 }, machine);
    svg('path', { class: 'oop-pc-stand', d: 'M52 72 L48 88 H72 L68 72 M36 92 H84' }, machine);
    const nucleusLabel = el('span', 'oop-cell-label', node, 'state');
    enter(node, at, until);
    tween(cell, [{ opacity: 1 }, { opacity: 0 }], morphAt, 0.4, EASE.inOut);
    tween(machine, [{ opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1 }], morphAt, 0.45, EASE.out);
    machine.style.opacity = '0';
    machine.style.transformOrigin = '60px 54px';
    return { node, nucleusLabel };
  }

  /** A gloved arm reaching from `from` toward `to`; blocked (✕) at `blockAt`. */
  function reach(parent, { from, to, at, until, blockAt, tone = 'red', stopShort = 0 }) {
    const art = svg('svg', { class: 'oop-reach is-staged', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    const [x1, y1] = from;
    const [x2, y2] = to;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const ex = x2 - Math.cos(angle) * stopShort;
    const ey = y2 - Math.sin(angle) * stopShort;
    const arm = svg('path', { class: `oop-reach-arm oop-reach-arm--${tone}`, d: `M ${x1} ${y1} L ${ex} ${ey}` }, art);
    const hand = svg('g', { class: 'oop-reach-hand', transform: `translate(${ex} ${ey}) rotate(${(angle * 180) / Math.PI})` }, art);
    svg('path', { class: `oop-reach-palm oop-reach-arm--${tone}`, d: 'M-6 -9 Q8 -10 9 -2 L14 -6 M9 -2 L15 0 M9 1 L14 5 M-6 9 Q6 10 8 3' }, hand);
    fx.fadeIn(art, at, 0.1);
    fx.draw(arm, at, 0.35);
    hand.style.opacity = '0';
    tween(hand, [{ opacity: 0 }, { opacity: 1 }], at + 0.3, 0.1, EASE.out);
    if (blockAt !== undefined) {
      const mark = place(el('div', 'oop-blocked is-staged', parent), ex - 22, ey - 22);
      mark.append(glyph('cross'));
      el('span', null, mark, 'reach in');
      fx.slam(mark, blockAt, { from: 1.8 });
      if (until !== undefined) fx.fadeOut(mark, until, 0.25);
    }
    if (until !== undefined) fx.fadeOut(art, until, 0.25);
    return art;
  }

  /** A rectangle on a grid whose size animates: bench.resize(at, w, h, label). */
  function bench(parent, { x, y, at, until, w = 50, h = 20, unit = 2.2, labelText }) {
    const node = place(el('div', 'oop-bench is-staged', parent), x, y);
    const shape = el('div', 'oop-bench-shape', node);
    const name = el('span', 'oop-bench-name', shape, labelText || '');
    const size = el('div', 'oop-bench-size', node, '');
    const heightTag = el('div', 'oop-bench-height', node, '');
    const sizes = [{ at: -Infinity, w, h, label: labelText }];
    onFrame((t) => {
      const current = latest(sizes, t);
      const prev = sizes[Math.max(0, sizes.indexOf(current) - 1)];
      // A jump is a cut (a different object on the bench); a resize is tweened.
      const p = current.at === -Infinity || current.jump ? 1 : easeInOutCubic(clamp((t - current.at) / 0.45, 0, 1));
      const cw = prev.w + (current.w - prev.w) * p;
      const ch = prev.h + (current.h - prev.h) * p;
      shape.style.width = `${(cw * unit).toFixed(1)}px`;
      shape.style.height = `${(ch * unit).toFixed(1)}px`;
      const text = `${Math.round(cw)} × ${Math.round(ch)}`;
      if (size.textContent !== text) size.textContent = text;
      const heightText = `height ${Math.round(ch)}`;
      if (heightTag.textContent !== heightText) heightTag.textContent = heightText;
      if (current.label !== undefined && name.textContent !== current.label) name.textContent = current.label;
      node.classList.toggle('is-square', Boolean(current.square));
    });
    enter(node, at, until);
    return {
      node,
      heightTag,
      /** At `atTime`, set the shape to w × h (tweened, or cut with `jump`), optionally renaming it. */
      resize(atTime, nw, nh, { label: newLabel, square, jump = false } = {}) {
        sizes.push({ at: atTime, w: nw, h: nh, label: newLabel, square, jump });
        sizes.sort((p, q) => p.at - q.at);
        return this;
      },
      /** A pass/fail verdict on the height, shown from `atTime` until `untilTime`. */
      verdict(atTime, pass, text, untilTime = Infinity) {
        during(heightTag, pass ? 'is-pass' : 'is-fail', atTime, untilTime);
        const mark = el('div', `oop-verdict oop-verdict--${pass ? 'pass' : 'fail'} is-staged`, node);
        mark.append(glyph(pass ? 'check' : 'cross'));
        el('span', null, mark, text);
        fx.pop(mark, atTime, { rotate: pass ? -3 : 4 });
        if (Number.isFinite(untilTime)) fx.popOut(mark, untilTime - 0.2);
        return mark;
      },
    };
  }

  /** The expression-problem grid: rows = classes, cols = operations. */
  function matrix(parent, { x, y, rows, cols, at, until, addRow, addCol }) {
    const node = place(el('div', 'oop-matrix is-staged', parent), x, y);
    const grid = el('div', 'oop-matrix-grid', node);
    const allCols = [...cols, ...(addCol ? [addCol.name] : [])];
    const allRows = [...rows, ...(addRow ? [addRow.name] : [])];
    grid.style.gridTemplateColumns = `110px repeat(${allCols.length}, 76px)`;
    el('span', 'oop-matrix-corner', grid, '');
    allCols.forEach((c, ci) => {
      const head = el('span', `oop-matrix-head${addCol && ci === cols.length ? ' oop-matrix-new is-staged' : ''}`, grid, c);
      if (addCol && ci === cols.length) fx.pop(head, addCol.at);
    });
    allRows.forEach((r, ri) => {
      const isNewRow = addRow && ri === rows.length;
      const head = el('span', `oop-matrix-rowhead${isNewRow ? ' oop-matrix-new is-staged' : ''}`, grid, r);
      if (isNewRow) fx.pop(head, addRow.at);
      allCols.forEach((_, ci) => {
        const isNewCol = addCol && ci === cols.length;
        const cell = el('span', `oop-matrix-cell${isNewRow || isNewCol ? ' oop-matrix-new is-staged' : ''}`, grid);
        cell.append(glyph('check'));
        if (isNewRow) fx.pop(cell, addRow.at + 0.08 * (ci + 1));
        else if (isNewCol) fx.pop(cell, addCol.at + 0.1 * (ri + 1));
      });
    });
    return enter(node, at, until);
  }

  /**
   * A magnifier drifting through `path` (offsets from x, y); with `hat`, a
   * detective's deerstalker brim sits on the lens.
   */
  function magnifier(parent, { x, y, at, until, path: pts, hat = true }) {
    const node = place(el('div', 'oop-magnifier is-staged', parent), x, y);
    const art = svg('svg', { viewBox: '0 0 90 90', width: 90, height: 90, 'aria-hidden': 'true' }, node);
    if (hat) svg('path', { class: 'oop-hat', d: 'M14 22 Q34 0 56 20 Q64 12 74 16 Q60 22 54 26 L16 28 Q8 26 14 22 Z' }, art);
    svg('circle', { class: 'oop-lens', cx: 36, cy: 44, r: 20 }, art);
    svg('path', { class: 'oop-lens-handle', d: 'M51 59 L72 80' }, art);
    enter(node, at, until);
    if (pts) {
      onFrame((t) => {
        if (t < at) return;
        const k = (t - at) * 0.9;
        const i = Math.floor(k) % pts.length;
        const j = (i + 1) % pts.length;
        const f = easeInOutCubic(k - Math.floor(k));
        node.style.translate = `${(pts[i][0] + (pts[j][0] - pts[i][0]) * f).toFixed(1)}px ${(pts[i][1] + (pts[j][1] - pts[i][1]) * f).toFixed(1)}px`;
      });
    }
    return node;
  }

  /** A struct in a trench coat and hat; the coat drops at `dropAt`. */
  function trenchCoat(parent, { x, y, at, dropAt, until }) {
    const node = place(el('div', 'oop-coat is-staged', parent), x, y);
    const card = el('div', 'oop-coat-struct', node);
    el('div', 'oop-coat-struct-head', card, 'struct Car');
    for (const f of ['x', 'y', 'speed']) el('div', 'oop-coat-struct-field', card, f);
    const art = svg('svg', { class: 'oop-coat-art', viewBox: '0 0 200 240', width: 200, height: 240, 'aria-hidden': 'true' }, node);
    // The hat sits above the struct's header and the coat covers its fields,
    // so the struct peeks out like a face until the coat drops.
    const coat = svg('g', { class: 'oop-coat-cloth' }, art);
    svg('path', { class: 'oop-coat-body', d: 'M40 112 Q100 96 160 112 L178 238 H22 Z' }, coat);
    svg('path', { class: 'oop-coat-lapel', d: 'M80 106 L100 160 L120 106' }, coat);
    svg('path', { class: 'oop-coat-belt', d: 'M30 184 H170' }, coat);
    svg('path', { class: 'oop-coat-hat', d: 'M44 34 Q100 -6 156 34 Q176 38 182 44 H18 Q24 38 44 34 Z' }, coat);
    enter(node, at, until);
    tween(coat, [{ translate: '0 0', opacity: 1 }, { translate: '0 300px', opacity: 0 }], dropAt, 0.6, EASE.in);
    return node;
  }

  /** A vtable: a header and slot → implementation rows. */
  function vtable(parent, { x, y, title, rows, at, until }) {
    const node = place(el('div', 'oop-vtable is-staged', parent), x, y);
    el('div', 'oop-vtable-title', node, title);
    const rowNodes = rows.map(([slot, target, note]) => {
      const row = el('div', 'oop-vtable-row', node);
      el('code', 'oop-vtable-slot', row, slot);
      el('span', 'oop-vtable-arrow', row, '→');
      el('code', 'oop-vtable-target', row, target);
      if (note) el('span', 'oop-vtable-note', row, note);
      return row;
    });
    enter(node, at, until);
    return { node, row: (i) => rowNodes[i], light(i, from, to) { during(rowNodes[i], 'is-lit', from, to); } };
  }

  window.OopKit = {
    glyph, objectCard, envelope, code, highlight, ruleCard, nameCard, label, bubble,
    chatNotice, ticket, search, table, flag, flagPair, cellComputer, reach, bench,
    matrix, magnifier, trenchCoat, vtable, during, show, enter, latest,
  };
})();
