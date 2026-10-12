/*
 * Shell kit for "Small Tools, One Job Each" (the shell scripting song):
 * vector pieces that show what the shell does with a line you type. Each
 * piece carries one visual metaphor whose mapping holds for the concept it
 * teaches, and keeps the real notation on screen beside it:
 *
 *   scissors cut a command line at its spaces (word splitting), and quotes
 *     tape words together;
 *   PATH is a filing cabinet whose drawers are searched in order, while a
 *     script in the current directory waits on the desk beside it;
 *   a directory tree carries a map pin (you are here), a full address
 *     (absolute path), and directions (relative path);
 *   a pipeline is a conveyor belt of small machines (the lecture's "streams
 *     are conveyor belts, not trucks"); errors leave by a side hatch and
 *     each machine's beacon shows its exit code;
 *   a shebang is an address label, execute permission a padlock, $1 the
 *     blank a run fills in, `if` a decision diamond, a for loop a rubber
 *     stamp that visits every file, `&&` a boom gate, and the chant's
 *     commands collectible cards that fill a toolbox.
 *
 * Builds on SongKit (kit.js) and Timeline (timeline.js); every builder
 * schedules its own motion, and every pose is a pure function of song time.
 * Coordinates are CSS pixels on the 960×540 stage. Styles:
 * css/song-video-shell-kit.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, progress, clamp, easeInOutCubic } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, place, icon } = kit;
  let uid = 0;

  /** The newest entry of a time-sorted list at or before t (or undefined). */
  function latest(entries, t) {
    let found;
    for (const entry of entries) if (entry.at <= t) found = entry;
    return found;
  }

  /** 0 → 1 → 0 over [at, at + duration]: a press, a snip, a hit. */
  function blip(t, at, duration) {
    const p = progress(t, at, duration);
    return p <= 0 || p >= 1 ? 0 : Math.sin(p * Math.PI);
  }

  /** Moves an absolutely placed node through stops = [{ at, x, y, duration }]. */
  function mover(node, stops) {
    onFrame((t) => {
      let x = stops[0].x;
      let y = stops[0].y;
      for (let i = 1; i < stops.length; i++) {
        const stop = stops[i];
        const p = easeInOutCubic(progress(t, stop.at, stop.duration || 0.35));
        x += (stop.x - x) * p;
        y += (stop.y - y) * p;
      }
      node.style.left = `${x.toFixed(1)}px`;
      node.style.top = `${y.toFixed(1)}px`;
    });
    return node;
  }

  /**
   * Stage coordinates of a node's box, or null while the stage is not laid
   * out (the live player builds the scene before it shows the picture).
   * Callers measure lazily, on a visible frame, and cache the result.
   */
  function boxOf(node) {
    if (!node.offsetWidth) return null;
    let x = 0;
    let y = 0;
    let current = node;
    while (current && !current.classList.contains('stage')) {
      x += current.offsetLeft;
      y += current.offsetTop;
      current = current.offsetParent;
    }
    return { x, y, w: node.offsetWidth, h: node.offsetHeight };
  }

  // ------------------------------------------------------------------
  // A terminal session: commands type out, output appears whole
  // ------------------------------------------------------------------

  function session(parent, { x, y, w, rows = 4, title = 'terminal', at, until }) {
    const TYPE_CPS = 42;
    const node = place(el('div', 'sh-window is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const bar = el('div', 'sh-window-bar', node);
    for (let i = 0; i < 3; i++) el('span', 'sh-window-dot', bar);
    el('span', 'sh-window-title', bar, title);
    const body = el('div', 'sh-window-body', node);
    body.style.height = `${rows * 28 + 12}px`;
    const slots = Array.from({ length: rows }, () => el('div', 'sh-line', body));
    const cursor = el('span', 'sh-cursor');
    const lines = [];
    fx.rise(node, at, { distance: 24, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until - 0.3, 0.3);

    onFrame((t) => {
      const shown = lines.filter((line) => line.at <= t).slice(-rows);
      slots.forEach((slot, i) => {
        const line = shown[i];
        if (!line) {
          slot.textContent = '';
          slot.className = 'sh-line';
          return;
        }
        slot.className = `sh-line sh-line--${line.kind}`;
        const typing = line.kind === 'command' || line.kind === 'cont';
        const typed = typing ? line.text.slice(0, Math.floor((t - line.at) * TYPE_CPS) + 1) : line.text;
        slot.textContent = typed;
        const last = i === shown.length - 1;
        if (last && typing && (typed.length < line.text.length || Math.floor(t * 2.5) % 2 === 0)) slot.append(cursor);
      });
    });

    return {
      node,
      run(time, text, kind = 'command') {
        lines.push({ at: time, text, kind });
        lines.sort((a, b) => a.at - b.at);
        return this;
      },
    };
  }

  // ------------------------------------------------------------------
  // Word splitting: a command line, scissors, and tape for quotes
  // ------------------------------------------------------------------

  /** Reveal the folders created by a command after a prediction interval. */
  function commandResult(parent, { x, y, title, words, folders, conclusion, at, resultAt }) {
    const node = place(el('div', 'sh-command-example is-staged', parent), x, y);
    el('div', 'sh-command-example-title', node, title);
    const body = el('div', 'sh-example-body', node);
    const command = el('code', 'sh-example-command', body);
    words.forEach((word) => el('span', 'sh-example-word', command, word));
    const arrow = icon('arrowDown', 'sh-example-arrow is-staged');
    body.append(arrow);
    const result = el('div', 'sh-example-result is-staged', body);
    const folderRow = el('div', 'sh-example-folders', result);
    folders.forEach((name) => {
      const folder = el('div', 'sh-example-folder', folderRow);
      folder.append(icon('folder'));
      el('span', null, folder, name);
    });
    el('div', 'sh-example-conclusion', result, conclusion);
    fx.rise(node, at, { distance: 12 });
    fx.fadeIn(arrow, resultAt, 0.25);
    fx.rise(result, resultAt, { distance: 10 });
    onFrame((time) => command.classList.toggle('is-parsed', time >= resultAt));
    return node;
  }

  /**
   * words = [{ text, label, labelAt, tone, tape, tapeAt }]; tone is command |
   * arg | good | bad | plain. The row reads as one typed line until
   * `splitAt`, when its words separate and get outlined. `tape` lays a strip
   * of tape over a quoted word (quotes keep it one word). Without `x` the row
   * is centred. cuts() gives the stage x of each space, for the scissors.
   */
  function tokens(parent, { x, y, words, at, splitAt, until, size = 30 }) {
    const row = el('div', 'sh-tokens is-staged', parent);
    if (x === undefined) row.classList.add('sh-tokens--center');
    else row.style.left = `${x}px`;
    row.style.top = `${y}px`;
    row.style.fontSize = `${size}px`;
    fx.rise(row, at, { distance: 18, duration: 0.35 });
    const cols = words.map((word) => {
      const col = el('div', `sh-token sh-token--${word.tone || 'plain'}`, row);
      const text = el('span', 'sh-token-text', col, word.text);
      const box = el('span', 'sh-token-box is-staged', text);
      if (splitAt !== undefined) fx.fadeIn(box, splitAt + 0.08, 0.2);
      if (word.tape) {
        // Strips of tape across both ends (and across the space inside a
        // quoted name, at character index `seam`) hold the word together
        // without covering its letters.
        const tapes = el('span', 'sh-token-tapes is-staged', text);
        el('span', 'sh-token-tape sh-token-tape--left', tapes);
        el('span', 'sh-token-tape sh-token-tape--right', tapes);
        if (word.seam !== undefined) {
          tapes.style.setProperty('--seam', `calc(18px + ${(word.seam * 0.6).toFixed(2)}em)`);
          el('span', 'sh-token-tape sh-token-tape--seam', tapes);
        }
        fx.pop(tapes, word.tapeAt ?? at + 0.2, { from: 1.25, rotate: 0 });
      }
      let label = null;
      if (word.label) {
        label = el('span', 'sh-token-label is-staged', col, word.label);
        fx.pop(label, word.labelAt ?? (splitAt ?? at) + 0.15, { from: 0.6, rotate: 0 });
        if (splitAt !== undefined) {
          // Once the words separate, widen short words so their hanging
          // labels don't collide (estimated from character counts: the
          // stage may not be laid out when the scene is built).
          const textWidth = word.text.length * size * 0.6 + 8;
          const labelWidth = word.label.length * 9.6 + 26;
          const pad = (labelWidth - textWidth) / 2 + 4;
          if (pad > 0) {
            tween(col, [{ paddingLeft: '0px', paddingRight: '0px' }, { paddingLeft: `${pad.toFixed(1)}px`, paddingRight: `${pad.toFixed(1)}px` }], splitAt, 0.4, EASE.back);
          }
        }
      }
      return { col, text, label };
    });
    if (splitAt !== undefined) tween(row, [{ columnGap: '0.6em' }, { columnGap: '1.3em' }], splitAt, 0.4, EASE.back);
    if (until !== undefined) fx.fadeOut(row, until - 0.25, 0.25);
    return {
      row,
      cols,
      /**
       * Stage position of the gap between word i and word i + 1, measured on
       * the unsplit line; null until the stage is laid out.
       */
      cuts() {
        const gaps = [];
        for (let i = 1; i < cols.length; i++) {
          const a = boxOf(cols[i - 1].text);
          const b = boxOf(cols[i].text);
          if (!a || !b) return null;
          gaps.push({ x: (a.x + a.w + b.x) / 2, y: a.y + a.h / 2 });
        }
        return gaps;
      },
    };
  }

  /**
   * Scissors that glide along a token row and snip its spaces at `times`
   * (one per gap, in order; null skips a gap, such as one inside quotes),
   * leaving a dashed cut mark. Blades point down onto the line. Positions
   * are measured on the first visible frame, before the row splits.
   */
  function scissors(parent, { row, times, from, until }) {
    const layer = el('div', 'sh-cut-layer', parent);
    const marks = svg('svg', { class: 'sh-cut-marks', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, layer);
    const node = el('div', 'sh-scissors is-staged', layer);
    const markPaths = times.map((time) => {
      if (time === null) return null;
      const markPath = svg('path', { class: 'sh-cut-mark', d: 'M 0 0' }, marks);
      fx.draw(markPath, time, 0.12);
      if (until !== undefined) fx.fadeOut(markPath, until, 0.2);
      return markPath;
    });
    let cuts = null;
    onFrame((t) => {
      if (!cuts) {
        const gaps = row.cuts();
        if (!gaps) return;
        cuts = gaps.map((gap, i) => ({ ...gap, at: times[i] })).filter((cut) => cut.at !== null && cut.at !== undefined);
        gaps.forEach((gap, i) => {
          if (markPaths[i]) markPaths[i].setAttribute('d', `M ${gap.x.toFixed(1)} ${(gap.y - 26).toFixed(1)} V ${(gap.y + 26).toFixed(1)}`);
        });
      }
      let x = cuts[0].x - 70;
      let y = cuts[0].y;
      for (const cut of cuts) {
        const p = easeInOutCubic(progress(t, cut.at - 0.32, 0.28));
        x += (cut.x - x) * p;
        y += (cut.y - y) * p;
      }
      // The pivot hangs just above the line, so the blades close across it.
      node.style.left = `${(x - 41).toFixed(1)}px`;
      node.style.top = `${(y - 96).toFixed(1)}px`;
    });
    const art = svg('svg', { viewBox: '-34 -48 68 96', width: 82, height: 116, 'aria-hidden': 'true' }, node);
    const blades = [-1, 1].map((side) => {
      const g = svg('g', {}, art);
      // Each half crosses the pivot: its handle on one side, its blade on the other.
      svg('path', { class: 'sh-blade', d: `M ${2 * side} 2 L ${-3 * side} 40 Q ${-1 * side} 46 ${1 * side} 40 L ${4 * side} 4 Z` }, g);
      svg('ellipse', { class: 'sh-handle', cx: 12 * side, cy: -24, rx: 9, ry: 13 }, g);
      svg('ellipse', { class: 'sh-handle-hole', cx: 12 * side, cy: -24, rx: 4.5, ry: 8 }, g);
      svg('path', { class: 'sh-handle', d: `M ${5 * side} -12 L ${-2 * side} 4 L ${2 * side} 6 L ${9 * side} -10 Z` }, g);
      return { g, side };
    });
    svg('circle', { class: 'sh-pivot', r: 3.6, cx: 0, cy: 4 }, art);
    const snips = times.filter((time) => time !== null && time !== undefined);
    fx.fadeIn(node, from ?? snips[0] - 0.45, 0.2);
    if (until !== undefined) fx.fadeOut(node, until, 0.2);
    onFrame((t) => {
      let close = 0;
      for (const time of snips) close = Math.max(close, blip(t, time - 0.06, 0.2));
      const angle = 16 * (1 - close);
      for (const { g, side } of blades) g.setAttribute('transform', `rotate(${(angle * side).toFixed(2)} 0 4)`);
    });
    return node;
  }

  // ------------------------------------------------------------------
  // PATH: a filing cabinet searched drawer by drawer; the desk beside it
  // ------------------------------------------------------------------

  /** drawers = [{ label, files }]; open(i, at, closeAt) slides drawer i's tray out. */
  function cabinet(parent, { x, y, w = 250, drawers, at, title = 'PATH' }) {
    const node = place(el('div', 'sh-cabinet is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'sh-cabinet-head', node);
    el('b', null, head, title);
    head.append(document.createTextNode(' searched in order'));
    const items = drawers.map((drawer, i) => {
      const row = el('div', 'sh-drawer', node);
      const tray = el('div', 'sh-drawer-tray', row);
      tray.style.left = `${w - 30}px`;
      const files = drawer.files.map((name) => el('span', 'sh-drawer-file', tray, name));
      const front = el('div', 'sh-drawer-front', row);
      el('span', 'sh-drawer-number', front, String(i + 1));
      el('span', 'sh-drawer-label', front, drawer.label);
      el('span', 'sh-drawer-handle', front);
      return { row, tray, front, files };
    });
    el('div', 'sh-cabinet-base', node);
    fx.rise(node, at, { distance: 22, duration: 0.4 });
    return {
      node,
      drawer: (i) => items[i],
      open(i, time, closeAt) {
        tween(items[i].tray, [{ translate: '-206px 0' }, { translate: '0 0' }], time, 0.28, EASE.out);
        fx.bump(items[i].front, time, 0.04);
        if (closeAt !== undefined) tween(items[i].tray, { translate: '-206px 0' }, closeAt, 0.24, EASE.in);
      },
      hit(i, fileIndex, time) {
        const file = items[i].files[fileIndex];
        onFrame((t) => file.classList.toggle('sh-drawer-file--hit', t >= time));
        tween(file, [{ opacity: 0.55, scale: 1 }, { opacity: 1, scale: 1.18 }, { opacity: 1, scale: 1 }], time, 0.4, EASE.out);
      },
      verdict(i, time, ok, until) {
        const mark = el('div', `sh-verdict sh-verdict--${ok ? 'ok' : 'no'} is-staged`, items[i].front);
        mark.append(icon(ok ? 'check' : 'cross'));
        fx.pop(mark, time, { from: 0.4, rotate: 0 });
        if (until !== undefined) fx.popOut(mark, until);
        return mark;
      },
    };
  }

  /** A folder lying on a desk: the current directory, outside the cabinet. */
  function desk(parent, { x, y, w = 270, label, files, at }) {
    const node = place(el('div', 'sh-desk is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const folder = el('div', 'sh-desk-folder', node);
    const head = el('div', 'sh-desk-title', folder);
    head.append(icon('folder'));
    head.append(document.createTextNode(label));
    const rows = files.map((name) => el('div', 'sh-desk-file', folder, name));
    const art = svg('svg', { class: 'sh-desk-art', viewBox: `0 0 ${w} 70`, width: w, height: 70, 'aria-hidden': 'true' }, node);
    const id = `sh-desk-${++uid}`;
    const wood = svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, svg('defs', {}, art));
    svg('stop', { offset: 0, 'stop-color': '#a0703f' }, wood);
    svg('stop', { offset: 1, 'stop-color': '#6b4423' }, wood);
    svg('rect', { x: 0, y: 0, width: w, height: 14, rx: 4, fill: `url(#${id})` }, art);
    svg('rect', { x: 0, y: 12, width: w, height: 3, fill: 'rgba(0,0,0,0.35)' }, art);
    svg('rect', { x: 16, y: 14, width: 12, height: 56, rx: 2, fill: '#5a3a1e' }, art);
    svg('rect', { x: w - 28, y: 14, width: 12, height: 56, rx: 2, fill: '#5a3a1e' }, art);
    fx.rise(node, at, { distance: 20, duration: 0.4 });
    return {
      node, folder,
      hit(index, time) {
        onFrame((t) => rows[index].classList.toggle('sh-desk-file--hit', t >= time));
        fx.bump(rows[index], time, 0.16);
      },
      verdict(time, ok) {
        const mark = el('div', `sh-verdict sh-verdict--${ok ? 'ok' : 'no'} is-staged`, folder);
        mark.append(icon(ok ? 'check' : 'cross'));
        fx.pop(mark, time, { from: 0.4, rotate: 0 });
        return mark;
      },
    };
  }

  // ------------------------------------------------------------------
  // A directory tree with a map pin, a full address, and directions
  // ------------------------------------------------------------------

  /**
   * nodes = [{ id, name, col, row, parent, at, root }]: a folder chip per node
   * at (x + col·dx, y + row·dy), joined to its parent by an elbow connector.
   */
  function tree(parent, { x, y, dx = 96, dy = 44, nodes }) {
    const art = svg('svg', { class: 'sh-tree', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    const byId = new Map();
    for (const spec of nodes) {
      const px = x + spec.col * dx;
      const py = y + spec.row * dy;
      const node = place(el('div', `sh-folder${spec.root ? ' sh-folder--root' : ''} is-staged`, parent), px, py);
      node.append(icon(spec.root ? 'chip' : 'folder'));
      node.append(document.createTextNode(spec.name));
      fx.pop(node, spec.at, { from: 0.6, rotate: 0 });
      byId.set(spec.id, { ...spec, node, px, py });
      if (spec.parent) {
        const up = byId.get(spec.parent);
        const path = svg('path', { class: 'sh-tree-line', d: `M ${up.px + 16} ${up.py + 30} V ${py + 15} H ${px}` }, art);
        fx.draw(path, spec.at - 0.05, 0.3);
      }
    }
    const anchor = (id) => {
      const n = byId.get(id);
      return [n.px + 16, n.py + 15];
    };
    return {
      node: (id) => byId.get(id),
      /** Draws a highlighted route through ids (parent→child or child→parent). */
      route(ids, at, { tone = 'gold', perHop = 0.24, until } = {}) {
        const points = ids.map(anchor);
        let d = `M ${points[0][0]} ${points[0][1]}`;
        for (let i = 1; i < points.length; i++) {
          const [, py] = points[i - 1];
          const [cx, cy] = points[i];
          d += cy > py ? ` V ${cy} H ${cx}` : ` H ${cx} V ${cy}`;
        }
        const path = svg('path', { class: `sh-tree-route sh-tree-route--${tone}`, d }, art);
        fx.draw(path, at, perHop * (ids.length - 1));
        ids.forEach((id, i) => fx.bump(byId.get(id).node, at + perHop * i, 0.1));
        if (until !== undefined) fx.fadeOut(path, until, 0.25);
        return path;
      },
      /** A notation tag beside a node: `..`, `~`, `.`; iconName adds a marker. */
      tag(id, text, at, { tone = 'gold', until, note, iconName } = {}) {
        // A child of the folder chip, placed beside it by CSS: no measuring.
        const node = el('div', `sh-tag sh-tag--${tone} sh-tag--beside is-staged`, byId.get(id).node);
        if (iconName) node.append(icon(iconName, 'sh-tag-icon'));
        el('code', 'sh-tag-code', node, text);
        if (note) el('span', 'sh-tag-note', node, note);
        fx.pop(node, at, { from: 0.5, rotate: 0 });
        if (until !== undefined) fx.popOut(node, until);
        return node;
      },
    };
  }

  /** A path card: an absolute path as a full address, a relative one as directions. */
  function pathCard(parent, { x, y, kind, path, at, tone, iconName, note }) {
    const node = place(el('div', `sh-path sh-path--${tone} is-staged`, parent), x, y);
    const head = el('div', 'sh-path-kind', node);
    head.append(icon(iconName));
    head.append(document.createTextNode(kind));
    el('code', 'sh-path-text', node, path);
    if (note) el('div', 'sh-path-note', node, note);
    fx.pop(node, at, { rotate: 0 });
    return node;
  }

  // ------------------------------------------------------------------
  // Pipelines: a conveyor belt of small machines
  // ------------------------------------------------------------------

  function gearPath(teeth, outer, inner) {
    let d = '';
    for (let i = 0; i < teeth * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a0 = (i / (teeth * 2)) * Math.PI * 2;
      const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
      const p = (a) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
      d += `${i === 0 ? 'M' : 'L'} ${p(a0)} L ${p(a1)} `;
    }
    return `${d}Z`;
  }

  /**
   * A machine that does one job: a sign with its command, a housing with a
   * turning gear and a job plate, an intake and an outlet at belt height, a
   * side hatch for errors, and a beacon that shows its exit code.
   */
  function machine(parent, { x, y, w = 196, cmd, job, at, jobAt, spinFrom }) {
    const node = place(el('div', 'sh-machine is-staged', parent), x, y);
    node.style.width = `${w}px`;
    el('div', 'sh-machine-sign', node, cmd);
    const body = el('div', 'sh-machine-body', node);
    const art = svg('svg', { class: 'sh-machine-art', viewBox: `0 0 ${w} 92`, width: w, height: 92, 'aria-hidden': 'true' }, body);
    const id = `sh-machine-${++uid}`;
    const steel = svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, svg('defs', {}, art));
    svg('stop', { offset: 0, 'stop-color': '#9fb2d8' }, steel);
    svg('stop', { offset: 1, 'stop-color': '#55678f' }, steel);
    const gear = svg('g', {}, art);
    svg('path', { class: 'sh-gear', d: gearPath(9, 21, 16), fill: `url(#${id})` }, gear);
    svg('circle', { class: 'sh-gear-hub', r: 6 }, gear);
    const gx = w - 50;
    const gy = 58;
    for (const rx of [10, w - 10]) for (const ry of [10, 82]) svg('circle', { class: 'sh-rivet', cx: rx, cy: ry, r: 2.4 }, art);
    el('div', 'sh-machine-intake', body);
    el('div', 'sh-machine-outlet', body);
    const hatch = el('div', 'sh-machine-hatch', body);
    const jobNode = el('div', 'sh-machine-job is-staged', body, job);
    const lampNode = el('div', 'sh-lamp is-staged', node);
    const lampIcon = el('span', 'sh-lamp-icon', lampNode);
    const lampText = el('span', 'sh-lamp-text', lampNode);
    const states = [];
    const spin = spinFrom ?? at;
    fx.rise(node, at, { distance: 26, duration: 0.4 });
    fx.pop(jobNode, jobAt ?? at + 0.3, { from: 0.6, rotate: -3 });
    let shownCode = null;
    onFrame((t) => {
      const turn = Math.max(0, t - spin) * 110;
      gear.setAttribute('transform', `translate(${gx} ${gy}) rotate(${turn.toFixed(1)})`);
      const state = latest(states, t);
      const code = state ? state.code : null;
      if (code === shownCode) return;
      shownCode = code;
      lampNode.classList.toggle('sh-lamp--ok', code === 0);
      lampNode.classList.toggle('sh-lamp--bad', code !== null && code !== 0);
      lampText.textContent = code === null ? '' : `exit ${code}`;
      lampIcon.replaceChildren(icon(code === 0 ? 'check' : 'cross'));
    });
    return {
      node, x, y, w,
      /** Belt-height points: where text goes in and comes out. */
      intake: [x, y + 118],
      outlet: [x + w, y + 118],
      hatchPoint: [x + w / 2, y + 112],
      lamp(time, code) {
        if (!states.length) fx.pop(lampNode, time, { from: 0.5, rotate: 0 });
        else fx.bump(lampNode, time, 0.25);
        states.push({ at: time, code });
        states.sort((a, b) => a.at - b.at);
        return this;
      },
      openHatch(time, closeAt) {
        tween(hatch, [{ rotate: 'x 0deg' }, { rotate: 'x 70deg' }], time, 0.2, EASE.out);
        if (closeAt !== undefined) tween(hatch, { rotate: 'x 0deg' }, closeAt, 0.2, EASE.in);
      },
    };
  }

  /**
   * The conveyor belt under the machines: a moving tread on rollers and
   * paper slips riding along it. The machines are drawn after the belt, so
   * slips pass "through" them. tints = [{ x, cls }] recolor a slip past x.
   */
  function belt(parent, { x1, x2, y, at, flowFrom, until, tints = [] }) {
    const art = svg('svg', { class: 'sh-belt is-staged', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    for (let lx = x1 + 60; lx < x2 - 30; lx += 210) {
      svg('path', { class: 'sh-belt-leg', d: `M ${lx} ${y + 8} L ${lx - 10} ${y + 46} M ${lx} ${y + 8} L ${lx + 10} ${y + 46}` }, art);
    }
    svg('rect', { class: 'sh-belt-band', x: x1, y: y - 10, width: x2 - x1, height: 20, rx: 10 }, art);
    const tread = svg('path', { class: 'sh-belt-tread', d: `M ${x1 + 10} ${y - 6} H ${x2 - 10}` }, art);
    const rollers = [];
    for (let rx = x1 + 12; rx <= x2 - 12; rx += 46) {
      const g = svg('g', { transform: `translate(${rx} ${y + 2})` }, art);
      svg('circle', { class: 'sh-belt-roller', r: 6 }, g);
      const spoke = svg('path', { class: 'sh-belt-spoke', d: 'M -4 0 H 4' }, g);
      rollers.push(spoke);
    }
    const SPACING = 74;
    const SPEED = 58;
    const count = Math.ceil((x2 - x1) / SPACING) + 1;
    const slips = Array.from({ length: count }, () => {
      const g = svg('g', { class: 'sh-slip' }, art);
      svg('rect', { class: 'sh-slip-paper', x: -13, y: -17, width: 26, height: 17, rx: 2.5 }, g);
      svg('path', { class: 'sh-slip-lines', d: 'M -8 -12 H 8 M -8 -7.5 H 5 M -8 -3 H 7' }, g);
      return g;
    });
    const start = flowFrom ?? at + 0.6;
    fx.fadeIn(art, at, 0.3);
    if (until !== undefined) fx.fadeOut(art, until, 0.3);
    onFrame((t) => {
      const moving = Math.max(0, t - at);
      tread.style.strokeDashoffset = (-(moving * SPEED) % 18).toFixed(2);
      const turn = (moving * SPEED / 6) * (180 / Math.PI);
      for (const spoke of rollers) spoke.setAttribute('transform', `rotate(${(turn % 360).toFixed(1)})`);
      const flowing = t >= start;
      slips.forEach((slip, i) => {
        if (!flowing) {
          slip.setAttribute('opacity', '0');
          return;
        }
        const travel = (t - start) * SPEED + i * SPACING;
        const sx = x1 + 8 + (travel % (count * SPACING));
        if (sx > x2 - 10) {
          slip.setAttribute('opacity', '0');
          return;
        }
        // Slips fade in at the left end, as if fed from the input file.
        const fade = clamp((sx - x1) / 40, 0, 1) * clamp((x2 - sx) / 40, 0, 1);
        slip.setAttribute('opacity', fade.toFixed(3));
        slip.setAttribute('transform', `translate(${sx.toFixed(1)} ${y - 10})`);
        let cls = 'sh-slip';
        for (const tint of tints) if (sx >= tint.x) cls = `sh-slip ${tint.cls}`;
        if (slip.getAttribute('class') !== cls) slip.setAttribute('class', cls);
      });
    });
    return art;
  }

  /** A small card of text lines (what rides a stretch of belt); lines pop in order. */
  function dataCard(parent, { x, y, w = 150, title, lines, at, step = 0.1, tone = 'cyan', until }) {
    const node = place(el('div', `sh-data sh-data--${tone} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    if (title) el('div', 'sh-data-title', node, title);
    const rows = lines.map((text, i) => {
      const row = el('div', 'sh-data-line is-staged', node, text);
      fx.slideIn(row, at + 0.12 + i * step, { dx: -16, duration: 0.25 });
      return row;
    });
    fx.pop(node, at, { from: 0.7, rotate: 0 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return { node, rows };
  }

  // ------------------------------------------------------------------
  // Scripts: code cards with a line-number gutter and markable segments
  // ------------------------------------------------------------------

  /**
   * lines = [[segment, ...], ...]; a segment is a string or { t, id, cls }.
   * glow(i, at, until) lights a line; mark(id, at, until) rings a segment;
   * fill(id, text, at) drops a value onto a segment.
   */
  function script(parent, { x, y, w, title, lines, at, lineAts = [] }) {
    const node = place(el('div', 'code-card sh-script is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'code-card-title sh-script-title', node);
    head.append(icon('file'));
    head.append(document.createTextNode(title));
    const segs = new Map();
    const lineNodes = lines.map((segments, i) => {
      const line = el('div', 'code-line sh-script-line', node);
      const glow = el('div', 'sh-line-glow is-staged', line);
      el('span', 'sh-gutter', line, String(i + 1));
      for (const segment of segments) {
        const spec = typeof segment === 'string' ? { t: segment } : segment;
        const span = el('span', `sh-seg${spec.cls ? ` ${spec.cls}` : ''}`, line, spec.t);
        if (spec.id) segs.set(spec.id, span);
      }
      if (lineAts[i] !== undefined) {
        line.classList.add('is-staged');
        fx.slideIn(line, lineAts[i], { dx: -20, duration: 0.3 });
      }
      return { line, glow };
    });
    fx.rise(node, at, { distance: 24, duration: 0.4 });
    return {
      node,
      seg: (id) => segs.get(id),
      line: (i) => lineNodes[i].line,
      /** A value dropping onto a segment's blank, such as the word a run puts in $1. */
      fill(id, text, time, until) {
        const chip = el('span', 'sh-seg-fill is-staged', segs.get(id), text);
        tween(chip, [{ opacity: 0, translate: '-50% 34px' }, { opacity: 1, translate: '-50% 8px' }], time, 0.4, EASE.back);
        if (until !== undefined) fx.fadeOut(chip, until, 0.25);
        return chip;
      },
      glow(i, time, until, tone = 'gold') {
        const glow = lineNodes[i].glow;
        glow.classList.add(`sh-line-glow--${tone}`);
        fx.fadeIn(glow, time, 0.15);
        if (until !== undefined) fx.fadeOut(glow, until, 0.25);
      },
      mark(id, time, until, tone = 'gold') {
        const span = segs.get(id);
        // A space is underlined rather than ringed, so its neighbours stay readable.
        const space = span.classList.contains('sh-seg--space') ? ' sh-seg-ring--space' : '';
        const ring = el('span', `sh-seg-ring sh-seg-ring--${tone}${space} is-staged`, span);
        fx.pop(ring, time, { from: 0.6, rotate: 0 });
        if (until !== undefined) fx.fadeOut(ring, until, 0.2);
        return ring;
      },
    };
  }

  /** The shebang as an address label tied to the script's first line. */
  function addressLabel(parent, { x, y, from, to, text, at, note }) {
    const string = svg('svg', { class: 'sh-label-string is-staged', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    const [fx0, fy0] = from;
    svg('path', { class: 'sh-label-cord', d: `M ${fx0} ${fy0} C ${fx0 + 40} ${fy0 + 30}, ${x - 40} ${y + 40}, ${x + 6} ${y + 22}` }, string);
    const node = place(el('div', 'sh-luggage is-staged', parent), x, y);
    el('span', 'sh-luggage-hole', node);
    el('span', 'sh-luggage-to', node, 'TO');
    el('code', 'sh-luggage-text', node, text);
    if (note) el('span', 'sh-luggage-note', node, note);
    fx.fadeIn(string, at, 0.2);
    fx.pop(node, at + 0.05, { from: 0.5, rotate: -6 });
    if (to !== undefined) {
      fx.fadeOut(string, to, 0.25);
      fx.fadeOut(node, to, 0.25);
    }
    return node;
  }

  /** A padlock: closed until `openAt` (if given), then the shackle lifts. */
  function padlock(parent, { x, y, at, openAt, until, size = 46 }) {
    const node = place(el('div', 'sh-padlock is-staged', parent), x, y);
    const art = svg('svg', { viewBox: '0 0 46 56', width: size, height: size * 56 / 46, 'aria-hidden': 'true' }, node);
    const shackle = svg('path', { class: 'sh-padlock-shackle', d: 'M 12 26 V 16 a 11 11 0 0 1 22 0 V 26' }, art);
    const body = svg('rect', { class: 'sh-padlock-body', x: 4, y: 24, width: 38, height: 30, rx: 6 }, art);
    svg('path', { class: 'sh-padlock-key', d: 'M 23 33 a 4 4 0 1 1 0.1 0 M 23 37 V 45' }, art);
    fx.pop(node, at, { from: 0.5, rotate: 0 });
    if (openAt !== undefined) {
      tween(shackle, [{ translate: '0 0', rotate: '0deg' }, { translate: '0 -7px', rotate: '-18deg' }], openAt, 0.3, EASE.back);
      onFrame((t) => body.classList.toggle('is-open', t >= openAt));
      fx.bump(node, openAt, 0.2);
    }
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /** Permission bits that flip from `before` to `after` (one cell per character). */
  function perms(parent, { x, y, before, after, at, changeAt, labels = true, until, ghost = false }) {
    const node = place(el('div', `sh-perms${ghost ? ' sh-perms--ghost' : ''} is-staged`, parent), x, y);
    const row = el('div', 'sh-perm-row', node);
    [...before].forEach((char, i) => {
      const cell = el('span', `sh-perm-cell${i === 0 ? ' sh-perm-cell--type' : ''}`, row, char);
      if (changeAt !== undefined && after && after[i] !== char) {
        const order = [...after].slice(0, i).filter((c, j) => c !== before[j]).length;
        const time = changeAt + 0.1 * order;
        onFrame((t) => {
          const on = t >= time;
          cell.textContent = on ? after[i] : char;
          cell.classList.toggle('is-new', on);
        });
        fx.bump(cell, time, 0.35);
      }
    });
    if (labels) {
      const legend = el('div', 'sh-perm-legend', node);
      for (const group of ['owner', 'group', 'others']) el('span', 'sh-perm-group', legend, group);
    }
    fx.rise(node, at, { distance: 18, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return { node };
  }

  /** A labeled box (a variable) that a value slip drops into. */
  function variableBox(parent, { x, y, name, value, at, dropAt }) {
    const node = place(el('div', 'sh-varbox is-staged', parent), x, y);
    const slip = el('code', 'sh-varbox-value is-staged', node, value);
    const art = svg('svg', { class: 'sh-varbox-art', viewBox: '0 0 150 92', width: 150, height: 92, 'aria-hidden': 'true' }, node);
    svg('path', { class: 'sh-varbox-flap', d: 'M 6 30 L 22 8 H 128 L 144 30 Z' }, art);
    svg('rect', { class: 'sh-varbox-body', x: 6, y: 30, width: 138, height: 58, rx: 5 }, art);
    svg('path', { class: 'sh-varbox-tape', d: 'M 64 30 H 86 V 88 H 64 Z' }, art);
    el('code', 'sh-varbox-name', node, name);
    fx.pop(node, at, { from: 0.6, rotate: -2 });
    tween(slip, [{ opacity: 0, translate: '0 -70px', rotate: '-8deg' }, { opacity: 1, translate: '0 0', rotate: '0deg' }], dropAt, 0.4, EASE.out);
    return node;
  }

  /** The `$?` scoreboard: values = [{ at, code, note }]. */
  function exitBoard(parent, { x, y, at, values, label = '$?', until }) {
    const node = place(el('div', 'sh-exit is-staged', parent), x, y);
    el('code', 'sh-exit-label', node, label);
    const digit = el('div', 'sh-exit-digit', node, '');
    const note = el('div', 'sh-exit-note', node, '');
    const sorted = [...values].sort((a, b) => a.at - b.at);
    let shown = null;
    onFrame((t) => {
      const value = latest(sorted, t);
      if (value === shown) return;
      shown = value;
      digit.textContent = value ? String(value.code) : '';
      note.textContent = value ? (value.note || '') : '';
      node.classList.toggle('sh-exit--ok', !!value && value.code === 0);
      node.classList.toggle('sh-exit--bad', !!value && value.code !== 0);
    });
    for (const value of sorted) fx.bump(digit, value.at, 0.3);
    fx.pop(node, at, { from: 0.6, rotate: 0 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /**
   * `if` as a decision diamond: the condition's exit code is checked; 0 takes
   * the green branch to `then`, anything else goes on to `fi`.
   */
  function decision(parent, { x, y, cond, thenText, elseText, at, checkAt, yesAt }) {
    const art = svg('svg', { class: 'sh-flow is-staged', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    const cx = x + 86;
    const cy = y + 92;
    const down = svg('path', { class: 'sh-flow-arrow', d: `M ${cx} ${y + 36} V ${cy - 34}` }, art);
    svg('path', { class: 'sh-flow-diamond', d: `M ${cx} ${cy - 32} L ${cx + 50} ${cy} L ${cx} ${cy + 32} L ${cx - 50} ${cy} Z` }, art);
    const yes = svg('path', { class: 'sh-flow-arrow sh-flow-arrow--yes', d: `M ${cx} ${cy + 32} V ${cy + 84}` }, art);
    const no = svg('path', { class: 'sh-flow-arrow sh-flow-arrow--no', d: `M ${cx + 50} ${cy} H ${cx + 146}` }, art);
    fx.fadeIn(art, at, 0.25);
    fx.draw(down, at + 0.1, 0.25);
    fx.draw(no, at + 0.3, 0.25);
    fx.draw(yes, yesAt, 0.3);
    const condNode = place(el('code', 'sh-flow-box is-staged', parent, cond), x, y);
    fx.pop(condNode, at, { from: 0.6, rotate: 0 });
    const ask = place(el('div', 'sh-flow-ask is-staged', parent, 'exit 0?'), cx - 40, cy - 12);
    fx.fadeIn(ask, at + 0.25, 0.2);
    const yesLabel = place(el('span', 'sh-flow-tag sh-flow-tag--yes is-staged', parent, 'exit 0 → then'), cx + 10, cy + 44);
    fx.pop(yesLabel, yesAt, { from: 0.6, rotate: 0 });
    const noLabel = place(el('span', 'sh-flow-tag is-staged', parent, 'else → fi'), cx + 54, cy - 34);
    fx.pop(noLabel, at + 0.45, { from: 0.6, rotate: 0 });
    const thenNode = place(el('code', 'sh-flow-box sh-flow-box--yes is-staged', parent, thenText), x - 10, cy + 90);
    fx.pop(thenNode, yesAt + 0.2, { from: 0.6, rotate: 0 });
    const elseNode = place(el('code', 'sh-flow-box sh-flow-box--muted is-staged', parent, elseText), cx + 150, cy - 18);
    fx.pop(elseNode, at + 0.5, { from: 0.6, rotate: 0 });
    fx.bump(condNode, checkAt, 0.12);
    return { art, condNode, thenNode };
  }

  /** `left && right` with a boom gate that lifts only when `left` exits 0. */
  function gate(parent, { x, y, left, right, at, leftAt, gateAt, rightAt, code, codeAt, until }) {
    const node = place(el('div', 'sh-gate is-staged', parent), x, y);
    const a = el('code', 'sh-gate-cmd is-staged', node, left);
    const barrier = el('div', 'sh-gate-barrier is-staged', node);
    const post = el('div', 'sh-gate-post', barrier);
    el('code', 'sh-gate-sign', post, '&&');
    const arm = el('div', 'sh-gate-arm', barrier);
    const light = el('span', 'sh-gate-light', post);
    const b = el('code', 'sh-gate-cmd is-staged', node, right);
    fx.fadeIn(node, at, 0.2);
    fx.pop(a, leftAt ?? at, { from: 0.6, rotate: 0 });
    fx.pop(barrier, gateAt ?? at + 0.3, { from: 0.6, rotate: 0 });
    fx.pop(b, rightAt ?? at + 0.6, { from: 0.6, rotate: 0 });
    const lamp = el('span', `sh-gate-lamp sh-gate-lamp--${code === 0 ? 'ok' : 'bad'} is-staged`, a);
    lamp.append(icon(code === 0 ? 'check' : 'cross'));
    lamp.append(document.createTextNode(`exit ${code}`));
    fx.pop(lamp, codeAt, { from: 0.5, rotate: 0 });
    onFrame((t) => light.classList.toggle(code === 0 ? 'is-go' : 'is-stop', t >= codeAt));
    if (code === 0) {
      tween(arm, [{ rotate: '0deg' }, { rotate: '-72deg' }], codeAt + 0.1, 0.4, EASE.back);
      tween(b, [{ boxShadow: '0 0 0 0 rgba(74, 222, 128, 0)' }, { boxShadow: '0 0 0 4px rgba(74, 222, 128, 0.9)' }], codeAt + 0.35, 0.25, EASE.out);
    } else {
      fx.bump(arm, codeAt + 0.05, 0.06);
      tween(b, { opacity: 0.38 }, codeAt + 0.25, 0.3, EASE.inOut);
      const skipped = el('span', 'sh-gate-skip is-staged', b, 'skipped');
      fx.pop(skipped, codeAt + 0.3, { from: 0.5, rotate: -4 });
    }
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  // ------------------------------------------------------------------
  // Trip photos, a rubber stamp, a thought cloud
  // ------------------------------------------------------------------

  const SCENES = [
    { sky: ['#ffb36b', '#ff6f91'], hill: '#6c3fb5', far: '#a35bd6', sun: '#ffe08a' },
    { sky: ['#7dd3fc', '#3b82f6'], hill: '#0f766e', far: '#14b8a6', sun: '#fef3c7' },
    { sky: ['#fde68a', '#fb923c'], hill: '#b45309', far: '#f59e0b', sun: '#fff7d6' },
    { sky: ['#c4b5fd', '#6366f1'], hill: '#1e3a8a', far: '#4f46e5', sun: '#e0e7ff' },
  ];

  function thumbnail(parent, variant) {
    const id = `sh-photo-${++uid}`;
    const look = SCENES[variant % SCENES.length];
    const art = svg('svg', { class: 'sh-photo-art', viewBox: '0 0 124 74', 'aria-hidden': 'true' }, parent);
    const defs = svg('defs', {}, art);
    const sky = svg('linearGradient', { id: `${id}-sky`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg('stop', { offset: 0, 'stop-color': look.sky[0] }, sky);
    svg('stop', { offset: 1, 'stop-color': look.sky[1] }, sky);
    svg('rect', { width: 124, height: 74, fill: `url(#${id}-sky)` }, art);
    svg('circle', { cx: 30 + (variant * 23) % 64, cy: 24, r: 9, fill: look.sun }, art);
    svg('path', { d: 'M0 54 L28 31 L47 45 L72 22 L103 47 L124 37 V74 H0 Z', fill: look.far, opacity: 0.85 }, art);
    svg('path', { d: 'M0 64 Q31 47 60 59 T124 55 V74 H0 Z', fill: look.hill }, art);
    return art;
  }

  /** A photo card; renames = [{ at, name }] flips its file name over time. */
  function photo(parent, { x, y, name, renames = [], at, variant = 0, rotate = 0 }) {
    const node = place(el('div', 'sh-photo is-staged', parent), x, y);
    thumbnail(node, variant);
    const label = el('div', 'sh-photo-name', node, name);
    const changes = [...renames].sort((a, b) => a.at - b.at);
    if (changes.length) {
      onFrame((t) => {
        const change = latest(changes, t);
        const text = change ? change.name : name;
        if (label.textContent !== text) label.textContent = text;
        label.classList.toggle('is-renamed', !!change);
      });
      for (const change of changes) fx.bump(node, change.at, 0.12);
    }
    fx.pop(node, at, { from: 0.5, rotate });
    return node;
  }

  /** A rubber stamp reading `text` that visits stops = [{ at, x, y }] and presses at each. */
  function rubberStamp(parent, { text, stops, from, until }) {
    const node = el('div', 'sh-stamp-tool is-staged', parent);
    const art = svg('svg', { viewBox: '0 0 96 104', width: 96, height: 104, 'aria-hidden': 'true' }, node);
    const id = `sh-stamp-${++uid}`;
    const wood = svg('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 0 }, svg('defs', {}, art));
    svg('stop', { offset: 0, 'stop-color': '#7c4a24' }, wood);
    svg('stop', { offset: 0.5, 'stop-color': '#c0834a' }, wood);
    svg('stop', { offset: 1, 'stop-color': '#7c4a24' }, wood);
    svg('ellipse', { cx: 48, cy: 16, rx: 18, ry: 14, fill: `url(#${id})` }, art);
    svg('rect', { x: 40, y: 26, width: 16, height: 30, rx: 4, fill: `url(#${id})` }, art);
    svg('rect', { x: 12, y: 54, width: 72, height: 22, rx: 4, fill: '#30405f' }, art);
    svg('rect', { x: 14, y: 74, width: 68, height: 20, rx: 3, fill: '#ff5fb0' }, art);
    el('code', 'sh-stamp-text', node, text);
    mover(node, [{ x: stops[0].x, y: stops[0].y - 40 }, ...stops.map((stop) => ({ at: stop.at - 0.35, x: stop.x, y: stop.y - 40, duration: 0.3 }))]);
    fx.fadeIn(node, from ?? stops[0].at - 0.5, 0.2);
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    onFrame((t) => {
      let press = 0;
      for (const stop of stops) press = Math.max(press, blip(t, stop.at - 0.08, 0.26));
      node.style.transform = `translateY(${(press * 26).toFixed(1)}px) scaleY(${(1 - press * 0.06).toFixed(3)})`;
    });
    return node;
  }

  /** A thought cloud (what you meant), as opposed to what you typed. */
  function thought(parent, { x, y, w = 250, text, at, popAt }) {
    const node = place(el('div', 'sh-thought is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const art = svg('svg', { class: 'sh-thought-art', viewBox: '0 0 250 130', width: w, height: w * 130 / 250, 'aria-hidden': 'true', preserveAspectRatio: 'none' }, node);
    svg('path', { class: 'sh-thought-cloud', d: 'M48 104 C 16 104 6 74 28 60 C 18 34 50 16 74 30 C 86 6 130 6 142 28 C 162 10 204 18 204 46 C 236 50 244 92 210 102 C 200 120 160 120 148 108 C 132 124 92 122 82 106 C 72 112 58 110 48 104 Z' }, art);
    svg('circle', { class: 'sh-thought-cloud', cx: 40, cy: 122, r: 6 }, art);
    el('div', 'sh-thought-text', node, text);
    fx.pop(node, at, { from: 0.6, rotate: -3 });
    if (popAt !== undefined) tween(node, { opacity: 0, scale: 1.25 }, popAt, 0.3, EASE.in);
    return node;
  }

  // ------------------------------------------------------------------
  // The chant: one collectible card at a time, filling a toolbox
  // ------------------------------------------------------------------

  const CARD = { x: 652, y: 106, w: 288 };

  function toolCard(parent, { cmd, gist, flag, iconName, category, tone, number, total, at, gistAt, until }) {
    const node = place(el('div', `sh-card sh-card--${tone} is-staged`, parent), CARD.x, CARD.y);
    node.style.width = `${CARD.w}px`;
    const face = el('div', 'sh-card-face', node);
    const top = el('div', 'sh-card-top', face);
    el('span', 'sh-card-cat', top, category);
    el('span', 'sh-card-number', top, `${number}/${total}`);
    const medal = el('div', 'sh-card-art', face);
    medal.append(icon(iconName, 'sh-card-icon'));
    const size = cmd.length > 7 ? ' sh-card-cmd--longer' : cmd.length > 5 ? ' sh-card-cmd--long' : '';
    el('div', `sh-card-cmd${size}`, face, cmd);
    const gistNode = el('div', 'sh-card-gist is-staged', face, gist);
    if (flag) {
      const flagNode = el('code', 'sh-card-flag is-staged', face, flag);
      fx.pop(flagNode, (gistAt ?? at + 0.4) + 0.25, { from: 0.6, rotate: 0 });
    }
    const sheen = el('div', 'sh-card-sheen', node);
    fx.slam(node, at, { from: 1.5, rotate: -2 });
    tween(sheen, [{ translate: '-120% 0' }, { translate: '220% 0' }], at + 0.12, 0.7, EASE.inOut);
    fx.rise(gistNode, gistAt ?? at + 0.4, { distance: 12, duration: 0.3 });
    if (until !== undefined) tween(node, { opacity: 0, scale: 0.4, translate: '-170px 50px' }, until - 0.22, 0.24, EASE.in);
    return node;
  }

  /** rows = [{ label, tone, items: [cmd, ...] }]: an open toolbox with labelled trays. */
  function toolbox(parent, { x, y, rows, at, tileW = 80, tileH = 38, gapX = 6, gapY = 10, labelW = 98 }) {
    const width = labelW + Math.max(...rows.map((row) => row.items.length)) * (tileW + gapX) + 14;
    const height = rows.length * (tileH + gapY) + 10;
    const node = place(el('div', 'sh-box is-staged', parent), x, y);
    const art = svg('svg', { class: 'sh-box-art', viewBox: `0 0 ${width + 28} ${height + 70}`, width: width + 28, height: height + 70, 'aria-hidden': 'true' }, node);
    const id = `sh-box-${++uid}`;
    const red = svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, svg('defs', {}, art));
    svg('stop', { offset: 0, 'stop-color': '#e2434b' }, red);
    svg('stop', { offset: 1, 'stop-color': '#8f1d2c' }, red);
    svg('path', { class: 'sh-box-handle', d: `M ${(width + 28) / 2 - 60} 30 V 14 a 10 10 0 0 1 10 -10 H ${(width + 28) / 2 + 50} a 10 10 0 0 1 10 10 V 30` }, art);
    svg('rect', { x: 0, y: 28, width: width + 28, height: height + 40, rx: 16, fill: `url(#${id})` }, art);
    svg('rect', { class: 'sh-box-inner', x: 10, y: 44, width: width + 8, height: height + 14, rx: 10 }, art);
    for (const lx of [24, width + 4]) svg('rect', { class: 'sh-box-latch', x: lx, y: 22, width: 18, height: 16, rx: 3 }, art);
    const title = place(el('div', 'sh-box-title', node, 'The Unix toolbox'), (width + 28) / 2, 34);
    title.style.translate = '-50% 0';
    const grid = place(el('div', 'sh-box-grid', node), 20, 54);
    const slots = new Map();
    rows.forEach((row, r) => {
      const top = r * (tileH + gapY);
      const label = place(el('div', `sh-box-label sh-box-label--${row.tone}`, grid, row.label), 0, top);
      label.style.width = `${labelW - 10}px`;
      row.items.forEach((cmd, i) => {
        const left = labelW + i * (tileW + gapX);
        const slot = place(el('div', 'sh-slot', grid), left, top);
        slot.style.width = `${tileW}px`;
        slot.style.height = `${tileH}px`;
        slots.set(cmd, { left, top, tone: row.tone });
      });
    });
    fx.rise(node, at, { distance: 24, duration: 0.45 });
    return {
      node,
      /** Fills a slot with the command's tile, flying in from the big card. */
      fill(cmd, time, iconName) {
        const slot = slots.get(cmd);
        const long = cmd.length >= 5;
        const tile = place(el('div', `sh-tile sh-tile--${slot.tone}${long ? ' sh-tile--long' : ''} is-staged`, grid), slot.left, slot.top);
        tile.style.width = `${tileW}px`;
        tile.style.height = `${tileH}px`;
        if (!long) tile.append(icon(iconName));
        tile.append(document.createTextNode(cmd));
        const fromX = CARD.x + CARD.w / 2 - (x + 20) - tileW / 2;
        const fromY = CARD.y + 130 - (y + 54);
        tween(tile, [
          { opacity: 0, translate: `${fromX - slot.left}px ${fromY - slot.top}px`, scale: 1.8 },
          { opacity: 1, translate: '0 0', scale: 1 },
        ], time, 0.42, EASE.inOut);
        return tile;
      },
    };
  }

  window.ShellKit = {
    session, commandResult, tokens, scissors, cabinet, desk, tree, pathCard, machine, belt, dataCard,
    script, addressLabel, padlock, perms, variableBox, exitBoard, decision, gate,
    photo, rubberStamp, thought, toolCard, toolbox, mover,
  };
})();
