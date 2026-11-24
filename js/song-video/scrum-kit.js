/*
 * Scrum kit for "Inspect and Adapt", the Scrum musical
 * (storyboard: _data/songs/inspect_and_adapt.yml): the Scrum pieces the
 * choreography places in the team's office (js/song-video/team-room.js),
 * beside the cream cards and rows of js/song-video/pattern-kit.js.
 *
 *   strip()       the Sprint strip: a frame named Sprint holding its four
 *                 events in order, each lit while it is sung, and the arrow
 *                 back to the start for the next Sprint;
 *   board()       the Scrum board: Product Backlog, Sprint Backlog, and
 *                 Increment columns whose cards appear, move, swell, split,
 *                 and lock;
 *   checklist()   a titled list whose boxes are ticked or crossed on cue
 *                 (acceptance criteria, the Definition of Done);
 *   quiz()        a numbered question card whose answer bar slams in;
 *   wallet(), team(), orgChart(), stopwatch(), wall(), person(), speech(),
 *   sticky(), stopSign(), timeline():
 *                 the pictures the verses need.
 *
 * Every pose is a pure function of song time (Timeline tweens and frame
 * updaters). Coordinates are CSS pixels on the 960×540 stage; nothing
 * essential goes below y = 460, where the player draws captions. Every
 * meaning is written in words; colour only repeats them (WCAG 1.4.1).
 * Styles: css/song-video-scrum-kit.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, progress } = window.Timeline;
  const kit = window.SongKit;
  const P = window.PatternKit;
  const { el, svg, place } = kit;

  /** Shows a node from `at` and, with `until`, hides it again. */
  function show(node, at, until, how = 'pop') {
    if (how === 'rise') fx.rise(node, at, { distance: 16, duration: 0.4 });
    else if (how === 'fade') fx.fadeIn(node, at, 0.3);
    else if (how === 'slam') fx.slam(node, at, { from: 1.8 });
    else fx.pop(node, at, { from: 0.7 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  /** An absolutely placed box of the kit's own, `w` wide (and `h` high). */
  function box(layer, className, { x, y, w, h }) {
    const node = place(el('div', `${className} is-staged`, layer), x, y);
    if (w !== undefined) node.style.width = `${w}px`;
    if (h !== undefined) node.style.height = `${h}px`;
    return node;
  }

  /** A highlight that is on between `from` and `to` (a gold ring and glow over its parent). */
  function lit(parent, from, to, className = 'sk-lit') {
    const ring = el('span', `${className} is-staged`, parent);
    fx.fadeIn(ring, from, 0.25);
    if (to !== undefined) fx.fadeOut(ring, to - 0.25, 0.25);
    return ring;
  }

  // ------------------------------------------------------------------
  // The Sprint strip
  // ------------------------------------------------------------------

  const EVENTS = [
    // Each event's icon: the goal it sets, the loop it repeats every day,
    // the product it shows, the team it looks back on.
    { id: 'planning', name: 'Sprint Planning', icon: 'target' },
    { id: 'daily', name: 'Daily Scrum', icon: 'resend' },
    { id: 'review', name: 'Sprint Review', icon: 'eye' },
    { id: 'retro', name: 'Sprint Retrospective', icon: 'team' },
  ];

  /**
   * The Sprint strip: the frame's name, its four events left to right, and
   * the arrow from the last back to the first. light(id, from, to) lights an
   * event (the marquee names it); frame(from, to) lights the frame; loop(from, to)
   * lights the arrow back; label(text, at) and rename(text, at) set the
   * frame's caption and name.
   */
  function strip(layer, { x, y, w, h, at, until, name = 'Sprint' }) {
    const node = show(box(layer, 'sk-strip', { x, y, w, h }), at, until, 'fade');
    const head = el('div', 'sk-strip-head', node);
    const title = el('span', 'sk-strip-name', head, name);
    const caption = el('span', 'sk-strip-caption', head);
    const row = el('div', 'sk-strip-row', node);
    const events = {};
    EVENTS.forEach((event, i) => {
      if (i) el('span', 'sk-strip-arrow', row, '→');
      const cell = el('div', 'sk-event', row);
      const name = el('span', 'sk-event-name', cell);
      name.append(kit.icon(event.icon), document.createTextNode(event.name));
      events[event.id] = cell;
    });
    const back = el('div', 'sk-strip-back', node);
    el('span', 'sk-strip-back-label', back, 'next Sprint ↺');
    return {
      node,
      light(id, from, to) { lit(events[id], from, to, 'sk-lit sk-lit--event'); },
      frame(from, to) { lit(node, from, to, 'sk-lit sk-lit--frame'); },
      loop(from, to) { lit(back, from, to, 'sk-lit sk-lit--loop'); },
      label(text, labelAt) { show(el('span', 'sk-strip-label', caption, text), labelAt, undefined, 'rise'); },
      rename(text, renameAt) {
        tween(title, [{ opacity: 1 }, { opacity: 0 }], renameAt - 0.2, 0.2);
        const next = el('span', 'sk-strip-name sk-strip-name--next is-staged', head, text);
        head.insertBefore(next, caption);
        fx.pop(next, renameAt);
      },
    };
  }

  // ------------------------------------------------------------------
  // The Scrum board
  // ------------------------------------------------------------------

  const COLUMNS = [['Product Backlog', 'list'], ['Sprint Backlog', 'target'], ['Increment', 'box']];

  /**
   * The Scrum board: three columns of three one-line card slots each,
   * drawn empty under the cards.
   * card(id, text, { column, slot, at, tone }) adds a card;
   * move(id, { column, slot, at }) slides it to another slot; swell(id, at)
   * doubles it for a moment; lock(id, at) closes a padlock on it;
   * progress(id, from, to, amount) fills a bar along a card's foot;
   * column(i, from, to) lights a column; stack(text, at) adds a block to the
   * Increment; bar(text, at, until) shows a line of explanation under the
   * board.
   */
  function board(layer, { x, y, w, h, at, until, barY }) {
    const node = show(box(layer, 'sk-board', { x, y, w, h }), at, until, 'fade');
    const gap = 8;
    const colW = (w - 2 * gap) / 3;
    const cardW = colW - 12;
    const cardH = (h - 30 - 12) / 3;
    const columns = COLUMNS.map(([name, icon], i) => {
      const col = place(el('div', 'sk-column', node), i * (colW + gap), 0);
      col.style.width = `${colW}px`;
      col.style.height = `${h}px`;
      el('div', 'sk-column-title', col).append(kit.icon(icon), document.createTextNode(name));
      return col;
    });
    const slotXY = (column, slot) => [column * (colW + gap) + 6, 28 + slot * (cardH + 4)];
    // Empty slots under the cards, so an empty column still reads as a
    // place for them.
    columns.forEach((_, column) => {
      for (let slot = 0; slot < 3; slot++) {
        const hole = place(el('div', 'sk-slot', node), ...slotXY(column, slot));
        hole.style.width = `${cardW}px`;
        hole.style.height = `${cardH}px`;
      }
    });
    const cards = {};
    let blocks = 0;

    return {
      node,
      card(id, text, { column, slot, at: cardAt, until: cardUntil, tone = 'story', icon }) {
        const [cx, cy] = slotXY(column, slot);
        const card = place(el('div', `sk-card sk-card--${tone} is-staged`, node), cx, cy);
        if (icon) card.append(kit.icon(icon));
        card.append(document.createTextNode(text));
        card.style.width = `${cardW}px`;
        card.style.height = `${cardH}px`;
        show(card, cardAt, cardUntil);
        cards[id] = { node: card, home: [cx, cy] };
        return card;
      },
      move(id, { column, slot, at: moveAt }) {
        const { node: card, home } = cards[id];
        const [tx, ty] = slotXY(column, slot);
        fx.moveTo(card, moveAt, tx - home[0], ty - home[1], 0.6);
      },
      swell(id, swellAt, back) {
        const card = cards[id].node;
        tween(card, [{ scale: 1 }, { scale: 1.9 }], swellAt, 0.4, EASE.back);
        if (back !== undefined) tween(card, { scale: 1 }, back, 0.3, EASE.inOut);
      },
      lock(id, lockAt) {
        const lock = el('span', 'sk-lock is-staged', cards[id].node);
        lock.append(kit.icon('lock'));
        fx.slam(lock, lockAt, { from: 2 });
      },
      fade(id, fadeAt) { fx.fadeOut(cards[id].node, fadeAt, 0.3); },
      progress(id, from, to, amount) {
        const fill = el('span', 'sk-progress', el('span', 'sk-progress-track', cards[id].node));
        tween(fill, [{ scale: '0 1' }, { scale: `${amount} 1` }], from, to - from, EASE.inOut);
      },
      column(index, from, to) { lit(columns[index], from, to); },
      tasks(id, tasksAt, count = 3) {
        const row = el('span', 'sk-tasks', cards[id].node);
        for (let i = 0; i < count; i++) fx.pop(el('span', 'sk-task is-staged', row), tasksAt + i * 0.15);
      },
      stack(text, stackAt) {
        const [cx] = slotXY(2, 0);
        const block = place(el('div', 'sk-block is-staged', node, text), cx, h - 6 - cardH - blocks * (cardH + 4));
        block.style.width = `${cardW}px`;
        block.style.height = `${cardH}px`;
        block.style.lineHeight = `${cardH}px`;
        fx.rise(block, stackAt, { distance: -60, duration: 0.5 });
        blocks += 1;
        return block;
      },
      bar(text, barAt, barUntil, icon) {
        const node2 = box(layer, 'sk-bar', { x, y: barY ?? y + h + 4, w });
        if (icon) el('span', 'sk-bar-emblem', node2).append(kit.icon(icon));
        node2.append(document.createTextNode(text));
        return show(node2, barAt, barUntil, 'rise');
      },
    };
  }

  // ------------------------------------------------------------------
  // Checklists and the quiz card
  // ------------------------------------------------------------------

  /**
   * A titled list: items = [{ text, at, mark: 'check' | 'cross' }]; each box
   * shows empty from the list's `at` and gets its mark at the item's `at`.
   * `inline` lays the items out in one row.
   */
  function checklist(layer, { x, y, w, title, items, at, until, tone = 'cream', inline = false }) {
    const card = P.card(layer, { x, y, w, title, at, until, tone });
    if (inline) card.node.classList.add('sk-checklist--inline');
    const rows = items.map((item) => {
      const row = el('div', 'sk-check-row', card.body);
      const mark = el('span', 'sk-check-box', row);
      el('span', 'sk-check-text', row, item.text);
      if (item.mark) {
        const sign = el('span', `sk-check-mark sk-check-mark--${item.mark} is-staged`, mark);
        sign.append(kit.icon(item.mark));
        fx.slam(sign, item.at, { from: 1.8 });
      }
      return row;
    });
    return { ...card, rows };
  }

  /**
   * One quiz question: "Question n of total", the question, a picture
   * slot, and an answer bar (answer and reason) that slams in at answerAt.
   */
  function quiz(layer, { x, y, w, n, total, team, question, answer, reason, icon, at, answerAt, until }) {
    const card = show(box(layer, 'sk-quiz', { x, y, w }), at, until, 'rise');
    const head = el('div', 'sk-quiz-head', card);
    el('span', 'sk-quiz-pill', head, 'Pop quiz');
    el('span', 'sk-quiz-team', head, team);
    el('span', 'sk-quiz-number', head, `Question ${n} of ${total}`);
    const body = el('div', 'sk-quiz-body', card);
    const art = el('div', 'sk-quiz-art', body);
    el('div', 'sk-quiz-question', body, question);
    const bar = el('div', 'sk-quiz-answer is-staged', card);
    el('span', 'sk-quiz-emblem', bar).append(kit.icon(icon));
    const words = el('div', 'sk-quiz-words', bar);
    el('div', 'sk-quiz-answer-text', words, answer);
    el('div', 'sk-quiz-reason', words, reason);
    fx.slam(bar, answerAt, { from: 1.5 });
    return { card, art };
  }

  // ------------------------------------------------------------------
  // Pictures
  // ------------------------------------------------------------------

  /** A brown leather wallet, its flap and clasp, and a tag. */
  function wallet(layer, { x, y, at, until, tag }) {
    const node = show(box(layer, 'sk-wallet', { x, y }), at, until);
    const art = svg('svg', { class: 'sk-wallet-art', viewBox: '0 0 120 84', width: 120, height: 84, 'aria-hidden': 'true' }, node);
    svg('rect', { class: 'sk-wallet-back', x: 6, y: 14, width: 108, height: 64, rx: 10 }, art);
    svg('rect', { class: 'sk-wallet-stitch', x: 12, y: 20, width: 96, height: 52, rx: 7 }, art);
    svg('path', { class: 'sk-wallet-flap', d: 'M6 24 C6 18 10 14 16 14 H104 C110 14 114 18 114 24 V40 H62 C58 40 56 42 56 46 V50 H6 Z' }, art);
    svg('circle', { class: 'sk-wallet-clasp', cx: 68, cy: 45, r: 5 }, art);
    svg('path', { class: 'sk-wallet-card', d: 'M20 10 H62 V16 H20 Z' }, art);
    if (tag) el('div', 'sk-tag', node, tag);
    return node;
  }

  /** The Scrum Team: six people in a row, one marked "you". */
  /**
   * The Scrum Team: one disc per member = [{ role, icon, you }], each with
   * its role's emblem, and a line naming who they are.
   */
  function team(layer, { x, y, w, at, until, title, members, caption }) {
    const card = P.card(layer, { x, y, w, at, until, title });
    const row = el('div', 'sk-team', card.body);
    members.forEach((member, i) => {
      const person = el('span', `sk-team-person sk-team-person--${member.role}${member.you ? ' sk-team-person--you' : ''} is-staged`, row);
      person.append(kit.icon(member.icon));
      if (member.you) el('span', 'sk-team-you', person, 'you');
      fx.pop(person, at + 0.15 + i * 0.12);
    });
    if (caption) P.row(card.body, caption, { at: at + 0.9 }).classList.add('sk-team-caption');
    return card;
  }

  /** An org chart whose top box holds only "?"; crossAt strikes that box. */
  function orgChart(layer, { x, y, at, until, crossAt, label = 'Boss?' }) {
    const node = show(box(layer, 'sk-org', { x, y }), at, until);
    const top = el('div', 'sk-org-box sk-org-box--top', node);
    el('span', 'sk-org-mark', top, '?');
    el('span', 'sk-org-label', top, label);
    el('div', 'sk-org-lines', node);
    const row = el('div', 'sk-org-row', node);
    for (let i = 0; i < 3; i++) el('div', 'sk-org-box', row);
    if (crossAt !== undefined) P.strike(top, crossAt);
    return node;
  }

  /**
   * A stopwatch whose ring closes between runFrom and runTo: the timebox,
   * a fixed maximum time. The ring then stays closed.
   */
  function stopwatch(layer, { x, y, at, until, runFrom, runTo, label }) {
    const node = show(box(layer, 'sk-stopwatch', { x, y }), at, until);
    const art = svg('svg', { class: 'sk-stopwatch-art', viewBox: '0 0 120 132', width: 120, height: 132, 'aria-hidden': 'true' }, node);
    svg('rect', { class: 'sk-stopwatch-crown', x: 52, y: 2, width: 16, height: 12, rx: 3 }, art);
    svg('circle', { class: 'sk-stopwatch-case', cx: 60, cy: 74, r: 54 }, art);
    svg('circle', { class: 'sk-stopwatch-track', cx: 60, cy: 74, r: 42 }, art);
    const ring = svg('circle', { class: 'sk-stopwatch-ring', cx: 60, cy: 74, r: 42, pathLength: 1, transform: 'rotate(-90 60 74)' }, art);
    const hand = svg('path', { class: 'sk-stopwatch-hand', d: 'M60 74 V40' }, art);
    svg('circle', { class: 'sk-stopwatch-pin', cx: 60, cy: 74, r: 4 }, art);
    if (label) el('div', 'sk-caption', node, label);
    onFrame((t) => {
      const p = progress(t, runFrom, runTo - runFrom);
      ring.style.strokeDashoffset = String(1 - p);
      hand.setAttribute('transform', `rotate(${360 * p} 60 74)`);
    });
    return node;
  }

  /** A brick wall that drops in at `at` and is lifted away at liftAt. */
  function wall(layer, { x, y, w = 150, rows = 4, at, liftAt, until, label }) {
    const node = box(layer, 'sk-wall', { x, y, w });
    tween(node, [{ opacity: 0, translate: '0 -90px' }, { opacity: 1, translate: '0 0' }], at, 0.35, EASE.in);
    const art = svg('svg', { class: 'sk-wall-art', viewBox: `0 0 ${w} ${rows * 20}`, width: w, height: rows * 20, 'aria-hidden': 'true' }, node);
    for (let r = 0; r < rows; r++) {
      for (let bx = r % 2 ? -18 : 0; bx < w; bx += 36) {
        svg('rect', { class: 'sk-brick', x: Math.max(0, bx), y: r * 20, width: Math.min(34, bx + 34, w - Math.max(0, bx)), height: 18, rx: 2 }, art);
      }
    }
    if (label) el('div', 'sk-wall-label', node, label);
    if (liftAt !== undefined) tween(node, { opacity: 0, translate: '0 -110px' }, liftAt, 0.6, EASE.inOut);
    else if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  /** A person: a round chip with the user icon and an optional name. */
  function person(layer, { x, y, at, until, label }) {
    const node = show(box(layer, 'sk-person', { x, y }), at, until);
    el('span', 'sk-person-head', node).append(kit.icon('user'));
    if (label) el('span', 'sk-person-label', node, label);
    return node;
  }

  /** A speech bubble with its tail on the `tail` side. */
  function speech(layer, text, { x, y, w, at, until, tail = 'left' }) {
    const node = show(box(layer, `sk-speech sk-speech--${tail}`, { x, y, w }), at, until);
    node.textContent = text;
    return node;
  }

  /** A sticky note that slides by (dx, dy) at slideAt and bounces back at bounceAt. */
  function sticky(layer, text, { x, y, at, slideAt, dx = 0, dy = 0, bounceAt, until }) {
    const node = show(box(layer, 'sk-sticky', { x, y }), at, until);
    node.textContent = text;
    tween(node, { translate: `${dx}px ${dy}px` }, slideAt, 0.5, EASE.inOut);
    tween(node, [{ translate: `${dx}px ${dy}px`, rotate: '0deg' }, { translate: `${dx * 0.2}px ${dy * 0.2}px`, rotate: '-14deg' }], bounceAt, 0.45, EASE.out);
    return node;
  }

  /** A stop sign beside its rule. */
  /** A plain panel the size of the board, under a scene laid over it, so no card peeks out round the scene. */
  function cover(layer, { x, y, w, h, at, until }) {
    return show(box(layer, 'sk-cover', { x, y, w, h }), at, until, 'fade');
  }

  function stopSign(layer, { x, y, at, until, rule }) {
    const node = show(box(layer, 'sk-stop', { x, y }), at, until, 'slam');
    const art = svg('svg', { class: 'sk-stop-art', viewBox: '0 0 64 64', width: 64, height: 64, 'aria-hidden': 'true' }, node);
    svg('path', { class: 'sk-stop-face', d: 'M19 2 H45 L62 19 V45 L45 62 H19 L2 45 V19 Z' }, art);
    svg('path', { class: 'sk-stop-rim', d: 'M20.5 6 H43.5 L58 20.5 V43.5 L43.5 58 H20.5 L6 43.5 V20.5 Z' }, art);
    el('div', 'sk-stop-word', node, 'STOP');
    el('div', 'sk-stop-rule', node, rule);
    return node;
  }

  /**
   * A Sprint timeline of `days` days. merges = [{ day, at, conflict }]: each
   * merge drops onto its day; `redrawAt` fades the first set for `after`.
   */
  function timeline(layer, { x, y, w, h, days = 10, at, until, before, after, redrawAt, label, afterLabel }) {
    const node = show(box(layer, 'sk-timeline', { x, y, w, h }), at, until, 'fade');
    const title = el('div', 'sk-timeline-title', node, label);
    const track = el('div', 'sk-timeline-track', node);
    for (let d = 0; d < days; d++) el('span', 'sk-timeline-day', track, `${d + 1}`);
    const drop = (list, from, to) => list.forEach((m, i) => {
      const dot = el('span', `sk-merge${m.conflict ? ' sk-merge--conflict' : ''} is-staged`, track);
      dot.style.left = `${((m.day + 0.5) / days) * 100}%`;
      dot.style.bottom = `${22 + (m.stack || 0) * 14}px`;
      dot.append(kit.icon(m.conflict ? 'warning' : 'merge'));
      fx.pop(dot, from + i * 0.08);
      if (to !== undefined) fx.fadeOut(dot, to, 0.3);
    });
    drop(before, at + 0.3, redrawAt);
    drop(after, redrawAt + 0.3);
    tween(title, { opacity: 0 }, redrawAt, 0.2);
    const next = show(el('div', 'sk-timeline-title sk-timeline-title--after is-staged', node, afterLabel), redrawAt + 0.2, undefined, 'rise');
    return { node, next };
  }

  window.ScrumKit = {
    strip, board, checklist, quiz,
    wallet, team, orgChart, stopwatch, wall, person, speech, sticky, stopSign, timeline, cover,
  };
})();
