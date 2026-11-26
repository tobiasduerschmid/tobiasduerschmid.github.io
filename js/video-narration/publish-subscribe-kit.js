/*
 * Artwork for the Publish-Subscribe video narration (choreography:
 * js/video-narration/publish-subscribe.js; styles: css/video-narration-
 * publish-subscribe.css). It builds on the wall kit and the architecture kit
 * (js/video-narration/arch-kit.js) and adds the lesson's own objects:
 *
 *   Mochi, the campus delivery robot, drawn from the side: a cooler-sized
 *     body on six wheels, a camera eye at the front, and a safety flag;
 *   the campus as a paper map (the student union, the engineering building,
 *     the main walkway, scooters on it), and a walkway strip for the scenes
 *     that only need the robot, a tour group, or a skateboarder;
 *   the phone that orders lunch, and a bus diagram: boxes hanging from one
 *     line, the picture that hides who talks to whom.
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
  // Mochi
  // ------------------------------------------------------------------

  /** Mochi from the side, facing right: body, lid, camera eye, flag, and three of its six wheels. */
  function robotArt(parent) {
    const art = svg('svg', { viewBox: '0 0 96 84', class: 'ps-robot-art', 'aria-hidden': 'true' }, parent);
    svg('path', { d: 'M22 6 V34', class: 'ps-robot-pole' }, art);
    svg('path', { d: 'M22 6 L40 11 L22 16 Z', class: 'ps-robot-flag' }, art);
    svg('rect', { x: 8, y: 30, width: 80, height: 36, rx: 12, class: 'ps-robot-body' }, art);
    svg('path', { d: 'M12 34 Q48 20 84 34', class: 'ps-robot-lid' }, art);
    svg('rect', { x: 70, y: 40, width: 14, height: 12, rx: 4, class: 'ps-robot-eye' }, art);
    svg('circle', { cx: 77, cy: 46, r: 3.2, class: 'ps-robot-lens' }, art);
    [22, 48, 74].forEach((cx) => svg('circle', { cx, cy: 70, r: 10, class: 'ps-robot-wheel' }, art));
    return art;
  }

  /**
   * Mochi on a path of points (body coordinates of its center), driven from
   * `at` over `duration` seconds with an ease at both ends; it rests at the
   * last point. `stops` = [{ at, state }] repaints it (frozen, stopped).
   */
  function robot(parent, { path, at, duration = 0.01, size = 96, until, states = [], drive = at, name }) {
    const node = staged(parent, 'ps-robot', path[0][0] - size / 2, path[0][1] - size * 0.44);
    node.style.width = `${size}px`;
    node.style.height = `${size * 0.875}px`;
    robotArt(node);
    if (name) el('span', 'ps-robot-name', node, name);
    const total = arch.pathLength(path);
    onFrame((t) => {
      const [x, y] = arch.along(path, total * easeInOutCubic(progress(t, drive, duration)));
      node.style.translate = `${(x - path[0][0]).toFixed(1)}px ${(y - path[0][1]).toFixed(1)}px`;
    });
    if (states.length) arch.track(node, 'is-', states);
    return show(node, at, until, 'fade');
  }

  // ------------------------------------------------------------------
  // The campus
  // ------------------------------------------------------------------

  /** The campus map: buildings, the walkway Mochi drives, and the scooters it weaves between. */
  const CAMPUS = {
    w: 560,
    h: 380,
    walk: 'M120 104 C 190 130, 200 190, 280 196 S 400 238, 430 280',
    ride: [[120, 98], [190, 132], [236, 176], [292, 186], [352, 222], [412, 262]],
    buildings: [
      { name: 'Student union', x: 20, y: 22, w: 190, h: 64 },
      { name: 'Engineering', x: 340, y: 292, w: 196, h: 66 },
    ],
    scooters: [[214, 132], [330, 236]],
  };

  /** A small scooter from above: a deck and a handlebar, in ink. */
  function scooterMark(parent, [x, y]) {
    const g = svg('g', { class: 'ps-map-scooter', transform: `translate(${x} ${y}) rotate(-24)` }, parent);
    svg('rect', { x: -14, y: -5, width: 28, height: 10, rx: 4 }, g);
    svg('path', { d: 'M12 -11 V11' }, g);
    return g;
  }

  /** The campus as a paper map; Mochi drives it with drive(). Returns { node, origin }. */
  function campusMap(parent, { x, y, at, until }) {
    const node = staged(parent, 'ps-map', x, y);
    node.style.width = `${CAMPUS.w}px`;
    node.style.height = `${CAMPUS.h}px`;
    const art = svg('svg', { viewBox: `0 0 ${CAMPUS.w} ${CAMPUS.h}`, class: 'ps-map-art', 'aria-hidden': 'true' }, node);
    svg('path', { d: CAMPUS.walk, class: 'ps-map-walk' }, art);
    CAMPUS.buildings.forEach((b) => svg('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 8, class: 'ps-map-building' }, art));
    CAMPUS.scooters.forEach((point) => scooterMark(art, point));
    CAMPUS.buildings.forEach((b) => {
      const label = el('span', 'ps-map-name', node, b.name);
      label.style.left = `${b.x + b.w / 2}px`;
      label.style.top = `${b.y + b.h / 2}px`;
    });
    const walkway = el('span', 'ps-map-name ps-map-name--walk', node, 'Main walkway');
    walkway.style.left = '150px';
    walkway.style.top = '214px';
    show(node, at, until, 'fade');
    return node;
  }

  /** Mochi riding the campus map placed at (mapX, mapY), from the union to the engineering building. */
  function rideCampus(parent, { mapX, mapY, at, drive, duration, size = 64, name = 'Mochi' }) {
    const path = CAMPUS.ride.map(([px, py]) => [mapX + px, mapY + py]);
    return robot(parent, { path, at, drive, duration, size, name });
  }

  /**
   * A strip of the main walkway for scenes that need only the robot and
   * who is on the walkway: Mochi's positions over time (stops = [{ at, x }],
   * gliding between them), props = [{ kind: tour, skater, bumper, at, x }],
   * and an optional word under the strip that changes (words = [{ at, text }]).
   */
  function walkway(parent, { x, y, w = 420, at, until, stops, props = [], states = [] }) {
    const node = staged(parent, 'ps-walk', x, y);
    node.style.width = `${w}px`;
    el('span', 'ps-walk-name', node, 'Main walkway');
    const lane = el('div', 'ps-walk-lane', node);
    props.forEach(({ kind, x: px, at: propAt = at, until: propUntil }) => {
      const prop = el('span', `ps-walk-prop ps-walk-prop--${kind} is-staged`, lane);
      prop.style.left = `${px}px`;
      if (kind === 'tour') prop.append(icon('team'));
      else if (kind === 'skater') skaterArt(prop);
      fx.pop(prop, propAt, { from: 0.5 });
      if (propUntil !== undefined) fx.fadeOut(prop, propUntil, 0.25);
    });
    const bot = el('span', 'ps-walk-robot', lane);
    robotArt(bot);
    const sorted = [...stops].sort((a, b) => a.at - b.at);
    onFrame((t) => {
      let px = sorted[0].x;
      for (let i = 1; i < sorted.length; i += 1) {
        const from = sorted[i - 1];
        const to = sorted[i];
        if (t >= to.at) px = to.x;
        else if (t > from.at && to.glide) px = from.x + (to.x - from.x) * easeInOutCubic(progress(t, from.at, to.at - from.at));
      }
      bot.style.left = `${px.toFixed(1)}px`;
    });
    if (states.length) arch.track(node, 'is-', states);
    return show(node, at, until, 'fade');
  }

  /** A skateboarder from the side: a board on two wheels and a rider leaning forward. */
  function skaterArt(parent) {
    const art = svg('svg', { viewBox: '0 0 48 60', class: 'ps-skater-art', 'aria-hidden': 'true' }, parent);
    svg('circle', { cx: 26, cy: 10, r: 6 }, art);
    svg('path', { d: 'M26 16 L22 34 M22 34 L14 46 M22 34 L32 46 M24 22 L36 28 M24 22 L12 26', class: 'ps-skater-limbs' }, art);
    svg('path', { d: 'M6 48 H42', class: 'ps-skater-board' }, art);
    svg('circle', { cx: 12, cy: 54, r: 4, class: 'ps-skater-wheel' }, art);
    svg('circle', { cx: 36, cy: 54, r: 4, class: 'ps-skater-wheel' }, art);
    return art;
  }

  // ------------------------------------------------------------------
  // The phone
  // ------------------------------------------------------------------

  /** A phone with the delivery app: screens = [{ at, title, text, iconName }], each replacing the last. */
  function phone(parent, { x, y, at, until, screens }) {
    const node = staged(parent, 'ps-phone', x, y);
    el('p', 'ps-phone-app', node, 'Campus Eats');
    const cards = screens.map(({ at: screenAt, title, text, iconName }, i) => {
      const card = el('div', 'ps-phone-card is-staged', node);
      if (iconName) el('span', 'ps-phone-icon', card).append(icon(iconName));
      const words = el('span', 'ps-phone-words', card);
      el('b', null, words, title);
      if (text) el('span', null, words, text);
      fx.rise(card, screenAt, { distance: 12, duration: 0.35 });
      const next = screens[i + 1];
      if (next) fx.fadeOut(card, next.at - 0.2, 0.2);
      return card;
    });
    show(node, at, until, 'slide');
    return { node, cards };
  }

  // ------------------------------------------------------------------
  // Diagrams
  // ------------------------------------------------------------------

  /** Boxes on one bus line, half above it and half below: every box could talk to every other. */
  function bus(parent, { x, y, w, names, at, until }) {
    const node = staged(parent, 'ps-bus', x, y);
    node.style.width = `${w}px`;
    const half = Math.ceil(names.length / 2);
    [names.slice(0, half), names.slice(half)].forEach((row, r) => {
      if (r === 1) el('span', 'ps-bus-line', node);
      const boxes = el('div', `ps-bus-row ps-bus-row--${r ? 'below' : 'above'}`, node);
      row.forEach((name, i) => {
        const box = el('span', 'ps-bus-box is-staged', boxes, name);
        fx.rise(box, at + 0.1 + (r * half + i) * 0.12, { distance: r ? 10 : -10, duration: 0.3 });
      });
    });
    return show(node, at, until, 'fade');
  }

  window.PubSubKit = { robotArt, robot, campusMap, rideCampus, walkway, skaterArt, phone, bus, CAMPUS };
})();
