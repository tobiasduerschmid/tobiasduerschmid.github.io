/*
 * Artwork for the Layers video narration (choreography:
 * js/video-narration/layered-style.js; styles: css/video-narration-layered-
 * style.css). It builds on the wall kit and the architecture kit and adds the
 * lesson's own objects, each a metaphor whose mapping holds for the idea it
 * teaches:
 *
 *   a layered design is a building drawn in section on the blueprint: each
 *     layer a floor, the most abstract on top and the device at the ground,
 *     because a floor rests only on the floors below it;
 *   Pearl Dash is a game screen on a laptop or on a handheld console, with a
 *     squirrel, boba pearls, and the score written in words;
 *   the tangle is a grid of forty source files and a ball of mud whose
 *     dependencies run every way; a frame's time is a bar with a budget line.
 *
 * Every builder schedules its own motion on the Timeline, and every pose is a
 * pure function of narration time. Coordinates are CSS pixels inside the
 * picture's 960x540 body.
 */
(function () {
  'use strict';

  const { fx, onFrame, progress, easeInOutCubic } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, icon } = kit;
  const wall = window.WallKit;
  const { staged } = wall;
  const arch = window.ArchKit;
  const { show } = arch;

  // ------------------------------------------------------------------
  // The building: layers as floors
  // ------------------------------------------------------------------

  /**
   * One layer as a floor: its name and chips naming what lives on it.
   * states = [{ at, state }] repaints it (changed, same, new, lit, gone).
   */
  function floor(parent, { x, y, w, h = 72, name, items = [], at, until, how = 'rise', states = [], tone }) {
    const node = staged(parent, `ls-floor${tone ? ` ls-floor--${tone}` : ''}`, x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    el('b', 'ls-floor-name', node, name);
    if (items.length) {
      const row = el('span', 'ls-floor-items', node);
      items.forEach((text) => el('span', 'ls-chip', row, text));
    }
    if (states.length) arch.track(node, 'is-', states);
    return show(node, at, until, how);
  }

  /**
   * A building in section: a roof line, walls, ground hatching, and its
   * floors from the top down (floors = [{ name, items, tone, at, states }]).
   * Returns the floors and their geometry: top(i), mid(i), and bottom(i).
   */
  function building(parent, { x, y, w, floors, h = 72, gap = 12, at, until, step = 0.15, roof = true }) {
    const height = floors.length * h + (floors.length - 1) * gap;
    const frame = staged(parent, 'ls-frame', x - 14, y - (roof ? 34 : 10));
    frame.style.width = `${w + 28}px`;
    frame.style.height = `${height + (roof ? 34 : 10) + 22}px`;
    const art = svg('svg', { class: 'ls-frame-art', viewBox: `0 0 ${w + 28} ${height + (roof ? 34 : 10) + 22}`, 'aria-hidden': 'true' }, frame);
    const top = roof ? 34 : 10;
    if (roof) svg('path', { d: `M4 ${top - 4} L${(w + 28) / 2} 4 L${w + 24} ${top - 4}`, class: 'ls-frame-line' }, art);
    svg('path', { d: `M4 ${top - 4} V${top + height + 8} M${w + 24} ${top - 4} V${top + height + 8}`, class: 'ls-frame-line' }, art);
    svg('path', { d: `M0 ${top + height + 10} H${w + 28}`, class: 'ls-frame-ground' }, art);
    for (let gx = 6; gx < w + 28; gx += 16) svg('path', { d: `M${gx} ${top + height + 10} l-8 10`, class: 'ls-frame-hatch' }, art);
    show(frame, at, until, 'fade');
    const nodes = floors.map((spec, i) => floor(parent, {
      x, y: y + i * (h + gap), w, h, at: spec.at ?? at + 0.1 + i * step, until: spec.until ?? until, ...spec,
    }));
    const geometry = {
      x, y, w, h, gap,
      top: (i) => y + i * (h + gap),
      mid: (i) => y + i * (h + gap) + h / 2,
      bottom: (i) => y + i * (h + gap) + h,
    };
    return { frame, floors: nodes, ...geometry };
  }

  // ------------------------------------------------------------------
  // Pearl Dash: the squirrel, the screen, and the devices
  // ------------------------------------------------------------------

  /** The squirrel from the side, facing right, mid-jump: a big curled tail, a body, a head with an ear. */
  function squirrelArt(parent, { x = 0, y = 0, scale = 1 } = {}) {
    const g = svg('g', { class: 'ls-squirrel', transform: `translate(${x} ${y}) scale(${scale})` }, parent);
    svg('path', { d: 'M-6 6 C-34 0 -40 -30 -22 -44 C-10 -52 4 -44 2 -32 C0 -22 -12 -22 -12 -12 C-12 -4 -6 2 -6 6 Z', class: 'ls-squirrel-tail' }, g);
    svg('ellipse', { cx: 8, cy: 4, rx: 15, ry: 11, class: 'ls-squirrel-body' }, g);
    svg('circle', { cx: 24, cy: -8, r: 9, class: 'ls-squirrel-body' }, g);
    svg('path', { d: 'M20 -16 L22 -26 L28 -16 Z', class: 'ls-squirrel-body' }, g);
    svg('circle', { cx: 27, cy: -9, r: 2, class: 'ls-squirrel-eye' }, g);
    svg('path', { d: 'M2 14 L-4 22 M14 14 L20 22', class: 'ls-squirrel-leg' }, g);
    return g;
  }

  /** The game's night scene: rooftops, the moon, boba pearls, and the squirrel mid-jump. */
  function sceneArt(parent) {
    const art = svg('svg', { class: 'ls-scene-art', viewBox: '0 0 400 220', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' }, parent);
    svg('rect', { x: 0, y: 0, width: 400, height: 220, class: 'ls-scene-sky' }, art);
    svg('circle', { cx: 330, cy: 46, r: 20, class: 'ls-scene-moon' }, art);
    svg('path', { d: 'M0 170 H70 V138 H110 V170 H150 V180 H190 V124 L220 104 L250 124 V180 H300 V150 H360 V170 H400 V220 H0 Z', class: 'ls-scene-roofs' }, art);
    [[120, 96], [168, 82], [212, 70], [262, 92], [306, 118]].forEach(([cx, cy]) => svg('circle', { cx, cy, r: 6, class: 'ls-scene-pearl' }, art));
    squirrelArt(art, { x: 92, y: 116, scale: 1.1 });
    return art;
  }

  /**
   * Pearl Dash on a device: device 'laptop' (a screen on a keyboard base) or
   * 'console' (a handheld with a d-pad and buttons). The score and frame
   * rate are written in words and change over time (score, fps = [{ at, text }]).
   */
  function gameScreen(parent, { x, y, w = 420, device = 'laptop', at, until, how = 'fade', score = [{ at: -1, text: 'Score 1,240' }], fps, label, states = [] }) {
    const node = staged(parent, `ls-device ls-device--${device}`, x, y);
    node.style.width = `${w}px`;
    const screen = el('div', 'ls-screen', node);
    sceneArt(screen);
    const hud = el('span', 'ls-hud', screen, score[0].text);
    arch.track(hud, 'is-', score.map(({ at: when, text }) => ({ at: when, state: '', words: text })), hud);
    if (fps) {
      const rate = el('span', 'ls-hud ls-hud--fps', screen, fps[0].text);
      arch.track(rate, 'is-', fps.map(({ at: when, text, state = '' }) => ({ at: when, state, words: text })), rate);
    }
    if (device === 'laptop') el('span', 'ls-laptop-base', node);
    else {
      el('span', 'ls-pad ls-pad--dpad', node).append(icon('gamepad'));
      el('span', 'ls-pad ls-pad--buttons', node);
    }
    if (label) el('span', 'ls-device-label', node, label);
    if (states.length) arch.track(node, 'is-', states);
    return show(node, at, until, how);
  }

  // ------------------------------------------------------------------
  // The tangle
  // ------------------------------------------------------------------

  /** Forty source files as tiles; from `redAt`, all but `spared` turn red, one after another. */
  function fileGrid(parent, { x, y, cols = 8, rows = 5, size = 34, gap = 8, at, until, redAt, spared = [6, 31] }) {
    const node = staged(parent, 'ls-files', x, y);
    node.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;
    node.style.gap = `${gap}px`;
    const tiles = Array.from({ length: cols * rows }, (_, i) => {
      const tile = el('span', 'ls-file', node);
      tile.style.width = `${size}px`;
      tile.style.height = `${size * 1.2}px`;
      return tile;
    });
    if (redAt !== undefined) {
      const order = tiles.map((_, i) => i).filter((i) => !spared.includes(i));
      onFrame((t) => order.forEach((i, k) => tiles[i].classList.toggle('is-red', t >= redAt + k * 0.03)));
    }
    return show(node, at, until, 'fade');
  }

  /** A ball of mud: dependency lines running every way between scattered modules. */
  function mudBall(parent, { x, y, size = 300, at, until, drawAt = at }) {
    const node = staged(parent, 'ls-mud', x, y);
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    const art = svg('svg', { viewBox: '0 0 300 300', class: 'ls-mud-art', 'aria-hidden': 'true' }, node);
    const dots = Array.from({ length: 14 }, (_, i) => {
      const angle = i * 2.39996;
      const radius = 40 + ((i * 53) % 100);
      return [150 + radius * Math.cos(angle), 150 + radius * Math.sin(angle)];
    });
    dots.forEach(([x1, y1], i) => {
      [3, 5, 8].forEach((skip, k) => {
        const [x2, y2] = dots[(i + skip) % dots.length];
        const bend = ((i * 7 + k * 5) % 9) * 12 - 48;
        const path = svg('path', { d: `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${(150 + bend).toFixed(1)} ${(150 - bend).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`, class: 'ls-mud-line' }, art);
        fx.draw(path, drawAt + (i % 7) * 0.08, 0.7);
      });
    });
    dots.forEach(([cx, cy]) => svg('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: 7, class: 'ls-mud-dot' }, art));
    return show(node, at, until, 'fade');
  }

  // ------------------------------------------------------------------
  // Time and interfaces
  // ------------------------------------------------------------------

  /**
   * One frame's time against its budget: a bar whose fill follows
   * steps = [{ at, ms }] (gliding between them) and a dashed line at 16.7 ms;
   * the readout says the time and the frame rate in words.
   */
  function frameBar(parent, { x, y, w = 420, steps, at, until, max = 25 }) {
    const node = staged(parent, 'ls-bar', x, y);
    node.style.width = `${w}px`;
    const words = el('p', 'ls-bar-words', node);
    el('b', null, words, 'Frame time');
    const value = el('span', 'ls-bar-value', words, '');
    const track = el('span', 'ls-bar-track', node);
    const fill = el('span', 'ls-bar-fill', track);
    const budget = el('span', 'ls-bar-budget', track);
    budget.style.left = `${(16.7 / max) * 100}%`;
    el('span', 'ls-bar-budget-label', node, 'Budget: 16.7 ms');
    const sorted = [...steps].sort((a, b) => a.at - b.at);
    let shown = '';
    onFrame((t) => {
      let ms = sorted[0].ms;
      for (let i = 1; i < sorted.length; i += 1) {
        if (t >= sorted[i].at) ms = sorted[i].ms;
        else if (t > sorted[i].at - 0.8) ms = sorted[i - 1].ms + (sorted[i].ms - sorted[i - 1].ms) * easeInOutCubic(progress(t, sorted[i].at - 0.8, 0.8));
      }
      fill.style.width = `${Math.min(100, (ms / max) * 100).toFixed(1)}%`;
      const over = ms > 16.7;
      fill.classList.toggle('is-over', over);
      const text = `${ms.toFixed(1)} ms · ${Math.min(60, Math.round(1000 / ms))} fps`;
      if (text !== shown) { value.textContent = text; shown = text; }
    });
    return show(node, at, until, 'rise');
  }

  /** A socket an upper layer can plug into: an interface the lower layer defines, in code type. */
  function socket(parent, { x, y, w, name, text, at, until }) {
    const node = staged(parent, 'ls-socket', x, y);
    node.style.width = `${w}px`;
    el('span', 'ls-socket-plug', node).append(icon('plug'));
    const words = el('span', 'ls-socket-words', node);
    el('b', 'ak-mono', words, name);
    if (text) el('span', 'ak-mono', words, text);
    return show(node, at, until, 'pop');
  }

  window.LayersKit = { floor, building, squirrelArt, gameScreen, fileGrid, mudBall, frameBar, socket };
})();
