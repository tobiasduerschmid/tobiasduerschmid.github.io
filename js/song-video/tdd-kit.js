/*
 * Test-driven development kit for "Red, Green, Refactor": the teaching
 * artwork the dancers perform beside, drawn over the "ballroom" stage theme
 * (ballroom.js). Each piece keeps the real notation beside its picture:
 *
 *   code cards show Python with syntax colours (the chapter's MyStack walk-
 *     through), and a pytest terminal prints the dots, errors, and the red
 *     or green summary bar that a real run prints;
 *   a suite lists named tests with ✓ / ✗ / ~ chips (shape plus colour);
 *   the TDD cycle is three dance-floor tiles, Red ✗ → Green ✓ → Refactor ↻,
 *     that the dancers step onto in every chorus;
 *   MyStack is a glass column of numbered blocks that push and pop;
 *   a bug is a ladybug, as in the lecture slides;
 *   the test pyramid is built from test bricks: many small unit bricks,
 *     fewer integration blocks, and one end-to-end capstone.
 *
 * Builds on SongKit (kit.js) and Timeline (timeline.js); every builder
 * schedules its own motion, and every pose is a pure function of song time.
 * Coordinates are CSS pixels on the 960×540 stage; keep essential content
 * above y = 460, where the player draws captions. Styles:
 * css/song-video-tdd-kit.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, clamp, progress, easeInOutCubic, hash01 } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, place, icon } = kit;

  /** Every builder needs the song time its piece appears at. */
  function requireTime(at, node) {
    if (!Number.isFinite(at)) throw new Error(`tdd-kit.js: "${node.className}" needs a finite \`at\` time.`);
  }

  /** Shows a node from `at` (popping in) until `until` (popping out). */
  function show(node, at, until, { rotate = 0, from = 0.6 } = {}) {
    requireTime(at, node);
    fx.pop(node, at, { from, rotate });
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  /** Rises a node in at `at` and fades it out at `until`. */
  function enter(node, at, until, distance = 16) {
    requireTime(at, node);
    fx.rise(node, at, { distance, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  /** Toggles a class on a node during [from, to). */
  function during(node, className, from, to = Infinity) {
    onFrame((t) => node.classList.toggle(className, t >= from && t < to));
  }

  /** The newest entry of a time-sorted list at or before t (or undefined). */
  function latest(entries, t) {
    let found;
    for (const entry of entries) if (entry.at <= t) found = entry;
    return found;
  }

  // ------------------------------------------------------------------
  // Status glyphs: ✗ fail, ✓ pass, ~ flaky, • pending (shape + colour)
  // ------------------------------------------------------------------

  const GLYPHS = {
    fail: 'M7 7 L17 17 M17 7 L7 17',
    pass: 'M5.5 12.5 L10 17 L18.5 7.5',
    flaky: 'M4 13 Q8 7 12 12 Q16 17 20 11',
    pending: 'M12 12 h0.01',
    refactor: 'M18.5 9 A7 7 0 1 0 19 14 M18.5 4.5 V9 H14',
  };

  function glyph(status, className = 'tdd-glyph') {
    const node = svg('svg', { class: `${className} ${className}--${status}`, viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    svg('path', { d: GLYPHS[status] }, node);
    return node;
  }

  /** A status chip whose glyph and colour follow `states` over time. */
  function statusChip(parent, states, { label = true } = {}) {
    const node = el('span', 'tdd-chip', parent);
    const icons = {};
    for (const status of new Set(states.map((s) => s.status))) {
      icons[status] = glyph(status, 'tdd-chip-glyph');
      node.append(icons[status]);
    }
    const text = label ? el('span', 'tdd-chip-text', node) : null;
    const WORDS = { fail: 'FAILED', pass: 'PASSED', flaky: 'FLAKY', pending: 'not run' };
    onFrame((t) => {
      const state = latest(states, t);
      const status = state ? state.status : 'pending';
      node.dataset.status = status;
      for (const [name, svgNode] of Object.entries(icons)) svgNode.style.display = name === status ? '' : 'none';
      if (text) text.textContent = state?.word || WORDS[status];
    });
    return node;
  }

  // ------------------------------------------------------------------
  // Python code cards with syntax colours
  // ------------------------------------------------------------------

  const KEYWORDS = new Set(['def', 'class', 'return', 'assert', 'import', 'from', 'not', 'pass', 'if', 'else', 'raise', 'with', 'for', 'in', 'yield', 'is', 'and', 'or', 'None', 'True', 'False']);
  const TOKEN = /(#.*$)|('[^']*'|"[^"]*")|(@[\w.]+)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)|(\s+)|(.)/g;

  /** Splits one line of Python into [text, tone] runs. */
  function highlight(source) {
    const runs = [];
    let previous = '';
    for (const match of source.matchAll(TOKEN)) {
      const [text, comment, string, decorator, number, word] = match;
      let tone = null;
      if (comment) tone = 'cm';
      else if (string) tone = 'str';
      else if (decorator) tone = 'deco';
      else if (number) tone = 'num';
      else if (word) {
        if (KEYWORDS.has(word)) tone = 'kw';
        else if (word === 'self') tone = 'self';
        else if (previous === 'def') tone = 'fn';
        else if (previous === 'class' || /^[A-Z]/.test(word)) tone = 'cls';
        else if (source[match.index + word.length] === '(') tone = 'call';
        previous = word;
      }
      runs.push([text, tone]);
    }
    return runs;
  }

  /**
   * code(parent, { x, y, w, title, lines, at, until, size }) — a code card.
   * lines = [string | { text, at, until, tone: 'add'|'del'|'dim'|'focus',
   * strikeAt, swap: [{ at, text }] }]. Lines with `at` rise in on their own;
   * `swap` replaces a line's text at a later time (a rename, a fix).
   * Returns { node, rows, mark(index, at, until, tone) }.
   */
  function code(parent, { x, y, w, title, lines, at, until, size, tone }) {
    const node = place(el('div', `code-card tdd-code${tone ? ` tdd-code--${tone}` : ''} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    if (size) node.style.setProperty('--tdd-code-size', `${size}px`);
    if (title) {
      const bar = el('div', 'code-card-title tdd-code-title', node);
      bar.append(icon('file'));
      bar.append(document.createTextNode(title));
    }
    const body = el('div', 'tdd-code-body', node);
    const rows = lines.map((spec) => {
      const line = typeof spec === 'string' ? { text: spec } : spec;
      const row = el('div', `code-line tdd-code-line${line.at !== undefined ? ' is-staged' : ''}`, body);
      const versions = [{ at: -Infinity, text: line.text }, ...(line.swap || [])].map((version) => {
        const holder = el('span', 'tdd-code-text', row);
        for (const [text, toneName] of highlight(version.text)) el('span', toneName ? `tdd-tok tdd-tok--${toneName}` : null, holder, text);
        return { ...version, holder };
      });
      if (versions.length > 1) {
        onFrame((t) => {
          const current = latest(versions, t);
          for (const version of versions) version.holder.style.display = version === current ? '' : 'none';
        });
      }
      if (line.tone) row.classList.add(`tdd-code-line--${line.tone}`);
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
      mark(index, from, to, markTone = 'focus') {
        during(rows[index], `is-${markTone}`, from, to);
      },
    };
  }

  // ------------------------------------------------------------------
  // A pytest run: the command, the progress dots, errors, and the summary
  // ------------------------------------------------------------------

  /**
   * pytest(parent, { x, y, w, at, until, runs }) — runs = [{ at, file,
   * dots: '..F', errors: [lines], summary }] where summary is the text after
   * the bar (e.g. '1 failed, 2 passed in 0.02s'). The newest run at time t
   * is shown; its dots print one by one. errorsAt / summaryAt (optional)
   * hold the error lines or the summary back until a later word.
   */
  function pytest(parent, { x, y, w, at, until, runs, file = 'tests/test_stack.py' }) {
    const node = place(el('div', 'tdd-term is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const bar = el('div', 'tdd-term-bar', node);
    for (let i = 0; i < 3; i++) el('span', 'tdd-term-dot', bar);
    el('span', 'tdd-term-title', bar, 'Terminal');
    const views = runs.map((run) => {
      const view = el('div', 'tdd-term-run', node);
      el('div', 'tdd-term-cmd', view, '$ pytest');
      const progressLine = el('div', 'tdd-term-progress', view);
      el('span', null, progressLine, `${run.file || file} `);
      const dots = [...(run.dots || '')].map((ch, i) => {
        const dot = el('span', `tdd-term-pdot tdd-term-pdot--${ch === 'F' ? 'fail' : ch === 'E' ? 'error' : 'pass'} is-staged`, progressLine, ch);
        fx.fadeIn(dot, run.at + 0.25 + i * 0.12, 0.05);
        return dot;
      });
      const errorsAt = run.errorsAt ?? run.at + 0.3 + dots.length * 0.12;
      for (const text of run.errors || []) {
        const line = el('div', 'tdd-term-error is-staged', view, text);
        fx.fadeIn(line, errorsAt, 0.1);
      }
      const failed = /failed|error/.test(run.summary);
      const summary = el('div', `tdd-term-summary tdd-term-summary--${failed ? 'fail' : 'pass'} is-staged`, view);
      summary.append(glyph(failed ? 'fail' : 'pass', 'tdd-term-glyph'));
      summary.append(document.createTextNode(run.summary));
      fx.fadeIn(summary, run.summaryAt ?? errorsAt + 0.12, 0.12);
      return { ...run, view };
    });
    onFrame((t) => {
      const current = latest(views, t) || views[0];
      for (const view of views) view.view.style.display = view === current ? '' : 'none';
    });
    enter(node, at, until);
    return { node };
  }

  // ------------------------------------------------------------------
  // A suite: named tests with status chips
  // ------------------------------------------------------------------

  /**
   * suite(parent, { x, y, w, title, tests, at, until }) — tests = [{ name,
   * at, states: [{ at, status: 'pass'|'fail'|'flaky'|'pending', word }] }].
   * Returns { node, rows }.
   */
  function suite(parent, { x, y, w, title, tests, at, until, chipLabels = true }) {
    const node = place(el('div', 'tdd-suite is-staged', parent), x, y);
    node.style.width = `${w}px`;
    if (title) {
      const head = el('div', 'tdd-suite-title', node);
      head.append(icon('list'));
      head.append(document.createTextNode(title));
    }
    const rows = tests.map((test) => {
      const row = el('div', `tdd-suite-row${test.at !== undefined ? ' is-staged' : ''}`, node);
      statusChip(row, test.states || [], { label: chipLabels });
      el('span', 'tdd-suite-name', row, test.name);
      if (test.note) el('span', 'tdd-suite-note', row, test.note);
      if (test.at !== undefined) fx.rise(row, test.at, { distance: 8, duration: 0.3 });
      if (test.until !== undefined) fx.fadeOut(row, test.until, 0.2);
      return row;
    });
    enter(node, at, until);
    return { node, rows };
  }

  // ------------------------------------------------------------------
  // The TDD cycle: three dance-floor tiles and the arrows between them
  // ------------------------------------------------------------------

  const PHASES = {
    red: { label: 'Red', sub: 'write a failing test', glyph: 'fail' },
    green: { label: 'Green', sub: 'make it pass', glyph: 'pass' },
    refactor: { label: 'Refactor', sub: 'clean the structure', glyph: 'refactor' },
  };

  /**
   * cycle(parent, { x, y, scale, at, until, compact }) — Red (top left) →
   * Green (top right) → Refactor (bottom) → Red, as in the lecture's
   * diagram. light(phase, from, to) makes one tile glow.
   */
  function cycle(parent, { x, y, scale = 1, at, until, compact = false }) {
    const node = place(el('div', `tdd-cycle${compact ? ' tdd-cycle--compact' : ''} is-staged`, parent), x, y);
    node.style.setProperty('--tdd-cycle-scale', scale);
    const art = svg('svg', { class: 'tdd-cycle-arrows', viewBox: '0 0 420 250', 'aria-hidden': 'true' }, node);
    const top = compact ? 40 : 62;
    const lower = compact ? 196 : 218;
    const edge = compact ? 74 : 118;
    for (const d of [`M234 ${top} H242`, `M367 ${edge} Q367 ${lower} 360 ${lower}`, `M122 ${lower} Q115 ${lower} 115 ${edge}`]) svg('path', { class: 'tdd-cycle-arrow', d }, art);
    for (const [px, py, rot] of [[248, top, 90], [356, lower, 262], [115, edge - 4, 0]]) {
      svg('path', { class: 'tdd-cycle-head', d: 'M-7 6 L0 -6 L7 6 Z', transform: `translate(${px} ${py}) rotate(${rot})` }, art);
    }
    const tiles = {};
    const positions = { red: [0, 10], green: [252, 10], refactor: [126, 166] };
    for (const [phase, info] of Object.entries(PHASES)) {
      const tile = place(el('div', `tdd-tile tdd-tile--${phase}`, node), ...positions[phase]);
      tile.append(glyph(info.glyph, 'tdd-tile-glyph'));
      const words = el('div', 'tdd-tile-words', tile);
      el('b', null, words, info.label);
      if (!compact) el('span', null, words, info.sub);
      tiles[phase] = tile;
    }
    enter(node, at, until);
    return {
      node,
      light(phase, from, to) {
        during(tiles[phase], 'is-lit', from, to);
        tween(tiles[phase], [{ scale: 1 }, { scale: 1.08 }, { scale: 1 }], from, 0.4, EASE.out);
      },
    };
  }

  // ------------------------------------------------------------------
  // MyStack: a glass column of numbered blocks
  // ------------------------------------------------------------------

  /**
   * stack(parent, { x, y, at, until, label, slots }) — a glass column for
   * `slots` blocks. push(at, value) drops a block onto the top; pop(at,
   * { to: [dx, dy], ghost }) lifts the top block out to the side (ghost
   * leaves a red copy behind: the pop that never removes). Returns the API.
   */
  function stack(parent, { x, y, at, until, label = 'MyStack', slots = 4, caption }) {
    const BLOCK = 46;
    const node = place(el('div', 'tdd-stack is-staged', parent), x, y);
    node.style.height = `${slots * BLOCK + 18}px`;
    const glass = el('div', 'tdd-stack-glass', node);
    el('div', 'tdd-stack-label', node, label);
    if (caption) el('div', 'tdd-stack-caption', node, caption);
    const levels = [];
    enter(node, at, until);
    const api = {
      node,
      push(atTime, value, { level = levels.length, tone } = {}) {
        const block = el('div', `tdd-block${tone ? ` tdd-block--${tone}` : ''} is-staged`, glass, String(value));
        const top = (slots - 1 - level) * BLOCK + 6;
        block.style.top = `${top}px`;
        levels[level] = block;
        tween(block, [{ opacity: 0, translate: `0 ${-top - 60}px` }, { opacity: 1, translate: '0 0' }], atTime, 0.42, EASE.out);
        return block;
      },
      pop(atTime, { level = levels.length - 1, to = [150, -40], ghost = false } = {}) {
        const block = levels[level];
        if (ghost) {
          const copy = el('div', 'tdd-block tdd-block--ghost is-staged', glass, block.textContent);
          copy.style.top = block.style.top;
          fx.fadeIn(copy, atTime + 0.15, 0.3);
        }
        tween(block, { translate: `${to[0]}px ${to[1]}px` }, atTime, 0.55, EASE.inOut);
        levels.length = level;
        return block;
      },
      /** Empties the column instantly at `atTime` (a fresh fixture). */
      clear(atTime) {
        for (const block of levels) if (block) fx.fadeOut(block, atTime, 0.15);
        levels.length = 0;
      },
    };
    return api;
  }

  // ------------------------------------------------------------------
  // A ladybug: the slides' picture of a bug
  // ------------------------------------------------------------------

  /** bug(parent, { x, y, size, at, until, rotate, from, crawl }) */
  function bug(parent, { x, y, size = 44, at, until, rotate = 0, from, squashAt }) {
    const node = place(el('div', 'tdd-bug is-staged', parent), x, y);
    const art = svg('svg', { viewBox: '-32 -32 64 64', width: size, height: size, 'aria-hidden': 'true' }, node);
    // Dark legs, antennae, and head ride on a light outline, so the bug
    // reads on the dark stage and on light cards alike (WCAG 1.4.11).
    const legs = svg('g', { class: 'tdd-bug-legs' }, art);
    const LEGS = [];
    for (const side of [-1, 1]) {
      for (const k of [-1, 0, 1]) LEGS.push(`M${side * 10} ${k * 9} Q${side * 20} ${k * 9 - 4} ${side * 24} ${k * 12}`);
    }
    for (const d of LEGS) svg('path', { class: 'tdd-bug-halo', d }, legs);
    for (const d of LEGS) svg('path', { d }, legs);
    const ANTENNAE = 'M-5 -20 Q-10 -28 -14 -27 M5 -20 Q10 -28 14 -27';
    svg('path', { class: 'tdd-bug-halo', d: ANTENNAE }, art);
    svg('circle', { class: 'tdd-bug-halo', cx: 0, cy: -16, r: 8 }, art);
    svg('ellipse', { class: 'tdd-bug-halo', cx: 0, cy: 4, rx: 17, ry: 19 }, art);
    svg('path', { class: 'tdd-bug-antenna', d: ANTENNAE }, art);
    svg('circle', { class: 'tdd-bug-head', cx: 0, cy: -16, r: 8 }, art);
    svg('ellipse', { class: 'tdd-bug-shell', cx: 0, cy: 4, rx: 17, ry: 19 }, art);
    svg('line', { class: 'tdd-bug-seam', x1: 0, y1: -14, x2: 0, y2: 23 }, art);
    for (const [cx, cy, r] of [[-8, -2, 3.6], [8, -2, 3.6], [-9, 11, 3], [9, 11, 3], [0, 18, 2.4]]) svg('circle', { class: 'tdd-bug-spot', cx, cy, r }, art);
    svg('path', { class: 'tdd-bug-shine', d: 'M-11 -6 Q-9 -12 -3 -13' }, art);
    node.style.rotate = `${rotate}deg`;
    if (from) {
      tween(node, [{ opacity: 0, translate: `${from[0] - x}px ${from[1] - y}px` }, { opacity: 1, translate: '0 0' }], at, 0.9, EASE.inOut);
    } else {
      fx.pop(node, at, { from: 0.3 });
    }
    onFrame((t) => {
      const local = t - at;
      legs.setAttribute('transform', `rotate(${(5 * Math.sin(local * 18)).toFixed(2)})`);
    });
    if (squashAt !== undefined) {
      tween(node, { scale: '1.3 0.2', opacity: 0 }, squashAt, 0.25, EASE.in);
    }
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  // ------------------------------------------------------------------
  // Speech bubbles and notes
  // ------------------------------------------------------------------

  /** bubble(parent, { x, y, w, text, who, at, until, side, tone }) */
  function bubble(parent, { x, y, w, text, who, at, until, side = 'left', tone = 'white', size }) {
    const node = place(el('div', `tdd-bubble tdd-bubble--${side} tdd-bubble--${tone} is-staged`, parent), x, y);
    if (w) node.style.width = `${w}px`;
    if (size) node.style.fontSize = `${size}px`;
    if (who) el('div', 'tdd-bubble-who', node, who);
    el('div', 'tdd-bubble-text', node, text);
    return show(node, at, until, { from: 0.5 });
  }

  /** A short label on dark glass: tone = white | gold | red | green | violet | cyan. */
  function note(parent, text, { x, y, at, until, tone = 'white', rotate = -2, iconName, size }) {
    const node = place(el('div', `tdd-note tdd-note--${tone} is-staged`, parent), x, y);
    if (iconName) node.append(icon(iconName));
    node.append(document.createTextNode(text));
    if (size) node.style.fontSize = `${size}px`;
    return show(node, at, until, { rotate });
  }

  /** A big heading with optional highlighted parts: parts = [text, { text, tone }, …]. */
  function heading(parent, parts, { x = 0, y, at, until, size = 30, center = true }) {
    const node = place(el('div', `tdd-heading${center ? ' tdd-heading--center' : ''} is-staged`, parent), x, y);
    node.style.fontSize = `${size}px`;
    for (const part of parts) {
      if (typeof part === 'string') node.append(document.createTextNode(part));
      else el('span', `tdd-heading-mark tdd-heading-mark--${part.tone || 'gold'}`, node, part.text);
    }
    return enter(node, at, until, 12);
  }

  // ------------------------------------------------------------------
  // Panels: a titled glass card for lists and diagrams
  // ------------------------------------------------------------------

  /** panel(parent, { x, y, w, h, title, iconName, tone, at, until }) → { node, body } */
  function panel(parent, { x, y, w, h, title, iconName, tone = 'plain', at, until }) {
    const node = place(el('div', `tdd-panel tdd-panel--${tone} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    if (h) node.style.height = `${h}px`;
    if (title) {
      const head = el('div', 'tdd-panel-title', node);
      if (iconName) head.append(icon(iconName));
      head.append(document.createTextNode(title));
    }
    const body = el('div', 'tdd-panel-body', node);
    enter(node, at, until);
    return { node, body };
  }

  /**
   * todo(parent, { x, y, w, title, items, at, until }) — a notepad list:
   * items = [{ text, at, doneAt, tone }] are written in at `at`.
   */
  function todo(parent, { x, y, w, title = 'Test list', items, at, until }) {
    const node = place(el('div', 'tdd-todo is-staged', parent), x, y);
    node.style.width = `${w}px`;
    el('div', 'tdd-todo-title', node, title);
    const rows = items.map((item) => {
      const row = el('div', `tdd-todo-row${item.tone ? ` tdd-todo-row--${item.tone}` : ''}`, node);
      const box = el('span', 'tdd-todo-box', row);
      box.append(glyph('pass', 'tdd-todo-check'));
      const text = el('span', 'tdd-todo-text', row);
      kit.typewriter(text, item.text, item.at, 28);
      if (item.doneAt !== undefined) during(row, 'is-done', item.doneAt);
      if (item.focusAt !== undefined) during(row, 'is-focus', item.focusAt, item.focusUntil);
      return row;
    });
    show(node, at, until, { rotate: -1.5, from: 0.8 });
    return { node, rows };
  }

  // ------------------------------------------------------------------
  // Footsteps: small steps with feedback versus one giant hop
  // ------------------------------------------------------------------

  /**
   * steps(parent, { x, y, w, count, at, step, flags, until }) — footprints
   * that land one by one along a track; each gets a ✓ flag (feedback) when
   * flags is true. failAt marks the last print red: only one step to trace.
   */
  function steps(parent, { x, y, w, count = 6, at, step = 0.25, flags = true, failAt, until }) {
    const node = place(el('div', 'tdd-steps is-staged', parent), x, y);
    node.style.width = `${w}px`;
    el('div', 'tdd-steps-track', node);
    const gap = w / count;
    const prints = Array.from({ length: count }, (_, i) => {
      const print = place(el('div', `tdd-print${i % 2 ? ' tdd-print--alt' : ''} is-staged`, node), 10 + i * gap, i % 2 ? 6 : 26);
      print.append(footprint());
      fx.pop(print, at + i * step, { from: 0.4 });
      if (flags) {
        const flag = place(el('div', 'tdd-print-flag is-staged', node), 10 + i * gap + 6, -34);
        flag.append(glyph('pass', 'tdd-flag-glyph'));
        fx.pop(flag, at + i * step + 0.12, { from: 0.4 });
        if (failAt !== undefined && i === count - 1) {
          flag.classList.add('tdd-print-flag--fail');
          const fail = glyph('fail', 'tdd-flag-glyph tdd-flag-glyph--fail');
          flag.append(fail);
          during(flag, 'is-failed', failAt);
        }
      }
      return print;
    });
    if (failAt !== undefined) during(prints[count - 1], 'is-failed', failAt);
    fx.fadeIn(node, at - 0.1, 0.2);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return { node, prints };
  }

  function footprint() {
    const art = svg('svg', { viewBox: '0 0 24 34', width: 22, height: 32, 'aria-hidden': 'true' });
    svg('ellipse', { cx: 12, cy: 21, rx: 8, ry: 11 }, art);
    for (const [cx, cy, r] of [[5, 6, 2.6], [10, 3.5, 2.4], [15, 3.8, 2.2], [19.5, 6.5, 2]]) svg('circle', { cx, cy, r }, art);
    return art;
  }

  /** A dashed arc for one giant hop, with a big landing print. */
  function hop(parent, { x, y, w, h = 120, at, until }) {
    const node = place(el('div', 'tdd-hop is-staged', parent), x, y);
    const art = svg('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, node);
    const path = svg('path', { class: 'tdd-hop-arc', d: `M10 ${h - 10} Q${w / 2} ${-h * 0.6} ${w - 20} ${h - 10}` }, art);
    fx.draw(path, at, 0.6);
    const land = place(el('div', 'tdd-print tdd-print--big is-staged', node), w - 36, h - 30);
    land.append(footprint());
    fx.pop(land, at + 0.55, { from: 0.4 });
    fx.fadeIn(node, at - 0.05, 0.1);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  /** A red octagon STOP sign on a post. */
  function stopSign(parent, { x, y, at, until, size = 96 }) {
    const node = place(el('div', 'tdd-stop is-staged', parent), x, y);
    const art = svg('svg', { viewBox: '0 0 100 150', width: size, height: size * 1.5, 'aria-hidden': 'true' }, node);
    svg('rect', { class: 'tdd-stop-post', x: 46, y: 90, width: 8, height: 60, rx: 2 }, art);
    const points = Array.from({ length: 8 }, (_, i) => {
      const a = (Math.PI / 8) + (i * Math.PI) / 4;
      return `${(50 + 46 * Math.cos(a)).toFixed(1)},${(50 + 46 * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    svg('polygon', { class: 'tdd-stop-face', points }, art);
    const text = svg('text', { class: 'tdd-stop-text', x: 50, y: 59, 'text-anchor': 'middle' }, art);
    text.textContent = 'STOP';
    return show(node, at, until, { rotate: -6, from: 0.3 });
  }

  // ------------------------------------------------------------------
  // The black box: outward behavior stays the same while inside changes
  // ------------------------------------------------------------------

  /**
   * blackBox(parent, { x, y, w, at, until, calls }) — calls = [{ input,
   * output }] travel in from the left and out to the right; the box's
   * inside shows messy gears until `tidyAt`, then neat ones. The outputs
   * never change. Returns { node }.
   */
  function blackBox(parent, { x, y, w = 420, at, until, calls, tidyAt, label = 'MyStack' }) {
    const node = place(el('div', 'tdd-box is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const inputs = el('div', 'tdd-box-io tdd-box-io--in', node);
    const box = el('div', 'tdd-box-core', node);
    el('div', 'tdd-box-label', box, label);
    const inside = svg('svg', { class: 'tdd-box-inside', viewBox: '0 0 120 70', 'aria-hidden': 'true' }, box);
    const messy = svg('g', { class: 'tdd-box-messy' }, inside);
    for (let i = 0; i < 9; i++) {
      const x1 = 10 + hash01(i * 7 + 1) * 100;
      const y1 = 8 + hash01(i * 11 + 3) * 54;
      const x2 = 10 + hash01(i * 13 + 5) * 100;
      const y2 = 8 + hash01(i * 17 + 9) * 54;
      svg('path', { d: `M${x1.toFixed(1)} ${y1.toFixed(1)} Q60 35 ${x2.toFixed(1)} ${y2.toFixed(1)}` }, messy);
    }
    const neat = svg('g', { class: 'tdd-box-neat' }, inside);
    for (let i = 0; i < 4; i++) svg('rect', { x: 14 + (i % 2) * 8, y: 10 + i * 13, width: 70 - (i % 2) * 18, height: 7, rx: 3.5 }, neat);
    const outputs = el('div', 'tdd-box-io tdd-box-io--out', node);
    for (const call of calls) {
      el('div', 'tdd-box-call', inputs, call.input);
      const out = el('div', 'tdd-box-call tdd-box-call--out', outputs);
      out.append(document.createTextNode(call.output));
      out.append(glyph('pass', 'tdd-box-glyph'));
    }
    if (tidyAt !== undefined) {
      during(node, 'is-tidy', tidyAt);
      tween(box, [{ scale: 1 }, { scale: 1.05 }, { scale: 1 }], tidyAt, 0.4, EASE.out);
    }
    enter(node, at, until);
    return { node };
  }

  // ------------------------------------------------------------------
  // The test pyramid
  // ------------------------------------------------------------------

  let pyramidId = 0;
  const f2 = (n) => n.toFixed(2);

  /** The glyph inside a brick: ✓ (unit), a link (integration), a window (end to end). */
  function brickGlyph(parent, kind, cx, cy, size) {
    const g = svg('g', { class: `tdd-brick-glyph tdd-brick-glyph--${kind}`, transform: `translate(${f2(cx - size / 2)} ${f2(cy - size / 2)}) scale(${f2(size / 24)})` }, parent);
    if (kind === 'unit') svg('path', { d: 'M5.5 12.5 L10 17 L18.5 7.5' }, g);
    else if (kind === 'link') svg('path', { d: 'M9 15 L15 9 M7.5 11.5 L5.5 13.5 A3.5 3.5 0 0 0 10.5 18.5 L12.5 16.5 M11.5 7.5 L13.5 5.5 A3.5 3.5 0 0 1 18.5 10.5 L16.5 12.5' }, g);
    else svg('path', { d: 'M4 6 H20 V18 H4 Z M4 9.5 H20 M7 13 H12 M7 15.5 H15' }, g);
    return g;
  }

  /**
   * pyramid(parent, { x, y, at, until, tiers }) — the test pyramid, built
   * from test bricks over a dashed outline of the whole shape. tiers
   * bottom-up: [{ label, scope, at, kind: 'unit'|'link'|'window', courses,
   * brick }]: each tier is laid in `courses` staggered rows of bricks
   * `brick` px wide, so the base holds many small tests and the top one
   * large capstone. A vertical axis beside the labels reads "faster ·
   * more" at the base and "slower · fewer" at the top. light(index, from,
   * to) outlines one tier (with one light sweep) while the others are
   * shaded; anchor(index) is a stage point on that tier's outer edge, for
   * connectors.
   */
  function pyramid(parent, { x, y, at, until, tiers, axis = ['slower · fewer', 'faster · more'] }) {
    const id = `tdd-pyr-${++pyramidId}`;
    const LABEL_W = 148;
    const BASE_W = 276;
    const DEPTH = [38, -18];
    const H = 344;
    const W = LABEL_W + 10 + BASE_W + DEPTH[0] + 4;
    const x0 = LABEL_W + 10;
    const apex = [x0 + BASE_W / 2, 6];
    const by = H - 12;
    const corners = { left: [x0, by], right: [x0 + BASE_W, by], back: [x0 + BASE_W + DEPTH[0], by + DEPTH[1]] };
    /** The point a fraction f of the way from the apex to a base corner. */
    const at01 = (corner, f) => [apex[0] + f * (corner[0] - apex[0]), apex[1] + f * (corner[1] - apex[1])];
    const pts = (list) => list.map((p) => p.map(f2).join(',')).join(' ');

    const node = place(el('div', 'tdd-pyr is-staged', parent), x, y);
    node.style.width = `${W}px`;
    node.style.height = `${H}px`;
    const art = svg('svg', { class: 'tdd-pyr-art', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, node);
    const defs = svg('defs', {}, art);
    svg('ellipse', { class: 'tdd-pyr-shadow', cx: apex[0] + DEPTH[0] / 2, cy: by + 4, rx: BASE_W * 0.62, ry: 11 }, art);
    svg('polygon', { class: 'tdd-pyr-ghost', points: pts([apex, corners.left, corners.right]) }, art);
    svg('polygon', { class: 'tdd-pyr-ghost tdd-pyr-ghost--side', points: pts([apex, corners.right, corners.back]) }, art);

    // The cost axis: one double-headed arrow instead of a speed label per tier.
    const axisX = 8;
    const axisTop = 30;
    const axisBottom = by - 26;
    const axisGrad = svg('linearGradient', { id: `${id}-axis`, class: 'tdd-pyr-axis-grad', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg('stop', { class: 'tdd-stop--top', offset: 0 }, axisGrad);
    svg('stop', { class: 'tdd-stop--bottom', offset: 1 }, axisGrad);
    const axisArt = svg('g', { class: 'tdd-pyr-axis' }, art);
    svg('rect', { class: 'tdd-pyr-axis-shaft', x: axisX - 2, y: axisTop + 8, width: 4, height: axisBottom - axisTop - 16, rx: 2, fill: `url(#${id}-axis)` }, axisArt);
    svg('path', { class: 'tdd-pyr-axis-head tdd-pyr-axis-head--top', d: `M${axisX - 7} ${axisTop + 10} L${axisX} ${axisTop} L${axisX + 7} ${axisTop + 10} Z` }, axisArt);
    svg('path', { class: 'tdd-pyr-axis-head tdd-pyr-axis-head--bottom', d: `M${axisX - 7} ${axisBottom - 10} L${axisX} ${axisBottom} L${axisX + 7} ${axisBottom - 10} Z` }, axisArt);
    const axisLabels = axis.map((text, i) => {
      const label = place(el('div', `tdd-pyr-axis-label tdd-pyr-axis-label--${i ? 'bottom' : 'top'} is-staged`, node, text), 0, i ? axisBottom + 4 : axisTop - 26);
      return label;
    });

    const n = tiers.length;
    const GAP = 0.024;
    const sweeps = [];
    const tierNodes = tiers.map((tier, i) => {
      const f0 = 1 - (i + 1) / n + (i === n - 1 ? 0 : GAP / 2);
      const f1 = 1 - i / n - (i === 0 ? 0 : GAP / 2);
      const fm = (f0 + f1) / 2;
      const front = [at01(corners.left, f0), at01(corners.right, f0), at01(corners.right, f1), at01(corners.left, f1)];
      const side = [at01(corners.right, f0), at01(corners.back, f0), at01(corners.back, f1), at01(corners.right, f1)];
      for (const face of ['side', 'brick']) {
        const grad = svg('linearGradient', { id: `${id}-${face}-${i}`, class: `tdd-pyr-grad tdd-pyr-grad--${face}-${i}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
        svg('stop', { class: 'tdd-stop--top', offset: 0 }, grad);
        svg('stop', { class: 'tdd-stop--bottom', offset: 1 }, grad);
      }
      const clip = svg('clipPath', { id: `${id}-clip-${i}` }, defs);
      svg('polygon', { points: pts(front) }, clip);

      // Outer group: the entrance. Inner group: focus (CSS).
      const entry = svg('g', { class: 'tdd-tier-entry' }, art);
      const group = svg('g', { class: `tdd-tier tdd-tier--${i}` }, entry);
      svg('polygon', { class: 'tdd-tier-side', points: pts(side), fill: `url(#${id}-side-${i})` }, group);
      svg('polygon', { class: 'tdd-tier-mortar', points: pts(front) }, group);
      const inside = svg('g', { 'clip-path': `url(#${id}-clip-${i})` }, group);

      // Bricks: staggered courses across the face; partial bricks at the
      // sloping edges are cut by the face, like dressed stone.
      const kind = tier.kind || 'unit';
      const courses = tier.courses || 1;
      const MORTAR = 2.4;
      let k = 0;
      const bricks = [];
      for (let c = 0; c < courses; c++) {
        const fa = f0 + ((f1 - f0) * c) / courses;
        const fb = f0 + ((f1 - f0) * (c + 1)) / courses;
        const top = at01(corners.left, fa)[1];
        const bottom = at01(corners.left, fb)[1];
        const half = (fb * BASE_W) / 2;
        if (f0 < 0.01 && courses === 1) {
          // The capstone: one block, inset from the face by the mortar.
          const cx = apex[0];
          const cy = (2 * apex[1] + 2 * bottom) / 4 + (bottom - apex[1]) / 6;
          const shrink = (p) => [cx + (p[0] - cx) * 0.9, cy + (p[1] - cy) * 0.9];
          const cap = svg('g', { class: 'tdd-brick' }, inside);
          svg('polygon', { class: 'tdd-brick-face', points: pts([shrink(apex), shrink(at01(corners.right, fb)), shrink(at01(corners.left, fb))]), fill: `url(#${id}-brick-${i})` }, cap);
          brickGlyph(cap, kind, cx, cy + 6, 26);
          bricks.push(cap);
          continue;
        }
        // A running bond: every other course shifts by half a brick, on a
        // grid anchored at the apex so the bond holds whatever the width.
        const bw = tier.brick || 24;
        const reach = Math.ceil(half / bw) + 1;
        for (let j = -reach; j <= reach; j++) {
          const bx = apex[0] + (j + (c % 2) * 0.5) * bw - bw / 2;
          if (bx + bw < apex[0] - half || bx > apex[0] + half) continue;
          const brick = svg('g', { class: 'tdd-brick' }, inside);
          svg('rect', { class: 'tdd-brick-face', x: f2(bx + MORTAR / 2), y: f2(top + MORTAR / 2), width: f2(bw - MORTAR), height: f2(bottom - top - MORTAR), rx: 2.5, fill: `url(#${id}-brick-${i})` }, brick);
          svg('line', { class: 'tdd-brick-shine', x1: f2(bx + MORTAR + 2), y1: f2(top + MORTAR + 1), x2: f2(bx + bw - MORTAR - 2), y2: f2(top + MORTAR + 1) }, brick);
          const cxB = bx + bw / 2;
          const inFace = Math.abs(cxB - apex[0]) < half - bw * 0.3;
          if (inFace) brickGlyph(brick, kind, cxB, (top + bottom) / 2, Math.min(bw, bottom - top) * 0.62);
          bricks.push(brick);
        }
      }
      // Bricks are laid one by one, bottom course first, left to right.
      bricks.forEach((brick) => {
        brick.style.opacity = '0';
        tween(brick, [{ opacity: 0, translate: '0 -22px' }, { opacity: 1, translate: '0 0' }], tier.at + 0.15 + k * (tier.lay ?? 0.018), 0.32, EASE.out);
        k += 1;
      });

      const band = svg('polygon', { class: 'tdd-tier-shine', points: `0,${front[0][1] - 4} 26,${front[0][1] - 4} 6,${front[3][1] + 4} -20,${front[3][1] + 4}`, opacity: 0 }, inside);
      // A shade (not transparency) steps a tier back while another is sung.
      svg('polygon', { class: 'tdd-tier-dim', points: pts(front) }, group);
      svg('polygon', { class: 'tdd-tier-dim', points: pts(side) }, group);
      svg('polygon', { class: 'tdd-tier-outline', points: pts(front) }, group);

      // The label column: name and scope, with a leader to the tier.
      const [edgeX, midY] = at01(corners.left, fm);
      svg('line', { class: `tdd-tier-leader tdd-tier-leader--${i}`, x1: LABEL_W + 2, y1: midY, x2: edgeX - 6, y2: midY }, group);
      svg('circle', { class: `tdd-tier-leader-dot tdd-tier-leader--${i}`, cx: edgeX - 6, cy: midY, r: 3 }, group);
      const labelEntry = place(el('div', 'tdd-tier-tag is-staged', node), 24, midY - 34);
      labelEntry.style.width = `${LABEL_W - 24}px`;
      const label = el('div', `tdd-tier-name tdd-tier-name--${i}`, labelEntry);
      el('b', null, label, tier.label);
      if (tier.scope) el('span', null, label, tier.scope);

      tween(entry, [{ opacity: 0 }, { opacity: 1 }], tier.at, 0.3, EASE.out);
      entry.style.opacity = '0';
      fx.fadeIn(labelEntry, tier.at + 0.2, 0.35);
      sweeps.push({ band, from: front[3][0] - 30, to: front[2][0] + 30, starts: [] });
      return { group, label, f0, f1, fm };
    });

    // The axis appears once the pyramid has its base and top labels to explain.
    fx.fadeIn(axisArt, tiers[0].at + 0.6, 0.4);
    fx.fadeIn(axisLabels[1], tiers[0].at + 0.8, 0.4);
    fx.fadeIn(axisLabels[0], tiers[n - 1].at + 0.6, 0.4);

    // One sweep of light across a tier each time it is lit.
    onFrame((t) => {
      for (const sweep of sweeps) {
        const start = sweep.starts.find((s) => t >= s && t < s + 0.9);
        if (start === undefined) {
          sweep.band.setAttribute('opacity', '0');
          continue;
        }
        const p = easeInOutCubic((t - start) / 0.9);
        sweep.band.setAttribute('opacity', '1');
        sweep.band.setAttribute('transform', `translate(${f2(sweep.from + p * (sweep.to - sweep.from))} 0)`);
      }
    });
    const focus = [];
    onFrame((t) => {
      const lit = focus.find((w) => t >= w.from && t < w.to);
      if (lit) node.dataset.focus = String(lit.index);
      else delete node.dataset.focus;
    });

    fx.fadeIn(node, at, 0.4);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return {
      node,
      light(index, from, to) {
        during(tierNodes[index].group, 'is-lit', from, to);
        during(tierNodes[index].label, 'is-lit', from, to);
        focus.push({ index, from, to });
        sweeps[index].starts.push(from + 0.45);
      },
      /** A stage point on the outer (side-face) edge of a tier, at its middle. */
      anchor(index) {
        const [ax, ay] = at01(corners.back, tierNodes[index].fm);
        return [x + ax + 4, y + ay];
      },
    };
  }

  // ------------------------------------------------------------------
  // Boundaries: a number line with test pins and a hiding bug
  // ------------------------------------------------------------------

  /**
   * numberLine(parent, { x, y, w, from, to, valid: [lo, hi], at, until,
   * pins: [{ value, at, verdict }] }) — the valid range is shaded; pins
   * drop at their values with ✓ (accepted) or ✗ (rejected) flags.
   */
  function numberLine(parent, { x, y, w, from, to, valid, at, until, pins, label }) {
    const node = place(el('div', 'tdd-line is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const scaleX = (value) => ((value - from) / (to - from)) * w;
    const axis = el('div', 'tdd-line-axis', node);
    const band = place(el('div', 'tdd-line-valid', axis), scaleX(valid[0]), -8);
    band.style.width = `${scaleX(valid[1]) - scaleX(valid[0])}px`;
    if (label) el('div', 'tdd-line-label', band, label);
    for (let v = from; v <= to; v++) {
      const tick = place(el('div', `tdd-line-tick${v === valid[0] || v === valid[1] ? ' tdd-line-tick--bound' : ''}`, axis), scaleX(v), 0);
      el('span', null, tick, String(v));
    }
    const pinNodes = pins.map((pin) => {
      const node2 = place(el('div', `tdd-pin tdd-pin--${pin.verdict} is-staged`, node), scaleX(pin.value), -64);
      node2.append(glyph(pin.verdict === 'accept' ? 'pass' : 'fail', 'tdd-pin-glyph'));
      el('span', 'tdd-pin-stem', node2);
      tween(node2, [{ opacity: 0, translate: '0 -30px' }, { opacity: 1, translate: '0 0' }], pin.at, 0.35, EASE.back);
      return node2;
    });
    enter(node, at, until);
    return { node, pins: pinNodes, xOf: scaleX };
  }

  // ------------------------------------------------------------------
  // Small props: a CI badge, a stopwatch, a test-run timeline
  // ------------------------------------------------------------------

  function ciBadge(parent, { x, y, at, until, states }) {
    const node = place(el('div', 'tdd-ci is-staged', parent), x, y);
    const left = el('span', 'tdd-ci-left', node);
    left.append(icon('check'));
    left.append(document.createTextNode('tests'));
    const right = el('span', 'tdd-ci-right', node);
    onFrame((t) => {
      const state = latest(states, t) || states[0];
      right.textContent = state.status === 'pass' ? 'passing' : 'failing';
      node.dataset.status = state.status;
    });
    return show(node, at, until, { from: 0.7 });
  }

  function stopwatch(parent, { x, y, at, until, seconds = '0.02 s', spinFrom }) {
    const node = place(el('div', 'tdd-watch is-staged', parent), x, y);
    const art = svg('svg', { viewBox: '0 0 80 90', width: 80, height: 90, 'aria-hidden': 'true' }, node);
    svg('rect', { class: 'tdd-watch-crown', x: 34, y: 2, width: 12, height: 10, rx: 3 }, art);
    svg('circle', { class: 'tdd-watch-face', cx: 40, cy: 50, r: 34 }, art);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      svg('line', { class: 'tdd-watch-tick', x1: 40 + 27 * Math.sin(a), y1: 50 - 27 * Math.cos(a), x2: 40 + 31 * Math.sin(a), y2: 50 - 31 * Math.cos(a) }, art);
    }
    const hand = svg('line', { class: 'tdd-watch-hand', x1: 40, y1: 50, x2: 40, y2: 24 }, art);
    el('div', 'tdd-watch-label', node, seconds);
    onFrame((t) => {
      const turn = spinFrom === undefined ? 0 : Math.max(0, t - spinFrom) * 720;
      hand.setAttribute('transform', `rotate(${(turn % 360).toFixed(1)} 40 50)`);
    });
    return show(node, at, until);
  }

  /**
   * runs(parent, { x, y, w, at, until, ticks: [{ x, at, status, label }],
   * label, end }) — a horizontal timeline; each test run lands as a ✓, ✗,
   * or ~ tick at its fraction x of the width, with an optional caption.
   */
  function runs(parent, { x, y, w, at, until, ticks, label, end }) {
    const node = place(el('div', 'tdd-runs is-staged', parent), x, y);
    node.style.width = `${w}px`;
    if (label) el('div', 'tdd-runs-label', node, label);
    const lane = el('div', 'tdd-runs-lane', node);
    ticks.forEach((tick) => {
      const mark = place(el('div', `tdd-runs-tick tdd-runs-tick--${tick.status} is-staged`, lane), tick.x * w, 0);
      mark.append(glyph(tick.status, 'tdd-runs-glyph'));
      if (tick.label) el('span', 'tdd-runs-tick-label', mark, tick.label);
      fx.pop(mark, tick.at, { from: 0.3 });
    });
    if (end) place(el('div', 'tdd-runs-end', lane, end), w - 4, -2);
    enter(node, at, until);
    return { node };
  }

  window.TddKit = {
    show, enter, during, latest, glyph, statusChip, highlight,
    code, pytest, suite, cycle, stack, bug, bubble, note, heading, panel, todo,
    steps, hop, stopSign, blackBox, pyramid, numberLine, ciBadge, stopwatch, runs,
  };
})();
