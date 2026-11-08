/*
 * Pattern kit for "Same Shape, Not the Same", the design patterns musical:
 * the show pieces the choreography places on the review stage
 * (js/song-video/review-stage.js), beside the ArchUML notation that
 * js/song-video/model-kit.js draws.
 *
 *   marquee()    lettering on the marquee board: each verse's pattern name;
 *   nameplate()  a glowing name plate over a singer;
 *   phone()      the Night Bites food app on a phone: toggles, an order
 *                tracker with its buttons and results, status chips;
 *   card()       a cream card with an optional title (signatures, rules);
 *   pr()         a pull request with a title that can be struck and
 *                retitled, a body for a diagram, a review comment, and stamps;
 *   review()     a review comment on its own card;
 *   diffBadge()  "checkout.py · 0 lines changed": a change stayed in one place;
 *   priceTag()   a hanging price tag: a pattern's cost, dropped on a rival;
 *   ooh()        the crowd's "Ooh!";
 *   roundCard()  a boxing-style "ROUND 1 · Strategy vs. State";
 *   verdict()    a ruling: two questions, each answered with a pattern name;
 *   quiz()       a live poll whose six answer cards stay up the whole quiz;
 *   devices(), picture(), gauge(), roadmap(), fileFan(), flipBadge():
 *                the pictures the verses, the bridge, and the quiz need.
 *
 * Every pose is a pure function of song time (Timeline tweens and frame
 * updaters). Coordinates are CSS pixels on the 960×540 stage; nothing
 * essential goes below y = 460, where the player draws captions. Styles:
 * css/song-video-pattern-kit.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, progress, easeInOutCubic } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, place } = kit;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** Shows a node from `at` (a pop by default) and, with `until`, hides it again. */
  function show(node, at, until, { how = 'pop', from = 0.7 } = {}) {
    if (how === 'rise') fx.rise(node, at, { distance: 18, duration: 0.4 });
    else if (how === 'fade') fx.fadeIn(node, at, 0.3);
    else if (how === 'slam') fx.slam(node, at, { from: 1.6 });
    else fx.pop(node, at, { from });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  // ------------------------------------------------------------------
  // Show lettering
  // ------------------------------------------------------------------

  /** The marquee's lettering (the room draws the board): one word or two, in bulb-lit gold. */
  function marquee(layer, text, { at, until }) {
    const { MARQUEE } = window.ReviewStage;
    const node = place(el('div', 'pk-marquee is-staged', layer, text), MARQUEE.x, MARQUEE.y);
    node.dataset.testid = 'song-marquee';
    node.style.width = `${MARQUEE.w}px`;
    node.style.height = `${MARQUEE.h}px`;
    tween(node, [{ opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1 }], at, 0.35, EASE.back);
    if (until !== undefined) fx.fadeOut(node, until - 0.2, 0.2);
    return node;
  }

  /** A name plate centred on x: the pattern's name, large and bright, over a singer. */
  function nameplate(layer, text, { x, y, at, until, tone = 'gold' }) {
    const node = el('div', `pk-plate pk-plate--${tone} is-staged`, layer, text);
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    tween(node, [{ opacity: 0, translate: '-50% -14px' }, { opacity: 1, translate: '-50% 0' }], at, 0.4, EASE.back);
    if (until !== undefined) tween(node, { opacity: 0, translate: '-50% -10px' }, until - 0.25, 0.25, EASE.in);
    node.style.translate = '-50% 0';
    return node;
  }

  // ------------------------------------------------------------------
  // Cards
  // ------------------------------------------------------------------

  function card(layer, { x, y, w, h, title, at, until, tone = 'cream', how = 'pop' }) {
    const node = place(el('div', `pk-card pk-card--${tone} is-staged`, layer), x, y);
    if (w !== undefined) node.style.width = `${w}px`;
    if (h !== undefined) node.style.height = `${h}px`;
    if (title) el('div', 'pk-card-title', node, title);
    const body = el('div', 'pk-card-body', node);
    show(node, at, until, { how });
    return { node, body };
  }

  /** A line of text (or code, with `code: true`) appearing inside a card or phone at `at`. */
  function row(parent, text, { at, until, tone, code = false, icon } = {}) {
    const node = el('div', `pk-row${tone ? ` pk-row--${tone}` : ''}${code ? ' pk-row--code' : ''} is-staged`, parent);
    if (icon) node.append(kit.icon(icon));
    if (code) kit.writeCode(el('span', '', node), kit.highlightPython(text));
    else node.append(document.createTextNode(text));
    show(node, at, until, { how: 'rise' });
    return node;
  }

  /** Strikes through a node from `at` (a line drawn across it). */
  function strike(node, at) {
    const line = el('span', 'pk-strike is-staged', node);
    tween(line, [{ opacity: 1, scale: '0 1' }, { opacity: 1, scale: '1 1' }], at, 0.25, EASE.out);
    return line;
  }

  // ------------------------------------------------------------------
  // The Night Bites app on a phone
  // ------------------------------------------------------------------

  function phone(layer, { x, y, at, until, title = 'Night Bites', w = 168, h = 300 }) {
    const node = place(el('div', 'pk-phone is-staged', layer), x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    el('div', 'pk-phone-notch', node);
    const screen = el('div', 'pk-phone-screen', node);
    const head = el('div', 'pk-phone-head', screen);
    const logo = svg('svg', { class: 'pk-phone-logo', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, head);
    svg('path', { d: 'M15.5 3.5a8.5 8.5 0 1 0 5 15.2A7 7 0 0 1 15.5 3.5z', class: 'pk-moon' }, logo);
    head.append(document.createTextNode(title));
    const body = el('div', 'pk-phone-body', screen);
    show(node, at, until, { how: 'rise' });
    return { node, body, screen, x, y, w, h };
  }

  /** A sheet title inside the phone. */
  function sheetTitle(app, text, { at, until } = {}) {
    return row(app.body, text, { at, until, tone: 'title' });
  }

  /**
   * Option toggles: one row each, appearing `every` seconds apart; the one at
   * index `pick` switches on at `pickAt` and the others off.
   */
  function toggles(app, names, { at, every = 0.35, pick, pickAt, until }) {
    return names.map((name, i) => {
      const node = el('div', 'pk-toggle is-staged', app.body);
      el('span', 'pk-toggle-label', node, name);
      const sw = el('span', 'pk-switch', node);
      el('span', 'pk-switch-knob', sw);
      show(node, at + i * every, until, { how: 'rise' });
      if (pickAt !== undefined && i === pick) {
        tween(sw, [{ background: '#c9c2b2' }, { background: '#2fbf71' }], pickAt, 0.2, EASE.out);
        tween(sw.firstChild, [{ translate: '0 0' }, { translate: '16px 0' }], pickAt, 0.2, EASE.out);
        tween(node, [{ boxShadow: '0 0 0 0 rgba(47,191,113,0)' }, { boxShadow: '0 0 0 3px rgba(47,191,113,0.55)' }], pickAt, 0.25, EASE.out);
      }
      return node;
    });
  }

  /**
   * An order tracker: stage names in a row with a light that sits on stage
   * `moves[i][1]` from time `moves[i][0]`.
   */
  function tracker(app, { stages, at, moves, until }) {
    const node = el('div', 'pk-tracker is-staged', app.body);
    const dots = stages.map((name, i) => {
      const step = el('div', 'pk-step', node);
      el('span', 'pk-step-dot', step);
      el('span', 'pk-step-label', step, name);
      if (i < stages.length - 1) el('span', 'pk-step-bar', node);
      return step;
    });
    show(node, at, until, { how: 'rise' });
    const ordered = [...moves].sort((a, b) => a[0] - b[0]);
    onFrame((t) => {
      let current = -1;
      for (const [time, index] of ordered) if (t >= time) current = index;
      dots.forEach((dot, i) => {
        dot.classList.toggle('is-current', i === current);
        dot.classList.toggle('is-done', i < current);
      });
    });
    return node;
  }

  /**
   * App buttons that light up one after another, in a row that wraps;
   * `row` adds them to the row of an earlier call's buttons.
   */
  function buttons(app, names, { at, every = 0.25, until, tone = 'cream', row }) {
    const wrap = row || el('div', 'pk-buttons', app.body);
    return names.map((name, i) => {
      const node = el('span', `pk-button pk-button--${tone} is-staged`, wrap, name);
      show(node, at + i * every, until);
      return node;
    });
  }

  /** A result chip under a button (a refund, "Too late"), replaced in place by later results. */
  function results(app, steps, { until, label = '' } = {}) {
    const node = el('div', 'pk-result is-staged', app.body);
    if (label) el('span', 'pk-result-label', node, label);
    const value = el('span', 'pk-result-value', node);
    fx.fadeIn(node, steps[0].at, 0.2);
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    const ordered = [...steps].sort((a, b) => a.at - b.at);
    onFrame((t) => {
      let current = null;
      for (const step of ordered) if (t >= step.at) current = step;
      const text = current ? current.text : '';
      if (value.textContent !== text) value.textContent = text;
      node.dataset.tone = current?.tone || '';
    });
    return node;
  }

  /** A status chip that flips text at `flipAt`. */
  function status(app, { at, from, to, flipAt, until }) {
    const node = el('div', 'pk-status is-staged', app.body);
    el('span', 'pk-status-label', node, 'Status');
    const value = el('span', 'pk-status-value', node);
    show(node, at, until, { how: 'rise' });
    onFrame((t) => {
      const text = t >= flipAt ? to : from;
      if (value.textContent !== text) value.textContent = text;
      node.classList.toggle('is-flipped', t >= flipAt);
    });
    if (flipAt !== undefined) fx.bump(node, flipAt, 0.12);
    return node;
  }

  // ------------------------------------------------------------------
  // The pull request
  // ------------------------------------------------------------------

  /**
   * A pull request card: "PR #n" and a title made of `parts` (strings);
   * strike(i, at) crosses out part i and swap(i, text, at) writes a new part
   * in its place. `body` holds a diagram; comment() adds a review comment.
   */
  function pr(layer, { x, y, w, number = 1, parts, at, until, author = 'intern' }) {
    const node = place(el('div', 'pk-pr is-staged', layer), x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'pk-pr-head', node);
    el('span', 'pk-pr-open', head, 'Open');
    el('span', 'pk-pr-number', head, `#${number}`);
    el('span', 'pk-pr-author', head, `by ${author}`);
    const title = el('div', 'pk-pr-title', node);
    const spans = parts.map((text) => el('span', 'pk-pr-part', title, text));
    const body = el('div', 'pk-pr-body', node);
    show(node, at, until, { how: 'rise' });
    return {
      node, body, title,
      strike(i, time) { return strike(spans[i], time); },
      swap(i, text, time) {
        const next = el('span', 'pk-pr-part pk-pr-part--new is-staged', title, text);
        spans[i].after(next);
        tween(spans[i], [{ opacity: 1 }, { opacity: 0 }], time, 0.2, EASE.in);
        tween(spans[i], { fontSize: '0px', marginRight: '0px' }, time + 0.2, 0.01);
        fx.pop(next, time + 0.15, { from: 0.6 });
        return next;
      },
      comment(text, { at: time, until: end, who = 'Lead', cps = 26 }) {
        const box = el('div', 'pk-comment is-staged', node);
        const avatar = el('span', 'pk-comment-avatar', box, who[0]);
        avatar.setAttribute('aria-hidden', 'true');
        const words = el('div', 'pk-comment-words', box);
        el('span', 'pk-comment-who', words, who);
        const said = el('span', 'pk-comment-text', words, text);
        fx.rise(box, time, { distance: 10, duration: 0.3 });
        kit.typewriter(said, text, time + 0.25, cps);
        if (end !== undefined) fx.fadeOut(box, end, 0.25);
        return box;
      },
    };
  }

  /**
   * A review comment on its own card, large enough to read across the
   * room: who wrote it, then its lines, each rising at its own time.
   */
  function review(layer, { x, y, w, who = 'Lead', lines, at, until }) {
    const node = place(el('div', 'pk-review is-staged', layer), x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'pk-review-head', node);
    el('span', 'pk-comment-avatar', head, who[0]).setAttribute('aria-hidden', 'true');
    el('span', 'pk-comment-who', head, `${who} commented`);
    for (const entry of lines) row(node, entry.text, { at: entry.at, tone: entry.tone });
    show(node, at, until, { how: 'rise' });
    return node;
  }

  // ------------------------------------------------------------------
  // Show cards: badges, price tags, reactions, rounds, verdicts
  // ------------------------------------------------------------------

  /** A green badge: a change stayed in one place. */
  function diffBadge(layer, text, { x, y, at, until }) {
    const node = place(el('div', 'pk-diff is-staged', layer), x, y);
    el('span', 'pk-diff-sign', node, '±0');
    node.append(document.createTextNode(text));
    fx.slam(node, at, { from: 1.4 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /** A price tag that drops on a string and swings to rest: a pattern's cost. */
  function priceTag(layer, text, { x, y, at, until, rotate = -6 }) {
    const node = place(el('div', 'pk-tag is-staged', layer), x, y);
    el('span', 'pk-tag-string', node);
    const tag = el('div', 'pk-tag-card', node);
    el('span', 'pk-tag-hole', tag);
    el('span', 'pk-tag-price', tag, 'Price');
    el('span', 'pk-tag-text', tag, text);
    tween(node, [{ opacity: 0, translate: '0 -60px' }, { opacity: 1, translate: '0 0' }], at, 0.35, EASE.in);
    if (reducedMotion.matches) node.style.rotate = `${rotate}deg`;
    else {
      onFrame((t) => {
        const age = t - at;
        const swing = age < 0 ? 0 : 14 * Math.exp(-age * 2.4) * Math.cos(age * 9);
        node.style.rotate = `${(rotate + swing).toFixed(2)}deg`;
      });
    }
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  /** The crowd's "Ooh!": a starburst that pops beside a roast. */
  function ooh(layer, { x, y, at, until }) {
    const node = place(el('div', 'pk-ooh is-staged', layer, 'Ooh!'), x, y);
    fx.pop(node, at, { from: 0.3, rotate: -8 });
    fx.popOut(node, until ?? at + 1.6);
    return node;
  }

  /** "ROUND n" and "A vs. B" across the screen. */
  function roundCard(layer, { n, a, b, at, until }) {
    const { SCREEN } = window.ReviewStage;
    const node = place(el('div', 'pk-round is-staged', layer), SCREEN.x + 44, SCREEN.y + 50);
    node.style.width = `${SCREEN.w - 88}px`;
    el('div', 'pk-round-label', node, `Round ${n}`);
    const vs = el('div', 'pk-round-vs', node);
    el('span', 'pk-round-name', vs, a);
    el('span', 'pk-round-versus', vs, 'vs.');
    el('span', 'pk-round-name', vs, b);
    fx.slam(node, at, { from: 1.8 });
    if (until !== undefined) fx.exit(node, until, { dx: 0, dy: -20 });
    return node;
  }

  /**
   * A ruling: a title and two halves, each a question that fills in at its
   * `ask` time and a pattern name that slams in at its `at` (the crowd's
   * shout). footer(text, at) adds a line under both halves.
   */
  function verdict(layer, { x, y, w, title = 'The ruling', left, right, at, until }) {
    const node = place(el('div', 'pk-verdict is-staged', layer), x, y);
    node.style.width = `${w}px`;
    el('div', 'pk-verdict-title', node, title);
    const halves = el('div', 'pk-verdict-halves', node);
    for (const half of [left, right]) {
      const box = el('div', 'pk-verdict-half', halves);
      const q = el('div', 'pk-verdict-q is-staged', box, half.q);
      fx.rise(q, half.ask ?? at, { distance: 10 });
      const name = el('div', 'pk-verdict-name is-staged', box, half.name);
      fx.slam(name, half.at, { from: 1.8 });
    }
    show(node, at, until, { how: 'rise' });
    return {
      node,
      footer(text, time, { tone = 'gold' } = {}) {
        const line = el('div', `pk-verdict-footer pk-verdict-footer--${tone} is-staged`, node, text);
        fx.rise(line, time, { distance: 8 });
        return line;
      },
    };
  }

  // ------------------------------------------------------------------
  // The pop quiz: six answer cards that never leave
  // ------------------------------------------------------------------

  /**
   * A live poll on the screen. `options` stay on screen from `at` to `until`.
   * ask(n, total, text, { at, until }) shows a question card with a picture
   * area (returned as `art`); light(name, { at, until, reason }) lights an
   * answer card and writes its reason under it.
   */
  function quiz(layer, { options, at, until, introEvery = 0, times }) {
    const { SCREEN } = window.ReviewStage;
    const board = place(el('div', 'pk-quiz is-staged', layer), SCREEN.x, SCREEN.y);
    board.style.width = `${SCREEN.w}px`;
    board.style.height = `${SCREEN.h}px`;
    fx.fadeIn(board, at, 0.3);
    if (until !== undefined) fx.fadeOut(board, until, 0.3);
    const stage = el('div', 'pk-quiz-stage', board);
    const strip = el('div', 'pk-quiz-options', board);
    const cards = Object.fromEntries(options.map((name, i) => {
      const chip = el('div', 'pk-quiz-option is-staged', strip);
      chip.dataset.testid = 'song-quiz-option';
      el('span', 'pk-quiz-option-name', chip, name);
      const reason = el('span', 'pk-quiz-option-reason', chip);
      const said = el('span', 'pk-quiz-said', reason);
      fx.pop(chip, times ? times[i] : at + i * introEvery, { from: 0.6 });
      // A card holds only the reason it shows now: [from, to, text] spans.
      const lit = [];
      onFrame((t) => {
        const now = lit.find(([from, to]) => t >= from && (to === undefined || t < to));
        const text = now ? now[2] : '';
        if (said.textContent !== text) said.textContent = text;
        said.style.opacity = now ? progress(t, now[0], 0.2).toFixed(3) : '0';
      });
      return [name, { chip, lit }];
    }));
    return {
      board,
      ask(n, total, text, { at: time, until: end }) {
        const q = el('div', 'pk-quiz-card is-staged', stage);
        el('div', 'pk-quiz-count', q, `Question ${n} of ${total}`);
        el('div', 'pk-quiz-text', q, text);
        const art = el('div', 'pk-quiz-art', q);
        fx.rise(q, time, { distance: 16 });
        if (end !== undefined) fx.fadeOut(q, end, 0.2);
        return { node: q, art };
      },
      light(name, { at: time, until: end, reason }) {
        const { chip, lit } = cards[name];
        lit.push([time + 0.1, end, reason]);
        tween(chip, [{ background: '#fff7e2', transform: 'scale(1)' }, { background: '#ffd66e', transform: 'scale(1.06)' }], time, 0.25, EASE.back);
        if (end !== undefined) tween(chip, { background: '#fff7e2', transform: 'scale(1)' }, end, 0.25, EASE.inOut);
        return chip;
      },
    };
  }

  // ------------------------------------------------------------------
  // Pictures
  // ------------------------------------------------------------------

  const DEVICE_ART = {
    phone: (g) => {
      svg('rect', { x: 9, y: 2, width: 18, height: 32, rx: 4, class: 'pk-dev-body' }, g);
      svg('rect', { x: 11.5, y: 6, width: 13, height: 22, rx: 1.5, class: 'pk-dev-screen' }, g);
    },
    tablet: (g) => {
      svg('rect', { x: 2, y: 6, width: 32, height: 24, rx: 3, class: 'pk-dev-body' }, g);
      svg('rect', { x: 5, y: 9, width: 26, height: 18, rx: 1.5, class: 'pk-dev-screen' }, g);
    },
    driver: (g) => {
      svg('circle', { cx: 9, cy: 27, r: 5, class: 'pk-dev-wheel' }, g);
      svg('circle', { cx: 28, cy: 27, r: 5, class: 'pk-dev-wheel' }, g);
      svg('path', { d: 'M9 27 L15 14 H24 L28 27 M15 14 L13 8 H18', class: 'pk-dev-frame' }, g);
      svg('rect', { x: 18, y: 6, width: 11, height: 9, rx: 1.5, class: 'pk-dev-box' }, g);
    },
    watch: (g) => {
      svg('rect', { x: 13, y: 2, width: 10, height: 32, rx: 3, class: 'pk-dev-strap' }, g);
      svg('rect', { x: 9, y: 9, width: 18, height: 18, rx: 5, class: 'pk-dev-body' }, g);
      svg('rect', { x: 11.5, y: 11.5, width: 13, height: 13, rx: 3, class: 'pk-dev-screen' }, g);
    },
    kitchen: (g) => {
      svg('path', { d: 'M6 26 H30 M8 26 a10 10 0 0 1 20 0', class: 'pk-dev-frame' }, g);
      svg('circle', { cx: 18, cy: 13, r: 2, class: 'pk-dev-box' }, g);
    },
    customer: (g) => {
      svg('circle', { cx: 18, cy: 11, r: 6, class: 'pk-dev-body' }, g);
      svg('path', { d: 'M6 32 c2-9 22-9 24 0 Z', class: 'pk-dev-body' }, g);
    },
  };

  /**
   * Labelled device icons in a row: [{ kind, label, tag, at, react, reactAt }].
   * Returns their stage centres, for pings drawn between them.
   */
  function devices(layer, items, { x, y, gap = 92, size = 54, until }) {
    return items.map((item, i) => {
      const node = place(el('div', 'pk-device is-staged', layer), x + i * gap, y);
      node.style.width = `${size + 30}px`;
      const art = svg('svg', { class: 'pk-device-art', viewBox: '0 0 36 36', width: size, height: size, 'aria-hidden': 'true' }, node);
      DEVICE_ART[item.kind](art);
      el('span', 'pk-device-label', node, item.label);
      if (item.tag) {
        const tag = el('span', 'pk-device-tag is-staged', node, item.tag);
        fx.pop(tag, item.tagAt ?? item.at + 0.2, { from: 0.5 });
      }
      if (item.react) {
        const react = el('span', `pk-device-react pk-device-react--${item.reactTone || 'gold'} is-staged`, node, item.react);
        fx.pop(react, item.reactAt, { from: 0.4 });
        if (item.reactUntil !== undefined) fx.fadeOut(react, item.reactUntil, 0.2);
      }
      show(node, item.at, until);
      return { node, center: [x + i * gap + (size + 30) / 2, y + size / 2] };
    });
  }

  /** A row of small pictograms for the quiz cards, drawn into `art`. */
  const PICTURES = {
    plug(art, { answerAt }) {
      const s = svg('svg', { viewBox: '0 0 220 90', width: 220, height: 90, 'aria-hidden': 'true' }, art);
      const plug = svg('g', { class: 'pk-pic-ink' }, s);
      svg('rect', { x: 18, y: 30, width: 46, height: 30, rx: 6 }, plug);
      svg('path', { d: 'M64 38 H80 M64 52 H80' }, plug);
      svg('text', { x: 41, y: 82, class: 'pk-pic-label' }, plug).textContent = 'charge()';
      const socket = svg('g', { class: 'pk-pic-ink' }, s);
      svg('rect', { x: 140, y: 22, width: 62, height: 46, rx: 8 }, socket);
      svg('circle', { cx: 160, cy: 45, r: 5 }, socket);
      svg('circle', { cx: 182, cy: 45, r: 5 }, socket);
      svg('text', { x: 171, y: 84, class: 'pk-pic-label' }, socket).textContent = 'SDK';
      const fit = svg('g', { class: 'pk-pic-good is-staged' }, s);
      svg('rect', { x: 92, y: 32, width: 34, height: 26, rx: 5 }, fit);
      fx.pop(fit, answerAt, { from: 0.5 });
    },
    hero(art, { at }) {
      const s = svg('svg', { viewBox: '0 0 240 100', width: 240, height: 100, 'aria-hidden': 'true' }, art);
      const big = svg('g', { class: 'pk-pic-ink' }, s);
      svg('rect', { x: 20, y: 14, width: 30, height: 60, rx: 10 }, big);
      svg('text', { x: 35, y: 92, class: 'pk-pic-label' }, big).textContent = 'big';
      svg('path', { d: 'M60 44 H92', class: 'pk-pic-arrow' }, s);
      svg('text', { x: 76, y: 36, class: 'pk-pic-label' }, s).textContent = 'hit';
      const small = svg('g', { class: 'pk-pic-ink is-staged' }, s);
      svg('rect', { x: 104, y: 44, width: 22, height: 30, rx: 8 }, small);
      svg('text', { x: 115, y: 92, class: 'pk-pic-label' }, small).textContent = 'small';
      fx.pop(small, at + 0.9, { from: 0.5 });
      const arrow2 = svg('g', { class: 'is-staged' }, s);
      svg('path', { d: 'M136 58 H168', class: 'pk-pic-arrow' }, arrow2);
      svg('text', { x: 152, y: 50, class: 'pk-pic-label' }, arrow2).textContent = 'hit';
      fx.fadeIn(arrow2, at + 1.6, 0.2);
      const out = svg('text', { x: 205, y: 64, class: 'pk-pic-out is-staged' }, s);
      out.textContent = 'OUT';
      fx.pop(out, at + 2, { from: 0.5 });
    },
    stocks(art, { at }) {
      const s = svg('svg', { viewBox: '0 0 300 90', width: 300, height: 90, 'aria-hidden': 'true' }, art);
      const price = svg('path', { d: 'M10 70 L40 60 L60 64 L90 36 L110 22', class: 'pk-pic-line', pathLength: 1 }, s);
      fx.draw(price, at, 0.6);
      const labels = [['chart', 140], ['alert', 202], ['watchlist', 262]];
      labels.forEach(([name, x], i) => {
        const g = svg('g', { class: 'pk-pic-ink is-staged' }, s);
        svg('rect', { x: x - 20, y: 24, width: 40, height: 30, rx: 5 }, g);
        svg('text', { x, y: 74, class: 'pk-pic-label' }, g).textContent = name;
        fx.pop(g, at + 0.6 + i * 0.3, { from: 0.6 });
      });
    },
    routes(art, { at }) {
      // Each name sits clear of every route: above the top arc, in the gap
      // over the straight road, and under the bottom arc.
      const s = svg('svg', { viewBox: '0 0 240 100', width: 240, height: 100, 'aria-hidden': 'true' }, art);
      svg('circle', { cx: 18, cy: 50, r: 7, class: 'pk-pic-dot' }, s);
      svg('circle', { cx: 222, cy: 50, r: 7, class: 'pk-pic-dot' }, s);
      [['M24 50 C80 13 160 13 216 50', 'fastest'], ['M24 50 L216 50', 'shortest'], ['M24 50 C80 87 160 87 216 50', 'no tolls']].forEach(([d, name], i) => {
        const p = svg('path', { d, class: `pk-pic-route pk-pic-route--${i}`, pathLength: 1 }, s);
        fx.draw(p, at + i * 0.35, 0.5);
        const label = svg('text', { x: 120, y: [14, 43, 96][i], class: 'pk-pic-label is-staged' }, s);
        label.textContent = name;
        fx.fadeIn(label, at + i * 0.35 + 0.3, 0.2);
      });
    },
    planes(art, { at, answerAt }) {
      const s = svg('svg', { viewBox: '0 0 240 90', width: 240, height: 90, 'aria-hidden': 'true' }, art);
      svg('rect', { x: 60, y: 70, width: 120, height: 8, rx: 2, class: 'pk-pic-ink' }, s);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const x = 120 + 96 * Math.cos(a);
        const y = 36 + 26 * Math.sin(a);
        const plane = svg('path', { d: `M${x - 6} ${y} L${x + 6} ${y} M${x} ${y - 4} L${x} ${y + 4}`, class: 'pk-pic-plane is-staged' }, s);
        fx.fadeIn(plane, at + i * 0.08, 0.2);
      }
      const tower = svg('g', { class: 'pk-pic-good is-staged' }, s);
      svg('path', { d: 'M114 70 L116 40 H124 L126 70 Z' }, tower);
      svg('rect', { x: 110, y: 30, width: 20, height: 10, rx: 2 }, tower);
      fx.pop(tower, answerAt, { from: 0.4 });
    },
    booking(art, { at, answerAt }) {
      // Three screens each wired to all three services; on the answer the
      // tangle fades and one Book door stands between them.
      const s = svg('svg', { viewBox: '0 0 300 100', width: 300, height: 100, 'aria-hidden': 'true' }, art);
      const rows = [18, 50, 82];
      const tangle = svg('g', { class: 'is-staged' }, s);
      for (const y of rows) {
        for (const ty of rows) svg('path', { d: `M62 ${y} C130 ${y} 170 ${ty} 232 ${ty}`, class: 'pk-pic-wire' }, tangle);
      }
      fx.fadeIn(tangle, at, 0.3);
      tween(tangle, [{ opacity: 1 }, { opacity: 0.12 }], answerAt, 0.3, EASE.inOut);
      const simple = svg('g', { class: 'is-staged' }, s);
      for (const y of rows) {
        svg('path', { d: `M62 ${y} C96 ${y} 100 50 128 50`, class: 'pk-pic-wire' }, simple);
        svg('path', { d: `M172 50 C200 50 204 ${y} 232 ${y}`, class: 'pk-pic-wire' }, simple);
      }
      fx.fadeIn(simple, answerAt + 0.1, 0.3);
      rows.forEach((y, i) => {
        svg('rect', { x: 6, y: y - 12, width: 56, height: 24, rx: 5, class: 'pk-pic-ink' }, s);
        svg('text', { x: 34, y: y + 5, class: 'pk-pic-label' }, s).textContent = ['App', 'Web', 'Kiosk'][i];
        svg('rect', { x: 232, y: y - 12, width: 62, height: 24, rx: 5, class: 'pk-pic-ink' }, s);
        svg('text', { x: 263, y: y + 5, class: 'pk-pic-label' }, s).textContent = ['Flight', 'Hotel', 'Car'][i];
      });
      const door = svg('g', { class: 'pk-pic-good is-staged' }, s);
      svg('rect', { x: 128, y: 30, width: 44, height: 40, rx: 6 }, door);
      svg('text', { x: 150, y: 55, class: 'pk-pic-label pk-pic-label--door' }, door).textContent = 'Book';
      fx.pop(door, answerAt, { from: 0.5 });
    },
  };

  function picture(art, kind, options) {
    PICTURES[kind](art, options);
    return art;
  }

  /** A semicircle gauge whose needle swings to `peak` at `peakAt` and back by `backAt`. */
  function gauge(layer, { x, y, label, at, peakAt, backAt, until }) {
    const node = place(el('div', 'pk-gauge is-staged', layer), x, y);
    const s = svg('svg', { viewBox: '0 0 120 70', width: 150, height: 88, 'aria-hidden': 'true' }, node);
    svg('path', { d: 'M12 62 A48 48 0 0 1 108 62', class: 'pk-gauge-arc' }, s);
    svg('path', { d: 'M84 24 A48 48 0 0 1 108 62', class: 'pk-gauge-red' }, s);
    const needle = svg('path', { d: 'M60 62 L60 20', class: 'pk-gauge-needle' }, s);
    svg('circle', { cx: 60, cy: 62, r: 5, class: 'pk-gauge-hub' }, s);
    el('div', 'pk-gauge-label', node, label);
    show(node, at, until);
    onFrame((t) => {
      const up = easeInOutCubic(progress(t, peakAt, 0.5));
      const down = backAt === undefined ? 0 : easeInOutCubic(progress(t, backAt, 0.6));
      const angle = -70 + 145 * up - 100 * down;
      needle.setAttribute('transform', `rotate(${angle.toFixed(1)} 60 62)`);
    });
    return node;
  }

  /** A roadmap card: lanes of tickets; a lane given `crossAt` is greyed and struck. */
  function roadmap(layer, { x, y, w, lanes, at, until }) {
    const { node, body } = card(layer, { x, y, w, title: 'Roadmap', at, until });
    for (const lane of lanes) {
      const r = el('div', 'pk-lane', body);
      el('span', 'pk-lane-name', r, lane.name);
      const tickets = el('span', 'pk-lane-tickets', r);
      for (const t of lane.tickets) el('span', 'pk-lane-ticket', tickets, t);
      if (lane.crossAt !== undefined) {
        tween(r, [{ opacity: 1 }, { opacity: 0.45 }], lane.crossAt, 0.3, EASE.inOut);
        strike(r, lane.crossAt);
      }
    }
    return node;
  }

  /** A change ticket that fans out into one file card after another. */
  function fileFan(layer, { x, y, files, at, every = 0.3, until }) {
    const wrap = place(el('div', 'pk-fan is-staged', layer), x, y);
    const ticket = el('div', 'pk-fan-ticket', wrap, 'Change');
    fx.pop(ticket, at, { from: 0.5 });
    files.forEach((name, i) => {
      const f = el('div', 'pk-fan-file is-staged', wrap, name);
      f.style.left = `${120 + (i % 3) * 112}px`;
      f.style.top = `${Math.floor(i / 3) * 44}px`;
      fx.pop(f, at + 0.3 + i * every, { from: 0.5 });
    });
    show(wrap, at, until, { how: 'fade' });
    return wrap;
  }

  /** A badge that flips over at `flipAt` from its front text to its back. */
  function flipBadge(layer, { x, y, front, back, at, flipAt, until }) {
    const node = place(el('div', 'pk-flip is-staged', layer), x, y);
    const a = el('div', 'pk-flip-face', node, front);
    const b = el('div', 'pk-flip-face pk-flip-face--back', node, back);
    show(node, at, until);
    tween(a, [{ rotate: 'x 0deg' }, { rotate: 'x 90deg' }], flipAt, 0.2, EASE.in);
    tween(b, [{ rotate: 'x -90deg' }, { rotate: 'x 0deg' }], flipAt + 0.2, 0.25, EASE.out);
    return node;
  }

  window.PatternKit = {
    marquee, nameplate, card, row, strike, phone, sheetTitle, toggles, tracker, buttons, results, status,
    pr, review, diffBadge, priceTag, ooh, roundCard, verdict, quiz, devices, picture, gauge, roadmap, fileFan, flipBadge,
  };
})();
