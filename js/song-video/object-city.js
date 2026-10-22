/*
 * The "object-city" stage theme and town for "Let the Object Decide", the
 * object-oriented programming song (storyboard:
 * _data/songs/let_the_object_decide.yml).
 *
 * The theme is a city-builder game at dusk: a violet sky warming toward the
 * horizon, a faint skyline with lit windows, distant headlights crossing on a
 * far road, and a perspective game-board grid on the ground. It stays faint
 * so every text color drawn over it keeps 4.5:1, and nothing large changes
 * brightness quickly (WCAG 2.3.1). Storyboards select it with
 * `theme: object-city`; css/song-video-object-city.css holds its look.
 *
 * `ObjectCity.town()` draws the game window the song keeps returning to: two
 * crossing roads, a traffic light, a bus stop, and a bike lane, seen from
 * above, with vehicles whose positions and states are pure functions of song
 * time. Coordinates inside a town are town pixels (0..w, 0..h); the town
 * sits at (x, y) on the 960×540 stage.
 */
(function () {
  'use strict';

  const { onFrame, fx, hash01, beats, clamp, easeInOutCubic } = window.Timeline;
  const { el, svg, place } = window.SongKit;
  const W = 960;
  const H = 540;

  // ------------------------------------------------------------------
  // Theme: the city-builder game at dusk
  // ------------------------------------------------------------------

  /** A skyline of flat-roofed blocks; windows are lit at random but fixed. */
  function skyline(parent) {
    const g = svg('g', { class: 'oc-skyline' }, parent);
    const windows = [];
    let x = -10;
    let seed = 1;
    while (x < W + 10) {
      const w = 34 + Math.floor(hash01(seed * 17) * 46);
      const h = 50 + Math.floor(hash01(seed * 29 + 3) * 110);
      const top = 470 - h;
      svg('rect', { class: 'oc-tower', x, y: top, width: w, height: h + 80 }, g);
      if (hash01(seed * 41) > 0.6) svg('rect', { class: 'oc-tower-cap', x: x + w * 0.3, y: top - 10, width: w * 0.4, height: 10 }, g);
      for (let row = top + 10; row < 462; row += 14) {
        for (let col = x + 6; col < x + w - 8; col += 11) {
          const k = seed * 131 + row * 7 + col;
          if (hash01(k) > 0.72) {
            windows.push({ node: svg('rect', { class: 'oc-window', x: col, y: row, width: 5, height: 6 }, g), phase: hash01(k + 5) * 6.28, rate: 0.1 + hash01(k + 9) * 0.25 });
          }
        }
      }
      x += w + 4 + Math.floor(hash01(seed * 53) * 10);
      seed += 1;
    }
    return windows;
  }

  function objectCityTheme(stage) {
    const layer = el('div', 'layer oc-room', stage);
    el('div', 'oc-sky', layer);
    el('div', 'oc-sun', layer);
    const art = svg('svg', { class: 'oc-scenery', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, layer);
    const windows = skyline(art);
    // The game board: a perspective grid on the ground in front of the skyline.
    const grid = svg('g', { class: 'oc-grid' }, art);
    for (let i = -12; i <= 12; i++) svg('path', { d: `M${480 + i * 26} 470 L${480 + i * 120} 560`, class: 'oc-grid-line' }, grid);
    for (const y of [478, 490, 506, 528]) svg('path', { d: `M0 ${y} H${W}`, class: 'oc-grid-line' }, grid);
    // Distant headlights on a far road along the horizon.
    const lights = Array.from({ length: 6 }, (_, i) => ({
      node: svg('circle', { class: i % 2 ? 'oc-car-light oc-car-light--tail' : 'oc-car-light', r: 1.8, cy: i % 2 ? 474 : 476 }, art),
      speed: 26 + hash01(i * 7) * 30,
      offset: hash01(i * 13) * W,
      dir: i % 2 ? -1 : 1,
    }));
    onFrame((t) => {
      for (const w of windows) w.node.style.opacity = (0.55 + 0.45 * Math.sin(t * w.rate + w.phase)).toFixed(2);
      for (const l of lights) {
        const x = ((l.offset + l.dir * l.speed * t) % (W + 40) + W + 40) % (W + 40) - 20;
        l.node.setAttribute('cx', x.toFixed(1));
      }
      const pulse = beats.pulse(t, 0.3);
      grid.style.opacity = (0.75 + 0.25 * pulse).toFixed(2);
    });
    el('div', 'layer vignette oc-vignette', stage);
    return layer;
  }

  window.SongKit.themes['object-city'] = { build: objectCityTheme };

  // ------------------------------------------------------------------
  // Vehicles: top-down sprites drawn once as <symbol>s
  // ------------------------------------------------------------------

  /** Sprite geometry, facing +x; every sprite is centered on its origin. */
  const SPRITES = {
    car: { w: 42, h: 20 },
    hybrid: { w: 42, h: 20 },
    bus: { w: 70, h: 24 },
    bike: { w: 24, h: 10 },
    ambulance: { w: 50, h: 24 },
    token: { w: 40, h: 24 },
  };

  function carBody(g, cls) {
    svg('rect', { class: `oc-shadow`, x: -19, y: -8, width: 42, height: 20, rx: 6 }, g);
    svg('rect', { class: `oc-body ${cls}`, x: -21, y: -10, width: 42, height: 20, rx: 6 }, g);
    svg('rect', { class: 'oc-glass', x: 2, y: -8, width: 9, height: 16, rx: 2.5 }, g);
    svg('rect', { class: 'oc-glass', x: -15, y: -7.5, width: 6, height: 15, rx: 2 }, g);
    svg('rect', { class: 'oc-roof', x: -9, y: -8, width: 11, height: 16, rx: 2 }, g);
    svg('rect', { class: 'oc-headlight', x: 18.5, y: -8, width: 2.5, height: 4, rx: 1 }, g);
    svg('rect', { class: 'oc-headlight', x: 18.5, y: 4, width: 2.5, height: 4, rx: 1 }, g);
    svg('rect', { class: 'oc-brakelight', x: -21, y: -8, width: 2.5, height: 4, rx: 1 }, g);
    svg('rect', { class: 'oc-brakelight', x: -21, y: 4, width: 2.5, height: 4, rx: 1 }, g);
  }

  function drawSprite(kind, g, label) {
    if (kind === 'car') {
      carBody(g, 'oc-body--car');
    } else if (kind === 'hybrid') {
      carBody(g, 'oc-body--hybrid');
      // A lightning badge on the roof marks the hybrid without colour alone.
      svg('path', { class: 'oc-bolt', d: 'M-2 -6 L-6 1 L-3 1 L-5 6 L1 -1 L-2 -1 Z' }, g);
    } else if (kind === 'bus') {
      svg('rect', { class: 'oc-shadow', x: -33, y: -10, width: 70, height: 24, rx: 4 }, g);
      svg('rect', { class: 'oc-body oc-body--bus', x: -35, y: -12, width: 70, height: 24, rx: 4 }, g);
      for (let i = 0; i < 5; i++) svg('rect', { class: 'oc-glass', x: -28 + i * 11, y: -9, width: 8, height: 18, rx: 1.5 }, g);
      svg('rect', { class: 'oc-glass', x: 26, y: -10, width: 6, height: 20, rx: 1.5 }, g);
      svg('rect', { class: 'oc-brakelight', x: -35, y: -10, width: 2.5, height: 5, rx: 1 }, g);
      svg('rect', { class: 'oc-brakelight', x: -35, y: 5, width: 2.5, height: 5, rx: 1 }, g);
    } else if (kind === 'bike') {
      svg('path', { class: 'oc-bike-frame', d: 'M-11 0 H11' }, g);
      svg('rect', { class: 'oc-bike-wheel', x: -13, y: -1.5, width: 7, height: 3, rx: 1.5 }, g);
      svg('rect', { class: 'oc-bike-wheel', x: 6, y: -1.5, width: 7, height: 3, rx: 1.5 }, g);
      svg('path', { class: 'oc-bike-bar', d: 'M6 -5 V5' }, g);
      svg('ellipse', { class: 'oc-rider', cx: -1, cy: 0, rx: 5, ry: 6 }, g);
      svg('circle', { class: 'oc-rider-head', cx: 3, cy: 0, r: 3.4 }, g);
    } else if (kind === 'ambulance') {
      svg('rect', { class: 'oc-shadow', x: -23, y: -10, width: 50, height: 24, rx: 4 }, g);
      svg('rect', { class: 'oc-body oc-body--ambulance', x: -25, y: -12, width: 50, height: 24, rx: 4 }, g);
      svg('rect', { class: 'oc-glass', x: 12, y: -9, width: 8, height: 18, rx: 2 }, g);
      svg('path', { class: 'oc-cross', d: 'M-9 -2 H-3 V-8 H3 V-2 H9 V4 H3 V10 H-3 V4 H-9 Z', transform: 'scale(0.75) translate(-4 -1)' }, g);
      svg('rect', { class: 'oc-lightbar', x: 4, y: -10, width: 5, height: 20, rx: 1.5 }, g);
      svg('rect', { class: 'oc-brakelight', x: -25, y: -10, width: 2.5, height: 5, rx: 1 }, g);
      svg('rect', { class: 'oc-brakelight', x: -25, y: 5, width: 2.5, height: 5, rx: 1 }, g);
    } else if (kind === 'token') {
      svg('rect', { class: 'oc-token', x: -20, y: -12, width: 40, height: 24, rx: 5 }, g);
      svg('text', { class: 'oc-token-label', x: 0, y: 4.5, 'text-anchor': 'middle' }, g).textContent = label;
    } else if (kind === 'ghost') {
      svg('rect', { class: 'oc-ghost', x: -26, y: -11, width: 52, height: 22, rx: 6 }, g);
      svg('text', { class: 'oc-ghost-label', x: 0, y: 4.5, 'text-anchor': 'middle' }, g).textContent = label;
    }
  }

  /**
   * Interpolates keyframes [{ t, x, y, a, ease }] (sorted by t). A key's
   * `ease` shapes the segment that ends at it: 'linear', 'step' (hold the
   * previous pose, then cut), or eased by default.
   */
  function poseAt(keys, t) {
    if (t <= keys[0].t) return keys[0];
    for (let i = 1; i < keys.length; i++) {
      const k0 = keys[i - 1];
      const k1 = keys[i];
      if (t < k1.t) {
        if (k1.ease === 'step' || !Number.isFinite(k0.t)) return k0;
        const raw = (t - k0.t) / (k1.t - k0.t);
        const p = k1.ease === 'linear' ? raw : easeInOutCubic(raw);
        return { x: k0.x + (k1.x - k0.x) * p, y: k0.y + (k1.y - k0.y) * p, a: k0.a + (k1.a - k0.a) * p };
      }
    }
    return keys[keys.length - 1];
  }

  /** Dance moves on the beat: each kind answers the same beat its own way. */
  const DANCES = {
    car: (p) => ({ rotate: 14 * p, dx: -3 * p, sx: 1, sy: 1 }),          // a drift
    hybrid: (p) => ({ rotate: -8 * p, dx: 0, sx: 1 + 0.08 * p, sy: 1 + 0.08 * p }),
    bus: (p) => ({ rotate: 0, dx: 0, sx: 1 + 0.06 * p, sy: 1 - 0.22 * p }), // kneels
    bike: (p) => ({ rotate: -24 * p, dx: 2 * p, sx: 1, sy: 1 }),          // a wheelie
    ambulance: (p) => ({ rotate: 6 * p, dx: 0, sx: 1 + 0.05 * p, sy: 1 + 0.05 * p }),
    token: () => ({ rotate: 0, dx: 0, sx: 1, sy: 1 }),
    ghost: () => ({ rotate: 0, dx: 0, sx: 1, sy: 1 }),
  };

  // ------------------------------------------------------------------
  // The town: a game window with roads, a traffic light, and vehicles
  // ------------------------------------------------------------------

  /**
   * town(parent, { x, y, w = 440, h = 280, at, until, title, scale })
   * Roads: a horizontal road (lanes at y = laneE / laneW), a vertical road
   * (x = 186), a bike lane above the horizontal road, a bus stop below it,
   * and a traffic light at the intersection's north-east corner.
   */
  function town(parent, { x, y, w = 440, h = 280, at, until, title = 'City Builder', scale = 1, frame = true }) {
    const node = place(el('div', `oc-town${frame ? '' : ' oc-town--bare'} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    if (scale !== 1) node.style.scale = scale;
    if (frame) {
      const bar = el('div', 'oc-town-bar', node);
      for (let i = 0; i < 3; i++) el('span', 'oc-town-dot', bar);
      el('span', 'oc-town-title', bar, title);
    }
    const art = svg('svg', { class: 'oc-town-map', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, node);
    const roadY = Math.round(h * 0.53);
    const roadX = 186;
    const geo = {
      w, h, roadY, roadX,
      laneE: roadY + 13, laneW: roadY - 13, laneS: roadX - 13, laneN: roadX + 13,
      bikeY: roadY - 36, stopX: w - 100, stopY: roadY + 13,
      light: { x: roadX + 40, y: roadY - 58 },
    };
    // Blocks with rooftops and trees in the four corners.
    const blocks = svg('g', { class: 'oc-blocks' }, art);
    const quads = [[0, 0, roadX - 30, roadY - 44], [roadX + 30, 0, w - roadX - 30, roadY - 44], [0, roadY + 30, roadX - 30, h - roadY - 30], [roadX + 30, roadY + 30, w - roadX - 30, h - roadY - 30]];
    quads.forEach(([bx, by, bw, bh], qi) => {
      svg('rect', { class: 'oc-lot', x: bx + 4, y: by + 4, width: Math.max(0, bw - 8), height: Math.max(0, bh - 8), rx: 6 }, blocks);
      let cx = bx + 12;
      let k = 0;
      while (cx < bx + bw - 30) {
        const rw = 26 + Math.floor(hash01(qi * 97 + k * 13) * 22);
        const rh = Math.max(18, Math.min(bh - 24, 22 + Math.floor(hash01(qi * 31 + k * 7) * 30)));
        if (bh > 40) {
          const roofs = svg('rect', { class: 'oc-roof-block', x: cx, y: by + 12, width: rw, height: rh, rx: 3 }, blocks);
          roofs.dataset.ocBlock = '';
        }
        if (hash01(qi * 5 + k) > 0.45 && bh > 50) svg('circle', { class: 'oc-tree', cx: cx + rw + 7, cy: by + bh - 16, r: 6 }, blocks);
        cx += rw + 16;
        k += 1;
      }
    });
    // Roads, lane markings, crosswalks.
    const roads = svg('g', { class: 'oc-roads' }, art);
    svg('rect', { class: 'oc-road', x: 0, y: roadY - 26, width: w, height: 52 }, roads);
    svg('rect', { class: 'oc-road', x: roadX - 26, y: 0, width: 52, height: h }, roads);
    svg('path', { class: 'oc-lane-dash', d: `M0 ${roadY} H${roadX - 30} M${roadX + 30} ${roadY} H${w}` }, roads);
    svg('path', { class: 'oc-lane-dash', d: `M${roadX} 0 V${roadY - 30} M${roadX} ${roadY + 30} V${h}` }, roads);
    for (let i = 0; i < 5; i++) {
      svg('rect', { class: 'oc-zebra', x: roadX + 30, y: roadY - 24 + i * 10, width: 8, height: 5 }, roads);
      svg('rect', { class: 'oc-zebra', x: roadX - 38, y: roadY - 24 + i * 10, width: 8, height: 5 }, roads);
    }
    // The bike lane: a tinted strip with a painted bike glyph (shape, not colour alone).
    svg('rect', { class: 'oc-bikelane', x: 0, y: geo.bikeY - 7, width: roadX - 26, height: 14 }, roads);
    svg('rect', { class: 'oc-bikelane', x: roadX + 26, y: geo.bikeY - 7, width: w - roadX - 26, height: 14 }, roads);
    for (const bx of [60, w - 80]) {
      svg('circle', { class: 'oc-bikelane-glyph', cx: bx - 5, cy: geo.bikeY, r: 3.2 }, roads);
      svg('circle', { class: 'oc-bikelane-glyph', cx: bx + 5, cy: geo.bikeY, r: 3.2 }, roads);
    }
    // The bus stop: a shelter and a sign on the south sidewalk.
    const stop = svg('g', { class: 'oc-busstop', transform: `translate(${geo.stopX} ${roadY + 30})` }, art);
    svg('rect', { class: 'oc-shelter', x: -24, y: 0, width: 48, height: 12, rx: 2 }, stop);
    svg('rect', { class: 'oc-stop-sign', x: 28, y: -2, width: 26, height: 14, rx: 3 }, stop);
    svg('text', { class: 'oc-stop-label', x: 41, y: 8.5, 'text-anchor': 'middle' }, stop).textContent = 'BUS';
    // The traffic light: a side-view signal so red, amber, green read by position too.
    const lightG = svg('g', { class: 'oc-signal', transform: `translate(${geo.light.x} ${geo.light.y})` }, art);
    svg('rect', { class: 'oc-signal-pole', x: -1.5, y: 30, width: 3, height: 22 }, lightG);
    svg('rect', { class: 'oc-signal-box', x: -8, y: -4, width: 16, height: 38, rx: 4 }, lightG);
    const lamps = ['red', 'amber', 'green'].map((c, i) => svg('circle', { class: `oc-lamp oc-lamp--${c}`, cx: 0, cy: 4 + i * 11, r: 4 }, lightG));
    const stopLabel = svg('text', { class: 'oc-signal-stop', x: 0, y: -9, 'text-anchor': 'middle' }, lightG);
    stopLabel.textContent = 'STOP';
    const signal = [{ at: -Infinity, color: 'green' }];
    onFrame((t) => {
      let color = 'green';
      for (const s of signal) if (s.at <= t) color = s.color;
      lamps.forEach((lamp, i) => lamp.classList.toggle('is-on', ['red', 'amber', 'green'][i] === color));
      stopLabel.style.opacity = color === 'red' ? '1' : '0';
    });
    // Vehicles above the roads; overlays (bubbles, arms) above the vehicles.
    const fleet = svg('g', { class: 'oc-fleet' }, art);
    const overlay = svg('g', { class: 'oc-overlay' }, art);

    if (at !== undefined) fx.rise(node, at, { distance: 18, duration: 0.45 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    // Vehicles pose only while their town can be on screen (its parent scene
    // may start earlier, so leave a margin before `at`).
    const live = (t) => (at === undefined || t >= at - 1.5) && (until === undefined || t <= until + 0.5);

    function vehicle(kind, { x: vx, y: vy, a = 0, at: vAt, until: vUntil, label, cls } = {}) {
      const holder = svg('g', { class: `oc-vehicle oc-vehicle--${kind}${cls ? ` ${cls}` : ''}` }, fleet);
      const body = svg('g', { class: 'oc-vehicle-body' }, holder);
      drawSprite(kind, body, label);
      const keys = [{ t: -Infinity, x: vx, y: vy, a }];
      const flags = [];
      const dances = [];
      // Visibility events; with none, the vehicle is always shown.
      const shows = [];
      const addShow = (atTime, on) => {
        shows.push({ at: atTime, on });
        shows.sort((p, q) => p.at - q.at);
      };
      if (vAt !== undefined) addShow(vAt, true);
      if (vUntil !== undefined) addShow(vUntil, false);
      const api = {
        node: holder,
        kind,
        /**
         * Drive through waypoints [[x, y, a?], …] from `from` to `to` at a
         * steady speed (one waypoint: an eased glide). Add drives in time order.
         */
        drive(from, to, points, { ease } = {}) {
          const start = poseAt(keys, from);
          keys.push({ t: from, x: start.x, y: start.y, a: start.a });
          let len = 0;
          let px = start.x;
          let py = start.y;
          const lens = points.map(([qx, qy]) => {
            len += Math.hypot(qx - px, qy - py);
            px = qx;
            py = qy;
            return len;
          });
          points.forEach(([qx, qy, qa], i) => {
            const prev = i ? points[i - 1] : [start.x, start.y];
            const angle = qa !== undefined ? qa : (Math.atan2(qy - prev[1], qx - prev[0]) * 180) / Math.PI;
            keys.push({ t: from + ((to - from) * lens[i]) / (len || 1), x: qx, y: qy, a: angle, ease: points.length > 1 ? 'linear' : ease });
          });
          keys.sort((p, q) => p.t - q.t);
          return api;
        },
        /** Jump to a pose at time `at` (for scene cuts). */
        set(atTime, qx, qy, qa = 0) {
          keys.push({ t: atTime, x: qx, y: qy, a: qa, ease: 'step' });
          keys.sort((p, q) => p.t - q.t);
          return api;
        },
        flag(className, from, to = Infinity) { flags.push({ className, from, to }); return api; },
        brake(from, to) { return api.flag('is-braking', from, to); },
        dance(from, to) { dances.push({ from, to }); return api; },
        show(from, to) {
          addShow(from, true);
          if (to !== undefined) addShow(to, false);
          return api;
        },
        position(t) { return poseAt(keys, t); },
      };
      onFrame((t) => {
        if (!live(t)) return;
        let visible = shows.length === 0 || shows[0].on === false;
        for (const s of shows) if (s.at <= t) visible = s.on;
        holder.style.display = visible ? '' : 'none';
        if (!visible) return;
        const pose = poseAt(keys, t);
        holder.setAttribute('transform', `translate(${pose.x.toFixed(1)} ${pose.y.toFixed(1)}) rotate(${pose.a.toFixed(1)})`);
        let move = { rotate: 0, dx: 0, sx: 1, sy: 1 };
        for (const d of dances) {
          if (t >= d.from && t < d.to) move = DANCES[kind](beats.pulse(t, 0.22));
        }
        body.setAttribute('transform', `translate(${move.dx.toFixed(2)} 0) rotate(${move.rotate.toFixed(2)}) scale(${move.sx.toFixed(3)} ${move.sy.toFixed(3)})`);
        for (const f of flags) holder.classList.toggle(f.className, t >= f.from && t < f.to);
      });
      return api;
    }

    /** A speech bubble above a town point, in town pixels. */
    function bubble(text, { x: bx, y: by, at: bAt, until: bUntil, follow }) {
      const g = svg('g', { class: 'oc-bubble' }, overlay);
      const width = 12 + text.length * 7.6;
      svg('rect', { class: 'oc-bubble-box', x: -width / 2, y: -30, width, height: 22, rx: 8 }, g);
      svg('path', { class: 'oc-bubble-box', d: 'M-5 -9 L0 -2 L5 -9 Z' }, g);
      svg('text', { class: 'oc-bubble-text', x: 0, y: -14.5, 'text-anchor': 'middle' }, g).textContent = text;
      onFrame((t) => {
        const on = t >= bAt && (bUntil === undefined || t < bUntil);
        g.style.display = on ? '' : 'none';
        if (!on) return;
        const p = follow ? follow.position(t) : { x: bx, y: by };
        const pop = clamp((t - bAt) / 0.18, 0, 1);
        g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${(p.y - 8).toFixed(1)}) scale(${(0.6 + 0.4 * pop).toFixed(2)})`);
        g.style.opacity = pop.toFixed(2);
      });
      return g;
    }

    return {
      node, art, fleet, overlay, geo, x, y, w, h,
      vehicle,
      bubble,
      /** Signal colour changes: signal('red', at). */
      signal(color, atTime) {
        signal.push({ at: atTime, color });
        signal.sort((p, q) => p.at - q.at);
      },
      /** Stage coordinates of a town point. */
      toStage(px, py) { return [x + px * scale, y + (frame ? 26 : 0) * scale + py * scale]; },
      lamps,
    };
  }

  /**
   * sprite(parent, kind, { x, y, scale, at, until }) — one vehicle drawn
   * large on its own, with a hood (`.hood`, a flap over the front quarter
   * that a choreography can rotate open). Returns { node, hood, flag, bump }.
   */
  function sprite(parent, kind, { x, y, scale = 4, at, until }) {
    const { w, h } = SPRITES[kind];
    const node = place(el('div', 'oc-sprite is-staged', parent), x, y);
    const art = svg('svg', { viewBox: `${-w / 2 - 4} ${-h / 2 - 4} ${w + 8} ${h + 8}`, width: (w + 8) * scale, height: (h + 8) * scale, 'aria-hidden': 'true' }, node);
    const holder = svg('g', { class: `oc-vehicle oc-vehicle--${kind}` }, art);
    drawSprite(kind, holder);
    const hood = svg('rect', { class: 'oc-hood', x: w / 2 - 14, y: -h / 2 + 1, width: 12, height: h - 2, rx: 2 }, holder);
    hood.style.transformOrigin = `${w / 2 - 14}px 0px`;
    hood.style.transformBox = 'view-box';
    if (at !== undefined) fx.rise(node, at, { distance: 24, duration: 0.45 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    const flags = [];
    onFrame((t) => {
      for (const f of flags) holder.classList.toggle(f.className, t >= f.from && t < f.to);
    });
    return {
      node,
      hood,
      flag(className, from, to = Infinity) { flags.push({ className, from, to }); },
      bump(atTime) { fx.bump(node, atTime, 0.06); },
    };
  }

  window.ObjectCity = { town, sprite, SPRITES };
})();
