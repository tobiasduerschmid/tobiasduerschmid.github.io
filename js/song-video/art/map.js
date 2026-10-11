/*
 * A top-down game map for the "send where you are, not that you moved"
 * scene: grass, a dirt road along row 2, a pond, trees, rocks, and a faint
 * grid of 50-unit cells (6 columns by 4 rows) that the moves are counted
 * in. Plain vector art, like everything in art/ (common.js).
 *
 *   NetArt.map() → static markup;  NetArt.MAP → viewBox and cell size
 */
(function () {
  'use strict';

  const { n, rand, hash01, softLight } = window.NetArt.util;

  const MAP = { width: 300, height: 200, cell: 50, columns: 6, rows: 4 };

  /** The center of cell (column, row), both counted from 1. */
  const cellCenter = (column, row) => [(column - 0.5) * MAP.cell, (row - 0.5) * MAP.cell];

  function defs() {
    const tufts = [];
    for (let i = 0; i < 14; i++) {
      const x = rand(i * 13 + 1, 1, 23);
      const y = rand(i * 29 + 5, 3, 23);
      const tone = hash01(i * 7) < 0.5 ? '#5f9e5c' : '#173b27';
      tufts.push(`<path d="M${n(x - 1.6)} ${n(y)}l1.6 -3.2 1.6 3.2" fill="none" stroke="${tone}" stroke-width=".7" stroke-opacity=".7" stroke-linecap="round"/>`);
    }
    return `<defs>
      <linearGradient id="grass-{id}" x1="0" y1="0" x2=".4" y2="1">
        <stop offset="0" stop-color="#3a7a4b"/><stop offset="1" stop-color="#25553a"/>
      </linearGradient>
      <pattern id="tufts-{id}" width="24" height="24" patternUnits="userSpaceOnUse">${tufts.join('')}</pattern>
      <radialGradient id="water-{id}" cx=".4" cy=".35" r=".8">
        <stop offset="0" stop-color="#4aa3d6"/><stop offset=".7" stop-color="#2a6f9f"/><stop offset="1" stop-color="#1d4f74"/>
      </radialGradient>
      <radialGradient id="canopy-{id}" cx=".35" cy=".3" r=".75">
        <stop offset="0" stop-color="#6cbf62"/><stop offset=".6" stop-color="#2f7a3c"/><stop offset="1" stop-color="#1c4a28"/>
      </radialGradient>
    </defs>`;
  }

  function tree(cx, cy, r, seed) {
    const lobes = [[-0.42, 0.1, 0.62], [0.4, 0.08, 0.6], [0, -0.32, 0.66], [0.02, 0.28, 0.58]];
    let out = `<ellipse cx="${n(cx + r * 0.35)}" cy="${n(cy + r * 0.55)}" rx="${n(r * 1.05)}" ry="${n(r * 0.5)}" fill="#0b2214" fill-opacity=".45"/>`;
    for (const [dx, dy, s] of lobes) {
      out += `<circle cx="${n(cx + dx * r)}" cy="${n(cy + dy * r)}" r="${n(r * s)}" fill="url(#canopy-{id})"/>`;
    }
    out += `<circle cx="${n(cx - r * 0.25)}" cy="${n(cy - r * 0.35)}" r="${n(r * 0.22)}" fill="#a6e38f" fill-opacity=".35"/>`;
    if (hash01(seed) < 0.5) out += `<circle cx="${n(cx + r * 0.3)}" cy="${n(cy + r * 0.05)}" r="${n(r * 0.08)}" fill="#ff7a8a"/>`;
    return out;
  }

  function rock(cx, cy, r) {
    return `<ellipse cx="${n(cx + 1.5)}" cy="${n(cy + r * 0.5)}" rx="${n(r * 1.1)}" ry="${n(r * 0.45)}" fill="#0b2214" fill-opacity=".4"/>`
      + `<path d="M${n(cx - r)} ${n(cy + r * 0.3)}L${n(cx - r * 0.6)} ${n(cy - r * 0.6)}L${n(cx + r * 0.4)} ${n(cy - r * 0.75)}L${n(cx + r)} ${n(cy + r * 0.1)}L${n(cx + r * 0.5)} ${n(cy + r * 0.55)}Z" fill="#8a93a4"/>`
      + `<path d="M${n(cx - r * 0.6)} ${n(cy - r * 0.6)}L${n(cx + r * 0.4)} ${n(cy - r * 0.75)}L${n(cx + r * 0.1)} ${n(cy - r * 0.1)}Z" fill="#c4cbd6"/>`;
  }

  function map() {
    const { width, height, cell, columns, rows } = MAP;
    const out = [defs()];
    out.push(`<rect width="${width}" height="${height}" fill="url(#grass-{id})"/><rect width="${width}" height="${height}" fill="url(#tufts-{id})"/>`);
    // Lighter meadow patches.
    out.push(softLight(60, 160, 70, 34, '#7fc06b', 0.25));
    out.push(softLight(210, 20, 90, 30, '#7fc06b', 0.18));
    // The pond, upper right: sandy shore, water, ripples.
    out.push('<path d="M214 118c10-22 52-30 72-16 18 12 16 40-4 52-22 14-62 10-70-8-4-9-2-19 2-28z" fill="#cdb27a"/>');
    out.push('<path d="M220 120c10-18 46-24 63-12 15 10 13 33-4 43-19 12-53 8-60-7-3-8-2-16 1-24z" fill="url(#water-{id})"/>');
    out.push('<path d="M236 126q10-5 20 0M250 140q9-4 18 0M232 148q8-4 16 0" fill="none" stroke="#e6f6ff" stroke-opacity=".45" stroke-width="1.1" stroke-linecap="round"/>');
    out.push('<ellipse cx="270" cy="134" rx="6" ry="3" fill="#3f9a4b"/><path d="M268 133l3 -2" stroke="#e7f7c9" stroke-width=".8"/>');
    // The road along row 2: dark verge, dirt, lighter wheel ruts, pebbles.
    const road = 'M-6 78C30 66 52 86 80 76S130 64 160 76 214 88 240 72 290 62 306 70';
    out.push(`<path d="${road}" fill="none" stroke="#5a4127" stroke-width="22" stroke-linecap="round"/>`);
    out.push(`<path d="${road}" fill="none" stroke="#a87e4f" stroke-width="17" stroke-linecap="round"/>`);
    out.push(`<path d="${road}" fill="none" stroke="#c49d6a" stroke-width="5" stroke-linecap="round" stroke-dasharray="14 9" stroke-opacity=".7"/>`);
    for (let i = 0; i < 18; i++) {
      const px = rand(i * 17 + 3, 4, 296);
      const py = 74 + rand(i * 11 + 9, -6, 6);
      out.push(`<ellipse cx="${n(px)}" cy="${n(py)}" rx="${n(rand(i * 5, 0.8, 1.8))}" ry="${n(rand(i * 7, 0.6, 1.2))}" fill="${hash01(i * 3) < 0.5 ? '#6d5233' : '#e2c597'}"/>`);
    }
    // Trees and rocks, back to front.
    const trees = [[24, 26, 14], [62, 18, 11], [128, 30, 13], [176, 16, 10], [36, 138, 13], [100, 176, 15], [150, 130, 11], [196, 178, 12], [288, 24, 12]];
    trees.sort((a, b) => a[1] - b[1]).forEach(([x, y, r], i) => out.push(tree(x, y, r, i * 9 + 4)));
    out.push(rock(118, 116, 6) + rock(178, 118, 4.5) + rock(70, 112, 4));
    // Flowers.
    for (let i = 0; i < 26; i++) {
      const fx = rand(i * 23 + 2, 6, 294);
      const fy = rand(i * 19 + 8, 96, 196);
      if (fx > 206 && fy < 164 && fy > 98) continue;
      out.push(`<circle cx="${n(fx)}" cy="${n(fy)}" r="1.1" fill="${['#ffd84a', '#ff9ac6', '#f6f8ff'][i % 3]}" fill-opacity=".85"/>`);
    }
    // The grid the moves are counted in.
    const lines = [];
    for (let c = 1; c < columns; c++) lines.push(`M${c * cell} 0V${height}`);
    for (let r = 1; r < rows; r++) lines.push(`M0 ${r * cell}H${width}`);
    out.push(`<path d="${lines.join('')}" stroke="#eaf7ff" stroke-opacity=".28" stroke-width="1" stroke-dasharray="3 4"/>`);
    // Vignette at the map's edges.
    out.push(`<rect width="${width}" height="${height}" fill="none" stroke="#0b2214" stroke-opacity=".5" stroke-width="6"/>`);
    return out.join('');
  }

  Object.assign(window.NetArt, { MAP, map, cellCenter });
})();
