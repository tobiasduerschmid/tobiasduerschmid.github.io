/*
 * Illustrations for the Test-Driven Development video narration
 * (window.TddArt), placed and animated by tdd-kit.js (art, spot, and the
 * terminal's signal light) and styled by css/video-narration-tdd-art.css.
 *
 * Each function draws one finished picture: art(parent, options) appends
 * one <svg class="ta-art ta-NAME"> to `parent`, which the caller sizes to
 * the art's viewBox, and returns it. Paint is by class only (fixed colors,
 * the same in both modes; only cast shadows follow the mode). States are
 * classes on the root (is-..., has-...), each a still pose, so the seekable
 * timeline can show any moment; moving parts are groups with a CSS pivot.
 * There is no text in the art (labels are HTML beside it), and no ids,
 * gradients, filters, or clip paths, because the notes page copies the
 * stage many times. Every shape of one paint in one part is one path.
 *
 * Each rule has one metaphor, reused wherever the rule acts: a target
 * painted around the arrow (test first), a smoke alarm and its test button
 * (watch it fail), checkpoints in a game, a gear shifter, and training
 * wheels (smallest step), and two hats (refactor on green).
 */

// ------------------------------------------------------------------
// The dinner, the money, and the example's moves
// ------------------------------------------------------------------

/* Illustrations for the TDD narration's story: the ramen dinner, the cents,
 * the split machine, and the small spots for the example's moves. Each
 * function appends one <svg class="ta-art ta-..."> to its parent. */
(function () {
  'use strict';

  const { svg } = window.SongKit;
  const { shape } = window.ArchKit;
  const art = (window.TddArt = window.TddArt || {});

  // ---------------------------------------------------------------- path helpers

  const num = (value) => shape.round(value);
  const pt = (x, y) => `${num(x)} ${num(y)}`;
  const rad = (degrees) => (degrees * Math.PI) / 180;

  /** Polygon (or open polyline) through [x, y] points. */
  function poly(points, closed = true) {
    return `M${points.map(([x, y]) => pt(x, y)).join(' L')}${closed ? ' Z' : ''}`;
  }

  /** Straight line segment. */
  const line = (x1, y1, x2, y2) => `M${pt(x1, y1)} L${pt(x2, y2)}`;

  /** Ellipse as two absolute arcs, optionally rotated by `rot` degrees. */
  function ellipse(cx, cy, rx, ry, rot = 0) {
    const dx = rx * Math.cos(rad(rot));
    const dy = rx * Math.sin(rad(rot));
    const arcTo = (x, y) => `A${num(rx)} ${num(ry)} ${num(rot)} 1 0 ${pt(x, y)}`;
    return `M${pt(cx - dx, cy - dy)} ${arcTo(cx + dx, cy + dy)} ${arcTo(cx - dx, cy - dy)} Z`;
  }

  const circle = (cx, cy, r) => ellipse(cx, cy, r, r);

  /** Open arc from angle a0 to a1 (degrees; 0 = east, 90 = south, so growing angles turn clockwise). */
  function arc(cx, cy, rx, a0, a1, ry = rx) {
    const at = (a) => pt(cx + rx * Math.cos(rad(a)), cy + ry * Math.sin(rad(a)));
    return `M${at(a0)} A${num(rx)} ${num(ry)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${at(a1)}`;
  }

  /** Rectangle with rounded corners. */
  function roundRect(x, y, w, h, r) {
    const a = `A${num(r)} ${num(r)} 0 0 1`;
    return `M${pt(x + r, y)} L${pt(x + w - r, y)} ${a} ${pt(x + w, y + r)} L${pt(x + w, y + h - r)} ${a} ${pt(x + w - r, y + h)} ` +
      `L${pt(x + r, y + h)} ${a} ${pt(x, y + h - r)} L${pt(x, y + r)} ${a} ${pt(x + r, y)} Z`;
  }

  /** Smooth (Catmull-Rom) curve through points. */
  function smooth(points, closed = true) {
    const count = points.length;
    const at = (i) => (closed ? points[(i + count) % count] : points[Math.max(0, Math.min(count - 1, i))]);
    let d = `M${pt(...points[0])}`;
    for (let i = 0; i < (closed ? count : count - 1); i++) {
      const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      d += ` C${pt(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)} ` +
        `${pt(p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)} ${pt(p2[0], p2[1])}`;
    }
    return d + (closed ? ' Z' : '');
  }

  /**
   * The part of the circle (cx, cy, r) that a copy shifted by (dx, dy) does
   * not cover: a crescent on the side away from the shift. Used for the shade
   * side of round things and for a rim's shadow inside a bowl.
   */
  function crescent(cx, cy, r, dx, dy) {
    const dist = Math.hypot(dx, dy);
    const phi = Math.atan2(dy, dx);
    const theta = Math.acos(dist / (2 * r));
    const p1 = [cx + r * Math.cos(phi + theta), cy + r * Math.sin(phi + theta)];
    const p2 = [cx + r * Math.cos(phi - theta), cy + r * Math.sin(phi - theta)];
    return `M${pt(...p1)} A${num(r)} ${num(r)} 0 1 1 ${pt(...p2)} A${num(r)} ${num(r)} 0 0 0 ${pt(...p1)} Z`;
  }

  /** Moves absolute path data (M L C Q A Z): scale, then rotate by `rot` degrees, then translate. */
  function place(d, tx, ty, rot = 0, scale = 1) {
    const cos = Math.cos(rad(rot));
    const sin = Math.sin(rad(rot));
    const move = (x, y) => pt(tx + scale * (x * cos - y * sin), ty + scale * (x * sin + y * cos));
    const tokens = d.match(/[MLCQAZ]|-?[\d.]+(?:e-?\d+)?/g);
    const pairs = { M: 1, L: 1, Q: 2, C: 3 };
    let out = '';
    let i = 0;
    while (i < tokens.length) {
      const command = tokens[i++];
      if (command === 'Z') { out += 'Z '; continue; }
      if (command === 'A') {
        const [rx, ry, axis, large, sweep, x, y] = tokens.slice(i, i + 7).map(Number);
        i += 7;
        out += `A${num(rx * scale)} ${num(ry * scale)} ${num(axis + rot)} ${large} ${sweep} ${move(x, y)} `;
        continue;
      }
      const points = [];
      for (let k = 0; k < pairs[command]; k++, i += 2) points.push(move(Number(tokens[i]), Number(tokens[i + 1])));
      out += `${command}${points.join(' ')} `;
    }
    return out.trim();
  }

  /**
   * Collects path data per paint and writes one <path> per paint, in the
   * order given. A key may carry a "#suffix" to use one class at two depths.
   */
  function layers(parent, keys) {
    const data = new Map(keys.map((key) => [key, []]));
    return {
      add(key, ...parts) { data.get(key).push(...parts); },
      flush() {
        for (const [key, parts] of data) {
          if (parts.length) svg('path', { d: parts.join(' '), class: key.split('#')[0] }, parent);
        }
      },
    };
  }

  const root = (parent, viewBox, name) =>
    svg('svg', { viewBox, class: `ta-art ta-${name}`, 'aria-hidden': 'true' }, parent);

  // ---------------------------------------------------------------- the ramen table

  const BOWL_TOPPING_PAINTS = [
    'ta-table-noodle-shade', 'ta-table-noodle', 'ta-table-oil', 'ta-table-nori', 'ta-table-nori-light',
    'ta-table-egg', 'ta-table-yolk', 'ta-table-yolk-light', 'ta-table-chashu', 'ta-table-chashu-edge',
    'ta-table-chashu-fat', 'ta-table-naruto', 'ta-table-naruto-swirl', 'ta-table-scallion', 'ta-table-sesame',
    'ta-ink-fine',
  ];
  const BOWL_SHELL_PAINTS = [
    'ta-shadow', 'ta-table-bowl', 'ta-table-bowl-shade', 'ta-table-bowl-light', 'ta-table-bowl-band',
    'ta-table-bowl-inside', 'ta-table-bowl-inside-shade', 'ta-table-broth', 'ta-table-broth-light',
    'ta-table-broth-shade', 'ta-ink', 'ta-ink-fine#shell',
  ];

  /** A spiral strand of noodles around (cx, cy). */
  function noodleStrand(cx, cy, r0, r1, turns, phase, wobble) {
    const points = [];
    const steps = Math.round(turns * 30);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = phase + t * turns * 2 * Math.PI;
      const r = r0 + (r1 - r0) * t + wobble * Math.sin(angle * 3.3 + phase);
      points.push([cx + r * Math.cos(angle), cy + r * 0.92 * Math.sin(angle)]);
    }
    return poly(points, false);
  }

  /** Slightly irregular round slice. */
  function blob(cx, cy, r, wobble) {
    return smooth(wobble.map((w, i) => {
      const angle = (i / wobble.length) * 2 * Math.PI;
      return [cx + r * w * Math.cos(angle), cy + r * w * Math.sin(angle)];
    }));
  }

  /** The bowl itself: glazed rim, white band, inside wall, broth. Light stays top left. */
  function bowlShell(L, cx, cy) {
    L.add('ta-shadow', circle(cx + 6, cy + 7, 52));
    L.add('ta-table-bowl', circle(cx, cy, 52));
    L.add('ta-table-bowl-shade', crescent(cx, cy, 52, -5, -6));
    L.add('ta-table-bowl-light', arc(cx, cy, 49.6, 188, 276));
    L.add('ta-table-bowl-band', circle(cx, cy, 46.6));
    L.add('ta-table-bowl-inside', circle(cx, cy, 43.6));
    L.add('ta-table-bowl-inside-shade', crescent(cx, cy, 43.6, 5, 6));
    L.add('ta-table-broth', circle(cx, cy, 38.6));
    L.add('ta-table-broth-light', arc(cx, cy, 34, 20, 80), arc(cx, cy, 30, 100, 130));
    L.add('ta-table-broth-shade', crescent(cx, cy, 38.6, 4, 5));
    L.add('ta-ink', circle(cx, cy, 52));
    L.add('ta-ink-fine#shell', circle(cx, cy, 43.6), circle(cx, cy, 38.6));
  }

  /** What is in the bowl, drawn around (0, 0) and turned by `rot` so no two bowls match. */
  function bowlToppings(L, cx, cy, rot) {
    const put = (key, ...parts) => L.add(key, ...parts.map((d) => place(d, cx, cy, rot)));
    const strands = [
      noodleStrand(-3, 6, 3, 25, 3.4, 0.4, 1.3),
      noodleStrand(-5, 5, 6, 27, 2.6, 2.6, 1.6),
      noodleStrand(-1, 8, 12, 22, 1.2, 4.4, 2.2),
    ];
    put('ta-table-noodle-shade', ...strands);
    put('ta-table-noodle', ...strands);
    put('ta-table-oil', circle(31, -3, 2), circle(27, 3, 1.2), circle(-2, -33, 1.7), circle(4, -30, 1), circle(-31, 17, 1.6),
      circle(-27, 23, 1));

    // Nori: one sheet leaning on the rim.
    const nori = poly([[-11, -50], [11, -50], [11, -21], [-11, -21]]);
    put('ta-table-nori', place(nori, 0, 0, -45));
    put('ta-table-nori-light', place(`${line(-6, -46, -6, -26)} ${line(0, -47, 0, -32)} ${line(6, -45, 6, -27)}`, 0, 0, -45));
    put('ta-ink-fine', place(nori, 0, 0, -45));

    // Half a soft-boiled egg.
    const egg = ellipse(18, -13, 12.5, 10, 28);
    put('ta-table-egg', egg);
    put('ta-table-yolk', circle(17.5, -13, 6.4));
    put('ta-table-yolk-light', circle(15.8, -14.8, 2.3));
    put('ta-ink-fine', egg, circle(17.5, -13, 6.4));

    // Two chashu slices.
    const slices = [[19.5, 10.5, 0], [3.5, 25, 140]].map(([x, y, turn]) => {
      const outline = place(blob(0, 0, 10.8, [1, 0.94, 1.03, 0.97, 1.04, 0.95, 1, 0.96]), x, y, turn);
      put('ta-table-chashu', outline);
      put('ta-table-chashu-edge', place(blob(0, 0, 8.6, [1, 0.94, 1.03, 0.97, 1.04, 0.95, 1, 0.96]), x, y, turn));
      put('ta-table-chashu-fat', place('M-4.5 -1 C-4 -5.5 3.5 -6 4.5 -1.5 C5.2 2 0.5 4 -1 1.2', x, y, turn));
      return outline;
    });
    put('ta-ink-fine', ...slices);

    // Narutomaki with its pink swirl.
    const naruto = [];
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * 2 * Math.PI;
      const r = i % 2 ? 6.3 : 7.6;
      naruto.push([-23 + r * Math.cos(angle), 9 + r * Math.sin(angle)]);
    }
    put('ta-table-naruto', smooth(naruto));
    put('ta-table-naruto-swirl', noodleStrand(-23, 9, 0.6, 4.6, 1.5, 0, 0));
    put('ta-ink-fine', smooth(naruto));

    put('ta-table-scallion', ...[[-7, 1], [-13, -6], [1, -3], [-10, 17], [-15, 26], [7, 7], [-2, 12]].map(([x, y]) => circle(x, y, 2.3)));
    put('ta-table-sesame', ...[[17, 8, 20], [22, 13, 80], [2, 22, 130], [6, 28, 40], [-20, -2, 60], [9, -22, 10], [-6, -14, 100]]
      .map(([x, y, turn]) => ellipse(x, y, 1.7, 0.9, turn)));
  }

  /** A pair of chopsticks from the handle end to the tips, with a ceramic rest under the tips. */
  function chopsticks(L, hx, hy, tx, ty) {
    const length = Math.hypot(tx - hx, ty - hy);
    const angle = (Math.atan2(ty - hy, tx - hx) * 180) / Math.PI;
    const stick = (offset, spread) => {
      const body = poly([[0, offset - 2.3], [length, offset + spread - 1.1], [length, offset + spread + 1.1], [0, offset + 2.3]]);
      const end = poly([[0, offset - 2.3], [20, offset - 2.06 + spread * 0.2], [20, offset + 2.06 + spread * 0.2], [0, offset + 2.3]]);
      return [body, end];
    };
    const sticks = [stick(-3.6, 1.4), stick(3.6, -1.0)];
    const rest = roundRect(length * 0.78 - 4.5, -11, 9, 22, 4);
    L.add('ta-shadow', place(rest, hx + 2, hy + 3, angle), ...sticks.map(([body]) => place(body, hx + 2.5, hy + 3.5, angle)));
    L.add('ta-table-rest', place(rest, hx, hy, angle));
    L.add('ta-ink-fine#under', place(rest, hx, hy, angle));
    for (const [body, end] of sticks) {
      L.add('ta-table-stick', place(body, hx, hy, angle));
      L.add('ta-table-stick-end', place(end, hx, hy, angle));
      L.add('ta-ink-fine', place(body, hx, hy, angle));
    }
  }

  /** A glass of matcha soda from above: glass wall, soda, ice, and a straw leaning out. */
  function sodaGlass(L, cx, cy, strawTurn) {
    L.add('ta-shadow', circle(cx + 5, cy + 6, 20));
    L.add('ta-table-glass', circle(cx, cy, 20));
    L.add('ta-table-soda', circle(cx, cy, 16));
    L.add('ta-table-soda-shade', crescent(cx, cy, 16, 3.4, 4));
    L.add('ta-table-soda-foam', circle(cx + 8, cy + 7.5, 1.7), circle(cx + 3, cy + 11.5, 1.1), circle(cx + 11, cy + 2, 1),
      circle(cx - 6, cy + 11, 1.2));
    const cube = roundRect(-5, -5, 10, 10, 2.2);
    L.add('ta-table-ice', place(cube, cx - 5.5, cy + 4, 20), place(cube, cx + 5, cy - 5.5, -28), place(cube, cx + 5.5, cy + 7, 50, 0.7));
    const straw = place(roundRect(0, -2.6, 29, 5.2, 2.6), cx - 2, cy + 1.5, strawTurn);
    L.add('ta-table-straw', straw);
    L.add('ta-table-straw-stripe', place(`${line(6, -2.6, 8.4, 2.6)} ${line(13, -2.6, 15.4, 2.6)} ${line(20, -2.6, 22.4, 2.6)}`, cx - 2, cy + 1.5, strawTurn));
    L.add('ta-table-highlight', arc(cx, cy, 18, 195, 265));
    L.add('ta-ink', circle(cx, cy, 20));
    L.add('ta-ink-fine', circle(cx, cy, 16), straw);
  }

  /** One pan-fried gyoza lying browned side up, drawn around (0, 0) with its pleated edge on the left. */
  function gyoza(L, x, y, rot) {
    const crest = [];
    for (let i = 0; i <= 6; i++) {
      const angle = rad(90 + (i / 6) * 180);
      crest.push([4 + 16 * Math.cos(angle), 20 * Math.sin(angle)]);
    }
    let body = `M${pt(4, 20)}`;
    for (let i = 1; i <= 6; i++) {
      const [x0, y0] = crest[i - 1];
      const [x1, y1] = crest[i];
      const mx = (x0 + x1) / 2 - 4;
      const my = (y0 + y1) / 2;
      const push = 1 + 2.6 / Math.hypot(mx, my);
      body += ` Q${pt(4 + mx * push, my * push)} ${pt(x1, y1)}`;
    }
    body += ` Q${pt(8.5, 0)} ${pt(4, 20)} Z`;
    const pleats = crest.slice(1, 6).map(([px, py]) => line(px, py, 4 + (px - 4) * 0.66, py * 0.7)).join(' ');
    L.add('ta-shadow', place(body, x + 2.5, y + 3, rot));
    L.add('ta-table-gyoza', place(body, x, y, rot));
    L.add('ta-table-gyoza-brown', place('M4.4 -16.5 Q8 0 4.4 16.5 C-3.5 13 -6 6 -6 0 C-6 -6 -3.5 -13 4.4 -16.5 Z', x, y, rot));
    L.add('ta-table-gyoza-dark', place('M4 -11 Q6.2 -1 4.2 9 C0.5 6 -1.6 -4 4 -11 Z', x, y, rot));
    L.add('ta-ink-fine', place(body, x, y, rot), place(pleats, x, y, rot));
  }

  /**
   * Friday's ramen dinner from straight above, the story's starting point:
   * three bowls of tonkotsu ramen with chopsticks, a plate of gyoza, three
   * matcha sodas, and a soy dish on a plank table. viewBox 0 0 520 300; the
   * area x 330..510, y 150..290 is clear table for the receipt. Part:
   * .ta-table-bowls (the three bowls).
   */
  art.table = function table(parent) {
    const view = root(parent, '0 0 520 300', 'table');

    const top = layers(view, ['ta-shadow', 'ta-table-edge', 'ta-table-wood', 'ta-table-plank', 'ta-table-seam',
      'ta-table-grain', 'ta-table-wood-light', 'ta-ink']);
    top.add('ta-shadow', roundRect(13, 14, 500, 282, 14));
    top.add('ta-table-edge', roundRect(6, 6, 500, 282, 14));
    top.add('ta-table-wood', roundRect(6, 6, 495, 277, 12));
    const seams = [53, 100, 147, 194, 241];
    top.add('ta-table-plank', shape.box(6, 53, 495, 47), shape.box(6, 147, 495, 47),
      'M6 241 L501 241 L501 271 A12 12 0 0 1 489 283 L18 283 A12 12 0 0 1 6 271 Z');
    top.add('ta-table-seam', ...seams.map((y) => line(6.5, y, 500.5, y)),
      line(190, 6.5, 190, 53), line(352, 53, 352, 100), line(120, 100, 120, 147), line(420, 147, 420, 194),
      line(238, 194, 238, 241), line(96, 241, 96, 282), line(388, 241, 388, 282));
    const grain = (x, y, length, bend) =>
      `M${pt(x, y)} C${pt(x + length / 3, y - bend)} ${pt(x + (2 * length) / 3, y + bend)} ${pt(x + length, y)}`;
    top.add('ta-table-grain',
      grain(206, 22, 110, 3), grain(240, 34, 70, -2.5), grain(382, 18, 96, 2), grain(20, 122, 80, 3), grain(196, 116, 130, -3),
      grain(206, 128, 60, 2), grain(368, 86, 110, -3), grain(250, 166, 120, 3), grain(440, 172, 54, -2), grain(216, 216, 0, 0),
      grain(256, 212, 110, -3), grain(280, 224, 60, 2), grain(404, 262, 84, 3), grain(120, 262, 90, -2.5), grain(226, 270, 70, 2),
      grain(352, 226, 120, 3), ellipse(300, 262, 5, 2.4), ellipse(300, 262, 9, 4.6), ellipse(452, 122, 4, 2));
    top.add('ta-table-wood-light', 'M9.5 268 L9.5 20 A10.5 10.5 0 0 1 20 9.5 L486 9.5');
    top.add('ta-ink', roundRect(6, 6, 500, 282, 14));
    top.flush();

    // Shared dishes, glasses, and chopsticks.
    const things = layers(view, ['ta-shadow', 'ta-table-plate', 'ta-table-plate-shade', 'ta-table-rest',
      'ta-ink-fine#under', 'ta-table-stick', 'ta-table-stick-end', 'ta-table-gyoza', 'ta-table-gyoza-brown',
      'ta-table-gyoza-dark', 'ta-table-bowl', 'ta-table-bowl-shade', 'ta-table-soy', 'ta-table-glass', 'ta-table-soda',
      'ta-table-soda-shade', 'ta-table-soda-foam', 'ta-table-ice', 'ta-table-straw',
      'ta-table-straw-stripe', 'ta-table-highlight', 'ta-ink', 'ta-ink-fine']);

    const plate = { x: 428, y: 68, turn: -7 };
    things.add('ta-shadow', ellipse(plate.x + 6, plate.y + 7, 63, 40, plate.turn));
    things.add('ta-table-plate', ellipse(plate.x, plate.y, 63, 40, plate.turn));
    things.add('ta-table-plate-shade', ellipse(plate.x, plate.y, 53, 31, plate.turn));
    things.add('ta-table-highlight', place(arc(0, 0, 58, 190, 262, 35.5), plate.x, plate.y, plate.turn));
    things.add('ta-ink', ellipse(plate.x, plate.y, 63, 40, plate.turn));
    [-36, -12.5, 11.5, 35.5].forEach((offset, i) => {
      const angle = rad(plate.turn);
      gyoza(things, plate.x + offset * Math.cos(angle) + (i % 2 ? 1 : -1) * 0.8, plate.y + offset * Math.sin(angle) + (i % 2 ? 1.5 : -1.5),
        plate.turn + [8, 14, 6, 13][i]);
    });

    const soy = { x: 463, y: 129 };
    things.add('ta-shadow', circle(soy.x + 4, soy.y + 5, 14.5));
    things.add('ta-table-bowl', circle(soy.x, soy.y, 14.5));
    things.add('ta-table-bowl-shade', crescent(soy.x, soy.y, 14.5, -2.5, -3));
    things.add('ta-table-soy', circle(soy.x, soy.y, 10.4));
    things.add('ta-table-highlight', arc(soy.x, soy.y, 7.4, 20, 75), arc(soy.x, soy.y, 12.6, 195, 262));
    things.add('ta-ink', circle(soy.x, soy.y, 14.5));
    things.add('ta-ink-fine', circle(soy.x, soy.y, 10.4));

    chopsticks(things, 151, 152, 161, 62);
    chopsticks(things, 319, 147, 330, 62);
    chopsticks(things, 186, 270, 152, 178);
    sodaGlass(things, 160, 34, -38);
    sodaGlass(things, 330, 34, -52);
    sodaGlass(things, 216, 174, -24);
    things.flush();

    const bowlGroup = svg('g', { class: 'ta-table-bowls' }, view);
    const bowls = layers(bowlGroup, [...BOWL_SHELL_PAINTS.slice(0, -1), 'ta-ink-fine#shell',
      ...BOWL_TOPPING_PAINTS]);
    [[72, 76, 0], [242, 74, 112], [76, 212, 222]].forEach(([cx, cy, rot]) => {
      bowlShell(bowls, cx, cy);
      bowlToppings(bowls, cx, cy, rot);
    });
    bowls.flush();
    return view;
  };

  // ---------------------------------------------------------------- copper cents

  /** A cent seen tilted, as an ellipse with a little thickness. */
  function tiltedCoin(L, cx, cy, rx, ry, rot) {
    L.add('ta-story-copper-shade', ellipse(cx + 1.2, cy + 1.6, rx, ry, rot));
    L.add('ta-ink-fine#back', ellipse(cx + 1.2, cy + 1.6, rx, ry, rot));
    L.add('ta-story-copper', ellipse(cx, cy, rx, ry, rot));
    L.add('ta-story-copper-light', place(arc(0, 0, rx - 2.2, 190, 280, Math.max(0.6, ry - 2)), cx, cy, rot));
    L.add('ta-ink-fine', ellipse(cx, cy, rx, ry, rot));
  }

  /**
   * One copper cent from above: the unit of the whole example. Raised rim,
   * an embossed leaf (no portrait, no text), light from the top left.
   * viewBox 0 0 40 40; no parts, no states.
   */
  art.coin = function coin(parent) {
    const view = root(parent, '0 0 40 40', 'coin');
    const L = layers(view, ['ta-shadow', 'ta-story-copper', 'ta-story-copper-field', 'ta-story-copper-shade',
      'ta-story-copper-light', 'ta-story-copper-emboss-shade', 'ta-story-copper-emboss', 'ta-story-copper-vein',
      'ta-story-glint', 'ta-ink', 'ta-ink-fine']);
    L.add('ta-shadow', circle(21.6, 22, 17));
    L.add('ta-story-copper', circle(20, 20, 17.5));
    L.add('ta-story-copper-field', circle(20, 20, 13.4));
    L.add('ta-story-copper-shade', crescent(20, 20, 13.4, 2, 2.4), crescent(20, 20, 17.5, -2, -2.4));
    L.add('ta-story-copper-light', arc(20, 20, 15.4, 182, 285), arc(20, 20, 12.5, 12, 96));
    const leaf = 'M13.2 26.6 C10.6 18.4 16.6 11.6 27.2 12 C28.4 21.4 22.6 28.2 13.2 26.6 Z';
    L.add('ta-story-copper-emboss-shade', place(leaf, 0.9, 1.1));
    L.add('ta-story-copper-emboss', leaf);
    L.add('ta-story-copper-vein', 'M13.6 26.2 L25.4 13.8', 'M17.6 22 L17.2 17.6', 'M21 18.4 L20.8 14.4', 'M17.6 22 L22.4 22.8',
      'M21 18.4 L25.2 19.2');
    L.add('ta-story-glint', ellipse(10.2, 11.4, 3.2, 1.3, -45));
    L.add('ta-ink', circle(20, 20, 17.5));
    L.add('ta-ink-fine', circle(20, 20, 13.4));
    L.flush();
    return view;
  };

  const STACK_JITTER = [0, 0.9, -0.6, 0.4, -0.9, 0.7, -0.3, 0.8, -0.7, 0.2, -0.5, 0.9, -0.2, 0.6];

  /**
   * A stack of n copper cents (1 to 14) seen slightly from above: an amount
   * of money you can count. viewBox 0 0 56 (16 + n * 6); the top face is
   * centered at (27 + jitter, 7.5) and each coin is 6 high. No parts, no states.
   */
  art.coinStack = function coinStack(parent, { n = 6 } = {}) {
    const count = Math.max(1, Math.min(14, Math.round(n)));
    const view = root(parent, `0 0 56 ${16 + count * 6}`, 'coin-stack');
    const L = layers(view, ['ta-shadow', 'ta-story-copper', 'ta-story-copper-shade', 'ta-story-copper-light',
      'ta-story-copper-reed', 'ta-story-copper-top', 'ta-story-copper-vein', 'ta-story-glint', 'ta-ink-fine', 'ta-ink']);
    const RX = 22;
    const RY = 5.5;
    const drop = (offset) => RY * Math.sqrt(1 - (offset / RX) ** 2);
    const under = `A${RX} ${RY} 0 0 0`;
    const over = `A${RX} ${RY} 0 0 1`;
    L.add('ta-shadow', ellipse(27 + STACK_JITTER[0] + 4.5, 7.5 + count * 6 + 1.8, 23, 5.4));
    for (let i = 0; i < count; i++) {
      const cx = 27 + STACK_JITTER[i];
      const y = 7.5 + (count - 1 - i) * 6;
      L.add('ta-story-copper', `M${pt(cx - RX, y)} L${pt(cx - RX, y + 6)} ${under} ${pt(cx + RX, y + 6)} L${pt(cx + RX, y)} Z`);
      L.add('ta-story-copper-shade', `M${pt(cx + 8, y + drop(8))} L${pt(cx + 8, y + 6 + drop(8))} ${under} ${pt(cx + RX, y + 6)} ` +
        `L${pt(cx + RX, y)} ${over} ${pt(cx + 8, y + drop(8))} Z`);
      L.add('ta-story-copper-light', `M${pt(cx - 17, y + drop(17))} L${pt(cx - 17, y + 6 + drop(17))} ${under} ` +
        `${pt(cx - 11.5, y + 6 + drop(11.5))} L${pt(cx - 11.5, y + drop(11.5))} ${over} ${pt(cx - 17, y + drop(17))} Z`);
      for (let offset = -19.5; offset <= 19.6; offset += 3.9) {
        L.add('ta-story-copper-reed', line(cx + offset, y + drop(offset) + 1.7, cx + offset, y + drop(offset) + 4.5));
      }
      L.add('ta-ink-fine', `M${pt(cx - RX, y + 6)} ${under} ${pt(cx + RX, y + 6)}`);
      L.add('ta-ink', line(cx - RX, y, cx - RX, y + 6), line(cx + RX, y, cx + RX, y + 6));
    }
    const topX = 27 + STACK_JITTER[count - 1];
    L.add('ta-story-copper-top', ellipse(topX, 7.5, RX, RY));
    L.add('ta-story-copper-vein', ellipse(topX, 7.5, 17.6, 4));
    L.add('ta-story-glint', ellipse(topX - 8, 5.6, 5, 1, -6));
    L.add('ta-ink', ellipse(topX, 7.5, RX, RY),
      `M${pt(27 + STACK_JITTER[0] - RX, 7.5 + count * 6)} ${under} ${pt(27 + STACK_JITTER[0] + RX, 7.5 + count * 6)}`);
    L.flush();
    return view;
  };

  /**
   * Two copper cents rolling away on their edges, with speed lines and small
   * shadows under their bounces: the two cents that vanish. viewBox 0 0 130 70;
   * no parts, no states.
   */
  art.rollingCoins = function rollingCoins(parent) {
    const view = root(parent, '0 0 130 70', 'rolling-coins');
    const L = layers(view, ['ta-shadow', 'ta-rolling-speed', 'ta-story-copper-shade', 'ta-story-copper-reed', 'ta-ink#back',
      'ta-story-copper', 'ta-story-copper-field', 'ta-story-copper-emboss', 'ta-story-copper-light', 'ta-story-glint',
      'ta-ink-fine', 'ta-ink']);
    const rolling = (cx, cy, rx, ry, tilt, thick) => {
      L.add('ta-story-copper-shade', ellipse(cx - thick, cy + thick * 0.2, rx, ry, tilt));
      L.add('ta-ink#back', ellipse(cx - thick, cy + thick * 0.2, rx, ry, tilt));
      for (let k = -3; k <= 3; k++) {
        const a = rad(180 + k * 22);
        const px = rx * Math.cos(a);
        const py = ry * Math.sin(a);
        L.add('ta-story-copper-reed', line(...turn(px, py, tilt, cx, cy), ...turn(px, py, tilt, cx - thick, cy + thick * 0.2)));
      }
      L.add('ta-story-copper', ellipse(cx, cy, rx, ry, tilt));
      L.add('ta-story-copper-field', ellipse(cx, cy, rx * 0.74, ry * 0.76, tilt));
      L.add('ta-story-copper-emboss', place(ellipse(0.4, 0, rx * 0.3, ry * 0.42, 0), cx, cy, tilt + 24));
      L.add('ta-story-copper-light', place(arc(0, 0, rx * 0.86, 185, 290, ry * 0.88), cx, cy, tilt));
      L.add('ta-story-glint', place(ellipse(-rx * 0.5, -ry * 0.62, rx * 0.12, ry * 0.16, 20), cx, cy, tilt));
      L.add('ta-ink-fine', ellipse(cx, cy, rx * 0.74, ry * 0.76, tilt));
      L.add('ta-ink', ellipse(cx, cy, rx, ry, tilt));
    };
    function turn(x, y, degrees, ox, oy) {
      const c = Math.cos(rad(degrees));
      const s = Math.sin(rad(degrees));
      return [ox + x * c - y * s, oy + x * s + y * c];
    }
    L.add('ta-shadow', ellipse(63, 63.5, 13, 2.8), ellipse(106, 60.5, 8, 2));
    L.add('ta-rolling-speed', 'M8 22 Q22 20 36 22', 'M3 35 Q19 33 34 35', 'M12 48 Q25 46 37 48',
      'M78 12 Q84 11 90 12', 'M74 23 Q82 22 89 23', 'M80 34 Q86 33 91 34');
    rolling(60, 37, 11.5, 20.5, 12, 5.5);
    rolling(105, 26, 9, 16, 20, 4.4);
    L.flush();
    return view;
  };

  // ---------------------------------------------------------------- the split machine

  /**
   * split(cents, people) as a coin-sorting machine: cents pour into a hopper
   * on the left, a dial sets the number of people, and three chutes lead to
   * three trays on the right. viewBox 0 0 460 220. Parts: .ta-machine-pour
   * (coins falling into the hopper, shown only with is-pouring) and
   * .ta-machine-dial-hand (pivot 230, 140). The name plate x 170..290,
   * y 60..96 is blank; tray openings are centered at (350, 170), (393, 170),
   * and (436, 170).
   */
  art.splitMachine = function splitMachine(parent) {
    const view = root(parent, '0 0 460 220', 'split-machine');
    const L = layers(view, ['ta-shadow', 'ta-machine-strut', 'ta-machine-metal', 'ta-machine-metal-light',
      'ta-machine-metal-shade', 'ta-machine-dark', 'ta-ink#back', 'ta-ink-fine#back',
      'ta-machine-body', 'ta-machine-body-light', 'ta-machine-body-shade', 'ta-machine-lid', 'ta-machine-base',
      'ta-machine-brass', 'ta-machine-brass-shade', 'ta-machine-plate', 'ta-machine-face', 'ta-machine-face-shade',
      'ta-machine-window', 'ta-story-copper', 'ta-story-copper-light', 'ta-machine-tray', 'ta-machine-tray-inside',
      'ta-machine-tray-light', 'ta-machine-tray-shade', 'ta-machine-rivet', 'ta-machine-glint', 'ta-ink', 'ta-ink-fine']);

    L.add('ta-shadow', ellipse(236, 201, 104, 6));

    // Chutes from the body's right side down to the trays, with posts between them.
    const SLOPE = 0.65;
    const chutes = [[130, 344], [100, 387], [70, 430]].map(([y0, xe]) => ({ y0, xe, ye: y0 + SLOPE * (xe - 314) }));
    L.add('ta-machine-strut', line(340, 86, 340, 113), line(378, 111, 378, 138), line(332, 116, 332, 139));
    for (const { y0, xe, ye } of chutes) {
      const back = poly([[310, y0 - 7], [xe, ye - 7], [xe, ye - 2], [310, y0 - 2]]);
      const floor = poly([[310, y0 - 2], [xe, ye - 2], [xe + 5, ye + 1], [xe + 5, ye + 11], [xe - 2, ye + 11], [xe - 4, ye + 5], [310, y0 + 5]]);
      const outline = poly([[310, y0 - 7], [xe, ye - 7], [xe, ye - 2], [xe + 5, ye + 1], [xe + 5, ye + 11], [xe - 2, ye + 11],
        [xe - 4, ye + 5], [310, y0 + 5]]);
      L.add('ta-machine-metal-light', back);
      L.add('ta-machine-metal', floor);
      L.add('ta-machine-metal-shade', poly([[310, y0 + 2], [xe - 4, ye + 2], [xe - 4, ye + 5], [310, y0 + 5]]),
        poly([[xe + 1.5, ye + 3], [xe + 5, ye + 1], [xe + 5, ye + 11], [xe + 1.5, ye + 11]]));
      L.add('ta-ink#back', outline);
      L.add('ta-ink-fine#back', line(310, y0 - 2, xe, ye - 2));
    }

    // Hopper: a funnel on a feed duct that enters the body's left side.
    const funnel = 'M75 48 A31 8 0 0 0 137 48 L120 88 L94 88 Z';
    const duct = 'M94 86 L94 112 Q94 124 106 124 L150 124 L150 100 L120 100 L120 86 Z';
    L.add('ta-machine-metal', duct, funnel, ellipse(106, 48, 31, 8));
    L.add('ta-machine-metal-light', 'M77 51.5 Q81 54.6 88 55.4 L100 88 L94 88 Z', 'M94 88 L99.5 88 L99.5 111 Q99.5 118.5 107 118.5 L107 124 Q94 124 94 112 Z');
    L.add('ta-machine-metal-shade', 'M125 55 Q132 54 135.5 50.5 L120 88 L112 88 Z', 'M112 88 L120 88 L120 100 L112 100 Z',
      'M107 118.5 L150 118.5 L150 124 L107 124 Z');
    L.add('ta-machine-dark', ellipse(106, 48.6, 27, 5.4));
    L.add('ta-ink#back', duct, funnel, ellipse(106, 48, 31, 8));
    L.add('ta-ink-fine#back', ellipse(106, 48.6, 27, 5.4), line(94, 88, 120, 88));

    // Body, lid, and base.
    const body = roundRect(146, 46, 168, 144, 20);
    L.add('ta-machine-body', body);
    L.add('ta-machine-body-light', 'M152 170 L152 66 A14 14 0 0 1 166 52 L172 52 A14 14 0 0 0 158 66 L158 170 Q155 174 152 170 Z');
    L.add('ta-machine-body-shade', 'M296 46 A20 20 0 0 1 314 66 L314 170 A20 20 0 0 1 294 190 L160 190 Q150 190 148 180 Q200 183 262 180 Q296 176 299 150 Q302 90 296 46 Z');
    L.add('ta-machine-lid', roundRect(141, 37, 178, 17, 8));
    L.add('ta-machine-brass', 'M222 37 L222 33 Q222 27 230 27 Q238 27 238 33 L238 37 Z');
    L.add('ta-machine-brass-shade', 'M233 27.6 Q238 28.5 238 33 L238 37 L233.5 37 Z');
    L.add('ta-ink-fine', 'M222 37 L222 33 Q222 27 230 27 Q238 27 238 33 L238 37');
    L.add('ta-machine-body-light', 'M147 44 Q148 40.5 152 40.5 L300 40.5 L300 43.5 L152 43.5 Q149 43.5 147 44 Z');
    L.add('ta-machine-base', roundRect(135, 182, 190, 15, 5));
    L.add('ta-machine-metal', roundRect(150, 196, 28, 7, 2.5), roundRect(282, 196, 28, 7, 2.5));
    L.add('ta-ink', body, roundRect(141, 37, 178, 17, 8), roundRect(135, 182, 190, 15, 5), roundRect(150, 196, 28, 7, 2.5),
      roundRect(282, 196, 28, 7, 2.5));
    L.add('ta-ink-fine', line(141, 189.5, 319, 189.5));

    // Flanges where the duct and chutes meet the body.
    const flanges = [roundRect(142, 95, 9, 34, 2.5), ...chutes.map(({ y0 }) => roundRect(307, y0 - 11, 9, 20, 2.5))];
    L.add('ta-machine-brass', ...flanges);
    L.add('ta-ink-fine', ...flanges);

    // Name plate (blank) in a brass frame.
    L.add('ta-machine-brass', roundRect(165, 55, 130, 46, 8));
    L.add('ta-machine-brass-shade', 'M287 55 A8 8 0 0 1 295 63 L295 93 A8 8 0 0 1 287 101 L173 101 A8 8 0 0 1 166 97 L291 97 L291 59 Z');
    L.add('ta-machine-plate', roundRect(170, 60, 120, 36, 4));
    L.add('ta-ink-fine', roundRect(165, 55, 130, 46, 8), roundRect(170, 60, 120, 36, 4));

    // Dial for the number of people.
    const dial = { x: 230, y: 140 };
    L.add('ta-machine-brass', circle(dial.x, dial.y, 34));
    L.add('ta-machine-brass-shade', crescent(dial.x, dial.y, 34, -3.5, -4.2));
    L.add('ta-machine-face', circle(dial.x, dial.y, 27.5));
    L.add('ta-machine-face-shade', crescent(dial.x, dial.y, 27.5, 3, 3.6));
    L.add('ta-machine-glint', arc(dial.x, dial.y, 31, 196, 262));
    const ticks = [];
    for (let k = -3; k <= 3; k++) {
      const a = rad(-90 + k * 36);
      ticks.push(line(dial.x + 19.5 * Math.cos(a), dial.y + 19.5 * Math.sin(a), dial.x + 24.5 * Math.cos(a), dial.y + 24.5 * Math.sin(a)));
    }
    L.add('ta-ink', circle(dial.x, dial.y, 34), ...ticks);
    L.add('ta-ink-fine', circle(dial.x, dial.y, 27.5));

    // Vent slots and a round window onto the cents inside.
    L.add('ta-machine-window', roundRect(160, 124, 27, 5, 2.5), roundRect(160, 135, 27, 5, 2.5), roundRect(160, 146, 27, 5, 2.5),
      circle(283, 140, 12));
    L.add('ta-story-copper', 'M272.4 145.5 A12 12 0 0 0 293.6 145.5 Q289 139 283 140.5 Q277 138.5 272.4 145.5 Z');
    L.add('ta-story-copper-light', arc(279, 146, 5, 200, 320, 3.2), arc(288, 145.6, 4.4, 205, 325, 2.8));
    L.add('ta-machine-glint', arc(283, 140, 9, 200, 255));
    L.add('ta-ink-fine', circle(283, 140, 12), roundRect(160, 124, 27, 5, 2.5), roundRect(160, 135, 27, 5, 2.5),
      roundRect(160, 146, 27, 5, 2.5));

    // Rivets.
    const rivets = [[158, 62], [158, 112], [158, 164], [158, 178], [303, 62], [303, 164], [303, 178], [200, 178], [262, 178],
      [146.5, 102], [146.5, 122]];
    L.add('ta-machine-rivet', ...rivets.map(([x, y]) => circle(x, y, 2.1)));
    L.add('ta-ink-fine', ...rivets.map(([x, y]) => circle(x, y, 2.1)));

    // Three trays.
    for (const cx of [350, 393, 436]) {
      const front = poly([[cx - 18, 172], [cx + 18, 172], [cx + 15, 191], [cx - 15, 191]]);
      const inside = poly([[cx - 18, 172], [cx - 14.5, 164], [cx + 14.5, 164], [cx + 18, 172]]);
      L.add('ta-shadow', ellipse(cx + 3, 192, 19, 3));
      L.add('ta-machine-tray', front);
      L.add('ta-machine-tray-inside', inside);
      L.add('ta-machine-tray-light', poly([[cx - 18, 172], [cx + 18, 172], [cx + 17.5, 175], [cx - 17.5, 175]]));
      L.add('ta-machine-tray-shade', poly([[cx + 9, 175], [cx + 17.5, 175], [cx + 15, 191], [cx + 8, 191]]));
      L.add('ta-ink', poly([[cx - 18, 172], [cx - 14.5, 164], [cx + 14.5, 164], [cx + 18, 172], [cx + 15, 191], [cx - 15, 191]]));
      L.add('ta-ink-fine', line(cx - 18, 172, cx + 18, 172));
    }
    L.flush();

    // The dial's pointer, drawn pointing straight up.
    const hand = svg('g', { class: 'ta-machine-dial-hand' }, view);
    const pointer = poly([[dial.x - 3.6, dial.y + 3], [dial.x, dial.y - 23.5], [dial.x + 3.6, dial.y + 3], [dial.x, dial.y + 9]]);
    svg('path', { d: pointer, class: 'ta-machine-hand' }, hand);
    svg('path', { d: poly([[dial.x, dial.y - 23.5], [dial.x + 3.6, dial.y + 3], [dial.x, dial.y + 9]]), class: 'ta-machine-hand-shade' }, hand);
    svg('path', { d: circle(dial.x, dial.y, 4.4), class: 'ta-machine-brass' }, hand);
    svg('path', { d: `${pointer} ${circle(dial.x, dial.y, 4.4)}`, class: 'ta-ink-fine' }, hand);

    // Cents falling into the hopper.
    const pour = svg('g', { class: 'ta-machine-pour' }, view);
    const P = layers(pour, ['ta-story-copper-shade', 'ta-ink-fine#back', 'ta-story-copper', 'ta-story-copper-light', 'ta-ink-fine']);
    [[99, 9, 8, 5.4, -28], [115, 15, 8, 6.4, 24], [102, 25, 8, 3.6, 62], [117, 30, 8, 5.6, -12], [106, 38, 8, 6.6, 38]]
      .forEach((coin) => tiltedCoin(P, ...coin));
    [[95, 48.6, 7.5, 2.4, 0], [118, 48.4, 7.5, 2.4, 0], [106.5, 49.6, 8, 2.6, 0]].forEach((coin) => tiltedCoin(P, ...coin));
    P.flush();
    return view;
  };

  // ---------------------------------------------------------------- the example's moves

  /**
   * "Fake It": a film-set storefront seen at three quarters, so you can see
   * that it is only a painted front held up by a wooden brace and a sandbag.
   * viewBox 0 0 130 110; no parts, no states.
   */
  art.facade = function facade(parent) {
    const view = root(parent, '0 0 130 110', 'facade');
    const L = layers(view, ['ta-shadow', 'ta-facade-wood', 'ta-facade-wood-shade', 'ta-facade-bag', 'ta-facade-bag-shade',
      'ta-ink#back', 'ta-facade-wall', 'ta-facade-wall-shade', 'ta-facade-cream', 'ta-facade-glass', 'ta-facade-glint',
      'ta-facade-door', 'ta-facade-door-shade', 'ta-facade-awning', 'ta-facade-awning-pale', 'ta-ink', 'ta-ink-fine']);
    // The front is a quad in perspective: u runs left to right, v top to bottom.
    const F = (u, v) => {
      const yTop = 27 - 17 * u;
      const yBottom = 86 + 13 * u;
      return [10 + 70 * u, yTop + v * (yBottom - yTop)];
    };
    const quad = (u0, v0, u1, v1) => poly([F(u0, v0), F(u1, v0), F(u1, v1), F(u0, v1)]);

    // Behind the front: the plywood edge, a diagonal brace, a floor rail, and a sandbag.
    L.add('ta-shadow', poly([[82, 100], [128, 94.5], [124, 88], [86, 92]]), poly([[10, 86], [80, 99], [86, 101], [84, 104], [12, 90]]));
    const brace = poly([[84, 30], [88.5, 28.5], [121, 86], [116.5, 88]]);
    const rail = poly([[85, 92], [122, 86.5], [122.6, 90.5], [85, 96.5]]);
    const cross = poly([[85, 62], [103, 58.5], [104.6, 61.4], [85, 65.4]]);
    L.add('ta-facade-wood', brace, rail, cross);
    L.add('ta-facade-wood-shade', poly([[86.4, 29.2], [88.5, 28.5], [121, 86], [118.8, 87]]), poly([[85, 94.6], [122.3, 88.6], [122.6, 90.5], [85, 96.5]]));
    const bag = smooth([[105, 90], [108, 84.5], [115, 83], [122, 84.5], [126.5, 89], [126, 94.5], [119, 97], [110, 96.5]]);
    L.add('ta-facade-bag', bag, 'M113.5 84 L112 79.5 L118 78.5 L118.5 83.5 Z');
    L.add('ta-facade-bag-shade', 'M110 96.5 Q120 94.5 126.5 89 L126 94.5 Q122 97 119 97 Z');
    L.add('ta-ink#back', cross, brace, rail, bag, 'M113.5 84 L112 79.5 L118 78.5 L118.5 83.5', line(113, 84.6, 119, 83.6),
      'M109 90 Q114 88 118 89.5');

    // The painted front.
    const edge = poly([F(1, 0), [85.5, 12], [85.5, 98], F(1, 1)]);
    L.add('ta-facade-wood', edge);
    L.add('ta-facade-wall', quad(0, 0, 1, 1));
    L.add('ta-facade-wall-shade', quad(0, 0.9, 0.56, 1), quad(0.03, 0.47, 0.97, 0.515));
    L.add('ta-facade-cream', quad(-0.02, 0, 1.02, 0.075), quad(0.14, 0.115, 0.86, 0.25), quad(0.08, 0.55, 0.5, 0.86));
    L.add('ta-facade-glass', quad(0.115, 0.585, 0.275, 0.825), quad(0.305, 0.585, 0.465, 0.825));
    L.add('ta-facade-glint', poly([F(0.13, 0.76), F(0.24, 0.6), F(0.265, 0.6), F(0.155, 0.76)]),
      poly([F(0.33, 0.78), F(0.43, 0.63), F(0.445, 0.63), F(0.345, 0.78)]));
    L.add('ta-facade-door', quad(0.6, 0.56, 0.88, 1));
    L.add('ta-facade-door-shade', quad(0.645, 0.61, 0.835, 0.76), quad(0.645, 0.8, 0.835, 0.95));
    L.add('ta-facade-glint', circle(...F(0.81, 0.785), 1.5));

    // The awning hangs out toward the viewer.
    const lean = ([x, y]) => [x - 4, y + 3.5];
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      const u0 = 0.03 + (i * 0.94) / stripes;
      const u1 = 0.03 + ((i + 1) * 0.94) / stripes;
      const b0 = lean(F(u0, 0.455));
      const b1 = lean(F(u1, 0.455));
      const stripe = `M${pt(...F(u0, 0.3))} L${pt(...F(u1, 0.3))} L${pt(...b1)} Q${pt((b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2 + 5)} ${pt(...b0)} Z`;
      L.add(i % 2 ? 'ta-facade-awning-pale' : 'ta-facade-awning', stripe);
      L.add('ta-ink-fine', stripe);
    }
    L.add('ta-ink', quad(0, 0, 1, 1), edge, quad(-0.02, 0, 1.02, 0.075));
    L.add('ta-ink-fine', quad(0.14, 0.115, 0.86, 0.25), quad(0.08, 0.55, 0.5, 0.86), quad(0.115, 0.585, 0.275, 0.825),
      quad(0.305, 0.585, 0.465, 0.825), quad(0.6, 0.56, 0.88, 1), quad(0.645, 0.61, 0.835, 0.76), quad(0.645, 0.8, 0.835, 0.95),
      circle(...F(0.81, 0.785), 1.5), line(...F(0, 0.9), ...F(0.56, 0.9)));
    L.flush();
    return view;
  };

  /**
   * "Green proves the wiring": a plug pushed into the lower outlet of a wall
   * plate, its cable curving away, and a small lamp on the plate lit green.
   * viewBox 0 0 130 80; no parts, no states.
   */
  art.plug = function plug(parent) {
    const view = root(parent, '0 0 130 80', 'plug');
    const L = layers(view, ['ta-shadow', 'ta-plug-plate', 'ta-plug-plate-shade', 'ta-plug-outlet', 'ta-plug-hole', 'ta-plug-bezel',
      'ta-plug-lamp', 'ta-plug-lamp-light', 'ta-plug-ray', 'ta-ink', 'ta-ink-fine#plate', 'ta-shadow#plug', 'ta-plug-cable-ink',
      'ta-plug-cable', 'ta-plug-cable-light', 'ta-plug-body', 'ta-plug-body-light', 'ta-plug-body-shade', 'ta-ink#plug',
      'ta-ink-fine']);
    const plate = roundRect(9, 5, 50, 70, 7);
    const upper = roundRect(20.5, 12, 27, 22, 8);
    L.add('ta-shadow', roundRect(12.5, 9, 50, 70, 7));
    L.add('ta-plug-plate', plate);
    L.add('ta-plug-plate-shade', 'M52 5 A7 7 0 0 1 59 12 L59 68 A7 7 0 0 1 52 75 L16 75 A7 7 0 0 1 10.5 72 L50 72 A6 6 0 0 0 56 66 L56 8 Z');
    L.add('ta-plug-outlet', upper, roundRect(20.5, 46, 27, 24, 8));
    L.add('ta-plug-hole', roundRect(27.6, 16.5, 2.8, 8.5, 1), roundRect(37.6, 16.5, 2.8, 8.5, 1),
      'M31.6 31.2 L31.6 29 A2.4 2.4 0 0 1 36.4 29 L36.4 31.2 Z');
    L.add('ta-plug-bezel', circle(34, 40.2, 5.4));
    L.add('ta-plug-lamp', circle(34, 40.2, 3.7));
    L.add('ta-plug-lamp-light', circle(32.9, 39.1, 1.5));
    const rays = [150, 180, 210, -30, 0, 30].map((a) =>
      line(34 + 7.6 * Math.cos(rad(a)), 40.2 + 7.6 * Math.sin(rad(a)), 34 + 10.8 * Math.cos(rad(a)), 40.2 + 10.8 * Math.sin(rad(a))));
    L.add('ta-plug-ray', ...rays);
    L.add('ta-ink', plate);
    L.add('ta-ink-fine#plate', upper, circle(34, 40.2, 5.4), circle(34, 40.2, 3.7));

    // The plug covers the lower outlet; its cable leaves through a ribbed sleeve.
    const cable = 'M58 58 C72 58 76 72 91 71 C107 70 104 41 124 37';
    const plugBody = roundRect(18, 44.5, 33, 27, 8);
    const sleeve = poly([[50, 51.5], [63, 55], [63, 61], [50, 64.5]]);
    L.add('ta-shadow#plug', roundRect(21, 48, 33, 27, 8));
    L.add('ta-plug-cable-ink', cable);
    L.add('ta-plug-cable', cable);
    L.add('ta-plug-cable-light', 'M66 57.4 C74 59.4 78 68.6 88 69.2', 'M104 56 C107 46 113 40 122 36.6');
    L.add('ta-plug-body', plugBody, sleeve);
    L.add('ta-plug-body-light', 'M21 58 L21 52.5 A5 5 0 0 1 26 47.5 L44 47.5 Q34 49 27 50.5 Q23.5 52 23.5 58 Z');
    L.add('ta-plug-body-shade', 'M51 60 L51 63.5 A8 8 0 0 1 43 71.5 L26 71.5 Q22 71.5 20 69 Q34 69.5 43 67.5 Q48 66 51 60 Z',
      poly([[50, 60], [63, 58.6], [63, 61], [50, 64.5]]));
    L.add('ta-ink#plug', plugBody);
    L.add('ta-ink-fine', sleeve, line(54, 52.8, 54, 63.4), line(57.5, 53.7, 57.5, 62.5), line(60.5, 54.4, 60.5, 61.6),
      line(29, 53, 29, 63), line(34.5, 53, 34.5, 63), line(40, 53, 40, 63));
    L.flush();
    return view;
  };

  /**
   * "Triangulate": two survey stakes with flags, and two dashed sightlines
   * that meet at a gold star pin: two examples pin down one general rule.
   * viewBox 0 0 130 110; no parts, no states.
   */
  art.triangulate = function triangulate(parent) {
    const view = root(parent, '0 0 130 110', 'triangulate');
    const L = layers(view, ['ta-shadow', 'ta-triangulate-base', 'ta-triangulate-sight', 'ta-triangulate-grass',
      'ta-triangulate-grass-shade', 'ta-triangulate-wood', 'ta-triangulate-wood-shade', 'ta-triangulate-flag-a',
      'ta-triangulate-flag-b', 'ta-triangulate-flag-shade', 'ta-triangulate-needle', 'ta-triangulate-star',
      'ta-triangulate-star-light', 'ta-triangulate-star-shade', 'ta-ink', 'ta-ink-fine']);
    const star = { x: 65, y: 21 };
    const tips = [];
    for (let i = 0; i < 10; i++) {
      const a = rad(-90 + i * 36);
      const r = i % 2 ? 6.2 : 14.5;
      tips.push([star.x + r * Math.cos(a), star.y + r * Math.sin(a)]);
    }
    const stakes = [{ x: 22, side: -1 }, { x: 108, side: 1 }];
    L.add('ta-triangulate-base', line(31, 97.5, 99, 97.5));
    for (const { x, side } of stakes) {
      const reach = Math.hypot(star.x - x, star.y - 58);
      const ux = (star.x - x) / reach;
      const uy = (star.y - 58) / reach;
      L.add('ta-triangulate-sight', line(x + ux * 5, 58 + uy * 5, star.x - ux * 13, star.y - uy * 13));
      L.add('ta-shadow', ellipse(x + 3, 100.5, 14, 3.4));
      const tuft = `M${pt(x - 12, 99)} Q${pt(x - 11, 93)} ${pt(x - 9, 96)} Q${pt(x - 7, 89)} ${pt(x - 5, 95.5)} L${pt(x + 5, 95.5)} ` +
        `Q${pt(x + 7, 90)} ${pt(x + 9, 96)} Q${pt(x + 11.5, 93)} ${pt(x + 12, 99)} Q${pt(x, 102.5)} ${pt(x - 12, 99)} Z`;
      const stake = poly([[x - 3.4, 60], [x + 3.4, 60], [x + 3.4, 97], [x - 3.4, 97]]);
      const flag = poly([[x + side * 3.4, 61.5], [x + side * 19, 67.5], [x + side * 3.4, 74]]);
      L.add('ta-triangulate-wood', stake);
      L.add('ta-triangulate-wood-shade', poly([[x + 0.8, 60], [x + 3.4, 60], [x + 3.4, 97], [x + 0.8, 97]]));
      L.add(side < 0 ? 'ta-triangulate-flag-a' : 'ta-triangulate-flag-b', flag);
      L.add('ta-triangulate-flag-shade', poly([[x + side * 3.4, 69.5], [x + side * 19, 67.5], [x + side * 3.4, 74]]));
      L.add('ta-triangulate-grass', tuft);
      L.add('ta-triangulate-grass-shade', `M${pt(x - 12, 99)} Q${pt(x, 97.5)} ${pt(x + 12, 99)} Q${pt(x, 102.5)} ${pt(x - 12, 99)} Z`);
      L.add('ta-ink', stake, flag);
      L.add('ta-ink-fine', tuft, line(x - 3.4, 63.5, x + 3.4, 63.5));
    }
    L.add('ta-triangulate-needle', poly([[star.x - 1.5, star.y + 8], [star.x + 1.5, star.y + 8], [star.x, star.y + 23]]));
    L.add('ta-triangulate-star', poly(tips));
    for (let i = 0; i < 10; i += 2) {
      L.add('ta-triangulate-star-light', poly([[star.x, star.y], tips[i], tips[(i + 9) % 10]]));
    }
    L.add('ta-triangulate-star-shade', poly([[star.x, star.y], tips[4], tips[5]]), poly([[star.x, star.y], tips[2], tips[3]]));
    L.add('ta-ink', poly(tips));
    L.add('ta-ink-fine', poly([[star.x - 1.5, star.y + 9], [star.x, star.y + 23], [star.x + 1.5, star.y + 9]], false),
      ...[0, 2, 4, 6, 8].map((i) => line(star.x, star.y, ...tips[i])));
    L.flush();
    return view;
  };

  /**
   * "Obvious Implementation": a brass key sliding straight into a padlock's
   * keyway: it fits. viewBox 0 0 110 90. Parts: .ta-keylock-key (anchor: the
   * key's tip at 56, 63) and .ta-keylock-shackle (pivot 94, 42). State
   * is-turned: the key is fully in and the shackle has sprung open.
   */
  art.keyLock = function keyLock(parent) {
    const view = root(parent, '0 0 110 90', 'key-lock');
    svg('path', { d: `${ellipse(84, 85.6, 24, 3)}`, class: 'ta-shadow' }, view);

    const shackle = svg('g', { class: 'ta-keylock-shackle' }, view);
    const bow = 'M70 49 L70 29 A12 12 0 0 1 94 29 L94 50';
    svg('path', { d: bow, class: 'ta-keylock-shackle-ink' }, shackle);
    svg('path', { d: bow, class: 'ta-keylock-shackle-metal' }, shackle);
    svg('path', { d: 'M68.4 47 L68.4 29 A13.6 13.6 0 0 1 80 15.6', class: 'ta-keylock-shackle-light' }, shackle);

    const key = svg('g', { class: 'ta-keylock-key' }, view);
    const outline = 'M30.4 59.6 L54 59.6 L56.4 63 L54 66.4 L53 66.4 L53 71.4 L49.6 71.4 L49.6 68.8 L46.4 68.8 L46.4 73.4 ' +
      'L42.4 73.4 L42.4 68.8 L39.4 68.8 L39.4 71.6 L36 71.6 L36 66.4 L30.4 66.4 A11.5 11.5 0 1 1 30.4 59.6 Z';
    const hole = circle(16.4, 63, 4.6);
    svg('path', { d: 'M1 55.5 L6.5 55.5 M0.8 63 L5 63 M1 70.5 L6.5 70.5', class: 'ta-ink-fine ta-keylock-motion' }, key);
    svg('path', { d: `${outline} ${hole}`, class: 'ta-keylock-brass' }, key);
    svg('path', { d: `M31 64.4 L55.4 64.4 L54 66.4 L31 66.4 Z ${crescent(19.4, 63, 11.5, -3.4, -4)}`, class: 'ta-keylock-brass-shade' }, key);
    svg('path', { d: `M31.5 61.2 L53.4 61.2 ${arc(19.4, 63, 9.4, 185, 275)}`, class: 'ta-keylock-brass-light' }, key);
    svg('path', { d: `${outline} ${hole}`, class: 'ta-ink-fine' }, key);

    const L = layers(view, ['ta-keylock-body', 'ta-keylock-body-light', 'ta-keylock-body-shade', 'ta-keylock-metal',
      'ta-keylock-metal-shade', 'ta-keylock-dark', 'ta-ink', 'ta-ink-fine']);
    const body = roundRect(60, 42, 44, 42, 8);
    const boss = roundRect(54.5, 53.5, 8.5, 19, 2.5);
    const band = roundRect(60, 56, 44, 14, 0.1);
    L.add('ta-keylock-body', body);
    L.add('ta-keylock-body-light', 'M63 53 L63 51 A6 6 0 0 1 69 45 L96 45 L96 48 L71 48 A5 5 0 0 0 66 53 Z', 'M63 72 L66 72 L66 78 L63 76 Z');
    L.add('ta-keylock-body-shade', 'M97 42 A7 7 0 0 1 104 49 L104 76 A8 8 0 0 1 96 84 L68 84 Q63 84 61 80 L92 80 Q99 80 99 73 L99 44 Z');
    L.add('ta-keylock-metal', band, boss);
    L.add('ta-keylock-metal-shade', 'M99 56 L104 56 L104 70 L99 70 Z', 'M60 67 L104 67 L104 70 L60 70 Z');
    L.add('ta-keylock-dark', roundRect(56.6, 61.2, 4.2, 3.6, 1), circle(70, 63, 1.5), circle(96, 63, 1.5));
    L.add('ta-ink', body);
    L.add('ta-ink-fine', line(60, 56, 104, 56), line(60, 70, 104, 70), boss, line(66.5, 42.4, 73.5, 42.4), line(90.5, 42.4, 97.5, 42.4));
    L.flush();
    return view;
  };

  // ---------------------------------------------------------------- other spots

  /**
   * "A wall of red": a wall-mounted status board with a 4 x 3 grid of round
   * signal lamps. viewBox 0 0 220 150. State is-red: every lamp lit red;
   * default: the lamps are dark glass.
   */
  art.statusBoard = function statusBoard(parent) {
    const view = root(parent, '0 0 220 150', 'status-board');
    const L = layers(view, ['ta-shadow', 'ta-board-frame', 'ta-board-frame-light', 'ta-board-frame-shade', 'ta-board-panel',
      'ta-board-panel-shade', 'ta-board-bezel', 'ta-board-bezel-shade', 'ta-board-glass', 'ta-board-glass-shade',
      'ta-board-glass-core', 'ta-board-glass-spark', 'ta-board-screw', 'ta-ink', 'ta-ink-fine']);
    const housing = roundRect(8, 10, 198, 128, 12);
    const ears = [roundRect(34, 3, 26, 12, 4), roundRect(154, 3, 26, 12, 4)];
    L.add('ta-shadow', roundRect(14, 17, 198, 128, 12));
    L.add('ta-board-frame', ...ears, housing);
    L.add('ta-board-frame-light', 'M12 124 L12 24 A10 10 0 0 1 22 14 L190 14 L186 18 L24 18 A8 8 0 0 0 16 26 L16 120 Z');
    L.add('ta-board-frame-shade', 'M202 24 L202 124 A10 10 0 0 1 192 134 L24 134 L28 130 L190 130 A8 8 0 0 0 198 122 L198 28 Z');
    L.add('ta-board-panel', roundRect(17, 19, 180, 110, 6));
    L.add('ta-board-panel-shade', 'M17 121 L17 25 A6 6 0 0 1 23 19 L197 19 L197 23 L26 23 A5 5 0 0 0 21 28 L21 125 Z');
    const lamps = [];
    for (const y of [40, 74, 108]) for (const x of [41, 85, 129, 173]) lamps.push([x, y]);
    for (const [x, y] of lamps) {
      L.add('ta-board-bezel', circle(x, y, 14.6));
      L.add('ta-board-bezel-shade', crescent(x, y, 14.6, -2.4, -2.8));
      L.add('ta-board-glass', circle(x, y, 11.2));
      L.add('ta-board-glass-shade', crescent(x, y, 11.2, -3.4, -4));
      L.add('ta-board-glass-core', ellipse(x - 2.6, y - 3, 5.4, 4.2, -40));
      L.add('ta-board-glass-spark', ellipse(x - 4.4, y - 5, 2.4, 1.3, -40));
      L.add('ta-ink-fine', circle(x, y, 14.6), circle(x, y, 11.2));
    }
    L.add('ta-board-screw', circle(47, 8.6, 2.4), circle(167, 8.6, 2.4));
    L.add('ta-ink', ...ears, housing);
    L.add('ta-ink-fine', roundRect(17, 19, 180, 110, 6), circle(47, 8.6, 2.4), circle(167, 8.6, 2.4), line(45.4, 8.6, 48.6, 8.6),
      line(165.4, 8.6, 168.6, 8.6));
    L.flush();
    return view;
  };

  /**
   * "Tests planned for later get dropped": a tear-off desk calendar with one
   * date circled in red marker and the top page curling as it is torn off.
   * viewBox 0 0 90 90; no parts, no states.
   */
  art.calendar = function calendar(parent) {
    const view = root(parent, '0 0 90 90', 'calendar');
    const L = layers(view, ['ta-shadow', 'ta-calendar-back', 'ta-calendar-back-shade', 'ta-calendar-stack', 'ta-calendar-page',
      'ta-calendar-head', 'ta-calendar-head-light', 'ta-calendar-cell', 'ta-calendar-next', 'ta-shadow#curl',
      'ta-calendar-flap', 'ta-calendar-flap-light', 'ta-calendar-marker', 'ta-calendar-ring', 'ta-ink', 'ta-ink-fine']);
    const back = roundRect(7, 9, 72, 76, 6);
    L.add('ta-shadow', roundRect(11, 13.5, 72, 74, 6));
    L.add('ta-calendar-back', back);
    L.add('ta-calendar-back-shade', 'M73 9 A6 6 0 0 1 79 15 L79 79 A6 6 0 0 1 73 85 L13 85 Q9 85 8 82 L70 82 Q76 82 76 76 L76 11 Z');
    L.add('ta-calendar-stack', shape.box(14, 16, 62, 65));
    L.add('ta-calendar-page', shape.box(12, 15, 62, 64));
    L.add('ta-calendar-head', shape.box(12, 15, 62, 12));
    L.add('ta-calendar-head-light', shape.box(12, 15, 62, 2.6));
    const beyondFold = (x, y) => (x - 44) * 34 + (y - 79) * 30 > -150;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const x = 17 + col * 10.6;
        const y = 31.5 + row * 9.2;
        if (!beyondFold(x + 7.6, y + 6.2)) L.add('ta-calendar-cell', roundRect(x, y, 7.6, 6.2, 1.4));
      }
    }
    L.add('ta-calendar-next', poly([[44, 79], [74, 45], [74, 79]]));
    L.add('ta-shadow#curl', 'M44 79 Q58 58 74 45 L74 55 Q64 64 54 79 Z');
    const flap = 'M44 79 Q39.5 63 49 54.5 Q59 46.5 74 45 Q58 58 44 79 Z';
    L.add('ta-calendar-flap', flap);
    L.add('ta-calendar-flap-light', 'M45 72 Q43 62 50.5 56 Q55 52.5 61 50.6 Q50 59 45 72 Z');
    L.add('ta-calendar-marker', 'M24.6 46.4 C23 40.6 29.4 37 34.6 38 C40.2 39 42.4 44.6 39.6 48.4 C36.4 52.6 27.6 52.6 25 48.2 C23 44.6 26.6 40 31.6 39.2');
    const rings = [28, 58].map((x) => `M${pt(x, 19.5)} L${pt(x, 9)} A3.2 3.2 0 0 1 ${pt(x + 6.4, 9)} L${pt(x + 6.4, 13)}`);
    L.add('ta-calendar-ring', ...rings);
    L.add('ta-ink', back);
    L.add('ta-ink-fine', shape.box(12, 15, 62, 64), line(12, 27, 74, 27), flap, line(76, 18, 76, 81), line(14, 81, 76, 81),
      circle(28, 20.4, 1.5), circle(58, 20.4, 1.5));
    L.flush();
    return view;
  };

  /**
   * A crumpled paper ball with folded facets: code you throw away.
   * viewBox 0 0 64 60; no parts, no states.
   */
  art.crumpled = function crumpled(parent) {
    const view = root(parent, '0 0 64 60', 'crumpled');
    const L = layers(view, ['ta-shadow', 'ta-crumpled-light', 'ta-crumpled-mid', 'ta-crumpled-dark', 'ta-crumpled-deep', 'ta-ink',
      'ta-ink-fine']);
    const rim = [[10, 18], [17, 9], [24, 11], [31, 4], [40, 9], [47, 7], [54, 17], [52, 25], [58, 33], [51, 43], [42, 52], [33, 49],
      [24, 54], [14, 48], [9, 40], [5, 30], [11, 25]];
    const a = [20, 20];
    const b = [30, 15];
    const c = [41, 19];
    const d = [47, 29];
    const e = [36, 30];
    const f = [25, 31];
    const g = [15, 33];
    const h = [22, 43];
    const i = [34, 41];
    const j = [44, 40];
    L.add('ta-shadow', ellipse(34, 52, 25, 5));
    L.add('ta-crumpled-light', poly([rim[0], rim[1], a]), poly([rim[1], rim[2], a]), poly([rim[2], rim[3], b]), poly([rim[2], b, a]),
      poly([rim[16], rim[0], a, g]), poly([a, b, f]), poly([b, c, e]));
    L.add('ta-crumpled-mid', poly([rim[3], rim[4], b]), poly([rim[4], c, b]), poly([b, e, f]), poly([rim[15], rim[16], g]),
      poly([g, f, h]), poly([e, d, j, i]), poly([rim[5], rim[6], c]));
    L.add('ta-crumpled-dark', poly([rim[4], rim[5], c]), poly([rim[6], rim[7], d, c]), poly([c, d, e]), poly([f, e, i, h]),
      poly([a, f, g]), poly([rim[14], rim[15], g]), poly([rim[13], rim[14], g, h]), poly([rim[10], rim[11], i, j]));
    L.add('ta-crumpled-deep', poly([rim[7], rim[8], d]), poly([rim[8], rim[9], j, d]), poly([rim[9], rim[10], j]),
      poly([rim[11], rim[12], h, i]), poly([rim[12], rim[13], h]));
    L.add('ta-ink', poly(rim));
    L.add('ta-ink-fine', poly([rim[1], a, f, e, c, rim[5]], false), poly([rim[3], b, e], false), poly([rim[16], g, f], false),
      poly([f, h, rim[12]], false), poly([e, i, j, rim[9]], false), poly([rim[7], d, j], false), poly([a, b], false),
      poly([g, h], false), poly([i, rim[11]], false), poly([c, d], false), line(29, 22, 33, 24), line(18, 38, 21, 36),
      line(40, 34, 43, 36));
    L.flush();
    return view;
  };
})();

// ------------------------------------------------------------------
// Rule one, test first, and rule two, watch it fail
// ------------------------------------------------------------------

// The metaphors for "test first" (a target painted around the arrow) and
// "watch it fail" (a smoke alarm and its test button), the flashlight panel,
// and four small spots.
(function () {
  'use strict';

  const { svg } = window.SongKit;
  const { shape } = window.ArchKit;
  const art = (window.TddArt = window.TddArt || {});

  // ---------------------------------------------------------------- helpers

  const n = shape.round;
  const pt = (x, y) => `${n(x)} ${n(y)}`;
  const rad = (deg) => (deg * Math.PI) / 180;
  const path = (parent, cls, d) => svg('path', { class: cls, d }, parent);
  const group = (parent, cls) => svg('g', { class: cls }, parent);
  const poly = (points) => (points.length < 3 ? '' : `M${points.map(([x, y]) => pt(x, y)).join('L')}Z`);

  /** Clockwise ellipse (pass hole = true for a counter-clockwise one that cuts a hole in a clockwise shape). */
  function ellipse(cx, cy, rx, ry, hole = false) {
    const sweep = hole ? 0 : 1;
    return `M${pt(cx - rx, cy)}a${n(rx)} ${n(ry)} 0 1 ${sweep} ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 ${sweep} ${n(-2 * rx)} 0Z`;
  }

  /** Clockwise circular arc from angle a0 to a1 (degrees, 0 = right, 90 = down). */
  function arc(cx, cy, r, a0, a1) {
    const large = (a1 - a0) % 360 > 180 ? 1 : 0;
    return `M${pt(cx + r * Math.cos(rad(a0)), cy + r * Math.sin(rad(a0)))}A${n(r)} ${n(r)} 0 ${large} 1 ${pt(cx + r * Math.cos(rad(a1)), cy + r * Math.sin(rad(a1)))}`;
  }

  /** Maps local (u, v) to picture coordinates: origin (ox, oy), u axis turned by deg, scaled. */
  function place(ox, oy, deg, scale = 1) {
    const c = Math.cos(rad(deg)) * scale;
    const s = Math.sin(rad(deg)) * scale;
    const xy = (u, v) => [ox + u * c - v * s, oy + u * s + v * c];
    const p = (u, v) => pt(...xy(u, v));
    p.xy = xy;
    p.poly = (points) => poly(points.map(([u, v]) => xy(u, v)));
    return p;
  }

  const FRAME = { inset: 3, radius: 14 };

  /** The panel frame's outline, and the bottom edge that closes a backdrop shape started at the right frame edge. */
  function frameOutline(W, H) {
    const { inset: i, radius: r } = FRAME;
    return `M${i} ${i + r}a${r} ${r} 0 0 1 ${r} ${-r}H${W - i - r}a${r} ${r} 0 0 1 ${r} ${r}${frameFloor(H)}`;
  }
  function frameFloor(H) {
    const { inset: i, radius: r } = FRAME;
    return `V${H - i - r}a${r} ${r} 0 0 1 ${-r} ${r}H${i + r}a${r} ${r} 0 0 1 ${-r} ${-r}Z`;
  }
  /** A full-width backdrop band from y0 down to y1, or down to the rounded frame bottom when y1 is omitted. */
  function frameBand(W, H, y0, y1) {
    const { inset: i } = FRAME;
    return `M${i} ${y0}H${W - i}${y1 === undefined ? frameFloor(H) : `V${y1}H${i}Z`}`;
  }

  /** Sutherland-Hodgman: the part of a polygon inside a convex clip polygon. */
  function clipConvex(subject, clip) {
    const area = clip.reduce((sum, [x, y], i) => {
      const [x2, y2] = clip[(i + 1) % clip.length];
      return sum + x * y2 - x2 * y;
    }, 0);
    const sign = area >= 0 ? 1 : -1;
    let out = subject;
    for (let i = 0; i < clip.length && out.length; i += 1) {
      const a = clip[i];
      const b = clip[(i + 1) % clip.length];
      const side = ([x, y]) => sign * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]));
      const input = out;
      out = [];
      input.forEach((p, j) => {
        const q = input[(j + 1) % input.length];
        const sp = side(p);
        const sq = side(q);
        if (sp >= 0) out.push(p);
        if (sp >= 0 !== sq >= 0) out.push([p[0] + (sp / (sp - sq)) * (q[0] - p[0]), p[1] + (sp / (sp - sq)) * (q[1] - p[1])]);
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- archery

  const RING_PAINTS = ['gold', 'red', 'blue', 'black', 'white'];

  /** Sky, clouds, hedge, and grass shared by both archery pictures. */
  function drawRange(root) {
    path(root, 'ta-archery-sky', frameOutline(300, 210));
    path(root, 'ta-archery-haze', 'M3 88H297V132H3Z');
    const cloud = (x, y, s) => `M${pt(x, y)}h${n(52 * s)}a${n(7.5 * s)} ${n(7.5 * s)} 0 0 0 ${n(-6 * s)} ${n(-13 * s)}`
      + `a${n(10 * s)} ${n(10 * s)} 0 0 0 ${n(-16 * s)} ${n(-7 * s)}a${n(9.5 * s)} ${n(9.5 * s)} 0 0 0 ${n(-17 * s)} ${n(6 * s)}`
      + `a${n(10 * s)} ${n(10 * s)} 0 0 0 ${n(-13 * s)} ${n(14 * s)}Z`;
    path(root, 'ta-archery-cloud', cloud(14, 31, 1) + cloud(228, 29, 1.05) + cloud(118, 62, 0.8));
    path(root, 'ta-archery-cloud-shade', 'M19 31h43q-21 -6.5 -43 0ZM233 29h46q-23 -7 -46 0ZM122 62h34q-17 -5 -34 0Z');

    const widths = [22, 30, 18, 26, 34, 20, 28, 24, 32, 22, 18, 20];
    const tops = [118, 115, 120, 114, 119, 116, 121, 115, 118, 120, 114, 119, 117];
    let hedge = `M3 134V${tops[0]}`;
    let light = '';
    let x = 3;
    widths.forEach((w, i) => {
      light += ellipse(x + w * 0.42, Math.min(tops[i], tops[i + 1]) - w * 0.05, w * 0.26, w * 0.13);
      x += w;
      hedge += `A${n(w * 0.6)} ${n(w * 0.6)} 0 0 1 ${x} ${tops[i + 1]}`;
    });
    path(root, 'ta-archery-hedge', `${hedge}V134Z${ellipse(25, 107, 15, 15)}${ellipse(278, 104, 17, 17)}`);
    path(root, 'ta-archery-hedge-light', light + ellipse(20, 99, 6.5, 4) + ellipse(272, 95, 7.5, 4.5));
    path(root, 'ta-archery-hedge-shade', 'M3 126Q40 123 78 126T150 125T224 126T297 124V134H3Z');

    path(root, 'ta-archery-grass', `M3 130Q75 125 150 129T297 127${frameFloor(210)}`);
    path(root, 'ta-archery-grass-light', ellipse(84, 146, 62, 5) + ellipse(226, 180, 56, 6) + ellipse(70, 198, 40, 4.5) + ellipse(262, 146, 28, 3.5));
    const tuft = (tx, ty) => `M${pt(tx - 3, ty)}q1 -4 -1.5 -6.5M${pt(tx, ty)}v-7.5M${pt(tx + 3, ty)}q-0.5 -4 2 -6`;
    path(root, 'ta-archery-tuft', tuft(22, 150) + tuft(34, 178) + tuft(282, 160) + tuft(270, 196) + tuft(150, 200) + tuft(190, 186) + tuft(14, 196) + tuft(286, 138));
  }

  /**
   * Draws an arrow from its nock (tail) to its point (tip): shaft, two vanes, nock, and
   * optionally a metal head (an arrow stuck in something hides its head) and a cast shadow.
   */
  function drawArrow(parent, tail, tip, { head = false, shadow = null } = {}) {
    const length = Math.hypot(tip[0] - tail[0], tip[1] - tail[1]);
    const p = place(tail[0], tail[1], (Math.atan2(tip[1] - tail[1], tip[0] - tail[0]) * 180) / Math.PI);
    const end = head ? length - 10 : length;
    if (shadow) {
      const s = place(tail[0] + shadow[0], tail[1] + shadow[1], (Math.atan2(tip[1] - tail[1] - shadow[1], tip[0] - tail[0] - shadow[0]) * 180) / Math.PI);
      const sl = Math.hypot(tip[0] - tail[0] - shadow[0], tip[1] - tail[1] - shadow[1]);
      path(parent, 'ta-shadow', s.poly([[0, -1.6], [4, -1.6], [8, -6], [21, -6], [27, -1.6], [sl, 0], [27, 1.6], [21, 6], [8, 6], [4, 1.6], [0, 1.6]]));
    }
    path(parent, 'ta-archery-vane', p.poly([[4, 1.7], [27, 1.7], [21, 8], [8, 8]]));
    path(parent, 'ta-archery-vane-light', p.poly([[4, -1.7], [8, -8], [21, -8], [27, -1.7]]));
    path(parent, 'ta-archery-shaft', p.poly([[0, -1.8], [end, -1.8], [end, 1.8], [0, 1.8]]));
    path(parent, 'ta-archery-nock', p.poly([[-3, -2.3], [3, -2.3], [3, 2.3], [-3, 2.3]]) + p.poly([[30, -1.8], [34, -1.8], [34, 1.8], [30, 1.8]]));
    let ink = p.poly([[-3, -2.3], [3, -2.3], [3, -1.8], [end, -1.8], [end, 1.8], [3, 1.8], [3, 2.3], [-3, 2.3]])
      + p.poly([[4, -1.8], [8, -8], [21, -8], [27, -1.8]]) + p.poly([[4, 1.8], [8, 8], [21, 8], [27, 1.8]])
      + `M${p(10, -1.8)}L${p(13, -8)}M${p(16, -1.8)}L${p(19, -8)}M${p(10, 1.8)}L${p(13, 8)}M${p(16, 1.8)}L${p(19, 8)}`;
    if (head) {
      const headShape = p.poly([[end, -1.8], [end - 1, -4.2], [length, 0], [end - 1, 4.2], [end, 1.8]]);
      path(parent, 'ta-archery-point', headShape);
      ink += headShape;
    }
    path(parent, 'ta-ink-fine', ink);
  }

  /** "Test after": a barn wall with an arrow in it and wet target rings painted around the arrow. */
  function drawPaintedTarget(root) {
    const plankX = [52, 80, 108, 136, 164, 192, 220, 248];
    const plankTop = [37, 34, 38, 35, 37, 33, 36];
    const plank = (i, inset = 0, width = 28) => `M${plankX[i] + inset} ${plankTop[i]}h${width}V160h${-width}Z`;

    path(root, 'ta-shadow', 'M52 160H248L262 169H66Z');
    let wall = 'M52 160';
    plankTop.forEach((top, i) => { wall += `V${top}H${plankX[i + 1]}`; });
    wall += 'V160Z';
    path(root, 'ta-archery-wood', wall);
    path(root, 'ta-archery-wood-light', plank(1) + plank(4) + plank(6));
    path(root, 'ta-archery-wood-shade', `${plank(3)}M52 151H248V160H52Z`);
    path(root, 'ta-archery-wood-edge', plankTop.map((top, i) => plank(i, 1.2, 1.8)).join(''));
    path(root, 'ta-archery-grain', 'M60 58q3 14 0 30M71 108q-3 12 0 26M93 46q2 10 0 20M237 60q3 16 0 34M229 112q-2 12 1 28M205 42q2 6 0 12'
      + 'M66 44q2 5 0 9M120 146q1 5 0 9M181 148q-1 4 0 8M97 124a3 4.5 0 1 0 6 0a3 4.5 0 1 0 -6 0M231 48a2.6 4 0 1 0 5.2 0a2.6 4 0 1 0 -5.2 0');
    path(root, 'ta-archery-nail', plankTop.map((top, i) => shape.circle(plankX[i] + 14, top + 7, 1.3) + shape.circle(plankX[i] + 14, 153, 1.3)).join(''));
    path(root, 'ta-ink-fine', plankTop.slice(1).map((top, i) => `M${plankX[i + 1]} ${Math.max(top, plankTop[i])}V160`).join(''));
    path(root, 'ta-ink', wall);

    // Rings: painted from the center outward, each with wet drips.
    const center = [160, 95];
    const dripWidth = 3.4;
    const drips = [[[2, 6]], [[-7, 8]], [[4, 9]], [[-10, 10], [22, 7]], [[-24, 13], [12, 8], [33, 10]]];
    for (let k = 5; k >= 1; k -= 1) {
      const R = 10 * k;
      const ring = group(root, `ta-archery-ring-${k}`);
      const edgeY = (dx) => center[1] + Math.sqrt(R * R - dx * dx);
      let fill = ellipse(center[0], center[1], R, R) + (k > 1 ? ellipse(center[0], center[1], R - 10, R - 10, true) : '');
      let ink = '';
      const gaps = [];
      drips[k - 1].forEach(([dx, len]) => {
        const x0 = center[0] + dx - dripWidth / 2;
        const x1 = x0 + dripWidth;
        const bottom = edgeY(dx) + len;
        fill += `M${pt(x0, edgeY(dx) - 4)}H${n(x1)}V${n(bottom)}A${dripWidth / 2} ${dripWidth / 2} 0 0 1 ${pt(x0, bottom)}Z`;
        ink += `M${pt(x0, edgeY(dx - dripWidth / 2))}V${n(bottom)}A${dripWidth / 2} ${dripWidth / 2} 0 0 0 ${pt(x1, bottom)}V${n(edgeY(dx + dripWidth / 2))}`;
        gaps.push([Math.acos((dx + dripWidth / 2) / R), Math.acos((dx - dripWidth / 2) / R)]);
      });
      gaps.sort((a, b) => a[0] - b[0]);
      gaps.forEach(([, from], i) => {
        const to = gaps[(i + 1) % gaps.length][0] + (i === gaps.length - 1 ? 2 * Math.PI : 0);
        ink += `M${pt(center[0] + R * Math.cos(from), center[1] + R * Math.sin(from))}A${R} ${R} 0 ${to - from > Math.PI ? 1 : 0} 1 ${pt(center[0] + R * Math.cos(to), center[1] + R * Math.sin(to))}`;
      });
      path(ring, `ta-archery-paint-${RING_PAINTS[k - 1]}`, fill);
      path(ring, 'ta-ink-fine', ink);
    }
    path(root, 'ta-archery-sheen', `${arc(160, 95, 45, 196, 236)}${arc(160, 95, 25, 200, 232)}`);

    const arrow = group(root, 'ta-archery-arrow');
    drawArrow(arrow, [84, 70], center, { shadow: [7, 10] });
    path(arrow, 'ta-archery-hole', ellipse(159.4, 94.8, 2.6, 2.2));

    // Paint can, open, with white paint.
    path(root, 'ta-shadow', ellipse(242, 199, 21, 5));
    path(root, 'ta-archery-metal', 'M213 164V196A19 6 0 0 0 251 196V164Z');
    path(root, 'ta-archery-label', 'M213 172A19 6 0 0 0 251 172V190A19 6 0 0 1 213 190Z');
    path(root, 'ta-archery-can-shade', 'M243 169L251 164V196Q249 199.5 243 201Z');
    path(root, 'ta-archery-can-light', 'M217 167.4V199.6l4 1.2V168.8Z');
    path(root, 'ta-archery-metal-light', ellipse(232, 164, 19, 6));
    path(root, 'ta-archery-paint-white', `${ellipse(232, 164.5, 15.5, 4.3)}M238.5 167.5q0.6 9 -0.4 13a2.1 2.1 0 0 0 4.2 0q-0.6 -8 0.6 -14.5Z`);
    path(root, 'ta-ink', `M213 164V196A19 6 0 0 0 251 196V164${ellipse(232, 164, 19, 6)}`);
    path(root, 'ta-ink-fine', `${ellipse(232, 164.5, 15.5, 4.3)}M213 172A19 6 0 0 0 251 172M213 190A19 6 0 0 0 251 190`
      + 'M238.5 168.5q0.4 8 -0.4 12a2.1 2.1 0 0 0 4.2 0q-0.6 -8 0.5 -12.5M213.6 167Q213 185 224 190M250.4 167Q251 181 246 187');

    // Brush lying on the grass, its wet tip toward the wall.
    const brush = group(root, 'ta-archery-brush');
    const b = place(62, 197, -26);
    const s = place(65, 200, -26);
    path(brush, 'ta-shadow', s.poly([[0, -2.4], [30, -4], [30, -5], [41, -5.6], [55, -7], [62, 0], [55, 7], [41, 5.6], [30, 5], [30, 4], [0, 2.4]]));
    path(brush, 'ta-archery-handle', `M${b(0, -2.6)}L${b(30, -4)}L${b(30, 4)}L${b(0, 2.6)}Q${b(-3.4, 0)} ${b(0, -2.6)}Z`);
    path(brush, 'ta-archery-handle-light', b.poly([[1, -1.9], [29.5, -3.2], [29.5, -1.5], [1, -0.7]]));
    path(brush, 'ta-archery-metal', b.poly([[30, -5], [41, -5.6], [41, 5.6], [30, 5]]));
    path(brush, 'ta-archery-bristle', b.poly([[41, -5.6], [55, -7], [60, -4], [62, 0], [60, 4.5], [55, 7], [41, 5.6]]));
    path(brush, 'ta-archery-paint-white', b.poly([[49, -6.5], [55, -7], [60, -4], [62, 0], [60, 4.5], [55, 7], [49.5, 6.5], [51.5, 3.5], [49.5, 0.5], [52, -3]]) + ellipse(120, 177, 2.6, 1.3));
    path(brush, 'ta-ink', `M${b(0, -2.6)}L${b(30, -4)}L${b(30, -5)}L${b(41, -5.6)}L${b(55, -7)}L${b(60, -4)}L${b(62, 0)}L${b(60, 4.5)}L${b(55, 7)}L${b(41, 5.6)}L${b(30, 5)}L${b(30, 4)}L${b(0, 2.6)}Q${b(-3.4, 0)} ${b(0, -2.6)}Z`);
    path(brush, 'ta-ink-fine', `M${b(30, -5)}L${b(30, 5)}M${b(41, -5.6)}L${b(41, 5.6)}M${b(35.5, -5.3)}L${b(35.5, 5.3)}M${b(44, -2.5)}L${b(49, -2.8)}M${b(44, 1.5)}L${b(48.5, 1.6)}M${b(44, 4.2)}L${b(48, 4.6)}`);
  }

  /** "Test first": a straw target on an A-frame stand, an arrow in flight, and an arrow in the gold. */
  function drawStandingTarget(root) {
    const strip = ([x1, y1], [x2, y2], w) => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const px = (-(y2 - y1) / len) * (w / 2);
      const py = ((x2 - x1) / len) * (w / 2);
      return poly([[x1 + px, y1 + py], [x2 + px, y2 + py], [x2 - px, y2 - py], [x1 - px, y1 - py]]);
    };
    // A far pennant marks the range.
    path(root, 'ta-archery-nock', 'M96 108L109 111.5L96 115Z');
    path(root, 'ta-ink-fine', 'M96 131V107.5L109 111.5L96 115');

    path(root, 'ta-shadow', ellipse(216, 190, 48, 7));
    const backLeg = strip([209, 24], [256, 182], 5);
    path(root, 'ta-archery-wood-shade', backLeg);
    const frontLegs = strip([199, 23], [169, 187], 6.5) + strip([207, 23], [233, 195], 6.5);
    const brace = strip([173, 166], [230, 175], 5);
    path(root, 'ta-archery-wood', frontLegs + brace);
    path(root, 'ta-archery-wood-edge', strip([197.3, 24], [167.4, 186], 1.6) + strip([205.2, 24], [231, 194], 1.6));
    path(root, 'ta-ink-fine', backLeg + frontLegs + brace);

    const side = 'M200 28L213 28A41 62 0 0 1 213 152L200 152A41 62 0 0 0 200 28Z';
    path(root, 'ta-archery-straw-shade', side);
    path(root, 'ta-archery-straw', ellipse(200, 90, 41, 62));
    path(root, 'ta-archery-straw-line', 'M204.5 28.4A41 62 0 0 1 204.5 151.6M209 28.2A41 62 0 0 1 209 151.8'
      + `${ellipse(200, 90, 38.6, 58.4)}`);
    for (let k = 5; k >= 1; k -= 1) path(root, `ta-archery-paint-${RING_PAINTS[k - 1]}`, ellipse(200, 90, 7.2 * k, 11 * k));
    path(root, 'ta-archery-face-shade', 'M200 145A36 55 0 0 0 236 90A36 55 0 0 0 232 65A44 62 0 0 1 200 145Z');
    path(root, 'ta-ink-fine', [1, 2, 3, 4, 5].map((k) => ellipse(200, 90, 7.2 * k, 11 * k)).join(''));
    path(root, 'ta-ink', `${ellipse(200, 90, 41, 62)}M200 28L213 28A41 62 0 0 1 213 152L200 152`);

    const hit = group(root, 'ta-archery-arrow');
    path(hit, 'ta-shadow', 'M199 90L171 95.4L171 98.6Z');
    drawArrow(hit, [124, 85], [199, 90]);
    path(hit, 'ta-archery-hole', ellipse(198.6, 90, 2, 2.6));

    const flight = group(root, 'ta-archery-flight');
    drawArrow(flight, [30, 90], [102, 90], { head: true });
    path(flight, 'ta-ink-fine', 'M8 85.5H25M13 94.5H26');
  }

  /**
   * A framed archery-range picture for rule one, "test first". mode 'painted' shows a target being painted
   * around an arrow already stuck in a barn wall (a test written after the code always looks like a hit);
   * mode 'first' shows a real target on a stand that the arrow has to hit. viewBox 0 0 300 210.
   * Parts (painted): .ta-archery-ring-1 (gold center) to .ta-archery-ring-5 (outer white), .ta-archery-brush,
   * .ta-archery-arrow. Parts (first): .ta-archery-arrow, .ta-archery-flight; states is-flying and is-hit.
   */
  art.archery = function archery(parent, options = {}) {
    const mode = options.mode === 'first' ? 'first' : 'painted';
    const root = svg('svg', { viewBox: '0 0 300 210', class: `ta-art ta-archery ta-archery-mode-${mode}`, 'aria-hidden': 'true' }, parent);
    drawRange(root);
    if (mode === 'first') drawStandingTarget(root);
    else drawPaintedTarget(root);
    path(root, 'ta-ink', frameOutline(300, 210));
    return root;
  };

  // ------------------------------------------------------------------ alarm

  /** A chain of overlapping puffs, each [x, y, radius], grown by `grow` and shifted by (dx, dy). */
  const puffs = (chain, grow = 0, dx = 0, dy = 0, scale = 1) => chain.map(([x, y, r]) => shape.circle(x + dx, y + dy, r * scale + grow)).join('');

  /**
   * A framed kitchen picture for rule two, "watch it fail": a smoke alarm on the ceiling above a frying pan on
   * the stove. viewBox 0 0 300 220. States: is-silent (green LED), is-sounding (red LED and sound waves,
   * part .ta-alarm-waves), is-dead (battery hatch open, 9-volt battery dangling, LED dark; part
   * .ta-alarm-hatch), has-smoke (part .ta-alarm-smoke), is-pressed (test button pushed in with press marks,
   * part .ta-alarm-press; the raised button is .ta-alarm-button).
   */
  art.alarm = function alarm(parent) {
    const root = svg('svg', { viewBox: '0 0 300 220', class: 'ta-art ta-alarm', 'aria-hidden': 'true' }, parent);

    // Room: ceiling, wall, backsplash tiles, stove top.
    path(root, 'ta-alarm-ceiling', frameOutline(300, 220));
    path(root, 'ta-alarm-wall', 'M3 62H297V136H3Z');
    path(root, 'ta-alarm-wall-shade', 'M3 62H297V67.5H3Z');
    path(root, 'ta-alarm-tile', 'M3 100H297V136H3Z');
    const tile = (x, row, w = 18) => `M${x} ${100 + 18 * row}h${w}v18h${-w}Z`;
    path(root, 'ta-alarm-tile-deep', tile(30, 0) + tile(102, 0) + tile(246, 0) + tile(66, 1) + tile(210, 1) + tile(282, 1, 15) + tile(3, 1, 9));
    let grout = 'M3 118H297M3 98.6H297';
    for (let x = 12; x < 297; x += 18) grout += `M${x} 100V136`;
    path(root, 'ta-alarm-grout', grout);
    path(root, 'ta-alarm-stove', frameBand(300, 220, 136));
    path(root, 'ta-alarm-stove-lip', frameBand(300, 220, 208));
    path(root, 'ta-ink-fine', 'M3 136H297M3 62H297');

    // Burners, flames, and the pan with an egg; the handle points right and up, clear of the label area.
    const h = place(206, 144, -14.2);
    path(root, 'ta-shadow', ellipse(160, 168, 56, 12));
    path(root, 'ta-alarm-iron', ellipse(46, 178, 34, 9) + ellipse(46, 178, 26, 6.2, true) + ellipse(46, 178, 9, 2.6)
      + ellipse(150, 165, 53, 13.5) + ellipse(150, 165, 39, 9, true)
      + `M${h(12, -4.2)}L${h(80, -5.4)}Q${h(87.5, -5.4)} ${h(87.5, 0)}Q${h(87.5, 5.4)} ${h(80, 5.4)}L${h(12, 4.2)}Z`);
    path(root, 'ta-alarm-iron-light', h.poly([[13, -3.3], [80, -4.4], [84.5, -2.8], [80, -2], [13, -1.3]])
      + 'M14 176A34 9 0 0 1 46 169A34 9 0 0 0 20 174Z');
    const body = 'M92 145Q94 157 106 162A44 11 0 0 0 194 162Q206 157 208 145A58 15 0 0 1 92 145Z';
    path(root, 'ta-alarm-copper', body);
    path(root, 'ta-alarm-copper-shade', 'M170 160Q198 156 208 146Q206 157 194 162Q185 170.5 166 172.6Q176 168 170 160Z');
    path(root, 'ta-alarm-copper-light', `${ellipse(150, 145, 58, 15)}M94 150Q96.5 158.5 107 163.2Q102.5 157 100.5 152Z`);
    path(root, 'ta-alarm-pan-inside', ellipse(150, 146, 53.5, 12.6));
    path(root, 'ta-alarm-pan-floor', ellipse(150, 149.6, 43, 8.8));
    path(root, 'ta-alarm-egg', 'M121 149.4C121 145 131 143.2 139.5 143.8C147 142.6 158.5 144.4 159.5 148.6C161 152.8 151 156 142.5 155.4C133 156.6 121 154 121 149.4Z');
    path(root, 'ta-alarm-yolk', ellipse(138.5, 148.8, 6.4, 3));
    path(root, 'ta-alarm-metal', h.poly([[-1, -3], [14, -3.2], [14, 3.2], [-1, 3]]) + ellipse(137, 147.9, 2.2, 0.9));
    path(root, 'ta-ink', `${body}${ellipse(150, 145, 58, 15)}M${h(14, -4.2)}L${h(80, -5.4)}Q${h(87.5, -5.4)} ${h(87.5, 0)}Q${h(87.5, 5.4)} ${h(80, 5.4)}L${h(14, 4.2)}`);
    path(root, 'ta-ink-fine', `${ellipse(150, 146, 53.5, 12.6)}${ellipse(138.5, 148.8, 6.4, 3)}${h.poly([[-1, -3], [14, -3.2], [14, 3.2], [-1, 3]])}`
      + `${shape.circle(...h.xy(80.5, 0), 1.9)}M${h(5, -3)}L${h(5, 3)}`
      + 'M121 149.4C121 145 131 143.2 139.5 143.8C147 142.6 158.5 144.4 159.5 148.6C161 152.8 151 156 142.5 155.4C133 156.6 121 154 121 149.4Z');

    // Gas flames lick up the front of the pan.
    let flames = '';
    let flameCores = '';
    for (let a = 24, i = 0; a <= 156; a += 12, i += 1) {
      const fx = 150 + 45 * Math.cos(rad(a));
      const fy = 167.5 + 10.5 * Math.sin(rad(a));
      const tall = i % 2 ? 7 : 10;
      const tongue = (w, hgt) => `M${pt(fx - w, fy)}Q${pt(fx - w, fy - hgt * 0.55)} ${pt(fx + 0.8, fy - hgt)}Q${pt(fx + w, fy - hgt * 0.45)} ${pt(fx + w, fy)}Z`;
      flames += tongue(3.6, tall);
      flameCores += tongue(1.7, tall * 0.55);
    }
    path(root, 'ta-alarm-flame', flames);
    path(root, 'ta-alarm-flame-core', flameCores);

    // Smoke rising from the pan to the alarm.
    const smoke = group(root, 'ta-alarm-smoke');
    const column = [[150, 137, 6], [156, 127, 7.2], [164, 117, 8.6], [170, 105.5, 10], [166, 94, 11], [172, 83, 11.5], [183, 76, 10], [196, 72.5, 7.5], [160, 76, 8.5]];
    const wisp = [[178, 137, 4.4], [183, 129.5, 5.4], [189, 121, 6.4], [194, 111.5, 7], [191, 102, 5.6]];
    path(smoke, 'ta-alarm-smoke-edge', puffs(column, 1.4) + puffs(wisp, 1.4));
    path(smoke, 'ta-alarm-smoke-body', puffs(column) + puffs(wisp));
    path(smoke, 'ta-alarm-smoke-light', puffs(column.slice(1, 7), 0, -2.6, -2.4, 0.58) + puffs(wisp.slice(1, 4), 0, -1.6, -1.6, 0.55));
    path(smoke, 'ta-alarm-smoke-curl', 'M176 106q-1 -7 -7.5 -6.5q-5.5 0.8 -4.5 6q1 3.6 4.6 2.6M178.5 84q-1.4 -7.6 -8.4 -6.6q-5.6 1.2 -4.2 6.6q1.2 3.4 4.6 2.2M169 118q-0.6 -4.6 -5 -4.2M196 112q-0.6 -4.2 -4.6 -3.8');

    // Sound waves on both sides of the alarm.
    const waves = group(root, 'ta-alarm-waves');
    let arcs = '';
    for (let k = 1; k <= 3; k += 1) {
      const d = 58 + 14 * k;
      const hgt = 9 + 6.5 * k;
      const bulge = 4 + 2 * k;
      arcs += `M${pt(150 - d + bulge, 40 - hgt)}Q${pt(150 - d - bulge, 40)} ${pt(150 - d + bulge, 40 + hgt)}`
        + `M${pt(150 + d - bulge, 40 - hgt)}Q${pt(150 + d + bulge, 40)} ${pt(150 + d - bulge, 40 + hgt)}`;
    }
    path(waves, 'ta-alarm-wave', arcs);

    // The alarm, seen from below: a base on the ceiling, a side band with vent slots, and the round face.
    const face = (rho, deg) => [150 + 46 * rho * Math.cos(rad(deg)), 46 + 20 * rho * Math.sin(rad(deg))];
    const fp = (rho, deg) => pt(...face(rho, deg));
    path(root, 'ta-shadow', ellipse(158, 41, 52, 23.5));
    path(root, 'ta-alarm-side', `${ellipse(150, 33, 50, 22)}M100 33H200L196 46H104Z${ellipse(150, 46, 46, 20)}`);
    path(root, 'ta-alarm-side-shade', 'M172 13.3A50 22 0 0 1 200 33L196 46A46 20 0 0 0 172 28.5Z');
    let slots = '';
    for (let x = 114; x <= 186; x += 9) {
      const top = 33 - 22 * Math.sqrt(1 - ((x - 150) / 50) ** 2) + 3.4;
      const bottom = 46 - 20 * Math.sqrt(1 - ((x - 150) / 46) ** 2) - 3.2;
      slots += `M${pt(x, top)}V${n(bottom)}`;
    }
    path(root, 'ta-alarm-face', ellipse(150, 46, 46, 20));
    path(root, 'ta-alarm-face-shade', 'M196 46A46 20 0 0 1 128 63.56Q172 61.5 196 46Z');
    const grille = (rho) => `M${fp(rho, 222)}A${n(46 * rho)} ${n(20 * rho)} 0 0 1 ${fp(rho, 318)}`;
    path(root, 'ta-alarm-slot', slots + grille(0.66) + grille(0.82));
    path(root, 'ta-alarm-led-bezel', ellipse(169.5, 55.2, 8.6, 4.6));
    path(root, 'ta-alarm-led', ellipse(169.5, 55.2, 6.8, 3.5));
    path(root, 'ta-alarm-led-glint', ellipse(167.4, 54.2, 2.4, 1));
    const hatch = `M${fp(0.46, 150)}A${n(46 * 0.46)} ${n(20 * 0.46)} 0 0 0 ${fp(0.46, 105)}L${fp(0.82, 105)}A${n(46 * 0.82)} ${n(20 * 0.82)} 0 0 1 ${fp(0.82, 150)}Z`;
    path(root, 'ta-ink-fine ta-alarm-hatch-seam', hatch);
    path(root, 'ta-ink', 'M100 33A50 22 0 0 1 200 33L196 46A46 20 0 0 1 104 46Z');
    path(root, 'ta-ink-fine', `M104 46A46 20 0 0 1 196 46${ellipse(169.5, 55.2, 8.6, 4.6)}`);

    // Test button: raised, or pushed in with press marks.
    const button = group(root, 'ta-alarm-button');
    path(button, 'ta-alarm-button-side', `${ellipse(150, 46, 12, 5.2)}M138 46H162V49H138Z${ellipse(150, 49, 12, 5.2)}`);
    path(button, 'ta-alarm-button-top', ellipse(150, 49, 12, 5.2));
    path(button, 'ta-alarm-button-glint', 'M141 48.4A9.6 3.8 0 0 1 149 45.4A12 5 0 0 0 141 48.4Z');
    path(button, 'ta-ink-fine', `M138 46A12 5.2 0 0 1 162 46V49A12 5.2 0 0 1 138 49Z${ellipse(150, 49, 12, 5.2)}`);
    const press = group(root, 'ta-alarm-press');
    path(press, 'ta-alarm-button-side', ellipse(150, 46, 12, 5.2));
    path(press, 'ta-alarm-button-top', ellipse(150, 47.2, 10.2, 4));
    path(press, 'ta-ink-fine', ellipse(150, 46, 12, 5.2) + 'M139.8 47.2A10.2 4 0 0 0 160.2 47.2');
    path(press, 'ta-alarm-press-mark', [200, 270, 340, 30, 150].map((a) => `M${fp(0.37, a)}L${fp(0.56, a)}`).join(''));

    // Dead alarm: the hatch hangs open and the battery dangles from its clip.
    const dead = group(root, 'ta-alarm-hatch');
    const bt = place(124, 88, 7);
    const sh = place(129.5, 92, 7);
    path(dead, 'ta-shadow', sh.poly([[-10, 0], [10, 0], [10, 36], [-10, 36]]));
    path(dead, 'ta-alarm-hole', hatch);
    const door = `M${fp(0.82, 150)}A37.7 16.4 0 0 0 ${fp(0.82, 105)}L137.6 79.5Q128.5 79 122 74Z`;
    path(dead, 'ta-alarm-door', door);
    path(dead, 'ta-alarm-wire-dark', `M130 56.5C134 68 122 77 ${bt(-3.4, 0)}`);
    path(dead, 'ta-alarm-wire-gold', `M133.4 57.4C139 70 128 79 ${bt(3.4, 0)}`);
    path(dead, 'ta-alarm-battery-cap', bt.poly([[-9, 0], [9, 0], [9, 6], [-9, 6]]));
    path(dead, 'ta-alarm-copper', bt.poly([[-10, 5], [10, 5], [10, 15], [-10, 15]]));
    path(dead, 'ta-alarm-battery', bt.poly([[-10, 15], [10, 15], [10, 36], [-10, 36]]));
    path(dead, 'ta-alarm-battery-light', bt.poly([[-10, 5], [-6.4, 5], [-6.4, 36], [-10, 36]]));
    path(dead, 'ta-alarm-bolt', bt.poly([[1.2, 18.5], [-3.6, 27], [0, 27], [-1.6, 33.5], [4.4, 24.4], [0.8, 24.4], [2.8, 18.5]]));
    path(dead, 'ta-ink-fine', `${door}${hatch}${bt.poly([[-10, 5], [10, 5], [10, 36], [-10, 36]])}${bt.poly([[-9, 0], [9, 0], [9, 5], [-9, 5]])}M${bt(-10, 15)}L${bt(10, 15)}`);

    path(root, 'ta-ink', frameOutline(300, 220));
    return root;
  };

  // ------------------------------------------------------------------ beetle

  /**
   * Draws a beetle from above in a 64 x 64 box (head up, center 32 34). Paint classes are `${prefix}-leg`,
   * `-leg-ink`, `-rim`, `-head`, `-shell`, `-shell-shade`, `-gloss`, `-eye`; inkClass and fineClass ink it.
   */
  function drawBeetle(parent, prefix, inkClass, fineClass) {
    const mirror = (d) => d + d.replace(/([MLQ])\s*([\d.]+) ([\d.]+)(?: ([\d.]+) ([\d.]+))?/g, (m, c, x1, y1, x2, y2) => (x2 === undefined ? `${c}${n(64 - x1)} ${y1}` : `${c}${n(64 - x1)} ${y1} ${n(64 - x2)} ${y2}`));
    const limbs = mirror('M22 27L13 21L9.5 11.5M18 37L8.5 34.5L4.5 41.5M19.5 47L10.5 52L8.5 60.5M28.6 8Q25.5 3.4 19.5 4');
    path(parent, `${prefix}-leg-ink`, limbs);
    path(parent, `${prefix}-leg`, limbs);
    const head = shape.circle(32, 11.6, 6.3);
    const pronotum = 'M20.6 25.4Q20.6 16.4 32 16Q43.4 16.4 43.4 25.4Q32 22.6 20.6 25.4Z';
    path(parent, `${prefix}-rim`, head + pronotum);
    path(parent, `${prefix}-head`, `${shape.circle(32, 11.6, 4.6)}M23 23.2Q23.4 18.2 32 17.9Q40.6 18.2 41 23.2Q32 21 23 23.2Z`);
    const shell = 'M32 21C43 21 48.5 30 48.5 40C48.5 52 41 59.5 32 59.5C23 59.5 15.5 52 15.5 40C15.5 30 21 21 32 21Z';
    path(parent, `${prefix}-shell`, shell);
    path(parent, `${prefix}-shell-shade`, 'M48.5 40C48.5 52 41 59.5 32 59.5C27 59.5 22.4 57 19.4 52.6C24 55.6 29 56.4 33.4 55.2C40.4 53.4 44.8 47 45 39C45.2 34 44 29.4 41.6 25.6C46.2 29.4 48.5 34.6 48.5 40Z');
    path(parent, `${prefix}-gloss`, `M20.6 34C21.4 29 24.6 25.6 29 24.8C26.4 28 25 31.6 24.6 36.2C24.2 39.4 20 38 20.6 34Z${shape.circle(22.6, 43.4, 1.5)}M36.4 25.6C38.6 26.4 40.4 28 41.4 30.2C39.6 29 38 28.4 36.4 28.2Z`);
    path(parent, `${prefix}-eye`, shape.circle(27.3, 9.6, 1.7) + shape.circle(36.7, 9.6, 1.7));
    path(parent, inkClass, shell + head + pronotum);
    path(parent, fineClass, 'M32 22.4V59M29.2 22.6L32 28L34.8 22.6');
  }

  /** A violet beetle seen from above: "a bug in the code". viewBox 0 0 64 64. No parts or states. */
  art.bug = function bug(parent) {
    const root = svg('svg', { viewBox: '0 0 64 64', class: 'ta-art ta-bug', 'aria-hidden': 'true' }, parent);
    path(root, 'ta-shadow', ellipse(34.5, 42.5, 16, 18.5));
    drawBeetle(root, 'ta-bug', 'ta-ink', 'ta-ink-fine');
    return root;
  };

  // -------------------------------------------------------------- flashlight

  /**
   * A framed night desk for "green proves only what the tests check": a flashlight lights part of a printed
   * page of code; three lit lines carry green checks, and a beetle (part .ta-flashlight-bug, center 190 167)
   * sits in the dark part. viewBox 0 0 320 200.
   */
  art.flashlight = function flashlight(parent) {
    const root = svg('svg', { viewBox: '0 0 320 200', class: 'ta-art ta-flashlight', 'aria-hidden': 'true' }, parent);
    const frameBox = [[3, 3], [317, 3], [317, 197], [3, 197]];

    path(root, 'ta-flashlight-night', frameOutline(320, 200));
    path(root, 'ta-flashlight-desk', frameBand(320, 200, 34));
    path(root, 'ta-flashlight-desk-edge', 'M3 34H317V36.4H3Z');
    path(root, 'ta-flashlight-moon', `M40 12.5A8 8 0 1 0 49 24A6.6 6.6 0 0 1 40 12.5Z${shape.circle(66, 13, 1)}${shape.circle(82, 24, 0.8)}${shape.circle(22, 22, 0.8)}${shape.circle(270, 15, 1)}${shape.circle(296, 25, 0.8)}${shape.circle(244, 26, 0.7)}`);

    // The beam: a wedge from the lens, as an outer penumbra and a bright core.
    const torch = place(16, 128, -5);
    const lens = torch.xy(91, 0);
    const beam = (halfWidth, halfAngle) => {
      const a = torch.xy(91, -halfWidth);
      const b = torch.xy(91, halfWidth);
      const far = (from, deg) => [from[0] + 300 * Math.cos(rad(-5 + deg)), from[1] + 300 * Math.sin(rad(-5 + deg))];
      return [a, far(a, -halfAngle), far(b, halfAngle), b];
    };
    const penumbra = beam(15, 15);
    const core = beam(13, 11);
    path(root, 'ta-flashlight-desk-glow', poly(clipConvex(penumbra, frameBox)));
    path(root, 'ta-flashlight-desk-lit', poly(clipConvex(core, frameBox)));

    // The page: dim everywhere, lit where the beam falls.
    const page = place(222, 117, 4);
    const sheet = [[-80, -73], [80, -73], [80, 73], [-80, 73]].map(([u, v]) => page.xy(u, v));
    const bar = (u, v, w, hgt = 4.6) => [[u, v - hgt / 2], [u + w, v - hgt / 2], [u + w, v + hgt / 2], [u, v + hgt / 2]].map(([a, b]) => page.xy(a, b));
    const rows = [
      [[-62, 30, 'violet'], [-28, 44, 'text']],
      [[-50, 22, 'teal'], [-24, 16, 'text'], [-4, 34, 'orange']],
      [[-50, 40, 'text'], [-6, 22, 'teal']],
      [[-38, 26, 'violet'], [-8, 40, 'text']],
      [[-38, 18, 'text'], [-16, 30, 'orange'], [18, 20, 'teal']],
      [[-50, 34, 'text'], [-12, 26, 'violet']],
      [[-50, 20, 'violet'], [-26, 36, 'teal']],
      [[-62, 26, 'violet'], [-32, 40, 'text']],
      [[-50, 30, 'text'], [-16, 24, 'orange']],
      [[-50, 18, 'teal'], [-28, 44, 'text']],
      [[-50, 26, 'violet'], [-20, 18, 'text']],
    ];
    const lit = { violet: '', text: '', teal: '', orange: '', gutter: '' };
    let dim = '';
    rows.forEach((segments, i) => {
      const v = -60 + 12 * i;
      [[-74, 6, 'gutter'], ...segments].forEach(([u, w, paint]) => {
        const shapePoints = bar(u, v, w);
        dim += poly(shapePoints);
        lit[paint] += poly(clipConvex(shapePoints, core));
      });
    });
    path(root, 'ta-flashlight-shade', poly(sheet.map(([x, y]) => [x + 3.5, y + 4.5])));
    path(root, 'ta-flashlight-page', poly(sheet));
    path(root, 'ta-flashlight-code', dim);
    path(root, 'ta-flashlight-page-glow', poly(clipConvex(sheet, penumbra)));
    path(root, 'ta-flashlight-page-lit', poly(clipConvex(sheet, core)));
    Object.entries(lit).forEach(([paint, d]) => path(root, `ta-flashlight-code-${paint}`, d));
    path(root, 'ta-flashlight-check', [4, 5, 6].map((i) => {
      const v = -60 + 12 * i;
      return `M${page(60, v - 0.5)}L${page(63.6, v + 3.4)}L${page(70, v - 5)}`;
    }).join(''));

    // The bug in the dark.
    const bugPart = group(root, 'ta-flashlight-bug');
    const beetle = svg('g', { transform: 'translate(190 167) rotate(62) scale(0.4) translate(-32 -34)' }, bugPart);
    drawBeetle(beetle, 'ta-flashlight-bug', 'ta-flashlight-bug-line', 'ta-flashlight-bug-line');

    // The flashlight, lying on the desk and pointing right.
    const t = torch;
    const s = place(19, 133, -5);
    const outline = [[2, -8.5], [54, -8.5], [54, -9.6], [60, -9.6], [77, -15], [88, -15], [88, 15], [77, 15], [60, 9.6], [54, 9.6], [54, 8.5], [2, 8.5], [-1, 5], [-1, -5]];
    path(root, 'ta-flashlight-shade', s.poly(outline));
    path(root, 'ta-flashlight-barrel', t.poly([[8, -8.5], [54, -8.5], [54, 8.5], [8, 8.5]]) + t.poly([[60, -9.6], [77, -15], [77, 15], [60, 9.6]]));
    path(root, 'ta-flashlight-barrel-light', t.poly([[8, -8.5], [54, -8.5], [54, -5], [8, -5]]) + t.poly([[60, -9.6], [77, -15], [77, -9.5], [60, -6]]));
    path(root, 'ta-flashlight-barrel-shade', t.poly([[8, 3.6], [54, 3.6], [54, 8.5], [8, 8.5]]) + t.poly([[60, 4], [77, 7], [77, 15], [60, 9.6]]));
    path(root, 'ta-flashlight-metal', t.poly([[2, -8.5], [8, -8.5], [8, 8.5], [2, 8.5], [-1, 5], [-1, -5]]) + t.poly([[54, -9.6], [60, -9.6], [60, 9.6], [54, 9.6]]) + t.poly([[77, -15], [88, -15], [88, 15], [77, 15]]));
    path(root, 'ta-flashlight-metal-shade', t.poly([[2, 3.6], [8, 3.6], [8, 8.5], [2, 8.5], [-1, 5]]) + t.poly([[54, 4], [60, 4], [60, 9.6], [54, 9.6]]) + t.poly([[77, 6], [88, 6], [88, 15], [77, 15]]));
    path(root, 'ta-flashlight-switch', t.poly([[30, -3.6], [47, -3.6], [47, 3.6], [30, 3.6]]));
    path(root, 'ta-flashlight-button', t.poly([[38.5, -2.4], [45.5, -2.4], [45.5, 2.4], [38.5, 2.4]]));
    path(root, 'ta-flashlight-lens', t.poly([[88, -13], [91.4, -12], [91.4, 12], [88, 13]]));
    path(root, 'ta-ink', t.poly(outline));
    path(root, 'ta-ink-fine', `M${t(8, -8.5)}L${t(8, 8.5)}M${t(54, -9.6)}L${t(54, 9.6)}M${t(60, -9.6)}L${t(60, 9.6)}M${t(77, -15)}L${t(77, 15)}`
      + `M${t(14, -8.5)}L${t(14, 8.5)}M${t(19, -8.5)}L${t(19, 8.5)}M${t(24, -8.5)}L${t(24, 8.5)}M${t(82.5, -15)}L${t(82.5, 15)}${t.poly([[30, -3.6], [47, -3.6], [47, 3.6], [30, 3.6]])}`);
    void lens;

    path(root, 'ta-ink', frameOutline(320, 200));
    return root;
  };

  // ------------------------------------------------------------------- spots

  /** A magnifying glass, "read the message": metal rim, pale-blue lens with a glint, wooden handle. viewBox 0 0 70 70. */
  art.magnifier = function magnifier(parent) {
    const root = svg('svg', { viewBox: '0 0 70 70', class: 'ta-art ta-magnifier', 'aria-hidden': 'true' }, parent);
    const hd = place(27, 27, 45);
    const sd = place(30, 31, 45);
    const handle = `M${hd(28, -4.6)}L${hd(52, -5.2)}Q${hd(57.6, -5.2)} ${hd(57.6, 0)}Q${hd(57.6, 5.2)} ${hd(52, 5.2)}L${hd(28, 4.6)}Z`;
    const collar = hd.poly([[21, -3.6], [29, -4.4], [29, 4.4], [21, 3.6]]);
    path(root, 'ta-shadow', `${ellipse(30, 31, 22, 22)}${sd.poly([[20, -4.6], [50, -5.2], [52.5, 0], [50, 5.2], [20, 4.6]])}`);
    path(root, 'ta-magnifier-wood', handle);
    path(root, 'ta-magnifier-wood-light', hd.poly([[29.5, -4], [52, -4.5], [55.5, -3], [52, -2], [29.5, -1.8]]));
    path(root, 'ta-magnifier-wood-shade', `M${hd(29, 1.8)}L${hd(52, 2.2)}L${hd(57.2, 1.4)}Q${hd(57, 5.2)} ${hd(52, 5.2)}L${hd(29, 4.6)}Z`);
    path(root, 'ta-magnifier-metal', collar + ellipse(27, 27, 22, 22) + ellipse(27, 27, 17.4, 17.4, true));
    path(root, 'ta-magnifier-lens', ellipse(27, 27, 17.4, 17.4));
    path(root, 'ta-magnifier-lens-shade', 'M44.4 27A17.4 17.4 0 0 1 27 44.4A17.4 17.4 0 0 1 14.6 39.2A19.5 19.5 0 0 0 41.4 17.2A17.4 17.4 0 0 1 44.4 27Z');
    path(root, 'ta-magnifier-rim-shade', arc(27, 27, 19.7, -20, 115));
    path(root, 'ta-magnifier-rim-light', arc(27, 27, 20.6, 175, 285));
    path(root, 'ta-magnifier-glint', `${arc(27, 27, 12.4, 188, 250)}${arc(27, 27, 12.4, 262, 272)}`);
    path(root, 'ta-ink', `${shape.circle(27, 27, 22)}${handle}`);
    path(root, 'ta-ink-fine', `${shape.circle(27, 27, 17.4)}${collar}M${hd(25, -4)}L${hd(25, 4)}`);
    return root;
  };

  /**
   * A stopwatch, "one turn takes minutes": metal case, crown and side button, white face with ticks.
   * viewBox 0 0 70 80. Part .ta-stopwatch-hand turns about the face center (35, 48); it is drawn pointing up.
   */
  art.stopwatch = function stopwatch(parent) {
    const root = svg('svg', { viewBox: '0 0 70 80', class: 'ta-art ta-stopwatch', 'aria-hidden': 'true' }, parent);
    const C = [35, 48];
    const sideButton = place(C[0], C[1], -45);
    const stem = 'M31.6 13.5H38.4V23.5H31.6Z';
    const crown = 'M29.5 4.5H40.5Q42.5 4.5 42.5 6.5V12.5Q42.5 14.5 40.5 14.5H29.5Q27.5 14.5 27.5 12.5V6.5Q27.5 4.5 29.5 4.5Z';
    const sideStem = sideButton.poly([[24, -2.6], [30, -2.6], [30, 2.6], [24, 2.6]]);
    const sideCap = sideButton.poly([[29.4, -4.4], [35, -4.4], [35, 4.4], [29.4, 4.4]]);
    path(root, 'ta-shadow', ellipse(38, 52, 26, 26));
    path(root, 'ta-stopwatch-metal-stem', stem + sideStem);
    path(root, 'ta-stopwatch-gold', sideCap);
    path(root, 'ta-stopwatch-metal', crown + ellipse(C[0], C[1], 26, 26));
    path(root, 'ta-stopwatch-metal-shade', 'M61 48A26 26 0 0 1 35 74A26 26 0 0 1 15.6 65.3A27.5 27.5 0 0 0 56.6 33.4A26 26 0 0 1 61 48ZM38 4.5H40.5Q42.5 4.5 42.5 6.5V12.5Q42.5 14.5 40.5 14.5H38Z');
    path(root, 'ta-stopwatch-rim-light', arc(C[0], C[1], 23.4, 185, 280));
    path(root, 'ta-stopwatch-face', ellipse(C[0], C[1], 20.4, 20.4));
    path(root, 'ta-stopwatch-face-shade', 'M14.6 48A20.4 20.4 0 0 1 35 27.6A20.4 20.4 0 0 1 50.4 34.6A21 21 0 0 0 17.6 58.6A20.4 20.4 0 0 1 14.6 48Z');
    let major = '';
    let minor = '';
    for (let i = 0; i < 60; i += 5) {
      const a = rad(i * 6 - 90);
      const tick = (r0, r1) => `M${pt(C[0] + r0 * Math.cos(a), C[1] + r0 * Math.sin(a))}L${pt(C[0] + r1 * Math.cos(a), C[1] + r1 * Math.sin(a))}`;
      if (i % 15 === 0) major += tick(13.6, 17.6);
      else minor += tick(15, 17.6);
    }
    path(root, 'ta-stopwatch-tick', major);
    path(root, 'ta-ink-fine', `${minor}${shape.circle(C[0], C[1], 20.4)}${stem}${sideStem}${sideCap}M31.5 6.8V12.2M35 6.8V12.2M38.5 6.8V12.2`);
    path(root, 'ta-ink', `${shape.circle(C[0], C[1], 26)}${crown}`);
    const hand = group(root, 'ta-stopwatch-hand');
    const needle = 'M35 30.6L37 48L35 54.5L33 48Z';
    path(hand, 'ta-stopwatch-needle', needle);
    path(hand, 'ta-ink-fine', needle);
    path(root, 'ta-stopwatch-hub', shape.circle(C[0], C[1], 2.7));
    path(root, 'ta-stopwatch-hub-light', shape.circle(34.3, 47.3, 0.9));
    return root;
  };

  /**
   * A two-lamp signal for a terminal's title bar: red lamp on top, green below. viewBox 0 0 36 84.
   * States: is-red (red lamp lit), is-green (green lamp lit); by default both lamps are dark glass.
   */
  art.trafficLight = function trafficLight(parent) {
    const root = svg('svg', { viewBox: '0 0 36 84', class: 'ta-art ta-trafficLight', 'aria-hidden': 'true' }, parent);
    const box = (x, y, w, hgt, r) => `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + hgt - r}Q${x + w} ${y + hgt} ${x + w - r} ${y + hgt}H${x + r}Q${x} ${y + hgt} ${x} ${y + hgt - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
    const housing = box(6, 3, 24, 62, 6);
    const foot = box(8, 76, 20, 6, 2);
    const visor = (cy) => `M${pt(18 + 10.6 * Math.cos(rad(192)), cy + 10.6 * Math.sin(rad(192)))}A10.6 10.6 0 0 1 ${pt(18 + 10.6 * Math.cos(rad(348)), cy + 10.6 * Math.sin(rad(348)))}`
      + `L${pt(18 + 8.2 * Math.cos(rad(350)), cy + 8.2 * Math.sin(rad(350)))}A8.2 8.2 0 0 0 ${pt(18 + 8.2 * Math.cos(rad(190)), cy + 8.2 * Math.sin(rad(190)))}Z`;
    const glint = (cy) => ellipse(15.4, cy - 2.9, 2.3, 1.6);
    path(root, 'ta-shadow', box(9, 7, 24, 62, 6) + box(11, 78, 20, 5, 2));
    path(root, 'ta-trafficLight-metal', `M15 64H21V77H15Z${foot}`);
    path(root, 'ta-trafficLight-metal-shade', 'M18.6 65H21V76H18.6ZM20 79.4H27.4V81.4H20Z');
    path(root, 'ta-trafficLight-bevel', housing);
    path(root, 'ta-trafficLight-housing', box(8.4, 5.4, 19.2, 57.2, 4));
    path(root, 'ta-trafficLight-socket', shape.circle(18, 21, 8.6) + shape.circle(18, 46, 8.6));
    path(root, 'ta-trafficLight-red', shape.circle(18, 21, 7.2));
    path(root, 'ta-trafficLight-green', shape.circle(18, 46, 7.2));
    path(root, 'ta-trafficLight-red-glint', glint(21));
    path(root, 'ta-trafficLight-green-glint', glint(46));
    path(root, 'ta-trafficLight-visor', visor(21) + visor(46));
    path(root, 'ta-ink-fine', `${shape.circle(18, 21, 7.2)}${shape.circle(18, 46, 7.2)}${visor(21)}${visor(46)}M15 76V65M21 65V76`);
    path(root, 'ta-ink', housing + foot);
    return root;
  };
})();

// ------------------------------------------------------------------
// Rule three, smallest step, and rule four, refactor on green
// ------------------------------------------------------------------

/* Illustrations for the TDD narration's last two rules: "smallest step"
 * (checkpoints, gear shifter, training wheels, snail) and "refactor on green"
 * (two hats, dice, patch tower, broom, bandage). Each function appends one
 * <svg class="ta-art ta-<name>"> to its parent and returns it. */
(function () {
  'use strict';

  const { svg } = window.SongKit;
  const { shape } = window.ArchKit;
  const art = (window.TddArt = window.TddArt || {});
  const r2 = shape.round;

  // ---- Small drawing helpers -------------------------------------------

  const identity = (x, y) => [x, y];

  /** A point transform: rotate by `deg` (clockwise on screen) about (ox, oy). */
  function rotateAbout(deg, ox, oy) {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return (x, y) => [ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c];
  }

  /** A point transform: local block space (rotated by `deg` about its origin) placed at (px, py). */
  function placeAt(px, py, deg) {
    const turn = rotateAbout(deg, 0, 0);
    return (x, y) => {
      const [a, b] = turn(x, y);
      return [a + px, b + py];
    };
  }

  const compose = (outer, inner) => (x, y) => outer(...inner(x, y));

  /** A path-data builder whose absolute points pass through a transform. */
  function pen(tf = identity) {
    const parts = [];
    const p = (x, y) => {
      const [a, b] = tf(x, y);
      return `${r2(a)} ${r2(b)}`;
    };
    const api = {
      M(x, y) { parts.push(`M${p(x, y)}`); return api; },
      L(...xy) { for (let i = 0; i < xy.length; i += 2) parts.push(`L${p(xy[i], xy[i + 1])}`); return api; },
      Q(cx, cy, x, y) { parts.push(`Q${p(cx, cy)} ${p(x, y)}`); return api; },
      C(ax, ay, bx, by, x, y) { parts.push(`C${p(ax, ay)} ${p(bx, by)} ${p(x, y)}`); return api; },
      Z() { parts.push('Z'); return api; },
      circle(cx, cy, r) { const [a, b] = tf(cx, cy); parts.push(shape.circle(a, b, r)); return api; },
      rect(x, y, w, h, r = 0) {
        if (!r) return api.M(x, y).L(x + w, y, x + w, y + h, x, y + h).Z();
        return api.M(x + r, y).L(x + w - r, y).Q(x + w, y, x + w, y + r).L(x + w, y + h - r).Q(x + w, y + h, x + w - r, y + h)
          .L(x + r, y + h).Q(x, y + h, x, y + h - r).L(x, y + r).Q(x, y, x + r, y).Z();
      },
      poly(...xy) { api.M(xy[0], xy[1]); api.L(...xy.slice(2)); return api.Z(); },
      toString() { return parts.join(' '); },
    };
    return api;
  }

  const join = (...ds) => ds.join(' ');
  const path = (parent, cls, d) => svg('path', { d: String(d), class: cls }, parent);
  const group = (parent, cls) => svg('g', { class: cls }, parent);

  const ellipse = (cx, cy, rx, ry) =>
    `M${r2(cx - rx)} ${r2(cy)} a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(2 * rx)} 0 a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-2 * rx)} 0`;

  /** An open circular arc from angle a0 to a1 (degrees, clockwise from +x). */
  function arc(cx, cy, r, a0, a1) {
    const at = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = at(a0);
    const [x1, y1] = at(a1);
    return `M${r2(x0)} ${r2(y0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${r2(x1)} ${r2(y1)}`;
  }

  /** The part of a disc that lies outside the same disc shifted by (ox, oy): a shade or light crescent. */
  function crescent(cx, cy, r, ox, oy) {
    const d = Math.hypot(ox, oy);
    const h = Math.sqrt(r * r - (d * d) / 4);
    const mx = cx + ox / 2;
    const my = cy + oy / 2;
    const ux = -oy / d;
    const uy = ox / d;
    const a = `${r2(mx + h * ux)} ${r2(my + h * uy)}`;
    const b = `${r2(mx - h * ux)} ${r2(my - h * uy)}`;
    return `M${a} A${r} ${r} 0 1 1 ${b} A${r} ${r} 0 0 0 ${a} Z`;
  }

  /** A four-point sparkle star. */
  function sparkle(cx, cy, r) {
    const k = r * 0.24;
    return pen().M(cx, cy - r).Q(cx + k, cy - k, cx + r, cy).Q(cx + k, cy + k, cx, cy + r)
      .Q(cx - k, cy + k, cx - r, cy).Q(cx - k, cy - k, cx, cy - r).Z().toString();
  }

  // Panels: a rounded frame (rx 14) inset by 1.5 so its ink stays in the viewBox.
  const frameD = (w, h) =>
    `M15.5 1.5 H${w - 15.5} a14 14 0 0 1 14 14 V${h - 15.5} a14 14 0 0 1 -14 14 H15.5 a14 14 0 0 1 -14 -14 V15.5 a14 14 0 0 1 14 -14 Z`;

  /** A floor region: `contour` runs from the frame's left edge to its right edge; the rest follows the frame. */
  const floorD = (w, h, contour) => `${contour} V${h - 15.5} a14 14 0 0 1 -14 14 H15.5 a14 14 0 0 1 -14 -14 Z`;

  function panel(parent, name, w, h) {
    return svg('svg', { viewBox: `0 0 ${w} ${h}`, class: `ta-art ta-${name}`, 'aria-hidden': 'true' }, parent);
  }

  // ---- checkpoints -----------------------------------------------------

  const CP = { first: 44, width: 58, base: 174, rise: 12, flagAt: 40, standAt: 18, pitEnd: 462 };
  const cpStep = (i) => ({ left: CP.first + (i - 1) * CP.width, top: CP.base - i * CP.rise });

  function grassCap(x0, x1, y) {
    const n = Math.max(1, Math.round((x1 - x0) / 9.6));
    const w = (x1 - x0) / n;
    let d = `M${r2(x0)} ${y} H${r2(x1)} V${y + 5}`;
    for (let k = 0; k < n; k += 1) d += ` q${r2(-w / 2)} 4.6 ${r2(-w)} 0`;
    return `${d} Z`;
  }

  /**
   * A side-scrolling game level: six grass-topped steps, each with a green checkpoint flag, then a pit
   * with a red X and a dashed respawn arrow back to the last flag: "each green is a save point".
   * viewBox 0 0 560 200. Parts: .ta-cp-flag-1..6 (origin at each foot), .ta-cp-player (origin at its
   * feet, 352 102), .ta-cp-fall, .ta-cp-respawn. No states.
   */
  art.checkpoints = function checkpoints(parent) {
    const root = panel(parent, 'checkpoints', 560, 200);
    const pitStart = cpStep(6).left + CP.width; // 392
    const topY = cpStep(6).top; // 102

    path(root, 'ta-cp-sky', frameD(560, 200));
    path(root, 'ta-cp-cloud-shade', join(
      'M70 62 q2 -7 10 -7 q3 -9 14 -9 q11 0 13 9 q10 -1 11 7 q0 4 -5 4 h-39 q-4 0 -4 -4 Z',
      'M236 58 q2 -6 9 -6 q3 -8 13 -8 q10 0 12 8 q9 0 10 6 q0 4 -5 4 h-34 q-5 0 -5 -4 Z',
      'M496 60 q2 -5 8 -5 q3 -7 11 -7 q9 0 10 7 q8 0 9 5 q0 4 -5 4 h-28 q-5 0 -5 -4 Z'));
    path(root, 'ta-cp-cloud', join(
      'M72 59 q2 -5 9 -4 q3 -8 13 -8 q10 0 12 8 q8 -1 9 5 q0 2 -3 2 h-37 q-3 0 -3 -3 Z',
      'M238 55 q2 -4 8 -3 q3 -7 12 -7 q9 0 11 7 q8 0 9 4 q0 2 -3 2 h-34 q-3 0 -3 -3 Z',
      'M498 57 q2 -3 7 -3 q3 -6 10 -6 q8 0 9 6 q7 0 8 4 q0 2 -3 2 h-28 q-3 0 -3 -3 Z'));
    path(root, 'ta-cp-hill-far',
      'M1.5 122 C40 96 84 80 122 84 C160 88 190 110 226 96 C262 82 286 62 318 66 C352 70 372 96 410 98 C452 100 470 76 502 74 C528 73 546 84 558.5 92 V150 H1.5 Z');
    path(root, 'ta-cp-hill',
      'M1.5 146 C28 128 52 124 76 132 C108 142 140 122 176 110 C214 98 240 104 268 108 C300 112 322 88 352 86 C384 84 400 96 430 98 C470 100 492 82 524 82 C540 82 552 88 558.5 94 V176 H1.5 Z');
    path(root, 'ta-cp-hill-light',
      'M150 121 C176 108 208 100 238 104 C214 106 186 116 162 126 Z M330 94 C340 88 358 85 376 88 C360 89 346 93 336 99 Z M500 86 C510 83 528 82 540 86 C526 86 514 88 506 91 Z M40 133 C52 128 66 128 78 133 C66 132 54 133 46 137 Z');

    // The pit: a dark shaft with spikes at the bottom.
    path(root, 'ta-cp-pit', `M${pitStart} ${topY + 2} H${CP.pitEnd} V198.5 H${pitStart} Z`);
    path(root, 'ta-cp-pit-deep', `M${pitStart} 150 l10 6 l12 -7 l13 8 l12 -8 l12 7 l11 -6 V198.5 H${pitStart} Z`);
    path(root, 'ta-cp-spike', 'M397 198.5 l6 -18 l6 18 Z M411 198.5 l6 -22 l6 22 Z M425 198.5 l6 -18 l6 18 Z M439 198.5 l6 -22 l6 22 Z');
    path(root, 'ta-cp-spike-light', 'M403 180.5 l-6 18 h3.2 Z M417 176.5 l-6 22 h3.2 Z M431 180.5 l-6 18 h3.2 Z M445 176.5 l-6 22 h3.2 Z');
    path(root, 'ta-ink-fine', 'M397 198 l6 -17.5 l6 17.5 M411 198 l6 -21.5 l6 21.5 M425 198 l6 -17.5 l6 17.5 M439 198 l6 -21.5 l6 21.5');

    // Ground: a staircase of earth blocks with grass caps.
    let stairs = `M1.5 ${CP.base} H${CP.first}`;
    for (let i = 1; i <= 6; i += 1) stairs += ` V${cpStep(i).top} H${cpStep(i).left + CP.width}`;
    const leftGround = `${stairs} V198.5 H15.5 a14 14 0 0 1 -14 -14 Z`;
    const rightGround = `M${CP.pitEnd} ${topY} H558.5 V184.5 a14 14 0 0 1 -14 14 H${CP.pitEnd} Z`;
    path(root, 'ta-cp-earth', join(leftGround, rightGround));

    const landings = [[1.5, CP.first, CP.base]];
    for (let i = 1; i <= 6; i += 1) landings.push([cpStep(i).left, cpStep(i).left + CP.width, cpStep(i).top]);
    landings.push([CP.pitEnd, 558.5, topY]);

    let shade = '';
    let seams = '';
    let stones = '';
    landings.forEach(([x0, x1, y], index) => {
      shade += ` M${x1 - 9} ${y + 6} H${x1} V198.5 H${x1 - 9} Z`;
      for (let sy = y + 34, k = 0; sy < 192; sy += 26, k += 1) {
        seams += ` M${x0 + 2} ${sy} H${x1 - 2}`;
        const mid = x0 + (x1 - x0) * (k % 2 ? 0.36 : 0.62);
        seams += ` M${r2(mid)} ${sy} V${Math.min(sy + 26, 197)}`;
      }
      if (index > 0 && y + 22 < 190) stones += ` ${ellipse(x0 + 14 + (index % 3) * 9, y + 21, 3.4, 2.2)}`;
    });
    shade += ` M${pitStart - 9} ${topY + 6} H${pitStart} V198.5 H${pitStart - 9} Z`;
    path(root, 'ta-cp-earth-shade', shade.replace(` M${558.5 - 9} ${topY + 6} H558.5 V198.5 H${558.5 - 9} Z`, '').trim());
    path(root, 'ta-cp-stone', join(stones.trim(), ellipse(490, 140, 4, 2.6), ellipse(532, 166, 3.4, 2.2), ellipse(24, 190, 3.2, 2)));
    path(root, 'ta-cp-seam', seams.trim());
    path(root, 'ta-cp-grass', landings.map(([x0, x1, y]) => grassCap(x0, x1, y)).join(' '));
    path(root, 'ta-cp-grass-light', landings.map(([x0, x1, y]) => `M${x0 + 1.5} ${y + 1} H${x1 - 5} v2.2 H${x0 + 1.5} Z`).join(' '));
    path(root, 'ta-ink', join(`${stairs} V198.5`, `M${CP.pitEnd} 198.5 V${topY} H558.5`));

    // Checkpoint flags.
    for (let i = 1; i <= 6; i += 1) {
      const { left, top } = cpStep(i);
      const x = left + CP.flagAt;
      const flag = group(root, `ta-cp-flag ta-cp-flag-${i}`);
      const pennant = `M${x} ${top - 38} C${x + 6} ${top - 39} ${x + 11} ${top - 33} ${x + 19} ${top - 31} C${x + 12} ${top - 28} ${x + 7} ${top - 23} ${x} ${top - 22} Z`;
      path(flag, 'ta-cp-pennant', pennant);
      path(flag, 'ta-cp-pennant-shade', `M${x} ${top - 30} C${x + 7} ${top - 30} ${x + 13} ${top - 30} ${x + 19} ${top - 31} C${x + 12} ${top - 28} ${x + 7} ${top - 23} ${x} ${top - 22} Z`);
      path(flag, 'ta-ink', join(`M${x} ${top - 1} V${top - 38.5}`, pennant, shape.circle(x, top - 40.6, 1.5), `M${x - 4.5} ${top - 0.4} q4.5 -4.6 9 0`));
    }

    // The respawn arrow arches from the pit back to flag 6.
    const respawn = group(root, 'ta-cp-respawn');
    path(respawn, 'ta-cp-dash', 'M388 54 C398 36 440 44 436 78');
    path(respawn, 'ta-cp-arrowhead', 'M383.6 62.4 L382.4 50.6 L393.6 57.2 Z');

    // The red X floats over the pit.
    const fall = group(root, 'ta-cp-fall');
    const cross = pen(rotateAbout(45, 427, 92)).poly(
      416, 88.4, 423.4, 88.4, 423.4, 81, 430.6, 81, 430.6, 88.4, 438, 88.4,
      438, 95.6, 430.6, 95.6, 430.6, 103, 423.4, 103, 423.4, 95.6, 416, 95.6).toString();
    path(fall, 'ta-cp-x', cross);
    path(fall, 'ta-cp-x-light', pen(rotateAbout(45, 427, 92)).poly(416, 88.4, 423.4, 88.4, 423.4, 81, 430.6, 81, 430.6, 83.4, 425.8, 83.4, 425.8, 90.8, 416, 90.8).toString());
    path(fall, 'ta-ink', cross);

    // The player: a round orange sprite standing at flag 6.
    const stand = cpStep(6).left + CP.standAt; // 352
    const player = group(root, 'ta-cp-player');
    const body = `M${stand - 10.5} ${topY - 6} C${stand - 11.5} ${topY - 17} ${stand - 6} ${topY - 22} ${stand} ${topY - 22} C${stand + 6} ${topY - 22} ${stand + 11.5} ${topY - 17} ${stand + 10.5} ${topY - 6} C${stand + 10} ${topY - 2.5} ${stand + 6} ${topY - 1.5} ${stand} ${topY - 1.5} C${stand - 6} ${topY - 1.5} ${stand - 10} ${topY - 2.5} ${stand - 10.5} ${topY - 6} Z`;
    const feet = join(ellipse(stand - 5, topY - 1.2, 3.6, 2), ellipse(stand + 5, topY - 1.2, 3.6, 2));
    const eyes = join(shape.circle(stand - 2.6, topY - 13, 3.1), shape.circle(stand + 5, topY - 13, 3.1));
    path(player, 'ta-shadow', ellipse(stand + 2, topY + 0.6, 11, 2));
    path(player, 'ta-cp-player-foot', feet);
    path(player, 'ta-cp-player-body', body);
    path(player, 'ta-cp-player-light', join(`M${stand - 8} ${topY - 12} C${stand - 8} ${topY - 17} ${stand - 5} ${topY - 20} ${stand - 1} ${topY - 20.5} C${stand - 4} ${topY - 18} ${stand - 6} ${topY - 15} ${stand - 6.4} ${topY - 11} Z`, shape.circle(stand, topY - 27, 2.2)));
    path(player, 'ta-cp-player-eye', eyes);
    path(player, 'ta-ink', join(body, `M${stand} ${topY - 22} V${topY - 25}`));
    path(player, 'ta-ink-fine', join(feet, eyes, shape.circle(stand, topY - 27, 2.2), `M${stand - 1} ${topY - 6.5} q2.6 2.4 5.2 0`));
    path(player, 'ta-cp-player-pupil', join(shape.circle(stand - 1.6, topY - 12.8, 1.4), shape.circle(stand + 6, topY - 12.8, 1.4)));

    path(root, 'ta-ink', frameD(560, 200));
    return root;
  };

  // ---- gearShifter -----------------------------------------------------

  /**
   * A car's center console: a chrome gate plate with an H-pattern slot, its three positions marked by
   * one, two, and three dots, and a booted lever with a round knob: "step size is a gear you choose".
   * viewBox 0 0 200 200. Part: .ta-gear-lever (drawn in gear 1; states translate it). States:
   * is-gear-1 (default), is-gear-2, is-gear-3.
   */
  art.gearShifter = function gearShifter(parent) {
    const root = panel(parent, 'gear', 200, 200);
    path(root, 'ta-gear-console', frameD(200, 200));
    path(root, 'ta-gear-console-light', 'M15.5 1.5 H120 L40 198.5 H15.5 a14 14 0 0 1 -14 -14 V15.5 a14 14 0 0 1 14 -14 Z');
    path(root, 'ta-gear-stitch', pen().rect(10, 10, 180, 180, 9).toString());

    // Chrome plate with bevels: shade on the bottom right, light on the top left.
    path(root, 'ta-gear-plate-shade', pen().rect(24, 44, 152, 134, 16).toString());
    path(root, 'ta-gear-plate-light', pen().rect(24, 44, 149, 131, 15).toString());
    path(root, 'ta-gear-plate', pen().rect(27, 47, 146, 128, 13).toString());
    path(root, 'ta-gear-plate-sheen', 'M100 47 H124 L70 175 H46 Z M134 47 H142 L88 175 H80 Z');
    path(root, 'ta-gear-slot-edge', 'M64 80 V148 M64 114 H128 V80');
    path(root, 'ta-gear-slot', 'M64 80 V148 M64 114 H128 V80');
    path(root, 'ta-gear-slot-shine', 'M70.5 86 V107.5 H121.5 V86 M70.5 120.5 V146');
    const screws = [[40, 60], [160, 60], [40, 162], [160, 162]];
    path(root, 'ta-gear-screw', screws.map(([x, y]) => shape.circle(x, y, 4.2)).join(' '));
    path(root, 'ta-gear-dot', join(
      shape.circle(35, 80, 2.5),
      shape.circle(31, 148, 2.5), shape.circle(37.6, 148, 2.5),
      shape.circle(154.6, 80, 2.5), shape.circle(161.2, 80, 2.5), shape.circle(167.8, 80, 2.5)));
    path(root, 'ta-ink', pen().rect(24, 44, 152, 134, 16).toString());
    path(root, 'ta-ink-fine', screws.map(([x, y]) => `${shape.circle(x, y, 4.2)} M${x - 2.6} ${y + 1.6} L${x + 2.6} ${y - 1.6}`).join(' '));

    // The lever in gear 1: base in the slot at (64, 80), knob at (73, 34).
    const lever = group(root, 'ta-gear-lever');
    const boot = 'M46 84 C47 77 56 70 60 62.5 L71 62.5 C74.5 70 81 77 82 84 C82 89.5 74 92 64 92 C54 92 46 89.5 46 84 Z';
    const ring = ellipse(64, 85, 21, 9.4);
    path(lever, 'ta-gear-cast', join(ellipse(69, 97.6, 22, 5.6), ellipse(89, 50, 16, 14)));
    path(lever, 'ta-gear-collar', ring);
    path(lever, 'ta-ink', ring);
    path(lever, 'ta-gear-boot', boot);
    path(lever, 'ta-gear-boot-light', 'M47.4 83 C49 77 57 70 61 63.4 L64.6 63.4 C62 71 57 79 55.6 90.6 C50.6 89 47.4 86.6 47.4 83 Z');
    path(lever, 'ta-gear-boot-shade', 'M82 84 C81 77 74.5 70 71 62.5 L68.4 63 C71.4 72 73.4 82 71.6 91.2 C78 90 82 87.6 82 84 Z');
    path(lever, 'ta-gear-thread', 'M65.6 65 C64.4 74 64 83 64.4 91');
    path(lever, 'ta-ink', boot);
    path(lever, 'ta-ink-fine', 'M51.6 76.4 C58 80.4 70.6 80.4 77 76.4 M56 69.6 C60.6 72.2 69 72.2 73.4 69.6');
    path(lever, 'ta-gear-shaft-edge', 'M65.4 62 L71.6 43');
    path(lever, 'ta-gear-shaft', 'M65.4 62 L71.6 43');
    path(lever, 'ta-gear-shaft-light', 'M64 61 L69.6 44');
    path(lever, 'ta-gear-collar', ellipse(65.4, 62.6, 6.4, 2.8));
    path(lever, 'ta-ink-fine', ellipse(65.4, 62.6, 6.4, 2.8));
    path(lever, 'ta-gear-knob', shape.circle(73, 34, 17));
    path(lever, 'ta-gear-knob-shade', crescent(73, 34, 17, -4.6, -4.6));
    path(lever, 'ta-gear-knob-light', join(ellipse(66, 26, 5.6, 3.6), shape.circle(62.4, 32.6, 1.6)));
    path(lever, 'ta-gear-knob-mark', 'M69.6 29 V40.6 M69.6 34.8 H78.4 V29');
    path(lever, 'ta-ink', shape.circle(73, 34, 17));

    path(root, 'ta-ink', frameD(200, 200));
    return root;
  };

  // ---- bike ------------------------------------------------------------

  /**
   * A park with a child's bicycle on training wheels: "the three laws are training wheels".
   * viewBox 0 0 300 200. Parts: .ta-bike-training (fitted wheels), .ta-bike-loose (the two wheels lying
   * on the grass). States: default / is-training (fitted), is-free (taken off).
   */
  art.bike = function bike(parent) {
    const root = panel(parent, 'bike', 300, 200);
    const R = [108, 134]; // rear axle
    const F = [190, 134]; // front axle
    const B = [142, 136]; // bottom bracket
    const S = [131, 100]; // seat cluster
    const radius = 26;

    // Park backdrop.
    path(root, 'ta-bike-sky', frameD(300, 200));
    path(root, 'ta-bike-cloud', 'M200 40 q2 -6 10 -5 q3 -9 14 -9 q11 0 13 9 q9 -1 10 6 q0 3 -4 3 h-39 q-4 0 -4 -4 Z M106 30 q2 -4 7 -3 q3 -6 10 -6 q8 0 9 6 q6 0 7 4 q0 2 -3 2 h-27 q-3 0 -3 -3 Z');
    let hedge = 'M1.5 108';
    [10, 14, 8, 13, 9, 15, 10, 13, 8, 14, 10].forEach((h) => { hedge += ` q13.5 ${-2 * h} 27 0`; });
    path(root, 'ta-bike-hedge', `${hedge} V124 H1.5 Z`);
    path(root, 'ta-bike-grass', floorD(300, 200, 'M1.5 118 C60 113 120 116 180 114 S262 112 298.5 116'));
    path(root, 'ta-bike-grass-light', 'M1.5 118 C60 113 120 116 180 114 S262 112 298.5 116 V122 C262 118 240 120 180 120 S60 119 1.5 124 Z');
    path(root, 'ta-bike-path', 'M1.5 146 C70 142 150 145 298.5 143 V169 C200 171 90 169 1.5 172 Z');
    path(root, 'ta-bike-path-shade', 'M1.5 167 C90 164 200 166 298.5 164 V169 C200 171 90 169 1.5 172 Z');
    path(root, 'ta-bike-tuft', 'M22 136 l2 -6 l2 6 M26 136 l3 -4 M84 130 l2 -6 l2 6 M228 132 l2 -6 l2 6 M232 132 l3 -4 M280 138 l2 -6 l2 6 M36 184 l2 -7 l2 7 M40 184 l3 -5 M118 190 l2 -7 l2 7 M176 182 l2 -7 l2 7 M180 182 l3 -5 M286 178 l2 -6 l2 6');

    // Tree (left) and bush (right): ink circles under the fills give the union's outline.
    const canopy = [[46, 54, 24], [27, 68, 15], [65, 68, 16], [46, 76, 15]];
    const bush = [[262, 117, 13], [279, 121, 10], [246, 122, 9]];
    const blobs = (list) => list.map(([x, y, r]) => shape.circle(x, y, r)).join(' ');
    path(root, 'ta-shadow', join(ellipse(60, 129, 22, 4), ellipse(268, 131, 26, 3.6)));
    path(root, 'ta-bike-trunk', 'M41 128 C42 112 42 98 41 84 H51 C50 98 50 112 52 128 Z');
    path(root, 'ta-bike-trunk-shade', 'M47.5 128 C47.5 112 47.5 98 47 84 H51 C50 98 50 112 52 128 Z');
    path(root, 'ta-ink', 'M41 128 C42 112 42 98 41 84 M51 84 C50 98 50 112 52 128 Z');
    path(root, 'ta-bike-leaf-edge', join(blobs(canopy), blobs(bush)));
    path(root, 'ta-bike-leaf', join(blobs(canopy), blobs(bush)));
    path(root, 'ta-bike-leaf-shade', join(crescent(46, 76, 15, -5, -6), crescent(65, 68, 16, -5, -6), crescent(279, 121, 10, -4, -4), crescent(262, 117, 13, -6, -5)));
    path(root, 'ta-bike-leaf-light', join(ellipse(37, 43, 10, 6.5), ellipse(22, 62, 5, 3.6), ellipse(256, 109, 6, 3.6), ellipse(58, 60, 4, 2.6)));

    // The two training wheels lying on the grass (is-free).
    const loose = group(root, 'ta-bike-loose');
    const flatWheel = (cx, cy) => ({
      side: `M${cx - 14} ${cy} a14 6.2 0 0 0 28 0 v5 a14 6.2 0 0 1 -28 0 Z`,
      top: ellipse(cx, cy, 14, 6.2),
      rim: `M${cx - 14} ${cy} a14 6.2 0 0 1 28 0`,
      hub: ellipse(cx, cy, 6.4, 2.8),
      arm: `M${cx + 3} ${cy - 0.6} L${cx + 24} ${cy - 10}`,
    });
    const wheelA = flatWheel(226, 183);
    const wheelB = flatWheel(258, 178);
    path(loose, 'ta-shadow', join(ellipse(232, 190.4, 17, 4.4), ellipse(264, 185.4, 17, 4.4)));
    path(loose, 'ta-bike-arm-edge', join(wheelB.arm, wheelA.arm));
    path(loose, 'ta-bike-arm', join(wheelB.arm, wheelA.arm));
    path(loose, 'ta-bike-tw-side', join(wheelB.side, wheelA.side));
    path(loose, 'ta-bike-tw', join(wheelB.top, wheelA.top));
    path(loose, 'ta-bike-tw-hub', join(wheelB.hub, wheelA.hub));
    path(loose, 'ta-ink', join(wheelB.side, wheelA.side, wheelB.rim, wheelA.rim));
    path(loose, 'ta-ink-fine', join(wheelB.hub, wheelA.hub));

    // Bicycle.
    path(root, 'ta-shadow', ellipse(152, 161.5, 66, 4.4));
    path(root, 'ta-bike-metal-edge', `M${B[0]} ${B[1]} L133 125`);
    path(root, 'ta-bike-metal', `M${B[0]} ${B[1]} L133 125`);
    path(root, 'ta-bike-dark', pen().rect(127, 122.4, 11, 4, 1.5).toString());

    let spokes = '';
    [R, F].forEach(([cx, cy], w) => {
      for (let k = 0; k < 10; k += 1) {
        const a = ((k * 36 + w * 14) * Math.PI) / 180;
        spokes += ` M${cx} ${cy} L${r2(cx + 21 * Math.cos(a))} ${r2(cy + 21 * Math.sin(a))}`;
      }
    });
    path(root, 'ta-bike-spoke', spokes.trim());
    path(root, 'ta-bike-rim', join(shape.circle(R[0], R[1], 19.6), shape.circle(F[0], F[1], 19.6)));
    path(root, 'ta-bike-tyre', join(shape.circle(R[0], R[1], 23.6), shape.circle(F[0], F[1], 23.6)));
    path(root, 'ta-bike-tyre-light', join(arc(R[0], R[1], 24.2, 170, 300), arc(F[0], F[1], 24.2, 170, 300)));
    path(root, 'ta-ink', join(shape.circle(R[0], R[1], radius), shape.circle(F[0], F[1], radius)));
    path(root, 'ta-ink-fine', join(shape.circle(R[0], R[1], 21), shape.circle(F[0], F[1], 21)));

    // Fitted training wheel on its bracket, behind the rear axle.
    const training = group(root, 'ta-bike-training');
    path(training, 'ta-bike-arm-edge', `M${R[0]} ${R[1]} L90 148.6`);
    path(training, 'ta-bike-arm', `M${R[0]} ${R[1]} L90 148.6`);
    path(training, 'ta-bike-tw', shape.circle(90, 148.6, 11.4));
    path(training, 'ta-bike-tw-side', crescent(90, 148.6, 11.4, -2.6, -2.6));
    path(training, 'ta-bike-tw-hub', shape.circle(90, 148.6, 5.6));
    path(training, 'ta-ink', shape.circle(90, 148.6, 11.4));
    path(training, 'ta-ink-fine', join(shape.circle(90, 148.6, 5.6), shape.circle(90, 148.6, 1.4)));

    // Chain, frame tubes, fork.
    path(root, 'ta-ink-fine', `M${B[0]} ${B[1] - 8} L${R[0]} ${R[1] - 4.4} M${B[0]} ${B[1] + 8} L${R[0]} ${R[1] + 4.4}`);
    const tubes = join(
      `M${S[0]} ${S[1]} L${R[0]} ${R[1]} L${B[0]} ${B[1]} Z`, // seat stay, chain stay, seat tube
      `M${S[0]} ${S[1]} L176 93`, // top tube
      `M${B[0]} ${B[1]} L179 105`, // down tube
      `M175 88 L179.6 106 Q184 121 ${F[0]} ${F[1]}`); // head tube and fork
    const posts = join(`M${S[0]} ${S[1]} L128 89`, 'M175 88 L173 79 C171 75 166 74.4 160 75.6');
    path(root, 'ta-bike-metal-edge', posts);
    path(root, 'ta-bike-metal', posts);
    path(root, 'ta-bike-tube-edge', tubes);
    path(root, 'ta-bike-tube', tubes);
    path(root, 'ta-bike-tube-light', `M${S[0] + 1.6} ${S[1] - 1.4} L175 91.6 M${S[0] - 1.6} ${S[1] + 1.4} L${R[0] + 1} ${R[1] - 2.4} M178 105.4 L${B[0] + 1.4} ${B[1] - 2.6}`);

    // Basket on the handlebars.
    const basket = 'M180 73 H209 L205.6 95 Q205 97 203 97 H186 Q184 97 183.4 95 Z';
    path(root, 'ta-bike-basket', basket);
    path(root, 'ta-bike-basket-rim', 'M179 71.5 H210 Q211.5 71.5 211.5 73.5 V76 Q211.5 77.5 210 77.5 H179 Q177.5 77.5 177.5 76 V73.5 Q177.5 71.5 179 71.5 Z');
    path(root, 'ta-bike-weave', 'M186.5 78 L188.5 96.5 M194.5 78 V96.5 M202.5 78 L200.5 96.5 M181.6 84 H207.4 M182.6 90.4 H206.4');
    path(root, 'ta-ink', join(basket, 'M179 71.5 H210 Q211.5 71.5 211.5 73.5 V76 Q211.5 77.5 210 77.5 H179 Q177.5 77.5 177.5 76 V73.5 Q177.5 71.5 179 71.5 Z'));

    // Saddle, grip, crank, pedal.
    const saddle = 'M112 86.5 C112 82 120 82.4 128 83.6 C135 84.4 141 84.6 144.5 87 C144.5 90.6 137 91.6 129 91.6 C121 92 113 91.6 112 86.5 Z';
    path(root, 'ta-bike-dark', join(saddle, pen().rect(153.5, 72.6, 10.5, 6, 2.6).toString(), pen().rect(147, 146.6, 12, 4.4, 1.6).toString()));
    path(root, 'ta-bike-dark-light', 'M114.5 85.6 C116 83.6 122 84 128 85 C133 85.6 138 86 141 87 C136 87.4 122 87.4 114.5 85.6 Z M155 74 H162.5 V75.6 H155 Z');
    path(root, 'ta-bike-metal-edge', `M${B[0]} ${B[1]} L152 147.6`);
    path(root, 'ta-bike-brass', join(shape.circle(B[0], B[1], 8.4), shape.circle(R[0], R[1], 4.4), shape.circle(F[0], F[1], 3.4)));
    path(root, 'ta-bike-metal', `M${B[0]} ${B[1]} L152 147.6`);
    path(root, 'ta-ink', join(saddle, pen().rect(153.5, 72.6, 10.5, 6, 2.6).toString(), pen().rect(147, 146.6, 12, 4.4, 1.6).toString()));
    path(root, 'ta-ink-fine', join(shape.circle(B[0], B[1], 8.4), shape.circle(B[0], B[1], 4.6), shape.circle(R[0], R[1], 4.4), shape.circle(F[0], F[1], 3.4), shape.circle(B[0], B[1], 1.4)));

    path(root, 'ta-ink', frameD(300, 200));
    return root;
  };

  // ---- hats ------------------------------------------------------------

  /**
   * A wall rail with two pegs: a yellow hard hat with a green plus (adding behavior) and a blue soft cap
   * with a broom patch (refactoring): "wear one hat at a time".
   * viewBox 0 0 320 190. Parts: .ta-hats-hard (origin 92 64), .ta-hats-cap (origin 228 66),
   * .ta-hats-knob-hard / .ta-hats-knob-cap (the peg tops, shown when that hat is lifted).
   * States: default, is-build (hard hat lifts, cap dims), is-tidy (cap lifts, hard hat dims).
   */
  art.hats = function hats(parent) {
    const root = panel(parent, 'hats', 320, 190);
    path(root, 'ta-hats-wall', frameD(320, 190));
    path(root, 'ta-hats-wall-light', 'M96 1.5 H196 L112 188.5 H15.5 a14 14 0 0 1 -3.5 -0.5 Z');

    // Rail and peg stems.
    path(root, 'ta-shadow', pen().rect(34, 124, 262, 6, 3).toString());
    const rail = pen().rect(28, 108, 264, 17, 5).toString();
    path(root, 'ta-hats-wood', rail);
    path(root, 'ta-hats-wood-light', pen().rect(31, 110, 258, 3.4, 1.7).toString());
    path(root, 'ta-hats-wood-shade', 'M30 120 H290 Q291.5 123 288 125 H32 Q28.5 123 30 120 Z');
    path(root, 'ta-hats-grain', 'M44 116.5 C70 115 100 118 128 116.5 M150 118 C176 116.5 196 118.5 214 117.5 M246 116.5 C258 115.5 270 117.5 280 116.5');
    path(root, 'ta-ink', rail);
    const stem = (x) => `M${x - 5} 119 L${x - 4} 93 H${x + 4} L${x + 5} 119 Q${x} 121.5 ${x - 5} 119 Z`;
    const flange = (x) => ellipse(x, 118.4, 9, 3.4);
    path(root, 'ta-hats-wood', join(flange(92), flange(228), stem(92), stem(228)));
    path(root, 'ta-hats-wood-shade', `M93.5 93 H96 L97 119 L93.5 120.4 Z M229.5 93 H232 L233 119 L229.5 120.4 Z`);
    path(root, 'ta-ink-fine', join(flange(92), flange(228)));
    path(root, 'ta-ink', `M87 118.4 L88 93 M96 93 L97 118.4 M223 118.4 L224 93 M232 93 L233 118.4`);

    // Peg tops: visible only while their hat is lifted off.
    const knob = (parentGroup, x, tilt) => {
      const top = `M${x - 4} 94 L${x - 3.4} 86 H${x + 3.4} L${x + 4} 94 Z`;
      path(parentGroup, 'ta-hats-wood', join(top, shape.circle(x, 80, 7.6)));
      path(parentGroup, 'ta-hats-wood-shade', crescent(x, 80, 7.6, -2.6, -2.6));
      path(parentGroup, 'ta-hats-wood-light', ellipse(x - 2.6, 77, 2.6, 1.7));
      path(parentGroup, 'ta-ink', join(shape.circle(x, 80, 7.6), `M${x - 4} 94 L${x - 3.6} 87 M${x + 3.6} 87 L${x + 4} 94`));
      path(parentGroup, 'ta-ink-fine', tilt > 0
        ? `M${x - 30} 84 q-3 6 -1 12 M${x - 22} 88 q-2 4 -1 8 M${x + 36} 78 q3 6 1 12 M${x + 28} 84 q2 4 1 8`
        : `M${x - 36} 78 q-3 6 -1 12 M${x - 28} 84 q-2 4 -1 8 M${x + 30} 84 q3 6 1 12 M${x + 22} 88 q2 4 1 8`);
    };
    knob(group(root, 'ta-hats-knob ta-hats-knob-hard'), 92, -1);
    knob(group(root, 'ta-hats-knob ta-hats-knob-cap'), 228, 1);

    // Hard hat (faces left).
    const hard = group(root, 'ta-hats-hat ta-hats-hard');
    const dome = 'M53 83 C52 56 70 37 94 37 C118 37 135 55 134 83 Z';
    const brim = 'M38 89 C36.5 85.5 43 82.6 52 82 H134 C138.4 82 140.6 84.6 140 88 C139.4 91 136 93 131 93 H47 C42 93 39 92 38 89 Z';
    const crest = 'M62 61 C68 43 80 32.6 95 32 C110 32.6 122 42 128 58 L123.4 60.4 C118.6 47.6 108 39 95 38.4 C82 39 71.6 48 66.6 63 Z';
    const plus = pen().poly(92.6, 52, 99.4, 52, 99.4, 59.6, 107, 59.6, 107, 66.4, 99.4, 66.4, 99.4, 74, 92.6, 74, 92.6, 66.4, 85, 66.4, 85, 59.6, 92.6, 59.6).toString();
    path(hard, 'ta-shadow', 'M60 90 C59 63 77 44 101 44 C125 44 142 62 141 89 C145 89 147.6 91.6 147 95 C146.4 98 143 100 138 100 H54 C49 100 46 99 45 96 C44 92.5 50 90 60 90 Z');
    path(hard, 'ta-hats-yellow', join(dome, brim));
    path(hard, 'ta-hats-yellow-shade', join(
      'M134 83 C135 68 130 55 121 47 C125 59 125.4 72 120 83 Z',
      'M38.6 89.6 C60 91 110 91 139.6 89 C138.6 91.6 135.6 93 131 93 H47 C42 93 39.4 92 38.6 89.6 Z'));
    path(hard, 'ta-hats-yellow-light', join(crest, 'M59 76 C59 60 66 49 76 44.4 C70 52 66.6 63 66.4 76 Z'));
    path(hard, 'ta-hats-plus', plus);
    path(hard, 'ta-hats-plus-light', pen().poly(92.6, 52, 99.4, 52, 99.4, 54, 94.6, 54, 94.6, 61.6, 87, 61.6, 87, 66.4, 85, 66.4, 85, 59.6, 92.6, 59.6).toString());
    path(hard, 'ta-ink', join(dome, brim, crest));
    path(hard, 'ta-ink-fine', join(plus, 'M74.6 80 C74 66 77.6 54 84 46 M114 46.4 C119 55 120.6 68 118 80'));

    // Soft cap (faces right).
    const cap = group(root, 'ta-hats-hat ta-hats-cap');
    const crown = 'M190 89 C185 62 203 40 229 40 C252 40 265 58 266.5 84 L266.5 88.4 C240 92.4 214 92.6 190 89 Z';
    const bill = 'M262 78.6 C279 77.6 296 83.6 303.6 91.4 C305.6 94.4 303.4 97.2 298.6 96.4 C286 93 274 91.6 262 92 Z';
    const broomHead = 'M232.4 70.6 L237.6 66.4 L243.4 73 L236.6 78.4 Z';
    path(cap, 'ta-shadow', 'M197 96 C192 69 210 47 236 47 C259 47 272 65 273.5 90 C287 90 300 94 308 99.4 C310 101.6 308.4 104 304 103.6 C292 101 280 99.4 270 99.4 C246 100 220 100 197 96 Z');
    path(cap, 'ta-hats-blue', join(bill, crown));
    path(cap, 'ta-hats-blue-shade', join(
      'M266.5 84 C265.4 70 260 57 250.6 48.4 C256.6 61 257.6 77 254 90 L266.5 88.4 Z',
      'M267 88.4 C279 88.6 292 91 303.4 95 C302.6 96.6 301 96.8 298.6 96.4 C286 93 276 91.8 267 91.8 Z',
      'M190 89 C200 90.6 212 91.6 224 91.6 L224 87.6 C212 87.6 200 86.6 189.4 85 Z'));
    path(cap, 'ta-hats-blue-light', join('M193.6 78 C193 62 202 50 215 45 C206 54 201 65 200.6 78 Z', shape.circle(229, 39, 3.2)));
    path(cap, 'ta-hats-patch', shape.circle(233, 68, 12));
    path(cap, 'ta-hats-straw', broomHead);
    path(cap, 'ta-ink', join(bill.replace('M262 78.6', 'M266.4 78.6').replace(' C286 93 274 91.6 262 92 Z', ' C286 93 276 91.8 266.4 91.6'), crown));
    path(cap, 'ta-ink-fine', join(
      shape.circle(233, 68, 12), shape.circle(229, 39, 3.2), broomHead,
      'M226 59.4 L235 68.4 M238 72.4 L240.6 75.2 M235.6 74 L238.4 77',
      'M228 42 C216 56 212 72 212.6 91 M231 42 C244 50 251 66 251 90',
      'M190.6 85 C214 88.6 242 88.4 266.5 84.6'));

    path(root, 'ta-ink', frameD(320, 190));
    return root;
  };

  // ---- dice ------------------------------------------------------------

  /** One die as an isometric cube: face fills and pip centres, turned by `deg` about its centre. */
  function die(cx, cy, s, deg, [topPips, leftPips, rightPips]) {
    const tf = rotateAbout(deg, cx, cy);
    const k = 0.87 * s;
    const corner = {
      top: [cx, cy - s], right: [cx + k, cy - s / 2], mid: [cx, cy], left: [cx - k, cy - s / 2],
      bottom: [cx, cy + s], rightLow: [cx + k, cy + s / 2], leftLow: [cx - k, cy + s / 2],
    };
    const faces = {
      top: [corner.left, corner.top, corner.right, corner.mid],
      left: [corner.left, corner.mid, corner.bottom, corner.leftLow],
      right: [corner.mid, corner.right, corner.rightLow, corner.bottom],
    };
    const quad = (points) => pen(tf).poly(...points.flat()).toString();
    const layouts = {
      1: [[0.5, 0.5]],
      2: [[0.27, 0.27], [0.73, 0.73]],
      3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
      4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
      5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
      6: [[0.27, 0.22], [0.27, 0.5], [0.27, 0.78], [0.73, 0.22], [0.73, 0.5], [0.73, 0.78]],
    };
    const pips = ([a, b, , d], count) => layouts[count].map(([u, v]) => {
      const x = a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v;
      const y = a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v;
      const [px, py] = tf(x, y);
      return shape.circle(px, py, s * 0.125);
    }).join(' ');
    const outline = pen(tf).poly(...[corner.top, corner.right, corner.rightLow, corner.bottom, corner.leftLow, corner.left].flat()).toString();
    const edges = pen(tf).M(...corner.left).L(...corner.mid, ...corner.right).M(...corner.mid).L(...corner.bottom).toString();
    return {
      top: quad(faces.top), left: quad(faces.left), right: quad(faces.right), outline, edges,
      pips: join(pips(faces.top, topPips), pips(faces.left, leftPips), pips(faces.right, rightPips)),
    };
  }

  /**
   * Two red dice tumbling, one in the air and one landing: "changing behavior and structure at once on
   * red is a gamble". viewBox 0 0 90 70. No parts, no states.
   */
  art.dice = function dice(parent) {
    const root = panel(parent, 'dice', 90, 70);
    const a = die(29, 25, 15.5, -20, [5, 3, 1]);
    const b = die(62, 43, 15.5, 13, [2, 6, 4]);
    path(root, 'ta-shadow', join(ellipse(64, 62.6, 19, 4), ellipse(31, 64, 11, 2.4)));
    path(root, 'ta-dice-top', join(a.top, b.top));
    path(root, 'ta-dice-left', join(a.left, b.left));
    path(root, 'ta-dice-right', join(a.right, b.right));
    path(root, 'ta-dice-pip', join(a.pips, b.pips));
    path(root, 'ta-ink', join(a.outline, b.outline));
    path(root, 'ta-ink-fine', join(a.edges, b.edges));
    path(root, 'ta-r2-mark', 'M6 13 Q2.6 22 6.6 31 M11.4 9 Q9 14 9.6 19 M46 14 Q51 12 54 16 M82 53 l5 -2 M83 58.6 l5.4 1.2 M42 60 l-4.6 2.4');
    return root;
  };

  // ---- bandage (shared with the tower) ---------------------------------

  /** Path data for an adhesive bandage of length `len` and width `wid`, centred on the origin of `tf`. */
  function bandageParts(tf, len, wid) {
    const h = wid / 2;
    const l = len / 2;
    const pad = wid * 0.52;
    const capsule = pen(tf).M(-l + h, -h).L(l - h, -h).C(l - h * 0.4, -h, l, -h * 0.5, l, 0).C(l, h * 0.5, l - h * 0.4, h, l - h, h)
      .L(-l + h, h).C(-l + h * 0.4, h, -l, h * 0.5, -l, 0).C(-l, -h * 0.5, -l + h * 0.4, -h, -l + h, -h).Z().toString();
    const holes = [];
    const step = wid * 0.27;
    [-1, 1].forEach((side) => {
      for (let col = 0; col < 2; col += 1) {
        for (let row = -1; row <= 1; row += 1) holes.push([side * (pad + step * 0.95 + col * step), row * step]);
      }
    });
    return {
      capsule,
      pad: pen(tf).rect(-pad, -h, 2 * pad, wid).toString(),
      padLines: pen(tf).M(-pad, -h).L(-pad, h).M(pad, -h).L(pad, h).toString(),
      shade: pen(tf).M(-l + h, h).L(l - h, h).C(l - h * 0.4, h, l, h * 0.5, l, 0).C(l - h * 0.2, h * 0.36, l - h * 0.6, h * 0.62, l - h, h * 0.62)
        .L(-l + h, h * 0.62).C(-l + h * 0.6, h * 0.62, -l + h * 0.2, h * 0.36, -l, 0).C(-l, h * 0.5, -l + h * 0.4, h, -l + h, h).Z().toString(),
      light: pen(tf).rect(-l + h, -h * 0.74, len - wid, h * 0.24, h * 0.12).toString(),
      holes,
      holeDots: (r) => holes.map(([x, y]) => pen(tf).circle(x, y, r).toString()).join(' '),
    };
  }

  /**
   * An adhesive bandage at an angle, with its pad, vent holes, and rounded ends: "a repair".
   * viewBox 0 0 80 50. No parts, no states.
   */
  art.bandage = function bandage(parent) {
    const root = panel(parent, 'bandage', 80, 50);
    const parts = bandageParts(placeAt(39.5, 24, -16), 66, 21);
    const cast = bandageParts(placeAt(42, 27, -16), 66, 21);
    path(root, 'ta-shadow', cast.capsule);
    path(root, 'ta-bandage-strip', parts.capsule);
    path(root, 'ta-bandage-shade', parts.shade);
    path(root, 'ta-bandage-light', parts.light);
    path(root, 'ta-bandage-pad', parts.pad);
    path(root, 'ta-bandage-hole', parts.holeDots(1.25));
    path(root, 'ta-ink', parts.capsule);
    path(root, 'ta-ink-fine', parts.padLines);
    return root;
  };

  // ---- tower -----------------------------------------------------------

  // Pose of each block: bottom-centre x, y and lean in degrees (each block rests on the one below).
  const TOWER_POSES = [[100, 246, 0], [93, 214, -1.5], [101.2, 181.8, 2], [97.3, 149.6, 4.5], [107.8, 118.4, 8], [116.2, 87.2, 12]];
  const TOWER_COLORS = ['teal', 'orange', 'violet', 'gold', 'teal', 'orange'];
  // Code-line bars per block: [x, y, width] in block space (origin bottom centre), light and dark.
  const TOWER_BARS = [
    { light: [[-22, -23, 46], [-34, -13, 22]], dark: [[-44, -23, 17], [-7, -13, 34]] },
    { light: [[-44, -23, 30], [-10, -13, 26]], dark: [[-9, -23, 22], [-34, -13, 19]] },
    { light: [[-20, -23, 28], [-34, -13, 40]], dark: [[-44, -23, 19], [11, -13, 18]] },
    { light: [[-44, -23, 22], [-14, -13, 30]], dark: [[-17, -23, 36], [-34, -13, 15]] },
    { light: [[-24, -23, 38], [-34, -13, 18]], dark: [[-44, -23, 15], [-11, -13, 30]] },
    { light: [[-44, -23, 34], [-6, -13, 24]], dark: [[-5, -23, 20], [-34, -13, 23]] },
  ];
  // Bandages: block index -> [x, y, angle] in block space.
  const TOWER_PATCHES = { 2: [30, -15, -24], 3: [-26, -17, 18], 5: [28, -16, 28], 6: [-22, -15, -20] };
  const TOWER_TEETER = 4;

  /**
   * A teetering tower of n stacked code blocks, several patched with bandages, leaning more with height:
   * "patches pile up". viewBox 0 0 200 260. Parts: .ta-tower-block-1 (bottom) .. -n, each with its origin
   * at its bottom centre (TOWER_POSES). State: is-teeter leans the top three further and shows wobble marks.
   */
  art.tower = function tower(parent, { n = 6 } = {}) {
    const count = Math.max(1, Math.min(6, n));
    const root = panel(parent, 'tower', 200, 260);
    const pivotIndex = Math.max(1, count - 2);
    path(root, 'ta-shadow', ellipse(106, 247.4, 64, 6.4));

    for (let i = 1; i <= count; i += 1) {
      const [px, py, lean] = TOWER_POSES[i - 1];
      const tf = placeAt(px, py, lean);
      const block = group(root, `ta-tower-block ta-tower-block-${i}`);
      const holder = i >= pivotIndex && count > 1 ? group(block, `ta-tower-sway ta-tower-sway-${pivotIndex}`) : block;
      const slab = pen(tf).rect(-54, -32, 108, 32, 6).toString();
      const bars = TOWER_BARS[i - 1];
      const barD = (list) => list.map(([x, y, w]) => pen(tf).rect(x, y, w, 5.4, 2.4).toString()).join(' ');
      path(holder, `ta-tower-slab ta-tower-${TOWER_COLORS[i - 1]}`, slab);
      path(holder, 'ta-tower-sheen', pen(tf).rect(-50, -29.6, 100, 3.6, 1.8).toString());
      path(holder, 'ta-tower-bar', barD(bars.light));
      path(holder, 'ta-tower-bar-dark', barD(bars.dark));
      path(holder, 'ta-ink', slab);
      const patch = TOWER_PATCHES[i];
      if (patch) {
        const parts = bandageParts(compose(tf, placeAt(patch[0], patch[1], patch[2])), 46, 15);
        path(holder, 'ta-bandage-strip', parts.capsule);
        path(holder, 'ta-bandage-pad', parts.pad);
        path(holder, 'ta-ink-fine', join(parts.capsule, parts.padLines, parts.holeDots(0.7)));
      }
    }

    // Wobble marks beside the top block, in its teetering pose.
    const [topX, topY, topLean] = TOWER_POSES[count - 1];
    const [pivotX, pivotY] = TOWER_POSES[pivotIndex - 1];
    const swayed = compose(rotateAbout(count > 1 ? TOWER_TEETER : 0, pivotX, pivotY), placeAt(topX, topY, topLean));
    path(root, 'ta-r2-mark ta-tower-wobble', join(
      pen(swayed).M(-61, -34).Q(-66, -24, -62, -14).M(-68, -30).Q(-71, -24, -69, -18).toString(),
      pen(swayed).M(61, -34).Q(66, -24, 62, -14).M(68, -30).Q(71, -24, 69, -18).toString()));
    return root;
  };

  // ---- broom -----------------------------------------------------------

  /**
   * A push broom at work: wooden handle and head, straw bristles, a dust cloud ahead of it and sparkles
   * on the swept floor behind: "cleanup". viewBox 0 0 110 100. No parts, no states.
   */
  art.broom = function broom(parent) {
    const root = panel(parent, 'broom', 110, 100);
    const head = 'M18 55.6 L69 48.6 Q71.6 48.4 72 51 L72.8 58 Q73 60.6 70.4 61 L20.4 68 Q17.8 68.2 17.2 65.6 L16 58.6 Q15.6 56 18 55.6 Z';
    const bristles = 'M19 67.6 L71 60.4 L78.6 81 Q79 83 77 83.4 L14 91.6 Q11.4 91.6 11.8 89 Z';
    const dust = [[13, 80, 7.4], [6.6, 88, 5.4], [18, 89.6, 6.4], [27.6, 92.6, 4.8]];
    const dustD = dust.map(([x, y, r]) => shape.circle(x, y, r)).join(' ');
    const sparkles = join(sparkle(92, 70, 7), sparkle(101, 87, 4.6), sparkle(80, 92, 3.6));

    path(root, 'ta-shadow', 'M16 92 L78 84 L88 88.6 L24 97.4 Z');
    path(root, 'ta-broom-handle-edge', 'M46 55 L99.6 8');
    path(root, 'ta-broom-handle', 'M46 55 L99.6 8');
    path(root, 'ta-broom-handle-light', 'M46.4 52.4 L97.6 7.6');
    path(root, 'ta-broom-straw', bristles);
    path(root, 'ta-broom-straw-shade', 'M71 60.4 L78.6 81 Q79 83 77 83.4 L60 85.6 L58 62.2 Z M14 91.6 L77 83.4 Q79 83 78.6 81 L77.6 78.4 L12.6 86.6 L11.8 89 Q11.4 91.6 14 91.6 Z');
    path(root, 'ta-broom-strand', 'M27 67 L22.6 88 M35 65.8 L32 87 M43 64.6 L42 86 M51 63.6 L52 84.6 M59 62.4 L62 83.4 M66 61.4 L71 82');
    path(root, 'ta-broom-wood', head);
    path(root, 'ta-broom-wood-light', 'M19.6 57.4 L69.6 50.6 L70 53.4 L20 60.2 Z');
    path(root, 'ta-broom-metal', 'M40.4 57.6 L43.6 49.6 L51.4 48.6 L52 56 Z');
    path(root, 'ta-ink', join(bristles, head));
    path(root, 'ta-ink-fine', 'M40.4 57.6 L43.6 49.6 L51.4 48.6 L52 56');
    path(root, 'ta-broom-dust-edge', dustD);
    path(root, 'ta-broom-dust', dustD);
    path(root, 'ta-broom-dust-shade', join(crescent(13, 80, 7.4, -2.4, -2.6), crescent(18, 89.6, 6.4, -2.2, -2.4), 'M2 78 l3 1.4 M4 71.6 l2.4 2.4 M30 84 l2.6 -1.6'));
    path(root, 'ta-broom-spark', sparkles);
    path(root, 'ta-ink-fine', sparkles);
    return root;
  };

  // ---- snail -----------------------------------------------------------

  /**
   * A friendly snail crawling right with a spiral orange shell and a faint slime trail: "tiny steps can
   * feel slow". viewBox 0 0 90 60. No parts, no states.
   */
  art.snail = function snail(parent) {
    const root = panel(parent, 'snail', 90, 60);
    const body = 'M9 51 C15 46.6 24 45.6 34 45.6 L58 45.6 C65 45.6 67.6 40 67.6 34 C67.6 27.6 71.6 24.6 76 25 C81.6 25.6 84 31 83 38 C81.6 46.6 76 52.6 66 52.6 L13 52.6 C9.6 52.6 7.6 52.2 9 51 Z';
    const stalks = 'M71.6 27 L68.6 14.4 L71.8 13.6 L75 26 Z M77.6 26 L80.4 13.6 L83.6 14.4 L80.8 27 Z';
    const eyes = join(shape.circle(70, 11.6, 4), shape.circle(82.4, 11.6, 4));
    let spiral = '';
    for (let step = 0; step <= 46; step += 1) {
      const t = step / 46;
      const angle = (20 + t * 760) * (Math.PI / 180);
      const radius = 14.6 * (1 - t) + 1.4;
      spiral += `${step ? ' L' : 'M'}${r2(38 + radius * Math.cos(angle))} ${r2(30 + radius * Math.sin(angle))}`;
    }

    path(root, 'ta-snail-slime', 'M2.4 53 C8 50 20 50.6 34 50.6 V56 C22 56.8 10 56.8 4 56.4 C0.8 56 0.6 54 2.4 53 Z');
    path(root, 'ta-shadow', ellipse(46, 54, 36, 2.8));
    path(root, 'ta-snail-body', join(stalks, body));
    path(root, 'ta-snail-body-shade', 'M9.6 51.6 C30 49.6 56 50.6 66 49.6 C74 48.6 79.6 44 82.6 38.6 C81.4 46.8 76 52.6 66 52.6 L13 52.6 C10 52.6 8.6 52.4 9.6 51.6 Z');
    path(root, 'ta-ink-fine', stalks);
    path(root, 'ta-ink', body);
    path(root, 'ta-snail-shell', shape.circle(38, 30, 19));
    path(root, 'ta-snail-shell-shade', crescent(38, 30, 19, -5, -5));
    path(root, 'ta-snail-shell-light', join(ellipse(29, 20.6, 6.4, 3.6), 'M22.6 31 C22.6 26 24 23 26 21 C25 24.6 24.8 28 25 32 Z'));
    path(root, 'ta-ink', shape.circle(38, 30, 19));
    path(root, 'ta-ink-fine', join(spiral, eyes, 'M75 38.6 Q78 41.4 80.6 38'));
    path(root, 'ta-snail-eye', eyes);
    path(root, 'ta-ink-fine', eyes);
    path(root, 'ta-snail-pupil', join(shape.circle(71.4, 11.8, 1.7), shape.circle(83.8, 11.8, 1.7)));
    return root;
  };
})();

// ------------------------------------------------------------------
// What TDD gives, what it costs, its limits, and the evidence
// ------------------------------------------------------------------

/* Illustrations for the "consequences" scenes of the Test-Driven Development
 * video narration: what TDD gives, what it costs, its limits, the evidence.
 * Every function appends one <svg class="ta-art ta-<name>"> to its parent. */
(function () {
  'use strict';

  const { svg } = window.SongKit;
  const { shape } = window.ArchKit;
  const art = (window.TddArt = window.TddArt || {});

  const r2 = (value) => Math.round(value * 100) / 100;
  const at = (point) => `${r2(point[0])} ${r2(point[1])}`;
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpPoint = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  /** Appends one painted path. */
  const P = (parent, paint, d) => svg('path', { class: paint, d }, parent);
  /** Appends one group (a part). */
  const G = (parent, name) => svg('g', { class: name }, parent);
  /** Root element of one illustration. */
  const rootOf = (parent, name, width, height) => svg('svg', {
    viewBox: `0 0 ${width} ${height}`, class: `ta-art ta-${name}`, 'aria-hidden': 'true',
  }, parent);

  /** Closed polygon through the points. */
  const poly = (points) => `M${points.map(at).join('L')}Z`;
  /** Open polyline through the points. */
  const line = (points) => `M${points.map(at).join('L')}`;
  /** Open smooth curve through the points (quadratic through the midpoints). */
  function curve(points) {
    let d = `M${at(points[0])}`;
    for (let i = 1; i < points.length - 1; i += 1) {
      const mid = [(points[i][0] + points[i + 1][0]) / 2, (points[i][1] + points[i + 1][1]) / 2];
      d += `Q${at(points[i])} ${at(i === points.length - 2 ? points[i + 1] : mid)}`;
    }
    if (points.length === 2) d += `L${at(points[1])}`;
    return d;
  }
  /** Ellipse as path data. */
  const ell = (cx, cy, rx, ry) => `M${r2(cx - rx)} ${r2(cy)}a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(2 * rx)} 0a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-2 * rx)} 0Z`;
  /** Rounded rectangle; radius is one number or [topLeft, topRight, bottomRight, bottomLeft]. */
  function rr(x, y, w, h, radius) {
    const [tl, tr, br, bl] = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
    const arc = (r, dx, dy) => (r ? `a${r} ${r} 0 0 1 ${r2(dx * r)} ${r2(dy * r)}` : '');
    return `M${r2(x + tl)} ${r2(y)}h${r2(w - tl - tr)}${arc(tr, 1, 1)}v${r2(h - tr - br)}${arc(br, -1, 1)}h${r2(-(w - br - bl))}${arc(bl, -1, -1)}v${r2(-(h - bl - tl))}${arc(tl, 1, -1)}Z`;
  }
  /**
   * Band of a lathe-turned (mirror-symmetric) solid around the axis x = cx.
   * profile lists [y, halfWidth] from one end to the other; the band spans
   * from cx + halfWidth * from to cx + halfWidth * to (-1 = left edge, 1 = right edge).
   */
  function lathe(cx, profile, from = -1, to = 1) {
    const side = (factor) => profile.map(([y, half]) => [cx + half * factor, y]);
    const back = side(to).reverse();
    return `${curve(side(from))}L${at(back[0])}${curve(back).replace(/^M[^QL]+/, '')}Z`;
  }
  /** Four-pointed sparkle. */
  const sparkle = (x, y, s) => `M${r2(x)} ${r2(y - s)}Q${r2(x)} ${r2(y)} ${r2(x + s)} ${r2(y)}Q${r2(x)} ${r2(y)} ${r2(x)} ${r2(y + s)}Q${r2(x)} ${r2(y)} ${r2(x - s)} ${r2(y)}Q${r2(x)} ${r2(y)} ${r2(x)} ${r2(y - s)}Z`;

  /* ------------------------------------------------------------------ */
  /* Panel: safety net                                                   */
  /* ------------------------------------------------------------------ */

  const NET = { backLeft: [96, 172], backRight: [424, 172], frontLeft: [78, 210], frontRight: [442, 210] };

  /** Point of the net surface: u runs left to right, v back to front; caught adds the dip of a landing. */
  function netPoint(u, v, caught) {
    const back = [lerp(NET.backLeft[0], NET.backRight[0], u), lerp(NET.backLeft[1], NET.backRight[1], u)];
    const front = [lerp(NET.frontLeft[0], NET.frontRight[0], u), lerp(NET.frontLeft[1], NET.frontRight[1], u)];
    const span = 4 * u * (1 - u);
    let sag = 4 * span + 3 * span * Math.sin(Math.PI * v);
    if (caught) sag += 22 * Math.exp(-(((u - 0.5) / 0.17) ** 2)) * (0.4 + 0.6 * Math.sin(Math.PI * v));
    return [lerp(back[0], front[0], v), lerp(back[1], front[1], v) + sag];
  }

  /** Diamond mesh of the net as one path of crossing cords. */
  function netMesh(caught) {
    const slant = 0.13;
    const step = 0.05;
    let d = '';
    for (const direction of [1, -1]) {
      for (let c = -slant + step / 2; c < 1 + slant; c += step) {
        // u = c + direction * slant * (v - 0.5), kept inside 0..1
        const points = [];
        for (let i = 0; i <= 10; i += 1) {
          const v = i / 10;
          const u = c + direction * slant * (v - 0.5) * 2;
          if (u >= 0 && u <= 1) points.push(netPoint(u, v, caught));
        }
        if (points.length > 1) d += line(points);
      }
    }
    return d;
  }

  /** One rope edge of the net (v = 0 back, v = 1 front). */
  function netEdge(v, caught) {
    const points = [];
    for (let i = 0; i <= 32; i += 1) points.push(netPoint(i / 32, v, caught));
    return line(points);
  }

  /** One striped tent pole standing on the ring floor, with its brass collar and foot. */
  function tentPole(root, x) {
    const top = 2;
    const foot = 238;
    let bands = '';
    for (let y = 8; y + 26 <= foot - 6; y += 28) bands += poly([[x, y + 12], [x + 14, y], [x + 14, y + 12], [x, y + 24]]);
    P(root, 'ta-safetynet-cast', ell(x + 12, foot + 5, 22, 4.5));
    P(root, 'ta-safetynet-pole', shape.box(x, top, 14, foot - top));
    P(root, 'ta-safetynet-pole-band', bands);
    P(root, 'ta-safetynet-shade', shape.box(x + 9.5, top, 4.5, foot - top));
    P(root, 'ta-safetynet-brass', rr(x - 3, 178, 20, 9, 3) + rr(x - 6, foot - 5, 26, 9, 3));
    P(root, 'ta-ink', `${line([[x, top], [x, foot - 5]])}${line([[x + 14, top], [x + 14, foot - 5]])}${rr(x - 3, 178, 20, 9, 3)}${rr(x - 6, foot - 5, 26, 9, 3)}`);
  }

  /* Tightrope walker of the safety net panel ------------------------- */

  /** Closed smooth outline through one side's points and back along the other side. */
  function ribbon(top, bottom) {
    const back = bottom.slice().reverse();
    return `${curve(top)}L${at(back[0])}${curve(back).replace(/^M[^QL]+/, '')}Z`;
  }

  /** Tube around a centre line: the fill, and its two long edges as open curves. */
  function tube(points, halves) {
    const top = [];
    const bottom = [];
    points.forEach((point, i) => {
      const a = points[Math.max(i - 1, 0)];
      const b = points[Math.min(i + 1, points.length - 1)];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = (b[1] - a[1]) / length;
      const ny = -(b[0] - a[0]) / length;
      top.push([point[0] + nx * halves[i], point[1] + ny * halves[i]]);
      bottom.push([point[0] - nx * halves[i], point[1] - ny * halves[i]]);
    });
    return { fill: ribbon(top, bottom), edges: curve(top) + curve(bottom), top, bottom };
  }

  /** Maps hand-local points (x toward the fingertips, y down, origin at the wrist) to the panel. */
  function handFrame(wrist, angle, mirror) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return ([x, y]) => [wrist[0] + mirror * (x * cos - y * sin), wrist[1] + x * sin + y * cos];
  }

  /**
   * One hand that holds a window by its lower inner corner: the palm faces the viewer, the thumb is up and
   * lies on the window's front, the fingers pass under and behind it. Returns the paths and the window corner.
   */
  function holdingHand(wrist, angle, mirror) {
    const map = handFrame(wrist, angle, mirror);
    const path = (points, closed) => (closed ? poly(points.map(map)) : line(points.map(map)));
    const outline = [
      [-0.6, -2.4], [4, -3.25], [10.8, -3.25], [11.7, -2.3], [11.2, -1.35], [11.7, -1.3], [12.5, -0.4], [11.7, 0.5],
      [11.2, 0.55], [11.9, 1.5], [11.1, 2.4], [9.7, 2.45], [10.3, 3.3], [9.5, 4.2], [4, 4.25], [-0.6, 2.4],
    ];
    const thumb = [[0.2, -2], [2.1, -5], [5.2, -8.9], [7.3, -8.4], [7.4, -6.3], [4.8, -3.7], [3.9, -1.2]];
    return {
      fingers: path(outline, true),
      fingerInk: path(outline, false),
      creases: path([[5.6, -1.35], [11.2, -1.35]]) + path([[5.6, 0.55], [11.4, 0.55]]) + path([[5.6, 2.45], [10, 2.45]]),
      thumb: path(thumb, true),
      thumbInk: `M${at(map(thumb[0]))}Q${at(map(thumb[1]))} ${at(map([3.6, -7.2]))}Q${at(map(thumb[2]))} ${at(map([6.4, -9]))}Q${at(map([7.8, -8]))} ${at(map(thumb[4]))}L${at(map(thumb[5]))}`,
      corner: map([4.2, -1.2]),
    };
  }

  /** Paths of one small editor window: body, title bar, three dots, and code bars in three paints. */
  function codeWindow(x, y, w, h, rows) {
    const bars = ['', '', ''];
    rows.forEach(([indent, length, paint], i) => {
      bars[paint] += rr(x + 3.5 + indent, y + 8.6 + i * 4.3, length, 2.2, 1.1);
    });
    let dots = '';
    for (let i = 0; i < 3; i += 1) dots += shape.circle(x + 3.6 + i * 3, y + 2.9, 0.95);
    return { body: rr(x, y, w, h, 2.6), bar: rr(x, y, w, 5.8, [2.6, 2.6, 0, 0]), dots, bars };
  }

  /** Adds the tightrope, the student on it with two code windows, a third floating window, and the wobble marks. */
  function tightropeWalker(root) {
    const feet = [262, 110.5];

    // Tightrope between two brass collars a third of the way down the poles.
    const collars = rr(37, 79, 20, 9, 3) + rr(463, 79, 20, 9, 3);
    const rope = 'M55 84Q160 101 244 110.6L281 110.6Q364 101 465 84';
    P(root, 'ta-safetynet-rope-ink', rope);
    P(root, 'ta-safetynet-rope', rope);
    P(root, 'ta-safetynet-brass', collars);
    P(root, 'ta-ink', collars);

    // Third window, floating, and the arrow that moves code between windows.
    const spare = codeWindow(116, 7, 38, 24, [[0, 14, 0], [4, 20, 1], [4, 12, 2]]);
    P(root, 'ta-safetynet-window', spare.body);
    P(root, 'ta-safetynet-window-bar', spare.bar);
    P(root, 'ta-safetynet-window-dot', spare.dots);
    P(root, 'ta-safetynet-code-violet', spare.bars[0]);
    P(root, 'ta-safetynet-code-teal', spare.bars[1]);
    P(root, 'ta-safetynet-code-orange', spare.bars[2]);
    P(root, 'ta-ink-fine', spare.body + line([[116, 12.8], [154, 12.8]]));
    P(root, 'ta-safetynet-swap', 'M137 35C137 49 150 52 163 43');
    P(root, 'ta-safetynet-swap-head', 'M167.6 39.6L160 39.4L164.4 46.2Z');

    const marks = G(root, 'ta-safetynet-wobble');
    P(marks, 'ta-ink-fine', 'M236 64Q232 73 236 82M229 60Q222.5 73 229 86');

    const walker = G(root, 'ta-safetynet-walker');

    // Legs in mid-step along the rope: the rear heel is lifted, the front foot is flat.
    const rear = tube([[254.5, 60], [249.8, 83.5], [248.2, 97.6]], [5, 4.2, 3.1]);
    const front = tube([[265.5, 60], [268.6, 84], [266.4, 102.8]], [5, 4.2, 3.1]);
    const shoe = (origin, angle) => ({
      upper: poly(place([[0.6, -8], [-0.2, -3.4], [0.2, -1], [15.6, -1], [17.3, -2.2], [15.4, -4.4], [9.4, -5.6], [6.8, -8.4]], origin, angle)),
      sole: poly(place([[-0.4, -1.4], [0, 1.1], [16.6, 1.1], [17.7, -1.6]], origin, angle)),
      trim: poly(place([[2.4, -1.4], [3.2, -4.8], [5, -4.8], [5.6, -1.4]], origin, angle)),
      lace: line(place([[9.2, -5.4], [10.6, -3.6]], origin, angle)) + line(place([[11.4, -5], [12.8, -3.3]], origin, angle)),
    });
    const rearShoe = shoe([241.6, 101.6], 0.52);
    const frontShoe = shoe([262.4, 109.5], 0);
    const shin = (side) => ribbon(side.map(([x, y]) => [x + 0.7, y]), side.map(([x, y]) => [x + 2.5, y]));
    P(walker, 'ta-safetynet-pants', rear.fill + front.fill + poly([[249.6, 55], [270.4, 55], [270.6, 60.5], [260.4, 63], [259.6, 63], [249.4, 60.5]]));
    P(walker, 'ta-safetynet-pants-light', shin(rear.bottom) + shin(front.bottom));
    P(walker, 'ta-safetynet-shoe', rearShoe.upper + frontShoe.upper);
    P(walker, 'ta-safetynet-sole', rearShoe.sole + frontShoe.sole);
    P(walker, 'ta-safetynet-gold', rearShoe.trim + frontShoe.trim);
    P(walker, 'ta-ink-fine', rear.edges + front.edges + rearShoe.upper + frontShoe.upper + rearShoe.sole + frontShoe.sole);

    // Arms out for balance; the elbows hang a little below the line from shoulder to hand.
    const arms = [
      {
        skin: tube([[240.4, 38.4], [232, 43.5], [216.5, 45.5]], [3.5, 3.3, 2.5]),
        sleeve: { top: [[249.4, 30.8], [243, 32.2], [235.4, 36.4]], bottom: [[249.2, 40.6], [239.4, 44]] },
        hand: holdingHand([216.5, 45.5], -0.07, -1),
      },
      {
        skin: tube([[279.6, 38], [290, 42.5], [305, 38.5]], [3.5, 3.3, 2.5]),
        sleeve: { top: [[270.6, 30.8], [277.4, 32], [285.3, 35.8]], bottom: [[270.8, 40.6], [281.9, 43.8]] },
        hand: holdingHand([305, 38.5], -0.31, 1),
      },
    ];
    const sleeveFill = ({ sleeve }) => `${curve(sleeve.top)}L${at(sleeve.bottom[1])}L${at(sleeve.bottom[0])}Z`;
    const sleeveInk = ({ sleeve }) => `${curve(sleeve.top)}L${at(sleeve.bottom[1])}L${at(sleeve.bottom[0])}`;
    const cuff = ({ sleeve }) => poly([sleeve.top[2], sleeve.bottom[1], lerpPoint(sleeve.bottom[1], sleeve.bottom[0], 0.17), lerpPoint(sleeve.top[2], sleeve.top[1], 0.22)]);
    const underside = ({ sleeve }) => poly([sleeve.bottom[0], sleeve.bottom[1], lerpPoint(sleeve.bottom[1], sleeve.top[2], 0.3), [sleeve.bottom[0][0], sleeve.bottom[0][1] - 2.4]]);
    P(walker, 'ta-safetynet-skin', `${arms.map((arm) => arm.skin.fill + arm.hand.fingers).join('')}M257.2 23V31.4H263.4V23Z`);
    P(walker, 'ta-safetynet-skin-line', arms.map((arm) => arm.hand.creases).join(''));
    P(walker, 'ta-ink-fine', arms.map((arm) => arm.skin.edges + arm.hand.fingerInk).join(''));

    // Jersey: straight build, short sleeves, gold trim, no text.
    const torso = 'M256.6 29.8L249.4 30.8L249.2 40.6Q248.4 44 248.8 47Q249.8 53 249.4 59.4H270.6Q270.2 53 271.2 47Q271.6 44 270.8 40.6L270.6 30.8L263.6 29.8L260.2 33.6Z';
    P(walker, 'ta-safetynet-jersey', torso + arms.map(sleeveFill).join(''));
    P(walker, 'ta-safetynet-jersey-shade', `M266.8 32Q268.2 46 266.6 59.4H270.6Q270.2 53 271.2 47Q271.6 44 270.8 40.6L270.6 30.8Z${arms.map(underside).join('')}`);
    P(walker, 'ta-safetynet-jersey-light', 'M250.4 31.8L255.6 31L256.6 32.6Q253 33.4 250.6 35.4Z');
    P(walker, 'ta-safetynet-gold', `${arms.map(cuff).join('')}M256.6 29.8L260.2 33.6L263.6 29.8L262.2 29.4L260.2 31.6L258 29.4Z${shape.box(249.5, 57.4, 21, 2)}`);
    P(walker, 'ta-safetynet-fold', 'M251.4 46.4Q254 48.2 256.6 47.8M268.4 45.4Q266.4 47.6 264 47.8M250.6 41Q252.4 42.6 254.4 42.6M269.4 40.8Q268 42.4 266.2 42.6');
    P(walker, 'ta-ink-fine', `${arms.map(sleeveInk).join('')}M249.2 40.6Q248.4 44 248.8 47Q249.8 53 249.4 59.4H270.6Q270.2 53 271.2 47Q271.6 44 270.8 40.6M249.4 30.8L256.6 29.8L260.2 33.6L263.6 29.8L270.6 30.8`);

    // Head: short hair under a cap, eyes on the code in the raised window.
    const face = 'M254.6 18.4C254.4 23.4 256.8 27.4 260.8 27.4C264.6 27.4 266.6 23.4 266.4 18.4C266.2 13.4 263.6 11 260.5 11C257.2 11 254.8 13.4 254.6 18.4Z';
    const ear = 'M254.8 18.2Q252.8 18 253.2 20.2Q253.6 22.2 255.2 21.8';
    const dome = 'M253.7 15.4C253.3 9.6 256.6 7.6 260.5 7.6C264.4 7.6 267.5 9.8 267.2 15.4Q260.5 16.6 253.7 15.4Z';
    const brim = 'M257.4 15.2Q264.6 14.4 272 16.8Q265.2 18.6 257.6 16.8Z';
    P(walker, 'ta-safetynet-skin', `${ear}Z${face}`);
    P(walker, 'ta-safetynet-skin-shade', 'M266.4 18.4C266.6 23.4 264.6 27.4 260.8 27.4C263 25.8 264.6 22.4 264.6 17.6Z M255 15.6H266.2L266.3 17.6Q260.5 18.6 254.8 17.4Z M257.6 26.4Q260.6 28.4 263.2 26.6V29.4L260.2 31.4L257.6 29.2Z');
    P(walker, 'ta-safetynet-hair', 'M254.2 15.2H256.6L256.2 18.2L254.7 19Z M266.6 15.2H264.5L265 17.8L266.4 18.8Z');
    P(walker, 'ta-safetynet-eye', ell(258.9, 20.3, 1.35, 1.05) + ell(263.6, 20.3, 1.25, 1.05));
    P(walker, 'ta-safetynet-pupil', shape.circle(259.4, 20.2, 0.78) + shape.circle(264.1, 20.2, 0.78));
    P(walker, 'ta-safetynet-face-line', `M257.6 18.4Q258.9 17.7 260.2 18.3M262.6 18.3Q263.7 17.7 264.9 18.4M261.8 21L262.5 22.6L261.5 22.8M259.2 24.3Q261.2 25.7 263.4 24.2${ear}${rearShoe.lace}${frontShoe.lace}`);
    P(walker, 'ta-ink-fine', face);
    P(walker, 'ta-safetynet-jersey', dome);
    P(walker, 'ta-safetynet-jersey-light', 'M254.8 12.6C255.4 9.8 257.6 8.6 260 8.5C257.8 9.6 256.6 11 256.2 13.2Z');
    P(walker, 'ta-safetynet-jersey-shade', brim);
    P(walker, 'ta-ink-fine', dome + brim);

    // The two windows in the hands; each thumb lies on its window's front.
    const [leftCorner, rightCorner] = arms.map((arm) => arm.hand.corner);
    const windows = [
      codeWindow(leftCorner[0] - 40, leftCorner[1] - 26, 40, 26, [[0, 12, 1], [4, 22, 0], [4, 14, 2], [0, 8, 1]]),
      codeWindow(rightCorner[0], rightCorner[1] - 28, 42, 28, [[0, 16, 0], [4, 24, 2], [4, 16, 1], [4, 20, 0]]),
    ];
    const both = (pick) => windows.map(pick).join('');
    P(walker, 'ta-safetynet-window', both((w) => w.body));
    P(walker, 'ta-safetynet-window-bar', both((w) => w.bar));
    P(walker, 'ta-safetynet-window-dot', both((w) => w.dots));
    P(walker, 'ta-safetynet-code-violet', both((w) => w.bars[0]));
    P(walker, 'ta-safetynet-code-teal', both((w) => w.bars[1]));
    P(walker, 'ta-safetynet-code-orange', both((w) => w.bars[2]));
    P(walker, 'ta-ink-fine', both((w) => w.body));
    P(walker, 'ta-safetynet-skin', arms.map((arm) => arm.hand.thumb).join(''));
    P(walker, 'ta-ink-fine', arms.map((arm) => arm.hand.thumbInk).join(''));
    return { feet, windows: [leftCorner, rightCorner] };
  }

  /**
   * Framed circus big top with a trapeze and a safety net between two poles: the regression safety net of passing tests.
   * viewBox 0 0 520 260. State is-caught: the net dips in the middle. Clear: x 180..340, y 60..170 and the band y 225..255.
   * options.walker replaces the trapeze with a tightrope and a student who rearranges code windows on it
   * (refactoring above the safety net): part .ta-safetynet-walker (pivot 262,110.5), state is-wobble.
   */
  art.safetyNet = function safetyNet(parent, options = {}) {
    const root = rootOf(parent, 'safetynet', 520, 260);
    const apex = [260, -90];
    const eave = 96;
    const wallFoot = 166;
    const fanX = (x, y) => apex[0] + (x - apex[0]) * (y - apex[1]) / (eave - apex[1]);

    P(root, 'ta-safetynet-red', rr(2, 2, 516, 256, 14));
    let stripes = '';
    let seams = '';
    for (let x = 40; x < 480; x += 80) {
      stripes += poly([[fanX(x, 2), 2], [fanX(x + 40, 2), 2], [x + 40, eave], [x + 40, wallFoot], [x, wallFoot], [x, eave]]);
    }
    for (let x = 40; x <= 480; x += 40) seams += line([[fanX(x, 2), 2], [x, eave]]);
    P(root, 'ta-safetynet-cream', stripes);
    P(root, 'ta-safetynet-seam', seams);
    P(root, 'ta-safetynet-shade', shape.box(2, eave, 516, wallFoot - eave));

    // Scalloped valance where the roof meets the wall.
    let scallops = `M2 ${eave - 7}H518V${eave + 2}H510`;
    for (let x = 510; x > 10; x -= 20) scallops += `a10 10 0 0 1 -20 0`;
    scallops += `H2Z`;
    P(root, 'ta-safetynet-gold', scallops);
    P(root, 'ta-safetynet-gold-shade', shape.box(2, eave - 7, 516, 3));
    P(root, 'ta-ink-fine', `${scallops}`);

    // Ring floor with its curb, the spotlight's beam and pool.
    const floor = 'M2 162Q260 138 518 162V244a14 14 0 0 1 -14 14H16a14 14 0 0 1 -14 -14Z';
    P(root, 'ta-safetynet-floor', floor);
    P(root, 'ta-safetynet-curb', 'M2 151Q260 127 518 151V162Q260 138 2 162Z');
    P(root, 'ta-safetynet-gold', 'M2 151Q260 127 518 151V154.5Q260 130.5 2 154.5Z');
    P(root, 'ta-ink-fine', 'M2 151Q260 127 518 151M2 162Q260 138 518 162');
    P(root, 'ta-safetynet-glow', `${poly([[146, 2], [184, 2], [404, 222], [116, 222]])}`);
    P(root, 'ta-safetynet-pool', ell(260, 226, 152, 27));
    P(root, 'ta-safetynet-cast', ell(260, 239, 170, 8));

    tentPole(root, 40);
    tentPole(root, 466);

    if (options.walker) {
      tightropeWalker(root);
    } else {
      // Trapeze.
      P(root, 'ta-safetynet-rope-ink', line([[234, 2], [234, 44]]) + line([[286, 2], [286, 44]]));
      P(root, 'ta-safetynet-rope', line([[234, 2], [234, 44]]) + line([[286, 2], [286, 44]]));
      P(root, 'ta-safetynet-wood', rr(222, 42, 76, 8, 4));
      P(root, 'ta-safetynet-wood-light', rr(226, 43.6, 68, 2.2, 1.1));
      P(root, 'ta-ink', rr(222, 42, 76, 8, 4));
    }

    // Tie-offs from the pole collars to the spreader bars at the net's ends.
    const ties = line([[52, 183], NET.backLeft]) + line([[50, 185], NET.frontLeft])
      + line([[468, 183], NET.backRight]) + line([[470, 185], NET.frontRight]);
    P(root, 'ta-safetynet-rope-ink', ties);
    P(root, 'ta-safetynet-rope', ties);

    for (const caught of [false, true]) {
      const net = G(root, caught ? 'ta-safetynet-net-caught' : 'ta-safetynet-net-taut');
      const edges = netEdge(0, caught) + netEdge(1, caught);
      P(net, 'ta-safetynet-mesh', netMesh(caught));
      P(net, 'ta-safetynet-rope-ink', edges);
      P(net, 'ta-safetynet-rope', edges);
    }
    const bars = line([NET.backLeft, NET.frontLeft]) + line([NET.backRight, NET.frontRight]);
    P(root, 'ta-safetynet-bar-ink', bars);
    P(root, 'ta-safetynet-bar', bars);

    P(root, 'ta-ink', rr(2, 2, 516, 256, 14));
    return root;
  };

  /* ------------------------------------------------------------------ */
  /* Panel: balance scale                                                */
  /* ------------------------------------------------------------------ */

  const SCALE = { pivot: [300, 34], arm: 170, rim: 190 };

  /** One pan hanging from the beam's end at x = cx: hook, two chains, and the dish. */
  function scalePan(root, name, cx) {
    const pan = G(root, name);
    const top = SCALE.pivot[1];
    const rim = SCALE.rim;
    const chains = line([[cx - 2, top + 13], [cx - 93, rim - 1]]) + line([[cx + 2, top + 13], [cx + 93, rim - 1]]);
    P(pan, 'ta-scale-chain-ink', chains);
    P(pan, 'ta-scale-chain', chains);
    P(pan, 'ta-scale-brass-shade', shape.circle(cx, top + 9, 5.5));
    P(pan, 'ta-ink-fine', shape.circle(cx, top + 9, 5.5) + shape.circle(cx, top + 9, 2.2));
    const bowl = `M${cx - 100} ${rim}A100 8 0 0 0 ${cx + 100} ${rim}Q${cx + 90} ${rim + 25} ${cx} ${rim + 27}Q${cx - 90} ${rim + 25} ${cx - 100} ${rim}Z`;
    P(pan, 'ta-scale-brass', bowl);
    P(pan, 'ta-scale-brass-shade', `M${cx + 100} ${rim}Q${cx + 90} ${rim + 25} ${cx} ${rim + 27}Q${cx + 62} ${rim + 21} ${cx + 78} ${rim + 7.4}Z`);
    P(pan, 'ta-scale-brass-light', `M${cx - 92} ${rim + 6}Q${cx - 78} ${rim + 20} ${cx - 30} ${rim + 23}Q${cx - 70} ${rim + 16} ${cx - 80} ${rim + 6.9}Z`);
    P(pan, 'ta-scale-brass-light', ell(cx, rim, 100, 8));
    P(pan, 'ta-scale-brass-shade', `M${cx - 98} ${rim}A98 7 0 0 1 ${cx + 98} ${rim}A98 3.6 0 0 0 ${cx - 98} ${rim}Z`);
    P(pan, 'ta-ink', bowl + ell(cx, rim, 100, 8));
    return pan;
  }

  /**
   * Brass balance scale that weighs TDD's gains against its costs. viewBox 0 0 600 260.
   * Parts: .ta-scale-beam (pivot 300,34), .ta-scale-pan-left, .ta-scale-pan-right. States: is-level (default), is-left, is-right.
   */
  art.scale = function scale(parent) {
    const root = rootOf(parent, 'scale', 600, 260);
    const [px, py] = SCALE.pivot;

    P(root, 'ta-shadow', ell(305, 250, 82, 7) + ell(134, 252, 78, 4) + ell(474, 252, 78, 4));

    // Weighted base: a wooden plinth under a stepped brass foot.
    const plinth = rr(236, 234, 128, 15, 4);
    const foot = 'M248 234Q250 221 272 219H328Q350 221 352 234Z';
    const step = 'M268 219Q270 210 286 209H314Q330 210 332 219Z';
    P(root, 'ta-scale-wood', plinth);
    P(root, 'ta-scale-wood-light', rr(239, 235.5, 96, 3.4, 1.7));
    P(root, 'ta-scale-wood-shade', rr(236, 243, 128, 6, [0, 0, 4, 4]) + shape.box(346, 234.5, 16, 9));
    P(root, 'ta-scale-brass', foot + step);
    P(root, 'ta-scale-brass-light', 'M255 232Q258 223.5 274 222.5H296Q272 224 268 232Z M274 217Q276 212 287 211.5H297Q285 213 283 217Z');
    P(root, 'ta-scale-brass-shade', 'M352 234Q350 221 328 219H318Q334 222 336 234Z M332 219Q330 210 314 209H307Q319 211 320 219Z');
    P(root, 'ta-ink', plinth + foot + step);

    // Pillar: a turned baluster with a yoke plate behind the beam and a finial.
    const pillar = [[209, 12], [203, 9.5], [198, 16], [193, 16], [189, 8.5], [176, 14], [160, 14], [146, 7.5], [136, 12.5], [131, 12.5], [126, 7], [70, 6], [62, 10.5], [56, 10.5]];
    P(root, 'ta-scale-brass-shade', rr(px - 11, 19, 22, 42, 8));
    P(root, 'ta-ink', rr(px - 11, 19, 22, 42, 8));
    P(root, 'ta-scale-brass', lathe(px, pillar) + shape.circle(px, 12, 5.5));
    P(root, 'ta-scale-brass-light', lathe(px, pillar, -0.72, -0.3) + shape.circle(px - 1.6, 10.6, 1.8));
    P(root, 'ta-scale-brass-shade', lathe(px, pillar, 0.38, 1));
    P(root, 'ta-ink', lathe(px, pillar) + shape.circle(px, 12, 5.5));
    P(root, 'ta-ink-fine', line([[px - 11, 195.5], [px + 11, 195.5]]) + line([[px - 9, 133.5], [px + 9, 133.5]]) + line([[px - 8, 59], [px + 8, 59]]));

    // Index plate on the pillar: the pointer shows which way the beam leans.
    const arc = (radius, a0, a1) => {
      const p = (a) => [px + radius * Math.sin(a), py + radius * Math.cos(a)];
      return { from: p(a0), to: p(a1) };
    };
    const spread = 0.42;
    const outer = arc(70, -spread, spread);
    const inner = arc(54, -spread, spread);
    const plate = `M${at(outer.from)}A70 70 0 0 0 ${at(outer.to)}L${at(inner.to)}A54 54 0 0 1 ${at(inner.from)}Z`;
    let ticks = '';
    for (let i = -2; i <= 2; i += 1) {
      const a = i * 0.16;
      ticks += line([[px + (i === 0 ? 57 : 61) * Math.sin(a), py + (i === 0 ? 57 : 61) * Math.cos(a)], [px + 67 * Math.sin(a), py + 67 * Math.cos(a)]]);
    }
    P(root, 'ta-scale-plate', plate);
    P(root, 'ta-ink-fine', plate + ticks);

    // Beam with its pointer.
    const beam = G(root, 'ta-scale-beam');
    const left = px - SCALE.arm;
    const right = px + SCALE.arm;
    const body = `M${left} ${py - 4.5}H${right}a4.5 4.5 0 0 1 0 9Q${px + 85} ${py + 8} ${px} ${py + 13}Q${px - 85} ${py + 8} ${left} ${py + 4.5}a4.5 4.5 0 0 1 0 -9Z`;
    const pointer = poly([[px - 3.2, py + 8], [px + 3.2, py + 8], [px, py + 64]]);
    P(beam, 'ta-scale-pointer', pointer);
    P(beam, 'ta-ink-fine', pointer);
    P(beam, 'ta-scale-brass', body);
    P(beam, 'ta-scale-brass-light', rr(left + 2, py - 3.2, SCALE.arm * 2 - 4, 2.4, 1.2));
    P(beam, 'ta-scale-brass-shade', `M${left + 2} ${py + 2.6}Q${px - 85} ${py + 6} ${px} ${py + 11}Q${px + 85} ${py + 6} ${right - 2} ${py + 2.6}L${right} ${py + 4.5}Q${px + 85} ${py + 8} ${px} ${py + 13}Q${px - 85} ${py + 8} ${left} ${py + 4.5}Z`);
    P(beam, 'ta-ink', body);
    P(beam, 'ta-scale-brass-light', shape.circle(px, py + 1, 10));
    P(beam, 'ta-scale-brass-shade', `M${px + 7.07} ${py - 6.07}A10 10 0 0 1 ${px - 7.07} ${py + 8.07}A13 13 0 0 0 ${px + 7.07} ${py - 6.07}Z`);
    P(beam, 'ta-scale-pointer', shape.circle(px, py + 1, 3.4));
    P(beam, 'ta-ink', shape.circle(px, py + 1, 10));
    P(beam, 'ta-ink-fine', shape.circle(px, py + 1, 3.4));

    scalePan(root, 'ta-scale-pan-left', left);
    scalePan(root, 'ta-scale-pan-right', right);
    return root;
  };

  /* ------------------------------------------------------------------ */
  /* Panel: moonshot                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Framed night sky: four ever-taller towers stay far below the moon while a rocket waits on its pad
   * ("you can't reach the moon by building taller towers"). viewBox 0 0 300 200. No parts, no states.
   */
  art.moonshot = function moonshot(parent) {
    const root = rootOf(parent, 'moonshot', 300, 200);
    const ground = 172;
    P(root, 'ta-moonshot-sky', rr(2, 2, 296, 196, 14));
    P(root, 'ta-moonshot-sky-mid', 'M2 118Q60 104 128 116T298 106V180H2Z');
    P(root, 'ta-moonshot-sky-low', 'M2 150Q90 136 170 148T298 140V180H2Z');

    // Stars.
    const stars = [[30, 24, 4.5], [84, 42, 3.2], [140, 20, 5], [168, 62, 3], [58, 78, 2.6], [276, 96, 3.4], [112, 66, 2.4], [272, 22, 2.6]];
    const dots = [[52, 46], [104, 22], [128, 48], [20, 62], [178, 30], [160, 96], [196, 110], [282, 64], [70, 16], [186, 84], [262, 124], [36, 100]];
    P(root, 'ta-moonshot-star', stars.map(([x, y, s]) => sparkle(x, y, s)).join('') + dots.map(([x, y]) => shape.circle(x, y, 1)).join(''));

    // Moon, lit from the top left.
    const moon = [240, 44, 30];
    const k = moon[2] * Math.SQRT1_2;
    P(root, 'ta-moonshot-moon', shape.circle(...moon));
    P(root, 'ta-moonshot-moon-shade', `M${r2(moon[0] + k)} ${r2(moon[1] - k)}A30 30 0 0 1 ${r2(moon[0] - k)} ${r2(moon[1] + k)}A39 39 0 0 0 ${r2(moon[0] + k)} ${r2(moon[1] - k)}Z`);
    P(root, 'ta-moonshot-crater', shape.circle(228, 34, 6) + shape.circle(248, 48, 4.4) + shape.circle(232, 56, 3) + shape.circle(248, 27, 2.6) + shape.circle(221, 48, 2));
    P(root, 'ta-ink', shape.circle(...moon));

    // Ground.
    P(root, 'ta-moonshot-ground', `M2 ${ground}H298V184a14 14 0 0 1 -14 14H16a14 14 0 0 1 -14 -14Z`);
    P(root, 'ta-moonshot-ground-light', shape.box(2, ground, 296, 3));

    // Four towers, each taller than the last.
    const towers = [
      { x: 14, w: 30, h: 34, paint: 'teal', lit: [1, 2] },
      { x: 48, w: 31, h: 52, paint: 'orange', lit: [0, 3, 4] },
      { x: 83, w: 32, h: 70, paint: 'violet', lit: [1, 4, 7, 8] },
      { x: 119, w: 34, h: 90, paint: 'pale', lit: [0, 3, 5, 8, 10, 13] },
    ];
    let litWindows = '';
    let darkWindows = '';
    let towerInk = '';
    for (const tower of towers) {
      const top = ground - tower.h;
      const face = tower.w - 7;
      P(root, `ta-moonshot-${tower.paint}`, shape.box(tower.x, top, face, tower.h));
      P(root, `ta-moonshot-${tower.paint}-shade`, poly([[tower.x + face, top], [tower.x + tower.w, top + 4], [tower.x + tower.w, ground], [tower.x + face, ground]]));
      towerInk += poly([[tower.x, top], [tower.x + face, top], [tower.x + tower.w, top + 4], [tower.x + tower.w, ground], [tower.x, ground]]) + line([[tower.x + face, top], [tower.x + face, ground]]);
      const rows = Math.floor((tower.h - 8) / 11);
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          const pane = shape.box(tower.x + 3.5 + col * (face / 2 - 0.6), top + 6 + row * 11, face / 2 - 6, 6);
          if (tower.lit.includes(row * 2 + col)) litWindows += pane; else darkWindows += pane;
        }
      }
    }
    P(root, 'ta-moonshot-window-dark', darkWindows);
    P(root, 'ta-moonshot-window', litWindows);
    P(root, 'ta-ink-fine', towerInk);
    // A crane on the tallest tower: still building upward.
    P(root, 'ta-moonshot-crane', 'M131 82V60M122 64H160M131 60L144 64M131 60L125 64M154 64V74M152 74h4v3.4h-4Z');

    // Rocket on its pad with a small gantry, and a dotted course to the moon.
    const cx = 242;
    const pad = rr(cx - 36, ground - 4, 72, 8, 2);
    const nozzle = poly([[cx - 6, 162], [cx + 6, 162], [cx + 8, 168], [cx - 8, 168]]);
    const body = `M${cx} 102C${cx + 10} 114 ${cx + 11} 130 ${cx + 10} 162H${cx - 10}C${cx - 11} 130 ${cx - 10} 114 ${cx} 102Z`;
    const fins = `M${cx - 10} 140L${cx - 21} 166H${cx - 10}Z M${cx + 10} 140L${cx + 21} 166H${cx + 10}Z`;
    P(root, 'ta-moonshot-course', line([[cx, 97], [cx - 0.5, 78]]));
    P(root, 'ta-moonshot-cast', ell(cx + 2, ground + 9, 38, 4));
    P(root, 'ta-moonshot-gantry', `M${cx - 30} ${ground - 4}V116M${cx - 22} ${ground - 4}V116M${cx - 30} 116H${cx - 22}L${cx - 30} 129L${cx - 22} 142L${cx - 30} 155L${cx - 22} ${ground - 4}M${cx - 22} 132H${cx - 10}`);
    P(root, 'ta-moonshot-pad', pad);
    P(root, 'ta-moonshot-pad-light', shape.box(cx - 34, ground - 3, 68, 2));
    P(root, 'ta-moonshot-fin', fins);
    P(root, 'ta-moonshot-fin-shade', `M${cx + 10} 140L${cx + 21} 166H${cx + 10}Z`);
    P(root, 'ta-moonshot-nozzle', nozzle);
    P(root, 'ta-moonshot-hull', body);
    P(root, 'ta-moonshot-hull-shade', `M${cx} 102C${cx + 10} 114 ${cx + 11} 130 ${cx + 10} 162H${cx + 3}C${cx + 4.4} 134 ${cx + 4} 116 ${cx} 102Z`);
    P(root, 'ta-moonshot-fin', `M${cx} 102C${cx + 5.6} 108.6 ${cx + 8.2} 114.6 ${cx + 9.6} 121H${cx - 9.6}C${cx - 8.2} 114.6 ${cx - 5.6} 108.6 ${cx} 102Z`);
    P(root, 'ta-moonshot-fin-shade', `M${cx} 102C${cx + 5.6} 108.6 ${cx + 8.2} 114.6 ${cx + 9.6} 121H${cx + 3.6}C${cx + 3.4} 113 ${cx + 2.2} 107 ${cx} 102Z`);
    P(root, 'ta-moonshot-port', shape.circle(cx, 134, 4.4));
    P(root, 'ta-ink-fine', `${body}${fins}${shape.circle(cx, 134, 4.4)}M${cx - 9.6} 121H${cx + 9.6}${nozzle}${pad}`);

    P(root, 'ta-ink', rr(2, 2, 296, 196, 14));
    return root;
  };
  /* ------------------------------------------------------------------ */
  /* Spots                                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Wooden-framed hourglass with gold sand: time spent up front. viewBox 0 0 80 120.
   * State is-run: the sand has run into the bottom bulb (default: mostly in the top bulb).
   */
  art.hourglass = function hourglass(parent) {
    const root = rootOf(parent, 'hourglass', 80, 120);
    const cx = 40;
    const post = [[18, 3], [25, 3.9], [32, 2.3], [58, 3.7], [84, 2.3], [91, 3.9], [98, 3]];
    const glass = [[19, 16], [25, 18.6], [38, 16.6], [51, 6], [58, 2.6], [65, 6], [78, 16.6], [91, 18.6], [97, 16]];
    const plates = rr(7, 7, 66, 11, 3.5) + rr(7, 98, 66, 11, 3.5);
    P(root, 'ta-shadow', ell(43, 110.5, 34, 5));
    P(root, 'ta-hourglass-wood-shade', lathe(cx, post));
    P(root, 'ta-hourglass-glass', lathe(cx, glass));

    const start = G(root, 'ta-hourglass-sand-start');
    const full = [[31, 16.4], [38, 14.8], [51, 4.4], [57, 1.5]];
    P(start, 'ta-hourglass-sand', lathe(cx, full) + shape.box(39.3, 57, 1.4, 38) + 'M31 96Q40 84 49 96Z');
    P(start, 'ta-hourglass-sand-shade', lathe(cx, full, 0.35, 1) + 'M40 90Q46 92 49 96H44Q43 92 40 90Z');
    P(start, 'ta-hourglass-sand-light', 'M24.4 31H55.6Q40 35.5 24.4 31Z');

    const run = G(root, 'ta-hourglass-sand-run');
    const rest = [[47, 7], [51, 4.4], [57, 1.5]];
    const heap = 'M40 68Q50 77 55.6 89Q57.4 96 54 96H26Q22.6 96 24.4 89Q30 77 40 68Z';
    P(run, 'ta-hourglass-sand', lathe(cx, rest) + shape.box(39.3, 57, 1.4, 14) + heap);
    P(run, 'ta-hourglass-sand-shade', 'M40 68Q50 77 55.6 89Q57.4 96 54 96H46Q51 84 40 68Z');
    P(run, 'ta-hourglass-sand-light', 'M40 68Q32 76 27.6 85Q34 78 40 73Z');

    P(root, 'ta-hourglass-shine', 'M27.6 27Q25.6 34 29.6 41M27.4 76Q25 83 27.4 90');
    P(root, 'ta-ink-fine', lathe(cx, glass));
    P(root, 'ta-hourglass-wood', lathe(15, post) + lathe(65, post));
    P(root, 'ta-hourglass-wood-light', lathe(15, post, -0.7, -0.15) + lathe(65, post, -0.7, -0.15));
    P(root, 'ta-hourglass-wood-shade', lathe(15, post, 0.4, 1) + lathe(65, post, 0.4, 1));
    P(root, 'ta-ink-fine', lathe(15, post) + lathe(65, post));
    P(root, 'ta-hourglass-wood', plates);
    P(root, 'ta-hourglass-wood-light', rr(10, 8.6, 54, 2.6, 1.3) + rr(10, 99.6, 54, 2.6, 1.3));
    P(root, 'ta-hourglass-wood-shade', rr(7, 13.5, 66, 4.5, [0, 0, 3.5, 3.5]) + rr(7, 104.5, 66, 4.5, [0, 0, 3.5, 3.5]));
    P(root, 'ta-ink', plates);
    return root;
  };

  /**
   * Wooden pyramid metronome: short, steady cycles. viewBox 0 0 110 160.
   * Part .ta-metronome-arm (rod and sliding weight) rotates about its pivot at 54,118; upright by default.
   */
  art.metronome = function metronome(parent) {
    const root = rootOf(parent, 'metronome', 110, 160);
    const front = poly([[41, 20], [67, 20], [90, 142], [18, 142]]);
    const side = poly([[67, 20], [73.5, 24], [100, 140], [90, 142]]);
    const cap = rr(37, 13, 34, 8, 2.5);
    const plinth = rr(10, 140, 92, 13, 3.5);
    const panel = poly([[47, 30], [61, 30], [72.5, 108], [35.5, 108]]);
    let ticks = '';
    for (let i = 0; i < 9; i += 1) {
      const y = 36 + i * 8.4;
      const half = lerp(7, 18.5, (y - 30) / 78);
      const length = i % 2 ? 3 : 5;
      ticks += line([[54 - half + 1.2, y], [54 - half + 1.2 + length, y]]) + line([[54 + half - 1.2, y], [54 + half - 1.2 - length, y]]);
    }
    P(root, 'ta-shadow', ell(60, 152.5, 48, 5.5));
    P(root, 'ta-metronome-wood', front);
    P(root, 'ta-metronome-wood-light', poly([[41, 20], [46, 20], [26, 142], [18, 142]]));
    P(root, 'ta-metronome-wood-shade', side + cap + plinth);
    P(root, 'ta-metronome-wood', rr(12, 141.4, 80, 3.4, 1.7) + rr(39, 14.2, 26, 2.6, 1.3));
    P(root, 'ta-metronome-grain', 'M27 131Q31 114 33.5 99M81.5 132Q79.5 118 77 105M30.5 136Q32 128 33 123');
    P(root, 'ta-metronome-panel', panel);
    P(root, 'ta-metronome-panel-shade', poly([[47, 30], [61, 30], [61.6, 34], [46.4, 34]]));
    P(root, 'ta-ink-fine', panel + ticks + line([[67, 20], [89.5, 139]]));
    P(root, 'ta-ink', line([[18, 140], [41, 20], [67, 20], [73.5, 24], [100, 140]]) + cap + plinth);

    const arm = G(root, 'ta-metronome-arm');
    const rod = rr(52.5, 7, 3, 113, 1.5);
    const weight = poly([[47.5, 38], [60.5, 38], [63.5, 55], [44.5, 55]]);
    P(arm, 'ta-metronome-metal', rod);
    P(arm, 'ta-ink-fine', rod);
    P(arm, 'ta-metronome-brass', weight);
    P(arm, 'ta-metronome-brass-light', poly([[47.5, 38], [51.5, 38], [49.5, 55], [44.5, 55]]));
    P(arm, 'ta-metronome-brass-shade', poly([[57.5, 38], [60.5, 38], [63.5, 55], [59.5, 55]]));
    P(arm, 'ta-ink-fine', weight + line([[46.6, 43.5], [61.4, 43.5]]));

    P(root, 'ta-metronome-brass', shape.circle(54, 118, 5.2) + rr(40, 124, 28, 9, 2));
    P(root, 'ta-metronome-brass-light', rr(42, 125.4, 20, 2.2, 1.1) + shape.circle(52.6, 116.6, 1.6));
    P(root, 'ta-ink-fine', shape.circle(54, 118, 5.2) + rr(40, 124, 28, 9, 2));
    return root;
  };

  /** Faces of one toy brick n studs wide whose front face has its top-left corner at x,y. */
  function brick(x, y, n) {
    const w = 22 * n;
    const studs = [];
    let studSides = '';
    let studTops = '';
    for (let i = 0; i < n; i += 1) {
      const sx = x + 22 * i + 16;
      const sy = y - 4;
      studSides += `M${sx - 6.5} ${sy - 4}V${sy}A6.5 2.6 0 0 0 ${sx + 6.5} ${sy}V${sy - 4}Z`;
      studTops += ell(sx, sy - 4, 6.5, 2.6);
      studs.push(`M${sx - 6.5} ${sy - 4}V${sy}A6.5 2.6 0 0 0 ${sx + 6.5} ${sy}V${sy - 4}${ell(sx, sy - 4, 6.5, 2.6)}`);
    }
    return {
      top: poly([[x, y], [x + 10, y - 8], [x + w + 10, y - 8], [x + w, y]]),
      front: shape.box(x, y, w, 20),
      side: poly([[x + w, y], [x + w + 10, y - 8], [x + w + 10, y + 12], [x + w, y + 20]]),
      outline: poly([[x, y], [x + 10, y - 8], [x + w + 10, y - 8], [x + w + 10, y + 12], [x + w, y + 20], [x, y + 20]]),
      edges: `M${x} ${y}H${x + w}V${y + 20}M${x + w} ${y}L${x + w + 10} ${y - 8}`,
      studSides,
      studTops,
      studs,
    };
  }

  /**
   * Stack of interlocking toy bricks with one brick lifted off on its own: small, testable units.
   * viewBox 0 0 180 130. No parts, no states.
   */
  art.bricks = function bricks(parent) {
    const root = rootOf(parent, 'bricks', 180, 130);
    const rows = [
      [{ x: 24, y: 98, n: 3, paint: 'violet', seen: [] }, { x: 90, y: 98, n: 3, paint: 'teal', seen: [] }],
      [{ x: 24, y: 78, n: 2, paint: 'gold', seen: [] }, { x: 68, y: 78, n: 4, paint: 'orange', seen: [1, 2, 3] }],
      [{ x: 24, y: 58, n: 3, paint: 'teal', seen: [0, 1, 2] }],
      [{ x: 94, y: 22, n: 3, paint: 'violet', seen: [0, 1, 2] }],
    ];
    let fine = '';
    P(root, 'ta-shadow', ell(98, 121, 82, 6));
    for (const row of rows) {
      for (const item of row) {
        const faces = brick(item.x, item.y, item.n);
        P(root, `ta-bricks-${item.paint}-light`, faces.top + faces.studTops);
        P(root, `ta-bricks-${item.paint}`, faces.front + faces.studSides);
        P(root, `ta-bricks-${item.paint}-shade`, faces.side);
        P(root, 'ta-ink', faces.outline + faces.edges);
        fine += item.seen.map((i) => faces.studs[i]).join('');
      }
    }
    // Two short lift marks under the brick that came off.
    fine += 'M112 50v7M146 50v7';
    P(root, 'ta-ink-fine', fine);
    return root;
  };

  /** Points moved from a local frame (x along the direction) to origin, turned by angle. */
  function place(points, origin, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return points.map(([x, y]) => [origin[0] + x * cos - y * sin, origin[1] + x * sin + y * cos]);
  }

  /**
   * One big tangled ball of cables with loose plug ends: a lump you cannot test on its own.
   * viewBox 0 0 160 130. No parts, no states.
   */
  art.tangle = function tangle(parent) {
    const root = rootOf(parent, 'tangle', 160, 130);
    const center = [80, 62];
    const cables = [
      { paint: 'gold', turns: 2.7, q: 3.4, q2: 5.3, phase: 0.4, radius: 43, ends: [[13, 36], [149, 101]] },
      { paint: 'teal', turns: 3.1, q: 2.6, q2: 6.1, phase: 2.2, radius: 42, ends: [[146, 21], [20, 104]] },
      { paint: 'violet', turns: 2, q: 4, q2: 7, phase: 1.3, radius: 42, ends: null },
      { paint: 'orange', turns: 2.3, q: 2.3, q2: 5.9, phase: 4.1, radius: 43, ends: [[56, 11], [126, 113]] },
    ];
    let plugs = '';
    let prongs = '';
    P(root, 'ta-shadow', ell(83, 114, 56, 7));
    P(root, 'ta-tangle-core', shape.circle(center[0], center[1], 35));
    for (const cable of cables) {
      const points = [];
      const total = cable.turns * 2 * Math.PI;
      const count = Math.round(cable.turns * 70);
      for (let i = 0; i <= count; i += 1) {
        const t = (i / count) * total;
        const r = cable.radius * (0.56 + 0.3 * Math.cos(cable.q * t + cable.phase) + 0.14 * Math.cos(cable.q2 * t + 1));
        points.push([center[0] + r * Math.cos(t + cable.phase), center[1] + r * 0.94 * Math.sin(t + cable.phase)]);
      }
      let d = line(points);
      if (cable.ends) {
        [points[0], points[points.length - 1]].forEach((from, index) => {
          const end = cable.ends[index];
          const mid = [(from[0] + end[0]) / 2 + (end[1] - from[1]) * 0.22, (from[1] + end[1]) / 2 - (end[0] - from[0]) * 0.22];
          d += `M${at(from)}Q${at(mid)} ${at(end)}`;
          const angle = Math.atan2(end[1] - mid[1], end[0] - mid[0]);
          plugs += poly(place([[-2, -4.6], [7, -4.6], [9, -2.6], [9, 2.6], [7, 4.6], [-2, 4.6]], end, angle));
          prongs += poly(place([[9, -3], [14, -3], [14, -1.2], [9, -1.2]], end, angle)) + poly(place([[9, 1.2], [14, 1.2], [14, 3], [9, 3]], end, angle));
        });
      } else {
        d += 'Z';
      }
      P(root, 'ta-tangle-cable-ink', d);
      P(root, `ta-tangle-${cable.paint}`, d);
    }
    P(root, 'ta-tangle-metal', prongs);
    P(root, 'ta-tangle-plug', plugs);
    P(root, 'ta-ink-fine', plugs + prongs);
    return root;
  };

  /** Scalloped seal outline. */
  function sealShape(cx, cy, radius, count, bump) {
    let d = '';
    for (let i = 0; i < count; i += 1) {
      const a0 = (i / count) * 2 * Math.PI;
      const a1 = ((i + 1) / count) * 2 * Math.PI;
      const am = (a0 + a1) / 2;
      if (!i) d += `M${at([cx + radius * Math.cos(a0), cy + radius * Math.sin(a0)])}`;
      d += `Q${at([cx + (radius + bump) * Math.cos(am), cy + (radius + bump) * Math.sin(am)])} ${at([cx + radius * Math.cos(a1), cy + radius * Math.sin(a1)])}`;
    }
    return `${d}Z`;
  }

  /**
   * Open spiral-bound manual with a code block, a play button, and a green check seal: executable documentation.
   * viewBox 0 0 170 130. No parts, no states.
   */
  art.manual = function manual(parent) {
    const root = rootOf(parent, 'manual', 170, 130);
    const cover = rr(7, 11, 156, 106, 7);
    const pages = rr(12, 15, 71, 95, [4, 1, 1, 4]) + rr(87, 15, 71, 95, [1, 4, 4, 1]);
    const bar = (x, y, w, h = 3.6) => rr(x, y, w, h, h / 2);
    let rings = '';
    for (let i = 0; i < 8; i += 1) rings += rr(78.5, 21 + i * 11.2, 13, 4.6, 2.3);
    const seal = sealShape(140, 94, 10.5, 12, 3.2);
    const play = shape.circle(112, 66, 14);
    P(root, 'ta-shadow', rr(12, 18, 156, 106, 7));
    P(root, 'ta-manual-cover', cover);
    P(root, 'ta-manual-cover-shade', rr(7, 108, 156, 9, [0, 0, 7, 7]));
    P(root, 'ta-manual-paper-shade', rr(12, 18, 146, 96, 4));
    P(root, 'ta-manual-paper', pages);
    P(root, 'ta-manual-paper-shade', shape.box(77, 15, 6, 95) + shape.box(87, 15, 5, 95));
    P(root, 'ta-manual-bar', bar(19, 34, 52) + bar(19, 41.5, 46) + bar(19, 49, 50) + bar(19, 97, 38) + bar(97, 34, 52) + bar(97, 41.5, 42) + bar(97, 88, 26) + bar(97, 95.5, 20) + bar(132, 60, 20) + bar(132, 67.5, 14));
    P(root, 'ta-manual-head', bar(19, 23, 30, 5.4) + bar(97, 23, 26, 5.4));
    P(root, 'ta-manual-code', rr(19, 58, 54, 33, 4));
    P(root, 'ta-manual-code-teal', bar(24, 63.5, 22) + bar(24, 83.5, 12));
    P(root, 'ta-manual-code-gold', bar(30, 70.2, 30) + bar(48, 63.5, 14));
    P(root, 'ta-manual-code-violet', bar(30, 76.8, 18) + bar(50, 76.8, 16));
    P(root, 'ta-manual-play', play);
    P(root, 'ta-manual-white', 'M107.6 58.6L120.6 66L107.6 73.4Z');
    P(root, 'ta-manual-seal', seal);
    P(root, 'ta-manual-check', 'M134.6 94.4L138.6 98.4L145.8 89.8');
    P(root, 'ta-ink-fine', pages + play + seal + rr(19, 58, 54, 33, 4));
    P(root, 'ta-manual-ring', rings);
    P(root, 'ta-ink-fine', rings);
    P(root, 'ta-ink', cover);
    return root;
  };

  /**
   * Yellowed, curling paper note with a cobweb in one corner and dust specks: stale tests document the past.
   * viewBox 0 0 130 110. No parts, no states.
   */
  art.staleNote = function staleNote(parent) {
    const root = rootOf(parent, 'stalenote', 130, 110);
    const paper = 'M24 22Q62 15 108 20Q112 50 109 74Q102 86 94 96Q58 101 22 95Q17 58 24 22Z';
    const curl = 'M109 74Q99 76 90 79Q94 87 94 96Q104 88 109 74Z';
    const bar = (x, y, w) => rr(x, y, w, 3.6, 1.8);
    P(root, 'ta-shadow', 'M29 28Q67 21 113 26Q117 56 114 80Q107 92 99 102Q63 107 27 101Q22 64 29 28Z');
    P(root, 'ta-stalenote-paper', paper);
    P(root, 'ta-stalenote-age', 'M24 22Q62 15 108 20Q109 27 109.6 33Q66 22 23 34Q23 28 24 22Z M22 95Q20.6 88 20 80Q30 90 46 97.6Q34 97 22 95Z' + ell(84, 88, 9, 3.4));
    P(root, 'ta-stalenote-line', bar(32, 38, 60) + bar(32, 47, 50) + bar(32, 56, 64) + bar(32, 65, 42) + bar(32, 74, 52) + bar(32, 83, 30));
    P(root, 'ta-stalenote-stain', `${shape.circle(82, 50, 10.5)}M34 60Q66 57 110 61`);
    P(root, 'ta-stalenote-under', curl);
    P(root, 'ta-ink', paper);
    P(root, 'ta-ink-fine', curl);

    // Cobweb across the top left corner.
    const apex = [15, 12];
    const spokes = [[8, 55], [27, 50], [46, 48], [65, 49], [84, 52]].map(([deg, length]) => {
      const a = (deg * Math.PI) / 180;
      return [Math.cos(a) * length, Math.sin(a) * length];
    });
    let web = spokes.map(([x, y]) => line([apex, [apex[0] + x, apex[1] + y]])).join('');
    for (const part of [0.34, 0.58, 0.82, 1]) {
      for (let i = 0; i < spokes.length - 1; i += 1) {
        const from = [apex[0] + spokes[i][0] * part, apex[1] + spokes[i][1] * part];
        const to = [apex[0] + spokes[i + 1][0] * part, apex[1] + spokes[i + 1][1] * part];
        const pull = [lerp(apex[0], (from[0] + to[0]) / 2, 0.8), lerp(apex[1], (from[1] + to[1]) / 2, 0.8)];
        web += `M${at(from)}Q${at(pull)} ${at(to)}`;
      }
    }
    P(root, 'ta-stalenote-web', web);
    P(root, 'ta-stalenote-dust', [[118, 34, 1.5], [121, 86, 1.2], [12, 74, 1.4], [62, 105, 1.3], [104, 103, 1.6], [117, 60, 1], [8, 92, 1], [76, 9, 1.2], [44, 106, 0.9]].map(([x, y, r]) => shape.circle(x, y, r)).join(''));
    return root;
  };

  /**
   * Mountain with a dashed switchback trail up to a summit flag: a learning curve.
   * viewBox 0 0 260 160. A small framed vignette (sky, sun, pines). No parts, no states.
   */
  art.mountain = function mountain(parent) {
    const root = rootOf(parent, 'mountain', 260, 160);
    const frame = rr(4, 4, 252, 152, 22);
    const massif = poly([[20, 134], [70, 92], [84, 101], [150, 30], [197, 86], [209, 78], [246, 134]]);
    const pine = (x, y, s) => poly([[x, y - 26 * s], [x + 6 * s, y - 16 * s], [x + 3 * s, y - 16 * s], [x + 8 * s, y - 7 * s], [x + 4 * s, y - 7 * s], [x + 10 * s, y + 2 * s], [x - 10 * s, y + 2 * s], [x - 4 * s, y - 7 * s], [x - 8 * s, y - 7 * s], [x - 3 * s, y - 16 * s], [x - 6 * s, y - 16 * s]]);
    const pineLight = (x, y, s) => poly([[x, y - 26 * s], [x - 6 * s, y - 16 * s], [x - 3 * s, y - 16 * s], [x - 8 * s, y - 7 * s], [x - 4 * s, y - 7 * s], [x - 10 * s, y + 2 * s], [x - 3 * s, y + 2 * s], [x, y - 8 * s]]);
    const pines = [[26, 134, 1], [44, 138, 0.8], [226, 136, 1.05], [206, 139, 0.75], [240, 140, 0.7]];
    P(root, 'ta-mountain-sky', frame);
    P(root, 'ta-mountain-sun', shape.circle(46, 40, 14));
    P(root, 'ta-mountain-cloud', 'M190 44a9 9 0 0 1 17 -4a11 11 0 0 1 20 5a7 7 0 0 1 -2 13H193a7.2 7.2 0 0 1 -3 -14Z M76 28a6 6 0 0 1 11 -2a7.5 7.5 0 0 1 13 4a4.6 4.6 0 0 1 -1 9H78a5 5 0 0 1 -2 -11Z');
    P(root, 'ta-mountain-rock', massif);
    P(root, 'ta-mountain-rock-shade', poly([[150, 30], [197, 86], [209, 78], [246, 134], [176, 134], [152, 98], [166, 64]]) + poly([[70, 92], [84, 101], [96, 134], [74, 134], [78, 110]]));
    P(root, 'ta-mountain-snow', poly([[150, 30], [172, 56], [164, 53], [158, 63], [150, 52], [141, 64], [135, 54], [126, 58]]));
    P(root, 'ta-mountain-snow-shade', poly([[150, 30], [172, 56], [164, 53], [158, 63], [156, 46]]));
    P(root, 'ta-ink', massif);
    P(root, 'ta-ink-fine', line([[150, 30], [156, 46], [166, 64], [152, 98], [176, 134]]) + line([[70, 92], [78, 110], [74, 134]]));
    P(root, 'ta-mountain-trail', curve([[52, 132], [100, 128], [132, 120], [96, 108], [88, 104], [128, 94], [140, 88], [118, 78], [112, 74], [138, 66], [148, 60], [140, 50], [150, 34]]));
    P(root, 'ta-mountain-grass', 'M4 134Q60 124 130 132T256 128V134a22 22 0 0 1 -22 22H26a22 22 0 0 1 -22 -22Z');
    P(root, 'ta-mountain-grass-light', 'M4 134Q60 124 130 132T256 128V139Q190 149 130 143T4 140Z');
    P(root, 'ta-mountain-trunk', pines.map(([x, y, s]) => shape.box(x - 1.6 * s, y + 2 * s, 3.2 * s, 5 * s)).join(''));
    P(root, 'ta-mountain-pine', pines.map(([x, y, s]) => pine(x, y, s)).join(''));
    P(root, 'ta-mountain-pine-light', pines.map(([x, y, s]) => pineLight(x, y, s)).join(''));
    P(root, 'ta-ink-fine', pines.map(([x, y, s]) => pine(x, y, s)).join('') + line([[150, 30], [150, 12]]));
    P(root, 'ta-mountain-flag', 'M150.6 12.6L165 17L150.6 22Z');
    P(root, 'ta-ink-fine', 'M150.6 12.6L165 17L150.6 22Z');
    P(root, 'ta-ink', frame);
    return root;
  };

  /**
   * Instant photo of a fluffy animal seen from behind (a cat or a fox?): no exact right answer, like recognizing images.
   * viewBox 0 0 140 150. The white strip under the picture (y 112..140) is empty. No parts, no states.
   */
  art.photo = function photo(parent) {
    const root = rootOf(parent, 'photo', 140, 150);
    const print = rr(12, 8, 116, 134, 4);
    const picture = shape.box(21, 17, 98, 92);
    const body = 'M51 106C45 84 55 66 70 64C85 66 95 84 89 106Z';
    const head = 'M54 56C52 47 56 42 60 39L57 25L67.4 35.6C69 35.2 71 35.2 72.6 35.6L83 25L80 39C84 42 88 47 86 56L91 61L84.6 61.6C80 67 60 67 55.4 61.6L49 61Z';
    const tail = 'M84 102C98 109 117 100 114 82C112.4 71 100.6 68 96.6 76C99.6 84 96 89 87 87Z';
    let blades = 'M21 109V101';
    for (let x = 21, i = 0; x < 119; x += 7, i += 1) blades += `L${x + 3.5} ${[92, 95, 90, 96][i % 4]}L${Math.min(x + 7, 119)} 101`;
    blades += 'V109Z';
    P(root, 'ta-shadow', rr(16, 13, 116, 134, 4));
    P(root, 'ta-photo-paper', print);
    P(root, 'ta-photo-sky', picture);
    P(root, 'ta-photo-cloud', 'M84 34a6 6 0 0 1 11 -3a7.4 7.4 0 0 1 13 3.6a4.6 4.6 0 0 1 -1.4 9H86a5 5 0 0 1 -2 -9.6Z M28 27a4 4 0 0 1 7.4 -2a5 5 0 0 1 8.6 2.6a3 3 0 0 1 -1 6H29.4a3.4 3.4 0 0 1 -1.4 -6.6Z');
    P(root, 'ta-photo-hill', 'M21 76Q44 60 70 70T119 62V109H21Z');
    P(root, 'ta-photo-meadow', 'M21 90Q60 80 119 88V109H21Z');
    P(root, 'ta-photo-fur', tail + body + head);
    P(root, 'ta-photo-fur-shade', 'M70 64C85 66 95 84 89 106H80C87 88 82 70 70 64Z M83 25L80 39C84 42 88 47 86 56L91 61L84.6 61.6C83 63.6 80.6 64.8 78 65.4C83 58 82 46 76.4 39.6Z');
    P(root, 'ta-photo-cream', 'M114 82C112.4 71 100.6 68 96.6 76C98.6 82.6 107 86 114 82Z');
    P(root, 'ta-photo-tip', poly([[57, 25], [62.6, 30.8], [58.2, 31.6]]) + poly([[83, 25], [77.4, 30.8], [81.8, 31.6]]));
    P(root, 'ta-ink-fine', `${tail}${body}${head}M64 77l3 4l3 -4M71 87l3 4l3 -4M60 91l2.6 3.6l2.6 -3.6M96.6 76C98.6 82.6 107 86 114 82`);
    P(root, 'ta-photo-flower', [[30, 86], [41, 92], [104, 88], [112, 95], [96, 96]].map(([x, y]) => shape.circle(x, y, 1.7)).join(''));
    P(root, 'ta-photo-grass', blades);
    P(root, 'ta-ink-fine', picture);
    P(root, 'ta-ink', print);
    return root;
  };

  /** Ring sector around cx,cy between two radii; angles in degrees from straight up, clockwise. */
  function sector(cx, cy, r0, r1, a0, a1) {
    const p = (r, a) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
    return `M${at(p(r1, a0))}A${r1} ${r1} 0 0 1 ${at(p(r1, a1))}L${at(p(r0, a1))}A${r0} ${r0} 0 0 0 ${at(p(r0, a0))}Z`;
  }

  /**
   * Speedometer dial with green, gold, and red arcs: qualities like response time. viewBox 0 0 120 90.
   * Part .ta-gauge-needle rotates about the hub at 60,64; it points straight up by default (-90deg = far left, +90deg = far right).
   */
  art.gauge = function gauge(parent) {
    const root = rootOf(parent, 'gauge', 120, 90);
    const hub = [60, 64];
    const bezel = 'M7 64A53 53 0 0 1 113 64V75a6 6 0 0 1 -6 6H13a6 6 0 0 1 -6 -6Z';
    const face = 'M15 64A45 45 0 0 1 105 64V70a3.4 3.4 0 0 1 -3.4 3.4H18.4a3.4 3.4 0 0 1 -3.4 -3.4Z';
    let ticks = '';
    for (let a = -90; a <= 90; a += 30) {
      const rad = (a * Math.PI) / 180;
      ticks += line([[hub[0] + 25 * Math.sin(rad), hub[1] - 25 * Math.cos(rad)], [hub[0] + 30 * Math.sin(rad), hub[1] - 30 * Math.cos(rad)]]);
    }
    P(root, 'ta-shadow', ell(63, 82, 54, 5.5));
    P(root, 'ta-gauge-bezel', bezel);
    P(root, 'ta-gauge-bezel-light', sector(60, 64, 47.4, 50.6, -84, -8));
    P(root, 'ta-gauge-bezel-shade', sector(60, 64, 46.6, 51.4, 24, 90) + rr(9, 75, 102, 4.4, [0, 0, 4, 4]));
    P(root, 'ta-gauge-face', face);
    P(root, 'ta-gauge-green', sector(60, 64, 33, 42, -90, -32));
    P(root, 'ta-gauge-gold', sector(60, 64, 33, 42, -28, 28));
    P(root, 'ta-gauge-red', sector(60, 64, 33, 42, 32, 90));
    P(root, 'ta-ink-fine', face + ticks + sector(60, 64, 33, 42, -90, -32) + sector(60, 64, 33, 42, -28, 28) + sector(60, 64, 33, 42, 32, 90));
    P(root, 'ta-ink', bezel);
    const needle = G(root, 'ta-gauge-needle');
    const pointer = poly([[57, 66], [59.3, 25], [60.7, 25], [63, 66], [60, 72]]);
    P(needle, 'ta-gauge-pointer', pointer);
    P(needle, 'ta-ink-fine', pointer);
    P(root, 'ta-gauge-hub', shape.circle(60, 64, 5.4));
    P(root, 'ta-gauge-hub-light', shape.circle(58.6, 62.6, 1.7));
    P(root, 'ta-ink-fine', shape.circle(60, 64, 5.4));
    return root;
  };
})();
