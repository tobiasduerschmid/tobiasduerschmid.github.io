/*
 * The "opera-house" stage theme for "It Works on My Machine": a gilded
 * proscenium arch with red velvet drapes, a fringed valance, a curtain that
 * rises and falls, footlights along the stage's edge, and a conductor in
 * the pit, framing the set of a software team's office: a panelled back
 * wall, an arched window whose sky follows the story's hours, a wall clock,
 * and a build-status board. Storyboards select it with `theme:
 * opera-house`; css/song-video-opera-house.css holds its look.
 *
 * The drapes, arch, curtain, and footlights sit in front of the scenes, so
 * the cast enters from the wings behind them; the HUD stays on top. The
 * choreography moves what changes through OperaHouse.of(stage): when the
 * curtain rises or falls, the clock's time, the sky, the board's lamps,
 * and the footlights' colour, each as cues of song time. Everything is a
 * pure function of song time; light changes are slow fades over small
 * areas (WCAG 2.3.1). Under reduced motion the conductor holds still.
 */
(function () {
  'use strict';

  const { onFrame, progress, easeInOutCubic, beats, hash01 } = window.Timeline;
  const { el, svg } = window.SongKit;
  const W = 960;
  const H = 540;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controls = new WeakMap();

  // The stage opening inside the arch and drapes, and its floor.
  const OPENING = { left: 40, right: 920, top: 50, floor: 404, edge: 468 };
  const SKIES = ['day', 'dusk', 'night', 'dawn'];
  const BOARD_LAMPS = 6;

  /** The value of cues [time, value, duration] at t, easing between them; numbers only. */
  function cued(cues, t, initial) {
    let value = initial;
    for (const [at, target, duration = 0.6] of cues) {
      if (t < at) break;
      const u = easeInOutCubic(progress(t, at, duration));
      value = value + (target - value) * u;
    }
    return value;
  }

  /** The panelled back wall, its window, clock, and status board, and the floor. */
  function backdrop(stage) {
    const layer = el('div', 'layer oh-back', stage);
    const art = svg('svg', { class: 'oh-art', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' }, layer);
    const defs = svg('defs', {}, art);
    const gradient = (id, attrs, stops, kind = 'linearGradient') => {
      const node = svg(kind, { id, ...attrs }, defs);
      stops.forEach((offset, i) => svg('stop', { offset, class: `${id}-stop-${i}` }, node));
      return `url(#${id})`;
    };
    const wall = gradient('oh-wall', { x1: 0, y1: 0, x2: 0, y2: 1 }, ['0', '0.7', '1']);
    const floor = gradient('oh-floor', { x1: 0, y1: 0, x2: 0, y2: 1 }, ['0', '1']);
    svg('rect', { class: 'oh-wall', x: 0, y: 0, width: W, height: OPENING.floor, fill: wall }, art);
    // Wainscot panels below a chair rail.
    svg('rect', { class: 'oh-wainscot', x: 0, y: 330, width: W, height: OPENING.floor - 330 }, art);
    svg('path', { class: 'oh-rail', d: `M0 330 H${W}` }, art);
    for (let x = 64; x < W - 40; x += 112) svg('rect', { class: 'oh-panel', x, y: 344, width: 92, height: 48, rx: 3 }, art);

    // The arched window: its skies stacked, faded in turn; a skyline; the
    // sun and the moon; then the frame and mullions over them.
    const win = svg('g', { class: 'oh-window', transform: 'translate(60 76)' }, art);
    const pane = 'M0 150 V58 A70 58 0 0 1 140 58 V150 Z';
    const clip = svg('clipPath', { id: 'oh-window-clip' }, defs);
    svg('path', { d: pane }, clip);
    const sky = svg('g', { 'clip-path': 'url(#oh-window-clip)' }, win);
    const skies = SKIES.map((name) => {
      const fill = gradient(`oh-sky-${name}`, { x1: 0, y1: 0, x2: 0, y2: 1 }, ['0', '1']);
      return svg('rect', { class: `oh-sky oh-sky--${name}`, x: 0, y: 0, width: 140, height: 150, fill, opacity: name === 'day' ? 1 : 0 }, sky);
    });
    const stars = svg('g', { class: 'oh-stars', opacity: 0 }, sky);
    for (let i = 0; i < 16; i++) svg('circle', { cx: (10 + hash01(i * 7) * 120).toFixed(1), cy: (12 + hash01(i * 13) * 60).toFixed(1), r: (0.7 + hash01(i * 3) * 0.8).toFixed(2) }, stars);
    const moon = svg('g', { class: 'oh-moon', opacity: 0 }, sky);
    svg('circle', { cx: 100, cy: 34, r: 11 }, moon);
    svg('circle', { class: 'oh-moon-shadow', cx: 105, cy: 30, r: 9.4 }, moon);
    const sun = svg('circle', { class: 'oh-sun', cx: 40, cy: 112, r: 13 }, sky);
    svg('path', { class: 'oh-skyline', d: 'M0 150 V112 H12 V96 H24 V104 H34 V84 H48 V100 H58 V90 H70 V108 H82 V78 H96 V98 H106 V92 H118 V104 H130 V96 H140 V150 Z' }, sky);
    const lit = svg('g', { class: 'oh-city-lights', opacity: 0 }, sky);
    for (const [x, y] of [[16, 116], [28, 108], [38, 92], [52, 104], [62, 96], [86, 86], [100, 104], [110, 98], [122, 110], [132, 102], [42, 120], [90, 118]]) {
      svg('rect', { x, y, width: 2.4, height: 3 }, lit);
    }
    svg('path', { class: 'oh-window-frame', d: `${pane} M70 0 V150 M0 92 H140 M20 18 L120 18` }, win);
    svg('path', { class: 'oh-window-sill', d: 'M-8 150 H148 V158 H-8 Z' }, win);

    // The wall clock, beside the window, where the props of every act stay
    // clear of it.
    const clock = svg('g', { class: 'oh-clock', transform: 'translate(252 112)' }, art);
    svg('circle', { class: 'oh-clock-rim', r: 34 }, clock);
    svg('circle', { class: 'oh-clock-face', r: 29 }, clock);
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 - 90) * Math.PI / 180;
      const [r1, r2] = i % 3 ? [24, 27] : [21, 27];
      svg('path', { class: 'oh-clock-tick', d: `M${(r1 * Math.cos(a)).toFixed(2)} ${(r1 * Math.sin(a)).toFixed(2)} L${(r2 * Math.cos(a)).toFixed(2)} ${(r2 * Math.sin(a)).toFixed(2)}` }, clock);
    }
    const hourHand = svg('path', { class: 'oh-clock-hand', d: 'M0 3 V-15' }, clock);
    const minuteHand = svg('path', { class: 'oh-clock-hand oh-clock-hand--minute', d: 'M0 4 V-23' }, clock);
    svg('circle', { class: 'oh-clock-pin', r: 2.4 }, clock);

    // The build-status board: a title plate and a row of lamps, each grey,
    // green, or red, with a tick or a cross on its lens (never colour alone).
    // It hangs high at the right, by the drapes.
    const board = svg('g', { class: 'oh-board', transform: 'translate(696 70)' }, art);
    svg('rect', { class: 'oh-board-frame', x: 0, y: 0, width: 200, height: 86, rx: 6 }, board);
    svg('rect', { class: 'oh-board-plate', x: 10, y: 8, width: 180, height: 22, rx: 3 }, board);
    const title = svg('text', { class: 'oh-board-title', x: 100, y: 24, 'text-anchor': 'middle' }, board);
    title.textContent = 'BUILD STATUS';
    const lamps = Array.from({ length: BOARD_LAMPS }, (_, i) => {
      const g = svg('g', { transform: `translate(${25 + i * 30} 58)` }, board);
      svg('circle', { class: 'oh-lamp-socket', r: 12 }, g);
      const glow = svg('circle', { class: 'oh-lamp-glow', r: 16, opacity: 0 }, g);
      const lens = svg('circle', { class: 'oh-lamp oh-lamp--off', r: 9.5 }, g);
      const tick = svg('path', { class: 'oh-lamp-mark', d: 'M-4.4 0.2 L-1.2 3.6 L4.6 -3.4', opacity: 0 }, g);
      const cross = svg('path', { class: 'oh-lamp-mark', d: 'M-3.6 -3.6 L3.6 3.6 M3.6 -3.6 L-3.6 3.6', opacity: 0 }, g);
      return { glow, lens, tick, cross, state: 'off' };
    });

    // The stage floor: boards running to the back wall.
    svg('rect', { class: 'oh-floor', x: 0, y: OPENING.floor, width: W, height: H - OPENING.floor, fill: floor }, art);
    const boards = [];
    for (let i = -10; i <= 10; i++) boards.push(`M${480 + i * 26} ${OPENING.floor} L${480 + i * 60} ${OPENING.edge}`);
    svg('path', { class: 'oh-floor-boards', d: boards.join(' ') }, art);
    svg('path', { class: 'oh-floor-seam', d: `M0 ${OPENING.floor + 20} H${W} M0 ${OPENING.floor + 44} H${W}` }, art);
    svg('rect', { class: 'oh-floor-glow', x: 0, y: OPENING.floor + 18, width: W, height: OPENING.edge - OPENING.floor - 18, fill: gradient('oh-footglow', { x1: 0, y1: 0, x2: 0, y2: 1 }, ['0', '1']) }, art);

    return { clock: { hourHand, minuteHand }, skies, stars, moon, sun, lit, lamps };
  }

  /** A velvet drape with folds: its lit ridges and shadowed troughs. */
  function drape(parent, { x, width, y = 0, height, flip = false, cls = '' }) {
    const g = svg('g', { class: `oh-drape ${cls}`, transform: flip ? `translate(${2 * x + width} 0) scale(-1 1)` : '' }, parent);
    svg('rect', { class: 'oh-velvet', x, y, width, height }, g);
    const folds = Math.max(2, Math.round(width / 14));
    for (let i = 0; i < folds; i++) {
      const fx = x + (i + 0.5) * width / folds;
      svg('path', { class: 'oh-fold-shadow', d: `M${fx + 3} ${y} C${fx + 5} ${y + height * 0.4} ${fx + 2} ${y + height * 0.7} ${fx + 4} ${y + height}` }, g);
      svg('path', { class: 'oh-fold-light', d: `M${fx - 2} ${y} C${fx - 1} ${y + height * 0.4} ${fx - 3} ${y + height * 0.7} ${fx - 2} ${y + height}` }, g);
    }
    return g;
  }

  /** The arch, valance, drapes, curtain, footlights, and the pit in front of the scenes. */
  function frontOfHouse(stage) {
    const layer = el('div', 'layer oh-front', stage);
    const art = svg('svg', { class: 'oh-art', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' }, layer);
    const defs = svg('defs', {}, art);
    const velvet = svg('linearGradient', { id: 'oh-velvet', x1: 0, y1: 0, x2: 1, y2: 0, spreadMethod: 'reflect', gradientTransform: 'scale(0.07 1)' }, defs);
    ['0', '0.5', '1'].forEach((offset, i) => svg('stop', { offset, class: `oh-velvet-stop-${i}` }, velvet));

    // The house curtain, in two halves meeting at a seam: it is flown, rising
    // into the arch to open and falling to close, so its folds only slide
    // along their own length (a curtain drawn sideways sweeps its stripes
    // across the picture, a flashing pattern). Painted before the drapes and
    // the arch, so it rises behind them.
    const halves = [0, 1].map((side) => {
      const g = svg('g', { class: 'oh-curtain' }, art);
      drape(g, { x: side ? W / 2 : 0, width: W / 2, y: 30, height: OPENING.edge - 30, flip: side === 1, cls: 'oh-drape--curtain' });
      svg('path', { class: 'oh-curtain-hem', d: side ? `M${W / 2} ${OPENING.edge - 6} H${W}` : `M0 ${OPENING.edge - 6} H${W / 2}` }, g);
      return g;
    });

    // The side drapes, tied back with gold rope and tassels.
    for (const side of [0, 1]) {
      const x = side ? W - 46 : 0;
      drape(art, { x, width: 46, height: OPENING.edge, flip: side === 1 });
      const tie = svg('g', { class: 'oh-tieback', transform: side ? `translate(${W} 0) scale(-1 1)` : '' }, art);
      svg('path', { class: 'oh-rope', d: 'M0 262 C18 268 34 272 46 266' }, tie);
      svg('path', { class: 'oh-tassel', d: 'M40 266 C44 266 46 270 45 274 L48 296 H34 L37 274 C36 270 37 266 40 266 Z' }, tie);
      svg('path', { class: 'oh-tassel-line', d: 'M38 280 V295 M41 280 V296 M44 280 V295' }, tie);
    }
    // The gilded arch over the opening, its moulding lit from above.
    svg('path', { class: 'oh-arch', d: `M0 0 H${W} V36 C${W - 120} 46 ${W - 300} 50 480 50 C300 50 120 46 0 36 Z` }, art);
    svg('path', { class: 'oh-arch-bead', d: `M0 34 C120 44 300 48 480 48 C${W - 300} 48 ${W - 120} 44 ${W} 34` }, art);
    // The fringed valance swags under it.
    const swags = svg('g', { class: 'oh-valance' }, art);
    for (let i = 0; i < 6; i++) {
      const x0 = i * 160;
      svg('path', { class: 'oh-swag', d: `M${x0} 30 C${x0 + 40} 70 ${x0 + 120} 70 ${x0 + 160} 30 Z` }, swags);
      svg('path', { class: 'oh-swag-fold', d: `M${x0 + 20} 40 C${x0 + 60} 60 ${x0 + 100} 60 ${x0 + 140} 40` }, swags);
      svg('path', { class: 'oh-fringe', d: `M${x0} 30 C${x0 + 40} 70 ${x0 + 120} 70 ${x0 + 160} 30` }, swags);
    }
    // A theatre mask cartouche at the top: comedy, for a comic opera.
    const mask = svg('g', { class: 'oh-cartouche', transform: 'translate(480 22)' }, art);
    svg('path', { class: 'oh-cartouche-shield', d: 'M-30 -12 C-20 -18 20 -18 30 -12 C32 0 24 14 0 20 C-24 14 -32 0 -30 -12 Z' }, mask);
    svg('path', { class: 'oh-mask', d: 'M-12 -9 C-6 -12 6 -12 12 -9 C13 1 8 10 0 12 C-8 10 -13 1 -12 -9 Z' }, mask);
    svg('path', { class: 'oh-mask-feature', d: 'M-8 -3 C-6 -6 -3 -6 -2 -3 M2 -3 C3 -6 6 -6 8 -3 M-6 3 C-3 8 3 8 6 3' }, mask);

    // Footlights: brass shells along the edge, each lamp's glow coloured
    // by the footlight cues (warm or green).
    const foot = svg('g', { class: 'oh-footlights' }, art);
    svg('rect', { class: 'oh-apron', x: 0, y: OPENING.edge, width: W, height: 16 }, foot);
    const bulbs = [];
    for (let x = 70; x < W - 40; x += 58) {
      svg('path', { class: 'oh-shell', d: `M${x - 14} ${OPENING.edge + 14} C${x - 14} ${OPENING.edge + 2} ${x + 14} ${OPENING.edge + 2} ${x + 14} ${OPENING.edge + 14} Z` }, foot);
      bulbs.push(svg('ellipse', { class: 'oh-bulb', cx: x, cy: OPENING.edge + 6, rx: 8, ry: 4 }, foot));
    }
    // The orchestra pit: the conductor's head and raised baton.
    const pit = svg('g', { class: 'oh-pit' }, art);
    svg('rect', { class: 'oh-pit-floor', x: 0, y: OPENING.edge + 16, width: W, height: H - OPENING.edge - 16 }, pit);
    svg('path', { class: 'oh-conductor', d: 'M462 540 C462 520 470 512 480 512 C490 512 498 520 498 540 Z M480 510 C472 510 468 503 468 496 C468 488 473 484 480 484 C487 484 492 488 492 496 C492 503 488 510 480 510 Z' }, pit);
    const baton = svg('path', { class: 'oh-baton', d: 'M494 514 L520 492' }, pit);
    return { halves, bulbs, baton };
  }

  function operaHouse(stage) {
    const back = backdrop(stage);
    const front = frontOfHouse(stage);
    const curtainCues = [];
    const clockCues = [];
    const skyCues = [];
    const boardCues = [];
    const footCues = [];

    controls.set(stage, {
      /** The curtain at `open` (0 closed … 1 open, flown out) from time `at`, moving for `duration`. */
      curtain(at, open, duration = 1.8) { curtainCues.push([at, open, duration]); curtainCues.sort((a, b) => a[0] - b[0]); },
      /** The clock turns to `hours` (decimal, 0–24) from `at` over `duration`, forwards. */
      clock(at, hours, duration = 0.8) { clockCues.push([at, hours, duration]); clockCues.sort((a, b) => a[0] - b[0]); },
      /** The window shows `sky` ('day', 'dusk', 'night', 'dawn') from `at`, fading over `duration`. */
      sky(at, sky, duration = 1.2) { skyCues.push([at, SKIES.indexOf(sky), duration]); skyCues.sort((a, b) => a[0] - b[0]); },
      /** The board's lamps from `at`: an array of 'off', 'green', or 'red', one by one `every` seconds. */
      board(at, states, every = 0) { boardCues.push([at, states, every]); boardCues.sort((a, b) => a[0] - b[0]); },
      /** The footlights' colour from `at`: 'warm', 'green', or 'out'. */
      footlights(at, colour, duration = 0.6) { footCues.push([at, colour, duration]); footCues.sort((a, b) => a[0] - b[0]); },
      OPENING,
    });

    const hands = (hours) => {
      const minutes = (hours % 1) * 60;
      back.clock.hourHand.setAttribute('transform', `rotate(${((hours % 12) * 30).toFixed(2)})`);
      back.clock.minuteHand.setAttribute('transform', `rotate(${(minutes * 6).toFixed(2)})`);
    };

    onFrame((t) => {
      // The curtain: closed at 0, open at 1, flown up past the arch.
      const open = cued(curtainCues, t, 1);
      front.halves.forEach((half) => {
        half.setAttribute('transform', `translate(0 ${(-open * OPENING.edge).toFixed(2)})`);
        half.setAttribute('opacity', open > 0.995 ? '0' : '1');
      });
      // The clock: each cue turns the hands forwards to its time.
      let hours = 9;
      for (const [at, target, duration] of clockCues) {
        if (t < at) break;
        let to = target;
        while (to < hours) to += 12;
        hours += (to - hours) * easeInOutCubic(progress(t, at, duration));
      }
      hands(hours);
      // The sky: each cue fades its sky in over the one before.
      let shown = 0, previous = 0, mix = 1;
      for (const [at, index, duration] of skyCues) {
        if (t < at) break;
        previous = shown;
        shown = index;
        mix = progress(t, at, duration);
      }
      // The newer sky lies over the one before while it fades in.
      back.skies.forEach((rect, i) => {
        rect.style.display = i === shown || i === previous ? '' : 'none';
        rect.setAttribute('opacity', i === shown && shown !== previous ? mix.toFixed(3) : '1');
      });
      const top = back.skies[shown];
      if (top.nextSibling !== back.stars) top.parentNode.insertBefore(top, back.stars);
      const night = (index) => (index === 2 ? 1 : 0);
      const nightness = night(previous) + (night(shown) - night(previous)) * mix;
      back.stars.setAttribute('opacity', nightness.toFixed(3));
      back.moon.setAttribute('opacity', nightness.toFixed(3));
      back.lit.setAttribute('opacity', Math.min(1, nightness + (shown === 1 ? mix * 0.6 : 0)).toFixed(3));
      const sunUp = (index) => (index === 0 ? 1 : index === 3 ? 0.6 : index === 1 ? 0.3 : 0);
      const sunNow = sunUp(previous) + (sunUp(shown) - sunUp(previous)) * mix;
      back.sun.setAttribute('opacity', sunNow.toFixed(3));
      back.sun.setAttribute('cy', (150 - 70 * sunNow).toFixed(1));
      // The board: the latest cue's lamps, each lit after its delay.
      let cue = null;
      for (const c of boardCues) if (c[0] <= t) cue = c;
      back.lamps.forEach((lamp, i) => {
        let state = 'off';
        if (cue) {
          const [at, states, every] = cue;
          if (t >= at + i * every) state = states[i] || 'off';
          else {
            // Lamps not yet reached keep the cue before's states.
            const before = boardCues[boardCues.indexOf(cue) - 1];
            state = before ? before[1][i] || 'off' : 'off';
          }
        }
        if (state === lamp.state) return;
        lamp.state = state;
        lamp.lens.setAttribute('class', `oh-lamp oh-lamp--${state}`);
        lamp.glow.setAttribute('class', `oh-lamp-glow oh-lamp-glow--${state}`);
        lamp.glow.setAttribute('opacity', state === 'off' ? '0' : '0.55');
        lamp.tick.setAttribute('opacity', state === 'green' ? '1' : '0');
        lamp.cross.setAttribute('opacity', state === 'red' ? '1' : '0');
      });
      // Footlights: warm, green, or out.
      let colour = 'warm', fade = 1, before = 'warm';
      for (const [at, c, duration] of footCues) {
        if (t < at) break;
        before = colour;
        colour = c;
        fade = progress(t, at, duration);
      }
      const level = (c) => (c === 'out' ? 0.15 : 1);
      const glow = level(before) + (level(colour) - level(before)) * fade;
      const tone = fade < 0.5 ? before : colour;
      for (const bulb of front.bulbs) {
        bulb.setAttribute('class', `oh-bulb oh-bulb--${tone === 'out' ? before : tone}`);
        bulb.setAttribute('opacity', glow.toFixed(3));
      }
      // The conductor beats time.
      const swing = reducedMotion.matches ? 0 : 12 * Math.sin(Math.PI * beats.at(t).phase) * (beats.index(t) % 2 ? 1 : -1);
      front.baton.setAttribute('transform', `rotate(${swing.toFixed(2)} 494 514)`);
    });
  }

  window.SongKit.themes['opera-house'] = { build: operaHouse };
  window.OperaHouse = { of: (stage) => controls.get(stage), OPENING };
})();
