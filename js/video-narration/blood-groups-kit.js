/*
 * Artwork for the Module Blood Groups video narration (choreography:
 * js/video-narration/blood-groups.js; styles: css/video-narration-blood-
 * groups.css). It builds on the shared wall kit (js/video-narration/
 * wall-kit.js) and adds the lesson's own objects, each a metaphor whose
 * mapping holds for the idea it teaches:
 *
 *   a module's group is a blood drop with its letter: A (application) blue,
 *     T (technology) amber, 0 (neither) paper white, and AT split down the
 *     middle, half blue and half amber, because it knows both; R, the thin
 *     translator, is violet. The letter is always written, so nothing
 *     depends on color, and pills carry the same letter and paint inline;
 *   a module is a paper card with its drop in the corner; code is a dark
 *     editor card whose gutter tags each line Rule or Tech in words, with two
 *     threads that braid down the gutter where the tags alternate;
 *   a change (technology, rule, or reuse) is a card that travels to the code
 *     it hits, and a reuse chart answers Yes or No for four places;
 *   mixing happens in a flask whose tag names the result, beside equation
 *     cards built from the same pills;
 *   an interface the A side owns is a socket on its card, and technology
 *     plugs into it through a dongle: a thin adapter, AT, later tagged R;
 *   Glide itself is a paper campus map with parking zones, a scooter that
 *     rides it, and a phone that says No parking here.
 *
 * Every builder schedules its own motion on the Timeline, and every pose is a
 * pure function of narration time. Coordinates are CSS pixels inside the
 * picture's 960x540 body.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, progress, easeInOutCubic } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, icon } = kit;
  const wall = window.WallKit;
  const { staged, appear } = wall;

  /** The entry of a time-sorted list in force at t (the first one before any). */
  function latest(entries, t) {
    let found = entries[0];
    for (const entry of entries) if (entry.at <= t) found = entry;
    return found;
  }

  /** Shows `node` from `at` with `how`, and hides it again at `until`. */
  function show(node, at, until, how = 'pop') {
    if (how === 'rise') fx.rise(node, at, { distance: 16, duration: 0.4 });
    else if (how === 'fade') fx.fadeIn(node, at, 0.35);
    else if (how === 'slide') fx.slideIn(node, at, { dx: 60, duration: 0.45 });
    else fx.pop(node, at, { from: 0.6 });
    if (until !== undefined) fx.fadeOut(node, until - 0.25, 0.25);
    return node;
  }

  // ------------------------------------------------------------------
  // Groups: drops and pills
  // ------------------------------------------------------------------

  const DROP_PATHS = {
    left: 'M50 4 C50 4 12 52 12 76 A38 38 0 0 0 50 114 Z',
    right: 'M50 4 C50 4 88 52 88 76 A38 38 0 0 1 50 114 Z',
    outline: 'M50 4 C50 4 88 52 88 76 A38 38 0 0 1 12 76 C12 52 50 4 50 4 Z',
  };

  /** States of something whose group changes over time: [{ at, group }]. */
  function groupStates(group, changes = []) {
    return [{ at: -Infinity, group: String(group) }, ...changes.map(({ at, group: next }) => ({ at, group: String(next) }))]
      .sort((a, b) => a.at - b.at);
  }

  /**
   * The state class that paints a group: bg-group--a, --t, --at, --0, --r,
   * or --unknown for '?'. A class, not an attribute, so the rounded-surface
   * repaint (js/song-video/rounded-surfaces.js) follows a regrouping.
   */
  function groupClass(group) {
    return `bg-group--${group === '?' ? 'unknown' : group.toLowerCase()}`;
  }

  /** Paints the group in force at each frame onto `node` and writes its letter into `letter`. */
  function trackGroup(node, letter, states) {
    let shown;
    const update = (t) => {
      const { group } = latest(states, t);
      if (group === shown) return;
      if (shown !== undefined) node.classList.remove(groupClass(shown));
      node.classList.add(groupClass(group));
      shown = group;
      letter.textContent = group;
    };
    update(-Infinity);
    onFrame(update);
  }

  /**
   * A blood drop naming a group: 'A', 'T', 'AT', '0', or 'R'. `size` is its
   * width (the letter scales with it); `changes` = [{ at, group }] regroups it
   * later, with a bump.
   */
  function drop(parent, { x, y, group, size = 60, at, until, changes = [] }) {
    const node = staged(parent, 'bg-drop', x, y);
    node.style.setProperty('--drop', `${size}px`);
    const art = svg('svg', { viewBox: '0 0 100 118', class: 'bg-drop-art', 'aria-hidden': 'true' }, node);
    svg('path', { d: DROP_PATHS.left, class: 'bg-drop-half bg-drop-half--left' }, art);
    svg('path', { d: DROP_PATHS.right, class: 'bg-drop-half bg-drop-half--right' }, art);
    svg('path', { d: DROP_PATHS.outline, class: 'bg-drop-outline' }, art);
    trackGroup(node, el('span', 'bg-drop-letter', node), groupStates(group, changes));
    changes.forEach(({ at: when }) => fx.bump(node, when, 0.2));
    appear(node, at, until, { from: 0.4 });
    return node;
  }

  /** A pill with a group's letter and paint, for equations and small tags. */
  function pill(parent, { x, y, group, at, until, changes = [] }) {
    const node = staged(parent, 'bg-pill', x, y);
    trackGroup(node, node, groupStates(group, changes));
    changes.forEach(({ at: when }) => fx.bump(node, when, 0.2));
    if (at === undefined) node.classList.remove('is-staged');
    else appear(node, at, until, { from: 0.4 });
    return node;
  }

  // ------------------------------------------------------------------
  // Modules and code
  // ------------------------------------------------------------------

  /** A line of Python, highlighted, into `parent`. */
  function codeLine(parent, code, className = '') {
    const line = el('div', `code-line bg-code-text${className ? ` ${className}` : ''}`, parent);
    kit.writeCode(line, kit.highlightPython(code));
    return line;
  }

  /**
   * A module on paper: its title, its group's drop in the top-right corner
   * (none when `group` is undefined, as before the groups are introduced;
   * a pill under the title when `mark` is 'pill', for narrow cards),
   * and optional lines of text ({ text, at }), a dark code snippet
   * ({ lines: [code], at, lineAt }), and chips ({ text, tone: a, t, or zero,
   * at }). `changes` regroups the drop. Returns { node, drop, snippet }.
   */
  function moduleCard(parent, { x, y, w, h, title, group, changes, lines = [], snippet, chips = [], at, until, how = 'rise', mark = 'drop' }) {
    const plain = group === undefined || mark === 'pill';
    const node = staged(parent, `bg-module${plain ? ' bg-module--plain' : ''}${mark === 'pill' ? ' bg-module--compact' : ''}`, x, y);
    node.style.width = `${w}px`;
    if (h) node.style.height = `${h}px`;
    el('p', 'bg-module-title', node, title);
    let badge = null;
    if (group !== undefined && mark === 'pill') badge = pill(el('div', 'bg-module-mark', node), { x: 0, y: 0, group, changes });
    else if (group !== undefined) badge = drop(node, { x: w - 66, y: 6, group, size: 54, at: at + 0.15, changes });
    lines.forEach(({ text, at: lineAt = at }) => {
      const line = el('p', 'bg-module-line is-staged', node, text);
      fx.rise(line, lineAt, { distance: 8, duration: 0.3 });
    });
    let block;
    if (snippet) {
      block = el('div', 'bg-snippet is-staged', node);
      snippet.lines.forEach((code, i) => {
        const line = codeLine(block, code);
        if (snippet.lineAt && snippet.lineAt[i] !== undefined) {
          line.classList.add('is-staged');
          fx.rise(line, snippet.lineAt[i], { distance: 6, duration: 0.3 });
        }
      });
      fx.fadeIn(block, snippet.at ?? at, 0.3);
    }
    if (chips.length) {
      const row = el('div', 'bg-chips', node);
      chips.forEach(({ text, tone, at: chipAt = at }) => fx.pop(el('span', `bg-chip${tone ? ` bg-chip--${tone}` : ''} is-staged`, row, text), chipAt, { from: 0.5 }));
    }
    show(node, at, until, how);
    return { node, drop: badge, snippet: block };
  }

  const TAG_WORDS = { rule: 'Rule', tech: 'Tech', both: 'Rule + tech' };

  /**
   * A dark editor card. lines = [{ code, tag, at }]: each line is highlighted
   * Python; `tag` (rule, tech, or both) is written in the gutter from `tagsAt`.
   * `braidAt` draws two threads that braid down the gutter. Returns the card
   * and its rows (for lighting them with WallKit.lit).
   */
  function codeCard(parent, { x, y, w, title, lines, at, until, tagsAt, braidAt, how = 'rise' }) {
    const node = staged(parent, 'code-card bg-code', x, y);
    node.style.width = `${w}px`;
    el('div', 'code-card-title bg-code-title', node, title);
    const body = el('div', 'bg-code-body', node);
    if (braidAt !== undefined) braid(body, { rows: lines.length, at: braidAt });
    const rows = lines.map(({ code, tag, at: lineAt }, i) => {
      const row = el('div', 'bg-code-row', body);
      const gutter = el('span', 'bg-code-gutter', row);
      if (tag && tagsAt !== undefined) {
        const word = el('span', `bg-tag bg-tag--${tag} is-staged`, gutter, TAG_WORDS[tag]);
        fx.pop(word, tagsAt + i * 0.12, { from: 0.5 });
      }
      codeLine(row, code);
      if (lineAt !== undefined) {
        row.classList.add('is-staged');
        fx.rise(row, lineAt, { distance: 6, duration: 0.25 });
      }
      return row;
    });
    show(node, at, until, how);
    return { node, rows };
  }

  /** Two threads, rule and tech, braiding down a code card's gutter. */
  function braid(parent, { rows, at }) {
    const height = rows * 32;
    const art = svg('svg', { class: 'bg-braid', viewBox: `0 0 24 ${height}`, width: 24, height, 'aria-hidden': 'true' }, parent);
    [0, 1].forEach((strand) => {
      let d = `M ${strand ? 18 : 6} 0`;
      for (let i = 0; i < rows; i += 1) {
        const from = (i + strand) % 2 ? 18 : 6;
        const to = 24 - from;
        d += ` C ${from} ${i * 32 + 16}, ${to} ${i * 32 + 16}, ${to} ${(i + 1) * 32}`;
      }
      const path = svg('path', { d, class: `bg-braid-strand bg-braid-strand--${strand ? 'tech' : 'rule'}` }, art);
      fx.draw(path, at + strand * 0.2, 1.2);
    });
    return art;
  }

  /** A short code block on its own dark card (no gutter), such as a signature. */
  function snippetCard(parent, { x, y, w, title, lines, at, until, how = 'rise' }) {
    const node = staged(parent, 'code-card bg-code bg-code--plain', x, y);
    if (w) node.style.width = `${w}px`;
    if (title) el('div', 'code-card-title bg-code-title', node, title);
    const body = el('div', 'bg-code-body', node);
    const rows = lines.map((line) => {
      const { code, at: lineAt } = typeof line === 'string' ? { code: line } : line;
      const row = codeLine(body, code, 'bg-code-text--plain');
      if (lineAt !== undefined) {
        row.classList.add('is-staged');
        fx.rise(row, lineAt, { distance: 6, duration: 0.3 });
      }
      return row;
    });
    show(node, at, until, how);
    return { node, rows };
  }

  /** An editor's search across the codebase: a query, a summary, and files with their hits. */
  function searchPanel(parent, { x, y, w, query, summary, files, at, until, rowsAt, markAt }) {
    const node = staged(parent, 'bg-search', x, y);
    node.style.width = `${w}px`;
    const bar = el('div', 'bg-search-bar', node);
    bar.append(icon('search'));
    el('span', 'bg-search-query', bar, query);
    el('p', 'bg-search-summary', node, summary);
    files.forEach(({ file, hits }, i) => {
      const row = el('div', 'bg-search-row is-staged', node);
      el('span', 'bg-search-file', row, file);
      el('span', 'bg-search-hits', row, `${hits} hits`);
      fx.rise(row, rowsAt + i * 0.12, { distance: 6, duration: 0.25 });
      if (markAt !== undefined) fx.pop(el('span', 'bg-search-mark is-staged', row, 'Must change'), markAt + i * 0.1, { from: 0.5 });
    });
    show(node, at, until, 'rise');
    return node;
  }

  /** A chip on its own: a word on a group's paper (tone a, t, or zero). */
  function chip(parent, { x, y, text, tone = 'zero', at, until }) {
    const node = staged(parent, `bg-chip bg-chip--${tone} bg-chip--free`, x, y, text);
    return show(node, at, until, 'pop');
  }

  /** One answer of the two questions: a large drop, the group's name, and what it knows. */
  function groupCell(parent, { x, y, w, h, group, name, line, at, until, stacked = false }) {
    const node = staged(parent, `bg-cell${stacked ? ' bg-cell--stacked' : ''}`, x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    if (stacked) drop(node, { x: Math.round((w - 60) / 2), y: 12, group, size: 60, at: at + 0.1 });
    else drop(node, { x: 18, y: Math.round((h - 90) / 2), group, size: 76, at: at + 0.1 });
    const words = el('div', 'bg-cell-words', node);
    el('b', null, words, name);
    el('span', null, words, line);
    return show(node, at, until, 'pop');
  }

  /** A dark card listing one row per group: its pill and a short line ({ group, text, at }). */
  function groupList(parent, { x, y, w, title, iconName, rows, at, until }) {
    const node = staged(parent, 'sk-list bg-group-list', x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'sk-list-head', node);
    if (iconName) el('span', 'sk-list-icon', head).append(icon(iconName));
    el('p', 'sk-list-title', head, title);
    rows.forEach(({ group, text, at: rowAt = at }) => {
      const row = el('div', 'bg-group-row is-staged', node);
      pill(row, { x: 0, y: 0, group });
      el('span', null, row, text);
      fx.rise(row, rowAt, { distance: 8, duration: 0.3 });
    });
    return show(node, at, until, 'rise');
  }

  /**
   * Technology leaking along a dependency: amber drops that keep flowing
   * from `from` to `to` ([x, y] points) between `at` and `until`.
   */
  function drip(parent, { from: [x1, y1], to: [x2, y2], at, until, count = 3, period = 1.2 }) {
    return Array.from({ length: count }, (_, i) => {
      const bead = staged(parent, 'bg-drip', x1 - 9, y1 - 11);
      onFrame((t) => {
        const live = t >= at && t < until;
        const p = live ? (((t - at) / period + i / count) % 1) : 0;
        bead.style.opacity = live ? String(Math.min(1, 4 * p, 4 * (1 - p))) : '0';
        bead.style.translate = `${((x2 - x1) * p).toFixed(1)}px ${((y2 - y1) * p).toFixed(1)}px`;
      });
      return bead;
    });
  }

  // ------------------------------------------------------------------
  // Changes and reuse
  // ------------------------------------------------------------------

  const CHANGE_KINDS = {
    tech: { word: 'Tech change', iconName: 'plug' },
    rule: { word: 'Rule change', iconName: 'list' },
    reuse: { word: 'Reuse request', iconName: 'copy' },
    format: { word: 'Storage or display change', iconName: 'database' },
  };

  /**
   * A change on a card: its kind in words and an icon, then what changed.
   * moves = [{ at, dx, dy, duration }] carries it to the code it hits.
   */
  function changeCard(parent, { x, y, w = 250, kind, text, at, until, moves = [], how = 'pop' }) {
    const { word, iconName } = CHANGE_KINDS[kind];
    const node = staged(parent, `bg-change bg-change--${kind}`, x, y);
    node.style.width = `${w}px`;
    const head = el('p', 'bg-change-kind', node);
    head.append(icon(iconName), document.createTextNode(word));
    el('p', 'bg-change-text', node, text);
    show(node, at, until, how);
    moves.forEach(({ at: when, dx, dy, duration = 0.7 }) => fx.moveTo(node, when, dx, dy, duration));
    return node;
  }

  const PLACES = [
    { name: 'Glide, new city', sub: ['Same rules', 'same tech'], iconName: 'house' },
    { name: 'Bike-share', sub: ['Same rules', 'new tech'], iconName: 'transfer' },
    { name: 'Food truck', sub: ['New rules', 'same tech'], iconName: 'truck' },
    { name: 'Campus game', sub: ['New rules', 'new tech'], iconName: 'gamepad' },
  ];
  /** Where each group can be reused, place by place (1 is Yes). */
  const REUSE = { 0: [1, 1, 1, 1], A: [1, 1, 0, 0], T: [1, 0, 1, 0], AT: [1, 0, 0, 0] };

  /**
   * A chart of where code can be reused: four places across the top, and
   * one row per group ({ group, at }) answering Yes or No for each place.
   */
  function reuseChart(parent, { x, y, w = 820, rows, at, until, stampAt }) {
    const node = staged(parent, 'bg-chart', x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'bg-chart-row bg-chart-row--head', node);
    el('span', 'bg-chart-corner', head, 'Reuse in');
    PLACES.forEach(({ name, sub, iconName }) => {
      const place = el('span', 'bg-chart-place', head);
      place.append(icon(iconName));
      el('b', null, place, name);
      sub.forEach((words) => el('small', null, place, words));
    });
    rows.forEach(({ group, at: rowAt, cellsAt = rowAt }) => {
      const row = el('div', 'bg-chart-row is-staged', node);
      const label = el('span', 'bg-chart-group', row);
      pill(label, { x: 0, y: 0, group });
      REUSE[group].forEach((yes, i) => {
        const cell = el('span', `bg-chart-cell bg-chart-cell--${yes ? 'yes' : 'no'} is-staged`, row);
        cell.append(icon(yes ? 'check' : 'cross'), document.createTextNode(yes ? 'Yes' : 'No'));
        fx.pop(cell, cellsAt + 0.1 + i * 0.12, { from: 0.5 });
      });
      fx.rise(row, rowAt, { distance: 10, duration: 0.3 });
    });
    show(node, at, until, 'rise');
    if (stampAt !== undefined) node.classList.add('has-stamp');
    return node;
  }

  /** A place where code can be reused: an icon and a name on a dark tile. */
  function placeTile(parent, { x, y, w = 200, name, iconName, at, until, how = 'pop' }) {
    const node = staged(parent, 'bg-place', x, y);
    node.style.width = `${w}px`;
    el('span', 'bg-place-icon', node).append(icon(iconName));
    el('b', null, node, name);
    return show(node, at, until, how);
  }

  // ------------------------------------------------------------------
  // Mixing
  // ------------------------------------------------------------------

  /**
   * A flask whose contents and tag show the group of what was poured in:
   * contents = [{ at, group }]. Returns { node, mouth: [x, y] } (the stage
   * point drops fall into).
   */
  function flask(parent, { x, y, at, until, contents }) {
    const node = staged(parent, 'bg-flask', x, y);
    const art = svg('svg', { viewBox: '0 0 160 200', class: 'bg-flask-art', 'aria-hidden': 'true' }, node);
    const liquid = svg('g', { class: 'bg-flask-liquid' }, art);
    svg('path', { d: 'M38 120 L18 176 Q16 186 28 188 L80 188 L80 120 Z', class: 'bg-flask-half bg-flask-half--left' }, liquid);
    svg('path', { d: 'M80 120 L122 120 L142 176 Q144 186 132 188 L80 188 Z', class: 'bg-flask-half bg-flask-half--right' }, liquid);
    svg('path', { d: 'M60 10 L60 70 L14 176 Q10 194 30 194 L130 194 Q150 194 146 176 L100 70 L100 10', class: 'bg-flask-glass' }, art);
    svg('path', { d: 'M52 10 L108 10', class: 'bg-flask-glass' }, art);
    const tag = el('div', 'bg-flask-tag', node);
    el('span', 'bg-flask-tag-word', tag, 'Result');
    const result = pill(tag, { x: 0, y: 0, group: contents[0].group, changes: contents.slice(1) });
    trackGroup(liquid, el('span', 'bg-flask-hidden'), groupStates(contents[0].group, contents.slice(1)));
    show(node, at, until, 'rise');
    return { node, result };
  }

  /** A drop that falls from (x, y) by `fall` pixels at `at`, then fades into the flask. */
  function pour(parent, { x, y, group, at, fall = 150 }) {
    const node = drop(parent, { x, y, group, size: 56, at });
    tween(node, { translate: `0 ${fall}px`, opacity: 0 }, at + 0.45, 0.55, EASE.in);
    return node;
  }

  /** An equation on paper, such as A + T = AT: terms are groups, + and =, or words. */
  function equation(parent, { x, y, terms, at, until }) {
    const node = staged(parent, 'bg-equation', x, y);
    terms.forEach((term) => {
      if (term === '+' || term === '=') el('span', 'bg-equation-op', node, term);
      else if (['A', 'T', 'AT', '0', 'R'].includes(String(term))) pill(node, { x: 0, y: 0, group: term });
      else el('span', 'bg-equation-word', node, term);
    });
    return show(node, at, until, 'pop');
  }

  // ------------------------------------------------------------------
  // Interfaces, adapters, and inheritance
  // ------------------------------------------------------------------

  /** A socket the A side owns: an interface's name over its operation, in the A side's words, on A-blue paper. */
  function socket(parent, { x, y, w, name, text, at, until }) {
    const node = staged(parent, 'bg-socket', x, y);
    node.style.width = `${w}px`;
    el('span', 'bg-socket-plug', node).append(icon('plug'));
    const words = el('span', 'bg-socket-words', node);
    el('b', 'bg-socket-name', words, name);
    kit.writeCode(el('span', 'bg-socket-text', words), kit.highlightPython(text));
    return show(node, at, until, 'pop');
  }

  /**
   * A dongle: a thin adapter between a socket and a technology. It wears an
   * AT pill, and from `rAt` an R tag (the translator's letter).
   */
  function adapter(parent, { x, y, w = 190, title, at, until, rAt, how = 'pop' }) {
    const node = staged(parent, 'bg-adapter', x, y);
    node.style.width = `${w}px`;
    el('span', 'bg-adapter-pin bg-adapter-pin--left', node);
    el('span', 'bg-adapter-pin bg-adapter-pin--right', node);
    el('b', 'bg-adapter-title', node, title);
    const tags = el('span', 'bg-adapter-tags', node);
    el('span', `bg-pill bg-pill--static ${groupClass('AT')}`, tags, 'AT');
    if (rAt !== undefined) fx.pop(el('span', `bg-pill bg-pill--static ${groupClass('R')} is-staged`, tags, 'R'), rAt, { from: 0.4 });
    return show(node, at, until, how);
  }

  /**
   * A UML generalization: a line from the subclass (from) to the superclass
   * (to) ending in a hollow triangle, which grows in at `at`.
   */
  function inherits(parent, { from: [x1, y1], to: [x2, y2], at, until }) {
    const left = Math.min(x1, x2) - 20;
    const top = Math.min(y1, y2) - 4;
    const art = svg('svg', {
      class: 'bg-inherit is-staged', width: Math.abs(x2 - x1) + 40, height: Math.abs(y2 - y1) + 8,
      viewBox: `${left} ${top} ${Math.abs(x2 - x1) + 40} ${Math.abs(y2 - y1) + 8}`, 'aria-hidden': 'true',
    }, parent);
    art.style.left = `${left}px`;
    art.style.top = `${top}px`;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 26;
    const baseX = x2 - head * Math.cos(angle);
    const baseY = y2 - head * Math.sin(angle);
    const nx = -Math.sin(angle) * 14;
    const ny = Math.cos(angle) * 14;
    svg('line', { x1, y1, x2: baseX, y2: baseY, class: 'bg-inherit-line' }, art);
    svg('path', { d: `M ${x2} ${y2} L ${baseX + nx} ${baseY + ny} L ${baseX - nx} ${baseY - ny} Z`, class: 'bg-inherit-head' }, art);
    return show(art, at, until, 'fade');
  }

  /** A short A-blue wire from a module's edge to a socket it owns (horizontal, `from` and `to` share y). */
  function wire(parent, { from: [x1, y], to: [x2], at, until }) {
    const node = staged(parent, 'bg-wire', x1, y - 4);
    node.style.width = `${x2 - x1}px`;
    return show(node, at, until, 'fade');
  }

  /** A red cross over a crossed-out arrow, centered on (x, y). */
  function crossOut(parent, { x, y, at, until }) {
    const node = staged(parent, 'bg-cross', x - 22, y - 22);
    node.append(icon('cross'));
    fx.pop(node, at, { from: 1.8 });
    if (until !== undefined) fx.fadeOut(node, until - 0.25, 0.25);
    return node;
  }

  // ------------------------------------------------------------------
  // Glide: the campus map, the scooter, and the phone
  // ------------------------------------------------------------------

  /** Parking zones, buildings, and the ride's path on the campus map (map coordinates). */
  const CAMPUS = {
    w: 540,
    h: 400,
    buildings: [
      { name: 'Dorms', x: 24, y: 26, w: 150, h: 68 },
      { name: 'Library', x: 330, y: 30, w: 170, h: 68 },
      { name: 'Lecture hall', x: 330, y: 300, w: 186, h: 76 },
    ],
    zones: [
      { x: 200, y: 112, w: 96, h: 64 },
      { x: 38, y: 290, w: 96, h: 64 },
      { x: 420, y: 160, w: 96, h: 64 },
    ],
    road: 'M98 100 C 120 180, 240 170, 250 230 S 300 280, 300 300',
    ride: [[86, 96], [130, 170], [232, 196], [262, 246], [292, 270]],
  };

  /** A paper campus map with buildings, parking zones (P), and the path to the lecture hall. */
  function campusMap(parent, { x, y, at, until }) {
    const node = staged(parent, 'bg-map', x, y);
    node.style.width = `${CAMPUS.w}px`;
    node.style.height = `${CAMPUS.h}px`;
    const art = svg('svg', { viewBox: `0 0 ${CAMPUS.w} ${CAMPUS.h}`, class: 'bg-map-art', 'aria-hidden': 'true' }, node);
    svg('path', { d: CAMPUS.road, class: 'bg-map-road' }, art);
    CAMPUS.zones.forEach((zone) => svg('rect', { ...zone, rx: 10, class: 'bg-map-zone' }, art));
    CAMPUS.buildings.forEach((b) => svg('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 8, class: 'bg-map-building' }, art));
    CAMPUS.zones.forEach((zone) => {
      const label = el('span', 'bg-map-p', node, 'P');
      label.style.left = `${zone.x + zone.w / 2}px`;
      label.style.top = `${zone.y + zone.h / 2}px`;
    });
    CAMPUS.buildings.forEach((b) => {
      const label = el('span', 'bg-map-name', node, b.name);
      label.style.left = `${b.x + b.w / 2}px`;
      label.style.top = `${b.y + b.h / 2}px`;
    });
    show(node, at, until, 'fade');
    return node;
  }

  /** A side-view scooter: deck, stem, handlebar, two wheels. */
  function scooterArt(parent) {
    const art = svg('svg', { viewBox: '0 0 64 48', class: 'bg-scooter-art', 'aria-hidden': 'true' }, parent);
    svg('path', { d: 'M14 36 L44 36 L48 6 L56 6', class: 'bg-scooter-frame' }, art);
    svg('circle', { cx: 14, cy: 38, r: 7, class: 'bg-scooter-wheel' }, art);
    svg('circle', { cx: 48, cy: 38, r: 7, class: 'bg-scooter-wheel' }, art);
    return art;
  }

  /**
   * A scooter riding the map: path = [[x, y], ...] in the map's coordinates,
   * ridden from `at` over `duration` seconds; it stops at the last point.
   */
  function scooter(parent, { mapX, mapY, path, at, duration }) {
    const node = staged(parent, 'bg-scooter', mapX + path[0][0] - 32, mapY + path[0][1] - 40);
    scooterArt(node);
    fx.fadeIn(node, at - 0.3, 0.3);
    const lengths = path.slice(1).map(([px, py], i) => Math.hypot(px - path[i][0], py - path[i][1]));
    const total = lengths.reduce((a, b) => a + b, 0);
    onFrame((t) => {
      let distance = total * easeInOutCubic(progress(t, at, duration));
      let i = 0;
      while (i < lengths.length - 1 && distance > lengths[i]) distance -= lengths[i++];
      const f = lengths[i] ? Math.min(1, distance / lengths[i]) : 0;
      const px = path[i][0] + (path[i + 1][0] - path[i][0]) * f;
      const py = path[i][1] + (path[i + 1][1] - path[i][1]) * f;
      node.style.translate = `${(px - path[0][0]).toFixed(1)}px ${(py - path[0][1]).toFixed(1)}px`;
    });
    return node;
  }

  /** Glide on a phone: the ride so far, an End ride button, and a toast at `toastAt`. */
  function phone(parent, { x, y, at, until, toastAt, tapAt }) {
    const node = staged(parent, 'bg-phone', x, y);
    el('p', 'bg-phone-title', node, 'Glide');
    const ride = el('div', 'bg-phone-ride', node);
    ride.append(scooterArt(el('span', 'bg-phone-scooter', ride)));
    el('span', null, ride, '4 min ride');
    const button = el('p', 'bg-phone-button', node, 'End ride');
    if (tapAt !== undefined) fx.bump(button, tapAt, 0.12);
    if (toastAt !== undefined) {
      const toast = el('p', 'bg-phone-toast is-staged', node);
      toast.append(icon('warning'), document.createTextNode('No parking here'));
      fx.pop(toast, toastAt, { from: 0.6 });
    }
    show(node, at, until, 'slide');
    return node;
  }

  // ------------------------------------------------------------------
  // Charts and small props
  // ------------------------------------------------------------------

  /** A monthly bill on paper: rows = [{ label, value, at, isNew }]; a new price prints in red. */
  function invoice(parent, { x, y, w, title, rows, at, until }) {
    const node = staged(parent, 'bg-invoice', x, y);
    node.style.width = `${w}px`;
    el('p', 'bg-invoice-title', node, title);
    rows.forEach(({ label, value, at: rowAt = at, isNew }) => {
      const row = el('p', `bg-invoice-row${isNew ? ' bg-invoice-row--new' : ''} is-staged`, node);
      el('span', null, row, label);
      el('b', null, row, value);
      fx.rise(row, rowAt, { distance: 8, duration: 0.3 });
    });
    return show(node, at, until, 'rise');
  }

  /** Is a point inside a zone? A dashed polygon, a dot that lands inside at `dotAt`, and the verdict. */
  function zoneCheck(parent, { x, y, at, until, dotAt, verdict = 'Inside' }) {
    const node = staged(parent, 'bg-zone-check', x, y);
    node.style.width = '220px';
    node.style.height = '180px';
    const art = svg('svg', { viewBox: '0 0 220 150', width: 220, height: 150, class: 'bg-zone-check-art', 'aria-hidden': 'true' }, node);
    svg('path', { d: 'M20 40 L110 12 L190 54 L168 128 L56 136 Z', class: 'bg-zone-shape' }, art);
    const dot = svg('circle', { cx: 104, cy: 78, r: 11, class: 'bg-zone-dot is-staged' }, art);
    fx.pop(dot, dotAt, { from: 0.2 });
    const word = el('span', 'bg-zone-verdict is-staged', node, verdict);
    word.style.left = '72px';
    word.style.top = '146px';
    fx.pop(word, dotAt + 0.3, { from: 0.5 });
    return show(node, at, until, 'fade');
  }

  /** Two bars that move in opposite directions: Share of AT code rises while Quality falls. */
  function tradeoff(parent, { x, y, w = 300, at, swingAt, until }) {
    const node = staged(parent, 'bg-tradeoff', x, y);
    node.style.width = `${w}px`;
    const bars = [['Share of AT code', 0.15, 0.85, 'at'], ['Quality', 0.85, 0.2, 'quality']].map(([label, from, to, kind]) => {
      el('p', 'bg-tradeoff-label', node, label);
      const fill = el('span', `bg-tradeoff-fill bg-tradeoff-fill--${kind}`, el('span', 'bg-tradeoff-bar', node));
      return { fill, from, to };
    });
    onFrame((t) => {
      const p = easeInOutCubic(progress(t, swingAt, 1.6));
      bars.forEach(({ fill, from, to }) => { fill.style.width = `${Math.round((from + (to - from) * p) * 100)}%`; });
    });
    return show(node, at, until, 'rise');
  }

  /**
   * Code quality against engineering effort: an arch with three named
   * points; a dot travels it, stopping at each { at, point } in turn
   * (point 0 is Tangle, 1 Ideal, 2 Over-engineered).
   */
  function effortCurve(parent, { x, y, w = 520, h = 300, at, until, stops }) {
    const node = staged(parent, 'bg-curve', x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    const art = svg('svg', { viewBox: `0 0 ${w} ${h}`, class: 'bg-curve-art', 'aria-hidden': 'true' }, node);
    const left = 40;
    const bottom = h - 40;
    svg('path', { d: `M ${left} 16 L ${left} ${bottom} L ${w - 16} ${bottom}`, class: 'bg-curve-axes' }, art);
    const curve = (u) => [left + 20 + u * (w - left - 60), bottom - 30 - Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.05)) * (h - 110)];
    const points = Array.from({ length: 41 }, (_, i) => curve(i / 40));
    const path = svg('path', { d: `M ${points.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join(' L ')}`, class: 'bg-curve-line' }, art);
    fx.draw(path, at + 0.2, 1.2);
    const axisY = el('span', 'bg-curve-axis bg-curve-axis--y', node, 'Code quality');
    axisY.style.top = '0px';
    const axisX = el('span', 'bg-curve-axis bg-curve-axis--x', node, 'Engineering effort');
    axisX.style.top = `${bottom + 6}px`;
    const marks = [[0.02, 'Tangle'], [0.52, 'Ideal'], [0.98, 'Over-engineered']];
    marks.forEach(([u, name], i) => {
      const reached = stops.find(({ point }) => point === i);
      if (!reached) return;
      const [px, py] = curve(u);
      const label = el('span', `bg-curve-mark bg-curve-mark--${i === 1 ? 'above' : 'below'} is-staged`, node, name);
      label.style.left = `${px}px`;
      label.style.top = `${py}px`;
      fx.pop(label, reached.at, { from: 0.5 });
    });
    const dot = el('span', 'bg-curve-dot is-staged', node);
    fx.fadeIn(dot, stops[0].at, 0.3);
    onFrame((t) => {
      let u = marks[stops[0].point][0];
      for (let i = 1; i < stops.length; i += 1) {
        const p = easeInOutCubic(progress(t, stops[i].at - 0.9, 0.9));
        u += (marks[stops[i].point][0] - marks[stops[i - 1].point][0]) * p;
      }
      const [px, py] = curve(u);
      dot.style.left = `${px.toFixed(1)}px`;
      dot.style.top = `${py.toFixed(1)}px`;
    });
    return show(node, at, until, 'fade');
  }

  /** A value wrapped in boxes inside boxes, each named in its top-left corner. */
  function wrappers(parent, { x, y, layers, core, at, until }) {
    const node = staged(parent, 'bg-wraps', x, y);
    let inner = node;
    layers.forEach((name, i) => {
      inner = el('div', 'bg-wrap is-staged', inner);
      el('span', 'bg-wrap-name', inner, name);
      fx.pop(inner, at + 0.2 + i * 0.25, { from: 0.8 });
    });
    el('code', 'bg-wrap-core', inner, core);
    return show(node, at, until, 'fade');
  }

  window.BloodKit = {
    drop, pill, chip, groupCell, groupList, drip, moduleCard, codeCard, snippetCard, searchPanel, changeCard, reuseChart,
    placeTile, flask, pour, equation, socket, adapter, wire, inherits, crossOut, campusMap,
    scooter, phone, invoice, zoneCheck, tradeoff, effortCurve, wrappers, CAMPUS, REUSE, PLACES,
  };
})();
