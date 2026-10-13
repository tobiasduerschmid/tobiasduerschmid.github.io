/*
 * Information-hiding kit for "Every Module Keeps a Secret": a spy-thriller
 * visual language whose metaphors carry the concept, drawn over the "spy"
 * stage theme (spy-noir.js). Each piece keeps the real notation beside its
 * picture:
 *
 *   a module is a manila case file with a typed name label; the design
 *     decision it hides is a sealed TOP SECRET envelope, so a decision
 *     copied into many modules is the same envelope in every file;
 *   an interface is a public credential badge (what callers may see), and
 *     a module split into what and how is a vault: brass nameplate outside,
 *     the secret visible only through an X-ray window;
 *   dependencies are red string on a detective's corkboard, which knots into
 *     a Big Ball of Mud when every module depends on every other;
 *   calls are courier routes with sealed envelopes travelling along them;
 *   "from the others" is a laser wall between modules;
 *   Parnas's sentence arrives as a decrypted transmission;
 *   searching code is a green-phosphor intercept console;
 *   the iceberg's hidden bulk is found by a sonar submarine, and a wall
 *     outlet hides which power plant runs behind the wall.
 *
 * Builds on SongKit (kit.js) and Timeline (timeline.js); every builder
 * schedules its own motion, and every pose is a pure function of song time.
 * Coordinates are CSS pixels on the 960×540 stage. Styles:
 * css/song-video-ih-kit.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, progress, easeInOutCubic, hash01 } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, place, icon } = kit;
  let uid = 0;

  /** The newest entry of a time-sorted list at or before t (or undefined). */
  function latest(entries, t) {
    let found;
    for (const entry of entries) if (entry.at <= t) found = entry;
    return found;
  }

  /** Shows a node from `at` (popping in) until `until` (popping out). */
  function show(node, at, until, { rotate = 0, from = 0.6 } = {}) {
    fx.pop(node, at, { from, rotate });
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  /** Toggles a class on a node during [from, to). */
  function during(node, className, from, to = Infinity) {
    onFrame((t) => node.classList.toggle(className, t >= from && t < to));
  }

  /** A short ink note: { tone: white | gold | pink | cyan | green | red }. */
  function note(parent, text, { x, y, at, until, tone = 'white', rotate = -2 }) {
    const node = place(el('div', `ih-note${tone === 'white' ? '' : ` ih-note--${tone}`} is-staged`, parent, text), x, y);
    return show(node, at, until, { rotate });
  }

  /** A heading with an optional <b> highlight: parts = [text, bold, text…]. */
  function heading(parent, parts, { x, y, at, until, size }) {
    const node = place(el('div', 'ih-heading is-staged', parent), x, y);
    if (size) node.style.fontSize = `${size}px`;
    parts.forEach((part, i) => {
      if (i % 2) el('b', null, node, part);
      else node.append(document.createTextNode(part));
    });
    fx.rise(node, at, { distance: 14, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  // ------------------------------------------------------------------
  // Paper: cards, briefing lists, speech bubbles
  // ------------------------------------------------------------------

  function paper(parent, { x, y, w, kicker, title, meta, cite, clip = false, lines = [], at, until, rotate = -1.5 }) {
    const node = place(el('div', 'ih-paper is-staged', parent), x, y);
    node.style.width = `${w}px`;
    if (clip) {
      const art = svg('svg', { class: 'ih-clip ih-clip--paper', viewBox: '0 0 16 40', 'aria-hidden': 'true' }, node);
      svg('path', { d: 'M5 38V8a3 3 0 0 1 6 0v26a5 5 0 0 1-10 0V6a7 7 0 0 1 14 0v22' }, art);
    }
    if (kicker) el('div', 'ih-paper-kicker', node, kicker);
    if (title) el('div', 'ih-paper-title', node, title);
    if (meta) el('div', 'ih-paper-meta', node, meta);
    if (cite) el('div', 'ih-paper-cite', node, cite);
    const rows = lines.map((line) => {
      const row = el('div', `ih-paper-line${line.total ? ' ih-paper-line--total' : ''}${line.at !== undefined ? ' is-staged' : ''}`, node, line.text);
      if (line.at !== undefined) fx.rise(row, line.at, { distance: 8, duration: 0.3 });
      return row;
    });
    fx.pop(node, at, { from: 0.85, rotate });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return { node, rows };
  }

  function list(parent, { x, y, w, title, items, at, until }) {
    const node = place(el('div', 'ih-list is-staged', parent), x, y);
    node.style.width = `${w}px`;
    if (title) el('div', 'ih-list-title', node, title);
    const rows = items.map((item) => {
      const row = el('div', 'ih-list-item is-staged', node);
      row.append(icon(item.iconName || 'check'));
      el('span', null, row, item.text);
      fx.rise(row, item.at, { distance: 8, duration: 0.3 });
      return row;
    });
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return { node, rows };
  }

  /** A speech (or thought) bubble with an optional speaker line. */
  function bubble(parent, { x, y, w, text, who, whoIcon = 'user', at, until, side = 'left', thought = false }) {
    const node = place(el('div', `ih-bubble${side === 'right' ? ' ih-bubble--right' : ''}${thought ? ' ih-bubble--thought' : ''} is-staged`, parent), x, y);
    if (w) node.style.width = `${w}px`;
    if (who) {
      const head = el('div', 'ih-bubble-who', node);
      head.append(icon(whoIcon));
      head.append(document.createTextNode(who));
    }
    el('div', null, node, text);
    return show(node, at, until, { rotate: side === 'right' ? 2 : -2, from: 0.5 });
  }

  // ------------------------------------------------------------------
  // Digits: split-flap fields, the mission clock, counters
  // ------------------------------------------------------------------

  /**
   * A row of flip digits. values = [{ at, text, tone }] (text is one char per
   * cell, ' ' leaves a cell blank); changed cells roll up into place.
   * strikes = [{ at, cells: [indices] }] draws a red slash through cells.
   */
  function digits(parent, { x, y, label, cells, values, size = 54, strikes = [], at, until }) {
    const node = place(el('div', 'ih-digits is-staged', parent), x, y);
    if (label) el('div', 'ih-digits-label', node, label);
    const row = el('div', 'ih-digits-row', node);
    row.style.fontSize = `${size}px`;
    const steps = [...values].sort((a, b) => a.at - b.at);
    const slots = Array.from({ length: cells }, (_, i) => {
      const cell = el('div', 'ih-digit', row);
      const now = el('div', 'ih-digit-face', cell);
      const before = el('div', 'ih-digit-face', cell);
      const strike = strikes.find((s) => s.cells.includes(i));
      if (strike) {
        const bar = el('div', 'ih-digit-strike is-staged', cell);
        tween(bar, [{ opacity: 0, scale: '0 1' }, { opacity: 1, scale: '1 1' }], strike.at, 0.25, EASE.out);
      }
      return { cell, now, before };
    });
    onFrame((t) => {
      const index = steps.findLastIndex((s) => s.at <= t);
      const current = steps[Math.max(0, index)];
      const previous = index > 0 ? steps[index - 1] : null;
      const roll = previous ? easeInOutCubic(progress(t, current.at, 0.32)) : 1;
      slots.forEach((slot, i) => {
        const a = current.text[i] ?? ' ';
        const b = previous ? previous.text[i] ?? ' ' : a;
        if (slot.now.textContent !== a) slot.now.textContent = a;
        if (slot.before.textContent !== b) slot.before.textContent = b;
        const rolling = a !== b && roll < 1;
        slot.now.style.transform = `translateY(${rolling ? (1 - roll) * 100 : 0}%)`;
        slot.before.style.transform = `translateY(${rolling ? -roll * 100 : -100}%)`;
        slot.cell.className = `ih-digit${current.tone ? ` ih-digit--${current.tone}` : ''}`;
      });
    });
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /** A digital clock that counts down to midnight and turns over on `turnAt`. */
  function clock(parent, { x, y, w = 330, at, turnAt, until }) {
    const node = place(el('div', 'ih-clock is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const date = el('div', 'ih-clock-date', node);
    const time = el('div', 'ih-clock-time', node);
    onFrame((t) => {
      const after = t >= turnAt;
      const left = Math.max(0, Math.ceil(turnAt - t));
      const seconds = after ? 0 : 60 - Math.min(59, left);
      date.textContent = after ? 'JAN 1, 2000' : 'DEC 31, 1999';
      time.textContent = after ? '00:00:00' : `23:59:${String(Math.min(59, seconds)).padStart(2, '0')}`;
      node.classList.toggle('is-new', after);
    });
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    fx.bump(node, turnAt, 0.12);
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /** A number that counts from `from` to `to` over [at, at + duration]. */
  function counter(parent, { x, y, label, from = 0, to, at, duration = 1.2, until, format = (n) => n.toLocaleString('en-US') }) {
    const node = place(el('div', 'ih-counter is-staged', parent), x, y);
    const value = el('div', 'ih-counter-value', node);
    if (label) el('div', 'ih-counter-label', node, label);
    onFrame((t) => {
      const p = easeInOutCubic(progress(t, at, duration));
      const text = format(Math.round(from + (to - from) * p));
      if (value.textContent !== text) value.textContent = text;
    });
    fx.rise(node, at, { distance: 12, duration: 0.3 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  // ------------------------------------------------------------------
  // Illustrations
  // ------------------------------------------------------------------

  function art(parent, { x, y, w, h, viewBox, className = '' }) {
    const node = svg('svg', { class: `ih-art ${className} is-staged`, viewBox: viewBox || `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, parent);
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    return node;
  }

  /** Photo-referenced vector portrait; the adjacent record supplies its text alternative. */
  function apolloPortrait(parent, { x, y, at, until }) {
    const node = place(el('img', 'ih-apollo-portrait is-staged', parent), x, y);
    node.src = '/assets/song-art/margaret-hamilton-apollo.svg';
    node.alt = '';
    node.setAttribute('aria-hidden', 'true');
    fx.fadeIn(node, at, 0.5);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  /** A car (for "a modern car? A hundred million lines"). */
  function car(parent, { x, y, at, until, w = 220 }) {
    const node = art(parent, { x, y, w, h: w * 0.5, viewBox: '0 0 220 110' });
    svg('ellipse', { class: 'ih-prop-shadow', cx: 111, cy: 96, rx: 99, ry: 6 }, node);
    svg('path', { class: 'ih-car-body', d: 'M12 78 L15 60 Q17 51 32 49 L60 45 L82 25 Q89 18 103 18 H146 Q159 18 171 29 L189 46 Q205 48 209 59 L211 77 Q210 84 203 84 H20 Q12 84 12 78 Z' }, node);
    svg('path', { class: 'ih-car-sill', d: 'M13 72 Q82 78 210 70 L210 79 Q209 84 201 84 H21 Q13 84 13 78 Z' }, node);
    svg('path', { class: 'ih-car-window', d: 'M88 29 Q92 26 101 26 H122 V46 H72 Z M130 26 H147 Q155 26 162 32 L176 46 H130 Z' }, node);
    svg('path', { class: 'ih-car-glass-shine', d: 'M90 29 H101 L85 43 H75 Z M135 29 H142 L157 43 H150 Z' }, node);
    svg('path', { class: 'ih-car-seam', d: 'M125 50 V71 M72 50 L66 69 M181 50 L185 67' }, node);
    svg('path', { class: 'ih-car-trim', d: 'M76 54 H85 M140 54 H149 M19 68 H30 M193 70 H206' }, node);
    svg('path', { class: 'ih-car-highlight', d: 'M34 52 Q91 48 180 51' }, node);
    svg('path', { class: 'ih-car-light', d: 'M195 55 L204 57 Q207 59 207 64 H195 Z' }, node);
    svg('rect', { class: 'ih-car-tail-light', x: 16, y: 57, width: 6, height: 8, rx: 2 }, node);
    for (const cx of [56, 168]) {
      svg('circle', { class: 'ih-car-wheel', cx, cy: 80, r: 17 }, node);
      svg('circle', { class: 'ih-car-rim', cx, cy: 80, r: 10 }, node);
      for (let i = 0; i < 5; i++) svg('path', { class: 'ih-car-spoke', d: `M${cx} 80 l0 -7`, transform: `rotate(${i * 72} ${cx} 80)` }, node);
      svg('circle', { class: 'ih-car-hub', cx, cy: 80, r: 3 }, node);
    }
    show(node, at, until, { from: 0.7 });
    return node;
  }

  /** A head overflowing with lines of code. */
  /**
   * A head in profile whose skull opens like a hinged lid: three case files
   * drop into the open head (what one person can hold), then at
   * `overflowAt` more files cram in, the lid rattles, papers keep bursting
   * out of the top, steam puffs from the ear, and the brow worries. One
   * head can't hold a whole modern system. Every pose is a pure function of
   * song time.
   */
  function overflowingHead(parent, { x, y, size = 210, at, until, overflowAt }) {
    const id = `ih-head-${++uid}`;
    const node = art(parent, { x, y, w: size, h: size, viewBox: '-30 -50 260 260' });
    const over = overflowAt ?? at + 1.5;
    const CUT = 66;       // the skull's cut plane
    const HINGE = [46, CUT];
    const skull = 'M46 96 C40 46 78 14 118 18 C156 22 176 52 172 86 L171 98 L182 118 Q186 124 178 126 L172 127 L174 134 Q177 138 172 141 Q176 146 171 150 C166 160 152 163 138 158 L110 152 C88 150 70 140 62 126 C52 120 47 110 46 96 Z';
    const defs = svg('defs', {}, node);
    const below = svg('clipPath', { id: `${id}-below` }, defs);
    svg('rect', { x: -50, y: CUT, width: 400, height: 300 }, below);
    const above = svg('clipPath', { id: `${id}-above` }, defs);
    svg('rect', { x: -50, y: -200, width: 400, height: 200 + CUT }, above);
    // Files stand in the hole: hide whatever lies below its front rim.
    const inHole = svg('clipPath', { id: `${id}-hole` }, defs);
    svg('path', { d: `M-50 -200 H350 V${CUT} H174 A64 10 0 0 1 44 ${CUT} H-50 Z` }, inHole);

    svg('ellipse', { class: 'ih-head-glow', cx: 100, cy: 100, rx: 118, ry: 112 }, node);
    svg('path', { class: 'ih-head-neck', d: 'M78 150 L118 160 L122 190 Q96 200 70 190 Z' }, node);
    svg('path', { class: 'ih-head-shirt', d: 'M44 205 Q52 184 74 182 Q97 196 124 184 Q148 188 156 205 Z' }, node);
    svg('path', { class: 'ih-head-collar', d: 'M74 182 Q97 196 124 184 L128 191 Q97 207 68 190 Z' }, node);

    // The lower head: skin below the cut, hair at the back, ear and face.
    const lower = svg('g', { 'clip-path': `url(#${id}-below)` }, node);
    svg('path', { class: 'ih-head', d: skull }, lower);
    svg('path', { class: 'ih-head-jaw-shade', d: 'M62 126 C72 142 92 150 112 152 L138 158 C150 162 162 158 170 150 C160 156 146 155 134 150 L110 145 C90 142 74 134 62 118 Z' }, lower);
    svg('path', { class: 'ih-head-hair', d: 'M40 60 C40 84 44 102 54 114 C58 104 66 97 76 94 C80 84 86 74 94 60 Z' }, lower);
    svg('path', { class: 'ih-head-ear', d: 'M70 112 C66 100 52 104 52 116 C52 128 60 136 68 132 Q74 128 72 120 Z' }, node);
    const brow = svg('path', { class: 'ih-head-brow' }, node);
    svg('path', { class: 'ih-head-eye', d: 'M150 102 Q158 96 166 102 Q158 106 150 102 Z' }, node);
    svg('circle', { class: 'ih-head-iris', cx: 161, cy: 101.5, r: 2.6 }, node);
    const mouth = svg('path', { class: 'ih-head-feature' }, node);

    // The open skull: a dark hole with a lit rim.
    const hole = svg('g', { opacity: 0 }, node);
    svg('ellipse', { class: 'ih-head-hole', cx: 109, cy: CUT, rx: 64, ry: 10 }, hole);
    // Case files standing in the head; the first three are what fits.
    const files = svg('g', { 'clip-path': `url(#${id}-hole)` }, node);
    const FILES = [
      { x: 84, rot: -7, at: at + 0.55 }, { x: 109, rot: 2, at: at + 0.85 }, { x: 134, rot: 8, at: at + 1.15 },
      { x: 96, rot: -18, at: over, extra: true }, { x: 122, rot: 15, at: over + 0.08, extra: true },
      { x: 72, rot: -26, at: over + 0.16, extra: true }, { x: 147, rot: 24, at: over + 0.24, extra: true },
      { x: 109, rot: -4, at: over + 0.32, extra: true },
    ];
    const fileNodes = FILES.map((f, i) => {
      const g = svg('g', { opacity: 0 }, files);
      const lift = f.extra ? 14 : 0;
      const top = CUT - 38 - lift;
      svg('path', { class: 'ih-head-file-tab', d: `M${f.x - 12} ${top + 2} v-6 q0 -2 2 -2 h9 l3 4 Z` }, g);
      svg('rect', { class: `ih-head-file${f.extra ? ' ih-head-file--extra' : ''}`, x: f.x - 13, y: top, width: 26, height: 48, rx: 2 }, g);
      svg('path', { class: 'ih-head-file-line', d: `M${f.x - 8} ${top + 9} h16 M${f.x - 8} ${top + 16} h11 M${f.x - 8} ${top + 23} h14` }, g);
      return { g, f, top };
    });
    svg('path', { class: 'ih-head-rim', d: `M45 ${CUT} A64 10 0 0 0 173 ${CUT}` }, hole);
    const lipFront = svg('path', { class: 'ih-head-lip', d: `M45 ${CUT} A64 10 0 0 0 173 ${CUT}`, opacity: 0 }, node);

    // The lid: the hair-covered top of the skull, hinged at the back.
    const lid = svg('g', {}, node);
    const underside = svg('ellipse', { class: 'ih-head-underside', cx: 109, cy: CUT, rx: 64, ry: 10, opacity: 0 }, lid);
    const cap = svg('g', { 'clip-path': `url(#${id}-above)` }, lid);
    svg('path', { class: 'ih-head ih-head--cap', d: skull }, cap);
    svg('path', { class: 'ih-head-hair', d: 'M38 70 C34 36 70 10 112 12 C152 14 178 40 176 72 Z' }, cap);
    svg('path', { class: 'ih-head-hair-shine', d: 'M62 34 C78 20 104 16 124 20 C100 22 80 30 62 34 Z' }, cap);
    // Hinged at the back, the open lid stands behind the files.
    node.insertBefore(lid, files);

    // Papers burst out of the open head, a steady stream once it overflows.
    const stream = svg('g', {}, node);
    const papers = Array.from({ length: 9 }, (_, i) => {
      const g = svg('g', { opacity: 0 }, stream);
      svg('rect', { class: 'ih-head-overflow', x: -11, y: -14, width: 22, height: 28, rx: 2 }, g);
      svg('path', { class: 'ih-head-code', d: 'M-6 -7 h12 M-6 0 h8 M-6 7 h11' }, g);
      return {
        g,
        delay: i * 0.17,
        x0: 92 + hash01(i * 13 + 1) * 34,
        vx: ((i % 2 ? 1 : -1) * (0.25 + 0.75 * hash01(i * 7 + 3))) * 150,
        vy: 175 + hash01(i * 11 + 5) * 55,
        spin: (hash01(i * 17 + 2) - 0.5) * 520,
      };
    });
    // Steam from the ear and a bead of sweat when it overflows.
    // Steam clouds: three overlapping circles each, so they read as vapour.
    const puffs = [0, 1, 2].map(() => {
      const g = svg('g', { opacity: 0 }, node);
      for (const [cx, cy, r] of [[-5, 1, 5], [3, -3, 6], [8, 2, 4.5]]) svg('circle', { class: 'ih-head-steam', cx, cy, r }, g);
      return g;
    });
    const sweat = svg('path', { class: 'ih-head-sweat', d: 'M0 -9 Q-6 1 0 5 Q6 1 0 -9 Z', opacity: 0 }, node);

    const CALM_BROW = 'M148 92 Q158 87 166 92';
    const WORRIED_BROW = 'M148 94 Q157 89 166 85';
    const CALM_MOUTH = 'M160 140 Q166 143 171 141';
    const WORRIED_MOUTH = 'M158 142 Q161 139 164 142 Q167 145 171 141';
    const PERIOD = 1.3;
    onFrame((t) => {
      const open = easeInOutCubic(progress(t, at + 0.15, 0.4));
      const jam = progress(t, over, 0.35);
      const rattle = t >= over ? 4 * Math.sin((t - over) * 26) * (0.5 + 0.5 * Math.sin((t - over) * 3.1)) : 0;
      const angle = -34 * open - 12 * jam + rattle;
      lid.setAttribute('transform', `translate(0 ${(-6 * jam).toFixed(1)}) rotate(${angle.toFixed(1)} ${HINGE[0]} ${HINGE[1]})`);
      hole.setAttribute('opacity', open > 0.05 ? '1' : '0');
      lipFront.setAttribute('opacity', open > 0.05 ? '1' : '0');
      underside.setAttribute('opacity', open > 0.05 ? '1' : '0');
      fileNodes.forEach(({ g, f }) => {
        const p = progress(t, f.at, 0.3);
        if (p <= 0) { g.setAttribute('opacity', '0'); return; }
        const drop = (1 - easeInOutCubic(p)) * -46;
        const wobble = t >= over ? 1.6 * Math.sin(t * 19 + f.x) : 0;
        g.setAttribute('opacity', '1');
        g.setAttribute('transform', `translate(0 ${drop.toFixed(1)}) rotate(${(f.rot + wobble).toFixed(1)} ${f.x} ${CUT})`);
      });
      papers.forEach((pp) => {
        const since = t - over - pp.delay;
        if (since < 0) { pp.g.setAttribute('opacity', '0'); return; }
        const age = since % PERIOD;
        const px = pp.x0 + pp.vx * age;
        const py = CUT - 30 - pp.vy * age + 220 * age * age;
        // Gone before falling back past the opening, so no ghost crosses the face.
        const fade = Math.max(0, Math.min(1, age / 0.1, (PERIOD - age) / 0.35, (CUT - 8 - py) / 22));
        pp.g.setAttribute('opacity', fade.toFixed(2));
        pp.g.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(pp.spin * age).toFixed(1)})`);
      });
      puffs.forEach((puff, i) => {
        const since = t - over - 0.3 - i * 0.45;
        if (since < 0) { puff.setAttribute('opacity', '0'); return; }
        const age = (since % 1.35) / 1.35;
        const grow = 0.7 + 1.1 * age;
        puff.setAttribute('transform', `translate(${(50 - 18 * age).toFixed(1)} ${(108 - 40 * age).toFixed(1)}) scale(${grow.toFixed(2)})`);
        puff.setAttribute('opacity', (0.8 * Math.min(1, age * 5) * (1 - age)).toFixed(2));
      });
      const drip = t - over - 0.5;
      sweat.setAttribute('opacity', drip < 0 ? '0' : '1');
      sweat.setAttribute('transform', `translate(140 ${(84 + Math.min(12, Math.max(0, drip) * 8)).toFixed(1)})`);
      const worried = t >= over;
      brow.setAttribute('d', worried ? WORRIED_BROW : CALM_BROW);
      mouth.setAttribute('d', worried ? WORRIED_MOUTH : CALM_MOUTH);
    });
    show(node, at, until, { from: 0.7 });
    return node;
  }



  /** A flowchart of processing steps; cross(at) strikes the whole idea. */
  /**
   * The processing steps of a flowchart as cards riding a conveyor belt
   * (one module per step: the decomposition Parnas argued against).
   * labels = [{ text, iconName }] or plain strings.
   */
  function steps(parent, { x, y, labels, at, step = 0.3, until }) {
    const node = place(el('div', 'ih-steps', parent), x, y);
    const belt = el('div', 'ih-belt is-staged', node);
    const tread = el('div', 'ih-belt-tread', belt);
    fx.fadeIn(belt, at - 0.1, 0.25);
    onFrame((t) => { tread.style.backgroundPosition = `${((t * 40) % 28).toFixed(1)}px 0`; });
    labels.forEach((label, i) => {
      const spec = typeof label === 'string' ? { text: label } : label;
      if (i) {
        const arrow = icon('pointer', 'ih-step-arrow is-staged');
        node.append(arrow);
        fx.fadeIn(arrow, at + i * step - 0.1, 0.2);
      }
      const box = el('div', 'ih-step is-staged', node);
      if (spec.iconName) box.append(icon(spec.iconName));
      box.append(document.createTextNode(spec.text));
      fx.pop(box, at + i * step, { from: 0.7 });
    });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /**
   * A tear-off desk calendar. pages = [{ at, month, day, year, tone }]; on
   * each change the old page tears off and falls away.
   */
  function calendar(parent, { x, y, pages, at, until }) {
    const node = place(el('div', 'ih-calendar is-staged', parent), x, y);
    const rings = el('div', 'ih-calendar-rings', node);
    for (let i = 0; i < 4; i++) el('span', null, rings);
    const sheet = el('div', 'ih-calendar-page', node);
    const month = el('div', 'ih-calendar-month', sheet);
    const day = el('div', 'ih-calendar-day', sheet);
    const year = el('div', 'ih-calendar-year', sheet);
    const sorted = [...pages].sort((a, b) => a.at - b.at);
    onFrame((t) => {
      const page = latest(sorted, t) || sorted[0];
      if (month.textContent !== page.month) month.textContent = page.month;
      if (day.textContent !== String(page.day)) day.textContent = String(page.day);
      if (year.textContent !== String(page.year)) year.textContent = String(page.year);
      sheet.classList.toggle('is-bad', page.tone === 'bad');
    });
    sorted.slice(1).forEach((page, i) => {
      const old = sorted[i];
      const torn = el('div', 'ih-calendar-page ih-calendar-torn is-staged', node);
      el('div', 'ih-calendar-month', torn, old.month);
      el('div', 'ih-calendar-day', torn, String(old.day));
      el('div', 'ih-calendar-year', torn, String(old.year));
      tween(torn, [
        { opacity: 1, translate: '0 0', rotate: '0deg' },
        { opacity: 1, translate: '10px 30px', rotate: '8deg', offset: 0.3 },
        { opacity: 0, translate: '60px 180px', rotate: '38deg' },
      ], page.at, 0.8, EASE.in);
      fx.bump(sheet, page.at + 0.05, 0.06);
    });
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  // ------------------------------------------------------------------
  // The iceberg: interface above the water, implementation below
  // ------------------------------------------------------------------

  function gearPath(teeth, outer, inner) {
    let d = '';
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 ? inner : outer;
      const a1 = a - Math.PI / (teeth * 4);
      const a2 = a + Math.PI / (teeth * 4);
      d += `${i ? 'L' : 'M'} ${(r * Math.cos(a1)).toFixed(1)} ${(r * Math.sin(a1)).toFixed(1)} L ${(r * Math.cos(a2)).toFixed(1)} ${(r * Math.sin(a2)).toFixed(1)} `;
    }
    return `${d}Z`;
  }

  /**
   * An iceberg in a 420×360 box with its waterline at y = 120. The tip is the
   * interface (what), the bulk below the implementation (how). Gears below
   * the water turn; swap(at) replaces them (the how changes, the tip doesn't).
   */
  function iceberg(parent, { x, y, scale = 1, at, until, gearsFrom }) {
    const id = `ih-berg-${++uid}`;
    const node = art(parent, { x, y, w: 420 * scale, h: 360 * scale, viewBox: '0 0 420 360' });
    const defs = svg('defs', {}, node);
    const sea = svg('linearGradient', { id: `${id}-sea`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg('stop', { offset: 0, 'stop-color': '#0e4d7a', 'stop-opacity': 0.75 }, sea);
    svg('stop', { offset: 1, 'stop-color': '#04162b', 'stop-opacity': 0.95 }, sea);
    const aboveClip = svg('path', {}, svg('clipPath', { id: `${id}-above` }, defs));
    const belowClip = svg('path', {}, svg('clipPath', { id: `${id}-below` }, defs));
    const seaSurface = svg('path', { fill: `url(#${id}-sea)` }, node);
    const submerged = svg('g', { 'clip-path': `url(#${id}-below)` }, node);
    const exposed = svg('g', { 'clip-path': `url(#${id}-above)` }, node);
    // Below the waterline: the bulk (the implementation).
    svg('path', { class: 'ih-ice-deep', d: 'M 124 110 L 80 190 L 104 262 L 160 330 L 236 344 L 300 300 L 334 226 L 318 162 L 292 110 Z' }, submerged);
    svg('path', { class: 'ih-ice-deep-shade', d: 'M 236 344 L 300 300 L 334 226 L 318 162 L 292 110 L 265 110 L 290 190 L 270 280 Z' }, submerged);
    // Above the waterline: the tip (the interface).
    svg('path', { class: 'ih-ice-tip', d: 'M 126 130 L 176 58 L 204 28 L 230 52 L 262 76 L 296 130 Z' }, exposed);
    svg('path', { class: 'ih-ice-tip-shade', d: 'M 204 28 L 230 52 L 262 76 L 296 130 L 248 130 L 226 70 Z' }, exposed);
    svg('path', { class: 'ih-ice-facet', d: 'M120 124 L164 183 L104 262 L148 204 Z M164 183 L160 330 L204 288 Z M268 124 L270 280 L300 300 L290 190 Z' }, submerged);
    svg('path', { class: 'ih-ice-tip-facet', d: 'M204 28 L190 83 L159 130 H217 L226 70 Z' }, exposed);
    svg('path', { class: 'ih-ice-crack', d: 'M185 126 L178 156 L189 176 M300 165 L282 184 L288 204 M130 271 L147 288' }, submerged);
    const wave = svg('path', { class: 'ih-sea-top' }, node);
    for (const [fx0, fy] of [[60, 300], [350, 250], [370, 320]]) {
      svg('path', { class: 'ih-fish', d: `M ${fx0} ${fy} q 10 -8 20 0 q -10 8 -20 0 Z M ${fx0 + 20} ${fy} l 7 -5 l 0 10 Z` }, node);
    }
    const gearSets = [[], []];
    const gearSpecs = [
      [{ cx: 170, cy: 210, teeth: 10, r: 30 }, { cx: 226, cy: 250, teeth: 8, r: 24 }, { cx: 262, cy: 196, teeth: 7, r: 20 }],
      [{ cx: 160, cy: 240, teeth: 12, r: 36 }, { cx: 236, cy: 206, teeth: 9, r: 28 }, { cx: 228, cy: 286, teeth: 6, r: 18 }],
    ];
    gearSpecs.forEach((set, s) => {
      for (const spec of set) {
        const g = svg('g', { opacity: s ? 0 : 1 }, node);
        svg('path', { class: 'ih-gear', d: gearPath(spec.teeth, spec.r, spec.r * 0.78) }, g);
        svg('circle', { class: 'ih-gear-hub', r: spec.r * 0.32 }, g);
        gearSets[s].push({ g, spec });
      }
    });
    let swapAt = Infinity;
    const spinFrom = gearsFrom ?? at;
    onFrame((t) => {
      let d = '';
      for (let px = 0; px <= 420; px += 10) d += `${px ? ' L' : 'M'} ${px} ${(120 + 3 * Math.sin(px / 30 + t * 2)).toFixed(1)}`;
      wave.setAttribute('d', d);
      aboveClip.setAttribute('d', `${d} L420 0 H0 Z`);
      belowClip.setAttribute('d', `${d} L420 360 H0 Z`);
      seaSurface.setAttribute('d', `${d} V342 Q420 360 402 360 H18 Q0 360 0 342 Z`);
      const swapped = progress(t, swapAt, 0.5);
      gearSets.forEach((set, s) => set.forEach(({ g, spec }, i) => {
        const spin = Math.max(0, t - spinFrom) * (i % 2 ? -50 : 60) * (s ? 1.3 : 1);
        const vis = s ? swapped : 1 - swapped;
        const lift = (s ? 1 - swapped : swapped) * 26;
        g.setAttribute('transform', `translate(${spec.cx} ${(spec.cy + lift).toFixed(1)}) rotate(${spin.toFixed(1)})`);
        g.setAttribute('opacity', vis.toFixed(2));
      }));
    });
    fx.fadeIn(node, at, 0.35);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return {
      node,
      swap(when) { swapAt = when; return this; },
      /** Stage point for a position in the iceberg's own 420×360 frame. */
      point(px, py) { return [x + px * scale, y + py * scale]; },
    };
  }

  /** A label on the iceberg: tone = tip (gold) | deep (cyan). */
  function bergLabel(parent, { x, y, title, sub, tone = 'tip', at, until }) {
    const node = place(el('div', `ih-berg-label ih-berg-label--${tone} is-staged`, parent), x, y);
    node.append(document.createTextNode(title));
    if (sub) el('small', null, node, sub);
    return show(node, at, until, { rotate: tone === 'tip' ? -3 : 3 });
  }

  /**
   * A two-way design choice: a pill with both options, the chosen one lit.
   * flips = [{ at }] switch sides.
   */
  function toggle(parent, { x, y, a, b, at, flips = [], until, start = 0 }) {
    const node = place(el('div', 'ih-toggle is-staged', parent), x, y);
    const left = el('span', 'ih-toggle-side', node, a);
    el('span', 'ih-toggle-or', node, 'or');
    const right = el('span', 'ih-toggle-side', node, b);
    const times = [...flips].sort((p, q) => p - q);
    onFrame((t) => {
      const side = (start + times.filter((f) => f <= t).length) % 2;
      left.classList.toggle('is-on', side === 0);
      right.classList.toggle('is-on', side === 1);
    });
    for (const f of times) fx.bump(node, f, 0.12);
    return show(node, at, until, { rotate: 0, from: 0.7 });
  }

  /** A dashed waterline across the stage at y (the iceberg's sea level). */
  function waterline(parent, { y, x1 = 0, x2 = 960, at, until }) {
    const line = svg('svg', { class: 'ih-waterline is-staged', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    svg('line', { x1, y1: y, x2, y2: y }, line);
    fx.fadeIn(line, at, 0.4);
    if (until !== undefined) fx.fadeOut(line, until, 0.3);
    return line;
  }

  // ------------------------------------------------------------------
  // The wall outlet and the plant behind the wall
  // ------------------------------------------------------------------

  /**
   * A cutaway wall in a 480×300 box: on the right, an outlet, a plug, and a
   * charging phone; on the left, behind the wall, the plant that is running.
   * plants = [{ at, kind: 'solar' | 'wind' }].
   */
  function outlet(parent, { x, y, scale = 1, at, until, plants }) {
    const node = art(parent, { x, y, w: 480 * scale, h: 300 * scale, viewBox: '0 0 480 300' });
    const sorted = [...plants].sort((a, b) => a.at - b.at);
    // Behind the wall: two scenes that cross-fade.
    const day = svg('g', {}, node);
    svg('rect', { class: 'ih-sky-day', x: 10, y: 10, width: 230, height: 280, rx: 14 }, day);
    svg('rect', { class: 'ih-ground', x: 10, y: 230, width: 230, height: 60, rx: 4 }, day);
    const sun = svg('g', { transform: 'translate(70 70)' }, day);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      svg('line', { class: 'ih-sun-ray', x1: (30 * Math.cos(a)).toFixed(1), y1: (30 * Math.sin(a)).toFixed(1), x2: (40 * Math.cos(a)).toFixed(1), y2: (40 * Math.sin(a)).toFixed(1) }, sun);
    }
    svg('circle', { class: 'ih-sun', r: 22 }, sun);
    for (const px of [60, 150]) {
      const panel = svg('g', { transform: `translate(${px} 200)` }, day);
      svg('line', { class: 'ih-panel-leg', x1: 30, y1: 18, x2: 30, y2: 34 }, panel);
      svg('path', { class: 'ih-panel', d: 'M 0 18 L 12 -14 L 72 -14 L 60 18 Z' }, panel);
      svg('path', { class: 'ih-panel-grid', d: 'M 4 8 L 64 8 M 8 -3 L 68 -3 M 24 18 L 32 -14 M 44 18 L 52 -14' }, panel);
    }
    const night = svg('g', { opacity: 0 }, node);
    svg('rect', { class: 'ih-sky-night', x: 10, y: 10, width: 230, height: 280, rx: 14 }, night);
    svg('rect', { class: 'ih-ground ih-ground--night', x: 10, y: 230, width: 230, height: 60, rx: 4 }, night);
    svg('path', { class: 'ih-moon', d: 'M 66 40 a 22 22 0 1 0 22 30 a 17 17 0 1 1 -22 -30 Z' }, night);
    for (const [sx, sy] of [[150, 40], [190, 70], [120, 90], [210, 30], [40, 120]]) svg('circle', { class: 'ih-star', cx: sx, cy: sy, r: 2 }, night);
    const turbines = [[90, 236, 1], [180, 236, 0.75]].map(([tx, ty, s]) => {
      const g = svg('g', { transform: `translate(${tx} ${ty}) scale(${s})` }, night);
      svg('path', { class: 'ih-tower', d: 'M -4 0 L -2 -120 L 2 -120 L 4 0 Z' }, g);
      const rotor = svg('g', { transform: 'translate(0 -120)' }, g);
      for (let i = 0; i < 3; i++) svg('path', { class: 'ih-blade', d: 'M 0 0 C 6 -16 4 -44 0 -58 C -4 -44 -6 -16 0 0 Z', transform: `rotate(${i * 120})` }, rotor);
      svg('circle', { class: 'ih-tower', r: 5 }, rotor);
      return rotor;
    });
    // The wall and the outlet.
    svg('path', { class: 'ih-wall', d: 'M 250 4 L 476 4 L 476 296 L 250 296 Z' }, node);
    svg('path', { class: 'ih-wall-cut', d: 'M 240 4 L 262 4 L 252 60 L 266 120 L 250 190 L 264 250 L 252 296 L 240 296 Z' }, node);
    svg('rect', { class: 'ih-plate', x: 300, y: 100, width: 70, height: 100, rx: 10 }, node);
    svg('path', { class: 'ih-plate-bevel', d: 'M307 105 H363 V192' }, node);
    for (const sy of [110, 190]) {
      svg('circle', { class: 'ih-plate-screw', cx: 335, cy: sy, r: 2.5 }, node);
      svg('path', { class: 'ih-plate-slot', d: `M333.5 ${sy} h3` }, node);
    }
    for (const sy of [122, 160]) {
      svg('rect', { class: 'ih-socket', x: 323, y: sy, width: 7, height: 16, rx: 2 }, node);
      svg('rect', { class: 'ih-socket', x: 340, y: sy, width: 7, height: 16, rx: 2 }, node);
    }
    const flowing = svg('path', { class: 'ih-cable-glow', d: 'M 345 176 C 360 230 414 240 420 188' }, node);
    svg('path', { class: 'ih-cable', d: 'M 345 176 C 360 230 414 240 420 188', opacity: 0.5 }, node);
    svg('rect', { class: 'ih-plug', x: 316, y: 150, width: 40, height: 30, rx: 6 }, node);
    svg('rect', { class: 'ih-phone', x: 398, y: 96, width: 44, height: 92, rx: 9 }, node);
    svg('rect', { class: 'ih-phone-screen', x: 404, y: 106, width: 32, height: 70, rx: 4 }, node);
    svg('rect', { class: 'ih-battery-frame', x: 409, y: 136, width: 22, height: 33, rx: 3 }, node);
    svg('path', { class: 'ih-phone-detail', d: 'M417 101 H423 M417 181 H423 M417 133 H423' }, node);
    const battery = svg('rect', { class: 'ih-battery', x: 412, y: 140, width: 16, height: 26, rx: 2 }, node);
    onFrame((t) => {
      const current = latest(sorted, t) || sorted[0];
      const index = sorted.indexOf(current);
      const prev = index > 0 ? sorted[index - 1] : null;
      const fade = prev ? progress(t, current.at, 0.6) : 1;
      const nightOpacity = current.kind === 'wind' ? fade : 1 - fade;
      night.setAttribute('opacity', (prev || current.kind === 'wind' ? nightOpacity : 0).toFixed(2));
      turbines.forEach((rotor, i) => rotor.setAttribute('transform', `translate(0 -120) rotate(${((t * (90 + i * 30)) % 360).toFixed(1)})`));
      flowing.setAttribute('stroke-dashoffset', (-t * 40).toFixed(1));
      const level = 0.3 + 0.7 * ((t * 0.08) % 1);
      battery.setAttribute('height', (26 * level).toFixed(1));
      battery.setAttribute('y', (166 - 26 * level).toFixed(1));
    });
    fx.fadeIn(node, at, 0.35);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  // ------------------------------------------------------------------
  // Title card: a manila dossier
  // ------------------------------------------------------------------

  function dossier(parent, { x, y, w, tab, title, sub, at, until, rotate = -2 }) {
    const node = place(el('div', 'ih-dossier is-staged', parent), x, y);
    node.style.width = `${w}px`;
    el('div', 'ih-dossier-tab', node, tab);
    el('div', 'ih-dossier-title', node, title);
    if (sub) el('div', 'ih-dossier-sub', node, sub);
    fx.pop(node, at, { from: 0.8, rotate });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  // ------------------------------------------------------------------
  // Decryption: text that resolves from cipher noise, left to right
  // ------------------------------------------------------------------

  const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const LOWER = 'abcdefghijklmnopqrstuvwxyz';
  const DIGIT = '0123456789';

  /** A cipher character that keeps the case (and so the width) of `ch`. */
  function cipher(ch, seed) {
    const pool = /[A-Z]/.test(ch) ? UPPER : /[a-z]/.test(ch) ? LOWER : /[0-9]/.test(ch) ? DIGIT : null;
    return pool ? pool[Math.floor(hash01(seed) * pool.length)] : ch;
  }

  /**
   * Shows `text` in `node` from `at`: characters before the lock point are
   * the real text, the rest churn as cipher. `offset` delays this span's
   * lock point (to decrypt several spans as one line). Before `at` the
   * node shows `before`.
   */
  function decrypt(node, text, at, { cps = 75, offset = 0, seed = 1, before = '' } = {}) {
    onFrame((t) => {
      if (t < at) {
        if (node.textContent !== before) node.textContent = before;
        return;
      }
      const locked = Math.floor((t - at) * cps) - offset;
      if (locked >= text.length) {
        if (node.textContent !== text) node.textContent = text;
        return;
      }
      const frame = Math.floor(t * 20);
      let out = '';
      for (let i = 0; i < text.length; i++) out += i < locked ? text[i] : cipher(text[i], seed * 7919 + frame * 131 + i * 17);
      node.textContent = out;
    });
  }

  // ------------------------------------------------------------------
  // Case files: every module is a manila folder; secrets are sealed
  // ------------------------------------------------------------------

  /**
   * Each named service keeps one logo wherever it appears in the song, and
   * no two services share one, so a viewer can follow a module from scene
   * to scene by its badge as well as its name.
   */
  const SERVICE_ICONS = {
    OrderService: 'cart', RefundService: 'resend', WalletService: 'wallet',
    PaymentGateway: 'card', PayPalGateway: 'plug', StripeGateway: 'bolt', PayPal: 'globe',
    Dates: 'calendar', UserRepository: 'database',
    Payroll: 'cash', Billing: 'receipt', Interest: 'percent', Reports: 'chart',
    Login: 'key', Profile: 'user', Admin: 'gear',
    // The corkboard's pinned modules.
    Cart: 'cart', Order: 'box', Pay: 'card', Ship: 'truck', Auth: 'key', Mail: 'envelope', Tax: 'percent', Stock: 'stack',
  };

  let fileNumber = 0;

  /**
   * A module drawn as a case file: a manila folder with a typed name label,
   * a paper clip, and a file number. kind = 'interface' draws a public
   * credential badge instead (what callers may see); 'external' draws a
   * foreign-contact card. lines = [{ text, at }] lists operations.
   */
  function module(parent, { x, y, w = 200, h = 74, name, sub, iconName = SERVICE_ICONS[name] || 'box', kind, lines = [], at, until, rise = true }) {
    const variant = kind || 'file';
    const node = place(el('div', `ih-module ih-module--${variant} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    const glows = {};
    if (variant === 'file') {
      el('div', 'ih-file-tab', node);
      const clip = svg('svg', { class: 'ih-clip', viewBox: '0 0 16 40', 'aria-hidden': 'true' }, node);
      svg('path', { d: 'M5 38V8a3 3 0 0 1 6 0v26a5 5 0 0 1-10 0V6a7 7 0 0 1 14 0v22' }, clip);
      el('span', 'ih-file-no', node, `№ ${String(++fileNumber % 100).padStart(2, '0')}`);
    }
    if (variant === 'interface') {
      el('div', 'ih-badge-strip', node, '«interface» · public');
      el('span', 'ih-badge-hole', node);
    }
    if (variant === 'external') el('div', 'ih-contact-strip', node, 'external contact');
    const head = el('div', 'ih-module-head', node);
    const seal = el('span', 'ih-module-seal', head);
    seal.append(icon(iconName));
    el('span', 'ih-module-name', head, name);
    if (sub) el('div', 'ih-module-sub', node, sub);
    for (const line of lines) {
      const row = el('div', `ih-module-line${line.at !== undefined ? ' is-staged' : ''}`, node, line.text);
      if (line.at !== undefined) fx.rise(row, line.at, { distance: 6, duration: 0.25 });
    }
    if (at !== undefined) {
      if (rise) fx.rise(node, at, { distance: 18, duration: 0.4 });
      else fx.pop(node, at, { from: 0.7 });
    }
    if (until !== undefined) fx.fadeOut(node, until, 0.25);

    function glow(tone) {
      if (!glows[tone]) glows[tone] = el('div', `ih-module-glow${tone === 'gold' ? '' : ` ih-module-glow--${tone}`} is-staged`, node);
      return glows[tone];
    }

    return {
      node, x, y, w, h,
      /** A sealed red "top secret" envelope pinned to the file: the decision it hides. */
      secret(text, { at: when, until: gone, dx, dy } = {}) {
        const env = envelope(node, { text, x: dx ?? 14, y: dy ?? h - 18 });
        show(env, when, gone, { rotate: -3, from: 1.6 });
        return env;
      },
      verdict(text, { at: when, until: gone, ok = true, dx, dy } = {}) {
        const tag = el('div', `ih-verdict ih-verdict--${ok ? 'ok' : 'no'} is-staged`, node);
        tag.append(icon(ok ? 'check' : 'cross'));
        tag.append(document.createTextNode(text));
        tag.style.left = `${dx ?? w - 40}px`;
        tag.style.top = `${dy ?? -14}px`;
        show(tag, when, gone, { rotate: 4, from: 1.5 });
        return tag;
      },
      /** A rubber stamp across the folder (AFFECTED, CHANGED, ...). */
      stamp(text, { at: when, color = 'red', rotate = -9, dx, dy } = {}) {
        const mark = el('div', `ih-file-stamp ih-file-stamp--${color} is-staged`, node, text);
        mark.style.left = `${dx ?? w / 2 - 40}px`;
        mark.style.top = `${dy ?? h / 2 - 14}px`;
        fx.slam(mark, when, { from: 2.2, rotate });
        return mark;
      },
      light(when, gone, tone = 'gold') {
        const g = glow(tone);
        tween(g, [{ opacity: 0 }, { opacity: 1 }], when, 0.18, EASE.out);
        fx.bump(node, when, 0.05);
        if (gone !== undefined) tween(g, { opacity: 0 }, gone, 0.3, EASE.in);
        return this;
      },
      dim(when, gone) {
        tween(node, { opacity: 0.32 }, when, 0.3, EASE.inOut);
        if (gone !== undefined) tween(node, { opacity: 1 }, gone, 0.3, EASE.inOut);
        return this;
      },
    };
  }

  /** A sealed envelope with a wax seal and a "TOP SECRET" band: a module's secret. */
  function envelope(parent, { text, x, y }) {
    const node = place(el('div', 'ih-envelope is-staged', parent), x, y);
    const flap = svg('svg', { class: 'ih-envelope-flap', viewBox: '0 0 100 20', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, node);
    svg('path', { d: 'M1 1 L50 18 L99 1' }, flap);
    const seal = el('span', 'ih-envelope-seal', node);
    seal.append(icon('lock'));
    el('span', 'ih-envelope-band', node, 'Top secret');
    el('span', 'ih-envelope-text', node, text);
    return node;
  }

  // ------------------------------------------------------------------
  // Couriers: a dashed route with sealed envelopes travelling along it
  // ------------------------------------------------------------------

  /**
   * A route from `from` to `to` (bowed by `bend`), drawn on at `at`, along
   * which envelopes travel every `period` seconds until `until`. tone =
   * gold | cyan | pink | red. arrow adds a head at `to`.
   */
  function courier(parent, { from, to, bend = 0, at, until, tone = 'gold', period = 1.8, carriers = 1, arrow = true }) {
    const art = svg('svg', { class: 'ih-route-art is-staged', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    const [x1, y1] = from;
    const [x2, y2] = to;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 + bend;
    svg('path', { class: 'ih-route-shadow', d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}` }, art);
    const path = svg('path', { class: `ih-route ih-route--${tone}`, d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}` }, art);
    const ink = svg('path', { class: `ih-route-draw ih-route--${tone}`, d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}` }, art);
    fx.draw(ink, at, 0.35);
    tween(path, [{ opacity: 0 }, { opacity: 1 }], at + 0.3, 0.1, EASE.out);
    if (arrow) {
      const angle = Math.atan2(y2 - cy, x2 - cx) * 180 / Math.PI;
      const head = svg('path', { class: `ih-route-head ih-route-head--${tone} is-staged`, d: 'M 0 0 L -13 -7 L -13 7 Z', transform: `translate(${x2} ${y2}) rotate(${angle.toFixed(1)})` }, art);
      fx.fadeIn(head, at + 0.3, 0.1);
    }
    const letters = Array.from({ length: carriers }, () => {
      const g = svg('g', { class: 'ih-route-letter', opacity: 0 }, art);
      svg('rect', { x: -9, y: -6.5, width: 18, height: 13, rx: 1.5 }, g);
      svg('path', { d: 'M -8 -5.5 L 0 1 L 8 -5.5' }, g);
      svg('circle', { class: 'ih-route-wax', cx: 0, cy: 1.5, r: 2.4 }, g);
      return g;
    });
    const end = until ?? Infinity;
    onFrame((t) => {
      letters.forEach((g, k) => {
        const age = t - (at + 0.4) - (k * period) / carriers;
        if (age < 0 || t > end - 0.3) {
          g.setAttribute('opacity', '0');
          return;
        }
        const p = (age % period) / period;
        const q = 1 - p;
        const px = q * q * x1 + 2 * q * p * cx + p * p * x2;
        const py = q * q * y1 + 2 * q * p * cy + p * p * y2;
        g.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
        g.setAttribute('opacity', Math.min(1, p * 6, (1 - p) * 6).toFixed(2));
      });
    });
    fx.fadeIn(art, at, 0.05);
    if (until !== undefined) fx.fadeOut(art, until - 0.25, 0.25);
    return art;
  }

  // ------------------------------------------------------------------
  // Security hardware: laser walls, spotlights, the interrogation lamp
  // ------------------------------------------------------------------

  /** A vertical laser wall between two emitters; it hums (slowly) once on. */
  function laser(parent, { x, y1, y2, at, until }) {
    const node = svg('svg', { class: 'ih-laser is-staged', viewBox: `0 0 30 ${y2 - y1 + 24}`, width: 30, height: y2 - y1 + 24, 'aria-hidden': 'true' }, parent);
    node.style.left = `${x - 15}px`;
    node.style.top = `${y1 - 12}px`;
    const len = y2 - y1;
    const glowLine = svg('line', { class: 'ih-laser-glow', x1: 15, y1: 12, x2: 15, y2: 12 + len }, node);
    const beam = svg('line', { class: 'ih-laser-beam', x1: 15, y1: 12, x2: 15, y2: 12 + len }, node);
    svg('rect', { class: 'ih-laser-emitter', x: 5, y: 0, width: 20, height: 12, rx: 3 }, node);
    svg('rect', { class: 'ih-laser-emitter', x: 5, y: 12 + len, width: 20, height: 12, rx: 3 }, node);
    svg('circle', { class: 'ih-laser-eye', cx: 15, cy: 9, r: 2.5 }, node);
    svg('circle', { class: 'ih-laser-eye', cx: 15, cy: 15 + len, r: 2.5 }, node);
    fx.fadeIn(node, at, 0.2);
    fx.draw(beam, at + 0.1, 0.3);
    fx.draw(glowLine, at + 0.1, 0.3);
    onFrame((t) => glowLine.setAttribute('opacity', (0.45 + 0.15 * Math.sin((t - at) * 3.6)).toFixed(3)));
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  /** A soft pool of light from above (a searchlight picking something out). */
  function spotlight(parent, { x, y, w = 300, h = 300, at, until }) {
    const node = place(el('div', 'ih-spot is-staged', parent), x - w / 2, y - h / 2);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    fx.fadeIn(node, at, 0.4);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  /** A hanging interrogation lamp whose light falls on what is below it. */
  function lamp(parent, { x, y = 0, w = 520, h = 360, at, until }) {
    const node = svg('svg', { class: 'ih-lamp is-staged', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, parent);
    node.style.left = `${x - w / 2}px`;
    node.style.top = `${y}px`;
    const c = w / 2;
    svg('path', { class: 'ih-lamp-light', d: `M ${c - 30} 46 L ${c + 30} 46 L ${w} ${h} L 0 ${h} Z` }, node);
    svg('line', { class: 'ih-lamp-cord', x1: c, y1: 0, x2: c, y2: 22 }, node);
    svg('path', { class: 'ih-lamp-shade', d: `M ${c - 12} 22 L ${c + 12} 22 L ${c + 36} 48 L ${c - 36} 48 Z` }, node);
    svg('ellipse', { class: 'ih-lamp-bulb', cx: c, cy: 49, rx: 14, ry: 5 }, node);
    fx.fadeIn(node, at, 0.4);
    onFrame((t) => node.style.transform = `rotate(${(1.2 * Math.sin(t * 1.3)).toFixed(2)}deg)`);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  // ------------------------------------------------------------------
  // Agents: a trench-coat silhouette with a name tag
  // ------------------------------------------------------------------

  /**
   * A secret agent in a fedora, trench coat, and sunglasses, holding a
   * briefcase; sways a little and the lenses glint now and then. tie =
   * hat-band colour (red | gold | cyan). The figure is 160×300 at scale 1.
   */
  function agent(parent, { x, y, scale = 1, name, role, at, until, tie = 'red', briefcase = true, flip = false }) {
    const wrap = place(el('div', 'ih-agent is-staged', parent), x, y);
    wrap.style.width = `${160 * scale}px`;
    const fig = svg('svg', { class: `ih-agent-art ih-agent-art--${tie}`, viewBox: '0 0 160 300', width: 160 * scale, height: 300 * scale, 'aria-hidden': 'true' }, wrap);
    const body = svg('g', { transform: flip ? 'translate(160 0) scale(-1 1)' : '' }, fig);
    const sway = svg('g', {}, body);
    svg('ellipse', { class: 'ih-agent-shadow', cx: 80, cy: 292, rx: 60, ry: 7 }, sway);
    svg('path', { class: 'ih-agent-leg', d: 'M58 262 L60 288 L74 288 L76 262 Z M86 262 L88 288 L102 288 L102 262 Z' }, sway);
    svg('path', { class: 'ih-agent-shoe', d: 'M54 286 H76 Q78 292 72 293 H52 Q50 289 54 286 Z M86 286 H108 Q112 289 110 293 H90 Q84 292 86 286 Z' }, sway);
    svg('path', { class: 'ih-agent-coat', d: 'M44 110 Q52 92 80 90 Q108 92 116 110 L134 266 Q80 278 26 266 Z' }, sway);
    svg('path', { class: 'ih-agent-coat-light', d: 'M80 90 Q108 92 116 110 L134 266 Q110 271 92 272 L88 128 Z' }, sway);
    svg('path', { class: 'ih-agent-lapel', d: 'M64 94 L80 140 L56 112 Z M96 94 L80 140 L104 112 Z' }, sway);
    svg('path', { class: 'ih-agent-shirt', d: 'M70 92 L80 122 L90 92 Z' }, sway);
    svg('path', { class: `ih-agent-tie ih-agent-tie--${tie}`, d: 'M78 98 L82 98 L84 120 L80 128 L76 120 Z' }, sway);
    svg('rect', { class: 'ih-agent-belt', x: 32, y: 182, width: 96, height: 12, rx: 3 }, sway);
    svg('rect', { class: 'ih-agent-buckle', x: 72, y: 180, width: 16, height: 16, rx: 2 }, sway);
    for (const by of [150, 170, 210, 230]) {
      svg('circle', { class: 'ih-agent-button', cx: 68, cy: by, r: 2.6 }, sway);
      svg('circle', { class: 'ih-agent-button', cx: 92, cy: by, r: 2.6 }, sway);
    }
    svg('path', { class: 'ih-agent-coat', d: 'M44 112 Q30 150 30 214 L44 216 Q46 160 56 128 Z' }, sway);
    svg('path', { class: 'ih-agent-coat-light', d: 'M116 112 Q130 150 132 210 L118 214 Q114 160 104 128 Z' }, sway);
    svg('circle', { class: 'ih-agent-hand', cx: 37, cy: 220, r: 7 }, sway);
    svg('circle', { class: 'ih-agent-hand', cx: 125, cy: 216, r: 7 }, sway);
    if (briefcase) {
      svg('path', { class: 'ih-agent-case-handle', d: 'M116 222 Q125 210 134 222' }, sway);
      svg('rect', { class: 'ih-agent-case', x: 104, y: 222, width: 48, height: 34, rx: 4 }, sway);
      svg('rect', { class: 'ih-agent-case-lock', x: 124, y: 228, width: 8, height: 6, rx: 1 }, sway);
    }
    svg('rect', { class: 'ih-agent-neck', x: 72, y: 80, width: 16, height: 14 }, sway);
    svg('path', { class: 'ih-agent-collar', d: 'M56 96 L70 84 L76 104 Z M104 96 L90 84 L84 104 Z' }, sway);
    svg('ellipse', { class: 'ih-agent-face', cx: 80, cy: 64, rx: 19, ry: 22 }, sway);
    svg('path', { class: 'ih-agent-face-shade', d: 'M61 58 Q80 64 99 58 L99 52 L61 52 Z' }, sway);
    svg('path', { class: 'ih-agent-mouth', d: 'M73 78 Q80 81 87 77' }, sway);
    const glasses = svg('g', {}, sway);
    svg('rect', { class: 'ih-agent-lens', x: 63, y: 58, width: 15, height: 9, rx: 3 }, glasses);
    svg('rect', { class: 'ih-agent-lens', x: 82, y: 58, width: 15, height: 9, rx: 3 }, glasses);
    svg('line', { class: 'ih-agent-bridge', x1: 78, y1: 61, x2: 82, y2: 61 }, glasses);
    const glint = svg('line', { class: 'ih-agent-glint', x1: 0, y1: 0, x2: 4, y2: -7, opacity: 0 }, glasses);
    svg('ellipse', { class: 'ih-agent-brim', cx: 80, cy: 50, rx: 40, ry: 8 }, sway);
    svg('path', { class: 'ih-agent-hat', d: 'M56 49 Q56 22 80 20 Q104 22 104 49 Q92 44 80 44 Q68 44 56 49 Z' }, sway);
    svg('path', { class: 'ih-agent-dent', d: 'M70 24 Q80 32 90 24' }, sway);
    svg('path', { class: `ih-agent-band ih-agent-band--${tie}`, d: 'M56 42 Q80 37 104 42 L104 48 Q80 43 56 48 Z' }, sway);
    if (name) {
      const tag = el('div', 'ih-agent-tag', wrap);
      if (role) el('span', 'ih-agent-role', tag, role);
      el('span', 'ih-agent-name', tag, name);
    }
    onFrame((t) => {
      const local = t - at;
      sway.setAttribute('transform', `rotate(${(1.1 * Math.sin(local * 1.7)).toFixed(2)} 80 290)`);
      const cycle = (local % 3.4) / 3.4;
      const on = cycle < 0.18 && local > 0.4;
      glint.setAttribute('opacity', on ? (Math.sin((cycle / 0.18) * Math.PI) * 0.9).toFixed(2) : '0');
      const gx = 64 + 32 * (cycle / 0.18);
      glint.setAttribute('transform', `translate(${gx.toFixed(1)} 66)`);
    });
    fx.rise(wrap, at, { distance: 24, duration: 0.45 });
    if (until !== undefined) fx.fadeOut(wrap, until, 0.3);
    return wrap;
  }

  // ------------------------------------------------------------------
  // The decrypted transmission: Parnas's sentence, line by line
  // ------------------------------------------------------------------

  /**
   * A teleprinter sheet that decrypts each line as it is sung. lines =
   * [{ at, parts: [text | { text, tone, at }] }]: object parts are
   * highlighted with a marker (and underlined) from their own time.
   * Earlier lines dim (still readable) once the next one is sung.
   */
  function transmission(parent, { x, y, w, lines, header, origin, source, sourceAt, stampAt, at, until }) {
    const node = place(el('div', 'ih-trans is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'ih-trans-head', node);
    const live = el('span', 'ih-trans-live', head);
    live.append(icon('file'));
    live.append(document.createTextNode(header));
    if (origin) el('span', 'ih-trans-origin', head, origin);
    lines.forEach((line, i) => {
      const row = el('div', 'ih-trans-line is-staged', node);
      let offset = 0;
      for (const part of line.parts) {
        const text = typeof part === 'string' ? part : part.text;
        const span = el('span', typeof part === 'string' ? null : `ih-mark ih-mark--${part.tone || 'gold'}`, row);
        decrypt(span, text, line.at, { offset, seed: i * 31 + offset });
        if (typeof part !== 'string') during(span, 'is-on', part.at ?? line.at);
        offset += text.length;
      }
      fx.fadeIn(row, line.at - 0.05, 0.15);
      const next = lines[i + 1];
      if (next) during(row, 'is-dim', next.at + 0.2, until ?? Infinity);
    });
    if (source) {
      const src = el('div', 'ih-trans-source is-staged', node, source);
      fx.fadeIn(src, sourceAt ?? at, 0.3);
    }
    if (stampAt !== undefined) {
      const stamp = el('div', 'ih-trans-stamp is-staged', node, 'Decrypted');
      fx.slam(stamp, stampAt, { from: 2.4, rotate: -10 });
    }
    fx.rise(node, at, { distance: 20, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  // ------------------------------------------------------------------
  // Code: a code card (dark), a CRT terminal (green), or a classified file
  // ------------------------------------------------------------------

  /**
   * lines = [{ at, parts: [text | { text, mark: 'red'|'gold'|'green', at, until, cls }] }].
   * variant = 'crt' draws a 1970s green-phosphor terminal; 'classified'
   * adds a red CLASSIFIED header.
   */
  function code(parent, { x, y, w, title, lines, at, until, variant }) {
    const node = place(el('div', `code-card ih-code${variant ? ` ih-code--${variant}` : ''} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    if (title) {
      const bar = el('div', 'code-card-title', node);
      if (variant === 'classified') el('span', 'ih-code-classified', bar, 'Classified');
      bar.append(document.createTextNode(title));
    }
    const rows = lines.map((line) => {
      const row = el('div', `code-line${line.at !== undefined ? ' is-staged' : ''}`, node);
      for (const part of line.parts) {
        if (typeof part === 'string') {
          row.append(document.createTextNode(part));
          continue;
        }
        const classes = [];
        if (part.cls) classes.push(`ih-${part.cls}`);
        if (part.mark) classes.push('ih-code-mark', part.mark === 'red' ? '' : `ih-code-mark--${part.mark}`);
        const span = el('span', classes.filter(Boolean).join(' '), row, part.text);
        if (part.mark && part.at !== undefined) during(span, 'is-on', part.at, part.until);
        if (part.ref) part.ref(span);
      }
      if (line.at !== undefined) fx.rise(row, line.at, { distance: 6, duration: 0.25 });
      return row;
    });
    if (variant === 'crt') el('div', 'ih-scanlines', node);
    fx.rise(node, at, { distance: 18, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return { node, rows };
  }

  // ------------------------------------------------------------------
  // Intercept: a surveillance terminal searching for a word
  // ------------------------------------------------------------------

  /**
   * A green CRT "intercept" console: `query` types into its field, then
   * hits = [{ file, before, match, after }] print one by one while a
   * magnifier sweeps down them; count stamps a total on `countAt`.
   */
  function search(parent, { x, y, w, query, at, typedAt, hits, hitsAt, step = 0.12, count, countAt, until }) {
    const node = place(el('div', 'ih-intercept is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'ih-intercept-head', node);
    const rec = el('span', 'ih-intercept-rec', head);
    rec.append(icon('search'));
    rec.append(document.createTextNode('Intercept'));
    const field = el('span', 'ih-intercept-query', head);
    kit.typewriter(field, `"${query}"`, typedAt ?? at, 14);
    let countNode = null;
    if (count) {
      countNode = el('span', 'ih-intercept-count is-staged', head, count);
      fx.slam(countNode, countAt, { from: 2, rotate: -4 });
    }
    const box = el('div', 'ih-intercept-body', node);
    const rows = hits.map((hit, i) => {
      const row = el('div', 'ih-hit is-staged', box);
      el('span', 'ih-hit-file', row, hit.file);
      const codeNode = el('span', 'ih-hit-code', row);
      codeNode.append(document.createTextNode(hit.before));
      el('mark', null, codeNode, hit.match);
      codeNode.append(document.createTextNode(hit.after));
      fx.fadeIn(row, hitsAt + i * step, 0.08);
      return row;
    });
    el('div', 'ih-scanlines', node);
    // A magnifier sweeps down the hits as they print.
    const lens = svg('svg', { class: 'ih-lens is-staged', viewBox: '0 0 80 80', width: 80, height: 80, 'aria-hidden': 'true' }, node);
    svg('circle', { class: 'ih-lens-glass', cx: 32, cy: 32, r: 22 }, lens);
    svg('path', { class: 'ih-lens-shine', d: 'M18 26 A16 16 0 0 1 30 14' }, lens);
    svg('line', { class: 'ih-lens-handle', x1: 49, y1: 49, x2: 72, y2: 72 }, lens);
    fx.fadeIn(lens, hitsAt, 0.2);
    const sweep = Math.max(0.6, hits.length * step + 0.3);
    onFrame((t) => {
      const p = easeInOutCubic(progress(t, hitsAt, sweep));
      lens.style.transform = `translate(${(w * 0.42 + 120 * Math.sin(p * Math.PI * 2)).toFixed(1)}px, ${(40 + p * (rows.length * 26 - 10)).toFixed(1)}px)`;
    });
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return { node, countNode };
  }

  // ------------------------------------------------------------------
  // The 1960s mainframe whose memory was expensive
  // ------------------------------------------------------------------

  function mainframe(parent, { x, y, at, until }) {
    const node = art(parent, { x, y, w: 230, h: 200, viewBox: '0 0 230 200' });
    svg('rect', { class: 'ih-mf-cabinet', x: 6, y: 8, width: 218, height: 184, rx: 8 }, node);
    svg('rect', { class: 'ih-mf-panel', x: 18, y: 20, width: 194, height: 34, rx: 4 }, node);
    svg('path', { class: 'ih-mf-edge', d: 'M217 12 V185 H12 M11 14 H216' }, node);
    svg('path', { class: 'ih-mf-tape-route', d: 'M62 131 V150 Q63 160 78 160 H152 Q167 160 168 148 V132' }, node);
    const lights = Array.from({ length: 12 }, (_, i) => svg('circle', { class: 'ih-mf-light', cx: 30 + i * 15, cy: 37, r: 4.2 }, node));
    const reels = [62, 168].map((cx) => {
      svg('rect', { class: 'ih-mf-window', x: cx - 44, y: 66, width: 88, height: 88, rx: 6 }, node);
      const reel = svg('g', { transform: `translate(${cx} 110)` }, node);
      svg('circle', { class: 'ih-mf-reel', r: 34 }, reel);
      svg('circle', { class: 'ih-mf-reel-ring', r: 29 }, reel);
      svg('circle', { class: 'ih-mf-tape', r: 22 }, reel);
      for (let k = 0; k < 3; k++) svg('path', { class: 'ih-mf-spoke', d: 'M0 -8 L0 -30', transform: `rotate(${k * 120})` }, reel);
      svg('circle', { class: 'ih-mf-hub', r: 7 }, reel);
      return reel;
    });
    for (let vx = 32; vx < 152; vx += 10) svg('path', { class: 'ih-mf-vent', d: `M${vx} 174 v8` }, node);
    svg('rect', { class: 'ih-mf-slot', x: 170, y: 173, width: 30, height: 10, rx: 2 }, node);
    for (const [sx, sy] of [[13, 15], [217, 15], [13, 184], [217, 184]]) svg('circle', { class: 'ih-mf-screw', cx: sx, cy: sy, r: 2 }, node);
    onFrame((t) => {
      reels.forEach((reel, i) => reel.setAttribute('transform', `translate(${i ? 168 : 62} 110) rotate(${((t * (i ? -70 : 90)) % 360).toFixed(1)})`));
      // Small panel lights change state about twice a second (no flashing area).
      const tick = Math.floor(t * 2);
      lights.forEach((light, i) => light.classList.toggle('is-on', hash01(tick * 31 + i * 7) > 0.45));
    });
    show(node, at, until, { from: 0.7 });
    return node;
  }

  // ------------------------------------------------------------------
  // The detective's corkboard: modules as pinned cards, dependencies as
  // red string; with every pair connected, it knots into a ball of mud
  // ------------------------------------------------------------------

  /** A rounded mass of wet earth, lit from the same upper left as the props. */
  function mudBall(parent, cx, cy) {
    const ball = svg('g', { class: 'ih-mud-ball', transform: `translate(${cx} ${cy})`, opacity: 0 }, parent);
    const gradientId = `ih-mud-light-${++uid}`;
    const gradient = svg('radialGradient', { id: gradientId, gradientUnits: 'userSpaceOnUse', cx: -43, cy: -52, r: 188 }, svg('defs', {}, ball));
    for (const [offset, tone] of [['0%', 'light'], ['48%', 'middle'], ['82%', 'shade'], ['100%', 'edge']]) {
      svg('stop', { offset, class: `ih-mud-tone--${tone}` }, gradient);
    }
    svg('ellipse', { class: 'ih-mud-ground', cx: 8, cy: 111, rx: 123, ry: 16 }, ball);
    for (const [x, y, rx, ry] of [[-121, 93, 7, 4], [128, 97, 6, 4], [-104, 116, 9, 5], [104, 119, 12, 5]]) {
      svg('ellipse', { class: 'ih-mud-clod', cx: x, cy: y, rx, ry }, ball);
    }
    // Small asymmetries break the edge without turning the silhouette into a splat.
    const silhouette = 'M-118 5 C-120 -14 -114 -39 -103 -53 C-102 -67 -89 -83 -75 -86 C-61 -104 -37 -112 -20 -107 C-1 -117 25 -110 39 -104 C59 -105 79 -91 87 -77 C105 -68 114 -49 111 -34 C124 -16 123 7 119 23 C124 44 113 65 99 74 C91 94 72 107 50 106 C31 117 10 117 -7 113 C-28 119 -49 110 -60 103 C-83 102 -99 85 -102 68 C-118 52 -124 28 -118 5 Z';
    const surface = svg('path', { class: 'ih-mud-blob', d: silhouette }, ball);
    surface.style.fill = `url(#${gradientId})`;
    const seams = [
      'M-99 -28 C-91 -51 -70 -54 -57 -49 C-46 -45 -48 -33 -36 -31',
      'M-42 -88 C-26 -97 -8 -88 -2 -78 C6 -64 20 -68 27 -59',
      'M49 -77 C68 -70 77 -56 75 -40 C73 -30 81 -21 92 -17',
      'M-104 28 C-88 35 -75 22 -59 27 C-49 30 -51 46 -35 48',
      'M-15 -24 C-4 -37 20 -32 27 -16 C31 -2 43 -2 50 6',
      'M52 42 C66 28 87 34 91 49 C91 65 80 73 68 75',
      'M-69 70 C-54 60 -39 69 -32 81 C-20 96 1 88 13 95',
    ];
    seams.forEach((d) => svg('path', { class: 'ih-mud-ridge', d }, ball));
    // Earth grains stay on the surface and remain deterministic when seeking.
    for (let i = 0; i < 42; i++) {
      const angle = hash01(i * 17 + 9) * Math.PI * 2;
      const radius = 23 + Math.sqrt(hash01(i * 23 + 5)) * 79;
      svg('ellipse', { class: i % 3 ? 'ih-mud-grain' : 'ih-mud-grain-light', cx: Math.cos(angle) * radius, cy: Math.sin(angle) * radius, rx: 0.8 + hash01(i + 1) * 1.7, ry: 0.7 + hash01(i + 3) }, ball);
    }
    svg('path', { class: 'ih-mud-wet', d: 'M-93 -55 Q-83 -72 -68 -72 M-46 -94 Q-30 -100 -17 -95 M11 -83 Q23 -80 28 -73 M-82 -11 Q-71 -17 -62 -11 M-15 8 Q-5 2 3 7' }, ball);
    return ball;
  }

  /** The same partly buried threads remain visible when the mud is reused. */
  function mudThreads(parent, cx, cy) {
    return [
      'M-105 -20 C-92 -40 -60 -46 -38 -38 M9 -32 C38 -31 61 -25 80 -18',
      'M-78 -78 C-90 -48 -75 -18 -56 -5 M12 26 C43 39 88 47 106 23',
      'M-23 -100 C-33 -76 -19 -53 -5 -39 M32 19 Q44 56 33 85',
      'M76 -71 C58 -67 42 -54 32 -43 M-30 16 Q-58 40 -80 53',
      'M-105 20 Q-71 5 -48 4 M39 20 Q69 35 95 53',
      'M-65 83 Q-43 72 -30 57 M5 33 Q26 23 51 18',
    ].map((d) => svg('path', { class: 'ih-mud-thread', d, transform: `translate(${cx} ${cy})` }, parent));
  }

  /** A compact, labeled-scene companion using the original mud illustration. */
  /**
   * A finished ball of mud. With `from` = [x, y] (stage point of a full-size
   * ball, 1 px per unit), it starts there at full size and moves to its own
   * place over `move` seconds: one ball carried from scene to scene.
   */
  function mud(parent, { x, y, size = 160, at, from, delay = 0.32, move = 0.6 }) {
    const node = art(parent, { x, y, w: size, h: size, viewBox: '-140 -130 280 280' });
    mudBall(node, 0, 0).setAttribute('opacity', '1');
    mudThreads(node, 0, 0).forEach((path) => {
      path.setAttribute('pathLength', '1');
      path.style.strokeDashoffset = '0';
    });
    if (!from) {
      fx.fadeIn(node, at, 0.2);
      return node;
    }
    const ox = size * 0.5;
    const oy = size * (130 / 280);
    node.style.transformOrigin = `${ox}px ${oy}px`;
    const start = { translate: `${(from[0] - x - ox).toFixed(1)}px ${(from[1] - y - oy).toFixed(1)}px`, scale: (280 / size).toFixed(3) };
    tween(node, [{ opacity: 0, ...start }, { opacity: 1, ...start }], at, 0.02, EASE.linear);
    tween(node, [{ opacity: 1, ...start }, { opacity: 1, translate: '0px 0px', scale: '1' }], at + delay, move, EASE.inOut);
    return node;
  }

  /**
   * A framed corkboard (w×h) with `names` pinned around an ellipse, every
   * pair joined by red string (n(n−1)/2 strings) drawn one after another,
   * and a sticky note counting them. mud(at) heaps the cards in the middle
   * and knots the string into a ball of mud.
   */
  function stringWeb(parent, { x, y, w, h, names, at, drawFor = 1.2, until, countLabel = 'connections', title }) {
    const node = place(el('div', 'ih-cork is-staged', parent), x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    if (title) el('div', 'ih-cork-title', node, title);
    const n = names.length;
    const cx = w / 2;
    const cy = h / 2 - 8;
    const rx = w / 2 - (n > 4 ? 76 : 86);
    const ry = h / 2 - (n > 4 ? 62 : 70);
    const cardW = n > 4 ? 100 : 118;
    const spots = names.map((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
    });
    // The string lies over the cards, pin to pin.
    const mud = svg('svg', { class: 'ih-cork-mud', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, node);
    const ball = mudBall(mud, cx, cy + 6);
    const cards = names.map((name, i) => {
      const carrier = el('div', 'ih-pincard-carrier', node);
      const card = place(el('div', 'ih-pincard', carrier), spots[i].x - cardW / 2, spots[i].y - 26);
      card.style.width = `${cardW}px`;
      const tilt = (hash01(i * 13 + n) - 0.5) * 10;
      card.style.rotate = `${tilt.toFixed(1)}deg`;
      const photo = el('span', 'ih-pincard-photo', card);
      photo.append(icon(SERVICE_ICONS[name] || 'box'));
      el('span', 'ih-pincard-name', card, name);
      fx.pop(card, at + 0.05 + i * 0.06, { from: 0.6, rotate: tilt });
      return carrier;
    });
    const strings = svg('svg', { class: 'ih-cork-strings', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, node);
    const pairs = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
    const order = pairs.map((pair, k) => ({ pair, key: hash01(k * 7 + n * 3) })).sort((a, b) => a.key - b.key).map((o) => o.pair);
    const step = drawFor / order.length;
    const yarn = order.map(([i, j], k) => {
      const a = { x: spots[i].x, y: spots[i].y - 22 };
      const b = { x: spots[j].x, y: spots[j].y - 22 };
      const sag = 12 + Math.hypot(b.x - a.x, b.y - a.y) * 0.08;
      const d = `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2 + sag).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
      const shadow = svg('path', { class: 'ih-yarn-shadow', d, transform: 'translate(2 3)' }, strings);
      const path = svg('path', { class: 'ih-yarn', d }, strings);
      const starts = at + 0.35 + k * step;
      fx.draw(shadow, starts, Math.max(0.12, step * 1.6));
      fx.draw(path, starts, Math.max(0.12, step * 1.6));
      return { path, shadow, starts, i, j, sag };
    });
    const pins = spots.map((s, i) => {
      const pin = svg('g', { transform: `translate(${s.x.toFixed(1)} ${(s.y - 22).toFixed(1)})` }, strings);
      const head = svg('g', {}, pin);
      svg('circle', { class: 'ih-pin', r: 6.5 }, head);
      svg('circle', { class: 'ih-pin-shine', cx: -2, cy: -2, r: 2 }, head);
      fx.pop(head, at + 0.1 + i * 0.06, { from: 0.4 });
      return pin;
    });
    const knot = svg('g', { class: 'ih-knot', opacity: 0 }, strings);
    const loops = mudThreads(knot, cx, cy + 6);
    const note = place(el('div', 'ih-sticky is-staged', node), w - 140, n > 4 ? 0 : h - 88);
    const count = el('b', null, note, '0');
    el('span', null, note, countLabel);
    fx.pop(note, at + 0.3, { from: 0.5, rotate: 4 });
    onFrame((t) => {
      const shown = yarn.filter((s) => t >= s.starts).length;
      const text = String(shown);
      if (count.textContent !== text) count.textContent = text;
    });
    fx.fadeIn(node, at, 0.3);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return {
      node,
      /** Hides the finished ball at `at` (a carried copy takes its place). */
      handOff(at) {
        for (const part of [ball, knot]) tween(part, { opacity: 0 }, at, 0.03, EASE.linear);
        return this;
      },
      /**
       * Everything depends on everything, then it all collapses into one
       * ball of mud. From `strainFrom` the strings pull taut and the cards
       * tremble harder; at `when` the cards are yanked onto a growing ball,
       * which lands with a squash and splatter on `impact`; then the cards
       * sink in and the strings knot across its surface. Every pose is a
       * pure function of song time (reduced motion skips the trembling and
       * jumps from net to ball).
       */
      mud(when, { strainFrom = when } = {}) {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const IMPACT = 1.0;   // seconds after `when` that the ball lands
        const DURATION = 1.7;
        const ringX = 92;     // cards land on the ball's surface, not a dot
        const ringY = 70;
        const bx = cx;
        const by = cy + 6;
        tween(note, { opacity: 0 }, when, 0.25, EASE.in);
        loops.forEach((path) => path.setAttribute('pathLength', '1'));
        // Mud splatter: drops fly out on impact and stay on the cork as stains.
        const splats = Array.from({ length: 11 }, (_, i) => {
          const angle = -Math.PI + (i / 10) * Math.PI * 1.0 + (hash01(i * 19 + 4) - 0.5) * 0.5;
          const reach = 150 + hash01(i * 7 + 2) * 70;
          const drop = svg('ellipse', { class: 'ih-mud-splat', rx: 5 + hash01(i * 3) * 6, ry: 3.5 + hash01(i * 5) * 3, opacity: 0 }, mud);
          return { drop, angle, reach };
        });
        const ring = svg('ellipse', { class: 'ih-mud-shock', cx: bx, cy: by + 112, rx: 10, ry: 3, opacity: 0 }, mud);
        mud.insertBefore(ring, mud.firstChild);
        const easeIn = (p) => p * p * p;
        let previous;
        onFrame((t) => {
          const reduce = reducedMotion.matches;
          const elapsed = reduce ? (t >= when ? DURATION : 0) : Math.max(0, Math.min(DURATION, t - when));
          const strain = reduce || t < strainFrom ? 0 : Math.min(1, (t - strainFrom) / Math.max(0.01, when - strainFrom));
          const key = `${elapsed.toFixed(3)}|${elapsed > 0 || strain === 0 ? 0 : t.toFixed(3)}`;
          if (key === previous) return;
          previous = key;
          const gather = easeIn(progress(elapsed, 0.05, IMPACT - 0.05));
          const sink = easeInOutCubic(progress(elapsed, IMPACT + 0.1, 0.45));
          const shake = strain * strain * (1 - gather) * 3.2;
          const poses = spots.map((spot, i) => {
            const angle = -Math.PI / 2 + i * 2 * Math.PI / n + gather * 0.6;
            const pull = 1 - 0.05 * strain;
            const rX = (rx * pull) * (1 - gather) + ringX * (1 - 0.45 * sink) * gather;
            const rY = (ry * pull) * (1 - gather) + ringY * (1 - 0.45 * sink) * gather;
            return {
              x: bx + Math.cos(angle) * rX + shake * Math.sin(t * 37 + i * 1.7),
              y: (cy - 22) * (1 - gather) + by * gather + Math.sin(angle) * rY + shake * Math.cos(t * 31 + i * 2.3),
            };
          });
          cards.forEach((carrier, i) => {
            const pinX = spots[i].x;
            const pinY = spots[i].y - 22;
            const scale = (1 - 0.5 * gather) * (1 - 0.45 * sink);
            const rotation = gather * (24 + (hash01(i * 47) - 0.5) * 50) + shake * 1.4 * Math.sin(t * 23 + i);
            carrier.style.transform = `translate(${poses[i].x - pinX}px, ${poses[i].y - pinY}px) translate(${pinX}px, ${pinY}px) rotate(${rotation}deg) scale(${scale}) translate(${-pinX}px, ${-pinY}px)`;
            carrier.style.opacity = String(1 - sink);
            pins[i].setAttribute('transform', `translate(${poses[i].x} ${poses[i].y}) scale(${1 - 0.5 * gather})`);
            pins[i].setAttribute('opacity', String(1 - sink));
          });
          yarn.forEach(({ path, shadow, i, j, sag }, k) => {
            const a = poses[i];
            const b = poses[j];
            // Taut under strain, then wrapped around the ball as it forms.
            const curl = Math.sin(Math.PI * Math.min(1, gather * 1.2)) * (k % 2 ? 38 : -38);
            const bend = sag * (1 - 0.75 * strain) * (1 - gather);
            const d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${((a.x + b.x) / 2 + curl).toFixed(1)} ${((a.y + b.y) / 2 + bend + curl * 0.6).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
            for (const strand of [path, shadow]) {
              strand.setAttribute('d', d);
              strand.style.opacity = String(1 - sink);
            }
          });
          // The ball grows under the incoming cards and lands with a squash.
          const size = 0.25 + 0.75 * easeInOutCubic(progress(elapsed, 0.15, IMPACT - 0.15));
          const after = progress(elapsed, IMPACT, 0.6);
          const wobble = elapsed < IMPACT ? 0 : Math.sin(after * Math.PI * 3) * Math.exp(-4 * after) * 0.12;
          ball.setAttribute('opacity', String(progress(elapsed, 0.15, 0.2)));
          ball.setAttribute('transform', `translate(${bx} ${by + 110 * (1 - size)}) scale(${(size * (1 + wobble)).toFixed(4)} ${(size * (1 - wobble)).toFixed(4)})`);
          knot.setAttribute('opacity', String(progress(elapsed, IMPACT, 0.3)));
          loops.forEach((path, k) => {
            path.style.strokeDashoffset = String(1 - easeInOutCubic(progress(elapsed, IMPACT + 0.05 + k * 0.03, 0.45)));
          });
          const fly = progress(elapsed, IMPACT, 0.45);
          splats.forEach(({ drop, angle, reach }) => {
            const r = 60 + (reach - 60) * easeInOutCubic(fly);
            const lift = Math.sin(fly * Math.PI) * 26;
            drop.setAttribute('cx', (bx + Math.cos(angle) * r).toFixed(1));
            drop.setAttribute('cy', (by + 40 + Math.sin(angle) * r * 0.55 - lift + 70 * fly).toFixed(1));
            drop.setAttribute('opacity', elapsed < IMPACT ? '0' : '0.85');
          });
          const wave = progress(elapsed, IMPACT, 0.5);
          ring.setAttribute('rx', (40 + 150 * wave).toFixed(1));
          ring.setAttribute('ry', (6 + 18 * wave).toFixed(1));
          ring.setAttribute('opacity', elapsed < IMPACT ? '0' : (0.5 * (1 - wave)).toFixed(2));
        });
        /** Song time the ball lands, and its centre in the board's own frame. */
        this.impact = when + IMPACT;
        this.ballCenter = [bx, by];
        return this;
      },
    };
  }

  // ------------------------------------------------------------------
  // Bugs: a beetle that crawls in; squash(at) flattens it
  // ------------------------------------------------------------------

  function bug(parent, { x, y, at, squashAt, until, size = 64, rotate = 0, from }) {
    const node = art(parent, { x, y, w: size, h: size, viewBox: '0 0 64 64' });
    node.style.rotate = `${rotate}deg`;
    const body = svg('g', {}, node);
    const legs = [];
    for (const side of [-1, 1]) {
      const limb = svg('g', { transform: `translate(32 0) scale(${side} 1)` }, body);
      for (const [k, d] of [
        'M10 28 Q18 25 20 18 Q21 15 24 15',
        'M13 37 Q22 35 25 39 L27 44',
        'M11 46 Q19 48 19 54 L23 58',
      ].entries()) {
        legs.push({ g: svg('path', { class: 'ih-bug-leg', d }, limb), side, k });
      }
    }
    svg('path', { class: 'ih-bug-antenna', d: 'M28 15 C27 9 24 5 20 5 M36 15 C37 9 40 5 44 5' }, body);
    svg('path', { class: 'ih-bug-head', d: 'M24 20 C22 9 42 9 40 20 L38 27 H26 Z' }, body);
    svg('path', { class: 'ih-bug-body', d: 'M32 23 C20 20 16 31 17 40 C18 51 24 57 32 58 C40 57 46 51 47 40 C48 31 44 20 32 23 Z' }, body);
    svg('path', { class: 'ih-bug-shadow', d: 'M39 25 C48 35 44 50 32 56 L32 58 C42 56 47 49 47 39 C47 32 44 27 39 25 Z' }, body);
    svg('path', { class: 'ih-bug-shell-line', d: 'M32 25 C31 37 31 49 32 56' }, body);
    svg('path', { class: 'ih-bug-shine', d: 'M21 34 C21 28 25 25 28 27 C29 29 25 30 24 35 C23 38 20 38 21 34 Z' }, body);
    for (const side of [-1, 1]) {
      svg('ellipse', { class: 'ih-bug-eye', cx: 32 + side * 5, cy: 17, rx: 1.5, ry: 2 }, body);
      for (const [dx, cy, r] of [[7, 39, 2.8], [5, 49, 2.1]]) {
        svg('circle', { class: 'ih-bug-spot', cx: 32 + side * dx, cy, r }, body);
      }
    }
    show(node, at, until, { from: 0.3 });
    const squashed = squashAt ?? Infinity;
    onFrame((t) => {
      const crawling = t >= at && t < squashed;
      legs.forEach(({ g, side, k }) => {
        const wiggle = crawling ? 14 * Math.sin(t * 16 + k * 2.1 + (side > 0 ? Math.PI : 0)) : 0;
        g.setAttribute('transform', `rotate(${wiggle.toFixed(1)} 10 36)`);
      });
      if (from) {
        const p = easeInOutCubic(progress(t, at, 0.9));
        node.style.translate = `${((from[0] - x) * (1 - p)).toFixed(1)}px ${((from[1] - y) * (1 - p)).toFixed(1)}px`;
      }
    });
    if (squashAt !== undefined) {
      body.style.transformOrigin = '32px 54px';
      tween(body, [{ scale: '1 1' }, { scale: '1.3 0.12' }], squashAt, 0.15, EASE.in);
    }
    return node;
  }

  /** The rubber meets the target at `at`, presses to baseline (x, y) in 0.15 s, then lifts. */
  function stampTool(parent, { x, y, at, label = 'FIXED', pressDepth = 0 }) {
    const node = art(parent, { x: x - 45, y: y - 120, w: 90, h: 120, viewBox: '0 0 90 120' });
    svg('ellipse', { class: 'ih-stamp-knob', cx: 45, cy: 16, rx: 16, ry: 12 }, node);
    svg('rect', { class: 'ih-stamp-neck', x: 39, y: 24, width: 12, height: 40 }, node);
    svg('rect', { class: 'ih-stamp-block', x: 14, y: 62, width: 62, height: 30, rx: 4 }, node);
    svg('rect', { class: 'ih-stamp-rubber', x: 16, y: 92, width: 58, height: 10, rx: 2 }, node);
    const text = svg('text', { class: 'ih-stamp-label', x: 45, y: 82, 'text-anchor': 'middle' }, node);
    text.textContent = label;
    tween(node, [
      { opacity: 0, translate: '0 -90px' },
      { opacity: 1, translate: `0 ${18 - pressDepth}px`, offset: 0.35 / 1.1 },
      { opacity: 1, translate: '0 18px', offset: 0.5 / 1.1 },
      { opacity: 1, translate: '0 18px', offset: 0.7 / 1.1 },
      { opacity: 0, translate: '0 -80px' },
    ], at - 0.35, 1.1, EASE.linear);
    return node;
  }

  // ------------------------------------------------------------------
  // A grid of small case files (the programs or files a change touches)
  // ------------------------------------------------------------------

  /**
   * names in a grid of small manila files. tag = text of a red tab every
   * file carries from tagAt (a copied secret). light(at, indices, { tone,
   * stamp }) marks the files a change touches: tone = hit (red) | change
   * (gold) | good (green), with an optional rubber-stamp word.
   */
  function grid(parent, { x, y, cols, cellW = 150, cellH = 40, gap = 10, names, at, step = 0.04, until, tag, tagAt, tagStep = 0.06 }) {
    const cells = names.map((name, i) => {
      const cell = place(el('div', 'ih-cell is-staged', parent), x + (i % cols) * (cellW + gap), y + Math.floor(i / cols) * (cellH + gap));
      cell.style.width = `${cellW}px`;
      cell.style.height = `${cellH}px`;
      el('span', 'ih-cell-tab', cell);
      el('span', 'ih-cell-name', cell, name);
      if (tag) {
        const chip = el('span', 'ih-cell-secret is-staged', cell);
        chip.append(icon('lock'));
        chip.append(document.createTextNode(tag));
        fx.pop(chip, tagAt + i * tagStep, { from: 1.8, rotate: -6 });
      }
      fx.pop(cell, at + i * step, { from: 0.7 });
      if (until !== undefined) fx.fadeOut(cell, until, 0.25);
      return cell;
    });
    return {
      cells,
      light(when, indices, { tone = 'hit', until: gone, step: s = 0.05, stamp } = {}) {
        indices.forEach((index, k) => {
          const t0 = when + k * s;
          during(cells[index], `is-${tone}`, t0, gone);
          if (stamp) {
            const mark = el('span', `ih-cell-stamp ih-cell-stamp--${tone} is-staged`, cells[index], stamp);
            fx.slam(mark, t0, { from: 2, rotate: -8 });
            if (gone !== undefined) fx.fadeOut(mark, gone, 0.2);
          }
        });
        return this;
      },
    };
  }

  // ------------------------------------------------------------------
  // The vault: a module whose nameplate (what) hides its contents (how)
  // ------------------------------------------------------------------

  /**
   * One module drawn as a steel vault. Its brass nameplate is the interface
   * (what callers may read, gold); an X-ray window shows the secret inside
   * (how it keeps that promise, blue). hows = [{ at, text }] changes the
   * secret: the dial spins and the new secret decrypts in place; the
   * nameplate never changes.
   */
  function vault(parent, { x, y, w = 440, name, what, hows, at, whatAt, howAt, until }) {
    const node = place(el('div', 'ih-vault is-staged', parent), x, y);
    node.style.width = `${w}px`;
    for (const corner of ['tl', 'tr', 'bl', 'br']) el('span', `ih-vault-rivet ih-vault-rivet--${corner}`, node);
    const head = el('div', 'ih-vault-head', node);
    head.append(icon(SERVICE_ICONS[name] || 'box'));
    el('span', 'ih-module-name', head, name);
    el('span', 'ih-vault-class', head, 'Module');
    const dial = svg('svg', { class: 'ih-vault-dial', viewBox: '-50 -50 100 100', width: 96, height: 96, 'aria-hidden': 'true' }, node);
    svg('circle', { class: 'ih-dial-ring', r: 46 }, dial);
    const face = svg('g', {}, dial);
    svg('circle', { class: 'ih-dial-face', r: 36 }, face);
    for (let i = 0; i < 24; i++) svg('line', { class: 'ih-dial-tick', x1: 0, y1: -36, x2: 0, y2: i % 6 ? -31 : -27, transform: `rotate(${i * 15})` }, face);
    svg('circle', { class: 'ih-dial-knob', r: 14 }, face);
    svg('line', { class: 'ih-dial-pointer', x1: 0, y1: -12, x2: 0, y2: -22 }, face);
    svg('path', { class: 'ih-dial-mark', d: 'M-4 -48 L4 -48 L0 -41 Z' }, dial);
    const handle = svg('svg', { class: 'ih-vault-handle', viewBox: '0 0 20 90', width: 20, height: 90, 'aria-hidden': 'true' }, node);
    svg('rect', { x: 6, y: 0, width: 8, height: 90, rx: 4 }, handle);
    const plate = el('div', 'ih-vault-plate', node);
    const whatTag = el('div', 'ih-vault-tag ih-vault-tag--what is-staged', plate);
    whatTag.append(icon('eye'));
    whatTag.append(document.createTextNode('What · the interface'));
    el('div', 'ih-vault-what', plate, what);
    const windowNode = el('div', 'ih-vault-window', node);
    const howTag = el('div', 'ih-vault-tag ih-vault-tag--how is-staged', windowNode);
    howTag.append(icon('lock'));
    howTag.append(document.createTextNode('How · the secret'));
    const howRow = el('div', 'ih-vault-how', windowNode);
    howRow.append(icon('envelope'));
    const steps = [...hows].sort((a, b) => a.at - b.at);
    steps.forEach((step, i) => {
      const span = el('span', 'ih-vault-secret', howRow);
      decrypt(span, step.text, i ? step.at : -1, { cps: 40, seed: 77 + i });
      const next = steps[i + 1];
      onFrame((t) => { span.hidden = t < (i ? step.at : -Infinity) || (next && t >= next.at); });
    });
    onFrame((t) => {
      let angle = 12 * Math.sin(t * 0.8);
      for (const step of steps.slice(1)) angle += 540 * easeInOutCubic(progress(t, step.at - 0.45, 0.8));
      face.setAttribute('transform', `rotate(${angle.toFixed(1)})`);
    });
    for (const step of steps.slice(1)) fx.bump(windowNode, step.at, 0.05);
    fx.pop(whatTag, whatAt ?? at, { from: 0.6, rotate: -2 });
    fx.pop(howTag, howAt ?? at, { from: 0.6, rotate: 2 });
    fx.rise(node, at, { distance: 18, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return {
      node,
      /** A check on the nameplate: the interface stayed the same. */
      keep(when, text = 'kept') {
        const tag = el('div', 'ih-verdict ih-verdict--ok ih-vault-keep is-staged', plate);
        tag.append(icon('check'));
        tag.append(document.createTextNode(text));
        show(tag, when, undefined, { rotate: 4, from: 1.5 });
        return tag;
      },
      light(when, gone) {
        const glow = el('div', 'ih-module-glow is-staged', node);
        tween(glow, [{ opacity: 0 }, { opacity: 1 }], when, 0.18, EASE.out);
        fx.bump(node, when, 0.04);
        if (gone !== undefined) tween(glow, { opacity: 0 }, gone, 0.3, EASE.in);
      },
    };
  }

  // ------------------------------------------------------------------
  // A sonar submarine that reveals what is below the waterline
  // ------------------------------------------------------------------

  function submarine(parent, { x, y, at, until, pingFrom }) {
    const node = art(parent, { x, y, w: 150, h: 80, viewBox: '0 0 150 80' });
    const rings = svg('g', {}, node);
    const ringNodes = [0, 1, 2].map(() => svg('circle', { class: 'ih-sonar', cx: 10, cy: 48, r: 4 }, rings));
    svg('rect', { class: 'ih-sub-tower', x: 64, y: 18, width: 26, height: 20, rx: 6 }, node);
    svg('path', { class: 'ih-sub-scope', d: 'M80 18 V4 H92' }, node);
    svg('path', { class: 'ih-sub-fin', d: 'M114 36 L131 25 L127 45 L132 70 L113 60 Z' }, node);
    svg('rect', { class: 'ih-sub-hull', x: 14, y: 34, width: 120, height: 30, rx: 15 }, node);
    svg('path', { class: 'ih-sub-shade', d: 'M16 53 Q73 64 132 52 Q130 64 119 64 H29 Q19 64 16 53 Z' }, node);
    svg('path', { class: 'ih-sub-highlight', d: 'M30 39 H109 M70 23 H82' }, node);
    for (const px of [44, 70, 96]) {
      svg('circle', { class: 'ih-sub-port-rim', cx: px, cy: 49, r: 6.5 }, node);
      svg('circle', { class: 'ih-sub-port', cx: px, cy: 49, r: 4.5 }, node);
      svg('path', { class: 'ih-sub-glass', d: `M${px - 2} 50 l3 -3` }, node);
    }
    const prop = svg('g', { transform: 'translate(138 49)' }, node);
    svg('path', { class: 'ih-sub-prop', d: 'M0 -11 L4 0 L0 11 L-4 0 Z' }, prop);
    onFrame((t) => {
      prop.setAttribute('transform', `translate(138 49) scale(1 ${Math.cos(t * 9).toFixed(2)})`);
      ringNodes.forEach((ring, i) => {
        const age = t - (pingFrom ?? at) - i * 0.9;
        const p = age < 0 ? -1 : (age % 2.7) / 2.7;
        ring.setAttribute('r', p < 0 ? '0' : (6 + p * 120).toFixed(1));
        ring.setAttribute('opacity', p < 0 ? '0' : (0.55 * (1 - p)).toFixed(2));
      });
      node.style.translate = `0 ${(3 * Math.sin(t * 1.1)).toFixed(1)}px`;
    });
    show(node, at, until, { from: 0.6 });
    return node;
  }

  /** A paper slip sliding out of `parent` along (dx, dy): something that leaks. */
  function slip(parent, { x, y, text, at, dx, dy, rotate = 12 }) {
    const node = place(el('div', 'ih-slip is-staged', parent), x, y);
    node.append(icon('file'));
    node.append(document.createTextNode(text));
    tween(node, [
      { opacity: 0, translate: '0 0', rotate: '0deg' },
      { opacity: 1, translate: `${dx * 0.2}px ${dy * 0.2}px`, rotate: `${rotate / 3}deg`, offset: 0.25 },
      { opacity: 1, translate: `${dx}px ${dy}px`, rotate: `${rotate}deg` },
    ], at, 0.9, EASE.out);
    return node;
  }

  // ------------------------------------------------------------------
  // The spy-film ending: an iris that closes on the hero
  // ------------------------------------------------------------------

  /**
   * A black stage-sized mask with a circular opening centred on (cx, cy)
   * that shrinks from `startR` to 0 over [from, to]. One smooth darkening,
   * never a flash (WCAG 2.3.1). A thin gold ring traces the opening.
   */
  function iris(parent, { cx, cy, from, to, startR = 640 }) {
    const node = svg('svg', { class: 'ih-iris', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    const mask = svg('path', { class: 'ih-iris-mask', 'fill-rule': 'evenodd' }, node);
    const ring = svg('circle', { class: 'ih-iris-ring', cx, cy }, node);
    onFrame((t) => {
      if (t < from) {
        node.style.display = 'none';
        return;
      }
      node.style.display = '';
      const r = startR * (1 - easeInOutCubic(progress(t, from, to - from)));
      mask.setAttribute('d', `M-10 -10H970V550H-10Z M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0Z`);
      ring.setAttribute('r', Math.max(0, r).toFixed(1));
      ring.setAttribute('opacity', r > 2 ? '1' : '0');
    });
    return node;
  }

  window.InfoHidingKit = {
    latest, show, during, note, heading, paper, list, bubble, digits, clock, counter,
    apolloPortrait, car, overflowingHead, steps, calendar, iceberg, bergLabel, toggle, waterline, outlet, dossier,
    decrypt, module, envelope, courier, laser, spotlight, lamp, agent, transmission, code, search,
    mainframe, stringWeb, mud, bug, stampTool, grid, vault, submarine, slip, iris,
  };
})();
