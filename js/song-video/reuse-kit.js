/*
 * Reuse kit for "Not a One-Time Investment", the design-with-reuse song
 * (storyboard: _data/songs/not_a_one_time_investment.yml): the casebook
 * spreads the choreography stands on the brick construction site of
 * js/song-video/brick-site.js, and the pictures on their pages.
 *
 * The song's metaphor is the lecture's own (Lecture 12, "Composing Existing
 * Building Blocks"): a module is a toy brick. Every package is a brick with
 * studs on top; what a brick offers others to build on, its interface, is
 * its studs; a brick stacked on another depends on it; a baseplate is a
 * framework that decides where your bricks go; a principle is a brick to
 * keep. The kit draws in three surfaces:
 *
 *   tiles     smooth cream surfaces for text and pictures: the pages, the
 *             cards (and their code and terminal screens);
 *   plates    studded baseplates that hold them: the casebook's cover, the
 *             frames of the cards, the ground of a build;
 *   bricks    coloured, studded pieces: packages, modules, principles,
 *             answers.
 *
 *   spread()      an open casebook on a studded navy plate: a case-tab brick,
 *                 the left and right page tiles with their headings ("What
 *                 happened", "Why"), and a principle brick across the bottom;
 *   group(), layer()  pictures that come and go together; a stage-sized
 *                 layer that a build tilts or drops as one;
 *   pkg()         a package brick: its name on the front, a version tag that
 *                 flips, dashes, and pins, its studs (hidden when another
 *                 brick sits on it, changed when its interface changes), and
 *                 a ring, a cross, or a check;
 *   plate()       a baseplate strip under a build, or a framework's base;
 *   brickIcon(), crack(), dust(), strain():  a small brick drawing; a crack
 *                 drawn into a brick; a cartoon dust puff; comic strain lines;
 *   arrow(), code(), term(), label(), note(), inkStamp(), tick():
 *                 ink arrows, code and terminal cards, ink lettering, cream
 *                 notes, rubber stamps, a check or cross drawn on;
 *   shelf(), users(), bars(), vision(), wallGap(), padColumn(), timeline(),
 *   padlock(), appGrid(), rocket(), gauge(), checkboxes(), scale():
 *                 the pictures the cases need: a shelf of package bricks,
 *                 one brick used by many apps, compatible bricks against
 *                 mismatched ones held by glue, a wall with a gap a brick
 *                 must fit, a column lined up on the right by padding
 *                 bricks, apps as bricks, and the two Ariane rockets with
 *                 the gold module in a cut-away equipment bay;
 *   checklist()   the refrain's card: four questions that light as they are
 *                 sung, each adding its brick to a tower beside the card;
 *   quiz()        a numbered question card whose answer brick snaps on.
 *
 * One colour means one thing across the whole song: blue bricks are reused
 * packages and libraries (and the case tabs and page headings that file
 * them); gold is your own code and everything worth keeping (the
 * principles, the refrain's questions); red is what breaks; green is what
 * is fixed or right (checks, answers); grey is a framework's structure; tan
 * is neutral filler. The choreography keeps to the same meanings.
 *
 * Every pose is a pure function of song time (Timeline tweens and frame
 * updaters). Coordinates are CSS pixels on the 960×540 stage; nothing
 * essential goes below y = 460, where the player draws captions. Every
 * meaning is written in words; colour only repeats them (WCAG 1.4.1).
 * Styles: css/song-video-reuse-kit.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, clamp, progress, easeInOutCubic, easeOutCubic, hash01 } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, place } = kit;

  /** The open casebook and its two pages, in stage coordinates. */
  const SPREAD = { x: 36, y: 56, w: 888, h: 394 };
  const LEFT = { x: 56, y: 104, w: 404, h: 286 };
  const RIGHT = { x: 500, y: 104, w: 404, h: 286 };
  const RIBBON_Y = 400;

  /** Shows a node from `at` and, with `until`, hides it again. */
  function show(node, at, until, how = 'pop') {
    if (how === 'rise') fx.rise(node, at, { distance: 14, duration: 0.4 });
    else if (how === 'fade') fx.fadeIn(node, at, 0.3);
    else if (how === 'slam') fx.slam(node, at, { from: 1.6 });
    else if (how === 'drop') tween(node, [{ opacity: 0, translate: '0 -40px' }, { opacity: 1, translate: '0 0' }], at, 0.45, EASE.back);
    else if (how !== 'none') fx.pop(node, at, { from: 0.7 });
    if (until !== undefined) fx.fadeOut(node, until - 0.25, 0.25);
    return node;
  }

  /** An absolutely placed box of the kit's own. */
  function box(parent, className, { x, y, w, h }) {
    const node = place(el('div', `${className} is-staged`, parent), x, y);
    if (w !== undefined) node.style.width = `${w}px`;
    if (h !== undefined) node.style.height = `${h}px`;
    return node;
  }

  /** Adds `className` to `node` between `from` and `to` (to = undefined: for good). */
  function classAt(node, className, from, to) {
    onFrame((t) => node.classList.toggle(className, t >= from && (to === undefined || t < to)));
  }

  /** Sets `node`'s text to the latest of changes = [{ at, text }] that has happened. */
  function textAt(node, first, changes) {
    const sorted = [...changes].sort((a, b) => a.at - b.at);
    onFrame((t) => {
      let text = first;
      for (const change of sorted) if (change.at <= t) text = change.text;
      if (node.textContent !== text) node.textContent = text;
    });
  }

  /** A row of `count` studs along the top edge of a brick-styled node. */
  function studs(node, count, className = 'rk-studs') {
    const row = el('div', className, node);
    for (let i = 0; i < count; i++) el('i', null, row);
    return row;
  }

  /** How many studs a brick `w` pixels wide carries. */
  const studCount = (w, pitch = 46) => Math.max(1, Math.round(w / pitch));

  // ------------------------------------------------------------------
  // The casebook spread
  // ------------------------------------------------------------------

  /**
   * An open casebook: a studded navy plate holding two page tiles. `tab`
   * names the case on a blue brick at the top ("Case 1 · urllib3"), `left`
   * and `right` head the pages (`heads` returns them, for a heading that
   * changes). ribbon(text, { at, until }) snaps the principle, a gold brick,
   * on across the bottom; each call replaces the one before.
   */
  function spread(layer, { at, until, tab, left, right }) {
    const node = show(box(layer, 'rk-spread', SPREAD), at, until, 'fade');
    el('div', 'rk-page rk-page--left', node);
    el('div', 'rk-page rk-page--right', node);
    el('div', 'rk-spine', node);
    if (tab) {
      const tabNode = el('div', 'rk-tab rk-c-blue', node, tab);
      studs(tabNode, 3);
    }
    const heads = {
      left: left ? el('div', 'rk-head rk-head--left', node, left) : null,
      right: right ? el('div', 'rk-head rk-head--right', node, right) : null,
    };
    const ribbons = [];
    return {
      node,
      heads,
      ribbon(text, { at: from, until: to, sub } = {}) {
        const ribbon = box(layer, 'rk-ribbon rk-c-gold', { x: 150, y: RIBBON_Y, w: 660 });
        studs(ribbon, 12);
        el('span', 'rk-ribbon-kicker', ribbon, 'Principle');
        el('span', 'rk-ribbon-text', ribbon, text);
        if (sub) el('span', 'rk-ribbon-sub', ribbon, sub);
        const previous = ribbons[ribbons.length - 1];
        if (previous && previous.until === undefined) fx.fadeOut(previous.node, from - 0.2, 0.2);
        // The principle brick drops onto the spread and snaps into place.
        tween(ribbon, [{ opacity: 0, translate: '0 -26px' }, { opacity: 1, translate: '0 0' }], from, 0.4, EASE.back);
        const end = to ?? until;
        if (end !== undefined) fx.fadeOut(ribbon, end - 0.25, 0.25);
        ribbons.push({ node: ribbon, until: to });
        return ribbon;
      },
    };
  }

  /** A set of pictures that fades in at `at` and out at `until`. */
  function group(parent, at, until) {
    const node = el('div', 'rk-group is-staged', parent);
    fx.fadeIn(node, at, 0.25);
    if (until !== undefined) fx.fadeOut(node, until - 0.25, 0.25);
    return node;
  }

  /** A stage-sized layer, always shown, that a build moves or tilts as one. */
  function layer(parent) {
    return el('div', 'rk-layer', parent);
  }

  // ------------------------------------------------------------------
  // Bricks
  // ------------------------------------------------------------------

  /** A small brick seen from the front: body, studs, shine, and shade. */
  function brickIcon(parent, { tone = 'blue', studs: count = 2, w = 44, h = 28 } = {}) {
    const sh = 6;
    const art = svg('svg', { class: `rk-brick-icon rk-c-${tone}`, viewBox: `0 0 ${w} ${h + sh}`, width: w, height: h + sh, 'aria-hidden': 'true' }, parent);
    const pitch = (w - 4) / count;
    for (let i = 0; i < count; i++) {
      svg('rect', { class: 'rk-sb-stud', x: 2 + i * pitch + pitch * 0.18, y: 1, width: pitch * 0.64, height: sh + 2, rx: 2 }, art);
    }
    svg('rect', { class: 'rk-sb-body', x: 1, y: sh, width: w - 2, height: h - 1, rx: 2.5 }, art);
    svg('rect', { class: 'rk-sb-shine', x: 3.5, y: sh + 2, width: w - 7, height: 3, rx: 1.5 }, art);
    svg('rect', { class: 'rk-sb-shade', x: 3.5, y: sh + h - 7, width: w - 7, height: 3.5, rx: 1.5 }, art);
    return art;
  }

  /** A brick drawn into an SVG `parent`: body, studs (pitch-spaced), shine, shade. */
  function svgBrick(parent, { x, y, w, h, tone, studs: count = 0, studW = 9, studH = 4.5 }) {
    const g = svg('g', { class: `rk-c-${tone}` }, parent);
    if (count) {
      const pitch = w / count;
      for (let i = 0; i < count; i++) {
        svg('rect', { class: 'rk-sb-stud', x: x + i * pitch + (pitch - studW) / 2, y: y - studH, width: studW, height: studH + 1.5, rx: 1.6 }, g);
      }
    }
    svg('rect', { class: 'rk-sb-body', x, y, width: w, height: h, rx: 2 }, g);
    svg('rect', { class: 'rk-sb-shine', x: x + 2, y: y + 2, width: Math.max(0, w - 4), height: 2.5, rx: 1 }, g);
    svg('rect', { class: 'rk-sb-shade', x: x + 2, y: y + h - 4.5, width: Math.max(0, w - 4), height: 2.5, rx: 1 }, g);
    return g;
  }

  /**
   * A package brick: its name on the front and an optional version tag.
   * tags = [{ at, text, kind }] changes the tag (kind 'plain', 'any' for a
   * dashed range, 'pinned', 'new', 'bad'). `under` hides its studs (another
   * brick sits on it); `odd` gives it different studs, a changed interface;
   * `stack` draws it as a stack of many bricks, its name on a tag.
   * ring(at, until, tone), cross(at, until), and check(at, until) mark it.
   */
  function pkg(parent, { x, y, name, version, w = 150, h, tone = 'blue', at, until, tags = [], how = 'pop', under = false, odd = false, small = false, stack = false }) {
    const variants = `${under ? ' rk-pkg--under' : ''}${odd ? ' rk-pkg--odd' : ''}${small ? ' rk-pkg--small' : ''}${stack ? ' rk-pkg--stack' : ''}${h !== undefined ? ' rk-pkg--sized' : ''}`;
    const node = show(box(parent, `rk-pkg rk-c-${tone}${variants}`, { x, y, w, h }), at, until, how);
    studs(node, odd ? studCount(w) + 1 : studCount(w));
    const words = el('div', 'rk-pkg-words', node);
    el('div', 'rk-pkg-name', words, name);
    if (version !== undefined) {
      const tag = el('div', 'rk-pkg-tag', words);
      const changes = [{ at: -1, text: version, kind: 'plain' }, ...tags].sort((a, b) => a.at - b.at);
      onFrame((t) => {
        let current = changes[0];
        for (const change of changes) if (change.at <= t) current = change;
        if (tag.textContent !== current.text) tag.textContent = current.text;
        const className = `rk-pkg-tag rk-pkg-tag--${current.kind || 'plain'}`;
        if (tag.className !== className) tag.className = className;
      });
      for (const change of tags) fx.bump(node, change.at, 0.08);
    }
    const marks = el('div', 'rk-pkg-marks', node);
    const mark = (kind) => (from, to) => {
      const sign = el('span', `rk-pkg-mark rk-pkg-mark--${kind} is-staged`, marks);
      sign.append(kit.icon(kind === 'cross' ? 'cross' : 'check'));
      // Pops in at its own size, never larger, so it never covers the name.
      fx.pop(sign, from, { from: 0.5 });
      if (to !== undefined) fx.fadeOut(sign, to - 0.2, 0.2);
      return sign;
    };
    return {
      node, x, y, w,
      ring(from, to, tone = 'red') {
        const ring = el('span', `rk-ring rk-ring--${tone} is-staged`, node);
        fx.fadeIn(ring, from, 0.2);
        if (to !== undefined) fx.fadeOut(ring, to - 0.2, 0.2);
        return ring;
      },
      cross: mark('cross'),
      check: mark('check'),
    };
  }

  /** A baseplate strip (studs on top): the ground of a build, or a framework's base with a label. */
  function plate(parent, { x, y, w, h = 14, tone = 'grey', label, at, until, how = 'fade' }) {
    const node = show(box(parent, `rk-plate rk-c-${tone}${label ? ' rk-plate--label' : ''}`, { x, y, w, h }), at, until, how);
    studs(node, Math.max(2, Math.round(w / 24)), 'rk-studs rk-studs--plate');
    if (label) el('span', 'rk-plate-label', node, label);
    return node;
  }

  /** A crack drawn into a brick at `at`. */
  function crack(parent, { x, y, w, h, at }) {
    const art = svg('svg', { class: 'rk-crack is-staged', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, parent);
    art.style.left = `${x}px`;
    art.style.top = `${y}px`;
    fx.fadeIn(art, at, 0.05);
    const d = `M${w * 0.9} 0 L${w * 0.96} ${h * 0.34} L${w * 0.91} ${h * 0.56} L${w * 0.97} ${h * 0.8} L${w * 0.94} ${h}`;
    fx.draw(svg('path', { class: 'rk-crack-light', d }, art), at, 0.4);
    fx.draw(svg('path', { class: 'rk-crack-line', d }, art), at, 0.4);
    return art;
  }

  // ------------------------------------------------------------------
  // Arrows
  // ------------------------------------------------------------------

  /**
   * An ink arrow from (x1, y1) to (x2, y2), bowed by `bend`, drawn on at
   * `at`; tones = [{ at, tone }] recolours it (ink, red, green, muted).
   */
  function arrow(parent, { x1, y1, x2, y2, bend = 0, at, until, label, labelAt, tone = 'ink', tones = [], dashed = false }) {
    const art = svg('svg', { class: 'rk-arrow is-staged', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    fx.fadeIn(art, at, 0.08);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const cx = mx - (bend * (y2 - y1)) / len;
    const cy = my + (bend * (x2 - x1)) / len;
    const g = svg('g', { class: `rk-arrow-ink rk-arrow-ink--${tone}` }, art);
    const path = svg('path', { class: `rk-arrow-path${dashed ? ' rk-arrow-path--dashed' : ''}`, d: `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}` }, g);
    if (!dashed) fx.draw(path, at, 0.35);
    const angle = (Math.atan2(y2 - cy, x2 - cx) * 180) / Math.PI;
    const head = svg('path', { class: 'rk-arrow-head is-staged', d: 'M0 0 L-12 -6.5 L-12 6.5 Z', transform: `translate(${x2} ${y2}) rotate(${angle.toFixed(1)})` }, g);
    fx.fadeIn(head, at + 0.3, 0.08);
    if (tones.length) {
      const sorted = [...tones].sort((a, b) => a.at - b.at);
      onFrame((t) => {
        let current = tone;
        for (const change of sorted) if (change.at <= t) current = change.tone;
        const className = `rk-arrow-ink rk-arrow-ink--${current}`;
        if (g.getAttribute('class') !== className) g.setAttribute('class', className);
      });
    }
    let labelNode = null;
    if (label) {
      const [lx, ly] = labelAt || [cx - 30, cy - 26];
      labelNode = show(place(el('div', 'rk-arrow-label is-staged', parent, label), lx, ly), at + 0.15, until);
    }
    if (until !== undefined) fx.fadeOut(art, until - 0.25, 0.25);
    return { art, labelNode };
  }

  /**
   * A cartoon dust puff centred on (x, y) from `at`: soft clouds burst out,
   * grow, and thin away over `duration` seconds. One group, faded as a
   * whole, so overlapping clouds read as one.
   */
  function dust(parent, { x, y, at, size = 1, duration = 0.8 }) {
    const art = svg('svg', { class: 'rk-dust', viewBox: '-60 -40 120 80', width: 120 * size, height: 80 * size, 'aria-hidden': 'true' }, parent);
    art.style.left = `${x - 60 * size}px`;
    art.style.top = `${y - 40 * size}px`;
    const cloud = svg('g', { opacity: 0 }, art);
    const puffs = [[-15, 6, 10], [0, -3, 13], [15, 6, 10], [-28, 12, 7], [28, 12, 7], [0, 12, 9]]
      .map(([px, py, r]) => ({ circle: svg('circle', { cx: 0, cy: 0, r }, cloud), px, py }));
    onFrame((t) => {
      const p = (t - at) / duration;
      if (p <= 0 || p >= 1) {
        cloud.setAttribute('opacity', '0');
        return;
      }
      const out = easeOutCubic(p);
      cloud.setAttribute('opacity', (0.9 * Math.min(1, p * 8) * (1 - p)).toFixed(3));
      puffs.forEach(({ circle, px, py }) => circle.setAttribute('transform',
        `translate(${(px * (0.35 + out)).toFixed(1)} ${(py * (0.35 + out) - 8 * out).toFixed(1)}) scale(${(0.45 + 0.75 * out).toFixed(3)})`));
    });
    return art;
  }

  /**
   * Comic strain lines either side of a box (x, y, w, h), trembling from
   * `at` until `until`: the piece is holding up more than it should.
   */
  function strain(parent, { x, y, w, h, at, until }) {
    const art = svg('svg', { class: 'rk-strain is-staged', viewBox: `0 0 ${w + 44} ${h}`, width: w + 44, height: h, 'aria-hidden': 'true' }, parent);
    art.style.left = `${x - 22}px`;
    art.style.top = `${y}px`;
    const side = (x0, dir) => [0.28, 0.5, 0.72].map((f, i) =>
      `M${x0} ${(h * f).toFixed(1)} L${x0 + dir * (i === 1 ? 13 : 10)} ${(h * f + (i - 1) * 3).toFixed(1)}`).join(' ');
    svg('path', { class: 'rk-strain-lines', d: `${side(3, 1)} ${side(w + 41, -1)}` }, art);
    fx.fadeIn(art, at, 0.15);
    onFrame((t) => {
      const on = t >= at && (until === undefined || t < until);
      art.style.translate = on ? `${(0.9 * Math.sin(t * 70)).toFixed(2)}px 0` : '0 0';
    });
    if (until !== undefined) fx.fadeOut(art, until - 0.15, 0.15);
    return art;
  }

  // ------------------------------------------------------------------
  // Code and terminals
  // ------------------------------------------------------------------

  /** Writes one highlighted line, with an optional part in a span lit from `hl.at`. */
  function codeLine(parent, source, highlight, hl) {
    const line = el('div', 'rk-code-line', parent);
    if (!hl) return kit.writeCode(line, highlight(source));
    const i = source.indexOf(hl.part);
    kit.writeCode(line, highlight(source.slice(0, i)));
    const lit = el('span', `rk-hl rk-hl--${hl.tone || 'red'}`, line);
    kit.writeCode(lit, highlight(hl.part));
    kit.writeCode(line, highlight(source.slice(i + hl.part.length)));
    classAt(lit, 'is-lit', hl.at, hl.until);
    return line;
  }

  /**
   * A code card: lines = [source | { text, hl: { part, at, until, tone } }],
   * in `lang` ('js', 'python', or 'plain'), numbered with `numbers`.
   */
  function code(parent, { x, y, w, lines, lang = 'js', at, until, title, numbers = false, how = 'rise', size }) {
    const node = show(box(parent, `rk-code${numbers ? ' rk-code--numbered' : ''}`, { x, y, w }), at, until, how);
    if (size) node.style.fontSize = `${size}px`;
    if (title) el('div', 'rk-code-title', node, title);
    const body = el('div', 'rk-code-body', node);
    const highlight = lang === 'python' ? kit.highlightPython : lang === 'js' ? kit.highlightJavaScript : (s) => [[s, null]];
    lines.forEach((item) => {
      const source = typeof item === 'string' ? item : item.text;
      codeLine(body, source, highlight, typeof item === 'string' ? null : item.hl);
    });
    return node;
  }

  /**
   * A terminal card: lines = [{ text, at, until, kind }] where kind is
   * 'cmd' (typed after a prompt), 'out', 'err', or 'ok'. A line shows from
   * its `at` until its `until`.
   */
  function term(parent, { x, y, w, at, until, title = 'terminal', lines, how = 'rise' }) {
    const node = show(box(parent, 'rk-term', { x, y, w }), at, until, how);
    const bar = el('div', 'rk-term-bar', node);
    for (let i = 0; i < 3; i++) el('span', 'rk-term-dot', bar);
    el('span', 'rk-term-title', bar, title);
    const body = el('div', 'rk-term-body', node);
    const cps = 32;
    lines.forEach((spec) => {
      const row = el('div', `rk-term-line rk-term-line--${spec.kind || 'out'}`, body);
      const text = el('span', 'rk-term-text', row);
      const cursor = el('span', 'rk-term-cursor', row);
      onFrame((t) => {
        const visible = t >= spec.at && (spec.until === undefined || t < spec.until);
        row.hidden = !visible;
        if (!visible) return;
        const typed = spec.kind === 'cmd' ? spec.text.slice(0, Math.floor((t - spec.at) * cps) + 1) : spec.text;
        const shown = spec.kind === 'cmd' ? `$ ${typed}` : typed;
        if (text.textContent !== shown) text.textContent = shown;
        const done = typed.length >= spec.text.length;
        cursor.hidden = !(spec.kind === 'cmd' && (!done || (spec.wait && Math.floor(t * 2) % 2 === 0)));
      });
    });
    return node;
  }

  // ------------------------------------------------------------------
  // Ink on paper
  // ------------------------------------------------------------------

  /** Lettering on a page: tone ink, muted, red, or green; 'light' on the backdrop. */
  function label(parent, text, { x, y, w, at, until, tone = 'ink', size, align = 'left', how = 'rise', weight }) {
    const node = show(box(parent, `rk-label rk-label--${tone} rk-label--${align}`, { x, y, w }), at, until, how);
    if (tone === 'light') el('span', 'rk-label-pill', node, text);
    else node.textContent = text;
    if (size) node.style.fontSize = `${size}px`;
    if (weight) node.style.fontWeight = weight;
    return node;
  }

  /** A cream card with a border: text (and an icon) on a page. */
  function note(parent, text, { x, y, w, at, until, tone = 'plain', icon, how = 'pop', small }) {
    const node = show(box(parent, `rk-note rk-note--${tone}${small ? ' rk-note--small' : ''}`, { x, y, w }), at, until, how);
    if (icon) node.append(kit.icon(icon));
    el('span', 'rk-note-text', node, text);
    return node;
  }

  /** A rubber stamp pressed onto a page (it grows to its size, never past it). */
  function inkStamp(parent, text, { x, y, at, until, tone = 'green', rotate = -8 }) {
    const node = place(el('div', `rk-stamp rk-stamp--${tone} is-staged`, parent, text), x, y);
    tween(node, [{ opacity: 0, scale: 0.6, rotate: `${rotate - 6}deg` }, { opacity: 1, scale: 1, rotate: `${rotate}deg` }], at, 0.25, EASE.out);
    if (until !== undefined) fx.fadeOut(node, until - 0.2, 0.2);
    return node;
  }

  /** A check or a cross drawn on with a pen stroke. */
  function tick(parent, { x, y, at, until, kind = 'check', size = 34 }) {
    const art = svg('svg', { class: `rk-tick rk-tick--${kind} is-staged`, viewBox: '0 0 40 40', width: size, height: size, 'aria-hidden': 'true' }, parent);
    art.style.left = `${x}px`;
    art.style.top = `${y}px`;
    fx.fadeIn(art, at, 0.05);
    const d = kind === 'check' ? ['M6 21 L16 31 L34 9'] : ['M8 8 L32 32', 'M32 8 L8 32'];
    d.forEach((path, i) => fx.draw(svg('path', { d: path }, art), at + i * 0.12, 0.22));
    if (until !== undefined) fx.fadeOut(art, until - 0.2, 0.2);
    return art;
  }

  // ------------------------------------------------------------------
  // Pictures
  // ------------------------------------------------------------------

  /** A shelf of package bricks (blue) that drop on, one after another; tone 'desk' for light names on the backdrop. */
  function shelf(parent, { x, y, names, at, every = 0.18, until, w = 380, tone }) {
    const node = show(box(parent, `rk-shelf${tone ? ` rk-shelf--${tone}` : ''}`, { x, y, w }), at, until, 'fade');
    const row = el('div', 'rk-shelf-row', node);
    names.forEach((name, i) => {
      const item = el('div', 'rk-shelf-item is-staged', row);
      brickIcon(item, { tone: 'blue', w: 50, h: 30 });
      el('span', 'rk-shelf-name', item, name);
      tween(item, [{ opacity: 0, translate: '0 -24px' }, { opacity: 1, translate: '0 0' }], at + 0.1 + i * every, 0.35, EASE.back);
    });
    el('div', 'rk-shelf-board', node);
    return node;
  }

  /** One package brick in the middle with lines to `count` small apps around it. */
  function users(parent, { cx, cy, r = 112, w = 124, count = 8, name, at, until, every = 0.08 }) {
    const node = group(parent, at, until);
    const art = svg('svg', { class: 'rk-users', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, node);
    for (let i = 0; i < count; i++) {
      const a = (-90 + (360 * i) / count) * (Math.PI / 180);
      const px = cx + r * Math.cos(a);
      const py = cy + r * 0.78 * Math.sin(a);
      const line = svg('path', { class: 'rk-users-line', d: `M${cx} ${cy} L${px.toFixed(1)} ${py.toFixed(1)}` }, art);
      fx.draw(line, at + 0.15 + i * every, 0.25);
      const app = place(el('div', 'rk-app is-staged', node), px - 17, py - 15);
      app.append(kit.icon('laptop'));
      fx.pop(app, at + 0.3 + i * every, { from: 0.5 });
    }
    const center = pkg(node, { x: cx - w / 2, y: cy - 24, name, w, at });
    return { node, center };
  }

  /** Horizontal bars labelled `items` that shrink to `to` (0–1) at `shrinkAt`. */
  function bars(parent, { x, y, w, items, at, shrinkAt, until }) {
    const node = show(box(parent, 'rk-bars', { x, y, w }), at, until, 'rise');
    items.forEach((item, i) => {
      const row = el('div', 'rk-bar-row', node);
      el('span', 'rk-bar-label', row, item.label);
      const track = el('span', 'rk-bar-track', row);
      const fill = el('span', 'rk-bar-fill', track);
      tween(fill, [{ scale: '1 1' }, { scale: `${item.to} 1` }], shrinkAt + i * 0.25, 0.7, EASE.inOut);
    });
    return node;
  }

  /**
   * The lecture's vision of reuse against its reality, in bricks. At `at`,
   * bricks of two libraries (blue and tan) drop and snap into one neat
   * wall: the same studs, so they fit. At `realityAt` the wall gives way to
   * mismatched pieces (a giant brick, a thin plate, a brick on its side, a
   * tilted brick) with gaps between them; glue strips cover the gaps at
   * glueAt[i] and are outlined from `outlineAt`. notes = [{ text, x, y, w, at }].
   */
  function vision(parent, { x, y, at, realityAt, glueAt = [], outlineAt, notes = [], until }) {
    const node = show(box(parent, 'rk-vision', { x, y, w: 300, h: 210 }), at, until, 'fade');
    const art = svg('svg', { viewBox: '0 -10 300 220', width: 300, height: 220, 'aria-hidden': 'true' }, node);
    const neat = svg('g', {}, art);
    const NEAT = [
      // bottom course, middle course (running bond), top course
      [30, 150, 60, 'blue', 0], [90, 150, 60, 'blue', 0], [150, 150, 60, 'tan', 0], [210, 150, 60, 'tan', 0],
      [30, 124, 30, 'blue', 0], [60, 124, 60, 'blue', 0], [120, 124, 60, 'tan', 0], [180, 124, 60, 'tan', 0], [240, 124, 30, 'tan', 0],
      [30, 98, 60, 'blue', 2], [90, 98, 60, 'blue', 2], [150, 98, 60, 'tan', 2], [210, 98, 60, 'tan', 2],
    ];
    NEAT.forEach(([bx, by, bw, tone, count], i) => {
      const g = svgBrick(neat, { x: bx, y: by, w: bw, h: 26, tone, studs: count });
      g.classList.add('is-staged');
      tween(g, [{ opacity: 0, translate: '0 -34px' }, { opacity: 1, translate: '0 0' }], at + 0.05 * i, 0.32, EASE.back);
    });
    const libraryLabels = [
      ['Library 1', 30, 'blue'], ['Library 2', 150, 'tan'],
    ].map(([text, lx, tone]) => place(el('div', `rk-vision-lib rk-vision-lib--${tone} is-staged`, node, text), lx, 196));
    libraryLabels.forEach((labelNode, i) => fx.fadeIn(labelNode, at + 0.5 + i * 0.1, 0.3));
    fx.fadeOut(neat, realityAt - 0.15, 0.25);
    libraryLabels.forEach((labelNode) => fx.fadeOut(labelNode, realityAt - 0.15, 0.25));
    const real = svg('g', { class: 'is-staged' }, art);
    fx.fadeIn(real, realityAt, 0.3);
    svgBrick(real, { x: 6, y: 104, w: 108, h: 72, tone: 'blue', studs: 2, studW: 24, studH: 10 });
    svgBrick(real, { x: 128, y: 162, w: 86, h: 14, tone: 'tan', studs: 5, studW: 7, studH: 4 });
    const tilted = svgBrick(real, { x: 132, y: 118, w: 64, h: 28, tone: 'tan', studs: 2 });
    tilted.setAttribute('transform', 'rotate(-8 164 132)');
    const sideways = svgBrick(real, { x: 194, y: 84, w: 62, h: 26, tone: 'blue', studs: 2 });
    sideways.setAttribute('transform', 'rotate(90 225 97)');
    svgBrick(real, { x: 228, y: 140, w: 66, h: 36, tone: 'tan', studs: 3 });
    const floating = svgBrick(real, { x: 34, y: 66, w: 78, h: 24, tone: 'red', studs: 3 });
    floating.setAttribute('transform', 'rotate(5 73 78)');
    const GLUE = [[106, 118, 30, 44], [196, 150, 40, 18], [58, 86, 46, 16], [180, 104, 34, 20], [214, 128, 24, 22]];
    GLUE.forEach(([gx, gy, gw, gh], i) => {
      const strip = svg('rect', { class: 'rk-glue is-staged', x: gx, y: gy, width: gw, height: gh, rx: 2 }, art);
      const when = glueAt[Math.min(i, glueAt.length - 1)] ?? realityAt + 1;
      strip.style.transformOrigin = `${gx + gw / 2}px ${gy + gh / 2}px`;
      strip.style.transformBox = 'view-box';
      tween(strip, [{ opacity: 0, scale: '0.4' }, { opacity: 1, scale: '1' }], when + (i % 2) * 0.18, 0.25, EASE.back);
      if (outlineAt !== undefined) classAt(strip, 'is-lit', outlineAt);
    });
    notes.forEach((n) => note(node, n.text, { x: n.x, y: n.y, w: n.w, at: n.at, until, small: true, tone: 'tag' }));
    return node;
  }

  /**
   * A tan brick wall with a gap in its top course, `gapCols` bricks wide:
   * the slot a reused piece must fit. Returns the node, the gap's stage box
   * ({ x, y, w, h }), and its dashed outline (`slot`), to hide once filled.
   */
  function wallGap(parent, { x, y, cols = 6, rows = 3, gapCol = 2, gapCols = 2, at, until, brickW = 48, brickH = 32 }) {
    const w = cols * brickW;
    const h = rows * brickH;
    const node = show(box(parent, 'rk-wall', { x, y, w, h }), at, until, 'fade');
    const art = svg('svg', { viewBox: `0 -6 ${w} ${h + 6}`, width: w, height: h + 6, 'aria-hidden': 'true' }, node);
    for (let r = 0; r < rows; r++) {
      const by = h - (r + 1) * brickH;
      const offset = r % 2 ? brickW / 2 : 0;
      for (let c = -1; c < cols; c++) {
        const bx = c * brickW + offset;
        const left = Math.max(0, bx);
        const right = Math.min(w, bx + brickW);
        if (right - left < 4) continue;
        const top = r === rows - 1;
        if (top && c >= gapCol && c < gapCol + gapCols) continue;
        svgBrick(art, { x: left, y: by, w: right - left, h: brickH, tone: 'tan', studs: top ? Math.max(1, Math.round((right - left) / 24)) : 0 });
      }
    }
    const gap = { x: x + gapCol * brickW, y, w: gapCols * brickW, h: brickH };
    const slot = svg('rect', { class: 'rk-wall-gap', x: gapCol * brickW + 1.5, y: 1.5, width: gapCols * brickW - 3, height: brickH - 3, rx: 2 }, art);
    return { node, gap, slot };
  }

  /**
   * What left-pad is for: lining up a column of values on the right. Each
   * row is a call, `leftpad(42, 3)`, and its result as character tiles. At
   * `at` the rows come in with their values left-aligned; from `padAt`
   * (`every` seconds apart) each short value's padding bricks, one 1×1 tan
   * brick per space, drop in on its left and push its characters right; at
   * `alignAt` a dashed guide marks the right edge they now share, with
   * `caption` under it. values = ['7', '42', '317'], width = the padded
   * length; `cellsX` is where the tiles start, right of the calls.
   */
  function padColumn(parent, { x, y, values, width, at, padAt, alignAt, until, every = 0.2, caption, cellsX = 230 }) {
    const CELL = 40;
    const GAP = 6;
    const ROW = 54;
    const pitch = CELL + GAP;
    const tilesW = width * pitch - GAP;
    const node = show(box(parent, 'rk-pad', { x, y, w: cellsX + tilesW + 12, h: values.length * ROW }), at, until, 'fade');
    values.forEach((value, r) => {
      const row = place(el('div', 'rk-pad-row is-staged', node), 0, r * ROW);
      fx.rise(row, at + r * 0.12, { distance: 12, duration: 0.35 });
      el('code', 'rk-pad-call', row, `leftpad(${value}, ${width})`);
      place(el('span', 'rk-pad-arrow', row, '→'), cellsX - 34, 0);
      const tiles = place(el('div', 'rk-pad-tiles', row), cellsX, 0);
      tiles.style.width = `${tilesW}px`;
      const padding = width - value.length;
      const when = padAt + r * every;
      for (let i = 0; i < padding; i++) {
        const space = place(el('span', 'rk-pad-cell rk-pad-space rk-c-tan is-staged', tiles), i * pitch, 0);
        studs(space, 1);
        el('span', 'rk-pad-dot', space, '·');
        tween(space, [{ opacity: 0, translate: '0 -28px' }, { opacity: 1, translate: '0 0' }], when + 0.12 + i * 0.1, 0.35, EASE.back);
      }
      const chars = el('div', 'rk-pad-chars', tiles);
      [...value].forEach((ch, i) => place(el('span', 'rk-pad-cell rk-pad-char rk-c-white', chars, ch), i * pitch, 0));
      if (padding) tween(chars, [{ translate: '0 0' }, { translate: `${padding * pitch}px 0` }], when, 0.4, EASE.inOut);
    });
    const guide = place(el('div', 'rk-pad-guide is-staged', node), cellsX + tilesW + 5, -10);
    guide.style.height = `${values.length * ROW + 4}px`;
    fx.fadeIn(guide, alignAt, 0.3);
    if (caption) label(node, caption, { x: cellsX - 60, y: values.length * ROW + 2, w: tilesW + 80, at: alignAt, tone: 'green', align: 'right' });
    return node;
  }

  /** A timeline bar; fills between fillAt and fillTo; points = [{ at, pos, text, align }]. */
  function timeline(parent, { x, y, w, at, until, fillAt, fillTo, points = [], fillTone = 'ink' }) {
    const node = show(box(parent, 'rk-timeline', { x, y, w }), at, until, 'rise');
    const track = el('div', 'rk-timeline-track', node);
    const fill = el('div', `rk-timeline-fill rk-timeline-fill--${fillTone}`, track);
    onFrame((t) => {
      const p = fillAt === undefined ? 0 : easeInOutCubic(progress(t, fillAt, fillTo - fillAt));
      fill.style.transform = `scaleX(${p.toFixed(3)})`;
    });
    points.forEach((point) => {
      const dot = place(el('div', 'rk-timeline-point is-staged', node), point.pos * w, 0);
      el('span', 'rk-timeline-dot', dot);
      el('span', 'rk-timeline-text', dot, point.text);
      if (point.align) dot.classList.add(`rk-timeline-point--${point.align}`);
      fx.pop(dot, point.at, { from: 0.6 });
    });
    return node;
  }

  /** A padlock: `crackAt` cracks it, `fixAt` heals it green; label underneath. */
  function padlock(parent, { x, y, size = 110, at, until, label: caption, crackAt, fixAt, tone }) {
    const node = show(box(parent, 'rk-padlock', { x, y, w: size }), at, until, 'pop');
    const art = svg('svg', { viewBox: '0 0 100 110', width: size, height: size * 1.1, 'aria-hidden': 'true' }, node);
    svg('path', { class: 'rk-padlock-shackle', d: 'M26 48 V32 a24 24 0 0 1 48 0 V48' }, art);
    const body = svg('rect', { class: `rk-padlock-body${tone ? ` rk-padlock-body--${tone}` : ''}`, x: 12, y: 46, width: 76, height: 58, rx: 10 }, art);
    svg('circle', { class: 'rk-padlock-hole', cx: 50, cy: 70, r: 7 }, art);
    svg('path', { class: 'rk-padlock-hole', d: 'M47 72 L45 88 H55 L53 72 Z' }, art);
    if (crackAt !== undefined) {
      const crackPath = svg('path', { class: 'rk-padlock-crack', d: 'M30 46 L40 60 L33 70 L46 82 L40 96 L48 104' }, art);
      fx.draw(crackPath, crackAt, 0.4);
      if (fixAt !== undefined) fx.fadeOut(crackPath, fixAt, 0.3);
    }
    if (fixAt !== undefined) classAt(body, 'is-fixed', fixAt);
    if (caption) el('div', 'rk-padlock-label', node, caption);
    return node;
  }

  /** A grid of app bricks, each with a padlock, turning from red to green one after another from greenAt. */
  function appGrid(parent, { x, y, cols = 4, rows = 3, at, greenAt, every = 0.12, until }) {
    const node = show(box(parent, 'rk-appgrid', { x, y }), at, until, 'fade');
    node.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    for (let i = 0; i < cols * rows; i++) {
      const cell = el('div', 'rk-appgrid-cell', node);
      studs(cell, 2);
      cell.append(kit.icon('lock'));
      classAt(cell, 'is-green', greenAt + i * every);
    }
    return node;
  }

  let rocketCount = 0;

  /** A gradient whose stops take their colours from CSS classes. */
  function gradientDef(defs, tag, id, attrs, stops) {
    const grad = svg(tag, { id, ...attrs }, defs);
    stops.forEach(([offset, className]) => svg('stop', { offset, class: className }, grad));
    return grad;
  }

  /** An engine bell at (cx, y): `top` wide at its throat, `bottom` wide `h` below. */
  const bell = (cx, y, top, bottom, h) =>
    `M${cx - top / 2} ${y} L${cx + top / 2} ${y} L${cx + bottom / 2} ${y + h} Q${cx} ${y + h + 2.5} ${cx - bottom / 2} ${y + h} Z`;

  /**
   * The cut-away window into a rocket's equipment bay, and inside it the
   * gold module: the inertial reference system, with its gyroscope, vents,
   * and cables. A ring around the window lights when the song points at it.
   */
  function equipmentBay(parent, fills, { x, y, w, h }) {
    const g = svg('g', { class: 'rk-rkt-bay' }, parent);
    svg('rect', { class: 'rk-rkt-window-ring', x: x - 3, y: y - 3, width: w + 6, height: h + 6, rx: 5 }, g);
    svg('rect', { class: 'rk-rkt-window', x, y, width: w, height: h, rx: 3, fill: fills.bay }, g);
    const mx = x + 3;
    const my = y + 3;
    const mw = w - 6;
    const mh = h - 8;
    svg('path', { class: 'rk-rkt-cable', d: `M${mx + mw * 0.3} ${my + mh} V${y + h - 0.5} M${mx + mw * 0.7} ${my + mh} V${y + h - 0.5}` }, g);
    const module = svg('g', { class: 'rk-rkt-module' }, g);
    svg('rect', { class: 'rk-rkt-module-box', x: mx, y: my, width: mw, height: mh, rx: 2, fill: fills.gold }, module);
    svg('rect', { class: 'rk-rkt-module-lid', x: mx + 1.2, y: my + 1.2, width: mw - 2.4, height: 2.2, rx: 1 }, module);
    const r = Math.min(mw, mh) * 0.24;
    const cx = mx + mw / 2;
    const cy = my + mh * 0.44;
    svg('circle', { class: 'rk-rkt-gyro', cx, cy, r }, module);
    svg('path', { class: 'rk-rkt-gyro-axis', d: `M${cx - r} ${cy} H${cx + r} M${cx} ${cy - r} V${cy + r}` }, module);
    svg('path', { class: 'rk-rkt-vents', d: `M${mx + 2} ${my + mh - 3.6} H${mx + mw - 2} M${mx + 2} ${my + mh - 1.8} H${mx + mw - 2}` }, module);
    svg('rect', { class: 'rk-rkt-window-frame', x, y, width: w, height: h, rx: 3 }, g);
    return g;
  }

  /**
   * The two Ariane rockets, drawn in a 120 × 250 box over a launch table.
   * Each returns its equipment bay, its engines ([x, y] of each nozzle exit),
   * and the height of the service arm that reaches it.
   */
  const ROCKETS = {
    // Ariane 4: a slim core of three stages under a wider payload fairing,
    // two of its four liquid strap-on boosters in view, and Viking engines.
    ariane4(ship, fills) {
      [35, 85].forEach((cx) => {
        svg('path', { class: 'rk-rkt-shell', fill: fills.body, d: `M${cx - 6} 150 C${cx - 6} 142 ${cx - 3} 137 ${cx} 133 C${cx + 3} 137 ${cx + 6} 142 ${cx + 6} 150 V220 H${cx - 6} Z` }, ship);
        svg('rect', { class: 'rk-rkt-band', fill: fills.metal, x: cx - 6, y: 150, width: 12, height: 3 }, ship);
        svg('path', { class: 'rk-rkt-seam', d: `M${cx - 6} 186 H${cx + 6}` }, ship);
        svg('path', { class: 'rk-rkt-metal', fill: fills.metal, d: `M${cx - 6} 220 H${cx + 6} L${cx + 7} 225 H${cx - 7} Z` }, ship);
        svg('path', { class: 'rk-rkt-metal', fill: fills.metal, d: bell(cx, 225, 7, 10, 9) }, ship);
      });
      svg('path', { class: 'rk-rkt-strut', d: 'M41 158 L44 157 M41 214 L44 213 M79 158 L76 157 M79 214 L76 213' }, ship);
      svg('path', { class: 'rk-rkt-metal', fill: fills.metal, d: 'M44 222 H76 L79 229 H41 Z' }, ship);
      [49, 60, 71].forEach((cx) => svg('path', { class: 'rk-rkt-metal', fill: fills.metal, d: bell(cx, 229, 6, 9, 8) }, ship));
      svg('rect', { class: 'rk-rkt-shell', fill: fills.body, x: 44, y: 150, width: 32, height: 72 }, ship);
      svg('path', { class: 'rk-rkt-seam', d: 'M44 186 H76' }, ship);
      svg('rect', { class: 'rk-rkt-raceway', x: 69, y: 152, width: 2.5, height: 68 }, ship);
      svg('rect', { class: 'rk-rkt-hatch', x: 51, y: 198, width: 7, height: 5, rx: 1 }, ship);
      svg('rect', { class: 'rk-rkt-band', fill: fills.metal, x: 44, y: 145, width: 32, height: 5 }, ship);
      svg('rect', { class: 'rk-rkt-shell', fill: fills.body, x: 44, y: 116, width: 32, height: 29 }, ship);
      svg('path', { class: 'rk-rkt-seam', d: 'M44 131 H76' }, ship);
      svg('path', { class: 'rk-rkt-band', fill: fills.metal, d: 'M44 116 H76 L73 111 H47 Z' }, ship);
      svg('rect', { class: 'rk-rkt-shell', fill: fills.body, x: 47, y: 80, width: 26, height: 31 }, ship);
      const bay = equipmentBay(ship, fills, { x: 50.5, y: 84, w: 19, h: 23 });
      svg('path', { class: 'rk-rkt-shell', fill: fills.body, d: 'M47 80 H73 L78 74 H42 Z' }, ship);
      svg('path', { class: 'rk-rkt-shell', fill: fills.body, d: 'M42 74 V44 C42 29 50 19 60 14 C70 19 78 29 78 44 V74 Z' }, ship);
      svg('path', { class: 'rk-rkt-seam', d: 'M60 16 V74 M42 44 H78' }, ship);
      return { bay, nozzles: [[49, 237], [60, 237], [71, 237], [35, 234], [85, 234]], arm: 122, mastTop: 104 };
    },
    // Ariane 5: a wide cryogenic core with its Vulcain engine, two big solid
    // boosters, and the equipment bay on top of the core.
    ariane5(ship, fills) {
      [28, 92].forEach((cx) => {
        svg('path', { class: 'rk-rkt-shell', fill: fills.body, d: `M${cx - 8} 98 C${cx - 8} 87 ${cx - 4} 79 ${cx} 74 C${cx + 4} 79 ${cx + 8} 87 ${cx + 8} 98 V212 H${cx - 8} Z` }, ship);
        svg('rect', { class: 'rk-rkt-band', fill: fills.metal, x: cx - 8, y: 98, width: 16, height: 3 }, ship);
        svg('path', { class: 'rk-rkt-seam', d: `M${cx - 8} 136 H${cx + 8} M${cx - 8} 174 H${cx + 8}` }, ship);
        svg('path', { class: 'rk-rkt-metal', fill: fills.metal, d: `M${cx - 8} 212 H${cx + 8} L${cx + 9.5} 218 H${cx - 9.5} Z` }, ship);
        svg('path', { class: 'rk-rkt-metal', fill: fills.metal, d: bell(cx, 218, 9, 14, 12) }, ship);
      });
      svg('path', { class: 'rk-rkt-strut', d: 'M36 106 L42 105 M36 204 L42 203 M84 106 L78 105 M84 204 L78 203' }, ship);
      svg('path', { class: 'rk-rkt-metal', fill: fills.metal, d: 'M42 220 H78 L80 225 H40 Z' }, ship);
      svg('path', { class: 'rk-rkt-metal', fill: fills.metal, d: bell(60, 225, 12, 20, 11) }, ship);
      svg('rect', { class: 'rk-rkt-shell', fill: fills.body, x: 42, y: 100, width: 36, height: 120 }, ship);
      svg('path', { class: 'rk-rkt-seam', d: 'M42 140 H78 M42 182 H78' }, ship);
      svg('rect', { class: 'rk-rkt-raceway', x: 72, y: 102, width: 2.5, height: 116 }, ship);
      svg('rect', { class: 'rk-rkt-shell', fill: fills.body, x: 42, y: 70, width: 36, height: 30 }, ship);
      svg('rect', { class: 'rk-rkt-band', fill: fills.metal, x: 42, y: 98, width: 36, height: 4 }, ship);
      const bay = equipmentBay(ship, fills, { x: 50.5, y: 73, w: 19, h: 23 });
      svg('path', { class: 'rk-rkt-shell', fill: fills.body, d: 'M42 70 V40 C42 25 50 14 60 9 C70 14 78 25 78 40 V70 Z' }, ship);
      svg('path', { class: 'rk-rkt-seam', d: 'M60 11 V70 M42 40 H78' }, ship);
      return { bay, nozzles: [[60, 236], [28, 230], [92, 230]], arm: 64, mastTop: 52 };
    },
  };

  /**
   * An Ariane rocket on its launch table (kind 'ariane4' or 'ariane5'):
   * white shells shaded as cylinders, dark interstages and engines, and a
   * cut-away window onto the gold module in its equipment bay, which
   * `module` lights. launchAt swings the service arm away, lights the
   * engines in a cloud of launch smoke, and lifts the rocket off; veerAt
   * tips it off course; bloomAt breaks it apart: its pieces (and the gold
   * module) fly off slowly inside a slow orange bloom (no white, no flash).
   */
  function rocket(parent, { x, y, name, kind = 'ariane4', at, until, launchAt, veerAt, bloomAt, module: moduleAt }) {
    const node = show(box(parent, 'rk-rocket', { x, y, w: 120, h: 250 }), at, until, 'fade');
    const art = svg('svg', { viewBox: '0 0 120 250', width: 120, height: 250, 'aria-hidden': 'true' }, node);
    const id = `rk-rkt${++rocketCount}`;
    const defs = svg('defs', {}, art);
    const across = { x1: 0, y1: 0, x2: 1, y2: 0 };
    gradientDef(defs, 'linearGradient', `${id}-body`, across, [[0, 'rk-rkt-body-0'], [0.24, 'rk-rkt-body-1'], [0.62, 'rk-rkt-body-2'], [1, 'rk-rkt-body-3']]);
    gradientDef(defs, 'linearGradient', `${id}-metal`, across, [[0, 'rk-rkt-metal-0'], [0.3, 'rk-rkt-metal-1'], [1, 'rk-rkt-metal-2']]);
    gradientDef(defs, 'linearGradient', `${id}-gold`, { x1: 0, y1: 0, x2: 0.6, y2: 1 }, [[0, 'rk-rkt-gold-0'], [0.45, 'rk-rkt-gold-1'], [1, 'rk-rkt-gold-2']]);
    gradientDef(defs, 'radialGradient', `${id}-bay`, { cx: 0.4, cy: 0.35, r: 0.8 }, [[0, 'rk-rkt-bay-0'], [1, 'rk-rkt-bay-1']]);
    gradientDef(defs, 'linearGradient', `${id}-flame`, { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, 'rk-rkt-flame-0'], [0.45, 'rk-rkt-flame-1'], [1, 'rk-rkt-flame-2']]);
    const fills = { body: `url(#${id}-body)`, metal: `url(#${id}-metal)`, gold: `url(#${id}-gold)`, bay: `url(#${id}-bay)`, flame: `url(#${id}-flame)` };
    // The launch table with its flame trench, and the service mast.
    const ground = svg('g', { class: 'rk-rkt-ground' }, art);
    // One group, faded as a whole, so overlapping puffs read as one cloud.
    const smoke = svg('g', { class: 'rk-rkt-smoke', opacity: 0 }, art);
    const ship = svg('g', { class: 'rk-rocket-ship' }, art);
    const flames = svg('g', { class: 'is-staged' }, ship);
    const drawn = ROCKETS[kind](ship, fills);
    let mast = 'M5 236 V' + drawn.mastTop + ' M13 236 V' + drawn.mastTop + ' ';
    for (let my = 236, left = true; my > drawn.mastTop; my -= 10, left = !left) mast += `M${left ? 5 : 13} ${my} L${left ? 13 : 5} ${Math.max(drawn.mastTop, my - 10)} `;
    svg('path', { class: 'rk-rkt-mast', d: mast }, ground);
    svg('rect', { class: 'rk-rkt-mast-cap', x: 3, y: drawn.mastTop - 3, width: 12, height: 3, rx: 1 }, ground);
    const arm = svg('path', { class: 'rk-rkt-arm', d: `M13 ${drawn.arm} H${kind === 'ariane5' ? 40 : 42} M13 ${drawn.arm + 4} L${kind === 'ariane5' ? 40 : 42} ${drawn.arm}` }, ground);
    svg('rect', { class: 'rk-rkt-pad', x: 3, y: 238, width: 114, height: 8, rx: 1.5, fill: fills.metal }, ground);
    svg('rect', { class: 'rk-rkt-trench', x: 40, y: 238, width: 40, height: 3, rx: 1 }, ground);
    svg('path', { class: 'rk-rkt-legs', d: 'M14 246 V250 M106 246 V250' }, ground);
    // The engines' flames, under each nozzle: an outer flame and its core.
    const flameShapes = drawn.nozzles.map(([fx0, fy], i) => {
      const w = i === 0 ? (kind === 'ariane5' ? 16 : 7) : (kind === 'ariane5' ? 11 : 7);
      const g = svg('g', {}, flames);
      svg('path', { class: 'rk-rkt-flame', fill: fills.flame, d: `M${fx0 - w / 2} ${fy} Q${fx0} ${fy + 30} ${fx0 + w / 2} ${fy} Z` }, g);
      svg('path', { class: 'rk-rkt-flame-core', d: `M${fx0 - w / 4} ${fy} Q${fx0} ${fy + 13} ${fx0 + w / 4} ${fy} Z` }, g);
      return { g, x: fx0, y: fy, phase: i * 1.7 };
    });
    // Launch smoke: soft clouds that billow out over the table and fade.
    const puffs = [[22, 236, 9], [40, 240, 11], [60, 242, 12], [80, 240, 11], [98, 236, 9], [50, 234, 8], [72, 234, 8]].map(([px, py, r]) =>
      svg('circle', { cx: px, cy: py, r }, smoke));
    if (moduleAt !== undefined) classAt(drawn.bay, 'rk-module-lit', moduleAt);
    if (launchAt !== undefined) fx.fadeIn(flames, launchAt - 0.2, 0.2);
    el('div', 'rk-rocket-name', node, name);
    const bloom = el('div', 'rk-bloom is-staged', node);
    // The pieces the breakup scatters, each with its own seeded path: shell
    // panels, dark engine parts, and the gold module.
    // The self-destruct's fireball and smoke, each one group faded as a whole.
    const blast = svg('g', { class: 'rk-rkt-blast' }, art);
    const smokeCloud = svg('g', { class: 'rk-rkt-blast-smoke', opacity: 0 }, blast);
    const fireball = svg('g', { class: 'rk-rkt-blast-fire', opacity: 0 }, blast);
    const blastPuffs = Array.from({ length: 7 }, (_, i) => ({
      a: (i / 7) * Math.PI * 2 + 0.4, d: i === 0 ? 0 : 14 + 6 * hash01(i * 19 + 2),
      smokeDot: svg('circle', { cx: 0, cy: 0, r: 12 + 4 * hash01(i * 3 + 1) }, smokeCloud),
      fireDot: svg('circle', { cx: 0, cy: 0, r: 11 + 4 * hash01(i * 5 + 7) }, fireball),
    }));
    const debris = svg('g', { class: 'rk-rocket-debris' }, art);
    const pieces = Array.from({ length: 14 }, (_, i) => {
      const kindOf = i === 6 ? 'gold' : i % 3 === 2 ? 'metal' : 'panel';
      const g = svg('g', {}, debris);
      const w = kindOf === 'gold' ? 10 : 7 + 9 * hash01(i * 13 + 1);
      const h = kindOf === 'gold' ? 8 : 4 + 4 * hash01(i * 17 + 9);
      if (kindOf === 'panel' && i % 4 === 0) svg('path', { class: 'rk-rkt-debris-panel', d: `M${-w / 2} ${h / 2} L0 ${-h} L${w / 2} ${h / 2} Z` }, g);
      else svg('rect', { class: `rk-rkt-debris-${kindOf}`, x: -w / 2, y: -h / 2, width: w, height: h, rx: 1.2 }, g);
      const angle = (i / 14) * Math.PI * 2 + hash01(i * 7 + 2);
      return { g, angle, dist: 38 + 52 * hash01(i * 5 + 3), spin: (hash01(i * 11 + 4) - 0.5) * 420 };
    });
    // The whole rocket stays in view: it climbs and grows smaller as it
    // flies up and away (scaled about its base), and veers about its middle.
    // cx, cy is the middle of the rocket, where it breaks apart.
    const BASE = 238;
    const pose = (t) => {
      const climb = launchAt === undefined ? 0 : easeInOutCubic(progress(t, launchAt, 2.4));
      const veer = veerAt === undefined ? 0 : progress(t, veerAt, 1.2);
      const k = 1 - 0.55 * climb;
      const rise = 112 * climb;
      const dx = 18 * veer * veer;
      return { k, rise, dx, angle: 38 * easeInOutCubic(veer), cx: 60 + dx, cy: BASE - rise - 112 * k, lift: rise };
    };
    onFrame((t) => {
      const { k, rise, dx, angle, cx, cy } = pose(t);
      ship.setAttribute('transform', `rotate(${angle.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)}) translate(${dx.toFixed(1)} ${(-rise).toFixed(1)}) translate(60 ${BASE}) scale(${k.toFixed(3)}) translate(-60 ${-BASE})`);
      if (launchAt !== undefined) {
        // The service arm swings up and away just before ignition.
        const swing = 72 * easeInOutCubic(progress(t, launchAt - 0.9, 0.5));
        arm.setAttribute('transform', `rotate(${(-swing).toFixed(1)} 13 ${drawn.arm})`);
        // The flames grow as the rocket climbs, flickering a little in length.
        const grow = 0.4 + 0.6 * clamp(rise / 30, 0, 1);
        flameShapes.forEach((f) => {
          const k = grow * (1 + 0.07 * Math.sin(t * 17 + f.phase));
          f.g.setAttribute('transform', `translate(${f.x} ${f.y}) scale(1 ${k.toFixed(3)}) translate(${-f.x} ${-f.y})`);
        });
        // Smoke billows out over the launch table and thins away.
        const s = progress(t, launchAt - 0.1, 2.6);
        smoke.setAttribute('opacity', (s > 0 && s < 1 ? 0.85 * Math.min(1, s * 6) * (1 - s) : 0).toFixed(3));
        puffs.forEach((puff, i) => {
          // Billowing out sideways and rising a little, never down over the name.
          const out = easeOutCubic(s);
          const away = (i % 2 ? 1 : -1) * 7 * out;
          const cx = Number(puff.getAttribute('cx'));
          const cy = Number(puff.getAttribute('cy'));
          puff.setAttribute('transform', `translate(${(cx + away).toFixed(1)} ${(cy - 5 * out).toFixed(1)}) scale(${(1 + 1.1 * out).toFixed(3)} ${(1 + 0.3 * out).toFixed(3)}) translate(${-cx} ${-cy})`);
        });
      }
      const breaking = bloomAt !== undefined && t >= bloomAt;
      debris.style.display = breaking ? '' : 'none';
      blast.style.display = breaking ? '' : 'none';
      if (!breaking) return;
      const at0 = pose(bloomAt);
      const p = clamp((t - bloomAt) / 1.8, 0, 1);
      const out = easeOutCubic(p);
      // The self-destruct: a fireball swells and dims to orange-brown, then
      // a cloud of smoke spreads and sinks; no white, no flash.
      const fire = clamp((t - bloomAt) / 0.9, 0, 1);
      const fade = clamp((t - bloomAt) / 3.2, 0, 1);
      fireball.setAttribute('opacity', (0.95 * (1 - fire)).toFixed(3));
      smokeCloud.setAttribute('opacity', (0.85 * Math.min(1, (t - bloomAt) * 4) * (1 - fade)).toFixed(3));
      blastPuffs.forEach(({ fireDot, smokeDot, a, d }) => {
        const r = 0.45 + 1.1 * easeOutCubic(fire);
        const fxp = at0.cx + Math.cos(a) * d * easeOutCubic(fire);
        const fyp = at0.cy + Math.sin(a) * d * easeOutCubic(fire);
        fireDot.setAttribute('transform', `translate(${fxp.toFixed(1)} ${fyp.toFixed(1)}) scale(${r.toFixed(3)})`);
        const sr = 0.7 + 1.3 * easeOutCubic(fade);
        smokeDot.setAttribute('transform', `translate(${(at0.cx + Math.cos(a) * d * 1.6 * easeOutCubic(fade)).toFixed(1)} ${(at0.cy + Math.sin(a) * d * 1.3 * easeOutCubic(fade) + 14 * fade).toFixed(1)}) scale(${sr.toFixed(3)})`);
      });
      pieces.forEach(({ g, angle: a, dist, spin }) => {
        const px = at0.cx + Math.cos(a) * dist * out;
        const py = at0.cy + Math.sin(a) * dist * out + 26 * p * p;
        g.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(spin * out).toFixed(1)})`);
        g.style.opacity = (1 - clamp((p - 0.45) / 0.55, 0, 1)).toFixed(3);
      });
    });
    if (bloomAt !== undefined) {
      // The glow is centred where the rocket breaks apart.
      const at0 = pose(bloomAt);
      bloom.style.left = `${(at0.cx - 70).toFixed(1)}px`;
      bloom.style.top = `${(at0.cy - 70).toFixed(1)}px`;
      fx.fadeOut(ship, bloomAt, 0.15);
      tween(bloom, [{ opacity: 0, scale: 0.2 }, { opacity: 0.85, scale: 1 }, { opacity: 0, scale: 1.5 }], bloomAt, 2.4, EASE.out);
    }
    return { node, ship };
  }

  /**
   * A gauge for a 16-bit signed integer: values = [[t, value]] drives the
   * needle; the dial ends at 32,767, and beyond it the readout says overflow.
   */
  function gauge(parent, { x, y, at, until, values, title, limitAt }) {
    const node = show(box(parent, 'rk-gauge', { x, y, w: 260 }), at, until, 'rise');
    if (title) el('div', 'rk-gauge-title', node, title);
    const art = svg('svg', { viewBox: '0 0 260 150', width: 260, height: 150, 'aria-hidden': 'true' }, node);
    const cx = 130;
    const cy = 135;
    const R = 110;
    const MAX = 40000;
    const LIMIT = 32767;
    const point = (v, r) => {
      const a = Math.PI * (1 - v / MAX);
      return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    };
    const arc = (from, to, r) => {
      const [x1, y1] = point(from, r);
      const [x2, y2] = point(to, r);
      return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    };
    svg('path', { class: 'rk-gauge-safe', d: arc(0, LIMIT, R) }, art);
    svg('path', { class: 'rk-gauge-over', d: arc(LIMIT, MAX, R) }, art);
    const limit = svg('g', { class: 'rk-gauge-limit is-staged' }, art);
    const [lx1, ly1] = point(LIMIT, R - 16);
    const [lx2, ly2] = point(LIMIT, R + 12);
    svg('path', { d: `M${lx1.toFixed(1)} ${ly1.toFixed(1)} L${lx2.toFixed(1)} ${ly2.toFixed(1)}` }, limit);
    if (limitAt !== undefined) fx.fadeIn(limit, limitAt, 0.3);
    const needle = svg('path', { class: 'rk-gauge-needle', d: `M${cx} ${cy} L${cx - R + 18} ${cy}` }, art);
    svg('circle', { class: 'rk-gauge-hub', cx, cy, r: 7 }, art);
    const readout = el('div', 'rk-gauge-readout', node);
    const limitText = el('div', 'rk-gauge-limit-text is-staged', node, 'limit 32,767');
    if (limitAt !== undefined) fx.fadeIn(limitText, limitAt, 0.3);
    const keys = [...values].sort((a, b) => a[0] - b[0]);
    onFrame((t) => {
      let v = keys[0][1];
      for (let i = 1; i < keys.length; i++) {
        const [t0, v0] = keys[i - 1];
        const [t1, v1] = keys[i];
        if (t >= t1) v = v1;
        else if (t > t0) { v = v0 + (v1 - v0) * easeInOutCubic((t - t0) / (t1 - t0)); break; }
      }
      const shown = Math.min(v, MAX - 600);
      const angle = (180 * shown) / MAX;
      needle.setAttribute('transform', `rotate(${angle.toFixed(2)} ${cx} ${cy})`);
      const over = v > LIMIT;
      const text = over ? 'overflow!' : Math.round(v).toLocaleString('en-US');
      if (readout.textContent !== text) readout.textContent = text;
      readout.classList.toggle('is-over', over);
    });
    return node;
  }

  /** A list of checkboxes = [{ text, at }] ticked at their `at`. */
  function checkboxes(parent, { x, y, w, items, at, until }) {
    const node = show(box(parent, 'rk-checks', { x, y, w }), at, until, 'rise');
    items.forEach((item) => {
      const row = el('div', 'rk-check-row', node);
      const boxNode = el('span', 'rk-check-box', row);
      const markIcon = kit.icon('check');
      markIcon.classList.add('is-staged');
      boxNode.append(markIcon);
      fx.pop(markIcon, item.at, { from: 1.6 });
      el('span', 'rk-check-text', row, item.text);
      classAt(row, 'is-done', item.at);
    });
    return node;
  }

  /**
   * A balance scale: `left` and `right` pans, tipping towards `tilt`
   * (−1 left … 1 right) at tiltAt; weights = [left, right] stacks that many
   * bricks on each pan, dropping on at `at` + 0.4: reused bricks (blue) on
   * the left, your own work (gold) on the right.
   */
  function scale(parent, { x, y, at, until, left, right, tilt = 0, tiltAt, weights = [0, 0] }) {
    const node = show(box(parent, 'rk-scale', { x, y, w: 340, h: 190 }), at, until, 'rise');
    const art = svg('svg', { viewBox: '0 0 340 190', width: 340, height: 190, 'aria-hidden': 'true' }, node);
    svg('path', { class: 'rk-scale-stand', d: 'M170 40 V170 M120 176 H220' }, art);
    const beam = svg('g', { class: 'rk-scale-beam' }, art);
    svg('path', { class: 'rk-scale-bar', d: 'M50 40 H290' }, beam);
    svg('circle', { class: 'rk-scale-pivot', cx: 170, cy: 40, r: 7 }, art);
    const pans = [50, 290].map((px, side) => {
      const pan = svg('g', {}, beam);
      svg('path', { class: 'rk-scale-string', d: `M${px} 40 L${px - 38} 104 M${px} 40 L${px + 38} 104` }, pan);
      for (let i = 0; i < weights[side]; i++) {
        const b = svgBrick(pan, { x: px - 22, y: 86 - i * 14, w: 44, h: 14, tone: side ? 'gold' : 'blue', studs: 2, studW: 8, studH: 3.5 });
        b.classList.add('is-staged');
        tween(b, [{ opacity: 0, translate: '0 -30px' }, { opacity: 1, translate: '0 0' }], at + 0.4 + (side * 3 + i) * 0.12, 0.3, EASE.back);
      }
      svg('path', { class: 'rk-scale-pan', d: `M${px - 46} 100 Q${px} 128 ${px + 46} 100 Z` }, pan);
      return pan;
    });
    const leftLabel = el('div', 'rk-scale-label rk-scale-label--left', node, left);
    const rightLabel = el('div', 'rk-scale-label rk-scale-label--right', node, right);
    onFrame((t) => {
      const p = tiltAt === undefined ? 0 : easeInOutCubic(progress(t, tiltAt, 0.8));
      const angle = 8 * tilt * p;
      beam.setAttribute('transform', `rotate(${angle.toFixed(2)} 170 40)`);
      const dy = Math.sin((angle * Math.PI) / 180) * 120;
      pans.forEach((pan, i) => pan.setAttribute('transform', `rotate(${(-angle).toFixed(2)} ${i ? 290 : 50} 40)`));
      leftLabel.style.translate = `0 ${(-dy).toFixed(1)}px`;
      rightLabel.style.translate = `0 ${dy.toFixed(1)}px`;
    });
    return node;
  }

  // ------------------------------------------------------------------
  // The refrain's checklist and the quiz card
  // ------------------------------------------------------------------

  /**
   * The refrain's card: items = [{ q, name, icon, at, tabs: [text] }], each
   * lit from its `at`, when its brick (gold, a principle to keep) also drops
   * onto the tower in the card's right column; the footer and the tower's
   * baseplate light at footerAt; tabsAt shows the case tabs beside the
   * items.
   */
  function checklist(parent, { x, y, w, title, items, footer, at, until, footerAt, tabsAt }) {
    const node = show(box(parent, 'rk-list', { x, y, w }), at, until, 'rise');
    el('div', 'rk-list-title', node, title);
    const tower = el('div', 'rk-list-tower', node);
    const base = el('div', 'rk-list-base rk-c-grey', tower);
    studs(base, 4, 'rk-studs rk-studs--plate');
    classAt(base, 'is-lit', footerAt);
    items.forEach((item, i) => {
      const row = el('div', 'rk-list-row', node);
      const badge = el('span', 'rk-list-icon rk-c-gold', row);
      badge.append(kit.icon(item.icon));
      const words = el('div', 'rk-list-words', row);
      el('div', 'rk-list-q', words, item.q);
      el('div', 'rk-list-name', words, item.name);
      classAt(row, 'is-lit', item.at);
      if (item.tabs && tabsAt !== undefined) {
        const tabs = el('div', 'rk-list-tabs', row);
        item.tabs.forEach((text, j) => fx.pop(el('span', 'rk-list-tab is-staged', tabs, text), tabsAt + j * 0.1, { from: 0.6 }));
      }
      // Its brick drops onto the tower.
      const brick = el('div', 'rk-list-brick rk-c-gold is-staged', tower);
      studs(brick, 2);
      brick.append(kit.icon(item.icon));
      brick.style.bottom = `${16 + i * 40}px`;
      tween(brick, [{ opacity: 0, translate: '0 -60px' }, { opacity: 1, translate: '0 0' }], item.at, 0.45, EASE.back);
    });
    const foot = el('div', 'rk-list-footer', node);
    el('span', 'rk-list-footer-text', foot, footer);
    classAt(foot, 'is-lit', footerAt);
    fx.bump(foot, footerAt, 0.06);
    return node;
  }

  /** One quiz question: "Question n of total", the question, and an answer brick that snaps on. */
  function quiz(parent, { x, y, w, n, total, question, answer, icon, at, answerAt, until }) {
    const card = show(box(parent, 'rk-quiz', { x, y, w }), at, until, 'rise');
    const head = el('div', 'rk-quiz-head', card);
    el('span', 'rk-quiz-pill', head, 'Your case');
    el('span', 'rk-quiz-number', head, `Question ${n} of ${total}`);
    el('div', 'rk-quiz-question', card, question);
    const bar = el('div', 'rk-quiz-answer rk-c-green is-staged', card);
    studs(bar, 6);
    el('span', 'rk-quiz-emblem', bar).append(kit.icon(icon));
    el('span', 'rk-quiz-answer-text', bar, answer);
    tween(bar, [{ opacity: 0, translate: '0 -34px' }, { opacity: 1, translate: '0 0' }], answerAt, 0.4, EASE.back);
    return card;
  }

  window.ReuseKit = {
    SPREAD, LEFT, RIGHT, show, classAt, textAt,
    spread, group, layer, brickIcon, pkg, plate, crack, dust, strain, arrow, code, term, label, note, inkStamp, tick,
    shelf, users, bars, vision, wallGap, padColumn, timeline, padlock, appGrid, rocket, gauge,
    checkboxes, scale, checklist, quiz,
  };
})();
