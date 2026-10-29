/*
 * Artwork for the Scrum video narration (choreography: js/video-narration/
 * scrum.js; styles: css/video-narration-scrum.css). The visual language:
 *
 *   a role is a badge on a lanyard with an icon (a hammer-like pencil for
 *     the Developers, a compass-like globe for the Product Owner, a shield
 *     for the Scrum Master), and the three roles side by side are a
 *     character-select screen whose lit card is outlined and checked;
 *   the work is paper on a dark wall: story cards ranked in a column, task
 *     notes, and a gold banner for a goal;
 *   a summary is a dark card with an icon, a title, and a list (listCard),
 *     and a trap and its fix are the same card printed on pink and green;
 *   ideas are objects: empiricism's pillars hold up a temple, a balance
 *     weighs internal against external quality, an arrow is a flow of work,
 *     and a dashed slot is an open question;
 *   time is a strip of workdays under a bracket that names the sprint.
 *
 * Every builder schedules its own motion on the Timeline, so the choreography
 * reads as "what appears when", and every pose is a pure function of
 * narration time. Coordinates are CSS pixels on the 960x540 stage.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, progress, easeInOutCubic } = window.Timeline;
  const kit = window.SongKit;
  const { el, place, icon } = kit;

  function staged(parent, className, x, y, text) {
    return place(el('div', `${className} is-staged`, parent, text), x, y);
  }

  function appear(node, at, until, { from = 0.6, rotate = 0 } = {}) {
    fx.pop(node, at, { from, rotate });
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  /** Outlines `node` in gold (.is-lit) during each [from, to) interval; to may be left open. */
  function lit(node, intervals) {
    onFrame((t) => node.classList.toggle('is-lit', intervals.some(([from, to = Infinity]) => t >= from && t < to)));
  }

  /** A role badge: an icon, the role, and a lanyard. `variant`: dev, po, or sm; `w` widens it for a long role. */
  function badge(parent, { x, y, w, role, iconName, variant = 'dev', at, until }) {
    const node = staged(parent, `sk-badge sk-badge--${variant}`, x, y);
    if (w) node.style.width = `${w}px`;
    el('span', 'sk-badge-icon', node).append(icon(iconName));
    el('span', 'sk-badge-role', node, role);
    fx.rise(node, at, { distance: -60, duration: 0.45 });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /** A pill: a skill, or with `tone` (po, sm, done) a role or state; `w` wraps it at that width. */
  function skill(parent, { x, y, text, tone, w, at, until }) {
    const node = staged(parent, `sk-skill${tone ? ` sk-skill--${tone}` : ''}`, x, y, text);
    if (w) {
      node.style.width = `${w}px`;
      node.classList.add('is-wrapped');
    }
    return appear(node, at, until, { from: 0.4, rotate: -3 });
  }

  function frame(parent, { x, y, w, h, label, at, until }) {
    const node = staged(parent, 'sk-frame', x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    el('span', 'sk-frame-label', node, label);
    fx.fadeIn(node, at, 0.4);
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  const LEVELS = { quiet: ['Quiet', 1], busy: ['Busy', 2], packed: ['Packed', 3] };

  /**
   * Hall Hopper on a phone. The finished app shows each hall's crowd level as
   * bars and a word; the sprint's first version (`colorOnly`) shows only a
   * colored dot, the accessibility gap that the Sprint Review uncovers.
   */
  function phone(parent, { x, y, at, until, halls, rowsAt = at, colorOnly = false }) {
    const node = staged(parent, 'sk-phone', x, y);
    el('p', 'sk-phone-title', node, 'Hall Hopper');
    el('p', 'sk-phone-sub', node, 'Tonight');
    halls.forEach(({ name, level }, i) => {
      const [word, bars] = LEVELS[level];
      const row = el('div', 'sk-hall is-staged', node);
      el('span', 'sk-hall-name', row, name);
      if (colorOnly) {
        el('span', `sk-dot-meter sk-dot-meter--${level}`, row);
      } else {
        const meter = el('span', `sk-meter sk-meter--${level}`, row);
        for (let bar = 0; bar < 3; bar += 1) el('span', `sk-meter-bar${bar < bars ? ' is-on' : ''}`, meter);
        el('span', 'sk-meter-word', meter, word);
      }
      fx.rise(row, rowsAt + i * 0.25, { distance: 12, duration: 0.3 });
    });
    fx.slideIn(node, at, { dx: 120, duration: 0.5 });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  const SHIRTS = ['#4b6cb7', '#c2416c', '#2f8f6b', '#b7791f', '#6d28d9', '#0e7490', '#be123c', '#4d7c0f', '#9333ea'];
  const SKINS = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac', '#5c3a1e'];

  /** People waiting in a line that sways a little, as if impatient. */
  function queue(parent, { x, y, count, gap = 52, at }) {
    return Array.from({ length: count }, (_, i) => {
      const person = staged(parent, 'sk-person', x + i * gap, y + (i % 2) * 8);
      person.style.setProperty('--shirt', SHIRTS[i % SHIRTS.length]);
      person.style.setProperty('--person', SKINS[(i * 5) % SKINS.length]);
      fx.rise(person, at + i * 0.08, { distance: 20, duration: 0.3 });
      onFrame((t) => {
        if (t < at) return;
        person.style.transform = `rotate(${(2.5 * Math.sin(t * 2.2 + i)).toFixed(2)}deg)`;
      });
      return person;
    });
  }

  function door(parent, { x, y, sign, at, until }) {
    const node = staged(parent, 'sk-door', x, y);
    el('span', 'sk-door-sign', node, sign);
    fx.fadeIn(node, at, 0.3);
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  function clock(parent, { x, y, text, at, until }) {
    return appear(staged(parent, 'sk-clock', x, y, text), at, until, { rotate: -2 });
  }

  /**
   * A paper card on a board, with an optional rank that may arrive later
   * (`rankAt`), as when the Product Owner orders new stories. `tone`: new,
   * blocked, or fuzzy (an item too big and vague to build yet).
   */
  function card(parent, { x, y, w = 260, text, rank, rankAt, tone, at, until }) {
    const node = staged(parent, `sk-card${tone ? ` sk-card--${tone}` : ''}`, x, y);
    node.style.width = `${w}px`;
    if (rank !== undefined) {
      const number = el('span', 'sk-card-rank', node, String(rank));
      if (rankAt !== undefined) {
        number.classList.add('is-staged');
        fx.pop(number, rankAt, { from: 0.3 });
      }
    }
    el('span', null, node, text);
    return appear(node, at, until, { from: 0.7 });
  }

  function note(parent, { x, y, w, text, tone, tilt = -2, at, until }) {
    const node = staged(parent, `sk-note${tone ? ` sk-note--${tone}` : ''}`, x, y, text);
    if (w) node.style.width = `${w}px`;
    node.style.rotate = `${tilt}deg`;
    return appear(node, at, until, { from: 0.5, rotate: tilt });
  }

  function column(parent, { x, y, w, h, title, at, until }) {
    const node = staged(parent, 'sk-column', x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    el('div', 'sk-column-head', node, title);
    fx.rise(node, at, { distance: 24, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /**
   * A goal on a gold banner. With `typeAt`, the text types itself in from an
   * empty banner; with `lockAt`, a padlock locks it in place.
   */
  function banner(parent, { x, y, w, title, text, at, until, typeAt, lockAt }) {
    const node = staged(parent, 'sk-banner', x, y);
    node.style.width = `${w}px`;
    el('b', null, node, title);
    const words = el('span', null, node, typeAt === undefined ? text : '');
    if (typeAt !== undefined) kit.typewriter(words, text, typeAt, 34);
    if (lockAt !== undefined) {
      const lock = icon('lock');
      lock.classList.add('is-staged');
      node.append(lock);
      fx.pop(lock, lockAt, { from: 0.3 });
    }
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  const ROLES = [
    { name: 'Developers', nick: 'The builders', power: 'Ship a usable Increment', iconName: 'pencil' },
    { name: 'Product Owner', nick: 'The value navigator', power: 'Maximize value', iconName: 'globe' },
    { name: 'Scrum Master', nick: 'The team coach', power: 'Clear impediments', iconName: 'shield' },
  ];

  /** One role card, lit (outlined, raised, and checked) from `litAt`. */
  function roleCard(parent, { x, y, role, at, until, litAt }) {
    const { name, nick, power, iconName } = ROLES[role];
    const node = staged(parent, 'sk-role', x, y);
    el('div', 'sk-role-icon', node).append(icon(iconName));
    el('p', 'sk-role-name', node, name);
    el('p', 'sk-role-nick', node, nick);
    const powerLine = el('p', 'sk-role-power', node);
    el('b', null, powerLine, 'Power');
    powerLine.append(document.createTextNode(power));
    fx.rise(node, at, { distance: 30, duration: 0.4 });
    if (litAt !== undefined) {
      lit(node, [[litAt]]);
      tween(node, [{ translate: '0 0' }, { translate: '0 -14px' }], litAt, 0.3, EASE.back);
    }
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /** The three roles as a character-select screen; card `chosen` is lit at `litAt`. */
  function characterSelect(parent, { chosen, at, litAt, until }) {
    const title = el('div', 'sk-select-title is-staged', parent, 'Select your role');
    fx.rise(title, at, { distance: -20, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(title, until);
    const cards = ROLES.map((role, i) => roleCard(parent, {
      x: 18 + i * 312, y: 110, role: i, at: at + 0.1 + i * 0.12, until, litAt: i === chosen ? litAt : undefined,
    }));
    return { title, cards };
  }

  /** A speech bubble; `small` fits a short line into a narrow space. */
  function speech(parent, { x, y, w, who, text, at, until, small = false }) {
    const node = staged(parent, `sk-speech${small ? ' sk-speech--small' : ''}`, x, y);
    if (w) node.style.width = `${w}px`;
    if (who) el('b', null, node, who);
    node.append(document.createTextNode(text));
    return appear(node, at, until, { from: 0.5 });
  }

  /**
   * Labels around a circle, and a marker that keeps travelling around it,
   * one turn every `period` seconds.
   */
  function loop(parent, { x, y, r, labels, at, until, period = 6 }) {
    const ring = staged(parent, 'sk-loop', x - r, y - r);
    ring.style.width = `${2 * r}px`;
    ring.style.height = `${2 * r}px`;
    fx.fadeIn(ring, at, 0.4);
    const dot = staged(parent, 'sk-loop-dot', x, y - r);
    fx.fadeIn(dot, at + 0.3, 0.2);
    onFrame((t) => {
      const angle = ((Math.max(0, t - at) / period) % 1) * Math.PI * 2 - Math.PI / 2;
      dot.style.left = `${(x + r * Math.cos(angle)).toFixed(1)}px`;
      dot.style.top = `${(y + r * Math.sin(angle)).toFixed(1)}px`;
    });
    const nodes = labels.map((text, i) => {
      const angle = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
      const node = staged(parent, 'sk-loop-label', x + r * Math.cos(angle), y + r * Math.sin(angle), text);
      return appear(node, at + 0.2 + i * 0.2, until, { from: 0.4 });
    });
    if (until !== undefined) [ring, dot].forEach((node) => fx.fadeOut(node, until));
    return nodes;
  }

  /** Phases as a staircase, top left to bottom right. */
  function staircase(parent, { x, y, steps, at, dx = 70, dy = 62 }) {
    return steps.map((text, i) => {
      const node = staged(parent, 'sk-step', x + i * dx, y + i * dy, text);
      fx.rise(node, at + i * 0.15, { distance: 16, duration: 0.3 });
      return node;
    });
  }

  function wave(parent, { x, y, text, at }) {
    const node = staged(parent, 'sk-wave', x, y, text);
    tween(node, [{ opacity: 0, translate: '-260px 40px' }, { opacity: 1, translate: '0 0' }], at, 0.8, EASE.out);
    return node;
  }

  function ball(parent, { x, y, at, until }) {
    const node = staged(parent, 'sk-ball', x, y);
    el('span', 'sk-ball-base', node);
    fx.pop(node, at, { from: 0.4 });
    onFrame((t) => { node.style.filter = `brightness(${(1 + 0.08 * Math.sin(t * 3)).toFixed(3)})`; });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  function label(parent, { x, y, w, text, at, until, muted = false }) {
    const node = staged(parent, `sk-label${muted ? ' sk-label--muted' : ''}`, x, y, text);
    if (w) node.style.width = `${w}px`;
    fx.rise(node, at, { distance: 10, duration: 0.3 });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /**
   * A checklist card. items = [{ text, at, checkAt }]: each line appears at
   * `at` (typed in when `type` is set) and is checked at `checkAt`.
   */
  function checklist(parent, { x, y, w, title, items, at, until }) {
    const node = staged(parent, 'sk-checklist', x, y);
    if (w) node.style.width = `${w}px`;
    el('p', 'sk-checklist-title', node, title);
    items.forEach(({ text, at: lineAt = at, checkAt, type }) => {
      const line = el('div', 'sk-check is-staged', node);
      const box = el('span', 'sk-check-box', line);
      const words = el('span', null, line, type ? '' : text);
      if (type) kit.typewriter(words, text, lineAt, 30);
      fx.rise(line, lineAt, { distance: 8, duration: 0.25 });
      if (checkAt !== undefined) {
        const tick = icon('check');
        tick.classList.add('is-staged');
        box.append(tick);
        fx.pop(tick, checkAt, { from: 0.3 });
      }
    });
    fx.rise(node, at, { distance: 20, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  /** Ten workdays in a row: two weeks. Returns each day's left edge. */
  function workdays(parent, { x, y, at, first = 1, count = 10, gap = 88 }) {
    return Array.from({ length: count }, (_, i) => {
      const day = staged(parent, 'sk-day', x + i * gap, y);
      el('b', null, day, String(first + i));
      day.append(document.createTextNode(WEEKDAYS[i % 5]));
      fx.rise(day, at + i * 0.06, { distance: 14, duration: 0.25 });
      return x + i * gap;
    });
  }

  /** A bracket over a span, named on its top edge; `under` opens it upward beneath the span. */
  function bracket(parent, { x, y, w, text, at, next = false, under = false }) {
    const node = staged(parent, `sk-bracket${next ? ' sk-bracket--next' : ''}${under ? ' sk-bracket--under' : ''}`, x, y);
    node.style.width = `${w}px`;
    el('span', null, node, text);
    tween(node, [{ opacity: 0, scale: '0.2 1' }, { opacity: 1, scale: '1 1' }], at, 0.45, EASE.out);
    return node;
  }

  function dot(parent, { x, y, at }) {
    return appear(staged(parent, 'sk-dot', x, y), at, undefined, { from: 0.2 });
  }

  function flag(parent, { x, y, text, tone, at }) {
    return appear(staged(parent, `sk-flag${tone ? ` sk-flag--${tone}` : ''}`, x, y, text), at, undefined, { rotate: -4 });
  }

  /** A countdown from `minutes`, compressed so it reaches zero at `end`. */
  function timer(parent, { x, y, minutes, at, end, until, label = 'Daily Scrum' }) {
    const node = staged(parent, 'sk-timer', x, y);
    el('small', null, node, label);
    const digits = el('span', null, node, `${minutes}:00`);
    fx.pop(node, at, { from: 0.6 });
    onFrame((t) => {
      const left = Math.round(minutes * 60 * (1 - progress(t, at, end - at)));
      const shown = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      if (digits.textContent !== shown) digits.textContent = shown;
    });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /** A planning-poker card that flips to show its value. */
  function poker(parent, { x, y, value, at, rotate = 0 }) {
    const node = staged(parent, 'sk-poker', x, y, value);
    tween(node, [{ opacity: 0, rotate: `${rotate}deg`, scale: '0 1' }, { opacity: 1, rotate: `${rotate}deg`, scale: '1 1' }], at, 0.35, EASE.back);
    return node;
  }

  function deck(parent, { x, y, at, until }) {
    const node = staged(parent, 'sk-deck', x, y);
    for (let i = 0; i < 4; i += 1) el('div', 'sk-deck-line', node);
    fx.rise(node, at, { distance: 14 });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  function increment(parent, { x, y, text, at }) {
    return appear(staged(parent, 'sk-increment', x, y, text), at, undefined, { from: 0.5 });
  }

  function goalFlag(parent, { x, y, text, at }) {
    const node = staged(parent, 'sk-goal-flag', x, y);
    node.append(icon('pin'));
    node.append(document.createTextNode(` ${text}`));
    return appear(node, at, undefined, { rotate: 3 });
  }

  function halfScreen(parent, { x, y, text, at }) {
    return appear(staged(parent, 'sk-half-screen', x, y, text), at, undefined, { from: 0.6 });
  }

  function office(parent, { x, y, sign, at }) {
    const node = staged(parent, 'sk-office', x, y);
    el('span', 'sk-office-sign', node, sign);
    fx.rise(node, at, { distance: 20 });
    return node;
  }

  function doc(parent, { x, y, text, at }) {
    return appear(staged(parent, 'sk-doc', x, y, text), at, undefined, { from: 0.5 });
  }

  /**
   * A dark card: an icon, a title, an optional line, and items that rise in
   * one at a time ({ text, at, iconName }), in two columns when `columns` is
   * 2. `tone` prints it on paper: 'trap' (pink) or 'fix' (green). `lit`
   * outlines it in gold during each [from, to) interval.
   */
  function listCard(parent, { x, y, w, h, title, text, iconName, items = [], columns = 1, tone, at, until, lit: intervals }) {
    const node = staged(parent, `sk-list${tone ? ` sk-list--${tone}` : ''}`, x, y);
    node.style.width = `${w}px`;
    if (h) node.style.height = `${h}px`;
    const head = el('div', 'sk-list-head', node);
    if (iconName) el('span', 'sk-list-icon', head).append(icon(iconName));
    el('p', 'sk-list-title', head, title);
    if (text) el('p', 'sk-list-text', node, text);
    if (items.length) {
      const list = el('ul', `sk-list-items${columns === 2 ? ' sk-list-items--two' : ''}`, node);
      items.forEach(({ text: line, at: lineAt = at, iconName: lineIcon }) => {
        const item = el('li', 'sk-list-item is-staged', list);
        if (lineIcon) item.append(icon(lineIcon));
        el('span', null, item, line);
        fx.rise(item, lineAt, { distance: 10, duration: 0.3 });
      });
    }
    fx.rise(node, at, { distance: 24, duration: 0.4 });
    if (intervals) lit(node, intervals);
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /** A temple's roof and base, `w` wide; pillar() stands its pillars between them. */
  function temple(parent, { x, y, w, roof, base, baseY, at }) {
    const top = staged(parent, 'sk-roof', x, y);
    top.style.width = `${w}px`;
    el('span', null, top, roof);
    fx.rise(top, at, { distance: -24 });
    const bottom = staged(parent, 'sk-base', x, baseY, base);
    bottom.style.width = `${w}px`;
    fx.rise(bottom, at + 0.15, { distance: 24 });
    return { top, bottom };
  }

  /** A pillar that rises into place: its name on the capital, a short line on the shaft. */
  function pillar(parent, { x, y, w, h, title, text, at, lit: intervals }) {
    const node = staged(parent, 'sk-pillar', x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    el('p', 'sk-pillar-cap', node, title);
    el('p', 'sk-pillar-text', node, text);
    tween(node, [{ opacity: 0, translate: '0 60px' }, { opacity: 1, translate: '0 0' }], at, 0.55, EASE.back);
    if (intervals) lit(node, intervals);
    return node;
  }

  /**
   * A balance: a beam on a post, centered on (x, y), with a listCard() pan
   * hanging level from each end. The beam tilts to each { at, angle } in
   * turn (degrees; a negative angle lowers the left pan). Returns the pans.
   */
  function balance(parent, { x, y, beam, at, pans, tilts }) {
    const post = staged(parent, 'sk-balance-post', x - 10, y);
    const bar = staged(parent, 'sk-balance-beam', x - beam / 2, y - 8);
    bar.style.width = `${beam}px`;
    fx.fadeIn(post, at, 0.35);
    fx.fadeIn(bar, at + 0.1, 0.35);
    const hung = pans.map((options) => {
      const pan = listCard(parent, { ...options, x: 0, y: 0 });
      pan.classList.add('sk-balance-pan');
      return pan;
    });
    onFrame((t) => {
      let angle = 0;
      for (const tilt of tilts) {
        if (t < tilt.at) break;
        angle += (tilt.angle - angle) * easeInOutCubic(progress(t, tilt.at, 0.8));
      }
      bar.style.rotate = `${angle.toFixed(2)}deg`;
      const radians = (angle * Math.PI) / 180;
      hung.forEach((pan, i) => {
        const side = i === 0 ? -1 : 1;
        pan.style.left = `${(x + side * (beam / 2) * Math.cos(radians) - pans[i].w / 2).toFixed(1)}px`;
        pan.style.top = `${(y + side * (beam / 2) * Math.sin(radians) + 40).toFixed(1)}px`;
      });
    });
    return hung;
  }

  const ARROW_HEAD = 16;

  /** An arrow that grows from `from` until its tip reaches `to` ([x, y] stage points). */
  function arrow(parent, { from: [x1, y1], to: [x2, y2], dashed = false, at, until }) {
    const node = staged(parent, `sk-arrow${dashed ? ' sk-arrow--dashed' : ''}`, x1, y1);
    node.style.width = `${Math.max(0, Math.hypot(x2 - x1, y2 - y1) - ARROW_HEAD)}px`;
    node.style.rotate = `${((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI).toFixed(1)}deg`;
    tween(node, [{ opacity: 0, scale: '0 1' }, { opacity: 1, scale: '1 1' }], at, 0.45, EASE.out);
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /** A dashed, empty place for an answer still to come. */
  function slot(parent, { x, y, w, h, text = '?', at, until }) {
    const node = staged(parent, 'sk-slot', x, y, text);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    return appear(node, at, until, { from: 0.7 });
  }

  /** How far a story has come: a label over a bar that fills to `value` (0 to 1). */
  function progressBar(parent, { x, y, w, value, text, at, until }) {
    const node = staged(parent, 'sk-progress', x, y);
    node.style.width = `${w}px`;
    el('span', 'sk-progress-label', node, text);
    const fill = el('span', 'sk-progress-fill', el('span', 'sk-progress-bar', node));
    fx.rise(node, at, { distance: 10, duration: 0.3 });
    tween(fill, [{ width: '0%' }, { width: `${Math.round(value * 100)}%` }], at + 0.2, 0.9);
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /**
   * The picture's heading, in the strip above its body: what the
   * cue is about (`kind`: Role, Artifact, Event, Theory, or Scrum), its
   * name, and the icon that stands for it throughout the video.
   */
  function topicTag(parent, { kind, name, iconName, at }) {
    const node = el('div', `sk-topic sk-topic--${kind.toLowerCase()} is-staged`, parent);
    el('span', 'sk-topic-icon', node).append(icon(iconName));
    const words = el('span', 'sk-topic-words', node);
    el('small', null, words, kind);
    el('b', null, words, name);
    fx.slideIn(node, at, { dx: 40, duration: 0.4 });
    return node;
  }

  /** The picture's artwork layer, scaled beneath the heading strip; draw every piece in it. */
  function body(parent) {
    return el('div', 'sk-body', parent);
  }

  /** An empty layer over everything drawn in `parent` so far, for effects that belong on top. */
  function overlay(parent) {
    return el('div', 'sk-overlay', parent);
  }

  window.ScrumKit = {
    badge, skill, frame, phone, queue, door, clock, card, note, column, banner,
    roleCard, characterSelect, speech, loop, staircase, wave, ball, label,
    checklist, workdays, bracket, dot, flag, timer, poker, deck, increment,
    goalFlag, halfScreen, office, doc, listCard, temple, pillar, balance,
    arrow, slot, progressBar, overlay, topicTag, body,
  };
})();
