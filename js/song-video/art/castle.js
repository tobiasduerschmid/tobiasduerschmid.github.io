/*
 * The server: a castle on a floating rock, after the reference art — a
 * tall, narrow gate tower with a gold "S" over a slim glowing pointed arch,
 * a taller keep and two turrets behind it, all standing on a cascade of
 * boulders with a staircase down to the lower left.
 *
 *   NetArt.castle()        → static markup (one SVG symbol, shown by net-kit.js)
 *   NetArt.castleOverlay() → live light: gate glow, window glows, lanterns,
 *                            embers, and the closed doors (shown at the end
 *                            of a connection)
 *   NetArt.CASTLE          → the viewBox and anchor points
 */
(function () {
  'use strict';

  const { n, poly, shift, jitter, rand, mix, hash01, softLight, lightSpill, shade, lineGlow, roughen, gritPattern, boulder } = window.NetArt.util;

  const CASTLE = {
    width: 480,
    height: 660,
    gate: [236, 488],
    windows: [[320, 98, 11, 26], [320, 190, 11, 26], [326, 292, 10, 22], [384, 186, 9, 21], [384, 284, 9, 20], [136, 224, 10, 22], [136, 318, 10, 22]],
    lanterns: [[202, 478, true], [270, 474, false]],
  };

  // The gate arch: span, springline, and the radius of its two arcs.
  const ARCH = { x0: 212, x1: 260, spring: 452, ground: 536, radius: 40, depth: 9 };

  /** A point on the pointed arch: φ from π (left springline) to the apex; inset shrinks the radius. */
  function archPoint(side, phi, inset = 0) {
    const { x0, x1, spring, radius } = ARCH;
    const r = radius - inset;
    if (side === 'left') return [x0 + radius + r * Math.cos(phi), spring - r * Math.sin(phi)];
    return [x1 - radius - r * Math.cos(phi), spring - r * Math.sin(phi)];
  }

  /** Angle at which the two arcs meet (the apex). */
  function apexAngle(inset = 0) {
    const { x0, x1, radius } = ARCH;
    const r = radius - inset;
    return Math.acos(((x1 - x0) / 2 - radius) / r);
  }

  /** The arch outline (inset from the outer edge) down to the ground, as a path. */
  function archPath(inset) {
    const { ground } = ARCH;
    const phiA = apexAngle(inset);
    const left = [];
    const right = [];
    for (let i = 0; i <= 16; i++) {
      const phi = Math.PI - (Math.PI - phiA) * (i / 16);
      left.push(archPoint('left', phi, inset));
      right.push(archPoint('right', phi, inset));
    }
    const all = [[left[0][0], ground], ...left, ...right.reverse(), [right[0][0], ground]];
    return `M${all.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`;
  }

  // ------------------------------------------------------------------
  // Towers: shafts, battlements, machicolations, windows
  // ------------------------------------------------------------------

  /** Shaft: side face (shade) and front face (lit), each with masonry. */
  function shaft({ x, y, w, h, d, tone }) {
    const A = [x, y];
    const B = [x + w, y];
    const C = [x + w, y + h];
    const D = [x, y + h];
    const side = [B, shift(B, d), shift(C, d), C];
    return poly(side, `fill="url(#side-${tone}-{id})"`)
      + poly(side, 'fill="url(#brickside-{id})"')
      + poly(side, 'fill="url(#grit-stone-{id})"')
      + poly(side, 'fill="url(#ao-{id})"')
      + poly([A, B, C, D], `fill="url(#front-${tone}-{id})"`)
      + poly([A, B, C, D], 'fill="url(#brick-{id})"')
      + poly([A, B, C, D], 'fill="url(#grit-stone-{id})"')
      + poly([A, B, C, D], 'fill="url(#shade-{id})"')
      + poly([A, B, C, D], 'fill="url(#ao-{id})"');
  }

  /**
   * A battlement on top of a shaft whose top edge is at y: the walkway and
   * the far parapet (seen through the crenels), the side parapet in shade,
   * and the front parapet with thick merlons.
   */
  function battlement({ x, y, w, d, tone, merlonW = 12, crenelW = 8, band = 10, merlonH = 15, overhang = 3 }) {
    const L = x - overhang;
    const R = x + w + overhang;
    const top = y - band;
    const peak = top - merlonH;
    const out = [];
    // Walkway and the far parapet's inner face.
    out.push(poly([[L, top], [R, top], shift([R, top], d), shift([L, top], d)], 'fill="#1d2335"'));
    out.push(poly([shift([L, top], d), shift([R, top], d), shift([R, peak], d), shift([L, peak], d)], `fill="${tone === 'back' ? '#3a4466' : '#2c3452'}"`));
    // Side parapet (outer face, in shade) with its merlons.
    const B = [R, y];
    const count = Math.max(1, Math.round(d / 9));
    out.push(poly([B, shift(B, d), shift([R, top], d), [R, top]], `fill="url(#side-${tone}-{id})"`));
    for (let k = 0; k < count; k++) {
      const t0 = (k + 0.15) / count;
      const t1 = (k + 0.7) / count;
      out.push(poly([shift([R, top], d * t0), shift([R, top], d * t1), shift([R, peak], d * t1), shift([R, peak], d * t0)], `fill="url(#side-${tone}-{id})"`));
      out.push(`<path d="M${n(shift([R, peak], d * t0)[0])} ${n(shift([R, peak], d * t0)[1])}L${n(shift([R, peak], d * t1)[0])} ${n(shift([R, peak], d * t1)[1])}" stroke="#8fa5d0" stroke-opacity=".35" stroke-width="1"/>`);
    }
    // Front parapet band and merlons, each merlon with a cap and a shaded side.
    out.push(poly([[L, y], [R, y], [R, top], [L, top]], `fill="url(#front-${tone}-{id})"`));
    out.push(poly([[L, y], [R, y], [R, top], [L, top]], 'fill="url(#brick-{id})"'));
    const span = R - L;
    const merlons = Math.max(2, Math.floor((span + crenelW) / (merlonW + crenelW)));
    const used = merlons * merlonW + (merlons - 1) * crenelW;
    let mx = L + (span - used) / 2;
    for (let i = 0; i < merlons; i++) {
      const a = [mx, top];
      const b = [mx + merlonW, top];
      out.push(poly([[mx, peak], [mx + merlonW, peak], b, a], `fill="url(#front-${tone}-{id})"`));
      out.push(poly([[mx, peak], [mx + merlonW, peak], b, a], 'fill="url(#brick-{id})"'));
      out.push(poly([[mx, peak], [mx + merlonW, peak], shift([mx + merlonW, peak], 4), shift([mx, peak], 4)], `fill="${tone === 'back' ? '#8796bb' : '#7b8ab0'}"`));
      out.push(poly([[mx + merlonW, peak], shift([mx + merlonW, peak], 4), shift(b, 4), b], `fill="url(#side-${tone}-{id})"`));
      out.push(`<path d="M${n(mx)} ${n(top)}V${n(peak)}" stroke="#c6dbff" stroke-opacity=".45" stroke-width="1"/>`);
      mx += merlonW + crenelW;
    }
    out.push(`<path d="M${n(L)} ${n(top)}H${n(R)}" stroke="#05070e" stroke-opacity=".55" stroke-width="1.2"/>`);
    out.push(`<path d="M${n(L)} ${n(y)}H${n(R)}" stroke="#05070e" stroke-opacity=".5" stroke-width="1"/>`);
    return out.join('');
  }

  /** A projecting band on corbels under a battlement (the main tower's machicolation). */
  function machicolation({ x, y, w, d, tone }) {
    const L = x - 5;
    const R = x + w + 5;
    const out = [];
    out.push(poly([[R, y], shift([R, y], d), shift([R, y + 14], d), [R, y + 14]], `fill="url(#side-${tone}-{id})"`));
    out.push(poly([[L, y], [R, y], [R, y + 14], [L, y + 14]], `fill="url(#front-${tone}-{id})"`));
    out.push(poly([[L, y], [R, y], [R, y + 14], [L, y + 14]], 'fill="url(#brick-{id})"'));
    for (let cx = L + 5; cx < R - 6; cx += 11) {
      out.push(`<path d="M${n(cx)} ${n(y + 14)}h7l-1.6 10h-3.8z" fill="#3a4466"/>`);
      out.push(`<path d="M${n(cx)} ${n(y + 14)}l1.6 10" stroke="#a9bfe6" stroke-opacity=".4" stroke-width=".8"/>`);
      out.push(`<path d="M${n(cx + 7)} ${n(y + 14)}l-1.6 10" stroke="#05070e" stroke-opacity=".6" stroke-width=".9"/>`);
    }
    out.push(`<path d="M${n(L)} ${n(y + 14)}H${n(R)}" stroke="#05070e" stroke-opacity=".7" stroke-width="1.6"/>`);
    out.push(`<path d="M${n(L)} ${n(y)}H${n(R)}" stroke="#c6dbff" stroke-opacity=".5" stroke-width="1.2"/>`);
    return out.join('');
  }

  /** A slit window with an arched head: stone surround, keystone, deep recess, warm glass, sill. */
  function slitWindow([x, y, w, h]) {
    const r = w / 2;
    const arch = (inset) => `M${n(x + inset)} ${n(y + h)}V${n(y + r)}a${n(r - inset)} ${n(r - inset)} 0 0 1 ${n(2 * (r - inset))} 0V${n(y + h)}z`;
    return `<path d="${arch(-3.6)}" fill="#7a89ae"/>
      <path d="${arch(-3.6)}" fill="url(#shade-{id})"/>
      <path d="${arch(-3.6)}" fill="none" stroke="#05070e" stroke-opacity=".5" stroke-width=".8"/>
      <path d="${arch(-1.2)}" fill="#090b14"/>
      <path d="${arch(0.8)}" fill="url(#glass-{id})"/>
      <path d="M${n(x + r)} ${n(y + 2.5)}V${n(y + h)}M${n(x + 0.8)} ${n(y + h * 0.55)}h${n(w - 1.6)}" stroke="#5c2a0b" stroke-width=".9" opacity=".7"/>
      <path d="M${n(x - 5)} ${n(y + h + 1.4)}h${n(w + 10)}v2.6h${n(-w - 10)}z" fill="#8392b6"/>
      <path d="M${n(x - 5)} ${n(y + h + 4)}h${n(w + 10)}" stroke="#05070e" stroke-opacity=".6" stroke-width="1"/>
      <path d="M${n(x + r - 1.8)} ${n(y - 4)}h3.6l-.7 3.2h-2.2z" fill="#93a2c6"/>`;
  }

  function tower({ x, y, w, h, d, tone, windows = [], machicolated = false }) {
    const out = [];
    const shaftTop = machicolated ? y + 14 : y;
    out.push(shaft({ x, y: shaftTop, w, h: h - (shaftTop - y), d, tone }));
    if (machicolated) out.push(machicolation({ x, y, w, d, tone }));
    out.push(battlement({ x: machicolated ? x - 3 : x, y, w: machicolated ? w + 6 : w, d, tone }));
    for (const win of windows) out.push(slitWindow(win));
    return out.join('');
  }

  // ------------------------------------------------------------------
  // Rock: boulders and the ridge
  // ------------------------------------------------------------------

  function defs() {
    const toneGradients = (tone, front, side) => `
      <linearGradient id="front-${tone}-{id}" x1="0" y1="0" x2="0.25" y2="1">
        <stop offset="0" stop-color="${front[0]}"/><stop offset=".5" stop-color="${front[1]}"/><stop offset="1" stop-color="${front[2]}"/>
      </linearGradient>
      <linearGradient id="side-${tone}-{id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${side[0]}"/><stop offset="1" stop-color="${side[1]}"/>
      </linearGradient>`;
    return `<defs>
      ${gritPattern('stone', { size: 44, count: 34, seed: 9 })}
      ${gritPattern('rock', { size: 38, count: 30, seed: 4, strength: 1.25 })}
      ${toneGradients('main', ['#5a6484', '#3b435e', '#232940'], ['#252b3e', '#121520'])}
      ${toneGradients('back', ['#62709a', '#475275', '#2f3753'], ['#2e3550', '#1a1f30'])}
      <linearGradient id="shade-{id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#dfeaff" stop-opacity=".1"/><stop offset=".35" stop-color="#dfeaff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/>
      </linearGradient>
      <pattern id="brick-{id}" width="120" height="30" patternUnits="userSpaceOnUse">
        <path d="M0 .5H120M0 10.5H120M0 20.5H120M18 .5V10.5M44 .5V10.5M60 .5V10.5M90 .5V10.5M8 10.5V20.5M30 10.5V20.5M58 10.5V20.5M78 10.5V20.5M104 10.5V20.5M22 20.5V30.5M46 20.5V30.5M70 20.5V30.5M88 20.5V30.5M112 20.5V30.5" stroke="#04060c" stroke-opacity=".3" stroke-width=".9" fill="none"/>
        <path d="M0 1.5H120M0 11.5H120M0 21.5H120" stroke="#dce8ff" stroke-opacity=".06" stroke-width=".8" fill="none"/>
        <rect x="18.5" y="1" width="25.5" height="9.5" fill="#000" opacity=".1"/><rect x="60.5" y="1" width="29.5" height="9.5" fill="#fff" opacity=".035"/>
        <rect x="30.5" y="11" width="27.5" height="9.5" fill="#fff" opacity=".04"/><rect x="78.5" y="11" width="25.5" height="9.5" fill="#000" opacity=".09"/>
        <rect x="0" y="21" width="22" height="9.5" fill="#000" opacity=".08"/><rect x="70.5" y="21" width="17.5" height="9.5" fill="#fff" opacity=".04"/>
        <path d="M66 3l3 4M14 24l2 5M96 13l-2 4" stroke="#04060c" stroke-opacity=".35" stroke-width=".7"/>
      </pattern>
      <linearGradient id="ao-{id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/>
      </linearGradient>
      <pattern id="brickside-{id}" width="60" height="20" patternUnits="userSpaceOnUse" patternTransform="skewY(-26.57)">
        <path d="M0 .5H60M0 10.5H60M14 .5V10.5M38 .5V10.5M24 10.5V20.5M50 10.5V20.5" stroke="#04060c" stroke-opacity=".4" stroke-width=".9" fill="none"/>
      </pattern>
      <radialGradient id="glass-{id}" cx="0.5" cy="0.72" r="0.7">
        <stop offset="0" stop-color="#fff3cf"/><stop offset=".45" stop-color="#ffc061"/><stop offset="1" stop-color="#c9621a"/>
      </radialGradient>
      <radialGradient id="interior-{id}" cx="0.5" cy="0.8" r="0.8">
        <stop offset="0" stop-color="#fff7de"/><stop offset=".3" stop-color="#ffd68a"/><stop offset=".72" stop-color="#f39236"/><stop offset="1" stop-color="#8a3c10"/>
      </radialGradient>
      <linearGradient id="reveal-{id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#2a1a10"/><stop offset=".5" stop-color="#5a3518"/><stop offset="1" stop-color="#1b110a"/>
      </linearGradient>
      <linearGradient id="wood-{id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#83522b"/><stop offset="1" stop-color="#3c210d"/>
      </linearGradient>
      <linearGradient id="gold-{id}" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#fff6cc"/><stop offset=".32" stop-color="#f8cd66"/><stop offset=".68" stop-color="#d9962e"/><stop offset="1" stop-color="#8a5414"/>
      </linearGradient>
      <linearGradient id="recess-{id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#101625"/><stop offset="1" stop-color="#232d48"/>
      </linearGradient>
      <linearGradient id="under-{id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2b3350"/><stop offset=".45" stop-color="#151a29"/><stop offset="1" stop-color="#06080e"/>
      </linearGradient>
    </defs>`;
  }

  // The stairs: 15 steps from the threshold down the boulder cascade to the lower left.
  const STEPS = 15;
  const step = (i) => ({ cx: 232 - 11 * i, cy: 544 + 6.8 * i, half: 22 - i * 0.3 });

  function staircase() {
    const out = [];
    for (let i = 0; i < STEPS; i++) {
      const { cx, cy, half } = step(i);
      const warmth = Math.max(0, 1 - i / 8);
      const j = (p, k) => jitter(p, 900 + i * 11 + k, 0.9);
      const tl = j([cx - half, cy], 1);
      const tr = j([cx + half, cy], 2);
      const br = j([cx + half - 3, cy + 3.2], 3);
      const bl = j([cx - half - 3, cy + 3.2], 4);
      const tread = mix('#58668c', '#e6ab62', warmth * 0.85);
      const riser = mix('#1f2640', '#77482a', warmth * 0.75);
      out.push(poly([tl, tr, br, bl], `fill="${tread}"`));
      out.push(poly([bl, br, [br[0], br[1] + 3.8], [bl[0], bl[1] + 3.8]], `fill="${riser}"`));
      out.push(`<path d="M${n(tl[0])} ${n(tl[1])}L${n(tr[0])} ${n(tr[1])}" stroke="${warmth > 0.3 ? '#ffe7b8' : '#bcd4f7'}" stroke-opacity="${(0.3 + 0.45 * warmth).toFixed(2)}" stroke-width=".9"/>`);
      if (hash01(i * 7 + 2) < 0.6) out.push(`<path d="M${n(cx + rand(i * 3, -half + 4, half - 8))} ${n(cy + 1)}l2.4 2.4" stroke="#05070e" stroke-opacity=".5" stroke-width=".8"/>`);
    }
    return out.join('');
  }

  // ------------------------------------------------------------------
  // The castle
  // ------------------------------------------------------------------

  function castle() {
    const out = [defs()];

    // Atmosphere: cool moonlight behind the towers, warm light around the base.
    out.push(softLight(270, 250, 220, 290, '#3b62c8', 0.34));
    out.push(softLight(240, 556, 236, 112, '#ff8a3a', 0.5));

    // The underside of the floating rock (solid bands: Chrome drops parts of
    // large gradient-filled shapes inside this drawing), rough and faceted.
    const underside = roughen([[70, 500], [120, 494], [200, 502], [262, 510], [332, 500], [404, 492], [458, 504], [452, 534], [430, 560], [400, 586], [362, 606], [326, 624], [300, 648], [278, 626], [248, 618], [214, 612], [180, 620], [150, 630], [120, 640], [92, 650], [64, 654], [44, 646], [38, 628], [52, 600], [60, 566], [64, 532]], 70, 3.2);
    out.push(`<g>${poly(underside, 'fill="#141926"')}`
      + poly([[70, 500], [120, 494], [200, 502], [262, 510], [332, 500], [404, 492], [458, 504], [452, 534], [380, 542], [300, 548], [220, 550], [140, 548], [72, 542]], 'fill="#283049"')
      + poly([[72, 542], [140, 548], [220, 550], [300, 548], [380, 542], [452, 534], [430, 560], [400, 586], [330, 582], [250, 578], [170, 584], [96, 594], [60, 566]], 'fill="#1c2235"')
      + poly([[120, 640], [140, 604], [180, 620], [150, 630]], 'fill="#121725"')
      + poly([[248, 618], [264, 570], [326, 624], [300, 648], [278, 626]], 'fill="#0f131f"')
      + poly([[362, 606], [384, 562], [400, 586]], 'fill="#1a2033"')
      + poly([[64, 654], [72, 614], [92, 650]], 'fill="#141a29"')
      + poly([[404, 492], [458, 504], [452, 534], [420, 522]], 'fill="#323b58"')
      + '<path d="M300 648l4 12 4-12zM150 630l3 10 4-10zM92 650l2 8 3-8zM362 606l3 10 3-10z" fill="#0a0d15"/>'
      + poly(underside, 'fill="url(#grit-rock-{id})"')
      // Strata: faint ledges across the underside, lit from above.
      + '<path d="M84 560q60 8 120 2t130-6 104-10M70 600q50 10 110 4t120-2 90-14M120 628q50 6 100-2" fill="none" stroke="#3a4566" stroke-opacity=".5" stroke-width="1.2"/>'
      + '<path d="M84 562q60 8 120 2t130-6 104-10M70 602q50 10 110 4t120-2 90-14" fill="none" stroke="#04060c" stroke-opacity=".5" stroke-width="1"/></g>');

    // Back towers and walls (bluer and softer: atmospheric perspective).
    const W = CASTLE.windows;
    out.push('<g>');
    out.push(tower({ x: 372, y: 140, w: 30, h: 362, d: 14, tone: 'back', windows: [W[3], W[4]] }));
    out.push(tower({ x: 300, y: 48, w: 54, h: 454, d: 22, tone: 'back', windows: [W[0], W[1], W[2]] }));
    out.push(tower({ x: 120, y: 160, w: 46, h: 346, d: 18, tone: 'back', windows: [W[5], W[6]] }));
    out.push(tower({ x: 166, y: 238, w: 18, h: 268, d: 12, tone: 'back' }));
    out.push('</g>');
    // Warm light from each window spills down the wall below it.
    for (const [wx, wy, ww, wh] of W) {
      const top = wy + wh + 4;
      out.push(lightSpill([[wx - ww * 0.4, top], [wx + ww * 1.4, top], [wx + ww * 2, top + 46], [wx - ww, top + 46]], '#ffa94d', 0.24, [0, top], [0, top + 46]));
    }
    // The gate tower's shadow falls on the keep (the light is from the upper left).
    out.push(shade([[306, 140], [344, 140], [344, 500], [306, 500]], 0.5, [306, 0], [344, 0]));

    // The gate tower: tall and narrow, machicolated.
    out.push('<g>');
    out.push(tower({ x: 184, y: 112, w: 104, h: 424, d: 22, tone: 'main', machicolated: true }));
    out.push('<path d="M296 200l3-1.5v20l-3 1.5zM296 290l3-1.5v20l-3 1.5zM302 386l3-1.5v18l-3 1.5z" fill="#05070c"/>');
    out.push('</g>');
    out.push(shade([[176, 136], [298, 136], [298, 150], [176, 150]], 0.55, [0, 136], [0, 150]));

    // The S plaque: moulded frame, recess, bevelled gold letter, rivets.
    out.push('<rect x="196" y="160" width="80" height="104" rx="3" fill="#4c5879"/>');
    out.push('<rect x="196" y="160" width="80" height="104" rx="3" fill="url(#shade-{id})"/>');
    out.push('<path d="M196 264V160h80" stroke="#d2e2ff" stroke-opacity=".55" stroke-width="1.8" fill="none"/><path d="M276 160v104H196" stroke="#05070e" stroke-opacity=".6" stroke-width="1.8" fill="none"/>');
    out.push('<rect x="201" y="165" width="70" height="94" rx="2" fill="none" stroke="#3b4566" stroke-width="2"/>');
    out.push('<rect x="206" y="170" width="60" height="84" rx="2" fill="url(#recess-{id})"/>');
    out.push('<path d="M206 254V170h60" stroke="#05070e" stroke-opacity=".9" stroke-width="3" fill="none"/><path d="M266 170v84h-60" stroke="#8697be" stroke-opacity=".45" stroke-width="1.5" fill="none"/>');
    out.push(softLight(236, 212, 34, 42, '#ffc45e', 0.42));
    const S = 'x="236" y="241" text-anchor="middle" font-family="Georgia, \'Times New Roman\', serif" font-weight="700" font-size="76"';
    out.push(`<text ${S} dx="3" dy="4" fill="#050302" opacity=".8">S</text>`);
    out.push(`<text ${S} dx="1.4" dy="1.8" fill="#6e420f">S</text>`);
    out.push(`<text ${S} fill="url(#gold-{id})" stroke="#5c3a0e" stroke-width="1">S</text>`);
    out.push(`<text ${S} dx="-0.9" dy="-0.9" fill="none" stroke="#fff8de" stroke-opacity=".65" stroke-width=".7">S</text>`);
    for (const [cx, cy] of [[200, 164], [272, 164], [200, 260], [272, 260]]) {
      out.push(`<circle cx="${cx}" cy="${cy}" r="2.4" fill="#c99a45"/><circle cx="${cx - 0.8}" cy="${cy - 0.8}" r=".9" fill="#fff2c8"/>`);
    }

    // The gate: quoined jambs, a ring of voussoirs, a keystone, the glowing hall.
    const { x0, x1, spring, ground, depth } = ARCH;
    for (let i = 0; i < 6; i++) {
      // Quoins: alternating long and short blocks up each jamb.
      const hgt = (ground - spring) / 6;
      const y = ground - (i + 1) * hgt;
      const long = i % 2 === 0;
      out.push(`<rect x="${n(x0 - (long ? 12 : 8))}" y="${n(y)}" width="${long ? 12 + depth : 8 + depth}" height="${n(hgt - 1)}" fill="${['#5b6889', '#525e80'][i % 2]}"/>`);
      out.push(`<rect x="${n(x1 - depth)}" y="${n(y)}" width="${long ? 12 + depth : 8 + depth}" height="${n(hgt - 1)}" fill="${['#434e6d', '#3c4664'][i % 2]}"/>`);
    }
    const phiA = apexAngle(0);
    const stones = 6;
    for (const sideName of ['left', 'right']) {
      for (let k = 0; k < stones; k++) {
        const p0 = Math.PI - (Math.PI - phiA) * (k / stones);
        const p1 = Math.PI - (Math.PI - phiA) * ((k + 1) / stones);
        const quad = [archPoint(sideName, p0, -11), archPoint(sideName, p1, -11), archPoint(sideName, p1, 0), archPoint(sideName, p0, 0)];
        const fill = sideName === 'left' ? ['#5e6b8d', '#556283'][k % 2] : ['#46516f', '#3f4966'][k % 2];
        out.push(poly(quad, `fill="${fill}" stroke="#0a0e18" stroke-opacity=".7" stroke-width=".9"`));
      }
    }
    const apex = archPoint('left', phiA, 0);
    out.push(poly([[apex[0] - 6, apex[1] - 14], [apex[0] + 6, apex[1] - 14], [apex[0] + 4, apex[1] + 3], [apex[0] - 4, apex[1] + 3]], 'fill="#6c7a9e" stroke="#0a0e18" stroke-opacity=".7" stroke-width=".9"'));
    out.push(`<path d="${archPath(0)}" fill="url(#reveal-{id})"/>`);
    out.push(`<path d="${archPath(depth * 0.55)}" fill="#120c07"/>`);
    out.push(`<path d="${archPath(depth * 0.8)}" fill="url(#interior-{id})"/>`);
    // Inside the hall: a far arch, a floor glow, and the floor's lines.
    out.push(`<path d="M${x0 + 16} ${ground}v-26c0-7 4-12 8-15 4 3 8 8 8 15v26" stroke="#b05e1c" stroke-width="1.4" fill="none" opacity=".6"/>`);
    out.push(softLight((x0 + x1) / 2, ground - 4, 22, 6, '#fff3d4', 0.85, { core: 0.3 }));
    out.push(`<path d="M${x0 + 6} ${ground}l12-26M${x1 - 6} ${ground}l-12-26" stroke="#b5641f" stroke-width="1" opacity=".45"/>`);
    // Left leaf, swung in against the hall wall.
    out.push(`<path d="M${x0 + 7} ${spring + 2}l9 5v${ground - spring - 7}h-9z" fill="url(#wood-{id})"/>`);
    out.push(`<path d="M${x0 + 11.5} ${spring + 6}v${ground - spring - 6}M${x0 + 7} ${spring + 30}l9 2.5M${x0 + 7} ${spring + 62}l9 2.5" stroke="#2a170a" stroke-width=".9"/>`);
    // Right leaf, swung out toward us: planks, iron straps, glazed panes, a ring pull.
    const lx = x1 - 3;
    const leaf = `M${lx} ${spring - 8}l19 10v${ground - spring + 10}l-19-5z`;
    out.push(`<path d="M${lx + 3} ${ground}l26 6 5 4-26-2z" fill="#03050a" fill-opacity=".45"/>`);
    out.push(`<path d="${leaf}" fill="url(#wood-{id})"/>`);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 2; col++) {
        const px = lx + 2.5 + col * 8;
        const py = spring + 2 + row * 18 + col * 4.2;
        out.push(`<path d="M${px} ${py}l6 3.2v12l-6-3.2z" fill="#ffd486" opacity="${(0.92 - row * 0.12).toFixed(2)}"/>`);
      }
    }
    out.push(`<path d="M${lx} ${spring + 18}l19 10M${lx} ${spring + 54}l19 10M${lx} ${spring + 82}l19 10" stroke="#1f140b" stroke-width="2.2"/>`);
    out.push(`<circle cx="${lx + 14}" cy="${spring + 58}" r="2.4" fill="none" stroke="#2a1a0c" stroke-width="1.3"/>`);
    out.push(`<path d="${leaf}" fill="none" stroke="#1c1108" stroke-width="1.2"/>`);
    // Threshold slab.
    out.push(poly([[x0 - 14, ground], [x1 + 14, ground], [x1 + 21, ground + 6], [x0 - 7, ground + 6]], 'fill="#6f7ea4"'));
    out.push(poly([[x0 - 7, ground + 6], [x1 + 21, ground + 6], [x1 + 21, ground + 10], [x0 - 7, ground + 10]], 'fill="#262e47"'));
    // Wall lanterns on iron brackets.
    for (const [lxp, lyp, flip] of CASTLE.lanterns) {
      const s = flip ? -1 : 1;
      out.push(`<path d="M${lxp} ${lyp}h${s * 10}v-4" stroke="#0b0d14" stroke-width="2.2" fill="none"/>`);
      out.push(`<path d="M${lxp + s * 5.5} ${lyp - 4}h${s * 8}l${-s} -11h${-s * 6}z" fill="#ffd27a" stroke="#1b1208" stroke-width="1.1"/>`);
      out.push(`<path d="M${lxp + s * 9.5} ${lyp - 4}v-11" stroke="#1b1208" stroke-width=".8"/>`);
      out.push(`<path d="M${lxp + s * 6} ${lyp - 15}l${s * 3.5} -4l${s * 3.5} 4z" fill="#232838"/>`);
    }

    // The boulder cascade: boulders under the castle and behind the stairs
    // (sorted back to front), the staircase, then boulders in front of it.
    const back = [];
    const base = [[100, 510, 30], [136, 500, 24], [168, 518, 20], [304, 516, 24], [338, 506, 32], [382, 512, 28], [426, 504, 30], [456, 522, 22], [352, 538, 22], [402, 540, 26], [442, 546, 18], [320, 542, 18], [112, 536, 22], [76, 528, 20]];
    base.forEach(([x, y, r], i) => back.push(boulder(x, y, r, 40 + i, Math.max(0, 0.5 - Math.abs(x - 236) / 200))));
    for (let i = 1; i < STEPS; i++) {
      const { cx, cy, half } = step(i);
      const r = rand(i * 7, 12, 20);
      back.push(boulder(cx + half + r * 0.85, cy - 6, r, 120 + i * 3, Math.max(0, 0.55 - i / 12)));
    }
    back.sort((a, b) => a.cy - b.cy);
    out.push(`<g>${back.map((b) => b.svg).join('')}</g>`);
    out.push(softLight((x0 + x1) / 2, ground - 1, (x1 - x0) / 2 + 36, 10, '#03050a', 0.5, { core: 0.4 }));
    out.push(`<g>${staircase()}</g>`);
    const front = [];
    for (let i = 0; i < STEPS; i++) {
      const { cx, cy, half } = step(i);
      const r = rand(i * 11, 13, 21);
      front.push(boulder(cx - half - r * 0.9, cy + 10, r, 200 + i * 3, Math.max(0, 0.6 - i / 10)));
      if (i % 2 === 0) front.push(boulder(cx - rand(i * 13, 0, 14), cy + 22, rand(i * 17, 10, 16), 260 + i * 3, Math.max(0, 0.45 - i / 10)));
    }
    front.sort((a, b) => a.cy - b.cy);
    out.push(`<g>${front.map((b) => b.svg).join('')}</g>`);

    // Light passes: warm bounce on the gate stones, door spill and rays down
    // the stairs, window and lantern glows, the cool rim on the left edges.
    out.push(softLight((x0 + x1) / 2, ground - 36, 92, 104, '#ff9440', 0.3));
    // Door light spilling down the stairs toward the lower left.
    out.push(softLight(176, 584, 116, 40, '#ffbb63', 0.4, { core: 0.15, rotate: -37 }));
    out.push(softLight((x0 + x1) / 2, ground + 8, 80, 26, '#ffc46f', 0.55));
    for (const win of W) out.push(softLight(win[0] + win[2] / 2, win[1] + win[3] * 0.6, win[2] * 2.3, win[3] * 1.35, '#ffae4a', 0.45));
    for (const [lxp, lyp, flip] of CASTLE.lanterns) out.push(softLight(lxp + (flip ? -10 : 10), lyp - 10, 20, 20, '#ffbf5a', 0.6));
    out.push(lineGlow('M120 506V160M181 536V110M300 502V48M372 502V140', '#bcd6ff', { width: 1.3, opacity: 0.5 }));
    return out.join('');
  }

  /** Live light on top of the castle (net-kit.js animates the classed parts). */
  function castleOverlay() {
    const { x0, x1, spring, ground, depth } = ARCH;
    const out = [`<defs>
      <radialGradient id="ember-{id}"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".9"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
      <linearGradient id="wood-{id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#83522b"/><stop offset="1" stop-color="#3c210d"/></linearGradient>
    </defs>`];
    out.push(`<g class="nk-castle-gate">${softLight((x0 + x1) / 2, (spring + ground) / 2 + 6, 52, 74, '#ffb44f', 0.5, { core: 0.25 })}</g>`);
    CASTLE.windows.forEach((win, i) => {
      out.push(`<g class="nk-window-bloom" data-seed="${i}">${softLight(win[0] + win[2] / 2, win[1] + win[3] * 0.55, win[2] * 1.9, win[3] * 1.2, '#ffb24e', 0.5, { core: 0.2 })}</g>`);
    });
    for (const [lxp, lyp, flip] of CASTLE.lanterns) {
      out.push(`<g class="nk-window-bloom" data-seed="${lxp}">${softLight(lxp + (flip ? -9.5 : 9.5), lyp - 10, 13, 13, '#ffd27a', 0.8, { core: 0.25 })}</g>`);
    }
    // Closed doors, shown when a connection ends.
    const mid = (x0 + x1) / 2;
    out.push(`<g class="nk-castle-doors" opacity="0"><path d="${archPath(depth * 0.55)}" fill="url(#wood-{id})"/>`
      + `<path d="M${mid} ${ground - 110}V${ground}M${x0 + 14} ${ground - 84}V${ground}M${x1 - 14} ${ground - 84}V${ground}" stroke="#2a170a" stroke-width="1.3"/>`
      + `<path d="M${x0 + 5} ${ground - 70}H${x1 - 5}M${x0 + 5} ${ground - 28}H${x1 - 5}" stroke="#1f140b" stroke-width="2.4"/>`
      + `<circle cx="${mid - 5}" cy="${ground - 48}" r="2.6" fill="none" stroke="#c4a35c" stroke-width="1.3"/><circle cx="${mid + 5}" cy="${ground - 48}" r="2.6" fill="none" stroke="#c4a35c" stroke-width="1.3"/></g>`);
    // Embers drifting up from the rock.
    const embers = [[132, 492], [170, 528], [282, 540], [300, 566], [112, 562], [340, 524], [196, 592], [262, 600], [372, 552], [92, 592], [404, 534], [226, 560], [150, 612], [70, 622], [128, 586], [312, 590], [214, 620], [50, 632], [350, 578], [186, 568], [98, 614], [280, 616]];
    embers.forEach(([x, y], i) => out.push(`<g class="nk-spark" data-seed="${i}"><circle cx="${x}" cy="${y}" r="6" fill="url(#ember-{id})"/><circle cx="${x}" cy="${y}" r="${(0.9 + hash01(i * 13)).toFixed(2)}" fill="#ffe2a8"/></g>`));
    return out.join('');
  }

  Object.assign(window.NetArt, { CASTLE, castle, castleOverlay });
})();
