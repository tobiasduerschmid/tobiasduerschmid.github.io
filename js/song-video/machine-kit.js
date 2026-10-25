/*
 * The pictures of "It Works on My Machine" (js/song-video/songs/
 * it_works_on_my_machine.js): stage props for each disaster, painted like
 * an opera's scenery in the same ink and light as the cast. A giant phone
 * running the coffee app; a sprint calendar that loses its pages; a toy
 * ship; the audience in the stalls; cards and code cards; package boxes;
 * the Teammate's laptop and his tally of tiny fixes; a commit graph; a
 * module as a little building with doors; keys, burglars, servers, a bill,
 * and a rocket. Each builder schedules its own motion on the Timeline, so
 * the choreography reads as "what appears when".
 *
 * Coordinates are CSS pixels on the 960×540 stage; times are song seconds.
 * Text on stage is at least 12 px on its own card, so it keeps 4.5:1.
 * Styles: css/song-video-machine-kit.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, clamp, progress, easeInOutCubic, hash01 } = window.Timeline;
  const radians = (a) => a * Math.PI / 180;
  const { el, svg, place, icon, highlightPython, writeCode } = window.SongKit;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let uid = 0;

  /** A positioned box that pops in at `at` and out at `until`. */
  function popped(node, at, until, { rotate = 0, from = 0.5 } = {}) {
    fx.pop(node, at, { rotate, from });
    if (until !== undefined) fx.popOut(node, until - 0.25);
    return node;
  }

  /** An absolutely placed SVG of `w`×`h` stage pixels with a matching viewBox. */
  function art(parent, cls, x, y, w, h) {
    const node = svg('svg', { class: `mk-art ${cls}`, viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, parent);
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    return node;
  }

  /** A part with its ink under its fill, so overlapping parts keep one outline. */
  function inked(parent, d, cls, inkCls = 'mk-ink') {
    svg('path', { class: inkCls, d }, parent);
    return svg('path', { class: cls, d }, parent);
  }

  /** A coffee cup to go: sleeve, lid, steam. Drawn about its base centre, `s` tall. */
  function cup(parent, x, y, s = 24, { lid = true, steam = true } = {}) {
    const g = svg('g', { class: 'mk-cup', transform: `translate(${x} ${y}) scale(${(s / 24).toFixed(3)})` }, parent);
    inked(g, 'M-8 -18 H8 L6 0 H-6 Z', 'mk-cup-body');
    svg('path', { class: 'mk-cup-sleeve', d: 'M-7.3 -12 H7.3 L6.7 -6 H-6.7 Z' }, g);
    if (lid) inked(g, 'M-9.4 -18 H9.4 V-21 C9.4 -22 8.4 -23 7 -23 H-7 C-8.4 -23 -9.4 -22 -9.4 -21 Z', 'mk-cup-lid');
    if (steam) svg('path', { class: 'mk-steam', d: 'M-3 -26 C-5 -29 -1 -31 -3 -34 M3 -26 C1 -29 5 -31 3 -34' }, g);
    return g;
  }

  /** A latte in a glass cup with a heart in its foam. */
  function latte(parent, x, y, s = 30) {
    const g = svg('g', { class: 'mk-latte', transform: `translate(${x} ${y}) scale(${(s / 30).toFixed(3)})` }, parent);
    inked(g, 'M-12 -20 H12 C12 -4 8 0 0 0 C-8 0 -12 -4 -12 -20 Z', 'mk-latte-glass');
    svg('ellipse', { class: 'mk-latte-foam', cx: 0, cy: -20, rx: 12, ry: 3.4 }, g);
    svg('path', { class: 'mk-latte-heart', d: 'M0 -18.4 C-3 -20.4 -4 -22.6 -2 -23 C-1 -23.2 0 -22.6 0 -21.8 C0 -22.6 1 -23.2 2 -23 C4 -22.6 3 -20.4 0 -18.4 Z' }, g);
    svg('path', { class: 'mk-latte-handle', d: 'M12 -16 C18 -16 18 -7 10 -6' }, g);
    return g;
  }

  // ------------------------------------------------------------------
  // Light: a follow spot that tracks a singer
  // ------------------------------------------------------------------

  /**
   * A follow spot on a figure (OperaCast.figure) from `from` to `to`: a
   * soft cone from above and a pool on the floor under its feet. It never
   * brightens anything quickly; it fades.
   */
  function spot(parent, figureOf, { from, to, warm = true }) {
    const node = el('div', 'mk-spot is-staged', parent);
    const g = art(node, 'mk-spot-art', 0, 0, 960, 540);
    const id = `mk-spot-${++uid}`;
    const defs = svg('defs', {}, g);
    const cone = svg('linearGradient', { id: `${id}-cone`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg('stop', { offset: 0, class: `mk-spot-stop-0${warm ? '' : ' mk-spot-stop--cool'}` }, cone);
    svg('stop', { offset: 1, class: `mk-spot-stop-1${warm ? '' : ' mk-spot-stop--cool'}` }, cone);
    const pool = svg('radialGradient', { id: `${id}-pool` }, defs);
    svg('stop', { offset: 0, class: 'mk-pool-stop-0' }, pool);
    svg('stop', { offset: 1, class: 'mk-pool-stop-1' }, pool);
    const beam = svg('path', { class: 'mk-spot-beam', fill: `url(#${id}-cone)` }, g);
    const floor = svg('ellipse', { class: 'mk-spot-pool', fill: `url(#${id}-pool)`, rx: 96, ry: 15 }, g);
    fx.fadeIn(node, from, 0.6);
    if (to !== undefined) fx.fadeOut(node, to - 0.6, 0.6);
    onFrame((t) => {
      if (t < from - 0.1 || (to !== undefined && t > to + 0.1)) return;
      const figure = figureOf();
      if (!figure) return;
      const { x, y, scale } = figure.where(t);
      const half = 70 * scale;
      beam.setAttribute('d', `M${(x - 18).toFixed(1)} 44 L${(x + 18).toFixed(1)} 44 L${(x + half + 26).toFixed(1)} ${y.toFixed(1)} L${(x - half - 26).toFixed(1)} ${y.toFixed(1)} Z`);
      floor.setAttribute('cx', x.toFixed(1));
      floor.setAttribute('cy', (y - 4).toFixed(1));
      floor.setAttribute('rx', (96 * scale).toFixed(1));
    });
    return node;
  }

  // ------------------------------------------------------------------
  // Cards and code
  // ------------------------------------------------------------------

  /**
   * A card: an optional icon and title in a coloured head, then lines of
   * text. `tone`: 'paper', 'gold', 'red', 'green', 'blue', 'dark'.
   */
  function card(parent, { x, y, w, title, iconName, lines = [], tone = 'paper', at, until, rotate = -2, cls = '' }) {
    const node = place(el('div', `mk-card mk-card--${tone} ${cls} is-staged`, parent), x, y);
    if (w) node.style.width = `${w}px`;
    if (title) {
      const head = el('div', 'mk-card-head', node);
      if (iconName) head.append(icon(iconName));
      head.append(document.createTextNode(title));
    }
    const body = lines.length ? el('div', 'mk-card-body', node) : null;
    const rows = lines.map((text) => el('div', 'mk-card-line', body, text));
    popped(node, at, until, { rotate });
    return { node, rows };
  }

  /**
   * A code card: Python in the shared syntax colours, a title tab, and
   * per-line changes: [time, index, text, state] rewrites line `index`
   * (state: 'new', 'gone', 'mark-red', 'mark-green').
   */
  function code(parent, { x, y, w, title, lines, at, until, changes = [] }) {
    const node = place(el('div', 'mk-code is-staged', parent), x, y);
    if (w) node.style.width = `${w}px`;
    if (title) el('div', 'mk-code-title', node, title);
    const body = el('div', 'mk-code-body', node);
    const rows = lines.map((text) => {
      const row = el('div', 'mk-code-line', body);
      writeCode(row, highlightPython(text));
      return row;
    });
    const sorted = [...changes].sort((a, b) => a[0] - b[0]);
    if (sorted.length) {
      const original = lines.slice();
      let drawn = '';
      onFrame((t) => {
        const state = original.map((text) => ({ text, cls: '' }));
        for (const [when, index, text, cls = ''] of sorted) {
          if (when > t) break;
          if (text !== null) state[index].text = text;
          state[index].cls = cls;
        }
        const key = state.map((s) => `${s.text}|${s.cls}`).join('\n');
        if (key === drawn) return;
        drawn = key;
        state.forEach((s, i) => {
          rows[i].replaceChildren();
          writeCode(rows[i], highlightPython(s.text));
          rows[i].className = `mk-code-line${s.cls ? ` mk-code-line--${s.cls}` : ''}`;
        });
      });
      for (const [when] of sorted) fx.bump(node, when, 0.03);
    }
    popped(node, at, until, { rotate: 0, from: 0.7 });
    return { node, rows };
  }

  // ------------------------------------------------------------------
  // The intro: a sprint calendar, a toy ship
  // ------------------------------------------------------------------

  /**
   * A wall calendar for the sprint: its red head, and a big count of days
   * left. From `tearAt` its pages tear off one a step and flutter away
   * until none are left, then it reads "ship today".
   */
  function calendar(parent, { x, y, at, until, days = 14, tearAt, tearUntil }) {
    const node = place(el('div', 'mk-calendar is-staged', parent), x, y);
    const g = art(node, 'mk-calendar-art', 0, 0, 120, 132);
    inked(g, 'M4 12 H116 V128 H4 Z', 'mk-calendar-back');
    inked(g, 'M4 12 H116 V40 H4 Z', 'mk-calendar-head');
    for (let i = 0; i < 6; i++) svg('path', { class: 'mk-ring', d: `M${16 + i * 18} 6 V18` }, g);
    const head = svg('text', { class: 'mk-calendar-title', x: 60, y: 32, 'text-anchor': 'middle' }, g);
    head.textContent = 'SPRINT';
    const pageG = svg('g', {}, g);
    svg('path', { class: 'mk-calendar-page', d: 'M8 42 H112 V124 H8 Z' }, pageG);
    const count = svg('text', { class: 'mk-calendar-count', x: 60, y: 96, 'text-anchor': 'middle' }, pageG);
    const unit = svg('text', { class: 'mk-calendar-unit', x: 60, y: 116, 'text-anchor': 'middle' }, pageG);
    // Pages that fly off: a few kept and reused, each posed from song time.
    const flyers = Array.from({ length: 4 }, () => {
      const f = svg('g', { class: 'mk-flyer', opacity: 0 }, g);
      svg('path', { class: 'mk-calendar-page mk-calendar-page--torn', d: 'M8 42 H112 V124 H8 Z' }, f);
      const n = svg('text', { class: 'mk-calendar-count', x: 60, y: 96, 'text-anchor': 'middle' }, f);
      return { f, n };
    });
    const step = (tearUntil - tearAt) / days;
    onFrame((t) => {
      const torn = clamp(Math.floor((t - tearAt) / step) + 1, 0, days);
      const left = days - (t < tearAt ? 0 : torn);
      count.textContent = left ? String(left) : 'Ship';
      unit.textContent = left ? 'days left' : 'today!';
      count.setAttribute('class', `mk-calendar-count${left ? '' : ' mk-calendar-count--done'}`);
      flyers.forEach(({ f, n }, k) => {
        const page = torn - 1 - k;
        const age = t - (tearAt + page * step);
        if (page < 0 || age < 0 || age > 0.9 || reducedMotion.matches) {
          f.setAttribute('opacity', '0');
          return;
        }
        const side = hash01(page * 31) > 0.5 ? 1 : -1;
        n.textContent = String(days - page);
        // A torn page shrinks as it flutters off, clear of the next count.
        f.setAttribute('opacity', Math.max(0, 1 - age / 0.6).toFixed(3));
        f.setAttribute('transform', `translate(${(side * 120 * age).toFixed(1)} ${(-40 * age + 180 * age * age).toFixed(1)}) rotate(${(side * 160 * age).toFixed(1)} 60 80) translate(60 80) scale(${(0.75 - 0.35 * age).toFixed(3)}) translate(-60 -80)`);
      });
    });
    popped(node, at, until, { rotate: -2 });
    return node;
  }

  /**
   * A toy galleon on wheels with a pennant, rolling in from the left wing
   * to x, or (from: 'above') flown in from the rafters on two wires, like
   * opera scenery, swinging as it lands.
   */
  function toyShip(parent, { x, y, at, until, rollAt, leaveAt, label, from = 'left' }) {
    const node = place(el('div', 'mk-ship is-staged', parent), x, y);
    const flown = from === 'above';
    let wires = null;
    if (flown) {
      wires = art(node, 'mk-ship-wires', 0, -620, 170, 720);
      svg('path', { class: 'mk-ship-wire', d: 'M24 0 V720 M146 0 V720' }, wires);
    }
    const g = art(node, 'mk-ship-art', 0, 0, 170, 150);
    const hull = svg('g', {}, g);
    svg('path', { class: 'mk-ink', d: 'M84 18 V104' }, hull);
    svg('path', { class: 'mk-mast', d: 'M84 18 V104' }, hull);
    inked(hull, 'M86 26 C116 34 126 54 124 80 L86 80 Z', 'mk-sail');
    inked(hull, 'M82 32 C58 40 50 58 52 80 L82 80 Z', 'mk-sail mk-sail--back');
    inked(hull, 'M20 100 H150 C146 116 136 124 120 124 H44 C30 124 22 116 20 100 Z', 'mk-hull');
    svg('path', { class: 'mk-hull-band', d: 'M24 108 H146' }, hull);
    for (const px of [48, 72, 96, 120]) svg('circle', { class: 'mk-porthole', cx: px, cy: 115, r: 3 }, hull);
    inked(hull, 'M84 18 L112 26 L84 34 Z', 'mk-pennant');
    const wheels = [44, 126].map((cx) => {
      const spin = svg('g', {}, svg('g', { transform: `translate(${cx} 132)` }, g));
      svg('circle', { class: 'mk-ink', r: 9 }, spin);
      svg('circle', { class: 'mk-wheel', r: 9 }, spin);
      svg('path', { class: 'mk-spoke', d: 'M-8 0 H8 M0 -8 V8' }, spin);
      return spin;
    });
    if (label) {
      const tag = el('div', 'mk-tag mk-tag--gold', node, label);
      tag.style.left = '96px';
      tag.style.top = '-6px';
    }
    fx.fadeIn(node, at, 0.2);
    const distance = flown ? y + 240 : x + 200;
    onFrame((t) => {
      const u = easeInOutCubic(progress(t, rollAt, 1.6));
      const d = -distance * (1 - u);
      const still = reducedMotion.matches;
      if (flown) {
        // It swings on its wires as it comes down, and settles.
        const swing = still ? 0 : 5 * Math.sin(t * 4) * (1 - u) ** 2;
        node.style.transform = `translateY(${d.toFixed(1)}px) rotate(${swing.toFixed(2)}deg)`;
        node.style.transformOrigin = '85px -620px';
      } else {
        node.style.transform = `translateX(${d.toFixed(1)}px)`;
        const turn = (d / 9) * 180 / Math.PI;
        for (const w of wheels) w.setAttribute('transform', `rotate(${turn.toFixed(1)})`);
      }
      // From `leaveAt` it rolls off to the left on its wheels, its wires
      // (if flown) let go.
      if (leaveAt !== undefined && t > leaveAt) {
        // Far enough that its label (which overhangs the hull) is off too.
        const away = -(x + 420) * progress(t, leaveAt, 1.5) ** 2;
        node.style.transform = `${node.style.transform} translateX(${away.toFixed(1)}px)`;
        const turn = (away / 9) * 180 / Math.PI;
        for (const w of wheels) w.setAttribute('transform', `rotate(${turn.toFixed(1)})`);
        if (wires) wires.style.opacity = (1 - progress(t, leaveAt, 0.3)).toFixed(3);
      } else if (wires) wires.style.opacity = '';
      const rock = still ? 0 : 2 * Math.sin(t * 5) * (u < 1 ? 1 : 0.3);
      hull.setAttribute('transform', `rotate(${(flown ? rock / 2 : rock).toFixed(2)} 85 120)`);
    });
    if (until !== undefined) fx.fadeOut(node, until - 0.3, 0.3);
    return node;
  }

  /**
   * The audience in the stalls along the bottom: heads and shoulders in
   * silhouette. From `askAt` some raise a hand holding a question mark;
   * they lower them at `downAt`.
   */
  function audience(parent, { at, until, askAt, downAt, signs = true }) {
    const node = el('div', 'mk-audience is-staged', parent);
    const g = art(node, 'mk-audience-art', 0, 0, 960, 540);
    const hands = [];
    for (let i = 0; i < 13; i++) {
      const x = 40 + i * 74 + (hash01(i) - 0.5) * 18;
      const y = 516 + hash01(i + 9) * 10;
      const person = svg('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, g);
      if (i % 3 === 1) {
        const hand = svg('g', { class: 'mk-asker' }, person);
        svg('path', { class: 'mk-asker-arm', d: 'M14 4 C16 -20 18 -46 20 -64' }, hand);
        svg('circle', { class: 'mk-asker-hand', cx: 20, cy: -66, r: 5.4 }, hand);
        if (signs) {
          const sign = svg('g', { transform: 'translate(20 -92)' }, hand);
          svg('rect', { class: 'mk-asker-sign', x: -13, y: -13, width: 26, height: 26, rx: 5 }, sign);
          const q = svg('text', { class: 'mk-asker-q', x: 0, y: 7, 'text-anchor': 'middle' }, sign);
          q.textContent = '?';
        } else {
          svg('path', { class: 'mk-asker-fingers', d: 'M15 -70 L13 -80 M19 -71 L19 -82 M23 -70 L25 -80 M26 -66 L31 -72' }, hand);
        }
        hands.push(hand);
      }
      svg('path', { class: 'mk-silhouette', d: 'M-26 30 C-26 8 -16 -2 0 -2 C16 -2 26 8 26 30 Z M0 -4 C-10 -4 -15 -12 -15 -21 C-15 -31 -8 -37 0 -37 C8 -37 15 -31 15 -21 C15 -12 10 -4 0 -4 Z' }, person);
    }
    fx.fadeIn(node, at, 0.4);
    onFrame((t) => {
      hands.forEach((hand, i) => {
        const up = easeInOutCubic(progress(t, askAt + i * 0.1, 0.35)) * (1 - easeInOutCubic(progress(t, downAt, 0.35)));
        hand.setAttribute('transform', `translate(0 ${(90 * (1 - up)).toFixed(1)})`);
        hand.setAttribute('opacity', up.toFixed(3));
      });
    });
    if (until !== undefined) fx.fadeOut(node, until - 0.4, 0.4);
    return node;
  }

  // ------------------------------------------------------------------
  // The coffee app on a giant phone
  // ------------------------------------------------------------------

  /**
   * A giant phone on a stand running an app called `label`, its screen
   * changing on cues: [time, state], state 'blank' | 'cup' | 'button' (one
   * big button reading `buttonText`) | 'latte' | a key of `lists` (a text
   * screen of a heading and rows). `shine` cues make it gleam; `hue` tints
   * its case. Returns the node and its screen.
   */
  function phone(parent, {
    x, y, scale = 1, at, until, screens = [], shineAt = [], hue = '', label = 'CoffeeGo', buttonText = 'ORDER',
    lists = { group: ['Group order', '20 × latte', 'for 10:00', 'Sent ✓'] },
  }) {
    const node = place(el('div', `mk-phone${hue ? ` mk-phone--${hue}` : ''} is-staged`, parent), x, y);
    node.style.transform = `scale(${scale})`;
    const g = art(node, 'mk-phone-art', 0, 0, 150, 270);
    inked(g, 'M40 238 H110 L118 264 H32 Z', 'mk-stand');
    inked(g, 'M14 4 H136 C144 4 148 10 148 18 V222 C148 230 144 236 136 236 H14 C6 236 2 230 2 222 V18 C2 10 6 4 14 4 Z', 'mk-phone-case');
    svg('path', { class: 'mk-phone-screen', d: 'M12 24 H138 V214 H12 Z' }, g);
    svg('path', { class: 'mk-phone-notch', d: 'M60 12 H90' }, g);
    // The app's bar and name.
    svg('path', { class: 'mk-app-bar', d: 'M12 24 H138 V50 H12 Z' }, g);
    const name = svg('text', { class: 'mk-app-name', x: 75, y: 42, 'text-anchor': 'middle' }, g);
    name.textContent = label;
    const states = {
      cup: svg('g', { opacity: 0 }, g),
      button: svg('g', { opacity: 0 }, g),
      ...Object.fromEntries(Object.keys(lists).map((key) => [key, svg('g', { opacity: 0 }, g)])),
    };
    cup(states.cup, 75, 150, 64);
    // One big round button and a latte.
    inked(states.button, 'M75 96 m-46 0 a46 46 0 1 0 92 0 a46 46 0 1 0 -92 0', 'mk-big-button');
    const order = svg('text', { class: 'mk-button-text', x: 75, y: 101, 'text-anchor': 'middle' }, states.button);
    order.textContent = buttonText;
    const latteG = svg('g', { opacity: 0 }, states.button);
    latte(latteG, 75, 196, 40);
    // Text screens (`lists`: a name and up to four rows): a heading, then
    // rows; a row ending in ✓ is good news, one starting with ✗ bad news.
    for (const [key, rows] of Object.entries(lists)) {
      const list = svg('g', {}, states[key]);
      svg('path', { class: 'mk-group-card', d: 'M22 62 H128 V200 H22 Z' }, list);
      rows.forEach((text, i) => {
        const tone = i === 0 ? ' mk-group-row--head' : text.endsWith('✓') ? ' mk-group-row--ok' : text.startsWith('✗') ? ' mk-group-row--no' : '';
        const row = svg('text', { class: `mk-group-row${tone}`, x: 75, y: 90 + i * 30, 'text-anchor': 'middle' }, list);
        row.textContent = text;
      });
    }
    const glare = svg('path', { class: 'mk-glare', d: 'M20 30 L60 30 L20 120 Z', opacity: 0 }, g);
    const sorted = [...screens].sort((a, b) => a[0] - b[0]);
    onFrame((t) => {
      let state = 'blank';
      let since = 0;
      for (const [when, s] of sorted) if (when <= t) { state = s; since = when; }
      const shown = state === 'latte' ? 'button' : state;
      for (const [key, layer] of Object.entries(states)) {
        const visible = key === shown;
        const fade = visible ? Math.min(1, (t - since) / 0.2) : 0;
        layer.setAttribute('opacity', (key === 'button' && visible && state === 'latte' ? 1 : fade).toFixed(3));
      }
      latteG.setAttribute('opacity', state === 'latte' ? Math.min(1, (t - since) / 0.2).toFixed(3) : '0');
      let gleam = 0;
      for (const when of shineAt) if (t >= when && t < when + 0.6) gleam = Math.sin(Math.PI * (t - when) / 0.6);
      glare.setAttribute('opacity', (0.5 * gleam).toFixed(3));
      glare.setAttribute('transform', `translate(${(gleam * 60).toFixed(1)} 0)`);
    });
    popped(node, at, until, { rotate: 0, from: 0.6 });
    return node;
  }

  /** A sparkle burst: four-point stars that pop and fade around (x, y). */
  function sparkle(parent, { x, y, at, count = 5, spread = 40, tone = 'gold' }) {
    const node = el('div', 'mk-sparkles', parent);
    node.setAttribute('aria-hidden', 'true');
    const g = art(node, 'mk-sparkle-art', x - spread - 12, y - spread - 12, (spread + 12) * 2, (spread + 12) * 2);
    const stars = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + hash01(i + at * 10) * 0.8;
      const r = spread * (0.5 + 0.5 * hash01(i * 7 + at));
      const s = svg('path', { class: `mk-star mk-star--${tone}`, d: 'M0 -7 L1.6 -1.6 L7 0 L1.6 1.6 L0 7 L-1.6 1.6 L-7 0 L-1.6 -1.6 Z', opacity: 0 }, g);
      return { s, cx: spread + 12 + Math.cos(a) * r, cy: spread + 12 + Math.sin(a) * r, delay: i * 0.05 };
    });
    onFrame((t) => {
      for (const { s, cx, cy, delay } of stars) {
        const age = t - at - delay;
        if (age < 0 || age > 0.8) { s.setAttribute('opacity', '0'); continue; }
        const k = Math.sin(Math.PI * age / 0.8);
        s.setAttribute('opacity', k.toFixed(3));
        s.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${(0.4 + 0.8 * k).toFixed(3)}) rotate(${(age * 90).toFixed(1)})`);
      }
    });
    return node;
  }

  // ------------------------------------------------------------------
  // Act I props: a desk, the requirements scroll, a torn-up meeting, the
  // APPLAUSE sign, a cricket, and the conference table
  // ------------------------------------------------------------------

  /**
   * An office desk seen from the front, `w` wide, its top at `top` and
   * its feet on the floor at `floor`: the top, a modesty panel with a
   * drawer, and two legs.
   */
  function desk(parent, { x, top, w = 240, floor = 452 }) {
    const h = floor - top;
    const g = art(parent, 'mk-desk', x, top, w, h);
    inked(g, `M6 10 H${w - 6} V${h} H${w - 18} V${h * 0.72} H18 V${h} H6 Z`, 'mk-desk-panel');
    inked(g, `M0 0 H${w} V12 H0 Z`, 'mk-desk-top');
    svg('path', { class: 'mk-desk-light', d: `M2 2 H${w - 2}` }, g);
    svg('path', { class: 'mk-desk-drawer', d: `M${w * 0.6} 18 H${w - 26} V${18 + h * 0.2} H${w * 0.6} Z M${w * 0.6 + (w * 0.4 - 26) / 2 - 8} ${22 + h * 0.08} h16` }, g);
    return g;
  }

  /**
   * A scroll of requirements unrolling from the flies to the floor at
   * `at`, and rolling back up at `rollAt` into its rod.
   */
  function scroll(parent, { x, y, at, rollAt, title, rows = 13 }) {
    const node = place(el('div', 'mk-scroll is-staged', parent), x, y);
    const g = art(node, 'mk-scroll-art', 0, 0, 170, 360);
    const clip = svg('clipPath', { id: `mk-scroll-${++uid}` }, svg('defs', {}, g));
    const window_ = svg('rect', { x: 0, y: 12, width: 170, height: 0 }, clip);
    const paper = svg('g', { 'clip-path': `url(#${clip.id})` }, g);
    inked(paper, 'M14 12 H156 V352 H14 Z', 'mk-scroll-paper');
    const head = svg('text', { class: 'mk-scroll-title', x: 85, y: 40, 'text-anchor': 'middle' }, paper);
    head.textContent = title;
    for (let i = 0; i < rows; i++) {
      const w = 90 + hash01(i * 3) * 40;
      svg('path', { class: 'mk-scroll-line', d: `M30 ${62 + i * 22} H${30 + w}` }, paper);
      svg('circle', { class: 'mk-scroll-bullet', cx: 24, cy: 62 + i * 22, r: 2 }, paper);
    }
    const bottom = svg('g', {}, g);
    inked(bottom, 'M6 -6 H164 V6 H6 Z', 'mk-scroll-rod');
    inked(g, 'M6 4 H164 V16 H6 Z', 'mk-scroll-rod');
    fx.fadeIn(node, at - 0.1, 0.15);
    onFrame((t) => {
      const down = easeInOutCubic(progress(t, at, 0.55)) * (1 - easeInOutCubic(progress(t, rollAt, 0.3)));
      const h = 340 * down;
      window_.setAttribute('height', h.toFixed(1));
      bottom.setAttribute('transform', `translate(0 ${(16 + h).toFixed(1)})`);
    });
    fx.fadeOut(node, rollAt + 0.3, 0.2);
    return node;
  }

  /** A card that pops in at `at` and is torn in two at `tearAt`, its halves tossed away. */
  function tornCard(parent, { x, y, w, at, tearAt, title, lines = [] }) {
    const halves = [0, 1].map((side) => {
      const half = place(el('div', 'mk-torn is-staged', parent), x, y);
      half.style.width = `${w}px`;
      const inner = el('div', 'mk-card mk-card--paper', half);
      const head = el('div', 'mk-card-head', inner);
      head.append(icon('calendar'), document.createTextNode(title));
      const body = el('div', 'mk-card-body', inner);
      for (const text of lines) el('div', 'mk-card-line', body, text);
      // Each half keeps its side of a jagged tear down the middle.
      const m = w / 2;
      const zig = Array.from({ length: 9 }, (_, i) => `${(m + (i % 2 ? 6 : -6)).toFixed(0)}px ${(i * 12.5).toFixed(1)}%`).join(', ');
      half.style.clipPath = side
        ? `polygon(${m + 6}px 0, 100% 0, 100% 100%, ${m}px 100%, ${zig.split(', ').reverse().join(', ')})`
        : `polygon(0 0, ${m + 6}px 0, ${zig}, ${m}px 100%, 0 100%)`;
      fx.pop(half, at, { rotate: -2 });
      // Tossed over his shoulders: the halves fly up and apart, out of the way.
      tween(half, { translate: `${side ? 50 : -50}px -90px`, rotate: `${side ? 28 : -24}deg`, opacity: 0 }, tearAt, 0.7, EASE.in);
      return half;
    });
    return halves;
  }

  /** A theatre's APPLAUSE sign: a lit box ringed with bulbs that glow from `at` until `dimAt`. */
  function applause(parent, { x, y, at, dimAt }) {
    const node = place(el('div', 'mk-applause is-staged', parent), x, y);
    const g = art(node, 'mk-applause-art', 0, 0, 240, 66);
    inked(g, 'M4 4 H236 V62 H4 Z', 'mk-applause-box');
    const bulbs = [];
    for (let i = 0; i < 12; i++) bulbs.push(svg('circle', { class: 'mk-applause-bulb', cx: 14 + i * 19.3, cy: 11, r: 3 }, g), svg('circle', { class: 'mk-applause-bulb', cx: 14 + i * 19.3, cy: 55, r: 3 }, g));
    const word = svg('text', { class: 'mk-applause-word', x: 120, y: 42, 'text-anchor': 'middle' }, g);
    word.textContent = 'APPLAUSE';
    fx.fadeIn(node, at - 0.3, 0.2);
    onFrame((t) => {
      const lit = progress(t, at, 0.25) * (1 - progress(t, dimAt, 0.5));
      node.style.setProperty('--mk-lit', lit.toFixed(3));
      word.setAttribute('class', `mk-applause-word${lit > 0.5 ? ' mk-applause-word--lit' : ''}`);
      // While lit, the bulbs chase round in pairs, and the sign flashes on.
      const still = reducedMotion.matches;
      const step = Math.floor((t - at) / 0.14);
      bulbs.forEach((bulb, i) => {
        const on = lit > 0.5 && (still || (Math.floor(i / 2) + step) % 3 !== 0);
        bulb.classList.toggle('mk-applause-bulb--on', on);
      });
      const flash = still ? 0 : Math.max(0, 1 - Math.abs(t - at - 0.12) / 0.18);
      node.style.transform = lit > 0 ? `scale(${(1 + 0.06 * flash).toFixed(3)})` : '';
    });
    return node;
  }

  /**
   * Thought bubbles rising from the audience in the stalls: each { x, y,
   * from, text } starts at `from`, an audience member's head, as a trail of
   * three growing dots, then a cloud whose bottom centre is (x, y). One
   * thinker every `every` seconds from `at`.
   */
  function thoughts(parent, { at, until, every = 0.5, bubbles }) {
    return bubbles.map(({ x, y, from, text }, i) => {
      const start = at + i * every;
      const dots = [0.12, 0.45, 0.78].map((k, d) => {
        const dot = place(el('div', `mk-thought-dot mk-thought-dot--${d}`, parent), from[0] + (x - from[0]) * k, from[1] + (y - from[1]) * k);
        popped(dot, start + d * 0.12, until, { rotate: 0 });
        return dot;
      });
      // A zero-height anchor at the cloud's bottom centre, so it pops from there.
      const node = place(el('div', 'mk-thought is-staged', parent), x, y);
      el('div', 'mk-thought-text', node, text);
      popped(node, start + 0.36, until, { rotate: 0 });
      return { node, dots };
    });
  }

  /** A cricket on the stage's edge, chirping (lines fan from it) on `chirps`. */
  function cricket(parent, { x, y, at, chirps = [] }) {
    const node = place(el('div', 'mk-cricket is-staged', parent), x, y);
    const g = art(node, 'mk-cricket-art', 0, 0, 70, 44);
    svg('path', { class: 'mk-cricket-leg', d: 'M22 30 L14 40 M30 31 L28 41 M44 30 L56 22 L64 40' }, g);
    inked(g, 'M14 26 C14 18 26 14 40 16 C50 17 56 22 54 28 C52 33 40 34 28 33 C18 32 14 30 14 26 Z', 'mk-cricket-body');
    svg('circle', { class: 'mk-cricket-eye', cx: 18, cy: 23, r: 1.6 }, g);
    svg('path', { class: 'mk-cricket-antenna', d: 'M15 21 C8 12 4 8 0 6 M17 20 C14 10 12 4 10 0' }, g);
    const lines = svg('path', { class: 'mk-chirp', d: 'M6 32 L-2 36 M6 26 L-4 26 M6 20 L-2 16', opacity: 0 }, g);
    fx.fadeIn(node, at, 0.3);
    onFrame((t) => {
      let k = 0;
      for (const c of chirps) if (t >= c && t < c + 0.35) k = 1 - (t - c) / 0.35;
      lines.setAttribute('opacity', k.toFixed(3));
    });
    return node;
  }

  /**
   * The conference table: twenty empty cups (dashed, to fill) appear in a
   * quick run from `cupsAt`; at `oneAt` a single coffee slides out to the
   * middle of the table; at `strawsAt` twenty straws go into it at once.
   */
  function table(parent, { x, y, w, at, cupsAt, cupsEvery, oneAt, strawsAt }) {
    const node = place(el('div', 'mk-table is-staged', parent), x, y);
    const g = art(node, 'mk-table-art', 0, -40, w, 110);
    const top = 64;
    const cups = [];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 10; i++) {
        const cx = 22 + i * ((w - 44) / 9) + (row ? 10 : 0);
        const cy = top - 2 - row * 20 + (row ? 0 : 0);
        const c = svg('g', { opacity: 0 }, g);
        svg('path', { class: 'mk-empty-cup', d: `M${cx - 6} ${cy - 15} H${cx + 6} L${cx + 4.6} ${cy} H${cx - 4.6} Z` }, c);
        cups.push({ c, k: row * 10 + i });
      }
    }
    inked(g, `M0 ${top} H${w} V${top + 12} H0 Z`, 'mk-table-top');
    inked(g, `M18 ${top + 12} H34 V110 H18 Z M${w - 34} ${top + 12} H${w - 18} V110 H${w - 34} Z`, 'mk-table-leg');
    svg('path', { class: 'mk-table-light', d: `M2 ${top + 2} H${w - 2}` }, g);
    // The one real coffee, sliding to the middle, and its twenty straws.
    const one = svg('g', { opacity: 0 }, g);
    const straws = svg('g', { opacity: 0 }, one);
    for (let i = 0; i < 20; i++) {
      const a = -70 + i * 7.4;
      const r = radians(a);
      svg('path', { class: `mk-straw mk-straw--${i % 3}`, d: `M0 -20 L${(Math.cos(r) * 46).toFixed(1)} ${(-20 + Math.sin(r) * 46).toFixed(1)}` }, straws);
    }
    cup(one, 0, 0, 32, { steam: false });
    fx.fadeIn(node, at, 0.3);
    onFrame((t) => {
      for (const { c, k } of cups) c.setAttribute('opacity', (t >= cupsAt + k * cupsEvery ? 1 : 0).toString());
      const slide = easeInOutCubic(progress(t, oneAt, 0.6));
      one.setAttribute('opacity', t >= oneAt ? '1' : '0');
      one.setAttribute('transform', `translate(${(w / 2 + 60 * (1 - slide)).toFixed(1)} ${(top - 2 - 100 * (1 - slide) * (1 - slide)).toFixed(1)})`);
      const s = clamp((t - strawsAt) / 0.25, 0, 1);
      straws.setAttribute('opacity', s.toFixed(3));
      straws.setAttribute('transform', `scale(1 ${(0.3 + 0.7 * s).toFixed(3)})`);
    });
    return node;
  }

  // ------------------------------------------------------------------
  // Act II props: packages on a shelf, a lockfile, versions marching in,
  // the clean build, a plug that does not fit, a box for overnight mail
  // ------------------------------------------------------------------

  /** A cardboard package box with a label and a version tag, drawn at (0, 0) top-left, 74×58. */
  function packageArt(g, { name, version, tone = '' }) {
    inked(g, 'M2 10 H72 V56 H2 Z', `mk-box${tone ? ` mk-box--${tone}` : ''}`);
    inked(g, 'M2 10 L12 2 H82 L72 10 Z', 'mk-box-top');
    inked(g, 'M72 10 L82 2 V48 L72 56 Z', 'mk-box-side');
    svg('path', { class: 'mk-box-tape', d: 'M30 10 V56 M44 10 V56' }, g);
    svg('rect', { class: 'mk-box-label', x: 8, y: 22, width: 58, height: 26, rx: 3 }, g);
    const label = svg('text', { class: 'mk-box-name', x: 37, y: 33, 'text-anchor': 'middle' }, g);
    label.textContent = name;
    if (version) {
      const v = svg('text', { class: 'mk-box-version', x: 37, y: 45, 'text-anchor': 'middle' }, g);
      v.textContent = version;
    }
    return g;
  }

  /** A package box at (x, y) that pops in, optionally moving along `path` [[time, x, y, duration]]. */
  function packageBox(parent, { x, y, at, until, name, version, tone, path = [] }) {
    const node = place(el('div', 'mk-package is-staged', parent), x, y);
    packageArt(art(node, 'mk-package-art', 0, 0, 86, 60), { name, version, tone });
    popped(node, at, until, { rotate: 0 });
    let [px, py] = [0, 0];
    for (const [when, nx, ny, duration = 0.5] of path) {
      tween(node, { translate: `${nx - x}px ${ny - y}px` }, when, duration, EASE.inOut);
      [px, py] = [nx - x, ny - y];
    }
    return node;
  }

  /** A warehouse shelf of packages, two boards high. */
  function shelf(parent, { x, y, at, until, rows }) {
    const node = place(el('div', 'mk-shelf is-staged', parent), x, y);
    const g = art(node, 'mk-shelf-art', 0, 0, 300, 172);
    inked(g, 'M4 0 H14 V172 H4 Z M286 0 H296 V172 H286 Z', 'mk-shelf-post');
    rows.forEach((items, r) => {
      const by = 74 + r * 86;
      inked(g, `M0 ${by} H300 V${by + 10} H0 Z`, 'mk-shelf-board');
      items.forEach((item, i) => packageArt(svg('g', { transform: `translate(${20 + i * 90} ${by - 60})` }, g), item));
    });
    fx.slideIn(node, at, { dx: 120, duration: 0.5 });
    if (until !== undefined) fx.exit(node, until - 0.4, { dx: 120, duration: 0.4 });
    return node;
  }

  /** A lockfile: a document with a padlock (`size` its scale), tossed off stage spinning at `tossAt`. */
  function lockfile(parent, { x, y, at, tossAt, size = 1 }) {
    const node = place(el('div', 'mk-lockfile is-staged', parent), x, y);
    const g = art(node, 'mk-lockfile-art', 0, 0, 120, 132);
    // `size` scales the page, not its label, which stays readable.
    g.setAttribute('width', 120 * size);
    g.setAttribute('height', 132 * size);
    inked(g, 'M10 4 H86 L110 28 V128 H10 Z', 'mk-doc');
    inked(g, 'M86 4 V28 H110', 'mk-doc-fold');
    for (let i = 0; i < 4; i++) svg('path', { class: 'mk-doc-line', d: `M22 ${40 + i * 12} H${82 - (i % 2) * 18}` }, g);
    inked(g, 'M46 94 H84 V122 H46 Z', 'mk-padlock');
    svg('path', { class: 'mk-padlock-shackle', d: 'M52 94 V86 C52 76 78 76 78 86 V94' }, g);
    svg('circle', { class: 'mk-keyhole', cx: 65, cy: 106, r: 3.6 }, g);
    const tag = el('div', 'mk-tag', node, 'package-lock.json');
    tag.style.left = '-6px';
    tag.style.top = `${132 * size + 4}px`;
    popped(node, at, undefined, { rotate: -3 });
    tween(node, { translate: '420px -160px', rotate: '540deg', opacity: 0 }, tossAt, 0.9, EASE.in);
    return node;
  }

  /**
   * Package boxes with little legs marching in from the right wing to
   * their places: versions = [{ version, x }], each stepping on the beat.
   * At `fixesAt` each gets a "fixes!" sticker.
   */
  function marchers(parent, { y, at, until, name, versions, fixesAt }) {
    return versions.map(({ version, x }, i) => {
      const node = place(el('div', 'mk-marcher is-staged', parent), x, y);
      const g = art(node, 'mk-marcher-art', 0, 0, 86, 78);
      const legs = svg('g', {}, g);
      const left = svg('path', { class: 'mk-leg', d: 'M26 56 V70 H18' }, legs);
      const right = svg('path', { class: 'mk-leg', d: 'M50 56 V70 H58' }, legs);
      const body = packageArt(svg('g', {}, g), { name, version, tone: 'new' });
      const sticker = el('div', 'mk-tag mk-tag--gold mk-marcher-fix is-staged', node, 'fixes!');
      if (fixesAt !== undefined) fx.pop(sticker, fixesAt + i * 0.12, { rotate: -8 });
      const enter = at + i * 0.35;
      fx.fadeIn(node, enter, 0.15);
      tween(node, [{ translate: `${960 - x}px 0` }, { translate: '0 0' }], enter, 1.4, EASE.out);
      onFrame((t) => {
        const walking = t > enter && t < enter + 1.5 && !reducedMotion.matches;
        const step = walking ? Math.sin((t - enter) * Math.PI * 4.6) : 0;
        left.setAttribute('transform', `rotate(${(step * 18).toFixed(1)} 26 56)`);
        right.setAttribute('transform', `rotate(${(-step * 18).toFixed(1)} 50 56)`);
        body.setAttribute('transform', `translate(0 ${(-Math.abs(step) * 3).toFixed(1)})`);
      });
      if (until !== undefined) fx.fadeOut(node, until - 0.3, 0.3);
      return node;
    });
  }

  /**
   * The Teammate's laptop, open, facing the audience, its screen changing
   * on cues [time, state]: 'green' (a big tick: works on my machine),
   * 'code' (his code in a gilded frame), 'lamps' (six lamps that turn
   * green from `lampsAt`, one every `lampsEvery`), 'cached' (an old
   * package kept on it: `cached` = { name, version }), 'error' (a red cross). `path` moves it
   * [[time, x, y, scale, duration]].
   */
  function laptop(parent, { x, y, scale = 1, at, until, screens = [], lampsAt, lampsEvery = 0.18, path = [], stickers = true, cached = { name: 'orders', version: '2.4.1' } }) {
    const node = place(el('div', 'mk-laptop is-staged', parent), x, y);
    node.dataset.testid = 'mk-laptop';
    node.style.transformOrigin = '50% 100%';
    const g = art(node, 'mk-laptop-art', 0, 0, 132, 100);
    inked(g, 'M10 4 H122 C126 4 128 6 128 10 V80 H4 V10 C4 6 6 4 10 4 Z', 'mk-laptop-lid');
    svg('path', { class: 'mk-laptop-screen', d: 'M12 12 H120 V74 H12 Z' }, g);
    inked(g, 'M0 80 H132 L126 94 C125 96 123 97 120 97 H12 C9 97 7 96 6 94 Z', 'mk-laptop-base');
    svg('path', { class: 'mk-laptop-lip', d: 'M50 84 H82' }, g);
    if (stickers) {
      // Stickers on the lid's edge: a rocket, a duck, a tick.
      svg('circle', { class: 'mk-sticker-dot mk-sticker-dot--duck', cx: 118, cy: 10, r: 5 }, g);
      svg('path', { class: 'mk-sticker-dot mk-sticker-dot--tick', d: 'M8 70 l4 4 l7 -9' }, g);
    }
    const screens_ = {
      green: svg('g', { opacity: 0 }, g),
      code: svg('g', { opacity: 0 }, g),
      lamps: svg('g', { opacity: 0 }, g),
      cached: svg('g', { opacity: 0 }, g),
      error: svg('g', { opacity: 0 }, g),
    };
    svg('circle', { class: 'mk-screen-tick-disc', cx: 66, cy: 38, r: 18 }, screens_.green);
    svg('path', { class: 'mk-screen-tick', d: 'M57 38 L63.5 45 L76 31' }, screens_.green);
    const ok = svg('text', { class: 'mk-screen-text', x: 66, y: 69, 'text-anchor': 'middle' }, screens_.green);
    ok.textContent = 'All tests pass';
    svg('path', { class: 'mk-gilt', d: 'M20 18 H112 V68 H20 Z' }, screens_.code);
    for (let i = 0; i < 4; i++) svg('path', { class: `mk-code-stroke mk-code-stroke--${i % 3}`, d: `M28 ${28 + i * 10} H${28 + 30 + ((i * 17) % 40)}` }, screens_.code);
    const lamps = Array.from({ length: 6 }, (_, i) => {
      const cx = 24 + i * 17;
      const lamp = svg('circle', { class: 'mk-screen-lamp', cx, cy: 40, r: 6.6 }, screens_.lamps);
      const tick = svg('path', { class: 'mk-screen-lamp-tick', d: `M${cx - 3} 40 l2 2.4 l4 -4.6`, opacity: 0 }, screens_.lamps);
      return { lamp, tick };
    });
    const lampsText = svg('text', { class: 'mk-screen-text', x: 66, y: 64, 'text-anchor': 'middle' }, screens_.lamps);
    lampsText.textContent = 'My machine';
    packageArt(svg('g', { transform: 'translate(29 16) scale(0.86)' }, screens_.cached), { ...cached, tone: 'old' });
    svg('circle', { class: 'mk-screen-cross-disc', cx: 66, cy: 38, r: 18 }, screens_.error);
    svg('path', { class: 'mk-screen-cross', d: 'M58 30 L74 46 M74 30 L58 46' }, screens_.error);
    const err = svg('text', { class: 'mk-screen-text mk-screen-text--error', x: 66, y: 69, 'text-anchor': 'middle' }, screens_.error);
    err.textContent = 'Fatal error';
    const sorted = [...screens].sort((a, b) => a[0] - b[0]);
    onFrame((t) => {
      let state = null, since = 0;
      for (const [when, s] of sorted) if (when <= t) { state = s; since = when; }
      for (const [key, layer] of Object.entries(screens_)) layer.setAttribute('opacity', key === state ? Math.min(1, (t - since) / 0.2).toFixed(3) : '0');
      if (state === 'lamps') {
        lamps.forEach(({ lamp, tick }, i) => {
          const on = lampsAt !== undefined && t >= lampsAt + i * lampsEvery;
          lamp.setAttribute('class', `mk-screen-lamp${on ? ' mk-screen-lamp--on' : ''}`);
          tick.setAttribute('opacity', on ? '1' : '0');
        });
      }
    });
    popped(node, at, until, { rotate: 0, from: 0.7 });
    for (const [when, nx, ny, ns = scale, duration = 0.5] of path) {
      tween(node, { translate: `${nx - x}px ${ny - y}px`, scale: String(ns) }, when, duration, EASE.inOut);
    }
    if (scale !== 1) node.style.scale = String(scale);
    return node;
  }

  /** A flip counter of tiny fixes: values [[time, n]], each flip a quick turn of the card. */
  function tally(parent, { x, y, at, until, title, values }) {
    const node = place(el('div', 'mk-tally is-staged', parent), x, y);
    el('div', 'mk-tally-title', node, title);
    const face = el('div', 'mk-tally-face', node, '0');
    const sorted = [...values].sort((a, b) => a[0] - b[0]);
    onFrame((t) => {
      let n = sorted.length ? '' : '0';
      for (const [when, value] of sorted) if (when <= t) n = String(value);
      if (face.textContent !== n) face.textContent = n;
    });
    for (const [when] of sorted) tween(face, [{ rotate: '0deg', scale: '1' }, { rotate: '-6deg', scale: '1.18' }, { rotate: '0deg', scale: '1' }], when, 0.3, EASE.out);
    popped(node, at, until, { rotate: 2 });
    return node;
  }

  /** The clean-build machine: a works with a hopper, a chimney, and a conveyor. */
  function buildMachine(parent, { x, y, at, until, label = 'Clean build' }) {
    const node = place(el('div', 'mk-machine is-staged', parent), x, y);
    const g = art(node, 'mk-machine-art', 0, 0, 200, 170);
    inked(g, 'M120 8 H140 V48 H120 Z', 'mk-chimney');
    inked(g, 'M30 40 H170 V150 H30 Z', 'mk-works');
    inked(g, 'M70 18 H130 L118 40 H82 Z', 'mk-hopper');
    inked(g, 'M0 150 H200 V160 H0 Z', 'mk-conveyor');
    for (let i = 0; i < 9; i++) svg('circle', { class: 'mk-roller', cx: 10 + i * 22.5, cy: 155, r: 3 }, g);
    const gear = svg('g', { transform: 'translate(64 104)' }, g);
    svg('path', { class: 'mk-gear', d: Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `M${(14 * Math.cos(a)).toFixed(1)} ${(14 * Math.sin(a)).toFixed(1)} L${(19 * Math.cos(a)).toFixed(1)} ${(19 * Math.sin(a)).toFixed(1)}`; }).join(' ') }, gear);
    svg('circle', { class: 'mk-gear-disc', r: 14 }, gear);
    svg('circle', { class: 'mk-gear-hub', r: 4 }, gear);
    svg('rect', { class: 'mk-machine-plate', x: 92, y: 64, width: 68, height: 26, rx: 3 }, g);
    const name = svg('text', { class: 'mk-machine-name', x: 126, y: 81, 'text-anchor': 'middle' }, g);
    name.textContent = label;
    onFrame((t) => gear.setAttribute('transform', `translate(64 104) rotate(${reducedMotion.matches ? 0 : (t * 60) % 360})`));
    popped(node, at, until, { rotate: 0, from: 0.6 });
    return node;
  }

  /**
   * A call that won't go through: a socket for the new interface and a
   * plug for the old call. The plug pushes in at `pushAt`, its prongs miss,
   * it bounces back with a spark, and a cross pops at `failAt`.
   */
  function plug(parent, { x, y, at, until, socketLabel, plugLabel, pushAt, failAt }) {
    const node = place(el('div', 'mk-plug is-staged', parent), x, y);
    const g = art(node, 'mk-plug-art', 0, 0, 360, 120);
    inked(g, 'M226 14 H330 V106 H226 Z', 'mk-socket');
    for (const sy of [36, 60, 84]) svg('rect', { class: 'mk-socket-hole', x: 238, y: sy - 4, width: 16, height: 8, rx: 2 }, g);
    const plugG = svg('g', {}, g);
    inked(plugG, 'M40 38 H130 V82 H40 Z', 'mk-plug-body');
    svg('path', { class: 'mk-cord', d: 'M40 60 C20 60 14 80 0 82' }, plugG);
    for (const py of [46, 74]) inked(plugG, `M130 ${py - 3} H168 V${py + 3} H130 Z`, 'mk-prong');
    const spark = svg('path', { class: 'mk-spark', d: 'M206 34 L218 50 L208 52 L222 72 M196 70 L210 64 M212 90 L222 80', opacity: 0 }, g);
    const socketTag = el('div', 'mk-code-chip', node, socketLabel);
    socketTag.style.left = '214px';
    socketTag.style.top = '112px';
    const plugTag = el('div', 'mk-code-chip', node, plugLabel);
    plugTag.style.left = '20px';
    plugTag.style.top = '0px';
    const cross = el('div', 'mk-cross is-staged', node);
    cross.append(icon('cross'));
    cross.style.left = '168px';
    cross.style.top = '30px';
    fx.pop(cross, failAt, { from: 0.3 });
    onFrame((t) => {
      // In it goes, its prongs miss the holes, and it springs back past
      // where it started before settling.
      const push = easeInOutCubic(progress(t, pushAt, 0.35));
      const back = easeInOutCubic(progress(t, pushAt + 0.4, 0.45));
      const dx = 50 * push * (1 - back) - 14 * Math.sin(Math.PI * back);
      plugG.setAttribute('transform', `translate(${dx.toFixed(1)} 0)`);
      const k = t >= pushAt + 0.35 && t < pushAt + 0.7 ? 1 - (t - pushAt - 0.35) / 0.35 : 0;
      spark.setAttribute('opacity', k.toFixed(3));
    });
    popped(node, at, until, { rotate: 0, from: 0.7 });
    return node;
  }

  /** A cardboard box for overnight mail, open; its label slaps on at `labelAt`. */
  function shippingBox(parent, { x, y, at, until, labelAt }) {
    const node = place(el('div', 'mk-shipbox is-staged', parent), x, y);
    const g = art(node, 'mk-shipbox-art', 0, 0, 170, 120);
    inked(g, 'M8 30 L-12 6 L40 14 L60 30 Z M162 30 L182 6 L130 14 L110 30 Z', 'mk-box-flap');
    inked(g, 'M8 30 H162 V116 H8 Z', 'mk-box');
    svg('path', { class: 'mk-box-tape', d: 'M70 30 V116 M100 30 V116' }, g);
    const stamp = svg('text', { class: 'mk-shipbox-word', x: 85, y: 64, 'text-anchor': 'middle' }, g);
    stamp.textContent = 'OVERNIGHT';
    const label = el('div', 'mk-shipping-label is-staged', node);
    el('div', 'mk-shipping-label-head', label, 'FRAGILE');
    el('div', 'mk-shipping-label-line', label, 'Works on my machine');
    label.style.left = '18px';
    label.style.top = '74px';
    fx.slam(label, labelAt, { from: 1.6, rotate: -4 });
    popped(node, at, until, { rotate: 0, from: 0.6 });
    return node;
  }

  // ------------------------------------------------------------------
  // Act III props: tags on each call, numbers on the helpers, a plaster
  // mold, cracks, and the tests as clingy little cards
  // ------------------------------------------------------------------

  /** Small tags pinned to code lines: [[time, x, y, text, tone]]. */
  function tags(parent, items, until) {
    return items.map(([at, x, y, text, tone = 'gold']) => {
      const node = place(el('div', `mk-tag mk-tag--${tone} mk-pin is-staged`, parent, text), x, y);
      fx.pop(node, at, { rotate: -4, from: 0.4 });
      if (until !== undefined) fx.popOut(node, until - 0.25);
      return node;
    });
  }

  /**
   * A plaster cast around a box (x, y, w, h): grey slabs close in from all
   * sides at `at`, a wax seal stamps it at `sealAt`.
   */
  function mold(parent, { x, y, w, h, at, sealAt, until }) {
    const node = place(el('div', 'mk-mold is-staged', parent), x - 16, y - 16);
    const g = art(node, 'mk-mold-art', 0, 0, w + 32, h + 32);
    inked(g, `M0 0 H${w + 32} V${h + 32} H0 Z M16 16 V${h + 16} H${w + 16} V16 Z`, 'mk-plaster');
    svg('path', { class: 'mk-plaster-mark', d: `M6 ${h * 0.3} l6 4 M${w + 22} ${h * 0.6} l6 -3 M${w * 0.4} 6 l5 5 M${w * 0.7} ${h + 24} l4 -4` }, g);
    const seal = el('div', 'mk-seal is-staged', node, 'Cast');
    seal.style.left = `${w - 10}px`;
    seal.style.top = '-14px';
    tween(node, [{ opacity: 0, scale: '1.25' }, { opacity: 1, scale: '1' }], at, 0.45, EASE.out);
    if (sealAt !== undefined) fx.slam(seal, sealAt, { from: 1.8, rotate: 10 });
    if (until !== undefined) fx.fadeOut(node, until - 0.3, 0.3);
    return node;
  }

  /** Cracks that draw themselves across a card at `at` (in its box w × h). */
  function crack(parent, { x, y, w, h, at }) {
    const g = art(parent, 'mk-crack', x, y, w, h);
    const path = svg('path', { class: 'mk-crack-line', d: `M${w * 0.1} 0 L${w * 0.3} ${h * 0.3} L${w * 0.24} ${h * 0.5} L${w * 0.45} ${h * 0.7} L${w * 0.4} ${h} M${w * 0.3} ${h * 0.3} L${w * 0.6} ${h * 0.24} L${w * 0.86} ${h * 0.4} M${w * 0.45} ${h * 0.7} L${w * 0.7} ${h * 0.82}` }, g);
    fx.draw(path, at, 0.3);
    return g;
  }

  /**
   * The tests as little cards with faces, clinging to lines of code:
   * buddies = [{ x, y }]. From `screamAt` they shriek; from `loveAt`
   * hearts float up; `tugAt` they hold on while being pulled (dx).
   */
  function testBuddies(parent, { buddies, at, until, screamAt, loveAt }) {
    return buddies.map(({ x, y }, i) => {
      const node = place(el('div', 'mk-buddy is-staged', parent), x, y);
      const g = art(node, 'mk-buddy-art', 0, 0, 56, 52);
      g.setAttribute('width', 78);
      g.setAttribute('height', 72);
      inked(g, 'M6 10 H50 V46 H6 Z', 'mk-buddy-card');
      svg('path', { class: 'mk-buddy-head', d: 'M6 10 H50 V20 H6 Z' }, g);
      const label = svg('text', { class: 'mk-buddy-label', x: 28, y: 18.5, 'text-anchor': 'middle' }, g);
      label.textContent = 'test';
      const eyes = svg('g', {}, g);
      svg('circle', { class: 'mk-buddy-eye', cx: 20, cy: 29, r: 2.4 }, eyes);
      svg('circle', { class: 'mk-buddy-eye', cx: 36, cy: 29, r: 2.4 }, eyes);
      const mouth = svg('path', { class: 'mk-buddy-mouth', d: 'M22 37 Q28 41 34 37' }, g);
      // Arms that hug the line of code to their left.
      svg('path', { class: 'mk-buddy-arm', d: 'M6 30 C0 30 -4 26 -6 22 M6 36 C0 38 -4 36 -6 32' }, g);
      const heart = svg('path', { class: 'mk-heart', d: 'M28 4 C24 0 18 2 18 7 C18 12 28 16 28 16 C28 16 38 12 38 7 C38 2 32 0 28 4 Z', opacity: 0 }, g);
      onFrame((t) => {
        const scream = screamAt !== undefined && t >= screamAt && (loveAt === undefined || t < loveAt);
        mouth.setAttribute('d', scream ? 'M24 33 C24 41 32 41 32 33 C32 30 24 30 24 33 Z' : 'M22 37 Q28 41 34 37');
        mouth.setAttribute('class', `mk-buddy-mouth${scream ? ' mk-buddy-mouth--open' : ''}`);
        const shake = scream && !reducedMotion.matches ? Math.sin(t * 60 + i) * 1.5 : 0;
        node.style.translate = `${shake.toFixed(2)}px 0`;
        if (loveAt !== undefined && t >= loveAt) {
          const age = (t - loveAt + i * 0.3) % 1.4;
          heart.setAttribute('opacity', (1 - age / 1.4).toFixed(3));
          heart.setAttribute('transform', `translate(0 ${(-age * 26).toFixed(1)})`);
        } else heart.setAttribute('opacity', '0');
      });
      fx.pop(node, at + i * 0.1, { rotate: (i % 2 ? 6 : -6) });
      if (until !== undefined) fx.popOut(node, until - 0.25);
      return node;
    });
  }

  // ------------------------------------------------------------------
  // Act IV props: a module as a building with doors, its table, the
  // modules that read it, and what one changed detail reaches
  // ------------------------------------------------------------------

  /**
   * The Orders module as a little building: a pediment with its name and
   * two doors that swing open at `openAt`. Its table shows inside.
   */
  function moduleHouse(parent, { x, y, at, until, name, openAt }) {
    const node = place(el('div', 'mk-module is-staged', parent), x, y);
    const g = art(node, 'mk-module-art', 0, 0, 260, 196);
    inked(g, 'M0 44 L130 0 L260 44 Z', 'mk-pediment');
    inked(g, 'M10 44 H250 V196 H10 Z', 'mk-module-wall');
    svg('rect', { class: 'mk-doorway', x: 26, y: 58, width: 208, height: 134 }, g);
    const plate = svg('text', { class: 'mk-module-name', x: 130, y: 36, 'text-anchor': 'middle' }, g);
    plate.textContent = name;
    const doors = [0, 1].map((side) => {
      const door = svg('g', {}, g);
      inked(door, side ? 'M130 58 H234 V192 H130 Z' : 'M26 58 H130 V192 H26 Z', 'mk-door');
      svg('path', { class: 'mk-door-panel', d: side ? 'M142 72 H222 V120 H142 Z M142 132 H222 V180 H142 Z' : 'M38 72 H118 V120 H38 Z M38 132 H118 V180 H38 Z' }, door);
      svg('circle', { class: 'mk-knob', cx: side ? 140 : 120, cy: 126, r: 4 }, door);
      return door;
    });
    onFrame((t) => {
      const open = easeInOutCubic(progress(t, openAt, 0.5));
      doors.forEach((door, side) => {
        const hinge = side ? 234 : 26;
        door.setAttribute('transform', `translate(${hinge} 0) scale(${(1 - 0.86 * open).toFixed(3)} 1) translate(${-hinge} 0)`);
      });
    });
    popped(node, at, until, { rotate: 0, from: 0.7 });
    return node;
  }

  /**
   * A data table: a head row of column names, then rows; the date column's
   * cells change to `newDates` at `dateAt`, glowing. Returns the node and
   * the date cells.
   */
  function dataTable(parent, { x, y, at, until, title, columns, rows, dateColumn, newDates, dateAt, glowAt }) {
    const node = place(el('div', 'mk-table-card is-staged', parent), x, y);
    if (title) el('div', 'mk-table-title', node, title);
    const grid = el('div', 'mk-grid', node);
    grid.style.gridTemplateColumns = `repeat(${columns.length}, auto)`;
    for (const name of columns) el('div', 'mk-grid-head', grid, name);
    const dates = [];
    rows.forEach((row, r) => row.forEach((cell, c) => {
      const node_ = el('div', `mk-grid-cell${c === dateColumn ? ' mk-grid-cell--date' : ''}`, grid, cell);
      if (c === dateColumn) dates.push({ node: node_, from: cell, to: newDates?.[r] });
    }));
    if (dateAt !== undefined) {
      onFrame((t) => {
        for (const d of dates) {
          const text = t >= dateAt ? d.to : d.from;
          if (d.node.textContent !== text) d.node.textContent = text;
          d.node.classList.toggle('is-changed', t >= dateAt);
          d.node.classList.toggle('is-glowing', glowAt !== undefined && t >= glowAt);
        }
      });
      for (const d of dates) fx.bump(d.node, dateAt, 0.2);
    }
    popped(node, at, until, { rotate: 0, from: 0.7 });
    return { node, dates };
  }

  /**
   * A wrapper round a box (x, y, w, h), labelled, torn off at `tearAt`:
   * it lifts and flies away.
   */
  function wrapper(parent, { x, y, w, h, at, tearAt, label }) {
    const node = place(el('div', 'mk-wrapper is-staged', parent), x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    el('div', 'mk-wrapper-label', node, label);
    fx.fadeIn(node, at, 0.3);
    tween(node, { translate: '-60px -240px', rotate: '-30deg', opacity: 0 }, tearAt, 0.7, EASE.in);
    return node;
  }

  /**
   * A client module as a kiosk with an arm reaching to (tx, ty): its roof,
   * name, and window; the arm draws on at `reachAt`. From `brokeAt` it
   * cracks and shows a cross; from `patchAt` a bandage covers the crack.
   */
  function client(parent, { x, y, at, until, name, iconName, tx, ty, reachAt, brokeAt, patchAt }) {
    const node = place(el('div', 'mk-client is-staged', parent), x, y);
    const g = art(node, 'mk-client-art', 0, 0, 120, 110);
    inked(g, 'M6 30 L60 4 L114 30 Z', 'mk-client-roof');
    inked(g, 'M12 30 H108 V104 H12 Z', 'mk-client-wall');
    svg('rect', { class: 'mk-client-window', x: 26, y: 44, width: 68, height: 36, rx: 4 }, g);
    const ic = icon(iconName, 'mk-client-icon');
    node.append(ic);
    el('div', 'mk-client-name', node, name);
    const crackG = svg('path', { class: 'mk-crack-line', d: 'M30 30 L44 52 L38 66 L56 84 L50 104', opacity: 0 }, g);
    const bandage = svg('g', { opacity: 0, transform: 'rotate(-30 46 66)' }, g);
    svg('rect', { class: 'mk-bandage', x: 26, y: 60, width: 40, height: 13, rx: 6 }, bandage);
    svg('rect', { class: 'mk-bandage-pad', x: 40, y: 62, width: 12, height: 9, rx: 2 }, bandage);
    const cross = el('div', 'mk-cross is-staged', node);
    cross.append(icon('cross'));
    cross.style.left = '84px';
    cross.style.top = '-12px';
    if (brokeAt !== undefined) fx.pop(cross, brokeAt, { from: 0.3 });
    if (patchAt !== undefined) fx.popOut(cross, patchAt);
    // The arm: from the kiosk's door to the target, in stage coordinates.
    const armArt = art(parent, 'mk-reach', 0, 0, 960, 540);
    const armPath = svg('path', { class: 'mk-reach-arm', d: `M${x + 60} ${y + 70} C${(x + 60 + tx) / 2} ${y - 20} ${tx} ${ty - 40} ${tx} ${ty}` }, armArt);
    const hand = svg('circle', { class: 'mk-reach-hand', cx: tx, cy: ty, r: 6, opacity: 0 }, armArt);
    armArt.classList.add('is-staged');
    fx.fadeIn(armArt, reachAt, 0.1);
    fx.draw(armPath, reachAt, 0.4);
    tween(hand, [{ opacity: 0 }, { opacity: 1 }], reachAt + 0.35, 0.1);
    if (until !== undefined) fx.fadeOut(armArt, until - 0.3, 0.3);
    onFrame((t) => {
      crackG.setAttribute('opacity', brokeAt !== undefined && t >= brokeAt ? '1' : '0');
      bandage.setAttribute('opacity', patchAt !== undefined && t >= patchAt ? '1' : '0');
    });
    popped(node, at, until, { rotate: 0, from: 0.6 });
    return node;
  }

  /**
   * Everything one changed detail reaches: from (x, y), dashed red lines
   * run out to labelled chips, one after another from `at`.
   */
  function ripple(parent, { x, y, at, every = 0.08, until, targets }) {
    const g = art(parent, 'mk-ripple is-staged', 0, 0, 960, 540);
    fx.fadeIn(g, at, 0.1);
    targets.forEach(([tx, ty, label, iconName], i) => {
      const when = at + i * every;
      const path = svg('path', { class: 'mk-ripple-line', d: `M${x} ${y} Q${(x + tx) / 2} ${Math.min(y, ty) - 30} ${tx} ${ty}` }, g);
      fx.draw(path, when, 0.3);
      const chip = place(el('div', 'mk-chip is-staged', parent), tx - 50, ty - 14);
      if (iconName) chip.append(icon(iconName));
      chip.append(document.createTextNode(label));
      fx.pop(chip, when + 0.2, { rotate: (i % 2 ? 3 : -3) });
      if (until !== undefined) fx.popOut(chip, until - 0.25);
    });
    if (until !== undefined) fx.fadeOut(g, until - 0.3, 0.3);
    return g;
  }

  // ------------------------------------------------------------------
  // Act V props: a commit graph that squashes and force-pushes
  // ------------------------------------------------------------------

  /**
   * The shared main line and the Teammate's branch, posed from song time:
   *   base         the old commit both start from (x, y)
   *   mates        the teammates' commits on main: [{ label }]
   *   mine         his messy commits: [labels]
   *   squashAt     his commits fold into one
   *   pushAt       it is force-pushed onto main: theirs are knocked off
   *   shineAt      it gleams
   *   sweepAt      the fallen commits are swept off to the left
   *   ghostAt      dashed outlines show where theirs were
   *   oldAt        the base is marked old, cobwebbed
   *   restoreAt    theirs come back, after his
   */
  function gitGraph(parent, { x, y, scale = 1, at, until, mates, mine, squashAt, pushAt, shineAt, sweepAt, ghostAt, oldAt, restoreAt }) {
    const node = place(el('div', 'mk-graph is-staged', parent), x, y);
    // `scale` sizes the picture (its pop-in animates the box's own scale).
    const g = art(node, 'mk-graph-art', 0, 0, 470, 200);
    g.setAttribute('width', 470 * scale);
    g.setAttribute('height', 200 * scale);
    const step = 74;
    const mainY = 60;
    const branchY = 150;
    // main: base, then the teammates' commits.
    const mainLine = svg('path', { class: 'mk-graph-line', d: `M30 ${mainY} H${30 + step * mates.length}` }, g);
    const mainLabel = svg('text', { class: 'mk-graph-label', x: 0, y: 30 }, g);
    mainLabel.textContent = 'shared main';
    const base = svg('g', { transform: `translate(30 ${mainY})` }, g);
    svg('circle', { class: 'mk-commit mk-commit--base', r: 14 }, base);
    const web = svg('path', { class: 'mk-cobweb', d: 'M-14 -4 L14 4 M-10 -10 L10 10 M-4 -14 L4 14 M-12 6 C-6 2 -2 2 4 -4', opacity: 0 }, base);
    const oldTag = svg('text', { class: 'mk-graph-old', x: 0, y: 34, 'text-anchor': 'middle', opacity: 0 }, base);
    oldTag.textContent = 'old';
    const theirs = mates.map(({ label }, i) => {
      const c = svg('g', {}, g);
      svg('circle', { class: 'mk-commit mk-commit--mate', r: 16 }, c);
      const tLabel = svg('text', { class: 'mk-commit-label', y: 5, 'text-anchor': 'middle' }, c);
      tLabel.textContent = label;
      const ghost = svg('circle', { class: 'mk-commit-ghost', cx: 30 + step * (i + 1), cy: mainY, r: 14, opacity: 0 }, g);
      return { c, i, ghost };
    });
    // His branch: messy commits that squash into one.
    const branchLine = svg('path', { class: 'mk-graph-line mk-graph-line--mine', d: '' }, g);
    const mineG = mine.map((label, i) => {
      const c = svg('g', {}, g);
      svg('circle', { class: 'mk-commit mk-commit--mine', r: 10 }, c);
      const t = svg('text', { class: 'mk-commit-mini', y: 26, 'text-anchor': 'middle' }, c);
      t.textContent = label;
      return { c, t, i };
    });
    const tidy = svg('g', { opacity: 0 }, g);
    svg('circle', { class: 'mk-commit mk-commit--tidy', r: 18 }, tidy);
    const tidyLabel = svg('text', { class: 'mk-commit-label mk-commit-label--dark', y: 5, 'text-anchor': 'middle' }, tidy);
    tidyLabel.textContent = '1';
    const tidyTag = svg('text', { class: 'mk-graph-label', y: 40, 'text-anchor': 'middle' }, tidy);
    tidyTag.textContent = 'one tidy line';
    const forkLine = svg('path', { class: 'mk-graph-line mk-graph-line--mine', d: '', opacity: 0 }, g);
    onFrame((t) => {
      const squash = easeInOutCubic(progress(t, squashAt, 0.7));
      const push = easeInOutCubic(progress(t, pushAt, 0.5));
      const sweep = easeInOutCubic(progress(t, sweepAt, 0.8));
      const restore = restoreAt === undefined ? 0 : easeInOutCubic(progress(t, restoreAt, 0.8));
      // His messy commits wander on a wiggly branch, then fold into one.
      const cx = 30 + step * 1.6;
      let d = `M30 ${mainY} C30 ${branchY} 50 ${branchY} 70 ${branchY}`;
      mineG.forEach(({ c, t: label, i }) => {
        const wx = 70 + i * 52;
        const wy = branchY + (i % 2 ? -10 : 10);
        const px = wx + (cx - wx) * squash;
        const py = wy + (branchY - wy) * squash;
        c.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) scale(${(1 - 0.5 * squash).toFixed(3)})`);
        c.setAttribute('opacity', squash < 0.95 ? '1' : '0');
        label.setAttribute('opacity', (1 - squash).toFixed(3));
        d += ` L${px.toFixed(1)} ${py.toFixed(1)}`;
      });
      branchLine.setAttribute('d', d);
      branchLine.setAttribute('opacity', (1 - push).toFixed(3));
      // The tidy commit: on the branch, then pushed up to be main's tip.
      const tx = cx + (30 + step - cx) * push;
      const ty = branchY + (mainY - branchY) * push;
      tidy.setAttribute('opacity', squash > 0.6 ? '1' : '0');
      tidy.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)})`);
      tidyTag.setAttribute('opacity', (1 - push).toFixed(3));
      let gleam = 0;
      if (t >= shineAt && t < shineAt + 0.8) gleam = Math.sin(Math.PI * (t - shineAt) / 0.8);
      tidy.firstChild.setAttribute('class', `mk-commit mk-commit--tidy${gleam > 0.2 ? ' mk-commit--shine' : ''}`);
      // Theirs: on main, knocked off by the push, swept off, back at restore.
      theirs.forEach(({ c, i, ghost }) => {
        const homeX = 30 + step * (i + 1);
        const knocked = push;
        const fallX = homeX + 30 + i * 24;
        const fallY = mainY + 120 * knocked + 18 * Math.sin(Math.PI * knocked);
        let px = homeX + (fallX - homeX) * knocked;
        let py = mainY + (fallY - mainY) * knocked;
        let opacity = 1;
        if (sweep > 0) { px -= 520 * sweep; opacity = 1 - sweep; }
        if (restore > 0) {
          const backX = 30 + step * (i + 2);
          px = backX;
          py = mainY - 80 * (1 - restore);
          opacity = restore;
        }
        c.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(knocked * (i % 2 ? 40 : -30) * (1 - restore)).toFixed(1)})`);
        c.setAttribute('opacity', opacity.toFixed(3));
        ghost.setAttribute('opacity', ghostAt !== undefined && t >= ghostAt && restore < 1 ? '1' : '0');
      });
      const length = restore > 0 ? mates.length + 1 : push > 0 ? 1 : mates.length;
      mainLine.setAttribute('d', `M30 ${mainY} H${30 + step * length}`);
      web.setAttribute('opacity', oldAt !== undefined && t >= oldAt ? '1' : '0');
      oldTag.setAttribute('opacity', oldAt !== undefined && t >= oldAt ? '1' : '0');
      forkLine.setAttribute('opacity', '0');
    });
    popped(node, at, until, { rotate: 0, from: 0.8 });
    return node;
  }

  // ------------------------------------------------------------------
  // Act VI props: a blanket, a folder swept into a commit, the public
  // repo, raining keys, burglars, servers, the bill, a rocket, forks
  // ------------------------------------------------------------------

  /** A blanket over someone's shoulders (x, y is its top centre) and a drift of Zs. */
  function blanket(parent, { x, y, at, until }) {
    const node = place(el('div', 'mk-blanket is-staged', parent), x - 70, y);
    const g = art(node, 'mk-blanket-art', 0, 0, 140, 150);
    inked(g, 'M20 20 C40 4 100 4 120 20 C134 70 132 120 126 146 C90 150 50 150 14 146 C8 120 6 70 20 20 Z', 'mk-blanket-cloth');
    svg('path', { class: 'mk-blanket-check', d: 'M20 60 H120 M14 100 H126 M50 10 V148 M90 10 V148' }, g);
    const zs = [0, 1, 2].map((i) => {
      const z = svg('text', { class: 'mk-z', x: 120 + i * 12, y: -10 - i * 16, opacity: 0 }, g);
      z.textContent = 'Z';
      return z;
    });
    onFrame((t) => zs.forEach((z, i) => {
      const age = (t - at - i * 0.4) % 1.6;
      z.setAttribute('opacity', t >= at + i * 0.4 ? Math.max(0, 1 - age / 1.6).toFixed(3) : '0');
      z.setAttribute('transform', `translate(${(age * 8).toFixed(1)} ${(-age * 14).toFixed(1)})`);
    }));
    tween(node, [{ opacity: 0, translate: '0 -8px' }, { opacity: 1, translate: '0 0' }], at, 0.5, EASE.out);
    if (until !== undefined) fx.fadeOut(node, until - 0.3, 0.3);
    return node;
  }

  /**
   * A folder of files and a commit box: files fly from the folder into the
   * box at `addAt` (one marked with a key: the secrets), the lid closes,
   * and at `pushAt` the box flies up to (toX, toY).
   */
  function folderToCommit(parent, { x, y, at, until, files, addAt, pushAt, toX, toY }) {
    const node = place(el('div', 'mk-folder is-staged', parent), x, y);
    const g = art(node, 'mk-folder-art', 0, 0, 120, 100);
    inked(g, 'M4 20 H44 L52 30 H116 V96 H4 Z', 'mk-folder-back');
    inked(g, 'M4 40 H116 V96 H4 Z', 'mk-folder-front');
    el('div', 'mk-folder-name', node, 'my-app/');
    popped(node, at, until, { rotate: 0 });
    const box = place(el('div', 'mk-commitbox is-staged', parent), x + 220, y + 20);
    const bg = art(box, 'mk-commitbox-art', 0, 0, 120, 90);
    inked(bg, 'M6 24 H114 V86 H6 Z', 'mk-commitbox-body');
    const lid = svg('g', {}, bg);
    inked(lid, 'M2 12 H118 V26 H2 Z', 'mk-commitbox-lid');
    el('div', 'mk-commitbox-name', box, 'commit');
    popped(box, at + 0.2, until, { rotate: 0 });
    const fileNodes = files.map(({ name, key }, i) => {
      const f = place(el('div', `mk-file${key ? ' mk-file--key' : ''} is-staged`, parent), x + 10 + i * 10, y - 26 - i * 30);
      if (key) f.append(icon('key'));
      f.append(document.createTextNode(name));
      fx.pop(f, at + 0.3 + i * 0.1, { rotate: -2 });
      const when = addAt + i * 0.14;
      tween(f, { translate: `${220 + 18 - 10 - i * 10}px ${20 + 46 + 26 + i * 30}px`, scale: '0.4', opacity: 0 }, when, 0.45, EASE.in);
      return f;
    });
    onFrame((t) => {
      const shut = easeInOutCubic(progress(t, addAt + files.length * 0.14 + 0.3, 0.25));
      lid.setAttribute('transform', `rotate(${(-70 * (1 - shut)).toFixed(1)} 2 26)`);
    });
    tween(box, { translate: `${toX - x - 220}px ${toY - y - 20}px`, scale: '0.5', opacity: 0 }, pushAt, 0.7, EASE.in);
    return { node, box, files: fileNodes };
  }

  /** The public repository: a cloud with a PUBLIC sign; keys hang in its window from `keysAt`. */
  function repoCloud(parent, { x, y, at, until, keysAt }) {
    const node = place(el('div', 'mk-cloud is-staged', parent), x, y);
    const g = art(node, 'mk-cloud-art', 0, 0, 240, 120);
    inked(g, 'M40 104 C14 104 6 76 26 64 C22 38 52 26 70 40 C80 12 130 8 142 38 C160 22 196 30 196 58 C222 60 234 96 206 104 Z', 'mk-cloud-body');
    const sign = el('div', 'mk-cloud-sign', node, 'Public repo');
    sign.style.left = '58px';
    sign.style.top = '50px';
    const keys = [0, 1, 2].map((i) => {
      const k = el('div', 'mk-hung-key is-staged', node);
      k.append(icon('key'));
      k.style.left = `${70 + i * 40}px`;
      k.style.top = '96px';
      if (keysAt !== undefined) fx.pop(k, keysAt + i * 0.1, { rotate: 20 });
      return k;
    });
    popped(node, at, until, { rotate: 0, from: 0.7 });
    return { node, keys };
  }

  /** Keys raining down from (x, y) to the stalls from `at`: many small gold keys tumbling. */
  function keyRain(parent, { x, y, at, until, count = 14 }) {
    const node = el('div', 'mk-keyrain', parent);
    const keys = Array.from({ length: count }, (_, i) => {
      const k = el('div', 'mk-falling-key', node);
      k.append(icon('key'));
      return { k, dx: (hash01(i * 13) - 0.5) * 760, delay: hash01(i * 7) * 1.2, spin: (hash01(i * 3) - 0.5) * 720 };
    });
    onFrame((t) => {
      const visible = t >= at && (until === undefined || t < until);
      node.style.display = visible ? '' : 'none';
      if (!visible) return;
      for (const { k, dx, delay, spin } of keys) {
        const age = t - at - delay;
        if (age < 0) { k.style.opacity = '0'; continue; }
        const u = Math.min(1, age / 1.6);
        k.style.opacity = u < 1 ? '1' : '0';
        k.style.transform = `translate(${(x + dx * u).toFixed(1)}px, ${(y + 420 * u * u).toFixed(1)}px) rotate(${(spin * u).toFixed(1)}deg)`;
      }
    });
    return node;
  }

  /** A burglar in a mask and a striped shirt popping up from behind something, a hand grabbing. */
  function burglar(parent, { x, y, at, until, flip = false, grabAt }) {
    const node = place(el('div', `mk-burglar${flip ? ' mk-burglar--flip' : ''} is-staged`, parent), x, y);
    const g = art(node, 'mk-burglar-art', 0, 0, 90, 110);
    inked(g, 'M14 110 C14 76 26 62 45 62 C64 62 76 76 76 110 Z', 'mk-burglar-shirt');
    svg('path', { class: 'mk-burglar-stripes', d: 'M18 84 H72 M16 96 H74 M22 72 H68' }, g);
    inked(g, 'M45 64 C30 64 22 52 22 38 C22 22 32 12 45 12 C58 12 68 22 68 38 C68 52 60 64 45 64 Z', 'mk-burglar-face');
    inked(g, 'M22 30 C22 18 32 8 45 8 C58 8 68 18 68 30 C60 26 30 26 22 30 Z', 'mk-burglar-cap');
    svg('path', { class: 'mk-burglar-mask', d: 'M22 34 C32 30 58 30 68 34 V42 C58 46 32 46 22 42 Z' }, g);
    svg('circle', { class: 'mk-burglar-eye', cx: 36, cy: 38, r: 2.6 }, g);
    svg('circle', { class: 'mk-burglar-eye', cx: 54, cy: 38, r: 2.6 }, g);
    svg('path', { class: 'mk-burglar-grin', d: 'M36 52 Q45 58 54 52' }, g);
    const arm = svg('g', {}, g);
    svg('path', { class: 'mk-burglar-arm', d: 'M70 80 C82 70 88 56 88 44' }, arm);
    svg('circle', { class: 'mk-burglar-glove', cx: 88, cy: 42, r: 6 }, arm);
    onFrame((t) => {
      const grab = grabAt === undefined ? 0 : Math.sin(Math.PI * clamp((t - grabAt) / 0.6, 0, 1));
      arm.setAttribute('transform', `rotate(${(-25 * grab).toFixed(1)} 70 80)`);
    });
    tween(node, [{ opacity: 0, translate: '0 60px' }, { opacity: 1, translate: '0 0' }], at, 0.4, EASE.back);
    if (until !== undefined) fx.fadeOut(node, until - 0.3, 0.3);
    return node;
  }

  /** A server rack whose fans spin up from `spinAt`, its lights awake. */
  function serverRack(parent, { x, y, at, until, spinAt }) {
    const node = place(el('div', 'mk-rack is-staged', parent), x, y);
    const g = art(node, 'mk-rack-art', 0, 0, 80, 150);
    inked(g, 'M4 4 H76 V146 H4 Z', 'mk-rack-body');
    const fans = [0, 1, 2].map((i) => {
      const cy = 30 + i * 44;
      svg('rect', { class: 'mk-rack-unit', x: 10, y: cy - 18, width: 60, height: 36, rx: 3 }, g);
      const fan = svg('g', { transform: `translate(30 ${cy})` }, g);
      svg('circle', { class: 'mk-fan-ring', r: 11 }, fan);
      svg('path', { class: 'mk-fan-blades', d: 'M0 0 C4 -8 9 -6 8 -2 Z M0 0 C8 4 6 9 2 8 Z M0 0 C-4 8 -9 6 -8 2 Z M0 0 C-8 -4 -6 -9 -2 -8 Z' }, fan);
      const led = svg('circle', { class: 'mk-led', cx: 58, cy: cy - 6, r: 3 }, g);
      return { fan, cy, led };
    });
    onFrame((t) => {
      const speed = clamp((t - spinAt) / 1.2, 0, 1);
      const angle = reducedMotion.matches ? 0 : 400 * speed * Math.max(0, t - spinAt);
      for (const { fan, cy, led } of fans) {
        fan.setAttribute('transform', `translate(30 ${cy}) rotate(${(angle % 360).toFixed(1)})`);
        led.setAttribute('class', `mk-led${t >= spinAt ? ' mk-led--on' : ''}`);
      }
    });
    popped(node, at, until, { rotate: 0, from: 0.6 });
    return node;
  }

  /**
   * The cloud bill: a meter whose figure climbs into the red, counting on
   * cues [[time, amount, duration]]; the figure keeps a minus sign, the
   * words say "in the red", and a down arrow points the way.
   */
  function bill(parent, { x, y, at, until, counts }) {
    const node = place(el('div', 'mk-bill is-staged', parent), x, y);
    const head = el('div', 'mk-bill-head', node);
    head.append(icon('cloud'), document.createTextNode('Cloud bill'));
    const figure = el('div', 'mk-bill-figure', node, '$0');
    const note = el('div', 'mk-bill-note', node, '');
    const sorted = [...counts].sort((a, b) => a[0] - b[0]);
    onFrame((t) => {
      let amount = 0;
      for (const [when, target, duration = 1] of sorted) {
        if (t < when) break;
        amount += (target - amount) * clamp((t - when) / duration, 0, 1);
      }
      const text = amount > 0 ? `−$${Math.round(amount).toLocaleString('en-US')}` : '$0';
      if (figure.textContent !== text) figure.textContent = text;
      const red = amount > 0;
      node.classList.toggle('is-red', red);
      const words = red ? 'in the red' : '';
      if (note.textContent !== words) note.textContent = words;
    });
    popped(node, at, until, { rotate: -2 });
    return node;
  }

  /** A rocket, labelled, standing at (x, y), launching at `launchAt` with money bags in tow. */
  function rocket(parent, { x, y, at, until, label, launchAt }) {
    const node = place(el('div', 'mk-rocket is-staged', parent), x, y);
    const g = art(node, 'mk-rocket-art', 0, 0, 100, 190);
    const body = svg('g', {}, g);
    inked(body, 'M50 4 C70 24 76 60 74 110 H26 C24 60 30 24 50 4 Z', 'mk-rocket-body');
    inked(body, 'M26 92 L8 128 L26 122 Z M74 92 L92 128 L74 122 Z', 'mk-rocket-fin');
    svg('circle', { class: 'mk-rocket-window', cx: 50, cy: 52, r: 11 }, body);
    const flame = svg('path', { class: 'mk-rocket-flame', d: 'M34 110 C38 132 46 140 50 154 C54 140 62 132 66 110 Z', opacity: 0 }, body);
    const bags = [0, 1].map((i) => {
      const bag = svg('g', { transform: `translate(${30 + i * 40} 168)` }, g);
      svg('path', { class: 'mk-rope', d: `M0 -14 L${i ? -18 : 18} -58` }, bag);
      inked(bag, 'M-12 10 C-14 -2 -8 -10 0 -12 C8 -10 14 -2 12 10 Z', 'mk-moneybag');
      const sym = svg('text', { class: 'mk-moneybag-sign', y: 6, 'text-anchor': 'middle' }, bag);
      sym.textContent = '$';
      return bag;
    });
    const tag = el('div', 'mk-tag mk-tag--red', node, label);
    tag.style.left = '20px';
    tag.style.top = '76px';
    onFrame((t) => {
      const lift = Math.max(0, t - launchAt);
      const dy = -170 * lift * lift;
      body.setAttribute('transform', `translate(0 ${dy.toFixed(1)})`);
      for (const bag of bags) bag.style.translate = `0 ${dy.toFixed(1)}px`;
      tag.style.translate = `0 ${dy.toFixed(1)}px`;
      const shaking = t >= launchAt - 0.4 && !reducedMotion.matches;
      flame.setAttribute('opacity', t >= launchAt - 0.3 ? '1' : '0');
      flame.setAttribute('transform', shaking ? `translate(50 110) scale(1 ${(1 + 0.18 * Math.sin(t * 40)).toFixed(3)}) translate(-50 -110)` : '');
    });
    popped(node, at, until, { rotate: 0, from: 0.6 });
    return node;
  }

  /** Copies of the repository (forks, clones), each with a key, popping in a fan from `at`. */
  function forks(parent, { x, y, at, until, count = 4 }) {
    return Array.from({ length: count }, (_, i) => {
      const node = place(el('div', 'mk-fork is-staged', parent), x + i * 72, y + (i % 2) * 18);
      el('div', 'mk-fork-name', node, 'copy');
      const k = icon('key', 'mk-fork-key');
      node.append(k);
      fx.pop(node, at + i * 0.12, { rotate: (i % 2 ? 6 : -6), from: 0.3 });
      if (until !== undefined) fx.popOut(node, until - 0.25);
      return node;
    });
  }

  /** The moral of the opera, on a card over the closed curtain. */
  function moral(parent, { x, y, w, at, title, lines }) {
    const node = place(el('div', 'mk-moral is-staged', parent), x, y);
    node.style.width = `${w}px`;
    el('div', 'mk-moral-title', node, title);
    const list = el('ol', 'mk-moral-list', node);
    for (const text of lines) el('li', '', list, text);
    tween(node, [{ opacity: 0, translate: '0 16px' }, { opacity: 1, translate: '0 0' }], at, 0.6, EASE.out);
    return node;
  }

  window.MachineKit = {
    popped, art, inked, cup, latte, spot, card, code, calendar, toyShip, audience, phone, sparkle,
    desk, scroll, tornCard, applause, thoughts, cricket, table,
    packageBox, shelf, lockfile, marchers, laptop, tally, buildMachine, plug, shippingBox,
    tags, mold, crack, testBuddies, moduleHouse, dataTable, wrapper, client, ripple, gitGraph,
    blanket, folderToCommit, repoCloud, keyRain, burglar, serverRack, bill, rocket, forks, moral,
  };
})();
