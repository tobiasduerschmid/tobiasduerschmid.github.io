/*
 * Shared tools for the song-video illustrations in art/ (castle.js,
 * client.js, island.js, imp.js, map.js), which register their markup
 * builders on window.NetArt. net-kit.js puts each drawing in the page once,
 * as an SVG <symbol>, and shows it wherever the choreography needs a copy.
 *
 * Everything is plain vector art: shapes, gradients, and patterns. No
 * filters and no bitmaps, so a drawing stays sharp at any size and costs
 * little to repaint. Texture comes from drawn detail (masonry, grit,
 * chips, rivets); light comes from gradients (softLight, lightSpill) and
 * layered strokes (lineGlow); shadow from translucent gradient shapes
 * (shade). Markup uses `{id}` wherever an id must be unique per drawing.
 *
 * Projection for the 3D pieces: oblique, depth vector (0.9, -0.45) per unit,
 * so side faces recede up and to the right and are seen in shade; the key
 * light is cool moonlight from the upper left.
 */
(function () {
  'use strict';

  const { hash01 } = window.Timeline;

  const DEPTH = [0.9, -0.45];
  const n = (value) => Number(value.toFixed(1));
  const pts = (list) => list.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
  const poly = (list, attrs = '') => `<polygon points="${pts(list)}" ${attrs}/>`;
  const path = (list, attrs = '') => `<path d="M${list.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}" ${attrs}/>`;
  const shift = ([x, y], d) => [x + DEPTH[0] * d, y + DEPTH[1] * d];
  const jitter = ([x, y], seed, amount) => [x + (hash01(seed) - 0.5) * 2 * amount, y + (hash01(seed + 7) - 0.5) * 2 * amount];
  const rand = (seed, lo, hi) => lo + (hi - lo) * hash01(seed);

  /** Linear blend of two "#rrggbb" colors (t clamped to [0, 1]). */
  function mix(a, b, t) {
    const pa = a.replace('#', '').match(/\w\w/g).map((h) => parseInt(h, 16));
    const pb = b.replace('#', '').match(/\w\w/g).map((h) => parseInt(h, 16));
    const k = Math.min(1, Math.max(0, t));
    return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
  }

  // ------------------------------------------------------------------
  // Light and shadow, as gradients and strokes
  // ------------------------------------------------------------------

  let paintUid = 0;
  const paintId = (prefix) => `${prefix}${++paintUid}-{id}`;

  /**
   * A soft pool of light (or, in a dark color, shade) filling the ellipse:
   * full strength at the center, fading to nothing at the rim. `core` is
   * the fraction of the radius that stays at full strength; `rotate` turns
   * the ellipse (degrees) about its center.
   */
  function softLight(cx, cy, rx, ry, color, opacity, { core = 0, rotate = 0 } = {}) {
    const id = paintId('soft');
    const mid = core + (1 - core) * 0.42;
    const turn = rotate ? ` transform="rotate(${n(rotate)} ${n(cx)} ${n(cy)})"` : '';
    return `<radialGradient id="${id}"><stop offset="${core}" stop-color="${color}" stop-opacity="${opacity}"/>`
      + `<stop offset="${n(mid)}" stop-color="${color}" stop-opacity="${n(opacity * 0.38)}"/>`
      + `<stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`
      + `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#${id})"${turn}/>`;
  }

  /**
   * A polygon of light (or shade) that fades out along a direction: full
   * `opacity` at `from`, nothing at `to` (both points in drawing units).
   */
  function lightSpill(points, color, opacity, from, to) {
    const id = paintId('spill');
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(from[0])}" y1="${n(from[1])}" x2="${n(to[0])}" y2="${n(to[1])}">`
      + `<stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>`
      + poly(points, `fill="url(#${id})"`);
  }

  /** A shadow: lightSpill in near-black. */
  function shade(points, opacity, from, to) {
    return lightSpill(points, '#03050a', opacity, from, to);
  }

  /**
   * A glowing line: the path drawn three times, wide and faint under
   * narrow and bright, which reads as a soft halo around a lit edge.
   */
  function lineGlow(d, color, { width = 2, opacity = 0.6 } = {}) {
    return `<g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">`
      + `<path d="${d}" stroke-width="${n(width * 5)}" stroke-opacity="${n(opacity * 0.12)}"/>`
      + `<path d="${d}" stroke-width="${n(width * 2.6)}" stroke-opacity="${n(opacity * 0.24)}"/>`
      + `<path d="${d}" stroke-width="${n(width)}" stroke-opacity="${n(opacity)}"/></g>`;
  }

  // ------------------------------------------------------------------
  // Texture, drawn
  // ------------------------------------------------------------------

  /** A rough outline: every edge of the polygon gains `steps - 1` jittered points. */
  function roughen(points, seed, amount, steps = 3) {
    const out = [];
    points.forEach((p, i) => {
      const q = points[(i + 1) % points.length];
      out.push(p);
      for (let k = 1; k < steps; k++) {
        const t = k / steps;
        out.push(jitter([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], seed + i * 31 + k * 7, amount));
      }
    });
    return out;
  }

  /**
   * Grit for stone and rock: a tile of seeded specks, light and dark, laid
   * over a fill (fill="url(#grit-<name>-{id})") so flat faces read as
   * weathered material.
   */
  function gritPattern(name, { size = 48, count = 26, seed = 1, light = '#dbe6ff', dark = '#02040a', strength = 1 } = {}) {
    const specks = [];
    for (let i = 0; i < count; i++) {
      const x = rand(seed * 97 + i * 13, 0, size);
      const y = rand(seed * 61 + i * 29, 0, size);
      const r = rand(seed * 17 + i * 7, 0.35, 1.15);
      const isLight = hash01(seed * 31 + i * 3) < 0.38;
      const alpha = (isLight ? rand(i * 11 + seed, 0.06, 0.16) : rand(i * 5 + seed, 0.12, 0.3)) * strength;
      specks.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${isLight ? light : dark}" fill-opacity="${n(alpha * 100) / 100}"/>`);
      if (i % 5 === 0) {
        // A short hairline crack or scratch every few specks.
        const a = rand(seed * 7 + i, 0, Math.PI);
        const len = rand(seed * 3 + i, 2.5, 6);
        specks.push(`<path d="M${n(x)} ${n(y)}l${n(Math.cos(a) * len)} ${n(Math.sin(a) * len)}" stroke="${dark}" stroke-opacity="${n(0.22 * strength)}" stroke-width=".6"/>`);
      }
    }
    return `<pattern id="grit-${name}-{id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${specks.join('')}</pattern>`;
  }

  /**
   * An irregular boulder around (cx, cy): a jittered polygon with a lit
   * upper-left facet, a shaded lower-right facet, a grit overlay, chips
   * along the rim, and maybe a crack. `warm` tints it toward the door
   * light. The drawing that uses it must define gritPattern('rock').
   */
  function boulder(cx, cy, r, seed, warm = 0) {
    const k = 8 + Math.floor(hash01(seed) * 4);
    const points = [];
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + rand(seed * 7 + i, -0.22, 0.22);
      const rr = r * rand(seed * 13 + i, 0.8, 1.1);
      points.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.68]);
    }
    const center = [cx - r * 0.12, cy - r * 0.12];
    const lit = points.filter(([px, py]) => (px - cx) + (py - cy) * 1.4 < r * 0.1);
    const dark = points.filter(([px, py]) => (px - cx) + (py - cy) * 1.4 > r * 0.35);
    const base = mix('#2a3045', '#6e452a', warm);
    const top = mix('#4d5979', '#cf9358', warm);
    const low = mix('#11141f', '#3a2416', warm * 0.8);
    let svg = poly(points, `fill="${base}"`);
    if (lit.length >= 2) svg += poly([center, ...lit], `fill="${top}" opacity=".85"`);
    if (dark.length >= 2) svg += poly([center, ...dark], `fill="${low}" opacity=".9"`);
    svg += poly(points, 'fill="url(#grit-rock-{id})"');
    // A secondary facet line across the lit face, like a fracture plane.
    if (lit.length >= 3) {
      const [a, b] = [lit[0], lit[lit.length - 1]];
      svg += `<path d="M${n((a[0] + center[0]) / 2)} ${n((a[1] + center[1]) / 2)}L${n((b[0] + center[0]) / 2)} ${n((b[1] + center[1]) / 2)}" stroke="${warm > 0.35 ? '#ffd8a0' : '#9fb6dc'}" stroke-opacity=".22" stroke-width=".8" fill="none"/>`;
    }
    if (hash01(seed * 3 + 1) < 0.5) {
      svg += `<path d="M${n(cx - r * 0.2)} ${n(cy - r * 0.3)}l${n(r * 0.25)} ${n(r * 0.3)}l${n(-r * 0.05)} ${n(r * 0.3)}" stroke="#05070e" stroke-opacity=".55" stroke-width="1" fill="none"/>`;
    }
    // Chips: small dark notches along the lower rim.
    dark.slice(0, 2).forEach(([px, py], i) => {
      svg += `<path d="M${n(px)} ${n(py)}l${n(-2 - i)} ${n(-1.5)}l${n(-1.5)} ${n(1.8)}z" fill="#05070e" fill-opacity=".6"/>`;
    });
    svg += poly(points, 'fill="none" stroke="#05070e" stroke-opacity=".55" stroke-width="1.1"');
    const rim = points.filter(([px, py]) => (px - cx) + (py - cy) < -r * 0.3);
    if (rim.length >= 2) svg += `<path d="M${rim.map(([px, py]) => `${n(px)} ${n(py)}`).join('L')}" stroke="${warm > 0.35 ? '#ffd8a0' : '#b6d0f5'}" stroke-opacity=".55" stroke-width="1.2" fill="none"/>`;
    return { cy, svg };
  }

  window.NetArt = {
    util: { DEPTH, n, pts, poly, path, shift, jitter, rand, mix, hash01, softLight, lightSpill, shade, lineGlow, roughen, gritPattern, boulder },
  };
})();
