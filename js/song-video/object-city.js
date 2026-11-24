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

  const { onFrame, fx, hash01, beats, clamp } = window.Timeline;
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

  /** Tyres peeking out from under a body, one pair per axle at `xs`, `half` from the centre line. */
  function wheels(g, xs, half, length = 8) {
    for (const x of xs) {
      for (const y of [-half - 1.6, half - 1.4]) svg('rect', { class: 'oc-wheel', x: x - length / 2, y, width: length, height: 3, rx: 1.2 }, g);
    }
  }

  /** Door mirrors just behind the windscreen. */
  function mirrors(g, x, half) {
    svg('rect', { class: 'oc-mirror', x, y: -half - 2.2, width: 3, height: 2.6, rx: 0.8 }, g);
    svg('rect', { class: 'oc-mirror', x, y: half - 0.4, width: 3, height: 2.6, rx: 0.8 }, g);
  }

  function carBody(g, cls) {
    svg('rect', { class: `oc-shadow`, x: -19, y: -8, width: 42, height: 20, rx: 6 }, g);
    wheels(g, [-12, 12], 10);
    svg('rect', { class: `oc-body ${cls}`, x: -21, y: -10, width: 42, height: 20, rx: 6 }, g);
    mirrors(g, 8, 10);
    // Light falls from the top of the stage: a sheen down the near side, hood creases, door seams.
    svg('rect', { class: 'oc-sheen', x: -18, y: -9, width: 35, height: 3, rx: 1.5 }, g);
    svg('path', { class: 'oc-seam', d: 'M13 -6.5 Q16 -3 18.5 -3.5 M13 6.5 Q16 3 18.5 3.5 M-3 -10 V-7.5 M-3 10 V7.5' }, g);
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
      wheels(g, [-22, 22], 12, 10);
      svg('rect', { class: 'oc-body oc-body--bus', x: -35, y: -12, width: 70, height: 24, rx: 4 }, g);
      mirrors(g, 31, 12);
      for (let i = 0; i < 5; i++) svg('rect', { class: 'oc-glass', x: -28 + i * 11, y: -9, width: 8, height: 18, rx: 1.5 }, g);
      svg('rect', { class: 'oc-glass', x: 26, y: -10, width: 6, height: 20, rx: 1.5 }, g);
      // The roof's air-conditioning unit and, on the kerb side, the front door.
      svg('rect', { class: 'oc-roof-unit', x: -12, y: -5, width: 14, height: 10, rx: 2 }, g);
      svg('path', { class: 'oc-seam', d: 'M-12 0 H2 M-5 -5 V5' }, g);
      svg('rect', { class: 'oc-door', x: 16, y: 9.5, width: 8, height: 2.5, rx: 0.8 }, g);
      svg('rect', { class: 'oc-brakelight', x: -35, y: -10, width: 2.5, height: 5, rx: 1 }, g);
      svg('rect', { class: 'oc-brakelight', x: -35, y: 5, width: 2.5, height: 5, rx: 1 }, g);
    } else if (kind === 'bike') {
      svg('path', { class: 'oc-bike-frame', d: 'M-11 0 H11' }, g);
      svg('rect', { class: 'oc-bike-wheel', x: -13, y: -1.5, width: 7, height: 3, rx: 1.5 }, g);
      svg('rect', { class: 'oc-bike-wheel', x: 6, y: -1.5, width: 7, height: 3, rx: 1.5 }, g);
      svg('path', { class: 'oc-bike-bar', d: 'M6 -5 V5' }, g);
      svg('ellipse', { class: 'oc-rider', cx: -1, cy: 0, rx: 5, ry: 6 }, g);
      // Arms reach forward to the grips; a helmet with a centre stripe.
      svg('path', { class: 'oc-rider-arm', d: 'M0 -4.5 L5.5 -4.5 M0 4.5 L5.5 4.5' }, g);
      svg('circle', { class: 'oc-rider-head', cx: 3, cy: 0, r: 3.4 }, g);
      svg('circle', { class: 'oc-helmet', cx: 2.3, cy: 0, r: 3.2 }, g);
      svg('path', { class: 'oc-helmet-stripe', d: 'M-0.6 0 H5.2' }, g);
    } else if (kind === 'ambulance') {
      svg('rect', { class: 'oc-shadow', x: -23, y: -10, width: 50, height: 24, rx: 4 }, g);
      wheels(g, [-15, 14], 12);
      svg('rect', { class: 'oc-body oc-body--ambulance', x: -25, y: -12, width: 50, height: 24, rx: 4 }, g);
      mirrors(g, 15, 12);
      // A red band down both sides.
      svg('rect', { class: 'oc-amb-stripe', x: -24, y: -11, width: 36, height: 2.4 }, g);
      svg('rect', { class: 'oc-amb-stripe', x: -24, y: 8.6, width: 36, height: 2.4 }, g);
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

  // ------------------------------------------------------------------
  // Driving: rounded routes and a speed that builds and fades
  // ------------------------------------------------------------------

  /** The signed turn, in degrees, from heading `a` to heading `b` (−180..180). */
  function turnBetween(a, b) {
    return ((((b - a) % 360) + 540) % 360) - 180;
  }

  /** Pulling away and braking each take this share of a drive's time. */
  const RAMP = 0.3;

  /**
   * The share of its route a vehicle has covered after a share `p` of the
   * drive's time. 'inOut' pulls away, cruises, and brakes to a stop; 'in'
   * pulls away and leaves at cruising speed; 'out' arrives at cruising speed
   * and brakes; 'linear' holds one speed and stops dead.
   */
  function travelled(p, ease) {
    const f = RAMP;
    if (ease === 'linear') return p;
    if (ease === 'in') return p < f ? (p * p) / (f * (2 - f)) : (2 * p - f) / (2 - f);
    if (ease === 'out') return 1 - travelled(1 - p, 'in');
    if (p < f) return (p * p) / (2 * f * (1 - f));
    if (p > 1 - f) return 1 - ((1 - p) * (1 - p)) / (2 * f * (1 - f));
    return (p - f / 2) / (1 - f);
  }

  /**
   * How far a drive of `seconds` goes when it cruises at `speed` px/s, with
   * `ease` as in drive(), so one drive can end at the speed the next begins.
   */
  function distanceFor(speed, seconds, ease = 'inOut') {
    const share = { linear: 1, in: 1 - RAMP / 2, out: 1 - RAMP / 2 }[ease] ?? 1 - RAMP;
    return speed * seconds * share;
  }

  /** Extra effort, in pixels of straight road, per degree a route turns. */
  const CORNER_EFFORT = 1.2;

  /**
   * A route through waypoints as a dense polyline: straight runs, with every
   * corner rounded into a curve that starts `turn` pixels before it (less
   * where a run is short). Returns { along(u) }: the point and heading a
   * share `u` of the way along by effort, where a degree of turning costs
   * CORNER_EFFORT pixels, so a vehicle slows into a corner and speeds up
   * out of it. The heading eases from the vehicle's own (`startA`) over the
   * first few pixels, so no drive snaps it round.
   */
  function route(start, points, turn, startA) {
    const corners = [[start.x, start.y], ...points];
    const pts = [corners[0]];
    for (let i = 1; i < corners.length; i++) {
      const [px, py] = corners[i];
      const next = corners[i + 1];
      if (!next) {
        pts.push([px, py]);
        break;
      }
      const [ax, ay] = corners[i - 1];
      const inLen = Math.hypot(px - ax, py - ay);
      const outLen = Math.hypot(next[0] - px, next[1] - py);
      const cut = Math.min(turn, inLen / 2, outLen / 2);
      if (!cut) {
        pts.push([px, py]);
        continue;
      }
      const sx = px - ((px - ax) / inLen) * cut;
      const sy = py - ((py - ay) / inLen) * cut;
      const ex = px + ((next[0] - px) / outLen) * cut;
      const ey = py + ((next[1] - py) / outLen) * cut;
      for (let k = 0; k <= 8; k++) {
        const u = k / 8;
        pts.push([
          (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * px + u * u * ex,
          (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * py + u * u * ey,
        ]);
      }
    }
    const dist = [0];
    const effort = [0];
    let lastHeading = null;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0];
      const dy = pts[i][1] - pts[i - 1][1];
      const step = Math.hypot(dx, dy);
      const heading = step ? (Math.atan2(dy, dx) * 180) / Math.PI : lastHeading;
      const bend = lastHeading === null || heading === null ? 0 : Math.abs(turnBetween(lastHeading, heading));
      lastHeading = heading;
      dist.push(dist[i - 1] + step);
      effort.push(effort[i - 1] + step + bend * CORNER_EFFORT);
    }
    const len = dist[dist.length - 1];
    const work = effort[effort.length - 1];
    /** The distance along the route at which `e` of the effort is spent. */
    function distanceAt(e) {
      const target = clamp(e, 0, work);
      let i = 1;
      while (i < pts.length - 1 && effort[i] < target) i++;
      const span = effort[i] - effort[i - 1] || 1;
      return dist[i - 1] + ((target - effort[i - 1]) / span) * (dist[i] - dist[i - 1]);
    }
    function point(d) {
      const target = clamp(d, 0, len);
      let i = 1;
      while (i < pts.length - 1 && dist[i] < target) i++;
      const span = dist[i] - dist[i - 1] || 1;
      const u = (target - dist[i - 1]) / span;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u];
    }
    const settle = Math.min(24, len / 2);
    return {
      along(u) {
        const d = distanceAt(u * work);
        const [x, y] = point(d);
        const [bx, by] = point(d - 4);
        const [fx2, fy2] = point(d + 4);
        const heading = len ? (Math.atan2(fy2 - by, fx2 - bx) * 180) / Math.PI : startA;
        const blend = settle ? clamp(d / settle, 0, 1) : 1;
        const smooth = blend * blend * (3 - 2 * blend);
        return { x, y, a: startA + turnBetween(startA, heading) * smooth };
      },
    };
  }

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
          // A parapet inset, and on some roofs an air-conditioning unit or a stair hatch.
          if (rw > 12 && rh > 12) svg('rect', { class: 'oc-roof-inset', x: cx + 3, y: by + 15, width: rw - 6, height: rh - 6, rx: 2 }, blocks);
          const fixture = hash01(qi * 61 + k * 17);
          if (fixture > 0.35 && rw > 20 && rh > 20) {
            const fx0 = cx + 5 + Math.floor(hash01(qi * 7 + k * 3) * (rw - 18));
            const fy0 = by + 17 + Math.floor(hash01(qi * 11 + k * 5) * (rh - 18));
            svg('rect', { class: fixture > 0.7 ? 'oc-roof-hatch' : 'oc-roof-ac', x: fx0, y: fy0, width: 8, height: 7, rx: 1.2 }, blocks);
          }
        }
        if (hash01(qi * 5 + k) > 0.45 && bh > 50) {
          // A two-tone canopy, lit from the top left.
          svg('circle', { class: 'oc-tree', cx: cx + rw + 7, cy: by + bh - 16, r: 6 }, blocks);
          svg('circle', { class: 'oc-tree-light', cx: cx + rw + 5.4, cy: by + bh - 17.6, r: 3 }, blocks);
        }
        cx += rw + 16;
        k += 1;
      }
    });
    // Roads, lane markings, crosswalks.
    const roads = svg('g', { class: 'oc-roads' }, art);
    // Sidewalks with a kerb line, under both roads.
    svg('rect', { class: 'oc-sidewalk', x: 0, y: roadY - 30, width: w, height: 60 }, roads);
    svg('rect', { class: 'oc-sidewalk', x: roadX - 30, y: 0, width: 60, height: h }, roads);
    svg('rect', { class: 'oc-road', x: 0, y: roadY - 26, width: w, height: 52 }, roads);
    svg('rect', { class: 'oc-road', x: roadX - 26, y: 0, width: 52, height: h }, roads);
    svg('path', { class: 'oc-kerb', d: `M0 ${roadY - 26} H${roadX - 26} V0 M${roadX + 26} 0 V${roadY - 26} H${w} M0 ${roadY + 26} H${roadX - 26} V${h} M${roadX + 26} ${h} V${roadY + 26} H${w}` }, roads);
    // Stop lines before each crosswalk, across the lane that drives toward it.
    svg('path', { class: 'oc-stop-line', d: `M${roadX - 43} ${roadY + 2} V${roadY + 25} M${roadX + 43} ${roadY - 25} V${roadY - 2} M${roadX - 25} ${roadY - 43} H${roadX - 2} M${roadX + 2} ${roadY + 43} H${roadX + 25}` }, roads);
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
      // A token's or ghost's name stays upright whichever way the vehicle faces.
      const name = body.querySelector('text');
      // Legs of motion, sorted by start time; the latest leg that has
      // started poses the vehicle (a new drive takes over from an old one).
      const initial = { x: vx, y: vy, a };
      const legs = [];
      const addLeg = (leg) => {
        legs.push(leg);
        legs.sort((p, q) => p.t0 - q.t0);
      };
      const poseAt = (t) => {
        let leg = null;
        for (const l of legs) {
          if (l.t0 > t) break;
          leg = l;
        }
        return leg ? leg.pose(Math.min(t, leg.t1)) : initial;
      };
      const flags = [];
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
         * Drive through waypoints [[x, y], …] from `from` to `to`, nose first
         * along the road, with corners rounded (`turn`, in pixels) and the
         * speed shaped by `ease` ('inOut' by default; see travelled()). One
         * waypoint with a heading, [[x, y, a]], is a glide instead: the
         * vehicle slides there while turning to `a`, for reversing and for
         * pulling aside. Add drives in time order.
         */
        drive(from, to, points, { ease = 'inOut', turn = 36 } = {}) {
          const start = poseAt(from);
          const span = Math.max(to - from, 1e-6);
          const share = (t) => travelled(clamp((t - from) / span, 0, 1), ease);
          const [gx, gy, ga] = points[points.length - 1];
          if (points.length === 1 && ga !== undefined) {
            const turnBy = turnBetween(start.a, ga);
            addLeg({
              t0: from, t1: to,
              pose: (t) => {
                const p = share(t);
                return { x: start.x + (gx - start.x) * p, y: start.y + (gy - start.y) * p, a: start.a + turnBy * p };
              },
            });
          } else {
            const path = route(start, points.map(([qx, qy]) => [qx, qy]), turn, start.a);
            addLeg({ t0: from, t1: to, pose: (t) => path.along(share(t)) });
          }
          return api;
        },
        /** Jump to a pose at time `at` (for scene cuts). */
        set(atTime, qx, qy, qa = 0) {
          const pose = { x: qx, y: qy, a: qa };
          addLeg({ t0: atTime, t1: atTime, pose: () => pose });
          return api;
        },
        flag(className, from, to = Infinity) { flags.push({ className, from, to }); return api; },
        brake(from, to) { return api.flag('is-braking', from, to); },
        show(from, to) {
          addShow(from, true);
          if (to !== undefined) addShow(to, false);
          return api;
        },
        position(t) { return poseAt(t); },
      };
      onFrame((t) => {
        if (!live(t)) return;
        let visible = shows.length === 0 || shows[0].on === false;
        for (const s of shows) if (s.at <= t) visible = s.on;
        holder.style.display = visible ? '' : 'none';
        if (!visible) return;
        const pose = poseAt(t);
        holder.setAttribute('transform', `translate(${pose.x.toFixed(1)} ${pose.y.toFixed(1)}) rotate(${pose.a.toFixed(1)})`);
        if (name) name.setAttribute('transform', `rotate(${(-pose.a).toFixed(1)})`);
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

  window.ObjectCity = { town, sprite, distanceFor, SPRITES };
})();
