/*
 * Router islands: small floating rocks with a beacon — a violet crystal over
 * a carved pedestal (a router) or green radio arcs (your home Wi-Fi router).
 * Same rock rendering as the castle's. NetArt.island(kind) → markup in a
 * 160 × 160 viewBox (NetArt.ISLAND; `anchor` is where network lines attach).
 */
(function () {
  'use strict';

  const { poly, softLight, lineGlow, roughen, gritPattern, boulder } = window.NetArt.util;

  const ISLAND = { width: 160, height: 160, anchor: [80, 44] };

  function island(kind) {
    const tone = kind === 'wifi' ? '#4ade80' : '#a78bfa';
    const out = [`<defs>
      ${gritPattern('stone', { size: 30, count: 22, seed: 13 })}
      ${gritPattern('rock', { size: 30, count: 26, seed: 6, strength: 1.25 })}
      <linearGradient id="front-{id}" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#6c7aa0"/><stop offset="1" stop-color="#363f5e"/></linearGradient>
      <linearGradient id="side-{id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#29304a"/><stop offset="1" stop-color="#151a29"/></linearGradient>
      <linearGradient id="crystal-{id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f6f0ff"/><stop offset=".45" stop-color="#b9a0ff"/><stop offset="1" stop-color="#5234c4"/>
      </linearGradient>
    </defs>`];
    out.push(softLight(80, 46, 46, 46, tone, 0.45));
    // The rock: an underside of solid bands, then boulders on top.
    const underside = roughen([[14, 104], [44, 98], [80, 104], [120, 96], [148, 104], [140, 122], [118, 136], [96, 148], [80, 158], [64, 150], [44, 138], [24, 122]], kind === 'wifi' ? 21 : 11, 2.2);
    out.push(`<g>${poly(underside, 'fill="#151a28"')}`
      + poly([[14, 104], [44, 98], [80, 104], [120, 96], [148, 104], [140, 116], [80, 120], [22, 116]], 'fill="#2a3149"')
      + poly([[44, 138], [62, 126], [80, 158], [64, 150]], 'fill="#10141f"')
      + poly([[96, 148], [104, 128], [118, 136]], 'fill="#171c2b"')
      + '<path d="M80 158l3 10 3-10zM118 136l2 7 3-7zM44 138l2 6 3-6z" fill="#0a0d15"/>'
      + poly(underside, 'fill="url(#grit-rock-{id})"')
      + '<path d="M26 120q30 6 56 2t52-6M44 136q20 4 40 0" fill="none" stroke="#3a4566" stroke-opacity=".45" stroke-width="1"/></g>');
    const rocks = [[30, 102, 16], [56, 100, 14], [104, 98, 15], [128, 102, 14], [42, 112, 12], [92, 112, 13], [70, 114, 11], [116, 112, 10]]
      .map(([x, y, r], i) => boulder(x, y, r, 300 + i * 7 + (kind === 'wifi' ? 50 : 0)))
      .sort((a, b) => a.cy - b.cy);
    out.push(`<g>${rocks.map((b) => b.svg).join('')}</g>`);
    // A carved pedestal with a glowing rune.
    out.push(`<g>${poly([[70, 100], [90, 100], [90, 64], [70, 64]], 'fill="url(#front-{id})"')}`
      + poly([[70, 100], [90, 100], [90, 64], [70, 64]], 'fill="url(#grit-stone-{id})"')
      + poly([[90, 100], [96, 97], [96, 61], [90, 64]], 'fill="url(#side-{id})"')
      + poly([[64, 64], [96, 64], [101, 61.5], [69, 61.5]], 'fill="#8394bb"')
      + '<rect x="64" y="64" width="32" height="5" fill="#56648a"/><rect x="66" y="96" width="28" height="5" fill="#56648a"/></g>');
    // Status lights on the pedestal, like a router's LEDs.
    out.push(lineGlow('M74 76h12M74 82h12M74 88h12', tone, { width: 2, opacity: 0.55 }));
    out.push(`<path d="M74 76h12M74 82h12M74 88h7" stroke="${tone}" stroke-width="1.8" stroke-linecap="round"/>`);
    out.push('<path d="M70 100V64" stroke="#b9d3fa" stroke-opacity=".55" stroke-width="1.4"/>');
    if (kind === 'wifi') {
      out.push(lineGlow('M58 40a31 31 0 0 1 44 0M65 48a20 20 0 0 1 30 0M72 55.5a9 9 0 0 1 16 0', '#4ade80', { width: 3.4, opacity: 0.5 }));
      out.push('<g fill="none" stroke="#4ade80" stroke-width="3.4" stroke-linecap="round"><path d="M58 40a31 31 0 0 1 44 0"/><path d="M65 48a20 20 0 0 1 30 0"/><path d="M72 55.5a9 9 0 0 1 16 0"/></g><circle cx="80" cy="60" r="3.6" fill="#dcffe9"/>');
    } else {
      out.push(softLight(80, 44, 26, 30, '#b9a0ff', 0.7, { core: 0.25 }));
      out.push('<path d="M80 22l11 22-11 22-11-22z" fill="url(#crystal-{id})"/><path d="M80 22l11 22-11 22" fill="#3b2596" opacity=".35"/><path d="M80 22v44M69 44h22" stroke="#fff" stroke-opacity=".45" stroke-width=".8"/>');
    }
    return out.join('');
  }

  /** The live part: the router's orbit ring (net-kit.js rocks it) — routers only. */
  function islandOverlay(kind) {
    return kind === 'wifi' ? '' : '<ellipse class="nk-beacon-ring" cx="80" cy="44" rx="25" ry="7" fill="none" stroke="#c9b8ff" stroke-opacity=".9" stroke-width="1.6"/>';
  }

  Object.assign(window.NetArt, { ISLAND, island, islandOverlay });
})();
