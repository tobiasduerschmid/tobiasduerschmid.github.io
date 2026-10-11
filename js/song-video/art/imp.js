/*
 * The IMP: the Interface Message Processor that became the ARPANET's first
 * node in Boelter Hall in 1969, a refrigerator-sized steel cabinet with a
 * front panel of indicator lamps and toggle switches, vents, and two doors.
 * Same projection and moonlight as the castle (common.js).
 *
 *   NetArt.imp()        → static markup (one SVG symbol, shown by net-kit.js)
 *   NetArt.impOverlay() → the lamps, which net-kit.js blinks (and puts out
 *                         when the node crashes)
 *   NetArt.IMP          → the viewBox and anchor points
 */
(function () {
  'use strict';

  const { n, poly, shift, hash01, softLight, lineGlow, gritPattern } = window.NetArt.util;

  const FRONT = { x: 30, y: 52, w: 130, h: 248 };
  const DEPTH_UNITS = 44;
  const LAMPS = { x: 47, rows: [92, 103], step: 8.2, count: 11 };

  const IMP = {
    width: 240,
    height: 340,
    /** Where the network line leaves the cabinet (the side face, mid-height). */
    port: [186, 214],
    /** The center of the name plate, for labels. */
    plate: [64, 74],
    lamps: LAMPS,
  };

  function defs() {
    return `<defs>
      <linearGradient id="steel-{id}" x1="0" y1="0" x2=".35" y2="1">
        <stop offset="0" stop-color="#9aa3b1"/><stop offset=".45" stop-color="#6c7482"/><stop offset="1" stop-color="#434a56"/>
      </linearGradient>
      <linearGradient id="steelside-{id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3d4450"/><stop offset="1" stop-color="#1e232b"/>
      </linearGradient>
      <linearGradient id="panel-{id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1d222b"/><stop offset="1" stop-color="#11151b"/>
      </linearGradient>
      <linearGradient id="door-{id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#7f8896"/><stop offset="1" stop-color="#4a515e"/>
      </linearGradient>
      <linearGradient id="sheen-{id}" x1="0" y1="0" x2="1" y2=".2">
        <stop offset="0" stop-color="#eef3ff" stop-opacity=".2"/><stop offset=".3" stop-color="#eef3ff" stop-opacity=".03"/>
        <stop offset=".55" stop-color="#eef3ff" stop-opacity=".1"/><stop offset=".62" stop-color="#eef3ff" stop-opacity="0"/>
      </linearGradient>
      ${gritPattern('steel', { size: 36, count: 20, seed: 23, strength: 0.6 })}
    </defs>`;
  }

  /** Louvered vent: slats with a dark gap and a lit lip, across [x0, x1] from y. */
  function vent(x0, x1, y, count, gap = 5.4) {
    let out = `<rect x="${x0 - 3}" y="${y - 4}" width="${x1 - x0 + 6}" height="${n(count * gap + 5)}" rx="2" fill="#2b313c"/>`;
    for (let i = 0; i < count; i++) {
      const sy = y + i * gap;
      out += `<path d="M${x0} ${n(sy)}H${x1}" stroke="#0c0f14" stroke-width="2.6"/>`;
      out += `<path d="M${x0} ${n(sy + 1.6)}H${x1}" stroke="#b9c3d2" stroke-opacity=".55" stroke-width=".8"/>`;
    }
    return out;
  }

  /** Slats on the side face, receding with the depth. */
  function sideVent(y, count) {
    const { x, w } = FRONT;
    const R = x + w;
    let out = '';
    for (let i = 0; i < count; i++) {
      const sy = y + i * 5.2;
      const a = shift([R + 0, sy], 8);
      const b = shift([R + 0, sy], DEPTH_UNITS - 8);
      out += `<path d="M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}" stroke="#0b0e13" stroke-width="2.2"/>`;
      out += `<path d="M${n(a[0])} ${n(a[1] + 1.4)}L${n(b[0])} ${n(b[1] + 1.4)}" stroke="#8792a4" stroke-opacity=".4" stroke-width=".7"/>`;
    }
    return out;
  }

  const rivet = (cx, cy) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="1.5" fill="#3a414d"/><circle cx="${n(cx - 0.4)}" cy="${n(cy - 0.4)}" r=".7" fill="#dfe6f2" fill-opacity=".8"/>`;

  /** A toggle switch: a chrome bezel and a lever, up or down. */
  function toggle(cx, cy, up) {
    const tip = up ? -6 : 6;
    return `<rect x="${n(cx - 2.6)}" y="${n(cy - 2.6)}" width="5.2" height="5.2" rx="1" fill="#c9d0db"/>`
      + `<circle cx="${n(cx)}" cy="${n(cy)}" r="1.3" fill="#40474f"/>`
      + `<path d="M${n(cx)} ${n(cy)}L${n(cx + 0.6)} ${n(cy + tip)}" stroke="#eef2f8" stroke-width="1.5" stroke-linecap="round"/>`;
  }

  function imp() {
    const { x, y, w, h } = FRONT;
    const R = x + w;
    const B = y + h;
    const out = [defs()];
    // Shadow on the floor and the cool moonlight behind the cabinet.
    out.push(softLight(118, 312, 112, 16, '#03050a', 0.6, { core: 0.3 }));
    out.push(softLight(120, 150, 130, 170, '#3b62c8', 0.18));
    // The cabinet: side (in shade), top (lit), front.
    const side = [[R, y], shift([R, y], DEPTH_UNITS), shift([R, B], DEPTH_UNITS), [R, B]];
    const top = [[x, y], [R, y], shift([R, y], DEPTH_UNITS), shift([x, y], DEPTH_UNITS)];
    out.push(poly(side, 'fill="url(#steelside-{id})"'));
    out.push(poly(side, 'fill="url(#grit-steel-{id})"'));
    out.push(poly(top, 'fill="#aeb7c4"'));
    out.push(poly(top, 'fill="url(#grit-steel-{id})"'));
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#steel-{id})"/>`);
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#grit-steel-{id})"/>`);
    out.push(sideVent(150, 9));
    out.push(sideVent(236, 7));
    // A seam where the side panel bolts on, with rivets.
    for (let i = 0; i < 6; i++) {
      const p = shift([R, y + 18 + i * 44], DEPTH_UNITS - 4);
      out.push(rivet(p[0], p[1]));
    }
    // The network cable leaves the side face and drops behind the plinth.
    const [px, py] = IMP.port;
    out.push(`<path d="M${px} ${py}c10 6 14 24 12 70" fill="none" stroke="#0d1016" stroke-width="5.5" stroke-linecap="round"/>`);
    out.push(`<path d="M${px} ${py}c10 6 14 24 12 70" fill="none" stroke="#56606f" stroke-width="1.2" stroke-linecap="round"/>`);
    out.push(`<ellipse cx="${px}" cy="${py}" rx="4" ry="5" fill="#2a303a" stroke="#0b0e13" stroke-width="1"/>`);

    // Top trim band.
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="8" fill="#59616e"/><path d="M${x} ${y + 0.6}H${R}" stroke="#eef3ff" stroke-opacity=".55" stroke-width="1"/>`);
    // The control panel: an inset bezel.
    out.push(`<rect x="${x + 7}" y="${y + 12}" width="${w - 14}" height="90" rx="3" fill="url(#panel-{id})"/>`);
    out.push(`<path d="M${x + 7} ${y + 102}V${y + 12}H${R - 7}" fill="none" stroke="#05070a" stroke-opacity=".9" stroke-width="2"/>`);
    out.push(`<path d="M${R - 7} ${y + 12}V${y + 102}H${x + 7}" fill="none" stroke="#c3ccd9" stroke-opacity=".45" stroke-width="1.2"/>`);
    // Name plate.
    const [plx, ply] = IMP.plate;
    out.push(`<rect x="${plx - 22}" y="${ply - 7}" width="44" height="14" rx="2" fill="#d7dde6"/>`);
    out.push(`<rect x="${plx - 22}" y="${ply - 7}" width="44" height="14" rx="2" fill="none" stroke="#5a6270" stroke-width=".8"/>`);
    out.push(`<text x="${plx}" y="${ply + 3.6}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="10" letter-spacing=".8" fill="#1a1f27">IMP</text>`);
    out.push(`<text x="${R - 12}" y="${ply + 3}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="5.6" letter-spacing=".5" fill="#9aa5b6">NODE</text>`);
    // Unlit lamp sockets (the overlay lights them).
    for (const ly of LAMPS.rows) {
      for (let i = 0; i < LAMPS.count; i++) {
        const lx = LAMPS.x + i * LAMPS.step;
        out.push(`<circle cx="${n(lx)}" cy="${ly}" r="2.9" fill="#0a0c10"/><circle cx="${n(lx)}" cy="${ly}" r="2.2" fill="#3d2c18"/>`);
      }
    }
    // Two knobs.
    for (const [kx, ky] of [[143, 94], [143, 110]]) {
      out.push(`<circle cx="${kx}" cy="${ky}" r="5" fill="#2a3039"/><circle cx="${kx}" cy="${ky}" r="3.8" fill="#8e98a8"/><path d="M${kx} ${ky}l2.4 -2.4" stroke="#14181e" stroke-width="1.2" stroke-linecap="round"/><circle cx="${kx - 1.2}" cy="${ky - 1.2}" r="1" fill="#eef3fb" fill-opacity=".8"/>`);
    }
    // A row of toggle switches, and their labels as ticks.
    for (let i = 0; i < 12; i++) {
      const tx = 45 + i * 8.4;
      out.push(toggle(tx, 128, hash01(i * 7 + 3) < 0.45));
      out.push(`<path d="M${n(tx)} 136.5v2" stroke="#7a8597" stroke-width=".7"/>`);
    }
    out.push(`<path d="M44 142H${R - 12}" stroke="#7a8597" stroke-opacity=".6" stroke-width=".7"/>`);
    // Stencil and vent.
    out.push(`<text x="${x + w / 2}" y="${y + 114}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="6" letter-spacing="1.1" fill="#2a303a" fill-opacity=".85">INTERFACE MESSAGE PROCESSOR</text>`);
    out.push(vent(x + 12, R - 12, y + 124, 7));
    // Two doors with recessed panels, handles, and rivets.
    for (const [dx, dw] of [[x + 6, 58], [x + 66, 58]]) {
      out.push(`<rect x="${dx}" y="${y + 170}" width="${dw}" height="70" rx="2" fill="url(#door-{id})"/>`);
      out.push(`<rect x="${dx + 6}" y="${y + 176}" width="${dw - 12}" height="58" rx="2" fill="#5b6370"/>`);
      out.push(`<path d="M${dx + 6} ${y + 234}V${y + 176}H${dx + dw - 6}" fill="none" stroke="#2a303a" stroke-width="1.2"/><path d="M${dx + dw - 6} ${y + 176}V${y + 234}H${dx + 6}" fill="none" stroke="#c7d0dc" stroke-opacity=".5" stroke-width="1"/>`);
      for (const [rx, ry] of [[dx + 3, y + 173], [dx + dw - 3, y + 173], [dx + 3, y + 237], [dx + dw - 3, y + 237]]) out.push(rivet(rx, ry));
    }
    out.push(`<rect x="${x + 58}" y="${y + 196}" width="3.4" height="18" rx="1.5" fill="#d6dde7"/><rect x="${x + 69}" y="${y + 196}" width="3.4" height="18" rx="1.5" fill="#d6dde7"/>`);
    out.push(`<path d="M${x + 64.5} ${y + 170}V${y + 240}" stroke="#14181e" stroke-width="1.4"/>`);
    // Plinth with a toe-kick and two casters.
    out.push(`<rect x="${x - 2}" y="${B}" width="${w + 4}" height="10" fill="#1c2027"/>`);
    out.push(poly([[R + 2, B], shift([R + 2, B], DEPTH_UNITS - 2), shift([R + 2, B + 10], DEPTH_UNITS - 2), [R + 2, B + 10]], 'fill="#12151a"'));
    out.push(`<circle cx="${x + 12}" cy="${B + 13}" r="3.6" fill="#0d1014"/><circle cx="${R - 12}" cy="${B + 13}" r="3.6" fill="#0d1014"/>`);
    // Sheen and edges: cool rim on the left and top, dark seam on the right.
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sheen-{id})"/>`);
    out.push(lineGlow(`M${x} ${B}V${y}H${R}`, '#cfe0ff', { width: 1.1, opacity: 0.55 }));
    out.push(`<path d="M${R} ${y}V${B}" stroke="#0b0e13" stroke-width="1.2"/>`);
    out.push(`<path d="M${n(shift([x, y], DEPTH_UNITS)[0])} ${n(shift([x, y], DEPTH_UNITS)[1])}H${n(shift([R, y], DEPTH_UNITS)[0])}" stroke="#eef3ff" stroke-opacity=".4" stroke-width=".9"/>`);
    // Warm spill from the lamps onto the panel.
    out.push(softLight(92, 98, 56, 18, '#ffb547', 0.14));
    return out.join('');
  }

  /** The lamps, live: one classed circle (with a halo) per socket. */
  function impOverlay() {
    const out = [];
    LAMPS.rows.forEach((ly, row) => {
      for (let i = 0; i < LAMPS.count; i++) {
        const lx = LAMPS.x + i * LAMPS.step;
        const seed = row * 31 + i;
        const color = hash01(seed * 5 + 1) < 0.18 ? '#ff6b5a' : '#ffbf4d';
        out.push(`<g class="nk-imp-lamp" data-seed="${seed}">${softLight(lx, ly, 6.4, 6.4, color, 0.55, { core: 0.3 })}<circle cx="${n(lx)}" cy="${ly}" r="2.1" fill="${color}"/><circle cx="${n(lx - 0.6)}" cy="${ly - 0.6}" r=".7" fill="#fff6dc"/></g>`);
      }
    });
    return out.join('');
  }

  Object.assign(window.NetArt, { IMP, imp, impOverlay });
})();
