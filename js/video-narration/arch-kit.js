/*
 * The architecture kit: the objects every architectural-style narration
 * draws with (publish-subscribe, layered style, pipes and filters), on the
 * drafting-room blueprint and on top of the shared wall kit
 * (js/video-narration/wall-kit.js). Styles: css/video-narration-arch-kit.css.
 * A topic kit adds the lesson's own artwork (the robot, the game, the
 * photos) and loads after this one. The visual language, the same in all
 * three lessons so a learner can compare the styles:
 *
 *   a program, filter, or module is a paper card with an icon and its name;
 *     its state (down, changed, new, unchanged) is a class that repaints
 *     the card and is also written in words;
 *   code is a dark editor card whose rows can light up and carry a tag in
 *     the gutter that names the line's role in words;
 *   a rule of the style is a numbered rule card, and a quality attribute is
 *     a card that says Promoted or Inhibited in words beside its arrow;
 *   data in motion is a token that travels along a path of straight
 *     segments; a queue is a row of slots that fills and empties over time;
 *   a topic is a long channel with its name; a pipe is a tube with an
 *     arrowhead; a connector's label sits beside the line, never on it.
 *
 * Every builder schedules its own motion on the Timeline, and every pose is
 * a pure function of narration time. Coordinates are CSS pixels inside the
 * picture's 960x540 body.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, icon } = kit;
  const wall = window.WallKit;
  const { staged } = wall;

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
    else if (how === 'drop') fx.slideIn(node, at, { dx: 0, dy: -40, duration: 0.45 });
    else if (how === 'none') node.classList.remove('is-staged');
    else fx.pop(node, at, { from: 0.6 });
    if (until !== undefined) fx.fadeOut(node, until - 0.25, 0.25);
    return node;
  }

  /**
   * Keeps one state class on `node` at a time: states = [{ at, state }],
   * painted as `${prefix}${state}`. A class, not an inline color, so the
   * rounded-surface repaint (js/song-video/rounded-surfaces.js) follows it.
   * Optional `words` writes the state's words into `label` as well.
   */
  function track(node, prefix, states, label) {
    const sorted = [{ at: -Infinity, state: '', words: undefined }, ...states].sort((a, b) => a.at - b.at);
    let shown;
    const update = (t) => {
      const entry = latest(sorted, t);
      if (entry === shown) return;
      if (shown && shown.state) node.classList.remove(`${prefix}${shown.state}`);
      if (entry.state) node.classList.add(`${prefix}${entry.state}`);
      if (label && entry.words !== undefined) label.textContent = entry.words;
      shown = entry;
    };
    update(-Infinity);
    onFrame(update);
  }

  // ------------------------------------------------------------------
  // Programs and their parts
  // ------------------------------------------------------------------

  const STATE_ICONS = { down: 'hourglass', changed: 'pencil', new: 'sparkle', same: 'check', idle: 'timer', crashed: 'warning' };

  /**
   * A program on paper: an icon disk, its name, and an optional line under
   * it (`sub`, written in words). states = [{ at, state, sub }] repaints it
   * (down, changed, new, same, idle, busy, crashed) and rewrites its line.
   * ports: { in: true, out: true } draws its input and output ports.
   */
  function card(parent, { x, y, w = 220, h, title, sub, iconName, at, until, how = 'pop', states = [], ports, mono = false }) {
    const node = staged(parent, 'ak-card', x, y);
    node.style.width = `${w}px`;
    if (h) node.style.height = `${h}px`;
    if (iconName) el('span', 'ak-card-icon', node).append(icon(iconName));
    const words = el('div', 'ak-card-words', node);
    el('b', `ak-card-title${mono ? ' ak-mono' : ''}`, words, title);
    const line = el('span', 'ak-card-sub', words, sub || '');
    if (!sub && !states.some((state) => state.sub)) line.remove();
    if (ports && ports.in) el('span', 'ak-port ak-port--in', node);
    if (ports && ports.out) el('span', 'ak-port ak-port--out', node);
    if (states.length) {
      const sorted = [{ at: -Infinity, state: '' }, ...states].sort((a, b) => a.at - b.at);
      track(node, 'is-', sorted.slice(1).map(({ at: when, state, sub: text }) => ({ at: when, state, words: text })), line);
      // The state's icon in a corner badge, so the state never rests on color alone.
      const badge = el('span', 'ak-card-state', node);
      let shown;
      onFrame((t) => {
        const name = STATE_ICONS[latest(sorted, t).state] || '';
        if (name === shown) return;
        badge.replaceChildren(...(name ? [icon(name)] : []));
        badge.classList.toggle('is-empty', !name);
        shown = name;
      });
    }
    show(node, at, until, how);
    return node;
  }

  /** A program's queue: `slots` boxes that fill with the count in force at each time (fills = [{ at, count }]). */
  function queue(parent, { x, y, slots = 6, size = 26, fills = [], label, at, until, dropAt }) {
    const node = staged(parent, 'ak-queue', x, y);
    if (label) el('span', 'ak-queue-label', node, label);
    const row = el('span', 'ak-queue-slots', node);
    const boxes = Array.from({ length: slots }, () => {
      const box = el('span', 'ak-queue-slot', row);
      box.style.width = `${size}px`;
      box.style.height = `${size}px`;
      return box;
    });
    const counts = [{ at: -Infinity, count: 0 }, ...fills].sort((a, b) => a.at - b.at);
    let shown = -1;
    onFrame((t) => {
      const { count } = latest(counts, t);
      if (count === shown) return;
      boxes.forEach((box, i) => box.classList.toggle('is-full', i < count));
      shown = count;
    });
    if (dropAt !== undefined) {
      const dropped = el('span', 'ak-queue-dropped is-staged', node, 'Oldest dropped');
      fx.pop(dropped, dropAt, { from: 0.5 });
    }
    return show(node, at, until, 'rise');
  }

  // ------------------------------------------------------------------
  // Code
  // ------------------------------------------------------------------

  /** One line of highlighted Python. */
  function codeLine(parent, code, className = '') {
    const line = el('div', `code-line ak-code-text${className ? ` ${className}` : ''}`, parent);
    kit.writeCode(line, kit.highlightPython(code));
    return line;
  }

  /**
   * A dark editor card. lines = [{ code, tag, at, kind }]: each line is
   * highlighted Python; `tag` is a word written in the gutter from `tagsAt`
   * (its tone from `tone`); kind 'added' or 'removed' marks a diff line;
   * `at` types a line in later. Returns the card and its rows (light them
   * with WallKit.lit).
   */
  function code(parent, { x, y, w, title, lines, at, until, tagsAt, how = 'rise', gutter = false }) {
    const node = staged(parent, 'code-card ak-code', x, y);
    node.style.width = `${w}px`;
    if (title) el('div', 'code-card-title ak-code-title', node, title);
    const body = el('div', `ak-code-body${gutter ? ' ak-code-body--gutter' : ''}`, node);
    const rows = lines.map(({ code: source, tag, tone, at: lineAt, kind }, i) => {
      const row = el('div', `ak-code-row${kind ? ` ak-code-row--${kind}` : ''}`, body);
      if (gutter) {
        const cell = el('span', 'ak-code-gutter', row);
        if (tag) {
          const word = el('span', `ak-tag ak-tag--${tone || 'plain'}${tagsAt !== undefined ? ' is-staged' : ''}`, cell, tag);
          if (tagsAt !== undefined) fx.pop(word, tagsAt + i * 0.12, { from: 0.5 });
        }
      }
      if (kind) el('span', 'ak-code-sign', row, kind === 'added' ? '+' : '-');
      codeLine(row, source);
      if (lineAt !== undefined) {
        row.classList.add('is-staged');
        fx.rise(row, lineAt, { distance: 6, duration: 0.3 });
      }
      return row;
    });
    show(node, at, until, how);
    return { node, rows };
  }

  // ------------------------------------------------------------------
  // Rules and qualities: the same cards in every style's lesson
  // ------------------------------------------------------------------

  /** A rule of the style: its number, its name, and the rule in a short line. `crackAt` breaks it. */
  function rule(parent, { x, y, w = 330, n, name, text, at, until, how = 'drop', crackAt }) {
    const node = staged(parent, 'ak-rule', x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'ak-rule-head', node);
    el('span', 'ak-rule-number', head, `Rule ${n}`);
    el('b', 'ak-rule-name', head, name);
    if (text) el('p', 'ak-rule-text', node, text);
    if (crackAt !== undefined) {
      const crack = svg('svg', { class: 'ak-rule-crack is-staged', viewBox: '0 0 100 40', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, node);
      svg('path', { d: 'M0 22 L18 14 L30 26 L46 10 L60 24 L74 12 L86 22 L100 16' }, crack);
      fx.fadeIn(crack, crackAt, 0.3);
    }
    return show(node, at, until, how);
  }

  /** A quality attribute the style promotes or inhibits, said in words beside its arrow. */
  function quality(parent, { x, y, w = 300, name, effect = 'promoted', at, until, how = 'pop' }) {
    const node = staged(parent, `ak-quality ak-quality--${effect}`, x, y);
    node.style.width = `${w}px`;
    el('span', 'ak-quality-icon', node).append(icon(effect === 'promoted' ? 'arrowUp' : 'arrowDown'));
    const words = el('span', 'ak-quality-words', node);
    el('b', null, words, name);
    el('small', null, words, effect === 'promoted' ? 'Promoted' : 'Inhibited');
    return show(node, at, until, how);
  }

  // ------------------------------------------------------------------
  // Connectors and data in motion
  // ------------------------------------------------------------------

  /**
   * A thin connector from `from` to `to` ([x, y] points) with an arrowhead,
   * drawn in from its tail; `tone` paints it (gold, cyan, red, line), and
   * `dashed` marks a call at run time or an attempt.
   */
  function wire(parent, { from: [x1, y1], to: [x2, y2], tone = 'gold', dashed = false, head = true, at, until }) {
    const node = staged(parent, `ak-wire ak-wire--${tone}${dashed ? ' ak-wire--dashed' : ''}${head ? '' : ' ak-wire--plain'}`, x1, y1);
    const length = Math.hypot(x2 - x1, y2 - y1) - (head ? 12 : 0);
    node.style.width = `${Math.max(0, length)}px`;
    node.style.rotate = `${((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI).toFixed(2)}deg`;
    tween(node, [{ opacity: 0, scale: '0 1' }, { opacity: 1, scale: '1 1' }], at, 0.4, EASE.out);
    if (until !== undefined) fx.fadeOut(node, until - 0.25, 0.25);
    return node;
  }

  /** A short label set beside a connector, on its own paper so it never sits on the line. */
  function tag(parent, { x, y, text, tone = 'plain', at, until, how = 'pop', mono = false }) {
    const node = staged(parent, `ak-label ak-label--${tone}${mono ? ' ak-mono' : ''}`, x, y, text);
    return show(node, at, until, how);
  }

  /** The point at distance d along a polyline. */
  function along(points, d) {
    let rest = d;
    for (let i = 1; i < points.length; i += 1) {
      const [x1, y1] = points[i - 1];
      const [x2, y2] = points[i];
      const length = Math.hypot(x2 - x1, y2 - y1);
      if (rest <= length || i === points.length - 1) {
        const p = length ? Math.min(1, rest / length) : 1;
        return [x1 + (x2 - x1) * p, y1 + (y2 - y1) * p];
      }
      rest -= length;
    }
    return points[points.length - 1];
  }
  const pathLength = (points) => points.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - points[i][0], y - points[i][1]), 0);

  /**
   * Data in motion: a token that travels a path of straight segments
   * (`path`, token centers) from `at` for `duration` seconds, with an
   * ease at both ends, then rests at the end until `until`. Its look is a
   * child the caller supplies (`art`: a function that draws into the
   * token), or a plain frame with a short `text`.
   */
  function token(parent, { path, at, duration = 0.8, until, size = 34, art, text, kind = 'frame', fadeIn = true }) {
    const node = staged(parent, `ak-token ak-token--${kind}`, 0, 0);
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    if (art) art(node);
    else if (text) el('span', 'ak-token-text', node, text);
    const total = pathLength(path);
    const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2);
    onFrame((t) => {
      const visible = t >= at && (until === undefined || t < until);
      node.style.opacity = visible ? String(fadeIn ? Math.min(1, (t - at) / 0.15) : 1) : '0';
      const p = duration > 0 ? Math.min(1, Math.max(0, (t - at) / duration)) : 1;
      const [cx, cy] = along(path, total * ease(p));
      node.style.left = `${(cx - size / 2).toFixed(1)}px`;
      node.style.top = `${(cy - size / 2).toFixed(1)}px`;
    });
    node.classList.remove('is-staged');
    return node;
  }

  /**
   * A stream of tokens along one path, one leaving every `every` seconds
   * between `at` and `until`, each taking `duration` to arrive and vanishing
   * on arrival: frames into a topic, photos down a pipe.
   */
  function stream(parent, { path, at, until, every = 0.6, duration = 0.9, size = 26, kind = 'frame', art }) {
    const count = Math.max(1, Math.ceil((until - at) / every));
    return Array.from({ length: count }, (_, i) => token(parent, {
      path, at: at + i * every, duration, until: Math.min(until, at + i * every + duration), size, kind, art,
    }));
  }

  // ------------------------------------------------------------------
  // Small readouts
  // ------------------------------------------------------------------

  /** A readout on paper: a label and a value that changes over time (values = [{ at, text, state }]). */
  function readout(parent, { x, y, w, label, values, iconName, at, until, how = 'pop' }) {
    const node = staged(parent, 'ak-readout', x, y);
    if (w) node.style.width = `${w}px`;
    if (iconName) el('span', 'ak-readout-icon', node).append(icon(iconName));
    const words = el('span', 'ak-readout-words', node);
    if (label) el('small', null, words, label);
    const value = el('b', null, words, values[0].text);
    track(node, 'is-', values.map(({ at: when, text, state }) => ({ at: when, state: state || '', words: text })), value);
    return show(node, at, until, how);
  }

  /** A red cross over something struck out (left out of the gap check). */
  function cross(parent, { x, y, size = 64, at, until }) {
    const node = staged(parent, 'ak-cross', x - size / 2, y - size / 2);
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.append(icon('cross'));
    return show(node, at, until, 'pop');
  }

  /**
   * A topic: a long channel that events travel through, its name on a tab
   * above its left end (`tab: 'right'` moves it), so tokens inside the
   * channel never pass behind the name. Returns the channel; its center
   * line is at y + 22.
   */
  function topic(parent, { x, y, w, name, at, until, how = 'fade', tab = 'left', states = [] }) {
    const node = staged(parent, `ak-topic ak-topic--tab-${tab}`, x, y);
    node.style.width = `${w}px`;
    const label = el('span', 'ak-topic-tab', node);
    el('span', 'ak-topic-kind', label, 'Topic');
    el('span', 'ak-topic-name ak-mono', label, name);
    if (states.length) track(node, 'is-', states.map(({ at: when, state }) => ({ at: when, state })));
    return show(node, at, until, how);
  }

  /**
   * An editor's search across the codebase: a query, a summary, and files
   * with their hits (files = [{ file, hits }]); `markText` stamps every row
   * from `markAt`, such as Must change.
   */
  function search(parent, { x, y, w, query, summary, files, at, until, rowsAt = at, markAt, markText }) {
    const node = staged(parent, 'ak-search', x, y);
    node.style.width = `${w}px`;
    const bar = el('div', 'ak-search-bar', node);
    bar.append(icon('search'));
    el('span', 'ak-search-query ak-mono', bar, query);
    if (summary) el('p', 'ak-search-summary', node, summary);
    files.forEach(({ file, hits }, i) => {
      const row = el('div', 'ak-search-row is-staged', node);
      el('span', 'ak-search-file ak-mono', row, file);
      if (hits) el('span', 'ak-search-hits', row, hits);
      fx.rise(row, rowsAt + i * 0.12, { distance: 6, duration: 0.25 });
      if (markAt !== undefined) fx.pop(el('span', 'ak-search-mark is-staged', row, markText), markAt + i * 0.1, { from: 0.5 });
    });
    return show(node, at, until, 'rise');
  }

  window.ArchKit = {
    latest, show, track, card, queue, codeLine, code, rule, quality, wire, tag,
    along, pathLength, token, stream, readout, cross, topic, search,
  };
})();
