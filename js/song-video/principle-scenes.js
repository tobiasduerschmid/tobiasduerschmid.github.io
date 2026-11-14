/*
 * The principle scenes of "Design It In Before They Break In": one picture per security design
 * principle, each the scene under its stamp (western-kit.js `stamp`), so a
 * principle is seen working, not only read:
 *
 *   Open Design Principle: a see-through padlock beside its own published
 *   blueprint. Anyone can study how it works; it still opens only with the
 *   key (`clearLock`, `blueprint`).
 *   Zero Trust Principle: a checkpoint where every input is inspected, even
 *   the boss's laptop; one comment hides a script and is stopped
 *   (`checkpoint`).
 *   Principle of Least Privilege: a key rack with one narrow key per job,
 *   and the admin master key that opened everything retired behind glass
 *   (`keyRack`).
 *
 * Every builder poses itself only from song time. Coordinates are CSS
 * pixels on the 960×540 stage; styles: css/song-video-principle-scenes.css
 * (`.ps-*`).
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, clamp } = window.Timeline;
  const { el, svg, icon } = window.SongKit;
  const { box, show } = window.WesternKit;

  // ------------------------------------------------------------------
  // Open Design: the see-through padlock and its blueprint
  // ------------------------------------------------------------------

  // The lock's pin stacks, left to right: x, the key pin's length, the
  // driver pin's length (the cut of the key sets where they part).
  const PINS = [[42, 13, 9], [54, 8, 14], [66, 15, 7], [78, 10, 12]];

  /** The mechanism inside the lock: the plug, the keyway, and four pin stacks with their springs. */
  function mechanism(g, { line = false } = {}) {
    const cls = (name) => (line ? 'ps-bp-line' : name);
    svg('circle', { class: cls('ps-plug'), cx: 60, cy: 118, r: 19 }, g);
    svg('path', { class: cls('ps-keyway'), d: 'M57.6 103 H62.4 V112 L64.4 116 L62.4 120 V133 H57.6 V122 L55.6 118 L57.6 114 Z' }, g);
    for (const [x, keyPin, driver] of PINS) {
      svg('rect', { class: cls('ps-chamber'), x: x - 4.6, y: 68, width: 9.2, height: 36, rx: 2 }, g);
      const springTop = 70, springBottom = 98 - keyPin - driver;
      const zig = Array.from({ length: 6 }, (_, k) => `L${x + (k % 2 ? 3 : -3)} ${(springTop + (k + 1) * (springBottom - springTop) / 6).toFixed(1)}`).join(' ');
      svg('path', { class: cls('ps-spring'), d: `M${x} ${springTop} ${zig}` }, g);
      svg('rect', { class: cls('ps-driver'), x: x - 3.2, y: springBottom, width: 6.4, height: driver, rx: 1.2 }, g);
      svg('path', { class: cls('ps-keypin'), d: `M${x - 3.2} ${98 - keyPin} H${x + 3.2} V${98 + 2} L${x} ${98 + 5} L${x - 3.2} ${98 + 2} Z` }, g);
    }
  }

  /**
   * A see-through padlock (`size` wide): a glass body that shows its plug,
   * keyway, pins, and springs, under a steel shackle. From `jiggleAt` the
   * shackle rattles for a moment and stays shut.
   */
  function clearLock(parent, { x, y, size = 150, at, until, jiggleAt, how = 'pop' }) {
    const node = box(parent, 'ps-clear-lock', { x, y, w: size });
    const art = svg('svg', { viewBox: '0 0 120 152', width: size, height: size * 152 / 120, 'aria-hidden': 'true' }, node);
    const shackle = svg('g', {}, art);
    svg('path', { class: 'ps-shackle', d: 'M32 66 V40 A28 28 0 0 1 88 40 V66' }, shackle);
    svg('path', { class: 'ps-shackle-shine', d: 'M36.4 58 V41 A23.6 23.6 0 0 1 52 18.6' }, shackle);
    svg('rect', { class: 'ps-glass', x: 10, y: 58, width: 100, height: 90, rx: 13 }, art);
    const inside = svg('g', {}, art);
    mechanism(inside);
    svg('path', { class: 'ps-glass-shine', d: 'M18 70 C18 64 22 62 28 62 M20 136 L36 66' }, art);
    for (const [cx, cy] of [[19, 67], [101, 67], [19, 139], [101, 139]]) svg('circle', { class: 'ps-screw', cx, cy, r: 2.2 }, art);
    if (jiggleAt !== undefined) {
      tween(shackle, [
        { transform: 'translateY(0px)' }, { transform: 'translateY(-5px)' }, { transform: 'translateY(0px)' },
        { transform: 'translateY(-4px)' }, { transform: 'translateY(0px)' },
      ], jiggleAt, 0.7, EASE.inOut);
    }
    return show(node, at, until, how);
  }

  /**
   * The lock's blueprint, pinned up for anyone to read: white lines on
   * blue, the lock's cross-section with callouts, and a title block.
   */
  function blueprint(parent, { x, y, w = 260, at, until, how = 'drop' }) {
    const node = box(parent, 'ps-blueprint', { x, y, w });
    el('span', 'ps-blueprint-tack', node);
    const art = svg('svg', { viewBox: '0 0 260 150', width: '100%', 'aria-hidden': 'true' }, node);
    const drawing = svg('g', { transform: 'translate(80 0) scale(0.85)' }, art);
    svg('path', { class: 'ps-bp-line', d: 'M32 66 V40 A28 28 0 0 1 88 40 V66' }, drawing);
    svg('rect', { class: 'ps-bp-line', x: 10, y: 58, width: 100, height: 90, rx: 13 }, drawing);
    mechanism(drawing, { line: true });
    // Callouts and a dimension line.
    svg('path', { class: 'ps-bp-thin', d: 'M10 160 H110 M10 156 V164 M110 156 V164 M-6 58 V148 M-10 58 H-2 M-10 148 H-2' }, drawing);
    el('div', 'ps-blueprint-title', node, 'Lock design · published');
    return show(node, at, until, how);
  }

  // ------------------------------------------------------------------
  // Zero Trust: the checkpoint
  // ------------------------------------------------------------------

  const INPUT_ICONS = { form: 'envelope', comment: 'chat', upload: 'image', url: 'link', laptop: 'laptop' };

  /**
   * The checkpoint every input passes: a row of parcels, each named, under
   * a gate sign; a magnifying glass sweeps along them from `sweepAt` to
   * `sweepAt + sweep`, ticking each one it has checked. The `bad` one opens
   * as the glass reaches it and shows what it hid; it is stopped with a
   * cross at `rejectAt`.
   */
  function checkpoint(parent, { x, y, w = 620, at, until, items, sweepAt, sweep = 1.6, rejectAt, sign = 'Checkpoint: every input' }) {
    const node = box(parent, 'ps-checkpoint', { x, y, w });
    el('div', 'ps-gate-sign', node, sign);
    const row = el('div', 'ps-gate-row', node);
    // The glass is over parcel i at sweepAt + i × step.
    const step = sweep / Math.max(1, items.length - 1);
    items.forEach((item, i) => {
      const cell = el('div', `ps-parcel${item.bad ? ' ps-parcel--bad' : ''}`, row);
      const crate = el('div', 'ps-crate', cell);
      crate.append(icon(INPUT_ICONS[item.kind] ?? 'box', 'ps-crate-icon'));
      el('div', 'ps-parcel-label', cell, item.label);
      if (item.bad) {
        const hidden = el('div', 'ps-hidden is-staged', cell, item.hidden ?? '<script>');
        fx.pop(hidden, sweepAt + step * i, { from: 0.5 });
        const lid = el('span', 'ps-crate-lid', crate);
        tween(lid, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-38deg)' }], sweepAt + step * i - 0.1, 0.3, EASE.back);
        const cross = el('span', 'ps-mark ps-mark--cross is-staged', cell);
        cross.append(icon('cross'));
        fx.pop(cross, rejectAt ?? sweepAt + step * (i + 0.6), { from: 0.4 });
      } else {
        const check = el('span', 'ps-mark ps-mark--check is-staged', cell);
        check.append(icon('check'));
        fx.pop(check, sweepAt + step * i + 0.12, { from: 0.4 });
      }
    });
    // The glass rides along the row, over each parcel in turn.
    const glass = el('div', 'ps-glass-tool', row);
    glass.append(icon('search'));
    const n = items.length;
    onFrame((t) => {
      const u = clamp((t - sweepAt) / sweep, 0, 1);
      glass.style.left = `${(((0.5 + u * (n - 1)) / n) * 100).toFixed(2)}%`;
      glass.style.opacity = Math.min(clamp((t - sweepAt + 0.4) / 0.3, 0, 1), clamp((sweepAt + sweep + 0.3 - t) / 0.25, 0, 1)).toFixed(2);
    });
    return show(node, at, until, 'rise');
  }

  // ------------------------------------------------------------------
  // Least Privilege: the key rack
  // ------------------------------------------------------------------

  /** A small brass key (`size` wide), drawn bow up, hanging from a hook. */
  function brassKey(parent, size = 30) {
    const art = svg('svg', { class: 'ps-key', viewBox: '0 0 20 44', width: size * 20 / 44, height: size, 'aria-hidden': 'true' }, parent);
    svg('circle', { class: 'ps-key-bow', cx: 10, cy: 9, r: 7.4 }, art);
    svg('circle', { class: 'ps-key-hole', cx: 10, cy: 9, r: 2.6 }, art);
    svg('path', { class: 'ps-key-bow', d: 'M8.4 15.6 H11.6 V36 H15 V38.6 H11.6 V40.6 H14 V43 H8.4 Z' }, art);
    return art;
  }

  /**
   * The key rack: a wooden board of hooks, each with one narrow key and a
   * tag naming its job and its one right, appearing at its time; beside it
   * the admin master key in a glass case, retired with a stamp at
   * `retireAt`.
   */
  function keyRack(parent, { x, y, w = 680, at, until, keys, master, retireAt }) {
    const node = box(parent, 'ps-rack', { x, y, w });
    const board = el('div', 'ps-rack-board', node);
    el('div', 'ps-rack-title', board, 'One key per job');
    const hooks = el('div', 'ps-rack-hooks', board);
    for (const k of keys) {
      const hook = el('div', 'ps-hook is-staged', hooks);
      el('span', 'ps-hook-peg', hook);
      brassKey(hook, 52);
      const tag = el('div', 'ps-hook-tag', hook);
      el('div', 'ps-hook-name', tag, k.name);
      el('div', 'ps-hook-right', tag, k.right);
      fx.pop(hook, k.at, { from: 0.6 });
    }
    const caseNode = el('div', 'ps-master', node);
    const glassCase = el('div', 'ps-master-case', caseNode);
    brassKey(glassCase, 62);
    el('div', 'ps-master-label', caseNode, master);
    const retired = el('div', 'ps-retired is-staged', caseNode, 'Retired');
    fx.slam(retired, retireAt, { from: 1.6, rotate: -12 });
    return show(node, at, until, 'rise');
  }

  window.PrincipleScenes = { clearLock, blueprint, checkpoint, keyRack };
})();
