/*
 * Illustrated props for "Red, Green, Refactor": the pictures that carry a
 * testing idea where code alone would not (see tdd-kit.js for the code
 * cards, terminals, and suites they sit beside):
 *
 *   floor tiles under the dancers for Red ✗, Green ✓, and Refactor ↻;
 *   two gears that each turn fine alone but jam together (unit tests pass,
 *     the integration test fails), because their teeth do not match;
 *   a music staff with repeat signs: regression tests repeat the score;
 *   waves of flaky ✗/✓ noise that drown a real warning;
 *   a picket fence of tests with a gap a bug slips through;
 *   a parking lot where untested extra features wait;
 *   a browser window for an end-to-end user flow;
 *   the moon, a rocket, and a tower: what incremental steps cannot reach;
 *   a lamp beam that reveals some bugs and leaves others in the dark.
 *
 * Every builder schedules its own motion on the Timeline, and every pose is
 * a pure function of song time. Styles: css/song-video-tdd-props.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, clamp, progress, hash01 } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, place, icon } = kit;
  const tdd = window.TddKit;

  // ------------------------------------------------------------------
  // Floor tiles: where the dancers step for each phase
  // ------------------------------------------------------------------

  /**
   * floorTiles(parent, { y, xs: { red, green, refactor }, at, until }) —
   * three glowing ellipses on the floor, each with its glyph (✗ ✓ ↻); the
   * phase names sit in the cycle diagram, above the caption area.
   * light(phase, from, to) brightens one.
   */
  function floorTiles(parent, { y, xs, at, until, rx = 74 }) {
    const node = el('div', 'tdd-floor is-staged', parent);
    const tiles = {};
    for (const [phase, x] of Object.entries(xs)) {
      const tile = place(el('div', `tdd-floor-tile tdd-floor-tile--${phase}`, node), x - rx, y - 16);
      tile.style.width = `${rx * 2}px`;
      tile.append(tdd.glyph(phase === 'red' ? 'fail' : phase === 'green' ? 'pass' : 'refactor', 'tdd-floor-glyph'));
      tiles[phase] = tile;
    }
    fx.fadeIn(node, at, 0.4);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return {
      node,
      light(phase, from, to) {
        tdd.during(tiles[phase], 'is-lit', from, to);
      },
    };
  }

  // ------------------------------------------------------------------
  // Integration: two gears that each turn alone but jam together
  // ------------------------------------------------------------------

  const f = (n) => n.toFixed(2);

  /** A gear outline with n teeth between rRoot and rTip; shape 'square' or 'spike'. */
  function gearOutline(n, rRoot, rTip, shape) {
    const step = (Math.PI * 2) / n;
    const point = (r, a) => `${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`;
    let d = '';
    for (let i = 0; i < n; i++) {
      const a0 = i * step;
      if (shape === 'spike') {
        d += `${i ? 'L' : 'M'}${point(rRoot, a0)} L${point(rTip, a0 + step / 2)} `;
      } else {
        d += `${i ? 'L' : 'M'}${point(rRoot, a0)} L${point(rTip, a0 + step * 0.12)} L${point(rTip, a0 + step * 0.46)} L${point(rRoot, a0 + step * 0.58)} `;
      }
    }
    return `${d}Z`;
  }

  /**
   * gears(parent, { x, y, at, until, names, aloneAt: [a, b], connectAt,
   * turnAt, jamAt }) — the integration story in one machine. Two gears
   * appear apart, each turning freely with an "alone ✓" chip (their unit
   * tests pass). On connectAt they slide together; their teeth do not
   * match (square against spiked). On turnAt the integration test turns
   * the first gear: both judder and stop, and on jamAt a "together ✗"
   * chip marks the failure only an integration test could see. Motion is
   * small and slow; the spark fades once, it does not flash (WCAG 2.3.1).
   */
  function gears(parent, { x, y, at, until, names, aloneAt, connectAt, turnAt, jamAt }) {
    const W = 460;
    const H = 330;
    const node = place(el('div', 'tdd-gears is-staged', parent), x, y);
    node.style.width = `${W}px`;
    const art = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, node);
    const defs = svg('defs', {}, art);
    for (const metal of ['brass', 'steel']) {
      const grad = svg('linearGradient', { id: `tdd-gear-${metal}`, class: `tdd-gear-grad tdd-gear-grad--${metal}`, x1: 0, y1: 0, x2: 0.4, y2: 1 }, defs);
      svg('stop', { class: 'tdd-stop--top', offset: 0 }, grad);
      svg('stop', { class: 'tdd-stop--bottom', offset: 1 }, grad);
    }
    const CY = 150;
    const specs = [
      { metal: 'brass', teeth: 12, root: 52, tip: 66, shape: 'square', from: 112, to: 178, speed: 50 },
      { metal: 'steel', teeth: 8, root: 46, tip: 72, shape: 'spike', from: 330, to: 298, speed: -34 },
    ];
    const machine = svg('g', {}, art);
    const gearNodes = specs.map((spec, i) => {
      const slide = svg('g', {}, machine);
      const spin = svg('g', { class: `tdd-gear tdd-gear--${spec.metal}` }, slide);
      svg('path', { class: 'tdd-gear-teeth', d: gearOutline(spec.teeth, spec.root, spec.tip, spec.shape), fill: `url(#tdd-gear-${spec.metal})` }, spin);
      svg('circle', { class: 'tdd-gear-rim', r: spec.root - 9 }, spin);
      for (let h = 0; h < 4; h++) {
        const a = (h * Math.PI) / 2 + Math.PI / 4;
        svg('circle', { class: 'tdd-gear-hole', cx: f(26 * Math.cos(a)), cy: f(26 * Math.sin(a)), r: 7 }, spin);
      }
      svg('circle', { class: 'tdd-gear-hub', r: 11 }, spin);
      svg('circle', { class: 'tdd-gear-axle', r: 4 }, spin);
      const label = place(el('div', 'tdd-gear-label is-staged', node), 0, CY + 84);
      label.style.width = '180px';
      el('b', null, label, names[i]);
      const chip = el('span', 'tdd-gear-chip', label);
      chip.append(window.TddKit.glyph('pass', 'tdd-gear-glyph'));
      chip.append(document.createTextNode('alone'));
      fx.pop(label, aloneAt[i] + 0.35, { from: 0.6 });
      fx.fadeIn(slide, aloneAt[i], 0.3);
      slide.style.opacity = '0';
      return { ...spec, slide, spin, label };
    });

    /** Angle of a gear at time t: free spin, then the integration test's push and the jam. */
    function angleOf(g, t) {
      const free = g.speed * Math.min(t, connectAt);
      if (t < turnAt) return free;
      const push = Math.min(1, (t - turnAt) / 0.35);
      const shudder = Math.sin((t - turnAt) * 26) * Math.exp(-(t - turnAt) * 3) * 1.6;
      const again = t >= jamAt ? Math.sin((t - jamAt) * 26) * Math.exp(-(t - jamAt) * 3) * 1.6 : 0;
      return free + Math.sign(g.speed) * 6 * push + shudder + again;
    }

    const spark = svg('g', { class: 'tdd-gear-spark', opacity: 0 }, art);
    const meetX = (specs[0].to + specs[1].to) / 2;
    for (let r = 0; r < 8; r++) {
      const a = (r * Math.PI) / 4;
      svg('line', { x1: f(meetX + 9 * Math.cos(a)), y1: f(CY + 9 * Math.sin(a)), x2: f(meetX + 20 * Math.cos(a)), y2: f(CY + 20 * Math.sin(a)) }, spark);
    }
    // The integration test's turn: a gold arrow over the first gear.
    const turn = svg('g', { class: 'tdd-gear-turn is-staged' }, art);
    svg('path', { class: 'tdd-gear-turn-arc', d: `M${specs[0].to - 52} ${CY - 70} A86 86 0 0 1 ${specs[0].to + 30} ${CY - 84}` }, turn);
    svg('path', { class: 'tdd-gear-turn-head', d: `M${specs[0].to + 22} ${CY - 94} L${specs[0].to + 36} ${CY - 82} L${specs[0].to + 20} ${CY - 74} Z` }, turn);
    fx.fadeIn(turn, turnAt - 0.3, 0.3);

    onFrame((t) => {
      for (const g of gearNodes) {
        const p = clamp(progress(t, connectAt, 0.7), 0, 1);
        const eased = p * p * (3 - 2 * p);
        const cx = g.from + (g.to - g.from) * eased;
        g.slide.setAttribute('transform', `translate(${f(cx)} ${CY})`);
        g.spin.setAttribute('transform', `rotate(${f(angleOf(g, t))})`);
        g.label.style.transform = `translateX(${f(cx - 90)}px)`;
      }
      const age = Math.min(t - turnAt, t >= jamAt ? t - jamAt : Infinity);
      const visible = age >= 0 && age < 0.7;
      spark.setAttribute('opacity', visible ? f(1 - age / 0.7) : '0');
      spark.setAttribute('transform', visible ? `translate(${f(meetX)} ${CY}) scale(${f(0.8 + 0.5 * age)}) translate(${f(-meetX)} ${-CY})` : '');
    });

    const verdict = place(el('div', 'tdd-gear-verdict is-staged', node), meetX - 70, 4);
    verdict.append(window.TddKit.glyph('fail', 'tdd-gear-glyph'));
    verdict.append(document.createTextNode('together'));
    fx.pop(verdict, jamAt, { from: 0.5, rotate: -3 });

    fx.fadeIn(node, at, 0.3);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return { node };
  }

  // ------------------------------------------------------------------
  // Regression: a staff with repeat signs, every bar a test
  // ------------------------------------------------------------------

  /** staff(parent, { x, y, w, bars, at, until, loopFrom }) — bars = ['test_…', …]. */
  function staff(parent, { x, y, w, bars, at, until, loopFrom, loopPeriod = 2.2 }) {
    const node = place(el('div', 'tdd-staff is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const art = svg('svg', { viewBox: `0 0 ${w} 110`, width: w, height: 110, 'aria-hidden': 'true' }, node);
    for (let i = 0; i < 5; i++) svg('line', { class: 'tdd-staff-line', x1: 0, y1: 20 + i * 12, x2: w, y2: 20 + i * 12 }, art);
    const repeat = (rx, flip) => {
      const g = svg('g', { transform: `translate(${rx} 0)${flip ? ' scale(-1 1)' : ''}` }, art);
      svg('rect', { class: 'tdd-staff-bar tdd-staff-bar--thick', x: -4, y: 20, width: 6, height: 48 }, g);
      svg('rect', { class: 'tdd-staff-bar', x: 6, y: 20, width: 2, height: 48 }, g);
      svg('circle', { class: 'tdd-staff-dot', cx: 15, cy: 38, r: 3.2 }, g);
      svg('circle', { class: 'tdd-staff-dot', cx: 15, cy: 50, r: 3.2 }, g);
    };
    repeat(8, false);
    repeat(w - 8, true);
    const inner = w - 60;
    bars.forEach((name, i) => {
      const bx = 34 + (inner / bars.length) * i;
      if (i) svg('line', { class: 'tdd-staff-line tdd-staff-line--bar', x1: bx - 6, y1: 20, x2: bx - 6, y2: 68 }, art);
      for (let k = 0; k < 3; k++) {
        const nx = bx + 16 + k * ((inner / bars.length - 30) / 3);
        const ny = 26 + ((i * 3 + k * 5) % 5) * 6;
        svg('ellipse', { class: 'tdd-staff-note', cx: nx, cy: ny + 14, rx: 6, ry: 4.5, transform: `rotate(-20 ${nx} ${ny + 14})` }, art);
        svg('line', { class: 'tdd-staff-stem', x1: nx + 5.5, y1: ny + 13, x2: nx + 5.5, y2: ny - 14 }, art);
      }
      const label = place(el('div', 'tdd-staff-label', node), bx - 4, 76);
      label.style.width = `${inner / bars.length}px`;
      label.append(tdd.glyph('pass', 'tdd-staff-glyph'));
      label.append(document.createTextNode(name));
    });
    const head = svg('rect', { class: 'tdd-staff-head', x: 0, y: 12, width: 4, height: 64, rx: 2 }, art);
    onFrame((t) => {
      if (loopFrom === undefined || t < loopFrom) {
        head.setAttribute('opacity', '0');
        return;
      }
      const p = ((t - loopFrom) % loopPeriod) / loopPeriod;
      head.setAttribute('opacity', '1');
      head.setAttribute('x', (24 + p * (w - 48)).toFixed(1));
    });
    tdd.enter(node, at, until);
    return { node };
  }

  // ------------------------------------------------------------------
  // Flaky noise: waves of red and green chips that drown a real warning
  // ------------------------------------------------------------------

  /**
   * noise(parent, { x, y, w, h, at, riseAt, sinkAt, until }) — chips of ✗
   * and ✓ bob on rising waves; a real warning (a ladybug sign) sinks.
   * The chips change at most twice a second and stay small (WCAG 2.3.1).
   */
  function noise(parent, { x, y, w, h, at, riseAt, sinkAt, until }) {
    const node = place(el('div', 'tdd-noise is-staged', parent), x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    const warning = place(el('div', 'tdd-noise-warning', node), w / 2 - 90, h * 0.32);
    warning.append(tdd.glyph('fail', 'tdd-noise-glyph'));
    warning.append(document.createTextNode('Real failure'));
    const chips = Array.from({ length: 18 }, (_, i) => {
      const chip = place(el('div', 'tdd-noise-chip', node), 12 + (i % 9) * ((w - 40) / 9), 0);
      chip.append(tdd.glyph('fail', 'tdd-noise-chip-glyph tdd-noise-chip-glyph--fail'));
      chip.append(tdd.glyph('pass', 'tdd-noise-chip-glyph tdd-noise-chip-glyph--pass'));
      return { chip, row: Math.floor(i / 9), seed: i };
    });
    const art = svg('svg', { class: 'tdd-noise-waves', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, node);
    const waves = [0, 1].map((k) => svg('path', { class: `tdd-wave tdd-wave--${k}` }, art));
    onFrame((t) => {
      const level = clamp(progress(t, riseAt, 1.6), 0, 1);
      const surface = h - 30 - level * (h * 0.62);
      waves.forEach((wave, k) => {
        let d = `M0 ${h}`;
        for (let px = 0; px <= w; px += 16) {
          const yy = surface + k * 16 + 7 * Math.sin(px / 38 + t * (1.6 + k * 0.5) + k * 2);
          d += ` L${px} ${yy.toFixed(1)}`;
        }
        wave.setAttribute('d', `${d} L${w} ${h} Z`);
      });
      for (const { chip, row, seed } of chips) {
        const bob = 6 * Math.sin(t * 2 + seed);
        chip.style.transform = `translate(0, ${(surface - 26 + row * 18 + bob).toFixed(1)}px)`;
        const flip = Math.floor(t * 1.6 + hash01(seed) * 4) % 2 === 0;
        chip.dataset.status = flip ? 'fail' : 'pass';
        chip.style.opacity = t >= at + 0.2 + seed * 0.05 ? '1' : '0';
      }
      const sink = clamp(progress(t, sinkAt, 1.2), 0, 1);
      warning.style.transform = `translate(0, ${(sink * h * 0.5).toFixed(1)}px) rotate(${(sink * 14).toFixed(1)}deg)`;
      warning.style.opacity = (1 - 0.75 * sink).toFixed(2);
    });
    tdd.enter(node, at, until);
    return { node };
  }

  // ------------------------------------------------------------------
  // A fence of tests with a gap
  // ------------------------------------------------------------------

  /**
   * fence(parent, { x, y, names, gap, closeAt, closeName, at, until }) — a
   * picket per test; the picket at index `gap` is missing until closeAt,
   * when a new test (closeName) drops into the gap.
   */
  function fence(parent, { x, y, names, gap, closeAt, closeName, at, until }) {
    const node = place(el('div', 'tdd-fence is-staged', parent), x, y);
    const hasGap = Number.isInteger(gap) && gap >= 0 && gap < names.length;
    if (hasGap) {
      node.style.setProperty('--tdd-fence-gap-index', gap);
      el('div', 'tdd-fence-rail tdd-fence-rail--before', node);
      el('div', 'tdd-fence-rail tdd-fence-rail--after', node);
    } else {
      el('div', 'tdd-fence-rail', node);
    }
    names.forEach((name, i) => {
      if (i !== gap) {
        el('div', 'tdd-picket', node, name);
        return;
      }
      const slot = el('div', 'tdd-picket tdd-picket--new is-staged', node, closeName || '');
      if (closeAt !== undefined) tween(slot, [{ opacity: 0, translate: '0 -60px' }, { opacity: 1, translate: '0 0' }], closeAt, 0.5, EASE.back);
    });
    tdd.enter(node, at, until);
    return {
      node,
      slipThrough(at) {
        if (!hasGap) return null;
        // The fence owns the passage's center; choreography must not guess
        // another stage coordinate for the bug. The rail leaves this gap open.
        const passage = el('div', 'tdd-fence-passage', node);
        const size = 50;
        const bug = tdd.bug(passage, { x: -size / 2, y: 204, size, at, rotate: 180, from: [-size / 2, -60] });
        // Finish the entrance fade before crossing the fence, so its full
        // silhouette stays visible while it passes through the opening.
        fx.fadeIn(bug, at, 0.15);
        return bug;
      },
    };
  }

  // ------------------------------------------------------------------
  // Parking: extra features wait for their own test
  // ------------------------------------------------------------------

  function parking(parent, { x, y, w = 250, at, until, cars }) {
    const node = place(el('div', 'tdd-parking is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const sign = el('div', 'tdd-parking-sign', node);
    el('b', null, sign, 'P');
    el('span', null, sign, 'later: needs its own test');
    const lot = el('div', 'tdd-parking-lot', node);
    for (const car of cars) {
      const chip = el('div', 'tdd-parking-car is-staged', lot, car.text);
      tween(chip, [{ opacity: 0, translate: `${car.from?.[0] ?? -200}px ${car.from?.[1] ?? -80}px`, rotate: '-12deg' }, { opacity: 1, translate: '0 0', rotate: '0deg' }], car.at, 0.6, EASE.out);
    }
    tdd.enter(node, at, until);
    return { node };
  }

  // ------------------------------------------------------------------
  // End to end: a browser window with a three-step user flow
  // ------------------------------------------------------------------

  /** browser(parent, { x, y, w, at, until, steps: [{ text, iconName, at }] }) */
  function browser(parent, { x, y, w, at, until, url = 'localhost:8080/editor', steps }) {
    const node = place(el('div', 'tdd-browser is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const bar = el('div', 'tdd-browser-bar', node);
    for (let i = 0; i < 3; i++) el('span', 'tdd-browser-dot', bar);
    el('span', 'tdd-browser-url', bar, url);
    const flow = el('div', 'tdd-browser-flow', node);
    steps.forEach((step, i) => {
      if (i) {
        const arrow = el('span', 'tdd-browser-arrow is-staged', flow);
        arrow.append(icon('forward'));
        fx.fadeIn(arrow, step.at - 0.1, 0.2);
      }
      const card = el('div', 'tdd-browser-step is-staged', flow);
      card.append(icon(step.iconName));
      el('span', null, card, step.text);
      fx.pop(card, step.at, { from: 0.6 });
    });
    tdd.enter(node, at, until);
    return { node };
  }

  // ------------------------------------------------------------------
  // The limit: towers grow step by step; only a rocket reaches the moon
  // ------------------------------------------------------------------

  function moonshot(parent, { x, y, at, until, towerAt, rocketAt }) {
    const node = place(el('div', 'tdd-moon is-staged', parent), x, y);
    const art = svg('svg', { viewBox: '0 0 300 300', width: 300, height: 300, 'aria-hidden': 'true' }, node);
    const moon = svg('g', { transform: 'translate(240 50)' }, art);
    svg('circle', { class: 'tdd-moon-disc', r: 40 }, moon);
    for (const [cx, cy, r] of [[-14, -8, 9], [12, 10, 7], [6, -18, 5], [-6, 20, 4]]) svg('circle', { class: 'tdd-moon-crater', cx, cy, r }, moon);
    const floors = [];
    for (let i = 0; i < 7; i++) {
      const f = svg('g', { class: 'tdd-tower-floor', opacity: 0 }, art);
      svg('rect', { x: 40, y: 270 - (i + 1) * 30, width: 54, height: 28, rx: 2 }, f);
      for (let k = 0; k < 3; k++) svg('rect', { class: 'tdd-tower-window', x: 47 + k * 15, y: 278 - (i + 1) * 30, width: 9, height: 10 }, f);
      floors.push(f);
    }
    const rocket = svg('g', { class: 'tdd-rocket', opacity: 0 }, art);
    svg('path', { class: 'tdd-rocket-flame', d: 'M-8 34 Q0 62 8 34 Z' }, rocket);
    svg('path', { class: 'tdd-rocket-body', d: 'M0 -40 Q16 -20 14 30 H-14 Q-16 -20 0 -40 Z' }, rocket);
    svg('circle', { class: 'tdd-rocket-window', cx: 0, cy: -6, r: 7 }, rocket);
    svg('path', { class: 'tdd-rocket-fin', d: 'M-14 14 L-26 34 H-14 Z M14 14 L26 34 H14 Z' }, rocket);
    onFrame((t) => {
      floors.forEach((floor, i) => floor.setAttribute('opacity', t >= towerAt + i * 0.25 ? '1' : '0'));
      const p = clamp(progress(t, rocketAt, 1.4), 0, 1);
      rocket.setAttribute('opacity', t >= rocketAt ? '1' : '0');
      const rx = 200 - 10 * p;
      const ry = 250 - p * 160;
      rocket.setAttribute('transform', `translate(${rx.toFixed(1)} ${ry.toFixed(1)}) rotate(${(12 * p).toFixed(1)})`);
    });
    tdd.enter(node, at, until);
    return { node };
  }

  // ------------------------------------------------------------------
  // The lamp beam: tests reveal bugs where they shine
  // ------------------------------------------------------------------

  /**
   * beam(parent, { x, y, w, h, at, until, bugsIn, darkAt, mirror }) — a
   * cone of light from (x, y) spreading down-right over w × h (with
   * `mirror`, from (x + w, y) spreading down-left, for a lamp on the right
   * of the stage); ladybugs inside it are revealed (bugsIn: [[x, y, at]]);
   * from darkAt, others wait in the dark as faint eyes.
   */
  function beam(parent, { x, y, w = 420, h = 260, at, until, bugsIn = [], darkAt, mirror = false }) {
    const node = el('div', 'tdd-beam-layer is-staged', parent);
    const cone = place(el('div', `tdd-beam${mirror ? ' tdd-beam--mirror' : ''}`, node), x, y);
    cone.style.width = `${w}px`;
    cone.style.height = `${h}px`;
    for (const [bx, by, bAt] of bugsIn) tdd.bug(node, { x: bx, y: by, at: bAt, size: 46, rotate: hash01(bx) * 80 - 40 });
    if (darkAt !== undefined) {
      // Eyes wait in the dark beyond the beam, never behind the lamp.
      const around = mirror
        ? [[x - 70, y + 40], [x + 40, y + h + 26], [x - 30, y + h - 10], [x + w * 0.42, y - 44]]
        : [[x + w + 60, y + 40], [x + 90, y + h + 30], [x + w + 20, y + h - 10], [x - 140, y + 120]];
      const eyes = around.map(([ex, ey], i) => {
        const pair = place(el('div', 'tdd-beam-eyes is-staged', node), ex, ey);
        el('span', null, pair);
        el('span', null, pair);
        fx.fadeIn(pair, darkAt + i * 0.25, 0.4);
        return pair;
      });
      onFrame((t) => {
        eyes.forEach((pair, i) => {
          const phase = (t + i * 0.9) % 3.1;
          pair.style.transform = `scaleY(${phase < 0.12 ? 0.15 : 1})`;
        });
      });
    }
    fx.fadeIn(node, at, 0.4);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return { node };
  }

  window.TddProps = { floorTiles, gears, staff, noise, fence, parking, browser, moonshot, beam };
})();
