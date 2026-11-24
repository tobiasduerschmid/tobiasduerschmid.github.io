/*
 * The "frontier" stage theme for "Design It In Before They Break In", the security song: a
 * frontier town at dusk behind the scenes. Storyboards select it with
 * `theme: frontier`; css/song-video-frontier.css holds its colours.
 *
 * Back to front: a dusk sky with the low sun and a few long clouds; mesas
 * on the horizon; and a desert town built of computing. The street opens
 * with the four services of verse 4, the lecture's example system: a
 * general store (Product Display), the post office under the radio mast
 * (Email Notification), a storehouse (System Backup), and a barn (Image
 * Upload), each with its icon on a sign across its front. All song long
 * they are the town's evening silhouettes, their windows glowing; in verse 4
 * their lights come on (town.light), and once each part has its own key the
 * cable between them thins and picket fences rise between them
 * (town.compartments), to stay for the rest of the song. Past them stand a
 * water tower whose tank is a database (the stacked-disk cylinder), a false-front
 * saloon that is a server rack (rack-unit slots, vents, and status LEDs
 * for windows), a general store stacked from software modules (crates with
 * connector pins and sockets), a router shack with antennas, and a
 * windmill. One network cable comes in from the desert on the left and
 * runs behind every building, plugged into its jacks, over a telegraph
 * pole to the router shack, and small data packets travel along it both
 * ways. The dusty main street lies in front, where the player draws
 * captions. A few things move, slowly and faintly: the clouds drift, the
 * windmill turns, the packets travel, the LEDs come on one by one and the
 * houses' windows all at once after sunset, dust motes float, and now and then a
 * tumbleweed rolls along the street. Golden hour cools linearly into blue
 * hour by the midpoint. Cloud illumination follows the setting sun, with
 * lower banks entering Earth's shadow before the higher banks.
 *
 * The scenery stays behind the lesson (text sits on its own cards, never on
 * the sky), and nothing large changes brightness quickly (WCAG 2.3.1): the
 * windows fade in over seconds and the sunset spans the song. Everything is a
 * pure function of song time; with reduced motion the town holds still.
 */
(function () {
  'use strict';

  const { onFrame, clamp, hash01, tween, EASE } = window.Timeline;
  const { el, svg, icon } = window.SongKit;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const W = 960, H = 540, HORIZON = 372, STREET = 456;
  // When every house's windows light: this fraction of the way from sunset
  // to lightsOutAt (in the frame loop), about 16 s after the sun is down.
  const HOUSE_LIGHTS = 0.08;
  const span = (t, [a, b]) => clamp((t - a) / (b - a), 0, 1);
  // Uneven shoulders and broken lower edges give the banks different weather
  // shapes. Every contour closes at a tapered tip, never a vertical cut.
  const CLOUD_SHAPES = [
    {
      body: 'M0 38 C14 37 24 33 35 30 C43 28 45 22 56 24 C65 26 69 17 81 19 C92 21 94 12 109 13 C120 14 120 7 134 8 C149 9 150 18 164 16 C176 14 184 21 196 20 C206 19 210 26 223 24 C237 23 241 30 253 29 C270 27 277 36 292 36 C302 36 310 39 320 40 C305 41 296 44 284 43 C273 42 272 48 259 46 C247 44 240 51 228 48 C216 45 210 54 195 51 C184 49 178 55 166 53 C151 50 148 57 135 53 C122 49 114 54 102 49 C89 44 84 49 72 44 C60 39 51 44 41 40 C29 36 15 40 0 38 Z',
      wisp: 'M10 49 C33 43 43 49 60 48 C72 46 80 51 97 50 C82 54 68 52 58 54 C39 54 25 48 10 49 Z M184 61 C202 55 211 60 228 55 C242 51 251 54 267 50 C251 59 236 57 224 62 C209 66 198 59 184 61 Z',
    },
    {
      body: 'M0 40 C19 38 29 34 42 34 C52 34 52 24 66 25 C79 27 79 17 95 20 C105 22 110 13 123 15 C135 18 141 7 155 9 C169 10 172 20 183 19 C194 18 198 25 211 23 C226 21 226 32 241 30 C255 28 257 37 273 36 C289 35 299 41 315 42 C296 42 288 47 276 45 C263 44 259 51 246 49 C233 47 227 55 215 51 C203 47 197 57 182 54 C170 51 165 58 153 55 C143 53 139 61 126 56 C113 50 109 54 98 50 C88 46 80 50 70 46 C59 41 52 45 40 42 C27 39 14 42 0 40 Z',
      wisp: 'M-8 47 C13 42 25 46 40 46 C53 46 59 50 74 49 C57 53 43 50 31 50 C17 47 4 48 -8 47 Z M132 65 C147 60 157 64 172 60 C186 56 197 61 215 57 C198 65 186 62 173 66 C160 69 147 63 132 65 Z',
    },
    {
      body: 'M0 33 C18 33 25 27 41 28 C52 30 58 21 70 23 C81 25 87 17 99 18 C109 20 116 13 129 16 C143 19 151 12 164 16 C175 20 177 24 190 22 C202 20 211 28 223 26 C237 24 242 31 255 31 C273 30 286 36 307 37 C287 38 278 43 264 41 C253 40 249 46 235 44 C222 41 219 49 206 46 C194 43 187 51 174 47 C161 43 157 50 144 46 C132 42 125 47 113 43 C100 39 93 44 80 40 C66 36 60 42 46 37 C31 32 17 36 0 33 Z',
      wisp: 'M33 47 C53 42 62 46 78 45 C92 44 104 50 121 48 C104 53 92 49 79 51 C63 52 50 46 33 47 Z M200 54 C219 48 229 53 244 49 C256 45 268 48 284 44 C268 52 255 50 244 55 C228 59 215 52 200 54 Z',
    },
  ];

  const RADIANS = Math.PI / 180;
  const FOCAL_LENGTH = 1800;
  const SKY_CENTER = 565;
  const SOLAR_RADIUS = 0.266;
  // A modest cinematic enlargement keeps the disc legible behind the lesson;
  // orbital geometry and cloud-shadow timing still use the real solar radius.
  const SUN_DISPLAY_SCALE = 1.5;
  const EARTH_RADIUS_KM = 6371;

  // NOAA's standard-atmosphere approximation; only the low-altitude range
  // used here. Refraction raises the lower limb more than the upper limb.
  // https://gml.noaa.gov/grad/solcalc/calcdetails.html
  function apparentElevation(elevation) {
    const correction = elevation > -0.575
      ? (1735 - 518.2 * elevation + 103.4 * elevation ** 2
        - 12.79 * elevation ** 3 + 0.711 * elevation ** 4) / 3600
      : -20.774 / Math.tan(elevation * RADIANS) / 3600;
    return elevation + correction;
  }

  /** West-facing, 34° north, equinox: a constant hour-angle clock, compressed
   * into the song. The same perspective projects both the path and the Sun's
   * half-degree disc. Illustrative weather/palette, not a dated ephemeris.
   * https://gml.noaa.gov/grad/solcalc/solareqns.PDF */
  function sunsetLighting(progress) {
    const latitude = 34 * RADIANS;
    const hourAngle = (88.8 + 10.2 * progress) * RADIANS;
    const west = Math.sin(hourAngle);
    const north = -Math.sin(latitude) * Math.cos(hourAngle);
    const up = Math.cos(latitude) * Math.cos(hourAngle);
    const elevation = Math.asin(up) / RADIANS;
    const horizontal = Math.hypot(west, north);
    const projectY = (angle) => HORIZON - FOCAL_LENGTH * Math.tan(apparentElevation(angle) * RADIANS) * horizontal / west;
    const top = projectY(elevation + SOLAR_RADIUS);
    const bottom = projectY(elevation - SOLAR_RADIUS);
    return {
      x: SKY_CENTER + FOCAL_LENGTH * north / west,
      y: (top + bottom) / 2,
      rx: FOCAL_LENGTH * Math.tan(SOLAR_RADIUS * RADIANS) / west * SUN_DISPLAY_SCALE,
      ry: (bottom - top) / 2 * SUN_DISPLAY_SCALE,
      elevation,
      azimuth: Math.atan2(north, west),
      // Reach red while the upper limb is still visible, rather than only
      // after the horizon has hidden the warmer bottom of the disc.
      reddening: span(1.2 - elevation, [0, 1.4]),
      afterglow: 1 - span(-elevation, [0.5, 7]),
    };
  }

  /** Ambient body, directional sunlight, then soft overlapping shadow folds.
   * All detail is clipped to the original silhouette, keeping the song's
   * broad, quiet shapes rather than adding photographic noise. */
  function cloud(parent, { scale, variant }) {
    const shape = CLOUD_SHAPES[variant % CLOUD_SHAPES.length];
    const g = svg('g', { class: 'fr-cloud' }, parent);
    const bank = svg('g', { transform: `scale(${scale})` }, g);
    const defs = svg('defs', {}, bank);
    const clipId = `fr-cloud-clip-${variant}`;
    const lightId = `fr-cloud-light-${variant}`;
    svg('path', { d: shape.body }, svg('clipPath', { id: clipId }, defs));
    const gradient = svg('linearGradient', { id: lightId, gradientUnits: 'userSpaceOnUse' }, defs);
    [[0, 'shade'], [0.48, 'middle'], [0.82, 'warm'], [1, 'rim']].forEach(([offset, name]) => {
      svg('stop', { offset, class: `fr-cloud-sun-${name}` }, gradient);
    });
    svg('path', { class: 'fr-cloud-body', d: shape.body }, bank);
    const ambientWisp = svg('path', { class: 'fr-cloud-wisp', d: shape.wisp }, bank);
    const direct = svg('g', { class: 'fr-cloud-direct', fill: `url(#${lightId})` }, bank);
    svg('path', { d: shape.body }, direct);
    const litWisp = svg('path', { d: shape.wisp, class: 'fr-cloud-lit-wisp' }, direct);
    const clipped = svg('g', { 'clip-path': `url(#${clipId})` }, bank);
    const folds = svg('g', {}, clipped);
    [[-12, 7, 0.57], [118, 2, 0.48], [208, 16, 0.35]].forEach(([x, y, size], i) => {
      svg('path', {
        class: 'fr-cloud-fold', d: CLOUD_SHAPES[(variant + i + 1) % CLOUD_SHAPES.length].body,
        transform: `translate(${x} ${y}) scale(${size} 0.55)`,
      }, folds);
    });
    svg('path', { d: shape.wisp, transform: 'translate(20 -13)', class: 'fr-cloud-filament', fill: `url(#${lightId})` }, folds);
    return { node: g, gradient, folds, wisps: [ambientWisp, litWisp] };
  }

  /** Elevated clouds retain sunlight after the observer's sunset. Horizon
   * dip accounts for Earth's curvature; a solar-disc-width fade avoids a
   * hard on/off edge as each layer crosses into shadow. */
  function lightCloud(c, light, x) {
    const centerX = x + 160 * c.scale;
    const centerY = c.y + 32 * c.scale;
    const azimuth = Math.atan2(centerX - SKY_CENTER, FOCAL_LENGTH);
    const rangeKm = c.heightKm * Math.hypot(FOCAL_LENGTH, centerX - SKY_CENTER) / (HORIZON - centerY);
    const horizonDip = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + c.heightKm)) / RADIANS;
    const localElevation = light.elevation + rangeKm / EARTH_RADIUS_KM / RADIANS * Math.cos(azimuth - light.azimuth);
    const clearance = localElevation + horizonDip;
    const direct = span(clearance, [-SOLAR_RADIUS, SOLAR_RADIUS]);
    const reddening = 1 - span(clearance, [0, 5]);
    // A restrained scattered afterglow survives direct illumination, then
    // gives way to blue skylight. This palette is illustrative, not a
    // multiple-scattering simulation of a particular atmosphere.
    const scattered = 0.5 * (1 - span(-clearance, [0, 4]))
      * (1 - span(-localElevation, [6, 8]));
    const warmth = direct * (0.82 + 0.18 * (1 - reddening)) + (1 - direct) * scattered;
    c.node.style.setProperty('--fr-cloud-light', warmth.toFixed(3));
    c.node.style.setProperty('--fr-cloud-red', `${(100 * reddening).toFixed(2)}%`);
    // Project the sun-facing direction: left banks catch light on the right,
    // right banks on the left. Keep the strongest light on the lower relief.
    const lean = clamp((light.x - centerX) / 600, -1, 1);
    c.gradient.setAttribute('x1', (160 - lean * 8).toFixed(2));
    c.gradient.setAttribute('y1', '4');
    c.gradient.setAttribute('x2', (160 + lean * 8).toFixed(2));
    c.gradient.setAttribute('y2', '57');
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

  // ------------------------------------------------------------------
  // The four services of verse 4, standing in the town
  // ------------------------------------------------------------------

  // Where the services stand on the street, west to east (their centres),
  // drawn at this scale from their 120×90 art. They keep west of x 520,
  // where the sun goes down behind the open lot (sunsetLighting).
  const SERVICE_LOTS = [['store', 66], ['post', 198], ['warehouse', 330], ['barn', 462]];
  const SERVICE_SCALE = 0.9;

  // The parts of a service building, in its own 120×90 frame (the street
  // at y 88), drawn like the song's porch (western-kit.js): dark outlines,
  // light from the upper left, clapboards, and lit windows.
  const bldPart = {
    boards(g, x0, x1, y0, y1, step = 7) {
      for (let by = y0; by < y1; by += step) {
        svg('path', { class: 'fr-bld-board', d: `M${x0} ${by} H${x1}` }, g);
        svg('path', { class: 'fr-bld-board-light', d: `M${x0} ${by + 1.2} H${x1}` }, g);
      }
    },
    window(g, x, y, w, h, { cross = true } = {}) {
      svg('rect', { class: 'fr-bld-frame', x: x - 2, y: y - 2, width: w + 4, height: h + 4, rx: 1 }, g);
      svg('rect', { class: 'fr-bld-glass', x, y, width: w, height: h }, g);
      if (cross) svg('path', { class: 'fr-bld-mullion', d: `M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}` }, g);
      svg('rect', { class: 'fr-bld-sill', x: x - 3, y: y + h + 1.5, width: w + 6, height: 2.6, rx: 0.6 }, g);
    },
    door(g, x, y, w, h) {
      svg('rect', { class: 'fr-bld-frame', x: x - 2, y: y - 2, width: w + 4, height: h + 2 }, g);
      svg('rect', { class: 'fr-bld-door', x, y, width: w, height: h }, g);
      svg('path', { class: 'fr-bld-panel', d: `M${x + 3} ${y + 3} h${w - 6} v${h * 0.36} h${-(w - 6)} Z M${x + 3} ${y + h * 0.5} h${w - 6} v${h * 0.42} h${-(w - 6)} Z` }, g);
      svg('circle', { class: 'fr-bld-knob', cx: x + w - 3.4, cy: y + h * 0.48, r: 1.3 }, g);
    },
    boardwalk(g) {
      svg('rect', { class: 'fr-bld-deck', x: 3, y: 84, width: 114, height: 4.4, rx: 0.6 }, g);
      svg('path', { class: 'fr-bld-seam', d: Array.from({ length: 9 }, (_, i) => `M${12 + i * 12} 84 V88.4`).join(' ') }, g);
    },
  };

  /**
   * The service's emblem, the main part of its facade: a dark board with a
   * brass rim and the service's icon from the song kit's icon set (kit.js), as
   * large as the board allows.
   */
  function emblem(g, name, { x, y, w, h }) {
    svg('rect', { class: 'fr-bld-emblem', x, y, width: w, height: h, rx: 3 }, g);
    svg('rect', { class: 'fr-bld-emblem-shine', x: x + 2, y: y + 2, width: w - 4, height: h - 4, rx: 2 }, g);
    const size = Math.min(w, h) - 4;
    const art = icon(name, 'fr-bld-emblem-icon');
    for (const [k, v] of Object.entries({ x: x + (w - size) / 2, y: y + (h - size) / 2, width: size, height: size })) art.setAttribute(k, v);
    g.append(art);
  }

  // Each service's building, its emblem the largest thing on its facade:
  // a cart for Product Display, an envelope for Email Notification, a
  // database for System Backup, and a picture for Image Upload. The door,
  // windows, and props below say what kind of building it is.
  const BUILDINGS = {
    /** Product Display: a general store, its goods behind an awning. */
    store(g, wall) {
      svg('path', { class: 'fr-bld-wall', fill: wall, d: 'M10 86 V12 H15 V6 H105 V12 H110 V86 Z' }, g);
      bldPart.boards(g, 10, 110, 50, 84);
      svg('path', { class: 'fr-bld-cap', d: 'M12 6 H108 V2.6 H12 Z' }, g);
      emblem(g, 'cart', { x: 32, y: 10, w: 56, h: 36 });
      svg('path', { class: 'fr-bld-awning', d: 'M12 49 H108 L104 56 H16 Z' }, g);
      svg('path', { class: 'fr-bld-stripe', d: Array.from({ length: 8 }, (_, i) => `M${18 + i * 12} 49 h6 l-0.6 7 h-6 Z`).join(' ') }, g);
      svg('path', { class: 'fr-bld-scallop', d: 'M16 56 ' + Array.from({ length: 11 }, () => 'a4 2.6 0 0 0 8 0').join(' ') }, g);
      bldPart.window(g, 17, 62, 24, 14, { cross: false });
      bldPart.window(g, 79, 62, 24, 14, { cross: false });
      svg('path', { class: 'fr-bld-goods', d: 'M20 76 V70 H25 V76 Z M27 76 V67 C27 65.8 32 65.8 32 67 V76 Z M34 76 V71 H38 V76 Z M82 76 V68 H88 V76 Z M90 76 V70 C90 68.8 94 68.8 94 70 V76 Z M96 76 V67 H100 V76 Z' }, g);
      bldPart.door(g, 51, 61, 18, 25);
      bldPart.boardwalk(g);
    },
    /** Email Notification: the post office, a mailbox by its door. */
    post(g, wall) {
      svg('path', { class: 'fr-bld-wall', fill: wall, d: 'M10 86 V16 H13 C26 2 94 2 107 16 H110 V86 Z' }, g);
      bldPart.boards(g, 10, 110, 50, 84);
      svg('path', { class: 'fr-bld-cap', d: 'M8 16 H112 V13.4 C96 -2 24 -2 8 13.4 Z' }, g);
      emblem(g, 'envelope', { x: 33, y: 12, w: 54, h: 36 });
      bldPart.window(g, 17, 56, 16, 14);
      bldPart.window(g, 87, 56, 16, 14);
      bldPart.door(g, 51, 57, 18, 29);
      // The mailbox on its post.
      svg('rect', { class: 'fr-bld-post', x: 93.6, y: 79, width: 2.8, height: 6 }, g);
      svg('path', { class: 'fr-bld-mailbox', d: 'M88 79 V75 C88 72 102 72 102 75 V79 Z' }, g);
      svg('path', { class: 'fr-bld-slot', d: 'M91.6 75.6 H98.4' }, g);
      bldPart.boardwalk(g);
    },
    /** System Backup: a storehouse, its stored drums and crates outside. */
    warehouse(g, wall) {
      svg('path', { class: 'fr-bld-wall', fill: wall, d: 'M10 86 V30 L60 6 L110 30 V86 Z' }, g);
      bldPart.boards(g, 10, 110, 36, 84);
      svg('path', { class: 'fr-bld-roof-edge', d: 'M6 32 L60 4 L114 32' }, g);
      emblem(g, 'database', { x: 38, y: 17, w: 44, h: 36 });
      // The sliding doors, braced.
      svg('rect', { class: 'fr-bld-rail', x: 32, y: 56, width: 56, height: 2.6 }, g);
      svg('rect', { class: 'fr-bld-frame', x: 34, y: 58.6, width: 52, height: 27.4 }, g);
      svg('path', { class: 'fr-bld-slider', d: 'M37 61 H59 V86 H37 Z M61 61 H83 V86 H61 Z' }, g);
      svg('path', { class: 'fr-bld-brace', d: 'M37 61 L59 86 M83 61 L61 86' }, g);
      // Backups stacked outside: a drum and two crates.
      svg('path', { class: 'fr-bld-drum', d: 'M14 86 V72 C14 70 26 70 26 72 V86 Z' }, g);
      svg('path', { class: 'fr-bld-hoop', d: 'M14 76 C14 77.6 26 77.6 26 76 M14 81.4 C14 83 26 83 26 81.4' }, g);
      svg('path', { class: 'fr-bld-crate', d: 'M90 86 V74 H106 V86 Z M93 74 V64 H104 V74 Z' }, g);
      svg('path', { class: 'fr-bld-crate-line', d: 'M90 74 L106 86 M106 74 L90 86 M93 64 L104 74 M104 64 L93 74' }, g);
      bldPart.boardwalk(g);
    },
    /** Image Upload: a barn, a picture on its loft. */
    barn(g, wall) {
      svg('path', { class: 'fr-bld-wall', fill: wall, d: 'M10 86 V46 L20 28 L60 13 L100 28 L110 46 V86 Z' }, g);
      svg('path', { class: 'fr-bld-board', d: Array.from({ length: 12 }, (_, i) => `M${15 + i * 8} 48 V84`).join(' ') }, g);
      svg('path', { class: 'fr-bld-roof', d: 'M5 47 L17 26 L60 9 L103 26 L115 47 L111 47 L100 30 L60 14.6 L20 30 L9 47 Z' }, g);
      svg('path', { class: 'fr-bld-trim', d: 'M10.5 47 V86 M109.5 47 V86' }, g);
      emblem(g, 'image', { x: 37, y: 22, w: 46, h: 34 });
      // The big doors with their white X.
      svg('rect', { class: 'fr-bld-barn-door', x: 40, y: 60, width: 40, height: 26 }, g);
      svg('path', { class: 'fr-bld-trim', d: 'M40 60 H80 V86 H40 Z M60 60 V86 M40 60 L60 86 M60 60 L40 86 M80 60 L60 86 M60 60 L80 86' }, g);
      bldPart.boardwalk(g);
    },
  };

  let serviceArtCount = 0;

  /** A service building's art (`kind`, one of BUILDINGS) in its frame `at`, with class `cls`. */
  function serviceArt(parent, kind, cls, at) {
    const art = svg('svg', { class: `fr-bld fr-bld--${kind} ${cls}`, viewBox: '0 0 120 90', x: at.x, y: at.y, width: at.w, height: at.h, overflow: 'visible' }, parent);
    const id = `fr-bld-${++serviceArtCount}`;
    const grad = svg('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 1 }, svg('defs', {}, art));
    svg('stop', { offset: 0, class: 'fr-bld-stop-lit' }, grad);
    svg('stop', { offset: 1, class: 'fr-bld-stop-shaded' }, grad);
    svg('ellipse', { class: 'fr-bld-shadow', cx: 60, cy: 88, rx: 58, ry: 2.4 }, art);
    BUILDINGS[kind](art, `url(#${id})`);
    return art;
  }

  /**
   * One of the four services as a building of the town, standing on the
   * street centred on cx: drawn as the town sees it, a silhouette whose
   * windows glow as the evening comes, with a lit copy on top that only
   * verse 4 shows (town.light). Plugged into the town's cable by a jack on
   * each side. Returns where it stands, its lit copy, and its jacks.
   */
  function serviceBuilding(parent, windows, kind, cx) {
    const w = 120 * SERVICE_SCALE, h = 90 * SERVICE_SCALE;
    // The art's deck ends at y 88.4; it rests a pixel into the boardwalk.
    const frame = { x: cx - w / 2, y: HORIZON + 1 - 88.4 * SERVICE_SCALE, w, h };
    const dark = serviceArt(parent, kind, 'fr-service fr-service--dark', frame);
    // Every house's windows light together, soon after the sun is down.
    dark.querySelectorAll('.fr-bld-glass').forEach((glass) => windows.push({ lit: glass, at: HOUSE_LIGHTS, dusk: true }));
    const lit = serviceArt(parent, kind, 'fr-service fr-service--lit', frame);
    const jackY = frame.y + 30 * SERVICE_SCALE;
    return {
      kind, cx, top: frame.y, bottom: HORIZON, left: cx - 50 * SERVICE_SCALE, right: cx + 50 * SERVICE_SCALE, lit,
      jacks: [jack(parent, cx - 51 * SERVICE_SCALE, jackY), jack(parent, cx + 51 * SERVICE_SCALE, jackY)],
    };
  }

  /** The radio mast on the post office's roof (base at x, y): a lattice spire, dishes, and faint signal arcs (returned). */
  function postMast(parent, windows, x, base) {
    const g = svg('g', { class: 'fr-building' }, parent);
    const top = base - 72;
    svg('path', { class: 'fr-leg', d: `M${x - 7} ${base} L${x} ${top} L${x + 7} ${base} M${x - 5} ${base - 16} L${x + 4} ${base - 28} M${x + 5} ${base - 16} L${x - 4} ${base - 28} M${x - 3} ${base - 40} L${x + 2} ${base - 52}` }, g);
    svg('path', { class: 'fr-tank', d: `M${x + 3} ${base - 36} a8 8 0 0 1 10 -8 l-3 9 Z M${x - 3} ${base - 22} a8 8 0 0 0 -10 -8 l3 9 Z` }, g);
    leds(g, windows, [[x, top - 2]], 'amber');
    const arcs = svg('g', { class: 'fr-signal' }, g);
    for (const r of [10, 18, 26]) svg('path', { d: `M${x - r * 0.7} ${top - 2 - r * 0.7} A${r} ${r} 0 0 1 ${x + r * 0.7} ${top - 2 - r * 0.7}` }, arcs);
    return arcs;
  }

  /**
   * A picket fence between two lots, centred on x: not there until verse 4
   * gives each service its own key, when it rises (town.compartments) and
   * stays up, lit while the services are (town.light) and part of the
   * town's silhouette after. Returns its node and its lit copy.
   */
  function townFence(parent, x) {
    const node = svg('g', { class: 'fr-fence' }, parent);
    const pickets = (cls) => {
      const g = svg('g', { class: cls }, node);
      const rails = `M${x - 11} ${HORIZON - 30} H${x + 11} M${x - 11} ${HORIZON - 12} H${x + 11}`;
      svg('path', { class: 'fr-fence-rail', d: rails }, g);
      svg('path', { class: 'fr-fence-rail-wood', d: rails }, g);
      for (const px of [x - 5.5, x, x + 5.5]) svg('path', { class: 'fr-fence-picket', d: `M${px - 2.2} ${HORIZON} V${HORIZON - 34} L${px} ${HORIZON - 38} L${px + 2.2} ${HORIZON - 34} V${HORIZON} Z` }, g);
      for (const px of [x - 11, x + 11]) svg('rect', { class: 'fr-fence-post', x: px - 2.2, y: HORIZON - 42, width: 4.4, height: 42, rx: 1 }, g);
      return g;
    };
    pickets('fr-fence-dark');
    return { node, lit: pickets('fr-fence-lit') };
  }

  /**
   * The cable's span between two neighbouring services as verse 4 lights it
   * (town.light): a thick cable over the town's wire, in three layers that
   * thin to a narrow wire (town.compartments).
   */
  function serviceLink(parent, d) {
    const node = svg('g', { class: 'fr-link' }, parent);
    const layers = [['fr-link-sheath', 4], ['fr-link-core', 1.8], ['fr-link-shine', 0.01]]
      .map(([cls, thin]) => ({ path: svg('path', { class: cls, d }, node), thin }));
    return { node, layers };
  }

  // How long the services' lights take to come on, and to go out.
  const LIGHT_UP = 0.9, LIGHT_DOWN = 0.6;

  /**
   * What the town offers verse 4: where its four services stand, and two
   * changes to them, each a pure function of song time.
   *   light({ at, until })   lights the services, the cable spans between
   *                          them, and their fences, and puts the lights out
   *                          again by `until`
   *   compartments({ at })   thins those spans to narrow wires and raises
   *                          picket fences between the services: each part
   *                          on its own lot, the fences staying up for good
   */
  function townLighting(services, links, fences) {
    return {
      services: services.map(({ kind, cx, top, bottom, left, right }) => ({ kind, cx, top, bottom, left, right })),
      light({ at, until }) {
        for (const node of [...services.map((b) => b.lit), ...links.map((l) => l.node), ...fences.map((f) => f.lit)]) {
          tween(node, [{ opacity: 0 }, { opacity: 1 }], at, LIGHT_UP, EASE.inOut);
          if (until !== undefined) tween(node, [{ opacity: 1 }, { opacity: 0 }], until - LIGHT_DOWN, LIGHT_DOWN, EASE.inOut);
        }
      },
      compartments({ at }) {
        links.forEach((l) => l.layers.forEach(({ path, thin }) => tween(path, [{ strokeWidth: `${thin}px` }], at, 0.7, EASE.inOut)));
        fences.forEach((f, i) => {
          tween(f.node, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1.06)', offset: 0.7 }, { transform: 'scaleY(1)' }], at + 0.1 + i * 0.12, 0.45, EASE.out);
        });
      },
    };
  }

  /**
   * Quiet dressing on the street, all dim and mostly at the edges, under
   * the captions: a boardwalk below the town, the railroad of the town's
   * data line across the foreground, saguaros in the corners, crates
   * stencilled with bits, and a few stones.
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
    // A small stack at the water tower's feet, clear of the setting sun and
    // behind the actors' walking plane.
    crate(628, HORIZON - 18, 22);
    crate(652, HORIZON - 14.4, 18);
    crate(638, HORIZON - 32.4, 18);
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
    grad('fr-horizon-glow', 'radialGradient', { cx: 0.5, cy: 0.5, r: 0.5 }, [['0', 'fr-horizon-core'], ['0.5', 'fr-horizon-warm'], ['1', 'fr-horizon-edge']]);
    grad('fr-sun-face', 'linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [['0', 'fr-sun-upper'], ['1', 'fr-sun-lower']]);
    grad('fr-road', 'linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [['0', 'fr-road-0'], ['0.45', 'fr-road-1'], ['1', 'fr-road-2']]);
    grad('fr-cloud', 'linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [['0', 'fr-cloud-0'], ['0.48', 'fr-cloud-1'], ['0.8', 'fr-cloud-2'], ['1', 'fr-cloud-3']]);
    svg('rect', { class: 'fr-sky', x: 0, y: 0, width: W, height: HORIZON + 10, fill: 'url(#fr-sky)' }, art);
    const stars = svg('g', { class: 'fr-stars' }, art);
    for (let k = 0; k < 70; k += 1) {
      svg('circle', { cx: (hash01(k * 7 + 1) * W).toFixed(1), cy: (hash01(k * 13 + 5) * 300).toFixed(1), r: (0.5 + hash01(k * 3) * 0.9).toFixed(2) }, stars);
    }
    const skyClip = svg('clipPath', { id: 'fr-sky-clip' }, defs);
    svg('rect', { width: W, height: HORIZON }, skyClip);
    const sunlight = svg('g', { 'clip-path': 'url(#fr-sky-clip)' }, art);
    const horizonGlow = svg('ellipse', { class: 'fr-horizon-glow', cy: HORIZON - 4, rx: 300, ry: 108, fill: 'url(#fr-horizon-glow)' }, sunlight);
    const sunGlow = svg('ellipse', { class: 'fr-sun', rx: 64, ry: 56, fill: 'url(#fr-sun)' }, sunlight);
    const sun = svg('ellipse', { class: 'fr-sun-disc' }, sunlight);
    const clouds = [[-110, 24, 1.65, 0.18, 11], [240, 82, 1.15, 0.12, 7], [535, 18, 1.8, 0.16, 9.5], [760, 129, 1.1, 0.16, 2.4], [15, 186, 0.85, 0.22, 1.6]]
      .map(([x, y, scale, speed, heightKm], variant) => ({ ...cloud(art, { scale, variant }), x, y, scale, speed, heightKm }));
    // Mesas on the horizon, then the town. Its one cable runs behind the
    // buildings, plugged into each one's jacks, so only its spans between
    // them show, and telegraph poles carry it across the open lot.
    svg('path', { class: 'fr-mesa', d: `M0 ${HORIZON} V${HORIZON - 42} H60 L76 ${HORIZON - 56} H184 L204 ${HORIZON - 30} L250 ${HORIZON - 26} L300 ${HORIZON} Z M640 ${HORIZON} L680 ${HORIZON - 52} H760 L774 ${HORIZON - 64} H860 L884 ${HORIZON - 44} L960 ${HORIZON - 36} V${HORIZON} Z` }, art);
    const wires = svg('g', { class: 'fr-wires' }, art);
    const town = svg('g', { class: 'fr-town' }, art);
    const windows = [];
    const mill = windmill(town, 936);
    // The four services of verse 4 lead the street: a store, the post office
    // under the radio mast, a storehouse, and a barn; verse 4 fences them in.
    const signal = postMast(town, windows, SERVICE_LOTS[1][1], HORIZON - 90 * SERVICE_SCALE + 3);
    const services = SERVICE_LOTS.map(([kind, cx]) => serviceBuilding(town, windows, kind, cx));
    const fences = services.slice(1).map((b, i) => townFence(town, (services[i].right + b.left) / 2));
    const poles = svg('g', { class: 'fr-poles' }, art);
    const pole = (px) => {
      svg('path', { d: `M${px} ${HORIZON} V${HORIZON - 70} M${px - 10} ${HORIZON - 64} H${px + 10}` }, poles);
      return [px, HORIZON - 66];
    };
    // Every jack, west to east: the cable's route.
    const route = [
      [-12, HORIZON - 74],
      ...services.flatMap((b) => b.jacks),
      pole(612),
      databaseTower(town, windows, 664),
      rackSaloon(town, windows, { x: 710, w: 68, h: 88, units: 4 }),
      moduleStore(town, windows, { x: 790, w: 60, rows: 3, cols: 2 }),
      routerShack(town, windows, { x: 866, w: 44 }),
    ];
    // The cable sags between its jacks, more over a longer span.
    const sag = ([x1, y1], [x2, y2]) => `Q${((x1 + x2) / 2).toFixed(1)} ${(Math.max(y1, y2) + 6 + 0.12 * Math.abs(x2 - x1)).toFixed(1)} ${x2} ${y2}`;
    const wire = svg('path', { class: 'fr-wire', d: `M${route[0][0]} ${route[0][1]} ` + route.slice(1).map((p, i) => sag(route[i], p)).join(' ') }, wires);
    // In verse 4 its spans between the services light up as thick cables.
    const links = services.slice(1).map((b, i) => {
      const from = services[i].jacks[1];
      return serviceLink(wires, `M${from[0]} ${from[1]} ${sag(from, b.jacks[0])}`);
    });
    // Data packets travel the cable both ways at an even speed.
    const PACKETS = 8, PACKET_SPEED = 46;
    const packets = Array.from({ length: PACKETS }, () => svg('rect', { class: 'fr-packet', width: 5, height: 3.4, rx: 1 }, wires));
    window.SongKit.themes.frontier.town = townLighting(services, links, fences);
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
    el('div', 'layer vignette', stage);

    /** A tumbleweed crosses every TUMBLE seconds, taking ROLL of them. */
    const TUMBLE = 47, ROLL = 14;
    const twilightSpeed = 1.2;
    const blueHourAt = duration * 0.52 / twilightSpeed;
    // Song time when the sun's upper limb sinks below the horizon (the
    // light clock runs at 0.88 of song time): the windows stay dark until then.
    let sunset = 0;
    while (sunset < 1 && apparentElevation(sunsetLighting(sunset).elevation + SOLAR_RADIUS) > 0) sunset += 0.001;
    const duskAt = sunset * duration / 0.88;
    const lightsOutAt = Math.max(duskAt + 30, duration * 0.66);
    onFrame((t) => {
      const still = reducedMotion.matches;
      // Same golden-hour starting point; the whole sunset clock now runs
      // 12% slower, keeping its sky, ground, and cloud illumination together.
      const lightTime = still ? blueHourAt : t * 0.88;
      const blueHour = span(lightTime, [0, blueHourAt]);
      const night = span(lightTime, [blueHourAt, duration]);
      const light = sunsetLighting(span(lightTime, [0, duration]));
      // Shared ambient light also reaches the foreground house. Both colour
      // legs advance linearly, without easing or a pause at blue hour.
      stage.style.setProperty('--fr-blue-hour', `${(100 * blueHour).toFixed(2)}%`);
      stage.style.setProperty('--fr-night', `${(100 * night).toFixed(2)}%`);
      stage.style.setProperty('--fr-sun-red', `${(100 * light.reddening).toFixed(2)}%`);
      stars.setAttribute('opacity', (0.4 * span(lightTime, [duration * 0.3 / twilightSpeed, blueHourAt]) + 0.38 * night).toFixed(3));
      horizonGlow.setAttribute('cx', light.x.toFixed(2));
      horizonGlow.setAttribute('opacity', ((0.62 + 0.3 * light.reddening) * light.afterglow).toFixed(3));
      sunGlow.setAttribute('cx', light.x.toFixed(2));
      sunGlow.setAttribute('cy', light.y.toFixed(2));
      sunGlow.setAttribute('opacity', (0.75 * (1 - span(-light.elevation, [0, 1]))).toFixed(3));
      sun.setAttribute('cx', light.x.toFixed(2));
      sun.setAttribute('cy', light.y.toFixed(2));
      sun.setAttribute('rx', light.rx.toFixed(2));
      sun.setAttribute('ry', light.ry.toFixed(2));
      // Status LEDs come on over the first two thirds of the song; house
      // windows wait until the sun is down, then all light together.
      // Each light comes on over two seconds.
      for (const w of windows) {
        const [from, to] = w.dusk ? [duskAt, lightsOutAt] : [0, duration * 0.66];
        w.lit.setAttribute('opacity', clamp((span(t, [from, to]) - w.at) * (to - from) / 2, 0, 1).toFixed(3));
      }
      for (const c of clouds) {
        const x = c.x + (still ? 0 : t * c.speed);
        c.node.setAttribute('transform', `translate(${x.toFixed(1)} ${c.y})`);
        // One steady wind, with a little shear in the thin edges and folds.
        // No loops, bobs, or wrapping jumps; every pose is seekable.
        const shear = still ? 0 : t * 0.025;
        for (const wisp of c.wisps) wisp.setAttribute('transform', `translate(${shear.toFixed(2)} 0)`);
        c.folds.setAttribute('transform', `translate(${(shear * 0.4).toFixed(2)} 0)`);
        lightCloud(c, light, x);
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
