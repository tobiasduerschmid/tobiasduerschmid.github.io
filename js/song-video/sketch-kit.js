/*
 * Sketch kit for "Draw It Out" (the UML song): the pictures beside the
 * notation, drawn as if an architect sketched them in the drafting room
 * (drafting-room.js). The song's argument is "draw it out before you build
 * it", so the pictures come from the lecture's own building metaphors:
 *
 *   teammates whose thought bubbles show four different buildings until a
 *     clear drawing on the whiteboard makes them all picture one house;
 *   a load-bearing wall that every floor rests on, and a pencil that drafts
 *     the plan first;
 *   a floor plan whose layers fade until only the part a question needs is
 *     left, an eraser that fixes a flaw on paper, and a shipped app whose
 *     bug sends the whole team back to work;
 *   props for the four diagrams: a car whose wheels outlive it, a house whose
 *     rooms do not, a reading list tied to books on a shelf, an hourglass and
 *     a paper plane for waiting and not waiting, a library book that moves
 *     between states, and plugs whose ball snaps into a socket.
 *
 * Strokes draw themselves in like a pen (drawIn) wherever the lyric says to
 * draw. Builds on SongKit (kit.js) and Timeline (timeline.js); every builder
 * schedules its own motion, and every pose is a pure function of song time.
 * Under reduced motion, idle motion (blinks, bobbing, drifting smoke) holds
 * still. Coordinates are CSS pixels on the 960×540 stage; each drawing has
 * its own viewBox. Styles: css/song-video-sketch-kit.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, progress, easeInOutCubic, hash01 } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, place } = kit;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ------------------------------------------------------------------
  // Basics: drawings, entrances, timed states
  // ------------------------------------------------------------------

  /** An SVG drawing on the stage, w×h CSS pixels showing `viewBox`. */
  function art(parent, { x, y, w, h, viewBox, className = '' }) {
    const node = svg('svg', { class: `sk-art ${className} is-staged`.trim(), viewBox, width: w, height: h, 'aria-hidden': 'true' }, parent);
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    return node;
  }

  /** Shows a node from `at` (popping in) until `until` (popping out). */
  function show(node, at, until, { from = 0.6, rotate = 0 } = {}) {
    fx.pop(node, at, { from, rotate });
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  /** The newest entry of a time-sorted list at or before t (or undefined). */
  function latest(entries, t) {
    let found;
    for (const entry of entries) if (entry.at <= t) found = entry;
    return found;
  }

  /** A path with a class; `d` may be an array of segments. */
  function path(parent, cls, d, extra = {}) {
    return svg('path', { class: cls, d: Array.isArray(d) ? d.join(' ') : d, ...extra }, parent);
  }

  /**
   * Draws a group in like a pen: each path strokes in, one after another
   * across `duration`, and its fill fades in as its outline closes. Paths
   * marked `.sk-no-draw` (dashed lines, details) just fade in at the end.
   */
  function drawIn(group, at, duration = 0.9) {
    const paths = Array.from(group.querySelectorAll('path')).filter((p) => !p.closest('.sk-no-draw') && !p.classList.contains('sk-no-draw'));
    const rest = Array.from(group.querySelectorAll('.sk-no-draw'));
    const step = paths.length > 1 ? (duration * 0.55) / (paths.length - 1) : 0;
    const each = Math.max(0.18, duration * 0.45);
    paths.forEach((p, i) => {
      p.setAttribute('pathLength', '1');
      p.classList.add('sk-drawn');
      tween(p, [
        { strokeDashoffset: 1, fillOpacity: 0 },
        { strokeDashoffset: 0, fillOpacity: 0, offset: 0.65 },
        { strokeDashoffset: 0, fillOpacity: 1 },
      ], at + i * step, each, EASE.inOut);
    });
    for (const node of rest) fx.fadeIn(node, at + duration * 0.8, 0.25);
    return group;
  }

  /** A position on a list of points at fraction p of its length. */
  function along(points, p) {
    let total = 0;
    const lengths = [];
    for (let i = 1; i < points.length; i++) {
      const length = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      lengths.push(length);
      total += length;
    }
    let distance = Math.min(1, Math.max(0, p)) * total;
    for (let i = 1; i < points.length; i++) {
      if (distance <= lengths[i - 1] || i === points.length - 1) {
        const f = lengths[i - 1] ? Math.min(1, distance / lengths[i - 1]) : 1;
        return [points[i - 1][0] + f * (points[i][0] - points[i - 1][0]), points[i - 1][1] + f * (points[i][1] - points[i - 1][1])];
      }
      distance -= lengths[i - 1];
    }
    return points[points.length - 1];
  }

  /** A closed, bumpy cloud outline around an ellipse (rx, ry) centred at (cx, cy). */
  function cloudPath(cx, cy, rx, ry, bumps) {
    const points = Array.from({ length: bumps }, (_, i) => {
      const a = (i / bumps) * Math.PI * 2 - Math.PI / 2 + 0.2 * hash01(i * 7 + bumps);
      return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    });
    let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
    for (let i = 1; i <= bumps; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i % bumps];
      const r = Math.hypot(x1 - x0, y1 - y0) * 0.6;
      d += ` A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    return `${d} Z`;
  }

  /** Blinks: 1 while the eyes are shut (a 0.14 s blink every ~4 s, offset by `seed`). */
  function blinkAt(t, seed) {
    if (reducedMotion.matches) return 0;
    const period = 3.6 + hash01(seed) * 1.6;
    const phase = (t + hash01(seed + 1) * period) % period;
    return phase < 0.14 ? 1 : 0;
  }

  // ------------------------------------------------------------------
  // Teammates: four busts with faces that react to the song
  // ------------------------------------------------------------------

  /*
   * Four looks, after the four teammates on the lecture's slides: hoodie,
   * curls, beard, and hijab. Each has its own skin tone, hair (or a hijab),
   * and top, set as CSS custom properties on .sk-teammate--<look>. All share
   * one bust in a 140×160 box, head centred on x = 70 with the chin at y = 88.
   */

  const MOUTHS = {
    smile: 'M62 74 Q70 81 78 74',
    grin: 'M61 72 Q70 85 79 72 Q70 76 61 72 Z',
    flat: 'M63 76 L77 76',
    puzzled: 'M63 77 Q70 73 78 75',
    oh: 'M70 72 a3.6 4.6 0 1 0 0.1 0 Z',
    worried: 'M62 78 Q66 73 70 76 Q74 79 78 75',
  };

  // How each mood sets the face: mouth, brow lift (left, right), head tilt, gaze.
  const MOODS = {
    neutral: { mouth: 'smile', brows: [0, 0], tilt: 0, look: [0, 0] },
    happy: { mouth: 'grin', brows: [-2, -2], tilt: 3, look: [0, 0] },
    think: { mouth: 'flat', brows: [-1, -3], tilt: -4, look: [1.2, -1.6] },
    puzzled: { mouth: 'puzzled', brows: [2, -4], tilt: -7, look: [-1, -0.6] },
    surprised: { mouth: 'oh', brows: [-4, -4], tilt: 0, look: [0, 0] },
    worried: { mouth: 'worried', brows: [-3, -3], tilt: 4, look: [0, 1] },
  };

  function drawHairBack(g, look) {
    if (look === 'curls') {
      path(g, 'sk-hair', cloudPath(70, 46, 42, 40, 16));
      for (const [cx, cy] of [[38, 30], [56, 12], [86, 12], [104, 30], [30, 54], [110, 54]]) {
        path(g, 'sk-hair-curl', `M${cx - 5} ${cy} a5 5 0 1 1 10 0`);
      }
    } else if (look === 'hijab') {
      path(g, 'sk-hair', 'M24 128 C20 72 34 16 70 14 C106 16 120 72 116 128 C102 114 88 106 70 106 C52 106 38 114 24 128 Z');
    }
  }

  function drawHairFront(g, look) {
    if (look === 'hoodie') {
      path(g, 'sk-hair', 'M42 56 C36 26 56 12 74 13 C93 14 102 30 99 52 C95 42 90 36 83 33 C76 40 61 42 49 39 C46 44 44 50 42 56 Z');
    } else if (look === 'beard') {
      path(g, 'sk-hair', 'M44 48 C42 24 57 15 72 15 C89 15 99 26 96 48 C92 37 84 31 72 31 C60 31 50 37 44 48 Z');
      path(g, 'sk-beard', 'M45 58 C45 80 57 93 70 93 C83 93 95 80 95 58 C93 69 87 73 81 72 C76 69 64 69 59 72 C53 73 47 69 45 58 Z M63 76 Q70 80 77 76 Q70 83 63 76 Z', { 'fill-rule': 'evenodd' });
      path(g, 'sk-beard', 'M59 71 Q70 66 81 71 Q70 74 59 71 Z');
    } else if (look === 'curls') {
      path(g, 'sk-hair', 'M46 46 C48 28 60 22 70 24 C82 22 94 30 95 46 C88 38 80 34 70 36 C60 34 52 38 46 46 Z');
    } else if (look === 'hijab') {
      path(g, 'sk-hair', 'M45 48 C48 28 59 21 70 21 C81 21 92 28 95 48 C88 38 80 33 70 33 C60 33 52 38 45 48 Z');
      path(g, 'sk-hijab-fold', 'M40 96 C52 104 88 104 100 96');
    }
  }

  function drawTop(g, look) {
    path(g, 'sk-top', 'M6 160 C8 128 28 110 52 104 L88 104 C112 110 132 128 134 160 Z');
    path(g, 'sk-top-shade', 'M100 108 C120 118 132 136 134 160 L112 160 C112 140 108 122 100 108 Z');
    if (look === 'hoodie') {
      path(g, 'sk-hood', 'M30 118 C38 98 52 92 70 94 C88 92 102 98 110 118 C98 108 86 106 70 106 C54 106 42 108 30 118 Z');
      path(g, 'sk-string', 'M60 108 V128 M80 108 V128');
    } else if (look === 'beard') {
      path(g, 'sk-collar', 'M54 104 L70 120 L86 104');
      path(g, 'sk-knit', 'M22 140 Q30 138 38 141 M102 141 Q110 138 118 140');
    } else if (look === 'curls') {
      path(g, 'sk-collar', 'M52 104 Q70 122 88 104');
    }
  }

  /**
   * A teammate bust at (x, y), `size` px wide. moods = [[time, mood], ...]
   * from MOODS; `flip` faces them left. The face blinks on the song clock
   * and the head bobs a little on the beat.
   */
  function teammate(parent, { x, y, size = 130, look, flip = false, at, until, moods = [], seed = 1 }) {
    const node = art(parent, { x, y, w: size, h: size * 160 / 140, viewBox: '0 0 140 160', className: `sk-teammate sk-teammate--${look}` });
    const body = svg('g', { transform: flip ? 'translate(140 0) scale(-1 1)' : '' }, node);
    const head = svg('g', { class: 'sk-head' }, body);
    drawHairBack(head, look);
    drawTop(body, look);
    body.append(head);
    path(head, 'sk-neck', 'M58 82 L58 104 Q70 112 82 104 L82 82 Z');
    if (look !== 'hijab') {
      for (const cx of [44, 96]) svg('ellipse', { class: 'sk-ear', cx, cy: 58, rx: 5.5, ry: 8 }, head);
    }
    path(head, 'sk-face', 'M44 52 C44 30 56 20 70 20 C84 20 96 30 96 52 C96 72 86 88 70 88 C54 88 44 72 44 52 Z');
    path(head, 'sk-face-shade', 'M84 26 C92 32 96 42 96 52 C96 70 87 84 74 87 C84 78 90 66 90 52 C90 40 88 32 84 26 Z');
    for (const cx of [55, 85]) svg('ellipse', { class: 'sk-cheek', cx, cy: 67, rx: 5, ry: 3 }, head);
    if (look === 'curls') for (const cx of [44, 96]) svg('circle', { class: 'sk-earring', cx, cy: 72, r: 3 }, head);
    const eyes = svg('g', { class: 'sk-eyes' }, head);
    for (const cx of [60, 80]) {
      svg('ellipse', { class: 'sk-eye', cx, cy: 56, rx: 3.3, ry: 4.3 }, eyes);
      svg('circle', { class: 'sk-eye-glint', cx: cx + 1.1, cy: 54.6, r: 1.1 }, eyes);
    }
    const lids = [60, 80].map((cx) => svg('ellipse', { class: 'sk-lid', cx, cy: 56, rx: 4.2, ry: 0.01 }, head));
    const brows = [[54, 66], [74, 86]].map(([a, b]) => path(head, 'sk-brow', `M${a} 46 Q${(a + b) / 2} 42.5 ${b} 46`));
    path(head, 'sk-nose', 'M70 57 Q66.5 65 71 66.5');
    const mouths = Object.fromEntries(Object.entries(MOUTHS).map(([name, d]) => [name, path(head, `sk-mouth sk-mouth--${name}`, d)]));
    drawHairFront(head, look);
    const marks = path(head, 'sk-puzzle-mark', 'M104 18 Q104 8 112 8 Q120 8 120 16 Q120 22 113 25 V30 M113 36 V37');
    const sorted = [...moods].sort((a, b) => a[0] - b[0]).map(([time, mood]) => ({ at: time, mood }));
    let drawn = '';
    onFrame((t) => {
      const mood = MOODS[(latest(sorted, t) || { mood: 'neutral' }).mood];
      const blink = blinkAt(t, seed);
      const bob = reducedMotion.matches ? 0 : Math.sin(t * 2.1 + seed) * 1.2;
      const state = `${mood.mouth}|${blink}|${bob.toFixed(1)}|${mood.tilt}`;
      if (state === drawn) return;
      drawn = state;
      head.setAttribute('transform', `rotate(${(mood.tilt + bob * 0.6).toFixed(2)} 70 96) translate(0 ${(bob * 0.5).toFixed(2)})`);
      for (const [name, node] of Object.entries(mouths)) node.classList.toggle('is-shown', name === mood.mouth);
      eyes.setAttribute('transform', `translate(${mood.look[0]} ${mood.look[1]})`);
      lids.forEach((lid) => lid.setAttribute('ry', blink ? '4.6' : '0.01'));
      brows.forEach((brow, i) => brow.setAttribute('transform', `translate(0 ${mood.brows[i]})`));
      marks.classList.toggle('is-shown', mood === MOODS.puzzled);
    });
    show(node, at, until, { from: 0.85 });
    return { node, head };
  }

  // ------------------------------------------------------------------
  // Buildings: what each teammate pictures (100×80 boxes, ground at 76)
  // ------------------------------------------------------------------

  const BUILDINGS = {
    tower(g) {
      path(g, 'sk-wall sk-wall--glass', 'M30 76 V14 L46 8 L62 14 V76 Z');
      path(g, 'sk-wall sk-wall--glass-dark', 'M62 76 V30 H78 V76 Z');
      path(g, 'sk-line', 'M46 8 V0');
      for (let row = 0; row < 7; row++) {
        for (const col of [0, 1, 2]) svg('rect', { class: 'sk-window sk-no-draw', x: 34 + col * 9, y: 20 + row * 8, width: 5, height: 4 }, g);
      }
      for (let row = 0; row < 5; row++) svg('rect', { class: 'sk-window sk-no-draw', x: 66, y: 36 + row * 8, width: 8, height: 4 }, g);
      path(g, 'sk-ground', 'M14 76 H86');
    },
    mall(g) {
      path(g, 'sk-wall', 'M10 76 V36 H90 V76 Z');
      path(g, 'sk-sign', 'M30 24 H70 V36 H30 Z');
      const label = svg('text', { class: 'sk-sign-text sk-no-draw', x: 50, y: 33.5 }, g);
      label.textContent = 'MALL';
      path(g, 'sk-awning', 'M10 36 H90 L86 46 H14 Z');
      path(g, 'sk-awning-stripes sk-no-draw', 'M26 36 L24 46 M42 36 L41 46 M58 36 L59 46 M74 36 L76 46');
      path(g, 'sk-glass', 'M38 76 V54 H62 V76 Z M50 54 V76');
      path(g, 'sk-glass', 'M16 52 H32 V66 H16 Z M68 52 H84 V66 H68 Z');
      path(g, 'sk-ground', 'M4 76 H96');
    },
    factory(g) {
      path(g, 'sk-wall sk-wall--brick', 'M10 76 V44 L28 32 V44 L46 32 V44 L64 32 V44 H90 V76 Z');
      path(g, 'sk-wall sk-wall--steel', 'M70 44 V10 H80 V44 Z');
      for (const x of [16, 34, 52]) path(g, 'sk-glass', `M${x} 52 H${x + 12} V62 H${x} Z`);
      path(g, 'sk-door', 'M72 76 V58 H84 V76 Z');
      path(g, 'sk-ground', 'M4 76 H96');
    },
    museum(g) {
      path(g, 'sk-roof sk-roof--stone', 'M8 30 L50 10 L92 30 Z');
      path(g, 'sk-wall sk-wall--stone', 'M14 30 H86 V36 H14 Z');
      for (const x of [20, 34, 48, 62, 76]) path(g, 'sk-column', `M${x} 36 H${x + 6} V68 H${x} Z`);
      path(g, 'sk-steps', 'M10 68 H90 V72 H10 Z M6 72 H94 V76 H6 Z');
      svg('circle', { class: 'sk-medallion sk-no-draw', cx: 50, cy: 23, r: 3 }, g);
    },
    house(g) {
      // Open outlines where shapes meet, so no edge is drawn twice: the
      // roof's eaves rest on the wall top and the chimney stands on the roof.
      path(g, 'sk-wall', 'M20 76 V40 H80 V76 Z');
      path(g, 'sk-roof', 'M12 40 L50 12 L88 40');
      path(g, 'sk-chimney', 'M66 23.8 V14 H74 V29.7');
      path(g, 'sk-door', 'M44 76 V54 Q50 48 56 54 V76');
      path(g, 'sk-glass', 'M26 50 H38 V62 H26 Z M32 50 V62 M26 56 H38');
      path(g, 'sk-glass', 'M62 50 H74 V62 H62 Z M68 50 V62 M62 56 H74');
      svg('circle', { class: 'sk-knob sk-no-draw', cx: 53.5, cy: 66, r: 1.2 }, g);
      path(g, 'sk-ground', 'M8 76 H92');
    },
    vague(g) {
      path(g, 'sk-line sk-line--loose', 'M18 44 L50 16 L82 44');
      path(g, 'sk-line sk-line--loose', 'M42 76 V60 Q50 50 58 60 V76');
    },
    shed(g) {
      path(g, 'sk-wall sk-wall--wood', 'M24 76 V40 L76 32 V76 Z');
      path(g, 'sk-roof sk-roof--dark', 'M18 42 L80 30 L82 36 L20 48 Z');
      path(g, 'sk-planks sk-no-draw', 'M36 40 V76 M48 38 V76 M60 36 V76');
      path(g, 'sk-door', 'M40 76 V54 H56 V76 Z');
      path(g, 'sk-ground', 'M10 76 H90');
    },
    garage(g) {
      path(g, 'sk-wall', 'M12 76 V36 L50 20 L88 36 V76 Z');
      path(g, 'sk-door sk-door--garage', 'M24 76 V46 H76 V76 Z');
      path(g, 'sk-planks sk-no-draw', 'M24 54 H76 M24 61 H76 M24 68 H76');
      path(g, 'sk-ground', 'M6 76 H94');
    },
    doghouse(g) {
      path(g, 'sk-wall sk-wall--wood', 'M28 76 V48 L50 30 L72 48 V76 Z');
      path(g, 'sk-roof sk-roof--dark', 'M22 50 L50 24 L78 50 L72 52 L50 32 L28 52 Z');
      path(g, 'sk-door sk-door--dark', 'M42 76 V62 Q50 52 58 62 V76 Z');
      path(g, 'sk-bone sk-no-draw', 'M44 44 H56 M43 42 V46 M57 42 V46');
      path(g, 'sk-ground', 'M14 76 H86');
    },
    warehouse(g) {
      path(g, 'sk-wall sk-wall--steel', 'M8 76 V38 Q50 20 92 38 V76 Z');
      for (const x of [16, 40, 64]) path(g, 'sk-door sk-door--garage', `M${x} 76 V52 H${x + 18} V76 Z`);
      path(g, 'sk-planks sk-no-draw', 'M16 60 H34 M40 60 H58 M64 60 H82 M16 67 H34 M40 67 H58 M64 67 H82');
      path(g, 'sk-ground', 'M2 76 H98');
    },
    umlClass(g) {
      path(g, 'sk-uml-box', 'M26 10 H74 V70 H26 Z');
      path(g, 'sk-uml-name', 'M26 10 H74 V26 H26 Z');
      path(g, 'sk-line', 'M26 26 H74 M26 48 H74');
      path(g, 'sk-uml-row sk-no-draw', 'M32 34 H62 M32 41 H56 M32 56 H66 M32 63 H58');
    },
  };

  /** One building drawing in a 100×80 group. */
  function building(parent, kind) {
    const g = svg('g', { class: `sk-building sk-building--${kind}` }, parent);
    BUILDINGS[kind](g);
    return g;
  }

  // ------------------------------------------------------------------
  // Thought bubbles
  // ------------------------------------------------------------------

  /**
   * A thought bubble at (x, y), w×h, whose trail of small circles points
   * down to `tail` ('left' or 'right'). pictures = [{ at, kind }]: each
   * building replaces the previous one with a quick pop; `badge` adds a
   * green check (agreement) or a question mark from its time on.
   */
  function thought(parent, { x, y, w = 130, h = 100, tail = 'left', at, until, pictures, badges = [] }) {
    const node = art(parent, { x, y, w, h: h + 34, viewBox: `0 0 ${w} ${h + 34}`, className: 'sk-thought' });
    path(node, 'sk-cloud', cloudPath(w / 2, h / 2, w / 2 - 8, h / 2 - 8, 11));
    const tx = tail === 'left' ? w * 0.26 : w * 0.74;
    const dx = tail === 'left' ? -1 : 1;
    svg('circle', { class: 'sk-cloud', cx: tx, cy: h + 6, r: 7 }, node);
    svg('circle', { class: 'sk-cloud', cx: tx + dx * 10, cy: h + 22, r: 4.5 }, node);
    const sorted = [...pictures].sort((a, b) => a.at - b.at);
    const scale = Math.min((w - 34) / 100, (h - 26) / 80);
    sorted.forEach((picture, i) => {
      const holder = svg('g', { class: 'sk-thought-picture is-staged' }, node);
      holder.setAttribute('transform', `translate(${(w - 100 * scale) / 2} ${(h - 80 * scale) / 2}) scale(${scale})`);
      building(holder, picture.kind);
      const next = sorted[i + 1];
      tween(holder, [{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }], picture.at, 0.3, EASE.back);
      if (next) tween(holder, { opacity: 0 }, next.at - 0.05, 0.12, EASE.in);
    });
    for (const badge of badges) {
      const mark = svg('g', { class: `sk-thought-badge sk-thought-badge--${badge.kind} is-staged` }, node);
      mark.setAttribute('transform', `translate(${w - 22} 16)`);
      svg('circle', { r: 11 }, mark);
      path(mark, 'sk-thought-badge-icon', badge.kind === 'check' ? 'M-5 0 L-1 4 L5 -4' : 'M-3 -3 Q-3 -7 0 -7 Q4 -7 4 -3 Q4 0 0 1 V3 M0 6 V6.5');
      fx.pop(mark, badge.at, { from: 0.4 });
      if (badge.until !== undefined) fx.popOut(mark, badge.until);
    }
    show(node, at, until, { from: 0.4 });
    return node;
  }

  // ------------------------------------------------------------------
  // The whiteboard
  // ------------------------------------------------------------------

  /**
   * A whiteboard on an easel at (x, y), w wide. drawings = [{ at, kind,
   * until }]: a building drawn on the board in marker, stroke by stroke,
   * with a marker pen that follows the drawing while it lasts.
   */
  function whiteboard(parent, { x, y, w = 300, at, until, drawings = [] }) {
    const h = w * 0.72;
    const node = art(parent, { x, y, w, h: h + 70, viewBox: `0 0 ${w} ${h + 70}`, className: 'sk-whiteboard' });
    path(node, 'sk-easel', `M${w * 0.2} ${h} L${w * 0.12} ${h + 66} M${w * 0.8} ${h} L${w * 0.88} ${h + 66} M${w / 2} ${h} V${h + 60}`);
    svg('rect', { class: 'sk-board-frame', x: 0, y: 0, width: w, height: h, rx: 8 }, node);
    svg('rect', { class: 'sk-board', x: 7, y: 7, width: w - 14, height: h - 14, rx: 4 }, node);
    svg('rect', { class: 'sk-board-tray', x: w * 0.25, y: h - 3, width: w * 0.5, height: 8, rx: 3 }, node);
    svg('rect', { class: 'sk-board-marker sk-board-marker--red', x: w * 0.3, y: h - 8, width: 22, height: 6, rx: 2 }, node);
    const scale = Math.min((w - 40) / 100, (h - 30) / 80);
    for (const drawing of drawings) {
      // Hidden outright until its cue, not only by its stroke dashes, so no
      // engine paints a later drawing's line caps over an earlier one.
      const holder = svg('g', { class: 'sk-board-drawing is-staged' }, node);
      holder.setAttribute('transform', `translate(${(w - 100 * scale) / 2} ${(h - 80 * scale) / 2 - 2}) scale(${scale})`);
      const g = building(holder, drawing.kind);
      fx.fadeIn(holder, drawing.at - 0.02, 0.02);
      drawIn(g, drawing.at, drawing.duration ?? 0.9);
      if (drawing.until !== undefined) fx.fadeOut(holder, drawing.until, 0.25);
      marker(node, holder, drawing, scale);
    }
    show(node, at, until, { from: 0.9 });
    return { node, w, h };
  }

  /** A marker pen that traces a board drawing's outline while it draws in. */
  function marker(board, holder, drawing, scale) {
    const pen = svg('g', { class: 'sk-marker is-staged' }, board);
    path(pen, 'sk-marker-body', 'M0 0 L6 -6 L40 -40 Q44 -44 48 -40 L52 -36 Q56 -32 52 -28 L18 6 L12 12 Z');
    path(pen, 'sk-marker-cap', 'M34 -34 L48 -40 Q52 -36 48 -26 L40 -18 Z');
    path(pen, 'sk-marker-tip', 'M0 0 L6 -6 L12 0 L6 6 Z');
    const box = holder.getAttribute('transform');
    const [, ox, oy] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(box);
    const route = [[20, 70], [50, 14], [82, 42], [80, 76], [20, 76], [44, 56], [58, 58]]
      .map(([px, py]) => [+ox + px * scale, +oy + py * scale]);
    const duration = drawing.duration ?? 0.9;
    tween(pen, [{ opacity: 0 }, { opacity: 1 }], drawing.at - 0.1, 0.12);
    tween(pen, { opacity: 0 }, drawing.at + duration + 0.1, 0.2);
    onFrame((t) => {
      const [px, py] = along(route, progress(t, drawing.at, duration));
      pen.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
    });
  }

  // ------------------------------------------------------------------
  // Notes, speech, stickies, and the desk calendar
  // ------------------------------------------------------------------

  /** A speech bubble (HTML, so text wraps) whose tail points down-left or down-right. */
  function speech(parent, text, { x, y, w, at, until, tail = 'left', tone = 'paper' }) {
    const node = place(el('div', `sk-speech sk-speech--${tail} sk-speech--${tone} is-staged`, parent, text), x, y);
    if (w) node.style.width = `${w}px`;
    return show(node, at, until, { from: 0.5, rotate: tail === 'left' ? -2 : 2 });
  }

  /** A sticky note that slaps onto the stage. */
  function sticky(parent, text, { x, y, at, until, rotate = -4, tone = 'yellow' }) {
    const node = place(el('div', `sk-sticky sk-sticky--${tone} is-staged`, parent, text), x, y);
    tween(node, [
      { opacity: 0, scale: 1.5, rotate: `${rotate + 10}deg` },
      { opacity: 1, scale: 1, rotate: `${rotate}deg` },
    ], at, 0.28, EASE.out);
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  /** A desk calendar whose page tears off to the next one: pages = [{ at, top, big }]. */
  function calendar(parent, { x, y, at, until, pages }) {
    const node = place(el('div', 'sk-calendar is-staged', parent), x, y);
    const rings = el('div', 'sk-calendar-rings', node);
    for (let i = 0; i < 3; i++) el('span', null, rings);
    const sorted = [...pages].sort((a, b) => a.at - b.at);
    sorted.forEach((page, i) => {
      const sheet = el('div', `sk-calendar-page${page.tone ? ` sk-calendar-page--${page.tone}` : ''}`, node);
      el('div', 'sk-calendar-top', sheet, page.top);
      el('div', 'sk-calendar-big', sheet, page.big);
      const next = sorted[i + 1];
      sheet.style.zIndex = String(sorted.length - i);
      if (next) {
        tween(sheet, [
          { opacity: 1, translate: '0 0', rotate: '0deg' },
          { opacity: 1, translate: '8px 24px', rotate: '7deg', offset: 0.3 },
          { opacity: 0, translate: '50px 150px', rotate: '32deg' },
        ], next.at, 0.7, EASE.in);
      }
    });
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  // ------------------------------------------------------------------
  // Devices: laptops, a server rack, a database, a phone
  // ------------------------------------------------------------------

  /**
   * Device drawings on a 100×100 grid, built in layers: body, shading,
   * highlight, then fine detail (`.sk-no-draw` details fade in after a pen
   * stroke-in). Ink outlines come from css/song-video-sketch-kit.css.
   */
  const DEVICES = {
    laptop(g) {
      // Lid: shell, bezel, and an editor window with its title-bar dots.
      path(g, 'sk-device-shell', 'M15 10 H85 Q90 10 90 15 V64 H10 V15 Q10 10 15 10 Z');
      path(g, 'sk-device-screen', 'M16 16 H84 V59 H16 Z');
      path(g, 'sk-device-titlebar sk-no-draw', 'M16 16 H84 V22 H16 Z');
      for (const [cx, tone] of [[20, 'red'], [24.5, 'amber'], [29, 'green']]) svg('circle', { class: `sk-device-dot sk-device-dot--${tone} sk-no-draw`, cx, cy: 19, r: 1.4 }, g);
      path(g, 'sk-device-gutter sk-no-draw', 'M23 25 V56');
      path(g, 'sk-code-line sk-code-line--gold sk-no-draw', 'M27 28 H44');
      path(g, 'sk-code-line sk-code-line--cyan sk-no-draw', 'M31 34 H62 M31 40 H54');
      path(g, 'sk-code-line sk-code-line--white sk-no-draw', 'M35 46 H58');
      path(g, 'sk-code-line sk-code-line--pink sk-no-draw', 'M27 52 H41');
      path(g, 'sk-device-cursor sk-no-draw', 'M44 50 H47 V54 H44 Z');
      path(g, 'sk-device-glare sk-no-draw', 'M62 16 H74 L54 59 H42 Z');
      svg('circle', { class: 'sk-device-camera sk-no-draw', cx: 50, cy: 13, r: 1.2 }, g);
      // Base: the keyboard deck, rows of keys, a trackpad, and the front lip.
      path(g, 'sk-device-base', 'M6 66 H94 L88 80 H12 Z');
      path(g, 'sk-device-keys sk-no-draw', 'M16 69 H84 M15 72 H85 M14 75 H86 M30 69 V75 M42 69 V75 M54 69 V75 M66 69 V75');
      path(g, 'sk-device-trackpad sk-no-draw', 'M42 76.5 H58 V79 H42 Z');
      path(g, 'sk-device-lip', 'M12 80 H88 L86 83 H14 Z');
      path(g, 'sk-device-hinge', 'M12 64 H88');
    },
    server(g) {
      // Cabinet with side rails and a top cap, five rack units, and feet.
      path(g, 'sk-device-rack', 'M24 6 H76 Q80 6 80 10 V92 H20 V10 Q20 6 24 6 Z');
      path(g, 'sk-device-rail sk-no-draw', 'M24 10 V90 M76 10 V90');
      path(g, 'sk-device-highlight sk-no-draw', 'M22 12 V86');
      for (let i = 0; i < 5; i++) {
        const y = 12 + i * 15.5;
        path(g, 'sk-device-unit', `M27 ${y} H73 V${y + 12} H27 Z`);
        path(g, 'sk-device-handle sk-no-draw', `M28.5 ${y + 3} V${y + 9} M71.5 ${y + 3} V${y + 9}`);
        if (i === 0) {
          path(g, 'sk-device-display sk-no-draw', `M33 ${y + 3} H50 V${y + 9} H33 Z`);
          path(g, 'sk-device-display-text sk-no-draw', `M35 ${y + 6} H46`);
        } else {
          for (let k = 0; k < 3; k++) path(g, 'sk-device-bay sk-no-draw', `M${33 + k * 7} ${y + 3} h5 v6 h-5 Z`);
          path(g, 'sk-device-vent sk-no-draw', `M55 ${y + 4} H62 M55 ${y + 6.5} H62 M55 ${y + 9} H62`);
        }
        svg('circle', { class: `sk-led sk-no-draw${['', ' sk-led--amber', '', ' sk-led--blue', ''][i]}`, cx: 67, cy: y + 4.5, r: 1.8 }, g);
        svg('circle', { class: 'sk-led sk-led--dim sk-no-draw', cx: 67, cy: y + 8.5, r: 1.3 }, g);
      }
      path(g, 'sk-device-feet', 'M27 92 V97 M73 92 V97');
    },
    database(g) {
      // A cylinder: body, the darker far side, platter rings, the lit top.
      path(g, 'sk-device-db', 'M20 22 V78 Q50 92 80 78 V22 Z');
      path(g, 'sk-device-db-shade sk-no-draw', 'M64 28 Q74 26 80 22 V78 Q74 84 64 86 Z');
      path(g, 'sk-device-db-band sk-no-draw', 'M20 40 Q50 54 80 40 M20 59 Q50 73 80 59');
      path(g, 'sk-device-db-shine sk-no-draw', 'M27 34 V72');
      for (const cy of [47, 66, 84]) svg('circle', { class: 'sk-led sk-no-draw', cx: 30, cy: cy - 1, r: 1.8 }, g);
      path(g, 'sk-device-db-top', 'M20 22 Q50 8 80 22 Q50 36 20 22 Z');
      path(g, 'sk-device-db-rim sk-no-draw', 'M30 21 Q50 13 70 21');
    },
    phone(g) {
      // Body with side buttons, the screen, a camera, a status bar, and a
      // library app: a header with a book, and a list of loans.
      path(g, 'sk-device-button', 'M75 24 H78 V36 H75 Z M22 28 H25 V34 H22 Z M22 38 H25 V48 H22 Z');
      path(g, 'sk-device-shell', 'M32 4 H68 Q76 4 76 12 V88 Q76 96 68 96 H32 Q24 96 24 88 V12 Q24 4 32 4 Z');
      path(g, 'sk-device-screen sk-device-screen--light', 'M28 12 H72 V86 H28 Z');
      svg('circle', { class: 'sk-device-camera sk-no-draw', cx: 50, cy: 8, r: 1.4 }, g);
      path(g, 'sk-device-status sk-no-draw', 'M31 15.5 H38 M62 15 H68 V17 H62 Z');
      path(g, 'sk-device-app-bar sk-no-draw', 'M28 19 H72 V31 H28 Z');
      path(g, 'sk-device-app-book sk-no-draw', 'M33 22 H39 V28 H33 Z M36 22 V28');
      path(g, 'sk-device-app-title sk-no-draw', 'M43 25 H63');
      for (let i = 0; i < 4; i++) {
        const y = 37 + i * 11;
        path(g, 'sk-device-app-row sk-no-draw', `M31 ${y} H69 V${y + 8} H31 Z`);
        path(g, 'sk-device-app-cover sk-no-draw', `M33 ${y + 1.5} H37 V${y + 6.5} H33 Z`);
        path(g, 'sk-device-app-text sk-no-draw', `M40 ${y + 3} H60 M40 ${y + 5.5} H52`);
      }
      path(g, 'sk-device-hinge', 'M44 91 H56');
    },
  };

  /** A device drawing (DEVICES) `size` px square at (x, y). */
  function device(parent, kind, { x, y, size = 80, at, until, className = '' }) {
    const node = art(parent, { x, y, w: size, h: size, viewBox: '0 0 100 100', className: `sk-device sk-device--${kind} ${className}`.trim() });
    DEVICES[kind](svg('g', {}, node));
    show(node, at, until, { from: 0.6 });
    return node;
  }

  /**
   * Peer-to-peer laptops around a ring, every pair linked. At `serverAt` a
   * server drops into the middle: every peer link turns red and breaks, and
   * new links run from each laptop to the server.
   */
  function network(parent, { x, y, r = 120, count = 5, at, linkAt, serverAt, until }) {
    const size = 64;
    const centres = Array.from({ length: count }, (_, i) => {
      const a = -Math.PI / 2 + (i / count) * Math.PI * 2;
      return [x + r * Math.cos(a), y + r * 0.78 * Math.sin(a)];
    });
    const wires = art(parent, { x: 0, y: 0, w: 960, h: 540, viewBox: '0 0 960 540', className: 'sk-network' });
    fx.fadeIn(wires, at, 0.01);
    let k = 0;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const [x1, y1] = centres[i];
        const [x2, y2] = centres[j];
        const link = svg('g', {}, wires);
        const wire = path(link, 'sk-wire', `M${x1} ${y1} L${x2} ${y2}`);
        wire.setAttribute('pathLength', '1');
        wire.classList.add('sk-drawn');
        tween(wire, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], linkAt + k * 0.05, 0.35, EASE.inOut);
        if (serverAt !== undefined) {
          fx.fadeIn(path(link, 'sk-wire sk-wire--broken is-staged', `M${x1} ${y1} L${x2} ${y2}`), serverAt + 0.1, 0.2);
          tween(link, { opacity: 0.25 }, serverAt + 0.5 + k * 0.03, 0.3);
        }
        k++;
      }
    }
    if (serverAt !== undefined) {
      centres.forEach(([cx, cy], i) => {
        const spoke = path(wires, 'sk-wire sk-wire--server', `M${cx} ${cy} L${x} ${y}`);
        spoke.setAttribute('pathLength', '1');
        spoke.classList.add('sk-drawn');
        tween(spoke, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], serverAt + 0.45 + i * 0.06, 0.35, EASE.inOut);
      });
      const server = device(parent, 'server', { x: x - 44, y: y - 50, size: 88, at: serverAt, until });
      tween(server, [{ translate: '0 -90px' }, { translate: '0 0' }], serverAt, 0.35, EASE.in);
    }
    const laptops = centres.map(([cx, cy], i) => device(parent, 'laptop', { x: cx - size / 2, y: cy - size / 2, size, at: at + i * 0.08, until }));
    if (until !== undefined) fx.fadeOut(wires, until, 0.25);
    return { wires, laptops, centres };
  }

  // ------------------------------------------------------------------
  // The load-bearing wall: a building section whose floors rest on it
  // ------------------------------------------------------------------

  /**
   * A three-storey building in section at (x, y), 300×300. The ground
   * floor's middle wall carries `label`. At `weightAt` arrows show every
   * floor's load running down into that wall; at `crackAt` it cracks, dust
   * falls, and the floors above shudder. With `blueprint` the same section
   * is drawn in white lines on blueprint blue, stroke by stroke, from `at`.
   */
  function section(parent, { x, y, at, until, label, labelAt, weightAt, crackAt, blueprint = false }) {
    const node = art(parent, { x, y, w: 300, h: 300, viewBox: '0 0 300 300', className: `sk-section${blueprint ? ' sk-section--blueprint' : ''}` });
    const upper = svg('g', { class: 'sk-section-upper' }, node);
    const ground = svg('g', {}, node);
    path(upper, 'sk-section-roof', 'M20 64 L150 14 L280 64 Z');
    for (const [top, rooms] of [[64, [[34, 'sofa'], [178, 'bed']]], [134, [[34, 'desk'], [178, 'table']]]]) {
      path(upper, 'sk-section-room', `M30 ${top} H270 V${top + 70} H30 Z`);
      path(upper, 'sk-section-wall', `M150 ${top} V${top + 70}`);
      for (const [rx, item] of rooms) furniture(upper, item, rx, top + 70);
      path(upper, 'sk-section-slab', `M24 ${top + 66} H276 V${top + 74} H24 Z`);
    }
    path(ground, 'sk-section-room', 'M30 204 H270 V276 H30 Z');
    path(ground, 'sk-section-door', 'M54 276 V236 H78 V276');
    path(ground, 'sk-section-door', 'M222 276 V236 H246 V276');
    const wall = path(ground, 'sk-section-bearing', 'M138 208 H162 V276 H138 Z');
    path(ground, 'sk-section-ground', 'M0 280 H300');
    if (blueprint) {
      fx.fadeIn(node, at, 0.01);
      drawIn(node, at, 1.2);
    } else {
      show(node, at, until, { from: 0.9 });
    }
    if (blueprint && until !== undefined) fx.fadeOut(node, until, 0.3);
    if (weightAt !== undefined) {
      const arrows = svg('g', { class: 'sk-section-weight is-staged' }, node);
      for (const [ax, delay] of [[90, 0], [210, 0.08], [150, 0.16]]) {
        const arrow = path(arrows, 'sk-weight-arrow', `M${ax} 40 Q${ax} 120 ${150 + (ax - 150) * 0.12} 200 M${150 + (ax - 150) * 0.12 - 7} 190 L${150 + (ax - 150) * 0.12} 202 L${150 + (ax - 150) * 0.12 + 7} 190`);
        arrow.setAttribute('pathLength', '1');
        arrow.classList.add('sk-drawn');
        tween(arrow, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], weightAt + delay, 0.5, EASE.inOut);
      }
      fx.fadeIn(arrows, weightAt, 0.1);
      fx.fadeIn(path(ground, 'sk-section-bearing sk-section-bearing--loaded is-staged', 'M138 208 H162 V276 H138 Z'), weightAt + 0.5, 0.3);
    }
    if (crackAt !== undefined) {
      const crack = path(node, 'sk-crack', 'M150 208 L145 222 L156 232 L147 246 L154 258 L149 272');
      crack.setAttribute('pathLength', '1');
      crack.classList.add('sk-drawn');
      tween(crack, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], crackAt, 0.25, EASE.out);
      dust(node, { x: 150, y: 206, at: crackAt });
      onFrame((t) => {
        const age = t - crackAt;
        const shudder = age > 0 && age < 0.9 && !reducedMotion.matches ? Math.sin(age * 46) * 2.2 * Math.exp(-age * 4) : 0;
        upper.setAttribute('transform', `translate(${shudder.toFixed(2)} ${Math.abs(shudder * 0.4).toFixed(2)})`);
      });
    }
    // The label plate goes on last, so the crack and dust run behind it.
    if (label) {
      const plate = svg('g', { class: 'sk-section-plate is-staged' }, node);
      svg('rect', { x: 92, y: 226, width: 116, height: 24, rx: 5 }, plate);
      const text = svg('text', { x: 150, y: 243 }, plate);
      text.textContent = label;
      fx.pop(plate, labelAt ?? at, { from: 0.5 });
    }
    return { node, wall };
  }

  /** A piece of furniture standing on the floor line at y, from x. */
  function furniture(parent, item, x, y) {
    const shapes = {
      sofa: `M${x} ${y} V${y - 18} H${x + 70} V${y} M${x + 6} ${y - 18} V${y - 30} H${x + 64} V${y - 18}`,
      bed: `M${x} ${y} V${y - 16} H${x + 76} V${y} M${x} ${y - 16} V${y - 34} M${x + 4} ${y - 22} H${x + 22} V${y - 16}`,
      desk: `M${x} ${y} V${y - 26} H${x + 60} V${y} M${x + 40} ${y - 26} V${y - 46} H${x + 58} V${y - 26}`,
      table: `M${x + 6} ${y} V${y - 22} M${x + 66} ${y} V${y - 22} M${x} ${y - 22} H${x + 72} M${x + 22} ${y - 22} V${y - 34} H${x + 36} V${y - 22}`,
    };
    path(parent, 'sk-furniture', shapes[item]);
  }

  /** Puffs of dust that spread and fall from (x, y) at `at`. */
  function dust(parent, { x, y, at, count = 10, spread = 70, fall = 46 }) {
    for (let i = 0; i < count; i++) {
      const puff = svg('circle', { class: 'sk-dust-puff is-staged', cx: x, cy: y, r: 3 + 4 * hash01(i * 13 + 5) }, parent);
      const dx = (hash01(i * 7 + 1) - 0.5) * spread;
      const dy = 10 + hash01(i * 11 + 3) * fall;
      tween(puff, [
        { opacity: 0, translate: '0 0', scale: 0.4 },
        { opacity: 0.85, translate: `${dx * 0.3}px ${dy * 0.2}px`, scale: 1, offset: 0.2 },
        { opacity: 0, translate: `${dx}px ${dy}px`, scale: 1.6 },
      ], at + i * 0.02, 1.1, EASE.out);
    }
  }

  // ------------------------------------------------------------------
  // Drafting tools: the pencil and the eraser
  // ------------------------------------------------------------------

  /** A pencil sprite (tip at its origin) in `layer`, pointing down-left. */
  function pencilSprite(layer) {
    const g = svg('g', { class: 'sk-pencil is-staged' }, layer);
    path(g, 'sk-pencil-body', 'M8 -8 L60 -60 L72 -48 L20 4 Z');
    path(g, 'sk-pencil-stripe', 'M14 -2 L66 -54');
    path(g, 'sk-pencil-ferrule', 'M60 -60 L66 -66 L78 -54 L72 -48 Z');
    path(g, 'sk-pencil-eraser', 'M66 -66 L72 -72 Q76 -76 80 -72 L84 -68 Q88 -64 84 -60 L78 -54 Z');
    path(g, 'sk-pencil-wood', 'M0 0 L8 -8 L20 4 Z');
    path(g, 'sk-pencil-lead', 'M0 0 L3 -3 L5 1 Z');
    return g;
  }

  /**
   * A pencil that rides along `route` (stage points) from `at` for
   * `duration`, as if it were drawing whatever draws in underneath.
   */
  function pencil(parent, { route, at, duration, until }) {
    const layer = art(parent, { x: 0, y: 0, w: 960, h: 540, viewBox: '0 0 960 540', className: 'sk-tool-layer' });
    fx.fadeIn(layer, at - 0.15, 0.15);
    const g = pencilSprite(layer);
    fx.fadeIn(g, at - 0.15, 0.15);
    fx.fadeOut(layer, until ?? at + duration + 0.2, 0.2);
    onFrame((t) => {
      const [px, py] = along(route, progress(t, at, duration));
      const wobble = reducedMotion.matches ? 0 : Math.sin(t * 30) * 1.5;
      g.setAttribute('transform', `translate(${px.toFixed(1)} ${(py + wobble).toFixed(1)})`);
    });
    return layer;
  }

  /**
   * An eraser that rubs back and forth over (x, y) from `at` for `duration`,
   * shedding crumbs.
   */
  function eraser(parent, { x, y, at, duration = 0.7, span = 60 }) {
    const layer = art(parent, { x: 0, y: 0, w: 960, h: 540, viewBox: '0 0 960 540', className: 'sk-tool-layer' });
    fx.fadeIn(layer, at - 0.12, 0.12);
    fx.fadeOut(layer, at + duration + 0.1, 0.2);
    const block = svg('g', { class: 'sk-eraser' }, layer);
    path(block, 'sk-eraser-body', 'M-24 -16 H24 Q30 -16 30 -10 V10 Q30 16 24 16 H-24 Q-30 16 -30 10 V-10 Q-30 -16 -24 -16 Z');
    path(block, 'sk-eraser-sleeve', 'M-10 -16 H30 Q30 -16 30 -10 V10 Q30 16 24 16 H-10 Z');
    onFrame((t) => {
      const u = progress(t, at, duration);
      const rub = reducedMotion.matches ? 0 : Math.sin(u * Math.PI * 7) * span / 2;
      block.setAttribute('transform', `translate(${(x + rub).toFixed(1)} ${(y - 8).toFixed(1)}) rotate(-14)`);
    });
    for (let i = 0; i < 9; i++) {
      const crumb = svg('circle', { class: 'sk-crumb is-staged', cx: x + (hash01(i * 5 + 2) - 0.5) * span, cy: y + 10, r: 1.6 + hash01(i * 3) * 1.6 }, layer);
      tween(crumb, [{ opacity: 0, translate: '0 0' }, { opacity: 1, translate: '0 4px', offset: 0.2 }, { opacity: 0, translate: `${(hash01(i) - 0.5) * 20}px 40px` }],
        at + (i / 9) * duration, 0.6, EASE.in);
    }
    return layer;
  }

  // ------------------------------------------------------------------
  // A floor plan whose layers can fade: walls, furniture, wiring, pipes
  // ------------------------------------------------------------------

  /**
   * A house's floor plan on paper at (x, y), w wide (400×260 units). Its
   * layers (furniture, wiring, pipes, sizes, labels) fade out at the times
   * in `hide`; `focus` = { layer, at } makes one layer glow.
   */
  function floorPlan(parent, { x, y, w = 420, at, until, hide = {}, focus }) {
    const node = art(parent, { x, y, w, h: w * 260 / 400, viewBox: '0 0 400 260', className: 'sk-plan' });
    svg('rect', { class: 'sk-plan-paper', x: 0, y: 0, width: 400, height: 260, rx: 8 }, node);
    const layers = {};
    const layer = (name) => (layers[name] = svg('g', { class: `sk-plan-${name}` }, node));
    const furniture = layer('furniture');
    path(furniture, 'sk-plan-item', [
      'M40 200 H120 V226 H40 Z M40 200 V192 H120 V200', // sofa
      'M60 40 H130 V96 H60 Z M60 52 H130 M66 44 H84 V50 H66 Z M104 44 H122 V50 H104 Z', // bed
      'M300 156 H372 V176 H300 Z M318 196 a14 14 0 1 0 0.1 0', // counter and table
      'M212 30 H262 V60 H212 Z M276 96 a10 12 0 1 0 0.1 0 M214 112 H236 V132 H214 Z', // bath, toilet, sink
    ]);
    const wiring = layer('wiring');
    path(wiring, 'sk-plan-wire', 'M30 150 H190 V230 M210 150 H370 V230 M30 130 V30 H190 M210 130 V30 H290');
    for (const [cx, cy] of [[110, 186], [290, 186], [96, 70], [250, 84]]) {
      path(wiring, 'sk-plan-light', `M${cx - 7} ${cy - 7} L${cx + 7} ${cy + 7} M${cx + 7} ${cy - 7} L${cx - 7} ${cy + 7} M${cx + 10} ${cy} a10 10 0 1 0 -20 0 a10 10 0 1 0 20 0`);
    }
    const pipes = layer('pipes');
    path(pipes, 'sk-plan-pipe', 'M392 250 H344 V176 M344 228 H232 V132 M232 200 V112 M232 120 H276 V96 M232 92 V60 H236');
    svg('circle', { class: 'sk-plan-valve', cx: 392, cy: 250, r: 6 }, pipes);
    const sizes = layer('sizes');
    path(sizes, 'sk-plan-size', 'M20 252 H380 M20 246 V258 M380 246 V258 M392 20 V240 M386 20 H398 M386 240 H398');
    const sizeText = (text, tx, ty, rotate = 0) => {
      const label = svg('text', { class: 'sk-plan-size-text', x: tx, y: ty, transform: rotate ? `rotate(${rotate} ${tx} ${ty})` : '' }, sizes);
      label.textContent = text;
    };
    sizeText('12 m', 200, 249);
    sizeText('8 m', 389, 130, -90);
    const labels = layer('labels');
    for (const [text, lx, ly] of [['Bedroom', 110, 124], ['Bath', 252, 124], ['Hall', 340, 124], ['Living', 110, 180], ['Kitchen', 250, 220]]) {
      const label = svg('text', { class: 'sk-plan-label', x: lx, y: ly }, labels);
      label.textContent = text;
    }
    const walls = svg('g', { class: 'sk-plan-walls' }, node);
    path(walls, 'sk-plan-wall', 'M20 20 H380 V240 H20 Z M200 20 V96 M200 116 V140 M20 140 H80 M104 140 H260 M284 140 H380 M300 20 V60 M300 84 V140');
    for (const [name, time] of Object.entries(hide)) tween(layers[name], { opacity: 0 }, time, 0.4, EASE.inOut);
    if (focus) {
      layers[focus.layer].classList.add('is-focus-ready');
      tween(layers[focus.layer], [{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], focus.at, 0.5, EASE.inOut);
      onFrame((t) => layers[focus.layer].classList.toggle('is-focus', t >= focus.at));
    }
    show(node, at, until, { from: 0.85 });
    return { node, layers };
  }

  // ------------------------------------------------------------------
  // A flaw on paper and a bug in shipped code
  // ------------------------------------------------------------------

  /**
   * A pencil sketch of a room on paper at (x, y), 300×220, whose door swings
   * into a wall. The flaw is circled at `flawAt`, rubbed out at `eraseAt`,
   * and redrawn the right way round with a check at `fixAt`.
   */
  function paperFlaw(parent, { x, y, at, flawAt, eraseAt, fixAt, until }) {
    const node = art(parent, { x, y, w: 300, h: 220, viewBox: '0 0 300 220', className: 'sk-paper-sketch' });
    svg('rect', { class: 'sk-sketch-paper', x: 0, y: 0, width: 300, height: 220, rx: 6 }, node);
    path(node, 'sk-sketch-line', 'M30 30 H270 V190 H30 Z M150 30 V110 M150 150 V190');
    path(node, 'sk-sketch-line sk-sketch-line--thin', 'M60 160 H110 V180 H60 Z M200 60 H250 V100 H200 Z');
    const bad = svg('g', { class: 'sk-flaw' }, node);
    path(bad, 'sk-sketch-line', 'M150 110 L196 92');
    path(bad, 'sk-sketch-line sk-sketch-line--thin', 'M150 150 A44 44 0 0 0 196 92');
    const ring = path(node, 'sk-flaw-ring is-staged', 'M140 98 a44 34 0 1 0 0.1 0');
    fx.pop(ring, flawAt, { from: 0.5 });
    fx.popOut(ring, eraseAt + 0.3);
    tween(bad, { opacity: 0 }, eraseAt + 0.25, 0.45, EASE.inOut);
    const good = svg('g', { class: 'sk-fixed' }, node);
    path(good, 'sk-sketch-line', 'M150 110 L106 96');
    path(good, 'sk-sketch-line sk-sketch-line--thin', 'M150 150 A44 44 0 0 1 106 96');
    fx.fadeIn(good, fixAt - 0.01, 0.01);
    drawIn(good, fixAt, 0.4);
    const check = svg('g', { class: 'sk-check-badge is-staged', transform: 'translate(262 34)' }, node);
    svg('circle', { r: 16 }, check);
    path(check, 'sk-check-badge-icon', 'M-7 0 L-2 5 L8 -6');
    fx.pop(check, fixAt + 0.2, { from: 0.4 });
    eraser(parent, { x: x + 174, y: y + 112, at: eraseAt, duration: 0.6, span: 56 });
    show(node, at, until, { from: 0.9, rotate: -1.5 });
    return node;
  }

  /** A crawling bug (a beetle seen from above) at (x, y); it wanders along `route`. */
  function bug(parent, { route, at, until, duration = 2.4, size = 34 }) {
    const node = art(parent, { x: 0, y: 0, w: 960, h: 540, viewBox: '0 0 960 540', className: 'sk-bug' });
    const g = svg('g', {}, node);
    const legs = path(g, 'sk-bug-legs', 'M-8 -6 L-16 -12 M-9 0 L-18 0 M-8 6 L-16 12 M8 -6 L16 -12 M9 0 L18 0 M8 6 L16 12');
    path(g, 'sk-bug-body', 'M0 -12 C8 -12 11 -4 11 4 C11 12 6 16 0 16 C-6 16 -11 12 -11 4 C-11 -4 -8 -12 0 -12 Z');
    path(g, 'sk-bug-line', 'M0 -10 V16');
    for (const [cx, cy] of [[-5, 2], [5, 6], [-4, 10], [5, -3]]) svg('circle', { class: 'sk-bug-spot', cx, cy, r: 2 }, g);
    path(g, 'sk-bug-head', 'M-6 -12 Q0 -20 6 -12 Z');
    path(g, 'sk-bug-feelers', 'M-3 -16 Q-8 -24 -12 -22 M3 -16 Q8 -24 12 -22');
    const scale = size / 34;
    onFrame((t) => {
      const u = progress(t, at, duration);
      const [px, py] = along(route, u);
      const [qx, qy] = along(route, Math.min(1, u + 0.02));
      const angle = (Math.atan2(qy - py, qx - px) * 180) / Math.PI + 90;
      g.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${scale})`);
      const step = reducedMotion.matches ? 0 : Math.sin(t * 28) * 0.18;
      legs.setAttribute('transform', `scale(1 ${(1 + step).toFixed(2)})`);
    });
    show(node, at, until, { from: 0.3 });
    return node;
  }

  // ------------------------------------------------------------------
  // The coding agent and test results
  // ------------------------------------------------------------------

  /**
   * A friendly coding-agent robot at (x, y), `size` px wide, typing on a
   * laptop from `typeAt` until `typeUntil`; its antenna light blinks while
   * it works and its screen face smiles.
   */
  function robot(parent, { x, y, size = 150, at, until, typeAt, typeUntil }) {
    const node = art(parent, { x, y, w: size, h: size * 1.05, viewBox: '0 0 140 147', className: 'sk-robot' });
    path(node, 'sk-robot-antenna', 'M70 22 V8');
    const bulb = svg('circle', { class: 'sk-robot-bulb', cx: 70, cy: 7, r: 5 }, node);
    path(node, 'sk-robot-neck', 'M60 80 H80 V86 H60 Z');
    path(node, 'sk-robot-body', 'M34 84 H106 Q114 84 114 92 V126 H26 V92 Q26 84 34 84 Z');
    path(node, 'sk-robot-shade sk-no-draw', 'M100 86 H106 Q112 86 112 92 V124 H100 Z');
    path(node, 'sk-robot-panel', 'M52 92 H88 V116 H52 Z');
    path(node, 'sk-robot-code sk-no-draw', 'M56 97 H70 M60 102 H82 M60 107 H76 M56 112 H66');
    svg('circle', { class: 'sk-robot-light', cx: 40, cy: 100, r: 3 }, node);
    svg('circle', { class: 'sk-robot-light sk-robot-light--gold', cx: 40, cy: 110, r: 3 }, node);
    for (const [cx, cy] of [[32, 90], [108, 90], [32, 120], [108, 120]]) svg('circle', { class: 'sk-robot-rivet sk-no-draw', cx, cy, r: 1.6 }, node);
    path(node, 'sk-robot-head', 'M36 22 H104 Q114 22 114 32 V70 Q114 80 104 80 H36 Q26 80 26 70 V32 Q26 22 36 22 Z');
    path(node, 'sk-robot-shade sk-no-draw', 'M104 24 Q112 24 112 32 V70 Q112 78 104 78 Z');
    path(node, 'sk-robot-face', 'M38 32 H102 V70 H38 Z');
    path(node, 'sk-robot-glint sk-no-draw', 'M42 36 H60 M42 36 V44');
    for (const [cx, cy] of [[31, 27], [109, 27], [31, 75], [109, 75]]) svg('circle', { class: 'sk-robot-rivet sk-no-draw', cx, cy, r: 1.6 }, node);
    const eyes = [52, 88].map((cx) => svg('ellipse', { class: 'sk-robot-eye', cx, cy: 48, rx: 6, ry: 7 }, node));
    for (const cx of [46, 94]) svg('ellipse', { class: 'sk-robot-cheek sk-no-draw', cx, cy: 60, rx: 4, ry: 2.4 }, node);
    path(node, 'sk-robot-smile', 'M56 59 Q70 68 84 59');
    for (const cx of [26, 114]) svg('circle', { class: 'sk-robot-ear', cx, cy: 51, r: 6 }, node);
    const arms = [
      path(node, 'sk-robot-arm', 'M26 96 Q12 104 22 124'),
      path(node, 'sk-robot-arm', 'M114 96 Q128 104 118 124'),
    ];
    for (const cx of [26, 114]) svg('circle', { class: 'sk-robot-joint sk-no-draw', cx, cy: 96, r: 3.5 }, node);
    path(node, 'sk-robot-laptop', 'M10 124 H130 L122 140 H18 Z');
    path(node, 'sk-robot-keys sk-no-draw', 'M22 129 H118 M20 133 H120 M38 129 V133 M54 129 V133 M70 129 V133 M86 129 V133 M102 129 V133 M56 136 H84');
    onFrame((t) => {
      const typing = t >= typeAt && t < typeUntil && !reducedMotion.matches;
      arms.forEach((arm, i) => arm.setAttribute('transform', typing ? `translate(0 ${(Math.sin(t * 18 + i * Math.PI) * 3).toFixed(1)})` : ''));
      bulb.classList.toggle('is-lit', t >= typeAt && t < typeUntil && (reducedMotion.matches || Math.sin(t * 6) > -0.2));
      const blink = blinkAt(t, 9);
      eyes.forEach((eye) => eye.setAttribute('ry', blink ? '1' : '7'));
    });
    show(node, at, until, { from: 0.7 });
    return node;
  }

  // ------------------------------------------------------------------
  // Class diagram companions: a padlock and a contract
  // ------------------------------------------------------------------

  /** A padlock `size` px tall at (x, y) that snaps shut at `lockAt`. */
  function padlock(parent, { x, y, size = 56, at, until, lockAt = at }) {
    const node = art(parent, { x, y, w: size * 0.8, h: size, viewBox: '0 0 80 100', className: 'sk-padlock' });
    const shackle = path(node, 'sk-padlock-shackle', 'M20 46 V30 Q20 10 40 10 Q60 10 60 30 V46');
    path(node, 'sk-padlock-body', 'M10 44 H70 Q76 44 76 50 V90 Q76 96 70 96 H10 Q4 96 4 90 V50 Q4 44 10 44 Z');
    path(node, 'sk-padlock-shine sk-no-draw', 'M12 52 V86');
    path(node, 'sk-padlock-plate', 'M28 56 H52 Q56 56 56 60 V84 Q56 88 52 88 H28 Q24 88 24 84 V60 Q24 56 28 56 Z');
    path(node, 'sk-padlock-hole', 'M40 62 a6 6 0 1 0 0.1 0 M40 72 V82');
    tween(shackle, [{ translate: '0 -12px' }, { translate: '0 0' }], lockAt, 0.2, EASE.in);
    show(node, at, until, { from: 0.5 });
    return node;
  }

  /**
   * A contract on parchment at (x, y): a title, the operations it promises,
   * and a line where each implementation signs: signatures = [{ at, name }].
   */
  function contract(parent, { x, y, w = 240, title, lines, signatures = [], at, until }) {
    const node = place(el('div', 'sk-contract is-staged', parent), x, y);
    node.style.width = `${w}px`;
    el('div', 'sk-contract-title', node, title);
    const terms = el('ul', 'sk-contract-terms', node);
    for (const text of lines) el('li', null, terms, text);
    const signed = el('div', 'sk-contract-signatures', node);
    for (const signature of signatures) {
      const row = el('div', 'sk-contract-signature is-staged', signed);
      row.append(kit.icon('check'));
      el('span', null, row, signature.name);
      fx.rise(row, signature.at, { distance: 6, duration: 0.25 });
    }
    fx.pop(node, at, { from: 0.8, rotate: -2 });
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  // ------------------------------------------------------------------
  // Relationships: three questions, a car, a house, a list and a shelf
  // ------------------------------------------------------------------

  /**
   * The three questions that pick a relationship: items = [{ text, at,
   * answer, answerAt }]. Each question rises when it is sung and stays lit
   * until the next one; its answer pill pops in beside it.
   */
  function questions(parent, { x, y, w = 400, title, titleAt, items, until }) {
    const node = place(el('div', 'sk-questions is-staged', parent), x, y);
    node.style.width = `${w}px`;
    el('div', 'sk-questions-title', node, title);
    items.forEach((item, i) => {
      const row = el('div', 'sk-questions-row is-staged', node);
      el('span', 'sk-questions-number', row, String(i + 1));
      const body = el('div', 'sk-questions-body', row);
      el('div', 'sk-questions-text', body, item.text);
      const answer = el('span', 'sk-questions-answer is-staged', body, item.answer);
      fx.rise(row, item.at, { distance: 8, duration: 0.25 });
      fx.pop(answer, item.answerAt, { from: 0.5 });
      const next = items[i + 1];
      onFrame((t) => row.classList.toggle('is-current', t >= item.at && (!next || t < next.at)));
    });
    fx.rise(node, titleAt, { distance: 14, duration: 0.3 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /**
   * A car at (x, y), w wide. At `wheelsOffAt` its wheels come off and roll
   * away; they are still wheels without the car.
   */
  function car(parent, { x, y, w = 240, at, until, wheelsOffAt }) {
    const node = art(parent, { x, y, w, h: w * 0.5, viewBox: '0 0 240 120', className: 'sk-car' });
    path(node, 'sk-car-shadow sk-no-draw', 'M24 106 H216');
    path(node, 'sk-car-body', 'M16 82 L20 62 Q22 54 36 52 L66 48 L88 28 Q96 20 110 20 H156 Q170 20 182 32 L200 50 Q218 52 222 64 L224 82 Q224 90 216 90 H24 Q16 90 16 82 Z');
    path(node, 'sk-car-window', 'M94 32 Q98 28 108 28 H130 V48 H76 Z M138 28 H156 Q164 28 172 36 L184 48 H138 Z');
    path(node, 'sk-car-glint sk-no-draw', 'M100 44 L112 32 M146 44 L156 34');
    path(node, 'sk-car-trim sk-no-draw', 'M134 52 V84 M78 52 Q74 70 80 86 M188 52 Q194 70 190 86 M28 70 H40 M204 70 H218');
    path(node, 'sk-car-handle sk-no-draw', 'M112 60 H122 M146 60 H156');
    path(node, 'sk-car-mirror', 'M80 46 H72 Q68 46 68 50 Q68 54 72 54 H80 Z');
    path(node, 'sk-car-bumper', 'M14 80 H26 V88 H18 Q14 88 14 84 Z M214 80 H226 V84 Q226 88 222 88 H214 Z');
    svg('circle', { class: 'sk-car-light sk-car-light--rear sk-no-draw', cx: 22, cy: 64, r: 3.5 }, node);
    svg('circle', { class: 'sk-car-light sk-no-draw', cx: 214, cy: 62, r: 4 }, node);
    const wheels = [62, 180].map((cx) => {
      const g = svg('g', { class: 'sk-car-wheel' }, node);
      svg('circle', { class: 'sk-car-tyre', cx: 0, cy: 0, r: 19 }, g);
      svg('circle', { class: 'sk-car-rim', cx: 0, cy: 0, r: 10 }, g);
      path(g, 'sk-car-spokes', 'M0 -10 V10 M-10 0 H10 M-7 -7 L7 7 M7 -7 L-7 7');
      svg('circle', { class: 'sk-car-hub', cx: 0, cy: 0, r: 3.5 }, g);
      return { g, cx };
    });
    onFrame((t) => {
      wheels.forEach(({ g, cx }, i) => {
        const u = wheelsOffAt === undefined ? 0 : easeInOutCubic(progress(t, wheelsOffAt + i * 0.1, 0.8));
        const dx = u * (i ? 70 : -70);
        g.setAttribute('transform', `translate(${(cx + dx).toFixed(1)} ${(90 + 8 * u).toFixed(1)}) rotate(${(dx * 3).toFixed(1)})`);
      });
    });
    show(node, at, until, { from: 0.8 });
    return node;
  }

  /**
   * A house cut open to show its rooms at (x, y), w wide. At `demolishAt`
   * the walls fall and every room crumbles with them: the parts go with the
   * whole.
   */
  function roomyHouse(parent, { x, y, w = 240, at, until, demolishAt }) {
    const node = art(parent, { x, y, w, h: w * 0.9, viewBox: '0 0 240 216', className: 'sk-roomy-house' });
    const shell = svg('g', { class: 'sk-roomy-shell' }, node);
    path(shell, 'sk-roomy-chimney', 'M170 22 H188 V52 L170 42 Z');
    path(shell, 'sk-roomy-roof', 'M10 76 L120 12 L230 76 Z');
    path(shell, 'sk-roomy-tiles sk-no-draw', 'M44 56 H196 M66 43 H174 M88 30 H152');
    path(shell, 'sk-roomy-walls', 'M24 76 H216 V204 H24 Z');
    path(shell, 'sk-roomy-slab sk-no-draw', 'M24 141 H216');
    const rooms = [
      [28, 80, 'Bedroom', 'M44 128 H96 V112 H44 Z M44 112 V104'],
      [122, 80, 'Bath', 'M140 124 H196 V108 H140 Z'],
      [28, 144, 'Living', 'M42 196 V182 H100 V196 M48 182 V172 H94 V182'],
      [122, 144, 'Kitchen', 'M140 196 V170 H200 V196 M150 170 V160 H164 V170'],
    ].map(([rx, ry, name, item], i) => {
      const g = svg('g', { class: 'sk-roomy-room' }, node);
      svg('rect', { class: 'sk-roomy-room-fill', x: rx, y: ry, width: 90, height: 58, rx: 3 }, g);
      path(g, 'sk-roomy-item', item);
      const label = svg('text', { class: 'sk-roomy-label', x: rx + 45, y: ry + 16 }, g);
      label.textContent = name;
      return { g, i };
    });
    if (demolishAt !== undefined) {
      tween(shell, [{ translate: '0 0', rotate: '0deg', opacity: 1 }, { translate: '0 40px', rotate: '-6deg', opacity: 0 }], demolishAt, 0.6, EASE.in);
      rooms.forEach(({ g, i }) => {
        tween(g, [{ translate: '0 0', rotate: '0deg', opacity: 1 }, { translate: `${(i % 2 ? 1 : -1) * 14}px 70px`, rotate: `${(i % 2 ? 1 : -1) * 18}deg`, opacity: 0 }],
          demolishAt + 0.5 + i * 0.08, 0.6, EASE.in);
      });
      dust(node, { x: 120, y: 200, at: demolishAt + 0.4, count: 14, spread: 220, fall: 20 });
    }
    show(node, at, until, { from: 0.8 });
    return node;
  }

  /** A clipboard reading list at (x, y) with one row per entry; rows = [title]. */
  function readingList(parent, { x, y, w = 220, rows, at, until, goneAt }) {
    const node = place(el('div', 'sk-clipboard is-staged', parent), x, y);
    node.style.width = `${w}px`;
    el('div', 'sk-clipboard-clip', node);
    el('div', 'sk-clipboard-title', node, 'Reading list');
    const rowNodes = rows.map((title) => {
      const row = el('div', 'sk-clipboard-row', node);
      el('span', 'sk-clipboard-box', row);
      el('span', null, row, title);
      return row;
    });
    show(node, at, undefined, { from: 0.8, rotate: -2 });
    if (goneAt !== undefined) {
      rowNodes.forEach((row, i) => tween(row, { opacity: 0, translate: '0 18px' }, goneAt + 0.15 + i * 0.08, 0.3, EASE.in));
      tween(node, { opacity: 0, translate: '0 30px', rotate: '-8deg' }, goneAt + 0.5, 0.45, EASE.in);
    } else if (until !== undefined) {
      fx.popOut(node, until);
    }
    return { node, rows: rowNodes };
  }

  /**
   * A wall shelf of books, drawn `w` px wide at (x, y): a wooden board on
   * two brackets, a bookend, and books = [{ title: [line, …], tone, w, h }]
   * standing on it. From `keepAt` every
   * book glows: it stays on the shelf. Returns each book's stage box, so
   * arrows can point at a spine.
   */
  function bookshelf(parent, { x, y, w = 300, books, at, until, keepAt }) {
    const k = w / 300;
    const node = art(parent, { x, y, w, h: 190 * k, viewBox: '0 0 300 190', className: 'sk-shelf' });
    path(node, 'sk-shelf-bracket', 'M40 172 V184 L58 172 Z M242 172 V184 L260 172 Z');
    path(node, 'sk-shelf-shadow sk-no-draw', 'M14 158 H286');
    let left = 18;
    const spines = books.map((book) => {
      const g = svg('g', { class: `sk-book sk-book--${book.tone}` }, node);
      const top = 160 - book.h;
      path(g, 'sk-book-pages', `M${left + 3} ${top - 3} H${left + book.w - 1} V${top + 4} H${left + 3} Z`);
      path(g, 'sk-book-spine', `M${left} ${top + 3} Q${left} ${top} ${left + 3} ${top} H${left + book.w - 3} Q${left + book.w} ${top} ${left + book.w} ${top + 3} V160 H${left} Z`);
      path(g, 'sk-book-shade sk-no-draw', `M${left + book.w - 6} ${top + 1} H${left + book.w - 1} V159 H${left + book.w - 6} Z`);
      path(g, 'sk-book-band sk-no-draw', `M${left + 2} ${top + 12} H${left + book.w - 2} M${left + 2} ${top + 16} H${left + book.w - 2} M${left + 2} 146 H${left + book.w - 2}`);
      const cx = left + book.w / 2;
      const cy = top + (book.h + 4) / 2;
      const lines = book.title;
      lines.forEach((text, n) => {
        const offset = (n - (lines.length - 1) / 2) * 17;
        const label = svg('text', { class: 'sk-book-title', x: cx + offset, y: cy, transform: `rotate(-90 ${cx + offset} ${cy})` }, g);
        label.textContent = text;
      });
      const box = { x: x + left * k, y: y + top * k, w: book.w * k, h: book.h * k };
      left += book.w + 3;
      return { node: g, box };
    });
    path(node, 'sk-shelf-bookend', `M${left + 4} 160 V104 H${left + 10} V160 Z M${left + 4} 160 H${left + 26}`);
    path(node, 'sk-shelf-board', 'M8 160 H292 V172 H8 Z');
    path(node, 'sk-shelf-edge sk-no-draw', 'M8 162 H292');
    path(node, 'sk-shelf-grain sk-no-draw', 'M30 166 Q90 164 150 167 T270 166 M60 169 Q120 168 190 170');
    if (keepAt !== undefined) onFrame((t) => spines.forEach((spine) => spine.node.classList.toggle('is-kept', t >= keepAt)));
    show(node, at, until, { from: 0.85 });
    return { node, spines };
  }

  // ------------------------------------------------------------------
  // Sequence diagram companions: time, waiting, not waiting
  // ------------------------------------------------------------------

  /** A downward arrow labelled "time", h px tall, drawn in at `at`. */
  function timeArrow(parent, { x, y, h = 260, at, until }) {
    const node = art(parent, { x: x - 30, y, w: 60, h: h + 10, viewBox: `0 0 60 ${h + 10}`, className: 'sk-time' });
    const shaft = path(node, 'sk-time-shaft', `M30 4 V${h} M20 ${h - 12} L30 ${h + 2} L40 ${h - 12}`);
    shaft.setAttribute('pathLength', '1');
    shaft.classList.add('sk-drawn');
    tween(shaft, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], at, 0.6, EASE.inOut);
    const label = svg('text', { class: 'sk-time-label', x: 18, y: h / 2, transform: `rotate(-90 18 ${h / 2})` }, node);
    label.textContent = 'time';
    fx.fadeIn(node, at, 0.1);
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /**
   * An hourglass `size` px tall at (x, y) whose sand runs from `at` until
   * `until` (the wait), when it gets a check.
   */
  function hourglass(parent, { x, y, size = 64, at, until, doneAt = until, hideAt }) {
    const node = art(parent, { x, y, w: size * 0.7, h: size, viewBox: '0 0 70 100', className: 'sk-hourglass' });
    path(node, 'sk-hourglass-post', 'M9 9 V91 M61 9 V91');
    path(node, 'sk-hourglass-glass', 'M14 8 C14 36 32 42 32 50 C32 58 14 64 14 92 H56 C56 64 38 58 38 50 C38 42 56 36 56 8 Z');
    path(node, 'sk-hourglass-glint', 'M19 14 C19 30 26 38 29 44');
    path(node, 'sk-hourglass-cap', 'M4 2 H66 V9 H4 Z M4 91 H66 V98 H4 Z');
    path(node, 'sk-hourglass-grain', 'M10 5 H30 M38 6 H58 M12 94 H34 M42 95 H60');
    const top = path(node, 'sk-hourglass-sand', 'M18 14 H52 C52 34 37 42 35 48 C33 42 18 34 18 14 Z');
    const bottom = path(node, 'sk-hourglass-sand', 'M18 90 C20 72 30 66 35 64 C40 66 50 72 52 90 Z');
    const stream = path(node, 'sk-hourglass-stream', 'M35 48 V88');
    onFrame((t) => {
      const u = progress(t, at, Math.max(0.1, doneAt - at));
      top.setAttribute('transform', `translate(35 48) scale(${(1 - u * 0.85).toFixed(3)}) translate(-35 -48)`);
      bottom.setAttribute('transform', `translate(35 90) scale(${(0.15 + u * 0.85).toFixed(3)}) translate(-35 -90)`);
      stream.classList.toggle('is-running', u > 0 && u < 1);
    });
    show(node, at, hideAt, { from: 0.5 });
    return node;
  }

  /** A paper plane that flies along `route` (stage points) from `at`. */
  function paperPlane(parent, { route, at, duration = 0.8, until }) {
    const layer = art(parent, { x: 0, y: 0, w: 960, h: 540, viewBox: '0 0 960 540', className: 'sk-tool-layer' });
    const g = svg('g', { class: 'sk-plane' }, layer);
    path(g, 'sk-plane-wing', 'M14 0 L-12 -11 L-6 0 Z');
    path(g, 'sk-plane-fold', 'M14 0 L-12 9 L-6 0 Z');
    fx.fadeIn(layer, at, 0.1);
    fx.fadeOut(layer, until ?? at + duration + 0.4, 0.2);
    onFrame((t) => {
      const u = easeInOutCubic(progress(t, at, duration));
      const [px, py] = along(route, u);
      const [qx, qy] = along(route, Math.min(1, u + 0.01));
      const angle = Math.atan2(qy - py, qx - px) * 180 / Math.PI;
      const bob = reducedMotion.matches ? 0 : Math.sin(t * 14) * 2;
      g.setAttribute('transform', `translate(${px.toFixed(1)} ${(py - 8 + bob).toFixed(1)}) rotate(${angle.toFixed(1)}) scale(1.4)`);
    });
    return layer;
  }

  // ------------------------------------------------------------------
  // State machine companions: the library book, a label's parts, a fee
  // ------------------------------------------------------------------

  /**
   * Library book copy #42 at (x, y), standing upright, with a status tag on
   * a string: states = [{ at, text, tone }] relabel the tag; at `dueAt` a
   * due-date slip sticks out of the pages.
   */
  function libraryBook(parent, { x, y, size = 150, at, until, states, dueAt, dueText }) {
    const node = place(el('div', 'sk-library-book is-staged', parent), x, y);
    node.style.width = `${size}px`;
    const drawing = svg('svg', { class: 'sk-library-book-art', viewBox: '0 0 120 150', width: size, height: size * 1.25, 'aria-hidden': 'true' }, node);
    path(drawing, 'sk-lb-ribbon', 'M78 132 V148 L82 144 L86 148 V132 Z');
    path(drawing, 'sk-lb-pages', 'M22 14 H100 Q106 14 106 20 V132 Q106 138 100 138 H22 Z');
    path(drawing, 'sk-lb-page-edges sk-no-draw', 'M100 22 V130 M103 26 V126');
    path(drawing, 'sk-lb-cover', 'M14 10 H92 Q98 10 98 16 V128 Q98 134 92 134 H14 Q8 134 8 128 V16 Q8 10 14 10 Z');
    path(drawing, 'sk-lb-cloth sk-no-draw', 'M30 24 L46 12 M30 44 L62 18 M30 64 L82 20 M34 80 L94 32 M50 88 L96 50 M66 96 L96 72 M30 104 L48 90 M30 124 L54 104 M60 128 L96 98');
    path(drawing, 'sk-lb-corner sk-no-draw', 'M84 10 H92 Q98 10 98 16 V24 Z M84 134 H92 Q98 134 98 128 V120 Z');
    path(drawing, 'sk-lb-spine', 'M8 16 V128 Q8 134 14 134 H24 V10 H14 Q8 10 8 16 Z');
    path(drawing, 'sk-lb-ridges sk-no-draw', 'M10 22 H22 M10 26 H22 M10 118 H22 M10 122 H22');
    path(drawing, 'sk-lb-band sk-no-draw', 'M24 30 H98 M24 112 H98');
    path(drawing, 'sk-lb-plate', 'M38 58 H86 Q90 58 90 62 V86 Q90 90 86 90 H38 Q34 90 34 86 V62 Q34 58 38 58 Z');
    path(drawing, 'sk-lb-sticker', 'M40 98 H82 V108 H40 Z');
    path(drawing, 'sk-lb-barcode sk-no-draw', 'M44 100 V106 M46.5 100 V106 M50 100 V106 M52 100 V106 M55.5 100 V106 M59 100 V106 M61 100 V106 M64.5 100 V106 M67 100 V106 M70.5 100 V106 M74 100 V106 M77 100 V106');
    const label = svg('text', { class: 'sk-lb-number', x: 62, y: 81 }, drawing);
    label.textContent = '#42';
    if (dueAt !== undefined) {
      const slip = svg('g', { class: 'sk-lb-slip is-staged' }, drawing);
      path(slip, 'sk-lb-slip-paper', 'M70 -6 H112 V34 H70 Z');
      const due = svg('text', { class: 'sk-lb-slip-text', x: 91, y: 12 }, slip);
      due.textContent = 'DUE';
      const day = svg('text', { class: 'sk-lb-slip-text sk-lb-slip-text--big', x: 91, y: 28 }, slip);
      day.textContent = dueText;
      tween(slip, [{ opacity: 0, translate: '0 20px' }, { opacity: 1, translate: '0 0' }], dueAt, 0.3, EASE.back);
    }
    const tag = el('div', 'sk-lb-tag', node);
    const sorted = [...states].sort((a, b) => a.at - b.at);
    let shown = '';
    onFrame((t) => {
      const state = latest(sorted, t) || sorted[0];
      if (state.text === shown) return;
      shown = state.text;
      tag.textContent = state.text;
      tag.className = `sk-lb-tag sk-lb-tag--${state.tone}`;
    });
    sorted.slice(1).forEach((state) => fx.bump(tag, state.at, 0.18));
    show(node, at, until, { from: 0.8 });
    return node;
  }

  /**
   * A transition label taken apart: parts = [{ text, meaning, at, tone }],
   * each lit when it is sung (its notation above, its meaning below).
   */
  function labelParts(parent, { x, y, parts, at, until }) {
    const node = place(el('div', 'sk-label-parts is-staged', parent), x, y);
    for (const part of parts) {
      const cell = el('div', `sk-label-part sk-label-part--${part.tone} is-staged`, node);
      el('code', null, cell, part.text);
      el('span', null, cell, part.meaning);
      fx.pop(cell, part.at, { from: 0.6 });
    }
    fx.rise(node, at, { distance: 10, duration: 0.3 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /** A coin that flips up at (x, y): the late fee. */
  function coin(parent, { x, y, at, until, text = 'fee' }) {
    const node = art(parent, { x, y, w: 64, h: 64, viewBox: '0 0 64 64', className: 'sk-coin' });
    svg('circle', { class: 'sk-coin-face', cx: 32, cy: 32, r: 27 }, node);
    svg('circle', { class: 'sk-coin-rim', cx: 32, cy: 32, r: 21 }, node);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      svg('circle', { class: 'sk-coin-dot', cx: 32 + 24 * Math.cos(a), cy: 32 + 24 * Math.sin(a), r: 1.1 }, node);
    }
    svg('path', { class: 'sk-coin-shine', d: 'M18 22 Q22 14 30 12' }, node);
    const label = svg('text', { class: 'sk-coin-text', x: 32, y: 38 }, node);
    label.textContent = text;
    tween(node, [
      { opacity: 0, translate: '0 30px', rotate: '0deg' },
      { opacity: 1, translate: '0 -18px', rotate: '200deg', offset: 0.6 },
      { opacity: 1, translate: '0 0', rotate: '360deg' },
    ], at, 0.7, EASE.out);
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  /**
   * A plain function as a machine at (x, y): each call's input slides in
   * and its output follows, the same every time. runs = [{ at, input, output }].
   */
  function functionMachine(parent, { x, y, name, runs, at, until }) {
    const node = place(el('div', 'sk-machine is-staged', parent), x, y);
    el('div', 'sk-machine-name', node, name);
    // One row per call, and every call stays in its row, so identical
    // calls end up side by side where they can be compared.
    runs.forEach((run) => {
      const row = el('div', 'sk-machine-io', node);
      const input = el('span', 'sk-machine-in is-staged', row, run.input);
      const arrow = el('span', 'sk-machine-arrow is-staged', row, '→');
      const output = el('span', 'sk-machine-out is-staged', row, run.output);
      tween(input, [{ opacity: 0, translate: '-60px 0' }, { opacity: 1, translate: '0 0' }], run.at, 0.35, EASE.out);
      fx.fadeIn(arrow, run.at + 0.35, 0.2);
      tween(output, [{ opacity: 0, translate: '-30px 0' }, { opacity: 1, translate: '0 0' }], run.at + 0.55, 0.3, EASE.out);
    });
    show(node, at, until, { from: 0.8 });
    return node;
  }

  // ------------------------------------------------------------------
  // Component diagram companion: a ball that snaps into a socket
  // ------------------------------------------------------------------

  /**
   * Two components at (x, y), w wide: the left one needs a service (a
   * socket), the right one provides it (a ball on a stick). They start
   * apart and slide together at `snapAt`, when the ball clicks into the
   * socket. labels = { left, right, leftAt, rightAt }.
   */
  function plug(parent, { x, y, w = 420, at, until, snapAt, labels }) {
    const node = art(parent, { x, y, w, h: w * 0.36, viewBox: '0 0 420 150', className: 'sk-plug' });
    const left = svg('g', {}, node);
    path(left, 'sk-plug-box', 'M10 30 H130 Q140 30 140 40 V110 Q140 120 130 120 H10 Z');
    path(left, 'sk-plug-icon', 'M100 44 H122 V60 H100 Z M96 48 H104 M96 56 H104');
    path(left, 'sk-plug-stick', 'M140 75 H168');
    path(left, 'sk-plug-socket', 'M188 55 A20 20 0 0 0 188 95');
    const right = svg('g', {}, node);
    path(right, 'sk-plug-box', 'M290 30 H410 V120 H290 Q280 120 280 110 V40 Q280 30 290 30 Z');
    path(right, 'sk-plug-icon', 'M380 44 H402 V60 H380 Z M376 48 H384 M376 56 H384');
    path(right, 'sk-plug-stick', 'M280 75 H222');
    svg('circle', { class: 'sk-plug-ball', cx: 208, cy: 75, r: 13 }, right);
    const spark = path(node, 'sk-plug-spark is-staged', 'M200 40 L196 26 M216 40 L222 27 M232 52 L246 46 M232 98 L246 104 M216 110 L222 123 M200 110 L196 124');
    onFrame((t) => {
      const u = easeInOutCubic(progress(t, snapAt - 0.35, 0.35));
      left.setAttribute('transform', `translate(${(-48 * (1 - u)).toFixed(1)} 0)`);
      right.setAttribute('transform', `translate(${(48 * (1 - u)).toFixed(1)} 0)`);
    });
    tween(spark, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], snapAt, 0.5, EASE.out);
    for (const [side, text, time] of [['left', labels.left, labels.leftAt], ['right', labels.right, labels.rightAt]]) {
      const label = svg('text', { class: 'sk-plug-label is-staged', x: side === 'left' ? 75 : 345, y: 144 }, node);
      label.textContent = text;
      fx.fadeIn(label, time, 0.25);
    }
    show(node, at, until, { from: 0.85 });
    return node;
  }

  /** A question card with a "?" badge: what a diagram is drawn to answer. */
  function question(parent, text, { x, y, w, at, until }) {
    const node = place(el('div', 'sk-question is-staged', parent), x, y);
    if (w) node.style.width = `${w}px`;
    el('span', 'sk-question-mark', node, '?');
    el('span', 'sk-question-text', node, text);
    fx.rise(node, at, { distance: 12, duration: 0.3 });
    if (until !== undefined) fx.fadeOut(node, until, 0.2);
    return node;
  }

  /** A results card: rows = [{ text, at, ok }] each gets a check or a cross. */
  function checklist(parent, { x, y, w = 280, title, rows, at, until }) {
    const node = place(el('div', 'sk-checklist is-staged', parent), x, y);
    node.style.width = `${w}px`;
    if (title) el('div', 'sk-checklist-title', node, title);
    const rowNodes = rows.map((row) => {
      const item = el('div', `sk-checklist-row sk-checklist-row--${row.ok ? 'pass' : 'fail'} is-staged`, node);
      item.append(kit.icon(row.ok ? 'check' : 'cross'));
      el('span', null, item, row.text);
      fx.rise(item, row.at, { distance: 8, duration: 0.25 });
      return item;
    });
    fx.rise(node, at, { distance: 14, duration: 0.3 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return { node, rows: rowNodes };
  }

  window.SketchKit = {
    teammate, thought, whiteboard,
    speech, sticky, calendar, device, network, section, pencil, eraser,
    floorPlan, paperFlaw, bug, robot, padlock, contract, questions, car, roomyHouse, readingList, bookshelf,
    timeArrow, hourglass, paperPlane, libraryBook, labelParts, coin, functionMachine, plug,
    question, checklist,
  };
})();
