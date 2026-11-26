/*
 * Artwork for the Pipes and Filters video narration (choreography:
 * js/video-narration/pipes-and-filters.js; styles: css/video-narration-
 * pipes-and-filters.css). It builds on the wall kit and the architecture kit
 * and adds the lesson's own objects:
 *
 *   the game photo, a receiver leaping for the catch in front of the stands,
 *     drawn so every filter's work is visible: noise speckles, darkness,
 *     a crop to the catch, fans' faces turned to blocks, and the paper's logo;
 *   a filter is a box with an input port and an output port and a light that
 *     says busy or idle in words; a pipe is a tube with an arrowhead that
 *     photos slide through; a batch is a timeline of bars that fill one
 *     after another; the website is a gallery that fills with photos.
 *
 * Every builder schedules its own motion on the Timeline, and every pose is a
 * pure function of narration time. Coordinates are CSS pixels inside the
 * picture's 960x540 body.
 */
(function () {
  'use strict';

  const { fx, onFrame, progress, easeInOutCubic } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, icon } = kit;
  const wall = window.WallKit;
  const { staged } = wall;
  const arch = window.ArchKit;
  const { show } = arch;

  // ------------------------------------------------------------------
  // The photo
  // ------------------------------------------------------------------

  /** The stands' fans: faces in two rows, behind the field. */
  const FACES = [[18, 18], [38, 14], [58, 19], [78, 15], [98, 18], [118, 14], [138, 19], [28, 32], [48, 30], [68, 33], [88, 30], [108, 33], [128, 30], [148, 32]];
  /** Noise speckles, scattered evenly over the frame. */
  const SPECKLES = Array.from({ length: 60 }, (_, i) => [((i * 37) % 160) + ((i * 7) % 5), ((i * 53) % 110) + ((i * 3) % 4)]);

  /**
   * The catch as a picture. look = { noise, dark, crop, blur }: speckles,
   * a dimming veil, a crop to the receiver, and faces turned to blocks.
   */
  function photoArt(parent, look = {}) {
    const box = look.crop ? '28 6 108 74' : '0 0 160 110';
    const art = svg('svg', { class: 'pf-photo-art', viewBox: box, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' }, parent);
    svg('rect', { x: 0, y: 0, width: 160, height: 44, class: 'pf-stands' }, art);
    FACES.forEach(([cx, cy]) => {
      if (look.blur) svg('rect', { x: cx - 6, y: cy - 6, width: 12, height: 12, class: 'pf-face-block' }, art);
      else svg('circle', { cx, cy, r: 6, class: 'pf-face' }, art);
    });
    svg('rect', { x: 0, y: 44, width: 160, height: 66, class: 'pf-field' }, art);
    svg('path', { d: 'M0 70 H160 M0 92 H160', class: 'pf-field-line' }, art);
    // The receiver, leaping, arms up for the ball.
    svg('path', { d: 'M78 84 L72 100 M82 84 L92 98', class: 'pf-player-leg' }, art);
    svg('path', { d: 'M72 60 Q80 54 88 60 L90 84 Q80 88 70 84 Z', class: 'pf-player-jersey' }, art);
    svg('path', { d: 'M74 62 L66 40 M86 62 L92 40', class: 'pf-player-arm' }, art);
    svg('circle', { cx: 80, cy: 50, r: 7, class: 'pf-player-head' }, art);
    svg('ellipse', { cx: 79, cy: 34, rx: 8, ry: 5, transform: 'rotate(-20 79 34)', class: 'pf-ball' }, art);
    if (look.dark) svg('rect', { x: 0, y: 0, width: 160, height: 110, class: 'pf-veil' }, art);
    if (look.noise) SPECKLES.forEach(([cx, cy], i) => svg('rect', { x: cx, y: cy, width: 2.4, height: 2.4, class: i % 2 ? 'pf-speck' : 'pf-speck pf-speck--dark' }, art));
    // Repeated lossy encoding: a coarse grid of blocks over the picture.
    if (look.blocky) {
      for (let bx = 0; bx < 160; bx += 8) {
        for (let by = 0; by < 110; by += 8) svg('rect', { x: bx, y: by, width: 8, height: 8, class: (bx + by) % 16 ? 'pf-block' : 'pf-block pf-block--alt' }, art);
      }
    }
    return art;
  }

  /**
   * A photo on paper: the picture, the paper's logo when `mark` is set
   * (`markCut` crops it in half), and an optional caption under it.
   */
  function photo(parent, { x, y, w = 200, look = {}, caption, at, until, how = 'pop', states = [] }) {
    const node = staged(parent, 'pf-photo', x, y);
    node.style.width = `${w}px`;
    const frame = el('div', 'pf-photo-frame', node);
    photoArt(frame, look);
    if (look.mark) el('span', `pf-logo${look.markCut ? ' pf-logo--cut' : ''}`, frame, 'PAPER');
    if (caption) el('span', 'pf-photo-caption', node, caption);
    if (states.length) arch.track(node, 'is-', states);
    return show(node, at, until, how);
  }

  /** A token's art: the photo in miniature, for photos sliding down pipes. */
  const photoToken = (look) => (node) => {
    node.classList.add('pf-token');
    photoArt(node, look);
  };

  // ------------------------------------------------------------------
  // Filters and pipes
  // ------------------------------------------------------------------

  /**
   * A filter: its name in a box with an input port on its left and an output
   * port on its right. states = [{ at, state, light }] sets its light (busy,
   * idle, waiting, crashed) and says it in words; `dial` adds a parameter on
   * its side.
   */
  function filter(parent, { x, y, w = 140, h = 84, name, at, until, how = 'pop', states = [], dial, ports = true }) {
    const node = staged(parent, 'pf-filter', x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    el('b', 'pf-filter-name', node, name);
    if (ports) {
      el('span', 'ak-port ak-port--in', node);
      el('span', 'ak-port ak-port--out', node);
    }
    if (states.length) {
      const light = el('span', 'pf-light', node, '');
      arch.track(node, 'is-', states.map(({ at: when, state, light: words }) => ({ at: when, state, words: words ?? state })), light);
    }
    if (dial) {
      const knob = el('span', 'pf-dial', node);
      knob.append(icon('gear'));
      el('span', 'ak-mono', knob, dial);
    }
    return show(node, at, until, how);
  }

  /** A pipe: a tube from `from` to `to` ([x, y] points on its center line) with an arrowhead at `to`. */
  function pipe(parent, { from: [x1, y1], to: [x2, y2], at, until, tone }) {
    const node = staged(parent, `pf-pipe${tone ? ` pf-pipe--${tone}` : ''}`, x1, y1);
    node.style.width = `${Math.max(0, Math.hypot(x2 - x1, y2 - y1))}px`;
    node.style.rotate = `${((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI).toFixed(2)}deg`;
    fx.fadeIn(node, at, 0.35);
    if (until !== undefined) fx.fadeOut(node, until - 0.25, 0.25);
    return node;
  }

  /**
   * A line of filters left to right (names = filter names), joined by pipes:
   * x0 is the first box's left edge, `w` each box's width, `gap` each pipe's
   * length. Returns the boxes, the pipes, and each box's ports, for streams.
   */
  function line(parent, { x0 = 42, y, w = 140, h = 84, gap = 44, names, at, step = 0.15, specs = [], until }) {
    const boxes = names.map((name, i) => filter(parent, { x: x0 + i * (w + gap), y, w, h, name, at: at + i * step, until, ...(specs[i] || {}) }));
    const pipes = names.slice(1).map((_, i) => {
      const from = [x0 + i * (w + gap) + w + 10, y + h / 2];
      const to = [x0 + (i + 1) * (w + gap) - 10, y + h / 2];
      return { node: pipe(parent, { from, to, at: at + (i + 1) * step - 0.05, until }), from, to };
    });
    const inPort = (i) => [x0 + i * (w + gap) - 10, y + h / 2];
    const outPort = (i) => [x0 + i * (w + gap) + w + 10, y + h / 2];
    return { boxes, pipes, inPort, outPort, center: (i) => x0 + i * (w + gap) + w / 2 };
  }

  /** Photos sliding through a pipe: a stream of photo tokens from `from` to `to`. */
  function flow(parent, { from, to, at, until, every = 0.8, duration = 0.7, look = {} }) {
    return arch.stream(parent, { path: [from, to], at, until, every, duration, size: 26, kind: 'photo', art: photoToken(look) });
  }

  // ------------------------------------------------------------------
  // Batches, the gallery, and the editor's tools
  // ------------------------------------------------------------------

  /**
   * A batch as a timeline: one bar per step that fills from `at` over
   * `duration` (rows = [{ label, at, duration }]), with a clock that shows the
   * time each bar finishes (times = [{ at, text }]).
   */
  function bars(parent, { x, y, w, rows, at, until, clock }) {
    const node = staged(parent, 'pf-bars', x, y);
    node.style.width = `${w}px`;
    rows.forEach(({ label, at: barAt, duration }) => {
      const row = el('div', 'pf-bars-row', node);
      el('span', 'pf-bars-label', row, label);
      const fill = el('span', 'pf-bars-fill', el('span', 'pf-bars-track', row));
      onFrame((t) => { fill.style.width = `${(100 * progress(t, barAt, duration)).toFixed(1)}%`; });
    });
    if (clock) {
      const readout = el('p', 'pf-bars-clock', node, clock[0].text);
      arch.track(readout, 'is-', clock.map(({ at: when, text }) => ({ at: when, state: '', words: text })), readout);
    }
    return show(node, at, until, 'rise');
  }

  /** The paper's website gallery: photos that appear one by one (items = [{ at, look, caption }]). */
  function gallery(parent, { x, y, w = 300, title = 'Game photos', empty, items = [], at, until }) {
    const node = staged(parent, 'pf-gallery', x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'pf-gallery-head', node);
    head.append(icon('globe'));
    el('b', null, head, title);
    const grid = el('div', 'pf-gallery-grid', node);
    if (empty) {
      const note = el('p', 'pf-gallery-empty', node, empty.text);
      if (empty.until !== undefined) fx.fadeOut(note, empty.until, 0.25);
    }
    items.forEach(({ at: itemAt, look, caption }) => {
      const cell = el('span', 'pf-gallery-cell is-staged', grid);
      photoArt(cell, look);
      if (caption) el('span', 'pf-gallery-caption', cell, caption);
      fx.pop(cell, itemAt, { from: 0.5 });
    });
    return show(node, at, until, 'slide');
  }

  /** The editor's slider: a track and a knob that slides to each { at, p } (0 to 1). */
  function slider(parent, { x, y, w = 360, label, at, until, moves = [] }) {
    const node = staged(parent, 'pf-slider', x, y);
    node.style.width = `${w}px`;
    el('span', 'pf-slider-label', node, label);
    const track = el('span', 'pf-slider-track', node);
    const knob = el('span', 'pf-slider-knob', track);
    const sorted = [{ at: -Infinity, p: 0.3 }, ...moves].sort((a, b) => a.at - b.at);
    onFrame((t) => {
      let p = sorted[0].p;
      for (let i = 1; i < sorted.length; i += 1) {
        if (t >= sorted[i].at + 0.6) p = sorted[i].p;
        else if (t > sorted[i].at) p = sorted[i - 1].p + (sorted[i].p - sorted[i - 1].p) * easeInOutCubic(progress(t, sorted[i].at, 0.6));
      }
      knob.style.left = `${(p * 100).toFixed(1)}%`;
    });
    return show(node, at, until, 'rise');
  }

  /** A tray that collects photos, counting them in words (counts = [{ at, n }]) until it holds `of`. */
  function tray(parent, { x, y, w = 300, title, of, counts, at, until }) {
    const node = staged(parent, 'pf-tray', x, y);
    node.style.width = `${w}px`;
    el('b', 'pf-tray-title', node, title);
    const slots = el('div', 'pf-tray-slots', node);
    const cells = Array.from({ length: of }, () => {
      const cell = el('span', 'pf-tray-cell', slots);
      photoArt(cell, {});
      return cell;
    });
    const readout = el('span', 'pf-tray-count', node, `0 of ${of}`);
    const sorted = [{ at: -Infinity, n: 0 }, ...counts].sort((a, b) => a.at - b.at);
    let shown = -1;
    onFrame((t) => {
      const { n } = arch.latest(sorted, t);
      if (n === shown) return;
      cells.forEach((cell, i) => cell.classList.toggle('is-full', i < n));
      readout.textContent = `${n} of ${of}`;
      shown = n;
    });
    return show(node, at, until, 'rise');
  }

  window.PipesKit = { photoArt, photo, photoToken, filter, pipe, line, flow, bars, gallery, slider, tray, FACES };
})();
