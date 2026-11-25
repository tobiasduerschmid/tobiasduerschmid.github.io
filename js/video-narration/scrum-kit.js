/*
 * Artwork for the Scrum video narration (choreography: js/video-narration/
 * scrum.js; styles: css/video-narration-scrum.css). It builds on the shared
 * wall kit (js/video-narration/wall-kit.js), whose materials it re-exports,
 * and adds Scrum's own objects:
 *
 *   a role is a badge on a lanyard with an icon (a hammer-like pencil for
 *     the Developers, a compass-like globe for the Product Owner, a shield
 *     for the Scrum Master), and the three roles side by side are a
 *     character-select screen whose lit card is outlined and checked;
 *   Hall Hopper runs on a phone, and the dinner line is a queue of people;
 *   up-front planning is a staircase hit by a wave of change, and prediction
 *     is a crystal ball;
 *   time is a strip of workdays under a bracket that names the sprint, with
 *     a timer for the Daily Scrum and planning-poker cards.
 *
 * Every builder schedules its own motion on the Timeline, and every pose is a
 * pure function of narration time. Coordinates are CSS pixels on the 960x540
 * stage.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, progress } = window.Timeline;
  const { el, icon } = window.SongKit;
  const wall = window.WallKit;
  const { staged, appear, lit } = wall;

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
      x: 14 + i * 314, y: 110, role: i, at: at + 0.1 + i * 0.12, until, litAt: i === chosen ? litAt : undefined,
    }));
    return { title, cards };
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

  window.ScrumKit = {
    ...wall,
    phone, queue, door, clock, roleCard, characterSelect, staircase, wave,
    ball, workdays, timer, poker, deck, increment, goalFlag, halfScreen,
    office, doc,
  };
})();
