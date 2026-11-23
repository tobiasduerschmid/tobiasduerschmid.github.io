/*
 * The "agent-campus" theme for "Meet Me One Level Up", the CS 35L song about
 * coding with AI agents, sung by the agent itself. It has two rooms, one for
 * each phase of the agent's life:
 *
 *   TRAINING  (intro to the first chorus): a grand old library on a late
 *     afternoon. A coffered walnut ceiling with gilt rosettes over a carved
 *     cornice; fluted pilasters with capitals; mahogany bookcases on two
 *     levels (books of many heights, widths, and colours, with gilt bands,
 *     raised bands, leaning books, and small stacks); a rose window with
 *     stone tracery; a gallery on carved brackets with a turned-baluster
 *     railing; a brass rolling ladder; a spiral stair up to the gallery at
 *     the right-hand edge; a long oak reading table with two green banker's
 *     lamps; a rug on chevron parquet. Soft shafts of late sun come in from
 *     high windows in the (unseen) left-hand wall and slant across the room
 *     to warm pools on the floor, dust drifting in them. The far wall sits
 *     in a cool haze, the middle of the room (behind the lesson's cards) is
 *     kept quiet and darker, and shadow gathers under the gallery and in
 *     the corners; a near pilaster frames the left edge.
 *   INFERENCE (verse 3 to the end): a modern office. A double-height window
 *     wall over a city in three depths, an oak slat wall on the left with
 *     floating stairs up to a glass-railed mezzanine on a white column, a
 *     faint whiteboard under it, pendant lights, an oak desk with two
 *     monitors of abstract code, a keyboard, a mug, and a small plant, a
 *     fiddle-leaf fig, and light oak planks that mirror the window.
 *
 * Both rooms keep an upper level (the song's "meet me one level up"): a
 * gallery front at y 190 from x 190 to the right-hand edge.
 *
 * Coordinates (stage px; AgentCampus exports them):
 *   FLOOR 452 the floor line where the robot hovers and feet stand.
 *   The back wall meets the floor at y 420; eye level (the horizon and the
 *   vanishing point) is at (480, 250), and receding edges converge there.
 *   library.table     { x 240, y 381, w 480 } the reading table's top.
 *   library.mezzanine { x 190, y 190, w 770 } the gallery floor's front edge.
 *   office.desk       { x 596, y 374, w 296 } the desk's top.
 *   office.mezzanine  { x 190, y 190, w 382 } the mezzanine floor's front edge.
 *   office.window     { x 563, y 12, w 397, h 408 } the double-height glass
 *     right of the mezzanine (more glass continues above the mezzanine).
 *
 * Time: switchAt(song) is the start of verse 3; from there the library
 * fades out over the office in one slow cross-dissolve (DISSOLVE, 1.2 s).
 * Each room is an <svg> whose own CSS opacity carries the dissolve
 * (data-testid "campus-library" and "campus-office"): before it the
 * library is 1 and the office 0, after it the reverse. In the library the
 * afternoon wears on over the training phase: the sunbeams flatten a
 * little and warm. The office's light follows a solar clock (NOAA solar
 * position and refraction, as in the frontier theme) set by the storyboard:
 * late morning at verse 3, golden hour through the bridge, the sun touching
 * the skyline 2 s into the quiz and gone behind it 10 s later, a vivid
 * afterglow through the final chorus, and blue hour with the city's lights
 * by the outro. Sky, clouds (lit from below as the sun sinks, the low ones
 * going grey first), city silhouettes and rim light, sun patches on the
 * floor, and the room's light all follow the sun's elevation. Ambient
 * motion: dust in the sunbeams, lamp light breathing by a few percent
 * (periods of 3.7 s or more; nothing flashes), clouds drifting, code
 * scrolling on the monitors, steam from the mug, the fig swaying. Every pose
 * is a pure function of song time, so any seek reproduces its frame. Under
 * reduced motion each room holds one still pose (the library mid-afternoon,
 * the office in golden hour); the dissolve between them still happens.
 *
 * Draw order keeps the bottom band (below y 460, under the captions) calm:
 * floor, rug, light pools, and reflections only. The artwork has no text.
 * Styles live in css/song-video-agent-campus.css; colours that follow song
 * time are computed here.
 */
(function () {
  'use strict';

  const { onFrame, clamp, easeInOutCubic, hash01 } = window.Timeline;
  const { el, svg } = window.SongKit;

  const W = 960;
  const H = 540;
  /** Eye level: the horizon and the vanishing point's height. */
  const HORIZON = 250;
  const VP_X = W / 2;
  /** Where the back wall meets the floor. */
  const BASE = 420;
  /** The floor line where the cast stands. */
  const FLOOR = 452;
  /** How much nearer than the wall the gallery front and the stair's outer edge are. */
  const NEAR = 1 / 0.9;
  /** The camera's distance from the wall, in wall pixels (for depths on the floor). */
  const CAMERA = 600;
  const DISSOLVE = 1.2;
  /** The song time the library holds under reduced motion: mid-afternoon light. (The office holds golden hour; see officeRoom.) */
  const STILL_LIBRARY = 40;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const LIBRARY = {
    table: { x: 240, y: 381, w: 480 },
    mezzanine: { x: 190, y: 190, w: 770 },
  };
  const OFFICE = {
    desk: { x: 596, y: 374, w: 296 },
    mezzanine: { x: 190, y: 190, w: 382 },
    window: { x: 563, y: 12, w: 397, h: 408 },
  };
  /** The stair's outer edge, from off-stage left up to the gallery front. */
  const STAIR = { x0: -60, y0: 439, x1: 190, y1: 190, steps: 14 };

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  const f1 = (n) => n.toFixed(1);
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (k) => k * k * (3 - 2 * k);
  /** −1 … 1 over `period` seconds, starting `phase` (0–1) of the way through. */
  const wave = (t, period, phase = 0) => Math.sin((t / period + phase) * 2 * Math.PI);
  const pt = ([x, y]) => `${f1(x)} ${f1(y)}`;
  const polygon = (points) => `M${points.map(pt).join(' L')} Z`;
  /** The point on the wall behind a point on the near plane (towards the vanishing point). */
  const toWall = ([x, y], ratio = 1 / NEAR) => [VP_X + (x - VP_X) * ratio, HORIZON + (y - HORIZON) * ratio];
  /** A floor point at wall abscissa `x`, `scale` times nearer than the wall (1 = against it). */
  const onFloor = (x, scale) => [VP_X + (x - VP_X) * scale, HORIZON + (BASE - HORIZON) * scale];
  /** How much nearer than the wall a floor depth `d` (in wall pixels) is. */
  const depthScale = (d) => CAMERA / (CAMERA - d);

  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixHex(a, b, k) {
    const A = hexRgb(a);
    const B = hexRgb(b);
    return `#${A.map((v, i) => Math.round(lerp(v, B[i], k)).toString(16).padStart(2, '0')).join('')}`;
  }
  function blend(a, b, k) {
    if (Array.isArray(a)) return a.map((v, i) => blend(v, b[i], k));
    if (typeof a === 'string') return mixHex(a, b, k);
    return lerp(a, b, k);
  }
  /** A keyframed value at x: numbers, colours, or arrays of them, eased between frames (smoothstep unless `ease` is given). */
  function track(frames, x, ease = smooth) {
    if (x <= frames[0][0]) return frames[0][1];
    for (let i = 1; i < frames.length; i++) {
      if (x <= frames[i][0]) {
        const [x0, v0] = frames[i - 1];
        const [x1, v1] = frames[i];
        return blend(v0, v1, ease((x - x0) / (x1 - x0)));
      }
    }
    return frames[frames.length - 1][1];
  }

  /** setAttribute that skips writes of an unchanged value. */
  function writer() {
    const seen = new WeakMap();
    return (node, name, value) => {
      let last = seen.get(node);
      if (!last) seen.set(node, (last = {}));
      if (last[name] !== value) {
        last[name] = value;
        node.setAttribute(name, value);
      }
    };
  }

  function gradient(defs, id, stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1, radial = false, attrs = {} } = {}) {
    const g = radial
      ? svg('radialGradient', { id, ...attrs }, defs)
      : svg('linearGradient', { id, x1, y1, x2, y2, ...attrs }, defs);
    for (const [offset, color, opacity = 1] of stops) svg('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }, g);
    return g;
  }

  /** A turned baluster centred on x, from yTop to yBottom, `w` at its widest. */
  function baluster(x, yTop, yBottom, w) {
    const h = yBottom - yTop;
    const profile = [[0, 1], [0.1, 1], [0.12, 0.6], [0.17, 0.6], [0.24, 0.92], [0.33, 1], [0.45, 0.72], [0.55, 0.42],
      [0.65, 0.42], [0.69, 0.78], [0.74, 0.78], [0.77, 0.5], [0.86, 0.5], [0.89, 1], [1, 1]];
    const left = profile.map(([f, k]) => [x - (k * w) / 2, yBottom - f * h]);
    const right = profile.map(([f, k]) => [x + (k * w) / 2, yBottom - f * h]).reverse();
    return polygon([...left, ...right]);
  }

  /** The stair's pitch line through its nosings (y at x), and its geometry. */
  function stairGeometry() {
    const { x0, y0, x1, y1, steps } = STAIR;
    const going = (x1 - x0) / steps;
    const rise = (y0 - y1) / steps;
    const pitch = (x) => y0 - ((x - x0) * rise) / going;
    const treads = Array.from({ length: steps }, (_, i) => ({ left: x0 + i * going, right: x0 + (i + 1) * going, y: y0 - (i + 1) * rise }));
    return { going, rise, pitch, treads };
  }

  // ------------------------------------------------------------------
  // The library
  // ------------------------------------------------------------------

  /** Where the walls meet the coffered ceiling. */
  const WALL_TOP = 60;
  /** Pilaster centres on the upper wall; the ceiling's ribs run out from them. */
  const PILASTERS = [36, 186, 334, 480, 626, 774, 926];
  /** The rose window in the right-hand bay of the upper wall, clear above the gallery's handrail. */
  const ROSE = { cx: 850, cy: 104, r: 23 };
  /**
   * Shafts of late sun from high windows in the left-hand wall, out of view:
   * where each enters at the stage's left edge, [top, bottom].
   */
  const SUNBEAMS = [[10, 58], [96, 140], [186, 222]];
  /** The library's spiral stair to the gallery, at the right-hand edge. */
  const SPIRAL = { x: 934, foot: 446, top: 190, radius: 34, steps: 16 };

  const BOOK_TONES = ['oxblood', 'forest', 'navy', 'ochre', 'plum', 'tan', 'teal', 'umber', 'crimson', 'olive'];

  /** Collects book spines by colour, with their gilt, labels, raised bands, and modelling, into a few paths. */
  function bookBinder() {
    const tones = Object.fromEntries(BOOK_TONES.map((tone) => [tone, []]));
    const gilt = [];
    const labels = [];
    const bands = [];
    const light = [];
    const dark = [];
    return {
      spine(tone, points) {
        tones[tone].push(polygon(points));
      },
      upright(x, y, w, h, r) {
        light.push(`M${f1(x + 1.1)} ${f1(y + 1)}V${f1(y + h - 0.5)}`);
        dark.push(`M${f1(x + w - 0.7)} ${f1(y + 0.5)}V${f1(y + h)}`);
        if (w >= 6 && r > 0.25) gilt.push(`M${f1(x + 1)} ${f1(y + 3.5)}H${f1(x + w - 1)}M${f1(x + 1)} ${f1(y + h - 4)}H${f1(x + w - 1)}`);
        if (w >= 7 && r > 0.62) labels.push(`M${f1(x + 1.6)} ${f1(y + h * 0.28)}h${f1(w - 3.2)}v${f1(Math.min(8, h * 0.17))}h${f1(3.2 - w)}Z`);
        // Leather bindings show raised bands across the spine.
        if (w >= 7 && r > 0.1 && r < 0.45) {
          for (const f of [0.42, 0.58, 0.74]) bands.push(`M${f1(x + 0.8)} ${f1(y + h * f)}H${f1(x + w - 0.8)}`);
        }
      },
      lying(x, y, w) {
        light.push(`M${f1(x + 1)} ${f1(y + 0.7)}H${f1(x + w - 1)}`);
      },
      draw(parent) {
        for (const tone of BOOK_TONES) svg('path', { class: `agc-book agc-book--${tone}`, d: tones[tone].join('') }, parent);
        svg('path', { class: 'agc-book-label', d: labels.join('') }, parent);
        svg('path', { class: 'agc-book-band', d: bands.join('') }, parent);
        svg('path', { class: 'agc-book-dark', d: dark.join('') }, parent);
        svg('path', { class: 'agc-book-light', d: light.join('') }, parent);
        svg('path', { class: 'agc-book-gilt', d: gilt.join('') }, parent);
      },
    };
  }

  /**
   * One shelf of books between x0 and x1: upright books of many heights and
   * widths (now and then a tall folio), a book leaning into each gap, and a
   * small stack lying flat here and there.
   */
  function shelfOfBooks(books, x0, x1, top, bottom, seed) {
    const space = bottom - top;
    const tone = (r) => BOOK_TONES[Math.floor(r * BOOK_TONES.length)];
    let x = x0 + 3 * hash01(seed);
    let lean = false;
    for (let i = 0; x < x1 - 4 && i < 200; i++) {
      const r = (k) => hash01(seed * 7919 + i * 131 + k * 17);
      if (r(1) < 0.05 && x1 - x > 24) {
        x += 6 + 8 * r(2);
        lean = true;
        continue;
      }
      if (r(3) > 0.955 && x1 - x > 34) {
        const w = 22 + 8 * r(4);
        let y = bottom;
        for (let k = 0; k < 3; k++) {
          const h = 3.6 + 2.6 * r(5 + k);
          const inset = k * 1.4 + 1.5 * r(8 + k);
          books.spine(tone(r(11 + k)), [[x + inset, y], [x + w - inset, y], [x + w - inset, y - h], [x + inset, y - h]]);
          books.lying(x + inset, y - h, w - 2 * inset);
          y -= h + 0.3;
        }
        x += w + 2;
        continue;
      }
      const folio = r(12) > 0.93;
      const w = Math.min(x1 - x, folio ? 13 + Math.round(4 * r(6)) : 4 + Math.round(8 * r(6)));
      if (w < 4) break;
      const h = space * (folio ? 0.9 + 0.07 * r(7) : 0.56 + 0.4 * r(7));
      if (lean) {
        // Leaning back into the gap left before it.
        const tilt = Math.min(8, h * 0.2);
        books.spine(tone(r(14)), [[x, bottom], [x + w, bottom], [x + w - tilt, bottom - h + 1], [x - tilt, bottom - h + 1]]);
        lean = false;
      } else {
        books.spine(tone(r(14)), [[x, bottom], [x + w, bottom], [x + w, bottom - h], [x, bottom - h]]);
        books.upright(x, bottom - h, w, h, r(9));
      }
      x += w + (r(10) > 0.85 ? 1.2 : 0.35);
    }
  }

  /**
   * A run of bookcases on the wall: dark niches, books on every shelf, the
   * shadow each shelf throws on the books below it, the shelf boards with a
   * lit front edge, and the uprights between bays.
   */
  function bookcases(parent, { spans, rows, top, bottom, upright, seed, bayWidth = 88 }) {
    const g = svg('g', { class: 'agc-bookcase' }, parent);
    const bays = [];
    for (const [a, b] of spans) {
      const n = Math.max(1, Math.round((b - a) / bayWidth));
      for (let k = 0; k < n; k++) bays.push([a + (k * (b - a)) / n, a + ((k + 1) * (b - a)) / n]);
    }
    for (const [a, b] of spans) svg('rect', { x: a, y: top, width: b - a, height: bottom - top, fill: 'url(#agc-l-niche)' }, g);
    const books = bookBinder();
    bays.forEach(([a, b], bay) => rows.forEach(([rowTop, rowBottom], row) => {
      shelfOfBooks(books, a + upright / 2 + 1, b - upright / 2 - 1, rowTop, rowBottom, seed + bay * 31 + row * 7);
    }));
    books.draw(g);
    const boards = [];
    const edges = [];
    for (const [a, b] of spans) {
      let y = top;
      for (const [rowTop, rowBottom] of rows) {
        svg('rect', { x: a, y: rowTop, width: b - a, height: 13, fill: 'url(#agc-l-shelf-shadow)' }, g);
        if (rowTop > y) {
          boards.push(`M${a} ${y}H${b}V${rowTop}H${a}Z`);
          edges.push(`M${a} ${y + 0.6}H${b}`);
        }
        y = rowBottom;
      }
      if (bottom > y) {
        boards.push(`M${a} ${y}H${b}V${bottom}H${a}Z`);
        edges.push(`M${a} ${y + 0.6}H${b}`);
      }
    }
    svg('path', { class: 'agc-board', d: boards.join('') }, g);
    svg('path', { class: 'agc-board-edge', d: edges.join('') }, g);
    const posts = [...new Set(bays.flat().map((x) => Math.round(x * 10) / 10))];
    svg('path', { class: 'agc-upright-shadow', d: posts.map((x) => `M${f1(x + upright / 2)} ${top}h4V${bottom}h-4Z`).join('') }, g);
    for (const x of posts) svg('rect', { x: f1(x - upright / 2), y: top, width: upright, height: bottom - top, fill: 'url(#agc-l-wood)' }, g);
    svg('path', { class: 'agc-upright-light', d: posts.map((x) => `M${f1(x - upright / 2 + 2)} ${top}V${bottom}`).join('') }, g);
    return bays;
  }

  /** Doors under the lower shelves: a raised panel in each bay. */
  function cupboards(parent, bays, top, bottom) {
    const g = svg('g', { class: 'agc-cupboards' }, parent);
    svg('rect', { class: 'agc-cupboard', x: 0, y: top, width: W, height: bottom - top }, g);
    const panels = [];
    const lights = [];
    const shades = [];
    for (const [a, b] of bays) {
      const x = a + 10;
      const w = b - a - 20;
      const y = top + 8;
      const h = bottom - top - 18;
      panels.push(`M${f1(x)} ${y}h${f1(w)}v${h}h${f1(-w)}Z`);
      lights.push(`M${f1(x)} ${y + h}V${y}H${f1(x + w)}`);
      shades.push(`M${f1(x + w)} ${y}V${y + h}H${f1(x)}`);
    }
    svg('path', { class: 'agc-cupboard-panel', d: panels.join('') }, g);
    svg('path', { class: 'agc-cupboard-shade', d: shades.join('') }, g);
    svg('path', { class: 'agc-cupboard-light', d: lights.join('') }, g);
    svg('rect', { class: 'agc-plinth', x: 0, y: bottom, width: W, height: BASE - bottom }, g);
    svg('rect', { class: 'agc-cornice-shadow', x: 0, y: top, width: W, height: 4 }, g);
  }

  /**
   * The coffered ceiling, in perspective above the wall: walnut ribs running
   * out from the pilasters and across, each coffer a recessed panel with a
   * gilt rosette. It is warmed from the left, where the sun comes in, and
   * falls into shadow towards the right-hand corner.
   */
  function cofferedCeiling(parent) {
    const g = svg('g', { class: 'agc-coffers' }, parent);
    svg('rect', { class: 'agc-coffer-rib', x: 0, y: 0, width: W, height: WALL_TOP }, g);
    const depths = [1, 1.09, 1.19, 1.3, 1.43, 1.58];
    const columns = [-410, -262, -112, ...PILASTERS, 1072, 1222, 1370];
    const at = (x, s) => [VP_X + (x - VP_X) * s, HORIZON - (HORIZON - WALL_TOP) * s];
    // A point a fraction (u, v) of the way across a coffer, and a recessed one (further from eye level).
    const cell = (xa, xb, sa, sb) => (u, v, deeper = 1) => {
      const [x, y] = at(lerp(xa, xb, u), lerp(sa, sb, v));
      return [x, HORIZON - (HORIZON - y) * deeper];
    };
    const recesses = [];
    const steps = [];
    const panels = [];
    const gilt = [];
    const rosettes = [];
    for (let k = 0; k < depths.length - 1; k++) {
      for (let c = 0; c < columns.length - 1; c++) {
        const p = cell(columns[c], columns[c + 1], depths[k], depths[k + 1]);
        const quad = (m, deeper) => [p(m, m, deeper), p(1 - m, m, deeper), p(1 - m, 1 - m, deeper), p(m, 1 - m, deeper)];
        recesses.push(polygon(quad(0.09, 1)));
        steps.push(polygon(quad(0.16, 1.015)));
        panels.push(polygon(quad(0.24, 1.03)));
        gilt.push(polygon(quad(0.09, 1)));
        const [rx, ry] = p(0.5, 0.5, 1.03);
        const s = lerp(depths[k], depths[k + 1], 0.5);
        rosettes.push(`M${f1(rx - 3 * s)} ${f1(ry)}a${f1(3 * s)} ${f1(1.7 * s)} 0 1 0 ${f1(6 * s)} 0a${f1(3 * s)} ${f1(1.7 * s)} 0 1 0 ${f1(-6 * s)} 0Z`);
      }
    }
    svg('path', { class: 'agc-coffer-recess', d: recesses.join('') }, g);
    svg('path', { class: 'agc-coffer-step', d: steps.join('') }, g);
    svg('path', { class: 'agc-coffer-panel', d: panels.join('') }, g);
    svg('path', { class: 'agc-coffer-gilt', d: gilt.join('') }, g);
    svg('path', { class: 'agc-coffer-rosette', d: rosettes.join('') }, g);
    // Warm bounce from the sunlit left, shadow gathering in the right-hand corner.
    svg('rect', { x: 0, y: 0, width: W, height: WALL_TOP, fill: 'url(#agc-l-ceiling-light)' }, g);
    svg('rect', { x: 0, y: WALL_TOP - 14, width: W, height: 14, fill: 'url(#agc-l-ceiling-haze)' }, g);
  }

  /** The carved cornice where the wall meets the ceiling: a cyma, dentils, egg-and-dart, a gilt bead. */
  function cornice(parent) {
    const g = svg('g', { class: 'agc-cornice' }, parent);
    const y = WALL_TOP;
    svg('rect', { class: 'agc-cornice-shade', x: 0, y, width: W, height: 3 }, g);
    svg('rect', { x: 0, y: y + 3, width: W, height: 6, fill: 'url(#agc-l-crown)' }, g);
    svg('rect', { class: 'agc-dentil-band', x: 0, y: y + 9, width: W, height: 5 }, g);
    svg('rect', { x: 0, y: y + 9, width: W, height: 5, fill: 'url(#agc-l-dentils)' }, g);
    svg('rect', { class: 'agc-dentil-band', x: 0, y: y + 14, width: W, height: 4 }, g);
    svg('rect', { x: 0, y: y + 14, width: W, height: 4, fill: 'url(#agc-l-egg-dart)' }, g);
    svg('rect', { class: 'agc-gilt-bead', x: 0, y: y + 18, width: W, height: 1.4 }, g);
    svg('rect', { class: 'agc-cornice-base', x: 0, y: y + 19.4, width: W, height: 3 }, g);
    svg('rect', { x: 0, y: y + 22.4, width: W, height: 10, fill: 'url(#agc-l-shelf-shadow)' }, g);
  }

  /** A fluted pilaster with a moulded base and a capital with small volutes. */
  function pilaster(parent, x, top, bottom, width) {
    const g = svg('g', { class: 'agc-pilaster' }, parent);
    const half = width / 2;
    svg('rect', { x: f1(x - half), y: top + 10, width, height: bottom - top - 16, fill: 'url(#agc-l-wood)' }, g);
    const flutes = [-0.45, -0.15, 0.15, 0.45].map((f) => `M${f1(x + f * width)} ${top + 16}V${bottom - 12}`).join('');
    svg('path', { class: 'agc-flute', d: flutes }, g);
    svg('path', { class: 'agc-flute-light', d: [-0.32, -0.02, 0.28].map((f) => `M${f1(x + f * width)} ${top + 16}V${bottom - 12}`).join('') }, g);
    // Capital: an abacus, a bell, and two volutes.
    svg('rect', { x: f1(x - half - 3), y: top, width: width + 6, height: 3.5, fill: 'url(#agc-l-rail)' }, g);
    svg('path', { class: 'agc-capital', d: `M${f1(x - half - 1)} ${top + 3.5}h${width + 2}l-2 7h${-width + 2}Z` }, g);
    for (const side of [-1, 1]) svg('circle', { class: 'agc-volute', cx: f1(x + side * (half - 0.5)), cy: top + 6.5, r: 2.4 }, g);
    svg('rect', { x: f1(x - half - 2), y: bottom - 6, width: width + 4, height: 6, fill: 'url(#agc-l-rail)' }, g);
  }

  /** A circle as a path, so circles can be cut out of one another (even-odd). */
  const ring = (cx, cy, r) => `M${f1(cx - r)} ${f1(cy)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`;

  /**
   * The rose window of the upper wall: a moulded ring with four keystones,
   * its reveal, and stone tracery (eight round lights about a central one)
   * over warm late-afternoon glass. It faces away from the sun, so it glows
   * but casts no beams of its own.
   */
  function roseWindow(parent, defs) {
    const { cx, cy, r } = ROSE;
    const g = svg('g', { class: 'agc-window' }, parent);
    svg('ellipse', { cx, cy, rx: 120, ry: 96, fill: 'url(#agc-l-window-spill)' }, g);
    svg('circle', { class: 'agc-window-surround', cx, cy, r: r + 11 }, g);
    svg('circle', { class: 'agc-window-moulding', cx, cy, r: r + 6 }, g);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      svg('rect', { class: 'agc-keystone', x: f1(cx + dx * (r + 8) - 4), y: f1(cy + dy * (r + 8) - 4), width: 8, height: 8, transform: `rotate(45 ${f1(cx + dx * (r + 8))} ${f1(cy + dy * (r + 8))})` }, g);
    }
    svg('circle', { class: 'agc-window-reveal', cx, cy, r: r + 1.5 }, g);
    svg('circle', { cx: f1(cx + (VP_X - cx) * 0.03), cy: f1(cy + (HORIZON - cy) * 0.03), r }, svg('clipPath', { id: 'agc-l-glass' }, defs));
    const pane = svg('g', { 'clip-path': 'url(#agc-l-glass)' }, g);
    svg('circle', { cx, cy, r: r + 2, fill: 'url(#agc-l-sky)' }, pane);
    svg('rect', { x: cx - r - 2, y: cy - r - 2, width: 2 * r + 4, height: 2 * r + 4, fill: 'url(#agc-l-lead)' }, pane);
    // Tracery: the stone left between eight round lights and a central one.
    const lights = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * 2 * Math.PI;
      lights.push(ring(cx + Math.sin(angle) * r * 0.62, cy - Math.cos(angle) * r * 0.62, r * 0.27));
    }
    svg('path', { class: 'agc-tracery', d: ring(cx, cy, r + 2) + lights.join('') + ring(cx, cy, r * 0.22), 'fill-rule': 'evenodd' }, pane);
    svg('path', { class: 'agc-tracery-light', d: ring(cx, cy, r * 0.22) }, pane);
  }

  /**
   * The gallery: the wall's frieze, the gallery's moulded front on carved
   * brackets, its underside and the deep shadow it casts, the
   * turned-baluster railing with newel posts, and warm light along the
   * handrail's top.
   */
  function gallery(parent) {
    const g = svg('g', { class: 'agc-gallery' }, parent);
    const left = LIBRARY.mezzanine.x;
    svg('rect', { class: 'agc-frieze', x: 0, y: 196, width: W, height: 18 }, g);
    svg('path', { class: 'agc-frieze-line', d: 'M0 197.5H960M0 212H960' }, g);
    svg('rect', { x: 0, y: 214, width: W, height: 92, fill: 'url(#agc-l-under)' }, g);
    svg('path', { class: 'agc-soffit', d: polygon([[left, 210], [W, 210], [W, 214], toWall([left, 210])]) }, g);
    // Carved brackets under the gallery front, above the lower uprights.
    const brackets = [];
    for (let x = 262; x < W; x += 87.3) {
      brackets.push(`M${f1(x - 7)} 210h14v3c0 7 -2 11 -5 15c-1.5 2 -1.5 4 0 5.5c-2.5 0.6 -5 -1 -5 -3.5c0 -3 2 -5 2 -9c0 -3 -2 -5 -6 -6Z`);
    }
    svg('path', { class: 'agc-bracket', d: brackets.join('') }, g);
    svg('rect', { x: left, y: 190, width: W - left, height: 20, fill: 'url(#agc-l-fascia)' }, g);
    svg('rect', { class: 'agc-fascia-light', x: left, y: 190, width: W - left, height: 1.6 }, g);
    svg('rect', { x: left, y: 201, width: W - left, height: 5, fill: 'url(#agc-l-dentils)' }, g);
    svg('rect', { class: 'agc-gilt-bead', x: left, y: 207, width: W - left, height: 1.4 }, g);
    // The railing.
    svg('rect', { x: left, y: 184.5, width: W - left, height: 5.5, fill: 'url(#agc-l-rail)' }, g);
    const posts = [left, 380, 570, 760];
    const balusters = [];
    const lights = [];
    for (let x = left + 9; x < W + 6; x += 11) {
      if (posts.some((p) => Math.abs(p - x) < 10)) continue;
      balusters.push(baluster(x, 139, 184.5, 6.2));
      lights.push(`M${f1(x - 1.4)} 145V178.5`);
    }
    svg('path', { class: 'agc-baluster', d: balusters.join('') }, g);
    svg('path', { class: 'agc-baluster-light', d: lights.join('') }, g);
    svg('rect', { x: left, y: 131, width: W - left, height: 8.5, fill: 'url(#agc-l-rail)' }, g);
    svg('rect', { x: left, y: 130.6, width: W - left, height: 1.8, fill: 'url(#agc-l-rim)' }, g);
    for (const x of posts) newelPost(g, x, 122, 190);
    // The gallery's open end on the left, carried on a deeper corbel.
    svg('path', { class: 'agc-bracket', d: `M${left - 8} 210h16v4c0 12 -4 20 -9 26c-2 3 -2 6 0 8c-4 1 -8 -2 -8 -6c0 -5 3 -8 3 -14c0 -6 -2 -11 -2 -18Z` }, g);
    return g;
  }

  /** A square newel post with a moulded cap and a ball finial. */
  function newelPost(parent, x, top, bottom) {
    svg('rect', { x: x - 6.5, y: top + 8, width: 13, height: bottom - top - 8, fill: 'url(#agc-l-wood)' }, parent);
    svg('rect', { class: 'agc-post-panel', x: x - 3.5, y: top + 18, width: 7, height: bottom - top - 34 }, parent);
    svg('rect', { x: x - 8.5, y: top + 4, width: 17, height: 5, fill: 'url(#agc-l-rail)' }, parent);
    svg('circle', { cx: x, cy: top - 1, r: 5.2, fill: 'url(#agc-l-knob)' }, parent);
  }

  /**
   * A cast-iron and oak spiral stair up to the gallery at the right-hand
   * edge: wedge treads winding round a slim newel, a baluster at each
   * tread's outer end, and a helical handrail. The half of the spiral
   * behind the newel is drawn first and darker.
   */
  function spiralStair(parent) {
    const { x: cx, foot, top, radius: R, steps } = SPIRAL;
    const g = svg('g', { class: 'agc-spiral' }, parent);
    const rise = (foot - top) / steps;
    const TURN = 30;
    const rail = 40;
    const tread = (i) => {
      const angle = (i * TURN - 40) * RADIANS;
      const half = 13 * RADIANS;
      const y = foot - (i + 1) * rise;
      const a = cx + R * Math.sin(angle - half);
      const b = cx + R * Math.sin(angle + half);
      return { y, angle, front: Math.cos(angle) > 0, xs: [cx, a, b], outer: cx + R * Math.sin(angle) };
    };
    const treads = Array.from({ length: steps }, (_, i) => tread(i));
    const slab = (t) => polygon([[Math.min(...t.xs), t.y], [Math.max(...t.xs), t.y], [Math.max(...t.xs), t.y + 4], [Math.min(...t.xs), t.y + 4]]);
    const helix = (from, to, front) => {
      const parts = [];
      let open = false;
      for (let k = from; k <= to; k += 0.1) {
        const angle = (k * TURN - 40) * RADIANS;
        const p = [cx + R * Math.sin(angle), foot - (k + 1) * rise - rail];
        const isFront = Math.cos(angle) > 0;
        if (isFront === front) {
          parts.push(`${open ? 'L' : 'M'}${pt(p)}`);
          open = true;
        } else open = false;
      }
      return parts.join('');
    };
    svg('ellipse', { class: 'agc-floor-shadow', cx, cy: foot + 2, rx: R + 6, ry: 5 }, g);
    const back = treads.filter((t) => !t.front);
    const front = treads.filter((t) => t.front);
    svg('path', { class: 'agc-spiral-tread agc-spiral-tread--back', d: back.map(slab).join('') }, g);
    svg('path', { class: 'agc-spiral-baluster agc-spiral-baluster--back', d: back.map((t) => `M${f1(t.outer)} ${f1(t.y)}v${-rail}`).join('') }, g);
    svg('path', { class: 'agc-spiral-rail agc-spiral-rail--back', d: helix(-0.5, steps - 0.5, false) }, g);
    svg('rect', { x: cx - 3, y: top - 46, width: 6, height: foot - top + 46, fill: 'url(#agc-l-iron)' }, g);
    svg('circle', { class: 'agc-spiral-finial', cx, cy: top - 49, r: 4.5 }, g);
    svg('path', { class: 'agc-spiral-tread', d: front.map(slab).join('') }, g);
    svg('path', { class: 'agc-spiral-tread-light', d: front.map((t) => `M${f1(Math.min(...t.xs))} ${f1(t.y + 0.6)}H${f1(Math.max(...t.xs))}`).join('') }, g);
    svg('path', { class: 'agc-spiral-baluster', d: front.map((t) => `M${f1(t.outer)} ${f1(t.y)}v${-rail}`).join('') }, g);
    svg('path', { class: 'agc-spiral-rail', d: helix(-0.5, steps - 0.5, true) }, g);
    svg('path', { class: 'agc-spiral-rail-light', d: helix(-0.5, steps - 0.5, true) }, g);
  }

  /** The brass rail along the lower shelves and the rolling ladder hooked onto it. */
  function libraryLadder(parent, x) {
    const g = svg('g', { class: 'agc-ladder' }, parent);
    svg('rect', { class: 'agc-ladder-rail-shadow', x: 222, y: 232, width: W - 222, height: 2 }, g);
    svg('rect', { x: 222, y: 228, width: W - 222, height: 3.4, fill: 'url(#agc-l-brass-v)' }, g);
    for (const bx of [262, 452, 642, 832]) svg('rect', { class: 'agc-brass-dark', x: bx - 2, y: 226, width: 4, height: 8 }, g);
    const top = [x, x + 32];
    const footScale = depthScale(32);
    const foot = top.map((tx) => onFloor(tx, footScale));
    svg('ellipse', { class: 'agc-floor-shadow', cx: f1((foot[0][0] + foot[1][0]) / 2), cy: f1(foot[0][1] + 2), rx: 30, ry: 4 }, g);
    const rungs = [];
    for (let k = 1; k <= 11; k++) {
      const f = k / 12;
      const a = [lerp(top[0], foot[0][0], f), lerp(229, foot[0][1], f)];
      const b = [lerp(top[1], foot[1][0], f), lerp(229, foot[1][1], f)];
      rungs.push(polygon([[a[0], a[1] - 1.6], [b[0], b[1] - 1.6], [b[0], b[1] + 1.6], [a[0], a[1] + 1.6]]));
    }
    svg('path', { class: 'agc-ladder-rung', d: rungs.join('') }, g);
    for (let i = 0; i < 2; i++) {
      svg('path', { class: 'agc-ladder-side', d: polygon([[top[i] - 2, 226], [top[i] + 2, 226], [foot[i][0] + 2.4, foot[i][1] - 3], [foot[i][0] - 2.4, foot[i][1] - 3]]) }, g);
      svg('path', { class: 'agc-ladder-hook', d: `M${top[i] - 2} 232 V225 Q${top[i] + 3} 220 ${top[i] + 5} 227` }, g);
      svg('circle', { class: 'agc-ladder-wheel', cx: f1(foot[i][0]), cy: f1(foot[i][1] - 2), r: 3.6 }, g);
      svg('circle', { class: 'agc-ladder-hub', cx: f1(foot[i][0]), cy: f1(foot[i][1] - 2), r: 1.2 }, g);
    }
  }

  /** The near pilaster at the left-hand edge, framing the room in deep shadow, its edge rimmed by the sun. */
  function nearPilaster(parent) {
    const g = svg('g', { class: 'agc-near-pilaster' }, parent);
    svg('rect', { x: -6, y: 0, width: 36, height: H, fill: 'url(#agc-l-near-wood)' }, g);
    svg('path', { class: 'agc-flute', d: 'M6 74V432M14 74V432M22 74V432' }, g);
    svg('rect', { class: 'agc-near-capital', x: -8, y: 40, width: 44, height: 8 }, g);
    svg('rect', { class: 'agc-near-capital', x: -6, y: 48, width: 40, height: 18 }, g);
    svg('circle', { class: 'agc-volute', cx: 31, cy: 56, r: 4 }, g);
    svg('rect', { class: 'agc-near-capital', x: -8, y: 426, width: 44, height: 12 }, g);
    svg('rect', { class: 'agc-near-rim', x: 28.5, y: 66, width: 1.6, height: 360 }, g);
  }

  /**
   * Chevron parquet in true perspective: columns of planks converging on the
   * vanishing point, their joints slanting in alternate directions; two
   * tones for the two directions, so the light picks out the pattern.
   */
  function parquet(parent) {
    const g = svg('g', { class: 'agc-parquet' }, parent);
    svg('rect', { class: 'agc-parquet-base', x: 0, y: BASE, width: W, height: H - BASE }, g);
    const COLUMN = 30;
    const PERIOD = 26;
    const SLANT = 13;
    const DEEPEST = 255;
    const tones = { a: [], b: [], c: [] };
    const joints = [];
    for (let c = -2; c * COLUMN < W + 2 * COLUMN; c++) {
      const xa = c * COLUMN;
      const xb = xa + COLUMN;
      const dir = c % 2 === 0 ? 1 : -1;
      const offset = (c & 1) ? PERIOD / 2 : 0;
      joints.push(`M${pt(onFloor(xa, 1))}L${pt(onFloor(xa, depthScale(DEEPEST)))}`);
      for (let k = -1; k * PERIOD < DEEPEST + PERIOD; k++) {
        const da = k * PERIOD + offset;
        const corner = (x, d) => onFloor(x, depthScale(clamp(d, 0, DEEPEST)));
        const quad = [corner(xa, da), corner(xb, da + SLANT * dir), corner(xb, da + PERIOD + SLANT * dir), corner(xa, da + PERIOD)];
        const r = hash01(c * 101 + k * 37 + 5);
        const tone = r < 0.22 ? 'c' : dir > 0 ? 'a' : 'b';
        tones[tone].push(polygon(quad));
        joints.push(`M${pt(quad[0])}L${pt(quad[1])}`);
      }
    }
    for (const tone of ['a', 'b', 'c']) svg('path', { class: `agc-parquet-${tone}`, d: tones[tone].join('') }, g);
    svg('path', { class: 'agc-parquet-joint', d: joints.join('') }, g);
  }

  /** A rug under the reading table: an oxblood field, a navy border with gold lines, a lozenge medallion. */
  function rug(parent) {
    const g = svg('g', { class: 'agc-rug' }, parent);
    const quad = (x0, x1, d0, d1) => polygon([onFloor(x0, depthScale(d0)), onFloor(x1, depthScale(d0)), onFloor(x1, depthScale(d1)), onFloor(x0, depthScale(d1))]);
    svg('path', { class: 'agc-rug-border', d: quad(196, 764, 26, 300) }, g);
    svg('path', { class: 'agc-rug-gold', d: quad(204, 756, 31, 300) }, g);
    svg('path', { class: 'agc-rug-border', d: quad(207, 753, 33, 300) }, g);
    svg('path', { class: 'agc-rug-gold', d: quad(222, 738, 42, 300) }, g);
    svg('path', { class: 'agc-rug-field', d: quad(225, 735, 44, 300) }, g);
    svg('path', { d: quad(225, 735, 44, 300), fill: 'url(#agc-l-rug-motif)' }, g);
    const lozenge = (half, d0, d1) => polygon([
      onFloor(480, depthScale(d0)), onFloor(480 + half, depthScale((d0 + d1) / 2)),
      onFloor(480, depthScale(d1)), onFloor(480 - half, depthScale((d0 + d1) / 2)),
    ]);
    svg('path', { class: 'agc-rug-gold-line', d: lozenge(150, 96, 224) }, g);
    svg('path', { class: 'agc-rug-medallion', d: lozenge(140, 100, 220) }, g);
    svg('path', { class: 'agc-rug-medallion-inner', d: lozenge(96, 122, 198) }, g);
    svg('path', { class: 'agc-rug-medallion', d: lozenge(40, 146, 174) }, g);
    const fringe = [];
    for (let x = 200; x <= 760; x += 6) fringe.push(`M${pt(onFloor(x, depthScale(26)))}l0 -2.4`);
    svg('path', { class: 'agc-rug-fringe', d: fringe.join('') }, g);
  }

  /**
   * Late sun from the high windows in the left-hand wall: soft shafts
   * slanting down across the room to warm pools on the floor. Each shaft
   * fades along its length (its fill) and towards both edges (a mask graded
   * across it), so no edge is hard. As the afternoon wears on (`late`,
   * 0 → 1) the sun sinks a little: the shafts flatten, reach further, and warm.
   */
  function sunbeams(parent, defs) {
    const g = svg('g', { class: 'agc-sunbeams' }, parent);
    const pools = svg('g', {}, g);
    const beams = SUNBEAMS.map(([a, b], i) => {
      const grad = gradient(defs, `agc-l-beam-${i}`, [[0, '#ffe2b0', 0.05], [0.1, '#ffe2b0', 0.3], [0.55, '#ffd49a', 0.15], [1, '#ffc888', 0.03]], {
        attrs: { gradientUnits: 'userSpaceOnUse' },
      });
      const across = gradient(defs, `agc-l-beam-across-${i}`, [[0, '#ffffff', 0], [0.3, '#ffffff', 0.85], [0.5, '#ffffff', 1], [0.7, '#ffffff', 0.85], [1, '#ffffff', 0]], {
        attrs: { gradientUnits: 'userSpaceOnUse' },
      });
      const mask = svg('mask', { id: `agc-l-beam-mask-${i}`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, defs);
      const maskShape = svg('path', { fill: `url(#agc-l-beam-across-${i})` }, mask);
      const shape = svg('path', { fill: `url(#agc-l-beam-${i})`, mask: `url(#agc-l-beam-mask-${i})` }, g);
      const pool = svg('ellipse', { fill: 'url(#agc-l-sun-pool)' }, pools);
      return { a, b, grad, across, maskShape, layers: [shape], pool };
    });
    const geometry = (late) => {
      const slope = Math.tan((31 - 4 * late) * RADIANS);
      return beams.map((beam) => {
        const mid = (beam.a + beam.b) / 2;
        const halfWidth = (beam.b - beam.a) / 2;
        // The shaft ends where its axis reaches the floor in front of the table.
        const floorY = 452 + 10 * hash01(beam.a);
        const length = (floorY - mid) / slope;
        return { beam, mid, halfWidth, slope, length, floorY };
      });
    };
    const pose = (late, set) => {
      const color = mixHex('#ffe2b0', '#ffc27e', late);
      for (const { beam, mid, halfWidth, length, floorY } of geometry(late)) {
        const end = [length, floorY];
        // Widening a little as it travels, as sunlight through a window does.
        const spread = halfWidth * 1.35;
        const d = polygon([[-4, mid - halfWidth], [end[0] + 8, end[1] - spread], [end[0] - 8, end[1] + spread * 0.5], [-4, mid + halfWidth]]);
        set(beam.layers[0], 'd', d);
        set(beam.maskShape, 'd', d);
        // Grade the mask across the beam's middle: from its upper edge to its lower one, perpendicular to its axis.
        const cx = end[0] / 2;
        const cy = (mid + end[1]) / 2;
        const ux = end[0];
        const uy = end[1] - mid;
        const length_ = Math.hypot(ux, uy);
        const nx = -uy / length_;
        const ny = ux / length_;
        const reach = (halfWidth + spread) / 2 + 2;
        set(beam.across, 'x1', f1(cx - nx * reach));
        set(beam.across, 'y1', f1(cy - ny * reach));
        set(beam.across, 'x2', f1(cx + nx * reach));
        set(beam.across, 'y2', f1(cy + ny * reach));
        set(beam.grad, 'x1', '0');
        set(beam.grad, 'y1', f1(mid));
        set(beam.grad, 'x2', f1(end[0]));
        set(beam.grad, 'y2', f1(end[1]));
        for (const stop of beam.grad.children) set(stop, 'stop-color', color);
        set(beam.pool, 'cx', f1(end[0]));
        set(beam.pool, 'cy', f1(end[1] + 4));
        set(beam.pool, 'rx', f1(halfWidth * 2.6));
        set(beam.pool, 'ry', f1(halfWidth * 0.45));
      }
    };
    return { g, pose, geometry };
  }

  /** Dust motes drifting slowly through the sunbeams, brightest mid-beam. */
  function dust(parent, light) {
    const g = svg('g', { class: 'agc-dust' }, parent);
    const motes = Array.from({ length: 26 }, (_, i) => ({
      node: svg('circle', { r: f1(0.6 + 0.8 * hash01(i * 7 + 1)) }, g),
      beam: i % SUNBEAMS.length, u: hash01(i * 7 + 2), v: hash01(i * 7 + 3) - 0.5,
      speed: 0.004 + 0.005 * hash01(i * 7 + 5), sway: 6 + 5 * hash01(i * 7 + 6), phase: hash01(i * 7 + 4),
    }));
    return (t, late, set) => {
      const shafts = light.geometry(late);
      for (const m of motes) {
        const s = shafts[m.beam];
        const u = (m.u + m.speed * t) % 1;
        const along = 0.08 + 0.84 * u;
        const across = (m.v + 0.12 * wave(t, m.sway, m.phase)) * s.halfWidth * 1.4;
        const x = s.length * along;
        const y = s.mid + (s.floorY - s.mid) * along + across + 2.5 * wave(t, m.sway * 1.3, m.phase + 0.3);
        set(m.node, 'cx', f1(x));
        set(m.node, 'cy', f1(y));
        set(m.node, 'opacity', (0.7 * Math.sin(Math.PI * u)).toFixed(2));
      }
    };
  }

  /**
   * The long oak reading table in perspective (its top, moulded front edge,
   * apron, and turned legs), with books on it and two green banker's lamps
   * whose light pools on the oak. Returns the pools for posing.
   */
  function readingTable(parent) {
    const g = svg('g', { class: 'agc-table' }, parent);
    const front = depthScale(86);
    const back = depthScale(52);
    const HEIGHT = 55;
    const edge = (x, scale, up) => {
      const [fx, fy] = onFloor(x, scale);
      return [fx, fy - up * scale];
    };
    const X0 = 271;
    const X1 = 689;
    svg('path', { d: polygon([onFloor(X0 - 6, back), onFloor(X1 + 6, back), onFloor(X1 + 20, front + 0.05), onFloor(X0 - 20, front + 0.05)]), fill: 'url(#agc-l-table-shadow)' }, g);
    const legs = [];
    const turnedLeg = (x, top, bottom, w) => {
      const h = bottom - top;
      const k = [[0, 0.7], [0.08, 0.7], [0.1, 1], [0.16, 1], [0.2, 0.55], [0.36, 0.55], [0.5, 1], [0.62, 0.62], [0.88, 0.5], [0.94, 0.75], [1, 0.75]];
      const left = k.map(([f, s]) => [x - (s * w) / 2, top + f * h]);
      const right = k.map(([f, s]) => [x + (s * w) / 2, top + f * h]).reverse();
      return polygon([...left, ...right]);
    };
    for (const x of [X0 + 10, X1 - 10]) {
      const [lx, ly] = onFloor(x, back);
      legs.push(turnedLeg(lx, ly - (HEIGHT - 9) * back, ly, 11));
    }
    svg('path', { class: 'agc-table-leg agc-table-leg--back', d: legs.join('') }, g);
    const sb = [onFloor(X0 + 10, back), onFloor(X1 - 10, back)].map(([x, y]) => [x, y - 14]);
    svg('path', { class: 'agc-table-leg agc-table-leg--back', d: polygon([[sb[0][0], sb[0][1] - 2.5], [sb[1][0], sb[1][1] - 2.5], [sb[1][0], sb[1][1] + 2.5], [sb[0][0], sb[0][1] + 2.5]]) }, g);
    const frontLegs = [X0 + 8, 480, X1 - 8].map((x) => {
      const [lx, ly] = onFloor(x, front);
      return turnedLeg(lx, ly - (HEIGHT - 9) * front, ly, 14);
    });
    svg('path', { class: 'agc-table-leg', d: frontLegs.join('') }, g);
    svg('path', { class: 'agc-table-leg-light', d: [X0 + 8, 480, X1 - 8].map((x) => {
      const [lx, ly] = onFloor(x, front);
      return `M${f1(lx - 3)} ${f1(ly - (HEIGHT - 12) * front)}V${f1(ly - 4)}`;
    }).join('') }, g);
    const apron = [edge(X0 + 2, front, HEIGHT - 9), edge(X1 - 2, front, HEIGHT - 9), edge(X1 - 2, front, HEIGHT - 20), edge(X0 + 2, front, HEIGHT - 20)];
    svg('path', { class: 'agc-table-apron', d: polygon(apron) }, g);
    const top = [edge(X0, back, HEIGHT), edge(X1, back, HEIGHT), edge(X1, front, HEIGHT), edge(X0, front, HEIGHT)];
    svg('path', { d: polygon(top), fill: 'url(#agc-l-tabletop)' }, g);
    const lip = [edge(X0, front, HEIGHT), edge(X1, front, HEIGHT), edge(X1, front, HEIGHT - 7), edge(X0, front, HEIGHT - 7)];
    svg('path', { d: polygon(lip), fill: 'url(#agc-l-table-edge)' }, g);
    svg('path', { class: 'agc-table-edge-light', d: `M${pt(top[3])}L${pt(top[2])}` }, g);
    const pools = [340, 620].map((x) => svg('ellipse', { cx: x, cy: 380, rx: 96, ry: 11, fill: 'url(#agc-l-lamp-pool)' }, g));
    stack(g, 268, 381, [[38, 6, 'forest'], [34, 5, 'oxblood'], [30, 6, 'navy']]);
    stack(g, 664, 381, [[34, 5, 'plum'], [30, 6, 'ochre']]);
    svg('path', { class: 'agc-book--oxblood', d: 'M444 382.5L516 382.5L512 378.6L448 378.6Z' }, g);
    svg('path', { class: 'agc-page', d: 'M450 379.2Q466 374.2 480 377.6L480 381Q466 378.6 449 382Z' }, g);
    svg('path', { class: 'agc-page', d: 'M510 379.2Q494 374.2 480 377.6L480 381Q494 378.6 511 382Z' }, g);
    svg('path', { class: 'agc-page-line', d: 'M455 378.6Q466 375.6 476 377.6M455 380.2Q466 377.2 476 379.2M484 377.6Q494 375.6 505 378.6M484 379.2Q494 377.2 505 380.2' }, g);
    svg('path', { class: 'agc-ink', d: 'M532 381h10v-6q0 -3 -2 -3h-6q-2 0 -2 3Z' }, g);
    svg('path', { class: 'agc-quill', d: 'M538 373 C541 362 549 353 558 349 C553 356 547 364 539 373Z' }, g);
    for (const x of [340, 620]) bankerLamp(g, x, 381);
    return { pools };
  }

  /** Books lying in a stack on the table: [width, height, tone], bottom first. */
  function stack(parent, x, base, books) {
    let y = base;
    books.forEach(([w, h, tone], i) => {
      const left = x + i * 2;
      svg('rect', { class: `agc-book--${tone}`, x: left, y: y - h, width: w, height: h, rx: 0.8 }, parent);
      svg('path', { class: 'agc-page-edge', d: `M${left + w - 1.5} ${y - h + 1.2}V${y - 1.2}` }, parent);
      svg('path', { class: 'agc-book-gilt', d: `M${left + 4} ${y - h + 1}V${y - 1}M${left + w - 5} ${y - h + 1}V${y - 1}` }, parent);
      y -= h;
    });
    svg('path', { class: 'agc-book-top', d: `M${x + 2 * (books.length - 1)} ${y}h${books[books.length - 1][0]}l-2 -2h${-books[books.length - 1][0] + 4}Z` }, parent);
  }

  /** A banker's lamp: brass foot and stem, a green glass shade lit warm along its lower edge, a pull chain. */
  function bankerLamp(parent, x, base) {
    const g = svg('g', { class: 'agc-lamp' }, parent);
    svg('ellipse', { class: 'agc-floor-shadow', cx: x + 3, cy: base + 0.5, rx: 18, ry: 2.4 }, g);
    svg('path', { d: `M${x - 15} ${base}Q${x - 14} ${base - 7} ${x} ${base - 8}Q${x + 14} ${base - 7} ${x + 15} ${base}Z`, fill: 'url(#agc-l-brass)' }, g);
    svg('rect', { x: x - 1.6, y: base - 30, width: 3.2, height: 23, fill: 'url(#agc-l-brass)' }, g);
    svg('path', { class: 'agc-lamp-harp', d: `M${x - 17} ${base - 27}Q${x} ${base - 33} ${x + 17} ${base - 27}` }, g);
    svg('path', { d: `M${x - 25} ${base - 25}C${x - 25} ${base - 37} ${x - 18} ${base - 41} ${x} ${base - 41}C${x + 18} ${base - 41} ${x + 25} ${base - 37} ${x + 25} ${base - 25}Z`, fill: 'url(#agc-l-shade)' }, g);
    svg('path', { class: 'agc-shade-light', d: `M${x - 19} ${base - 36}Q${x - 6} ${base - 40} ${x + 6} ${base - 39.5}` }, g);
    svg('rect', { class: 'agc-shade-rim', x: x - 25.5, y: base - 26, width: 51, height: 2.4, rx: 1 }, g);
    svg('path', { class: 'agc-pull-chain', d: `M${x + 12} ${base - 24}V${base - 15}` }, g);
    svg('circle', { class: 'agc-brass-dark', cx: x + 12, cy: base - 14, r: 1.3 }, g);
    return g;
  }

  function libraryDefs(root) {
    const defs = svg('defs', {}, root);
    gradient(defs, 'agc-l-niche', [[0, '#120805'], [1, '#1d0d07']]);
    gradient(defs, 'agc-l-wood', [[0, '#1f0d07'], [0.3, '#6b311d'], [0.55, '#4c2215'], [1, '#1c0b06']], { x2: 1, y2: 0 });
    gradient(defs, 'agc-l-near-wood', [[0, '#0c0503'], [0.55, '#2a120a'], [0.85, '#4a2416'], [1, '#1a0a05']], { x2: 1, y2: 0 });
    gradient(defs, 'agc-l-iron', [[0, '#14100e'], [0.45, '#4a3a2c'], [1, '#100c0a']], { x2: 1, y2: 0 });
    gradient(defs, 'agc-l-shelf-shadow', [[0, '#050201', 0.8], [1, '#050201', 0]]);
    gradient(defs, 'agc-l-crown', [[0, '#1a0b06'], [0.45, '#55281a'], [0.8, '#8b4729'], [1, '#43200f']]);
    gradient(defs, 'agc-l-fascia', [[0, '#7b3b23'], [0.45, '#55271a'], [1, '#2a120a']]);
    gradient(defs, 'agc-l-rail', [[0, '#b0653f'], [0.35, '#6e321d'], [1, '#2a110a']]);
    gradient(defs, 'agc-l-rim', [[0, '#ffcf8a', 0.85], [0.35, '#ffb871', 0.35], [0.75, '#ffd9a8', 0.18], [1, '#ffe8c4', 0.55]], { x2: 1, y2: 0 });
    gradient(defs, 'agc-l-under', [[0, '#050201', 0.82], [0.45, '#050201', 0.4], [1, '#050201', 0]]);
    gradient(defs, 'agc-l-knob', [[0, '#c27a4c'], [0.5, '#6a2f1b'], [1, '#2a110a']], { radial: true, attrs: { cx: 0.38, cy: 0.32, r: 0.7 } });
    gradient(defs, 'agc-l-sky', [[0, '#fff3d8'], [0.45, '#fbe2b4'], [0.8, '#e9c48e'], [1, '#c9a06e']], { radial: true, attrs: { cx: 0.42, cy: 0.38, r: 0.62 } });
    gradient(defs, 'agc-l-window-spill', [[0, '#ffe6bf', 0.22], [0.5, '#ffd9a8', 0.07], [1, '#ffd9a8', 0]], { radial: true });
    gradient(defs, 'agc-l-ceiling-light', [[0, '#ffc98a', 0.2], [0.35, '#ffc98a', 0.05], [0.7, '#050201', 0.15], [1, '#050201', 0.55]], { x2: 1, y2: 0 });
    gradient(defs, 'agc-l-ceiling-haze', [[0, '#3a4766', 0], [1, '#3a4766', 0.25]]);
    gradient(defs, 'agc-l-haze', [[0, '#34405c', 0.24], [0.55, '#34405c', 0.3], [1, '#2a2f46', 0.26]]);
    gradient(defs, 'agc-l-calm', [[0, '#0a0503', 0.42], [0.6, '#0a0503', 0.24], [1, '#0a0503', 0]], { radial: true });
    gradient(defs, 'agc-l-lamp-wall', [[0, '#ffc46b', 0.36], [0.4, '#ff9d45', 0.12], [1, '#ff9d45', 0]], { radial: true });
    gradient(defs, 'agc-l-lamp-pool', [[0, '#ffe3a6', 0.75], [0.45, '#ffc46b', 0.28], [1, '#ffc46b', 0]], { radial: true });
    gradient(defs, 'agc-l-sun-pool', [[0, '#ffd9a0', 0.34], [0.5, '#ffc683', 0.13], [1, '#ffc683', 0]], { radial: true });
    gradient(defs, 'agc-l-floor-bounce', [[0, '#ffbf78', 0.16], [1, '#ffbf78', 0]], { radial: true });
    gradient(defs, 'agc-l-brass', [[0, '#5d4212'], [0.35, '#e7c86f'], [0.6, '#b38b2e'], [1, '#4e370f']], { x2: 1, y2: 0 });
    gradient(defs, 'agc-l-brass-v', [[0, '#f1d488'], [0.5, '#b38b2e'], [1, '#5d4212']]);
    gradient(defs, 'agc-l-shade', [[0, '#69c993'], [0.3, '#2c8a57'], [0.8, '#145234'], [1, '#0e3c26']]);
    gradient(defs, 'agc-l-tabletop', [[0, '#5a3119'], [1, '#8a5530']]);
    gradient(defs, 'agc-l-table-edge', [[0, '#a8683c'], [0.35, '#6e3c1f'], [1, '#3a1d0e']]);
    gradient(defs, 'agc-l-table-shadow', [[0, '#050201', 0.7], [1, '#050201', 0.15]]);
    gradient(defs, 'agc-l-floor', [[0, '#050201', 0.6], [0.12, '#050201', 0.15], [0.55, '#050201', 0.12], [1, '#050201', 0.55]]);
    gradient(defs, 'agc-l-vignette', [[0, '#050201', 0], [0.58, '#050201', 0], [1, '#050201', 0.7]], { radial: true, attrs: { cx: 0.46, cy: 0.5, r: 0.74 } });
    gradient(defs, 'agc-l-corner', [[0, '#050201', 0.75], [1, '#050201', 0]], { radial: true });
    const lead = svg('pattern', { id: 'agc-l-lead', width: 9, height: 13, patternUnits: 'userSpaceOnUse' }, defs);
    svg('path', { class: 'agc-lead', d: 'M0 0L9 13M9 0L0 13' }, lead);
    const dentils = svg('pattern', { id: 'agc-l-dentils', width: 7, height: 5, patternUnits: 'userSpaceOnUse' }, defs);
    svg('rect', { class: 'agc-dentil', x: 0.5, y: 0, width: 4, height: 4.2 }, dentils);
    svg('rect', { class: 'agc-dentil-light', x: 0.5, y: 0, width: 4, height: 0.9 }, dentils);
    const eggs = svg('pattern', { id: 'agc-l-egg-dart', width: 8, height: 4, patternUnits: 'userSpaceOnUse', y: WALL_TOP + 14 }, defs);
    svg('ellipse', { class: 'agc-egg', cx: 3, cy: 2, rx: 2.3, ry: 1.7 }, eggs);
    svg('path', { class: 'agc-dart', d: 'M7 0.4V3.6' }, eggs);
    const motif = svg('pattern', { id: 'agc-l-rug-motif', width: 26, height: 26, patternUnits: 'userSpaceOnUse', patternTransform: 'translate(480 430) scale(1 0.32)' }, defs);
    svg('path', { class: 'agc-rug-motif', d: 'M13 3L20 13L13 23L6 13Z' }, motif);
    svg('path', { class: 'agc-rug-motif-dot', d: 'M0 0h3v3h-3ZM23 23h3v3h-3ZM23 0h3v3h-3ZM0 23h3v3h-3Z' }, motif);
    return defs;
  }

  /**
   * The library on a late afternoon; returns its root and a pose function of
   * song time. Back to front: the coffered ceiling, the far wall (cornice,
   * pilasters, shelves, all slightly hazed and cool), the window, the
   * gallery on its brackets and the shadow under it, the floor, the ladder
   * and the spiral stair, the sunbeams, the table, dust, and the near
   * pilaster with the room's shadowed corners.
   */
  function libraryRoom(layer, { switchTime }) {
    const root = svg('svg', { class: 'agc-art agc-library', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true', focusable: 'false' }, layer);
    const defs = libraryDefs(root);
    svg('rect', { class: 'agc-library-wall', x: 0, y: 0, width: W, height: BASE }, root);
    cofferedCeiling(root);
    // The upper wall: shelves between the pilasters, the right-hand bay left for the window.
    const upper = [];
    for (let i = 0; i < PILASTERS.length - 1; i++) {
      if (PILASTERS[i] === 774) continue;
      upper.push([PILASTERS[i] + 8, PILASTERS[i + 1] - 8]);
    }
    upper.push([PILASTERS[PILASTERS.length - 1] + 8, W]);
    bookcases(root, { spans: upper, rows: [[86, 126], [131, 168], [173, 196]], top: WALL_TOP + 22, bottom: 196, upright: 7, seed: 11, bayWidth: 66 });
    const lowerBays = bookcases(root, { spans: [[0, W]], rows: [[219, 261], [266, 308], [313, 352]], top: 214, bottom: 357, upright: 10, seed: 503 });
    cupboards(root, lowerBays, 357, 412);
    for (const x of PILASTERS) pilaster(root, x, WALL_TOP + 22, 196, 16);
    cornice(root);
    // The far wall recedes into a cool haze; everything nearer is drawn over it.
    svg('rect', { x: 0, y: WALL_TOP, width: W, height: BASE - WALL_TOP, fill: 'url(#agc-l-haze)' }, root);
    roseWindow(root, defs);
    // Lamplight on the shelves behind the table.
    const warm = svg('g', { class: 'agc-warm' }, root);
    for (const x of [340, 620]) svg('ellipse', { cx: x, cy: 340, rx: 170, ry: 90, fill: 'url(#agc-l-lamp-wall)' }, warm);
    gallery(root);
    // The middle of the room, behind the lesson, stays quiet and darker.
    svg('ellipse', { cx: 380, cy: 262, rx: 420, ry: 230, fill: 'url(#agc-l-calm)' }, root);
    parquet(root);
    rug(root);
    svg('rect', { x: 0, y: BASE, width: W, height: H - BASE, fill: 'url(#agc-l-floor)' }, root);
    svg('rect', { class: 'agc-skirting-shadow', x: 0, y: BASE, width: W, height: 3 }, root);
    svg('ellipse', { cx: 470, cy: 470, rx: 420, ry: 70, fill: 'url(#agc-l-floor-bounce)' }, root);
    libraryLadder(root, 728);
    spiralStair(root);
    const light = sunbeams(root, defs);
    const table = readingTable(root);
    const floatDust = dust(root, light);
    nearPilaster(root);
    // Deep shadow gathering in the corners.
    for (const [cx, cy, rx, ry] of [[W, 0, 260, 150], [0, H, 240, 120], [W, H, 260, 130], [0, 0, 160, 90]]) {
      svg('ellipse', { cx, cy, rx, ry, fill: 'url(#agc-l-corner)' }, root);
    }
    svg('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#agc-l-vignette)' }, root);

    const set = writer();
    const skyStops = defs.querySelector('#agc-l-sky').children;
    const pose = (t) => {
      // The afternoon wears on over the training phase: the sun sinks a little and warms.
      const late = clamp(t / switchTime, 0, 1);
      light.pose(late, set);
      set(skyStops[2], 'stop-color', mixHex('#e9c48e', '#efb478', late));
      set(skyStops[3], 'stop-color', mixHex('#c9a06e', '#c98c5c', late));
      set(warm, 'opacity', (0.97 + 0.03 * wave(t, 3.7)).toFixed(3));
      table.pools.forEach((pool, i) => set(pool, 'opacity', (0.96 + 0.04 * wave(t, 4.1 + i * 0.9, i * 0.4)).toFixed(3)));
      set(light.g, 'opacity', (0.92 + 0.08 * wave(t, 19, 0.2)).toFixed(3));
      floatDust(t, late, set);
    };
    return { root, pose };
  }

  // ------------------------------------------------------------------
  // The office: the sun, the sky, and the city
  // ------------------------------------------------------------------

  const RADIANS = Math.PI / 180;
  const span = (x, [a, b]) => clamp((x - a) / (b - a), 0, 1);
  const linear = (k) => k;
  /** The window faces west at 34° north in late spring, so the sun sets a little north of west, sliding down and to the right. */
  const LATITUDE = 34 * RADIANS;
  const DECLINATION = 8 * RADIANS;
  /** The view's focal length in stage pixels (the glass spans about 30° of sky). */
  const FOCAL = 1400;
  const SOLAR_RADIUS = 0.266;
  const EARTH_RADIUS_KM = 6371;
  /** The disc is drawn about 2.8 times life size so it reads behind the lesson; the sunset's timing uses this size. */
  const SUN_RADIUS = 18;
  /** Where the sun sets: into a notch in the far skyline (x 862–934, top y 228), in the pane right of the last mullion. */
  const SUNSET = { x: 888, skyline: 228 };

  /**
   * NOAA's standard-atmosphere refraction, all four ranges (the frontier
   * theme uses the low ones): it lifts the lower limb more than the upper
   * one, so the disc flattens near the horizon.
   * https://gml.noaa.gov/grad/solcalc/calcdetails.html
   */
  function apparentElevation(elevation) {
    const tan = Math.tan(elevation * RADIANS);
    let arcseconds = 0;
    if (elevation > 85) arcseconds = 0;
    else if (elevation > 5) arcseconds = 58.1 / tan - 0.07 / tan ** 3 + 0.000086 / tan ** 5;
    else if (elevation > -0.575) arcseconds = 1735 + elevation * (-518.2 + elevation * (103.4 + elevation * (-12.79 + elevation * 0.711)));
    else arcseconds = -20.774 / tan;
    return elevation + arcseconds / 3600;
  }

  /**
   * The sun at hour angle `hour` (degrees) through the west-facing window:
   * its true elevation, azimuth north of west, and the refracted, enlarged
   * disc projected with the room's eye level. `west` is the stage x of due
   * west. https://gml.noaa.gov/grad/solcalc/solareqns.PDF
   */
  function solarPosition(hour, west) {
    const h = hour * RADIANS;
    const towardsWest = Math.cos(DECLINATION) * Math.sin(h);
    const north = Math.cos(LATITUDE) * Math.sin(DECLINATION) - Math.sin(LATITUDE) * Math.cos(DECLINATION) * Math.cos(h);
    const up = Math.sin(LATITUDE) * Math.sin(DECLINATION) + Math.cos(LATITUDE) * Math.cos(DECLINATION) * Math.cos(h);
    const elevation = Math.asin(up) / RADIANS;
    const horizontal = Math.hypot(towardsWest, north);
    const projectY = (angle) => HORIZON - FOCAL * Math.tan(apparentElevation(angle) * RADIANS) * horizontal / towardsWest;
    const top = projectY(elevation + SOLAR_RADIUS);
    const bottom = projectY(elevation - SOLAR_RADIUS);
    const lifeSize = FOCAL * Math.tan(SOLAR_RADIUS * RADIANS) / towardsWest;
    return {
      x: west + FOCAL * north / towardsWest,
      y: (top + bottom) / 2,
      rx: SUN_RADIUS,
      ry: ((bottom - top) / 2) * (SUN_RADIUS / lifeSize),
      elevation,
      azimuth: Math.atan2(north, towardsWest),
      west,
    };
  }

  /** The hour angle where f, increasing as the sun sinks, crosses zero. */
  function solveHour(f) {
    let lo = 20;
    let hi = 110;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /**
   * A solar clock set by the storyboard: the hour angle runs at one steady
   * rate, chosen so the lower limb touches the skyline 2 s into the quiz and
   * the upper limb is gone 10 s later; once the sun is behind the city the
   * clock runs on to −5° (blue hour) at the outro. Late morning is simply
   * where that rate puts the sun at verse 3.
   */
  function solarClock(song) {
    const quiz = song.sectionStart('quiz');
    const outro = song.sectionStart('outro');
    const touchAt = quiz + 2;
    const goneAt = quiz + 12;
    const at = (hour) => solarPosition(hour, 0);
    const touch = solveHour((hour) => { const p = at(hour); return p.y + p.ry - SUNSET.skyline; });
    const gone = solveHour((hour) => { const p = at(hour); return p.y - p.ry - SUNSET.skyline; });
    const blue = solveHour((hour) => -5 - at(hour).elevation);
    const rate = (gone - touch) / (goneAt - touchAt);
    const after = Math.max(rate, (blue - gone) / Math.max(1, outro - goneAt));
    const west = SUNSET.x - at(touch).x;
    const hour = (t) => Math.max(25, t <= goneAt ? touch + rate * (t - touchAt) : gone + after * (t - goneAt));
    return {
      touchAt,
      at(t) {
        const sun = solarPosition(hour(t), west);
        // How much of the disc is still above the skyline it sets behind.
        sun.visible = clamp((SUNSET.skyline - (sun.y - sun.ry)) / (2 * sun.ry), 0, 1);
        sun.reddening = span(5.5 - sun.elevation, [0, 6]);
        return sun;
      },
    };
  }

  /**
   * The sky by solar elevation, zenith to the skyline: clear blue by day;
   * gold low down in golden hour; at sunset an orange-red band through coral
   * and magenta into deep blue; afterwards an afterglow that narrows and
   * cools to violet, then blue hour. Keyed by −elevation.
   */
  const SKY_STOPS = [0, 0.3, 0.55, 0.76, 0.9, 1];
  const SKY = [
    [-40, ['#2a69c0', '#3f80d0', '#5e98da', '#86b3e5', '#acc9ec', '#c6daf0']],
    [-20, ['#2c66ba', '#4282cc', '#679dd8', '#93b8e2', '#c4d6e8', '#e4e7e3']],
    [-10, ['#2b5db0', '#4377c6', '#6d98d6', '#b2c7e0', '#f4e0b8', '#ffd994']],
    [-5, ['#244b9a', '#3a5fae', '#6f80c0', '#d69ba9', '#ffb877', '#ffc45e']],
    [-2, ['#1f3d88', '#3a4c9e', '#7361a6', '#df7597', '#ff8d55', '#ffa63e']],
    [0, ['#1a3078', '#34408f', '#6c4c99', '#d35a85', '#ff6d3a', '#ff8c2c']],
    [2, ['#16276a', '#2d3584', '#5b448c', '#a9507e', '#e45f46', '#f97b36']],
    [4, ['#11205b', '#252e77', '#463d80', '#7a4a7e', '#b55a64', '#d97252']],
    [6, ['#0d1a4b', '#1c2766', '#2e3477', '#463f7f', '#5f4b80', '#7a587b']],
    [8, ['#0a143c', '#151f56', '#202a66', '#2b336d', '#373b70', '#443f6e']],
  ];
  /** The glow along the skyline under the sun: [colour, opacity] by −elevation. */
  const HORIZON_GLOW = [
    [-40, ['#fff6e0', 0]], [-14, ['#ffefc8', 0.08]], [-6, ['#ffcf80', 0.42]], [-2, ['#ff9c48', 0.8]],
    [0, ['#ff7a34', 0.92]], [2, ['#f0603c', 0.75]], [4, ['#c04e5c', 0.45]], [6.5, ['#6c4478', 0.14]], [9, ['#3a3466', 0]],
  ];
  /** Cloud bodies in ambient skylight, by −elevation. */
  const CLOUD_AMBIENT = [
    [-45, '#eef3fa'], [-25, '#e8eef6'], [-10, '#d1d2df'], [-4, '#a596b4'], [-1, '#7d6e98'], [2, '#5a5487'], [5, '#373b63'], [8, '#262b4a'],
  ];
  /** Direct sunlight on cloud edges, by the sun's elevation where the cloud is (its clearance). */
  const CLOUD_LIT = [[-1, '#ff6a5c'], [0.6, '#ff7048'], [1.6, '#ff8f4c'], [3, '#ffb05c'], [6, '#ffd68c'], [12, '#fff0d4'], [30, '#ffffff']];
  const CLOUD_AFTERGLOW = '#de789c';
  /** The city's mid and near layers, darkening into silhouettes, by −elevation. */
  const CITY_MID = [[-45, '#7690b2'], [-12, '#6e83a6'], [-6, '#5d6a8d'], [-3, '#454569'], [-1, '#363252'], [2, '#2a2944'], [5, '#212238'], [8, '#191c30']];
  const CITY_NEAR = [[-45, '#4f6787'], [-12, '#495a7b'], [-6, '#3c4563'], [-3, '#2e2f4a'], [-1, '#24233a'], [2, '#1c1c30'], [5, '#171a2c'], [8, '#121627']];
  const FAR_HAZE = [[-45, '#5d7499'], [-4, '#5c5b88'], [0, '#4b3d69'], [4, '#302d56'], [8, '#1c2040']];

  /**
   * A cloud bank's outline: a bumpy top and a flatter base meeting in
   * tapered tips, smoothed through the midpoints of its points (as in the
   * brick-site theme).
   */
  function bankOutline(w, h, seed) {
    const n = Math.max(6, Math.round(w / 24));
    const upper = [];
    const lower = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const taper = Math.sin(Math.PI * f) ** 0.8;
      upper.push([f * w, -h * taper * (0.5 + 0.5 * hash01(seed * 31 + i))]);
      lower.push([f * w + 3 * (hash01(seed * 7 + i) - 0.5), h * 0.32 * taper * (0.55 + 0.45 * hash01(seed * 17 + i))]);
    }
    const points = [...upper, ...lower.slice(1, -1).reverse()];
    const mid = (a, b) => `${f1((a[0] + b[0]) / 2)} ${f1((a[1] + b[1]) / 2)}`;
    let d = `M${mid(points[points.length - 1], points[0])}`;
    points.forEach((p, i) => { d += `Q${f1(p[0])} ${f1(p[1])} ${mid(p, points[(i + 1) % points.length])}`; });
    return `${d}Z`;
  }

  /**
   * A cloud bank in the window: its body in ambient skylight, and the same
   * shape again in direct sunlight, graded towards the sun so its sun-facing
   * edge is brightest (the top at midday, the underside at sunset).
   */
  function cloudBank(parent, defs, c, index) {
    const node = svg('g', { class: 'agc-cloud' }, parent);
    const d = bankOutline(c.w, c.h, index + 3);
    const body = svg('path', { d }, node);
    const lightId = `agc-o-cloud-light-${index}`;
    const light = svg('linearGradient', { id: lightId, gradientUnits: 'userSpaceOnUse' }, defs);
    const stops = [[0, 0], [0.42, 0.12], [0.74, 0.68], [1, 1]].map(([offset, opacity]) => svg('stop', { offset, 'stop-opacity': opacity }, light));
    const lit = svg('path', { d, fill: `url(#${lightId})` }, node);
    return { ...c, node, body, light, stops, lit };
  }

  /**
   * Sunlight on a cloud (after the frontier theme): high clouds see the sun
   * over the curve of the Earth after it has set for the room, so the low
   * banks go grey first while the highest keep their pink longest; a soft
   * scattered afterglow follows, then slate.
   */
  function lightCloud(c, sun, x, set) {
    const cx = x + c.w / 2;
    const above = Math.max(6, HORIZON - c.y);
    const azimuth = Math.atan2(cx - sun.west, FOCAL);
    const rangeKm = c.heightKm * Math.hypot(FOCAL, cx - sun.west) / above;
    const dip = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + c.heightKm)) / RADIANS;
    const local = sun.elevation + (rangeKm / EARTH_RADIUS_KM / RADIANS) * Math.cos(azimuth - sun.azimuth);
    const clearance = local + dip;
    const direct = span(clearance, [-SOLAR_RADIUS, SOLAR_RADIUS]);
    const scattered = 0.6 * (1 - span(-clearance, [0, 4])) * (1 - span(-local, [5, 8]));
    const color = mixHex(CLOUD_AFTERGLOW, track(CLOUD_LIT, clearance, linear), direct);
    set(c.body, 'fill', track(CLOUD_AMBIENT, -sun.elevation, linear));
    set(c.lit, 'opacity', (0.95 * Math.max(direct, scattered)).toFixed(3));
    for (const stop of c.stops) set(stop, 'stop-color', color);
    // Aim the light along the sun's rays, from the bank's middle, in the
    // bank's own coordinates: the sun is far away, so a bank below it is lit
    // on top and a bank above it from underneath, leaning a little towards it.
    const mx = c.w / 2;
    const my = -c.h * 0.25;
    const dx = 0.3 * (sun.x - (x + mx));
    const dy = sun.y - (c.y + my);
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const reach = (c.w / 2) * Math.abs(ux) + c.h * Math.abs(uy) + 2;
    set(c.light, 'x1', f1(mx - ux * reach));
    set(c.light, 'y1', f1(my - uy * reach));
    set(c.light, 'x2', f1(mx + ux * reach));
    set(c.light, 'y2', f1(my + uy * reach));
  }

  /**
   * Blocks of a city layer: [x, top, width, setback?] on the wall, standing
   * on the window's base; a setback is a narrower top storey that many
   * pixels high.
   */
  const blocks = (list) => list.map(([x, top, w, setback = 0]) => {
    if (!setback) return `M${x} ${BASE}V${top}h${w}V${BASE}Z`;
    const inset = Math.round(w * 0.22);
    return `M${x} ${BASE}V${top + setback}h${inset}V${top}h${w - 2 * inset}V${top + setback}h${inset}V${BASE}Z`;
  }).join('');

  /**
   * The sides of a layer's blocks that we can see, receding towards the
   * vanishing point by `k`: right-hand sides left of it (they face the
   * sun's side, so they catch its light), left-hand sides right of it.
   */
  function blockSides(list, k) {
    const lit = [];
    const shade = [];
    for (const [x, top, w] of list) {
      const facesRight = x + w / 2 < VP_X;
      const edge = facesRight ? x + w : x;
      const back = [VP_X + (edge - VP_X) * (1 - k), HORIZON + (top - HORIZON) * (1 - k)];
      (facesRight ? lit : shade).push(`M${edge} ${BASE}V${top}L${pt(back)}V${BASE}Z`);
    }
    return { lit: lit.join(''), shade: shade.join('') };
  }

  /** Thin rims of sunlight along the blocks' tops, the edges that catch the low sun over the skyline. */
  const rimsFor = (list, width) => list.map(([x, top, w, setback = 0]) => {
    const inset = setback ? Math.round(w * 0.22) : 0;
    return `M${x + inset} ${top}h${w - 2 * inset}v${width}h${-(w - 2 * inset)}Z`;
  }).join('');

  /**
   * The view through the window wall: the sky, the horizon's glow, the sun
   * (behind the skyline, the clouds, the mullions, and the room), cloud
   * banks at their own heights, and the city in three depths, whose office
   * windows reflect the day and light up after sunset in three waves.
   */
  function officeView(root, defs) {
    const clip = svg('clipPath', { id: 'agc-o-glass' }, defs);
    svg('rect', { x: 219, y: 12, width: W - 219, height: BASE - 12 }, clip);
    const view = svg('g', { 'clip-path': 'url(#agc-o-glass)' }, root);
    const sky = gradient(defs, 'agc-o-sky', SKY_STOPS.map((offset, i) => [offset, SKY[0][1][i]]), { attrs: { gradientUnits: 'userSpaceOnUse', x1: 0, y1: 12, x2: 0, y2: SUNSET.skyline + 8 } });
    svg('rect', { x: 219, y: 12, width: W - 219, height: BASE - 12, fill: 'url(#agc-o-sky)' }, view);
    const glowGradient = gradient(defs, 'agc-o-horizon-glow', [[0, '#ff7a34', 0.85], [0.45, '#ff7a34', 0.32], [1, '#ff7a34', 0]], { radial: true });
    const horizonGlow = svg('ellipse', { cy: SUNSET.skyline - 6, rx: 430, ry: 132, fill: 'url(#agc-o-horizon-glow)' }, view);
    const halo = gradient(defs, 'agc-o-sun-glow', [[0, '#fff6dc', 0.95], [0.07, '#fff6dc', 0.8], [0.14, '#ffe7a8', 0.5], [0.28, '#ffc070', 0.26], [0.55, '#ffc070', 0.09], [1, '#ffc070', 0]], { radial: true });
    const disc = gradient(defs, 'agc-o-sun-disc', [[0, '#fffef6'], [0.6, '#fff3cc'], [0.88, '#ffe9a8'], [1, '#ffd98a']], { radial: true });
    const sunGroup = svg('g', { class: 'agc-sun' }, view);
    const sunGlow = svg('circle', { r: 230, fill: 'url(#agc-o-sun-glow)' }, sunGroup);
    const sunDisc = svg('ellipse', { rx: SUN_RADIUS, ry: SUN_RADIUS, fill: 'url(#agc-o-sun-disc)' }, sunGroup);
    // Cloud banks at their own heights: two high cirrus streaks (the right
    // one drifts in just above the sun's path), a mid-level bank, and low
    // banks; none crosses the disc on its way down.
    const clouds = [
      { x0: 140, y: 30, w: 300, h: 7, speed: 0.6, heightKm: 9 },
      { x0: 610, y: 44, w: 230, h: 6, speed: 0.8, heightKm: 8 },
      { x0: 210, y: 96, w: 230, h: 18, speed: 0.9, heightKm: 4.5 },
      { x0: 150, y: 146, w: 190, h: 15, speed: 1.2, heightKm: 2.4 },
      { x0: 330, y: 182, w: 140, h: 9, speed: 1.0, heightKm: 1.5 },
    ].map((c, i) => cloudBank(view, defs, c, i));
    // Far: hazy towers, a notch where the sun sets (x 862–934), one spire.
    const farList = [[219, 200, 30], [246, 170, 24, 14], [268, 214, 38], [304, 150, 22, 18], [324, 190, 28], [350, 224, 40], [392, 178, 26], [416, 204, 34],
      [450, 138, 26, 22], [474, 196, 36], [508, 214, 28], [534, 168, 26, 12], [558, 206, 40], [596, 184, 28], [622, 220, 34], [654, 160, 26, 16],
      [678, 198, 38], [714, 176, 30], [744, 210, 34], [776, 168, 26, 16], [800, 196, 34], [832, 182, 30], [862, SUNSET.skyline, 72], [934, 172, 30, 14]];
    const farLayer = svg('path', { d: blocks(farList) }, view);
    const spires = svg('path', { class: 'agc-o-antenna', d: 'M463 138V100M459 112h8M315 150V128M666 160V142M949 172V150' }, view);
    // Mid: mid-rises with ribbon windows.
    const midList = [[219, 262, 42], [258, 238, 36, 10], [292, 268, 46], [336, 248, 38], [372, 276, 42], [412, 254, 32], [442, 236, 40, 12], [480, 264, 44],
      [522, 246, 36], [556, 232, 42, 10], [596, 262, 40], [634, 242, 34], [666, 270, 44], [708, 250, 38, 12], [744, 236, 32], [774, 258, 42], [814, 244, 36], [850, 252, 44], [892, 240, 68, 12]];
    const mid = blocks(midList);
    const midSides = blockSides(midList, 0.02);
    const midSideLit = svg('path', { d: midSides.lit }, view);
    const midSideShade = svg('path', { d: midSides.shade }, view);
    const midLayer = svg('path', { d: mid }, view);
    const midPanes = svg('path', { d: mid, fill: 'url(#agc-o-ribbons)' }, view);
    const waterTower = svg('path', { class: 'agc-o-water-tower', d: 'M456 236l2 -8M468 236l-2 -8M454 228h16v-8a8 4 0 0 0 -16 0Z' }, view);
    const midRims = svg('path', { d: rimsFor(midList, 1.2) }, view);
    // Near: blocks with glass curtain walls.
    const nearList = [[219, 318, 58], [274, 302, 44], [316, 326, 54], [368, 298, 40], [406, 314, 50], [454, 292, 44], [496, 322, 58],
      [552, 306, 48], [598, 292, 38], [634, 316, 54], [686, 298, 44], [728, 284, 40], [766, 310, 52], [816, 296, 44], [858, 314, 48], [904, 300, 56]];
    const near = blocks(nearList);
    const nearSides = blockSides(nearList, 0.035);
    const nearSideLit = svg('path', { d: nearSides.lit }, view);
    const nearSideShade = svg('path', { d: nearSides.shade }, view);
    const nearLayer = svg('path', { d: near }, view);
    const nearPanes = svg('path', { d: near, fill: 'url(#agc-o-curtain)' }, view);
    const nearRims = svg('path', { d: rimsFor(nearList, 1.5) }, view);
    const roofKit = svg('path', { d: 'M740 284v-6h10v6ZM466 292v-5h14v5ZM872 314v-7h8v7ZM286 302v-4h12v4Z' }, view);
    // Office windows that light up after sunset, in three waves.
    const lit = [[], [], []];
    [...midList.map((b) => [b[0], b[1], b[2], 0]), ...nearList.map((b) => [b[0], b[1], b[2], 1])].forEach(([bx, top, bw, depth], i) => {
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col * 7 + 8 < bw; col++) {
          const r = hash01(i * 211 + row * 17 + col * 5 + depth * 1000);
          if (r > 0.17) continue;
          const x = bx + 2 + col * 7;
          const y = top + 4 + row * 9;
          lit[Math.floor(hash01(i * 7 + row + col * 3) * 3)].push(`M${x} ${y}h2.6v4h-2.6Z`);
        }
      }
    });
    const lights = lit.map((d) => svg('path', { class: 'agc-o-city-light', d: d.join('') }, view));
    const sheen = svg('path', { class: 'agc-o-glass-sheen', d: 'M600 12h70L470 420h-70ZM700 12h22L522 420h-22ZM300 12h40L219 260V180Z' }, view);
    return {
      update(light, t, set) {
        const e = light.elevation;
        const skyColors = track(SKY, -e, linear);
        skyColors.forEach((color, i) => set(sky.children[i], 'stop-color', color));
        const [glowColor, glowOpacity] = track(HORIZON_GLOW, -e, linear);
        for (const stop of glowGradient.children) set(stop, 'stop-color', glowColor);
        set(horizonGlow, 'cx', f1(light.x));
        set(horizonGlow, 'opacity', glowOpacity.toFixed(3));
        // The sun: a white-gold core, its limb reddening near the horizon; its halo warms and grows stronger as it sinks.
        set(sunGroup, 'transform', `translate(${f1(light.x)} ${f1(light.y)})`);
        set(sunDisc, 'ry', f1(light.ry));
        const r = light.reddening;
        [['#fffef8', '#fff4cf'], ['#fff9e6', '#ffc25a'], ['#fff2cc', '#ff7a30'], ['#ffe9b4', '#f0441c']]
          .forEach(([day, low], i) => set(disc.children[i], 'stop-color', mixHex(day, low, r)));
        [['#fff6dc', '#fff0c8'], ['#fff6dc', '#ffe0a0'], ['#ffe7a8', '#ffb060'], ['#ffc070', '#ff7a36'], ['#ffc070', '#ff6a30'], ['#ffc070', '#ff6a30']]
          .forEach(([day, low], i) => set(halo.children[i], 'stop-color', mixHex(day, low, r)));
        set(sunGlow, 'opacity', (0.5 + 0.5 * span(14 - e, [0, 10])).toFixed(3));
        for (const c of clouds) {
          const x = c.x0 + c.speed * t;
          set(c.node, 'transform', `translate(${f1(x)} ${c.y})`);
          lightCloud(c, light, x, set);
        }
        // The city: far towers fade into the haze; mid and near blocks darken into silhouettes, rimmed with warm light while the sun is low and visible.
        const far = mixHex(skyColors[3], track(FAR_HAZE, -e, linear), 0.4);
        set(farLayer, 'fill', far);
        set(spires, 'stroke', far);
        const midColor = track(CITY_MID, -e, linear);
        const nearColor = track(CITY_NEAR, -e, linear);
        const rimColor = mixHex('#ffe3a4', '#ff8a3c', r);
        const rim = span(16 - e, [0, 10]) * light.visible;
        set(midLayer, 'fill', midColor);
        set(waterTower, 'fill', midColor);
        set(waterTower, 'stroke', midColor);
        set(midSideLit, 'fill', mixHex(midColor, rimColor, 0.08 + 0.22 * rim));
        set(midSideShade, 'fill', mixHex(midColor, '#10132a', 0.25));
        set(nearLayer, 'fill', nearColor);
        set(roofKit, 'fill', nearColor);
        set(nearSideLit, 'fill', mixHex(nearColor, rimColor, 0.08 + 0.2 * rim));
        set(nearSideShade, 'fill', mixHex(nearColor, '#0c0f22', 0.3));
        for (const rims of [midRims, nearRims]) {
          set(rims, 'fill', rimColor);
          set(rims, 'opacity', (0.15 + 0.75 * rim).toFixed(3));
        }
        const reflections = span(e, [2, 14]);
        set(midPanes, 'opacity', (0.2 * reflections).toFixed(3));
        set(nearPanes, 'opacity', (0.08 * reflections + 0.02).toFixed(3));
        lights.forEach((node, i) => set(node, 'opacity', span(-e, [-1 + 1.8 * i, 0.6 + 1.8 * i]).toFixed(3)));
        set(sheen, 'opacity', (0.25 + 0.75 * span(e, [-4, 6])).toFixed(3));
        return skyColors;
      },
    };
  }

  /** The window wall's slim graphite frame: mullions (the tall panes on the right have no transom), the base channel. */
  function glazingFrame(root) {
    const g = svg('g', { class: 'agc-o-frame' }, root);
    const bars = [];
    for (const x of [391, 695, 827]) bars.push(`M${x - 2.5} 12h5V${x < 563 ? 196 : BASE}h-5Z`);
    bars.push(`M219 12h4V196h-4ZM560 12h6V${BASE}h-6Z`);
    svg('path', { d: bars.join('') }, g);
    svg('path', { class: 'agc-o-frame-light', d: [391, 695, 827].map((x) => `M${x - 1.6} 12V${x < 563 ? 196 : BASE}`).join('') }, g);
    svg('rect', { class: 'agc-o-sill', x: 219, y: BASE - 5, width: W - 219, height: 5 }, g);
  }

  /** Behind the mezzanine's glass: a low oak sideboard with books and a plant, a lounge chair, and a reading lamp. */
  function mezzanineFurniture(root) {
    const g = svg('g', { class: 'agc-o-upstairs' }, root);
    svg('rect', { class: 'agc-o-oak', x: 236, y: 166, width: 116, height: 30 }, g);
    svg('path', { class: 'agc-o-oak-line', d: 'M236 167H352M275 170V194M314 170V194' }, g);
    svg('path', { class: 'agc-o-books-up', d: 'M246 166v-14h5v14ZM252 166v-17h4v17ZM257 166v-12h6v12ZM264 166l3 -15l4 1l-3 14Z' }, g);
    svg('path', { class: 'agc-o-pot-small', d: 'M322 166h18l-2 -12h-14Z' }, g);
    svg('path', { class: 'agc-o-leaf', d: 'M331 154C322 146 318 136 322 128C328 136 332 144 331 154ZM331 154C336 144 344 138 350 138C346 146 340 152 331 154ZM331 154C330 142 332 132 338 124C340 134 336 146 331 154Z' }, g);
    // A lounge chair, facing the window.
    svg('path', { class: 'agc-o-chair', d: 'M432 196l4 -14h44l6 14h-4l-4 -9h-38l-4 9ZM438 182c-2 -16 2 -30 10 -36h12c-6 6 -8 20 -6 36Z' }, g);
    svg('path', { class: 'agc-o-floor-lamp', d: 'M512 196h12M518 196V128M518 128c6 -8 18 -10 26 -6' }, g);
    svg('path', { class: 'agc-o-floor-lamp-shade', d: 'M536 120h16l4 10h-24Z' }, g);
  }

  /** The oak slat wall on the left, full height. */
  function slatWall(root) {
    svg('rect', { x: 0, y: 12, width: 219, height: BASE - 12, fill: 'url(#agc-o-slats)' }, root);
    svg('rect', { x: 0, y: 12, width: 219, height: BASE - 12, fill: 'url(#agc-o-slat-light)' }, root);
    svg('rect', { class: 'agc-o-shadow-gap', x: 0, y: BASE - 5, width: 219, height: 5 }, root);
  }

  /** Under the mezzanine: a white wall with a faint whiteboard sketch and a low credenza. */
  function underMezzanine(root) {
    const g = svg('g', { class: 'agc-o-under' }, root);
    svg('rect', { class: 'agc-o-white-wall', x: 223, y: 196, width: 337, height: BASE - 196 }, g);
    svg('rect', { x: 223, y: 214, width: 337, height: 60, fill: 'url(#agc-o-soffit-shadow)' }, g);
    for (const x of [260, 360, 460]) svg('path', { d: `M${x - 44} 214A44 72 0 0 0 ${x + 44} 214Z`, fill: 'url(#agc-o-scallop)' }, g);
    svg('rect', { class: 'agc-o-board-frame', x: 250, y: 252, width: 276, height: 100, rx: 2 }, g);
    svg('rect', { class: 'agc-o-board', x: 253, y: 255, width: 270, height: 94, rx: 1 }, g);
    svg('path', { class: 'agc-o-marker agc-o-marker--blue', d: 'M272 272h56v26h-56ZM384 272h56v26h-56ZM328 285h50l-6 -4M378 285l-6 4M412 298v18M406 310l6 6l6 -6M384 316h56v20h-56Z' }, g);
    svg('path', { class: 'agc-o-marker agc-o-marker--red', d: 'M462 270q12 -6 24 0t24 0M462 282q10 -5 20 0t16 0M276 318q8 -4 16 0t16 0t14 0' }, g);
    svg('path', { class: 'agc-o-marker agc-o-marker--green', d: 'M466 300l6 6l12 -14M466 322l6 6l12 -14' }, g);
    svg('rect', { class: 'agc-o-board-tray', x: 290, y: 351, width: 196, height: 3, rx: 1 }, g);
    // The credenza.
    svg('rect', { class: 'agc-o-oak', x: 238, y: 384, width: 300, height: 30, rx: 1.5 }, g);
    svg('path', { class: 'agc-o-oak-line', d: 'M238 385H538M313 388V411M388 388V411M463 388V411' }, g);
    svg('path', { class: 'agc-o-handle', d: 'M300 392V404M326 392V404M450 392V404M476 392V404' }, g);
    svg('rect', { class: 'agc-o-graphite', x: 244, y: 414, width: 4, height: 6 }, g);
    svg('rect', { class: 'agc-o-graphite', x: 528, y: 414, width: 4, height: 6 }, g);
    svg('path', { class: 'agc-o-books-up', d: 'M258 384v-16h6v16ZM265 384v-13h5v13ZM271 384v-18h4v18Z' }, g);
    svg('path', { class: 'agc-o-pot-small', d: 'M500 384h16l-2 -12h-12Z' }, g);
    svg('path', { class: 'agc-o-leaf', d: 'M508 372C502 366 500 358 504 352C508 358 510 364 508 372ZM508 372C512 364 518 360 524 360C520 366 514 370 508 372Z' }, g);
  }

  /**
   * The mezzanine: its white column, the slab's front with an oak edge, its
   * underside with downlights, and the glass railing with a slim handrail.
   */
  function mezzanine(root) {
    const g = svg('g', { class: 'agc-o-mezzanine' }, root);
    const { x, w } = OFFICE.mezzanine;
    const right = x + w;
    // The column under the slab's far end.
    svg('rect', { x: 548, y: 208, width: 11, height: depthToY(66) - 208, fill: 'url(#agc-o-column)' }, g);
    svg('ellipse', { class: 'agc-o-contact', cx: 553.5, cy: f1(depthToY(66)), rx: 12, ry: 2.4 }, g);
    svg('path', { class: 'agc-o-soffit', d: polygon([[x, 208], [right, 208], toWall([right, 208]), toWall([x, 208])]) }, g);
    for (const lx of [260, 360, 460]) svg('ellipse', { class: 'agc-o-downlight', cx: lx, cy: 210.6, rx: 5, ry: 1 }, g);
    svg('rect', { class: 'agc-o-slab', x, y: 190, width: w, height: 18 }, g);
    svg('rect', { class: 'agc-o-slab-oak', x, y: 190, width: w, height: 3 }, g);
    svg('rect', { class: 'agc-o-slab-shade', x, y: 205, width: w, height: 3 }, g);
    // The railing: glass panels on small clamps, a stainless handrail.
    const panels = [];
    const clamps = [];
    const panelW = w / 3;
    for (let i = 0; i < 3; i++) {
      const a = x + i * panelW + 1.2;
      const b = x + (i + 1) * panelW - 1.2;
      panels.push(`M${f1(a)} 140H${f1(b)}V189H${f1(a)}Z`);
      for (const cx of [a + 14, b - 14]) clamps.push(`M${f1(cx - 2.5)} 183h5v6h-5Z`);
    }
    svg('path', { class: 'agc-o-glass', d: panels.join('') }, g);
    svg('path', { class: 'agc-o-glass-glint', d: `M${x + 30} 140l-22 49h10l22 -49ZM${x + 160} 140l-22 49h5l22 -49ZM${x + 290} 140l-22 49h8l22 -49Z` }, g);
    svg('path', { class: 'agc-o-glass-edge', d: panels.join('') }, g);
    svg('path', { class: 'agc-o-clamp', d: clamps.join('') }, g);
    svg('rect', { x, y: 135.5, width: w, height: 4.5, rx: 2, fill: 'url(#agc-o-steel)' }, g);
    // The railing's return along the slab's far end.
    svg('path', { class: 'agc-o-glass', d: polygon([[right, 140], toWall([right, 140], 0.95), toWall([right, 189], 0.95), [right, 189]]) }, g);
  }

  /** The y of a floor point at depth d (wall px) in front of the wall. */
  const depthToY = (d) => onFloor(VP_X, depthScale(d))[1];

  /**
   * Floating oak treads cantilevered from the slat wall, seen from the
   * front (their tops below eye level, their undersides above it, their
   * ends receding towards the vanishing point), behind a glass balustrade.
   */
  function officeStair(root) {
    const g = svg('g', { class: 'agc-o-stair' }, root);
    const { pitch, treads } = stairGeometry();
    const THICK = 7;
    for (const tread of treads) {
      const nl = [tread.left - 1, tread.y];
      const nr = [tread.right + 1, tread.y];
      const bl = [nl[0], tread.y + THICK];
      const br = [nr[0], tread.y + THICK];
      if (tread.y > HORIZON) svg('path', { class: 'agc-o-tread-top', d: polygon([nl, nr, toWall(nr), toWall(nl)]) }, g);
      if (tread.y + THICK < HORIZON) svg('path', { class: 'agc-o-tread-under', d: polygon([bl, br, toWall(br), toWall(bl)]) }, g);
      svg('path', { class: 'agc-o-tread-end', d: polygon([nr, br, toWall(br), toWall(nr)]) }, g);
      svg('path', { class: 'agc-o-tread-front', d: polygon([nl, nr, br, bl]) }, g);
      svg('path', { class: 'agc-o-tread-shadow', d: polygon([toWall(bl), toWall(br), [toWall(br)[0], toWall(br)[1] + 9], [toWall(bl)[0], toWall(bl)[1] + 9]]) }, g);
    }
    const from = -20;
    const top = (x) => pitch(x) - 50;
    const bottom = (x) => pitch(x) + 6;
    const panelEdges = [from, 40, 110, STAIR.x1];
    const panels = [];
    for (let i = 0; i < panelEdges.length - 1; i++) {
      const a = panelEdges[i] + 1;
      const b = panelEdges[i + 1] - 1;
      panels.push(polygon([[a, top(a)], [b, top(b)], [b, bottom(b)], [a, bottom(a)]]));
    }
    svg('path', { class: 'agc-o-glass', d: panels.join('') }, g);
    svg('path', { class: 'agc-o-glass-edge', d: panels.join('') }, g);
    svg('path', { class: 'agc-o-glass-glint', d: polygon([[60, top(60)], [74, top(74)], [44, bottom(44)], [30, bottom(30)]]) + polygon([[140, top(140)], [146, top(146)], [116, bottom(116)], [110, bottom(110)]]) }, g);
    svg('path', { d: polygon([[from, top(from) - 4.5], [STAIR.x1, top(STAIR.x1) - 4.5], [STAIR.x1, top(STAIR.x1)], [from, top(from)]]), fill: 'url(#agc-o-steel)' }, g);
  }

  /** Floor-hung pendant lights: a cord, a matte shade, and the warm inside seen from below. */
  function pendant(parent, x, drop, { globe = false } = {}) {
    const g = svg('g', { class: 'agc-o-pendant' }, parent);
    svg('path', { class: 'agc-o-cord', d: `M${x} 12V${drop}` }, g);
    svg('rect', { class: 'agc-o-canopy', x: x - 6, y: 12, width: 12, height: 3, rx: 1 }, g);
    if (globe) {
      svg('circle', { cx: x, cy: drop + 12, r: 12, fill: 'url(#agc-o-opal)' }, g);
      return { x, y: drop + 12 };
    }
    svg('path', { class: 'agc-o-shade', d: `M${x - 3} ${drop}h6l15 18h-36Z` }, g);
    svg('ellipse', { class: 'agc-o-shade-inside', cx: x, cy: drop + 18, rx: 18, ry: 3 }, g);
    svg('circle', { class: 'agc-o-bulb', cx: x, cy: drop + 17.5, r: 3.4 }, g);
    return { x, y: drop + 19 };
  }

  /** Light oak planks laid parallel to the window, joints staggered, the window mirrored in their finish. */
  function officeFloor(root) {
    const g = svg('g', { class: 'agc-o-floor' }, root);
    svg('rect', { x: 0, y: BASE, width: W, height: H - BASE, fill: 'url(#agc-o-floor)' }, g);
    const rows = [];
    const joints = [];
    const light = [];
    const dark = [];
    const PLANK = 15;
    for (let k = 0; k * PLANK < 260; k++) {
      const s0 = depthScale(k * PLANK);
      const s1 = depthScale((k + 1) * PLANK);
      rows.push(`M0 ${f1(onFloor(0, s0)[1])}H${W}`);
      const LENGTH = 150;
      const offset = hash01(k * 13 + 5) * LENGTH;
      for (let x = -LENGTH + offset; x < W + LENGTH; x += LENGTH) {
        joints.push(`M${pt(onFloor(x, s0))}L${pt(onFloor(x, s1))}`);
        const r = hash01(k * 31 + Math.round(x));
        const quad = polygon([onFloor(x, s0), onFloor(x + LENGTH, s0), onFloor(x + LENGTH, s1), onFloor(x, s1)]);
        if (r > 0.82) light.push(quad);
        else if (r < 0.16) dark.push(quad);
      }
    }
    svg('path', { class: 'agc-o-plank-light', d: light.join('') }, g);
    svg('path', { class: 'agc-o-plank-dark', d: dark.join('') }, g);
    svg('path', { class: 'agc-o-plank-line', d: rows.join('') + joints.join('') }, g);
    // The window mirrored in the finish (a vertical mirror image of the wall), and the base's shadow line.
    const reflection = svg('g', {}, g);
    svg('rect', { x: 566, y: BASE, width: W - 566, height: 90, fill: 'url(#agc-o-reflection)' }, reflection);
    svg('path', { class: 'agc-o-reflect-bar', d: 'M695 420v80M827 420v80' }, reflection);
    svg('rect', { x: 0, y: BASE, width: W, height: 4, fill: 'url(#agc-o-base-shadow)' }, g);
    const patches = svg('path', { class: 'agc-o-sunlight' }, g);
    return { reflection, patches };
  }

  /** A fiddle-leaf fig in a ceramic pot at the foot of the stairs; its crown sways a little. */
  function fig(root) {
    const x = 122;
    const base = 446;
    const g = svg('g', { class: 'agc-o-fig' }, root);
    svg('ellipse', { class: 'agc-o-contact', cx: x + 3, cy: base, rx: 34, ry: 4.5 }, g);
    const crown = svg('g', {}, g);
    svg('path', { class: 'agc-o-trunk', d: `M${x} ${base - 46}C${x - 2} ${base - 90} ${x + 6} ${base - 130} ${x - 2} ${base - 190}M${x + 1} ${base - 110}C${x + 14} ${base - 128} ${x + 22} ${base - 140} ${x + 30} ${base - 150}M${x} ${base - 92}C${x - 12} ${base - 108} ${x - 22} ${base - 120} ${x - 30} ${base - 128}` }, crown);
    // A fiddle leaf: narrow at the stalk, broad and wavy towards its rounded tip.
    const LEAF = 'M0 0C-6 -3 -9 -9 -9 -15C-9 -20 -13 -24 -13 -31C-13 -40 -6 -45 1 -45C8 -45 14 -40 13 -32C12 -26 9 -22 10 -16C11 -9 6 -3 0 0Z';
    const leaves = [
      // Back leaves first, darker; then the front ones.
      [x - 20, base - 176, -22, 0.9, true], [x + 20, base - 168, 26, 0.9, true], [x - 34, base - 132, -58, 0.85, true], [x + 32, base - 122, 62, 0.85, true],
      [x - 2, base - 192, -6, 1.05], [x + 28, base - 150, 36, 1], [x - 28, base - 146, -34, 1], [x + 6, base - 160, 16, 0.95],
      [x - 10, base - 124, -48, 0.95], [x + 18, base - 112, 70, 0.9], [x - 22, base - 100, -76, 0.85], [x + 8, base - 92, 52, 0.85],
      [x - 6, base - 76, -64, 0.75],
    ];
    const swaying = leaves.map(([lx, ly, angle, size, back], i) => {
      const leaf = svg('g', { transform: `translate(${lx} ${ly}) rotate(${angle}) scale(${size})` }, crown);
      svg('path', { class: back ? 'agc-o-fig-leaf agc-o-fig-leaf--back' : 'agc-o-fig-leaf', d: LEAF, fill: back ? 'url(#agc-o-fig-back)' : 'url(#agc-o-fig)' }, leaf);
      svg('path', { class: 'agc-o-fig-vein', d: 'M0 -1C0 -14 1 -28 0 -41M0 -14l-5 -6M0 -24l6 -7M0 -33l-5 -5' }, leaf);
      return { leaf, lx, ly, angle, size, period: 5.1 + (i % 4) * 0.8, phase: (i * 0.29) % 1 };
    });
    svg('path', { d: `M${x - 26} ${base - 52}h52l-6 52h-40Z`, fill: 'url(#agc-o-pot)' }, g);
    svg('rect', { class: 'agc-o-pot-rim', x: x - 27, y: base - 54, width: 54, height: 4, rx: 1.5 }, g);
    svg('ellipse', { class: 'agc-o-soil', cx: x, cy: base - 53, rx: 24, ry: 2 }, g);
    return (t, set) => {
      set(crown, 'transform', `rotate(${f1(0.7 * wave(t, 8.3))} ${x} ${base - 50})`);
      for (const l of swaying) set(l.leaf, 'transform', `translate(${l.lx} ${l.ly}) rotate(${f1(l.angle + 2 * wave(t, l.period, l.phase))}) scale(${l.size})`);
    };
  }

  /**
   * The oak desk in front of the window, in perspective, with graphite
   * sled legs, two monitors, a keyboard and mouse, a mug, and a pot of
   * pothos. Returns where the screens are.
   */
  function desk(root) {
    const g = svg('g', { class: 'agc-o-desk' }, root);
    const front = depthScale(84);
    const back = depthScale(40);
    const HEIGHT = 58;
    const X0 = 607;
    const X1 = 858;
    const edge = (x, scale, up) => {
      const [fx, fy] = onFloor(x, scale);
      return [fx, fy - up * scale];
    };
    svg('path', { d: polygon([onFloor(X0, back), onFloor(X1, back), onFloor(X1 + 14, front + 0.06), onFloor(X0 - 14, front + 0.06)]), fill: 'url(#agc-o-desk-shadow)' }, g);
    // Sled legs: a front post, a back post, a foot, and a top rail at each end.
    const legs = [];
    for (const x of [X0 + 8, X1 - 8]) {
      const fb = onFloor(x, front);
      const bb = onFloor(x, back);
      const ft = edge(x, front, HEIGHT - 4);
      const bt = edge(x, back, HEIGHT - 4);
      legs.push(polygon([[bb[0] - 2, bt[1]], [bb[0] + 2, bt[1]], [bb[0] + 2, bb[1]], [bb[0] - 2, bb[1]]]));
      legs.push(polygon([[bb[0], bb[1] - 3], [fb[0], fb[1] - 3], [fb[0], fb[1]], [bb[0], bb[1]]]));
      legs.push(polygon([[ft[0] - 2.6, ft[1]], [ft[0] + 2.6, ft[1]], [fb[0] + 2.6, fb[1]], [fb[0] - 2.6, fb[1]]]));
    }
    svg('path', { class: 'agc-o-graphite', d: legs.join('') }, g);
    const top = [edge(X0, back, HEIGHT), edge(X1, back, HEIGHT), edge(X1, front, HEIGHT), edge(X0, front, HEIGHT)];
    svg('path', { d: polygon(top), fill: 'url(#agc-o-desktop)' }, g);
    const lip = [edge(X0, front, HEIGHT), edge(X1, front, HEIGHT), edge(X1, front, HEIGHT - 6), edge(X0, front, HEIGHT - 6)];
    svg('path', { class: 'agc-o-desk-edge', d: polygon(lip) }, g);
    svg('path', { class: 'agc-o-desk-light', d: `M${pt(top[0])}L${pt(top[1])}M${pt(top[3])}L${pt(top[2])}` }, g);
    // Monitors on the desk.
    const deskY = (lerp(top[0][1], top[3][1], 0.45));
    const screens = [];
    for (const cx of [681, 795]) {
      svg('path', { class: 'agc-o-monitor-foot', d: `M${cx - 16} ${f1(deskY + 1)}h32l-3 -4h-26Z` }, g);
      svg('rect', { class: 'agc-o-monitor-neck', x: cx - 3, y: f1(deskY - 18), width: 6, height: 16 }, g);
      const s = { x: cx - 54, y: deskY - 86, w: 108, h: 66 };
      svg('rect', { class: 'agc-o-monitor', x: f1(s.x - 3), y: f1(s.y - 3), width: s.w + 6, height: s.h + 7, rx: 3 }, g);
      svg('rect', { class: 'agc-o-monitor-chin', x: f1(s.x - 3), y: f1(s.y + s.h), width: s.w + 6, height: 4, rx: 1 }, g);
      screens.push(s);
    }
    // Keyboard and mouse.
    const kb = [edge(704, depthScale(70), HEIGHT), edge(776, depthScale(70), HEIGHT), edge(778, depthScale(80), HEIGHT), edge(702, depthScale(80), HEIGHT)];
    svg('path', { class: 'agc-o-keyboard', d: polygon(kb) }, g);
    svg('path', { class: 'agc-o-keys', d: [0.3, 0.55, 0.8].map((f) => `M${pt([lerp(kb[3][0], kb[0][0], f) + 3, lerp(kb[3][1], kb[0][1], f)])}L${pt([lerp(kb[2][0], kb[1][0], f) - 3, lerp(kb[2][1], kb[1][1], f)])}`).join('') }, g);
    const mouse = edge(796, depthScale(76), HEIGHT);
    svg('ellipse', { class: 'agc-o-mouse', cx: f1(mouse[0]), cy: f1(mouse[1] - 0.6), rx: 4, ry: 1.8 }, g);
    // A mug of coffee.
    const mug = edge(624, depthScale(72), HEIGHT);
    svg('path', { class: 'agc-o-mug-handle', d: `M${f1(mug[0] + 6)} ${f1(mug[1] - 13)}c6 0 6 8 0 8` }, g);
    svg('path', { class: 'agc-o-mug', d: `M${f1(mug[0] - 6.5)} ${f1(mug[1] - 16)}h13v14q0 2 -2 2h-9q-2 0 -2 -2Z` }, g);
    svg('ellipse', { class: 'agc-o-coffee', cx: f1(mug[0]), cy: f1(mug[1] - 16), rx: 6.5, ry: 1.6 }, g);
    // Pothos in a white pot.
    const pot = edge(842, depthScale(66), HEIGHT);
    svg('path', { class: 'agc-o-pot-small', d: `M${f1(pot[0] - 9)} ${f1(pot[1] - 16)}h18l-2 16h-14Z` }, g);
    svg('path', { class: 'agc-o-leaf', d: [[-6, -20, -30], [3, -24, 10], [9, -18, 50], [-2, -28, -5], [10, -8, 120], [-10, -10, -110]]
      .map(([dx, dy, a]) => {
        const r = (a * Math.PI) / 180;
        const lx = pot[0] + dx;
        const ly = pot[1] + dy;
        const tip = [lx + 8 * Math.sin(r), ly - 8 * Math.cos(r)];
        const side = [Math.cos(r) * 3.4, Math.sin(r) * 3.4];
        return `M${f1(lx)} ${f1(ly)}Q${f1((lx + tip[0]) / 2 + side[0])} ${f1((ly + tip[1]) / 2 + side[1])} ${f1(tip[0])} ${f1(tip[1])}Q${f1((lx + tip[0]) / 2 - side[0])} ${f1((ly + tip[1]) / 2 - side[1])} ${f1(lx)} ${f1(ly)}Z`;
      }).join('') }, g);
    return { screens, mug: [mug[0], mug[1] - 17] };
  }

  /**
   * Abstract code on a monitor: indented lines of coloured bars, scrolling
   * slowly upward. Unreadable on purpose. Returns the scrolling group.
   */
  function codeScreen(parent, defs, s, index) {
    const clipId = `agc-o-screen-${index}`;
    svg('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: 1.5 }, svg('clipPath', { id: clipId }, defs));
    const g = svg('g', { 'clip-path': `url(#${clipId})` }, parent);
    svg('rect', { x: s.x, y: s.y, width: s.w, height: s.h, fill: 'url(#agc-o-screen)' }, g);
    const scroll = svg('g', {}, g);
    const LINE = 6;
    const LINES = 16;
    const TOKENS = ['keyword', 'name', 'string', 'number', 'plain', 'comment'];
    const paths = Object.fromEntries(TOKENS.map((k) => [k, []]));
    const indent = [0, 1, 2, 2, 1, 2, 3, 3, 2, 1, 0, 0, 1, 2, 1, 0];
    for (let copy = 0; copy < 2; copy++) {
      for (let i = 0; i < LINES; i++) {
        const y = s.y + 5 + (copy * LINES + i) * LINE;
        let x = s.x + 6 + indent[i] * 7;
        const r = (k) => hash01(index * 7001 + i * 37 + k * 11);
        if (r(1) < 0.12) continue;
        if (r(2) < 0.18) {
          paths.comment.push(`M${f1(x)} ${y}h${f1(24 + 40 * r(3))}v2.6h${f1(-(24 + 40 * r(3)))}Z`);
          continue;
        }
        const n = 1 + Math.floor(r(4) * 3);
        for (let k = 0; k < n && x < s.x + s.w - 10; k++) {
          const w = 8 + Math.round(22 * r(5 + k));
          const tone = k === 0 && indent[i] < 2 ? 'keyword' : TOKENS[1 + Math.floor(r(9 + k) * 4)];
          paths[tone].push(`M${f1(x)} ${y}h${w}v2.6h${-w}Z`);
          x += w + 3;
        }
      }
    }
    for (const tone of TOKENS) svg('path', { class: `agc-o-code agc-o-code--${tone}`, d: paths[tone].join('') }, scroll);
    svg('rect', { x: s.x, y: s.y, width: s.w, height: s.h, fill: 'url(#agc-o-screen-sheen)' }, g);
    svg('rect', { class: 'agc-o-gutter', x: s.x, y: s.y, width: 3.5, height: s.h }, g);
    return { scroll, period: LINES * LINE, speed: 3.2 + index * 0.6 };
  }

  function officeDefs(root) {
    const defs = svg('defs', {}, root);
    gradient(defs, 'agc-o-slat-light', [[0, '#ffffff', 0.1], [0.5, '#ffffff', 0], [1, '#5a3b1c', 0.22]], { x2: 0.4, y2: 1 });
    gradient(defs, 'agc-o-soffit-shadow', [[0, '#5b5a55', 0.22], [1, '#5b5a55', 0]]);
    gradient(defs, 'agc-o-scallop', [[0, '#fffaf0', 0.8], [0.6, '#fffaf0', 0.2], [1, '#fffaf0', 0]], { radial: true, attrs: { cx: 0.5, cy: 0, r: 1 } });
    gradient(defs, 'agc-o-column', [[0, '#d9d7d2'], [0.4, '#fbfaf7'], [1, '#c8c5be']], { x2: 1, y2: 0 });
    gradient(defs, 'agc-o-steel', [[0, '#f4f6f8'], [0.45, '#b9c0c8'], [1, '#7c848e']]);
    gradient(defs, 'agc-o-opal', [[0, '#fffdf6'], [0.6, '#f1ece0'], [1, '#cfc8b8']], { radial: true, attrs: { cx: 0.4, cy: 0.35, r: 0.7 } });
    gradient(defs, 'agc-o-floor', [[0, '#e3cdac'], [1, '#d2b48a']]);
    gradient(defs, 'agc-o-reflection', [[0, '#ffffff', 0.34], [1, '#ffffff', 0]]);
    gradient(defs, 'agc-o-base-shadow', [[0, '#5a4630', 0.3], [1, '#5a4630', 0]]);
    gradient(defs, 'agc-o-pot', [[0, '#f3efe8'], [0.55, '#dcd5ca'], [1, '#b8afa2']], { x2: 1, y2: 0 });
    gradient(defs, 'agc-o-fig', [[0, '#3a7a3e'], [0.5, '#4f9149'], [1, '#78b366']], { x1: 0, y1: 1, x2: 0.6, y2: 0 });
    gradient(defs, 'agc-o-fig-back', [[0, '#24502a'], [1, '#3c7438']], { x1: 0, y1: 1, x2: 0.6, y2: 0 });
    gradient(defs, 'agc-o-desktop', [[0, '#e9cfa6'], [1, '#d2ad7c']]);
    gradient(defs, 'agc-o-desk-shadow', [[0, '#4a3a28', 0.35], [1, '#4a3a28', 0.08]]);
    gradient(defs, 'agc-o-screen', [[0, '#16233f'], [1, '#0d1628']]);
    gradient(defs, 'agc-o-screen-sheen', [[0, '#ffffff', 0.09], [0.4, '#ffffff', 0.02], [1, '#ffffff', 0]], { x2: 1, y2: 1 });
    gradient(defs, 'agc-o-screen-glow', [[0, '#9ec4ff', 0.3], [1, '#9ec4ff', 0]], { radial: true });
    gradient(defs, 'agc-o-pendant-glow', [[0, '#ffd99a', 0.6], [0.35, '#ffc070', 0.2], [1, '#ffc070', 0]], { radial: true });
    gradient(defs, 'agc-o-vignette', [[0, '#1b2236', 0], [0.7, '#1b2236', 0], [1, '#1b2236', 0.28]], { radial: true, attrs: { cx: 0.5, cy: 0.45, r: 0.75 } });
    const slats = svg('pattern', { id: 'agc-o-slats', width: 10, height: 20, patternUnits: 'userSpaceOnUse' }, defs);
    svg('rect', { class: 'agc-o-slat-gap', x: 0, y: 0, width: 10, height: 20 }, slats);
    svg('rect', { class: 'agc-o-slat', x: 0.5, y: 0, width: 7.5, height: 20 }, slats);
    svg('rect', { class: 'agc-o-slat-shine', x: 1.2, y: 0, width: 1.6, height: 20 }, slats);
    // Glass curtain walls on the near blocks: slim mullions and floor lines.
    const curtain = svg('pattern', { id: 'agc-o-curtain', width: 8, height: 11, patternUnits: 'userSpaceOnUse' }, defs);
    svg('rect', { class: 'agc-o-pane', x: 0, y: 0, width: 1, height: 11 }, curtain);
    svg('rect', { class: 'agc-o-pane', x: 0, y: 0, width: 8, height: 0.8 }, curtain);
    const ribbons = svg('pattern', { id: 'agc-o-ribbons', width: 40, height: 8, patternUnits: 'userSpaceOnUse' }, defs);
    svg('rect', { class: 'agc-o-pane', x: 0, y: 3, width: 40, height: 2.6 }, ribbons);
    return defs;
  }

  /**
   * The office from verse 3 on; returns its root, a pose function of song
   * time, and the time it holds under reduced motion: golden hour, the sun
   * low and whole in its pane, 14 s before it touches the skyline.
   */
  function officeRoom(layer, { song }) {
    const root = svg('svg', { class: 'agc-art agc-office', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true', focusable: 'false' }, layer);
    const defs = officeDefs(root);
    const clock = solarClock(song);
    const view = officeView(root, defs);
    glazingFrame(root);
    mezzanineFurniture(root);
    slatWall(root);
    underMezzanine(root);
    svg('rect', { class: 'agc-o-ceiling', x: 0, y: 0, width: W, height: 12 }, root);
    svg('rect', { class: 'agc-o-ceiling-line', x: 0, y: 11, width: W, height: 1.4 }, root);
    // The desk's pendants hang left of the sun's path down the window.
    const lamps = [pendant(root, 400, 92, { globe: true }), pendant(root, 646, 62), pendant(root, 734, 62)];
    const floor = officeFloor(root);
    mezzanine(root);
    officeStair(root);
    const swayFig = fig(root);
    const { screens, mug } = desk(root);
    // Late light: a warm wash at golden hour, a cool dim at blue hour.
    const golden = svg('rect', { class: 'agc-o-golden', x: 0, y: 0, width: W, height: H }, root);
    const dusk = svg('rect', { class: 'agc-o-dusk', x: 0, y: 0, width: W, height: H }, root);
    // What gives light stays bright over the dimming.
    const glows = svg('g', {}, root);
    for (const l of lamps) svg('circle', { cx: l.x, cy: l.y + 30, r: 110, fill: 'url(#agc-o-pendant-glow)' }, glows);
    for (const s of screens) svg('ellipse', { cx: s.x + s.w / 2, cy: s.y + s.h * 0.6, rx: s.w * 0.85, ry: s.h * 1.1, fill: 'url(#agc-o-screen-glow)' }, root);
    const codes = screens.map((s, i) => codeScreen(root, defs, s, i));
    const steam = [0, 1].map(() => svg('path', { class: 'agc-o-steam', d: 'M0 0c-3 -5 3 -8 0 -13c-2 -4 2 -7 0 -10' }, root));
    svg('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#agc-o-vignette)' }, root);

    const set = writer();
    const reflection = defs.querySelector('#agc-o-reflection').children[0];
    const pose = (t) => {
      const sun = clock.at(t);
      const e = sun.elevation;
      const skyColors = view.update(sun, t, set);
      // A warm wash while the sun is low and in view; the room cools after sunset as the pendants come up.
      const warm = span(e, [-0.5, 3]) * (1 - span(e, [8, 18])) * (0.35 + 0.65 * sun.visible);
      set(golden, 'opacity', (0.13 * warm).toFixed(3));
      set(dusk, 'opacity', (0.3 * span(-e, [0, 7])).toFixed(3));
      set(glows, 'opacity', span(-e, [-4, 2.5]).toFixed(3));
      // The window mirrored in the floor's finish takes the low sky's colour.
      set(reflection, 'stop-color', mixHex(skyColors[3], '#ffffff', 0.35));
      set(floor.reflection, 'opacity', (0.25 + 0.75 * span(e, [-6, 6])).toFixed(3));
      // Sunlight through the three tall panes, reaching further and turning deeper orange as the
      // sun sinks (leaning away from it), gone once the sun is behind the city.
      const reach = 60 + 190 * span(30 - e, [0, 28]);
      const lean = -(sun.x - VP_X) / FOCAL;
      const patch = [[567, 693], [698, 825], [830, 960]].map(([a, b]) => polygon([
        onFloor(a, 1.004), onFloor(b, 1.004), onFloor(b + lean * reach, depthScale(reach)), onFloor(a + lean * reach, depthScale(reach)),
      ])).join('');
      set(floor.patches, 'd', patch);
      set(floor.patches, 'opacity', ((0.14 + 0.2 * span(18 - e, [0, 14])) * sun.visible).toFixed(3));
      set(floor.patches, 'fill', mixHex('#fff3d4', '#ff8a3a', sun.reddening));
      for (const code of codes) set(code.scroll, 'transform', `translate(0 ${f1(-((t * code.speed) % code.period))})`);
      steam.forEach((wisp, i) => {
        const k = ((t / 3.4) + i * 0.5) % 1;
        set(wisp, 'transform', `translate(${f1(mug[0] + 2 * wave(t, 2.9, i * 0.4))} ${f1(mug[1] - k * 14)})`);
        set(wisp, 'opacity', (0.5 * Math.sin(Math.PI * k)).toFixed(3));
      });
      swayFig(t, set);
    };
    return { root, pose, stillTime: clock.touchAt - 14 };
  }

  // ------------------------------------------------------------------
  // The theme
  // ------------------------------------------------------------------

  /** When the office starts to replace the library: the start of verse 3. */
  const switchAt = (song) => song.sectionStart('verse-3');

  /**
   * Builds both rooms, the library over the office. Before the switch the
   * library is opaque and the office transparent; during the dissolve the
   * office is opaque underneath while the library fades out over it (a
   * true cross-dissolve, with no dip in brightness); after it the library
   * is transparent and the office opaque. A transparent room also leaves
   * rendering (display: none) and is not posed.
   */
  function agentCampus(stage, { song }) {
    const switchTime = switchAt(song);
    const layer = el('div', 'layer agc-room', stage);
    const office = officeRoom(layer, { song });
    const library = libraryRoom(layer, { switchTime });
    office.root.dataset.testid = 'campus-office';
    library.root.dataset.testid = 'campus-library';
    const show = (room, opacity) => {
      const value = opacity.toFixed(3);
      if (room.root.style.opacity !== value) room.root.style.opacity = value;
      const display = opacity > 0 ? '' : 'none';
      if (room.root.style.display !== display) room.root.style.display = display;
    };
    const pose = (t) => {
      const mix = easeInOutCubic(clamp((t - switchTime) / DISSOLVE, 0, 1));
      show(library, 1 - mix);
      show(office, mix > 0 ? 1 : 0);
      const still = reducedMotion.matches;
      if (mix < 1) library.pose(still ? STILL_LIBRARY : t);
      if (mix > 0) office.pose(still ? office.stillTime : t);
    };
    pose(0);
    onFrame(pose);
    return layer;
  }

  window.SongKit.themes['agent-campus'] = { build: agentCampus };
  window.AgentCampus = { FLOOR, DISSOLVE, switchAt, library: LIBRARY, office: OFFICE };
})();
