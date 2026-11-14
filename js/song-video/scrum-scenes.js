/*
 * Scrum scenes for "Inspect and Adapt", the Scrum musical
 * (storyboard: _data/songs/inspect_and_adapt.yml): the role metaphors of the
 * CS 130 Scrum lecture, drawn as live vector scenes on the team room's
 * screen, and the slide furniture around them.
 *
 *   slide()            a slide: a header band (the role's emblem, name, and
 *                      metaphor), a scene panel, and a side panel;
 *   accountabilities() the side panel's list: what a role is accountable
 *                      for (✓), and a "not" row of what it is not (struck);
 *   court()            the team coach: a basketball court seen from above,
 *                      the Developers on it, the Scrum Master on the
 *                      sideline; plays, a huddle, the game clock (a
 *                      timebox), a wall (an impediment) the coach clears;
 *   leadership()       a project manager's pyramid beside the servant-
 *                      leader's inverted one;
 *   chart()            the value navigator: a sea chart whose waypoints
 *                      are user stories, ordered by value along a course
 *                      to the product vision, with a compass reading Value;
 *   site()             the builders: the Increment rising block by block,
 *                      the team's toolbox, its own task board, and the
 *                      Definition of Done seal;
 *   temple()           empiricism on its three pillars;
 *   roleCards()        the three accountabilities side by side.
 *
 * Every pose is a pure function of song time (Timeline tweens and frame
 * updaters); under reduced motion moving tokens snap to their places.
 * Coordinates are CSS pixels; a scene's SVG uses its panel's pixels as its
 * user units, so labels and art share one frame. Every meaning is written in
 * words, and colour only repeats them (WCAG 1.4.1). Styles:
 * css/song-video-scrum-scenes.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, progress, easeInOutCubic } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, place } = kit;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let uid = 0;

  /** Shows a node from `at` and, with `until`, hides it again. */
  function show(node, at, until, how = 'pop') {
    if (how === 'rise') fx.rise(node, at, { distance: 14, duration: 0.4 });
    else if (how === 'fade') fx.fadeIn(node, at, 0.3);
    else if (how === 'slam') fx.slam(node, at, { from: 1.6 });
    else fx.pop(node, at, { from: 0.7 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  /** An absolutely placed box `w` wide (and `h` high). */
  function box(layer, className, { x, y, w, h }) {
    const node = place(el('div', `${className} is-staged`, layer), x, y);
    if (w !== undefined) node.style.width = `${w}px`;
    if (h !== undefined) node.style.height = `${h}px`;
    return node;
  }

  /**
   * A point that moves through keyframes: move(at, [x, y], duration) eases
   * it to a place; at(t) is where it is at song time t.
   */
  function track(start) {
    const keys = [];
    return {
      move(at, to, duration = 0.7) {
        keys.push({ at, to, duration: reducedMotion.matches ? 0.01 : duration });
        keys.sort((a, b) => a.at - b.at);
      },
      at(t) {
        let [x, y] = start;
        for (const key of keys) {
          if (t < key.at) break;
          const p = easeInOutCubic(progress(t, key.at, key.duration));
          x += (key.to[0] - x) * p;
          y += (key.to[1] - y) * p;
        }
        return [x, y];
      },
    };
  }

  /** A label pill on a scene, centred on (x, y) unless `align` says otherwise. */
  function label(parent, text, { x, y, at, until, tone = 'cream', align = 'center', icon }) {
    const node = place(el('div', `ss-label ss-label--${tone} ss-label--${align} is-staged`, parent), x, y);
    if (icon) node.append(kit.icon(icon));
    node.append(document.createTextNode(text));
    return show(node, at, until, 'rise');
  }

  /** An SVG line that draws itself from (x1, y1) to (x2, y2) over `duration`, with an arrowhead. */
  function drawnLine(art, [x1, y1], [x2, y2], { at, duration = 0.5, until, className = 'ss-play', head = true }) {
    const g = svg('g', { class: `${className} is-staged` }, art);
    const line = svg('line', { x1, y1, x2: x1, y2: y1 }, g);
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    const tip = head ? svg('path', { class: `${className}-head`, d: 'M0 0 L-9 -5 L-9 5 Z', transform: `translate(${x2} ${y2}) rotate(${angle.toFixed(1)})`, opacity: 0 }, g) : null;
    fx.fadeIn(g, at, 0.1);
    if (until !== undefined) fx.fadeOut(g, until, 0.3);
    onFrame((t) => {
      const p = easeInOutCubic(progress(t, at, reducedMotion.matches ? 0.01 : duration));
      line.setAttribute('x2', (x1 + (x2 - x1) * p).toFixed(1));
      line.setAttribute('y2', (y1 + (y2 - y1) * p).toFixed(1));
      if (tip) tip.setAttribute('opacity', p > 0.96 ? 1 : 0);
    });
    return g;
  }

  /** A token: a coloured disc with an icon, its centre moved by a track. */
  function token(art, { at, tone, icon, start, r = 12 }) {
    const g = svg('g', { class: `ss-token ss-token--${tone} is-staged` }, art);
    svg('circle', { class: 'ss-token-disc', r }, g);
    const glyph = kit.icon(icon);
    glyph.setAttribute('x', -r * 0.62);
    glyph.setAttribute('y', -r * 0.62);
    glyph.setAttribute('width', r * 1.24);
    glyph.setAttribute('height', r * 1.24);
    g.append(glyph);
    fx.fadeIn(g, at, 0.3);
    const path = track(start);
    onFrame((t) => {
      const [x, y] = path.at(t);
      g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    });
    return { node: g, move: path.move, at: path.at };
  }

  // ------------------------------------------------------------------
  // Slides
  // ------------------------------------------------------------------

  const ROLE_ICON = { coach: 'whistle', navigator: 'compass', builders: 'hardhat' };

  /**
   * A slide on the screen: a header band with the role's emblem, name, and
   * metaphor; under it a scene panel and (when sideW > 0) a side panel,
   * which the header's `tag` names at its right end.
   */
  function slide(layer, { x, y, w, h, role, title, metaphor, at, until, sideW = 228, header = 40, tag = 'Accountable for' }) {
    const node = box(layer, `ss-slide ss-slide--${role}`, { x, y, w, h });
    const head = el('div', 'ss-slide-head', node);
    head.style.height = `${header}px`;
    el('span', 'ss-emblem', head).append(kit.icon(ROLE_ICON[role]));
    el('span', 'ss-slide-title', head, title);
    el('span', 'ss-slide-metaphor', head, metaphor);
    if (sideW && tag) {
      const label = el('span', 'ss-slide-tag', head, tag);
      label.style.width = `${sideW - 16}px`;
    }
    const top = header + 6;
    const sceneW = sideW ? w - sideW - 8 : w;
    const sceneH = h - top;
    const scene = place(el('div', 'ss-panel ss-panel--scene', node), 0, top);
    scene.style.width = `${sceneW}px`;
    scene.style.height = `${sceneH}px`;
    let side = null;
    if (sideW) {
      side = place(el('div', 'ss-panel ss-panel--side', node), w - sideW, top);
      side.style.width = `${sideW}px`;
      side.style.height = `${sceneH}px`;
    }
    show(node, at, until, 'fade');
    return { node, scene, side, sceneW, sceneH };
  }

  /**
   * A side panel's list: ok(text, at) adds what the role is accountable for;
   * not(text, at) adds, to one "not" row under it, what it is not (struck).
   */
  function accountabilities(side) {
    const list = el('div', 'ss-acc-list', side);
    const nots = el('div', 'ss-acc-not is-staged', side);
    el('span', 'ss-acc-not-label', nots, 'Not');
    let firstNot = null;
    return {
      ok(text, okAt) {
        const chip = el('div', 'ss-chip is-staged', list);
        el('span', 'ss-chip-mark', chip).append(kit.icon('check'));
        el('span', 'ss-chip-text', chip, text);
        return show(chip, okAt, undefined, 'rise');
      },
      not(text, notAt) {
        if (firstNot === null) {
          firstNot = notAt;
          fx.fadeIn(nots, notAt, 0.3);
        }
        const item = el('span', 'ss-not-item is-staged', nots, text);
        const strike = el('span', 'ss-not-strike is-staged', item);
        fx.fadeIn(item, notAt, 0.25);
        tween(strike, [{ opacity: 1, scale: '0 1' }, { opacity: 1, scale: '1 1' }], notAt + 0.35, 0.3, EASE.out);
        return item;
      },
    };
  }

  // ------------------------------------------------------------------
  // The team coach: a basketball court
  // ------------------------------------------------------------------

  /**
   * A court seen from above, in a w×h panel: the floor fills the width, the
   * sideline and bench run under it. players = [{ tone, at, start }], each
   * start a court point [fx, fy] in fractions of the court; the coach stands
   * on the sideline. Returns the tokens, pt() to turn a court point into
   * panel pixels, and the scene's moves.
   */
  function court(parent, { w, h, at, until, players }) {
    const id = `ss-court-${uid++}`;
    const node = show(box(parent, 'ss-court', { x: 0, y: 0, w, h }), at, until, 'fade');
    const art = svg('svg', { class: 'ss-art', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, node);
    const defs = svg('defs', {}, art);
    const maple = svg('linearGradient', { id: `${id}-maple`, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    svg('stop', { offset: 0, class: 'ss-maple-0' }, maple);
    svg('stop', { offset: 1, class: 'ss-maple-1' }, maple);

    const C = { x: 8, y: 6, w: w - 16 };
    C.h = Math.round(C.w * 15 / 28);
    const m = C.w / 28;  // pixels per metre of a FIBA court
    const cy = C.y + C.h / 2;
    svg('rect', { class: 'ss-sideline', x: 0, y: 0, width: w, height: h, rx: 8 }, art);
    svg('rect', { x: C.x, y: C.y, width: C.w, height: C.h, rx: 3, fill: `url(#${id}-maple)` }, art);
    const planks = [];
    for (let px = C.x + 13; px < C.x + C.w; px += 13) planks.push(`M${px.toFixed(1)} ${C.y}V${C.y + C.h}`);
    svg('path', { class: 'ss-planks', d: planks.join('') }, art);
    // Each half: the painted key, the free-throw circle, the three-point
    // line, the backboard, and the rim.
    for (const side of [1, -1]) {
      const base = side > 0 ? C.x : C.x + C.w;
      const hoop = base + side * 1.575 * m;
      const key = 5.8 * m;
      const lane = 4.9 * m;
      svg('rect', { class: 'ss-key', x: side > 0 ? base : base - key, y: cy - lane / 2, width: key, height: lane }, art);
      const r3 = 6.75 * m;
      const corner = 0.9 * m;
      const dy = cy - (C.y + corner);
      const dx = Math.sqrt(Math.max(0, r3 * r3 - dy * dy));
      const arcX = hoop + side * dx;
      svg('path', {
        class: 'ss-court-line',
        d: `M${base} ${C.y + corner} H${arcX.toFixed(1)} A${r3.toFixed(1)} ${r3.toFixed(1)} 0 0 ${side > 0 ? 1 : 0} ${arcX.toFixed(1)} ${(C.y + C.h - corner).toFixed(1)} H${base}`,
      }, art);
      svg('circle', { class: 'ss-court-line', cx: base + side * key, cy, r: 1.8 * m }, art);
      svg('path', { class: 'ss-backboard', d: `M${base + side * 1.2 * m} ${cy - 0.9 * m}V${cy + 0.9 * m}` }, art);
      svg('circle', { class: 'ss-rim', cx: hoop, cy, r: 3.6 }, art);
    }
    svg('rect', { class: 'ss-court-line', x: C.x, y: C.y, width: C.w, height: C.h }, art);
    svg('path', { class: 'ss-court-line', d: `M${C.x + C.w / 2} ${C.y}V${C.y + C.h}` }, art);
    svg('circle', { class: 'ss-court-line', cx: C.x + C.w / 2, cy, r: 1.8 * m }, art);
    // The bench along the sideline.
    const benchY = C.y + C.h + 12;
    svg('rect', { class: 'ss-bench', x: C.x + 4, y: benchY + 14, width: 86, height: 8, rx: 3 }, art);

    const pt = ([fx, fy]) => [C.x + fx * C.w, C.y + fy * C.h];
    const plays = svg('g', {}, art);
    const tokens = players.map((p) => token(art, { at: p.at, tone: p.tone, icon: 'user', start: pt(p.start) }));
    const coachStart = [C.x + 46, benchY + 10];
    const coach = token(art, { at, tone: 'coach', icon: 'whistle', start: coachStart, r: 13 });
    const front = svg('g', {}, art);

    return {
      node, art, tokens, coach, C, cy, benchY, pt,
      /** A play a player draws for themselves: an arrow from where they stand to a court point. */
      play(i, at2, to, until2) {
        return drawnLine(plays, tokens[i].at(at2), pt(to), { at: at2, until: until2 });
      },
      label(text, options) { return label(node, text, options); },
      /**
       * The game clock as a timebox: an event's name over digits that run
       * from `minutes` down to 00:00 between runFrom and runTo, then hold.
       */
      clock({ x, y, at: clockAt, until: clockUntil, runFrom, runTo, event, minutes }) {
        const board = show(box(node, 'ss-clock', { x, y }), clockAt, clockUntil, 'pop');
        el('div', 'ss-clock-event', board, event);
        const digits = el('div', 'ss-clock-digits', board, `${minutes}:00`);
        const total = minutes * 60;
        let shown = '';
        onFrame((t) => {
          const left = Math.round(total * (1 - progress(t, runFrom, runTo - runFrom)));
          const text = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
          if (text !== shown) {
            digits.textContent = text;
            shown = text;
          }
        });
        return board;
      },
      /** A wall across the court at x (from y to y + h), dropped at `at` and lifted at liftAt. */
      wall({ x, y, h: wallH, at: wallAt, liftAt }) {
        const g = svg('g', { class: 'ss-wall is-staged' }, front);
        for (let row = 0; row * 10 < wallH; row++) {
          for (let col = 0; col < 2; col++) {
            const off = row % 2 ? -5 : 0;
            svg('rect', { class: 'ss-brick', x: x + col * 10 + off, y: y + row * 10, width: col === 0 && off ? 5 : 10, height: 10 }, g);
          }
        }
        svg('rect', { class: 'ss-brick-edge', x: x - 5, y, width: 20, height: wallH }, g);
        fx.fadeIn(g, wallAt, 0.15);
        onFrame((t) => {
          const drop = 1 - easeInOutCubic(progress(t, wallAt, reducedMotion.matches ? 0.01 : 0.35));
          const lift = easeInOutCubic(progress(t, liftAt, reducedMotion.matches ? 0.01 : 0.6));
          g.setAttribute('transform', `translate(0 ${(-60 * drop - 90 * lift).toFixed(1)})`);
          g.setAttribute('opacity', (1 - lift).toFixed(2));
        });
        return g;
      },
    };
  }

  /**
   * Leadership, side by side: a project manager's pyramid (the manager on
   * top, directing; crossed at crossAt) and the servant-leader's inverted
   * pyramid (the team on top, the Scrum Master underneath, serving it).
   */
  function leadership(parent, { w, h, at, until, crossAt, serveAt }) {
    const node = show(box(parent, 'ss-leadership', { x: 0, y: 0, w, h }), at, until, 'fade');
    const art = svg('svg', { class: 'ss-art', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, node);
    const half = w / 2;
    const top = 44;
    const bottom = h - 34;
    // The manager's pyramid: point up.
    const left = svg('g', { class: 'ss-pyramid ss-pyramid--command' }, art);
    svg('path', { class: 'ss-pyramid-shape', d: `M${half / 2} ${top} L${half - 16} ${bottom} H16 Z` }, left);
    svg('path', { class: 'ss-pyramid-arrow', d: `M${half / 2} ${top + 30} V${bottom - 34} M${half / 2 - 7} ${bottom - 42} L${half / 2} ${bottom - 34} L${half / 2 + 7} ${bottom - 42}` }, left);
    // The servant-leader's pyramid: point down.
    const right = svg('g', { class: 'ss-pyramid ss-pyramid--serve is-staged' }, art);
    svg('path', { class: 'ss-pyramid-shape', d: `M${half + 16} ${top} H${w - 16} L${half + half / 2} ${bottom} Z` }, right);
    svg('path', { class: 'ss-pyramid-arrow', d: `M${half + half / 2} ${bottom - 30} V${top + 36} M${half + half / 2 - 7} ${top + 44} L${half + half / 2} ${top + 36} L${half + half / 2 + 7} ${top + 44}` }, right);
    fx.fadeIn(right, serveAt, 0.4);

    label(node, 'Project manager', { x: half / 2, y: top - 30, at, tone: 'warm' });
    label(node, 'directs', { x: half / 2, y: (top + bottom) / 2 - 10, at: at + 0.2 });
    label(node, 'the team', { x: half / 2, y: bottom + 6, at: at + 0.2 });
    const cross = place(el('span', 'ss-cross is-staged', node), half / 2 - 64, top - 4);
    cross.append(kit.icon('cross'));
    fx.slam(cross, crossAt, { from: 1.8 });
    label(node, 'Developers', { x: half + half / 2, y: top - 30, at: serveAt, tone: 'cream' });
    label(node, 'serves', { x: half + half / 2, y: (top + bottom) / 2 - 10, at: serveAt + 0.2, tone: 'teal' });
    label(node, 'Scrum Master', { x: half + half / 2, y: bottom + 6, at: serveAt + 0.2, tone: 'teal', icon: 'whistle' });
    return node;
  }

  // ------------------------------------------------------------------
  // The value navigator: a sea chart
  // ------------------------------------------------------------------

  /** An island's outline: a closed, slightly irregular blob of radius r round (cx, cy). */
  function blob(cx, cy, r, seed, squash = 0.78) {
    const points = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const k = 1 + 0.13 * Math.sin(3 * a + seed) + 0.07 * Math.sin(5 * a + seed * 2.3);
      points.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * squash]);
    }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    let d = `M${mid(points[15], points[0]).map((v) => v.toFixed(1)).join(' ')}`;
    points.forEach((p, i) => {
      const q = mid(p, points[(i + 1) % points.length]);
      d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
    });
    return `${d} Z`;
  }

  /**
   * A sea chart in a w×h panel that unrolls at `at`: parchment, a gridded
   * sea, the home coast, and a compass rose whose needle points to Value.
   * Returns the chart's moves: islands, course legs, the ship, crosses.
   */
  function chart(parent, { w, h, at, until }) {
    const id = `ss-chart-${uid++}`;
    const node = box(parent, 'ss-chart', { x: 0, y: 0, w, h });
    fx.fadeIn(node, at, 0.2);
    tween(node, [{ clipPath: 'inset(0 100% 0 0 round 8px)' }, { clipPath: 'inset(0 0% 0 0 round 8px)' }], at, reducedMotion.matches ? 0.01 : 0.7, EASE.out);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    const art = svg('svg', { class: 'ss-art', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, node);
    const defs = svg('defs', {}, art);
    const paper = svg('linearGradient', { id: `${id}-paper`, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    svg('stop', { offset: 0, class: 'ss-paper-0' }, paper);
    svg('stop', { offset: 1, class: 'ss-paper-1' }, paper);
    svg('rect', { x: 0, y: 0, width: w, height: h, rx: 8, fill: `url(#${id}-paper)` }, art);
    svg('rect', { class: 'ss-sea', x: 12, y: 12, width: w - 24, height: h - 24, rx: 3 }, art);
    const grid = [];
    for (let gx = 12 + (w - 24) / 6; gx < w - 13; gx += (w - 24) / 6) grid.push(`M${gx.toFixed(1)} 12V${h - 12}`);
    for (let gy = 12 + (h - 24) / 4; gy < h - 13; gy += (h - 24) / 4) grid.push(`M12 ${gy.toFixed(1)}H${w - 12}`);
    svg('path', { class: 'ss-grid', d: grid.join('') }, art);
    svg('rect', { class: 'ss-chart-frame', x: 6, y: 6, width: w - 12, height: h - 12, rx: 5 }, art);
    // The home coast, bottom left, where the users live and the ship sets out.
    svg('path', { class: 'ss-land', d: `M12 ${h * 0.5} C40 ${h * 0.52} 66 ${h * 0.62} 70 ${h * 0.74} C74 ${h * 0.86} 54 ${h - 22} 40 ${h - 12} H12 Z` }, art);
    svg('path', { class: 'ss-land-green', d: `M12 ${h * 0.56} C34 ${h * 0.58} 52 ${h * 0.66} 54 ${h * 0.76} C56 ${h * 0.86} 42 ${h - 26} 30 ${h - 16} H12 Z` }, art);
    const islands = svg('g', {}, art);
    const legs = svg('g', {}, art);
    const marks = svg('g', {}, art);

    // The compass rose, bottom right; its needle swings on cue.
    const rose = { x: w - 44, y: h - 46, r: 24 };
    const compass = svg('g', { class: 'ss-rose', transform: `translate(${rose.x} ${rose.y})` }, art);
    svg('circle', { class: 'ss-rose-ring', r: rose.r }, compass);
    const star = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const len = i % 2 ? rose.r * 0.55 : rose.r * 0.9;
      star.push(`${(Math.cos(a) * len).toFixed(1)},${(Math.sin(a) * len).toFixed(1)}`);
      const b = a + Math.PI / 8;
      star.push(`${(Math.cos(b) * rose.r * 0.22).toFixed(1)},${(Math.sin(b) * rose.r * 0.22).toFixed(1)}`);
    }
    svg('polygon', { class: 'ss-rose-star', points: star.join(' ') }, compass);
    const needle = svg('g', { class: 'ss-rose-needle' }, compass);
    svg('path', { class: 'ss-needle-north', d: `M0 ${-rose.r * 0.82} L4.2 0 H-4.2 Z` }, needle);
    svg('path', { class: 'ss-needle-south', d: `M0 ${rose.r * 0.82} L4.2 0 H-4.2 Z` }, needle);
    svg('circle', { class: 'ss-needle-pin', r: 2.4 }, needle);
    const needleKeys = [];
    onFrame((t) => {
      let angle = 128;
      for (const k of needleKeys) {
        if (t < k.at) break;
        const p = progress(t, k.at, reducedMotion.matches ? 0.01 : 1.1);
        // A damped swing that overshoots and settles, as a compass needle does.
        const settle = 1 - Math.cos(p * Math.PI * 2.5) * Math.exp(-4 * p) * (1 - p);
        angle += (k.to - angle) * Math.min(1, settle);
      }
      needle.setAttribute('transform', `rotate(${angle.toFixed(1)})`);
    });

    // The ship: hull, mast, and sails; it bobs gently and sails a course.
    const ship = svg('g', { class: 'ss-ship' }, art);
    const shipArt = svg('g', {}, ship);
    svg('path', { class: 'ss-ship-hull', d: 'M-14 2 H14 L9 9 H-9 Z' }, shipArt);
    svg('path', { class: 'ss-ship-mast', d: 'M0 2 V-17' }, shipArt);
    svg('path', { class: 'ss-ship-sail', d: 'M1 -16 L11 -2 H1 Z' }, shipArt);
    svg('path', { class: 'ss-ship-sail', d: 'M-1 -12 L-9 -2 H-1 Z' }, shipArt);
    let shipCourse = [];
    let shipStart = [0, 0];
    onFrame((t) => {
      let [x, y] = shipStart;
      for (const leg of shipCourse) {
        if (t < leg.at) break;
        const p = easeInOutCubic(progress(t, leg.at, reducedMotion.matches ? 0.01 : leg.duration));
        x += (leg.to[0] - x) * p;
        y += (leg.to[1] - y) * p;
      }
      const bob = reducedMotion.matches ? 0 : Math.sin(t * 2.4) * 1.2;
      ship.setAttribute('transform', `translate(${x.toFixed(1)} ${(y + bob).toFixed(1)})`);
    });

    return {
      node, art, w, h, rose,
      label(text, options) { return label(node, text, options); },
      /** Swings the needle to `angle` degrees (0 = up) at `at`. */
      needle(needleAt, angle) {
        needleKeys.push({ at: needleAt, to: angle });
        needleKeys.sort((a, b) => a.at - b.at);
      },
      /** A compass card word under the rose. */
      roseWord(text, wordAt) {
        return label(node, text, { x: rose.x, y: rose.y - rose.r - 22, at: wordAt, tone: 'navy' });
      },
      /** An island at (x, y): sand and grass, with a flag when `flag`. */
      island(x, y, r, { at: islandAt, until: islandUntil, seed = 1, flag = false, fog = false }) {
        const g = svg('g', { class: `ss-island${fog ? ' ss-island--fog' : ''} is-staged` }, islands);
        if (fog) svg('ellipse', { class: 'ss-fog', cx: x, cy: y, rx: r * 1.9, ry: r * 1.45 }, g);
        svg('path', { class: 'ss-island-sand', d: blob(x, y, r, seed) }, g);
        svg('path', { class: 'ss-island-grass', d: blob(x - r * 0.08, y - r * 0.08, r * 0.62, seed + 1.7) }, g);
        if (flag) {
          svg('path', { class: 'ss-flag-pole', d: `M${x} ${y - 2} V${y - r - 12}` }, g);
          svg('path', { class: 'ss-flag-cloth', d: `M${x} ${y - r - 12} L${x + 12} ${y - r - 8} L${x} ${y - r - 4} Z` }, g);
        }
        show(g, islandAt, islandUntil, 'fade');
        return g;
      },
      /** The ship's starting place, and a course it sails: legs = [{ to, at, duration }]. */
      ship(start, shownAt, course = []) {
        shipStart = start;
        shipCourse = course.slice().sort((a, b) => a.at - b.at);
        fx.fadeIn(ship, shownAt, 0.3);
        ship.classList.add('is-staged');
      },
      /** A course leg that draws itself: a dashed line, burgundy unless `tone`. */
      leg(from, to, legAt, { duration = 0.35, until: legUntil, tone = 'course' } = {}) {
        return drawnLine(legs, from, to, { at: legAt, duration, until: legUntil, className: `ss-leg ss-leg--${tone}`, head: false });
      },
      /** A solid line between two places, such as a direct conversation. */
      link(from, to, linkAt, linkUntil) {
        return drawnLine(legs, from, to, { at: linkAt, duration: 0.4, until: linkUntil, className: 'ss-link', head: false });
      },
      /** A numbered waypoint badge at (x, y). */
      number(n, x, y, numberAt) {
        const badge = place(el('span', 'ss-waypoint is-staged', node, String(n)), x - 10, y - 10);
        return show(badge, numberAt, until, 'pop');
      },
      /** A red cross at (x, y), shown from crossAt (until crossUntil). */
      cross(x, y, crossAt, crossUntil) {
        const mark = place(el('span', 'ss-cross is-staged', node), x - 15, y - 15);
        mark.append(kit.icon('cross'));
        fx.slam(mark, crossAt, { from: 1.8 });
        if (crossUntil !== undefined) fx.fadeOut(mark, crossUntil, 0.3);
        return mark;
      },
      /** A user on the chart: a round chip with the user icon. */
      user(x, y, userAt) {
        const g = svg('g', { class: 'ss-user is-staged', transform: `translate(${x} ${y})` }, marks);
        svg('circle', { class: 'ss-user-disc', r: 11 }, g);
        const glyph = kit.icon('user');
        glyph.setAttribute('x', -7);
        glyph.setAttribute('y', -7);
        glyph.setAttribute('width', 14);
        glyph.setAttribute('height', 14);
        g.append(glyph);
        return show(g, userAt, until, 'fade');
      },
    };
  }

  // ------------------------------------------------------------------
  // The builders: a building site
  // ------------------------------------------------------------------

  /**
   * The Developers' site in a w×h panel: blueprint paper over the ground.
   * block() stacks the Increment on its foundation; toolbox(), board(), and
   * seal() add the team's skills, its own task board, and the Definition
   * of Done.
   */
  function site(parent, { w, h, at, until }) {
    const node = show(box(parent, 'ss-site', { x: 0, y: 0, w, h }), at, until, 'fade');
    const ground = h - 14;
    const art = svg('svg', { class: 'ss-art', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, node);
    svg('rect', { class: 'ss-ground', x: 0, y: ground, width: w, height: h - ground }, art);
    const foundation = { x: 34, w: 150 };
    svg('rect', { class: 'ss-foundation', x: foundation.x, y: ground - 8, width: foundation.w, height: 8, rx: 2 }, art);
    let blocks = 0;
    const blockH = 26;
    return {
      node, w, h, ground,
      label(text, options) { return label(node, text, options); },
      /** A block of the Increment (`skill` names its colour), dropped onto the stack at `at`. */
      block(text, icon, blockAt, skill) {
        const b = place(el('div', `ss-block ss-block--${skill} is-staged`, node), foundation.x + 6, ground - 8 - (blocks + 1) * (blockH + 2));
        b.style.width = `${foundation.w - 12}px`;
        b.style.height = `${blockH}px`;
        b.append(kit.icon(icon), document.createTextNode(text));
        tween(b, [{ opacity: 0, translate: '0 -70px' }, { opacity: 1, translate: '0 0' }], blockAt, reducedMotion.matches ? 0.01 : 0.4, EASE.in);
        blocks += 1;
        return b;
      },
      /** The top of the stack, for a seal or a label above it. */
      stackTop() {
        return { x: foundation.x + foundation.w / 2, y: ground - 8 - blocks * (blockH + 2) };
      },
      /** The team's toolbox: one box holding every skill. */
      toolbox({ x, y, at: toolAt, until: toolUntil }) {
        const tb = show(box(node, 'ss-toolbox', { x, y }), toolAt, toolUntil, 'pop');
        const lid = el('div', 'ss-toolbox-tools', tb);
        for (const [icon, name] of [['pencil', 'design'], ['code', 'code'], ['search', 'test']]) {
          const tool = el('span', 'ss-tool', lid);
          tool.append(kit.icon(icon));
          el('span', 'ss-tool-name', tool, name);
        }
        el('div', 'ss-toolbox-body', tb);
        return tb;
      },
      /**
       * The team's own task board: rows of tasks; assign(i, tone, at) puts a
       * Developer's token on a task they chose; swap(i, j, at) re-plans.
       */
      board({ x, y, w: boardW, title, tasks, at: boardAt, until: boardUntil }) {
        const card = show(box(node, 'ss-taskboard', { x, y, w: boardW }), boardAt, boardUntil, 'pop');
        const head = el('div', 'ss-taskboard-title', card, title);
        const rowH = 24;
        const rows = tasks.map((text, i) => {
          const row = place(el('div', 'ss-task', card), 8, 28 + i * (rowH + 4));
          row.style.width = `${boardW - 16}px`;
          row.style.height = `${rowH}px`;
          el('span', 'ss-task-text', row, text);
          return row;
        });
        card.style.height = `${32 + tasks.length * (rowH + 4)}px`;
        return {
          card,
          retitle(text, retitleAt) {
            tween(head, [{ opacity: 1 }, { opacity: 0 }], retitleAt - 0.2, 0.2);
            const next = el('div', 'ss-taskboard-title ss-taskboard-title--next is-staged', card, text);
            fx.fadeIn(next, retitleAt, 0.25);
          },
          assign(i, tone, assignAt) {
            const chip = el('span', `ss-assignee ss-token--${tone} is-staged`, rows[i]);
            chip.append(kit.icon('user'));
            tween(chip, [{ opacity: 0, translate: '40px 0' }, { opacity: 1, translate: '0 0' }], assignAt, reducedMotion.matches ? 0.01 : 0.35, EASE.out);
          },
          swap(i, j, swapAt) {
            const d = (j - i) * (rowH + 4);
            fx.moveTo(rows[i], swapAt, 0, d, reducedMotion.matches ? 0.01 : 0.5);
            fx.moveTo(rows[j], swapAt, 0, -d, reducedMotion.matches ? 0.01 : 0.5);
          },
        };
      },
      /** The Definition of Done seal, stamped onto the stack's top at `at`. */
      seal(text, sealAt) {
        const { x, y } = this.stackTop();
        const s = place(el('div', 'ss-seal is-staged', node), x - 70, y - 30);
        s.append(kit.icon('check'), document.createTextNode(text));
        fx.slam(s, sealAt, { from: 1.6, rotate: -4 });
        return s;
      },
    };
  }

  // ------------------------------------------------------------------
  // Empiricism on its three pillars
  // ------------------------------------------------------------------

  const PILLARS = [
    { name: 'Transparency', text: 'the work is on the wall', icon: 'list' },
    { name: 'Inspection', text: 'check often, catch it small', icon: 'search' },
    { name: 'Adaptation', text: 'off course? Adjust now', icon: 'resend' },
  ];

  /**
   * A temple: the pediment reads Empiricism, the architrave its meaning,
   * and three columns carry the pillars' plates, each lit at times[i]; the
   * ribbon under the steps reads "Sprint after Sprint".
   */
  function temple(layer, { x, y, w, at, until, times, ribbonAt }) {
    const h = 186;
    const node = show(box(layer, 'ss-temple', { x, y, w, h }), at, until, 'fade');
    const art = svg('svg', { class: 'ss-art', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, node);
    const ped = 44;
    svg('path', { class: 'ss-pediment', d: `M14 ${ped} L${w / 2} 4 L${w - 14} ${ped} Z` }, art);
    svg('path', { class: 'ss-pediment-inner', d: `M40 ${ped - 6} L${w / 2} 14 L${w - 40} ${ped - 6} Z` }, art);
    svg('rect', { class: 'ss-architrave', x: 20, y: ped + 2, width: w - 40, height: 22, rx: 2 }, art);
    const shaftTop = ped + 34;
    const steps = h - 34;
    svg('rect', { class: 'ss-stylobate', x: 10, y: steps, width: w - 20, height: 7, rx: 2 }, art);
    svg('rect', { class: 'ss-stylobate ss-stylobate--low', x: 2, y: steps + 7, width: w - 4, height: 6, rx: 2 }, art);
    const centres = [w / 6, w / 2, (5 * w) / 6];
    const columns = centres.map((cx) => {
      const g = svg('g', { class: 'ss-column' }, art);
      svg('rect', { class: 'ss-capital', x: cx - 40, y: shaftTop - 8, width: 80, height: 8, rx: 2 }, g);
      svg('rect', { class: 'ss-shaft', x: cx - 26, y: shaftTop, width: 52, height: steps - shaftTop - 8 }, g);
      const flutes = [];
      for (let f = -18; f <= 18; f += 9) flutes.push(`M${cx + f} ${shaftTop + 2}V${steps - 10}`);
      svg('path', { class: 'ss-flutes', d: flutes.join('') }, g);
      svg('rect', { class: 'ss-plinth', x: cx - 36, y: steps - 8, width: 72, height: 8, rx: 2 }, g);
      return g;
    });
    const title = el('div', 'ss-temple-title', node, 'Empiricism');
    title.style.top = `${ped - 30}px`;
    const meaning = el('div', 'ss-temple-meaning', node, 'decide from what you observe');
    meaning.style.top = `${ped + 3}px`;
    const plates = PILLARS.map((pillar, i) => {
      const plate = box(node, 'ss-plate', { x: centres[i] - 78, y: shaftTop + 10, w: 156 });
      const head = el('div', 'ss-plate-name', plate);
      head.append(kit.icon(pillar.icon), document.createTextNode(pillar.name));
      el('div', 'ss-plate-text', plate, pillar.text);
      show(plate, times[i], undefined, 'pop');
      const glow = el('span', 'ss-lit is-staged', plate);
      fx.fadeIn(glow, times[i], 0.25);
      fx.fadeOut(glow, times[i] + 1.8, 0.4);
      columns[i].classList.add('ss-column--' + i);
      return plate;
    });
    const ribbon = box(node, 'ss-ribbon', { x: w / 2 - 190, y: h - 20, w: 380 });
    ribbon.textContent = '↻ Sprint after Sprint: inspect and adapt';
    show(ribbon, ribbonAt, undefined, 'rise');
    return {
      node, plates,
      glowAll(glowAt, glowUntil) {
        plates.forEach((plate) => {
          const glow = el('span', 'ss-lit is-staged', plate);
          fx.fadeIn(glow, glowAt, 0.3);
          if (glowUntil !== undefined) fx.fadeOut(glow, glowUntil, 0.3);
        });
      },
    };
  }

  // ------------------------------------------------------------------
  // The three accountabilities side by side
  // ------------------------------------------------------------------

  /** Three role cards: emblem, name, metaphor, and a few key duties each. */
  function roleCards(layer, { x, y, w, at, until, cards, every = 0.25 }) {
    const node = box(layer, 'ss-cards', { x, y, w });
    show(node, at, until, 'fade');
    cards.forEach((card, i) => {
      const c = el('div', `ss-card ss-card--${card.role} is-staged`, node);
      const head = el('div', 'ss-card-head', c);
      el('span', 'ss-emblem', head).append(kit.icon(ROLE_ICON[card.role]));
      const names = el('div', 'ss-card-names', head);
      el('div', 'ss-card-title', names, card.title);
      el('div', 'ss-card-metaphor', names, card.metaphor);
      const list = el('ul', 'ss-card-list', c);
      for (const item of card.items) el('li', '', list, item);
      fx.rise(c, at + i * every, { distance: 16, duration: 0.4 });
    });
    return node;
  }

  window.ScrumScenes = { slide, accountabilities, court, leadership, chart, site, temple, roleCards, label };
})();
