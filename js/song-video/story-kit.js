/*
 * Story kit for "Invest in Your Stories" (the user stories and INVEST song):
 * vector pieces that show what a user story is and how INVEST judges one.
 * Each piece carries one visual metaphor whose mapping holds for the concept
 * it teaches, and keeps the real wording on screen beside it:
 *
 *   a user story is an index card with three slots (As a / I want /
 *     so that) and its acceptance criteria as a checklist on the card;
 *   INVEST is a scanner of six lamps, one per letter, each with a written
 *     term and a check or cross, so nothing depends on color alone;
 *   a role is a "Hello, my name is" tag; a commit points back to its card;
 *   slicing by layers splits a cake into a frosting-only and a sponge-only
 *     half, while a vertical slice carries every layer (Independent);
 *   a conversation is two speech bubbles, and a design choice gets a
 *     HOW? stamp (Negotiable);
 *   value is what the user sees happen on a phone (Valuable);
 *   an estimate is a dial that only settles once the fog clears (Estimable);
 *   a sprint is a box a story must fit in, an epic is four stories in a
 *     trench coat, and crumb-sized stories merge into one (Small);
 *   acceptance criteria are three Given / When / Then panels that end in
 *     PASS or FAIL (Testable).
 *
 * Builds on SongKit (kit.js) and Timeline (timeline.js); every builder
 * schedules its own motion, and every pose is a pure function of song time.
 * Coordinates are CSS pixels on the 960×540 stage. Styles:
 * css/song-video-story-kit.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, progress, clamp, easeInOutCubic } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, place, icon } = kit;

  /** The newest entry of a time-sorted list at or before t (or undefined). */
  function latest(entries, t) {
    let found;
    for (const entry of entries) if (entry.at <= t) found = entry;
    return found;
  }

  /** Text that appears by fading in at `at` (or immediately if undefined). */
  function reveal(node, at) {
    if (at === undefined) return node;
    node.classList.add('is-staged');
    fx.rise(node, at, { distance: 8, duration: 0.3 });
    return node;
  }

  // ------------------------------------------------------------------
  // The INVEST letters: one source for the scanner, chorus, and quiz
  // ------------------------------------------------------------------

  const LETTERS = [
    { letter: 'I', term: 'Independent', meaning: 'any order', iconName: 'loop' },
    { letter: 'N', term: 'Negotiable', meaning: 'the what, not the how', iconName: 'chat' },
    { letter: 'V', term: 'Valuable', meaning: 'a user wins on its own', iconName: 'sparkle' },
    { letter: 'E', term: 'Estimable', meaning: 'the effort can be known', iconName: 'timer' },
    { letter: 'S', term: 'Small', meaning: 'smallest slice that still passes', iconName: 'scissors' },
    { letter: 'T', term: 'Testable', meaning: 'Given, When, Then', iconName: 'check' },
  ];

  // ------------------------------------------------------------------
  // A story card: As a / I want / so that, plus acceptance criteria
  // ------------------------------------------------------------------

  /**
   * An index card. Give `role`, `want`, `why` for the three slots (each may
   * appear at its own time via `fill`), or `quote` for a single request
   * under review. `criteria` adds a checklist; check(i, at) ticks one.
   */
  function card(parent, {
    x, y, w = 330, at, until, tilt = 0, title = 'User story',
    role, want, why, fill = {}, quote, criteria = [], criteriaAt, size = 'normal',
  }) {
    const node = place(el('div', `us-card us-card--${size} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    node.style.rotate = `${tilt}deg`;
    const head = el('div', 'us-card-head', node);
    el('span', 'us-card-pin', head);
    el('span', 'us-card-title', head, title);
    const body = el('div', 'us-card-body', node);
    const slots = {};
    if (quote !== undefined) {
      slots.quote = el('div', 'us-card-quote', body, `“${quote}”`);
    } else {
      for (const [key, label] of [['role', 'As a'], ['want', 'I want'], ['why', 'so that']]) {
        const value = { role, want, why }[key];
        if (value === undefined) continue;
        const row = el('div', 'us-card-row', body);
        el('span', 'us-card-label', row, label);
        slots[key] = reveal(el('span', 'us-card-value', row, value), fill[key]);
      }
    }
    const checks = [];
    const criterionText = [];
    if (criteria.length) {
      const list = reveal(el('div', 'us-card-criteria', node), criteriaAt);
      for (const text of criteria) {
        const item = el('div', 'us-card-criterion', list);
        const box = el('span', 'us-check', item);
        box.append(icon('check'));
        criterionText.push(el('span', 'us-card-criterion-text', item, text));
        checks.push(box);
      }
    }
    fx.pop(node, at, { from: 0.7, rotate: tilt });
    if (until !== undefined) fx.popOut(node, until);
    return {
      node,
      slots,
      check(i, time) {
        checks[i].classList.add('is-ticked-pending');
        tween(checks[i], [{ background: 'rgba(11, 15, 26, 0.04)' }, { background: '#16a34a' }], time, 0.2);
        tween(checks[i].firstChild, [{ opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1 }], time, 0.3, EASE.back);
        return this;
      },
      /** Replace criterion i's words (the old words fade, the new rise in green). */
      rewriteCriterion(i, text, time) {
        const old = criterionText[i];
        const next = el('span', 'us-card-criterion-text us-card-criterion-text--new is-staged', old.parentNode, text);
        tween(old, { opacity: 0 }, time - 0.05, 0.2, EASE.in);
        fx.rise(next, time + 0.1, { distance: 8, duration: 0.3 });
        return next;
      },
      /** A rubber stamp across the card (HOW?, PASS, SPLIT ME…). */
      stamp(text, { at: time, color = 'red', rotate = -10, dx = 0, dy = 0 }) {
        const mark = el('div', `us-card-stamp us-card-stamp--${color} is-staged`, node, text);
        mark.style.translate = `${dx}px ${dy}px`;
        fx.slam(mark, time, { from: 2.4, rotate });
        return mark;
      },
      /** Strike through one slot, e.g. the design choice inside a request. */
      strike(key, time) {
        const target = slots[key];
        const line = el('span', 'us-strike is-staged', target);
        tween(line, [{ opacity: 1, scale: '0 1' }, { opacity: 1, scale: '1 1' }], time, 0.3, EASE.out);
        tween(target, { color: 'rgba(11, 15, 26, 0.45)' }, time, 0.3);
        return line;
      },
      /** Replace a slot's words: the old text fades, the new text rises in. */
      rewrite(key, text, time) {
        const target = slots[key];
        const next = el('span', `${target.className.replace('is-staged', '')} us-card-rewrite is-staged`, target.parentNode, text);
        tween(target, { opacity: 0, translate: '0 -6px' }, time - 0.05, 0.25, EASE.in);
        fx.rise(next, time + 0.15, { distance: 10, duration: 0.35 });
        slots[key] = next;
        return next;
      },
    };
  }

  /** A small card that stands for a whole story on a board. */
  function miniCard(parent, { x, y, text, at, until, tone = 'paper', tilt = 0, iconName }) {
    const node = place(el('div', `us-mini us-mini--${tone} is-staged`, parent), x, y);
    node.style.rotate = `${tilt}deg`;
    if (iconName) node.append(icon(iconName));
    el('span', null, node, text);
    fx.pop(node, at, { from: 0.6, rotate: tilt });
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  // ------------------------------------------------------------------
  // The INVEST scanner: six lamps with written terms
  // ------------------------------------------------------------------

  /**
   * Six letter lamps. light(i, at, state) switches lamp i to 'on' (gold, the
   * letter being sung), 'pass' (green check), 'fail' (red cross), or 'off'.
   * `none` adds a seventh "No break" lamp for the quiz.
   */
  function scanner(parent, { x, y, at, until, compact = false, tiny = false, none = false, terms = !tiny }) {
    const size = tiny ? ' us-scanner--tiny' : compact ? ' us-scanner--compact' : '';
    const node = place(el('div', `us-scanner${size} is-staged`, parent), x, y);
    const lamps = LETTERS.map((entry, i) => {
      const lamp = el('div', 'us-lamp', node);
      el('span', 'us-lamp-letter', lamp, entry.letter);
      if (terms) el('span', 'us-lamp-term', lamp, entry.term);
      const badgeNode = el('span', 'us-lamp-badge', lamp);
      badgeNode.append(icon('check', 'us-lamp-pass'), icon('cross', 'us-lamp-fail'));
      return { lamp, events: [], index: i };
    });
    if (none) {
      const lamp = el('div', 'us-lamp us-lamp--none', node);
      el('span', 'us-lamp-letter', lamp, '✓');
      if (terms) el('span', 'us-lamp-term', lamp, 'None');
      const badgeNode = el('span', 'us-lamp-badge', lamp);
      badgeNode.append(icon('check', 'us-lamp-pass'), icon('cross', 'us-lamp-fail'));
      lamps.push({ lamp, events: [], index: 6 });
    }
    fx.rise(node, at, { distance: 20, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until - 0.3, 0.3);
    onFrame((t) => {
      for (const entry of lamps) {
        const state = latest(entry.events, t)?.state || 'off';
        if (entry.state !== state) {
          entry.lamp.classList.remove(`is-${entry.state}`);
          entry.lamp.classList.add(`is-${state}`);
          entry.state = state;
        }
      }
    });
    return {
      node,
      lamps: lamps.map((entry) => entry.lamp),
      light(i, time, state = 'on') {
        lamps[i].events.push({ at: time, state });
        lamps[i].events.sort((a, b) => a.at - b.at);
        if (state !== 'off') fx.bump(lamps[i].lamp, time, state === 'on' ? 0.16 : 0.22);
        return this;
      },
    };
  }

  // ------------------------------------------------------------------
  // Roles, commits, criteria: the parts of a story in Verse 1
  // ------------------------------------------------------------------

  /** A "Hello, my name is" sticker for a specific role. */
  function nameTag(parent, { x, y, name, at, until, tilt = -3, crossed }) {
    const node = place(el('div', 'us-tag is-staged', parent), x, y);
    node.style.rotate = `${tilt}deg`;
    const top = el('div', 'us-tag-top', node);
    el('b', null, top, 'HELLO');
    el('span', null, top, 'my name is');
    el('div', 'us-tag-name', node, name);
    fx.pop(node, at, { from: 0.6, rotate: tilt });
    if (crossed !== undefined) {
      const cross = el('span', 'us-tag-cross is-staged', node);
      tween(cross, [{ opacity: 1, scale: '0 1' }, { opacity: 1, scale: '1 1' }], crossed, 0.3, EASE.out);
      tween(node, { opacity: 0.55 }, crossed + 0.1, 0.3);
    }
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  /** A commit message whose story reference lights up. */
  function commit(parent, { x, y, hash, message, ref, at, refAt, until }) {
    const node = place(el('div', 'us-commit is-staged', parent), x, y);
    el('span', 'us-commit-hash', node, hash);
    el('span', 'us-commit-msg', node, message);
    const tag = el('span', 'us-commit-ref', node, ref);
    fx.rise(node, at, { distance: 14 });
    if (refAt !== undefined) {
      tween(tag, [{ background: 'rgba(255, 209, 0, 0)' }, { background: 'rgba(255, 209, 0, 1)' }], refAt, 0.25);
      tween(tag, [{ color: '#ffd100' }, { color: '#0b0f1a' }], refAt, 0.25);
      fx.bump(tag, refAt, 0.2);
    }
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  // ------------------------------------------------------------------
  // Intro: a demo where every test is green
  // ------------------------------------------------------------------

  function testBar(parent, { x, y, w = 330, at, total = 128, fillUntil, until }) {
    const node = place(el('div', 'us-tests is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const label = el('div', 'us-tests-label', node);
    label.append(icon('check'));
    const count = el('span', null, label, '');
    const track = el('div', 'us-tests-track', node);
    const bar = el('div', 'us-tests-bar', track);
    fx.rise(node, at, { distance: 16 });
    const done = fillUntil ?? at + 1.2;
    onFrame((t) => {
      const p = easeInOutCubic(progress(t, at + 0.15, done - at - 0.15));
      bar.style.width = `${(p * 100).toFixed(1)}%`;
      count.textContent = `${Math.round(p * total)} / ${total} tests passed`;
    });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /** A speech bubble with a speaker icon (user, team). */
  function speech(parent, { x, y, w, text, at, until, from = 'user', tail = 'left' }) {
    const node = place(el('div', `us-speech us-speech--${from} us-speech--tail-${tail} is-staged`, parent), x, y);
    if (w) node.style.width = `${w}px`;
    const who = el('span', 'us-speech-who', node);
    who.append(icon(from === 'team' ? 'team' : 'user'));
    el('span', 'us-speech-text', node, text);
    fx.pop(node, at, { from: 0.5 });
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  // ------------------------------------------------------------------
  // Independent: slicing a cake by layers vs. through every layer
  // ------------------------------------------------------------------

  /**
   * A three-layer cake (UI frosting, logic filling, data sponge). split(at)
   * pulls the layers apart into separate "stories"; slice(at) cuts one
   * wedge through every layer and slides it out.
   */
  function cake(parent, { x, y, w = 300, at, until, layers }) {
    const node = place(el('div', 'us-cake is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const stack = el('div', 'us-cake-stack', node);
    const rows = layers.map((layer, i) => {
      const row = el('div', `us-cake-layer us-cake-layer--${i}`, stack);
      el('span', 'us-cake-label', row, layer);
      return row;
    });
    el('div', 'us-cake-plate', node);
    fx.rise(node, at, { distance: 20 });
    if (until !== undefined) fx.fadeOut(node, until);
    return {
      node,
      rows,
      /** Pull the layers apart vertically: each layer is now a "story". */
      split(time, gap = 34) {
        rows.forEach((row, i) => fx.moveTo(row, time + i * 0.08, 0, -gap * (rows.length - 1 - i), 0.45));
      },
      /** Restack, then lift out one slice that holds a piece of every layer. */
      slice(time, { dx = 150 } = {}) {
        rows.forEach((row, i) => tween(row, { translate: '0 0' }, time - 0.4 + i * 0.05, 0.35, EASE.inOut));
        const knife = el('div', 'us-cake-knife is-staged', node);
        tween(knife, [{ opacity: 0, translate: '0 -60px' }, { opacity: 1, translate: '0 0' }], time, 0.3, EASE.out);
        fx.fadeOut(knife, time + 0.7, 0.2);
        const wedge = el('div', 'us-cake-slice is-staged', node);
        rows.forEach((row, i) => el('div', `us-cake-layer us-cake-layer--${i}`, wedge));
        tween(wedge, [{ opacity: 1, translate: '0 0' }, { opacity: 1, translate: `${dx}px -10px` }], time + 0.35, 0.55, EASE.inOut);
        return wedge;
      },
    };
  }

  // ------------------------------------------------------------------
  // Valuable and the good story: a phone that shows what the user sees
  // ------------------------------------------------------------------

  function phone(parent, { x, y, at, until, title = '' }) {
    const node = place(el('div', 'us-phone is-staged', parent), x, y);
    el('div', 'us-phone-notch', node);
    const screen = el('div', 'us-phone-screen', node);
    if (title) el('div', 'us-phone-title', screen, title);
    fx.rise(node, at, { distance: 26, duration: 0.45 });
    if (until !== undefined) fx.fadeOut(node, until);
    return { node, screen };
  }

  /** A button that can be pressed at `pressAt` (finger ring + squash). */
  function appButton(parent, { text, at, pressAt, iconName, variant = 'gold' }) {
    const node = reveal(el('div', `us-button us-button--${variant}`, parent), at);
    if (iconName) node.append(icon(iconName));
    el('span', null, node, text);
    if (pressAt !== undefined) {
      const ring = el('span', 'us-tap is-staged', node);
      tween(ring, [{ opacity: 0.9, scale: 0.3 }, { opacity: 0, scale: 1.8 }], pressAt, 0.5, EASE.out);
      tween(node, [{ scale: 1 }, { scale: 0.92 }, { scale: 1 }], pressAt, 0.25, EASE.out);
    }
    return node;
  }

  /** A delivery map: a route that a scooter rides from `from` to `to`. */
  function deliveryMap(parent, { at, rideFrom, rideTo }) {
    const node = reveal(el('div', 'us-map'), at);
    parent.append(node);
    const art = svg('svg', { viewBox: '0 0 180 150', class: 'us-map-art' }, node);
    svg('path', { class: 'us-map-street', d: 'M0 40H180M0 110H180M50 0V150M130 0V150' }, art);
    const route = svg('path', { class: 'us-map-route', d: 'M18 128 L50 110 L50 40 L130 40 L150 22' }, art);
    svg('circle', { class: 'us-map-home', cx: 150, cy: 22, r: 7 }, art);
    const rider = svg('g', { class: 'us-map-rider' }, art);
    svg('circle', { r: 8 }, rider);
    svg('path', { d: 'M-4 1h8M-2-3h4', class: 'us-map-rider-mark' }, rider);
    const pts = [[18, 128], [50, 110], [50, 40], [130, 40], [150, 22]];
    const lengths = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    const total = lengths.reduce((a, b) => a + b, 0);
    route.setAttribute('pathLength', '1');
    onFrame((t) => {
      const p = clamp((t - rideFrom) / (rideTo - rideFrom), 0, 1) * 0.92;
      let d = p * total;
      let i = 0;
      while (i < lengths.length - 1 && d > lengths[i]) d -= lengths[i++];
      const f = lengths[i] ? d / lengths[i] : 0;
      const px = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f;
      const py = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
      rider.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
      route.style.strokeDashoffset = (1 - p).toFixed(3);
    });
    return node;
  }

  /** A lock-screen notification on a phone. */
  function notification(parent, { title, text, at, iconName = 'bolt' }) {
    const node = reveal(el('div', 'us-notify'), at);
    parent.append(node);
    const badgeNode = el('span', 'us-notify-icon', node);
    badgeNode.append(icon(iconName));
    const words = el('div', 'us-notify-words', node);
    el('b', null, words, title);
    el('span', null, words, text);
    if (at !== undefined) fx.bump(node, at + 0.3, 0.08);
    return node;
  }

  /** A dropdown that opens at `openAt` with `options`. */
  function dropdown(parent, { label, options, at, openAt }) {
    const node = reveal(el('div', 'us-dropdown'), at);
    parent.append(node);
    const field = el('div', 'us-dropdown-field', node);
    el('span', null, field, label);
    el('span', 'us-dropdown-caret', field, '▾');
    const list = el('div', 'us-dropdown-list is-staged', node);
    for (const option of options) el('div', 'us-dropdown-option', list, option);
    if (openAt !== undefined) tween(list, [{ opacity: 0, translate: '0 -8px' }, { opacity: 1, translate: '0 0' }], openAt, 0.3);
    return node;
  }

  // ------------------------------------------------------------------
  // Estimable: an estimate dial that settles once the fog clears
  // ------------------------------------------------------------------

  /**
   * A gauge labeled in story points. `phases` = [{ at, fog, value }]: while
   * fogged the needle wanders and a question mark covers the readout; when
   * a phase clears the fog, the needle settles on that phase's value.
   */
  function dial(parent, { x, y, at, until, phases }) {
    const node = place(el('div', 'us-dial is-staged', parent), x, y);
    const art = svg('svg', { viewBox: '-110 -110 220 130', class: 'us-dial-art' }, node);
    svg('path', { class: 'us-dial-arc', d: 'M-90 0A90 90 0 0 1 90 0' }, art);
    const POINTS = [1, 2, 3, 5, 8, 13];
    const angleOf = (value) => Math.PI - (POINTS.indexOf(value) / (POINTS.length - 1)) * Math.PI;
    POINTS.forEach((point) => {
      const a = angleOf(point);
      const tick = svg('text', { class: 'us-dial-tick', x: (Math.cos(a) * 70).toFixed(1), y: (-Math.sin(a) * 70 + 5).toFixed(1) }, art);
      tick.textContent = point;
    });
    const needle = svg('path', { class: 'us-dial-needle', d: 'M0 6L-4 0 0-78 4 0Z' }, art);
    svg('circle', { class: 'us-dial-hub', r: 8 }, art);
    const readout = el('div', 'us-dial-readout', node, '?');
    const fog = el('div', 'us-dial-fog', node);
    el('span', null, fog, '?');
    el('div', 'us-dial-label', node, 'estimate (story points)');
    fx.rise(node, at, { distance: 20 });
    const sorted = [...phases].sort((a, b) => a.at - b.at);
    onFrame((t) => {
      const phase = latest(sorted, t) || { at, fog: true };
      const wander = Math.PI / 2 + Math.sin(t * 3.1) * 1.1 + Math.sin(t * 7.3) * 0.25;
      let angle = wander;
      let fogAmount = 1;
      if (!phase.fog) {
        const settle = easeInOutCubic(progress(t, phase.at, 0.8));
        angle = wander + (angleOf(phase.value) - wander) * settle;
        fogAmount = 1 - progress(t, phase.at, 0.5);
      } else {
        fogAmount = progress(t, phase.at, 0.5);
      }
      needle.setAttribute('transform', `rotate(${(90 - (angle * 180) / Math.PI).toFixed(1)})`);
      fog.style.opacity = (0.92 * fogAmount).toFixed(3);
      readout.textContent = !phase.fog && t > phase.at + 0.7 ? `${phase.value} pts` : '?';
    });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  // ------------------------------------------------------------------
  // Small: a sprint box, an epic in a trench coat, crumbs that merge
  // ------------------------------------------------------------------

  function sprintBox(parent, { x, y, w, h, at, until, label = 'One sprint' }) {
    const node = place(el('div', 'us-sprint is-staged', parent), x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    const head = el('div', 'us-sprint-head', node);
    head.append(icon('calendar'));
    el('span', null, head, label);
    fx.rise(node, at, { distance: 16 });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /**
   * Stories stacked in a trench coat and hat, pretending to be one: the top
   * story peeks out of the collar like a face, and the others stick out of
   * the coat's sides, alternating left and right, so their names stay
   * readable before the coat drops.
   * At `splitAt` the coat and hat drop and the cards spread into a row.
   * `row` gives the cards' row position in stage pixels.
   */
  let coatId = 0;
  function trenchCoat(parent, { x, y, at, splitAt, until, labels, icons = [], row = { x: 150, y: 280, gap: 20 } }) {
    const id = `us-coat-${++coatId}`;
    const node = place(el('div', 'us-coat is-staged', parent), x, y);
    const CARD_W = 150;
    const tops = labels.map((_, i) => (i === 0 ? 38 : 96 + (i - 1) * 54));
    // The face sits centred; hidden stories poke out past the sleeves.
    const side = (i) => (i === 0 ? 0 : i % 2 ? -1 : 1);
    const lefts = labels.map((_, i) => (220 - CARD_W) / 2 + side(i) * 147);
    const makeCard = (i) => {
      const mini = el('div', `us-coat-card${side(i) < 0 ? ' us-coat-card--left' : side(i) > 0 ? ' us-coat-card--right' : ''}`, node);
      if (icons[i]) mini.append(icon(icons[i]));
      el('span', null, mini, labels[i]);
      mini.style.top = `${tops[i]}px`;
      mini.style.left = `${lefts[i]}px`;
      if (side(i)) mini.style.rotate = `${side(i) * 4}deg`;
      return mini;
    };
    // Hidden stories first, then the coat, then the "face" story and the hat.
    const hidden = labels.slice(1).map((_, i) => makeCard(i + 1));
    const coat = svg('svg', { viewBox: '0 0 220 300', class: 'us-coat-art' }, node);
    const defs = svg('defs', {}, coat);
    const grad = svg('linearGradient', { id: `${id}-cloth`, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    svg('stop', { offset: '0', 'stop-color': '#d2a36d' }, grad);
    svg('stop', { offset: '0.55', 'stop-color': '#bf8d57' }, grad);
    svg('stop', { offset: '1', 'stop-color': '#a3733f' }, grad);
    const cloth = `url(#${id}-cloth)`;
    svg('path', { class: 'us-coat-sleeve', fill: cloth, d: 'M40 94C27 124 21 172 23 216L45 218C47 178 51 132 58 106Z' }, coat);
    svg('path', { class: 'us-coat-sleeve', fill: cloth, d: 'M180 94C193 124 199 172 197 216L175 218C173 178 169 132 162 106Z' }, coat);
    svg('path', { class: 'us-coat-hand', d: 'M24 216h20v8a10 10 0 0 1-20 0zM176 216h20v8a10 10 0 0 1-20 0z' }, coat);
    svg('path', { class: 'us-coat-body', fill: cloth, d: 'M40 94C42 82 60 77 80 75L110 98L140 75C160 77 178 82 180 94L194 280Q110 292 26 280Z' }, coat);
    svg('path', { class: 'us-coat-shade', d: 'M110 98V286M150 102L165 280' }, coat);
    svg('path', { class: 'us-coat-lapel', d: 'M80 75L110 98L97 154L68 102Z' }, coat);
    svg('path', { class: 'us-coat-lapel', d: 'M140 75L110 98L123 154L152 102Z' }, coat);
    svg('path', { class: 'us-coat-collar', d: 'M68 64L82 74L68 102L54 82Z' }, coat);
    svg('path', { class: 'us-coat-collar', d: 'M152 64L138 74L152 102L166 82Z' }, coat);
    svg('rect', { class: 'us-coat-belt', x: 32, y: 178, width: 156, height: 13, rx: 3 }, coat);
    svg('rect', { class: 'us-coat-buckle', x: 101, y: 175, width: 18, height: 19, rx: 3 }, coat);
    for (const [cx, cy] of [[96, 126], [124, 126], [96, 154], [124, 154], [96, 214], [124, 214]]) svg('circle', { class: 'us-coat-button', cx, cy, r: 3.6 }, coat);
    svg('path', { class: 'us-coat-pocket', d: 'M44 228h34M142 228h34' }, coat);
    svg('ellipse', { class: 'us-coat-shoe', cx: 86, cy: 291, rx: 17, ry: 7 }, coat);
    svg('ellipse', { class: 'us-coat-shoe', cx: 134, cy: 291, rx: 17, ry: 7 }, coat);
    const face = makeCard(0);
    face.classList.add('us-coat-card--face');
    const hat = svg('svg', { viewBox: '0 0 220 44', class: 'us-coat-hat-art' }, node);
    svg('path', { class: 'us-coat-hat', d: 'M74 34C73 12 86 4 110 4S147 12 146 34Z' }, hat);
    svg('path', { class: 'us-coat-hat-dent', d: 'M96 10Q110 18 124 10' }, hat);
    svg('rect', { class: 'us-coat-hatband', x: 75, y: 24, width: 70, height: 8 }, hat);
    svg('ellipse', { class: 'us-coat-hat-brim', cx: 110, cy: 35, rx: 64, ry: 7 }, hat);
    const cards = [face, ...hidden];
    cards.forEach((mini) => { mini.style.width = `${CARD_W}px`; });
    fx.pop(node, at, { from: 0.7 });
    if (splitAt !== undefined) {
      tween(coat, [{ opacity: 1, translate: '0 0', rotate: '0deg' }, { opacity: 0, translate: '0 160px', rotate: '6deg' }], splitAt, 0.55, EASE.in);
      tween(hat, [{ opacity: 1, translate: '0 0', rotate: '0deg' }, { opacity: 0, translate: '40px -50px', rotate: '-25deg' }], splitAt, 0.5, EASE.out);
      cards.forEach((mini, i) => {
        const left = row.x + i * (CARD_W + row.gap) - x;
        const top = row.y - y;
        const dx = left - lefts[i];
        const dy = top - tops[i];
        tween(mini, { translate: `${dx}px ${dy}px`, rotate: `${i % 2 ? 2 : -2}deg` }, splitAt + 0.2 + i * 0.08, 0.5, EASE.inOut);
      });
    }
    if (until !== undefined) fx.fadeOut(node, until);
    return { node, cards };
  }

  /** Crumb-sized cards that drift together and merge into one card. */
  function crumbs(parent, { x, y, at, mergeAt, until, texts, merged }) {
    const node = place(el('div', 'us-crumbs is-staged', parent), x, y);
    const spots = [[0, 10], [118, 0], [236, 18], [40, 78], [176, 86]];
    const bits = texts.map((text, i) => {
      const bit = el('div', 'us-crumb', node, text);
      const [cx, cy] = spots[i % spots.length];
      place(bit, cx, cy);
      bit.style.rotate = `${((i * 47) % 13) - 6}deg`;
      tween(bit, [{ translate: '0 0', opacity: 1 }, { translate: `${118 - cx}px ${44 - cy}px`, opacity: 0 }], mergeAt + i * 0.06, 0.45, EASE.inOut);
      return bit;
    });
    const whole = place(el('div', 'us-mini us-mini--paper us-crumbs-merged is-staged', node), 70, 30);
    whole.append(icon('check'));
    el('span', null, whole, merged);
    fx.pop(whole, mergeAt + 0.45, { from: 0.5 });
    fx.rise(node, at, { distance: 16 });
    if (until !== undefined) fx.fadeOut(node, until);
    return { node, bits, whole };
  }

  // ------------------------------------------------------------------
  // Testable: Given / When / Then panels that end in PASS
  // ------------------------------------------------------------------

  /** steps = [{ key: 'Given', text, at }], three in a row with arrows. */
  function gwt(parent, { x, y, w = 880, steps, at, until, passAt }) {
    const node = place(el('div', 'us-gwt is-staged', parent), x, y);
    node.style.width = `${w}px`;
    steps.forEach((step, i) => {
      if (i) {
        const arrow = el('span', 'us-gwt-arrow is-staged', node);
        arrow.append(icon('pointer'));
        fx.fadeIn(arrow, step.at - 0.1, 0.2);
      }
      const panel = el('div', `us-gwt-panel us-gwt-panel--${step.key.toLowerCase()} is-staged`, node);
      el('b', 'us-gwt-key', panel, step.key);
      el('span', 'us-gwt-text', panel, step.text);
      fx.pop(panel, step.at, { from: 0.7 });
    });
    fx.fadeIn(node, at, 0.2);
    if (passAt !== undefined) {
      const pass = el('div', 'us-gwt-pass is-staged', node);
      pass.append(icon('check'));
      el('span', null, pass, 'PASS');
      fx.slam(pass, passAt, { from: 2.2, rotate: -6 });
    }
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  // ------------------------------------------------------------------
  // The chorus: one big letter, its term, and its meaning
  // ------------------------------------------------------------------

  /** A centered panel: letter tile, term, and a short meaning with an icon. */
  function letterPanel(parent, { index, x = 0, y, at, until }) {
    const entry = LETTERS[index];
    const node = place(el('div', 'us-letter is-staged', parent), x, y);
    const tile = el('div', 'us-letter-tile', node, entry.letter);
    const words = el('div', 'us-letter-words', node);
    el('div', 'us-letter-term', words, entry.term);
    const meaning = el('div', 'us-letter-meaning', words);
    meaning.append(icon(entry.iconName));
    el('span', null, meaning, entry.meaning);
    fx.slam(tile, at, { from: 2.3, rotate: -4 });
    fx.fadeIn(node, at - 0.02, 0.1);
    if (until !== undefined) fx.exit(node, until, { dx: -40, duration: 0.22 });
    return { node, tile, meaning };
  }

  window.StoryKit = {
    LETTERS, card, miniCard, scanner, nameTag, commit, testBar, speech,
    cake, phone, appButton, deliveryMap, notification, dropdown, dial,
    sprintBox, trenchCoat, crumbs, gwt, letterPanel, latest,
  };
})();
