/*
 * The "frontier" stage theme for "Design It In Before They Break In", the security song: a
 * frontier town at dusk behind the scenes. Storyboards select it with
 * `theme: frontier`; css/song-video-frontier.css holds its colours.
 *
 * Back to front: a dusk sky with the low sun and a few long clouds; mesas
 * on the horizon; and a desert town built of computing, each building a
 * metaphor in a frontier silhouette: false-front saloons that are server
 * racks (rack-unit slots, vents, and status LEDs for windows), general
 * stores stacked from software modules (crates with connector pins and
 * sockets), a water tower whose tank is a database (the stacked-disk
 * cylinder), a radio mast where the church steeple stood, a router shack
 * with antennas, and a windmill. One network cable comes in from the
 * desert on the left and runs through every building, plugged into a jack
 * on each, over two telegraph poles to the router shack, and small data
 * packets travel along it both ways. The dusty main street lies in front,
 * where the player draws captions. A few things move, slowly and faintly:
 * the clouds drift, the windmill turns, the packets travel, the LEDs come
 * on one by one as the evening comes, dust motes float, and now and then a
 * tumbleweed rolls along the street. Over the last half minute night
 * falls: the sky deepens and the stars come out.
 *
 * The scenery stays dim (the scenes' text sits on its own cards, never on
 * the sky), and nothing large changes brightness quickly (WCAG 2.3.1): the
 * windows fade in over seconds and nightfall takes twenty. Everything is a
 * pure function of song time; with reduced motion the town holds still.
 */
(function () {
  'use strict';

  const { onFrame, clamp, easeInOutCubic, hash01 } = window.Timeline;
  const { el, svg } = window.SongKit;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const W = 960, H = 540, HORIZON = 404, STREET = 456;
  /** Seconds before the end when night starts falling, and when it has fallen. */
  const NIGHTFALL = [34, 12];
  const span = (t, [a, b]) => clamp((t - a) / (b - a), 0, 1);

  /** A long, flat dusk cloud. */
  function cloud(parent, scale) {
    const g = svg('g', { class: 'fr-cloud' }, parent);
    svg('path', { d: 'M0 14 C10 4 30 2 44 8 C56 0 82 0 96 8 C110 4 130 6 140 14 Z', transform: `scale(${scale})` }, g);
    svg('path', { class: 'fr-cloud-lit', d: 'M8 13 C18 7 34 6 44 10 C58 4 80 4 94 10 C108 7 124 9 132 13 Z', transform: `scale(${scale})` }, g);
    return g;
  }

  /** Status LEDs (lit later, in `windows`) at points [[x, y], …]. */
  function leds(parent, windows, points, tone = 'green') {
    for (const [x, y] of points) {
      svg('rect', { class: 'fr-led-off', x: x - 1.6, y: y - 1.2, width: 3.2, height: 2.4 }, parent);
      const lit = svg('rect', { class: `fr-led fr-led--${tone}`, x: x - 1.6, y: y - 1.2, width: 3.2, height: 2.4, opacity: 0 }, parent);
      windows.push({ lit, at: hash01(windows.length * 11 + 3) });
    }
  }

  /** A network jack on a building, where the town's cable plugs in; returns its point. */
  function jack(parent, x, y) {
    svg('rect', { class: 'fr-jack', x: x - 2.6, y: y - 2.2, width: 5.2, height: 4.4, rx: 1 }, parent);
    return [x, y];
  }

  /**
   * A server rack as a saloon: a false front over a cabinet of rack-unit
   * slots, each with status LEDs and a vent, a porch roof on posts, and
   * swinging doors (`arched` gives it a rounded data-centre front).
   */
  function rackSaloon(parent, windows, { x, w, h, units, arched = false }) {
    const g = svg('g', { class: 'fr-building' }, parent);
    const top = HORIZON - h;
    svg('path', { class: 'fr-wall', d: `M${x} ${HORIZON} V${top + 12} H${x + w} V${HORIZON} Z` }, g);
    svg('path', { class: 'fr-front', d: arched
      ? `M${x - 4} ${top + 12} V${top} Q${x + w / 2} ${top - 16} ${x + w + 4} ${top} V${top + 12} Z`
      : `M${x - 4} ${top + 12} V${top} H${x + w + 4} V${top + 12} Z` }, g);
    const unitH = (h - 46) / units;
    for (let u = 0; u < units; u += 1) {
      const y = top + 16 + u * unitH;
      svg('rect', { class: 'fr-unit', x: x + 6, y, width: w - 12, height: unitH - 3, rx: 1 }, g);
      svg('path', { class: 'fr-vent', d: Array.from({ length: Math.floor((w - 34) / 5) }, (_, k) => `M${x + 24 + k * 5} ${(y + 2).toFixed(1)} V${(y + unitH - 5).toFixed(1)}`).join(' ') }, g);
      leds(g, windows, [[x + 12, y + (unitH - 3) / 2], [x + 17, y + (unitH - 3) / 2]], u % 3 === 1 ? 'amber' : 'green');
    }
    svg('path', { class: 'fr-porch', d: `M${x - 6} ${HORIZON - 26} L${x + w + 6} ${HORIZON - 26} L${x + w + 2} ${HORIZON - 21} L${x - 2} ${HORIZON - 21} Z` }, g);
    for (const px of [x, x + w]) svg('rect', { class: 'fr-post', x: px - 1, y: HORIZON - 21, width: 2, height: 21 }, g);
    svg('path', { class: 'fr-door', d: `M${x + w / 2 - 8} ${HORIZON - 16} h7 v10 h-7 Z M${x + w / 2 + 1} ${HORIZON - 16} h7 v10 h-7 Z` }, g);
    return jack(g, x + w + 4, top + 5);
  }

  /**
   * A general store stacked from software modules: crates with connector
   * pins on one side and sockets on the other, plugged together in rows,
   * a false front on top, and an LED on each crate.
   */
  function moduleStore(parent, windows, { x, w, rows = 3, cols = 2 }) {
    const g = svg('g', { class: 'fr-building' }, parent);
    const cw = w / cols, ch = 22;
    const top = HORIZON - rows * ch;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const bx = x + c * cw, by = HORIZON - (r + 1) * ch;
        svg('rect', { class: 'fr-module', x: bx + 1, y: by + 1, width: cw - 2, height: ch - 2, rx: 2 }, g);
        svg('path', { class: 'fr-pin', d: `M${bx + cw - 1} ${by + 7} h3 M${bx + cw - 1} ${by + 14} h3` }, g);
        svg('path', { class: 'fr-socket', d: `M${bx + 4} ${by + 6} v3 M${bx + 4} ${by + 13} v3` }, g);
        leds(g, windows, [[bx + cw / 2, by + ch / 2]], 'amber');
      }
    }
    svg('path', { class: 'fr-front', d: `M${x - 3} ${top} V${top - 14} H${x + w + 3} V${top} Z` }, g);
    svg('path', { class: 'fr-porch', d: `M${x - 6} ${HORIZON - 24} L${x + w + 6} ${HORIZON - 24} L${x + w + 2} ${HORIZON - 19} L${x - 2} ${HORIZON - 19} Z` }, g);
    return jack(g, x + w + 3, top - 9);
  }

  /** A router shack: a low cabin with antennas on its roof and a row of port LEDs. */
  function routerShack(parent, windows, { x, w }) {
    const g = svg('g', { class: 'fr-building' }, parent);
    const top = HORIZON - 44;
    svg('path', { class: 'fr-wall', d: `M${x} ${HORIZON} V${top} H${x + w} V${HORIZON} Z` }, g);
    svg('path', { class: 'fr-front', d: `M${x - 4} ${top + 4} L${x + w / 2} ${top - 12} L${x + w + 4} ${top + 4} Z` }, g);
    svg('path', { class: 'fr-leg', d: `M${x + 12} ${top - 6} V${top - 34} M${x + w - 12} ${top - 6} V${top - 30}` }, g);
    for (const ax of [x + 12, x + w - 12]) svg('circle', { class: 'fr-tank', cx: ax, cy: top - 36, r: 2.4 }, g);
    leds(g, windows, Array.from({ length: 5 }, (_, k) => [x + 12 + k * ((w - 24) / 4), top + 14]), 'green');
    svg('rect', { class: 'fr-door', x: x + w / 2 - 5, y: HORIZON - 18, width: 10, height: 18 }, g);
    return jack(g, x - 4, top + 2);
  }

  /** A radio mast where the steeple stood: a lattice spire, dishes, and faint signal arcs (returned). */
  function radioMast(parent, windows, x) {
    const g = svg('g', { class: 'fr-building' }, parent);
    svg('path', { class: 'fr-wall', d: `M${x - 30} ${HORIZON} V${HORIZON - 56} L${x} ${HORIZON - 78} L${x + 30} ${HORIZON - 56} V${HORIZON} Z` }, g);
    svg('path', { class: 'fr-leg', d: `M${x - 8} ${HORIZON - 70} L${x} ${HORIZON - 150} L${x + 8} ${HORIZON - 70} M${x - 6} ${HORIZON - 92} L${x + 5} ${HORIZON - 106} M${x + 6} ${HORIZON - 92} L${x - 5} ${HORIZON - 106} M${x - 4} ${HORIZON - 118} L${x + 3} ${HORIZON - 130}` }, g);
    svg('path', { class: 'fr-tank', d: `M${x + 4} ${HORIZON - 112} a8 8 0 0 1 10 -8 l-3 9 Z M${x - 4} ${HORIZON - 96} a8 8 0 0 0 -10 -8 l3 9 Z` }, g);
    leds(g, windows, [[x, HORIZON - 152]], 'amber');
    const arcs = svg('g', { class: 'fr-signal' }, g);
    for (const r of [10, 18, 26]) svg('path', { d: `M${x - r * 0.7} ${HORIZON - 152 - r * 0.7} A${r} ${r} 0 0 1 ${x + r * 0.7} ${HORIZON - 152 - r * 0.7}` }, arcs);
    svg('rect', { class: 'fr-door', x: x - 6, y: HORIZON - 20, width: 12, height: 20 }, g);
    return { arcs, jack: jack(g, x + 9, HORIZON - 84) };
  }

  /** The water tower holds the town's data: its tank is the database cylinder of stacked disks. */
  function databaseTower(parent, windows, x) {
    const g = svg('g', { class: 'fr-tower' }, parent);
    svg('path', { class: 'fr-leg', d: `M${x - 18} ${HORIZON} L${x - 12} ${HORIZON - 58} M${x + 18} ${HORIZON} L${x + 12} ${HORIZON - 58} M${x - 6} ${HORIZON} L${x - 4} ${HORIZON - 58} M${x + 6} ${HORIZON} L${x + 4} ${HORIZON - 58} M${x - 16} ${HORIZON - 20} L${x + 16} ${HORIZON - 36} M${x + 16} ${HORIZON - 20} L${x - 16} ${HORIZON - 36}` }, g);
    const top = HORIZON - 112, bottom = HORIZON - 58, rx = 22, ry = 6;
    svg('path', { class: 'fr-tank', d: `M${x - rx} ${top} V${bottom} A${rx} ${ry} 0 0 0 ${x + rx} ${bottom} V${top} Z` }, g);
    for (const y of [top + 18, top + 36]) svg('path', { class: 'fr-disk', d: `M${x - rx} ${y} A${rx} ${ry} 0 0 0 ${x + rx} ${y}` }, g);
    svg('ellipse', { class: 'fr-tank-top', cx: x, cy: top, rx, ry }, g);
    leds(g, windows, [[x + 14, top + 12], [x + 14, top + 30], [x + 14, top + 48]], 'green');
    return jack(g, x + rx + 2, bottom - 8);
  }

  /** The windmill: a lattice tower and a wheel of blades that turns (returned). */
  function windmill(parent, x) {
    const g = svg('g', { class: 'fr-windmill' }, parent);
    svg('path', { class: 'fr-leg', d: `M${x - 10} ${HORIZON} L${x - 2} ${HORIZON - 96} M${x + 10} ${HORIZON} L${x + 2} ${HORIZON - 96} M${x - 8} ${HORIZON - 22} L${x + 7} ${HORIZON - 44} M${x + 8} ${HORIZON - 22} L${x - 7} ${HORIZON - 44} M${x - 5} ${HORIZON - 52} L${x + 4} ${HORIZON - 72}` }, g);
    svg('path', { class: 'fr-vane', d: `M${x + 2} ${HORIZON - 100} L${x + 30} ${HORIZON - 104} L${x + 30} ${HORIZON - 94} Z` }, g);
    const wheel = svg('g', { class: 'fr-wheel' }, g);
    for (let k = 0; k < 12; k += 1) {
      svg('path', { class: 'fr-blade', d: `M0 0 L-2.2 -20 L2.2 -20 Z`, transform: `rotate(${k * 30})` }, wheel);
    }
    svg('circle', { class: 'fr-hub', r: 3 }, wheel);
    return { wheel, cx: x, cy: HORIZON - 100 };
  }

  /** A tumbleweed: a tangled ball of twigs that rolls along the street. */
  function tumbleweed(parent) {
    const g = svg('g', { class: 'fr-tumbleweed' }, parent);
    const ball = svg('g', {}, g);
    for (let k = 0; k < 9; k += 1) {
      const a = (k / 9) * Math.PI * 2;
      svg('path', { d: `M${(10 * Math.cos(a)).toFixed(1)} ${(10 * Math.sin(a)).toFixed(1)} Q${(4 * Math.cos(a + 1.7)).toFixed(1)} ${(4 * Math.sin(a + 1.7)).toFixed(1)} ${(10 * Math.cos(a + 2.6)).toFixed(1)} ${(10 * Math.sin(a + 2.6)).toFixed(1)}` }, ball);
    }
    svg('circle', { r: 11 }, ball);
    return { g, ball };
  }

  /**
   * Quiet dressing on the street, all dim and mostly at the edges, under
   * the captions: a boardwalk below the town, the railroad of the town's
   * data line across the foreground, saguaros in the corners, crates
   * stencilled with bits, a network cable coiled like a lasso on the
   * hitching rail, and a few stones.
   */
  function streetDressing(art) {
    const g = svg('g', { class: 'fr-street' }, art);
    svg('rect', { class: 'fr-boardwalk', x: 0, y: HORIZON, width: W, height: 9 }, g);
    svg('path', { class: 'fr-plank', d: Array.from({ length: 40 }, (_, k) => `M${k * 24 + 6} ${HORIZON} v9`).join(' ') }, g);
    const TRACK = 506;
    svg('path', { class: 'fr-tie', d: Array.from({ length: 46 }, (_, k) => `M${k * 22 - 4} ${TRACK - 4} l6 18`).join(' ') }, g);
    svg('path', { class: 'fr-track', d: `M0 ${TRACK} H${W} M0 ${TRACK + 9} H${W}` }, g);
    const saguaro = (x, y, k) => svg('path', { class: 'fr-cactus', transform: `translate(${x} ${y}) scale(${k})`, d: 'M-6 0 V-58 C-6 -66 6 -66 6 -58 V0 Z M-6 -30 H-16 C-20 -30 -22 -33 -22 -37 V-48 C-22 -53 -15 -53 -15 -48 V-38 H-6 Z M6 -22 H15 V-40 C15 -45 22 -45 22 -40 V-24 C22 -18 19 -15 15 -15 H6 Z' }, g);
    saguaro(40, 534, 1.1);
    saguaro(70, 538, 0.6);
    saguaro(924, 536, 1.2);
    const crate = (x, y, w) => {
      svg('rect', { class: 'fr-crate', x, y, width: w, height: w * 0.8, rx: 2 }, g);
      svg('path', { class: 'fr-crate-slat', d: `M${x} ${y + w * 0.4} H${x + w} M${x + w / 2} ${y} V${y + w * 0.8}` }, g);
      const t = svg('text', { class: 'fr-stencil', x: x + w / 2, y: y + w * 0.32, 'text-anchor': 'middle' }, g);
      t.textContent = '0101';
    };
    crate(842, 422, 34);
    crate(878, 428, 28);
    crate(858, 396, 26);
    svg('path', { class: 'fr-lasso', d: `M58 ${HORIZON + 30} c-8 6 -8 16 0 20 c8 4 16 -4 12 -12 c-4 -8 -18 -6 -18 4 c0 10 14 12 18 4 M64 ${HORIZON + 54} q4 10 -6 18` }, g);
    for (const [x, y, r] of [[210, 496, 5], [226, 500, 3], [700, 492, 4], [520, 532, 3], [760, 528, 5]]) svg('ellipse', { class: 'fr-stone', cx: x, cy: y, rx: r * 1.5, ry: r }, g);
  }

  function frontier(stage, song) {
    const duration = song?.duration ?? 360;
    const layer = el('div', 'layer frontier', stage);
    const art = svg('svg', { class: 'fr-art', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true', preserveAspectRatio: 'none' }, layer);
    const defs = svg('defs', {}, art);
    const grad = (id, kind, attrs, stops) => {
      const g = svg(kind, { id, ...attrs }, defs);
      stops.forEach(([offset, cls]) => svg('stop', { offset, class: cls }, g));
    };
    grad('fr-sky', 'linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [['0', 'fr-sky-0'], ['0.55', 'fr-sky-1'], ['0.82', 'fr-sky-2'], ['1', 'fr-sky-3']]);
    grad('fr-sun', 'radialGradient', { cx: 0.5, cy: 0.5, r: 0.5 }, [['0', 'fr-sun-0'], ['1', 'fr-sun-1']]);
    grad('fr-road', 'linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [['0', 'fr-road-0'], ['1', 'fr-road-1']]);
    svg('rect', { class: 'fr-sky', x: 0, y: 0, width: W, height: HORIZON + 10, fill: 'url(#fr-sky)' }, art);
    const stars = svg('g', { class: 'fr-stars' }, art);
    for (let k = 0; k < 70; k += 1) {
      svg('circle', { cx: (hash01(k * 7 + 1) * W).toFixed(1), cy: (hash01(k * 13 + 5) * 300).toFixed(1), r: (0.5 + hash01(k * 3) * 0.9).toFixed(2) }, stars);
    }
    svg('ellipse', { class: 'fr-sun', cx: 612, cy: HORIZON - 6, rx: 260, ry: 120, fill: 'url(#fr-sun)' }, art);
    svg('circle', { class: 'fr-sun-disc', cx: 612, cy: HORIZON - 4, r: 22 }, art);
    const clouds = [[120, 92, 1.5, 3.2], [520, 60, 1.1, 2.4], [760, 124, 1.8, 2.8]]
      .map(([x, y, scale, speed]) => ({ node: cloud(art, scale), x, y, speed }));
    // Mesas on the horizon, then the town.
    svg('path', { class: 'fr-mesa', d: `M0 ${HORIZON} V362 H60 L76 348 H184 L204 ${HORIZON - 30} L250 ${HORIZON - 26} L300 ${HORIZON} Z M640 ${HORIZON} L680 352 H760 L774 340 H860 L884 360 L960 368 V${HORIZON} Z` }, art);
    const town = svg('g', { class: 'fr-town' }, art);
    const windows = [];
    const mill = windmill(town, 900);
    const mast = radioMast(town, windows, 316);
    const signal = mast.arcs;
    // Telegraph poles carry the cable across the open lot in the middle.
    const poles = svg('g', { class: 'fr-poles' }, art);
    const pole = (px) => {
      svg('path', { d: `M${px} ${HORIZON} V${HORIZON - 70} M${px - 10} ${HORIZON - 64} H${px + 10}` }, poles);
      return [px, HORIZON - 66];
    };
    // Every building's jack, west to east: the cable's route.
    const route = [
      [-12, HORIZON - 74],
      rackSaloon(town, windows, { x: 30, w: 70, h: 82, units: 4 }),
      rackSaloon(town, windows, { x: 112, w: 86, h: 100, units: 5, arched: true }),
      moduleStore(town, windows, { x: 210, w: 64, rows: 3, cols: 2 }),
      mast.jack,
      databaseTower(town, windows, 384),
      pole(458),
      pole(534),
      rackSaloon(town, windows, { x: 600, w: 76, h: 92, units: 4 }),
      moduleStore(town, windows, { x: 688, w: 92, rows: 3, cols: 3 }),
      routerShack(town, windows, { x: 792, w: 64 }),
    ];
    // The cable sags between its jacks, more over a longer span.
    const sag = ([x1, y1], [x2, y2]) => `Q${((x1 + x2) / 2).toFixed(1)} ${(Math.max(y1, y2) + 6 + 0.12 * Math.abs(x2 - x1)).toFixed(1)} ${x2} ${y2}`;
    const wire = svg('path', { class: 'fr-wire', d: `M${route[0][0]} ${route[0][1]} ` + route.slice(1).map((p, i) => sag(route[i], p)).join(' ') }, poles);
    // Data packets travel the cable both ways at an even speed.
    const PACKETS = 8, PACKET_SPEED = 46;
    const packets = Array.from({ length: PACKETS }, () => svg('rect', { class: 'fr-packet', width: 5, height: 3.4, rx: 1 }, poles));
    // The main street, its wheel ruts, and a hitching rail.
    svg('rect', { class: 'fr-ground', x: 0, y: HORIZON, width: W, height: H - HORIZON, fill: 'url(#fr-road)' }, art);
    svg('path', { class: 'fr-rut', d: `M0 ${STREET + 18} C240 ${STREET + 10} 720 ${STREET + 12} 960 ${STREET + 20} M0 ${STREET + 50} C260 ${STREET + 42} 700 ${STREET + 44} 960 ${STREET + 54}` }, art);
    svg('path', { class: 'fr-rail', d: `M24 ${HORIZON + 30} H120 M30 ${HORIZON + 30} V${HORIZON + 46} M114 ${HORIZON + 30} V${HORIZON + 46}` }, art);
    streetDressing(art);
    const weed = tumbleweed(art);
    // Dust motes drifting slowly through the low light.
    const motes = Array.from({ length: 18 }, (_, k) => ({
      node: svg('circle', { class: 'fr-mote', r: (0.8 + hash01(k * 5) * 1.2).toFixed(2) }, art),
      x: hash01(k * 37 + 5) * W, y: 120 + hash01(k * 91 + 2) * 330,
      drift: 3 + 5 * hash01(k * 13 + 1), period: 8 + 9 * hash01(k * 17 + 3), phase: hash01(k * 23 + 9) * Math.PI * 2,
    }));
    const night = svg('rect', { class: 'fr-night', x: 0, y: 0, width: W, height: H, opacity: 0 }, art);
    el('div', 'layer vignette', stage);

    /** A tumbleweed crosses every TUMBLE seconds, taking ROLL of them. */
    const TUMBLE = 47, ROLL = 14;
    onFrame((t) => {
      const still = reducedMotion.matches;
      const dark = easeInOutCubic(span(t, [duration - NIGHTFALL[0], duration - NIGHTFALL[1]]));
      night.setAttribute('opacity', (0.55 * dark).toFixed(3));
      stars.setAttribute('opacity', (0.15 + 0.85 * dark).toFixed(3));
      // The windows light over the first two thirds of the song, each over two seconds.
      const evening = clamp(t / (duration * 0.66), 0, 1);
      for (const w of windows) w.lit.setAttribute('opacity', clamp((evening - w.at) * (duration * 0.66) / 2, 0, 1).toFixed(3));
      for (const c of clouds) {
        const x = still ? c.x : ((c.x + t * c.speed) % (W + 300)) - 150;
        c.node.setAttribute('transform', `translate(${x.toFixed(1)} ${c.y})`);
      }
      const length = wire.getTotalLength ? wire.getTotalLength() : 0;
      packets.forEach((packet, k) => {
        const along = still ? (k + 0.5) / PACKETS : ((t * PACKET_SPEED / Math.max(1, length) + hash01(k * 29 + 7)) % 1);
        const u = k % 2 ? 1 - along : along;
        const p = length ? wire.getPointAtLength(u * length) : { x: 0, y: 0 };
        packet.setAttribute('x', (p.x - 2.5).toFixed(1));
        packet.setAttribute('y', (p.y - 1.7).toFixed(1));
      });
      signal.setAttribute('opacity', still ? '0.5' : (0.35 + 0.25 * Math.sin(t * 1.3)).toFixed(3));
      mill.wheel.setAttribute('transform', `translate(${mill.cx} ${mill.cy}) rotate(${still ? 0 : ((t * 24) % 360).toFixed(1)})`);
      const cycle = t % TUMBLE;
      if (!still && cycle < ROLL && t > 20) {
        const u = cycle / ROLL;
        const x = -30 + u * (W + 60);
        const hop = Math.abs(Math.sin(u * Math.PI * 7)) * 6;
        weed.g.removeAttribute('display');
        weed.g.setAttribute('transform', `translate(${x.toFixed(1)} ${(STREET + 4 - hop).toFixed(1)})`);
        weed.ball.setAttribute('transform', `rotate(${(u * 1440).toFixed(1)})`);
      } else weed.g.setAttribute('display', 'none');
      for (const m of motes) {
        const a = (t / m.period) * Math.PI * 2 + m.phase;
        const x = still ? m.x : (m.x + t * m.drift + W * 4) % (W + 20) - 10;
        const y = m.y + (still ? 0 : 6 * Math.sin(a));
        m.node.setAttribute('cx', x.toFixed(1));
        m.node.setAttribute('cy', y.toFixed(1));
        m.node.setAttribute('opacity', (0.18 + 0.18 * Math.sin(a * 1.3)).toFixed(3));
      }
    });
    return layer;
  }

  window.SongKit.themes.frontier = { build: frontier };
})();
