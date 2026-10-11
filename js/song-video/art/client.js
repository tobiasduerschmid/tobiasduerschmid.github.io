/*
 * The client: an ornate browser window after the reference art — an iron
 * frame with an embossed bevel, gold scrollwork, corner medallions and gem
 * lights, around a glowing cyan screen. net-kit.js shows the drawing and
 * overlays the live screen content (address, page).
 *
 *   NetArt.client() → static markup;  NetArt.CLIENT → layout of the overlay
 */
(function () {
  'use strict';

  const { n, softLight, lineGlow } = window.NetArt.util;

  /** The window's outline, as a path for its halo and its drop shadow. */
  const OUTLINE = 'M22 12H378Q396 12 396 30V278Q396 296 378 296H22Q4 296 4 278V30Q4 12 22 12Z';

  /** Layout in the 400 × 300 viewBox; net-kit.js places live content here. */
  const CLIENT = {
    width: 400,
    height: 300,
    screen: { x: 34, y: 58, w: 332, h: 210 },
    address: { x: 66, y: 66, w: 286, h: 22 },
    page: { x: 50, y: 98, w: 300, h: 160 },
  };

  const FRAME = 'M18 14H382Q394 14 394 26V280Q394 292 382 292H18Q6 292 6 280V26Q6 14 18 14ZM34 58V268H366V58Z';

  function medallion(cx, cy, r) {
    return `<path d="M${cx} ${n(cy - r * 1.4)}L${n(cx + r * 1.4)} ${cy}L${cx} ${n(cy + r * 1.4)}L${n(cx - r * 1.4)} ${cy}Z" fill="url(#iron-{id})" stroke="#070a12" stroke-width="1.2"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#iron-{id})" stroke="#0b0e18" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="${n(r * 0.74)}" fill="none" stroke="#8a9cc4" stroke-opacity=".75" stroke-width="1.2"/>
      <path d="M${n(cx)} ${n(cy - r * 0.45)}a${n(r * 0.45)} ${n(r * 0.45)} 0 1 1 ${n(-r * 0.42)} ${n(r * 0.6)}a${n(r * 0.25)} ${n(r * 0.25)} 0 1 1 ${n(r * 0.3)} ${n(-r * 0.3)}" fill="none" stroke="#d6b26a" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="${n(cx - r * 0.36)}" cy="${n(cy - r * 0.36)}" r="${n(r * 0.2)}" fill="#e6efff" opacity=".4"/>`;
  }

  /** Gold scrollwork: a pair of curls from (x, y), mirrored when `flip`. */
  function scroll(x, y, flip = false) {
    const s = flip ? -1 : 1;
    return `<path d="M${x} ${y}c${s * 8} -7 ${s * 18} -7 ${s * 24} 0s${s * 16} 7 ${s * 24} 0" fill="none" stroke="#d6b26a" stroke-opacity=".8" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M${x + s * 24} ${y}c${s} -5 ${s * 7} -6 ${s * 8} -1" fill="none" stroke="#d6b26a" stroke-opacity=".8" stroke-width="1.1" stroke-linecap="round"/>
      <circle cx="${x + s * 48}" cy="${y}" r="1.7" fill="#d6b26a"/>`;
  }

  function client() {
    const { screen, address } = CLIENT;
    const gem = (id, color) => `<radialGradient id="${id}-{id}" cx=".35" cy=".32" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${color}"/><stop offset="1" stop-color="#1c0e06"/></radialGradient>`;
    const out = [`<defs>
      <linearGradient id="iron-{id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#606e95"/><stop offset=".3" stop-color="#2f3955"/><stop offset=".7" stop-color="#1b2135"/><stop offset="1" stop-color="#414d70"/>
      </linearGradient>
      <pattern id="brushed-{id}" width="7" height="60" patternUnits="userSpaceOnUse">
        <path d="M.5 0V60M2.6 0V60M4.4 0V60M6.2 0V60" stroke="#fff" stroke-width=".35" stroke-opacity=".07"/>
        <path d="M1.6 0V60M5.3 0V60" stroke="#000" stroke-width=".4" stroke-opacity=".12"/>
      </pattern>
      <linearGradient id="sheen-{id}" x1="0" y1="0" x2=".55" y2="1">
        <stop offset="0" stop-color="#eaf1ff" stop-opacity=".38"/><stop offset=".18" stop-color="#eaf1ff" stop-opacity=".05"/>
        <stop offset=".46" stop-color="#eaf1ff" stop-opacity=".16"/><stop offset=".58" stop-color="#eaf1ff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".2"/>
      </linearGradient>
      <linearGradient id="screen-{id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#17325f"/><stop offset=".55" stop-color="#0d1d3e"/><stop offset="1" stop-color="#081329"/>
      </linearGradient>
      <radialGradient id="screenglow-{id}" cx=".5" cy=".4" r=".7">
        <stop offset="0" stop-color="#5fd4ff" stop-opacity=".22"/><stop offset="1" stop-color="#5fd4ff" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="glare-{id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".4" stop-color="#fff" stop-opacity=".02"/><stop offset=".41" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <pattern id="scan-{id}" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".16"/></pattern>
      ${gem('gemr', '#ff5f57')}${gem('gema', '#ffa62e')}${gem('gemy', '#ffd84a')}
      <linearGradient id="streak-{id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#5fd4ff" stop-opacity="0"/><stop offset=".5" stop-color="#9be7ff" stop-opacity=".75"/><stop offset="1" stop-color="#5fd4ff" stop-opacity="0"/>
      </linearGradient>
    </defs>`];
    // Drop shadow and the cyan aura behind the frame.
    out.push(`<g transform="translate(9 11)">${lineGlow(OUTLINE, '#000', { width: 5, opacity: 0.55 })}<path d="${OUTLINE}" fill="#000" fill-opacity=".45"/></g>`);
    out.push(lineGlow(OUTLINE, '#3fbcff', { width: 4, opacity: 0.32 }));
    // The iron frame, embossed and brushed, with its inner lip.
    const ironParts = `<path d="${FRAME}" fill-rule="evenodd"/>`
      + '<path d="M170 14l30-12 30 12z"/><path d="M178 292l22 13 22-13z"/>'
      + [10, 390].map((x) => `<path d="M${x} 136l6 17-6 17-6-17z"/>`).join('');
    for (const paint of ['iron', 'brushed', 'sheen']) out.push(`<g fill="url(#${paint}-{id})">${ironParts}</g>`);
    out.push(`<path d="${FRAME}" fill="none" stroke="#070a12" stroke-width="2"/>`);
    out.push('<path d="M20 22H380Q386 22 386 28V278Q386 284 380 284H20Q14 284 14 278V28Q14 22 20 22Z" fill="none" stroke="#a7badf" stroke-opacity=".35" stroke-width="1.2"/>');
    out.push('<path d="M28 50H372V274H28Z" fill="none" stroke="#05070e" stroke-opacity=".75" stroke-width="2.2"/><path d="M30 52H370" stroke="#a7badf" stroke-opacity=".28" stroke-width="1"/>');
    // Engraving, scrollwork, rivets, crest jewels.
    out.push('<path d="M30 30H370M30 278H370M22 44V262M378 44V262" stroke="#0c1020" stroke-opacity=".6" stroke-width="1"/>');
    out.push(scroll(110, 19) + scroll(290, 19, true) + scroll(150, 288) + scroll(250, 288, true));
    for (let i = 0; i < 9; i++) out.push(`<circle cx="${n(62 + i * 34.5)}" cy="283" r="1.6" fill="#b5c3e2" opacity=".65"/>`);
    for (let i = 0; i < 5; i++) out.push(`<circle cx="11" cy="${70 + i * 44}" r="1.6" fill="#b5c3e2" opacity=".65"/><circle cx="389" cy="${70 + i * 44}" r="1.6" fill="#b5c3e2" opacity=".65"/>`);
    out.push('<circle cx="200" cy="9" r="3.2" fill="#d6b26a"/><circle cx="199" cy="8" r="1" fill="#fff4cc"/><circle cx="200" cy="298" r="2.8" fill="#d6b26a"/><circle cx="10" cy="153" r="2.4" fill="#d6b26a"/><circle cx="390" cy="153" r="2.4" fill="#d6b26a"/>');
    // Gem lights on the frame: the browser's traffic lights, as jewels.
    [['gemr', 36], ['gema', 52], ['gemy', 68]].forEach(([gemId, x]) => {
      out.push(softLight(x, 36, 12, 12, { gemr: '#ff5f57', gema: '#ffa62e', gemy: '#ffd84a' }[gemId], 0.55, { core: 0.35 }));
      out.push(`<circle cx="${x}" cy="36" r="6" fill="#06080f"/><circle cx="${x}" cy="36" r="4.6" fill="url(#${gemId}-{id})"/><circle cx="${x - 1.6}" cy="34.4" r="1.1" fill="#fff" opacity=".85"/>`);
    });
    // The screen: deep blue glass, the browser chrome, a panel of code.
    out.push(`<rect x="${screen.x}" y="${screen.y}" width="${screen.w}" height="${screen.h}" rx="6" fill="url(#screen-{id})"/>`);
    out.push(`<rect x="${screen.x}" y="${screen.y}" width="${screen.w}" height="${screen.h}" rx="6" fill="url(#screenglow-{id})"/>`);
    out.push('<circle cx="46" cy="77" r="3" fill="#ff5f57"/><circle cx="56" cy="77" r="3" fill="#ffb02e"/>');
    out.push(`<rect x="${address.x}" y="${address.y}" width="${address.w}" height="${address.h}" rx="11" fill="#dfe8f8"/>`);
    out.push(`<rect x="${address.x}" y="${address.y}" width="${address.w}" height="${address.h}" rx="11" fill="none" stroke="#fff" stroke-opacity=".7"/>`);
    out.push('<rect x="50" y="98" width="300" height="160" rx="4" fill="#0b1a36" stroke="#4fb8e8" stroke-opacity=".55"/>');
    out.push('<rect x="50" y="98" width="300" height="12" rx="4" fill="#1d3766"/>');
    out.push('<circle cx="58" cy="104" r="2" fill="#ff5f57"/><circle cx="65" cy="104" r="2" fill="#ffb02e"/><circle cx="72" cy="104" r="2" fill="#28c941"/>');
    [82, 120, 64, 140, 98, 50, 130, 76, 112, 60, 92].forEach((len, i) => {
      const y = 120 + i * 12;
      const indent = [0, 12, 12, 24, 24, 12, 0, 12, 24, 12, 0][i];
      out.push(`<rect x="150" y="${y}" width="5" height="4" rx="1" fill="#4c6a9e" opacity=".7"/>`);
      out.push(`<rect x="${162 + indent}" y="${y}" width="${len}" height="4" rx="2" fill="${['#7fd8ff', '#c9e8ff', '#ffcf7a', '#9be7c4'][i % 4]}" opacity=".55"/>`);
    });
    out.push('<circle cx="356" cy="210" r="11" fill="#0b1a36" stroke="#5fd4ff" stroke-width="1.6"/><circle cx="356" cy="210" r="5.5" fill="none" stroke="#ff9d4a" stroke-width="1.6"/><circle cx="356" cy="210" r="2" fill="#ff9d4a"/>');
    // Glass: scan lines, a diagonal glare, and the glowing rim.
    out.push(`<rect x="${screen.x}" y="${screen.y}" width="${screen.w}" height="${screen.h}" rx="6" fill="url(#scan-{id})"/>`);
    out.push(`<rect x="${screen.x}" y="${screen.y}" width="${screen.w}" height="${screen.h}" rx="6" fill="url(#glare-{id})"/>`);
    const sx2 = screen.x + screen.w;
    const sy2 = screen.y + screen.h;
    out.push(lineGlow(`M${screen.x + 6} ${screen.y}H${sx2 - 6}Q${sx2} ${screen.y} ${sx2} ${screen.y + 6}V${sy2 - 6}Q${sx2} ${sy2} ${sx2 - 6} ${sy2}H${screen.x + 6}Q${screen.x} ${sy2} ${screen.x} ${sy2 - 6}V${screen.y + 6}Q${screen.x} ${screen.y} ${screen.x + 6} ${screen.y}Z`, '#5fd4ff', { width: 2.2, opacity: 0.5 }));
    out.push(`<rect x="${screen.x}" y="${screen.y}" width="${screen.w}" height="${screen.h}" rx="6" fill="none" stroke="#7fe0ff" stroke-width="2"/>`);
    for (const [cx, cy] of [[16, 24], [384, 24], [16, 282], [384, 282]]) out.push(medallion(cx, cy, 13));
    return out.join('');
  }

  /** The live streak that sweeps the code panel (net-kit.js moves it). */
  function clientOverlay() {
    return `<defs><linearGradient id="streak-{id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#5fd4ff" stop-opacity="0"/><stop offset=".5" stop-color="#9be7ff" stop-opacity=".7"/><stop offset="1" stop-color="#5fd4ff" stop-opacity="0"/>
      </linearGradient><clipPath id="code-{id}"><rect x="150" y="112" width="196" height="144"/></clipPath></defs>
      <g clip-path="url(#code-{id})"><rect class="nk-client-streak" x="150" y="166" width="180" height="10" rx="5" fill="url(#streak-{id})"/></g>`;
  }

  Object.assign(window.NetArt, { CLIENT, client, clientOverlay });
})();
